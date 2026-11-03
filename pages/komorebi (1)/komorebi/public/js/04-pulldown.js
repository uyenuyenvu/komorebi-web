// ===================== CHECKBOX PULLDOWN =====================
const DROPS = [];
const CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function makeDrop(el, opt) {
  const d = { el, multi: opt.multi !== false, items: [], sel: new Set(opt.value || []), q: '', allText: opt.allText, onChange: opt.onChange || (() => {}), name: 'cbx' + DROPS.length };
  el.classList.add('cbx');
  el.innerHTML = `<button type="button" class="cbx-btn" aria-haspopup="listbox" aria-expanded="false" aria-label="${esc(opt.label)}"><span class="txt"></span><span class="cnt" hidden></span>${CHEV}</button>
    <div class="cbx-panel" hidden>
      <label class="cbx-search"><span class="sr-only">Tìm ${esc(opt.label)}</span><input type="search" placeholder="Tìm ${esc(opt.label.toLowerCase())}…" autocomplete="off"></label>
      <div class="cbx-list" role="listbox" ${d.multi ? 'aria-multiselectable="true"' : ''}></div>
      <div class="cbx-foot">${d.multi ? '<button type="button" class="link-btn" data-clear>Bỏ chọn</button>' : '<span></span>'}<button type="button" class="cbx-done" data-done>Xong</button></div>
    </div>`;
  d.btn = el.querySelector('.cbx-btn'); d.panel = el.querySelector('.cbx-panel'); d.list = el.querySelector('.cbx-list'); d.search = el.querySelector('.cbx-search input');
  d.btn.addEventListener('click', () => d.panel.hidden ? openDrop(d) : closeDrop(d));
  d.search.addEventListener('input', e => { d.q = e.target.value; renderDropList(d); });
  d.list.addEventListener('change', e => {
    const v = e.target.value;
    if (d.multi) { e.target.checked ? d.sel.add(v) : d.sel.delete(v); } else { d.sel = new Set([v]); closeDrop(d); }
    renderDropBtn(d); d.onChange([...d.sel]);
  });
  d.list.addEventListener('click', e => { if (!d.multi && e.target.closest('.cbx-opt')) setTimeout(() => closeDrop(d), 0); });
  el.querySelector('[data-done]').addEventListener('click', () => { closeDrop(d); d.btn.focus(); });
  const clr = el.querySelector('[data-clear]');
  if (clr) clr.addEventListener('click', () => { d.sel.clear(); renderDropList(d); renderDropBtn(d); d.onChange([]); });
  d.setItems = items => { d.items = items; renderDropList(d); renderDropBtn(d); };
  d.setValue = vals => { d.sel = new Set(vals || []); renderDropList(d); renderDropBtn(d); };
  d.getValue = () => [...d.sel];
  DROPS.push(d); return d;
}
function renderDropList(d) {
  const q = fold(d.q.trim()), its = d.items.filter(i => !q || fold(i.label).includes(q));
  d.search.parentElement.hidden = d.items.length < 8;
  d.list.innerHTML = its.length ? its.map(i => `<label class="cbx-opt${i.count === 0 && !d.sel.has(i.value) ? ' zero' : ''}">
      <input type="${d.multi ? 'checkbox' : 'radio'}" name="${d.name}" value="${esc(i.value)}" ${d.sel.has(i.value) ? 'checked' : ''}>
      <span class="cbx-box${d.multi ? '' : ' round'}"></span><span>${esc(i.label)}</span>${i.count != null ? `<span class="n">${i.count}</span>` : ''}</label>`).join('')
    : '<p class="cbx-empty">Không có mục nào khớp 🍃</p>';
}
function renderDropBtn(d) {
  const names = d.items.filter(i => d.sel.has(i.value)).map(i => i.label);
  d.btn.querySelector('.txt').textContent = !names.length ? d.allText : names.length <= 2 ? names.join(', ') : `${names[0]}, ${names[1]}…`;
  const cnt = d.btn.querySelector('.cnt'); cnt.hidden = !(d.multi && names.length > 2); cnt.textContent = names.length;
  d.el.classList.toggle('on', d.multi && names.length > 0);
}
function openDrop(d) {
  DROPS.forEach(x => x !== d && closeDrop(x));
  d.panel.hidden = false; d.btn.setAttribute('aria-expanded', 'true');
  d.panel.classList.remove('right');
  if (d.panel.getBoundingClientRect().right > window.innerWidth - 12) d.panel.classList.add('right');
  if (!d.search.parentElement.hidden) d.search.focus();
}
function closeDrop(d) { if (d.panel.hidden) return; d.panel.hidden = true; d.btn.setAttribute('aria-expanded', 'false'); d.q = ''; d.search.value = ''; renderDropList(d); }
document.addEventListener('click', e => DROPS.forEach(d => { if (!d.el.contains(e.target)) closeDrop(d); }));
document.addEventListener('keydown', e => { if (e.key === 'Escape') DROPS.forEach(closeDrop); });
