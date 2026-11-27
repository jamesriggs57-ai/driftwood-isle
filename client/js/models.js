// 3D model builders. Everything is made from simple shapes so it stays light and easy to change.
import * as THREE from 'three';
import { TAU, hash2, mulberry32 } from './util.js';
import { ITEMS, PLANTS } from './content.js';
import { canopyGeo, coniferGeo, trunkGeo, frondsGeo, foliageMat, barkMat, leafy, treeTint } from './trees.js';
import * as CR from './critters.js';
import * as C2 from './critters2.js';
import * as CH from './chars.js';
const buildFossilInto=CR.buildFossilInto;
import { buildFossil2Into } from './fossils2.js';
// v1.65: every fossil is built once and handed out as copies that share its shapes and paints (the wave 2 ones take a few
// milliseconds each to carve, and the museum, the bag icon and the dig drop all want one)
const FOSSIL_TPL = new Map();
function fossilInto(g, id, d){
  let t=FOSSIL_TPL.get(id);
  if (!t){ t=new THREE.Group(); if (!buildFossil2Into(t, d)) buildFossilInto(t, d); t.traverse(o=>{ if (o.geometry) o.geometry.userData.shared=true; }); FOSSIL_TPL.set(id, t); }
  for (const c of t.children) g.add(c.clone());
}
import { felt, knit, eyeMat, noseMat, glintMat, threadMat, fabricMat, fishSkin, fishLook, finMat, wingTex, wingLook, clearWingMat, shellMat, fuzzMat, woodMat, glassMat, brass, ceramic, waterMat2 } from './look.js';

export const MODEL = { season:'autumn', month:11 };

/* ---------- Materials & helpers ---------- */
const MATS = new Map();
// Characters get their own materials, so weather effects on buildings (snow) never land on people and animals
let CHAR = 0;
export const charMats = on => { CHAR = Math.max(0, CHAR + (on ? 1 : -1)); };
export function M(color, o){ const k=(CHAR?'c':'s')+color+(o?JSON.stringify(o):''); if(!MATS.has(k)){ const m=new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.8 }, o||{})); if(CHAR) m.userData.char=true; MATS.set(k, m); } return MATS.get(k); }
export const asChar = fn => (...a) => { charMats(true); try { return fn(...a); } finally { charMats(false); } };
export function MF(color, o){ const k=(CHAR?'cf':'f')+color+(o?JSON.stringify(o):''); if(!MATS.has(k)){ const m=new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.9, flatShading:true }, o||{})); if(CHAR) m.userData.char=true; MATS.set(k, m); } return MATS.get(k); }
export function mk(geo, mat, x=0, y=0, z=0, parent){ const m=new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; if(parent) parent.add(m); return m; }
export const G = {
  sph:(r,w=16,h=12,...a)=>new THREE.SphereGeometry(r,w,h,...a), ico:(r,d=0)=>new THREE.IcosahedronGeometry(r,d), box:(x,y,z)=>new THREE.BoxGeometry(x,y,z),
  cyl:(a,b,h,s=12)=>new THREE.CylinderGeometry(a,b,h,s), cone:(r,h,s=12)=>new THREE.ConeGeometry(r,h,s), dod:(r)=>new THREE.DodecahedronGeometry(r,0),
  cap:(r,l,cs=6,rs=12)=>new THREE.CapsuleGeometry(r,l,cs,rs), tor:(r,t,rs=8,ts=16,arc=TAU)=>new THREE.TorusGeometry(r,t,rs,ts,arc),
};
const OUTLINE = new THREE.MeshBasicMaterial({ color:0x3a2a22, side:THREE.BackSide });
export function outline(mesh, s=1.045){ const o=new THREE.Mesh(mesh.geometry, OUTLINE); o.scale.setScalar(s); o.castShadow=false; o.receiveShadow=false; o.userData.outline=true; mesh.add(o); return mesh; }
export const windowMat = new THREE.MeshStandardMaterial({ color:0xfff0c0, emissive:0xffc865, emissiveIntensity:0, roughness:0.3 });
export const glowMats = [];
export function glowMat(c){ const m=new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:0.2, roughness:0.5 }); glowMats.push(m); return m; }
const glowTex = (()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,225,160,1)'); g.addColorStop(0.4,'rgba(255,195,120,.45)'); g.addColorStop(1,'rgba(255,170,90,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; })();
export const glowSprites = [];
export function addGlow(parent, y, s=2.2, color=0xffd08a){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex, color, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false, opacity:0 })); sp.position.y=y; sp.scale.set(s,s,1); parent.add(sp); glowSprites.push(sp); return sp; }
export function textSprite(text, color='#5b4336', bg='rgba(255,248,234,.95)', size=1){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=128; const x=cv.getContext('2d');
  x.fillStyle=bg; x.beginPath(); x.arc(64,64,52,0,TAU); x.fill(); x.lineWidth=6; x.strokeStyle='#e7d1a6'; x.stroke();
  x.fillStyle=color; x.font='700 64px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,64,68);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false, transparent:true })); sp.scale.set(size,size,1); sp.renderOrder=10; return sp;
}
function canvasTex(w,h,draw,repeat){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d')); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; if(repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...repeat); } return t; }
const hex = c => '#'+new THREE.Color(c).getHexString();

export const PALETTE = {
  spring:{ grass:[0x8ed36a,0x7cc65a,0xa2de78], flower:[0xffb6c9,0xffffff,0xffe066,0xc7a0ff] },
  summer:{ grass:[0x6cc050,0x5fb447,0x80cc5e], flower:[0xff7f7f,0xffffff,0xffd04d,0x8fb0ff] },
  autumn:{ grass:[0x9cc45e,0x8dba55,0xb3c968], flower:[0xffb347,0xfff1c4,0xe8743c] },
  winter:{ grass:[0xa7b38c,0x9eaa84,0xb1ba94], flower:[] },   // dormant grass; snow piles on top of it (main.js snow buildup)
};
const LEAVES = {
  oak:{ spring:[0x7ccf5c,0x8ad866,0x6cc050], summer:[0x4fae46,0x5cba4e,0x45a040], autumn:[0xe8913a,0xd8642e,0xf0a83a] },
  birch:{ spring:[0x9ad870,0xb0e080], summer:[0x78c050,0x88cc5a], autumn:[0xf0c840,0xf8d860,0xe8b830] },
  maple:{ spring:[0x8ad060,0x9ad870], summer:[0x5aae46,0x4c9e40], autumn:[0xd83a2a,0xe8502e,0xc02a2a] },
  blossom:{ spring:[0xf8b8d0,0xffd0e0,0xf8a0c0], summer:[0x5aae46,0x68ba50], autumn:[0xe89040,0xd8a050] },
  fruit:{ spring:[0x7ccf5c,0x8ad866], summer:[0x4fae46,0x5cba4e], autumn:[0x8ab040,0xb8b040,0x9ab848] },
};

/* ---------- Plants ---------- */
export function buildTree(r, type, opt={}){
  const g=new THREE.Group(), top=new THREE.Group(); g.add(top); g.userData.top=top; const fruits=[]; g.userData.fruits=fruits;
  const stage = opt.stage===undefined ? 3 : opt.stage, season=MODEL.season;
  if (stage===0) { buildSaplingInto(top, type); return g; }
  const S=[0,0.42,0.7,1][stage]; top.scale.setScalar(S);
  const tint=treeTint(r), size=0.9+r()*0.25;
  const barkC = tone2(type==='birch'?0xf4f0e8:type==='palm'?0xb89468:0x8a6040, r);
  if (type==='palm'){
    const h=3.9*size, lean=[0.6+r()*0.5, (r()-0.5)*0.6];
    const tr=new THREE.Mesh(trunkGeo({ h, r0:0.2, r1:0.14, bend:lean, color:barkC }, r), barkMat(false)); tr.castShadow=tr.receiveShadow=true; top.add(tr);
    for (let i=1;i<9;i++){ const t=i/9; const ring=mk(G.tor(0.18-t*0.05,0.025,5,12), M(0x8a6a44), lean[0]*t*t, t*h, lean[1]*t*t, top); ring.rotation.x=Math.PI/2; ring.castShadow=false; }
    const tp=new THREE.Vector3(lean[0],h,lean[1]);
    top.add(leafy(new THREE.Mesh(frondsGeo(tp, 9, 2.3*size, season==='winter'?[0x5a9a50,0x6aa858]:[0x4fae46,0x5fbe52,0x6ac25a], r, tint), foliageMat('frond')), foliageMat('frond')));
    // v1.26: coconuts hang lower, bigger and a touch lighter so they show under the big fronds
    if (stage===3 && opt.fruit) for(let i=0;i<3;i++){ const a=i/3*TAU+0.4, cx=tp.x+Math.cos(a)*0.36, cz=tp.z+Math.sin(a)*0.36;
      const nut=outline(mk(G.sph(0.31,14,12), M(0x9a6232,{roughness:0.8}), cx, h-0.62, cz, top),1.1); nut.scale.set(1,1.12,1);
      mk(G.cyl(0.035,0.05,0.3,6), M(0x6a7a3a), -Math.cos(a)*0.06, 0.38, -Math.sin(a)*0.06, nut).castShadow=false;
      fruits.push(nut); }
    return g;
  }
  if (type==='pine' || type==='cedar'){
    const pine=type==='pine', h=(pine?1.6:1.4)*size;
    const tr=new THREE.Mesh(trunkGeo({ h:h+1.2, r0:0.24, r1:0.06, bend:[(r()-0.5)*0.25,(r()-0.5)*0.25], color:tone2(0x7a5232,r), flare:true }, r), barkMat(false)); tr.castShadow=tr.receiveShadow=true; top.add(tr);
    const tiers=[]; const n=pine?4:6; for (let i=0;i<n;i++){ const t=i/(n-1); tiers.push(pine ? [h+0.2+i*0.85*size, (1.75-t*1.3)*size, 1.5*size] : [h+i*0.55*size, (1.3-t*0.95)*size, 0.95*size]); }
    const pal = pine ? [0x2f7a44,0x3f8f4e,0x4a9a58] : [0x26684a,0x2f7a50,0x3a8a5a];
    top.add(leafy(new THREE.Mesh(coniferGeo(tiers, pal, r, tint), foliageMat('needle')), foliageMat('needle')));
    return g;
  }
  // deciduous
  const tall=(type==='birch'?2.4:1.8)*size, bend=[(r()-0.5)*0.5,(r()-0.5)*0.5];
  const pal=(LEAVES[type]||LEAVES.oak)[season];
  let crowns=null;
  if (pal){
    const base = type==='birch' ? [[0,tall+1.25,0,0.85],[0.42,tall+0.45,0.22,0.78],[-0.4,tall+0.55,-0.22,0.8]]
      : (r()<0.5 ? [[0,tall+1.55,0,1.15],[0.95,tall+0.6,0.35,1.05],[-0.85,tall+0.65,-0.35,1.1],[-0.15,tall+0.6,0.95,1.0]]
               : [[0,tall+1.6,-0.1,1.1],[0.9,tall+0.7,0.4,1.05],[-0.9,tall+0.65,-0.2,1.05],[0.05,tall+0.55,1.0,0.95],[0.25,tall+0.6,-0.95,0.95]]);
    const rot=r()*TAU; crowns=base.map(([x,y,z,s],i)=>{ const c=Math.cos(rot), sn=Math.sin(rot), k=i?0.85+r()*0.35:1; return [ (x*c-z*sn)*size+bend[0]+(r()-0.5)*0.2, y+(r()-0.5)*0.25, (x*sn+z*c)*size+bend[1]+(r()-0.5)*0.2, s*size*k ]; });
  }
  const nb = pal ? 0 : 7, branches=[];
  for (let i=0;i<nb;i++) branches.push([tall*(0.45+i/nb*0.5), i/nb*TAU*2.3+r()*0.8, 0.9+r()*0.5, 0.5+r()*0.6]);
  // leafy trees: one branch into the middle of each outer clump, ending well inside it so no wood shows between clumps
  const trunkH = tall+(pal?0.9:0.9);
  if (pal) for (const [cx,cy,cz,cs] of crowns.slice(1)){ const by=tall*0.72, t=by/trunkH, sx=bend[0]*t*t, sz=bend[1]*t*t;
    const dx=cx-sx, dz=cz-sz, Hd=Math.hypot(dx,dz)*0.8, Vd=(cy-cs*0.15-by)*0.8, ang=Math.atan2(dz,dx);
    let lo=-1, hi=4; for (let k=0;k<30;k++){ const up=(lo+hi)/2, v=Hd*up+0.25*Hd*Math.sqrt(1+up*up); if (v>Vd) hi=up; else lo=up; }
    const up=(lo+hi)/2; branches.push([by, ang, Hd*Math.sqrt(1+up*up), up]); }
  const tr=new THREE.Mesh(trunkGeo({ h:trunkH, r0:type==='birch'?0.2:0.3, r1:pal?0.12:0.035, rb:0.12, bend, color:barkC, branches, flare:true, twigs:!pal }, r), barkMat(type==='birch')); tr.castShadow=tr.receiveShadow=true; top.add(tr);
  if (!pal){ // winter: bare branches; the snow pass dusts their tops
    if (opt.fruit && stage===3){ const fm=M(ITEMS[opt.fruit].model.c); for(let i=0;i<6;i++){ const a=i/6*TAU+r()*0.4; fruits.push(hangFruit(top, fm, Math.cos(a)*0.85+bend[0], tall+0.55+(i%2)*0.35, Math.sin(a)*0.85+bend[1], opt.fruit)); } }
    return g;
  }
  const kind = type==='birch' ? 'small' : (type==='blossom'&&season==='spring') ? 'blossom' : 'broad';
  top.add(leafy(new THREE.Mesh(canopyGeo(crowns, pal, r, tint, { density:type==='birch'?40:32, card:type==='birch'?0.72:0.95, kind }), foliageMat(kind)), foliageMat(kind)));
  if (opt.fruit && stage===3){ const fm=M(ITEMS[opt.fruit].model.c);
    const outer=crowns.slice(1); for(let i=0;i<6;i++){ const [x,y,z,s]=outer[i%outer.length]; let dx=x-bend[0]+(r()-0.5)*0.6, dz=z-bend[1]+(r()-0.5)*0.6; if(Math.hypot(dx,dz)<0.3){ const a=i/6*TAU; dx=Math.cos(a); dz=Math.sin(a); }
      const L=Math.hypot(dx,dz); const dy=-0.3-r()*0.3; const n=Math.hypot(dx/L,dy,dz/L); const ux=dx/L/n, uy=dy/n, uz=dz/L/n; const rr=s*1.08;
      fruits.push(hangFruit(top, fm, x+ux*rr, y+uy*rr*0.9, z+uz*rr, opt.fruit)); } }
  return g;
}
const tone2=(hex,r)=>new THREE.Color(hex).offsetHSL((r()-0.5)*0.03,(r()-0.5)*0.1,(r()-0.5)*0.08).getHex();
function hangFruit(parent, mat, x, y, z, id){
  const d=ITEMS[id].model, f=new THREE.Group(); f.position.set(x,y,z); parent.add(f);
  const b=outline(mk(G.sph(0.25,14,10), mat, 0,0,0,f), 1.1); if(d.pear) b.scale.set(0.9,1.2,0.9);
  if (d.cherry){ b.scale.setScalar(0.75); mk(G.sph(0.16,10,8), mat, 0.14,-0.05,0.05,f); }
  mk(G.cyl(0.02,0.02,0.16,4), M(0x5a4a2a), 0,0.24,0,f).castShadow=false;
  const lf=mk(G.sph(0.07,6,4), M(0x5fae43), 0.07,0.27,0,f); lf.scale.set(1.5,0.4,0.8); lf.castShadow=false;
  return f;
}
function buildSaplingInto(g, type){
  mk(G.cyl(0.25,0.32,0.12,10), M(0x7a5a3a), 0,0.05,0,g);
  mk(G.cyl(0.03,0.05,0.8,6), M(type==='birch'?0xeee8e0:0x8a5e3a), 0,0.45,0,g);
  const lc = (type==='pine'||type==='cedar') ? 0x3f8f4e : 0x6cc050;
  if (type==='pine'||type==='cedar') mk(G.cone(0.3,0.6,8), M(lc), 0,0.8,0,g);
  else for(let i=0;i<4;i++){ const a=i/4*TAU; const l=mk(G.sph(0.14,8,6), M(lc), Math.cos(a)*0.12,0.75+i*0.05,Math.sin(a)*0.12,g); l.scale.set(1.3,0.5,0.8); l.rotation.y=-a; }
}
/* A big ugly clump of weeds: scraggly blades in sick greens and dead browns, a dandelion gone to seed,
   a thistle, burrs. Seeded so each clump on the ground looks a bit different. */
export function buildWeedClump(seed=1, s=1){
  let q=seed*9301+49297; const r=()=>{ q=(q*16807)%2147483647; return q/2147483647; };
  const g=new THREE.Group(), cols=[0x6a8a2a,0x7a9a30,0x8a8a2a,0x5a7a28,0x9a8a3a,0x8a6a2a,0xa08040];
  const n=16+Math.floor(r()*8);
  for (let i=0;i<n;i++){ const a=r()*Math.PI*2, d=r()*0.32*s, h=(0.35+r()*0.55)*s, dead=r()<0.3;
    const b=mk(G.cone(0.035*s+r()*0.03*s, h, 4), MF(dead?cols[5+Math.floor(r()*2)]:cols[Math.floor(r()*5)]), Math.cos(a)*d, h/2, Math.sin(a)*d, g);
    b.rotation.set(Math.cos(a)*(0.35+r()*0.7), r()*3, Math.sin(a)*(0.35+r()*0.7)); b.castShadow=false; }
  // broad flat leaves sprawled on the ground (dock/plantain), a bit chewed
  for (let i=0;i<5;i++){ const a=i/5*Math.PI*2+r(); const l=mk(G.sph(0.16*s,6,4), MF(i%2?0x6a7a2a:0x7a8a34), Math.cos(a)*0.28*s, 0.03*s, Math.sin(a)*0.28*s, g); l.scale.set(1.6,0.18,0.6); l.rotation.y=-a; l.castShadow=false; }
  // a dandelion gone to seed
  if (r()<0.85){ const h=(0.7+r()*0.3)*s; const st=mk(G.cyl(0.012*s,0.016*s,h,4), M(0x7a9a3a), 0.08*s, h/2, -0.05*s, g); st.rotation.z=-0.12;
    const puffM=new THREE.MeshStandardMaterial({ color:0xf4f2ea, roughness:1, transparent:true, opacity:0.85 }); mk(G.sph(0.11*s,10,8), puffM, 0.08*s+h*0.12, h, -0.05*s, g).castShadow=false; }
  // a scruffy thistle
  if (r()<0.7){ const h=(0.55+r()*0.3)*s, x=-0.12*s, z=0.1*s; mk(G.cyl(0.014*s,0.02*s,h,4), M(0x6a8a3a), x, h/2, z, g);
    mk(G.sph(0.06*s,7,5), MF(0x6a8a3a), x, h, z, g); const top=mk(G.cone(0.05*s,0.1*s,7), MF(0xa060b8), x, h+0.07*s, z, g); top.rotation.x=Math.PI; }
  // burrs
  for (let i=0;i<4;i++) mk(G.ico(0.03*s,0), MF(0x8a6a3a), (r()-0.5)*0.4*s, (0.15+r()*0.3)*s, (r()-0.5)*0.4*s, g);
  // a little dirt mound under it all
  const dirt=mk(G.sph(0.42*s,10,6), MF(0x6a5038), 0, -0.02, 0, g); dirt.scale.set(1,0.14,1); dirt.castShadow=false;
  return g; }
export function buildStump(){ const g=new THREE.Group(); mk(G.cyl(0.32,0.42,0.35,12), M(0x8a5e3a), 0,0.17,0,g); mk(G.cyl(0.3,0.3,0.02,12), M(0xd8b080), 0,0.35,0,g); for(let i=0;i<3;i++){ const a=i/3*TAU; const r=mk(G.cyl(0.06,0.1,0.45,6), M(0x7a5232), Math.cos(a)*0.38,0.06,Math.sin(a)*0.38,g); r.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2); } return g; }
export function buildShrub(sp, stage=3, color){
  const g=new THREE.Group(), P=PLANTS[sp]; const s=[0.35,0.55,0.8,1][stage];
  const body=new THREE.Group(); body.scale.setScalar(s); g.add(body);
  const lc = sp==='boxwood'?0x4a9a4c : sp==='holly'?0x3a8a44 : 0x5aae4c;
  const blobs=[[0,0.5,0,0.55],[0.42,0.4,0.1,0.42],[-0.4,0.42,-0.05,0.45],[0.05,0.42,0.42,0.4],[0,0.45,-0.4,0.4]];
  const sr=mulberry32(sp.length*131+stage), lc2=new THREE.Color(lc).offsetHSL(0.02,0,0.06).getHex();
  body.add(leafy(new THREE.Mesh(canopyGeo(blobs, [lc,lc2], sr, treeTint(sr), { density:60, card:0.9 }), foliageMat('broad')), foliageMat('broad')));
  const blooming = stage>=2 && P.bloom && P.bloom.includes(MODEL.month) && P.colors.length;
  if (blooming){ const c=color||P.colors[0]; const rr=mulberry32(sp.length*31);
    for(let i=0;i<(P.berries?12:16);i++){ const a=rr()*TAU, e=rr()*1.1; const p=new THREE.Vector3(Math.cos(a)*Math.cos(e)*0.62, 0.45+Math.sin(e)*0.55, Math.sin(a)*Math.cos(e)*0.62);
      mk(P.berries?G.sph(0.06,8,6):G.ico(sp==='hydrangea'||sp==='lilac'?0.16:0.1,1), M(c), p.x,p.y,p.z,body).castShadow=false; } }
  return g;
}
export const FLOWER_SHAPES = {};   // v1.44: extra flower heads by shape name, filled in by shoprare-models.js
export function petalRing(g, n, len, wid, tilt, color, y, thick=0.02, mat){ for(let i=0;i<n;i++){ const a=i/n*TAU; const p=new THREE.Group(); p.position.y=y; p.rotation.y=a; g.add(p); const m=mk(G.sph(0.5,10,6), mat||M(color), 0,0,len*0.5,p); m.scale.set(wid,thick,len); m.rotation.x=-tilt; m.position.y=Math.sin(tilt)*len*0.5; m.position.z=Math.cos(tilt)*len*0.5; m.castShadow=false; } }
export function buildFlower(sp, stage=3, color){
  const g=new THREE.Group(), P=PLANTS[sp]; const c=color!==undefined?color:P.colors[0];
  if (stage===0){ const m=mk(G.sph(0.22,10,6), M(0x7a5a3a), 0,0,0,g); m.scale.y=0.35; return g; }
  const tall = P.tall || (P.shape==='sun' ? 1.0 : (P.shape==='lav'||P.shape==='spike'?0.5:0.42));
  const h = stage===1 ? 0.15 : (stage===2 ? tall*0.75 : tall);
  const stem=M(0x4f9a3a);
  for(const s of [1,-1]){ const l=mk(G.sph(0.09,8,4), stem, s*0.07,0.06,0,g); l.scale.set(1.6,0.25,0.6); l.rotation.z=s*0.4; l.castShadow=false; }
  if (stage===1) return g;
  if (P.shape!=='lav') mk(G.cyl(0.014,0.018,h,5), stem, 0,h/2,0,g).castShadow=false;
  if (stage===2){ mk(G.sph(0.06,8,6), M(c), 0,h+0.03,0,g).scale.y=1.5; return g; }
  const head=new THREE.Group(); head.position.y=h; g.add(head);
  switch(P.shape){
    case 'cup': petalRing(head,5,0.13,0.11,1.25,c,0,0.05); mk(G.sph(0.03,6,5),M(0x2a2a1a),0,0.02,0,head); break;
    case 'rose': mk(G.sph(0.06,10,8),M(c),0,0.03,0,head); petalRing(head,5,0.09,0.1,1.0,c,0,0.04); petalRing(head,6,0.13,0.11,0.6,c,0,0.03); break;
    case 'daisy': petalRing(head,12,0.13,0.05,0.15,c,0); mk(G.sph(0.045,8,6),M(0xf8c020),0,0.01,0,head).scale.y=0.6; head.rotation.x=0.3; break;
    case 'sun': petalRing(head,16,0.2,0.07,0.2,c,0); mk(G.cyl(0.11,0.11,0.05,14),M(0x5a3a1a),0,0.01,0,head); head.rotation.x=0.9; break;
    case 'star': for(let i=0;i<6;i++){ const a=i/6*TAU; const p=mk(G.cone(0.05,0.18,6),M(c),Math.cos(a)*0.07,0.05,Math.sin(a)*0.07,head); p.rotation.set(Math.sin(a)*1.1,0,-Math.cos(a)*1.1); p.castShadow=false; } break;
    case 'flat': petalRing(head,5,0.1,0.11,0.35,c,0); mk(G.sph(0.025,6,5),M(0xf8d040),0,0.02,0,head); head.rotation.x=0.8; break;
    case 'spike': for(let i=0;i<14;i++){ const a=i*2.4; mk(G.sph(0.04,6,5),M(c),Math.cos(a)*0.05,-0.05+i*0.017,Math.sin(a)*0.05,head).castShadow=false; } break;
    case 'lav': for(let k=0;k<4;k++){ const a=k/4*TAU; const sx=Math.cos(a)*0.04, sz=Math.sin(a)*0.04; mk(G.cyl(0.01,0.012,0.38,4),stem,sx,0.19,sz,g); for(let i=0;i<5;i++) mk(G.sph(0.028,6,4),M(c),sx,0.34+i*0.04,sz,g).castShadow=false; } break;
    case 'bell': for(let i=0;i<3;i++){ const b=mk(G.cone(0.05,0.08,8,1,true),M(c),0.06*(i-1),-0.04-i*0.02,0.02,head); b.rotation.x=Math.PI; b.castShadow=false; } break;
    case 'pom': mk(G.ico(0.08,1),M(c),0,0.02,0,head); for(let i=0;i<8;i++){ const a=i/8*TAU; mk(G.ico(0.04,0),M(c),Math.cos(a)*0.07,0.01,Math.sin(a)*0.07,head); } break;
    default: if (FLOWER_SHAPES[P.shape]) FLOWER_SHAPES[P.shape](head, c, P, g, h);   // v1.44 Sprig's rare flowers (shoprare-models.js)
  }
  return g;
}

// v1.29 a wild clump: a few blooms of one species at slightly different heights and tilts, with a leafy base
export function buildWildFlower(sp, color, seed=1){
  let s=(seed*2654435761)>>>0; const r=()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const g=new THREE.Group(), n=3+Math.floor(r()*3), leaf=M(0x5aa040); g.scale.setScalar(1.3);   // a touch bigger than the scenery flowers so you can tell which ones you can pick
  for (let i=0;i<n;i++){ const a=i/n*TAU+r()*0.8, d=i===0?0:0.1+r()*0.1, f=buildFlower(sp, 3, color);
    f.position.set(Math.cos(a)*d, 0, Math.sin(a)*d); f.rotation.set((r()-0.5)*0.35, r()*TAU, (r()-0.5)*0.35); f.scale.setScalar(i===0?1.15:0.8+r()*0.3); g.add(f); }
  for (let i=0;i<5;i++){ const a=i/5*TAU+r(), l=mk(G.sph(0.1,8,4), leaf, Math.cos(a)*0.12, 0.04, Math.sin(a)*0.12, g); l.scale.set(1.5,0.25,0.6); l.rotation.y=-a; l.castShadow=false; }
  return g;
}

/* ---------- Item models (used in the world and for bag icons) ---------- */
export function buildItemModel(id){
  const it=ITEMS[id], d=it.model, g=new THREE.Group();
  if (d.t==='fruit'){ if(d.cherry){ for(const s of [-1,1]) mk(G.sph(0.16,12,10),M(d.c),s*0.13,0.16,0,g); const st=mk(G.cyl(0.015,0.015,0.4,5),M(0x5a7a2a),0,0.36,0,g); return g; }
    const r=d.big?0.34:0.27; const b=mk(G.sph(r,16,12), M(d.c), 0, r, 0, g); if(d.pear) b.scale.set(0.9,1.15,0.9); mk(G.cyl(0.025,0.03,0.14,5), M(0x6b4a2a), 0, r*2+0.04, 0, g); if(!d.big){ const lf=mk(G.sph(0.08,8,4), M(0x5fae43), 0.08, r*2+0.05, 0, g); lf.scale.set(1.4,0.4,0.8); } }
  else if (d.t==='log'){ for(let i=0;i<3;i++){ const l=mk(G.cyl(0.13,0.13,0.8,10), M(d.c||0xa8754a), 0, 0.13+(i===2?0.22:0), (i===2?0:(i-0.5)*0.27), g); l.rotation.z=Math.PI/2; mk(G.cyl(0.11,0.11,0.01,10),M(d.e||0xe0b888),0.4,l.position.y,l.position.z,g).rotation.z=Math.PI/2; } }
  else if (d.t==='branch'){ const l=mk(G.cyl(0.07,0.09,0.9,7), M(0xc8b49a), 0, 0.1, 0, g); l.rotation.z=Math.PI/2; const tw=mk(G.cyl(0.03,0.04,0.35,5), M(0xc8b49a), 0.1, 0.22, 0.05, g); tw.rotation.z=-0.8; }
  else if (d.t==='stone'){ const s=mk(G.dod(0.3), MF(0x9aa1a8), 0, 0.22, 0, g); s.scale.set(1,0.75,0.9); }
  else if (d.t==='ticket'){ const t=mk(G.box(0.62,0.03,0.34), M(0xf4e6c8), 0,0.04,0,g); t.rotation.y=0.3; const st=mk(G.box(0.2,0.035,0.34), M(d.c), -0.18,0.045,-0.06,g); st.rotation.y=0.3; mk(G.box(0.28,0.035,0.04), M(0x8a6a4a), 0.12,0.045,0.06,g).rotation.y=0.3; }
  else if (d.t==='honey'){ const gl=new THREE.MeshStandardMaterial({ color:0xe8a020, transparent:true, opacity:0.9, roughness:0.2, emissive:0x8a4a00, emissiveIntensity:0.15 });
    mk(G.cyl(0.2,0.18,0.36,14), gl, 0,0.18,0,g); mk(G.cyl(0.22,0.22,0.06,14), M(0xf4e6c8), 0,0.39,0,g); mk(G.cyl(0.16,0.2,0.08,14), M(0xd8604d), 0,0.44,0,g); }
  else if (d.t==='clay'){ const s=mk(G.sph(0.28,10,8), M(0xc87a50), 0, 0.2, 0, g); s.scale.set(1.1,0.7,1); }
  else if (d.t==='iron'){ const s=mk(G.dod(0.22), MF(0x6a7078,{metalness:0.6,roughness:0.4}), 0, 0.2, 0, g); mk(G.dod(0.12), MF(0xa8b0b8,{metalness:0.8,roughness:0.3}), 0.12,0.28,0.05,g); }
  else if (d.t==='potion'){ const gl=new THREE.MeshStandardMaterial({ color:d.c, transparent:true, opacity:0.85, roughness:0.15, emissive:d.c, emissiveIntensity:0.25 });
    mk(G.sph(0.22,16,12), gl, 0,0.22,0,g); mk(G.cyl(0.07,0.09,0.18,10), gl, 0,0.48,0,g); mk(G.cyl(0.085,0.075,0.08,10), M(0x9a6a3a), 0,0.6,0,g); mk(G.tor(0.08,0.02,6,12), M(0xf3c35a,{metalness:0.6,roughness:0.3}), 0,0.42,0,g).rotation.x=Math.PI/2; }
  else if (d.t==='parcel'){ mk(G.box(0.5,0.32,0.4), M(0xc9a06a), 0,0.16,0,g); mk(G.box(0.52,0.04,0.08), M(0xe2483d), 0,0.33,0,g); mk(G.box(0.08,0.04,0.42), M(0xe2483d), 0,0.33,0,g); }
  else if (d.t==='weed'){ g.add(buildWeedClump(7, 0.75)); }
  else if (d.t==='stump'){ const s=buildStump(); s.scale.setScalar(1.25); g.add(s); }
  else if (d.t==='shell'){
    if(d.s==='scallop'){ const s=mk(G.cone(0.32,0.14,14), M(d.c), 0, 0.08, 0, g); s.scale.set(1,1,0.8); for(let i=-2;i<=2;i++){ const r=mk(G.box(0.03,0.02,0.3), M(0xe89a85), i*0.1, 0.13, 0.02, g); r.rotation.y=i*0.3; } }
    else if(d.s==='conch'){ const s=mk(G.cone(0.2,0.6,10), M(d.c), 0, 0.2, 0, g); s.rotation.z=Math.PI/2.2; mk(G.sph(0.12,10,8), M(0xffe0d0), 0.22, 0.14, 0, g); }
    else if(d.s==='cowrie'){ const s=mk(G.sph(0.22,14,10), M(d.c), 0, 0.12, 0, g); s.scale.set(1.3,0.7,0.9); }
    else if(d.s==='disc'){ mk(G.cyl(0.28,0.28,0.06,16), M(d.c), 0, 0.04, 0, g); for(let i=0;i<5;i++){ const p=mk(G.sph(0.05,6,4), M(0xcfbf9a), Math.cos(i/5*TAU)*0.13, 0.08, Math.sin(i/5*TAU)*0.13, g); p.scale.set(1.6,0.3,0.6); p.rotation.y=-i/5*TAU; } }
    else if(d.s==='star'){ for(let i=0;i<5;i++){ const a=i/5*TAU; const arm=mk(G.cone(0.08,0.32,6), M(d.c), Math.cos(a)*0.14,0.06,Math.sin(a)*0.14,g); arm.rotation.set(0,-a,Math.PI/2); arm.rotation.order='YZX'; } mk(G.sph(0.1,10,6),M(d.c),0,0.06,0,g).scale.y=0.5; }
    else if(d.s==='coral'){ for(let i=0;i<5;i++){ const b=mk(G.cyl(0.04,0.06,0.4,6),M(d.c),Math.cos(i*1.3)*0.08,0.2,Math.sin(i*1.3)*0.08,g); b.rotation.set(Math.cos(i)*0.5,0,Math.sin(i)*0.5); mk(G.sph(0.05,6,5),M(d.c),b.position.x*2.2,0.4,b.position.z*2.2,g); } }
    else if(d.s==='glass'){ mk(G.dod(0.18), MF(d.c,{transparent:true,opacity:0.75,roughness:0.15}), 0,0.12,0,g).scale.set(1.2,0.5,1); }
    else if(d.s==='pearl'){ const a=mk(G.sph(0.28,12,6,0,TAU,0,Math.PI/2), M(d.c), 0, 0.05, 0, g); a.scale.set(1,0.4,0.9); const b=mk(G.sph(0.28,12,6), M(0xb8c0c8), -0.05, 0.25, -0.12, g); b.scale.set(1,0.25,0.9); b.rotation.x=-0.7; mk(G.sph(0.1,14,12), M(0xfdf8f0,{roughness:0.15,metalness:0.3}), 0, 0.14, 0.02, g); }
  }
  else if (d.t==='fossil') fossilInto(g, id, d);
  else if (d.t==='fish') (d.x?C2.buildFishInto:CR.buildFishInto)(g, d, id);
  else if (d.t==='bug') (d.x?C2.buildBugInto:CR.buildBugInto)(g, d, id);
  else if (d.t==='furn') FURN_BUILDERS[d.b](g);
  else if (ITEM_BUILDERS[d.t]) ITEM_BUILDERS[d.t](g, d, id);
  else if (d.t==='flower'){ g.add(buildFlower(d.sp, 3)); }
  else if (d.t==='seed'){ const P=PLANTS[d.sp]; mk(G.box(0.4,0.5,0.06), M(0xf3e2c4), 0,0.25,0,g); mk(G.box(0.42,0.08,0.07), M(0xd8c0a0), 0,0.48,0,g); const f=mk(G.cyl(0.11,0.11,0.02,14), M(P.colors[0]), 0,0.24,0.04,g); f.rotation.x=Math.PI/2; mk(G.cyl(0.04,0.04,0.025,10),M(0xf8d040),0,0.24,0.05,g).rotation.x=Math.PI/2; }
  else if (d.t==='sapling'){ const s=buildTree(mulberry32(3), d.sp, { stage:0 }); g.add(s); mk(G.sph(0.28,10,8), M(0xc8a070), 0,0.05,0,g).scale.y=0.6; }
  else if (d.t==='start'){ g.add(buildShrub(d.sp,0)); mk(G.sph(0.28,10,8), M(0xc8a070), 0,0.05,0,g).scale.y=0.6; }
  return g;
}
/* ---------- Fish (v1.1): a smooth lathe body painted with the species' own skin, see-through fins ---------- */
function fishBody(half, H, flat=0.5){
  const pts=[]; for (let i=0;i<=24;i++){ const t=i/24, r=H*Math.pow(Math.sin(Math.PI*(0.03+0.93*t)),0.65)*(1-0.62*t*t)+0.004; pts.push(new THREE.Vector2(r, half-(t*2*half))); }
  const geo=new THREE.LatheGeometry(pts, 28); geo.rotateZ(-Math.PI/2); geo.scale(1,1,flat); geo.computeVertexNormals(); return geo;
}
function finShape(pts){ const s=new THREE.Shape(); s.moveTo(pts[0][0],pts[0][1]); for (let i=1;i<pts.length;i++){ const p=pts[i]; if (p.length===4) s.quadraticCurveTo(p[0],p[1],p[2],p[3]); else s.lineTo(p[0],p[1]); } return normUV(new THREE.ShapeGeometry(s, 8)); }
function normUV(geo){ geo.computeBoundingBox(); const b=geo.boundingBox, p=geo.attributes.position, uv=geo.attributes.uv; for (let i=0;i<p.count;i++) uv.setXY(i, (p.getX(i)-b.min.x)/((b.max.x-b.min.x)||1), (p.getY(i)-b.min.y)/((b.max.y-b.min.y)||1)); uv.needsUpdate=true; return geo; }
const plainEye = () => ceramic(0x161010);
function fishEyes(g, x, y, z, s=1){ for (const k of [1,-1]){ const e=mk(G.sph(0.034*s,12,10), plainEye(), x, y, k*z, g); e.scale.z=0.6; mk(G.sph(0.046*s,12,10), ceramic(0xf4f0e4), x-0.004, y, k*(z-0.006), g).scale.z=0.45; mk(G.sph(0.01*s,6,5), glintMat(), x+0.012*s, y+0.014*s, k*(z+0.016*s), g); } }
function buildFishInto(g, d, id){
  const L=d.l*0.6, skin=fishSkin(id||'x', d), look=fishLook(id), fin=finMat(look.fin||d.c, d.c2), body=shellMat(d.c), belly=shellMat(d.c2);
  switch(d.s){
    case 'ray': { const s=new THREE.Shape(); s.moveTo(0.42,0); s.quadraticCurveTo(0.1,0.5,-0.18,0.46); s.quadraticCurveTo(-0.05,0.1,-0.3,0); s.quadraticCurveTo(-0.05,-0.1,-0.18,-0.46); s.quadraticCurveTo(0.1,-0.5,0.42,0);
      const geo=normUV(new THREE.ExtrudeGeometry(s,{depth:0.05,bevelEnabled:true,bevelThickness:0.03,bevelSize:0.03,bevelSegments:3})); { const pp=geo.attributes.position, uv=geo.attributes.uv; for (let i=0;i<pp.count;i++) uv.setXY(i, 0.62+0.26*((pp.getY(i)+0.5)), 1-((pp.getX(i)+0.32)/0.76)); uv.needsUpdate=true; }
      geo.rotateX(Math.PI/2); const m=mk(geo, skin, 0,0.18,0,g); const t=mk(G.cyl(0.015,0.003,0.7,5), body, -0.62,0.16,0,g); t.rotation.z=Math.PI/2; fishEyes(g,0.22,0.2,0.08,0.8); return; }
    case 'squid': { const glass=new THREE.MeshPhysicalMaterial({ color:d.c, transparent:true, opacity:0.55, roughness:0.1, iridescence:1, clearcoat:1, depthWrite:false }); const b=mk(G.cone(0.16,0.55,18), glass, 0.05,0.22,0,g); b.rotation.z=-Math.PI/2;
      for (const k of [1,-1]){ const f=mk(finShape([[0,0],[0.12,0.1,0.22,0]]), fin, 0.24,0.22,0,g); f.rotation.x=k*Math.PI/2; }
      for (let i=0;i<8;i++){ const a=i/8*TAU; const t=mk(G.cyl(0.016,0.005,0.36,5), glass, -0.4, 0.22+Math.cos(a)*0.05, Math.sin(a)*0.05, g); t.rotation.z=Math.PI/2+Math.cos(a)*0.15; }
      const dots=fishSkin(id,d); mk(G.sph(0.1,12,10), dots, -0.05,0.22,0,g).scale.set(1.5,0.7,0.7); fishEyes(g,-0.16,0.25,0.11,1.2); return; }
    case 'octo': { const og=g; g=new THREE.Group(); g.scale.setScalar(0.72); og.add(g); mk(G.sph(0.24,20,16), skin, 0,0.34,-0.03,g).scale.set(1,1.15,1.05); for(let i=0;i<8;i++){ const a=i/8*TAU; const p=new THREE.Group(); p.position.set(Math.cos(a)*0.14,0.18,Math.sin(a)*0.14); p.rotation.set(Math.sin(a)*1.15,0,-Math.cos(a)*1.15); g.add(p);
        const t=mk(G.cap(0.045,0.26,6,10), skin, 0,-0.16,0,p); for (let k=0;k<4;k++) mk(G.sph(0.018,6,5), ceramic(0xf8d8c8), 0.03,-0.08-k*0.06,0,p); } fishEyes(g,0.17,0.36,0.1,1.2); return; }
    case 'turtle': { const sh=mk(G.sph(0.32,22,14,0,TAU,0,Math.PI/2), skin, 0,0.1,0,g); sh.scale.set(1.1,0.68,1); mk(G.cyl(0.33,0.33,0.04,24), belly, 0,0.1,0,g).scale.set(1.1,1,1); mk(G.sph(0.1,12,10), belly, 0.38,0.15,0,g);
      for(const [x,z] of [[0.2,0.24],[0.2,-0.24],[-0.2,0.24],[-0.2,-0.24]]) mk(G.sph(0.08,10,8),belly,x,0.07,z,g).scale.set(1.5,0.5,1); fishEyes(g,0.44,0.19,0.05,0.7); return; }
    case 'cray': { const seg=shellMat(d.c,{clearcoat:1}); for (let i=0;i<6;i++){ const s=mk(G.sph(0.08-i*0.006,12,10), i%2?seg:shellMat(d.c2), 0.14-i*0.08,0.1,0,g); s.scale.set(0.8,0.75,1); }
      for(const k of [1,-1]){ const arm=mk(G.cap(0.025,0.14,4,8), seg, 0.26,0.1,k*0.1,g); arm.rotation.z=Math.PI/2; arm.rotation.y=k*-0.5; const c=mk(G.sph(0.07,10,8),seg,0.4,0.11,k*0.17,g); c.scale.set(1.5,0.55,0.8); }
      for (let i=0;i<3;i++){ const f=mk(finShape([[0,0],[0.08,0.05],[0.12,0],[0.08,-0.05]]), fin, -0.36,0.1,(i-1)*0.05,g); f.rotation.x=Math.PI/2; f.rotation.z=Math.PI; } fishEyes(g,0.22,0.16,0.04,0.7); return; }
    case 'tad': { mk(G.sph(0.12,16,12), skin, 0,0.12,0,g).scale.set(1.1,0.9,0.95); const t=mk(finShape([[0,0.04],[-0.18,0.08,-0.34,0],[-0.18,-0.08,0,-0.04]]), fin, -0.08,0.12,0,g); fishEyes(g,0.08,0.16,0.08,0.8); return; }
    case 'horse': { const b=mk(G.cap(0.075,0.26,8,12), skin, 0,0.32,0,g); b.rotation.z=0.25; const hd=mk(G.sph(0.08,12,10),skin,0.06,0.52,0,g); const sn=mk(G.cyl(0.02,0.035,0.14,8),skin,0.15,0.51,0,g); sn.rotation.z=Math.PI/2;
      const t=mk(G.tor(0.07,0.025,8,14,Math.PI*1.5),skin,-0.05,0.1,0,g); t.rotation.z=0.5; const df=mk(finShape([[0,0],[-0.06,0.05,-0.1,0.0]]), fin, -0.06,0.34,0,g); fishEyes(g,0.09,0.55,0.05,0.7);
      for (let i=0;i<4;i++) mk(G.cone(0.015,0.05,5), skin, 0.02-i*0.02, 0.58+i*0.0, 0, g).rotation.z=0.4; return; }
  }
  const half=L*0.62, H = d.s==='puff'?0.24 : d.s==='flat'?0.2 : d.s==='sun'?0.3 : d.s==='eel'||d.s==='cat'?0.11 : 0.15, flat = d.s==='flat'?0.28 : d.s==='puff'?0.9 : d.s==='sun'?0.35 : 0.5;
  const b=mk(fishBody(half, H, flat), skin, 0, 0.22, 0, g);
  if (d.s==='puff'){ b.scale.set(1,1.05,1); for (let i=0;i<26;i++){ const a=i*2.4, e=Math.acos(1-2*(i+0.5)/26); const sp=mk(G.cone(0.012,0.05,4), belly, Math.cos(e)*half*0.8, 0.22+Math.sin(e)*Math.cos(a)*H, Math.sin(e)*Math.sin(a)*H*flat, g); sp.lookAt(sp.position.clone().sub(new THREE.Vector3(0,0.22,0)).multiplyScalar(3)); sp.rotateX(Math.PI/2); } }
  const flowy = look.flowy || d.s==='koi';
  const tailPts = flowy ? [[0,0.02],[-0.14,0.26,-0.34,0.2],[-0.22,0.04,-0.32,-0.02],[-0.22,-0.1,-0.34,-0.24],[-0.12,-0.2,0,-0.02]] : d.s==='eel' ? [[0,0.03],[-0.2,0.0],[0,-0.03]] : d.s==='shark' ? [[0,0.02],[-0.1,0.1,-0.2,0.26],[-0.14,0.02],[-0.16,-0.12],[0,-0.02]] : [[0,0.02],[-0.1,0.1,-0.2,0.16],[-0.15,0.0],[-0.2,-0.16],[-0.1,-0.1,0,-0.02]];
  const ts=(d.s==='sun'?0.6:Math.min(1.2,0.6+L*0.5)); const tail=mk(finShape(tailPts), fin, -half+0.04, 0.22, 0, g); tail.scale.set(ts,ts,1); g.userData.tail=tail;
  if (d.s!=='eel'){ const df=mk(finShape(d.s==='shark'?[[0.06,0],[0,0.05,-0.04,0.2],[-0.1,0]]:[[0.1,0],[0.02,0.12,-0.12,0.08],[-0.16,0]]), fin, 0, 0.22+H*0.92, 0, g); df.scale.setScalar(Math.min(1.3,0.6+L*0.6)*(flowy?1.3:1));
    for (const k of [1,-1]){ const pf=mk(finShape([[0,0],[-0.04,0.06,-0.12,0.03],[-0.08,-0.02]]), fin, half*0.45, 0.17, k*H*flat*0.85, g); pf.rotation.y=k*0.5; pf.rotation.x=k*0.35; } }
  else { const df=mk(finShape([[half,0],[0,0.05,-half,0]]), fin, 0, 0.22+H*0.85, 0, g); }
  if (d.s==='cat') for(const k of [1,-1]) for (let i=0;i<2;i++){ const w=mk(G.cyl(0.006,0.003,0.26,4),M(0x2a2a2a),half*0.85,0.18-i*0.03,k*0.05,g); w.rotation.set(k*0.6,0,Math.PI/2+0.3+i*0.2); }
  if (d.glow){ const lure=mk(G.sph(0.03,10,8), M(0xffe08a,{emissive:0xffd060,emissiveIntensity:2}), half*0.95, 0.22+H*1.6, 0, g); mk(G.cyl(0.005,0.005,H*0.8,4), body, half*0.8, 0.22+H*1.2, 0, g).rotation.z=-0.6; }
  fishEyes(g, half*0.68, 0.22+H*0.22, H*flat*0.62, Math.min(1.4,0.7+L*0.4));
}
/* ---------- Bugs (v1.1): painted wings, glossy shells, fuzzy bees ---------- */
function wingGeo(pts){ const s=new THREE.Shape(); s.moveTo(0,0); for (const p of pts){ if (p.length===4) s.quadraticCurveTo(p[0],p[1],p[2],p[3]); else s.lineTo(p[0],p[1]); } s.lineTo(0,0); const g=normUV(new THREE.ShapeGeometry(s,10)); g.rotateX(-Math.PI/2); return g; }
const FORE={ fly:[[0.12,0.26,0.36,0.2],[0.4,0.02],[0.12,-0.02]], moth:[[0.18,0.22,0.42,0.12],[0.4,-0.02],[0.12,-0.04]], big:[[0.22,0.3,0.55,0.16],[0.54,-0.04],[0.14,-0.05]] };
const HIND={ fly:[[0.06,-0.02],[0.3,-0.06,0.26,-0.22],[0.08,-0.16]], tails:[[0.06,-0.02],[0.3,-0.06,0.24,-0.2],[0.22,-0.38],[0.17,-0.22],[0.05,-0.14]], long:[[0.06,-0.02],[0.28,-0.06,0.2,-0.2],[0.2,-0.52],[0.14,-0.22],[0.04,-0.12]],
  moth:[[0.06,-0.03],[0.32,-0.04,0.26,-0.18],[0.06,-0.12]], big:[[0.06,-0.03],[0.42,-0.05,0.34,-0.26],[0.08,-0.16]] };
function wingPair(g, wings, mat, fore, hind, y, size=1){
  for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,y,0); p.scale.set(s*size,1,size); g.add(p);
    const f=mk(wingGeo(fore), mat, 0,0.002,0, p); f.castShadow=false; const h=mk(wingGeo(hind), mat, 0,0,0, p); h.castShadow=false;
    p.userData.side=s; wings.push(p); } }
function antennae(g, y, z, mat, club=true, len=0.17){ for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(s*0.015,y+0.02,z); p.rotation.set(1.05,0,-s*0.45); g.add(p);
  mk(G.cyl(0.004,0.006,len,4),mat,0,len/2,0,p); if (club) mk(G.sph(0.011,6,5),mat,0,len,0,p).scale.set(1,1.8,1); } }
function bugLegs(g, y, spread, mat, n=3){ for (let i=0;i<n;i++) for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(s*0.03,y,(i-1)*0.06); g.add(p); const a=mk(G.cyl(0.007,0.006,spread,4),mat,s*spread/2,0,0,p); a.rotation.z=Math.PI/2; const b=mk(G.cyl(0.006,0.004,0.1,4),mat,s*spread,-0.05,0,p); b.rotation.z=s*0.3; } }
function buildBugInto(g, d, id){
  const w=d.w, dark=shellMat(0x2a2420), wings=[]; g.userData.wings=wings;
  const glow = d.glow ? M(d.c2,{emissive:d.c2,emissiveIntensity:1.6}) : null;
  switch(w){
    case 'fly': case 'moth': {
      const L=wingLook(id), fuzz=fuzzMat(w==='moth'?d.c:0x2a2420);
      for (let i=0;i<4;i++) mk(G.sph(0.04-i*0.006,10,8), fuzz, 0,0.32,0.06-i*0.05,g).scale.set(1,1,1.3); mk(G.sph(0.035,10,8), fuzz, 0,0.33,0.11,g);
      const mat=new THREE.MeshPhysicalMaterial({ map:wingTex(id,d), side:THREE.DoubleSide, roughness:0.5, sheen:0, sheenColor:new THREE.Color(0xffffff), iridescence:w==='fly'?0.35:0, transparent:true, alphaTest:0.05, emissive: d.glow?0xffffff:0x000000, emissiveMap: d.glow?wingTex(id,d):null, emissiveIntensity:d.glow?0.35:0 });
      const big=L.big, fore=big?FORE.big:w==='moth'?FORE.moth:FORE.fly, hind=L.tails==='long'?HIND.long:L.tails?HIND.tails:big?HIND.big:w==='moth'?HIND.moth:HIND.fly;
      wingPair(g, wings, mat, fore, hind, 0.33, w==='moth'?0.85:0.8);
      if (w==='moth') for (const s of [1,-1]){ const a=mk(G.cone(0.03,0.13,6), fuzzMat(d.c2), s*0.03,0.4,0.15,g); a.rotation.set(-0.9,0,s*0.5); a.scale.z=0.3; } else antennae(g,0.33,0.1,dark);
      return; }
    case 'dragon': {
      const bodyM=shellMat(d.c,{iridescence:1,iridescenceIOR:1.8,metalness:0.3}); mk(G.sph(0.045,12,10),bodyM,0,0.3,0.14,g).scale.set(1.4,1,1); mk(G.cap(0.035,0.1,6,10),bodyM,0,0.3,0.06,g).rotation.x=Math.PI/2;
      const tl=mk(G.cyl(0.018,0.012,0.36,8),bodyM,0,0.3,-0.17,g); tl.rotation.x=Math.PI/2; for (const s of [1,-1]) mk(G.sph(0.03,10,8), shellMat(0x2a4a6a,{iridescence:1}), s*0.035,0.31,0.17,g);
      const wm=clearWingMat(d.c2, id==='damselfly'?null:0x3a3a3a); for (const [y,z,sz] of [[0.31,0.08,0.34],[0.305,0.02,0.3]]){ const fore=[[0.1,0.05,sz,0.03],[sz,-0.01],[0.1,-0.03]]; for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,y,z); p.scale.set(s,1,1); g.add(p); mk(wingGeo(fore), wm, 0,0,0,p).castShadow=false; p.userData.side=s; wings.push(p); } }
      return; }
    case 'bee': { const fz=fuzzMat(d.c), bk=fuzzMat(d.c2), f=d.fat?1.15:0.9;
      for (let i=0;i<4;i++) mk(G.sph(0.1*f,14,12), i%2?bk:fz, 0,0.3,0.06-i*0.06,g).scale.set(1,0.95,0.6); mk(G.sph(0.07,12,10),bk,0,0.31,0.13,g); mk(G.cone(0.02,0.05,6), dark, 0,0.3,-0.2,g).rotation.x=-Math.PI/2;
      const wm=clearWingMat(0xffffff); for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.4,0.03); p.scale.set(s,1,1); g.add(p); mk(wingGeo([[0.08,0.06,0.18,0.02],[0.16,-0.05],[0.03,-0.03]]), wm, 0,0,0,p).castShadow=false; p.userData.side=s; wings.push(p); }
      antennae(g,0.33,0.14,dark,false); bugLegs(g,0.25,0.1,dark); return; }
    case 'lady': { const sh=shellMat(d.c), sp=shellMat(d.c2); const dome=mk(G.sph(0.12,22,14,0,TAU,0,Math.PI/2),sh,0,0.18,0,g); dome.scale.z=1.2; mk(G.box(0.004,0.01,0.28),sp,0,0.3,0,g);
      for(let i=0;i<7;i++){ const a=i*0.9+0.4, el=0.5+(i%3)*0.3; const s=mk(G.sph(0.024,8,6),sp,Math.cos(a)*Math.sin(el)*0.12,0.18+Math.cos(el)*0.12*0.98,Math.sin(a)*Math.sin(el)*0.14,g); s.scale.y=0.5; }
      mk(G.sph(0.06,12,10),sp,0,0.2,0.13,g); for (const s of [1,-1]) mk(G.sph(0.018,6,5),ceramic(0xffffff),s*0.03,0.23,0.17,g); bugLegs(g,0.17,0.09,dark); antennae(g,0.2,0.14,dark); return; }
    case 'mantis': { const orchid = id==='orchidmantis', bm=orchid?ceramic(d.c):shellMat(d.c), pm=orchid?ceramic(d.c2):shellMat(d.c2);
      const b=mk(G.cap(0.03,0.32,6,10),bm,0,0.28,0,g); b.rotation.x=1.2; const h=mk(G.cone(0.065,0.09,3),bm,0,0.48,0.16,g); h.rotation.x=Math.PI; for (const s of [1,-1]) mk(G.sph(0.022,8,6),shellMat(orchid?0xe8a0c8:0x9ad870),s*0.04,0.49,0.17,g);
      for(const s of [1,-1]){ const a=mk(G.cap(0.02,0.16,4,8),bm,s*0.05,0.38,0.14,g); a.rotation.x=-0.6; const fa=mk(G.cap(0.015,0.12,4,8),bm,s*0.05,0.36,0.24,g); fa.rotation.x=0.9; }
      if (orchid) for (const s of [1,-1]) for (let i=0;i<2;i++){ const pet=mk(G.sph(0.07,12,8),pm,s*0.07,0.2,-0.02-i*0.1,g); pet.scale.set(0.9,0.15,0.6); pet.rotation.z=s*0.3; }
      const wm=clearWingMat(orchid?0xffe0f0:d.c2); for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.3,0.02); p.scale.set(s,1,1); g.add(p); mk(wingGeo([[0.03,-0.04],[0.05,-0.26],[0.01,-0.2]]), wm, 0,0,0,p).castShadow=false; p.userData.side=s; wings.push(p); }
      bugLegs(g,0.22,0.1,bm,2); return; }
    case 'cicada': { const bm=shellMat(d.c,{iridescence:0.4}); const b=mk(G.sph(0.1,16,12),bm,0,0.25,0,g); b.scale.set(1,0.8,1.5); mk(G.sph(0.07,12,10),bm,0,0.26,0.13,g).scale.set(1.4,0.8,0.8);
      for (const s of [1,-1]) mk(G.sph(0.03,8,6),shellMat(0x8a2a1a),s*0.08,0.28,0.15,g);
      const wm=clearWingMat(d.c2); for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.31,0.08); p.scale.set(s,1,1); p.rotation.y=s*0.15; g.add(p); mk(wingGeo([[0.12,-0.04,0.12,-0.3],[0.05,-0.38],[0.0,-0.2]]), wm, 0,0,0,p).castShadow=false; p.userData.side=s; wings.push(p); } return; }
    case 'hopper': { const bm=shellMat(d.c), lm=shellMat(d.c2); const b=mk(G.cap(0.05,0.22,6,10),bm,0,0.15,0,g); b.rotation.x=Math.PI/2; mk(G.sph(0.06,12,10),bm,0,0.18,0.17,g).scale.set(1,1.1,1.1); for (const s of [1,-1]) mk(G.sph(0.018,6,5),plainEye(),s*0.045,0.2,0.2,g);
      for(const s of [1,-1]){ const lg=mk(G.cap(0.02,0.2,4,8),lm,s*0.07,0.17,-0.06,g); lg.rotation.x=-1.0; const sh=mk(G.cyl(0.008,0.006,0.2,4),lm,s*0.08,0.08,-0.12,g); sh.rotation.x=0.5;
        const p=new THREE.Group(); p.position.set(0,0.2,0.05); p.scale.set(s,1,1); g.add(p); mk(wingGeo([[0.04,-0.02],[0.05,-0.26],[0.01,-0.22]]), lm, 0,0,0,p); p.userData.side=s; wings.push(p); }
      antennae(g,0.18,0.18,dark,false); bugLegs(g,0.12,0.08,lm,2); return; }
    case 'stick': { const bm=woodMat(d.c); const b=mk(G.cyl(0.015,0.02,0.6,6),bm,0,0.08,0,g); b.rotation.x=Math.PI/2; for (let i=0;i<5;i++) mk(G.tor(0.018,0.004,4,8),bm,0,0.08,-0.24+i*0.1,g);
      for(let i=0;i<3;i++) for(const s of [1,-1]){ const l=mk(G.cyl(0.006,0.005,0.22,4),bm,s*0.07,0.05,(i-1)*0.12,g); l.rotation.z=s*1.1; } antennae(g,0.05,0.27,bm,false); return; }
    case 'beetle': case 'stag': case 'rhino': {
      const irid = w!=='beetle' || id==='glowbug' ? 0.6 : 0.2, sh=shellMat(d.c,{iridescence:irid, iridescenceIOR:1.9, metalness:0.25}), hm=shellMat(d.c2,{metalness:0.2});
      for (const s of [1,-1]){ const e=mk(G.sph(0.15,18,14,0,Math.PI,0,Math.PI/2),sh,0,0.17,0,g); e.scale.set(1,0.62,1.35); e.rotation.y=s>0?0:Math.PI; }
      mk(G.box(0.006,0.012,0.4),dark,0,0.265,0,g); mk(G.sph(0.08,14,12),hm,0,0.17,0.2,g).scale.set(1.1,0.8,0.8);
      if (w==='stag') for(const s2 of [1,-1]){ const m=mk(G.tor(0.1,0.018,6,12,Math.PI*0.6),hm,s2*0.05,0.18,0.33,g); m.rotation.set(Math.PI/2,0,s2>0?Math.PI*0.6:Math.PI*0.8); }
      if (w==='rhino'){ const h=mk(G.cone(0.04,0.28,8),hm,0,0.28,0.29,g); h.rotation.x=0.9; }
      if (glow){ mk(G.sph(0.07,12,10),glow,0,0.16,-0.21,g); addGlow(g,0.16,0.6,d.c2); }
      bugLegs(g,0.13,0.14,dark); antennae(g,0.17,0.24,dark,false); return; }
    case 'pill': { const m=shellMat(d.c,{iridescence:0.5,metalness:0.3}); for(let i=0;i<7;i++){ const s=mk(G.sph(0.1,14,10,0,TAU,0,Math.PI/2),i%2?m:shellMat(d.c2),0,0.03,-0.16+i*0.054,g); s.scale.set(1,0.9,0.4); } return; }
    case 'snail': { const shell=new THREE.Group(); shell.position.set(0,0.17,-0.02); shell.rotation.y=Math.PI/2; g.add(shell); for (let i=0;i<18;i++){ const a=i*0.55, r=0.1*Math.exp(-i*0.06); mk(G.sph(r*0.55,10,8), i%3?shellMat(d.c):shellMat(new THREE.Color(d.c).offsetHSL(0,0,-0.15).getHex()), Math.cos(a)*r*0.6, Math.sin(a)*r*0.6, i*0.004, shell); }
      const b=mk(G.cap(0.045,0.3,6,10),ceramic(d.c2),0,0.05,0.04,g); b.rotation.x=Math.PI/2; for(const s of [1,-1]){ const a=mk(G.cyl(0.008,0.008,0.12,4),ceramic(d.c2),s*0.03,0.12,0.2,g); a.rotation.x=0.4; mk(G.sph(0.014,6,5),plainEye(),s*0.035,0.18,0.23,g); } return; }
    case 'crab': case 'hermit': { const sm=shellMat(d.c);
      if (w==='hermit'){ const shell=new THREE.Group(); shell.position.set(0,0.2,-0.05); g.add(shell); for (let i=0;i<12;i++){ const r=0.15-i*0.01; const t=mk(G.tor(r*0.6,r*0.45,8,14),shellMat(i%2?d.c2:new THREE.Color(d.c2).offsetHSL(0,0,0.08).getHex()),0,i*0.025,-i*0.012,shell); t.rotation.x=Math.PI/2; } }
      else { const b=mk(G.sph(0.14,18,12),sm,0,0.12,0,g); b.scale.set(1.3,0.55,1); }
      for(const s of [1,-1]){ const cl=mk(G.sph(0.06,12,10),sm,s*0.18,0.14,0.12,g); cl.scale.set(1.2,0.8,0.8); if(w==='crab'&&s>0) cl.scale.multiplyScalar(1.8); const st=mk(G.cyl(0.008,0.008,0.06,4),sm,s*0.05,0.2,0.1,g); mk(G.sph(0.022,8,6),plainEye(),s*0.05,0.235,0.1,g); }
      bugLegs(g,0.11,0.16,sm); return; }
    case 'skater': { const m=shellMat(d.c); mk(G.cap(0.02,0.12,4,8),m,0,0.05,0,g).rotation.x=Math.PI/2; for(let i=0;i<3;i++) for(const s of [1,-1]){ const l=mk(G.cyl(0.005,0.004,0.3,4),m,s*0.13,0.04,(i-1)*0.08,g); l.rotation.z=Math.PI/2+s*0.15; } return; }
  }
}

/* ---------- Tools (held in hand + shop icons) ---------- */
const TIER_MATS = [ ()=>M(0xb8b0a0), ()=>M(0x8a9098,{metalness:0.5,roughness:0.4}), ()=>M(0xf0c040,{metalness:0.85,roughness:0.25}), ()=>M(0x6fd6c8,{metalness:0.9,roughness:0.15,emissive:0x12403a}) ];
export function buildTool(type, tier=0){
  if (type==='can' && tier>0) tier++; // the can skips the steel tier: 0 basic, 1 golden, 2 heirloom
  const g=new THREE.Group(), metal=TIER_MATS[Math.min(tier,3)](), wood=M(tier===3?0x5a3822:tier===2?0xc89a5a:0x9a6a40);
  if (type==='net'){ mk(G.cyl(0.025,0.025,1.2,6),wood,0,0.6,0,g); const ring=mk(G.tor(0.2,0.02,6,16),metal,0,1.38,0,g); ring.rotation.x=Math.PI/2; const net=mk(G.cone(0.2,0.3,12,1,true),M(0xffffff,{transparent:true,opacity:0.55,side:THREE.DoubleSide}),0,1.23,0,g); net.rotation.x=Math.PI; }
  else if (type==='rod'){ mk(G.cyl(0.012,0.028,1.5,6),wood,0,0.75,0,g); mk(G.cyl(0.05,0.05,0.05,10),metal,0.04,0.3,0,g).rotation.z=Math.PI/2; }
  else if (type==='shovel'){ mk(G.cyl(0.025,0.025,0.95,6),wood,0,0.5,0,g); mk(G.box(0.18,0.04,0.04),wood,0,1.0,0,g); const b=mk(G.box(0.22,0.28,0.03),metal,0,-0.05,0,g); mk(G.cone(0.11,0.1,4),metal,0,-0.24,0,g).rotation.y=Math.PI/4; }
  else if (type==='axe'){ mk(G.cyl(0.025,0.03,0.9,6),wood,0,0.45,0,g); mk(G.box(0.08,0.14,0.08),metal,0,0.86,0,g); mk(G.box(0.03,0.24,0.2),metal,0,0.86,0.12,g); }
  else if (type==='can'){ const b=mk(G.cyl(0.14,0.16,0.26,12),tier?metal:M(0x6ab0d8),0,0.13,0,g); const sp=mk(G.cyl(0.02,0.035,0.32,6),tier?metal:M(0x6ab0d8),0,0.2,0.2,g); sp.rotation.x=1.0; const h=mk(G.tor(0.09,0.018,6,12,Math.PI),tier?metal:M(0x6ab0d8),0,0.27,-0.05,g); h.rotation.y=Math.PI/2; }
  return g;
}

/* ---------- Thumbnails for the UI ---------- */
const thumbR = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
thumbR.setSize(160,160); thumbR.outputColorSpace=THREE.SRGBColorSpace; thumbR.toneMapping=THREE.ACESFilmicToneMapping;
const thumbScene=new THREE.Scene(); thumbScene.add(new THREE.HemisphereLight(0xffffff,0xb09070,2.4)); { const dl=new THREE.DirectionalLight(0xffffff,2); dl.position.set(2,4,3); thumbScene.add(dl); const rim=new THREE.DirectionalLight(0xd8ecff,1.4); rim.position.set(-3,2,-4); thumbScene.add(rim); }
const thumbCam=new THREE.PerspectiveCamera(28,1,0.01,100); const thumbCache={};
function renderThumb(key, m){
  if (thumbCache[key]) return thumbCache[key];
  thumbScene.add(m); m.updateMatrixWorld(true); const box=new THREE.Box3(); m.traverse(o=>{ if (o.isMesh && !o.userData.outline) box.expandByObject(o, false); }); if (box.isEmpty()) box.setFromObject(m); const c=box.getCenter(new THREE.Vector3()), s=box.getSize(new THREE.Vector3()).length();
  const kind=(ITEMS[key]||{}).kind;
  const topView = kind==='bug' || (kind==='fish' && ['ray','turtle','cray'].includes(ITEMS[key].model.s));
  if (kind==='fish' && !topView) thumbCam.position.set(c.x+s*0.2, c.y+s*0.55, c.z+s*1.85);      // profile, so the patterns read
  else if (topView) thumbCam.position.set(c.x+s*0.25, c.y+s*1.6, c.z+s*0.9);   // from above, wings open
  else thumbCam.position.set(c.x+s*0.85, c.y+s*0.8, c.z+s*1.5);
  thumbCam.lookAt(c);
  thumbR.render(thumbScene, thumbCam); const url=thumbR.domElement.toDataURL(); thumbScene.remove(m);
  return thumbCache[key]=url;
}
export const thumb = id => thumbCache[id] || renderThumb(id, buildItemModel(id));
export const hasThumb = id => !!thumbCache[id];   // v1.65: lets long lists draw their pictures a few at a time
export const toolThumb = (type,tier) => thumbCache['tool:'+type+tier] || renderThumb('tool:'+type+tier, (()=>{ const g=buildTool(type,tier); g.rotation.z=-0.6; return g; })());

/* ---------- Furniture ---------- */
const WOOD=0xa8754a, WOOD2=0x8b5e3a, WOODL=0xc99a6a;
export const ITEM_BUILDERS = {};   // v1.13: other modules register item model types here (rare.js: rare ingredients, plans)
export const FURN_BUILDERS = {
  stool(g){ mk(G.cyl(0.36,0.4,0.48,14), M(WOOD), 0,0.24,0,g); mk(G.cyl(0.36,0.36,0.04,14), M(0xe8c99a), 0,0.5,0,g); },
  bench(g){ const s=mk(G.cyl(0.24,0.24,1.7,12), M(WOOD), 0,0.52,0,g); s.rotation.z=Math.PI/2; s.scale.z=0.65; mk(G.cyl(0.2,0.24,0.42,10), M(WOOD2), -0.6,0.21,0,g); mk(G.cyl(0.2,0.24,0.42,10), M(WOOD2), 0.6,0.21,0,g); const back=mk(G.box(1.6,0.45,0.1), M(WOODL), 0,0.9,-0.18,g); back.rotation.x=-0.15; },
  table(g){ mk(G.cyl(0.75,0.75,0.08,20), M(WOODL), 0,0.75,0,g); mk(G.cyl(0.07,0.1,0.72,8), M(WOOD2), 0,0.37,0,g); mk(G.cyl(0.35,0.4,0.06,14), M(WOOD2), 0,0.03,0,g); mk(G.cyl(0.07,0.09,0.2,10), M(0xa8d8e8,{transparent:true,opacity:0.8}),0.15,0.89,0.1,g); mk(G.sph(0.07,8,6), M(0xff8fa8), 0.15,1.03,0.1,g); },
  plant(g){ mk(G.cyl(0.26,0.2,0.4,12), M(0xd27a4f), 0,0.2,0,g); mk(G.cyl(0.28,0.28,0.06,12), M(0xb8603a), 0,0.4,0,g); for(let i=0;i<7;i++){ const a=i/7*TAU; const l=mk(G.sph(0.3,8,4), M(i%2?0x5fae43:0x7cc35a), Math.cos(a)*0.18,0.7,Math.sin(a)*0.18,g); l.scale.set(0.45,1,0.25); l.rotation.set(Math.sin(a)*0.6,a,Math.cos(a)*0.6); } },
  monstera(g){ mk(G.cyl(0.3,0.24,0.45,12), M(0xf2ead8), 0,0.22,0,g); for(let i=0;i<6;i++){ const a=i/6*TAU; mk(G.cyl(0.015,0.015,0.6,4),M(0x4f9a3a),Math.cos(a)*0.12,0.7,Math.sin(a)*0.12,g).rotation.set(Math.sin(a)*0.4,0,-Math.cos(a)*0.4); const l=mk(G.sph(0.32,10,4), M(0x3f8a3a), Math.cos(a)*0.35,1.0+(i%2)*0.1,Math.sin(a)*0.35,g); l.scale.set(0.9,0.12,0.7); l.rotation.set(Math.sin(a)*0.5,-a,-Math.cos(a)*0.5); } },
  lantern(g){ mk(G.cyl(0.06,0.08,1.4,8), M(0x4a3a30), 0,0.7,0,g); mk(G.cyl(0.25,0.3,0.08,10), M(0x4a3a30), 0,0.04,0,g); mk(G.box(0.34,0.4,0.34), glowMat(0xffd27a), 0,1.6,0,g); mk(G.cone(0.32,0.22,4), M(0x3a2e26), 0,1.91,0,g).rotation.y=Math.PI/4; addGlow(g,1.6,2.8); },
  crate(g){ mk(G.box(0.75,0.5,0.6), M(WOOD), 0,0.25,0,g); for(const y of [0.12,0.38]) mk(G.box(0.78,0.06,0.63), M(WOOD2), 0,y,0,g); const fc=[0xe2483d,0xf59a2f,0xc9d65a]; for(let i=0;i<6;i++) mk(G.sph(0.11,10,8), M(fc[i%3]), -0.2+(i%3)*0.2, 0.55, -0.1+Math.floor(i/3)*0.2, g); },
  planter(g){ mk(G.box(1.3,0.4,0.5), M(WOOD2), 0,0.2,0,g); mk(G.box(1.2,0.06,0.42), M(0x6b4a30), 0,0.4,0,g); const fc=PALETTE.spring.flower; for(let i=0;i<8;i++){ const x=-0.5+i*0.14; mk(G.cyl(0.015,0.015,0.3,4), M(0x4f9a3a), x,0.55,(i%2)*0.1-0.05,g); mk(G.ico(0.08,1), M(fc[i%fc.length]), x,0.72,(i%2)*0.1-0.05,g); } },
  blanket(g){ const t=canvasTex(64,64,x=>{ for(let i=0;i<8;i++) for(let j=0;j<8;j++){ x.fillStyle=(i+j)%2?'#e8604d':'#fff3e0'; x.fillRect(i*8,j*8,8,8);} }); t.magFilter=THREE.NearestFilter; const m=mk(G.box(1.8,0.03,1.4), new THREE.MeshStandardMaterial({map:t,roughness:1}), 0,0.02,0,g); m.castShadow=false; mk(G.cyl(0.2,0.18,0.25,10), M(0xc9a06a), 0.5,0.15,0.3,g); },
  birdbath(g){ mk(G.cyl(0.3,0.35,0.12,12), M(0xb8b8b0), 0,0.06,0,g); mk(G.cyl(0.1,0.16,0.8,10), M(0xc8c8c0), 0,0.5,0,g); mk(G.cyl(0.5,0.25,0.18,14), M(0xc8c8c0), 0,0.95,0,g); mk(G.cyl(0.42,0.42,0.02,14), M(0x7fd0e0,{roughness:0.1}), 0,1.03,0,g); },
  signpost(g){ mk(G.cyl(0.07,0.08,1.6,8), M(WOOD2), 0,0.8,0,g); const a=mk(G.box(0.9,0.28,0.06), M(WOODL), 0.3,1.35,0,g); a.rotation.z=0.05; const b=mk(G.box(0.8,0.24,0.06), M(WOODL), -0.25,1.0,0.02,g); b.rotation.z=-0.06; },
  fence(g){ for(const x of [-0.5,0.5]){ mk(G.box(0.12,0.9,0.12), M(0xf2ead8), x,0.45,0,g); mk(G.cone(0.09,0.12,4),M(0xf2ead8),x,0.96,0,g).rotation.y=Math.PI/4; } for(const y of [0.35,0.7]) mk(G.box(1.1,0.09,0.06), M(0xf2ead8), 0,y,0,g); },
  mailbox(g){ mk(G.cyl(0.05,0.05,1.0,8), M(WOOD2), 0,0.5,0,g); const b=mk(G.cyl(0.18,0.18,0.5,12,1,false,0,Math.PI), M(0x4a7ad8), 0,1.1,0,g); b.rotation.z=Math.PI/2; b.rotation.y=Math.PI/2; mk(G.box(0.36,0.18,0.5),M(0x4a7ad8),0,1.02,0,g); mk(G.box(0.04,0.18,0.06),M(0xe2483d),0.2,1.18,0.1,g); },
  bed(g){ mk(G.box(1.3,0.3,2.0), M(WOOD), 0,0.2,0,g); mk(G.box(1.25,0.18,1.9), M(0xffffff), 0,0.42,0,g); mk(G.box(1.28,0.2,1.2), M(0x7ab0d8), 0,0.46,0.38,g); mk(G.box(0.9,0.14,0.35), M(0xfff8f0), 0,0.56,-0.7,g); mk(G.box(1.35,0.9,0.12), M(WOOD2), 0,0.45,-0.98,g); },
  bookshelf(g){ mk(G.box(1.3,1.8,0.45), M(WOOD), 0,0.9,0,g); const bc=[0xe2483d,0x4a7ad8,0xf0c040,0x5aae46,0x8a4fa8,0xf08a5a]; for(let s=0;s<3;s++){ mk(G.box(1.2,0.04,0.4), M(WOOD2), 0,0.35+s*0.55,0.03,g); for(let i=0;i<7;i++) mk(G.box(0.12,0.38,0.3), M(bc[(i+s*2)%6]), -0.48+i*0.155,0.56+s*0.55,0.06,g); } },
  rug(g){ const m=mk(G.cyl(1.1,1.1,0.03,28), M(0xd8805a), 0,0.015,0,g); m.castShadow=false; mk(G.cyl(0.8,0.8,0.035,28), M(0xf0c890), 0,0.02,0,g).castShadow=false; mk(G.cyl(0.45,0.45,0.04,24), M(0xd8805a), 0,0.025,0,g).castShadow=false; },
  armchair(g){ mk(G.box(0.95,0.4,0.85), M(0xc86a5a), 0,0.3,0,g); mk(G.box(0.95,0.7,0.2), M(0xc86a5a), 0,0.75,-0.35,g); for(const s of [-1,1]) mk(G.box(0.18,0.35,0.85), M(0xb85a4a), s*0.47,0.6,0,g); mk(G.box(0.7,0.12,0.6), M(0xf0d8c0), 0,0.55,0.05,g); },
  floorlamp(g){ mk(G.cyl(0.2,0.24,0.05,12), M(0x4a3a30), 0,0.03,0,g); mk(G.cyl(0.03,0.03,1.5,8), M(0x4a3a30), 0,0.78,0,g); mk(G.cyl(0.18,0.3,0.35,14,1,true), glowMat(0xfff0c8), 0,1.6,0,g); addGlow(g,1.5,2.8); },
  chest(g){ // a wooden storage chest with iron bands, a domed lid and a brass latch
    mk(G.box(1.0,0.5,0.6), M(WOODL), 0,0.27,0,g);
    const lid=mk(G.cyl(0.3,0.3,1.0,16,1,false,0,Math.PI), M(WOOD), 0,0.52,0,g); lid.rotation.z=Math.PI/2; lid.scale.set(0.6,1,1);
    for (const x of [-0.36,0.36]){ mk(G.box(0.08,0.52,0.63), M(0x5a5a62,{metalness:0.5,roughness:0.45}), x,0.27,0,g); const b=mk(G.cyl(0.315,0.315,0.08,16,1,false,0,Math.PI), M(0x5a5a62,{metalness:0.5,roughness:0.45}), x,0.52,0,g); b.rotation.z=Math.PI/2; b.scale.set(0.63,1,1.02); }
    mk(G.box(0.14,0.16,0.04), M(0xf0c040,{metalness:0.6,roughness:0.3}), 0,0.5,0.31,g);
    for (const x of [-0.42,0.42]) for (const z of [-0.24,0.24]) mk(G.box(0.1,0.06,0.1), M(WOOD2), x,0.03,z,g); },
  dresser(g){ mk(G.box(1.2,0.9,0.5), M(WOODL), 0,0.45,0,g); for(let i=0;i<3;i++){ mk(G.box(1.1,0.24,0.04), M(WOOD), 0,0.18+i*0.28,0.25,g); mk(G.sph(0.03,6,5), M(0xf0c040), 0,0.18+i*0.28,0.28,g); } mk(G.sph(0.12,10,8),M(0x8ac0e0),0.35,1.0,0,g); },
  desk(g){ mk(G.box(1.4,0.08,0.7), M(WOODL), 0,0.78,0,g); for(const x of [-0.62,0.62]) for(const z of [-0.28,0.28]) mk(G.box(0.07,0.76,0.07), M(WOOD2), x,0.38,z,g); mk(G.box(0.45,0.03,0.32), M(0xffffff), -0.2,0.83,0,g); mk(G.cyl(0.05,0.05,0.12,8), M(0x4a7ad8), 0.4,0.88,0,g); },
  stove(g){ mk(G.box(0.8,0.7,0.6), M(0x3a3a40,{metalness:0.4,roughness:0.5}), 0,0.45,0,g); for(const x of [-0.32,0.32]) for(const z of [-0.22,0.22]) mk(G.cyl(0.04,0.04,0.12,6), M(0x2a2a30), x,0.06,z,g); mk(G.box(0.4,0.3,0.02), glowMat(0xff8a3a), 0,0.42,0.31,g); mk(G.cyl(0.1,0.1,1.6,10), M(0x3a3a40), 0,1.6,-0.1,g); addGlow(g,0.45,2.2,0xffa060); },
  pumpkin(g){ for(let i=0;i<8;i++){ const a=i/8*TAU; const s=mk(G.sph(0.24,10,8), M(0xf08a2a), Math.cos(a)*0.17,0.3,Math.sin(a)*0.17,g); s.scale.set(0.7,1,0.7); } mk(G.sph(0.22,10,8), M(0xe87a20), 0,0.3,0,g); mk(G.cyl(0.04,0.06,0.18,6), M(0x5a7a2a), 0,0.6,0,g); },
  snowbuddy(g){ mk(G.sph(0.42,16,12), M(0xffffff), 0,0.4,0,g); mk(G.sph(0.3,16,12), M(0xffffff), 0,0.98,0,g); const n=mk(G.cone(0.05,0.22,8), M(0xf08a2a), 0,0.98,0.32,g); n.rotation.x=Math.PI/2; mk(G.sph(0.035,6,5), M(0x222222), -0.1,1.06,0.26,g); mk(G.sph(0.035,6,5), M(0x222222), 0.1,1.06,0.26,g); mk(G.tor(0.27,0.06,8,16), M(0xd8463a), 0,0.78,0,g).rotation.x=Math.PI/2; },
  umbrella(g){ mk(G.cyl(0.03,0.03,2.2,8), M(0xf2ead8), 0,1.1,0,g); const cg=new THREE.ConeGeometry(1.2,0.5,12,1,true).toNonIndexed(); const cols=[]; const n=cg.attributes.position.count; for(let i=0;i<n;i+=3){ const col=new THREE.Color(Math.floor(i/3)%2?0xffffff:0x4fb3c8); for(let k=0;k<3;k++) cols.push(col.r,col.g,col.b); } cg.setAttribute('color',new THREE.Float32BufferAttribute(cols,3)); mk(cg, new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,side:THREE.DoubleSide}), 0,2.3,0,g); },
  campfire(g){ for(let i=0;i<8;i++){ const a=i/8*TAU; const s=mk(G.dod(0.14), MF(0x8a8a88), Math.cos(a)*0.45,0.08,Math.sin(a)*0.45,g); s.scale.y=0.7; } for(let i=0;i<3;i++){ const l=mk(G.cyl(0.07,0.08,0.7,8), M(WOOD2), 0,0.14,0,g); l.rotation.set(Math.PI/2.3,i*2.1,0); } const f=new THREE.Group(); g.add(f); mk(G.cone(0.2,0.55,8), glowMat(0xffa030), 0,0.4,0,f).castShadow=false; mk(G.cone(0.12,0.4,8), glowMat(0xffe070), 0,0.4,0,f).castShadow=false; addGlow(g,0.6,3.2,0xffb060); g.userData.flame=f; },
  windchime(g){ mk(G.cyl(0.04,0.05,1.9,8), M(WOOD2), 0,0.95,0,g); mk(G.box(0.6,0.05,0.05), M(WOOD2), 0.25,1.85,0,g); const cols=[0xf5b9a0,0xf3e2c4,0xe9dcc0,0xbfe6f0]; for(let i=0;i<4;i++){ mk(G.cyl(0.005,0.005,0.4,3), M(0xdddddd), 0.1+i*0.14,1.62,0,g); mk(G.cone(0.06,0.12,8), M(cols[i]), 0.1+i*0.14,1.38,0,g); } },
  workbench(g){ mk(G.box(1.4,0.1,0.7), M(WOODL), 0,0.82,0,g); for(const x of [-0.6,0.6]) for(const z of [-0.26,0.26]) mk(G.box(0.1,0.8,0.1), M(WOOD2), x,0.4,z,g); mk(G.box(1.25,0.06,0.55), M(WOOD), 0,0.25,0,g); mk(G.box(0.5,0.04,0.12), M(0x8a9098,{metalness:0.5,roughness:0.4}), -0.25,0.89,0.1,g); const h=mk(G.cyl(0.025,0.025,0.32,6), M(WOOD2), 0.35,0.9,-0.05,g); h.rotation.z=Math.PI/2; mk(G.box(0.08,0.08,0.14), M(0x6a6a70,{metalness:0.6,roughness:0.4}), 0.52,0.9,-0.05,g); mk(G.box(0.3,0.1,0.18), M(WOOD), 0.2,0.18,0.05,g); },
  logpile(g){ for(let row=0;row<3;row++){ const n=3-row; for(let i=0;i<n;i++){ const l=mk(G.cyl(0.17,0.17,1.1,10), M(row%2?WOOD:WOOD2), (i-(n-1)/2)*0.36, 0.17+row*0.3, 0, g); l.rotation.x=Math.PI/2; mk(G.cyl(0.14,0.14,0.02,10), M(0xe8c99a), (i-(n-1)/2)*0.36, 0.17+row*0.3, 0.56, g).rotation.x=Math.PI/2; } } },
  birdhouse(g){ mk(G.cyl(0.05,0.06,1.4,8), M(WOOD2), 0,0.7,0,g); mk(G.box(0.36,0.36,0.36), M(WOODL), 0,1.55,0,g); const r1=mk(G.box(0.3,0.04,0.46), M(0xb5523b), -0.11,1.82,0,g); r1.rotation.z=0.7; const r2=mk(G.box(0.3,0.04,0.46), M(0xb5523b), 0.11,1.82,0,g); r2.rotation.z=-0.7; mk(G.cyl(0.07,0.07,0.02,12), M(0x3a2a20), 0,1.58,0.18,g).rotation.x=Math.PI/2; mk(G.cyl(0.012,0.012,0.12,4), M(WOOD2), 0,1.46,0.22,g).rotation.x=Math.PI/2; },
  driftchair(g){ const D=0xc8b8a0, D2=0xb0a088; mk(G.box(0.7,0.08,0.6), M(D), 0,0.45,0,g); for(const x of [-0.3,0.3]) for(const z of [-0.25,0.25]){ const l=mk(G.cyl(0.04,0.05,0.46,6), M(D2), x,0.22,z,g); l.rotation.z=x*0.25; } for(let i=0;i<4;i++){ const b=mk(G.cyl(0.035,0.04,0.7,6), M(i%2?D:D2), -0.24+i*0.16,0.82,-0.28,g); b.rotation.x=-0.18; b.rotation.z=(i-1.5)*0.06; } const top=mk(G.cyl(0.04,0.04,0.78,6), M(D2), 0,1.16,-0.34,g); top.rotation.z=Math.PI/2; },
  arbor(g){ const D=0xc8b8a0, D2=0xb0a088; for(const x of [-0.85,0.85]) for(const z of [-0.25,0.25]){ const p=mk(G.cyl(0.06,0.07,2.1,7), M(z>0?D:D2), x,1.05,z,g); p.rotation.z=x*0.03; } for(let i=0;i<5;i++){ const b=mk(G.cyl(0.045,0.05,2.1,6), M(i%2?D:D2), 0,2.12+Math.sin(i/4*Math.PI)*0.12,-0.3+i*0.15,g); b.rotation.z=Math.PI/2; } const lc=[0x5fae43,0x7cc35a]; for(let i=0;i<14;i++){ const a=i/13; mk(G.ico(0.14,0), M(lc[i%2]), -0.95+a*1.9, 2.2+Math.sin(a*Math.PI)*0.12, (i%3-1)*0.22, g); if(i%3===0) mk(G.ico(0.07,0), M(0xf5a0c0), -0.95+a*1.9, 2.3, (i%3-1)*0.22+0.1, g); } },
  planterbox(g){ mk(G.box(1.0,0.45,0.6), M(WOOD), 0,0.22,0,g); for(const y of [0.1,0.3]) mk(G.box(1.03,0.04,0.63), M(WOOD2), 0,y,0,g); mk(G.box(0.92,0.05,0.52), M(0x6b4a30), 0,0.45,0,g); for(let i=0;i<6;i++){ const x=-0.35+(i%3)*0.35, z=i<3?-0.12:0.12; const l=mk(G.sph(0.13,8,6), M(i%2?0x5fae43:0x4f9a3a), x,0.56,z,g); l.scale.y=0.7; } },
  telescope(g){ for(let i=0;i<3;i++){ const a=i/3*TAU; const l=mk(G.cyl(0.025,0.025,1.2,6),M(WOOD2),Math.cos(a)*0.22,0.55,Math.sin(a)*0.22,g); l.rotation.set(Math.sin(a)*0.35,0,-Math.cos(a)*0.35); } const t=mk(G.cyl(0.07,0.11,1.0,12),M(0xd8a040,{metalness:0.7,roughness:0.3}),0,1.2,0.1,g); t.rotation.x=-1.0; },
};

/* ---------- Characters (v1.1): plush toys ----------
   Felt bodies, big round heads, short round torsos, stubby limbs, shiny safety eyes and stitched mouths.
   Ears and tails sit on their own pivots so the game can make them wobble (see jelly in main.js). */
const SKIN_FELT = c => felt(c);
function plushFace(head, R, o){
  const fz=R*0.86;
  for (const s of [-1,1]){ const e=mk(G.sph(0.075*o.eye,14,12), eyeMat(), s*R*0.36, R*0.06, fz, head); e.scale.set(1,1.18,0.55); e.castShadow=false;
    const gl=mk(G.sph(0.022*o.eye,8,6), glintMat(), s*R*0.36+0.025, R*0.06+0.04, fz+0.04, head); gl.castShadow=false;
    const ck=mk(G.sph(0.095,12,8), felt(o.cheek), s*R*0.56, -R*0.2, R*0.72, head); ck.scale.set(1,0.62,0.3); ck.castShadow=false; }
  const sn=o.snout||'round'; let nz=R*1.02, ny=-R*0.1;
  if (o.muzzle!==null){
    if (sn==='pointy'){ const mz=mk(G.cone(R*0.3,R*0.55,16), felt(o.muzzle), 0,-R*0.2,R*0.98, head); mz.rotation.x=Math.PI/2; mz.scale.set(1.1,1,0.8); nz=R*1.27; ny=-R*0.2; }
    else if (sn==='long'){ const mz=mk(G.sph(R*0.4,18,14), felt(o.muzzle), 0, -R*0.3, R*0.82, head); mz.scale.set(1.0,0.8,0.95); nz=R*1.16; ny=-R*0.2; }
    else if (sn==='small'){ const mz=mk(G.sph(R*0.3,18,14), felt(o.muzzle), 0, -R*0.24, R*0.84, head); mz.scale.set(1.3,0.8,0.55); }
    else { const mz=mk(G.sph(R*0.4,18,14), felt(o.muzzle), 0, -R*0.24, R*0.78, head); mz.scale.set(1.25,0.82,0.62); } }
  const nose=mk(G.sph(sn==='small'?0.045:0.06,12,10), noseMat(o.nose), 0, ny, nz, head); nose.scale.set(1.35,0.9,0.75);
  if (o.whiskers) for (const s of [-1,1]) for (let k=0;k<2;k++){ const w=mk(G.cyl(0.005,0.005,0.22,3), threadMat(0x6a5a5a), s*R*0.34, -R*0.2-k*0.035, R*0.86, head); w.rotation.z=Math.PI/2+s*(k?-0.18:0.12); w.castShadow=false; }
  const th=threadMat(0x3a2426);
  for (const s of [-1,1]){ const m=mk(G.tor(0.045,0.011,6,12,Math.PI), th, s*0.044, -R*0.29, R*1.0, head); m.rotation.z=Math.PI; m.castShadow=false; }
  const st=mk(G.cyl(0.008,0.008,0.07,4), th, 0, -R*0.19, R*1.03, head); st.castShadow=false;
}
function ear(head, x, y, z, rz, build){ const p=new THREE.Group(); p.position.set(x,y,z); p.rotation.z=rz; head.add(p); build(p); p.userData.base=rz; return p; }
function plushLimbs(g, body, armMat, pawMat, legMat, footMat, padMat){
  const arms=[]; for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*0.4,0.9,0.03); body.add(p);
    const a=mk(G.cap(0.11,0.08,6,12), armMat, s*0.03,-0.12,0, p); a.rotation.z=s*0.25; mk(G.sph(0.12,14,10), pawMat, s*0.07,-0.25,0.02, p); arms.push(p); }
  const legs=[]; for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*0.2,0.3,0); g.add(p);
    mk(G.cap(0.135,0.05,6,12), legMat, 0,-0.1,0, p); const f=mk(G.sph(0.15,14,10), footMat, 0,-0.22,0.05, p); f.scale.set(1,0.58,1.25);
    if (padMat){ const pd=mk(G.sph(0.09,10,8), padMat, 0,-0.21,0.22, p); pd.scale.set(1,0.75,0.25); pd.castShadow=false; } legs.push(p); }
  return { arms, legs };
}
// Clothes and accessories, picked per character in content.js (acc) and for the shopkeepers by name
function dress(body, head, spec){
  const top = spec.top || 'knit', sc=spec.shirt;
  if (top==='overalls'){ const den=felt(0x4a6aa8); const lo=mk(G.sph(0.5,24,16,0,TAU,Math.PI*0.5,Math.PI*0.36), den, 0,0.7,0,body); lo.scale.set(1,0.92,0.86);
    const bib=mk(G.box(0.36,0.3,0.06), den, 0,0.86,0.38,body); bib.rotation.x=-0.22; for (const s of [-1,1]){ const st=mk(G.box(0.07,0.42,0.05), den, s*0.17,1.0,0.25,body); st.rotation.x=-0.55; mk(G.cyl(0.03,0.03,0.02,10), brassBtn(), s*0.15,0.98,0.41,body).rotation.x=Math.PI/2-0.22; }
    const sh=mk(G.sph(0.495,24,16,0,TAU,Math.PI*0.16,Math.PI*0.36), knit(sc), 0,0.7,0,body); sh.scale.set(1,0.92,0.86); }
  else { const sh=mk(G.sph(0.5,24,16,0,TAU,Math.PI*0.16,Math.PI*0.5), knit(sc, top==='stripe'?0xffffff:null, top==='stripe'?12:10), 0,0.7,0,body); sh.scale.set(1,0.92,0.86);
    const hem=mk(G.tor(0.43,0.045,8,28), knit(sc), 0,0.46,0,body); hem.rotation.x=Math.PI/2; hem.scale.set(1,0.86,1); }
  const A=spec.acc||[];
  if (A.includes('scarf')){ const c=spec.accC||0x5aae6a; const sc2=mk(G.tor(0.3,0.085,10,24), knit(c,null,6), 0,1.1,0,body); sc2.rotation.x=Math.PI/2; const tail=mk(G.box(0.14,0.36,0.07), knit(c,null,8), 0.16,0.92,0.38,body); tail.rotation.set(-0.2,0,0.15); }
  if (A.includes('beanie')){ const c=spec.accC||0xf0c040; const b=mk(G.sph(0.6,22,14,0,TAU,0,Math.PI*0.42), knit(c,null,12), 0,0.08,-0.02,head); b.scale.set(1.04,1,1.02); const rim=mk(G.tor(0.52,0.06,8,28), knit(c,null,4), 0,0.28,-0.02,head); rim.rotation.x=Math.PI/2+0.08; mk(G.sph(0.11,10,8), felt(c), 0,0.66,-0.04,head); }
  if (A.includes('glasses')){ const fr=noseMat(0x5a3a2a); for (const s of [-1,1]){ const r=mk(G.tor(0.11,0.016,8,20), fr, s*0.21,0.04,0.56,head); r.castShadow=false; } mk(G.cyl(0.012,0.012,0.12,4), fr, 0,0.06,0.58,head).rotation.z=Math.PI/2; }
  if (A.includes('bow')){ const c=spec.accC||0xf08aa8, m=felt(c); for (const s of [-1,1]){ const w=mk(G.cone(0.1,0.18,10), m, s*0.1,0.42,0.18,head); w.rotation.z=s*Math.PI/2; } mk(G.sph(0.05,8,6), m, 0,0.42,0.2,head); }
  if (A.includes('flower')){ const p=new THREE.Group(); p.position.set(0.3,0.36,0.3); head.add(p); for (let i=0;i<5;i++){ const a=i/5*TAU; mk(G.sph(0.055,8,6), felt(0xffffff), Math.cos(a)*0.06,Math.sin(a)*0.06,0,p).scale.z=0.4; } mk(G.sph(0.04,8,6), felt(0xf8d040), 0,0,0.02,p); }
  if (A.includes('headband')){ const hb=mk(G.tor(0.56,0.05,8,30), felt(spec.accC||0xe2483d), 0,0.2,0,head); hb.rotation.x=Math.PI/2-0.25; }
  if (A.includes('beret')){ const b=mk(G.sph(0.42,18,10,0,TAU,0,Math.PI/2), felt(spec.accC||0x6a4aa8), -0.08,0.42,-0.02,head); b.scale.set(1.2,0.35,1.2); b.rotation.z=0.25; mk(G.cyl(0.02,0.03,0.08,6), felt(spec.accC||0x6a4aa8), -0.1,0.58,0,head); }
  if (A.includes('pearls')){ for (let i=0;i<14;i++){ const a=Math.PI*0.1+i/13*Math.PI*0.8; mk(G.sph(0.03,8,6), ceramicBead(), Math.cos(a)*0.28, 1.08-Math.sin(a)*0.06, Math.sin(a)*0.25, body).castShadow=false; } }
  if (A.includes('apron')){ const ap=mk(G.box(0.5,0.46,0.04), fabricMat(spec.accC||0xf8e8f0,'flower',0xe88aa8), 0,0.6,0.4,body); ap.rotation.x=-0.18; }
  if (A.includes('vest')){ const v=mk(G.sph(0.505,24,14,Math.PI*0.62,Math.PI*1.76,Math.PI*0.16,Math.PI*0.46), felt(spec.accC||0x3a5a8a), 0,0.7,0,body); v.scale.set(1,0.92,0.86); }
}
const brassBtn = () => noseMat(0xd8b050);
const ceramicBead = () => noseMat(0xf8f4ec);
export const buildAnimal = asChar(spec => CH.buildCritter(spec.look ? { ...CH.parseLook(spec.look), acc:spec.acc, accC:spec.accC } : spec));
function _buildAnimal(spec){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body); const fur=felt(spec.fur), muzC=spec.muzzle||spec.belly||0xffffff, inner=felt(spec.cheek);
  const torso=mk(G.sph(0.48,26,20), fur, 0,0.7,0,body); torso.scale.set(1,0.92,0.86);
  const head=new THREE.Group(); head.position.y=1.42; body.add(head); const R=0.58;
  const sk=mk(G.sph(R,30,24), fur, 0,0,0,head); sk.scale.set(1.08,0.94,0.98);
  const E=spec.ears, ears=[];
  const SP=spec.species, snout={ fox:'pointy', hedgehog:'pointy', goat:'long', deer:'long', rabbit:'small', cat:'small', mouse:'small', sheep:'small' }[SP]||'round';
  const pink=['rabbit','cat','mouse','sheep','hedgehog'].includes(SP);
  plushFace(head, R, { eye:1, cheek:spec.cheek, muzzle: SP==='frog'||SP==='tortoise' ? null : muzC, snout, whiskers:['cat','mouse','otter','rabbit'].includes(SP), nose: SP==='frog'?0x3a6a2a : pink?0xe88a9a : 0x3a2a2a });
  if (SP==='goat'){ const bd=mk(G.cone(0.08,0.18,8), felt(0xfffaf0), 0,-R*0.55,R*0.78, head); bd.rotation.x=Math.PI+0.3; }
  if (SP==='deer') for (let i=0;i<5;i++) mk(G.sph(0.035,8,6), felt(0xfff4e8), Math.cos(i*1.3)*0.22, 0.25+(i%2)*0.08, -0.35-(i%3)*0.05, head).scale.z=0.4;
  if (SP==='fox'){ for (const s of [-1,1]) mk(G.sph(0.18,12,10), felt(0xffffff), s*0.22,-0.2,0.38,head).scale.set(1,0.7,0.5); }
  if (E==='long') for (const s of [-1,1]) ears.push(ear(head, s*0.2,0.42,-0.05, s*-0.12, p=>{ const e=mk(G.cap(0.12,0.42,6,12), fur, 0,0.3,0,p); e.scale.set(1,1,0.55); const i=mk(G.cap(0.07,0.34,6,10), inner, 0,0.3,0.05,p); i.scale.set(1,1,0.4); }));
  if (E==='round') for (const s of [-1,1]) ears.push(ear(head, s*0.4,0.38,-0.04, s*-0.4, p=>{ const e=mk(G.sph(0.17,14,12), fur, 0,0.06,0,p); e.scale.z=0.55; mk(G.sph(0.1,12,10), inner, 0,0.06,0.06,p).scale.z=0.3; }));
  if (E==='cat') for (const s of [-1,1]) ears.push(ear(head, s*0.32,0.42,0, s*-0.32, p=>{ const e=mk(G.cone(0.18,0.34,10), fur, 0,0.13,0,p); e.scale.z=0.6; const i=mk(G.cone(0.1,0.22,8), inner, 0,0.1,0.06,p); i.scale.z=0.3; if (SP==='fox'){ const tp=mk(G.cone(0.085,0.12,10), felt(0x3a2a22), 0,0.26,0,p); tp.scale.z=0.62; } }));
  if (E==='mouse') for (const s of [-1,1]) ears.push(ear(head, s*0.42,0.36,-0.05, s*-0.35, p=>{ const e=mk(G.sph(0.25,16,12), fur, 0,0.12,0,p); e.scale.z=0.3; mk(G.sph(0.17,12,10), inner, 0,0.12,0.04,p).scale.z=0.22; }));
  if (E==='goat'||E==='deer'||E==='sheep') for (const s of [-1,1]) ears.push(ear(head, s*0.5,0.1,0, s*(E==='sheep'?-1.9:-1.4), p=>{ const e=mk(G.sph(0.14,12,10), fur, 0,0.14,0,p); e.scale.set(0.7,1.6,0.45); const i=mk(G.sph(0.08,10,8), inner, 0,0.14,0.05,p); i.scale.set(0.6,1.5,0.3); }));
  if (E==='goat') for (const s of [-1,1]){ const h=mk(G.cone(0.08,0.36,10), felt(0xd8c8a0), s*0.17,0.58,-0.12,head); h.rotation.set(-0.55,0,s*-0.28); }
  if (E==='deer') for (const s of [-1,1]){ const a=mk(G.cap(0.035,0.32,4,8), felt(0xe8d8b0), s*0.2,0.66,-0.06,head); a.rotation.z=s*-0.3; const b=mk(G.cap(0.03,0.14,4,8), felt(0xe8d8b0), s*0.3,0.76,-0.06,head); b.rotation.z=s*-1.0; }
  if (spec.species==='sheep'){ const wool=felt(0xfffaf0); for (let i=0;i<16;i++){ const a=i/16*TAU, rr=0.36+(i%3)*0.06; mk(G.sph(0.16+(i%2)*0.03,12,10), wool, Math.cos(a)*rr*0.9, 0.34+Math.sin(i*1.7)*0.05, Math.sin(a)*rr*0.75-0.06, head); } mk(G.sph(0.2,12,10), wool, 0,0.5,0,head);
    for (let i=0;i<10;i++){ const a=i/10*TAU; mk(G.sph(0.2,12,10), wool, Math.cos(a)*0.34, 0.68+Math.sin(i*2.1)*0.05, Math.sin(a)*0.28, body); } }
  if (spec.species==='frog') for (const s of [-1,1]){ const e=ear(head, s*0.24,0.42,0.12, 0, p=>{ mk(G.sph(0.17,14,12), fur, 0,0,0,p); const ey=mk(G.sph(0.08,12,10), eyeMat(), 0,0.03,0.13,p); ey.scale.z=0.6; mk(G.sph(0.022,6,5), glintMat(), 0.02,0.06,0.17,p); }); ears.push(e); }
  if (spec.species==='hedgehog'){ const sp=felt(0x7a5a3a); for (let i=0;i<34;i++){ const a=(i/34)*Math.PI*1.6-Math.PI*0.3, el=0.3+((i*7)%5)*0.18, rr=R*1.02; const c=mk(G.cone(0.07,0.24,6), sp, Math.cos(a)*Math.cos(el)*rr, Math.sin(el)*rr-0.05, -Math.abs(Math.sin(a))*Math.cos(el)*rr-0.05, head); c.lookAt(c.position.clone().multiplyScalar(3)); c.rotateX(Math.PI/2); } }
  dress(body, head, spec);
  const L=plushLimbs(g, body, fur, felt(new THREE.Color(spec.fur).offsetHSL(0,0,0.06).getHex()), fur, fur, inner);
  const tails={ rabbit:p=>mk(G.sph(0.14,12,10), felt(0xffffff), 0,0,0,p), cat:p=>{ const t=mk(G.cap(0.07,0.5,6,10), fur, 0,0.25,0,p); }, bear:p=>mk(G.sph(0.1,10,8), fur, 0,0,0,p),
    goat:p=>mk(G.cone(0.07,0.16,8), fur, 0,0.06,0,p), deer:p=>mk(G.sph(0.09,10,8), felt(0xffffff), 0,0,0,p), sheep:p=>mk(G.sph(0.14,12,10), felt(0xfffaf0), 0,0,0,p),
    mouse:p=>{ const t=mk(G.cap(0.025,0.6,4,8), inner, 0,0.3,0,p); }, hedgehog:p=>mk(G.sph(0.06,8,6), fur, 0,0,0,p) };
  let tail=null; if (tails[spec.species]){ tail=new THREE.Group(); tail.position.set(0,0.5,-0.38); tail.rotation.x = spec.species==='cat'||spec.species==='mouse' ? -0.9 : 0; tail.userData.base=tail.rotation.x; body.add(tail); tails[spec.species](tail); }
  g.userData={ body, head, arms:L.arms, legs:L.legs, ears, tail }; return g;
}
// A cozy bicycle, faces +z like the player
export function buildBike(color=0xd8604a){
  const g=new THREE.Group(), frame=M(color), dark=M(0x3a3430), chrome=M(0xd9d4c8), seat=M(0x6a4a3a);
  const wheel=z=>{ const w=new THREE.Group(); w.position.set(0,0.34,z); g.add(w);
    const tire=mk(new THREE.TorusGeometry(0.3,0.045,8,22), dark, 0,0,0,w); tire.rotation.y=Math.PI/2;
    for(let i=0;i<3;i++){ const sp=mk(G.box(0.02,0.56,0.02), chrome, 0,0,0,w); sp.rotation.x=i*Math.PI/3; }
    mk(G.box(0.06,0.08,0.08), chrome, 0,0,0,w); return w; };
  const wf=wheel(0.48), wb=wheel(-0.48);
  const bar=(x1,y1,z1,x2,y2,z2,r=0.035,mat=frame)=>{ const a=new THREE.Vector3(x1,y1,z1), b=new THREE.Vector3(x2,y2,z2), L=a.distanceTo(b); const m=mk(G.cyl(r,r,L,8), mat, (x1+x2)/2,(y1+y2)/2,(z1+z2)/2, g); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), b.clone().sub(a).normalize()); return m; };
  bar(0,0.34,-0.48, 0,0.42,0.02); bar(0,0.42,0.02, 0,0.78,-0.12); bar(0,0.78,-0.12, 0,0.82,0.36); bar(0,0.42,0.02, 0,0.82,0.36);
  bar(0,0.34,0.48, 0,0.95,0.38); bar(0,0.34,-0.48, 0,0.78,-0.12, 0.03);
  bar(-0.26,0.98,0.36, 0.26,0.98,0.36, 0.03, chrome);
  for(const s of [-1,1]) mk(G.cap(0.04,0.08,4,8), dark, s*0.28,0.98,0.36, g).rotation.z=Math.PI/2;
  const st=mk(G.box(0.18,0.06,0.3), seat, 0,0.86,-0.16, g);
  const basket=mk(G.box(0.34,0.18,0.24), M(0xc9a06a), 0,0.86,0.58, g);
  g.userData={ wheels:[wf,wb] }; return g;
}
export const buildPlayer = asChar((o={}) => CH.buildCritter(typeof o.look==='string' ? CH.parseLook(o.look) : (o.look || CH.defaultLook())));
function _buildPlayer(o={}){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const skinC=o.skin||0xf6cfae, skin=felt(skinC), hairC=o.hair||0x6a4030, shirt=o.shirt||0x6fb7d8;
  const torso=mk(G.sph(0.46,24,18), skin, 0,0.7,0,body); torso.scale.set(1,0.92,0.86);
  const sh=mk(G.sph(0.475,24,16,0,TAU,Math.PI*0.12,Math.PI*0.48), knit(shirt), 0,0.7,0,body); sh.scale.set(1,0.92,0.86);
  const shorts=mk(G.sph(0.47,24,14,0,TAU,Math.PI*0.6,Math.PI*0.28), felt(0x4a5a8a), 0,0.7,0,body); shorts.scale.set(1.01,0.93,0.87);
  const col=mk(G.tor(0.2,0.05,8,18), knit(0xffffff,null,4), 0,1.1,0,body); col.rotation.x=Math.PI/2;
  const head=new THREE.Group(); head.position.y=1.42; body.add(head); const R=0.54;
  mk(G.sph(R,30,24), skin, 0,0,0,head).scale.set(1.06,0.96,0.98);
  plushFace(head, R, { eye:0.95, cheek:0xf5a3a3, muzzle:null, nose:0xe8a080 });
  for (const s of [-1,1]) mk(G.sph(0.09,10,8), skin, s*0.56,-0.04,0,head).scale.set(0.45,1,0.8);
  // yarn hair: a cap and a fringe of soft loops
  const yarn=knit(hairC,null,18); const cap=mk(G.sph(R*1.06,26,16,0,TAU,0,Math.PI*0.52), yarn, 0,0.03,-0.04,head); cap.rotation.x=-0.28;
  for (let i=0;i<7;i++){ const a=-0.9+i*0.3, b=mk(G.sph(0.12,10,8), felt(hairC), Math.sin(a)*0.42, 0.3-Math.abs(a)*0.08, Math.cos(a)*0.38, head); b.scale.set(1,0.75,0.65); }
  const L=plushLimbs(g, body, knit(shirt), skin, skin, felt(0x8a4a2a), null);
  const hand=new THREE.Group(); hand.position.set(0.07,-0.27,0.06); L.arms[1].add(hand);
  g.userData={ body, head, arms:L.arms, legs:L.legs, hand, ears:[], tail:null }; return g;
}
function gableRoof(g, W, D, H, roofC, trimC, pitch=0.55, over=0.45){
  const hd=D/2+over, rise=hd*Math.tan(pitch), Ls=hd/Math.cos(pitch);
  const shA=M(roofC), shB=M(new THREE.Color(roofC).offsetHSL(0,0,-0.06).getHex());
  for(const s of [1,-1]){
    const slab=new THREE.Group(); slab.position.set(0, H+rise/2+0.05, s*hd/2); slab.rotation.x = s*pitch; g.add(slab);
    mk(G.box(W+0.9, 0.16, Ls), M(trimC), 0,0,0,slab);
    const rows=5; for(let i=0;i<rows;i++){ const z=-Ls/2+(i+0.5)*Ls/rows; mk(G.box(W+0.95, 0.09, Ls/rows+0.06), i%2?shA:shB, 0, 0.11+(rows-i)*0.012, z*s, slab); }
  }
  mk(G.box(W+1.0,0.18,0.3), M(trimC), 0,H+rise+0.12,0,g);
  const tri=new THREE.Shape(); tri.moveTo(-D/2,0); tri.lineTo(D/2,0); tri.lineTo(0,rise*D/2/hd); tri.lineTo(-D/2,0);
  for(const s of [1,-1]){ const m=mk(new THREE.ExtrudeGeometry(tri,{ depth:0.12, bevelEnabled:false }), M(0xfff6e6), s*(W/2-0.06)-(s>0?0:0.12)+ (s>0?0:0), H, 0, g); m.rotation.y=Math.PI/2; m.position.x = s>0 ? W/2-0.12 : -W/2; }
  return rise;
}
function windowAt(g, x, y, z, ry=0, accent=0x6a9ad8, w=0.75, h=0.75){
  const p=new THREE.Group(); p.position.set(x,y,z); p.rotation.y=ry; g.add(p);
  mk(G.box(w+0.16,h+0.16,0.08), M(0xffffff), 0,0,0,p); mk(G.box(w,h,0.06), windowMat, 0,0,0.03,p);
  mk(G.box(0.05,h,0.08), M(0xffffff), 0,0,0.05,p); mk(G.box(w,0.05,0.08), M(0xffffff), 0,0,0.05,p);
  for(const s of [-1,1]) mk(G.box(0.3,h+0.1,0.05), M(accent), s*(w/2+0.24),0,0.02,p);
  mk(G.box(w+0.2,0.18,0.24), M(0x8b5e3a), 0,-h/2-0.12,0.14,p);
  const fc=PALETTE.spring.flower; for(let k=0;k<4;k++) mk(G.ico(0.08,1), M(fc[k%fc.length]), -w/2+0.12+k*(w-0.2)/3, -h/2+0.02, 0.16, p);
  return p;
}
export function buildHouse(level, wallC=0xfff1d6, roofC=0xe0745a, accent=0x6a9ad8){
  if (level===0) return buildTent();
  const g=new THREE.Group();
  const dims = [null,[4.2,2.4,3.4],[5.2,2.7,4.2],[6.6,3.4,5.0]][level], [W,H,D]=dims, trim=0x8b5e3a;
  mk(G.box(W+0.3,0.35,D+0.3), M(0xb8b0a0), 0,0.17,0,g);
  for(let i=0;i<Math.floor(W/0.5);i++) mk(G.box(0.42,0.2,0.08), M(i%2?0xa8a090:0xc0b8a8), -W/2+0.25+i*0.5, 0.18, D/2+0.17, g);
  mk(G.box(W,H,D), M(wallC), 0,0.35+H/2,0,g);
  for(const x of [-1,1]) for(const z of [-1,1]) mk(G.box(0.18,H,0.18), M(trim), x*W/2, 0.35+H/2, z*D/2, g);
  mk(G.box(W+0.1,0.14,D+0.1), M(trim), 0,0.35+H,0,g);
  gableRoof(g, W, D, 0.35+H, roofC, trim);
  // door
  const dz=D/2+0.02; mk(G.box(1.1,1.75,0.1), M(0xffffff), 0,0.35+0.87,dz,g); mk(G.box(0.85,1.55,0.08), M(0x8a5a3a), 0,0.35+0.8,dz+0.03,g);
  mk(G.cyl(0.14,0.14,0.04,14), windowMat, 0,0.35+1.25,dz+0.08,g).rotation.x=Math.PI/2; mk(G.sph(0.05,8,6), M(0xf3c35a,{metalness:0.6,roughness:0.3}), 0.28,0.35+0.75,dz+0.1,g);
  mk(G.box(1.3,0.12,0.6), M(0xc0b8a8), 0,0.06,D/2+0.45,g);
  const off=W/2-0.95; windowAt(g,-off,0.35+H*0.58,dz,0,accent); windowAt(g,off,0.35+H*0.58,dz,0,accent);
  windowAt(g,W/2+0.02,0.35+H*0.58,0,Math.PI/2,accent); windowAt(g,-W/2-0.02,0.35+H*0.58,0,-Math.PI/2,accent);
  const ch=new THREE.Group(); ch.position.set(W/2-0.9, 0.35+H, -D/4); g.add(ch); mk(G.box(0.5,2.2,0.5), M(0xb06a50), 0,1.1,0,ch); mk(G.box(0.62,0.12,0.62), M(0x8a4a3a), 0,2.2,0,ch);
  g.userData.chimney=new THREE.Vector3(W/2-0.9, 0.35+H+2.4, -D/4);
  const lamp=new THREE.Group(); lamp.position.set(0.75,0.35+1.6,dz+0.12); g.add(lamp); mk(G.box(0.18,0.26,0.18), glowMat(0xffd27a), 0,0,0.06,lamp); mk(G.cone(0.16,0.12,4), M(0x3a2e26), 0,0.18,0.06,lamp).rotation.y=Math.PI/4; addGlow(lamp,0,2.4);
  if (level===3){ mk(G.box(2.6,0.14,1.6), M(0xc99a6a), 0,0.36,D/2+0.85,g); for(const s of [-1,1]) mk(G.cyl(0.08,0.08,2.0,10), M(0xffffff), s*1.1,1.36,D/2+1.5,g); const pr=mk(G.box(2.9,0.14,1.8), M(roofC), 0,2.4,D/2+0.9,g); pr.rotation.x=0.18;
    const dm=new THREE.Group(); dm.position.set(-W/4,0.35+H+0.9,D/4); g.add(dm); mk(G.box(1.1,0.9,0.9),M(wallC),0,0,0,dm); windowAt(dm,0,0,0.46,0,accent,0.5,0.45); }
  const mb=new THREE.Group(); mb.position.set(-W/2-0.4,0,D/2+1.0); FURN_BUILDERS.mailbox(mb); g.add(mb);
  g.userData.size={W,D}; return g;
}
function buildTent(){
  const g=new THREE.Group(), cloth=M(0x7fbf9f), clothD=M(0x5fa088), trim=M(0xf3e8c8);
  mk(G.box(3.8,0.05,3.8), M(0xd8c8a0), 0,0.02,0,g).castShadow=false;
  const tri=new THREE.Shape(); tri.moveTo(-1.6,0); tri.lineTo(1.6,0); tri.lineTo(0,2.3); tri.lineTo(-1.6,0);
  const body=mk(new THREE.ExtrudeGeometry(tri,{ depth:3.2, bevelEnabled:true, bevelThickness:0.04, bevelSize:0.04, bevelSegments:1 }), cloth, 0,0,-1.6,g);
  for(const s of [-1,1]){ const st=mk(G.box(0.08,2.75,3.3), trim, s*0.8,1.13,0,g); st.rotation.z=s*0.6; st.castShadow=false; }
  const dark=new THREE.Shape(); dark.moveTo(-0.7,0); dark.lineTo(0.7,0); dark.lineTo(0,1.5); dark.lineTo(-0.7,0);
  mk(new THREE.ShapeGeometry(dark), M(0x2e4a3e), 0,0.02,1.66,g);
  for(const s of [-1,1]){ const fl=new THREE.Shape(); fl.moveTo(0,0); fl.lineTo(s*0.75,0); fl.lineTo(0,1.55); fl.lineTo(0,0); const m=mk(new THREE.ExtrudeGeometry(fl,{depth:0.04,bevelEnabled:false}), clothD, s*0.05,0.02,1.66,g); m.rotation.y=s*-0.5; }
  mk(G.cyl(0.04,0.04,0.7,6), M(0x8b5e3a), 0,2.55,1.5,g); mk(G.box(0.42,0.24,0.02), M(0xf3c35a), 0.22,2.75,1.5,g);
  for(const s of [-1,1]){ const r=mk(G.cyl(0.012,0.012,1.6,4), M(0xd8c8a0), s*1.9,0.6,1.7,g); r.rotation.z=s*-0.95; mk(G.cyl(0.03,0.03,0.25,5), M(0x8b5e3a), s*2.45,0.1,1.7,g); }
  const lamp=new THREE.Group(); lamp.position.set(1.4,0,2.1); g.add(lamp); mk(G.cyl(0.04,0.05,1.1,6), M(0x4a3a30),0,0.55,0,lamp); mk(G.box(0.22,0.26,0.22), glowMat(0xffd27a),0,1.2,0,lamp); addGlow(lamp,1.2,2.2);
  const seat=mk(G.cyl(0.22,0.25,0.4,10), M(0xa8754a), -1.5,0.2,2.0,g);
  g.userData.size={W:3.4,D:3.4}; return g;
}
export function buildStall(){
  const g=new THREE.Group();
  mk(G.box(3.4,1.0,1.1), M(WOOD), 0,0.5,0.4,g); for(let i=0;i<6;i++) mk(G.box(0.04,0.9,0.02), M(WOOD2), -1.5+i*0.6,0.5,0.96,g); mk(G.box(3.6,0.12,1.3), M(WOODL), 0,1.04,0.4,g);
  for(const x of [-1.6,1.6]) for(const z of [-0.2,1.0]) mk(G.cyl(0.07,0.07,2.6,8), M(WOOD2), x,1.3,z,g);
  for(let i=0;i<8;i++){ const s=mk(G.box(0.46,0.06,1.9), M(i%2?0xffffff:0xe8604d), -1.64+i*0.47+0.23, 2.65, 0.4, g); s.rotation.x=0.22; mk(G.cone(0.23,0.16,8,1,false,0,Math.PI),M(i%2?0xffffff:0xe8604d),-1.64+i*0.47+0.23,2.48,1.36,g).rotation.x=Math.PI; }
  const fc=[0xe2483d,0xf59a2f,0xc9d65a,0x8a4fa8]; for(let i=0;i<4;i++){ mk(G.box(0.6,0.25,0.45), M(WOOD2), -1.1+i*0.73,1.22,0.45,g); for(let k=0;k<3;k++) mk(G.sph(0.1,10,8), M(fc[i]), -1.25+i*0.73+k*0.14,1.4,0.45,g); }
  mk(G.cyl(0.2,0.18,0.35,12), M(0xbfe6f0,{transparent:true,opacity:0.7,roughness:0.1}), 1.45,1.28,0.85,g);
  const sign=mk(G.box(1.6,0.5,0.08), M(0xfff1d6), 0,2.25,1.25,g); sign.rotation.x=0.2;
  return g;
}
export function buildBoard(){
  const g=new THREE.Group(); for(const x of [-0.9,0.9]) mk(G.cyl(0.08,0.1,2.2,8), M(WOOD2), x,1.1,0,g);
  mk(G.box(2.2,1.3,0.12), M(WOOD), 0,1.45,0,g); mk(G.box(2.4,0.14,0.3), M(0xe0745a), 0,2.2,0,g);
  const pc=[0xfff8ea,0xfff0b0,0xd8f0ff,0xffd8d8]; for(let i=0;i<4;i++){ const p=mk(G.box(0.45,0.55,0.02), M(pc[i]), -0.65+i*0.43,1.45+(i%2)*0.12-0.06,0.07,g); p.rotation.z=(i-1.5)*0.08; p.castShadow=false; mk(G.sph(0.03,6,5),M(0xe2483d),p.position.x,p.position.y+0.22,0.09,g); }
  return g;
}
export function buildPlankDeck(len, width, y, cols=[WOOD,WOODL]){
  const g=new THREE.Group();
  for(let x=0; x<len; x+=0.55){ const p=mk(G.box(0.5,0.12,width), M(cols[Math.round(x*2)%2]), x+0.25,y-0.06,0,g); p.rotation.y=(hash2(x*10|0,1)-0.5)*0.03; }
  return g;
}

/* ---------- Interiors ---------- */
export function buildRoom(spec, W, D){
  const g=new THREE.Group();
  const fl=new THREE.Color(spec.floor||0xc99a6a);
  for(let z=-D/2; z<D/2-0.01; z+=0.5){ const c=fl.clone().offsetHSL(0,0,((Math.round(z*2)%2)?0.03:-0.02)); const p=mk(G.box(W,0.1,0.48), new THREE.MeshStandardMaterial({color:c,roughness:0.7}), 0,-0.05,z+0.25,g); p.castShadow=false; }
  const wc=new THREE.Color(spec.wall||0xfff0d0), wc2=wc.clone().offsetHSL(0,0,-0.06), pat=spec.pattern||'plain';
  const tex=canvasTex(128,128,x=>{ x.fillStyle=hex(wc); x.fillRect(0,0,128,128); x.fillStyle=hex(wc2);
    if(pat==='stripe') for(let i=0;i<4;i++) x.fillRect(i*32,0,14,128);
    else if(pat==='dots') for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.beginPath(); x.arc(i*32+16+(j%2)*16,j*32+16,5,0,TAU); x.fill(); }
    else if(pat==='check') for(let i=0;i<4;i++) for(let j=0;j<4;j++) if((i+j)%2) x.fillRect(i*32,j*32,32,32); }, [W/1.6, 2]);
  const wallMat=new THREE.MeshStandardMaterial({ map:tex, roughness:0.9 });
  const H=3.2;
  const back=mk(G.box(W+0.4,H,0.2), wallMat, 0,H/2,-D/2-0.1,g); back.geometry.translate(0,-H/2,0); back.position.y=0;
  const tex2=tex.clone(); tex2.repeat.set(D/1.6,2); tex2.needsUpdate=true; const sideMat=new THREE.MeshStandardMaterial({ map:tex2, roughness:0.9 });
  const sides=[-1,1].map(s=>{ const w=mk(G.box(0.2,H,D+0.2), sideMat, s*(W/2+0.1),0,0,g); w.geometry.translate(0,H/2,0); return w; });
  // front wall with a doorway, so the room looks finished when you turn the camera around
  const fw=(W-2.2)/2, front=[-1,1].map(s=>{ const w=mk(G.box(fw,H,0.2), wallMat, s*(1.1+fw/2),0,D/2+0.1,g); w.geometry.translate(0,H/2,0); return w; });
  const lintel=mk(G.box(2.2,H-2.4,0.2), wallMat, 0,2.4+(H-2.4)/2,D/2+0.1,g);
  // walls that drop away when the camera looks through them (normal points out of the room)
  const backDeco=[]; g.userData.cutWalls=[ { meshes:[back], hide:backDeco, nx:0, nz:-1 }, { meshes:[sides[0]], nx:-1, nz:0 }, { meshes:[sides[1]], nx:1, nz:0 }, { meshes:front, hide:[lintel], nx:0, nz:1 } ];
  const acc=M(spec.accent||0x8b5e3a);
  mk(G.box(W,0.22,0.06), acc, 0,0.11,-D/2+0.03,g); for(const s of [-1,1]) mk(G.box(0.06,0.22,D), acc, s*(W/2-0.03),0.11,0,g);
  backDeco.push(mk(G.box(W+0.4,0.12,0.24), acc, 0,H,-D/2-0.1,g));
  for(const s of [-1,1]) mk(G.box(W/2-0.8,0.25,0.15), acc, s*(W/4+0.4),0.12,D/2-0.05,g);
  // window + curtains
  const win=new THREE.Group(); win.position.set(-W/4,1.8,-D/2+0.02); g.add(win); backDeco.push(win); mk(G.box(1.2,1.1,0.06),M(0xffffff),0,0,0,win); mk(G.box(1.0,0.9,0.04),windowMat,0,0,0.03,win); mk(G.box(0.05,0.9,0.06),M(0xffffff),0,0,0.05,win);
  for(const s of [-1,1]) mk(G.box(0.32,1.4,0.05),acc,s*0.72,0,0.08,win); mk(G.box(1.8,0.06,0.06),M(0x8b5e3a),0,0.72,0.1,win);
  // painting
  const pt=canvasTex(64,48,x=>{ const r=mulberry32((spec.floor||1)%997); x.fillStyle='#bfe6f0'; x.fillRect(0,0,64,48); x.fillStyle='#8ed36a'; x.fillRect(0,30,64,18); x.fillStyle='#f6c94d'; x.beginPath(); x.arc(14+r()*30,14,7,0,TAU); x.fill(); x.fillStyle='#e07a5a'; x.fillRect(36,22,14,14); x.fillStyle='#8a4a3a'; x.beginPath(); x.moveTo(34,23); x.lineTo(43,15); x.lineTo(52,23); x.fill(); });
  const pa=mk(G.box(1.0,0.78,0.06),M(0x8b5e3a),W/4,1.9,-D/2+0.03,g); backDeco.push(pa, mk(G.box(0.86,0.64,0.02),new THREE.MeshStandardMaterial({map:pt}),W/4,1.9,-D/2+0.07,g));
  mk(G.box(1.2,0.03,0.7), M(spec.accent||0xd8805a), 0,0.015,D/2-0.45,g).castShadow=false;
  const light=new THREE.PointLight(0xffe0b0, 30, 18, 1.6); light.position.set(0,2.8,0.5); light.castShadow=false; g.add(light);
  return g;
}

/* ---------- Ambient wildlife (not catchable) ---------- */
export function buildBird(c=0x8a6a4a){ const g=new THREE.Group(); mk(G.sph(0.12,10,8),M(c),0,0.15,0,g).scale.set(0.9,0.85,1.2); mk(G.sph(0.08,10,8),M(c),0,0.25,0.1,g); const b=mk(G.cone(0.025,0.07,6),M(0xf0a030),0,0.25,0.19,g); b.rotation.x=Math.PI/2; mk(G.sph(0.018,6,5),M(0x111111),0.05,0.27,0.15,g); mk(G.sph(0.018,6,5),M(0x111111),-0.05,0.27,0.15,g); const wings=[]; for(const s of [1,-1]){ const w=mk(G.sph(0.5,8,4),M(new THREE.Color(c).offsetHSL(0,0,-0.08).getHex()),s*0.1,0.17,-0.02,g); w.scale.set(0.12,0.03,0.2); wings.push(w); w.userData.side=s; } g.userData.wings=wings; return g; }
export function buildGull(){ const g=buildBird(0xffffff); g.scale.setScalar(2.2); return g; }
export function buildDuck(){ const g=new THREE.Group(); mk(G.sph(0.22,12,10),M(0xf2ead8),0,0.12,0,g).scale.set(0.9,0.7,1.3); mk(G.sph(0.13,12,10),M(0x2a7a4a),0,0.36,0.2,g); const b=mk(G.box(0.1,0.04,0.12),M(0xf0a030),0,0.34,0.36,g); mk(G.sph(0.02,6,5),M(0x111111),0.07,0.4,0.27,g); mk(G.sph(0.02,6,5),M(0x111111),-0.07,0.4,0.27,g); mk(G.cone(0.08,0.15,6),M(0xf2ead8),0,0.2,-0.3,g).rotation.x=-1.2; return g; }
