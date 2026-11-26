/* =====================================================================
   v1.41 ISLAND STORIES PHASE 4: models only (main.js decides what happens).
   - the reading room beside the museum (Juniper's reading nook)
   - the race course: start-and-finish arch and checkpoint flags
   - the flower show table
   - the Island Charter: flags and the brass charter plate at the hall
   - the Driftwood Festival: bunting around the plaza and the stalls
   - Starfall Isle spells: the aurora over the island and the glowing paths
   - keepsakes: charter plate, festival goods, race cup, show rosette, Starglass Shard
   ===================================================================== */
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { M, mk, G, glowMat, addGlow, ITEM_BUILDERS, FURN_BUILDERS } from './models.js';
import { tmat, tbox, mergeStatic, cottageRoof, window1, wallLantern, chimney1, hangingSign, scallopAwning, flowerBed1, pot } from './cottage.js';

const BRASS = () => M(0xd0a048, { metalness:0.7, roughness:0.3 });
const OAK = () => M(0x7a5232, { roughness:0.85 });
const PAINT = [0xe8604d, 0xf8c040, 0x5ab0e0, 0x7ac860, 0xc88ad8, 0xffffff];
const cloth = c => M(c, { roughness:0.9, side:THREE.DoubleSide });
const anim = (g, fn) => { (g.userData.anims=g.userData.anims||[]).push(fn); };
function label(text, w=256, h=96, bg='#f4e6c8', fg='#5b4336', px=40){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const x=cv.getContext('2d'); x.fillStyle=bg; x.fillRect(0,0,w,h); x.fillStyle=fg; x.textAlign='center'; x.textBaseline='middle';
  x.font=`700 ${px}px Fredoka, sans-serif`; x.fillText(text, w/2, h/2+2); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map:t, roughness:0.85 }); }
// a little pennant: a triangle hanging from a line
function pennant(p, x, y, z, c, s=1, ry=0){ const sh=new THREE.Shape(); sh.moveTo(-0.13*s,0); sh.lineTo(0.13*s,0); sh.lineTo(0,-0.26*s); sh.lineTo(-0.13*s,0);
  const m=mk(new THREE.ShapeGeometry(sh), cloth(c), x, y, z, p); m.rotation.y=ry; m.castShadow=false; return m; }
// a string of pennants between two points (sags a little in the middle)
export function bunting(p, a, b, n=10, seed=1, sag=0.35){ const r=mulberry32(seed), line=M(0xf4ead8);
  const L=Math.hypot(b[0]-a[0], b[2]-a[2]), ry=Math.atan2(-(b[2]-a[2]), b[0]-a[0]);
  for (let i=0;i<=n;i++){ const s=i/n, x=a[0]+(b[0]-a[0])*s, z=a[2]+(b[2]-a[2])*s, y=a[1]+(b[1]-a[1])*s-sag*Math.sin(Math.PI*s);
    if (i<n){ const s2=(i+1)/n, y2=a[1]+(b[1]-a[1])*s2-sag*Math.sin(Math.PI*s2), seg=mk(G.box(L/n+0.02, 0.015, 0.015), line, x+(b[0]-a[0])/n/2, (y+y2)/2, z+(b[2]-a[2])/n/2, p); seg.rotation.set(0, ry, Math.atan2(y2-y, L/n)); seg.castShadow=false; }
    if (i>0 && i<n) pennant(p, x, y, z, PAINT[Math.floor(r()*PAINT.length)], 1, ry); } }

/* ---------- bag things ---------- */
const relic0 = ITEM_BUILDERS.relic;
ITEM_BUILDERS.relic = (g, d) => {
  if (d.s!=='starglass') return relic0(g, d);
  // a long shard of pale glass with tiny stars drifting inside
  const gl=new THREE.MeshPhysicalMaterial({ color:0xc8d8ff, transparent:true, opacity:0.55, roughness:0.05, emissive:0x4a5aa8, emissiveIntensity:0.35, flatShading:true, depthWrite:false });
  const sh=mk(G.cone(0.11,0.5,5), gl, 0,0.27,0,g); sh.rotation.set(0.15,0.3,0.2);
  const s2=mk(G.cone(0.06,0.26,5), gl, 0.1,0.13,0.04,g); s2.rotation.set(0.5,0,-0.6);
  const r=mulberry32(7); for (let i=0;i<7;i++) mk(G.ico(0.012+r()*0.012,0), glowMat(0xfff4c8), (r()-0.5)*0.08, 0.12+r()*0.25, (r()-0.5)*0.06, g);
  addGlow(g, 0.25, 0.8, 0xb8c8ff); };
ITEM_BUILDERS.nookshelves = (g) => { const w=OAK(); mk(G.box(0.8,0.7,0.24), w, 0,0.35,0,g); for (let i=0;i<2;i++) mk(G.box(0.74,0.03,0.22), M(0x5a3a22), 0,0.25+i*0.25,0.01,g);
  const r=mulberry32(3); for (let s=0;s<2;s++) for (let i=0;i<6;i++){ const h=0.14+r()*0.06; mk(G.box(0.07,h,0.15), M(PAINT[i%PAINT.length]), -0.3+i*0.11, 0.27+s*0.25+h/2, 0.02, g).rotation.z=(r()-0.5)*0.12; }
  mk(G.box(0.6,0.08,0.3), M(0xc86a5a,{ roughness:0.95 }), 0,0.04,0.25,g); };
ITEM_BUILDERS.racesign = (g) => { const w=OAK(); for (const x of [-0.35,0.35]) mk(G.box(0.05,0.7,0.05), w, x,0.35,0,g); mk(G.box(0.85,0.26,0.04), label('START', 256, 80, '#fff4e0', '#c8402a', 44), 0,0.56,0.02,g);
  for (let i=0;i<6;i++) mk(G.box(0.14,0.06,0.042), M(i%2?0x222222:0xffffff), -0.35+i*0.14, 0.4, 0.02, g); };
ITEM_BUILDERS.candyapple = (g) => { mk(G.sph(0.12,16,12), M(0xc8201a,{ roughness:0.15, metalness:0.1 }), 0,0.13,0,g); mk(G.cyl(0.13,0.15,0.03,16), M(0xa81810,{ roughness:0.2 }), 0,0.02,0,g); mk(G.cyl(0.012,0.012,0.22,6), M(0xd8b888), 0,0.3,0,g); };
ITEM_BUILDERS.festpie = (g) => { const c=M(0xd8a058); const p=mk(G.cyl(0.16,0.17,0.07,16,1), c, 0,0.04,0,g); p.scale.set(1,1,0.6); mk(G.sph(0.15,14,8,0,TAU,0,Math.PI/2), c, 0,0.07,0,g).scale.set(1,0.35,0.6);
  for (let i=0;i<3;i++) mk(G.box(0.03,0.01,0.06), M(0x8a3a3a), -0.06+i*0.06, 0.12, 0, g); };

/* ---------- keepsakes (placeable) ---------- */
FURN_BUILDERS.charterplaque = (g) => { const st=M(0x9a948a,{ roughness:0.9 }); mk(G.box(0.9,0.16,0.4), st, 0,0.08,0,g); const b=mk(G.box(0.8,1.0,0.14), st, 0,0.66,0,g);
  const plate=mk(G.box(0.62,0.72,0.02), label('CHARTER', 256, 300, '#d8b060', '#5a3a12', 46), 0,0.7,0.08,g); mk(G.tor(0.1,0.018,6,20), BRASS(), 0,1.24,0,g).rotation.x=Math.PI/2; void b; void plate; };
FURN_BUILDERS.festbunting = (g) => { const w=OAK(); for (const x of [-0.85,0.85]){ mk(G.cyl(0.04,0.05,1.8,8), w, x,0.9,0,g); mk(G.sph(0.06,8,6), BRASS(), x,1.82,0,g); } bunting(g, [-0.85,1.7,0], [0.85,1.7,0], 7, 9, 0.25); };
FURN_BUILDERS.paperstar = (g) => { mk(G.cyl(0.03,0.04,1.3,8), OAK(), 0,0.65,0,g); mk(G.box(0.36,0.03,0.03), OAK(), 0.15,1.28,0,g);
  const sh=new THREE.Shape(); for (let i=0;i<10;i++){ const a=i/10*TAU+Math.PI/2, rr=i%2?0.08:0.18; i?sh.lineTo(Math.cos(a)*rr, Math.sin(a)*rr):sh.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); }
  const st=mk(new THREE.ExtrudeGeometry(sh, { depth:0.1, bevelEnabled:false }), glowMat(0xffc860), 0.3,1.02,-0.05,g); mk(G.cyl(0.004,0.004,0.1,4), M(0x333333), 0.3,1.22,0,g);
  addGlow(g, 1.02, 1.1, 0xffc860); anim(g, (t)=>{ st.rotation.y=Math.sin(t*0.8)*0.4; }); };
FURN_BUILDERS.fishkite = (g) => { mk(G.cyl(0.03,0.04,2.0,8), OAK(), 0,1.0,0,g); const k=new THREE.Group(); k.position.set(0,1.85,0); g.add(k);
  const body=mk(G.cone(0.16,0.9,10,1,true), cloth(0xe8604d), 0.48,0,0,k); body.rotation.z=Math.PI/2; mk(G.tor(0.16,0.015,5,16), M(0x333333), 0.03,0,0,k).rotation.y=Math.PI/2;
  for (const s of [-1,1]) mk(G.sph(0.035,8,6), M(0xffffff), 0.1,0.05,s*0.12,k);
  const tail=mk(G.cone(0.1,0.24,4), cloth(0xf8c040), 0.98,0,0,k); tail.rotation.z=Math.PI/2;
  anim(g, (t)=>{ k.rotation.y=Math.sin(t*0.7)*0.5; k.rotation.z=Math.sin(t*1.9)*0.08; body.scale.y=1+Math.sin(t*3)*0.06; }); };
FURN_BUILDERS.pinwheel = (g) => { mk(G.cyl(0.025,0.03,1.0,6), M(0xffffff), 0,0.5,0,g); const w=new THREE.Group(); w.position.set(0,1.0,0.04); g.add(w);
  for (let i=0;i<4;i++){ const sh=new THREE.Shape(); sh.moveTo(0,0); sh.lineTo(0.2,0.02); sh.lineTo(0.14,0.16); sh.lineTo(0,0); const b=mk(new THREE.ShapeGeometry(sh), cloth(PAINT[i]), 0,0,0,w); b.rotation.z=i*Math.PI/2; }
  mk(G.sph(0.03,8,6), M(0xf8c040), 0,0,0.01,w); anim(g, (t,dt)=>{ w.rotation.z-=dt*3.2; }); };
FURN_BUILDERS.fest_spring = (g) => { mk(G.cyl(0.04,0.05,1.2,8), OAK(), 0,0.6,0,g); mk(G.tor(0.12,0.02,6,12,Math.PI), OAK(), 0,1.2,0,g);
  const l=mk(G.sph(0.22,16,12), glowMat(0xf8b0c8), 0,1.0,0,g); l.scale.y=1.2; mk(G.cyl(0.08,0.1,0.05,10), M(0x7a3a3a), 0,1.27,0,g); mk(G.cyl(0.08,0.06,0.05,10), M(0x7a3a3a), 0,0.73,0,g);
  const r=mulberry32(4); for (let i=0;i<9;i++){ const a=r()*TAU, y=0.85+r()*0.35; mk(G.sph(0.03,6,5), M(0xffffff), Math.cos(a)*0.225, y, Math.sin(a)*0.225, g); } addGlow(g, 1.0, 1.4, 0xf8b0c8); };
FURN_BUILDERS.fest_summer = (g) => { const d=mk(G.cyl(0.32,0.32,0.5,18), M(0xc8402a), 0,0.45,0,g); void d; for (const y of [0.2,0.7]){ mk(G.tor(0.32,0.025,6,20), BRASS(), 0,y,0,g).rotation.x=Math.PI/2; }
  mk(G.cyl(0.31,0.31,0.02,18), M(0xf4ead0), 0,0.71,0,g); for (let i=0;i<8;i++){ const a=i/8*TAU, c=mk(G.box(0.015,0.5,0.015), M(0xf4ead0), Math.cos(a)*0.325,0.45,Math.sin(a)*0.325,g); c.rotation.z=(i%2?0.35:-0.35); }
  for (const x of [-0.12,0.12]){ const s=mk(G.cyl(0.015,0.015,0.35,6), OAK(), x,0.85,0.1,g); s.rotation.x=0.6; } for (const a of [0,2.1,4.2]) mk(G.box(0.05,0.2,0.05), OAK(), Math.cos(a)*0.24,0.1,Math.sin(a)*0.24,g); };
FURN_BUILDERS.fest_autumn = (g) => { mk(G.box(0.06,1.1,0.06), OAK(), 0,0.55,0,g); const w=new THREE.Group(); w.position.set(0,1.0,0.06); g.add(w);
  mk(G.tor(0.26,0.06,8,24), M(0x8a6a3a,{ roughness:1 }), 0,0,0,w); const r=mulberry32(11), lc=[0xd8502a,0xe8a030,0xb83a1a,0xc8a040];
  for (let i=0;i<22;i++){ const a=i/22*TAU, l=mk(G.sph(0.06,6,4), M(lc[i%4],{ roughness:0.9 }), Math.cos(a)*0.27, Math.sin(a)*0.27, 0.05, w); l.scale.set(1,0.5,0.25); l.rotation.z=a+r(); }
  for (let i=0;i<4;i++){ const a=i/4*TAU+0.4; mk(G.sph(0.045,8,6), M(0xc8401a), Math.cos(a)*0.27, Math.sin(a)*0.27, 0.09, w); }
  const bow=mk(G.box(0.18,0.08,0.03), M(0xc8302a), 0,-0.3,0.08,w); void bow; };
FURN_BUILDERS.fest_winter = (g) => { mk(G.cyl(0.24,0.28,0.18,16), OAK(), 0,0.09,0,g); mk(G.cyl(0.26,0.26,0.03,16), BRASS(), 0,0.18,0,g);
  mk(G.sph(0.26,20,16), new THREE.MeshPhysicalMaterial({ color:0xe8f4ff, transparent:true, opacity:0.25, roughness:0.05, depthWrite:false }), 0,0.42,0,g);
  mk(G.cyl(0.2,0.2,0.04,16), M(0xffffff), 0,0.21,0,g); mk(G.cone(0.08,0.24,8), M(0x2a6a3a), 0,0.36,0,g); mk(G.sph(0.05,8,6), M(0xffffff), 0.1,0.27,0.05,g);
  const flakes=[]; const r=mulberry32(6); for (let i=0;i<14;i++){ const f=mk(G.sph(0.008,4,3), M(0xffffff), (r()-0.5)*0.3, 0.25+r()*0.3, (r()-0.5)*0.3, g); f.userData.ph=r()*TAU; flakes.push(f); }
  addGlow(g, 0.42, 0.9, 0xc8e4ff); anim(g, (t)=>{ for (const f of flakes){ f.position.y=0.25+((t*0.06+f.userData.ph)%1)*0.33; } }); };
FURN_BUILDERS.racecup = (g) => { const gold=M(0xe8b830,{ metalness:0.75, roughness:0.25 }); mk(G.box(0.36,0.12,0.36), M(0x3a2a22), 0,0.06,0,g); mk(G.cyl(0.05,0.1,0.18,12), gold, 0,0.21,0,g);
  const bowl=mk(G.sph(0.2,18,12,0,TAU,0,Math.PI/2), gold, 0,0.5,0,g); bowl.rotation.x=Math.PI; mk(G.tor(0.2,0.02,6,20), gold, 0,0.5,0,g).rotation.x=Math.PI/2;
  for (const s of [-1,1]){ const h=mk(G.tor(0.08,0.018,6,12,Math.PI), gold, s*0.22,0.42,0,g); h.rotation.z=s*Math.PI/2; }
  mk(G.box(0.2,0.06,0.01), label('RACE', 128, 40, '#e8b830', '#5a3a12', 28), 0,0.06,0.185,g); };
FURN_BUILDERS.showribbon = (g) => { mk(G.box(0.06,0.9,0.06), OAK(), 0,0.45,0,g); const r=new THREE.Group(); r.position.set(0,0.82,0.05); g.add(r);
  for (let i=0;i<14;i++){ const p=mk(G.box(0.06,0.12,0.01), cloth(0x3a6ad8), Math.cos(i/14*TAU)*0.14, Math.sin(i/14*TAU)*0.14, 0, r); p.rotation.z=i/14*TAU+Math.PI/2; }
  mk(G.cyl(0.11,0.11,0.02,18), M(0xf8d040), 0,0,0.01,r).rotation.x=Math.PI/2; mk(G.box(0.07,0.3,0.01), cloth(0x3a6ad8), -0.04,-0.24,0,r).rotation.z=0.2; mk(G.box(0.07,0.3,0.01), cloth(0x3a6ad8), 0.04,-0.24,0,r).rotation.z=-0.2; };

/* ---------- the reading room beside the museum ---------- */
export function buildReadingRoom(){
  const g=new THREE.Group(), W=4.4, D=3.6, H=2.5;
  const base=tbox('stone', 0x9a948a, W+0.3, 0.4, D+0.3, 0.8); base.position.y=0.05; g.add(base);
  const walls=new THREE.Mesh(G.box(W,H,D), tmat('stone',0xd8ccb0,2,1.4)); walls.position.y=0.25+H/2; walls.castShadow=walls.receiveShadow=true; g.add(walls);
  const front=new THREE.Group(); front.position.set(0,0.25,D/2+0.01); g.add(front);
  mk(G.box(0.95,1.95,0.08), M(0x2a4a3a), 1.3,1.22,D/2+0.03,g); mk(G.sph(0.04,6,5), BRASS(), 1.02,1.2,D/2+0.09,g);
  // a bay window with a window seat inside, and a lamp in it
  const bay=new THREE.Group(); bay.position.set(-0.8,0.25,D/2); g.add(bay); const tr=M(0xf4ead8);
  mk(G.box(1.7,0.6,0.55), tmat('stone',0xd8ccb0,1,0.4), 0,0.55,0.27,bay); mk(G.box(1.8,0.08,0.62), tr, 0,0.88,0.28,bay); mk(G.box(1.8,0.12,0.62), M(0x3a4a5a), 0,1.98,0.28,bay);
  const gl=new THREE.MeshStandardMaterial({ color:0xfff0c0, emissive:0xffc865, emissiveIntensity:0.5, roughness:0.3 });
  for (const [x,ry,w] of [[0,0,0.9],[-0.72,0.6,0.45],[0.72,-0.6,0.45]]){ const p=mk(G.box(w,1.0,0.04), gl, x,1.42,x?0.36:0.57,bay); p.rotation.y=ry; }
  for (const x of [-0.45,0,0.45]) mk(G.box(0.05,1.0,0.05), tr, x,1.42,0.59,bay);
  const r=mulberry32(21); for (let i=0;i<9;i++) mk(G.box(0.07,0.18+r()*0.06,0.14), M(PAINT[i%PAINT.length]), -0.4+i*0.1, 1.04, 0.3, bay);
  wallLantern(front, 2.05, 1.9, 0.02);
  const roofH=cottageRoof(g, { style:'slate', L:D, S:W, y:0.25+H, c:0x3a5a4a, trim:0x2e3a36, moss:0.25, seed:47, over:0.35 });
  const ch=chimney1(g, -W/2+0.7, -0.5, 0.25, 0.25+H+roofH+0.6, 'stone', 0.02);
  hangingSign(g, 1.3, 2.62, D/2+0.02, 'Books', '#f4f0e0', '#2a4a3a', Math.PI);
  // a bench and a stack of books out front
  const b=new THREE.Group(); b.position.set(-1.0,0,D/2+1.15); g.add(b); const w=OAK(); mk(G.box(1.2,0.08,0.36), w, 0,0.42,0,b); for (const x of [-0.5,0.5]) mk(G.box(0.08,0.42,0.3), w, x,0.21,0,b); mk(G.box(1.2,0.4,0.06), w, 0,0.7,-0.17,b);
  for (let i=0;i<3;i++) mk(G.box(0.24,0.06,0.17), M(PAINT[i+1]), 0.3,0.49+i*0.06,0.02,b).rotation.y=i*0.3;
  flowerBed1(g, 1.9, D/2+0.4, 0.9, 22); pot(g, 0.55, 0.25, D/2+0.45, 0.8);
  mergeStatic(g); g.userData.door=[1.3, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-W/2-0.1,-D/2-0.1,W/2+0.1,D/2+0.7],[-1.7,D/2+0.9,-0.3,D/2+1.4]]; g.userData.chimney=ch; return g; }

/* ---------- the race course ---------- */
// the start-and-finish arch (stands across the course, so nothing solid under it)
export function buildRaceArch(){
  const g=new THREE.Group(), w=OAK(), S=2.3;
  for (const s of [-1,1]){ mk(G.box(0.22,2.8,0.22), w, s*S,1.4,0,g); mk(G.box(0.4,0.12,0.4), M(0x8a8478), s*S,0.06,0,g); }
  mk(G.box(S*2+0.5,0.6,0.12), label('START  -  FINISH', 512, 80, '#fff4e0', '#c8402a', 46), 0,2.6,0,g);
  for (let i=0;i<16;i++) mk(G.box((S*2+0.5)/16,0.12,0.13), M(i%2?0x222222:0xffffff), -S-0.25+(i+0.5)*(S*2+0.5)/16, 2.24,0,g);
  bunting(g, [-S,2.9,0], [S,2.9,0], 9, 3, 0.15);
  g.userData.rects=[[-S-0.2,-0.2,-S+0.2,0.2],[S-0.2,-0.2,S+0.2,0.2]]; g.userData.size={ W:S*2, D:0.4 }; g.userData.door=[0,0.6]; return g; }
// a checkpoint flag. main.js lights the next one up
export function buildCheckpoint(n){
  const g=new THREE.Group(); mk(G.cyl(0.05,0.06,2.4,8), M(0xffffff), 0,1.2,0,g); mk(G.sph(0.08,8,6), BRASS(), 0,2.44,0,g);
  const f=mk(G.box(0.7,0.45,0.02), label(String(n), 128, 82, '#e8604d', '#ffffff', 56), 0.37,2.1,0,g); void f;
  const ring=mk(G.tor(1.1,0.05,6,32), glowMat(0x7ae0ff), 0,0.08,0,g); ring.rotation.x=Math.PI/2; ring.visible=false;
  const glow=addGlow(g, 1.2, 2.4, 0x7ae0ff); glow.userData.event=true; glow.material.opacity=0; glow.visible=false;
  g.userData.lit = on => { ring.visible=on; glow.visible=on; glow.material.opacity=on?0.7:0; };
  g.userData.rects=[]; return g; }

/* ---------- the flower show ---------- */
export function buildShowTable(){
  const g=new THREE.Group(), w=OAK(); mk(G.box(2.2,0.08,0.8), cloth(0xffffff), 0,0.78,0,g); mk(G.box(2.24,0.3,0.84), cloth(0x7ac860), 0,0.62,0,g);
  for (const x of [-1,1]) for (const z of [-0.33,0.33]) mk(G.box(0.07,0.78,0.07), w, x,0.39,z,g);
  const r=mulberry32(5), fc=[0xe8403a,0xf8d040,0x8a4ac0,0xf8a0c0,0xffffff,0x5a7ae0];
  for (let i=0;i<5;i++){ const x=-0.85+i*0.42; mk(G.cyl(0.08,0.06,0.16,10), M(0xb86a40), x,0.9,0,g); for (let k=0;k<3;k++){ const st=mk(G.cyl(0.008,0.008,0.22,4), M(0x3a8a3a), x+(k-1)*0.03,1.05,0,g); st.rotation.z=(k-1)*0.2;
      mk(G.sph(0.045,8,6), M(fc[Math.floor(r()*fc.length)]), x+(k-1)*0.06,1.17,0,g); } }
  const sign=mk(G.box(1.2,0.35,0.04), label('FLOWER SHOW', 384, 96, '#fff4e0', '#3a7a3a', 48), 0,1.55,-0.3,g); void sign; for (const x of [-0.55,0.55]) mk(G.box(0.04,0.8,0.04), w, x,1.2,-0.32,g);
  g.userData.rects=[[-1.15,-0.45,1.15,0.45]]; return g; }

/* ---------- the Island Charter at the hall ---------- */
// two tall flagpoles either side of the door and the charter plate on a stone
export function buildCharterDress(W=6){
  const g=new THREE.Group(); const fc=[0x3a6ab0, 0xe8b830];
  for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*(W/2+0.9),0,0.4); g.add(p);
    mk(G.cyl(0.08,0.1,0.3,10), M(0x8a8478), 0,0.15,0,p); mk(G.cyl(0.04,0.05,4.6,8), M(0xf4ead8), 0,2.45,0,p); mk(G.sph(0.08,8,6), BRASS(), 0,4.78,0,p);
    const f=mk(G.box(1.0,0.62,0.02), cloth(fc[(s+1)/2]), 0.52,4.3,0,p); f.castShadow=false; mk(G.box(0.34,0.34,0.025), M(0xffffff), 0.52,4.3,0,p);
    anim(g, (t)=>{ f.rotation.y=Math.sin(t*1.6+s)*0.25; f.scale.x=0.92+Math.sin(t*2.3+s)*0.08; }); }
  const plq=new THREE.Group(); plq.position.set(-W/2-0.4,0,1.6); g.add(plq); FURN_BUILDERS.charterplaque(plq); plq.rotation.y=0.3;
  bunting(g, [-W/2-0.9,3.6,0.4], [W/2+0.9,3.6,0.4], 14, 12, 0.55);
  g.userData.rects=[[-W/2-1.1,0.2,-W/2-0.7,0.6],[W/2+0.7,0.2,W/2+1.1,0.6],[-W/2-0.9,1.3,-W/2+0.1,1.9]]; return g; }

/* ---------- the Driftwood Festival ---------- */
// lantern posts with bunting between them, in a ring around the plaza (local to the plaza center)
// pts: [x, y, z] local to the plaza center (main.js leaves out any spot without open ground); bunting only spans neighbors
export function buildFestRing(pts, seed=1){
  const g=new THREE.Group(), w=OAK(), n=pts.length;
  pts.forEach(([x,y,z],i)=>{ mk(G.cyl(0.06,0.08,2.8,8), w, x,y+1.4,z,g); const l=mk(G.sph(0.17,12,10), glowMat([0xffb070,0xff8a8a,0xffe070,0x9ad8ff][i%4]), x,y+2.6,z,g); l.scale.y=1.25; addGlow(g, 0, 1.6, 0xffc080).position.set(x,y+2.6,z); });
  for (let i=0;i<n && n>1;i++){ const [x1,y1,z1]=pts[i], [x2,y2,z2]=pts[(i+1)%n]; if (Math.hypot(x2-x1,z2-z1)<7.5) bunting(g, [x1,y1+2.45,z1], [x2,y2+2.45,z2], 9, seed+i, 0.45); }
  return g; }
// a stall with a striped awning; the islander who runs it stands behind (main.js seats them at userData.stand)
export function buildFestStall(seed=1, goods=[]){
  const g=new THREE.Group(), r=mulberry32(seed), c=PAINT[Math.floor(r()*5)], w=OAK();
  mk(G.box(1.8,0.9,0.7), w, 0,0.45,0,g); mk(G.box(1.9,0.06,0.78), M(0xf4ead8), 0,0.92,0,g); mk(G.box(1.7,0.5,0.02), cloth(c), 0,0.6,0.36,g);
  for (const x of [-0.88,0.88]) for (const z of [-0.3,0.3]) mk(G.box(0.06,2.2,0.06), w, x,1.1,z,g);
  for (let i=0;i<6;i++){ const s=mk(G.box(0.32,0.03,1.0), cloth(i%2?0xffffff:c), -0.8+i*0.32, 2.22, 0.15, g); s.rotation.x=-0.28; }
  for (let i=0;i<6;i++) pennant(g, -0.8+i*0.32, 2.07, 0.62, i%2?0xffffff:c, 0.7);
  // the goods on the counter
  goods.slice(0,3).forEach((id,i)=>{ const gg=new THREE.Group(); gg.position.set(-0.55+i*0.55, 0.95, 0.05); gg.scale.setScalar(0.8); g.add(gg);
    if (id==='candyapple' || id==='festpie') ITEM_BUILDERS[id](gg); else if (FURN_BUILDERS[id]){ gg.scale.setScalar(0.32); FURN_BUILDERS[id](gg); } });
  g.userData.rects=[[-0.95,-0.4,0.95,0.4]]; g.userData.stand=[0, -0.85]; return g; }

/* ---------- Starfall Isle spells ---------- */
// the aurora: long soft curtains of light high over the island. main.js fades it in after dark.
export function buildAurora(R=60, seed=3, dir=null){   // v1.50 dir: center the curtains on that heading (for the view while a spell is cast)
  const g=new THREE.Group(), r=mulberry32(seed), mats=[];
  const vs=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const fs=`uniform float uT; uniform float uA; uniform vec3 uC1; uniform vec3 uC2; varying vec2 vUv;
    void main(){ float w=sin(vUv.x*18.0+uT*0.7)*0.5+sin(vUv.x*7.0-uT*0.4)*0.5; float band=smoothstep(0.0,0.25,vUv.y)*(1.0-smoothstep(0.35,1.0,vUv.y));
      float rays=0.65+0.35*sin(vUv.x*120.0+w*4.0+uT*1.3); vec3 c=mix(uC1,uC2,vUv.y+w*0.15); float edge=smoothstep(0.0,0.08,vUv.x)*(1.0-smoothstep(0.92,1.0,vUv.x));
      gl_FragColor=vec4(c, band*rays*edge*uA*(0.55+0.45*w)); }`;
  const cols=[[0x3affa0,0x7a5aff],[0x6affd0,0xd05aff],[0x3ad8ff,0x5affa0]];
  for (let i=0;i<3;i++){ const seg=64, geo=new THREE.PlaneGeometry(1,1,seg,1), pos=geo.attributes.position, arc=1.6+r()*0.8, a0=dir===null ? r()*TAU : dir-arc/2+(r()-0.5)*0.6, rr=R*(0.75+r()*0.4), h=28+r()*10;
    for (let k=0;k<pos.count;k++){ const u=pos.getX(k)+0.5, v=pos.getY(k)+0.5, a=a0+u*arc, wob=Math.sin(u*9+i)*R*0.06;
      pos.setXYZ(k, Math.cos(a)*(rr+wob), 34+i*5+v*h, Math.sin(a)*(rr+wob)); }
    geo.computeBoundingSphere();
    const m=new THREE.ShaderMaterial({ vertexShader:vs, fragmentShader:fs, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending, fog:false,
      uniforms:{ uT:{ value:0 }, uA:{ value:0 }, uC1:{ value:new THREE.Color(cols[i][0]) }, uC2:{ value:new THREE.Color(cols[i][1]) } } });
    mats.push(m); const mesh=new THREE.Mesh(geo, m); mesh.frustumCulled=false; mesh.renderOrder=-1; g.add(mesh); }
  g.userData.tick = (t, a) => { for (const m of mats){ m.uniforms.uT.value=t; m.uniforms.uA.value=a; } g.visible=a>0.01; };
  return g; }
// v1.50 points of light that drift and fade: the aurora's motes and the sparkles rising off the glowing paths.
// One Points draw each, moved on the CPU (a hundred or so at a time). spawn(p) places a new one and returns false if
// there's nowhere to put it; main.js sets uScale from the screen so they keep their size on every device.
export function buildMotes(n, cols, size=0.3){
  const geo=new THREE.BufferGeometry(), pos=new Float32Array(n*3), col=new Float32Array(n*3), al=new Float32Array(n);
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.setAttribute('aC', new THREE.BufferAttribute(col,3)); geo.setAttribute('aA', new THREE.BufferAttribute(al,1));
  const mat=new THREE.ShaderMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    uniforms:{ uScale:{ value:500 }, uSize:{ value:size } },
    vertexShader:`attribute vec3 aC; attribute float aA; varying vec3 vC; varying float vA; uniform float uScale; uniform float uSize;
      void main(){ vC=aC; vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aA>0.0 ? uSize*uScale/max(1.0,-mv.z) : 0.0; gl_Position=projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 vC; varying float vA; void main(){ float r=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,r); a=a*a*0.8+smoothstep(0.14,0.0,r); gl_FragColor=vec4(vC*a*vA,1.0); }` });
  const P=new THREE.Points(geo, mat); P.frustumCulled=false; P.renderOrder=2;
  const st=[...Array(n)].map(()=>({ life:0, max:1, x:0, y:0, z:0, vx:0, vy:0, vz:0, ph:Math.random()*TAU, c:0 }));
  P.userData.update=(dt, t, strength, spawn, budget=4)=>{
    for (let i=0;i<n;i++){ const p=st[i];
      if (p.life<=0){ if (strength>0.01 && budget>0 && spawn(p)){ budget--; p.life=p.max; const c=cols[p.c%cols.length]; col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b; } else { al[i]=0; continue; } }
      p.life-=dt; p.x+=(p.vx+Math.sin(t*1.1+p.ph)*0.25)*dt; p.y+=p.vy*dt; p.z+=(p.vz+Math.cos(t*0.9+p.ph)*0.25)*dt;
      const k=1-p.life/p.max; pos[i*3]=p.x; pos[i*3+1]=p.y; pos[i*3+2]=p.z;
      al[i]=Math.max(0, strength*Math.sin(Math.PI*Math.min(1,k))*(0.75+0.25*Math.sin(t*6+p.ph*3))); }
    geo.attributes.position.needsUpdate=geo.attributes.aA.needsUpdate=geo.attributes.aC.needsUpdate=true; };
  P.userData.cols=cols.map(c=>new THREE.Color(c)); cols=P.userData.cols;
  return P; }
// v1.50 the moment a spell takes at the star altar: a column of light up into the sky, rings rising and opening out.
// Runs on its own clock (tick(dt) returns false when it's over).
export function buildCastBeam(color=0x9ad8ff){
  const g=new THREE.Group(), mats=[];
  const bm=new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide, fog:false }); mats.push(bm);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 80, 16, 1, true), bm); beam.position.y=40; g.add(beam);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 80, 10, 1, true), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); core.position.y=40; g.add(core); mats.push(core.material);
  const rings=[...Array(5)].map((_,i)=>{ const m=new THREE.Mesh(new THREE.TorusGeometry(1,0.06,8,40), new THREE.MeshBasicMaterial({ color:i%2?0xd8b0ff:color, transparent:true, opacity:0, depthWrite:false, blending:THREE.AdditiveBlending, fog:false })); m.rotation.x=Math.PI/2; g.add(m); return m; });
  let T=0; const D=4.2;
  g.userData.tick=dt=>{ T+=dt; const up=Math.min(1,T/0.5), down=1-Math.max(0,(T-D+1)/1);
    bm.opacity=0.55*up*down*(0.85+0.15*Math.sin(T*20)); core.material.opacity=0.9*up*down; beam.scale.set(1+0.2*Math.sin(T*7),1,1+0.2*Math.sin(T*7));
    rings.forEach((m,i)=>{ const k=((T*0.55+i/5)%1); m.position.y=1+k*9; m.scale.setScalar(0.8+k*1.6); m.material.opacity=0.8*(1-k)*up*down; });
    return T<D; };
  return g; }
