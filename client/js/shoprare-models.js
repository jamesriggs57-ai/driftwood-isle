/* =====================================================================
   v1.44 SHOP REWARDS: models. Pemberton's back room pieces, Marlo's rare shelf and Sprig's rare flowers.
   Furniture builders face +z and stand on y=0. Builders push per-frame callbacks into g.userData.anims (t, dt).
   The items themselves are in content.js (search "v1.44 SHOP REWARDS").
   ===================================================================== */
import * as THREE from 'three';
import { M, mk, G, glowMat, glowMats, addGlow, FURN_BUILDERS, FLOWER_SHAPES, petalRing, buildItemModel } from './models.js';
import { woodMat, fabricMat, glassMat, brass, ceramic, shellMat, waterMat2 } from './look.js';

const TAU=Math.PI*2, V3=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const CYL=(...a)=>new THREE.CylinderGeometry(...a);
const lathe=(pts,seg=32)=>new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),seg);
const tube=(pts,r,seg=32,rs=8)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>V3(...p))),seg,r,rs,false);
const anim=(g,fn)=>{ (g.userData.anims ||= []).push(fn); };
const quiet=m=>{ m.castShadow=false; return m; };
const iron=()=>shellMat(0x2e2c2a,{ metalness:0.6, roughness:0.45, clearcoat:0.3 });
const gold=()=>shellMat(0xe8b84a,{ metalness:0.9, roughness:0.24, clearcoat:0.6 });
const marble=c=>shellMat(c,{ roughness:0.2, clearcoat:0.8 });
// one glowing material per color, so flowers that rebuild don't pile up materials
// water tinted per tank; cloned so changing opacity doesn't touch the shared cached material
const WM=new Map(); const water=(c,op)=>{ const k=c+':'+op; if (!WM.has(k)){ const m=waterMat2(c).clone(); m.opacity=op; WM.set(k,m); } return WM.get(k); };
const GM=new Map(); const glowOnce=c=>{ if (!GM.has(c)) GM.set(c, glowMat(c)); return GM.get(c); };
function mini(id, s){ const o=buildItemModel(id); o.scale.setScalar(s); o.traverse(c=>{ if (c.isMesh) c.castShadow=false; }); return o; }
function sandBed(g, W, D, y){ mk(G.box(W,0.07,D), ceramic(0xf0dcaa), 0,y+0.035,0,g); for (let i=0;i<Math.round(W*D*30);i++) quiet(mk(G.sph(0.025+(i%4)*0.007,6,5), ceramic([0xe8e0d0,0xc8b8a0,0xf0c8c0,0x9ab8c8][i%4]), -W/2+0.05+((i*0.37)%1)*(W-0.1), y+0.075, -D/2+0.05+((i*0.61)%1)*(D-0.1), g)); }
function swimmers(g, ids, y0, H, rx, rz, s=0.3){ return ids.map((id,i)=>{ const o=mini(id, s); o.position.set(0, y0+H*(0.25+0.5*((i*0.41)%1)), 0); g.add(o); return { o, ph:i*2.1, rx, rz, sp:0.3+((i*0.53)%1)*0.35, y:o.position.y }; }); }
function swim(list, t){ for (const f of list){ const a=t*f.sp+f.ph; f.o.position.x=Math.cos(a)*f.rx; f.o.position.z=Math.sin(a)*f.rz; f.o.position.y=f.y+Math.sin(a*2.3)*0.03; f.o.rotation.y=-a-Math.PI/2; const tl=f.o.userData.tail; if (tl) tl.rotation.y=Math.sin(t*9+f.ph)*0.4; } }

Object.assign(FURN_BUILDERS, {
  /* ---------- Pemberton's back room ---------- */
  jukebox(g){ const W=woodMat(0x6a3a2a), Wl=woodMat(0x8b5e3a), B=brass();
    mk(G.box(0.8,0.9,0.5), W, 0,0.45,0,g); mk(G.box(0.86,0.06,0.56), Wl, 0,0.03,0,g);
    const arch=mk(CYL(0.4,0.4,0.5,32,1,false,0,Math.PI), W, 0,0.9,0,g); arch.rotation.z=Math.PI/2; arch.rotation.y=Math.PI/2;
    const cols=[0xff5a8a,0xffc040,0x5ad8ff], tubes=cols.map((c,i)=>{ const m=new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:0.6, roughness:0.3 });
      const r=0.34-i*0.06, t=mk(G.tor(r,0.022,8,40,Math.PI), m, 0,0.9,0.26,g); t.castShadow=false; for (const s of [-1,1]) quiet(mk(G.cyl(0.022,0.022,0.5,8), m, s*r,0.65,0.26,g)); return m; });
    const win=mk(G.box(0.5,0.26,0.02), glassMat(0xfff4e0,0.25), 0,0.82,0.255,g); win.castShadow=false;
    const rec=new THREE.Group(); rec.position.set(0,0.82,0.2); g.add(rec); const disc=mk(G.cyl(0.11,0.11,0.01,24), M(0x161616,{roughness:0.3}), 0,0,0,rec); disc.rotation.x=Math.PI/2; mk(G.cyl(0.04,0.04,0.012,16), M(0xe2483d), 0,0,0.002,rec).rotation.x=Math.PI/2;
    // a scallop-shell speaker grille
    const fan=new THREE.Group(); fan.position.set(0,0.38,0.255); g.add(fan); for (let i=0;i<9;i++){ const a=-Math.PI/2+(i/8-0.5)*2.2; const rib=mk(G.box(0.025,0.3,0.015), gold(), Math.sin(a+Math.PI/2)*0.08, Math.cos(a+Math.PI/2)*-0.08+0.06, 0, fan); rib.rotation.z=-(a+Math.PI/2); }
    mk(G.box(0.62,0.32,0.01), fabricMat(0x8a2a2a,'plain'), 0,0.4,0.25,g);
    for (const s of [-1,1]) mk(G.box(0.05,0.85,0.05), B, s*0.4,0.47,0.26,g);
    for (let i=0;i<6;i++) mk(G.cyl(0.02,0.02,0.03,10), ceramic(0xfaf4ea), -0.2+i*0.08,0.66,0.26,g).rotation.x=Math.PI/2;
    addGlow(g, 0.9, 1.8, 0xffb0c8);
    anim(g,t=>{ rec.rotation.z=-t*3; tubes.forEach((m,i)=>m.emissiveIntensity=0.45+Math.max(0,Math.sin(t*2+i*2.1))*0.6); }); },
  sewingmachine(g){ const I=iron(), W=woodMat(0x7a4a2a), Gd=gold();
    for (const s of [-1,1]){ const f=new THREE.Group(); f.position.x=s*0.36; g.add(f); mk(G.box(0.05,0.66,0.05), I, 0,0.33,-0.18,f); mk(G.box(0.05,0.66,0.05), I, 0,0.33,0.18,f); mk(G.box(0.05,0.05,0.42), I, 0,0.06,0,f);
      for (let k=0;k<3;k++){ const x=mk(G.box(0.02,0.42,0.02), I, 0,0.38,0,f); x.rotation.x=(k-1)*0.7; } mk(G.tor(0.1,0.015,8,24), I, 0,0.3,0,f).rotation.y=Math.PI/2; }
    mk(G.box(0.86,0.05,0.5), W, 0,0.69,0,g); mk(G.box(0.8,0.1,0.44), W, 0,0.62,0,g);
    const tr=new THREE.Group(); tr.position.set(0,0.09,0.05); g.add(tr); mk(G.box(0.4,0.03,0.24), I, 0,0,0,tr); for (let i=-2;i<=2;i++) mk(G.box(0.02,0.032,0.2), Gd, i*0.07,0.002,0,tr);
    const body=new THREE.Group(); body.position.set(-0.04,0.72,0); g.add(body); const blk=shellMat(0x141414,{ roughness:0.25, clearcoat:0.9 });
    mk(G.box(0.5,0.06,0.2), blk, 0,0.03,0,body); mk(G.box(0.1,0.28,0.14), blk, 0.18,0.2,0,body); mk(G.box(0.46,0.09,0.12), blk, -0.02,0.36,0,body); mk(G.box(0.1,0.14,0.12), blk, -0.22,0.27,0,body);
    mk(G.cyl(0.008,0.008,0.12,6), M(0xc8c8c8,{metalness:0.8}), -0.22,0.15,0.02,body);
    for (const [x,y,w] of [[-0.02,0.36,0.3],[0.18,0.22,0.06],[-0.22,0.3,0.06]]) quiet(mk(G.box(w,0.015,0.004), Gd, x,y,0.062,body));
    const wheel=new THREE.Group(); wheel.position.set(0.25,0.3,0); body.add(wheel); mk(G.tor(0.08,0.012,8,24), shellMat(0xc8c8c8,{metalness:0.8,roughness:0.3}), 0,0,0,wheel).rotation.y=Math.PI/2; for (let k=0;k<4;k++){ const sp=mk(G.box(0.006,0.16,0.006), I, 0,0,0,wheel); sp.rotation.x=k/4*Math.PI; }
    mk(G.cyl(0.03,0.03,0.06,12), M(0x3a6ad8), 0.05,0.44,0,body); mk(G.cyl(0.012,0.012,0.08,6), M(0xa8754a), 0.05,0.44,0,body);
    const cloth=mk(G.box(0.3,0.005,0.22), fabricMat(0xe89ab0,'gingham',0xffffff), -0.2,0.72,0.05,g); cloth.rotation.y=0.2;
    anim(g,t=>{ wheel.rotation.x=t*2.4; tr.rotation.x=Math.sin(t*2.4)*0.12; }); },
  cuckooclock(g){ const W=woodMat(0x5a3a22), Wl=woodMat(0x8b5e3a), Lf=woodMat(0x3a2a18);
    mk(G.cyl(0.05,0.06,1.0,10), W, 0,0.5,-0.05,g); mk(G.cyl(0.2,0.24,0.05,16), W, 0,0.025,-0.05,g);
    const H=new THREE.Group(); H.position.set(0,1.25,0); g.add(H);
    mk(G.box(0.46,0.5,0.22), Wl, 0,0,0,H);
    for (const s of [-1,1]){ const r=mk(G.box(0.36,0.03,0.3), Lf, s*0.15,0.33,0,H); r.rotation.z=-s*0.62; }
    mk(G.box(0.05,0.08,0.05), Lf, 0,0.43,0.12,H); const bd=mk(G.sph(0.03,8,6), M(0xf8f4e8), 0,0.42,0.16,H);
    for (let i=0;i<5;i++){ const a=i/5*Math.PI; const lf=mk(G.sph(0.07,8,6), Lf, Math.cos(a)*0.2,-0.28+Math.sin(a)*0.04,0.11,H); lf.scale.set(1.4,0.5,0.3); lf.rotation.z=a; }
    const face=new THREE.Group(); face.position.set(0,-0.04,0.115); H.add(face); mk(G.cyl(0.13,0.13,0.015,28), ceramic(0xfaf4e4), 0,0,0,face).rotation.x=Math.PI/2; quiet(mk(G.tor(0.13,0.012,6,28), gold(), 0,0,0.008,face));
    for (let k=0;k<12;k++){ const a=k/12*TAU; quiet(mk(G.box(0.01,0.025,0.004), M(0x2a1a10), Math.sin(a)*0.105,Math.cos(a)*0.105,0.012,face)).rotation.z=-a; }
    const hh=quiet(mk(G.box(0.012,0.07,0.004), M(0x2a1a10), 0,0.03,0.016,face)), mm=quiet(mk(G.box(0.008,0.1,0.004), M(0x2a1a10), 0,0.045,0.018,face));
    const hp=new THREE.Group(); face.add(hp); hp.add(hh); const mp=new THREE.Group(); face.add(mp); mp.add(mm);
    const door=new THREE.Group(); door.position.set(-0.05,0.17,0.112); H.add(door); mk(G.box(0.1,0.1,0.01), W, 0.05,0,0,door);
    const bird=new THREE.Group(); bird.position.set(0,0.17,0.05); H.add(bird); mk(G.sph(0.035,10,8), M(0x8a5a3a), 0,0,0,bird); mk(G.cone(0.012,0.04,6), M(0xf0a020), 0,0,0.045,bird).rotation.x=Math.PI/2; mk(G.sph(0.008,6,5), M(0x101010), 0.016,0.012,0.028,bird);
    const pend=new THREE.Group(); pend.position.set(0,-0.25,0.08); H.add(pend); mk(G.box(0.01,0.3,0.006), gold(), 0,-0.15,0,pend); mk(G.cyl(0.05,0.05,0.012,18), gold(), 0,-0.31,0,pend).rotation.x=Math.PI/2;
    for (const s of [-1,1]){ mk(G.cyl(0.004,0.004,0.36,4), M(0x8a8a8a,{metalness:0.8}), s*0.12,-0.43,0.06,H); const cone=mk(lathe([[0.001,0],[0.035,0.04],[0.04,0.1],[0.03,0.15],[0.001,0.17]],10), Lf, s*0.12,-0.78,0.06,H); for (let k=0;k<4;k++) quiet(mk(G.tor(0.036,0.006,4,10), W, s*0.12,-0.74+k*0.03,0.06,H)).rotation.x=Math.PI/2; }
    anim(g,t=>{ mp.rotation.z=-t*0.5; hp.rotation.z=-t*0.04; pend.rotation.z=Math.sin(t*3)*0.35; const ph=(t*0.12)%1, o=ph<0.06?ph/0.06:ph<0.2?1:ph<0.26?1-(ph-0.2)/0.06:0; door.rotation.y=-o*1.6; bird.position.z=0.05+o*0.12; bird.rotation.x=o>0.9?Math.sin(t*20)*0.2:0; }); },
  steamtrunk(g){ const L=shellMat(0x3a5a7a,{ roughness:0.6, clearcoat:0.2 }), S=woodMat(0x6a4a2a), B=brass(), lw=1.0, dp=0.52;
    mk(G.box(lw,0.42,dp), L, 0,0.23,0,g);
    const lid=mk(CYL(dp/2,dp/2,lw,24,1,false,0,Math.PI), L, 0,0.44,0,g); lid.rotation.z=Math.PI/2; lid.rotation.y=Math.PI/2; lid.scale.set(1,0.55,1);
    for (const x of [-0.3,0.3]){ mk(G.box(0.07,0.43,dp+0.02), S, x,0.23,0,g); const st=mk(CYL(dp/2+0.01,dp/2+0.01,0.07,24,1,false,0,Math.PI), S, x,0.44,0,g); st.rotation.z=Math.PI/2; st.rotation.y=Math.PI/2; st.scale.set(1,0.55,1); }
    for (const sx of [-1,1]) for (const sz of [-1,1]) for (const y of [0.04,0.42]) mk(G.box(0.06,0.06,0.06), B, sx*(lw/2-0.02),y,sz*(dp/2-0.02),g);
    mk(G.box(0.08,0.1,0.02), B, 0,0.4,dp/2+0.01,g); mk(G.tor(0.05,0.012,6,14,Math.PI), M(0x3a2a1a), lw/2+0.02,0.32,0,g).rotation.y=Math.PI/2;
    const stick=[[0xe2483d,-0.15,0.22,0.2],[0xf8d040,0.12,0.3,-0.3],[0x5ac06a,0.0,0.12,0.1],[0xf0f0f0,0.42,0.2,0.4]];
    for (const [c,x,y,r] of stick){ const p=mk(x===0.42?G.cyl(0.06,0.06,0.005,16):G.box(0.14,0.09,0.005), M(c,{roughness:0.9}), x===0.42?0.18:x,y,dp/2+0.004,g); if (x===0.42) p.rotation.x=Math.PI/2; else p.rotation.z=r; quiet(p);
      quiet(mk(G.box(0.08,0.012,0.004), M(0x3a2a20), x===0.42?0.18:x,y,dp/2+0.008,g)).rotation.z=x===0.42?0:r; } },
  pennyfarthing(g){ const I=iron(), Rb=M(0x1a1a1a,{roughness:0.6});
    mk(G.box(1.1,0.05,0.34), woodMat(0x6a4a2a), 0.05,0.025,0,g);
    const big=new THREE.Group(); big.position.set(0.25,0.64,0); g.add(big); mk(G.tor(0.58,0.025,8,48), Rb, 0,0,0,big); mk(G.tor(0.56,0.01,6,48), I, 0,0,0,big); mk(G.cyl(0.04,0.04,0.08,12), I, 0,0,0,big).rotation.x=Math.PI/2;
    for (let k=0;k<16;k++){ const s=mk(G.cyl(0.004,0.004,1.1,4), M(0xc8c8c8,{metalness:0.8,roughness:0.3}), 0,0,0,big); s.rotation.z=k/16*Math.PI; }
    const sm=new THREE.Group(); sm.position.set(-0.42,0.16,0); g.add(sm); mk(G.tor(0.14,0.018,8,24), Rb, 0,0,0,sm); for (let k=0;k<6;k++){ const s=mk(G.cyl(0.004,0.004,0.27,4), I, 0,0,0,sm); s.rotation.z=k/6*Math.PI; }
    quiet(mk(tube([[0.25,1.22,0],[0.12,1.24,0],[-0.12,1.06,0],[-0.34,0.6,0],[-0.42,0.2,0]],0.025,24,6), I, 0,0,0,g));
    for (const s of [-1,1]) quiet(mk(tube([[0.25,0.64,s*0.05],[0.25,1.0,s*0.04],[0.25,1.22,0]],0.015,10,5), I, 0,0,0,g));
    mk(G.box(0.03,0.02,0.5), I, 0.27,1.26,0,g); for (const s of [-1,1]) mk(G.cyl(0.022,0.022,0.1,10), woodMat(0xa8754a), 0.27,1.26,s*0.28,g).rotation.x=Math.PI/2;
    const sad=mk(G.sph(0.09,12,8), shellMat(0x5a3a22,{roughness:0.5}), 0.05,1.27,0,g); sad.scale.set(1.4,0.4,0.9);
    for (const s of [-1,1]) mk(G.box(0.03,0.6,0.03), woodMat(0x5a3a22), 0.25,0.3,s*0.12,g);
    anim(g,t=>{ big.rotation.z=-t*0.25; sm.rotation.z=-t*1.04; }); },
  chesstable(g){ const Wd=woodMat(0x4a3020);
    mk(G.cyl(0.24,0.3,0.05,24), Wd, 0,0.025,0,g); mk(lathe([[0.001,0],[0.07,0],[0.05,0.15],[0.08,0.35],[0.05,0.55],[0.07,0.62],[0.001,0.62]],20), Wd, 0,0.05,0,g);
    mk(G.box(0.68,0.05,0.68), Wd, 0,0.69,0,g); const top=new THREE.Group(); top.position.y=0.72; g.add(top);
    for (let i=0;i<8;i++) for (let j=0;j<8;j++) quiet(mk(G.box(0.07,0.015,0.07), marble((i+j)%2?0x3a3438:0xf0ece4), -0.245+i*0.07,0,-0.245+j*0.07,top));
    const pc=(c,x,z,kind)=>{ const m=marble(c), p=new THREE.Group(); p.position.set(-0.245+x*0.07,0.008,-0.245+z*0.07); top.add(p);
      if (kind==='p'){ mk(lathe([[0.001,0],[0.022,0],[0.02,0.01],[0.01,0.035],[0.001,0.04]],12), m, 0,0,0,p); mk(G.sph(0.013,10,8), m, 0,0.05,0,p); }
      else if (kind==='k'){ mk(lathe([[0.001,0],[0.026,0],[0.02,0.012],[0.012,0.06],[0.018,0.075],[0.001,0.08]],12), m, 0,0,0,p); mk(G.box(0.008,0.03,0.008), m, 0,0.095,0,p); mk(G.box(0.022,0.008,0.008), m, 0,0.098,0,p); }
      else if (kind==='n'){ mk(lathe([[0.001,0],[0.024,0],[0.016,0.02],[0.001,0.025]],12), m, 0,0,0,p); const h=mk(G.box(0.022,0.045,0.035), m, 0,0.045,0.004,p); h.rotation.x=-0.3; }
      else { mk(lathe([[0.001,0],[0.024,0],[0.018,0.012],[0.012,0.055],[0.02,0.06],[0.001,0.072]],12), m, 0,0,0,p); } };
    for (let i=0;i<8;i++){ pc(0xf6f2ea,i,6,'p'); pc(0x2a2428,i,1,'p'); }
    pc(0xf6f2ea,4,7,'k'); pc(0x2a2428,4,0,'k'); pc(0xf6f2ea,1,7,'n'); pc(0x2a2428,6,0,'n'); pc(0xf6f2ea,0,7,'r'); pc(0x2a2428,7,0,'r'); pc(0xf6f2ea,3,4,'q'); },
  typewriter(g){ const Wd=woodMat(0x6a4a2a), blk=shellMat(0x1e2a24,{ roughness:0.3, clearcoat:0.8 });
    mk(G.box(0.7,0.04,0.5), Wd, 0,0.6,0,g); for (const sx of [-1,1]) for (const sz of [-1,1]) mk(G.box(0.05,0.58,0.05), Wd, sx*0.3,0.29,sz*0.2,g); mk(G.box(0.62,0.03,0.42), Wd, 0,0.15,0,g);
    const T=new THREE.Group(); T.position.y=0.62; g.add(T);
    const body=mk(G.box(0.42,0.1,0.3), blk, 0,0.05,0,T); const slope=mk(G.box(0.42,0.04,0.16), blk, 0,0.08,0.1,T); slope.rotation.x=0.35;
    const keys=[]; for (let r=0;r<3;r++) for (let c=0;c<9-r;c++){ const k=mk(G.cyl(0.016,0.016,0.01,12), ceramic(0xf6f0e0), -0.16+c*0.04+r*0.02,0.11-r*0.022,0.14-r*0.04,T); k.rotation.x=0.35; keys.push(k); quiet(mk(G.cyl(0.018,0.018,0.006,12), gold(), k.position.x,k.position.y-0.006,k.position.z,T)).rotation.x=0.35; }
    mk(G.box(0.2,0.012,0.04), ceramic(0xf6f0e0), 0,0.07,0.21,T);
    const car=new THREE.Group(); car.position.set(0,0.15,-0.08); T.add(car); const rl=mk(G.cyl(0.035,0.035,0.5,16), M(0x1a1a1a,{roughness:0.5}), 0,0,0,car); rl.rotation.z=Math.PI/2;
    for (const s of [-1,1]) mk(G.cyl(0.03,0.03,0.02,12), gold(), s*0.26,0,0,car).rotation.z=Math.PI/2;
    const paper=mk(G.box(0.24,0.26,0.003), M(0xfffcf2,{roughness:0.95}), 0,0.12,-0.02,car); paper.rotation.x=-0.25; for (let i=0;i<5;i++) quiet(mk(G.box(0.12+((i*37)%5)*0.015,0.006,0.001), M(0x2a2a2a), -0.03,0.04+i*0.03,-0.004,paper)).position.z=0.002;
    mk(G.box(0.03,0.012,0.12), gold(), 0.27,0.02,0.04,car).rotation.y=0.4;
    mk(G.box(0.1,0.04,0.07), M(0x3a2a1a), -0.25,0.66,0.12,g); for (let i=0;i<3;i++) quiet(mk(G.box(0.09,0.004,0.06), M(0xfffcf2), -0.25,0.69+i*0.005,0.12,g));
    anim(g,t=>{ const ph=(t*0.9)%1; car.position.x=0.12-((t*0.15)%1)*0.24; keys.forEach((k,i)=>{ k.position.y=(0.11-Math.floor(i/9)*0.022)-(((i*7+Math.floor(t*6))%11)===0?0.008:0); }); car.rotation.x=ph<0.05?-0.2:0; }); },
  hourglass(g){ const B=brass(), Wd=woodMat(0x4a3020), sandC=0xf8d080;
    for (const y of [0.04,1.36]){ mk(G.cyl(0.3,0.32,0.08,24), Wd, 0,y,0,g); mk(G.tor(0.3,0.015,8,32), B, 0,y+(y<1?0.04:-0.04),0,g).rotation.x=Math.PI/2; }
    for (let k=0;k<3;k++){ const a=k/3*TAU+0.5; mk(lathe([[0.025,0],[0.018,0.1],[0.028,0.3],[0.018,0.6],[0.028,0.9],[0.018,1.1],[0.025,1.2]],10), B, Math.cos(a)*0.24,0.08,Math.sin(a)*0.24,g); }
    const gl=quiet(mk(lathe([[0.03,0],[0.22,0.08],[0.24,0.25],[0.12,0.48],[0.03,0.6],[0.12,0.72],[0.24,0.95],[0.22,1.12],[0.03,1.2]],32), glassMat(0xeaf6ff,0.22), 0,0.08,0,g));
    const sm=new THREE.MeshStandardMaterial({ color:sandC, emissive:0xffb040, emissiveIntensity:0.3, roughness:0.8 }); glowMats.push(sm);
    const top=mk(G.cone(0.2,0.36,24), sm, 0,0.88,0,g); top.rotation.x=Math.PI; const bot=mk(G.cone(0.21,0.3,24), sm, 0,0.12,0,g); bot.position.y=0.2;
    const stream=quiet(mk(G.cyl(0.006,0.006,0.5,6), sm, 0,0.45,0,g));
    addGlow(g, 0.7, 1.6, 0xffc070);
    anim(g,t=>{ const k=(t*0.04)%1; top.scale.set(1-k*0.9,1-k*0.9,1-k*0.9); top.position.y=0.7+0.18*(1-k*0.5); bot.scale.set(0.15+k*0.85,0.15+k*0.85,0.15+k*0.85); bot.position.y=0.08+0.15*(0.15+k*0.85); stream.visible=k<0.97; }); },

  /* ---------- Marlo's rare shelf ---------- */
  jellylamp(g){ const B=brass();
    mk(G.cyl(0.2,0.24,0.12,28), woodMat(0x3a2a20), 0,0.06,0,g); mk(G.tor(0.2,0.015,8,32), B, 0,0.12,0,g).rotation.x=Math.PI/2;
    const wt=quiet(mk(G.cyl(0.18,0.18,0.62,32), water(0x4a6ad8,0.25), 0,0.44,0,g));
    quiet(mk(lathe([[0.19,0],[0.19,0.6],[0.16,0.68],[0.08,0.72],[0.001,0.73]],32), glassMat(0xeaf4ff,0.16), 0,0.12,0,g)); mk(G.tor(0.19,0.014,8,32), B, 0,0.74,0,g).rotation.x=Math.PI/2;
    const jelly=(c,y,s,ph)=>{ const j=new THREE.Group(); j.position.y=y; j.scale.setScalar(s); g.add(j); const m=new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:0.5, transparent:true, opacity:0.75, roughness:0.2 }); glowMats.push(m);
      const bell=quiet(mk(G.sph(0.08,20,12,0,TAU,0,Math.PI/2), m, 0,0,0,j)); bell.scale.y=0.8; const tents=[];
      for (let k=0;k<6;k++){ const a=k/6*TAU, tt=quiet(mk(tube([[0,0,0],[0.01,-0.08,0.01],[-0.01,-0.16,0],[0.01,-0.24,0.01]],0.006,12,4), m, Math.cos(a)*0.05,0,Math.sin(a)*0.05,j)); tents.push(tt); }
      return { j, tents, ph, y }; };
    const js=[jelly(0xff8ac8,0.55,1,0), jelly(0x8ad8ff,0.38,0.7,2.1), jelly(0xc8a0ff,0.62,0.55,4)];
    addGlow(g, 0.45, 1.6, 0xd0a8ff);
    anim(g,t=>{ for (const q of js){ const p=t*1.4+q.ph, pulse=1+Math.sin(p*2)*0.08; q.j.position.y=q.y+Math.sin(p*0.5)*0.06; q.j.position.x=Math.sin(p*0.3)*0.05; q.j.scale.y=q.j.scale.x*(1/pulse); q.tents.forEach((tt,i)=>tt.rotation.x=Math.sin(p*2+i)*0.25); } }); },
  seahorsetank(g){ const B=brass();
    mk(G.cyl(0.26,0.3,0.24,28), woodMat(0x5a3a2a), 0,0.12,0,g); mk(G.tor(0.26,0.016,8,32), B, 0,0.24,0,g).rotation.x=Math.PI/2;
    mk(G.cyl(0.24,0.24,0.06,28), ceramic(0xf0dcaa), 0,0.27,0,g);
    const wt=quiet(mk(G.cyl(0.22,0.22,1.0,32), water(0x6ad0e8,0.25), 0,0.8,0,g)); quiet(mk(G.cyl(0.235,0.235,1.06,32,1,true), glassMat(0xe8f8ff,0.14), 0,0.8,0,g));
    mk(G.cyl(0.26,0.26,0.05,28), woodMat(0x5a3a2a), 0,1.34,0,g); mk(G.tor(0.25,0.014,8,32), B, 0,1.32,0,g).rotation.x=Math.PI/2;
    const grass=[]; for (let i=0;i<7;i++){ const a=i/7*TAU, p=new THREE.Group(); p.position.set(Math.cos(a)*0.12,0.3,Math.sin(a)*0.12); g.add(p); for (let k=0;k<6;k++) quiet(mk(G.cap(0.012,0.09,4,6), shellMat(i%2?0x5aa84a:0x7ac05a,{roughness:0.5}), 0,0.05+k*0.1,0,p)); grass.push(p); }
    const coral=new THREE.Group(); coral.position.set(-0.06,0.3,0.05); g.add(coral); for (let k=0;k<5;k++){ const b=mk(G.cyl(0.015,0.025,0.18,6), ceramic(0xf27a5a), 0,0.09,0,coral); b.rotation.set(Math.sin(k*1.7)*0.6,k,Math.cos(k*1.3)*0.6); b.position.set(Math.sin(k)*0.03,0.08,Math.cos(k)*0.03); }
    const hs=['seahorse','goldseahorse','seahorse'].map((id,i)=>{ const o=mini(id,0.42); o.position.set(Math.cos(i*2.1)*0.1, 0.55+i*0.22, Math.sin(i*2.1)*0.1); g.add(o); return { o, ph:i*1.9, y:o.position.y }; });
    anim(g,t=>{ for (const h of hs){ h.o.position.y=h.y+Math.sin(t*0.8+h.ph)*0.05; h.o.rotation.y=Math.sin(t*0.3+h.ph)*1.2; } grass.forEach((p,i)=>p.rotation.z=Math.sin(t*1.1+i)*0.12); }); },
  nautiluslamp(g){ const B=brass(), shell=new THREE.Group(); shell.position.set(0,0.52,0); g.add(shell);
    mk(G.cyl(0.16,0.2,0.08,24), woodMat(0x4a3020), 0,0.04,0,g); mk(G.cyl(0.02,0.03,0.3,10), B, 0,0.22,0,g); mk(G.box(0.24,0.02,0.04), B, 0,0.38,0,g); for (const s of [-1,1]) mk(G.box(0.02,0.08,0.04), B, s*0.12,0.42,0,g);
    // a log spiral of chambers, each a little bigger, banded tiger-orange on cream
    for (let k=0;k<20;k++){ const a=k*0.42, r=0.03*Math.exp(a*0.17), w=0.025*Math.exp(a*0.17); const m=mk(G.sph(w,12,10), shellMat(k%3===0?0xc86a3a:0xf4e8d4,{ roughness:0.25, clearcoat:0.8 }), Math.cos(a)*r,Math.sin(a)*r,0,shell); m.scale.set(1,1,0.9); }
    const mouth=new THREE.MeshStandardMaterial({ color:0xfff0d0, emissive:0xffc880, emissiveIntensity:0.4, roughness:0.4, side:THREE.DoubleSide }); glowMats.push(mouth);
    const lip=mk(G.tor(0.11,0.025,10,24), shellMat(0xf8f0e4,{ roughness:0.2, clearcoat:1, metalness:0.2 }), 0.2,-0.02,0,shell); lip.rotation.y=Math.PI/2; lip.scale.set(1,1.15,1);
    quiet(mk(new THREE.CircleGeometry(0.1,24), mouth, 0.2,-0.02,0,shell)).rotation.y=Math.PI/2;
    shell.rotation.y=-0.6;
    addGlow(g, 0.52, 1.5, 0xffd8a0); },
  kelptank(g){ const W=1.8, D=0.6, H=0.9, base=0.42, Wd=woodMat(0x4a3020), B=brass();
    mk(G.box(W+0.1,base,D+0.1), Wd, 0,base/2,0,g); for (const x of [-0.6,0,0.6]) quiet(mk(G.box(0.5,base-0.12,0.01), woodMat(0x5a3a2a), x,base/2,D/2+0.055,g));
    mk(G.box(W+0.14,0.05,D+0.14), B, 0,base+0.02,0,g); const y0=base+0.05; sandBed(g, W-0.04, D-0.04, y0);
    for (let i=0;i<5;i++) mk(G.dod(0.08+(i%3)*0.04), M(0x7a8088), -0.7+i*0.35,y0+0.1,-0.15+((i*0.37)%1)*0.2,g);
    const kelp=[]; for (let i=0;i<9;i++){ const p=new THREE.Group(); p.position.set(-0.8+i*0.2+((i*0.31)%1)*0.08, y0+0.07, -0.2+((i*0.53)%1)*0.25); g.add(p); const segs=[];
      let par=p; for (let k=0;k<7;k++){ const s=new THREE.Group(); s.position.y=k?0.11:0; par.add(s); quiet(mk(G.cap(0.012,0.09,4,6), shellMat(0x6a8a2a,{roughness:0.5}), 0,0.055,0,s)); const lf=quiet(mk(G.sph(0.05,8,4), shellMat(i%2?0x8aa83a:0x6a9a3a,{roughness:0.5}), 0.03*(k%2?1:-1),0.06,0,s)); lf.scale.set(1,0.3,0.5); lf.rotation.z=(k%2?-0.6:0.6); segs.push(s); par=s; }
      kelp.push({ segs, ph:i*0.7 }); }
    const wt=quiet(mk(G.box(W-0.02,H*0.9,D-0.02), water(0x3a90a8,0.3), 0,y0+H*0.45,0,g));
    quiet(mk(G.box(W,H,D), glassMat(0xe8f8ff,0.12), 0,y0+H/2,0,g)); mk(G.box(W+0.04,0.05,D+0.04), Wd, 0,y0+H,0,g);
    const fish=swimmers(g, ['snapper','mackerel','coraldart','silverbream','minnow'], y0, H, W*0.36, D*0.25, 0.3);
    const beams=[]; for (let i=0;i<3;i++){ const b=quiet(mk(G.box(0.12,H*0.85,0.01), new THREE.MeshBasicMaterial({ color:0xfff8d8, transparent:true, opacity:0.08, depthWrite:false }), -0.5+i*0.5,y0+H*0.5,-0.05,g)); b.rotation.z=0.25; beams.push(b); }
    anim(g,t=>{ swim(fish,t); for (const k of kelp) k.segs.forEach((s,j)=>s.rotation.z=Math.sin(t*0.9+k.ph+j*0.4)*0.09); beams.forEach((b,i)=>b.material.opacity=0.05+Math.max(0,Math.sin(t*0.6+i*2))*0.06); }); },
  portholetank(g){ const B=brass(), Wd=woodMat(0x4a3020);
    mk(G.box(0.7,0.08,0.36), Wd, 0,0.04,0,g); for (const s of [-1,1]) mk(G.box(0.08,0.36,0.08), Wd, s*0.2,0.24,0,g); mk(G.box(0.5,0.06,0.3), Wd, 0,0.44,0,g);
    const P=new THREE.Group(); P.position.set(0,0.88,0); g.add(P);
    mk(G.cyl(0.4,0.4,0.24,40,1,true), shellMat(0x3a4a5a,{ metalness:0.5, roughness:0.4 }), 0,0,0,P).rotation.x=Math.PI/2;
    for (const z of [-0.12,0.12]){ const r=mk(G.tor(0.4,0.05,12,48), B, 0,0,z,P); for (let k=0;k<12;k++){ const a=k/12*TAU; mk(G.sph(0.022,8,6), B, Math.cos(a)*0.4,Math.sin(a)*0.4,z+(z>0?0.05:-0.05),P); } }
    const wt=quiet(mk(G.cyl(0.38,0.38,0.22,40), water(0x4ab0d0,0.35), 0,0,0,P)); wt.rotation.x=Math.PI/2;
    for (const z of [-0.11,0.11]) quiet(mk(new THREE.CircleGeometry(0.38,40), glassMat(0xe8f8ff,0.12), 0,0,z,P)).rotation.y=z<0?Math.PI:0;
    const sand=mk(CYL(0.37,0.37,0.2,40,1,false,Math.PI*0.75,Math.PI*0.5), ceramic(0xf0dcaa), 0,0,0,P); sand.rotation.x=Math.PI/2;
    for (let i=0;i<4;i++){ const p=new THREE.Group(); p.position.set(-0.15+i*0.1,-0.28,0); P.add(p); for (let k=0;k<4;k++) quiet(mk(G.cap(0.01,0.05,4,6), shellMat(0x5aa84a,{roughness:0.5}), 0,0.03+k*0.06,0,p)); }
    const fish=['coraldart','puffer','wrasse'].map((id,i)=>{ const o=mini(id,0.26); P.add(o); return { o, ph:i*2.1, sp:0.5+i*0.12 }; });
    const hub=mk(G.box(0.03,0.08,0.03), B, 0.42,0,0.14,P); mk(G.sph(0.03,10,8), B, 0.42,0.05,0.14,P);
    anim(g,t=>{ for (const f of fish){ const a=t*f.sp+f.ph; f.o.position.set(Math.cos(a)*0.22, Math.sin(a)*0.18, ((f.ph*7)%3-1)*0.04); f.o.rotation.set(0,Math.PI/2,a+Math.PI/2); f.o.rotation.order='YXZ'; } }); },
  octolamp(g){ const sk=shellMat(0xd8604a,{ roughness:0.35, clearcoat:0.6 }), dots=shellMat(0xf0a090,{ roughness:0.3 });
    const head=new THREE.Group(); head.position.y=0.32; g.add(head); mk(G.sph(0.17,24,18), sk, 0,0.08,-0.02,head).scale.set(1,1.25,1.05);
    for (let k=0;k<7;k++) quiet(mk(G.sph(0.015,8,6), dots, Math.cos(k*0.9)*0.12,0.16+Math.sin(k*1.3)*0.06,Math.sin(k*0.9)*0.1+0.05,head));
    for (const s of [-1,1]){ mk(G.sph(0.045,12,10), M(0xfff8ea,{roughness:0.3}), s*0.08,0.0,0.13,head); mk(G.sph(0.022,10,8), M(0x161010,{roughness:0.2}), s*0.08,0.0,0.165,head); }
    const arms=[]; for (let k=0;k<8;k++){ const a=k/8*TAU+0.2, ag=new THREE.Group(); ag.position.set(Math.cos(a)*0.08,0.26,Math.sin(a)*0.08); ag.rotation.y=-a; g.add(ag);
      const up=k===2, pts=up?[[0,0,0],[0.14,0.05,0],[0.22,0.3,0],[0.18,0.62,0]]:[[0,0,0],[0.14,-0.16,0],[0.28,-0.24,0],[0.36,-0.2,0],[0.38,-0.14,0]];
      mk(tube(pts,0.035,20,8), sk, 0,0,0,ag); for (let i=1;i<5;i++){ const p=pts[Math.min(i,pts.length-1)]; quiet(mk(G.sph(0.012,6,5), dots, p[0],p[1]-0.02,0.02,ag)); }
      arms.push({ ag, a, up }); }
    const holder=arms.find(x=>x.up).ag, orb=new THREE.MeshStandardMaterial({ color:0xfff2c8, emissive:0xffd080, emissiveIntensity:0.5, roughness:0.3, transparent:true, opacity:0.92 }); glowMats.push(orb);
    const o=mk(G.sph(0.1,24,18), orb, 0.18,0.72,0,holder); quiet(o); mk(G.tor(0.06,0.012,8,20), brass(), 0.18,0.63,0,holder).rotation.x=Math.PI/2;
    const gl=addGlow(holder, 0.72, 1.6, 0xffd090); gl.position.x=0.18;
    anim(g,t=>{ arms.forEach((q,i)=>{ if (!q.up) q.ag.rotation.z=Math.sin(t*1.2+i)*0.08; }); head.position.y=0.32+Math.sin(t*1.1)*0.01; }); },
});

/* ---------- Sprig's rare flowers: heads drawn on top of the stem (head is at the stem top) ---------- */
Object.assign(FLOWER_SHAPES, {
  // a blue rose: tight cup of blue petals, pale frosted edges, a bead of dew
  bluerose(head, c, P){ const pale=P.c2; mk(G.sph(0.055,10,8),M(c),0,0.03,0,head); petalRing(head,5,0.085,0.1,1.05,c,0,0.04); petalRing(head,6,0.13,0.12,0.62,c,0,0.03); petalRing(head,7,0.16,0.1,0.35,pale,-0.005,0.02);
    quiet(mk(G.sph(0.018,10,8), glassMat(0xffffff,0.6), 0.05,0.06,0.04,head)); },
  // a black tulip: six pointed petals in near-black plum, glowing wine-red at the heart
  blacktulip(head, c, P){ for (let i=0;i<6;i++){ const a=i/6*TAU, p=quiet(mk(G.cone(0.055,0.2,8),M(c,{roughness:0.35}),Math.cos(a)*0.04,0.09,Math.sin(a)*0.04,head)); p.rotation.set(Math.sin(a)*0.22,0,-Math.cos(a)*0.22); p.scale.set(1,1,0.5); p.rotation.y=-a; }
    quiet(mk(G.sph(0.045,10,8), M(P.c2,{ emissive:P.c2, emissiveIntensity:0.25 }), 0,0.04,0,head)); for (let i=0;i<3;i++) quiet(mk(G.cyl(0.004,0.004,0.06,4), M(0xf8e080), Math.cos(i*2.1)*0.015,0.06,Math.sin(i*2.1)*0.015,head)); },
  // a jade hyacinth: a tall spike of little six-point florets with white tips
  jadespike(head, c, P){ for (let i=0;i<16;i++){ const a=i*2.4, y=-0.08+i*0.017, r=0.055-i*0.002, f=new THREE.Group(); f.position.set(Math.cos(a)*r,y,Math.sin(a)*r); f.rotation.y=-a; head.add(f);
      for (let k=0;k<5;k++){ const q=quiet(mk(G.sph(0.016,6,4),M(k%2?c:P.c2),0,0,0,f)); q.position.set(0.012,Math.cos(k/5*TAU)*0.014,Math.sin(k/5*TAU)*0.014); q.scale.set(1.4,0.6,0.6); } } },
  // a rainbow pansy: five petals, each its own color, with a dark eye
  rainbow(head, c, P){ P.colors.forEach((col,i)=>{ const a=i/5*TAU, p=new THREE.Group(); p.rotation.y=a; head.add(p); const m=quiet(mk(G.sph(0.5,10,6),M(col),0,0,0.06,p)); m.scale.set(0.11,0.02,0.12); m.rotation.x=-0.35; m.position.y=0.02; });
    quiet(mk(G.sph(0.03,8,6),M(0x2a1a3a),0,0.025,0,head)); quiet(mk(G.sph(0.012,6,5),M(0xf8e060),0,0.04,0,head)); head.rotation.x=0.8; },
  // a starbell: bellflower bells with a lily's star flare at each mouth
  starbell(head, c, P){ for (let i=0;i<3;i++){ const b=new THREE.Group(); b.position.set(0.07*(i-1),-0.03-i*0.02,0.02); head.add(b); const bell=quiet(mk(G.cone(0.05,0.08,10,1,true),M(c,{side:THREE.DoubleSide}),0,0,0,b)); bell.rotation.x=Math.PI;
      for (let k=0;k<5;k++){ const a=k/5*TAU, p=quiet(mk(G.cone(0.016,0.05,5),M(P.c2),Math.cos(a)*0.045,-0.045,Math.sin(a)*0.045,b)); p.rotation.set(Math.sin(a)*2.2,0,-Math.cos(a)*2.2); } } },
  // a sunburst daisy: a marigold pompom in the middle of a ring of long flame-tipped daisy petals
  sunburst(head, c, P){ petalRing(head,14,0.16,0.045,0.12,c,0); for (let i=0;i<14;i++){ const a=i/14*TAU; quiet(mk(G.sph(0.022,6,4),M(P.c2),Math.sin(a)*0.15,0.012,Math.cos(a)*0.15,head)).scale.set(1,0.4,1); }
    quiet(mk(G.ico(0.055,1),M(P.c2),0,0.03,0,head)); for (let i=0;i<7;i++){ const a=i/7*TAU; quiet(mk(G.ico(0.026,0),M(0xf8a020),Math.cos(a)*0.045,0.025,Math.sin(a)*0.045,head)); } head.rotation.x=0.3; },
  // a peppermint poppy: a white cup with red candy stripes
  peppermint(head, c, P){ for (let i=0;i<8;i++){ const a=i/8*TAU, p=new THREE.Group(); p.rotation.y=a; head.add(p); const m=quiet(mk(G.sph(0.5,10,6),M(i%2?P.c2:c),0,0,0.07,p)); m.scale.set(0.09,0.05,0.13); m.rotation.x=-1.1; m.position.y=0.06; }
    quiet(mk(G.sph(0.03,8,6),M(0x2a3a1a),0,0.03,0,head)); for (let i=0;i<8;i++){ const a=i/8*TAU; quiet(mk(G.sph(0.008,5,4),M(0x1a1a1a),Math.cos(a)*0.035,0.04,Math.sin(a)*0.035,head)); } },
  // a lantern bloom: three glowing bulbs nodding from an arched stem, with a leafy collar. Glows brighter after dark.
  lantern(head, c, P){ const bulb=glowOnce(c), cap=M(P.c2,{roughness:0.5}), st=M(0x4f9a3a);
    for (let i=0;i<3;i++){ const a=i/3*TAU+0.4, arm=new THREE.Group(); arm.rotation.y=a; head.add(arm);
      quiet(mk(tube([[0,0,0],[0.06,0.05,0],[0.11,0.02,0],[0.12,-0.04,0]],0.008,10,4), st, 0,0,0,arm));
      const b=quiet(mk(lathe([[0.001,0],[0.03,0.012],[0.04,0.045],[0.03,0.075],[0.012,0.085],[0.001,0.086]],14), bulb, 0.12,-0.13,0,arm));
      quiet(mk(G.cone(0.03,0.025,10), cap, 0.12,-0.03,0,arm)); }
    for (let k=0;k<5;k++){ const a=k/5*TAU, l=quiet(mk(G.sph(0.04,8,4),st,Math.cos(a)*0.03,-0.01,Math.sin(a)*0.03,head)); l.scale.set(1.4,0.25,0.6); l.rotation.y=-a; } },
});
