// ===================== KHỞI ĐỘNG (multipage) =====================
function bootPage() {
  const q = readRouteParams();
  if (PAGE === "home") renderHome();
  if (PAGE === "library") {
    if (q.get("status")) {
      LIB.status = new Set([q.get("status")]);
      if (typeof dStatus !== "undefined") dStatus.setValue([q.get("status")]);
    }
    renderLibrary();
    if (q.get("focus") === "1") setTimeout(() => { const i = $real("libSearch"); if (i) i.focus(); }, 60);
  }
  if (PAGE === "detail") renderDetail();
  if (PAGE === "reader") {
    if (STATE.mangaId && STATE.chapterId) openChapter(STATE.mangaId, STATE.chapterId);
  }
  if (PAGE === "favorites") renderFavs();
  if (PAGE === "history") renderHistory();
  if (PAGE === "profile") { renderProfile(); setProfileEdit(q.get("edit") === "1"); }
  if (PAGE === "master") renderMaster();
  if (PAGE === "upload") {
    const tab = q.get("tab") || "new";
    switchTab(tab);
    const mid = q.get("manga"), act = q.get("act");
    if (mid) { selectManga(mid); if (act) setAct(act); }
  }
}

(async function guardAndBoot() {
  if (typeof IS_LOGIN !== "undefined" && IS_LOGIN) return; // login page dùng auth-login.js
  if (!sb) { location.replace(LOGIN_URL); return; }
  const { data } = await sb.auth.getSession();
  if (!data.session) {
    clearAuthSession();
    location.replace(LOGIN_URL);
    return;
  }
  await onSignedIn(data.session);
})();
