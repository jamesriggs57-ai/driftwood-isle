/* =====================================================================
   BOOT: decides how the game starts before the island is built.
   - guest: save lives in this browser only (with warnings), guest limits apply
   - account: island saved on the server, friends can visit
   - visit: a friend's island with your own bag and clams
   Then it loads main.js, which reads window.__BOOT.
   ===================================================================== */
import { Time } from './util.js';
import { LAYOUTS, GUEST_LAYOUTS } from './layouts.js';

const SAVE_KEY = 'driftwood-isle-save-v1';
const PLAYER_KEYS = ['player','clams','inv','seen','rec','friend','pack','tools','toolEver','equip','stats','craft','craftHint','caught','settings'];
const WORLD_KEYS = ['island','seed','placed','ground','plants','cut','home','shops','museum','nativeFruit','layout','house','fund'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);

export async function api(path, opts = {}) {
  try {
    const r = await fetch(path, { method: opts.method || 'GET', headers: opts.body ? { 'content-type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' });
    let d = {}; try { d = await r.json(); } catch {}
    return { ok: r.ok, status: r.status, ...d };
  } catch (e) { return { ok: false, status: 0, error: 'You seem to be offline.' }; }
}

/* ---------- small overlay UI ---------- */
function screen(html) {
  let el = $('#bootUI');
  if (!el) { el = document.createElement('div'); el.id = 'bootUI'; document.body.appendChild(el); }
  el.innerHTML = `<div class="panel"><div class="pb">${html}</div></div>`; el.style.display = 'flex';
  return el;
}
const hideScreen = () => { const el = $('#bootUI'); if (el) el.remove(); };
const wait = () => new Promise(() => {});

function layoutPicker(title) {
  return new Promise(res => {
    const el = screen(`<h2 style="margin:0 0 4px">${esc(title)}</h2><div class="muted" style="margin-bottom:10px">Pick the island you'd like to live on. You can't change it later.</div>
      ${GUEST_LAYOUTS.map(id => `<button class="layoutCard" data-l="${id}"><b>${esc(LAYOUTS[id].name)}</b><span>${esc(LAYOUTS[id].blurb)}</span></button>`).join('')}`);
    el.querySelectorAll('[data-l]').forEach(b => b.onclick = () => res(b.dataset.l));
  });
}

export function signUpScreen(opts = {}) {
  return new Promise(res => {
    const el = screen(`<h2 style="margin:0 0 4px">${opts.title || 'Make an account'}</h2>
      <div class="muted" style="margin-bottom:8px">${opts.sub || 'Your island gets saved online, and you can invite friends to visit. We email you a sign-in link, no password needed.'}</div>
      <label class="f">Email</label><input type="email" id="suEmail" autocomplete="email" maxlength="200">
      <div id="suNew"><label class="f">Your name</label><input type="text" id="suName" maxlength="40" autocomplete="name">
      <label class="f">Character name <span class="muted">(what friends see)</span></label><input type="text" id="suDisp" maxlength="16"></div>
      <div id="suMsg" class="muted" style="min-height:20px;margin-top:8px"></div>
      <button class="btn" id="suGo">Email me a link</button> <button class="btn alt" id="suIn">I already have an account</button> <button class="btn alt" id="suBack">Back</button>`);
    let signIn = false;
    el.querySelector('#suIn').onclick = () => { signIn = !signIn; el.querySelector('#suNew').style.display = signIn ? 'none' : ''; el.querySelector('#suIn').textContent = signIn ? 'I\'m new here' : 'I already have an account'; };
    el.querySelector('#suBack').onclick = () => res(null);
    el.querySelector('#suGo').onclick = async () => {
      const msg = el.querySelector('#suMsg'); msg.textContent = 'Sending...';
      const r = await api('/api/auth/start', { method: 'POST', body: { email: el.querySelector('#suEmail').value, name: signIn ? '' : el.querySelector('#suName').value, displayName: signIn ? '' : el.querySelector('#suDisp').value } });
      if (!r.ok) { msg.textContent = r.error || 'Something went wrong.'; return; }
      if (r.devLink) { msg.innerHTML = `Test server: no email is sent. <a href="${esc(r.devLink)}">Tap here to sign in</a>.`; return; }
      msg.textContent = 'Check your email for a sign-in link. You can close this tab.';
    };
  });
}

/* ---------- start ---------- */
async function start() {
  const B = { mode: 'guest', online: false };
  const t = await api('/api/time');
  if (t.ok && t.now) { B.online = true; Time.serverMs = t.now - Date.now(); }

  // links people arrive on
  const h = location.hash;
  if (h.startsWith('#invite=')) sessionStorage.setItem('dw-invite', h.slice(8));
  if (h.startsWith('#invite=') || h === '#signedin') history.replaceState(null, '', location.pathname);

  const me = B.online ? await api('/api/me') : { ok: false };
  const local = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } })();

  // Invite link
  const code = sessionStorage.getItem('dw-invite');
  if (code && B.online) {
    const inv = await api('/api/invites/' + code);
    if (!inv.ok || !inv.valid) { sessionStorage.removeItem('dw-invite'); await info('Invite', inv.error || 'This invite was already used or has expired. Ask your friend for a new one.'); }
    else if (!me.ok) {
      const el = screen(`<h2 style="margin:0 0 6px">${esc(inv.owner)} invited you!</h2><div style="margin-bottom:10px">${inviteText(inv)}</div><div class="muted">You need an account to visit friends.</div>
        <button class="btn" id="go">Sign up or sign in</button> <button class="btn alt" id="no">Not now</button>`);
      const choice = await new Promise(r => { el.querySelector('#go').onclick = () => r('go'); el.querySelector('#no').onclick = () => r('no'); });
      if (choice === 'go') { await signUpScreen({ title: 'Sign up to visit ' + esc(inv.owner), sub: 'We email you a sign-in link, no password needed. Your invite is saved.' }); return start(); }
      sessionStorage.removeItem('dw-invite');
    } else {
      const el = screen(`<h2 style="margin:0 0 6px">${esc(inv.owner)} invited you!</h2><div style="margin-bottom:12px">${inviteText(inv)}</div>
        <button class="btn" id="go">Accept</button> <button class="btn alt" id="no">No thanks</button>`);
      const choice = await new Promise(r => { el.querySelector('#go').onclick = () => r('go'); el.querySelector('#no').onclick = () => r('no'); });
      sessionStorage.removeItem('dw-invite');
      if (choice === 'go') {
        const a = await api(`/api/invites/${code}/accept`, { method: 'POST' });
        if (!a.ok) await info('Invite', a.error || 'Could not accept the invite.');
        else { const el2 = screen(`<h2 style="margin:0 0 6px">You're friends now</h2><div style="margin-bottom:12px">Visit ${esc(inv.owner)} now, or any time from Friends.</div><button class="btn" id="v">Visit now</button> <button class="btn alt" id="h">Go to my island</button>`);
          const c2 = await new Promise(r => { el2.querySelector('#v').onclick = () => r('v'); el2.querySelector('#h').onclick = () => r('h'); });
          if (c2 === 'v') sessionStorage.setItem('dw-visit', a.ownerId); }
      }
    }
  }

  if (me.ok) {
    B.mode = 'account'; B.user = me.user;
    const mine = await api('/api/save');
    let data = mine.data, version = mine.version || 0;
    if (!data) {
      if (local && local.player) {
        const el = screen(`<h2 style="margin:0 0 6px">Bring your island online?</h2><div style="margin-bottom:12px">This browser has your guest island <b>${esc(local.island)}</b>. Move it to your account so it's saved online and friends can visit. Guest limits are lifted once it's moved.</div>
          <button class="btn" id="y">Move ${esc(local.island)} online</button> <button class="btn alt" id="n">Start a new island instead</button>`);
        const c = await new Promise(r => { el.querySelector('#y').onclick = () => r('y'); el.querySelector('#n').onclick = () => r('n'); });
        if (c === 'y') { const r = await api('/api/save/import', { method: 'POST', body: { data: local } });
          if (r.ok) { data = r.data; version = r.version; localStorage.setItem(SAVE_KEY + '-moved', JSON.stringify(local)); localStorage.removeItem(SAVE_KEY); }
          else await info('Could not move it', r.error || 'Try again later.'); }
      }
      if (!data) { const layout = await layoutPicker('Welcome, ' + me.user.displayName + '!'); data = { v: 2, layout, player: '' }; version = 0; B.prefillName = me.user.displayName;
        // going straight to a friend's island: create your save now so gifts and trades have somewhere to land
        if (sessionStorage.getItem('dw-visit')) { data = { v: 2, layout, player: me.user.displayName, island: '', clams: 1000, inv: [] }; const r = await api('/api/save', { method: 'PUT', body: { data, baseVersion: 0 } }); if (r.ok) version = r.version; } }
    }
    // Visiting a friend?
    const visitId = sessionStorage.getItem('dw-visit');
    if (visitId) {
      sessionStorage.removeItem('dw-visit');
      const v = await api('/api/visit/' + visitId, { method: 'POST', body: { pass: sessionStorage.getItem('dw-pass-' + visitId) || '' } });
      if (!v.ok) await info('Could not visit', v.error || 'Try again later.');
      else {
        sessionStorage.setItem('dw-pass-' + visitId, v.pass);
        const own = data; if (!own.player) own.player = me.user.displayName;
        const S = {}; for (const k of PLAYER_KEYS) if (own[k] !== undefined) S[k] = own[k];
        Object.assign(S, v.world); S.v = own.v || 2; S.day = own.visits?.[visitId]?.day || null;
        if (!S.player) S.player = me.user.displayName;
        Object.assign(B, { mode: 'visit', save: S, own, ownVersion: version, host: v.host, role: v.role, pass: v.pass, hostVersion: v.version,
          startMsg: `Visiting ${v.host.name}'s island${v.host.island ? ', ' + v.host.island : ''}.` + (v.role === 'resident' ? ' You are a resident here.' : '') });
        hideScreen(); return launch(B);
      }
    }
    Object.assign(B, { save: data, version }); hideScreen(); return launch(B);
  }

  // Signed out
  if (local && local.player) { B.save = null; hideScreen(); return launch(B); }
  if (!local || !local.layout) {
    const el = screen(`<h1 style="margin:0">Driftwood Isle</h1><div class="muted" style="margin:2px 0 14px">a cozy little island life</div>
      <button class="btn" id="g">Play as a guest</button><div class="muted" style="margin:6px 0 12px;font-size:13px">Saved in this browser only. Smaller wallet, common finds, small house.</div>
      ${B.online ? '<button class="btn alt" id="a">Sign up or sign in</button><div class="muted" style="margin-top:6px;font-size:13px">Saved online. Invite friends to visit.</div>' : '<div class="muted">Accounts are not available on this copy of the game.</div>'}`);
    const c = await new Promise(r => { el.querySelector('#g').onclick = () => r('g'); const a = el.querySelector('#a'); if (a) a.onclick = () => r('a'); });
    if (c === 'a') { await signUpScreen(); return start(); }
    const layout = await layoutPicker('Choose your island');
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, layout, player: '' }));
  }
  hideScreen(); return launch(B);
}

function inviteText(inv) {
  const visits = inv.standing ? 'You can visit any time.' : 'This invite is for one visit.';
  const role = inv.role === 'resident' ? 'You\'d be a <b>resident</b>: you can change things on the island just like the owner.' : 'You\'d be a <b>visitor</b>: look around, pick fruit and shop, without changing anything.';
  return `Visit <b>${esc(inv.island || 'their island')}</b>. ${role} ${visits}`;
}
function info(title, text) { return new Promise(r => { const el = screen(`<h2 style="margin:0 0 6px">${esc(title)}</h2><div style="margin-bottom:12px">${esc(text)}</div><button class="btn" id="ok">OK</button>`); el.querySelector('#ok').onclick = () => r(); }); }

async function launch(B) {
  window.__BOOT = B;
  const net = await import('./online.js');
  net.setup(B);   // save handlers, live room, friends panel
  await import('./main.js');
  net.afterGame();
}

start();
