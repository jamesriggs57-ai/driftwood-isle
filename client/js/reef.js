/* =====================================================================
   v1.37 ISLAND STORIES: models for the reef and Bramble's workshop.
   - Coral (four kinds, three sizes, plus bleached rubble), coral items, planks
   - Cay Bay: a shallow turquoise bay ringed by sandy cays, rowed out to from the dock. Its own little scene:
     the floor, the water, the cays, the reef plots and the life that comes back as the reef grows.
   - Gill's old rowboat, Sprig's coral nursery tank
   - Old Pinewood: Bramble's workshop (and its building site), ferns, low mist, the Grandfather Stump
   main.js decides what happens; this file only builds things.
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32, hashStr, fbm, vnoise } from './util.js';
import { M, mk, G, glowMat, addGlow, ITEM_BUILDERS, buildTree } from './models.js';
import { tmat, tbox, mergeStatic, cottageRoof, window1, door1, wallLantern, chimney1, ivy, timberFace, hangingSign, mossTop, barrel1 } from './cottage.js';
import { buildFishInto } from './critters.js';

/* ---------- Coral ---------- */
export const CORAL = {
  brain:   { cols:[0xf08a8a, 0xf2a46a, 0xb8d86a, 0xf0b0c8], tip:0xfff0e0 },
  staghorn:{ cols:[0xa07ae8, 0x6a8ef0, 0xd87ad0, 0x7ad0e0], tip:0xfff4ff },
  fan:     { cols:[0xe8405a, 0xf07a3a, 0xb04ad8, 0xd83a9a], tip:0xffe0e8 },
  table:   { cols:[0x3ab8a8, 0x7ac86a, 0xd8b84a, 0x5ab0d8], tip:0xe8fff4 },
};
const BLEACH = 0xe6e0d4;
// shared materials, so a whole reef merges down to a few draw calls
let _lattice=null; const MEM=new Map();
function memMat(base){ if (!_lattice){ const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d'); x.strokeStyle='#fff'; x.lineWidth=2.2;
    for (let i=-10;i<20;i++){ x.beginPath(); x.moveTo(i*10,0); x.lineTo(i*10+64,128); x.stroke(); x.beginPath(); x.moveTo(i*10+64,0); x.lineTo(i*10,128); x.stroke(); }
    _lattice=new THREE.CanvasTexture(cv); _lattice.wrapS=_lattice.wrapT=THREE.RepeatWrapping; _lattice.repeat.set(3,3); }
  if (!MEM.has(base)) MEM.set(base, new THREE.MeshStandardMaterial({ color:base, alphaMap:_lattice, transparent:true, opacity:1, side:THREE.DoubleSide, roughness:0.8, depthWrite:false })); return MEM.get(base); }
export const mergeReef = g => mergeStatic(g);
const cMat = (c, o) => M(c, Object.assign({ roughness:0.72 }, o||{}));
function displaceGeo(geo, fn){ const p=geo.attributes.position, v=new THREE.Vector3(); for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); fn(v,i); p.setXYZ(i,v.x,v.y,v.z); } geo.computeVertexNormals(); return geo; }
// a tapered branch from a to b
function branch(g, a, b, r0, r1, mat){ const d=new THREE.Vector3().subVectors(b,a), L=d.length(); const m=mk(G.cyl(r1,r0,L,7), mat, 0,0,0,g);
  m.position.copy(a).addScaledVector(d,0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()); return m; }

// stage 0: a sprig just planted, 1: small, 2: full grown. Full coral is about 1.2 m across.
export function buildCoral(kind, stage, seed=1, bleached=false){
  const g=new THREE.Group(), r=mulberry32(seed|0), K=CORAL[kind]||CORAL.brain;
  const base=bleached ? BLEACH : K.cols[Math.floor(r()*K.cols.length)], mat=cMat(base), tipM=cMat(bleached?0xf4f0e8:new THREE.Color(base).lerp(new THREE.Color(K.tip),0.45).getHex());
  const s=[0.28,0.6,1][clamp(stage|0,0,2)];
  if (kind==='brain'){
    const geo=new THREE.IcosahedronGeometry(0.55,3), ph=r()*10, f=6+r()*3;
    displaceGeo(geo, v=>{ const n=v.clone().normalize(); const gr=Math.abs(Math.sin(f*(n.x+0.7*n.z+0.35*Math.sin(n.y*5+ph))+2.2*Math.sin(n.z*3.1+ph)));
      const k=1-0.15*(1-smooth(0.12,0.5,gr)); v.multiplyScalar(k); if (v.y<-0.15) v.y=-0.15+(v.y+0.15)*0.25; });
    const b=mk(geo, mat, 0,0.12,0,g); b.scale.set(1,0.78,1);
    if (stage>=2) for (let i=0;i<2;i++){ const a=r()*TAU, d=0.55+r()*0.2, sm=mk(new THREE.IcosahedronGeometry(0.22,2), mat, Math.cos(a)*d, 0.02, Math.sin(a)*d, g); sm.scale.set(1,0.7,1); }
  } else if (kind==='staghorn'){
    const grow=(a, dir, len, rad, depth)=>{ const b=a.clone().addScaledVector(dir,len); branch(g, a, b, rad, rad*0.72, mat);
      if (depth<=0){ mk(G.sph(rad*0.8,7,5), tipM, b.x,b.y,b.z,g); return; }
      const n=depth>=2?3:2; for (let i=0;i<n;i++){ const d2=dir.clone().add(new THREE.Vector3((r()-0.5)*1.3, 0.35+r()*0.4, (r()-0.5)*1.3)).normalize(); grow(b, d2, len*(0.65+r()*0.2), rad*0.7, depth-1); } };
    const n=stage>=2?5:stage>=1?3:2; for (let i=0;i<n;i++){ const a=i/n*TAU+r(); grow(new THREE.Vector3(Math.cos(a)*0.08,0,Math.sin(a)*0.08), new THREE.Vector3(Math.cos(a)*0.55,1,Math.sin(a)*0.55).normalize(), 0.36, 0.07, stage>=2?3:2); }
    mk(G.sph(0.16,8,6), mat, 0,0.04,0,g).scale.y=0.5;
  } else if (kind==='fan'){
    // a flat lattice fan on a short stalk, with a see-through membrane between the ribs
    const fan=new THREE.Group(); fan.rotation.y=r()*TAU; g.add(fan); const R=0.95, ribs=11;
    branch(fan, new THREE.Vector3(0,0,0), new THREE.Vector3(0,0.22,0), 0.06, 0.05, mat);
    const sh=new THREE.Shape(); sh.moveTo(0,0.2); for (let i=0;i<=24;i++){ const a=-1.15+i/24*2.3; sh.lineTo(Math.sin(a)*R*(0.92+0.08*Math.sin(i*2.1)), 0.2+Math.cos(a)*R*(0.85+0.1*Math.cos(i*1.3))); } sh.lineTo(0,0.2);
    const cv=null;
    const mem=memMat(base, cv);
    const m=mk(new THREE.ShapeGeometry(sh, 16), mem, 0,0,0,fan); m.castShadow=false;
    for (let i=0;i<ribs;i++){ const a=-1.1+i/(ribs-1)*2.2, L=R*(0.8+r()*0.15); branch(fan, new THREE.Vector3(0,0.2,0), new THREE.Vector3(Math.sin(a)*L*0.5, 0.2+Math.cos(a)*L*0.5, (r()-0.5)*0.04), 0.035, 0.025, mat);
      branch(fan, new THREE.Vector3(Math.sin(a)*L*0.5, 0.2+Math.cos(a)*L*0.5, 0), new THREE.Vector3(Math.sin(a)*L, 0.2+Math.cos(a)*L, (r()-0.5)*0.06), 0.025, 0.014, tipM); }
    fan.rotation.x=(r()-0.5)*0.2;
  } else {   // table: a wide flat plate on a stout stem, bumpy on top
    const stem=mk(G.cyl(0.1,0.16,0.42,8), mat, 0,0.21,0,g);
    const geo=new THREE.CylinderGeometry(0.72,0.6,0.1,28,1); displaceGeo(geo, v=>{ const a=Math.atan2(v.z,v.x), rr=Math.hypot(v.x,v.z); if (rr>0.3){ const k=1+0.1*Math.sin(a*5+seed)+0.06*Math.sin(a*11); v.x*=k; v.z*=k; v.y+= (rr-0.3)*0.12*Math.sin(a*3+seed); } });
    const p=mk(geo, mat, 0,0.46,0,g); p.rotation.set((r()-0.5)*0.12, r()*TAU, (r()-0.5)*0.12);
    for (let i=0;i<(stage>=2?26:12);i++){ const a=r()*TAU, d=Math.sqrt(r())*0.62; mk(G.sph(0.045,6,4), tipM, Math.cos(a)*d, 0.52, Math.sin(a)*d, g).scale.y=0.7; }
    if (stage>=2){ const p2=mk(new THREE.CylinderGeometry(0.42,0.36,0.08,20), mat, 0.5,0.26,0.2,g); p2.rotation.z=0.15; }
  }
  g.scale.setScalar(s*1.6); g.userData.kind=kind; return g;
}
// what's left of the old reef: a ring of bleached rubble where coral used to grow
let _scar=null, _scarM=null;
function scarTex(){ if (_scar) return _scar; const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d'), gr=x.createRadialGradient(64,64,8,64,64,62);
  gr.addColorStop(0,'rgba(120,128,120,0.55)'); gr.addColorStop(0.6,'rgba(140,140,128,0.35)'); gr.addColorStop(1,'rgba(160,150,130,0)'); x.fillStyle=gr; x.fillRect(0,0,128,128); _scar=new THREE.CanvasTexture(cv); return _scar; }
export function buildRubble(seed){ const g=new THREE.Group(), r=mulberry32(seed|0), m=M(BLEACH,{ roughness:0.95, flatShading:true }), m2=M(0xcfc8b8,{ roughness:0.95, flatShading:true });
  _scarM=_scarM||new THREE.MeshBasicMaterial({ map:scarTex(), transparent:true, depthWrite:false }); const sc=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6), _scarM); sc.rotation.x=-Math.PI/2; sc.position.y=0.03; g.add(sc);
  for (let i=0;i<3;i++){ const a=r()*TAU, d=r()*0.3; const b=mk(G.dod(0.16+r()*0.1), m2, Math.cos(a)*d, 0.05, Math.sin(a)*d, g); b.scale.y=0.55; b.rotation.set(r(),r(),r()); }
  for (let i=0;i<7;i++){ const a=i/7*TAU+r()*0.5, d=0.55+r()*0.25; const s=mk(G.dod(0.08+r()*0.07), i%2?m:m2, Math.cos(a)*d, 0.02, Math.sin(a)*d, g); s.scale.y=0.6; s.rotation.set(r(),r(),r()); }
  for (let i=0;i<4;i++){ const a=r()*TAU, d=0.3+r()*0.45; const b=mk(G.cyl(0.04,0.06,0.5,5), m, Math.cos(a)*d, 0.06, Math.sin(a)*d, g); b.rotation.set(Math.PI/2-0.3*r(), 0, r()*TAU); }
  return g; }

/* ---------- Items ---------- */
ITEM_BUILDERS.coralfrag = (g, d) => { const c=buildCoral(d.k, 1, hashStr(d.k)+5); c.scale.multiplyScalar(d.k==='table'?0.42:0.5); c.rotation.set(d.k==='fan'?0:0.25, d.k==='fan'?0.4:0, d.k==='table'?0.2:0.45); c.position.y=0.05; g.add(c); };
ITEM_BUILDERS.coralstarter = (g, d) => { mk(G.cyl(0.24,0.2,0.16,14), M(0xc8845a), 0,0.08,0,g); mk(G.cyl(0.21,0.21,0.02,14), M(0xe8dcb8), 0,0.165,0,g);
  const c=buildCoral(d.k, 0, hashStr(d.k)+9); c.scale.multiplyScalar(1.4); c.position.y=0.17; g.add(c); };
ITEM_BUILDERS.plank = (g) => { const pine=tmat('board',0xd8b07a,0.6,0.2), end=M(0xe8c89a);
  for (let i=0;i<3;i++){ const p=new THREE.Mesh(G.box(0.95,0.09,0.22), [end,end,pine,pine,pine,pine]); p.position.set((i-1)*0.04, 0.05+i*0.1, (i-1)*0.07); p.rotation.y=(i-1)*0.12; p.castShadow=p.receiveShadow=true; g.add(p); } };
ITEM_BUILDERS.fitting = (g) => { const iron=M(0x4a4a52,{ metalness:0.6, roughness:0.4 }); mk(G.tor(0.18,0.04,6,14), iron, 0,0.2,0,g).rotation.y=0.3; mk(G.box(0.36,0.06,0.08), iron, 0,0.04,0.12,g); for (const x of [-0.12,0.12]) mk(G.cyl(0.03,0.03,0.08,6), M(0xc9a050,{metalness:0.7,roughness:0.3}), x,0.09,0.12,g); };

/* ---------- Gill's old rowboat ----------
   The hull is swept from a rounded cross-section along the boat: pointed bow (+x), square stern. */
export function buildRowboat(){
  const g=new THREE.Group(), L=2.9, B=1.12, Dp=0.46, NU=26, NV=12, pos=[], idx=[];
  const width=u=>{ const b=Math.pow(Math.sin(Math.PI*clamp(0.12+u*0.86,0,1)),0.55); return u<0.12 ? lerp(0.78,0.96,u/0.12) : b; };
  for (let i=0;i<=NU;i++){ const u=i/NU, x=-L/2+u*L, w=B/2*width(u), sheer=0.06*Math.pow(Math.abs(u-0.45)*2,2)+(u>0.85?(u-0.85)*0.6:0);
    for (let j=0;j<=NV;j++){ const a=Math.PI*(j/NV); pos.push(x, (Dp+sheer)-Math.sin(a)*Dp*(u>0.92?lerp(1,0.4,(u-0.92)/0.08):1) - (u<0.04?0:0), Math.cos(a)*w); } }
  for (let i=0;i<NU;i++) for (let j=0;j<NV;j++){ const a=i*(NV+1)+j, b=a+NV+1; idx.push(a,b,a+1, b,b+1,a+1); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); geo.setIndex(idx); geo.computeVertexNormals();
  const paint=M(0x3f8aa8,{ roughness:0.7, side:THREE.FrontSide }), inner=M(0xb98a5a,{ roughness:0.85, side:THREE.BackSide });
  const outer=mk(geo, paint, 0,0,0,g); const inn=mk(geo, inner, 0,0,0,g); inn.castShadow=false;
  // a white stripe under the gunwale and a wooden rim
  const rimPts=[], stripe=[]; for (let i=0;i<=NU;i++){ const u=i/NU, x=-L/2+u*L, w=B/2*width(u), sheer=0.06*Math.pow(Math.abs(u-0.45)*2,2)+(u>0.85?(u-0.85)*0.6:0); rimPts.push([x, Dp+sheer, w]); }
  const wood=M(0x8a5e3a), wood2=M(0xa8754a);
  for (const s of [1,-1]){ const c=new THREE.CatmullRomCurve3(rimPts.map(p=>new THREE.Vector3(p[0],p[1]+0.01,s*p[2]))); mk(new THREE.TubeGeometry(c,40,0.035,6), wood, 0,0,0,g);
    const c2=new THREE.CatmullRomCurve3(rimPts.map(p=>new THREE.Vector3(p[0],p[1]-0.09,s*(p[2]+0.012)))); mk(new THREE.TubeGeometry(c2,40,0.018,5), M(0xf4f0e6), 0,0,0,g); }
  mk(G.box(0.06,Dp*0.9,B*0.78), wood, -L/2+0.03, Dp*0.55, 0, g);   // transom
  for (const [x,w] of [[-0.85,0.92],[0.15,1.0]]) mk(G.box(0.26,0.05,w), wood2, x, Dp*0.72, 0, g);   // thwarts (seats)
  mk(G.box(L*0.78,0.03,0.62), wood2, -0.05, 0.12, 0, g);   // floorboards
  // oars in their locks; each swings about its lock (userData.oars)
  const oars=[]; for (const s of [1,-1]){ mk(G.tor(0.04,0.012,5,10), M(0x3a3a3a), 0.15, Dp+0.06, s*0.53, g).rotation.x=Math.PI/2;
    const piv=new THREE.Group(); piv.position.set(0.15, Dp+0.07, s*0.53); g.add(piv); const arm=new THREE.Group(); piv.add(arm);
    const sh=mk(G.cyl(0.025,0.025,2.2,6), wood2, 0,0,0,arm); sh.rotation.x=Math.PI/2; sh.position.z=s*0.55; const bl=mk(G.box(0.03,0.16,0.5), wood2, 0,0,s*1.5,arm);
    mk(G.cyl(0.03,0.03,0.22,6), wood, 0,0,-s*0.5,arm).rotation.x=Math.PI/2; arm.userData.s=s; oars.push(arm); }
  // a coil of rope and a little bailing bucket
  mk(G.tor(0.12,0.03,5,12), M(0xcbb38a), -1.15, 0.14, 0.25, g).rotation.x=Math.PI/2; mk(G.cyl(0.09,0.07,0.14,10), M(0xd8604d), -1.1, 0.17, -0.28, g);
  g.userData.oars=oars; g.userData.seat=[-0.05, Dp*0.72+0.03, 0]; g.userData.len=L; return g; }

/* ---------- Sprig's coral nursery: a long glass tank on a wooden stand ---------- */
export function buildNurseryTank(){
  const g=new THREE.Group(), wood=M(0x8a5e3a), dark=M(0x5a3e28), brass=M(0xc9a050,{ metalness:0.6, roughness:0.35 });
  const W=1.9, D=0.72, Hs=0.78, Ht=0.62;
  mk(G.box(W+0.12,0.08,D+0.12), wood, 0,Hs,0,g); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.box(0.09,Hs,0.09), dark, x*(W/2-0.02), Hs/2, z*(D/2-0.02), g);
  mk(G.box(W-0.1,0.05,D-0.1), wood, 0,0.22,0,g); for (let i=0;i<3;i++) mk(G.cyl(0.12,0.12,0.14,10), M(0xc8845a), -0.5+i*0.5, 0.31, 0, g);   // spare plugs on the shelf
  const glass=new THREE.MeshPhysicalMaterial({ color:0xe8fbff, roughness:0.05, transmission:0, transparent:true, opacity:0.22, depthWrite:false });
  const water=new THREE.MeshStandardMaterial({ color:0x5ed8e0, transparent:true, opacity:0.32, roughness:0.1, depthWrite:false });
  const y0=Hs+0.04; mk(G.box(W,0.04,D), M(0xe8dcb8), 0,y0+0.02,0,g);   // sand floor
  const w=mk(G.box(W-0.04,Ht*0.86,D-0.04), water, 0,y0+Ht*0.43+0.02,0,g); w.castShadow=false; w.renderOrder=2;
  const gl=mk(G.box(W,Ht,D), glass, 0,y0+Ht/2,0,g); gl.castShadow=false; gl.renderOrder=3;
  for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.box(0.035,Ht+0.02,0.035), brass, x*W/2, y0+Ht/2, z*D/2, g);
  for (const y of [y0, y0+Ht]) for (const z of [-1,1]) mk(G.box(W+0.03,0.03,0.03), brass, 0,y,z*D/2,g);
  mk(G.box(W+0.06,0.05,D+0.06), dark, 0,y0+Ht+0.03,0,g);   // lid rim
  const lamp=mk(G.box(W*0.8,0.06,0.14), glowMat(0xd8f4ff), 0,y0+Ht+0.09,0,g); lamp.castShadow=false;
  // little plugs with sprigs of coral growing in rows; setSprigs shows what's growing tonight
  const sprigs=new THREE.Group(); g.add(sprigs);
  g.userData.setSprigs = list => { while (sprigs.children.length) sprigs.remove(sprigs.children[0]);
    list.slice(0,14).forEach((k,i)=>{ const col=i%7, row=Math.floor(i/7), p=new THREE.Group(); p.position.set(-W/2+0.2+col*0.25, y0+0.04, -0.15+row*0.3); sprigs.add(p);
      mk(G.cyl(0.07,0.06,0.06,10), M(0xc8845a), 0,0.03,0,p); const c=buildCoral(k, 0, i*31+7); c.scale.multiplyScalar(1.0); c.position.y=0.06; p.add(c); }); };
  // bubbles rising from an air stone at one end
  const bub=[]; const bm=new THREE.MeshStandardMaterial({ color:0xffffff, transparent:true, opacity:0.55, roughness:0.1 });
  for (let i=0;i<10;i++){ const b=mk(G.sph(0.018+((i*7)%3)*0.008,8,6), bm, W/2-0.15+Math.sin(i)*0.03, y0+0.05, Math.cos(i*1.7)*0.04, g); b.castShadow=false; b.userData.o=i/10; bub.push(b); }
  mk(G.cyl(0.04,0.04,0.04,8), M(0x8a9aa0), W/2-0.15, y0+0.05, 0, g);
  g.userData.update=(t)=>{ for (const b of bub){ const k=(t*0.35+b.userData.o)%1; b.position.y=y0+0.05+k*(Ht*0.82); b.position.x=W/2-0.15+Math.sin(t*3+b.userData.o*9)*0.03; } };
  // a little slate sign
  const cv=document.createElement('canvas'); cv.width=256; cv.height=96; const x=cv.getContext('2d'); x.fillStyle='#3a4a48'; x.fillRect(0,0,256,96); x.fillStyle='#f4f0e0'; x.font='700 34px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('Coral Nursery',128,50);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; mk(G.box(0.56,0.22,0.02), new THREE.MeshStandardMaterial({ map:t, roughness:0.9 }), 0, Hs-0.12, D/2+0.07, g);
  g.userData.size={ W:W+0.2, D:D+0.2 }; return g; }

/* =====================================================================
   CAY BAY. Local coordinates: the bay's middle at (0,0), north is -z. You row in from the south channel.
   ===================================================================== */
export const BAY = { R:44, OUTER:[6,7] };
export function planBay(seed){
  const r=mulberry32((seed|0)+4417), cays=[], plots=[];
  // a ring of sandy cays with a channel in to the south (+z) and the open mouth to the north (-z)
  for (let i=0;i<10;i++){ let a=-Math.PI/2+0.42+i*(TAU-0.84)/9.6+(r()-0.5)*0.12; const sa=Math.sin(a); if (sa>0.93) continue;
    const d=BAY.R+5+r()*9, rr=7+r()*6; cays.push({ x:Math.cos(a)*d, z:Math.sin(a)*d, r:rr, h:1.2+r()*1.1, sx:0.75+r()*0.5, ph:r()*TAU, palms:2+Math.floor(r()*4), seed:Math.floor(r()*1e6) }); }
  // two little sandbars inside the bay
  const bars=[ { x:-14, z:4, len:9, rot:0.6 }, { x:16, z:-8, len:7, rot:-0.4 } ];
  // reef patches: six inside the bay, two out by the mouth (the old outer reef)
  const centers=[[-18,-10],[-4,-20],[14,-22],[24,-2],[8,10],[-22,14],[-10,-36],[12,-38]];
  centers.forEach(([cx,cz],p)=>{ const pr=mulberry32((seed|0)+p*97+13); let n=0, tries=0;
    while (n<12 && tries<400){ tries++; const a=pr()*TAU, d=Math.sqrt(pr())*4.3, x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d;
      if (plots.some(q=>q.patch===p && Math.hypot(q.x-x,q.z-z)<1.75)) continue; plots.push({ i:plots.length, x, z, patch:p, rot:pr()*TAU, seed:Math.floor(pr()*1e6) }); n++; } });
  return { cays, bars, plots, centers, start:[0, 40], buoy:[2.8, 38], mouth:[0, -58], seed };
}
export function bayFloor(B, x, z){
  const d=Math.hypot(x,z); let h=-2.55+0.18*fbm(x*0.06+3,z*0.06-1)+0.35*smooth(30,6,d)*0;   // a sandy floor about 2.5 m down
  h-=0.25*smooth(18,0,d);   // a little deeper in the middle
  h=lerp(h, -6, smooth(70,95,d));   // open sea beyond the cays
  for (const c of B.cays){ const dx=x-c.x, dz=z-c.z, a=Math.atan2(dz,dx), rr=c.r*(1+0.12*Math.sin(3*a+c.ph)+0.07*Math.sin(5*a+c.ph*2)), q=Math.hypot(dx/c.sx, dz)/rr*Math.sqrt(c.sx);
    if (q<2.2){ const f=1-smooth(0.55,1.6,q); h=Math.max(h, lerp(-2.6, c.h, Math.pow(f,1.35)) + (q<0.7?0.15*fbm(x*0.2,z*0.2):0)); } }
  for (const b of B.bars){ const dx=x-b.x, dz=z-b.z, c=Math.cos(b.rot), s=Math.sin(b.rot), u=dx*c+dz*s, v=-dx*s+dz*c, q=Math.hypot(Math.max(0,Math.abs(u)-b.len/2)/2.4, v/1.6);
    if (q<2) h=Math.max(h, lerp(-2.5, -0.22, 1-smooth(0.2,1.6,q))); }
  for (const [cx,cz] of B.centers){ const q=Math.hypot(x-cx,z-cz); if (q<6.5) h+= 0.25*smooth(6.5,2,q); }   // reef patches sit on low mounds
  return h; }
export const bayOpen = (B, x, z) => bayFloor(B,x,z) < -0.5 && Math.hypot(x,z) < 92;

// the water: shallow and see-through over sand, deeper blue past the cays, sparkles on top. It keeps normal lighting and fog.
export function bayWaterMat(B){
  const N=128, E=200, data=new Uint8Array(N*N*4);
  for (let j=0;j<N;j++) for (let i=0;i<N;i++){ const x=-E/2+(i+0.5)/N*E, z=-E/2+(j+0.5)/N*E, h=bayFloor(B,x,z), d=clamp(-h/6,0,1); data[(j*N+i)*4]=Math.round(d*255); data[(j*N+i)*4+3]=255; }
  const tex=new THREE.DataTexture(data, N, N); tex.magFilter=tex.minFilter=THREE.LinearFilter; tex.needsUpdate=true;
  const U={ uT:{ value:0 }, uD:{ value:tex }, uE:{ value:E }, uSpark:{ value:1 }, uShal:{ value:new THREE.Color(0x3fd6c8) }, uDeep:{ value:new THREE.Color(0x1270a8) }, uNight:{ value:0 } };
  const m=new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.28, metalness:0.0, transparent:true, depthWrite:false });
  m.onBeforeCompile=sh=>{ Object.assign(sh.uniforms, U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uT; varying vec3 vWp;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\n vec4 wq=modelMatrix*vec4(transformed,1.); transformed.y+=0.025*sin(wq.x*0.45+uT*1.3)+0.02*sin(wq.z*0.6-uT*1.1);')
      .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT; uniform sampler2D uD; uniform float uE; uniform float uSpark; uniform vec3 uShal; uniform vec3 uDeep; uniform float uNight; varying vec3 vWp;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        float dep=texture2D(uD, vWp.xz/uE+0.5).r; float k=smoothstep(0.03,0.55,dep);
        vec3 wc=mix(uShal, uDeep, k); wc=mix(wc, vec3(0.16,0.26,0.5), uNight*0.55);
        diffuseColor.rgb=wc; diffuseColor.a=mix(0.3,0.9,smoothstep(0.3,0.95,dep));
        float foam=1.0-smoothstep(0.0,0.014,dep); diffuseColor.rgb=mix(diffuseColor.rgb, vec3(1.0), foam*0.75*(0.6+0.4*sin(vWp.x*2.0+uT*2.0))); diffuseColor.a=max(diffuseColor.a, foam*0.8);`)
      .replace('#include <dithering_fragment>',`#include <dithering_fragment>
        vec2 p=vWp.xz*3.1; float s=sin(p.x*1.7+uT*1.6+sin(p.y*1.3+uT))*sin(p.y*1.9-uT*1.2+sin(p.x*1.1-uT*0.8));
        float gl=sin(vWp.x*7.3+uT*2.1)*sin(vWp.z*6.1-uT*1.7);
        float sp=smoothstep(0.94,0.995,s)*smoothstep(0.2,0.8,gl)*uSpark; gl_FragColor.rgb+=vec3(sp*0.45); gl_FragColor.a=min(1.0,gl_FragColor.a+sp*0.25);`); };
  m.userData.U=U; return m; }

// the sea floor with sunlight rippling over it (caustics)
function floorMat(){ const U={ uT:{ value:0 }, uDay:{ value:1 } };
  const m=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95 });
  m.onBeforeCompile=sh=>{ Object.assign(sh.uniforms, U);
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWp;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vWp=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uT; uniform float uDay; varying vec3 vWp;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        if (vWp.y<-0.05){ vec2 p=vWp.xz*1.25; float a=0.5+0.5*sin(p.x*1.7+uT*1.1+sin(p.y*1.3+uT*0.7)); float b=0.5+0.5*sin(p.y*1.9-uT*0.9+sin(p.x*1.1-uT*0.6));
          float c=pow(a*b,4.0)*1.6; float sh=smoothstep(-6.0,-0.4,vWp.y); diffuseColor.rgb+=vec3(0.5,0.8,0.75)*c*0.32*uDay*sh; diffuseColor.rgb=mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.42,0.82,0.86)+vec3(0.0,0.05,0.07), smoothstep(-0.1,-2.8,vWp.y)); }`); };
  m.userData.U=U; return m; }

function seagrassGeo(){ const g=new THREE.BufferGeometry(), p=[], ix=[]; for (let b=0;b<5;b++){ const a=b/5*TAU, w=0.035, h=0.45+((b*7)%3)*0.12, ox=Math.cos(a)*0.07, oz=Math.sin(a)*0.07, n=p.length/3;
    p.push(ox-w*Math.sin(a),0,oz+w*Math.cos(a), ox+w*Math.sin(a),0,oz-w*Math.cos(a), ox*1.6,h,oz*1.6); ix.push(n,n+1,n+2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p,3)); g.setIndex(ix); g.computeVertexNormals(); return g; }

// The whole bay apart from the reef itself. Returns { group, water, floorMat, update(t, night) }.
export function buildBayWorld(B){
  const group=new THREE.Group(), E=200, N=170;
  const geo=new THREE.PlaneGeometry(E,E,N,N); geo.rotateX(-Math.PI/2); const pos=geo.attributes.position, cols=new Float32Array(pos.count*3), c=new THREE.Color();
  const SAND=new THREE.Color(0xf0e2bc), WSAND=new THREE.Color(0xd8c89c), DEEP=new THREE.Color(0x9ac4b4), GRASS=[new THREE.Color(0x7cbf5a), new THREE.Color(0x5fa84a)], SEAGR=new THREE.Color(0x8aa868);
  for (let i=0;i<pos.count;i++){ const x=pos.getX(i), z=pos.getZ(i), h=bayFloor(B,x,z); pos.setY(i,h);
    if (h>0.85) c.copy(GRASS[0]).lerp(GRASS[1], vnoise(x*0.3,z*0.3)).lerp(SAND, smooth(1.15,0.85,h));
    else if (h>0.05) c.copy(SAND).offsetHSL(0,0,(vnoise(x*1.1,z*1.1)-0.5)*0.05);
    else if (h>-0.15) c.copy(WSAND);
    else { c.copy(SAND).lerp(DEEP, smooth(-1.5,-6,h)).offsetHSL(0,0,(vnoise(x*0.7,z*0.7)-0.5)*0.06); const sg=smooth(0.55,0.75,vnoise(x*0.09+5,z*0.09-2)); c.lerp(SEAGR, sg*0.45*smooth(-0.6,-1.6,h)); }
    cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(cols,3)); geo.computeVertexNormals();
  const fm=floorMat(); const floor=new THREE.Mesh(geo, fm); floor.receiveShadow=true; group.add(floor);
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(900,900), M(0x3d93b8)); sea.rotation.x=-Math.PI/2; sea.position.y=-6.2; group.add(sea);
  const wm=bayWaterMat(B), water=new THREE.Mesh(new THREE.PlaneGeometry(E,E,120,120), wm); water.rotation.x=-Math.PI/2; water.position.y=0; water.renderOrder=1; group.add(water);
  const outer=new THREE.Mesh(new THREE.RingGeometry(E*0.705, 450, 48, 1), new THREE.MeshStandardMaterial({ color:0x2a86b0, roughness:0.15, transparent:true, opacity:0.9, depthWrite:false })); outer.rotation.x=-Math.PI/2; outer.position.y=0.01; outer.renderOrder=1; group.add(outer);
  // seagrass in soft drifts
  { const r=mulberry32(B.seed+71), im=new THREE.InstancedMesh(seagrassGeo(), M(0x8ab866,{ side:THREE.DoubleSide, roughness:0.9 }), 600), d=new THREE.Object3D(); let n=0;
    for (let k=0;k<12000 && n<600;k++){ const x=(r()-0.5)*150, z=(r()-0.5)*150, h=bayFloor(B,x,z); if (h>-1.5 || h<-4 || vnoise(x*0.09+5,z*0.09-2)<0.58) continue; if (B.plots.some(p=>Math.hypot(p.x-x,p.z-z)<1.3)) continue;
      d.position.set(x,h,z); d.rotation.set((r()-0.5)*0.5,r()*TAU,(r()-0.5)*0.5); d.scale.set(1.4,0.45+r()*0.35,1.4); d.updateMatrix(); im.setMatrixAt(n++, d.matrix); }
    im.count=n; im.castShadow=false; im.receiveShadow=true; group.add(im); }
  // the cays: sand, a grassy top, palms, a few rocks and bits of driftwood
  for (const cay of B.cays){ const r=mulberry32(cay.seed);
    for (let i=0;i<cay.palms;i++){ const a=r()*TAU, d=r()*cay.r*0.42, x=cay.x+Math.cos(a)*d*cay.sx, z=cay.z+Math.sin(a)*d, h=bayFloor(B,x,z); if (h<0.5) continue;
      const p=buildTree(mulberry32(cay.seed+i*7), 'palm', { fruit:'coconut', stage:3 }); p.position.set(x,h-0.05,z); p.rotation.y=r()*TAU; p.scale.setScalar(0.9+r()*0.3); group.add(p); }
    for (let i=0;i<3;i++){ const a=r()*TAU, d=cay.r*(0.5+r()*0.4), x=cay.x+Math.cos(a)*d*cay.sx, z=cay.z+Math.sin(a)*d, h=bayFloor(B,x,z); const rk=mk(G.dod(0.4+r()*0.5), M(0x9a968c,{ flatShading:true }), x, h+0.1, z, group); rk.scale.y=0.6; rk.rotation.set(r(),r(),r()); }
    if (r()<0.6){ const a=r()*TAU, d=cay.r*0.6, x=cay.x+Math.cos(a)*d*cay.sx, z=cay.z+Math.sin(a)*d, h=bayFloor(B,x,z); if (h>0.1){ const l=mk(G.cyl(0.12,0.16,1.8,8), M(0xc8b49a), x,h+0.12,z,group); l.rotation.set(0,r()*TAU,Math.PI/2); } } }
  // the way home: a red and white buoy with a little flag
  { const b=new THREE.Group(); b.position.set(B.buoy[0], 0, B.buoy[1]); group.add(b); mk(G.cyl(0.32,0.42,0.5,12), M(0xe2483d), 0,0.1,0,b); mk(G.cyl(0.3,0.33,0.14,12), M(0xffffff), 0,0.3,0,b);
    mk(G.cyl(0.03,0.03,1.3,6), M(0x4a4a4a), 0,0.95,0,b); const fl=mk(G.box(0.02,0.3,0.5), M(0xf3c35a), 0,1.45,0.25,b); b.userData.flag=fl; group.userData.buoy=b; }
  return { group, water, wm, fm, update(t, night, spark){ wm.userData.U.uT.value=t; wm.userData.U.uNight.value=night; wm.userData.U.uSpark.value=spark; fm.userData.U.uT.value=t; fm.userData.U.uDay.value=1-night*0.85;
    const b=group.userData.buoy; b.position.y=Math.sin(t*1.4)*0.06; b.rotation.z=Math.sin(t*1.1)*0.06; b.userData.flag.rotation.y=Math.sin(t*3)*0.25; } };
}

/* ---------- Life in the bay ---------- */
// a small fish for schools (one shared shape, painted per fish)
function schoolFishGeo(){ const pts=[]; for (let i=0;i<=10;i++){ const t=i/10; pts.push(new THREE.Vector2(Math.max(0.002, 0.055*Math.pow(Math.sin(Math.PI*t),0.7)*(1-0.4*t)), 0.13-t*0.26)); }
  const body=new THREE.LatheGeometry(pts, 8); body.rotateZ(-Math.PI/2); body.scale(1,1,0.55);
  const tail=new THREE.BufferGeometry(); tail.setAttribute('position', new THREE.Float32BufferAttribute([-0.12,0,0, -0.21,0.06,0, -0.21,-0.06,0],3)); tail.computeVertexNormals();
  const g=mergeGeos([body.toNonIndexed(), tail]); return g; }
function mergeGeos(list){ let n=0; for (const g of list) n+=g.attributes.position.count; const pos=new Float32Array(n*3), nor=new Float32Array(n*3); let i=0;
  for (const g of list){ if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array, i*3); nor.set(g.attributes.normal.array, i*3); i+=g.attributes.position.count; }
  const out=new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos,3)); out.setAttribute('normal', new THREE.BufferAttribute(nor,3)); return out; }
let _sfg=null;
// A school circling a spot near the floor. cols: the species' colors. Returns { mesh, update(t), setCount(n) }
export function buildSchool(cx, cz, floorY, cols, max=24, seed=1){
  _sfg=_sfg||schoolFishGeo(); const im=new THREE.InstancedMesh(_sfg, new THREE.MeshStandardMaterial({ roughness:0.45, side:THREE.DoubleSide }), max), r=mulberry32(seed), d=new THREE.Object3D(), c=new THREE.Color();
  const fish=[]; for (let i=0;i<max;i++){ fish.push({ ph:r()*TAU, rad:1.2+r()*2.2, sp:0.5+r()*0.35, y:0.6+r()*1.0, w:r()*TAU, s:1.5+r()*0.8 }); im.setColorAt(i, c.setHex(cols[i%cols.length]).offsetHSL((r()-0.5)*0.03,0,(r()-0.5)*0.08)); }
  im.castShadow=true; im.count=0; const dir=r()<0.5?1:-1;
  return { mesh:im, setCount(n){ im.count=Math.min(max,n|0); }, update(t){ for (let i=0;i<im.count;i++){ const f=fish[i], a=f.ph+t*f.sp*dir, wob=Math.sin(t*1.3+f.w)*0.35;
      const x=cx+Math.cos(a)*(f.rad+wob), z=cz+Math.sin(a)*(f.rad+wob)*0.8, y=floorY+f.y+Math.sin(t*0.9+f.w)*0.15;
      const vx=-Math.sin(a)*dir, vz=Math.cos(a)*0.8*dir; d.position.set(x,y,z); d.rotation.set(0, Math.atan2(-vz, vx)+Math.sin(t*7+f.w)*0.18, 0); d.scale.setScalar(f.s); d.updateMatrix(); im.setMatrixAt(i,d.matrix); } im.instanceMatrix.needsUpdate=true; } };
}
export function buildSeaTurtle(){ const g=new THREE.Group(), shell=M(0x6a7a3a,{ roughness:0.6 }), skin=M(0x9aa87a), sc=M(0x8a6a3a);
  const s=mk(G.sph(0.55,16,10,0,TAU,0,Math.PI/2), shell, 0,0,0,g); s.scale.set(1.15,0.55,0.9);
  for (let i=0;i<7;i++){ const a=i/7*TAU; const p=mk(G.sph(0.17,8,6), sc, Math.cos(a)*0.32, 0.18, Math.sin(a)*0.25, g); p.scale.set(1,0.25,1); }
  mk(G.sph(0.4,14,8), M(0xd8c89a), 0,-0.02,0,g).scale.set(1.1,0.18,0.82);
  const head=mk(G.sph(0.16,12,8), skin, 0.72,0.04,0,g); head.scale.set(1.3,0.85,0.9); mk(G.sph(0.03,6,5), M(0x1a1a1a), 0.85,0.09,0.09,g); mk(G.sph(0.03,6,5), M(0x1a1a1a), 0.85,0.09,-0.09,g);
  const fl=[]; for (const [x,z,L] of [[0.35,0.42,0.6],[0.35,-0.42,0.6],[-0.42,0.3,0.32],[-0.42,-0.3,0.32]]){ const p=new THREE.Group(); p.position.set(x,0,z); g.add(p); const f=mk(G.sph(0.5,10,6), skin, 0,0,Math.sign(z)*L*0.5, p); f.scale.set(0.35*L,0.08,L*1.0); fl.push(p); }
  g.userData.flip=fl; return g; }
export function buildBigRay(){ const g=new THREE.Group(); buildFishInto(g, { t:'fish', c:0x34385a, c2:0xf0f0f8, l:1.3, s:'ray' }, 'velvetray'); g.scale.setScalar(2.4); return g; }
export function buildDolphin(){ const g=new THREE.Group(), sk=M(0x7a8ea0,{ roughness:0.35 }), bel=M(0xdfe6ec,{ roughness:0.4 });
  const pts=[]; for (let i=0;i<=16;i++){ const t=i/16; pts.push(new THREE.Vector2(Math.max(0.01, 0.32*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.05)),0.7)*(1-0.55*t)), 1.1-t*2.2)); }
  const b=new THREE.LatheGeometry(pts, 14); b.rotateZ(-Math.PI/2); const body=mk(b, sk, 0,0,0,g); body.scale.set(1,1,0.85);
  mk(G.cyl(0.05,0.08,0.4,8), sk, 1.25,-0.05,0,g).rotation.z=Math.PI/2;   // beak
  const df=mk(G.cone(0.2,0.42,6), sk, 0,0.38,0,g); df.rotation.z=-0.5; df.scale.z=0.25;
  for (const s of [1,-1]){ const fl=mk(G.cone(0.12,0.4,6), sk, 0.45,-0.18,s*0.25,g); fl.rotation.set(s*1.2,0,-1.2); fl.scale.z=0.3; }
  const tail=new THREE.Group(); tail.position.x=-1.1; g.add(tail); for (const s of [1,-1]){ const f=mk(G.cone(0.14,0.5,6), sk, -0.1,0,s*0.18,tail); f.rotation.set(s*1.3,0,0.3); f.scale.z=0.25; }
  mk(G.sph(0.25,10,6), bel, 0.4,-0.16,0,g).scale.set(2.4,0.6,0.9);
  g.userData.tail=tail; return g; }
// a seagull wheeling over the cays
export function buildGullFlyer(){ const g=new THREE.Group(), w=M(0xffffff), gr=M(0xb8bcc4); mk(G.sph(0.14,10,8), w, 0,0,0,g).scale.set(1.8,0.8,0.8); mk(G.sph(0.09,8,6), w, 0.26,0.05,0,g);
  mk(G.cone(0.03,0.12,5), M(0xf0c040), 0.38,0.04,0,g).rotation.z=-Math.PI/2; const wings=[]; for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.04,s*0.08); g.add(p); const f=mk(G.box(0.24,0.02,0.6), gr, 0,0,s*0.3,p); wings.push(p); }
  g.userData.wings=wings; return g; }

/* =====================================================================
   OLD PINEWOOD: Bramble's workshop, its building site, ferns, mist and the Grandfather Stump
   ===================================================================== */
// The workshop: a timber-framed shop with a steep mossy roof, big double doors, a lean-to wood shed and a sawhorse out front.
// Door faces +z. userData: door (relative), rects, chimney.
export function buildWorkshop(){
  const g=new THREE.Group(), W=6.4, D=4.6, H=2.7, beam=M(0x4a3226), plaster=tmat('plaster',0xf4ead6,2,1.2), wood=M(0x8a5e3a), dark=M(0x5a3e28);
  const base=tbox('stone', 0xa8a296, W+0.3, 0.5, D+0.3, 0.8); base.position.y=0.1; g.add(base);
  const walls=new THREE.Mesh(G.box(W,H,D), plaster); walls.position.y=0.35+H/2; walls.castShadow=walls.receiveShadow=true; g.add(walls);
  const front=new THREE.Group(); front.position.set(0,0.35,D/2+0.01); g.add(front);
  timberFace(front, W, 0, H, [{ x:-0.6, y:1.05, w:2.3, h:2.1, door:true }, { x:2.1, y:1.55, w:0.9, h:0.85 }], beam);
  for (const s of [-1,1]){ const side=new THREE.Group(); side.position.set(s*(W/2+0.01),0.35,0); side.rotation.y=s*Math.PI/2; g.add(side); timberFace(side, D, 0, H, [{ x:0, y:1.6, w:0.9, h:0.85 }], beam); window1(side, 0, 1.6, 0.02, { type:'cross', shut:0x5a7a4a, size:1.05 }); }
  const back=new THREE.Group(); back.position.set(0,0.35,-D/2-0.01); back.rotation.y=Math.PI; g.add(back); timberFace(back, W, 0, H, [], beam);
  window1(front, 2.1, 1.55, 0.02, { type:'cross', shut:0x5a7a4a, box:true, seed:2 });
  // big double barn doors, propped open a crack, with a warm lit inside
  { const dw=new THREE.Group(); dw.position.set(-0.6,0.35,D/2+0.02); g.add(dw); const dc=M(0x7a5236), dk=M(0x5a3a24);
    mk(G.box(2.3,2.15,0.04), new THREE.MeshStandardMaterial({ color:0x3a2616, emissive:0xffb060, emissiveIntensity:0.08 }), 0,1.08,-0.02,dw);
    for (const s of [-1,1]){ const leaf=new THREE.Group(); leaf.position.set(s*1.12,0,0.02); leaf.rotation.y=-s*0.32; dw.add(leaf);
      mk(G.box(1.1,2.08,0.08), dc, -s*0.55,1.04,0,leaf); for (const yy of [0.35,1.04,1.73]) mk(G.box(1.04,0.1,0.1), dk, -s*0.55,yy,0.05,leaf);
      const zb=mk(G.box(0.1,1.4,0.1), dk, -s*0.55,0.7,0.06,leaf); zb.rotation.z=s*0.62; mk(G.tor(0.07,0.015,5,10), M(0x2e2824,{ metalness:0.4 }), -s*0.15,1.0,0.1,leaf); }
    mk(G.box(2.6,0.14,0.2), beam, 0,2.2,0.04,dw); }
  // steep mossy roof, gable to the front, with a little hayloft door
  const roofH=cottageRoof(g, { style:'mossy', L:D, S:W, y:0.35+H, c:0x6a5040, trim:0x5a3e28, moss:0.85, seed:41, timber:true, beamC:0x4a3226, gableMat:plaster, loft:true, ridgeZ:true, over:0.5 });
  const ch=chimney1(g, W/2-1.0, -D/2+0.9, 0.35+H, 0.35+H+roofH+0.6, 'stone', 0.05);
  // the lean-to wood shed down the right side, stacked with logs
  { const sh=new THREE.Group(); sh.position.set(W/2+0.95,0,0); g.add(sh); for (const z of [-D/2+0.2, D/2-0.2]) for (const x of [-0.75,0.75]) mk(G.box(0.12,2.0-(x>0?0.5:0),0.12), wood, x,(2.0-(x>0?0.5:0))/2,z,sh);
    const rf=mk(G.box(1.9,0.08,D+0.2), tmat('shingle',0x6a5040,2,3), 0,1.78,0,sh); rf.rotation.z=-0.27;
    for (let row=0;row<4;row++) for (let i=0;i<9-row;i++){ const l=mk(G.cyl(0.13,0.13,1.2,8), M(i%2?0x9a6a40:0x8a5a34), -0.05, 0.14+row*0.25, -D/2+0.5+(i+row*0.5)*0.42, sh); l.rotation.z=Math.PI/2; mk(G.cyl(0.11,0.11,0.01,8), M(0xd8b080), 0.56, l.position.y, l.position.z, sh).rotation.z=Math.PI/2; } }
  // out front: a sawhorse with a log on it, a chopping block with an axe, a plank stack
  { const sx=1.4, sz=D/2+1.6; for (const k of [-0.45,0.45]){ for (const s of [-1,1]){ const lg=mk(G.box(0.07,0.8,0.07), wood, sx+k, 0.38, sz+s*0.18, g); lg.rotation.x=s*0.35; } }
    mk(G.box(1.2,0.08,0.1), dark, sx, 0.72, sz, g); const lg=mk(G.cyl(0.16,0.17,1.5,10), M(0x9a6a40), sx, 0.92, sz, g); lg.rotation.z=Math.PI/2; mk(G.cyl(0.14,0.14,0.01,10), M(0xd8b080), sx+0.76, 0.92, sz, g).rotation.z=Math.PI/2;
    const cb=mk(G.cyl(0.3,0.34,0.5,12), M(0x8a5e3a), -2.6, 0.25, D/2+1.3, g); mk(G.cyl(0.29,0.29,0.01,12), M(0xd8b080), -2.6, 0.505, D/2+1.3, g);
    const ax=new THREE.Group(); ax.position.set(-2.55,0.5,D/2+1.3); ax.rotation.set(0.2,0.4,-0.5); g.add(ax); mk(G.cyl(0.025,0.03,0.7,6), M(0xa8754a), 0,0.32,0,ax); mk(G.box(0.05,0.14,0.2), M(0x8a9098,{ metalness:0.6, roughness:0.4 }), 0,0.62,0.07,ax);
    const pine=tmat('board',0xd8b07a,1,0.2); for (let i=0;i<5;i++){ const p=new THREE.Mesh(G.box(1.8,0.07,0.24), pine); p.position.set(-2.2, 0.04+i*0.075, D/2+0.55+(i%2)*0.03); p.castShadow=p.receiveShadow=true; g.add(p); } }
  wallLantern(front, -2.25, 2.0, 0.02); wallLantern(front, 1.1, 2.0, 0.02);
  hangingSign(g, 1.2, 2.45, D/2+0.02, 'Workshop', '#f4e6c8', '#5b4336', Math.PI);
  ivy(back, 1.2, 1.8, 1.6, 7); mossTop(g, -W/2+0.3, 0.38, D/2+0.2, 0.8, 0.3, 3, 5);
  barrel1(g, W/2+0.4, D/2+0.6, 0x8a5a34);
  mergeStatic(g);
  g.userData.door=[-0.6, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-W/2-0.2,-D/2-0.2,W/2+1.95,D/2+0.2]]; g.userData.chimney=ch; return g; }
// before it's built: stakes and string marking out the floor, a stack of logs, and a hand-painted sign
export function buildWorkshopSite(){
  const g=new THREE.Group(), W=6.4, D=4.6, wood=M(0x9a7048), str=new THREE.LineBasicMaterial({ color:0xf4f0e0 });
  const corners=[[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]]; for (const [x,z] of corners){ mk(G.box(0.07,0.6,0.07), wood, x,0.3,z,g); mk(G.box(0.04,0.04,0.12), M(0xe2483d), x,0.55,z,g); }
  const pts=[...corners, corners[0]].map(([x,z])=>new THREE.Vector3(x,0.5,z)); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), str));
  for (let row=0;row<3;row++) for (let i=0;i<5-row;i++){ const l=mk(G.cyl(0.15,0.15,1.6,8), M(i%2?0x9a6a40:0x8a5a34), 0.6+(i-(4-row)/2)*0.32, 0.16+row*0.27, -0.6, g); l.rotation.x=Math.PI/2; }
  const sp=new THREE.Group(); sp.position.set(-1.8,0,D/2+0.9); g.add(sp); mk(G.box(0.08,1.2,0.08), wood, 0,0.6,0,sp);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const x=cv.getContext('2d'); x.fillStyle='#f4e6c8'; x.fillRect(0,0,256,128); x.fillStyle='#5b4336'; x.font='700 30px Fredoka, sans-serif'; x.textAlign='center'; x.fillText('Future home of',128,46); x.font='700 36px Fredoka, sans-serif'; x.fillText('the Workshop!',128,92);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; mk(G.box(0.9,0.46,0.05), new THREE.MeshStandardMaterial({ map:t, roughness:0.85 }), 0,1.1,0.05,sp);
  g.userData.door=[0, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-0.4,-1.0,1.6,-0.2]]; return g; }
// the landmark on Old Pinewood: a huge old pine stump, mossy, with rings you could count for an afternoon
export function buildGrandfatherStump(){
  const g=new THREE.Group(), bark=M(0x6a4a32,{ roughness:0.95 }), top=M(0xd8b48a), ring=M(0xb8946a), moss=M(0x5f8a3e);
  const geo=new THREE.CylinderGeometry(1.7,2.3,1.6,20,3); displaceGeo(geo, v=>{ const a=Math.atan2(v.z,v.x); const k=1+0.08*Math.sin(a*7)+0.05*Math.sin(a*13); v.x*=k; v.z*=k; });
  mk(geo, bark, 0,0.8,0,g); mk(G.cyl(1.62,1.62,0.04,24), top, 0,1.61,0,g);
  for (let i=1;i<9;i++) mk(G.tor(i*0.18,0.012,4,32), ring, 0,1.635,0,g).rotation.x=Math.PI/2;
  for (let i=0;i<6;i++){ const a=i/6*TAU+0.3, rt=mk(G.cyl(0.18,0.34,1.6,8), bark, Math.cos(a)*2.2, 0.15, Math.sin(a)*2.2, g); rt.rotation.set(Math.sin(a)*0.9, 0, -Math.cos(a)*0.9); }
  for (let i=0;i<14;i++){ const a=i*2.1, d=1.1+((i*7)%5)*0.12; const m=mk(G.ico(0.22,1), moss, Math.cos(a)*d, 1.64, Math.sin(a)*d, g); m.scale.y=0.35; }
  for (let i=0;i<5;i++){ const a=i*1.3; mk(G.sph(0.09,8,6), M(0xe8e0c8), Math.cos(a)*2.4, 0.5+i*0.08, Math.sin(a)*2.4, g); mk(G.cyl(0.03,0.03,0.1,5), M(0xf4f0e0), Math.cos(a)*2.4, 0.42+i*0.08, Math.sin(a)*2.4, g); }   // little mushrooms on the roots
  mergeStatic(g);
  g.userData.desc='The Grandfather Stump. Whoever cut this pine down did it a very long time ago, and the forest grew back around it. Bramble says you could count the rings for an afternoon and not be done.';
  g.userData.rects=[[-2.4,-2.4,2.4,2.4]]; return g; }
// a fern: a fan of arching fronds (one geometry, instanced)
export function fernGeo(){ const p=[], ix=[]; const fr=7;
  for (let f=0;f<fr;f++){ const a=f/fr*TAU, ca=Math.cos(a), sa=Math.sin(a), seg=6;
    for (let s=0;s<=seg;s++){ const t=s/seg, r=t*0.75, y=Math.sin(t*Math.PI*0.75)*0.42, w=0.12*Math.sin(Math.PI*Math.min(1,t*1.1+0.05));
      p.push(ca*r - sa*w, y, sa*r + ca*w,  ca*r + sa*w, y, sa*r - ca*w); }
    const b=f*(seg+1)*2; for (let s=0;s<seg;s++){ const i=b+s*2; ix.push(i,i+1,i+2, i+1,i+3,i+2); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p,3)); g.setIndex(ix); g.computeVertexNormals(); return g; }
let _mistTex=null;
export function mistTex(){ if (_mistTex) return _mistTex; const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d'), gr=x.createRadialGradient(64,64,4,64,64,62);
  gr.addColorStop(0,'rgba(255,255,255,0.55)'); gr.addColorStop(0.5,'rgba(255,255,255,0.22)'); gr.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gr; x.fillRect(0,0,128,128);
  _mistTex=new THREE.CanvasTexture(cv); return _mistTex; }
