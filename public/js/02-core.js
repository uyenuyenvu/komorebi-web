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

const $ = id => document.getElementById(id);
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
async function onSignedIn(session) {
  DB.uid = session.user.id; ME.email = session.user.email || '';
  loadProfile();
  await loadRole();
  ROUTE.waiting = true; route();          // mở đúng màn theo đường dẫn hiện tại
  await loadLibrary();
  if (ROUTE.waiting) { ROUTE.waiting = false; route(); }
}
function resetData() { DB.manga = []; DB.loaded = false; DB.uid = null; urlCache.clear(); ME.favs = new Map(); ME.hist = []; ME.profile = null; ME.avatarUrl = ''; renderMe(); renderBell(); }
