// ===================== KHỞI ĐỘNG =====================
showScreen('home');
renderLibrary();
renderHome();

// Kiểm tra phiên đăng nhập (chạy cuối cùng để mọi hàm ở các file khác đã sẵn sàng)
(async () => {
  if (!sb) { showGate('config'); return; }
  let ref = ''; try { ref = new URL(CFG.SUPABASE_URL).hostname.split('.')[0]; } catch (e) {}
  if (ref) document.getElementById('g-server').textContent = 'Máy chủ: ' + ref;
  const { data } = await sb.auth.getSession();
  if (data.session) enterApp(data.session); else showGate('login');
})();
