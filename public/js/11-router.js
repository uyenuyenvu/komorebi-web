// ===================== ĐƯỜNG DẪN RIÊNG CHO TỪNG MÀN =====================
var ROUTE = { silent: false, waiting: true, replaceNext: false };   // chờ đăng nhập xong mới đọc đường dẫn
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
const slugify = s => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'truyen';
function slugOf(m) {
  const base = slugify(m.title);
  return DB.manga.some(x => x.id !== m.id && slugify(x.title) === base) ? `${base}-${m.id.slice(0, 4)}` : base;
}
const mangaBySlug = sl => DB.manga.find(m => slugOf(m) === sl) || DB.manga.find(m => sl.endsWith('-' + m.id.slice(0, 4)));
const chapSlug = n => 'chuong-' + String(+n).replace('.', '-');
const chapFromSlug = (m, sl) => { const n = parseFloat(String(sl).replace(/^chuong-/, '').replace('-', '.')); return m.chapters.find(c => +c.number === n); };
function libQuery() {
  const q = new URLSearchParams();
  if (LIB.q) q.set('q', LIB.q);
  if (LIB.status.size) q.set('tien-do', [...LIB.status].join(','));
  if (LIB.genres.size) q.set('the-loai', [...LIB.genres].join(','));
  if (LIB.sort !== 'new') q.set('sap-xep', LIB.sort);
  if (LIB.page > 1) q.set('trang', LIB.page);
  if (LIB.per !== 10) q.set('moi-trang', LIB.per);
  const t = q.toString(); return t ? '?' + t : '';
}
function urlForState() {
  const m = DB.manga.find(x => x.id === STATE.mangaId);
  switch (STATE.screen) {
    case 'library': return '/thu-vien' + libQuery();
    case 'detail': return m ? '/truyen/' + slugOf(m) : null;
    case 'reader': { if (!m) return null; const c = m.chapters.find(x => x.id === STATE.chapterId); return '/truyen/' + slugOf(m) + (c ? '/' + chapSlug(c.number) : ''); }
    case 'favorites': return '/yeu-thich';
    case 'history': { const d = $('histDate').value; return '/lich-su' + (d ? '?ngay=' + d : ''); }
    case 'profile': return '/ca-nhan';
    case 'upload': return UP.tab === 'old' ? '/upload/truyen-da-co' : '/upload';
    case 'master': return '/danh-muc';
    default: return '/';
  }
}
function syncUrl(replace) {
  if (location.protocol === 'file:') return;
  if (!window.ROUTE || ROUTE.silent || ROUTE.waiting) return;
  if (ROUTE.replaceNext) { replace = true; ROUTE.replaceNext = false; }
  const url = urlForState(); if (!url) return;
  if (url === location.pathname + location.search) return;
  if (replace) { history.replaceState({ y: 0 }, '', url); return; }
  try { history.replaceState(Object.assign({}, history.state, { y: scrollY }), ''); } catch (e) {}
  history.pushState({ y: 0 }, '', url);
}
function replaceUrl() { if (location.protocol === 'file:') return; if (!window.ROUTE || ROUTE.silent || ROUTE.waiting) return; const url = urlForState(); if (url && url !== location.pathname + location.search) history.replaceState(history.state, '', url); }
function route() {
  if (location.protocol === 'file:') { ROUTE.silent = true; showScreen('home'); renderHome(); ROUTE.silent = false; return; }
  const parts = decodeURIComponent(location.pathname).split('/').filter(Boolean), qs = new URLSearchParams(location.search);
  const needData = parts[0] === 'truyen';
  if (needData && !DB.loaded) { ROUTE.silent = true; showScreen('library'); ROUTE.silent = false; return; }   // đợi tải xong dữ liệu rồi mở đúng truyện
  ROUTE.silent = true;
  try {
    const p0 = parts[0] || '';
    if (p0 === 'thu-vien') {
      LIB.q = qs.get('q') || ''; $('libSearch').value = LIB.q;
      LIB.status = new Set((qs.get('tien-do') || '').split(',').filter(Boolean));
      LIB.genres = new Set((qs.get('the-loai') || '').split(',').filter(Boolean));
      LIB.sort = qs.get('sap-xep') || 'new'; $('libSort').value = LIB.sort;
      LIB.per = +(qs.get('moi-trang') || 10); $('perPage').value = String(LIB.per);
      LIB.page = +(qs.get('trang') || 1);
      dStatus.setValue([...LIB.status]); dGenre.setValue([...LIB.genres]);
      showScreen('library'); renderLibrary();
    } else if (p0 === 'truyen') {
      const m = mangaBySlug(parts[1] || '');
      if (!m) { showScreen('library'); renderLibrary(); ROUTE.silent = false; history.replaceState(null, '', '/thu-vien'); showToast('⚠️ Không tìm thấy truyện này, có thể đã bị xoá'); return; }
      if (parts[2]) {
        const c = chapFromSlug(m, parts[2]);
        if (c) openChapter(m.id, c.id); else { openDetail(m.id); showToast('⚠️ Không tìm thấy chương này'); }
      } else openDetail(m.id);
    } else if (p0 === 'yeu-thich') { goScreen('favorites'); }
    else if (p0 === 'lich-su') { $('histDate').value = qs.get('ngay') || ''; goScreen('history'); }
    else if (p0 === 'ca-nhan') { openProfile(false); }
    else if (p0 === 'upload') {
      if (!canUpload()) { showScreen('home'); renderHome(); ROUTE.silent = false; history.replaceState(null, '', '/'); return; }
      showScreen('upload'); switchTab(parts[1] === 'truyen-da-co' ? 'old' : 'new');
    } else if (p0 === 'danh-muc') {
      if (!canUpload()) { showScreen('home'); renderHome(); ROUTE.silent = false; history.replaceState(null, '', '/'); return; }
      goScreen('master');
    } else { showScreen('home'); renderHome(); }
  } finally { ROUTE.silent = false; }
  const y = history.state && history.state.y;
  if (y) setTimeout(() => window.scrollTo({ top: y }), 80);
}
window.addEventListener('popstate', () => { if (!DB.uid) return; closeDrawer(); DROPS.forEach(closeDrop); toggleReadPop(false); route(); });
