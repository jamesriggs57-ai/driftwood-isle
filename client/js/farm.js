// v1.8 garden models: tilled soil, fence styles (instanced, so a big garden stays cheap to draw), gate posts and decorations.
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { M, MF, mk, G, glowMat, addGlow } from './models.js';

export const CELL = 0.9;
const WOOD=0xa8754a, WOOD2=0x8b5e3a;

/* ---------- Soil: one instanced bed square per garden square, plus two furrow ridges ---------- */
const SOIL_GEO = new THREE.BoxGeometry(CELL*0.97, 0.1, CELL*0.97);
const RIDGE_GEO = (()=>{ const g=new THREE.CapsuleGeometry(0.06, CELL*0.7, 3, 6); g.rotateZ(Math.PI/2); g.scale(1,0.55,1); return g; })();
const SOIL_MAT = new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.95 });
export function buildSoil(cells, yAt){   // cells: [[x,z],...]
  const g=new THREE.Group(), n=cells.length; if (!n) return g;
  const bed=new THREE.InstancedMesh(SOIL_GEO, SOIL_MAT, n), rid=new THREE.InstancedMesh(RIDGE_GEO, SOIL_MAT, n*2);
  const d=new THREE.Object3D(), c=new THREE.Color(), base=new THREE.Color(0x6e4a30), dark=new THREE.Color(0x5a3a24);
  cells.forEach(([x,z],k)=>{ const r=mulberry32(Math.round(x*7919+z*104729)|0), y=yAt(x,z);
    d.position.set(x, y+0.0, z); d.rotation.set(0,0,0); d.scale.set(1,1,1); d.updateMatrix(); bed.setMatrixAt(k,d.matrix); bed.setColorAt(k, c.copy(base).offsetHSL((r()-0.5)*0.02,(r()-0.5)*0.05,(r()-0.5)*0.05));
    for (let s=0;s<2;s++){ d.position.set(x, y+0.05, z+(s?0.2:-0.2)); d.rotation.set(0,(r()-0.5)*0.06,0); d.updateMatrix(); rid.setMatrixAt(k*2+s,d.matrix); rid.setColorAt(k*2+s, c.copy(dark).offsetHSL(0,0,(r()-0.5)*0.05)); } });
  for (const m of [bed,rid]){ m.receiveShadow=true; m.castShadow=false; g.add(m); }
  return g;
}

/* ---------- Fences. Parts are laid out along one edge (local x, length CELL, centered); posts sit on corners. ---------- */
const STYLE = {
  rustic: { post:[[G.cyl(0.055,0.065,0.72,7), M(WOOD2), 0,0.36,0]],
            edge:[[G.cyl(0.032,0.032,CELL,6), M(WOOD), 0,0.27,0, 'x'], [G.cyl(0.032,0.032,CELL,6), M(WOOD), 0,0.52,0, 'x']],
            gate:[[G.cyl(0.07,0.08,1.0,8), M(WOOD2), 0,0.5,0], [G.sph(0.08,8,6), M(WOOD2), 0,1.02,0]] },
  picket: { post:[[G.box(0.09,0.78,0.09), M(0xf6f1e8), 0,0.39,0], [G.cone(0.07,0.1,4), M(0xf6f1e8), 0,0.83,0]],
            edge:[[G.box(CELL,0.05,0.03), M(0xece6da), 0,0.2,-0.02], [G.box(CELL,0.05,0.03), M(0xece6da), 0,0.48,-0.02],
                  ...[-0.3,0,0.3].flatMap(x=>[[G.box(0.09,0.58,0.03), M(0xf6f1e8), x,0.33,0.01], [G.cone(0.064,0.1,4), M(0xf6f1e8), x,0.67,0.01, 'pk']])],
            gate:[[G.box(0.12,1.0,0.12), M(0xf6f1e8), 0,0.5,0], [G.sph(0.08,10,8), M(0xf6f1e8), 0,1.05,0]] },
  stone:  { post:[[G.dod(0.2), MF(0x9a958a), 0,0.2,0]],
            edge:[[G.box(0.32,0.24,0.3), MF(0xa8a294), -0.29,0.12,0], [G.box(0.3,0.26,0.32), MF(0x96907f), 0.01,0.13,0.01], [G.box(0.3,0.22,0.28), MF(0xb0aa9c), 0.3,0.11,-0.01],
                  [G.box(CELL,0.06,0.34), MF(0x8c8778), 0,0.27,0]],
            gate:[[G.box(0.3,0.7,0.3), MF(0x9a958a), 0,0.35,0], [G.box(0.36,0.08,0.36), MF(0x8c8778), 0,0.74,0]] },
  hedge:  { post:[[G.sph(0.25,10,8), MF(0x4a8a3a), 0,0.36,0]],
            edge:[[G.box(CELL,0.5,0.38), MF(0x4f8f3c), 0,0.27,0], [G.sph(0.22,8,6), MF(0x5a9a44), -0.22,0.5,0, 'bump'], [G.sph(0.22,8,6), MF(0x56963f), 0.22,0.52,0, 'bump']],
            gate:[[G.sph(0.32,10,8), MF(0x4a8a3a), 0,0.45,0], [G.sph(0.22,10,8), MF(0x56963f), 0,0.78,0]] },
};
// edges: [{x,y,z,rot}] rot = angle of the edge's line. posts / gates: [{x,y,z}]
export function buildFences(style, edges, posts, gates){
  const S=STYLE[style], g=new THREE.Group(), d=new THREE.Object3D(), pm=new THREE.Matrix4(), out=new THREE.Matrix4();
  const lay=(parts, list, withRot)=>{ if (!list.length) return; for (const [geo,mat,px,py,pz,flag] of parts){
    const im=new THREE.InstancedMesh(geo, mat, list.length); im.castShadow=true; im.receiveShadow=true;
    d.position.set(px,py,pz); d.rotation.set(0,0,flag==='x'?Math.PI/2:0); if (flag==='bump') d.scale.set(1.2,0.7,0.9); else d.scale.set(1,1,1); d.updateMatrix(); pm.copy(d.matrix);
    list.forEach((e,k)=>{ d.position.set(e.x,e.y,e.z); d.rotation.set(0,withRot?e.rot:0,0); d.scale.set(1,1,1); d.updateMatrix(); out.multiplyMatrices(d.matrix,pm); im.setMatrixAt(k,out); });
    g.add(im); } };
  lay(S.edge, edges, true); lay(S.post, posts, false); lay(S.gate, gates, false);
  return g;
}

/* ---------- Decorations ---------- */
export function buildStake(){ const g=new THREE.Group(); mk(G.box(0.07,0.6,0.07), M(WOOD), 0,0.3,0,g); const t=mk(G.box(0.3,0.2,0.04), M(0xd8b888), 0,0.5,0.04,g); t.rotation.z=0.06;
  mk(G.tor(0.05,0.012,4,10), M(0x6a8a3a), 0,0.5,0.07,g); return g; }
export function buildGardenSign(label, color){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const x=cv.getContext('2d');
  x.fillStyle='#f4e4c0'; x.fillRect(0,0,256,128); x.strokeStyle='#8b5e3a'; x.lineWidth=10; x.strokeRect(5,5,246,118);
  x.fillStyle='#'+new THREE.Color(color).getHexString(); x.beginPath(); x.arc(46,64,24,0,TAU); x.fill();
  x.fillStyle='#5b4336'; x.font='700 38px Fredoka, sans-serif'; x.textBaseline='middle'; x.fillText(label.length>9?label.slice(0,9):label, 82, 68);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const g=new THREE.Group(); for (const s of [-0.28,0.28]) mk(G.box(0.07,0.95,0.07), M(WOOD2), s,0.47,0,g);
  mk(G.box(0.74,0.4,0.05), M(WOOD), 0,0.78,0,g); mk(new THREE.PlaneGeometry(0.68,0.34), new THREE.MeshStandardMaterial({ map:t, roughness:0.85 }), 0,0.78,0.03,g);
  return g; }
export function buildScarecrow(){ const g=new THREE.Group();
  mk(G.cyl(0.04,0.05,1.5,6), M(WOOD2), 0,0.75,0,g); const arm=mk(G.cyl(0.03,0.03,1.1,6), M(WOOD2), 0,1.15,0,g); arm.rotation.z=Math.PI/2;
  const shirt=mk(G.cyl(0.2,0.26,0.55,10), M(0x6a8ac8), 0,1.0,0,g); const pt=mk(G.box(0.36,0.06,0.02), M(0xe0a040), 0,1.05,0.24,g);
  for (const s of [-1,1]){ const sl=mk(G.cyl(0.08,0.1,0.42,8), M(0x6a8ac8), s*0.34,1.15,0,g); sl.rotation.z=s*Math.PI/2; for (let k=0;k<4;k++){ const st=mk(G.cone(0.025,0.16,4), M(0xe8c868), s*(0.58+0.02*k),1.15+(k-1.5)*0.03,(k%2-0.5)*0.05,g); st.rotation.z=-s*Math.PI/2; } }
  mk(G.sph(0.2,12,10), M(0xe8d8b0), 0,1.45,0,g); for (const s of [-1,1]) mk(G.sph(0.025,6,4), M(0x3a2a22), s*0.07,1.48,0.18,g);
  const smile=mk(G.tor(0.06,0.012,4,10,Math.PI), M(0x3a2a22), 0,1.41,0.18,g); smile.rotation.z=Math.PI;
  mk(G.cyl(0.34,0.34,0.03,14), M(0xd8b060), 0,1.6,0,g); mk(G.cyl(0.15,0.18,0.2,12), M(0xd8b060), 0,1.7,0,g); mk(G.cyl(0.155,0.155,0.05,12), M(0xc04a3a), 0,1.64,0,g);
  const bird=new THREE.Group(); mk(G.sph(0.06,8,6), M(0x3a3a4a), 0,0,0,bird); mk(G.sph(0.04,8,6), M(0x3a3a4a), 0.05,0.04,0,bird); mk(G.cone(0.015,0.04,4), M(0xe0a040), 0.09,0.04,0,bird).rotation.z=-Math.PI/2;
  bird.position.set(0.5,1.24,0); g.add(bird); g.userData.bird=bird; return g; }
export function buildLanternPost(){ const g=new THREE.Group(); mk(G.cyl(0.04,0.05,1.1,6), M(0x4a4a50), 0,0.55,0,g); const hook=mk(G.box(0.24,0.03,0.03), M(0x4a4a50), 0.1,1.08,0,g);
  const lamp=new THREE.Group(); lamp.position.set(0.2,0.92,0); g.add(lamp); mk(G.box(0.14,0.03,0.14), M(0x4a4a50), 0,0.1,0,lamp); mk(G.box(0.12,0.16,0.12), glowMat(0xffd890), 0,0,0,lamp); mk(G.box(0.14,0.03,0.14), M(0x4a4a50), 0,-0.09,0,lamp);
  addGlow(lamp, 0, 1.4); return g; }
export function buildFlowerArch(){ const g=new THREE.Group(), r=mulberry32(77), wd=M(0xf4efe6);
  for (const s of [-1,1]){ mk(G.box(0.08,1.7,0.08), wd, s*0.55,0.85,-0.12,g); mk(G.box(0.08,1.7,0.08), wd, s*0.55,0.85,0.12,g); for (let k=0;k<5;k++) mk(G.box(0.04,0.04,0.3), wd, s*0.55,0.3+k*0.32,0,g); }
  const top=mk(G.tor(0.55,0.04,6,18,Math.PI), wd, 0,1.7,-0.12,g); const top2=mk(G.tor(0.55,0.04,6,18,Math.PI), wd, 0,1.7,0.12,g);
  const leaf=MF(0x4f8a3a), roses=[0xe8506a,0xf8b0c0,0xffffff].map(c=>M(c));
  for (let i=0;i<34;i++){ const t=i/33, a=Math.PI*t; let x, y; if (t<0.3){ x=-0.55; y=0.4+t/0.3*1.3; } else if (t>0.7){ x=0.55; y=0.4+(1-t)/0.3*1.3; } else { const u=(t-0.3)/0.4*Math.PI; x=-Math.cos(u)*0.55; y=1.7+Math.sin(u)*0.55; }
    mk(G.ico(0.13+r()*0.05,0), leaf, x+(r()-0.5)*0.12, y, (r()-0.5)*0.3, g); if (i%2===0) mk(G.sph(0.055,8,6), roses[i%3], x+(r()-0.5)*0.16, y+0.06, (r()-0.5)*0.34+0.1, g); }
  return g; }
