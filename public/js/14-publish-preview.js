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
function backToEdit(set, progId) {
  const box = $(progId); box.classList.remove('show'); box.querySelector('.progress-bar-fill').style.width = '0%';
  showScreen('upload'); switchTab(set === 'new' ? 'new' : 'old');
  renderThumbs(set);
  setTimeout(() => $(GRID[set]).scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  showToast('↩ Kéo thả để sắp xếp lại rồi bấm đăng tải nhé, ảnh đã tải sẽ không phải tải lại');
}
function resetUploadScreen() {
  UP.mangaId = null; UP.act = 'next'; UP.chapId = null; UP.origPaths = []; UP.q = '';
  clearSet('old'); $('pickSearch').value = ''; $('oldNum').value = ''; $('oldTitle').value = '';
  $('oldFlow').hidden = true; $('oldEmpty').hidden = false;
  renderPickList(); switchTab('new');
}
