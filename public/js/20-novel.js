// ===================== TIỂU THUYẾT (truyện chữ) =====================
// Nội dung chương được lưu dạng chữ có đánh dấu đơn giản (không lưu HTML thô để không ai chèn được mã lạ):
//   đoạn văn cách nhau 1 dòng trống · dòng "***" là ngắt cảnh · đoạn bắt đầu bằng "> " là đoạn trích
//   **đậm** · *nghiêng* · __gạch chân__
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isNovel = m => !!m && m.kind === 'novel';
const KIND_LABEL = { comic: '🖼️ Truyện tranh', novel: '📖 Tiểu thuyết' };
const kindTag = m => `<span class="kind-tag ${isNovel(m) ? 'novel' : 'comic'}">${KIND_LABEL[isNovel(m) ? 'novel' : 'comic']}</span>`;

// ---------- đánh dấu ⇄ HTML ----------
function inlineHtml(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>').replace(/\*(?!\s)(.+?)\*/g, '<i>$1</i>');
}
function markupToHtml(src) {
  return String(src || '').replace(/\r/g, '').split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => {
    if (/^(\*\s*){3,}$/.test(p) || /^✱/.test(p)) return '<p class="scene">✱ ✱ ✱</p>';
    if (/^>\s?/.test(p)) return `<blockquote>${p.split('\n').map(l => inlineHtml(l.replace(/^>\s?/, ''))).join('<br>')}</blockquote>`;
    return `<p>${p.split('\n').map(inlineHtml).join('<br>')}</p>`;
  }).join('');
}
function inlineMarkup(n) {
  if (n.nodeType === 3) return n.nodeValue.replace(/\u00a0/g, ' ').replace(/[ \t]*\n[ \t]*/g, ' ');
  if (n.nodeType !== 1) return '';
  const tag = n.tagName; if (tag === 'BR') return '\n';
  if (/^(SCRIPT|STYLE|META|LINK|TITLE)$/.test(tag)) return '';
  let inner = [...n.childNodes].map(inlineMarkup).join('');
  const st = (n.getAttribute('style') || '').toLowerCase();
  if (!inner.trim()) return inner;
  const lead = inner.match(/^\s*/)[0], trail = inner.match(/\s*$/)[0]; inner = inner.trim();
  if (tag === 'U' || /text-decoration[^;]*underline/.test(st)) inner = `__${inner}__`;
  if (tag === 'I' || tag === 'EM' || /font-style:\s*italic/.test(st)) inner = `*${inner}*`;
  if (tag === 'B' || tag === 'STRONG' || /font-weight:\s*(bold|[6-9]00)/.test(st)) inner = `**${inner}**`;
  return lead + inner + trail;
}
const BLOCK = /^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|SECTION|ARTICLE|TABLE|TR|UL|OL)$/;
function domToMarkup(root) {
  const blocks = []; let buf = '';
  const flush = () => { const t = buf.replace(/[ \t]+/g, ' ').trim(); if (t) t.split(/\n{2,}/).forEach(x => blocks.push(x.trim())); buf = ''; };
  const walk = node => {
    for (const n of node.childNodes) {
      if (n.nodeType === 1 && BLOCK.test(n.tagName)) {
        flush();
        if (n.classList.contains('scene') || /^(\*\s*){3,}$|^✱/.test(n.textContent.trim())) { blocks.push('***'); continue; }
        if ([...n.children].some(c => BLOCK.test(c.tagName))) { walk(n); flush(); continue; }
        const t = inlineMarkup(n).split('\n').map(l => l.replace(/\s+/g, ' ').trim()).join('\n').trim();
        if (t) blocks.push(n.tagName === 'BLOCKQUOTE' ? t.split('\n').map(l => '> ' + l).join('\n') : t);
      } else buf += inlineMarkup(n);
    }
    flush();
  };
  walk(root);
  return blocks.join('\n\n');
}
function plainToMarkup(text) {   // chữ thường (dán / file .txt): có dòng trống thì theo dòng trống, không thì mỗi dòng một đoạn
  const t = String(text || '').replace(/\r/g, '').replace(/\u00a0/g, ' ');
  const paras = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n');
  return paras.map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).join('\n\n');
}
const htmlToMarkup = html => domToMarkup(new DOMParser().parseFromString(html, 'text/html').body);

// ---------- trình soạn chương chữ ----------
const EDITORS = {};
let mammothLoading = null;
function loadMammoth() {   // thư viện đọc file Word, chỉ tải khi cần
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothLoading) mammothLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js'; s.onload = () => res(window.mammoth); s.onerror = () => { mammothLoading = null; rej(new Error('Không tải được bộ đọc file Word')); }; document.head.appendChild(s); });
  return mammothLoading;
}
function mountEditor(boxId) {
  const box = $(boxId);
  box.innerHTML = `<span class="field-label">Nội dung chương</span>
    <div class="n-editor">
      <div class="ne-bar" role="toolbar" aria-label="Định dạng chữ">
        <button type="button" data-cmd="bold" title="In đậm (Ctrl+B)"><b>B</b></button>
        <button type="button" data-cmd="italic" title="In nghiêng (Ctrl+I)"><i>I</i></button>
        <button type="button" data-cmd="underline" title="Gạch chân (Ctrl+U)"><u>U</u></button>
        <span class="sep"></span>
        <button type="button" data-cmd="quote" title="Đoạn trích / thư / lời dẫn">❝ Trích</button>
        <button type="button" data-cmd="scene" title="Chèn dấu ngắt cảnh">✱✱✱ Ngắt cảnh</button>
        <span class="sep"></span>
        <button type="button" data-cmd="undo" title="Hoàn tác (Ctrl+Z)">↶</button>
        <button type="button" data-cmd="redo" title="Làm lại (Ctrl+Y)">↷</button>
        <span class="sep"></span>
        <label title="Nhập nội dung từ file .txt hoặc Word (.docx)">📄 Nhập .txt / .docx<input type="file" accept=".txt,.md,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden></label>
        <button type="button" data-cmd="clean" title="Bỏ màu chữ, cỡ chữ lạ khi dán từ Word hay web, chỉ giữ đậm / nghiêng / xuống dòng">🧹 Dọn định dạng</button>
        <span class="grow"></span>
        <button type="button" data-cmd="preview" aria-pressed="false" title="Xem như người đọc">👀 Xem trước</button>
      </div>
      <div class="ne-area" contenteditable="true" spellcheck="false" data-ph="Gõ hoặc dán nội dung chương vào đây… Mỗi lần Enter là một đoạn mới."></div>
      <div class="ne-preview" hidden></div>
      <div class="ne-status"><span class="ne-count"></span><span class="ne-draft"></span></div>
    </div>
    <p class="ne-hint">Dán từ Word, Google Docs hay trang web đều được: web tự bỏ màu chữ, cỡ chữ lạ, chỉ giữ đậm, nghiêng, gạch chân và các đoạn.</p>`;
  const area = box.querySelector('.ne-area'), prev = box.querySelector('.ne-preview');
  const ed = { box, area, key: null, timer: null,
    get: () => domToMarkup(area),
    set(markup) { area.innerHTML = markupToHtml(markup); ed.count(); },
    clear() { area.innerHTML = ''; ed.count(); },
    count() { const n = area.querySelectorAll('p:not(.scene), blockquote').length || (area.textContent.trim() ? 1 : 0); box.querySelector('.ne-count').textContent = `✍️ ${n} đoạn`; },
    // bản nháp tự lưu trên máy, phòng khi lỡ tắt trình duyệt
    useDraft(key, fallback) {
      ed.key = key; let d = null;
      try { d = JSON.parse(localStorage.getItem('komorebi.draft.' + key) || 'null'); } catch (e) {}
      const st = box.querySelector('.ne-draft');
      if (d && d.text && d.text !== (fallback || '')) {
        ed.set(fallback || '');
        st.innerHTML = `📝 Có bản nháp chưa đăng lúc ${new Date(d.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })} · <button type="button" data-draft="use">Mở bản nháp</button> · <button type="button" data-draft="drop">Bỏ</button>`;
        ed.pending = d.text;
      } else { ed.set(fallback || ''); st.textContent = ''; ed.pending = null; }
    },
    saveDraft() {
      if (!ed.key) return;
      const text = ed.get();
      try { if (text) localStorage.setItem('komorebi.draft.' + ed.key, JSON.stringify({ text, at: Date.now() })); else localStorage.removeItem('komorebi.draft.' + ed.key); } catch (e) {}
      box.querySelector('.ne-draft').textContent = text ? `💾 Đã lưu nháp trên máy lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` : '';
    },
    dropDraft(key) { try { localStorage.removeItem('komorebi.draft.' + (key || ed.key)); } catch (e) {} }
  };
  area.addEventListener('focus', () => { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {} });
  area.addEventListener('input', () => {
    if (area.childNodes.length && [...area.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) {   // chữ gõ ở ngoài đoạn → bọc vào đoạn
      try { document.execCommand('formatBlock', false, 'p'); } catch (e) {}
    }
    ed.count(); clearTimeout(ed.timer); ed.timer = setTimeout(ed.saveDraft, 700);
  });
  area.addEventListener('paste', e => {
    e.preventDefault();
    const cd = e.clipboardData, html = cd.getData('text/html'), text = cd.getData('text/plain');
    const md = html ? htmlToMarkup(html) : plainToMarkup(text);
    if (md) document.execCommand('insertHTML', false, markupToHtml(md));
    ed.count(); ed.saveDraft();
  });
  box.querySelector('.ne-bar').addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });   // giữ con trỏ trong vùng soạn
  box.querySelector('.ne-bar').addEventListener('click', e => {
    const b = e.target.closest('[data-cmd]'); if (!b) return;
    const c = b.dataset.cmd;
    if (c === 'preview') {
      const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on);
      prev.innerHTML = markupToHtml(ed.get()) || '<p style="text-align:center;text-indent:0;color:var(--mau-nau-nhat)">Chưa có nội dung</p>';
      prev.hidden = !on; area.hidden = on; return;
    }
    area.focus();
    if (c === 'bold' || c === 'italic' || c === 'underline' || c === 'undo' || c === 'redo') document.execCommand(c);
    else if (c === 'quote') { const inQ = document.queryCommandValue('formatBlock').toLowerCase() === 'blockquote'; document.execCommand('formatBlock', false, inQ ? 'p' : 'blockquote'); }
    else if (c === 'scene') document.execCommand('insertHTML', false, '<p class="scene">✱ ✱ ✱</p><p><br></p>');
    else if (c === 'clean') { ed.set(ed.get()); showToast('🧹 Đã dọn định dạng thừa'); }
    ed.count(); ed.saveDraft();
  });
  box.querySelector('.ne-draft').addEventListener('click', e => {
    const b = e.target.closest('[data-draft]'); if (!b) return;
    if (b.dataset.draft === 'use' && ed.pending) { ed.set(ed.pending); showToast('📝 Đã mở bản nháp'); }
    else ed.dropDraft();
    ed.pending = null; box.querySelector('.ne-draft').textContent = '';
  });
  box.querySelector('input[type=file]').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      let md;
      if (/\.docx$/i.test(f.name)) {
        showToast('📄 Đang đọc file Word…');
        const mm = await loadMammoth(), r = await mm.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
        md = htmlToMarkup(r.value);
      } else md = plainToMarkup(await f.text());
      if (!md) { showToast('⚠️ File không có nội dung chữ'); return; }
      if (ed.get() && !confirm('Thay nội dung đang soạn bằng nội dung trong file?')) return;
      ed.set(md); ed.saveDraft(); showToast(`📄 Đã nhập “${f.name}”`);
    } catch (err) { showToast('🥲 ' + (err.message || 'Không đọc được file')); }
  });
  EDITORS[boxId] = ed; ed.count();
  return ed;
}

// ---------- tạo truyện mới: chọn loại ----------
const NOVEL = { newKind: 'comic' };
function setNewKind(kind) {
  NOVEL.newKind = kind;
  document.querySelectorAll('#kindPick .kp').forEach(b => b.setAttribute('aria-checked', b.dataset.kind === kind));
  const nov = kind === 'novel';
  $('newNovelBox').hidden = !nov; $('newComicBox').hidden = nov;
  if (nov && !EDITORS.newNovelBox) mountEditor('newNovelBox').useDraft('new', '');
}
$('kindPick').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (b && !b.disabled) setNewKind(b.dataset.kind); });

// ---------- truyện đã có: đổi khung theo loại truyện ----------
function syncOldKind() {
  const m = curManga(); if (!m) return;
  const nov = isNovel(m);
  $('oldNovelBox').hidden = !nov; $('oldComicBox').hidden = nov;
  if (!nov) return;
  const ed = EDITORS.oldNovelBox || mountEditor('oldNovelBox');
  if (UP.act === 'next') { $('step3Title').textContent = 'Soạn chương mới'; ed.useDraft(`old-${m.id}-next`, ''); }
  else if (UP.act === 'edit') { $('step3Title').textContent = 'Sửa nội dung chương'; if (!UP.chapId) ed.clear(); }
}
async function loadNovelChapterForEdit(m, c) {
  const ed = EDITORS.oldNovelBox || mountEditor('oldNovelBox');
  ed.clear(); ed.area.setAttribute('data-ph', 'Đang lấy nội dung chương… 🍃');
  try {
    const { data, error } = await sb.from('chapters').select('content').eq('id', c.id).single();
    if (error) throw error;
    if (UP.chapId !== c.id) return;
    ed.useDraft(`old-${m.id}-${c.id}`, data.content || '');
    $('step3').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { showToast('🥲 Chưa lấy được nội dung chương: ' + (err.message || '')); }
  finally { ed.area.setAttribute('data-ph', 'Gõ hoặc dán nội dung chương vào đây… Mỗi lần Enter là một đoạn mới.'); }
}

// ---------- trang chủ: mục tiểu thuyết ----------
function novelCard(m) {
  const last = m.chapters[m.chapters.length - 1];
  return `<button type="button" class="n-card" data-id="${m.id}" aria-label="${esc(m.title)}">${coverHTML(m, true)}
    <span><h4>${esc(m.title)}</h4><span class="n-tags">${kindTag(m)}<span class="n-chip">${last ? 'Chương ' + fmtNum(last.number) : 'Chưa có chương'}</span></span>
    <span class="excerpt">${m.description ? '“' + esc(m.description) + '”' : '<i style="opacity:.7">Chưa có mô tả</i>'}</span>
    <span class="n-meta"><span>✍️ ${esc(m.author || 'Chưa rõ')}</span><span>🕒 ${relTimeShort(m.updated_at)}</span></span></span></button>`;
}
function renderHomeNovels() {
  const list = DB.manga.filter(isNovel).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  $('secNovel').hidden = !list.length;
  $('homeNovels').innerHTML = list.slice(0, 6).map(novelCard).join('');
}
$('homeNovels').addEventListener('click', e => { const c = e.target.closest('[data-id]'); if (c) openDetail(c.dataset.id); });
function openLibraryKind(kind) { resetLibrary(); LIB.kind = kind; showScreen('library'); renderLibrary(); }

// ---------- thư viện: chọn loại ----------
$('kindSeg').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; LIB.kind = b.dataset.k; LIB.page = 1; renderLibrary(); });
function syncKindSeg() {
  const all = DB.manga.length, nov = DB.manga.filter(isNovel).length;
  $('kAll').textContent = all || ''; $('kComic').textContent = (all - nov) || ''; $('kNovel').textContent = nov || '';
  $('kindSeg').querySelectorAll('[data-k]').forEach(b => b.setAttribute('aria-pressed', b.dataset.k === (LIB.kind || 'all')));
}

// ---------- trang đọc tiểu thuyết ----------
const NBG = { kem: ['#FFFDF8', '#4a3f36'], trang: ['#ffffff', '#2f2a26'], sepia: ['#F1E4C8', '#5b4630'], dem: ['#23251F', '#DED6C6'] };
const NFONT = { serif: "'EB Garamond', serif", sans: 'var(--font-sans)', hand: "'Patrick Hand', cursive" };
let NPREF = { size: 20, font: 'serif', line: 1.85, w: 860, bg: 'kem', justify: false };
try { NPREF = Object.assign(NPREF, JSON.parse(localStorage.getItem('komorebi.novelPrefs') || '{}')); } catch (e) {}
// nền đêm khi web đang ở giao diện tối
if (!localStorage.getItem('komorebi.novelPrefs') && document.documentElement.getAttribute('data-theme') === 'dark') NPREF.bg = 'dem';
function applyNovelPrefs() {
  const r = document.documentElement.style, [bg, ink] = NBG[NPREF.bg] || NBG.kem;
  r.setProperty('--n-size', NPREF.size + 'px'); r.setProperty('--n-line', NPREF.line); r.setProperty('--n-font', NFONT[NPREF.font] || NFONT.serif);
  r.setProperty('--n-w', NPREF.w + 'px'); r.setProperty('--n-bg', bg); r.setProperty('--n-ink', ink);
  $('novelPaper').classList.toggle('justify', !!NPREF.justify);
  $('nSizeVal').textContent = NPREF.size + 'px'; $('nJustify').checked = !!NPREF.justify;
  const mark = (sel, key, val) => document.querySelectorAll(sel).forEach(b => b.setAttribute('aria-pressed', String(b.dataset[key]) === String(val)));
  mark('[data-nfont]', 'nfont', NPREF.font); mark('[data-nline]', 'nline', NPREF.line); mark('[data-nw]', 'nw', NPREF.w); mark('[data-nbg]', 'nbg', NPREF.bg);
  try { localStorage.setItem('komorebi.novelPrefs', JSON.stringify(NPREF)); } catch (e) {}
}
$('rpNovel').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const pos = novelPos();
  if (b.dataset.nsize) NPREF.size = clamp(NPREF.size + +b.dataset.nsize, 14, 34);
  if (b.dataset.nfont) NPREF.font = b.dataset.nfont;
  if (b.dataset.nline) NPREF.line = +b.dataset.nline;
  if (b.dataset.nw) NPREF.w = +b.dataset.nw;
  if (b.dataset.nbg) NPREF.bg = b.dataset.nbg;
  applyNovelPrefs(); if (b.dataset.nsize || b.dataset.nfont || b.dataset.nline || b.dataset.nw) requestAnimationFrame(() => goNovelPos(pos));
});
$('nJustify').addEventListener('change', e => { NPREF.justify = e.target.checked; applyNovelPrefs(); });

const NREAD = { on: false, mangaId: null, chapterId: null, saveT: null, lastSaved: 0 };
function setNovelMode(on) {
  NREAD.on = on;
  $('readerMain').classList.toggle('novel', on);
  $('viewerWrap').hidden = on; $('novelPaper').hidden = !on;
  $('rpNovel').hidden = !on; $('rpComic').hidden = on;
  $('rpTitle').textContent = on ? '📖 Cài đặt đọc' : '📖 Bố cục truyện';
  $('readSetBtn').title = on ? 'Cài đặt đọc' : 'Bố cục truyện'; $('readSetBtn').setAttribute('aria-label', $('readSetBtn').title);
  document.documentElement.classList.toggle('reading-novel', on && STATE.screen === 'reader');
  if (on) applyNovelPrefs(); else $('nProgress').firstElementChild.style.width = '0';
}
// vị trí đọc trong chương: 0 = đầu chương, 1 = hết chương
function novelPos() {
  const p = $('novelPaper'); if (!NREAD.on || p.hidden) return 0;
  const top = p.getBoundingClientRect().top + scrollY, h = Math.max(1, p.offsetHeight - innerHeight * .5);
  return clamp((scrollY + innerHeight * .25 - top) / h, 0, 1);
}
function goNovelPos(pos) {
  const p = $('novelPaper'); if (!pos || pos < .01) return;
  const top = p.getBoundingClientRect().top + scrollY, h = Math.max(1, p.offsetHeight - innerHeight * .5);
  window.scrollTo({ top: Math.max(0, top + pos * h - innerHeight * .25) });
}
function renderNovel(content, m, c, startPos) {
  setNovelMode(true);
  NREAD.mangaId = m.id; NREAD.chapterId = c.id;
  const html = markupToHtml(content);
  $('novelPaper').innerHTML = html || '<p class="n-empty">Chương này chưa có nội dung.</p>';
  requestAnimationFrame(() => { if (startPos > .01) { goNovelPos(startPos); showToast('🔖 Đã mở lại đúng đoạn cưng đang đọc dở'); } updateNovelProgress(); });
}
function updateNovelProgress() { if (!NREAD.on) return; $('nProgress').firstElementChild.style.width = (novelPos() * 100).toFixed(1) + '%'; }
// lưu chỗ đọc dở (trên máy ngay lập tức, lên máy chủ vài giây một lần)
function saveNovelPos(force) {
  if (!NREAD.on || STATE.screen !== 'reader') return;
  const pos = Math.round(novelPos() * 1000) / 1000;
  try { localStorage.setItem('komorebi.pos.' + NREAD.chapterId, String(pos)); } catch (e) {}
  const h = ME.hist.find(x => x.manga_id === NREAD.mangaId && x.chapter_id === NREAD.chapterId); if (h) h.position = pos;
  clearTimeout(NREAD.saveT);
  const push = () => { if (!DB.hasNovel || !h) return; NREAD.lastSaved = Date.now(); sb.from('reading_history').update({ position: pos }).eq('user_id', DB.uid).eq('manga_id', NREAD.mangaId).then(r => { if (r.error) console.warn('pos', r.error); }); };
  if (force || Date.now() - NREAD.lastSaved > 5000) push(); else NREAD.saveT = setTimeout(push, 2500);
}
function savedPosOf(m, c) {
  let pos = 0; try { pos = +localStorage.getItem('komorebi.pos.' + c.id) || 0; } catch (e) {}
  const h = ME.hist.find(x => x.manga_id === m.id && x.chapter_id === c.id);
  if (h && h.position && !pos) pos = +h.position;
  return pos >= .97 ? 0 : pos;   // đọc hết rồi thì mở lại từ đầu
}
addEventListener('scroll', () => { if (!NREAD.on) return; updateNovelProgress(); saveNovelPos(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNovelPos(true); });
addEventListener('pagehide', () => saveNovelPos(true));
