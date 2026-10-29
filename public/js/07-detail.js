// ===================== CHI TIẾT TRUYỆN =====================
function lastReadOf(mangaId) {
  try { return JSON.parse(localStorage.getItem('komorebi.read.' + mangaId) || '[]'); } catch (e) { return []; }
}
function openDetail(id) { STATE.mangaId = id; showScreen('detail'); renderDetail(); }
function renderDetail() {
  const m = DB.manga.find(x => x.id === STATE.mangaId);
  if (!m) { showScreen('library'); return; }
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
