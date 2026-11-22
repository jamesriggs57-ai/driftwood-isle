/* =====================================================================
   DRIFTWOOD ISLE SERVER (Cloudflare Worker + D1 + Durable Objects)
   - Accounts: sign up with name, email and display name; sign in by emailed link (no passwords).
   - Saves: one island per account, versioned so an older copy never overwrites a newer one.
   - Friends: only through invite links. There is no search or public list of players.
   - Visits: visitor (look, harvest, shop) or resident (same rights as the owner), one-time or standing.
   - Items move between players only through the server (mail, direct gifts, trades). Clams never move.
   - Live visits: one Durable Object room per island relays positions and emotes and settles trades.
   ===================================================================== */
import { ITEMS, BACKPACKS, BASE_SLOTS } from '../../client/js/content.js';

const DAY = 86400e3;
const SESSION_DAYS = 30;
const GUEST = { clams: 10000, minRarity: 3 };
// Parts of a save that belong to the island (shared with residents) vs to the player
export const WORLD_KEYS = ['island', 'seed', 'placed', 'ground', 'plants', 'cut', 'home', 'shops', 'museum', 'nativeFruit', 'layout', 'house', 'fund'];

/* ---------- helpers ---------- */
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const err = (status, error) => json({ error }, status);
const rid = (bytes = 16) => [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
const shortCode = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return [...crypto.getRandomValues(new Uint8Array(10))].map(b => a[b % a.length]).join(''); };
const cookie = (req, name) => { const m = (req.headers.get('cookie') || '').match(new RegExp('(?:^|; )' + name + '=([^;]+)')); return m ? m[1] : null; };
const cleanText = (s, max) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const emailOK = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 200;
async function body(req) { try { return await req.json(); } catch { return {}; } }

async function currentUser(env, req) {
  const sid = cookie(req, 'dw_sess'); if (!sid) return null;
  const row = await env.DB.prepare('SELECT u.id, u.email, u.name, u.display_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires > ?').bind(sid, Date.now()).first();
  return row ? { id: row.id, email: row.email, name: row.name, displayName: row.display_name } : null;
}
async function loadSave(env, userId) {
  const r = await env.DB.prepare('SELECT data, version FROM saves WHERE user_id = ?').bind(userId).first();
  return r ? { data: JSON.parse(r.data), version: r.version } : null;
}
const writeSaveStmt = (env, userId, data, version) =>
  env.DB.prepare('INSERT INTO saves (user_id, data, version, updated) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, version = excluded.version, updated = excluded.updated').bind(userId, JSON.stringify(data), version, Date.now());
// Version-checked write: only succeeds if nobody wrote since baseVersion
const casSaveStmt = (env, userId, data, baseVersion) =>
  env.DB.prepare('UPDATE saves SET data = ?, version = version + 1, updated = ? WHERE user_id = ? AND version = ?').bind(JSON.stringify(data), Date.now(), userId, baseVersion);

// Batch guards: a D1 batch runs as one transaction, and a statement that errors rolls the whole batch back.
// These fail on purpose (json('stale') is not valid JSON) when a save or mail row changed underneath us.
const guardVersion = (env, userId, v) => env.DB.prepare("SELECT CASE WHEN version = ? THEN 1 ELSE json('stale') END FROM saves WHERE user_id = ?").bind(v, userId);
const guardUnclaimed = (env, id) => env.DB.prepare("SELECT CASE WHEN claimed = 0 THEN 1 ELSE json('stale') END FROM mail WHERE id = ?").bind(id);
async function tx(env, stmts) { try { await env.DB.batch(stmts); return true; } catch (e) { return false; } }

/* ---------- inventory rules (same as the game) ---------- */
const slotsMax = s => (s.pack >= 0 && BACKPACKS[s.pack]) ? BACKPACKS[s.pack].slots : BASE_SLOTS;
function canAdd(s, id, meta) { const st = ITEMS[id].stack; return (!meta && s.inv.some(e => e.id === id && !e.m && e.n < st)) || s.inv.length < slotsMax(s); }
function addItem(s, id, meta) {
  if (!ITEMS[id] || !canAdd(s, id, meta)) return false;
  const st = ITEMS[id].stack, e = meta ? null : s.inv.find(e => e.id === id && !e.m && e.n < st);
  if (e) e.n++; else s.inv.push(meta ? { id, n: 1, m: meta } : { id, n: 1 });
  if (!s.seen) s.seen = {}; if (!s.seen[id]) s.seen[id] = Date.now();
  return true;
}
// Take one item from a bag slot. Returns the item ({id, m}) or null if the slot doesn't hold it.
function takeAt(s, slot, id) {
  const e = s.inv && s.inv[slot]; if (!e || e.id !== id || !ITEMS[id]) return null;
  e.n--; if (e.n <= 0) s.inv.splice(slot, 1);
  if (s.equip && s.equip === id && !s.inv.some(x => x.id === id)) s.equip = null;
  return e.m ? { id, m: e.m } : { id };
}

/* ---------- save checks ---------- */
function checkSave(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'Save is not an object';
  if (!Array.isArray(d.inv)) return 'Save has no bag';
  if (typeof d.clams !== 'number' || !isFinite(d.clams) || d.clams < 0) return 'Bad clam count';
  if (JSON.stringify(d).length > 900000) return 'Save is too large';
  return null;
}
// A guest save coming online: enforce guest limits in case the browser copy was edited
function clampGuest(d) {
  d.clams = Math.min(Math.floor(d.clams), GUEST.clams);
  d.inv = d.inv.filter(e => ITEMS[e.id] && (ITEMS[e.id].rarity ?? 5) >= GUEST.minRarity);
  for (const k of ['placed', 'ground']) if (Array.isArray(d[k])) d[k] = d[k].filter(e => ITEMS[e.id] && (ITEMS[e.id].rarity ?? 5) >= GUEST.minRarity);
  if (d.museum && d.museum.items) for (const id of Object.keys(d.museum.items)) if (!ITEMS[id] || (ITEMS[id].rarity ?? 5) < GUEST.minRarity) delete d.museum.items[id];
  return d;
}

/* ---------- email ---------- */
async function sendLoginEmail(env, to, link) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: 'Your Driftwood Isle sign-in link',
      html: `<p>Tap to sign in to Driftwood Isle:</p><p><a href="${link}">Sign in</a></p><p>This link works once and expires in 30 minutes. If you didn't ask for it, ignore this email.</p>` }) });
  return r.ok;
}

/* ---------- friend links ---------- */
async function getLink(env, ownerId, friendId) { return env.DB.prepare('SELECT * FROM links WHERE owner_id = ? AND friend_id = ?').bind(ownerId, friendId).first(); }
async function areFriends(env, a, b) { return !!(await env.DB.prepare('SELECT 1 FROM links WHERE (owner_id = ? AND friend_id = ?) OR (owner_id = ? AND friend_id = ?)').bind(a, b, b, a).first()); }
async function passFor(env, token, ownerId) {
  if (!token) return null;
  return env.DB.prepare('SELECT * FROM visit_passes WHERE token = ? AND owner_id = ? AND expires > ?').bind(token, ownerId, Date.now()).first();
}
const worldOf = d => Object.fromEntries(WORLD_KEYS.filter(k => d[k] !== undefined).map(k => [k, d[k]]));

/* ---------- routes ---------- */
async function api(req, env, url) {
  const p = url.pathname, M = req.method;
  let m;

  if (p === '/api/time') return json({ now: Date.now() });

  // Sign up or sign in: email a one-time link
  if (p === '/api/auth/start' && M === 'POST') {
    const b = await body(req); const email = cleanText(b.email, 200).toLowerCase();
    if (!emailOK(email)) return err(400, 'Please enter a valid email.');
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    let name = null, display = null;
    if (!existing) {
      name = cleanText(b.name, 40); display = cleanText(b.displayName, 16);
      if (!name || !display) return err(400, 'New here? Enter your name and a character name too.');
      if (display.length < 2) return err(400, 'Character name needs at least 2 letters.');
    }
    const token = rid(24);
    await env.DB.prepare('INSERT INTO login_tokens (token, email, name, display_name, expires) VALUES (?, ?, ?, ?, ?)').bind(token, email, name, display, Date.now() + 30 * 60e3).run();
    const link = `${url.origin}/api/auth/verify?t=${token}`;
    if (env.RESEND_API_KEY) { if (!(await sendLoginEmail(env, email, link))) return err(502, 'Could not send the email. Try again in a minute.'); return json({ sent: true, isNew: !existing }); }
    if (env.DEV_LOGIN === '1') return json({ sent: false, isNew: !existing, devLink: link });
    return err(500, 'Email sending is not set up on this server.');
  }
  if (p === '/api/auth/verify' && M === 'GET') {
    const t = url.searchParams.get('t') || '';
    const row = await env.DB.prepare('SELECT * FROM login_tokens WHERE token = ?').bind(t).first();
    if (!row || row.used || row.expires < Date.now()) return new Response('This sign-in link has expired or was already used. Go back to the game and ask for a new one.', { status: 400 });
    await env.DB.prepare('UPDATE login_tokens SET used = 1 WHERE token = ?').bind(t).run();
    let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(row.email).first();
    if (!user) { const id = rid(12); await env.DB.prepare('INSERT INTO users (id, email, name, display_name, created) VALUES (?, ?, ?, ?, ?)').bind(id, row.email, row.name || 'Player', row.display_name || 'Islander', Date.now()).run(); user = { id }; }
    const sid = rid(24);
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires) VALUES (?, ?, ?)').bind(sid, user.id, Date.now() + SESSION_DAYS * DAY).run();
    return new Response(null, { status: 302, headers: { location: '/#signedin', 'set-cookie': `dw_sess=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}` } });
  }
  if (p === '/api/auth/logout' && M === 'POST') {
    const sid = cookie(req, 'dw_sess'); if (sid) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    return json({ ok: true }, 200, { 'set-cookie': 'dw_sess=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
  }

  // Invite preview works signed out, so the page can explain what the invite is
  if ((m = p.match(/^\/api\/invites\/([a-z0-9]{6,16})$/)) && M === 'GET') {
    const inv = await env.DB.prepare('SELECT i.*, u.display_name FROM invites i JOIN users u ON u.id = i.owner_id WHERE i.code = ?').bind(m[1]).first();
    if (!inv) return err(404, 'This invite does not exist.');
    const s = await loadSave(env, inv.owner_id);
    return json({ owner: inv.display_name, island: s?.data?.island || '', role: inv.role, standing: !!inv.standing, valid: !inv.used_by && inv.expires > Date.now() });
  }

  const me = await currentUser(env, req);
  if (!me) return err(401, 'Please sign in.');

  if (p === '/api/me' && M === 'GET') return json({ user: me });
  // Delete the account and everything tied to it
  if (p === '/api/me' && M === 'DELETE') {
    const b = await body(req); if (b.confirm !== 'DELETE') return err(400, 'Type DELETE to confirm.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM saves WHERE user_id = ?').bind(me.id),
      env.DB.prepare('DELETE FROM links WHERE owner_id = ? OR friend_id = ?').bind(me.id, me.id),
      env.DB.prepare('DELETE FROM invites WHERE owner_id = ?').bind(me.id),
      env.DB.prepare('DELETE FROM visit_passes WHERE owner_id = ? OR friend_id = ?').bind(me.id, me.id),
      env.DB.prepare('DELETE FROM mail WHERE to_id = ? OR from_id = ?').bind(me.id, me.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(me.id),
      env.DB.prepare('DELETE FROM login_tokens WHERE email = ?').bind(me.email),
      env.DB.prepare('DELETE FROM users WHERE id = ?').bind(me.id),
    ]);
    return json({ ok: true }, 200, { 'set-cookie': 'dw_sess=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0' });
  }

  if (p === '/api/save' && M === 'GET') { const s = await loadSave(env, me.id); return json(s || { data: null, version: 0 }); }
  if (p === '/api/save' && M === 'PUT') {
    const b = await body(req); const bad = checkSave(b.data); if (bad) return err(400, bad);
    const cur = await loadSave(env, me.id);
    if (!cur) { await writeSaveStmt(env, me.id, b.data, 1).run(); return json({ version: 1 }); }
    const r = await casSaveStmt(env, me.id, b.data, b.baseVersion | 0).run();
    if (!r.meta.changes) return json({ error: 'conflict', version: cur.version }, 409);
    return json({ version: (b.baseVersion | 0) + 1 });
  }
  if (p === '/api/save/import' && M === 'POST') {
    if (await loadSave(env, me.id)) return err(409, 'This account already has an island.');
    const b = await body(req); const bad = checkSave(b.data); if (bad) return err(400, bad);
    const d = clampGuest(b.data); d.player = d.player || me.displayName; d.fromGuest = Date.now();
    await writeSaveStmt(env, me.id, d, 1).run(); return json({ version: 1, data: d });
  }

  // Invites: only way to become friends
  if (p === '/api/invites' && M === 'POST') {
    const b = await body(req); const role = b.role === 'resident' ? 'resident' : 'visitor';
    if (!(await loadSave(env, me.id))) return err(400, 'Save your island first.');
    const code = shortCode();
    await env.DB.prepare('INSERT INTO invites (code, owner_id, role, standing, created, expires) VALUES (?, ?, ?, ?, ?, ?)').bind(code, me.id, role, b.standing ? 1 : 0, Date.now(), Date.now() + 14 * DAY).run();
    return json({ code, url: `${url.origin}/#invite=${code}`, role, standing: !!b.standing });
  }
  if ((m = p.match(/^\/api\/invites\/([a-z0-9]{6,16})\/accept$/)) && M === 'POST') {
    const inv = await env.DB.prepare('SELECT * FROM invites WHERE code = ?').bind(m[1]).first();
    if (!inv || inv.used_by || inv.expires < Date.now()) return err(410, 'This invite was already used or has expired. Ask your friend for a new one.');
    if (inv.owner_id === me.id) return err(400, 'That is your own invite. Send it to a friend.');
    const okInv = await tx(env, [
      env.DB.prepare("SELECT CASE WHEN used_by IS NULL THEN 1 ELSE json('stale') END FROM invites WHERE code = ?").bind(inv.code),
      env.DB.prepare('UPDATE invites SET used_by = ? WHERE code = ? AND used_by IS NULL').bind(me.id, inv.code),
      env.DB.prepare('INSERT INTO links (owner_id, friend_id, role, standing, visits_left, created) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(owner_id, friend_id) DO UPDATE SET role = excluded.role, standing = excluded.standing, visits_left = 1').bind(inv.owner_id, me.id, inv.role, inv.standing, Date.now()),
    ]);
    if (!okInv) return err(410, 'This invite was just used by someone else.');
    return json({ ok: true, ownerId: inv.owner_id });
  }
  if (p === '/api/friends' && M === 'GET') {
    const canVisit = (await env.DB.prepare('SELECT l.owner_id, l.role, l.standing, l.visits_left, u.display_name FROM links l JOIN users u ON u.id = l.owner_id WHERE l.friend_id = ?').bind(me.id).all()).results;
    const visitors = (await env.DB.prepare('SELECT l.friend_id, l.role, l.standing, l.visits_left, u.display_name FROM links l JOIN users u ON u.id = l.friend_id WHERE l.owner_id = ?').bind(me.id).all()).results;
    const islands = {}; for (const r of canVisit) { const s = await env.DB.prepare("SELECT json_extract(data, '$.island') AS island FROM saves WHERE user_id = ?").bind(r.owner_id).first(); islands[r.owner_id] = s?.island || ''; }
    return json({
      canVisit: canVisit.map(r => ({ ownerId: r.owner_id, name: r.display_name, island: islands[r.owner_id], role: r.role, standing: !!r.standing, visitsLeft: r.standing ? null : r.visits_left })),
      visitors: visitors.map(r => ({ friendId: r.friend_id, name: r.display_name, role: r.role, standing: !!r.standing, visitsLeft: r.standing ? null : r.visits_left })),
    });
  }
  if ((m = p.match(/^\/api\/links\/([a-f0-9]+)\/([a-f0-9]+)$/))) {
    const [, ownerId, friendId] = m;
    if (M === 'DELETE') {
      if (me.id !== ownerId && me.id !== friendId) return err(403, 'Not yours to change.');
      await env.DB.batch([env.DB.prepare('DELETE FROM links WHERE owner_id = ? AND friend_id = ?').bind(ownerId, friendId), env.DB.prepare('DELETE FROM visit_passes WHERE owner_id = ? AND friend_id = ?').bind(ownerId, friendId)]);
      return json({ ok: true });
    }
    if (M === 'PATCH') {
      if (me.id !== ownerId) return err(403, 'Only the island owner can change this.');
      const b = await body(req); const role = b.role === 'resident' ? 'resident' : 'visitor';
      await env.DB.prepare('UPDATE links SET role = ?, standing = ?, visits_left = CASE WHEN ? = 1 THEN visits_left ELSE 1 END WHERE owner_id = ? AND friend_id = ?').bind(role, b.standing ? 1 : 0, b.standing ? 1 : 0, ownerId, friendId).run();
      await env.DB.prepare('UPDATE visit_passes SET role = ? WHERE owner_id = ? AND friend_id = ?').bind(role, ownerId, friendId).run();
      return json({ ok: true });
    }
  }

  // Visits
  if ((m = p.match(/^\/api\/visit\/([a-f0-9]+)$/)) && M === 'POST') {
    const ownerId = m[1]; const b = await body(req);
    let pass = await passFor(env, b.pass, ownerId);
    if (pass && pass.friend_id !== me.id) pass = null;
    if (!pass) {
      const link = await getLink(env, ownerId, me.id);
      if (!link) return err(403, 'You are not invited to this island.');
      if (!link.standing && link.visits_left <= 0) return err(403, 'Your one-time visit was used. Ask for a new invite.');
      const token = rid(20);
      const stmts = [env.DB.prepare('INSERT INTO visit_passes (token, owner_id, friend_id, role, expires) VALUES (?, ?, ?, ?, ?)').bind(token, ownerId, me.id, link.role, Date.now() + 8 * 3600e3)];
      if (!link.standing) stmts.push(env.DB.prepare('UPDATE links SET visits_left = visits_left - 1 WHERE owner_id = ? AND friend_id = ?').bind(ownerId, me.id));
      await env.DB.batch(stmts); pass = { token, role: link.role };
    }
    const host = await env.DB.prepare('SELECT display_name FROM users WHERE id = ?').bind(ownerId).first();
    const s = await loadSave(env, ownerId); if (!s) return err(404, 'That island has not been saved yet.');
    return json({ pass: pass.token, role: pass.role, host: { id: ownerId, name: host?.display_name || 'Friend', island: s.data.island || '' }, world: worldOf(s.data), version: s.version });
  }
  if ((m = p.match(/^\/api\/visit\/([a-f0-9]+)\/world$/)) && M === 'PUT') {
    const ownerId = m[1]; const b = await body(req);
    const pass = await passFor(env, b.pass, ownerId);
    if (!pass || pass.friend_id !== me.id) return err(403, 'Your visit has ended.');
    if (pass.role !== 'resident') return err(403, 'Visitors cannot change this island.');
    const cur = await loadSave(env, ownerId); if (!cur) return err(404, 'Island not found.');
    const next = { ...cur.data }; for (const k of WORLD_KEYS) if (b.world && b.world[k] !== undefined && k !== 'seed' && k !== 'layout') next[k] = b.world[k];
    const bad = checkSave(next); if (bad) return err(400, bad);
    const r = await casSaveStmt(env, ownerId, next, b.baseVersion | 0).run();
    if (!r.meta.changes) return json({ error: 'conflict', version: cur.version, world: worldOf(cur.data) }, 409);
    return json({ version: (b.baseVersion | 0) + 1 });
  }

  // Mail and direct gifts: the server moves the item, so it can't be duplicated
  if (p === '/api/mail' && M === 'POST') {
    const b = await body(req); const to = String(b.to || '');
    if (to === me.id || !(await areFriends(env, me.id, to))) return err(403, 'You can only send gifts to friends.');
    const s = await loadSave(env, me.id); if (!s) return err(400, 'No save.');
    if ((b.baseVersion | 0) !== s.version) return json({ error: 'conflict', version: s.version }, 409);
    const item = takeAt(s.data, b.slot | 0, String(b.id || '')); if (!item) return err(400, 'That item is not in your bag anymore.');
    const ok = await tx(env, [
      guardVersion(env, me.id, s.version),
      casSaveStmt(env, me.id, s.data, s.version),
      env.DB.prepare('INSERT INTO mail (to_id, from_id, item, direct, created) VALUES (?, ?, ?, ?, ?)').bind(to, me.id, JSON.stringify(item), b.direct ? 1 : 0, Date.now()),
    ]);
    if (!ok) return json({ error: 'conflict' }, 409);
    return json({ version: s.version + 1, inv: s.data.inv, equip: s.data.equip ?? null });
  }
  if (p === '/api/mail' && M === 'GET') {
    const rows = (await env.DB.prepare('SELECT m.id, m.item, m.direct, m.created, u.display_name FROM mail m JOIN users u ON u.id = m.from_id WHERE m.to_id = ? AND m.claimed = 0 ORDER BY m.id').bind(me.id).all()).results;
    return json({ mail: rows.map(r => ({ id: r.id, item: JSON.parse(r.item), direct: !!r.direct, from: r.display_name, at: r.created })) });
  }
  if ((m = p.match(/^\/api\/mail\/(\d+)\/claim$/)) && M === 'POST') {
    const b = await body(req);
    const row = await env.DB.prepare('SELECT * FROM mail WHERE id = ? AND to_id = ? AND claimed = 0').bind(+m[1], me.id).first();
    if (!row) return err(404, 'Already opened.');
    const s = await loadSave(env, me.id); if (!s) return err(400, 'No save.');
    if ((b.baseVersion | 0) !== s.version) return json({ error: 'conflict', version: s.version }, 409);
    const item = JSON.parse(row.item);
    if (!addItem(s.data, item.id, item.m)) return err(409, 'full');
    const ok = await tx(env, [guardVersion(env, me.id, s.version), guardUnclaimed(env, row.id), casSaveStmt(env, me.id, s.data, s.version), env.DB.prepare('UPDATE mail SET claimed = 1 WHERE id = ?').bind(row.id)]);
    if (!ok) return json({ error: 'conflict' }, 409);
    return json({ version: s.version + 1, inv: s.data.inv, seen: s.data.seen, item });
  }

  // Live room (WebSocket). The owner joins with their session; friends join with a visit pass.
  if ((m = p.match(/^\/api\/live\/([a-f0-9]+)$/))) {
    if (req.headers.get('upgrade') !== 'websocket') return err(426, 'WebSocket only');
    const ownerId = m[1]; let role = 'owner';
    if (me.id !== ownerId) { const pass = await passFor(env, url.searchParams.get('pass'), ownerId); if (!pass || pass.friend_id !== me.id) return err(403, 'No visit pass.'); role = pass.role; }
    const stub = env.ROOMS.get(env.ROOMS.idFromName(ownerId));
    const h = new Headers(req.headers); h.set('x-user', me.id); h.set('x-name', encodeURIComponent(me.displayName)); h.set('x-role', role); h.set('x-owner', ownerId);
    return stub.fetch(new Request(req.url, { headers: h }));
  }

  return err(404, 'Not found');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try { return await api(req, env, url); }
      catch (e) { console.error(e); return err(500, 'Server error'); }
    }
    return env.ASSETS.fetch(req);
  },
};

/* ---------- Live room: one per island ---------- */
const EMOTES = ['wave', 'happy', 'laugh', 'heart', 'surprised', 'sad', 'thinking', 'sleepy', 'thanks', 'bye'];
export class IslandRoom {
  constructor(state, env) { this.state = state; this.env = env; this.peers = new Map(); this.trades = new Map(); }
  async fetch(req) {
    const pair = new WebSocketPair(); const [client, ws] = Object.values(pair);
    ws.accept();
    const me = { id: req.headers.get('x-user'), name: decodeURIComponent(req.headers.get('x-name') || ''), role: req.headers.get('x-role'), owner: req.headers.get('x-owner'), st: null };
    // one connection per player: a new tab replaces the old one
    for (const [w, p] of this.peers) if (p.id === me.id) { try { w.close(4000, 'replaced'); } catch {} this.peers.delete(w); }
    this.peers.set(ws, me);
    ws.send(JSON.stringify({ t: 'hello', you: me.id, peers: [...this.peers.values()].filter(p => p.id !== me.id).map(p => ({ id: p.id, name: p.name, role: p.role, st: p.st })) }));
    this.broadcast({ t: 'join', id: me.id, name: me.name, role: me.role }, ws);
    ws.addEventListener('message', ev => this.onMsg(ws, me, ev.data));
    const bye = () => { if (this.peers.get(ws) === me) { this.peers.delete(ws); this.broadcast({ t: 'leave', id: me.id }); this.cancelTradesOf(me.id); } };
    ws.addEventListener('close', bye); ws.addEventListener('error', bye);
    return new Response(null, { status: 101, webSocket: client });
  }
  broadcast(msg, except) { const s = JSON.stringify(msg); for (const w of this.peers.keys()) if (w !== except) { try { w.send(s); } catch {} } }
  sendTo(id, msg) { const s = JSON.stringify(msg); for (const [w, p] of this.peers) if (p.id === id) { try { w.send(s); } catch {} } }
  async onMsg(ws, me, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (typeof raw === 'string' && raw.length > 4000) return;
    switch (m.t) {
      case 'pos': {   // position, facing, moving; numbers only
        const st = { x: +m.x || 0, z: +m.z || 0, y: +m.y || 0, f: +m.f || 0, w: m.w ? 1 : 0, b: m.b ? 1 : 0, in: typeof m.in === 'string' ? m.in.slice(0, 20) : null };
        me.st = st; this.broadcast({ t: 'pos', id: me.id, ...st }, ws); break; }
      case 'emote': if (EMOTES.includes(m.e)) this.broadcast({ t: 'emote', id: me.id, e: m.e }); break;
      case 'world': if (me.role === 'owner' || me.role === 'resident') this.broadcast({ t: 'world', id: me.id, v: m.v | 0 }, ws); break;   // "island changed, refresh when ready"
      case 'gift': this.sendTo(String(m.to), { t: 'gift', from: me.id, name: me.name }); break;      // the gift itself went through /api/mail
      case 'trade-ask': { const to = String(m.to); if (to === me.id || ![...this.peers.values()].some(p => p.id === to)) return;
        const id = rid(8); this.trades.set(id, { id, a: me.id, b: to, offer: { [me.id]: [], [to]: [] }, ok: {}, ver: {} });
        this.sendTo(to, { t: 'trade-ask', trade: id, from: me.id, name: me.name }); this.sendTo(me.id, { t: 'trade-open', trade: id, with: to }); break; }
      case 'trade-accept': { const tr = this.trades.get(m.trade); if (!tr || tr.b !== me.id) return; tr.open = true; this.sendTo(tr.a, { t: 'trade-open', trade: tr.id, with: tr.b }); this.sendTo(tr.b, { t: 'trade-open', trade: tr.id, with: tr.a }); break; }
      case 'trade-offer': { const tr = this.trades.get(m.trade); if (!tr || !tr.open || (tr.a !== me.id && tr.b !== me.id)) return;
        tr.offer[me.id] = (Array.isArray(m.items) ? m.items : []).slice(0, 8).map(i => ({ slot: i.slot | 0, id: String(i.id) })); tr.ok = {};
        this.sendTo(tr.a, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok }); this.sendTo(tr.b, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok }); break; }
      case 'trade-ok': { const tr = this.trades.get(m.trade); if (!tr || !tr.open || (tr.a !== me.id && tr.b !== me.id)) return;
        tr.ok[me.id] = true; tr.ver[me.id] = m.version | 0;
        this.sendTo(tr.a, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok }); this.sendTo(tr.b, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok });
        if (tr.ok[tr.a] && tr.ok[tr.b]) await this.settle(tr); break; }
      case 'trade-cancel': { const tr = this.trades.get(m.trade); if (!tr || (tr.a !== me.id && tr.b !== me.id)) return; this.trades.delete(tr.id); const msg = { t: 'trade-end', trade: tr.id, done: false, by: me.name }; this.sendTo(tr.a, msg); this.sendTo(tr.b, msg); break; }
    }
  }
  cancelTradesOf(uid) { for (const tr of this.trades.values()) if (tr.a === uid || tr.b === uid) { this.trades.delete(tr.id); const msg = { t: 'trade-end', trade: tr.id, done: false, by: 'disconnect' }; this.sendTo(tr.a, msg); this.sendTo(tr.b, msg); } }
  // Both players confirmed: swap the items in both saves in one database transaction
  async settle(tr) {
    this.trades.delete(tr.id);
    const fail = why => { const msg = { t: 'trade-end', trade: tr.id, done: false, by: why }; this.sendTo(tr.a, msg); this.sendTo(tr.b, msg); };
    const env = this.env;
    const A = await loadSave(env, tr.a), B = await loadSave(env, tr.b);
    if (!A || !B) return fail('missing save');
    if (A.version !== tr.ver[tr.a] || B.version !== tr.ver[tr.b]) return fail('out of date, try again');
    const take = (s, list) => { const got = []; const sorted = [...list].sort((x, y) => y.slot - x.slot);   // high slots first so indexes stay valid
      for (const it of sorted) { const x = takeAt(s.data, it.slot, it.id); if (!x) return null; got.push(x); } return got; };
    const fromA = take(A, tr.offer[tr.a]), fromB = take(B, tr.offer[tr.b]);
    if (!fromA || !fromB) return fail('items changed');
    for (const x of fromB) if (!addItem(A.data, x.id, x.m)) return fail('bag full');
    for (const x of fromA) if (!addItem(B.data, x.id, x.m)) return fail('bag full');
    const ok = await tx(env, [guardVersion(env, tr.a, A.version), guardVersion(env, tr.b, B.version), casSaveStmt(env, tr.a, A.data, A.version), casSaveStmt(env, tr.b, B.data, B.version)]);
    if (!ok) return fail('out of date, try again');   // neither save changes unless both do
    this.sendTo(tr.a, { t: 'trade-end', trade: tr.id, done: true, inv: A.data.inv, seen: A.data.seen, equip: A.data.equip ?? null, version: A.version + 1 });
    this.sendTo(tr.b, { t: 'trade-end', trade: tr.id, done: true, inv: B.data.inv, seen: B.data.seen, equip: B.data.equip ?? null, version: B.version + 1 });
  }
}
