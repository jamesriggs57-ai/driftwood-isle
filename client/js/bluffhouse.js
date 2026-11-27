/* =====================================================================
   v1.60 THE LANTERN BLUFF LIGHTHOUSE: the old lighthouse on Wendell's bluff isle, now a proper landmark (about two and a half times
   as tall as before) that you can walk into and climb.

   Inside you see what years of nobody have done to it, and it gets put right as Skipper Wick's lighthouse story moves on.
   Stages (main.js works out which one from the story and hands it to setStage):
     0 ruined   - nobody has been up in years. Treads missing or snapped short, a beam down across the floor,
                  puddles, cobwebs, peeling paint and rust, boarded windows, gulls nesting, the old keeper's logbook
                  pages all over the floor, and up top an empty lamp room with cracked glass.
     1 patched  - Marlo has carried the new lens up: fresh planks over the gaps in the stair, rope over the gaps in the
                  rail, the lens waiting in its crate.
     2 mending  - the workshop is making the lamp frame: new treads all the way up, the boards off the windows, new
                  glass in the lamp room, the fallen beam hauled out, fresh plaster on the bare patches.
     3 lit      - the lamp is in and turning: fresh paint inside and out, brass on the rail, lamps on the walls,
                  the logbook back on the keeper's desk.

   buildBluffTower(seed) is the model (expand.js hands it out as the bluff's landmark), buildBluffLod() the far-off
   silhouette, makeBluffLighthouse(ctx) the controller: on the ground floor you walk about freely; the stair is a climb
   like the Lighthouse Point one (lighthouse.js, whose gallery code this shares), stepping round the broken treads.
   Local tower coordinates: angle a points along (sin a, cos a), so a=0 is local +z, the side with the door.
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32 } from './util.js';
import { mk, G, glowMat, addGlow, buildGull } from './models.js';
import { mergeStatic } from './cottage.js';
import { perchKit, stairMove, stairTap, deckMove, followCam, VIEW, behind, fadeTo, angD, wrap } from './lighthouse.js';

// ---- sizes (metres). Characters stand about 1.7 m tall; the old bluff lighthouse was 11 m to the top of its roof. ----
export const BT = {
  base:0.7,              // top of the stone plinth: the ground floor inside
  top:22.0,              // top of the shaft
  G:22.1,                // gallery and lamp room floor
  rBot:4.3, rTop:3.2,    // outside radius of the shaft, bottom and top
  wall:0.3,
  foot:5.0,              // the plinth: the solid footprint on the knoll
  deckR:4.35, railR:4.2, walkR:3.65, glassR:2.6, panR:1.5,
  steps:108, turns:3.75, a0:0.9,
  tread:1.4,             // how far a tread sticks out of the wall
  pathIn:0.72,           // where you walk on it, in from the wall
  floorR:3.5,            // how far from the middle you can walk on the ground floor
  camD:11.5, camH:8.5, camUp:4.5,   // inside: the camera's distance from the middle, its height over the floor, and how far over you it sits on the stair
};
BT.rise = (BT.G-BT.base)/BT.steps;
BT.dA = BT.turns*TAU/BT.steps;
BT.a1 = BT.a0 + BT.turns*TAU;                 // where the stair comes out, by the lamp room door
const rOut = y => lerp(BT.rBot, BT.rTop, clamp((y-BT.base)/(BT.top-BT.base),0,1));
const rIn = y => rOut(y)-BT.wall;
const SEG = 16, segMid = i => (i+0.5)/SEG*TAU, segOf = a => Math.floor(wrap(a)/TAU*SEG)%SEG;
const stepA = i => BT.a0+(i+0.5)*BT.dA, stepY = i => BT.base+(i+1)*BT.rise;
const pol = (a, r, y=0) => new THREE.Vector3(Math.sin(a)*r, y, Math.cos(a)*r);
const STAIR_LOW = 2.0;                        // the first 2 radians of stair are too low to walk under
const A1 = wrap(BT.a1), GAP_A = A1+2.3, SCOPE_A = A1+Math.PI+0.4, GULL_A = A1+1.25;   // up top: the gap in the rail, Wick's telescope, the gull
// the two lamp room panes boarded over until the workshop comes (stage 2), in the tower's own frame
const LR_GAP=0.38, LR_SPAN=TAU-LR_GAP*2;
export const BOARD_A = [2,7].map(i=>A1+LR_GAP+i/11*LR_SPAN+LR_SPAN/22);
export const BLUFF_STAGES = ['ruined', 'patched', 'mending', 'lit'];

// the stair before anyone fixes it: treads gone outright (you hop the gap) and treads snapped short (you keep to the wall)
const MISSING = new Set([7, 18, 31, 44, 57, 70, 83, 95]);
const BROKEN = new Set([12, 13, 25, 38, 39, 51, 64, 77, 78, 89, 101]);
const WINDOWS = [16, 34, 52, 70, 88];          // a window above these treads, all the way up
const NESTS = new Set([34, 70]);              // gulls nest on these sills

// colors for each stage: [ruined, patched, mending, lit]
const C = {
  red:[0x9a6a5e,0x9a6a5e,0x9a6a5e,0xd8483a], white:[0xc9c0ac,0xc9c0ac,0xc9c0ac,0xf4f0e6], inner:[0x8e8676,0x8e8676,0xcfc6b2,0xf2ead8],
  floor:[0x6e695c,0x6e695c,0x8a8476,0xa89a82], rail:[0x8a5034,0x8a5034,0x34343c,0xc8a040], iron:[0x7a4a30,0x7a4a30,0x3a3a44,0x3a3a44],
  roof:[0x7a5048,0x7a5048,0x7a5048,0xc8503d], deck:[0x5a4c46,0x5a4c46,0x4a4a54,0x4a4a54], tread:[0x5e4e3e,0x5e4e3e,0x5e4e3e,0x8e6240],
  pedestal:[0x6a4a34,0x6a4a34,0x7a6a50,0xc8a040], door:[0x5a4a3a,0x5a4a3a,0x7a5434,0x3a6a8a],
};

/* ---------- the model ---------- */
export function buildBluffTower(seed=1){
  const g=new THREE.Group(), r=mulberry32((seed|0)^0x51ad);
  const own = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color:c, roughness:0.85 }, o||{}));   // not the shared M() cache: these change color with the stage
  const mat = { red:own(C.red[0]), white:own(C.white[0]), inner:own(C.inner[0], { side:THREE.BackSide, roughness:0.95 }), floor:own(C.floor[0], { flatShading:true }),
    rail:own(C.rail[0], { metalness:0.3, roughness:0.6 }), iron:own(C.iron[0], { metalness:0.2 }), roof:own(C.roof[0]), deck:own(C.deck[0], { side:THREE.DoubleSide, roughness:0.8 }),
    tread:own(C.tread[0]), pedestal:own(C.pedestal[0], { metalness:0.4, roughness:0.5 }), door:own(C.door[0]) };
  const k = { stone:own(0xa8a094, { flatShading:true }), stone2:own(0x8e887c, { flatShading:true }), moss:own(0x5f7a3e), ivy:own(0x4a7a3a, { flatShading:true }),
    wood:own(0x7a5a3e), oldwood:own(0x6a5644), fresh:own(0xd8b484), plank:own(0xc89c68), dark:own(0x2a2622), brick:own(0x8a5e4a, { flatShading:true }),
    plaster:own(0xebe4d2), rust:own(0x8a4a2a, { roughness:1 }), water:own(0x4a5a64, { roughness:0.05, metalness:0.3, transparent:true, opacity:0.75 }),
    paper:own(0xf2ead2, { side:THREE.DoubleSide }), web:new THREE.MeshBasicMaterial({ color:0xe8e8e2, transparent:true, opacity:0.1, side:THREE.DoubleSide, depthWrite:false }), webLine:new THREE.MeshBasicMaterial({ color:0xe8e8e2, transparent:true, opacity:0.4, depthWrite:false }),
    nest:own(0x8a6a42, { roughness:1 }), egg:own(0xe8e0cc), cloth:own(0xe8e0c8, { flatShading:true }), rope:own(0xc8a870), rug:own(0x9a4a3a), rug2:own(0xd8b060),
    sky:new THREE.MeshBasicMaterial({ color:0xd8ecf4 }), brass:own(0xc8a040, { metalness:0.5, roughness:0.35 }), green:own(0x4a7a5a), chalk:own(0xf4f0e8) };
  const glassOld=new THREE.MeshStandardMaterial({ color:0x8a9a90, transparent:true, opacity:0.55, roughness:0.4, metalness:0.1, depthWrite:false, side:THREE.DoubleSide });
  const glassNew=new THREE.MeshStandardMaterial({ color:0xd8f2ff, transparent:true, opacity:0.2, roughness:0.05, metalness:0.1, depthWrite:false, side:THREE.DoubleSide });
  const ST=[];   // [object, first stage, last stage]: shown only in those stages
  const stg = (o, lo, hi=3) => { ST.push([o, lo, hi]); return o; };
  // a sub-group of parent shown only in stages lo..hi (merged into a few meshes once the model is built)
  const SG=[]; const sg = (parent, lo, hi=3) => { const key=lo+'_'+hi, m=(parent.userData.sg=parent.userData.sg||{}); if (!m[key]){ m[key]=stg(new THREE.Group(), lo, hi); parent.add(m[key]); SG.push(m[key]); } return m[key]; };
  const flat = m => { m.castShadow=false; m.receiveShadow=false; return m; };
  // something on the inside of the wall at angle a, height y; local +z faces into the room
  const wallIn = (parent, a, y, inset=0.02) => { const p=new THREE.Group(), rr=rIn(y)-inset; p.position.set(Math.sin(a)*rr, y, Math.cos(a)*rr); p.rotation.y=a+Math.PI; parent.add(p); return p; };
  const wallOut = (parent, a, y, out=0.02) => { const p=new THREE.Group(), rr=rOut(y)+out; p.position.set(Math.sin(a)*rr, y, Math.cos(a)*rr); p.rotation.y=a; parent.add(p); return p; };
  const nest = (parent, x, y, z, s=1) => { const n=new THREE.Group(); n.position.set(x,y,z); n.scale.setScalar(s); parent.add(n); const t=flat(mk(G.tor(0.16,0.07,5,10), k.nest, 0,0.05,0,n)); t.rotation.x=Math.PI/2; t.scale.z=0.7;
    flat(mk(G.cyl(0.14,0.1,0.06,8), k.nest, 0,0.02,0,n)); for (let e=0;e<3;e++) flat(mk(G.sph(0.045,6,5), k.egg, Math.cos(e*2.1)*0.06,0.08,Math.sin(e*2.1)*0.06,n)).scale.y=1.3; return n; };
  const web = (parent, x, y, z, ry, s=1) => { const w=flat(new THREE.Mesh(new THREE.CircleGeometry(0.7*s, 6, 0, Math.PI/2), k.web)); w.position.set(x,y,z); w.rotation.y=ry; parent.add(w);
    for (let i=0;i<3;i++){ const t=flat(mk(G.tor(0.25*s+i*0.18*s, 0.006, 3, 8, Math.PI/2), k.webLine, x,y,z,parent)); t.rotation.y=ry; } return w; };

  /* -- the plinth, the front steps, ivy -- */
  const out=new THREE.Group(); g.add(out);
  mk(G.cyl(BT.foot, BT.foot+0.35, 2.3, 28), k.stone, 0, BT.base-1.15, 0, out);                       // reaches well down, so it covers the knoll's slope
  { const cap=mk(G.cyl(BT.foot+0.06, BT.foot+0.06, 0.16, 28), k.stone2, 0, BT.base-0.06, 0, out); cap.castShadow=false; }
  for (let s=0;s<3;s++) mk(G.box(2.6-s*0.2, 0.24, 0.42), k.stone, 0, BT.base-0.12-s*0.23, BT.foot+0.12+s*0.36, out);
  { const sg0=sg(out,0,2);
    for (let i=0;i<16;i++){ const a=r()*TAU; if (Math.abs(angD(a,0))<0.5) continue; const m=flat(mk(G.sph(0.22+r()*0.24,7,5), k.moss, 0,0,0,sg0)); m.position.copy(pol(a, BT.foot-0.25-r()*0.35, BT.base)); m.scale.set(1+r()*0.6, 0.25, 1); m.rotation.y=r()*TAU; } }

  /* -- the shaft: 16 wedges so the near side can cut away. Six bands outside, plaster inside. -- */
  const segs=[]; const BANDS=6, bandH=(BT.top-BT.base)/BANDS;
  for (let i=0;i<SEG;i++){ const s=new THREE.Group(), t0=i/SEG*TAU, tl=TAU/SEG+0.002; g.add(s); segs.push(s);
    for (let b=0;b<BANDS;b++){ const y0=BT.base+b*bandH, y1=y0+bandH; const m=mk(new THREE.CylinderGeometry(rOut(y1),rOut(y0),bandH,3,1,true,t0,tl), b%2?mat.white:mat.red, 0,y0+bandH/2,0,s); m.receiveShadow=false; }
    flat(mk(new THREE.CylinderGeometry(rIn(BT.top),rIn(BT.base),BT.top-BT.base,3,1,true,t0,tl), mat.inner, 0,(BT.top+BT.base)/2,0,s)); }
  // ivy up the base until it's all painted: hung on the wall wedges, so it cuts away with them
  for (let i=0;i<9;i++){ const a=Math.PI*0.6+i*0.55+(r()-0.5)*0.3, h=0.8+r()*2.6;
    for (let j=0;j<4;j++){ const y=BT.base+0.2+j*h/4, aa=a+(r()-0.5)*0.2, l=flat(mk(G.ico(0.32+r()*0.18,0), k.ivy, 0,0,0,sg(segs[segOf(aa)],0,2))); l.position.copy(pol(aa, rOut(y)+0.08, y)); l.scale.set(1,1.3,0.5); l.rotation.y=aa; } }
  // peeling paint and rust streaks, outside (painted over once it's lit) and in (plastered at stage 2, painted at 3)
  for (let i=0;i<34;i++){ const a=r()*TAU, y=BT.base+1+r()*(BT.top-BT.base-2); if (Math.abs(angD(a,0))<0.4 && y<3.5) continue; const s=segs[segOf(a)];
    const p=wallOut(sg(s,0,2), a, y, 0.015); flat(mk(G.box(0.4+r()*0.9, 0.25+r()*0.6, 0.03), r()<0.5?k.plaster:k.stone2, 0,0,0,p)).rotation.z=(r()-0.5)*0.4; }
  for (let i=0;i<30;i++){ const a=r()*TAU, y=BT.base+0.5+r()*(BT.top-BT.base-1.5), s=segs[segOf(a)], w=0.4+r()*1.0, h=0.3+r()*0.7, rz=(r()-0.5)*0.3;
    flat(mk(G.box(w, h, 0.03), k.brick, 0,0,0, wallIn(sg(s,0,1), a, y, 0.015))).rotation.z=rz;
    flat(mk(G.box(w+0.1, h+0.1, 0.03), k.plaster, 0,0,0, wallIn(sg(s,2,2), a, y, 0.015))).rotation.z=rz; }
  for (let i=0;i<14;i++){ const a=r()*TAU, y=BT.base+2+r()*(BT.top-BT.base-4), s=segs[segOf(a)], h=1.2+r()*2.2;    // damp running down the inside
    flat(mk(G.box(0.12+r()*0.2, h, 0.02), k.rust, 0,-h/2,0, wallIn(sg(s,0,1), a, y, 0.012))); }

  /* -- windows up the stair: boarded until the workshop comes, glass after; gulls nest on two of the sills -- */
  const winAt = [...WINDOWS.map(i=>[stepA(i), stepY(i)+1.45]), [-1.75, BT.base+2.1]];
  winAt.forEach(([a,y], wi)=>{ const s=segs[segOf(a)], o=wallOut(s, a, y);
    mk(G.box(0.82,1.3,0.12), k.dark, 0,0,0,o).castShadow=false;
    flat(mk(G.box(0.62,1.1,0.08), glassNew, 0,0,0.04,stg(new THREE.Group(),2))); o.add(ST[ST.length-1][0]);
    { const b=sg(o,0,1); for (const [yy,rz] of [[0.3,0.25],[-0.05,-0.15],[-0.4,0.1]]){ const p=mk(G.box(0.95,0.16,0.05), k.oldwood, 0,yy,0.1,b); p.rotation.z=rz; } }
    for (let j=0;j<2;j++) flat(mk(G.box(0.05, 0.9+r()*0.6, 0.02), k.rust, -0.2+j*0.4, -1.1, 0.03, sg(o,0,2)));   // rust under the frame
    const ii=wallIn(s, a, y); flat(mk(G.box(0.66,1.12,0.04), k.sky, 0,0,0,sg(ii,2))); flat(mk(G.box(0.66,1.12,0.04), k.dark, 0,0,0,sg(ii,0,1)));
    for (const yy of [0.32,-0.08,-0.42]) flat(mk(G.box(0.86,0.15,0.04), k.oldwood, 0,yy,0.04,sg(ii,0,1))).rotation.z=(r()-0.5)*0.3;
    flat(mk(G.box(0.8,0.08,0.3), k.wood, 0,-0.6,0.12,ii));
    if (NESTS.has(WINDOWS[wi])) nest(sg(ii,0,2), 0.1,-0.52,0.18, 1.1);
    if (wi<WINDOWS.length) web(sg(ii,0,1), 0.42,0.6,0.06, 0, 0.8); });

  /* -- the door: off one hinge to begin with, a new blue one once the lamp is lit -- */
  { const s=segs[segOf(0)], o=wallOut(s, 0, BT.base, 0.03);
    flat(mk(G.box(1.5,2.3,0.12), k.dark, 0,1.15,0,o)); const arch=flat(mk(new THREE.CylinderGeometry(0.75,0.75,0.12,16,1,false,-Math.PI/2,Math.PI), k.dark, 0,2.3,0,o)); arch.rotation.x=Math.PI/2;
    flat(mk(G.box(1.9,0.18,0.25), k.stone2, 0,3.15,0.05,o));
    const hang=new THREE.Group(); hang.position.set(-0.68,0,0.1); hang.rotation.set(0,-1.2,0.12); stg(hang,0,1); o.add(hang);   // hanging off its top hinge, a plank gone
    for (let j=0;j<5;j++) if (j!==3) mk(G.box(0.25,2.15-(j===4?0.4:0),0.07), mat.door, 0.15+j*0.27,1.1-(j===4?0.2:0),0,hang);
    const nd=new THREE.Group(); nd.position.set(-0.7,0,0.08); nd.rotation.y=-1.9; stg(nd,2); o.add(nd);
    mk(G.box(1.38,2.2,0.08), mat.door, 0.69,1.1,0,nd); mk(G.sph(0.06,8,6), k.brass, 1.2,1.1,0.07,nd);
    const lamp=stg(new THREE.Group(),3); lamp.position.set(1.0,2.0,0.18); o.add(lamp); mk(G.box(0.08,0.35,0.1), k.dark, 0,0,0,lamp); flat(mk(G.box(0.2,0.26,0.2), glowMat(0xffc860), 0,-0.05,0.14,lamp)); addGlow(lamp, -0.05, 1.8);
    // the same doorway from inside: daylight through it
    const ii=wallIn(s, 0, BT.base, 0.03); flat(mk(G.box(1.36,2.15,0.04), k.sky, 0,1.08,0,ii)); flat(mk(G.box(1.6,0.14,0.08), k.wood, 0,2.2,0.02,ii)); }

  /* -- inside: the floor, and what's on it -- */
  const ins=new THREE.Group(); g.add(ins);
  flat(mk(G.cyl(rIn(BT.base)+0.02, rIn(BT.base)+0.02, 0.1, 32), mat.floor, 0, BT.base-0.05, 0, ins));
  for (let i=0;i<14;i++){ const a=r()*TAU, d=r()*3.2, f=flat(mk(G.box(0.6+r()*0.4,0.012,0.5+r()*0.3), k.stone2, 0,0,0,sg(ins,0,1))); f.position.copy(pol(a,d,BT.base+0.006)); f.rotation.y=r()*3; }   // cracked flags
  const floorAt = (a, d, parent) => { const p=new THREE.Group(); p.position.copy(pol(a, d, BT.base)); parent.add(p); return p; };
  // puddles under the leaks
  for (const [a,d,s] of [[-1.15,2.3,0.75],[0.55,1.7,0.5],[3.6,2.1,0.6]]){ const p=flat(mk(G.cyl(s,s,0.012,16), k.water, 0,0,0,floorAt(a,d,sg(ins,0,1)))); p.position.y=0.008; p.scale.z=0.7; }
  // the fallen beam: down from somewhere up the shaft, one end on the floor and one against the wall
  const beamS=pol(-2.35, 0.8, BT.base+0.18), beamE=pol(-1.55, rIn(2.6)-0.18, BT.base+2.35), fallen=sg(ins,0,1);
  { const v=beamE.clone().sub(beamS), L=v.length(), b=new THREE.Mesh(G.box(0.34,0.34,L), k.oldwood); b.position.copy(beamS).addScaledVector(v,0.5); b.castShadow=false; fallen.add(b); b.lookAt(beamE); for (let i=0;i<7;i++){ const d=flat(mk(G.dod(0.12+r()*0.14), k.stone2, 0,0,0,fallen)); d.position.copy(pol(-2.35+(r()-0.5)*1.1, 0.4+r()*1.3, BT.base+0.06)); }
    for (let i=0;i<3;i++){ const p=flat(mk(G.box(0.12,0.05,0.9+r()*0.6), k.oldwood, 0,0,0,fallen)); p.position.copy(pol(-2.0+(r()-0.5), 1.2+r(), BT.base+0.04)); p.rotation.y=r()*3; }
    nest(fallen, beamE.x*0.82+beamS.x*0.18, beamE.y*0.82+beamS.y*0.18+0.2, beamE.z*0.82+beamS.z*0.18, 1.0); }
  // crates and a barrel: smashed and tipped over, then stacked; a coil of rope
  { const c0=floorAt(-2.95, 2.9, sg(ins,0,1)); const lid=mk(G.box(0.9,0.06,0.9), k.oldwood, 0.15,0.25,0.2,c0); lid.rotation.set(0.5,0.3,0.2); flat(lid);
      for (let j=0;j<4;j++){ const sl=flat(mk(G.box(0.85,0.12,0.06), k.oldwood, 0, 0.1+j*0.15, -0.42, c0)); sl.rotation.z=(r()-0.5)*0.2; } flat(mk(G.box(0.06,0.5,0.85), k.oldwood, -0.42,0.25,0,c0)).rotation.z=0.25;
    const c1=floorAt(-2.95, 2.9, sg(ins,2)); c1.rotation.y=0.4; mk(G.box(0.9,0.8,0.9), k.wood, 0,0.4,0,c1).castShadow=false; mk(G.box(0.7,0.6,0.7), k.wood, 0.05,1.1,0.05,c1).castShadow=false;
    const b0=floorAt(-0.75, 3.05, sg(ins,0,1)); const br=flat(mk(G.cyl(0.38,0.38,0.95,12), k.oldwood, 0,0.38,0,b0)); br.rotation.set(0,0.6,Math.PI/2); flat(mk(G.cyl(0.6,0.6,0.01,12), k.rust, 0.4,0.006,0.3,b0)).scale.z=0.5;
    const b1=floorAt(-0.75, 3.05, sg(ins,2)); flat(mk(G.cyl(0.38,0.38,0.95,12), k.wood, 0,0.47,0,b1)); for (const y of [0.2,0.75]) flat(mk(G.tor(0.39,0.025,4,16), mat.iron, 0,y,0,b1)).rotation.x=Math.PI/2;
    const rp=floorAt(-3.45, 2.2, sg(ins,1)); for (let j=0;j<3;j++) flat(mk(G.tor(0.26-j*0.02,0.05,5,14), k.rope, 0,0.05+j*0.09,0,rp)).rotation.x=Math.PI/2; }
  // the old keeper's logbook, its pages all over the floor (gathered up on the desk once it's lit)
  const PAGES=[[-0.55,2.15,0.4],[-2.6,1.55,1.6],[3.3,1.25,2.6]];
  for (const [a,d,ry] of PAGES){ const p=floorAt(a,d,sg(ins,0,2)); p.rotation.y=ry; for (let j=0;j<3;j++){ const s=flat(mk(G.box(0.28,0.006,0.36), k.paper, (r()-0.5)*0.4, 0.006+j*0.004, (r()-0.5)*0.4, p)); s.rotation.y=(r()-0.5)*1.2; } }
  { const lb=floorAt(1.9, 1.0, sg(ins,0,2)); lb.rotation.y=0.7; const cov=flat(mk(G.box(0.34,0.06,0.46), k.rug, 0,0.03,0,lb)); cov.rotation.z=0.15; }
  // cobwebs where the stair meets the wall, and in the corners
  for (const a of [-2.7,-1.0,0.8,3.6]) web(sg(ins,0,1), Math.sin(a)*(rIn(1.8)-0.05), BT.base+1.6, Math.cos(a)*(rIn(1.8)-0.05), a+Math.PI*0.75, 1.1);
  // stage 1: Marlo's lantern hung on a nail by the stair foot, a fresh plank or two left over
  { const l=wallIn(sg(ins,1,2), BT.a0-0.35, BT.base+2.0, 0.06); mk(G.box(0.05,0.3,0.05), k.dark, 0,0.15,0.03,l); const lb=flat(mk(G.box(0.2,0.26,0.2), glowMat(0xffd080), 0,-0.08,0.14,l)); addGlow(l, -0.08, 2.0);
    const pl=floorAt(-1.9, 2.5, sg(ins,1,2)); for (let j=0;j<3;j++) flat(mk(G.box(0.3,0.05,1.5), k.fresh, j*0.32-0.3,0.03+j*0.05,0,pl)).rotation.y=j*0.08; }
  // stage 2: the workshop at it: a sawhorse, a ladder against the wall, a paint pot, the old treads piled up
  const ladder=sg(ins,2,2);
  { const sh=floorAt(-2.0, 2.4, sg(ins,2,2)); sh.rotation.y=1.0; flat(mk(G.box(1.2,0.08,0.12), k.wood, 0,0.72,0,sh)); for (const x of [-0.5,0.5]) for (const s of [-1,1]){ const l=flat(mk(G.box(0.06,0.78,0.06), k.wood, x,0.36,s*0.12,sh)); l.rotation.x=s*0.25; }
    flat(mk(G.box(0.3,0.05,1.4), k.fresh, 0.1,0.78,0,sh)).rotation.y=Math.PI/2;
    const lad=new THREE.Group(); lad.position.copy(pol(-1.0, rIn(2)-0.5, BT.base)); lad.rotation.y=-1.0+Math.PI; ladder.add(lad); for (const x of [-0.25,0.25]){ const s=flat(mk(G.box(0.06,3.4,0.06), k.fresh, x,1.68,0.25,lad)); s.rotation.x=-0.16; }
    for (let j=0;j<8;j++) flat(mk(G.box(0.5,0.04,0.05), k.fresh, 0,0.35+j*0.4,0.2-j*0.064,lad));
    const pot=floorAt(-1.45, 2.0, sg(ins,2,2)); flat(mk(G.cyl(0.14,0.13,0.26,10), k.plaster, 0,0.13,0,pot)); flat(mk(G.cyl(0.13,0.13,0.01,10), mat.white, 0,0.265,0,pot));
    const pile=floorAt(-2.75, 1.7, sg(ins,2,2)); for (let j=0;j<6;j++) flat(mk(G.box(1.3,0.1,0.4), k.oldwood, (r()-0.5)*0.3, 0.05+j*0.1, (r()-0.5)*0.3, pile)).rotation.y=(r()-0.5)*0.7; }
  // stage 3: the keeper's desk with the logbook, a round rug, lamps on the wall, a plant in the window
  { const d=floorAt(-1.3, 3.15, sg(ins,3)); d.rotation.y=-1.3+Math.PI; mk(G.box(1.2,0.07,0.6), k.wood, 0,0.76,0,d).castShadow=false;
    for (const x of [-0.52,0.52]) for (const z of [-0.24,0.24]) flat(mk(G.box(0.06,0.76,0.06), k.wood, x,0.38,z,d));
    flat(mk(G.box(0.36,0.06,0.48), k.rug, -0.15,0.82,0,d)); flat(mk(G.box(0.34,0.01,0.44), k.paper, -0.15,0.856,0,d)); flat(mk(G.cyl(0.07,0.09,0.2,10), k.green, 0.38,0.89,-0.1,d));
    const ch=new THREE.Group(); ch.position.set(0,0,0.65); d.add(ch); flat(mk(G.box(0.46,0.06,0.46), k.wood, 0,0.46,0,ch)); flat(mk(G.box(0.46,0.5,0.05), k.wood, 0,0.72,0.22,ch)); for (const x of [-0.2,0.2]) for (const z of [-0.2,0.2]) flat(mk(G.box(0.05,0.46,0.05), k.wood, x,0.23,z,ch));
    const rug=floorAt(0, 0, sg(ins,3)); flat(mk(G.cyl(1.7,1.7,0.015,28), k.rug, 0,0.008,0,rug)); flat(mk(G.cyl(1.35,1.35,0.016,28), k.rug2, 0,0.01,0,rug)); flat(mk(G.cyl(0.9,0.9,0.017,28), k.rug, 0,0.012,0,rug));
    const c2=floorAt(-3.45, 2.2, sg(ins,3)); flat(mk(G.cyl(0.25,0.22,0.5,10), k.wood, 0,0.25,0,c2)); flat(mk(G.ico(0.35,1), k.green, 0,0.7,0,c2)).scale.y=0.8; }
  // wall lamps all the way up once it's lit
  const LAMPS=[[-2.3,BT.base+2.3],[-0.6,BT.base+2.4],[0.6,BT.base+2.4],[3.7,BT.base+2.5],...[20,42,64,86].map(i=>[stepA(i)+0.25, stepY(i)+1.6])];
  for (const [a,y] of LAMPS){ const s=segs[segOf(a)], p=wallIn(sg(s,3), a, y, 0.08); flat(mk(G.box(0.08,0.32,0.12), k.dark, 0,0,0.02,p)); flat(mk(G.box(0.18,0.24,0.18), glowMat(0xffc860), 0,0.05,0.14,p)); addGlow(p, 0.05, 1.8); }
  // things on the wall on the way up: a ship painting (soaked and curling until stage 2), a barometer, a coil of rope on a hook
  { const p=wallIn(segs[segOf(stepA(26)+0.3)], stepA(26)+0.3, stepY(26)+1.3, 0.05); mk(G.box(0.9,0.62,0.05), k.wood, 0,0,0,p).castShadow=false;
    flat(mk(G.box(0.78,0.5,0.02), k.sky, 0,0,0.03,sg(p,2))); flat(mk(G.box(0.78,0.5,0.02), k.rust, 0,0,0.03,sg(p,0,1))); const sh=new THREE.Group(); sh.position.z=0.05; p.add(sh);
    flat(mk(G.box(0.36,0.1,0.01), k.dark, 0,-0.1,0,sh)); flat(mk(G.box(0.03,0.28,0.01), k.dark, 0,0.07,0,sh)); flat(mk(G.box(0.2,0.18,0.01), k.paper, 0.08,0.08,0,sh));
    const q=wallIn(segs[segOf(stepA(60)+0.3)], stepA(60)+0.3, stepY(60)+1.25, 0.05); flat(mk(G.cyl(0.22,0.22,0.08,16), mat.pedestal, 0,0,0.04,q)).rotation.x=Math.PI/2; flat(mk(G.cyl(0.18,0.18,0.09,16), k.paper, 0,0,0.05,q)).rotation.x=Math.PI/2;
    flat(mk(G.box(0.02,0.14,0.02), k.dark, 0.03,0.03,0.1,q)).rotation.z=-0.6; flat(mk(G.box(0.3,0.015,0.01), k.dark, 0,0,0.11,sg(q,0,1))).rotation.z=0.7;   // its glass cracked across
    const h=wallIn(segs[segOf(stepA(80)+0.3)], stepA(80)+0.3, stepY(80)+1.4, 0.05); flat(mk(G.cyl(0.03,0.03,0.2,6), k.dark, 0,0,0.1,h)).rotation.x=Math.PI/2; for (let j=0;j<3;j++) flat(mk(G.tor(0.22,0.04,5,14), k.rope, 0,-0.22-j*0.03,0.16,h)); }

  /* -- the stair: one tread per group (the near side cuts away above you); the rail in short runs -- */
  const treads=[], treadBox=new THREE.BoxGeometry(1,1,1);
  for (let i=0;i<BT.steps;i++){ const a=stepA(i), y=stepY(i), rr=rIn(y), tg=new THREE.Group(); tg.position.set(0,y,0); tg.rotation.y=a; g.add(tg);
    const depth=rr*BT.dA*1.08+0.06, m=new THREE.Mesh(treadBox, mat.tread); m.castShadow=false; m.receiveShadow=false; tg.add(m);
    const T={ g:tg, m, a, y, rr, depth, i, stub:null }; treads.push(T);
    if (MISSING.has(i)){ T.stub=flat(mk(G.box(depth*0.9, 0.1, 0.22), k.oldwood, 0,-0.05,rr-0.12,tg)); T.stub.rotation.x=0.2; }
    if (i%9===4 && !MISSING.has(i) && !BROKEN.has(i)) flat(mk(G.cyl(0.02,0.02,0.94,4), mat.rail, 0,0.47,rr-BT.tread+0.07, tg)); }
  T_set(treads, 0);
  // the handrail along the inner edge, in runs of 6 treads; with gaps (and rope over them at stage 1) until stage 2
  const railRuns=[], railPt = s => { const a=BT.a0+s*BT.dA, y=BT.base+(s+0.5)*BT.rise+0.95, rr=rIn(y-0.95)-BT.tread+0.07; return new THREE.Vector3(Math.sin(a)*rr, y, Math.cos(a)*rr); };
  const gapAt = i => MISSING.has(i) || BROKEN.has(i);
  const tube = (rg, from, to, m, rad=0.035) => { const pts=[]; for (let s=from;s<=to+1e-6;s+=0.25) pts.push(railPt(s)); if (pts.length<2) return null;
    return flat(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(2,pts.length*2), rad, 5), m, 0,0,0,rg)); };
  for (let s0=0;s0<BT.steps;s0+=6){ const rg=new THREE.Group(); g.add(rg); const s1=Math.min(BT.steps, s0+6), mid=(s0+s1)/2; railRuns.push({ g:rg, a:BT.a0+mid*BT.dA, y:BT.base+mid*BT.rise });
    const full=tube(rg, s0, s1, mat.rail); if (full) stg(full, 2);
    // stages 0 and 1: the same run in pieces, missing over the broken treads (with rope tied across at stage 1)
    let from=s0; for (let s=s0;s<=s1;s++){ const cut = s<s1 && gapAt(s); if (!cut && s<s1) continue;
      if (s>from){ const m=tube(rg, from, s, mat.rail); if (m) stg(m, 0, 1); }
      if (cut){ const rp=tube(rg, s, s+1, k.rope, 0.025); if (rp){ stg(rp, 1, 1); rp.position.y=-0.12; } from=s+1; } } }

  /* -- the gallery: a deck round the lamp room, struts under it, the rail (with a gap to begin with) -- */
  const deck=new THREE.Group(), brackets=[]; g.add(deck);
  { const ring=(r0,r1,t0=0,tl=TAU)=>{ const m=new THREE.Mesh(new THREE.RingGeometry(r0, r1, 48, 1, t0-Math.PI/2, tl), mat.deck); m.rotation.x=-Math.PI/2; m.position.y=BT.G; m.receiveShadow=true; deck.add(m); const u=m.clone(); u.position.y=BT.G-0.22; deck.add(u); return m; };
    ring(BT.glassR, BT.deckR); ring(0.9, BT.glassR, A1+0.25, TAU-2.25);   // the lamp room floor, with the hatch the stair comes up through (from a1-2.0 round to a1+0.25)
    mk(G.cyl(0.9,0.9,0.22,20), mat.deck, 0,BT.G-0.11,0,deck);
    mk(new THREE.CylinderGeometry(BT.deckR,BT.deckR,0.22,48,1,true), mat.deck, 0,BT.G-0.11,0,deck);
    for (let i=0;i<16;i++){ const a=i/16*TAU, b=mk(G.box(0.14,0.6,1.15), mat.iron, Math.sin(a)*(BT.rTop+0.55),BT.G-0.55,Math.cos(a)*(BT.rTop+0.55),deck); b.rotation.set(-0.55, a, 0, 'YXZ'); b.userData.a=a; brackets.push(b); }
    const gapW=0.5, inGap = a => Math.abs(angD(a, GAP_A))<gapW/2;
    for (let i=0;i<40;i++){ const a=i/40*TAU, p=flat(mk(G.box(0.06,1.0,0.06), mat.rail, Math.sin(a)*BT.railR,BT.G+0.5,Math.cos(a)*BT.railR,deck)); if (inGap(a)) stg(p,2); }
    for (const y of [1.0,0.55]){ const full=flat(mk(G.tor(BT.railR,0.035,6,72), mat.rail, 0,BT.G+y,0,deck)); full.rotation.x=Math.PI/2; stg(full,2);
      const hold=new THREE.Group(); hold.rotation.y=GAP_A-Math.PI/2-gapW/2; hold.position.y=BT.G+y; stg(hold,0,1); deck.add(hold); flat(mk(G.tor(BT.railR,0.035,6,72,TAU-gapW), mat.rail, 0,0,0,hold)).rotation.x=Math.PI/2; }
    // where the rail fell: a bent piece hanging off the edge (a rope across it at stage 1)
    const fall=new THREE.Group(); fall.position.copy(pol(GAP_A, BT.railR, BT.G)); fall.rotation.y=GAP_A; stg(fall,0,1); deck.add(fall);
    const bent=flat(mk(G.box(1.6,0.06,0.06), mat.rail, 0,-0.4,0.25,fall)); bent.rotation.set(0.3,0,0.6); flat(mk(G.box(0.06,0.9,0.06), mat.rail, 0.5,-0.35,0.35,fall)).rotation.x=0.9;
    const rope=stg(flat(mk(G.box(gapW*BT.railR+0.2, 0.04, 0.04), k.rope, 0,0.95,0,fall)),1,1); rope.rotation.z=0.05;
    // puddles and rust on the deck; a gull and its nest at the foot of the lamp room
    for (let i=0;i<4;i++){ const p=flat(mk(G.cyl(0.4+r()*0.3,0.4+r()*0.3,0.01,12), k.water, 0,0,0,sg(deck,0,1))); p.position.copy(pol(r()*TAU, BT.walkR+(r()-0.5)*0.4, BT.G+0.012)); }
    const gull=buildGull(); gull.position.copy(pol(GULL_A, BT.railR, BT.G+1.04)); gull.rotation.y=GULL_A+Math.PI/2; stg(gull,0,1); deck.add(gull);
    nest(stg(new THREE.Group(),0,3), ...pol(GULL_A+0.25, BT.glassR+0.3, BT.G).toArray(), 1.3); deck.add(ST[ST.length-1][0]);   // Wick leaves the gulls their nest
    // Wick's telescope once it's lit; before that, the old one knocked flat by the wind
    const sc=new THREE.Group(); sc.position.copy(pol(SCOPE_A, 3.98, BT.G)); sc.rotation.y=SCOPE_A; deck.add(sc);
    const up=stg(new THREE.Group(),3); sc.add(up); for (let j=0;j<3;j++){ const b=j/3*TAU, l=mk(G.cyl(0.02,0.02,1.2,4), k.wood, -Math.sin(b)*0.166,0.56,-Math.cos(b)*0.166,up); l.rotation.set(0.28,b,0,'YXZ'); }
    mk(G.cyl(0.07,0.09,0.8,10), k.brass, 0,1.18,0.1,up).rotation.x=Math.PI/2-0.25;
    const down=stg(new THREE.Group(),0,2); sc.add(down); for (let j=0;j<3;j++) flat(mk(G.cyl(0.02,0.02,1.2,4), mat.iron, (j-1)*0.12,0.03,0,down)).rotation.x=Math.PI/2; flat(mk(G.cyl(0.07,0.09,0.8,10), mat.iron, 0.3,0.08,0.2,down)).rotation.z=Math.PI/2; }

  /* -- the lamp room: iron parapet, glass (cracked and partly boarded until stage 2), a domed roof -- */
  const lampRoom=new THREE.Group(); g.add(lampRoom); const gap=LR_GAP, gH=2.0;
  mk(new THREE.CylinderGeometry(BT.glassR,BT.glassR,0.55,40,1,true,A1+gap,TAU-gap*2), mat.iron, 0,BT.G+0.27,0,lampRoom).material.side=THREE.DoubleSide;
  for (const [m,lo,hi] of [[glassOld,0,1],[glassNew,2,3]]){ const gl=new THREE.Mesh(new THREE.CylinderGeometry(BT.glassR,BT.glassR,gH,40,1,true,A1+gap,TAU-gap*2), m); gl.position.y=BT.G+0.55+gH/2; gl.renderOrder=2; stg(gl,lo,hi); lampRoom.add(gl); }
  for (let i=0;i<12;i++){ const a=A1+gap+i/11*(TAU-gap*2); mk(G.box(0.08,gH+0.55,0.08), mat.iron, Math.sin(a)*BT.glassR,BT.G+(gH+0.55)/2,Math.cos(a)*BT.glassR,lampRoom).castShadow=false;
    if (i<11){ const ma=a+(TAU-gap*2)/22, pane=new THREE.Group(); pane.position.copy(pol(ma, BT.glassR+0.02, BT.G+0.55+gH/2)); pane.rotation.y=ma; lampRoom.add(pane);
      if (i===2 || i===7){ const b=sg(pane,0,1); for (const yy of [0.5,0,-0.5]) flat(mk(G.box(1.25,0.2,0.05), k.oldwood, 0,yy,0.03,b)).rotation.z=(r()-0.5)*0.3; }   // boarded over
      else { const c=sg(pane,0,1); for (let j=0;j<3;j++){ const cr=flat(mk(G.box(0.02,0.5+r()*0.9,0.01), k.dark, (r()-0.5)*0.9,(r()-0.5)*1.0,0.02,c)); cr.rotation.z=(r()-0.5)*1.4; } } } }
  { const t=mk(G.tor(BT.glassR,0.06,6,48), mat.iron, 0,BT.G+gH+0.55,0,lampRoom); t.rotation.x=Math.PI/2; }
  mk(G.cone(BT.glassR+0.45,1.5,32), mat.roof, 0,BT.G+gH+0.55+0.75,0,lampRoom); mk(G.cyl(0.22,0.3,0.4,10), mat.iron, 0,BT.G+gH+1.95,0,lampRoom); mk(G.sph(0.26,10,8), mat.iron, 0,BT.G+gH+2.3,0,lampRoom);
  { const v=new THREE.Group(); v.position.y=BT.G+gH+2.55; v.rotation.y=0.8; lampRoom.add(v); mk(G.cyl(0.025,0.025,0.8,4), mat.iron, 0,0.3,0,v); mk(G.box(0.06,0.14,0.9), mat.iron, 0,0.55,0,v).rotation.x=0.25; }   // a weathervane, stuck
  // a rust stain running down the roof until it's painted
  for (let i=0;i<5;i++){ const a=r()*TAU, s=flat(mk(G.box(0.18,1.2,0.02), k.rust, 0,0,0,sg(lampRoom,0,2))); s.position.copy(pol(a, BT.glassR*0.8+0.2, BT.G+gH+1.0)); s.rotation.set(-0.95, a, 0, 'YXZ'); }
  // the pedestal in the middle; at stage 0 the old lamp lies in pieces round it, at 1 and 2 the new lens waits in its crate
  mk(G.cyl(0.45,0.58,0.6,14), mat.pedestal, 0,BT.G+0.3,0,lampRoom);
  { const bits=sg(lampRoom,0,0); for (let j=0;j<4;j++){ const b=flat(mk(G.tor(0.42-j*0.05,0.04,5,14,Math.PI*(0.6+r()*0.6)), mat.pedestal, 0,0,0,bits)); b.position.copy(pol(r()*TAU, 0.9+r()*0.6, BT.G+0.05)); b.rotation.set(Math.PI/2+(r()-0.5)*0.4, r()*3, 0); }
    for (let j=0;j<10;j++){ const sh=flat(mk(G.box(0.1+r()*0.15,0.01,0.08+r()*0.1), glassOld, 0,0,0,bits)); sh.position.copy(pol(r()*TAU, 0.7+r()*1.4, BT.G+0.01)); sh.rotation.y=r()*3; }
    nest(bits, ...pol(A1+Math.PI, 1.5, BT.G).toArray(), 1.4); }
  const crate=stg(new THREE.Group(),1,2); crate.position.copy(pol(A1+Math.PI*0.75, 1.55, BT.G)); crate.rotation.y=0.5; lampRoom.add(crate);
  { flat(mk(G.box(0.95,0.75,0.95), k.wood, 0,0.38,0,crate)); const cl=flat(mk(G.sph(0.62,8,6), k.cloth, 0,0.85,0,crate)); cl.scale.set(1,0.45,1); for (let j=0;j<3;j++) flat(mk(G.tor(0.6,0.02,4,16), k.rope, 0,0.5+j*0.1,0,crate)).rotation.x=Math.PI/2; }
  { const chalk=sg(lampRoom,2,2); flat(mk(G.tor(0.95,0.015,3,40), k.chalk, 0,BT.G+0.01,0,chalk)).rotation.x=Math.PI/2; for (let j=0;j<8;j++){ const a=j/8*TAU, t=flat(mk(G.box(0.02,0.01,0.25), k.chalk, 0,0,0,chalk)); t.position.copy(pol(a,0.95,BT.G+0.012)); t.rotation.y=a; }
    const ruler=flat(mk(G.box(0.9,0.02,0.05), k.rug2, 0,0,0,chalk)); ruler.position.copy(pol(A1+Math.PI*0.4, 1.4, BT.G+0.012)); }
  // the keeper's corner once it's lit: a desk with a kettle
  { const a=A1+Math.PI+0.5, d=new THREE.Group(); d.position.copy(pol(a, 1.85, BT.G)); d.rotation.y=a+Math.PI; stg(d,3); lampRoom.add(d);
    flat(mk(G.box(0.8,0.06,0.4), k.wood, 0,0.72,0,d)); for (const x of [-0.34,0.34]) flat(mk(G.box(0.05,0.72,0.34), k.wood, x,0.36,0,d)); flat(mk(G.cyl(0.09,0.11,0.16,10), k.green, 0.2,0.83,0,d)); flat(mk(G.box(0.3,0.05,0.22), k.rug, -0.15,0.78,0,d)); }
  // the lamp itself, turning (with its beam after dark) once it's lit. main.js turns userData.beam and fades beamMat with the night.
  const beam=new THREE.Group(); beam.position.y=BT.G+1.35; lampRoom.add(beam);
  const lensM=glowMat(0xfff0b0); mk(G.cyl(0.55,0.55,1.25,14), lensM, 0,0,0,beam).castShadow=false;
  for (let j=0;j<6;j++){ const t=mk(G.tor(0.6-Math.abs(j-2.5)*0.05,0.045,6,22), k.brass, 0,-0.55+j*0.22,0,beam); t.rotation.x=Math.PI/2; t.castShadow=false; }
  for (let j=0;j<4;j++){ const a=j/4*TAU, b=mk(G.cyl(0.24,0.24,0.04,16), glowMat(0xffffff), Math.sin(a)*0.6,0,Math.cos(a)*0.6,beam); b.rotation.set(Math.PI/2,a,0,'YXZ'); b.castShadow=false; }
  const halo=addGlow(beam, 0, 9, 0xfff0b0);
  const beamMat=new THREE.MeshBasicMaterial({ color:0xfff4c8, transparent:true, opacity:0, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending });
  for (const s of [1,-1]){ const c=new THREE.Mesh(new THREE.ConeGeometry(4,60,16,1,true), beamMat); c.rotation.x=s*Math.PI/2; c.position.z=s*30.6; beam.add(c); }

  // merge each stage group's bits into a few meshes (they never move); the treads, rail runs and beam stay separate
  for (const s of SG) mergeStatic(s);
  for (const s of segs) mergeStatic(s, s.children.filter(c=>!c.isMesh));   // each wedge's own bands and plaster: three meshes, not seven

  /* -- the stage switch -- */
  let stage=-1, lensUp=false;
  function T_set(list, n){ for (const T of list){ const i=T.i, gone=n===0 && MISSING.has(i), snapped=n<=1 && BROKEN.has(i), mended=(n===1 && MISSING.has(i)) || (n===2 && (MISSING.has(i)||BROKEN.has(i)));
      T.m.visible=!gone; if (T.stub) T.stub.visible=gone;
      const w = snapped ? 0.62 : BT.tread; T.m.scale.set(T.depth, 0.12, w); T.m.position.set(0, -0.06, T.rr-w/2-0.01); T.m.rotation.x = snapped ? -0.1 : 0;
      T.m.material = n===3 ? mat.tread : mended ? k.fresh : k.oldwood; } }
  function setStage(n, o={}){
    n=clamp(n|0,0,3); const lens = o.lens===undefined ? n>=1 : !!o.lens;
    if (n===stage && lens===lensUp) return; stage=n; lensUp=lens;
    for (const [obj,lo,hi] of ST) obj.visible = n>=lo && n<=hi;
    crate.visible = lens && n>=1 && n<=2;
    for (const key in C) if (mat[key]) mat[key].color.setHex(C[key][n]);
    T_set(treads, n);
    const lit=n===3; beam.visible=lit; halo.visible=lit; lensM.emissiveIntensity=lit?0.9:0.2;
    g.userData.stage=n; g.userData.lit=lit;
    g.userData.desc = [
      'The old lighthouse on the bluff, much bigger up close. The paint is peeling, the windows are boarded and the lamp room glass is cracked. The door hangs off one hinge.',
      'The old lighthouse on the bluff. The paint is still peeling, but somebody has been up there lately: there are fresh planks on the stair.',
      'The old lighthouse on the bluff. Workshop folk have been in and out all week: new glass up top, new treads all the way up. It still wants its lamp.',
      'The lighthouse on Lantern Bluff, fresh red and white paint, the lamp turning slow and steady.' ][n];
  }
  setStage(0);
  g.userData = Object.assign(g.userData, { skyMat:k.sky, roofM:mat.roof, segs, brackets, treads, railRuns, beam, beamMat, ladder, beamGroup:beam, setStage, get stage(){ return stage; },
    setLit:on=>{ if (on) setStage(3); else if (stage===3) setStage(2); },
    rects:[[-BT.foot,-BT.foot,BT.foot,BT.foot]], foot:BT.foot, beamSE:[beamS, beamE] });
  return g;
}

/* The tower as seen from the main island before the bluff isle is loaded: a few cheap meshes. */
export function buildBluffLod(){
  const g=new THREE.Group(), red=new THREE.MeshLambertMaterial({ color:0xb06a5e }), white=new THREE.MeshLambertMaterial({ color:0xd8d0bc }), dark=new THREE.MeshLambertMaterial({ color:0x3a3a44 });
  const bandH=(BT.top-BT.base)/6; for (let b=0;b<6;b++){ const y0=BT.base+b*bandH; const m=new THREE.Mesh(new THREE.CylinderGeometry(rOut(y0+bandH), rOut(y0), bandH, 10), b%2?white:red); m.position.y=y0+bandH/2; g.add(m); }
  const base=new THREE.Mesh(new THREE.CylinderGeometry(BT.foot, BT.foot+0.3, 2.2, 12), new THREE.MeshLambertMaterial({ color:0xa8a094 })); base.position.y=BT.base-1.1; g.add(base);
  const deck=new THREE.Mesh(new THREE.CylinderGeometry(BT.deckR, BT.deckR, 0.25, 14), dark); deck.position.y=BT.G-0.12; g.add(deck);
  const off=new THREE.MeshLambertMaterial({ color:0x5a6670 }), on=glowMat(0xfff0c0), lamp=new THREE.Mesh(new THREE.CylinderGeometry(BT.glassR, BT.glassR, 2.55, 12), off); lamp.position.y=BT.G+1.27; g.add(lamp);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(BT.glassR+0.45, 1.5, 12), new THREE.MeshLambertMaterial({ color:0x9a5a4a })); roof.position.y=BT.G+3.3; g.add(roof);
  const halo=addGlow(g, BT.G+1.3, 10, 0xfff0c0); halo.visible=false;
  g.traverse(o=>{ if (o.isMesh){ o.castShadow=false; o.receiveShadow=false; } });
  g.userData.setLit = lit => { lamp.material = lit ? on : off; halo.visible=!!lit; red.color.setHex(lit?0xd8483a:0xb06a5e); white.color.setHex(lit?0xf4f0e6:0xd8d0bc); roof.material.color.setHex(lit?0xc8503d:0x9a5a4a); };
  return g;
}

/* The old keeper's logbook: three pages on the floor, and the whole book (with Wick's line at the end) once it's lit. */
export const BLUFF_PAGES = [
  ['A logbook page, damp at the edges.', '"Wind from the north-east all night. The lamp held. Three boats came in safe before morning. Tea, then sleep."'],
  ['Another page, half under the beam.', '"The gulls are on the third window again. I haven\'t the heart to move them. They were here first, I expect."'],
  ['The last page, in a shakier hand.', '"Burned the last moonpearls tonight. Three at a time, the way it was always done. The bluff is going down, they say, and the sea with it.', 'If anyone ever reads this up here: the lamp wants a new lens and a new frame. Light it for me."'],
];

/* ---------- the controller ----------
   ctx (from main.js): the same things lighthouse.js's controller takes, plus
     baseY      height of the tower's base (the knoll top)
     stage()    -> { n, lens }: which repair stage to show, polled while the isle is loaded
     lampAct()  what Look / Fit the lamp does up top
     ray()      the raycaster main.js last pointed at the screen (its tap) */
export function makeBluffLighthouse(ctx){
  const { tower, cx, cz, rot } = ctx, baseY=tower.position.y, U=tower.userData;
  const cs=Math.cos(rot), sn=Math.sin(rot);
  const W = a => a+rot;
  const toW = (lx, ly, lz) => new THREE.Vector3(cx+lx*cs+lz*sn, baseY+ly, cz-lx*sn+lz*cs);
  const at = (a, rr, h) => toW(Math.sin(a)*rr, h, Math.cos(a)*rr);
  const toL = (wx, wz) => { const dx=wx-cx, dz=wz-cz; return [dx*cs-dz*sn, dx*sn+dz*cs]; };
  const Gy=baseY+BT.G, Fy=baseY+BT.base;
  const st = { mode:'off', t:0, look:new THREE.Vector3(), camP:new THREE.Vector3(), camSnap:false, seen:0, s:0, r:0, a:A1, dir:1 };
  const kit=perchKit(ctx, { fog:[46, 170] }), P=kit.P, { hud, walkAnim, still } = kit;
  let stageN=0, stageT=0;
  const cur = () => stageN;
  const refreshStage = () => { const s=ctx.stage(); stageN=s.n; U.setStage(s.n, { lens:s.lens }); };
  refreshStage();

  // ---- things to use ----
  const thing = (kind, lp, h, label, act, reach=1.3) => { const p=toW(lp[0], h, lp[1]); const e=new ctx.Thing(kind, p.x, p.z, 0.3, new THREE.Group(), label, act, { solid:false, reach }); e.pos.y=baseY+h; e.obj.position.y=baseY+h; return e; };
  const lpol = (a, r) => [Math.sin(a)*r, Math.cos(a)*r];
  // the way in is the landmark itself (main.js gives it 'Go in'), so a tap anywhere on the tower works
  const exitE = thing('blhexit', lpol(0, BT.floorR-0.1), BT.base, ()=>st.mode==='floor' ? 'Go outside' : null, ()=>{ if (st.mode==='floor') leave(); });
  const footA = BT.a0-0.28, footR = rIn(BT.base)-BT.pathIn;
  const foot = thing('blhstair', lpol(footA, footR), BT.base, ()=>st.mode==='floor' ? 'Up the stair' : null, ()=>{ if (st.mode==='floor') climb(); }, 1.4);
  const pages = BLUFF_PAGES.map((pg, i)=>{ const [a,d]=[[-0.55,2.15],[-2.6,1.55],[3.3,1.25]][i];
    return thing('blhpage'+i, lpol(a,d), BT.base, ()=>st.mode==='floor' && cur()<3 ? 'Read' : null, ()=>ctx.dialog('Lantern Bluff', 420, pg)); });
  const book = thing('blhbook', lpol(-1.3, 2.75), BT.base, ()=>st.mode==='floor' && cur()===3 ? 'Read the logbook' : null,
    ()=>ctx.dialog('The keeper\'s logbook', 420, ['The old keeper\'s pages, dried out and bound back in.', ...BLUFF_PAGES.map(p=>p[p.length-1]), 'And a new line at the end, in Skipper Wick\'s handwriting: "Lit again. Mind the gulls on the third window."']), 1.5);
  const floorThings = [exitE, foot, ...pages, book];
  const hp=at(A1-0.7, 1.75, BT.G);
  const hatch=new ctx.Thing('blhdown', hp.x, hp.z, 0.3, new THREE.Group(), ()=>st.mode==='top'?'Head down':null, ()=>{ if (st.mode==='top') goDown(); }, { solid:false, reach:5.6 });
  hatch.pos.y=Gy; hatch.obj.position.y=Gy;
  const lp=at(A1-0.7+Math.PI, 1.2, BT.G);
  const lampE=new ctx.Thing('blhlamp', lp.x, lp.z, 0.3, new THREE.Group(), ()=>st.mode==='top' ? (cur()===3 ? 'Look at the lamp' : 'Look round the lamp room') : null, ()=>{ if (st.mode==='top'){ st.lampLook=true; st.lampDlg=false; st.lampT=0; st.lampA=lampAngle(W(st.a)); st.camP.copy(ctx.camera.position); ctx.stopMove(); ctx.updateSky(); ctx.lampAct(); } }, { solid:false, reach:5.6 });
  lampE.pos.y=Gy; lampE.obj.position.y=Gy;

  // ---- the ground floor: what you can't walk through ----
  // circles [local x, local z, radius]; the fallen beam (stages 0 and 1) is a line of them along the part that's below head height
  function obstacles(){ const n=cur(), L=[];
    const c=(a,d,rr)=>{ const [x,z]=lpol(a,d); L.push([x,z,rr]); };
    if (n<=1){ const [S,E]=U.beamSE; for (let f=0;f<=1.0001;f+=0.125){ const y=lerp(S.y,E.y,f)-BT.base; if (y>1.7) break; L.push([lerp(S.x,E.x,f), lerp(S.z,E.z,f), 0.4]); } c(-2.95,2.9,0.6); c(-0.75,3.05,0.6); }
    else { c(-2.95,2.9,0.65); c(-0.75,3.05,0.45); }
    if (n===2){ c(-2.0,2.4,0.7); c(-2.75,1.7,0.75); c(-1.0, rIn(2)-0.5, 0.45); }
    if (n===3){ c(-1.3,3.15,0.7); c(-3.45,2.2,0.35); }
    return L; }
  function freeAt(lx, lz){ const d=Math.hypot(lx,lz), a=Math.atan2(lx,lz);
    if (d>BT.floorR) return false;
    const da=wrap(a-BT.a0+0.15); if (da<STAIR_LOW+0.15 && d>rIn(BT.base)-BT.tread-0.3) return false;   // under the low end of the stair
    for (const [x,z,rr] of obstacles()) if (Math.hypot(lx-x, lz-z)<rr+0.3) return false;
    return true; }
  // move by (dx,dz) in local terms, sliding along whatever is in the way
  function slide(lx, lz, dx, dz){ if (!freeAt(lx, lz)){ const nx=lx+dx, nz=lz+dz, d=Math.hypot(nx,nz), k=d>BT.floorR ? BT.floorR/d : 1; return [nx*k, nz*k]; }   // something turned up where you stand: walk out of it
    if (freeAt(lx+dx, lz+dz)) return [lx+dx, lz+dz]; if (freeAt(lx+dx, lz)) return [lx+dx, lz]; if (freeAt(lx, lz+dz)) return [lx, lz+dz]; return [lx, lz]; }

  // ---- getting in and out ----
  const IN_T=1.3;
  const startCam = () => { st.camP.copy(ctx.camera.position); st.look.copy(P.pos); st.look.y+=0.9; st.camSnap=false; };
  function enter(){ if (st.mode!=='off' || ctx.busy()) return; ctx.prep(); ctx.stopMove(); hud('top'); ctx.setPerch(perch);
    const [px,pz]=toL(P.pos.x,P.pos.z);
    if (Math.abs(Math.atan2(px,pz))>0.5){ st.mode='fading'; ctx.fade(()=>{ const p=at(0, BT.foot+1.0, 0); p.y=ctx.groundY(p.x,p.z); P.pos.copy(p); P.obj.position.copy(p); st.camSnap=true; goIn(); }); return; }   // round the back: come in by the door
    startCam(); goIn(); }
  function goIn(){ ctx.Snd.door();
    st.mode='in'; st.t=0; st.from=P.pos.clone(); refreshStage();
    if (!st.seen){ st.seen=1; const n=cur(); setTimeout(()=>{ if (st.mode==='floor' || st.mode==='in') ctx.toast(['Nobody has been in here for years.','Fresh sawdust on the floor. Someone has been at the stair.','It smells of new wood and paint.','Warm, dry and freshly painted.'][n]); }, 900); } }
  function leave(){ st.mode='leaving'; st.t=0; ctx.stopMove(); ctx.Snd.door(); }
  function outside(){ st.mode='off'; P.obj.visible=true; cutaway(false); fadeTo(U.roofM, false, 1); hud(false); ctx.setPerch(null); ctx.setCamYaw(0);
    const p=at(0, BT.foot+1.2, 0); p.y=ctx.groundY(p.x,p.z); P.pos.copy(p); P.obj.position.copy(p); P.face=W(0); P.obj.rotation.y=P.face;
    ctx.camTarget.copy(P.pos); ctx.updateSky(); ctx.updateCamera(1); }
  // #dev: straight onto the ground floor (or up top), from wherever you are on the isle
  function jumpIn(top){ if (st.mode!=='off' || ctx.busy()) return false; ctx.prep(); ctx.stopMove(); ctx.setPerch(perch); refreshStage(); st.seen=1; st.camSnap=true;
    if (top){ onDeck(A1, BT.walkR); pose(A1, BT.walkR, BT.G, W(A1)); arrive(); return true; }
    toFloor(0.2, 2.3, Math.PI); return true; }
  function toFloor(a, d, face){ st.mode='floor'; st.t=0; hud('top'); ctx.updateSky(); P.obj.visible=true; const [lx,lz]=lpol(a,d); st.lx=lx; st.lz=lz; const p=toW(lx, BT.base, lz); P.pos.copy(p); P.obj.position.copy(p); P.face=W(face); P.obj.rotation.y=P.face; }

  // ---- the stair: you walk it yourself, stepping round what's broken ----
  const OUT_T = 1.1;
  let noteI=0, hopped=false;
  const NOTES = [
    [[0.18,'Half the treads up here are rotten. You keep close to the wall.'],[0.45,'Cobwebs across the stair. Nobody has been up in years.'],[0.62,'Gulls have been nesting on the window sills.'],[0.85,'Nearly there. Mind the rail, there isn\'t much of it.']],
    [[0.18,'Somebody has nailed fresh planks over the worst of the gaps.'],[0.45,'Still some snapped treads. You keep close to the wall.'],[0.8,'A rope has been tied across where the rail is missing.']],
    [[0.2,'New treads all the way up, still smelling of sawdust.'],[0.5,'The boards are off the windows. You can see the sea from the stair.'],[0.85,'A new rail, painted black. Nearly there.']],
    [[0.2,'Fresh paint, a polished brass rail and lamps on the walls.'],[0.55,'The windows have been cleaned. The view gets better every turn.'],[0.85,'Your legs are burning a bit. Nearly there.']] ];
  // the tap on 'Up the stair' (or the action button there): a step or two across to the bottom tread
  function climb(){ st.mode='climbin'; st.t=0; ctx.stopMove(); st.cf=P.pos.clone(); }
  // where you are on the stair at s treads up (0 at the foot, steps at the top): the hop over a missing tread is in h
  function stairAt(s){ const n=cur(), a=BT.a0+s*BT.dA; let h=BT.base+clamp(s+0.5, 0, BT.steps)*BT.rise, rr=rIn(h)-BT.pathIn;
    if (n<=1){ let w=0; for (const i of BROKEN){ const q=1-Math.abs(s-(i+0.5))/1.1; if (q>w) w=q; } rr += smooth(0,1,w)*(BT.pathIn-0.36); }
    if (n===0){ for (const i of MISSING){ const u=(s-(i-0.5))/2; if (u>0 && u<1) h += Math.sin(u*Math.PI)*0.42; } }
    return { a, h, rr }; }
  // how far across the tread you can stand: a snapped tread only leaves the bit by the wall
  function band(s){ const n=cur(), h=BT.base+clamp(s+0.5, 0, BT.steps)*BT.rise, hi=rIn(h)-0.32; let lo=rIn(h)-BT.tread+0.3;
    if (n<=1){ let w=0; for (const i of BROKEN){ const q=1-Math.abs(s-(i+0.5))/1.1; if (q>w) w=q; } lo=lerp(lo, rIn(h)-0.6, smooth(0,1,w)); }
    return [lo, hi]; }
  const STAIR = { cx, cz, rot, baseY, steps:BT.steps, dA:BT.dA, speed:3.2, at:s=>stairAt(s), band };
  // the gallery: the fallen bit of rail (until it's patched) and Wick's telescope are in the way, the lamp room door takes you back in
  const DECK = { cx, cz, rot, Gy, rMin:BT.glassR+0.35, rMax:BT.railR-0.3, door:{ a:A1, half:LR_GAP-0.08 }, speed:3.0, wedges:()=>[],
    circles:()=>{ const n=cur(), L=[]; if (n<=1) L.push([GAP_A, BT.railR-0.1, 0.75]); if (n===3) L.push([SCOPE_A, 3.98, 0.42]); return L; } };
  function onStair(s, r, dir){ st.mode='stair'; st.t=0; st.s=s; st.r=r; st.dir=dir; st.goS=null; st.stepI=undefined; hud('top'); }
  function onDeck(a, r){ st.mode='top'; st.t=0; st.a=a; st.r=r; st.lampLook=false; hud('top'); cutaway(false); P.obj.visible=true; }
  function goDown(){ st.mode='down'; ctx.stopMove(); ctx.Snd.door();
    ctx.fade(()=>{ cutaway(false); fadeTo(U.roofM, false, 1); toFloor(footA-0.1, footR-0.5, W(footA)+Math.PI); st.camSnap=true; }); }
  function arrive(){ ctx.toast('The top of the Lantern Bluff lighthouse', null, '', 'Walk round the gallery. Go back in at the lamp room door to walk down.');
    const n=cur(); setTimeout(()=>{ if (st.mode==='top') ctx.toast(['An empty lamp room, cracked glass and a gull\'s nest. It wants a whole new lamp.','Marlo\'s new lens is up here in its crate, waiting for a frame.','New glass all round. The lamp room just needs its lamp now.','The lamp turns slow and steady.'][n]); }, 2600); }

  // ---- the cut-away: the wall, the treads and the struts between you and the camera ----
  function cutaway(on, camW, py){ const local = camW!==undefined ? camW-rot : 0, ly=(py??baseY)-baseY;
    U.segs.forEach((sg,i)=>{ sg.visible = !on || Math.abs(angD(segMid(i), local))>1.15; });
    U.brackets.forEach(b=>{ b.visible = !on || Math.abs(angD(b.userData.a, local))>1.0; });
    const shut = st.mode==='off', lo = BT.base+3.5;   // from outside only the bottom of the stair shows, through the door: skip drawing the rest
    for (const T of U.treads) T.g.visible = shut ? T.y<lo : (!on || !(Math.abs(angD(T.a, local))<1.4 && T.y>ly+0.35));
    for (const R of U.railRuns) R.g.visible = shut ? R.y<lo : (!on || !(Math.abs(angD(R.a, local))<1.4 && R.y>ly-0.6));
    if (U.ladder) U.ladder.visible = cur()===2 && (!on || Math.abs(angD(-1.0, local))>1.1); }
  const camAng = () => Math.atan2(ctx.camera.position.x-cx, ctx.camera.position.z-cz);

  // ---- hooks main.js calls ----
  const pose = (a, rr, h, face) => { const p=at(a, rr, h); P.pos.copy(p); P.obj.position.copy(p); if (face!==undefined){ P.face=face; P.obj.rotation.y=face; } };
  const turnTo = (face, dt) => { let df=face-P.obj.rotation.y; df=Math.atan2(Math.sin(df),Math.cos(df)); P.obj.rotation.y+=df*Math.min(1,dt*12); P.face=P.obj.rotation.y; };
  // the stick or keys as a world direction, turned by the camera the way main.js does it outdoors
  const stick = () => { let [ix,iz]=ctx.input(); if (ctx.dialogOpen() || (!ix && !iz)) return null; const Y=ctx.getCamYaw(), m=Math.min(1,Math.hypot(ix,iz)), L=Math.hypot(ix,iz)||1;
    return [(ix*Math.cos(Y)+iz*Math.sin(Y))/L*m, (-ix*Math.sin(Y)+iz*Math.cos(Y))/L*m]; };
  // walking into the bottom of the stair from the floor puts you on it
  const intoStair = (lx, lz) => { const d=Math.hypot(lx,lz), da=wrap(Math.atan2(lx,lz)-BT.a0+0.15); return da<0.6 && d>rIn(BT.base)-BT.tread-0.3; };
  const perch = {
    get mode(){ return st.mode; },
    move(dt, t){
      st.t+=dt;
      if ((stageT-=dt)<0){ stageT=0.5; refreshStage(); }
      if (st.mode==='in'){ // up the steps and in through the doorway
        const k=smooth(0,1,st.t/IN_T), to=at(0.15, 2.4, BT.base); P.pos.lerpVectors(st.from, to, k); P.pos.y=lerp(st.from.y, to.y, smooth(0,0.6,k)); P.obj.position.copy(P.pos);
        P.face=W(0)+Math.PI; P.obj.rotation.y=P.face; walkAnim(t, 0.8);
        if (st.t>=IN_T){ const [lx,lz]=toL(P.pos.x,P.pos.z); st.mode='floor'; st.lx=lx; st.lz=lz; hud('top'); ctx.updateSky(); }
        return true; }
      if (st.mode==='leaving'){ const k=clamp(st.t/0.9,0,1), [lx,lz]=[st.lx,st.lz], tx=0, tz=BT.foot+1.2, x=lerp(lx,tx,k), z=lerp(lz,tz,k), p=toW(x, BT.base, z);
        p.y=k<0.55 ? Fy : lerp(Fy, ctx.groundY(p.x,p.z), smooth(0.55,1,k)); P.pos.copy(p); P.obj.position.copy(p); turnTo(W(0), dt); walkAnim(t, 0.8);
        if (k>=1) outside(); return true; }
      if (st.mode==='floor'){
        let mx=0, mz=0;   // the way you want to go this frame, in world terms
        const sd=stick();
        if (sd){ ctx.stopMove(); [mx,mz]=sd; }
        else if (P.target && !ctx.dialogOpen()){ const dx=P.target.x-P.pos.x, dz=P.target.z-P.pos.z, d=Math.hypot(dx,dz), E=P.targetEnt;
          const near = E ? Math.hypot(E.pos.x-P.pos.x, E.pos.z-P.pos.z) <= Math.min(E.reach, 1.2) : d<0.12;
          if (near){ const cb=P.cb; ctx.stopMove(); if (cb) cb(); } else { mx=dx/d; mz=dz/d; } }
        const sp=3.0*dt;
        if (mx||mz){ const [lx,lz]=[st.lx,st.lz], dlx=(mx*cs-mz*sn)*sp, dlz=(mx*sn+mz*cs)*sp;
          if (sd && intoStair(lx+dlx*4, lz+dlz*4)){ const d=Math.hypot(lx,lz); onStair(0.15, clamp(d, ...band(0.15)), 1); return true; }   // walked into the stair: on you go
          const [nx,nz]=slide(lx,lz,dlx,dlz);
          // walking out through the doorway takes you outside
          const d=Math.hypot(lx,lz), oa=Math.atan2(lx,lz); if (Math.abs(oa)<0.32 && d>BT.floorR-0.25 && dlz>0 && Math.hypot(nx,nz)>=d-1e-4){ leave(); return true; }
          const moved=Math.hypot(nx-lx, nz-lz); if (moved<1e-4 && P.target && !sd){ if ((st.stuck=(st.stuck||0)+dt)>0.6){ st.stuck=0; const E=P.targetEnt, cb=P.cb; ctx.stopMove(); if (E && Math.hypot(E.pos.x-P.pos.x,E.pos.z-P.pos.z)<=E.reach+0.4 && cb) cb(); } } else st.stuck=0;
          st.lx=nx; st.lz=nz; turnTo(Math.atan2(mx,mz), dt); walkAnim(t, 0.9*Math.min(1, moved/sp+0.3)); }
        else still();
        const p=toW(st.lx, BT.base, st.lz); P.pos.copy(p); P.obj.position.copy(p);
        return true; }
      if (st.mode==='climbin'){ // across the floor to the bottom tread
        const k=smooth(0,1,st.t/0.6), H=stairAt(0.15), to=at(H.a, footR, H.h); P.pos.lerpVectors(st.cf, to, k); P.obj.position.copy(P.pos); turnTo(W(BT.a0)+Math.PI/2, dt); walkAnim(t, 0.8);
        if (st.t>=0.6) onStair(0.15, footR, 1); return true; }
      if (st.mode==='stair'){
        const r=stairMove(ctx, kit, st, STAIR, dt, t);
        if (r==='top'){ st.mode='out'; st.t=0; st.r0=st.r; return true; }
        if (r==='bottom'){ const d=Math.min(st.r, BT.floorR-0.1); toFloor(BT.a0-0.4, d, W(BT.a0-0.4)-Math.PI/2); return true; }
        if (st.dir>0){ const N=NOTES[cur()], f=st.s/BT.steps; if (noteI<N.length && f>=N[noteI][0]){ ctx.toast(N[noteI][1]); noteI++; } }
        const i=Math.floor(st.s); if (cur()===0 && !hopped && (MISSING.has(i)||MISSING.has(i+1))){ hopped=true; ctx.toast('A tread is gone altogether. You hop the gap.'); }
        return true; }
      if (st.mode==='out'){ // up into the lamp room and out of its door onto the gallery
        const k=smooth(0,1,st.t/OUT_T), rr=lerp(st.r0, BT.walkR, k); pose(BT.a1, rr, BT.G, W(BT.a1)); walkAnim(t, 0.7);
        if (st.t>=OUT_T){ onDeck(A1, BT.walkR); if (!st.upSeen){ st.upSeen=1; arrive(); } } return true; }
      if (st.mode==='backin'){ // in at the lamp room door and onto the top of the stair, facing down
        const k=smooth(0,1,st.t/OUT_T), H=stairAt(BT.steps-0.3), rr=lerp(st.r0, H.rr, k); pose(lerp(st.a0, BT.a1, k), rr, BT.G, W(BT.a1)+Math.PI); walkAnim(t, 0.7);
        if (st.t>=OUT_T) onStair(BT.steps-0.3, H.rr, -1); return true; }
      if (st.mode==='down' || st.mode==='fading'){ still(); return true; }
      if (st.mode==='top'){ if (st.lampLook){ still(); return true; }
        if (deckMove(ctx, kit, st, DECK, dt, t)==='door'){ ctx.stopMove(); st.mode='backin'; st.t=0; st.r0=st.r; st.a0=BT.a1+angD(st.a, A1); }
        return true; }
      return false;
    },
    cam(dt){
      if (st.mode==='off') return false;
      const c=ctx.camera, k=Math.min(1, dt*4);
      if (st.mode==='top' && st.lampLook){   // looking in through the glass at the lamp room while it talks about it (the talk can open a moment after the tap)
        const open=ctx.dialogOpen(); if (open) st.lampDlg=true; st.lampT+=dt;
        if (!open && (st.lampDlg || st.lampT>1.5)){ st.lampLook=false; ctx.updateSky(); }
        else { const a=st.lampA ?? W(st.a), want=new THREE.Vector3(cx+Math.sin(a)*(BT.glassR+0.3), Gy+2.1, cz+Math.cos(a)*(BT.glassR+0.3)), look=new THREE.Vector3(cx, Gy+0.8, cz);
          st.camP.lerp(want, k); st.look.lerp(look, k); c.position.copy(st.camP); c.lookAt(st.look); cutaway(false); fadeTo(U.roofM, false, 1); P.obj.visible=false; kit.farFog(); ctx.skyFollow(P.pos); return true; } }
      P.obj.visible=true;
      const top = st.mode==='top' || st.mode==='down';
      const o = top ? VIEW.top : st.mode==='stair' || st.mode==='out' || st.mode==='backin' ? { ...VIEW.stair, capY:Gy-0.6 } : VIEW.stair;
      followCam(ctx, kit, st, o, dt);
      if (top || st.mode==='out' || st.mode==='backin'){ cutaway(false); fadeTo(U.roofM, behind(P, cx, cz, ctx.getCamYaw()), dt); if (top) kit.farFog(); }
      else { cutaway(true, camAng(), P.pos.y); fadeTo(U.roofM, false, dt); }
      return true;
    },
    tap(p){
      if (ctx.dialogOpen()) return;
      if (st.mode==='top'){ if (st.lampLook) return;
        const R=ctx.ray(); if (R){ for (const [e,y,r2] of [[lampE,1.2,1.1],[hatch,0.1,0.5]]){ const q=e.pos.clone(); q.y+=y; if (R.ray.distanceSqToPoint(q)<r2 && R.ray.origin.distanceTo(q)<18){ P.target=e.pos.clone(); P.targetEnt=e; P.cb=()=>ctx.interact(e); return; } } }
        const pt = p && (p.ground || p.water || p.point); if (pt){ P.target=pt.clone(); P.targetEnt=null; P.cb=null; } return; }
      if (st.mode==='stair'){ const R=ctx.ray(); stairTap(st, STAIR, R && R.ray); return; }
      if (st.mode!=='floor') return;
      // the near wall is only hidden, so main.js's pick would hit it: look along the tap ray ourselves
      const R=ctx.ray(); if (!R) return; let best=null, bd=0.5;
      for (const e of floorThings){ if (!e.label()) continue; const d=R.ray.distanceSqToPoint(e.pos.clone().add(new THREE.Vector3(0,0.3,0))); if (d<bd){ bd=d; best=e; } }
      if (best){ P.target=best.pos.clone(); P.targetEnt=best; P.cb=()=>ctx.interact(best); return; }
      const hit=new THREE.Vector3(); if (R.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), -Fy), hit)){ P.target=hit; P.targetEnt=null; P.cb=null; }
    },
    act(){
      if (st.mode==='top'){ if (st.lampLook) return; const e=ctx.nearestEnt(); if (e){ ctx.stopMove(); ctx.interact(e, 'manual'); } return; }
      if (st.mode!=='floor') return;
      let best=null, bd=1e9; for (const e of floorThings){ if (!e.label()) continue; const d=Math.hypot(e.pos.x-P.pos.x, e.pos.z-P.pos.z); if (d<=e.reach+0.3 && d<bd){ bd=d; best=e; } }
      if (best){ ctx.stopMove(); ctx.interact(best, 'manual'); }
    },
  };
  // the room lamps and glass catch the night; the beam itself is turned by main.js like any landmark's
  const tick = () => {};
  // under the roof: no rain, and enough light to see by at night (cold and grey while it's a ruin, lamp-warm once it's lit)
  // look in through clear glass: before stage 2, step off a boarded pane to the next one along
  function lampAngle(a){ if (cur()>=2) return a; for (const b of BOARD_A){ const bw=b+rot, d=angD(a,bw); if (Math.abs(d)<0.4) return bw+(d>=0?0.55:-0.55); } return a; }
  const ROOFED = new Set(['floor','climbin','stair','out','backin','down','leaving']), _lc = new THREE.Color();
  function indoorLight(hemi, sun, night){ U.skyMat.color.setHex(0xd8ecf4).lerp(_lc.setHex(0x26304a), clamp(night,0,1));   // the doorway and windows seen from inside: day or night out there
    if (!ROOFED.has(st.mode) && !(st.mode==='top' && st.lampLook)) return; const n=cur();
    hemi.intensity = Math.max(hemi.intensity, [0.95,1.05,1.15,1.3][n] - night*0.12);
    hemi.color.lerp(_lc.setHex([0xc4d0dc,0xd4d4cc,0xf0e6d8,0xffe6c4][n]), 0.65); hemi.groundColor.lerp(_lc.setHex(0x5a4a40), 0.5);
    sun.intensity = Math.max(sun.intensity, 0.3); }
  cutaway(false);   // starts outside
  return { perch, hatch, tick, jumpIn, enter, refreshStage, indoorLight, get roofed(){ return ROOFED.has(st.mode); }, get mode(){ return st.mode; }, get stage(){ return stageN; } };
}
