// ===================== PHÂN QUYỀN =====================
async function loadRole() {
  try {
    const { data, error } = await sb.from('user_roles').select('role').eq('user_id', DB.uid).maybeSingle();
    if (error) throw error;
    ME.role = (data && data.role) || 'reader';
  } catch (e) {
    console.warn('role', e);
    ME.role = /relation|does not exist|schema cache/i.test(e.message || '') ? 'uploader' : 'reader';   // chưa chạy SQL phân quyền thì giữ như cũ
  }
  applyRole();
}
const canUpload = () => ME.role === 'uploader';
function applyRole() {
  document.body.classList.toggle('role-reader', !canUpload());
  if (!canUpload() && (STATE.screen === 'upload' || STATE.screen === 'master')) showScreen('home');
  if (STATE.screen === 'profile') renderProfile();
}
