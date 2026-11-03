// ===================== HEADER TỰ THU KHI LƯỚT =====================
var NAVC = { lastY: 0, lastX: 0, lastDir: 0, timer: null };
function navLocked() {
  return $('userDropdown').classList.contains('show') || !$('bellPanel').hidden || $('sideMenu').classList.contains('active') || !!document.querySelector('dialog[open]');
}
function hideNav() { if (navLocked()) return; clearTimeout(NAVC.timer); NAVC.timer = null; document.body.classList.add('nav-hidden'); }
function showNav(temp) {
  document.body.classList.remove('nav-hidden'); clearTimeout(NAVC.timer); NAVC.timer = null;
  if (temp) NAVC.timer = setTimeout(() => { NAVC.timer = null; if (STATE.screen === 'reader' && (scrollY > 60 || READ.layout !== 'v')) hideNav(); }, 2600);
}
function onScrollDir(dir) {
  if (STATE.screen === 'reader') {
    if (NAVC.lastDir && dir !== NAVC.lastDir) showNav(true);   // đổi hướng lướt: hiện header 2–3 giây
    else if (!NAVC.timer) hideNav();                            // lướt đều một hướng: thu vào
  } else if (dir > 0) hideNav(); else showNav(false);
  NAVC.lastDir = dir;
}
window.addEventListener('scroll', () => {
  const y = scrollY, dy = y - NAVC.lastY;
  if (y < 60) { if (STATE.screen !== 'reader' || READ.layout === 'v') showNav(false); NAVC.lastY = y; return; }
  if (Math.abs(dy) < 8) return;
  onScrollDir(dy > 0 ? 1 : -1); NAVC.lastY = y;
}, { passive: true });
$('viewer').addEventListener('scroll', () => {
  if (READ.layout !== 'strip') return;
  const x = Math.abs($('viewer').scrollLeft), dx = x - NAVC.lastX;
  if (Math.abs(dx) < 10) return;
  onScrollDir(dx > 0 ? 1 : -1); NAVC.lastX = x;
}, { passive: true });
document.addEventListener('mousemove', e => { if (e.clientY < 64 && document.body.classList.contains('nav-hidden')) showNav(STATE.screen === 'reader'); }, { passive: true });
