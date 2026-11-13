// ===================== TRANG ĐỌC =====================
let readerToken = 0;
async function openChapter(mangaId, chapterId) {
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
  const novel = isNovel(m), startPos = novel ? savedPosOf(m, c) : 0;
  if (novel) { saveNovelPos(true); setNovelMode(true); $('novelPaper').innerHTML = '<p class="n-empty">Đang mở chương… 🍃</p>'; } else setNovelMode(false);
  recordHistory(m, c);
  try {
    localStorage.setItem('komorebi.lastRead', JSON.stringify({ mangaId, chapterId }));
    const read = lastReadOf(mangaId).filter(x => x !== chapterId); read.push(chapterId);
    localStorage.setItem('komorebi.read.' + mangaId, JSON.stringify(read.slice(-500)));
  } catch (e) {}
  const token = ++readerToken;
  try {
    const { data, error } = await sb.from('chapters').select(novel ? 'content' : 'pages').eq('id', chapterId).single();
    if (error) throw error;
    if (novel) { if (token === readerToken) renderNovel(data.content || '', m, c, startPos); return; }
    const urls = await signedUrls(data.pages || []);
    if (token !== readerToken) return;
    renderPages(urls);
  } catch (e) {
    if (token !== readerToken) return;
    if (novel) { $('novelPaper').innerHTML = `<p class="n-empty">Chưa tải được chương này 🥲<br>${esc(e.message || '')}</p>`; return; }
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
