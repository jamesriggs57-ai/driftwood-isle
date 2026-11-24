// Decor v1.1: richer furniture with real materials and small living details.
// Every builder may push callbacks into g.userData.anims; Furniture and Decor call them each frame with (t, dt).
// After all builders are defined, polish() upgrades any plain material left in the older builders.
import * as THREE from 'three';
import { M, mk, G, glowMat, addGlow, FURN_BUILDERS, buildItemModel } from './models.js';
import './models2.js';
import './models3.js';
import { woodMat, fabricMat, glassMat, brass, ceramic, waterMat2, knit, felt, wingTex, shellMat } from './look.js';
import { ITEMS } from './content.js';

const TAU=Math.PI*2;
const CYL=(...a)=>new THREE.CylinderGeometry(...a);
const lathe=(pts,seg=28)=>new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),seg);
const WOODS=new Set([0xa8754a,0x8b5e3a,0xc99a6a,0x6a4a3a,0xc8b8a0,0xb0a088,0x7a5232,0x4a3a30,0x3a2e26,0xe8c99a]);
const anim = (g, fn) => { (g.userData.anims ||= []).push(fn); };
const unshadow = m => { m.castShadow=false; return m; };
const iron = () => shellMat(0x3a3836,{ metalness:0.6, roughness:0.45, clearcoat:0.3 });

// A miniature of a real catch, for tanks, frames and lamps
function mini(id, s){ const o=buildItemModel(id); o.scale.setScalar(s); o.traverse(c=>{ if (c.isMesh) c.castShadow=false; }); return o; }
function flap(o, t, sp=18, amp=0.7){ for (const w of o.userData.wings||[]) w.rotation.z = w.userData.side*(0.2+Math.sin(t*sp)*amp); }

function tank(g, W, H, D, baseH, fishIds){
  mk(G.box(W+0.1,baseH,D+0.1), woodMat(0x6a4a3a), 0,baseH/2,0,g);
  mk(G.box(W+0.14,0.05,D+0.14), brass(), 0,baseH+0.02,0,g);
  const y0=baseH+0.05;
  mk(G.box(W,0.08,D), ceramic(0xf3dca6), 0,y0+0.04,0,g);
  for (let i=0;i<Math.round(W*9);i++) mk(G.sph(0.03+((i*7)%5)*0.008,6,5), ceramic([0xe8e0d0,0xc8b8a0,0x9ab8c8,0xf0c8c0][i%4]), -W/2+0.06+((i*0.37)%1)*(W-0.12), y0+0.09, -D/2+0.05+((i*0.61)%1)*(D-0.1), g);
  const weeds=[]; for (let i=0;i<Math.round(W*5);i++){ const p=new THREE.Group(); p.position.set(-W/2+0.1+((i*0.43)%1)*(W-0.2), y0+0.08, -D/2+0.08+((i*0.29)%1)*(D*0.5)); g.add(p);
    for (let k=0;k<4;k++){ const b=mk(G.cap(0.018,0.1,4,6), shellMat(i%2?0x4fa85a:0x6ac06a,{roughness:0.5}), 0, 0.07+k*0.11, 0, p); b.castShadow=false; b.rotation.z=(k%2?0.15:-0.15); } weeds.push(p); }
  const water=mk(G.box(W-0.02,H*0.88,D-0.02), waterMat2(0x6ad0e8), 0,y0+H*0.44,0,g); water.castShadow=false; water.material.opacity=0.28;
  const gl=mk(G.box(W,H,D), glassMat(0xe8f8ff,0.14), 0,y0+H/2,0,g); gl.castShadow=false;
  mk(G.box(W+0.04,0.04,D+0.04), woodMat(0x6a4a3a), 0,y0+H,0,g);
  const fish=fishIds.map((id,i)=>{ const o=mini(id, 0.32); o.position.set(0,y0+H*(0.3+0.45*((i*0.37)%1)),0); g.add(o); return { o, ph:i*1.7, r:W*0.32, rz:D*0.22, sp:0.35+((i*0.53)%1)*0.4, y:o.position.y }; });
  const bubbles=[]; for (let i=0;i<8;i++){ const b=unshadow(mk(G.sph(0.016+i%3*0.006,6,5), glassMat(0xffffff,0.55), W*0.38, y0, -D*0.25, g)); bubbles.push({ b, off:i/8 }); }
  anim(g,(t)=>{
    for (const f of fish){ const a=t*f.sp+f.ph; f.o.position.x=Math.cos(a)*f.r; f.o.position.z=Math.sin(a)*f.rz; f.o.position.y=f.y+Math.sin(a*2.3)*0.04; f.o.rotation.y=-a-Math.PI/2*(f.sp>0?1:-1); const tl=f.o.userData.tail; if (tl) tl.rotation.y=Math.sin(t*9+f.ph)*0.4; }
    for (const w of weeds) w.rotation.z=Math.sin(t*1.3+w.position.x*4)*0.12;
    for (const q of bubbles){ const k=(t*0.35+q.off)%1; q.b.position.y=y0+0.1+k*H*0.82; q.b.position.x=W*0.38+Math.sin(k*20)*0.02; q.b.visible=k<0.97; }
  });
}

Object.assign(FURN_BUILDERS, {
  table(g){ mk(G.cyl(0.76,0.76,0.07,32), woodMat(0xc99a6a), 0,0.74,0,g); const cloth=mk(CYL(0.8,0.86,0.16,32,1,true), fabricMat(0xf8f0e4,'check',0xe86a5a), 0,0.68,0,g); cloth.material.side=THREE.DoubleSide;
    mk(G.cyl(0.8,0.8,0.01,32), fabricMat(0xf8f0e4,'check',0xe86a5a), 0,0.785,0,g);
    mk(G.cyl(0.06,0.09,0.7,12), woodMat(0x8b5e3a), 0,0.36,0,g); mk(G.cyl(0.32,0.38,0.05,20), woodMat(0x8b5e3a), 0,0.03,0,g);
    const vase=mk(lathe([[0,0],[0.07,0],[0.1,0.06],[0.07,0.16],[0.04,0.22],[0.05,0.25]]), glassMat(0xa8e8d8,0.5), 0.15,0.79,0.1,g);
    const st=new THREE.Group(); st.position.set(0.15,0.98,0.1); g.add(st); mk(G.cyl(0.008,0.008,0.24,4), M(0x4f9a3a), 0,0.02,0,st);
    const bloom=new THREE.Group(); bloom.position.y=0.15; st.add(bloom); for (let i=0;i<6;i++){ const a=i/6*TAU; const p=mk(G.sph(0.045,10,8), ceramic(0xff9ab0), Math.cos(a)*0.045,0,Math.sin(a)*0.045,bloom); p.scale.set(1,0.4,1); } mk(G.sph(0.03,8,6), ceramic(0xf8d040), 0,0.012,0,bloom);
    anim(g,t=>{ st.rotation.z=Math.sin(t*1.1)*0.08; st.rotation.x=Math.sin(t*0.8+1)*0.05; }); },
  lantern(g){ const ir=iron(); mk(G.cyl(0.05,0.07,1.4,10), ir, 0,0.7,0,g); mk(G.cyl(0.22,0.28,0.08,14), ir, 0,0.04,0,g);
    for (const [x,z] of [[1,1],[1,-1],[-1,1],[-1,-1]]) mk(G.box(0.03,0.42,0.03), ir, x*0.17,1.6,z*0.17,g);
    mk(G.box(0.32,0.38,0.32), glassMat(0xfff4d8,0.25), 0,1.6,0,g); const core=mk(G.sph(0.09,12,10), glowMat(0xffc860), 0,1.58,0,g);
    mk(G.cone(0.3,0.24,4), ir, 0,1.91,0,g).rotation.y=Math.PI/4; mk(G.tor(0.05,0.012,6,12), ir, 0,2.06,0,g); addGlow(g,1.6,2.8);
    anim(g,t=>{ const f=1+Math.sin(t*11)*0.06+Math.sin(t*23)*0.04; core.scale.set(f,f*1.1,f); }); },
  floorlamp(g){ mk(G.cyl(0.2,0.24,0.05,20), brass(), 0,0.03,0,g); mk(G.cyl(0.022,0.022,1.5,10), brass(), 0,0.78,0,g);
    const sh=mk(CYL(0.18,0.3,0.36,24,1,true), fabricMat(0xfff0d0,'rings',0xf0c890), 0,1.6,0,g); sh.material.side=THREE.DoubleSide; sh.material.emissive=new THREE.Color(0xffd890); sh.material.emissiveIntensity=0.25;
    const bulb=mk(G.sph(0.07,12,10), glowMat(0xfff0c8), 0,1.55,0,g); const pull=new THREE.Group(); pull.position.set(0.1,1.44,0); g.add(pull); mk(G.cyl(0.003,0.003,0.2,3), brass(), 0,-0.1,0,pull); mk(G.sph(0.02,8,6), brass(), 0,-0.21,0,pull); addGlow(g,1.5,2.8);
    anim(g,t=>{ pull.rotation.z=Math.sin(t*1.7)*0.12; }); },
  windchime(g){ mk(G.cyl(0.04,0.05,1.9,10), woodMat(0x8b5e3a), 0,0.95,0,g); mk(G.box(0.7,0.05,0.05), woodMat(0x8b5e3a), 0.3,1.86,0,g);
    const ring=new THREE.Group(); ring.position.set(0.42,1.82,0); g.add(ring); mk(G.tor(0.16,0.012,6,24), brass(), 0,-0.04,0,ring).rotation.x=Math.PI/2;
    const cols=[0xbfe6f0,0xf5c9e0,0xf3e2c4,0xc8e8c0,0xd8d0f8], tubes=[];
    for (let i=0;i<5;i++){ const a=i/5*TAU, p=new THREE.Group(); p.position.set(Math.cos(a)*0.14,-0.04,Math.sin(a)*0.14); ring.add(p); mk(G.cyl(0.003,0.003,0.14,3), M(0xdddddd), 0,-0.07,0,p);
      const len=0.26+i*0.05; mk(G.cyl(0.025,0.025,len,12), glassMat(cols[i],0.6), 0,-0.14-len/2,0,p); tubes.push(p); }
    const cl=new THREE.Group(); ring.add(cl); mk(G.cyl(0.003,0.003,0.4,3), M(0xdddddd), 0,-0.2,0,cl); const sail=mk(G.box(0.12,0.16,0.01), woodMat(0xc99a6a), 0,-0.48,0,cl);
    anim(g,t=>{ const w=Math.sin(t*0.9)*0.5+Math.sin(t*2.3)*0.3; tubes.forEach((p,i)=>{ p.rotation.x=Math.sin(t*2.1+i*1.3)*0.12*w; p.rotation.z=Math.cos(t*1.7+i)*0.1*w; }); cl.rotation.z=Math.sin(t*1.4)*0.2; cl.rotation.x=Math.cos(t*1.1)*0.15; ring.rotation.y=t*0.15; }); },
  rug(g){ const m=mk(G.cyl(1.1,1.1,0.03,48), fabricMat(0xd8805a,'rings',0xf0c890), 0,0.015,0,g); m.castShadow=false;
    for (let i=0;i<36;i++){ const a=i/36*TAU; const f=mk(G.cyl(0.008,0.008,0.1,3), knit(0xf0c890), Math.cos(a)*1.14,0.012,Math.sin(a)*1.14,g); f.rotation.set(Math.PI/2,0,-a+Math.PI/2); f.rotation.order='YXZ'; f.castShadow=false; } },
  bed(g){ const W=woodMat(0x8b5e3a); mk(G.box(1.3,0.3,2.0), W, 0,0.2,0,g); mk(G.box(1.25,0.2,1.9), fabricMat(0xfffaf2), 0,0.44,0,g);
    const q=mk(G.box(1.32,0.16,1.25), fabricMat(0x7ab0d8,'quilt',0xf8e8c8), 0,0.5,0.36,g); mk(G.box(1.34,0.06,0.16), fabricMat(0xfffaf2), 0,0.58,-0.22,g);
    const pil=mk(G.sph(0.3,18,12), fabricMat(0xfff8f0,'check',0xf0c8d0), 0,0.64,-0.68,g); pil.scale.set(1.4,0.42,0.6);
    const hb=mk(CYL(0.66,0.66,0.12,32,1,false,0,Math.PI), W, 0,0.58,-0.98,g); hb.rotation.x=Math.PI/2; hb.rotation.z=Math.PI/2; hb.scale.set(1,1,1); mk(G.box(1.35,0.56,0.12), W, 0,0.3,-0.98,g);
    for (const x of [-0.6,0.6]) mk(G.sph(0.07,12,10), brass(), x,0.62,-0.98,g);
    anim(g,t=>{ const s=1+Math.sin(t*1.2)*0.015; pil.scale.set(1.4*s,0.42/s,0.6); }); },
  armchair(g){ const F=fabricMat(0xc86a5a,'plain'), F2=fabricMat(0xb85a4a,'plain'); const seat=mk(G.box(0.9,0.36,0.8), F, 0,0.3,0,g);
    const back=mk(G.sph(0.5,22,16,0,TAU,0,Math.PI/2), F, 0,0.52,-0.3,g); back.scale.set(0.95,1.15,0.38);
    for (const s of [-1,1]){ const a=mk(G.cap(0.15,0.65,8,12), F2, s*0.46,0.55,0.02,g); a.rotation.x=Math.PI/2; }
    const cu=mk(G.sph(0.4,20,12), fabricMat(0xf0d8c0,'quilt',0xe8c8a8), 0,0.52,0.06,g); cu.scale.set(0.95,0.22,0.9);
    for (let i=0;i<3;i++) for (let j=0;j<2;j++) mk(G.sph(0.02,8,6), brass(), -0.2+i*0.2, 0.76+j*0.16, -0.12+j*0.0, g);
    for (const x of [-0.38,0.38]) for (const z of [-0.32,0.32]) mk(G.cyl(0.035,0.025,0.14,8), woodMat(0x6a4a3a), x,0.07,z,g);
    const thr=mk(G.box(0.4,0.02,0.5), knit(0xf0c040,0xffffff,8), 0.3,0.7,-0.05,g); thr.rotation.set(0.3,0.4,-0.6); },
  bookshelf(g){ const CW=woodMat(0x8b5e3a); for (const x of [-0.62,0.62]) mk(G.box(0.06,1.8,0.45), CW, x,0.9,0,g); mk(G.box(1.3,0.06,0.45), CW, 0,1.77,0,g); mk(G.box(1.3,0.1,0.45), CW, 0,0.05,0,g); mk(G.box(1.2,1.7,0.03), woodMat(0x6a4a3a), 0,0.9,-0.2,g);
    const bc=[0xb83a3a,0x2a4a8a,0xd8a030,0x3a7a4a,0x6a3a7a,0xd86a3a,0x1a3a5a,0x8a2a3a];
    for (let s=0;s<3;s++){ mk(G.box(1.22,0.04,0.42), woodMat(0xc99a6a), 0,0.33+s*0.55,0.02,g); let x=-0.56;
      for (let i=0;x<0.5;i++){ const h=0.3+((i*7+s*3)%5)*0.03, w=0.08+((i*5+s)%3)*0.025, c=bc[(i+s*3)%8]; const b=mk(G.box(w,h,0.3), shellMat(c,{roughness:0.55,clearcoat:0.4}), x+w/2, 0.35+s*0.55+h/2, 0.05, g);
        if ((i+s)%4===3){ b.rotation.z=-0.18; b.position.x+=0.03; } mk(G.box(w+0.003,0.02,0.302), brass(), x+w/2, 0.35+s*0.55+h*0.8, 0.05, g).rotation.z=b.rotation.z; x+=w+0.012; } }
    const orb=mk(G.sph(0.08,16,12), glassMat(0xb8e0ff,0.5), 0.45,1.97,0,g); mk(G.cyl(0.06,0.07,0.03,12), brass(), 0.45,1.9,0,g); },
  globe(g){ mk(G.cyl(0.25,0.3,0.06,20), woodMat(0x6a4a3a), 0,0.03,0,g); mk(G.cyl(0.03,0.03,0.52,8), woodMat(0x6a4a3a), 0,0.3,0,g);
    const tex=globeTex(); const pivot=new THREE.Group(); pivot.position.set(0,0.85,0); pivot.rotation.z=0.41; g.add(pivot);
    const gl=mk(G.sph(0.3,40,28), new THREE.MeshPhysicalMaterial({ map:tex, roughness:0.35, clearcoat:0.8 }), 0,0,0,pivot);
    const r=mk(G.tor(0.34,0.015,8,40,Math.PI*1.2), brass(), 0,0,0,pivot); r.rotation.z=-Math.PI*0.1; mk(G.cyl(0.006,0.006,0.72,6), brass(), 0,0,0,pivot);
    anim(g,(t,dt)=>{ gl.rotation.y+=dt*0.35; }); },
  grandfather(g){ const W=woodMat(0x6a4a3a); mk(G.box(0.62,0.5,0.42), W, 0,0.25,0,g); mk(G.box(0.5,1.2,0.36), W, 0,1.1,0,g); mk(G.box(0.62,0.62,0.42), W, 0,1.98,0,g);
    const cap=mk(CYL(0.33,0.33,0.42,24,1,false,0,Math.PI), W, 0,2.29,0,g); cap.rotation.x=Math.PI/2; cap.rotation.z=Math.PI/2; cap.scale.set(0.5,1,1);
    const face=mk(G.cyl(0.22,0.22,0.02,32), ceramic(0xfff8ea), 0,1.98,0.215,g); face.rotation.x=Math.PI/2; const bez=mk(G.tor(0.23,0.02,8,32), brass(), 0,1.98,0.22,g);
    for (let i=0;i<12;i++){ const a=i/12*TAU; mk(G.box(0.012,0.035,0.01), M(0x2a2420), Math.sin(a)*0.18,1.98+Math.cos(a)*0.18,0.23,g).rotation.z=-a; }
    const hh=new THREE.Group(); hh.position.set(0,1.98,0.235); g.add(hh); mk(G.box(0.016,0.11,0.008), M(0x1a1410), 0,0.05,0,hh); const mh=new THREE.Group(); mh.position.copy(hh.position); mh.position.z+=0.006; g.add(mh); mk(G.box(0.012,0.16,0.008), M(0x1a1410), 0,0.075,0,mh);
    mk(G.box(0.36,0.92,0.02), glassMat(0xe8f4ff,0.22), 0,1.1,0.19,g);
    const pend=new THREE.Group(); pend.position.set(0,1.6,0.1); g.add(pend); mk(G.cyl(0.008,0.008,0.62,4), brass(), 0,-0.31,0,pend); const bob=mk(G.cyl(0.08,0.08,0.02,24), brass(), 0,-0.64,0,pend); bob.rotation.x=Math.PI/2;
    for (const x of [-0.08,0.08]){ mk(G.cyl(0.005,0.005,0.4,3), brass(), x,1.38,0.06,g); mk(G.cyl(0.035,0.035,0.16,12), brass(), x,1.1,0.06,g); }
    anim(g,t=>{ pend.rotation.z=Math.sin(t*Math.PI)*0.22; const d=new Date(); mh.rotation.z=-(d.getMinutes()+d.getSeconds()/60)/60*TAU; hh.rotation.z=-((d.getHours()%12)+d.getMinutes()/60)/12*TAU; }); },
  fishtank(g){ tank(g, 1.0, 0.6, 0.48, 0.62, ['goldfish','killifish','coraldart']); },
  bigtank(g){ tank(g, 2.1, 1.05, 0.8, 0.7, ['koi','mooncarp','bluegill','coraldart','goldfish','seahorse','lanternfish']); },
  terrarium(g){ mk(G.box(0.8,0.5,0.5), woodMat(0xa8754a), 0,0.25,0,g); mk(G.box(0.76,0.06,0.46), felt(0x5a8a3a), 0,0.53,0,g);
    for (let i=0;i<9;i++) mk(G.sph(0.06+(i%3)*0.02,10,8), felt([0x6ab84a,0x4f9a3a,0x8ac860][i%3]), -0.3+((i*0.37)%1)*0.6, 0.57, -0.17+((i*0.53)%1)*0.34, g).scale.y=0.55;
    const mush=[]; for (let i=0;i<3;i++){ const p=new THREE.Group(); p.position.set(-0.15+i*0.15,0.56,0.05-i*0.05); g.add(p); mk(G.cyl(0.012,0.016,0.08,8), ceramic(0xfff4e0), 0,0.04,0,p); const c=mk(G.sph(0.045,14,10,0,TAU,0,Math.PI/2), ceramic([0xe2483d,0xf0a030,0xc070e0][i]), 0,0.08,0,p); for (let k=0;k<4;k++) mk(G.sph(0.008,6,5), ceramic(0xffffff), Math.cos(k*1.6)*0.025,0.11,Math.sin(k*1.6)*0.025,p); mush.push(p); }
    mk(G.box(0.76,0.46,0.46), glassMat(0xe0fff0,0.16), 0,0.79,0,g).castShadow=false; mk(G.box(0.8,0.03,0.5), brass(), 0,1.03,0,g);
    const fly=unshadow(mk(G.sph(0.018,8,6), M(0xe8ff90,{emissive:0xd8ff60,emissiveIntensity:2}), 0,0.8,0,g)); const fg=addGlow(g,0.8,0.5,0xe8ff90);
    anim(g,t=>{ fly.position.set(Math.sin(t*0.7)*0.25, 0.75+Math.sin(t*1.3)*0.1, Math.cos(t*0.9)*0.13); fly.material.emissiveIntensity=1.2+Math.sin(t*3)*0.9; mush.forEach((p,i)=>{ const s=1+Math.sin(t*2+i)*0.03; p.scale.set(s,1/s,s); }); }); },
  mothlamp(g){ const ir=iron(); mk(G.cyl(0.035,0.045,1.5,10), ir, 0,0.75,0,g); mk(G.cyl(0.2,0.24,0.06,16), ir, 0,0.03,0,g);
    const bulb=mk(G.sph(0.2,24,18), glassMat(0xf4ffd8,0.5), 0,1.65,0,g); mk(G.sph(0.11,14,10), glowMat(0xe8ffb0), 0,1.65,0,g); mk(G.cyl(0.08,0.1,0.08,12), brass(), 0,1.46,0,g); addGlow(g,1.65,2.6,0xe8ffb0);
    const moths=['moth','lunamoth','starmoth'].map((id,i)=>{ const o=mini(id, 0.55); g.add(o); return { o, ph:i*2.1, r:0.36+i*0.06, sp:1.2+i*0.35 }; });
    anim(g,t=>{ for (const m of moths){ const a=t*m.sp+m.ph; m.o.position.set(Math.cos(a)*m.r, 1.55+Math.sin(a*1.7)*0.12, Math.sin(a)*m.r); m.o.rotation.y=-a; flap(m.o,t,16,0.6); } }); },
  skep(g){ mk(G.cyl(0.36,0.36,0.08,20), woodMat(0x8b5e3a), 0,0.5,0,g); mk(G.cyl(0.05,0.06,0.5,8), woodMat(0x8b5e3a), 0,0.25,0,g);
    const straw=knit(0xd8b060,null,4); for (let i=0;i<6;i++){ const t=mk(G.tor(0.31-i*0.05,0.055,10,28), straw, 0,0.6+i*0.09,0,g); t.rotation.x=Math.PI/2; }
    mk(G.sph(0.08,12,10), straw, 0,1.12,0,g); mk(G.box(0.09,0.06,0.03), M(0x2a1a10), 0,0.62,0.3,g);
    const bees=[0,1,2].map(i=>{ const o=mini(i===2?'bumblebee':'bee', 0.42); g.add(o); return { o, ph:i*2.2, sp:1.6+i*0.4 }; });
    anim(g,t=>{ for (const b of bees){ const a=t*b.sp+b.ph; b.o.position.set(Math.sin(a)*0.5+Math.sin(a*3.1)*0.06, 0.95+Math.sin(a*2.2)*0.18, Math.cos(a*0.8)*0.45); b.o.rotation.y=-a; flap(b.o,t,40,0.5); } }); },
  butterflyframe(g){ mk(G.box(0.08,1.2,0.08), woodMat(0x8b5e3a), 0,0.6,-0.05,g); mk(G.box(1.0,0.78,0.08), woodMat(0x3a2e26), 0,1.22,0,g); mk(G.box(0.88,0.66,0.02), fabricMat(0xf4ecd8,'plain'), 0,1.22,0.045,g);
    const ids=['peacock','swallowtail','lunamoth','ember','bluebell','rainwing'], kids=[];
    ids.forEach((id,i)=>{ const o=mini(id, 0.42); o.rotation.x=Math.PI/2; o.position.set(-0.28+(i%3)*0.28, 1.36-Math.floor(i/3)*0.28, 0.06-0.13*0.42); o.rotation.order='XYZ'; o.rotation.y=Math.PI; g.add(o); kids.push(o);
      const lab=mk(G.box(0.08,0.02,0.005), ceramic(0xfffaf0), o.position.x, o.position.y-0.11, 0.058, g); });
    mk(G.box(0.9,0.68,0.01), glassMat(0xffffff,0.12), 0,1.22,0.11,g).castShadow=false;
    anim(g,t=>{ kids.forEach((o,i)=>{ for (const w of o.userData.wings||[]) w.rotation.z=w.userData.side*(0.12+Math.max(0,Math.sin(t*0.7+i*1.9))*0.05); }); }); },
  corallamp(g){ mk(G.cyl(0.2,0.26,0.2,20), ceramic(0xf4efe4), 0,0.1,0,g); const tips=[];
    const cm=new THREE.MeshPhysicalMaterial({ color:0xf27a9a, emissive:0xf27a9a, emissiveIntensity:0.4, roughness:0.3, transmission:0, transparent:true, opacity:0.9, clearcoat:1 });
    const branch=(p, x,y,z, rx,rz, len, d)=>{ const gp=new THREE.Group(); gp.position.set(x,y,z); gp.rotation.set(rx,0,rz); p.add(gp); mk(G.cap(0.035*(1-d*0.2),len,6,8), cm, 0,len/2,0,gp).castShadow=false;
      if (d<2) for (const s of [-1,1]) branch(gp, 0,len,0, s*0.4*(d%2), s*0.55*((d+1)%2)+0.1, len*0.7, d+1); else { const tp=mk(G.sph(0.05,10,8), glowMat(0xffc8d8), 0,len,0,gp); tips.push(tp); } };
    for (let i=0;i<3;i++) branch(g, Math.cos(i*2.1)*0.06,0.2,Math.sin(i*2.1)*0.06, Math.sin(i*2.1)*0.3,-Math.cos(i*2.1)*0.3, 0.3, 0);
    addGlow(g,0.6,2.2,0xff9ab0); anim(g,t=>{ cm.emissiveIntensity=0.35+Math.sin(t*1.2)*0.2; tips.forEach((p,i)=>p.scale.setScalar(1+Math.sin(t*2+i)*0.15)); }); },
  fountain(g){ const st=ceramic(0xd8d4c8); mk(G.cyl(1.0,1.08,0.4,40), st, 0,0.2,0,g); mk(G.tor(1.0,0.06,10,48), st, 0,0.4,0,g).rotation.x=Math.PI/2;
    const pool=mk(G.cyl(0.95,0.95,0.04,40), waterMat2(0x6ad0e8), 0,0.36,0,g); pool.castShadow=false; mk(G.cyl(0.12,0.18,1.0,16), st, 0,0.8,0,g);
    mk(G.cyl(0.46,0.2,0.22,28), st, 0,1.3,0,g); const top=mk(G.cyl(0.4,0.4,0.03,28), waterMat2(0x7ad8f0), 0,1.4,0,g); top.castShadow=false; mk(G.sph(0.09,14,10), st, 0,1.5,0,g);
    const rip=[0,1,2].map(i=>{ const r=unshadow(mk(G.tor(0.3,0.008,6,40), glassMat(0xffffff,0.6), 0,0.385,0,g)); r.rotation.x=Math.PI/2; return r; });
    const drops=[]; for (let i=0;i<16;i++){ const a=i/16*TAU; drops.push({ m:unshadow(mk(G.sph(0.025,6,5), waterMat2(0xbfefff), 0,1.4,0,g)), a, off:(i*0.37)%1 }); }
    const sp=unshadow(mk(G.cyl(0.02,0.05,0.25,8), waterMat2(0xd8f8ff), 0,1.62,0,g));
    anim(g,t=>{ rip.forEach((r,i)=>{ const k=(t*0.4+i/3)%1; const s=0.5+k*2.6; r.scale.set(s,s,1); r.material.opacity=0.55*(1-k); });
      for (const d of drops){ const k=(t*0.9+d.off)%1, R=0.4+k*0.45; d.m.position.set(Math.cos(d.a)*R, 1.42-k*k*1.05+k*0.12, Math.sin(d.a)*R); }
      sp.scale.y=1+Math.sin(t*9)*0.15; }); },
  birdbath(g){ const st=ceramic(0xc8c8c0); mk(G.cyl(0.3,0.35,0.12,20), st, 0,0.06,0,g); mk(lathe([[0.16,0],[0.1,0.2],[0.08,0.5],[0.12,0.78],[0.2,0.82]]), st, 0,0.1,0,g);
    mk(G.cyl(0.5,0.25,0.18,28), st, 0,0.95,0,g); mk(G.tor(0.5,0.035,8,36), st, 0,1.04,0,g).rotation.x=Math.PI/2; const w=mk(G.cyl(0.44,0.44,0.02,28), waterMat2(0x7fd0e0), 0,1.03,0,g); w.castShadow=false;
    const rip=unshadow(mk(G.tor(0.1,0.006,6,30), glassMat(0xffffff,0.6), 0,1.045,0,g)); rip.rotation.x=Math.PI/2;
    const bird=new THREE.Group(); bird.position.set(0.42,1.07,0); g.add(bird); const bm=felt(0x8ab0d8); mk(G.sph(0.07,12,10), bm, 0,0.06,0,bird).scale.set(1.3,1,1); mk(G.sph(0.05,12,10), bm, 0.06,0.12,0,bird); mk(G.cone(0.015,0.04,6), ceramic(0xf0a030), 0.11,0.12,0,bird).rotation.z=-Math.PI/2; mk(G.sph(0.06,10,8), felt(0xfff4e8), 0.02,0.04,0,bird).scale.set(1,0.7,0.8);
    anim(g,t=>{ const k=(t*0.5)%1; rip.scale.set(1+k*3.5,1+k*3.5,1); rip.material.opacity=0.6*(1-k); const hop=Math.max(0,Math.sin(t*1.5))**8; bird.position.y=1.07+hop*0.05; bird.rotation.z=Math.sin(t*0.7)*0.2-hop*0.3; bird.rotation.y=Math.PI+Math.sin(t*0.3)*0.6; }); },
  shipwheel(g){ mk(G.box(0.14,1.0,0.14), woodMat(0x8b5e3a), 0,0.5,-0.1,g); const w=new THREE.Group(); w.position.set(0,1.05,0); g.add(w); const W=woodMat(0xa8754a);
    mk(G.tor(0.4,0.04,10,36), W, 0,0,0,w); mk(G.tor(0.4,0.012,6,36), brass(), 0,0,0.04,w); mk(G.cyl(0.09,0.09,0.1,16), brass(), 0,0,0,w).rotation.x=Math.PI/2;
    for (let i=0;i<8;i++){ const a=i/8*TAU; const sp=mk(G.cyl(0.022,0.022,0.8,8), W, Math.cos(a)*0.4*0.5,Math.sin(a)*0.4*0.5,0,w); sp.rotation.z=a-Math.PI/2; const h=mk(G.cap(0.03,0.1,4,8), W, Math.cos(a)*0.55,Math.sin(a)*0.55,0,w); h.rotation.z=a-Math.PI/2; }
    anim(g,t=>{ w.rotation.z=Math.sin(t*0.4)*0.5; }); },
  telescope(g){ for (let i=0;i<3;i++){ const a=i/3*TAU; const l=mk(G.cyl(0.022,0.022,1.2,8), woodMat(0x8b5e3a), Math.cos(a)*0.22,0.55,Math.sin(a)*0.22,g); l.rotation.set(Math.sin(a)*0.35,0,-Math.cos(a)*0.35); }
    const head=new THREE.Group(); head.position.set(0,1.12,0); g.add(head); const tilt=new THREE.Group(); tilt.rotation.x=-1.0; head.add(tilt);
    mk(G.cyl(0.07,0.11,1.0,20), brass(), 0,0.12,0,tilt); for (const y of [-0.3,0.1,0.5]) mk(G.tor(0.1,0.012,8,24), woodMat(0x6a4a3a), 0,y,0,tilt).rotation.x=Math.PI/2;
    const lens=mk(G.cyl(0.1,0.1,0.01,20), glassMat(0x9ad0ff,0.7), 0,0.62,0,tilt); mk(G.cyl(0.025,0.035,0.12,10), brass(), 0,-0.42,0,tilt);
    anim(g,t=>{ head.rotation.y=Math.sin(t*0.12)*0.8; tilt.rotation.x=-1.0+Math.sin(t*0.17)*0.12; }); },
  plant(g){ mk(lathe([[0,0],[0.2,0],[0.26,0.36],[0.29,0.4],[0.27,0.42]]), ceramic(0xd27a4f), 0,0,0,g); mk(G.cyl(0.25,0.25,0.02,16), felt(0x5a4030), 0,0.38,0,g);
    const fr=[]; for (let i=0;i<9;i++){ const a=i/9*TAU, p=new THREE.Group(); p.position.set(0,0.38,0); p.rotation.y=a; g.add(p); const q=new THREE.Group(); q.rotation.z=-0.5-(i%3)*0.18; p.add(q);
      mk(G.cyl(0.008,0.012,0.6,4), M(0x4f8a3a), 0,0.3,0,q); for (let k=0;k<7;k++){ for (const s of [-1,1]){ const l=mk(G.sph(0.05-k*0.004,8,4), shellMat(k%2?0x5fae43:0x6cbf50,{roughness:0.55,clearcoat:0.3}), s*0.04,0.12+k*0.07,0,q); l.scale.set(1,0.25,0.5); l.rotation.z=s*0.6; } } fr.push(q); }
    anim(g,t=>fr.forEach((q,i)=>{ q.rotation.x=Math.sin(t*1.1+i)*0.05; })); },
  snowbuddy(g){ const sn=shellMat(0xffffff,{roughness:0.7,clearcoat:0.2,sheen:1,sheenColor:new THREE.Color(0xd8f0ff)}); const body=new THREE.Group(); g.add(body);
    mk(G.sph(0.42,24,18), sn, 0,0.4,0,body); const top=new THREE.Group(); top.position.y=0.98; body.add(top); mk(G.sph(0.3,24,18), sn, 0,0,0,top);
    const n=mk(G.cone(0.05,0.22,10), ceramic(0xf08a2a), 0,0,0.32,top); n.rotation.x=Math.PI/2; for (const s of [-1,1]){ mk(G.sph(0.035,8,6), ceramic(0x222222), s*0.1,0.08,0.26,top); mk(G.sph(0.05,10,8), felt(0xf8b0c0), s*0.17,-0.04,0.23,top).scale.z=0.3; }
    const sc=mk(G.tor(0.27,0.06,10,24), knit(0xe2483d,0xffffff,8), 0,-0.22,0,top); sc.rotation.x=Math.PI/2; mk(G.box(0.12,0.3,0.05), knit(0xe2483d,0xffffff,8), 0.16,-0.36,0.22,top).rotation.z=0.2;
    for (let i=0;i<3;i++) mk(G.sph(0.03,8,6), ceramic(0x2a2a2a), 0,0.32+i*0.13,0.4-Math.abs(i-1)*0.02,body);
    anim(g,t=>{ const k=Math.sin(t*2.2); body.scale.set(1+k*0.025,1-k*0.03,1+k*0.025); top.rotation.z=Math.sin(t*1.1)*0.08; }); },
  campfire(g){ for (let i=0;i<9;i++){ const a=i/9*TAU; const s=mk(G.dod(0.14), shellMat(0x8a8a88,{roughness:0.9,clearcoat:0}), Math.cos(a)*0.45,0.08,Math.sin(a)*0.45,g); s.scale.y=0.7; s.rotation.y=a; }
    for (let i=0;i<3;i++){ const l=mk(G.cyl(0.07,0.08,0.7,10), woodMat(0x8b5e3a), 0,0.14,0,g); l.rotation.set(Math.PI/2.3,i*2.1,0); }
    const f=new THREE.Group(); g.add(f); mk(G.cone(0.2,0.55,10), glowMat(0xffa030), 0,0.4,0,f).castShadow=false; mk(G.cone(0.12,0.4,10), glowMat(0xffe070), 0,0.4,0,f).castShadow=false; addGlow(g,0.6,3.2,0xffb060); g.userData.flame=f;
    const em=[]; for (let i=0;i<10;i++) em.push({ m:unshadow(mk(G.sph(0.015,5,4), M(0xffc060,{emissive:0xff9030,emissiveIntensity:3}), 0,0.4,0,g)), off:i/10, a:i*2.4 });
    anim(g,t=>{ for (const e of em){ const k=(t*0.5+e.off)%1; e.m.position.set(Math.sin(e.a+t)*0.12*k, 0.45+k*1.2, Math.cos(e.a+t*1.3)*0.12*k); e.m.scale.setScalar(1-k); } }); },
});

/* ---------- Stump woodworking: furniture made from stumps you dig up ---------- */
// Tree rings for the cut tops
let RING=null;
function ringMat(){ if (RING) return RING; const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d');
  x.fillStyle='#e6c08a'; x.fillRect(0,0,256,256); let s=11; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for (let k=26;k>0;k--){ const rr=k*4.8+r()*2; x.beginPath(); for (let i=0;i<=60;i++){ const a=i/60*TAU, w=rr*(1+Math.sin(a*3+k)*0.025+Math.sin(a*7)*0.012); x.lineTo(128+Math.cos(a)*w, 128+Math.sin(a)*w); }
    x.strokeStyle=k%3?'rgba(150,100,55,.45)':'rgba(120,75,40,.7)'; x.lineWidth=k%3?1.2:2.2; x.stroke(); }
  x.strokeStyle='rgba(110,70,40,.5)'; x.lineWidth=1.5; for (let i=0;i<3;i++){ const a=r()*TAU; x.beginPath(); x.moveTo(128,128); x.lineTo(128+Math.cos(a)*120,128+Math.sin(a)*120); x.stroke(); }   // drying cracks
  const g=x.createRadialGradient(128,128,90,128,128,128); g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(90,55,30,.55)'); x.fillStyle=g; x.fillRect(0,0,256,256);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; RING=new THREE.MeshStandardMaterial({ map:t, roughness:0.75, color:0xd8c0a0 }); return RING; }
// A bark-covered stump body with a ring top and a few root flares
function stumpBody(g, r, h, roots=4, y0=0){ const bark=woodMat(0x6a4a3a);
  mk(CYL(r, r*1.14, h, 18), bark, 0,y0+h/2,0,g); mk(CYL(r*0.97, r*0.97, 0.012, 32), ringMat(), 0,y0+h+0.002,0,g);
  for (let i=0;i<roots;i++){ const a=i/roots*TAU+0.4; const rt=mk(CYL(r*0.14, r*0.3, r*1.0, 7), bark, Math.cos(a)*r*1.05,y0+r*0.14,Math.sin(a)*r*1.05,g); rt.rotation.set(Math.sin(a)*1.25,0,-Math.cos(a)*1.25); }
  return bark; }
Object.assign(FURN_BUILDERS, {
  stumpstool(g){ stumpBody(g, 0.3, 0.46, 3); mk(G.sph(0.06,8,6), shellMat(0x7aa04a,{roughness:0.9,clearcoat:0}), 0.27,0.1,0.12,g).scale.set(1.4,0.5,1); },
  stumptable(g){ stumpBody(g, 0.32, 0.62, 4);
    const slab=mk(CYL(0.55,0.53,0.09,28), ringMat(), 0,0.67,0,g); mk(CYL(0.555,0.555,0.06,28,1,true), woodMat(0x6a4a3a), 0,0.66,0,g).material.side=THREE.DoubleSide;
    const cup=mk(lathe([[0,0],[0.05,0],[0.06,0.1],[0.065,0.11]]), ceramic(0xf0e6d4), 0.18,0.715,0.1,g); mk(G.tor(0.03,0.008,6,10), ceramic(0xf0e6d4), 0.25,0.77,0.1,g).rotation.y=0;
    const steam=[]; for (let i=0;i<3;i++) steam.push(unshadow(mk(G.sph(0.02,6,4), glassMat(0xffffff,0.35), 0.18,0.85,0.1,g)));
    anim(g,t=>steam.forEach((s,i)=>{ const k=(t*0.4+i/3)%1; s.position.set(0.18+Math.sin(t*2+i)*0.02, 0.83+k*0.3, 0.1); s.scale.setScalar(1+k*1.5); s.visible=k<0.9; })); },
  stumpplanter(g){ const bark=woodMat(0x6a4a3a); mk(lathe([[0,0.05],[0.36,0.02],[0.4,0.3],[0.38,0.56],[0.3,0.56],[0.3,0.12],[0,0.12]],24), bark, 0,0,0,g);
    mk(G.tor(0.34,0.04,8,24), ringMat(), 0,0.56,0,g).rotation.x=Math.PI/2; mk(CYL(0.3,0.3,0.02,20), felt(0x4a3424), 0,0.5,0,g);
    for (let i=0;i<4;i++){ const a=i/4*TAU+0.3; const rt=mk(CYL(0.04,0.1,0.36,7), bark, Math.cos(a)*0.4,0.05,Math.sin(a)*0.4,g); rt.rotation.set(Math.sin(a)*1.25,0,-Math.cos(a)*1.25); }
    const fl=[]; const cols=[0xf7c948,0xf08aa8,0xffffff,0xb08ad8,0xf7a04a];
    for (let i=0;i<7;i++){ const a=i*2.4, d=i?0.16:0; const st=new THREE.Group(); st.position.set(Math.cos(a)*d,0.5,Math.sin(a)*d); g.add(st); const h=0.22+((i*37)%10)*0.02;
      mk(G.cyl(0.008,0.008,h,4), M(0x4f8a3a), 0,h/2,0,st); const b=new THREE.Group(); b.position.y=h; st.add(b);
      for (let k=0;k<5;k++){ const q=k/5*TAU; const p=mk(G.sph(0.035,8,6), ceramic(cols[i%5]), Math.cos(q)*0.035,0,Math.sin(q)*0.035,b); p.scale.set(1,0.35,1); } mk(G.sph(0.022,8,6), ceramic(0xf8d040), 0,0.01,0,b);
      for (const s of [-1,1]){ const l=mk(G.sph(0.04,8,4), shellMat(0x5fae43,{roughness:0.6}), s*0.03,h*0.45,0,st); l.scale.set(1.2,0.25,0.5); l.rotation.z=s*0.5; } fl.push(st); }
    anim(g,t=>fl.forEach((s,i)=>{ s.rotation.z=Math.sin(t*1.2+i)*0.08; s.rotation.x=Math.cos(t*0.9+i*1.7)*0.06; })); },
  stumpbench(g){   // two short stumps under a split log, flat side up
    for (const x of [-0.6,0.6]){ const s=new THREE.Group(); s.position.x=x; g.add(s); stumpBody(s, 0.22, 0.34, 3); }
    const seat=mk(CYL(0.22,0.22,1.7,20,1,false,0,Math.PI), woodMat(0x6a4a3a), 0,0.56,0,g); seat.rotation.set(0,0,-Math.PI/2);   // curved side down
    mk(G.box(1.7,0.025,0.44), woodMat(0xd8b080), 0,0.565,0,g); },
  stumplamp(g){ stumpBody(g, 0.28, 0.42, 3);
    const caps=[]; for (const [x,z,s,c] of [[0,0,1,0xe86a4a],[0.16,0.1,0.6,0xf0a060],[-0.14,0.12,0.5,0xe86a4a],[0.1,-0.15,0.45,0xf6d6a0]]){ const m=new THREE.Group(); m.position.set(x,0.42,z); g.add(m);
      mk(CYL(0.035*s,0.05*s,0.28*s,10), ceramic(0xf6eedc), 0,0.14*s,0,m); const cap=mk(G.sph(0.16*s,20,12,0,TAU,0,Math.PI/2), M(c,{emissive:c,emissiveIntensity:0.5}), 0,0.27*s,0,m); cap.scale.y=0.7;
      for (let k=0;k<5;k++){ const a=k*1.3; mk(G.sph(0.022*s,6,4), M(0xfff4dc,{emissive:0xfff0c0,emissiveIntensity:0.6}), Math.cos(a)*0.1*s,0.27*s+0.06*s,Math.sin(a)*0.1*s,m); }
      mk(G.sph(0.1*s,12,8), glowMat(0xffd890), 0,0.24*s,0,m).scale.y=0.4; caps.push(m); }
    addGlow(g,0.9,2.4,0xffc080);
    anim(g,t=>caps.forEach((m,i)=>{ const k=1+Math.sin(t*1.6+i*2)*0.03; m.scale.set(k,1/k,k); })); },
});

// Party game cups (v1.14): a gold cup on a wooden plinth, topped with a tiny beach ball or a tiny crown
function cup(g, top){ const gold=shellMat(0xf0c04a,{ metalness:0.8, roughness:0.22, clearcoat:0.8 });
  mk(G.box(0.46,0.16,0.46), woodMat(0x6a4a3a), 0,0.08,0,g); mk(G.box(0.36,0.1,0.36), woodMat(0x8b5e3a), 0,0.21,0,g);
  mk(G.box(0.2,0.05,0.012), brass(), 0,0.11,0.232,g);
  mk(lathe([[0,0.26],[0.12,0.26],[0.12,0.29],[0.04,0.32],[0.035,0.42],[0.06,0.46],[0.16,0.52],[0.2,0.66],[0.19,0.74],[0.17,0.74],[0.18,0.66],[0.14,0.54],[0,0.5]],28), gold, 0,0,0,g);
  for (const s of [-1,1]){ const h=mk(G.tor(0.08,0.018,8,14,Math.PI*1.3), gold, s*0.21,0.62,0,g); h.rotation.z=s>0?-Math.PI*0.65:Math.PI*0.35; }
  const t=new THREE.Group(); t.position.y=0.86; g.add(t); top(t, gold);
  anim(g,tt=>{ t.rotation.y=tt*0.8; t.position.y=0.86+Math.sin(tt*2)*0.015; }); }
Object.assign(FURN_BUILDERS, {
  bonkcup(g){ cup(g, t=>{ const cols=[0xe8503a,0xffffff,0x3a8ad8,0xf7c948,0xffffff,0x4fb05a];
    for (let i=0;i<6;i++) mk(new THREE.SphereGeometry(0.11,8,10,i/6*TAU,TAU/6), shellMat(cols[i],{ roughness:0.3, clearcoat:0.8 }), 0,0,0,t); }); },
  crowncup(g){ cup(g, (t,gold)=>{ mk(CYL(0.11,0.1,0.07,16,1,true), gold, 0,0,0,t).material.side=THREE.DoubleSide;
    for (let i=0;i<5;i++){ const a=i/5*TAU; mk(new THREE.ConeGeometry(0.03,0.08,5), gold, Math.cos(a)*0.1,0.07,Math.sin(a)*0.1,t); mk(G.sph(0.018,6,5), shellMat([0xe8503a,0x3a8ad8,0x4fb05a][i%3],{ roughness:0.1, clearcoat:1 }), Math.cos(a+0.6)*0.105,0,Math.sin(a+0.6)*0.105,t); } }); },
});

// Painted globe texture
function globeTex(){ const cv=document.createElement('canvas'); cv.width=512; cv.height=256; const x=cv.getContext('2d');
  const gg=x.createLinearGradient(0,0,0,256); gg.addColorStop(0,'#bfe0f0'); gg.addColorStop(0.5,'#5a9ad8'); gg.addColorStop(1,'#bfe0f0'); x.fillStyle=gg; x.fillRect(0,0,512,256);
  let s=7; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  for (let i=0;i<7;i++){ const cx=r()*512, cy=50+r()*160, n=18+Math.floor(r()*14); x.fillStyle=['#e8d8a0','#8ac070','#c8b080'][i%3]; x.beginPath();
    for (let k=0;k<=n;k++){ const a=k/n*TAU, rr=(20+r()*45)*(1+Math.sin(a*3)*0.2); x.lineTo(cx+Math.cos(a)*rr*1.4, cy+Math.sin(a)*rr); } x.fill(); x.strokeStyle='#5a4a3a'; x.lineWidth=1.5; x.stroke(); }
  x.strokeStyle='rgba(255,255,255,0.35)'; x.lineWidth=1; for (let i=1;i<6;i++){ x.beginPath(); x.moveTo(0,i*256/6); x.lineTo(512,i*256/6); x.stroke(); } for (let i=0;i<12;i++){ x.beginPath(); x.moveTo(i*512/12,0); x.lineTo(i*512/12,256); x.stroke(); }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }

// Upgrade plain materials in every other builder: wood gets grain, glass becomes glass, the rest gets a soft glaze.
const POL=new Map();
function polishMat(m){
  if (!m || !m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.map || m.vertexColors || m.userData.char) return m;
  if (m.emissive && m.emissive.getHex()!==0) return m;
  const c=m.color.getHex(), key=c+':'+m.transparent+':'+m.opacity+':'+m.metalness+':'+m.flatShading+':'+m.roughness+':'+m.vertexColors+':'+m.side;
  if (POL.has(key)) return POL.get(key);
  let n;
  if (m.transparent && m.opacity<0.9) n=glassMat(c, Math.max(0.18,m.opacity*0.6));
  else if (WOODS.has(c) && !m.vertexColors) n=woodMat(c);
  else { n=new THREE.MeshPhysicalMaterial({ color:c, roughness:Math.min(m.roughness,0.85)*0.7, metalness:m.metalness, clearcoat:m.metalness>0.3?0.6:0.3, clearcoatRoughness:0.35, flatShading:m.flatShading, vertexColors:m.vertexColors, side:m.side }); }
  POL.set(key,n); return n;
}
export function polish(g){ g.traverse(o=>{ if (o.isMesh){ if (Array.isArray(o.material)) o.material=o.material.map(polishMat); else o.material=polishMat(o.material); } }); }
const RAW={...FURN_BUILDERS};
for (const k of Object.keys(RAW)) FURN_BUILDERS[k]=g=>{ RAW[k](g); polish(g); };
