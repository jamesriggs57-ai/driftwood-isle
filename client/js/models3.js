// v1.0 models: town hall, museum stages, general store, market stands, move-in plots, crops, food, sled, stairs.
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { M, MF, mk, G, outline, windowMat, glowMat, addGlow, FURN_BUILDERS } from './models.js';
import { buildMuseum } from './models2.js';
import { tbox, tmat, window1, door1, wallLantern, chimney1, cottageRoof, mergeStatic, scallopAwning, bunting, hangingSign, sack, barrel1, flowerBed1, pot, ivy, timberFace, dormer, bayWindow, drapedNet, lobsterTrap, hangingVines, mossTop } from './cottage.js';

const WOOD=0xa8754a, WOOD2=0x8b5e3a, WOODL=0xc99a6a;
function sign(text, bg='#fff1d6', fg='#5b4336', w=2.4){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const x=cv.getContext('2d');
  x.fillStyle=bg; x.fillRect(0,0,512,128); x.fillStyle=fg; x.font='700 56px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,256,68);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; const g=new THREE.Group();
  mk(G.box(w+0.12,w/4+0.12,0.08), M(WOOD2), 0,0,0,g); mk(G.box(w,w/4,0.1), new THREE.MeshStandardMaterial({ map:t, roughness:0.8 }), 0,0,0.01,g); return g;
}
function gable(g, W, D, y, col, over=0.35, pitch=0.6){
  const hd=D/2+over, rise=hd*Math.tan(pitch), Ls=hd/Math.cos(pitch);
  for (const s of [1,-1]){ const sl=mk(G.box(W+over*2,0.14,Ls), M(col), 0, y+rise/2, s*hd/2, g); sl.rotation.x=s*pitch; }
  mk(G.box(W+over*2+0.05,0.16,0.22), M(new THREE.Color(col).offsetHSL(0,0,-0.12).getHex()), 0, y+rise+0.04, 0, g);
  const tri=new THREE.Shape(); tri.moveTo(-D/2,0); tri.lineTo(D/2,0); tri.lineTo(0,rise*(D/2)/hd); tri.lineTo(-D/2,0);
  for (const s of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(tri,{depth:0.1,bevelEnabled:false}), M(0xf2ead8), s>0?W/2-0.1:-W/2, y, 0, g); m.rotation.y=Math.PI/2; }
  return rise;
}
function win(g, x, y, z, w=0.8, h=0.8){ mk(G.box(w+0.14,h+0.14,0.08), M(0xffffff), x,y,z,g); mk(G.box(w,h,0.06), windowMat, x,y,z+0.03,g); mk(G.box(0.05,h,0.08), M(0xffffff), x,y,z+0.05,g); }

/* ---------- Plot waiting for a new neighbor ---------- */
export function buildPlot(soon){
  const g=new THREE.Group(), W=4.4, D=3.6;
  for (const [x,z] of [[-W/2,-D/2],[W/2,-D/2],[-W/2,D/2],[W/2,D/2]]) mk(G.cyl(0.06,0.07,0.7,6), M(WOOD2), x,0.35,z,g);
  const rope=M(0xe8d8b0); for (const [x,z,l,r] of [[0,-D/2,W,0],[0,D/2,W,0],[-W/2,0,D,1],[W/2,0,D,1]]){ const c=mk(G.cyl(0.02,0.02,l,4), rope, x,0.55,z,g); c.rotation.z=Math.PI/2; if (r) c.rotation.y=Math.PI/2; }
  const st=new THREE.Group(); st.position.set(1.3,0,D/2+0.6); g.add(st); mk(G.cyl(0.06,0.06,1.2,6), M(WOOD2), 0,0.6,0,st);
  const s=sign(soon?'Moving in!':'Plot', soon?'#fff0b0':'#fff1d6', '#5b4336', 1.3); s.position.y=1.25; st.add(s);
  if (soon){ const bc=[0xc9a06a,0xb8915a,0xd4ae78]; for (let i=0;i<5;i++){ const b=mk(G.box(0.55,0.42,0.5), M(bc[i%3]), -1.2+(i%3)*0.62, 0.21+(i>2?0.42:0), -0.3+(i>2?0.1:0), g); b.rotation.y=(i-2)*0.15; mk(G.box(0.57,0.04,0.12), M(0xd8c4a0), b.position.x, b.position.y+0.21, b.position.z, g).rotation.y=b.rotation.y; }
    const pl=new THREE.Group(); pl.position.set(0.9,0,-0.6); g.add(pl); mk(G.cyl(0.18,0.14,0.3,10),M(0xd27a4f),0,0.15,0,pl); mk(G.ico(0.24,1),M(0x5fae43),0,0.45,0,pl); }
  else { for (let i=0;i<6;i++){ const t=mk(G.cone(0.06,0.3,5), M(0x6aa84a), -1.5+i*0.6, 0.15, Math.sin(i*2.1)*0.8, g); t.castShadow=false; } }
  g.userData.size={ W, D }; return g;
}

/* ---------- Market stands (specialist shops before you back them). v1.9: turned posts, a peaked striped canopy, bunting ---------- */
function turnedPost(g, x, z, h, c=WOOD2){ const p=new THREE.Group(); p.position.set(x,0,z); g.add(p); const m=M(c);
  mk(G.box(0.18,0.18,0.18), m, 0,0.09,0,p); mk(G.cyl(0.065,0.065,h,8), m, 0,h/2,0,p);
  for (const y of [0.95, h-0.25]) mk(G.sph(0.095,10,8), m, 0,y,0,p); mk(G.sph(0.08,10,8), M(WOODL), 0,h+0.04,0,p); return p; }
export function buildStand(kind, closed){
  const g=new THREE.Group(), bait=kind==='aquarium', col=bait?0x2f8ac0:0x7cb85a, alt=0xfff4e4;
  // counter: plank front, plinth, top with a rounded front edge
  const fr=tbox('board', bait?0x8ac0d4:0xc99a6a, 2.8,0.82,0.9,0.9); fr.position.set(0,0.51,0); g.add(fr);
  mk(G.box(2.9,0.12,0.98), M(WOOD2), 0,0.06,0,g); mk(G.box(3.0,0.1,1.12), M(WOODL), 0,0.97,0.02,g);
  mk(G.cyl(0.06,0.06,3.0,8), M(WOODL), 0,0.95,0.58,g).rotation.z=Math.PI/2;
  for (const x of [-1.38,1.38]) for (const z of [-0.42,0.42]) turnedPost(g, x, z, 2.3);
  // v1.12: a real little roof. Mossy shingles on the Bait Shack, mossy thatch on the Seed Cart.
  const top=2.3; for (const z of [-0.42,0.42]) mk(G.box(2.95,0.12,0.12), M(WOOD2), 0,top,z,g); for (const x of [-1.38,1.38]) mk(G.box(0.12,0.12,0.96), M(WOOD2), x,top,0,g);
  const rise=cottageRoof(g, { style: bait?'mossy':'thatch', pitch: bait?0.62:0.72, L:2.8, S:0.96, y:top+0.06, c: bait?0x3a6aa0:0xd8b070, trim: bait?0xffffff:0x6a4a30, gableMat: tmat('board', bait?0x8ac0d4:0xc99a6a,1,1), moss: bait?0.7:0.55, seed: bait?61:62, over: bait?0.3:0.12, rake:0.18, finial:false });
  const fl=new THREE.Group(); fl.position.set(-1.1,top+rise-0.1,0); g.add(fl); mk(G.cyl(0.02,0.02,0.7,5), M(WOOD2), 0,0.35,0,fl); mk(G.sph(0.045,8,6), M(0xf3c35a), 0,0.72,0,fl);
  const pen=new THREE.Shape(); pen.moveTo(0,0); pen.lineTo(0.4,-0.1); pen.lineTo(0,-0.22); pen.lineTo(0,0); mk(new THREE.ShapeGeometry(pen), M(col,{side:THREE.DoubleSide}), 0.02,0.68,0,fl).castShadow=false;
  hangingVines(g, -1.45, 1.45, top-0.02, 0.5, bait?71:72, bait?null:0xff9ec4);
  bunting(g, -1.38, 1.38, 2.18, 0.47, 0.14);
  // a lantern hanging from the front right post
  const ln=new THREE.Group(); ln.position.set(1.38,1.95,0.42); g.add(ln); mk(G.box(0.04,0.04,0.3), M(0x3a302a), 0,0.12,0.15,ln); mk(G.box(0.15,0.2,0.15), glowMat(0xffd27a), 0,-0.04,0.3,ln); mk(G.cone(0.13,0.1,4), M(0x3a302a), 0,0.11,0.3,ln).rotation.y=Math.PI/4; addGlow(ln,-0.04,2.0);
  if (closed){ const cl=mk(G.box(2.9,0.7,1.1), tmat('board',0xd8c8a8,3,1), 0,1.36,0,g); cl.castShadow=false; for (const x of [-0.9,0.9]) mk(G.tor(0.36,0.03,5,12), M(0x8b6a40), x,1.36,0,g).rotation.y=Math.PI/2; }
  else if (bait){ for (let i=0;i<3;i++){ const b=new THREE.Group(); b.position.set(-0.9+i*0.9,1.0,0); g.add(b); mk(G.cyl(0.24,0.2,0.3,12), M(0x9aa1a8,{metalness:0.4,roughness:0.5}), 0,0.15,0,b); mk(G.cyl(0.22,0.22,0.02,12), M(0x5ac8e0,{transparent:true,opacity:0.8}), 0,0.27,0,b); const f=mk(G.sph(0.07,8,6), M([0xf2894a,0xf0c040,0x4a7ad8][i]), 0.05,0.3,0,b); f.scale.set(1.8,0.8,0.6); } }
  else { for (let i=0;i<4;i++) pot(g, -1.0+i*0.66, 1.0, (i%2)*0.2-0.1, 0.8, [0x5fae43,0x7cc35a][i%2], i%2?[0xff7f7f,0xffd04d][i>1?1:0]:null);
    const jar=mk(G.cyl(0.12,0.12,0.26,10), M(0xd8f0e0,{transparent:true,opacity:0.5,roughness:0.1}), 1.6,1.13,0.3,g); jar.castShadow=false; }
  if (bait){ // rope-wrapped posts, a life ring, hanging floats and a bait barrel
    for (const x of [-1.38,1.38]) for (const y of [0.5,1.5]) mk(G.tor(0.08,0.025,5,10), M(0xd8c8a0), x,y,0.42,g).rotation.x=Math.PI/2;
    const lr=mk(G.tor(0.26,0.07,8,16), M(0xe2483d), 0.95,0.52,0.48,g); for (let k=0;k<4;k++){ const an=k*Math.PI/2+Math.PI/4; mk(G.box(0.1,0.15,0.15), M(0xffffff), 0.95+Math.cos(an)*0.26,0.52+Math.sin(an)*0.26,0.48,g).rotation.z=an; }
    drapedNet(g, -1.46, 2.2, 0, -Math.PI/2, 0.9, 1.1); lobsterTrap(g, -1.9, 0, -0.45, 0.4);
    for (let k=0;k<3;k++){ mk(G.cyl(0.008,0.008,0.3+k*0.12,4), M(0xd8c8a0), 1.5,1.85-(0.15+k*0.06),-0.2+k*0.18,g); mk(G.sph(0.1,10,8), M(k%2?0xffffff:0xe2483d), 1.52,1.7-k*0.12,-0.2+k*0.18,g); }
    barrel1(g, -1.85, 0.35, 0x6a8aa0);
  } else { // wagon wheels and seed sacks
    for (const e of [-1,1]){ const w=new THREE.Group(); w.position.set(e*1.5,0.44,0); w.rotation.y=Math.PI/2; g.add(w); mk(G.tor(0.4,0.05,6,18), M(WOOD2), 0,0,0,w); mk(G.cyl(0.08,0.08,0.14,8), M(WOOD2), 0,0,0,w).rotation.x=Math.PI/2; for (let k=0;k<6;k++){ const sp=mk(G.box(0.04,0.78,0.04), M(WOODL), 0,0,0,w); sp.rotation.z=k*Math.PI/6; } }
    sack(g, 1.95, 0.3, 0xd8c098, 0x7cb85a); sack(g, 1.9, -0.25, 0xc8a878, 0xffd04d); sack(g, -1.95, 0.2, 0xd8c098, 0xff7f7f);
    for (const x of [-1.38,1.38]){ const pv=new THREE.Group(); pv.position.set(x,0,0.5); g.add(pv); ivy(pv, 0, 0.3, 2.0, x>0?81:82, 0xff7f9f); }
    for (let k=0;k<3;k++) pot(g, -1.95, 0, -0.35-k*0.45, 0.75, 0x5fae43, [0xffd04d,null,0xc7a0ff][k]);
  }
  const sg=sign(bait?'Bait Shack':'Seed Cart', bait?'#2f6ab0':'#7cb85a', '#ffffff', 1.6); sg.position.set(0,1.62,0.66); g.add(sg);
  for (const x of [-0.6,0.6]) mk(G.cyl(0.01,0.01,0.46,4), M(0x3a302a), x,2.05,0.6,g);
  mergeStatic(g);
  g.userData.door=[0,1.2]; g.userData.rects=[[-1.5,-0.6,1.5,0.6]]; return g;
}

/* ---------- Pemberton's general store (a real shop you walk into). v1.9: cottage shopfront ---------- */
export function buildStore(tier=0){
  // v1.12: a storybook village shop. Tier 0 thatched, tier 1 mossy shingles with dormers, tiers 2-3 half-timbered with a mossy roof.
  const g=new THREE.Group(), big=tier>=2, W=big?6.6:5.4, D=big?4.8:4.2, F=0.3, H=big?3.0:2.7;
  const wallC=big?0xf6efe0:0xfff1d6, roofC=tier>=3?0x5a7a4a:tier>=1?0x8a5a44:0xd8b070, beam=0x4a3226, trim=big?beam:WOOD2;
  const style = tier===0 ? 'thatch' : 'mossy', pitch = tier===0 ? 0.82 : 0.74, moss = tier===0 ? 0.35 : tier===1 ? 0.6 : 0.75;
  const base=tbox('stone',0xb0aaa0,W+0.3,F+0.6,D+0.3,0.8); base.position.y=(F-0.6)/2; g.add(base);
  const wall=tbox(big?'plaster':'board', wallC, W, H, D, big?1.3:1.0); wall.position.y=F+H/2; g.add(wall);
  const bayX=W/2-1.35;
  if (big){
    const bm=M(beam), holes=[{x:0,y:F+0.95,w:1.2,h:2.2,door:true},{x:-bayX,y:F+1.4,w:1.9,h:1.9},{x:bayX,y:F+1.4,w:1.9,h:1.9}];
    const fr=new THREE.Group(); fr.position.z=D/2; g.add(fr); timberFace(fr, W, F, H, holes, bm);
    for (const e of [-1,1]){ const sd=new THREE.Group(); sd.position.x=e*W/2; sd.rotation.y=e*Math.PI/2; g.add(sd); timberFace(sd, D, F, H, [{x:0,y:F+1.3,w:0.95,h:1.0}], bm); window1(sd, 0, F+1.3, 0.03, { type:'cross', shut:0x6a8a4a, box:true, frame:0xf6efe0 }); }
  } else {
    for (const x of [-W/2,W/2]) for (const z of [-D/2,D/2]) mk(G.box(0.18,H,0.18), M(WOOD2), x,F+H/2,z,g);
    for (const e of [-1,1]){ const sd=new THREE.Group(); sd.position.x=e*(W/2+0.01); sd.rotation.y=e*Math.PI/2; g.add(sd); window1(sd, 0, F+1.3, 0.03, { type:'cross', shut:0x6a8a4a, box:true }); }
  }
  mk(G.box(W+0.12,0.14,D+0.12), M(trim), 0,F+H,0,g);
  const rise=cottageRoof(g, { style, pitch, ridgeZ:true, L:D, S:W, y:F+H, c:roofC, trim: tier===0?0x6a4a30:trim, gableMat:tmat(big?'plaster':'board',wallC,1,1), moss, seed:7+tier, timber:big, beamC:beam });
  // dormers on both roof slopes
  if (tier>=1){ const tp=Math.tan(pitch), dx=W/2*0.48;
    for (const e of [-1,1]) for (const z of (big?[-0.9,0.9]:[0])) dormer(g, e*(dx+0.12), F+H+(W/2-dx)*tp+0.32, z, e*Math.PI/2, { roofC, wallC, wall:big?'plaster':'board', trim, moss:moss*0.8, seed:tier*5+(e>0?1:2)+(z>0?3:0), round: tier>=3 && z<0 }); }
  // shopfront: bay windows full of goods, a round door with roses climbing round it, an awning
  const goods=[0xe2483d,0xf0c040,0x4a7ad8,0x7cb85a];
  for (const e of [-1,1]) bayWindow(g, e*bayX, F, D/2, { w:1.7, h:1.15, d:0.5, roofC, trim:big?beam:0xfff8ea, frame:0xfff8ea, goods, moss:tier>=1, seed:e>0?3:4 });
  door1(g, 0, F, D/2+0.02, { type:'round', color:0x6a8a4a, hood:'none' });
  const rose=new THREE.Group(); rose.position.z=D/2+0.05; g.add(rose); ivy(rose, -0.72, 0.4, 2.0, 31, 0xff7f9f); ivy(rose, 0.72, 0.4, 2.0, 37, 0xff7f9f); hangingVines(rose, -0.6, 0.6, F+2.25, 0.04, 41, 0xff9ec4);
  scallopAwning(g, 0, F+2.45, D/2+0.04, 1.4, 0.6, 0xfff4e4, 0xe8604d);
  const sg=sign(['Corner Shop','General Store','Pemberton\'s','Grand Emporium'][tier]||'Shop', '#fff1d6', '#5b4336', 2.4);
  sg.position.set(0,F+H+0.62,D/2+0.16); g.add(sg);
  const ow=new THREE.Group(); ow.position.set(0,F+H+rise*0.6,D/2+0.06); g.add(ow); window1(ow, 0, 0, 0, { type:'round', size:0.75, frame: big?0xf6efe0:0xffffff });
  const hs=hangingSign(g, W/2+0.02, F+2.05, D/2-0.35, tier>=2?'P':'Shop'); hs.rotation.y=Math.PI/2;
  // ivy up the corners, a mossy chimney, a lamp post, bench, barrels, crates, pots and a flower bed
  for (const e of [-1,1]){ const iv=new THREE.Group(); iv.position.set(e*(W/2+0.02),0,0); iv.rotation.y=e*Math.PI/2; g.add(iv); ivy(iv, e*(D/2-0.4), 0.9, H*0.85, 50+e+tier); }
  const cx = tier>=3 ? W/2-1.0 : -W/2+1.0, ctop=F+H+rise*0.85+0.4; chimney1(g, cx, -D/4-0.4, F+H-0.2, ctop, 'stone', -0.03); mossTop(g, cx, ctop+0.04, -D/4-0.4, 0.5, 0.5, 3+tier, 5);
  const lp=new THREE.Group(); lp.position.set(-W/2-0.9,0,D/2+1.1); g.add(lp); FURN_BUILDERS.lantern(lp);
  const lg=new THREE.Group(); lg.position.set(W/2+0.6,0,-D/2+0.6); g.add(lg); FURN_BUILDERS.logpile(lg);
  for (const e of [-1,1]){ const c=new THREE.Group(); c.position.set(e*(W/2+0.45),0,D/2+0.75); g.add(c); FURN_BUILDERS.crate(c); }
  pot(g, -0.95, 0, D/2+0.5, 1.1, 0x5fae43, 0xff9ec4); pot(g, 0.95, 0, D/2+0.5, 1.1, 0x5fae43, 0xffd04d);
  barrel1(g, W/2+0.45, D/2-0.35, 0x8a5a34); for (let k=0;k<5;k++) mk(G.sph(0.08,8,6), M(0xe2483d), W/2+0.45+Math.cos(k*1.3)*0.12, 0.66, D/2-0.35+Math.sin(k*1.3)*0.12, g);
  sack(g, -W/2-0.45, D/2-0.35, 0xd8c098, 0xffd04d); flowerBed1(g, -W/2+0.9, -D/2-0.35, 1.4, 9+tier);
  if (tier>=1){ for (const e of [-1,1]) wallLantern(g, e*0.85, F+1.75, D/2+0.02); bunting(g, -W/2, W/2, F+H+0.02, D/2+0.35, 0.35); }
  if (tier>=3){ const tw=new THREE.Group(); tw.position.set(-W/2+0.8,0,-D/2+0.8); g.add(tw); const th=H+2.2;
    const tb=tbox('stone',0xc8c0b0,1.4,th,1.4,0.9); tb.position.y=F+th/2; tw.add(tb); mk(G.box(1.52,0.14,1.52), M(beam), 0,F+th,0,tw);
    const cone=mk(G.cone(1.2,2.0,8), tmat('shingle',roofC,4,2.2), 0,F+th+1.0,0,tw); mossTop(tw, 0, F+th+0.35, 0, 1.6, 1.6, 77, 10); mk(G.sph(0.09,8,6), M(0xf3c35a,{metalness:0.5,roughness:0.3}), 0,F+th+2.05,0,tw); mk(G.cone(0.05,0.35,6), M(0xf3c35a,{metalness:0.5,roughness:0.3}), 0,F+th+2.25,0,tw);
    mk(G.cyl(0.4,0.4,0.06,20), M(0xfff8ea), 0,F+H+1.4,0.71,tw).rotation.x=Math.PI/2; mk(G.tor(0.4,0.05,6,20), M(beam), 0,F+H+1.4,0.74,tw);
    for (const a of [0.4,2.1]){ const hnd=mk(G.box(0.04,0.26,0.03), M(0x3a302a), 0,F+H+1.4,0.76,tw); hnd.geometry.translate(0,0.11,0); hnd.rotation.z=-a; }
    const ti=new THREE.Group(); ti.position.set(0,0,0.71); tw.add(ti); ivy(ti, -0.3, 0.8, th*0.7, 81); }
  mergeStatic(g);
  g.userData.door=[0,D/2]; g.userData.rects=[[-W/2-0.1,-D/2-0.1,W/2+0.1,D/2+0.1]]; return g;
}

/* ---------- Town hall: a tent at first, then a hall, then a grand hall with a clock tower ---------- */
export function buildTownHall(tier=0){
  const g=new THREE.Group();
  if (tier===0){ // a big canvas tent with a little desk out front
    const t=mk(new THREE.ConeGeometry(3.0,3.2,8), M(0xf2e6c8), 0,1.6,0,g); t.castShadow=true; t.rotation.y=Math.PI/8;
    for (let i=0;i<8;i++){ const a=i/8*TAU+Math.PI/8; const s=mk(G.box(0.08,3.1,0.04), M(0xe0745a), Math.sin(a)*1.5,1.55,Math.cos(a)*1.5,g); s.lookAt(0,3.2,0); s.rotateX(Math.PI/2); s.castShadow=false; }
    mk(G.box(1.4,1.6,0.1), M(0x6a4a3a), 0,0.8,2.3,g);
    mk(G.cyl(0.04,0.04,1.4,6), M(WOOD2), 0,3.8,0,g); const fl=mk(G.box(0.7,0.42,0.03), M(0x4a7ad8), 0.36,4.25,0,g); fl.castShadow=false;
    const desk=new THREE.Group(); desk.position.set(1.8,0,2.6); g.add(desk); mk(G.box(1.2,0.8,0.6), M(WOOD), 0,0.4,0,desk); mk(G.box(1.3,0.06,0.7), M(WOODL), 0,0.83,0,desk); mk(G.box(0.3,0.04,0.22), M(0xfff8ea), -0.2,0.88,0,desk);
    const sg=sign('Town Tent', '#fff1d6', '#5b4336', 1.6); sg.position.set(-1.9,1.2,2.4); g.add(sg); mk(G.cyl(0.05,0.05,1.2,6), M(WOOD2), -1.9,0.6,2.3,g);
    g.userData.door=[0,2.6]; g.userData.rects=[[-2.4,-2.4,2.4,2.4]]; return g;
  }
  const big=tier>=2, W=big?8.0:6.0, D=big?5.4:4.6, F=0.5, H=big?3.4:2.8, wc=big?0xe8e0d0:0xf6e6c8;
  const base=mk(G.box(W+0.5,F,D+0.5), M(0xb8b0a0), 0,F/2,0,g); base.receiveShadow=true;
  const wall=mk(G.box(W,H,D), M(wc), 0,F+H/2,0,g); wall.castShadow=wall.receiveShadow=true;
  for (const x of [-W/2,W/2]) for (const z of [-D/2,D/2]) mk(G.box(0.2,H,0.2), M(big?0xf4efe4:WOOD2), x,F+H/2,z,g);
  const rg=new THREE.Group(); g.add(rg); gable(rg, W, D, F+H, big?0x5a6a8a:0xb5523b);
  for (const s of [-1,1]) for (const k of (big?[1,2]:[1])){ const x=s*(k*W/6+(big?0:0.6)); win(g, x, F+1.5, D/2+0.02, 0.8, 1.1); }
  for (let st=0; st<2; st++) mk(G.box(2.4-st*0.3,0.2,0.5), M(0xd8d0c0), 0, F-0.1-st*0.2, D/2+0.35+st*0.45, g);
  if (big){ for (let i=0;i<4;i++){ const x=-2.25+i*1.5; mk(G.cyl(0.18,0.2,H,12), M(0xf4efe4), x,F+H/2,D/2+0.9,g); } mk(G.box(W*0.65,0.3,1.4), M(0xf4efe4), 0,F+H+0.1,D/2+0.6,g); }
  mk(G.box(1.3,2.1,0.1), M(0xffffff), 0,F+1.05,D/2+0.02,g); for (const s of [-1,1]) mk(G.box(0.55,1.9,0.08), M(0x2f5a8a), s*0.29,F+0.95,D/2+0.06,g); mk(G.sph(0.05,8,6), M(0xf3c35a,{metalness:0.6,roughness:0.3}), 0.1,F+0.95,D/2+0.12,g);
  const sg=sign(big?'Grand Town Hall':'Town Hall', '#fff1d6', '#5b4336', 2.4); sg.position.set(0,F+H+0.5,D/2+(big?1.35:0.3)); g.add(sg);
  // clock tower on the grand hall, a cupola with a bell on the first hall
  const tw=new THREE.Group(); tw.position.set(0,F+H,-0.2); g.add(tw);
  if (big){ mk(G.box(1.6,3.0,1.6), M(wc), 0,1.5,0,tw); mk(G.cyl(0.55,0.55,0.08,24), M(0xfff8ea), 0,2.2,0.81,tw).rotation.x=Math.PI/2; mk(G.box(0.05,0.4,0.03), M(0x222222), 0,2.32,0.86,tw); mk(G.box(0.3,0.05,0.03), M(0x222222), 0.12,2.2,0.86,tw); mk(G.cone(1.25,1.6,4), M(0x5a6a8a), 0,3.8,0,tw).rotation.y=Math.PI/4; mk(G.sph(0.14,10,8), M(0xf3c35a,{metalness:0.7,roughness:0.3}), 0,4.7,0,tw); }
  else { for (const x of [-0.45,0.45]) for (const z of [-0.45,0.45]) mk(G.cyl(0.06,0.06,1.0,6), M(0xffffff), x,1.3,z,tw); mk(G.cone(0.9,0.9,4), M(0xb5523b), 0,2.2,0,tw).rotation.y=Math.PI/4; mk(G.cone(0.2,0.3,10), M(0xd8a040,{metalness:0.6,roughness:0.3}), 0,1.4,0,tw); }
  // flower boxes and a flag
  for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*(W/2+0.7),0,D/2+0.6); g.add(p); mk(G.box(0.8,0.5,0.8), M(0xd8d0c0), 0,0.25,0,p); for (let k=0;k<4;k++) mk(G.ico(0.12,1), M([0xff7f7f,0xffd04d,0xffffff,0xc7a0ff][k]), -0.2+(k%2)*0.4, 0.58, -0.2+Math.floor(k/2)*0.4, p); }
  const fp=new THREE.Group(); fp.position.set(W/2+1.6,0,D/2+1.4); g.add(fp); mk(G.cyl(0.05,0.06,4.2,8), M(0xd8d8d8,{metalness:0.5,roughness:0.4}), 0,2.1,0,fp); const flag=mk(G.box(1.0,0.6,0.03), M(0x4a7ad8), 0.52,3.8,0,fp); flag.castShadow=false; g.userData.flag=flag;
  const bigD = big ? D/2+1.6 : D/2+0.9;
  g.userData.door=[0, bigD-0.6]; g.userData.rects=[[-W/2-0.25,-D/2-0.25,W/2+0.25,D/2+(big?1.0:0.25)]]; return g;
}

/* ---------- The museum grows: curio cottage, natural history hall, the museum, then the museum with two wings ---------- */
export function buildMuseumTier(tier){
  if (tier===2) return buildMuseum();
  if (tier===3){ const g=buildMuseum(); const stone=0xe8e0d0;
    for (const s of [-1,1]){ const w=new THREE.Group(); w.position.set(s*(9.5/2+1.6),0,0.4); g.add(w); mk(G.box(3.2,0.6,4.6), M(0xc8c0b0), 0,0.3,0,w); mk(G.box(3.0,2.8,4.4), M(stone), 0,0.6+1.4,0,w).castShadow=true; mk(G.box(3.2,0.3,4.6), M(0xf4efe4), 0,3.55,0,w);
      const d=mk(G.sph(1.1,18,10,0,TAU,0,Math.PI/2), M(0x6aa8a0,{metalness:0.3,roughness:0.5}), 0,3.7,0,w); for (const z of [-1,0.6]) win(w, s*-0.01, 2.2, 2.22+z*0, 0.9, 1.1); }
    g.userData.rects.push([-9.5/2-3.3,-1.9,-9.5/2,2.7],[9.5/2,-1.9,9.5/2+3.3,2.7]); return g; }
  const g=new THREE.Group();
  if (tier===0){ const W=3.6, D=3.0, F=0.3, H=2.3;
    mk(G.box(W+0.3,F,D+0.3), M(0xc8c0b0), 0,F/2,0,g); const b=mk(G.box(W,H,D), M(0xf4ede0), 0,F+H/2,0,g); b.castShadow=b.receiveShadow=true;
    const rg=new THREE.Group(); g.add(rg); gable(rg, W, D, F+H, 0x5a7a8a, 0.3, 0.7);
    mk(G.box(1.0,1.8,0.1), M(0x5a3a2a), 0,F+0.9,D/2+0.02,g); win(g, -1.15, F+1.3, D/2+0.02, 0.6, 0.7); win(g, 1.15, F+1.3, D/2+0.02, 0.6, 0.7);
    for (let s=0;s<2;s++) mk(G.box(1.4-s*0.2,0.15,0.4), M(0xd8d0c0), 0, F-0.08-s*0.15, D/2+0.25+s*0.35, g);
    const sg=sign('Museum', '#f4efe4', '#5a4a3a', 1.6); sg.position.set(0,F+H+0.3,D/2+0.15); g.add(sg);
    const p=new THREE.Group(); p.position.set(1.9,0,D/2+0.6); g.add(p); mk(G.cyl(0.05,0.05,1.0,6), M(WOOD2), 0,0.5,0,p); const sm=sign('Curio Cottage', '#fff8ea', '#5a4a3a', 1.1); sm.position.y=1.05; p.add(sm);
    g.userData.door=[0, D/2+0.9]; g.userData.rects=[[-W/2-0.15,-D/2-0.15,W/2+0.15,D/2+0.15]]; return g; }
  // tier 1: a small stone hall with two columns
  const W=6.2, D=4.6, F=0.45, H=2.9;
  mk(G.box(W+0.4,F,D+0.4), M(0xc8c0b0), 0,F/2,0,g); const b=mk(G.box(W,H,D), M(0xece4d4), 0,F+H/2,0,g); b.castShadow=b.receiveShadow=true;
  for (const x of [-1.3,1.3]){ mk(G.cyl(0.2,0.24,H,12), M(0xf4efe4), x,F+H/2,D/2+0.5,g); }
  mk(G.box(3.4,0.3,1.2), M(0xf4efe4), 0,F+H+0.1,D/2+0.3,g);
  const rg=new THREE.Group(); g.add(rg); gable(rg, W, D, F+H, 0x5a7a8a, 0.35, 0.5);
  mk(G.box(1.2,2.1,0.1), M(0x5a3a2a), 0,F+1.05,D/2+0.02,g); for (const s of [-1,1]) win(g, s*2.1, F+1.5, D/2+0.02, 0.8, 1.1);
  for (let s=0;s<2;s++) mk(G.box(2.6-s*0.3,0.18,0.45), M(0xd8d0c0), 0, F-0.09-s*0.18, D/2+0.3+s*0.4, g);
  const sg=sign('Museum', '#f4efe4', '#5a4a3a', 2.0); sg.position.set(0,F+H+0.45,D/2+0.95); g.add(sg);
  g.userData.door=[0, D/2+1.1]; g.userData.rects=[[-W/2-0.2,-D/2-0.2,W/2+0.2,D/2+0.8]]; return g;
}

/* ---------- Crops: vegetables and herbs. stage 0 seedling ... 3 ready to pick ---------- */
export const CROP_LOOK = {
  tomato:{ c:0xe2483d, leaf:0x4f9a3a, kind:'vine' }, carrot:{ c:0xf08a2a, leaf:0x5fae43, kind:'root' }, potato:{ c:0xc8a070, leaf:0x5a9a3a, kind:'bush' },
  pumpkin:{ c:0xf0902a, leaf:0x4f8a3a, kind:'gourd' }, lettuce:{ c:0x9ad86a, leaf:0x7cc35a, kind:'head' }, onion:{ c:0xe8d8b0, leaf:0x6aae4a, kind:'root' },
  basil:{ c:0x4f9a3a, leaf:0x4f9a3a, kind:'herb' }, mint:{ c:0x7cd8a0, leaf:0x6ac890, kind:'herb' }, rosemary:{ c:0x6a8a6a, leaf:0x5a7a5a, kind:'spike' },
  strawberry:{ c:0xe0303a, leaf:0x4f9a3a, kind:'runner' }, blueberry:{ c:0x4a5ab8, leaf:0x5a8a5a, kind:'berrybush' }, raspberry:{ c:0xd8406a, leaf:0x5f9a45, kind:'cane' },
  // v1.39 wheat for the mill, and the trade-route crops
  wheat:{ c:0xe0b860, leaf:0x9ab850, kind:'grain' }, chili:{ c:0xd8302a, leaf:0x4f8a3a, kind:'vine' }, melon:{ c:0x8ac850, leaf:0x4f8a3a, kind:'gourd' }, corn:{ c:0xf0d040, leaf:0x6aa84a, kind:'corn' },
};
export function buildCrop(sp, stage){
  const L=CROP_LOOK[sp]||CROP_LOOK.basil, g=new THREE.Group(), r=mulberry32(sp.length*31+stage), lf=M(L.leaf);
  const mound=mk(G.sph(0.34,12,6,0,TAU,0,Math.PI/2), M(0x7a5a3a), 0,0,0,g); mound.scale.y=0.35; mound.castShadow=false;
  if (stage===0){ for (let i=0;i<2;i++){ const l=mk(G.sph(0.05,6,4), lf, (i-0.5)*0.06, 0.12, 0, g); l.scale.set(1.4,0.4,0.8); } mk(G.cyl(0.01,0.01,0.12,4), lf, 0,0.06,0,g); return g; }
  const s=[0,0.5,0.8,1][stage];
  if (L.kind==='vine'){ mk(G.cyl(0.015,0.015,1.0*s+0.1,4), M(WOOD2), 0.1,(1.0*s+0.1)/2,0,g); for (let i=0;i<5;i++){ const l=mk(G.ico(0.11*s+0.04,0), lf, Math.sin(i*2)*0.12, 0.15+i*0.17*s, Math.cos(i*2)*0.1, g); }
    if (stage===3) for (let i=0;i<4;i++) mk(G.sph(0.07,10,8), M(L.c), Math.sin(i*2.5)*0.15, 0.3+i*0.16, Math.cos(i*2.5)*0.14+0.05, g); }
  else if (L.kind==='root'){ for (let i=0;i<5;i++){ const b=mk(G.cone(0.03,0.35*s+0.1,4), lf, Math.cos(i*1.3)*0.05, (0.35*s+0.1)/2+0.05, Math.sin(i*1.3)*0.05, g); b.rotation.set(Math.cos(i)*0.3,0,Math.sin(i)*0.3); }
    if (stage===3){ const top=mk(sp==='onion'?G.sph(0.09,10,8):G.cone(0.07,0.16,8), M(L.c), 0,0.06,0,g); if (sp!=='onion') top.rotation.x=Math.PI; } }
  else if (L.kind==='bush'){ for (let i=0;i<6;i++) mk(G.ico(0.1*s+0.05,0), lf, Math.cos(i)*0.14*s, 0.12+(i%3)*0.08*s, Math.sin(i)*0.14*s, g); if (stage===3) for (let i=0;i<3;i++) mk(G.ico(0.04,1), M(0xffffff), Math.cos(i*2)*0.15, 0.32, Math.sin(i*2)*0.15, g); }
  else if (L.kind==='gourd'){ for (let i=0;i<4;i++){ const l=mk(G.cyl(0.14*s+0.04,0.14*s+0.04,0.02,8), lf, Math.cos(i*1.6)*0.25*s, 0.1, Math.sin(i*1.6)*0.25*s, g); l.rotation.x=0.2; }
    if (stage>=2){ const p=mk(G.sph(stage===3?0.24:0.12,14,10), M(stage===3?L.c:0x9ac04a), 0.05,stage===3?0.2:0.12,0.05,g); p.scale.y=0.75; mk(G.cyl(0.02,0.03,0.08,5), M(WOOD2), 0.05,stage===3?0.4:0.22,0.05,g); } }
  else if (L.kind==='head'){ for (let i=0;i<7;i++){ const l=mk(G.sph(0.12*s+0.04,8,6), M(i<3?L.c:L.leaf), Math.cos(i*0.9)*0.06*s, 0.1+(i<3?0.06:0), Math.sin(i*0.9)*0.06*s, g); l.scale.set(1,0.7,1); } }
  else if (L.kind==='runner'){ for (let i=0;i<6;i++){ const a=i/6*TAU+r()*0.4, l=mk(G.sph(0.08*s+0.04,8,6), lf, Math.cos(a)*0.13*s, 0.1+0.04*s, Math.sin(a)*0.13*s, g); l.scale.set(1.3,0.45,1.1); l.rotation.y=-a; }
    if (stage>=2) for (let i=0;i<5;i++){ const a=i*1.3+0.4; mk(G.sph(0.025,6,4), M(0xffffff), Math.cos(a)*0.2, 0.18, Math.sin(a)*0.2, g); }
    if (stage===3) for (let i=0;i<5;i++){ const a=i*1.26+0.2, b=mk(G.cone(0.055,0.11,8), M(L.c), Math.cos(a)*0.24, 0.07, Math.sin(a)*0.24, g); b.rotation.x=Math.PI; } }
  else if (L.kind==='berrybush'){ for (let i=0;i<7;i++) mk(G.ico(0.1*s+0.05,1), lf, Math.cos(i*0.9)*0.15*s, 0.16+(i%3)*0.11*s, Math.sin(i*0.9)*0.15*s, g);
    if (stage===3) for (let i=0;i<12;i++){ const a=i*2.4, h=0.18+(i%4)*0.07; mk(G.sph(0.035,8,6), M(i%5?L.c:0x8a9ae0), Math.cos(a)*0.2, h, Math.sin(a)*0.2, g); } }
  else if (L.kind==='cane'){ for (let i=0;i<4;i++){ const c=mk(G.cyl(0.012,0.018,0.7*s+0.1,4), M(0x8a5a4a), Math.cos(i*1.6)*0.06, (0.7*s+0.1)/2, Math.sin(i*1.6)*0.06, g); c.rotation.set(Math.cos(i)*0.2,0,Math.sin(i)*0.2);
      for (let k=0;k<3;k++){ const l=mk(G.sph(0.06*s+0.03,8,6), lf, c.position.x+Math.cos(i*1.6+k)*0.07, 0.15+k*0.22*s, c.position.z+Math.sin(i*1.6+k)*0.07, g); l.scale.set(1.3,0.5,1); } }
    if (stage===3) for (let i=0;i<9;i++){ const a=i*2.1; mk(G.ico(0.04,1), M(L.c), Math.cos(a)*0.14, 0.2+(i%3)*0.16, Math.sin(a)*0.14, g); } }
  else if (L.kind==='grain'){ const gold=stage===3?M(L.c):lf; for (let i=0;i<9;i++){ const a=i*2.4, d=0.05+(i%3)*0.06, h=0.6*s+0.15, b=mk(G.cyl(0.008,0.012,h,3), stage===3?M(0xd8b060):lf, Math.cos(a)*d, h/2, Math.sin(a)*d, g); b.rotation.set(Math.cos(a)*0.12,0,Math.sin(a)*0.12);
      if (stage>=2){ const ear=mk(G.cap(0.022,0.1,3,6), gold, Math.cos(a)*d*1.2, h+0.04, Math.sin(a)*d*1.2, g); ear.rotation.set(Math.cos(a)*0.25,0,Math.sin(a)*0.25); } } }
  else if (L.kind==='corn'){ for (let i=0;i<3;i++){ const h=0.9*s+0.15, x=(i-1)*0.1; mk(G.cyl(0.02,0.03,h,5), lf, x,h/2,(i%2)*0.06,g); for (let k=0;k<3;k++){ const l=mk(G.box(0.04,0.4*s+0.1,0.01), lf, x+(k%2?0.08:-0.08), h*(0.3+k*0.22), (i%2)*0.06, g); l.rotation.z=(k%2?-0.7:0.7); }
      if (stage===3){ const cob=mk(G.cap(0.04,0.14,4,8), M(L.c), x+0.05, h*0.55, (i%2)*0.06+0.04, g); cob.rotation.z=-0.3; } } }
  else if (L.kind==='spike'){ for (let i=0;i<7;i++){ const b=mk(G.cyl(0.012,0.018,0.45*s+0.1,4), lf, Math.cos(i*0.9)*0.08, (0.45*s+0.1)/2+0.04, Math.sin(i*0.9)*0.08, g); b.rotation.set(Math.cos(i)*0.25,0,Math.sin(i)*0.25); } }
  else { for (let i=0;i<8;i++){ const l=mk(G.sph(0.06*s+0.03,8,6), lf, Math.cos(i*0.8)*0.1*s, 0.08+i*0.035*s, Math.sin(i*0.8)*0.1*s, g); l.scale.set(1.3,0.5,1); } }
  return g;
}

/* ---------- Vegetables, herbs and dishes in the bag ---------- */
const veg = (sp, fn) => g => { const L=CROP_LOOK[sp]; fn(g, M(L.c), M(L.leaf)); };
Object.assign(FURN_BUILDERS, {
  v_tomato: veg('tomato', (g,c,l)=>{ mk(G.sph(0.22,14,10), c, 0,0.2,0,g).scale.y=0.85; for (let i=0;i<5;i++){ const s=mk(G.cone(0.03,0.12,4), l, Math.cos(i*1.26)*0.06,0.38,Math.sin(i*1.26)*0.06,g); s.rotation.set(Math.sin(i*1.26)*1.2,0,-Math.cos(i*1.26)*1.2); } }),
  v_carrot: veg('carrot', (g,c,l)=>{ const b=mk(G.cone(0.1,0.55,10), c, 0,0.12,0,g); b.rotation.z=Math.PI/2+0.2; for (let i=0;i<4;i++){ const s=mk(G.cone(0.03,0.25,4), l, 0.32,0.2+i*0.02,(i-1.5)*0.05,g); s.rotation.z=-0.9; } }),
  v_potato: veg('potato', (g,c)=>{ const p=mk(G.sph(0.2,10,8), c, 0,0.16,0,g); p.scale.set(1.3,0.8,1); for (let i=0;i<4;i++) mk(G.sph(0.015,4,4), M(0x8a6a4a), Math.cos(i*1.6)*0.2,0.22,Math.sin(i*1.6)*0.13,g); }),
  v_pumpkin: veg('pumpkin', (g,c)=>{ for (let i=0;i<6;i++){ const s=mk(G.sph(0.2,10,8), c, Math.cos(i/6*TAU)*0.1,0.2,Math.sin(i/6*TAU)*0.1,g); s.scale.set(0.7,0.85,0.7); } mk(G.cyl(0.03,0.04,0.12,6), M(WOOD2), 0,0.42,0,g); }),
  v_lettuce: veg('lettuce', (g,c,l)=>{ for (let i=0;i<9;i++){ const s=mk(G.sph(0.14,8,6), i<4?c:l, Math.cos(i*0.8)*0.08,0.14+(i<4?0.05:0),Math.sin(i*0.8)*0.08,g); s.scale.set(1,0.7,1); } }),
  v_onion: veg('onion', (g,c,l)=>{ mk(G.sph(0.18,12,10), c, 0,0.18,0,g); const t=mk(G.cone(0.05,0.18,6), M(0xc8a878), 0,0.4,0,g); for (let i=0;i<3;i++) mk(G.cyl(0.005,0.005,0.08,3), M(0xe8d8c0), (i-1)*0.03,0.02,0,g); }),
  v_basil: veg('basil', (g,c,l)=>{ mk(G.cyl(0.015,0.015,0.35,4), M(0x5a8a3a), 0,0.17,0,g); for (let i=0;i<6;i++){ const s=mk(G.sph(0.08,8,6), l, Math.cos(i*1.05)*0.08,0.12+i*0.04,Math.sin(i*1.05)*0.08,g); s.scale.set(1.3,0.4,0.9); } }),
  v_mint: veg('mint', (g,c,l)=>{ mk(G.cyl(0.015,0.015,0.35,4), M(0x5a9a6a), 0,0.17,0,g); for (let i=0;i<6;i++){ const s=mk(G.sph(0.07,8,6), l, Math.cos(i*1.05)*0.07,0.12+i*0.04,Math.sin(i*1.05)*0.07,g); s.scale.set(1.2,0.4,1.0); } }),
  v_rosemary: veg('rosemary', (g,c,l)=>{ for (let i=0;i<3;i++){ const b=mk(G.cyl(0.012,0.012,0.5,4), M(0x7a6a4a), (i-1)*0.05,0.25,0,g); b.rotation.z=(i-1)*0.2; for (let k=0;k<6;k++) mk(G.box(0.08,0.01,0.015), l, b.position.x+Math.sin(b.rotation.z)*(-0.2+k*0.08), 0.06+k*0.07, 0, g); } }),
  v_strawberry: veg('strawberry', (g,c,l)=>{ for (let i=0;i<3;i++){ const b=mk(G.cone(0.13,0.24,10), c, (i-1)*0.17,0.13,(i%2)*0.08,g); b.rotation.x=Math.PI; for (let k=0;k<4;k++){ const s=mk(G.cone(0.03,0.08,4), l, b.position.x+Math.cos(k*1.57)*0.05,0.26,b.position.z+Math.sin(k*1.57)*0.05,g); s.rotation.set(Math.sin(k*1.57)*1.3,0,-Math.cos(k*1.57)*1.3); } } }),
  v_blueberry: veg('blueberry', (g,c)=>{ for (let i=0;i<9;i++){ const a=i*2.4, d=i?0.1+(i%3)*0.05:0; mk(G.sph(0.08,10,8), c, Math.cos(a)*d,0.08+(i>5?0.1:0),Math.sin(a)*d,g); } }),
  v_raspberry: veg('raspberry', (g,c)=>{ for (let i=0;i<3;i++){ const x=(i-1)*0.18; for (let k=0;k<10;k++){ const a=k*2.4, h=k/10; mk(G.sph(0.04,6,5), c, x+Math.cos(a)*0.07*(1-h*0.4),0.08+h*0.18,Math.sin(a)*0.07*(1-h*0.4),g); } } }),
  v_wheat: veg('wheat', (g,c)=>{ for (let i=0;i<7;i++){ const x=(i-3)*0.04; const st=mk(G.cyl(0.008,0.008,0.6,3), M(0xd8b060), x,0.3,0,g); st.rotation.z=(i-3)*0.06; const e=mk(G.cap(0.025,0.12,3,6), c, x+(i-3)*0.02,0.62,0,g); e.rotation.z=(i-3)*0.06; } mk(G.tor(0.06,0.015,4,10), M(0xa8754a), 0,0.25,0,g).rotation.x=Math.PI/2; }),
  v_chili: veg('chili', (g,c,l)=>{ for (let i=0;i<3;i++){ const p=mk(G.cone(0.05,0.3,8), c, (i-1)*0.1,0.14,0,g); p.rotation.z=Math.PI+(i-1)*0.3; mk(G.cyl(0.012,0.012,0.06,4), l, (i-1)*0.1-(i-1)*0.04,0.31,0,g); } }),
  v_melon: veg('melon', (g,c)=>{ const m=mk(G.sph(0.26,16,12), c, 0,0.24,0,g); m.scale.set(1.2,0.9,1); for (let i=0;i<5;i++){ const st=mk(G.tor(0.262,0.012,4,24), M(0x4f7a30), 0,0.24,0,g); st.rotation.y=i/5*Math.PI; st.scale.set(1.2,0.9,1); } }),
  v_corn: veg('corn', (g,c,l)=>{ const cob=mk(G.cap(0.08,0.32,4,10), c, 0,0.12,0,g); cob.rotation.z=Math.PI/2; for (const s2 of [-1,1]){ const h=mk(G.box(0.4,0.02,0.14), l, -0.05,0.14,s2*0.07,g); h.rotation.x=s2*0.5; } }),
  seedbin(g){ mk(G.box(0.9,0.55,0.6), M(WOOD), 0,0.28,0,g); mk(G.box(0.96,0.06,0.66), M(WOOD2), 0,0.57,0,g); const cs=[0xe0303a,0xf08a2a,0x9ad86a,0xc8a070,0x4a5ab8,0x7cd8a0];
    for (let i=0;i<6;i++){ const x=-0.3+(i%3)*0.3, z=i<3?-0.14:0.14; mk(G.box(0.26,0.04,0.24), M(0xe8d8b0), x,0.6,z,g); mk(G.box(0.12,0.16,0.02), M(cs[i]), x,0.7,z+0.08,g); for (let k=0;k<5;k++) mk(G.sph(0.025,5,4), M(0x8a6a4a), x+Math.cos(k*1.3)*0.06,0.63,z-0.02+Math.sin(k*1.3)*0.05,g); } },
  seedtable(g){ mk(G.box(2.4,0.06,1.4), M(WOODL), 0,0.6,0,g); for (const x of [-1.1,1.1]) for (const z of [-0.6,0.6]) mk(G.box(0.08,0.6,0.08), M(WOOD2), x,0.3,z,g); mk(G.box(2.2,0.04,1.2), M(0x6a8a4a), 0,0.64,0,g); },
  sled(g){ const run=M(0xd8604a), wd=M(WOOD); for (const s of [-0.28,0.28]){ mk(G.box(0.06,0.06,1.3), run, s,0.05,0,g); const c=mk(G.tor(0.12,0.03,6,10,Math.PI), run, s,0.17,0.65,g); c.rotation.y=Math.PI/2; c.rotation.z=-Math.PI/2; for (const z of [-0.4,0.3]) mk(G.box(0.04,0.16,0.04), M(WOOD2), s,0.14,z,g); }
    for (let i=0;i<5;i++) mk(G.box(0.7,0.05,0.2), wd, 0,0.24,-0.5+i*0.22,g); const rope=mk(G.tor(0.18,0.015,4,12,Math.PI), M(0xe8d8b0), 0,0.28,0.72,g); rope.rotation.x=-Math.PI/2; },
});
// A plate or bowl with food on it
const DISH_LOOK = {
  tomato_soup:{ bowl:true, c:0xd8402a }, veg_stew:{ bowl:true, c:0xb06a30, bits:[0xf08a2a,0xe8d8b0,0xc8a070] }, pumpkin_soup:{ bowl:true, c:0xf0a040 }, mint_tea:{ cup:true, c:0x9ad8a0 },
  baked_potato:{ c:0xc8a070, big:0xd8b080 }, grilled_fish:{ fish:true }, fish_chips:{ fish:true, bits:[0xf0c860,0xf0c860,0xf0c860] }, garden_salad:{ c:0x8ac860, bits:[0xe2483d,0xf08a2a,0xe2483d] },
  roast_carrots:{ c:0xf08a2a, bits:[0xf08a2a,0xf08a2a,0x5a7a5a] }, fruit_tart:{ tart:true, c:0xe2483d }, berry_tart:{ tart:true, c:0x4a5ab8 }, berry_jam:{ cup:true, c:0xb8203a }, coconut_curry:{ bowl:true, c:0xe8c050, bits:[0xf08a2a,0xffffff] }, herb_bread:{ bread:true },
};
for (const [id,d] of Object.entries(DISH_LOOK)) FURN_BUILDERS['d_'+id]=g=>{
  const plate=M(0xfaf6ee), food=M(d.c||0xc8a070);
  if (d.cup){ mk(G.cyl(0.18,0.14,0.26,14), plate, 0,0.17,0,g); mk(G.cyl(0.16,0.16,0.02,14), food, 0,0.29,0,g); const h=mk(G.tor(0.07,0.025,6,10), plate, 0.2,0.17,0,g); h.rotation.y=Math.PI/2; mk(G.cyl(0.26,0.26,0.03,16), plate, 0,0.02,0,g); return; }
  if (d.bowl){ const b=mk(G.sph(0.28,16,10,0,TAU,Math.PI/2,Math.PI/2), plate, 0,0.28,0,g); b.material=plate; mk(G.cyl(0.26,0.26,0.03,16), food, 0,0.26,0,g); (d.bits||[]).forEach((c,i)=>mk(G.ico(0.045,0), M(c), Math.cos(i*2.1)*0.12,0.28,Math.sin(i*2.1)*0.12,g)); mk(G.sph(0.03,6,4), M(0x4f9a3a), 0.05,0.29,-0.05,g); return; }
  mk(G.cyl(0.34,0.3,0.05,18), plate, 0,0.03,0,g);
  if (d.fish){ const f=mk(G.sph(0.16,12,8), M(0xc8884a), -0.03,0.12,0,g); f.scale.set(1.6,0.6,0.7); const t=mk(G.cone(0.1,0.14,4), M(0xb87838), -0.3,0.12,0,g); t.rotation.z=Math.PI/2; for (let i=0;i<3;i++) mk(G.box(0.02,0.01,0.14), M(0x6a3a1a), -0.1+i*0.08,0.19,0,g); }
  if (d.tart){ mk(G.cyl(0.26,0.22,0.1,16), M(0xd8a860), 0,0.1,0,g); for (let i=0;i<7;i++) mk(G.sph(0.05,8,6), food, Math.cos(i*0.9)*0.14,0.16,Math.sin(i*0.9)*0.14,g); }
  if (d.bread){ const b=mk(G.cap(0.12,0.3,4,10), M(0xc88a4a), 0,0.14,0,g); b.rotation.z=Math.PI/2; for (let i=0;i<3;i++) mk(G.box(0.02,0.01,0.16), M(0xe8c080), -0.1+i*0.1,0.25,0,g); mk(G.sph(0.03,6,4), M(0x4f9a3a), 0.05,0.26,0.05,g); }
  if (d.big){ const p=mk(G.sph(0.17,10,8), M(d.big), 0,0.14,0,g); p.scale.set(1.3,0.8,1); mk(G.box(0.12,0.04,0.08), M(0xfff0b0), 0,0.27,0,g); }
  if (!d.fish && !d.tart && !d.bread && !d.big){ for (let i=0;i<8;i++) mk(G.sph(0.07,8,6), food, Math.cos(i*0.8)*0.14,0.1,Math.sin(i*0.8)*0.14,g); }
  (d.bits||[]).forEach((c,i)=>{ if (!d.bowl) mk(G.ico(0.05,0), M(c), Math.cos(i*2.1+0.4)*0.12,0.15,Math.sin(i*2.1+0.4)*0.12,g); });
};

/* ---------- Stairs inside the house (up or down) ---------- */
export function buildStairs(down){
  const g=new THREE.Group(), w=1.4, steps=7;
  if (!down){ for (let i=0;i<steps;i++){ const s=mk(G.box(w,0.2,0.32), M(i%2?WOODL:WOOD), 0, 0.1+i*0.38, 0.95-i*0.32, g); s.scale.y=1+i*1.9; s.position.y=(0.2*(1+i*1.9))/2; }
    for (const x of [-w/2,w/2]){ const rail=mk(G.box(0.06,0.06,2.5), M(WOOD2), x,1.85,-0.05,g); rail.rotation.x=0.86; for (let i=0;i<4;i++) mk(G.cyl(0.03,0.03,0.9,6), M(WOOD2), x, 0.45+i*0.65, 0.8-i*0.55, g); } }
  else { const hole=mk(G.box(w+0.2,0.04,2.4), M(0x2a2420), 0,0.02,0,g); hole.castShadow=false; for (let i=0;i<4;i++) mk(G.box(w,0.06,0.3), M(WOOD), 0,0.03-0.0,-0.9+i*0.6,g).position.y=0.04;
    for (const x of [-w/2-0.1,w/2+0.1]){ mk(G.box(0.06,0.06,2.4), M(WOOD2), x,0.9,0,g); for (let i=0;i<4;i++) mk(G.cyl(0.03,0.03,0.9,6), M(WOOD2), x,0.45,-1.0+i*0.66,g); } }
  return g;
}
