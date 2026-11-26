// v1.52 wave 1 critters: 54 fish and 57 bugs, each with its own build (no recolors, no scaled copies).
// Same contract as critters.js: fish face +x, bugs face +z, both sit around y 0.1 to 0.35.
// g.userData.tail wags (rotation.y), g.userData.wings flap (rotation.z, userData.side = 1 or -1).
// New here: g.userData.idle(t) moves a species' own parts (gills, leaves, fans, a rolling ball...) and
// g.userData.keep lists the groups it moves, so mergeStatic leaves them alone. g.userData.bottom = rests on the floor of a tank.
import * as THREE from 'three';
import { TAU } from './util.js';
import { fishSkin, shellMat, fuzzMat, ceramic, glintMat, clearWingMat, wingTex } from './look.js';
import { V3, once, mesh, vcPhys, col, fbm, n3, clamp, smooth, setColors, displace, welded, tube, curve, leg, sixLegs, compoundEye, antennae, mergeStatic, rayFin, finMaterial, fishEye, wingGeoHi, bodySegments, WING } from './critters.js';

const PI=Math.PI, V2=(x,y)=>new THREE.Vector2(x,y), sin=Math.sin, cos=Math.cos;
const sph=(r,w=16,h=12,...a)=>new THREE.SphereGeometry(r,w,h,...a);
const hx=c=>col(c).getHex(), shade=(c,l,s=0)=>col(c).offsetHSL(0,s,l).getHex();
/* ---------- small parts ---------- */
function blob(g, mat, x,y,z, r, sx=1,sy=1,sz=1, seg=16){ const m=mesh(sph(r,seg,Math.max(8,seg*0.75|0)), mat, x,y,z, g, false); m.scale.set(sx,sy,sz); return m; }
function rod(g, mat, a, b, r0, r1=r0, seg=6){ return mesh(tube([V3(...a),V3(...b)], t=>r0+(r1-r0)*t, seg), mat, 0,0,0, g, false); }
function bend(g, mat, ctrl, rf, seg=8, n=14, opts){ const pts=curve(ctrl,n); mesh(tube(pts, rf, seg, opts), mat, 0,0,0, g, false); return pts; }
function spike(g, mat, p, dir, len, r){ const d=V3(...dir).normalize(), c=mesh(new THREE.ConeGeometry(r,len,6), mat, p[0]+d.x*len/2, p[1]+d.y*len/2, p[2]+d.z*len/2, g, false); c.quaternion.setFromUnitVectors(V3(0,1,0), d); return c; }
function teeth(g, a, b, n, len, dir, r=0.006, mat=ceramic(0xfaf6ec)){ for (let i=0;i<n;i++){ const t=n>1?i/(n-1):0.5; spike(g, mat, [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t], dir, len*(0.7+0.3*Math.abs(sin(i*2.3))), r); } }
const pairs = fn => { for (const k of [1,-1]) fn(k); };
const keep = (g, o) => { (g.userData.keep=g.userData.keep||[]).push(o); return o; };
const grp = (g, x=0,y=0,z=0) => { const o=new THREE.Group(); o.position.set(x,y,z); g.add(o); return o; };
const glowM = (c, k=2) => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:k, roughness:0.4 });
const glassy = (c, op=0.35) => new THREE.MeshPhysicalMaterial({ color:c, transparent:true, opacity:op, roughness:0.08, clearcoat:1, depthWrite:false, side:THREE.DoubleSide });
// paint a geometry with a per-vertex color function and give it a glossy vertex-colour skin
function painted(g, geo, fn, x=0,y=0,z=0, o={}){ setColors(geo, fn); return mesh(geo, vcPhys(Object.assign({ roughness:0.35, clearcoat:0.7 }, o)), x,y,z, g); }

/* ---------- fish parts ---------- */
// classic fish profile (t: 0 snout .. 1 tail root), radius as a fraction of the body depth
const prof=(a=0.36,nar=0.68,sh=0.2,st=0.42)=>t=>Math.pow(sin(PI*clamp((t+0.004)/1.008,0,1)),a)*(1-nar*smooth(st,1,t))*(1+0.07*Math.exp(-((t-sh)**2)/0.012));
function latheGeo(half, rf, segs=40, N=56){ const pts=[]; for (let i=0;i<=N;i++){ const t=i/N; pts.push(V2(Math.max(0.0015,rf(t)), half-t*2*half)); }
  const geo=new THREE.LatheGeometry(pts, segs); geo.rotateZ(-PI/2);
  const I=geo.index.array; for (let i=0;i<I.length;i+=3){ const t=I[i+1]; I[i+1]=I[i+2]; I[i+2]=t; }
  const uv=geo.attributes.uv; for (let i=0;i<uv.count;i++) uv.setY(i,1-uv.getY(i)); return geo; }
// body: half length, radius function (absolute), side squash, belly squash, extra displacement; returns a handle for eyes and fins
function body(g, mat, half, rf, flat=0.48, y0=0.22, o={}){
  const geo=latheGeo(half, rf, o.segs||40); displace(geo, v=>{ v.z*=flat; if (v.y<0) v.y*=(o.belly??0.92); if (o.fn) o.fn(v); });
  const m=mesh(geo, mat, 0,y0,0, g); return { half, rf, flat, y0, m, x:t=>half-t*2*half };
}
// an eye sitting on the body surface at t along it, upFrac of the way up
function eyeOn(g, B, t, up=0.2, s=1, iris=0xc8a050){ const R=B.rf(t), ey=R*up; fishEye(g, B.x(t), B.y0+ey, Math.max(0.004, Math.sqrt(Math.max(0,R*R-ey*ey))*B.flat-0.004*s), s, iris); }
const TAILS = {
  fork:[[0,0.025],[-0.08,0.1,-0.22,0.21],[-0.14,0.02],[-0.22,-0.21],[-0.08,-0.1,0,-0.025]],
  norm:[[0,0.025],[-0.1,0.12,-0.2,0.17],[-0.16,0.0],[-0.2,-0.17],[-0.1,-0.12,0,-0.025]],
  round:[[0,0.03],[-0.14,0.16,-0.2,0.0],[-0.14,-0.16,0,-0.03]],
  square:[[0,0.03],[-0.05,0.1,-0.16,0.12],[-0.17,0],[-0.16,-0.12],[-0.05,-0.1,0,-0.03]],
  lunate:[[0,0.02],[-0.06,0.12,-0.22,0.32],[-0.12,0.06,-0.12,0],[-0.12,-0.06,-0.22,-0.32],[-0.06,-0.12,0,-0.02]],
  shark:[[0,0.03],[-0.08,0.14,-0.22,0.32],[-0.13,0.04],[-0.17,-0.12],[0,-0.03]],
  spade:[[0,0.04],[-0.1,0.12,-0.3,0.0],[-0.1,-0.12,0,-0.04]],
};
function tailFin(g, fin, pts, x, y, s=1, rays=12, sy){ const t=rayFin(pts, fin, rays); t.position.set(x,y,0); t.scale.set(s,sy??s,1); g.add(t); g.userData.tail=t; return t; }
function finAt(g, fin, outline, x,y,z=0, s=1, rx=0,ry=0,rz=0, rays=8){ const f=rayFin(outline, fin, rays); f.position.set(x,y,z); f.rotation.set(rx,ry,rz); f.scale.setScalar(s); g.add(f); return f; }
const DORSAL=[[0.11,0],[0.04,0.13,-0.1,0.1],[-0.16,0]], ANAL=[[0.06,0],[0.02,-0.08,-0.08,-0.07],[-0.12,0]], PEC=[[0,0.014],[-0.04,0.06,-0.13,0.045],[-0.15,0.0,-0.11,-0.025],[0,-0.014]], PELV=[[0.03,0],[-0.02,-0.06,-0.08,-0.05],[-0.06,0]];
function pecs(g, fin, B, t, up, s=1, outline=PEC, rot=[0.2,0.3,-0.3]){ const R=B.rf(t); pairs(k=>{ const f=rayFin(outline, fin, 10); f.position.set(B.x(t), B.y0+R*up, k*R*B.flat*0.8); f.rotation.set(k*rot[0], k*rot[1], rot[2]); f.scale.setScalar(s); g.add(f); }); }
function pelvics(g, fin, B, t, s=1){ const R=B.rf(t); pairs(k=>{ const f=rayFin(PELV, fin, 6); f.position.set(B.x(t), B.y0-R*0.85, k*R*B.flat*0.4); f.rotation.x=k*0.5; f.scale.setScalar(s); g.add(f); }); }
function lips(g, B, c, s=1){ const H=B.rf(0.04)+0.02; blob(g, shellMat(shade(c,-0.15),{roughness:0.4}), B.half*0.985, B.y0-H*0.15, 0, 0.022*s, 0.6,0.45,1.2*B.flat+0.2); }
// an eel-like body along a curve: rf(t) radius, squash = side flattening (1 round)
function eelBody(g, mat, ctrl, rf, squash=1, n=48, seg=14){ const pts=curve(ctrl, n); const geo=tube(pts, rf, seg, { squash });
  const uv=geo.attributes.uv; for (let i=0;i<uv.count;i++) uv.setX(i, 1-uv.getX(i)); return { pts, m:mesh(geo, mat, 0,0,0, g) }; }
// a ribbon fin along a list of points, standing up from them (dy) or hanging down
function ribbonFin(g, mat, pts, hf, dir=1, from=0, to=1){ const pos=[], idx=[], uv=[], n=pts.length, a=Math.floor(from*(n-1)), b=Math.ceil(to*(n-1));
  for (let i=a;i<=b;i++){ const t=(i-a)/Math.max(1,b-a), p=pts[i], h=hf(t); pos.push(p.x,p.y,p.z, p.x,p.y+dir*h,p.z); uv.push(0,t,1,t); }
  for (let i=0;i<b-a;i++){ const q=i*2; idx.push(q,q+2,q+1, q+1,q+2,q+3); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m=mesh(geo, mat, 0,0,0, g, false); m.renderOrder=1; return m; }

/* =========================== FISH =========================== */
const FISH = {
  // long and pencil-thin, with a needle beak, its lower jaw longer than the upper
  needlefish(g,d,id,{skin,fin}){ const H=0.055, B=body(g, skin, 0.5, t=>H*prof(0.45,0.5,0.3)(t), 0.75);
    const bm=shellMat(shade(d.c,-0.12)); rod(g, bm, [0.47,0.225,0],[0.7,0.226,0],0.016,0.002,8); rod(g, bm, [0.47,0.212,0],[0.78,0.208,0],0.016,0.002,8);
    teeth(g, [0.52,0.218,0],[0.72,0.212,0], 9, 0.012, [0,1,0], 0.0025);
    tailFin(g, fin, TAILS.fork, -0.48, 0.22, 0.55); finAt(g, fin, [[0.06,0],[0.02,0.07,-0.08,0.04],[-0.12,0]], -0.32, 0.22+H*0.8, 0, 0.9); finAt(g, fin, [[0.06,0],[0.02,-0.07,-0.08,-0.04],[-0.12,0]], -0.3, 0.22-H*0.8, 0, 0.9);
    pecs(g, fin, B, 0.22, -0.2, 0.55); eyeOn(g, B, 0.07, 0.25, 0.8, 0xe0e8f0); },
  // stands upright out of its sand burrow and sways
  gardeneel(g,d,id,{skin}){ g.userData.bottom=true; const sand=ceramic(0xe2cfa4);
    const mound=welded(sph(0.2,28,14)); displace(mound,v=>{ v.y=Math.max(0,v.y)*0.35; v.multiplyScalar(1+fbm(v.x*20,v.y*20,v.z*20,2)*0.06); }); mesh(mound, sand, 0,0,0, g);
    const hole=mesh(new THREE.CircleGeometry(0.05,20), ceramic(0x5a4a30), 0,0.071,0, g, false); hole.rotation.x=-PI/2;
    const st=keep(g, grp(g, 0,0.06,0)); const pts=eelBody(st, skin, [[0,0,0],[0.02,0.16,0],[-0.03,0.32,0],[0.03,0.46,0],[0.09,0.52,0]], t=>0.024*(1-t*0.25)+0.004*sin(t*PI), 1).pts;
    const h=pts[pts.length-1]; blob(st, skin, h.x+0.01, h.y, 0, 0.028, 1.4,0.95,0.9); fishEye(st, h.x+0.025, h.y+0.012, 0.02, 0.75, 0xf8f0d0);
    pairs(k=>finAt(st, finMaterial(d.c,d.c2,id), [[0,0.01],[-0.02,0.03,-0.04,0.0],[0,-0.01]], h.x-0.04, h.y-0.03, k*0.024, 0.8, 0, k*0.6, 0, 5));
    g.userData.idle=t=>{ st.rotation.z=sin(t*1.1)*0.1; st.rotation.x=sin(t*0.7+1)*0.08; }; },
  // lies flat on the sand, both eyes on its top side, with a fringe of fin all the way round
  sole(g,d,id,{skin,fin}){ g.userData.bottom=true; const lay=grp(g, 0,0.04,0); lay.rotation.x=-PI/2;
    const B=body(lay, skin, 0.3, t=>0.2*Math.pow(sin(PI*clamp(t*1.02,0,1)),0.6)*(1-0.6*smooth(0.75,1,t)), 0.14, 0, { belly:1 });
    const ring=new THREE.Shape(); ring.absellipse(0,0,0.36,0.27,0,TAU); const hole=new THREE.Path(); hole.absellipse(0.005,0,0.29,0.19,0,TAU); ring.holes.push(hole);
    const fr=mesh(new THREE.ShapeGeometry(ring,48), fin, -0.02,0,0, lay, false); fr.scale.set(1,0.95,1);
    const tl=tailFin(g, fin, TAILS.round, -0.33, 0.04, 0.6); tl.rotation.x=-PI/2;
    for (const [x,z] of [[0.21,0.03],[0.17,-0.04]]){ const e=grp(g,x,0.07,z); blob(e, ceramic(0x2a2016), 0,0,0, 0.02, 1,0.7,1); blob(e, ceramic(0xc8a060), 0,0.006,0, 0.014, 1,0.6,1); blob(e, glintMat(), 0.004,0.013,0.004, 0.004); }
    blob(g, shellMat(shade(d.c,-0.1)), 0.29, 0.045, 0.01, 0.025, 0.6,0.4,1.1); },
  // a torpedo with two pairs of huge clear wing fins spread out to glide
  flyingfish(g,d,id,{skin}){ const H=0.085, B=body(g, skin, 0.32, t=>H*prof(0.4,0.6,0.22)(t), 0.7); const wing=finMaterial(0x9ad0f0,0xe8f8ff,id+'w'), fin=finMaterial(d.c,d.c2,id);
    pairs(k=>{ const w=rayFin([[0,0.02],[-0.05,0.16,-0.26,0.14],[-0.36,0.04],[-0.3,-0.02],[-0.12,-0.02,0,-0.015]], wing, 14); w.position.set(0.14,0.25,k*0.03); w.rotation.set(k*1.25,0,-0.12); g.add(w);
      const p=rayFin([[0,0.012],[-0.04,0.08,-0.16,0.06],[-0.2,0.0],[0,-0.012]], wing, 9); p.position.set(-0.1,0.2,k*0.025); p.rotation.set(k*1.2,0,-0.1); g.add(p); });
    tailFin(g, fin, [[0,0.02],[-0.08,0.08,-0.2,0.14],[-0.13,0.0],[-0.28,-0.2],[-0.08,-0.1,0,-0.02]], -0.31, 0.22, 0.9);
    finAt(g, fin, [[0.04,0],[0.0,0.05,-0.08,0.03],[-0.1,0]], -0.18, 0.22+H*0.85, 0, 0.8); eyeOn(g, B, 0.1, 0.25, 0.9); lips(g, B, d.c); },
  // a tall round disc with a pointed little snout, a black eye bar and a false eye by its tail
  butterflyfish(g,d,id,{skin,fin}){ const H=0.19, B=body(g, skin, 0.2, t=>H*Math.pow(sin(PI*clamp(t*0.97+0.02,0,1)),0.55)*(1-0.55*smooth(0.72,1,t)), 0.26);
    rod(g, shellMat(d.c), [0.18,0.21,0],[0.27,0.2,0],0.022,0.01,10); blob(g, shellMat(0x2a2016), 0.272,0.2,0, 0.01, 1,0.8,1);
    const df=rayFin([[0.12,0],[0.1,0.12,-0.04,0.12],[-0.2,0.06,-0.24,-0.02]], fin, 14); df.position.set(0,0.22+H*0.72,0); g.add(df);
    const af=rayFin([[0.06,0],[0.04,-0.1,-0.08,-0.1],[-0.2,-0.06,-0.22,0.02]], fin, 12); af.position.set(-0.02,0.22-H*0.72,0); g.add(af);
    tailFin(g, fin, TAILS.square, -0.19, 0.22, 0.55); pecs(g, fin, B, 0.35, -0.1, 0.5); eyeOn(g, B, 0.24, 0.18, 0.75, 0x2a2016); },
  // bony helmet head, fan wings, and three finger rays each side that it walks on
  searobin(g,d,id,{skin,fin}){ g.userData.bottom=true; const H=0.085, B=body(g, skin, 0.36, t=>H*(1.25-0.65*smooth(0,1,t))*Math.pow(sin(PI*clamp(t*0.98+0.02,0,1)),0.4), 0.85, 0.2, { fn:v=>{ if (v.x>0.2) v.y*=0.85; } });
    const helm=shellMat(shade(d.c,-0.06),{ roughness:0.5 }); blob(g, helm, 0.27,0.24,0, 0.075, 1.3,0.7,1.0);
    pairs(k=>{ spike(g, helm, [0.33,0.24,k*0.05],[1,0.1,k*0.4],0.04,0.008); spike(g, helm, [0.2,0.25,k*0.06],[-0.4,0.1,k*1],0.05,0.008); });
    const wing=finMaterial(0xf09a3a,0x3a8ad8,id+'w'); const fans=[];
    pairs(k=>{ const w=grp(g,0.16,0.2,k*0.06); fans.push(w); keep(g,w); const f=rayFin([[0,0.02],[-0.05,0.14,-0.24,0.18],[-0.34,0.02,-0.26,-0.08],[0,-0.015]], wing, 15); f.rotation.set(k*1.35,0,-0.18); w.add(f);
      for (let i=0;i<3;i++) bend(g, shellMat(d.c2), [[0.2-i*0.02,0.16,k*0.04],[0.24-i*0.03,0.08,k*(0.08+i*0.02)],[0.27-i*0.04,0.004,k*(0.1+i*0.02)]], t=>0.006*(1-t*0.5), 5, 8); });
    finAt(g, fin, [[0.06,0],[0.04,0.1,-0.02,0.1],[-0.08,0]], 0.06, 0.2+H*0.95, 0, 0.9); finAt(g, fin, [[0.04,0],[0,0.07,-0.16,0.04],[-0.2,0]], -0.1, 0.2+H*0.75, 0, 0.9);
    tailFin(g, fin, TAILS.square, -0.35, 0.2, 0.5); eyeOn(g, B, 0.14, 0.55, 0.85, 0xe8b040);
    g.userData.idle=t=>fans.forEach((w,i)=>{ w.rotation.x=(i?-1:1)*sin(t*1.4)*0.18; }); },
  // a square box of a fish: hard plated sides, a stubby tail and tiny fins that do all the work
  boxfish(g,d,id,{fin}){ const bx=welded(new THREE.BoxGeometry(0.34,0.22,0.2,10,8,8)); displace(bx,v=>{ const p=4; const n=Math.pow(Math.abs(v.x/0.17)**p+Math.abs(v.y/0.11)**p+Math.abs(v.z/0.1)**p,1/p); v.multiplyScalar(1/Math.max(0.6,n)**0.85); if (v.x>0.1) v.multiplyScalar(1-(v.x-0.1)*0.6); });
    painted(g, bx, (v,n,o)=>{ o.set(d.c); const hexE=Math.abs(sin(v.x*55+v.y*20))*Math.abs(sin(v.z*55+v.y*20)); if (n3(v.x*55,v.y*55,v.z*55,4)>0.8 && v.y>-0.06) o.set(d.c2); else if (hexE<0.05) o.offsetHSL(0,0,-0.1); if (v.y<-0.07) o.lerp(col(0xfff6d0),0.4); }, 0,0.22,0);
    blob(g, shellMat(0xe8803a,{roughness:0.4}), 0.175,0.2,0, 0.02, 0.8,0.8,1.1); rod(g, shellMat(d.c), [-0.16,0.22,0],[-0.22,0.22,0], 0.03,0.018,10);
    tailFin(g, fin, TAILS.round, -0.21, 0.22, 0.6); finAt(g, fin, [[0.03,0],[0,0.05,-0.05,0.04],[-0.06,0]], -0.12,0.33,0, 0.7); finAt(g, fin, [[0.03,0],[0,-0.05,-0.05,-0.04],[-0.06,0]], -0.12,0.11,0, 0.7);
    pairs(k=>finAt(g, fin, [[0,0.01],[-0.03,0.04,-0.07,0.02],[0,-0.01]], 0.06,0.21,k*0.1, 0.8, k*0.3,k*0.5,0, 6)); fishEye(g, 0.1,0.28,0.085, 1, 0xd8a030); },
  // an oval mantle with a rippling skirt fin, W-shaped pupils, and short arms
  cuttlefish(g,d,id,{skin}){ const B=body(g, skin, 0.3, t=>0.1*Math.pow(sin(PI*clamp(t*0.96+0.04,0,1)),0.5), 0.62, 0.22, { fn:v=>{ v.y*=0.85; } });
    const sk=finMaterial(shade(d.c,0.05),d.c2,id); pairs(k=>{ const pts=[]; for (let i=0;i<=40;i++){ const t=i/40, x=0.27-t*0.56; pts.push(V3(x, 0.22, k*(0.06*Math.sqrt(sin(PI*clamp(t*0.98+0.01,0,1)))+0.005))); }
      const pos=[], idx=[]; for (let i=0;i<=40;i++){ const p=pts[i], w=0.045*sin(PI*i/40)**0.5+0.005, rip=sin(i*1.3)*0.012; pos.push(p.x,p.y,p.z, p.x,p.y+rip,p.z+k*w); } for (let i=0;i<40;i++){ const q=i*2; idx.push(q,q+2,q+1,q+1,q+2,q+3); }
      const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setIndex(idx); geo.computeVertexNormals(); mesh(geo, sk, 0,0,0, g, false).renderOrder=1; });
    const hm=shellMat(shade(d.c2,-0.05),{ roughness:0.5 }); blob(g, hm, 0.31,0.22,0, 0.065, 0.9,0.85,0.95);
    for (let i=0;i<8;i++){ const a=i/8*TAU; bend(g, hm, [[0.34,0.22+cos(a)*0.03,sin(a)*0.03],[0.42,0.21+cos(a)*0.045,sin(a)*0.05],[0.47,0.2+cos(a)*0.04,sin(a)*0.06]], t=>0.014*(1-t*0.8), 6, 8); }
    pairs(k=>{ const e=grp(g,0.3,0.26,k*0.058); blob(e, ceramic(0x1a1410), 0,0,0, 0.026, 1,1,0.4); const w=curve([[-0.012,0.006,k*0.011],[-0.004,-0.008,k*0.011],[0,0,k*0.011],[0.004,-0.008,k*0.011],[0.012,0.006,k*0.011]],10); mesh(tube(w,()=>0.0035,4), ceramic(0xf0d890), 0,0,0, e, false); }); },
  // a fan of long separate venom spines on its back and feathery pectoral plumes
  lionfish(g,d,id,{skin,fin}){ const H=0.12, B=body(g, skin, 0.3, t=>H*prof(0.4,0.65,0.22)(t), 0.5); const sp=shellMat(shade(d.c,-0.05),{roughness:0.5}), mem=finMaterial(d.c2,d.c,id+'m');
    for (let i=0;i<12;i++){ const t=i/11, x=0.16-t*0.36, h=(0.26-0.16*t)*(i<7?1:0.6), a=-0.2-t*0.5; const tip=[x+Math.sin(a)*h*0.4, 0.22+H*0.9+h, 0]; rod(g, sp, [x,0.22+H*0.85,0], tip, 0.005, 0.0015, 5); }
    ribbonFin(g, mem, curve([[0.16,0.22+H*0.85,0],[0,0.22+H*0.95,0],[-0.2,0.22+H*0.8,0]],16), t=>0.05*(1-t*0.6), 1);
    const plume=finMaterial(0xf8e8d8,d.c,id+'p'); pairs(k=>{ for (let i=0;i<9;i++){ const a=-0.4-i*0.22, L=0.22+0.12*sin(i/8*PI); const base=V3(0.1,0.19,k*0.05), tip=V3(0.1+cos(a)*L*0.6, 0.19+sin(a)*L*0.55+0.08, k*(0.08+L*0.5));
      mesh(tube([base, base.clone().lerp(tip,0.5).add(V3(0,0.02,0)), tip],t=>0.004*(1-t*0.7)+0.001,4), sp, 0,0,0, g, false); const f=rayFin([[0,0],[0.02,0.02,0.0,0.07],[-0.02,0.02,0,0]], plume, 3); f.position.copy(base.clone().lerp(tip,0.35)); f.lookAt(tip); f.scale.setScalar(L*3); g.add(f); } });
    pairs(k=>{ bend(g, sp, [[0.24,0.27,k*0.04],[0.27,0.33,k*0.05],[0.25,0.37,k*0.06]], t=>0.006*(1-t*0.8), 5, 8); });
    finAt(g, fin, [[0.06,0],[0.02,-0.1,-0.1,-0.08],[-0.12,0]], -0.14,0.22-H*0.82,0, 0.9); tailFin(g, fin, TAILS.round, -0.29, 0.22, 0.75); eyeOn(g, B, 0.13, 0.3, 0.85, 0xd84a3a); lips(g, B, d.c); },
  // a rainbow shrimp with stalked eyes and folded hammer clubs
  mantisshrimp(g,d,id){ const segM=[d.c, shade(d.c,0.04), 0x2a8ad0]; const pts=curve([[0.26,0.12,0],[0.1,0.13,0],[-0.06,0.12,0],[-0.2,0.1,0]],30);
    for (let i=0;i<10;i++){ const t=i/9, p=pts[Math.round(t*29)], r=0.065*(1-t*0.35); const s=mesh(sph(r,24,14,0,TAU,0,PI*0.6), shellMat(i%3===2?segM[2]:segM[i%2],{ clearcoat:1, roughness:0.25 }), p.x,p.y,p.z, g, false); s.scale.set(0.55,0.9,1.15); if (i<9) blob(g, shellMat(0xf06a3a), p.x-0.012, p.y-0.04, 0, r*0.5, 0.4,0.3,1.4); }
    const fan=grp(g,-0.25,0.1,0); for (let i=0;i<5;i++){ const a=(i-2)*0.42; const p=blob(fan, shellMat(i===2?0xf0a030:0x2a8ad0), -cos(a)*0.04,0,sin(a)*0.045, 0.045, 1.3,0.18,0.6); p.rotation.y=a; blob(fan, ceramic(0xf8e040), -cos(a)*0.06,0.008,sin(a)*0.07, 0.01, 1,0.4,1); }
    const club=shellMat(0xe84a6a,{ clearcoat:1 }); pairs(k=>{ rod(g, club, [0.26,0.1,k*0.03],[0.33,0.06,k*0.05],0.016,0.014,8); rod(g, club, [0.33,0.06,k*0.05],[0.28,0.04,k*0.06],0.022,0.02,8); blob(g, club, 0.27,0.04,k*0.065, 0.028, 1.2,1,0.9);
      for (let i=0;i<4;i++) leg(g, shellMat(0xf06a3a), [0.18-i*0.05,0.08,k*0.03],[0.18-i*0.05,0.06,k*0.07],[0.17-i*0.05,0.025,k*0.09],[0.16-i*0.05,0.004,k*0.1], 0.005);
      const st=bend(g, shellMat(d.c), [[0.29,0.15,k*0.015],[0.32,0.21,k*0.03],[0.33,0.25,k*0.04]], t=>0.007, 6, 8); const e=st[st.length-1]; const eb=blob(g, shellMat(0x2ad0a0,{iridescence:1}), e.x,e.y,e.z, 0.022, 1.25,0.8,0.8); eb.rotation.z=0.5; blob(g, ceramic(0x1a1410), e.x+0.004,e.y,e.z+k*0.004, 0.024, 0.25,0.85,0.85);
      bend(g, shellMat(0xf06a3a), [[0.3,0.13,k*0.02],[0.42,0.18,k*0.08],[0.52,0.17,k*0.15]], t=>0.003, 4, 10); const sc=blob(g, shellMat(0x2a8ad0), 0.34,0.14,k*0.05, 0.02, 1.5,0.3,0.8); sc.rotation.y=k*0.6; }); },
  // a round lump of a fish with a cave of needle teeth and a glowing lure on a rod
  angler(g,d,id,{skin,fin}){ const B=body(g, skin, 0.24, t=>0.2*Math.pow(sin(PI*clamp(t*0.9+0.06,0,1)),0.7)*(1-0.6*smooth(0.55,1,t)), 0.78, 0.22, { belly:1, fn:v=>{ v.multiplyScalar(1+fbm(v.x*16,v.y*16,v.z*16,5)*0.04); } });
    const mouth=blob(g, ceramic(0x1a0c10), 0.19,0.2,0, 0.11, 0.35,0.62,0.85); const tm=ceramic(0xe8ece0);
    for (let i=0;i<9;i++){ const a=-0.9+i/8*1.8; spike(g, tm, [0.2, 0.22+0.06, sin(a)*0.085],[0.3,-1,0],0.045+0.02*(i%2),0.006); spike(g, tm, [0.21, 0.13, sin(a)*0.08],[0.3,1,0],0.05+0.03*(i%2),0.007); }
    const lure=bend(g, shellMat(d.c), [[0.12,0.38,0],[0.22,0.5,0],[0.34,0.46,0]], t=>0.006*(1-t*0.5), 5, 12); const tip=lure[lure.length-1]; blob(g, glowM(0x9af0ff,2.6), tip.x, tip.y-0.02, 0, 0.025); spike(g, glowM(0x9af0ff,1.5), [tip.x,tip.y-0.04,0],[0,-1,0],0.03,0.008);
    tailFin(g, fin, TAILS.round, -0.22, 0.22, 0.55); finAt(g, fin, [[0.04,0],[0,0.05,-0.08,0.03],[-0.1,0]], -0.12,0.39,0, 0.8); pecs(g, fin, B, 0.5, -0.2, 0.55, PEC); eyeOn(g, B, 0.24, 0.62, 0.45, 0x8ad0d8); },
  // a sword for a nose, a tall sickle fin and a crescent tail
  swordfish(g,d,id,{skin,fin}){ const H=0.13, B=body(g, skin, 0.45, t=>H*prof(0.55,0.75,0.28,0.35)(t), 0.62); const sw=new THREE.ConeGeometry(0.03,0.48,10); sw.rotateZ(-PI/2); sw.scale(1,0.55,1.1); mesh(sw, shellMat(shade(d.c,-0.1)), 0.67,0.235,0, g);
    finAt(g, fin, [[0.1,0],[0.08,0.16,-0.02,0.26],[-0.04,0.1,-0.08,0.04],[-0.12,0]], 0.2,0.22+H*0.88,0, 1.1); finAt(g, fin, [[0.03,0],[-0.01,0.03,-0.04,0]], -0.36,0.22+H*0.3,0, 1);
    tailFin(g, fin, TAILS.lunate, -0.44, 0.22, 1.05); pairs(k=>{ const kl=mesh(new THREE.SphereGeometry(0.03,10,8), shellMat(d.c), -0.42,0.22,k*0.03, g, false); kl.scale.set(1.6,0.4,0.5); });
    pecs(g, fin, B, 0.2, -0.5, 1.1, [[0,0.01],[-0.04,0.02,-0.2,-0.1],[-0.1,-0.03,0,-0.012]], [0.4,0.5,-0.2]); finAt(g, fin, [[0.04,0],[0.02,-0.06,-0.08,-0.05],[-0.08,0]], -0.22,0.22-H*0.6,0, 0.8); eyeOn(g, B, 0.07, 0.2, 1.15, 0x4a6a8a); },
  // an eel-like shark with six frilled gill collars and a mouth full of three-pointed teeth
  frilledshark(g,d,id,{skin,fin}){ const E=eelBody(g, skin, [[0.5,0.22,0],[0.3,0.23,0.02],[0.05,0.21,-0.03],[-0.2,0.22,0.03],[-0.45,0.22,0]], t=>0.055*(1-smooth(0.6,1,t)*0.75)*(t<0.05?0.7+t*6:1), 0.85);
    const frill=shellMat(0x8a3a3a,{ roughness:0.5 }); for (let i=0;i<6;i++){ const p=E.pts[3+i*1], ri=mesh(new THREE.TorusGeometry(0.058,0.008,6,28), frill, p.x,p.y,p.z, g, false); ri.rotation.y=PI/2; ri.scale.set(1,1,0.85); displace(ri.geometry,v=>{ v.multiplyScalar(1+sin(Math.atan2(v.y,v.x)*14)*0.05); }); }
    const hd=blob(g, skin, 0.49,0.215,0, 0.05, 1.3,0.65,0.9); const jaw=blob(g, ceramic(0x3a1818), 0.53,0.2,0, 0.035, 1,0.35,0.8); teeth(g, [0.52,0.208,-0.025],[0.52,0.208,0.025], 6, 0.012, [0.2,-1,0], 0.003);
    const tp=E.pts.slice(-14); ribbonFin(g, fin, tp, t=>0.04*sin(PI*t), -1, 0, 1); ribbonFin(g, fin, E.pts.slice(-12,-5), t=>0.035*sin(PI*t), 1);
    tailFin(g, fin, [[0,0.02],[-0.1,0.04,-0.16,0.01],[-0.12,-0.06,0,-0.03]], -0.45, 0.22, 0.8); pecs(g, fin, { rf:()=>0.05, flat:0.85, y0:0.22, x:()=>0.3 }, 0, -0.6, 0.55); fishEye(g, 0.5,0.235,0.04, 0.6, 0x4ad0a0); },
  // a ribbon two metres long, silver with dashes, a red crest and red streamers
  oarfish(g,d,id,{skin}){ const E=eelBody(g, skin, [[0.6,0.24,0],[0.35,0.2,0.04],[0.1,0.26,-0.03],[-0.15,0.2,0.03],[-0.4,0.25,-0.02],[-0.6,0.21,0]], t=>0.06*(1-t*0.75)+0.004, 0.18, 70);
    const red=finMaterial(0xe8384a,0xff8080,id+'r'); ribbonFin(g, red, E.pts, t=>0.03*(1-t*0.6)+0.006, 1, 0.05, 1);
    for (let i=0;i<7;i++){ const p=E.pts[2+i]; rod(g, shellMat(0xe8384a), [p.x,p.y+0.05,0],[p.x+0.08-i*0.02,p.y+0.14+i*0.012,0], 0.004,0.002, 4); }
    pairs(k=>bend(g, shellMat(0xe8384a), [[0.52,0.2,k*0.01],[0.45,0.08,k*0.04],[0.3,0.03,k*0.05]], t=>0.004*(1-t*0.4), 4, 12)); blob(g, skin, 0.6,0.24,0, 0.06, 0.9,0.95,0.3); fishEye(g, 0.62,0.25,0.018, 0.7, 0xe8e8f0); },
  // a shark with a flat hammer of a head, an eye at each end
  hammerhead(g,d,id,{skin,fin}){ const H=0.13, B=body(g, skin, 0.46, t=>H*prof(0.5,0.75,0.3,0.35)(t), 0.8);
    const hs=new THREE.Shape(); hs.moveTo(0.06,0); hs.bezierCurveTo(0.08,0.12,0.04,0.24,-0.01,0.25); hs.lineTo(-0.04,0.2); hs.bezierCurveTo(-0.02,0.1,-0.04,0.04,-0.05,0); hs.bezierCurveTo(-0.04,-0.04,-0.02,-0.1,-0.04,-0.2); hs.lineTo(-0.01,-0.25); hs.bezierCurveTo(0.04,-0.24,0.08,-0.12,0.06,0);
    const hg=new THREE.ExtrudeGeometry(hs,{ depth:0.01, bevelEnabled:true, bevelThickness:0.018, bevelSize:0.014, bevelSegments:4, curveSegments:20 }); hg.rotateX(PI/2); mesh(hg, shellMat(d.c,{ roughness:0.45 }), 0.47,0.235,0, g);
    fishEye(g, 0.455,0.233,0.255, 0.55, 0xe0c060);
    finAt(g, fin, [[0.08,0],[0.04,0.08,-0.02,0.28],[-0.05,0.1,-0.1,0]], 0.08,0.22+H*0.88,0, 1.0); finAt(g, fin, [[0.03,0],[-0.01,0.05,-0.06,0]], -0.28,0.22+H*0.5,0, 0.8);
    tailFin(g, fin, TAILS.shark, -0.45, 0.22, 1.0); pecs(g, fin, B, 0.25, -0.6, 1.1, [[0,0.012],[-0.04,0.02,-0.18,-0.12],[-0.08,-0.04,0,-0.012]], [0.3,0.4,-0.2]);
    for (let i=0;i<5;i++) pairs(k=>rod(g, shellMat(shade(d.c,-0.15)), [0.25-i*0.025,0.24,k*0.1],[0.25-i*0.025,0.18,k*0.1],0.002,0.002,3)); },

  // ---------- river ----------
  // a big flat helmet head, fan pectorals and a body that tapers away
  sculpin(g,d,id,{skin,fin}){ g.userData.bottom=true; const B=body(g, skin, 0.3, t=>0.1*(1.3-0.95*smooth(0.05,1,t))*Math.pow(sin(PI*clamp(t*0.97+0.03,0,1)),0.35), 1.25, 0.14, { fn:v=>{ v.y*=0.75; if (v.y<0) v.y*=0.6; } });
    pairs(k=>{ spike(g, shellMat(shade(d.c,-0.1)), [0.17,0.15,k*0.1],[-0.4,0.3,k*1],0.04,0.008); finAt(g, fin, [[0,0.02],[-0.03,0.14,-0.16,0.12],[-0.2,0.0,-0.12,-0.03],[0,-0.02]], 0.12,0.12,k*0.09, 0.85, k*1.35,0,-0.15, 12); });
    finAt(g, fin, [[0.04,0],[0.02,0.06,-0.06,0.05],[-0.08,0]], 0.02,0.21,0, 0.8); finAt(g, fin, [[0.04,0],[0,0.05,-0.18,0.04],[-0.22,0]], -0.08,0.19,0, 0.9);
    tailFin(g, fin, TAILS.round, -0.29, 0.14, 0.55); eyeOn(g, B, 0.13, 0.72, 0.75, 0xd8b040); lips(g, B, d.c, 1.4); },
  // tiny, with a flat top and a deep keel of a belly, and wing-like pectorals held high
  hatchetfish(g,d,id,{skin,fin}){ const B=body(g, skin, 0.16, t=>0.07*Math.pow(sin(PI*clamp(t*0.97+0.03,0,1)),0.4)*(1-0.55*smooth(0.6,1,t)), 0.3, 0.26, { belly:1, fn:v=>{ if (v.y<0) v.y*=1+2.6*smooth(0.16,-0.08,-v.x)*smooth(-0.14,-0.02,v.x); else v.y*=0.55; } });
    pairs(k=>finAt(g, fin, [[0,0.01],[-0.04,0.12,-0.2,0.1],[-0.2,0.06],[0,-0.01]], 0.1,0.27,k*0.02, 0.8, k*0.5,0,0.25, 10));
    finAt(g, fin, [[0.03,0],[0,0.05,-0.05,0.03],[-0.06,0]], -0.07,0.3,0, 0.6); tailFin(g, fin, TAILS.fork, -0.15, 0.26, 0.45); eyeOn(g, B, 0.15, 0.25, 0.9, 0xe8eef2); },
  // goggle eyes on top of its head, propped up on its arm-fins, with a spotted sail
  mudskipper(g,d,id,{skin,fin}){ g.userData.bottom=true; const B=body(g, skin, 0.3, t=>0.075*(1.15-0.55*smooth(0,1,t))*Math.pow(sin(PI*clamp(t*0.98+0.02,0,1)),0.35), 0.8, 0.14, { fn:v=>{ v.y-=Math.max(0,-v.x)*0.25; } });
    pairs(k=>{ const e=grp(g,0.22,0.22,k*0.028); blob(e, skin, 0,-0.01,0, 0.03, 1,1,1); blob(e, ceramic(0x1a1410), 0.006,0.008,0, 0.024, 1,1,1); blob(e, ceramic(0xd8b060), 0.012,0.01,k*0.008, 0.016, 0.6,1,1); blob(e, glintMat(), 0.02,0.02,k*0.008, 0.005);
      bend(g, skin, [[0.16,0.12,k*0.05],[0.2,0.06,k*0.1],[0.23,0.01,k*0.12]], t=>0.016*(1-t*0.5), 8, 8); finAt(g, fin, [[0,0.012],[-0.02,0.03,-0.05,0.0],[0,-0.012]], 0.235,0.008,k*0.12, 0.8, -PI/2,0,0, 5); });
    const sail=finMaterial(0x6a5a4a,0x5ac0f0,id+'s'); finAt(g, sail, [[0.06,0],[0.08,0.16,-0.04,0.14],[-0.1,0]], 0.0,0.19,0, 0.9, 0,0,0, 10); for (let i=0;i<6;i++) blob(g, glowM(0x6ad8ff,0.6), 0.01-i*0.018, 0.24+0.03*sin(i), 0.002, 0.007, 1,1,0.3);
    finAt(g, fin, [[0.04,0],[0,0.06,-0.16,0.05],[-0.2,0]], -0.12,0.16,0, 0.8); tailFin(g, fin, TAILS.round, -0.29, 0.07, 0.5); lips(g, B, d.c); },
  // no jaws at all: a round sucker of rasping teeth, and seven gill holes in a row
  lamprey(g,d,id,{skin,fin}){ const E=eelBody(g, skin, [[0.42,0.22,0],[0.2,0.24,0.03],[0,0.2,-0.03],[-0.2,0.23,0.03],[-0.42,0.21,0]], t=>0.042*(1-smooth(0.7,1,t)*0.7), 0.9);
    const disc=grp(g,0.43,0.22,0); disc.rotation.y=PI/2; mesh(new THREE.TorusGeometry(0.04,0.012,10,28), shellMat(shade(d.c2,-0.05)), 0,0,0, disc, false); mesh(new THREE.CircleGeometry(0.04,24), ceramic(0x4a2020), 0,0,0.002, disc, false);
    for (let r=0;r<3;r++) for (let i=0;i<10+r*2;i++){ const a=i/(10+r*2)*TAU, rr=0.034-r*0.01; spike(disc, ceramic(0xf0e8a0), [cos(a)*rr, sin(a)*rr, 0.004],[ -cos(a)*0.4, -sin(a)*0.4, 1],0.008,0.0025); }
    pairs(k=>{ for (let i=0;i<7;i++){ const p=E.pts[4+i]; blob(g, ceramic(0x2a2018), p.x, p.y+0.005, p.z+k*0.039, 0.0065, 1,1,0.4); } });
    ribbonFin(g, fin, E.pts.slice(-18), t=>0.03*sin(PI*clamp(t*2,0,1))+0.02*sin(PI*clamp(t*2-1,0,1)), 1); fishEye(g, 0.37,0.24,0.034, 0.5, 0xc8b050); g.userData.tail=null; },
  // a deep, chunky body with an underbite full of triangle teeth and a red belly
  piranha(g,d,id,{skin,fin}){ const H=0.14, B=body(g, skin, 0.2, t=>H*Math.pow(sin(PI*clamp(t*0.96+0.03,0,1)),0.42)*(1-0.62*smooth(0.55,1,t)), 0.42, 0.22, { belly:1.08 });
    const jaw=blob(g, skin, 0.18,0.17,0, 0.05, 0.9,0.55,0.75); teeth(g, [0.215,0.192,-0.025],[0.215,0.192,0.025], 6, 0.018, [0.15,1,0], 0.006); teeth(g, [0.19,0.215,-0.022],[0.19,0.215,0.022], 5, 0.012, [0.1,-1,0], 0.005);
    finAt(g, fin, [[0.05,0],[0.02,0.08,-0.06,0.07],[-0.08,0]], -0.02,0.22+H*0.92,0, 0.8); blob(g, shellMat(d.c), -0.13,0.22+H*0.45,0, 0.02, 1.2,0.7,0.3);
    finAt(g, fin, [[0.06,0],[0.02,-0.06,-0.08,-0.05],[-0.1,0]], -0.05,0.22-H*0.92,0, 0.9); tailFin(g, fin, TAILS.square, -0.19, 0.22, 0.6); pecs(g, fin, B, 0.32, -0.3, 0.55); eyeOn(g, B, 0.15, 0.3, 0.8, 0xd84020); },
  // a slim trout body with a huge painted sail of a dorsal fin
  grayling(g,d,id,{skin,fin}){ const H=0.09, B=body(g, skin, 0.34, t=>H*prof(0.38,0.65,0.25)(t), 0.5); const sail=finMaterial(0x7a4a8a,0xe84a6a,id+'s');
    const sf=finAt(g, sail, [[0.16,0],[0.1,0.2,-0.08,0.22],[-0.16,0.16,-0.2,0.0]], 0.08,0.22+H*0.85,0, 1, 0,0,0, 18); for (let i=0;i<14;i++) blob(g, ceramic(i%3?0x3a7ad8:0xe85a5a), 0.08-i*0.018+((i*7)%3)*0.01, 0.22+H*0.9+0.03+((i*5)%4)*0.03, 0.002, 0.006, 1,1,0.3);
    blob(g, shellMat(d.c), -0.22,0.22+H*0.6,0, 0.02, 1.3,0.7,0.3); finAt(g, fin, ANAL, -0.15,0.22-H*0.82,0, 0.7); pelvics(g, fin, B, 0.48, 0.8); pecs(g, fin, B, 0.2, -0.2, 0.7);
    tailFin(g, fin, TAILS.fork, -0.33, 0.22, 0.75); eyeOn(g, B, 0.08, 0.2, 0.85, 0xd8d0a0); lips(g, B, d.c); },
  // a shark-shaped body with a long paddle of a snout
  paddlefish(g,d,id,{skin,fin}){ const H=0.1, B=body(g, skin, 0.4, t=>H*prof(0.5,0.75,0.3,0.35)(t), 0.75);
    const ps=new THREE.Shape(); ps.moveTo(0,0.03); ps.bezierCurveTo(0.12,0.035,0.26,0.06,0.33,0.04); ps.bezierCurveTo(0.36,0.02,0.36,-0.02,0.33,-0.04); ps.bezierCurveTo(0.26,-0.06,0.12,-0.035,0,-0.03);
    const pg=new THREE.ExtrudeGeometry(ps,{ depth:0.004, bevelEnabled:true, bevelThickness:0.006, bevelSize:0.004, bevelSegments:3, curveSegments:16 }); pg.rotateX(PI/2); painted(g, pg, (v,n,o)=>{ o.set(d.c); if (fbm(v.x*40,v.z*40,0,3)>0.25) o.offsetHSL(0,0,0.1); }, 0.38,0.23,0);
    blob(g, ceramic(0xe8d0c8), 0.36,0.19,0, 0.05, 0.6,0.5,0.9); finAt(g, fin, [[0.05,0],[0.02,0.1,-0.06,0.12],[-0.08,0]], -0.08,0.22+H*0.85,0, 1); tailFin(g, fin, TAILS.shark, -0.39, 0.22, 0.9);
    finAt(g, fin, ANAL, -0.18,0.22-H*0.8,0, 0.8); pecs(g, fin, B, 0.22, -0.55, 0.8); eyeOn(g, B, 0.04, 0.3, 0.4); },
  // a long blade of a fish with big jade scales, an upturned mouth, two chin whiskers and fins swept to the tail
  arowana(g,d,id,{skin,fin}){ const H=0.1, B=body(g, skin, 0.42, t=>H*Math.pow(sin(PI*clamp(t*0.98+0.01,0,1)),0.4)*(1-0.45*smooth(0.55,1,t)), 0.35, 0.22, { fn:v=>{ if (v.y>0) v.y*=0.6+0.4*smooth(0.42,0.1,v.x); } });
    pairs(k=>bend(g, shellMat(shade(d.c,-0.08)), [[0.42,0.21,k*0.008],[0.5,0.235,k*0.02],[0.58,0.25,k*0.03]], t=>0.004*(1-t*0.5), 4, 8));
    rod(g, shellMat(shade(d.c,-0.15)), [0.32,0.215,0],[0.43,0.255,0], 0.005,0.003,4);
    finAt(g, fin, [[0.05,0],[0.04,0.06,-0.1,0.06],[-0.18,0.01]], -0.2,0.22+H*0.5,0, 1, 0,0,0, 10); finAt(g, fin, [[0.12,0],[0.06,-0.09,-0.12,-0.07],[-0.2,-0.01]], -0.16,0.22-H*0.55,0, 1, 0,0,0, 12);
    tailFin(g, fin, TAILS.round, -0.41, 0.22, 0.75); pecs(g, fin, B, 0.25, -0.5, 0.9); pelvics(g, fin, B, 0.45, 0.7); eyeOn(g, B, 0.08, 0.35, 0.95, 0xe8c060); },
  // an armoured river giant: shovel snout, rows of bony plates and four whiskers
  sturgeon(g,d,id,{skin,fin}){ const H=0.11, B=body(g, skin, 0.48, t=>H*prof(0.6,0.75,0.3,0.4)(t), 0.75); const sn=new THREE.ConeGeometry(0.07,0.18,12); sn.rotateZ(-PI/2); sn.scale(1,0.4,1); mesh(sn, skin, 0.53,0.21,0, g);
    const plate=shellMat(shade(d.c2,-0.1),{ roughness:0.5 }); for (let i=0;i<13;i++){ const t=0.12+i*0.06, x=B.x(t), R=B.rf(t); spike(g, plate, [x,0.22+R*0.95,0],[0.3,1,0],0.03,0.016);
      pairs(k=>{ spike(g, plate, [x,0.22+R*0.2,k*R*0.72],[0.3,0.1,k*1],0.022,0.012); spike(g, plate, [x,0.22-R*0.5,k*R*0.58],[0.3,-0.4,k*1],0.018,0.01); }); }
    for (let i=0;i<4;i++){ const z=(i-1.5)*0.012; bend(g, shellMat(d.c2), [[0.52,0.19,z],[0.53,0.16,z*1.3],[0.55,0.15,z*1.6]], t=>0.003, 4, 6); }
    finAt(g, fin, [[0.05,0],[0.02,0.06,-0.08,0.05],[-0.1,0]], -0.25,0.22+H*0.55,0, 0.9); tailFin(g, fin, TAILS.shark, -0.47, 0.22, 0.95); pecs(g, fin, B, 0.25, -0.6, 0.8); eyeOn(g, B, 0.12, 0.45, 0.55, 0x8a7a50); },

  // ---------- pond ----------
  frog(g,d,id){ const sk=n=>(v,nn,o)=>{ o.set(d.c).lerp(col(d.c2), clamp(-nn.y*1.2,0,1)); if (n && fbm(v.x*30,v.y*30,v.z*30,7)>0.3 && nn.y>-0.2) o.offsetHSL(0,0.05,-0.18); };
    const b=welded(sph(0.13,36,24)); displace(b,v=>{ v.x*=1.25; v.y*=0.72; if (v.x<0) v.y*=1.1; }); const bm=painted(g, b, sk(true), -0.02,0.13,0); bm.rotation.z=0.35;
    const h=welded(sph(0.1,32,20)); displace(h,v=>{ v.x*=1.05; v.y*=0.62; v.z*=1.18; }); painted(g, h, sk(true), 0.12,0.17,0);
    pairs(k=>{ blob(g, ceramic(d.c), 0.15,0.22,k*0.065, 0.038); blob(g, ceramic(0xd8a030), 0.165,0.235,k*0.08, 0.026, 0.6,0.9,0.9); blob(g, ceramic(0x0a0a0a), 0.178,0.237,k*0.083, 0.018, 0.35,0.45,0.9); blob(g, glintMat(), 0.185,0.245,k*0.088, 0.006);
      const lm=vcPhys({ roughness:0.4 }); const leg2=welded(new THREE.CapsuleGeometry(0.04,0.1,8,12)); setColors(leg2,(v,n,o)=>o.set(d.c)); const th=mesh(leg2, lm, -0.08,0.08,k*0.11, g); th.rotation.set(k*0.3,k*0.6,1.2);
      const sh=mesh(leg2.clone(), lm, -0.02,0.04,k*0.15, g); sh.rotation.set(0,k*0.3,-1.4); sh.scale.setScalar(0.85);
      for (let i=0;i<4;i++) bend(g, shellMat(d.c), [[0.02,0.02,k*0.15],[0.08,0.008,k*(0.13+i*0.02)],[0.12,0.004,k*(0.11+i*0.04)]], t=>0.008*(1-t*0.4), 5, 6);
      bend(g, shellMat(d.c), [[0.1,0.1,k*0.06],[0.13,0.05,k*0.09],[0.16,0.008,k*0.1]], t=>0.016*(1-t*0.4), 8, 8); for (let i=0;i<3;i++) blob(g, shellMat(d.c), 0.17+i*0.008,0.006,k*(0.085+i*0.012), 0.008);
      const ear=mesh(new THREE.CircleGeometry(0.022,16), ceramic(shade(d.c,-0.15)), 0.1,0.19,k*0.088, g, false); ear.rotation.y=k*PI/2; });
    const mouth=curve([[0.215,0.15,0],[0.2,0.152,0.06],[0.13,0.16,0.105]],10); mesh(tube(mouth,()=>0.003,4), ceramic(0x2a3a1a), 0,0,0, g, false); const m2=curve([[0.215,0.15,0],[0.2,0.152,-0.06],[0.13,0.16,-0.105]],10); mesh(tube(m2,()=>0.003,4), ceramic(0x2a3a1a), 0,0,0, g, false); },
  // three sharp spines on its back and a red throat
  stickleback(g,d,id,{skin,fin}){ const H=0.07, B=body(g, skin, 0.22, t=>H*prof(0.42,0.75,0.25,0.45)(t), 0.42); const sp=shellMat(0xd8d0b0,{ roughness:0.3 });
    for (const [x,h] of [[0.08,0.07],[0.02,0.08],[-0.04,0.035]]){ spike(g, sp, [x,0.22+H*0.85,0],[-0.15,1,0],h,0.006); finAt(g, fin, [[0.004,0],[-0.002,h*0.6,-0.02,0.0]], x,0.22+H*0.85,0, 1, 0,0,0, 3); }
    pairs(k=>spike(g, sp, [0.08,0.22-H*0.8,k*0.02],[-0.6,-0.6,k*0.3],0.05,0.005)); for (let i=0;i<5;i++) pairs(k=>blob(g, shellMat(shade(d.c,0.08),{metalness:0.4}), 0.07-i*0.035,0.215,k*H*0.4, 0.016, 0.6,1.4,0.2));
    finAt(g, fin, [[0.06,0],[0,0.05,-0.1,0.03],[-0.12,0]], -0.07,0.22+H*0.8,0, 0.7); finAt(g, fin, [[0.06,0],[0,-0.05,-0.1,-0.03],[-0.12,0]], -0.07,0.22-H*0.8,0, 0.7);
    tailFin(g, fin, TAILS.square, -0.21, 0.22, 0.45); pecs(g, fin, B, 0.25, -0.1, 0.5); eyeOn(g, B, 0.1, 0.25, 0.7, 0x5ad8f0); },
  // see-through: you can count its bones
  glassfish(g,d,id,{fin}){ const H=0.1, rf=t=>H*Math.pow(sin(PI*clamp(t*0.97+0.03,0,1)),0.42)*(1-0.6*smooth(0.55,1,t)); const B=body(g, glassy(0xe8f4f0,0.28), 0.2, rf, 0.32); B.m.renderOrder=2;
    const bone=ceramic(0xf2f4ee); bend(g, bone, [[0.15,0.24,0],[0.0,0.235,0],[-0.19,0.22,0]], t=>0.004, 5, 20); for (let i=0;i<14;i++){ const x=0.1-i*0.02, R=rf((0.2-x)/0.4); rod(g, bone, [x,0.236,0],[x-0.015,0.236+R*0.75,0], 0.0015,0.001,3); if (x>-0.04) bend(g, bone, [[x,0.234,0],[x-0.01,0.22-R*0.3,0.008],[x-0.025,0.22-R*0.8,0]], t=>0.0016, 3, 6); }
    blob(g, shellMat(0xd8dce8,{ metalness:0.8, roughness:0.2 }), 0.06,0.2,0, 0.04, 1.2,0.7,0.6); blob(g, ceramic(0xf0c0a0), 0.14,0.21,0, 0.02, 1,0.8,0.6);
    finAt(g, fin, [[0.05,0],[0.02,0.06,-0.04,0.06],[-0.06,0]], 0.03,0.22+H*0.9,0, 0.7); finAt(g, fin, [[0.04,0],[0,0.05,-0.1,0.04],[-0.12,0]], -0.04,0.22+H*0.8,0, 0.7); finAt(g, fin, [[0.06,0],[0,-0.06,-0.1,-0.04],[-0.12,0]], -0.02,0.22-H*0.85,0, 0.75);
    tailFin(g, fin, TAILS.fork, -0.19, 0.22, 0.5); eyeOn(g, B, 0.12, 0.25, 0.8, 0xd8e8f0); },
  // a tall triangle with sweeping fins and long thread feelers
  angelfish(g,d,id,{skin,fin}){ const H=0.13, B=body(g, skin, 0.16, t=>H*Math.pow(sin(PI*clamp(t*0.97+0.02,0,1)),0.5)*(1-0.5*smooth(0.7,1,t)), 0.25);
    finAt(g, fin, [[0.1,0],[0.04,0.2,-0.12,0.36],[-0.06,0.12,-0.16,0.0]], 0.02,0.22+H*0.8,0, 1, 0,0,0, 14); finAt(g, fin, [[0.08,0],[0.02,-0.2,-0.14,-0.34],[-0.08,-0.12,-0.16,0.0]], 0.0,0.22-H*0.8,0, 1, 0,0,0, 14);
    pairs(k=>bend(g, shellMat(d.c), [[0.06,0.22-H*0.85,k*0.01],[0.02,0.02,k*0.03],[-0.06,-0.1,k*0.02]], t=>0.003, 4, 12));
    tailFin(g, fin, [[0,0.02],[-0.06,0.1,-0.2,0.2],[-0.12,0.02],[-0.12,-0.02],[-0.2,-0.2],[-0.06,-0.1,0,-0.02]], -0.15, 0.22, 0.7); pecs(g, fin, B, 0.3, -0.1, 0.45); eyeOn(g, B, 0.2, 0.18, 0.75, 0xd83a2a); lips(g, B, d.c, 0.7); },
  // a little body under huge veil fins that drape and trail
  betta(g,d,id,{skin}){ const H=0.07, B=body(g, skin, 0.16, t=>H*prof(0.4,0.6,0.25)(t), 0.45); const veil=finMaterial(d.c2,d.c,id+'v'), veil2=finMaterial(d.c,d.c2,id+'v2');
    tailFin(g, veil, [[0,0.03],[-0.1,0.16,-0.3,0.26],[-0.42,0.08,-0.4,-0.06],[-0.36,-0.26,-0.24,-0.32],[-0.08,-0.14,0,-0.03]], -0.14, 0.22, 0.9, 18);
    finAt(g, veil2, [[0.06,0],[0.02,0.14,-0.14,0.16],[-0.26,0.06,-0.2,0.0]], -0.02,0.22+H*0.8,0, 0.9, 0,0,0, 12); finAt(g, veil, [[0.1,0],[0.04,-0.2,-0.18,-0.28],[-0.26,-0.1,-0.18,0.0]], 0.04,0.22-H*0.8,0, 0.9, 0,0,0, 14);
    pairs(k=>bend(g, shellMat(d.c2), [[0.06,0.22-H*0.8,k*0.01],[0.04,0.1,k*0.03],[0.0,0.04,k*0.02]], t=>0.005*(1-t*0.6), 4, 10)); pecs(g, finMaterial(0xf0f0f8,0xffffff,id+'p'), B, 0.3, -0.1, 0.4); eyeOn(g, B, 0.1, 0.2, 0.7, 0x2a2a2a); lips(g, B, d.c, 0.7); },
  // a dark slim fish with a long trunk curving down from its chin
  elephantnose(g,d,id,{skin,fin}){ const H=0.065, B=body(g, skin, 0.3, t=>H*prof(0.45,0.75,0.25,0.5)(t), 0.42); bend(g, skin, [[0.28,0.2,0],[0.36,0.18,0],[0.42,0.12,0],[0.43,0.07,0]], t=>0.016*(1-t*0.5), 8, 14);
    finAt(g, fin, [[0.04,0],[0.02,0.06,-0.1,0.05],[-0.14,0]], -0.12,0.22+H*0.85,0, 0.8); finAt(g, fin, [[0.04,0],[0.02,-0.06,-0.1,-0.05],[-0.14,0]], -0.12,0.22-H*0.85,0, 0.8);
    rod(g, skin, [-0.28,0.22,0],[-0.36,0.22,0], 0.014,0.01, 8); tailFin(g, fin, TAILS.fork, -0.35, 0.22, 0.6); pecs(g, fin, B, 0.18, -0.2, 0.5); eyeOn(g, B, 0.07, 0.3, 0.45, 0x8a8a8a);
    },
  // a thick salamander-ish fish with thread fins, a paddle tail, and lungs
  lungfish(g,d,id,{skin,fin}){ const E=eelBody(g, skin, [[0.42,0.2,0],[0.2,0.21,0.03],[0,0.2,-0.02],[-0.2,0.21,0.02],[-0.42,0.2,0]], t=>0.065*(1-smooth(0.55,1,t)*0.8), 0.85);
    ribbonFin(g, fin, E.pts.slice(-22), t=>0.04*sin(PI*clamp(t*1.05,0,1)), 1); ribbonFin(g, fin, E.pts.slice(-20), t=>0.035*sin(PI*clamp(t*1.05,0,1)), -1);
    for (const [i,s] of [[12,1],[26,0.8]]){ const p=E.pts[i]; pairs(k=>bend(g, shellMat(shade(d.c,0.05)), [[p.x,p.y-0.03,p.z+k*0.04],[p.x-0.06,p.y-0.09,p.z+k*0.08],[p.x-0.14*s,p.y-0.12,p.z+k*0.1]], t=>0.006*(1-t*0.6), 5, 12)); }
    blob(g, skin, 0.43,0.2,0, 0.055, 1,0.85,0.85); fishEye(g, 0.45,0.215,0.04, 0.45, 0x8a8a50); },
  // feathery gills, little hands and a smile
  axolotl(g,d,id){ const sk=ceramic(d.c), gill=shellMat(d.c2,{ roughness:0.5 });
    const b=welded(new THREE.CapsuleGeometry(0.07,0.22,10,18)); b.rotateZ(PI/2); displace(b,v=>{ v.y*=0.85; v.multiplyScalar(1+fbm(v.x*20,v.y*20,v.z*20,3)*0.02); }); mesh(b, sk, -0.02,0.12,0, g);
    const h=welded(sph(0.1,32,22)); displace(h,v=>{ v.x*=0.85; v.y*=0.62; v.z*=1.1; }); mesh(h, sk, 0.2,0.13,0, g);
    const tl=grp(g,-0.18,0.12,0); const tp=curve([[0,0,0],[-0.12,0.01,0],[-0.26,0.0,0]],12); mesh(tube(tp,t=>0.045*(1-t)+0.004,10,{ squash:0.35 }), sk, 0,0,0, tl); ribbonFin(tl, finMaterial(d.c,0xffffff,id), tp, t=>0.04*sin(PI*t), 1); ribbonFin(tl, finMaterial(d.c,0xffffff,id), tp.slice(4), t=>0.03*sin(PI*t), -1); g.userData.tail=tl;
    const gills=[]; pairs(k=>{ for (let i=0;i<3;i++){ const G=keep(g, grp(g, 0.14, 0.17+i*0.025-0.025, k*0.09)); gills.push(G); const st=curve([[0,0,0],[-0.04,0.03+i*0.015,k*0.03],[-0.09,0.04+i*0.03,k*0.05]],10); mesh(tube(st,t=>0.008*(1-t*0.5),5), gill, 0,0,0, G, false);
      for (let j=2;j<9;j++){ const p=st[j]; for (const s of [1,-1]) spike(G, gill, [p.x,p.y,p.z],[ -0.3, s*0.7, k*0.4],0.025,0.004); } } });
    pairs(k=>{ for (const [x,s] of [[0.1,1],[-0.12,1.1]]){ bend(g, sk, [[x,0.1,k*0.05],[x+0.02,0.05,k*0.09],[x+0.05,0.006,k*0.1]], t=>0.014*(1-t*0.4), 6, 8); for (let i=0;i<4;i++) bend(g, sk, [[x+0.05,0.006,k*0.1],[x+0.07+0.005*i,0.004,k*(0.09+i*0.012)]], ()=>0.004, 4, 3); } });
    pairs(k=>{ blob(g, ceramic(0x1a1012), 0.27,0.15,k*0.07, 0.012); blob(g, glintMat(), 0.278,0.155,k*0.075, 0.003); });
    mesh(tube(curve([[0.285,0.105,-0.05],[0.3,0.1,0],[0.285,0.105,0.05]],10),()=>0.003,4), ceramic(0x8a3a4a), 0,0,0, g, false);
    g.userData.idle=t=>gills.forEach((G,i)=>{ G.rotation.x=sin(t*2+i)*0.12; G.rotation.z=sin(t*1.6+i*0.7)*0.1; }); },

  // ---------- Cay Bay ----------
  // a diamond of a fish, painted like a canvas, with its eye far back and a trigger spine
  triggerfish(g,d,id,{skin,fin}){ const H=0.14, B=body(g, skin, 0.22, t=>H*(t<0.45? smooth(-0.1,0.45,t)*0.85+0.15 : 1-0.75*smooth(0.45,1,t)), 0.38, 0.22, { segs:48 });
    spike(g, shellMat(0x2a2a2a), [0.02,0.22+H*0.85,0],[-0.3,1,0],0.06,0.008); finAt(g, fin, [[0.02,0],[0.0,0.08,-0.16,0.06],[-0.2,0]], -0.02,0.22+H*0.7,0, 0.9, 0,0,0, 12); finAt(g, fin, [[0.02,0],[0.0,-0.08,-0.16,-0.06],[-0.2,0]], -0.02,0.22-H*0.7,0, 0.9, 0,0,0, 12);
    tailFin(g, fin, TAILS.square, -0.21, 0.22, 0.55); pecs(g, fin, B, 0.4, 0.0, 0.45); eyeOn(g, B, 0.36, 0.45, 0.85, 0x3a6ad8); blob(g, shellMat(0xf0d040), 0.22,0.21,0, 0.018, 0.7,0.5,1); },
  // a little goby in psychedelic swirls with a tall fan of a fin
  mandarin(g,d,id,{skin,fin}){ const H=0.07, B=body(g, skin, 0.18, t=>H*(1.15-0.55*smooth(0,1,t))*Math.pow(sin(PI*clamp(t*0.97+0.03,0,1)),0.35), 0.75); const fan=finMaterial(0xf08a2a,0x3a6ad8,id+'f');
    finAt(g, fan, [[0.03,0],[0.04,0.16,-0.02,0.16],[-0.04,0]], 0.03,0.22+H*0.8,0, 0.9, 0,0,0, 6); finAt(g, fan, [[0.02,0],[0,0.08,-0.14,0.07],[-0.16,0]], -0.05,0.22+H*0.7,0, 0.8); finAt(g, fan, [[0.02,0],[0,-0.06,-0.14,-0.05],[-0.16,0]], -0.04,0.22-H*0.7,0, 0.8);
    pairs(k=>finAt(g, fan, [[0,0.02],[-0.02,0.08,-0.09,0.07],[-0.12,0.0,-0.08,-0.04],[0,-0.02]], 0.08,0.21,k*0.05, 0.8, k*1.1,0,-0.2, 10)); tailFin(g, fan, TAILS.round, -0.17, 0.22, 0.55);
    pairs(k=>{ const e=grp(g,0.13,0.26,k*0.032); blob(e, ceramic(0xf08a2a), 0,0,0, 0.022); blob(e, ceramic(0x1a1012), 0.008,0.004,k*0.008, 0.016); blob(e, glintMat(), 0.014,0.01,k*0.012, 0.004); }); lips(g, B, 0xf08a2a, 0.8); },
  // a spiny lobster: no big claws, but two long spiked feelers and a crown of horns
  lobster(g,d,id){ const sh=shellMat(d.c,{ clearcoat:1, roughness:0.3 }), lt=shellMat(d.c2,{ clearcoat:0.8 }), sp=shellMat(0xf2e0c0);
    const ca=welded(sph(0.1,32,20)); displace(ca,v=>{ v.x*=1.6; v.z*=0.85; v.y*=0.85; }); mesh(ca, sh, 0.1,0.12,0, g); for (let i=0;i<20;i++){ const a=i*2.4, x=0.02+(i%7)*0.03, z=sin(a)*0.06; spike(g, sp, [x,0.12+Math.sqrt(Math.max(0,0.008-z*z))*0.9+0.04,z],[0.3,1,z*6],0.022,0.006); }
    pairs(k=>spike(g, sp, [0.24,0.17,k*0.03],[0.6,0.8,k*0.3],0.06,0.012));
    for (let i=0;i<6;i++){ const r=0.075-i*0.009, s=mesh(sph(r,20,12,0,TAU,0,PI*0.62), i%2?sh:lt, -0.05-i*0.055,0.1,0, g, false); s.scale.set(0.8,0.8,1.1); blob(g, ceramic(0xf8f0e0), -0.05-i*0.055,0.15-i*0.006,k0(i)*0.04, 0.008); }
    const fan=grp(g,-0.39,0.1,0); for (let i=0;i<5;i++){ const a=(i-2)*0.4; const p=blob(fan, i%2?lt:sh, -cos(a)*0.05, 0, sin(a)*0.05, 0.05, 1.3,0.15,0.7); p.rotation.y=a; }
    pairs(k=>{ const an=curve([[0.24,0.14,k*0.04],[0.4,0.22,k*0.12],[0.62,0.26,k*0.22],[0.82,0.2,k*0.28]],24); mesh(tube(an,t=>0.018*(1-t*0.85),8), sh, 0,0,0, g, false); for (let i=1;i<20;i+=2) spike(g, sp, [an[i].x,an[i].y,an[i].z],[0.3,0.6,k*0.5],0.018*(1-i/24),0.004);
      bend(g, lt, [[0.25,0.13,k*0.015],[0.32,0.16,k*0.03],[0.36,0.15,k*0.05]], t=>0.005, 4, 6); compoundEye(g, 0.24,0.17,k*0.05, 0.018, 0x1a1410);
      for (let i=0;i<5;i++) leg(g, lt, [0.12-i*0.04,0.08,k*0.04],[0.12-i*0.045,0.12,k*0.13],[0.1-i*0.05,0.06,k*0.19],[0.09-i*0.05,0.004,k*0.22], 0.0075); }); },
  // armour plates like a pine cone, and two lights on its chin
  pinecone(g,d,id,{fin}){ const geo=welded(sph(0.13,48,32)); displace(geo,v=>{ v.x*=1.35; v.z*=0.8; if (v.x<-0.05) v.multiplyScalar(1+(v.x+0.05)*1.2); const u=Math.atan2(v.z,v.y)*5, w=v.x*28; const cu=u-Math.round(u), cw=w-Math.round(w+((Math.round(u)%2)?0.5:0)); v.multiplyScalar(1+0.06*(1-Math.min(1,Math.hypot(cu,cw)*2.2))); });
    painted(g, geo, (v,n,o)=>{ const u=Math.atan2(v.z,v.y)*5, w=v.x*28; const cu=u-Math.round(u), cw=w-Math.round(w+((Math.round(u)%2)?0.5:0)); const e=Math.hypot(cu,cw); o.set(d.c); if (e>0.38) o.set(d.c2); else o.offsetHSL(0,0,(0.38-e)*0.3); }, 0,0.22,0, { roughness:0.45 });
    blob(g, glowM(0x5af0b0,2.2), 0.15,0.17,0.03, 0.012, 1.6,0.6,1); blob(g, glowM(0x5af0b0,2.2), 0.15,0.17,-0.03, 0.012, 1.6,0.6,1); blob(g, ceramic(0x2a1a10), 0.17,0.19,0, 0.03, 0.5,0.45,1);
    for (let i=0;i<5;i++) spike(g, shellMat(d.c2), [0.06-i*0.03,0.33-i*0.005,0],[-0.4,1,0],0.05+(i===1?0.02:0),0.007); pairs(k=>spike(g, shellMat(d.c2), [0.04,0.1,k*0.04],[0,-1,k*0.6],0.06,0.008));
    rod(g, shellMat(d.c), [-0.17,0.22,0],[-0.22,0.22,0], 0.02,0.012,8); tailFin(g, fin, TAILS.square, -0.21, 0.22, 0.5); fishEye(g, 0.13,0.25,0.06, 0.85, 0xf0e0a0); },
  // leaves everywhere: it hides in the weed by looking exactly like it
  seadragon(g,d,id,{skin}){ const sp=curve([[0.3,0.3,0],[0.12,0.28,0],[-0.05,0.26,0],[-0.2,0.2,0],[-0.28,0.12,0],[-0.24,0.06,0],[-0.18,0.08,0]],50);
    mesh(tube(sp, t=>0.035*sin(PI*clamp(t*1.3+0.1,0,1))**0.5*(1-t*0.7)+0.005, 10, { ring:(t,a)=>1+0.1*Math.max(0,sin(t*140)) }), skin, 0,0,0, g);
    blob(g, skin, 0.33,0.31,0, 0.035, 1.2,0.9,0.75); rod(g, skin, [0.35,0.31,0],[0.5,0.3,0], 0.012,0.009,8); fishEye(g, 0.33,0.32,0.024, 0.55, 0xe8c050);
    const leafM=shellMat(d.c2,{ roughness:0.5, side:THREE.DoubleSide }), leafM2=shellMat(d.c,{ roughness:0.5, side:THREE.DoubleSide }); const leaves=[];
    const leafAt=(p, dir, L, m)=>{ const Lg=keep(g, grp(g, p.x,p.y,p.z)); leaves.push(Lg); const st=V3(...dir).normalize().multiplyScalar(L*0.4); rod(Lg, m, [0,0,0],[st.x,st.y,st.z], 0.004,0.003,4);
      for (let j=0;j<3;j++){ const lf=mesh(new THREE.CircleGeometry(L*0.35,10), m, st.x+dir[0]*L*0.3*j*0.6, st.y+dir[1]*L*0.3*j*0.6+(j-1)*L*0.15, st.z+dir[2]*L*0.3*j*0.6, Lg, false); lf.scale.set(1.6,0.6,1); lf.lookAt(Lg.position.clone().add(V3(0,1,0))); lf.rotation.z+=j; } };
    for (let i=0;i<9;i++){ const p=sp[3+i*5]; for (const s of [1,-1]) leafAt(p, [0.1*s-0.2, i%2? 0.7:-0.7, s*0.8], 0.1-i*0.004, i%2?leafM:leafM2); }
    leafAt(sp[8], [0.1,1,0], 0.12, leafM); leafAt(sp[20], [-0.2,1,0.2], 0.1, leafM2); leafAt(V3(0.38,0.32,0), [0.2,1,0], 0.06, leafM);
    g.userData.idle=t=>leaves.forEach((L,i)=>{ L.rotation.z=sin(t*1.3+i*0.6)*0.25; L.rotation.x=sin(t*0.9+i)*0.15; }); },
  // the biggest fish of all: a wide flat mouth, a sky of white spots, and two little hitchhikers
  whaleshark(g,d,id,{skin,fin}){ const H=0.14, B=body(g, skin, 0.5, t=>H*prof(0.25,0.75,0.25,0.35)(t), 1.15, 0.24, { fn:v=>{ if (v.x>0.3) v.y*=1-((v.x-0.3)*1.6); } });
    blob(g, ceramic(0x2a2a30), 0.49,0.22,0, 0.06, 0.15,0.25,1.35); for (const y of [0.04,0]) pairs(k=>rod(g, shellMat(shade(d.c,0.08)), [0.4,0.24+H*(0.9-y*8),k*0.03+k*y],[-0.3,0.24+H*0.6,k*0.03+k*y], 0.008,0.004,5));
    finAt(g, fin, [[0.06,0],[0.02,0.06,-0.06,0.18],[-0.12,0]], 0.0,0.24+H*0.88,0, 1.1); finAt(g, fin, [[0.03,0],[-0.01,0.05,-0.06,0]], -0.3,0.24+H*0.55,0, 0.8); tailFin(g, fin, TAILS.lunate, -0.49, 0.24, 1.0);
    pecs(g, fin, B, 0.3, -0.6, 1.3, [[0,0.012],[-0.04,0.02,-0.2,-0.12],[-0.08,-0.04,0,-0.012]], [0.4,0.4,-0.2]); for (let i=0;i<5;i++) pairs(k=>rod(g, shellMat(shade(d.c,-0.15)), [0.33-i*0.03,0.26,k*0.15],[0.33-i*0.03,0.18,k*0.155],0.003,0.003,3));
    fishEye(g, 0.44,0.245,0.13, 0.5, 0x6a7a8a);
    for (const [x,z] of [[0.05,0.05],[-0.1,-0.06]]){ const r=grp(g,x,0.06,z); blob(r, shellMat(0x8a8478), 0,0,0, 0.02, 3.2,0.6,0.8); fishEye(r, 0.05,0.006,0.012, 0.25); } },

  // ---------- the isles ----------
  // a flat pancake that walks on its fins, with bright red lips and a little horn
  batfish(g,d,id,{skin,fin}){ g.userData.bottom=true; const disc=welded(sph(0.16,40,24)); displace(disc,v=>{ v.y*=0.32; v.multiplyScalar(1+fbm(v.x*30,v.y*30,v.z*30,4)*0.05); if (v.x>0.08) v.y+=0.01; });
    painted(g, disc, (v,n,o)=>{ o.set(d.c).lerp(col(0xf0e8d8), clamp(-n.y,0,1)); if (fbm(v.x*40,v.z*40,1,6)>0.35) o.offsetHSL(0,0,-0.12); }, 0,0.09,0, { roughness:0.6 });
    const tb=tube(curve([[-0.12,0.09,0],[-0.22,0.09,0],[-0.3,0.09,0]],10), t=>0.04*(1-t*0.7), 10); mesh(tb, skin, 0,0,0, g); tailFin(g, fin, TAILS.round, -0.29, 0.09, 0.5);
    blob(g, ceramic(0xe8303a), 0.16,0.1,0, 0.03, 0.55,0.55,1.2); blob(g, ceramic(0xe8303a), 0.155,0.085,0, 0.028, 0.5,0.4,1.1); spike(g, skin, [0.13,0.14,0],[1,0.5,0],0.07,0.012);
    pairs(k=>{ bend(g, skin, [[0.0,0.08,k*0.13],[0.06,0.05,k*0.2],[0.12,0.006,k*0.22]], t=>0.018*(1-t*0.4), 8, 8); finAt(g, fin, [[0,0.015],[-0.02,0.03,-0.06,0],[0,-0.015]], 0.13,0.006,k*0.22, 1, -PI/2,0,0, 5);
      bend(g, skin, [[-0.05,0.06,k*0.06],[-0.04,0.03,k*0.1],[-0.02,0.005,k*0.12]], t=>0.012, 6, 6); blob(g, ceramic(0x2a2018), 0.1,0.15,k*0.04, 0.016); blob(g, glintMat(), 0.105,0.158,k*0.045, 0.004); }); },
  // a thick spotted eel that always looks ready to bite, with a frill along its back
  moray(g,d,id,{skin,fin}){ const E=eelBody(g, skin, [[0.4,0.32,0],[0.3,0.26,0],[0.18,0.18,0.03],[0,0.15,-0.04],[-0.2,0.16,0.04],[-0.42,0.14,0]], t=>0.06*(1-smooth(0.7,1,t)*0.75)*(t<0.04?0.8:1), 0.8);
    ribbonFin(g, fin, E.pts, t=>0.03*(1-t*0.3), 1, 0.1, 1); ribbonFin(g, fin, E.pts, t=>0.02, -1, 0.55, 1);
    const up=blob(g, skin, 0.43,0.335,0, 0.055, 1.3,0.55,0.85); up.rotation.z=0.25; const lo=blob(g, skin, 0.43,0.3,0, 0.05, 1.25,0.45,0.8); lo.rotation.z=-0.2; blob(g, ceramic(0x3a1a1a), 0.44,0.318,0, 0.04, 1.1,0.35,0.7);
    teeth(g, [0.38,0.325,0.025],[0.48,0.33,0.02], 5, 0.016, [0,-1,0], 0.004); teeth(g, [0.38,0.31,0.024],[0.47,0.3,0.018], 5, 0.014, [0,1,0], 0.004); teeth(g, [0.38,0.325,-0.025],[0.48,0.33,-0.02], 5, 0.016, [0,-1,0], 0.004);
    fishEye(g, 0.42,0.35,0.035, 0.55, 0xe8d040); g.userData.tail=null; },
  // buried with only its upturned face showing: eyes on top, a grim fringed mouth
  stargazer(g,d,id,{skin,fin}){ g.userData.bottom=true; const box=welded(new THREE.BoxGeometry(0.4,0.16,0.2,12,6,8)); displace(box,v=>{ const p=3; const n=Math.pow(Math.abs(v.x/0.2)**p+Math.abs(v.y/0.08)**p+Math.abs(v.z/0.1)**p,1/p); v.multiplyScalar(1/Math.max(0.6,n)**0.9); v.z*=1-(-Math.min(0,v.x))*1.4; v.y*=1-(-Math.min(0,v.x))*1.2; });
    painted(g, box, (v,n,o)=>{ o.set(d.c).lerp(col(d.c2), clamp(-n.y,0,1)); if (n.y>0.3 && (Math.round(v.x*60)+Math.round(v.z*60))%3===0 && fbm(v.x*60,0,v.z*60,1)>0.1) o.set(0xf0ece0); }, 0,0.1,0);
    const sand=ceramic(0xe2cfa4); const s=welded(sph(0.3,32,10,0,TAU,0,PI/2)); displace(s,v=>{ v.y*=0.18; v.multiplyScalar(1+fbm(v.x*10,0,v.z*10,3)*0.08); }); const sm=mesh(s, sand, -0.05,0.0,0, g); sm.scale.set(1.2,1,1);
    const mouth=new THREE.TorusGeometry(0.05,0.008,6,24,PI); const mm=mesh(mouth, ceramic(0x3a2a20), 0.19,0.15,0, g, false); mm.rotation.set(PI/2,0,PI/2);
    for (let i=0;i<10;i++){ const a=i/9*PI; spike(g, ceramic(0xf8f0e0), [0.19+0.0,0.15,cos(a)*0.05],[1,0.4,0],0.02,0.003); }
    pairs(k=>{ blob(g, ceramic(0x3a3020), 0.12,0.2,k*0.035, 0.024, 1,0.8,1); blob(g, ceramic(0xe8d070), 0.12,0.214,k*0.035, 0.017, 1,0.5,1); blob(g, ceramic(0x0a0a0a), 0.12,0.22,k*0.035, 0.009, 1,0.4,1);
      finAt(g, fin, [[0,0.02],[-0.04,0.1,-0.14,0.06],[-0.14,-0.02],[0,-0.02]], 0.04,0.12,k*0.09, 0.9, k*1.25,0,-0.3, 10); spike(g, shellMat(shade(d.c,-0.1)), [0.08,0.12,k*0.1],[-0.5,0.4,k*1],0.04,0.008); }); g.userData.tail=null; },
  // a chimaera: rabbit face, huge green eyes, wing fins and a rat-thin tail
  ratfish(g,d,id,{skin,fin}){ const H=0.1, B=body(g, skin, 0.3, t=>H*Math.pow(sin(PI*clamp(t*0.95+0.04,0,1)),0.5)*(1-0.92*smooth(0.25,1,t)), 0.7);
    bend(g, skin, [[-0.28,0.22,0],[-0.42,0.215,0],[-0.6,0.22,0]], t=>0.012*(1-t)+0.001, 6, 14); ribbonFin(g, fin, curve([[-0.3,0.23,0],[-0.45,0.225,0],[-0.58,0.222,0]],14), t=>0.02*sin(PI*t), 1); ribbonFin(g, fin, curve([[-0.3,0.21,0],[-0.45,0.21,0],[-0.58,0.218,0]],14), t=>0.02*sin(PI*t), -1);
    spike(g, shellMat(0xf0ece8), [0.12,0.22+H*0.9,0],[0,1,0],0.12,0.008); finAt(g, fin, [[0.02,0],[0.0,0.1,-0.04,0.12],[-0.06,0]], 0.12,0.22+H*0.85,0, 1);
    pairs(k=>finAt(g, finMaterial(0xc8c4d8,0xf0e8ff,id+'w'), [[0,0.02],[-0.04,0.16,-0.24,0.12],[-0.3,-0.02,-0.18,-0.04],[0,-0.02]], 0.12,0.19,k*0.05, 1, k*1.3,0,-0.2, 14));
    blob(g, skin, 0.28,0.21,0, 0.05, 1,0.8,0.7); pairs(k=>blob(g, ceramic(0xe8e4e0), 0.32,0.18,k*0.015, 0.012, 1.4,0.7,0.7)); pairs(k=>{ const e=grp(g,0.2,0.25,k*0.055); blob(e, ceramic(0x0a1a12), 0,0,0, 0.04, 1,1,0.45); blob(e, shellMat(0x3ae8a0,{ iridescence:1 }), 0.006,0.004,k*0.012, 0.03, 1,1,0.3); blob(e, glintMat(), 0.014,0.02,k*0.016, 0.007); }); },
  // a round warty ball with a sucker disc on its belly
  lumpsucker(g,d,id,{fin}){ const geo=welded(sph(0.15,40,28)); displace(geo,v=>{ v.x*=1.1; if (v.x<0) v.multiplyScalar(1+v.x*0.6); });
    painted(g, geo, (v,n,o)=>{ o.set(d.c).lerp(col(d.c2), clamp(-n.y,0,1)*0.8); }, 0,0.18,0, { roughness:0.5 });
    for (let i=0;i<50;i++){ const a=i*2.4, e=Math.acos(1-2*(i+0.5)/50); const p=V3(cos(e)*0.16*1.1, sin(e)*cos(a)*0.15, sin(e)*sin(a)*0.15); if (p.y<-0.06) continue; if (p.x<0) p.multiplyScalar(1+p.x*0.6); blob(g, shellMat(shade(d.c,0.06)), p.x,0.18+p.y,p.z, 0.014+0.006*(i%3), 1,1,1); }
    const disc=mesh(new THREE.TorusGeometry(0.05,0.012,8,24), ceramic(d.c2), 0.03,0.04,0, g, false); disc.rotation.x=PI/2;
    rod(g, shellMat(d.c), [-0.12,0.18,0],[-0.18,0.18,0], 0.03,0.015,8); tailFin(g, fin, TAILS.round, -0.18, 0.18, 0.5); finAt(g, fin, [[0.03,0],[0,0.05,-0.08,0.04],[-0.1,0]], -0.08,0.31,0, 0.7);
    pairs(k=>finAt(g, fin, [[0,0.015],[-0.03,0.05,-0.08,0.02],[0,-0.015]], 0.04,0.14,k*0.13, 0.9, k*0.4,k*0.4,0, 7)); fishEye(g, 0.12,0.23,0.08, 0.9, 0x8a6a30); blob(g, ceramic(0xe8a0a0), 0.16,0.16,0, 0.022, 0.6,0.5,1.1); },
  // a scowling sea wolf with buck-tooth fangs and a long dorsal fin
  wolffish(g,d,id,{skin,fin}){ const H=0.1, B=body(g, skin, 0.44, t=>H*(1.15-0.5*smooth(0.05,1,t))*Math.pow(sin(PI*clamp(t*0.97+0.03,0,1)),0.38), 0.72);
    ribbonFin(g, fin, curve([[0.25,0.22+H*0.95,0],[0,0.22+H*0.85,0],[-0.4,0.22+H*0.3,0]],30), t=>0.05*(1-t*0.4), 1); ribbonFin(g, fin, curve([[0.0,0.22-H*0.8,0],[-0.4,0.22-H*0.3,0]],20), t=>0.04, -1);
    tailFin(g, fin, TAILS.round, -0.43, 0.22, 0.55); pecs(g, fin, B, 0.18, -0.35, 1, [[0,0.03],[-0.04,0.08,-0.14,0.06],[-0.16,-0.02,-0.06,-0.05],[0,-0.03]]);
    const tm=ceramic(0xf2ead0); pairs(k=>{ spike(g, tm, [0.45,0.21,k*0.012],[0.6,-0.8,0],0.035,0.008); spike(g, tm, [0.44,0.19,k*0.014],[0.6,1,0],0.03,0.008); spike(g, tm, [0.43,0.21,k*0.03],[0.4,-1,0],0.025,0.006); });
    pairs(k=>blob(g, shellMat(shade(d.c,-0.1)), 0.36,0.22+H*0.65,k*0.045, 0.025, 1.4,0.5,0.6).rotation.x=k*-0.3); blob(g, skin, 0.44,0.2,0, 0.05, 0.6,0.5,0.9); eyeOn(g, B, 0.13, 0.5, 0.65, 0x6a8a9a); },
  // a pale cave fish with no eyes at all, and long feeler fins
  blindfish(g,d,id,{skin,fin}){ const H=0.08, B=body(g, skin, 0.22, t=>H*prof(0.4,0.65,0.25)(t), 0.5); pairs(k=>{ const R=B.rf(0.12); blob(g, skin, B.x(0.12), 0.235, k*R*0.42, 0.016, 1,0.8,0.3); });
    for (let i=0;i<8;i++) pairs(k=>blob(g, ceramic(0xd88a90), 0.17-i*0.015, 0.2+(i%2)*0.012, k*B.rf(0.15)*0.46, 0.003));
    pairs(k=>finAt(g, finMaterial(0xfff0f0,0xffffff,id+'f'), [[0,0.01],[-0.06,0.03,-0.24,0.0],[0,-0.01]], 0.12,0.2,k*0.035, 1, k*0.4,k*0.4,-0.2, 6));
    finAt(g, fin, DORSAL, -0.02,0.22+H*0.85,0, 0.6); finAt(g, fin, ANAL, -0.08,0.22-H*0.82,0, 0.6); tailFin(g, fin, TAILS.fork, -0.21, 0.22, 0.55); lips(g, B, d.c, 0.8); },
  // an ancient fish with fins on fleshy stalks like little arms, and a three-lobed tail
  coelacanth(g,d,id,{skin,fin}){ const H=0.13, B=body(g, skin, 0.42, t=>H*Math.pow(sin(PI*clamp(t*0.98+0.02,0,1)),0.38)*(1-0.55*smooth(0.55,1,t)), 0.55);
    const lobe=(x,y,z,dir,s,rx=0)=>{ const L=grp(g,x,y,z); const st=V3(...dir).normalize(); const stalk=mesh(tube([V3(0,0,0), st.clone().multiplyScalar(0.06*s)], t=>0.02*s*(1-t*0.35), 8), skin, 0,0,0, L, false); const f=rayFin([[0,0.015],[-0.02,0.05,-0.08,0.03],[-0.11,0.0],[-0.08,-0.03,0,-0.015]], fin, 10); f.position.copy(st.clone().multiplyScalar(0.06*s)); f.rotation.set(rx,Math.atan2(-st.z,st.x)+PI,Math.atan2(st.y,Math.hypot(st.x,st.z))); f.scale.setScalar(s); L.add(f); };
    lobe(-0.12,0.22+H*0.85,0,[-0.6,1,0],1); lobe(-0.12,0.22-H*0.85,0,[-0.6,-1,0],1); pairs(k=>{ lobe(0.16,0.19,k*0.05,[-0.4,-0.3,k*1],1.1, k*1.2); lobe(-0.02,0.12,k*0.04,[-0.4,-1,k*0.6],0.9, k*0.8); });
    finAt(g, fin, [[0.04,0],[0.02,0.12,-0.06,0.12],[-0.1,0]], 0.06,0.22+H*0.9,0, 0.9, 0,0,0, 9);
    tailFin(g, fin, [[0,0.04],[-0.05,0.14,-0.15,0.15],[-0.14,0.03],[-0.24,0.03],[-0.24,-0.03],[-0.14,-0.03],[-0.15,-0.15],[-0.05,-0.14,0,-0.04]], -0.41, 0.22, 0.95, 16);
    eyeOn(g, B, 0.1, 0.25, 0.95, 0x9ad0a0); lips(g, B, d.c, 1.2); },

  // ---------- trip islands ----------
  // its eyes sit on top, split in two: half looks above the water, half below
  foureyes(g,d,id,{skin,fin}){ const H=0.07, B=body(g, skin, 0.34, t=>H*prof(0.42,0.6,0.25)(t), 0.65, 0.22, { fn:v=>{ if (v.y>0) v.y*=0.7; } });
    pairs(k=>{ const e=grp(g,0.24,0.29,k*0.03); blob(e, skin, 0,-0.012,0, 0.032, 1.1,0.9,1); blob(e, ceramic(0x2a2a20), 0.006,0.008,0, 0.028, 1,1,1); blob(e, ceramic(0xe8d890), 0.012,0.012,k*0.01, 0.018, 0.6,1,1); mesh(new THREE.TorusGeometry(0.029,0.004,6,24), ceramic(0x8a7a5a), 0.006,0.008,0, e, false).rotation.y=PI/2; blob(e, glintMat(), 0.02,0.025,k*0.012, 0.005); });
    finAt(g, fin, [[0.03,0],[0,0.05,-0.08,0.03],[-0.1,0]], -0.18,0.22+H*0.65,0, 0.8); finAt(g, fin, [[0.06,0],[0,-0.07,-0.1,-0.05],[-0.14,0]], -0.12,0.22-H*0.8,0, 0.85);
    tailFin(g, fin, TAILS.round, -0.33, 0.22, 0.6); pecs(g, fin, B, 0.25, -0.1, 0.6); lips(g, B, d.c); },
  // a horn on its forehead and two long streamers off its tail
  unicornfish(g,d,id,{skin,fin}){ const H=0.13, B=body(g, skin, 0.28, t=>H*Math.pow(sin(PI*clamp(t*0.97+0.02,0,1)),0.45)*(1-0.66*smooth(0.55,1,t)), 0.36);
    const hn=bend(g, shellMat(shade(d.c,-0.05)), [[0.18,0.28,0],[0.27,0.33,0],[0.36,0.35,0]], t=>0.022*(1-t*0.85), 10, 12);
    ribbonFin(g, fin, curve([[0.14,0.22+H*0.85,0],[-0.05,0.22+H*0.8,0],[-0.22,0.22+H*0.3,0]],20), t=>0.04, 1); ribbonFin(g, fin, curve([[0.06,0.22-H*0.8,0],[-0.22,0.22-H*0.3,0]],16), t=>0.035, -1);
    const tl=tailFin(g, fin, [[0,0.02],[-0.06,0.08,-0.14,0.1],[-0.38,0.14],[-0.15,0.08],[-0.13,0],[-0.15,-0.08],[-0.38,-0.14],[-0.14,-0.1],[-0.06,-0.08,0,-0.02]], -0.27, 0.22, 0.8, 14);
    pairs(k=>{ for (const dx of [0,0.03]) spike(g, shellMat(0x3a6ad8), [-0.22-dx,0.22,k*0.03],[0.6,0,k*0.4],0.03,0.008); }); pecs(g, fin, B, 0.35, -0.1, 0.55); eyeOn(g, B, 0.2, 0.3, 0.8, 0xe0e8f0); lips(g, B, d.c, 0.8); },
  // a ghost-white fish with no red in its blood, a crocodile snout and fan fins
  icefish(g,d,id,{fin}){ const H=0.085, mat=glassy(0xf2f8ff,0.55); const B=body(g, mat, 0.36, t=>H*prof(0.6,0.65,0.3)(t), 0.62, 0.22, { fn:v=>{ if (v.x>0.24){ v.y*=1-(v.x-0.24)*3; } } }); B.m.renderOrder=2;
    const sn=new THREE.ConeGeometry(0.05,0.2,12); sn.rotateZ(-PI/2); sn.scale(1,0.45,1); mesh(sn, glassy(0xf8fcff,0.7), 0.44,0.22,0, g).renderOrder=2;
    blob(g, ceramic(0xf0d8d0), 0.22,0.215,0, 0.03, 1.3,0.7,0.6); bend(g, ceramic(0xe8eef0), [[0.3,0.23,0],[0,0.235,0],[-0.34,0.22,0]], t=>0.006, 5, 20);
    finAt(g, finMaterial(0x2a2a30,0x6a6a7a,id+'d'), [[0.04,0],[0.02,0.1,-0.04,0.12],[-0.08,0]], 0.12,0.22+H*0.85,0, 0.9); finAt(g, fin, [[0.06,0],[0.02,0.06,-0.24,0.05],[-0.3,0]], -0.02,0.22+H*0.75,0, 0.9); finAt(g, fin, [[0.06,0],[0.02,-0.06,-0.24,-0.05],[-0.3,0]], -0.02,0.22-H*0.75,0, 0.9);
    pairs(k=>finAt(g, fin, [[0,0.03],[-0.06,0.14,-0.2,0.1],[-0.24,-0.04,-0.1,-0.06],[0,-0.03]], 0.18,0.2,k*0.04, 0.9, k*1.2,0,-0.1, 14)); tailFin(g, fin, TAILS.round, -0.35, 0.22, 0.6); eyeOn(g, B, 0.2, 0.4, 0.9, 0xd8e0e8); },
  // fangs so long they don't fit in its mouth, and rows of tiny lights
  viperfish(g,d,id,{skin,fin}){ const H=0.07, B=body(g, skin, 0.34, t=>H*(1.1-0.6*smooth(0,1,t))*Math.pow(sin(PI*clamp(t*0.97+0.03,0,1)),0.4), 0.55);
    blob(g, skin, 0.3,0.19,0, 0.05, 1.1,0.5,0.8); const tm=glassy(0xe8f0ff,0.85); pairs(k=>{ for (const [x,L] of [[0.37,0.11],[0.33,0.08]]) { const f=bend(g, tm, [[x,0.18,k*0.022],[x+0.02,0.26,k*0.026],[x-0.02,0.3,k*0.02]], t=>0.006*(1-t*0.9)+0.0006, 5, 10); }
      spike(g, tm, [0.36,0.24,k*0.02],[0.2,-1,0],0.05,0.005); for (let i=0;i<14;i++) blob(g, glowM(0x6ad8ff,2.2), 0.24-i*0.04, 0.2-0.01*sin(i*0.5), k*B.rf(0.12+i*0.055)*0.5, 0.005); });
    const ray=bend(g, shellMat(d.c), [[0.12,0.22+H*0.9,0],[0.2,0.38,0],[0.32,0.42,0]], t=>0.003, 4, 14); blob(g, glowM(0xffe08a,2.5), ray[13].x,ray[13].y,0, 0.01);
    finAt(g, fin, [[0.03,0],[0,0.05,-0.06,0.03],[-0.08,0]], -0.2,0.22+H*0.55,0, 0.7); finAt(g, fin, [[0.03,0],[0,-0.05,-0.06,-0.03],[-0.08,0]], -0.22,0.22-H*0.55,0, 0.7); tailFin(g, fin, TAILS.fork, -0.33, 0.22, 0.5); eyeOn(g, B, 0.1, 0.35, 0.95, 0x4a6a8a); },
  // a huge bulging forehead, blubbery lips and big scales
  humphead(g,d,id,{skin,fin}){ const H=0.16, B=body(g, skin, 0.4, t=>H*prof(0.38,0.65,0.3)(t), 0.48); const hump=welded(sph(0.11,32,22)); displace(hump,v=>{ v.x*=1.1; v.y*=0.95; v.z*=0.62; }); mesh(hump, skin, 0.25,0.33,0, g);
    blob(g, shellMat(shade(d.c2,0.05),{ roughness:0.4 }), 0.39,0.19,0, 0.035, 0.8,0.7,1.3); blob(g, shellMat(shade(d.c2,0.05),{ roughness:0.4 }), 0.39,0.165,0, 0.03, 0.7,0.6,1.2);
    finAt(g, fin, [[0.14,0],[0.04,0.08,-0.22,0.08],[-0.32,0]], 0.12,0.22+H*0.9,0, 1, 0,0,0, 14); finAt(g, fin, [[0.06,0],[0.02,-0.1,-0.14,-0.09],[-0.18,0]], -0.08,0.22-H*0.82,0, 1);
    tailFin(g, fin, TAILS.round, -0.39, 0.22, 0.9); pecs(g, fin, B, 0.3, -0.2, 1.0); pelvics(g, fin, B, 0.38, 0.9); eyeOn(g, B, 0.13, 0.42, 0.9, 0xd8c040);
    for (let i=0;i<4;i++) pairs(k=>{ const pt=curve([[0.32-i*0.02,0.26-i*0.02,k*0.06],[0.3-i*0.02,0.22-i*0.02,k*0.072],[0.25-i*0.02,0.2-i*0.02,k*0.075]],6); mesh(tube(pt,()=>0.003,3), ceramic(0xf0e070), 0,0,0, g, false); }); },
  // a mouth like a pelican's pouch on a whip of a body with a glowing tip
  gulper(g,d,id,{skin}){ const pouch=welded(sph(0.18,36,24)); displace(pouch,v=>{ v.x*=1.15; v.y*=0.8; if (v.x>0.05) v.y*=1+(v.x-0.05)*1.5; v.z*=0.85; }); const pm=mesh(pouch, glassy(0x3a2a40,0.75), 0.15,0.24,0, g);
    const jaw=curve([[0.0,0.3,0],[0.2,0.38,0],[0.36,0.32,0]],12); mesh(tube(jaw,t=>0.01,6), skin, 0,0,0, g, false); const jaw2=curve([[0.0,0.2,0],[0.2,0.08,0],[0.36,0.18,0]],12); mesh(tube(jaw2,t=>0.01,6), skin, 0,0,0, g, false);
    blob(g, skin, -0.04,0.25,0, 0.05, 1.2,1,0.8); fishEye(g, 0.02,0.29,0.025, 0.3, 0x6a6a8a);
    const tl=grp(g,-0.06,0.25,0); const tp=curve([[0,0,0],[-0.15,-0.03,0.04],[-0.35,0.03,-0.03],[-0.55,-0.02,0.02],[-0.7,0.02,0]],30); mesh(tube(tp,t=>0.035*(1-t)+0.002,8), skin, 0,0,0, tl); g.userData.tail=tl;
    const tip=tp[tp.length-1]; blob(tl, glowM(0xff6ab0,2.6), tip.x,tip.y,tip.z, 0.014, 1.6,1,1); for (const s of [1,-1]) spike(tl, glowM(0xff6ab0,1.6), [tip.x,tip.y,tip.z],[ -0.5, s, 0],0.025,0.004); },
  // a clear dome over its head, with two green tube eyes inside looking straight up
  barreleye(g,d,id,{skin,fin}){ const H=0.07, B=body(g, skin, 0.22, t=>H*prof(0.4,0.6,0.3)(t), 0.6);
    const dome=mesh(sph(0.075,32,20,0,TAU,0,PI*0.62), glassy(0xd8f8ff,0.22), 0.1,0.24,0, g); dome.scale.set(1.5,1.1,0.85); dome.renderOrder=3;
    pairs(k=>{ rod(g, shellMat(0x3ad870,{ iridescence:0.6 }), [0.1,0.23,k*0.016],[0.1,0.3,k*0.016], 0.016,0.018, 12); blob(g, glowM(0x6aff9a,1.2), 0.1,0.305,k*0.016, 0.017, 1,0.4,1); blob(g, ceramic(0x1a1a1a), 0.2,0.235,k*0.03, 0.008); });
    blob(g, ceramic(0x3a3a42), 0.21,0.22,0, 0.012, 0.6,0.5,1);
    pairs(k=>finAt(g, fin, [[0,0.03],[-0.04,0.06,-0.2,0.04],[-0.22,-0.03,-0.1,-0.05],[0,-0.03]], 0.06,0.2,k*0.04, 0.9, k*1.35,0,0, 12));
    finAt(g, fin, [[0.03,0],[0,0.04,-0.05,0.03],[-0.06,0]], -0.08,0.22+H*0.8,0, 0.6); finAt(g, fin, [[0.04,0],[0,-0.06,-0.1,-0.04],[-0.12,0]], -0.1,0.22-H*0.8,0, 0.75); tailFin(g, fin, TAILS.fork, -0.21, 0.22, 0.5); },
  // a row of little flag fins down its back and armour of diamond scales
  bichir(g,d,id,{skin,fin}){ const E=eelBody(g, skin, [[0.4,0.2,0],[0.2,0.21,0.02],[0,0.2,-0.02],[-0.2,0.21,0.02],[-0.38,0.2,0]], t=>0.05*(1-smooth(0.75,1,t)*0.6), 0.8);
    blob(g, skin, 0.4,0.2,0, 0.045, 1.2,0.75,0.95); const flag=finMaterial(d.c2,d.c,id+'f'); for (let i=0;i<9;i++){ const p=E.pts[10+i*3]; spike(g, shellMat(shade(d.c,-0.1)), [p.x,p.y+0.045,p.z],[0,1,0],0.04,0.004); finAt(g, flag, [[0.0,0],[0,0.04],[-0.025,0.03,-0.03,0.0]], p.x,p.y+0.045,p.z, 1, 0,0,0, 3); }
    pairs(k=>{ const L=grp(g,0.32,0.17,k*0.04); mesh(tube([V3(0,0,0),V3(-0.02,-0.02,k*0.04)],t=>0.014*(1-t*0.3),8), skin, 0,0,0, L, false); const f=rayFin([[0,0.012],[-0.03,0.04,-0.08,0.0],[-0.03,-0.04,0,-0.012]], fin, 8); f.position.set(-0.02,-0.02,k*0.04); f.rotation.set(k*1.1,0,-0.3); L.add(f); });
    tailFin(g, fin, TAILS.spade, -0.38, 0.2, 0.55); fishEye(g, 0.43,0.215,0.035, 0.55, 0xd8a030); for (let i=0;i<2;i++) pairs(k=>rod(g, skin, [0.47,0.21,k*0.012],[0.5,0.225,k*0.016],0.004,0.002,4)); },
};
function k0(i){ return i%2?1:-1; }

/* ---------- bug parts ---------- */
// a flat wing outline (x out from the body, y toward the head), laid in the XZ plane with +y pointing forward
function wingGeo(pts){ const s=new THREE.Shape(); s.moveTo(0,0); for (const p of pts){ if (p.length===4) s.quadraticCurveTo(...p); else if (p.length===6) s.bezierCurveTo(...p); else s.lineTo(p[0],p[1]); } s.lineTo(0,0);
  const geo=new THREE.ShapeGeometry(s,24); geo.computeBoundingBox(); const b=geo.boundingBox, uv=geo.attributes.uv, p=geo.attributes.position;
  for (let i=0;i<p.count;i++) uv.setXY(i,(p.getX(i)-b.min.x)/((b.max.x-b.min.x)||1),(p.getY(i)-b.min.y)/((b.max.y-b.min.y)||1)); geo.rotateX(PI/2); return geo; }
// one hinge per side that flaps; parts = [outline, material, { rz:lift, ry:sweep back, rx, s, y, z }]
function wingSet(g, wings, y, z, parts, x=0.012){ for (const s of [1,-1]){ const p=grp(g, s*x, y, z); p.scale.x=s; p.userData.side=s; wings.push(p);
  for (const [o, m, t={}] of parts){ const w=mesh(wingGeo(o), m, 0, t.y||0, t.z||0, p, false); w.rotation.set(t.rx||0, t.ry||0, t.rz||0); if (t.s) w.scale.setScalar(t.s); w.renderOrder=1; } } }
const paintW = (id, d, o={}) => once('w2:'+id, ()=>new THREE.MeshPhysicalMaterial(Object.assign({ map:wingTex(id,d), side:THREE.DoubleSide, roughness:0.55, sheen:1, sheenRoughness:0.6, sheenColor:col(0xffffff), transparent:true, alphaTest:0.04 },
  d.glow?{ emissive:0xffffff, emissiveMap:wingTex(id,d), emissiveIntensity:0.5 }:{}, o)));
const clearW = (tint, spot) => clearWingMat(tint, spot);
// a body made of a tapering tube through points (head end first or last, whatever reads)
const segs = (g, m, pts, rf, s=12, rings=0) => bodySegments(g, m, pts, rf, s, rings);
const eyes = (g, x, y, z, r, c=0x1a1418) => pairs(k=>compoundEye(g, k*x, y, z, r, c));
// a jointed leg from hip to foot through two bends, mirrored
const legs2 = (g, m, hip, knee, ankle, foot, r) => pairs(k=>leg(g, m, [k*hip[0],hip[1],hip[2]], [k*knee[0],knee[1],knee[2]], [k*ankle[0],ankle[1],ankle[2]], [k*foot[0],foot[1],foot[2]], r));
// eight legs for spiders: spread is how far out, lift is how high the knees go
function eightLegs(g, m, y, z, spread, lift, r, front=1){ for (let i=0;i<4;i++){ const a=(0.9-i*0.55), L=spread*(i===0?front:i===3?1.1:1);
  legs2(g, m, [0.02,y,z-i*0.012], [L*0.5*cos(a)+0.03, y+lift, z+L*0.5*sin(a)], [L*0.95*cos(a)+0.03, y+lift*0.4, z+L*0.95*sin(a)], [L*1.15*cos(a)+0.03, 0.004, z+L*1.15*sin(a)], r); } }
// a beetle shell: a dome split down the middle by a seam
function elytra(g, m, rx, ry, rz, y, z, seam=0x1a1410){ const e=welded(sph(1,40,24,0,TAU,0,PI*0.56)); displace(e, v=>{ v.x*=rx; v.y*=ry; v.z*=rz; }); mesh(e, m, 0,y,z, g);
  const arc=[]; for (let i=0;i<=16;i++){ const a=-PI/2+i/16*PI*0.98; arc.push(V3(0, y+cos(a)*ry+0.001, z+sin(a)*rz)); } mesh(tube(arc,()=>0.0018,4), shellMat(seam), 0,0,0, g, false); }
function bubbleFroth(g, n, r, cx, cy, cz, R){ const m=glassy(0xfaffff,0.55); for (let i=0;i<n;i++){ const a=i*2.4, e=Math.acos(1-2*(i+0.5)/n); blob(g, m, cx+sin(e)*cos(a)*R*(0.8+0.4*n3(i,0,0)), cy+Math.abs(cos(e))*R*0.7, cz+sin(e)*sin(a)*R, r*(0.6+0.6*n3(i,1,2))); } }
const bandPaint = (g, geo, c, c2, f, x=0,y=0,z=0, o) => painted(g, geo, (v,n,out)=>{ out.set(f(v)?c2:c); }, x,y,z, o);
const W_BUTTER = { fore:[[0.06,0.12,0.26,0.2,0.36,0.14],[0.34,0.02,0.24,-0.05],[0.12,-0.04,0.02,-0.01]], hind:[[0.04,-0.02],[0.28,-0.02,0.3,-0.16,0.2,-0.24],[0.1,-0.26,0.02,-0.1]] };
function butterBody(g, d, dark, len=0.16, r=0.024, furry=false){ const m=furry?fuzzMat(d.c2):shellMat(shade(d.c2,-0.05),{ roughness:0.5 });
  segs(g, m, [[0,0.3,0.04],[0,0.3,-0.04],[0,0.298,-len*0.75],[0,0.295,-len]], t=>r*sin(PI*clamp(t*0.9+0.12,0,1))**0.7+0.004, 10, 5);
  blob(g, m, 0,0.305,0.055, r*1.3, 1,0.95,1.2); blob(g, m, 0,0.31,0.1, r*0.95); eyes(g, 0.016,0.315,0.112, r*0.55, 0x2a2018); return m; }

/* =========================== BUGS =========================== */
const BUGS = {
  // ---------- flying ----------
  // a gangly fly on stilts: six enormous legs, a thin body and two slim wings
  cranefly(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.5 }); segs(g, bm, [[0,0.3,0.05],[0,0.3,-0.04],[0,0.29,-0.16],[0,0.28,-0.27]], t=>0.016*sin(PI*clamp(t*0.9+0.1,0,1))**0.5+0.004, 10, 7);
    blob(g, bm, 0,0.31,0.07, 0.026, 1,1.15,1.3); blob(g, bm, 0,0.31,0.118, 0.014, 1,1,1.3); rod(g, bm, [0,0.305,0.128],[0,0.295,0.16], 0.006,0.004,5); eyes(g, 0.012,0.315,0.12, 0.009);
    wingSet(g, wings, 0.325, 0.07, [[[[0.05,0.02,0.2,0.03,0.3,-0.01],[0.22,-0.045,0.05,-0.03]], clearW(0xe8e0d0,0x6a5a3a), { ry:0.55, rz:0.1 }]]);
    pairs(k=>{ rod(g, bm, [k*0.012,0.31,0.045],[k*0.03,0.32,0.03], 0.002,0.002,3); blob(g, bm, k*0.032,0.32,0.03, 0.005); });
    for (let i=0;i<3;i++) legs2(g, dark, [0.012,0.295,0.08-i*0.018], [0.11,0.38+i*0.01,0.14-i*0.12], [0.24,0.2,0.2-i*0.2], [0.3,0.004,0.22-i*0.24], 0.0025);
    antennae(g, dark, [0,0.32,0.13], 0.04, 'whip', 0.5, 0.0015); },
  // a stout furry little butterfly that holds its forewings up and hindwings flat, like a jet
  skipper(g,d,id,{wings,dark}){ const fz=fuzzMat(d.c); segs(g, fz, [[0,0.3,0.03],[0,0.298,-0.05],[0,0.295,-0.13]], t=>0.03*sin(PI*clamp(t*0.85+0.15,0,1))**0.6+0.006, 12, 4);
    blob(g, fz, 0,0.31,0.05, 0.038, 1,0.95,1.1); blob(g, fz, 0,0.315,0.1, 0.03); eyes(g, 0.024,0.32,0.11, 0.017, 0x1a1410);
    const wm=paintW(id,d); wingSet(g, wings, 0.32, 0.05, [[[[0.04,0.1,0.14,0.14,0.2,0.1],[0.2,0.02,0.12,-0.02],[0.04,-0.02]], wm, { rz:0.85, ry:0.2 }], [[[0.04,-0.01],[0.16,-0.01,0.18,-0.08,0.12,-0.12],[0.04,-0.1]], wm, { rz:0.08, ry:0.2 }]]);
    pairs(k=>{ const a=curve([[k*0.01,0.33,0.12],[k*0.03,0.36,0.17],[k*0.05,0.37,0.2],[k*0.06,0.365,0.21]],10); mesh(tube(a,t=>0.0028,4), dark, 0,0,0, g, false); const h=curve([[k*0.06,0.365,0.21],[k*0.07,0.36,0.205],[k*0.075,0.362,0.195]],5); mesh(tube(h,()=>0.0045,5), dark, 0,0,0, g, false); });
    sixLegs(g, fz, 0.28, 0.08, 0.03, 0.1, 0.004); },
  // a fly dressed as a wasp: yellow-banded flat belly, giant eyes, glassy wings held out
  hoverfly(g,d,id,{wings,dark}){ const ab=welded(sph(0.05,32,20)); displace(ab,v=>{ v.y*=0.45; v.z*=1.55; v.x*=1.05; }); bandPaint(g, ab, hx(d.c2), hx(d.c), v=>sin((v.z+0.08)*95)>0.25 && v.z<0.06, 0,0.295,-0.06);
    blob(g, shellMat(0x3a3220,{ roughness:0.5 }), 0,0.305,0.03, 0.034, 1,0.9,1.05); blob(g, shellMat(0xf0d040), 0,0.31,0.075, 0.024, 1.25,0.95,0.7);
    pairs(k=>compoundEye(g, k*0.022,0.315,0.082, 0.024, 0x8a2a1a)); wingSet(g, wings, 0.33, 0.03, [[[[0.05,0.035,0.16,0.04,0.21,0.005],[0.16,-0.04,0.05,-0.03]], clearW(0xf0f4ff), { ry:0.25, rz:0.05 }]]);
    sixLegs(g, shellMat(0xc8a040), 0.28, 0.05, 0.025, 0.08, 0.0035); antennae(g, dark, [0,0.33,0.095], 0.025, 'club', 0.6, 0.0018); },
  // a delicate dancer: upright sail wings and three long tail threads
  mayfly(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.5, transmission:0 }); const pts=segs(g, bm, [[0,0.28,0.04],[0,0.275,-0.05],[0,0.29,-0.15],[0,0.33,-0.23]], t=>0.016*sin(PI*clamp(t*0.85+0.15,0,1))**0.5+0.004, 10, 9);
    blob(g, bm, 0,0.29,0.06, 0.026, 1,1.1,1.2); blob(g, bm, 0,0.29,0.1, 0.017); eyes(g, 0.014,0.3,0.105, 0.011, 0x3a3a3a);
    for (const s of [-1,0,1]) bend(g, shellMat(d.c2), [[0,0.33,-0.23],[s*0.03,0.37,-0.32],[s*0.07,0.4,-0.44]], t=>0.0018*(1-t*0.5), 3, 12);
    const wm=clearW(0xfff8e0,0x6a5a3a); wingSet(g, wings, 0.31, 0.06, [[[[0.04,0.05,0.16,0.06,0.24,0.0],[0.16,-0.05,0.04,-0.04]], wm, { rz:1.45, ry:0.35 }], [[[0.03,-0.01],[0.07,-0.02,0.08,-0.05,0.04,-0.06]], wm, { rz:1.3, ry:0.4, z:-0.03 }]], 0.004);
    legs2(g, dark, [0.01,0.28,0.08],[0.04,0.33,0.16],[0.05,0.3,0.22],[0.06,0.26,0.27], 0.003); for (let i=1;i<3;i++) legs2(g, dark, [0.01,0.28,0.07-i*0.02],[0.07,0.3,0.06-i*0.04],[0.11,0.12,0.06-i*0.06],[0.13,0.004,0.06-i*0.07], 0.003); },
  // ragged, torn-looking wing edges, so it passes for a dead leaf when it closes up
  comma(g,d,id,{wings,dark}){ butterBody(g, d, dark, 0.14, 0.022, true); const wm=paintW(id,d);
    wingSet(g, wings, 0.31, 0.05, [[[[0.05,0.08],[0.1,0.15],[0.17,0.17],[0.22,0.22],[0.26,0.16],[0.32,0.15],[0.3,0.08],[0.27,0.05],[0.3,0.0],[0.22,-0.02],[0.1,-0.02]], wm, { rz:0.25 }],
      [[[0.05,-0.02],[0.16,-0.01],[0.24,-0.05],[0.21,-0.09],[0.25,-0.13],[0.19,-0.17],[0.18,-0.25],[0.12,-0.19],[0.07,-0.2],[0.04,-0.12]], wm, { rz:0.22 }]]);
    antennae(g, dark, [0,0.32,0.11], 0.12, 'club', 0.6, 0.0028); sixLegs(g, dark, 0.28, 0.08, 0.03, 0.1, 0.0035); },
  // a slim green body under big lacy wings held like a roof, and golden eyes
  lacewing(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.45 }); segs(g, bm, [[0,0.26,0.04],[0,0.26,-0.06],[0,0.255,-0.16]], t=>0.014*sin(PI*clamp(t*0.85+0.15,0,1))**0.5+0.004, 10, 8);
    blob(g, bm, 0,0.265,0.06, 0.02, 1,1,1.3); blob(g, bm, 0,0.265,0.095, 0.016); pairs(k=>blob(g, shellMat(0xf0c030,{ metalness:0.6, roughness:0.2 }), k*0.015,0.27,0.1, 0.01));
    const wm=clearW(0xd8ffd0,null); const wo=[[0.05,0.05,0.2,0.07,0.3,0.0],[0.2,-0.06,0.05,-0.04]];
    wingSet(g, wings, 0.28, 0.05, [[wo, wm, { rz:-0.5, ry:1.0, rx:0 }], [wo, wm, { rz:-0.42, ry:1.15, s:0.92, y:-0.006 }]]);
    antennae(g, shellMat(d.c), [0,0.275,0.105], 0.2, 'whip', 0.35, 0.0015); sixLegs(g, bm, 0.25, 0.07, 0.025, 0.085, 0.003); },
  // wings shut and upright, with thread tails and an orange false eye that fools birds into biting the wrong end
  hairstreak(g,d,id,{wings,dark}){ butterBody(g, { c:d.c, c2:0x4a4e58 }, dark, 0.12, 0.02); const wm=paintW(id,d);
    wingSet(g, wings, 0.31, 0.04, [[W_BUTTER.fore, wm, { rz:1.42, s:0.62 }], [[[0.04,-0.02],[0.2,-0.02,0.21,-0.12,0.15,-0.16],[0.13,-0.19],[0.12,-0.25],[0.115,-0.19],[0.1,-0.2],[0.09,-0.27],[0.085,-0.2],[0.04,-0.14]], wm, { rz:1.42, s:0.62 }]], 0.004);
    antennae(g, dark, [0,0.32,0.1], 0.08, 'club', 0.5, 0.0022); sixLegs(g, dark, 0.28, 0.07, 0.025, 0.08, 0.003); },
  // a pinched waist, long dangling legs and narrow folded wings
  paperwasp(g,d,id,{wings,dark}){ const ab=welded(sph(0.03,32,20)); displace(ab,v=>{ v.z*=2.7; v.x*=0.9; if (v.z<0) v.multiplyScalar(1+v.z*2); }); bandPaint(g, ab, hx(d.c), hx(d.c2), v=>sin((v.z+0.1)*110)>0.35 || v.z>0.07, 0,0.29,-0.11);
    rod(g, shellMat(d.c), [0,0.295,-0.03],[0,0.3,0.0], 0.006,0.004,6); const th=shellMat(d.c,{ roughness:0.4 }); blob(g, th, 0,0.305,0.03, 0.03, 0.95,0.95,1.3); blob(g, shellMat(d.c2), 0,0.31,0.075, 0.025, 1.1,1.15,0.75); eyes(g, 0.02,0.315,0.083, 0.012, 0x2a1a10);
    wingSet(g, wings, 0.33, 0.04, [[[[0.03,0.02,0.12,0.03,0.18,0.0],[0.12,-0.03,0.03,-0.02]], clearW(0xd8c070,0x6a5020), { ry:1.25, rz:0.08 }]], 0.01);
    antennae(g, shellMat(0xe08a2a), [0,0.325,0.09], 0.07, 'elbow', 0.6, 0.0025);
    legs2(g, shellMat(0xe0a030), [0.01,0.28,0.04],[0.04,0.25,0.07],[0.05,0.2,0.07],[0.06,0.17,0.08], 0.003); legs2(g, shellMat(0xe0a030), [0.012,0.28,0.02],[0.05,0.25,0.0],[0.06,0.18,-0.02],[0.07,0.14,-0.03], 0.003); legs2(g, shellMat(0xe0a030), [0.012,0.28,0.0],[0.05,0.24,-0.07],[0.06,0.14,-0.12],[0.07,0.08,-0.15], 0.003); },
  // long narrow black wings striped in pale yellow, on a long thin body
  longwing(g,d,id,{wings,dark}){ butterBody(g, d, dark, 0.19, 0.016); const wm=paintW(id,d);
    wingSet(g, wings, 0.31, 0.05, [[[[0.1,0.08,0.34,0.12,0.44,0.06],[0.38,0.0,0.1,-0.02]], wm, { rz:0.2 }], [[[0.04,-0.02],[0.22,-0.02,0.3,-0.09,0.22,-0.13],[0.1,-0.12,0.03,-0.05]], wm, { rz:0.18 }]]);
    antennae(g, dark, [0,0.32,0.11], 0.16, 'club', 0.5, 0.0024); sixLegs(g, dark, 0.28, 0.08, 0.03, 0.1, 0.0035); },
  // a fluffy round moth in pink and butter yellow, wings tented over its back
  rosymaple(g,d,id,{wings,dark}){ const fp=fuzzMat(d.c), fy=fuzzMat(d.c2); blob(g, fy, 0,0.27,-0.05, 0.05, 1,0.9,1.4); blob(g, fy, 0,0.29,0.04, 0.05, 1.05,1,1); blob(g, fp, 0,0.285,0.085, 0.035, 1,0.95,0.9); eyes(g, 0.024,0.29,0.11, 0.013, 0x2a1a20);
    for (let i=0;i<24;i++){ const a=i*2.4, e=0.4+(i%5)*0.25; spike(g, fy, [sin(e)*cos(a)*0.045, 0.29+cos(e)*0.045, 0.04+sin(e)*sin(a)*0.045],[sin(e)*cos(a),cos(e),sin(e)*sin(a)],0.02,0.006); }
    const wm=paintW(id,d); wingSet(g, wings, 0.31, 0.06, [[[[0.06,0.08,0.18,0.1,0.22,0.04],[0.2,-0.04,0.1,-0.05],[0.03,-0.03]], wm, { rz:-0.45, ry:0.55 }], [[[0.04,-0.01],[0.16,-0.01,0.17,-0.07,0.1,-0.1],[0.03,-0.06]], wm, { rz:-0.5, ry:0.4, y:-0.004 }]], 0.02);
    antennae(g, fy, [0,0.3,0.11], 0.07, 'feather', 0.7, 0.003); sixLegs(g, fp, 0.26, 0.08, 0.03, 0.09, 0.006); },
  // a hunting fly with a bristly beard, humped back, strong spiny legs and a long tapering body
  robberfly(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.55 }); segs(g, bm, [[0,0.29,0.02],[0,0.285,-0.08],[0,0.28,-0.2],[0,0.275,-0.3]], t=>0.024*(1-t*0.8)+0.004, 12, 8);
    blob(g, bm, 0,0.31,0.05, 0.036, 1,1.15,1.2); blob(g, bm, 0,0.3,0.1, 0.026, 1.2,1,0.8); pairs(k=>compoundEye(g, k*0.022,0.31,0.11, 0.016, 0x4a3a1a));
    const beard=shellMat(d.c2,{ roughness:0.8 }); for (let i=0;i<18;i++){ const a=-1.2+i/17*2.4; spike(g, beard, [sin(a)*0.012,0.295-cos(a)*0.004,0.125],[sin(a)*0.4,-0.5,1],0.022,0.003); }
    wingSet(g, wings, 0.33, 0.04, [[[[0.04,0.025,0.16,0.035,0.22,0.0],[0.15,-0.035,0.04,-0.025]], clearW(0xd8d0c0,0x5a4a3a), { ry:1.3, rz:0.04 }]], 0.01);
    for (let i=0;i<3;i++) legs2(g, dark, [0.015,0.28,0.07-i*0.02],[0.06,0.3,0.09-i*0.04],[0.1,0.14,0.11-i*0.08],[0.12,0.004,0.12-i*0.1], 0.005); pairs(k=>{ for (let i=0;i<4;i++) spike(g, dark, [k*(0.06+i*0.01),0.28-i*0.04,0.08-i*0.005],[k*1,0.2,0.2],0.012,0.0015); }); },
  // wings like stained glass with the glass left out: clear panes in a dark frame
  glasswing(g,d,id,{wings,dark}){ butterBody(g, d, dark, 0.15, 0.017); const wm=paintW(id,d,{ alphaTest:0.01, depthWrite:false, roughness:0.15, iridescence:0.6 });
    wingSet(g, wings, 0.31, 0.05, [[[[0.06,0.12,0.24,0.2,0.34,0.13],[0.32,0.02,0.22,-0.04],[0.1,-0.03,0.02,-0.01]], wm, { rz:0.3 }], [[[0.04,-0.02],[0.24,-0.02,0.26,-0.15,0.18,-0.2],[0.08,-0.2,0.02,-0.08]], wm, { rz:0.28 }]]);
    antennae(g, dark, [0,0.32,0.11], 0.13, 'club', 0.5, 0.0024); sixLegs(g, dark, 0.28, 0.08, 0.03, 0.1, 0.0035); },
  // hovers like a hummingbird: a stout tapered body, a fan of tail tufts and a long straight tongue
  hawkmoth(g,d,id,{wings,dark}){ const fz=fuzzMat(d.c), fd=fuzzMat(shade(d.c,-0.15)); segs(g, fz, [[0,0.3,0.05],[0,0.3,-0.04],[0,0.3,-0.14],[0,0.3,-0.2]], t=>0.042*sin(PI*clamp(t*0.85+0.15,0,1))**0.6*(1-t*0.35)+0.006, 14, 5);
    for (let i=0;i<9;i++){ const a=(i-4)*0.3; spike(g, i%3?fd:fuzzMat(0xf4f0e8), [sin(a)*0.012,0.3,-0.2],[sin(a)*1.2,0.1,-1],0.05,0.008); }
    pairs(k=>{ for (let i=0;i<3;i++) blob(g, fuzzMat(0xf4ecd8), k*0.035,0.3,-0.06-i*0.035, 0.012, 0.6,1,1.1); });
    blob(g, fz, 0,0.31,0.06, 0.04, 1,1,1); blob(g, fz, 0,0.31,0.1, 0.03); eyes(g, 0.024,0.315,0.115, 0.018, 0x3a2a20); rod(g, dark, [0,0.3,0.12],[0,0.28,0.26], 0.0025,0.0018,4);
    const wm=paintW(id,d); wingSet(g, wings, 0.325, 0.06, [[[[0.06,0.06,0.24,0.06,0.3,0.0],[0.24,-0.04,0.06,-0.03]], wm, { rz:0.12, ry:0.35 }], [[[0.04,-0.01],[0.14,-0.01,0.16,-0.06,0.1,-0.08],[0.03,-0.05]], paintW(id+'h',{ c:d.c2, c2:shade(d.c2,-0.2) }), { rz:0.1, ry:0.35 }]]);
    antennae(g, dark, [0,0.33,0.12], 0.07, 'club', 0.6, 0.003); },
  // huge wings that flash metallic blue
  morpho(g,d,id,{wings,dark}){ butterBody(g, d, dark, 0.2, 0.026, true); const wm=paintW(id,d,{ iridescence:1, iridescenceIOR:1.9, metalness:0.25, roughness:0.3 });
    wingSet(g, wings, 0.31, 0.05, [[[[0.08,0.16,0.34,0.28,0.48,0.18],[0.5,0.02,0.36,-0.06],[0.16,-0.06,0.02,-0.01]], wm, { rz:0.2 }], [[[0.05,-0.02],[0.36,-0.03,0.4,-0.2,0.28,-0.3],[0.14,-0.32,0.03,-0.13]], wm, { rz:0.18 }]]);
    antennae(g, dark, [0,0.32,0.11], 0.17, 'club', 0.55, 0.003); sixLegs(g, dark, 0.28, 0.08, 0.03, 0.12, 0.004); },

  // ---------- on flowers ----------
  // a round beetle with a snout as long as itself, antennae halfway down it
  weevil(g,d,id,{dark}){ const sh=shellMat(d.c,{ roughness:0.55 }); const b=welded(sph(0.07,32,22)); displace(b,v=>{ v.z*=1.25; v.multiplyScalar(1+fbm(v.x*60,v.y*60,v.z*60,1)*0.04); });
    painted(g, b, (v,n,o)=>{ o.set(d.c); if (fbm(v.x*70,v.y*70,v.z*70,3)>0.32) o.set(d.c2); }, 0,0.13,-0.02, { roughness:0.6 });
    blob(g, sh, 0,0.13,0.07, 0.035, 0.95,0.9,0.9); const sn=bend(g, sh, [[0,0.13,0.1],[0,0.12,0.16],[0,0.09,0.22],[0,0.05,0.25]], t=>0.009*(1-t*0.4), 8, 14); eyes(g, 0.026,0.14,0.09, 0.01, 0x1a1410);
    pairs(k=>{ const b2=sn[6]; bend(g, dark, [[b2.x+k*0.008,b2.y,b2.z],[k*0.04,b2.y+0.04,b2.z+0.01],[k*0.05,b2.y+0.05,b2.z+0.04]], t=>0.0025, 4, 8); blob(g, dark, k*0.05,b2.y+0.05,b2.z+0.045, 0.007, 1,1,1.5); });
    sixLegs(g, dark, 0.1, 0.06, 0.05, 0.07, 0.006, { spines:[1,1,1], high:0.6 }); },
  // a sideways spider that waits on petals with its front legs spread like a crab
  crabspider(g,d,id){ const m=ceramic(d.c), st=ceramic(d.c2); const ab=welded(sph(0.06,32,20)); displace(ab,v=>{ v.x*=1.3; v.y*=0.65; v.z*=1.05; if (v.z<0) v.x*=1+(-v.z)*3; });
    painted(g, ab, (v,n,o)=>{ o.set(d.c); if (Math.abs(Math.abs(v.x)-0.04)<0.008 && v.y>0) o.set(d.c2); }, 0,0.08,-0.05);
    blob(g, m, 0,0.075,0.04, 0.038, 1.1,0.65,1); for (let i=0;i<8;i++) blob(g, ceramic(0x8a2a2a), (i%4-1.5)*0.012, 0.1, 0.07-(i>>2)*0.008, 0.004);
    for (let i=0;i<2;i++) legs2(g, m, [0.03,0.075,0.05-i*0.012],[0.1,0.14,0.08+i*0.02-0.03],[0.18,0.11,0.12-i*0.04],[0.22,0.07,0.17-i*0.06], 0.007);
    for (let i=2;i<4;i++) legs2(g, m, [0.03,0.075,0.03-i*0.012],[0.07,0.1,-0.01-i*0.02],[0.1,0.05,-0.03-i*0.03],[0.11,0.004,-0.03-i*0.04], 0.005);
    pairs(k=>rod(g, st, [k*0.1,0.142,0.06],[k*0.17,0.115,0.09], 0.004,0.004,4)); },
  // a flat, square-shouldered metallic green beetle, white-flecked, with fan antennae
  chafer(g,d,id,{dark}){ const b=welded(new THREE.BoxGeometry(0.13,0.07,0.2,10,6,12)); displace(b,v=>{ const n=Math.pow(Math.abs(v.x/0.065)**3+Math.abs(v.y/0.035)**3+Math.abs(v.z/0.1)**3,1/3); v.multiplyScalar(1/Math.max(0.55,n)**0.9); if (v.y<0) v.y*=0.5; if (v.z<-0.05) v.x*=1-(-v.z-0.05)*2.5; });
    painted(g, b, (v,n,o)=>{ o.set(d.c); if (n.y>0.2 && fbm(v.x*90,1,v.z*90,4)>0.42) o.set(0xf8f4e8); }, 0,0.11,-0.02, { metalness:0.45, roughness:0.25, iridescence:0.7 });
    mesh(tube(curve([[0,0.15,0.08],[0,0.152,-0.11]],4),()=>0.0016,3), dark, 0,0,0, g, false); blob(g, shellMat(d.c,{ metalness:0.45, iridescence:0.7 }), 0,0.11,0.1, 0.035, 1.1,0.7,0.7); eyes(g, 0.028,0.11,0.115, 0.009);
    pairs(k=>{ rod(g, dark, [k*0.015,0.115,0.125],[k*0.04,0.14,0.15], 0.002,0.002,3); for (let i=0;i<3;i++){ const p=blob(g, shellMat(d.c2), k*0.043,0.145+i*0.006,0.155, 0.009, 0.4,0.25,1); p.rotation.y=k*(i-1)*0.4; } });
    sixLegs(g, dark, 0.09, 0.07, 0.06, 0.075, 0.006, { spines:[2,2,2], high:0.55 }); },
  // a cog-wheel crest on its back, a needle beak tucked under its head, and long legs
  assassin(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.5 }); segs(g, bm, [[0,0.14,0.04],[0,0.14,-0.06],[0,0.135,-0.16]], t=>0.032*sin(PI*clamp(t*0.85+0.12,0,1))**0.5+0.005, 12, 4); elytra(g, shellMat(shade(d.c,0.06)), 0.03,0.02,0.09, 0.145, -0.06);
    blob(g, bm, 0,0.15,0.05, 0.03, 1,0.9,1.1); const cog=grp(g,0,0.17,0.02); for (let i=0;i<9;i++){ const a=-0.9*PI/2+i/8*PI*0.9; spike(cog, shellMat(d.c2), [0,sin(a+PI/2)*0.025,cos(a+PI/2)*0.025],[0,sin(a+PI/2),cos(a+PI/2)],0.02,0.006); } mesh(new THREE.TorusGeometry(0.026,0.006,6,20,PI), shellMat(d.c2), 0,0,0, cog, false).rotation.y=PI/2;
    rod(g, bm, [0,0.15,0.08],[0,0.155,0.15], 0.012,0.008,8); eyes(g, 0.014,0.16,0.12, 0.008, 0xe84a2a); bend(g, dark, [[0,0.145,0.15],[0,0.12,0.15],[0,0.11,0.11]], ()=>0.003, 4, 8);
    antennae(g, dark, [0,0.16,0.15], 0.12, 'elbow', 0.5, 0.002); for (let i=0;i<3;i++) legs2(g, shellMat(d.c2), [0.015,0.13,0.06-i*0.04],[0.09,0.2,0.08-i*0.08],[0.17,0.1,0.1-i*0.13],[0.2,0.004,0.11-i*0.16], 0.004); },
  // a tiny bug wearing a huge curved thorn on its back, so birds pass it by
  treehopper(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.4 }); blob(g, bm, 0,0.09,-0.02, 0.045, 0.9,0.8,1.4);
    const helm=welded(sph(0.05,28,18)); displace(helm,v=>{ v.z*=1.6; v.x*=0.95; if (v.y<0) v.y*=0.4; }); mesh(helm, bm, 0,0.11,-0.01, g);
    const th=bend(g, shellMat(d.c2,{ roughness:0.35 }), [[0,0.14,0.02],[0,0.24,0.04],[0,0.32,0.0],[0,0.34,-0.06]], t=>0.024*(1-t)+0.002, 10, 16, { squash:0.6 }); spike(g, shellMat(d.c2), [0,0.13,-0.08],[0,0.2,-1],0.06,0.012);
    blob(g, shellMat(shade(d.c,-0.1)), 0,0.08,0.06, 0.025, 1.4,0.8,0.6); eyes(g, 0.03,0.09,0.06, 0.01, 0xd84020); sixLegs(g, dark, 0.07, 0.04, 0.04, 0.07, 0.004); },
  // a gold dome inside a clear glass rim, like a drop of honey under a lens
  tortoisebeetle(g,d,id,{dark}){ const gold=shellMat(d.c,{ metalness:0.75, roughness:0.15, clearcoat:1 }); elytra(g, gold, 0.06,0.045,0.07, 0.07, -0.005, 0xb08010);
    blob(g, gold, 0,0.07,0.06, 0.03, 1,0.6,0.6); const rim=welded(sph(1,40,10,0,TAU,0,PI*0.5)); displace(rim,v=>{ v.x*=0.1; v.z*=0.11; v.y*=0.03; }); const rm=mesh(rim, glassy(d.c2,0.35), 0,0.065,0.005, g); rm.renderOrder=2;
    for (let i=0;i<8;i++){ const a=i/8*TAU; mesh(tube(curve([[cos(a)*0.06,0.068,0.005+sin(a)*0.06],[cos(a)*0.095,0.07,0.005+sin(a)*0.1]],3),()=>0.0012,3), shellMat(d.c2), 0,0,0, g, false); }
    eyes(g, 0.012,0.07,0.085, 0.006); sixLegs(g, dark, 0.05, 0.04, 0.035, 0.06, 0.004); },

  // ---------- on tree trunks ----------
  // a long bullet of polished metal that changes colour as you turn it
  jewelbeetle(g,d,id,{dark}){ const jm=shellMat(d.c,{ metalness:0.6, roughness:0.15, iridescence:1, iridescenceIOR:2.0, iridescenceThicknessRange:[300,900] }); const b=welded(sph(0.06,40,24)); displace(b,v=>{ v.z*=2.6; if (v.z<0) v.x*=1+v.z*2.2; v.y*=0.7; v.y+=Math.abs(sin(v.x*120))*0.002; }); mesh(b, jm, 0,0.1,-0.03, g);
    for (const x of [-0.03,-0.015,0.015,0.03]) mesh(tube(curve([[x,0.135,0.08],[x*0.9,0.14,-0.04],[x*0.4,0.12,-0.16]],10),()=>0.0016,3), shellMat(d.c2,{ metalness:0.6 }), 0,0,0, g, false);
    blob(g, jm, 0,0.1,0.13, 0.04, 1.1,0.75,0.8); blob(g, jm, 0,0.1,0.18, 0.025, 1.1,0.8,0.7); eyes(g, 0.025,0.105,0.19, 0.013, 0x3a2a10);
    antennae(g, dark, [0,0.11,0.2], 0.05, 'elbow', 0.6, 0.002); sixLegs(g, dark, 0.07, 0.11, 0.06, 0.07, 0.005, { high:0.5 }); },
  // a tall candy-striped shell, and a soft snail stretching out on its two eye stalks
  treesnail(g,d,id){ const turns=5.5, pts=[]; for (let i=0;i<=120;i++){ const t=i/120, a=t*turns*TAU, r=0.045*(1-t*0.85); pts.push(V3(cos(a)*r*0.6, 0.1+t*0.2, -0.03+sin(a)*r*0.6)); }
    const sg=tube(pts, t=>0.045*(1-t*0.85)+0.004, 16); setColors(sg, (v,n,o,i)=>{ const t=(Math.floor(i/17))/120; o.set(d.c); if (sin(t*turns*TAU*2+((i%17)/16)*TAU*0.6)>0.45) o.set(d.c2); if (((i%17)/16)>0.85) o.offsetHSL(0,0,-0.1); });
    mesh(sg, vcPhys({ roughness:0.25, clearcoat:1 }), 0,0,0, g); const sk=ceramic(0xe8c8a0); const ft=welded(new THREE.CapsuleGeometry(0.03,0.16,8,16)); ft.rotateX(PI/2); displace(ft,v=>{ v.y*=0.55; if (v.y<0) v.y*=0.3; }); mesh(ft, sk, 0,0.03,0.04, g);
    const head=keep(g, grp(g, 0,0.04,0.12)); blob(head, sk, 0,0.01,0, 0.028, 1,0.9,1); const st=[]; pairs(k=>{ const s=grp(head, k*0.012,0.02,0.01); st.push(s); bend(s, sk, [[0,0,0],[k*0.01,0.04,0.01],[k*0.018,0.07,0.02]], t=>0.005*(1-t*0.3), 5, 8); blob(s, ceramic(0x2a1a14), k*0.018,0.075,0.02, 0.008); });
    g.userData.idle=t=>{ head.rotation.x=sin(t*0.6)*0.08; st.forEach((s,i)=>{ s.rotation.z=sin(t*1.2+i*2)*0.25; s.rotation.x=sin(t*0.9+i)*0.15; }); }; },
  // a walking leaf: flat body with a midrib and veins, and leafy flaps on its legs
  leafinsect(g,d,id,{dark}){ const ls=new THREE.Shape(); ls.moveTo(0,0.1); ls.bezierCurveTo(0.06,0.06,0.1,-0.04,0.08,-0.12); ls.bezierCurveTo(0.05,-0.18,0.02,-0.2,0,-0.24); ls.bezierCurveTo(-0.02,-0.2,-0.05,-0.18,-0.08,-0.12); ls.bezierCurveTo(-0.1,-0.04,-0.06,0.06,0,0.1);
    const lg=new THREE.ExtrudeGeometry(ls,{ depth:0.008, bevelEnabled:true, bevelThickness:0.006, bevelSize:0.004, bevelSegments:3, curveSegments:24 }); lg.rotateX(-PI/2); displace(lg,v=>{ v.y+=0.012*(1-(v.x/0.1)**2); });
    painted(g, lg, (v,n,o)=>{ o.set(d.c); const vz=v.z; if (Math.abs(v.x)<0.004) o.set(d.c2); else if (Math.abs(((Math.abs(v.x)*1.4+vz)*25)%1-0.5)<0.06 && n.y>0) o.lerp(col(d.c2),0.6); if (Math.abs(v.x)>0.07) o.offsetHSL(0,0,-0.06); }, 0,0.06,0, { roughness:0.6, clearcoat:0.2 });
    blob(g, shellMat(d.c), 0,0.075,0.12, 0.022, 1,0.7,1.2); eyes(g, 0.016,0.08,0.13, 0.007, 0x8a6a3a); antennae(g, shellMat(d.c), [0,0.08,0.14], 0.03, 'whip', 0.5, 0.0016);
    for (let i=0;i<3;i++){ legs2(g, shellMat(d.c), [0.02,0.06,0.08-i*0.07],[0.07,0.09,0.1-i*0.08],[0.12,0.04,0.1-i*0.09],[0.14,0.004,0.1-i*0.09], 0.004); pairs(k=>{ const f=blob(g, shellMat(d.c,{ side:THREE.DoubleSide }), k*0.095,0.065,0.1-i*0.085, 0.02, 1.4,0.15,0.8); f.rotation.z=k*-0.6; }); } },

  // ---------- on the ground ----------
  // a long brown body ending in a pair of curved pincers
  earwig(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.4 }); segs(g, bm, [[0,0.06,0.05],[0,0.06,-0.05],[0,0.058,-0.15],[0,0.06,-0.22]], t=>0.024*(1-t*0.25)+0.004, 12, 7, ); elytra(g, shellMat(d.c2,{ roughness:0.4 }), 0.026,0.014,0.04, 0.065, 0.0);
    blob(g, bm, 0,0.065,0.08, 0.022, 1,0.75,1.1); eyes(g, 0.02,0.07,0.095, 0.007); antennae(g, shellMat(d.c2), [0,0.07,0.1], 0.07, 'elbow', 0.7, 0.0022);
    pairs(k=>bend(g, shellMat(shade(d.c,-0.08)), [[k*0.01,0.06,-0.22],[k*0.03,0.062,-0.27],[k*0.02,0.064,-0.32],[-k*0.005,0.066,-0.34]], t=>0.006*(1-t*0.6), 6, 12)); sixLegs(g, shellMat(d.c2), 0.05, 0.06, 0.045, 0.07, 0.0035); },
  // an ant carrying a cut piece of leaf over its head like a sail
  leafcutter(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.45 }); blob(g, bm, 0,0.07,-0.09, 0.038, 0.9,0.85,1.15); rod(g, bm, [0,0.065,-0.05],[0,0.06,-0.035], 0.006,0.006,5);
    blob(g, bm, 0,0.07,0.0, 0.025, 0.75,0.8,1.6); for (const z of [0.02,-0.02]) pairs(k=>spike(g, bm, [k*0.01,0.085,z],[k*0.5,1,-0.3],0.02,0.004));
    const hd=welded(sph(0.035,28,18)); displace(hd,v=>{ v.x*=1.2; if (v.y>0) v.x*=1+v.y*4; }); mesh(hd, bm, 0,0.08,0.06, g); eyes(g, 0.03,0.085,0.075, 0.006);
    pairs(k=>bend(g, dark, [[k*0.02,0.07,0.085],[k*0.018,0.07,0.11],[k*0.004,0.08,0.12]], t=>0.005*(1-t*0.4), 4, 6)); antennae(g, bm, [0,0.1,0.08], 0.06, 'elbow', 0.7, 0.002);
    const leafS=new THREE.Shape(); leafS.moveTo(0,0); leafS.absarc(0,0,0.11,0.1,PI-0.2,false); leafS.lineTo(0,0); const lf=mesh(new THREE.ShapeGeometry(leafS,20), shellMat(d.c2,{ side:THREE.DoubleSide, roughness:0.6 }), 0,0.08,0.11, g, false); lf.rotation.set(0,PI/2,0.35);
    mesh(tube(curve([[0,0.08,0.11],[0,0.15,0.05],[0,0.18,-0.02]],6),()=>0.0016,3), shellMat(shade(d.c2,0.15)), 0,0,0, g, false); sixLegs(g, bm, 0.06, 0.03, 0.03, 0.09, 0.004, { high:0.6 }); },
  // a beetle doing a handstand, pushing its ball of dung backwards with its hind legs
  dungbeetle(g,d,id,{dark}){ const body=grp(g, 0,0,0.04); body.rotation.x=-0.35; const sh=shellMat(d.c,{ clearcoat:1, roughness:0.2 }); elytra(body, sh, 0.05,0.035,0.06, 0.1, -0.02, 0x0a0a0a);
    blob(body, sh, 0,0.1,0.05, 0.04, 1.2,0.7,0.8); const sc=blob(body, sh, 0,0.09,0.1, 0.035, 1.6,0.3,0.9); for (let i=0;i<6;i++) spike(body, sh, [(i-2.5)*0.012,0.09,0.13],[0,0,1],0.012,0.004);
    eyes(body, 0.04,0.095,0.09, 0.007); for (let i=0;i<2;i++) legs2(body, dark, [0.03,0.08,0.06-i*0.04],[0.07,0.09,0.09-i*0.05],[0.11,0.04,0.1-i*0.05],[0.12,0.004,0.12-i*0.05], 0.005);
    const ball=keep(g, grp(g, 0,0.09,-0.13)); const bg=welded(sph(0.09,32,22)); displace(bg,v=>v.multiplyScalar(1+fbm(v.x*30,v.y*30,v.z*30,2)*0.08)); painted(ball, bg, (v,n,o)=>{ o.set(d.c2); if (fbm(v.x*60,v.y*60,v.z*60,9)>0.4) o.offsetHSL(0,0,-0.08); }, 0,0,0, { roughness:0.95, clearcoat:0 });
    legs2(g, dark, [0.03,0.11,0.0],[0.07,0.17,-0.04],[0.05,0.16,-0.09],[0.03,0.14,-0.1], 0.005); g.userData.idle=t=>{ ball.rotation.x=-t*0.6; }; },
  // a flat, many-legged hunter on the move, with poison claws under its head
  centipede(g,d,id,{dark}){ const pts=curve([[0,0.04,0.2],[0.04,0.04,0.1],[-0.03,0.04,-0.02],[0.03,0.04,-0.14],[0,0.04,-0.24]],34); const bm=shellMat(d.c,{ roughness:0.4 }), lm=shellMat(d.c2);
    mesh(tube(pts, t=>0.024*(1-Math.abs(t-0.45)*0.35), 10, { squash:0.45, ring:(t)=>1-0.12*Math.max(0,sin(t*PI*30))**3 }), bm, 0,0,0, g);
    for (let i=2;i<33;i+=2){ const p=pts[i], q=pts[Math.min(33,i+1)], dir=V3().subVectors(q,p).normalize(), sd=V3(dir.z,0,-dir.x); pairs(k=>{ const a=p.clone().addScaledVector(sd,k*0.022), b=p.clone().addScaledVector(sd,k*0.05).add(V3(0,0.025,0)), c=p.clone().addScaledVector(sd,k*0.075).add(V3(0,-0.036,0)).addScaledVector(dir,-0.01); leg(g, lm, a.toArray(), b.toArray(), b.clone().lerp(c,0.5).toArray(), c.toArray(), 0.0035); }); }
    const h=pts[0]; blob(g, bm, h.x,h.y,h.z+0.01, 0.025, 1,0.45,0.9); antennae(g, lm, [h.x,h.y+0.005,h.z+0.02], 0.08, 'whip', 0.6, 0.002); pairs(k=>bend(g, shellMat(0x2a1a14), [[h.x+k*0.012,h.y-0.006,h.z+0.015],[h.x+k*0.02,h.y-0.008,h.z+0.035],[h.x+k*0.006,h.y-0.008,h.z+0.045]], t=>0.004*(1-t*0.6), 4, 6));
    const tl=pts[33]; pairs(k=>bend(g, lm, [[tl.x,tl.y,tl.z],[tl.x+k*0.04,tl.y+0.01,tl.z-0.05],[tl.x+k*0.06,tl.y+0.005,tl.z-0.1]], t=>0.004*(1-t*0.5), 4, 8)); },
  // the sprinter: stilt legs, giant sickle jaws and bulging eyes on a jewel-green body
  tigerbeetle(g,d,id,{dark}){ const jm=shellMat(d.c,{ metalness:0.5, roughness:0.2, iridescence:0.8 }); const b=welded(sph(0.05,32,20)); displace(b,v=>{ v.z*=1.7; v.y*=0.6; });
    painted(g, b, (v,n,o)=>{ o.set(d.c); const s=[[0.025,0.02],[0.03,-0.03],[0.02,-0.06]]; for (const [x,z] of s) if (Math.hypot(Math.abs(v.x)-x,v.z-z)<0.009 && n.y>0) o.set(d.c2); }, 0,0.12,-0.04, { metalness:0.5, roughness:0.2, iridescence:0.8 });
    blob(g, jm, 0,0.12,0.05, 0.025, 1,0.8,1.2); blob(g, jm, 0,0.125,0.09, 0.028, 1.3,0.8,0.8); pairs(k=>compoundEye(g, k*0.032,0.135,0.095, 0.017, 0x3a5a3a));
    pairs(k=>bend(g, shellMat(0xf0e8d0), [[k*0.015,0.115,0.11],[k*0.03,0.115,0.14],[k*0.012,0.112,0.165],[-k*0.004,0.112,0.16]], t=>0.006*(1-t*0.7), 5, 10)); antennae(g, dark, [0,0.135,0.11], 0.08, 'whip', 0.6, 0.0018);
    for (let i=0;i<3;i++) legs2(g, shellMat(d.c,{ metalness:0.4 }), [0.02,0.11,0.05-i*0.03],[0.09,0.2,0.07-i*0.08],[0.16,0.1,0.08-i*0.14],[0.18,0.004,0.09-i*0.18], 0.004); },
  // a velvet digger with front legs shaped like shovels
  molecricket(g,d,id,{dark}){ const vel=fuzzMat(d.c); segs(g, vel, [[0,0.06,-0.02],[0,0.058,-0.1],[0,0.055,-0.18]], t=>0.03*(1-t*0.5)+0.006, 12, 6); const tm=welded(sph(0.045,28,18)); displace(tm,v=>{ v.z*=1.4; v.y*=0.9; }); mesh(tm, vel, 0,0.07,0.06, g);
    blob(g, fuzzMat(d.c2), 0,0.068,0.12, 0.025, 1,0.85,0.9); eyes(g, 0.02,0.078,0.13, 0.008); elytra(g, shellMat(d.c2,{ roughness:0.5 }), 0.028,0.012,0.05, 0.08, -0.04);
    pairs(k=>{ rod(g, vel, [k*0.03,0.05,0.09],[k*0.06,0.03,0.13], 0.012,0.012,8); const sv=grp(g, k*0.07,0.025,0.15); const pl=blob(sv, shellMat(d.c2), 0,0,0, 0.03, 0.4,0.9,1); for (let i=0;i<4;i++) spike(sv, shellMat(shade(d.c2,-0.15)), [k*0.004,-0.02,-0.015+i*0.012],[k*0.3,-1,0.4],0.022,0.004); });
    legs2(g, vel, [0.02,0.05,-0.02],[0.07,0.07,-0.04],[0.1,0.02,-0.06],[0.12,0.004,-0.08], 0.006); legs2(g, vel, [0.02,0.05,-0.06],[0.08,0.1,-0.12],[0.11,0.04,-0.2],[0.12,0.004,-0.24], 0.008);
    pairs(k=>bend(g, vel, [[k*0.01,0.055,-0.2],[k*0.04,0.06,-0.26],[k*0.06,0.065,-0.3]], t=>0.003, 4, 6)); antennae(g, dark, [0,0.08,0.14], 0.05, 'whip', 0.6, 0.0018); },
  // curled up tight in a spiral of shiny rings, its hundreds of little legs tucked inside
  millipede(g,d,id){ const pts=[]; for (let i=0;i<=90;i++){ const t=i/90, a=t*TAU*1.75, r=0.11-t*0.065; pts.push(V3(cos(a)*r, 0.055+t*0.004, sin(a)*r)); }
    const bg=tube(pts, t=>0.038*(1-t*0.35)+0.004, 14, { ring:(t)=>1-0.1*Math.max(0,sin(t*PI*44))**3 }); setColors(bg,(v,n,o,i)=>{ const t=Math.floor(i/15)/90; o.set(d.c); if (sin(t*PI*44)<-0.75) o.set(d.c2); }); mesh(bg, vcPhys({ roughness:0.25, clearcoat:1 }), 0,0,0, g);
    for (let i=2;i<88;i+=2){ const p=pts[i], inn=V3(-p.x,0,-p.z).normalize(); for (const s of [0.006,-0.006]) mesh(tube([p.clone().add(V3(0,-0.02,s)), p.clone().addScaledVector(inn,0.028).add(V3(0,-0.04,s))],t=>0.0028,3), shellMat(d.c2), 0,0,0, g, false); }
    const h=pts[90]; blob(g, shellMat(d.c), h.x,h.y,h.z, 0.025); antennae(g, shellMat(d.c2), [h.x,h.y+0.01,h.z], 0.03, 'whip', 0.6, 0.0022); },
  // not an ant but a wingless wasp in a coat of red velvet
  velvetant(g,d,id,{dark}){ const vr=fuzzMat(d.c), vb=fuzzMat(d.c2); const ab=welded(sph(0.05,30,20)); displace(ab,v=>{ v.z*=1.3; }); bandPaint(g, ab, hx(d.c), hx(d.c2), v=>Math.abs(v.z+0.005)<0.012 || v.z<-0.045, 0,0.07,-0.07, { roughness:1, clearcoat:0, sheen:1 });
    rod(g, vb, [0,0.065,-0.02],[0,0.065,0.0], 0.008,0.006,6); blob(g, vr, 0,0.075,0.03, 0.03, 0.9,0.85,1.3); blob(g, vb, 0,0.075,0.08, 0.028, 1.15,0.95,0.85); eyes(g, 0.024,0.08,0.09, 0.008);
    antennae(g, vb, [0,0.09,0.1], 0.06, 'elbow', 0.6, 0.0025); sixLegs(g, vb, 0.06, 0.05, 0.04, 0.065, 0.005, { high:0.45 }); },
  // a speck of a spider with a rainbow fan it lifts and waves to show off
  peacockspider(g,d,id){ const bm=fuzzMat(d.c); blob(g, bm, 0,0.07,0.04, 0.032, 1,0.8,1.1); for (let i=0;i<4;i++) blob(g, ceramic(0x0a0a0a), (i-1.5)*0.012,0.085,0.075, 0.006+(i===1||i===2?0.004:0));
    blob(g, bm, 0,0.075,-0.03, 0.03, 1,0.8,1);
    const fan=keep(g, grp(g, 0,0.09,-0.05)); fan.rotation.x=0.3; const fs=new THREE.Shape(); fs.absellipse(0,0,0.11,0.1,0,PI,false); const fg=new THREE.ShapeGeometry(fs,32);
    setColors(fg,(v,n,o)=>{ const r=Math.hypot(v.x/0.11,v.y/0.1), a=Math.atan2(v.y,v.x); o.set(0xf04a2a); if (r<0.75) o.set(0x3ad0d8); if (r<0.5) o.set(0x2a4ad8); if (r<0.25) o.set(0xf0a02a); if (Math.abs(sin(a*6))<0.12) o.set(0x1a1a1a); }); mesh(fg, vcPhys({ side:THREE.DoubleSide, iridescence:1 }), 0,0,0, fan, false);
    for (let i=0;i<4;i++){ if (i===2){ legs2(g, bm, [0.02,0.07,0.0],[0.06,0.13,-0.01],[0.09,0.17,0.0],[0.1,0.2,0.01], 0.004); pairs(k=>blob(g, ceramic(0xffffff), k*0.1,0.205,0.01, 0.006)); continue; } const a=0.9-i*0.55; legs2(g, bm, [0.02,0.07,0.04-i*0.015],[0.035*cos(a)+0.03,0.095,0.04+0.035*sin(a)],[0.065*cos(a)+0.03,0.05,0.04+0.065*sin(a)],[0.08*cos(a)+0.03,0.004,0.04+0.08*sin(a)], 0.005); }
    g.userData.idle=t=>{ fan.rotation.z=sin(t*5)*0.25*Math.max(0,sin(t*0.8)); }; },
  // a big furry spider with orange-red knees
  tarantula(g,d,id){ const fz=fuzzMat(d.c), kn=fuzzMat(d.c2); blob(g, fz, 0,0.1,-0.1, 0.075, 1,0.85,1.15); const ce=blob(g, fz, 0,0.095,0.03, 0.06, 1,0.55,1.1); blob(g, fuzzMat(shade(d.c,0.1)), 0,0.12,0.03, 0.03, 1,0.3,1);
    for (let i=0;i<4;i++){ const a=0.85-i*0.5, L=0.24; pairs(k=>{ const hip=[k*0.04,0.09,0.06-i*0.025], knee=[k*(0.04+L*0.45*cos(a)),0.18,0.06+L*0.45*sin(a)], ankle=[k*(0.04+L*0.85*cos(a)),0.09,0.06+L*0.85*sin(a)], foot=[k*(0.04+L*1.05*cos(a)),0.004,0.06+L*1.05*sin(a)];
      mesh(tube([V3(...hip),V3(...knee)],t=>0.014*(1-t*0.2),8), fz, 0,0,0, g, false); blob(g, kn, ...knee, 0.016); mesh(tube([V3(...knee),V3(...ankle),V3(...foot)].length?curve([knee,ankle,foot],8):[],t=>0.011*(1-t*0.4),8), fz, 0,0,0, g, false); }); }
    pairs(k=>{ bend(g, fz, [[k*0.02,0.09,0.08],[k*0.04,0.1,0.13],[k*0.035,0.04,0.16]], t=>0.009, 6, 8); spike(g, ceramic(0x1a1012), [k*0.012,0.07,0.09],[0,-1,0.3],0.03,0.007); });
    for (let i=0;i<8;i++) blob(g, ceramic(0x0a0a0a), (i%4-1.5)*0.007,0.13,0.07-(i>>2)*0.006, 0.0035); },

  // ---------- on the beach ----------
  // older than the dinosaurs: a horseshoe shield, a spiny back plate and a long tail spike
  horseshoe(g,d,id){ const sh=shellMat(d.c,{ roughness:0.4, clearcoat:0.8 }); const c=welded(sph(0.17,40,20,0,TAU,0,PI*0.5)); displace(c,v=>{ v.y*=0.45; if (v.z<-0.06) v.z=-0.06+(v.z+0.06)*0.3; v.y+=Math.max(0,0.01-Math.abs(v.x)*0.3); }); mesh(c, sh, 0,0.02,0.06, g);
    const ridge=curve([[0,0.1,0.21],[0,0.1,0.06],[0,0.06,-0.05]],10); mesh(tube(ridge,t=>0.006,5), sh, 0,0,0, g, false); pairs(k=>blob(g, ceramic(0x1a1410), k*0.07,0.07,0.1, 0.01, 1.4,0.5,0.8));
    const ab=welded(sph(0.1,30,14,0,TAU,0,PI*0.5)); displace(ab,v=>{ v.y*=0.4; v.x*=0.95; v.z*=0.8; if (v.z<0) v.x*=1+v.z*2; }); mesh(ab, shellMat(d.c2,{ roughness:0.45 }), 0,0.02,-0.06, g);
    pairs(k=>{ for (let i=0;i<5;i++) spike(g, shellMat(d.c2), [k*(0.085-i*0.01),0.03,-0.04-i*0.025],[k*1,0,-0.3],0.03,0.005); });
    rod(g, sh, [0,0.03,-0.13],[0,0.04,-0.38], 0.012,0.003,8); },

  // ---------- by the water ----------
  // a smooth olive oval rimmed in gold, rowing with two hairy paddle legs
  divingbeetle(g,d,id,{dark}){ const b=welded(sph(0.07,40,24)); displace(b,v=>{ v.z*=1.5; v.y*=0.55; }); painted(g, b, (v,n,o)=>{ o.set(d.c); if (Math.hypot(v.x/0.07,v.z/0.105)>0.86) o.set(d.c2); }, 0,0.08,-0.01, { roughness:0.15, clearcoat:1 });
    blob(g, shellMat(d.c), 0,0.08,0.1, 0.03, 1.2,0.6,0.7); eyes(g, 0.028,0.085,0.11, 0.008); antennae(g, shellMat(d.c2), [0,0.09,0.12], 0.05, 'whip', 0.8, 0.0016);
    legs2(g, dark, [0.03,0.07,0.06],[0.07,0.08,0.09],[0.09,0.04,0.11],[0.1,0.004,0.13], 0.0035); legs2(g, dark, [0.03,0.07,0.02],[0.08,0.08,0.02],[0.11,0.04,0.02],[0.12,0.004,0.01], 0.0035);
    pairs(k=>{ const p=grp(g, k*0.05,0.07,-0.06); rod(p, shellMat(d.c2), [0,0,0],[k*0.07,0,-0.05], 0.005,0.005,5); const pd=blob(p, shellMat(d.c2), k*0.12,0,-0.1, 0.05, 0.28,0.08,1); pd.rotation.y=k*0.6; for (let i=0;i<12;i++){ const t=i/11; rod(p, shellMat(0xe8d8a0), [k*(0.07+t*0.08),0,-0.05-t*0.07],[k*(0.08+t*0.08),0,-0.07-t*0.07].map((x,j)=>j===0?x+k*0.015:x), 0.001,0.0006,3); } }); },
  // a stick with grabbing front arms and a snorkel tail it breathes through
  waterscorpion(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.6 }); segs(g, bm, [[0,0.05,0.14],[0,0.05,0.04],[0,0.05,-0.08],[0,0.05,-0.18]], t=>0.016*(1-Math.abs(t-0.5)*0.5)+0.004, 10, 6); blob(g, bm, 0,0.05,0.15, 0.014, 1,0.9,1.3); eyes(g, 0.013,0.055,0.155, 0.006, 0x3a2a1a);
    pairs(k=>bend(g, shellMat(d.c2), [[k*0.003,0.05,-0.18],[k*0.006,0.055,-0.28],[k*0.008,0.06,-0.36]], ()=>0.0022, 3, 10));
    pairs(k=>{ rod(g, bm, [k*0.01,0.05,0.13],[k*0.03,0.09,0.2], 0.005,0.004,5); rod(g, bm, [k*0.03,0.09,0.2],[k*0.03,0.06,0.15], 0.004,0.0025,5); });
    legs2(g, bm, [0.01,0.045,0.04],[0.08,0.06,0.05],[0.14,0.02,0.06],[0.17,0.004,0.06], 0.0025); legs2(g, bm, [0.01,0.045,-0.02],[0.09,0.06,-0.06],[0.15,0.02,-0.1],[0.18,0.004,-0.12], 0.0025); },

  // ---------- the isles ----------
  // a little froghopper that hides in a frothy blob of its own bubbles
  spittlebug(g,d,id,{dark}){ bubbleFroth(g, 34, 0.028, 0, 0.04, -0.01, 0.07); const bm=shellMat(d.c,{ roughness:0.4 }); const b=welded(sph(0.035,24,16)); displace(b,v=>{ v.z*=1.5; v.y*=0.8; }); mesh(b, bm, 0,0.06,0.05, g);
    blob(g, bm, 0,0.07,0.09, 0.022, 1.2,0.8,0.8); eyes(g, 0.02,0.075,0.095, 0.007, 0x8a2a1a); legs2(g, dark, [0.015,0.05,0.07],[0.04,0.05,0.1],[0.05,0.02,0.11],[0.055,0.004,0.12], 0.0025); },
  // a tiny wasp that shines like a gem, blue-green up front and ruby behind
  cuckoowasp(g,d,id,{wings,dark}){ const gm=o=>shellMat(o,{ metalness:0.7, roughness:0.2, iridescence:1, iridescenceIOR:2 }); const ab=welded(sph(0.04,30,20)); displace(ab,v=>{ v.z*=1.4; v.multiplyScalar(1+(n3(v.x*300,v.y*300,v.z*300)-0.5)*0.03); }); mesh(ab, gm(d.c2), 0,0.075,-0.05, g);
    const th=welded(sph(0.03,28,18)); displace(th,v=>{ v.z*=1.3; v.multiplyScalar(1+(n3(v.x*300,v.y*300,v.z*300)-0.5)*0.04); }); mesh(th, gm(d.c), 0,0.085,0.015, g); blob(g, gm(d.c), 0,0.085,0.055, 0.024, 1.15,1,0.8); eyes(g, 0.02,0.09,0.06, 0.01, 0x1a2a3a);
    wingSet(g, wings, 0.11, 0.015, [[[[0.03,0.015,0.09,0.02,0.12,0.0],[0.08,-0.025,0.03,-0.02]], clearW(0x8a8a9a,0x2a2a3a), { ry:1.1, rz:0.05 }]], 0.012);
    antennae(g, dark, [0,0.1,0.07], 0.04, 'elbow', 0.6, 0.002); sixLegs(g, gm(d.c), 0.065, 0.03, 0.03, 0.07, 0.003); },
  // antennae twice as long as its body, ringed black and white
  longhorn(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.3 }); const b=welded(sph(0.05,32,20)); displace(b,v=>{ v.z*=2.6; v.y*=0.6; if (v.z<0) v.x*=1+v.z*1.5; }); painted(g, b, (v,n,o)=>{ o.set(d.c); if (n.y>0.2 && fbm(v.x*80,0,v.z*40,2)>0.45) o.set(d.c2); }, 0,0.08,-0.05, { roughness:0.3 });
    blob(g, bm, 0,0.08,0.1, 0.028, 1,0.85,1.2); pairs(k=>spike(g, bm, [k*0.026,0.08,0.1],[k*1,0,0],0.014,0.005)); blob(g, bm, 0,0.08,0.14, 0.022, 1.1,0.9,0.9); eyes(g, 0.02,0.085,0.15, 0.008);
    pairs(k=>{ const a=curve([[k*0.012,0.095,0.155],[k*0.07,0.15,0.18],[k*0.16,0.14,0.08],[k*0.22,0.1,-0.1],[k*0.24,0.06,-0.28]],40); for (let i=0;i<39;i++) mesh(tube([a[i],a[i+1]],()=>0.0035*(1-i/60),5,{ caps:false }), (i>>2)%2?shellMat(d.c2):bm, 0,0,0, g, false); });
    sixLegs(g, bm, 0.06, 0.07, 0.06, 0.12, 0.0045); },
  // a katydid dressed in moss, with tufts all over and endless antennae
  mosskatydid(g,d,id,{dark}){ const mm=shellMat(d.c,{ roughness:0.8 }), mo=fuzzMat(d.c2); segs(g, mm, [[0,0.09,0.06],[0,0.09,-0.04],[0,0.085,-0.14]], t=>0.028*(1-t*0.4)+0.006, 12, 5);
    const wg=welded(sph(0.05,28,16)); displace(wg,v=>{ v.z*=2.4; v.x*=0.55; v.y*=0.7; v.multiplyScalar(1+fbm(v.x*40,v.y*40,v.z*40,6)*0.15); }); mesh(wg, mm, 0,0.11,-0.04, g);
    for (let i=0;i<40;i++){ const z=0.06-i*0.005, a=i*2.3; blob(g, mo, sin(a)*0.025, 0.12+cos(a)*0.02, z, 0.008+0.005*n3(i,3,1)); }
    blob(g, mm, 0,0.1,0.09, 0.03, 0.95,1.1,0.9); eyes(g, 0.025,0.11,0.1, 0.009, 0x6a5a2a); pairs(k=>bend(g, mm, [[k*0.01,0.12,0.11],[k*0.1,0.25,0.2],[k*0.2,0.3,0.0],[k*0.25,0.24,-0.3]], t=>0.0018*(1-t*0.5), 3, 30));
    legs2(g, mm, [0.02,0.08,-0.02],[0.06,0.2,-0.06],[0.08,0.08,-0.18],[0.09,0.004,-0.22], 0.008); legs2(g, mm, [0.02,0.07,0.05],[0.06,0.12,0.08],[0.09,0.04,0.1],[0.1,0.004,0.12], 0.004); legs2(g, mm, [0.02,0.07,0.02],[0.07,0.11,0.0],[0.1,0.04,-0.01],[0.11,0.004,-0.02], 0.004); },
  // a pudgy larva waiting at the bottom of its sand trap, jaws wide open
  antlion(g,d,id,{dark}){ g.userData.bottom=true; const pit=new THREE.LatheGeometry([V2(0.0,0.0),V2(0.05,0.004),V2(0.14,0.04),V2(0.22,0.07),V2(0.27,0.075),V2(0.31,0.04),V2(0.33,0.0)],40); painted(g, pit, (v,n,o)=>{ o.set(0xe2cfa4); if (fbm(v.x*40,v.y*40,v.z*40,7)>0.3) o.offsetHSL(0,0,-0.06); if (Math.hypot(v.x,v.z)<0.12) o.offsetHSL(0,0,-0.08); }, 0,0,0, { roughness:1, clearcoat:0, side:THREE.DoubleSide });
    const bm=fuzzMat(d.c); blob(g, bm, 0,0.04,-0.03, 0.07, 1,0.6,1.15); for (let i=0;i<10;i++) pairs(k=>spike(g, bm, [k*0.06,0.04,-0.06+i*0.01],[k*1,0.3,0],0.02,0.004)); blob(g, bm, 0,0.05,0.05, 0.035, 1.1,0.6,0.9);
    pairs(k=>bend(g, shellMat(0x5a3a1a), [[k*0.018,0.055,0.08],[k*0.06,0.065,0.12],[k*0.055,0.07,0.18],[k*0.015,0.07,0.2]], t=>0.008*(1-t*0.7), 5, 12)); pairs(k=>{ for (let i=0;i<3;i++) spike(g, shellMat(0x5a3a1a), [k*0.055,0.068,0.12+i*0.02],[-k*1,0,0.2],0.012,0.0025); }); eyes(g, 0.024,0.07,0.075, 0.007); },
  // an egg-shaped sand crab, half dug in, combing the waves with feathery antennae
  molecrab(g,d,id){ g.userData.bottom=true; const sand=welded(sph(0.17,32,10,0,TAU,0,PI/2)); displace(sand,v=>{ v.y*=0.2; v.multiplyScalar(1+fbm(v.x*15,0,v.z*15,5)*0.1); }); mesh(sand, ceramic(0xe2cfa4), 0,0,0, g);
    const c=welded(sph(0.06,32,20)); displace(c,v=>{ v.z*=1.4; v.y*=0.8; if (v.z>0) v.y+=v.z*0.25; }); painted(g, c, (v,n,o)=>{ o.set(d.c); if (Math.abs(sin(v.z*160))>0.9) o.offsetHSL(0,0,-0.06); }, 0,0.04,0, { roughness:0.35 });
    pairs(k=>{ rod(g, shellMat(d.c2), [k*0.01,0.07,0.07],[k*0.012,0.1,0.08], 0.003,0.002,4); blob(g, ceramic(0x1a1410), k*0.012,0.102,0.081, 0.004); antennae(g, shellMat(d.c2), [0,0.07,0.08], 0.09, 'feather', 0.4, 0.002); }); },
  // tented wings in chocolate and cream, flashing orange underwings with blue-black spots
  tigermoth(g,d,id,{wings}){ const fr=fuzzMat(0xd8402a), fb=fuzzMat(0x5a3a2a); segs(g, fr, [[0,0.27,0.0],[0,0.265,-0.08],[0,0.26,-0.15]], t=>0.03*sin(PI*clamp(t*0.85+0.15,0,1))**0.6+0.006, 12, 6); for (let i=0;i<4;i++) blob(g, fuzzMat(0x1a1410), 0,0.29,-0.03-i*0.03, 0.008, 1.4,0.6,1);
    blob(g, fb, 0,0.28,0.04, 0.038); blob(g, fr, 0,0.285,0.065, 0.02, 1.3,0.5,0.6); blob(g, fb, 0,0.28,0.09, 0.026); eyes(g, 0.02,0.285,0.1, 0.012, 0x1a1410);
    wingSet(g, wings, 0.3, 0.05, [[[[0.04,-0.02],[0.16,-0.02,0.2,-0.12,0.14,-0.16],[0.04,-0.12]], paintW(id+'h',{ c:d.c2, c2:0x1a2a4a }), { rz:-0.35, ry:0.55, y:-0.003 }], [[[0.06,0.07,0.22,0.09,0.27,0.04],[0.25,-0.05,0.12,-0.06],[0.03,-0.03]], paintW(id,d), { rz:-0.38, ry:0.7 }]], 0.015);
    antennae(g, fuzzMat(0xf0ece0), [0,0.3,0.1], 0.08, 'feather', 0.7, 0.0022); sixLegs(g, fb, 0.25, 0.07, 0.03, 0.09, 0.005); },
  // a bug with a long upturned nose that glows like a lantern
  lanternfly(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.45 }); segs(g, bm, [[0,0.12,0.04],[0,0.12,-0.06],[0,0.115,-0.14]], t=>0.028*sin(PI*clamp(t*0.85+0.15,0,1))**0.6+0.006, 12, 5);
    blob(g, bm, 0,0.13,0.07, 0.028, 1,0.9,1.1); eyes(g, 0.022,0.135,0.09, 0.01, 0x3a1a1a); const nose=bend(g, shellMat(d.c2,{ roughness:0.35 }), [[0,0.135,0.09],[0,0.17,0.16],[0,0.25,0.21],[0,0.3,0.22]], t=>0.018*(1-t*0.25)+0.006, 12, 16);
    blob(g, glowM(0xfff0a0,2.0), 0,0.31,0.22, 0.026, 1,1.15,1); for (let i=0;i<10;i++){ const p=nose[2+i]; blob(g, ceramic(0xf8f4e0), (i%2?1:-1)*0.016, p.y, p.z, 0.004); }
    const wm=paintW(id,d); wingSet(g, wings, 0.15, 0.05, [[[[0.05,0.03,0.18,0.03,0.26,-0.02],[0.18,-0.07,0.04,-0.05]], wm, { rz:-0.55, ry:1.0 }], [[[0.04,-0.01],[0.16,-0.02,0.2,-0.08,0.12,-0.12],[0.03,-0.06]], wm, { rz:-0.6, ry:0.7, y:-0.004 }]], 0.015);
    sixLegs(g, dark, 0.1, 0.08, 0.04, 0.09, 0.0045); },
  // a humpbacked cave cricket on enormous legs, feeling its way with antennae longer than everything
  cavecricket(g,d,id,{dark}){ const bm=shellMat(d.c,{ roughness:0.35 }); const b=welded(sph(0.05,32,20)); displace(b,v=>{ v.z*=1.6; if (v.y>0) v.y*=1.3+0.3*cos(v.z*20); }); painted(g, b, (v,n,o)=>{ o.set(d.c); if (Math.abs(sin(v.z*120))>0.92) o.offsetHSL(0,0,-0.12); if (n.y<-0.3) o.set(d.c2); }, 0,0.12,-0.02, { roughness:0.35 });
    const hd=blob(g, bm, 0,0.1,0.07, 0.03, 0.9,1.1,0.9); eyes(g, 0.022,0.12,0.08, 0.006); pairs(k=>bend(g, shellMat(d.c2), [[k*0.01,0.12,0.09],[k*0.12,0.28,0.25],[k*0.3,0.3,0.4],[k*0.45,0.2,0.4]], t=>0.0016, 3, 40));
    pairs(k=>bend(g, shellMat(d.c2), [[k*0.006,0.085,0.09],[k*0.01,0.06,0.11],[k*0.012,0.04,0.12]], ()=>0.003, 3, 6)); legs2(g, bm, [0.025,0.1,-0.06],[0.09,0.3,-0.14],[0.12,0.12,-0.3],[0.13,0.004,-0.36], 0.009);
    legs2(g, bm, [0.025,0.1,0.04],[0.1,0.16,0.12],[0.16,0.06,0.18],[0.18,0.004,0.2], 0.004); legs2(g, bm, [0.025,0.1,0.0],[0.11,0.17,-0.02],[0.18,0.06,-0.04],[0.2,0.004,-0.05], 0.004); },
  // two pincers held out front and a stinger tail curled up over its back
  scorpion(g,d,id){ const sh=shellMat(d.c,{ roughness:0.3 }), lt=shellMat(d.c2,{ roughness:0.35 }); const b=welded(sph(0.06,32,18)); displace(b,v=>{ v.z*=1.8; v.y*=0.4; }); mesh(b, sh, 0,0.05,0.0, g);
    for (let i=0;i<6;i++) mesh(tube(curve([[-0.055,0.06,0.07-i*0.025],[0,0.075,0.07-i*0.025],[0.055,0.06,0.07-i*0.025]],8),()=>0.002,3), lt, 0,0,0, g, false);
    const tail=curve([[0,0.06,-0.1],[0,0.1,-0.18],[0,0.2,-0.2],[0,0.27,-0.13],[0,0.27,-0.05]],6); for (let i=0;i<5;i++) blob(g, i%2?sh:lt, tail[i].x,tail[i].y,tail[i].z, 0.02-i*0.001, 1,1,1.3).lookAt(tail[i+1]); blob(g, lt, 0,0.26,-0.03, 0.017, 1,1,1.3); spike(g, shellMat(0x3a1a10), [0,0.25,-0.015],[0,-1,0.6],0.04,0.006);
    pairs(k=>{ rod(g, sh, [k*0.03,0.05,0.09],[k*0.08,0.06,0.14], 0.01,0.009,8); rod(g, sh, [k*0.08,0.06,0.14],[k*0.07,0.06,0.2], 0.009,0.012,8); const cl=blob(g, lt, k*0.07,0.06,0.24, 0.026, 0.8,0.6,1.5); spike(g, sh, [k*0.06,0.06,0.27],[k*-0.2,0,1],0.04,0.006); spike(g, sh, [k*0.08,0.06,0.27],[k*0.1,0,1],0.045,0.007); });
    for (let i=0;i<4;i++) legs2(g, lt, [0.04,0.04,0.05-i*0.035],[0.1,0.09,0.05-i*0.05],[0.15,0.04,0.04-i*0.06],[0.17,0.004,0.04-i*0.07], 0.005); pairs(k=>blob(g, ceramic(0x0a0a0a), k*0.008,0.075,0.1, 0.006)); },
  // a giant beetle with three horns: two long ones from its shield and one from its head
  atlasbeetle(g,d,id,{dark}){ const sh=shellMat(d.c,{ metalness:0.55, roughness:0.15, clearcoat:1, iridescence:0.5 }); elytra(g, sh, 0.09,0.07,0.12, 0.1, -0.08, 0x0a0a0a);
    const pr=welded(sph(0.08,32,20)); displace(pr,v=>{ v.y*=0.7; v.z*=0.8; }); mesh(pr, sh, 0,0.12,0.07, g); blob(g, sh, 0,0.1,0.15, 0.03, 1,0.8,0.9); eyes(g, 0.03,0.1,0.165, 0.008);
    const hm=shellMat(d.c2,{ metalness:0.55, roughness:0.15, clearcoat:1 }); pairs(k=>bend(g, hm, [[k*0.045,0.16,0.09],[k*0.075,0.2,0.19],[k*0.06,0.25,0.3],[k*0.025,0.29,0.36]], t=>0.02*(1-t*0.85)+0.002, 8, 16)); bend(g, hm, [[0,0.1,0.17],[0,0.14,0.25],[0,0.24,0.29],[0,0.31,0.25]], t=>0.018*(1-t*0.8)+0.002, 8, 16);
    sixLegs(g, dark, 0.08, 0.1, 0.07, 0.12, 0.008, { spines:[3,3,3], high:0.6 }); },
  // ---------- Starfall ----------
  // a moth whose wings are split into glowing feathers
  plumemoth(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.5 }); segs(g, bm, [[0,0.28,0.04],[0,0.28,-0.08],[0,0.275,-0.2]], t=>0.012*(1-t*0.5)+0.003, 8, 6); blob(g, bm, 0,0.285,0.06, 0.018, 1,1,1.3); blob(g, bm, 0,0.29,0.09, 0.013); eyes(g, 0.01,0.292,0.098, 0.007, 0x3a4a8a);
    const plume=glowM(d.c2, 0.9), tips=glowM(0xfff4c0, 2); const mk=(p, ang, L)=>{ const pts=curve([[0,0,0],[cos(ang)*L*0.5, 0, -sin(ang)*L*0.5],[cos(ang)*L, 0.01, -sin(ang)*L]],10); mesh(tube(pts,t=>0.0018,3), plume, 0,0,0, p, false); for (let i=2;i<10;i++){ const q=pts[i]; for (const s of [1,-1]) mesh(tube([q, q.clone().add(V3(-sin(ang)*s*0.016, 0, -cos(ang)*s*0.016))],()=>0.0008,3,{ caps:false }), plume, 0,0,0, p, false); } blob(p, tips, pts[9].x,pts[9].y,pts[9].z, 0.005); };
    for (const s of [1,-1]){ const p=grp(g, s*0.01,0.295,0.05); p.scale.x=s; p.userData.side=s; wings.push(p); mk(p, 0.15, 0.2); mk(p, 0.32, 0.18); mk(p, 0.75, 0.16); mk(p, 1.0, 0.15); mk(p, 1.25, 0.14); }
    antennae(g, dark, [0,0.3,0.1], 0.1, 'whip', 0.6, 0.0012); for (let i=0;i<3;i++) legs2(g, bm, [0.01,0.27,0.06-i*0.02],[0.05,0.3,0.06-i*0.04],[0.09,0.2,0.06-i*0.06],[0.1,0.12,0.06-i*0.07], 0.002); },
  // midnight wings with gold stars, and hind tails like ribbons that trail and drift
  ribbonmoth(g,d,id,{wings,dark}){ butterBody(g, Object.assign({}, d, { c2:d.c }), dark, 0.16, 0.024, true); const wm=paintW(id,d); const rib=glowM(d.c2, 1.2); const ribs=[];
    wingSet(g, wings, 0.31, 0.05, [[[[0.06,0.12,0.26,0.2,0.36,0.12],[0.32,0.0,0.2,-0.05],[0.1,-0.04,0.02,-0.01]], wm, { rz:0.18 }], [[[0.04,-0.02],[0.22,-0.02,0.24,-0.12,0.16,-0.16],[0.06,-0.14,0.02,-0.06]], wm, { rz:0.16 }]]);
    for (const w of wings){ const R=keep(g, grp(w, 0.13,0.003,-0.14)); ribs.push(R); const pts=curve([[0,0,0],[0.02,-0.01,-0.15],[-0.02,-0.03,-0.3],[0.01,-0.05,-0.45]],24); ribbonFin(R, rib, pts, t=>0.022*(1-t*0.5), 1); blob(R, glowM(0xfff4c0,2), pts[23].x,pts[23].y+0.01,pts[23].z, 0.008); }
    antennae(g, fuzzMat(d.c2), [0,0.32,0.11], 0.09, 'feather', 0.7, 0.0025); g.userData.idle=t=>ribs.forEach((R,i)=>{ R.rotation.x=sin(t*1.4+i)*0.2; R.rotation.y=sin(t*1.1+i*2)*0.15; }); },
  // ---------- trip islands ----------
  // a flat green shield with a gold-edged triangle on its back
  shieldbug(g,d,id,{dark}){ const s=new THREE.Shape(); s.moveTo(0,0.09); s.lineTo(0.06,0.07); s.lineTo(0.075,0.03); s.bezierCurveTo(0.07,-0.04,0.03,-0.1,0,-0.11); s.bezierCurveTo(-0.03,-0.1,-0.07,-0.04,-0.075,0.03); s.lineTo(-0.06,0.07); s.lineTo(0,0.09);
    const sg=new THREE.ExtrudeGeometry(s,{ depth:0.02, bevelEnabled:true, bevelThickness:0.012, bevelSize:0.006, bevelSegments:4, curveSegments:16 }); sg.rotateX(-PI/2); displace(sg,v=>{ v.y+=0.02*(1-(v.x/0.08)**2); });
    painted(g, sg, (v,n,o)=>{ o.set(d.c); const tri=v.z<0.04 && v.z>-0.07 && Math.abs(v.x)<(v.z+0.07)*0.38; if (tri && n.y>0.3) o.offsetHSL(0,0.05,0.08); if (tri && Math.abs(Math.abs(v.x)-(v.z+0.07)*0.38)<0.004) o.set(d.c2); if (Math.abs(v.x)>0.068 || v.z<-0.1) o.set(d.c2); }, 0,0.06,0, { roughness:0.35 });
    blob(g, shellMat(d.c), 0,0.07,0.1, 0.022, 1.2,0.6,0.9); eyes(g, 0.022,0.075,0.1, 0.006, 0x6a2a1a); antennae(g, dark, [0,0.075,0.12], 0.06, 'elbow', 0.7, 0.002); sixLegs(g, shellMat(d.c), 0.05, 0.05, 0.045, 0.09, 0.004); },
  // a round fuzzball with a long straight tongue and dark-edged wings held wide
  beefly(g,d,id,{wings,dark}){ const fz=fuzzMat(d.c); blob(g, fz, 0,0.28,-0.01, 0.055, 1,0.95,1.05); for (let i=0;i<50;i++){ const a=i*2.4, e=Math.acos(1-2*(i+0.5)/50); spike(g, fz, [sin(e)*cos(a)*0.055,0.28+cos(e)*0.05,-0.01+sin(e)*sin(a)*0.058],[sin(e)*cos(a),cos(e),sin(e)*sin(a)],0.018,0.004); }
    blob(g, fuzzMat(shade(d.c,-0.2)), 0,0.29,0.055, 0.022); eyes(g, 0.016,0.295,0.065, 0.011); rod(g, dark, [0,0.285,0.075],[0,0.27,0.2], 0.0022,0.0015,4);
    wingSet(g, wings, 0.31, 0.02, [[[[0.05,0.03,0.16,0.04,0.2,0.0],[0.15,-0.04,0.04,-0.03]], paintW(id,d,{ depthWrite:false, alphaTest:0.01 }), { rz:0.08, ry:-0.25 }]], 0.02);
    for (let i=0;i<3;i++) legs2(g, dark, [0.02,0.25,0.03-i*0.02],[0.06,0.22,0.06-i*0.06],[0.08,0.14,0.06-i*0.08],[0.09,0.09,0.06-i*0.09], 0.002); },
  // a little red beetle at the end of a very long neck
  giraffeweevil(g,d,id,{dark}){ elytra(g, shellMat(d.c2,{ clearcoat:1, roughness:0.2 }), 0.045,0.04,0.06, 0.08, -0.04); blob(g, shellMat(d.c), 0,0.085,0.03, 0.028, 1,0.85,1.1);
    const nk=bend(g, shellMat(d.c), [[0,0.09,0.05],[0,0.15,0.12],[0,0.21,0.16],[0,0.24,0.22]], t=>0.009*(1-t*0.3), 8, 16); blob(g, shellMat(d.c), 0,0.245,0.235, 0.014, 1,0.9,1.4); eyes(g, 0.011,0.25,0.235, 0.005);
    pairs(k=>bend(g, dark, [[k*0.006,0.25,0.245],[k*0.03,0.27,0.26],[k*0.04,0.28,0.25]], ()=>0.0018, 3, 6)); sixLegs(g, dark, 0.06, 0.04, 0.04, 0.09, 0.004); },
  // a long beak, spotted wings and a tail curled up like a scorpion's (it can't sting)
  scorpionfly(g,d,id,{wings,dark}){ const bm=shellMat(d.c,{ roughness:0.45 }); const tl=curve([[0,0.26,0.03],[0,0.26,-0.06],[0,0.27,-0.13],[0,0.32,-0.17],[0,0.36,-0.12]],24);
    mesh(tube(tl, t=>0.016*(1-t*0.5)+0.004, 10, { ring:(t)=>1-0.1*Math.max(0,sin(t*PI*14))**3 }), bm, 0,0,0, g); blob(g, shellMat(shade(d.c,-0.2)), 0,0.365,-0.105, 0.016, 1,1,1.2);
    blob(g, shellMat(d.c2), 0,0.275,0.05, 0.022, 1,1,1.2); blob(g, bm, 0,0.28,0.085, 0.016); rod(g, bm, [0,0.275,0.09],[0,0.23,0.13], 0.009,0.004,6); eyes(g, 0.014,0.285,0.09, 0.009);
    wingSet(g, wings, 0.29, 0.04, [[[[0.04,0.025,0.16,0.03,0.22,0.0],[0.15,-0.035,0.04,-0.025]], paintW(id,d,{ depthWrite:false, alphaTest:0.01 }), { ry:0.5, rz:0.15 }], [[[0.04,0.02,0.15,0.025,0.2,0.0],[0.14,-0.03,0.04,-0.02]], paintW(id,d,{ depthWrite:false, alphaTest:0.01 }), { ry:0.75, rz:0.12, y:-0.004 }]], 0.01);
    antennae(g, dark, [0,0.29,0.1], 0.12, 'whip', 0.5, 0.0015); for (let i=0;i<3;i++) legs2(g, shellMat(d.c2), [0.01,0.26,0.06-i*0.02],[0.06,0.29,0.06-i*0.04],[0.1,0.16,0.06-i*0.07],[0.12,0.004,0.06-i*0.09], 0.0025); },
  // a segmented larva with a tail that glows green-gold in the dark
  glowworm(g,d,id){ const pts=curve([[0,0.035,0.12],[0.02,0.035,0.04],[-0.015,0.035,-0.05],[0,0.035,-0.13]],40); const geo=tube(pts, t=>0.028*(1-Math.abs(t-0.4)*0.6)+0.006, 12, { squash:0.75, ring:t=>1-0.14*Math.max(0,sin(t*PI*12))**3 });
    setColors(geo,(v,n,o,i)=>{ const t=Math.floor(i/13)/39; o.set(d.c); if (t>0.72) o.set(d.c2); else if (n.y>0.4 && (t*12)%1<0.25) o.offsetHSL(0,0,0.1); }); mesh(geo, vcPhys({ roughness:0.4, emissive:0x000000 }), 0,0,0, g);
    for (let i=0;i<3;i++){ const p=pts[30+i*3]; blob(g, glowM(d.c2, 2.4), p.x,p.y-0.006,p.z, 0.022, 1,0.6,0.8); } blob(g, shellMat(d.c), pts[0].x,pts[0].y,pts[0].z+0.01, 0.015, 1,0.8,1);
    for (let i=0;i<3;i++) legs2(g, shellMat(d.c), [0.015,0.025,0.09-i*0.02],[0.03,0.025,0.1-i*0.02],[0.035,0.012,0.1-i*0.02],[0.04,0.004,0.1-i*0.02], 0.0025); },
  // a pale crawler from the ice: see-through body, long feelers in front and long tails behind
  icecrawler(g,d,id){ const gm=glassy(d.c,0.75); const pts=curve([[0,0.05,0.12],[0,0.05,0.0],[0,0.05,-0.12]],24); const b=mesh(tube(pts, t=>0.022*(1-Math.abs(t-0.45)*0.8)+0.006, 12, { squash:0.65, ring:t=>1-0.1*Math.max(0,sin(t*PI*11))**3 }), gm, 0,0,0, g); b.renderOrder=2;
    mesh(tube(pts.slice(2,-2), ()=>0.006, 6), ceramic(d.c2), 0,0,0, g, false); blob(g, gm, 0,0.05,0.13, 0.018, 1,0.75,1.2); pairs(k=>blob(g, ceramic(0x1a1a24), k*0.01,0.056,0.135, 0.004));
    pairs(k=>{ bend(g, ceramic(d.c), [[k*0.006,0.055,0.145],[k*0.04,0.08,0.22],[k*0.08,0.06,0.3]], ()=>0.0016, 3, 16); bend(g, ceramic(d.c), [[k*0.005,0.05,-0.12],[k*0.03,0.06,-0.2],[k*0.05,0.06,-0.28]], ()=>0.0018, 3, 12); });
    for (let i=0;i<3;i++) legs2(g, gm, [0.015,0.045,0.07-i*0.04],[0.06,0.08,0.08-i*0.05],[0.1,0.03,0.08-i*0.06],[0.11,0.004,0.08-i*0.07], 0.004); },
  // the biggest moth: rust wings with clear windows, and forewing tips shaped like snake heads
  atlasmoth(g,d,id,{wings,dark}){ butterBody(g, Object.assign({}, d, { c2:d.c }), dark, 0.16, 0.03, true); const wm=paintW(id,d);
    wingSet(g, wings, 0.31, 0.05, [[[[0.08,0.14,0.3,0.24,0.44,0.24],[0.5,0.26,0.54,0.2,0.5,0.15],[0.46,0.12],[0.42,0.04,0.34,-0.04],[0.14,-0.06,0.02,-0.01]], wm, { rz:0.16 }], [[[0.05,-0.03],[0.34,-0.04,0.38,-0.2,0.28,-0.3],[0.12,-0.3,0.03,-0.13]], wm, { rz:0.14 }]]);
    antennae(g, fuzzMat(0xc8a070), [0,0.32,0.11], 0.08, 'feather', 0.7, 0.003); },
  // golden hindwings under long black forewings: the jewel of the castaway forest
  birdwing(g,d,id,{wings,dark}){ butterBody(g, { c:d.c, c2:0xd8302a }, dark, 0.2, 0.03); const fw=paintW(id,d), hw=paintW(id+'h',{ c:d.c2, c2:d.c });
    wingSet(g, wings, 0.31, 0.05, [[[[0.08,0.1,0.36,0.18,0.52,0.12],[0.5,0.04,0.36,-0.02],[0.14,-0.04,0.02,-0.01]], fw, { rz:0.2 }], [[[0.05,-0.02],[0.3,-0.02,0.34,-0.16,0.24,-0.24],[0.1,-0.24,0.03,-0.1]], hw, { rz:0.18, y:-0.003 }]]);
    antennae(g, dark, [0,0.32,0.11], 0.15, 'club', 0.5, 0.003); sixLegs(g, dark, 0.28, 0.08, 0.03, 0.11, 0.004); },
};
export { BUGS };

// build the species inside a group scaled by model.l, then merge everything that doesn't move into a few draw calls
function inner(g, d){ const o=new THREE.Group(); o.scale.setScalar(d.l||1); g.add(o); return o; }
function relay(g, o){ for (const k of ['tail','wings','keep','idle','bottom']) if (o.userData[k]!==undefined) g.userData[k]=o.userData[k]; }
export function buildFishInto(g, d, id){ const skin=fishSkin(id, d), fin=finMaterial(d.c, d.c2, id), fn=FISH[id], o=inner(g, d);
  if (fn) fn(o, d, id, { skin, fin }); else blob(o, skin, 0,0.22,0, 0.15, 1.6,0.8,0.5);
  relay(g, o); const K=[g.userData.tail, ...(g.userData.keep||[])].filter(Boolean); mergeStatic(g, new Set(K)); for (const k of K) mergeStatic(k, new Set()); }
export function buildBugInto(g, d, id){ const wings=[], fn=BUGS[id], o=inner(g, d);
  if (fn) fn(o, d, id, { wings, dark:shellMat(0x2a2420,{ roughness:0.35 }) }); else blob(o, shellMat(d.c), 0,0.15,0, 0.12, 1,0.6,1.4);
  o.userData.wings=wings; relay(g, o); const K=[...wings, ...(g.userData.keep||[])]; mergeStatic(g, new Set(K)); for (const k of K) mergeStatic(k, new Set(K.filter(q=>q!==k))); }
export const FISH_IDS = Object.keys(FISH), BUG_IDS = Object.keys(BUGS);
