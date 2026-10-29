/* ============================================================================
 * Komorebi · Supabase giả lập chạy ngay trong trình duyệt (chỉ dùng khi chạy local)
 * ----------------------------------------------------------------------------
 * - Dữ liệu bảng lưu ở localStorage, ảnh lưu ở IndexedDB → tải lại trang vẫn còn.
 * - Có sẵn 2 tài khoản demo và vài bộ truyện mẫu (ảnh vẽ bằng SVG, không cần file).
 * - Mô phỏng phân quyền giống schema thật: uploader được ghi, reader chỉ đọc;
 *   yêu thích / lịch sử / hồ sơ là dữ liệu riêng của từng tài khoản.
 * - Tuỳ chỉnh qua window.KOMOREBI_MOCK trong dev/config.mock.js:
 *     latency  : độ trễ mỗi lần gọi (ms)
 *     failRate : tỉ lệ lỗi mạng ngẫu nhiên khi tải ảnh (0 → 1)
 * - Trong Console: __mock.reset() xoá sạch về dữ liệu mẫu, __mock.db() xem dữ liệu,
 *   __mock.users liệt kê tài khoản demo, __mock.setRole(email, 'reader'|'uploader').
 * ========================================================================== */
(function () {
  'use strict';
  const OPTS = Object.assign({ latency: 120, failRate: 0 }, window.KOMOREBI_MOCK || {});
  const LS_DB = 'komorebi.mock.db.v1', LS_SESSION = 'komorebi.mock.session';
  const PRIVATE = new Set(['favorites', 'reading_history', 'reading_log', 'profiles', 'user_roles']);
  const UPLOADER_WRITE = new Set(['manga', 'chapters', 'genres', 'statuses']);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const wait = () => sleep(OPTS.latency * (0.6 + Math.random() * 0.8));
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const clone = x => JSON.parse(JSON.stringify(x));
  const nowISO = (offsetDays = 0, offsetMin = 0) => new Date(Date.now() - offsetDays * 864e5 - offsetMin * 6e4).toISOString();
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ').trim();

  // ---------------- tài khoản demo ----------------
  const USERS = [
    { id: '00000000-0000-4000-8000-000000000001', email: 'uploader@komorebi.local', password: '123456', role: 'uploader', name: 'Chủ Kệ' },
    { id: '00000000-0000-4000-8000-000000000002', email: 'reader@komorebi.local', password: '123456', role: 'reader', name: 'Bạn Đọc' }
  ];

  // ---------------- dữ liệu mẫu ----------------
  function seed() {
    const up = USERS[0].id, rd = USERS[1].id;
    const db = { manga: [], chapters: [], genres: [], statuses: [], profiles: [], favorites: [], reading_history: [], reading_log: [], user_roles: [], _auth: {} };
    [['dang', 'Đang ra', 'green'], ['xong', 'Hoàn thành', 'blue'], ['ss1', 'Hết season 1', 'purple'], ['ss2', 'Hết season 2', 'purple'], ['dung', 'Tạm dừng', 'yellow'], ['drop', 'Drop', 'pink']]
      .forEach(([code, name, tone], i) => db.statuses.push({ id: uuid(), user_id: up, code, name, tone, sort: i, created_at: nowISO(30) }));
    ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Isekai', 'Mystery', 'Romance', 'Sci-fi', 'Slice of life', 'Thriller']
      .forEach((name, i) => db.genres.push({ id: uuid(), user_id: up, name, sort: i, created_at: nowISO(30) }));
    const books = [
      ['The Deep Sea', 'Mizu Studio', 'Nhóm Sóng Xanh', 'dang', ['Adventure', 'Fantasy', 'Mystery'], 'Cô thợ lặn Hana nhặt được chiếc vỏ ốc biết nói, và từ đó mỗi đêm lại theo nó lặn xuống một thành phố cổ dưới đáy biển.', 4, 6, '#9DC3A6'],
      ['Tiệm bánh ở góc phố mưa', 'Lam Thảo', null, 'xong', ['Slice of life', 'Romance', 'Comedy'], 'Một tiệm bánh nhỏ chỉ mở cửa vào những ngày mưa, với những vị khách mang theo câu chuyện của riêng mình.', 3, 5, '#EDC98B'],
      ['Hiệp sĩ mèo vằn', 'Neko Ink', 'Mèo Lười Team', 'ss1', ['Action', 'Fantasy', 'Comedy'], 'Bị phù thuỷ biến thành mèo ngay trước lễ phong tước, hiệp sĩ Leon phải cứu vương quốc bằng bốn cái chân ngắn.', 3, 4, '#E3AFA8'],
      ['Ga tàu cuối cùng', 'Hạ Vy', null, 'dang', ['Mystery', 'Drama', 'Thriller'], 'Chuyến tàu đêm số 7 chỉ dừng ở những ga không có trên bản đồ.', 2, 5, '#AFC0E0'],
      ['Quán trà của bà phù thuỷ', 'Lá Bạc Hà', 'Nhóm Lá', 'dung', ['Fantasy', 'Slice of life'], 'Bà phù thuỷ về hưu mở quán trà bên bìa rừng, mỗi tách trà chữa được một nỗi buồn nhỏ.', 2, 4, '#C7B5E0'],
      ['Ma cà rồng ăn chay', 'Cà Chua', null, 'drop', ['Comedy', 'Horror', 'Romance'], 'Bá tước Vlad quyết tâm bỏ máu để theo đuổi cô chủ quán chay đầu hẻm.', 1, 3, '#A9D3C6']
    ];
    books.forEach(([title, author, translator, status, genres, desc, nChap, nPage, color], bi) => {
      const id = uuid(), upd = nowISO(bi * 2, bi * 37);
      db.manga.push({ id, user_id: up, title, title_key: fold(title), author, translator, release_date: `2026-0${(bi % 9) + 1}-1${bi}`, status, genres, description: desc,
        cover_path: `seed/cover/${encodeURIComponent(title)}/${color.slice(1)}`, created_at: nowISO(40 - bi), updated_at: upd });
      for (let c = 1; c <= nChap; c++) {
        db.chapters.push({ id: uuid(), manga_id: id, user_id: up, number: c, title: c === 1 ? 'Khởi đầu' : null,
          pages: Array.from({ length: nPage }, (_, k) => `seed/page/${encodeURIComponent(title)}/${c}/${k + 1}/${color.slice(1)}`),
          created_at: nowISO(bi * 2 + (nChap - c), 10) });
      }
    });
    USERS.forEach(u => {
      db.user_roles.push({ user_id: u.id, role: u.role, created_at: nowISO(60) });
      db.profiles.push({ user_id: u.id, display_name: u.name, birthday: null, bio: null, avatar_path: null, notif_seen_at: null, updated_at: nowISO(10) });
    });
    // tài khoản uploader: đã thích 2 truyện, có lịch sử đọc
    db.favorites.push({ user_id: up, manga_id: db.manga[0].id, created_at: nowISO(3) }, { user_id: up, manga_id: db.manga[2].id, created_at: nowISO(9) });
    const ch0 = db.chapters.filter(c => c.manga_id === db.manga[0].id);
    db.reading_history.push({ user_id: up, manga_id: db.manga[0].id, chapter_id: ch0[1].id, chapter_number: 2, read_at: nowISO(1, 30) });
    db.reading_log.push({ id: uuid(), user_id: up, manga_id: db.manga[0].id, chapter_id: ch0[0].id, chapter_number: 1, read_at: nowISO(1, 50) },
                        { id: uuid(), user_id: up, manga_id: db.manga[0].id, chapter_id: ch0[1].id, chapter_number: 2, read_at: nowISO(1, 30) });
    db.favorites.push({ user_id: rd, manga_id: db.manga[1].id, created_at: nowISO(5) });
    USERS.forEach(u => { db._auth[u.email] = u.password; });
    return db;
  }
  let DB;
  try { DB = JSON.parse(localStorage.getItem(LS_DB) || 'null'); } catch (e) { DB = null; }
  if (!DB) DB = seed();
  const save = () => { try { localStorage.setItem(LS_DB, JSON.stringify(DB)); } catch (e) { console.warn('[mock] localStorage đầy', e); } };
  save();

  // ---------------- phiên đăng nhập ----------------
  let session = null;
  try { session = JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) {}
  const uid = () => session && session.user.id;
  const role = () => (DB.user_roles.find(r => r.user_id === uid()) || {}).role || 'reader';
  const makeSession = u => ({ access_token: 'mock-' + u.id, user: { id: u.id, email: u.email } });
  const userByEmail = email => USERS.find(u => u.email === email) || (DB._extraUsers || []).find(u => u.email === email);

  // ---------------- ảnh: IndexedDB + ảnh mẫu vẽ bằng SVG ----------------
  const idb = new Promise((res, rej) => { const r = indexedDB.open('komorebi-mock-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const fileOp = (mode, fn) => idb.then(d => new Promise((res, rej) => { const tx = d.transaction('files', mode); const st = tx.objectStore('files'); const q = fn(st); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }));
  const objUrls = new Map();
  function svgUrl(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function seedImage(path) {
    const p = path.split('/'), kind = p[1], title = decodeURIComponent(p[2]), color = '#' + p[p.length - 1];
    const esc = t => t.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    if (kind === 'cover') return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><circle cx="300" cy="360" r="150" fill="#fff" opacity=".55"/><circle cx="300" cy="360" r="90" fill="${color}" opacity=".8"/><rect x="60" y="700" width="480" height="120" rx="24" fill="#fffdf8" opacity=".9"/><text x="300" y="775" text-anchor="middle" font-family="Georgia,serif" font-size="40" fill="#4f5a3f">${esc(title)}</text></svg>`);
    const chap = p[3], page = p[4];
    return svgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1150" viewBox="0 0 800 1150"><rect width="800" height="1150" fill="#fffdf8"/><g fill="none" stroke="#3a3a3a" stroke-width="6"><rect x="40" y="40" width="720" height="400" rx="6"/><rect x="40" y="470" width="340" height="640" rx="6"/><rect x="410" y="470" width="350" height="300" rx="6"/><rect x="410" y="800" width="350" height="310" rx="6"/></g><circle cx="400" cy="240" r="110" fill="${color}" opacity=".7"/><text x="210" y="800" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="#555">Chương ${chap}</text><text x="585" y="640" text-anchor="middle" font-family="Georgia,serif" font-size="96" fill="#333">${page}</text><text x="585" y="965" text-anchor="middle" font-family="Georgia,serif" font-size="26" fill="#777">${esc(title)}</text></svg>`);
  }
  async function urlFor(path) {
    if (path.startsWith('seed/')) return seedImage(path);
    if (objUrls.has(path)) return objUrls.get(path);
    const blob = await fileOp('readonly', st => st.get(path));
    if (!blob) return null;
    const u = URL.createObjectURL(blob); objUrls.set(path, u); return u;
  }

  // ---------------- truy vấn bảng ----------------
  const err = (message, code) => ({ data: null, error: { message, code } });
  const RLS = 'new row violates row-level security policy (mock: tài khoản chỉ đọc)';
  function uniqueClash(table, row, self) {
    const rows = DB[table].filter(r => r !== self);
    if (table === 'manga') return rows.some(r => r.title_key === row.title_key);
    if (table === 'chapters') return rows.some(r => r.manga_id === row.manga_id && +r.number === +row.number);
    if (table === 'genres') return rows.some(r => fold(r.name) === fold(row.name));
    if (table === 'statuses') return rows.some(r => r.code === row.code || fold(r.name) === fold(row.name));
    if (table === 'favorites') return rows.some(r => r.user_id === row.user_id && r.manga_id === row.manga_id);
    return false;
  }
  function withChapters(m, cols) {
    const mm = clone(m);
    const sub = /chapters\(([^)]*)\)/.exec(cols || '');
    if (sub) {
      const keys = sub[1].split(',').map(x => x.trim());
      mm.chapters = DB.chapters.filter(c => c.manga_id === m.id).map(c => Object.fromEntries(keys.map(k => [k, c[k]])));
    }
    return mm;
  }
  function builder(table) {
    const st = { op: 'select', cols: '*', filters: [], order: null, limit: null, single: false, maybe: false, payload: null, returning: false, conflict: null };
    const b = {
      select(cols) { if (st.op === 'select') st.cols = cols || '*'; else st.returning = true; return b; },
      eq(col, val) { st.filters.push([col, val]); return b; },
      order(col, o) { st.order = [col, !(o && o.ascending === false)]; return b; },
      limit(n) { st.limit = n; return b; },
      single() { st.single = true; return b; },
      maybeSingle() { st.single = true; st.maybe = true; return b; },
      insert(p) { st.op = 'insert'; st.payload = p; return b; },
      update(p) { st.op = 'update'; st.payload = p; return b; },
      upsert(p, o) { st.op = 'upsert'; st.payload = p; st.conflict = ((o && o.onConflict) || 'id').split(','); return b; },
      delete() { st.op = 'delete'; return b; },
      then(res, rej) { return run().then(res, rej); }
    };
    const match = r => st.filters.every(([c, v]) => r[c] === v);
    const visible = r => !PRIVATE.has(table) || r.user_id === uid();
    async function run() {
      await wait();
      if (!uid()) return err('JWT expired / chưa đăng nhập (mock)', 'PGRST301');
      if (!DB[table]) return err(`relation "public.${table}" does not exist`, '42P01');
      const writing = st.op !== 'select';
      if (writing && UPLOADER_WRITE.has(table) && role() !== 'uploader') return err(RLS, '42501');
      if (st.op === 'insert' || st.op === 'upsert') {
        const list = Array.isArray(st.payload) ? st.payload : [st.payload];
        const out = [];
        for (const p of list) {
          const row = Object.assign({}, p);
          if (!('user_id' in row) && table !== 'user_roles') row.user_id = uid();
          if (PRIVATE.has(table) && row.user_id !== uid()) return err(RLS, '42501');
          if (st.op === 'upsert') {
            const ex = DB[table].find(r => st.conflict.every(k => r[k] === row[k]));
            if (ex) { Object.assign(ex, row); out.push(ex); continue; }
          }
          if (['manga', 'chapters', 'genres', 'statuses', 'reading_log'].includes(table) && !row.id) row.id = uuid();
          if (!row.created_at && table !== 'reading_history' && table !== 'profiles') row.created_at = new Date().toISOString();
          if (table === 'manga' && !row.updated_at) row.updated_at = new Date().toISOString();
          if (table === 'manga' && !row.title_key) row.title_key = fold(row.title);
          if (table === 'chapters' && !row.pages) row.pages = [];
          if (uniqueClash(table, row)) return err('duplicate key value violates unique constraint', '23505');
          DB[table].push(row); out.push(row);
        }
        save();
        if (st.single) return { data: clone(out[0]), error: null };
        return { data: st.returning ? clone(out) : null, error: null };
      }
      if (st.op === 'update') {
        const rows = DB[table].filter(r => visible(r) && match(r));
        for (const r of rows) { const next = Object.assign({}, r, st.payload); if (uniqueClash(table, next, r)) return err('duplicate key value violates unique constraint', '23505'); }
        rows.forEach(r => Object.assign(r, st.payload)); save();
        return { data: st.returning ? clone(rows) : null, error: null };
      }
      if (st.op === 'delete') {
        const gone = DB[table].filter(r => visible(r) && match(r));
        DB[table] = DB[table].filter(r => !gone.includes(r));
        if (table === 'manga') {   // on delete cascade
          const ids = new Set(gone.map(m => m.id));
          ['chapters', 'favorites', 'reading_history', 'reading_log'].forEach(t => { DB[t] = DB[t].filter(r => !ids.has(r.manga_id)); });
        }
        save(); return { data: null, error: null };
      }
      let rows = DB[table].filter(r => visible(r) && match(r));
      if (st.order) { const [c, asc] = st.order; rows = rows.slice().sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
      if (st.limit) rows = rows.slice(0, st.limit);
      const data = rows.map(r => table === 'manga' ? withChapters(r, st.cols) : clone(r));
      if (st.single) { if (!data.length && !st.maybe) return err('JSON object requested, multiple (or no) rows returned', 'PGRST116'); return { data: data[0] || null, error: null }; }
      return { data, error: null };
    }
    return b;
  }

  // ---------------- client giả ----------------
  const client = {
    auth: {
      async getSession() { await sleep(30); return { data: { session: session ? clone(session) : null }, error: null }; },
      async signInWithPassword({ email, password }) {
        await wait();
        const u = userByEmail(String(email || '').trim().toLowerCase());
        if (!u || DB._auth[u.email] !== password) return { data: { session: null, user: null }, error: { message: 'Invalid login credentials', status: 400 } };
        session = makeSession(u); localStorage.setItem(LS_SESSION, JSON.stringify(session));
        return { data: { session: clone(session), user: clone(session.user) }, error: null };
      },
      async signUp({ email, password }) {
        await wait();
        email = String(email || '').trim().toLowerCase();
        if (userByEmail(email)) return { data: { user: { id: 'x', identities: [] }, session: null }, error: null };
        const u = { id: uuid(), email, password, role: 'reader', name: email.split('@')[0] };
        DB._extraUsers = (DB._extraUsers || []).concat(u); DB._auth[email] = password;
        DB.user_roles.push({ user_id: u.id, role: 'reader', created_at: new Date().toISOString() }); save();
        session = makeSession(u); localStorage.setItem(LS_SESSION, JSON.stringify(session));
        return { data: { user: { id: u.id, email, identities: [{}] }, session: clone(session) }, error: null };
      },
      async updateUser({ password }) {
        await wait();
        if (!session) return { data: null, error: { message: 'Not logged in' } };
        if (password) { if (password.length < 6) return { data: null, error: { message: 'Password should be at least 6 characters' } }; if (DB._auth[session.user.email] === password) return { data: null, error: { message: 'New password should be different from the old password (same)' } }; DB._auth[session.user.email] = password; save(); }
        return { data: { user: clone(session.user) }, error: null };
      },
      async signOut() { session = null; localStorage.removeItem(LS_SESSION); return { error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; }
    },
    from: table => builder(table),
    storage: {
      from() {
        return {
          async upload(path, blob) {
            await sleep(OPTS.latency + Math.min(1500, (blob.size || 0) / 4000));
            if (!uid()) return { data: null, error: { message: 'Unauthorized' } };
            if (Math.random() < OPTS.failRate) return { data: null, error: { message: 'Failed to fetch (mock: lỗi mạng giả lập)' } };
            const own = path.split('/')[0] === uid(), avatar = /\/avatar-[^/]*$/.test(path);
            if (!own || (role() !== 'uploader' && !avatar)) return { data: null, error: { message: RLS } };
            await fileOp('readwrite', st => st.put(blob, path)); objUrls.delete(path);
            return { data: { path }, error: null };
          },
          async remove(paths) {
            await wait();
            if (role() !== 'uploader' && paths.some(p => !(p.split('/')[0] === uid() && /\/avatar-/.test(p)))) return { data: null, error: { message: RLS } };
            await fileOp('readwrite', st => { paths.forEach(p => st.delete(p)); return null; });
            paths.forEach(p => objUrls.delete(p));
            return { data: paths.map(name => ({ name })), error: null };
          },
          async createSignedUrls(paths) {
            await wait();
            const data = [];
            for (const p of paths) { const u = await urlFor(p); data.push({ path: p, signedUrl: u, error: u ? null : 'Object not found' }); }
            return { data, error: null };
          }
        };
      }
    }
  };

  // Thay thư viện thật bằng bản giả
  window.supabase = { createClient: () => client };

  // ---------------- tiện ích cho người test ----------------
  window.__mock = {
    users: USERS.map(u => ({ email: u.email, password: u.password, role: u.role })),
    db: () => clone(DB),
    async reset() {
      localStorage.removeItem(LS_DB); localStorage.removeItem(LS_SESSION);
      Object.keys(localStorage).filter(k => k.startsWith('komorebi.')).forEach(k => localStorage.removeItem(k));
      await fileOp('readwrite', st => st.clear());
      location.href = '/';
    },
    setRole(email, r) { const u = userByEmail(email); if (!u) return 'không có tài khoản ' + email; const row = DB.user_roles.find(x => x.user_id === u.id); row.role = r; save(); return `${email} → ${r}. Tải lại trang để áp dụng.`; },
    opts: OPTS
  };

  // Huy hiệu nhỏ góc dưới bên trái để biết đang chạy dữ liệu giả
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.createElement('div');
    el.innerHTML = `<b>🧪 MOCK</b> · <span id="__mockWho"></span> · <button type="button" id="__mockReset">làm mới dữ liệu</button>`;
    el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);white-space:nowrap;bottom:calc(10px + env(safe-area-inset-bottom,0px));z-index:99999;font:13px/1.3 system-ui,sans-serif;background:#3b3a26;color:#fdf8e3;padding:6px 10px;border-radius:10px;opacity:.85;box-shadow:2px 3px 0 rgba(0,0,0,.2)';
    el.querySelector('button').style.cssText = 'font:inherit;color:#f2d774;background:none;border:0;text-decoration:underline;cursor:pointer;padding:0';
    document.body.appendChild(el);
    const who = () => { el.querySelector('#__mockWho').textContent = session ? `${session.user.email} (${role()})` : 'chưa đăng nhập'; };
    who(); setInterval(who, 1500);
    el.querySelector('#__mockReset').onclick = () => { if (confirm('Xoá toàn bộ dữ liệu giả và quay về dữ liệu mẫu?')) window.__mock.reset(); };
  });
  console.info('%c🧪 Komorebi đang chạy với Supabase GIẢ LẬP', 'color:#5F6B2C;font-weight:bold', '\nTài khoản demo:', window.__mock.users, '\nOpts:', OPTS);
})();
