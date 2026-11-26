/* =====================================================================
   PARTY GAMES (v1.14): bonk games for friends on the same island.
   - Bonk Ball: swing at a big beach ball to knock it into a friend's goal. Every player defends their own goal.
   - Crown Keeper: stand in the glowing ring alone to hold the crown and earn points. Bonk friends out of it.
   One player hosts: their game finds an open flat spot, runs the clock, the ball's final say and the scoring,
   and sends the state to everyone through the live room (`game` messages). Everyone else simulates the ball too,
   so hits feel instant, and drifts back to the host's ball when they disagree.
   Practice (v1.14.1): play against islander buddies who run, hit the ball, grab the ring and bonk you. No prizes.
   With 2 or more real players, the winner gets a cup and everyone gets clams.
   ===================================================================== */
import * as THREE from 'three';
import { M, mk, G, addGlow } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const GAMES = {
  ball:  { name: 'Bonk Ball', R: 9, time: 180, win: 5, prize: 'bonkcup',
           how: ['Swing at the beach ball to send it flying. Get it into a friend\'s goal to score.', 'Guard your own goal. Bonking friends is allowed.'] },
  crown: { name: 'Crown Keeper', R: 7, time: 150, win: 30, prize: 'crowncup',
           how: ['Stand in the glowing ring by yourself to wear the crown and earn points.', 'The ring drifts around the whole time, so keep chasing it. If two of you are in it, nobody scores. Bonk them out!'] },
};
const COLS = [0xef7a5a, 0x4fb8c8, 0xf2c24a, 0xa98ad8], CSS = ['#ef7a5a', '#4fb8c8', '#e9b632', '#a98ad8'];
const SOFT = new Set(['tree', 'rock', 'stump', 'weed', 'dig', 'item', 'furn']);   // things that poof away while a game is on
const MAXP = 4, BR = 0.5, ZONE_R = 2.1, ZONE_SPEED = 1.5, COUNT = 3, END_T = 8, LOBBY_MAX = 300;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (v, d = 0) => Number.isFinite(+v) ? +v : d;
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

export function createParty(C) {
  /* C: scene, player, meBody, remotes, groundY, walkable, rawHeight, ents, isNpc, staticBlocked, gardenAt, World, BOOT, S,
        toast, dialog, Snd, puff, sparkBurst, floatText, nameTag, launchRag, endRag, addItem, itemToast, dropNear, addClams,
        exitRoom, prep, snapCam, swingAnim, swingBtn, knockedDown */
  const { scene, player, remotes } = C;
  const myId = () => C.BOOT.myId || 'me';
  const myName = () => (C.BOOT.user && C.BOOT.user.displayName) || C.S.player || 'You';
  const online = () => !!C.BOOT.sendLive && !!C.BOOT.myId;
  const send = d => { if (C.BOOT.sendLive) C.BOOT.sendLive({ t: 'game', d }); };
  let P = null;          // the game this device knows about
  let ui = null, bigT = 0, snapT = 0, lastHitSend = 0, lastLocalHit = -9, now = 0, dismissed = null, ballHitMe = 0;

  /* ---------- finding an open, flat spot ---------- */
  function findArena(R) {
    const solids = [], cell = 4, H = new Map();
    let soft = [];   // trees and rocks step aside during a game, so they don't rule a spot out (they only cost a little)
    for (const e of C.ents) { if (!e.removed && e.pos.x < 500 && SOFT.has(e.kind)) { if (e.solid) soft.push(e); continue; } if (!e.solid || e.removed || C.isNpc(e) || e.pos.x > 500) continue; const k = Math.floor(e.pos.x / cell) + ',' + Math.floor(e.pos.z / cell); if (!H.has(k)) H.set(k, []); H.get(k).push(e); }
    const solidInDisk = (cx, cz, rr) => { const i0 = Math.floor((cx - rr) / cell), i1 = Math.floor((cx + rr) / cell), j0 = Math.floor((cz - rr) / cell), j1 = Math.floor((cz + rr) / cell);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const L = H.get(i + ',' + j); if (L) for (const e of L) if (Math.hypot(e.pos.x - cx, e.pos.z - cz) < rr + e.r) return true; } return false; };
    const hitSolid = (x, z, r) => { const i = Math.floor(x / cell), j = Math.floor(z / cell); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const L = H.get((i + a) + ',' + (j + b)); if (L) for (const e of L) if (Math.hypot(e.pos.x - x, e.pos.z - z) < e.r + r) return true; } return false; };
    const pts = [[0, 0]]; for (const [f, n] of [[0.35, 8], [0.7, 14], [1, 22], [1.12, 26]]) for (let k = 0; k < n; k++) { const a = k / n * TAU; pts.push([Math.cos(a) * (R * f + (f >= 1 ? 0.6 : 0)), Math.sin(a) * (R * f + (f >= 1 ? 0.6 : 0))]); }
    // a spot is usable if it's all dry land with nothing solid on it; flatter and closer is better
    const cost = (cx, cz) => { if (!C.walkable(cx, cz) || solidInDisk(cx, cz, R + 0.9)) return -1; let lo = 99, hi = -99;
      for (const [ox, oz] of pts) { const x = cx + ox, z = cz + oz; if (!C.walkable(x, z)) return -1; const h = C.rawHeight(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); if (hi - lo > 1.2) return -1;
        if (C.staticBlocked(x, z, 0.45) || hitSolid(x, z, 0.45) || (C.gardenAt && C.gardenAt(x, z))) return -1; }
      // the camera looks north, so trees just south of the ring would hide the game: count them
      let view = 0; for (let ox = -R - 1; ox <= R + 1; ox += 2) for (let oz = R * 0.6; oz <= R + 8; oz += 2) if (hitSolid(cx + ox, cz + oz, 1.0)) view++;
      let n = 0; for (const e of soft) if (Math.abs(e.pos.x - cx) < R + 1 && Math.abs(e.pos.z - cz) < R + 1 && Math.hypot(e.pos.x - cx, e.pos.z - cz) < R + 1) n++;
      return hi - lo + view * 0.3 + n * 0.12; };
    const px = player.pos.x, pz = player.pos.z; let best = null, bc = 1e9;
    for (let rad = 0; rad <= 80; rad += 2) { const n = Math.max(1, Math.round(TAU * rad / 2.5)), a0 = rad * 0.37;
      if (best && rad * 0.25 > bc) break;   // nothing further away can beat what we have
      for (let k = 0; k < n; k++) { const a = a0 + k / n * TAU, x = px + Math.cos(a) * rad, z = pz + Math.sin(a) * rad, h = cost(x, z); if (h < 0) continue;
        const c = h * 30 + rad * 0.25; if (c < bc) { bc = c; best = [+x.toFixed(2), +z.toFixed(2)]; } } }
    return best;
  }

  /* ---------- the look of things ---------- */
  const drift = M(0xb9a68c, { roughness: 0.95 }), driftD = M(0x9a876c, { roughness: 0.95 }), rope = M(0xd8c49a, { roughness: 1 });
  function conform(geo, cx, cz, lift) {   // lay a flat ring on the ground
    const p = geo.attributes.position, y0 = C.groundY(cx, cz);
    for (let i = 0; i < p.count; i++) p.setY(i, C.groundY(cx + p.getX(i), cz + p.getZ(i)) - y0 + lift);
    p.needsUpdate = true; return y0; }
  function ballTex() { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
    const cols = ['#e8503a', '#ffffff', '#3a8ad8', '#f7c948', '#ffffff', '#4fb05a'];
    cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(i * 512 / 6, 0, 512 / 6 + 1, 256); });
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 26); x.fillRect(0, 230, 512, 26);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; }
  let _bt = null;
  function buildBall() { _bt = _bt || ballTex(); const m = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 18), new THREE.MeshPhysicalMaterial({ map: _bt, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
    m.castShadow = true; const g = new THREE.Group(); g.add(m); g.userData.mesh = m; return g; }
  function netTex() { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 3;
    for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
  let _nt = null;
  function buildGoal(col, name) {
    const g = new THREE.Group(), W = 3.9, Hh = 1.45, D = 1.2;
    for (const s of [-1, 1]) { const p = mk(G.cyl(0.11, 0.14, Hh, 8), drift, s * W / 2, Hh / 2, 0, g); p.rotation.z = s * 0.03; mk(G.cyl(0.07, 0.09, Hh * 0.8, 6), driftD, s * W / 2, Hh * 0.4, D, g); }
    const bar = mk(G.cyl(0.1, 0.1, W + 0.2, 8), drift, 0, Hh, 0, g); bar.rotation.z = Math.PI / 2;
    _nt = _nt || netTex();
    const nm = new THREE.MeshBasicMaterial({ map: _nt, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh * 0.82), nm.clone()); back.material.map = _nt.clone(); back.material.map.repeat.set(3.4, 1.2); back.material.map.needsUpdate = true; back.position.set(0, Hh * 0.41, D); g.add(back);
    for (const s of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(D, Hh * 0.9), nm); sd.rotation.y = Math.PI / 2; sd.position.set(s * W / 2, Hh * 0.45, D / 2); g.add(sd); }
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), nm); top.rotation.x = -Math.PI / 2 + 0.25; top.position.set(0, Hh * 0.92, D / 2); g.add(top);
    // flag in the owner's color
    mk(G.cyl(0.025, 0.025, 0.9, 5), driftD, W / 2, Hh + 0.45, 0, g);
    const flag = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.36, 0), new THREE.Vector3(-0.55, -0.18, 0)]), new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.geometry.computeVertexNormals(); flag.position.set(W / 2, Hh + 0.88, 0); g.add(flag); g.userData.flag = flag;
    const tag = C.nameTag(name); tag.position.set(0, Hh + 0.75, 0); g.add(tag);
    return g; }
  function buildCrown() { const g = new THREE.Group(), gold = new THREE.MeshPhysicalMaterial({ color: 0xf2c24a, metalness: 0.75, roughness: 0.25, clearcoat: 0.6, emissive: 0x6a4a00, emissiveIntensity: 0.25 });
    mk(new THREE.CylinderGeometry(0.34, 0.3, 0.2, 20, 1, true), gold, 0, 0, 0, g).material.side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const sp = mk(new THREE.ConeGeometry(0.08, 0.26, 6), gold, Math.cos(a) * 0.32, 0.2, Math.sin(a) * 0.32, g); mk(G.sph(0.045, 8, 6), gold, Math.cos(a) * 0.32, 0.34, Math.sin(a) * 0.32, g);
      mk(G.sph(0.05, 8, 6), new THREE.MeshPhysicalMaterial({ color: [0xe8503a, 0x3a8ad8, 0x4fb05a][i % 3], roughness: 0.1, clearcoat: 1 }), Math.cos(a + 0.52) * 0.33, 0.0, Math.sin(a + 0.52) * 0.33, g); }
    addGlow(g, 0.1, 1.6, 0xffd870); g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }

  // the ring of driftwood posts and rope, with gaps where the goals are
  function buildRing() {
    if (P.root) { scene.remove(P.root); P.root.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
    const A = new THREE.Group(), cy = C.groundY(P.cx, P.cz); A.position.set(P.cx, cy, P.cz); scene.add(A); P.cy = cy; P.root = A;
    const n = 30, mouths = P.game === 'ball' ? (P.goals || []) : [], tops = [], UP = new THREE.Vector3(0, 1, 0);
    for (let k = 0; k < n; k++) { const a = k / n * TAU, inMouth = mouths.some(m => Math.abs(angDiff(a, m.a)) < m.half + 0.06);
      const x = Math.cos(a) * P.R, z = Math.sin(a) * P.R, y = C.groundY(P.cx + x, P.cz + z) - cy;
      tops.push(inMouth ? null : new THREE.Vector3(x, y + 0.6, z)); if (inMouth) continue;
      const post = mk(G.cyl(0.07, 0.1, 0.75, 6), k % 3 ? drift : driftD, x, y + 0.36, z, A); post.rotation.set((k % 5 - 2) * 0.04, k, (k % 3 - 1) * 0.05); }
    for (let k = 0; k < n; k++) { const a = tops[k], b = tops[(k + 1) % n]; if (!a || !b) continue;
      const mid = a.clone().add(b).multiplyScalar(0.5); mid.y -= 0.05; const dir = b.clone().sub(a), L = dir.length();
      const r = mk(G.cyl(0.022, 0.022, L, 4), rope, mid.x, mid.y, mid.z, A); r.quaternion.setFromUnitVectors(UP, dir.normalize()); r.castShadow = false;
      const pen = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.13, 0, 0), new THREE.Vector3(0.13, 0, 0), new THREE.Vector3(0, -0.28, 0)]), new THREE.MeshStandardMaterial({ color: COLS[k % 4], side: THREE.DoubleSide, roughness: 0.8 }));
      pen.position.copy(mid); pen.rotation.y = Math.atan2(-mid.x, -mid.z); A.add(pen); }
    const ring = new THREE.RingGeometry(1.25, 1.4, 48); ring.rotateX(-Math.PI / 2); conform(ring, P.cx, P.cz, 0.04);
    A.add(new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })));
    A.scale.y = P.rise >= 1 ? 1 : 0.01; }
  function buildArena() {
    P.rise = 0; P.goalObjs = []; P.goalKey = ''; P.goals = P.game === 'ball' ? (P.frozenGoals || goalAngles(P)) : [];
    buildRing(); const cy = P.cy; hideClutter();
    if (P.game === 'ball') { P.ball = { p: new THREE.Vector3(P.cx, cy + 3, P.cz), v: new THREE.Vector3(), obj: buildBall() }; scene.add(P.ball.obj); P.ball.obj.position.copy(P.ball.p); P.goalKey = ''; syncGoals(true); }
    if (P.game === 'crown') {
      P.zone = { x: P.cx, z: P.cz, tx: P.cx, tz: P.cz };
      const zg = new THREE.RingGeometry(ZONE_R - 0.22, ZONE_R, 56); zg.rotateX(-Math.PI / 2);
      const zm = new THREE.Mesh(zg, new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
      const fill = new THREE.Mesh(new THREE.CircleGeometry(ZONE_R - 0.22, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.18, depthWrite: false }));
      const col = new THREE.Mesh(new THREE.CylinderGeometry(ZONE_R, ZONE_R, 3.2, 40, 1, true), new THREE.MeshBasicMaterial({ map: beamTex(), color: 0xffe08a, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      col.position.y = 1.6; const zgrp = new THREE.Group(); zgrp.add(zm, fill, col); scene.add(zgrp); P.zone.obj = zgrp; P.zone.ring = zm; P.zone.fill = fill; P.zone.beam = col;
      placeZone(true); P.crown = buildCrown(); P.crown.position.set(P.cx, cy + 1.8, P.cz); scene.add(P.crown); }
    C.sparkBurst(new THREE.Vector3(P.cx, cy + 1, P.cz), 26, 6, 0xfff0b0); C.Snd.pop(); }
  // trees, rocks and the like inside the ring poof away for the game (only on screen: nothing is saved) and come back after
  function hideClutter() { P.hidden = [];
    for (const e of C.ents) { if (e.removed || !SOFT.has(e.kind) || e.pos.x > 500 || !e.obj || !e.obj.parent) continue; if (Math.hypot(e.pos.x - P.cx, e.pos.z - P.cz) > P.R + 1.2) continue;
      P.hidden.push({ e, solid: e.solid, parent: e.obj.parent }); e.solid = false; e.obj.parent.remove(e.obj); e.partyHidden = true;
      C.puff(e.pos.clone().setY(e.pos.y + 1), 0xffffff, 6, 0.6, 1.5, 0.9, 0.5); } }
  // the rope is a real fence: players in the game stay inside it, everyone else stays outside
  function fence() {
    const pen = (o, inside) => { const dx = o.pos.x - P.cx, dz = o.pos.z - P.cz, d = Math.hypot(dx, dz) || 1e-6, lim = inside ? P.R - 0.45 : P.R + 0.45;
      if (inside ? d > lim : d < lim) { o.pos.x = P.cx + dx / d * lim; o.pos.z = P.cz + dz / d * lim; if (o.obj) { o.obj.position.x = o.pos.x; o.obj.position.z = o.pos.z; } } return d; };
    if (!C.World.inside) { const me = { pos: player.pos, obj: player.obj }, d = Math.hypot(player.pos.x - P.cx, player.pos.z - P.cz);
      if (inGame() && P.ph !== 'end') { if (d < P.R + 1.5) pen(me, true); }
      else if (P.fenceOut) pen(me, false);
      P.fenceOut = Math.hypot(player.pos.x - P.cx, player.pos.z - P.cz) > P.R + 0.3; }
    for (const b of P.bots || []) pen(b, true); }
  function keepHidden() { for (const h of P.hidden || []) if (h.e.obj && h.e.obj.parent) { h.parent = h.e.obj.parent; h.e.obj.parent.remove(h.e.obj); } }
  function showClutter(Q) { for (const h of Q.hidden || []) { const e = h.e; delete e.partyHidden; if (e.removed) continue; e.solid = h.solid; if (e.obj && !e.obj.parent) h.parent.add(e.obj); C.puff(e.pos.clone().setY(e.pos.y + 1), 0xffffff, 5, 0.5, 1.5, 0.9, 0.5); } Q.hidden = []; }
  let _beam = null;
  function beamTex() { if (_beam) return _beam; const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const x = cv.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = g; x.fillRect(0, 0, 4, 64); return _beam = new THREE.CanvasTexture(cv); }
  function placeZone(snap) { const Z = P.zone; if (snap) { Z.x = Z.tx; Z.z = Z.tz; }
    Z.obj.position.set(Z.x, C.groundY(Z.x, Z.z), Z.z);
    for (const m of [Z.ring, Z.fill]) { const g = m.geometry, p = g.attributes.position; if (!g.userData.base) g.userData.base = p.array.slice(); const b = g.userData.base; for (let i = 0; i < p.count; i++) p.setY(i, C.groundY(Z.x + b[i * 3], Z.z + b[i * 3 + 2]) - Z.obj.position.y + 0.05); p.needsUpdate = true; } }
  function teardown(soft) {
    if (!P || !P.root) return; const Q = P;
    const parts = [Q.root, Q.ball && Q.ball.obj, Q.zone && Q.zone.obj, Q.crown, ...(Q.goalObjs || []).map(g => g.obj)].filter(Boolean);
    showClutter(Q); removeBots(Q);
    if (ui) { ui.big.classList.remove('show'); bigT = 0; }   // never leave a countdown, goal or winner message behind
    if (soft) { C.sparkBurst(new THREE.Vector3(Q.cx, Q.cy + 1, Q.cz), 20, 5, 0xfff0b0); C.Snd.pop(); }
    for (const o of parts) { scene.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); }); }
    Q.root = null; }

  /* ---------- goals (Bonk Ball) ---------- */
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  function goalAngles(Q) {
    const pl = Q.players.slice().sort((a, b) => a.slot - b.slot), n = pl.length;
    const base = n <= 1 ? [-Math.PI / 2] : n === 2 ? [0, Math.PI] : n === 3 ? [-Math.PI / 2, Math.PI / 6, 5 * Math.PI / 6] : [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    const half = 2 / Q.R;
    if (n <= 1) return [{ a: base[0], half, owner: '', name: n ? 'Practice goal' : 'Goal', slot: -1 }];
    return pl.map((p, i) => ({ a: base[i], half, owner: p.id, name: p.name, slot: p.slot }));
  }
  function goalAt(ang) { for (const g of P.goals || []) if (Math.abs(angDiff(ang, g.a)) < g.half) return g; return null; }
  function syncGoals(force) {
    if (!P || P.game !== 'ball' || !P.root) return; const list = P.frozenGoals || goalAngles(P), key = JSON.stringify(list.map(g => [g.a.toFixed(3), g.owner, g.name]));
    if (key === P.goalKey && !force) return; const ringChanged = JSON.stringify((P.goals || []).map(g => g.a.toFixed(3))) !== JSON.stringify(list.map(g => g.a.toFixed(3)));
    P.goalKey = key; P.goals = list;
    for (const g of P.goalObjs) { scene.remove(g.obj); g.obj.traverse(c => { if (c.geometry) c.geometry.dispose(); }); } P.goalObjs = [];
    for (const g of list) { const x = P.cx + Math.cos(g.a) * (P.R + 0.05), z = P.cz + Math.sin(g.a) * (P.R + 0.05), o = buildGoal(g.slot >= 0 ? COLS[g.slot % 4] : 0xffffff, g.owner === myId() ? 'Your goal' : g.name);
      o.position.set(x, C.groundY(x, z), z); o.rotation.y = Math.atan2(Math.cos(g.a), Math.sin(g.a)); scene.add(o); P.goalObjs.push({ g, obj: o }); }
    if (ringChanged) buildRing(); }

  /* ---------- the ball ---------- */
  function stepBall(dt, host) {
    const b = P.ball; if (!b) return; if (P.ballHold > 0) { P.ballHold -= dt; b.obj.visible = false; return; } b.obj.visible = true;
    b.v.y -= 16 * dt; b.v.multiplyScalar(Math.exp(-dt * 0.12)); b.p.addScaledVector(b.v, dt);
    const fy = C.groundY(b.p.x, b.p.z) + BR;
    if (b.p.y < fy) { b.p.y = fy; if (b.v.y < -2.2) { b.v.y *= -0.58; if (near(b.p, 22)) C.Snd.thunk(); } else b.v.y = 0; }
    if (b.p.y < fy + 0.05) { const f = Math.exp(-dt * 1.15); b.v.x *= f; b.v.z *= f; }
    const dx = b.p.x - P.cx, dz = b.p.z - P.cz, d = Math.hypot(dx, dz) || 1e-6, nx = dx / d, nz = dz / d, ang = Math.atan2(dz, dx);
    if (d > P.R - BR) { const gl = P.game === 'ball' ? goalAt(ang) : null;
      if (!gl) { const vr = b.v.x * nx + b.v.z * nz; if (vr > 0) { b.v.x -= nx * vr * 1.7; b.v.z -= nz * vr * 1.7; if (vr > 2 && near(b.p, 22)) C.Snd.thunk(); } b.p.x = P.cx + nx * (P.R - BR); b.p.z = P.cz + nz * (P.R - BR); }
      else { // inside the goal mouth: the net keeps it in
        const da = angDiff(ang, gl.a), lim = gl.half - BR / P.R * 0.6;
        if (Math.abs(da) > lim) { const tx = -nz, tz = nx, vt = b.v.x * tx + b.v.z * tz; if (vt * Math.sign(da) > 0) { b.v.x -= tx * vt * 1.6; b.v.z -= tz * vt * 1.6; } const a2 = gl.a + Math.sign(da) * lim; b.p.x = P.cx + Math.cos(a2) * d; b.p.z = P.cz + Math.sin(a2) * d; }
        if (d > P.R + 1.0) { const vr = b.v.x * nx + b.v.z * nz; if (vr > 0) { b.v.x -= nx * vr * 1.3; b.v.z -= nz * vr * 1.3; } b.p.x = P.cx + nx * (P.R + 1.0); b.p.z = P.cz + nz * (P.R + 1.0); }
        if (host && P.ph === 'play' && !(P.goalLock > 0) && d > P.R + 0.35) scoreGoal(gl); } }
    // my own body nudges the ball when I walk into it
    if (!C.knockedDown() && !C.World.inside && b.p.y - fy < 0.6) {
      const ex = b.p.x - player.pos.x, ez = b.p.z - player.pos.z, e = Math.hypot(ex, ez), R0 = BR + 0.4;
      if (e < R0 && e > 1e-4) { const ux = ex / e, uz = ez / e, vr = b.v.x * ux + b.v.z * uz, want = 2.6 + player.speedFrac * 4.5;
        if (vr < want) { b.v.x += ux * (want - vr); b.v.z += uz * (want - vr); b.v.y = Math.max(b.v.y, 1.2); }
        b.p.x = player.pos.x + ux * R0; b.p.z = player.pos.z + uz * R0;
        if (now - lastHitSend > 0.15) { lastHitSend = now; lastLocalHit = now; P.lh = myId(); sendHit(); } } }
    // a fast ball knocks over islanders, and me, if someone else sent it
    const sp = Math.hypot(b.v.x, b.v.z);
    if (sp > 6.5) {
      for (const e of C.ents) { if (!C.isNpc(e) || e.rag || e.talking || e.removed || e.pos.x > 500) continue; if (Math.hypot(e.pos.x - b.p.x, e.pos.z - b.p.z) < 0.85 && b.p.y - fy < 1.2) { C.launchRag(e, b.v.x / sp, b.v.z / sp, 0.8); b.v.x *= -0.4; b.v.z *= -0.4; } }
      for (const bt of P.bots || []) if (!bt.rag && P.lh !== bt.id && Math.hypot(bt.pos.x - b.p.x, bt.pos.z - b.p.z) < 0.8 && b.p.y - fy < 1.1) { C.launchRag(bt, b.v.x / sp, b.v.z / sp, 0.75); b.v.x *= -0.35; b.v.z *= -0.35; }
      if (P.lh && P.lh !== myId() && !C.knockedDown() && now - ballHitMe > 1 && inGame() && Math.hypot(player.pos.x - b.p.x, player.pos.z - b.p.z) < 0.8 && b.p.y - fy < 1.1) {
        ballHitMe = now; C.launchRag(C.meBody, b.v.x / sp, b.v.z / sp, 0.75); b.v.x *= -0.35; b.v.z *= -0.35; } }
    // roll
    const h = Math.hypot(b.v.x, b.v.z); if (h > 0.01) { const ax = new THREE.Vector3(b.v.z, 0, -b.v.x).normalize(); b.obj.userData.mesh.rotateOnWorldAxis(ax, h * dt / BR); }
    b.obj.position.copy(b.p); }
  const near = (p, r) => Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < r;
  function sendHit() { const b = P.ball; send({ k: 'hit', id: P.id, b: [b.p.x, b.p.y, b.p.z, b.v.x, b.v.y, b.v.z].map(v => +v.toFixed(2)) }); }
  // a swing near the ball hits the ball (called from main.js before bonking people)
  function trySwing(tg) {
    if (P && P.bots && P.bots.length && inGame() && !C.World.inside) {   // practice: bonk a buddy in front of you
      let best = null, bd = 2.2; for (const b of P.bots) { if (b.rag) continue; const dx = b.pos.x - player.pos.x, dz = b.pos.z - player.pos.z, d = Math.hypot(dx, dz); if (d >= bd) continue; let a = Math.atan2(dx, dz) - player.face; a = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(a) > 1.15 && d > 0.9) continue; best = b; bd = d; }
      const ballD = P.ball ? Math.hypot(P.ball.p.x - player.pos.x, P.ball.p.z - player.pos.z) : 99;
      if (best && bd < ballD && !(tg && tg.d !== undefined && tg.d < bd)) { const dx = best.pos.x - player.pos.x, dz = best.pos.z - player.pos.z, L = Math.hypot(dx, dz) || 1; C.swingAnim(Math.atan2(dx, dz));
        setTimeout(() => { if (best.rag || !P) return; C.launchRag(best, dx / L, dz / L, (C.S.equip ? 1 : 0.8) * (C.bonk ? C.bonk() : 1)); }, 110); return true; } }
    if (!P || P.game !== 'ball' || !P.ball || !P.root || !inGame() || P.ph === 'count' || P.ph === 'end' || P.ballHold > 0 || C.World.inside) return false;
    const b = P.ball, dx = b.p.x - player.pos.x, dz = b.p.z - player.pos.z, d = Math.hypot(dx, dz);
    if (d > 2.5 || b.p.y - C.groundY(b.p.x, b.p.z) > 2.2) return false;
    let a = Math.atan2(dx, dz) - player.face; a = Math.atan2(Math.sin(a), Math.cos(a)); if (d > 1.2 && Math.abs(a) > 1.3) return false;
    if (tg && tg.d !== undefined && tg.d < d - 0.3) return false;   // a friend is closer: bonk them instead
    const tool = C.S.equip || '', dir = d > 0.25 ? new THREE.Vector2(dx / d, dz / d) : new THREE.Vector2(Math.sin(player.face), Math.cos(player.face));
    const pow = { axe: 12.5, shovel: 9, net: 10.5, rod: 9, can: 9 }[tool] || 10, up = tool === 'shovel' ? 7.5 : 4.2;
    C.swingAnim(Math.atan2(dx, dz));
    setTimeout(() => { if (!P || !P.ball) return; b.v.set(dir.x * pow, up, dir.y * pow); if (b.p.y < C.groundY(b.p.x, b.p.z) + BR + 0.1) b.p.y += 0.05;
      lastLocalHit = now; P.lh = myId(); sendHit(); C.Snd.boing(); C.puff(b.p.clone(), 0xffffff, 8, 0.5, 2, 0.7, 0.4); C.floatText(['Bonk!', 'Wham!', 'Boing!', 'Thwack!'][Math.floor(Math.random() * 4)], b.p.clone().setY(b.p.y - 1.2)); }, 110);
    return true; }

  /* ---------- crown ---------- */
  function posOf(id) { const bt = botOf(id); if (bt) return bt.rag ? null : bt.pos; if (id === myId()) return C.knockedDown() || C.World.inside ? null : player.pos; const r = remotes.get(id); if (!r || !r.obj.visible || r.rg) return null; return r.pos; }
  function crownTick(dt) {
    const Z = P.zone; if (!Z) return;
    const inside = P.players.filter(p => { const q = posOf(p.id); return q && Math.hypot(q.x - Z.x, q.z - Z.z) < ZONE_R + 0.15; });
    P.holder = inside.length === 1 ? inside[0].id : inside.length > 1 ? '*' : '';
    if (P.ph === 'play' && inside.length === 1) { inside[0].score += dt; if (inside[0].score >= GAMES.crown.win) { inside[0].score = GAMES.crown.win; endGame(); } }
    if (P.ph === 'play') driftZone(dt); }
  // the ring wanders steadily around the arena: a slow loop that swings in and out, now and then turning back the other way
  function driftZone(dt) { const Z = P.zone, rr = P.R - ZONE_R - 0.5;
    P.zt = (P.zt || 0) + dt; if (!P.zdir) P.zdir = 1; P.zflip = (P.zflip ?? 9 + Math.random() * 8) - dt; if (P.zflip <= 0) { P.zdir *= -1; P.zflip = 9 + Math.random() * 8; }
    const r = rr * (0.62 + 0.38 * Math.sin(P.zt * 0.31 + 1.3));
    P.zang = (P.zang ?? -Math.PI / 2) + P.zdir * ZONE_SPEED / Math.max(1.2, r) * dt;
    Z.tx = +(P.cx + Math.cos(P.zang) * r).toFixed(2); Z.tz = +(P.cz + Math.sin(P.zang) * r).toFixed(2); }

  /* ---------- practice buddies ---------- */
  const B_SPEED = 4.3;
  function addBots(n) {
    P.bots = C.buddies(n).map((b, i) => { b.away(); b.pos = new THREE.Vector3(P.cx, P.cy, P.cz); b.face = 0; b.jel = {}; b.solid = false; b.cd = 1 + Math.random(); b.think = 0;
      b.obj.position.copy(b.pos); scene.add(b.obj); const tag = C.nameTag(b.name); tag.position.y = 2.45; b.obj.add(tag);
      P.players.push({ id: b.id, name: b.name, score: 0, slot: i + 1, bot: true }); return b; });
    if (P.bots.length < n) for (let i = P.bots.length; i < n; i++) { /* not enough neighbors: fine, fewer buddies */ } }
  const botOf = id => (P && P.bots || []).find(b => b.id === id);
  function removeBots(Q) { for (const b of Q.bots || []) { if (b.rag) { if (b.rag.stars) scene.remove(b.rag.stars); b.rag = null; } scene.remove(b.obj); b.back(); } Q.bots = []; }
  function placeBots() { for (const b of P.bots || []) { const sp = spotFor(b.id); if (b.rag) { if (b.rag.stars) scene.remove(b.rag.stars); b.rag = null; b.obj.quaternion.identity(); }
      b.pos.set(sp[0], C.groundY(sp[0], sp[1]), sp[1]); b.face = sp[2]; b.obj.rotation.set(0, b.face, 0); b.obj.position.copy(b.pos); b.cd = 0.8 + Math.random() * 0.6; } }
  function botWalk(b, tx, tz, dt, t, sp = 1) {
    const dx = tx - b.pos.x, dz = tz - b.pos.z, d = Math.hypot(dx, dz), u = b.obj.userData; let moving = false;
    if (d > 0.15) { const step = Math.min(d, B_SPEED * sp * dt), nx = b.pos.x + dx / d * step, nz = b.pos.z + dz / d * step;
      if (C.walkable(nx, nz)) { b.pos.x = nx; b.pos.z = nz; moving = true; } b.face = Math.atan2(dx, dz); }
    b.pos.y = C.groundY(b.pos.x, b.pos.z); b.obj.position.copy(b.pos);
    let a = b.face - b.obj.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); b.obj.rotation.y += a * Math.min(1, dt * 10);
    C.jelly(b.obj, b.jel, dt, moving, t, sp);
    const ph = t * 11 * sp, k = moving ? 1 : 0; if (u.legs) { u.legs[0].rotation.x = Math.sin(ph) * 0.7 * k; u.legs[1].rotation.x = -Math.sin(ph) * 0.7 * k; }
    if (u.arms) { u.arms[0].rotation.x = -Math.sin(ph) * 0.6 * k; if (!(b.swingT > 0)) u.arms[1].rotation.x = Math.sin(ph) * 0.6 * k; }
    return d; }
  function botSwingAnim(b, dt) { const u = b.obj.userData; if (b.swingT > 0) { b.swingT -= dt; if (u.arms) u.arms[1].rotation.x = -Math.sin(Math.max(0, b.swingT) / 0.35 * Math.PI) * 1.6; } }
  function botBonk(b, tx, tz, victim) { const dx = tx - b.pos.x, dz = tz - b.pos.z, L = Math.hypot(dx, dz) || 1; b.face = Math.atan2(dx, dz); b.swingT = 0.35; C.Snd.swoosh();
    setTimeout(() => { if (!P || !P.bots) return; if (victim === 'me') { if (!C.knockedDown()) { C.launchRag(C.meBody, dx / L, dz / L, 0.85); C.toast(`${b.name} bonked you!`); } } else if (victim && !victim.rag) C.launchRag(victim, dx / L, dz / L, 0.9); }, 120); }
  function botsTick(dt, t) {
    P.meUpT = C.knockedDown() ? 0 : (P.meUpT || 0) + dt;   // a moment of grace after getting back up
    for (const b of P.bots || []) { b.keep();
      if (b.rag) { C.updateRag(b, dt, t); continue; }
      b.cd -= dt; botSwingAnim(b, dt);
      if (P.ph !== 'play') { botWalk(b, b.pos.x, b.pos.z, dt, t); continue; }
      if (P.game === 'ball') ballBot(b, dt, t); else crownBot(b, dt, t); } }
  function ballBot(b, dt, t) {
    const B0 = P.ball, mine = (P.goals || []).find(g => g.owner === b.id); if (!mine) { botWalk(b, b.pos.x, b.pos.z, dt, t); return; }
    if (P.ballHold > 0) { const s = spotFor(b.id); botWalk(b, s[0], s[1], dt, t, 0.6); return; }
    const others = P.goals.filter(g => g !== mine); if (!b.aim || !others.includes(b.aim) || Math.random() < dt * 0.15) b.aim = others[Math.floor(Math.random() * others.length)];
    const gx = P.cx + Math.cos(b.aim.a) * P.R, gz = P.cz + Math.sin(b.aim.a) * P.R;     // where I'm shooting
    const hx = P.cx + Math.cos(mine.a) * P.R, hz = P.cz + Math.sin(mine.a) * P.R;       // the goal I guard
    const bx = B0.p.x, bz = B0.p.z, dBall = Math.hypot(bx - b.pos.x, bz - b.pos.z), meD = Math.hypot(bx - player.pos.x, bz - player.pos.z);
    const danger = Math.hypot(bx - hx, bz - hz) < P.R * 1.05;
    if (danger || dBall < meD + 1.5 || dBall < 3) {
      // get behind the ball, facing the goal I'm shooting at, then whack it
      const ux = gx - bx, uz = gz - bz, L = Math.hypot(ux, uz) || 1, ax = bx - ux / L * 0.9, az = bz - uz / L * 0.9;
      const close = dBall < 1.35, behind = Math.hypot(ax - b.pos.x, az - b.pos.z) < 0.7;
      botWalk(b, close && !behind && danger ? bx : ax, close && !behind && danger ? bz : az, dt, t, danger ? 1.1 : 1);
      if (close && b.cd <= 0 && (behind || danger) && B0.p.y - C.groundY(bx, bz) < 1.4) {
        const spread = (Math.random() - 0.5) * 0.6, a = Math.atan2(uz, ux) + spread, pow = 8.5 + Math.random() * 2.5;
        b.face = Math.atan2(bx - b.pos.x, bz - b.pos.z); b.swingT = 0.35; b.cd = 0.9 + Math.random() * 0.5;
        B0.v.set(Math.cos(a) * pow, 3.5 + Math.random() * 1.5, Math.sin(a) * pow); P.lh = b.id; C.Snd.boing(); C.puff(B0.p.clone(), 0xffffff, 6, 0.5, 2, 0.6, 0.35); } }
    else { // back to guarding: stand between the ball and my goal
      const ga = Math.atan2(bz - P.cz, bx - P.cx), a = mine.a + clamp(angDiff(ga, mine.a), -0.35, 0.35), d = P.R - 1.8;
      botWalk(b, P.cx + Math.cos(a) * d, P.cz + Math.sin(a) * d, dt, t, 0.8); } }
  function crownBot(b, dt, t) {
    const Z = P.zone; b.think -= dt;
    if (b.think <= 0 || !b.off) { const a = Math.random() * TAU, r = Math.random() * 0.9; b.off = [Math.cos(a) * r, Math.sin(a) * r]; b.think = 1.5 + Math.random() * 2; }
    const vx = (Z.x - (b.zx ?? Z.x)) / Math.max(dt, 1e-3), vz = (Z.z - (b.zz ?? Z.z)) / Math.max(dt, 1e-3); b.zx = Z.x; b.zz = Z.z;
    botWalk(b, Z.x + b.off[0] + clamp(vx, -3, 3) * 0.4, Z.z + b.off[1] + clamp(vz, -3, 3) * 0.4, dt, t, 0.95);
    if (b.cd > 0) return;
    const inZ = (x, z) => Math.hypot(x - Z.x, z - Z.z) < ZONE_R + 0.6;
    if (!inZ(b.pos.x, b.pos.z)) return;
    // bonk whoever else is crowding the ring and close by
    const cands = [];
    if (!C.knockedDown() && P.meUpT > 1.8 && inZ(player.pos.x, player.pos.z) && Math.hypot(player.pos.x - b.pos.x, player.pos.z - b.pos.z) < 1.5) cands.push(['me', player.pos]);
    for (const o of P.bots) if (o !== b && !o.rag && inZ(o.pos.x, o.pos.z) && Math.hypot(o.pos.x - b.pos.x, o.pos.z - b.pos.z) < 1.5) cands.push([o, o.pos]);
    if (!cands.length) return;
    b.cd = 1.6 + Math.random() * 2.2; if (Math.random() < 0.35) return;   // sometimes they just shove in instead
    const [v, at] = cands[Math.floor(Math.random() * cands.length)]; botBonk(b, at.x, at.z, v); }

  /* ---------- host: running the game ---------- */
  function hostOpen(game, practice) {
    if (C.World.inside) { C.toast('Head outside first. Party games need open ground.'); C.Snd.fail(); return; }
    if (C.knockedDown()) return;
    const G0 = GAMES[game], at = findArena(G0.R);
    if (!at) { C.dialog('Party games', 560, ['There\'s no open, flat spot big enough nearby.', 'Try a wide meadow or the beach, away from trees and buildings.']); return; }
    if (P) { if (P.isHost || P.joined) leave(true); if (P) { teardown(false); P = null; } }
    P = { id: Math.random().toString(36).slice(2, 9), game, host: myId(), hostName: myName(), cx: at[0], cz: at[1], R: G0.R, ph: 'lobby', left: LOBBY_MAX,
          players: [{ id: myId(), name: myName(), score: 0, slot: 0 }], isHost: true, joined: true, goalLock: 0, ballHold: 0 };
    if (practice) { P.practice = true; addBots(game === 'ball' ? practice.ball || 1 : practice.crown || 2); if (!P.bots.length) { P = null; C.toast('No islanders are free to play right now.'); return; } }
    buildArena(); setPartyMode(true); renderUI();
    if (practice) { C.dialog(G0.name + ' practice', 560, [...G0.how, `Practicing with ${P.bots.map(b => b.name).join(' and ')}. No prizes, just for fun.`], () => { if (P && P.practice && P.ph === 'lobby') startGame(); }); teleportToSpot(true); placeBots(); return; }
    teleportToSpot(true);
    C.dialog(G0.name, 560, [...G0.how, peersHere() ? 'Friends here can join now. Press Start when everyone is in.' : 'Nobody else is here. Friends who arrive can join before you press Start, or pick Practice for islanders to play against.'], null);
    broadcast(true); }
  function peersHere() { let n = 0; for (const r of remotes.values()) if (r.seen) n++; return n; }
  function broadcast(full) {
    if (!P || !P.isHost || P.practice) return;
    const d = { k: 'st', id: P.id, g: P.game, h: P.host, hn: P.hostName, c: [P.cx, P.cz], ph: P.ph, left: +P.left.toFixed(1), pl: P.players.map(p => [p.id, p.name, +p.score.toFixed(1), p.slot]) };
    if (P.ball) d.b = [P.ball.p.x, P.ball.p.y, P.ball.p.z, P.ball.v.x, P.ball.v.y, P.ball.v.z].map(v => +v.toFixed(2)), d.lh = P.lh || '', d.bh = +(P.ballHold || 0).toFixed(2);
    if (P.frozenGoals) d.fg = P.frozenGoals.map(g => [+g.a.toFixed(4), g.owner, g.name, g.slot]);
    if (P.zone) d.z = [P.zone.tx, P.zone.tz], d.ho = P.holder || '';
    if (P.winners) d.w = P.winners, d.pz = P.prize ? 1 : 0;
    send(d); }
  function hostTick(dt) {
    P.left -= dt;
    if (P.practice && P.ph === 'lobby') P.left = LOBBY_MAX;
    if (P.ph === 'lobby' && P.left <= 0) { closeGame('The game was never started, so it was put away.'); return; }
    if (P.ph === 'count' && P.left <= 0) { P.ph = 'play'; P.left = GAMES[P.game].time; onPhase(); }
    else if (P.ph === 'play' && P.left <= 0) endGame();
    else if (P.ph === 'end' && P.left <= 0) { closeGame(null); return; }
    if (P.goalLock > 0) { P.goalLock -= dt; if (P.goalLock <= 0 && P.ph === 'play') resetBall(); }
    if (P.bots) botsTick(dt, now);
    if (P.game === 'crown' && (P.ph === 'play' || P.ph === 'lobby')) crownTick(dt);
    snapT -= dt; if (snapT <= 0) { snapT = P.ph === 'play' ? 0.1 : 0.4; broadcast(); } }
  function startGame() {
    if (!P || !P.isHost || P.ph !== 'lobby') return;
    P.ph = 'count'; P.left = COUNT; P.prize = !P.practice && P.players.filter(p => !p.bot).length >= 2; P.players.forEach(p => p.score = 0); P.winners = null;
    if (P.game === 'ball') { P.frozenGoals = goalAngles(P); syncGoals(); resetBall(true); }
    if (P.game === 'crown') { P.zone.tx = P.cx; P.zone.tz = P.cz; P.zt = 0; P.zang = -Math.PI / 2; P.zdir = 1; P.zflip = undefined; }
    if (P.bots) placeBots();
    onPhase(); broadcast(); }
  function resetBall(now0) { const b = P.ball; b.p.set(P.cx, C.groundY(P.cx, P.cz) + 3.2, P.cz); b.v.set(0, 0, 0); P.lh = ''; P.ballHold = now0 ? 0 : 0.01; }
  function scoreGoal(gl) {
    const by = P.lh, own = by && by === gl.owner, scorer = P.players.find(p => p.id === by);
    if (scorer && !own) scorer.score += 1;
    P.goalLock = 1.8; P.ballHold = 1.6;
    send({ k: 'goal', id: P.id, by: by || '', into: gl.owner, own: own ? 1 : 0, a: +gl.a.toFixed(3) }); onGoal(by, gl.owner, !!own, gl.a);
    if (scorer && scorer.score >= GAMES.ball.win) setTimeout(() => { if (P && P.isHost && P.ph === 'play') endGame(); }, 900);
    broadcast(); }
  function endGame() {
    if (!P || P.ph === 'end') return;
    const best = Math.max(...P.players.map(p => Math.floor(p.score)));
    P.winners = best > 0 ? P.players.filter(p => Math.floor(p.score) === best).map(p => p.id) : [];
    P.ph = 'end'; P.left = P.practice ? 60 : END_T; onPhase(); broadcast(); }
  function closeGame(why) { if (!P) return; if (P.isHost && !P.practice) send({ k: 'close', id: P.id }); if (why) C.toast(why); teardown(true); P = null; setPartyMode(false); renderUI(); }

  /* ---------- what everyone does ---------- */
  function inGame() { return !!P && !!P.joined; }
  function onPhase() {
    if (!P) return;
    if (P.ph === 'count') { if (inGame()) teleportToSpot(false); bigText('3', 0.9); setTimeout(() => P && P.ph !== 'end' && bigText('2', 0.9), 1000); setTimeout(() => P && P.ph !== 'end' && bigText('1', 0.9), 2000); setTimeout(() => P && (P.ph === 'play' || P.ph === 'count') && bigText(P.game === 'ball' ? 'Bonk!' : 'Go!', 1, true), 3000); C.Snd.click(); }
    if (P.ph === 'end') finish();
    renderUI(); }
  function finish() {
    const W = P.winners || [], names = W.map(id => (P.players.find(p => p.id === id) || {}).name || 'Someone');
    const iWon = W.includes(myId()), G0 = GAMES[P.game];
    bigText(!W.length ? 'Nobody scored!' : W.length > 1 ? `It's a tie! ${names.join(' & ')}` : `${iWon ? 'You win' : names[0] + ' wins'}!`, 3.5, true);
    C.Snd.fanfare();
    const c = new THREE.Vector3(P.cx, P.cy + 1.5, P.cz); for (let i = 0; i < 4; i++) setTimeout(() => { for (const col of COLS) C.puff(c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 1.5, (Math.random() - 0.5) * 6)), col, 6, 1.4, 3, 0.9, 1.4); C.sparkBurst(c, 14, 5, 0xfff0b0); }, i * 300);
    if (!inGame() || P.prized) return; P.prized = true;
    if (!P.prize) { const msg = P.practice ? 'Practice round. Play with friends to win cups and clams.' : 'Play with a friend to win prizes.'; setTimeout(() => C.toast(msg), 1500); return; }
    setTimeout(() => {
      if (iWon) { const r = C.addItem(G0.prize); if (r) C.itemToast(G0.prize, r === 'new', 'Won'); else { C.dropNear(G0.prize, player.pos.clone()); C.toast(`Your bag is full, so your ${G0.name} Cup is on the ground next to you.`); } C.addClams(500); }
      else C.addClams(200);
      setTimeout(() => C.toast(iWon ? '+500 clams for winning!' : '+200 clams for playing!'), 900); }, 1600); }
  function onGoal(by, into, own, a) {
    const name = n => n === myId() ? 'You' : ((P.players.find(p => p.id === n) || {}).name || 'Someone');
    if (P.ball) P.ballHold = 1.6;
    const gx = P.cx + Math.cos(a) * (P.R + 0.6), gz = P.cz + Math.sin(a) * (P.R + 0.6), gp = new THREE.Vector3(gx, C.groundY(gx, gz) + 1, gz);
    C.sparkBurst(gp, 22, 5, 0xfff0b0); for (const col of COLS) C.puff(gp, col, 6, 1, 3, 0.9, 1.1); C.Snd.fanfare();
    bigText(own ? `Own goal! (${name(by)})` : by ? `GOAL! ${name(by)} ${by === myId() ? 'score' : 'scores'}!` : 'GOAL!', 1.8, true); }
  function spotFor(id) {
    const me = P.players.find(p => p.id === id) || { slot: 0 };
    if (P.game === 'ball') { const gl = (P.goals || goalAngles(P)).find(g => g.owner === id); const a = gl ? gl.a : Math.PI / 2, d = gl && gl.owner ? P.R - 1.6 : 3, x = P.cx + Math.cos(a) * d, z = P.cz + Math.sin(a) * d; return [x, z, Math.atan2(P.cx - x, P.cz - z)]; }
    const n = Math.max(P.players.length, 2), a = Math.PI / 2 + me.slot / n * TAU, x = P.cx + Math.cos(a) * (P.R - 1.2), z = P.cz + Math.sin(a) * (P.R - 1.2); return [x, z, Math.atan2(P.cx - x, P.cz - z)]; }
  function teleportToSpot(join) {
    if (!inGame()) return; const me = P.players.find(p => p.id === myId()); if (!me) return;
    let x, z;
    if (P.game === 'ball') { const gl = (P.goals || goalAngles(P)).find(g => g.owner === myId()); const a = gl ? gl.a : Math.PI / 2; const d = gl && gl.owner ? P.R - 1.6 : 3; x = P.cx + Math.cos(a) * d; z = P.cz + Math.sin(a) * d; }
    else { const n = Math.max(P.players.length, 2), a = Math.PI / 2 + me.slot / n * TAU; x = P.cx + Math.cos(a) * (P.R - 1.2); z = P.cz + Math.sin(a) * (P.R - 1.2); }
    if (join && Math.hypot(player.pos.x - P.cx, player.pos.z - P.cz) < P.R - 0.5) return;   // already standing in the arena
    const go = () => { if (C.meBody.rag) C.endRag(C.meBody); C.prep(); C.puff(player.pos.clone().setY(player.pos.y + 0.8), 0xffffff, 10, 0.6, 2, 0.8, 0.5);
      player.pos.set(x, C.groundY(x, z), z); player.face = Math.atan2(P.cx - x, P.cz - z); player.obj.rotation.set(0, player.face, 0); player.obj.position.copy(player.pos); C.snapCam();
      C.sparkBurst(player.pos.clone().setY(player.pos.y + 1), 14, 3.5, COLS[me.slot % 4]); };
    if (C.World.inside) { C.exitRoom(); setTimeout(() => { if (P && inGame()) go(); }, 450); } else go(); }
  function setPartyMode(on) { document.body.classList.toggle('partyOn', !!on); }

  /* ---------- network ---------- */
  function onNet(from, d) {
    if (!d || typeof d !== 'object' || typeof d.k !== 'string') return;
    const nm = id => (remotes.get(id) || {}).name || 'Friend';
    if (P && P.isHost && d.id === P.id) {
      if (d.k === 'join') { if (P.ph !== 'lobby') { send({ k: 'full', id: P.id, to: from, why: 'started' }); return; } if (P.players.some(p => p.id === from)) { broadcast(); return; }
        if (P.players.length >= MAXP) { send({ k: 'full', id: P.id, to: from, why: 'full' }); return; }
        const used = new Set(P.players.map(p => p.slot)); let s = 0; while (used.has(s)) s++;
        P.players.push({ id: from, name: nm(from), score: 0, slot: s }); C.toast(`${nm(from)} joined ${GAMES[P.game].name}!`); C.Snd.pop(); syncGoals(); renderUI(); broadcast(); }
      else if (d.k === 'leave') dropPlayer(from);
      else if (d.k === 'hit' && P.ball && Array.isArray(d.b) && P.players.some(p => p.id === from) && !(P.ballHold > 0)) { applyBall(d.b); P.lh = from; broadcast(); }
      return; }
    if (d.k === 'st') {
      if (typeof d.id !== 'string' || !GAMES[d.g] || !Array.isArray(d.c) || !Array.isArray(d.pl)) return;
      if (P && P.id !== d.id) { if (P.isHost || P.joined) return; teardown(false); P = null; }
      if (from !== d.h) return;
      const fresh = !P;
      if (fresh) { if (dismissed === d.id && d.ph !== 'lobby') return;
        P = { id: d.id, game: d.g, host: d.h, hostName: nm(d.h), cx: num(d.c[0]), cz: num(d.c[1]), R: GAMES[d.g].R, ph: d.ph, left: num(d.left), players: [], isHost: false, joined: false, goalLock: 0, ballHold: 0 }; }
      const prevPh = P.ph;
      P.players = d.pl.slice(0, MAXP).map(a => ({ id: String(a[0]), name: String(a[1] || 'Friend').slice(0, 30), score: num(a[2]), slot: num(a[3]) | 0 }));
      P.ph = ['lobby', 'count', 'play', 'end'].includes(d.ph) ? d.ph : 'lobby'; P.left = num(d.left);
      P.joined = P.players.some(p => p.id === myId());
      if (Array.isArray(d.fg)) P.frozenGoals = d.fg.map(g => ({ a: num(g[0]), half: 2 / P.R, owner: String(g[1] || ''), name: String(g[2] || ''), slot: num(g[3], -1) }));
      else P.frozenGoals = null;
      if (fresh) { buildArena(); if (dismissed !== d.id && P.ph === 'lobby') { C.Snd.jingle(); } }
      if (P.game === 'ball') syncGoals();
      if (P.ball && Array.isArray(d.b)) { P.lh = String(d.lh || ''); const hold = num(d.bh); if (hold > 0 && !(P.ballHold > 0)) P.ballHold = hold; if (now - lastLocalHit > 0.35) correctBall(d.b); }
      if (P.zone && Array.isArray(d.z)) { P.zone.tx = num(d.z[0], P.cx); P.zone.tz = num(d.z[1], P.cz); P.holder = String(d.ho || ''); }
      if (Array.isArray(d.w)) { P.winners = d.w.map(String); P.prize = !!d.pz; }
      if (prevPh !== P.ph && !fresh) onPhase();
      else if (fresh && P.ph === 'end') { /* arrived at the very end: just show the arena going away */ }
      setPartyMode(P.joined); renderUI(); return; }
    if (!P || d.id !== P.id) return;
    if (d.k === 'hit' && P.ball && Array.isArray(d.b) && from !== myId()) { applyBall(d.b); P.lh = from; }
    else if (d.k === 'goal' && from === P.host) onGoal(String(d.by || ''), String(d.into || ''), !!d.own, num(d.a));
    else if (d.k === 'close' && from === P.host) { const was = P.joined && P.ph !== 'end'; teardown(true); P = null; setPartyMode(false); renderUI(); if (was) C.toast('The game was put away.'); }
    else if (d.k === 'full' && d.to === myId()) C.toast(d.why === 'started' ? 'That game already started. Catch the next one!' : 'That game is full (4 players).'); }
  function applyBall(a) { const b = P.ball; b.p.set(num(a[0], b.p.x), num(a[1], b.p.y), num(a[2], b.p.z)); b.v.set(clamp(num(a[3]), -30, 30), clamp(num(a[4]), -30, 30), clamp(num(a[5]), -30, 30)); P.ballHold = 0; }
  function correctBall(a) { const b = P.ball, t = new THREE.Vector3(num(a[0]), num(a[1]), num(a[2])); if (b.p.distanceTo(t) > 2.2) b.p.copy(t); else b.p.lerp(t, 0.35); b.v.set(num(a[3]), num(a[4]), num(a[5])); }
  function dropPlayer(id) { if (!P || !P.isHost) return; const p = P.players.find(q => q.id === id); if (!p || id === P.host) return;
    P.players = P.players.filter(q => q.id !== id); C.toast(`${p.name} left the game.`); if (P.ph === 'lobby') syncGoals(); renderUI(); broadcast(); }
  // someone left the island
  function onLeave(id) { if (!P) return; if (P.isHost) { dropPlayer(id); return; } if (id === P.host) { const was = P.joined; teardown(true); P = null; setPartyMode(false); renderUI(); if (was) C.toast('The host left, so the game ended.'); } }
  function join() { if (!P || P.joined || P.ph !== 'lobby') return; if (C.knockedDown()) return; send({ k: 'join', id: P.id }); C.Snd.click(); P.wantJoin = true; renderUI();
    // once the host lists me, hop over
    const id = P.id; const wait = setInterval(() => { if (!P || P.id !== id || P.ph !== 'lobby') { clearInterval(wait); return; } if (P.joined) { clearInterval(wait); teleportToSpot(true); C.dialog(GAMES[P.game].name, 560, GAMES[P.game].how, null); } }, 150); setTimeout(() => clearInterval(wait), 6000); }
  function leave(quiet) {
    if (!P) return;
    if (P.isHost) { closeGame(quiet || P.practice ? null : 'You put the game away.'); return; }
    if (P.joined) send({ k: 'leave', id: P.id });
    dismissed = P.id; P.joined = false; P.wantJoin = false; setPartyMode(false);
    if (P.ph !== 'lobby') { teardown(false); P = null; }
    renderUI(); }

  /* ---------- every frame ---------- */
  function update(dt, t) {
    now = t;
    // the big text (countdown, goals, winner) fades on its own timer, even after the game is put away
    bigT -= dt; if (bigT <= 0 && ui && ui.big.classList.contains('show')) ui.big.classList.remove('show');
    if (!P) return;
    if (P.isHost) hostTick(dt); else if (P) { P.left -= dt; if (P.ph === 'end' && P.left < -6) { teardown(true); P = null; setPartyMode(false); renderUI(); return; } }
    if (!P || !P.root) return;
    keepHidden(); fence();
    // the ring pops up with a bounce
    if (P.rise < 1) { P.rise = Math.min(1, P.rise + dt * 1.5); const k = P.rise, e = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.3 : 1; P.root.scale.y = Math.max(0.01, k * e); for (const g of P.goalObjs || []) g.obj.scale.y = Math.max(0.01, k * e); }
    if (P.ball && P.ph !== 'count') stepBall(dt, P.isHost);
    else if (P.ball) { const b = P.ball; b.obj.visible = true; b.p.set(P.cx, C.groundY(P.cx, P.cz) + BR + Math.abs(Math.sin(t * 3)) * 0.6, P.cz); b.v.set(0, 0, 0); b.obj.position.copy(b.p); }
    if (P.zone) {
      if (!P.isHost && (P.ph === 'lobby' || P.ph === 'play')) { /* holder comes from the host */ }
      const Z = P.zone, mv = Math.hypot(Z.tx - Z.x, Z.tz - Z.z); if (mv > 0.01) { const k = Math.min(1, dt * (P.isHost ? 30 : 8)); Z.x += (Z.tx - Z.x) * k; Z.z += (Z.tz - Z.z) * k; if (Math.hypot(Z.tx - Z.x, Z.tz - Z.z) < 0.02) { Z.x = Z.tx; Z.z = Z.tz; } placeZone(false); }
      const ho = P.holder, contest = ho === '*', warn = false;
      const col = contest ? 0xff8a7a : ho ? COLS[((P.players.find(p => p.id === ho) || {}).slot || 0) % 4] : 0xffe08a;
      Z.ring.material.color.setHex(col); Z.beam.material.color.setHex(col); Z.fill.material.color.setHex(col);
      Z.ring.material.opacity = contest ? 0.5 + Math.abs(Math.sin(t * 12)) * 0.5 : warn ? 0.4 + Math.abs(Math.sin(t * 8)) * 0.6 : 0.85;
      Z.beam.material.opacity = ho && !contest ? 0.65 : 0.35 + Math.sin(t * 2) * 0.08; Z.beam.rotation.y += dt * 0.4;
      // the crown floats over the zone, or sits over the holder's head
      const hp = ho && ho !== '*' ? (ho === myId() ? player.pos : botOf(ho) ? botOf(ho).pos : (remotes.get(ho) || {}).pos) : null;
      const tgt = hp ? new THREE.Vector3(hp.x, hp.y + 2.75 + Math.sin(t * 4) * 0.06, hp.z) : new THREE.Vector3(Z.x, C.groundY(Z.x, Z.z) + 1.9 + Math.sin(t * 2) * 0.15, Z.z);
      P.crown.position.lerp(tgt, Math.min(1, dt * (hp ? 12 : 4))); P.crown.rotation.y += dt * (hp ? 1 : 1.8);
      if (ho && ho !== P.lastHolder && P.ph === 'play' && ho !== '*') { C.Snd.pop(); C.sparkBurst(P.crown.position.clone(), 10, 3, 0xffe08a); }
      P.lastHolder = ho; }
    uiTick(); }

  /* ---------- screen ---------- */
  function ensureUI() {
    if (ui) return ui;
    const st = document.createElement('style'); st.textContent = `
#partyBox{position:absolute;left:calc(env(safe-area-inset-left) + 10px);top:calc(env(safe-area-inset-top) + 82px);pointer-events:auto;max-width:min(270px,calc(100vw - 130px));display:none;flex-direction:column;align-items:flex-start;gap:5px;padding:7px 10px;font-size:13px;text-align:left;z-index:5}
#partyBox.show{display:flex}
#partyBox .pt{font-weight:700;font-size:14px}
#partyBox .pt small{font-weight:500;color:var(--brown2);margin-left:6px}
#partyBox .chips{display:flex;flex-wrap:wrap;gap:4px}
#partyBox .chip{display:flex;align-items:center;gap:4px;background:#fff;border:2px solid var(--line);border-radius:12px;padding:1px 7px;font-weight:600;font-size:12px}
#partyBox .chip i{width:11px;height:11px;border-radius:50%;display:inline-block}
#partyBox .chip.me{border-color:var(--brown2)}
#partyBox .chip.hold{box-shadow:0 0 0 3px #ffe08a}
#partyBox .row2{display:flex;gap:6px;flex-wrap:wrap}
#partyBox button{font-family:inherit;font-weight:700;font-size:14px;border-radius:14px;border:3px solid #fff;padding:6px 14px;cursor:pointer;background:radial-gradient(circle at 40% 35%,#9ee27a,#5fae43);color:#fff;box-shadow:0 3px 0 #3f8a2f}
#partyBox button.alt{background:var(--cream2);color:var(--brown);border-color:var(--line);box-shadow:0 3px 0 rgba(91,67,50,.2)}
#partyBox button:active{transform:translateY(2px);box-shadow:none}
#partyBig{position:fixed;left:0;right:0;top:42%;text-align:center;pointer-events:none;font-weight:700;font-size:clamp(34px,9vw,68px);color:#fff;-webkit-text-stroke:3px #5b4332;paint-order:stroke;text-shadow:0 5px 0 rgba(91,67,50,.35);opacity:0;transition:opacity .25s;z-index:6;padding:0 12px;line-height:1.1}
#partyBig.small{font-size:clamp(26px,6.5vw,46px)}
#partyBig.show{opacity:1;animation:pbig .35s ease-out}
@keyframes pbig{0%{transform:scale(.6)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
@media (min-width:700px){#partyBox{max-width:340px}}
body.partyOn #swingBtn{display:block}
body.partyOn #hud.magic #swingBtn{display:none}`;
    document.head.appendChild(st);
    const box = document.createElement('div'); box.id = 'partyBox'; box.className = 'pill'; (document.querySelector('#hud') || document.body).appendChild(box);
    const big = document.createElement('div'); big.id = 'partyBig'; document.body.appendChild(big);
    box.addEventListener('pointerdown', e => e.stopPropagation()); box.addEventListener('click', e => e.stopPropagation());
    ui = { box, big, key: '' }; return ui; }
  function bigText(s, dur = 1.2, small) { ensureUI(); ui.big.textContent = s; ui.big.classList.toggle('small', !!small || s.length > 8); ui.big.classList.remove('show'); void ui.big.offsetWidth; ui.big.classList.add('show'); bigT = dur; }
  function renderUI() {
    ensureUI(); const b = ui.box;
    if (!P) { b.classList.remove('show'); ui.key = ''; return; }
    const G0 = GAMES[P.game], me = myId();
    if (!P.joined && (dismissed === P.id || P.ph !== 'lobby')) {   // spectating, or said no thanks
      if (P.ph === 'lobby' && dismissed === P.id) { b.innerHTML = `<div class="row2"><button class="alt" data-a="join">Join ${esc(G0.name)}</button></div>`; b.classList.add('show'); bind(); return; }
      b.innerHTML = `<div class="pt">${esc(G0.name)} <small>${P.ph === 'end' ? 'finished' : 'in progress'}</small></div>`; b.classList.add('show'); return; }
    const chips = P.players.slice().sort((a, c) => a.slot - c.slot).map(p => `<span class="chip${p.id === me ? ' me' : ''}" data-p="${esc(p.id)}"><i style="background:${CSS[p.slot % 4]}"></i>${esc(p.id === me ? 'You' : p.name)} <b data-s="${esc(p.id)}">${P.ph === 'lobby' ? '' : Math.floor(p.score)}</b></span>`).join('');
    let sub = '', btns = '';
    if (P.ph === 'lobby') {
      if (P.isHost) { sub = P.players.length > 1 ? 'Ready when you are' : (peersHere() ? 'Waiting for friends to join' : 'Practice'); btns = `<button data-a="start">Start</button><button class="alt" data-a="cancel">Put away</button>`; }
      else if (P.joined) { sub = `Waiting for ${esc(P.hostName)} to start`; btns = `<button class="alt" data-a="leave">Leave</button>`; }
      else { sub = `${esc(P.hostName)} set up a game`; btns = P.wantJoin ? '<span class="muted">Joining...</span>' : `<button data-a="join">Join</button><button class="alt" data-a="no">No thanks</button>`; } }
    else if (P.ph === 'count') sub = 'Get ready';
    else if (P.ph === 'play') { sub = `<span data-t>${fmtT(P.left)}</span> · first to ${G0.win}`; btns = P.joined ? `<button class="alt" data-a="${P.isHost ? 'cancel' : 'leave'}" style="padding:2px 9px;font-size:12px;border-width:2px">${P.isHost ? 'End game' : 'Leave'}</button>` : ''; }
    else { sub = 'Game over'; if (P.practice) btns = `<button data-a="again">Play again</button><button class="alt" data-a="cancel">Done</button>`; }
    if (P.practice && P.ph === 'lobby') { sub = 'Practice'; btns = `<button data-a="start">Start</button><button class="alt" data-a="cancel">Put away</button>`; }
    if (P.practice && (P.ph === 'play' || P.ph === 'count')) btns = `<button class="alt" data-a="cancel" style="padding:2px 9px;font-size:12px;border-width:2px">Stop</button>`;
    const inline = (P.ph === 'play' || P.ph === 'count') && btns;   // during play the small button sits on the title line to keep the box short
    b.innerHTML = `<div class="pt" style="display:flex;align-items:center;gap:6px;width:100%">${esc(G0.name)} <small style="flex:1">${sub}</small>${inline ? btns : ''}</div>${P.ph === 'lobby' && !P.joined ? '' : `<div class="chips">${chips}</div>`}${btns && !inline ? `<div class="row2">${btns}</div>` : ''}`;
    b.classList.add('show'); bind(); ui.key = P.ph; }
  function bind() { ui.box.querySelectorAll('[data-a]').forEach(el => el.onclick = () => { const a = el.dataset.a;
    if (a === 'start') startGame(); else if (a === 'again') { P.ph = 'lobby'; P.winners = null; P.prized = false; startGame(); } else if (a === 'cancel') { if (P.ph === 'play' && !P.practice && !confirmEnd()) return; leave(); } else if (a === 'leave') leave(); else if (a === 'join') { dismissed = null; join(); } else if (a === 'no') { dismissed = P.id; renderUI(); } }); }
  function confirmEnd() { return window.confirm ? window.confirm('End the game for everyone?') : true; }
  // cheap per-frame refresh of the clock and scores
  function uiTick() { if (!ui || !P || !ui.box.classList.contains('show')) return; const t = ui.box.querySelector('[data-t]'); if (t) t.textContent = fmtT(P.left);
    if (P.ph !== 'lobby') for (const p of P.players) { const s = ui.box.querySelector(`[data-s="${CSS_ESC(p.id)}"]`); if (s) { const v = String(Math.floor(p.score)); if (s.textContent !== v) s.textContent = v; } }
    ui.box.querySelectorAll('.chip').forEach(ch => ch.classList.toggle('hold', !!P.holder && ch.dataset.p === P.holder)); }
  const CSS_ESC = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/"/g, '\\"');

  /* ---------- starting ---------- */
  function open() {
    if (P && (P.isHost || P.joined)) { C.dialog('Party games', 560, [`You're already in ${GAMES[P.game].name}.`], null, [{ label: 'Leave it', fn: () => leave() }, { label: 'Keep playing', alt: true, fn: () => {} }]); return; }
    if (P && P.ph === 'lobby') { C.dialog('Party games', 560, [`${P.hostName} has a game of ${GAMES[P.game].name} waiting.`], null, [{ label: 'Join', fn: () => { dismissed = null; join(); } }, { label: 'Not now', alt: true, fn: () => {} }]); return; }
    const solo = !online() || !peersHere();
    C.dialog('Party games', 560, [solo ? 'Pick a game. Nobody else is here right now, so Practice puts islanders in to play against you.' : 'Pick a game. Everyone on the island gets asked to join.'], null, [
      { label: 'Bonk Ball', fn: () => hostOpen('ball') }, { label: 'Crown Keeper', fn: () => hostOpen('crown') }, { label: 'Practice with islanders', fn: practiceMenu }, { label: 'Not now', alt: true, fn: () => {} }]); }
  function practiceMenu() { setTimeout(() => C.dialog('Practice', 560, ['Islanders will play against you. No prizes, just for trying it out.'], null, [
      { label: 'Bonk Ball (1 on 1)', fn: () => hostOpen('ball', { ball: 1 }) }, { label: 'Bonk Ball (3 way)', fn: () => hostOpen('ball', { ball: 2 }) },
      { label: 'Crown Keeper', fn: () => hostOpen('crown', { crown: 2 }) }, { label: 'Back', alt: true, fn: () => setTimeout(open, 30) }]), 30); }

  return { practice: (g, o) => hostOpen(g, o || {}), update, trySwing, onNet, onLeave, open, get active() { return !!P; }, get state() { return P; }, inGame, findArena, startGame, join, leave, GAMES };
}
