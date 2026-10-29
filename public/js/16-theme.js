// ===================== CÀI ĐẶT: SÁNG / TỐI =====================
const sysDark = matchMedia('(prefers-color-scheme: dark)');
function currentTheme() { try { return localStorage.getItem('komorebi.theme') || 'system'; } catch (e) { return 'system'; } }
function applyTheme(t) {
  try { localStorage.setItem('komorebi.theme', t); } catch (e) {}
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  const dark = t === 'dark' || (t === 'system' && sysDark.matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#46624E' : '#6E987C');
  renderThemeOpts();
}
function renderThemeOpts() {
  const t = currentTheme(), dark = t === 'dark' || (t === 'system' && sysDark.matches);
  document.querySelectorAll('[data-theme-opt]').forEach(b => b.setAttribute('aria-checked', b.dataset.themeOpt === t));
  $('themeNow').textContent = t === 'system' ? `Máy của cưng đang để chế độ ${sysDark.matches ? 'tối 🌙' : 'sáng ☀️'}, Komorebi đang hiển thị theo.` : `Komorebi luôn hiển thị ${dark ? 'tối 🌙' : 'sáng ☀️'} trên máy này.`;
}
document.querySelectorAll('[data-theme-opt]').forEach(b => b.addEventListener('click', () => applyTheme(b.dataset.themeOpt)));
sysDark.addEventListener('change', () => applyTheme(currentTheme()));
applyTheme(currentTheme());
