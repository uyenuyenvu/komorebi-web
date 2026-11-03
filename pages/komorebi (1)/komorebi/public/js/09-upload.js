// ===================== UPLOAD =====================
let coverFile = null, uploading = false;
const MAX_PAGES = 500;
const PENDING = { new: null, old: null };   // lần đăng đang dở, để bấm lại thì tải tiếp
const UP = { tab: 'new', mangaId: null, act: 'next', chapId: null, origPaths: [], q: '' };

// ---------- Bộ ảnh trang dùng chung cho 2 tab ----------
const SETS = { new: [], old: [] };   // mỗi phần tử: { kind: 'new', file, url } hoặc { kind: 'old', path, url }
const GRID = { new: 'thumbsNew', old: 'thumbsOld' };
let dragFrom = null;

function addPages(set, files) {
  const list = SETS[set];
  const imgs = files.filter(f => f.type.startsWith('image/')).sort((a, b) => viColl.compare(a.name, b.name));
  let skipped = 0;
  imgs.forEach(f => {
    if (list.length >= MAX_PAGES) { skipped++; return; }
    if (!list.some(p => p.kind === 'new' && p.file.name === f.name && p.file.size === f.size)) list.push({ kind: 'new', file: f, url: URL.createObjectURL(f) });
  });
  if (skipped) showToast(`⚠️ Tối đa ${MAX_PAGES} trang, đã bỏ qua ${skipped} ảnh`);
  renderThumbs(set);
}
function clearSet(set) { SETS[set].forEach(p => p.kind === 'new' && URL.revokeObjectURL(p.url)); SETS[set] = []; renderThumbs(set); if (typeof PENDING !== 'undefined') PENDING[set] = null; }
function movePage(set, from, to) {
  const l = SETS[set]; if (to < 0 || to >= l.length || from === to) return;
  const [it] = l.splice(from, 1); l.splice(to, 0, it); renderThumbs(set);
}
function renderThumbs(set) {
  const l = SETS[set], grid = $(GRID[set]);
  const head = document.querySelector(`[data-head="${set}"]`);
  const nNew = l.filter(p => p.kind === 'new').length;
  head.innerHTML = l.length ? `<span>Xem trước thứ tự trang <small>— kéo thả hoặc bấm ◀ ▶ để sắp xếp</small></span><small>${l.length} trang${set === 'old' && nNew && nNew < l.length ? ` · ${nNew} ảnh mới` : ''}</small>` : '';
  grid.innerHTML = l.map((p, i) => `<div class="thumb${p.kind === 'new' && set === 'old' && UP.act === 'edit' ? ' is-new' : ''}${p.busy ? ' is-busy' : ''}${p.err ? ' is-fail' : ''}${p.done && uploading ? ' is-done' : ''}" draggable="true" data-i="${i}" ${p.err ? `title="${esc(p.err)}"` : ''}>
      <img src="${esc(p.url)}" alt="Trang ${i + 1}" loading="lazy">
      <span class="t-num">${i + 1}</span>
      ${p.kind === 'new' && set === 'old' && UP.act === 'edit' ? '<span class="t-new">mới</span>' : ''}
      ${p.busy ? '<span class="t-state">⏳</span>' : p.err ? '<span class="t-state fail">!</span>' : p.done && uploading ? '<span class="t-state ok">✓</span>' : ''}
      <button type="button" class="t-del" data-del="${i}" aria-label="Bỏ trang ${i + 1}">✕</button>
      <div class="t-move"><button type="button" data-mv="-1" data-i="${i}" aria-label="Lùi trang ${i + 1}" ${i === 0 ? 'disabled' : ''}>◀</button><button type="button" data-mv="1" data-i="${i}" aria-label="Tiến trang ${i + 1}" ${i === l.length - 1 ? 'disabled' : ''}>▶</button></div>
    </div>`).join('') + (l.length ? `<label class="thumb-add" title="Thêm ảnh">＋<input type="file" accept="image/*" multiple data-set="${set}" onchange="handlePagesSelect(event)" aria-label="Thêm ảnh"></label>` : '');
}
function updateThumb(set, p) {
  const i = SETS[set].indexOf(p), el = $(GRID[set]).children[i]; if (!el || !el.classList.contains('thumb')) return;
  el.classList.toggle('is-busy', !!p.busy); el.classList.toggle('is-fail', !!p.err); el.classList.toggle('is-done', !!p.done);
  if (p.err) el.title = p.err; else el.removeAttribute('title');
  let st = el.querySelector('.t-state');
  const html = p.busy ? ['', '⏳'] : p.err ? ['fail', '!'] : p.done ? ['ok', '✓'] : null;
  if (!html) { if (st) st.remove(); return; }
  if (!st) { st = document.createElement('span'); el.appendChild(st); }
  st.className = 't-state ' + html[0]; st.textContent = html[1];
}
Object.entries(GRID).forEach(([set, id]) => {
  const g = $(id);
  g.addEventListener('click', e => {
    const d = e.target.closest('[data-del]');
    if (d) { if (uploading) { showToast('⏳ Đợi tải xong rồi hẵng bỏ trang nhé'); return; } const [it] = SETS[set].splice(+d.dataset.del, 1); if (it.kind === 'new') { URL.revokeObjectURL(it.url); if (it.done) sb.storage.from(BUCKET).remove([it.done]).catch(() => {}); } renderThumbs(set); return; }
    const mv = e.target.closest('[data-mv]');
    if (mv) { const i = +mv.dataset.i; movePage(set, i, i + +mv.dataset.mv); }
  });
  g.addEventListener('dragstart', e => { const t = e.target.closest('.thumb'); if (!t) return; dragFrom = { set, i: +t.dataset.i }; t.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'page'); });
  g.addEventListener('dragend', () => { g.querySelectorAll('.dragging,.over').forEach(x => x.classList.remove('dragging', 'over')); dragFrom = null; });
  g.addEventListener('dragover', e => {
    const t = e.target.closest('.thumb');
    if (dragFrom && dragFrom.set === set && t) { e.preventDefault(); g.querySelectorAll('.over').forEach(x => x !== t && x.classList.remove('over')); t.classList.add('over'); }
    else if (!dragFrom && e.dataTransfer.types.includes('Files')) e.preventDefault();
  });
  g.addEventListener('drop', e => {
    e.preventDefault();
    const t = e.target.closest('.thumb');
    if (dragFrom && dragFrom.set === set && t) movePage(set, dragFrom.i, +t.dataset.i);
    else if (!dragFrom && e.dataTransfer.files.length) addPages(set, [...e.dataTransfer.files]);
  });
});
function handlePagesSelect(e) { addPages(e.target.dataset.set, [...e.target.files]); e.target.value = ''; }
function handlePagesDrop(e, el) { e.preventDefault(); handleDragLeave(el); addPages(el.dataset.set, [...e.dataTransfer.files]); }
function handleDragOver(e, el) { e.preventDefault(); el.classList.add('dragover'); }
function handleDragLeave(el) { el.classList.remove('dragover'); }

// ---------- Ảnh & tải lên ----------
const UPLOAD_CONC = 4, PAGE_W = 1600;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const WEBP_OK = (() => { try { const c = document.createElement('canvas'); c.width = c.height = 1; return c.toDataURL('image/webp').startsWith('data:image/webp'); } catch (e) { return false; } })();
function decodeImage(file) {
  if (window.createImageBitmap) return createImageBitmap(file).catch(() => decodeLegacy(file));
  return decodeLegacy(file);
}
function decodeLegacy(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error(`Không đọc được ảnh “${file.name}”${/heic|heif/i.test(file.type + file.name) ? ' (ảnh HEIC của iPhone, hãy đổi sang JPG trước nhé)' : ''}`)); };
    img.src = url;
  });
}
// Trả về { blob, type, ext }: ảnh đã gọn thì giữ nguyên, còn lại thu nhỏ + nén WebP (hoặc JPEG)
async function prepImage(file, maxW, q, force) {
  const bmp = await decodeImage(file);
  const w0 = bmp.width, h0 = bmp.height;
  if (!force && w0 <= maxW && file.size < 600 * 1024 && /image\/(jpeg|webp)/.test(file.type)) {
    if (bmp.close) bmp.close();
    return { blob: file, type: file.type, ext: file.type === 'image/webp' ? 'webp' : 'jpg' };
  }
  const sc = Math.min(1, maxW / w0), w = Math.max(1, Math.round(w0 * sc)), h = Math.max(1, Math.round(h0 * sc));
  const type = force || (WEBP_OK ? 'image/webp' : 'image/jpeg');
  let blob;
  if (window.OffscreenCanvas) {
    const c = new OffscreenCanvas(w, h), x = c.getContext('2d');
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(bmp, 0, 0, w, h);
    blob = await c.convertToBlob({ type, quality: q });
  } else {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); }
    x.drawImage(bmp, 0, 0, w, h);
    blob = await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Không nén được ảnh ' + file.name)), type, q));
  }
  if (bmp.close) bmp.close();
  if (!force && blob.type && blob.type !== type) return prepImage(file, maxW, q, 'image/jpeg');   // trình duyệt không nén được WebP
  if (!force && blob.size > file.size && sc === 1 && /image\/(jpeg|webp)/.test(file.type)) return { blob: file, type: file.type, ext: file.type === 'image/webp' ? 'webp' : 'jpg' };
  return { blob, type: blob.type || type, ext: (blob.type || type) === 'image/webp' ? 'webp' : 'jpg' };
}
async function toJpeg(file, maxW, q) { return (await prepImage(file, maxW, q, 'image/jpeg')).blob; }
function withTimeout(promise, ms) {
  let t; return Promise.race([promise, new Promise((_, rej) => { t = setTimeout(() => rej(new Error('Mạng chậm quá, quá thời gian chờ')), ms); })]).finally(() => clearTimeout(t));
}
async function putFile(path, blob, type) {
  let last;
  for (let a = 0; a < 4; a++) {
    try {
      const { error } = await withTimeout(sb.storage.from(BUCKET).upload(path, blob, { contentType: type || blob.type || 'image/jpeg', upsert: true, cacheControl: '31536000' }), 120000);
      if (!error) return;
      last = error;
      if (/row-level|bucket not found|payload too large|maximum allowed|exceeded|not allowed/i.test(error.message || '')) break;   // lỗi cấu hình: thử lại cũng vô ích
    } catch (e) { last = e; }
    if (a < 3) await sleep(700 * 2 ** a + Math.random() * 400);
  }
  throw last;
}
// Giữ màn hình sáng khi đang tải (điện thoại tắt màn hình là mất kết nối)
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (uploading && document.visibilityState === 'visible') keepAwake(true); });
window.addEventListener('beforeunload', e => { if (uploading) { e.preventDefault(); e.returnValue = ''; } });
const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const fmtEta = s => s < 60 ? `${Math.max(1, Math.round(s))} giây` : `${Math.round(s / 60)} phút`;
const rand = () => Math.random().toString(36).slice(2, 8);
function setProgress(id, pct, text) {
  const box = $(id); box.classList.add('show');
  box.querySelector('.progress-bar-fill').style.width = Math.round(pct) + '%';
  box.querySelector('.progress-label').textContent = text;
}
function hideProgress(id) { setTimeout(() => { $(id).classList.remove('show'); $(id).querySelector('.progress-bar-fill').style.width = '0%'; }, 700); }
function friendlyError(e) {
  const m = String(e && e.message || e || '');
  if (/bucket not found/i.test(m)) return 'Chưa có kho ảnh “komorebi” trên Supabase. Chạy file schema-komorebi.sql nhé.';
  if (/row-level security|violates|unauthorized|not allowed/i.test(m)) return 'Supabase chưa cho phép lưu. Chạy lại file schema-komorebi.sql để tạo quyền nhé.';
  if (/relation|does not exist|schema cache/i.test(m)) return 'Chưa tạo bảng trên Supabase. Chạy file schema-komorebi.sql nhé.';
  if (/payload too large|maximum allowed size|exceeded/i.test(m)) return 'Có ảnh quá nặng, thử ảnh nhỏ hơn nhé.';
  if (/failed to fetch|networkerror|load failed|network/i.test(m)) return 'Mất kết nối mạng giữa chừng.';
  if (/jwt|token.*expired/i.test(m)) return 'Phiên đăng nhập hết hạn, tải lại trang rồi đăng nhập lại nhé.';
  return m || 'Lỗi không rõ';
}
// Tải ảnh của một chương; trả về mảng đường dẫn theo đúng thứ tự trong bộ ảnh
async function uploadSet(set, mangaId, chapId, progId, base, span) {
  const list = SETS[set], fresh = list.filter(p => p.kind === 'new');
  const total = fresh.length; let done = fresh.filter(p => p.done).length, bytes = 0;
  const todo = fresh.filter(p => !p.done); todo.forEach(p => { p.err = null; p.busy = false; });
  const t0 = Date.now(); let next = 0;
  const tick = () => {
    const sec = (Date.now() - t0) / 1000, rate = bytes / Math.max(sec, .5), left = todo.length - (done - (total - todo.length));
    const per = (Date.now() - t0) / Math.max(1, done - (total - todo.length));
    setProgress(progId, base + span * done / Math.max(1, total),
      `Đang tải ${done}/${total} ảnh · ${UPLOAD_CONC} ảnh cùng lúc${bytes ? ` · ${fmtBytes(rate)}/s` : ''}${left > 0 && done > total - todo.length ? ` · còn khoảng ${fmtEta(per * left / UPLOAD_CONC / 1000 * UPLOAD_CONC)}` : ''}`);
  };
  tick();
  async function worker() {
    while (next < todo.length) {
      const p = todo[next++]; p.busy = true; updateThumb(set, p);
      try {
        const img = await prepImage(p.file, PAGE_W, .82);
        const path = `${DB.uid}/${mangaId}/${chapId}/${Date.now()}-${rand()}.${img.ext}`;
        await putFile(path, img.blob, img.type);
        p.done = path; bytes += img.blob.size; done++;
      } catch (e) { p.err = friendlyError(e); console.warn('page', p.file.name, e); }
      p.busy = false; updateThumb(set, p); tick();
    }
  }
  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONC, todo.length) }, worker));
  const failed = fresh.filter(p => !p.done);
  if (failed.length) {
    const err = new Error(`${failed.length}/${total} ảnh chưa tải được (${failed[0].err || 'lỗi mạng'}). Bấm đăng tải lại để thử tiếp, ${done} ảnh đã xong sẽ không phải tải lại.`);
    err.partial = true; throw err;
  }
  return list.map(p => p.kind === 'old' ? p.path : p.done);
}
const parseNum = v => parseFloat(String(v).replace(',', '.'));

// ---------- Chuyển tab & điều hướng ----------
function switchTab(tab) {
  UP.tab = tab;
  document.querySelectorAll('.seg-btn').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('paneNew').hidden = tab !== 'new'; $('paneOld').hidden = tab !== 'old';
  if (STATE.screen === 'upload' && typeof replaceUrl === 'function') replaceUrl();
  if (tab === 'old') renderPickList();
}
document.querySelectorAll('.seg-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
function goUpload() { closeDrawer(); if (!canUpload()) { showToast('🔒 Tài khoản này chỉ có quyền đọc truyện'); return; } showScreen('upload'); switchTab('new'); }
function goUploadExisting(mangaId, act) {
  closeDrawer(); if (!canUpload()) { showToast('🔒 Tài khoản này chỉ có quyền đọc truyện'); return; }
  showScreen('upload'); switchTab('old');
  if (mangaId) { selectManga(mangaId); if (act) setAct(act); }
}

// ---------- Tab 1: tạo truyện mới ----------
const upStatus = makeDrop($('upStatus'), { multi: false, label: 'Tiến độ', allText: 'Chọn tiến độ', value: ['dang'] });
upStatus.setItems(STATUSES.map(s => ({ value: s.id, label: s.name })));
const upGenres = makeDrop($('upGenres'), { label: 'Thể loại', allText: 'Chọn thể loại', onChange: renderChosen });
upGenres.setItems(GENRES.map(g => ({ value: g, label: g })));
function renderChosen() { $('upChosen').innerHTML = upGenres.getValue().map(g => `<span class="m-tag">${esc(g)}</span>`).join(''); }
function setStatus(id) { upStatus.setValue([id]); }
const getStatus = () => upStatus.getValue()[0] || (STATUSES[0] && STATUSES[0].id) || 'dang';
const getGenres = () => upGenres.getValue();
function setGenres(list) { upGenres.setValue(list); renderChosen(); }
function fillTitleList() { if (UP.tab === 'old') renderPickList(); checkExisting(); }

function findExisting(title) { const k = titleKey(title); return k ? DB.manga.find(m => m.title_key === k) : null; }
function checkExisting() {
  const m = findExisting($('title').value), note = $('existingNote');
  if (m && PENDING.new && PENDING.new.inserted && PENDING.new.mangaId === m.id) {
    note.innerHTML = `⏳ Lần đăng <b>${esc(m.title)}</b> trước bị gián đoạn. Bấm “Đăng tải ngay” để tải tiếp các ảnh còn thiếu.`;
    note.classList.add('show'); $('submitNew').disabled = false; return;
  }
  if (m) {
    note.innerHTML = `📚 <b>${esc(m.title)}</b> đã có trên kệ rồi (${m.chapters.length} chương).<br><button type="button" class="link-btn" id="jumpOld">Thêm chương vào truyện này ở tab “Truyện đã có” ❯</button>`;
    note.classList.add('show');
    $('jumpOld').onclick = () => goUploadExisting(m.id, 'next');
  } else note.classList.remove('show');
  $('submitNew').disabled = !!m;
}
$('title').addEventListener('input', checkExisting);

function handleCoverSelect(e) { if (e.target.files[0]) { coverFile = e.target.files[0]; showCoverPreview(URL.createObjectURL(coverFile)); } }
function handleCoverDrop(e) {
  e.preventDefault(); handleDragLeave($('coverDropzone'));
  const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (f) { coverFile = f; showCoverPreview(URL.createObjectURL(f)); }
}
function showCoverPreview(src) {
  const prev = $('coverPreview');
  prev.src = src || ''; prev.style.display = src ? 'block' : 'none';
  $('coverIcon').style.display = src ? 'none' : ''; $('coverText').style.display = src ? 'none' : '';
}
function resetNewForm() {
  ['title', 'author', 'translator', 'release', 'desc', 'chapNum', 'chapTitle'].forEach(id => $(id).value = '');
  setStatus('dang'); setGenres([]); coverFile = null; showCoverPreview(null); clearSet('new'); checkExisting();
}

async function publishNew() {
  if (uploading) return;
  const title = $('title').value.trim().replace(/\s+/g, ' ');
  if (!title) { showToast('⚠️ Nhập tên truyện trước nhé'); $('title').focus(); return; }
  if (findExisting(title) && !(PENDING.new && PENDING.new.inserted)) { checkExisting(); return; }
  if (!$('author').value.trim()) { showToast('⚠️ Nhập tên tác giả nhé'); $('author').focus(); return; }
  const rawNum = $('chapNum').value.trim(), ct = $('chapTitle').value.trim() || null;
  const withChap = !!(SETS.new.length || rawNum || ct);          // không nhập gì ở phần chương thì chỉ tạo truyện
  const num = rawNum ? parseNum(rawNum) : 1;
  if (!isFinite(num) || num < 0) { showToast('⚠️ Số chương chưa hợp lệ'); $('chapNum').focus(); return; }
  uploading = true; $('submitNew').disabled = true; keepAwake(true);
  try {
    if (!PENDING.new) PENDING.new = { mangaId: crypto.randomUUID(), chapId: crypto.randomUUID(), coverFile: null, coverPath: null, inserted: false };
    const P = PENDING.new;
    if (coverFile && P.coverFile !== coverFile) {
      setProgress('progNew', 4, 'Đang lưu ảnh bìa…');
      const path = `${DB.uid}/${P.mangaId}/cover-${Date.now()}.jpg`;
      await putFile(path, await toJpeg(coverFile, 700, .86), 'image/jpeg');
      if (P.coverPath) sb.storage.from(BUCKET).remove([P.coverPath]).catch(() => {});
      P.coverPath = path; P.coverFile = coverFile;
    } else if (!coverFile && P.coverPath) { sb.storage.from(BUCKET).remove([P.coverPath]).catch(() => {}); P.coverPath = null; P.coverFile = null; }
    const paths = await uploadSet('new', P.mangaId, P.chapId, 'progNew', 10, 84);
    if (paths.length) {
      setProgress('progNew', 95, '👀 Ảnh đã tải xong, kiểm tra thứ tự trang nhé');
      uploading = false; keepAwake(false);
      const ok = await confirmPreview({ heading: title, chapter: `Chương ${fmtNum(num)}${ct ? ': ' + ct : ''}`, set: 'new', cover: coverFile ? $('coverPreview').src : null });
      if (!ok) { backToEdit('new', 'progNew'); return; }
      uploading = true;
    }
    setProgress('progNew', 98, 'Đang đăng truyện lên kệ…');
    if (!P.inserted) {
      const row = { id: P.mangaId, title, title_key: titleKey(title), author: $('author').value.trim(), translator: $('translator').value.trim() || null,
        release_date: $('release').value || null, status: getStatus(), genres: getGenres(), description: $('desc').value.trim() || null, cover_path: P.coverPath };
      const { error } = await sb.from('manga').insert(row);
      if (error) { if (error.code === '23505') throw new Error('Truyện này đã có trên kệ, dùng tab “Truyện đã có” nhé'); throw error; }
      P.inserted = true;
    }
    if (withChap) {
      const ins = await sb.from('chapters').insert({ id: P.chapId, manga_id: P.mangaId, number: num, title: ct, pages: paths });
      if (ins.error) throw ins.error;
    }
    setProgress('progNew', 100, '✅ Đăng tải thành công!');
    showToast(withChap ? '🎉 Đã thêm truyện mới vào thư viện!' : '🎉 Đã tạo truyện mới, chương thêm sau cũng được nhé');
    const id = P.mangaId;
    PENDING.new = null; resetNewForm(); hideProgress('progNew');
    await loadLibrary(); resetUploadScreen(); ROUTE.replaceNext = true; openDetail(id);
  } catch (e) {
    console.warn('publishNew', e);
    setProgress('progNew', e.partial ? parseFloat($('progNew').querySelector('.progress-bar-fill').style.width) || 0 : 0, '❌ ' + friendlyError(e));
    showToast(e.partial ? '⏳ Còn vài ảnh chưa tải được, bấm đăng tải lại để tiếp tục' : '🥲 Chưa đăng tải được: ' + friendlyError(e));
    if (PENDING.new && PENDING.new.inserted) loadLibrary();
  } finally { uploading = false; keepAwake(false); $('submitNew').disabled = false; checkExisting(); }
}

// ---------- Tab 2: truyện đã có ----------
const relTime = d => {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return days <= 0 ? 'hôm nay' : days === 1 ? 'hôm qua' : days < 30 ? `${days} ngày trước` : fmtDate(d);
};
function renderPickList() {
  const q = fold(UP.q.trim());
  const list = DB.manga.filter(m => !q || fold(m.title + ' ' + (m.author || '')).includes(q));
  const box = $('pickList');
  if (!DB.loaded) { box.innerHTML = '<p class="pick-none">Đang mở kệ sách… 🍃</p>'; return; }
  if (!DB.manga.length) { box.innerHTML = '<div class="pick-none">Kệ còn trống.<br><button type="button" class="btn-submit secondary" onclick="switchTab(\'new\')">✨ Tạo truyện đầu tiên</button></div>'; return; }
  if (!list.length) { box.innerHTML = '<p class="pick-none">Không có truyện nào khớp 🍃</p>'; return; }
  box.innerHTML = list.map(m => {
    const st = statusOf(m.status), last = m.chapters[m.chapters.length - 1];
    return `<button type="button" class="pick-item" role="option" data-id="${m.id}" aria-selected="${m.id === UP.mangaId}">
      ${coverHTML(m, true)}
      <span style="min-width:0"><span class="pick-name">${highlight(m.title, UP.q)}</span>
      <span class="pick-meta">${last ? 'Ch.' + fmtNum(last.number) : 'Chưa có chương'} · <span class="status ${st.cls}">${esc(st.name)}</span></span></span>
    </button>`;
  }).join('');
}
$('pickSearch').addEventListener('input', e => { UP.q = e.target.value; renderPickList(); });
$('pickList').addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  selectManga(b.dataset.id);
  if (matchMedia('(max-width: 860px)').matches) $('oldRight').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
const curManga = () => DB.manga.find(m => m.id === UP.mangaId);
const nextNum = m => { const last = m.chapters[m.chapters.length - 1]; return last ? Math.floor(+last.number) + 1 : 1; };

function selectManga(id) {
  if (UP.mangaId !== id) { clearSet('old'); UP.chapId = null; UP.origPaths = []; }
  UP.mangaId = id;
  const m = curManga(); if (!m) return;
  renderPickList();
  $('oldEmpty').hidden = true; $('oldFlow').hidden = false;
  const last = m.chapters[m.chapters.length - 1];
  $('pickedInfo').innerHTML = `${coverHTML(m, true)}<span><b>${esc(m.title)}</b><small>${esc(m.author || 'Chưa rõ tác giả')} · ${m.chapters.length} chương</small></span><button type="button" class="link-btn" onclick="openDetail('${m.id}')">Xem truyện</button>`;
  $('actNextHint').textContent = last ? `Tự điền số chương ${fmtNum(nextNum(m))}, tiếp nối Ch.${fmtNum(last.number)}` : 'Truyện chưa có chương nào, bắt đầu từ chương 1';
  document.querySelector('.act-card[data-act="edit"]').disabled = !m.chapters.length;
  setAct(UP.act === 'info' ? 'info' : (UP.act === 'edit' && m.chapters.length ? 'edit' : 'next'), true);
}
function setAct(act, keep) {
  const m = curManga(); if (!m) return;
  if (act === 'edit' && !m.chapters.length) act = 'next';
  const changed = UP.act !== act; UP.act = act;
  document.querySelectorAll('.act-card').forEach(b => b.setAttribute('aria-pressed', b.dataset.act === act));
  $('chapPicker').hidden = act !== 'edit';
  $('infoForm').hidden = act !== 'info';
  $('delChap').hidden = !(act === 'edit' && UP.chapId);
  if (act === 'info') { $('step3').hidden = true; if (changed || !keep) fillInfoForm(); return; }
  if (act === 'next') {
    if (changed || !keep) { clearSet('old'); UP.chapId = null; UP.origPaths = []; }
    $('oldNum').value = fmtNum(nextNum(m)).replace(',', '.'); $('oldNum').placeholder = fmtNum(nextNum(m)).replace(',', '.');
    if (changed || !keep) $('oldTitle').value = '';
    $('step3').hidden = false; $('step3Title').textContent = 'Upload ảnh chương mới';
    $('submitOld').innerHTML = '🚀 Xuất bản ngay';
  } else {
    if (changed) { clearSet('old'); UP.chapId = null; UP.origPaths = []; }
    renderChapPick();
    $('step3').hidden = !UP.chapId; $('step3Title').textContent = 'Sửa ảnh chương';
    $('submitOld').innerHTML = '💾 Lưu thay đổi';
  }
  renderThumbs('old');
}
document.querySelectorAll('.act-card').forEach(b => b.addEventListener('click', () => setAct(b.dataset.act)));
function renderChapPick() {
  const m = curManga();
  $('chapPick').innerHTML = m.chapters.slice().reverse().map(c => `<button type="button" class="cp-item" data-ch="${c.id}" aria-pressed="${c.id === UP.chapId}">
      <span class="cp-num">Ch.${fmtNum(c.number)}</span><span class="cp-name">${esc(c.title || '—')}</span><span class="cp-date">${relTime(c.created_at)}</span></button>`).join('');
}
$('chapPick').addEventListener('click', async e => {
  const b = e.target.closest('[data-ch]'); if (!b) return;
  const m = curManga(), c = m.chapters.find(x => x.id === b.dataset.ch); if (!c) return;
  UP.chapId = c.id; renderChapPick(); $('delChap').hidden = false;
  $('oldNum').value = String(+c.number); $('oldTitle').value = c.title || '';
  $('step3').hidden = false;
  clearSet('old');
  $('thumbsOld').innerHTML = '<p class="pick-none" style="grid-column:1/-1">Đang lấy ảnh của chương… 🍃</p>';
  try {
    const { data, error } = await sb.from('chapters').select('pages').eq('id', c.id).single();
    if (error) throw error;
    const paths = data.pages || [], urls = await signedUrls(paths);
    if (UP.chapId !== c.id) return;
    UP.origPaths = paths.slice();
    SETS.old = paths.map((p, i) => ({ kind: 'old', path: p, url: urls[i] }));
    renderThumbs('old');
    $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { $('thumbsOld').innerHTML = `<p class="pick-none" style="grid-column:1/-1">Chưa lấy được ảnh 🥲 ${esc(err.message || '')}</p>`; }
});

async function publishOld() {
  if (uploading) return;
  const m = curManga(); if (!m) { showToast('⚠️ Chọn truyện trước nhé'); return; }
  const editing = UP.act === 'edit';
  const rawNum = $('oldNum').value.trim();
  const num = rawNum ? parseNum(rawNum) : (editing ? +((m.chapters.find(c => c.id === UP.chapId) || {}).number || 1) : nextNum(m));
  if (!isFinite(num) || num < 0) { showToast('⚠️ Số chương chưa hợp lệ'); $('oldNum').focus(); return; }
  if (editing && !UP.chapId) { showToast('⚠️ Chọn chương cần sửa nhé'); return; }
  if (m.chapters.some(c => +c.number === num && c.id !== (editing ? UP.chapId : null))) { showToast(`⚠️ Chương ${fmtNum(num)} đã có rồi`); $('oldNum').focus(); return; }
  uploading = true; $('submitOld').disabled = true; keepAwake(true);
  const title = $('oldTitle').value.trim() || null;
  try {
    if (!editing && !(PENDING.old && PENDING.old.mangaId === m.id)) PENDING.old = { mangaId: m.id, chapId: crypto.randomUUID() };
    const chapId = editing ? UP.chapId : PENDING.old.chapId;
    setProgress('progOld', 3, 'Đang chuẩn bị…');
    const paths = await uploadSet('old', m.id, chapId, 'progOld', 5, 85);
    if (paths.length) {
      setProgress('progOld', 95, '👀 Ảnh đã tải xong, kiểm tra thứ tự trang nhé');
      uploading = false; keepAwake(false);
      const ok = await confirmPreview({ heading: m.title, chapter: `Chương ${fmtNum(num)}${title ? ': ' + title : ''}`, set: 'old', editing, cover: coverUrl(m) || null });
      if (!ok) { backToEdit('old', 'progOld'); return; }
      uploading = true;
    }
    setProgress('progOld', 98, editing ? 'Đang lưu chương…' : 'Đang đăng chương…');
    if (editing) {
      const { error } = await sb.from('chapters').update({ number: num, title, pages: paths }).eq('id', chapId);
      if (error) throw error;
      const removed = UP.origPaths.filter(p => !paths.includes(p));
      if (removed.length) { try { await sb.storage.from(BUCKET).remove(removed); } catch (e) { console.warn('cleanup', e); } }
    } else {
      const { error } = await sb.from('chapters').insert({ id: chapId, manga_id: m.id, number: num, title, pages: paths });
      if (error) { if (error.code === '23505') throw new Error(`Chương ${fmtNum(num)} đã có rồi`); throw error; }
    }
    await sb.from('manga').update({ updated_at: new Date().toISOString() }).eq('id', m.id);
    setProgress('progOld', 100, editing ? '✅ Đã lưu thay đổi!' : '✅ Đã xuất bản chương mới!');
    showToast(editing ? `💾 Đã cập nhật chương ${fmtNum(num)}` : `🎉 Đã thêm chương ${fmtNum(num)}!`);
    hideProgress('progOld');
    PENDING.old = null; clearSet('old'); UP.chapId = null; UP.origPaths = [];
    await loadLibrary(); resetUploadScreen(); ROUTE.replaceNext = true;
    openChapter(m.id, chapId);
  } catch (e) {
    console.warn('publishOld', e);
    setProgress('progOld', e.partial ? parseFloat($('progOld').querySelector('.progress-bar-fill').style.width) || 0 : 0, '❌ ' + friendlyError(e));
    showToast(e.partial ? '⏳ Còn vài ảnh chưa tải được, bấm lại để tải tiếp' : '🥲 Chưa lưu được: ' + friendlyError(e));
  } finally { uploading = false; keepAwake(false); $('submitOld').disabled = false; }
}
