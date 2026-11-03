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
$('seeDone').addEventListener('click', () => { resetLibrary(); LIB.status = new Set(['xong']); dStatus.setValue(['xong']); showScreen('library'); renderLibrary(); });
