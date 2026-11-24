// v1.19 wardrobe: 10 more outfits, 10 more outfit colors and 30 accessories (hats, glasses, neckwear, backpacks).
// Everything here is built from primitives and canvas textures, like the rest of the plush critters.
// chars.js calls buildOutfitNew() for the new outfits and dressAccessories() for the player's worn accessories.
// Order matters: look codes store indexes, so only ever APPEND to these lists.
import * as THREE from 'three';
import { knit } from './look.js';

const TAU=Math.PI*2, V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const TORSO_Y=0.7;

import { OUTFITS_NEW, BASE_COLOR_NAMES, COLORS_NEW, SLOTS, SLOT_NAMES, ACCESSORIES, BY_SLOT, SLOT_N, ACC_BY_ID } from './wardrobe-data.js';
export { OUTFITS_NEW, BASE_COLOR_NAMES, COLORS_NEW, SLOTS, SLOT_NAMES, ACCESSORIES, BY_SLOT, SLOT_N, ACC_BY_ID };

/* ================= materials and helpers ================= */
const MATS=new Map();
function mat(color, o={}){ const k=color+':'+JSON.stringify(o); let m=MATS.get(k); if (!m){ m=new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.62, metalness:0 }, o)); m.userData.char=true; MATS.set(k,m); } return m; }
const gloss = c => mat(c, { roughness:0.24 });
const satin = c => mat(c, { roughness:0.38 });
const metal = c => mat(c, { metalness:0.85, roughness:0.28 });
const gold  = () => metal(0xe8b84a);
const glass = (c=0xe8f4ff, op=0.28) => mat(c, { transparent:true, opacity:op, roughness:0.05, depthWrite:false });
const glowM = (c, k=0.9) => mat(c, { emissive:c, emissiveIntensity:k, roughness:0.35 });
// canvas-textured material (kept out of the felt swap: chars.js leaves mapped materials alone)
function texMat(key, w, h, draw, o={}, rep=[1,1]){ return MATS.get('t:'+key) || (()=>{ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'), w, h);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); t.anisotropy=4;
  const m=new THREE.MeshStandardMaterial(Object.assign({ map:t, roughness:0.8 }, o)); m.userData.char=true; MATS.set('t:'+key, m); return m; })(); }
function mesh(geo, m, x=0,y=0,z=0, parent, shadow=true){ const o=new THREE.Mesh(geo, m); o.position.set(x,y,z); o.castShadow=shadow; o.receiveShadow=true; if (parent) parent.add(o); return o; }
const sph=(r,w=22,h=16,...a)=>new THREE.SphereGeometry(r,w,h,...a);
const shade=(c,l,s=0)=>new THREE.Color(c).offsetHSL(0,s,l).getHex();
const mix=(a,b,t)=>new THREE.Color(a).lerp(new THREE.Color(b),t).getHex();
const hexCss=c=>'#'+new THREE.Color(c).getHexString();
const lathe=(pts,seg=40)=>new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),seg);
const curve=pts=>new THREE.CatmullRomCurve3(pts.map(p=>Array.isArray(p)?V3(...p):p));
const tubeG=(pts,r,seg=32,rs=8)=>new THREE.TubeGeometry(curve(pts),seg,r,rs,false);
const lum=c=>new THREE.Color(c).getHSL({}).l;
const hue=c=>new THREE.Color(c).getHSL({}).h;
// tapered tube with UVs (u around, v along) and capped ends
function taper(pts, rf, seg=14, rows=40){ const C=curve(pts), P=C.getPoints(rows), pos=[], uv=[], idx=[];
  for (let i=0;i<=rows;i++){ const t=i/rows, T=C.getTangent(t), up=Math.abs(T.y)>0.9?V3(1,0,0):V3(0,1,0), s=V3().crossVectors(up,T).normalize(), b=V3().crossVectors(T,s).normalize(), r=rf(t);
    for (let k=0;k<=seg;k++){ const a=k/seg*TAU; pos.push(P[i].x+(s.x*Math.cos(a)+b.x*Math.sin(a))*r, P[i].y+(s.y*Math.cos(a)+b.y*Math.sin(a))*r, P[i].z+(s.z*Math.cos(a)+b.z*Math.sin(a))*r); uv.push(k/seg, t); } }
  for (let i=0;i<rows;i++) for (let k=0;k<seg;k++){ const a=i*(seg+1)+k, b=a+seg+1; idx.push(a,a+1,b, a+1,b+1,b); }
  for (const [i,flip] of [[0,true],[rows,false]]){ const c=pos.length/3; pos.push(P[i].x,P[i].y,P[i].z); uv.push(0.5,i/rows); for (let k=0;k<seg;k++){ const a=i*(seg+1)+k; if (flip) idx.push(c,a,a+1); else idx.push(c,a+1,a); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
// a thin bar (box) from a to b
function bar(parent, m, a, b, w=0.03, t=0.02){ a=Array.isArray(a)?V3(...a):a; b=Array.isArray(b)?V3(...b):b; const L=a.distanceTo(b);
  const o=mesh(new THREE.BoxGeometry(w,L,t), m, (a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2, parent); o.quaternion.setFromUnitVectors(V3(0,1,0), b.clone().sub(a).normalize()); return o; }
// ring around the torso at height y; gap (radians) opens toward the front
function band(parent, y, r, t, m, gap=0, zs=0.86, seg=56){ const g=new THREE.Group(); g.position.y=y; g.scale.set(1,1,zs); parent.add(g);
  const o=mesh(new THREE.TorusGeometry(r,t,10,seg,TAU-gap), m, 0,0,0,g); o.rotation.set(Math.PI/2,0,Math.PI/2+gap/2); return o; }
// radius of the torso ellipsoid (sphere r, squashed 0.92 high) at height y
const radAt=(r,y)=>{ const l=(y-TORSO_Y)/0.92; return Math.sqrt(Math.max(0.0004, r*r-l*l)); };
// a point on the torso surface: a = angle around (0 = front, +a toward the critter's left), sz = depth squash
const surf=(r,y,a,sz=0.86)=>{ const s=radAt(r,y); return V3(Math.sin(a)*s, y, Math.cos(a)*s*sz); };
const surfN=(y,a)=>{ const p=surf(0.5,y,a); return V3(p.x, (p.y-TORSO_Y)/(0.92*0.92), p.z/(0.86*0.86)).normalize(); };
// a flat thing lying on the torso surface (pockets, patches, flaps)
function onSurf(parent, o, y, a, r=0.5, out=0.006){ const p=surf(r,y,a), n=surfN(y,a); o.position.copy(p).addScaledVector(n,out); o.quaternion.setFromUnitVectors(V3(0,0,1), n); parent.add(o); return o; }
function onSkirt(parent, o, y, a, r, zs, out=0.01){ const n=V3(Math.sin(a),0,Math.cos(a)/zs).normalize(); o.position.set(Math.sin(a)*r, y, Math.cos(a)*r*zs).addScaledVector(n,out); o.quaternion.setFromUnitVectors(V3(0,0,1), n); parent.add(o); return o; }
function crescent(R){ const s=new THREE.Shape(), b=Math.atan2(R,-0.35*R); s.absarc(0,0,R,Math.PI/2,Math.PI*1.5,false); s.absarc(0.35*R,0,Math.hypot(R,0.35*R),-b,b,true); return s; }
function shell(body, r, t0, t1, m, phiS=0, phiL=TAU){ const o=mesh(sph(r,44,20,phiS,phiL,Math.PI*t0,Math.PI*(t1-t0)), m, 0,TORSO_Y,0, body); o.scale.set(1,0.92,0.86); return o; }
// sleeves on the stubby arms; returns each sleeve's far end (for cuffs)
function sleeves(arms, m, len, o={}){ const ends=[];
  for (const a of arms){ const s=a.userData.side, r=o.r||0.124, cy=-0.08+(0.12-len)*0.3; const sl=mesh(new THREE.CapsuleGeometry(r,len,8,18), m, s*0.03,cy,0, a); sl.rotation.z=s*0.25;
    const h=len/2+(o.cuffAt??0.05), e=V3(s*0.03+Math.sin(0.25)*s*h, cy-Math.cos(0.25)*h, 0); ends.push({ a, s, e });
    if (o.cuff){ const cf=mesh(new THREE.TorusGeometry(o.cr||0.112, o.ct||0.032, 10, 26), o.cuff, e.x,e.y,e.z, a); cf.rotation.order='ZXY'; cf.rotation.set(Math.PI/2,0,s*0.25); } }
  return ends; }
function button(parent, p, n, m, r=0.024){ const b=mesh(new THREE.CylinderGeometry(r,r,0.014,16), m, 0,0,0, parent, false); b.position.copy(p).addScaledVector(n,0.004); b.quaternion.setFromUnitVectors(V3(0,1,0), n); return b; }

/* ---------- canvas patterns ---------- */
function plaidMat(c){ return texMat('plaid:'+c, 128,128,(x,W,H)=>{ const dk=hexCss(shade(c,-0.18)), lt=hexCss(mix(c,0xffffff,0.55));
  x.fillStyle=hexCss(c); x.fillRect(0,0,W,H); x.globalAlpha=0.55; x.fillStyle=dk; x.fillRect(0,40,W,34); x.fillRect(40,0,34,H); x.globalAlpha=0.35; x.fillRect(0,96,W,10); x.fillRect(96,0,10,H);
  x.globalAlpha=0.8; x.fillStyle=lt; x.fillRect(0,20,W,3); x.fillRect(20,0,3,H); x.globalAlpha=0.5; x.fillStyle='#222'; x.fillRect(0,56,W,2); x.fillRect(56,0,2,H); x.globalAlpha=1;
  for (let i=0;i<900;i++){ x.fillStyle=`rgba(255,255,255,${Math.random()*0.06})`; x.fillRect(Math.random()*W,Math.random()*H,1,1); } }, { roughness:0.85 }, [4,2]); }
function starMat(c, side=THREE.FrontSide){ return texMat('star:'+c+':'+side, 256,256,(x,W,H)=>{ x.fillStyle=hexCss(c); x.fillRect(0,0,W,H);
  let s=7; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  const star=(cx,cy,R)=>{ x.beginPath(); for (let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rr=i%2?R*0.45:R; x.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); } x.closePath(); x.fill(); };
  for (let i=0;i<14;i++){ x.fillStyle=i%3?'#f8d868':'#fff4c8'; star(r()*W, r()*H, 7+r()*7); }
  for (let i=0;i<5;i++){ const cx=r()*W, cy=r()*H, R=9+r()*5; x.fillStyle='#f8e8a8'; x.beginPath(); x.arc(cx,cy,R,0,TAU); x.fill(); x.fillStyle=hexCss(c); x.beginPath(); x.arc(cx+R*0.45,cy-R*0.2,R*0.9,0,TAU); x.fill(); }
  for (let i=0;i<60;i++){ x.fillStyle='rgba(255,248,220,.75)'; x.beginPath(); x.arc(r()*W, r()*H, 1+r()*1.2, 0, TAU); x.fill(); } }, { roughness:0.7, side }, [3,2]); }
function stripeMat(c, base, n=8, side=THREE.FrontSide){ return texMat('stripe:'+c+':'+base+':'+n+':'+side, 128,32,(x,W,H)=>{ x.fillStyle=hexCss(base); x.fillRect(0,0,W,H); x.fillStyle=hexCss(c); for (let i=0;i<n;i++) x.fillRect(i*W/n, 0, W/n*0.42, H); }, { roughness:0.8, side }, [3,1]); }
function dotsMat(c, dot=0xffffff){ return texMat('dots:'+c+':'+dot, 128,128,(x,W,H)=>{ x.fillStyle=hexCss(c); x.fillRect(0,0,W,H); x.fillStyle=hexCss(dot);
  for (let j=0;j<6;j++) for (let i=0;i<6;i++){ const cx=i*W/6+(j%2)*W/12+8, cy=j*H/6+10; x.beginPath(); x.arc(cx,cy,4,0,TAU); x.fill(); for (let k=0;k<4;k++){ const a=k*Math.PI/2+0.4; x.beginPath(); x.arc(cx+Math.cos(a)*8,cy+Math.sin(a)*8,1.6,0,TAU); x.fill(); } } }, { roughness:0.8 }, [3,2]); }
function strawMat(){ return texMat('straw', 128,128,(x,W,H)=>{ x.fillStyle='#e8c97a'; x.fillRect(0,0,W,H);
  for (let j=0;j<16;j++) for (let i=0;i<16;i++){ const over=(i+j)%2; x.fillStyle=over?'#f2d890':'#d4b060'; x.fillRect(i*8+(over?0:1), j*8+(over?1:0), over?8:6, over?6:8);
    x.strokeStyle='rgba(120,80,30,.35)'; x.lineWidth=0.8; x.strokeRect(i*8+0.5,j*8+0.5,7,7); } }, { roughness:0.9 }, [6,2]); }
function canvasMat(c){ return texMat('canvas:'+c, 64,64,(x,W,H)=>{ x.fillStyle=hexCss(c); x.fillRect(0,0,W,H); for (let i=0;i<W;i+=2){ x.fillStyle=`rgba(0,0,0,${0.04+Math.random()*0.04})`; x.fillRect(i,0,1,H); x.fillRect(0,i,W,1); } }, { roughness:0.92 }, [3,3]); }
function letterMat(c, ring){ return texMat('letter:'+c+':'+ring, 128,128,(x,W,H)=>{ x.clearRect(0,0,W,H); x.fillStyle=hexCss(ring); x.beginPath(); x.arc(64,64,62,0,TAU); x.fill(); x.fillStyle=hexCss(c); x.beginPath(); x.arc(64,64,52,0,TAU); x.fill();
  x.fillStyle=hexCss(ring); x.font='bold 84px Georgia, serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('D',66,70); }, { transparent:true, roughness:0.95, polygonOffset:true, polygonOffsetFactor:-2 }); }
function wingMat(c1, c2){ return texMat('wing:'+c1+':'+c2, 256,256,(x,W,H)=>{ const g=x.createRadialGradient(20,128,10,40,128,240); g.addColorStop(0,hexCss(c2)); g.addColorStop(0.55,hexCss(c1)); g.addColorStop(0.92,hexCss(shade(c1,-0.25))); g.addColorStop(1,'#2a1a30');
  x.fillStyle=g; x.fillRect(0,0,W,H); x.strokeStyle='rgba(40,20,50,.55)'; x.lineWidth=3; for (let i=0;i<7;i++){ x.beginPath(); x.moveTo(10,128); x.quadraticCurveTo(120,128+(i-3)*30,250,128+(i-3)*60); x.stroke(); }
  for (const [cx,cy,r] of [[170,80,26],[190,170,20]]){ x.fillStyle='#2a1a30'; x.beginPath(); x.arc(cx,cy,r,0,TAU); x.fill(); x.fillStyle='#fff4d0'; x.beginPath(); x.arc(cx,cy,r*0.62,0,TAU); x.fill(); x.fillStyle=hexCss(c2); x.beginPath(); x.arc(cx,cy,r*0.36,0,TAU); x.fill(); }
  x.fillStyle='rgba(255,255,255,.85)'; for (let i=0;i<14;i++){ const a=-1.2+i*0.18; x.beginPath(); x.arc(128+Math.cos(a)*118, 128+Math.sin(a)*118, 4, 0, TAU); x.fill(); } }, { side:THREE.DoubleSide, transparent:true, alphaTest:0.1, roughness:0.45, emissive:0x1a0a20, emissiveIntensity:0.2 }); }

/* small reusable bits */
function bloom(parent, petals, c, center, r=0.045, n=5, cup=0.35){ const f=new THREE.Group(); parent.add(f);
  for (let i=0;i<n;i++){ const a=i/n*TAU, p=mesh(sph(r,12,8), mat(c), Math.cos(a)*r*1.05, 0, Math.sin(a)*r*1.05, f, false); p.scale.set(1.1,cup,0.7); p.rotation.y=-a; }
  mesh(sph(r*0.6,12,10), mat(center), 0,r*0.2,0, f, false).scale.y=0.7; return f; }
function leaf(parent, x,y,z, c=0x5a9a48, s=0.05){ const l=mesh(sph(s,10,6), mat(c), x,y,z, parent, false); l.scale.set(0.5,0.18,1.3); return l; }
function heartShape(s=1){ const h=new THREE.Shape(); h.moveTo(0,-0.6*s); h.bezierCurveTo(-0.95*s,0.05*s,-0.55*s,0.9*s,0,0.42*s); h.bezierCurveTo(0.55*s,0.9*s,0.95*s,0.05*s,0,-0.6*s); return h; }
function starShape(R, r, n=5){ const s=new THREE.Shape(); for (let i=0;i<n*2;i++){ const a=Math.PI/2+i*Math.PI/n, rr=i%2?r:R; const p=[Math.cos(a)*rr, Math.sin(a)*rr]; if (i) s.lineTo(...p); else s.moveTo(...p); } s.closePath(); return s; }
const extrude=(shape, d, bevel=0.006)=>{ const g=new THREE.ExtrudeGeometry(shape, { depth:d, bevelEnabled:bevel>0, bevelThickness:bevel, bevelSize:bevel, bevelSegments:3, curveSegments:16 }); g.translate(0,0,-d/2); return g; };
// a path that hangs around the neck, hugging the clothes: dip = how far it drops at the front
function neckPath(dip, n=40, y0=1.1, r=0.53){ const pts=[]; for (let i=0;i<n;i++){ const a=i/n*TAU, f=Math.pow((1+Math.cos(a))/2, 2.2), y=y0-dip*f; const s=radAt(r,y); pts.push(V3(Math.sin(a)*s, y, Math.cos(a)*s*0.9)); } return pts; }

/* ================= outfits ================= */
const OUTFIT_BUILD = {
  sailor(body, arms, c){ const W=mat(0xf8f6f0), C=mat(c), knotC = (hue(c)<0.06||hue(c)>0.93) && lum(c)>0.25 ? 0xf2c040 : 0xe2483d;
    shell(body,0.49,0.12,0.6,W); sleeves(arms, W, 0.05, { cuff:C, cr:0.11, ct:0.026 });
    shell(body,0.486,0.6,0.88,mat(shade(c,-0.1))); band(body, 0.57, radAt(0.49,0.57)+0.004, 0.022, C);
    // the square sailor collar over the back, two white stripes round its edge
    const flap=new THREE.Group(); flap.position.set(0,0.9,-0.405); flap.rotation.x=0.5; body.add(flap);
    mesh(new THREE.BoxGeometry(0.58,0.36,0.022), C, 0,0,0, flap); for (const d of [0.028,0.058]){ mesh(new THREE.BoxGeometry(0.58-d*2,0.012,0.026), W, 0,-0.18+d,0.001, flap); for (const s of [-1,1]) mesh(new THREE.BoxGeometry(0.012,0.33-d,0.026), W, s*(0.29-d),0.012,0.001, flap); }
    for (const s of [-1,1]){ mesh(tubeG([surf(0.515,1.04,s*1.9),surf(0.52,0.98,s*1.1),surf(0.525,0.92,s*0.5),surf(0.53,0.87,s*0.08)],0.034,24,8), C, 0,0,0, body); mesh(tubeG([surf(0.55,1.03,s*1.9),surf(0.555,0.975,s*1.1),surf(0.56,0.915,s*0.5),surf(0.565,0.875,s*0.1)],0.008,24,5), W, 0,0,0, body); }
    const K=mat(knotC); mesh(sph(0.055,16,12), K, 0,0.86,0.44, body).scale.set(1.2,0.9,0.7);
    for (const s of [-1,1]){ const t=mesh(new THREE.ConeGeometry(0.05,0.18,12), K, s*0.04,0.75,0.45, body); t.rotation.set(-0.15,0,Math.PI+s*0.25); t.scale.z=0.35; } },

  raincoat(body, arms, c){ const P=mat(c,{ roughness:0.26 }), D=mat(shade(c,-0.12),{ roughness:0.3 }), tog=mat(0xf0e2c0,{ roughness:0.4 });
    shell(body,0.5,0.12,0.6,P); const sk=mesh(lathe([[0.46,0.6],[0.5,0.46],[0.555,0.3],[0.585,0.2]],48), mat(c,{ roughness:0.26, side:THREE.DoubleSide }), 0,0,0, body); sk.scale.z=0.9;
    band(body, 0.2, 0.585, 0.02, D, 0, 0.9); sleeves(arms, P, 0.15, { cuff:D, cr:0.118, ct:0.026 });
    const hood=mesh(sph(0.25,28,14,0,TAU,0,Math.PI/2), mat(c,{ roughness:0.26, side:THREE.DoubleSide }), 0,0.96,-0.34, body); hood.rotation.x=-Math.PI/2+0.35; hood.scale.set(1.25,0.55,1); const hr=mesh(new THREE.TorusGeometry(0.25,0.03,8,30), D, 0,0.96,-0.34, body); hr.rotation.x=0.35; hr.scale.set(1.25,1,1);
    mesh(tubeG([0.12,0.24,0.36,0.48,0.58].map(t=>{ const y=1.1-t*1.4; return y>0.6 ? surf(0.505,y,0) : V3(0,y,(0.46*((y-0.2)/0.4)+0.585*(1-(y-0.2)/0.4))*0.9+0.004); }), 0.009, 24, 6), D, 0,0,0, body);
    for (const y of [0.98,0.82,0.66]){ const n=surfN(y,0), p=surf(0.5,y,0).addScaledVector(n,0.02); const t=mesh(new THREE.CapsuleGeometry(0.016,0.06,4,10), tog, p.x,p.y,p.z, body); t.rotation.z=Math.PI/2; const l=mesh(new THREE.TorusGeometry(0.03,0.006,6,14), D, p.x-0.04,p.y,p.z-0.004, body, false); l.scale.x=1.4; }
    for (const s of [-1,1]) onSkirt(body, mesh(new THREE.BoxGeometry(0.16,0.06,0.025), D), 0.42, s*0.6, 0.516, 0.9, 0.012); },

  cardigan(body, arms, c){ const K=knit(c,null,14), R=knit(shade(c,-0.06),null,20), B=gloss(lum(c)<0.35?0xe8d8b8:0x7a4a2a);
    shell(body,0.482,0.12,0.6,mat(0xf6f2ea)); shell(body,0.484,0.6,0.88,mat(0x56688a)); band(body,0.56,radAt(0.484,0.56)+0.004,0.016,mat(0xe8e2d4));
    const gap=0.34; shell(body,0.5,0.12,0.67,K,Math.PI/2+gap,TAU-gap*2);
    for (const s of [-1,1]){ const pts=[]; for (let i=0;i<=12;i++){ const th=Math.PI*(0.14+i/12*0.53), phi=Math.PI/2+s*gap; pts.push(V3(-0.5*Math.cos(phi)*Math.sin(th), TORSO_Y+0.5*Math.cos(th)*0.92, 0.5*Math.sin(phi)*Math.sin(th)*0.86)); } mesh(tubeG(pts,0.024,30,8), R, 0,0,0, body);
      if (s>0) for (let i=0;i<4;i++){ const th=Math.PI*(0.3+i*0.09), phi=Math.PI/2+gap*0.98; const p=V3(-0.52*Math.cos(phi)*Math.sin(th), TORSO_Y+0.52*Math.cos(th)*0.92, 0.52*Math.sin(phi)*Math.sin(th)*0.86); button(body, p, V3(p.x,0,p.z).normalize(), B, 0.022); } }
    const yb=TORSO_Y+Math.cos(Math.PI*0.67)*0.5*0.92; band(body, yb, radAt(0.5,yb)+0.006, 0.03, R, gap*2.1);
    for (const s of [-1,1]) onSurf(body, mesh(new THREE.BoxGeometry(0.15,0.13,0.03), K), 0.5, s*0.55, 0.5, 0.012);
    sleeves(arms, K, 0.15, { cuff:R, cr:0.114, ct:0.03 }); },

  puffer(body, arms, c){ const P=mat(c,{ roughness:0.36 }), D=mat(shade(c,-0.08),{ roughness:0.36 });
    shell(body,0.48,0.12,0.7,D); shell(body,0.484,0.7,0.88,mat(0x4a4a54));
    [1.04,0.94,0.84,0.74,0.64,0.54].forEach((y,i)=>band(body, y, radAt(0.462,y)+0.004, 0.056, P));
    const col=mesh(new THREE.CylinderGeometry(0.22,0.28,0.12,32,1,true), mat(c,{ roughness:0.36, side:THREE.DoubleSide }), 0,1.1,0.02, body); col.scale.z=0.9; band(body,1.16,0.22,0.022,P,0,0.9);
    const zip=metal(0xc8c8d0); mesh(tubeG([1.12,1.0,0.88,0.76,0.64,0.5].map(y=>surf(0.522,y,0)),0.008,20,6), zip, 0,0,0, body); const pull=mesh(new THREE.BoxGeometry(0.03,0.06,0.01), zip, 0,1.04,0,body); pull.position.copy(surf(0.535,1.04,0));
    const ends=sleeves(arms, P, 0.15, { cuff:D, cr:0.112, ct:0.028 });
    for (const { a, s } of ends) for (const k of [0,1]){ const cy=-0.08+(0.12-0.15)*0.3, h=-0.03+k*0.07; const r=mesh(new THREE.TorusGeometry(0.124,0.022,8,24), P, s*0.03+Math.sin(0.25)*s*h, cy-Math.cos(0.25)*h, 0, a); r.rotation.order='ZXY'; r.rotation.set(Math.PI/2,0,s*0.25); } },

  flannel(body, arms, c){ const PL=plaidMat(c), D=mat(shade(c,-0.22)), Bt=gloss(0xf4efe2);
    shell(body,0.49,0.12,0.6,PL); shell(body,0.486,0.6,0.88,canvasMat(0x4a6a9a)); band(body,0.6,radAt(0.49,0.6)+0.004,0.022,mat(0x5a3a26)); const bk=mesh(new THREE.BoxGeometry(0.07,0.05,0.02), metal(0xc8b070), 0,0,0); onSurf(body,bk,0.6,0,0.51,0.012);
    const ends=sleeves(arms, PL, 0.06); for (const { a, s, e } of ends){ const r=mesh(new THREE.TorusGeometry(0.122,0.04,10,26), PL, e.x,e.y+0.02,e.z, a); r.rotation.order='ZXY'; r.rotation.set(Math.PI/2,0,s*0.25); }
    for (const s of [-1,1]){ const cl=mesh(new THREE.ConeGeometry(0.075,0.16,3), PL, s*0.1,0.97,0.35, body); cl.rotation.set(-0.5,0,Math.PI+s*0.5); cl.scale.z=0.35; }
    mesh(tubeG([1.06,0.94,0.82,0.7,0.62].map(y=>surf(0.497,y,0)),0.014,20,6), D, 0,0,0, body); for (const y of [0.98,0.86,0.74,0.64]) button(body, surf(0.51,y,0), surfN(y,0), Bt, 0.016);
    for (const s of [-1,1]){ onSurf(body, mesh(new THREE.BoxGeometry(0.13,0.13,0.012), PL), 0.84, s*0.38, 0.49, 0.008); onSurf(body, mesh(new THREE.BoxGeometry(0.14,0.045,0.022), PL), 0.915, s*0.38, 0.49, 0.016); } },

  robe(body, arms, c){ const S=starMat(c), SD=starMat(c, THREE.DoubleSide), Gd=mat(0xe8c060,{ roughness:0.4, metalness:0.3 });
    shell(body,0.495,0.1,0.52,S); const sk=mesh(lathe([[0.48,0.73],[0.5,0.56],[0.56,0.36],[0.63,0.16],[0.66,0.1]],48), SD, 0,0,0, body); sk.scale.z=0.9;
    band(body,0.1,0.66,0.026,Gd,0,0.9); band(body,1.1,0.24,0.032,Gd,0,0.9);
    band(body,0.62,0.51,0.02,mat(0xd8b050),0,0.9); const kn=V3(Math.sin(0.35)*0.535,0.62,Math.cos(0.35)*0.535*0.9); mesh(sph(0.03,10,8), mat(0xd8b050), kn.x,kn.y,kn.z, body);
    for (const d of [-0.04,0.04]){ mesh(tubeG([kn,[kn.x+d,kn.y-0.12,kn.z+0.02],[kn.x+d*1.5,kn.y-0.22,kn.z+0.03]],0.008,12,6), mat(0xd8b050), 0,0,0, body); const ts=mesh(new THREE.ConeGeometry(0.025,0.07,10), mat(0xd8b050), kn.x+d*1.5,kn.y-0.25,kn.z+0.03, body); ts.rotation.z=0; }
    for (const a of arms){ const s=a.userData.side; const sl=mesh(new THREE.CylinderGeometry(0.12,0.2,0.32,28,1,true), SD, s*0.06,-0.14,0, a); sl.rotation.z=s*0.25;
      const t=mesh(new THREE.TorusGeometry(0.2,0.016,8,30), Gd, s*(0.06+Math.sin(0.25)*0.16),-0.14-Math.cos(0.25)*0.16,0, a); t.rotation.order='ZXY'; t.rotation.set(Math.PI/2,0,s*0.25); } },

  peacoat(body, arms, c){ const P=mat(c), D=mat(shade(c,-0.08)), Bt=lum(c)<0.32 ? metal(0xd8b050) : gloss(0x2a2228);
    shell(body,0.5,0.12,0.62,P); const sk=mesh(lathe([[0.47,0.62],[0.5,0.48],[0.53,0.33],[0.545,0.28]],48), mat(c,{ side:THREE.DoubleSide }), 0,0,0, body); sk.scale.z=0.88; band(body,0.28,0.545,0.016,D,0,0.88);
    const col=mesh(new THREE.CylinderGeometry(0.22,0.27,0.13,32,1,true,Math.PI*0.25,Math.PI*1.5), mat(shade(c,-0.04),{ side:THREE.DoubleSide }), 0,1.11,0, body); col.scale.z=0.92;
    for (const s of [-1,1]){ bar(body, D, [s*0.2,1.08,0.24], [s*0.02,0.84,0.45], 0.11, 0.024); bar(body, P, [s*0.07,0.84,0.44], [s*0.05,0.6,0.45], 0.02, 0.02); }
    for (const y of [0.88,0.74,0.6]) for (const s of [-1,1]) button(body, surf(0.505,y,s*0.24), surfN(y,s*0.24), Bt, 0.024);
    for (const s of [-1,1]) onSkirt(body, mesh(new THREE.BoxGeometry(0.15,0.04,0.022), D), 0.45, s*0.62, 0.508, 0.88, 0.012);
    sleeves(arms, P, 0.15, { cuff:D, cr:0.116, ct:0.024 }); },

  pajamas(body, arms, c){ const base=mix(c,0xffffff,0.78), ST=stripeMat(c, base, 10), PI_=mat(c), Bt=gloss(0xfaf6ee);
    shell(body,0.49,0.12,0.62,ST); shell(body,0.486,0.62,0.88,ST); band(body,0.57,radAt(0.49,0.57)+0.006,0.016,PI_);
    sleeves(arms, ST, 0.14, { cuff:PI_, cr:0.12, ct:0.018 });
    for (const s of [-1,1]){ const l=mesh(sph(0.09,16,10), mat(base)); l.scale.set(1,0.62,0.22); onSurf(body, l, 0.97, s*0.34, 0.49, 0.012); l.rotateZ(s*0.5); const p=mesh(new THREE.TorusGeometry(0.088,0.008,6,24), PI_); p.scale.set(1,0.62,1); onSurf(body, p, 0.97, s*0.34, 0.49, 0.022); p.rotateZ(s*0.5); }
    mesh(tubeG([1.0,0.9,0.8,0.7,0.6].map(y=>surf(0.497,y,0)),0.01,20,6), PI_, 0,0,0, body); for (const y of [0.94,0.83,0.72,0.62]) button(body, surf(0.505,y,0.07), surfN(y,0.07), Bt, 0.018);
    const pk=mesh(new THREE.BoxGeometry(0.12,0.12,0.012), mat(base)); onSurf(body, pk, 0.82, 0.42, 0.49, 0.008); const pe=mesh(new THREE.BoxGeometry(0.124,0.012,0.016), PI_); onSurf(body, pe, 0.875, 0.42, 0.49, 0.012); },

  ruffle(body, arms, c){ const C=satin(c), L1=mat(mix(c,0xffffff,0.25),{ side:THREE.DoubleSide, roughness:0.55 }), L2=mat(mix(c,0xffffff,0.45),{ side:THREE.DoubleSide, roughness:0.55 }), L3=mat(mix(c,0xffffff,0.62),{ side:THREE.DoubleSide, roughness:0.55 });
    shell(body,0.49,0.12,0.52,C);
    [[0.66,0.5,0.49,0.6,L3],[0.56,0.36,0.52,0.66,L2],[0.46,0.22,0.56,0.7,L1]].forEach(([y0,y1,r0,r1,m],k)=>{ const g=lathe([[r0,y0],[(r0+r1)/2,(y0+y1)/2],[r1,y1]],64), p=g.attributes.position;
      for (let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i), y=p.getY(i), a=Math.atan2(z,x), f=(y0-y)/(y0-y1), w=1+Math.sin(a*16+k)*0.05*f; p.setX(i,x*w); p.setZ(i,z*w); p.setY(i, y+Math.cos(a*16+k)*0.012*f); }
      g.computeVertexNormals(); mesh(g, m, 0,0,0, body).scale.z=0.9; });
    const sashC = lum(c)>0.75 ? shade(c,-0.25) : 0xfaf4ea, SA=satin(sashC); band(body,0.69,radAt(0.49,0.69)+0.012,0.03,SA);
    const bow=new THREE.Group(); bow.position.copy(surf(0.53,0.69,Math.PI)); bow.scale.setScalar(1.6); body.add(bow);
    for (const s of [-1,1]){ const lp=mesh(new THREE.TorusGeometry(0.07,0.028,10,22), SA, s*0.08,0.02,-0.01, bow); lp.scale.set(1.2,0.75,0.6); lp.rotation.y=s*0.2; const tl=mesh(new THREE.BoxGeometry(0.05,0.2,0.012), SA, s*0.05,-0.12,-0.02, bow); tl.rotation.z=s*0.25; }
    mesh(sph(0.035,12,10), SA, 0,0.02,-0.02, bow);
    for (const a of arms){ const s=a.userData.side; const pf=mesh(sph(0.15,20,14), C, s*0.02,-0.02,0, a); pf.scale.set(1,0.82,1); const b=mesh(new THREE.TorusGeometry(0.125,0.014,6,24), L3, s*0.04,-0.12,0, a); b.rotation.order='ZXY'; b.rotation.set(Math.PI/2,0,s*0.25); }
    band(body,1.08,0.26,0.03,L3,0,0.9); },

  varsity(body, arms, c){ const W=mat(c,{ roughness:0.85 }), Lt=mat(0xf2ead8,{ roughness:0.45 }), R=knit(shade(c,-0.04), 0xf6f2ea, 8), Sn=metal(0xd8d0c0);
    shell(body,0.495,0.12,0.6,W); shell(body,0.486,0.6,0.88,mat(0x4a4a54));
    sleeves(arms, Lt, 0.15, { cuff:R, cr:0.116, ct:0.034 });
    band(body,1.1,0.22,0.05,R,0,0.9); band(body,0.56,radAt(0.495,0.56)+0.01,0.04,R);
    mesh(tubeG([1.06,0.94,0.82,0.7,0.6].map(y=>surf(0.498,y,0)),0.009,20,6), mat(shade(c,-0.15)), 0,0,0, body); for (const y of [0.98,0.86,0.74,0.64]) button(body, surf(0.5,y,0), surfN(y,0), Sn, 0.02);
    const patch=new THREE.Mesh(new THREE.CircleGeometry(0.1,28), letterMat(c, 0xf6f2ea)); patch.castShadow=false; onSurf(body, patch, 0.84, 0.4, 0.5, 0.008);
    for (const s of [-1,1]) onSurf(body, mesh(new THREE.BoxGeometry(0.03,0.14,0.016), Lt), 0.5, s*0.7, 0.5, 0.01); },
};
export function buildOutfitNew(kind, body, arms, color, sc){ const f=OUTFIT_BUILD[kind]; if (!f) return false; f(body, arms, color, sc); return true; }

/* ================= accessories ================= */
// ctx: { head, trunk, body, wobbler(parent,x,y,z,k), anim(fn), rig(group) }
const ACC_BUILD = {
  /* ---------- hats (head space: dome top at about y 0.53) ---------- */
  strawhat(c){ const h=hatGroup(c, 0.31, -0.13), S=strawMat();
    mesh(lathe([[0.001,0.3],[0.26,0.29],[0.42,0.23],[0.52,0.1],[0.545,0]],40), S, 0,0,0, h);
    mesh(lathe([[0.54,0.0],[0.78,-0.03],[0.96,-0.08],[1.0,-0.11]],56), mat(0xffffff,{ map:S.map, side:THREE.DoubleSide, roughness:0.9 }), 0,0,0, h);
    mesh(new THREE.TorusGeometry(0.995,0.022,8,60), S, 0,-0.11,0, h).rotation.x=Math.PI/2;
    mesh(new THREE.CylinderGeometry(0.535,0.548,0.08,48,1,true), mat(0xd84a4a,{ side:THREE.DoubleSide }), 0,0.05,0, h);
    const bw=new THREE.Group(); bw.position.set(0.47,0.06,0.24); bw.rotation.y=-0.5; h.add(bw); for (const s of [-1,1]){ const l=mesh(new THREE.TorusGeometry(0.045,0.016,8,16), mat(0xd84a4a), s*0.05,0.01,0, bw); l.scale.set(1.2,0.7,0.6); }
    const f=bloom(bw, 5, 0xffffff, 0xf8d040, 0.04); f.position.set(0,0.02,0.04); f.rotation.x=1.3; },
  sailorcap(c){ const h=hatGroup(c, 0.36, -0.22), W=mat(0xf8f6f0), N=mat(0x2a3a6a);
    mesh(new THREE.CylinderGeometry(0.5,0.53,0.13,44,1,true), mat(0x2a3a6a,{ side:THREE.DoubleSide }), 0,0.0,0, h);
    mesh(lathe([[0.001,0.21],[0.42,0.21],[0.6,0.17],[0.64,0.13],[0.58,0.08],[0.5,0.065]],48), W, 0,0,0, h);
    const vz=mesh(new THREE.CylinderGeometry(0.4,0.4,0.022,28,1,false,-Math.PI*0.42,Math.PI*0.84), gloss(0x1a1a22), 0,-0.06,0.2, h); vz.scale.z=0.62; vz.rotation.x=0.32;
    mesh(new THREE.TorusGeometry(0.505,0.01,6,48), gold(), 0,0.04,0, h).rotation.x=Math.PI/2;
    const an=new THREE.Group(); an.position.set(0,0.0,0.5); an.scale.setScalar(0.7); h.add(an); const G1=gold();
    mesh(new THREE.TorusGeometry(0.025,0.007,6,14), G1, 0,0.06,0, an); mesh(new THREE.BoxGeometry(0.012,0.1,0.01), G1, 0,0.0,0, an); mesh(new THREE.BoxGeometry(0.06,0.01,0.01), G1, 0,0.03,0, an); mesh(new THREE.TorusGeometry(0.04,0.008,6,16,Math.PI), G1, 0,-0.03,0, an).rotation.z=Math.PI; },
  pombeanie(c, ctx){ const h=hatGroup(c, 0.06, -0.08), K=knit(0xe8a040,0xf6f2ea,12), Cf=knit(0xd88a30,null,6);
    const d=mesh(sph(0.6,36,18,0,TAU,0,Math.PI*0.44), K, 0,0,0, h); d.scale.set(1.05,1,1.03);
    mesh(new THREE.TorusGeometry(0.575,0.085,12,44), Cf, 0,0.17,0, h).rotation.x=Math.PI/2;
    const pp=ctx.wobbler(h, 0,0.6,0, 0.9); for (let i=0;i<16;i++){ const d2=V3(Math.sin(i*2.4)*Math.cos(i*1.1), Math.cos(i*1.1), Math.cos(i*2.4)*Math.sin(i*0.7)).normalize(); mesh(sph(0.075,10,8), knit(0xf6f2ea,null,4), d2.x*0.08,0.06+d2.y*0.08,d2.z*0.08, pp); } },
  wizardhat(c, ctx){ const h=hatGroup(c, 0.33, -0.12), S=starMat(0x2c2c6e), SD=starMat(0x2c2c6e,THREE.DoubleSide);
    mesh(lathe([[0.5,0.01],[0.8,-0.02],[0.98,-0.06],[1.02,-0.09]],56), SD, 0,0,0, h);
    mesh(taper([[0,0,0],[0,0.38,-0.02],[0.02,0.72,-0.08]], t=>0.54*(1-t*0.55), 30, 24), S, 0,0,0, h);
    const tip=ctx.wobbler(h, 0.02,0.72,-0.08, 1.4); mesh(taper([[0,0,0],[0.06,0.18,-0.05],[0.2,0.3,-0.14],[0.34,0.28,-0.2]], t=>0.24*Math.pow(1-t,1.1)+0.012, 20, 24), S, 0,0,0, tip);
    const st=mesh(extrude(starShape(0.07,0.03),0.02,0.008), glowM(0xffe080,1.0), 0.36,0.25,-0.2, tip, false); st.rotation.y=0.4;
    mesh(new THREE.CylinderGeometry(0.535,0.545,0.08,44,1,true), mat(0xe8c060,{ side:THREE.DoubleSide, metalness:0.4, roughness:0.35 }), 0,0.05,0, h);
    const moon=mesh(extrude(crescent(0.07),0.01,0.004), glowM(0xfff0b0,0.5), 0,0.24,0.47, h); moon.rotation.x=-0.25; },
  flowercrown(c){ const h=hatGroup(c, 0.31, -0.2); const R=0.52;
    mesh(new THREE.TorusGeometry(R,0.022,8,56), mat(0x5a8a3a), 0,0,0, h).rotation.x=Math.PI/2;
    const cols=[[0xffffff,0xf8d040],[0xf8a0c0,0xf8e080],[0x8ac0f0,0xfff4c0],[0xf8d050,0xe8803a],[0xf07070,0xf8e080]];
    for (let i=0;i<12;i++){ const a=i/12*TAU, p=V3(Math.cos(a)*R,0.01,Math.sin(a)*R); if (i%2===0){ const [pc,cc]=cols[(i/2)%cols.length]; const f=bloom(h,5,pc,cc,0.06,6,0.3); f.position.copy(p); f.quaternion.setFromUnitVectors(V3(0,1,0), V3(Math.cos(a)*0.7,0.7,Math.sin(a)*0.7).normalize()); }
      else { for (const s of [-1,1]){ const l=leaf(h, p.x+Math.cos(a+s*1.6)*0.03, 0.0, p.z+Math.sin(a+s*1.6)*0.03, 0x6aaa4a, 0.05); l.rotation.y=-a+s*0.5; } mesh(sph(0.022,8,6), mat(0xf8f0ff), p.x,0.035,p.z, h, false); } } },
  buckethat(c){ const h=hatGroup(c, 0.3, -0.12), P=plaidMat(0x8aa07a);
    mesh(lathe([[0.001,0.3],[0.34,0.29],[0.5,0.22],[0.56,0.04],[0.585,0.0]],44), P, 0,0,0, h);
    mesh(lathe([[0.58,0.0],[0.7,-0.08],[0.82,-0.17],[0.85,-0.2]],52), mat(0xffffff,{ map:P.map, side:THREE.DoubleSide, roughness:0.85 }), 0,0,0, h);
    for (const [r,y] of [[0.66,-0.05],[0.74,-0.1],[0.81,-0.15]]) mesh(new THREE.TorusGeometry(r,0.005,4,56), mat(0x4a5a3a), 0,y,0, h).rotation.x=Math.PI/2;
    mesh(new THREE.BoxGeometry(0.06,0.04,0.01), mat(0xf6f2ea), 0.56,0.06,0.0, h).rotation.y=Math.PI/2; },
  tophat(c){ const h=hatGroup(c, 0.4, -0.16, 0.12), B=mat(0x1e1a22,{ roughness:0.34 });
    mesh(new THREE.CylinderGeometry(0.38,0.355,0.6,40), B, 0,0.32,0, h); mesh(lathe([[0.35,0.0],[0.58,-0.005],[0.66,0.03],[0.69,0.08]],52), mat(0x1e1a22,{ roughness:0.34, side:THREE.DoubleSide }), 0,0,0, h).scale.z=0.86;
    mesh(new THREE.CylinderGeometry(0.362,0.365,0.11,40,1,true), satin(0x8a2a4a), 0,0.08,0, h);
    const fe=mesh(taper([[0,0,0],[0.02,0.14,-0.03],[0.0,0.3,-0.1],[-0.05,0.42,-0.18]], t=>0.035*Math.sin(Math.PI*Math.min(1,t*1.2+0.05))+0.004, 10, 20), mat(0x3ab0a8,{ roughness:0.5 }), 0.36,0.1,0.06, h); fe.scale.set(1,1,0.35);
    mesh(sph(0.03,10,8), gold(), 0.37,0.09,0.07, h); },
  anglercap(c){ const h=hatGroup(c, 0.31, -0.12), O=canvasMat(0x7a8a4a);
    mesh(lathe([[0.001,0.28],[0.36,0.27],[0.5,0.2],[0.56,0.03],[0.58,0.0]],44), O, 0,0,0, h);
    mesh(lathe([[0.575,0.0],[0.7,-0.06],[0.8,-0.13],[0.82,-0.15]],52), mat(0xffffff,{ map:O.map, side:THREE.DoubleSide, roughness:0.9 }), 0,0,0, h);
    mesh(new THREE.CylinderGeometry(0.555,0.57,0.07,44,1,true), mat(0x5a4030,{ side:THREE.DoubleSide }), 0,0.04,0, h);
    const lures=[[0xe2483d,0xf8f4ec],[0xf2c040,0x3a8a5a],[0x4a8ad8,0xf8f4ec],[0xf08aac,0x2a2a30]]; const hook=metal(0xb8b8c0);
    lures.forEach(([c1,c2],i)=>{ const a=-0.9+i*0.6, g=new THREE.Group(); g.position.set(Math.sin(a)*0.575,0.06,Math.cos(a)*0.575); g.rotation.y=a; h.add(g);
      const bd=mesh(new THREE.CapsuleGeometry(0.022,0.05,4,10), gloss(c1), 0,0,0.012, g); bd.rotation.z=Math.PI/2; mesh(sph(0.018,8,6), gloss(c2), 0.04,0,0.012, g); mesh(sph(0.006,6,4), gloss(0x111111), 0.05,0.006,0.026, g, false);
      const hk=mesh(new THREE.TorusGeometry(0.014,0.003,4,10,Math.PI*1.4), hook, -0.05,-0.012,0.012, g, false); hk.rotation.z=1.2; });
    const fly=new THREE.Group(); fly.position.set(-0.4,0.12,0.4); fly.rotation.y=-0.8; h.add(fly); for (let i=0;i<6;i++){ const f=mesh(new THREE.ConeGeometry(0.012,0.07,5), mat([0xf2c040,0xe86a3a,0x5a8a3a][i%3]), Math.cos(i)*0.01,0.03,Math.sin(i)*0.01, fly, false); f.rotation.set(Math.cos(i*1.7)*0.6,0,Math.sin(i*1.7)*0.6); } },
  ballcap(c){ const h=hatGroup(c, 0.12, -0.12), R=mat(0xd84a3a), W=mat(0xf6f2ea);
    const d=mesh(sph(0.585,36,18,0,TAU,0,Math.PI*0.5), R, 0,0,0, h); d.scale.set(1.04,0.78,1.03);
    for (let i=0;i<6;i++){ const a=i/6*TAU; const s=mesh(new THREE.TorusGeometry(0.586,0.005,4,30,Math.PI/2), mat(0x9a2a24), 0,0,0, h, false); s.rotation.y=a; s.scale.set(1.04,0.78,1.04); }
    mesh(sph(0.04,12,10), R, 0,0.46,0, h);
    const vz=mesh(new THREE.CylinderGeometry(0.5,0.5,0.026,30,1,false,-Math.PI*0.4,Math.PI*0.8), R, 0,0.015,0.3, h); vz.scale.z=0.85; vz.rotation.x=0.1;
    const st=mesh(extrude(starShape(0.09,0.04),0.012,0.004), W, 0,0.24,0.53, h); st.rotation.x=-0.45; },
  crown(c){ const h=hatGroup(c, 0.42, -0.1, 0.12), G1=gold();
    mesh(new THREE.CylinderGeometry(0.3,0.28,0.12,36,1,true), mat(0xe8b84a,{ metalness:0.85, roughness:0.28, side:THREE.DoubleSide }), 0,0.06,0, h);
    mesh(new THREE.TorusGeometry(0.28,0.016,6,36), G1, 0,0.0,0, h).rotation.x=Math.PI/2; mesh(new THREE.TorusGeometry(0.3,0.012,6,36), G1, 0,0.12,0, h).rotation.x=Math.PI/2;
    const gems=[0xd8304a,0x3a6ad8,0x3ab06a]; for (let i=0;i<6;i++){ const a=i/6*TAU; const p=mesh(new THREE.ConeGeometry(0.06,0.16,4), G1, Math.cos(a)*0.29,0.2,Math.sin(a)*0.29, h); p.rotation.y=-a+Math.PI/4; p.scale.z=0.45; mesh(sph(0.026,10,8), G1, Math.cos(a)*0.29,0.3,Math.sin(a)*0.29, h);
      const g=mesh(sph(0.03,12,10), mat(gems[i%3],{ roughness:0.1, emissive:gems[i%3], emissiveIntensity:0.25 }), Math.cos(a+TAU/12)*0.305,0.06,Math.sin(a+TAU/12)*0.305, h, false); g.scale.set(1,1,0.6); g.rotation.y=Math.PI/2-(a+TAU/12); } },
  nightcap(c, ctx){ const h=hatGroup(c, 0.05, -0.1), K=knit(0x6a7ad8,0xf6f2ea,18);
    const w=ctx.wobbler(h, 0,0,0, 0.5);
    mesh(taper([[0,0,0],[0,0.36,-0.04],[0.1,0.62,-0.12],[0.34,0.68,-0.2],[0.56,0.48,-0.24],[0.62,0.32,-0.24]], t=>0.6*Math.pow(1-t,0.9)+0.03, 36, 40), K, 0,0,0, w);
    mesh(new THREE.TorusGeometry(0.585,0.07,10,44), knit(0xf6f2ea,null,6), 0,0.14,0, h).rotation.x=Math.PI/2;
    const pp=new THREE.Group(); pp.position.set(0.62,0.28,-0.24); w.add(pp); for (let i=0;i<12;i++){ const d=V3(Math.sin(i*2.4)*Math.cos(i), Math.cos(i*1.3), Math.cos(i*2.4)).normalize(); mesh(sph(0.055,10,8), knit(0xf6f2ea,null,4), d.x*0.05,d.y*0.05,d.z*0.05, pp); } },

  /* ---------- glasses (head space: eyes at about x ±0.2, y 0.03, front at z 0.55) ---------- */
  roundspecs(){ const g=faceGroup(), G1=gold();
    for (const s of [-1,1]){ const r=mesh(new THREE.TorusGeometry(0.115,0.012,8,32), G1, s*0.2,0.03,0.58, g); r.rotation.y=s*0.22; const l=mesh(new THREE.CircleGeometry(0.11,28), glass(0xe8f4ff,0.22), s*0.2,0.03,0.578, g, false); l.rotation.y=s*0.22;
      bar(g, G1, [s*0.31,0.06,0.53], [s*0.56,0.1,0.06], 0.012, 0.012); }
    mesh(new THREE.TorusGeometry(0.05,0.01,6,14,Math.PI), G1, 0,0.05,0.6, g); },
  shades(){ const g=faceGroup(), F=gloss(0x1a1418), L=mat(0x2a2440,{ roughness:0.05, metalness:0.5, transparent:true, opacity:0.88 });
    const rr=(w,h,r)=>{ const s=new THREE.Shape(); s.moveTo(-w/2+r,-h/2); s.lineTo(w/2-r,-h/2); s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r); s.lineTo(w/2,h/2-r); s.quadraticCurveTo(w/2,h/2,w/2-r,h/2); s.lineTo(-w/2+r,h/2); s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); s.lineTo(-w/2,-h/2+r); s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2); return s; };
    for (const s of [-1,1]){ const sh=rr(0.25,0.17,0.06); const hole=rr(0.2,0.12,0.04); sh.holes.push(new THREE.Path(hole.getPoints())); const f=mesh(extrude(sh,0.025,0.006), F, s*0.2,0.04,0.585, g); f.rotation.y=s*0.22;
      const l=mesh(new THREE.ShapeGeometry(rr(0.21,0.13,0.045)), L, s*0.2,0.04,0.58, g, false); l.rotation.y=s*0.22; bar(g, F, [s*0.33,0.08,0.52], [s*0.56,0.1,0.06], 0.02, 0.016); }
    mesh(new THREE.BoxGeometry(0.1,0.025,0.025), F, 0,0.08,0.61, g); },
  starshades(){ const g=faceGroup(), F=gloss(0xf06aa0), L=mat(0xffc860,{ roughness:0.05, transparent:true, opacity:0.55 });
    for (const s of [-1,1]){ const sh=starShape(0.15,0.075); sh.holes.push(new THREE.Path(starShape(0.115,0.055).getPoints())); const f=mesh(extrude(sh,0.022,0.006), F, s*0.21,0.04,0.585, g); f.rotation.y=s*0.22;
      const l=mesh(new THREE.ShapeGeometry(starShape(0.12,0.058)), L, s*0.21,0.04,0.58, g, false); l.rotation.y=s*0.22; bar(g, F, [s*0.34,0.07,0.52], [s*0.56,0.1,0.06], 0.016, 0.014); }
    mesh(new THREE.TorusGeometry(0.045,0.012,6,14,Math.PI), F, 0,0.06,0.6, g); },
  monocle(){ const g=faceGroup(), G1=gold();
    mesh(new THREE.TorusGeometry(0.12,0.016,10,32), G1, 0.2,0.04,0.585, g).rotation.y=0.22; mesh(new THREE.CircleGeometry(0.115,28), glass(0xf0f8ff,0.25), 0.2,0.04,0.58, g, false).rotation.y=0.22;
    const pts=[]; for (let i=0;i<=10;i++){ const t=i/10; pts.push(V3(0.3+t*0.25, -0.03-Math.sin(t*Math.PI*0.9)*0.3, 0.55-t*0.25)); } const ch=curve(pts);
    for (let i=0;i<22;i++){ const p=ch.getPoint(i/21); const l=mesh(new THREE.TorusGeometry(0.012,0.004,4,10), G1, p.x,p.y,p.z, g, false); l.rotation.set(i*1.3,i*0.7,0); } },
  goggles(){ const g=faceGroup(), Le=mat(0x6a4028,{ roughness:0.7 }), B=metal(0xc89040), L=mat(0xe8a040,{ roughness:0.05, transparent:true, opacity:0.6 });
    const sg=new THREE.Group(); sg.rotation.x=-0.42; g.add(sg); const st=mesh(sph(0.575,48,6,0,TAU,Math.PI*0.3,Math.PI*0.07), mat(0x6a4028,{ roughness:0.7, side:THREE.DoubleSide }), 0,0,0, sg); st.scale.set(1.08,0.95,1.0);
    for (const s of [-1,1]){ const cup=new THREE.Group(); cup.position.set(s*0.17,0.36,0.46); cup.rotation.set(-0.75,s*0.25,0); g.add(cup);
      mesh(new THREE.CylinderGeometry(0.1,0.11,0.08,26), Le, 0,0,0, cup); mesh(new THREE.TorusGeometry(0.1,0.018,8,26), B, 0,0.045,0, cup).rotation.x=Math.PI/2; const lz=mesh(new THREE.CircleGeometry(0.092,26), L, 0,0.05,0, cup, false); lz.rotation.x=-Math.PI/2;
      for (let k=0;k<6;k++){ const a=k/6*TAU; mesh(sph(0.008,6,4), B, Math.cos(a)*0.1,0.045,Math.sin(a)*0.1, cup, false); } }
    mesh(new THREE.BoxGeometry(0.1,0.03,0.04), Le, 0,0.37,0.5, g).rotation.x=-0.75; },

  /* ---------- neckwear (body space: necklaces hang below the chin at y about 0.92) ---------- */
  pearls(){ const g=neckGroup(); const P=mat(0xfaf4ea,{ roughness:0.18, metalness:0.1 });
    for (const [dip,n,r] of [[0.15,34,0.026],[0.24,40,0.024]]){ const C=curve(neckPath(dip,40,1.1,0.53)); C.closed=true; for (let i=0;i<n;i++){ const p=C.getPoint(i/n); mesh(sph(r,12,10), P, p.x,p.y,p.z, g, false); } }
    const cl=curve(neckPath(0.24,40,1.1,0.53)).getPoint(0); mesh(sph(0.04,14,12), mat(0xf6e8f0,{ roughness:0.15 }), cl.x,cl.y-0.04,cl.z+0.01, g, false); },
  puka(){ const g=neckGroup(), C=curve(neckPath(0.13,40,1.1,0.53)); C.closed=true; const W=mat(0xf6f0e4,{ roughness:0.4 }), Bn=gloss(0x8a5a3a);
    for (let i=0;i<30;i++){ const t=i/30; if (t>0.46 && t<0.54) continue; const p=C.getPoint(t), d=C.getTangent(t); const o=mesh(i%3===2?sph(0.022,10,8):new THREE.CylinderGeometry(0.03,0.03,0.016,14), i%3===2?Bn:W, p.x,p.y,p.z, g, false); if (i%3!==2) o.quaternion.setFromUnitVectors(V3(0,1,0), d); }
    const sh=new THREE.Group(); const p0=C.getPoint(0); sh.position.set(p0.x,p0.y-0.06,p0.z+0.02); g.add(sh); sh.rotation.x=-0.2;
    for (let i=0;i<7;i++){ const a=-0.7+i*0.23; const r=mesh(new THREE.CapsuleGeometry(0.014,0.08,4,8), mat(0xf8c8b0,{ roughness:0.35 }), Math.sin(a)*0.04,-Math.cos(a)*0.04+0.04,0, sh, false); r.rotation.z=a; }
    mesh(new THREE.BoxGeometry(0.05,0.025,0.02), mat(0xf0b8a0), 0,0.085,0, sh); },
  locket(){ const g=neckGroup(), G1=gold(); mesh(new THREE.TubeGeometry((()=>{ const C=curve(neckPath(0.2,40,1.1,0.53)); C.closed=true; return C; })(),80,0.006,5,true), G1, 0,0,0, g, false);
    const p=curve(neckPath(0.2,40,1.1,0.53)).getPoint(0); const L=new THREE.Group(); L.position.set(p.x,p.y-0.07,p.z+0.03); L.rotation.x=-0.25; g.add(L);
    mesh(extrude(heartShape(0.075),0.03,0.012), G1, 0,0,0, L); mesh(new THREE.TorusGeometry(0.014,0.005,4,10), G1, 0,0.055,0, L); mesh(sph(0.014,10,8), mat(0xd8304a,{ roughness:0.1, emissive:0xd8304a, emissiveIntensity:0.2 }), 0,0.0,0.03, L, false); },
  bandana(){ const g=neckGroup(), D=dotsMat(0xd8403a);
    const nb=mesh(new THREE.TorusGeometry(0.34,0.05,10,40), D, 0,0.98,0.0, g); nb.rotation.x=Math.PI/2+0.2; nb.scale.set(1,0.9,1);
    const tri=new THREE.Shape(); tri.moveTo(-0.22,0); tri.quadraticCurveTo(0,0.03,0.22,0); tri.quadraticCurveTo(0.06,-0.14,0,-0.28); tri.quadraticCurveTo(-0.06,-0.14,-0.22,0);
    const tg=new THREE.ShapeGeometry(tri,16); const p=tg.attributes.position; for (let i=0;i<p.count;i++){ const x=p.getX(i), y=p.getY(i); p.setZ(i, -x*x*1.4+y*0.35); } tg.computeVertexNormals();
    const uv=tg.attributes.uv; for (let i=0;i<uv.count;i++) uv.setXY(i, p.getX(i)*2, p.getY(i)*2);
    const t=mesh(tg, mat(0xffffff,{ map:D.map, side:THREE.DoubleSide, roughness:0.8 }), 0,0.93,0.415, g); t.rotation.x=-0.3;
    const k=surf(0.52,1.02,Math.PI); mesh(sph(0.05,12,10), D, k.x,k.y+0.02,k.z-0.02, g).scale.set(1.2,0.9,0.8); for (const s of [-1,1]){ const e=mesh(new THREE.ConeGeometry(0.04,0.14,10), D, s*0.05,k.y-0.06,k.z-0.04, g); e.rotation.set(0.3,0,Math.PI+s*0.4); e.scale.z=0.4; } },
  bowtie(){ const g=neckGroup(), R=satin(0xb8283a); const b=new THREE.Group(); b.position.set(0,0.96,0.4); b.rotation.x=-0.3; g.add(b);
    for (const s of [-1,1]){ const w=mesh(new THREE.ConeGeometry(0.075,0.15,4,1), R, s*0.075,0,0, b); w.rotation.z=s*Math.PI/2; w.rotation.y=Math.PI/4; w.scale.set(1,1,0.45); }
    mesh(new THREE.BoxGeometry(0.05,0.06,0.04), R, 0,0,0.012, b); const dots=mat(0xf6f2ea); for (const [x,y] of [[-0.09,0.02],[-0.06,-0.03],[0.07,0.025],[0.1,-0.02]]) mesh(sph(0.009,6,4), dots, x,y,0.03, b, false);
    band(g,1.06,0.27,0.014,mat(0xf6f2ea),0,0.9); },
  longscarf(c, ctx){ const g=neckGroup(), K=knit(0x3a8a8a,0xf2c040,14);
    const w=mesh(new THREE.TorusGeometry(0.35,0.09,14,44), K, 0,0.99,0.0, g); w.rotation.x=Math.PI/2+0.16; w.scale.set(1,0.92,1);
    const front=ctx.wobbler(ctx.trunk, -0.16,0.93,0.38, 0.9); mesh(taper([[0,0,0],[0.02,-0.12,0.06],[0.01,-0.3,0.08],[-0.01,-0.44,0.06]], t=>0.06, 4, 18), K, 0,0,0, front).scale.set(1.5,1,0.45);
    const back=ctx.wobbler(ctx.trunk, 0.14,1.0,-0.3, 1.1); mesh(taper([[0,0,0],[0.02,-0.1,-0.08],[0.04,-0.28,-0.12],[0.05,-0.4,-0.12]], t=>0.058, 4, 18), K, 0,0,0, back).scale.set(1.5,1,0.45);
    for (const [grp,p] of [[front,V3(-0.01,-0.46,0.06)],[back,V3(0.05,-0.42,-0.12)]]) for (let i=0;i<5;i++) mesh(new THREE.CylinderGeometry(0.008,0.006,0.06,5), knit(0xf2c040,null,2), p.x-0.06+i*0.03,p.y-0.03,p.z, grp, false); },
  lei(){ const g=neckGroup(), C=curve(neckPath(0.16,40,1.1,0.54)); C.closed=true; const cols=[0xf86a9a,0xf8d040,0xffffff,0xf8903a,0xc88af0];
    for (let i=0;i<26;i++){ const t=i/26, p=C.getPoint(t), d=C.getTangent(t), n=V3(p.x,0.4,p.z).normalize(); const f=bloom(g,5,cols[i%cols.length],0xf8f0a0,0.042,5,0.4); f.position.copy(p); f.quaternion.setFromUnitVectors(V3(0,1,0), n); if (i%2) leaf(g, p.x+d.x*0.03, p.y-0.03, p.z+d.z*0.03, 0x4a9a4a, 0.04).rotation.y=Math.atan2(d.x,d.z); } },
  moonstone(){ const g=neckGroup(); const C=curve(neckPath(0.2,40,1.1,0.53)); C.closed=true; mesh(new THREE.TubeGeometry(C,80,0.007,5,true), mat(0x4a3a30), 0,0,0, g, false);
    const p=C.getPoint(0), P=new THREE.Group(); P.position.set(p.x,p.y-0.08,p.z+0.03); P.rotation.x=-0.25; g.add(P);
    mesh(extrude(crescent(0.075),0.026,0.01), mat(0xc8e0ff,{ roughness:0.1, emissive:0x8ab8ff, emissiveIntensity:0.55 }), 0,0,0, P, false);
    mesh(extrude(starShape(0.024,0.01),0.012,0.003), glowM(0xfff4c0,0.8), 0.03,-0.012,0.01, P, false); mesh(new THREE.TorusGeometry(0.014,0.004,4,10), metal(0xd8d8e0), -0.02,0.07,0, P); },

  /* ---------- on your back (body space: back of the torso at z about -0.43) ---------- */
  rucksack(){ const g=backGroup(), Cv=canvasMat(0xb8a070), D=canvasMat(0x8a7450), Le=mat(0x6a4428,{ roughness:0.6 }), B=metal(0xc8a050);
    const rr=new THREE.Shape(); const w=0.5,h=0.56,r=0.11; rr.moveTo(-w/2+r,-h/2); rr.lineTo(w/2-r,-h/2); rr.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r); rr.lineTo(w/2,h/2-r); rr.quadraticCurveTo(w/2,h/2,w/2-r,h/2); rr.lineTo(-w/2+r,h/2); rr.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); rr.lineTo(-w/2,-h/2+r); rr.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const bd=mesh(extrude(rr,0.2,0.05), Cv, 0,0.72,-0.6, g);
    const fl=mesh(sph(0.27,24,12,0,TAU,0,Math.PI/2), D, 0,0.92,-0.6, g); fl.scale.set(1,0.5,0.55); fl.rotation.x=0.15;
    for (const s of [-1,1]){ mesh(new THREE.BoxGeometry(0.045,0.3,0.012), Le, s*0.12,0.82,-0.75, g).rotation.x=-0.12; mesh(new THREE.BoxGeometry(0.06,0.045,0.016), B, s*0.12,0.7,-0.74, g);
      const pk=mesh(new THREE.BoxGeometry(0.09,0.2,0.16), D, s*0.3,0.62,-0.6, g); pk.position.x=s*0.29; }
    const roll=mesh(new THREE.CylinderGeometry(0.085,0.085,0.6,20), plaidMat(0xc84a3a), 0,1.06,-0.58, g); roll.rotation.z=Math.PI/2; for (const s of [-1,1]) mesh(new THREE.TorusGeometry(0.09,0.012,6,18), Le, s*0.18,1.06,-0.58, g).rotation.y=Math.PI/2;
    for (const s of [-1,1]) mesh(tubeG([[s*0.17,1.0,-0.42],[s*0.24,1.14,-0.12],[s*0.24,1.1,0.18],[s*0.22,0.94,0.38],[s*0.24,0.7,0.43],[s*0.3,0.5,0.36]],0.024,30,6), Le, 0,0,0, g); },
  bwings(c, ctx){ const g=backGroup(), M=wingMat(0x8a6ae8,0xf8a0d0);
    const up=new THREE.Shape(); up.moveTo(0,0); up.bezierCurveTo(0.15,0.25,0.5,0.45,0.62,0.32); up.bezierCurveTo(0.7,0.18,0.5,0.02,0,0);
    const lo=new THREE.Shape(); lo.moveTo(0,0); lo.bezierCurveTo(0.2,-0.05,0.46,-0.22,0.4,-0.38); lo.bezierCurveTo(0.3,-0.48,0.12,-0.3,0,0);
    const uvfix=(geo)=>{ const p=geo.attributes.position, uv=geo.attributes.uv; for (let i=0;i<p.count;i++) uv.setXY(i, p.getX(i)/0.7, (p.getY(i)+0.5)); return geo; };
    for (const s of [-1,1]){ const piv=new THREE.Group(); piv.position.set(s*0.05,0.86,-0.47); piv.scale.setScalar(1.35); g.add(piv); ctx.rig(piv);
      for (const [sh,y] of [[up,0.0],[lo,-0.02]]){ const m=mesh(uvfix(new THREE.ShapeGeometry(sh,20)), M, 0,y,0, piv, false); m.scale.x=s; }
      piv.userData.s=s; ctx.anim((t,dt,mv)=>{ const k=mv?9:3.2, a=mv?0.55:0.3; piv.rotation.y = s*(0.5 + Math.sin(t*k)*a); }); }
    mesh(new THREE.CapsuleGeometry(0.03,0.12,4,10), mat(0x3a2a40), 0,0.86,-0.47, g); },
  shellpack(){ const g=backGroup(), S=mat(0xf8c8c0,{ roughness:0.28, metalness:0.05 }), S2=mat(0xf0a8a8,{ roughness:0.3 });
    const p=new THREE.Group(); p.position.set(0,0.6,-0.5); p.rotation.x=0.12; g.add(p);
    for (let i=0;i<9;i++){ const a=-1.0+i*0.25; const r=mesh(new THREE.CapsuleGeometry(0.06,0.34,6,12), i%2?S2:S, Math.sin(a)*0.2,Math.cos(a)*0.2+0.02,-0.02-Math.cos(a)*0.03, p); r.rotation.z=-a; r.scale.z=0.55; }
    mesh(new THREE.BoxGeometry(0.2,0.08,0.08), S, 0,0.0,0, p); for (const s of [-1,1]) mesh(new THREE.BoxGeometry(0.08,0.06,0.06), S2, s*0.12,0.0,0, p);
    const Le=mat(0xe8d8c8); for (const s of [-1,1]) mesh(tubeG([[s*0.15,0.95,-0.42],[s*0.23,1.13,-0.12],[s*0.23,1.09,0.18],[s*0.21,0.92,0.38],[s*0.25,0.66,0.42]],0.02,24,6), Le, 0,0,0, g); },
  cape(c, ctx){ const g=backGroup(), S=starMat(0x3a2a7a, THREE.DoubleSide), Gd=gold();
    const w=ctx.wobbler(ctx.trunk, 0,1.08,0, 0.7); const geo=new THREE.PlaneGeometry(1,1,24,16), p=geo.attributes.position, uv=geo.attributes.uv;
    for (let i=0;i<p.count;i++){ const u=p.getX(i)*2, v=0.5-p.getY(i); const th=u*(1.05+0.35*v), rho=0.42+0.2*v+0.02*Math.sin(th*6)*v; p.setXYZ(i, Math.sin(th)*rho, -v*0.9, -Math.cos(th)*rho*0.92); uv.setXY(i, (u+1)/2, 1-v); }
    geo.computeVertexNormals(); mesh(geo, S, 0,0,0, w); mesh(new THREE.TorusGeometry(0.3,0.03,8,40,Math.PI*1.4), Gd, 0,0.02,0, w).rotation.set(Math.PI/2,0,Math.PI*0.8);
    for (const s of [-1,1]) mesh(sph(0.04,12,10), Gd, s*0.17,-0.06,0.25, w); mesh(new THREE.TorusGeometry(0.05,0.012,6,16), Gd, 0,-0.08,0.3, w); },
  teddypack(){ const g=backGroup(), F=mat(0xb08058,{ roughness:0.95 }), Mz=mat(0xe8d0b0,{ roughness:0.95 }), E=gloss(0x1a1414);
    mesh(sph(0.2,24,18), F, 0,0.72,-0.6, g).scale.set(1,1.1,0.85); mesh(sph(0.11,16,12), Mz, 0,0.7,-0.77, g).scale.set(1,1.1,0.4);
    const h=new THREE.Group(); h.position.set(0,1.0,-0.62); g.add(h); mesh(sph(0.16,24,18), F, 0,0,0, h);
    for (const s of [-1,1]){ mesh(sph(0.06,12,10), F, s*0.12,0.12,0, h).scale.z=0.6; mesh(sph(0.035,10,8), Mz, s*0.12,0.12,-0.025, h).scale.z=0.4; mesh(sph(0.02,10,8), E, s*0.06,0.03,-0.145, h, false); }
    mesh(sph(0.06,14,10), Mz, 0,-0.04,-0.14, h).scale.set(1.1,0.8,0.7); mesh(sph(0.022,10,8), E, 0,-0.02,-0.19, h, false);
    for (const s of [-1,1]){ mesh(tubeG([[s*0.15,0.78,-0.55],[s*0.42,0.74,-0.3],[s*0.53,0.7,0.02],[s*0.38,0.68,0.36]],0.05,24,10), F, 0,0,0, g); mesh(sph(0.065,14,10), Mz, s*0.36,0.68,0.39, g).scale.set(1,1,0.7);
      mesh(sph(0.075,14,10), F, s*0.1,0.52,-0.66, g).scale.set(1,0.8,1.1); } },
  balloon(c, ctx){ const g=backGroup(); const piv=new THREE.Group(); piv.position.set(0.06,0.9,-0.46); g.add(piv); ctx.rig(piv);
    mesh(tubeG([[0,0,0],[0.08,0.4,-0.1],[0.12,0.9,-0.22],[0.16,1.42,-0.3]],0.005,30,4), mat(0xf6f2ea), 0,0,0, piv, false);
    const b=new THREE.Group(); b.position.set(0.16,1.62,-0.3); piv.add(b); const hb=mesh(extrude(heartShape(0.24),0.12,0.09), mat(0xe8384a,{ roughness:0.18, metalness:0.05 }), 0,0,0, b); hb.scale.set(1,1,1);
    mesh(new THREE.ConeGeometry(0.03,0.05,10), mat(0xc82838), 0,-0.17,0, b).rotation.x=Math.PI; mesh(sph(0.03,10,8), mat(0xffffff,{ transparent:true, opacity:0.6 }), -0.08,0.08,0.11, b, false).scale.set(1,1.6,0.4);
    ctx.anim((t)=>{ piv.rotation.z=Math.sin(t*1.3)*0.08; piv.rotation.x=Math.sin(t*0.9+1)*0.06; b.rotation.y=Math.sin(t*0.7)*0.4; }); },
};
// hat holder: y = height on the head, tilt back (x), tilt sideways (z)
let CUR=null;
function hatGroup(c, y, rx=0, rz=0){ const g=new THREE.Group(); g.position.set(0,y,-0.02); g.rotation.set(rx,0,rz); CUR.head.add(g); return g; }
function faceGroup(){ const g=new THREE.Group(); CUR.head.add(g); return g; }
function neckGroup(){ const g=new THREE.Group(); CUR.trunk.add(g); return g; }
function backGroup(){ const g=new THREE.Group(); CUR.trunk.add(g); return g; }

// Put on the accessories a look is wearing. look.hat / face / neck / back are 1-based indexes into BY_SLOT (0 = none).
export function dressAccessories(look, ctx){ for (const s of SLOTS){ const i=look[s]|0; if (i>0 && BY_SLOT[s][i-1]) buildAccessory(BY_SLOT[s][i-1].id, ctx); } }
export function buildAccessory(id, ctx){ const f=ACC_BUILD[id]; if (!f) return; CUR=ctx; try { f(0, ctx); } finally { CUR=null; } }
// A stand-alone accessory for icons: the parts are hung on stand-in head and body groups.
export function accessoryModel(id){ const g=new THREE.Group(), head=new THREE.Group(), trunk=new THREE.Group(); head.position.y=1.42; g.add(head, trunk);
  const ctx={ head, trunk, body:trunk, wobbler:(p,x,y,z)=>{ const w=new THREE.Group(); w.position.set(x,y,z); p.add(w); return w; }, anim:()=>{}, rig:()=>{} };
  buildAccessory(id, ctx); return g; }
