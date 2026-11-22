// 3D model builders. Everything is made from simple shapes so it stays light and easy to change.
import * as THREE from 'three';
import { TAU, hash2, mulberry32 } from './util.js';
import { ITEMS, PLANTS } from './content.js';

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
  const bark = type==='birch'?0xeee8e0:(type==='palm'?0xb08a5a:0x8a5e3a);
  if (type==='palm'){
    let x=0,y=0; const lean=0.18;
    for(let i=0;i<7;i++){ const s=mk(G.cyl(0.17-i*0.01,0.2-i*0.01,0.58,9), M(i%2?0xb8925e:0x9a7448), x,y+0.29,0,top); s.rotation.z=-lean; x+=Math.sin(lean)*0.58; y+=0.56; }
    for(let i=0;i<8;i++){ const a=i/8*TAU; const lf=mk(G.sph(1,10,4), M(i%2?0x4fae46:0x5fbe52), x+Math.cos(a)*1.0, y-0.05, Math.sin(a)*1.0, top); lf.scale.set(1.3,0.07,0.34); lf.rotation.set(0,-a,-0.4); }
    if (stage===3 && opt.fruit) for(let i=0;i<3;i++){ const a=i/3*TAU+0.4; fruits.push(outline(mk(G.sph(0.24,12,10), M(0x7a4a28), x+Math.cos(a)*0.34, y-0.32, Math.sin(a)*0.34, top),1.08)); }
    return g;
  }
  if (type==='pine' || type==='cedar'){
    mk(G.cyl(0.18,0.26,1.2,9), M(0x7a5232), 0,0.6,0,top);
    const col = type==='pine' ? [0x3f8f4e,0x4a9a58] : [0x2f7a50,0x3a8a5a]; const tiers = type==='pine'?3:5;
    for(let i=0;i<tiers;i++){ const rr = type==='pine' ? 1.6-i*0.42 : 1.25-i*0.2; const h = type==='pine'?1.6:1.0; const y = type==='pine' ? 1.6+i*0.9 : 1.4+i*0.62;
      mk(G.cone(rr,h,12), M(col[i%2]), 0, y, 0, top); if(season==='winter') mk(G.cone(rr*0.6,h*0.35,12), M(0xffffff), 0, y+h*0.32, 0, top); }
    return g;
  }
  // deciduous
  const tall = type==='birch' ? 2.4 : 1.8;
  mk(G.cyl(0.18,0.3,tall,10), M(bark), 0,tall/2,0,top);
  mk(G.cone(0.42,0.4,10), M(bark), 0,0.2,0,top);
  if (type==='birch') for(let i=0;i<6;i++){ const b=mk(G.box(0.12,0.04,0.02), M(0x3a3030), Math.cos(i*2.1)*0.2, 0.3+i*0.35, Math.sin(i*2.1)*0.2, top); b.rotation.y=-i*2.1+Math.PI/2; b.castShadow=false; }
  for(const [ax,ay,az] of [[0.55,tall*0.8,0.1],[-0.5,tall*0.85,-0.2]]){ const b=mk(G.cyl(0.06,0.1,0.9,6), M(bark), ax*0.6,ay,az,top); b.rotation.z=-ax*1.3; }
  const pal = (LEAVES[type]||LEAVES.oak)[season];
  if (!pal){ // winter: bare branches with a dusting of snow
    for(let i=0;i<6;i++){ const a=i/6*TAU+r(); const b=mk(G.cyl(0.03,0.07,1.3,5), M(bark), Math.cos(a)*0.4, tall+0.3, Math.sin(a)*0.4, top); b.rotation.set(Math.sin(a)*0.8,0,-Math.cos(a)*0.8); }
    mk(G.sph(0.35,10,8), M(0xffffff), 0, tall+0.6, 0, top).scale.y=0.4;
    if (opt.fruit && stage===3){ const fm=M(ITEMS[opt.fruit].model.c); for(let i=0;i<6;i++){ const a=i/6*TAU+r()*0.4; fruits.push(hangFruit(top, fm, Math.cos(a)*0.85, tall+0.55+(i%2)*0.35, Math.sin(a)*0.85, opt.fruit)); } }
    return g;
  }
  const crowns = type==='birch' ? [[0,tall+0.9,0,0.95],[0.4,tall+0.3,0.3,0.7],[-0.35,tall+0.4,-0.2,0.75],[0,tall+1.6,0,0.7]]
    : [[0,tall+0.85,0,1.35],[0.85,tall+0.5,0.3,0.95],[-0.8,tall+0.55,-0.2,1.0],[0.1,tall+1.6,-0.1,1.0],[-0.25,tall+0.6,0.8,0.9],[0.35,tall+0.45,-0.75,0.85]];
  crowns.forEach(([x,y,z,s])=>{ const c=pal[Math.floor(r()*pal.length)]; const f=mk(G.ico(s,2), M(c), x,y,z,top); f.scale.y=0.86; });
  if (opt.fruit && stage===3){ const fm=M(ITEMS[opt.fruit].model.c);
    // put each fruit just outside a crown's surface so it pokes out of the leaves
    const outer=crowns.slice(1); for(let i=0;i<6;i++){ const [x,y,z,s]=outer[i%outer.length]; let dx=x+(r()-0.5)*0.6, dz=z+(r()-0.5)*0.6; if(Math.hypot(dx,dz)<0.3){ const a=i/6*TAU; dx=Math.cos(a); dz=Math.sin(a); }
      const L=Math.hypot(dx,dz); const dy=-0.3-r()*0.3; const n=Math.hypot(dx/L,dy,dz/L); const ux=dx/L/n, uy=dy/n, uz=dz/L/n; const rr=s*1.02;
      fruits.push(hangFruit(top, fm, x+ux*rr, y+uy*rr*0.86, z+uz*rr, opt.fruit)); } }
  if (type==='blossom' && season==='spring') for(let i=0;i<14;i++){ const a=r()*TAU, e=r()*1.2; mk(G.sph(0.09,6,5), M(0xffffff), Math.cos(a)*1.2, tall+0.6+e, Math.sin(a)*1.2, top).castShadow=false; }
  return g;
}
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
export function buildStump(){ const g=new THREE.Group(); mk(G.cyl(0.32,0.42,0.35,12), M(0x8a5e3a), 0,0.17,0,g); mk(G.cyl(0.3,0.3,0.02,12), M(0xd8b080), 0,0.35,0,g); for(let i=0;i<3;i++){ const a=i/3*TAU; const r=mk(G.cyl(0.06,0.1,0.45,6), M(0x7a5232), Math.cos(a)*0.38,0.06,Math.sin(a)*0.38,g); r.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2); } return g; }
export function buildShrub(sp, stage=3, color){
  const g=new THREE.Group(), P=PLANTS[sp]; const s=[0.35,0.55,0.8,1][stage];
  const body=new THREE.Group(); body.scale.setScalar(s); g.add(body);
  const lc = sp==='boxwood'?0x3f8a44 : sp==='holly'?0x2f7a3a : 0x55a848;
  const blobs=[[0,0.5,0,0.55],[0.42,0.4,0.1,0.42],[-0.4,0.42,-0.05,0.45],[0.05,0.42,0.42,0.4],[0,0.45,-0.4,0.4]];
  blobs.forEach(([x,y,z,r],i)=>{ mk(G.ico(r,2), M(i%2?lc:new THREE.Color(lc).offsetHSL(0,0,0.05).getHex()), x,y,z,body); });
  if (MODEL.season==='winter' && sp!=='holly' && sp!=='camellia') mk(G.sph(0.4,10,6), M(0xffffff), 0,0.85,0,body).scale.y=0.35;
  const blooming = stage>=2 && P.bloom && P.bloom.includes(MODEL.month) && P.colors.length;
  if (blooming){ const c=color||P.colors[0]; const rr=mulberry32(sp.length*31);
    for(let i=0;i<(P.berries?12:16);i++){ const a=rr()*TAU, e=rr()*1.1; const p=new THREE.Vector3(Math.cos(a)*Math.cos(e)*0.62, 0.45+Math.sin(e)*0.55, Math.sin(a)*Math.cos(e)*0.62);
      mk(P.berries?G.sph(0.06,8,6):G.ico(sp==='hydrangea'||sp==='lilac'?0.16:0.1,1), M(c), p.x,p.y,p.z,body).castShadow=false; } }
  return g;
}
function petalRing(g, n, len, wid, tilt, color, y, thick=0.02, mat){ for(let i=0;i<n;i++){ const a=i/n*TAU; const p=new THREE.Group(); p.position.y=y; p.rotation.y=a; g.add(p); const m=mk(G.sph(0.5,10,6), mat||M(color), 0,0,len*0.5,p); m.scale.set(wid,thick,len); m.rotation.x=-tilt; m.position.y=Math.sin(tilt)*len*0.5; m.position.z=Math.cos(tilt)*len*0.5; m.castShadow=false; } }
export function buildFlower(sp, stage=3, color){
  const g=new THREE.Group(), P=PLANTS[sp]; const c=color!==undefined?color:P.colors[0];
  if (stage===0){ const m=mk(G.sph(0.22,10,6), M(0x7a5a3a), 0,0,0,g); m.scale.y=0.35; return g; }
  const tall = P.shape==='sun' ? 1.0 : (P.shape==='lav'||P.shape==='spike'?0.5:0.42);
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
  }
  return g;
}

/* ---------- Item models (used in the world and for bag icons) ---------- */
export function buildItemModel(id){
  const it=ITEMS[id], d=it.model, g=new THREE.Group();
  if (d.t==='fruit'){ if(d.cherry){ for(const s of [-1,1]) mk(G.sph(0.16,12,10),M(d.c),s*0.13,0.16,0,g); const st=mk(G.cyl(0.015,0.015,0.4,5),M(0x5a7a2a),0,0.36,0,g); return g; }
    const r=d.big?0.34:0.27; const b=mk(G.sph(r,16,12), M(d.c), 0, r, 0, g); if(d.pear) b.scale.set(0.9,1.15,0.9); mk(G.cyl(0.025,0.03,0.14,5), M(0x6b4a2a), 0, r*2+0.04, 0, g); if(!d.big){ const lf=mk(G.sph(0.08,8,4), M(0x5fae43), 0.08, r*2+0.05, 0, g); lf.scale.set(1.4,0.4,0.8); } }
  else if (d.t==='log'){ for(let i=0;i<3;i++){ const l=mk(G.cyl(0.13,0.13,0.8,10), M(0xa8754a), 0, 0.13+(i===2?0.22:0), (i===2?0:(i-0.5)*0.27), g); l.rotation.z=Math.PI/2; mk(G.cyl(0.11,0.11,0.01,10),M(0xe0b888),0.4,l.position.y,l.position.z,g).rotation.z=Math.PI/2; } }
  else if (d.t==='branch'){ const l=mk(G.cyl(0.07,0.09,0.9,7), M(0xc8b49a), 0, 0.1, 0, g); l.rotation.z=Math.PI/2; const tw=mk(G.cyl(0.03,0.04,0.35,5), M(0xc8b49a), 0.1, 0.22, 0.05, g); tw.rotation.z=-0.8; }
  else if (d.t==='stone'){ const s=mk(G.dod(0.3), MF(0x9aa1a8), 0, 0.22, 0, g); s.scale.set(1,0.75,0.9); }
  else if (d.t==='clay'){ const s=mk(G.sph(0.28,10,8), M(0xc87a50), 0, 0.2, 0, g); s.scale.set(1.1,0.7,1); }
  else if (d.t==='iron'){ const s=mk(G.dod(0.22), MF(0x6a7078,{metalness:0.6,roughness:0.4}), 0, 0.2, 0, g); mk(G.dod(0.12), MF(0xa8b0b8,{metalness:0.8,roughness:0.3}), 0.12,0.28,0.05,g); }
  else if (d.t==='weed'){ for(let i=0;i<6;i++){ const b=mk(G.cone(0.06,0.5,5), M(0x5a9a3a), Math.cos(i*1.3)*0.1, 0.25, Math.sin(i*1.3)*0.1, g); b.rotation.set(Math.cos(i)*0.4,0,Math.sin(i)*0.4); } }
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
  else if (d.t==='fossil'){
    const base=mk(G.dod(0.32), MF(0xd9c7a3), 0, 0.18, 0, g); base.scale.set(1.15,0.55,1); const fc=M(0xb59c74);
    const s=d.s;
    if(s==='spiral'){ const t=mk(G.tor(0.15,0.06,8,16), fc, 0, 0.36, 0, g); t.rotation.x=Math.PI/2.4; }
    else if(s==='bug'){ const b=mk(G.sph(0.18,10,8), fc, 0, 0.34, 0, g); b.scale.set(0.8,0.35,1.2); for(let i=-1;i<=1;i++) mk(G.box(0.34,0.03,0.04), fc, 0, 0.4, i*0.09, g); }
    else if(s==='leaf'||s==='wing'){ const l=mk(G.sph(0.2,10,6), M(s==='leaf'?0x8a9a6a:0xa8a090), 0, 0.33, 0, g); l.scale.set(s==='wing'?1.4:0.5,0.12,s==='wing'?0.4:1.2); }
    else if(s==='tooth'){ const t=mk(G.cone(0.13,0.4,5), M(0xf2ead8), 0, 0.5, 0, g); t.rotation.z=0.2; }
    else if(s==='amber'){ mk(G.ico(0.17,1), M(0xf0a030,{transparent:true,opacity:0.85,roughness:0.2,emissive:0x8a4a00,emissiveIntensity:0.3}), 0, 0.4, 0, g); }
    else if(s==='urchin'){ const u=mk(G.sph(0.17,12,10), fc, 0, 0.36, 0, g); u.scale.y=0.6; }
    else if(s==='claw'){ const c=mk(G.cone(0.08,0.45,8), M(0xe8dcc0), 0, 0.45, 0, g); c.rotation.z=0.9; }
    else if(s==='lily'){ for(let i=0;i<5;i++){ const a=i/5*TAU; const p=mk(G.cyl(0.02,0.03,0.25,5),fc,Math.cos(a)*0.08,0.45,Math.sin(a)*0.08,g); p.rotation.set(Math.sin(a)*0.6,0,-Math.cos(a)*0.6); } mk(G.cyl(0.04,0.05,0.2,6),fc,0,0.32,0,g); }
    else if(s==='tusk'){ const t=mk(G.tor(0.3,0.06,8,16,Math.PI*0.8), M(0xf2ead8), 0, 0.32, 0, g); t.rotation.z=0.2; }
    else if(s==='egg'){ const e=mk(G.sph(0.2,14,12), M(0xe0d0b0), 0, 0.45, 0, g); e.scale.y=1.3; }
  }
  else if (d.t==='fish') buildFishInto(g, d);
  else if (d.t==='bug') buildBugInto(g, d);
  else if (d.t==='furn') FURN_BUILDERS[d.b](g);
  else if (d.t==='flower'){ g.add(buildFlower(d.sp, 3)); }
  else if (d.t==='seed'){ const P=PLANTS[d.sp]; mk(G.box(0.4,0.5,0.06), M(0xf3e2c4), 0,0.25,0,g); mk(G.box(0.42,0.08,0.07), M(0xd8c0a0), 0,0.48,0,g); const f=mk(G.cyl(0.11,0.11,0.02,14), M(P.colors[0]), 0,0.24,0.04,g); f.rotation.x=Math.PI/2; mk(G.cyl(0.04,0.04,0.025,10),M(0xf8d040),0,0.24,0.05,g).rotation.x=Math.PI/2; }
  else if (d.t==='sapling'){ const s=buildTree(mulberry32(3), d.sp, { stage:0 }); g.add(s); mk(G.sph(0.28,10,8), M(0xc8a070), 0,0.05,0,g).scale.y=0.6; }
  else if (d.t==='start'){ g.add(buildShrub(d.sp,0)); mk(G.sph(0.28,10,8), M(0xc8a070), 0,0.05,0,g).scale.y=0.6; }
  return g;
}
function buildFishInto(g, d){
  const L=d.l*0.6, body=M(d.c), belly=M(d.c2), eye=M(0x1a1a1a);
  const eyes=(x,y,z)=>{ for(const s of [1,-1]) mk(G.sph(0.035,8,6), eye, x, y, s*z, g); };
  switch(d.s){
    case 'ray': { const b=mk(G.sph(0.4,14,8), body, 0, 0.15, 0, g); b.scale.set(1,0.16,0.8); const t=mk(G.cyl(0.02,0.005,0.6,4), body, -0.55,0.15,0,g); t.rotation.z=Math.PI/2; return; }
    case 'squid': { const b=mk(G.cone(0.16,0.55,10), M(d.c,{transparent:true,opacity:0.9}), 0, 0.2, 0, g); b.rotation.z=Math.PI/2; for(let i=0;i<6;i++){ const t=mk(G.cyl(0.02,0.008,0.32,4), body, -0.4, 0.2+(i-2.5)*0.035, (i-2.5)*0.025, g); t.rotation.z=Math.PI/2; } eyes(-0.18,0.24,0.1); return; }
    case 'octo': { mk(G.sph(0.22,14,10), body, 0,0.3,0,g).scale.set(1,1.1,1); for(let i=0;i<8;i++){ const a=i/8*TAU; const t=mk(G.cap(0.04,0.3,4,6), body, Math.cos(a)*0.2,0.1,Math.sin(a)*0.2,g); t.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2); } eyes(0.12,0.34,0.1); return; }
    case 'turtle': { const s=mk(G.sph(0.3,14,10,0,TAU,0,Math.PI/2), body, 0,0.1,0,g); s.scale.set(1.1,0.7,1); mk(G.sph(0.09,10,8), belly, 0.36,0.14,0,g); for(const [x,z] of [[0.2,0.22],[0.2,-0.22],[-0.2,0.22],[-0.2,-0.22]]) mk(G.sph(0.07,8,6),belly,x,0.06,z,g).scale.set(1.4,0.5,1); return; }
    case 'cray': { const b=mk(G.cap(0.08,0.3,4,8), body, 0,0.1,0,g); b.rotation.z=Math.PI/2; for(const s of [1,-1]){ const c=mk(G.sph(0.08,8,6),body,0.3,0.1,s*0.12,g); c.scale.set(1.4,0.6,0.8); } mk(G.cone(0.1,0.15,6),body,-0.28,0.1,0,g).rotation.z=Math.PI/2; return; }
    case 'tad': { mk(G.sph(0.12,10,8), body, 0,0.12,0,g); const t=mk(G.cone(0.06,0.3,6), body, -0.2,0.12,0,g); t.rotation.z=Math.PI/2; t.scale.z=0.3; return; }
    case 'horse': { const b=mk(G.cap(0.07,0.3,4,8), body, 0,0.3,0,g); b.rotation.z=0.25; mk(G.sph(0.08,8,6),body,0.06,0.5,0,g); const sn=mk(G.cyl(0.02,0.03,0.12,6),body,0.14,0.5,0,g); sn.rotation.z=Math.PI/2; const t=mk(G.tor(0.06,0.02,6,10,Math.PI*1.4),body,-0.04,0.08,0,g); return; }
  }
  const sx = L/0.2*0.55, sy = d.s==='puff'?1.3:(d.s==='flat'?0.35:(d.s==='sun'?1.4:0.85)), sz = d.s==='eel'||d.s==='cat'?0.55:0.5;
  const b=mk(G.sph(0.2,16,12), body, 0, 0.2, 0, g); b.scale.set(sx, sy, sz);
  const be=mk(G.sph(0.18,14,10), belly, 0.02, 0.15, 0, g); be.scale.set(sx*0.82, sy*0.55, sz*0.95);
  const tail=mk(G.cone(0.15,0.26,4), d.s==='koi'?belly:body, -L*0.62-0.08, 0.2, 0, g); tail.rotation.z=Math.PI/2; tail.scale.z=0.25;
  const fin=mk(G.cone(d.s==='shark'?0.12:0.07, d.s==='shark'?0.34:0.16, 4), body, 0, 0.2+0.18*sy, 0, g); fin.scale.z=0.25;
  if (d.s==='koi') for(let i=0;i<3;i++) mk(G.sph(0.07,8,6),belly,-0.1+i*0.12,0.3,0,g).scale.set(1,0.3,0.6);
  if (d.s==='cat') for(const s of [1,-1]){ const w=mk(G.cyl(0.008,0.004,0.25,3),M(0x2a2a2a),L*0.45,0.17,s*0.08,g); w.rotation.set(s*0.6,0,Math.PI/2+0.3); }
  if (d.glow) mk(G.sph(0.04,8,6), M(0xffe08a,{emissive:0xffd060,emissiveIntensity:1.5}), L*0.55, 0.32, 0, g);
  eyes(L*0.42, 0.24, 0.09);
}
function buildBugInto(g, d){
  const w=d.w, c=M(d.c, d.glow?{emissive:d.c2,emissiveIntensity:0.6}:undefined), c2=M(d.c2), dark=M(0x2a2420);
  const wings=[]; g.userData.wings=wings;
  const legs=(y,spread=0.12)=>{ for(let i=0;i<3;i++) for(const s of [1,-1]){ const l=mk(G.cyl(0.008,0.008,0.14,3),dark,s*spread,y-0.05,(i-1)*0.06,g); l.rotation.z=s*0.9; l.castShadow=false; } };
  switch(w){
    case 'fly': case 'moth': case 'dragon': {
      const body=mk(G.cap(0.04,0.18,4,8), dark, 0,0.3,0,g); body.rotation.x=Math.PI/2;
      const sz = w==='dragon'?[0.34,0.07]:(w==='moth'?[0.26,0.2]:[0.28,0.24]);
      for(const s of [1,-1]) for(const k of (w==='dragon'?[0.05,-0.05]:[0])){ const wg=mk(G.sph(0.5,12,4), w==='dragon'?M(d.c2,{transparent:true,opacity:0.6}):c, s*sz[0]*0.55, 0.32, 0.03+k, g); wg.scale.set(sz[0], 0.015, sz[1]); wg.userData.side=s; wings.push(wg);
        if(w!=='dragon'){ const sp=mk(G.sph(0.045,8,4), c2, s*sz[0]*0.75, 0.335, 0.03, g); sp.scale.y=0.2; } }
      if (w==='dragon'){ const t=mk(G.cyl(0.02,0.015,0.34,6),c,0,0.3,-0.2,g); t.rotation.x=Math.PI/2; }
      if (w!=='dragon') for(const s of [1,-1]){ const a=mk(G.cyl(0.006,0.006,0.16,3),dark,s*0.03,0.38,0.14,g); a.rotation.set(-0.8,0,s*0.3); }
      return; }
    case 'bee': { const b=mk(G.sph(0.11,12,10), c, 0,0.3,0,g); b.scale.set(d.fat?1.1:0.9,1,1.4); for(let i=0;i<2;i++) mk(G.tor(0.105*(d.fat?1.1:0.9),0.02,6,14),c2,0,0.3,-0.04+i*0.08,g); mk(G.sph(0.07,10,8),c2,0,0.31,0.17,g);
      for(const s of [1,-1]){ const wg=mk(G.sph(0.5,10,4),M(0xffffff,{transparent:true,opacity:0.6}),s*0.1,0.42,0,g); wg.scale.set(0.16,0.01,0.1); wg.userData.side=s; wings.push(wg); } return; }
    case 'lady': { mk(G.sph(0.12,14,10,0,TAU,0,Math.PI/2),c,0,0.2,0,g).scale.z=1.2; mk(G.sph(0.06,10,8),c2,0,0.22,0.13,g); for(let i=0;i<5;i++) mk(G.sph(0.025,6,5),c2,Math.cos(i*1.4)*0.06,0.29,Math.sin(i*1.4)*0.07,g); legs(0.22,0.1); return; }
    case 'mantis': { const b=mk(G.cap(0.03,0.32,4,8),c,0,0.28,0,g); b.rotation.x=1.2; mk(G.cone(0.06,0.08,3),c,0,0.48,0.16,g); for(const s of [1,-1]){ const a=mk(G.cap(0.018,0.16,3,6),c,s*0.05,0.38,0.14,g); a.rotation.x=-0.6; const wg=mk(G.sph(0.5,8,4),c2,s*0.03,0.27,-0.08,g); wg.scale.set(0.06,0.01,0.2); wings.push(wg); wg.userData.side=s; } legs(0.22,0.08); return; }
    case 'cicada': { const b=mk(G.sph(0.1,12,8),c,0,0.25,0,g); b.scale.set(1,0.8,1.5); for(const s of [1,-1]){ const wg=mk(G.sph(0.5,10,4),M(d.c2,{transparent:true,opacity:0.65}),s*0.07,0.3,-0.06,g); wg.scale.set(0.12,0.01,0.34); wg.rotation.y=s*0.2; wings.push(wg); wg.userData.side=s; mk(G.sph(0.03,6,5),dark,s*0.06,0.29,0.13,g); } return; }
    case 'hopper': { const b=mk(G.cap(0.05,0.22,4,8),c,0,0.15,0,g); b.rotation.x=Math.PI/2; mk(G.sph(0.06,8,6),c,0,0.18,0.17,g); for(const s of [1,-1]){ const lg=mk(G.cap(0.02,0.2,3,6),c2,s*0.07,0.15,-0.06,g); lg.rotation.x=-1.0; const wg=mk(G.sph(0.5,8,4),c2,s*0.02,0.2,-0.03,g); wg.scale.set(0.05,0.01,0.24); wings.push(wg); wg.userData.side=s; } return; }
    case 'stick': { const b=mk(G.cyl(0.015,0.02,0.6,5),c,0,0.08,0,g); b.rotation.x=Math.PI/2; for(let i=0;i<3;i++) for(const s of [1,-1]){ const l=mk(G.cyl(0.006,0.006,0.22,3),c2,s*0.07,0.05,(i-1)*0.12,g); l.rotation.z=s*1.1; } return; }
    case 'beetle': case 'stag': case 'rhino': { const s=mk(G.sph(0.15,14,10),c,0,0.18,0,g); s.scale.set(1,0.62,1.35); mk(G.box(0.008,0.01,0.36),dark,0,0.27,0,g); mk(G.sph(0.08,10,8),c2,0,0.17,0.2,g);
      if(w==='stag') for(const s2 of [1,-1]){ const m=mk(G.cone(0.025,0.22,5),c2,s2*0.06,0.18,0.33,g); m.rotation.set(Math.PI/2,0,-s2*0.5); }
      if(w==='rhino'){ const h=mk(G.cone(0.04,0.25,6),c2,0,0.27,0.28,g); h.rotation.x=0.9; }
      if(d.glow){ mk(G.sph(0.06,8,6),M(d.c2,{emissive:d.c2,emissiveIntensity:1.5}),0,0.17,-0.2,g); }
      legs(0.16,0.13); return; }
    case 'pill': { for(let i=0;i<5;i++) mk(G.sph(0.1,10,8),c,0,0.1,-0.12+i*0.06,g).scale.set(1,0.75,0.45); return; }
    case 'snail': { const sh=mk(G.tor(0.09,0.06,8,14),c,0,0.17,0,g); sh.rotation.y=Math.PI/2; mk(G.sph(0.06,8,6),c,0,0.17,0,g); const b=mk(G.cap(0.045,0.3,4,8),c2,0,0.05,0.04,g); b.rotation.x=Math.PI/2; for(const s of [1,-1]){ const a=mk(G.cyl(0.008,0.008,0.12,3),c2,s*0.03,0.12,0.2,g); a.rotation.x=0.4; } return; }
    case 'crab': case 'hermit': {
      if (w==='hermit'){ const sh=mk(G.cone(0.14,0.32,8),M(d.c2),0,0.2,-0.05,g); sh.rotation.x=-1.2; }
      else { const b=mk(G.sph(0.14,12,8),c,0,0.12,0,g); b.scale.set(1.3,0.55,1); }
      for(const s of [1,-1]){ const cl=mk(G.sph(0.06,8,6),c,s*0.18,0.14,0.12,g); cl.scale.set(1.2,0.8,0.8); if(w==='crab'&&s>0) cl.scale.multiplyScalar(1.8); mk(G.sph(0.025,6,5),dark,s*0.05,0.2,0.1,g); }
      legs(0.12,0.16); return; }
    case 'skater': { mk(G.cap(0.02,0.12,3,6),c,0,0.05,0,g).rotation.x=Math.PI/2; for(let i=0;i<3;i++) for(const s of [1,-1]){ const l=mk(G.cyl(0.005,0.005,0.28,3),c,s*0.12,0.04,(i-1)*0.08,g); l.rotation.z=Math.PI/2; } return; }
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
thumbR.setSize(112,112); thumbR.outputColorSpace=THREE.SRGBColorSpace; thumbR.toneMapping=THREE.ACESFilmicToneMapping;
const thumbScene=new THREE.Scene(); thumbScene.add(new THREE.HemisphereLight(0xffffff,0xb09070,2.4)); { const dl=new THREE.DirectionalLight(0xffffff,2); dl.position.set(2,4,3); thumbScene.add(dl); }
const thumbCam=new THREE.PerspectiveCamera(28,1,0.01,100); const thumbCache={};
function renderThumb(key, m){
  if (thumbCache[key]) return thumbCache[key];
  thumbScene.add(m); const box=new THREE.Box3().setFromObject(m), c=box.getCenter(new THREE.Vector3()), s=box.getSize(new THREE.Vector3()).length();
  thumbCam.position.set(c.x+s*0.85, c.y+s*0.8, c.z+s*1.5); thumbCam.lookAt(c);
  thumbR.render(thumbScene, thumbCam); const url=thumbR.domElement.toDataURL(); thumbScene.remove(m);
  return thumbCache[key]=url;
}
export const thumb = id => thumbCache[id] || renderThumb(id, buildItemModel(id));
export const toolThumb = (type,tier) => thumbCache['tool:'+type+tier] || renderThumb('tool:'+type+tier, (()=>{ const g=buildTool(type,tier); g.rotation.z=-0.6; return g; })());

/* ---------- Furniture ---------- */
const WOOD=0xa8754a, WOOD2=0x8b5e3a, WOODL=0xc99a6a;
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

/* ---------- Characters ---------- */
function eyesMouth(head, fz, eyeX, eyeY, mouthY, scale=1){
  for(const s of [-1,1]){ const e=mk(G.sph(0.07*scale,12,10), M(0x221a1a,{roughness:0.3}), s*eyeX, eyeY, fz, head); e.scale.set(0.85,1.25,0.6); mk(G.sph(0.024*scale,8,6), M(0xffffff,{emissive:0xffffff,emissiveIntensity:0.6}), s*eyeX+0.02, eyeY+0.035, fz+0.04, head); }
  const m=mk(G.tor(0.05*scale,0.012,6,12,Math.PI), M(0x5a2a2a), 0, mouthY, fz+0.01, head); m.rotation.z=Math.PI; m.castShadow=false;
}
function limbs(g, body, skinMat, sleeveMat, legMat, footMat){
  const arms=[]; for(const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*0.4,0.98,0); body.add(p); outline(mk(G.sph(0.13,12,10),sleeveMat,0,0,0,p)); outline(mk(G.cap(0.085,0.22,4,10),skinMat,s*0.03,-0.24,0,p)); arms.push(p); }
  const legs=[]; for(const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*0.17,0.42,0); g.add(p); outline(mk(G.cap(0.1,0.16,4,10),legMat,0,-0.16,0,p)); const f=outline(mk(G.sph(0.12,12,8),footMat,0,-0.36,0.05,p)); f.scale.set(1,0.55,1.35); legs.push(p); }
  return { arms, legs };
}
export const buildAnimal = asChar(_buildAnimal);
function _buildAnimal(spec){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body); const fur=M(spec.fur), muz=M(spec.muzzle||spec.belly||0xffffff), shirt=M(spec.shirt);
  const torso=outline(mk(G.sph(0.42,20,16), shirt, 0,0.78,0,body)); torso.scale.set(1,1.05,0.9);
  mk(G.tor(0.2,0.05,8,16), M(new THREE.Color(spec.shirt).offsetHSL(0,0,0.12).getHex()), 0,1.12,0,body).rotation.x=Math.PI/2;
  const head=new THREE.Group(); head.position.y=1.5; body.add(head);
  const sk=outline(mk(G.sph(0.52,24,18), fur, 0,0,0,head)); sk.scale.set(1.06,0.96,0.96);
  if (spec.ears==='sheep'){ for(let i=0;i<9;i++){ const a=i/9*TAU; outline(mk(G.sph(0.18,12,10), M(0xffffff), Math.cos(a)*0.42, 0.28+Math.sin(i*1.7)*0.06, Math.sin(a)*0.3-0.05, head),1.06); } }
  mk(G.sph(0.24,16,12), muz, 0,-0.12,0.4,head).scale.set(1.2,0.85,0.75);
  mk(G.sph(0.065,10,8), M(spec.species==='frog'?0x3a6a2a:0x3a2a2a,{roughness:0.3}), 0,-0.03,0.58,head);
  eyesMouth(head, 0.45, 0.19, 0.07, -0.18);
  for(const s of [-1,1]){ const c=mk(G.sph(0.08,10,8), M(spec.cheek), s*0.31,-0.12,0.38,head); c.scale.set(1,0.6,0.4); c.castShadow=false; }
  const E=spec.ears;
  if(E==='long') for(const s of [-1,1]){ const e=outline(mk(G.sph(0.14,12,10), fur, s*0.2,0.64,-0.05,head)); e.scale.set(0.8,3,0.6); e.rotation.z=s*-0.15; const i=mk(G.sph(0.08,10,8), M(spec.cheek), s*0.2,0.64,0.02,head); i.scale.set(0.8,3.4,0.4); i.rotation.z=s*-0.15; }
  if(E==='round') for(const s of [-1,1]){ outline(mk(G.sph(0.16,12,10), fur, s*0.37,0.37,-0.05,head)).scale.z=0.6; mk(G.sph(0.09,10,8), M(spec.cheek), s*0.37,0.37,0.02,head).scale.z=0.4; }
  if(E==='cat') for(const s of [-1,1]){ const e=outline(mk(G.cone(0.17,0.32,8), fur, s*0.3,0.46,0,head)); e.rotation.z=s*-0.35; }
  if(E==='mouse') for(const s of [-1,1]){ const e=outline(mk(G.sph(0.24,14,12), fur, s*0.42,0.38,-0.05,head)); e.scale.z=0.35; mk(G.sph(0.17,12,10), M(spec.cheek), s*0.42,0.38,0.02,head).scale.z=0.3; }
  if(E==='goat'||E==='deer') for(const s of [-1,1]){ const e=outline(mk(G.sph(0.13,10,8), fur, s*0.5,0.18,0,head)); e.scale.set(1.8,0.6,0.8); e.rotation.z=s*0.3; }
  if(E==='goat') for(const s of [-1,1]){ const h=mk(G.cone(0.07,0.32,8), M(0xc8b890), s*0.16,0.55,-0.1,head); h.rotation.set(-0.5,0,s*-0.25); }
  if(E==='deer') for(const s of [-1,1]){ const a=mk(G.cyl(0.03,0.04,0.35,6), M(0xd8c8a0), s*0.18,0.62,-0.05,head); a.rotation.z=s*-0.3; const b=mk(G.cyl(0.025,0.03,0.18,6), M(0xd8c8a0), s*0.28,0.72,-0.05,head); b.rotation.z=s*-1.0; }
  if(E==='sheep') for(const s of [-1,1]){ const e=mk(G.sph(0.11,10,8), fur, s*0.5,0.1,0,head); e.scale.set(1.6,0.5,0.7); }
  if(spec.species==='frog'){ for(const s of [-1,1]){ outline(mk(G.sph(0.17,12,10), fur, s*0.22,0.4,0.12,head)); mk(G.sph(0.085,10,8), M(0x221a1a), s*0.22,0.44,0.26,head); } }
  const L=limbs(g, body, fur, shirt, fur, fur);
  const tail={ rabbit:()=>mk(G.sph(0.13,10,8), M(0xffffff), 0,0.55,-0.42,body), cat:()=>{ const t=mk(G.cap(0.05,0.6,4,8), fur, 0,0.75,-0.48,body); t.rotation.x=-0.9; }, bear:()=>mk(G.sph(0.09,8,6), fur, 0,0.55,-0.38,body),
    goat:()=>mk(G.cone(0.06,0.14,6), fur, 0,0.65,-0.4,body).rotation.x=-1, deer:()=>mk(G.sph(0.08,8,6), M(0xffffff), 0,0.62,-0.4,body), sheep:()=>mk(G.sph(0.12,10,8), M(0xffffff), 0,0.6,-0.4,body),
    mouse:()=>{ const t=mk(G.cyl(0.02,0.01,0.7,6), M(spec.cheek), 0,0.45,-0.6,body); t.rotation.x=-1.2; } }[spec.species];
  if (tail) tail();
  g.userData={ body, head, arms:L.arms, legs:L.legs }; return g;
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
export const buildPlayer = asChar(_buildPlayer);
function _buildPlayer(o={}){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const skin=M(o.skin||0xf3c9a5), hair=M(o.hair||0x6a4030), shirt=M(o.shirt||0x6fb7d8), shorts=M(0x4a5a8a), shoe=M(0x8a4a2a);
  const t=outline(mk(G.cap(0.33,0.32,6,16), shirt, 0,0.78,0,body)); t.scale.set(1,1,0.85);
  mk(G.tor(0.18,0.045,8,16), M(0xffffff), 0,1.08,0,body).rotation.x=Math.PI/2;
  mk(G.cyl(0.345,0.36,0.22,16), shorts, 0,0.52,0,body);
  const head=new THREE.Group(); head.position.y=1.5; body.add(head);
  outline(mk(G.sph(0.46,24,18), skin, 0,0,0,head));
  const hr=outline(mk(G.sph(0.49,24,14,0,TAU,0,Math.PI*0.55), hair, 0,0.05,-0.03,head)); hr.rotation.x=-0.3;
  for(let i=0;i<5;i++){ const b=mk(G.sph(0.13,10,8), hair, -0.24+i*0.12, 0.27, 0.32, head); b.scale.set(1,0.7,0.6); }
  eyesMouth(head, 0.4, 0.16, 0.0, -0.17, 0.95);
  for(const s of [-1,1]){ const c=mk(G.sph(0.075,10,8), M(0xf5a3a3), s*0.27,-0.12,0.33,head); c.scale.set(1,0.6,0.4); c.castShadow=false; mk(G.sph(0.08,10,8), skin, s*0.46,-0.02,0,head).scale.set(0.5,1,0.8); }
  const L=limbs(g, body, skin, shirt, skin, shoe);
  const hand=new THREE.Group(); hand.position.set(0.02,-0.38,0.04); L.arms[1].add(hand);
  g.userData={ body, head, arms:L.arms, legs:L.legs, hand }; return g;
}

/* ---------- Buildings ---------- */
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
