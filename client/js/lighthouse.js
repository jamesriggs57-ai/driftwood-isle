/* =====================================================================
   v1.39 fixes: the lighthouse on Lighthouse Point (a little-town boat trip island).
   You can go in, climb the spiral stair (the near wall cuts away so you can watch), step out of the lamp room onto
   the gallery, take in the view, walk round the rail and meet the keeper up top.

   Everything here is local to the tower. main.js builds it from setupTown() and hands over what it needs in a
   context object (ctx), and calls the controller's hooks while you're inside or up top:
     PERCH.move(dt,t)  instead of the usual walking        PERCH.cam(dt)  instead of the usual camera
     PERCH.tap(pick)   instead of the usual tap handling   PERCH.act()    instead of the usual action button
   Local tower coordinates: angle a points along (sin a, cos a), so a=0 is local +z, the side with the door.
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32 } from './util.js';
import { M, MF, mk, G, windowMat, glowMat, addGlow } from './models.js';

// ---- sizes (metres). Characters stand about 1.7 m tall. ----
export const LT = {
  base:0.5,             // top of the stone plinth: the ground floor inside
  top:13.0,             // top of the shaft
  G:13.1,               // gallery and lamp room floor
  rBot:2.6, rTop:2.05,  // outside radius of the shaft, bottom and top
  wall:0.16,
  deckR:3.15, railR:3.0, walkR:2.35, glassR:1.55, holeR:1.5,
  steps:63, turns:3, a0:0.6, pathR:1.3,
  foot:3.0,             // ground footprint for the town's blocking rects
};
LT.rise = (LT.G-LT.base)/LT.steps;
LT.a1 = LT.a0 + LT.turns*TAU;                              // where the stair comes out, under the lamp room door
const rOut = y => lerp(LT.rBot, LT.rTop, clamp((y-LT.base)/(LT.top-LT.base),0,1));
const rIn = y => rOut(y)-LT.wall;
const SEG = 12;                                            // the shaft is built in 12 wedges so the near side can cut away
const segMid = i => (i+0.5)/SEG*TAU;
const angD = (a,b) => { let d=(a-b)%TAU; if (d>Math.PI) d-=TAU; if (d<-Math.PI) d+=TAU; return d; };
const wrap = a => ((a%TAU)+TAU)%TAU;

/* ---------- the model ---------- */
export function buildTower(seed=1){
  const g=new THREE.Group(), red=M(0xd8483a), white=M(0xf4f0e6), dark=M(0x3a3a44), stone=MF(0xa8a098), wood=M(0x9a6a42), brass=M(0xc8a040,{ metalness:0.5, roughness:0.35 });
  const inner=new THREE.MeshStandardMaterial({ color:0xf2ead8, roughness:0.9, side:THREE.BackSide });
  const r=mulberry32(seed|0);
  // plinth and the front step
  mk(G.cyl(LT.foot,LT.foot+0.15,LT.base,24), stone, 0,LT.base/2,0,g);
  mk(G.box(1.6,0.25,0.7), stone, 0,0.12,LT.foot+0.25,g);
  // shaft wedges: five red and white bands outside, whitewash inside, windows on some
  const segs=[]; const bandH=(LT.top-LT.base)/5;
  for (let i=0;i<SEG;i++){ const sg=new THREE.Group(), t0=i/SEG*TAU, tl=TAU/SEG+0.002; g.add(sg); segs.push(sg);
    for (let b=0;b<5;b++){ const y0=LT.base+b*bandH, y1=y0+bandH;
      const m=mk(new THREE.CylinderGeometry(rOut(y1),rOut(y0),bandH,3,1,true,t0,tl), b%2?white:red, 0,y0+bandH/2,0,sg); m.receiveShadow=false; }
    const w=mk(new THREE.CylinderGeometry(rIn(LT.top),rIn(LT.base),LT.top-LT.base,3,1,true,t0,tl), inner, 0,(LT.top+LT.base)/2,0,sg); w.castShadow=false; w.receiveShadow=false; }
  const segOf = a => Math.floor(wrap(a)/TAU*SEG)%SEG;
  // windows: a narrow pane on the outside and its sill inside, turning up the shaft with the stair
  const WIN=[[2.4,LT.a0+1.6],[4.6,Math.PI],[6.9,LT.a0+1.6+TAU*0.62],[9.2,0.4],[11.4,Math.PI+0.9]];
  for (const [y,a] of WIN){ const sg=segs[segOf(a)];
    const o=new THREE.Group(); o.position.set(Math.sin(a)*(rOut(y)+0.01), y, Math.cos(a)*(rOut(y)+0.01)); o.rotation.y=a; sg.add(o);
    mk(G.box(0.62,1.0,0.08), dark, 0,0,0,o).castShadow=false; mk(G.box(0.46,0.84,0.06), windowMat, 0,0,0.03,o).castShadow=false;
    const ii=new THREE.Group(); ii.position.set(Math.sin(a)*(rIn(y)-0.02), y, Math.cos(a)*(rIn(y)-0.02)); ii.rotation.y=a+Math.PI; sg.add(ii);
    mk(G.box(0.5,0.86,0.04), new THREE.MeshBasicMaterial({ color:0xcfe8f4 }), 0,0,0,ii).castShadow=false; mk(G.box(0.64,0.08,0.22), wood, 0,-0.46,0.08,ii).castShadow=false; }
  // the front door, arched
  { const d=new THREE.Group(); d.position.set(0,LT.base,rOut(LT.base+1)+0.02); segs[segOf(0)].add(d);
    mk(G.box(1.2,2.0,0.1), M(0x6a4a30), 0,1.0,0,d); mk(G.box(0.98,1.84,0.12), M(0x5a3e28), 0,0.94,0.02,d);
    const arch=mk(new THREE.CylinderGeometry(0.6,0.6,0.1,14,1,false,-Math.PI/2,Math.PI), M(0x6a4a30), 0,2.0,0,d); arch.rotation.x=Math.PI/2;
    mk(G.sph(0.06,8,6), brass, 0.32,1.0,0.12,d); }
  // inside: floor, the central post, the stair and its handrail
  const insides=new THREE.Group(); g.add(insides);
  mk(G.cyl(rIn(LT.base)-0.01,rIn(LT.base)-0.01,0.06,24), M(0xb89a78), 0,LT.base+0.03,0,insides).receiveShadow=false;
  mk(G.cyl(0.28,0.3,LT.G-LT.base,12), white, 0,(LT.G+LT.base)/2,0,insides);
  const dA=LT.turns*TAU/LT.steps, treads=[];
  for (let i=0;i<LT.steps;i++){ const a=LT.a0+(i+0.5)*dA, y=LT.base+(i+1)*LT.rise, rr=rIn(y)-0.04;
    const s=mk(new THREE.CylinderGeometry(rr,rr,0.1,4,1,false,a-dA*0.56,dA*1.12), i%2?wood:M(0x8e6240), 0,y-0.05,0,insides); s.receiveShadow=false; treads.push({ m:s, a, y }); }
  { const pts=[]; for (let k=0;k<=96;k++){ const f=k/96, a=LT.a0+f*LT.turns*TAU, y=LT.base+f*(LT.G-LT.base)+0.9; const rr=rIn(y)-0.14; pts.push(new THREE.Vector3(Math.sin(a)*rr, y, Math.cos(a)*rr)); }
    const rail=mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 220, 0.035, 6), brass, 0,0,0,insides); rail.castShadow=false; }
  // little things on the way up: lamps on the wall, a painted fish, a shelf of logbooks, a barometer
  for (const [y,a] of [[2.0,LT.a0+0.9],[5.4,LT.a0+3.2],[8.6,LT.a0+5.4],[11.9,LT.a0+1.2]]){ const p=new THREE.Group(), rr=rIn(y)-0.08; p.position.set(Math.sin(a)*rr,y,Math.cos(a)*rr); p.rotation.y=a+Math.PI; insides.add(p);
    mk(G.box(0.08,0.3,0.12), dark, 0,0,0.02,p); mk(G.box(0.18,0.24,0.18), glowMat(0xffc860), 0,0.05,0.14,p).castShadow=false; addGlow(p, 0.05, 1.6); }
  const onWall=(y,a,build)=>{ const p=new THREE.Group(), rr=rIn(y)-0.05; p.position.set(Math.sin(a)*rr,y,Math.cos(a)*rr); p.rotation.y=a+Math.PI; insides.add(p); build(p); return p; };
  onWall(3.6, LT.a0+4.4, p=>{ const f=mk(G.sph(0.22,10,8), M(0x4a8ad0), 0,0,0.02,p); f.scale.set(1.6,0.8,0.15); mk(G.cone(0.16,0.25,4), M(0x4a8ad0), -0.42,0,0.02,p).rotation.z=Math.PI/2; mk(G.sph(0.035,6,4), dark, 0.2,0.05,0.06,p); });
  onWall(7.4, LT.a0+2.1, p=>{ mk(G.box(0.9,0.06,0.26), wood, 0,0,0.12,p); for (let k=0;k<5;k++) mk(G.box(0.12,0.3+r()*0.08,0.22), M([0x8a3a3a,0x3a5a8a,0x4a7a4a,0x8a6a3a,0x5a3a6a][k]), -0.32+k*0.15,0.18,0.12,p); });
  onWall(10.3, LT.a0+4.8, p=>{ mk(G.cyl(0.2,0.2,0.08,16), brass, 0,0,0.05,p).rotation.x=Math.PI/2; mk(G.cyl(0.16,0.16,0.09,16), M(0xf4efe0), 0,0,0.06,p).rotation.x=Math.PI/2; mk(G.box(0.02,0.13,0.02), dark, 0.03,0.03,0.11,p).rotation.z=-0.6; });
  // the gallery: a deck that overhangs the shaft (with a hole where the stair comes up), brackets, a railing
  const deck=new THREE.Group(), brackets=[]; g.add(deck); const deckM=new THREE.MeshStandardMaterial({ color:0x4a4a54, roughness:0.8, side:THREE.DoubleSide });
  { const ring=new THREE.Mesh(new THREE.RingGeometry(LT.holeR, LT.deckR, 40, 1), deckM); ring.rotation.x=-Math.PI/2; ring.position.y=LT.G; ring.receiveShadow=true; deck.add(ring);
    const under=ring.clone(); under.position.y=LT.G-0.2; deck.add(under);
    mk(new THREE.CylinderGeometry(LT.deckR,LT.deckR,0.2,40,1,true), deckM, 0,LT.G-0.1,0,deck);
    mk(new THREE.CylinderGeometry(LT.holeR,LT.holeR,0.2,20,1,false,LT.a1,TAU-2.2), deckM, 0,LT.G-0.1,0,deck);   // the stairwell opening runs from a1-2.2 round to a1
    for (let i=0;i<12;i++){ const a=i/12*TAU, b=mk(G.box(0.1,0.45,0.85), dark, Math.sin(a)*(LT.rTop+0.42),LT.G-0.42,Math.cos(a)*(LT.rTop+0.42),deck); b.rotation.set(-0.55, a, 0, 'YXZ'); b.userData.a=a; brackets.push(b); }   // struts from the wall up to the deck's edge
    for (let i=0;i<24;i++){ const a=i/24*TAU; mk(G.box(0.05,0.95,0.05), dark, Math.sin(a)*LT.railR,LT.G+0.47,Math.cos(a)*LT.railR,deck).castShadow=false; }
    for (const y of [0.95,0.5]){ const t=mk(G.tor(LT.railR,0.03,6,64), dark, 0,LT.G+y,0,deck); t.rotation.x=Math.PI/2; t.castShadow=false; } }
  // the lamp room: an iron parapet, glass all round with a door gap facing the stair, a domed red roof
  const lamp=new THREE.Group(); g.add(lamp); const gap=0.36;
  const glass=new THREE.MeshStandardMaterial({ color:0xd8f2ff, transparent:true, opacity:0.2, roughness:0.05, metalness:0.1, depthWrite:false, side:THREE.DoubleSide });
  mk(new THREE.CylinderGeometry(LT.glassR,LT.glassR,0.5,32,1,true,LT.a1+gap,TAU-gap*2), new THREE.MeshStandardMaterial({ color:0x3a3a44, roughness:0.7, side:THREE.DoubleSide }), 0,LT.G+0.25,0,lamp);
  const gl=new THREE.Mesh(new THREE.CylinderGeometry(LT.glassR,LT.glassR,1.75,32,1,true,LT.a1+gap,TAU-gap*2), glass); gl.position.y=LT.G+0.5+0.875; gl.renderOrder=2; lamp.add(gl);
  for (let i=0;i<10;i++){ const a=LT.a1+gap+i/9*(TAU-gap*2); mk(G.box(0.07,2.25,0.07), dark, Math.sin(a)*LT.glassR,LT.G+1.12,Math.cos(a)*LT.glassR,lamp).castShadow=false; }
  { const t=mk(G.tor(LT.glassR,0.05,6,40), dark, 0,LT.G+2.25,0,lamp); t.rotation.x=Math.PI/2; }
  const roofM=M(0xd8483a); mk(G.cone(1.9,1.15,24), roofM, 0,LT.G+2.25+0.57,0,lamp); mk(G.cyl(0.18,0.24,0.3,10), dark, 0,LT.G+3.5,0,lamp); mk(G.sph(0.2,10,8), dark, 0,LT.G+3.75,0,lamp);
  { const v=new THREE.Group(); v.position.y=LT.G+4.0; lamp.add(v); mk(G.cyl(0.02,0.02,0.6,4), dark, 0,0.2,0,v); const arrow=mk(G.box(0.05,0.12,0.7), dark, 0,0.42,0,v); arrow.castShadow=false; mk(G.cone(0.1,0.22,4), dark, 0,0.42,0.42,v).rotation.x=Math.PI/2; lamp.userData.vane=v; }
  // the lamp itself: a brass pedestal and a lens of glowing rings that turns
  mk(G.cyl(0.38,0.48,0.5,12), brass, 0,LT.G+0.25,0,lamp);
  const lens=new THREE.Group(); lens.position.y=LT.G+1.15; lamp.add(lens); const lensM=glowMat(0xfff0b0);
  mk(G.cyl(0.42,0.42,1.0,12), lensM, 0,0,0,lens).castShadow=false;
  for (let k=0;k<5;k++){ const t=mk(G.tor(0.47-Math.abs(k-2)*0.05,0.04,6,20), brass, 0,-0.4+k*0.2,0,lens); t.rotation.x=Math.PI/2; t.castShadow=false; }
  for (let k=0;k<4;k++){ const a=k/4*TAU, b=mk(G.cyl(0.2,0.2,0.04,16), glowMat(0xffffff), Math.sin(a)*0.47,0,Math.cos(a)*0.47,lens); b.rotation.set(Math.PI/2,a,0,'YXZ'); b.castShadow=false; }
  addGlow(lens, 0, 7, 0xfff0b0);
  // the beam: two long soft cones, only at night
  const beamM=new THREE.MeshBasicMaterial({ color:0xfff4c0, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
  const beam=new THREE.Group(); lens.add(beam);
  for (const s of [1,-1]){ const c=new THREE.Mesh(new THREE.ConeGeometry(3.2,46,16,1,true), beamM); c.rotation.x=s*Math.PI/2; c.position.z=s*23.4; beam.add(c); }
  // the keeper's corner inside: a little desk with the logbook and a kettle
  { const a=LT.a1+Math.PI, d=new THREE.Group(); d.position.set(Math.sin(a)*1.08,LT.G,Math.cos(a)*1.08); d.rotation.y=a+Math.PI; lamp.add(d);
    mk(G.box(0.7,0.06,0.36), wood, 0,0.7,0,d); for (const x of [-0.3,0.3]) mk(G.box(0.05,0.7,0.3), wood, x,0.35,0,d);
    mk(G.box(0.34,0.05,0.24), M(0x6a2a2a), -0.1,0.76,0,d); mk(G.cyl(0.08,0.1,0.14,10), M(0x5a6a7a), 0.2,0.8,0,d); }
  // the telescope on the gallery, on the sea side
  const scope=new THREE.Group(); { const a=Math.PI+0.55; scope.position.set(Math.sin(a)*2.62,LT.G,Math.cos(a)*2.62); scope.rotation.y=a; deck.add(scope);
    for (let k=0;k<3;k++){ const b=k/3*TAU, l=mk(G.cyl(0.02,0.02,1.2,4), wood, -Math.sin(b)*0.166,0.56,-Math.cos(b)*0.166,scope); l.rotation.set(0.28,b,0,'YXZ'); }
    const tube=mk(G.cyl(0.07,0.09,0.8,10), brass, 0,1.18,0.1,scope); tube.rotation.x=Math.PI/2-0.25; }
  g.userData = { segs, brackets, treads, roofM, lens, beam, beamM, vane:lamp.userData.vane, inside:insides };
  return g;
}

/* Low islands far out on the horizon: you only really see them from the top of the lighthouse (fog hides them below). */
export function buildFarIsles(seed){
  const g=new THREE.Group(), r=mulberry32((seed|0)^0x7e11), land=MF(0x6a9a5a), rock=MF(0x8a8478), sand=MF(0xe8d49a), tree=MF(0x3a7a4a);
  const n=4, a0=r()*TAU;
  for (let i=0;i<n;i++){ const a=a0+i/n*TAU+(r()-0.5)*0.8, d=180+r()*60, x=Math.sin(a)*d, z=Math.cos(a)*d, s=10+r()*14, h=3+r()*6;
    const p=new THREE.Group(); p.position.set(x,-0.3,z); g.add(p);
    const b=mk(new THREE.CylinderGeometry(s*1.05,s*1.15,1.2,14), sand, 0,0,0,p); b.castShadow=b.receiveShadow=false;
    const m=mk(new THREE.SphereGeometry(s,12,6,0,TAU,0,Math.PI/2), r()<0.3?rock:land, 0,0.4,0,p); m.scale.y=h/s; m.castShadow=m.receiveShadow=false;
    for (let k=0;k<5;k++){ const ta=r()*TAU, td=r()*s*0.6, c=mk(G.cone(1.2,3.2,5), tree, Math.sin(ta)*td, 0.4+h*Math.sqrt(Math.max(0,1-(td/s)**2))+1.2, Math.cos(ta)*td, p); c.castShadow=c.receiveShadow=false; } }
  return g;
}

/* ---------- the controller ----------
   ctx (from main.js): THREE scene bits and game functions. See setupLighthouse() in main.js for the list.
   You walk it all yourself in the usual camera: in at the door, up the stair with the stick (or a tap on a tread),
   out round the gallery, and back in at the lamp room door and down again, or straight down with Head down. */
export function makeLighthouse(ctx){
  const { tower, cx, cz, rot } = ctx, baseY=tower.position.y, U=tower.userData;
  const W = a => a+rot;                                                  // local angle to world angle
  const at = (a, rr, h) => new THREE.Vector3(cx+Math.sin(W(a))*rr, baseY+h, cz+Math.cos(W(a))*rr);
  const Gy = baseY+LT.G, A1=wrap(LT.a1), dA=LT.turns*TAU/LT.steps;
  const st = { mode:'off', t:0, look:new THREE.Vector3(), camP:new THREE.Vector3(), camSnap:false, greeted:false, s:0, r:LT.pathR, a:A1, dir:1 };
  const P = ctx.player;
  // things up top: the keeper (stands by the telescope) and the way back down
  const keeperA = Math.PI+0.18, keeperR = 2.55, scopeA = Math.PI+0.55, hatchA = LT.a1;
  let keeper=null;
  if (ctx.keeperSpec){ const k=at(keeperA, keeperR, LT.G); keeper=ctx.folkKeeper(k.x, k.z, W(keeperA)+Math.PI/2);
    keeper.pos.y=Gy; keeper.obj.position.y=Gy; keeper.rest=W(keeperA); keeper.reach=1.9; keeper.label=()=>st.mode==='top'?'Talk':null; }
  const hp=at(hatchA, 1.75, LT.G);
  const hatch=new ctx.Thing('lhdown', hp.x, hp.z, 0.3, new THREE.Group(), ()=>st.mode==='top'?'Head down':null, ()=>{ if (st.mode==='top') goDown(); }, { solid:false, reach:4.2 });   // reach covers the whole ring, so 'Head down' is on the button whenever the keeper isn't closer
  hatch.pos.y=Gy; hatch.obj.position.y=Gy;
  const dp=at(0, LT.rBot+0.7, 0); dp.y=ctx.groundY(dp.x, dp.z);
  const door=new ctx.Thing('lhdoor', dp.x, dp.z, 0.4, new THREE.Group(), ()=>st.mode==='off' ? (ctx.TX.climbed?'Go in again':'Go in') : null, ()=>{ if (st.mode==='off') climb(); }, { solid:false, reach:1.8, hit:[0.8,1.0] });

  // ---- the stair and the gallery, for the shared walking code ----
  const STAIR = { cx, cz, rot, baseY, steps:LT.steps, dA, speed:3.0,
    at:s=>({ a:LT.a0+s*dA, h:LT.base+clamp(s+0.5,0,LT.steps)*LT.rise, rr:LT.pathR }),
    band:s=>{ const h=LT.base+clamp(s+0.5,0,LT.steps)*LT.rise; return [0.6, rIn(h)-0.3]; } };
  const DECK = { cx, cz, rot, Gy, rMin:LT.glassR+0.3, rMax:LT.railR-0.3, door:{ a:A1, half:0.3 }, speed:3.0,
    wedges:()=>[], circles:()=>[[keeperA, keeperR, 0.35], [scopeA, 2.62, 0.25]] };

  // ---- helpers ----
  const kit=perchKit(ctx), { hud, walkAnim, still } = kit;
  const pose = (a, rr, h, face) => { const p=at(a, rr, h); P.pos.copy(p); P.obj.position.copy(p); if (face!==undefined){ P.face=face; P.obj.rotation.y=face; } };
  // the shaft wall, the struts and the treads above you on the camera's side hide, so you can see in
  const cutaway = (on, camW, py) => { const local = camW!==undefined ? camW-rot : 0, ly=(py??baseY)-baseY;
    U.segs.forEach((sg,i)=>{ sg.visible = !on || Math.abs(angD(segMid(i), local))>1.2; });
    (U.brackets||[]).forEach(b=>{ b.visible = !on || Math.abs(angD(b.userData.a, local))>1.0; });
    (U.treads||[]).forEach(T=>{ T.m.visible = !on || !(Math.abs(angD(T.a, local))<1.5 && T.y>ly+0.3); }); };
  const camAng = () => Math.atan2(ctx.camera.position.x-cx, ctx.camera.position.z-cz);
  const IN_T = 1.1, OUT_T = 1.0;
  const NOTES = [[0.22,'Round and round. The keeper has painted a little blue fish on the wall.'],[0.5,'Halfway. A shelf of old logbooks, every storm written down.'],[0.78,'Your legs are burning a bit. Nearly there.']];
  let noteI=0;
  const startCam = () => { st.camP.copy(ctx.camera.position); st.look.copy(P.pos); st.look.y+=0.9; st.camSnap=false; };

  function climb(){
    if (ctx.busy()) return; ctx.prep(); ctx.stopMove(); hud('top'); ctx.setPerch(perch);
    st.mode='in'; st.t=0; noteI=0; ctx.Snd.door(); startCam(); st.h0=dp.y-baseY;
    if (!ctx.TX.climbed){ ctx.TX.climbed=1; ctx.save(); }
  }
  function onStair(s, r, dir){ st.mode='stair'; st.t=0; st.s=s; st.r=r; st.dir=dir; st.goS=null; st.push=null; st.stepI=undefined; hud('top'); }
  function onDeck(a, r){ st.mode='top'; st.t=0; st.a=a; st.r=r; hud('top'); cutaway(false); }
  function jumpTop(){   // #dev shortcut: straight out onto the gallery
    if (st.mode!=='off' || ctx.busy()) return false; ctx.prep(); ctx.stopMove(); ctx.setPerch(perch); P.obj.visible=true;
    onDeck(A1, LT.walkR); pose(A1, LT.walkR, LT.G, W(A1)); st.camSnap=true; arrive(); return true; }
  function outside(){ st.mode='off'; P.obj.visible=true; cutaway(false); fadeTo(U.roofM, false, 1); hud(false); ctx.setPerch(null); ctx.setCamYaw(0);
    const a=0, p=at(a, LT.rBot+1.1, 0); p.y=ctx.groundY(p.x,p.z); P.pos.copy(p); P.obj.position.copy(p); P.face=W(a); P.obj.rotation.y=P.face;
    ctx.camTarget.copy(P.pos); ctx.updateSky(); ctx.updateCamera(1); }
  function goDown(){ st.mode='down'; ctx.stopMove(); ctx.fade(outside); ctx.Snd.door(); }
  function arrive(){
    ctx.toast('The top of the lighthouse', null, '', 'Walk round the gallery. Go back in at the lamp room door to walk down.');
    if (keeper && !st.greeted){ st.greeted=true; const S=ctx.keeperSpec;
      setTimeout(()=>{ if (st.mode==='top') ctx.dialog(S.name, S.voice, [ctx.TX.lantern ? 'Back up again? The view never gets old, does it.' : `Oh! A visitor, all the way up here. ${LT.steps} steps! Hardly anyone makes it.`, 'Come say hello when you\'ve had a look round.']); }, 350); }
  }

  // ---- hooks main.js calls while you're inside or up top ----
  const perch = {
    get mode(){ return st.mode; },
    move(dt, t){
      st.t+=dt;
      if (st.mode==='in'){ // from the doorway to the foot of the stair
        const k=smooth(0,1,st.t/IN_T), h0=STAIR.at(0), a=lerp(0, h0.a, k), rr=lerp(LT.rBot+0.7, LT.pathR, k);
        pose(a, rr, lerp(st.h0, h0.h, k), W(a)+Math.PI); walkAnim(t, 0.8);
        if (st.t>=IN_T) onStair(0, LT.pathR, 1);
        return true; }
      if (st.mode==='leaving'){ // from the foot of the stair out of the door
        const k=smooth(0,1,st.t/IN_T), h0=STAIR.at(0), a=lerp(h0.a, 0, k), rr=lerp(st.r, LT.rBot+1.0, k);
        const p=at(a, rr, 0); pose(a, rr, lerp(h0.h, ctx.groundY(p.x,p.z)-baseY, k), W(a)); walkAnim(t, 0.8);
        if (st.t>=IN_T) outside();
        return true; }
      if (st.mode==='stair'){
        const r=stairMove(ctx, kit, st, STAIR, dt, t);
        if (r==='top'){ st.mode='out'; st.t=0; st.r0=st.r; return true; }
        if (r==='bottom'){ st.mode='leaving'; st.t=0; ctx.Snd.door(); return true; }
        const f=st.s/LT.steps; if (st.dir>0 && noteI<NOTES.length && f>=NOTES[noteI][0]){ ctx.toast(NOTES[noteI][1]); noteI++; }
        return true; }
      if (st.mode==='out'){ // up through the hatch, out of the lamp room door, onto the gallery
        const k=smooth(0,1,st.t/OUT_T), rr=lerp(st.r0, LT.walkR, k); pose(LT.a1, rr, LT.G, W(LT.a1)); walkAnim(t, 0.7);
        if (st.t>=OUT_T){ onDeck(A1, LT.walkR); arrive(); }
        return true; }
      if (st.mode==='backin'){ // in at the lamp room door and onto the top of the stair, facing down
        const k=smooth(0,1,st.t/OUT_T), rr=lerp(st.r0, LT.pathR, k); pose(lerp(st.a0, LT.a1, k), rr, LT.G, W(LT.a1)+Math.PI);
        walkAnim(t, 0.7);
        if (st.t>=OUT_T) onStair(LT.steps-0.3, LT.pathR, -1);
        return true; }
      if (st.mode==='down'){ still(); return true; }
      if (st.mode==='top'){ if (deckMove(ctx, kit, st, DECK, dt, t)==='door'){ ctx.stopMove(); st.mode='backin'; st.t=0; st.r0=st.r; st.a0=LT.a1+angD(st.a, A1); } return true; }
      return false;
    },
    cam(dt){
      if (st.mode==='off') return false;
      const top = st.mode==='top' || st.mode==='down';
      const o = top ? VIEW.top : { ...VIEW.stair, capY: Gy-0.55 };
      followCam(ctx, kit, st, o, dt);
      if (top || st.mode==='out' || st.mode==='backin'){ cutaway(false); fadeTo(U.roofM, behind(P, cx, cz, ctx.getCamYaw()), dt); if (top) kit.farFog(); }
      else { cutaway(true, camAng(), P.pos.y); fadeTo(U.roofM, false, dt); }
      return true;
    },
    tap(p){
      if (ctx.dialogOpen()) return;
      if (st.mode==='stair'){ const R=ctx.ray && ctx.ray(); stairTap(st, STAIR, R && R.ray); return; }
      if (st.mode!=='top') return;
      if (p && p.ent && (p.ent===keeper || p.ent===hatch)){ const e=p.ent; P.target=e.pos.clone(); P.targetEnt=e; P.cb=()=>ctx.interact(e); return; }
      const pt = p && (p.ground || p.water || p.point); if (pt){ P.target=pt.clone(); P.targetEnt=null; P.cb=null; }
    },
    act(){
      if (st.mode!=='top') return;
      const e=ctx.nearestEnt(); if (e){ ctx.stopMove(); ctx.interact(e, 'manual'); }
    },
  };

  // the lamp turns all the time; the beam shows after dusk
  const tick = (dt, t) => { U.lens.rotation.y=t*0.6; const n=ctx.night(); U.beamM.opacity=0.13*smooth(0.35,0.8,n); U.beam.visible=n>0.3; if (U.vane) U.vane.rotation.y=Math.sin(t*0.13)*1.2; };
  return { perch, keeper, door, hatch, tick, jumpTop, get mode(){ return st.mode; } };
}

/* ---------- shared by both climbable lighthouses: this one and the Lantern Bluff one (bluffhouse.js) ----------
   kit: HUD modes and the walk cycle. The walking code and camera below take the stair (S) and gallery (D) as plain descriptions.
   st (the controller's own state) carries the stair or gallery position, camP, look and t. */
export function perchKit(ctx, o={}){
  const P=ctx.player;
  // on the stair the HUD goes away like a cutscene; up top you get the action button and joystick back, but no tools or bag
  if (!document.getElementById('lhCss')){ const c=document.createElement('style'); c.id='lhCss'; c.textContent='#hud.lhtop #swingBtn,#hud.lhtop #bar{display:none}'; document.head.appendChild(c); }
  const hud = m => { const h=ctx.hud; if (!h) return; h.classList.toggle('inbay', !!m); h.classList.toggle('magic', m==='climb'); h.classList.toggle('lhtop', m==='top'); };
  const walkAnim = (t, k) => { const u=P.obj.userData; if (!u.legs) return; const ph=t*11; u.legs[0].rotation.x=Math.sin(ph)*0.7*k; u.legs[1].rotation.x=-Math.sin(ph)*0.7*k; if (u.arms){ u.arms[0].rotation.x=-Math.sin(ph)*0.6*k; u.arms[1].rotation.x=Math.sin(ph)*0.6*k; } if (u.body) u.body.position.y=Math.abs(Math.sin(ph))*0.07*k; };
  const still = () => { const u=P.obj.userData; (u.legs||[]).forEach(l=>l.rotation.x*=0.8); (u.arms||[]).forEach(a=>a.rotation.x*=0.8); if (u.body) u.body.position.y*=0.8; };
  // from up there you can see much further than from the beach
  const [fogN, fogF] = o.fog || [90, 330];   // how far you see from up top (the bluff keeps it shorter: the sea's far edge shows from up there)
  const farFog = () => { const f=ctx.scene.fog; if (!f) return; f.near=Math.max(f.near, fogN); f.far=Math.max(f.far, fogF); };
  return { P, hud, walkAnim, still, farFog };
}
/* ---------- v1.72 walking it yourself, in the usual view ----------
   No more ride up the stair with the camera circling the tower, no turn on the spot in the lamp room, no eye-level view
   round the gallery. You walk the stair and the gallery yourself (stick, keys or a tap), and the camera stays where
   the island camera is: behind and above you, pointing the way you last turned it. It only ever slides along with you.
   Positions here are local polar: angle a (local, add the tower's rot for world) and radius r from the middle. */
const _v=new THREE.Vector3(), _w=new THREE.Vector3();
// the stick or keys as a world direction, turned by the camera the same way main.js does it; null when idle
export function inputDir(ctx){
  let [ix,iz]=ctx.input(); if (ctx.dialogOpen()) return null; if (!ix && !iz) return null;
  const Y=ctx.getCamYaw(), mx=ix*Math.cos(Y)+iz*Math.sin(Y), mz=-ix*Math.sin(Y)+iz*Math.cos(Y), L=Math.hypot(mx,mz)||1;
  return { x:mx/L, z:mz/L, m:Math.min(1, Math.hypot(ix,iz)) };
}
const faceTo = (P, face, dt) => { let df=face-P.obj.rotation.y; df=Math.atan2(Math.sin(df),Math.cos(df)); P.obj.rotation.y+=df*Math.min(1,dt*12); P.face=P.obj.rotation.y; };

/* The stair. S: { cx, cz, rot, baseY, steps, dA (radians a tread), at(s)->{ a, h, rr? } (local angle, height over the base,
   the line you'd walk), band(s)->[inner r, outer r] where you can stand, speed }. st carries s (treads up, 0..steps), r, dir and
   goS (a tapped tread). The camera stays put, so the stair turns under the stick: whichever way along it your push points
   when you start (up or down), holding the stick or a key keeps you going that way all the way round. Push the other way
   to turn back. Returns 'top' or 'bottom' when you walk off that end, else true. */
export function stairMove(ctx, kit, st, S, dt, t){
  const P=kit.P, H0=S.at(st.s), wa=H0.a+S.rot, tx=Math.cos(wa), tz=-Math.sin(wa);
  const sp=S.speed||3.0, arc=Math.max(0.6, st.r)*S.dA; let ds=0;
  const d=inputDir(ctx);
  if (d){ st.goS=null; st.goCb=null; if (P.target) ctx.stopMove();
    const tg=d.x*tx+d.z*tz;
    if (!st.push || d.x*st.push.x+d.z*st.push.z < -0.4){   // a fresh push, or a turn back: pick the way along the stair it points
      st.push={ x:d.x, z:d.z }; st.dir = Math.abs(tg)>0.15 ? Math.sign(tg) : (1); }
    ds=st.dir*d.m*sp*dt/arc; }
  else { st.push=null;
    if (st.goS!=null && !ctx.dialogOpen()){ const g=st.goS-st.s;
      if (Math.abs(g)<0.2){ const cb=st.goCb; st.goS=null; st.goCb=null; if (cb) cb(); }
      else { ds=Math.sign(g)*Math.min(Math.abs(g), sp*dt/arc); st.dir=Math.sign(g); } } }
  if (ds>0 && st.s+ds>S.steps) return 'top';
  if (ds<0 && st.s+ds<0) return 'bottom';
  st.s=clamp(st.s+ds, 0, S.steps);
  const H=S.at(st.s), [r0,r1]=S.band(st.s), want=clamp(H.rr ?? st.r, r0, r1);
  st.r=clamp(st.r+(want-st.r)*Math.min(1, dt*5), r0, r1);    // drift onto the walking line (it hugs the wall past broken treads)
  const w=H.a+S.rot; P.pos.set(S.cx+Math.sin(w)*st.r, S.baseY+H.h, S.cz+Math.cos(w)*st.r); P.obj.position.copy(P.pos);
  if (ds){ const sg=Math.sign(ds); faceTo(P, Math.atan2(Math.cos(w)*sg, -Math.sin(w)*sg), dt); kit.walkAnim(t, 0.9); }
  else kit.still();
  const si=Math.floor(st.s); if (si!==st.stepI){ if (st.stepI!==undefined && si%3===0) ctx.step(); st.stepI=si; }
  return true;
}
// a tap on the stair: walk to the tread nearest the tap (looking at the treads within a turn and a half of you)
export function stairTap(st, S, ray, cb){
  if (!ray) return; const span=Math.ceil(1.5*TAU/S.dA); let best=-1, bd=1.2;
  for (let i=Math.max(0, Math.floor(st.s)-span); i<=Math.min(S.steps, Math.floor(st.s)+span); i++){ const H=S.at(i+0.5), w=H.a+S.rot, [r0,r1]=S.band(i+0.5), rr=(r0+r1)/2;
    _v.set(S.cx+Math.sin(w)*rr, S.baseY+H.h+0.1, S.cz+Math.cos(w)*rr); const dd=ray.distanceSqToPoint(_v); if (dd<bd){ bd=dd; best=i; } }
  if (best>=0){ st.goS=clamp(best+0.5, 0, S.steps); st.goCb=cb||null; return true; } return false;
}

/* The gallery (and anything round and flat like it). D: { cx, cz, rot, Gy, rMin, rMax, door:{ a, half } (local),
   wedges()->[[local a, half-width]] you can't walk into, circles()->[[local a, r, radius]] you can't walk through, speed }.
   st carries a and r. Joystick, keys or a tap (P.target, P.targetEnt) move you. Returns 'door' when you walk in at the door. */
export function deckMove(ctx, kit, st, D, dt, t){
  const P=kit.P, sp=D.speed||3.0;
  const free = (a, r) => { if (r<D.rMin-1e-4 || r>D.rMax+1e-4) return false;
    for (const [wa,hw] of D.wedges()) if (Math.abs(angD(a,wa))<hw) return false;
    const x=Math.sin(a)*r, z=Math.cos(a)*r; for (const [ca,cr,rad] of D.circles()) if (Math.hypot(x-Math.sin(ca)*cr, z-Math.cos(ca)*cr)<rad) return false;
    return true; };
  const wa=st.a+D.rot, tx=Math.cos(wa), tz=-Math.sin(wa), rx=Math.sin(wa), rz=Math.cos(wa);
  let mx=0, mz=0, m=0; const d=inputDir(ctx);
  if (d){ if (P.target) ctx.stopMove(); mx=d.x; mz=d.z; m=d.m; }
  else if (P.target && !ctx.dialogOpen()){ const E=P.targetEnt;
    const dx=P.target.x-P.pos.x, dz=P.target.z-P.pos.z;
    const near = E ? Math.hypot(E.pos.x-P.pos.x, E.pos.z-P.pos.z) <= Math.min(E.reach, 1.6) : Math.hypot(dx,dz)<0.15;
    if (near){ const cb=P.cb; ctx.stopMove(); st.stuck=0; if (cb) cb(); }
    else { // round the ring the short way (the other way if something's in the way), drifting toward the tapped radius
      const ta=Math.atan2(P.target.x-D.cx, P.target.z-D.cz)-D.rot, tr=clamp(Math.hypot(P.target.x-D.cx, P.target.z-D.cz), D.rMin, D.rMax);
      let g=angD(ta, st.a); const crosses=D.wedges().some(([b])=>{ const q=angD(b, st.a); return Math.sign(q)===Math.sign(g) && Math.abs(q)<Math.abs(g); }); if (crosses) g-=Math.sign(g)*TAU;
      const along=g*st.r, across=tr-st.r, L=Math.hypot(along, across)||1;
      if (Math.abs(along)<0.6){ mx=dx; mz=dz; const l=Math.hypot(mx,mz)||1; mx/=l; mz/=l; }
      else { const ka=along/L, kr=across/L; mx=tx*ka+rx*kr; mz=tz*ka+rz*kr; }
      m=1; } }
  if (m){ const step=sp*m*dt, ta=(mx*tx+mz*tz)*step, ra=(mx*rx+mz*rz)*step;
    if (ra<0 && st.r<=D.rMin+0.03 && D.door && Math.abs(angD(st.a, D.door.a))<D.door.half && (d || (P.target && !P.targetEnt))) return 'door';
    const na=st.a+ta/Math.max(st.r,0.5), nr=clamp(st.r+ra, D.rMin, D.rMax); let moved=true;   // at the glass or the rail you slide along it
    if (free(na,nr)){ st.a=na; st.r=nr; } else if (Math.abs(ta)>step*0.2 && free(na,st.r)){ st.a=na; } else if (Math.abs(ra)>step*0.2 && free(st.a,nr)){ st.r=nr; } else {
      // something round in the way: step round it, toward whichever side of the ring has more room
      const s2=step*0.9, mid=(D.rMin+D.rMax)/2, sides = st.r>mid ? [-s2, s2] : [s2, -s2]; let done=false;
      for (const dr of sides){ const r2=clamp(st.r+dr, D.rMin, D.rMax), a2=st.a+ta*0.5/Math.max(r2,0.5); if (Math.abs(ta)>step*0.2 && free(a2, r2)){ st.a=a2; st.r=r2; done=true; break; } if (free(st.a, r2) && Math.abs(ta)>step*0.2 && r2!==st.r){ st.r=r2; done=true; break; } }
      if (!done) moved=false; }
    if (!moved && P.target && !d){ if ((st.stuck=(st.stuck||0)+dt)>0.6){ st.stuck=0; const E=P.targetEnt, cb=P.cb; ctx.stopMove(); if (E && Math.hypot(E.pos.x-P.pos.x,E.pos.z-P.pos.z)<=E.reach+0.4 && cb) cb(); } } else st.stuck=0;
    faceTo(P, Math.atan2(mx,mz), dt); kit.walkAnim(t, 0.9*m); }
  else kit.still();
  const w=st.a+D.rot; P.pos.set(D.cx+Math.sin(w)*st.r, D.Gy, D.cz+Math.cos(w)*st.r); P.obj.position.copy(P.pos);
  return true;
}

/* The camera: like the island's, behind and above you on the side the camera yaw points to. It never turns by itself
   (drag or the turn keys still turn it, as outdoors); it slides with you. o: { dist, pitch, up, capY }.
   Returns the yaw, for the cut-away. */
export const VIEW = { stair:{ dist:13, pitch:0.5, up:0.9 }, top:{ dist:13.5, pitch:0.55, up:1.0 } };
export function followCam(ctx, kit, st, o, dt){
  const c=ctx.camera, P=kit.P, Y=ctx.getCamYaw(), ch=Math.cos(o.pitch)*o.dist;
  let y=P.pos.y+o.up+Math.sin(o.pitch)*o.dist; if (o.capY!=null) y=Math.min(y, o.capY);
  _v.set(P.pos.x+Math.sin(Y)*ch, y, P.pos.z+Math.cos(Y)*ch); _w.copy(P.pos); _w.y+=o.up;
  if (st.camSnap){ st.camSnap=false; st.camP.copy(_v); st.look.copy(_w); } else { const k=Math.min(1, dt*5); st.camP.lerp(_v, k); st.look.lerp(_w, k); }
  c.position.copy(st.camP); c.lookAt(st.look); ctx.skyFollow(P.pos); return Y;
}
// is the player round the far side of the middle from the camera? (then the lamp room's roof would hide them)
export const behind = (P, cx, cz, yaw) => { const dx=P.pos.x-cx, dz=P.pos.z-cz, L=Math.hypot(dx,dz)||1; return (dx*Math.sin(yaw)+dz*Math.cos(yaw))/L < 0.15; };
// fade a roof material toward see-through while you're behind it
export function fadeTo(mat, see, dt){ if (!mat) return; const want=see?0.22:1; mat.opacity+= (want-mat.opacity)*Math.min(1, dt*6);
  const tr=mat.opacity<0.99; if (tr!==mat.transparent){ mat.transparent=tr; mat.needsUpdate=true; } mat.depthWrite=!tr; if (!tr) mat.opacity=1; }
export { angD, wrap };
