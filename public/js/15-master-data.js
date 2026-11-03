// ===================== DANH MỤC (thể loại & tiến độ) =====================
const TONES = [['green', 'Xanh lá'], ['blue', 'Xanh dương'], ['purple', 'Tím'], ['yellow', 'Vàng'], ['pink', 'Hồng'], ['gray', 'Xám']];
const DEFAULT_STATUSES = [['dang', 'Đang ra', 'green'], ['xong', 'Hoàn thành', 'blue'], ['ss1', 'Hết season 1', 'purple'], ['ss2', 'Hết season 2', 'purple'], ['dung', 'Tạm dừng', 'yellow'], ['drop', 'Drop', 'pink']];
const DEFAULT_GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mystery', 'Romance', 'Sci-fi', 'Slice of life', 'Thriller'];
const MASTER = { genres: [], statuses: [], edit: null };

async function loadMaster() {
  const fetchBoth = () => Promise.all([
    sb.from('genres').select('id,name,sort').order('sort', { ascending: true }),
    sb.from('statuses').select('id,code,name,tone,sort').order('sort', { ascending: true })
  ]);
  let [g, st] = await fetchBoth();
  if (g.error) throw g.error; if (st.error) throw st.error;
  if (!st.data.length && !canUpload()) {   // tài khoản chỉ đọc: dùng danh mục mặc định, không ghi gì
    MASTER.statuses = DEFAULT_STATUSES.map(([code, name, tone], i) => ({ id: 'd' + i, code, name, tone, sort: i }));
    MASTER.genres = (g.data.length ? g.data : DEFAULT_GENRES.map((name, i) => ({ id: 'g' + i, name, sort: i })));
    applyMaster(); return;
  }
  if (!st.data.length) {   // lần đầu: tạo sẵn danh mục mặc định
    const a = await sb.from('statuses').insert(DEFAULT_STATUSES.map(([code, name, tone], i) => ({ code, name, tone, sort: i })));
    if (a.error) throw a.error;
    if (!g.data.length) { const b = await sb.from('genres').insert(DEFAULT_GENRES.map((name, i) => ({ name, sort: i }))); if (b.error) throw b.error; }
    [g, st] = await fetchBoth();
    if (g.error) throw g.error; if (st.error) throw st.error;
  }
  MASTER.genres = g.data.slice().sort((a, b) => a.sort - b.sort);
  MASTER.statuses = st.data.slice().sort((a, b) => a.sort - b.sort);
  applyMaster();
}
function applyMaster() {
  STATUSES = MASTER.statuses.map(r => ({ id: r.code, name: r.name, tone: r.tone, cls: 'tone-' + (r.tone || 'gray') }));
  GENRES = MASTER.genres.map(r => r.name);
  if (typeof upStatus !== 'undefined') {
    const keepS = upStatus.getValue()[0];
    upStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
    upStatus.setValue([STATUSES.some(s => s.id === keepS) ? keepS : (STATUSES[0] && STATUSES[0].id)]);
    upGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
    upGenres.setValue(upGenres.getValue().filter(g => GENRES.includes(g))); renderChosen();
    eStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
    eGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
  }
  if (STATE.screen === 'master') renderMaster();
}
const usageGenre = name => DB.manga.filter(m => (m.genres || []).includes(name)).length;
const usageStatus = code => DB.manga.filter(m => m.status === code).length;
const sameName = (a, b) => titleKey(a) === titleKey(b);

function toneButtons(sel) {
  return TONES.map(([k, label]) => `<button type="button" class="tone-dot tone-${k}" data-tone="${k}" aria-pressed="${k === sel}" title="${label}" aria-label="Màu ${label}"></button>`).join('');
}
let newTone = 'green';
function renderMaster() {
  $('msGenreCount').textContent = `${MASTER.genres.length} mục`;
  $('msStatusCount').textContent = `${MASTER.statuses.length} mục`;
  $('msStatusTone').innerHTML = toneButtons(newTone);
  const gl = MASTER.genres, sl = MASTER.statuses, ed = MASTER.edit;
  $('msGenres').innerHTML = gl.length ? gl.map((r, i) => {
    const n = usageGenre(r.name);
    if (ed && ed.kind === 'genre' && ed.id === r.id) return `<li class="ms-row editing" data-id="${r.id}">
        <input class="ms-edit-input" id="msEditInput" value="${esc(r.name)}" maxlength="40" aria-label="Tên thể loại">
        <button type="button" class="btn-submit primary mini" data-save>Lưu</button><button type="button" class="btn-submit secondary mini" data-cancel>Huỷ</button></li>`;
    return `<li class="ms-row" data-id="${r.id}">
        <span class="ms-sort"><button type="button" data-mv="-1" aria-label="Đưa lên" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-mv="1" aria-label="Đưa xuống" ${i === gl.length - 1 ? 'disabled' : ''}>▼</button></span>
        <span class="ms-name">${esc(r.name)}</span><span class="ms-count">${n} truyện</span>
        <button type="button" class="ms-btn" data-edit title="Đổi tên" aria-label="Đổi tên ${esc(r.name)}">✏️</button>
        <button type="button" class="ms-btn del" data-del title="Xoá" aria-label="Xoá ${esc(r.name)}">🗑️</button></li>`;
  }).join('') : '<li class="ms-empty">Chưa có thể loại nào, thêm ở ô phía trên nhé.</li>';
  $('msStatuses').innerHTML = sl.map((r, i) => {
    const n = usageStatus(r.code);
    if (ed && ed.kind === 'status' && ed.id === r.id) return `<li class="ms-row editing" data-id="${r.id}">
        <input class="ms-edit-input" id="msEditInput" value="${esc(r.name)}" maxlength="30" aria-label="Tên tiến độ">
        <button type="button" class="btn-submit primary mini" data-save>Lưu</button><button type="button" class="btn-submit secondary mini" data-cancel>Huỷ</button>
        <div class="tone-pick" id="msEditTone">${toneButtons(ed.tone)}</div></li>`;
    return `<li class="ms-row" data-id="${r.id}">
        <span class="ms-sort"><button type="button" data-mv="-1" aria-label="Đưa lên" ${i === 0 ? 'disabled' : ''}>▲</button><button type="button" data-mv="1" aria-label="Đưa xuống" ${i === sl.length - 1 ? 'disabled' : ''}>▼</button></span>
        <span class="ms-name status tone-${r.tone || 'gray'}">${esc(r.name)}</span>${i === 0 ? '<span class="soon" style="margin:0">mặc định</span>' : ''}<span class="ms-count">${n} truyện</span>
        <button type="button" class="ms-btn" data-edit title="Sửa" aria-label="Sửa ${esc(r.name)}">✏️</button>
        <button type="button" class="ms-btn del" data-del title="Xoá" aria-label="Xoá ${esc(r.name)}" ${sl.length <= 1 ? 'disabled' : ''}>🗑️</button></li>`;
  }).join('');
  const inp = $('msEditInput'); if (inp) { inp.focus(); inp.select(); }
}

// ---------- hộp thoại xác nhận ----------
function askDialog({ title, html, ok = 'Đồng ý', warn = false, onOpen }) {
  return new Promise(res => {
    const d = $('kdlg');
    $('kdlgTitle').textContent = title; $('kdlgBody').innerHTML = html;
    const yes = $('kdlgYes'), no = $('kdlgNo');
    yes.textContent = ok; yes.classList.toggle('warn', warn);
    const done = v => { d.close(); yes.onclick = no.onclick = d.oncancel = null; res(v); };
    yes.onclick = () => done(true); no.onclick = () => done(false); d.oncancel = e => { e.preventDefault(); done(false); };
    d.showModal(); if (onOpen) onOpen(); else no.focus();
  });
}

// ---------- thao tác thể loại ----------
async function addGenre(name) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (MASTER.genres.some(g => sameName(g.name, name))) { showToast('⚠️ Thể loại này đã có rồi'); return; }
  const sort = MASTER.genres.reduce((m, g) => Math.max(m, g.sort), -1) + 1;
  const { error } = await sb.from('genres').insert({ name, sort });
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  $('msGenreName').value = '';
  await loadMaster(); showToast(`🎨 Đã thêm thể loại “${name}”`);
}
async function renameGenre(row, name) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) { showToast('⚠️ Tên không được để trống'); return; }
  if (name === row.name) { MASTER.edit = null; renderMaster(); return; }
  if (MASTER.genres.some(g => g.id !== row.id && sameName(g.name, name))) { showToast('⚠️ Đã có thể loại trùng tên'); return; }
  const { error } = await sb.from('genres').update({ name }).eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  const used = DB.manga.filter(m => (m.genres || []).includes(row.name));
  for (const m of used) {
    const gs = [...new Set(m.genres.map(x => x === row.name ? name : x))];
    await sb.from('manga').update({ genres: gs }).eq('id', m.id);
  }
  MASTER.edit = null;
  await loadLibrary(); showToast(`✏️ Đã đổi tên${used.length ? `, cập nhật ${used.length} truyện` : ''}`);
}
async function deleteGenre(row) {
  const used = DB.manga.filter(m => (m.genres || []).includes(row.name));
  const ok = await askDialog({ title: `Xoá thể loại “${row.name}”?`, warn: true, ok: 'Xoá thể loại',
    html: used.length ? `<p>Có <b>${used.length} truyện</b> đang gắn thể loại này. Thể loại sẽ được gỡ khỏi các truyện đó, còn truyện thì vẫn giữ nguyên.</p>` : '<p>Chưa có truyện nào dùng thể loại này.</p>' });
  if (!ok) return;
  for (const m of used) await sb.from('manga').update({ genres: m.genres.filter(x => x !== row.name) }).eq('id', m.id);
  const { error } = await sb.from('genres').delete().eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  await loadLibrary(); showToast('🗑️ Đã xoá thể loại');
}

// ---------- thao tác tiến độ ----------
async function addStatus(name, tone) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (MASTER.statuses.some(s => sameName(s.name, name))) { showToast('⚠️ Tiến độ này đã có rồi'); return; }
  const sort = MASTER.statuses.reduce((m, s) => Math.max(m, s.sort), -1) + 1;
  const code = 'st' + Date.now().toString(36) + rand().slice(0, 3);
  const { error } = await sb.from('statuses').insert({ code, name, tone, sort });
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  $('msStatusName').value = '';
  await loadMaster(); showToast(`📊 Đã thêm tiến độ “${name}”`);
}
async function updateStatus(row, name, tone) {
  name = name.trim().replace(/\s+/g, ' ');
  if (!name) { showToast('⚠️ Tên không được để trống'); return; }
  if (MASTER.statuses.some(s => s.id !== row.id && sameName(s.name, name))) { showToast('⚠️ Đã có tiến độ trùng tên'); return; }
  const { error } = await sb.from('statuses').update({ name, tone }).eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  MASTER.edit = null;
  await loadLibrary(); showToast('✏️ Đã cập nhật tiến độ');
}
async function deleteStatus(row) {
  if (MASTER.statuses.length <= 1) { showToast('⚠️ Cần giữ lại ít nhất một tiến độ'); return; }
  const n = usageStatus(row.code), others = MASTER.statuses.filter(s => s.id !== row.id);
  const ok = await askDialog({ title: `Xoá tiến độ “${row.name}”?`, warn: true, ok: 'Xoá tiến độ',
    html: n ? `<p>Có <b>${n} truyện</b> đang ở tiến độ này. Chọn tiến độ mới cho các truyện đó:</p>
      <select id="kdlgRepl">${others.map(s => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('')}</select>` : '<p>Chưa có truyện nào dùng tiến độ này.</p>' });
  if (!ok) return;
  if (n) {
    const repl = $('kdlgRepl').value;
    const up = await sb.from('manga').update({ status: repl }).eq('status', row.code);
    if (up.error) { showToast('🥲 ' + friendlyError(up.error)); return; }
  }
  const { error } = await sb.from('statuses').delete().eq('id', row.id);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  await loadLibrary(); showToast('🗑️ Đã xoá tiến độ');
}
async function moveRow(kind, row, dir) {
  const list = kind === 'genre' ? MASTER.genres : MASTER.statuses;
  const i = list.indexOf(row), j = i + dir; if (j < 0 || j >= list.length) return;
  const a = list[i], b = list[j], table = kind === 'genre' ? 'genres' : 'statuses';
  [list[i], list[j]] = [b, a];
  list.forEach((r, k) => r.sort = k); applyMaster(); renderMaster();
  await Promise.all([sb.from(table).update({ sort: j }).eq('id', a.id), sb.from(table).update({ sort: i }).eq('id', b.id)]);
  if (kind === 'status' && (i === 0 || j === 0)) showToast(`⭐ “${list[0].name}” giờ là tiến độ mặc định`);
}

$('msGenreForm').addEventListener('submit', e => { e.preventDefault(); addGenre($('msGenreName').value); });
$('msStatusForm').addEventListener('submit', e => { e.preventDefault(); addStatus($('msStatusName').value, newTone); });
$('msStatusTone').addEventListener('click', e => { const b = e.target.closest('[data-tone]'); if (b) { newTone = b.dataset.tone; renderMaster(); } });
function bindMsList(listId, kind) {
  const list = $(listId);
  const rowOf = el => { const li = el.closest('[data-id]'); return li && (kind === 'genre' ? MASTER.genres : MASTER.statuses).find(r => r.id === li.dataset.id); };
  list.addEventListener('click', e => {
    const row = rowOf(e.target); if (!row) return;
    if (e.target.closest('[data-mv]')) return moveRow(kind, row, +e.target.closest('[data-mv]').dataset.mv);
    if (e.target.closest('[data-edit]')) { MASTER.edit = { kind, id: row.id, tone: row.tone }; return renderMaster(); }
    if (e.target.closest('[data-cancel]')) { MASTER.edit = null; return renderMaster(); }
    if (e.target.closest('[data-tone]')) { MASTER.edit.tone = e.target.closest('[data-tone]').dataset.tone; const v = $('msEditInput').value; renderMaster(); $('msEditInput').value = v; return; }
    if (e.target.closest('[data-save]')) return kind === 'genre' ? renameGenre(row, $('msEditInput').value) : updateStatus(row, $('msEditInput').value, MASTER.edit.tone);
    if (e.target.closest('[data-del]')) return kind === 'genre' ? deleteGenre(row) : deleteStatus(row);
  });
  list.addEventListener('keydown', e => {
    if (e.target.id !== 'msEditInput') return;
    const row = rowOf(e.target);
    if (e.key === 'Enter') { e.preventDefault(); kind === 'genre' ? renameGenre(row, e.target.value) : updateStatus(row, e.target.value, MASTER.edit.tone); }
    if (e.key === 'Escape') { e.stopPropagation(); MASTER.edit = null; renderMaster(); }
  });
}
bindMsList('msGenres', 'genre'); bindMsList('msStatuses', 'status');
