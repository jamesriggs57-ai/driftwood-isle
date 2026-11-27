// v0.5 models: player-designed houses (outside and inside), shops, museum, new furniture, shopkeepers, Mossby.
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { BUILD } from './content.js';
import { asChar, M, MF, mk, G, outline, windowMat, glowMat, addGlow, FURN_BUILDERS, buildItemModel, buildAnimal } from './models.js';
import { cottageRoof, mergeStatic, tbox, tmat, door1, window1, wallLantern, scallopAwning, bunting, barrel1, sack, pot, ivy, dormer, drapedNet, lobsterTrap, hangingVines, lushPlants, mossTop, flowerBed1 } from './cottage.js';

/* ---------- Canvas textures (cached by kind + color) ---------- */
const TEX = new Map();
const hex = c => '#'+new THREE.Color(c).getHexString();
const shade = (c, l) => hex(new THREE.Color(c).offsetHSL(0,0,l));
function canvasTex(key, draw, size=128){
  if (TEX.has(key)) return TEX.get(key);
  const cv=document.createElement('canvas'); cv.width=cv.height=size; draw(cv.getContext('2d'), size);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; TEX.set(key,t); return t;
}
export function surfTex(kind, color){
  return canvasTex(kind+':'+color, (x,S)=>{
    const r=mulberry32(7); x.fillStyle=hex(color); x.fillRect(0,0,S,S);
    if (kind==='siding'){ for(let y=0;y<S;y+=16){ x.fillStyle=shade(color,-0.09); x.fillRect(0,y+13,S,3); x.fillStyle=shade(color,0.05); x.fillRect(0,y,S,2); } }
    else if (kind==='plank'){ for(let i=0;i<S;i+=22){ x.fillStyle=shade(color,-0.1); x.fillRect(i,0,3,S); x.fillStyle=shade(color,-0.03); x.fillRect(i+9,0,5,S); } }
    else if (kind==='shingle'||kind==='roof'){ const h=kind==='roof'?16:14; for(let y=0,row=0;y<S;y+=h,row++){ for(let i=-(row%2)*10;i<S;i+=20){ x.fillStyle=shade(color,(r()-0.5)*0.08); x.fillRect(i+1,y,18,h-2); x.fillStyle=shade(color,-0.14); x.fillRect(i,y+h-2,20,2); } } }
    else if (kind==='brick'){ x.fillStyle='#e8dccc'; x.fillRect(0,0,S,S); for(let y=0,row=0;y<S;y+=16,row++) for(let i=-(row%2)*16;i<S;i+=32){ x.fillStyle=shade(color,(r()-0.5)*0.1); x.fillRect(i+2,y+2,28,12); } }
    else if (kind==='stone'){ x.fillStyle=shade(color,-0.18); x.fillRect(0,0,S,S); for(let k=0;k<26;k++){ const cx=r()*S, cy=r()*S, w=14+r()*16, h=10+r()*10; x.fillStyle=shade(color,(r()-0.5)*0.14); x.beginPath(); x.ellipse(cx,cy,w/2,h/2,0,0,TAU); x.fill(); x.beginPath(); x.ellipse(cx-S*Math.sign(cx-S/2),cy,w/2,h/2,0,0,TAU); x.fill(); } }
    else if (kind==='timber'){ for(let k=0;k<700;k++){ x.fillStyle=shade(color,(r()-0.5)*0.06); x.fillRect(r()*S,r()*S,2,2); } const b='#5a3c2a'; x.fillStyle=b;   // one tile per cell: posts, rails, a cross under the window
      x.fillRect(0,0,6,S); x.fillRect(S-6,0,6,S); x.fillRect(0,S-8,S,8); x.fillRect(0,0,S,7); x.fillRect(0,S*0.64,S,7);
      x.lineWidth=8; x.strokeStyle=b; x.beginPath(); x.moveTo(4,S*0.66); x.lineTo(S-4,S-6); x.moveTo(S-4,S*0.66); x.lineTo(4,S-6); x.stroke();
      x.lineWidth=6; x.beginPath(); x.moveTo(3,28); x.lineTo(26,4); x.moveTo(S-3,28); x.lineTo(S-26,4); x.stroke(); }
    else if (kind==='stucco'){ for(let k=0;k<900;k++){ x.fillStyle=shade(color,(r()-0.5)*0.07); x.fillRect(r()*S,r()*S,2,2); } }
    else if (kind==='log'){ for(let y=0;y<S;y+=21){ const g=x.createLinearGradient(0,y,0,y+21); g.addColorStop(0,shade(color,-0.12)); g.addColorStop(0.4,shade(color,0.06)); g.addColorStop(1,shade(color,-0.16)); x.fillStyle=g; x.fillRect(0,y,S,21); } }
    else if (kind==='wood'){ for(let y=0;y<S;y+=16){ x.fillStyle=shade(color,(r()-0.5)*0.08); x.fillRect(0,y,S,15); x.fillStyle=shade(color,-0.12); x.fillRect(0,y+15,S,1); x.fillRect(((y*37)%S),y,1,15); } }
    else if (kind==='parquet'){ for(let i=0;i<4;i++) for(let j=0;j<4;j++){ const vert=(i+j)%2; for(let k=0;k<4;k++){ x.fillStyle=shade(color,(r()-0.5)*0.1); if(vert) x.fillRect(i*32+k*8,j*32,7,31); else x.fillRect(i*32,j*32+k*8,31,7); } } }
    else if (kind==='tile'){ for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?hex(color):'#f4efe6'; x.fillRect(i*32,j*32,32,32); } x.strokeStyle='rgba(0,0,0,.08)'; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*32,0); x.lineTo(i*32,S); x.moveTo(0,i*32); x.lineTo(S,i*32); x.stroke(); } }
    else if (kind==='carpet'){ for(let k=0;k<1400;k++){ x.fillStyle=shade(color,(r()-0.5)*0.06); x.fillRect(r()*S,r()*S,2,2); } }
    else if (kind==='lattice'){ x.fillStyle='#3a2a20'; x.fillRect(0,0,S,S); x.strokeStyle=hex(color); x.lineWidth=7; for(let i=-S;i<S*2;i+=32){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+S,S); x.stroke(); x.beginPath(); x.moveTo(i,S); x.lineTo(i+S,0); x.stroke(); } }
    // wallpapers
    else if (kind==='p:stripe'){ x.fillStyle=shade(color,-0.06); for(let i=0;i<4;i++) x.fillRect(i*32,0,14,S); }
    else if (kind==='p:dots'){ x.fillStyle=shade(color,-0.08); for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.beginPath(); x.arc(i*32+16+(j%2)*16,j*32+16,5,0,TAU); x.fill(); } }
    else if (kind==='p:check'){ x.fillStyle=shade(color,-0.05); for(let i=0;i<4;i++) for(let j=0;j<4;j++) if((i+j)%2) x.fillRect(i*32,j*32,32,32); }
    else if (kind==='p:wainscot'){ x.fillStyle=shade(color,-0.25); x.fillRect(0,S*0.62,S,S*0.38); x.fillStyle=shade(color,-0.32); for(let i=0;i<S;i+=32) x.fillRect(i,S*0.62,3,S*0.38); x.fillStyle='#ffffff'; x.fillRect(0,S*0.6,S,5); }
    else if (kind==='p:brick'){ x.fillStyle='#efe6da'; x.fillRect(0,0,S,S); for(let y=0,row=0;y<S;y+=16,row++) for(let i=-(row%2)*16;i<S;i+=32){ x.fillStyle=shade(color,(r()-0.5)*0.08); x.fillRect(i+2,y+2,28,12); } }
  });
}
// A material whose texture repeats every `tile` meters for a surface of size w x h
export function tiled(kind, color, w, h, tile=1.2, extra){
  const t=surfTex(kind, color).clone(); t.needsUpdate=true; t.repeat.set(Math.max(0.2,w/tile), Math.max(0.2,h/tile));
  if (kind==='timber') t.repeat.set(Math.max(1,Math.round(w/BUILD.EC)), Math.max(1,Math.round(h/2.2)));
  return new THREE.MeshStandardMaterial(Object.assign({ map:t, roughness:0.9 }, extra||{}));
}
// A box whose side faces are each tiled to their own size
export function texBox(kind, color, W, H, D, tile=1.2){
  const side=tiled(kind,color,D,H,tile), front=tiled(kind,color,W,H,tile), top=M(new THREE.Color(color).offsetHSL(0,0,-0.08).getHex());
  return new THREE.Mesh(G.box(W,H,D), [side,side,top,top,front,front]);
}

/* ---------- Roofs ---------- */
export function roofOn(g, style, W, D, baseY, roofC, trimC, wallKind, wallC, o={}){
  // returns roof height above baseY. Ridge runs along the longer side, or o.ridge ('x' or 'z'). o.moss overrides how mossy a mossy roof is.
  const roofTex=(w,h)=>tiled('roof', roofC, w, h, 1.0);
  const along = o.ridge==='x' ? true : o.ridge==='z' ? false : W>=D; const L = along?W:D, S = along?D:W;
  // v1.8: cottage roofs with shingle courses and flared eaves, thatch, moss and gambrel
  if (['gable','steep','mossy','thatch','gambrel'].includes(style)){
    const gk = wallKind==='timber' ? 'stucco' : wallKind, gm=tiled(gk, wallC, 1, 1, 1.2); gm.map.repeat.set(0.83,0.83);
    return cottageRoof(g, { style, L, S, y:baseY, c:roofC, trim: style==='thatch' ? 0x6a4a30 : trimC, gableMat:gm, ridgeZ:!along, moss: style==='mossy' ? (o.moss ?? 0.75) : 0, seed:Math.round(W*31+D*17)+(o.seed||0), timber: wallKind==='timber', beamC:0x5a3c2a });
  }
  const grp=new THREE.Group(); g.add(grp); if(!along) grp.rotation.y=Math.PI/2;
  if (style==='flat'){
    mk(G.box(W+0.3,0.22,D+0.3), M(new THREE.Color(roofC).offsetHSL(0,0,-0.1).getHex()), 0,baseY+0.11,0,g);
    for (const s of [-1,1]){ mk(G.box(W+0.4,0.32,0.16), M(trimC), 0,baseY+0.3,s*(D/2+0.12),g); mk(G.box(0.16,0.32,D+0.4), M(trimC), s*(W/2+0.12),baseY+0.3,0,g); }
    return 0.5;
  }
  if (style==='hip'){
    const rise=S/2*Math.tan(0.55)+0.15; const cone=new THREE.ConeGeometry(1,rise,4,1); cone.rotateY(Math.PI/4);
    const m=mk(cone, new THREE.MeshStandardMaterial({ map:surfTex('roof',roofC), color:0xffffff, roughness:0.85, flatShading:true }), 0, baseY+rise/2+0.05, 0, g);
    m.scale.set((W+0.7)/Math.SQRT2, 1, (D+0.7)/Math.SQRT2);
    mk(G.box(W+0.5,0.12,D+0.5), M(trimC), 0,baseY+0.04,0,g);
    return rise;
  }
  if (style==='shed'){
    const rise=S*0.32+0.2, span=S+0.6, slope=Math.atan2(rise,span), Ls=span/Math.cos(slope);
    const slab=mk(G.box(L+0.6,0.16,Ls), roofTex(L+0.6,Ls), 0, baseY+rise/2+0.08, 0, grp); slab.rotation.x=slope;
    const tri=new THREE.Shape(); tri.moveTo(-S/2,0); tri.lineTo(S/2,0); tri.lineTo(-S/2,rise*S/span); tri.lineTo(-S/2,0);
    const gm=tiled(wallKind, wallC, 1, 1, 1.2); gm.map.repeat.set(0.83,0.83);
    for (const s of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(tri,{depth:0.1,bevelEnabled:false}), gm, s*(L/2)-(s>0?0.1:0), baseY, 0, grp); m.rotation.y=Math.PI/2; m.position.x = s>0? L/2-0.1 : -L/2; }
    return rise;
  }
  // gable / steep
  const pitch = style==='steep' ? 0.95 : 0.55, over=0.4, hd=S/2+over, rise=hd*Math.tan(pitch), Ls=hd/Math.cos(pitch);
  for (const s of [1,-1]){ const slab=new THREE.Group(); slab.position.set(0, baseY+rise/2+0.05, s*hd/2); slab.rotation.x=s*pitch; grp.add(slab);
    mk(G.box(L+0.7,0.12,Ls), M(trimC), 0,-0.04,0,slab); mk(G.box(L+0.75,0.1,Ls+0.04), roofTex(L+0.75,Ls), 0,0.06,0,slab); }
  mk(G.box(L+0.8,0.16,0.26), M(new THREE.Color(roofC).offsetHSL(0,0,-0.12).getHex()), 0,baseY+rise+0.1,0,grp);
  const tri=new THREE.Shape(); const gh=rise*(S/2)/hd; tri.moveTo(-S/2,0); tri.lineTo(S/2,0); tri.lineTo(0,gh); tri.lineTo(-S/2,0);
  const gm=tiled(wallKind, wallC, 1, 1, 1.2); gm.map.repeat.set(0.83,0.83);
  for (const s of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(tri,{depth:0.1,bevelEnabled:false}), gm, 0, baseY, 0, grp); m.rotation.y=Math.PI/2; m.position.x = s>0? L/2-0.1 : -L/2; }
  return rise;
}

/* The player's house (plan helpers, outside and inside) lives in house.js since v1.25. */

/* ---------- Shops and museum (outside) ---------- */
function signBoard(text, bg='#fff1d6', fg='#5b4336', w=2.4){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const x=cv.getContext('2d');
  x.fillStyle=bg; x.fillRect(0,0,512,128); x.fillStyle=fg; x.font='700 58px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,256,68);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; const g=new THREE.Group();
  mk(G.box(w+0.12,w/4+0.12,0.08), M(0x8b5e3a), 0,0,0,g); mk(G.box(w,w/4,0.1), new THREE.MeshStandardMaterial({ map:t, roughness:0.8 }), 0,0,0.01,g); return g;
}
export function buildShopBuilding(kind, tier=0){
  const g=new THREE.Group(); const W=5.2, D=4.2, F=0.3;
  if (kind==='aquarium'){
    const H=2.6; const wall=tbox('shingle',0x8ad0d8,W,H,D,0.7); wall.position.set(0,F+H/2,0); g.add(wall);
    const base=tbox('stone',0xb0aaa0,W+0.3,F+0.6,D+0.3,0.8); base.position.y=(F-0.6)/2; g.add(base);
    for (const x of [-W/2,W/2]) for (const z of [-D/2,D/2]) mk(G.box(0.18,H,0.18), M(0xffffff), x,F+H/2,z,g);
    mk(G.box(W+0.12,0.14,D+0.12), M(0xffffff), 0,F+H,0,g);
    const rise=cottageRoof(g, { style:'mossy', pitch:0.78, ridgeZ:true, L:D, S:W, y:F+H, c:0x3a6aa0, trim:0xffffff, gableMat:tmat('board',0x8ad0d8,1,1), gableWin:'back', moss:0.5, seed:21 });
    // v1.12 weathered boathouse: porthole dormers, a stovepipe, a plank porch, a drying net, lobster traps, oars, dune grass
    { const tp=Math.tan(0.78), dx=W/2*0.46; for (const e of [-1,1]) dormer(g, e*(dx+0.12), F+H+(W/2-dx)*tp+0.32, -0.3, e*Math.PI/2, { roofC:0x3a6aa0, wallC:0x8ad0d8, wall:'shingle', trim:0xffffff, moss:0.4, seed:e>0?5:6, round:true });
      const sp=new THREE.Group(); sp.position.set(-W/2+1.0,0,-D/4); g.add(sp); mk(G.cyl(0.14,0.14,rise+0.9,10), M(0x5a5a60,{metalness:0.5,roughness:0.5}), 0,F+H+(rise+0.9)/2-0.2,0,sp); mk(G.cone(0.3,0.25,10), M(0x4a4a50,{metalness:0.5,roughness:0.5}), 0,F+H+rise+0.45,0,sp);
      for (let i=0;i<9;i++){ const pl=mk(G.box(0.34,0.1,1.2), M(i%2?0xb08a60:0xa07a50), -1.45+i*0.36,0.05,D/2+0.65,g); }
      for (const x of [-1.6,1.6]){ mk(G.cyl(0.08,0.09,1.0,8), M(0x8b6a48), x,0.5,D/2+1.2,g); mk(G.tor(0.1,0.03,5,10), M(0xd8c8a0), x,0.8,D/2+1.2,g).rotation.x=Math.PI/2; }
      drapedNet(g, -W/2-0.01, F+2.3, 0.3, -Math.PI/2, 2.2, 1.6);
      lobsterTrap(g, -W/2-0.55, 0, D/2+0.2, 0.3); lobsterTrap(g, -W/2-0.5, 0.47, D/2+0.15, -0.2); lobsterTrap(g, -W/2-0.6, 0, D/2-0.5, 1.4);
      for (const e of [-1,1]){ const o=new THREE.Group(); o.position.set(W/2+0.12,0,D/2-0.8+e*0.25); o.rotation.x=e*0.18; o.rotation.z=-0.12; g.add(o); mk(G.cyl(0.035,0.035,2.0,6), M(0xc8a070), 0,1.0,0,o); mk(G.box(0.05,0.55,0.2), M(e>0?0xe2483d:0xffffff), 0,1.95,0,o); }
      const r=mulberry32(4); for (let i=0;i<9;i++){ const tx=(r()<0.5?-1:1)*(W/2+0.3+r()*0.8), tz=D/2+0.3+r()*1.0; for (let k=0;k<5;k++){ const bl=mk(G.cone(0.03,0.5+r()*0.3,4), M(k%2?0x9ab860:0xb8c878), tx+(r()-0.5)*0.15,0.25,tz+(r()-0.5)*0.15,g); bl.rotation.set((r()-0.5)*0.6,0,(r()-0.5)*0.6); bl.castShadow=false; } }
      mossTop(g, 0, F+0.05, D/2+0.1, W, 0.1, 8, 7); }
    // rope along the eave, a round blue door, a life ring and floats, fish crates
    for (const z of [D/2+0.1]){ const rp=mk(G.cyl(0.04,0.04,W+0.2,6), M(0xd8c8a0), 0,F+H-0.08,z,g); rp.rotation.z=Math.PI/2; for (let i=0;i<7;i++) mk(G.sph(0.06,8,6), M(0xc8b890), -W/2+0.1+i*(W-0.2)/6,F+H-0.08,z,g); }
    door1(g, 0, F, D/2+0.02, { type:'round', color:0x2f6ab0, hood:'none' });
    const lr=new THREE.Group(); lr.position.set(W/2+0.03,F+1.5,0.4); lr.rotation.y=Math.PI/2; g.add(lr); mk(G.tor(0.32,0.08,8,18), M(0xe2483d), 0,0,0,lr); for (let k=0;k<4;k++){ const a=k*Math.PI/2+Math.PI/4; mk(G.box(0.12,0.17,0.17), M(0xffffff), Math.cos(a)*0.32,Math.sin(a)*0.32,0,lr).rotation.z=a; }
    for (let k=0;k<3;k++){ mk(G.cyl(0.008,0.008,0.4,4), M(0xd8c8a0), -W/2-0.05, F+H-0.3-k*0.05, D/2-0.4-k*0.35, g); mk(G.sph(0.12,10,8), M(k%2?0xffffff:0xe2483d), -W/2-0.08, F+H-0.55-k*0.1, D/2-0.4-k*0.35, g); }
    barrel1(g, W/2+0.5, D/2+0.2, 0x6a8aa0);
    wallLantern(g, 0.85, F+1.75, D/2+0.02); wallLantern(g, -0.85, F+1.75, D/2+0.02);
    for (const s of [-1,1]){ const pw=new THREE.Group(); pw.position.set(s*1.55,F+1.4,D/2+0.03); g.add(pw); mk(G.tor(0.36,0.08,8,20),M(0xd8a040,{metalness:0.6,roughness:0.3}),0,0,0,pw); mk(G.cyl(0.36,0.36,0.04,20),windowMat,0,0,0,pw).rotation.x=Math.PI/2; }
    const sign=signBoard('Tidepool','#2f6ab0','#ffffff',2.6); sign.position.set(0,F+H+0.6,D/2+0.14); g.add(sign);
    const fish=new THREE.Group(); fish.position.set(0,F+H+rise+0.45,0.4); g.add(fish); const fb=mk(G.sph(0.5,16,12),M(0xf2894a),0,0,0,fish); fb.scale.set(1.5,0.8,0.4); const ft=mk(G.cone(0.4,0.5,4),M(0xf2894a),-0.9,0,0,fish); ft.rotation.z=Math.PI/2; mk(G.sph(0.08,8,6),M(0x222222),0.45,0.12,0.18,fish); g.userData.spin=fish;
    { const rope=mk(G.cyl(0.03,0.03,3.2,6),M(0xd8c8a0),0,0.8,D/2+1.2,g); rope.rotation.z=Math.PI/2; }
    if (tier>=1){ scallopAwning(g, -1.55, F+2.3, D/2+0.04, 1.2, 0.7, 0x2f8ac0, 0xffffff); scallopAwning(g, 1.55, F+2.3, D/2+0.04, 1.2, 0.7, 0x2f8ac0, 0xffffff); bunting(g, -W/2, W/2, F+H+0.02, D/2+0.55, 0.3, [0x2f8ac0,0xffffff,0xe2483d,0xffd04d]); }
    if (tier>=2){ // v1.12: the tank wing is a little mossy fish-scale annex with a big tank window and a porthole
      const wg=tbox('shingle',0x7ac4d0,2.4,2.2,3.2,0.7); wg.position.set(W/2+1.2,F+1.1,-0.3); g.add(wg); const wb=tbox('stone',0xb0aaa0,2.6,F+0.6,3.4,0.8); wb.position.set(W/2+1.2,(F-0.6)/2,-0.3); g.add(wb);
      const r2=new THREE.Group(); r2.position.set(W/2+1.2,0,-0.3); g.add(r2); cottageRoof(r2, { style:'mossy', pitch:0.7, ridgeZ:true, L:3.2, S:2.4, y:F+2.2, c:0x3a6aa0, trim:0xffffff, gableMat:tmat('shingle',0x7ac4d0,1,1), moss:0.6, seed:27, over:0.3, finial:false });
      mk(G.box(1.7,1.1,0.1),M(0xffffff),W/2+1.2,F+1.2,1.3,g); mk(G.box(1.5,0.92,0.06),M(0x5ab8d8,{transparent:true,opacity:0.75,roughness:0.1}),W/2+1.2,F+1.2,1.35,g);
      for (let k=0;k<3;k++){ const f=mk(G.sph(0.08,8,6), M([0xf2894a,0xf0c040,0xe2483d][k]), W/2+0.8+k*0.35, F+1.0+(k%2)*0.3, 1.36, g); f.scale.set(1.8,0.8,0.4); }
      const pw=new THREE.Group(); pw.position.set(W/2+2.42,F+1.4,-0.3); pw.rotation.y=Math.PI/2; g.add(pw); mk(G.tor(0.3,0.07,8,18),M(0xd8a040,{metalness:0.6,roughness:0.3}),0,0,0,pw); mk(G.cyl(0.3,0.3,0.04,18),windowMat,0,0,0,pw).rotation.x=Math.PI/2;
      const iv=new THREE.Group(); iv.position.set(W/2+2.41,0,-0.3); iv.rotation.y=Math.PI/2; g.add(iv); ivy(iv, 1.2, 0.6, 1.8, 29); }
    if (tier>=3){ const tw=new THREE.Group(); tw.position.set(-W/2+0.6,0,-D/2+0.6); g.add(tw); const c=texBox('siding',0xffffff,1.2,6.4,1.2); c.position.y=3.2; tw.add(c); for(let k=0;k<3;k++) mk(G.box(1.24,0.4,1.24),M(0xe2483d),0,1.2+k*1.8,0,tw); mk(G.cyl(0.5,0.5,0.7,10),glowMat(0xfff0b0),0,6.8,0,tw); mk(G.cone(0.7,0.6,10),M(0xe2483d),0,7.45,0,tw); addGlow(tw,6.8,4.5); }
  } else if (kind==='garden'){
    const H=2.4; const frame=M(0xf2ead8), glass=new THREE.MeshStandardMaterial({ color:0xc8f0d8, transparent:true, opacity:0.42, roughness:0.08, metalness:0.1, depthWrite:false });
    mk(G.box(W+0.3,F,D+0.3), M(0xb8a88a), 0,F/2,0,g); const back=texBox('brick',0xb06a50,W,1.0,D); back.position.set(0,F+0.5,0); g.add(back);
    const gl=mk(G.box(W-0.1,H-1.0,D-0.1), glass, 0,F+1.0+(H-1.0)/2,0,g); gl.castShadow=false;
    for (let i=0;i<=5;i++){ const x=-W/2+i*W/5; for (const z of [-D/2,D/2]) mk(G.box(0.08,H,0.08),frame,x,F+H/2,z,g); }
    for (let i=0;i<=4;i++){ const z=-D/2+i*D/4; for (const x of [-W/2,W/2]) mk(G.box(0.08,H,0.08),frame,x,F+H/2,z,g); }
    const roof=new THREE.Group(); g.add(roof); const pitch=0.6, hd=D/2+0.15, Ls=hd/Math.cos(pitch), rise=hd*Math.tan(pitch);
    for (const s of [1,-1]){ const sl=new THREE.Group(); sl.position.set(0,F+H+rise/2,s*hd/2); sl.rotation.x=s*pitch; roof.add(sl); const pg=mk(G.box(W+0.2,0.04,Ls),glass,0,0,0,sl); pg.castShadow=false; for(let i=0;i<=6;i++) mk(G.box(0.06,0.08,Ls),frame,-W/2-0.1+i*(W+0.2)/6,0.03,0,sl); }
    mk(G.box(W+0.3,0.12,0.14),frame,0,F+H+rise,0,roof);
    for (let i=0;i<5;i++){ const p=new THREE.Group(); p.position.set(-1.8+i*0.9,F+1.1,-0.6+(i%2)*0.9); g.add(p); mk(G.cyl(0.18,0.14,0.28,10),M(0xd27a4f),0,0.14,0,p); mk(G.ico(0.22,1),M(i%2?0x5fae43:0x7cc35a),0,0.42,0,p); }
    const dr=mk(G.box(1.0,1.9,0.08),frame,0,F+0.95,D/2+0.02,g); mk(G.box(0.8,1.7,0.04),glass,0,F+0.95,D/2+0.06,g);
    const sign=signBoard('Bug & Bloom','#7cb85a','#ffffff',2.6); sign.position.set(0,F+H+0.35,D/2+0.25); g.add(sign);
    const fc=[0xff7f7f,0xffd04d,0xc7a0ff,0xffffff]; for (const s of [-1,1]){ mk(G.box(1.2,0.35,0.45),M(0x8b5e3a),s*1.8,0.18,D/2+0.6,g); for(let k=0;k<5;k++) mk(G.ico(0.1,1),M(fc[k%4]),s*1.8-0.45+k*0.22,0.46,D/2+0.6,g); }
    // v1.9: iron cresting on the ridge, finials, an arched transom over the door, hanging baskets, pots and ivy on the brick
    { const iron=M(0x2f3a34); for (let i=0;i<=14;i++){ const x=-W/2+i*W/14; mk(G.cyl(0.015,0.015,0.24,4), iron, x,F+H+rise+0.18,0,g); if (i%2===0) mk(G.sph(0.04,6,5), iron, x,F+H+rise+0.32,0,g); }
      mk(G.box(W,0.03,0.03), iron, 0,F+H+rise+0.2,0,g); for (const e of [-1,1]){ mk(G.sph(0.08,8,6), M(0xf2ead8), e*(W/2+0.1),F+H+rise+0.12,0,g); mk(G.cone(0.05,0.3,6), M(0xf2ead8), e*(W/2+0.1),F+H+rise+0.32,0,g); }
      const tr=mk(new THREE.CylinderGeometry(0.5,0.5,0.08,16,1,false,0,Math.PI), frame, 0,F+1.9,D/2+0.02,g); tr.rotation.set(Math.PI/2,0,Math.PI/2,'ZXY'); const tg=mk(new THREE.CircleGeometry(0.42,16,0,Math.PI), glass, 0,F+1.9,D/2+0.07,g); tg.castShadow=false;
      for (const e of [-1,1]){ const hb=new THREE.Group(); hb.position.set(e*(W/2+0.05),F+H-0.1,D/2+0.05); g.add(hb); mk(G.cyl(0.008,0.008,0.4,4), iron, 0,-0.2,0,hb); mk(G.sph(0.2,10,8,0,TAU,Math.PI/2,Math.PI/2), M(0x8b6a40), 0,-0.42,0,hb); mk(G.ico(0.2,1), M(0x5fae43), 0,-0.38,0,hb); for (let k=0;k<4;k++) mk(G.ico(0.06,1), M([0xff7f9f,0xffffff,0xc7a0ff,0xffd04d][k]), Math.cos(k*1.6)*0.17,-0.36,Math.sin(k*1.6)*0.17,hb); }
      for (const e of [-1,1]) pot(g, e*0.85, 0, D/2+0.3, 1.0, 0x5fae43, e<0?0xff7f7f:0xffd04d); pot(g, 2.4, 0, D/2+1.1, 0.8, 0x4f9a3a);
      const iv=new THREE.Group(); iv.position.set(0,0,D/2+0.01); g.add(iv); ivy(iv, -W/2+0.5, 0.7, 0.9, 9); ivy(iv, W/2-0.5, 0.7, 0.9, 11); }
    // v1.12 overgrown: lush plants inside, vines dripping off the eaves, ivy up the corners, moss on the brick,
    // a potting bench, a wheelbarrow of flowers, a birdhouse and a flower bed
    { lushPlants(g, W-0.3, D-0.3, F+1.0, 17);
      const hd2=D/2+0.15, eY=F+H-0.02; hangingVines(g, -W/2, W/2, eY, D/2+0.12, 21, 0xff9ec4); hangingVines(g, -W/2, W/2, eY, -D/2-0.12, 22, 0xffd04d);
      for (const e of [-1,1]){ const sd=new THREE.Group(); sd.position.x=e*(W/2+0.06); sd.rotation.y=e*Math.PI/2; g.add(sd); hangingVines(sd, -D/2, D/2, eY, 0, 23+e, 0xc7a0ff); ivy(sd, e*(D/2-0.3), 0.9, H+0.3, 30+e, 0xff7f9f); ivy(sd, -e*(D/2-0.3), 0.7, H*0.8, 32+e); }
      const fv=new THREE.Group(); fv.position.z=D/2+0.06; g.add(fv); ivy(fv, -W/2+0.3, 0.8, H+0.2, 34, 0xffffff); ivy(fv, W/2-0.3, 0.8, H+0.4, 35, 0xff7f9f);
      mossTop(g, 0, F+1.02, D/2+0.02, W, 0.1, 40, 9); mossTop(g, 0, F+1.02, -D/2-0.02, W, 0.1, 41, 7);
      const pb=new THREE.Group(); pb.position.set(W/2+0.55,0,0.3); pb.rotation.y=-Math.PI/2; g.add(pb); mk(G.box(1.6,0.08,0.55), M(0x9a7a50), 0,0.85,0,pb); for (const x of [-0.72,0.72]) for (const z of [-0.22,0.22]) mk(G.box(0.07,0.85,0.07), M(0x7a5a38), x,0.42,z,pb); mk(G.box(1.5,0.05,0.5), M(0x9a7a50), 0,0.3,0,pb);
      for (let k=0;k<3;k++) pot(pb, -0.5+k*0.5, 0.89, 0, 0.65, 0x5fae43, [0xff7f7f,null,0xc7a0ff][k]); for (let k=0;k<3;k++) mk(G.cyl(0.12,0.1,0.18,8), M(0xd27a4f), -0.4+k*0.35, 0.42, 0, pb);
      const wb=new THREE.Group(); if (tier>=2) wb.position.set(-1.7,0,D/2+1.0); else wb.position.set(-W/2-0.9,0,D/2+0.6); wb.rotation.y=0.5; g.add(wb); const tray=mk(G.box(0.7,0.3,0.9), M(0x6a8a9a), 0,0.5,0,wb); mk(G.tor(0.18,0.04,6,12), M(0x3a302a), 0,0.2,0.5,wb).rotation.y=Math.PI/2;
      for (const x of [-0.25,0.25]){ const h=mk(G.cyl(0.025,0.025,1.0,5), M(0x8b6a40), x,0.55,-0.75,wb); h.rotation.x=1.2; } for (let k=0;k<8;k++) mk(G.ico(0.1,1), M([0xff7f9f,0xffd04d,0xffffff,0x5fae43][k%4]), (k%3-1)*0.2, 0.7+(k%2)*0.05, (Math.floor(k/3)-1)*0.25, wb);
      const bh=new THREE.Group(); bh.position.set(W/2+0.9,0,D/2+1.2); g.add(bh); FURN_BUILDERS.birdhouse(bh);
      flowerBed1(g, 0, -D/2-0.45, W-1.0, 43); }
    if (tier>=1){ const arch=new THREE.Group(); arch.position.set(0,0,D/2+2.2); g.add(arch); FURN_BUILDERS.rosearch(arch); }
    if (tier>=2){ // v1.12: a sage-green potting shed with a mossy roof, a Dutch door and a flower-box window
      const wg=new THREE.Group(); wg.position.set(-W/2-1.3,0,0); g.add(wg); const sb=tbox('stone',0xb0aaa0,2.5,F+0.6,3.3,0.8); sb.position.y=(F-0.6)/2; wg.add(sb);
      const sw=tbox('board',0x9ab88a,2.3,2.1,3.1,0.9); sw.position.y=F+1.05; wg.add(sw); for (const x of [-1.15,1.15]) for (const z of [-1.55,1.55]) mk(G.box(0.12,2.1,0.12),M(0xf2ead8),x,F+1.05,z,wg);
      cottageRoof(wg, { style:'mossy', pitch:0.75, ridgeZ:true, L:3.1, S:2.3, y:F+2.1, c:0x8a5a44, trim:0xf2ead8, gableMat:tmat('board',0x9ab88a,1,1), moss:0.8, seed:47, over:0.3, finial:false, gableWin:'front' });
      door1(wg, 0, F, 1.57, { type:'dutch', color:0x6a8a4a, hood:'none' });
      const sd=new THREE.Group(); sd.position.set(-1.16,0,0); sd.rotation.y=-Math.PI/2; wg.add(sd); window1(sd, 0, F+1.3, 0.03, { type:'cross', shut:0xc7a0ff, box:true, frame:0xf2ead8, seed:2 }); ivy(sd, -1.1, 0.6, 1.9, 48, 0xc7a0ff);
      for (let k=0;k<3;k++){ const t=mk(G.cyl(0.03,0.03,1.3,5), M(0x8b6a40), -1.4, 0.65, 0.9-k*0.18, wg); t.rotation.x=0.15*(k-1); t.rotation.z=0.25; } }
    if (tier>=3){ const dome=mk(G.sph(1.6,20,12,0,TAU,0,Math.PI/2),glass,W/2+1.6,F,0,g); dome.castShadow=false; mk(G.tor(1.6,0.06,6,24),frame,W/2+1.6,F+0.02,0,g).rotation.x=Math.PI/2; for(let k=0;k<6;k++){ const a=k/6*Math.PI; const rb=mk(G.tor(1.6,0.04,6,24,Math.PI),frame,W/2+1.6,F,0,g); rb.rotation.y=a; } mk(G.ico(0.7,1),M(0x3f8a3a),W/2+1.6,F+0.7,0,g); }
  }
  mergeStatic(g, g.userData.spin?[g.userData.spin]:[]);
  g.userData.door=[0, D/2]; g.userData.rects=[[-W/2,-D/2,W/2,D/2]];
  if (kind==='aquarium' && tier>=2) g.userData.rects.push([W/2,-1.9,W/2+2.4,1.3]);
  if (kind==='garden' && tier>=2) g.userData.rects.push([-W/2-2.5,-1.6,-W/2,1.6]);
  if (kind==='garden' && tier>=3) g.userData.rects.push([W/2,-1.6,W/2+3.2,1.6]);
  if (kind==='aquarium' && tier>=3) g.userData.rects.push([-W/2,-D/2,-W/2+1.2,-D/2+1.2]);
  return g;
}
export function buildMuseum(){
  const g=new THREE.Group(); const W=9.5, D=6.5, F=0.6, H=3.4; const stone=0xe8e0d0;
  const base=texBox('stone',0xc8c0b0,W+0.6,F,D+0.6,1.2); base.position.y=F/2; g.add(base);
  const body=texBox('stucco',stone,W,H,D); body.position.y=F+H/2; g.add(body); body.castShadow=body.receiveShadow=true;
  for (let s=0;s<3;s++) mk(G.box(4.2-s*0.3,0.2,0.5), M(0xd8d0c0), 0, F-0.1-s*0.2, D/2+0.4+s*0.45, g);
  for (let i=0;i<6;i++){ const x=-3.75+i*1.5; const c=mk(G.cyl(0.24,0.28,H,14),M(0xf4efe4),x,F+H/2,D/2+0.6,g); mk(G.box(0.62,0.18,0.62),M(0xf4efe4),x,F+H-0.02,D/2+0.6,g); mk(G.box(0.62,0.18,0.62),M(0xf4efe4),x,F+0.09,D/2+0.6,g); }
  mk(G.box(W+0.4,0.4,D+1.6), M(0xf4efe4), 0,F+H+0.2,0.5,g);
  const tri=new THREE.Shape(); tri.moveTo(-W/2-0.2,0); tri.lineTo(W/2+0.2,0); tri.lineTo(0,1.3); tri.lineTo(-W/2-0.2,0);
  mk(new THREE.ExtrudeGeometry(tri,{depth:0.3,bevelEnabled:false}), M(0xf4efe4), 0, F+H+0.4, D/2+0.95, g);
  const rf=new THREE.Group(); rf.position.set(0,0,0); g.add(rf); roofOn(rf,'gable',W+0.4,D+0.6,F+H+0.4,0x5a7a8a,0xf4efe4,'stucco',stone);
  const dome=mk(G.sph(1.5,24,14,0,TAU,0,Math.PI/2), M(0x6aa8a0,{metalness:0.3,roughness:0.5}), 0,F+H+2.4,-0.8,g); mk(G.cyl(1.55,1.55,0.6,24),M(0xf4efe4),0,F+H+2.1,-0.8,g); mk(G.sph(0.18,10,8),M(0xf3c35a,{metalness:0.7,roughness:0.3}),0,F+H+4.0,-0.8,g);
  const dr=mk(G.box(1.5,2.4,0.1),M(0x5a3a2a),0,F+1.2,D/2+0.05,g); mk(G.cyl(0.75,0.75,0.1,16,1,false,0,Math.PI),M(0x5a3a2a),0,F+2.4,D/2+0.05,g).rotation.set(Math.PI/2,0,Math.PI/2);
  const sign=signBoard('Museum','#f4efe4','#5a4a3a',2.4); sign.position.set(0,F+H+0.9,D/2+1.12); g.add(sign);
  for (const s of [-1,1]){ const b=mk(G.box(0.7,1.8,0.04),M(s>0?0xb5523b:0x2f6ab0),s*2.2,F+2.0,D/2+0.92,g); b.castShadow=false; }
  for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*3.1,0,D/2+2.4); g.add(p); mk(G.box(0.7,0.5,0.7),M(0xd8d0c0),0,0.25,0,p); mk(G.ico(0.42,1),M(0x5fae43),0,0.8,0,p); }
  g.userData.door=[0, D/2+1.6]; g.userData.rects=[[-W/2-0.3,-D/2-0.3,W/2+0.3,D/2+1.0],[-2.2,D/2+1.0,2.2,D/2+1.6]];
  return g;
}

/* ---------- Shopkeepers ---------- */
export const buildKeeper = asChar(_buildKeeper);
function _buildKeeper(spec){
  const a=buildAnimal(spec); const u=a.userData;
  if (u.v2){ if (spec.id==='marlo'){ const ap=mk(G.box(0.5,0.46,0.04),M(0xffffff),0,0.6,0.41,u.body); ap.rotation.x=-0.18; } return a; }   // the new builder draws shells, tails and stripes itself
  if (spec.species==='tortoise'){ const sh=outline(mk(G.sph(0.5,16,12,0,TAU,0,Math.PI/2), M(0x6a7a4a), 0,0.75,-0.32,u.body)); sh.rotation.x=-Math.PI/2+0.2; sh.scale.set(1,1,0.8);
    for(let i=0;i<5;i++){ const a2=i/5*TAU; mk(G.cyl(0.12,0.12,0.03,6),M(0x8a9a5a),Math.cos(a2)*0.22,0.75+Math.sin(a2)*0.22,-0.72,u.body).rotation.x=Math.PI/2; }
  }
  if (spec.species==='fox'){ const t=outline(mk(G.sph(0.22,12,10),M(spec.fur),0,0.6,-0.55,u.body)); t.scale.set(0.8,0.8,2); t.rotation.x=0.6; mk(G.sph(0.14,10,8),M(0xffffff),0,0.85,-0.85,u.body); }
  if (spec.species==='otter'){ const t=mk(G.cap(0.08,0.6,4,8),M(spec.fur),0,0.4,-0.5,u.body); t.rotation.x=-1.2; for(const s of [-1,1]) for(let k=0;k<2;k++){ const w=mk(G.cyl(0.004,0.004,0.3,3),M(0xffffff),s*0.28,-0.12+k*0.05,0.42,u.head); w.rotation.z=Math.PI/2+s*0.1*(k?1:-1); } }
  if (spec.stripe){ const st=mk(G.box(0.16,0.05,0.9),M(0xffffff),0,0.47,-0.05,u.head); st.rotation.x=-0.3; for(const s of [-1,1]){ const e=mk(G.box(0.12,0.04,0.5),M(0x3a3a40),s*0.2,0.22,0.3,u.head); e.rotation.set(-0.3,0,s*0.25); } }
  if (spec.id==='marlo'){ const ap=mk(G.box(0.62,0.62,0.06),M(spec.id==='marlo'?0xffffff:0xf2ead8),0,0.72,0.4,u.body); ap.rotation.x=0.08; }
  return a;
}

/* ---------- Mossby, the grumpy little tree keeper ---------- */
export const buildMossby = asChar(_buildMossby);
function _buildMossby(){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const moss=M(0x6a9a4a), mossD=M(0x557f3a), face=M(0xc8d8a0);
  const b=outline(mk(G.sph(0.32,18,14), moss, 0,0.36,0,body)); b.scale.set(1,1.05,0.95);
  for(let i=0;i<9;i++){ const a=i/9*TAU; const t=mk(G.ico(0.09,0), mossD, Math.cos(a)*0.28, 0.32+Math.sin(i*2.3)*0.12, Math.sin(a)*0.26, body); t.castShadow=false; }
  mk(G.sph(0.2,14,10), face, 0,0.34,0.17,body).scale.set(1,0.9,0.6);
  for(const s of [-1,1]){ mk(G.sph(0.035,8,6), M(0x221a1a), s*0.08,0.4,0.29,body); const br=mk(G.box(0.16,0.05,0.06), M(0xf2ead8), s*0.1,0.48,0.27,body); br.rotation.z=s*-0.45; }
  const mo=mk(G.tor(0.05,0.012,6,12,Math.PI), M(0x5a2a2a), 0,0.28,0.29,body); // frown
  const cap=new THREE.Group(); cap.position.y=0.62; body.add(cap); const c=outline(mk(G.sph(0.24,16,10,0,TAU,0,Math.PI/2), M(0x8a5a32), 0,0,0,cap)); c.scale.set(1,0.6,1);
  for(let i=0;i<10;i++){ const a=i/10*TAU; mk(G.box(0.04,0.02,0.18),M(0x6a4422),Math.cos(a)*0.16,0.07,Math.sin(a)*0.16,cap).rotation.y=-a; }
  mk(G.cyl(0.02,0.03,0.14,5), M(0x6a4422), 0,0.2,0,cap); const lf=mk(G.sph(0.08,8,4), M(0x7cc35a), 0.08,0.26,0,cap); lf.scale.set(1.6,0.35,0.8);
  const arms=[]; for(const s of [-1,1]){ const a=new THREE.Group(); a.position.set(s*0.3,0.36,0.02); body.add(a); const tw=mk(G.cyl(0.018,0.025,0.26,5), M(0x7a5232), s*0.1,-0.04,0,a); tw.rotation.z=s*1.1; const f=mk(G.cyl(0.012,0.015,0.1,4),M(0x7a5232),s*0.2,0.03,0,a); f.rotation.z=s*0.3; arms.push(a); }
  const legs=[]; for(const s of [-1,1]){ const l=mk(G.cyl(0.05,0.06,0.12,8), M(0x7a5232), s*0.12,0.06,0,g); legs.push(l); }
  g.userData={ body, arms, legs, mouth:mo }; return g;
}

/* ---------- Museum exhibits ---------- */
function fitInside(m, w, h, d){ const box=new THREE.Box3().setFromObject(m), s=box.getSize(new THREE.Vector3()); const k=Math.min(w/(s.x||1), h/(s.y||1), d/(s.z||1)); m.scale.multiplyScalar(k); const b2=new THREE.Box3().setFromObject(m); m.position.y -= b2.min.y; return m; }
export function buildExhibit(id, kind){
  const g=new THREE.Group(); const wood=M(0x6a4a3a), glass=new THREE.MeshStandardMaterial({ color:0xd8f0ff, transparent:true, opacity:0.22, roughness:0.05, depthWrite:false });
  if (kind==='fish'){
    mk(G.box(1.1,0.6,0.7),wood,0,0.3,0,g); const water=mk(G.box(1.0,0.72,0.6),new THREE.MeshStandardMaterial({ color:0x6ad0e8, transparent:true, opacity:0.35, roughness:0.05, depthWrite:false }),0,0.97,0,g); water.castShadow=false;
    mk(G.box(1.0,0.08,0.6),M(0xf3dca6),0,0.64,0,g); mk(G.box(1.06,0.05,0.66),M(0x3a2a20),0,1.35,0,g);
    for(let k=0;k<3;k++){ const w=mk(G.cyl(0.015,0.02,0.25+k*0.08,4),M(0x4f9a3a),-0.35+k*0.1,0.75+k*0.04,-0.15,g); }
    const f=fitInside(buildItemModel(id),0.8,0.45,0.4); f.position.y+=0.78; f.rotation.y=Math.PI/2; g.add(f); g.userData.swim=f;
  } else if (kind==='bug'){
    mk(G.cyl(0.32,0.36,0.65,12),wood,0,0.32,0,g); mk(G.cyl(0.3,0.3,0.05,16),M(0x8a6a3a),0,0.67,0,g);
    const dome=mk(G.sph(0.3,16,10,0,TAU,0,Math.PI/2),glass,0,0.68,0,g); dome.castShadow=false; dome.scale.y=1.4;
    mk(G.cyl(0.015,0.02,0.3,4),M(0x7a5232),0.08,0.82,0,g).rotation.z=0.3;
    const b=fitInside(buildItemModel(id),0.36,0.3,0.36); b.position.y+=0.72; g.add(b);
  } else {
    mk(G.box(0.7,0.7,0.7),M(0xe8e0d0),0,0.35,0,g); mk(G.box(0.8,0.08,0.8),M(0xd8d0c0),0,0.72,0,g); mk(G.box(0.8,0.08,0.8),M(0xd8d0c0),0,0.04,0,g);
    const sz = kind==='fossil'?0.7:0.5; const it=fitInside(buildItemModel(id),sz,sz,sz); it.position.y+=0.76; g.add(it); g.userData.spin=it;
  }
  return g;
}

/* ---------- New furniture ---------- */
const WOOD=0xa8754a, WOOD2=0x8b5e3a;
Object.assign(FURN_BUILDERS, {
  counter(g){ mk(G.box(2.4,1.0,0.7), M(WOOD), 0,0.5,0,g); mk(G.box(2.5,0.08,0.8), M(0xc99a6a), 0,1.02,0,g); mk(G.box(0.28,0.22,0.22), M(0xd8a040,{metalness:0.5,roughness:0.4}), 0.8,1.17,0,g); mk(G.cyl(0.14,0.12,0.2,10), M(0xbfe6f0,{transparent:true,opacity:0.7}), -0.8,1.15,0,g); },
  shelfstock(g){ mk(G.box(1.8,1.9,0.5), M(WOOD2), 0,0.95,0,g); const cols=[0xe2483d,0x4a7ad8,0xf0c040,0x5aae46,0xf08a5a,0x8a4fa8]; for(let s=0;s<3;s++){ mk(G.box(1.7,0.05,0.46),M(0xc99a6a),0,0.4+s*0.55,0.02,g); for(let i=0;i<5;i++){ const c=cols[(i+s)%6]; if((i+s)%3===0) mk(G.cyl(0.11,0.11,0.3,10),M(c),-0.64+i*0.32,0.58+s*0.55,0.06,g); else mk(G.box(0.24,0.3,0.24),M(c),-0.64+i*0.32,0.58+s*0.55,0.06,g); } } },
  fishtank(g){ mk(G.box(1.0,0.6,0.5),M(WOOD2),0,0.3,0,g); mk(G.box(0.95,0.6,0.45),new THREE.MeshStandardMaterial({color:0x6ad0e8,transparent:true,opacity:0.45,roughness:0.05}),0,0.92,0,g); mk(G.box(0.95,0.06,0.45),M(0xf3dca6),0,0.65,0,g); for(let i=0;i<3;i++){ const f=mk(G.sph(0.06,8,6),M([0xf2894a,0xf0c040,0x4a7ad8][i]),-0.25+i*0.25,0.85+i*0.08,0,g); f.scale.set(1.6,0.9,0.6); } mk(G.cyl(0.015,0.02,0.3,4),M(0x4f9a3a),0.35,0.8,-0.1,g); },
  lifering(g){ mk(G.box(0.08,1.3,0.08),M(WOOD2),0,0.65,-0.05,g); const r=mk(G.tor(0.32,0.09,10,20),M(0xffffff),0,0.95,0.02,g); for(let i=0;i<4;i++){ const s=mk(G.tor(0.32,0.095,10,4,Math.PI/8),M(0xe2483d),0,0.95,0.02,g); s.rotation.z=i*Math.PI/2; } },
  anchor(g){ const ir=M(0x5a6068,{metalness:0.6,roughness:0.5}); mk(G.cyl(0.05,0.05,1.1,8),ir,0,0.7,0,g); mk(G.tor(0.12,0.04,6,12),ir,0,1.32,0,g); mk(G.box(0.55,0.06,0.06),ir,0,1.1,0,g); const arc=mk(G.tor(0.38,0.05,6,16,Math.PI),ir,0,0.38,0,g); arc.rotation.z=Math.PI; for(const s of [-1,1]){ const t=mk(G.cone(0.08,0.18,4),ir,s*0.38,0.42,0,g); } },
  shipwheel(g){ mk(G.box(0.14,1.0,0.14),M(WOOD2),0,0.5,-0.1,g); const w=new THREE.Group(); w.position.set(0,1.05,0); g.add(w); mk(G.tor(0.4,0.04,8,24),M(WOOD),0,0,0,w); mk(G.cyl(0.08,0.08,0.1,10),M(WOOD2),0,0,0,w).rotation.x=Math.PI/2; for(let i=0;i<8;i++){ const sp=mk(G.cyl(0.025,0.025,1.1,6),M(WOOD),0,0,0,w); sp.rotation.z=i*Math.PI/8*2/2+i*Math.PI/8; mk(G.sph(0.045,8,6),M(WOOD2),Math.cos(i*Math.PI/4)*0.55,Math.sin(i*Math.PI/4)*0.55,0,w); } },
  buoylamp(g){ mk(G.cyl(0.25,0.3,0.12,12),M(0x3a3a40),0,0.06,0,g); mk(G.cyl(0.05,0.05,0.8,8),M(0x3a3a40),0,0.5,0,g); const b=mk(G.sph(0.28,16,12),M(0xe2483d),0,1.05,0,g); mk(G.cyl(0.29,0.29,0.1,16),M(0xffffff),0,1.05,0,g); mk(G.sph(0.12,10,8),glowMat(0xfff0b0),0,1.38,0,g); addGlow(g,1.35,2.4); },
  corallamp(g){ mk(G.cyl(0.2,0.25,0.2,12),M(0xf4efe4),0,0.1,0,g); for(let i=0;i<6;i++){ const a=i/6*TAU; const br=mk(G.cyl(0.04,0.06,0.6,6),glowMat(0xf27a9a),Math.cos(a)*0.1,0.45,Math.sin(a)*0.1,g); br.rotation.set(Math.sin(a)*0.4,0,-Math.cos(a)*0.4); mk(G.sph(0.06,8,6),glowMat(0xf8a0b8),Math.cos(a)*0.22,0.72,Math.sin(a)*0.22,g); } addGlow(g,0.6,2.2,0xff9ab0); },
  bigtank(g){ mk(G.box(2.2,0.7,0.9),M(WOOD2),0,0.35,0,g); mk(G.box(2.1,1.1,0.8),new THREE.MeshStandardMaterial({color:0x5ac8e0,transparent:true,opacity:0.45,roughness:0.05}),0,1.25,0,g); mk(G.box(2.1,0.1,0.8),M(0xf3dca6),0,0.75,0,g); for(let i=0;i<7;i++){ const f=mk(G.sph(0.08,8,6),M([0xf2894a,0xf0c040,0x4a7ad8,0xe2483d][i%4]),-0.8+i*0.27,1.0+(i%3)*0.22,(i%2)*0.2-0.1,g); f.scale.set(1.7,0.9,0.6); } for(let k=0;k<5;k++) mk(G.cyl(0.02,0.03,0.4+k*0.1,4),M(0x4f9a3a),-0.9+k*0.45,1.0,-0.25,g); mk(G.box(2.2,0.08,0.9),M(0x3a2a20),0,1.84,0,g); },
  terrarium(g){ mk(G.box(0.8,0.5,0.5),M(WOOD),0,0.25,0,g); mk(G.box(0.75,0.5,0.45),new THREE.MeshStandardMaterial({color:0xd8f0e0,transparent:true,opacity:0.3,roughness:0.05}),0,0.75,0,g); mk(G.box(0.75,0.06,0.45),M(0x6b4a30),0,0.52,0,g); mk(G.cyl(0.015,0.02,0.4,4),M(0x7a5232),-0.1,0.7,0,g).rotation.z=0.4; mk(G.ico(0.12,1),M(0x5fae43),0.2,0.62,0.05,g); const bt=mk(G.sph(0.05,8,6),M(0x2a7a4a),0.02,0.75,0.05,g); bt.scale.set(1,0.6,1.4); },
  skep(g){ mk(G.cyl(0.32,0.32,0.08,12),M(WOOD2),0,0.5,0,g); for(let i=0;i<5;i++) mk(G.tor(0.3-i*0.05,0.05,6,16),M(0xd8b060),0,0.6+i*0.1,0,g).rotation.x=Math.PI/2; mk(G.sph(0.1,8,6),M(0xd8b060),0,1.08,0,g); mk(G.cyl(0.05,0.05,0.5,6),M(WOOD2),0,0.25,0,g); mk(G.box(0.08,0.06,0.03),M(0x3a2a20),0,0.64,0.3,g); },
  gnome(g){ mk(G.cyl(0.2,0.24,0.4,10),M(0x4a7ad8),0,0.2,0,g); mk(G.sph(0.15,10,8),M(0xf3c9a5),0,0.52,0,g); mk(G.cone(0.17,0.4,10),M(0xe2483d),0,0.82,0,g); const bd=mk(G.cone(0.13,0.25,8),M(0xffffff),0,0.38,0.08,g); bd.rotation.x=Math.PI; mk(G.sph(0.04,6,5),M(0xf0a090),0,0.52,0.14,g); },
  butterflyframe(g){ mk(G.box(0.08,1.2,0.08),M(WOOD2),0,0.6,-0.05,g); mk(G.box(0.9,0.7,0.06),M(WOOD),0,1.2,0,g); mk(G.box(0.8,0.6,0.02),M(0xfff8ea),0,1.2,0.035,g); const cs=[0x5a9ae8,0xf0a030,0xe86aa8]; for(let i=0;i<3;i++) for(const s of [-1,1]){ const w=mk(G.sph(0.06,8,4),M(cs[i]),-0.25+i*0.25+s*0.05,1.22,0.05,g); w.scale.set(1,1.3,0.2); } },
  mothlamp(g){ mk(G.cyl(0.04,0.05,1.5,8),M(0x4a3a30),0,0.75,0,g); mk(G.cyl(0.2,0.24,0.06,10),M(0x4a3a30),0,0.03,0,g); mk(G.sph(0.2,12,10),glowMat(0xe8ffb0),0,1.65,0,g); addGlow(g,1.65,2.6,0xe8ffb0); for(let i=0;i<3;i++){ const a=i*2.1; const m=mk(G.sph(0.04,6,4),M(0xd8c8a0),Math.cos(a)*0.32,1.7+i*0.05,Math.sin(a)*0.32,g); m.scale.set(1.8,0.3,1); } },
  rosearch(g){ const fr=M(0xf2ead8); for(const x of [-0.9,0.9]) mk(G.box(0.1,2.0,0.1),fr,x,1.0,0,g); const arc=mk(G.tor(0.9,0.05,6,20,Math.PI),fr,0,2.0,0,g); for(let i=0;i<18;i++){ const a=i/17*Math.PI; const x=Math.cos(a)*0.9, y=2.0+Math.sin(a)*0.9; mk(G.ico(0.13,0),M(0x4f9a3a),x,y,0.05,g); if(i%2) mk(G.ico(0.08,1),M(i%4===1?0xe2483d:0xf5a0c0),x,y,0.14,g); } for(let i=0;i<6;i++){ mk(G.ico(0.12,0),M(0x5fae43),(i<3?-0.9:0.9),0.4+(i%3)*0.5,0.06,g); } },
  fountain(g){ const st=M(0xc8c4b8); mk(G.cyl(1.0,1.05,0.4,24),st,0,0.2,0,g); mk(G.cyl(0.9,0.9,0.05,24),new THREE.MeshStandardMaterial({color:0x6ad0e8,roughness:0.1,transparent:true,opacity:0.8}),0,0.38,0,g); mk(G.cyl(0.12,0.16,1.0,10),st,0,0.8,0,g); mk(G.cyl(0.45,0.2,0.2,16),st,0,1.3,0,g); mk(G.cyl(0.38,0.38,0.04,16),M(0x6ad0e8,{roughness:0.1}),0,1.4,0,g); mk(G.sph(0.1,8,6),st,0,1.55,0,g); for(let i=0;i<6;i++){ const a=i/6*TAU; mk(G.sph(0.04,6,4),M(0xbfe6f0),Math.cos(a)*0.35,1.2,Math.sin(a)*0.35,g); } },
  grandfather(g){ mk(G.box(0.6,2.2,0.4),M(0x6a4a3a),0,1.1,0,g); mk(G.cyl(0.22,0.22,0.04,20),M(0xfff8ea),0,1.8,0.21,g).rotation.x=Math.PI/2; mk(G.box(0.02,0.16,0.02),M(0x222222),0,1.85,0.24,g); mk(G.box(0.12,0.02,0.02),M(0x222222),0.05,1.8,0.24,g); mk(G.box(0.36,0.8,0.02),M(0xbfe6f0,{transparent:true,opacity:0.6}),0,0.9,0.21,g); mk(G.sph(0.08,10,8),M(0xd8a040,{metalness:0.7,roughness:0.3}),0,0.7,0.18,g); mk(G.box(0.7,0.12,0.5),M(0x5a3a2a),0,2.25,0,g); },
  piano(g){ mk(G.box(1.5,1.2,0.6),M(0x2a2228),0,0.75,0,g); mk(G.box(1.4,0.08,0.3),M(0xffffff),0,0.78,0.42,g); for(let i=0;i<10;i++) mk(G.box(0.05,0.03,0.18),M(0x111111),-0.6+i*0.14,0.83,0.38,g); mk(G.box(1.5,0.08,0.7),M(0x2a2228),0,1.38,0.03,g); for(const x of [-0.65,0.65]) mk(G.box(0.08,0.3,0.4),M(0x2a2228),x,0.15,0.25,g); mk(G.box(0.8,0.5,0.35),M(0x2a2228),0,0.25,1.0,g); },
  globe(g){ mk(G.cyl(0.25,0.3,0.06,14),M(WOOD2),0,0.03,0,g); mk(G.cyl(0.03,0.03,0.6,6),M(WOOD2),0,0.33,0,g); const gl=mk(G.sph(0.3,20,14),M(0x4a8ad8),0,0.85,0,g); for(let i=0;i<4;i++){ const c=mk(G.sph(0.12,8,6),M(0x6ab84a),Math.cos(i*1.7)*0.24,0.85+Math.sin(i*2.3)*0.15,Math.sin(i*1.7)*0.24,g); c.scale.set(1,0.6,0.3); c.lookAt(0,0.85,0); } const r=mk(G.tor(0.34,0.02,6,24,Math.PI*1.4),M(0xd8a040,{metalness:0.6}),0,0.85,0,g); r.rotation.y=Math.PI/2; },
  skeleton(g){ const b=M(0xf4efe0); mk(G.box(1.4,0.08,0.6),M(WOOD2),0,0.04,0,g); for(let i=0;i<9;i++){ const v=mk(G.sph(0.07,8,6),b,-0.55+i*0.14,0.75+Math.sin(i/8*Math.PI)*0.2,0,g); } mk(G.box(0.3,0.18,0.16),b,-0.75,0.88,0,g); for(let i=0;i<4;i++){ const r=mk(G.tor(0.16,0.02,4,10,Math.PI),b,-0.25+i*0.14,0.75,0,g); r.rotation.set(0,Math.PI/2,Math.PI); } for(const x of [-0.3,0.35]) for(const z of [-0.12,0.12]) mk(G.cyl(0.03,0.03,0.7,5),b,x,0.4,z,g); mk(G.cyl(0.02,0.04,0.5,5),b,0.75,0.8,0,g).rotation.z=-1.1; },
  statue(g){ const st=M(0xd8d4c8); mk(G.box(0.8,0.6,0.8),st,0,0.3,0,g); mk(G.cap(0.2,0.5,4,10),st,0,1.05,0,g); mk(G.sph(0.2,12,10),st,0,1.6,0,g); mk(G.cyl(0.26,0.26,0.05,14),st,0,1.75,0,g); mk(G.cyl(0.14,0.16,0.14,12),st,0,1.83,0,g); const arm=mk(G.cap(0.06,0.4,4,8),st,0.25,1.4,0.1,g); arm.rotation.z=-2.4; mk(G.cyl(0.03,0.03,0.4,6),st,0.48,1.68,0.1,g).rotation.z=0.3; },
});

/* ---------- Wendell's wizard tower ---------- */
export function buildTower(){
  const g=new THREE.Group(); const R=2.1, H=5.2, F=0.5;
  const plinth=texBox('stone',0xa8a49a,R*2+0.8,F+1.2,R*2+0.8,1.0); plinth.position.y=F/2-0.6; g.add(plinth);   // reaches below ground on slopes
  const body=mk(new THREE.CylinderGeometry(R,R*1.06,H,24), M(0xb4ae9e), 0,F+H/2,0,g);   // v1.26: older, greyer stone body.castShadow=body.receiveShadow=true;
  for (let k=0;k<5;k++) for (let i=0;i<10;i++){ const a=i/10*TAU+(k%2)*0.31; if (k<3 && Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<0.45) continue; const st=mk(G.box(0.7,0.36,0.08), M([0xa8a292,0x9a9484,0xb2ac9c][(i+k)%3]), Math.sin(a)*(R+0.03), F+0.5+k*1.0, Math.cos(a)*(R+0.03), g); st.rotation.y=a; st.castShadow=false; }
  const band=mk(G.cyl(R+0.12,R+0.12,0.25,20), M(0x5a5248), 0,F+H,0,g);
  const roof=outline(mk(new THREE.ConeGeometry(R+0.7,3.6,20), M(0x4e5460,{flatShading:true}).clone(), 0,F+H+1.8,0,g)); roof.rotation.y=0.1;   // slate, crooked a touch (its own material: it fades when you're on the balcony behind it)
  roof.rotation.z=0.06;
  for (let i=0;i<7;i++){ const a=i/7*TAU+0.3; mk(G.sph(0.32,7,5), M(0x5f8a3e), Math.sin(a)*(R+0.35), F+H+0.25, Math.cos(a)*(R+0.35), g).scale.set(1.2,0.35,1); }
  // an iron finial with a crescent-moon vane instead of a glowing ball
  mk(G.cyl(0.04,0.06,0.9,6), M(0x2c2a28), 0.2,F+H+3.95,0,g); const vane=mk(new THREE.TorusGeometry(0.22,0.04,6,14,Math.PI*1.3), M(0x2c2a28), 0.2,F+H+4.45,0,g); vane.rotation.z=0.6;
  // ivy up one side
  for (let i=0;i<14;i++){ const t=i/14, a=-2.2+Math.sin(i*1.3)*0.25; mk(G.sph(0.2,6,4), M(0x4f8a3a), Math.sin(a)*(R+0.12), F+0.3+t*H*0.8, Math.cos(a)*(R+0.12), g).scale.set(1,0.8,0.5); }
  // windows (round, glowing)
  // v1.72 a balcony round the top, under the eaves, with a little door out from the observatory (Wendell lets friends out on it)
  const BY=F+3.8, BR=R+1.15, BD=-0.7, wood=M(0x5a3e2a), iron=M(0x2c2a28);
  { const deck=mk(G.cyl(BR,BR,0.14,28), wood, 0,BY-0.07,0,g); deck.receiveShadow=true;
    for (let i=0;i<10;i++){ const a=i/10*TAU+0.15, b=mk(G.box(0.12,0.12,1.3), wood, Math.sin(a)*(R+0.45),BY-0.5,Math.cos(a)*(R+0.45),g); b.rotation.set(0.75,a,0,'YXZ'); }   // struts under it
    for (let i=0;i<24;i++){ const a=i/24*TAU; mk(G.box(0.05,0.9,0.05), iron, Math.sin(a)*(BR-0.08),BY+0.45,Math.cos(a)*(BR-0.08),g).castShadow=false; }
    for (const y of [0.9,0.48]){ const t=mk(G.tor(BR-0.08,0.03,6,48), iron, 0,BY+y,0,g); t.rotation.x=Math.PI/2; t.castShadow=false; }
    const dr=new THREE.Group(); dr.position.set(Math.sin(BD)*(R+0.06), BY, Math.cos(BD)*(R+0.06)); dr.rotation.y=BD; g.add(dr);
    mk(G.box(0.86,1.5,0.1), M(0x8a7a6a), 0,0.75,0,dr); mk(G.box(0.68,1.36,0.14), wood, 0,0.68,0.02,dr); mk(G.sph(0.05,8,6), M(0xf3c35a,{metalness:0.7,roughness:0.3}), 0.24,0.7,0.1,dr); }
  for (const [y,a] of [[F+2.6,0.6],[F+2.9,-1.5],[F+2.0,Math.PI-0.5],[F+4.1,Math.PI+0.6]]){ const w=mk(G.cyl(0.32,0.32,0.08,16), glowMat(0xffd27a), Math.sin(a)*(R+0.02), y, Math.cos(a)*(R+0.02), g); w.rotation.set(Math.PI/2,0,0); w.rotation.y=a; w.lookAt(Math.sin(a)*10, y, Math.cos(a)*10); w.rotateX(Math.PI/2); }
  // door
  mk(G.box(1.4,2.35,0.1), M(0x8a7a6a), 0,F+1.12,R+0.04,g); const dr=mk(G.box(1.1,1.9,0.16), M(0x5a3e2a), 0,F+0.95,R+0.1,g); const arch=mk(new THREE.CylinderGeometry(0.55,0.55,0.16,16,1,false,-Math.PI/2,Math.PI), M(0x5a3e2a), 0,F+1.9,R+0.1,g); arch.rotation.set(-Math.PI/2,0,0);
  mk(G.sph(0.07,8,6), M(0xf3c35a,{metalness:0.7,roughness:0.3}), 0.35,F+0.95,R+0.2,g);
  for (let s=0;s<2;s++) mk(G.box(1.6-s*0.3,0.18,0.5), M(0xa8a49a), 0, F-0.09-s*0.18, R+0.3+s*0.4, g);
  const sign=new THREE.Group(); sign.position.set(1.6,0,R+1.3); g.add(sign); mk(G.cyl(0.05,0.05,1.2,6),M(0x6a4a3a),0,0.6,0,sign); const moon=mk(G.cyl(0.3,0.3,0.06,16),M(0xffe9a8),0,1.25,0,sign); moon.rotation.x=Math.PI/2;
  // a few floating sparkles that bob (animated by the game)
  const orbs=[]; for(let i=0;i<4;i++){ const o=mk(G.ico(0.06,1), glowMat(0xfff0b0), 0,0,0,g); o.castShadow=false; o.userData.ph=i/4; orbs.push(o); } g.userData.orbs=orbs;
  g.userData.door=[0, R+0.9]; g.userData.rects=[[-R-0.2,-R-0.2,R+0.2,R+0.3]];
  g.userData.roof=roof; g.userData.balcony={ y:BY, rIn:R+0.35, rOut:BR-0.38, doorA:BD };
  return g;
}
/* Wendell, the island wizard (an old goat in a starry hat) */
export const buildWizard = asChar(_buildWizard);
function _buildWizard(){
  const spec={ species:'goat', ears:'goat', fur:0xe8e2d8, muzzle:0xfffaf2, shirt:0x6e6a62, cheek:0xe8b0c0 };   // v1.26: a grey, road-worn wizard
  const a=buildAnimal(spec); const u=a.userData;
  const hat=new THREE.Group(); hat.position.set(0,0.42,-0.02); u.head.add(hat);
  const felt=M(0x77736b,{roughness:0.95});
  const brim=outline(mk(G.cyl(0.7,0.66,0.05,24), felt, 0,0,0,hat)); brim.rotation.x=0.08;
  // a tall, floppy pointed hat: two cones, the top one bent over
  const c1=outline(mk(new THREE.ConeGeometry(0.4,0.75,18,1,true), felt, 0,0.38,0,hat)); c1.material.side=THREE.DoubleSide;
  const tipG=new THREE.Group(); tipG.position.set(0,0.7,0); tipG.rotation.z=0.75; hat.add(tipG); outline(mk(new THREE.ConeGeometry(0.17,0.5,14), felt, 0,0.22,0,tipG));
  mk(G.cyl(0.41,0.43,0.08,18), M(0x4a4038), 0,0.07,0,hat);   // a band
  const beard=outline(mk(new THREE.ConeGeometry(0.24,0.8,12), M(0xf0eee8), 0,-0.52,0.34,u.head)); beard.rotation.x=Math.PI+0.18;
  const robe=mk(new THREE.CylinderGeometry(0.38,0.6,0.66,16), M(0x6e6a62,{roughness:0.95}), 0,0.4,0,u.body); robe.castShadow=true;
  mk(G.cyl(0.4,0.42,0.06,16), M(0x4a3a2c), 0,0.66,0,u.body);   // a rope belt
  const cloak=mk(new THREE.CylinderGeometry(0.42,0.66,0.9,16,1,true,Math.PI*0.6,Math.PI*0.8), M(0x5a5650,{roughness:0.95}), 0,0.5,-0.04,u.body); cloak.material.side=THREE.DoubleSide;
  const staff=new THREE.Group(); u.arms[1].add(staff); staff.position.set(0.04,-0.3,0.08);
  // a gnarled wooden staff with a small stone set in a knot of roots at the top
  const sw=M(0x6a4a2e); mk(G.cyl(0.035,0.045,1.6,6), sw, 0,0.3,0,staff);
  for (let i=0;i<4;i++){ const a=i/4*TAU; const k=mk(G.cyl(0.018,0.03,0.3,5), sw, Math.cos(a)*0.07,1.12,Math.sin(a)*0.07,staff); k.rotation.set(Math.sin(a)*0.5,0,-Math.cos(a)*0.5); }
  const orb=mk(G.sph(0.08,10,8), glowMat(0xfff2c9), 0,1.14,0,staff); u.orb=orb;
  return a;
}
