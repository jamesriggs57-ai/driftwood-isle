/* =====================================================================
   v1.70 SEARCH in the crafting menus (Woodworking, Cooking, Tools, Design, Sewing).
   A menu puts searchBox() at the top of its list, then marks:
     data-sk="words"  something that can be found (its name and what goes in it)
     data-sgrp        a section that hides when nothing inside it matches
     data-shide       a note that hides while you search, so matches sit right under the box
   and calls bindSearch(root) after each render. Typing filters what's on screen without
   re-rendering, so the keyboard stays up. The words last while the panel is open, so they
   survive a Make tap and a tab switch; resetSearch() clears them (openPanel calls it).
   On a phone, while you search, the panel shrinks to the part of the screen the keyboard
   leaves free (kbOff() puts it back; closePanel calls it).
   ===================================================================== */
let query = '';
export const resetSearch = () => { query = ''; };
export const searchQuery = () => query;
const esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const norm = s => String(s).toLowerCase().replace(/<[^>]+>/g,' ').replace(/['’]/g,'').replace(/\s+/g,' ').trim();
// sk('Oak Chair', ['Wood','Nails']) -> ' data-sk="oak chair wood nails"'
export const sk = (...parts) => ` data-sk="${esc(norm(parts.flat(9).filter(Boolean).join(' ')))}"`;
export const matches = (text, q=query) => { const w=norm(q).split(' ').filter(Boolean); if (!w.length) return true; const t=norm(text); return w.every(x=>t.includes(x)); };

export function searchBox(placeholder='Search'){
  return `<div class="srch" data-srch><input type="text" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="40" placeholder="${esc(placeholder)}" value="${esc(query)}"><button type="button" class="srchx" aria-label="Clear search"${query?'':' hidden'}>&times;</button></div>`
    + `<div class="muted srch0" data-snone hidden></div>`; }

// hide what doesn't match. Returns how many things match.
export function applySearch(root){
  if (!root) return 0; const on = norm(query).length>0; let n=0;
  root.querySelectorAll('[data-shide]').forEach(e=>e.classList.toggle('srch-off', on));
  root.querySelectorAll('[data-sk]').forEach(e=>{ const m=!on || matches(e.dataset.sk); e.classList.toggle('srch-off', !m); if (m) n++; });
  root.querySelectorAll('[data-sgrp]').forEach(g=>{ const any=[...g.querySelectorAll('[data-sk]')].some(e=>!e.classList.contains('srch-off')); g.classList.toggle('srch-off', on && !any); });
  const none=root.querySelector('[data-snone]'); if (none){ none.hidden = !on || n>0; if (on && !n){ none.textContent=''; none.append('Nothing here matches "', Object.assign(document.createElement('b'), { textContent:query.trim() }), '".'); } }
  const x=root.querySelector('.srchx'); if (x) x.hidden=!query;
  return n; }

export function bindSearch(root){
  const box=root && root.querySelector('[data-srch]'); if (!box) return; const inp=box.querySelector('input'), x=box.querySelector('.srchx');
  inp.oninput=()=>{ query=inp.value; applySearch(root); };
  inp.onkeydown=e=>{ if (e.key==='Enter'){ e.preventDefault(); inp.blur(); } else if (e.key==='Escape' && query){ e.preventDefault(); e.stopPropagation(); inp.value=query=''; applySearch(root); } };
  inp.onfocus=()=>kbOn();
  x.onclick=()=>{ inp.value=query=''; applySearch(root); inp.focus(); };
  applySearch(root); }

/* Phones: the on-screen keyboard covers the bottom of the screen but the panel is centred on the whole screen,
   so the list could sit under the keys. While searching, the panel's backdrop is sized to the visible part
   (visualViewport) and the panel sits at its top. It stays that way until the panel closes, so nothing jumps
   under your finger when you tap a result and the keyboard drops. */
const touch = () => typeof matchMedia==='function' && matchMedia('(pointer:coarse)').matches;
let kb=false;
function fit(){ const sc=document.getElementById('scrim'), vv=window.visualViewport; if (!kb || !sc || !vv) return;
  sc.style.top=Math.max(0, vv.offsetTop)+'px'; sc.style.height=vv.height+'px'; sc.style.bottom='auto'; }
export function kbOn(){ if (kb || !touch() || !window.visualViewport) return; const sc=document.getElementById('scrim'); if (!sc) return;
  kb=true; sc.classList.add('kb'); fit(); visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); for (const ms of [120,350,700]) setTimeout(fit, ms); }
export function kbOff(){ if (!kb) return; kb=false; const sc=document.getElementById('scrim');
  if (window.visualViewport){ visualViewport.removeEventListener('resize', fit); visualViewport.removeEventListener('scroll', fit); }
  if (sc){ sc.classList.remove('kb'); sc.style.top=sc.style.height=sc.style.bottom=''; } }
