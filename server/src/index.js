/* =====================================================================
   DRIFTWOOD ISLE SERVER (Cloudflare Worker + D1 + Durable Objects)
   - Accounts: sign up with name, email and display name; sign in with an emailed 6-digit code or link (no passwords).
   - Saves: one island per account, versioned so an older copy never overwrites a newer one.
   - Friends: first through invite links. There is no search or public list of players.
     Once you're friends (linked either way), you can invite them over from the Friends tab without a new link (v1.55).
   - Visits: visitor (look, harvest, shop) or resident (same rights as the owner), one-time or standing.
   - Items move between players only through the server (mail, direct gifts, trades). Clams never move.
   - Live visits: one Durable Object room per island relays positions and emotes and settles trades.
   ===================================================================== */
import { ITEMS, BACKPACKS, BASE_SLOTS, LETTERS } from '../../client/js/content.js';
import '../../client/js/enchant-core.js';   // v1.40: Enchanting Scroll items (define themselves in ITEMS)
import '../../client/js/custom-core.js';   // v1.63: custom furniture items (cf_ ids carry their whole design)
import '../../client/js/textile-core.js';   // v1.64: sewn rugs (cr_ ids carry the whole rug)
import '../../client/js/benches-core.js';  // v1.40: crafting tables and their pieces

const KEEP_IDS = /^(relic_|lampframe$|cutting$|millsails$|bellframe$|crowbar$|wrecklens$|chartpiece$)/;   // v1.38, v1.39 story items that can't be mailed or traded
const DAY = 86400e3;
const SESSION_DAYS = 30;
const GUEST = { clams: 10000, minRarity: 3 };
// Parts of a save that belong to the island (shared with residents) vs to the player
export const WORLD_KEYS = ['island', 'seed', 'placed', 'ground', 'plants', 'cut', 'home', 'shops', 'museum', 'nativeFruit', 'layout', 'house', 'fund', 'gen', 'terra', 'magic', 'fruitPicked', 'refLamps', 'stumps', 'town', 'mentor', 'gardens', 'story', 'reef', 'pinesCut'];

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
  if (Array.isArray(d.placed)) for (const e of d.placed) if (Array.isArray(e.store)) e.store = e.store.filter(x => x && ITEMS[x.id] && (ITEMS[x.id].rarity ?? 5) >= GUEST.minRarity);   // v1.19 storage chests
  if (d.museum && d.museum.items) for (const id of Object.keys(d.museum.items)) if (!ITEMS[id] || (ITEMS[id].rarity ?? 5) < GUEST.minRarity) delete d.museum.items[id];
  return d;
}

/* ---------- email ---------- */
async function sendLoginEmail(env, to, code, link) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject: `${code} is your Driftwood Isle sign-in code`,
      text: `Your Driftwood Isle sign-in code is ${code}\n\nType it into the game. It works once and expires in ${CODE_MIN} minutes.\n\nOr sign in with this link: ${link}\n\nIf you didn't ask for this, ignore this email.`,
      html: `<p>Your Driftwood Isle sign-in code:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:8px 0">${code}</p><p>Type it into the game. It works once and expires in ${CODE_MIN} minutes.</p><p>Or <a href="${link}">sign in with this link</a> instead.</p><p>If you didn't ask for this, ignore this email.</p>` }) });
  return r.ok;
}

/* ---------- sign-in codes ----------
   Kept in login_tokens (no schema change): one row per code, keyed 'code:<email>:<sha256 of code>',
   plus one 'tries:<email>' row whose used column counts wrong guesses. A new code clears both. */
const CODE_MIN = 15, CODE_TRIES = 5;
function sixDigits() { const a = new Uint32Array(1); let v; do { crypto.getRandomValues(a); v = a[0]; } while (v >= 4294000000); return String(v % 1e6).padStart(6, '0'); }
async function sha(s) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
const codeKey = async (email, code) => 'code:' + email + ':' + await sha(email + ':' + code);
const clearCodes = (env, email) => [
  env.DB.prepare('DELETE FROM login_tokens WHERE substr(token, 1, ?) = ?').bind(('code:' + email + ':').length, 'code:' + email + ':'),
  env.DB.prepare('DELETE FROM login_tokens WHERE token = ?').bind('tries:' + email)];
// Make the account if it's new, start a session, and return the cookie that goes with it
async function startSession(env, row) {
  let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(row.email).first();
  if (!user) { const id = rid(12); await env.DB.prepare('INSERT INTO users (id, email, name, display_name, created) VALUES (?, ?, ?, ?, ?)').bind(id, row.email, row.name || 'Player', row.display_name || 'Islander', Date.now()).run(); user = { id }; }
  const sid = rid(24);
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires) VALUES (?, ?, ?)').bind(sid, user.id, Date.now() + SESSION_DAYS * DAY).run();
  return `dw_sess=${sid}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

/* ---------- friend links ---------- */
async function getLink(env, ownerId, friendId) { return env.DB.prepare('SELECT * FROM links WHERE owner_id = ? AND friend_id = ?').bind(ownerId, friendId).first(); }
async function areFriends(env, a, b) { return !!(await env.DB.prepare('SELECT 1 FROM links WHERE (owner_id = ? AND friend_id = ?) OR (owner_id = ? AND friend_id = ?)').bind(a, b, b, a).first()); }
// v1.55: everyone linked to me in either direction who has no usable link to my island (none, or a one-visit link already used)
async function invitableFriends(env, me) {
  return (await env.DB.prepare(`SELECT x.id, u.display_name, (SELECT 1 FROM links o WHERE o.owner_id = ?1 AND o.friend_id = x.id) AS had
    FROM (SELECT owner_id AS id FROM links WHERE friend_id = ?1 UNION SELECT friend_id FROM links WHERE owner_id = ?1) x
    JOIN users u ON u.id = x.id
    WHERE x.id != ?1 AND NOT EXISTS (SELECT 1 FROM links l WHERE l.owner_id = ?1 AND l.friend_id = x.id AND (l.standing = 1 OR l.visits_left > 0))
    ORDER BY u.display_name COLLATE NOCASE`).bind(me).all()).results;
}
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
  // v1.67: everything the game needs to start, in one request (server time, who you are, your save, unopened mail count).
  // Replaces separate /api/time, /api/me, /api/save and /api/mail calls at startup. Works signed out (user is null).
  if (p === '/api/boot' && M === 'GET') {
    const now = Date.now(), me = await currentUser(env, req);
    if (!me) return json({ now, user: null });
    const [s, mail] = await Promise.all([loadSave(env, me.id), env.DB.prepare('SELECT COUNT(*) AS n FROM mail WHERE to_id = ? AND claimed = 0').bind(me.id).first()]);
    return json({ now, user: me, save: s || { data: null, version: 0 }, mail: mail?.n || 0 });
  }

  // Sign up or sign in: email a 6-digit code (and a backup link)
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
    const token = rid(24), code = sixDigits(), exp = Date.now() + CODE_MIN * 60e3;
    await env.DB.batch([...clearCodes(env, email),
      env.DB.prepare('INSERT INTO login_tokens (token, email, name, display_name, expires) VALUES (?, ?, ?, ?, ?)').bind(token, email, name, display, exp),
      env.DB.prepare('INSERT INTO login_tokens (token, email, name, display_name, expires) VALUES (?, ?, ?, ?, ?)').bind(await codeKey(email, code), email, name, display, exp)]);
    const link = `${url.origin}/api/auth/verify?t=${token}`;
    if (env.RESEND_API_KEY) { if (!(await sendLoginEmail(env, email, code, link))) return err(502, 'Could not send the email. Try again in a minute.'); return json({ sent: true, isNew: !existing }); }
    if (env.DEV_LOGIN === '1') return json({ sent: false, isNew: !existing, devLink: link, devCode: code });
    return err(500, 'Email sending is not set up on this server.');
  }
  // Sign in with the 6-digit code from the email, in the same tab
  if (p === '/api/auth/code' && M === 'POST') {
    const b = await body(req); const email = cleanText(b.email, 200).toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
    if (!emailOK(email) || code.length !== 6) return err(400, 'Enter the 6-digit code from the email.');
    const tries = await env.DB.prepare('SELECT used, expires FROM login_tokens WHERE token = ?').bind('tries:' + email).first();
    if (tries && tries.expires > Date.now() && tries.used >= CODE_TRIES) return err(429, 'Too many wrong codes. Tap "Send a new code" to get another one.');
    const key = await codeKey(email, code);
    const row = await env.DB.prepare('SELECT * FROM login_tokens WHERE token = ?').bind(key).first();
    if (!row || row.used || row.expires < Date.now()) {
      await env.DB.prepare('INSERT INTO login_tokens (token, email, expires, used) VALUES (?1, ?2, ?3, 1) ON CONFLICT(token) DO UPDATE SET used = CASE WHEN expires < ?4 THEN 1 ELSE used + 1 END, expires = CASE WHEN expires < ?4 THEN excluded.expires ELSE expires END').bind('tries:' + email, email, Date.now() + CODE_MIN * 60e3, Date.now()).run();
      const left = CODE_TRIES - ((tries && tries.expires > Date.now() ? tries.used : 0) + 1);
      if (row && row.expires < Date.now()) return err(400, 'That code has expired. Tap "Send a new code".');
      return err(400, left > 0 ? 'That code isn\'t right. Check the email and try again.' : 'Too many wrong codes. Tap "Send a new code" to get another one.');
    }
    await env.DB.batch(clearCodes(env, email));
    return json({ ok: true }, 200, { 'set-cookie': await startSession(env, row) });
  }
  if (p === '/api/auth/verify' && M === 'GET') {
    const t = url.searchParams.get('t') || '';
    if (t.includes(':')) return new Response('This sign-in link is not valid.', { status: 400 });
    const row = await env.DB.prepare('SELECT * FROM login_tokens WHERE token = ?').bind(t).first();
    if (!row || row.used || row.expires < Date.now()) return new Response('This sign-in link has expired or was already used. Go back to the game and ask for a new one.', { status: 400 });
    await env.DB.prepare('UPDATE login_tokens SET used = 1 WHERE token = ?').bind(t).run();
    await env.DB.batch(clearCodes(env, row.email));
    return new Response(null, { status: 302, headers: { location: '/#signedin', 'set-cookie': await startSession(env, row) } });
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
      // v1.55: friends (linked either way) who can't come to my island right now: no link from me, or a used-up one-visit link
      invitable: (await invitableFriends(env, me.id)).map(r => ({ friendId: r.id, name: r.display_name, visitUsed: !!r.had })),
    });
  }
  // v1.55: invite someone who is already a friend straight to my island, no link needed. Same upsert as accepting an invite.
  if ((m = p.match(/^\/api\/friends\/([a-f0-9]+)\/invite$/)) && M === 'POST') {
    const to = m[1]; if (to === me.id) return err(400, 'That is you.');
    if (!(await areFriends(env, me.id, to))) return err(403, 'You can only invite friends this way. Send them an invite link instead.');
    const s = await loadSave(env, me.id); if (!s) return err(400, 'Save your island first.');
    const b = await body(req); const role = b.role === 'resident' ? 'resident' : 'visitor', standing = b.standing ? 1 : 0;
    const stmts = [env.DB.prepare('INSERT INTO links (owner_id, friend_id, role, standing, visits_left, created) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(owner_id, friend_id) DO UPDATE SET role = excluded.role, standing = excluded.standing, visits_left = 1').bind(me.id, to, role, standing, Date.now())];
    // A letter tells them, unless one from me is still unopened in their mailbox (so inviting twice doesn't pile up letters)
    const waiting = await env.DB.prepare("SELECT 1 FROM mail WHERE to_id = ? AND from_id = ? AND claimed = 0 AND json_extract(item, '$.letter') = 'invited'").bind(to, me.id).first();
    if (!waiting) stmts.push(env.DB.prepare('INSERT INTO mail (to_id, from_id, item, direct, created) VALUES (?, ?, ?, 0, ?)').bind(to, me.id, JSON.stringify({ letter: 'invited', fromName: me.displayName, isle: cleanText(s.data.island || '', 40) }), Date.now()));
    if (!(await tx(env, stmts))) return err(500, 'Could not send the invite. Try again.');
    return json({ ok: true, role, standing: !!standing, letter: !waiting });
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
  // v1.34: a visitor or resident fetches the island's latest copy (after the live room says it changed), no reload needed
  if ((m = p.match(/^\/api\/visit\/([a-f0-9]+)\/world$/)) && M === 'GET') {
    const ownerId = m[1]; const pass = await passFor(env, url.searchParams.get('pass') || '', ownerId);
    if (!pass || pass.friend_id !== me.id) return err(403, 'Your visit has ended.');
    const s = await loadSave(env, ownerId); if (!s) return err(404, 'Island not found.');
    return json({ world: worldOf(s.data), version: s.version });
  }
  if ((m = p.match(/^\/api\/visit\/([a-f0-9]+)\/world$/)) && M === 'PUT') {
    const ownerId = m[1]; const b = await body(req);
    const pass = await passFor(env, b.pass, ownerId);
    if (!pass || pass.friend_id !== me.id) return err(403, 'Your visit has ended.');
    if (pass.role !== 'resident') return err(403, 'Visitors cannot change this island.');
    const cur = await loadSave(env, ownerId); if (!cur) return err(404, 'Island not found.');
    const next = { ...cur.data }; for (const k of WORLD_KEYS) if (b.world && b.world[k] !== undefined && k !== 'seed' && k !== 'layout' && k !== 'gen' && k !== 'refLamps') next[k] = b.world[k];
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
    // v1.27: a letter is one of the preset templates (never free text), optionally with an item tucked in
    const letter = b.letter === undefined ? null : String(b.letter);
    if (letter !== null && (!LETTERS[letter] || LETTERS[letter].sys)) return err(400, 'Unknown letter.');   // v1.55: sys letters are sent only by the server
    let item = null;
    if (KEEP_IDS.test(String(b.id || ''))) return err(400, 'That one stays with you.');   // v1.38 relics and story parts
    if (b.id || letter === null) { item = takeAt(s.data, b.slot | 0, String(b.id || '')); if (!item) return err(400, 'That item is not in your bag anymore.'); }
    const payload = letter !== null ? { ...(item || {}), letter, fromName: me.displayName, isle: cleanText(s.data.island || '', 40) } : item;
    const ok = await tx(env, [
      guardVersion(env, me.id, s.version),
      ...(item ? [casSaveStmt(env, me.id, s.data, s.version)] : []),
      env.DB.prepare('INSERT INTO mail (to_id, from_id, item, direct, created) VALUES (?, ?, ?, ?, ?)').bind(to, me.id, JSON.stringify(payload), b.direct ? 1 : 0, Date.now()),
    ]);
    if (!ok) return json({ error: 'conflict' }, 409);
    if (!item) return json({ version: s.version });
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
    const item = JSON.parse(row.item);
    if (!item.id) {   // v1.27: a letter with nothing tucked in: just open it (the bag doesn't change, so no version check)
      await env.DB.prepare('UPDATE mail SET claimed = 1 WHERE id = ?').bind(row.id).run();
      return json({ version: s.version, item });
    }
    if ((b.baseVersion | 0) !== s.version) return json({ error: 'conflict', version: s.version }, 409);
    if (!addItem(s.data, item.id, item.m)) return err(409, 'full');
    const ok = await tx(env, [guardVersion(env, me.id, s.version), guardUnclaimed(env, row.id), casSaveStmt(env, me.id, s.data, s.version), env.DB.prepare('UPDATE mail SET claimed = 1 WHERE id = ?').bind(row.id)]);
    if (!ok) return json({ error: 'conflict' }, 409);
    return json({ version: s.version + 1, inv: s.data.inv, seen: s.data.seen, item });
  }

  // v1.34: a live room for friends on a boat trip together. The room id is a long random token the trip's leader made
  // and only sent to friends standing on their island (through that island's own live room), so nobody else can find it.
  // Positions, emotes and bonks only; nothing here changes a save except trades, which check both saves as usual.
  if ((m = p.match(/^\/api\/live\/trip\/([a-f0-9]{24})$/))) {
    if (req.headers.get('upgrade') !== 'websocket') return err(426, 'WebSocket only');
    const stub = env.ROOMS.get(env.ROOMS.idFromName('trip:' + m[1]));
    const h = new Headers(req.headers); h.set('x-user', me.id); h.set('x-name', encodeURIComponent(me.displayName)); h.set('x-role', 'trip'); h.set('x-owner', 'trip:' + m[1]);
    return stub.fetch(new Request(req.url, { headers: h }));
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
/* v1.67: uses the WebSocket Hibernation API. While nobody sends anything, the room sleeps and costs nothing,
   but sockets stay connected. Who is connected lives on each socket (serializeAttachment), open trades live in the
   room's storage, so both survive a sleep. Last positions and throttles are memory only: when someone joins,
   clients resend their position (see online.js), so a sleep never leaves anyone standing in the wrong place. */
export class IslandRoom {
  constructor(state, env) { this.state = state; this.env = env; this.pos = new Map(); this.thr = new Map(); }
  live() { const out = []; for (const w of this.state.getWebSockets()) { let p = null; try { p = w.deserializeAttachment(); } catch {} if (p && !p.gone) out.push([w, p]); } return out; }
  async fetch(req) {
    const pair = new WebSocketPair(); const [client, ws] = Object.values(pair);
    const me = { id: req.headers.get('x-user'), name: decodeURIComponent(req.headers.get('x-name') || ''), role: req.headers.get('x-role'), owner: req.headers.get('x-owner') };
    // one connection per player: a new tab replaces the old one
    for (const [w, p] of this.live()) if (p.id === me.id) { try { w.serializeAttachment({ ...p, gone: 1 }); w.close(4000, 'replaced'); } catch {} }
    this.state.acceptWebSocket(ws); ws.serializeAttachment(me);
    ws.send(JSON.stringify({ t: 'hello', you: me.id, peers: this.live().filter(([, p]) => p.id !== me.id).map(([, p]) => ({ id: p.id, name: p.name, role: p.role, st: this.pos.get(p.id) || null })) }));
    this.broadcast({ t: 'join', id: me.id, name: me.name, role: me.role }, ws);
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) { let me = null; try { me = ws.deserializeAttachment(); } catch {} if (me && !me.gone) await this.onMsg(ws, me, raw); }
  async webSocketClose(ws, code, reason) { await this.bye(ws); try { ws.close(code >= 1000 && code < 5000 && ![1004, 1005, 1006, 1015].includes(code) ? code : 1000, reason); } catch {} }
  async webSocketError(ws) { await this.bye(ws); }
  async bye(ws) {
    let me = null; try { me = ws.deserializeAttachment(); } catch {} if (!me || me.gone) return;
    try { ws.serializeAttachment({ ...me, gone: 1 }); } catch {}
    if (this.live().some(([w, p]) => w !== ws && p.id === me.id)) return;   // still here in another socket
    this.pos.delete(me.id); this.broadcast({ t: 'leave', id: me.id }); await this.cancelTradesOf(me.id);
  }
  broadcast(msg, except) { const s = JSON.stringify(msg); for (const [w] of this.live()) if (w !== except) { try { w.send(s); } catch {} } }
  sendTo(id, msg) { const s = JSON.stringify(msg); for (const [w, p] of this.live()) if (p.id === id) { try { w.send(s); } catch {} } }
  here(id) { return this.live().some(([, p]) => p.id === id); }
  async trades() { return (await this.state.storage.get('trades')) || {}; }
  async putTrades(t) { if (Object.keys(t).length) await this.state.storage.put('trades', t); else await this.state.storage.delete('trades'); }
  throttled(id, key, ms) { const k = id + key, now = Date.now(); if (now - (this.thr.get(k) || 0) < ms) return true; this.thr.set(k, now); return false; }
  async onMsg(ws, me, raw) {
    if (typeof raw !== 'string' || raw.length > 4000) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.t) {
      case 'pos': {   // position, facing, moving; numbers only
        const st = { x: +m.x || 0, z: +m.z || 0, y: +m.y || 0, f: +m.f || 0, w: m.w ? 1 : 0, b: m.b ? 1 : 0, in: typeof m.in === 'string' ? m.in.slice(0, 20) : null, lk: typeof m.lk === 'string' && m.lk.length <= 1500 && /^[a-z]{2,12}(\.\d{1,2}){6,11}(~g[A-Za-z0-9_-]{8,1400})?$/.test(m.lk) ? m.lk : '' };
        if (Array.isArray(m.rg) && m.rg.length === 4 && m.rg.every(v => Number.isFinite(+v))) { st.rg = m.rg.map(v => Math.max(-1, Math.min(1, +v))); st.rs = m.rs ? 1 : 0; }   // tumbling pose (v1.6)
        this.pos.set(me.id, st); this.broadcast({ t: 'pos', id: me.id, ...st }, ws); break; }
      case 'emote': if (EMOTES.includes(m.e)) this.broadcast({ t: 'emote', id: me.id, e: m.e }); break;
      case 'bonk': {   // a playful knock-over: no effect on saves, just an animation for everyone in the room
        if (this.throttled(me.id, 'bonk', 400)) return;
        const to = String(m.to); if (to === me.id || !this.here(to)) return;
        const dx = Math.max(-1, Math.min(1, +m.dx || 0)), dz = Math.max(-1, Math.min(1, +m.dz || 0));
        const p = Math.max(0.5, Math.min(1.5, +m.p || 1));   // v1.40: Ultrabonk launch power from the sender's tool
        this.broadcast({ t: 'bonk', id: me.id, to, dx, dz, p }, ws); break; }
      case 'game': {   // party games (v1.14): the host's game state, ball hits, join/leave. Relayed as-is; nothing here touches saves.
        if (this.throttled(me.id, 'game', 40)) return;
        if (!m.d || typeof m.d !== 'object' || Array.isArray(m.d) || JSON.stringify(m.d).length > 1500) return;
        this.broadcast({ t: 'game', id: me.id, d: m.d }, ws); break; }
      case 'world': if (me.role === 'owner' || me.role === 'resident') this.broadcast({ t: 'world', id: me.id, v: m.v | 0 }, ws); break;   // "island changed, refresh when ready"
      case 'gift': this.sendTo(String(m.to), { t: 'gift', from: me.id, name: me.name }); break;      // the gift itself went through /api/mail
      case 'trade-ask': { const to = String(m.to); if (to === me.id || !this.here(to)) return;
        const T = await this.trades(), id = rid(8); T[id] = { id, a: me.id, b: to, offer: { [me.id]: [], [to]: [] }, ok: {}, ver: {} }; await this.putTrades(T);
        this.sendTo(to, { t: 'trade-ask', trade: id, from: me.id, name: me.name }); this.sendTo(me.id, { t: 'trade-open', trade: id, with: to }); break; }
      case 'trade-accept': { const T = await this.trades(), tr = T[m.trade]; if (!tr || tr.b !== me.id) return; tr.open = true; await this.putTrades(T);
        this.sendTo(tr.a, { t: 'trade-open', trade: tr.id, with: tr.b }); this.sendTo(tr.b, { t: 'trade-open', trade: tr.id, with: tr.a }); break; }
      case 'trade-offer': { const T = await this.trades(), tr = T[m.trade]; if (!tr || !tr.open || (tr.a !== me.id && tr.b !== me.id)) return;
        tr.offer[me.id] = (Array.isArray(m.items) ? m.items : []).slice(0, 8).map(i => ({ slot: i.slot | 0, id: String(i.id) })).filter(i => !KEEP_IDS.test(i.id)); tr.ok = {}; await this.putTrades(T);
        this.sendTo(tr.a, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok }); this.sendTo(tr.b, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok }); break; }
      case 'trade-ok': { const T = await this.trades(), tr = T[m.trade]; if (!tr || !tr.open || (tr.a !== me.id && tr.b !== me.id)) return;
        tr.ok[me.id] = true; tr.ver[me.id] = m.version | 0;
        const both = tr.ok[tr.a] && tr.ok[tr.b]; if (both) delete T[tr.id]; await this.putTrades(T);   // settled once: a second ok can't run it again
        this.sendTo(tr.a, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok }); this.sendTo(tr.b, { t: 'trade-state', trade: tr.id, offer: tr.offer, ok: tr.ok });
        if (both) await this.settle(tr); break; }
      case 'trade-cancel': { const T = await this.trades(), tr = T[m.trade]; if (!tr || (tr.a !== me.id && tr.b !== me.id)) return; delete T[tr.id]; await this.putTrades(T);
        const msg = { t: 'trade-end', trade: tr.id, done: false, by: me.name }; this.sendTo(tr.a, msg); this.sendTo(tr.b, msg); break; }
    }
  }
  async cancelTradesOf(uid) { const T = await this.trades(); let n = 0;
    for (const tr of Object.values(T)) if (tr.a === uid || tr.b === uid) { delete T[tr.id]; n++; const msg = { t: 'trade-end', trade: tr.id, done: false, by: 'disconnect' }; this.sendTo(tr.a, msg); this.sendTo(tr.b, msg); }
    if (n) await this.putTrades(T); }
  // Both players confirmed: swap the items in both saves in one database transaction
  async settle(tr) {   // already removed from storage by the caller
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
