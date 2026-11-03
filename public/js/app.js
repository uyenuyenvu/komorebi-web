// ===================== APP (multi-page) =====================
const CFG = window.KOMOREBI_CONFIG || window.SOBEP_CONFIG || {};
const configured = !!(window.supabase && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/xxxx/.test(CFG.SUPABASE_URL));
const sb = configured ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

const PAGE = document.body.dataset.page || 'home';
const ROOT = '../'; // app pages live under /pages/
const LOGIN_URL = ROOT + 'index.html';
const PAGE_FILE = {
  home: 'home.html', library: 'library.html', detail: 'detail.html', reader: 'reader.html',
  favorites: 'favorites.html', history: 'history.html', profile: 'profile.html',
  master: 'master.html', settings: 'settings.html', upload: 'upload.html'
};

function pageHref(name, params) {
  const file = PAGE_FILE[name] || (name + '.html');
  let url = file;
  if (params && Object.keys(params).length) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, v); });
    const s = q.toString();
    if (s) url += '?' + s;
  }
  return url;
}

function setAuthSession(session) {
  try {
    sessionStorage.setItem('komorebi.uid', session.user.id);
    sessionStorage.setItem('komorebi.email', session.user.email || '');
    sessionStorage.setItem('komorebi.authed', '1');
  } catch (e) {}
  try {
    document.cookie = `komorebi_email=${encodeURIComponent(session.user.email || '')}; path=/; Max-Age=2592000; SameSite=Lax`;
    document.cookie = `komorebi_uid=${encodeURIComponent(session.user.id)}; path=/; Max-Age=2592000; SameSite=Lax`;
  } catch (e) {}
}

function clearAuthSession() {
  try {
    sessionStorage.removeItem('komorebi.uid');
    sessionStorage.removeItem('komorebi.email');
    sessionStorage.removeItem('komorebi.authed');
  } catch (e) {}
  try {
    document.cookie = 'komorebi_email=; path=/; Max-Age=0; SameSite=Lax';
    document.cookie = 'komorebi_uid=; path=/; Max-Age=0; SameSite=Lax';
  } catch (e) {}
}

async function logout() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.classList.remove('show');
  if (sb) await sb.auth.signOut();
  clearAuthSession();
  resetData();
  location.href = LOGIN_URL;
}


// ===================== HẰNG SỐ & TIỆN ÍCH =====================
const BUCKET = 'komorebi';
let GENRES = ['Action','Adventure','Comedy','Drama','Fantasy','Horror','Isekai','Mystery','Romance','Sci-fi','Slice of life','Thriller'];
let STATUSES = [
  { id: 'dang', name: 'Đang ra', cls: 'tone-green' },
  { id: 'xong', name: 'Hoàn thành', cls: 'tone-blue' },
  { id: 'ss1',  name: 'Hết season 1', cls: 'tone-purple' },
  { id: 'ss2',  name: 'Hết season 2', cls: 'tone-purple' },
  { id: 'dung', name: 'Tạm dừng', cls: 'tone-yellow' },
  { id: 'drop', name: 'Drop', cls: 'tone-pink' }
];
const COVER_COLORS = [['#CFE3CF','#9DC3A6'],['#F6E3B8','#EDC98B'],['#F3D9D5','#E3AFA8'],['#DCE4F2','#AFC0E0'],['#E8DFF2','#C7B5E0'],['#DDEFEA','#A9D3C6'],['#F5E6D3','#DDBE98']];
const COVER_EMOJI = ['📖','🍃','🌙','⭐','🌸','🐾','☁️','🍀'];

const $ = id => {
  let el = document.getElementById(id);
  if (el) return el;
  el = document.createElement('div');
  el.id = id;
  el.hidden = true;
  el.setAttribute('data-stub', '1');
  document.body.appendChild(el);
  return el;
};
const $real = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const titleKey = s => fold(s).replace(/\s+/g, ' ').trim();
const viColl = new Intl.Collator('vi', { numeric: true });
const statusOf = id => STATUSES.find(s => s.id === id) || STATUSES[0];
const fmtDate = d => d ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fmtNum = n => Number.isInteger(+n) ? String(+n) : String(+n).replace('.', ',');
const hashIdx = (s, n) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % n; };
const chapLabel = c => `Chương ${fmtNum(c.number)}${c.title ? ': ' + c.title : ''}`;

let toastTimer;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  t.classList.toggle('err', /^(🥲|❌)/.test(msg)); t.classList.toggle('warn', /^(⚠️|⏳|🔒|↩)/.test(msg));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ===================== DỮ LIỆU (Supabase) =====================
const DB = { manga: [], loaded: false, loading: false, uid: null, error: null };
const URL_TTL = 6 * 3600;           // link ảnh có hạn 6 giờ
const urlCache = new Map();
try { const saved = JSON.parse(localStorage.getItem('komorebi.urls') || '[]'); const now = Date.now(); saved.forEach(([k, v]) => { if (v.exp > now) urlCache.set(k, v); }); } catch (e) {}
let urlSaveTimer;
function persistUrls() {
  clearTimeout(urlSaveTimer);
  urlSaveTimer = setTimeout(() => { try { localStorage.setItem('komorebi.urls', JSON.stringify([...urlCache.entries()].slice(-4000))); } catch (e) {} }, 400);
}
async function signedUrls(paths) {
  const now = Date.now();
  const need = [...new Set(paths.filter(p => p && !(urlCache.get(p)?.exp > now + 5 * 60 * 1000)))];
  for (let i = 0; i < need.length; i += 100) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 100), URL_TTL);
    if (error) throw error;
    (data || []).forEach(d => { if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, exp: now + (URL_TTL - 300) * 1000 }); });
  }
  if (need.length) persistUrls();
  return paths.map(p => urlCache.get(p)?.url || '');
}
const coverUrl = m => (m.cover_path && urlCache.get(m.cover_path)?.url) || '';

async function loadLibrary() {
  DB.loading = true; DB.error = null; renderLibrary(); renderHome();
  try {
    await loadMaster();
    const { data, error } = await sb.from('manga')
      .select('id,user_id,title,title_key,author,translator,release_date,status,genres,description,cover_path,created_at,updated_at,chapters(id,number,title,created_at)')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    DB.manga = (data || []).map(m => Object.assign(m, { chapters: (m.chapters || []).sort((a, b) => a.number - b.number) }));
    DB.loaded = true;
    try { await loadUserData(); } catch (e) { console.warn('userdata', e); if (!ME.dataErr) showToast('🔧 Chạy lại schema-komorebi.sql để bật yêu thích, lịch sử và thông báo'); ME.dataErr = true; }
    try { await signedUrls(DB.manga.map(m => m.cover_path)); } catch (e) { console.warn(e); }
  } catch (e) {
    console.warn('loadLibrary', e);
    DB.error = /relation|does not exist|schema cache/i.test(e.message || '')
      ? 'Supabase còn thiếu bảng. Chạy lại file schema-komorebi.sql (bản mới nhất) trong SQL Editor nhé.'
      : 'Chưa tải được thư viện: ' + (e.message || 'lỗi không rõ');
  }
  DB.loading = false;
  renderLibrary(); renderHome(); fillTitleList();
  if (STATE.screen === 'master') renderMaster();
  refreshUserViews();
  if (STATE.screen === 'detail') renderDetail();
}
function readRouteParams() {
  const q = new URLSearchParams(location.search);
  if (PAGE === 'detail') {
    const id = q.get('id');
    if (id) STATE.mangaId = id;
  }
  if (PAGE === 'reader') {
    const m = q.get('manga'), c = q.get('chapter');
    if (m) STATE.mangaId = m;
    if (c) STATE.chapterId = c;
  }
  if (PAGE === 'upload') {
    /* handled in bootPage after library loads */
  }
  return q;
}

async function onSignedIn(session) {
  DB.uid = session.user.id; ME.email = session.user.email || '';
  const emailEl = $real('userEmail');
  if (emailEl) emailEl.textContent = session.user.email || '';
  setAuthSession(session);
  loadProfile();
  showScreen(PAGE);
  readRouteParams(); // lấy ?id= / ?manga= trước khi loadLibrary gọi renderDetail
  await loadRole();
  await loadLibrary();
  bootPage();
}
function resetData() { DB.manga = []; DB.loaded = false; DB.uid = null; urlCache.clear(); ME.favs = new Map(); ME.hist = []; ME.profile = null; ME.avatarUrl = ''; renderMe(); renderBell(); }

// ===================== ĐIỀU HƯỚNG (multi-page) =====================
const STATE = { screen: PAGE, mangaId: null, chapterId: null, chOrder: 'desc' };
const MENU_OF = { home: 'home', library: 'library', detail: 'library', reader: 'library', upload: 'upload', master: 'master', settings: 'settings', favorites: 'favorites', history: 'history', profile: 'profile' };

function showScreen(name) {
  STATE.screen = name;
  document.body.dataset.screen = name;
  if (name !== 'reader') { const h = document.getElementById('readHint'); if (h) h.hidden = true; }
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
  document.querySelectorAll('.side-menu a[data-screen]').forEach(a => a.classList.toggle('current', a.dataset.screen === MENU_OF[name]));
  window.scrollTo({ top: 0 });
}
function goScreen(name, params) {
  closeDrawer();
  if ((name === 'upload' || name === 'master') && typeof canUpload === 'function' && DB.uid && !canUpload()) {
    showToast('🔒 Tài khoản này chỉ có quyền đọc truyện');
    return;
  }
  if (name === PAGE && !params) {
    showScreen(name);
    if (name === 'home') renderHome();
    if (name === 'master') renderMaster();
    if (name === 'settings') { renderThemeOpts(); renderReadOpts(); }
    if (name === 'favorites') renderFavs();
    if (name === 'history') renderHistory();
    if (name === 'profile') { renderProfile(); setProfileEdit(false); }
    if (name === 'library') renderLibrary();
    return;
  }
  location.href = pageHref(name, params);
}
function goHome() { goScreen('home'); }
// ---- Menu: đầy đủ / thu gọn / ẩn (máy tính) · ngăn kéo (điện thoại) ----
const isDesk = () => matchMedia('(min-width: 1000px)').matches;
let menuMode = 'full', lastShown = 'full';
try { menuMode = localStorage.getItem('komorebi.menu') || 'full'; lastShown = localStorage.getItem('komorebi.menuLast') || 'full'; } catch (e) {}
function setMenuMode(mode) {
  menuMode = mode; if (mode !== 'hidden') lastShown = mode;
  document.body.classList.remove('menu-full', 'menu-mini', 'menu-hidden');
  document.body.classList.add('menu-' + mode);
  document.querySelectorAll('.side-mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode));
  try { localStorage.setItem('komorebi.menu', mode); localStorage.setItem('komorebi.menuLast', lastShown); } catch (e) {}
  updateMenuBtn();
}
function updateMenuBtn() {
  const b = $('menuBtn');
  const label = isDesk() ? (menuMode === 'hidden' ? 'Hiện menu' : 'Ẩn menu') : ($('sideMenu').classList.contains('active') ? 'Đóng menu' : 'Mở menu');
  b.title = label; b.setAttribute('aria-label', label);
  document.body.classList.toggle('menu-open', isDesk() ? menuMode !== 'hidden' : $('sideMenu').classList.contains('active'));
}
function closeDrawer() { if (!isDesk()) toggleMenu(false); }
function toggleMenu(force) {
  if (isDesk()) {
    if (force === false) return;
    setMenuMode(menuMode === 'hidden' ? lastShown : 'hidden');
    return;
  }
  const menu = $('sideMenu');
  const open = typeof force === 'boolean' ? force : !menu.classList.contains('active');
  menu.classList.toggle('active', open);
  $('overlay').classList.toggle('active', open);
  updateMenuBtn();
}
document.querySelectorAll('.side-mode button').forEach(b => b.addEventListener('click', () => setMenuMode(b.dataset.mode)));
function syncNavH() { const n = document.querySelector('nav'); if (n) document.documentElement.style.setProperty('--nav-h', n.offsetHeight + 'px'); }
window.addEventListener('resize', () => { syncNavH(); if (isDesk()) { $('sideMenu').classList.remove('active'); $('overlay').classList.remove('active'); } updateMenuBtn(); });
setMenuMode(menuMode); syncNavH();
function toggleUserMenu() { $('bellPanel').hidden = true; $('userDropdown').classList.toggle('show'); }
window.addEventListener('click', e => {
  if (!e.target.closest('.user-area')) $('userDropdown').classList.remove('show');
  if (e.target.id === 'overlay') toggleMenu(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { toggleMenu(false); $('userDropdown').classList.remove('show'); }
  if (STATE.screen === 'reader' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
    const rtl = READ.dir === 'rtl';
    if (e.key === 'ArrowLeft') { if (!flip(rtl ? 1 : -1)) stepChapter(-1); }
    if (e.key === 'ArrowRight') { if (!flip(rtl ? -1 : 1)) stepChapter(1); }
  }
});
document.addEventListener('click', e => {
  const d = e.target.closest('[aria-disabled="true"]');
  if (d) { e.preventDefault(); e.stopPropagation(); showToast('🌱 Tính năng này sắp có nhé'); }
}, true);

function crumbs(items) {
  const home = '<svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24" style="margin-bottom:2px;"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg>';
  return items.map(([label, act], i) => {
    const text = (i === 0 ? home + ' ' : '') + esc(label);
    return act ? `<a href="#" data-act="${act}">${text}</a>` : `<span>${text}</span>`;
  }).join(' <span>/</span> ');
}
document.addEventListener('click', e => {
  const a = e.target.closest('.breadcrumb a[data-act]'); if (!a) return;
  e.preventDefault();
  const act = a.dataset.act;
  if (act === 'home') goScreen('home');
  else if (act === 'library') goScreen('library');
  else if (act.startsWith('detail:')) openDetail(act.slice(7));
});

// ===================== CHECKBOX PULLDOWN =====================
const DROPS = [];
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function makeDrop(el, opt) {
  const d = { el, multi: opt.multi !== false, items: [], sel: new Set(opt.value || []), q: '', allText: opt.allText, onChange: opt.onChange || (() => {}), name: 'cbx' + DROPS.length };
  el.classList.add('cbx');
  el.innerHTML = `<button type="button" class="cbx-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(opt.label)}"><span class="txt"></span><span class="cnt" hidden></span>${CHEV}</button>
    <div class="cbx-panel" hidden>
      <label class="cbx-search"><span class="sr-only">Tìm ${esc(opt.label)}</span><input type="search" placeholder="Tìm ${esc(opt.label.toLowerCase())}…" autocomplete="off"></label>
      <div class="cbx-list" role="listbox" ${d.multi ? 'aria-multiselectable="true"' : ''}></div>
      <div class="cbx-foot">${d.multi ? '<button type="button" class="link-btn" data-clear>Bỏ chọn</button>' : '<span></span>'}<button type="button" class="cbx-done" data-done>Xong</button></div>
    </div>`;
  d.btn = el.querySelector('.cbx-btn'); d.panel = el.querySelector('.cbx-panel'); d.list = el.querySelector('.cbx-list'); d.search = el.querySelector('.cbx-search input');
  d.btn.addEventListener('click', () => d.panel.hidden ? openDrop(d) : closeDrop(d));
  d.search.addEventListener('input', e => { d.q = e.target.value; renderDropList(d); });
  d.list.addEventListener('change', e => {
    const v = e.target.value;
    if (d.multi) { e.target.checked ? d.sel.add(v) : d.sel.delete(v); } else { d.sel = new Set([v]); closeDrop(d); }
    renderDropBtn(d); d.onChange([...d.sel]);
  });
  d.list.addEventListener('click', e => { if (!d.multi && e.target.closest('.cbx-opt')) setTimeout(() => closeDrop(d), 0); });
  el.querySelector('[data-done]').addEventListener('click', () => { closeDrop(d); d.btn.focus(); });
  const clr = el.querySelector('[data-clear]');
  if (clr) clr.addEventListener('click', () => { d.sel.clear(); renderDropList(d); renderDropBtn(d); d.onChange([]); });
  d.setItems = items => { d.items = items; renderDropList(d); renderDropBtn(d); };
  d.setValue = vals => { d.sel = new Set(vals || []); renderDropList(d); renderDropBtn(d); };
  d.getValue = () => [...d.sel];
  DROPS.push(d); return d;
}
function renderDropList(d) {
  const q = fold(d.q.trim()), its = d.items.filter(i => !q || fold(i.label).includes(q));
  d.search.parentElement.hidden = d.items.length < 8;
  d.list.innerHTML = its.length ? its.map(i => `<label class="cbx-opt${i.count === 0 && !d.sel.has(i.value) ? ' zero' : ''}">
      <input type="${d.multi ? 'checkbox' : 'radio'}" name="${d.name}" value="${esc(i.value)}" ${d.sel.has(i.value) ? 'checked' : ''}>
      <span class="cbx-box${d.multi ? '' : ' round'}"></span><span>${esc(i.label)}</span>${i.count != null ? `<span class="n">${i.count}</span>` : ''}</label>`).join('')
    : '<p class="cbx-empty">Không có mục nào khớp 🍃</p>';
}
function renderDropBtn(d) {
  const names = d.items.filter(i => d.sel.has(i.value)).map(i => i.label);
  d.btn.querySelector('.txt').textContent = !names.length ? d.allText : names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]}…`;
  const cnt = d.btn.querySelector('.cnt'); cnt.hidden = !(d.multi && names.length > 2); cnt.textContent = names.length;
  d.el.classList.toggle('on', d.multi && names.length > 0);
}
function openDrop(d) {
  DROPS.forEach(x => x !== d && closeDrop(x));
  d.panel.hidden = false; d.btn.setAttribute('aria-expanded', 'true');
  d.panel.classList.remove('right');
  if (d.panel.getBoundingClientRect().right > window.innerWidth - 12) d.panel.classList.add('right');
  if (!d.search.parentElement.hidden) d.search.focus();
}
function closeDrop(d) { if (d.panel.hidden) return; d.panel.hidden = true; d.btn.setAttribute('aria-expanded', 'false'); d.q = ''; d.search.value = ''; renderDropList(d); }
document.addEventListener('click', e => DROPS.forEach(d => { if (!d.el.contains(e.target)) closeDrop(d); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') DROPS.forEach(closeDrop); });

// ===================== TRANG CHỦ =====================
const HOME = { page: 1, per: 12 };
function homeCard(m) {
  const last = m.chapters[m.chapters.length - 1], st = statusOf(m.status);
  const isNew = (Date.now() - new Date(m.updated_at).getTime()) < 7 * 864e5;
  return `<button type="button" class="h-card" data-id="${m.id}" aria-label="${esc(m.title)}">
    <div class="h-cover">${coverHTML(m, true)}<div class="h-badges">${isNew ? '<span class="h-badge">Mới</span>' : ''}${m.status === 'xong' ? '<span class="h-badge done">Hết</span>' : ''}${typeof ME !== 'undefined' && ME.favs.has(m.id) ? '<span class="h-badge fav">⭐</span>' : ''}</div></div>
    <span class="h-title">${esc(m.title)}</span>
    <span class="h-meta"><span class="h-chip">${last ? 'Chap ' + fmtNum(last.number) : 'Chưa có chap'}</span><span>${esc(st.name)}</span><span>· ${relTimeShort(m.updated_at)}</span></span>
  </button>`;
}
function relTimeShort(d) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return days <= 0 ? 'hôm nay' : days === 1 ? 'hôm qua' : days < 30 ? `${days} ngày` : fmtDate(d);
}
function renderHome() {
  const box = $('homeNew'), strip = $('heroStrip');
  $('secNew').hidden = false;
  if (DB.loading && !DB.loaded) { box.innerHTML = '<div class="loading-shelf" style="grid-column:1/-1"><span class="leaf">🍃</span><br>Đang mở kệ sách…</div>'; strip.innerHTML = ''; $('homePager').innerHTML = ''; $('secDone').hidden = true; return; }
  if (DB.error) { box.innerHTML = `<div class="lib-empty" style="grid-column:1/-1"><div class="big">🔌</div><h3>Có chút trục trặc</h3><p>${esc(DB.error)}</p><button type="button" class="btn-submit secondary" onclick="loadLibrary()">Thử lại</button></div>`; strip.innerHTML = ''; $('homePager').innerHTML = ''; $('secDone').hidden = true; return; }
  const all = DB.manga.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  $('secNew').hidden = !all.length;
  $('heroSub').textContent = all.length ? `${all.length} bộ truyện trên kệ · bấm vào bìa để xem nhé` : 'Kệ sách còn trống, upload bộ đầu tiên nhé';
  strip.innerHTML = all.slice(0, 10).map(m => `<button type="button" class="hero-card" data-id="${m.id}"><span class="h-cover">${coverHTML(m, true)}</span><span class="hero-name">${esc(m.title)}</span></button>`).join('')
    || '<div class="lib-empty" style="flex:1"><div class="big">📚</div><h3>Kệ sách còn trống</h3><p>Upload bộ truyện đầu tiên, nó sẽ xuất hiện ngay ở đây.</p><button type="button" class="btn-submit primary need-upload" onclick="goUpload()">＋ Upload truyện</button></div>';
  document.querySelectorAll('.hero-arrow').forEach(b => b.hidden = all.length < 5);
  const pages = Math.max(1, Math.ceil(all.length / HOME.per));
  HOME.page = Math.min(Math.max(1, HOME.page), pages);
  const slice = all.slice((HOME.page - 1) * HOME.per, HOME.page * HOME.per);
  box.innerHTML = slice.length ? slice.map(homeCard).join('') : '<p class="ch-empty" style="grid-column:1/-1">Chưa có truyện nào.</p>';
  $('homePager').innerHTML = pages > 1 ? `<button type="button" class="btn-submit secondary" data-hp="-1" ${HOME.page <= 1 ? 'disabled' : ''}>❮ Trước</button><span>Trang ${HOME.page}/${pages}</span><button type="button" class="btn-submit primary" data-hp="1" ${HOME.page >= pages ? 'disabled' : ''}>Sau ❯</button>` : '';
  const done = all.filter(m => m.status === 'xong');
  $('secDone').hidden = !done.length;
  $('homeDone').innerHTML = done.slice(0, 8).map(homeCard).join('');
}
['heroStrip', 'homeNew', 'homeDone'].forEach(id => $(id).addEventListener('click', e => { const c = e.target.closest('[data-id]'); if (c) openDetail(c.dataset.id); }));
$('homePager').addEventListener('click', e => { const b = e.target.closest('[data-hp]'); if (!b || b.disabled) return; HOME.page += +b.dataset.hp; renderHome(); $('homeNew').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
document.querySelectorAll('.hero-arrow').forEach(b => b.addEventListener('click', () => { const s = $('heroStrip'); s.scrollBy({ left: +b.dataset.hero * s.clientWidth * .8, behavior: 'smooth' }); }));
$('seeDone').addEventListener('click', () => { location.href = pageHref('library', { status: 'xong' }); });

// ===================== THƯ VIỆN =====================
const LIB = { q: '', status: new Set(), genres: new Set(), sort: 'new', page: 1, per: 10 };
const dStatus = makeDrop($('fStatus'), { label: 'Tiến độ', allText: 'Tất cả tiến độ', onChange: v => { LIB.status = new Set(v); LIB.page = 1; renderLibrary(); } });
const dGenre = makeDrop($('fGenre'), { label: 'Thể loại', allText: 'Tất cả thể loại', onChange: v => { LIB.genres = new Set(v); LIB.page = 1; renderLibrary(); } });

function highlight(text, q) {
  const t = String(text || '');
  const fq = fold(q.trim());
  if (!fq) return esc(t);
  const ft = fold(t); let out = '', i = 0, k;
  while ((k = ft.indexOf(fq, i)) !== -1) { out += esc(t.slice(i, k)) + '<mark>' + esc(t.slice(k, k + fq.length)) + '</mark>'; i = k + fq.length; }
  return out + esc(t.slice(i));
}
function libFiltered(opt = {}) {
  const q = fold(LIB.q.trim());
  return DB.manga.filter(m =>
    (opt.noStatus || !LIB.status.size || LIB.status.has(m.status)) &&
    (opt.noGenre || !LIB.genres.size || (m.genres || []).some(g => LIB.genres.has(g))) &&
    (!q || fold([m.title, m.author, m.translator, m.description].join(' ')).includes(q)));
}
function libSorted(l) {
  l = l.slice();
  if (LIB.sort === 'az') l.sort((a, b) => viColl.compare(a.title, b.title));
  else if (LIB.sort === 'chap') l.sort((a, b) => b.chapters.length - a.chapters.length);
  else l.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  return l;
}
function coverHTML(m, big) {
  const [c1, c2] = COVER_COLORS[hashIdx(m.title_key || m.title, COVER_COLORS.length)];
  const url = coverUrl(m);
  const isNew = !big && (Date.now() - new Date(m.updated_at).getTime()) < 7 * 864e5;
  return `<div class="cover" style="background:linear-gradient(160deg, ${c1}, ${c2})" aria-hidden="true">
    ${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<span class="cover-emoji">${COVER_EMOJI[hashIdx(m.title, COVER_EMOJI.length)]}</span><span class="cover-title">${esc(m.title)}</span>`}
    ${isNew ? '<span class="cover-ribbon">Mới</span>' : ''}
  </div>`;
}
function fillSelects() {
  const byS = libFiltered({ noStatus: true }), byG = libFiltered({ noGenre: true });
  dStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name, count: byS.filter(m => m.status === s.id).length })));
  dGenre.setItems(GENRES.map(g => ({ value: g, label: g, count: byG.filter(m => (m.genres || []).includes(g)).length })));
}
function renderLibrary() {
  fillSelects();
  const list = $('mangaList');
  $('libSearchClear').hidden = !$('libSearch').value;
  const active = !!(LIB.q || LIB.status.size || LIB.genres.size);
  $('libReset').disabled = !active;
  $('libSub').textContent = DB.loaded ? (DB.manga.length ? `${DB.manga.length} bộ truyện trên kệ` : 'Kệ sách còn trống') : '';

  if (DB.loading && !DB.loaded) {
    list.innerHTML = '<div class="loading-shelf"><span class="leaf">🍃</span><br>Đang mở kệ sách…</div>';
    $('pager').hidden = true; $('filterSummary').textContent = ''; return;
  }
  if (DB.error) {
    list.innerHTML = `<div class="lib-empty"><div class="big">🔌</div><h3>Có chút trục trặc</h3><p>${esc(DB.error)}</p><button type="button" class="btn-submit secondary" onclick="loadLibrary()">Thử lại</button></div>`;
    $('pager').hidden = true; $('filterSummary').textContent = ''; return;
  }
  if (!DB.manga.length) {
    list.innerHTML = `<div class="lib-empty"><div class="big">📚</div><h3>Kệ sách còn trống</h3><p>Upload bộ truyện đầu tiên, nó sẽ xuất hiện ngay ở đây.</p><button type="button" class="btn-submit primary need-upload" onclick="goUpload()">＋ Upload truyện</button></div>`;
    $('pager').hidden = true; $('filterSummary').textContent = ''; return;
  }

  const all = libSorted(libFiltered());
  const total = all.length, pages = Math.max(1, Math.ceil(total / LIB.per));
  LIB.page = Math.min(Math.max(1, LIB.page), pages);
  const start = (LIB.page - 1) * LIB.per, slice = all.slice(start, start + LIB.per);
  $('filterSummary').innerHTML = total ? `Tìm thấy <b>${total}</b> truyện${LIB.q ? ` cho “${esc(LIB.q)}”` : ''}${LIB.status.size || LIB.genres.size ? ' khớp bộ lọc' : ''}` : 'Chưa có truyện nào khớp';

  if (!total) {
    list.innerHTML = `<div class="lib-empty"><div class="big">🍃</div><h3>Không tìm thấy truyện nào</h3><p>Thử đổi tiến độ, thể loại hoặc tìm bằng từ khác nhé.</p><button type="button" class="btn-submit secondary" onclick="resetLibrary()">Bỏ hết bộ lọc</button></div>`;
  } else {
    list.innerHTML = slice.map(m => {
      const st = statusOf(m.status), last = m.chapters[m.chapters.length - 1];
      return `<button type="button" class="manga-item" data-id="${m.id}" aria-label="Xem ${esc(m.title)}">
        ${coverHTML(m)}
        <div class="m-body">
          <div class="m-top">
            <div><h3 class="m-title">${highlight(m.title, LIB.q)}</h3><p class="m-author">✍️ ${highlight(m.author || 'Chưa rõ tác giả', LIB.q)}</p></div>
            <span class="status ${st.cls}">${esc(st.name)}</span>
          </div>
          ${(m.genres || []).length ? `<div class="m-tags">${m.genres.map(g => `<span class="m-tag">${esc(g)}</span>`).join('')}</div>` : ''}
          <p class="m-desc">${m.description ? highlight(m.description, LIB.q) : '<i style="color:var(--mau-nau-nhat)">Chưa có mô tả</i>'}</p>
          <div class="m-foot">
            <span class="m-meta"><span>📖 ${m.chapters.length} chương${last ? ` · mới nhất ch.${fmtNum(last.number)}` : ''}</span><span>🕒 ${fmtDate(m.updated_at)}</span></span>
            <span class="m-read">Xem truyện ❯</span>
          </div>
        </div>
      </button>`;
    }).join('');
  }
  $('pager').hidden = !total;
  $('pagerInfo').innerHTML = `Hiển thị <b>${start + 1}–${Math.min(start + LIB.per, total)}</b> trên tổng <b>${total}</b> truyện`;
  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - LIB.page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  $('pagerPages').innerHTML =
    `<button type="button" class="pg-btn" data-pg="${LIB.page - 1}" aria-label="Trang trước" ${LIB.page <= 1 ? 'disabled' : ''}>❮</button>` +
    nums.map(p => p === '…' ? '<span class="pg-dots">…</span>' : `<button type="button" class="pg-btn" data-pg="${p}" ${p === LIB.page ? 'aria-current="page"' : ''} aria-label="Trang ${p}">${p}</button>`).join('') +
    `<button type="button" class="pg-btn" data-pg="${LIB.page + 1}" aria-label="Trang sau" ${LIB.page >= pages ? 'disabled' : ''}>❯</button>`;
}
function resetLibrary() { Object.assign(LIB, { q: '', status: new Set(), genres: new Set(), page: 1 }); $('libSearch').value = ''; dStatus.setValue([]); dGenre.setValue([]); renderLibrary(); }
function openLibrarySearch() {
  closeDrawer();
  if (PAGE === 'library') {
    showScreen('library');
    setTimeout(() => { const i = $real('libSearch'); if (i) i.focus(); }, 60);
    return;
  }
  location.href = pageHref('library', { focus: '1' });
}

$('libSearchForm').addEventListener('submit', e => { e.preventDefault(); LIB.q = $('libSearch').value.trim(); LIB.page = 1; renderLibrary(); $('libSearch').blur(); });
$('libSearch').addEventListener('input', e => { $('libSearchClear').hidden = !e.target.value; if (!e.target.value && LIB.q) { LIB.q = ''; LIB.page = 1; renderLibrary(); } });
$('libSearchClear').addEventListener('click', () => { LIB.q = ''; $('libSearch').value = ''; LIB.page = 1; renderLibrary(); $('libSearch').focus(); });
$('libSort').addEventListener('change', e => { LIB.sort = e.target.value; LIB.page = 1; renderLibrary(); });
$('perPage').addEventListener('change', e => { LIB.per = +e.target.value; LIB.page = 1; renderLibrary(); });
$('libReset').addEventListener('click', resetLibrary);
$('pagerPages').addEventListener('click', e => {
  const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return;
  LIB.page = +b.dataset.pg; renderLibrary(); window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('mangaList').addEventListener('click', e => { const it = e.target.closest('[data-id]'); if (it) openDetail(it.dataset.id); });

// ===================== CHI TIẾT TRUYỆN =====================
function lastReadOf(mangaId) {
  try { return JSON.parse(localStorage.getItem('komorebi.read.' + mangaId) || '[]'); } catch (e) { return []; }
}
function openDetail(id) {
  if (PAGE === 'detail') {
    STATE.mangaId = id;
    const u = pageHref('detail', { id });
    history.replaceState(null, '', u);
    showScreen('detail');
    renderDetail();
    return;
  }
  location.href = pageHref('detail', { id });
}
function renderDetail() {
  if (PAGE !== 'detail' && !$real('dTitle')) return;
  if (!STATE.mangaId) return;
  if (DB.loading) {
    if ($real('dTitle')) $('dTitle').textContent = 'Đang mở truyện…';
    return;
  }
  const m = DB.manga.find(x => x.id === STATE.mangaId);
  if (!m) {
    if (!DB.loaded) return;
    if ($real('dTitle')) {
      $('dTitle').textContent = 'Không tìm thấy truyện';
      if ($real('dDesc')) $('dDesc').textContent = 'Truyện này không còn trên kệ hoặc link đã cũ.';
      if ($real('chList')) $('chList').innerHTML = `<li class="ch-empty"><button type="button" class="btn-submit primary" onclick="goScreen('library')">← Về thư viện</button></li>`;
    }
    return;
  }
  const st = statusOf(m.status), chs = m.chapters;
  $('detailCrumbs').innerHTML = crumbs([['Home', 'home'], ['Thư viện', 'library'], [m.title]]);
  $('dCover').innerHTML = coverHTML(m, true);
  $('dTitle').textContent = m.title;
  const fact = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
  $('dFacts').innerHTML =
    fact('Tác giả', esc(m.author || 'Chưa rõ')) +
    fact('Người dịch', esc(m.translator || '—')) +
    fact('Phát hành', esc(m.release_date ? fmtDate(m.release_date) : '—')) +
    fact('Tiến độ', `<span class="status ${st.cls}">${esc(st.name)}</span>`) +
    fact('Số chương', chs.length ? `${chs.length} chương` : 'Chưa có chương') +
    fact('Cập nhật', esc(fmtDate(m.updated_at)));
  $('dGenres').innerHTML = (m.genres || []).map(g => `<span class="m-tag">${esc(g)}</span>`).join('');
  $('dDesc').textContent = m.description || 'Chưa có mô tả cho truyện này.';
  $('dReadFirst').disabled = $('dReadLast').disabled = $('dEditChap').disabled = !chs.length;
  $('dFav').setAttribute('aria-pressed', isFav(m.id)); $('dFav').textContent = isFav(m.id) ? '⭐ Đã yêu thích' : '☆ Yêu thích';
  const read = lastReadOf(m.id), lastAt = read[read.length - 1];
  $('dReadFirst').textContent = lastAt && chs.some(c => c.id === lastAt) ? '📖 Đọc tiếp' : '📖 Đọc từ đầu';
  $('dChCount').textContent = `(${chs.length})`;
  $('chSort').textContent = STATE.chOrder === 'desc' ? 'Mới nhất trước ⇅' : 'Cũ nhất trước ⇅';
  const ordered = STATE.chOrder === 'desc' ? chs.slice().reverse() : chs;
  $('chList').innerHTML = ordered.length ? ordered.map(c => `<li><button type="button" class="ch-item${read.includes(c.id) ? ' read' : ''}${c.id === lastAt ? ' last' : ''}" data-ch="${c.id}">
      <span class="ch-num">${fmtNum(c.number)}</span>
      <span class="ch-text"><span class="ch-name">${esc(c.title ? c.title : 'Chương ' + fmtNum(c.number))}</span><span class="ch-date">${c.id === lastAt ? '🔖 Đang đọc dở · ' : read.includes(c.id) ? '✓ Đã đọc · ' : ''}${fmtDate(c.created_at)}</span></span>
    </button></li>`).join('')
    : '<li class="ch-empty">Truyện này chưa có chương nào. Bấm “＋ Thêm chương” để upload nhé.</li>';
}
$('chList').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) openChapter(STATE.mangaId, b.dataset.ch); });
$('chSort').addEventListener('click', () => { STATE.chOrder = STATE.chOrder === 'desc' ? 'asc' : 'desc'; renderDetail(); });
$('dReadFirst').addEventListener('click', () => {
  const m = DB.manga.find(x => x.id === STATE.mangaId); if (!m || !m.chapters.length) return;
  const read = lastReadOf(m.id), lastAt = read[read.length - 1];
  openChapter(m.id, m.chapters.some(c => c.id === lastAt) ? lastAt : m.chapters[0].id);
});
$('dReadLast').addEventListener('click', () => {
  const m = DB.manga.find(x => x.id === STATE.mangaId); if (m && m.chapters.length) openChapter(m.id, m.chapters[m.chapters.length - 1].id);
});
$('dAddChap').addEventListener('click', () => goUploadExisting(STATE.mangaId, 'next'));
$('dEditChap').addEventListener('click', () => goUploadExisting(STATE.mangaId, 'edit'));
$('dEditInfo').addEventListener('click', () => goUploadExisting(STATE.mangaId, 'info'));
$('dFav').addEventListener('click', () => toggleFav(STATE.mangaId));

// ===================== TRANG ĐỌC =====================
let readerToken = 0;
async function openChapter(mangaId, chapterId) {
  if (PAGE !== 'reader') {
    location.href = pageHref('reader', { manga: mangaId, chapter: chapterId });
    return;
  }
  try { history.replaceState(null, '', pageHref('reader', { manga: mangaId, chapter: chapterId })); } catch (e) {}
  const m = DB.manga.find(x => x.id === mangaId); if (!m) return;
  const c = m.chapters.find(x => x.id === chapterId); if (!c) return;
  STATE.mangaId = mangaId; STATE.chapterId = chapterId;
  showScreen('reader');
  $('readerMain').hidden = false; $('readerEmpty').hidden = true;
  $('readerCrumbs').innerHTML = crumbs([['Home', 'home'], ['Thư viện', 'library'], [m.title, 'detail:' + m.id], ['Chương ' + fmtNum(c.number)]]);
  $('readerTitle').textContent = chapLabel(c);
  $('readerDate').textContent = `${m.title} · Cập nhật: ${fmtDate(c.created_at)}`;
  renderChapterNav(m, c);
  const viewer = $('viewer');
  viewer.className = 'viewer'; $('viewerWrap').className = 'viewer-wrap'; setHint(null);
  viewer.innerHTML = '<div class="page-placeholder">Đang lật trang… 🍃</div>';
  recordHistory(m, c);
  try {
    localStorage.setItem('komorebi.lastRead', JSON.stringify({ mangaId, chapterId }));
    const read = lastReadOf(mangaId).filter(x => x !== chapterId); read.push(chapterId);
    localStorage.setItem('komorebi.read.' + mangaId, JSON.stringify(read.slice(-500)));
  } catch (e) {}
  const token = ++readerToken;
  try {
    const { data, error } = await sb.from('chapters').select('pages').eq('id', chapterId).single();
    if (error) throw error;
    const urls = await signedUrls(data.pages || []);
    if (token !== readerToken) return;
    renderPages(urls);
  } catch (e) {
    if (token !== readerToken) return;
    viewer.innerHTML = `<div class="page-placeholder">Chưa tải được trang truyện 🥲<br>${esc(e.message || '')}</div>`;
  }
}
function renderChapterNav(m, c) {
  const i = m.chapters.indexOf(c);
  const html = `<button class="btn-nav" data-step="-1" ${i <= 0 ? 'disabled' : ''}>❮ Trước</button>
    <select class="select-chap" aria-label="Chọn chương">${m.chapters.map(x => `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>Chương ${fmtNum(x.number)}</option>`).join('')}</select>
    <button class="btn-nav" data-step="1" ${i >= m.chapters.length - 1 ? 'disabled' : ''}>Sau ❯</button>`;
  $('navTop').innerHTML = html; $('navBottom').innerHTML = html;
}
function stepChapter(d) {
  const m = DB.manga.find(x => x.id === STATE.mangaId); if (!m) return;
  const i = m.chapters.findIndex(x => x.id === STATE.chapterId);
  const n = m.chapters[i + d]; if (n) openChapter(m.id, n.id);
}
['navTop', 'navBottom'].forEach(id => {
  $(id).addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b && !b.disabled) stepChapter(+b.dataset.step); });
  $(id).addEventListener('change', e => { if (e.target.matches('select')) openChapter(STATE.mangaId, e.target.value); });
});

// ===================== UPLOAD =====================
let coverFile = null, uploading = false;
const MAX_PAGES = 500;
const PENDING = { new: null, old: null };   // lần đăng đang dở, để bấm lại thì tải tiếp
const UP = { tab: 'new', mangaId: null, act: 'next', chapId: null, origPaths: [], q: '' };

// ---------- Bộ ảnh trang dùng chung cho 2 tab ----------
const SETS = { new: [], old: [] };   // mỗi phần tử: { kind: 'new', file, url } hoặc { kind: 'old', path, url }
const GRID = { new: 'thumbsNew', old: 'thumbsOld' };
let dragFrom = null;

function addPages(set, files) {
  const list = SETS[set];
  const imgs = files.filter(f => f.type.startsWith('image/')).sort((a, b) => viColl.compare(a.name, b.name));
  let skipped = 0;
  imgs.forEach(f => {
    if (list.length >= MAX_PAGES) { skipped++; return; }
    if (!list.some(p => p.kind === 'new' && p.file.name === f.name && p.file.size === f.size)) list.push({ kind: 'new', file: f, url: URL.createObjectURL(f) });
  });
  if (skipped) showToast(`⚠️ Tối đa ${MAX_PAGES} trang, đã bỏ qua ${skipped} ảnh`);
  renderThumbs(set);
}
function clearSet(set) { SETS[set].forEach(p => p.kind === 'new' && URL.revokeObjectURL(p.url)); SETS[set] = []; renderThumbs(set); if (typeof PENDING !== 'undefined') PENDING[set] = null; }
function movePage(set, from, to) {
  const l = SETS[set]; if (to < 0 || to >= l.length || from === to) return;
  const [it] = l.splice(from, 1); l.splice(to, 0, it); renderThumbs(set);
}
function renderThumbs(set) {
  const l = SETS[set], grid = $(GRID[set]);
  const head = document.querySelector(`[data-head="${set}"]`);
  const nNew = l.filter(p => p.kind === 'new').length;
  head.innerHTML = l.length ? `<span>Xem trước thứ tự trang <small>— kéo thả hoặc bấm ◀ ▶ để sắp xếp</small></span><small>${l.length} trang${set === 'old' && nNew && nNew < l.length ? ` · ${nNew} ảnh mới` : ''}</small>` : '';
  grid.innerHTML = l.map((p, i) => `<div class="thumb${p.kind === 'new' && set === 'old' && UP.act === 'edit' ? ' is-new' : ''}${p.busy ? ' is-busy' : ''}${p.err ? ' is-fail' : ''}${p.done ? ' is-done' : ''}" draggable="true" data-i="${i}" ${p.err ? `title="${esc(p.err)}"` : ''}>
      <img src="${esc(p.url)}" alt="Trang ${i + 1}" loading="lazy">
      <span class="t-num">${i + 1}</span>
      ${p.kind === 'new' && set === 'old' && UP.act === 'edit' ? '<span class="t-new">mới</span>' : ''}
      ${p.busy ? '<span class="t-state">⏳</span>' : p.err ? '<span class="t-state fail">!</span>' : p.done ? '<span class="t-state ok">✓</span>' : ''}
      <button type="button" class="t-del" data-del="${i}" aria-label="Bỏ trang ${i + 1}">✕</button>
      <div class="t-move"><button type="button" data-mv="-1" data-i="${i}" aria-label="Lùi trang ${i + 1}" ${i === 0 ? 'disabled' : ''}>◀</button><button type="button" data-mv="1" data-i="${i}" aria-label="Tiến trang ${i + 1}" ${i === l.length - 1 ? 'disabled' : ''}>▶</button></div>
    </div>`).join('') + (l.length ? `<label class="thumb-add" title="Thêm ảnh">＋<input type="file" accept="image/*" multiple data-set="${set}" onchange="handlePagesSelect(event)" aria-label="Thêm ảnh"></label>` : '');
}
function updateThumb(set, p) {
  const i = SETS[set].indexOf(p), el = $(GRID[set]).children[i]; if (!el || !el.classList.contains('thumb')) return;
  el.classList.toggle('is-busy', !!p.busy); el.classList.toggle('is-fail', !!p.err); el.classList.toggle('is-done', !!p.done);
  if (p.err) el.title = p.err; else el.removeAttribute('title');
  let st = el.querySelector('.t-state');
  const html = p.busy ? ['', '⏳'] : p.err ? ['fail', '!'] : p.done ? ['ok', '✓'] : null;
  if (!html) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement('span'); el.appendChild(st); }
  st.className = 't-state ' + html[0]; st.textContent = html[1];
}
Object.entries(GRID).forEach(([set, id]) => {
  const g = $(id);
  g.addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d) { if (uploading) { showToast('⏳ Đợi tải xong rồi hẵng bỏ trang nhé'); return; } const [it] = SETS[set].splice(+d.dataset.del, 1); if (it.kind === 'new') { URL.revokeObjectURL(it.url); if (it.done) sb.storage.from(BUCKET).remove([it.done]).catch(() => {}); } renderThumbs(set); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) { const i = +mv.dataset.i; movePage(set, i, i + +mv.dataset.mv); }
  });
  g.addEventListener('dragstart', e => { const t = e.target.closest('.thumb'); if (!t) return; dragFrom = { set, i: +t.dataset.i }; t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page'); });
  g.addEventListener('dragend', () => { g.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); dragFrom = null; });
  g.addEventListener('dragover', e => {
    const t = e.target.closest('.thumb');
    if (dragFrom && dragFrom.set === set && t) { e.preventDefault(); g.querySelectorAll('.over').forEach(x => x !== t && x.classList.remove('over')); t.classList.add('over'); }
    else if (!dragFrom && e.dataTransfer.types.includes('Files')) e.preventDefault();
  });
  g.addEventListener('drop', e => {
    e.preventDefault();
    const t = e.target.closest('.thumb');
    if (dragFrom && dragFrom.set === set && t) movePage(set, dragFrom.i, +t.dataset.i);
    else if (!dragFrom && e.dataTransfer.files.length) addPages(set, [...e.dataTransfer.files]);
  });
});
function handlePagesSelect(e) { addPages(e.target.dataset.set, [...e.target.files]); e.target.value = ''; }
function handlePagesDrop(e, el) { e.preventDefault(); handleDragLeave(el); addPages(el.dataset.set, [...e.dataTransfer.files]); }
function handleDragOver(e, el) { e.preventDefault(); el.classList.add('dragover'); }
function handleDragLeave(el) { el.classList.remove('dragover'); }

// ---------- Ảnh & tải lên ----------
const UPLOAD_CONC = 4, PAGE_W = 1600;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WEBP_OK = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').startsWith('data:image/webp'); } catch (e) { return false; } })();
function decodeImage(file) {
  if (window.createImageBitmap) return createImageBitmap(file).catch(() => decodeLegacy(file));
  return decodeLegacy(file);
}
function decodeLegacy(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`Không đọc được ảnh “${file.name}”${/heic|heif/i.test(file.type + file.name) ? ' (ảnh HEIC của iPhone, hãy đổi sang JPG trước nhé)' : ''}`)); };
    img.src = url;
  });
}
// Trả về { blob, type, ext }: ảnh đã gọn thì giữ nguyên, còn lại thu nhỏ + nén WebP (hoặc JPEG)
async function prepImage(file, maxW, q, force) {
  const bmp = await decodeImage(file);
  const w0 = bmp.width, h0 = bmp.height;
  if (!force && w0 <= maxW && file.size < 600 * 1024 && /image\/(jpeg|webp)/.test(file.type)) {
    if (bmp.close) bmp.close();
    return { blob: file, type: file.type, ext: file.type === 'image/webp' ? 'webp' : 'jpg' };
  }
  const sc = Math.min(1, maxW / w0), w = Math.max(1, Math.round(w0 * sc)), h = Math.max(1, Math.round(h0 * sc));
  const type = force || (WEBP_OK ? 'image/webp' : 'image/jpeg');
  let blob;
  if (window.OffscreenCanvas) {
    const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(bmp, 0, 0, w, h);
    blob = await c.convertToBlob({ type, quality: q });
  } else {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(bmp, 0, 0, w, h);
    blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Không nén được ảnh ' + file.name)), type, q));
  }
  if (bmp.close) bmp.close();
  if (!force && blob.type && blob.type !== type) return prepImage(file, maxW, q, 'image/jpeg');   // trình duyệt không nén được WebP
  if (!force && blob.size > file.size && sc === 1 && /image\/(jpeg|webp)/.test(file.type)) return { blob: file, type: file.type, ext: file.type === 'image/webp' ? 'webp' : 'jpg' };
  return { blob, type: blob.type || type, ext: (blob.type || type) === 'image/webp' ? 'webp' : 'jpg' };
}
async function toJpeg(file, maxW, q) { return (await prepImage(file, maxW, q, 'image/jpeg')).blob; }
function withTimeout(promise, ms) {
  let t; return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Mạng chậm quá, quá thời gian chờ')), ms); })]).finally(() => clearTimeout(t));
}
async function putFile(path, blob, type) {
  let last;
  for (let a = 0; a < 4; a++) {
    try {
      const { error } = await withTimeout(sb.storage.from(BUCKET).upload(path, blob, { contentType: type || blob.type || 'image/jpeg', upsert: true, cacheControl: '31536000' }), 120000);
      if (!error) return;
      last = error;
      if (/row-level|bucket not found|payload too large|maximum allowed|exceeded|not allowed/i.test(error.message || '')) break;   // lỗi cấu hình: thử lại cũng vô ích
    } catch (e) { last = e; }
    if (a < 3) await sleep(700 * 2 ** a + Math.random() * 400);
  }
  throw last;
}
// Giữ màn hình sáng khi đang tải (điện thoại tắt màn hình là mất kết nối)
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (uploading && document.visibilityState === 'visible') keepAwake(true); });
window.addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const fmtEta = s => s < 60 ? `${Math.max(1, Math.round(s))} giây` : `${Math.round(s / 60)} phút`;
const rand = () => Math.random().toString(36).slice(2, 8);
function setProgress(id, pct, text) {
  const box = $(id); box.classList.add('show');
  box.querySelector('.progress-bar-fill').style.width = Math.round(pct) + '%';
  box.querySelector('.progress-label').textContent = text;
}
function hideProgress(id) { setTimeout(() => { $(id).classList.remove('show'); $(id).querySelector('.progress-bar-fill').style.width = '0%'; }, 700); }
function friendlyError(e) {
  const m = String(e && e.message || e || '');
  if (/bucket not found/i.test(m)) return 'Chưa có kho ảnh “komorebi” trên Supabase. Chạy file schema-komorebi.sql nhé.';
  if (/row-level security|violates|unauthorized|not allowed/i.test(m)) return 'Supabase chưa cho phép lưu. Chạy lại file schema-komorebi.sql để tạo quyền nhé.';
  if (/relation|does not exist|schema cache/i.test(m)) return 'Chưa tạo bảng trên Supabase. Chạy file schema-komorebi.sql nhé.';
  if (/payload too large|maximum allowed size|exceeded/i.test(m)) return 'Có ảnh quá nặng, thử ảnh nhỏ hơn nhé.';
  if (/failed to fetch|networkerror|load failed|network/i.test(m)) return 'Mất kết nối mạng giữa chừng.';
  if (/jwt|token.*expired/i.test(m)) return 'Phiên đăng nhập hết hạn, tải lại trang rồi đăng nhập lại nhé.';
  return m || 'Lỗi không rõ';
}
// Tải ảnh của một chương; trả về mảng đường dẫn theo đúng thứ tự trong bộ ảnh
async function uploadSet(set, mangaId, chapId, progId, base, span) {
  const list = SETS[set], fresh = list.filter(p => p.kind === 'new');
  const total = fresh.length; let done = fresh.filter(p => p.done).length, bytes = 0;
  const todo = fresh.filter(p => !p.done); todo.forEach(p => { p.err = null; p.busy = false; });
  const t0 = Date.now(); let next = 0;
  const tick = () => {
    const sec = (Date.now() - t0) / 1000, rate = bytes / Math.max(sec, .5), left = todo.length - (done - (total - todo.length));
    const per = (Date.now() - t0) / Math.max(1, done - (total - todo.length));
    setProgress(progId, base + span * done / Math.max(1, total),
      `Đang tải ${done}/${total} ảnh · ${UPLOAD_CONC} ảnh cùng lúc${bytes ? ` · ${fmtBytes(rate)}/s` : ''}${left > 0 && done > total - todo.length ? ` · còn khoảng ${fmtEta(per * left / UPLOAD_CONC / 1000 * UPLOAD_CONC)}` : ''}`);
  };
  tick();
  async function worker() {
    while (next < todo.length) {
      const p = todo[next++]; p.busy = true; updateThumb(set, p);
      try {
        const img = await prepImage(p.file, PAGE_W, .82);
        const path = `${DB.uid}/${mangaId}/${chapId}/${Date.now()}-${rand()}.${img.ext}`;
        await putFile(path, img.blob, img.type);
        p.done = path; bytes += img.blob.size; done++;
      } catch (e) { p.err = friendlyError(e); console.warn('page', p.file.name, e); }
      p.busy = false; updateThumb(set, p); tick();
    }
  }
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONC, todo.length) }, worker));
  const failed = fresh.filter(p => !p.done);
  if (failed.length) {
    const err = new Error(`${failed.length}/${total} ảnh chưa tải được (${failed[0].err || 'lỗi mạng'}). Bấm đăng tải lại để thử tiếp, ${done} ảnh đã xong sẽ không phải tải lại.`);
    err.partial = true; throw err;
  }
  return list.map(p => p.kind === 'old' ? p.path : p.done);
}
const parseNum = v => parseFloat(String(v).replace(',', '.'));

// ---------- Chuyển tab & điều hướng ----------
function switchTab(tab) {
  UP.tab = tab;
  document.querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('paneNew').hidden = tab !== 'new'; $('paneOld').hidden = tab !== 'old';
  if (tab === 'old') renderPickList();
}
document.querySelectorAll('.seg-btn[data-tab]').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
function goUpload() {
  closeDrawer();
  if (!canUpload()) { showToast('🔒 Tài khoản này chỉ có quyền đọc truyện'); return; }
  if (PAGE === 'upload') { showScreen('upload'); switchTab('new'); return; }
  location.href = pageHref('upload', { tab: 'new' });
}
function goUploadExisting(mangaId, act) {
  closeDrawer();
  if (!canUpload()) { showToast('🔒 Tài khoản này chỉ có quyền đọc truyện'); return; }
  if (PAGE === 'upload') {
    showScreen('upload'); switchTab('old');
    selectManga(mangaId); setAct(act || 'next');
    return;
  }
  location.href = pageHref('upload', { tab: 'old', manga: mangaId, act: act || 'next' });
}

// ---------- Tab 1: tạo truyện mới ----------
const upStatus = makeDrop($('upStatus'), { multi: false, label: 'Tiến độ', allText: 'Chọn tiến độ', value: ['dang'] });
upStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
const upGenres = makeDrop($('upGenres'), { label: 'Thể loại', allText: 'Chọn thể loại', onChange: renderChosen });
upGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
function renderChosen() { $('upChosen').innerHTML = upGenres.getValue().map(g => `<span class="m-tag">${esc(g)}</span>`).join(''); }
function setStatus(id) { upStatus.setValue([id]); }
const getStatus = () => upStatus.getValue()[0] || (STATUSES[0] && STATUSES[0].id) || 'dang';
const getGenres = () => upGenres.getValue();
function setGenres(list) { upGenres.setValue(list); renderChosen(); }
function fillTitleList() { if (UP.tab === 'old') renderPickList(); checkExisting(); }

function findExisting(title) { const k = titleKey(title); return k ? DB.manga.find(m => m.title_key === k) : null; }
function checkExisting() {
  const m = findExisting($('title').value), note = $('existingNote');
  if (m && PENDING.new && PENDING.new.inserted && PENDING.new.mangaId === m.id) {
    note.innerHTML = `⏳ Lần đăng <b>${esc(m.title)}</b> trước bị gián đoạn. Bấm “Đăng tải ngay” để tải tiếp các ảnh còn thiếu.`;
    note.classList.add('show'); $('submitNew').disabled = false; return;
  }
  if (m) {
    note.innerHTML = `📚 <b>${esc(m.title)}</b> đã có trên kệ rồi (${m.chapters.length} chương).<br><button type="button" class="link-btn" id="jumpOld">Thêm chương vào truyện này ở tab “Truyện đã có” ❯</button>`;
    note.classList.add('show');
    $('jumpOld').onclick = () => goUploadExisting(m.id, 'next');
  } else note.classList.remove('show');
  $('submitNew').disabled = !!m;
}
$('title').addEventListener('input', checkExisting);

function handleCoverSelect(e) { if (e.target.files[0]) { coverFile = e.target.files[0]; showCoverPreview(URL.createObjectURL(coverFile)); } }
function handleCoverDrop(e) {
  e.preventDefault(); handleDragLeave($('coverDropzone'));
  const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (f) { coverFile = f; showCoverPreview(URL.createObjectURL(f)); }
}
function showCoverPreview(src) {
  const prev = $('coverPreview');
  prev.src = src || ''; prev.style.display = src ? 'block' : 'none';
  $('coverIcon').style.display = src ? 'none' : ''; $('coverText').style.display = src ? 'none' : '';
}
function resetNewForm() {
  ['title', 'author', 'translator', 'release', 'desc', 'chapNum', 'chapTitle'].forEach(id => $(id).value = '');
  setStatus('dang'); setGenres([]); coverFile = null; showCoverPreview(null); clearSet('new'); checkExisting();
}

async function publishNew() {
  if (uploading) return;
  const title = $('title').value.trim().replace(/\s+/g, ' ');
  if (!title) { showToast('⚠️ Nhập tên truyện trước nhé'); $('title').focus(); return; }
  if (findExisting(title) && !(PENDING.new && PENDING.new.inserted)) { checkExisting(); return; }
  if (!$('author').value.trim()) { showToast('⚠️ Nhập tên tác giả nhé'); $('author').focus(); return; }
  const num = parseNum($('chapNum').value);
  if (!isFinite(num) || num < 0) { showToast('⚠️ Nhập số chương nhé'); $('chapNum').focus(); return; }
  if (!SETS.new.length) { showToast('⚠️ Chưa chọn trang truyện nào'); return; }
  const ct = $('chapTitle').value.trim() || null;
  uploading = true; $('submitNew').disabled = true; keepAwake(true);
  try {
    if (!PENDING.new) PENDING.new = { mangaId: crypto.randomUUID(), chapId: crypto.randomUUID(), coverFile: null, coverPath: null, inserted: false };
    const P = PENDING.new;
    if (coverFile && P.coverFile !== coverFile) {
      setProgress('progNew', 4, 'Đang lưu ảnh bìa…');
      const path = `${DB.uid}/${P.mangaId}/cover-${Date.now()}.jpg`;
      await putFile(path, await toJpeg(coverFile, 700, .86), 'image/jpeg');
      if (P.coverPath) sb.storage.from(BUCKET).remove([P.coverPath]).catch(() => {});
      P.coverPath = path; P.coverFile = coverFile;
    } else if (!coverFile && P.coverPath) { sb.storage.from(BUCKET).remove([P.coverPath]).catch(() => {}); P.coverPath = null; P.coverFile = null; }
    const paths = await uploadSet('new', P.mangaId, P.chapId, 'progNew', 10, 84);
    setProgress('progNew', 95, '👀 Ảnh đã tải xong, kiểm tra thứ tự trang nhé');
    uploading = false; keepAwake(false);
    const ok = await confirmPreview({ heading: title, chapter: `Chương ${fmtNum(num)}${ct ? ': ' + ct : ''}`, set: 'new', cover: coverFile ? $('coverPreview').src : null });
    if (!ok) {
      setProgress('progNew', 95, '↩ Chưa đăng. Sắp xếp lại rồi bấm “Đăng tải ngay”, ảnh đã tải xong sẽ không phải tải lại.');
      showToast('↩ Sắp xếp lại thứ tự rồi bấm đăng tải nhé'); return;
    }
    uploading = true;
    setProgress('progNew', 98, 'Đang đăng truyện lên kệ…');
    if (!P.inserted) {
      const row = { id: P.mangaId, title, title_key: titleKey(title), author: $('author').value.trim(), translator: $('translator').value.trim() || null,
        release_date: $('release').value || null, status: getStatus(), genres: getGenres(), description: $('desc').value.trim() || null, cover_path: P.coverPath };
      const { error } = await sb.from('manga').insert(row);
      if (error) { if (error.code === '23505') throw new Error('Truyện này đã có trên kệ, dùng tab “Truyện đã có” nhé'); throw error; }
      P.inserted = true;
    }
    const ins = await sb.from('chapters').insert({ id: P.chapId, manga_id: P.mangaId, number: num, title: ct, pages: paths });
    if (ins.error) throw ins.error;
    setProgress('progNew', 100, '✅ Đăng tải thành công!');
    showToast('🎉 Đã thêm truyện mới vào thư viện!');
    const id = P.mangaId;
    PENDING.new = null; resetNewForm(); hideProgress('progNew');
    await loadLibrary(); resetUploadScreen(); openDetail(id);
  } catch (e) {
    console.warn('publishNew', e);
    setProgress('progNew', e.partial ? parseFloat($('progNew').querySelector('.progress-bar-fill').style.width) || 0 : 0, '❌ ' + friendlyError(e));
    showToast(e.partial ? '⏳ Còn vài ảnh chưa tải được, bấm đăng tải lại để tiếp tục' : '🥲 Chưa đăng tải được: ' + friendlyError(e));
    if (PENDING.new && PENDING.new.inserted) loadLibrary();
  } finally { uploading = false; keepAwake(false); $('submitNew').disabled = false; checkExisting(); }
}

// ---------- Tab 2: truyện đã có ----------
const relTime = d => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return days <= 0 ? 'hôm nay' : days === 1 ? 'hôm qua' : days < 30 ? `${days} ngày trước` : fmtDate(d);
};
function renderPickList() {
  const q = fold(UP.q.trim());
  const list = DB.manga.filter(m => !q || fold(m.title + ' ' + (m.author || '')).includes(q));
  const box = $('pickList');
  if (!DB.loaded) { box.innerHTML = '<p class="pick-none">Đang mở kệ sách… 🍃</p>'; return; }
  if (!DB.manga.length) { box.innerHTML = '<div class="pick-none">Kệ còn trống.<br><button type="button" class="btn-submit secondary" onclick="switchTab(\'new\')">✨ Tạo truyện đầu tiên</button></div>'; return; }
  if (!list.length) { box.innerHTML = '<p class="pick-none">Không có truyện nào khớp 🍃</p>'; return; }
  box.innerHTML = list.map(m => {
    const st = statusOf(m.status), last = m.chapters[m.chapters.length - 1];
    return `<button type="button" class="pick-item" role="option" data-id="${m.id}" aria-selected="${m.id === UP.mangaId}">
      ${coverHTML(m, true)}
      <span style="min-width:0"><span class="pick-name">${highlight(m.title, UP.q)}</span>
      <span class="pick-meta">${last ? 'Ch.' + fmtNum(last.number) : 'Chưa có chương'} · <span class="status ${st.cls}">${esc(st.name)}</span></span></span>
    </button>`;
  }).join('');
}
$('pickSearch').addEventListener('input', e => { UP.q = e.target.value; renderPickList(); });
$('pickList').addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  selectManga(b.dataset.id);
  if (matchMedia('(max-width: 860px)').matches) $('oldRight').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
const curManga = () => DB.manga.find(m => m.id === UP.mangaId);
const nextNum = m => { const last = m.chapters[m.chapters.length - 1]; return last ? Math.floor(+last.number) + 1 : 1; };

function selectManga(id) {
  if (UP.mangaId !== id) { clearSet('old'); UP.chapId = null; UP.origPaths = []; }
  UP.mangaId = id;
  const m = curManga(); if (!m) return;
  renderPickList();
  $('oldEmpty').hidden = true; $('oldFlow').hidden = false;
  const last = m.chapters[m.chapters.length - 1];
  $('pickedInfo').innerHTML = `${coverHTML(m, true)}<span><b>${esc(m.title)}</b><small>${esc(m.author || 'Chưa rõ tác giả')} · ${m.chapters.length} chương</small></span><button type="button" class="link-btn" onclick="openDetail('${m.id}')">Xem truyện</button>`;
  $('actNextHint').textContent = last ? `Tự điền số chương ${fmtNum(nextNum(m))}, tiếp nối Ch.${fmtNum(last.number)}` : 'Truyện chưa có chương nào, bắt đầu từ chương 1';
  document.querySelector('.act-card[data-act="edit"]').disabled = !m.chapters.length;
  setAct(UP.act === 'info' ? 'info' : (UP.act === 'edit' && m.chapters.length ? 'edit' : 'next'), true);
}
function setAct(act, keep) {
  const m = curManga(); if (!m) return;
  if (act === 'edit' && !m.chapters.length) act = 'next';
  const changed = UP.act !== act; UP.act = act;
  document.querySelectorAll('.act-card').forEach(b => b.setAttribute('aria-pressed', b.dataset.act === act));
  $('chapPicker').hidden = act !== 'edit';
  $('infoForm').hidden = act !== 'info';
  $('delChap').hidden = !(act === 'edit' && UP.chapId);
  if (act === 'info') { $('step3').hidden = true; if (changed || !keep) fillInfoForm(); return; }
  if (act === 'next') {
    if (changed || !keep) { clearSet('old'); UP.chapId = null; UP.origPaths = []; }
    $('oldNum').value = fmtNum(nextNum(m)).replace(',', '.');
    if (changed || !keep) $('oldTitle').value = '';
    $('step3').hidden = false; $('step3Title').textContent = 'Upload ảnh chương mới';
    $('submitOld').innerHTML = '🚀 Xuất bản ngay';
  } else {
    if (changed) { clearSet('old'); UP.chapId = null; UP.origPaths = []; }
    renderChapPick();
    $('step3').hidden = !UP.chapId; $('step3Title').textContent = 'Sửa ảnh chương';
    $('submitOld').innerHTML = '💾 Lưu thay đổi';
  }
  renderThumbs('old');
}
document.querySelectorAll('.act-card').forEach(b => b.addEventListener('click', () => setAct(b.dataset.act)));
function renderChapPick() {
  const m = curManga();
  $('chapPick').innerHTML = m.chapters.slice().reverse().map(c => `<button type="button" class="cp-item" data-ch="${c.id}" aria-pressed="${c.id === UP.chapId}">
      <span class="cp-num">Ch.${fmtNum(c.number)}</span><span class="cp-name">${esc(c.title || '—')}</span><span class="cp-date">${relTime(c.created_at)}</span></button>`).join('');
}
$('chapPick').addEventListener('click', async e => {
  const b = e.target.closest('[data-ch]'); if (!b) return;
  const m = curManga(), c = m.chapters.find(x => x.id === b.dataset.ch); if (!c) return;
  UP.chapId = c.id; renderChapPick(); $('delChap').hidden = false;
  $('oldNum').value = String(+c.number); $('oldTitle').value = c.title || '';
  $('step3').hidden = false;
  clearSet('old');
  $('thumbsOld').innerHTML = '<p class="pick-none" style="grid-column:1/-1">Đang lấy ảnh của chương… 🍃</p>';
  try {
    const { data, error } = await sb.from('chapters').select('pages').eq('id', c.id).single();
    if (error) throw error;
    const paths = data.pages || [], urls = await signedUrls(paths);
    if (UP.chapId !== c.id) return;
    UP.origPaths = paths.slice();
    SETS.old = paths.map((p, i) => ({ kind: 'old', path: p, url: urls[i] }));
    renderThumbs('old');
    $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { $('thumbsOld').innerHTML = `<p class="pick-none" style="grid-column:1/-1">Chưa lấy được ảnh 🥲 ${esc(err.message || '')}</p>`; }
});

async function publishOld() {
  if (uploading) return;
  const m = curManga(); if (!m) { showToast('⚠️ Chọn truyện trước nhé'); return; }
  const num = parseNum($('oldNum').value);
  if (!isFinite(num) || num < 0) { showToast('⚠️ Nhập số chương nhé'); $('oldNum').focus(); return; }
  const editing = UP.act === 'edit';
  if (editing && !UP.chapId) { showToast('⚠️ Chọn chương cần sửa nhé'); return; }
  if (m.chapters.some(c => +c.number === num && c.id !== (editing ? UP.chapId : null))) { showToast(`⚠️ Chương ${fmtNum(num)} đã có rồi`); $('oldNum').focus(); return; }
  if (!SETS.old.length) { showToast(editing ? '⚠️ Chương cần ít nhất một trang' : '⚠️ Chưa chọn trang truyện nào'); return; }
  uploading = true; $('submitOld').disabled = true; keepAwake(true);
  const title = $('oldTitle').value.trim() || null;
  try {
    if (!editing && !(PENDING.old && PENDING.old.mangaId === m.id)) PENDING.old = { mangaId: m.id, chapId: crypto.randomUUID() };
    const chapId = editing ? UP.chapId : PENDING.old.chapId;
    setProgress('progOld', 3, 'Đang chuẩn bị…');
    const paths = await uploadSet('old', m.id, chapId, 'progOld', 5, 85);
    setProgress('progOld', 95, '👀 Ảnh đã tải xong, kiểm tra thứ tự trang nhé');
    uploading = false; keepAwake(false);
    const ok = await confirmPreview({ heading: m.title, chapter: `Chương ${fmtNum(num)}${title ? ': ' + title : ''}`, set: 'old', editing, cover: coverUrl(m) || null });
    if (!ok) {
      setProgress('progOld', 95, '↩ Chưa lưu. Sắp xếp lại rồi bấm lại, ảnh đã tải xong sẽ không phải tải lại.');
      showToast('↩ Sắp xếp lại thứ tự rồi bấm lại nhé'); return;
    }
    uploading = true;
    setProgress('progOld', 98, editing ? 'Đang lưu chương…' : 'Đang đăng chương…');
    if (editing) {
      const { error } = await sb.from('chapters').update({ number: num, title, pages: paths }).eq('id', chapId);
      if (error) throw error;
      const removed = UP.origPaths.filter(p => !paths.includes(p));
      if (removed.length) { try { await sb.storage.from(BUCKET).remove(removed); } catch (e) { console.warn('cleanup', e); } }
    } else {
      const { error } = await sb.from('chapters').insert({ id: chapId, manga_id: m.id, number: num, title, pages: paths });
      if (error) { if (error.code === '23505') throw new Error(`Chương ${fmtNum(num)} đã có rồi`); throw error; }
    }
    await sb.from('manga').update({ updated_at: new Date().toISOString() }).eq('id', m.id);
    setProgress('progOld', 100, editing ? '✅ Đã lưu thay đổi!' : '✅ Đã xuất bản chương mới!');
    showToast(editing ? `💾 Đã cập nhật chương ${fmtNum(num)}` : `🎉 Đã thêm chương ${fmtNum(num)}!`);
    hideProgress('progOld');
    PENDING.old = null; clearSet('old'); UP.chapId = null; UP.origPaths = [];
    await loadLibrary(); resetUploadScreen();
    openChapter(m.id, chapId);
  } catch (e) {
    console.warn('publishOld', e);
    setProgress('progOld', e.partial ? parseFloat($('progOld').querySelector('.progress-bar-fill').style.width) || 0 : 0, '❌ ' + friendlyError(e));
    showToast(e.partial ? '⏳ Còn vài ảnh chưa tải được, bấm lại để tải tiếp' : '🥲 Chưa lưu được: ' + friendlyError(e));
  } finally { uploading = false; keepAwake(false); $('submitOld').disabled = false; }
}

// ===================== PHÂN QUYỀN =====================
async function loadRole() {
  try {
    const { data, error } = await sb.from('user_roles').select('role').eq('user_id', DB.uid).maybeSingle();
    if (error) throw error;
    ME.role = (data && data.role) || 'reader';
  } catch (e) {
    console.warn('role', e);
    ME.role = /relation|does not exist|schema cache/i.test(e.message || '') ? 'uploader' : 'reader';   // chưa chạy SQL phân quyền thì giữ như cũ
  }
  applyRole();
}
const canUpload = () => ME.role === 'uploader';
function applyRole() {
  document.body.classList.toggle('role-reader', !canUpload());
  if (!canUpload() && (PAGE === 'upload' || PAGE === 'master')) { location.replace(pageHref('home')); return; }
  if (STATE.screen === 'profile') renderProfile();
}

// ===================== ĐỔI MẬT KHẨU =====================
function togglePassForm(on) {
  $('pfPassForm').hidden = !on; $('pfPassErr').textContent = '';
  ['pfOldPass', 'pfNewPass', 'pfNewPass2'].forEach(id => $(id).value = '');
  if (on) setTimeout(() => $('pfOldPass').focus(), 50);
}
$('pfPassBtn').addEventListener('click', () => togglePassForm($('pfPassForm').hidden));
$('pfPassCancel').addEventListener('click', () => togglePassForm(false));
$('pfPassForm').addEventListener('submit', async e => {
  e.preventDefault();
  const cur = $('pfOldPass').value, nw = $('pfNewPass').value, nw2 = $('pfNewPass2').value, err = $('pfPassErr');
  if (nw.length < 6) { err.textContent = 'Mật khẩu mới cần ít nhất 6 ký tự.'; return; }
  if (nw !== nw2) { err.textContent = 'Hai lần nhập mật khẩu mới chưa khớp.'; return; }
  if (nw === cur) { err.textContent = 'Mật khẩu mới phải khác mật khẩu hiện tại.'; return; }
  const btn = $('pfPassSave'); btn.disabled = true; err.textContent = '';
  try {
    const chk = await sb.auth.signInWithPassword({ email: ME.email, password: cur });
    if (chk.error) { err.textContent = 'Mật khẩu hiện tại chưa đúng.'; return; }
    const { error } = await sb.auth.updateUser({ password: nw });
    if (error) { err.textContent = /same/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ.' : /weak|short|least/i.test(error.message) ? 'Mật khẩu mới yếu quá, thử dài hơn nhé.' : 'Chưa đổi được: ' + error.message; return; }
    togglePassForm(false); showToast('🔑 Đã đổi mật khẩu, lần sau đăng nhập bằng mật khẩu mới nhé');
  } finally { btn.disabled = false; }
});

// ===================== XEM TRƯỚC TRƯỚC KHI ĐĂNG =====================
let pvMode = 'grid';
function confirmPreview({ heading, chapter, set, editing, cover }) {
  return new Promise(res => {
    const d = $('pvDlg'), list = SETS[set];
    $('pvTitle').textContent = heading;
    $('pvSub').textContent = `${chapter} · ${list.length} trang`;
    $('pvCover').hidden = !cover; if (cover) $('pvCover').src = cover;
    $('pvOk').textContent = editing ? '💾 Xác nhận lưu' : '🚀 Xác nhận đăng';
    const draw = () => {
      $('pvBody').innerHTML = `<div class="${pvMode === 'grid' ? 'pv-grid' : 'pv-strip'}">${list.map((p, i) => `<figure class="pv-page"><img src="${esc(p.url)}" alt="Trang ${i + 1}" loading="lazy"><figcaption>${i + 1}</figcaption></figure>`).join('')}</div>`;
      document.querySelectorAll('[data-pv]').forEach(b => b.setAttribute('aria-selected', b.dataset.pv === pvMode));
    };
    draw();
    const done = v => { d.close(); $('pvOk').onclick = $('pvBack').onclick = $('pvX').onclick = d.oncancel = null; res(v); };
    $('pvOk').onclick = () => done(true);
    $('pvBack').onclick = $('pvX').onclick = () => done(false);
    d.oncancel = e => { e.preventDefault(); done(false); };
    document.querySelectorAll('[data-pv]').forEach(b => b.onclick = () => { pvMode = b.dataset.pv; draw(); $('pvBody').scrollTop = 0; });
    d.showModal(); $('pvBody').scrollTop = 0; $('pvOk').focus();
  });
}
function resetUploadScreen() {
  UP.mangaId = null; UP.act = 'next'; UP.chapId = null; UP.origPaths = []; UP.q = '';
  clearSet('old'); $('pickSearch').value = ''; $('oldNum').value = ''; $('oldTitle').value = '';
  $('oldFlow').hidden = true; $('oldEmpty').hidden = false;
  renderPickList(); switchTab('new');
}

// ===================== DANH MỤC (thể loại & tiến độ) =====================
const TONES = [['green', 'Xanh lá'], ['blue', 'Xanh dương'], ['purple', 'Tím'], ['yellow', 'Vàng'], ['pink', 'Hồng'], ['gray', 'Xám']];
const DEFAULT_STATUSES = [['dang', 'Đang ra', 'green'], ['xong', 'Hoàn thành', 'blue'], ['ss1', 'Hết season 1', 'purple'], ['ss2', 'Hết season 2', 'purple'], ['dung', 'Tạm dừng', 'yellow'], ['drop', 'Drop', 'pink']];
const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mystery', 'Romance', 'Sci-fi', 'Slice of life', 'Thriller'];
const MASTER = { genres: [], statuses: [], edit: null };

async function loadMaster() {
  const fetchBoth = () => Promise.all([
    sb.from('genres').select('id,name,sort').order('sort', { ascending: true }),
    sb.from('statuses').select('id,code,name,tone,sort').order('sort', { ascending: true })
  ]);
  let [g, st] = await fetchBoth();
  if (g.error) throw g.error; if (st.error) throw st.error;
  if (!st.data.length && !canUpload()) {   // tài khoản chỉ đọc: dùng danh mục mặc định, không ghi gì
    MASTER.statuses = DEFAULT_STATUSES.map(([code, name, tone], i) => ({ id: 'd' + i, code, name, tone, sort: i }));
    MASTER.genres = (g.data.length ? g.data : DEFAULT_GENRES.map((name, i) => ({ id: 'g' + i, name, sort: i })));
    applyMaster(); return;
  }
  if (!st.data.length) {   // lần đầu: tạo sẵn danh mục mặc định
    const a = await sb.from('statuses').insert(DEFAULT_STATUSES.map(([code, name, tone], i) => ({ code, name, tone, sort: i })));
    if (a.error) throw a.error;
    if (!g.data.length) { const b = await sb.from('genres').insert(DEFAULT_GENRES.map((name, i) => ({ name, sort: i }))); if (b.error) throw b.error; }
    [g, st] = await fetchBoth();
    if (g.error) throw g.error; if (st.error) throw st.error;
  }
  MASTER.genres = g.data.slice().sort((a, b) => a.sort - b.sort);
  MASTER.statuses = st.data.slice().sort((a, b) => a.sort - b.sort);
  applyMaster();
}
function applyMaster() {
  STATUSES = MASTER.statuses.map(r => ({ id: r.code, name: r.name, tone: r.tone, cls: 'tone-' + (r.tone || 'gray') }));
  GENRES = MASTER.genres.map(r => r.name);
  if (typeof upStatus !== 'undefined') {
    const keepS = upStatus.getValue()[0];
    upStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
    upStatus.setValue([STATUSES.some(s => s.id === keepS) ? keepS : (STATUSES[0] && STATUSES[0].id)]);
    upGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
    upGenres.setValue(upGenres.getValue().filter(g => GENRES.includes(g))); renderChosen();
    eStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
    eGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
  }
  if (STATE.screen === 'master') renderMaster();
}
const usageGenre = name => DB.manga.filter(m => (m.genres || []).includes(name)).length;
const usageStatus = code => DB.manga.filter(m => m.status === code).length;
const sameName = (a, b) => titleKey(a) === titleKey(b);

function toneButtons(sel) {
  return TONES.map(([k, label]) => `<button type="button" class="tone-dot tone-${k}" data-tone="${k}" aria-pressed="${k === sel}" title="${label}" aria-label="Màu ${label}"></button>`).join('');
}
let newTone = 'green';
function renderMaster() {
  $('msGenreCount').textContent = `${MASTER.genres.length} mục`;
  $('msStatusCount').textContent = `${MASTER.statuses.length} mục`;
  $('msStatusTone').innerHTML = toneButtons(newTone);
  const gl = MASTER.genres, sl = MASTER.statuses, ed = MASTER.edit;
  $('msGenres').innerHTML = gl.length ? gl.map((r, i) => {
    const n = usageGenre(r.name);
    if (ed && ed.kind === 'genre' && ed.id === r.id) return `<li class="ms-row editing" data-id="${r.id}">
        <input class="ms-edit-input" id="msEditInput" value="${esc(r.name)}" maxlength="40" aria-label="Tên thể loại">
        <button type="button" class="btn-submit primary mini" data-save>Lưu</button><button type="button" class="btn-submit secondary mini" data-cancel>Huỷ</button></li>`;
    return `<li class="ms-row" data-id="${r.id}">
        <span class="ms-sort"><button type="button" data-mv="-1" aria-label="Đưa lên" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-mv="1" aria-label="Đưa xuống" ${i === gl.length - 1 ? 'disabled' : ''}>▼</button></span>
        <span class="ms-name">${esc(r.name)}</span><span class="ms-count">${n} truyện</span>
        <button type="button" class="ms-btn" data-edit title="Đổi tên" aria-label="Đổi tên ${esc(r.name)}">✏️</button>
        <button type="button" class="ms-btn del" data-del title="Xoá" aria-label="Xoá ${esc(r.name)}">🗑️</button></li>`;
  }).join('') : '<li class="ms-empty">Chưa có thể loại nào, thêm ở ô phía trên nhé.</li>';
  $('msStatuses').innerHTML = sl.map((r, i) => {
    const n = usageStatus(r.code);
    if (ed && ed.kind === 'status' && ed.id === r.id) return `<li class="ms-row editing" data-id="${r.id}">
        <input class="ms-edit-input" id="msEditInput" value="${esc(r.name)}" maxlength="30" aria-label="Tên tiến độ">
        <button type="button" class="btn-submit primary mini" data-save>Lưu</button><button type="button" class="btn-submit secondary mini" data-cancel>Huỷ</button>
        <div class="tone-pick" id="msEditTone">${toneButtons(ed.tone)}</div></li>`;
    return `<li class="ms-row" data-id="${r.id}">
        <span class="ms-sort"><button type="button" data-mv="-1" aria-label="Đưa lên" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-mv="1" aria-label="Đưa xuống" ${i === sl.length - 1 ? 'disabled' : ''}>▼</button></span>
        <span class="ms-name status tone-${r.tone || 'gray'}">${esc(r.name)}</span>${i === 0 ? '<span class="soon" style="margin:0">mặc định</span>' : ''}<span class="ms-count">${n} truyện</span>
        <button type="button" class="ms-btn" data-edit title="Sửa" aria-label="Sửa ${esc(r.name)}">✏️</button>
        <button type="button" class="ms-btn del" data-del title="Xoá" aria-label="Xoá ${esc(r.name)}" ${sl.length <= 1 ? 'disabled' : ''}>🗑️</button></li>`;
  }).join('');
  const inp = $('msEditInput'); if (inp) { inp.focus(); inp.select(); }
}

// ---------- hộp thoại xác nhận ----------
function askDialog({ title, html, ok = 'Đồng ý', warn = false, onOpen }) {
  return new Promise(res => {
    const d = $('kdlg');
    $('kdlgTitle').textContent = title; $('kdlgBody').innerHTML = html;
    const yes = $('kdlgYes'), no = $('kdlgNo');
    yes.textContent = ok; yes.classList.toggle('warn', warn);
    const done = v => { d.close(); yes.onclick = no.onclick = d.oncancel = null; res(v); };
    yes.onclick = () => done(true); no.onclick = () => done(false); d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal(); if (onOpen) onOpen(); else no.focus();
  });
}

// ---------- thao tác thể loại ----------
async function addGenre(name) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (MASTER.genres.some(g => sameName(g.name, name))) { showToast('⚠️ Thể loại này đã có rồi'); return; }
  const sort = MASTER.genres.reduce((m, g) => Math.max(m, g.sort), -1) + 1;
  const { error } = await sb.from('genres').insert({ name, sort });
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  $('msGenreName').value = '';
  await loadMaster(); showToast(`🎨 Đã thêm thể loại “${name}”`);
}
async function renameGenre(row, name) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) { showToast('⚠️ Tên không được để trống'); return; }
  if (name === row.name) { MASTER.edit = null; renderMaster(); return; }
  if (MASTER.genres.some(g => g.id !== row.id && sameName(g.name, name))) { showToast('⚠️ Đã có thể loại trùng tên'); return; }
  const { error } = await sb.from('genres').update({ name }).eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  const used = DB.manga.filter(m => (m.genres || []).includes(row.name));
  for (const m of used) {
    const gs = [...new Set(m.genres.map(x => x === row.name ? name : x))];
    await sb.from('manga').update({ genres: gs }).eq('id', m.id);
  }
  MASTER.edit = null;
  await loadLibrary(); showToast(`✏️ Đã đổi tên${used.length ? `, cập nhật ${used.length} truyện` : ''}`);
}
async function deleteGenre(row) {
  const used = DB.manga.filter(m => (m.genres || []).includes(row.name));
  const ok = await askDialog({ title: `Xoá thể loại “${row.name}”?`, warn: true, ok: 'Xoá thể loại',
    html: used.length ? `<p>Có <b>${used.length} truyện</b> đang gắn thể loại này. Thể loại sẽ được gỡ khỏi các truyện đó, còn truyện thì vẫn giữ nguyên.</p>` : '<p>Chưa có truyện nào dùng thể loại này.</p>' });
  if (!ok) return;
  for (const m of used) await sb.from('manga').update({ genres: m.genres.filter(x => x !== row.name) }).eq('id', m.id);
  const { error } = await sb.from('genres').delete().eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  await loadLibrary(); showToast('🗑️ Đã xoá thể loại');
}

// ---------- thao tác tiến độ ----------
async function addStatus(name, tone) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (MASTER.statuses.some(s => sameName(s.name, name))) { showToast('⚠️ Tiến độ này đã có rồi'); return; }
  const sort = MASTER.statuses.reduce((m, s) => Math.max(m, s.sort), -1) + 1;
  const code = 'st' + Date.now().toString(36) + rand().slice(0, 3);
  const { error } = await sb.from('statuses').insert({ code, name, tone, sort });
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  $('msStatusName').value = '';
  await loadMaster(); showToast(`📊 Đã thêm tiến độ “${name}”`);
}
async function updateStatus(row, name, tone) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) { showToast('⚠️ Tên không được để trống'); return; }
  if (MASTER.statuses.some(s => s.id !== row.id && sameName(s.name, name))) { showToast('⚠️ Đã có tiến độ trùng tên'); return; }
  const { error } = await sb.from('statuses').update({ name, tone }).eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  MASTER.edit = null;
  await loadLibrary(); showToast('✏️ Đã cập nhật tiến độ');
}
async function deleteStatus(row) {
  if (MASTER.statuses.length <= 1) { showToast('⚠️ Cần giữ lại ít nhất một tiến độ'); return; }
  const n = usageStatus(row.code), others = MASTER.statuses.filter(s => s.id !== row.id);
  const ok = await askDialog({ title: `Xoá tiến độ “${row.name}”?`, warn: true, ok: 'Xoá tiến độ',
    html: n ? `<p>Có <b>${n} truyện</b> đang ở tiến độ này. Chọn tiến độ mới cho các truyện đó:</p>
      <select id="kdlgRepl">${others.map(s => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('')}</select>` : '<p>Chưa có truyện nào dùng tiến độ này.</p>' });
  if (!ok) return;
  if (n) {
    const repl = $('kdlgRepl').value;
    const up = await sb.from('manga').update({ status: repl }).eq('status', row.code);
    if (up.error) { showToast('🥲 ' + friendlyError(up.error)); return; }
  }
  const { error } = await sb.from('statuses').delete().eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  await loadLibrary(); showToast('🗑️ Đã xoá tiến độ');
}
async function moveRow(kind, row, dir) {
  const list = kind === 'genre' ? MASTER.genres : MASTER.statuses;
  const i = list.indexOf(row), j = i + dir; if (j < 0 || j >= list.length) return;
  const a = list[i], b = list[j], table = kind === 'genre' ? 'genres' : 'statuses';
  [list[i], list[j]] = [b, a];
  list.forEach((r, k) => r.sort = k); applyMaster(); renderMaster();
  await Promise.all([sb.from(table).update({ sort: j }).eq('id', a.id), sb.from(table).update({ sort: i }).eq('id', b.id)]);
  if (kind === 'status' && (i === 0 || j === 0)) showToast(`⭐ “${list[0].name}” giờ là tiến độ mặc định`);
}

$('msGenreForm').addEventListener('submit', e => { e.preventDefault(); addGenre($('msGenreName').value); });
$('msStatusForm').addEventListener('submit', e => { e.preventDefault(); addStatus($('msStatusName').value, newTone); });
$('msStatusTone').addEventListener('click', e => { const b = e.target.closest('[data-tone]'); if (b) { newTone = b.dataset.tone; renderMaster(); } });
function bindMsList(listId, kind) {
  const list = $(listId);
  const rowOf = el => { const li = el.closest('[data-id]'); return li && (kind === 'genre' ? MASTER.genres : MASTER.statuses).find(r => r.id === li.dataset.id); };
  list.addEventListener('click', e => {
    const row = rowOf(e.target); if (!row) return;
    if (e.target.closest('[data-mv]')) return moveRow(kind, row, +e.target.closest('[data-mv]').dataset.mv);
    if (e.target.closest('[data-edit]')) { MASTER.edit = { kind, id: row.id, tone: row.tone }; return renderMaster(); }
    if (e.target.closest('[data-cancel]')) { MASTER.edit = null; return renderMaster(); }
    if (e.target.closest('[data-tone]')) { MASTER.edit.tone = e.target.closest('[data-tone]').dataset.tone; const v = $('msEditInput').value; renderMaster(); $('msEditInput').value = v; return; }
    if (e.target.closest('[data-save]')) return kind === 'genre' ? renameGenre(row, $('msEditInput').value) : updateStatus(row, $('msEditInput').value, MASTER.edit.tone);
    if (e.target.closest('[data-del]')) return kind === 'genre' ? deleteGenre(row) : deleteStatus(row);
  });
  list.addEventListener('keydown', e => {
    if (e.target.id !== 'msEditInput') return;
    const row = rowOf(e.target);
    if (e.key === 'Enter') { e.preventDefault(); kind === 'genre' ? renameGenre(row, e.target.value) : updateStatus(row, e.target.value, MASTER.edit.tone); }
    if (e.key === 'Escape') { e.stopPropagation(); MASTER.edit = null; renderMaster(); }
  });
}
bindMsList('msGenres', 'genre'); bindMsList('msStatuses', 'status');

// ===================== CÀI ĐẶT: SÁNG / TỐI =====================
const sysDark = matchMedia('(prefers-color-scheme: dark)');
function currentTheme() { try { return localStorage.getItem('komorebi.theme') || 'system'; } catch (e) { return 'system'; } }
function applyTheme(t) {
  try { localStorage.setItem('komorebi.theme', t); } catch (e) {}
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  const dark = t === 'dark' || (t === 'system' && sysDark.matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#46624E' : '#6E987C');
  renderThemeOpts();
}
function renderThemeOpts() {
  const t = currentTheme(), dark = t === 'dark' || (t === 'system' && sysDark.matches);
  document.querySelectorAll('[data-theme-opt]').forEach(b => b.setAttribute('aria-checked', b.dataset.themeOpt === t));
  $('themeNow').textContent = t === 'system' ? `Máy của anh đang để chế độ ${sysDark.matches ? 'tối 🌙' : 'sáng ☀️'}, Komorebi đang hiển thị theo.` : `Komorebi luôn hiển thị ${dark ? 'tối 🌙' : 'sáng ☀️'} trên máy này.`;
}
document.querySelectorAll('[data-theme-opt]').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.themeOpt)));
sysDark.addEventListener('change', () => applyTheme(currentTheme()));
applyTheme(currentTheme());

// ---------- Sửa thông tin truyện ----------
const eStatus = makeDrop($('eStatus'), { multi: false, label: 'Tiến độ', allText: 'Chọn tiến độ' });
const eGenres = makeDrop($('eGenres'), { label: 'Thể loại', allText: 'Chọn thể loại', onChange: () => renderEChosen() });
eStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
eGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
function renderEChosen() { $('eChosen').innerHTML = eGenres.getValue().map(g => `<span class="m-tag">${esc(g)}</span>`).join(''); }
let eCoverFile = null;
function showECover(src) {
  $('eCoverPreview').src = src || ''; $('eCoverPreview').style.display = src ? 'block' : 'none';
  $('eCoverIcon').style.display = src ? 'none' : ''; $('eCoverText').style.display = src ? 'none' : '';
}
$('eCoverInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) { eCoverFile = f; showECover(URL.createObjectURL(f)); } e.target.value = ''; });
function handleECoverDrop(e) { e.preventDefault(); handleDragLeave($('eCoverZone')); const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (f) { eCoverFile = f; showECover(URL.createObjectURL(f)); } }
function fillInfoForm() {
  const m = curManga(); if (!m) return;
  $('eTitle').value = m.title || ''; $('eAuthor').value = m.author || ''; $('eTranslator').value = m.translator || '';
  $('eRelease').value = m.release_date || ''; $('eDesc').value = m.description || '';
  eStatus.setValue([m.status]); eGenres.setValue((m.genres || []).filter(g => GENRES.includes(g))); renderEChosen();
  eCoverFile = null; showECover(coverUrl(m) || null);
}
$('resetInfo').addEventListener('click', () => { fillInfoForm(); showToast('↺ Đã trả lại thông tin cũ'); });
$('saveInfo').addEventListener('click', async () => {
  if (uploading) return;
  const m = curManga(); if (!m) return;
  const title = $('eTitle').value.trim().replace(/\s+/g, ' ');
  if (!title) { showToast('⚠️ Tên truyện không được để trống'); $('eTitle').focus(); return; }
  if (!$('eAuthor').value.trim()) { showToast('⚠️ Nhập tên tác giả nhé'); $('eAuthor').focus(); return; }
  const key = titleKey(title);
  if (DB.manga.some(x => x.id !== m.id && x.title_key === key)) { showToast('⚠️ Đã có truyện khác trùng tên này'); $('eTitle').focus(); return; }
  uploading = true; $('saveInfo').disabled = true;
  try {
    setProgress('progInfo', 20, 'Đang lưu thông tin…');
    const row = { title, title_key: key, author: $('eAuthor').value.trim(), translator: $('eTranslator').value.trim() || null,
      release_date: $('eRelease').value || null, status: eStatus.getValue()[0] || m.status, genres: eGenres.getValue(),
      description: $('eDesc').value.trim() || null, updated_at: new Date().toISOString() };
    if (eCoverFile) {
      setProgress('progInfo', 45, 'Đang lưu ảnh bìa mới…');
      const path = `${DB.uid}/${m.id}/cover-${Date.now()}.jpg`;
      await putFile(path, await toJpeg(eCoverFile, 700, .86));
      row.cover_path = path;
    }
    const { error } = await sb.from('manga').update(row).eq('id', m.id);
    if (error) { if (error.code === '23505') throw new Error('Đã có truyện khác trùng tên này'); throw error; }
    if (row.cover_path && m.cover_path) { try { await sb.storage.from(BUCKET).remove([m.cover_path]); } catch (e) {} }
    setProgress('progInfo', 100, '✅ Đã lưu thông tin truyện!'); hideProgress('progInfo');
    showToast('💾 Đã cập nhật thông tin truyện');
    await loadLibrary(); selectManga(m.id); setAct('info');
  } catch (e) {
    console.warn('saveInfo', e); setProgress('progInfo', 0, '❌ ' + friendlyError(e)); showToast('🥲 Chưa lưu được');
  } finally { uploading = false; $('saveInfo').disabled = false; }
});
async function removeFiles(paths) {
  for (let i = 0; i < paths.length; i += 100) { try { await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100)); } catch (e) { console.warn('remove', e); } }
}
$('delManga').addEventListener('click', async () => {
  const m = curManga(); if (!m) return;
  const ok = await askDialog({ title: `Xoá truyện “${m.title}”?`, warn: true, ok: 'Xoá vĩnh viễn',
    html: `<p>Truyện, <b>${m.chapters.length} chương</b> cùng toàn bộ ảnh bìa và ảnh trang sẽ bị xoá vĩnh viễn, không lấy lại được.</p>` });
  if (!ok) return;
  try {
    const { data, error } = await sb.from('chapters').select('pages').eq('manga_id', m.id);
    if (error) throw error;
    const paths = (data || []).flatMap(c => c.pages || []); if (m.cover_path) paths.push(m.cover_path);
    const del = await sb.from('manga').delete().eq('id', m.id);
    if (del.error) throw del.error;
    await removeFiles(paths);
    try { localStorage.removeItem('komorebi.read.' + m.id); } catch (e) {}
    UP.mangaId = null; clearSet('old');
    $('oldFlow').hidden = true; $('oldEmpty').hidden = false;
    showToast('🗑️ Đã xoá truyện');
    await loadLibrary(); renderPickList();
  } catch (e) { console.warn('delManga', e); showToast('🥲 ' + friendlyError(e)); }
});
$('delChap').addEventListener('click', async () => {
  const m = curManga(); if (!m || !UP.chapId) return;
  const c = m.chapters.find(x => x.id === UP.chapId); if (!c) return;
  const ok = await askDialog({ title: `Xoá chương ${fmtNum(c.number)}?`, warn: true, ok: 'Xoá chương',
    html: `<p>Chương <b>${esc(chapLabel(c))}</b> cùng ${UP.origPaths.length} ảnh trang sẽ bị xoá vĩnh viễn.</p>` });
  if (!ok) return;
  try {
    const { error } = await sb.from('chapters').delete().eq('id', c.id);
    if (error) throw error;
    await removeFiles(UP.origPaths);
    await sb.from('manga').update({ updated_at: new Date().toISOString() }).eq('id', m.id);
    clearSet('old'); UP.chapId = null; UP.origPaths = [];
    showToast(`🗑️ Đã xoá chương ${fmtNum(c.number)}`);
    await loadLibrary(); selectManga(m.id);
  } catch (e) { console.warn('delChap', e); showToast('🥲 ' + friendlyError(e)); }
});

// ===================== NGƯỜI DÙNG: hồ sơ · yêu thích · lịch sử · thông báo =====================
const ME = { role: 'uploader', email: '', profile: null, avatarUrl: '', favs: new Map(), hist: [], log: null, dataErr: false };
const myName = () => (ME.profile && ME.profile.display_name) || 'anh';

async function loadUserData() {
  const [f, h] = await Promise.all([
    sb.from('favorites').select('manga_id,created_at'),
    sb.from('reading_history').select('manga_id,chapter_id,chapter_number,read_at').order('read_at', { ascending: false })
  ]);
  if (f.error) throw f.error; if (h.error) throw h.error;
  ME.favs = new Map((f.data || []).map(r => [r.manga_id, r.created_at]));
  ME.hist = (h.data || []).slice().sort((a, b) => String(b.read_at).localeCompare(String(a.read_at)));
  ME.dataErr = false;
  const lg = await sb.from('reading_log').select('manga_id,chapter_id,chapter_number,read_at').order('read_at', { ascending: false }).limit(3000);
  ME.log = lg.error ? null : (lg.data || []);
}
async function loadProfile() {
  try {
    const { data, error } = await sb.from('profiles').select('user_id,display_name,birthday,bio,avatar_path,notif_seen_at').eq('user_id', DB.uid).maybeSingle();
    if (error) throw error;
    ME.profile = data || { user_id: DB.uid, display_name: '', birthday: null, bio: '', avatar_path: null, notif_seen_at: null };
  } catch (e) { console.warn('profile', e); ME.profile = ME.profile || { user_id: DB.uid, display_name: '', birthday: null, bio: '', avatar_path: null, notif_seen_at: null }; }
  ME.avatarUrl = '';
  if (ME.profile.avatar_path) { try { [ME.avatarUrl] = await signedUrls([ME.profile.avatar_path]); } catch (e) {} }
  renderMe();
}
function avatarHTML() { return ME.avatarUrl ? `<img src="${esc(ME.avatarUrl)}" alt="">` : '🍃'; }
function renderMe() {
  const btn = $('avatarBtn');
  if (ME.avatarUrl) btn.innerHTML = `<img src="${esc(ME.avatarUrl)}" alt="">`;
  else btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';
  $('ddAv').innerHTML = avatarHTML(); $('ddName').textContent = myName(); $('userEmail').textContent = ME.email;
  const h = document.querySelector('.hero h2'); if (h) h.textContent = `Chào ${myName()}, hôm nay đọc gì nào?`;
  if (STATE.screen === 'profile') renderProfile();
}
function refreshUserViews() {
  renderBell();
  if (STATE.screen === 'favorites') renderFavs();
  if (STATE.screen === 'history') renderHistory();
  if (STATE.screen === 'profile') renderProfile();
  if (STATE.screen === 'detail') renderDetail();
}

// ---------- Yêu thích ----------
const isFav = id => ME.favs.has(id);
async function toggleFav(id) {
  const m = DB.manga.find(x => x.id === id); if (!m) return;
  const was = isFav(id);
  if (was) ME.favs.delete(id); else ME.favs.set(id, new Date().toISOString());
  refreshUserViews(); renderHome();
  const { error } = was ? await sb.from('favorites').delete().eq('manga_id', id) : await sb.from('favorites').insert({ manga_id: id });
  if (error) {
    if (was) ME.favs.set(id, new Date().toISOString()); else ME.favs.delete(id);
    refreshUserViews(); renderHome(); showToast('🥲 ' + friendlyError(error)); return;
  }
  showToast(was ? '☆ Đã bỏ khỏi yêu thích' : '⭐ Đã thêm vào yêu thích, có chương mới sẽ báo anh nhé');
}
function renderFavs() {
  const list = DB.manga.filter(m => isFav(m.id)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  $('favSub').textContent = list.length ? `${list.length} bộ truyện anh đánh dấu sao` : '';
  $('favGrid').innerHTML = list.length ? list.map(homeCard).join('')
    : `<div class="lib-empty" style="grid-column:1/-1"><div class="big">⭐</div><h3>Chưa có truyện yêu thích</h3><p>Mở một bộ truyện và bấm “☆ Yêu thích”. Khi truyện ra chương mới, chuông 🔔 sẽ báo anh.</p><button type="button" class="btn-submit primary" onclick="goScreen('library')">Mở thư viện</button></div>`;
}
$('favGrid').addEventListener('click', e => { const c = e.target.closest('[data-id]'); if (c) openDetail(c.dataset.id); });

// ---------- Lịch sử đọc ----------
async function recordHistory(m, c) {
  const row = { user_id: DB.uid, manga_id: m.id, chapter_id: c.id, chapter_number: c.number, read_at: new Date().toISOString() };
  ME.hist = [row, ...ME.hist.filter(h => h.manga_id !== m.id)];
  const { error } = await sb.from('reading_history').upsert(row, { onConflict: 'user_id,manga_id' });
  if (error) console.warn('history', error);
  if (ME.log) {
    ME.log.unshift({ manga_id: m.id, chapter_id: c.id, chapter_number: c.number, read_at: row.read_at });
    const lg = await sb.from('reading_log').insert({ manga_id: m.id, chapter_id: c.id, chapter_number: c.number, read_at: row.read_at });
    if (lg.error) console.warn('log', lg.error);
  }
}
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
function dayLabel(d) {
  const t = new Date(), y = new Date(Date.now() - 864e5);
  if (dayKey(d) === dayKey(t)) return 'Hôm nay'; if (dayKey(d) === dayKey(y)) return 'Hôm qua';
  return new Date(d).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function histItemHTML(m, h, extra) {
  const c = m.chapters.find(x => x.id === h.chapter_id);
  const last = m.chapters[m.chapters.length - 1], behind = !extra && last && +last.number > +h.chapter_number;
  return `<div class="hist-item" data-mid="${m.id}">
    <span data-open-detail>${coverHTML(m, true)}</span>
    <div class="hist-body">
      <button type="button" class="hist-title" data-open-detail>${esc(m.title)}</button>
      <div class="hist-chap">${extra || `📖 Đọc đến <b>${esc(c ? chapLabel(c) : 'Chương ' + fmtNum(h.chapter_number))}</b>`}${behind ? ` · <span style="color:var(--mau-xanh-dam)">có chương mới hơn (ch.${fmtNum(last.number)})</span>` : ''}</div>
      <div class="hist-time">🕒 ${new Date(h.read_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
    </div>
    <button type="button" class="btn-submit primary" data-continue>Đọc tiếp ❯</button>
    <button type="button" class="ms-btn del hist-del" data-hdel title="Xoá khỏi lịch sử" aria-label="Xoá ${esc(m.title)} khỏi lịch sử">✕</button>
  </div>`;
}
const isoDay = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
function renderHistory() {
  const rows = ME.hist.filter(h => DB.manga.some(m => m.id === h.manga_id));
  const f = $('histDate').value;
  $('histDate').max = isoDay(Date.now());
  $('hfDateWrap').classList.toggle('on', !!f);
  const today = isoDay(Date.now()), yday = isoDay(Date.now() - 864e5);
  document.querySelectorAll('[data-hq]').forEach(b => b.setAttribute('aria-pressed', b.dataset.hq === (!f ? 'all' : f === today ? 'today' : f === yday ? 'yday' : '')));
  $('histSub').textContent = rows.length ? `${rows.length} bộ truyện đã đọc` : '';
  $('histClear').hidden = !rows.length;
  if (!rows.length) { $('histBox').innerHTML = `<div class="lib-empty"><div class="big">🕘</div><h3>Chưa đọc truyện nào</h3><p>Đọc một chương bất kỳ, lịch sử sẽ hiện ở đây kèm ngày giờ và chương đang đọc dở.</p><button type="button" class="btn-submit primary" onclick="goScreen('home')">Về trang chủ</button></div>`; return; }
  if (f) {
    const src = (ME.log || ME.hist).filter(r => isoDay(r.read_at) === f && DB.manga.some(m => m.id === r.manga_id));
    const by = new Map();
    src.forEach(r => { const g = by.get(r.manga_id) || { last: r, nums: new Set() }; if (r.read_at > g.last.read_at) g.last = r; g.nums.add(+r.chapter_number); by.set(r.manga_id, g); });
    const label = dayLabel(f + 'T12:00:00');
    if (!by.size) { $('histBox').innerHTML = `<div class="lib-empty"><div class="big">🍃</div><h3>${esc(label)} anh không đọc truyện nào</h3><p>Chọn ngày khác hoặc bấm “Tất cả” để xem toàn bộ lịch sử.</p></div>`; return; }
    const list = [...by.entries()].sort((a, b) => String(b[1].last.read_at).localeCompare(String(a[1].last.read_at)));
    $('histBox').innerHTML = `<h3 class="hist-day">${esc(label)} · ${list.length} truyện</h3><div class="hist-list">` + list.map(([id, g]) => {
      const m = DB.manga.find(x => x.id === id);
      const nums = [...g.nums].sort((a, b) => a - b);
      return histItemHTML(m, g.last, `📖 Đã đọc trong ngày: <span class="hist-chips">${nums.map(n => `<span>Ch.${fmtNum(n)}</span>`).join('')}</span>`);
    }).join('') + '</div>';
    return;
  }
  let html = '', cur = '';
  rows.forEach(h => {
    const m = DB.manga.find(x => x.id === h.manga_id), label = dayLabel(h.read_at);
    if (label !== cur) { html += (cur ? '</div>' : '') + `<h3 class="hist-day">${esc(label)}</h3><div class="hist-list">`; cur = label; }
    html += histItemHTML(m, h);
  });
  $('histBox').innerHTML = html + '</div>';
}
$('histDate').addEventListener('change', renderHistory);
document.querySelectorAll('[data-hq]').forEach(b => b.addEventListener('click', () => {
  const q = b.dataset.hq; $('histDate').value = q === 'today' ? isoDay(Date.now()) : q === 'yday' ? isoDay(Date.now() - 864e5) : ''; renderHistory();
}));
$('histBox').addEventListener('click', async e => {
  const it = e.target.closest('[data-mid]'); if (!it) return;
  const id = it.dataset.mid, h = ME.hist.find(x => x.manga_id === id);
  if (e.target.closest('[data-open-detail]')) return openDetail(id);
  if (e.target.closest('[data-continue]') && h) return openChapter(id, h.chapter_id);
  if (e.target.closest('[data-hdel]')) {
    ME.hist = ME.hist.filter(x => x.manga_id !== id); if (ME.log) ME.log = ME.log.filter(x => x.manga_id !== id); renderHistory();
    if (ME.log) sb.from('reading_log').delete().eq('manga_id', id).then(r => r.error && console.warn(r.error));
    const { error } = await sb.from('reading_history').delete().eq('manga_id', id);
    if (error) showToast('🥲 ' + friendlyError(error));
  }
});
$('histClear').addEventListener('click', async () => {
  const ok = await askDialog({ title: 'Xoá toàn bộ lịch sử đọc?', warn: true, ok: 'Xoá hết', html: '<p>Danh sách truyện đã đọc sẽ được làm trống. Truyện và chương không bị ảnh hưởng.</p>' });
  if (!ok) return;
  const { error } = await sb.from('reading_history').delete().eq('user_id', DB.uid);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  if (ME.log) { await sb.from('reading_log').delete().eq('user_id', DB.uid); ME.log = []; }
  ME.hist = []; renderHistory(); showToast('🧹 Đã xoá lịch sử đọc');
});

// ---------- Thông báo chương mới của truyện yêu thích ----------
function notifItems() {
  const out = [];
  for (const [mid, favAt] of ME.favs) {
    const m = DB.manga.find(x => x.id === mid); if (!m) continue;
    m.chapters.forEach(c => { if (new Date(c.created_at) > new Date(favAt)) out.push({ m, c, at: c.created_at }); });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 50);
}
const seenAt = () => (ME.profile && ME.profile.notif_seen_at) || '1970-01-01';
function renderBell(markSeen) {
  const items = notifItems(), seen = seenAt();
  const unread = items.filter(i => new Date(i.at) > new Date(seen)).length;
  const badge = $('bellBadge'); badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : unread;
  $('bellBtn').classList.toggle('has-new', !!unread);
  $('bellBtn').setAttribute('aria-label', unread ? `Thông báo, ${unread} chưa xem` : 'Thông báo');
  if ($('bellPanel').hidden && !markSeen) return;
  $('bellList').innerHTML = items.length ? items.map(i => `<button type="button" class="nt-item${new Date(i.at) > new Date(seen) ? ' unread' : ''}" data-m="${i.m.id}" data-c="${i.c.id}">
      ${coverHTML(i.m, true)}<span class="nt-text"><b>${esc(i.m.title)}</b> vừa ra ${esc(chapLabel(i.c))}<small>⭐ Truyện yêu thích · ${relTimeShort(i.at)}</small></span></button>`).join('')
    : `<div class="nt-empty">Chưa có thông báo nào 🍃<br><small>Đánh dấu ⭐ truyện yêu thích, khi có chương mới chuông sẽ báo anh.</small></div>`;
}
async function markNotifSeen() {
  const now = new Date().toISOString();
  ME.profile = Object.assign({}, ME.profile, { notif_seen_at: now });
  $('bellBadge').hidden = true; $('bellBtn').classList.remove('has-new');
  const { error } = await sb.from('profiles').upsert({ user_id: DB.uid, notif_seen_at: now }, { onConflict: 'user_id' });
  if (error) console.warn('notif seen', error);
}
$('bellBtn').addEventListener('click', e => {
  e.stopPropagation();
  const p = $('bellPanel'), open = p.hidden;
  $('userDropdown').classList.remove('show');
  p.hidden = !open; $('bellBtn').setAttribute('aria-expanded', open);
  if (open) { renderBell(true); if (!$('bellBadge').hidden) markNotifSeen(); }
});
$('bellList').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; $('bellPanel').hidden = true; openChapter(b.dataset.m, b.dataset.c); });
document.addEventListener('click', e => { if (!e.target.closest('.bell-area')) { $('bellPanel').hidden = true; $('bellBtn').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('bellPanel').hidden = true; });

// ---------- Trang cá nhân ----------
let pfAvFile = null, pfAvRemove = false;
function openProfile(edit) {
  if (typeof togglePassForm === 'function') togglePassForm(false);
  $('userDropdown').classList.remove('show');
  closeDrawer();
  if (PAGE === 'profile') {
    showScreen('profile'); renderProfile(); setProfileEdit(!!edit);
    return;
  }
  location.href = pageHref('profile', edit ? { edit: '1' } : undefined);
}
function setProfileEdit(on) {
  $('pfView').hidden = on; $('pfEdit').hidden = !on;
  if (on) {
    const p = ME.profile || {};
    $('pfNameIn').value = p.display_name || ''; $('pfBday').value = p.birthday || ''; $('pfBioIn').value = p.bio || '';
    $('pfBioCount').textContent = `${$('pfBioIn').value.length}/300`;
    pfAvFile = null; pfAvRemove = false; $('pfEditAv').innerHTML = avatarHTML();
    setTimeout(() => $('pfNameIn').focus(), 50);
  }
}
function renderProfile() {
  const p = ME.profile || {};
  $('pfAv').innerHTML = avatarHTML();
  $('pfName').textContent = p.display_name || 'Chưa đặt tên';
  $('pfMail').textContent = ME.email;
  const facts = [];
  if (p.birthday) {
    const b = new Date(p.birthday + 'T00:00:00'), t = new Date();
    const isToday = b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
    facts.push(`<span class="pf-chip pf-bday">🎂 ${b.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}${isToday ? ' · Chúc mừng sinh nhật! 🎉' : ''}</span>`);
  }
  facts.unshift(canUpload() ? '<span class="pf-chip pf-role up">🛠️ Người đăng truyện</span>' : '<span class="pf-chip pf-role">👀 Tài khoản chỉ đọc</span>');
  facts.push(`<span class="pf-chip">⭐ ${ME.favs.size} yêu thích</span>`, `<span class="pf-chip">📖 ${ME.hist.length} truyện đã đọc</span>`);
  if (canUpload()) facts.push(`<span class="pf-chip">📚 ${DB.manga.filter(m => m.user_id === DB.uid).length} truyện anh đã đăng</span>`);
  $('pfFacts').innerHTML = facts.join('');
  $('pfBio').textContent = p.bio || 'Chưa có lời giới thiệu. Bấm “Chỉnh sửa hồ sơ” để viết đôi dòng nhé.';
  $('pfBio').classList.toggle('empty', !p.bio);
}
$('pfBioIn').addEventListener('input', e => $('pfBioCount').textContent = `${e.target.value.length}/300`);
$('pfAvInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) { pfAvFile = f; pfAvRemove = false; $('pfEditAv').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`; } e.target.value = ''; });
$('pfAvRemove').addEventListener('click', () => { pfAvFile = null; pfAvRemove = true; $('pfEditAv').textContent = '🍃'; });
$('pfCancel').addEventListener('click', () => setProfileEdit(false));
$('pfEdit').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('pfSave'); btn.disabled = true;
  try {
    const old = ME.profile && ME.profile.avatar_path;
    const row = { user_id: DB.uid, display_name: $('pfNameIn').value.trim() || null, birthday: $('pfBday').value || null, bio: $('pfBioIn').value.trim() || null, updated_at: new Date().toISOString() };
    if (pfAvFile) {
      setProgress('progPf', 40, 'Đang lưu ảnh đại diện…');
      const path = `${DB.uid}/avatar-${Date.now()}.jpg`;
      await putFile(path, await toJpeg(pfAvFile, 400, .88));
      row.avatar_path = path;
    } else if (pfAvRemove) row.avatar_path = null;
    const { error } = await sb.from('profiles').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    if (old && 'avatar_path' in row && row.avatar_path !== old) { try { await sb.storage.from(BUCKET).remove([old]); } catch (e) {} }
    setProgress('progPf', 100, '✅ Đã lưu hồ sơ'); hideProgress('progPf');
    await loadProfile(); setProfileEdit(false); renderProfile();
    showToast('💾 Đã cập nhật hồ sơ');
  } catch (err) { console.warn('profile save', err); setProgress('progPf', 0, '❌ ' + friendlyError(err)); }
  finally { btn.disabled = false; }
});

// ===================== CÁCH ĐỌC: dọc / ngang =====================
const READ = { urls: [], page: 0, mode: 'v', dir: 'ltr', layout: 'v' };
try { READ.mode = localStorage.getItem('komorebi.readMode') || 'v'; READ.dir = localStorage.getItem('komorebi.readDir') || 'ltr'; } catch (e) {}
const wideScreen = matchMedia('(min-width: 768px)');
const layoutNow = () => READ.mode === 'h' ? (wideScreen.matches ? 'spread' : 'strip') : 'v';
function renderReadOpts() {
  document.querySelectorAll('[data-read-opt]').forEach(b => b.setAttribute('aria-checked', b.dataset.readOpt === READ.mode));
  document.querySelectorAll('[data-dir-opt]').forEach(b => b.setAttribute('aria-selected', b.dataset.dirOpt === READ.dir));
  $('readDirRow').hidden = READ.mode !== 'h';
}
document.querySelectorAll('[data-read-opt]').forEach(b => b.addEventListener('click', () => { READ.mode = b.dataset.readOpt; try { localStorage.setItem('komorebi.readMode', READ.mode); } catch (e) {} renderReadOpts(); showToast(READ.mode === 'h' ? '↔️ Đã chuyển sang lật ngang' : '⬇️ Đã chuyển sang cuộn dọc'); }));
document.querySelectorAll('[data-dir-opt]').forEach(b => b.addEventListener('click', () => { READ.dir = b.dataset.dirOpt; try { localStorage.setItem('komorebi.readDir', READ.dir); } catch (e) {} renderReadOpts(); }));
renderReadOpts();

function renderPages(urls) {
  READ.urls = urls; READ.page = 0; READ.layout = layoutNow();
  const viewer = $('viewer'), wrap = $('viewerWrap');
  viewer.className = 'viewer'; wrap.className = 'viewer-wrap';
  $('readerMain').classList.toggle('wide', READ.layout === 'spread');
  if (!urls.length) { viewer.innerHTML = '<div class="page-placeholder">Chương này chưa có trang nào</div>'; setHint(null); return; }
  if (READ.layout === 'spread') { viewer.classList.add('spread-mode'); drawSpread(); scrollToViewer(); return; }
  const imgs = urls.map((u, i) => `<img src="${esc(u)}" alt="Trang ${i + 1}" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" onload="this.classList.add('loaded')">`).join('');
  if (READ.layout === 'strip') {
    wrap.classList.add('strip'); viewer.classList.add('strip-mode'); viewer.classList.toggle('rtl', READ.dir === 'rtl');
    viewer.innerHTML = imgs;
    viewer.scrollLeft = 0;
    setHint(READ.dir === 'rtl' ? 'left' : 'right', READ.dir === 'rtl' ? '👈 Lướt sang trái để đọc' : 'Lướt sang phải để đọc 👉');
    scrollToViewer();
    return;
  }
  viewer.innerHTML = imgs;
  setHint('down', 'Kéo xuống để đọc ⬇️');
}
function scrollToViewer() { setTimeout(() => { const top = $('viewerWrap').getBoundingClientRect().top + window.scrollY - document.querySelector('nav').offsetHeight - 4; window.scrollTo({ top, behavior: 'smooth' }); }, 120); }
function drawSpread() {
  const n = READ.urls.length, pages = Math.ceil(n / 2), p = READ.page, rtl = READ.dir === 'rtl';
  const a = p * 2, pair = READ.urls.slice(a, a + 2);
  const prevSide = rtl ? 'right' : 'left', nextSide = rtl ? 'left' : 'right';
  $('viewer').innerHTML = `<div class="spread${rtl ? ' rtl' : ''}${pair.length === 1 ? ' single' : ''}">${pair.map((u, i) => `<img src="${esc(u)}" alt="Trang ${a + i + 1}" decoding="async">`).join('')}</div>
    <button type="button" class="flip-zone ${prevSide}" data-flip="-1" aria-label="Trang trước" ${p === 0 ? 'disabled' : ''}><span>${rtl ? '❯' : '❮'}</span></button>
    <button type="button" class="flip-zone ${nextSide}" data-flip="1" aria-label="Trang sau"><span>${rtl ? '❮' : '❯'}</span></button>
    <div class="spread-bar"><span>Trang ${a + 1}${pair.length > 1 ? '–' + (a + 2) : ''} / ${n}</span>${pages > 1 ? `<input type="range" min="0" max="${pages - 1}" value="${p}" class="${rtl ? 'rtl' : ''}" aria-label="Chuyển nhanh trang">` : ''}</div>`;
  READ.urls.slice(a + 2, a + 4).forEach(u => { const im = new Image(); im.src = u; });
  if (p === 0) setHint(nextSide, rtl ? '❮ Lật sang trái để đọc' : 'Lật sang phải để đọc ❯'); else setHint(null);
}
function flip(d) {
  if (READ.layout !== 'spread') return false;
  const pages = Math.ceil(READ.urls.length / 2), np = READ.page + d;
  if (np < 0) return true;
  if (np >= pages) {
    const m = DB.manga.find(x => x.id === STATE.mangaId), i = m ? m.chapters.findIndex(x => x.id === STATE.chapterId) : -1;
    if (m && m.chapters[i + 1]) stepChapter(1); else showToast('🍃 Hết chương rồi, chưa có chương mới');
    return true;
  }
  READ.page = np; drawSpread(); return true;
}
$('viewer').addEventListener('click', e => { const b = e.target.closest('[data-flip]'); if (b && !b.disabled) flip(+b.dataset.flip); });
$('viewer').addEventListener('input', e => { if (e.target.matches('input[type="range"]')) { READ.page = +e.target.value; drawSpread(); } });
$('viewer').addEventListener('scroll', () => { if (READ.layout === 'strip') toggleHint(Math.abs($('viewer').scrollLeft) < 40); }, { passive: true });
window.addEventListener('scroll', () => { if (STATE.screen === 'reader' && READ.layout === 'v') { const r = $('viewerWrap').getBoundingClientRect(); toggleHint(r.top > -80); } }, { passive: true });
wideScreen.addEventListener('change', () => { if (STATE.screen === 'reader' && READ.mode === 'h' && READ.urls.length) renderPages(READ.urls); });

function setHint(pos, text) {
  const h = $('readHint');
  if (!pos) { h.hidden = true; return; }
  h.hidden = false; h.classList.remove('off', 'pos-left', 'pos-right', 'pos-down'); h.classList.add('pos-' + pos); h.textContent = text;
}
function toggleHint(show) { const h = $('readHint'); if (!h.hidden) h.classList.toggle('off', !show); }
$('readHint').addEventListener('click', () => {
  if (READ.layout === 'spread') return flip(1);
  if (READ.layout === 'strip') { const v = $('viewer'); v.scrollBy({ left: (READ.dir === 'rtl' ? -1 : 1) * v.clientWidth * .9, behavior: 'smooth' }); return; }
  window.scrollBy({ top: window.innerHeight * .7, behavior: 'smooth' });
});

function bootPage() {
  const q = readRouteParams();
  if (PAGE === 'home') renderHome();
  if (PAGE === 'library') {
    if (q.get('status')) { LIB.status = new Set([q.get('status')]); if (typeof dStatus !== 'undefined') dStatus.setValue([q.get('status')]); }
    renderLibrary();
    if (q.get('focus') === '1') setTimeout(() => { const i = $real('libSearch'); if (i) i.focus(); }, 60);
  }
  if (PAGE === 'detail') renderDetail();
  if (PAGE === 'reader') {
    if (STATE.mangaId && STATE.chapterId) openChapter(STATE.mangaId, STATE.chapterId);
  }
  if (PAGE === 'favorites') renderFavs();
  if (PAGE === 'history') renderHistory();
  if (PAGE === 'profile') { renderProfile(); setProfileEdit(q.get('edit') === '1'); }
  if (PAGE === 'master') renderMaster();
  if (PAGE === 'settings') { renderThemeOpts(); renderReadOpts(); }
  if (PAGE === 'upload') {
    const tab = q.get('tab') || 'new';
    switchTab(tab);
    const mid = q.get('manga'), act = q.get('act');
    if (mid) { selectManga(mid); if (act) setAct(act); }
  }
}

(async function guardAndBoot() {
  if (!sb) { location.replace(LOGIN_URL); return; }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    clearAuthSession();
    location.replace(LOGIN_URL);
    return;
  }
  await onSignedIn(data.session);
})();
