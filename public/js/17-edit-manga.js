// ---------- Sửa thông tin truyện ----------
const eStatus = makeDrop($('eStatus'), { multi: false, label: 'Tiến độ', allText: 'Chọn tiến độ' });
const eGenres = makeDrop($('eGenres'), { label: 'Thể loại', allText: 'Chọn thể loại', onChange: () => renderEChosen() });
eStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
eGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
function renderEChosen() { $('eChosen').innerHTML = eGenres.getValue().map(g => `<span class="m-tag">${esc(g)}</span>`).join(''); }
let eCoverFile = null;
function showECover(src) {
  $('eCoverPreview').src = src || ''; $('eCoverPreview').style.display = src ? 'block' : 'none';
  $('eCoverIcon').style.display = src ? 'none' : ''; $('eCoverText').style.display = src ? 'none' : '';
}
$('eCoverInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) { eCoverFile = f; showECover(URL.createObjectURL(f)); } e.target.value = ''; });
function handleECoverDrop(e) { e.preventDefault(); handleDragLeave($('eCoverZone')); const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/')); if (f) { eCoverFile = f; showECover(URL.createObjectURL(f)); } }
function fillInfoForm() {
  const m = curManga(); if (!m) return;
  $('eTitle').value = m.title || ''; $('eAuthor').value = m.author || ''; $('eTranslator').value = m.translator || '';
  $('eRelease').value = m.release_date || ''; $('eDesc').value = m.description || '';
  eStatus.setValue([m.status]); eGenres.setValue((m.genres || []).filter(g => GENRES.includes(g))); renderEChosen();
  eCoverFile = null; showECover(coverUrl(m) || null);
}
$('resetInfo').addEventListener('click', () => { fillInfoForm(); showToast('↺ Đã trả lại thông tin cũ'); });
$('saveInfo').addEventListener('click', async () => {
  if (uploading) return;
  const m = curManga(); if (!m) return;
  const title = $('eTitle').value.trim().replace(/\s+/g, ' ');
  if (!title) { showToast('⚠️ Tên truyện không được để trống'); $('eTitle').focus(); return; }
  if (!$('eAuthor').value.trim()) { showToast('⚠️ Nhập tên tác giả nhé'); $('eAuthor').focus(); return; }
  const key = titleKey(title);
  if (DB.manga.some(x => x.id !== m.id && x.title_key === key)) { showToast('⚠️ Đã có truyện khác trùng tên này'); $('eTitle').focus(); return; }
  uploading = true; $('saveInfo').disabled = true;
  try {
    setProgress('progInfo', 20, 'Đang lưu thông tin…');
    const row = { title, title_key: key, author: $('eAuthor').value.trim(), translator: $('eTranslator').value.trim() || null,
      release_date: $('eRelease').value || null, status: eStatus.getValue()[0] || m.status, genres: eGenres.getValue(),
      description: $('eDesc').value.trim() || null, updated_at: new Date().toISOString() };
    if (eCoverFile) {
      setProgress('progInfo', 45, 'Đang lưu ảnh bìa mới…');
      const path = `${DB.uid}/${m.id}/cover-${Date.now()}.jpg`;
      await putFile(path, await toJpeg(eCoverFile, 700, .86));
      row.cover_path = path;
    }
    const { error } = await sb.from('manga').update(row).eq('id', m.id);
    if (error) { if (error.code === '23505') throw new Error('Đã có truyện khác trùng tên này'); throw error; }
    if (row.cover_path && m.cover_path) { try { await sb.storage.from(BUCKET).remove([m.cover_path]); } catch (e) {} }
    setProgress('progInfo', 100, '✅ Đã lưu thông tin truyện!'); hideProgress('progInfo');
    showToast('💾 Đã cập nhật thông tin truyện');
    await loadLibrary(); selectManga(m.id); setAct('info');
  } catch (e) {
    console.warn('saveInfo', e); setProgress('progInfo', 0, '❌ ' + friendlyError(e)); showToast('🥲 Chưa lưu được');
  } finally { uploading = false; $('saveInfo').disabled = false; }
});
async function removeFiles(paths) {
  for (let i = 0; i < paths.length; i += 100) { try { await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100)); } catch (e) { console.warn('remove', e); } }
}
$('delManga').addEventListener('click', async () => {
  const m = curManga(); if (!m) return;
  const ok = await askDialog({ title: `Xoá truyện “${m.title}”?`, warn: true, ok: 'Xoá vĩnh viễn',
    html: `<p>Truyện, <b>${m.chapters.length} chương</b> cùng toàn bộ ảnh bìa và ảnh trang sẽ bị xoá vĩnh viễn, không lấy lại được.</p>` });
  if (!ok) return;
  try {
    const { data, error } = await sb.from('chapters').select('pages').eq('manga_id', m.id);
    if (error) throw error;
    const paths = (data || []).flatMap(c => c.pages || []); if (m.cover_path) paths.push(m.cover_path);
    const del = await sb.from('manga').delete().eq('id', m.id);
    if (del.error) throw del.error;
    await removeFiles(paths);
    try { localStorage.removeItem('komorebi.read.' + m.id); } catch (e) {}
    UP.mangaId = null; clearSet('old');
    $('oldFlow').hidden = true; $('oldEmpty').hidden = false;
    showToast('🗑️ Đã xoá truyện');
    await loadLibrary(); renderPickList();
  } catch (e) { console.warn('delManga', e); showToast('🥲 ' + friendlyError(e)); }
});
$('delChap').addEventListener('click', async () => {
  const m = curManga(); if (!m || !UP.chapId) return;
  const c = m.chapters.find(x => x.id === UP.chapId); if (!c) return;
  const ok = await askDialog({ title: `Xoá chương ${fmtNum(c.number)}?`, warn: true, ok: 'Xoá chương',
    html: `<p>Chương <b>${esc(chapLabel(c))}</b> cùng ${UP.origPaths.length} ảnh trang sẽ bị xoá vĩnh viễn.</p>` });
  if (!ok) return;
  try {
    const { error } = await sb.from('chapters').delete().eq('id', c.id);
    if (error) throw error;
    await removeFiles(UP.origPaths);
    await sb.from('manga').update({ updated_at: new Date().toISOString() }).eq('id', m.id);
    clearSet('old'); UP.chapId = null; UP.origPaths = [];
    showToast(`🗑️ Đã xoá chương ${fmtNum(c.number)}`);
    await loadLibrary(); selectManga(m.id);
  } catch (e) { console.warn('delChap', e); showToast('🥲 ' + friendlyError(e)); }
});
