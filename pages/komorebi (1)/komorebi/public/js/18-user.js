// ===================== NGƯỜI DÙNG: hồ sơ · yêu thích · lịch sử · thông báo =====================
const ME = { role: 'uploader', email: '', profile: null, avatarUrl: '', favs: new Map(), hist: [], log: null, dataErr: false };
const myName = () => (ME.profile && ME.profile.display_name) || 'cưng';

async function loadUserData() {
  const [f, h] = await Promise.all([
    sb.from('favorites').select('manga_id,created_at'),
    sb.from('reading_history').select('manga_id,chapter_id,chapter_number,read_at').order('read_at', { ascending: false })
  ]);
  if (f.error) throw f.error; if (h.error) throw h.error;
  ME.favs = new Map((f.data || []).map(r => [r.manga_id, r.created_at]));
  ME.hist = (h.data || []).slice().sort((a, b) => String(b.read_at).localeCompare(String(a.read_at)));
  ME.dataErr = false;
  const lg = await sb.from('reading_log').select('manga_id,chapter_id,chapter_number,read_at').order('read_at', { ascending: false }).limit(3000);
  ME.log = lg.error ? null : (lg.data || []);
}
async function loadProfile() {
  try {
    const { data, error } = await sb.from('profiles').select('user_id,display_name,birthday,bio,avatar_path,notif_seen_at').eq('user_id', DB.uid).maybeSingle();
    if (error) throw error;
    ME.profile = data || { user_id: DB.uid, display_name: '', birthday: null, bio: '', avatar_path: null, notif_seen_at: null };
  } catch (e) { console.warn('profile', e); ME.profile = ME.profile || { user_id: DB.uid, display_name: '', birthday: null, bio: '', avatar_path: null, notif_seen_at: null }; }
  ME.avatarUrl = '';
  if (ME.profile.avatar_path) { try { [ME.avatarUrl] = await signedUrls([ME.profile.avatar_path]); } catch (e) {} }
  renderMe();
}
function avatarHTML() { return ME.avatarUrl ? `<img src="${esc(ME.avatarUrl)}" alt="">` : '🍃'; }
function renderMe() {
  const btn = $('avatarBtn');
  if (ME.avatarUrl) btn.innerHTML = `<img src="${esc(ME.avatarUrl)}" alt="">`;
  else btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>';
  $('ddAv').innerHTML = avatarHTML(); $('ddName').textContent = myName(); $('userEmail').textContent = ME.email;
  const h = document.querySelector('.hero h2'); if (h) h.textContent = `Chào ${myName()}, hôm nay đọc gì nào?`;
  if (STATE.screen === 'profile') renderProfile();
}
function refreshUserViews() {
  renderBell();
  if (STATE.screen === 'favorites') renderFavs();
  if (STATE.screen === 'history') renderHistory();
  if (STATE.screen === 'profile') renderProfile();
  if (STATE.screen === 'detail') renderDetail();
}

// ---------- Yêu thích ----------
const isFav = id => ME.favs.has(id);
async function toggleFav(id) {
  const m = DB.manga.find(x => x.id === id); if (!m) return;
  const was = isFav(id);
  if (was) ME.favs.delete(id); else ME.favs.set(id, new Date().toISOString());
  refreshUserViews(); renderHome();
  const { error } = was ? await sb.from('favorites').delete().eq('manga_id', id) : await sb.from('favorites').insert({ manga_id: id });
  if (error) {
    if (was) ME.favs.set(id, new Date().toISOString()); else ME.favs.delete(id);
    refreshUserViews(); renderHome(); showToast('🥲 ' + friendlyError(error)); return;
  }
  showToast(was ? '☆ Đã bỏ khỏi yêu thích' : '⭐ Đã thêm vào yêu thích, có chương mới sẽ báo cưng nhé');
}
function renderFavs() {
  const list = DB.manga.filter(m => isFav(m.id)).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  $('favSub').textContent = list.length ? `${list.length} bộ truyện cưng đánh dấu sao` : '';
  $('favGrid').innerHTML = list.length ? list.map(homeCard).join('')
    : `<div class="lib-empty" style="grid-column:1/-1"><div class="big">⭐</div><h3>Chưa có truyện yêu thích</h3><p>Mở một bộ truyện và bấm “☆ Yêu thích”. Khi truyện ra chương mới, chuông 🔔 sẽ báo cưng.</p><button type="button" class="btn-submit primary" onclick="goScreen('library')">Mở thư viện</button></div>`;
}
$('favGrid').addEventListener('click', e => { const c = e.target.closest('[data-id]'); if (c) openDetail(c.dataset.id); });

// ---------- Lịch sử đọc ----------
async function recordHistory(m, c) {
  const row = { user_id: DB.uid, manga_id: m.id, chapter_id: c.id, chapter_number: c.number, read_at: new Date().toISOString() };
  ME.hist = [row, ...ME.hist.filter(h => h.manga_id !== m.id)];
  const { error } = await sb.from('reading_history').upsert(row, { onConflict: 'user_id,manga_id' });
  if (error) console.warn('history', error);
  if (ME.log) {
    ME.log.unshift({ manga_id: m.id, chapter_id: c.id, chapter_number: c.number, read_at: row.read_at });
    const lg = await sb.from('reading_log').insert({ manga_id: m.id, chapter_id: c.id, chapter_number: c.number, read_at: row.read_at });
    if (lg.error) console.warn('log', lg.error);
  }
}
const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
function dayLabel(d) {
  const t = new Date(), y = new Date(Date.now() - 864e5);
  if (dayKey(d) === dayKey(t)) return 'Hôm nay'; if (dayKey(d) === dayKey(y)) return 'Hôm qua';
  return new Date(d).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}
function histItemHTML(m, h, extra) {
  const c = m.chapters.find(x => x.id === h.chapter_id);
  const last = m.chapters[m.chapters.length - 1], behind = !extra && last && +last.number > +h.chapter_number;
  return `<div class="hist-item" data-mid="${m.id}">
    <span data-open-detail>${coverHTML(m, true)}</span>
    <div class="hist-body">
      <button type="button" class="hist-title" data-open-detail>${esc(m.title)}</button>
      <div class="hist-chap">${extra || `📖 Đọc đến <b>${esc(c ? chapLabel(c) : 'Chương ' + fmtNum(h.chapter_number))}</b>`}${behind ? ` · <span style="color:var(--mau-xanh-dam)">có chương mới hơn (ch.${fmtNum(last.number)})</span>` : ''}</div>
      <div class="hist-time">🕒 ${new Date(h.read_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
    </div>
    <button type="button" class="btn-submit primary" data-continue>Đọc tiếp ❯</button>
    <button type="button" class="ms-btn del hist-del" data-hdel title="Xoá khỏi lịch sử" aria-label="Xoá ${esc(m.title)} khỏi lịch sử">✕</button>
  </div>`;
}
const isoDay = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
function renderHistory() {
  const rows = ME.hist.filter(h => DB.manga.some(m => m.id === h.manga_id));
  const f = $('histDate').value;
  $('histDate').max = isoDay(Date.now());
  $('hfDateWrap').classList.toggle('on', !!f);
  const today = isoDay(Date.now()), yday = isoDay(Date.now() - 864e5);
  document.querySelectorAll('[data-hq]').forEach(b => b.setAttribute('aria-pressed', b.dataset.hq === (!f ? 'all' : f === today ? 'today' : f === yday ? 'yday' : '')));
  $('histSub').textContent = rows.length ? `${rows.length} bộ truyện đã đọc` : '';
  $('histClear').hidden = !rows.length;
  if (!rows.length) { $('histBox').innerHTML = `<div class="lib-empty"><div class="big">🕘</div><h3>Chưa đọc truyện nào</h3><p>Đọc một chương bất kỳ, lịch sử sẽ hiện ở đây kèm ngày giờ và chương đang đọc dở.</p><button type="button" class="btn-submit primary" onclick="goScreen('home')">Về trang chủ</button></div>`; return; }
  if (f) {
    const src = (ME.log || ME.hist).filter(r => isoDay(r.read_at) === f && DB.manga.some(m => m.id === r.manga_id));
    const by = new Map();
    src.forEach(r => { const g = by.get(r.manga_id) || { last: r, nums: new Set() }; if (r.read_at > g.last.read_at) g.last = r; g.nums.add(+r.chapter_number); by.set(r.manga_id, g); });
    const label = dayLabel(f + 'T12:00:00');
    if (!by.size) { $('histBox').innerHTML = `<div class="lib-empty"><div class="big">🍃</div><h3>${esc(label)} cưng không đọc truyện nào</h3><p>Chọn ngày khác hoặc bấm “Tất cả” để xem toàn bộ lịch sử.</p></div>`; return; }
    const list = [...by.entries()].sort((a, b) => String(b[1].last.read_at).localeCompare(String(a[1].last.read_at)));
    $('histBox').innerHTML = `<h3 class="hist-day">${esc(label)} · ${list.length} truyện</h3><div class="hist-list">` + list.map(([id, g]) => {
      const m = DB.manga.find(x => x.id === id);
      const nums = [...g.nums].sort((a, b) => a - b);
      return histItemHTML(m, g.last, `📖 Đã đọc trong ngày: <span class="hist-chips">${nums.map(n => `<span>Ch.${fmtNum(n)}</span>`).join('')}</span>`);
    }).join('') + '</div>';
    return;
  }
  let html = '', cur = '';
  rows.forEach(h => {
    const m = DB.manga.find(x => x.id === h.manga_id), label = dayLabel(h.read_at);
    if (label !== cur) { html += (cur ? '</div>' : '') + `<h3 class="hist-day">${esc(label)}</h3><div class="hist-list">`; cur = label; }
    html += histItemHTML(m, h);
  });
  $('histBox').innerHTML = html + '</div>';
}
$('histDate').addEventListener('change', () => { renderHistory(); replaceUrl(); });
document.querySelectorAll('[data-hq]').forEach(b => b.addEventListener('click', () => {
  const q = b.dataset.hq; $('histDate').value = q === 'today' ? isoDay(Date.now()) : q === 'yday' ? isoDay(Date.now() - 864e5) : ''; renderHistory(); replaceUrl();
}));
$('histBox').addEventListener('click', async e => {
  const it = e.target.closest('[data-mid]'); if (!it) return;
  const id = it.dataset.mid, h = ME.hist.find(x => x.manga_id === id);
  if (e.target.closest('[data-open-detail]')) return openDetail(id);
  if (e.target.closest('[data-continue]') && h) return openChapter(id, h.chapter_id);
  if (e.target.closest('[data-hdel]')) {
    ME.hist = ME.hist.filter(x => x.manga_id !== id); if (ME.log) ME.log = ME.log.filter(x => x.manga_id !== id); renderHistory();
    if (ME.log) sb.from('reading_log').delete().eq('manga_id', id).then(r => r.error && console.warn(r.error));
    const { error } = await sb.from('reading_history').delete().eq('manga_id', id);
    if (error) showToast('🥲 ' + friendlyError(error));
  }
});
$('histClear').addEventListener('click', async () => {
  const ok = await askDialog({ title: 'Xoá toàn bộ lịch sử đọc?', warn: true, ok: 'Xoá hết', html: '<p>Danh sách truyện đã đọc sẽ được làm trống. Truyện và chương không bị ảnh hưởng.</p>' });
  if (!ok) return;
  const { error } = await sb.from('reading_history').delete().eq('user_id', DB.uid);
  if (error) { showToast('🥲 ' + friendlyError(error)); return; }
  if (ME.log) { await sb.from('reading_log').delete().eq('user_id', DB.uid); ME.log = []; }
  ME.hist = []; renderHistory(); showToast('🧹 Đã xoá lịch sử đọc');
});

// ---------- Thông báo chương mới của truyện yêu thích ----------
function notifItems() {
  const out = [];
  for (const [mid, favAt] of ME.favs) {
    const m = DB.manga.find(x => x.id === mid); if (!m) continue;
    m.chapters.forEach(c => { if (new Date(c.created_at) > new Date(favAt)) out.push({ m, c, at: c.created_at }); });
  }
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 50);
}
const seenAt = () => (ME.profile && ME.profile.notif_seen_at) || '1970-01-01';
function renderBell(markSeen) {
  const items = notifItems(), seen = seenAt();
  const unread = items.filter(i => new Date(i.at) > new Date(seen)).length;
  const badge = $('bellBadge'); badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : unread;
  $('bellBtn').classList.toggle('has-new', !!unread);
  $('bellBtn').setAttribute('aria-label', unread ? `Thông báo, ${unread} chưa xem` : 'Thông báo');
  if ($('bellPanel').hidden && !markSeen) return;
  $('bellList').innerHTML = items.length ? items.map(i => `<button type="button" class="nt-item${new Date(i.at) > new Date(seen) ? ' unread' : ''}" data-m="${i.m.id}" data-c="${i.c.id}">
      ${coverHTML(i.m, true)}<span class="nt-text"><b>${esc(i.m.title)}</b> vừa ra ${esc(chapLabel(i.c))}<small>⭐ Truyện yêu thích · ${relTimeShort(i.at)}</small></span></button>`).join('')
    : `<div class="nt-empty">Chưa có thông báo nào 🍃<br><small>Đánh dấu ⭐ truyện yêu thích, khi có chương mới chuông sẽ báo cưng.</small></div>`;
}
async function markNotifSeen() {
  const now = new Date().toISOString();
  ME.profile = Object.assign({}, ME.profile, { notif_seen_at: now });
  $('bellBadge').hidden = true; $('bellBtn').classList.remove('has-new');
  const { error } = await sb.from('profiles').upsert({ user_id: DB.uid, notif_seen_at: now }, { onConflict: 'user_id' });
  if (error) console.warn('notif seen', error);
}
$('bellBtn').addEventListener('click', e => {
  e.stopPropagation();
  const p = $('bellPanel'), open = p.hidden;
  $('userDropdown').classList.remove('show');
  p.hidden = !open; $('bellBtn').setAttribute('aria-expanded', open);
  if (open) { renderBell(true); if (!$('bellBadge').hidden) markNotifSeen(); }
});
$('bellList').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; $('bellPanel').hidden = true; openChapter(b.dataset.m, b.dataset.c); });
document.addEventListener('click', e => { if (!e.target.closest('.bell-area')) { $('bellPanel').hidden = true; $('bellBtn').setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('bellPanel').hidden = true; });

// ---------- Trang cá nhân ----------
let pfAvFile = null, pfAvRemove = false;
function openProfile(edit) { if (typeof togglePassForm === 'function') togglePassForm(false); $('userDropdown').classList.remove('show'); closeDrawer(); showScreen('profile'); renderProfile(); setProfileEdit(!!edit); }
function setProfileEdit(on) {
  $('pfView').hidden = on; $('pfEdit').hidden = !on;
  if (on) {
    const p = ME.profile || {};
    $('pfNameIn').value = p.display_name || ''; $('pfBday').value = p.birthday || ''; $('pfBioIn').value = p.bio || '';
    $('pfBioCount').textContent = `${$('pfBioIn').value.length}/300`;
    pfAvFile = null; pfAvRemove = false; $('pfEditAv').innerHTML = avatarHTML();
    setTimeout(() => $('pfNameIn').focus(), 50);
  }
}
function renderProfile() {
  const p = ME.profile || {};
  $('pfAv').innerHTML = avatarHTML();
  $('pfName').textContent = p.display_name || 'Chưa đặt tên';
  $('pfMail').textContent = ME.email;
  const facts = [];
  if (p.birthday) {
    const b = new Date(p.birthday + 'T00:00:00'), t = new Date();
    const isToday = b.getDate() === t.getDate() && b.getMonth() === t.getMonth();
    facts.push(`<span class="pf-chip pf-bday">🎂 ${b.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}${isToday ? ' · Chúc mừng sinh nhật! 🎉' : ''}</span>`);
  }
  facts.unshift(canUpload() ? '<span class="pf-chip pf-role up">🛠️ Người đăng truyện</span>' : '<span class="pf-chip pf-role">👀 Tài khoản chỉ đọc</span>');
  facts.push(`<span class="pf-chip">⭐ ${ME.favs.size} yêu thích</span>`, `<span class="pf-chip">📖 ${ME.hist.length} truyện đã đọc</span>`);
  if (canUpload()) facts.push(`<span class="pf-chip">📚 ${DB.manga.filter(m => m.user_id === DB.uid).length} truyện cưng đã đăng</span>`);
  $('pfFacts').innerHTML = facts.join('');
  $('pfBio').textContent = p.bio || 'Chưa có lời giới thiệu. Bấm “Chỉnh sửa hồ sơ” để viết đôi dòng nhé.';
  $('pfBio').classList.toggle('empty', !p.bio);
}
$('pfBioIn').addEventListener('input', e => $('pfBioCount').textContent = `${e.target.value.length}/300`);
$('pfAvInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) { pfAvFile = f; pfAvRemove = false; $('pfEditAv').innerHTML = `<img src="${URL.createObjectURL(f)}" alt="">`; } e.target.value = ''; });
$('pfAvRemove').addEventListener('click', () => { pfAvFile = null; pfAvRemove = true; $('pfEditAv').textContent = '🍃'; });
$('pfCancel').addEventListener('click', () => setProfileEdit(false));
$('pfEdit').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('pfSave'); btn.disabled = true;
  try {
    const old = ME.profile && ME.profile.avatar_path;
    const row = { user_id: DB.uid, display_name: $('pfNameIn').value.trim() || null, birthday: $('pfBday').value || null, bio: $('pfBioIn').value.trim() || null, updated_at: new Date().toISOString() };
    if (pfAvFile) {
      setProgress('progPf', 40, 'Đang lưu ảnh đại diện…');
      const path = `${DB.uid}/avatar-${Date.now()}.jpg`;
      await putFile(path, await toJpeg(pfAvFile, 400, .88));
      row.avatar_path = path;
    } else if (pfAvRemove) row.avatar_path = null;
    const { error } = await sb.from('profiles').upsert(row, { onConflict: 'user_id' });
    if (error) throw error;
    if (old && 'avatar_path' in row && row.avatar_path !== old) { try { await sb.storage.from(BUCKET).remove([old]); } catch (e) {} }
    setProgress('progPf', 100, '✅ Đã lưu hồ sơ'); hideProgress('progPf');
    await loadProfile(); setProfileEdit(false); renderProfile();
    showToast('💾 Đã cập nhật hồ sơ');
  } catch (err) { console.warn('profile save', err); setProgress('progPf', 0, '❌ ' + friendlyError(err)); }
  finally { btn.disabled = false; }
});
