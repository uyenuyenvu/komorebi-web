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
  if (STATE.screen === 'library' && typeof replaceUrl === 'function') setTimeout(replaceUrl, 0);
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
function openLibrarySearch() { closeDrawer(); showScreen('library'); setTimeout(() => $('libSearch').focus(), 60); }

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
