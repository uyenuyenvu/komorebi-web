// ===================== ĐỔI MẬT KHẨU =====================
function togglePassForm(on) {
  $('pfPassForm').hidden = !on; $('pfPassErr').textContent = '';
  ['pfOldPass', 'pfNewPass', 'pfNewPass2'].forEach(id => $(id).value = '');
  if (on) setTimeout(() => $('pfOldPass').focus(), 50);
}
$('pfPassBtn').addEventListener('click', () => togglePassForm($('pfPassForm').hidden));
$('pfPassCancel').addEventListener('click', () => togglePassForm(false));
$('pfPassForm').addEventListener('submit', async e => {
  e.preventDefault();
  const cur = $('pfOldPass').value, nw = $('pfNewPass').value, nw2 = $('pfNewPass2').value, err = $('pfPassErr');
  if (nw.length < 6) { err.textContent = 'Mật khẩu mới cần ít nhất 6 ký tự.'; return; }
  if (nw !== nw2) { err.textContent = 'Hai lần nhập mật khẩu mới chưa khớp.'; return; }
  if (nw === cur) { err.textContent = 'Mật khẩu mới phải khác mật khẩu hiện tại.'; return; }
  const btn = $('pfPassSave'); btn.disabled = true; err.textContent = '';
  try {
    const chk = await sb.auth.signInWithPassword({ email: ME.email, password: cur });
    if (chk.error) { err.textContent = 'Mật khẩu hiện tại chưa đúng.'; return; }
    const { error } = await sb.auth.updateUser({ password: nw });
    if (error) { err.textContent = /same/i.test(error.message) ? 'Mật khẩu mới phải khác mật khẩu cũ.' : /weak|short|least/i.test(error.message) ? 'Mật khẩu mới yếu quá, thử dài hơn nhé.' : 'Chưa đổi được: ' + error.message; return; }
    togglePassForm(false); showToast('🔑 Đã đổi mật khẩu, lần sau đăng nhập bằng mật khẩu mới nhé');
  } finally { btn.disabled = false; }
});
