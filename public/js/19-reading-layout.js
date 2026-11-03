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
document.querySelectorAll('[data-read-opt]').forEach(b => b.addEventListener('click', () => { if (READ.mode === b.dataset.readOpt) return; const at = currentPageIndex(); READ.mode = b.dataset.readOpt; try { localStorage.setItem('komorebi.readMode', READ.mode); } catch (e) {} renderReadOpts(); relayout(at); }));
document.querySelectorAll('[data-dir-opt]').forEach(b => b.addEventListener('click', () => { if (READ.dir === b.dataset.dirOpt) return; const at = currentPageIndex(); READ.dir = b.dataset.dirOpt; try { localStorage.setItem('komorebi.readDir', READ.dir); } catch (e) {} renderReadOpts(); relayout(at); }));
function currentPageIndex() {
  if (STATE.screen !== 'reader' || !READ.urls.length) return 0;
  if (READ.layout === 'spread') return READ.page * 2;
  const imgs = [...$('viewer').querySelectorAll('img')];
  if (READ.layout === 'strip') { const cx = innerWidth / 2; const k = imgs.findIndex(im => { const r = im.getBoundingClientRect(); return r.left <= cx && r.right >= cx; }); return Math.max(0, k); }
  const y = innerHeight * .35; const k = imgs.findIndex(im => { const r = im.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
  return Math.max(0, k);
}
function relayout(at) {
  if (STATE.screen !== 'reader' || !READ.urls.length) return;
  renderPages(READ.urls);
  if (!at) return;
  if (READ.layout === 'spread') { READ.page = Math.floor(at / 2); drawSpread(); return; }
  const imgs = [...$('viewer').querySelectorAll('img')].slice(0, at + 1);
  imgs.forEach(im => im.loading = 'eager');
  Promise.all(imgs.map(im => im.decode ? im.decode().catch(() => {}) : null)).then(() => {
    const t = $('viewer').querySelectorAll('img')[at]; if (!t) return;
    if (READ.layout === 'strip') t.scrollIntoView({ inline: 'start', block: 'nearest' });
    else window.scrollTo({ top: t.getBoundingClientRect().top + scrollY - 8 });
  });
}
function toggleReadPop(force) {
  const p = $('readPop'), open = typeof force === 'boolean' ? force : p.hidden;
  p.hidden = !open; $('readSetBtn').setAttribute('aria-expanded', open); if (open) renderReadOpts();
}
document.addEventListener('click', e => { if (!e.target.closest('#readPop') && !e.target.closest('#readSetBtn')) toggleReadPop(false); });
function openSettings() { closeDrawer(); renderThemeOpts(); $('setDlg').showModal(); }
function closeSettings() { $('setDlg').close(); }
$('setDlg').addEventListener('click', e => { if (e.target === $('setDlg')) closeSettings(); });
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
    setHint(READ.dir === 'rtl' ? 'left' : 'right', READ.dir === 'rtl' ? '❮' : '❯');
    scrollToViewer();
    return;
  }
  viewer.innerHTML = imgs;
  setHint(null);
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
  if (p === 0) setHint(nextSide, rtl ? '❮' : '❯'); else setHint(null);
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
  h.setAttribute('aria-label', pos === 'left' ? 'Lướt sang trái để đọc tiếp' : 'Lướt sang phải để đọc tiếp');
}
function toggleHint(show) { const h = $('readHint'); if (!h.hidden) h.classList.toggle('off', !show); }
$('readHint').addEventListener('click', () => {
  if (READ.layout === 'spread') return flip(1);
  if (READ.layout === 'strip') { const v = $('viewer'); v.scrollBy({ left: (READ.dir === 'rtl' ? -1 : 1) * v.clientWidth * .9, behavior: 'smooth' }); return; }
  window.scrollBy({ top: window.innerHeight * .7, behavior: 'smooth' });
});
