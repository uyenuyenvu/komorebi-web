// ===================== MULTI-PAGE GLUE =====================
// Chạy trước mọi file JS khác. Login ở index.html; các màn ở pages/*.html.
const PAGE = document.body.dataset.page || 'home';
const IS_LOGIN = PAGE === 'login';
const LOGIN_URL = IS_LOGIN ? 'index.html' : '../index.html';
const HOME_URL = IS_LOGIN ? 'pages/home.html' : 'home.html';

const PAGE_FILE = {
  home: 'home.html', library: 'library.html', detail: 'detail.html', reader: 'reader.html',
  favorites: 'favorites.html', history: 'history.html', profile: 'profile.html',
  master: 'master.html', upload: 'upload.html'
};

const CFG = window.KOMOREBI_CONFIG || window.SOBEP_CONFIG || {};
const configured = !!(window.supabase && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/xxxx/.test(CFG.SUPABASE_URL));
const sb = configured ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

// stub ROUTE sớm để các file khác không lỗi trước khi 11-router nạp
var ROUTE = window.ROUTE || { silent: false, waiting: true, replaceNext: false };

function pageHref(name, params) {
  const file = PAGE_FILE[name] || (name + '.html');
  let url = file;
  if (params && typeof params === 'object') {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') q.set(k, String(v)); });
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

function readRouteParams() {
  const q = new URLSearchParams(location.search);
  if (typeof STATE === 'undefined') return q;
  if (PAGE === 'detail') {
    const id = q.get('id');
    if (id) STATE.mangaId = id;
  }
  if (PAGE === 'reader') {
    const m = q.get('manga'), c = q.get('chapter');
    if (m) STATE.mangaId = m;
    if (c) STATE.chapterId = c;
  }
  return q;
}

async function logout() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.classList.remove('show');
  if (sb) await sb.auth.signOut();
  clearAuthSession();
  if (typeof resetData === 'function') resetData();
  location.href = LOGIN_URL;
}
