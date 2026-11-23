/* =====================================================================
   BOOT: decides how the game starts before the island is built.
   - guest: save lives in this browser only (with warnings), guest limits apply
   - account: island saved on the server, friends can visit
   - visit: a friend's island with your own bag and clams
   Then it loads main.js, which reads window.__BOOT.
   ===================================================================== */
import { Time } from './util.js';
import { LAYOUTS, GUEST_LAYOUTS, TERRAINS, TOWNS, generateLayout, drawIslandPreview } from './layouts.js';

const SAVE_KEY = 'driftwood-isle-save-v1';
const PLAYER_KEYS = ['player','clams','inv','seen','rec','friend','pack','tools','toolEver','equip','stats','craft','craftHint','caught','settings','quests','potions','bike','cook','fed'];
const WORLD_KEYS = ['island','seed','placed','ground','plants','cut','home','shops','museum','nativeFruit','layout','house','fund','gen','terra','magic','fruitPicked','refLamps','stumps','town','mentor'];
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

/* Island maker (new accounts): pick terrain and town style, see a map, reroll until you like it */
function islandMaker(title, opts = {}) {
  return new Promise(res => {
    let terrain = 'hilly', town = 'suburbs', seed = (Math.random() * 1e9) | 0;
    const opt = (name, map, cur) => Object.entries(map).map(([k, o]) => `<button class="chip${k === cur ? ' on' : ''}" data-${name}="${k}">${esc(o.name)}</button>`).join('');
    const el = screen(`<h2 style="margin:0 0 4px">${esc(title)}</h2><div class="muted" style="margin-bottom:8px">Make your island. Reroll as many times as you like.</div>
      <b>Terrain</b><div class="chips" id="imT" style="margin:4px 0 2px">${opt('t', TERRAINS, terrain)}</div><div class="muted" id="imTb" style="font-size:13px;min-height:18px"></div>
      <b>Town</b><div class="chips" id="imW" style="margin:4px 0 2px">${opt('w', TOWNS, town)}</div><div class="muted" id="imWb" style="font-size:13px;min-height:18px"></div>
      <canvas id="imMap" width="560" height="560" style="width:100%;max-width:min(320px,34vh);display:block;margin:8px auto;border-radius:18px;border:3px solid #e7d1a6"></canvas>
      <div class="muted" style="font-size:12px;text-align:center;margin-bottom:8px">Red: your home · yellow: shops and museum · purple: a spot for something magical · white: neighbors</div>
      <button class="btn alt" id="imR">Reroll</button> <button class="btn" id="imGo">Live here</button>${opts.cancel ? ' <button class="btn alt" id="imNo">Keep my old island</button>' : ''}`);
    const draw = () => { const L = generateLayout({ seed, terrain, town }); drawIslandPreview(el.querySelector('#imMap'), L);
      el.querySelector('#imTb').textContent = TERRAINS[terrain].blurb; el.querySelector('#imWb').textContent = TOWNS[town].blurb;
      el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === terrain)); el.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', b.dataset.w === town)); };
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { terrain = b.dataset.t; draw(); });
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { town = b.dataset.w; draw(); });
    el.querySelector('#imR').onclick = () => { seed = (Math.random() * 1e9) | 0; draw(); };
    el.querySelector('#imGo').onclick = () => res({ layout: 'gen', gen: { seed, terrain, town }, seed });
    if (opts.cancel) el.querySelector('#imNo').onclick = () => res(null);
    draw();
  });
}

// Resolves true once signed in (the session cookie is set), or null if the player backed out
export function signUpScreen(opts = {}) {
  return new Promise(res => {
    const el = screen(`<div id="suStep1"><h2 style="margin:0 0 4px">${opts.title || 'Make an account'}</h2>
      <div class="muted" style="margin-bottom:8px">${opts.sub || 'Your island gets saved online, and you can invite friends to visit. We email you a 6-digit code, no password needed.'}</div>
      <label class="f">Email</label><input type="email" id="suEmail" autocomplete="email" maxlength="200">
      <div id="suNew"><label class="f">Your name</label><input type="text" id="suName" maxlength="40" autocomplete="name">
      <label class="f">Character name <span class="muted">(what friends see)</span></label><input type="text" id="suDisp" maxlength="16"></div>
      <div id="suMsg" class="muted" style="min-height:20px;margin-top:8px"></div>
      <button class="btn" id="suGo">Email me a code</button> <button class="btn alt" id="suIn">I already have an account</button> <button class="btn alt" id="suBack">Back</button></div>
      <div id="suStep2" style="display:none"><h2 style="margin:0 0 4px">Check your email</h2>
      <div class="muted" style="margin-bottom:8px">We sent a 6-digit code to <b id="suTo"></b>. Type it here. It expires in 15 minutes.</div>
      <input type="text" id="suCode" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123456" style="font-size:28px;letter-spacing:8px;text-align:center">
      <div id="suMsg2" class="muted" style="min-height:20px;margin-top:8px"></div>
      <button class="btn" id="suOk">Sign in</button> <button class="btn alt" id="suAgain">Send a new code</button> <button class="btn alt" id="suChange">Use a different email</button></div>`);
    const $e = s => el.querySelector(s);
    let signIn = false, email = '', busy = false;
    $e('#suIn').onclick = () => { signIn = !signIn; $e('#suNew').style.display = signIn ? 'none' : ''; $e('#suIn').textContent = signIn ? 'I\'m new here' : 'I already have an account'; };
    $e('#suBack').onclick = () => res(null);
    const send = async msg => {
      msg.textContent = 'Sending...';
      const r = await api('/api/auth/start', { method: 'POST', body: { email: $e('#suEmail').value, name: signIn ? '' : $e('#suName').value, displayName: signIn ? '' : $e('#suDisp').value } });
      if (!r.ok) { msg.textContent = r.error || 'Something went wrong.'; return false; }
      email = $e('#suEmail').value.trim();
      $e('#suStep1').style.display = 'none'; $e('#suStep2').style.display = ''; $e('#suTo').textContent = email;
      const m2 = $e('#suMsg2'); m2.textContent = r.devCode ? 'Test server: no email is sent. Your code is ' + r.devCode + '.' : (msg === m2 ? 'New code sent. Use the newest email.' : '');
      $e('#suCode').value = ''; $e('#suCode').focus(); return true;
    };
    $e('#suGo').onclick = () => send($e('#suMsg'));
    $e('#suAgain').onclick = () => send($e('#suMsg2'));
    $e('#suChange').onclick = () => { $e('#suStep2').style.display = 'none'; $e('#suStep1').style.display = ''; $e('#suMsg').textContent = ''; };
    const verify = async () => {
      const code = $e('#suCode').value.replace(/\D/g, ''), msg = $e('#suMsg2');
      if (code.length !== 6) { msg.textContent = 'The code has 6 digits.'; return; }
      if (busy) return; busy = true; msg.textContent = 'Signing in...';
      const r = await api('/api/auth/code', { method: 'POST', body: { email, code } }); busy = false;
      if (!r.ok) { msg.textContent = r.error || 'Something went wrong.'; return; }
      res(true);
    };
    $e('#suOk').onclick = verify;
    $e('#suCode').oninput = () => { if ($e('#suCode').value.replace(/\D/g, '').length === 6) verify(); };
    $e('#suCode').onkeydown = e => { if (e.key === 'Enter') verify(); };
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
      if (choice === 'go') { await signUpScreen({ title: 'Sign up to visit ' + esc(inv.owner), sub: 'We email you a 6-digit code, no password needed. Your invite is saved.' }); return start(); }
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
    // Menu > Start a new island: make a new one in the island maker and replace the saved island right away
    if (data && sessionStorage.getItem('dw-newisland')) {
      sessionStorage.removeItem('dw-newisland');
      const made = await islandMaker('Make a new island', { cancel: true });
      if (made) {
        const fresh = { v: 2, ...made, player: '', island: '', clams: 1000, inv: [] };
        const r = await api('/api/save', { method: 'PUT', body: { data: fresh, baseVersion: version } });
        if (r.ok) { data = fresh; version = r.version; B.prefillName = me.user.displayName; try { localStorage.removeItem('driftwood-cloud-cache-' + me.user.id); } catch {} }
        else await info('Could not start over', r.error || 'Your old island is still saved. Try again in a moment.');
      }
    }
    if (!data) {
      if (local && local.player) {
        const el = screen(`<h2 style="margin:0 0 6px">Keep your guest island?</h2><div style="margin-bottom:12px">This browser has your guest island <b>${esc(local.island)}</b>.</div>
          <div class="notice" style="margin-bottom:8px"><b>Keep ${esc(local.island)}</b><br><span class="muted">Move it to your account as it is. Guest limits are lifted once it's moved.</span></div>
          <div class="notice" style="margin-bottom:12px"><b>Start from scratch</b><br><span class="muted">Make a brand new island: pick the terrain and how the town is laid out. New islands are twice as big. Everything you built, bought and found as a guest stays behind.</span></div>
          <button class="btn" id="y">Keep ${esc(local.island)}</button> <button class="btn alt" id="n">Start from scratch</button>`);
        const c = await new Promise(r => { el.querySelector('#y').onclick = () => r('y'); el.querySelector('#n').onclick = () => r('n'); });
        if (c === 'y') { const r = await api('/api/save/import', { method: 'POST', body: { data: local } });
          if (r.ok) { data = r.data; version = r.version; localStorage.setItem(SAVE_KEY + '-moved', JSON.stringify(local)); localStorage.removeItem(SAVE_KEY); }
          else await info('Could not move it', r.error || 'Try again later.'); }
      }
      if (!data) { const made = await islandMaker('Welcome, ' + me.user.displayName + '!'); data = { v: 2, ...made, player: '' }; version = 0; B.prefillName = me.user.displayName;
        // going straight to a friend's island: create your save now so gifts and trades have somewhere to land
        if (sessionStorage.getItem('dw-visit')) { data = { v: 2, ...made, player: me.user.displayName, island: '', clams: 1000, inv: [] }; const r = await api('/api/save', { method: 'PUT', body: { data, baseVersion: 0 } }); if (r.ok) version = r.version; } }
    }
    // Visiting a friend?
    const visitId = sessionStorage.getItem('dw-visit');
    if (visitId) {
      sessionStorage.removeItem('dw-visit');
      const v = await api('/api/visit/' + visitId, { method: 'POST', body: { pass: sessionStorage.getItem('dw-pass-' + visitId) || '' } });
      if (!v.ok) { document.documentElement.classList.remove('magicret'); await info('Could not visit', v.error || 'Try again later.'); }
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
