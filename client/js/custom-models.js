/* =====================================================================
   v1.41 CUSTOM FURNITURE: 3D parts. buildCustom(g, id) puts the piece described by a cf_ id into g.
   Each base has one builder per slot option, in the same order as custom-core.js. Every piece faces +z.
   Parts share a little context (ctx): the materials and where the last part left off (seat top, back posts...),
   so any leg goes with any back.
   ===================================================================== */
import * as THREE from 'three';
import { TAU, mulberry32, hashStr } from './util.js';
import { mk, G, addGlow, glowMat, ITEM_BUILDERS } from './models.js';
import { woodMat, brass } from './look.js';
import { BASES, WOODS, METALS, FABRICS, PATTERNS, decode, glows } from './custom-core.js';

const cache = new Map();
const once = (k, fn) => { if (!cache.has(k)) cache.set(k, fn()); return cache.get(k); };
const col = c => new THREE.Color(c);
const hex = c => '#'+col(c).getHexString();
function canvas(w, h, draw){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'), w, h); return cv; }
function tex(cv, rx=1, ry=1){ const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); t.anisotropy=4; return t; }

/* ---------- materials ---------- */
export const woodOf = i => { const W=WOODS[i]; return W.paint
  ? once('paint:'+i, ()=>new THREE.MeshPhysicalMaterial({ color:W.c, roughness:0.62, clearcoat:0.35, clearcoatRoughness:0.5 }))
  : woodMat(W.c); };
export const metalOf = i => i===1 ? brass() : once('metal:'+i, ()=>new THREE.MeshPhysicalMaterial({ color:METALS[i].c, metalness:i===0?0.55:0.9, roughness:i===0?0.5:0.3, clearcoat:0.4 }));
const PAT_DRAW = {
  0(){}, 1(x,W,H,c2){ x.fillStyle=c2; x.globalAlpha=0.42; for (let i=0;i<8;i++){ x.fillRect(i*16,0,8,H); x.fillRect(0,i*16,W,8); } x.globalAlpha=1; },
  2(x,W,H,c2){ x.fillStyle=c2; for (let i=0;i<W;i+=22){ x.fillRect(i,0,7,H); x.globalAlpha=0.5; x.fillRect(i+11,0,2,H); x.globalAlpha=1; } },
  3(x,W,H,c2,r){ for (let i=0;i<14;i++){ const px=r()*W, py=r()*H; x.fillStyle='#6a9a5a'; x.beginPath(); x.ellipse(px+7,py+2,5,2.4,0.6,0,TAU); x.fill(); x.fillStyle=c2; for (let k=0;k<5;k++){ x.beginPath(); x.arc(px+Math.cos(k*1.26)*4.5,py+Math.sin(k*1.26)*4.5,3.4,0,TAU); x.fill(); } x.fillStyle='#f8d860'; x.beginPath(); x.arc(px,py,2.2,0,TAU); x.fill(); } },
  4(x,W,H,c2){ x.strokeStyle=c2; x.fillStyle=c2; x.lineWidth=2; x.globalAlpha=0.55; for (let i=0;i<2;i++) for (let j=0;j<2;j++){ const cx=32+i*64, cy=32+j*64; x.beginPath(); x.ellipse(cx,cy,18,26,0,0,TAU); x.stroke(); x.beginPath(); x.ellipse(cx,cy,7,12,0,0,TAU); x.fill();
    for (const s of [-1,1]){ x.beginPath(); x.moveTo(cx,cy-26); x.quadraticCurveTo(cx+s*30,cy-30,cx+s*26,cy); x.quadraticCurveTo(cx+s*30,cy+30,cx,cy+26); x.stroke(); } } x.globalAlpha=1; },
  5(x,W,H,c2,r){ const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,'rgba(255,255,255,0.12)'); g.addColorStop(0.5,'rgba(0,0,0,0.12)'); g.addColorStop(1,'rgba(255,255,255,0.1)'); x.fillStyle=g; x.fillRect(0,0,W,H); },
  6(x,W,H,c2,r,c){ const pal=[c, c2, hex(col(c).offsetHSL(0.07,0,0.12)), hex(col(c2).offsetHSL(-0.05,0,-0.08))]; for (let i=0;i<4;i++) for (let j=0;j<4;j++){ x.fillStyle=pal[Math.floor(r()*4)]; x.fillRect(i*32,j*32,32,32); x.strokeStyle='rgba(255,255,255,.65)'; x.setLineDash([3,3]); x.strokeRect(i*32+3,j*32+3,26,26); x.setLineDash([]); } },
  7(x,W,H,c2,r){ x.fillStyle=c2; x.globalAlpha=0.6; for (let i=0;i<16;i++){ const px=r()*W, py=r()*H, a=r()*TAU; x.save(); x.translate(px,py); x.rotate(a); x.beginPath(); x.ellipse(0,0,9,3.6,0,0,TAU); x.fill(); x.restore(); } x.globalAlpha=1; },
  8(x,W,H,c2,r){ x.fillStyle=c2; for (let i=0;i<12;i++){ const px=r()*W, py=r()*H, s=2+r()*3.5; x.beginPath(); for (let k=0;k<10;k++){ const a=k/10*TAU-Math.PI/2, rr=k%2?s*0.45:s; x.lineTo(px+Math.cos(a)*rr, py+Math.sin(a)*rr); } x.fill(); } },
};
export function fabricOf(fi, pi, dark=0){ return once(`fab:${fi}:${pi}:${dark}`, ()=>{
  const c=hex(col(FABRICS[fi].c).offsetHSL(0,0,-dark)), base=col(FABRICS[fi].c), c2=hex(base.getHSL({}).l>0.6 ? base.clone().offsetHSL(0,-0.1,-0.35) : base.clone().lerp(col(0xfff6e8),0.62));
  const cv=canvas(128,128,(x,W,H)=>{ x.fillStyle=c; x.fillRect(0,0,W,H); const r=mulberry32(fi*31+pi); PAT_DRAW[pi](x,W,H,c2,r,c);
    for (let i=0;i<1400;i++){ x.fillStyle=`rgba(${r()<0.5?0:255},${r()<0.5?0:255},255,0.035)`; x.fillRect(r()*W,r()*H,1,2); } });
  const vel=pi===5; return new THREE.MeshPhysicalMaterial({ map:tex(cv,2,2), roughness:vel?0.55:0.92, sheen:vel?1:0.55, sheenRoughness:vel?0.3:0.8, sheenColor:base.clone().lerp(col(0xffffff),0.45) }); }); }
const plain = (c, o={}) => once('pl:'+c+JSON.stringify(o), ()=>new THREE.MeshPhysicalMaterial({ color:c, roughness:0.75, ...o }));
const RUSH = () => once('rush', ()=>{ const cv=canvas(128,128,(x,W,H)=>{ x.fillStyle='#c9ac68'; x.fillRect(0,0,W,H); for (let i=0;i<W;i+=8){ x.strokeStyle=i%16?'#b8964e':'#dcc07a'; x.lineWidth=5; x.beginPath(); x.moveTo(i,0); x.lineTo(i+H,H); x.stroke(); x.beginPath(); x.moveTo(i,H); x.lineTo(i+H,0); x.stroke(); } });
  return new THREE.MeshStandardMaterial({ map:tex(cv,2,2), roughness:0.95 }); });
const BARK = () => once('bark', ()=>woodMat(0x6a5038, { roughness:0.95 }));
const LEAF = () => plain(0x5f9a4a, { roughness:0.6, side:THREE.DoubleSide });
const MOSS = () => plain(0x6f9a3e, { roughness:1 });
const GLOW = c => once('glow:'+c, ()=>glowMat(c));
const lathe = (pts, seg=20) => new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)), seg);
const tube = (pts, r, seg=24, rs=8) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))), seg, r, rs, false);
// a rounded slab: w wide, d deep, h thick, with soft edges (y = its bottom)
function slab(w, d, h, rad=0.03){ const s=new THREE.Shape(), x=w/2-rad, z=d/2-rad;
  s.moveTo(-x,-d/2); s.lineTo(x,-d/2); s.quadraticCurveTo(w/2,-d/2,w/2,-z); s.lineTo(w/2,z); s.quadraticCurveTo(w/2,d/2,x,d/2); s.lineTo(-x,d/2); s.quadraticCurveTo(-w/2,d/2,-w/2,z); s.lineTo(-w/2,-z); s.quadraticCurveTo(-w/2,-d/2,-x,-d/2);
  const b=Math.min(rad, h/2.2), geo=new THREE.ExtrudeGeometry(s,{ depth:h-b*2, bevelEnabled:true, bevelThickness:b, bevelSize:b*0.9, bevelSegments:2, curveSegments:6 });
  geo.rotateX(Math.PI/2); geo.translate(0,h-b,0); return geo; }
// a flat cut-out shape (back splats, headboards), thickness t, centered on x, standing on y=0, facing +z
function cut(shape, t){ const geo=new THREE.ExtrudeGeometry(shape,{ depth:t, bevelEnabled:true, bevelThickness:0.006, bevelSize:0.006, bevelSegments:1, curveSegments:10 }); geo.translate(0,0,-t/2); return geo; }
const pillow = (w,h,d,mat,x,y,z,g) => { const p=mk(G.sph(0.5,18,12), mat, x,y,z,g); p.scale.set(w,h,d); return p; };
function moss(g, x, y, z, w, d, r){ mk(slab(w,d,0.025,0.012), MOSS(), x,y,z,g); for (let i=0;i<Math.round(w*d*260)+6;i++){ const s=0.012+r()*0.018; mk(G.sph(s,6,5), i%3?MOSS():plain(0x8ab04e,{roughness:1}), x+(r()-0.5)*w*0.95, y+0.02+s*0.3, z+(r()-0.5)*d*0.95, g); } }
// a straight round bar between two points
function bar(g, mat, a, b, r){ const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), L=A.distanceTo(B); const m=mk(G.cyl(r,r,L,8), mat, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2, g); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), B.clone().sub(A).normalize()); return m; }
// a diagonal lattice of bars clipped to a rectangle in the x/y plane at depth z
function lattice(g, mat, x0, x1, y0, y1, z, step, r){
  for (const sgn of [1,-1]) for (let k=-(y1-y0)-(x1-x0); k<=(x1-x0)+(y1-y0); k+=step){
    // line: y - y0 = sgn*(x - x0) + k; clip to the box
    const pts=[]; const yAt=x=>y0+sgn*(x-x0)+k, xAt=y=>x0+(y-y0-k)*sgn;
    for (const x of [x0,x1]){ const y=yAt(x); if (y>=y0-1e-6 && y<=y1+1e-6) pts.push([x,y]); }
    for (const y of [y0,y1]){ const x=xAt(y); if (x>=x0-1e-6 && x<=x1+1e-6) pts.push([x,y]); }
    if (pts.length<2) continue; pts.sort((a,b)=>a[0]-b[0]); const [a,b]=[pts[0],pts[pts.length-1]]; if (Math.hypot(b[0]-a[0],b[1]-a[1])<0.03) continue;
    bar(g, mat, [a[0],a[1],z+(sgn>0?0.004:-0.004)], [b[0],b[1],z+(sgn>0?0.004:-0.004)], r); } }

/* =====================================================================
   CHAIR. Seat at about 0.47; legs inset 0.05 from the seat corners.
   ===================================================================== */
const SW=0.56, SD=0.52, SH=0.44;
const chairLegPts = () => [[-SW/2+0.06,-SD/2+0.06],[SW/2-0.06,-SD/2+0.06],[-SW/2+0.06,SD/2-0.06],[SW/2-0.06,SD/2-0.06]];
function stretchers(c, y, r=0.014){ const g=c.g, P=chairLegPts(); for (const [a,b] of [[0,2],[1,3],[2,3]]){ const [x0,z0]=P[a], [x1,z1]=P[b]; const m=mk(G.cyl(r,r,Math.hypot(x1-x0,z1-z0),6), c.W, (x0+x1)/2, y, (z0+z1)/2, g); if (x0===x1) m.rotation.x=Math.PI/2; else m.rotation.z=Math.PI/2; } }
const CHAIR = {
  legs:[
    c=>{ for (const [x,z] of chairLegPts()) mk(G.box(0.05,SH,0.05), c.W, x,SH/2,z,c.g); stretchers(c, 0.14); },
    c=>{ for (const [x,z] of chairLegPts()) mk(G.cyl(0.026,0.014,SH,10), c.W, x,SH/2,z,c.g); },
    c=>{ const geo=lathe([[0.001,0],[0.018,0],[0.022,0.04],[0.016,0.08],[0.03,0.15],[0.018,0.22],[0.026,0.3],[0.02,0.36],[0.028,0.4],[0.028,SH],[0.001,SH]]);
      for (const [x,z] of chairLegPts()) mk(geo, c.W, x,0,z,c.g); stretchers(c, 0.15, 0.012); },
    c=>{ for (const [x,z] of chairLegPts()){ const sx=Math.sign(x)*0.05, sz=Math.sign(z)*0.05; mk(tube([[x,SH,z],[x-sx*0.3,SH*0.72,z-sz*0.3],[x+sx*0.4,SH*0.25,z+sz*0.4],[x+sx*0.7,0.04,z+sz*0.7]], 0.024, 20), c.W, 0,0,0,c.g); mk(G.sph(0.03,10,8), c.W, x+sx*0.75,0.025,z+sz*0.75,c.g).scale.y=0.6; } },
    c=>{ for (const [x,z] of chairLegPts()){ const l=mk(G.cyl(0.055,0.065,SH,9), BARK(), x*0.95,SH/2,z*0.95,c.g); l.rotation.y=c.r()*TAU; mk(G.cyl(0.05,0.05,0.008,9), c.W, x*0.95,SH,z*0.95,c.g); } },
    c=>{ for (const [x,z] of chairLegPts()){ const l=mk(G.cyl(0.018,0.022,SH+0.03,8), c.W, x*1.1,SH/2,z*1.1,c.g); l.rotation.z=-Math.sign(x)*0.12; l.rotation.x=Math.sign(z)*0.12; } const h=mk(G.cyl(0.012,0.012,SW*0.9,6), c.W, 0,0.16,0,c.g); h.rotation.z=Math.PI/2; },
    c=>{ for (const [x,z] of chairLegPts()){ const sx=Math.sign(x); mk(tube([[x-sx*0.05,SH,z],[x,0.01,z],[x-sx*0.08,SH,z+Math.sign(z)*0.01]], 0.007, 16, 5), c.MT, 0,0,0,c.g); } },
    c=>{ for (const s of [-1,1]){ const x=s*(SW/2-0.05); bar(c.g, c.MT, [x,SH,-SD/2+0.05],[x,0.015,-SD/2+0.02], 0.012); bar(c.g, c.MT, [x,0.015,-SD/2+0.02],[x,0.015,SD/2-0.02], 0.012); bar(c.g, c.MT, [x,0.015,SD/2-0.02],[x,SH,SD/2-0.05], 0.012); } bar(c.g, c.MT, [-SW/2+0.05,SH-0.02,-SD/2+0.05],[SW/2-0.05,SH-0.02,-SD/2+0.05], 0.01); },
    c=>{ for (const [x,z] of chairLegPts()){ const w=(c.r()-0.5)*0.05; mk(tube([[x,SH,z],[x+w,SH*0.6,z-w],[x-w,SH*0.3,z+w*0.5],[x+w*0.5,0,z]], 0.016, 14, 6), BARK(), 0,0,0,c.g); mk(G.cone(0.008,0.05,5), BARK(), x+0.02,SH*0.5,z,c.g).rotation.z=-1; } },
    c=>{ CHAIR.legs[3](c); for (const [x,z] of chairLegPts()){ const sx=Math.sign(x)*0.05, sz=Math.sign(z)*0.05; mk(G.sph(0.034,12,10), c.MT, x+sx*0.75,0.034,z+sz*0.75,c.g); for (let k=0;k<3;k++){ const t=mk(G.cone(0.012,0.05,6), c.MT, x+sx*0.75+(k-1)*0.022,0.03,z+sz*0.75+0.02,c.g); t.rotation.x=1.3; } } },
    c=>{ for (const [x,z] of chairLegPts()) mk(G.cyl(0.022,0.022,SH-0.08,8), c.W, x,SH/2+0.04,z,c.g);
      for (const s of [-1,1]){ const r=mk(G.tor(0.9,0.022,6,40,0.62), c.W2, s*(SW/2-0.06),0.95,0,c.g); r.rotation.y=Math.PI/2; r.rotation.z=-Math.PI/2-0.31; } c.rock=true; } ],
  seat:[
    c=>{ mk(slab(SW,SD,0.05), c.W2, 0,SH,0,c.g); c.top=SH+0.05; },
    c=>{ mk(slab(SW,SD,0.035,0.012), c.W, 0,SH,0,c.g); mk(G.box(SW-0.06,0.03,SD-0.06), RUSH(), 0,SH+0.03,0,c.g); c.top=SH+0.05; },
    c=>{ mk(slab(SW,SD,0.04), c.W2, 0,SH,0,c.g); const p=pillow(SW*0.95,0.09,SD*0.95, c.F, 0,SH+0.08,0.01,c.g); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.sph(0.012,6,5), c.F2, x*0.06,SH+0.125,z*0.06,c.g); c.top=SH+0.11; },
    c=>{ const geo=slab(SW,SD,0.06,0.05); const m=mk(geo, c.W2, 0,SH,0,c.g); mk(G.cyl(0.2,0.2,0.012,24), c.W2, 0,SH+0.058,0.02,c.g).scale.set(1.15,1,1); c.top=SH+0.06; },
    c=>{ mk(slab(SW,SD,0.035), c.W2, 0,SH,0,c.g); mk(slab(SW-0.03,SD-0.03,0.08,0.04), c.F, 0,SH+0.03,0,c.g); for (let i=0;i<10;i++){ const a=i/10*TAU; mk(G.sph(0.008,6,5), c.MT, Math.cos(a)*0.001+(i<5?(i-2)*0.11:(i-7)*0.11), SH+0.07, i<5?SD/2-0.012:-SD/2+0.012, c.g); } c.top=SH+0.11; },
    c=>{ const s=new THREE.Shape(), n=18; for (let i=0;i<=n;i++){ const a=i/n*TAU, rr=1+(c.r()-0.5)*0.12; const x=Math.cos(a)*SW*0.56*rr, z=Math.sin(a)*SD*0.56*rr; i?s.lineTo(x,z):s.moveTo(x,z); }
      const geo=new THREE.ExtrudeGeometry(s,{ depth:0.06, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1 }); geo.rotateX(Math.PI/2); geo.translate(0,SH+0.06,0); mk(geo, c.W2, 0,0,0,c.g);
      const rim=mk(G.tor(SW*0.5,0.012,5,30), BARK(), 0,SH+0.035,0,c.g); rim.rotation.x=Math.PI/2; rim.scale.y=SD/SW; c.top=SH+0.07; },
    c=>{ mk(slab(SW,SD,0.05), c.W2, 0,SH,0,c.g); moss(c.g, 0, SH+0.05, 0, SW*0.85, SD*0.85, c.r); for (let i=0;i<5;i++) mk(G.sph(0.008,6,4), GLOW(0xd8ff9a), (c.r()-0.5)*0.4, SH+0.1, (c.r()-0.5)*0.4, c.g); c.top=SH+0.09; } ],
  back:[
    c=>{ c.post(0.62); for (let i=0;i<3;i++){ const y=c.top+0.2+i*0.14; const s=mk(G.box(SW-0.1,0.05,0.018), c.W, 0,y,-SD/2+0.035,c.g); s.rotation.x=0.04; } },
    c=>{ c.post(0.6); mk(G.box(SW-0.06,0.06,0.03), c.W, 0,c.top+0.6,-SD/2+0.035,c.g); for (let i=0;i<5;i++) mk(G.cyl(0.011,0.011,0.56,6), c.W, -0.16+i*0.08, c.top+0.3,-SD/2+0.035,c.g); },
    c=>{ c.post(0.62); const s=new THREE.Shape(); s.moveTo(-0.05,0); s.bezierCurveTo(-0.13,0.15,-0.02,0.25,-0.09,0.42); s.bezierCurveTo(-0.11,0.5,0.11,0.5,0.09,0.42); s.bezierCurveTo(0.02,0.25,0.13,0.15,0.05,0); s.lineTo(-0.05,0);
      mk(cut(s,0.022), c.W, 0,c.top+0.02,-SD/2+0.035,c.g); const cr=mk(tube([[-SW/2+0.04,c.top+0.6,-SD/2+0.035],[0,c.top+0.66,-SD/2+0.03],[SW/2-0.04,c.top+0.6,-SD/2+0.035]],0.026,14,6), c.W, 0,0,0,c.g); },
    c=>{ const s=new THREE.Shape(); const w=SW/2-0.02; s.moveTo(-w,0); s.lineTo(w,0); s.lineTo(w,0.5); s.quadraticCurveTo(w,0.62,w-0.1,0.62); s.lineTo(-w+0.1,0.62); s.quadraticCurveTo(-w,0.62,-w,0.5); s.lineTo(-w,0);
      const h=new THREE.Path(); h.moveTo(0,0.2); h.bezierCurveTo(-0.02,0.24,-0.12,0.28,-0.1,0.38); h.bezierCurveTo(-0.08,0.46,0,0.44,0,0.4); h.bezierCurveTo(0,0.44,0.08,0.46,0.1,0.38); h.bezierCurveTo(0.12,0.28,0.02,0.24,0,0.2); s.holes.push(h);
      mk(cut(s,0.03), c.W, 0,c.top,-SD/2+0.035,c.g); c.postTops(c.top+0.62); },
    c=>{ c.post(0.66); const f=mk(G.tor(0.17,0.022,8,32), c.W, 0,c.top+0.36,-SD/2+0.04,c.g); f.scale.set(1,1.35,1); const p=mk(G.sph(0.17,18,12), c.F, 0,c.top+0.36,-SD/2+0.045,c.g); p.scale.set(0.92,1.25,0.22);
      mk(G.box(0.05,0.12,0.03), c.W, 0,c.top+0.06,-SD/2+0.035,c.g); },
    c=>{ const s=new THREE.Shape(), w=SW/2-0.02; s.moveTo(-0.06,0); s.lineTo(0.06,0); s.quadraticCurveTo(w,0.2,w,0.58); s.quadraticCurveTo(0,0.7,-w,0.58); s.quadraticCurveTo(-w,0.2,-0.06,0);
      const s2=new THREE.Shape(); const iw=w-0.05; s2.moveTo(-0.03,0.07); s2.lineTo(0.03,0.07); s2.quadraticCurveTo(iw,0.22,iw,0.54); s2.quadraticCurveTo(0,0.63,-iw,0.54); s2.quadraticCurveTo(-iw,0.22,-0.03,0.07); s.holes.push(s2);
      mk(cut(s,0.03), c.W, 0,c.top,-SD/2+0.035,c.g); for (const x of [-0.07,0,0.07]) mk(G.box(0.025,0.5,0.015), c.W, x,c.top+0.32,-SD/2+0.035,c.g); for (const x of [-SW/2+0.04, SW/2-0.04]) mk(G.box(0.04,0.08,0.04), c.W, x,c.top+0.04,-SD/2+0.06,c.g); c.postTops(c.top+0.6); },
    c=>{ const R=0.42, a0=Math.PI*0.5-0.62, a1=Math.PI*0.5+0.62, s=new THREE.Shape(); s.absarc(0,0,R,a0,a1,false); s.absarc(0,0,R-0.03,a1,a0,true); const geo=new THREE.ExtrudeGeometry(s,{ depth:0.15, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:2, curveSegments:24 }); geo.rotateX(Math.PI/2); geo.translate(0,c.top+0.33,R-SD/2-0.02); geo.scale(1,1,-1); mk(geo, c.W, 0,0,0,c.g); for (const x of [-0.16,0.16]) mk(G.cyl(0.014,0.014,0.2,6), c.MT, x,c.top+0.1,-SD/2+0.03,c.g); c.postTops(c.top+0.33, true); },
    c=>{ c.post(0.72, 0.035); for (let i=0;i<4;i++) mk(G.box(0.07,0.66,0.016), c.W, -0.15+i*0.1,c.top+0.36,-SD/2+0.035,c.g); mk(G.box(SW-0.04,0.05,0.03), c.W, 0,c.top+0.72,-SD/2+0.035,c.g); },
    c=>{ for (const s of [-1,1]) mk(tube([[s*(SW/2-0.05),c.top-0.02,-SD/2+0.04],[s*(SW/2-0.02),c.top+0.35,-SD/2+0.02],[s*(SW/2-0.06),c.top+0.7,-SD/2]], 0.03, 14, 7), BARK(), 0,0,0,c.g);
      for (const [y0,y1] of [[0.25,0.45],[0.5,0.3]]) mk(tube([[-SW/2+0.05,c.top+y0,-SD/2+0.03],[0,c.top+(y0+y1)/2+0.03,-SD/2+0.03],[SW/2-0.05,c.top+y1,-SD/2+0.03]], 0.018, 12, 6), BARK(), 0,0,0,c.g); c.postTops(c.top+0.7); },
    c=>{ c.post(0.64, 0.022, BARK()); lattice(c.g, BARK(), -SW/2+0.05, SW/2-0.05, c.top+0.04, c.top+0.62, -SD/2+0.035, 0.09, 0.008); bar(c.g, BARK(), [-SW/2+0.04,c.top+0.63,-SD/2+0.035],[SW/2-0.04,c.top+0.63,-SD/2+0.035], 0.016);
      for (let i=0;i<6;i++) mk(G.sph(0.022,6,4), LEAF(), (c.r()-0.5)*0.38, c.top+0.1+c.r()*0.5, -SD/2+0.05, c.g).scale.set(1.4,0.5,0.6); },
    c=>{ mk(slab(SW+0.06,0.14,0.78,0.06), c.F, 0,c.top-0.02,-SD/2+0.02,c.g);
      for (const s of [-1,1]){ const w=mk(G.sph(0.5,16,12), c.F, s*(SW/2+0.01),c.top+0.42,-SD/2+0.16,c.g); w.scale.set(0.1,0.62,0.34); }
      mk(G.box(SW+0.06,0.05,0.05), c.F2, 0,c.top+0.8,-SD/2+0.02,c.g).scale.y=0.8; c.postTops(c.top+0.8, true); },
    c=>{ c.post(0.6); const s=new THREE.Shape(); s.moveTo(0,0); s.bezierCurveTo(-0.24,0.12,-0.22,0.46,0,0.62); s.bezierCurveTo(0.22,0.46,0.24,0.12,0,0);
      mk(cut(s,0.025), c.W, 0,c.top+0.02,-SD/2+0.035,c.g); mk(G.box(0.012,0.56,0.012), c.W2, 0,c.top+0.31,-SD/2+0.05,c.g);
      for (let i=1;i<5;i++) for (const sd of [-1,1]){ const v=mk(G.box(0.008,0.12,0.008), c.W2, sd*0.05,c.top+0.06+i*0.11,-SD/2+0.05,c.g); v.rotation.z=sd*0.9; } } ],
  arms:[
    c=>{},
    c=>{ for (const s of [-1,1]){ const x=s*(SW/2-0.02); mk(G.box(0.06,0.03,SD-0.02), c.W, x,c.top+0.22,0,c.g); mk(G.box(0.035,0.22,0.035), c.W, x,c.top+0.11,SD/2-0.06,c.g); } },
    c=>{ for (const s of [-1,1]){ const x=s*(SW/2-0.01); mk(tube([[x,c.top+0.3,-SD/2+0.04],[x+s*0.02,c.top+0.24,0],[x+s*0.03,c.top+0.22,SD/2-0.02],[x,c.top,SD/2-0.06]],0.02,20,7), c.W, 0,0,0,c.g); mk(G.sph(0.03,10,8), c.W, x+s*0.03,c.top+0.22,SD/2-0.01,c.g); } },
    c=>{ for (const s of [-1,1]){ const a=mk(G.cap(0.075,SD-0.1,8,14), c.F, s*(SW/2+0.02),c.top+0.17,0.01,c.g); a.rotation.x=Math.PI/2; mk(G.box(0.1,0.17,SD-0.04), c.F, s*(SW/2+0.02),c.top+0.06,0,c.g); } },
    c=>{ for (const s of [-1,1]){ const x=s*(SW/2-0.02); mk(tube([[x,c.top+0.32,-SD/2+0.04],[x+s*0.03,c.top+0.22,-0.05],[x,c.top+0.24,SD/2-0.02],[x+s*0.01,c.top-0.03,SD/2-0.06]],0.022,20,6), BARK(), 0,0,0,c.g); } } ],
  trim:[
    c=>{},
    c=>{ for (const p of c.tops) mk(G.sph(0.034,12,10), c.W2, p[0],p[1]+0.03,p[2],c.g); },
    c=>{ const y=c.crest; const s=new THREE.Shape(); s.moveTo(-0.16,0); s.bezierCurveTo(-0.12,0.08,-0.04,0.02,0,0.1); s.bezierCurveTo(0.04,0.02,0.12,0.08,0.16,0); s.lineTo(-0.16,0);
      mk(cut(s,0.02), c.W2, 0,y,-SD/2+0.035,c.g); mk(G.sph(0.022,10,8), c.W2, 0,y+0.11,-SD/2+0.035,c.g); },
    c=>{ for (const p of c.tops){ const k=mk(G.sph(0.022,10,8), c.F, p[0],p[1]-0.06,p[2]+0.02,c.g); for (const s of [-1,1]){ const l=mk(G.sph(0.03,10,8), c.F, p[0]+s*0.03,p[1]-0.06,p[2]+0.02,c.g); l.scale.set(1,0.55,0.4); const t=mk(G.box(0.012,0.07,0.004), c.F, p[0]+s*0.012,p[1]-0.1,p[2]+0.025,c.g); t.rotation.z=s*0.3; } } },
    c=>{ for (const p of c.tops){ const cap=mk(G.sph(0.05,14,8,0,TAU,0,Math.PI/2), plain(0xc8403a,{roughness:0.5,clearcoat:0.6}), p[0],p[1]+0.01,p[2],c.g); cap.scale.y=0.7;
      for (let i=0;i<4;i++){ const a=i/4*TAU+0.4; mk(G.sph(0.009,6,4), plain(0xfff6e8), p[0]+Math.cos(a)*0.03,p[1]+0.035,p[2]+Math.sin(a)*0.03,c.g); } } },
    c=>{ for (let i=0;i<9;i++) mk(G.sph(0.011,8,6), c.MT, -SW/2+0.04+i*(SW-0.08)/8, c.top-0.025, SD/2+0.002, c.g); for (const p of c.tops) mk(G.sph(0.016,8,6), c.MT, p[0],p[1]-0.03,p[2]+0.022,c.g); },
    c=>{ const y=c.crest-0.04; for (let i=-2;i<=2;i++){ const st=mk(G.oct ? G.oct(0.02) : new THREE.OctahedronGeometry(0.022), GLOW(0xa8c8ff), i*0.06,y-Math.abs(i)*0.02,-SD/2+0.055,c.g); st.rotation.y=0.6; } c.gl=true; },
    c=>{ for (const p of c.tops){ mk(G.cone(0.024,0.04,10), c.MT, p[0],p[1]+0.01,p[2],c.g).rotation.x=Math.PI; mk(G.sph(0.03,14,12), plain(0xf6f0ff,{ roughness:0.15, clearcoat:1, sheen:1, sheenColor:col(0xd8c8ff) }), p[0],p[1]+0.05,p[2],c.g); } } ],
};
function chair(c){
  const g=c.g;
  // rear posts from the floor (behind the seat) up to the back's height
  c.post = (h, t=0.03, mat) => { const y=c.top+h; for (const s of [-1,1]){ const x=s*(SW/2-0.04); mk(G.box(t,h+0.04,t), mat||c.W, x,c.top+h/2-0.02,-SD/2+0.035,g); } c.postTops(y); };
  c.postTops = (y, low) => { c.tops=[[-SW/2+0.04,y,-SD/2+0.035],[SW/2-0.04,y,-SD/2+0.035]]; c.crest=y; c.low=!!low; };
  c.tops=[]; c.crest=SH+0.6;
  const P=c.d.parts;
  CHAIR.legs[P.legs](c); CHAIR.seat[P.seat](c); CHAIR.back[P.back](c); CHAIR.arms[P.arms](c); CHAIR.trim[P.trim](c);
  if (c.rock) g.position.y+=0;
}

/* ---------- not built yet: a simple stand-in so nothing breaks ---------- */
function standIn(c){ const B=BASES[c.d.base]; mk(slab(B.r*1.2,B.r*1.0,0.6), c.W, 0,0,0,c.g); }
const BUILD = { chair, table:standIn, bed:standIn, shelf:standIn, lamp:standIn, dresser:standIn };

export function buildCustom(g, id){
  const d=decode(id); if (!d){ mk(G.box(0.5,0.5,0.5), plain(0xcccccc), 0,0.25,0,g); return g; }
  const c={ g, d, r:mulberry32(hashStr(id)), W:woodOf(d.w), W2:woodOf(d.w2), MT:metalOf(d.m), F:fabricOf(d.f,d.p), F2:fabricOf(d.f,0,0.12), top:0 };
  BUILD[d.base](c);
  if (glows(d)) addGlow(g, d.base==='lamp' ? (c.lightY||1.3) : (c.lightY||0.8), d.base==='lamp'?2.6:1.2, 0xffd890);
  g.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
ITEM_BUILDERS.custom = (g, d, id) => buildCustom(g, id || d.code);
