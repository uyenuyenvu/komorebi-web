// ===================== ROUTER (multipage: dùng pages/*.html) =====================
var ROUTE = window.ROUTE || { silent: false, waiting: false, replaceNext: false };
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
const slugify = s => fold(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "truyen";
function slugOf(m) {
  const base = slugify(m.title);
  return DB.manga.some(x => x.id !== m.id && slugify(x.title) === base) ? base + "-" + m.id.slice(0, 4) : base;
}
const mangaBySlug = sl => DB.manga.find(m => slugOf(m) === sl) || DB.manga.find(m => sl.endsWith("-" + m.id.slice(0, 4)));
const chapSlug = n => "chuong-" + String(+n).replace(".", "-");
const chapFromSlug = (m, sl) => { const n = parseFloat(String(sl).replace(/^chuong-/, "").replace("-", ".")); return m.chapters.find(c => +c.number === n); };
function libQuery() { return ""; }
function urlForState() { return null; }
function syncUrl() { /* multipage: URL do pageHref quản lý */ }
function replaceUrl() {}
function route() {
  // Không điều hướng theo pretty-path; bootPage xử lý query của từng file HTML.
}
