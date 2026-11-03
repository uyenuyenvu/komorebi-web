// ===================== ĐIỀU HƯỚNG =====================
const STATE = { screen: 'library', mangaId: null, chapterId: null, chOrder: 'desc' };
const MENU_OF = { home: 'home', library: 'library', detail: 'library', reader: 'library', upload: 'upload', master: 'master', settings: 'settings', favorites: 'favorites', history: 'history', profile: 'profile' };

function showScreen(name) {
  const prevScreen = STATE.screen;
  STATE.screen = name; document.body.dataset.screen = name;
  if (typeof syncUrl === 'function') syncUrl(prevScreen === 'reader' && name === 'reader');
  if (typeof showNav === 'function' && window.NAVC) { NAVC.lastDir = 0; showNav(name === 'reader'); }
  if (name !== 'reader' && typeof toggleReadPop === 'function') toggleReadPop(false);
  if (name !== 'reader') { const h = document.getElementById('readHint'); if (h) h.hidden = true; }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('screen-' + name).classList.add('active');
  document.querySelectorAll('.side-menu a[data-screen]').forEach(a => a.classList.toggle('current', a.dataset.screen === MENU_OF[name]));
  window.scrollTo({ top: 0 });
}
function goScreen(name) { closeDrawer(); if ((name === 'upload' || name === 'master') && !canUpload()) { showToast('🔒 Tài khoản này chỉ có quyền đọc truyện'); return; } showScreen(name); if (name === 'home') renderHome(); if (name === 'master') renderMaster(); if (name === 'settings') { renderThemeOpts(); renderReadOpts(); } if (name === 'favorites') renderFavs(); if (name === 'history') renderHistory(); if (name === 'profile') { renderProfile(); setProfileEdit(false); } }
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
  if (act === 'home') { showScreen('home'); renderHome(); }
  else if (act === 'library') showScreen('library');
  else if (act.startsWith('detail:')) openDetail(act.slice(7));
});
