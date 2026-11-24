// v1.19 furniture: twenty new pieces, most of them themed to an islander so they can be favor rewards.
// Builders push per-frame callbacks into g.userData.anims (t, dt), like furn.js and rare.js. Pieces face +z.
// Also: item icons for wardrobe things (outfits are shown on a little plush, accessories on their own).
import * as THREE from 'three';
import { M, mk, G, glowMat, addGlow, FURN_BUILDERS, ITEM_BUILDERS } from './models.js';
import { woodMat, fabricMat, glassMat, brass, ceramic, knit, shellMat, waterMat2 } from './look.js';
import * as CH from './chars.js';
import * as WR from './wardrobe.js';

const TAU=Math.PI*2, V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const CYL=(...a)=>new THREE.CylinderGeometry(...a);
const lathe=(pts,seg=32)=>new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),seg);
const curve=pts=>new THREE.CatmullRomCurve3(pts.map(p=>Array.isArray(p)?V3(...p):p));
const tube=(pts,r,seg=32,rs=8,closed=false)=>new THREE.TubeGeometry(curve(pts),seg,r,rs,closed);
const anim=(g,fn)=>{ (g.userData.anims ||= []).push(fn); };
const quiet=m=>{ m.castShadow=false; return m; };
const iron=()=>shellMat(0x3a3836,{ metalness:0.6, roughness:0.45, clearcoat:0.3 });
const silver=()=>shellMat(0xd8dce4,{ metalness:0.9, roughness:0.22, clearcoat:0.6 });
const gold=()=>shellMat(0xe8b84a,{ metalness:0.9, roughness:0.24, clearcoat:0.6 });
const zinc=()=>shellMat(0xb8c0c4,{ metalness:0.7, roughness:0.38 });
const terra=()=>shellMat(0xc8704a,{ roughness:0.8, clearcoat:0.05 });
const soil=()=>M(0x5a4030,{ roughness:1 });
const EM=new Map();
const emis=(c,k=1,o={})=>{ const key=c+':'+k+JSON.stringify(o); if (!EM.has(key)) EM.set(key, new THREE.MeshStandardMaterial(Object.assign({ color:c, emissive:c, emissiveIntensity:k, roughness:0.4 }, o))); return EM.get(key); };
const wisp=(op=0.35,c=0xffffff)=>new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:op, depthWrite:false });
function canvasTex(w,h,draw,rep=[1,1]){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(...rep); return t; }
const TEXC=new Map(); const once=(k,f)=>{ if (!TEXC.has(k)) TEXC.set(k,f()); return TEXC.get(k); };
function weaveMat(c=0xc89a5a){ return once('weave'+c, ()=>new THREE.MeshStandardMaterial({ roughness:0.85, map:canvasTex(128,128,(x,W,H)=>{ const base=new THREE.Color(c), hx=k=>'#'+k.getHexString();
  x.fillStyle=hx(base.clone().offsetHSL(0,0,-0.12)); x.fillRect(0,0,W,H);
  for (let j=0;j<8;j++) for (let i=0;i<8;i++){ const over=(i+j)%2; x.fillStyle=hx(base.clone().offsetHSL(0,0,over?0.06:-0.02)); x.beginPath(); x.ellipse(i*16+8, j*16+8, over?8:5, over?5:8, 0, 0, TAU); x.fill(); } }, [6,3]) })); }
function bloomAt(parent, x,y,z, c, r=0.05, n=6, center=0xf8d040){ const f=new THREE.Group(); f.position.set(x,y,z); parent.add(f);
  for (let i=0;i<n;i++){ const a=i/n*TAU; const p=quiet(mk(G.sph(r,10,6), ceramic(c), Math.cos(a)*r, 0, Math.sin(a)*r, f)); p.scale.set(1,0.38,0.7); p.rotation.y=-a; }
  quiet(mk(G.sph(r*0.55,10,8), ceramic(center), 0,r*0.2,0, f)); return f; }
function crescentShape(R){ const s=new THREE.Shape(), b=Math.atan2(R,-0.35*R); s.absarc(0,0,R,Math.PI/2,Math.PI*1.5,false); s.absarc(0.35*R,0,Math.hypot(R,0.35*R),-b,b,true); return s; }
function starShape(R, r, n=5){ const s=new THREE.Shape(); for (let i=0;i<n*2;i++){ const a=Math.PI/2+i*Math.PI/n, rr=i%2?r:R; if (i) s.lineTo(Math.cos(a)*rr, Math.sin(a)*rr); else s.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); } s.closePath(); return s; }
const extrude=(shape,d,bev=0.01)=>{ const g=new THREE.ExtrudeGeometry(shape,{ depth:d, bevelEnabled:bev>0, bevelThickness:bev, bevelSize:bev, bevelSegments:3, curveSegments:18 }); g.translate(0,0,-d/2); return g; };
function wheel(parent, r, x,y,z, wood, spokes=8, ry=Math.PI/2){ const w=new THREE.Group(); w.position.set(x,y,z); w.rotation.y=ry; parent.add(w);
  mk(G.tor(r,0.03,8,28), wood, 0,0,0,w); mk(CYL(0.05,0.05,0.08,12), wood, 0,0,0,w).rotation.x=Math.PI/2;
  for (let i=0;i<spokes;i++){ const s=mk(G.box(0.02,r*1.9,0.02), wood, 0,0,0,w); s.rotation.z=i/spokes*Math.PI; } return w; }
// steam or bubbles that rise and fade, looping
function rising(g, n, at, { mat=wisp(0.3), r=0.04, h=0.5, spread=0.05, speed=0.35, grow=1.6 }={}){ const ps=[];
  for (let i=0;i<n;i++){ const p=quiet(mk(G.sph(r,10,8), mat.clone(), at.x,at.y,at.z, g)); ps.push({ p, off:i/n, base:mat.opacity }); }
  anim(g,(t)=>{ for (const q of ps){ const k=(t*speed+q.off)%1; q.p.position.set(at.x+Math.sin(k*9+q.off*5)*spread, at.y+k*h, at.z+Math.cos(k*7+q.off*3)*spread*0.6); q.p.scale.setScalar(0.5+k*grow); q.p.material.opacity=q.base*Math.sin(k*Math.PI); } }); return ps; }

Object.assign(FURN_BUILDERS, {
  /* ---------- Mabel ---------- */
  teaset(g){ const W=woodMat(0x8b5e3a), B=brass();
    for (const [x,z] of [[0.38,0.22],[-0.38,0.22],[0.38,-0.22],[-0.38,-0.22]]){ mk(CYL(0.018,0.018,0.74,10), B, x,0.44,z,g); const w=mk(G.tor(0.05,0.018,8,16), M(0x2a2a2a), x,0.06,z,g); w.rotation.y=Math.PI/2; mk(G.sph(0.03,10,8), B, x,0.82,z,g); }
    for (const y of [0.3,0.74]){ mk(G.box(0.84,0.035,0.52), W, 0,y,0,g); for (const s of [-1,1]){ mk(G.box(0.84,0.05,0.012), W, 0,y+0.04,s*0.26,g); mk(G.box(0.012,0.05,0.52), W, s*0.42,y+0.04,0,g); } }
    mk(tube([[-0.42,0.74,-0.2],[-0.56,0.84,-0.2],[-0.56,0.84,0.2],[-0.42,0.74,0.2]],0.014,20,6), B, 0,0,0,g);
    const pot=new THREE.Group(); pot.position.set(-0.12,0.76,0); g.add(pot); const P=ceramic(0xf8f4ee), Bl=ceramic(0x4a7ad8);
    mk(lathe([[0,0],[0.1,0],[0.15,0.06],[0.16,0.12],[0.13,0.19],[0.08,0.22],[0,0.22]],28), P, 0,0,0,pot); mk(G.tor(0.158,0.012,6,28), Bl, 0,0.11,0,pot).rotation.x=Math.PI/2;
    mk(lathe([[0,0],[0.08,0],[0.06,0.04],[0.02,0.06],[0.025,0.08],[0,0.09]],20), P, 0,0.21,0,pot); mk(G.sph(0.022,10,8), Bl, 0,0.3,0,pot);
    mk(tube([[0.12,0.08,0],[0.2,0.12,0],[0.24,0.2,0],[0.27,0.23,0]],0.02,14,8), P, 0,0,0,pot); const hd=mk(G.tor(0.07,0.016,8,18,Math.PI*1.2), P, -0.15,0.13,0,pot); hd.rotation.z=Math.PI*0.4;
    rising(g, 5, V3(0.15,1.0,0), { r:0.03, h:0.42, spread:0.03, speed:0.4 });
    for (const [x,z] of [[0.18,0.1],[0.28,-0.1]]){ mk(CYL(0.08,0.07,0.012,24), P, x,0.765,z,g); const cup=mk(lathe([[0,0],[0.035,0],[0.05,0.05],[0.055,0.06]],20), P, x,0.77,z,g); mk(G.tor(0.054,0.006,6,20), Bl, x,0.83,z,g).rotation.x=Math.PI/2;
      quiet(mk(CYL(0.048,0.048,0.004,20), M(0xa8602a,{roughness:0.2}), x,0.82,z,g)); mk(G.tor(0.02,0.006,6,12,Math.PI), P, x+0.055,0.8,z,g).rotation.z=-Math.PI/2; void cup; }
    mk(lathe([[0,0],[0.05,0],[0.06,0.05],[0.05,0.07],[0,0.07]],18), Bl, 0.06,0.76,-0.15,g);
    const stand=new THREE.Group(); stand.position.set(0.12,0.32,0); g.add(stand); mk(CYL(0.008,0.008,0.36,8), B, 0,0.18,0,stand);
    [[0.18,0.02],[0.13,0.15],[0.09,0.27]].forEach(([r,y],i)=>{ mk(CYL(r,r*0.9,0.012,28), P, 0,y,0,stand); for (let k=0;k<(i===2?1:4);k++){ const a=k/4*TAU+i; const cx=i===2?0:Math.cos(a)*r*0.55, cz=i===2?0:Math.sin(a)*r*0.55;
      mk(CYL(0.032,0.036,0.035,14), ceramic([0xf8c8d8,0xfff0c8,0xc8e8c0][(k+i)%3]), cx,y+0.024,cz,stand); mk(G.sph(0.012,8,6), ceramic(0xe2483d), cx,y+0.05,cz,stand); } });
    for (let i=0;i<4;i++) mk(CYL(0.11,0.1,0.01,24), P, -0.2,0.33+i*0.012,0.05,g); },
  knitbasket(g){ const Wv=weaveMat(0xc89a5a);
    const b=mk(lathe([[0,0.02],[0.28,0.02],[0.33,0.12],[0.36,0.3],[0.37,0.34]],36), Wv, 0,0,0,g); b.material=b.material.clone(); b.material.side=THREE.DoubleSide;
    mk(G.tor(0.37,0.03,8,36), woodMat(0xa8754a), 0,0.34,0,g).rotation.x=Math.PI/2; mk(tube([[-0.34,0.34,0],[-0.28,0.62,0],[0,0.72,0],[0.28,0.62,0],[0.34,0.34,0]],0.022,30,8), woodMat(0xa8754a), 0,0,0,g);
    const yarn=[[0xe86a5a,-0.12,0.32,0.05],[0x6ab0d8,0.12,0.3,-0.06],[0xf2c040,0.02,0.32,0.14],[0x9ac06a,0.0,0.3,-0.16]];
    for (const [c,x,y,z] of yarn){ const s=mk(G.sph(0.12,24,18), knit(c,null,16), x,y,z,g); s.rotation.set(x*5,z*4,0.6); for (let k=0;k<3;k++){ const w=mk(G.tor(0.122,0.008,6,30), knit(c), x,y,z,g); w.rotation.set(k*1.1,k*0.7,0.3); } }
    for (const s of [-1,1]){ const n=mk(CYL(0.008,0.008,0.5,8), woodMat(0xe8c99a), -0.12+s*0.04,0.5,0.05,g); n.rotation.set(0.3,0,s*0.5); mk(G.sph(0.018,8,6), ceramic(0xe86a5a), -0.12+s*0.04-s*0.12,0.73,0.12,g); }
    const sc=mk(new THREE.TubeGeometry(curve([[0.18,0.36,0.22],[0.36,0.34,0.3],[0.44,0.16,0.36],[0.42,0.02,0.5],[0.3,0.01,0.66]]),30,0.05,8,false), knit(0x6ab0d8,0xf8f4ec,12), 0,0,0,g); sc.scale.set(1,1,1); },
  /* ---------- Lumi ---------- */
  starlamp(g){ const B=brass();
    for (let i=0;i<3;i++){ const a=i/3*TAU; mk(tube([[Math.cos(a)*0.3,0,Math.sin(a)*0.3],[Math.cos(a)*0.14,0.4,Math.sin(a)*0.14],[0,0.75,0]],0.016,20,6), B, 0,0,0,g); mk(G.sph(0.03,10,8), B, Math.cos(a)*0.3,0.02,Math.sin(a)*0.3,g); }
    mk(CYL(0.02,0.02,0.3,10), B, 0,0.86,0,g); mk(G.tor(0.3,0.012,6,36), B, 0,1.24,0,g).rotation.x=Math.PI/2+0.3;
    const tex=canvasTex(512,256,(x,W,H)=>{ x.fillStyle='#000'; x.fillRect(0,0,W,H); let s=5; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
      for (let i=0;i<90;i++){ x.fillStyle='#fff'; x.beginPath(); x.arc(r()*W, 20+r()*(H-40), 1.5+r()*3, 0, TAU); x.fill(); }
      x.fillStyle='#fff'; for (let i=0;i<9;i++){ const cx=r()*W, cy=40+r()*(H-80), R=9+r()*6; x.beginPath(); for (let k=0;k<10;k++){ const a=-Math.PI/2+k*Math.PI/5, rr=k%2?R*0.45:R; x.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); } x.closePath(); x.fill(); } });
    const globe=new THREE.Group(); globe.position.y=1.24; g.add(globe);
    mk(G.sph(0.27,40,28), new THREE.MeshStandardMaterial({ color:0x1e2a5a, metalness:0.4, roughness:0.35, emissive:0xfff0b0, emissiveMap:tex, emissiveIntensity:1.4 }), 0,0,0,globe);
    mk(G.tor(0.275,0.01,6,40), B, 0,0,0,globe).rotation.x=Math.PI/2; mk(G.sph(0.035,10,8), B, 0,0.29,0,globe);
    const core=addGlow(g, 1.24, 2.2, 0xfff0c0); void core;
    const pos=new Float32Array(24*3), seed=[...Array(24)].map(()=>[Math.random()*TAU, 0.35+Math.random()*0.35, Math.random()*0.5-0.25, 0.2+Math.random()*0.5]);
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    const pts=new THREE.Points(geo, new THREE.PointsMaterial({ color:0xfff4c0, size:0.04, transparent:true, opacity:0.9, depthWrite:false, blending:THREE.AdditiveBlending })); pts.frustumCulled=false; g.add(pts);
    anim(g,(t,dt)=>{ globe.rotation.y+=dt*0.25; for (let i=0;i<24;i++){ const [a,r,y,sp]=seed[i]; pos[i*3]=Math.cos(a+t*sp)*r; pos[i*3+1]=1.24+y+Math.sin(t*sp*2+a)*0.05; pos[i*3+2]=Math.sin(a+t*sp)*r; } geo.attributes.position.needsUpdate=true; }); },
  moonmobile(g){ const W=woodMat(0x6a4a3a), Th=M(0xf6f2ea);
    mk(CYL(0.26,0.3,0.06,28), W, 0,0.03,0,g); mk(tube([[0,0.05,0],[0,0.9,0],[0.05,1.35,0],[0.25,1.6,0],[0.5,1.62,0]],0.03,30,8), W, 0,0,0,g);
    const mob=new THREE.Group(); mob.position.set(0.5,1.6,0); g.add(mob); mk(G.sph(0.03,8,6), W, 0,0,0,mob);
    const arm=new THREE.Group(); arm.position.y=-0.18; mob.add(arm); quiet(mk(CYL(0.003,0.003,0.18,4), Th, 0,0.09,0,arm)); mk(CYL(0.008,0.008,0.6,6), W, 0,0,0,arm).rotation.z=Math.PI/2; mk(CYL(0.008,0.008,0.5,6), W, 0,0,0,arm).rotation.x=Math.PI/2;
    const hang=(x,z,len,build)=>{ const h=new THREE.Group(); h.position.set(x,0,z); arm.add(h); quiet(mk(CYL(0.003,0.003,len,4), Th, 0,-len/2,0,h)); const o=new THREE.Group(); o.position.y=-len; h.add(o); build(o); return o; };
    const moon=hang(0.3,0,0.18,o=>{ mk(extrude(crescentShape(0.14),0.05,0.02), emis(0xfff0b0,0.35,{ roughness:0.5 }), 0,-0.14,0,o); });
    const stars=[[-0.3,0,0.3,0xf8d050],[0,0.25,0.22,0xf8e8a0],[0,-0.25,0.34,0xf8c040]].map(([x,z,l,c])=>hang(x,z,l,o=>{ mk(extrude(starShape(0.07,0.03),0.025,0.008), emis(c,0.3), 0,-0.07,0,o); }));
    hang(-0.12,-0.12,0.42,o=>{ for (const [x,y,r] of [[0,0,0.07],[0.07,0.01,0.055],[-0.07,0,0.055],[0.03,0.05,0.05]]) mk(G.sph(r,14,10), M(0xf4f6fa,{ roughness:0.9 }), x,y-0.06,0,o).scale.z=0.6; });
    anim(g,(t)=>{ arm.rotation.y=t*0.25; moon.rotation.y=Math.sin(t*0.9)*0.5; stars.forEach((s,i)=>{ s.rotation.y=t*(0.6+i*0.2); s.userData.y??=s.position.y; s.position.y=s.userData.y+Math.sin(t*1.2+i)*0.02; }); arm.rotation.z=Math.sin(t*0.7)*0.05; }); },
  /* ---------- Bramble / Marlo ---------- */
  rodrack(g){ const W=woodMat(0x8b5e3a), Wd=woodMat(0x6a4a3a);
    mk(G.box(1.0,0.08,0.36), Wd, 0,0.04,0,g); for (const x of [-0.46,0.46]) mk(G.box(0.07,1.5,0.07), W, x,0.75,-0.12,g); mk(G.box(1.0,0.07,0.08), W, 0,1.42,-0.12,g); mk(G.box(1.0,0.05,0.06), W, 0,0.6,-0.08,g);
    const rods=[[-0.3,0xc8a070,0xe2483d],[0,0x5a3a2a,0xf2c040],[0.3,0xd8c8a0,0x3a8ad8]], bob=[];
    for (const [x,c,bc] of rods){ const r=mk(CYL(0.008,0.02,1.7,8), woodMat(c), x,0.9,-0.05,g); r.rotation.x=-0.06; mk(CYL(0.025,0.025,0.12,10), M(0x2a2a2a), x,0.25,-0.035,g);
      const rl=mk(CYL(0.05,0.05,0.04,18), shellMat(0xb8b8c0,{metalness:0.7,roughness:0.3}), x+0.05,0.38,-0.02,g); rl.rotation.z=Math.PI/2; mk(G.box(0.008,0.05,0.008), M(0x2a2a2a), x+0.075,0.4,0.0,g);
      const p=new THREE.Group(); p.position.set(x,1.72,-0.15); g.add(p); quiet(mk(CYL(0.002,0.002,0.5,3), M(0xf8f8f8), 0,-0.25,0,p)); const bb=new THREE.Group(); bb.position.y=-0.52; p.add(bb);
      mk(G.sph(0.035,12,10,0,TAU,0,Math.PI/2), ceramic(bc), 0,0,0,bb); mk(G.sph(0.035,12,10,0,TAU,Math.PI/2,Math.PI/2), ceramic(0xf8f8f8), 0,0,0,bb); mk(CYL(0.004,0.004,0.04,4), M(0x2a2a2a), 0,0.05,0,bb); bob.push(p); }
    const net=new THREE.Group(); net.position.set(0.62,0,0.1); net.rotation.z=0.25; g.add(net); mk(CYL(0.015,0.015,1.0,8), W, 0,0.5,0,net); mk(G.tor(0.16,0.015,6,24), W, 0,1.12,0,net).rotation.x=Math.PI/2.4;
    const nm=new THREE.MeshStandardMaterial({ color:0x6a8a5a, transparent:true, opacity:0.55, side:THREE.DoubleSide, roughness:0.9 }); mk(G.cone(0.16,0.3,14,1,true), nm, 0,0.98,0.02,net).rotation.x=Math.PI;
    const tb=new THREE.Group(); tb.position.set(-0.05,0.08,0.28); g.add(tb); mk(G.box(0.4,0.16,0.22), shellMat(0x3a7a5a,{roughness:0.5}), 0,0.08,0,tb); const lid=mk(G.box(0.4,0.02,0.22), shellMat(0x3a7a5a,{roughness:0.5}), 0,0.2,-0.1,tb); lid.rotation.x=-1.1;
    for (let i=0;i<8;i++) mk(G.cap(0.012,0.03,3,6), ceramic([0xe2483d,0xf2c040,0x3a8ad8,0xf08aac][i%4]), -0.15+(i%4)*0.1,0.17,-0.05+Math.floor(i/4)*0.09,tb).rotation.z=Math.PI/2;
    anim(g,(t)=>bob.forEach((p,i)=>{ p.rotation.z=Math.sin(t*1.2+i*1.7)*0.08; p.rotation.x=Math.sin(t*0.9+i)*0.05; })); },
  carvebench(g){ const W=woodMat(0xa8754a), Wl=woodMat(0xc99a6a), bark=woodMat(0x6a4a3a);
    for (const x of [-0.45,0.45]) for (const z of [-0.15,0.15]){ const l=mk(CYL(0.06,0.07,0.42,10), bark, x,0.21,z,g); l.rotation.z=x>0?-0.12:0.12; }
    for (let i=0;i<3;i++) mk(G.box(1.2,0.06,0.15), W, 0,0.45,-0.16+i*0.16,g);
    const duck=new THREE.Group(); duck.position.set(-0.15,0.48,0.02); g.add(duck);
    mk(G.sph(0.13,20,14), Wl, 0.05,0.1,0,duck).scale.set(1.2,0.8,0.9); mk(G.sph(0.08,16,12), Wl, 0.17,0.22,0,duck); mk(G.cone(0.03,0.08,10), Wl, 0.26,0.21,0,duck).rotation.z=-Math.PI/2;
    mk(G.box(0.18,0.2,0.2), Wl, -0.15,0.1,0,duck); mk(G.box(0.12,0.1,0.15), Wl, -0.24,0.14,0,duck).rotation.z=0.4;
    for (let i=0;i<12;i++){ const s=mk(G.tor(0.025+((i*7)%5)*0.004,0.005,4,12,Math.PI*1.5), M(0xe8c99a), -0.5+((i*0.37)%1)*1.0, 0.485+(i%3)*0.003, -0.18+((i*0.61)%1)*0.36, g); s.rotation.set(Math.PI/2+i, i*0.7, 0); }
    for (let i=0;i<10;i++){ const s=mk(G.tor(0.03,0.005,4,12,Math.PI*1.4), M(0xe8c99a), -0.6+((i*0.43)%1)*1.2, 0.01, -0.4+((i*0.29)%1)*0.8, g); s.rotation.set(Math.PI/2,i,0); }
    const kn=new THREE.Group(); kn.position.set(0.25,0.49,0.08); kn.rotation.y=0.4; g.add(kn); mk(G.box(0.1,0.025,0.025), woodMat(0x5a3a2a), 0,0,0,kn); mk(G.box(0.07,0.004,0.018), shellMat(0xc8c8d0,{metalness:0.8,roughness:0.2}), 0.08,0,0,kn);
    const bear=new THREE.Group(); bear.position.set(0.42,0.48,-0.06); g.add(bear); mk(G.sph(0.06,14,10), Wl, 0,0.06,0,bear).scale.set(1,1.1,0.9); mk(G.sph(0.045,14,10), Wl, 0,0.15,0,bear); for (const s of [-1,1]) mk(G.sph(0.018,8,6), Wl, s*0.035,0.19,0,bear);
    const mal=new THREE.Group(); mal.position.set(0.1,0.49,-0.12); mal.rotation.y=-0.6; g.add(mal); mk(CYL(0.012,0.012,0.22,8), W, 0,0,0,mal).rotation.z=Math.PI/2; mk(CYL(0.04,0.04,0.09,12), bark, 0.13,0,0,mal); },
  /* ---------- Otis ---------- */
  trampoline(g){ const Mt=iron(), pad=fabricMat(0x3a8ad8,'stripe',0x5aa0e8), R=1.1;
    for (let i=0;i<6;i++){ const a=i/6*TAU; const leg=mk(tube([[Math.cos(a)*R,0.48,Math.sin(a)*R],[Math.cos(a)*(R+0.05),0.2,Math.sin(a)*(R+0.05)],[Math.cos(a)*R,0.02,Math.sin(a)*R]],0.03,12,6), Mt, 0,0,0,g); void leg; mk(G.sph(0.045,8,6), M(0x2a2a2a), Math.cos(a)*R,0.02,Math.sin(a)*R,g); }
    mk(G.tor(R,0.035,8,60), Mt, 0,0.5,0,g).rotation.x=Math.PI/2; const pd=mk(G.tor(R-0.02,0.09,10,60), pad, 0,0.55,0,g); pd.rotation.x=Math.PI/2; pd.scale.z=0.55;
    const matG=new THREE.Group(); matG.position.y=0.52; g.add(matG); const geo=new THREE.CircleGeometry(R-0.14,40,0,TAU); geo.rotateX(-Math.PI/2); const base=Float32Array.from(geo.attributes.position.array);
    const mt=mk(geo, M(0x2a2a30,{ roughness:0.7, side:THREE.DoubleSide }), 0,0,0,matG); mt.receiveShadow=true;
    mk(G.tor(R-0.14,0.012,4,60), M(0xf2c040), 0,0.003,0,matG).rotation.x=Math.PI/2;
    const springs=[]; for (let i=0;i<24;i++){ const a=i/24*TAU; const s=mk(CYL(0.012,0.012,0.14,6), shellMat(0xc8c8d0,{metalness:0.8,roughness:0.25}), Math.cos(a)*(R-0.07),0.51,Math.sin(a)*(R-0.07),g); s.rotation.set(0,-a,Math.PI/2); springs.push(s); }
    const ball=new THREE.Group(); g.add(ball); const bc=[0xe2483d,0xf8f4ec,0x3a8ad8,0xf2c040,0xf8f4ec,0x4fae5a]; for (let i=0;i<6;i++) mk(G.sph(0.16,16,12,i/6*TAU,TAU/6), ceramic(bc[i]), 0,0,0,ball);
    anim(g,(t)=>{ const ph=(t*1.1)%1, h=Math.sin(ph*Math.PI), dip=Math.max(0,1-ph/0.12)+Math.max(0,(ph-0.88)/0.12); ball.position.set(0.1,0.68+h*1.1,-0.05); ball.rotation.x=t*2; ball.scale.set(1+dip*0.15,1-dip*0.2,1+dip*0.15);
      const p=geo.attributes.position; for (let i=0;i<p.count;i++){ const x=base[i*3], z=base[i*3+2], d=Math.hypot(x-0.1,z+0.05)/(R-0.14); p.setY(i, -Math.max(0,1-d*d)*dip*0.14); } p.needsUpdate=true; }); },
  /* ---------- Clover ---------- */
  cloudbag(g){ const C=new THREE.MeshPhysicalMaterial({ color:0xf8faff, roughness:1, sheen:1, sheenRoughness:0.5, sheenColor:new THREE.Color(0xd8e8ff) }); const p=new THREE.Group(); g.add(p);
    for (const [x,y,z,r] of [[0,0.28,0,0.4],[0.36,0.26,0.05,0.3],[-0.36,0.26,0.05,0.3],[0.2,0.22,0.32,0.26],[-0.2,0.22,0.32,0.26],[0.24,0.5,-0.18,0.28],[-0.24,0.5,-0.18,0.28],[0,0.56,-0.26,0.3],[0,0.18,0.36,0.22]])
      mk(G.sph(r,26,18), C, x,y,z,p).scale.set(1,0.78,1);
    mk(G.sph(0.3,24,14), C, 0,0.42,0.06,p).scale.set(1.1,0.35,1);
    for (const s of [-1,1]){ quiet(mk(G.sph(0.028,10,8), M(0x2a2428,{roughness:0.2}), s*0.1,0.32,0.52,p)); const bl=quiet(mk(G.sph(0.04,10,8), wisp(0.55,0xf8a0b0), s*0.2,0.27,0.5,p)); bl.scale.set(1,0.5,0.3); }
    quiet(mk(G.tor(0.035,0.008,6,14,Math.PI), M(0x2a2428), 0,0.28,0.53,p)).rotation.z=Math.PI;
    anim(g,(t)=>{ const k=Math.sin(t*1.3)*0.025; p.scale.set(1+k,1-k,1+k); }); },
  /* ---------- Juniper ---------- */
  eggchair(g){ const Mt=shellMat(0x2a2a30,{ metalness:0.5, roughness:0.4 }), Wv=weaveMat(0xd8b884);
    mk(CYL(0.4,0.44,0.06,30), Mt, 0,0.03,0,g); mk(tube([[0,0.05,-0.3],[0,1.2,-0.45],[0,2.0,-0.3],[0,2.15,0.05],[0,2.05,0.2]],0.04,40,10), Mt, 0,0,0,g);
    const sw=new THREE.Group(); sw.position.set(0,2.05,0.2); g.add(sw);
    for (let i=0;i<6;i++){ const l=mk(G.tor(0.025,0.007,4,10), Mt, 0,-0.03-i*0.045,0,sw); l.rotation.y=i%2?Math.PI/2:0; l.scale.y=1.4; }
    const egg=new THREE.Group(); egg.position.set(0,-0.95,-0.12); sw.add(egg); const em=Wv.clone(); em.side=THREE.DoubleSide;
    const sh=mk(G.sph(0.55,40,30,Math.PI*0.75,Math.PI*1.5,0,Math.PI*0.86), em, 0,0,0,egg); sh.scale.set(1,1.3,0.95);
    mk(G.tor(0.47,0.035,8,40,Math.PI*1.4), woodMat(0xc8a070), 0,0.05,0.18,egg).rotation.set(0,0,-Math.PI*0.2);
    const cu=mk(G.sph(0.44,28,16,0,TAU,Math.PI*0.5,Math.PI*0.5), fabricMat(0xf2e8d8,'plain'), 0,-0.12,0,egg); cu.scale.set(1,0.5,0.9);
    const pil=mk(G.sph(0.2,18,12), fabricMat(0xc8a0b8,'flower',0xf8f0f4), 0,0.12,-0.3,egg); pil.scale.set(1.3,1,0.45);
    anim(g,(t)=>{ sw.rotation.x=Math.sin(t*0.8)*0.04; sw.rotation.z=Math.sin(t*0.6+1)*0.03; }); },
  vanity(g){ const W=woodMat(0xf2e8d8), Wd=woodMat(0xd8c8b0), B=gold();
    mk(G.box(1.0,0.06,0.46), W, 0,0.74,-0.1,g); mk(G.box(0.96,0.14,0.42), Wd, 0,0.64,-0.1,g); for (let i=-1;i<=1;i++){ mk(G.box(0.28,0.1,0.01), W, i*0.31,0.64,0.115,g); mk(G.sph(0.016,8,6), B, i*0.31,0.64,0.125,g); }
    for (const [x,z] of [[0.44,0.08],[-0.44,0.08],[0.44,-0.28],[-0.44,-0.28]]){ const l=mk(tube([[x,0.58,z],[x*1.04,0.3,z],[x*0.98,0.0,z]],0.025,12,8), Wd, 0,0,0,g); void l; }
    const mir=new THREE.Group(); mir.position.set(0,1.24,-0.28); g.add(mir); mk(G.tor(0.36,0.035,10,48), W, 0,0,0,mir).scale.y=1.25;
    mk(new THREE.CircleGeometry(0.34,48), new THREE.MeshStandardMaterial({ roughness:0.15, map:canvasTex(128,160,(x,w,h)=>{ const gr=x.createLinearGradient(0,0,w,h); gr.addColorStop(0,'#eef6fa'); gr.addColorStop(0.5,'#bcd4e0'); gr.addColorStop(1,'#9ab4c4'); x.fillStyle=gr; x.fillRect(0,0,w,h); x.fillStyle='rgba(255,255,255,.55)'; x.beginPath(); x.moveTo(20,h); x.lineTo(50,h); x.lineTo(110,0); x.lineTo(80,0); x.fill(); x.fillStyle='rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(60,h); x.lineTo(70,h); x.lineTo(128,20); x.lineTo(128,5); x.fill(); }) }), 0,0,0.005,mir).scale.y=1.25;
    for (let i=0;i<12;i++){ const a=i/12*TAU; mk(G.sph(0.035,12,10), glowMat(0xfff0c8), Math.cos(a)*0.4,Math.sin(a)*0.5,0.03,mir); } addGlow(g, 1.24, 2.0, 0xfff0d0);
    mk(G.box(0.06,0.2,0.04), W, 0,0.88,-0.3,g);
    const bot=[[0.28,0.04,0xf0a0c8],[0.36,-0.05,0x9ad0e8],[0.2,-0.1,0xe8d080]]; for (const [x,z,c] of bot){ mk(lathe([[0,0],[0.04,0],[0.045,0.06],[0.02,0.1],[0.012,0.12],[0,0.12]],16), glassMat(c,0.55), x,0.77,z,g); mk(G.sph(0.018,8,6), B, x,0.9,z,g); }
    mk(G.box(0.18,0.08,0.12), shellMat(0x8a3a5a,{roughness:0.3}), -0.3,0.81,-0.08,g); const lid=mk(G.box(0.18,0.02,0.12), B, -0.3,0.86,-0.14,g); lid.rotation.x=-0.8; for (let i=0;i<3;i++) mk(G.sph(0.014,8,6), ceramic(0xfaf4ea), -0.34+i*0.04,0.855,-0.07,g);
    const st=new THREE.Group(); st.position.set(0,0,0.35); g.add(st); mk(CYL(0.2,0.2,0.12,24), fabricMat(0xf0b8c8,'check',0xfff4f8), 0,0.46,0,st); for (let i=0;i<4;i++){ const a=i/4*TAU+0.78; mk(CYL(0.02,0.015,0.42,8), Wd, Math.cos(a)*0.15,0.2,Math.sin(a)*0.15,st); } },
  candelabra(g){ const S=silver(), wax=ceramic(0xfaf2de);
    mk(lathe([[0,0],[0.2,0],[0.2,0.03],[0.12,0.07],[0.06,0.12],[0.05,0.5],[0.08,0.56],[0.04,0.6],[0.04,0.9],[0.07,0.94],[0,0.95]],32), S, 0,0,0,g);
    const flames=[];
    const cand=(x,y,z,h)=>{ mk(lathe([[0,0],[0.055,0],[0.06,0.03],[0.04,0.04],[0,0.04]],20), S, x,y,z,g); mk(CYL(0.028,0.03,h,14), wax, x,y+0.04+h/2,z,g); const dr=mk(G.sph(0.012,8,6), wax, x+0.028,y+0.04+h*0.8,z,g); dr.scale.y=2;
      const f=new THREE.Group(); f.position.set(x,y+0.06+h,z); g.add(f); quiet(mk(CYL(0.003,0.003,0.03,4), M(0x2a2a2a), 0,0,0,f)); const fl=quiet(mk(G.sph(0.022,10,8), emis(0xffb040,1.6), 0,0.04,0,f)); fl.scale.set(0.7,1.6,0.7); const inner=quiet(mk(G.sph(0.012,8,6), emis(0xfff4c0,2), 0,0.032,0,f)); inner.scale.y=1.5; flames.push(f); };
    cand(0,0.95,0,0.26);
    for (const s of [-1,1]) for (const k of [0,1]){ const r=k?0.36:0.2, y=k?0.72:0.82; const arm=mk(tube([[0,0.62+k*0.12,0],[s*r*0.5,0.56+k*0.12,0],[s*r,y-0.08,0],[s*r,y,0]],0.016,20,6), S, 0,0,0,g); void arm; cand(s*r,y,0,0.2+k*0.04); }
    addGlow(g, 1.1, 2.4, 0xffc070);
    anim(g,(t)=>flames.forEach((f,i)=>{ const k=1+Math.sin(t*13+i*2.1)*0.12+Math.sin(t*7.3+i)*0.08; f.scale.set(1,k,1); f.rotation.z=Math.sin(t*5+i)*0.08; })); },
  /* ---------- Pippa / Sprig ---------- */
  flowercart(g){ const W=woodMat(0x8b5e3a), Wl=woodMat(0xc99a6a), Z=zinc();
    mk(G.box(1.3,0.08,0.7), W, 0,0.5,0,g); for (const s of [-1,1]){ mk(G.box(1.3,0.18,0.04), Wl, 0,0.62,s*0.34,g); mk(G.box(0.04,0.18,0.7), Wl, s*0.64,0.62,0,g); }
    wheel(g, 0.36, 0.25,0.36,0.4, W, 10, 0); wheel(g, 0.36, 0.25,0.36,-0.4, W, 10, 0); mk(CYL(0.025,0.025,0.86,8), W, 0.25,0.36,0,g).rotation.x=Math.PI/2;
    mk(G.box(0.06,0.5,0.06), W, -0.55,0.25,0,g); for (const s of [-1,1]) mk(CYL(0.025,0.025,0.6,8), W, -0.88,0.62,s*0.28,g).rotation.z=Math.PI/2+0.25;
    const fls=[]; const cols=[[0xf04a6a,0xfff0a0],[0xf8d040,0xe8803a],[0xffffff,0xf8d040],[0xc88af0,0xfff4c0],[0xf8a0c0,0xfff0a0],[0xe86a2a,0x5a3a20]];
    for (let i=0;i<6;i++){ const x=-0.42+(i%3)*0.42, z=i<3?-0.16:0.16; mk(lathe([[0,0],[0.11,0],[0.13,0.2],[0.135,0.21]],20), Z, x,0.54,z,g); quiet(mk(CYL(0.125,0.125,0.01,20), soil(), x,0.73,z,g));
      const st=new THREE.Group(); st.position.set(x,0.74,z); g.add(st); fls.push(st); const [c,cc]=cols[i];
      for (let k=0;k<5;k++){ const a=k/5*TAU+i, rr=0.05; const s=new THREE.Group(); s.position.set(Math.cos(a)*rr,0,Math.sin(a)*rr); s.rotation.set(Math.sin(a)*0.25,0,-Math.cos(a)*0.25); st.add(s); mk(CYL(0.006,0.006,0.32,4), M(0x4f8a3a), 0,0.16,0,s); bloomAt(s, 0,0.33,0, c, 0.04, 6, cc); quiet(mk(G.sph(0.03,8,4), M(0x5fae43), 0.02,0.16,0,s)).scale.set(0.4,1.4,0.2); } }
    for (const [x,z] of [[0.6,0.32],[0.6,-0.32],[-0.6,0.32],[-0.6,-0.32]]) mk(CYL(0.02,0.02,1.1,8), W, x,1.15,z,g);
    const aw=new THREE.Group(); aw.position.y=1.72; g.add(aw); const stp=fabricMat(0xf06a6a,'stripe',0xfff8ee); for (const s of [-1,1]){ const r=mk(G.box(1.36,0.02,0.44), stp, 0,0.08,s*0.18,aw); r.rotation.x=s*0.38; }
    for (let i=0;i<9;i++) for (const s of [-1,1]){ const sc=mk(G.sph(0.075,10,6,0,TAU,Math.PI/2,Math.PI/2), i%2?fabricMat(0xfff8ee):fabricMat(0xf06a6a), -0.6+i*0.15,0.0,s*0.37,aw); sc.scale.set(1,0.8,0.25); }
    anim(g,(t)=>fls.forEach((s,i)=>{ s.rotation.z=Math.sin(t*1.1+i)*0.05; s.rotation.x=Math.sin(t*0.8+i*2)*0.04; })); },
  porchswing(g){ const W=woodMat(0xa8754a), Wd=woodMat(0x8b5e3a), Ch=shellMat(0x8a8a90,{ metalness:0.7, roughness:0.35 });
    for (const s of [-1,1]){ for (const z of [-0.35,0.35]){ const p=mk(G.box(0.1,1.95,0.1), Wd, s*1.0,0.95,z*0.85,g); p.rotation.x=z>0?-0.16:0.16; } mk(G.box(0.12,0.1,0.8), Wd, s*1.0,0.06,0,g); }
    mk(G.box(2.2,0.12,0.12), Wd, 0,1.88,0,g);
    const vine=[]; for (let i=0;i<=20;i++){ const x=-1.05+i*0.105; vine.push(V3(x,1.82-Math.sin(i/20*Math.PI)*0.12+Math.sin(i*1.7)*0.02,0.08)); } mk(new THREE.TubeGeometry(curve(vine),40,0.014,5,false), M(0x4f8a3a), 0,0,0,g);
    vine.forEach((p,i)=>{ if (i%2) quiet(mk(G.sph(0.04,8,4), M(0x5fae43), p.x,p.y-0.02,p.z+0.02,g)).scale.set(1.2,0.4,0.8); else bloomAt(g, p.x,p.y-0.03,p.z+0.03, [0xf8a0c0,0xffffff,0xf8d050][i%3], 0.035, 5); });
    const sw=new THREE.Group(); sw.position.y=1.82; g.add(sw);
    for (const s of [-1,1]) for (const z of [-0.18,0.18]){ for (let k=0;k<16;k++){ const l=mk(G.tor(0.02,0.006,4,8), Ch, s*0.72,-0.03-k*0.06,z,sw); l.rotation.y=k%2?Math.PI/2:0; l.scale.y=1.6; } }
    const seat=new THREE.Group(); seat.position.y=-1.0; sw.add(seat);
    for (let i=0;i<5;i++) mk(G.box(1.5,0.04,0.09), W, 0,0,-0.2+i*0.1,seat); for (let i=0;i<6;i++) mk(G.box(0.08,0.5,0.03), W, -0.6+i*0.24,0.27,-0.26,seat).rotation.x=-0.18;
    mk(G.box(1.5,0.06,0.05), W, 0,0.52,-0.3,seat).rotation.x=-0.18; for (const s of [-1,1]){ mk(G.box(0.05,0.04,0.5), W, s*0.74,0.24,0,seat); mk(G.box(0.04,0.24,0.04), W, s*0.74,0.12,0.2,seat); }
    const cu=mk(G.box(1.3,0.08,0.4), fabricMat(0xf8e8c0,'check',0x9ac08a), 0,0.06,0,seat); void cu;
    for (const [x,c] of [[-0.45,0xf0a0b0],[0.45,0x8ab8e0]]){ const p=mk(G.sph(0.17,16,12), fabricMat(c,'flower',0xfff8f0), x,0.25,-0.15,seat); p.scale.set(1,1,0.45); p.rotation.x=-0.2; }
    anim(g,(t)=>{ sw.rotation.x=Math.sin(t*0.85)*0.07; }); },
  pottingbench(g){ const W=woodMat(0xa8754a), Wd=woodMat(0x8b5e3a), T=terra();
    for (const x of [-0.55,0.55]) for (const z of [-0.2,0.2]) mk(G.box(0.07,0.8,0.07), Wd, x,0.4,z,g);
    mk(G.box(1.25,0.05,0.5), W, 0,0.8,0,g); mk(G.box(1.2,0.04,0.44), W, 0,0.2,0,g); for (const x of [-0.55,0.55]) mk(G.box(0.07,0.55,0.07), Wd, x,1.08,-0.22,g); mk(G.box(1.25,0.04,0.18), W, 0,1.3,-0.18,g);
    const sprouts=[];
    const pot=(x,y,z,s=1,plant=true)=>{ const p=new THREE.Group(); p.position.set(x,y,z); p.scale.setScalar(s); g.add(p); mk(lathe([[0,0],[0.07,0],[0.09,0.13],[0.1,0.14],[0.1,0.16],[0.09,0.16]],20), T, 0,0,0,p); quiet(mk(CYL(0.085,0.085,0.01,18), soil(), 0,0.14,0,p));
      if (plant){ const sp=new THREE.Group(); sp.position.y=0.14; p.add(sp); mk(CYL(0.005,0.005,0.08,4), M(0x5a9a3a), 0,0.04,0,sp); for (const s2 of [-1,1]){ const l=mk(G.sph(0.03,8,4), M(0x6ac04a), s2*0.025,0.08,0,sp); l.scale.set(1.2,0.3,0.7); l.rotation.z=s2*0.4; } sprouts.push(sp); } return p; };
    pot(-0.42,0.825,0.05); pot(-0.22,0.825,0.12,0.8); pot(0.45,0.825,-0.08,1.2); pot(-0.3,1.32,-0.18,0.7); pot(0.0,1.32,-0.18,0.7,false); pot(0.3,1.32,-0.18,0.7);
    for (let i=0;i<3;i++) pot(0.3+i*0.07,0.22+i*0.02,0.02,0.7,false).rotation.z=0.1;
    const tr=new THREE.Group(); tr.position.set(0.1,0.83,0.05); g.add(tr); mk(G.box(0.34,0.05,0.24), M(0x3a4a3a,{roughness:0.8}), 0,0.025,0,tr); quiet(mk(G.box(0.32,0.01,0.22), soil(), 0,0.052,0,tr));
    for (let i=0;i<4;i++) for (let j=0;j<3;j++){ const s=new THREE.Group(); s.position.set(-0.12+i*0.08,0.055,-0.07+j*0.07); tr.add(s); quiet(mk(CYL(0.003,0.003,0.04,3), M(0x7ac04a), 0,0.02,0,s)); const l=quiet(mk(G.sph(0.012,6,4), M(0x8ad05a), 0,0.04,0,s)); l.scale.set(1.6,0.4,0.8); sprouts.push(s); }
    const tw=new THREE.Group(); tw.position.set(0.32,0.83,0.15); tw.rotation.y=0.6; g.add(tw); mk(CYL(0.015,0.015,0.12,8), woodMat(0xc8604a), -0.08,0.015,0,tw).rotation.z=Math.PI/2; const bl=mk(G.sph(0.04,10,6,0,TAU,0,Math.PI/2), shellMat(0xb8b8c0,{metalness:0.7,roughness:0.3}), 0.04,0.01,0,tw); bl.scale.set(1.4,0.3,0.8);
    const can=new THREE.Group(); can.position.set(-0.4,0.225,0.0); g.add(can); mk(CYL(0.09,0.1,0.16,18), shellMat(0x4ab0a8,{roughness:0.35}), 0,0.08,0,can); mk(CYL(0.012,0.02,0.2,8), shellMat(0x4ab0a8,{roughness:0.35}), 0.12,0.12,0,can).rotation.z=-1.0; mk(G.tor(0.06,0.012,6,14,Math.PI), shellMat(0x4ab0a8,{roughness:0.35}), 0,0.16,0,can).rotation.y=Math.PI/2;
    for (let i=0;i<3;i++){ const pk=mk(G.box(0.08,0.12,0.01), M([0xf2c040,0xe86a5a,0x9ac06a][i]), -0.05+i*0.09,1.38,-0.12,g); pk.rotation.x=-0.15; }
    mk(G.sph(0.16,16,10), M(0x8a6a48,{roughness:1}), 0.0,0.33,-0.05,g).scale.set(1.2,0.85,0.9);
    anim(g,(t)=>sprouts.forEach((s,i)=>{ s.rotation.z=Math.sin(t*1.4+i*0.9)*0.08; })); },
  ladybuglamp(g){ const R=shellMat(0xd83030,{ roughness:0.2 }), K=M(0x1e1a1a,{ roughness:0.3 });
    for (let i=0;i<3;i++) for (const s of [-1,1]){ const l=mk(tube([[s*0.18,0.14,-0.12+i*0.12],[s*0.32,0.12,-0.14+i*0.14],[s*0.36,0.0,-0.15+i*0.15]],0.014,10,5), K, 0,0,0,g); void l; }
    mk(G.sph(0.24,24,14), K, 0,0.18,0,g).scale.set(1,0.5,1.2);
    const bulb=mk(G.sph(0.18,20,14), glowMat(0xffd8a0), 0,0.26,0,g); bulb.scale.set(1,0.8,1.1); addGlow(g, 0.4, 2.0, 0xffd090);
    const wings=[]; for (const s of [-1,1]){ const w=new THREE.Group(); w.position.set(s*0.02,0.24,-0.02); g.add(w); const sh=mk(G.sph(0.32,28,18,s>0?Math.PI/2:Math.PI*1.5,Math.PI,0,Math.PI/2), R, 0,0,0,w); sh.scale.set(1,0.85,1.15);
      for (const [x,y,z,r] of [[0.13,0.18,0.12,0.05],[0.2,0.1,-0.12,0.06],[0.08,0.22,-0.05,0.045],[0.25,0.06,0.1,0.04]]){ const p=V3(x*s,y,z).normalize().multiply(V3(0.32,0.272,0.368)); const d=quiet(mk(G.sph(r,14,10), K, p.x,p.y,p.z, w)); d.scale.set(1,0.35,1); d.lookAt(p.x*3,p.y*3,p.z*3); }
      wings.push([w,s]); }
    const hd=new THREE.Group(); hd.position.set(0,0.24,0.36); g.add(hd); mk(G.sph(0.13,20,14), K, 0,0,0,hd).scale.set(1.1,0.85,0.8);
    for (const s of [-1,1]){ mk(G.sph(0.04,12,10), M(0xffffff,{roughness:0.3}), s*0.06,0.03,0.08,hd); quiet(mk(G.sph(0.022,10,8), K, s*0.065,0.035,0.115,hd)); }
    const ant=[]; for (const s of [-1,1]){ const a=new THREE.Group(); a.position.set(s*0.05,0.09,0.03); hd.add(a); mk(tube([[0,0,0],[s*0.04,0.12,0.04],[s*0.1,0.2,0.05]],0.008,10,5), K, 0,0,0,a); mk(G.sph(0.025,10,8), K, s*0.1,0.2,0.05,a); ant.push([a,s]); }
    anim(g,(t)=>{ for (const [w,s] of wings) w.rotation.z=-s*(0.12+Math.sin(t*1.2)*0.03); for (const [a,s] of ant) a.rotation.z=s*Math.sin(t*3+s)*0.15; }); },
  /* ---------- Marlo ---------- */
  divehelmet(g){ const Cu=shellMat(0xc8783a,{ metalness:0.85, roughness:0.3, clearcoat:0.4 }), B=brass();
    mk(G.box(0.6,0.12,0.6), woodMat(0x5a3a2a), 0,0.06,0,g); mk(G.box(0.64,0.03,0.64), woodMat(0x6a4a3a), 0,0.13,0,g);
    mk(lathe([[0.36,0],[0.38,0.03],[0.36,0.12],[0.26,0.2],[0.22,0.22]],40), Cu, 0,0.15,0,g); for (let i=0;i<12;i++){ const a=i/12*TAU; mk(G.sph(0.018,8,6), B, Math.cos(a)*0.34,0.2,Math.sin(a)*0.34,g); }
    const H=new THREE.Group(); H.position.y=0.62; g.add(H); mk(G.sph(0.32,40,30), Cu, 0,0,0,H); mk(G.tor(0.23,0.035,10,40), B, 0,-0.25,0,H).rotation.x=Math.PI/2;
    const port=(rx,ry,r)=>{ const p=new THREE.Group(); p.rotation.set(rx,ry,0); H.add(p); const q=new THREE.Group(); q.position.z=0.31; p.add(q);
      mk(G.tor(r,0.03,10,30), B, 0,0,0,q); mk(new THREE.CircleGeometry(r,30), glassMat(0xb8e0e8,0.45), 0,0,0.005,q); for (let k=0;k<6;k++){ const a=k/6*TAU; mk(G.sph(0.012,6,4), B, Math.cos(a)*(r+0.03),Math.sin(a)*(r+0.03),0.01,q); } return q; };
    const f=port(0,0,0.12); for (let k=-2;k<=2;k++) mk(G.box(0.008,0.22,0.01), B, k*0.04,0,0.03,f); port(0,Math.PI/2,0.08); port(0,-Math.PI/2,0.08); port(-0.7,0,0.06);
    mk(CYL(0.03,0.04,0.08,12), B, 0.08,0.32,-0.1,H); mk(CYL(0.025,0.025,0.06,10), B, -0.12,0.3,-0.12,H).rotation.z=0.5;
    rising(g, 6, V3(0.08,1.02,-0.1), { mat:new THREE.MeshPhysicalMaterial({ color:0xd8f4ff, transparent:true, opacity:0.45, roughness:0.05, depthWrite:false }), r:0.022, h:0.6, spread:0.04, speed:0.35, grow:0.8 }); },
  /* ---------- Pemberton ---------- */
  register(g){ const B=gold(), W=woodMat(0x5a3a2a), Bd=shellMat(0xb8903a,{ metalness:0.85, roughness:0.35 });
    mk(G.box(0.9,0.6,0.6), W, 0,0.3,0,g); mk(G.box(0.94,0.04,0.64), woodMat(0x6a4a3a), 0,0.62,0,g);
    const reg=new THREE.Group(); reg.position.set(0,0.64,0); g.add(reg); mk(G.box(0.56,0.16,0.42), Bd, 0,0.08,0,reg);
    const dr=mk(G.box(0.52,0.1,0.38), Bd, 0,0.05,0.02,reg); const coins=[]; for (let i=0;i<5;i++){ const c=mk(CYL(0.03,0.03,0.008,14), B, -0.16+i*0.08,0.1,0.06,dr); coins.push(c); }
    const top=mk(lathe([[0.001,0.36],[0.12,0.36],[0.2,0.3],[0.26,0.16],[0.26,0]],4), Bd, 0,0.16,-0.02,reg); top.rotation.y=Math.PI/4; top.scale.set(1.2,1,0.95);
    for (let r=0;r<3;r++) for (let c=0;c<6;c++){ const k=mk(CYL(0.022,0.022,0.04,12), B, -0.2+c*0.08,0.24+r*0.05,0.17-r*0.05,reg); k.rotation.x=0.7; mk(CYL(0.02,0.02,0.006,12), ceramic(0xfaf4ea), -0.2+c*0.08,0.26+r*0.05,0.185-r*0.05,reg).rotation.x=0.7; }
    const disp=new THREE.Group(); disp.position.set(0,0.62,0.0); reg.add(disp); mk(G.box(0.3,0.14,0.12), Bd, 0,0,0,disp); mk(G.box(0.24,0.08,0.01), glassMat(0xffffff,0.3), 0,0,0.062,disp);
    const tabs=[]; for (let i=0;i<3;i++){ const tb=mk(G.box(0.06,0.05,0.004), ceramic(0xfaf4ea), -0.07+i*0.07,0,0.05,disp); tabs.push(tb); }
    mk(G.sph(0.05,12,10), B, 0,0.71,0,reg); for (const s of [-1,1]){ const sc=mk(G.tor(0.06,0.014,6,16,Math.PI*1.5), B, s*0.22,0.48,0,reg); sc.rotation.y=Math.PI/2; }
    const cr=new THREE.Group(); cr.position.set(0.3,0.2,0); reg.add(cr); mk(CYL(0.012,0.012,0.12,8), B, 0,0,0.05,cr).rotation.x=Math.PI/2; mk(CYL(0.012,0.012,0.08,8), B, 0,-0.04,0.1,cr); mk(G.sph(0.022,10,8), ceramic(0x2a1a14), 0,-0.09,0.1,cr);
    anim(g,(t)=>{ const ph=(t*0.2)%1, o=ph<0.08?ph/0.08:ph<0.45?1:ph<0.55?1-(ph-0.45)/0.1:0; dr.position.z=0.02+o*0.2; cr.rotation.x=ph<0.08?ph/0.08*TAU:0; tabs.forEach((tb,i)=>{ tb.position.y = ph>0.02&&ph<0.3 ? Math.min(1,(ph-0.02-i*0.03)/0.04)*0.08*(ph-0.02-i*0.03>0?1:0) : 0; }); }); },
  /* ---------- Clementine ---------- */
  mailsorter(g){ const W=woodMat(0x8b5e3a), Wd=woodMat(0x6a4a3a), inside=M(0x4a3428,{ roughness:0.9 }), env=[];
    mk(G.box(1.1,1.04,0.03), inside, 0,0.73,-0.22,g); for (const s2 of [-1,1]) mk(G.box(0.04,1.32,0.44), Wd, s2*0.55,0.74,-0.02,g);
    mk(G.box(1.18,0.06,0.48), W, 0,1.42,-0.02,g); mk(G.box(1.14,0.2,0.44), Wd, 0,0.1,-0.02,g); mk(G.box(1.1,0.012,0.02), W, 0,0.19,0.21,g);
    for (let k=1;k<=4;k++) mk(G.box(0.025,1.02,0.42), W, -0.525+k*0.21,0.73,-0.02,g); for (let k=0;k<=4;k++) mk(G.box(1.08,0.025,0.42), W, 0,0.22+k*0.255,-0.02,g);
    const cols=[0xfaf4ea,0xf0e0c0,0xe8eef8,0xf8e4e8];
    for (let r=0;r<4;r++) for (let c=0;c<5;c++){ const x=-0.42+c*0.21, y=0.235+r*0.255, cnt=((r*5+c)*7)%4;
      for (let i=0;i<cnt;i++){ const e=mk(G.box(0.15,0.008,0.26), ceramic(cols[(i+c+r)%4]), x+((i*3)%3-1)*0.008, y+0.01+i*0.012, 0.03+i*0.012, g); e.rotation.y=((i+c)%3-1)*0.06;
        if (i===cnt-1){ quiet(mk(CYL(0.012,0.012,0.004,10), ceramic(0xd84a3a), x, y+0.016+i*0.012, 0.13+i*0.012, g)); if ((r+c)%3===0) env.push([e, e.position.z]); } }
      if (cnt===0 && (r+c)%2) { const pk=mk(G.box(0.14,0.1,0.18), M(0xc9a06a), x,y+0.06,0.0,g); pk.rotation.y=0.15; } }
    const pc=new THREE.Group(); pc.position.set(-0.25,1.45,-0.05); pc.rotation.y=0.3; g.add(pc); mk(G.box(0.3,0.18,0.24), M(0xc9a06a), 0,0.09,0,pc); mk(G.box(0.31,0.012,0.04), M(0xf2ead8), 0,0.18,0,pc); mk(G.box(0.04,0.012,0.25), M(0xf2ead8), 0,0.18,0,pc); mk(G.tor(0.03,0.008,6,12), M(0xf2ead8), 0,0.2,0,pc);
    const st=new THREE.Group(); st.position.set(0.3,1.45,0.02); g.add(st); mk(G.box(0.14,0.03,0.1), shellMat(0x3a3a7a,{roughness:0.4}), 0,0.015,0,st); mk(CYL(0.025,0.03,0.08,10), woodMat(0xc8604a), 0.06,0.07,0.1,st); mk(G.sph(0.035,10,8), woodMat(0xc8604a), 0.06,0.13,0.1,st);
    const sign=canvasTex(128,48,(x,w,h)=>{ x.fillStyle='#f6ecd6'; x.fillRect(0,0,w,h); x.strokeStyle='#8b5e3a'; x.lineWidth=4; x.strokeRect(2,2,w-4,h-4); x.fillStyle='#b8403a'; x.font='bold 28px Georgia, serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('MAIL',w/2,h/2+2); });
    mk(G.box(0.4,0.15,0.02), new THREE.MeshStandardMaterial({ map:sign, roughness:0.8 }), 0,1.56,0.15,g).rotation.x=-0.1;
    anim(g,(t)=>env.forEach(([e,z0],i)=>{ const k=Math.max(0,Math.sin(t*0.7+i*1.9)); e.position.z=z0+k*k*0.08; })); },
  /* ---------- Thistle ---------- */
  curiocabinet(g){ const W=woodMat(0x5a3a2a), Wl=woodMat(0x6a4a3a), B=brass();
    mk(G.box(0.9,1.8,0.03), M(0x2a4a3a,{ roughness:0.95 }), 0,1.0,-0.215,g); for (const s2 of [-1,1]) mk(G.box(0.05,1.8,0.42), W, s2*0.425,1.0,-0.02,g); mk(G.box(0.9,0.5,0.42), W, 0,0.35,-0.02,g); for (const x of [-0.4,0.4]) for (const z of [-0.18,0.16]) mk(G.sph(0.05,10,8), B, x,0.05,z,g);
    mk(G.box(1.0,0.1,0.5), Wl, 0,1.94,-0.02,g); mk(lathe([[0.001,0],[0.12,0],[0.1,0.06],[0.03,0.1],[0,0.12]],16), B, 0,1.99,0,g);
    for (const y of [0.55,0.98,1.42]) mk(G.box(0.82,0.03,0.36), Wl, 0,y,0.0,g); for (const y of [0.22,0.42]){ mk(G.box(0.8,0.17,0.02), Wl, 0,y,0.2,g); mk(G.sph(0.022,8,6), B, -0.15,y,0.215,g); mk(G.sph(0.022,8,6), B, 0.15,y,0.215,g); }
    for (const s of [-1,1]){ mk(G.box(0.03,1.3,0.03), Wl, s*0.43,1.22,0.2,g); mk(G.box(0.03,1.3,0.03), Wl, s*0.015,1.22,0.2,g); mk(G.box(0.42,1.28,0.008), glassMat(0xe8f4f8,0.16), s*0.215,1.22,0.205,g); mk(G.sph(0.018,8,6), B, s*0.06,1.2,0.22,g); }
    for (const s of [-1,1]) mk(G.box(0.4,0.03,0.03), Wl, s*0.215,1.88,0.2,g);
    const am=new THREE.Group(); am.position.set(-0.2,0.66,0.02); am.rotation.x=-0.3; g.add(am); mk(CYL(0.12,0.12,0.05,24), shellMat(0xc8b090,{roughness:0.7}), 0,0,0,am).rotation.x=Math.PI/2;
    const sp=[]; for (let i=0;i<80;i++){ const a=i*0.22, r=0.01+i*0.0013; sp.push([Math.cos(a)*r, Math.sin(a)*r, 0.03]); } mk(tube(sp,0.006,120,4), M(0x8a6a48), 0,0,0,am);
    mk(CYL(0.06,0.08,0.04,16), Wl, -0.2,0.585,0.02,g);
    const ge=new THREE.Group(); ge.position.set(0.2,0.57,0.02); g.add(ge); mk(G.sph(0.1,14,10,0,TAU,0,Math.PI/2), shellMat(0x8a8a80,{roughness:0.8}), 0,0,0,ge).scale.y=0.6;
    for (let i=0;i<9;i++){ const a=i/9*TAU; const c=mk(G.cone(0.025,0.1+(i%3)*0.03,6), shellMat(0x9a6ad8,{ roughness:0.05, transmission:0, clearcoat:1 }), Math.cos(a)*0.05,0.05,Math.sin(a)*0.05,ge); c.rotation.set(Math.sin(a)*0.5,0,-Math.cos(a)*0.5); }
    const card=new THREE.Group(); card.position.set(-0.18,1.18,-0.12); g.add(card); mk(G.box(0.26,0.32,0.01), ceramic(0xf6ecd6), 0,0,0,card); mk(G.box(0.28,0.34,0.008), W, 0,0,-0.006,card);
    const bt=new THREE.Group(); bt.position.set(0,0.02,0.012); card.add(bt); mk(G.sph(0.045,14,10), shellMat(0x2a6a5a,{ roughness:0.15, metalness:0.4, iridescence:0.8 }), 0,0,0,bt).scale.set(0.7,1,0.4); mk(G.sph(0.025,10,8), M(0x1a1a1a), 0,0.055,0,bt).scale.z=0.5;
    for (let i=0;i<3;i++) for (const s of [-1,1]) mk(CYL(0.003,0.003,0.07,3), M(0x1a1a1a), s*0.045,0.02-i*0.03,0,bt).rotation.z=s*(1.1+i*0.25);
    const gl=new THREE.Group(); gl.position.set(0.2,1.0,0.0); g.add(gl); mk(CYL(0.06,0.08,0.03,16), B, 0,0.015,0,gl); mk(CYL(0.008,0.008,0.12,6), B, 0,0.08,0,gl); const gb=mk(G.sph(0.11,22,16), ceramic(0x4a8ad8), 0,0.2,0,gl);
    for (let i=0;i<5;i++) quiet(mk(G.sph(0.04+i%2*0.015,10,8), ceramic(0x6aae5a), Math.cos(i*1.4)*0.09,0.2+Math.sin(i*2)*0.06,Math.sin(i*1.4)*0.09,gl)).scale.set(1,0.6,0.4);
    mk(G.tor(0.125,0.006,4,24,Math.PI), B, 0,0.2,0,gl).rotation.z=Math.PI/2;
    const sk=new THREE.Group(); sk.position.set(0.18,1.47,0.0); g.add(sk); mk(G.sph(0.08,16,12), ceramic(0xf2ead8), 0,0.06,0,sk).scale.set(1,0.85,1.3); mk(G.box(0.1,0.04,0.12), ceramic(0xf2ead8), 0,0.02,0.08,sk);
    for (const s of [-1,1]) quiet(mk(G.sph(0.022,8,6), M(0x2a2018), s*0.035,0.07,0.08,sk)); for (let i=0;i<4;i++) mk(G.cone(0.008,0.025,5), ceramic(0xfaf4ea), -0.03+i*0.02,0.0,0.14,sk).rotation.x=Math.PI;
    const jar=new THREE.Group(); jar.position.set(-0.2,1.45,0.02); g.add(jar); mk(CYL(0.07,0.07,0.18,20), glassMat(0xd8f0e0,0.35), 0,0.09,0,jar); mk(CYL(0.072,0.072,0.03,20), B, 0,0.195,0,jar); quiet(mk(CYL(0.065,0.065,0.12,20), waterMat2(0xc8e898), 0,0.065,0,jar));
    const sea=mk(G.sph(0.03,10,8), ceramic(0xe8a060), 0,0.09,0,jar); sea.scale.set(0.7,1.5,0.7); anim(g,(t)=>{ sea.position.y=0.09+Math.sin(t*1.2)*0.015; gb.rotation.y=t*0.3; }); },
  /* ---------- Wendell ---------- */
  cauldron(g){ const I=iron(), bark=woodMat(0x6a4a3a);
    for (let i=0;i<4;i++){ const a=i/4*TAU+0.4; const l=mk(CYL(0.05,0.06,0.6,10), bark, Math.cos(a)*0.12,0.06,Math.sin(a)*0.12,g); l.rotation.set(Math.sin(a)*1.2,0,-Math.cos(a)*1.2); }
    for (let i=0;i<8;i++){ const a=i/8*TAU; mk(G.dod(0.07), shellMat(0x8a8a90,{roughness:0.9}), Math.cos(a)*0.48,0.04,Math.sin(a)*0.48,g).scale.y=0.7; }
    const fl=[]; for (let i=0;i<5;i++){ const a=i/5*TAU; const f=quiet(mk(G.cone(0.06,0.22,8), emis(i%2?0xff8a30:0xffc040,1.5), Math.cos(a)*0.08,0.14,Math.sin(a)*0.08,g)); fl.push(f); }
    for (let i=0;i<3;i++){ const a=i/3*TAU; mk(CYL(0.035,0.025,0.32,8), I, Math.cos(a)*0.32,0.16,Math.sin(a)*0.32,g); }
    mk(lathe([[0,0.24],[0.2,0.25],[0.36,0.34],[0.44,0.48],[0.44,0.62],[0.38,0.74],[0.36,0.78],[0.4,0.8],[0.4,0.83],[0.33,0.83]],40), I, 0,0,0,g);
    for (const s of [-1,1]){ const h=mk(G.tor(0.07,0.018,6,16), I, s*0.44,0.72,0,g); h.rotation.y=Math.PI/2; }
    const liq=mk(CYL(0.35,0.35,0.02,36), emis(0x6ae84a,0.9,{ roughness:0.15 }), 0,0.79,0,g); liq.castShadow=false; addGlow(g, 0.95, 2.4, 0x8aff7a);
    const lad=new THREE.Group(); lad.position.set(0.15,0.8,-0.1); lad.rotation.set(-0.3,0,-0.5); g.add(lad); mk(CYL(0.015,0.015,0.6,8), woodMat(0xa8754a), 0,0.25,0,lad); mk(G.sph(0.06,12,8,0,TAU,Math.PI/2,Math.PI/2), I, 0,-0.05,0,lad);
    const bub=[]; for (let i=0;i<8;i++){ const b=quiet(mk(G.sph(0.04,12,10), new THREE.MeshStandardMaterial({ color:0xa8ff8a, emissive:0x6ae84a, emissiveIntensity:0.8, transparent:true, opacity:0.85, roughness:0.1 }), 0,0.8,0,g)); bub.push({ b, a:Math.random()*TAU, r:Math.random()*0.26, off:i/8 }); }
    rising(g, 5, V3(0,0.86,0), { mat:wisp(0.22,0xd8ffd0), r:0.06, h:0.7, spread:0.12, speed:0.22, grow:2 });
    anim(g,(t)=>{ for (const q of bub){ const k=(t*0.5+q.off)%1; q.b.position.set(Math.cos(q.a+q.off*7)*q.r, 0.8, Math.sin(q.a+q.off*7)*q.r); const s=k<0.85?k/0.85:1+(k-0.85)*6; q.b.scale.setScalar(Math.max(0.01,s*0.9)); q.b.material.opacity=k<0.85?0.85:Math.max(0,0.85-(k-0.85)*6); }
      fl.forEach((f,i)=>{ const k=1+Math.sin(t*11+i*2)*0.18; f.scale.set(1,k,1); }); liq.material.emissiveIntensity=0.8+Math.sin(t*2)*0.15; }); },
});

/* ---------- wardrobe icons ---------- */
ITEM_BUILDERS.wear = (g, d) => {
  if (d.w==='outfit'){ const c=CH.buildCritter({ sp:'bear', c:0, top:d.i, tc:({5:14,6:2,7:11,8:0,9:10,10:14,11:9,12:5,13:7,14:13})[d.i]??5, e:0, n:0, m:0, f:0 }); c.rotation.y=-0.35; g.add(c); return; }
  if (d.w==='color'){ const col=CH.OUTFIT_COLORS[d.i]; const bolt=new THREE.Group(); bolt.rotation.set(0,0.5,0); g.add(bolt);
    mk(CYL(0.32,0.32,0.9,32), fabricMat(col,'plain'), 0,0.32,0,bolt).rotation.z=Math.PI/2; mk(CYL(0.08,0.08,0.96,12), woodMat(0xc99a6a), 0,0.32,0,bolt).rotation.z=Math.PI/2;
    const fl=mk(G.box(0.9,0.02,0.5), fabricMat(col,'plain'), 0,0.01,0.3,bolt); fl.rotation.x=0.05; mk(G.tor(0.33,0.02,8,30), M(0xf2ead8), 0.2,0.32,0,bolt).rotation.y=Math.PI/2; return; }
  g.add(WR.accessoryModel(d.i)); };
