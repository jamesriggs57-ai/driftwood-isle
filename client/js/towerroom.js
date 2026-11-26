/* =====================================================================
   v1.46 the inside of Wendell's tower. It's roomier in here than it looks from outside.

   Ground floor, the workroom: Wendell at his bubbling cauldron, curved bookshelves with a rolling ladder, a star chart,
   floating candles, a workbench and lectern where he teaches enchanting, a scrying bowl that shows the island (moving
   buildings and shaping land start from here), his owl on its perch, an armchair, and a stair up the wall.
   Upstairs, the observatory: a big brass telescope, an orrery that turns, a star globe, tall windows onto the sky, and a
   little cushion waiting for a Starglass Shard (it glows there once Starfall Isle is up).

   Like the town hall, main.js builds the rooms (makeTowerRooms) and puts the people and the tap spots in. This file is
   only the models, the drawings (star chart, eyepiece view) and the words.
   Local room coordinates: angle a points along (sin a, cos a), so a=0 is +z, the side with the door.
   ===================================================================== */
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { M, mk, G, addGlow } from './models.js';

export const TOWER_R = 6.0, TOP_R = 5.2, WALL_H = 3.6;
const deg = d => d*Math.PI/180;
const polar = (a, r) => [Math.sin(a)*r, Math.cos(a)*r];
const canvas = (w,h) => { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
const texOf = (cv, rep) => { const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; if (rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const basic = c => new THREE.MeshBasicMaterial({ color:c });
const noShadow = m => { m.castShadow=false; m.receiveShadow=false; return m; };
// indoor glows stay lit day and night (main.js updateSky leaves 'event' sprites alone)
const glow = (parent, y, s, c, o=0.55) => { const sp=addGlow(parent, y, s, c); sp.userData.event=true; sp.material.opacity=o; return sp; };
// window glass shows the sky outside: main.js sets it light by day and deep blue at night
export const towerGlass = new THREE.MeshBasicMaterial({ color:0xcfe8f8 });
export function setTowerNight(night){ towerGlass.color.setHex(night ? 0x2a2c66 : 0xcfe8f8); }

/* a thick ring wall piece from angle a0 to a1, between radii r0 and r1, from y0 up to y1 */
function sector(a0, a1, r0, r1, y0, y1, mat, parent){
  const sh=new THREE.Shape(), n=Math.max(3, Math.ceil((a1-a0)/deg(5)));
  for (let i=0;i<=n;i++){ const a=a0+(a1-a0)*i/n, x=Math.sin(a)*r1, y=-Math.cos(a)*r1; i ? sh.lineTo(x,y) : sh.moveTo(x,y); }
  for (let i=n;i>=0;i--){ const a=a0+(a1-a0)*i/n; sh.lineTo(Math.sin(a)*r0, -Math.cos(a)*r0); }
  const geo=new THREE.ExtrudeGeometry(sh, { depth:y1-y0, bevelEnabled:false, curveSegments:1 }); geo.rotateX(-Math.PI/2); geo.translate(0,y0,0);
  return mk(geo, mat, 0,0,0, parent);
}
/* a group stood against the wall at angle a, facing into the room, its back r from the middle */
function onWall(parent, a, r, y=0){ const g=new THREE.Group(); const [x,z]=polar(a, r); g.position.set(x,y,z); g.rotation.y=a+Math.PI; parent.add(g); return g; }

/* the round walls, in segments that drop when the camera looks through them (main.js updateCutaway reads cutWalls) */
function ringWalls(g, R, H, opt){
  const stone=M(opt.stone), paint=M(opt.paint), wood=M(0x7a5236), trim=M(0x5a3e2a), cut=[], segs=opt.segs||18, step=TAU/segs;
  for (let i=0;i<segs;i++){
    const a0=-step/2+i*step, a1=a0+step, mid=(a0+a1)/2, sg=new THREE.Group(); g.add(sg); const hide=[];
    if (i===0 && opt.door){   // the doorway: stone either side, an arch over the top
      const gap=opt.door/R/2;
      for (const [b0,b1] of [[a0,-gap],[gap,a1]]){ sector(b0,b1,R-0.1,R+0.15,0,H,stone,sg); sector(b0,b1,R-0.16,R-0.1,0,H-0.05,paint,sg); sector(b0,b1,R-0.2,R-0.16,0,1.0,wood,sg); }
      const top=new THREE.Group(); g.add(top); hide.push(top);
      sector(-gap,gap,R-0.1,R+0.15,2.05,H,stone,top);
      const leaf=mk(G.box(opt.door-0.1,2.0,0.08), M(0x6a4630), 0,1.0,R+0.05, sg); for (const y of [0.45,1.55]) mk(G.box(opt.door-0.1,0.1,0.04), M(0x3a3a44), 0,y,R, sg); mk(G.sph(0.06,8,6), M(0xc8a040), 0.55,1.0,R-0.02, sg); leaf.castShadow=false;
      const arch=mk(new THREE.TorusGeometry(opt.door/2, 0.12, 6, 16, Math.PI), trim, 0,2.0,R-0.12, top); arch.castShadow=false;
      for (const s of [-1,1]) mk(G.box(0.2,2.0,0.3), trim, s*opt.door/2,1.0,R-0.12, top).castShadow=false;
    } else {
      sector(a0,a1,R-0.1,R+0.15,0,H,stone,sg); sector(a0,a1,R-0.16,R-0.1,0,H-0.05,paint,sg);
      sector(a0,a1,R-0.2,R-0.16,0,1.0,wood,sg); sector(a0,a1,R-0.22,R-0.16,0.98,1.06,trim,sg);   // wainscot and its rail
      if (opt.stars){ const r=mulberry32(i*977+5); for (let k=0;k<3;k++){ const a=a0+step*(0.2+r()*0.6), y=1.5+r()*1.7; const s=mk(G.box(0.09,0.09,0.01), basic(0xe8c868), 0,0,0); s.rotation.z=Math.PI/4;
        const p=onWall(sg, a, R-0.175, y); p.add(s); noShadow(s); } }
    }
    sector(a0,a1,R-0.2,R+0.2,H,H+0.12,trim,sg);   // the top course
    sg.children.forEach(noShadow);
    cut.push({ meshes:[sg], hide, nx:Math.sin(mid), nz:Math.cos(mid), a0, a1 });
  }
  return cut;
}
// which wall segment holds angle a: deco on that wall goes in its 'hide' list so it vanishes with the wall
const segOf = (cut, a) => { const w=((a%TAU)+TAU)%TAU; return cut.find(c=>{ const x0=((c.a0%TAU)+TAU)%TAU, x1=x0+(c.a1-c.a0); return (w>=x0 && w<x1) || (w+TAU>=x0 && w+TAU<x1); }); };
const hang = (cut, obj, a) => { const s=segOf(cut, a); if (s) s.hide.push(obj); return obj; };

function floorDisc(g, R, draw, y=0){
  const cv=canvas(512,512), x=cv.getContext('2d'); draw(x, 512);
  const f=mk(new THREE.CylinderGeometry(R+0.2,R+0.2,0.1,48), [new THREE.MeshStandardMaterial({ color:0x6a5a4a, roughness:0.9 }), new THREE.MeshStandardMaterial({ map:texOf(cv), roughness:0.85 }), new THREE.MeshStandardMaterial({ color:0x6a5a4a })], 0,y-0.05,0,g);
  f.castShadow=false; return f; }

/* ---------- ground floor pieces ---------- */
function cauldron(){
  const g=new THREE.Group(), iron=M(0x2e2c34,{ roughness:0.5, metalness:0.4 });
  // a ring of hearth stones and embers under the pot
  const r=mulberry32(77); for (let i=0;i<11;i++){ const a=i/11*TAU; const s=mk(G.dod(0.2+r()*0.06), M([0x8a8478,0x7a746a,0x9a9488][i%3]), Math.sin(a)*1.0,0.12,Math.cos(a)*1.0,g); s.scale.y=0.7; s.rotation.y=r()*3; }
  for (let i=0;i<6;i++){ const a=i/6*TAU+0.3; noShadow(mk(G.dod(0.12), basic(0xff7a30), Math.sin(a)*0.35,0.08,Math.cos(a)*0.35,g)); }
  glow(g, 0.2, 1.8, 0xff9a40, 0.7);
  mk(new THREE.SphereGeometry(0.78,24,16,0,TAU,Math.PI*0.28,Math.PI*0.72), new THREE.MeshStandardMaterial({ color:0x2e2c34, roughness:0.5, metalness:0.4, side:THREE.DoubleSide }), 0,0.86,0,g);
  const rim=mk(G.tor(0.68,0.07,8,28), iron, 0,1.35,0,g); rim.rotation.x=Math.PI/2;
  for (let i=0;i<3;i++){ const a=i/3*TAU+0.5, l=mk(G.cyl(0.06,0.04,0.4,6), iron, Math.sin(a)*0.55,0.2,Math.cos(a)*0.55,g); l.rotation.z=0.2*Math.sin(a); l.rotation.x=-0.2*Math.cos(a); }
  for (const s of [-1,1]){ const h=mk(G.tor(0.14,0.03,6,12), iron, s*0.78,1.25,0,g); h.rotation.y=Math.PI/2; }
  const brew=new THREE.MeshBasicMaterial({ color:0x6ee8b0 }), top=noShadow(mk(G.cyl(0.66,0.66,0.04,28), brew, 0,1.24,0,g));
  // the ladle: a long wooden spoon leaning on the rim
  const sp=new THREE.Group(); sp.position.set(0.25,1.3,-0.2); sp.rotation.set(0.5,0,-0.55); g.add(sp); mk(G.cyl(0.03,0.03,1.3,6), M(0x8a6040), 0,0.5,0,sp); mk(G.sph(0.1,8,6), M(0x8a6040), 0,-0.12,0,sp).scale.set(1,0.5,1);
  const bubbles=[]; for (let i=0;i<9;i++){ const b=noShadow(mk(G.sph(0.06+Math.random()*0.05,8,6), new THREE.MeshBasicMaterial({ color:0xa8ffd8, transparent:true, opacity:0.85 }), 0,1.25,0,g)); b.userData.t=Math.random(); bubbles.push(b); }
  const steam=[]; for (let i=0;i<5;i++){ const s=noShadow(mk(G.sph(0.22,8,6), new THREE.MeshBasicMaterial({ color:0xe8fff4, transparent:true, opacity:0.0, depthWrite:false }), 0,1.5,0,g)); s.userData.t=i/5; steam.push(s); }
  const light=new THREE.PointLight(0x7af0c0, 10, 7, 1.6); light.position.set(0,1.9,0); g.add(light);
  g.userData={ brew, top, bubbles, steam, light };
  return g; }
function tickCauldron(c, t, dt){ const u=c.userData; const hue=0.42+Math.sin(t*0.25)*0.12;   // the brew drifts between mint, teal and violet
  u.brew.color.setHSL(hue<0.36?0.78:hue, 0.9, 0.42); u.light.color.copy(u.brew.color); u.light.intensity=9+Math.sin(t*3.1)*1.5; u.top.position.y=1.24+Math.sin(t*2.3)*0.012;
  for (const b of u.bubbles){ b.userData.t+=dt*0.7; if (b.userData.t>1){ b.userData.t=0; const a=Math.random()*TAU, d=Math.random()*0.5; b.userData.x=Math.sin(a)*d; b.userData.z=Math.cos(a)*d; }
    const k=b.userData.t; b.position.set(b.userData.x||0, 1.24+k*0.18, b.userData.z||0); b.scale.setScalar(k<0.85?0.4+k:Math.max(0.01,(1-k)*8)); b.material.color.copy(u.brew.color).offsetHSL(0,0,0.2); }
  for (const s of u.steam){ s.userData.t+=dt*0.22; if (s.userData.t>1) s.userData.t-=1; const k=s.userData.t; s.position.set(Math.sin(t*0.7+k*6)*0.25, 1.45+k*1.6, Math.cos(t*0.5+k*5)*0.2); s.scale.setScalar(0.6+k*1.6); s.material.opacity=0.32*Math.sin(k*Math.PI); } }

const BOOK_C=[0x8a3a3a,0x3a5a8a,0x4a7a4a,0x8a6a3a,0x5a3a6a,0x2a6a6a,0xb08a3a,0x6a2a4a];
function shelfUnit(seed, w=1.3, h=3.0){
  const g=new THREE.Group(), r=mulberry32(seed), wood=M(0x6a4630), d=0.42;
  mk(G.box(w,h,0.05), M(0x4e3424), 0,h/2,-d/2+0.03,g); for (const s of [-1,1]) mk(G.box(0.07,h,d), wood, s*(w/2-0.035),h/2,0,g);
  const rows=5; for (let k=0;k<=rows;k++) mk(G.box(w,0.06,d), wood, 0,0.08+k*(h-0.16)/rows,0,g);
  for (let k=0;k<rows;k++){ const y=0.11+k*(h-0.16)/rows; let x=-w/2+0.1;
    while (x<w/2-0.12){ const roll=r();
      if (roll<0.08 && x<w/2-0.3){ const j=mk(G.cyl(0.09,0.09,0.24,10), new THREE.MeshStandardMaterial({ color:[0x9ad8c8,0xd8a8e8,0xe8d898][Math.floor(r()*3)], transparent:true, opacity:0.75, roughness:0.2 }), x+0.1,y+0.12,0,g); j.castShadow=false; mk(G.cyl(0.07,0.07,0.04,10), M(0x8a6040), x+0.1,y+0.26,0,g); x+=0.24; continue; }
      if (roll<0.12 && x<w/2-0.3){ noShadow(mk(G.sph(0.1,12,10), new THREE.MeshStandardMaterial({ color:0xd8e8ff, transparent:true, opacity:0.7, roughness:0.05, emissive:0x8aa8ff, emissiveIntensity:0.3 }), x+0.1,y+0.11,0,g)); x+=0.24; continue; }
      if (roll<0.18){ x+=0.1; continue; }
      const bw=0.05+r()*0.05, bh=0.28+r()*0.18, b=mk(G.box(bw,bh,0.26+r()*0.06), M(BOOK_C[Math.floor(r()*BOOK_C.length)]), x+bw/2,y+bh/2,0.02,g); b.castShadow=false;
      if (r()<0.12){ b.rotation.z=-0.25; b.position.x+=0.04; } x+=bw+0.006; } }
  g.userData.size=[w,d]; return g; }

function starChart(){ const g=new THREE.Group(), cv=canvas(640,512), mat=new THREE.MeshStandardMaterial({ map:texOf(cv), roughness:0.9 });
  mk(G.box(2.2,1.76,0.05), M(0x5a3e2a), 0,0,0,g); noShadow(mk(G.box(2.06,1.62,0.02), mat, 0,0,0.03,g));
  for (const s of [-1,1]){ const r=mk(G.cyl(0.06,0.06,2.3,10), M(0xd8c8a0), 0,s*0.86,0.06,g); r.rotation.z=Math.PI/2; }
  g.userData.canvas=cv; g.userData.mat=mat; return g; }
// constellations: [name, points] in a 0..1 box. "The Old Goat" is Wendell's own sign.
const CONSTEL=[ ['The Heron',[[0.1,0.7],[0.2,0.5],[0.28,0.32],[0.36,0.2],[0.3,0.12],[0.5,0.22]]], ['The Old Goat',[[0.55,0.55],[0.62,0.45],[0.72,0.47],[0.78,0.38],[0.75,0.62],[0.62,0.66],[0.55,0.55]]],
  ['The Lantern',[[0.18,0.88],[0.25,0.8],[0.32,0.88],[0.25,0.96],[0.18,0.88]]], ['The Long Oar',[[0.42,0.88],[0.55,0.8],[0.68,0.74],[0.85,0.68]]], ['The Snail',[[0.8,0.15],[0.86,0.2],[0.84,0.27],[0.78,0.26],[0.77,0.2]]] ];
export function drawChart(chart, st){ const cv=chart.userData.canvas, x=cv.getContext('2d'), W=cv.width, H=cv.height, r=mulberry32(4242);
  const gr=x.createRadialGradient(W/2,H/2,40,W/2,H/2,W*0.7); gr.addColorStop(0,'#2a2f5e'); gr.addColorStop(1,'#141634'); x.fillStyle=gr; x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(232,200,104,.35)'; x.lineWidth=2; x.beginPath(); x.arc(W/2,H/2,H*0.46,0,TAU); x.stroke(); x.beginPath(); x.arc(W/2,H/2,H*0.3,0,TAU); x.stroke();
  for (let i=0;i<12;i++){ const a=i/12*TAU; x.beginPath(); x.moveTo(W/2+Math.cos(a)*H*0.3, H/2+Math.sin(a)*H*0.3); x.lineTo(W/2+Math.cos(a)*H*0.46, H/2+Math.sin(a)*H*0.46); x.stroke(); }
  for (let i=0;i<170;i++){ x.fillStyle=`rgba(255,250,230,${0.3+r()*0.6})`; x.beginPath(); x.arc(r()*W, r()*H, 0.6+r()*1.6, 0, TAU); x.fill(); }
  x.font='600 17px Georgia, serif'; x.textAlign='center';
  for (const [nm,pts] of CONSTEL){ x.strokeStyle='rgba(232,200,104,.75)'; x.lineWidth=2; x.beginPath(); pts.forEach(([u,v],i)=>i?x.lineTo(u*W,v*H):x.moveTo(u*W,v*H)); x.stroke();
    x.fillStyle='#fff6d8'; for (const [u,v] of pts){ x.beginPath(); x.arc(u*W,v*H,4,0,TAU); x.fill(); }
    const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length*W, cy=Math.max(...pts.map(p=>p[1]))*H+20; x.fillStyle='#e8c868'; x.fillText(nm, cx, Math.min(H-8, cy)); }
  // Starfall: a dotted circle until it's up, then a bright star with rays
  const sx=W*0.47, sy=H*0.5; x.save();
  if (st.starfall){ const g2=x.createRadialGradient(sx,sy,2,sx,sy,48); g2.addColorStop(0,'rgba(255,250,220,1)'); g2.addColorStop(0.3,'rgba(200,190,255,.7)'); g2.addColorStop(1,'rgba(120,110,255,0)'); x.fillStyle=g2; x.beginPath(); x.arc(sx,sy,48,0,TAU); x.fill();
    x.strokeStyle='#fff6d8'; x.lineWidth=2; for (let i=0;i<8;i++){ const a=i/8*TAU, L=i%2?16:30; x.beginPath(); x.moveTo(sx+Math.cos(a)*6,sy+Math.sin(a)*6); x.lineTo(sx+Math.cos(a)*L,sy+Math.sin(a)*L); x.stroke(); }
    x.fillStyle='#fff6d8'; x.font='700 20px Georgia, serif'; x.fillText('Starfall', sx, sy+56); }
  else { x.setLineDash([5,7]); x.strokeStyle='rgba(255,246,216,.7)'; x.lineWidth=2; x.beginPath(); x.arc(sx,sy,22,0,TAU); x.stroke(); x.setLineDash([]);
    x.fillStyle='rgba(255,246,216,.85)'; x.font='italic 600 17px Georgia, serif'; x.fillText(st.charter ? 'Starfall? Soon.' : 'Starfall?', sx, sy+46); }
  x.restore(); x.fillStyle='rgba(232,200,104,.9)'; x.font='italic 600 22px Georgia, serif'; x.fillText('The sky over '+String(st.island||'the island').slice(0,24), W/2, 30);
  chart.userData.mat.map.needsUpdate=true; }

function workbench(){ const g=new THREE.Group(), wood=M(0x7a5236), dark=M(0x4e3424);
  mk(G.box(2.0,0.08,0.75), wood, 0,0.92,0,g); for (const x of [-0.9,0.9]) for (const z of [-0.3,0.3]) mk(G.box(0.08,0.92,0.08), dark, x,0.46,z,g); mk(G.box(1.84,0.05,0.62), dark, 0,0.25,0,g);
  // an alembic: a round flask, a tube, a little catch flask
  const glass=new THREE.MeshStandardMaterial({ color:0xd8f0ff, transparent:true, opacity:0.45, roughness:0.05 });
  noShadow(mk(G.sph(0.17,14,12), glass, -0.55,1.13,0,g)); noShadow(mk(G.sph(0.13,12,10), basic(0xe880c8), -0.55,1.1,0,g)).scale.y=0.55;
  const tube=mk(G.cyl(0.02,0.02,0.6,6), glass, -0.3,1.32,0,g); tube.rotation.z=-1.1; noShadow(tube);
  noShadow(mk(G.cyl(0.08,0.1,0.22,10), glass, -0.04,1.07,0,g)); mk(G.cyl(0.1,0.12,0.08,10), M(0x3a3a44), -0.55,0.98,0,g);
  // vials in a rack, each a different colour
  mk(G.box(0.5,0.06,0.16), dark, 0.45,0.98,0.12,g); [0xff7a90,0x7ad8ff,0xffd860,0x9aff8a,0xc88aff].forEach((c,i)=>{ noShadow(mk(G.cyl(0.03,0.03,0.2,8), new THREE.MeshBasicMaterial({ color:c }), 0.27+i*0.09,1.08,0.12,g)); });
  // a mortar and pestle, a candle, a few dried herbs hung above
  mk(G.cyl(0.1,0.07,0.1,10), M(0x9a948a), 0.65,1.01,-0.15,g); const ps=mk(G.cyl(0.02,0.03,0.22,6), M(0x8a8478), 0.68,1.1,-0.15,g); ps.rotation.z=-0.4;
  mk(G.cyl(0.04,0.04,0.16,8), M(0xfff4dc), 0.88,1.04,0.18,g); noShadow(mk(G.sph(0.03,6,5), basic(0xffd060), 0.88,1.15,0.18,g)).scale.y=1.6;
  for (let i=0;i<4;i++){ const b=new THREE.Group(); b.position.set(-0.7+i*0.45,2.25,-0.25); g.add(b); mk(G.cyl(0.005,0.005,0.3,3), M(0x8a6040), 0,0.1,0,b); const h=mk(G.cone(0.08,0.32,6), M([0x6a8a4a,0x8a7a4a,0x5a7a5a,0x9a6a8a][i]), 0,-0.12,0,b); h.rotation.x=Math.PI; }
  mk(G.box(2.0,0.04,0.06), dark, 0,2.4,-0.25,g);
  g.userData.size=[2.0,0.75]; return g; }
function lectern(){ const g=new THREE.Group(), wood=M(0x6a4630);
  mk(G.cyl(0.3,0.36,0.08,10), wood, 0,0.04,0,g); mk(G.cyl(0.08,0.1,1.0,8), wood, 0,0.55,0,g);
  const top=new THREE.Group(); top.position.y=1.1; top.rotation.x=-0.45; g.add(top); mk(G.box(0.7,0.05,0.5), wood, 0,0,0,top);
  for (const s of [-1,1]){ const p=mk(G.box(0.32,0.03,0.42), M(0xfff4dc), s*0.17,0.05,0,top); p.rotation.z=-s*0.08; noShadow(p); }
  mk(G.box(0.66,0.02,0.46), M(0x6a2a4a), 0,0.03,0,top);
  // a ribbon of light lifting off the page: the spell he's teaching
  const rib=noShadow(mk(G.tor(0.12,0.012,6,24,Math.PI*1.6), new THREE.MeshBasicMaterial({ color:0xd8b8ff, transparent:true, opacity:0.85 }), 0.1,0.28,0,top));
  g.userData.rib=rib; return g; }
function scryBowl(){ const g=new THREE.Group(), stone=M(0x8a8478);
  mk(G.cyl(0.22,0.3,0.8,10), stone, 0,0.4,0,g); mk(G.cyl(0.62,0.42,0.22,20), stone, 0,0.9,0,g);
  const water=noShadow(mk(G.cyl(0.55,0.55,0.02,24), new THREE.MeshBasicMaterial({ color:0x3a6ab8 }), 0,0.99,0,g));
  // the island floats in the water: a little green mound with a tower on it
  const isl=new THREE.Group(); isl.position.y=1.0; g.add(isl); mk(G.sph(0.22,12,8,0,TAU,0,Math.PI/2), M(0xe8d49a), 0,0,0,isl).scale.y=0.4; mk(G.sph(0.17,12,8,0,TAU,0,Math.PI/2), M(0x6aaa5a), 0,0.02,0,isl).scale.y=0.6;
  mk(G.cyl(0.025,0.03,0.12,6), M(0xb4ae9e), 0.05,0.1,0,isl); mk(G.cone(0.04,0.06,6), M(0x4e5460), 0.05,0.19,0,isl);
  glow(g, 1.1, 1.4, 0x9ab8ff, 0.5);
  g.userData={ water, isl }; return g; }
function owlPerch(){ const g=new THREE.Group(), wood=M(0x6a4630);
  mk(G.cyl(0.3,0.36,0.06,10), wood, 0,0.03,0,g); mk(G.cyl(0.04,0.05,1.7,6), wood, 0,0.88,0,g); const bar=mk(G.cyl(0.03,0.03,0.6,6), wood, 0,1.72,0,g); bar.rotation.z=Math.PI/2;
  const owl=new THREE.Group(); owl.position.set(0.05,1.75,0); g.add(owl); const brown=M(0x8a6a4a), cream=M(0xf0e2c4);
  mk(G.sph(0.2,14,12), brown, 0,0.2,0,owl).scale.set(1,1.15,0.9); mk(G.sph(0.14,12,10), cream, 0,0.18,0.1,owl).scale.set(1,1.2,0.5);
  const head=new THREE.Group(); head.position.y=0.44; owl.add(head); mk(G.sph(0.17,14,12), brown, 0,0,0,head);
  for (const s of [-1,1]){ mk(G.sph(0.07,10,8), cream, s*0.07,0.01,0.12,head); mk(G.sph(0.04,8,6), basic(0xffb030), s*0.07,0.01,0.17,head); mk(G.sph(0.022,6,5), basic(0x1a1410), s*0.07,0.01,0.205,head);
    const tuft=mk(G.cone(0.04,0.1,5), brown, s*0.1,0.15,0,head); tuft.rotation.z=-s*0.4; }
  mk(G.cone(0.025,0.06,5), M(0xd8a040), 0,-0.04,0.17,head).rotation.x=Math.PI/2+0.4;
  for (const s of [-1,1]){ const w=mk(G.sph(0.14,10,8), M(0x7a5a3a), s*0.17,0.2,-0.02,owl); w.scale.set(0.35,1,0.8); }
  g.userData={ owl, head }; return g; }
function armchair(){ const g=new THREE.Group(), fab=M(0x7a3a5a), wood=M(0x5a3e2a);
  mk(G.box(0.95,0.4,0.85), fab, 0,0.35,0,g); mk(G.box(0.95,0.9,0.2), fab, 0,0.85,-0.36,g); for (const s of [-1,1]) mk(G.box(0.18,0.62,0.85), fab, s*0.47,0.46,0,g);
  for (const x of [-0.4,0.4]) for (const z of [-0.35,0.35]) mk(G.cyl(0.04,0.03,0.15,6), wood, x,0.07,z,g);
  mk(G.box(0.4,0.06,0.4), M(0xe8c868), 0.1,0.58,0.05,g).rotation.y=0.4;   // a folded star blanket
  const t=new THREE.Group(); t.position.set(0.85,0,0.1); g.add(t); mk(G.cyl(0.25,0.25,0.04,14), wood, 0,0.6,0,t); mk(G.cyl(0.04,0.05,0.6,6), wood, 0,0.3,0,t);
  mk(G.cyl(0.07,0.06,0.1,10), M(0xfff4dc), 0,0.67,0,t); mk(G.cyl(0.05,0.05,0.12,8), M(0x5a6a7a), 0.1,0.68,0.06,t);   // tea and a pot
  return g; }
function hatStand(){ const g=new THREE.Group(), wood=M(0x5a3e2a);
  mk(G.cyl(0.25,0.3,0.06,8), wood, 0,0.03,0,g); mk(G.cyl(0.04,0.05,1.9,6), wood, 0,0.95,0,g);
  const hat=new THREE.Group(); hat.position.set(0,1.92,0); hat.rotation.z=0.2; g.add(hat); const felt=M(0x3a3a6a); mk(G.cyl(0.36,0.34,0.03,18), felt, 0,0,0,hat); mk(G.cone(0.2,0.6,14), felt, 0,0.3,0,hat);
  for (let i=0;i<3;i++) noShadow(mk(G.box(0.05,0.05,0.01), basic(0xe8c868), Math.sin(i*2)*0.12,0.18+i*0.1,0.16-i*0.03,hat)).rotation.z=Math.PI/4;
  const br=new THREE.Group(); br.position.set(0.45,0,0.1); br.rotation.z=-0.22; g.add(br); mk(G.cyl(0.025,0.025,1.5,6), wood, 0,0.95,0,br); mk(G.cone(0.16,0.45,8), M(0xc8a060), 0,0.22,0,br);
  return g; }
function spiralStair(R, a0, a1, top){
  const g=new THREE.Group(), n=13, wood=M(0x7a5236), dark=M(0x4e3424), da=(a1-a0)/n, rr=R-0.85, pts=[];
  for (let i=0;i<n;i++){ const a=a0+(i+0.5)*da, y=(i+1)*top/n;
    const s=new THREE.Group(); const [x,z]=polar(a, rr); s.position.set(x,y-0.06,z); s.rotation.y=a; g.add(s); mk(G.box(da*rr*1.12,0.1,1.2), i%2?wood:dark, 0,0,0,s);
    if (i<n-1) mk(G.box(0.08,y,0.08), dark, 0,-y/2,-0.5,s);   // a post under the inner edge
    const [ix,iz]=polar(a, rr-0.55); pts.push(new THREE.Vector3(ix, y+0.9, iz)); }
  const rail=mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.035, 6), M(0xc8a040,{ metalness:0.5, roughness:0.35 }), 0,0,0,g); rail.castShadow=false;
  for (let i=0;i<n;i+=3){ const p=pts[i]; mk(G.cyl(0.02,0.02,0.9,5), dark, p.x,p.y-0.45,p.z,g); }
  return g; }
function floatingCandles(n, rMin, rMax, seed){ const g=new THREE.Group(), r=mulberry32(seed), wax=M(0xfff4dc), flameM=basic(0xffd060), list=[];
  for (let i=0;i<n;i++){ const a=r()*TAU, d=rMin+r()*(rMax-rMin), c=new THREE.Group(), [x,z]=polar(a,d); c.position.set(x, 2.5+r()*0.7, z); g.add(c);
    const h=0.18+r()*0.16; noShadow(mk(G.cyl(0.04,0.045,h,8), wax, 0,0,0,c)); const f=noShadow(mk(G.sph(0.035,6,5), flameM, 0,h/2+0.04,0,c)); f.scale.y=1.8; glow(c, h/2+0.05, 0.7, 0xffc860, 0.6);
    list.push({ c, f, y0:c.position.y, ph:r()*TAU }); }
  g.userData.list=list; return g; }
function rug(R, a, b){ const cv=canvas(256,256), x=cv.getContext('2d'); x.fillStyle=a; x.beginPath(); x.arc(128,128,126,0,TAU); x.fill(); x.strokeStyle=b; x.lineWidth=8; x.beginPath(); x.arc(128,128,108,0,TAU); x.stroke();
  x.fillStyle=b; x.beginPath(); for (let i=0;i<10;i++){ const rr=i%2?28:70, an=i/10*TAU-Math.PI/2; x.lineTo(128+Math.cos(an)*rr, 128+Math.sin(an)*rr); } x.closePath(); x.fill();
  for (let i=0;i<16;i++){ const an=i/16*TAU; x.beginPath(); x.arc(128+Math.cos(an)*92,128+Math.sin(an)*92,4,0,TAU); x.fill(); }
  const m=new THREE.Mesh(new THREE.CircleGeometry(R,40), new THREE.MeshStandardMaterial({ map:texOf(cv), roughness:1, transparent:true })); m.rotation.x=-Math.PI/2; m.position.y=0.012; m.receiveShadow=true; return m; }
function roundWindow(r=0.45){ const g=new THREE.Group(); mk(G.tor(r,0.07,8,24), M(0x5a3e2a), 0,0,0,g); noShadow(mk(G.cyl(r,r,0.04,24), towerGlass, 0,0,-0.02,g)).rotation.x=Math.PI/2;
  for (const s of [0,1]) mk(G.box(s?0.04:r*2,s?r*2:0.04,0.05), M(0x5a3e2a), 0,0,0.01,g); return g; }

/* ---------- the workroom (ground floor) ---------- */
// angles (degrees, 0 = the door): star chart 76, stair 92 to 150 with a landing at 154, shelves 166 to 231,
// window and owl 250, workbench 272, lectern 292, window 305, scrying bowl 322 (out in the room), hat stand 30, armchair 55
export const WR = { chart:76, stair:[92,150], landing:154, shelves:[166,231], owl:250, bench:272, lectern:292, bowl:322, hat:30, chair:55, books:162 };
export function buildWorkroom(seed){
  const R=TOWER_R, g=new THREE.Group(), A=WR;
  floorDisc(g, R, (x,S)=>{ x.fillStyle='#6a6056'; x.fillRect(0,0,S,S); const r=mulberry32(seed^0x51);   // flagstones in rings
    for (let ring=0; ring<6; ring++){ const r0=ring*S/12, r1=(ring+1)*S/12, n=Math.max(1, ring*6);
      for (let i=0;i<n;i++){ const a0=i/n*TAU+ring*0.4, a1=(i+1)/n*TAU+ring*0.4; const v=96+Math.floor(r()*26); x.fillStyle=`rgb(${v+16},${v+6},${v-6})`; x.beginPath(); x.arc(S/2,S/2,r1-2,a0+0.01,a1-0.01); x.arc(S/2,S/2,Math.max(0,r0+2),a1-0.01,a0+0.01,true); x.closePath(); x.fill(); } } });
  const cut=ringWalls(g, R, WALL_H, { stone:0x9a9284, paint:0x5d5578, door:1.7, stars:true });
  g.add(rug(2.1, '#7a2a4a', '#e8c868')).position.set(0,0.012,0.9);
  const cauld=cauldron(); cauld.position.set(0,0,-1.3); g.add(cauld);
  // shelves round the back wall, a rolling ladder on one
  const nSh=6, shStep=(A.shelves[1]-A.shelves[0])/(nSh-1);
  for (let k=0;k<nSh;k++){ const a=deg(A.shelves[0]+k*shStep), s=shelfUnit(seed+k*31, 1.3, 3.0); const p=onWall(g, a, R-0.45); p.add(s); hang(cut, p, a); }
  { const a=deg(192), p=onWall(g, a, R-1.12); hang(cut, p, a); const L=new THREE.Group(); L.rotation.x=-0.17; p.add(L); const w=M(0x8a6040);
    for (const s of [-1,1]) mk(G.box(0.05,3.1,0.05), w, s*0.22,1.55,0,L); for (let k=0;k<9;k++) mk(G.box(0.44,0.04,0.04), w, 0,0.3+k*0.33,0,L); }
  // the star chart, east wall
  const chart=starChart(); { const a=deg(A.chart), p=onWall(g, a, R-0.32, 2.15); p.add(chart); hang(cut, p, a); }
  // the stair up the north-east wall, and a landing at the top by the trapdoor
  g.add(spiralStair(R, deg(A.stair[0]), deg(A.stair[1]), WALL_H-0.1));
  { const a=deg(A.landing), p=onWall(g, a, R-0.9, WALL_H-0.12); hang(cut, p, a); mk(G.box(1.6,0.12,1.3), M(0x4e3424), 0,0,0.3,p); }
  // round windows; the owl sits under one
  for (const [a,y] of [[A.owl,2.45],[122,2.75],[305,2.3]]){ const w=roundWindow(); const p=onWall(g, deg(a), R-0.24, y); p.add(w); hang(cut, p, deg(a)); }
  const owl=owlPerch(); { const [x,z]=polar(deg(A.owl), R-1.0); owl.position.set(x,0,z); owl.rotation.y=deg(A.owl)+Math.PI; g.add(owl); }
  // the workbench and lectern, west
  const wb=workbench(); { const p=onWall(g, deg(A.bench), R-0.62); p.add(wb); hang(cut, p, deg(A.bench)); }
  const lec=lectern(); { const [x,z]=polar(deg(A.lectern), R-1.75); lec.position.set(x,0,z); lec.rotation.y=deg(A.lectern)+Math.PI; g.add(lec); }
  // the scrying bowl and armchair stand out in the room, front left and front right
  const bowl=scryBowl(); { const [x,z]=polar(deg(A.bowl), 3.5); bowl.position.set(x,0,z); g.add(bowl); }
  const chair=armchair(); { const [x,z]=polar(deg(A.chair), R-1.35); chair.position.set(x,0,z); chair.rotation.y=deg(A.chair)+Math.PI; g.add(chair); }
  const hs=hatStand(); { const [x,z]=polar(deg(A.hat), R-0.75); hs.position.set(x,0,z); hs.rotation.y=deg(A.hat)+Math.PI; g.add(hs); }
  // a tottering pile of books by the shelves
  { const r=mulberry32(seed^0x99); const p=new THREE.Group(); const [x,z]=polar(deg(A.books), R-1.5); p.position.set(x,0,z); g.add(p); for (let i=0;i<7;i++){ const b=mk(G.box(0.42-i*0.02,0.09,0.3), M(BOOK_C[Math.floor(r()*BOOK_C.length)]), 0,0.05+i*0.09,0,p); b.rotation.y=(r()-0.5)*0.6; } }
  const candles=floatingCandles(16, 1.6, R-1.3, seed^0x77); g.add(candles);
  const light=new THREE.PointLight(0xffd8a8, 26, 16, 1.5); light.position.set(0,3.2,0.6); light.castShadow=false; g.add(light);
  g.userData.cutWalls=cut;
  const at=(a,r)=>polar(deg(a), r);
  return { shell:g, R, cauldron:cauld, chart, owl, lectern:lec, bowl, candles,
    wendellAt:[-1.9,-2.3], cauldAt:[0,-1.3],
    spots:{ shelves:at(210, R-1.0), chart:at(A.chart, R-1.0), bench:at(A.bench, R-1.35), lectern:at(A.lectern, R-1.75), bowl:at(A.bowl, 3.5), owl:at(A.owl, R-1.0), chair:at(A.chair, R-1.35), up:at(97, R-1.85) },
    upLand:at(A.landing+6, R-2.2),
    // no walking through these: [x, z, radius] in room coordinates
    solids:[[0,-1.3,1.15], [...at(A.lectern,R-1.75),0.42], [...at(A.bowl,3.5),0.72], [...at(A.owl,R-1.0),0.35], [...at(A.chair,R-1.35),0.75], [...at(A.chair-10,R-1.35),0.35], [...at(A.hat,R-0.75),0.4], [...at(A.books,R-1.5),0.35], [...at(192,R-1.12),0.3]],
    // [from, to, r]: no walking further out than r between those angles (shelves, workbench, stair)
    bands:[[deg(A.shelves[0]-8), deg(A.shelves[1]+8), R-0.75], [deg(A.bench-11), deg(A.bench+11), R-1.05], [deg(A.stair[0]-2), deg(A.landing+4), R-1.4]] };
}

/* ---------- the observatory (upstairs) ---------- */
function telescope(){ const g=new THREE.Group(), brass=M(0xc8a040,{ metalness:0.6, roughness:0.3 }), dark=M(0x3a3a44), wood=M(0x5a3e2a);
  mk(G.cyl(1.0,1.1,0.25,24), wood, 0,0.12,0,g); mk(G.cyl(0.98,0.98,0.02,24), M(0x7a3a5a), 0,0.26,0,g);
  for (let k=0;k<3;k++){ const a=k/3*TAU, l=mk(G.cyl(0.05,0.06,1.6,6), dark, Math.sin(a)*0.45,0.95,Math.cos(a)*0.45,g); l.rotation.set(-0.28*Math.cos(a),0,0.28*Math.sin(a)); }
  const head=new THREE.Group(); head.position.y=1.72; g.add(head); mk(G.sph(0.16,12,10), dark, 0,0,0,head);
  const tube=new THREE.Group(); tube.rotation.x=0.75; head.add(tube);   // pointing up and away to the north
  mk(G.cyl(0.24,0.2,2.6,20), brass, 0,0.0,-0.3,tube).rotation.x=Math.PI/2; for (const z of [-1.4,-0.3,0.8]){ const b=mk(G.tor(0.24,0.03,6,24), dark, 0,0,z,tube); }
  mk(G.cyl(0.27,0.24,0.3,20), brass, 0,0,-1.6,tube).rotation.x=Math.PI/2; noShadow(mk(G.cyl(0.22,0.22,0.02,20), new THREE.MeshStandardMaterial({ color:0x9ad8ff, emissive:0x4a8aff, emissiveIntensity:0.6, roughness:0.05 }), 0,0,-1.76,tube)).rotation.x=Math.PI/2;
  mk(G.cyl(0.06,0.06,0.3,10), dark, 0,0,1.05,tube).rotation.x=Math.PI/2;   // the eyepiece
  const finder=mk(G.cyl(0.05,0.05,0.7,8), brass, 0.28,0.18,-0.2,tube); finder.rotation.x=Math.PI/2;
  g.userData.head=head; return g; }
function orrery(){ const g=new THREE.Group(), wood=M(0x5a3e2a), brass=M(0xc8a040,{ metalness:0.6, roughness:0.3 });
  mk(G.cyl(0.55,0.55,0.05,18), wood, 0,0.8,0,g); mk(G.cyl(0.06,0.08,0.8,8), wood, 0,0.4,0,g); mk(G.cyl(0.3,0.35,0.04,12), wood, 0,0.02,0,g);
  mk(G.cyl(0.02,0.02,0.4,6), brass, 0,1.0,0,g); const sun=noShadow(mk(G.sph(0.11,14,12), basic(0xffd060), 0,1.22,0,g)); glow(g, 1.22, 0.9, 0xffc860, 0.7);
  const arms=[]; [[0.22,0x9aa8b8,0.04,1.6],[0.34,0x4a8ad0,0.06,1.0],[0.46,0xd8604a,0.05,0.7],[0.56,0xe8c890,0.08,0.45]].forEach(([r,c,s,sp],i)=>{ const a=new THREE.Group(); a.position.y=1.12+i*0.025; g.add(a);
    const rod=mk(G.cyl(0.008,0.008,r,4), brass, r/2,0,0,a); rod.rotation.z=Math.PI/2; mk(G.sph(s,10,8), M(c), r,0.03,0,a); if (i===3){ const ring=mk(G.tor(s*1.6,0.008,4,20), brass, r,0.03,0,a); ring.rotation.x=1.2; } a.userData.sp=sp; a.rotation.y=i*1.7; arms.push(a); });
  g.userData.arms=arms; return g; }
function pedestal(){ const g=new THREE.Group(), stone=M(0xb4ae9e);
  mk(G.cyl(0.3,0.38,0.12,10), stone, 0,0.06,0,g); mk(G.cyl(0.18,0.22,0.9,10), stone, 0,0.55,0,g); mk(G.cyl(0.32,0.28,0.1,10), stone, 0,1.05,0,g);
  mk(G.sph(0.22,12,8), M(0x5a3a7a), 0,1.13,0,g).scale.y=0.35;   // a velvet cushion
  const dome=noShadow(mk(G.sph(0.28,16,12,0,TAU,0,Math.PI/2), new THREE.MeshStandardMaterial({ color:0xe8f4ff, transparent:true, opacity:0.22, roughness:0.05, depthWrite:false }), 0,1.1,0,g));
  const shard=new THREE.Group(); shard.position.y=1.28; g.add(shard); noShadow(mk(G.ico(0.09,0), new THREE.MeshBasicMaterial({ color:0xe8e0ff }), 0,0,0,shard)).scale.set(0.7,1.6,0.7);
  glow(shard, 0, 1.3, 0xc8b8ff, 0.7); const spark=new THREE.PointLight(0xc8b8ff, 4, 4, 1.8); shard.add(spark);
  g.userData={ shard, dome }; return g; }
function starGlobe(){ const g=new THREE.Group(), wood=M(0x5a3e2a), brass=M(0xc8a040,{ metalness:0.6, roughness:0.3 });
  for (let k=0;k<3;k++){ const a=k/3*TAU, l=mk(G.cyl(0.03,0.03,0.8,5), wood, Math.sin(a)*0.22,0.4,Math.cos(a)*0.22,g); l.rotation.set(-0.25*Math.cos(a),0,0.25*Math.sin(a)); }
  const cv=canvas(256,128), x=cv.getContext('2d'); x.fillStyle='#1e2450'; x.fillRect(0,0,256,128); const r=mulberry32(9); x.fillStyle='#fff6d8'; for (let i=0;i<70;i++){ x.beginPath(); x.arc(r()*256,r()*128,0.8+r()*1.5,0,TAU); x.fill(); }
  x.strokeStyle='rgba(232,200,104,.7)'; x.lineWidth=1.5; for (let i=0;i<5;i++){ x.beginPath(); for (let k=0;k<4;k++) x[k?'lineTo':'moveTo'](r()*256, r()*128); x.stroke(); }
  const ball=mk(G.sph(0.32,24,16), new THREE.MeshStandardMaterial({ map:texOf(cv), roughness:0.6 }), 0,1.12,0,g); ball.rotation.z=0.4; const ring=mk(G.tor(0.36,0.02,6,32), brass, 0,1.12,0,g); ring.rotation.y=Math.PI/2; ring.rotation.z=0.4;
  g.userData.ball=ball; return g; }
// a sky for the observatory windows: day blue with clouds, or night with stars, swapped when you go up
function skyTex(night){ const cv=canvas(512,256), x=cv.getContext('2d'), gr=x.createLinearGradient(0,0,0,256);
  if (night){ gr.addColorStop(0,'#0e1030'); gr.addColorStop(1,'#2a2a62'); x.fillStyle=gr; x.fillRect(0,0,512,256); const r=mulberry32(31); for (let i=0;i<260;i++){ x.fillStyle=`rgba(255,250,230,${0.35+r()*0.65})`; x.beginPath(); x.arc(r()*512, r()*256, 0.5+r()*1.4, 0, TAU); x.fill(); } }
  else { gr.addColorStop(0,'#6aaee8'); gr.addColorStop(1,'#cfe8f8'); x.fillStyle=gr; x.fillRect(0,0,512,256); const r=mulberry32(17); x.fillStyle='rgba(255,255,255,.85)'; for (let i=0;i<9;i++){ const cx=r()*512, cy=40+r()*150; for (let k=0;k<5;k++){ x.beginPath(); x.ellipse(cx+k*18-36, cy+Math.sin(k)*6, 26, 14, 0, 0, TAU); x.fill(); } } }
  return texOf(cv, [3,1]); }
export function buildObservatory(seed){
  const R=TOP_R, g=new THREE.Group();
  floorDisc(g, R, (x,S)=>{ x.fillStyle='#6a4a32'; x.fillRect(0,0,S,S); for (let i=0;i<S;i+=22){ x.fillStyle=i%44?'#71503a':'#64462f'; x.fillRect(0,i,S,20); }
    // a brass compass star set in the floor
    x.save(); x.translate(S/2,S/2); x.strokeStyle='#d8b050'; x.lineWidth=5; x.beginPath(); x.arc(0,0,S*0.3,0,TAU); x.stroke(); x.fillStyle='#d8b050';
    for (let i=0;i<8;i++){ const a=i/8*TAU, L=i%2?S*0.18:S*0.29; x.beginPath(); x.moveTo(Math.cos(a)*L, Math.sin(a)*L); x.lineTo(Math.cos(a+0.12)*24, Math.sin(a+0.12)*24); x.lineTo(Math.cos(a-0.12)*24, Math.sin(a-0.12)*24); x.closePath(); x.fill(); } x.restore(); });
  // low stone walls with tall windows onto the sky between pillars
  const stone=M(0x9a9284), wood=M(0x5a3e2a), skyM=new THREE.MeshBasicMaterial({ map:skyTex(false) }), cut=[], segs=14, step=TAU/segs;
  for (let i=0;i<segs;i++){ const a0=-step/2+i*step, a1=a0+step, mid=(a0+a1)/2, sg=new THREE.Group(); g.add(sg);
    sector(a0,a1,R-0.15,R+0.15,0,1.1,stone,sg); sector(a0,a1,R-0.2,R+0.2,1.1,1.2,wood,sg);
    sector(a0+0.03,a1-0.03,R+0.05,R+0.1,1.2,WALL_H,skyM,sg);   // the sky through the glass
    sector(a0-0.035,a0+0.035,R-0.15,R+0.15,1.2,WALL_H,stone,sg);   // a pillar between panes
    for (const y of [2.0,2.8]) sector(a0,a1,R-0.02,R+0.02,y,y+0.04,wood,sg);
    sector(a0,a1,R-0.2,R+0.25,WALL_H,WALL_H+0.18,wood,sg);
    sg.children.forEach(noShadow); cut.push({ meshes:[sg], hide:[], nx:Math.sin(mid), nz:Math.cos(mid), a0, a1 }); }
  // ribs of an open crown over the top; each drops away with the wall below it
  const brass=M(0xc8a040,{ metalness:0.6, roughness:0.3 });
  for (let k=0;k<8;k++){ const a=k/8*TAU+step/2, pts=[]; for (let j=0;j<=12;j++){ const f=j/12, rr=R+0.05-(R-2.6)*Math.sin(f*Math.PI/2), y=WALL_H+0.1+1.5*(1-Math.cos(f*Math.PI/2)); pts.push(new THREE.Vector3(Math.sin(a)*rr, y, Math.cos(a)*rr)); }
    const rib=noShadow(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.05, 5), brass, 0,0,0,g)); const tip=noShadow(mk(G.sph(0.09,8,6), brass, pts[12].x, pts[12].y, pts[12].z, g));
    const sg=segOf(cut, a); if (sg) sg.hide.push(rib, tip); }
  const scope=telescope(); scope.position.set(0,0,-0.5); g.add(scope);
  const orr=orrery(); { const [x,z]=polar(deg(250), 3.3); orr.position.set(x,0,z); g.add(orr); }
  const ped=pedestal(); { const [x,z]=polar(deg(180), R-1.2); ped.position.set(x,0,z); g.add(ped); }
  const globe=starGlobe(); { const [x,z]=polar(deg(215), R-1.0); globe.position.set(x,0,z); g.add(globe); }
  const chair=armchair(); { const [x,z]=polar(deg(290), R-1.2); chair.position.set(x,0,z); chair.rotation.y=deg(290)+Math.PI; g.add(chair); }
  // a writing desk with a star atlas and a candle, east
  { const [x,z]=polar(deg(70), R-0.9); const d=new THREE.Group(); d.position.set(x,0,z); d.rotation.y=deg(70)+Math.PI; g.add(d); mk(G.box(1.4,0.06,0.6), wood, 0,0.78,0,d); for (const sx of [-0.62,0.62]) mk(G.box(0.06,0.78,0.5), wood, sx,0.39,0,d);
    mk(G.box(0.6,0.04,0.42), M(0x2a3a6a), -0.15,0.83,0,d); mk(G.box(0.56,0.01,0.38), M(0xfff4dc), -0.15,0.855,0,d); mk(G.cyl(0.04,0.04,0.16,8), M(0xfff4dc), 0.45,0.89,0.1,d); noShadow(mk(G.sph(0.03,6,5), basic(0xffd060), 0.45,1.0,0.1,d)).scale.y=1.6; }
  // the stairwell: a hole with a rail round it, where the stair comes up
  const holeA=deg(122), [hx,hz]=polar(holeA, R-1.15);
  { const h=noShadow(mk(G.cyl(0.85,0.85,0.02,24), basic(0x1a1410), hx,0.005,hz,g)); const rail=[]; for (let k=0;k<=20;k++){ const a=k/20*TAU*0.78+holeA+Math.PI*0.35; rail.push(new THREE.Vector3(hx+Math.sin(a)*0.95, 0.9, hz+Math.cos(a)*0.95)); }
    noShadow(mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 30, 0.035, 6), brass, 0,0,0,g)); for (let k=0;k<rail.length;k+=4) mk(G.cyl(0.02,0.02,0.9,5), wood, rail[k].x,0.45,rail[k].z,g);
    const [sx,sz]=polar(holeA, R-1.15); for (let k=0;k<3;k++){ const s=mk(G.box(0.8,0.08,0.3), wood, sx,-0.1-k*0.25,sz,g); s.rotation.y=holeA+k*0.35; } }
  const candles=floatingCandles(8, 1.8, R-1.0, seed^0x33); candles.position.y=0.4; g.add(candles);
  const light=new THREE.PointLight(0xffe0b8, 16, 14, 1.6); light.position.set(0,3.2,0.8); light.castShadow=false; g.add(light);
  g.userData.cutWalls=cut;
  const at=(a,r)=>polar(deg(a), r);
  return { shell:g, R, scope, orrery:orr, pedestal:ped, globe, candles, skyM, setSky:night=>{ skyM.map=skyTex(night); skyM.needsUpdate=true; },
    spots:{ scope:[0,0.75], orrery:at(250,3.3), pedestal:at(180,R-1.2), globe:at(215,R-1.0), desk:at(70,R-1.3), down:at(100,R-1.6) },
    downLand:at(92,R-2.2), hole:[hx,hz,1.05],
    solids:[[0,-0.5,1.2], [...at(250,3.3),0.6], [...at(180,R-1.2),0.42], [...at(215,R-1.0),0.4], [...at(290,R-1.2),0.75], [...at(70,R-0.9),0.6], [hx,hz,1.05]] };
}

/* ---------- animation, both floors ---------- */
export function tickTower(L, t, dt){
  if (L.cauldron) tickCauldron(L.cauldron, t, dt);
  if (L.candles) for (const c of L.candles.userData.list){ c.c.position.y=c.y0+Math.sin(t*0.9+c.ph)*0.08; c.f.scale.set(1+Math.sin(t*13+c.ph)*0.15, 1.8+Math.sin(t*17+c.ph)*0.3, 1); }
  if (L.owl){ const u=L.owl.userData; u.head.rotation.y=Math.sin(t*0.4)*0.9+(Math.sin(t*0.13)>0.92?Math.PI*0.9:0); u.owl.position.y=1.75+Math.abs(Math.sin(t*0.8))*0.01; }
  if (L.lectern){ const r=L.lectern.userData.rib; r.rotation.y=t*1.4; r.position.y=0.28+Math.sin(t*1.8)*0.04; }
  if (L.bowl){ const u=L.bowl.userData; u.isl.rotation.y=t*0.25; u.isl.position.y=1.0+Math.sin(t*1.2)*0.015; u.water.material.color.setHSL(0.6+Math.sin(t*0.6)*0.03, 0.5, 0.45); }
  if (L.orrery) for (const a of L.orrery.userData.arms) a.rotation.y+=dt*a.userData.sp*0.6;
  if (L.globe) L.globe.userData.ball.rotation.y+=dt*0.15;
  if (L.pedestal){ const s=L.pedestal.userData.shard; s.rotation.y=t*0.8; s.position.y=1.28+Math.sin(t*1.5)*0.03; }
  if (L.scope) L.scope.userData.head.rotation.y=Math.sin(t*0.05)*0.25;
}

/* ---------- the eyepiece: what you see through the telescope ---------- */
// st: { night, starfall, crags, charter, day (a number that changes daily), hour }
export function eyepiece(st){ const S=360, cv=canvas(S,S), x=cv.getContext('2d'), r=mulberry32((st.day|0)*31+7);
  x.fillStyle='#000'; x.fillRect(0,0,S,S); x.save(); x.beginPath(); x.arc(S/2,S/2,S/2-6,0,TAU); x.clip();
  let caption, sub;
  if (!st.night){ const gr=x.createLinearGradient(0,0,0,S); gr.addColorStop(0,'#5aa0e0'); gr.addColorStop(1,'#bfe0f6'); x.fillStyle=gr; x.fillRect(0,0,S,S);
    x.fillStyle='rgba(255,255,255,.9)'; for (let i=0;i<4;i++){ const cx=r()*S, cy=r()*S; for (let k=0;k<4;k++){ x.beginPath(); x.ellipse(cx+k*22, cy+Math.sin(k)*7, 30, 16, 0, 0, TAU); x.fill(); } }
    x.strokeStyle='#3a3a44'; x.lineWidth=3; const gx=S*0.62, gy=S*0.38; x.beginPath(); x.moveTo(gx-18,gy-6); x.quadraticCurveTo(gx-8,gy-12,gx,gy); x.quadraticCurveTo(gx+8,gy-12,gx+18,gy-6); x.stroke();
    caption='A very blue sky, a cloud, and a gull.'; sub='Stars come out after dark. Come back tonight.'; }
  else { const gr=x.createRadialGradient(S/2,S/2,10,S/2,S/2,S/2); gr.addColorStop(0,'#1c2050'); gr.addColorStop(1,'#07081a'); x.fillStyle=gr; x.fillRect(0,0,S,S);
    for (let i=0;i<240;i++){ x.fillStyle=`rgba(255,250,235,${0.25+r()*0.75})`; x.beginPath(); x.arc(r()*S, r()*S, 0.4+r()*1.4, 0, TAU); x.fill(); }
    if (st.starfall){   // Starfall Isle hanging in the sky over the Crags, with its glowing stair
      x.fillStyle='rgba(200,190,255,.25)'; x.beginPath(); x.arc(S/2,S*0.45,90,0,TAU); x.fill();
      x.fillStyle='#2a2440'; x.beginPath(); x.moveTo(S*0.28,S*0.45); x.quadraticCurveTo(S/2,S*0.34,S*0.72,S*0.45); x.lineTo(S*0.58,S*0.58); x.lineTo(S/2,S*0.7); x.lineTo(S*0.43,S*0.58); x.closePath(); x.fill();
      x.fillStyle='#3a5a4a'; x.beginPath(); x.ellipse(S/2,S*0.44,S*0.22,S*0.04,0,0,TAU); x.fill();
      for (let i=0;i<7;i++){ x.fillStyle='rgba(220,210,255,.9)'; x.beginPath(); x.arc(S*0.66+i*10, S*0.52+i*18, 4, 0, TAU); x.fill(); }
      x.fillStyle='#fff6d8'; x.beginPath(); x.arc(S/2,S*0.4,4,0,TAU); x.fill();
      caption='Starfall Isle, floating over the Crags.'; sub='The little light on top is the star altar.'; }
    else { const C=CONSTEL[(st.day|0)%CONSTEL.length], [nm,pts]=C, xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]), mx=(Math.min(...xs)+Math.max(...xs))/2, my=(Math.min(...ys)+Math.max(...ys))/2, sc=S*0.55/Math.max(0.2, Math.max(...xs)-Math.min(...xs), Math.max(...ys)-Math.min(...ys));
      x.strokeStyle='rgba(232,200,104,.55)'; x.lineWidth=2; x.beginPath(); pts.forEach(([u,v],i)=>{ const px=S/2+(u-mx)*sc, py=S/2+(v-my)*sc; i?x.lineTo(px,py):x.moveTo(px,py); }); x.stroke();
      x.fillStyle='#fff6d8'; for (const [u,v] of pts){ x.beginPath(); x.arc(S/2+(u-mx)*sc, S/2+(v-my)*sc, 4, 0, TAU); x.fill(); }
      caption=`${nm}, tonight.`; sub = st.charter ? 'Wendell keeps looking just to the left of it. There is nothing there. Yet.' : 'Wendell has drawn this one on his chart downstairs.'; }
    if (r()<0.5){ x.fillStyle='#f4f0e0'; x.beginPath(); x.arc(S*0.18,S*0.2,20,0,TAU); x.fill(); x.fillStyle='#07081a'; x.beginPath(); x.arc(S*0.18+9,S*0.2-4,18,0,TAU); x.fill(); } }
  x.restore(); x.strokeStyle='#5a4a32'; x.lineWidth=12; x.beginPath(); x.arc(S/2,S/2,S/2-6,0,TAU); x.stroke();
  return { src:cv.toDataURL('image/png'), caption, sub }; }

/* ---------- the words ---------- */
// first time inside (after you've met him); and a line now and then when you walk in
export const TOWER_LINES = {
  first:['Come in, come in. Mind the step. And the cauldron.','Yes, it\'s roomier in here than it looks from outside. Don\'t think about it too hard, it gives the walls ideas.','Potions are in the pot, books are on the shelves, and the stars are upstairs. Help yourself to all three.'],
  hello:['Shut the door, there\'s a draught. The candles hate a draught.','Ah, it\'s you. Sit anywhere that isn\'t smouldering.','The kettle\'s on. It has been on since about 1740.','Hoot says hello. Hoot is the owl. He doesn\'t, really.'],
  owl:['Hoot blinks at you. Slowly. One eye, then the other.','Hoot turns his head all the way round to look at the shelves instead.','Hoot fluffs up to twice his size, then thinks better of it.','"Hoo." Just the one.'],
  chair:['A deep, saggy armchair with a star blanket. The tea beside it is still warm, somehow.','You sit for a moment. The candles drift. The cauldron burbles. Nice, this.'],
  orrery:['A brass orrery. Four little worlds go round a glowing sun, and one of them has a ring.','Wendell has scratched a tiny goat into the biggest planet.'],
  globe:['A globe of the night sky. Someone has drawn a small question mark in gold, just off the Heron.','The globe turns a little on its own whenever you aren\'t looking straight at it.'],
  desk:['A star atlas open on the desk. The margins are full of notes: "Cloudy." "Cloudy." "Goat, very clear tonight."'],
};
// the bookshelves: pick one at random. {move} and {land} get the island's own state filled in by main.js
export const BOOKS = [
  ['Moving Houses Without Upsetting Them', '{move}'],
  ['A Gentle Introduction to Shaping Land', '{land}'],
  ['Luck, and How to Bottle It', 'Each potion lasts 10 minutes. Wendell has underlined "drink it BEFORE you cast, not after" three times.'],
  ['The Sunken Isles: A Rumour', 'Most of the pages are blank. One just says "ask the relics, they remember".'],
  ['Enchanting for the Absent-Minded', 'Chapter one: "Which tool did I enchant?" Chapter two: "Oh. That one."'],
  ['Owls: A Field Guide', 'Somebody has written "HOOT IS NOT IN THIS BOOK. HOOT IS UNIQUE" on the first page.'],
  ['Wizarding Through the Ages, Volume 9', 'Volumes 1 to 8 are missing. Volume 9 is mostly about hats.'],
  ['Cauldron Care', '"Stir clockwise for luck. Stir anticlockwise for soup. Never stir with your hand."'],
  ['Stars of the Southern Sea', 'A pressed starfish marks the page. You think you know the wish it came from.'],
];
