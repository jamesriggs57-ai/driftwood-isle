/* =====================================================================
   v1.38 ISLAND STORIES PHASE 2: models only (main.js decides what happens).
   - relics (six old things from the far isles) and the rune stone they're buried under on a trip island
   - Mabel's Tea Room with its terrace, Pemberton's Forge, Thistle's Reef Hall (outside and the walk-through reef inside)
   - a generic building site, the lighthouse lamp frame, coral cuttings, tea cakes
   - commission and forge furniture: four-poster bed, boat bookcase, long table, reef tank, iron lantern, iron gate, weathervane
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32, hashStr } from './util.js';
import { M, mk, G, glowMat, addGlow, ITEM_BUILDERS, FURN_BUILDERS } from './models.js';
import { tmat, tbox, mergeStatic, cottageRoof, window1, wallLantern, chimney1, ivy, timberFace, hangingSign, scallopAwning, bunting, pot, mossTop, barrel1, flowerBed1 } from './cottage.js';
import { buildCoral } from './reef.js';
import { buildFishInto } from './critters.js';

const IRON = () => M(0x3a3a42, { metalness:0.55, roughness:0.45 });
const BRASS = () => M(0xd0a048, { metalness:0.7, roughness:0.3 });
const glass = (c=0xbfe8f4, o=0.28) => new THREE.MeshPhysicalMaterial({ color:c, transparent:true, opacity:o, roughness:0.05, metalness:0, transmission:0, depthWrite:false, side:THREE.DoubleSide });

/* ---------- Relics ---------- */
export const RELIC_IDS = ['relic_acorn','relic_leystone','relic_frostpine','relic_amber','relic_moonsap','relic_coralcrown'];
ITEM_BUILDERS.relic = (g, d) => {
  const s=d.s;
  if (s==='acorn'){ // a big golden acorn with a glowing heartwood seam
    const nut=mk(G.sph(0.2,18,14), M(0xb8742a,{ roughness:0.35, metalness:0.15 }), 0,0.22,0,g); nut.scale.set(1,1.25,1);
    const seam=mk(G.tor(0.2,0.012,6,24), glowMat(0xffc860), 0,0.22,0,g); seam.rotation.set(Math.PI/2,0,0.5); seam.scale.set(1,1.25,1);
    const cap=mk(G.sph(0.22,18,10,0,TAU,0,Math.PI/2), M(0x6a4a2a,{ roughness:0.9, flatShading:true }), 0,0.34,0,g); cap.scale.y=0.7;
    mk(G.cyl(0.025,0.035,0.12,6), M(0x5a3a20), 0,0.5,0,g); addGlow(g, 0.24, 0.9, 0xffc860); }
  else if (s==='leystone'){ // a smooth sea-worn disc with a rune that glows
    const st=mk(G.cyl(0.24,0.26,0.1,24), M(0x6a7a86,{ roughness:0.55 }), 0,0.08,0,g); st.scale.set(1,1,0.85);
    const ring=mk(G.tor(0.15,0.014,6,28), glowMat(0x7ad8ff), 0,0.135,0,g); ring.rotation.x=Math.PI/2;
    for (let i=0;i<3;i++){ const b=mk(G.box(0.2,0.012,0.026), glowMat(0x7ad8ff), 0,0.136,0,g); b.rotation.y=i/3*Math.PI; }
    mk(G.sph(0.05,10,8), M(0x4a5a64,{ roughness:0.6 }), 0.18,0.06,0.1,g).scale.y=0.5; addGlow(g, 0.16, 0.8, 0x7ad8ff); }
  else if (s==='frostpine'){ // a pale blue pinecone rimed with frost
    const core=new THREE.Group(); core.position.y=0.06; g.add(core); const sc=M(0x9ac0d8,{ roughness:0.5 }), tip=M(0xf4faff,{ roughness:0.3 });
    for (let row=0;row<7;row++){ const y=row*0.065, rr=0.13*Math.sin(Math.PI*(row+0.6)/7.6)+0.03, n=8;
      for (let i=0;i<n;i++){ const a=i/n*TAU+row*0.4, p=mk(G.cone(0.05,0.09,4), row%2?sc:M(0x7aa8c8,{ roughness:0.5 }), Math.cos(a)*rr, y, Math.sin(a)*rr, core); p.rotation.set(Math.PI/2+0.5, 0, -a+Math.PI/2); p.lookAt(Math.cos(a)*rr*3, y-0.1, Math.sin(a)*rr*3);
        if (row>2) mk(G.sph(0.018,6,5), tip, Math.cos(a)*(rr+0.04), y+0.02, Math.sin(a)*(rr+0.04), core); } }
    mk(G.cyl(0.02,0.03,0.08,6), M(0x6a5a4a), 0,0.52,0,g); addGlow(g, 0.25, 0.7, 0xc8ecff); }
  else if (s==='amber'){ // a honey-orange shard with a tiny fern frond caught inside
    const sh=mk(G.ico(0.2,0), new THREE.MeshPhysicalMaterial({ color:0xf0901a, transparent:true, opacity:0.82, roughness:0.15, emissive:0x8a3a00, emissiveIntensity:0.25, flatShading:true }), 0,0.18,0,g); sh.scale.set(1.3,0.8,0.8); sh.rotation.set(0.3,0.5,0.2);
    const fr=new THREE.Group(); fr.position.set(0,0.18,0); fr.rotation.z=0.4; g.add(fr); mk(G.box(0.012,0.16,0.012), M(0x5a3a10), 0,0,0,fr);
    for (let i=0;i<4;i++) for (const s2 of [-1,1]){ const l=mk(G.box(0.05,0.008,0.016), M(0x6a4a10), s2*0.025, -0.05+i*0.035, 0, fr); l.rotation.z=s2*0.5; }
    addGlow(g, 0.18, 0.7, 0xffa040); }
  else if (s==='moonsap'){ // a stoppered glass vial of silvery-violet sap
    mk(G.cyl(0.11,0.12,0.3,16), glass(0xe8e0ff,0.35), 0,0.17,0,g); mk(G.sph(0.115,16,8,0,TAU,Math.PI/2,Math.PI/2), glass(0xe8e0ff,0.35), 0,0.02,0,g);
    mk(G.cyl(0.095,0.1,0.22,16), glowMat(0xb89aff), 0,0.13,0,g); mk(G.cyl(0.05,0.05,0.06,10), glass(0xe8e0ff,0.35), 0,0.35,0,g);
    mk(G.cyl(0.055,0.048,0.06,10), M(0xa8784a), 0,0.39,0,g); const tie=mk(G.tor(0.055,0.01,5,14), M(0xd8c8f0), 0,0.34,0,g); tie.rotation.x=Math.PI/2; addGlow(g, 0.16, 0.9, 0xb89aff); }
  else if (s==='coralcrown'){ // a ring of living coral, every color of the reef, with a pearl
    const base=mk(G.tor(0.18,0.045,8,24), M(0xf2e6d0,{ roughness:0.6 }), 0,0.06,0,g); base.rotation.x=Math.PI/2;
    const cols=[0xf08a8a,0xa07ae8,0xe8405a,0x3ab8a8,0xf2a46a,0x6a8ef0,0xf0b0c8];
    for (let i=0;i<7;i++){ const a=i/7*TAU, h=0.12+(i%2)*0.07, b=mk(G.cyl(0.018,0.03,h,6), M(cols[i],{ roughness:0.6 }), Math.cos(a)*0.18, 0.06+h/2, Math.sin(a)*0.18, g); b.rotation.z=Math.cos(a)*0.25; b.rotation.x=-Math.sin(a)*0.25;
      mk(G.sph(0.028,8,6), M(cols[i]), Math.cos(a)*(0.18+Math.cos(a)*h*0.12), 0.06+h, Math.sin(a)*(0.18+Math.sin(a)*h*0.12), g); }
    mk(G.sph(0.04,12,10), M(0xfff8f0,{ roughness:0.15, metalness:0.2 }), 0.18,0.1,0,g); addGlow(g, 0.12, 0.8, 0xffb0d0); }
};
// a mossy standing stone on a trip island, its runes faintly lit. Something's buried at its foot.
export function buildRuneStone(seed=1){
  const g=new THREE.Group(), r=mulberry32(seed), st=M(0x8a8a84,{ roughness:0.9, flatShading:true }), moss=M(0x5f8a3c,{ roughness:1 });
  const geo=new THREE.BoxGeometry(0.9,2.4,0.5,3,6,2), p=geo.attributes.position; for (let i=0;i<p.count;i++){ const y=p.getY(i), k=1-0.25*smooth(0,1.2,y); p.setX(i, p.getX(i)*k+(r()-0.5)*0.06); p.setZ(i, p.getZ(i)*k+(r()-0.5)*0.05); if (y>1.1) p.setY(i, y+(r()-0.5)*0.12); } geo.computeVertexNormals();
  const s=mk(geo, st, 0,1.15,0,g); s.rotation.set(0.05,r()*0.4,0.04);
  const rune=glowMat(0x8ae8ff); for (let i=0;i<4;i++){ const y=0.6+i*0.38; mk(G.box(0.36,0.035,0.02), rune, 0,y,0.255,s).rotation.z=(i%2?0.5:-0.4); mk(G.box(0.035,0.22,0.02), rune, (i%2?0.1:-0.1),y+0.04,0.255,s); }
  s.position.y=1.15; for (let i=0;i<6;i++) mk(G.sph(0.18+r()*0.12,7,5), moss, (r()-0.5)*0.9, 0.05+r()*0.5, (r()-0.5)*0.5, g).scale.y=0.5;
  for (let i=0;i<5;i++){ const a=r()*TAU, d=0.8+r()*0.5; mk(G.dod(0.14+r()*0.1), st, Math.cos(a)*d, 0.05, Math.sin(a)*d, g).scale.y=0.6; }
  addGlow(g, 1.3, 2.2, 0x8ae8ff); g.userData.rune=rune; return g; }

/* ---------- small items ---------- */
ITEM_BUILDERS.lampframe = (g) => { const ir=IRON(), br=BRASS();
  mk(G.cyl(0.32,0.36,0.06,12), ir, 0,0.03,0,g); mk(G.cyl(0.3,0.3,0.05,12), ir, 0,0.62,0,g);
  for (let i=0;i<6;i++){ const a=i/6*TAU; mk(G.box(0.035,0.58,0.035), ir, Math.cos(a)*0.3, 0.33, Math.sin(a)*0.3, g); }
  mk(G.cone(0.3,0.2,12), br, 0,0.75,0,g); mk(G.sph(0.05,8,6), br, 0,0.88,0,g); };
ITEM_BUILDERS.cutting = (g) => { const c=buildCoral('staghorn', 0, 7); c.scale.setScalar(1.2); c.position.y=0.12; g.add(c);
  mk(G.cyl(0.16,0.2,0.14,12), M(0x9a9a94,{ roughness:0.9, flatShading:true }), 0,0.07,0,g); mk(G.cyl(0.21,0.23,0.04,12), M(0x7ab8c8,{ roughness:0.4 }), 0,0.02,0,g); };
ITEM_BUILDERS.teacake = (g) => { mk(G.cyl(0.24,0.26,0.03,18), M(0xf8f4ec), 0,0.015,0,g); mk(G.cyl(0.17,0.18,0.14,18), M(0xe8b870), 0,0.1,0,g);
  mk(G.cyl(0.175,0.175,0.04,18), M(0xf6b830,{ roughness:0.25 }), 0,0.18,0,g); mk(G.sph(0.04,10,8), M(0xd8203a), 0,0.22,0,g);
  for (let i=0;i<5;i++){ const a=i/5*TAU; mk(G.sph(0.025,6,5), M(0xf6b830,{ roughness:0.25 }), Math.cos(a)*0.17, 0.15, Math.sin(a)*0.17, g).scale.y=1.6; } };

/* ---------- a building site: stakes and string, a stack of the thing it's made of, a sign ---------- */
export function buildSite(W, D, l1, l2, stack='logs'){
  const g=new THREE.Group(), wood=M(0x9a7048), str=new THREE.LineBasicMaterial({ color:0xf4f0e0 });
  const corners=[[-W/2,-D/2],[W/2,-D/2],[W/2,D/2],[-W/2,D/2]]; for (const [x,z] of corners){ mk(G.box(0.07,0.6,0.07), wood, x,0.3,z,g); mk(G.box(0.04,0.04,0.12), M(0xe2483d), x,0.55,z,g); }
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([...corners, corners[0]].map(([x,z])=>new THREE.Vector3(x,0.5,z))), str));
  if (stack==='stone') for (let i=0;i<14;i++){ const x=0.4+(i%5)*0.42, z=-0.5-Math.floor(i/5)*0.4; mk(G.dod(0.22), M(0x9a9a94,{ flatShading:true }), x, 0.18+Math.floor(i/10)*0.3, z, g).rotation.y=i; }
  else for (let row=0;row<3;row++) for (let i=0;i<5-row;i++){ const l=mk(G.cyl(0.15,0.15,1.6,8), M(i%2?0x9a6a40:0x8a5a34), 0.6+(i-(4-row)/2)*0.32, 0.16+row*0.27, -0.6, g); l.rotation.x=Math.PI/2; }
  const pine=tmat('board',0xd8b07a,1,0.2); for (let i=0;i<4;i++){ const p=new THREE.Mesh(G.box(1.6,0.07,0.24), pine); p.position.set(-1.2, 0.04+i*0.075, 0.6+(i%2)*0.03); p.castShadow=p.receiveShadow=true; g.add(p); }
  const sp=new THREE.Group(); sp.position.set(-1.8,0,D/2+0.9); g.add(sp); mk(G.box(0.08,1.2,0.08), wood, 0,0.6,0,sp);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=128; const x=cv.getContext('2d'); x.fillStyle='#f4e6c8'; x.fillRect(0,0,256,128); x.fillStyle='#5b4336'; x.textAlign='center';
  x.font='700 30px Fredoka, sans-serif'; x.fillText(l1,128,46); x.font='700 34px Fredoka, sans-serif'; x.fillText(l2,128,92);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; mk(G.box(0.9,0.46,0.05), new THREE.MeshStandardMaterial({ map:t, roughness:0.85 }), 0,1.1,0.05,sp);
  g.userData.door=[0, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-0.4,-1.0,1.6,-0.2]]; return g; }

/* ---------- Mabel's Tea Room: a pale yellow cottage with a striped awning, bay window of cakes and a terrace out front ---------- */
export const TEA_SEATS = [[-2.6,3.6,Math.PI*0.75],[-1.3,4.5,Math.PI],[1.9,3.6,-Math.PI*0.75],[3.2,4.5,Math.PI]];   // terrace chairs, local to the room's center (x, z, facing)
export function buildTeaRoom(){
  const g=new THREE.Group(), W=6.2, D=4.4, H=2.6, plaster=tmat('plaster',0xf8e8b0,2,1.2), beam=M(0x7a5a3a), white=M(0xfff8ee), sage=M(0x8aa87a);
  const base=tbox('stone', 0xb8b0a0, W+0.3, 0.45, D+0.3, 0.8); base.position.y=0.08; g.add(base);
  const walls=new THREE.Mesh(G.box(W,H,D), plaster); walls.position.y=0.3+H/2; walls.castShadow=walls.receiveShadow=true; g.add(walls);
  const front=new THREE.Group(); front.position.set(0,0.3,D/2+0.01); g.add(front);
  timberFace(front, W, 0, H, [{ x:-1.6, y:0.95, w:1.0, h:1.9, door:true }, { x:1.0, y:1.35, w:2.4, h:1.2 }], beam);
  for (const s of [-1,1]){ const side=new THREE.Group(); side.position.set(s*(W/2+0.01),0.3,0); side.rotation.y=s*Math.PI/2; g.add(side); timberFace(side, D, 0, H, [{ x:0, y:1.4, w:0.9, h:0.85 }], beam); window1(side, 0, 1.4, 0.02, { type:'cross', shut:0x8aa87a, size:1.0, seed:5+s }); }
  const back=new THREE.Group(); back.position.set(0,0.3,-D/2-0.01); back.rotation.y=Math.PI; g.add(back); timberFace(back, W, 0, H, [], beam);
  // the door: sage green with a round window
  { const dr=new THREE.Group(); dr.position.set(-1.6,0.3,D/2+0.03); g.add(dr); mk(G.box(0.95,1.85,0.07), sage, 0,0.93,0,dr); mk(G.cyl(0.18,0.18,0.03,16), new THREE.MeshStandardMaterial({ color:0xfff0c0, emissive:0xffc865, emissiveIntensity:0.15 }), 0,1.4,0.04,dr).rotation.x=Math.PI/2;
    mk(G.sph(0.04,8,6), BRASS(), 0.32,0.95,0.06,dr); mk(G.box(1.15,0.1,0.14), beam, 0,1.92,0.02,dr); }
  // a wide bay window full of cakes on stands
  { const bw=new THREE.Group(); bw.position.set(1.0,0.3,D/2+0.02); g.add(bw); mk(G.box(2.5,0.12,0.45), white, 0,0.72,0.2,bw); mk(G.box(2.5,0.12,0.5), white, 0,2.0,0.2,bw);
    mk(G.box(2.4,1.2,0.04), new THREE.MeshStandardMaterial({ color:0xfff4d8, emissive:0xffc070, emissiveIntensity:0.12, roughness:0.2 }), 0,1.35,0.0,bw);
    for (const x of [-1.2,-0.4,0.4,1.2]) mk(G.box(0.06,1.2,0.06), white, x,1.35,0.42,bw);
    for (const [x,c] of [[-0.8,0xf6b830],[0,0xf0b0c8],[0.8,0xe8604d]]){ mk(G.cyl(0.02,0.02,0.18,6), white, x,0.88,0.18,bw); mk(G.cyl(0.2,0.2,0.02,14), white, x,0.97,0.18,bw); mk(G.cyl(0.15,0.16,0.16,14), M(0xe8c080), x,1.06,0.18,bw); mk(G.cyl(0.155,0.155,0.04,14), M(c), x,1.16,0.18,bw); } }
  scallopAwning(front, 1.0, 2.25, 0.05, 2.8, 0.85, 0xf0b0c8, 0xfff4e4, 0.42);
  const roofH=cottageRoof(g, { style:'mossy', L:D, S:W, y:0.3+H, c:0x7a8a9a, trim:0x5a6a7a, moss:0.25, seed:61, timber:false, over:0.45 });
  const ch=chimney1(g, -W/2+1.0, -D/2+0.9, 0.3+H, 0.3+H+roofH+0.5, 'brick', 0.04);
  hangingSign(g, -2.7, 2.35, D/2+0.02, 'Tea Room', '#fff4e4', '#a0506a', Math.PI);
  wallLantern(front, -2.4, 1.9, 0.02); ivy(front, -3.0, 0.4, 2.0, 11, 0xf0a0c0); ivy(back, 0.5, 2.5, 1.8, 13, 0xffffff);
  // the terrace: flagstones, little round tables with umbrellas, potted flowers
  const flag=M(0xd8d0c0,{ roughness:0.9 }); { const r=mulberry32(77); for (let i=0;i<46;i++){ const x=-W/2+0.4+(i%9)*0.75+(r()-0.5)*0.1, z=D/2+0.9+Math.floor(i/9)*0.72+(r()-0.5)*0.1; if (x>W/2) continue; const f=mk(G.cyl(0.33+r()*0.05,0.33,0.06,6), flag, x, 0.03, z, g); f.rotation.y=r(); f.castShadow=false; } }
  const tables=[[-1.95,4.0,0xf0b0c8],[2.55,4.0,0x8ac0a0]];
  for (const [x,z,uc] of tables){ mk(G.cyl(0.42,0.42,0.05,18), white, x,0.74,z,g); mk(G.cyl(0.05,0.05,0.7,8), IRON(), x,0.37,z,g); mk(G.cyl(0.25,0.28,0.04,12), IRON(), x,0.02,z,g);
    mk(G.cyl(0.03,0.03,2.0,6), white, x,1.4,z,g); const um=mk(G.cone(1.1,0.45,10,1,true), M(uc,{ side:THREE.DoubleSide }), x,2.3,z,g); um.castShadow=true; mk(G.sph(0.05,8,6), white, x,2.55,z,g);
    mk(G.cyl(0.08,0.07,0.1,10), white, x+0.12,0.82,z,g); mk(G.cyl(0.06,0.06,0.07,10), white, x-0.15,0.81,z+0.1,g); mk(G.cyl(0.09,0.09,0.02,10), white, x-0.15,0.775,z+0.1,g); }
  for (const [x,z,ry] of TEA_SEATS){ const ch2=new THREE.Group(); ch2.position.set(x,0,z); ch2.rotation.y=ry; g.add(ch2); const ir=IRON();
    mk(G.cyl(0.22,0.22,0.05,14), M(0xfff4e4), 0,0.45,0,ch2); for (const [a,b] of [[-0.15,-0.15],[0.15,-0.15],[-0.15,0.15],[0.15,0.15]]) mk(G.cyl(0.018,0.018,0.45,5), ir, a,0.22,b,ch2);
    const bk=mk(G.tor(0.17,0.02,5,14,Math.PI), ir, 0,0.7,-0.2,ch2); bk.rotation.z=0; mk(G.box(0.02,0.28,0.02), ir, -0.17,0.56,-0.2,ch2); mk(G.box(0.02,0.28,0.02), ir, 0.17,0.56,-0.2,ch2); }
  pot(g, -W/2-0.2, 0, D/2+0.4, 1.1, 0x5fae43, 0xf0a0c0); pot(g, W/2+0.2, 0, D/2+0.4, 1.1, 0x5fae43, 0xffd04d); pot(g, -W/2+0.3, 0, D/2+3.9, 0.9, 0x4f9a3a, 0xc7a0ff);
  bunting(front, -W/2+0.3, W/2-0.3, 2.95, 0.25, 0.2, [0xf0b0c8,0xfff4e4,0x8ac0a0,0xffd04d]);
  mergeStatic(g);
  g.userData.door=[-1.6, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-W/2-0.2,-D/2-0.2,W/2+0.2,D/2+0.2]]; g.userData.chimney=ch; g.userData.seats=TEA_SEATS; return g; }

/* ---------- Pemberton's Forge on Hollow Crags: a squat stone smithy, a glowing hearth under an open lean-to, an anvil ---------- */
export function buildForge(){
  const g=new THREE.Group(), W=5.6, D=4.4, H=2.5, stoneW=tmat('stone',0x8a8680,2,1.4), beam=M(0x4a3226), slate=0x4a4e58;
  const base=tbox('stone', 0x6a6660, W+0.4, 0.5, D+0.4, 0.8); base.position.y=0.1; g.add(base);
  const walls=new THREE.Mesh(G.box(W,H,D), stoneW); walls.position.y=0.35+H/2; walls.castShadow=walls.receiveShadow=true; g.add(walls);
  const front=new THREE.Group(); front.position.set(0,0.35,D/2+0.01); g.add(front);
  // a heavy oak door and one small window
  mk(G.box(1.1,2.0,0.1), M(0x5a3a24), 1.2,1.35,D/2+0.04,g); for (const y of [0.7,1.35,2.0]) mk(G.box(1.14,0.08,0.06), IRON(), 1.2,y,D/2+0.1,g); mk(G.tor(0.08,0.018,5,10), IRON(), 1.55,1.35,D/2+0.12,g);
  mk(G.box(1.4,0.14,0.2), beam, 1.2,2.42,D/2+0.06,g);
  window1(front, -1.5, 1.55, 0.02, { type:'cross', shut:0x5a5a64, size:0.95, seed:9 });
  const roofH=cottageRoof(g, { style:'slate', L:D, S:W, y:0.35+H, c:slate, trim:0x3a3e46, moss:0.35, seed:71, over:0.4 });
  // the big chimney, and the hearth under a lean-to on the left side, glowing
  const ch=chimney1(g, -W/2+0.7, 0, 0.35, 0.35+H+roofH+1.2, 'stone', 0.0);
  const hearth=new THREE.Group(); hearth.position.set(-W/2-1.25,0,0.2); g.add(hearth);
  mk(G.box(1.8,0.9,1.6), M(0x6a6660,{ roughness:0.95, flatShading:true }), 0,0.45,0,hearth);
  const coals=mk(G.box(1.2,0.12,1.0), glowMat(0xff6a20), 0,0.92,0,hearth); coals.castShadow=false;
  for (let i=0;i<9;i++) mk(G.dod(0.1), glowMat(i%2?0xffa040:0xff5010), -0.45+(i%3)*0.45, 0.98, -0.35+Math.floor(i/3)*0.35, hearth);
  mk(G.cone(1.0,1.1,4), M(0x5a5650,{ roughness:0.9 }), 0,1.95,0,hearth).rotation.y=Math.PI/4; mk(G.cyl(0.25,0.3,1.2,8), M(0x5a5650), 0,2.9,0,hearth);
  for (const z of [-0.8,0.8]) for (const x of [-0.9,0.9]) mk(G.box(0.14,2.3,0.14), beam, x,1.15,z,hearth);
  const lean=mk(G.box(2.3,0.08,2.2), tmat('shingle',slate,2,2), -0.15,2.35,0,hearth); lean.rotation.z=0.22;
  addGlow(hearth, 1.1, 3.2, 0xff8a3a); g.userData.flame=coals;
  // bellows and the anvil on a stump out front, a quench barrel, a rack of tongs
  { const bel=new THREE.Group(); bel.position.set(-W/2-1.25,0.95,1.25); g.add(bel); mk(G.box(0.7,0.18,0.5), M(0x7a4a2a), 0,0,0,bel); mk(G.box(0.7,0.18,0.5), M(0x7a4a2a), 0,0.24,0,bel); mk(G.box(0.66,0.12,0.46), M(0x3a2a20), 0,0.12,0,bel); mk(G.cyl(0.03,0.05,0.5,6), IRON(), 0.5,0.12,0,bel).rotation.z=Math.PI/2; }
  { const an=new THREE.Group(); an.position.set(-1.4,0,D/2+1.5); an.rotation.y=0.4; g.add(an); mk(G.cyl(0.32,0.36,0.6,12), M(0x8a5e3a), 0,0.3,0,an); mk(G.cyl(0.31,0.31,0.01,12), M(0xd8b080), 0,0.605,0,an);
    const ir=M(0x2a2a30,{ metalness:0.7, roughness:0.35 }); mk(G.box(0.3,0.16,0.24), ir, 0,0.7,0,an); mk(G.box(0.6,0.12,0.26), ir, 0.05,0.84,0,an); const horn=mk(G.cone(0.12,0.4,8), ir, 0.5,0.85,0,an); horn.rotation.z=-Math.PI/2;
    const hm=new THREE.Group(); hm.position.set(-0.1,0.92,0.08); hm.rotation.set(0,0.7,0.1); an.add(hm); mk(G.cyl(0.02,0.025,0.45,6), M(0xa8754a), 0.2,0,0,hm).rotation.z=Math.PI/2; mk(G.box(0.08,0.08,0.14), ir, 0,0,0,hm); }
  barrel1(g, -W/2-0.2, D/2+0.7, 0x5a5a60);
  { const rk=new THREE.Group(); rk.position.set(W/2+0.15,0,0.4); g.add(rk); mk(G.box(0.1,1.4,0.1), beam, 0,0.7,-0.5,rk); mk(G.box(0.1,1.4,0.1), beam, 0,0.7,0.5,rk); mk(G.box(0.08,0.08,1.1), beam, 0,1.3,0,rk);
    for (let i=0;i<4;i++){ const t=mk(G.box(0.03,0.8,0.03), IRON(), 0.06,0.9,-0.36+i*0.24,rk); t.rotation.x=(i%2?0.06:-0.06); } }
  // a pile of iron ore and a stack of finished fittings
  for (let i=0;i<8;i++) mk(G.dod(0.18), M(0x6a5248,{ flatShading:true, metalness:0.3 }), W/2-0.3+(i%3)*0.3, 0.15+Math.floor(i/3)*0.15, D/2+0.9+(i%2)*0.25, g);
  hangingSign(g, 1.2, 2.75, D/2+0.02, 'Forge', '#e8e4dc', '#3a3a42', Math.PI);
  wallLantern(front, 2.2, 1.9, 0.02); mossTop(g, W/2-0.4, 0.38, -D/2+0.2, 0.9, 0.3, 7, 5);
  mergeStatic(g, [coals]);
  g.userData.door=[1.2, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-W/2-2.2,-D/2-0.2,W/2+0.3,D/2+0.2]]; g.userData.chimney=ch; return g; }

/* ---------- Thistle's Reef Hall: a round glass-roofed pavilion with a wave frieze, beside the museum ---------- */
export function buildReefHall(){
  const g=new THREE.Group(), R=3.4, H=2.8, wall=tmat('plaster',0xeaf4f4,2,1.2), trim=M(0x2a6a8a), sand=M(0xe8dcc0);
  const base=mk(G.cyl(R+0.35,R+0.45,0.45,32), M(0xc8c0b0,{ roughness:0.9 }), 0,0.12,0,g); base.receiveShadow=true;
  const wl=mk(new THREE.CylinderGeometry(R,R,H,40,1,true), wall, 0,0.35+H/2,0,g); wl.material.side=THREE.DoubleSide;
  // columns and tall blue-glass windows all the way round
  for (let i=0;i<12;i++){ const a=i/12*TAU; if (Math.abs(Math.sin(a)-1)<0.05) continue;
    mk(G.cyl(0.13,0.15,H,10), M(0xf8f8f4), Math.cos(a)*(R+0.05), 0.35+H/2, Math.sin(a)*(R+0.05), g);
    const w=mk(G.box(0.9,1.7,0.06), new THREE.MeshStandardMaterial({ color:0x7ad0e8, emissive:0x2a9ac8, emissiveIntensity:0.25, roughness:0.15 }), Math.cos(a+TAU/24)*(R+0.02), 1.45, Math.sin(a+TAU/24)*(R+0.02), g); w.rotation.y=-(a+TAU/24)+Math.PI/2; }
  // the wave frieze under the eaves
  const cv=document.createElement('canvas'); cv.width=512; cv.height=64; const x=cv.getContext('2d'); x.fillStyle='#2a6a8a'; x.fillRect(0,0,512,64); x.strokeStyle='#eaf8ff'; x.lineWidth=5;
  for (let i=0;i<16;i++){ x.beginPath(); x.arc(i*32+16, 40, 12, Math.PI, 0); x.arc(i*32+24, 40, 5, 0, Math.PI, true); x.stroke(); }
  const ft=new THREE.CanvasTexture(cv); ft.wrapS=THREE.RepeatWrapping; ft.repeat.set(3,1); ft.colorSpace=THREE.SRGBColorSpace;
  mk(new THREE.CylinderGeometry(R+0.12,R+0.12,0.4,40,1,true), new THREE.MeshStandardMaterial({ map:ft, roughness:0.7, side:THREE.DoubleSide }), 0,0.35+H-0.1,0,g);
  // a glass dome with a copper ring and a little starfish finial
  mk(G.cyl(R+0.3,R+0.3,0.14,40), trim, 0,0.35+H+0.12,0,g);
  const dome=mk(G.sph(R+0.1,32,14,0,TAU,0,Math.PI/2), new THREE.MeshStandardMaterial({ color:0x9ae0f0, emissive:0x3ab0d8, emissiveIntensity:0.18, roughness:0.1, metalness:0.1, transparent:true, opacity:0.75 }), 0,0.35+H+0.18,0,g); dome.scale.y=0.55;
  for (let i=0;i<12;i++){ const rib=mk(G.tor(R+0.1,0.04,5,24,Math.PI), trim, 0,0.35+H+0.18,0,g); rib.rotation.y=i/12*Math.PI; rib.scale.y=0.55; rib.scale.z=1; }
  { const st=new THREE.Group(); st.position.y=0.35+H+0.18+(R+0.1)*0.55+0.1; g.add(st); for (let i=0;i<5;i++){ const a=i/5*TAU, arm=mk(G.cone(0.08,0.35,6), M(0xf08a5a), Math.cos(a)*0.15, 0, Math.sin(a)*0.15, st); arm.rotation.set(0,0,-Math.PI/2); arm.rotation.y=-a; } mk(G.sph(0.1,10,8), M(0xf08a5a), 0,0,0,st).scale.y=0.5; st.rotation.x=-Math.PI/2+0.3; }
  // the entrance: a little portico with a shell over the door
  const fz=R+0.05; mk(G.box(1.6,2.3,0.6), wall, 0,1.5,fz,g); mk(G.box(1.1,1.9,0.08), new THREE.MeshStandardMaterial({ color:0x2a5a7a, emissive:0x3ab0d8, emissiveIntensity:0.2 }), 0,1.3,fz+0.31,g);
  mk(G.box(1.9,0.16,0.8), trim, 0,2.72,fz,g); const shell=mk(G.sph(0.42,16,8,0,Math.PI), M(0xf8e8d8), 0,2.82,fz+0.25,g); shell.rotation.x=-Math.PI/2; shell.scale.z=0.4;
  for (const s of [-1,1]){ mk(G.cyl(0.11,0.13,2.3,10), M(0xf8f8f4), s*0.9,1.5,fz+0.35,g); }
  hangingSign(g, 1.6, 2.5, fz+0.36, 'Reef Hall', '#eaf8ff', '#2a6a8a', Math.PI);
  // a sandy bed out front with coral in it, and a couple of clam-shell planters
  mk(G.cyl(1.3,1.3,0.06,24), sand, -2.6,0.03,R+1.0,g); for (const [k,dx,dz,sd] of [['brain',-0.4,0.2,3],['fan',0.35,-0.25,4],['staghorn',0.3,0.45,5]]){ const c=buildCoral(k,1,sd); c.scale.setScalar(0.55); c.position.set(-2.6+dx,0.06,R+1.0+dz); g.add(c); }
  mergeStatic(g);
  g.userData.door=[0, fz+0.3]; g.userData.size={ W:R*2, D:R*2 }; g.userData.rects=[[-R-0.3,-R-0.3,R+0.3,R+0.2]]; return g; }

/* ---------- inside the Reef Hall: a round sandy room around a walk-through glass tunnel of living reef ---------- */
export function buildReefHallRoom(W, D, seed=1){
  const g=new THREE.Group(), r=mulberry32(seed|0), sand=M(0xe8dcc0,{ roughness:0.95 }), wallM=new THREE.MeshStandardMaterial({ color:0x1a4a6a, roughness:0.9, side:THREE.BackSide });
  mk(G.box(W,0.1,D), sand, 0,-0.05,0,g).castShadow=false;
  const shell=mk(G.box(W+0.2,4.6,D+0.2), wallM, 0,2.25,0,g); shell.castShadow=false;
  // the tunnel: an arch of glass running front to back, reef on both sides and over the top, all lit blue
  const TW=2.6, TL=D-4.4, tz=-1.4, tank=new THREE.Group(); tank.position.z=tz; g.add(tank);
  const water=new THREE.MeshStandardMaterial({ color:0x3ab0d8, emissive:0x1a7ab0, emissiveIntensity:0.45, transparent:true, opacity:0.42, depthWrite:false, side:THREE.DoubleSide, roughness:0.1 });
  const boxL=mk(G.box((W-TW)/2-0.5, 3.6, TL), water, -(TW/2+((W-TW)/2-0.5)/2), 1.8, 0, tank); const boxR=mk(G.box((W-TW)/2-0.5, 3.6, TL), water, (TW/2+((W-TW)/2-0.5)/2), 1.8, 0, tank);
  boxL.castShadow=boxR.castShadow=false;
  const arch=mk(new THREE.CylinderGeometry(TW/2+0.05, TW/2+0.05, TL, 24, 1, true, -Math.PI/2, Math.PI), new THREE.MeshPhysicalMaterial({ color:0xcff4ff, transparent:true, opacity:0.18, roughness:0.02, depthWrite:false, side:THREE.DoubleSide }), 0,2.2,0,tank);
  arch.rotation.x=Math.PI/2; arch.rotation.z=Math.PI/2; arch.castShadow=false;
  const archW=mk(new THREE.CylinderGeometry(TW/2+0.7, TW/2+0.7, TL, 24, 1, true, -Math.PI/2, Math.PI), water, 0,2.2,0,tank); archW.rotation.x=Math.PI/2; archW.rotation.z=Math.PI/2; archW.castShadow=false;
  for (const z of [-TL/2, TL/2]){ const ring=mk(G.tor(TW/2+0.1, 0.09, 6, 28, Math.PI), M(0x2a6a8a,{ metalness:0.4, roughness:0.4 }), 0,2.2,z,tank); for (const s of [-1,1]) mk(G.box(0.18,2.2,0.18), M(0x2a6a8a), s*(TW/2+0.1),1.1,z,tank); }
  // sand beds and coral inside the tanks on both sides
  for (const s of [-1,1]){ mk(G.box((W-TW)/2-0.5, 0.35, TL), sand, s*(TW/2+((W-TW)/2-0.5)/2), 0.17, 0, tank);
    for (let i=0;i<10;i++){ const k=['brain','staghorn','fan','table'][i%4], c=buildCoral(k, 2, seed*13+i*7+(s>0?100:0)); c.scale.setScalar(0.6+r()*0.35); c.position.set(s*(TW/2+0.6+r()*((W-TW)/2-1.4)), 0.35, -TL/2+0.6+i/9*(TL-1.2)); c.rotation.y=r()*TAU; tank.add(c); } }
  // fish that swim slow loops through the tanks
  const swim=[], ids=[['wrasse',0xf0703f,0xffd25a,0.8],['goby',0xf2dc5a,0xfff4d0,0.55],['bannerfin',0xf6f2e2,0xf6dc50,0.9],['parrotfish',0x2fbca0,0xf47ab8,1.0],['blenny',0x6a4ad0,0xf2c040,0.6],['grouper',0xd8463a,0xf2a070,1.3],['wrasse',0xf0703f,0xffd25a,0.8],['goby',0xf2dc5a,0xfff4d0,0.55]];
  for (let i=0;i<ids.length*2;i++){ const [id,c,c2,l]=ids[i%ids.length], f=new THREE.Group(); buildFishInto(f, { t:'fish', c, c2, l }, id); f.scale.setScalar(0.9);
    const side=i%2?1:-1; f.userData.sw={ side, x:side*(TW/2+0.8+r()*((W-TW)/2-1.6)), y:0.9+r()*2.2, z0:-TL/2+0.6, z1:TL/2-0.6, ph:r()*TAU, sp:0.25+r()*0.35 }; tank.add(f); swim.push(f); }
  // one big ray gliding over the top of the tunnel
  const ray=new THREE.Group(); buildFishInto(ray, { t:'fish', c:0x34385a, c2:0xf0f0f8, l:1.3, s:'ray' }, 'velvetray'); ray.scale.setScalar(1.6); ray.userData.sw={ over:true, ph:0, sp:0.12 }; tank.add(ray); swim.push(ray);
  g.userData.swim=swim; g.userData.TL=TL; g.userData.tz=tz;
  // light shafts and a plaque by the door
  const lt=new THREE.PointLight(0x7ad8ff, 40, 22, 1.4); lt.position.set(0,3.6,0); lt.castShadow=false; g.add(lt);
  const lt2=new THREE.PointLight(0xfff0d0, 18, 12, 1.6); lt2.position.set(0,2.6,D/2-1.2); lt2.castShadow=false; g.add(lt2);
  const pcv=document.createElement('canvas'); pcv.width=256; pcv.height=128; const px=pcv.getContext('2d'); px.fillStyle='#f4ead6'; px.fillRect(0,0,256,128); px.fillStyle='#2a4a5a'; px.textAlign='center'; px.font='700 26px Fredoka, sans-serif'; px.fillText('THE REEF HALL',128,44); px.font='500 18px Fredoka, sans-serif'; px.fillText('Grown from cuttings out of Cay Bay.',128,78); px.fillText('Please do not tap the glass.',128,104);
  const pt=new THREE.CanvasTexture(pcv); pt.colorSpace=THREE.SRGBColorSpace; const pl=new THREE.Group(); pl.position.set(-TW/2-0.9, 0, D/2-1.6); g.add(pl); mk(G.box(0.08,1.0,0.08), M(0x5a3e28), 0,0.5,0,pl); mk(G.box(0.8,0.42,0.05), new THREE.MeshStandardMaterial({ map:pt, roughness:0.8 }), 0,1.1,0,pl).rotation.x=-0.3;
  for (const s of [-1,1]){ const b=mk(G.box(1.4,0.42,0.5), M(0x8a5e3a), s*(W/2-1.4), 0.21, D/2-2.3, g); b.rotation.y=s*0.5; }   // benches in the foyer, angled at the tunnel mouth
  return g; }
// one frame of the fish going round
export function swimReefHall(g, t){ const L=g.userData.swim||[], TL=g.userData.TL||8;
  for (const f of L){ const s=f.userData.sw;
    if (s.over){ const z=Math.sin(t*s.sp+s.ph)*(TL/2-1.2); f.position.set(Math.sin(t*0.3)*0.4, 3.35, z); f.rotation.set(0, Math.cos(t*s.sp+s.ph)>=0?-Math.PI/2:Math.PI/2, Math.sin(t*0.9)*0.1); continue; }
    const k=(Math.sin(t*s.sp+s.ph)+1)/2, z=lerp(s.z0,s.z1,k), dir=Math.cos(t*s.sp+s.ph)>=0?1:-1;
    f.position.set(s.x+Math.sin(t*0.7+s.ph)*0.25, s.y+Math.sin(t*1.1+s.ph)*0.12, z); f.rotation.y=dir>0?-Math.PI/2:Math.PI/2;
    if (f.userData.tail) f.userData.tail.rotation.y=Math.sin(t*8+s.ph)*0.35; } }

/* ---------- furniture: commissions from the workshop, iron pieces from the forge, the reef tank ---------- */
Object.assign(FURN_BUILDERS, {
  fourposter(g){ const wood=tmat('board',0x8a5a34,1,0.3), dark=M(0x5a3a24), sheet=M(0xfff8ee), quilt=M(0x5a7ab0), drape=M(0xf4e6d0,{ side:THREE.DoubleSide, transparent:true, opacity:0.85 });
    mk(G.box(1.7,0.32,2.2), wood, 0,0.36,0,g); mk(G.box(1.6,0.22,2.1), sheet, 0,0.62,0,g); mk(G.box(1.62,0.12,1.4), quilt, 0,0.76,0.32,g);
    for (let i=0;i<5;i++) mk(G.box(0.3,0.02,1.4), M(0xe8c860), -0.6+i*0.3, 0.83,0.32,g);
    for (const x of [-0.45,0.45]){ const p=mk(G.box(0.62,0.16,0.42), sheet, x,0.8,-0.78,g); p.rotation.x=-0.25; }
    for (const [x,z] of [[-0.82,-1.07],[0.82,-1.07],[-0.82,1.07],[0.82,1.07]]){ mk(G.cyl(0.06,0.07,2.4,8), dark, x,1.2,z,g); mk(G.sph(0.09,8,6), dark, x,2.45,z,g); }
    mk(G.box(1.7,0.1,0.1), dark, 0,2.35,-1.07,g); mk(G.box(1.7,0.1,0.1), dark, 0,2.35,1.07,g); for (const x of [-0.82,0.82]) mk(G.box(0.1,0.1,2.2), dark, x,2.35,0,g);
    mk(G.box(1.64,0.9,0.08), wood, 0,1.05,-1.08,g); mk(G.box(1.64,0.5,0.08), wood, 0,0.6,1.08,g);
    for (const x of [-0.82,0.82]) for (const z of [-0.98,0.98]){ const d=mk(G.box(0.05,1.7,0.3), drape, x,1.5,z,g); d.castShadow=false; } },
  boatshelf(g){ const hull=M(0x3a6a8a), wood=tmat('board',0xc8945a,1,0.3), trim=M(0xf4ead6); const s=new THREE.Shape(); s.moveTo(-0.9,0); s.quadraticCurveTo(-0.95,0.9,-0.55,1.9); s.lineTo(0.55,1.9); s.quadraticCurveTo(0.95,0.9,0.9,0); s.lineTo(-0.9,0);
    const hole=new THREE.Path(); hole.moveTo(-0.8,0.06); hole.lineTo(0.8,0.06); hole.quadraticCurveTo(0.84,0.9,0.47,1.82); hole.lineTo(-0.47,1.82); hole.quadraticCurveTo(-0.84,0.9,-0.8,0.06); s.holes.push(hole);
    const sides=new THREE.ExtrudeGeometry(s,{ depth:0.4, bevelEnabled:false }); sides.translate(0,0,-0.2); const h=mk(sides, hull, 0,0,0,g);
    const bs=new THREE.Shape(hole.getPoints(12)); const back=mk(new THREE.ShapeGeometry(bs), wood, 0,0,-0.16,g); for (const [y,w] of [[0.1,1.6],[0.55,1.6],[1.0,1.46],[1.45,1.2]]){ mk(G.box(w,0.05,0.34), wood, 0,y,0.02,g); }
    const bc=[0xd8604d,0x6a9ad8,0x7cb85a,0xf0c040,0x8a6ad8,0xe8a0c0]; let k=0; for (const y of [0.13,0.58,1.03]) for (let i=0;i<7;i++){ const b=mk(G.box(0.12,0.32+((i*7+k)%4)*0.04,0.24), M(bc[(i+k)%bc.length]), -0.6+i*0.19, y+0.18, 0.02, g); b.rotation.z=(i===6?0.2:0); k++; }
    mk(G.box(1.2,0.05,0.42), trim, 0,1.92,0,g); mk(G.cyl(0.03,0.03,0.9,6), M(0x8a5e3a), 0,2.35,0,g); mk(G.box(0.02,0.55,0.5), trim, 0.02,2.4,0.2,g); mk(G.tor(0.09,0.02,5,12), M(0xf4ead6), -0.6,1.7,0.22,g); },
  longtable(g){ const wood=tmat('board',0xb07a4a,2,0.4), dark=M(0x6a4428);
    mk(G.box(3.2,0.1,1.0), wood, 0,0.78,0,g); for (const x of [-1.4,1.4]) for (const z of [-0.38,0.38]) mk(G.box(0.12,0.75,0.12), dark, x,0.38,z,g); mk(G.box(2.7,0.08,0.08), dark, 0,0.2,0,g);
    for (const z of [-0.75,0.75]){ mk(G.box(3.0,0.07,0.32), wood, 0,0.45,z,g); for (const x of [-1.3,1.3]) mk(G.box(0.1,0.42,0.28), dark, x,0.21,z,g); }
    mk(G.cyl(0.08,0.1,0.2,10), M(0xf4ead6), -0.5,0.93,0,g); for (const c of [0xf0b0c8,0xffd04d,0xffffff]) mk(G.sph(0.06,8,6), M(c), -0.5+(c%3)*0.03,1.07,(c%5)*0.02-0.04,g); mk(G.cyl(0.18,0.2,0.04,14), M(0xf4ead6), 0.6,0.84,0.1,g); mk(G.sph(0.1,10,8), M(0xe2483d), 0.6,0.91,0.1,g); },
  reeftank(g){ const wood=M(0x5a3e28), glassM=new THREE.MeshPhysicalMaterial({ color:0xd8f4ff, transparent:true, opacity:0.22, roughness:0.02, depthWrite:false }), water=new THREE.MeshStandardMaterial({ color:0x4ac0e0, emissive:0x1a8ab8, emissiveIntensity:0.35, transparent:true, opacity:0.45, depthWrite:false });
    mk(G.box(1.5,0.7,0.62), wood, 0,0.35,0,g); mk(G.box(1.56,0.06,0.68), M(0x3a2818), 0,0.73,0,g);
    mk(G.box(1.42,0.75,0.54), glassM, 0,1.14,0,g).castShadow=false; mk(G.box(1.38,0.66,0.5), water, 0,1.1,0,g).castShadow=false; mk(G.box(1.38,0.08,0.5), M(0xe8dcc0), 0,0.8,0,g);
    for (const [k,x,s] of [['brain',-0.45,0.28],['staghorn',0.1,0.3],['fan',0.45,0.3],['table',-0.05,0.24]]){ const c=buildCoral(k,2,hashStr(k)); c.scale.setScalar(s); c.position.set(x,0.84,-0.05); g.add(c); }
    for (const [id,c,c2,x,y] of [['wrasse',0xf0703f,0xffd25a,-0.25,1.15],['goby',0xf2dc5a,0xfff4d0,0.3,1.3]]){ const f=new THREE.Group(); buildFishInto(f, { t:'fish', c, c2, l:0.5 }, id); f.scale.setScalar(0.5); f.position.set(x,y,0.05); f.rotation.y=-Math.PI/2; g.add(f); }
    mk(G.box(1.46,0.06,0.58), M(0x2a2a30), 0,1.53,0,g); const lt=mk(G.box(1.2,0.03,0.3), glowMat(0xbfeaff), 0,1.5,0,g); lt.castShadow=false; addGlow(g, 1.2, 2.0, 0x7ad8ff); },
  ironlantern(g){ const ir=IRON(); mk(G.cyl(0.18,0.24,0.08,8), ir, 0,0.04,0,g); mk(G.cyl(0.035,0.045,1.7,8), ir, 0,0.9,0,g);
    const arm=mk(G.tor(0.22,0.025,5,12,Math.PI), ir, 0.22,1.75,0,g); arm.rotation.z=0; mk(G.cyl(0.015,0.015,0.2,5), ir, 0.44,1.65,0,g);
    const lp=new THREE.Group(); lp.position.set(0.44,1.38,0); g.add(lp); mk(G.box(0.26,0.32,0.26), glowMat(0xffc860), 0,0,0,lp); for (const [x,z] of [[-0.13,-0.13],[0.13,-0.13],[-0.13,0.13],[0.13,0.13]]) mk(G.box(0.03,0.36,0.03), ir, x,0,z,lp);
    mk(G.cone(0.22,0.18,4), ir, 0,0.26,0,lp).rotation.y=Math.PI/4; mk(G.box(0.3,0.03,0.3), ir, 0,-0.17,0,lp); addGlow(lp, 0, 2.4, 0xffc070);
    for (let i=0;i<3;i++){ const c=mk(G.tor(0.06,0.012,4,10), ir, 0, 0.4+i*0.35, 0.04, g); c.rotation.y=Math.PI/2; } },
  irongate(g){ const ir=IRON(), st=M(0x9a948a,{ roughness:0.9, flatShading:true });
    for (const x of [-1.1,1.1]){ mk(G.box(0.38,1.6,0.38), st, x,0.8,0,g); mk(G.box(0.46,0.12,0.46), st, x,1.66,0,g); mk(G.sph(0.14,10,8), st, x,1.84,0,g); }
    for (const s of [-1,1]){ const leaf=new THREE.Group(); leaf.position.set(s*0.9,0,0); g.add(leaf);
      mk(G.box(0.88,0.05,0.05), ir, -s*0.44,0.2,0,leaf); mk(G.box(0.88,0.05,0.05), ir, -s*0.44,1.2,0,leaf);
      for (let i=0;i<5;i++){ const x=-s*(0.08+i*0.18), h=1.25+Math.sin((i+0.5)/5*Math.PI)*0.18*(s<0?1:1); mk(G.box(0.035,h,0.035), ir, x,h/2+0.05,0,leaf); mk(G.cone(0.05,0.12,4), ir, x,h+0.1,0,leaf); }
      const sc=mk(G.tor(0.16,0.018,5,14), ir, -s*0.44,0.7,0,leaf); mk(G.tor(0.08,0.015,5,12), ir, -s*0.44,0.7,0,leaf); } },
  weathervane(g){ const ir=IRON(), br=BRASS(), wd=M(0x8a5e3a); mk(G.cyl(0.25,0.3,0.12,10), M(0x9a948a), 0,0.06,0,g); mk(G.cyl(0.035,0.04,2.4,8), ir, 0,1.25,0,g);
    for (const [a,lab] of [[0,'N'],[Math.PI/2,'E'],[Math.PI,'S'],[-Math.PI/2,'W']]){ const ar=mk(G.box(0.55,0.025,0.025), ir, Math.sin(a)*0.28,1.9,Math.cos(a)*0.28,g); ar.rotation.y=a+Math.PI/2; mk(G.box(0.1,0.12,0.02), br, Math.sin(a)*0.58,1.9,Math.cos(a)*0.58,g).rotation.y=a; }
    const vane=new THREE.Group(); vane.position.y=2.35; g.add(vane); mk(G.box(1.0,0.03,0.03), ir, 0,0,0,vane); mk(G.cone(0.07,0.18,4), ir, 0.56,0,0,vane).rotation.z=-Math.PI/2;
    const fish=new THREE.Shape(); fish.moveTo(-0.5,0); fish.quadraticCurveTo(-0.3,0.18,0,0.12); fish.quadraticCurveTo(0.2,0.08,0.25,0); fish.quadraticCurveTo(0.2,-0.08,0,-0.12); fish.quadraticCurveTo(-0.3,-0.18,-0.5,0); fish.lineTo(-0.65,0.14); fish.lineTo(-0.62,0); fish.lineTo(-0.65,-0.14); fish.lineTo(-0.5,0);
    const fm=mk(new THREE.ExtrudeGeometry(fish,{ depth:0.02, bevelEnabled:false }), br, -0.15,0.2,-0.01,vane); mk(G.sph(0.08,10,8), br, 0,2.6,0,g); g.userData.vane=vane; },
});
