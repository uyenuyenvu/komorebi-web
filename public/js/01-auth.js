// ===================== ĐĂNG NHẬP (Supabase) =====================
const CFG = window.KOMOREBI_CONFIG || window.SOBEP_CONFIG || {};
const configured = !!(window.supabase && CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/xxxx/.test(CFG.SUPABASE_URL));
const sb = configured ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

function loginErrorText(error) {
  const m = String(error.message || '');
  if (/invalid login credentials/i.test(m)) return 'Email hoặc mật khẩu chưa đúng rồi 🥲';
  if (/email not confirmed/i.test(m)) return 'Tài khoản chưa được xác nhận. Vào Supabase → Authentication → Users để xác nhận nhé.';
  if (/api ?key|apikey|jwt|unauthorized/i.test(m) || error.status === 401) return 'Khoá anon trong config.js chưa đúng. Copy lại khoá anon public từ Supabase nhé.';
  if (error.status === 0 || /fetch|network|load failed/i.test(m)) return 'Không gọi được máy chủ Supabase. Kiểm tra Project URL trong config.js hoặc mạng.';
  return 'Chưa đăng nhập được: ' + m;
}
function showGate(kind) {
  document.getElementById('gate').hidden = false;
  document.body.classList.add('locked');
  ['Loading', 'Login', 'Config'].forEach(k => document.getElementById('gate' + k).hidden = (k.toLowerCase() !== kind));
  if (kind === 'login') setTimeout(() => document.getElementById('g-email').focus(), 60);
}
function enterApp(session) {
  document.getElementById('userEmail').textContent = session.user.email || '';
  document.getElementById('gate').hidden = true;
  document.body.classList.remove('locked');
  onSignedIn(session);
}
let gateMode = 'login';
function setGateMode(m) {
  gateMode = m;
  const su = m === 'signup';
  document.getElementById('g-confirm-wrap').hidden = !su;
  document.getElementById('g-confirm').required = su;
  document.getElementById('g-pass').autocomplete = su ? 'new-password' : 'current-password';
  document.getElementById('g-sub').textContent = su ? 'Tạo tài khoản mới cho Komorebi' : 'Chào cưng, đăng nhập để đọc tiếp nhé';
  document.getElementById('g-btn').textContent = su ? 'Tạo tài khoản' : 'Vào đọc truyện';
  document.getElementById('g-switch-text').textContent = su ? 'Đã có tài khoản?' : 'Chưa có tài khoản?';
  document.getElementById('g-switch').textContent = su ? 'Đăng nhập' : 'Tạo tài khoản';
  document.getElementById('g-err').textContent = '';
}
document.getElementById('g-switch').addEventListener('click', () => {
  document.getElementById('g-ok').textContent = '';
  setGateMode(gateMode === 'login' ? 'signup' : 'login');
});
function signupErrorText(error) {
  const m = String(error.message || '');
  if (/signups? not allowed|signup.*disabled|not allowed/i.test(m)) return 'Supabase đang tắt đăng ký. Vào Authentication → Sign In / Providers, bật “Allow new users to sign up”, tạo xong nhớ tắt lại nhé.';
  if (/already (been )?registered|already exists/i.test(m)) return 'Email này đã có tài khoản rồi, nên lỗi lúc nãy là do mật khẩu. Đặt lại mật khẩu bằng câu SQL rồi đăng nhập nhé.';
  if (/password/i.test(m)) return 'Mật khẩu chưa đạt yêu cầu của Supabase, thử mật khẩu dài hơn nhé.';
  return loginErrorText(error);
}
document.getElementById('gateLogin').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('g-btn'), err = document.getElementById('g-err'), ok = document.getElementById('g-ok');
  const email = document.getElementById('g-email').value.trim();
  const password = document.getElementById('g-pass').value;
  err.textContent = ''; ok.textContent = '';

  if (gateMode === 'signup') {
    if (password.length < 6) { err.textContent = 'Mật khẩu cần ít nhất 6 ký tự.'; return; }
    if (password !== document.getElementById('g-confirm').value) { err.textContent = 'Hai lần nhập mật khẩu chưa khớp.'; return; }
    btn.disabled = true; btn.textContent = 'Đang tạo…';
    const { data, error } = await sb.auth.signUp({ email, password });
    btn.disabled = false; btn.textContent = 'Tạo tài khoản';
    if (error) { err.textContent = signupErrorText(error); console.warn('Supabase signup error:', error); return; }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      err.textContent = 'Email này đã có tài khoản rồi, nên lỗi lúc nãy là do mật khẩu. Đặt lại mật khẩu bằng câu SQL rồi đăng nhập nhé.';
      return;
    }
    document.getElementById('g-pass').value = ''; document.getElementById('g-confirm').value = '';
    if (data.session) { enterApp(data.session); showToast('🎉 Tạo tài khoản xong, vào đọc thôi!'); return; }
    setGateMode('login');
    ok.textContent = '📮 Đã tạo tài khoản! Mở email, bấm link xác nhận rồi quay lại đây đăng nhập nhé.';
    return;
  }

  btn.disabled = true; btn.textContent = 'Đang mở…';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false; btn.textContent = 'Vào đọc truyện';
  if (error) { err.textContent = loginErrorText(error); console.warn('Supabase login error:', error); return; }
  document.getElementById('g-pass').value = '';
  enterApp(data.session);
  showToast('🍃 Chào mừng cưng quay lại!');
});
document.getElementById('passToggle').addEventListener('click', e => {
  const p = document.getElementById('g-pass'); const show = p.type === 'password';
  p.type = show ? 'text' : 'password'; e.target.textContent = show ? 'Ẩn' : 'Hiện';
});
async function logout() {
  document.getElementById('userDropdown').classList.remove('show');
  if (sb) await sb.auth.signOut();
  resetData(); ROUTE.silent = true; showScreen('home'); ROUTE.silent = false; history.replaceState(null, '', '/'); renderLibrary(); renderHome();
  showGate('login');
}
// Phần kiểm tra phiên đăng nhập được chạy ở js/99-boot.js, sau khi mọi file đã nạp xong.

