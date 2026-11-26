/* =====================================================================
   v1.63 CUSTOM FURNITURE: 3D parts. buildCustom(g, id) puts the piece described by a cf_ id into g.
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
const CYL = (a, b, h, s=12, ...rest) => new THREE.CylinderGeometry(a, b, h, s, ...rest);
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
function moss(g, x, y, z, w, d, r, round){ if (!round) mk(slab(w,d,0.025,0.012), MOSS(), x,y,z,g); for (let i=0;i<Math.round(w*d*260)+6;i++){ const s=0.012+r()*0.018; mk(G.sph(s,6,5), i%3?MOSS():plain(0x8ab04e,{roughness:1}), x+(round?Math.cos(i*2.4)*Math.sqrt((i%17)/17)*w*0.5:(r()-0.5)*w*0.95), y+0.02+s*0.3, z+(round?Math.sin(i*2.4)*Math.sqrt((i%17)/17)*d*0.5:(r()-0.5)*d*0.95), g); } }
// a straight round bar between two points
function bar(g, mat, a, b, r){ const A=new THREE.Vector3(...a), B=new THREE.Vector3(...b), L=A.distanceTo(B); const m=mk(CYL(r,r,L,8), mat, (a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2, g); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), B.clone().sub(A).normalize()); return m; }
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
function stretchers(c, y, r=0.014){ const g=c.g, P=chairLegPts(); for (const [a,b] of [[0,2],[1,3],[2,3]]){ const [x0,z0]=P[a], [x1,z1]=P[b]; const m=mk(CYL(r,r,Math.hypot(x1-x0,z1-z0),6), c.W, (x0+x1)/2, y, (z0+z1)/2, g); if (x0===x1) m.rotation.x=Math.PI/2; else m.rotation.z=Math.PI/2; } }
const CHAIR = {
  legs:[
    c=>{ for (const [x,z] of chairLegPts()) mk(G.box(0.05,SH,0.05), c.W, x,SH/2,z,c.g); stretchers(c, 0.14); },
    c=>{ for (const [x,z] of chairLegPts()) mk(CYL(0.026,0.014,SH,10), c.W, x,SH/2,z,c.g); },
    c=>{ const geo=lathe([[0.001,0],[0.018,0],[0.022,0.04],[0.016,0.08],[0.03,0.15],[0.018,0.22],[0.026,0.3],[0.02,0.36],[0.028,0.4],[0.028,SH],[0.001,SH]]);
      for (const [x,z] of chairLegPts()) mk(geo, c.W, x,0,z,c.g); stretchers(c, 0.15, 0.012); },
    c=>{ for (const [x,z] of chairLegPts()){ const sx=Math.sign(x)*0.05, sz=Math.sign(z)*0.05; mk(tube([[x,SH,z],[x-sx*0.3,SH*0.72,z-sz*0.3],[x+sx*0.4,SH*0.25,z+sz*0.4],[x+sx*0.7,0.04,z+sz*0.7]], 0.024, 20), c.W, 0,0,0,c.g); mk(G.sph(0.03,10,8), c.W, x+sx*0.75,0.025,z+sz*0.75,c.g).scale.y=0.6; } },
    c=>{ for (const [x,z] of chairLegPts()){ const l=mk(CYL(0.055,0.065,SH,9), BARK(), x*0.95,SH/2,z*0.95,c.g); l.rotation.y=c.r()*TAU; mk(CYL(0.05,0.05,0.008,9), c.W, x*0.95,SH,z*0.95,c.g); } },
    c=>{ for (const [x,z] of chairLegPts()){ const l=mk(CYL(0.018,0.022,SH+0.03,8), c.W, x*1.1,SH/2,z*1.1,c.g); l.rotation.z=-Math.sign(x)*0.12; l.rotation.x=Math.sign(z)*0.12; } const h=mk(CYL(0.012,0.012,SW*0.9,6), c.W, 0,0.16,0,c.g); h.rotation.z=Math.PI/2; },
    c=>{ for (const [x,z] of chairLegPts()){ const sx=Math.sign(x); mk(tube([[x-sx*0.05,SH,z],[x,0.01,z],[x-sx*0.08,SH,z+Math.sign(z)*0.01]], 0.007, 16, 5), c.MT, 0,0,0,c.g); } },
    c=>{ for (const s of [-1,1]){ const x=s*(SW/2-0.05); bar(c.g, c.MT, [x,SH,-SD/2+0.05],[x,0.015,-SD/2+0.02], 0.012); bar(c.g, c.MT, [x,0.015,-SD/2+0.02],[x,0.015,SD/2-0.02], 0.012); bar(c.g, c.MT, [x,0.015,SD/2-0.02],[x,SH,SD/2-0.05], 0.012); } bar(c.g, c.MT, [-SW/2+0.05,SH-0.02,-SD/2+0.05],[SW/2-0.05,SH-0.02,-SD/2+0.05], 0.01); },
    c=>{ for (const [x,z] of chairLegPts()){ const w=(c.r()-0.5)*0.05; mk(tube([[x,SH,z],[x+w,SH*0.6,z-w],[x-w,SH*0.3,z+w*0.5],[x+w*0.5,0,z]], 0.016, 14, 6), BARK(), 0,0,0,c.g); mk(G.cone(0.008,0.05,5), BARK(), x+0.02,SH*0.5,z,c.g).rotation.z=-1; } },
    c=>{ CHAIR.legs[3](c); for (const [x,z] of chairLegPts()){ const sx=Math.sign(x)*0.05, sz=Math.sign(z)*0.05; mk(G.sph(0.034,12,10), c.MT, x+sx*0.75,0.034,z+sz*0.75,c.g); for (let k=0;k<3;k++){ const t=mk(G.cone(0.012,0.05,6), c.MT, x+sx*0.75+(k-1)*0.022,0.03,z+sz*0.75+0.02,c.g); t.rotation.x=1.3; } } },
    c=>{ for (const [x,z] of chairLegPts()) mk(CYL(0.022,0.022,SH-0.08,8), c.W, x,SH/2+0.04,z,c.g);
      for (const s of [-1,1]){ const r=mk(G.tor(0.9,0.022,6,40,0.62), c.W2, s*(SW/2-0.06),0.95,0,c.g); r.rotation.y=Math.PI/2; r.rotation.z=-Math.PI/2-0.31; } c.rock=true; } ],
  seat:[
    c=>{ mk(slab(SW,SD,0.05), c.W2, 0,SH,0,c.g); c.top=SH+0.05; },
    c=>{ mk(slab(SW,SD,0.035,0.012), c.W, 0,SH,0,c.g); mk(G.box(SW-0.06,0.03,SD-0.06), RUSH(), 0,SH+0.03,0,c.g); c.top=SH+0.05; },
    c=>{ mk(slab(SW,SD,0.04), c.W2, 0,SH,0,c.g); const p=pillow(SW*0.95,0.09,SD*0.95, c.F, 0,SH+0.08,0.01,c.g); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.sph(0.012,6,5), c.F2, x*0.06,SH+0.125,z*0.06,c.g); c.top=SH+0.11; },
    c=>{ const geo=slab(SW,SD,0.06,0.05); const m=mk(geo, c.W2, 0,SH,0,c.g); mk(CYL(0.2,0.2,0.012,24), c.W2, 0,SH+0.058,0.02,c.g).scale.set(1.15,1,1); c.top=SH+0.06; },
    c=>{ mk(slab(SW,SD,0.035), c.W2, 0,SH,0,c.g); mk(slab(SW-0.03,SD-0.03,0.08,0.04), c.F, 0,SH+0.03,0,c.g); for (let i=0;i<10;i++){ const a=i/10*TAU; mk(G.sph(0.008,6,5), c.MT, Math.cos(a)*0.001+(i<5?(i-2)*0.11:(i-7)*0.11), SH+0.07, i<5?SD/2-0.012:-SD/2+0.012, c.g); } c.top=SH+0.11; },
    c=>{ const s=new THREE.Shape(), n=18; for (let i=0;i<=n;i++){ const a=i/n*TAU, rr=1+(c.r()-0.5)*0.12; const x=Math.cos(a)*SW*0.56*rr, z=Math.sin(a)*SD*0.56*rr; i?s.lineTo(x,z):s.moveTo(x,z); }
      const geo=new THREE.ExtrudeGeometry(s,{ depth:0.06, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1 }); geo.rotateX(Math.PI/2); geo.translate(0,SH+0.06,0); mk(geo, c.W2, 0,0,0,c.g);
      const rim=mk(G.tor(SW*0.5,0.012,5,30), BARK(), 0,SH+0.035,0,c.g); rim.rotation.x=Math.PI/2; rim.scale.y=SD/SW; c.top=SH+0.07; },
    c=>{ mk(slab(SW,SD,0.05), c.W2, 0,SH,0,c.g); moss(c.g, 0, SH+0.05, 0, SW*0.85, SD*0.85, c.r); for (let i=0;i<5;i++) mk(G.sph(0.008,6,4), GLOW(0xd8ff9a), (c.r()-0.5)*0.4, SH+0.1, (c.r()-0.5)*0.4, c.g); c.top=SH+0.09; } ],
  back:[
    c=>{ c.post(0.62); for (let i=0;i<3;i++){ const y=c.top+0.2+i*0.14; const s=mk(G.box(SW-0.1,0.05,0.018), c.W, 0,y,-SD/2+0.035,c.g); s.rotation.x=0.04; } },
    c=>{ c.post(0.6); mk(G.box(SW-0.06,0.06,0.03), c.W, 0,c.top+0.6,-SD/2+0.035,c.g); for (let i=0;i<5;i++) mk(CYL(0.011,0.011,0.56,6), c.W, -0.16+i*0.08, c.top+0.3,-SD/2+0.035,c.g); },
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
    c=>{ const R=0.42, a0=Math.PI*0.5-0.62, a1=Math.PI*0.5+0.62, s=new THREE.Shape(); s.absarc(0,0,R,a0,a1,false); s.absarc(0,0,R-0.03,a1,a0,true); const geo=new THREE.ExtrudeGeometry(s,{ depth:0.15, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:2, curveSegments:24 }); geo.rotateX(Math.PI/2); geo.translate(0,c.top+0.33,R-SD/2-0.02); geo.scale(1,1,-1); mk(geo, c.W, 0,0,0,c.g); for (const x of [-0.16,0.16]) mk(CYL(0.014,0.014,0.2,6), c.MT, x,c.top+0.1,-SD/2+0.03,c.g); c.postTops(c.top+0.33, true); },
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

/* ---------- shared bits ---------- */
const DS = m => once('ds:'+m.uuid, ()=>{ const n=m.clone(); n.side=THREE.DoubleSide; return n; });
const CERAMIC = c => plain(c, { roughness:0.25, clearcoat:0.9 });
const GLASS = once('glass', ()=>new THREE.MeshPhysicalMaterial({ color:0xdff2ff, transparent:true, opacity:0.28, roughness:0.05, clearcoat:1, depthWrite:false }));
const BOOKS = [0xb4553a,0x34476a,0x3f6a4a,0xd9a63a,0x7a2a34,0x8a6a9a,0xe8d8b8,0x4a6a8a];
function books(g, x0, x1, y, z, r, h=0.24){ let x=x0; while (x<x1-0.04){ const w=0.03+r()*0.03, hh=h*(0.7+r()*0.3); if (r()<0.12){ x+=0.05; continue; } const b=mk(G.box(w,hh,0.2), plain(BOOKS[Math.floor(r()*BOOKS.length)],{roughness:0.8}), x+w/2,y+hh/2,z,g); if (r()<0.1) b.rotation.z=0.25; x+=w+0.004; } }
function jars(g, x0, x1, y, z, r){ for (let x=x0+0.08;x<x1-0.06;x+=0.13+r()*0.05){ const h=0.1+r()*0.1; mk(CYL(0.04,0.04,h,12), GLASS, x,y+h/2,z,g); mk(CYL(0.035,0.035,h*0.6,10), plain([0xd9a63a,0xb4553a,0x9fb58f,0xe8d8b8][Math.floor(r()*4)]), x,y+h*0.3,z,g); mk(CYL(0.044,0.044,0.02,12), woodMat(0xb98a55), x,y+h+0.01,z,g); } }
function plant(g, x, y, z, r, s=1){ mk(lathe([[0.001,0],[0.05*s,0],[0.065*s,0.1*s],[0.07*s,0.1*s],[0.001,0.1*s]],14), CERAMIC(0xc8704a), x,y,z,g);
  for (let i=0;i<7;i++){ const a=i/7*TAU+r(), l=mk(G.sph(0.06*s,8,6), LEAF(), x+Math.cos(a)*0.04*s, y+0.15*s+r()*0.06*s, z+Math.sin(a)*0.04*s, g); l.scale.set(0.45,1.3,0.2); l.rotation.set(Math.sin(a)*0.6,a,Math.cos(a)*0.6); } }
function curios(g, x0, x1, y, z, r){ const xs=[x0+0.12,(x0+x1)/2,x1-0.12];
  mk(G.sph(0.06,16,12), plain(0x5a8ac0,{roughness:0.4}), xs[0],y+0.1,z,g); mk(CYL(0.008,0.03,0.04,8), brass(), xs[0],y+0.02,z,g);
  const sh=mk(G.cone(0.05,0.14,10), CERAMIC(0xf2c6a8), xs[1],y+0.05,z,g); sh.rotation.z=Math.PI/2.3;
  mk(G.box(0.12,0.08,0.1), plain(0xb8a888,{roughness:0.95}), xs[2],y+0.04,z,g); mk(G.tor(0.025,0.01,6,14), plain(0x8a7a5a), xs[2],y+0.09,z,g).rotation.x=Math.PI/2; }
function crystals(g, x, y, z, r, c=0xb48aff){ for (let i=0;i<6;i++){ const h=0.06+r()*0.1, m=mk(G.cone(0.025,h,6), GLOW(c), x+(r()-0.5)*0.1, y+h/2, z+(r()-0.5)*0.06, g); m.rotation.set((r()-0.5)*0.6,0,(r()-0.5)*0.6); } }
function roots(g, cx, cz, rad, y, n, r){ for (let i=0;i<n;i++){ const a=i/n*TAU+r()*0.4, ox=Math.cos(a), oz=Math.sin(a); mk(tube([[cx+ox*rad*0.3,y,cz+oz*rad*0.3],[cx+ox*rad*0.75,y*0.45,cz+oz*rad*0.75],[cx+ox*rad*1.05,0.02,cz+oz*rad*1.05]],0.03,10,6), BARK(), 0,0,0,g); } }
const turnedLeg = (h, r=0.03) => lathe([[0.001,0],[r*0.65,0],[r*0.8,h*0.08],[r*0.55,h*0.18],[r,h*0.34],[r*0.6,h*0.5],[r*0.85,h*0.66],[r*0.7,h*0.8],[r,h*0.9],[r,h],[0.001,h]]);
const cabLeg = (g, mat, x, z, top, r=0.026) => { const sx=Math.sign(x)*0.06, sz=Math.sign(z)*0.06; mk(tube([[x,top,z],[x-sx*0.3,top*0.72,z-sz*0.3],[x+sx*0.4,top*0.25,z+sz*0.4],[x+sx*0.7,0.04,z+sz*0.7]], r, 20), mat, 0,0,0,g); mk(G.sph(r*1.25,10,8), mat, x+sx*0.75,r,z+sz*0.75,g).scale.y=0.6; };

/* =====================================================================
   TABLE. Top surface at 0.74. The top is built first, so the base knows how far out to put its legs.
   ===================================================================== */
const TH=0.74;
const TOP_SHAPE = [ { w:0.95, d:0.95 }, { round:0.55 }, { w:1.5, d:0.78 }, { w:1.4, d:0.75, slab:true }, { round:0.56, oct:true }, { w:0.95, d:0.95 }, { round:0.55 }, { w:1.0, d:0.95 } ];
function legSpots(c, inset=0.1){ const T=c.T; if (T.round){ const R=T.round*0.62; return [[R,R],[-R,R],[R,-R],[-R,-R]].map(([x,z])=>[x*0.75,z*0.75]); } return [[T.w/2-inset,T.d/2-inset],[-T.w/2+inset,T.d/2-inset],[T.w/2-inset,-T.d/2+inset],[-T.w/2+inset,-T.d/2+inset]]; }
const TABLE = {
  top:[
    c=>{ mk(slab(0.95,0.95,0.05), c.W2, 0,TH-0.05,0,c.g); },
    c=>{ mk(CYL(0.55,0.55,0.05,36), c.W2, 0,TH-0.025,0,c.g); },
    c=>{ mk(slab(1.5,0.78,0.06), c.W2, 0,TH-0.06,0,c.g); },
    c=>{ const s=new THREE.Shape(), n=24; for (let i=0;i<=n;i++){ const a=i/n*TAU, rr=1+(c.r()-0.5)*0.1; const x=Math.cos(a)*0.72*rr, z=Math.sin(a)*0.38*(1+(c.r()-0.5)*0.14); i?s.lineTo(x,z):s.moveTo(x,z); }
      const geo=new THREE.ExtrudeGeometry(s,{ depth:0.07, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1 }); geo.rotateX(Math.PI/2); geo.translate(0,TH,0); mk(geo, c.W2, 0,0,0,c.g); const rim=mk(G.tor(0.7,0.016,5,40), BARK(), 0,TH-0.04,0,c.g); rim.rotation.x=Math.PI/2; rim.scale.y=0.54; },
    c=>{ mk(CYL(0.56,0.56,0.05,8), c.W2, 0,TH-0.025,0,c.g).rotation.y=Math.PI/8; mk(CYL(0.5,0.5,0.005,8), c.W, 0,TH+0.002,0,c.g).rotation.y=Math.PI/8; },
    c=>{ mk(slab(0.95,0.95,0.04), c.W2, 0,TH-0.08,0,c.g); mk(slab(0.97,0.97,0.045,0.02), once('marble', ()=>{ const cv=canvas(256,256,(x,W,H)=>{ x.fillStyle='#ece8e2'; x.fillRect(0,0,W,H); const r=mulberry32(9); for (let i=0;i<14;i++){ x.strokeStyle=`rgba(120,120,130,${0.15+r()*0.25})`; x.lineWidth=0.5+r()*1.5; x.beginPath(); let px=r()*W, py=0; x.moveTo(px,py); while (py<H){ px+=(r()-0.5)*24; py+=10; x.lineTo(px,py); } x.stroke(); } }); return new THREE.MeshPhysicalMaterial({ map:tex(cv), roughness:0.2, clearcoat:0.8 }); }), 0,TH-0.045,0,c.g); },
    c=>{ mk(CYL(0.55,0.55,0.05,36), c.W2, 0,TH-0.025,0,c.g); const cols=[0x34476a,0xf2e8d4,0xd9a63a,0x9fb58f,0xb4553a,0x8ac0e0]; for (let i=0;i<70;i++){ const a=c.r()*TAU, rr=Math.sqrt(c.r())*0.48; mk(G.box(0.06,0.012,0.06), CERAMIC(cols[i%6]), Math.cos(a)*rr,TH+0.004,Math.sin(a)*rr,c.g).rotation.y=c.r()*3; } },
    c=>{ mk(slab(1.0,0.95,0.03,0.015), GLASS, 0,TH-0.03,0,c.g); for (const [a,b,cx] of [[[-0.5,TH-0.035,-0.47],[0.5,TH-0.035,-0.47]],[[-0.5,TH-0.035,0.47],[0.5,TH-0.035,0.47]]]) bar(c.g, c.MT, a, b, 0.008); } ],
  base:[
    c=>{ for (const [x,z] of legSpots(c)) mk(G.box(0.07,TH-0.05,0.07), c.W, x,(TH-0.05)/2,z,c.g); },
    c=>{ const geo=turnedLeg(TH-0.05, 0.04); for (const [x,z] of legSpots(c)) mk(geo, c.W, x,0,z,c.g); },
    c=>{ for (const [x,z] of legSpots(c, 0.14)) cabLeg(c.g, c.W, x, z, TH-0.05, 0.032); },
    c=>{ const T=c.T, xw=(T.w||1.0)/2-0.14; for (const s of [-1,1]){ mk(G.box(0.08,TH-0.12,0.2), c.W, s*xw,(TH-0.12)/2+0.06,0,c.g); mk(slab(0.12,(T.d||0.9)*0.8,0.06), c.W, s*xw,0,0,c.g); mk(G.box(0.1,0.05,(T.d||0.9)*0.75), c.W, s*xw,TH-0.08,0,c.g); }
      mk(G.box(xw*2,0.06,0.06), c.W, 0,0.24,0,c.g); for (const s of [-1,1]) mk(G.box(0.03,0.08,0.03), c.W2, s*(xw-0.07),0.24,0,c.g); },
    c=>{ mk(lathe([[0.001,0],[0.26,0],[0.26,0.04],[0.12,0.08],[0.07,0.16],[0.09,0.3],[0.06,0.45],[0.08,0.62],[0.12,TH-0.05],[0.001,TH-0.05]],24), c.W, 0,0,0,c.g); },
    c=>{ const T=c.T, xw=(T.w||1.0)/2-0.12, dz=(T.d||(T.round?T.round*1.4:0.9))/2-0.1; for (const s of [-1,1]){ bar(c.g, c.W, [s*xw,0.02,-dz],[s*xw,TH-0.06,dz],0.03); bar(c.g, c.W, [s*xw,0.02,dz],[s*xw,TH-0.06,-dz],0.03); } bar(c.g, c.W, [-xw,0.36,0],[xw,0.36,0],0.028); },
    c=>{ const l=mk(CYL(0.24,0.3,TH-0.05,14), BARK(), 0,(TH-0.05)/2,0,c.g); l.rotation.y=c.r()*TAU; mk(CYL(0.23,0.23,0.01,14), c.W, 0,TH-0.055,0,c.g); },
    c=>{ for (const [x,z] of legSpots(c, 0.14)){ const sx=Math.sign(x); bar(c.g, c.MT, [x-sx*0.07,TH-0.05,z],[x,0.01,z],0.008); bar(c.g, c.MT, [x,0.01,z],[x-sx*0.1,TH-0.05,z+Math.sign(z)*0.02],0.008); } },
    c=>{ mk(CYL(0.14,0.2,TH-0.05,12), BARK(), 0,(TH-0.05)/2,0,c.g); roots(c.g, 0, 0, 0.5, 0.35, 6, c.r); },
    c=>{ mk(lathe([[0.001,0.12],[0.12,0.12],[0.07,0.2],[0.09,0.34],[0.06,0.5],[0.09,0.6],[0.12,TH-0.05],[0.001,TH-0.05]],24), c.W, 0,0,0,c.g);
      for (let i=0;i<4;i++){ const a=i/4*TAU+Math.PI/4, ox=Math.cos(a), oz=Math.sin(a); mk(tube([[ox*0.06,0.2,oz*0.06],[ox*0.2,0.14,oz*0.2],[ox*0.32,0.06,oz*0.32]],0.035,12,8), c.W, 0,0,0,c.g); mk(G.sph(0.04,10,8), c.MT, ox*0.35,0.04,oz*0.35,c.g); } } ],
  skirt:[
    c=>{},
    c=>{ const T=c.T; if (T.round) { const ring=mk(CYL(T.round*0.82,T.round*0.82,0.09,32,1,true), DS(c.W), 0,TH-0.1,0,c.g); } else { for (const s of [-1,1]){ mk(G.box(T.w-0.12,0.09,0.025), c.W, 0,TH-0.1,s*(T.d/2-0.07),c.g); mk(G.box(0.025,0.09,T.d-0.12), c.W, s*(T.w/2-0.07),TH-0.1,0,c.g); } } },
    c=>{ TABLE.skirt[1](c); const T=c.T; const pts = T.round ? Array.from({length:16},(_,i)=>{ const a=i/16*TAU; return [Math.cos(a)*T.round*0.83, Math.sin(a)*T.round*0.83, -a+Math.PI/2]; })
        : [...Array.from({length:6},(_,i)=>[-(T.w-0.2)/2+i*(T.w-0.2)/5, T.d/2-0.07, 0]), ...Array.from({length:6},(_,i)=>[-(T.w-0.2)/2+i*(T.w-0.2)/5, -(T.d/2-0.07), Math.PI])];
      for (const [x,z,ry] of pts){ const sc=mk(CYL(0.07,0.07,0.02,14,1,false,0,Math.PI), c.W, x,TH-0.145,z,c.g); sc.rotation.set(Math.PI/2,0,0); sc.rotation.order='YXZ'; sc.rotation.y=ry; } },
    c=>{ TABLE.skirt[1](c); const T=c.T; if (T.round) return; for (const s of [-1,1]){ const ro=mk(CYL(0.035,0.035,0.012,12), c.W2, 0,TH-0.1,s*(T.d/2-0.055),c.g); ro.rotation.x=Math.PI/2; for (const sx of [-1,1]){ const sw=mk(G.tor(0.05,0.01,6,14,Math.PI), c.W2, sx*0.14,TH-0.11,s*(T.d/2-0.055),c.g); sw.rotation.z=sx>0?0:Math.PI; } } },
    c=>{ TABLE.skirt[1](c); const T=c.T, z=T.round?T.round*0.83:T.d/2-0.06; mk(G.box(0.32,0.07,0.02), c.W2, 0,TH-0.1,z+0.005,c.g); mk(G.sph(0.016,8,6), c.MT, 0,TH-0.1,z+0.02,c.g); },
    c=>{ const T=c.T; if (T.round) mk(CYL(T.round*0.62,T.round*0.62,0.03,24), c.W, 0,0.2,0,c.g); else mk(slab(T.w-0.16,T.d-0.16,0.03), c.W, 0,0.19,0,c.g); } ],
  extra:[
    c=>{},
    c=>{ const T=c.T, lace=fabricOf(0,3); if (T.round){ mk(CYL(T.round+0.01,T.round+0.01,0.006,36), lace, 0,TH+0.003,0,c.g); const d=mk(CYL(T.round+0.01,T.round+0.08,0.18,36,1,true), DS(lace), 0,TH-0.09,0,c.g); }
      else { mk(G.box(T.w+0.02,0.006,T.d+0.02), lace, 0,TH+0.003,0,c.g); for (const s of [-1,1]){ mk(G.box(T.w+0.02,0.16,0.006), lace, 0,TH-0.08,s*(T.d/2+0.01),c.g); mk(G.box(0.006,0.16,T.d+0.02), lace, s*(T.w/2+0.01),TH-0.08,0,c.g); } } },
    c=>{ const T=c.T, L=(T.w||T.round*2)+0.1; mk(G.box(L,0.006,0.24), c.F, 0,TH+0.004,0,c.g); for (const s of [-1,1]) mk(G.box(0.006,0.12,0.24), c.F, s*L/2,TH-0.055,0,c.g); },
    c=>{ for (const x of [-0.18,0.18]){ mk(lathe([[0.001,0],[0.05,0],[0.02,0.03],[0.015,0.12],[0.03,0.13],[0.001,0.13]],14), c.MT, x,TH,0,c.g); mk(CYL(0.014,0.014,0.12,10), plain(0xfaf4e6), x,TH+0.19,0,c.g); mk(G.sph(0.012,8,6), GLOW(0xffc860), x,TH+0.265,0,c.g).scale.y=1.6; } c.lightY=TH+0.3; },
    c=>{ mk(lathe([[0.001,0],[0.05,0],[0.07,0.06],[0.05,0.14],[0.03,0.18],[0.04,0.2],[0.001,0.2]],16), CERAMIC(0x8ac0e0), 0.1,TH,0.05,c.g); for (let i=0;i<5;i++){ const a=i/5*TAU; mk(CYL(0.004,0.004,0.16,4), LEAF(), 0.1+Math.cos(a)*0.02,TH+0.26,0.05+Math.sin(a)*0.02,c.g); mk(G.sph(0.025,8,6), plain([0xf090b0,0xf8d040,0xffffff,0xe86a4a,0xb48ae0][i]), 0.1+Math.cos(a)*0.05,TH+0.34+c.r()*0.03,0.05+Math.sin(a)*0.05,c.g); } },
    c=>{ plant(c.g, 0.12, TH, 0.04, c.r, 1.5); },
    c=>{ mk(G.sph(0.14,18,10,0,TAU,Math.PI/2,Math.PI/2), CERAMIC(0xf2e8d4), 0,TH+0.12,0,c.g); for (let i=0;i<7;i++){ const a=i/7*TAU; mk(G.sph(0.045,10,8), plain([0xe2483d,0xf59a2f,0xc9d65a,0x8a4fa8][i%4],{roughness:0.4}), Math.cos(a)*0.06,TH+0.1+(i%2)*0.04,Math.sin(a)*0.06,c.g); } },
    c=>{ mk(CYL(0.05,0.06,0.12,10), BARK(), 0.15,TH+0.06,0,c.g); const cap=mk(G.sph(0.1,16,8,0,TAU,0,Math.PI/2), GLOW(0xffb070), 0.15,TH+0.12,0,c.g); cap.scale.y=0.7; c.lightY=TH+0.2; },
    c=>{ mk(G.dod(0.08), plain(0x7a6a8a,{roughness:0.9}), 0,TH+0.05,0,c.g).scale.y=0.6; crystals(c.g, 0, TH+0.03, 0, c.r); c.lightY=TH+0.15; } ],
};
function table(c){ const P=c.d.parts; c.T=TOP_SHAPE[P.top]; TABLE.top[P.top](c); TABLE.base[P.base](c); TABLE.skirt[P.skirt](c); TABLE.extra[P.extra](c); }

/* =====================================================================
   BED. 1.3 wide, 2.0 long, head at -z. The frame sets how high the mattress sits.
   ===================================================================== */
const BW=1.3, BL=2.0;
const BED = {
  frame:[
    c=>{ c.mt=0.3; mk(slab(BW,BL,0.22,0.03), c.W, 0,0.08,0,c.g); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.box(0.08,0.1,0.08), c.W, x*(BW/2-0.05),0.05,z*(BL/2-0.05),c.g); },
    c=>{ c.mt=0.32; mk(slab(BW,BL,0.18,0.02), c.W, 0,0.16,0,c.g); const geo=turnedLeg(0.2,0.04); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(geo, c.W, x*(BW/2-0.05),0,z*(BL/2-0.05),c.g); },
    c=>{ c.mt=0.32; for (const s of [-1,1]){ const l=mk(CYL(0.075,0.075,BL,10), BARK(), s*(BW/2-0.06),0.22,0,c.g); l.rotation.x=Math.PI/2; } for (const z of [-1,1]){ const l=mk(CYL(0.07,0.07,BW,10), BARK(), 0,0.2,z*(BL/2-0.06),c.g); l.rotation.z=Math.PI/2; } for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(CYL(0.085,0.09,0.24,10), BARK(), x*(BW/2-0.06),0.12,z*(BL/2-0.06),c.g); mk(G.box(BW-0.15,0.06,BL-0.15), c.W, 0,0.24,0,c.g); },
    c=>{ c.mt=0.2; mk(slab(BW+0.3,BL+0.2,0.14,0.03), c.W, 0,0.06,0.05,c.g); mk(G.box(BW+0.1,0.06,BL), plain(0x2a2826), 0,0.03,0.05,c.g); },
    c=>{ c.mt=0.32; mk(G.box(BW-0.04,0.12,BL-0.04), plain(0xe8e0d0), 0,0.26,0,c.g); for (const s of [-1,1]) bar(c.g, c.MT, [s*(BW/2-0.02),0.28,-BL/2+0.03],[s*(BW/2-0.02),0.28,BL/2-0.03],0.018); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(CYL(0.02,0.02,0.3,8), c.MT, x*(BW/2-0.02),0.15,z*(BL/2-0.02),c.g); },
    c=>{ c.mt=0.3; mk(G.box(BW-0.06,0.14,BL-0.06), c.W, 0,0.2,0,c.g); for (const s of [-1,1]) for (let k=0;k<3;k++) bar(c.g, BARK(), [s*(BW/2-0.02),0.12+k*0.06,-BL/2+0.02],[s*(BW/2-0.02),0.13+k*0.06,BL/2-0.02],0.012); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(CYL(0.03,0.035,0.3,7), BARK(), x*(BW/2-0.03),0.15,z*(BL/2-0.03),c.g); },
    c=>{ c.mt=0.34; for (const s of [-1,1]){ const sh=new THREE.Shape(); sh.moveTo(-BL/2,0); sh.lineTo(BL/2,0); sh.quadraticCurveTo(BL/2+0.06,0.2,BL/2-0.05,0.36); sh.lineTo(-BL/2+0.05,0.36); sh.quadraticCurveTo(-BL/2-0.06,0.2,-BL/2,0); const m=mk(cut(sh,0.05), c.W, s*(BW/2-0.02),0,0,c.g); m.rotation.y=Math.PI/2; } mk(G.box(BW-0.08,0.1,BL-0.06), c.W, 0,0.22,0,c.g); } ],
  head:[
    c=>{ mk(slab(BW+0.06,0.07,0.75,0.03), c.W, 0,c.mt-0.2,-BL/2-0.02,c.g); c.hh=c.mt+0.55; },
    c=>{ for (const s of [-1,1]) mk(G.box(0.07,0.9,0.07), c.W, s*(BW/2),c.mt+0.25,-BL/2,c.g); mk(G.box(BW+0.04,0.07,0.07), c.W, 0,c.mt+0.66,-BL/2,c.g); for (let i=1;i<9;i++) mk(CYL(0.013,0.013,0.5,6), c.W, -BW/2+i*BW/9,c.mt+0.4,-BL/2,c.g); c.hh=c.mt+0.7; },
    c=>{ const sh=new THREE.Shape(), w=BW/2+0.03; sh.moveTo(-w,0); sh.lineTo(w,0); sh.lineTo(w,0.62); sh.quadraticCurveTo(0,1.05,-w,0.62); sh.lineTo(-w,0); mk(cut(sh,0.06), c.W, 0,c.mt-0.2,-BL/2-0.02,c.g); c.hh=c.mt+0.6; },
    c=>{ mk(slab(BW+0.04,0.07,0.72,0.03), c.W, 0,c.mt-0.2,-BL/2-0.02,c.g); const r=mk(CYL(0.1,0.1,BW+0.1,18), c.W, 0,c.mt+0.56,-BL/2-0.09,c.g); r.rotation.z=Math.PI/2; c.hh=c.mt+0.6; },
    c=>{ mk(slab(BW+0.06,0.05,0.8,0.02), c.W, 0,c.mt-0.2,-BL/2-0.04,c.g); mk(slab(BW-0.04,0.12,0.62,0.06), c.F, 0,c.mt-0.04,-BL/2+0.02,c.g); for (let i=0;i<4;i++) for (let j=0;j<3;j++) mk(G.sph(0.016,8,6), c.F2, -0.45+i*0.3+(j%2)*0.15,c.mt+0.12+j*0.16,-BL/2+0.085,c.g); c.hh=c.mt+0.6; },
    c=>{ for (const s of [-1,1]) mk(CYL(0.08,0.085,1.0,10), BARK(), s*(BW/2+0.02),c.mt+0.2,-BL/2,c.g); for (let k=0;k<3;k++){ const l=mk(CYL(0.06,0.06,BW+0.04,10), BARK(), 0,c.mt+0.18+k*0.14,-BL/2,c.g); l.rotation.z=Math.PI/2; } c.hh=c.mt+0.7; },
    c=>{ for (const s of [-1,1]){ mk(CYL(0.025,0.025,0.95,10), c.MT, s*(BW/2),c.mt+0.18,-BL/2,c.g); mk(G.sph(0.045,12,10), c.MT, s*(BW/2),c.mt+0.67,-BL/2,c.g); } mk(tube([[-BW/2,c.mt+0.55,-BL/2],[0,c.mt+0.7,-BL/2],[BW/2,c.mt+0.55,-BL/2]],0.018,16,8), c.MT, 0,0,0,c.g); for (let i=1;i<6;i++) bar(c.g, c.MT, [-BW/2+i*BW/6,c.mt+0.05,-BL/2],[-BW/2+i*BW/6,c.mt+0.57+Math.sin(i/6*Math.PI)*0.12,-BL/2],0.01); c.hh=c.mt+0.7; },
    c=>{ for (const s of [-1,1]) mk(tube([[s*(BW/2),0,-BL/2],[s*(BW/2+0.03),c.mt+0.4,-BL/2-0.02],[s*(BW/2-0.15),c.mt+0.85,-BL/2]],0.035,14,7), BARK(), 0,0,0,c.g);
      for (let i=0;i<5;i++){ const y=c.mt+0.15+i*0.13; mk(tube([[-BW/2,y+c.r()*0.06,-BL/2],[0,y+0.08,-BL/2-0.02],[BW/2,y+c.r()*0.06,-BL/2]],0.015,14,6), BARK(), 0,0,0,c.g); }
      for (let i=0;i<14;i++) mk(G.sph(0.04,6,4), LEAF(), (c.r()-0.5)*BW, c.mt+0.2+c.r()*0.7, -BL/2+0.02, c.g).scale.set(1.3,0.6,0.4); c.hh=c.mt+0.8; },
    c=>{ const sh=new THREE.Shape(), w=BW/2+0.04; sh.moveTo(-w,0); sh.lineTo(w,0); sh.lineTo(w,0.7);
      for (let i=0;i<=6;i++){ const x=w-i*(2*w/6), y=0.75+(i%2?0.22:0.05)+Math.sin(i)*0.04; sh.lineTo(x, y); } sh.lineTo(-w,0);
      for (let i=0;i<3;i++){ const h=new THREE.Path(), x=-0.38+i*0.38; h.moveTo(x,0.12); h.lineTo(x+0.08,0.25); h.lineTo(x+0.04,0.25); h.lineTo(x+0.11,0.38); h.lineTo(x+0.06,0.38); h.lineTo(x,0.52); h.lineTo(x-0.06,0.38); h.lineTo(x-0.11,0.38); h.lineTo(x-0.04,0.25); h.lineTo(x-0.08,0.25); h.lineTo(x,0.12); sh.holes.push(h); }
      mk(cut(sh,0.07), c.W, 0,c.mt-0.2,-BL/2-0.02,c.g); c.hh=c.mt+0.75; },
    c=>{ BED.head[2](c); const m=mk(G.sph(0.14,20,14), plain(0xf6ecc8,{roughness:0.5}), 0.25,c.mt+0.48,-BL/2+0.02,c.g); m.scale.z=0.2; const sh=mk(G.sph(0.12,20,14), c.W, 0.31,c.mt+0.5,-BL/2+0.035,c.g); sh.scale.z=0.2;
      for (let i=0;i<6;i++){ const st=mk(new THREE.OctahedronGeometry(0.03), GLOW(0xfff0a0), -0.4+i*0.12+(c.r()-0.5)*0.05, c.mt+0.3+c.r()*0.35, -BL/2+0.05, c.g); st.scale.z=0.4; } c.lightY=c.mt+0.6; } ],
  foot:[
    c=>{},
    c=>{ mk(slab(BW+0.04,0.06,0.42,0.025), c.W, 0,c.mt-0.2,BL/2+0.02,c.g); },
    c=>{ for (const s of [-1,1]) mk(G.box(0.06,0.5,0.06), c.W, s*(BW/2),c.mt,BL/2,c.g); mk(G.box(BW+0.04,0.06,0.06), c.W, 0,c.mt+0.22,BL/2,c.g); for (let i=1;i<8;i++) mk(CYL(0.012,0.012,0.3,6), c.W, -BW/2+i*BW/8,c.mt+0.07,BL/2,c.g); },
    c=>{ mk(slab(BW+0.04,0.07,0.4,0.03), c.W, 0,c.mt-0.2,BL/2+0.02,c.g); const r=mk(CYL(0.08,0.08,BW+0.08,18), c.W, 0,c.mt+0.2,BL/2+0.08,c.g); r.rotation.z=Math.PI/2; },
    c=>{ mk(slab(BW,0.42,0.06,0.02), c.W, 0,0.36,BL/2+0.28,c.g); mk(slab(BW-0.04,0.4,0.1,0.04), c.F, 0,0.42,BL/2+0.28,c.g); for (const [x,z] of [[-1,0],[1,0]]) for (const dz of [-0.17,0.17]) mk(CYL(0.025,0.02,0.36,8), c.W, x*(BW/2-0.05),0.18,BL/2+0.28+dz,c.g); },
    c=>{ for (const s of [-1,1]) mk(CYL(0.07,0.075,0.55,10), BARK(), s*(BW/2+0.02),0.27,BL/2,c.g); for (let k=0;k<2;k++){ const l=mk(CYL(0.055,0.055,BW+0.04,10), BARK(), 0,c.mt+0.03+k*0.12,BL/2,c.g); l.rotation.z=Math.PI/2; } } ],
  bedding:[
    (c,F)=>{ return F; }, (c)=>fabricOf(c.d.f,6), (c)=>fabricOf(c.d.f,1), (c)=>fabricOf(c.d.f,2), (c)=>fabricOf(c.d.f,3), (c)=>fabricOf(c.d.f,5), (c)=>MOSS() ],
  canopy:[
    c=>{},
    c=>{ for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ mk(turnedLeg(1.95,0.04), c.W, x*(BW/2+0.03),0,z*(BL/2+0.02),c.g); mk(G.sph(0.05,12,10), c.W, x*(BW/2+0.03),2.0,z*(BL/2+0.02),c.g); } },
    c=>{ BED.canopy[1](c); for (const s of [-1,1]){ mk(G.box(0.05,0.05,BL+0.06), c.W, s*(BW/2+0.03),1.95,0,c.g); mk(G.box(BW+0.06,0.05,0.05), c.W, 0,1.95,s*(BL/2+0.02),c.g); }
      const F=DS(c.F); mk(G.box(BW+0.1,0.02,BL+0.1), c.F, 0,1.98,0,c.g); for (const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){ const d=mk(CYL(0.09,0.15,1.2,10,1,true), F, x*(BW/2+0.03),1.38,z*(BL/2+0.02),c.g); }
      for (const s of [-1,1]){ const v=mk(CYL(0.6,0.6,0.16,24,1,true,0,Math.PI), F, 0,1.88,s*(BL/2+0.02),c.g); v.scale.set(1.05,1,0.08); } },
    c=>{ const pts=[]; for (let i=0;i<=16;i++){ const t=i/16; pts.push([-BW/2+t*BW, c.hh+0.05-Math.sin(t*Math.PI)*0.12+(i%2)*0.02, -BL/2+0.03]); }
      mk(tube(pts,0.004,40,4), plain(0x3a3a30), 0,0,0,c.g); for (const p of pts) mk(G.sph(0.022,8,6), GLOW([0xfff0a0,0xffc0a0,0xa0e0ff][Math.floor(c.r()*3)]), p[0],p[1]-0.02,p[2]+0.01,c.g); c.lightY=c.hh; },
    c=>{ BED.canopy[1](c); for (const s of [-1,1]) mk(G.box(0.04,0.04,BL+0.06), BARK(), s*(BW/2+0.03),1.96,0,c.g); for (let i=0;i<70;i++){ const x=(c.r()-0.5)*(BW+0.2), z=(c.r()-0.5)*(BL+0.1); mk(G.sph(0.05,6,4), LEAF(), x, 1.95+c.r()*0.06-(Math.abs(x)>BW/2?c.r()*0.5:0), z, c.g).scale.set(1.2,0.5,0.8); } } ],
};
function bed(c){ const P=c.d.parts; BED.frame[P.frame](c); const F=BED.bedding[P.bedding](c, c.F);
  const top=c.mt+0.18; mk(slab(BW-0.08,BL-0.1,0.18,0.06), plain(0xfbf7ee,{roughness:0.9}), 0,c.mt,0,c.g);
  if (P.bedding===6){ moss(c.g, 0, top, 0.25, BW-0.06, BL*0.62, c.r); } else { const q=mk(slab(BW-0.02,BL*0.66,0.05,0.05), F, 0,top-0.01,BL*0.17,c.g); for (const s of [-1,1]) mk(G.box(0.012,0.2,BL*0.66), F, s*(BW/2-0.004),top-0.1,BL*0.17,c.g); mk(G.box(BW-0.02,0.2,0.012), F, 0,top-0.1,BL*0.17+BL*0.33,c.g); }
  for (const x of [-0.3,0.3]) pillow(0.48,0.14,0.32, plain(0xfffaf2,{roughness:0.95}), x,top+0.06,-BL/2+0.28,c.g);
  if (P.bedding===2){ const t=mk(G.box(0.5,0.03,0.55), fabricOf((c.d.f+3)%FABRICS.length,1), 0.3,top+0.05,0.4,c.g); t.rotation.y=0.4; }
  c.hh=c.mt+0.6; BED.head[P.head](c); BED.foot[P.foot](c); BED.canopy[P.canopy](c); }

/* =====================================================================
   SHELF. About 1.2 wide, 0.4 deep, 1.75 tall. The base goes first and says where the body starts (c.y0).
   The body says where its shelves are (c.shelves: [y, x0, x1, z]) for whatever fills them.
   ===================================================================== */
const HW=1.2, HD=0.4;
function caseBox(c, y0, H, w=HW){ const g=c.g, t=0.04; for (const s of [-1,1]) mk(G.box(t,H,HD), c.W, s*(w/2-t/2),y0+H/2,0,g); mk(G.box(w,t,HD), c.W, 0,y0+H-t/2,0,g); mk(G.box(w,t,HD), c.W, 0,y0+t/2,0,g); mk(G.box(w-0.04,H-0.04,0.02), c.W2, 0,y0+H/2,-HD/2+0.01,g); }
const SHELF = {
  foot:[
    c=>{ mk(G.box(HW,0.08,HD-0.02), c.W, 0,0.04,0,c.g); c.y0=0.08; },
    c=>{ for (const x of [-1,1]) for (const z of [-1,1]) mk(G.sph(0.05,12,10), c.W, x*(HW/2-0.06),0.045,z*(HD/2-0.06),c.g); c.y0=0.08; },
    c=>{ for (const x of [-1,1]) for (const z of [-1,1]){ const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.12,0); s.quadraticCurveTo(0.12,0.08,0.02,0.1); s.lineTo(0,0.1); const m=mk(cut(s,0.03), c.W, x*(HW/2-0.02),0,z*(HD/2-0.03),c.g); m.scale.x=-x; } mk(G.box(HW,0.03,HD), c.W, 0,0.1,0,c.g); c.y0=0.11; },
    c=>{ for (const x of [-1,1]) for (const z of [-1,1]) mk(CYL(0.02,0.012,0.32,8), c.W, x*(HW/2-0.07),0.16,z*(HD/2-0.06),c.g); c.y0=0.32; },
    c=>{ roots(c.g, 0, 0, 0.62, 0.12, 7, c.r); mk(G.box(HW,0.06,HD), BARK(), 0,0.09,0,c.g); c.y0=0.12; } ],
  body:[
    c=>{ const H=1.7-c.y0; caseBox(c,c.y0,H); c.shelves=[]; for (let i=0;i<4;i++){ const y=c.y0+0.04+i*(H-0.08)/4; if (i) mk(G.box(HW-0.08,0.03,HD-0.04), c.W, 0,y,0,c.g); c.shelves.push([y+0.015,-HW/2+0.06,HW/2-0.06,0.02]); } c.top=c.y0+H; },
    c=>{ const H=1.6-c.y0; caseBox(c,c.y0,H); c.shelves=[]; for (let i=1;i<4;i++) mk(G.box(HW-0.08,0.03,HD-0.04), c.W, 0,c.y0+i*H/4,0,c.g); for (const x of [-HW/6, HW/6]) mk(G.box(0.03,H-0.06,HD-0.04), c.W, x,c.y0+H/2,0,c.g);
      for (let i=0;i<4;i++) for (let j=0;j<3;j++) c.shelves.push([c.y0+0.04+i*H/4, -HW/2+0.06+j*HW/3, -HW/2+j*HW/3+HW/3-0.04, 0.02]); c.top=c.y0+H; },
    c=>{ const H=1.75-c.y0; for (const s of [-1,1]) for (const z of [-1,1]) bar(c.g, c.W, [s*(HW/2-0.03), c.y0, z*0.2],[s*(HW/2-0.12), c.y0+H, z*0.04], 0.025);
      c.shelves=[]; for (let i=0;i<4;i++){ const y=c.y0+0.05+i*H/4.3, d=0.42-i*0.06, w=HW-0.1-i*0.05; mk(slab(w,d,0.03,0.01), c.W2, 0,y,0.1-i*0.04,c.g); c.shelves.push([y+0.03,-w/2+0.04,w/2-0.04,0.1-i*0.04]); } c.top=c.y0+H; },
    c=>{ SHELF.body[0](c); const H=c.top-c.y0; for (const s of [-1,1]){ const x=s*HW/4; for (const [dx,dy,w,h] of [[0,0,HW/2-0.02,0.04],[0,H-0.06,HW/2-0.02,0.04],[-HW/4+0.02,H/2-0.03,0.04,H-0.06],[HW/4-0.02,H/2-0.03,0.04,H-0.06]]) mk(G.box(w,h,0.03), c.W, x+dx*s,c.y0+0.03+dy+h/2-0.02,HD/2,c.g);
      mk(G.box(HW/2-0.06,H-0.1,0.01), GLASS, x,c.y0+H/2,HD/2,c.g); mk(G.sph(0.016,8,6), c.MT, s*0.04,c.y0+H/2,HD/2+0.03,c.g); } },
    c=>{ const H=1.7-c.y0, w=HW/2; const sh=new THREE.Shape(); sh.moveTo(-w,0); sh.lineTo(w,0); sh.lineTo(w,H); sh.lineTo(-w,H); sh.lineTo(-w,0); const h=new THREE.Path(), iw=w-0.1; h.moveTo(-iw,0.06); h.lineTo(iw,0.06); h.lineTo(iw,H-0.42); h.absarc(0,H-0.42,iw,0,Math.PI,false); h.lineTo(-iw,0.06); sh.holes.push(h);
      mk(cut(sh,0.05), c.W, 0,c.y0,HD/2-0.02,c.g); for (const s of [-1,1]) mk(G.box(0.04,H,HD-0.05), c.W, s*(w-0.02),c.y0+H/2,-0.02,c.g); mk(G.box(HW,0.04,HD), c.W, 0,c.y0+H,0,c.g); mk(G.box(HW-0.04,H,0.02), c.W2, 0,c.y0+H/2,-HD/2+0.01,c.g);
      c.shelves=[]; for (let i=0;i<3;i++){ const y=c.y0+0.06+i*0.38; if (i) mk(G.box(HW-0.12,0.03,HD-0.06), c.W, 0,y,-0.02,c.g); c.shelves.push([y+0.015,-iw+0.04,iw-0.04,-0.02]); } c.top=c.y0+H; },
    c=>{ const H=1.7-c.y0; for (const s of [-1,1]) for (const z of [-1,1]) mk(CYL(0.05,0.055,H,9), BARK(), s*(HW/2-0.06),c.y0+H/2,z*(HD/2-0.06),c.g);
      c.shelves=[]; for (let i=0;i<4;i++){ const y=c.y0+0.1+i*(H-0.15)/3.3; mk(slab(HW+0.06,HD+0.04,0.05,0.015), c.W2, 0,y,0,c.g); c.shelves.push([y+0.05,-HW/2+0.12,HW/2-0.12,0]); } c.top=c.y0+H; },
    c=>{ const H=1.75-c.y0; const t=mk(CYL(0.6,0.64,H,18,1,true,Math.PI*0.2,Math.PI*1.6), DS(BARK()), 0,c.y0+H/2,0.1,c.g); mk(CYL(0.58,0.62,H,18,1,true,Math.PI*0.2,Math.PI*1.6), DS(c.W), 0,c.y0+H/2,0.1,c.g).scale.set(0.95,1,0.95);
      const cap=mk(G.sph(0.66,20,8,0,TAU,0,Math.PI/2), BARK(), 0,c.y0+H-0.02,0.1,c.g); cap.scale.y=0.28; moss(c.g, 0, c.y0+H+0.12, 0.1, 0.7, 0.55, c.r, true);
      c.shelves=[]; for (let i=0;i<4;i++){ const y=c.y0+0.08+i*(H-0.2)/4; mk(CYL(0.55,0.55,0.03,18,1,false,Math.PI*0.2,Math.PI*1.6), c.W2, 0,y,0.1,c.g); c.shelves.push([y+0.015,-0.4,0.4,-0.05]); } c.top=c.y0+H+0.1; } ],
  crown:[
    c=>{},
    c=>{ mk(G.box(HW+0.08,0.05,HD+0.06), c.W, 0,c.top+0.025,0.01,c.g); mk(G.box(HW+0.14,0.04,HD+0.1), c.W, 0,c.top+0.07,0.02,c.g); },
    c=>{ const s=new THREE.Shape(); s.moveTo(-HW/2-0.04,0); s.lineTo(HW/2+0.04,0); s.lineTo(0,0.24); s.lineTo(-HW/2-0.04,0); mk(cut(s,0.05), c.W, 0,c.top,HD/2-0.03,c.g); mk(G.box(HW+0.06,0.04,HD+0.04), c.W, 0,c.top+0.02,0,c.g); },
    c=>{ SHELF.crown[1](c); for (const s of [-1,1]){ const sc=mk(G.tor(0.07,0.025,8,18,Math.PI*1.4), c.W, s*0.2,c.top+0.16,HD/2,c.g); sc.rotation.z=s>0?-0.3:Math.PI+0.3; } mk(lathe([[0.001,0],[0.04,0],[0.02,0.06],[0.035,0.1],[0.001,0.16]],12), c.W2, 0,c.top+0.09,HD/2-0.02,c.g); },
    c=>{ for (let i=0;i<22;i++){ const x=-HW/2+i*HW/21; mk(G.sph(0.05,6,4), LEAF(), x,c.top+0.02+Math.sin(i*1.7)*0.02,HD/2-0.02+(c.r()-0.5)*0.06,c.g).scale.set(1.2,0.6,0.7); } for (let i=0;i<5;i++) mk(G.sph(0.025,8,6), plain([0xf8d040,0xffffff,0xf090b0][i%3]), -0.5+i*0.25,c.top+0.06,HD/2,c.g); },
    c=>{ SHELF.crown[1](c); const f=mk(CYL(0.14,0.14,0.04,24), c.W2, 0,c.top+0.24,HD/2-0.04,c.g); f.rotation.x=Math.PI/2; const dial=mk(CYL(0.115,0.115,0.01,24), plain(0xfaf4e6), 0,c.top+0.24,HD/2-0.015,c.g); dial.rotation.x=Math.PI/2;
      for (let i=0;i<12;i++){ const a=i/12*TAU; mk(G.box(0.006,0.018,0.004), plain(0x2a2a2a), Math.cos(a)*0.095,c.top+0.24+Math.sin(a)*0.095,HD/2-0.008,c.g).rotation.z=a+Math.PI/2; }
      const hd=mk(G.box(0.006,0.07,0.004), c.MT, 0,c.top+0.27,HD/2-0.005,c.g); const md=mk(G.box(0.004,0.09,0.004), c.MT, 0.03,c.top+0.25,HD/2-0.004,c.g); md.rotation.z=-1; (c.g.userData.anims ||= []).push(t=>{ md.rotation.z=-t*0.1; hd.rotation.z=-t*0.008; }); } ],
  fill:[
    c=>{},
    c=>{ for (const [y,x0,x1,z] of c.shelves) books(c.g, x0, x1, y, z, c.r, Math.min(0.26, 0.24)); },
    c=>{ for (const [y,x0,x1,z] of c.shelves) jars(c.g, x0, x1, y, z, c.r); },
    c=>{ for (const [y,x0,x1,z] of c.shelves) for (let x=x0+0.1;x<x1-0.06;x+=0.28) plant(c.g, x, y, z, c.r); },
    c=>{ for (const [y,x0,x1,z] of c.shelves) curios(c.g, x0, x1, y, z, c.r); },
    c=>{ c.shelves.forEach(([y,x0,x1,z],i)=>[books,jars,curios,books][i%4](c.g, x0, x1, y, z, c.r)); },
    c=>{ for (const [y,x0,x1,z] of c.shelves) for (let x=x0+0.12;x<x1-0.08;x+=0.3) crystals(c.g, x, y, z, c.r, [0xb48aff,0x8ae0ff,0xffa0d8][Math.floor(c.r()*3)]); c.lightY=1.0; } ],
};
function shelf(c){ const P=c.d.parts; SHELF.foot[P.foot](c); SHELF.body[P.body](c); SHELF.crown[P.crown](c); SHELF.fill[P.fill](c); }

/* =====================================================================
   LAMP (a floor lamp). The base says where the stem starts (c.y), the stem says where the shade hangs (c.sp).
   ===================================================================== */
const LAMP = {
  base:[
    c=>{ mk(lathe([[0.001,0],[0.2,0],[0.2,0.03],[0.12,0.06],[0.05,0.08],[0.001,0.08]],24), c.W, 0,0,0,c.g); c.y=0.08; },
    c=>{ mk(slab(0.3,0.3,0.1,0.02), c.W, 0,0,0,c.g); c.y=0.1; },
    c=>{ for (let i=0;i<3;i++){ const a=i/3*TAU; bar(c.g, c.W, [Math.cos(a)*0.26,0,Math.sin(a)*0.26],[0,0.6,0],0.018); } c.y=0.58; },
    c=>{ const l=mk(CYL(0.16,0.19,0.22,12), BARK(), 0,0.11,0,c.g); l.rotation.y=c.r()*TAU; mk(CYL(0.15,0.15,0.01,12), c.W, 0,0.22,0,c.g); c.y=0.22; },
    c=>{ mk(lathe([[0.001,0],[0.1,0],[0.08,0.03],[0.15,0.14],[0.13,0.26],[0.06,0.32],[0.07,0.34],[0.001,0.34]],24), CERAMIC(FABRICS[c.d.f].c), 0,0,0,c.g); c.y=0.34; },
    c=>{ mk(CYL(0.06,0.08,0.12,12), plain(0xf2e8d4), 0,0.06,0,c.g); const cap=mk(G.sph(0.2,20,10,0,TAU,0,Math.PI/2), plain(0xc8403a,{roughness:0.5,clearcoat:0.5}), 0,0.1,0,c.g); cap.scale.y=0.55; for (let i=0;i<7;i++){ const a=i/7*TAU; mk(G.sph(0.022,6,4), plain(0xfff6e8), Math.cos(a)*0.12,0.17,Math.sin(a)*0.12,c.g); } c.y=0.2; },
    c=>{ mk(CYL(0.05,0.07,0.1,12), c.MT, 0,0.12,0,c.g); for (let i=0;i<3;i++){ const a=i/3*TAU, ox=Math.cos(a), oz=Math.sin(a); mk(tube([[ox*0.03,0.12,oz*0.03],[ox*0.14,0.09,oz*0.14],[ox*0.22,0.04,oz*0.22]],0.02,10,6), c.MT, 0,0,0,c.g); mk(G.sph(0.035,10,8), c.MT, ox*0.24,0.035,oz*0.24,c.g); } c.y=0.16; } ],
  stem:[
    c=>{ mk(CYL(0.018,0.018,1.36-c.y,10), c.W, 0,(1.36+c.y)/2,0,c.g); c.sp=[0,1.36,0]; },
    c=>{ const h=1.36-c.y; mk(turnedLeg(h,0.04), c.W, 0,c.y,0,c.g); c.sp=[0,1.36,0]; },
    c=>{ const pts=[]; const h=1.36-c.y; for (let i=0;i<=40;i++){ const t=i/40; pts.push([Math.cos(t*TAU*5)*0.025, c.y+t*h, Math.sin(t*TAU*5)*0.025]); } mk(tube(pts,0.012,120,6), c.MT, 0,0,0,c.g); mk(CYL(0.01,0.01,h,6), c.MT, 0,c.y+h/2,0,c.g); c.sp=[0,1.36,0]; },
    c=>{ mk(tube([[0,c.y,0],[0,1.2,-0.05],[0.1,1.68,0.05],[0.42,1.62,0.25],[0.55,1.4,0.32]],0.016,30,8), c.MT, 0,0,0,c.g); c.sp=[0.55,1.42,0.32]; c.hang=true; },
    c=>{ mk(tube([[0,c.y,0],[0.04,c.y+(1.36-c.y)*0.35,0.02],[-0.03,c.y+(1.36-c.y)*0.7,-0.02],[0,1.36,0]],0.03,16,7), BARK(), 0,0,0,c.g); for (let i=0;i<3;i++) mk(G.sph(0.03,6,4), LEAF(), (c.r()-0.5)*0.1,c.y+0.3+i*0.3,(c.r()-0.5)*0.1,c.g).scale.set(1.4,0.5,0.6); c.sp=[0,1.36,0]; },
    c=>{ const h=1.36-c.y; mk(CYL(0.014,0.014,h,8), c.MT, 0,c.y+h/2,0,c.g); for (let i=0;i<7;i++) mk(CYL(0.04,0.04,0.035,14), i%2?c.W2:c.W, 0,c.y+0.1+i*(h-0.2)/6,0,c.g); c.sp=[0,1.36,0]; } ],
  shade:[
    c=>{ const [x,y,z]=c.sp; mk(CYL(0.22,0.22,0.3,24,1,true), DS(c.F), x,y+0.12,z,c.g); mk(CYL(0.2,0.2,0.28,20,1,true), GLOW(0xfff0c8), x,y+0.12,z,c.g); c.lightY=y+0.1; },
    c=>{ const [x,y,z]=c.sp; mk(CYL(0.13,0.26,0.32,24,1,true), DS(c.F), x,y+0.12,z,c.g); mk(CYL(0.12,0.24,0.3,20,1,true), GLOW(0xfff0c8), x,y+0.12,z,c.g); c.lightY=y+0.08; },
    c=>{ const [x,y,z]=c.sp; const geo=lathe([[0.02,0],[0.06,0.02],[0.14,0.12],[0.16,0.22],[0.13,0.28]],20); geo.scale(1,-1,1); geo.translate(0,0.24,0); const m=mk(geo, once('tulip:'+c.d.f, ()=>new THREE.MeshPhysicalMaterial({ color:col(FABRICS[c.d.f].c).lerp(col(0xffffff),0.5), emissive:col(FABRICS[c.d.f].c).lerp(col(0xfff0c8),0.6), emissiveIntensity:0.35, transparent:true, opacity:0.85, roughness:0.1, side:THREE.DoubleSide })), x,y-0.06,z,c.g); c.lightY=y; },
    c=>{ const [x,y,z]=c.sp; const d=mk(G.sph(0.22,24,12,0,TAU,0,Math.PI/2), DS(c.MT), x,y-0.02,z,c.g); d.scale.y=0.7; mk(G.sph(0.06,12,10), GLOW(0xfff0c8), x,y-0.04,z,c.g); c.lightY=y-0.05; },
    c=>{ const [x,y,z]=c.sp; mk(G.sph(0.07,14,12), GLOW(0xffd890), x,y+0.1,z,c.g); for (let i=0;i<6;i++){ const a=i/6*TAU; bar(c.g, c.MT, [x+Math.cos(a)*0.13,y-0.04,z+Math.sin(a)*0.13],[x+Math.cos(a)*0.13,y+0.26,z+Math.sin(a)*0.13],0.008); } for (const dy of [-0.04,0.26]){ const r=mk(G.tor(0.13,0.01,6,24), c.MT, x,y+dy,z,c.g); r.rotation.x=Math.PI/2; } mk(G.cone(0.17,0.1,6), c.MT, x,y+0.31,z,c.g); c.lightY=y+0.1; },
    c=>{ const [x,y,z]=c.sp; mk(G.sph(0.21,20,16), GLOW(0xfff4dc), x,y+0.14,z,c.g); for (let i=0;i<5;i++){ const r=mk(G.tor(0.21*Math.sin((i+1)/6*Math.PI),0.003,4,24), plain(0xd8ccb0), x,y+0.14+0.21*Math.cos((i+1)/6*Math.PI),z,c.g); r.rotation.x=Math.PI/2; } c.lightY=y+0.14; },
    c=>{ const [x,y,z]=c.sp; const cap=mk(G.sph(0.26,22,12,0,TAU,0,Math.PI/2), GLOW(0xff7a5a), x,y+0.04,z,c.g); cap.scale.y=0.6; for (let i=0;i<9;i++){ const a=i/9*TAU, k=i%2?0.6:0.85; mk(G.sph(0.025,6,4), plain(0xfff6e8), x+Math.cos(a)*0.26*k*0.9,y+0.04+0.16*Math.sqrt(1-k*k)+0.02,z+Math.sin(a)*0.26*k*0.9,c.g); } mk(CYL(0.18,0.18,0.01,22), GLOW(0xfff0d0), x,y+0.035,z,c.g); c.lightY=y; },
    c=>{ const [x,y,z]=c.sp; const cols=[0xe2483d,0x3a6ab0,0xf0c040,0x3a9a5a,0x8a4fa8,0xf08a3a]; for (let i=0;i<6;i++){ const a=i/6*TAU; const p=mk(CYL(0.11,0.26,0.28,1,1,true,a,TAU/6), DS(once('sg'+i, ()=>new THREE.MeshPhysicalMaterial({ color:cols[i], emissive:cols[i], emissiveIntensity:0.5, transparent:true, opacity:0.85, roughness:0.15 }))), x,y+0.12,z,c.g); }
      for (const [dy,rr] of [[-0.02,0.26],[0.26,0.11]]){ const t=mk(G.tor(rr,0.008,6,24), plain(0x2a2a2a,{metalness:0.6}), x,y+dy,z,c.g); t.rotation.x=Math.PI/2; } mk(G.sph(0.05,10,8), GLOW(0xfff0c8), x,y+0.08,z,c.g); c.lightY=y+0.08; },
    c=>{ const [x,y,z]=c.sp; for (let i=0;i<16;i++){ const a=i/16*TAU*2, ry=(i%8)/8; const l=mk(G.sph(0.09,8,6), once('leafglow', ()=>new THREE.MeshPhysicalMaterial({ color:0x9ad06a, emissive:0x7ab04a, emissiveIntensity:0.45, roughness:0.6, side:THREE.DoubleSide })), x+Math.cos(a)*0.14,y+0.04+ry*0.28,z+Math.sin(a)*0.14,c.g); l.scale.set(0.5,1.2,0.14); l.rotation.set(0.3,-a,0.4); } mk(G.sph(0.06,12,10), GLOW(0xf0ffd0), x,y+0.16,z,c.g); c.lightY=y+0.16; } ],
  top:[
    c=>{},
    c=>{ const [x,y,z]=c.sp; if (!c.hang) mk(G.sph(0.03,10,8), c.W2, x,y+0.33,z,c.g); mk(CYL(0.006,0.006,0.06,6), c.W2, x,y+0.3,z,c.g); },
    c=>{ const [x,y,z]=c.sp; for (let i=0;i<10;i++) mk(G.sph(0.006,6,4), c.MT, x+0.12,y+0.04-i*0.018,z+0.06,c.g); mk(CYL(0.01,0.014,0.03,8), c.MT, x+0.12,y-0.15,z+0.06,c.g); },
    c=>{ const [x,y,z]=c.sp; for (let i=0;i<20;i++){ const a=i/20*TAU; mk(CYL(0.006,0.002,0.05,4), c.F2, x+Math.cos(a)*0.24,y-0.06,z+Math.sin(a)*0.24,c.g); } },
    c=>{ const [x,y,z]=c.sp; const f=mk(G.sph(0.014,8,6), GLOW(0xd8ff7a), x+0.3,y+0.2,z,c.g); (c.g.userData.anims ||= []).push(t=>{ f.position.set(x+Math.cos(t*0.8)*0.32, y+0.18+Math.sin(t*1.7)*0.08, z+Math.sin(t*0.8)*0.32); }); } ],
};
function lamp(c){ const P=c.d.parts; LAMP.base[P.base](c); LAMP.stem[P.stem](c); LAMP.shade[P.shade](c); LAMP.top[P.top](c); }

/* =====================================================================
   DRESSER. The feet set c.y0; the body sets c.box (w, h, d) and c.panels, the rectangles on its front
   ([x, y, w, h, kind] with kind 'drawer' or 'door'). Fronts dress the panels; handles go on them.
   ===================================================================== */
const DRESSER = {
  feet:[
    c=>{ c.y0=0.08; c.foot=g=>mk(G.box(c.box.w,0.08,c.box.d-0.02), c.W, 0,0.04,0,g); },
    c=>{ c.y0=0.08; c.foot=g=>{ for (const x of [-1,1]) for (const z of [-1,1]) mk(G.sph(0.05,12,10), c.W, x*(c.box.w/2-0.07),0.045,z*(c.box.d/2-0.07),g); }; },
    c=>{ c.y0=0.26; c.foot=g=>{ for (const x of [-1,1]) for (const z of [-1,1]){ const l=mk(CYL(0.024,0.012,0.27,8), c.W, x*(c.box.w/2-0.08),0.13,z*(c.box.d/2-0.07),g); l.rotation.z=x*0.08; } }; },
    c=>{ c.y0=0.12; c.foot=g=>{ for (const x of [-1,1]) for (const z of [-1,1]){ const s=new THREE.Shape(); s.moveTo(0,0); s.lineTo(0.12,0); s.quadraticCurveTo(0.12,0.09,0.02,0.11); s.lineTo(0,0.11); const m=mk(cut(s,0.03), c.W, x*(c.box.w/2-0.02),0,z*(c.box.d/2-0.03),g); m.scale.x=-x; } mk(G.box(c.box.w,0.025,c.box.d), c.W, 0,0.11,0,g); }; },
    c=>{ c.y0=0.24; c.foot=g=>{ for (const x of [-1,1]) for (const z of [-1,1]) cabLeg(g, c.W, x*(c.box.w/2-0.07), z*(c.box.d/2-0.07), 0.25, 0.024); }; },
    c=>{ c.y0=0.12; c.foot=g=>{ roots(g, 0, 0, Math.max(c.box.w,c.box.d)*0.55, 0.12, 7, c.r); mk(G.box(c.box.w,0.04,c.box.d), BARK(), 0,0.11,0,g); }; } ],
  body:[
    c=>{ c.box={ w:1.0, h:0.9, d:0.5 }; c.panels=[0,1,2].map(i=>[0, 0.06+i*0.28, 0.9, 0.24, 'drawer']); },
    c=>{ c.box={ w:1.5, h:0.8, d:0.5 }; c.panels=[[-0.48,0.06,0.44,0.66,'door'],[0,0.5,0.44,0.22,'drawer'],[0,0.06,0.44,0.4,'door'],[0.48,0.06,0.44,0.66,'door']]; },
    c=>{ c.box={ w:0.95, h:1.65, d:0.48 }; c.panels=[[-0.22,0.7,0.42,0.88,'door'],[0.22,0.7,0.42,0.88,'door'],[0,0.36,0.86,0.28,'drawer'],[0,0.05,0.86,0.28,'drawer']]; },
    c=>{ c.box={ w:1.05, h:0.88, d:0.52, bombe:true }; c.panels=[0,1,2].map(i=>[0, 0.06+i*0.27, 0.92, 0.23, 'drawer']); },
    c=>{ c.box={ w:1.1, h:1.05, d:0.45 }; c.panels=[]; for (let i=0;i<4;i++) for (let j=0;j<4;j++) c.panels.push([-0.405+j*0.27, 0.06+i*0.245, 0.25, 0.22, 'drawer']); },
    c=>{ c.box={ w:1.1, h:0.8, d:0.55, log:true }; c.panels=[[-0.25,0.08,0.46,0.64,'door'],[0.25,0.08,0.46,0.64,'door']]; } ],
  fronts:[
    (c,[x,y,w,h])=>{ mk(slab(w,0.02,h,0.012), c.W2, x,y,c.z,c.g); },
    (c,[x,y,w,h])=>{ mk(slab(w,0.02,h,0.01), c.W2, x,y,c.z,c.g); mk(slab(w-0.1,0.015,h-0.1,0.01), c.W, x,y+0.05,c.z+0.012,c.g); },
    (c,[x,y,w,h,k])=>{ if (k==='drawer') return DRESSER.fronts[0](c,[x,y,w,h]); for (const [dx,dy,ww,hh] of [[0,0,w,0.04],[0,h-0.04,w,0.04],[-w/2+0.02,0,0.04,h],[w/2-0.02,0,0.04,h]]) mk(G.box(ww,hh,0.025), c.W2, x+dx,y+dy+hh/2,c.z+0.01,c.g); mk(G.box(w-0.06,h-0.06,0.008), GLASS, x,y+h/2,c.z+0.006,c.g);
      const r=mulberry32(Math.round(x*100+y*10)); for (let i=0;i<3;i++){ mk(CYL(0.03,0.04,0.08+r()*0.04,10), CERAMIC([0xf2e8d4,0x8ac0e0,0xd99a9a][i]), x-0.1+i*0.1,y+0.08+((i%2)*h*0.45),c.z-0.06,c.g); } },
    (c,[x,y,w,h])=>{ mk(slab(w,0.02,h,0.012), c.W2, x,y,c.z,c.g); const s=new THREE.Shape(), rx=Math.min(w,h)*0.32; s.moveTo(-rx,0); s.bezierCurveTo(-rx,rx*0.9,rx,rx*0.9,rx,0); s.bezierCurveTo(rx,-rx*0.9,-rx,-rx*0.9,-rx,0); const hole=new THREE.Path(); hole.absellipse(0,0,rx*0.6,rx*0.4,0,TAU,true); s.holes.push(hole);
      const m=mk(cut(s,0.014), c.W2, x,y+h/2,c.z+0.022,c.g); m.scale.set(w/(rx*2.6),h/(rx*2.4),1); for (const sx of [-1,1]){ const l=mk(G.sph(0.03,8,6), c.W2, x+sx*w*0.36,y+h/2,c.z+0.02,c.g); l.scale.set(1.6,0.6,0.3); l.rotation.z=sx*0.5; } },
    (c,[x,y,w,h])=>{ mk(slab(w,0.02,h,0.012), c.W2, x,y,c.z,c.g); const r=mulberry32(Math.round(x*97+y*31)); for (let i=0;i<4;i++){ const fx=x+(r()-0.5)*w*0.7, fy=y+h*(0.25+r()*0.5); for (let k=0;k<5;k++){ const a=k/5*TAU; mk(CYL(0.018,0.018,0.004,8), plain([0xf090b0,0xffffff,0xf8d040,0x8ac0e0][i%4]), fx+Math.cos(a)*0.02,fy+Math.sin(a)*0.02,c.z+0.022,c.g).rotation.x=Math.PI/2; } mk(CYL(0.012,0.012,0.005,8), plain(0xf8d040), fx,fy,c.z+0.024,c.g).rotation.x=Math.PI/2; const lf=mk(G.sph(0.02,6,4), LEAF(), fx+0.035,fy-0.02,c.z+0.022,c.g); lf.scale.set(1.6,0.6,0.2); } },
    (c,[x,y,w,h,k])=>{ const n=Math.max(2,Math.round(w/0.1)); for (let i=0;i<n;i++) mk(G.box(w/n-0.006,h,0.025), c.W2, x-w/2+(i+0.5)*w/n,y+h/2,c.z+0.012,c.g); if (k==='door' && h>0.3){ for (const yy of [0.15,h-0.15]) mk(G.box(w-0.04,0.06,0.02), c.W2, x,y+yy,c.z+0.03,c.g); const z=mk(G.box(0.05,Math.hypot(w-0.1,h-0.3),0.02), c.W2, x,y+h/2,c.z+0.03,c.g); z.rotation.z=Math.atan2(w-0.1,h-0.3); } },
    (c,[x,y,w,h])=>{ mk(slab(w,0.015,h,0.008), c.W, x,y,c.z-0.004,c.g); const n=Math.max(3,Math.round(h/0.05)); for (let i=0;i<n;i++){ const s=mk(G.box(w-0.03,h/n*0.6,0.02), c.W2, x,y+(i+0.5)*h/n,c.z+0.014,c.g); s.rotation.x=-0.3; } } ],
  pulls:[
    (c,x,y,z)=>{ mk(G.sph(0.022,10,8), c.W2, x,y,z+0.02,c.g).scale.z=0.7; },
    (c,x,y,z)=>{ mk(CYL(0.018,0.018,0.012,10), c.MT, x,y+0.02,z+0.006,c.g).rotation.x=Math.PI/2; const r=mk(G.tor(0.026,0.005,6,18), c.MT, x,y-0.008,z+0.018,c.g); },
    (c,x,y,z,w)=>{ const L=Math.min(0.18, w*0.4); bar(c.g, c.MT, [x-L/2,y,z+0.03],[x+L/2,y,z+0.03],0.008); for (const s of [-1,1]) bar(c.g, c.MT, [x+s*L/2,y,z],[x+s*L/2,y,z+0.03],0.007); },
    (c,x,y,z)=>{ const cp=mk(CYL(0.04,0.04,0.03,16,1,true,0,Math.PI), DS(c.MT), x,y,z+0.015,c.g); cp.rotation.x=Math.PI/2; cp.rotation.z=Math.PI; },
    (c,x,y,z)=>{ const l=mk(G.sph(0.035,8,6), LEAF(), x,y,z+0.015,c.g); l.scale.set(1.5,0.6,0.3); l.rotation.z=0.5; mk(CYL(0.004,0.004,0.04,4), BARK(), x-0.04,y-0.02,z+0.015,c.g).rotation.z=1.0; },
    (c,x,y,z)=>{ mk(G.dod(0.022), once('crystal', ()=>new THREE.MeshPhysicalMaterial({ color:0xe8f6ff, roughness:0.05, transmission:0, clearcoat:1, metalness:0.1, transparent:true, opacity:0.75 })), x,y,z+0.025,c.g); mk(CYL(0.01,0.01,0.02,8), c.MT, x,y,z+0.005,c.g).rotation.x=Math.PI/2; } ],
  top:[
    c=>{},
    c=>{ const B=c.box, y=c.y0+B.h, fw=Math.min(0.8,B.w*0.7); mk(slab(fw,0.04,0.7,0.03), c.W2, 0,y,-B.d/2+0.06,c.g); mk(G.box(fw-0.1,0.6,0.005), once('mirror', ()=>new THREE.MeshPhysicalMaterial({ color:0xd8e8f0, emissive:0x8aa8b8, emissiveIntensity:0.35, metalness:0.6, roughness:0.08, clearcoat:1 })), 0,y+0.35,-B.d/2+0.085,c.g); for (const s of [-1,1]) mk(G.sph(0.03,10,8), c.W2, s*fw/2,y+0.72,-B.d/2+0.06,c.g); },
    c=>{ const B=c.box, y=c.y0+B.h; bar(c.g, c.W2, [-B.w/2+0.03,y+0.12,-B.d/2+0.04],[B.w/2-0.03,y+0.12,-B.d/2+0.04],0.012); for (let i=0;i<=Math.round(B.w/0.08);i++) mk(CYL(0.008,0.008,0.12,6), c.W2, -B.w/2+0.03+i*(B.w-0.06)/Math.round(B.w/0.08),y+0.06,-B.d/2+0.04,c.g); },
    c=>{ const B=c.box, y=c.y0+B.h; const s=new THREE.Shape(); s.moveTo(-B.w/2,0); s.lineTo(B.w/2,0); s.bezierCurveTo(B.w/2,0.08,B.w/6,0.06,0.05,0.18); s.lineTo(-0.05,0.18); s.bezierCurveTo(-B.w/6,0.06,-B.w/2,0.08,-B.w/2,0); mk(cut(s,0.04), c.W2, 0,y,-B.d/2+0.04,c.g); mk(G.sph(0.035,10,8), c.W2, 0,y+0.22,-B.d/2+0.04,c.g); },
    c=>{ plant(c.g, c.box.w/2-0.18, c.y0+c.box.h, 0, c.r, 1.6); },
    c=>{ const y=c.y0+c.box.h; for (const [x,h] of [[-0.25,0.2],[-0.17,0.14],[0.3,0.18]]){ mk(CYL(0.04,0.05,0.02,12), c.MT, x,y+0.01,0,c.g); mk(CYL(0.022,0.022,h,10), plain(0xfaf4e6), x,y+0.02+h/2,0,c.g); mk(G.sph(0.014,8,6), GLOW(0xffc860), x,y+0.04+h,0,c.g).scale.y=1.6; } c.lightY=y+0.3; } ],
};
function dresser(c){ const P=c.d.parts; DRESSER.feet[P.feet](c); DRESSER.body[P.body](c); const B=c.box, g=c.g; c.foot(g);
  const y0=c.y0; if (B.log){ for (let k=0;k<5;k++){ const l=mk(CYL(0.085,0.085,B.w+0.1,10), BARK(), 0,y0+0.085+k*0.16,-0.02,g); l.rotation.z=Math.PI/2; } mk(slab(B.w+0.1,B.d+0.04,0.05,0.02), c.W, 0,y0+B.h,0,g); }
  else if (B.bombe){ const bd=mk(G.sph(0.5,24,16), c.W, 0,y0+B.h/2,0,g); bd.scale.set(B.w*1.02,B.h*1.0,B.d*1.02); mk(G.box(B.w-0.06,B.h-0.04,B.d-0.1), c.W, 0,y0+B.h/2,0,g); mk(slab(B.w+0.06,B.d+0.04,0.04,0.02), c.W2, 0,y0+B.h,0,g); }
  else { mk(slab(B.w,B.d,B.h,0.02), c.W, 0,y0,0,g); mk(slab(B.w+0.04,B.d+0.03,0.035,0.015), c.W2, 0,y0+B.h,0.01,g); }
  c.z = B.d/2 + (B.bombe ? 0.03 : 0.005) + (B.log ? 0.03 : 0);
  for (const pn of c.panels){ const [x,y,w,h,k]=pn, ap=[x, y0+y, w-0.02, h-0.02, k]; DRESSER.fronts[P.fronts](c, ap);
    if (k==='drawer') DRESSER.pulls[P.pulls](c, x, y0+y+h/2, c.z+0.02, w); else DRESSER.pulls[P.pulls](c, x + (x<=0 ? w/2-0.07 : -w/2+0.07), y0+y+h/2, c.z+0.02, w); }
  DRESSER.top[P.top](c); }

const BUILD = { chair, table, bed, shelf, lamp, dresser };

export function buildCustom(g, id){
  const d=decode(id); if (!d){ mk(G.box(0.5,0.5,0.5), plain(0xcccccc), 0,0.25,0,g); return g; }
  const c={ g, d, r:mulberry32(hashStr(id)), W:woodOf(d.w), W2:woodOf(d.w2), MT:metalOf(d.m), F:fabricOf(d.f,d.p), F2:fabricOf(d.f,0,0.12), top:0 };
  BUILD[d.base](c);
  if (glows(d)) addGlow(g, d.base==='lamp' ? (c.lightY||1.3) : (c.lightY||0.8), d.base==='lamp'?2.6:1.2, 0xffd890);
  g.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g;
}
ITEM_BUILDERS.custom = (g, d, id) => buildCustom(g, id || d.code);
