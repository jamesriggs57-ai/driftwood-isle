// v1.13: more furniture, rare pieces and the legendary showpieces you craft from rare plans.
// Builders push per-frame callbacks into g.userData.anims (see furn.js); furniture, decor and store displays run them.
import * as THREE from 'three';
import { M, mk, G, addGlow, FURN_BUILDERS, ITEM_BUILDERS, buildItemModel, buildBird } from './models.js';
import { woodMat, fabricMat, glassMat, brass, ceramic, waterMat2, knit, felt, shellMat } from './look.js';

const TAU=Math.PI*2;
const CYL=(...a)=>new THREE.CylinderGeometry(...a);
const lathe=(pts,seg=28)=>new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)),seg);
const tube=(pts,r,seg=40,rs=8)=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),seg,r,rs,false);
const anim=(g,fn)=>{ (g.userData.anims ||= []).push(fn); };
const quiet=m=>{ m.castShadow=false; return m; };
const gold=()=>shellMat(0xe8b84a,{ metalness:0.95, roughness:0.22, clearcoat:0.6 });
const iron=()=>shellMat(0x3a3836,{ metalness:0.6, roughness:0.45, clearcoat:0.3 });
const stoneMat=c=>shellMat(c,{ roughness:0.85, clearcoat:0.05 });
// Glows by day as well as night (legendary pieces shouldn't wait for dark to look special)
const MAG=new Map();
function emis(c, k=1, o={}){ const key=c+':'+k+':'+JSON.stringify(o); if (!MAG.has(key)) MAG.set(key, new THREE.MeshStandardMaterial(Object.assign({ color:c, emissive:c, emissiveIntensity:k, roughness:0.4 }, o))); return MAG.get(key); }
const emisOwn=(c,k=1,o={})=>new THREE.MeshStandardMaterial(Object.assign({ color:c, emissive:c, emissiveIntensity:k, roughness:0.4 }, o));
function canvasTex(w,h,draw){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }

// Soft round sprite texture, white so it takes any tint
let DOT=null;
function dotTex(){ if (DOT) return DOT; DOT=canvasTex(64,64,(x)=>{ const g=x.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.35,'rgba(255,255,255,.5)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); }); return DOT; }
let STAR=null;
function starTex(){ if (STAR) return STAR; STAR=canvasTex(64,64,(x)=>{ const g=x.createRadialGradient(32,32,0,32,32,10); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64);
  x.strokeStyle='rgba(255,255,255,.9)'; x.lineWidth=2; x.beginPath(); x.moveTo(32,4); x.lineTo(32,60); x.moveTo(4,32); x.lineTo(60,32); x.stroke(); }); return STAR; }
const spriteMat=(c,op=0.6,tex=dotTex())=>new THREE.SpriteMaterial({ map:tex, color:new THREE.Color(c), transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false });
function halo(parent, y, s, c, op=0.5, x=0, z=0){ const sp=new THREE.Sprite(spriteMat(c,op)); sp.position.set(x,y,z); sp.scale.set(s,s,1); parent.add(sp); return sp; }

// Drifting motes: a few additive points that rise (or orbit) and wrap around
function motes(g, n, c, { r=0.6, y0=0.2, h=1.4, size=0.07, speed=0.25, swirl=0.6, orbit=false, x=0, z=0 }={}){
  const pos=new Float32Array(n*3), seed=[]; for (let i=0;i<n;i++) seed.push([Math.random(), Math.random()*TAU, 0.3+Math.random()*0.7]);
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const pts=new THREE.Points(geo, new THREE.PointsMaterial({ map:dotTex(), color:new THREE.Color(c), size, transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false, sizeAttenuation:true }));
  pts.position.set(x,0,z); pts.frustumCulled=false; g.add(pts);
  const step=t=>{ for (let i=0;i<n;i++){ const [k,a,rr]=seed[i]; const f=orbit ? k : (k+t*speed*rr/h)%1; const ang=a+(orbit? t*speed*(0.5+rr) : t*swirl*rr);
      const rad=orbit ? r*rr : r*rr*(0.4+0.6*Math.sin(f*Math.PI));
      pos[i*3]=Math.cos(ang)*rad; pos[i*3+1]=y0+(orbit ? h*k+Math.sin(t*1.3+a)*0.08 : f*h); pos[i*3+2]=Math.sin(ang)*rad; }
    geo.attributes.position.needsUpdate=true; pts.material.opacity=0.75+Math.sin(t*2)*0.15; };
  step(0); anim(g, step); return pts;
}

/* Rarity aura for store displays and rare things lying on the ground. Returns an update function. */
export function addAura(g, color, y=0.6, s=1.4){
  const c=new THREE.Color(color), glow=halo(g, y, s, c, 0.45), sparks=[];
  for (let i=0;i<6;i++){ const sp=new THREE.Sprite(spriteMat(c.clone().lerp(new THREE.Color(0xffffff),0.5), 0.9, starTex())); sp.scale.setScalar(0.16); g.add(sp); sparks.push({ sp, a:i/6*TAU, o:i/6 }); }
  return (t)=>{ glow.material.opacity=0.32+Math.sin(t*2.2)*0.12; const k=1+Math.sin(t*2.2)*0.06; glow.scale.set(s*k,s*k,1);
    for (const q of sparks){ const f=(t*0.35+q.o)%1, a=q.a+t*0.6; q.sp.position.set(Math.cos(a)*s*0.32, y-s*0.25+f*s*0.8, Math.sin(a)*s*0.32); q.sp.material.opacity=Math.sin(f*Math.PI)*0.95; const z=0.1+Math.sin(f*Math.PI)*0.1; q.sp.scale.set(z,z,1); } };
}

/* ======================= Rare ingredients and plans (item models) ======================= */
ITEM_BUILDERS.rare = (g, d) => {
  if (d.s==='heartwood'){
    const bark=woodMat(0x5a3626), core=emisOwn(0xd8602a, 0.7, { roughness:0.5 });
    for (const [y,z,ry,l] of [[0.16,0.08,0.1,0.72],[0.42,-0.02,-0.25,0.56]]){ const lg=new THREE.Group(); lg.position.set(0,y,z); lg.rotation.y=ry; g.add(lg);
      mk(CYL(0.15,0.16,l,16), bark, 0,0,0,lg).rotation.z=Math.PI/2;
      for (const s of [-1,1]){ const e=mk(CYL(0.135,0.135,0.012,24), core, s*l/2,0,0,lg); e.rotation.z=Math.PI/2; for (let k=0;k<3;k++){ const r=quiet(mk(G.tor(0.035+k*0.033,0.006,4,24), emis(0xffc070,1.3), s*(l/2+0.007),0,0,lg)); r.rotation.y=Math.PI/2; } } }
    anim(g,t=>{ core.emissiveIntensity=0.55+Math.sin(t*1.6)*0.25; });
  } else if (d.s==='goldsap'){
    const m=new THREE.MeshPhysicalMaterial({ color:0xffb020, emissive:0xff9000, emissiveIntensity:0.45, transmission:0, roughness:0.08, clearcoat:1, transparent:true, opacity:0.88 });
    const drop=mk(lathe([[0,0],[0.2,0.05],[0.24,0.18],[0.17,0.34],[0.06,0.48],[0,0.56]],28), m, 0,0.02,0,g);
    mk(G.sph(0.06,10,8), emis(0xfff0b0,1.4), -0.07,0.24,0.12,g).scale.set(0.6,1,0.4);
    const bug=new THREE.Group(); bug.position.set(0.02,0.18,0); g.add(bug); mk(G.cap(0.012,0.09,4,6), M(0x5a3010), 0,0,0,bug).rotation.z=Math.PI/2; for (const s of [-1,1]) mk(G.sph(0.04,8,6), M(0x7a4a20,{transparent:true,opacity:0.6}), 0,0.01,s*0.035,bug).scale.set(1.4,0.15,0.5);
    anim(g,t=>{ m.emissiveIntensity=0.35+Math.sin(t*2)*0.15; drop.scale.set(1,1+Math.sin(t*1.5)*0.02,1); });
  } else if (d.s==='starstone'){
    const st=mk(G.ico(0.24,1), new THREE.MeshPhysicalMaterial({ color:0x1e2450, roughness:0.35, metalness:0.2, clearcoat:0.9, flatShading:true }), 0,0.22,0,g); st.scale.set(1,0.85,0.9);
    const pts=[]; for (let i=0;i<14;i++){ const v=new THREE.Vector3().randomDirection().multiplyScalar(0.22); const s=quiet(mk(G.sph(0.012+(i%3)*0.006,6,4), emis(i%4?0xffffff:0x9ad8ff,2), v.x,0.22+v.y*0.85,v.z*0.9,g)); pts.push(s); }
    const glint=halo(g, 0.22, 0.9, 0x6a8aff, 0.35);
    anim(g,t=>{ pts.forEach((p,i)=>p.scale.setScalar(0.6+0.7*Math.max(0,Math.sin(t*2.5+i*1.9)))); glint.material.opacity=0.25+Math.sin(t*1.3)*0.1; });
  } else if (d.s==='moonpearl'){
    const sm=shellMat(0xf0d8e0,{roughness:0.3}).clone(); sm.side=THREE.DoubleSide; const shell=mk(lathe([[0,0],[0.18,0.015],[0.28,0.07],[0.32,0.12]],28), sm, 0,0,0,g); shell.scale.z=0.85;
    const pm=new THREE.MeshPhysicalMaterial({ color:0xf8f4ff, roughness:0.08, metalness:0.1, clearcoat:1, iridescence:1, iridescenceIOR:1.6, sheen:1, sheenColor:new THREE.Color(0xb8d0ff), emissive:0x8a9ad8, emissiveIntensity:0.2 });
    const p=mk(G.sph(0.17,32,24), pm, 0,0.2,0,g);
    const h=halo(g, 0.2, 0.8, 0xc8d8ff, 0.3);
    anim(g,t=>{ pm.emissiveIntensity=0.15+Math.sin(t*1.2)*0.1; h.material.opacity=0.2+Math.sin(t*1.2)*0.1; p.rotation.y=t*0.4; });
  } else if (d.s==='glimmermoss'){
    const base=mk(G.sph(0.24,14,10), felt(0x3a5a3a), 0,0.08,0,g); base.scale.set(1.2,0.45,1);
    const tufts=[]; for (let i=0;i<11;i++){ const a=i*2.3, r=0.06+((i*37)%10)*0.017; const t=mk(G.sph(0.06+(i%3)*0.02,10,8), emisOwn(i%2?0x5af0c8:0x8af0a0, 0.6), Math.cos(a)*r,0.15+(i%3)*0.03,Math.sin(a)*r,g); t.scale.y=0.6; tufts.push(t); }
    motes(g, 10, 0x9affd8, { r:0.25, y0:0.2, h:0.5, size:0.05, speed:0.15 });
    anim(g,t=>tufts.forEach((m,i)=>{ m.material.emissiveIntensity=0.45+0.4*Math.max(0,Math.sin(t*1.7+i)); }));
  } else if (d.s==='emerald'){   // v1.58 a six-sided green crystal still half in its grey stone, with a smaller one beside it
    const rock=mk(G.dod(0.22), stoneMat(0x8a857c), 0,0.1,0,g); rock.scale.set(1.25,0.55,1.05);
    const em=new THREE.MeshPhysicalMaterial({ color:0x1fb866, emissive:0x0c7a3a, emissiveIntensity:0.35, roughness:0.06, metalness:0.05, clearcoat:1, flatShading:true, transparent:true, opacity:0.93 });
    const gem=(x,z,h,r,tx,tz)=>{ const c=new THREE.Group(); c.position.set(x,0.12,z); c.rotation.set(tx,0,tz); g.add(c);
      mk(CYL(r,r,h,6), em, 0,h/2,0,c); mk(G.cone(r,r*1.4,6), em, 0,h+r*0.7,0,c); return c; };
    gem(0.02,0,0.34,0.09,0.08,-0.22); gem(-0.11,0.06,0.2,0.06,-0.3,0.45);
    const glints=[0,1,2].map(i=>quiet(mk(G.sph(0.016,6,4), emis(0xeaffef,2), [0.05,-0.08,0.0][i], [0.36,0.27,0.5][i], [0.06,0.09,-0.02][i], g)));
    const h=halo(g, 0.32, 0.85, 0x3aff8a, 0.3);
    anim(g,t=>{ em.emissiveIntensity=0.28+Math.sin(t*1.8)*0.12; h.material.opacity=0.22+Math.sin(t*1.8)*0.1; glints.forEach((p,i)=>p.scale.setScalar(0.5+0.9*Math.max(0,Math.sin(t*2.6+i*2.1)))); });
  }
};

// Blueprint scroll: rolled paper with a gold seal. Paper shows the piece it teaches, sketched in white.
const planTexCache={};
function planTex(of){ if (planTexCache[of]) return planTexCache[of]; return planTexCache[of]=canvasTex(256,128,(x,w,h)=>{ x.fillStyle='#2a5a9a'; x.fillRect(0,0,w,h);
  x.strokeStyle='rgba(255,255,255,.25)'; x.lineWidth=1; for (let i=0;i<w;i+=16){ x.beginPath(); x.moveTo(i,0); x.lineTo(i,h); x.stroke(); } for (let i=0;i<h;i+=16){ x.beginPath(); x.moveTo(0,i); x.lineTo(w,i); x.stroke(); }
  x.strokeStyle='#f0f6ff'; x.lineWidth=2.5; let s=of.length*7919; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
  x.beginPath(); x.arc(w/2,h/2,34,0,TAU); x.stroke(); for (let i=0;i<6;i++){ x.beginPath(); x.moveTo(30+r()*196, 15+r()*98); x.lineTo(30+r()*196, 15+r()*98); x.stroke(); }
  x.font='bold 15px sans-serif'; x.fillStyle='#f0f6ff'; x.fillText('PLAN', 12, 22); }); }
function scroll(g, of, s=1){
  const paper=new THREE.MeshStandardMaterial({ map:planTex(of||'x'), roughness:0.7 });
  const roll=mk(CYL(0.12*s,0.12*s,0.7*s,20), paper, 0,0.12*s,0,g); roll.rotation.z=Math.PI/2;
  for (const x of [-1,1]){ const e=mk(CYL(0.125*s,0.125*s,0.02*s,20), ceramic(0xeaf0f8), x*0.35*s,0.12*s,0,g); e.rotation.z=Math.PI/2; mk(CYL(0.03*s,0.03*s,0.05*s,10), woodMat(0x6a4a3a), x*0.37*s,0.12*s,0,g).rotation.z=Math.PI/2; }
  const flap=mk(G.box(0.5*s,0.005,0.22*s), paper, 0,0.005,0.16*s,g);
  mk(G.tor(0.122*s,0.014*s,6,24), M(0xc8302a), 0.12*s,0.12*s,0,g).rotation.y=Math.PI/2;
  const seal=mk(CYL(0.055*s,0.055*s,0.02*s,16), gold(), 0.12*s,0.12*s,0.13*s,g); seal.rotation.x=Math.PI/2;
  return roll;
}
ITEM_BUILDERS.plan = (g, d) => { scroll(g, d.of); };
// A plan washed up in a green glass bottle
export function buildBottle(planId){ const g=new THREE.Group(), of=(planId||'').replace('plan_','');
  const b=new THREE.Group(); b.rotation.z=Math.PI/2; b.position.y=0.2; g.add(b);
  mk(lathe([[0,-0.42],[0.19,-0.42],[0.2,-0.38],[0.2,0.12],[0.12,0.26],[0.07,0.32],[0.07,0.44],[0.085,0.46]],24), glassMat(0x6ac08a,0.45), 0,0,0,b);
  mk(CYL(0.065,0.06,0.12,12), woodMat(0xc8a070), 0,0.48,0,b);
  const sc=new THREE.Group(); sc.rotation.z=-Math.PI/2; sc.position.set(0,-0.05,0); b.add(sc); const r=scroll(sc, of, 0.6); r.position.y=0;
  return g; }

/* ======================= Furniture ======================= */
Object.assign(FURN_BUILDERS, {
  /* ---- common ---- */
  wickerbasket(g){ const wk=knit(0xc9a06a,0xa8804a,7);
    const body=mk(lathe([[0,0.02],[0.26,0.02],[0.3,0.06],[0.34,0.32],[0.36,0.36]],24), wk, 0,0,0,g); body.material.side=THREE.DoubleSide;
    mk(G.tor(0.355,0.025,6,28), woodMat(0xa8804a), 0,0.36,0,g).rotation.x=Math.PI/2;
    const h=mk(G.tor(0.3,0.02,6,24,Math.PI), woodMat(0xa8804a), 0,0.36,0,g);
    const cl=mk(G.sph(0.28,16,10), fabricMat(0xf0f0f0,'check',0xd85a4a), -0.02,0.34,0.02,g); cl.scale.set(1,0.35,0.9);
    for (const [x,z,c] of [[0.12,0.08,0xe2483d],[-0.1,-0.1,0x8ac040]]) mk(G.sph(0.08,12,10), shellMat(c), x,0.42,z,g);
    mk(G.cyl(0.012,0.012,0.05,5), M(0x6b4a2a), 0.12,0.51,0.08,g); },
  bookstack(g){ const cols=[0x2a4a8a,0xb83a3a,0x3a7a4a,0xd8a030,0x6a3a7a]; let y=0;
    cols.forEach((c,i)=>{ const h=0.07+((i*3)%3)*0.02, w=0.42-i*0.03; const b=mk(G.box(w,h,0.3-i*0.01), shellMat(c,{roughness:0.55,clearcoat:0.4}), 0,y+h/2,0,g); b.rotation.y=((i*37)%10-5)*0.05;
      mk(G.box(w-0.03,h-0.02,0.302-i*0.01), ceramic(0xf8f0e0), 0.018,y+h/2,0,g).rotation.y=b.rotation.y; mk(G.box(0.012,h+0.002,0.3-i*0.01), brass(), -w/2+0.04,y+h/2,0,g).rotation.y=b.rotation.y; y+=h; });
    const mug=mk(lathe([[0,0],[0.06,0],[0.065,0.12],[0.06,0.12],[0.055,0.01],[0,0.01]],18), ceramic(0xf0e6d4), 0.04,y,0.02,g); mk(G.tor(0.035,0.01,6,10), ceramic(0xf0e6d4), 0.11,y+0.06,0.02,g);
    const steam=[]; for (let i=0;i<3;i++) steam.push(quiet(mk(G.sph(0.018,6,4), glassMat(0xffffff,0.3), 0.04,y+0.15,0.02,g)));
    anim(g,t=>steam.forEach((s,i)=>{ const k=(t*0.4+i/3)%1; s.position.set(0.04+Math.sin(t*2+i)*0.02, y+0.13+k*0.25, 0.02); s.scale.setScalar(1+k*1.5); s.visible=k<0.9; })); },
  cactus(g){ mk(lathe([[0,0],[0.17,0],[0.2,0.24],[0.22,0.26],[0.22,0.3],[0.19,0.3],[0.18,0.27],[0,0.27]],22), ceramic(0xc8704a), 0,0,0,g); mk(CYL(0.18,0.18,0.02,18), felt(0x5a3a24), 0,0.27,0,g);
    const C=shellMat(0x4f9a4a,{roughness:0.5}); const body=mk(G.cap(0.11,0.42,8,14), C, 0,0.6,0,g);
    for (const s of [-1,1]){ const arm=new THREE.Group(); arm.position.set(s*0.1,0.55+(s>0?0.05:-0.05),0); g.add(arm); mk(G.cap(0.06,0.1,6,10), C, s*0.07,0,0,arm).rotation.z=Math.PI/2; mk(G.cap(0.06,0.14,6,10), C, s*0.13,0.1,0,arm); }
    for (let i=0;i<18;i++){ const a=i*2.4, y=0.4+((i*7)%10)*0.045; const sp=mk(G.cone(0.006,0.04,4), M(0xfff8e0), Math.cos(a)*0.115,y,Math.sin(a)*0.115,g); sp.rotation.set(Math.sin(a)*Math.PI/2,0,-Math.cos(a)*Math.PI/2); sp.castShadow=false; }
    const fl=new THREE.Group(); fl.position.y=0.92; g.add(fl); for (let k=0;k<6;k++){ const p=mk(G.sph(0.035,8,6), ceramic(0xff7aa8), Math.cos(k/6*TAU)*0.035,0,Math.sin(k/6*TAU)*0.035,fl); p.scale.set(1,0.45,1); } mk(G.sph(0.02,8,6), ceramic(0xf8d040), 0,0.012,0,fl);
    anim(g,t=>{ fl.rotation.y=t*0.3; }); },
  ottoman(g){ const k=knit(0x7ab0d8,0xf8f4ec,8); const b=mk(G.sph(0.45,24,16), k, 0,0.26,0,g); b.scale.set(1,0.58,1); mk(CYL(0.44,0.44,0.16,24), k, 0,0.2,0,g);
    mk(G.sph(0.035,10,8), ceramic(0xf8f4ec), 0,0.52,0,g); },
  sidetable(g){ const W=woodMat(0xa8754a); mk(CYL(0.36,0.36,0.05,28), W, 0,0.62,0,g); mk(CYL(0.37,0.37,0.02,28), woodMat(0x6a4a3a), 0,0.595,0,g);
    for (let i=0;i<3;i++){ const a=i/3*TAU; const l=mk(CYL(0.025,0.018,0.62,8), W, Math.cos(a)*0.24,0.31,Math.sin(a)*0.24,g); l.rotation.set(Math.sin(a)*0.12,0,-Math.cos(a)*0.12); }
    mk(CYL(0.24,0.24,0.03,24), W, 0,0.2,0,g); for (let i=0;i<3;i++) mk(G.box(0.2,0.04,0.14), shellMat([0x2a4a8a,0xb83a3a,0xd8a030][i],{roughness:0.5}), 0,0.24+i*0.04,0,g).rotation.y=i*0.3;
    const cup=mk(lathe([[0,0],[0.045,0],[0.06,0.07],[0.062,0.075]],16), ceramic(0xfff8ee), 0.12,0.645,0.05,g); mk(CYL(0.09,0.08,0.012,18), ceramic(0xfff8ee), 0.12,0.645,0.05,g);
    mk(G.box(0.16,0.02,0.22), ceramic(0xf8f0e0), -0.1,0.655,-0.06,g).rotation.y=0.3; },
  tulipvase(g){ mk(lathe([[0,0],[0.09,0],[0.13,0.08],[0.12,0.22],[0.07,0.32],[0.08,0.36]],24), glassMat(0x9ad8f0,0.45), 0,0,0,g);
    const water=mk(lathe([[0,0.01],[0.085,0.01],[0.12,0.08],[0.115,0.18],[0,0.18]],20), waterMat2(0xa8e0f0), 0,0,0,g); water.castShadow=false;
    const cols=[0xf04a6a,0xf7c948,0xffffff,0xf08ad8,0xe86a2a], stems=[];
    for (let i=0;i<5;i++){ const a=i/5*TAU, lean=0.18; const st=new THREE.Group(); st.position.set(0,0.1,0); st.rotation.set(Math.sin(a)*lean,0,-Math.cos(a)*lean); g.add(st);
      mk(G.cyl(0.008,0.008,0.5,4), M(0x4f8a3a), 0,0.25,0,st); const b=mk(lathe([[0,0],[0.04,0.01],[0.05,0.06],[0.035,0.11]],12), ceramic(cols[i]), 0,0.5,0,st); b.material.side=THREE.DoubleSide;
      const l=mk(G.sph(0.05,8,4), shellMat(0x5fae43,{roughness:0.6}), 0.02,0.22,0,st); l.scale.set(0.4,1.6,0.2); stems.push(st); }
    anim(g,t=>stems.forEach((s,i)=>{ s.rotation.y=Math.sin(t*0.7+i)*0.05; })); },

  /* ---- uncommon ---- */
  rocker(g){ const p=new THREE.Group(); g.add(p); const W=woodMat(0x8b5e3a);
    for (const s of [-1,1]){ const run=mk(G.tor(1.0,0.03,6,24,0.9), W, s*0.28,1.02,0,p); run.rotation.set(0,Math.PI/2,0); run.rotation.order='YXZ'; run.rotation.z=Math.PI*1.5-0.45; }
    for (const [x,z] of [[-0.26,0.22],[0.26,0.22],[-0.26,-0.24],[0.26,-0.24]]) mk(CYL(0.025,0.025,0.42,8), W, x,0.25,z,p);
    mk(G.box(0.62,0.05,0.56), W, 0,0.46,0,p); const cu=mk(G.box(0.56,0.07,0.5), fabricMat(0xc86a5a,'check',0xf0d8c0), 0,0.52,0.02,p);
    const back=new THREE.Group(); back.position.set(0,0.48,-0.26); back.rotation.x=-0.18; p.add(back);
    for (const x of [-0.28,0.28]) mk(CYL(0.025,0.025,0.85,8), W, x,0.42,0,back); mk(G.box(0.62,0.08,0.04), W, 0,0.85,0,back); for (let i=-2;i<=2;i++) mk(CYL(0.012,0.012,0.6,6), W, i*0.1,0.5,0,back);
    for (const s of [-1,1]){ mk(G.box(0.05,0.04,0.5), W, s*0.3,0.72,0.02,p); mk(CYL(0.02,0.02,0.24,6), W, s*0.3,0.6,0.22,p); }
    anim(g,t=>{ p.rotation.x=Math.sin(t*1.1)*0.09; }); },
  gramophone(g){ const W=woodMat(0x6a4a3a); mk(G.box(0.56,0.24,0.5), W, 0,0.12,0,g); mk(G.box(0.6,0.03,0.54), brass(), 0,0.25,0,g); mk(G.box(0.2,0.08,0.01), brass(), 0,0.12,0.255,g);
    const plat=new THREE.Group(); plat.position.set(-0.04,0.27,0.02); g.add(plat); mk(CYL(0.21,0.21,0.02,32), M(0x161414,{roughness:0.25}), 0,0.01,0,plat);
    for (let i=1;i<6;i++) mk(G.tor(0.04+i*0.03,0.002,3,32), M(0x2a2828), 0,0.021,0,plat).rotation.x=Math.PI/2; mk(CYL(0.06,0.06,0.022,20), ceramic(0xd84a3a), 0,0.012,0,plat);
    const arm=mk(tube([[0.22,0.27,-0.18],[0.22,0.42,-0.18],[0.18,0.52,-0.12],[0.1,0.58,-0.02]],0.02,20,8), brass(), 0,0,0,g);
    const horn=mk(lathe([[0.02,0],[0.03,0.12],[0.06,0.3],[0.14,0.48],[0.3,0.62],[0.34,0.64]],32), brass(), 0,0,0,g); horn.material=horn.material.clone(); horn.material.side=THREE.DoubleSide; horn.position.set(0.1,0.58,-0.02); horn.rotation.set(-0.5,0,-0.9);
    mk(G.tor(0.335,0.012,6,32), brass(), 0,0,0,horn).position.y=0.64; horn.children[0].rotation.x=Math.PI/2;
    const notes=[]; for (let i=0;i<3;i++){ const n=new THREE.Group(); g.add(n); mk(G.sph(0.03,8,6), M(0x2a2420), 0,0,0,n).scale.set(1.2,0.9,0.6); mk(G.box(0.008,0.1,0.008), M(0x2a2420), 0.03,0.05,0,n); notes.push(n); }
    anim(g,(t,dt)=>{ plat.rotation.y-=dt*3.5; notes.forEach((n,i)=>{ const k=(t*0.3+i/3)%1; n.position.set(0.55+Math.sin(t*2+i*2)*0.1+k*0.2, 0.95+k*0.7, -0.15); n.scale.setScalar(Math.sin(k*Math.PI)); n.rotation.z=Math.sin(t*3+i)*0.3; }); }); },
  hammock(g){ const W=woodMat(0x8b5e3a); for (const x of [-1.15,1.15]){ mk(CYL(0.06,0.07,1.5,10), W, x,0.75,0,g); mk(G.box(0.2,0.06,0.5), W, x,0.03,0,g); mk(G.sph(0.08,10,8), W, x,1.52,0,g); }
    mk(G.box(2.4,0.06,0.08), W, 0,0.05,0,g);
    const sw=new THREE.Group(); sw.position.y=1.3; g.add(sw);
    const pg=new THREE.PlaneGeometry(1.7,0.8,24,6); pg.rotateX(-Math.PI/2); const pp=pg.attributes.position; for (let i=0;i<pp.count;i++){ const x=pp.getX(i)/0.85, z=pp.getZ(i)/0.4; pp.setY(i, -0.62*(1-x*x)+0.08*(1-z*z)*(1-x*x)); } pg.computeVertexNormals();
    const fab=fabricMat(0xf0c040,'stripe',0xf8f4ec); const cm=fab.clone(); cm.side=THREE.DoubleSide; mk(pg, cm, 0,-0.05,0,sw);
    for (const s of [-1,1]) for (let k=-2;k<=2;k++){ const r=mk(tube([[s*1.12,0.1,0],[s*0.85,-0.05,k*0.19]],0.006,4,3), M(0xf8f0e0), 0,0,0,sw); r.castShadow=false; }
    const pil=mk(G.sph(0.17,14,10), fabricMat(0xf8f4ec,'check',0x7ab0d8), -0.58,-0.42,0,sw); pil.scale.set(1.2,0.5,1.4);
    const bk=mk(G.box(0.24,0.06,0.18), shellMat(0xb83a3a,{roughness:0.5}), 0.2,-0.6,0.05,sw); bk.rotation.set(0,0.4,0.05);
    anim(g,t=>{ sw.rotation.x=Math.sin(t*0.9)*0.06; }); },
  easel(g){ const W=woodMat(0xa8754a);
    for (const [x,z,rx,rz] of [[-0.3,0.12,0.1,0.14],[0.3,0.12,0.1,-0.14],[0,-0.32,-0.35,0]]){ const l=mk(G.box(0.05,1.7,0.04), W, x,0.82,z,g); l.rotation.set(rx,0,rz); }
    mk(G.box(0.72,0.04,0.12), W, 0,0.62,0.2,g); mk(G.box(0.72,0.02,0.02), W, 0,0.65,0.26,g);
    const tex=canvasTex(256,192,(x,w,h)=>{ const s=x.createLinearGradient(0,0,0,h*0.6); s.addColorStop(0,'#f6b48a'); s.addColorStop(1,'#fce0b0'); x.fillStyle=s; x.fillRect(0,0,w,h);
      x.fillStyle='#ffe890'; x.beginPath(); x.arc(170,90,26,0,TAU); x.fill(); x.fillStyle='#4a8ac8'; x.fillRect(0,110,w,h-110); x.fillStyle='#7ab8e0'; for (let i=0;i<6;i++) x.fillRect(20+i*40,120+(i%2)*14,26,3);
      x.fillStyle='#e8d090'; x.beginPath(); x.ellipse(70,118,60,14,0,0,TAU); x.fill(); x.fillStyle='#4f9a3a'; x.beginPath(); x.ellipse(70,108,40,18,0,Math.PI,TAU); x.fill();
      x.strokeStyle='#6a4a3a'; x.lineWidth=4; x.beginPath(); x.moveTo(82,110); x.quadraticCurveTo(86,80,80,62); x.stroke(); x.fillStyle='#3a8a3a'; for (let i=0;i<5;i++){ x.beginPath(); x.ellipse(80+Math.cos(i*1.3)*16,60+Math.sin(i*1.3)*6,16,5,i*1.3,0,TAU); x.fill(); } });
    mk(G.box(0.7,0.54,0.025), woodMat(0x6a4a3a), 0,0.94,0.21,g).rotation.x=0.1; const cv=mk(G.box(0.64,0.48,0.03), new THREE.MeshStandardMaterial({ map:tex, roughness:0.8 }), 0,0.94,0.225,g); cv.rotation.x=0.1;
    const pal=mk(CYL(0.13,0.13,0.012,20), woodMat(0xc99a6a), 0.25,0.66,0.24,g); pal.scale.z=0.75; [0xe2483d,0xf7c948,0x4a8ac8,0xffffff,0x4f9a3a].forEach((c,i)=>mk(G.sph(0.018,8,6), ceramic(c), 0.2+(i%3)*0.05,0.672,0.2+Math.floor(i/3)*0.06,g).scale.y=0.4);
    const br=mk(CYL(0.008,0.006,0.2,6), woodMat(0x6a4a3a), -0.18,0.67,0.24,g); br.rotation.z=Math.PI/2.3; mk(G.cone(0.012,0.04,6), ceramic(0x4a8ac8), -0.27,0.705,0.24,g).rotation.z=Math.PI/2.3; },
  birdfeeder(g){ const W=woodMat(0x8b5e3a); mk(CYL(0.04,0.05,1.3,10), W, 0,0.65,0,g); mk(CYL(0.2,0.25,0.06,14), W, 0,0.03,0,g);
    mk(G.box(0.62,0.04,0.42), W, 0,1.3,0,g); for (const [x,z] of [[0.29,0.19],[-0.29,0.19],[0.29,-0.19],[-0.29,-0.19]]) mk(CYL(0.012,0.012,0.3,6), W, x,1.47,z,g);
    for (const s of [-1,1]){ const r=mk(G.box(0.72,0.03,0.3), woodMat(0xc8604a), 0,1.69,s*0.12,g); r.rotation.x=s*0.6; }
    mk(G.box(0.58,0.02,0.04), W, 0,1.33,0.2,g); mk(G.box(0.58,0.02,0.04), W, 0,1.33,-0.2,g);
    for (let i=0;i<40;i++) mk(G.sph(0.012,4,3), M([0xe8d8a0,0x6a5030,0xc8a060][i%3]), -0.26+((i*0.37)%1)*0.52, 1.33, -0.16+((i*0.61)%1)*0.32, g).castShadow=false;
    const bird=buildBird(0x5a8ad8); bird.scale.setScalar(0.8); bird.position.set(0,1.32,0); g.add(bird);
    anim(g,t=>{ const ph=t*0.5, k=Math.floor(ph)%4; const tx=[-0.18,0.1,0.2,-0.05][k]; const f=ph%1; bird.position.x+= (tx-bird.position.x)*0.06; bird.position.y=1.32+(f<0.15?Math.sin(f/0.15*Math.PI)*0.06:0); bird.rotation.x=f>0.3&&f<0.8?Math.max(0,Math.sin((f-0.3)*TAU*3))*0.5:0; bird.rotation.y=k%2?0.8:-0.8; }); },

  /* ---- rare ---- */
  shipbottle(g){ const W=woodMat(0x6a4a3a); for (const x of [-0.24,0.24]){ const c=mk(CYL(0.16,0.16,0.06,20,1,false,Math.PI*0.5,Math.PI), W, x,0.16,0,g); c.rotation.set(0,0,Math.PI/2); c.rotation.order='ZXY'; c.rotation.x=Math.PI; mk(G.box(0.08,0.1,0.34), W, x,0.05,0,g); }
    mk(G.box(0.7,0.04,0.36), W, 0,0.02,0,g); mk(G.box(0.24,0.06,0.01), brass(), 0,0.06,0.18,g);
    const b=new THREE.Group(); b.rotation.z=Math.PI/2; b.position.y=0.3; g.add(b);
    mk(lathe([[0,-0.45],[0.18,-0.45],[0.19,-0.42],[0.19,0.15],[0.12,0.27],[0.06,0.33],[0.06,0.44],[0.075,0.46]],28), glassMat(0xd8f8f0,0.25), 0,0,0,b); mk(CYL(0.058,0.052,0.11,12), woodMat(0xc8a070), 0,0.49,0,b);
    mk(G.box(0.8,0.05,0.26), shellMat(0x2a6ab0,{roughness:0.3}), -0.04,0.15,0,g); for (let i=0;i<9;i++) quiet(mk(G.sph(0.03,8,5), ceramic(0xeaf6ff), -0.38+i*0.085,0.175,((i*37)%10-5)*0.02,g)).scale.set(1.6,0.4,1);
    const ship=new THREE.Group(); g.add(ship); ship.position.set(-0.04,0.2,0); ship.scale.setScalar(0.85);
    const hull=mk(G.sph(0.14,16,8,0,TAU,0,Math.PI/2), woodMat(0x8b3a2a), 0,0.03,0,ship); hull.scale.set(1.6,0.6,0.55); hull.rotation.x=Math.PI; mk(G.box(0.4,0.012,0.13), woodMat(0xc8a070), 0,0.03,0,ship);
    for (const [x,h] of [[-0.12,0.2],[0.02,0.26],[0.15,0.18]]){ mk(CYL(0.005,0.005,h,4), woodMat(0x6a4a3a), x,0.03+h/2,0,ship); for (let k=0;k<2;k++){ const sl=mk(G.box(0.008,h*0.34,0.11-k*0.02), ceramic(0xfff8ee), x+0.012,0.07+k*h*0.38,0,ship); sl.scale.x=1; } }
    mk(G.box(0.03,0.02,0.002), ceramic(0xd84a3a), 0.02,0.3,0,ship);
    anim(g,t=>{ ship.position.y=0.2+Math.sin(t*1.4)*0.01; ship.rotation.x=Math.sin(t*1.1)*0.05; ship.rotation.z=Math.sin(t*0.9)*0.04; }); },
  orrery(g){ const B=brass(); mk(CYL(0.3,0.34,0.06,32), woodMat(0x4a3a30), 0,0.03,0,g); mk(G.tor(0.32,0.015,6,32), B, 0,0.06,0,g).rotation.x=Math.PI/2;
    for (let i=0;i<3;i++){ const a=i/3*TAU; const l=mk(tube([[Math.cos(a)*0.28,0.06,Math.sin(a)*0.28],[Math.cos(a)*0.2,0.3,Math.sin(a)*0.2],[0,0.5,0]],0.014,16,6), B, 0,0,0,g); }
    mk(CYL(0.02,0.02,0.45,8), B, 0,0.72,0,g); const sun=mk(G.sph(0.11,24,18), emis(0xffb040,1.1), 0,0.95,0,g); const sg=halo(g, 0.95, 0.7, 0xffb040, 0.45);
    const P=[[0.2,0.025,0xc8a080,2.2],[0.3,0.04,0x5a9ad8,1.4],[0.42,0.035,0xd85a3a,0.9],[0.56,0.06,0xe8c890,0.5,true],[0.68,0.045,0x6ac8d8,0.3]], arms=[];
    P.forEach(([r,s,c,sp,ring],i)=>{ const a=new THREE.Group(); a.position.y=0.95-0.06-i*0.025; g.add(a); mk(CYL(0.006,0.006,0.06+i*0.025,4), B, 0,0.03+i*0.012,0,a); mk(G.box(r,0.008,0.008), B, r/2,0,0,a); mk(CYL(0.005,0.005,0.08+i*0.025,4), B, r,0.04+i*0.0125,0,a);
      const pl=mk(G.sph(s,18,14), shellMat(c,{roughness:0.4}), r,0.08+i*0.025,0,a); if (ring){ const rg=mk(G.tor(s*1.7,s*0.18,4,28), shellMat(0xf0d8a0), r,0.08+i*0.025,0,a); rg.rotation.x=1.2; rg.scale.z=0.2; }
      if (i===1){ const m=new THREE.Group(); m.position.set(r,0.08+i*0.025,0); a.add(m); mk(G.sph(0.012,8,6), ceramic(0xf0f0f0), 0.07,0,0,m); a.userData.moon=m; }
      arms.push([a,sp]); });
    anim(g,(t,dt)=>{ for (const [a,sp] of arms){ a.rotation.y+=dt*sp*0.5; if (a.userData.moon) a.userData.moon.rotation.y+=dt*3; } sg.material.opacity=0.35+Math.sin(t*2)*0.1; }); },
  musicbox(g){ const G1=gold(); mk(CYL(0.34,0.38,0.12,32), woodMat(0x6a2a3a), 0,0.06,0,g); mk(G.tor(0.36,0.02,6,32), G1, 0,0.12,0,g).rotation.x=Math.PI/2; mk(G.tor(0.38,0.015,6,32), G1, 0,0.01,0,g).rotation.x=Math.PI/2;
    const rot=new THREE.Group(); rot.position.y=0.12; g.add(rot); mk(CYL(0.31,0.31,0.02,32), ceramic(0xf8f0e0), 0,0.01,0,rot);
    mk(CYL(0.03,0.03,0.6,12), G1, 0,0.3,0,rot);
    const can=mk(G.cone(0.38,0.18,24), fabricMat(0xd84a5a,'stripe',0xfff4e4), 0,0.68,0,rot); mk(G.sph(0.04,12,10), G1, 0,0.8,0,rot);
    for (let i=0;i<16;i++){ const a=i/16*TAU; mk(G.sph(0.05,10,6,0,TAU,0,Math.PI/2), fabricMat(i%2?0xd84a5a:0xfff4e4), Math.cos(a)*0.36,0.6,Math.sin(a)*0.36,rot).rotation.x=Math.PI; quiet(mk(G.sph(0.014,6,5), emis(0xfff0b0,1.4), Math.cos(a+0.2)*0.36,0.58,Math.sin(a+0.2)*0.36,rot)); }
    const horses=[]; const cols=[0xfff8ee,0xf0c8d8,0xc8d8f0,0xf8e0a0];
    for (let i=0;i<4;i++){ const a=i/4*TAU, h=new THREE.Group(); h.position.set(Math.cos(a)*0.22,0.25,Math.sin(a)*0.22); h.rotation.y=-a; rot.add(h); const c=ceramic(cols[i]);
      mk(CYL(0.006,0.006,0.5,4), G1, 0,0.08,0,h); mk(G.cap(0.035,0.08,6,10), c, 0,0,0,h).rotation.x=Math.PI/2; const nk=mk(G.cap(0.022,0.05,4,8), c, 0,0.05,0.06,h); nk.rotation.x=0.5; mk(G.sph(0.03,10,8), c, 0,0.09,0.085,h).scale.set(0.8,0.8,1.3);
      for (const [x,z] of [[0.025,0.04],[-0.025,0.04],[0.025,-0.04],[-0.025,-0.04]]){ const l=mk(CYL(0.009,0.007,0.07,5), c, x,-0.05,z,h); l.rotation.x=z>0?0.5:-0.5; }
      mk(G.cap(0.012,0.05,4,6), ceramic(0xd8a040), 0,0.02,-0.07,h).rotation.x=-0.8; mk(G.box(0.07,0.01,0.05), ceramic(0xd84a5a), 0,0.035,0,h); horses.push(h); }
    anim(g,(t,dt)=>{ rot.rotation.y+=dt*0.6; horses.forEach((h,i)=>{ h.position.y=0.25+Math.sin(t*2.2+i*Math.PI/2)*0.05; }); }); },
  tiffany(g){ const B=brass(); mk(lathe([[0,0],[0.16,0],[0.17,0.03],[0.08,0.08],[0.04,0.12],[0,0.12]],24), B, 0,0,0,g); mk(CYL(0.018,0.022,1.1,10), B, 0,0.65,0,g); for (let i=0;i<3;i++) mk(G.tor(0.03,0.01,6,12), B, 0,0.3+i*0.3,0,g).rotation.x=Math.PI/2;
    const tex=canvasTex(512,128,(x,w,h)=>{ x.fillStyle='#2a2018'; x.fillRect(0,0,w,h); const cols=['#e86a2a','#f7c948','#4f9a3a','#2f7fc0','#c84a8a','#8ac040','#f0a040'];
      let s=11; const r=()=>{ s=(s*16807)%2147483647; return s/2147483647; };
      for (let row=0;row<4;row++) for (let i=0;i<16;i++){ x.fillStyle=cols[Math.floor(r()*cols.length)]; const px=i*32+(row%2)*16, py=row*32; x.beginPath(); x.moveTo(px+3,py+3); x.lineTo(px+29,py+3); x.lineTo(px+26,py+29); x.lineTo(px+6,py+29); x.closePath(); x.fill(); }
      x.fillStyle='#d84a3a'; for (let i=0;i<8;i++){ x.beginPath(); x.arc(32+i*64,100,10,0,TAU); x.fill(); } });
    const mat=new THREE.MeshStandardMaterial({ map:tex, emissiveMap:tex, emissive:0xffffff, emissiveIntensity:0.35, roughness:0.3, side:THREE.DoubleSide });
    const shade=mk(G.sph(0.42,32,12,0,TAU,0,Math.PI*0.42), mat, 0,1.1,0,g); shade.scale.y=0.8;
    mk(G.tor(0.39,0.012,6,32), B, 0,1.1+0.42*Math.cos(Math.PI*0.42)*0.8-0.005,0,g).rotation.x=Math.PI/2;
    mk(G.sph(0.03,10,8), B, 0,1.45,0,g); const bulb=mk(G.sph(0.07,12,10), emis(0xfff0c0,1.2), 0,1.2,0,g); addGlow(g,1.25,2.4,0xffc890);
    anim(g,t=>{ mat.emissiveIntensity=0.3+Math.sin(t*0.8)*0.05; }); },

  /* ---- very rare ---- */
  crystalball(g){ const G1=gold(); mk(CYL(0.24,0.3,0.08,28), woodMat(0x3a2030), 0,0.04,0,g); mk(G.tor(0.27,0.014,6,28), G1, 0,0.08,0,g).rotation.x=Math.PI/2;
    for (let i=0;i<3;i++){ const a=i/3*TAU; mk(tube([[Math.cos(a)*0.22,0.08,Math.sin(a)*0.22],[Math.cos(a)*0.26,0.22,Math.sin(a)*0.26],[Math.cos(a)*0.18,0.36,Math.sin(a)*0.18],[Math.cos(a)*0.12,0.4,Math.sin(a)*0.12]],0.018,16,6), G1, 0,0,0,g); mk(G.sph(0.03,10,8), shellMat(0x8a2ad8), Math.cos(a)*0.26,0.2,Math.sin(a)*0.26,g); }
    const ball=mk(G.sph(0.28,40,30), new THREE.MeshPhysicalMaterial({ color:0xe8e0ff, transparent:true, opacity:0.28, roughness:0.02, clearcoat:1, iridescence:0.6, depthWrite:false }), 0,0.66,0,g); ball.castShadow=false;
    const mist=[]; for (let i=0;i<5;i++){ const m=quiet(mk(G.sph(0.09+i*0.015,16,12), new THREE.MeshBasicMaterial({ color:[0x6a2ad0,0x2a70d8,0xa02ad0,0x2ab8b0,0x7a50e0][i], transparent:true, opacity:0.3, depthWrite:false }), 0,0.66,0,g)); mist.push(m); }
    const core=halo(g, 0.66, 0.6, 0x9a7aff, 0.35); halo(g, 0.66, 1.8, 0x6a4aff, 0.12);
    motes(g, 18, 0xd8c8ff, { r:0.2, y0:0.5, h:0.32, size:0.035, speed:0.6, orbit:true });
    anim(g,t=>{ mist.forEach((m,i)=>{ const a=t*(0.6+i*0.17)+i*1.3; m.position.set(Math.cos(a)*0.09, 0.66+Math.sin(a*1.4)*0.08, Math.sin(a)*0.09); const s=1+Math.sin(t*1.1+i)*0.25; m.scale.set(s,s*0.8,s); });
      core.material.opacity=0.28+Math.sin(t*1.7)*0.12; }); },
  harp(g){ const G1=gold(); mk(G.box(0.5,0.08,0.34), G1, 0,0.04,0,g); for (const [x,z] of [[0.2,0.13],[-0.2,0.13],[0.2,-0.13],[-0.2,-0.13]]) mk(G.sph(0.045,10,8), G1, x,0.02,z,g);
    mk(lathe([[0.05,0],[0.06,0.05],[0.045,0.15],[0.04,1.2],[0.055,1.25],[0.07,1.32],[0.05,1.4],[0,1.42]],16), G1, -0.2,0.08,0,g);
    for (let i=0;i<4;i++) mk(G.tor(0.05,0.012,6,12), G1, -0.2,0.3+i*0.28,0,g).rotation.x=Math.PI/2;
    const sb=mk(G.box(0.1,1.1,0.16), woodMat(0xc89a5a), 0.16,0.62,0,g); sb.rotation.z=0.42; mk(G.box(0.02,1.1,0.17), G1, 0.21,0.62,0,g).rotation.z=0.42;
    const neck=[[-0.2,1.48,0],[0.0,1.42,0],[0.18,1.5,0],[0.36,1.3,0],[0.44,1.1,0]]; mk(tube(neck,0.04,40,10), G1, 0,0,0,g);
    mk(G.sph(0.06,12,10), G1, 0.46,1.06,0,g);
    const curve=new THREE.CatmullRomCurve3(neck.map(p=>new THREE.Vector3(...p))), strings=[];
    for (let i=0;i<13;i++){ const k=0.06+i*0.065; const top=curve.getPoint(Math.min(0.97,k*0.92+0.04)); const bx=-0.14+(i/12)*0.5, by=0.18+(i/12)*0.5*Math.tan(0.42)+0.02; const len=Math.hypot(top.x-bx, top.y-by);
      const s=mk(CYL(0.004,0.004,len,4), M(i%7===0?0xd84a3a:i%7===3?0x2a4a8a:0xfff4d8,{roughness:0.3}), (top.x+bx)/2,(top.y+by)/2,0,g); s.rotation.z=Math.atan2(-(top.x-bx), top.y-by); s.castShadow=false; strings.push(s); }
    const sh=halo(g, 0.9, 1.6, 0xffe090, 0.18); motes(g, 8, 0xfff0b0, { r:0.3, y0:0.4, h:1.0, size:0.05, speed:0.2 });
    anim(g,t=>{ strings.forEach((s,i)=>{ const v=Math.max(0,Math.sin(t*0.8-i*0.5)); s.scale.x=1+v*v*1.8; }); sh.material.opacity=0.14+Math.sin(t)*0.05; }); },
  beaconlamp(g){ const red=ceramic(0xd84a3a), wht=ceramic(0xfaf6ee);
    mk(CYL(0.3,0.34,0.1,24), stoneMat(0x8a8a90), 0,0.05,0,g);
    for (let i=0;i<4;i++){ const r0=0.24-i*0.025, r1=0.24-(i+1)*0.025; mk(CYL(r1,r0,0.25,24), i%2?wht:red, 0,0.22+i*0.25,0,g); }
    mk(CYL(0.22,0.22,0.03,24), M(0x2a2a30,{metalness:0.6,roughness:0.4}), 0,1.11,0,g);
    for (let i=0;i<14;i++){ const a=i/14*TAU; mk(CYL(0.006,0.006,0.1,4), M(0x2a2a30), Math.cos(a)*0.2,1.17,Math.sin(a)*0.2,g); } mk(G.tor(0.2,0.008,4,28), M(0x2a2a30), 0,1.22,0,g).rotation.x=Math.PI/2;
    mk(CYL(0.12,0.12,0.24,16), glassMat(0xfff8d0,0.35), 0,1.25,0,g); for (let i=0;i<5;i++) quiet(mk(G.tor(0.105,0.006,4,20), glassMat(0xffffff,0.5), 0,1.16+i*0.045,0,g)).rotation.x=Math.PI/2;
    const lamp=mk(G.sph(0.06,14,10), emis(0xfff4c0,2), 0,1.25,0,g); mk(G.cone(0.15,0.14,16), red, 0,1.44,0,g); mk(G.sph(0.025,8,6), brass(), 0,1.52,0,g);
    const beam=new THREE.Group(); beam.position.y=1.25; g.add(beam); const bm=new THREE.MeshBasicMaterial({ color:0xfff0b0, transparent:true, opacity:0.09, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide });
    for (const s of [-1,1]){ const c=quiet(mk(new THREE.ConeGeometry(0.2,1.2,20,1,true), bm, s*0.65,0,0,beam)); c.rotation.z=s*Math.PI/2; }
    halo(g, 1.25, 0.8, 0xfff0b0, 0.6); addGlow(g,1.25,3.2,0xfff0c0);
    anim(g,(t,dt)=>{ beam.rotation.y+=dt*1.1; }); },
  birdcage(g){ const G1=gold(); mk(CYL(0.14,0.2,0.05,20), G1, 0,0.03,0,g); mk(lathe([[0.03,0],[0.03,0.9],[0.05,0.95],[0.03,1.0]],12), G1, 0,0.05,0,g);
    const cage=new THREE.Group(); cage.position.y=1.05; g.add(cage); mk(CYL(0.3,0.3,0.04,28), G1, 0,0,0,cage);
    for (let i=0;i<20;i++){ const a=i/20*TAU; const pts=[]; for (let k=0;k<=10;k++){ const q=k/10*Math.PI/2; pts.push([Math.cos(a)*0.3*Math.cos(q), 0.42*Math.sin(q)+ (k<4?0:0)+0.0+ (k===0?0:0), Math.sin(a)*0.3*Math.cos(q)]); }
      pts.forEach((p,k)=>{ if (k<=3) p[1]=k*0.1; else p[1]=0.3+0.3*Math.sin((k-3)/7*Math.PI/2); p[0]=Math.cos(a)*0.3*(k<=3?1:Math.cos((k-3)/7*Math.PI/2)); p[2]=Math.sin(a)*0.3*(k<=3?1:Math.cos((k-3)/7*Math.PI/2)); });
      quiet(mk(tube(pts,0.005,12,3), G1, 0,0,0,cage)); }
    for (const y of [0.15,0.3]) mk(G.tor(0.3,0.008,4,32), G1, 0,y,0,cage).rotation.x=Math.PI/2; mk(G.sph(0.04,10,8), G1, 0,0.62,0,cage); mk(G.tor(0.05,0.008,4,12), G1, 0,0.68,0,cage);
    const sw=new THREE.Group(); sw.position.y=0.5; cage.add(sw); for (const x of [-0.08,0.08]) quiet(mk(CYL(0.003,0.003,0.32,3), G1, x,-0.16,0,sw)); mk(CYL(0.008,0.008,0.18,6), woodMat(0x8b5e3a), 0,-0.32,0,sw).rotation.z=Math.PI/2;
    const bird=buildBird(0xf8d040); bird.scale.setScalar(0.65); bird.position.set(0,-0.32,0); sw.add(bird);
    for (let i=0;i<7;i++){ const a=i/7*TAU; mk(G.sph(0.035,8,6), ceramic([0xff8aa8,0xffffff,0xf7c948][i%3]), Math.cos(a)*0.31,0.02,Math.sin(a)*0.31,cage); mk(G.sph(0.03,6,4), shellMat(0x5fae43), Math.cos(a+0.2)*0.31,0.0,Math.sin(a+0.2)*0.31,cage).scale.set(1.4,0.5,0.8); }
    const notes=[]; for (let i=0;i<2;i++){ const n=new THREE.Group(); g.add(n); mk(G.sph(0.025,8,6), M(0x3a2a20), 0,0,0,n).scale.set(1.2,0.9,0.6); mk(G.box(0.006,0.08,0.006), M(0x3a2a20), 0.025,0.04,0,n); notes.push(n); }
    anim(g,t=>{ sw.rotation.z=Math.sin(t*1.3)*0.25; bird.rotation.x=Math.sin(t*6)>0.7?-0.3:0; notes.forEach((n,i)=>{ const k=(t*0.35+i/2)%1; n.position.set(0.25+k*0.25, 1.4+k*0.5, 0.1); n.scale.setScalar(Math.sin(k*Math.PI)); }); }); },

  /* ---- legendary: crafted from rare plans ---- */
  lanterntree(g){ const hw=woodMat(0x7a3a22); const vein=emisOwn(0xff8a3a, 0.8);
    mk(G.sph(0.55,18,10,0,TAU,0,Math.PI/2), felt(0x3a5a3a), 0,0,0,g).scale.y=0.16;
    for (let i=0;i<6;i++){ const a=i/6*TAU; mk(tube([[Math.cos(a)*0.5,0.0,Math.sin(a)*0.5],[Math.cos(a)*0.25,0.12,Math.sin(a)*0.25],[Math.cos(a)*0.08,0.32,Math.sin(a)*0.08]],0.045,10,6), hw, 0,0,0,g); }
    for (let i=0;i<5;i++){ const a=i*1.9+0.3; const m=mk(G.sph(0.05,10,8), emisOwn(0x5af0c0,0.9), Math.cos(a)*0.38,0.06,Math.sin(a)*0.38,g); m.scale.set(1.4,0.5,1); }
    // three strands twist up into one trunk, with glowing seams between them
    for (let s=0;s<3;s++){ const pts=[], vp=[]; for (let k=0;k<=12;k++){ const y=0.05+k*0.13, a=s/3*TAU+k*0.5, r=0.11-k*0.004; pts.push([Math.cos(a)*r,y,Math.sin(a)*r]); if (k>0&&k<12) vp.push([Math.cos(a+0.45)*(r+0.04),y,Math.sin(a+0.45)*(r+0.04)]); }
      mk(tube(pts,0.062-s*0.004,48,8), hw, 0,0,0,g); quiet(mk(tube(vp,0.012,36,4), vein, 0,0,0,g)); }
    // branches arch out and droop, each ending in a spray of glowing leaves; lanterns hang from the tips
    const lanterns=[], leaves=[], leafM=[emisOwn(0xffc040,0.55,{roughness:0.5}), emisOwn(0xff8a30,0.5,{roughness:0.5}), emisOwn(0xffe080,0.6,{roughness:0.5})];
    const N=7; for (let i=0;i<N;i++){ const a=i/N*TAU+0.2, y0=1.25+(i%3)*0.12, L=0.75+(i%2)*0.2;
      const mid=[Math.cos(a)*L*0.55, y0+0.42, Math.sin(a)*L*0.55], end=[Math.cos(a)*L, y0+0.22, Math.sin(a)*L];
      mk(tube([[0,y0,0],mid,end],0.032,16,6), hw, 0,0,0,g);
      for (let k=0;k<9;k++){ const q=k/9*TAU, rr=0.1+(k%3)*0.07; const lf=mk(G.sph(0.075,8,6), leafM[(i+k)%3], mid[0]*0.6+end[0]*0.4+Math.cos(q)*rr, end[1]+0.18+Math.sin(k*1.7)*0.09, mid[2]*0.6+end[2]*0.4+Math.sin(q)*rr, g); lf.scale.set(1.5,0.35,0.8); lf.rotation.set(Math.sin(q)*0.5,q,Math.cos(q)*0.4); leaves.push(lf); }
      const hang=new THREE.Group(); hang.position.set(...end); g.add(hang); const len=0.18+(i%3)*0.1; quiet(mk(CYL(0.004,0.004,len,3), M(0x3a2a20), 0,-len/2,0,hang));
      const lm=emisOwn([0xffc860,0xff9a6a,0xfff0a0,0xff7a8a][i%4], 1.3); const body=new THREE.Group(); body.position.y=-len-0.1; hang.add(body);
      const lan=mk(G.sph(0.1,16,12), lm, 0,0,0,body); lan.scale.y=1.2; for (let k=0;k<6;k++){ const rb=quiet(mk(G.tor(0.1,0.004,3,16,Math.PI), M(0x8a3a20), 0,0,0,body)); rb.rotation.set(0,k/6*Math.PI,Math.PI/2); rb.scale.set(1,1.2,1); }
      mk(CYL(0.045,0.055,0.035,10), M(0x3a2a20), 0,0.12,0,body); mk(CYL(0.055,0.045,0.03,10), M(0x3a2a20), 0,-0.12,0,body); quiet(mk(CYL(0.004,0.004,0.08,3), M(0xd84a3a), 0,-0.17,0,body));
      lanterns.push({ hang, lm, ph:i*1.3 }); halo(body, 0, 0.75, 0xffb060, 0.55); }
    for (let k=0;k<22;k++){ const q=k*2.4, rr=0.12+((k*37)%10)*0.035; const lf=mk(G.sph(0.08,8,6), leafM[k%3], Math.cos(q)*rr, 1.95+((k*13)%7)*0.04, Math.sin(q)*rr, g); lf.scale.set(1.5,0.35,0.8); lf.rotation.y=q; leaves.push(lf); }
    halo(g, 1.5, 3.4, 0xff9a40, 0.22); halo(g, 1.9, 1.6, 0xffd070, 0.25); addGlow(g,1.5,3.6,0xffb060);
    motes(g, 30, 0xfff090, { r:1.1, y0:0.4, h:1.8, size:0.06, speed:0.25, orbit:true });
    anim(g,t=>{ vein.emissiveIntensity=0.6+Math.sin(t*1.2)*0.4; for (const L of lanterns){ L.hang.rotation.z=Math.sin(t*1.1+L.ph)*0.12; L.hang.rotation.x=Math.cos(t*0.8+L.ph)*0.08; L.lm.emissiveIntensity=1.1+Math.sin(t*3+L.ph)*0.3; }
      leafM.forEach((m,i)=>{ m.emissiveIntensity=0.45+Math.sin(t*0.9+i*2)*0.15; }); leaves.forEach((l,i)=>{ l.position.y+=Math.sin(t*1.3+i)*0.0006; }); }); },
  pearlfountain(g){ const S=stoneMat(0xe8e0d8), S2=stoneMat(0xd0c8c0);
    const scallop=(R,h,n=14)=>{ const pts=[]; for (let k=0;k<=12;k++){ const y=k/12*h; pts.push([R*(0.55+0.45*Math.pow(k/12,0.7)), y]); } const geo=lathe(pts.map(([x,y])=>[x,y]).concat([[R*0.9,h],[R*0.5,h*0.35],[0,h*0.35]]),n*4);
      const p=geo.attributes.position; for (let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i), a=Math.atan2(z,x), r=Math.hypot(x,z), w=1+0.07*Math.abs(Math.sin(a*n/2)); p.setX(i,x*w); p.setZ(i,z*w); } geo.computeVertexNormals(); return geo; };
    mk(CYL(0.95,1.0,0.12,40), S2, 0,0.06,0,g); mk(scallop(0.95,0.32), S, 0,0.1,0,g);
    const w1=quiet(mk(CYL(0.86,0.86,0.02,40), waterMat2(0x6ad0f0), 0,0.36,0,g));
    mk(lathe([[0.16,0],[0.12,0.2],[0.1,0.5],[0.14,0.62],[0,0.62]],20), S2, 0,0.36,0,g); mk(scallop(0.55,0.2), S, 0,0.98,0,g);
    const w2=quiet(mk(CYL(0.5,0.5,0.02,32), waterMat2(0x6ad0f0), 0,1.15,0,g));
    mk(lathe([[0.09,0],[0.07,0.2],[0.08,0.3],[0,0.3]],16), S2, 0,1.16,0,g); mk(scallop(0.28,0.12,10), S, 0,1.44,0,g);
    const pm=new THREE.MeshPhysicalMaterial({ color:0xf8f6ff, roughness:0.06, metalness:0.1, clearcoat:1, iridescence:1, iridescenceIOR:1.7, sheen:1, sheenColor:new THREE.Color(0xc0d8ff), emissive:0xa8b8ff, emissiveIntensity:0.35 });
    const pearl=mk(G.sph(0.2,40,30), pm, 0,1.72,0,g); const ph=halo(g, 1.72, 1.7, 0xc8d8ff, 0.6); halo(g, 1.2, 3.6, 0x9ab8ff, 0.16); addGlow(g,1.6,3.4,0xb8c8ff);
    for (let i=0;i<12;i++){ const a=i/12*TAU; mk(G.sph(0.045,14,10), pm, Math.cos(a)*0.93,0.42,Math.sin(a)*0.93,g); }
    for (let i=0;i<8;i++){ const a=i/8*TAU; mk(G.sph(0.03,12,8), pm, Math.cos(a)*0.52,1.2,Math.sin(a)*0.52,g); }
    const wm=new THREE.MeshPhysicalMaterial({ color:0xa8e8ff, transparent:true, opacity:0.35, roughness:0.05, clearcoat:1, depthWrite:false, side:THREE.DoubleSide });
    const sheets=[quiet(mk(CYL(0.56,0.52,0.62,32,1,true), wm, 0,0.68,0,g)), quiet(mk(CYL(0.3,0.28,0.28,24,1,true), wm, 0,1.32,0,g))];
    const ringsW=[]; for (let i=0;i<3;i++){ const r=quiet(mk(G.tor(0.5,0.01,4,40), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.5 }), 0,0.375,0,g)); r.rotation.x=Math.PI/2; ringsW.push(r); }
    motes(g, 16, 0xc8e8ff, { r:0.35, y0:1.5, h:0.8, size:0.05, speed:0.35 });
    anim(g,t=>{ const k=0.5+0.5*Math.sin(t*0.7); pm.emissive.setHSL(0.6+0.15*k, 0.6, 0.6); pm.emissiveIntensity=0.25+0.2*k; ph.material.color.setHSL(0.6+0.15*k,0.7,0.75); ph.material.opacity=0.5+0.15*Math.sin(t*1.3);
      pearl.position.y=1.72+Math.sin(t*1.2)*0.03; pearl.rotation.y=t*0.3; sheets.forEach((s,i)=>{ s.material.opacity=0.28+Math.sin(t*6+i)*0.05; });
      ringsW.forEach((r,i)=>{ const f=(t*0.5+i/3)%1; r.scale.setScalar(0.6+f*1.0); r.material.opacity=0.5*(1-f); }); w1.position.y=0.36+Math.sin(t*2)*0.004; w2.position.y=1.15+Math.sin(t*2.3)*0.003; }); },
  armillary(g){ const G1=gold(), S=stoneMat(0x5a5a6a);
    mk(lathe([[0,0],[0.36,0],[0.36,0.08],[0.24,0.14],[0.18,0.5],[0.26,0.58],[0.26,0.64],[0,0.64]],8), S, 0,0,0,g);
    for (let i=0;i<8;i++){ const a=i/8*TAU+Math.PI/8; quiet(mk(G.box(0.02,0.3,0.005), emis(0x6ae0ff,1.2), Math.cos(a)*0.2,0.33,Math.sin(a)*0.2,g)).rotation.y=-a+Math.PI/2; }
    mk(G.tor(0.27,0.012,6,32), G1, 0,0.64,0,g).rotation.x=Math.PI/2;
    const piv=new THREE.Group(); piv.position.y=1.2; g.add(piv);
    const coreM=emisOwn(0x6ad8ff,1.4,{ flatShading:true, roughness:0.2, metalness:0.3 }); const core=mk(G.ico(0.13,1), coreM, 0,0,0,piv); const inner=quiet(mk(G.ico(0.07,0), emis(0xffffff,2), 0,0,0,piv));
    halo(piv, 0, 1.0, 0x6ad8ff, 0.65); halo(piv, 0, 2.8, 0x4a8aff, 0.2); addGlow(g,1.2,3,0x8ad8ff);
    const rings=[]; [[0.5,0.018,[0,0,0],0.4],[0.42,0.014,[Math.PI/2,0,0],-0.55],[0.34,0.012,[Math.PI/2,0,Math.PI/3],0.8],[0.58,0.01,[0.41,0,0],0.15]].forEach(([r,th,rot,sp],i)=>{ const o=new THREE.Group(); o.rotation.set(...rot); piv.add(o); const sp2=new THREE.Group(); o.add(sp2);
      mk(G.tor(r,th,8,64), G1, 0,0,0,sp2); for (let k=0;k<24;k++){ const a=k/24*TAU; quiet(mk(G.box(0.008,k%6?0.02:0.04,0.008), G1, Math.cos(a)*r,Math.sin(a)*r,0,sp2)).rotation.z=a; }
      if (i===0){ for (let k=0;k<12;k++){ const a=k/12*TAU; quiet(mk(G.sph(0.016,8,6), emis(0x9ae8ff,1.6), Math.cos(a)*r,Math.sin(a)*r,0,sp2)); } }
      if (i===3){ const band=mk(CYL(r,r,0.06,64,1,true), new THREE.MeshStandardMaterial({ color:0xe8b84a, metalness:0.9, roughness:0.25, side:THREE.DoubleSide }), 0,0,0,sp2); band.rotation.x=Math.PI/2; }
      rings.push([sp2,sp]); });
    mk(CYL(0.012,0.012,1.3,6), G1, 0,0,0,piv).rotation.z=0.41; for (const s of [-1,1]) mk(G.sph(0.03,10,8), G1, Math.sin(0.41)*-0.65*s,Math.cos(0.41)*0.65*s,0,piv);
    const moons=[]; for (let i=0;i<3;i++){ const m=new THREE.Group(); piv.add(m); quiet(mk(G.sph(0.03,12,10), ceramic([0xf0f0ff,0xffd890,0xc8a0ff][i]), 0.7+i*0.08,0,0,m)); m.rotation.x=i*0.7; moons.push(m); }
    mk(tube([[0,0.64,0],[0.05,0.8,0],[0,0.95,0]],0.02,10,6), G1, 0,0,0,g);
    motes(g, 22, 0xc8f0ff, { r:0.9, y0:0.6, h:1.2, size:0.045, speed:0.2, orbit:true });
    anim(g,(t,dt)=>{ piv.position.y=1.2+Math.sin(t*0.9)*0.04; core.rotation.y+=dt*0.8; core.rotation.x+=dt*0.3; inner.rotation.y-=dt*1.5; coreM.emissiveIntensity=1.1+Math.sin(t*2)*0.4;
      for (const [r,sp] of rings) r.rotation.z+=dt*sp; moons.forEach((m,i)=>{ m.rotation.y+=dt*(0.4+i*0.25); }); }); },
  saplamp(g){ const I=iron();
    mk(CYL(0.24,0.28,0.06,20), I, 0,0.03,0,g);
    for (let s=0;s<3;s++){ const pts=[]; for (let k=0;k<=12;k++){ const y=0.05+k*0.1, a=s/3*TAU+k*0.6, r=0.05+0.02*Math.sin(k*0.9); pts.push([Math.cos(a)*r,y,Math.sin(a)*r]); } mk(tube(pts,0.014,40,6), I, 0,0,0,g); }
    const arm=[[0,1.25,0],[0.1,1.45,0],[0.32,1.55,0],[0.42,1.48,0]]; mk(tube(arm,0.018,20,6), I, 0,0,0,g); mk(G.sph(0.035,10,8), I, 0,1.27,0,g);
    for (let i=0;i<3;i++){ const leaf=mk(G.sph(0.06,8,4), I, 0.12+i*0.09,1.5+Math.sin(i)*0.04,0.03*(i%2?1:-1),g); leaf.scale.set(1.4,0.3,0.6); leaf.rotation.y=i; }
    const hang=new THREE.Group(); hang.position.set(0.42,1.48,0); g.add(hang); quiet(mk(CYL(0.005,0.005,0.12,4), I, 0,-0.06,0,hang)); mk(CYL(0.05,0.07,0.04,12), brass(), 0,-0.13,0,hang);
    const am=new THREE.MeshPhysicalMaterial({ color:0xffb020, emissive:0xff8a10, emissiveIntensity:0.6, roughness:0.08, clearcoat:1, transparent:true, opacity:0.8 });
    const bulb=mk(lathe([[0,0],[0.06,0.02],[0.15,0.1],[0.17,0.2],[0.13,0.3],[0.07,0.36],[0.06,0.38]],28), am, 0,-0.55,0,hang);
    const df=new THREE.Group(); df.position.set(0,-0.38,0); hang.add(df); mk(G.cap(0.01,0.12,4,6), M(0x4a2808), 0,0,0,df).rotation.z=Math.PI/2; for (const s of [-1,1]) for (const o of [-0.02,0.02]){ const w=mk(G.sph(0.05,8,6), M(0x6a3a10,{transparent:true,opacity:0.55}), o,0.008,s*0.05,df); w.scale.set(0.35,0.1,1); }
    const core=quiet(mk(G.sph(0.07,14,10), emis(0xfff0a0,1.6), 0,-0.4,0,hang)); const hh=halo(hang, -0.4, 1.2, 0xffa830, 0.55); halo(hang, -0.4, 3.0, 0xff9a20, 0.14); addGlow(hang,-0.4,3,0xffb040);
    const tip=mk(G.sph(0.018,10,8), am, 0,-0.57,0,hang); const drop=mk(G.sph(0.022,10,8), am, 0,-0.6,0,hang); drop.scale.y=1.3;
    const dish=mk(lathe([[0,0],[0.1,0],[0.13,0.04],[0.12,0.05],[0.09,0.015],[0,0.015]],20), brass(), 0.42,0.06,0,g); const pool=quiet(mk(CYL(0.09,0.09,0.01,18), am, 0.42,0.075,0,g));
    anim(g,t=>{ hang.rotation.z=Math.sin(t*0.9)*0.04; am.emissiveIntensity=0.5+Math.sin(t*1.5)*0.2; hh.material.opacity=0.45+Math.sin(t*1.5)*0.12; df.rotation.y=Math.sin(t*0.4)*0.3;
      const f=(t*0.25)%1; if (f<0.7){ drop.position.y=-0.6; drop.scale.setScalar(0.3+f/0.7*0.7); drop.visible=true; } else { const k=(f-0.7)/0.3; drop.position.y=-0.6-k*k*0.85; drop.visible=k<0.98; }
      pool.scale.setScalar(1+(f>0.95?(f-0.95)*4:0)); }); },
  grotto(g){ const R=stoneMat(0x7a7a80), R2=stoneMat(0x6a6a72);
    const rocks=[[-0.6,0.25,0,0.38],[0.6,0.25,0,0.38],[-0.62,0.65,0.02,0.32],[0.62,0.65,-0.02,0.32],[-0.5,1.0,0,0.28],[0.5,1.0,0,0.28],[-0.25,1.22,0,0.26],[0.25,1.22,0,0.26],[0,1.3,0,0.24],[-0.8,0.12,0.3,0.25],[0.75,0.1,0.35,0.22],[0,0.1,-0.5,0.3]];
    rocks.forEach(([x,y,z,r],i)=>{ const m=mk(G.dod(r), i%2?R:R2, x,y,z,g); m.rotation.set(i*0.7,i*1.3,i*0.4); m.scale.set(1,0.85,0.9); });
    const mossM=emisOwn(0x3ae0b0,0.9), moss2=emisOwn(0x7ae890,0.7), patches=[];
    [[-0.55,0.92,0.15],[0.5,1.12,0.12],[0,1.5,0.1],[-0.3,1.38,0.14],[0.66,0.45,0.25],[-0.68,0.4,0.25],[0.2,1.42,0.15],[-0.75,0.82,-0.05],[0.72,0.85,0.05]].forEach(([x,y,z],i)=>{ const p=mk(G.sph(0.14+(i%3)*0.03,12,8), i%2?mossM:moss2, x,y,z,g); p.scale.set(1.2,0.45,1); p.rotation.set(0.3,i,0.2); patches.push(p); });
    const vine=[]; for (let i=0;i<5;i++){ const x=-0.3+i*0.15; const v=quiet(mk(tube([[x,1.18,0.12],[x+0.03,0.95-i%2*0.1,0.16],[x-0.02,0.7-i%3*0.1,0.14]],0.008,10,4), mossM, 0,0,0,g)); vine.push(v); for (let k=0;k<3;k++) quiet(mk(G.sph(0.018,6,5), emis(0xc8fff0,1.6), x+(k%2?0.02:-0.01),1.05-k*0.15,0.15,g)); }
    const pool=mk(CYL(0.55,0.6,0.08,32), R2, 0,0.04,0.35,g); const pw=quiet(mk(CYL(0.5,0.5,0.02,32), new THREE.MeshPhysicalMaterial({ color:0x3ac8c0, emissive:0x2aa8a0, emissiveIntensity:0.5, transparent:true, opacity:0.75, roughness:0.05, clearcoat:1 }), 0,0.085,0.35,g));
    const fall=quiet(mk(G.box(0.18,1.0,0.02), new THREE.MeshBasicMaterial({ color:0xc8fff8, transparent:true, opacity:0.4, blending:THREE.AdditiveBlending, depthWrite:false }), 0,0.6,0.25,g));
    const mush=[]; [[0.35,0.1,0.65,1],[0.45,0.1,0.5,0.7],[-0.4,0.1,0.62,0.8],[-0.15,0.1,0.75,0.55]].forEach(([x,y,z,s],i)=>{ const m=new THREE.Group(); m.position.set(x,y,z); g.add(m); mk(CYL(0.02*s,0.028*s,0.12*s,8), ceramic(0xf0f8ff), 0,0.06*s,0,m); const c=mk(G.sph(0.07*s,14,8,0,TAU,0,Math.PI/2), emisOwn(i%2?0x7ad8ff:0x5af0c0,0.9), 0,0.11*s,0,m); c.scale.y=0.7; mush.push(c); });
    for (let i=0;i<5;i++){ const c=mk(G.cone(0.04,0.18,5), emisOwn(0xa8f8ff,0.8,{flatShading:true,roughness:0.1}), -0.3+i*0.15,1.06-((i*3)%4)*0.03,0.05,g); c.rotation.x=Math.PI; }
    halo(g, 0.6, 2.6, 0x5af0c0, 0.16); halo(g, 0.15, 1.2, 0x5af0d0, 0.3, 0, 0.35); addGlow(g,0.7,3,0x7af0d0);
    motes(g, 24, 0xa8ffe0, { r:0.7, y0:0.15, h:1.6, size:0.05, speed:0.18, swirl:0.3, z:0.1 });
    anim(g,t=>{ mossM.emissiveIntensity=0.75+Math.sin(t*1.1)*0.35; moss2.emissiveIntensity=0.6+Math.sin(t*1.1+2)*0.3; fall.material.opacity=0.32+Math.sin(t*9)*0.06; fall.scale.x=1+Math.sin(t*7)*0.05;
      pw.material.emissiveIntensity=0.4+Math.sin(t*1.7)*0.15; mush.forEach((c,i)=>{ c.material.emissiveIntensity=0.7+Math.sin(t*2+i*1.4)*0.3; }); }); },
  wishwell(g){ const S=stoneMat(0x9a948c), S2=stoneMat(0x8a847c), hw=woodMat(0x7a3a22);
    for (let row=0;row<4;row++){ const n=16; for (let i=0;i<n;i++){ const a=(i+(row%2)*0.5)/n*TAU; const b=mk(G.box(0.34,0.17,0.2), row%2?S:S2, Math.cos(a)*0.62,0.09+row*0.17,Math.sin(a)*0.62,g); b.rotation.y=-a; } }
    mk(G.tor(0.62,0.07,8,32), S, 0,0.72,0,g).rotation.x=Math.PI/2;
    const wm=new THREE.MeshPhysicalMaterial({ color:0x6ab8ff, emissive:0x4a9aff, emissiveIntensity:0.7, transparent:true, opacity:0.8, roughness:0.05, clearcoat:1 });
    const water=quiet(mk(CYL(0.55,0.55,0.02,32), wm, 0,0.5,0,g)); halo(g, 0.6, 1.4, 0x8ac8ff, 0.55);
    const colM=new THREE.MeshBasicMaterial({ color:0xa8d8ff, transparent:true, opacity:0.14, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }); const col=quiet(mk(new THREE.CylinderGeometry(0.3,0.5,1.1,24,1,true), colM, 0,1.05,0,g));
    for (const s of [-1,1]){ mk(G.box(0.12,1.3,0.12), hw, s*0.66,1.15,0,g); }
    const roof=new THREE.Group(); roof.position.y=1.85; g.add(roof);
    for (const s of [-1,1]){ const pl=mk(G.box(1.7,0.05,0.62), woodMat(0x8a4a30), 0,0.18,s*0.27,roof); pl.rotation.x=s*0.62; for (let k=0;k<4;k++){ const sh=mk(G.box(1.72,0.03,0.12), woodMat(k%2?0x9a5a38:0x7a3a22), 0,0.06+k*0.08,s*(0.5-k*0.13),roof); sh.rotation.x=s*0.62; } }
    mk(G.box(1.75,0.08,0.08), hw, 0,0.43,0,roof); mk(G.sph(0.06,12,10), gold(), 0,0.5,0,roof);
    const ax=new THREE.Group(); ax.position.y=1.5; g.add(ax); const roll=mk(CYL(0.07,0.07,1.25,14), hw, 0,0,0,ax); roll.rotation.z=Math.PI/2; const crank=new THREE.Group(); crank.position.x=0.75; ax.add(crank); mk(G.box(0.04,0.25,0.04), M(0x3a3836,{metalness:0.6}), 0,0.1,0,crank); mk(CYL(0.025,0.025,0.15,8), hw, 0.07,0.22,0,crank).rotation.z=Math.PI/2;
    const rope=quiet(mk(CYL(0.01,0.01,1,5), M(0xc8b080), 0,-0.5,0,ax)); const bucket=new THREE.Group(); ax.add(bucket);
    mk(lathe([[0,0],[0.1,0],[0.13,0.18],[0.12,0.18],[0.09,0.02],[0,0.02]],16), hw, 0,0,0,bucket); for (const y of [0.05,0.14]) mk(G.tor(0.11+y*0.15,0.008,4,16), M(0x3a3836,{metalness:0.6}), 0,y,0,bucket).rotation.x=Math.PI/2; mk(G.tor(0.12,0.006,4,16,Math.PI), M(0x3a3836), 0,0.18,0,bucket);
    for (let i=0;i<10;i++){ const a=i*2.4, r=0.1+((i*37)%10)*0.04; quiet(mk(CYL(0.035,0.035,0.008,12), gold(), Math.cos(a)*r,0.49,Math.sin(a)*r,g)); }
    const pm=new THREE.MeshPhysicalMaterial({ color:0xf8f6ff, roughness:0.06, clearcoat:1, iridescence:1, emissive:0xa8b8ff, emissiveIntensity:0.4 }); mk(G.sph(0.06,20,16), pm, 0,0.53,0,g);
    for (let i=0;i<6;i++){ const a=i/6*TAU; mk(G.sph(0.05,8,6), ceramic([0xff8aa8,0xffffff,0xf7c948][i%3]), Math.cos(a)*0.66,0.8,Math.sin(a)*0.66,g); mk(G.sph(0.06,6,4), shellMat(0x5fae43), Math.cos(a+0.25)*0.66,0.78,Math.sin(a+0.25)*0.66,g).scale.set(1.4,0.4,0.8); }
    motes(g, 26, 0xffe890, { r:0.45, y0:0.55, h:1.3, size:0.07, speed:0.3, swirl:0.8 });
    halo(g, 0.9, 2.4, 0x8ab8ff, 0.12); addGlow(g,0.9,3,0x9ac8ff);
    anim(g,t=>{ const d=0.55+Math.sin(t*0.35)*0.35; bucket.position.y=-d-0.18; rope.scale.y=d; rope.position.y=-d/2; ax.children[0].rotation.x=-Math.sin(t*0.35)*3; crank.rotation.x=-Math.sin(t*0.35)*3;
      wm.emissiveIntensity=0.55+Math.sin(t*1.6)*0.2; colM.opacity=0.1+Math.sin(t*1.6)*0.05; water.position.y=0.5+Math.sin(t*1.3)*0.005; }); },
});
