/* =====================================================================
   ONLINE: cloud saves, friends and invites, mailbox, live visits, trades.
   Works alongside main.js through window.__game (S, net hooks) and window.__BOOT.
   ===================================================================== */
import { api, signUpScreen } from './boot.js';

const SAVE_KEY = 'driftwood-isle-save-v1';
const PLAYER_KEYS = ['player','clams','inv','seen','rec','friend','pack','tools','toolEver','toolOffer','equip','stats','craft','craftHint','caught','settings','quests','potions','bike','cook','fed','rare','wardrobe','ach','look','contacts','letters','talk','woodLater'];
const WORLD_KEYS = ['island','seed','placed','ground','plants','cut','home','shops','museum','nativeFruit','layout','house','fund','gen','terra','magic','fruitPicked','refLamps','stumps','town','mentor','gardens','story','reef','pinesCut'];
const EMOTES = [['wave','Hi!'],['happy','Yay!'],['laugh','Haha!'],['heart','Love it!'],['surprised','Whoa!'],['sad','Aww...'],['thinking','Hmm...'],['sleepy','Zzz'],['thanks','Thanks!'],['bye','Bye!']];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const G = () => window.__game;
let B = null;

/* ---------- saving ---------- */
let ownVer = 0, hostVer = 0, pending = null, timer = null, inflight = null, lastWorld = '', blocked = false;
// Last island copy we know the server has, per part. Used to merge when someone else changed the island meanwhile.
let base = {};
const snap = d => Object.fromEntries(WORLD_KEYS.map(k => [k, JSON.stringify(d[k] ?? null)]));
// Beach finds respawn every day on their own; when visiting they are your own copy and never sent back
const worldForPush = S => { const w = pick(S, WORLD_KEYS); if (B.mode === 'visit' && Array.isArray(w.ground)) w.ground = w.ground.filter(g => !g.beach).concat(JSON.parse(base.ground || '[]').filter(g => g.beach)); return w; };
/* v1.34: deep three-way merge of the island. For every part: if only one side changed it, that side's version is used;
   if both changed it, objects are merged key by key and lists item by item (our additions and removals are re-applied
   on top of theirs). Only when both changed the very same value does theirs win. Unchanged things keep the exact same
   objects, so furniture, plants and so on in the scene stay hooked up to them. */
const J = v => JSON.stringify(v ?? null);
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function merge3(b, l, s) {
  const jl = J(l), js = J(s); if (jl === js) return l;
  if (js === J(b)) return l;                                   // only we changed it
  if (Array.isArray(l) && Array.isArray(s)) return mergeList(Array.isArray(b) ? b : [], l, s);
  if (isObj(l) && isObj(s)) { const bb = isObj(b) ? b : {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(s)])) { const v = merge3(bb[k], l[k], s[k]); if (v === undefined) delete l[k]; else l[k] = v; }
    return l; }
  return s;                                                    // only they changed it, or both changed one value
}
function mergeList(b, l, s) {
  const count = a => { const m = new Map(); for (const x of a) { const k = J(x); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const Bc = count(b), Lc = count(l), removed = new Map(), added = [], pool = new Map(), seen = new Map(), used = new Set();
  for (const [k, n] of Bc) { const d = n - (Lc.get(k) || 0); if (d > 0) removed.set(k, d); }
  for (const x of l) { const k = J(x), n = (seen.get(k) || 0) + 1; seen.set(k, n); if (n > (Bc.get(k) || 0)) added.push(x); (pool.get(k) || pool.set(k, []).get(k)).push(x); }
  const out = [];
  for (const x of s) { const k = J(x), r = removed.get(k) || 0; if (r > 0) { removed.set(k, r - 1); continue; }
    const p = pool.get(k), mine = p && p.length ? p.shift() : null; if (mine) used.add(mine); out.push(mine || x); }
  for (const x of added) if (!used.has(x)) out.push(x);        // ours, unless they made the identical change
  return out;
}
function mergeWorld(S, server) {
  const changed = [];
  for (const k of WORLD_KEYS) { if (server[k] === undefined) continue;
    const before = J(S[k]), v = merge3(base[k] !== undefined ? JSON.parse(base[k]) : null, S[k], server[k]);
    S[k] = v; if (J(v) !== before) changed.push(k); }
  base = snap(server); return { took: changed.length, changed };
}
const own = () => B.mode === 'visit' ? B.own : null;

export function setup(boot) {
  B = boot; B.flush = flush;   // the wizard's spells save and reload the island
  B.sendLive = m => send(m);   // main.js sends bonks through the live room
  B.livePeers = () => [...peers.values()].map(p => ({ id: p.id, name: p.name }));   // v1.34: who's here, for group trips
  ownVer = (B.mode === 'visit' || B.mode === 'trip') ? B.ownVersion : (B.version || 0); hostVer = B.hostVersion || 0;
  // v1.26 boat trips: your bag and clams save to your own island's save; the trip island lives in this tab only
  if (B.mode === 'trip') B.onSave = S => { try { sessionStorage.setItem('dw-trip-world', JSON.stringify({ ground: S.ground, cut: S.cut, stumps: S.stumps, plants: S.plants, day: S.day, placed: S.placed })); } catch {} queue(); };
  if (B.mode === 'account') B.onSave = S => { cacheLocal(S); queue(); };
  if (B.mode === 'visit') { base = snap(B.save); lastWorld = JSON.stringify(worldForPush(B.save)); B.onSave = () => queue(); }
  if (B.mode === 'account' && B.save) { base = snap(B.save); lastAnnounced = J(pick(B.save, WORLD_KEYS)); }
}
const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
function cacheLocal(S) { try { localStorage.setItem('driftwood-cloud-cache-' + B.user.id, JSON.stringify(S)); } catch {} }
function queue() { if (blocked) return; clearTimeout(timer); timer = setTimeout(flush, 2000); }

// Push the current state to the server now. Resolves once it's stored (or failed).
export function flush() {
  clearTimeout(timer); if (blocked) return Promise.resolve(false); if (B.mode !== 'account' && B.mode !== 'visit' && B.mode !== 'trip') return Promise.resolve(true);
  // one push at a time, in order, so two pushes never race with the same version
  inflight = (inflight || Promise.resolve()).then(doFlush, doFlush);
  return inflight;
}
async function doFlush() {
  if (blocked) return false;
  {
    const S = G().S;
    if (B.mode === 'account') {
      for (let tries = 0; tries < 3; tries++) {
        const r = await api('/api/save', { method: 'PUT', body: { data: S, baseVersion: ownVer } });
        if (r.ok) { ownVer = r.version; base = snap(S); announce(r.version); return true; }
        if (r.status !== 409) return false;
        // someone (a resident, or you on another device) saved in between: merge the island and try again
        const cur = await api('/api/save'); if (!cur.ok || !cur.data) return false;
        const m = mergeWorld(S, cur.data); ownVer = cur.version; showWorld(m.changed);   // v1.34: shown live, no reload
      }
      conflict('Your island keeps changing somewhere else.'); return false;
    }
    if (B.mode === 'trip') {
      // v1.33: a resident (or you on another device) changing your island while you're away used to stop all saving here,
      // and everything gathered on the trip after that was lost. Now: fetch the newer island and save your bag on top of it.
      for (let tries = 0; tries < 3; tries++) {
        const mine = { ...B.own, ...pick(S, PLAYER_KEYS) };
        const r = await api('/api/save', { method: 'PUT', body: { data: mine, baseVersion: ownVer } });
        if (r.ok) { ownVer = r.version; B.own = mine; return true; }
        if (r.status !== 409 || !(await refreshOwn())) return false;
      }
      conflict('Your island keeps changing somewhere else.'); return false;
    }
    // visiting: your bag/clams go to your own save; island changes (residents only) go to the host
    let ok = false;
    for (let tries = 0; tries < 3; tries++) {   // v1.33: same retry as trips (your own island may change while you visit)
      const mine = { ...B.own, ...pick(S, PLAYER_KEYS) }; mine.visits = { ...(B.own.visits || {}), [B.host.id]: { day: S.day } };
      const r = await api('/api/save', { method: 'PUT', body: { data: mine, baseVersion: ownVer } });
      if (r.ok) { ownVer = r.version; B.own = mine; ok = true; break; }
      if (r.status !== 409 || !(await refreshOwn())) break;
      if (tries === 2) conflict('Your own island keeps changing somewhere else.');
    }
    if (B.role === 'resident') {
      for (let tries = 0; tries < 3; tries++) {
        const w = worldForPush(S), ws = JSON.stringify(w);
        if (ws === lastWorld) break;
        const r2 = await api(`/api/visit/${B.host.id}/world`, { method: 'PUT', body: { pass: B.pass, world: w, baseVersion: hostVer } });
        if (r2.ok) { hostVer = r2.version; lastWorld = ws; base = snap(w); send({ t: 'world', v: hostVer }); break; }
        if (r2.status === 409 && r2.world) { const m = mergeWorld(S, r2.world); hostVer = r2.version; lastWorld = JSON.stringify(worldForPush(r2.world)); showWorld(m.changed); continue; }
        ok = false; if (r2.status === 403) G().net.toast(r2.error || 'Your visit has ended.'); break;
      }
    }
    return ok;
  }
}
// v1.33: while away (trip or visit), reload your own save's island part from the server. Your bag and other player
// things always come from this device, so nothing you gathered is lost; the island part is whatever the server has now.
async function refreshOwn() {
  const cur = await api('/api/save'); if (!cur.ok || !cur.data) return false;
  B.own = cur.data; ownVer = cur.version; return true;
}
/* v1.34 live island sync */
let lastAnnounced = '';
function announce(v) {   // owner: after a save that changed the island part, tell everyone in the live room
  const w = J(pick(G().S, WORLD_KEYS)); if (w === lastAnnounced) return; lastAnnounced = w; send({ t: 'world', v });
}
function showWorld(keys) { if (keys && keys.length) G().net.applyWorld(keys); }
async function doPull() {
  const S = G().S;
  if (B.mode === 'account') {
    const cur = await api('/api/save'); if (!cur.ok || !cur.data || cur.version <= ownVer) return;
    const m = mergeWorld(S, cur.data); ownVer = cur.version; lastAnnounced = J(pick(cur.data, WORLD_KEYS)); showWorld(m.changed);
    if (J(pick(S, WORLD_KEYS)) !== lastAnnounced) queue();   // we had unsaved island changes: save them on top
  } else if (B.mode === 'visit') {
    const r = await api(`/api/visit/${B.host.id}/world?pass=${encodeURIComponent(B.pass)}`); if (!r.ok || !r.world || r.version <= hostVer) return;
    const m = mergeWorld(S, r.world); hostVer = r.version; lastWorld = JSON.stringify(worldForPush(r.world)); showWorld(m.changed);
    if (B.role === 'resident' && JSON.stringify(worldForPush(S)) !== lastWorld) queue();
  }
}
// pulls go through the same queue as saves, so a pull and a save never race on the version number
function pullWorld() { if (blocked) return; inflight = (inflight || Promise.resolve()).then(doPull, doPull).catch(() => {}); }
function conflict(why) {
  blocked = true; clearTimeout(timer);
  banner(`${why} Reload to get the latest copy. (Changes from the last few seconds here may be lost.)`, 'Reload', () => location.reload(), true);
}

/* ---------- live room ---------- */
let ws = null, wsTries = 0, lastPos = '', posTimer = null, peers = new Map(), trade = null;
const liveOwner = () => B.mode === 'visit' ? B.host.id : B.mode === 'account' ? B.user.id : null;
// v1.34: friends on a boat trip together share a room named after the trip
const tripRoom = () => B.mode === 'trip' && B.trip && /^[a-f0-9]{24}$/.test(B.trip.room || '') ? B.trip.room : null;
function connect() {
  const owner = liveOwner(), room = tripRoom(); if (!owner && !room) return;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(room ? `${proto}//${location.host}/api/live/trip/${room}` : `${proto}//${location.host}/api/live/${owner}` + (B.mode === 'visit' ? `?pass=${encodeURIComponent(B.pass)}` : ''));
  ws.onopen = () => { wsTries = 0; lastPos = ''; };
  ws.onmessage = ev => { let m; try { m = JSON.parse(ev.data); } catch { return; } onLive(m); };
  ws.onclose = ev => { for (const id of peers.keys()) G().net.remoteLeave(id); peers.clear(); renderHere(); ws = null;
    if (ev.code === 4000) return;   // opened in another tab
    setTimeout(connect, Math.min(30000, 1000 * 2 ** wsTries++)); };
}
const send = m => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); };
function onLive(m) {
  const net = G().net;
  switch (m.t) {
    case 'hello': if (m.you) { myId = m.you; B.myId = m.you; } for (const p of m.peers) { peers.set(p.id, p); net.remoteUpsert(p.id, p.name, p.st); } renderHere(); break;
    case 'join': peers.set(m.id, m); net.remoteUpsert(m.id, m.name); net.toast(`${m.name} ${m.id === liveOwner() ? 'is home' : 'arrived'}!`); renderHere(); break;
    case 'leave': { const p = peers.get(m.id); peers.delete(m.id); net.remoteLeave(m.id); if (p) net.toast(`${p.name} left.`); if (trade && trade.with === m.id) trade = null; renderHere(); break; }
    case 'pos': { const p = peers.get(m.id); if (p) { p.st = m; net.remoteUpsert(m.id, p.name, m); } break; }
    case 'emote': net.remoteEmote(m.id === myId ? 'me' : m.id, m.e); break;
    case 'game': if (m.id !== myId && m.d) { if (m.d.trip) { if (net.trip) net.trip(m.id, peers.get(m.id)?.name || 'A friend', m.d); } else net.party(m.id, m.d); } break;   // party games (v1.14), group trips (v1.34)
    case 'bonk': if (m.id === myId) break; if (m.to === myId) net.bonked('me', m.id, +m.dx || 0, +m.dz || 0); else if (peers.has(m.to)) net.bonked(m.to, m.id, +m.dx || 0, +m.dz || 0); break;
    case 'world': pullWorld(); break;   // v1.34: someone changed the island: fetch and show it live
    case 'gift': openMail(true, m.name); break;
    case 'trade-ask': askTrade(m); break;
    case 'trade-open': trade = { id: m.trade, with: m.with, offer: {}, ok: {}, mine: [] }; openPanel('here'); break;
    case 'trade-state': if (trade && trade.id === m.trade) { trade.offer = m.offer; trade.ok = m.ok; if (panelTab === 'here') renderPanel(); } break;
    case 'trade-end': if (trade && trade.id === m.trade) {
        if (m.done) { applyServerBag(m); net.toast('Trade done!'); } else net.toast('Trade cancelled' + (m.by && m.by !== 'disconnect' ? ': ' + m.by : '.'));
        trade = null; if (panelTab === 'here') renderPanel(); } break;
  }
}
let myId = null;
function applyServerBag(r) {
  if (B.mode === 'visit') { B.own.inv = r.inv; if (r.seen) B.own.seen = r.seen; }
  ownVer = r.version; G().net.setInventory(r.inv, r.seen, r.equip);
}
function tickPos() {
  const g = G(); if (!g || !g.net.started || !ws || ws.readyState !== 1) return;
  const st = g.net.playerState(), k = JSON.stringify(st); if (k === lastPos) return; lastPos = k; send({ t: 'pos', ...st });
}

/* ---------- banner + panel UI ---------- */
function banner(text, btn, fn, sticky) {
  let el = $('#netBanner'); if (!el) { el = document.createElement('div'); el.id = 'netBanner'; document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(text)}</span>${btn ? `<button class="btn">${esc(btn)}</button>` : ''}${sticky ? '' : '<button class="x" aria-label="Close">x</button>'}`;
  el.style.display = 'flex'; if (btn) el.querySelector('.btn').onclick = fn; const x = el.querySelector('.x'); if (x) x.onclick = () => el.style.display = 'none';
}
let panelTab = 'island';
function openPanel(tab) { panelTab = tab || panelTab; $('#netPanel').classList.add('show'); renderPanel(); }
function closePanel() { $('#netPanel').classList.remove('show'); }
const online = () => B.online && (B.mode === 'account' || B.mode === 'visit');
const tabs = () => online() ? [['island', B.mode === 'visit' ? 'Visit' : 'Island'], ['friends', 'Friends'], ['mail', 'Mail'], ['here', 'Here now']] : [['island', 'Account']];

async function renderPanel() {
  const body = $('#netBody'), S = G().S;
  $('#netTabs').innerHTML = tabs().map(([k, n]) => `<button class="tab${k === panelTab ? ' on' : ''}" data-k="${k}">${n}</button>`).join('');
  $('#netTabs').querySelectorAll('[data-k]').forEach(b => b.onclick = () => { panelTab = b.dataset.k; renderPanel(); });
  if (panelTab === 'island') {
    if (B.mode === 'guest') {
      body.innerHTML = `<div class="notice warn"><b>Guest island</b><br>Your island is saved only in this browser. Clearing browser data, private browsing, or switching phones will lose it, and some phone browsers delete data from sites you haven't visited in a while.</div>
        <div class="notice">Guest limits: wallet up to 10,000 clams, common and uncommon finds only, house up to 12 floor squares, fewer house styles.</div>
        ${B.online ? '<button class="btn" id="mkAcct">Make an account and keep this island</button>' : '<div class="muted">Accounts are not available on this copy of the game.</div>'}`;
      const b = $('#mkAcct'); if (b) b.onclick = async () => { closePanel(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(G().S)); } catch {} const ok = await signUpScreen({ sub: 'Your guest island moves to your account after you sign in. We email you a 6-digit code, no password needed.' }); if (ok) { location.reload(); return; } const el = $('#bootUI'); if (el) el.remove(); };
    } else if (B.mode === 'trip') {
      body.innerHTML = `<div class="notice">On a boat trip to <b>${esc((B.trip && B.trip.name) || 'a little island')}</b>.<br><span class="muted">Your bag and clams are saved to your account as you go. Talk to Skipper Wick on the dock to sail home.</span></div>`;
    } else if (B.mode === 'visit') {
      body.innerHTML = `<div class="notice">Visiting <b>${esc(B.host.name)}</b>'s island${B.host.island ? ', ' + esc(B.host.island) : ''}, as a <b>${B.role}</b>.<br><span class="muted">${B.role === 'resident' ? 'You can change things here like the owner can.' : 'You can look around, pick fruit, dig fossils and shop. Your bag and clams are your own.'}</span></div>
        <button class="btn" id="giftHost">Leave a gift in ${esc(B.host.name)}'s mailbox</button> <button class="btn alt" id="goHome">Go home</button>`;
      $('#giftHost').onclick = () => pickGift(B.host.id, B.host.name, false);
      $('#goHome').onclick = async () => { await flush(); location.href = location.pathname; };
    } else {
      body.innerHTML = `<div class="notice">Signed in as <b>${esc(B.user.displayName)}</b> <span class="muted">(${esc(B.user.email)})</span><br><span class="muted">Your island is saved online.</span></div>
        <button class="btn alt" id="logout">Sign out</button>
        <div style="margin-top:18px"><button class="btn sm alt" id="delAcct">Delete my account</button></div>`;
      $('#delAcct').onclick = async () => { const t = window.prompt ? window.prompt('This deletes your island, friends and mail for good. Type DELETE to confirm.') : null; if (t !== 'DELETE') return;
        const r = await api('/api/me', { method: 'DELETE', body: { confirm: 'DELETE' } }); if (r.ok) { blocked = true; location.href = location.pathname; } else G().net.toast(r.error || 'Could not delete.'); };
      $('#logout').onclick = async () => { await flush(); await api('/api/auth/logout', { method: 'POST' }); location.href = location.pathname; };
    }
  }
  if (panelTab === 'friends') {
    body.innerHTML = '<div class="muted">Loading...</div>';
    const f = await api('/api/friends'); if (panelTab !== 'friends') return;
    const canInvite = B.mode === 'account';
    body.innerHTML = `${canInvite ? `<div class="notice"><b>Invite a friend</b><br><span class="muted">Only people you send a link to can visit. There's no way for strangers to find your island.</span>
        <label class="f">They can <select id="invRole"><option value="visitor">Visit (look, pick fruit, shop)</option><option value="resident">Live here (change anything, like you)</option></select></label>
        <label class="f">For <select id="invStand"><option value="0">One visit</option><option value="1">Any time (standing invite)</option></select></label>
        <div id="resWarn" class="notice warn" style="display:none">Residents can cut trees, move things and change your island just like you. Only invite people you know in real life and trust.</div>
        <button class="btn" id="mkInv">Make invite link</button><div id="invOut"></div></div>` : ''}
      <b>Islands you can visit</b>${(f.canVisit || []).length ? f.canVisit.map(v => `<div class="row"><span><b>${esc(v.name)}</b>${v.island ? ' · ' + esc(v.island) : ''}<br><span class="muted">${v.role}${v.standing ? ', any time' : ', ' + v.visitsLeft + ' visit left'}</span></span>
        <span><button class="btn sm" data-visit="${v.ownerId}" ${!v.standing && v.visitsLeft <= 0 ? 'disabled' : ''}>Visit</button> <button class="btn sm alt" data-gift="${v.ownerId}" data-name="${esc(v.name)}">Gift</button> <button class="btn sm alt" data-leave="${v.ownerId}">Remove</button></span></div>`).join('') : '<div class="muted">None yet. Ask a friend for an invite link.</div>'}
      ${canInvite ? `<b style="display:block;margin-top:12px">Who can visit you</b>${(f.visitors || []).length ? f.visitors.map(v => `<div class="row"><span><b>${esc(v.name)}</b><br><span class="muted">${v.role}${v.standing ? ', any time' : ', ' + v.visitsLeft + ' visit left'}</span></span>
        <span><button class="btn sm alt" data-role="${v.friendId}" data-r="${v.role}" data-s="${v.standing ? 1 : 0}">${v.role === 'resident' ? 'Make visitor' : 'Make resident'}</button> <button class="btn sm alt" data-gift="${v.friendId}" data-name="${esc(v.name)}">Gift</button> <button class="btn sm alt" data-revoke="${v.friendId}">Remove</button></span></div>`).join('') : '<div class="muted">Nobody yet.</div>'}` : ''}`;
    const role = $('#invRole'); if (role) role.onchange = () => $('#resWarn').style.display = role.value === 'resident' ? '' : 'none';
    const mk = $('#mkInv'); if (mk) mk.onclick = async () => {
      if (role.value === 'resident' && !confirmBox('Residents can change or ruin your island. Only invite people you know in real life and trust. Make a resident invite?')) return;
      const r = await api('/api/invites', { method: 'POST', body: { role: role.value, standing: $('#invStand').value === '1' } });
      if (!r.ok) { $('#invOut').textContent = r.error || 'Could not make an invite. Try again.'; return; }
      $('#invOut').innerHTML = `<div class="copyRow"><input readonly value="${esc(r.url)}"><button class="btn sm" id="cp">Copy</button></div><div class="muted">Works once, for one person, for 14 days.</div>`;
      $('#cp').onclick = async () => { try { await navigator.clipboard.writeText(r.url); $('#cp').textContent = 'Copied'; } catch { $('#invOut input').select(); } };
    };
    body.querySelectorAll('[data-visit]').forEach(b => b.onclick = async () => { await flush(); sessionStorage.setItem('dw-visit', b.dataset.visit); location.reload(); });
    body.querySelectorAll('[data-gift]').forEach(b => b.onclick = () => pickGift(b.dataset.gift, b.dataset.name, false));
    body.querySelectorAll('[data-leave]').forEach(b => b.onclick = async () => { if (!confirmBox('Remove this island from your list? You would need a new invite to visit again.')) return; await api(`/api/links/${b.dataset.leave}/${B.user.id}`, { method: 'DELETE' }); renderPanel(); });
    body.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => { if (!confirmBox('Stop this friend from visiting your island?')) return; await api(`/api/links/${B.user.id}/${b.dataset.revoke}`, { method: 'DELETE' }); renderPanel(); });
    body.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => { const to = b.dataset.r === 'resident' ? 'visitor' : 'resident';
      if (to === 'resident' && !confirmBox('Residents can change or ruin your island. Only do this for people you know in real life and trust.')) return;
      await api(`/api/links/${B.user.id}/${b.dataset.role}`, { method: 'PATCH', body: { role: to, standing: b.dataset.s === '1' } }); renderPanel(); });
  }
  if (panelTab === 'mail') {
    body.innerHTML = '<div class="muted">Loading...</div>';
    const r = await api('/api/mail'); if (panelTab !== 'mail') return;
    const list = r.mail || [];
    body.innerHTML = `<div class="muted" style="margin-bottom:8px">Gifts and letters from friends land here. Only items can be sent, never clams.</div>` + (list.length ? list.map(m => m.item.letter && !m.item.id ? `<div class="row"><span><b>A letter</b><br><span class="muted">from ${esc(m.from)}</span></span><button class="btn sm" data-claim="${m.id}">Read</button></div>` : `<div class="row"><span class="it"><img src="${G().itemThumb(m.item.id)}"><span><b>${esc(G().ITEMS[m.item.id]?.name || m.item.id)}</b>${m.item.letter ? ' <span class="muted">and a letter</span>' : ''}<br><span class="muted">from ${esc(m.from)}</span></span></span><button class="btn sm" data-claim="${m.id}">Take</button></div>`).join('') : '<div class="muted">Your mailbox is empty.</div>');
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => { b.disabled = true; const ok = await claim(+b.dataset.claim); if (ok === true) renderPanel(); else if (!ok) b.disabled = false; });
  }
  if (panelTab === 'here') renderHere();
}

function renderHere() {
  if (!$('#netPanel')?.classList.contains('show') || panelTab !== 'here') return;
  const body = $('#netBody'), S = G().S, ITEMS = G().ITEMS;
  if (trade) {
    const other = peers.get(trade.with)?.name || 'Friend';
    const theirs = (trade.offer[trade.with] || []), mine = new Set((trade.offer[myId] || []).map(i => i.slot));
    body.innerHTML = `<div class="notice"><b>Trading with ${esc(other)}</b><br><span class="muted">Items only. Both of you tap Ready to swap. Changing an offer un-readies both.</span></div>
      <b>They offer</b><div class="grid">${theirs.length ? theirs.map(i => `<div class="slot"><img src="${G().itemThumb(i.id)}"><span>${esc(ITEMS[i.id]?.name || i.id)}</span></div>`).join('') : '<span class="muted">Nothing yet</span>'}</div>
      <b>Tap your items to offer (up to 8)</b><div class="grid">${S.inv.map((e, i) => `<div class="slot${mine.has(i) ? ' on' : ''}" data-s="${i}"><img src="${G().itemThumb(e.id)}"><span>${esc(ITEMS[e.id]?.name || e.id)}${e.n > 1 ? ' x' + e.n : ''}</span></div>`).join('')}</div>
      <div style="margin-top:10px"><button class="btn" id="tOk" ${trade.ok[myId] ? 'disabled' : ''}>${trade.ok[myId] ? 'Ready, waiting...' : 'Ready'}</button> <button class="btn alt" id="tNo">Cancel</button> ${trade.ok[trade.with] ? '<span class="muted">' + esc(other) + ' is ready</span>' : ''}</div>`;
    body.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { const i = +el.dataset.s; const cur = (trade.offer[myId] || []).filter(x => x.slot !== i);
      if (cur.length === (trade.offer[myId] || []).length) { if (cur.length >= 8) return; if (ITEMS[S.inv[i].id]?.noGift) { G().net.toast('That one stays with you.'); return; } cur.push({ slot: i, id: S.inv[i].id }); }
      send({ t: 'trade-offer', trade: trade.id, items: cur }); });
    $('#tOk').onclick = async () => { await flush(); send({ t: 'trade-ok', trade: trade.id, version: ownVer }); };
    $('#tNo').onclick = () => { send({ t: 'trade-cancel', trade: trade.id }); };
    return;
  }
  const list = [...peers.values()];
  body.innerHTML = `<button class="btn" id="partyGo" style="margin-bottom:10px">Party games</button><br><b>Say something</b><div class="emotes">${EMOTES.map(([k, t]) => `<button class="btn sm alt" data-e="${k}">${t}</button>`).join('')}</div>
    <b style="display:block;margin-top:10px">On this island now</b>${list.length ? list.map(p => `<div class="row"><span><b>${esc(p.name)}</b><br><span class="muted">${p.role === 'owner' ? 'lives here' : p.role}</span></span><span><button class="btn sm" data-give="${p.id}" data-name="${esc(p.name)}">Give</button> <button class="btn sm alt" data-trade="${p.id}">Trade</button></span></div>`).join('') : `<div class="muted">Nobody else is here right now.${B.mode === 'account' ? ' Friends you invite show up here when they visit.' : ''}</div>`}`;
  body.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { send({ t: 'emote', e: b.dataset.e }); });
  $('#partyGo').onclick = () => { closePanel(); G().party.open(); };
  body.querySelectorAll('[data-give]').forEach(b => b.onclick = () => pickGift(b.dataset.give, b.dataset.name, true));
  body.querySelectorAll('[data-trade]').forEach(b => b.onclick = () => { send({ t: 'trade-ask', to: b.dataset.trade }); G().net.toast('Asked to trade...'); });
}
function askTrade(m) {
  banner(`${m.name} wants to trade items.`, 'Trade', () => { $('#netBanner').style.display = 'none'; send({ t: 'trade-accept', trade: m.trade }); });
}
function confirmBox(text) { return window.confirm ? window.confirm(text) : true; }

// Choose an item from your bag to send. direct=true: they're here, it goes straight into their bag.
function pickGift(toId, toName, direct) {
  openPanel(panelTab); const body = $('#netBody'), S = G().S, ITEMS = G().ITEMS;
  body.innerHTML = `<div class="notice">Pick an item to ${direct ? 'give to' : 'mail to'} <b>${esc(toName)}</b>. One at a time. Clams can't be sent.</div>
    <div class="grid">${S.inv.map((e, i) => `<div class="slot" data-s="${i}"><img src="${G().itemThumb(e.id)}"><span>${esc(ITEMS[e.id]?.name || e.id)}${e.n > 1 ? ' x' + e.n : ''}</span></div>`).join('') || '<span class="muted">Your bag is empty.</span>'}</div>
    <button class="btn alt" id="gBack" style="margin-top:8px">Back</button>`;
  $('#gBack').onclick = () => renderPanel();
  body.querySelectorAll('[data-s]').forEach(el => el.onclick = async () => {
    const i = +el.dataset.s, it = S.inv[i]; if (!it) return;
    if (ITEMS[it.id]?.noGift) { G().net.toast('That one stays with you.'); return; }   // v1.38 relics and story parts
    await flush();
    const r = await api('/api/mail', { method: 'POST', body: { to: toId, slot: i, id: it.id, direct, baseVersion: ownVer } });
    if (!r.ok) { G().net.toast(r.error === 'conflict' ? 'Your bag changed. Try again.' : (r.error || 'Could not send.')); return; }
    applyServerBag(r); G().net.toast(`Sent ${ITEMS[it.id].name} to ${toName}.`); if (direct) send({ t: 'gift', to: toId }); renderPanel();
  });
}
async function claim(id) {
  await flush();
  const r = await api(`/api/mail/${id}/claim`, { method: 'POST', body: { baseVersion: ownVer } });
  if (!r.ok) { G().net.toast(r.error === 'full' ? 'Your bag is full. Make room first.' : r.error === 'conflict' ? 'Your bag changed. Try again.' : (r.error || 'Could not open it.')); return false; }
  if (r.inv) applyServerBag(r); else if (r.version) ownVer = r.version;
  if (r.item && r.item.id) G().net.toast(`You got ${G().ITEMS[r.item.id]?.name || 'a gift'}!`);
  if (r.item && r.item.letter){ showLetter(r.item, r.from || 'a friend'); return 'letter'; }
  return true;
}
// v1.27: a friend's template letter, shown in the mail tab
function showLetter(item, from) { const L = G().LETTERS && G().LETTERS[item.letter]; if (!L) return; const S = G().S;
  const lines = L.text.map(l => l.replace(/\{to\}/g, S.player || 'friend').replace(/\{p\}/g, item.fromName || from).replace(/\{isle\}/g, item.isle || 'their island'));
  const body = $('#netBody'); body.innerHTML = `<div class="letter">${lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>${item.id ? `<div class="muted">A ${esc(G().ITEMS[item.id]?.name || 'gift')} was tucked inside. It's in your bag.</div>` : ''}<button class="btn alt" id="lOk" style="margin-top:8px">Back to mail</button>`;
  $('#lOk').onclick = () => renderPanel(); }
// Someone handed us something in person: take it right away if there's room
async function openMail(directOnly, fromName) {
  const r = await api('/api/mail'); const list = (r.mail || []).filter(m => !directOnly || m.direct);
  for (const m of list) { const ok = await claim(m.id); if (!ok) { G().net.toast(`${fromName || 'A friend'} sent you something. It's in your mailbox.`); break; } }
}

/* ---------- after the game has loaded ---------- */
export function afterGame() {
  // panel markup
  const p = document.createElement('div'); p.id = 'netPanel';
  p.innerHTML = `<div class="sheet"><div class="head"><div id="netTabs"></div><button class="x" id="netX" aria-label="Close">x</button></div><div id="netBody"></div></div>`;
  document.body.appendChild(p); $('#netX').onclick = closePanel; p.onclick = e => { if (e.target === p) closePanel(); };
  // HUD button
  const bar = $('#bar'), menu = $('#bMenu');
  const btn = document.createElement('button'); btn.className = 'rbtn'; btn.id = 'bNet';
  btn.innerHTML = `<svg viewBox="0 0 32 32"><circle cx="11" cy="12" r="4.5" fill="#f2c6a8" stroke="#8b6b50" stroke-width="2"/><circle cx="22" cy="13" r="4" fill="#bfe0d8" stroke="#3f7f78" stroke-width="2"/><path d="M3 26c1-5 4-7 8-7s7 2 8 7z" fill="#e9b77d" stroke="#8b6b50" stroke-width="2"/><path d="M16 26c1-4 3-6 6-6s5 2 6 6z" fill="#9ad3c9" stroke="#3f7f78" stroke-width="2"/></svg><span>${B.mode === 'guest' ? 'Account' : 'Friends'}</span>`;
  if (menu && menu.parentNode === bar) bar.insertBefore(btn, menu); else bar.appendChild(btn); btn.onclick = () => openPanel(B.mode === 'guest' ? 'island' : (peers.size ? 'here' : panelTab));
  // start screen text
  if (B.startMsg) { const m = $('#backMsg'); if (m) m.textContent = B.startMsg; }
  if (B.prefillName) { const n = $('#inName'); if (n) n.value = B.prefillName; }
  // guest warning once per session
  if (B.mode === 'guest' && !sessionStorage.getItem('dw-guest-warned')) { sessionStorage.setItem('dw-guest-warned', '1');
    setTimeout(() => banner('Guest island: saved in this browser only, and it can be lost.' + (B.online ? ' Make an account to keep it safe.' : ''), B.online ? 'Make account' : null, () => { $('#netBanner').style.display = 'none'; openPanel('island'); }), 4000); }
  // the Portal Station (main.js) uses these to list islands, travel, and open the invite panel
  B.portal = { online: online(),
    list: () => api('/api/friends'),
    visit: async id => { await flush(); sessionStorage.setItem('dw-visit', id); location.reload(); },
    home: async () => { await flush(); location.href = location.pathname; },
    invite: () => openPanel('friends'), friends: () => openPanel('friends'), account: () => openPanel('island'),
    // v1.27: a template letter (and maybe a gift from the bag) to a friend's mailbox
    letter: async (to, letter, slot) => { await flush(); const S = G().S, it = slot !== null && slot !== undefined ? S.inv[slot] : null;
      const r = await api('/api/mail', { method: 'POST', body: { to, letter, ...(it ? { slot, id: it.id } : {}), baseVersion: ownVer } });
      if (r.ok) applyServerBag(r); return r; } };
  if (online() || tripRoom()) {
    api('/api/me').then(r => { if (r.ok) { myId = r.user.id; B.myId = myId; } });
    connect(); posTimer = setInterval(tickPos, 200);
    // mail check
    setTimeout(async () => { const r = await api('/api/mail'); const n = (r.mail || []).length; if (n) G().net.toast(`You have ${n} gift${n > 1 ? 's' : ''} in your mailbox.`); }, 6000);
    addEventListener('pagehide', () => { flush(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  }
}
// let the game send emotes from elsewhere later
export const emote = e => send({ t: 'emote', e });
