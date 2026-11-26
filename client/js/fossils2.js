// v1.63 wave 2 fossils: 69 new finds, each with its own model.
// Same contract as buildFossilInto in critters.js: the find sits on (or is pressed into) a small stone, about 0.8 wide, top near y=0.1.
// Every builder is called once; models.js keeps the result as a template and hands out clones that share geometry.
import * as THREE from 'three';
import { TAU, hashStr } from './util.js';
import { V3, mesh, vcMat, vcPhys, col, n3, fbm, clamp, smooth, setColors, displace, welded, tube, curve, mergeStatic } from './critters.js';

/* ================= helpers ================= */
const _h=(x,y,z,s)=>{ let h=(x*374761393+y*668265263+z*1442695041+s*144665)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
const _c=new THREE.Color(), _d=new THREE.Color();
const TOP=0.1;

// distance from 0,0 to a polygon's edge along each direction (the polygon must be star shaped around 0,0)
function polyR(poly){ const N=512, T=new Float32Array(N);
  for (let i=0;i<N;i++){ const a=i/N*TAU, dx=Math.cos(a), dz=Math.sin(a); let best=1e9;
    for (let j=0;j<poly.length;j++){ const [ax,az]=poly[j], [bx,bz]=poly[(j+1)%poly.length], ex=bx-ax, ez=bz-az, den=dx*ez-dz*ex; if (Math.abs(den)<1e-12) continue;
      const t=(ax*ez-az*ex)/den, u=(ax*dz-az*dx)/den; if (t>0 && u>=-1e-6 && u<=1+1e-6) best=Math.min(best,t); }
    T[i]=best; }
  return a=>{ const f=(((a/TAU)%1)+1)%1*N, i=Math.floor(f)%N, k=f-Math.floor(f); return T[i]*(1-k)+T[(i+1)%N]*k; }; }
// stone slab (lighter copy of the one in critters.js: fewer segments so 80 of them build quickly)
function stone(parent, W, D, h, seed, relief=null, tint=0xd7c6a2, seg=60, shape=null){
  const segX=seg, segZ=Math.max(8,Math.round(seg*D/W)), g=new THREE.PlaneGeometry(W, D, segX, segZ); g.rotateX(-Math.PI/2);
  const base=col(tint), dark=base.clone().offsetHSL(0.01,0.05,-0.2), light=base.clone().offsetHSL(0,-0.03,0.07), fos=new THREE.Color();
  const pr=shape&&shape.poly? polyR(shape.poly) : null, flat=!!pr;   // v1.63: a polygon outline gives a cut, flat-topped tablet
  const edge=pr? (x,z)=>Math.hypot(x,z)/pr(Math.atan2(z,x)) : (x,z)=>{ const a=Math.atan2(z/D,x/W), wob=1+fbm(Math.cos(a)*1.6,Math.sin(a)*1.6,seed,seed)*0.18; return Math.hypot(x/(W/2),z/(D/2))/wob; };
  const p=g.attributes.position, cArr=new Float32Array(p.count*3), c=new THREE.Color();
  for (let i=0;i<p.count;i++){ let x=p.getX(i), z=p.getZ(i), e=edge(x,z);
    if (e>1){ x/=e; z/=e; p.setX(i,x); p.setZ(i,z); e=1; }
    const dome=flat? Math.sqrt(Math.max(0,1-e**24)) : Math.sqrt(Math.max(0,1-e**3)), rimDrop=flat? Math.pow(Math.max(0,1-e**24),0.25) : Math.pow(Math.max(0,1-e**6),0.35);
    const rock=fbm(x*4,z*4,seed,seed)*0.025 + fbm(x*14,z*14,seed+3,seed)*0.006;
    let y=flat? h*rimDrop+rock*0.4*dome : h*rimDrop*(0.55+0.45*dome)+rock*dome;
    const strata=(Math.sin((y*38+fbm(x*2,z*2,seed,7)*3))*0.5+0.5)*dome;
    c.copy(base).lerp(dark, (1-dome)*0.55+Math.max(0,-rock*14)*0.3).lerp(light, strata*0.2*dome);
    const spk=_h(Math.floor(x*180),Math.floor(z*180),seed,2); if (spk>0.93) c.offsetHSL(0,0,-0.08); else if (spk<0.04) c.offsetHSL(0,0,0.06);
    if (relief && e<0.95){ const r=relief(x,z); if (r){ y+=r.h*dome; if (r.c!==undefined){ fos.set(r.c); c.lerp(fos, (r.m??0.85)*Math.min(1,dome*1.4)); } if (r.shade) c.offsetHSL(0,0,r.shade); } }
    p.setY(i, y); cArr[i*3]=c.r; cArr[i*3+1]=c.g; cArr[i*3+2]=c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cArr,3)); g.computeVertexNormals();
  return mesh(g, vcMat({ roughness:0.93 }), 0,0,0, parent); }
const base=(g,seed,tint=0xd3c3a0,W=0.78,D=0.6,h=0.1)=>stone(g,W,D,h,seed,null,tint,40);

// relief kit: capsules, ellipses and rings in the stone's x,z plane; eval returns the strongest one
function kit(defC=0x5a4632){ const P=[]; let tr=null;
  const T=(x,z)=>{ if(!tr) return [x,z]; const c=Math.cos(tr.r), s=Math.sin(tr.r); return [tr.x+(x*c-z*s)*tr.k, tr.z+(x*s+z*c)*tr.k]; };
  const K={
    at(x,z,r=0,k=1){ tr={x,z,r,k}; return K; }, reset(){ tr=null; return K; },
    cap(ax,az,bx,bz,r0,h=0.012,c,r1=r0,o={}){ [ax,az]=T(ax,az); [bx,bz]=T(bx,bz); const k=tr?tr.k:1; r0*=k; r1*=k; const R=Math.max(r0,r1);
      P.push({ t:0, ax,az,bx,bz,r0,r1,h,c, flat:o.flat, band:o.band, x0:Math.min(ax,bx)-R, x1:Math.max(ax,bx)+R, z0:Math.min(az,bz)-R, z1:Math.max(az,bz)+R }); return K; },
    line(pts,r0,r1,h,c,o={}){ for (let i=0;i<pts.length-1;i++){ const t0=i/(pts.length-1), t1=(i+1)/(pts.length-1); K.cap(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1], r0+(r1-r0)*t0, h, c, r0+(r1-r0)*t1, o); } return K; },
    ell(cx,cz,rx,rz,rot=0,h=0.012,c,o={}){ [cx,cz]=T(cx,cz); const k=tr?tr.k:1; rx*=k; rz*=k; rot+=tr?tr.r:0; const R=Math.max(rx,rz);
      P.push({ t:1, cx,cz,rx,rz,co:Math.cos(rot),si:Math.sin(rot),h,c, ring:o.ring, flat:o.flat, x0:cx-R,x1:cx+R,z0:cz-R,z1:cz+R }); return K; },
    eval(x,z){ let best=0, bc, bs=0;
      for (const p of P){ if (x<p.x0||x>p.x1||z<p.z0||z>p.z1) continue; let v=0;
        if (p.t===0){ const dx=p.bx-p.ax, dz=p.bz-p.az, l2=dx*dx+dz*dz||1e-9, u=clamp(((x-p.ax)*dx+(z-p.az)*dz)/l2,0,1), d=Math.hypot(x-p.ax-dx*u, z-p.az-dz*u), r=p.r0+(p.r1-p.r0)*u;
          if (d<r){ const q=d/r; v=p.h*(p.flat?1-q**6:Math.sqrt(1-q*q)); if (p.band && Math.sin(u*p.band)>0.55) v*=0.6; } }
        else { const lx=(x-p.cx)*p.co+(z-p.cz)*p.si, lz=-(x-p.cx)*p.si+(z-p.cz)*p.co, e=Math.hypot(lx/p.rx, lz/p.rz);
          if (p.ring){ const w=p.ring, d=Math.abs(e-1+w); if (d<w) v=p.h*Math.sqrt(1-(d/w)**2); }
          else if (e<1) v=p.h*(p.flat?1-e**8:Math.sqrt(1-e*e)); }
        if (Math.abs(v)>Math.abs(best)){ best=v; bc=p.c; } }
      return best? { h:best, c:bc??defC, m:0.9, shade:best<0?-0.05:0 } : null; } };
  return K; }
// a smooth curve in the x,z plane as [[x,z],...]
const path2=(ctrl,n=24)=>curve(ctrl.map(([x,z])=>[x,0,z]),n).map(v=>[v.x,v.z]);

// loft: rings in the y,z plane along x. f(t)->{x,y,z,w,h,p,top,bot}; mod(t,a) scales the ring per angle
function loft(n, f, seg=24, mod=null, caps=true){
  const pos=[], idx=[];
  for (let i=0;i<=n;i++){ const t=i/n, r=f(t), p=r.p||2;
    for (let k=0;k<=seg;k++){ const a=k/seg*TAU, c=Math.cos(a), s=Math.sin(a), cx=Math.sign(c)*Math.pow(Math.abs(c),2/p), sy=Math.sign(s)*Math.pow(Math.abs(s),2/p), m=mod?mod(t,a):1;
      pos.push(r.x, (r.y||0)+r.h*(s>0?(r.top??1):(r.bot??1))*sy*m, (r.z||0)+r.w*cx*m); } }
  for (let i=0;i<n;i++) for (let k=0;k<seg;k++){ const a=i*(seg+1)+k, b=a+seg+1; idx.push(a,b,a+1, a+1,b,b+1); }
  if (caps) for (const [i,start] of [[0,true],[n,false]]){ const r=f(i/n), c=pos.length/3; pos.push(r.x, r.y||0, r.z||0);
    for (let k=0;k<seg;k++){ const a=i*(seg+1)+k; if (start) idx.push(c,a,a+1); else idx.push(c,a+1,a); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
// parametric sheet f(u,v)->[x,y,z]; closedV wraps v
function surf(nu, nv, f){ const pos=[], idx=[];
  for (let i=0;i<=nu;i++) for (let j=0;j<=nv;j++) pos.push(...f(i/nu, j/nv));
  for (let i=0;i<nu;i++) for (let j=0;j<nv;j++){ const a=i*(nv+1)+j, b=a+nv+1; idx.push(a,b,a+1, a+1,b,b+1); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
// a shell coiled in the x,z plane (r grows by e^(k*angle)); dy drops per turn for snails
function coil(turns, k, r0, N, rf, seg=18, opts={}){ const pts=[]; for (let i=0;i<N;i++){ const t=i/(N-1), a=t*TAU*turns, r=r0*Math.exp(a*k); pts.push(V3(Math.cos(a)*r, -(opts.drop||0)*a/TAU*(opts.dropScale?r/r0:1), Math.sin(a)*r)); }
  return tube(pts, (t,i)=>rf(t, r0*Math.exp(t*TAU*turns*k)), seg, opts); }
// hex voronoi: distance to the nearest cell wall and the cell id, for plates, cells and armour
function hexCell(x,z,s,sx=1){ const H=s*1.5, Wd=s*Math.sqrt(3)*sx; const j0=Math.round(z/H), i0=Math.round(x/Wd); let d1=1e9, d2=1e9, id=0, cx=0, cz=0;
  for (let j=j0-1;j<=j0+1;j++) for (let i=i0-1;i<=i0+1;i++){ const px=i*Wd+((j&1)?Wd/2:0), pz=j*H, d=Math.hypot((x-px)/sx, z-pz); if (d<d1){ d2=d1; d1=d; id=i*131+j; cx=px; cz=pz; } else if (d<d2) d2=d; }
  return { wall:(d2-d1)/2, d:d1, id, cx, cz }; }
// shaded tone: base colour darkening into crevices and undersides, with fine speckle
function tone(b, d, s=7, amt=0.55, f=16){ return (v,n,o)=>{ o.set(b); const k=clamp(0.3-n.y*0.25+fbm(v.x*f,v.y*f,v.z*f,s)*0.9,0,1); o.lerp(_c.set(d), k*amt); o.offsetHSL(0,0,fbm(v.x*60,v.y*60,v.z*60,s+1)*0.035); }; }
const boneMat=()=>vcPhys({ roughness:0.62, clearcoat:0.22 });
const glossMat=()=>vcPhys({ roughness:0.25, clearcoat:0.9, clearcoatRoughness:0.1 });
const plainMat=(c,o={})=>new THREE.MeshPhysicalMaterial(Object.assign({ color:c, roughness:0.5, clearcoat:0.4 }, o));
// a bone shaft along x with swollen ends; lies at the origin
function boneGeo(len, r, endR, seg=16, flat=1){ return loft(18, t=>{ const e=Math.max(smooth(0.3,0,t),smooth(0.7,1,t)); const rr=r+(endR-r)*e*(0.6+0.4*Math.sin(Math.PI*Math.min(1,Math.abs(t-0.5)*2))); const cap=Math.sqrt(Math.max(0,1-((Math.abs(t-0.5)*2)**12)));
  return { x:-len/2+len*t, w:rr*cap, h:rr*flat*cap }; }, seg); }
function addBone(parent, mat, a, b, r, endR, colorFn, flat=1){ const A=V3(...a), B=V3(...b), len=A.distanceTo(B); const g=boneGeo(len, r, endR, 14, flat); setColors(g, colorFn);
  const m=mesh(g, mat, (A.x+B.x)/2, (A.y+B.y)/2, (A.z+B.z)/2, parent); m.quaternion.setFromUnitVectors(V3(1,0,0), B.clone().sub(A).normalize()); return m; }
// a curved cone (tooth, horn, claw, spine) from base point along a bend
function hornGeo(len, r, bend=0.3, seg=12, n=12, flat=1){ const pts=[]; for (let i=0;i<=n;i++){ const t=i/n; pts.push(V3(-bend*len*t*t, t*len, 0)); }
  return tube(pts, t=>r*Math.pow(1-t,0.9)+0.0012, seg, { squash:flat }); }
function addHorn(parent, mat, at, len, r, rot, colorFn, bend=0.3, flat=1){ const g=hornGeo(len,r,bend,10,10,flat); if (colorFn) setColors(g,colorFn); const m=mesh(g, mat, at[0],at[1],at[2], parent, false); m.rotation.set(rot[0],rot[1],rot[2]); return m; }
// skull helper: fenestra holes as ellipses in the x,y side view; returns 0..1 depth
const holeAt=(holes,x,y)=>{ let v=0; for (const [hx,hy,rx,ry] of holes){ const e=((x-hx)/rx)**2+((y-hy)/ry)**2; if (e<1) v=Math.max(v,1-e); } return v; };
function skullGeo(n, prof, holes, seg=32){ // prof(t)->{x,y,w,h,p,top,bot}; holes in x,y with side cut-ins
  const g=loft(n, prof, seg, (t,a)=>{ const r=prof(t), y=(r.y||0)+r.h*Math.sin(a); const side=Math.abs(Math.cos(a)); const d=holeAt(holes, r.x, y); return 1-d*smooth(0.35,0.8,side)*0.45; });
  return g; }
const holeTone=(holes, fn, dark=0x1e1610)=>(v,n,o)=>{ fn(v,n,o); const d=holeAt(holes, v.x, v.y); if (d>0.05) o.lerp(_c.set(dark), clamp(d*2.2,0,0.92)); };
function teethRow(parent, mat, pts, len, r, down=true, colorFn){ for (const [x,y,z,s=1] of pts){ addHorn(parent, mat, [x,y,z], len*s, r*s, [down?Math.PI:0, 0, 0], colorFn, 0.25); } }
// glassy amber material
const amberMat=(c=0xe89a2a,o=0.55)=>new THREE.MeshPhysicalMaterial({ color:c, roughness:0.06, transmission:0.5, thickness:0.3, transparent:true, opacity:o, clearcoat:1, emissive:0x5a2800, emissiveIntensity:0.3, ior:1.55, depthWrite:false });

/* ================= the 69 builders ================= */
const B={};

/* ---- shells and sea snails ---- */
B.nautilus=(g,seed)=>{ base(g,seed,0xd6c8a8);
  const N=150, turns=2.25, k=0.29, r0=0.0035, geo=coil(turns,k,r0,N,(t,r)=>r*0.78,22,{ squash:1.05, ring:(t,a)=>1+0.012*Math.sin(t*turns*30) });
  setColors(geo,(v,n,o,i)=>{ const t=Math.floor(i/23)/(N-1), a=Math.atan2(v.z,v.x); o.set(0xf3ead6).lerp(_c.set(0xdac7a4), clamp(-n.y,0,1)*0.4);
    const st=Math.sin(t*turns*16+Math.sin(t*40)*0.6+fbm(v.x*20,v.y*20,v.z*20,3)*1.4); if (t<0.96 && st>0.1) o.lerp(_c.set(0x8a4a20), smooth(0.1,0.6,st)*0.9*smooth(0.97,0.85,t)*smooth(0.3,0.5,t));
    if (t>0.93) o.lerp(_c.set(0xe8e4ee), 0.5); });
  const m=mesh(geo, vcPhys({ roughness:0.25, clearcoat:0.8, iridescence:0.25 }), 0.02, TOP+0.17, 0, g); m.rotation.set(Math.PI/2, 0, 0.3); m.rotation.order='ZXY'; };
B.orthocone=(g,seed)=>{ base(g,seed,0xb8ae9c,0.86,0.5);
  const mk=(L,R,x,z,ry,sd)=>{ const geo=loft(60, t=>({ x:-L/2+L*t, w:0.006+R*Math.pow(t,0.85), h:0.006+R*Math.pow(t,0.85) }), 20, (t,a)=>1+0.015*Math.sin(t*L*160));
    setColors(geo,(v,n,o)=>{ const t=(v.x+L/2)/L; o.set(0xa8825a).lerp(_c.set(0xe2c9a0), clamp(n.y*0.5+0.4,0,1)*0.5); const s=Math.abs(Math.sin(t*L*Math.PI/0.035)); if (s<0.12) o.lerp(_c.set(0x4a3220),0.7); if (t>0.55 && n.y>0.6 && Math.abs(v.z)<0.012) o.lerp(_c.set(0x6a4a30),0.5); o.offsetHSL(0,0,fbm(v.x*40,v.y*40,v.z*40,sd)*0.04); });
    const m=mesh(geo, vcPhys({ roughness:0.45, clearcoat:0.5 }), x, TOP+0.02+R*0.5, z, g); m.rotation.y=ry; };
  mk(0.62,0.055,0.0,-0.03,0.12,1); mk(0.34,0.03,-0.08,0.15,-0.35,2); };
B.belemnite=(g,seed)=>{ base(g,seed,0xcbbfa4);
  const mat=vcPhys({ roughness:0.18, clearcoat:1, clearcoatRoughness:0.05, transmission:0.15, thickness:0.2 });
  const one=(L,R,x,z,ry)=>{ const geo=loft(40, t=>{ const tip=Math.pow(Math.sin(Math.min(1,t*1.04)*Math.PI/2),0.55), back=smooth(0,0.06,t); return { x:-L/2+L*t, w:R*Math.min(back*0.6+0.4,1)*(1-t**6)**0.5*(t<0.95?1:tip), h:R*(1-t**6)**0.5 }; }, 20);
    setColors(geo,(v,n,o)=>{ const t=(v.x+L/2)/L; o.set(0xb8682a).lerp(_c.set(0xf0b870), clamp(n.y*0.6+0.3,0,1)*0.55); if (t<0.04 && Math.hypot(v.y,v.z)<R*0.5) o.set(0x3a2214); o.offsetHSL(0,0,Math.sin(Math.atan2(v.y,v.z)*30)*0.015); });
    const m=mesh(geo, mat, x, TOP+R*0.7, z, g); m.rotation.y=ry; };
  one(0.46,0.042,0.02,-0.05,0.25); one(0.3,0.03,-0.06,0.14,-0.5); one(0.16,0.026,0.2,0.12,1.2); };
B.hookammonite=(g,seed)=>{ base(g,seed,0xc9b996,0.86,0.62);
  const pts=[]; const cx=0.17, cz=-0.02; for (let i=0;i<40;i++){ const t=i/39, a=Math.PI*0.5+t*TAU*1.15, r=0.012+0.06*t; pts.push([cx+Math.cos(a)*r, cz+Math.sin(a)*r]); }
  const e=pts[pts.length-1]; const tail=path2([[e[0],e[1]],[e[0]-0.08,e[1]+0.005],[-0.18,0.02],[-0.28,0.07],[-0.27,0.17],[-0.17,0.19],[-0.09,0.16]],40);
  const all=pts.concat(tail.slice(1)).map(([x,z])=>V3(x,0,z));
  const geo=tube(all, t=>0.006+0.045*Math.pow(t,0.8), 18, { squash:0.85, ring:(t,a)=>1+0.07*Math.max(0,Math.sin(t*170))**2 });
  setColors(geo,(v,n,o,i)=>{ const t=Math.floor(i/19)/(all.length-1); o.set(0x9a6a3c).lerp(_c.set(0xe0bc8a), clamp(n.y*0.5+0.5,0,1)*0.6); if (Math.sin(t*170)>0.7) o.offsetHSL(0,0.04,0.05); o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,6)*0.05); });
  mesh(geo, vcPhys({ roughness:0.4, clearcoat:0.55, iridescence:0.3 }), 0, TOP+0.035, 0, g); };
B.brachiopod=(g,seed)=>{ base(g,seed,0xc4bba6);
  const one=(s,x,z,ry,sd)=>{ const geo=welded(new THREE.SphereGeometry(0.15,64,40)); displace(geo,v=>{ const bx=-0.15; const a=Math.atan2(v.z, v.x-bx);
      v.y*= v.y>0?0.55:0.78; v.z*=1.05; const rib=Math.pow(Math.abs(Math.cos(a*12)),3)*smooth(-0.12,0.05,v.x); const sul=Math.exp(-((v.z/0.05)**2))*smooth(-0.05,0.14,v.x);
      if (v.y>0) v.y+=0.012*rib-0.02*sul; else v.y-=0.012*rib-0.02*sul;
      if (v.x<-0.1){ const k=smooth(-0.1,-0.155,v.x); v.y+= k*0.05*(v.y<0?1.4:0.5); v.x+=k*0.03; } });
    setColors(geo,(v,n,o)=>{ const bx=-0.15, a=Math.atan2(v.z,v.x-bx), r=Math.hypot(v.x-bx,v.z); o.set(0xb5a68a).lerp(_c.set(0xe2d6bc), clamp(n.y*0.5+0.4,0,1)*0.5);
      if (Math.pow(Math.abs(Math.cos(a*12)),3)<0.08) o.offsetHSL(0,0,-0.08); if (Math.sin(r*120)>0.8) o.offsetHSL(0,0,-0.04);
      if (Math.abs(v.y-0.002*Math.sin(a*12*2))<0.004) o.lerp(_c.set(0x4a3e30),0.8); });
    const m=mesh(geo, vcPhys({ roughness:0.55, clearcoat:0.3 }), x, TOP+0.06*s, z, g); m.scale.setScalar(s); m.rotation.y=ry; };
  one(1,0.04,0,0.3,1); one(0.55,-0.22,0.14,-1.1,2); };
B.fossilscallop=(g,seed)=>{ base(g,seed,0xcdbd9c);
  const geo=surf(40,64,(u,v)=>{ const th=(v-0.5)*2.2, r=0.015+0.27*u; const ear=(u<0.25? smooth(0.25,0.0,u):0)*0.09*(Math.abs(th)>0.7?1:0);
    const rib=0.007*Math.pow(Math.abs(Math.cos(th*12)),1.5)*u; const y=0.07*(1-u*u)**0.6+rib+0.006*Math.sin(u*70)*u*0.5;
    return [Math.cos(th)*r - 0.12, y, Math.sin(th)*(r+ear)]; });
  setColors(geo,(v,n,o)=>{ const r=Math.hypot(v.x+0.12,v.z), a=Math.atan2(v.z,v.x+0.12); o.set(0xc8783a).lerp(_c.set(0xf0c890), clamp(n.y,0,1)*0.45); if (Math.sin(r*60)>0.6) o.offsetHSL(0.01,0.05,-0.08); if (Math.abs(Math.cos(a*12))<0.15) o.offsetHSL(0,0,-0.06); });
  const m=mesh(geo, vcPhys({ roughness:0.45, clearcoat:0.45, side:THREE.DoubleSide }), 0.03, TOP-0.005, 0, g); m.rotation.y=0.4; };
B.gryphaea=(g,seed)=>{ base(g,seed,0xb8b2a4);
  const pts=[]; for (let i=0;i<30;i++){ const t=i/29, a=-0.4+t*3.6, r=0.03+0.15*Math.pow(1-t,0.7); pts.push(V3(Math.cos(a)*r*0.9, Math.sin(a)*r, t*0.05)); }
  const geo=tube(pts, t=>0.11*Math.pow(1-t,0.65)+0.008, 24, { squash:0.62, ring:(t,a)=>1+0.05*Math.max(0,Math.sin(t*55+Math.sin(a*3)*0.5))**3 });
  setColors(geo,(v,n,o,i)=>{ const t=Math.floor(i/25)/29; o.set(0x8e887a).lerp(_c.set(0xd4ccba), clamp(n.y*0.5+0.4,0,1)*0.6); if (Math.sin(t*55)>0.85) o.offsetHSL(0,0,-0.1); o.offsetHSL(0,0.02,fbm(v.x*25,v.y*25,v.z*25,5)*0.07); });
  const m=mesh(geo, vcPhys({ roughness:0.7, clearcoat:0.15 }), -0.02, TOP+0.13, 0, g); m.rotation.set(0, 0.5, -0.2);
};
B.turritella=(g,seed)=>{ base(g,seed,0xd0c2a2);
  const one=(L,R,x,z,ry,rz)=>{ const turns=11, pitch=L/turns, prof=[]; for (let i=0;i<=120;i++){ const t=i/120; prof.push(new THREE.Vector2(Math.max(0.0015,R*(0.08+0.92*t)), L*(1-t))); }
    const geo=new THREE.LatheGeometry(prof, 64); const ph=v=>{ const a=Math.atan2(v.z,v.x)/TAU; const q=v.y/pitch+a; return q-Math.floor(q); };
    displace(geo,v=>{ const f=ph(v), r=Math.hypot(v.x,v.z); const k=1-0.22*Math.pow(1-Math.sin(Math.PI*f),3)+0.04*Math.max(0,Math.cos(f*TAU*3)); v.x*=k; v.z*=k; });
    setColors(geo,(v,n,o)=>{ const f=ph(v); o.set(0x9a6a3c).lerp(_c.set(0xead2a6), clamp(n.y*0.4+0.55,0,1)*0.6); if (Math.cos(f*TAU*3)>0.6) o.offsetHSL(0,0,0.05); if (f<0.06||f>0.94) o.lerp(_c.set(0x4a2e1a),0.6); });
    const m=mesh(geo, vcPhys({ roughness:0.35, clearcoat:0.6 }), x, TOP+R*0.7, z, g); m.rotation.set(0,ry,rz); };
  one(0.44,0.065,0.2,-0.02,0.2,Math.PI/2+0.08); one(0.22,0.035,-0.02,0.17,-0.8,Math.PI/2); };
B.moonsnail=(g,seed)=>{ base(g,seed,0xd2c4a6);
  const b=0.16, sut=v=>{ const r=Math.hypot(v.x,v.z)+1e-4, a=Math.atan2(v.z,v.x); const q=Math.log(r/0.006)/(b*TAU)-a/TAU; return q-Math.floor(q); };
  const geo=welded(new THREE.SphereGeometry(0.15,80,56)); displace(geo,v=>{ v.y*=0.9; if (v.y>0){ const r=Math.hypot(v.x,v.z), cap=smooth(0.09,0.0,r); v.y+=cap*0.035; const f=sut(v); v.y-=0.008*Math.pow(1-Math.sin(Math.PI*f),6)*smooth(0.12,0.04,r); }
    const ap=Math.hypot((v.x-0.06)/0.1,(v.y+0.04)/0.1); if (v.z>0.06 && ap<1) v.z-=0.05*Math.sqrt(1-ap*ap); });
  setColors(geo,(v,n,o)=>{ o.set(0xead8b6).lerp(_c.set(0xc09060), clamp(0.4-n.y*0.4,0,1)*0.5); if (v.y>0 && Math.hypot(v.x,v.z)<0.12 && (sut(v)<0.04||sut(v)>0.96)) o.lerp(_c.set(0x6a4a2a),0.7); if (v.y>0.05) o.offsetHSL(0.02,0.05,-0.04*Math.sin(Math.atan2(v.z,v.x)*3));
    const ap=Math.hypot((v.x-0.06)/0.1,(v.y+0.04)/0.1); if (v.z>0.04 && ap<1) o.lerp(_c.set(ap<0.8?0x5a3a26:0xf4ece0), 0.85); });
  const m=mesh(geo, vcPhys({ roughness:0.15, clearcoat:1, clearcoatRoughness:0.05 }), 0, TOP+0.1, 0, g); m.rotation.set(0.25,0.7,0.0); };
B.opalclam=(g,seed)=>{ base(g,seed,0xcfc3a8);
  const geo=welded(new THREE.SphereGeometry(0.17,72,44)); displace(geo,v=>{ v.y*=0.48; v.z*=0.78; const ux=-0.14; const d=Math.hypot(v.x-ux, v.y*1.4, v.z); v.multiplyScalar(1+0.01*Math.sin(d*90)); if (v.x<-0.1 && v.y>0) v.y+=smooth(-0.1,-0.16,v.x)*0.03; });
  setColors(geo,(v,n,o)=>{ const h=0.45+0.35*fbm(v.x*9,v.y*9,v.z*9,11)+0.1*Math.sin(v.x*40); o.setHSL(((h%1)+1)%1, 0.55, 0.6+0.15*fbm(v.x*20,v.y*20,v.z*20,4)); o.lerp(_c.set(0xf4f0ea), clamp(n.y,0,1)*0.25); if (Math.abs(v.y)<0.003) o.set(0x3a3448); });
  const m=mesh(geo, vcPhys({ roughness:0.12, clearcoat:1, clearcoatRoughness:0.05, iridescence:1, iridescenceIOR:1.6 }), 0.0, TOP+0.06, 0, g); m.rotation.y=-0.5; };

/* ---- sea life ---- */
B.blastoid=(g,seed)=>{ base(g,seed,0xc6b89a);
  const prof=[[0.001,0],[0.03,0.01],[0.06,0.05],[0.085,0.11],[0.08,0.16],[0.05,0.2],[0.02,0.215],[0.001,0.218]].map(([r,y])=>new THREE.Vector2(r,y));
  const geo=welded(new THREE.LatheGeometry(prof.length>2?new THREE.SplineCurve(prof).getPoints(40):prof, 60)); displace(geo,v=>{ const a=Math.atan2(v.z,v.x), up=v.y/0.218; const pet=Math.pow(Math.max(0,Math.cos(a*5)),6)*smooth(0.35,0.75,up); const r=Math.hypot(v.x,v.z); const k=1+0.08*pet+0.02*pet*Math.max(0,Math.sin(v.y*260))-0.03*(1-pet)*smooth(0.4,0.8,up); v.x*=k; v.z*=k; });
  setColors(geo,(v,n,o)=>{ const a=Math.atan2(v.z,v.x), up=v.y/0.218, pet=Math.pow(Math.max(0,Math.cos(a*5)),6)*smooth(0.35,0.75,up); o.set(0xc08a52).lerp(_c.set(0xe8c8a0), clamp(n.y,0,1)*0.4).lerp(_c.set(0x7a4e2a), pet*0.5); if (pet>0.3 && Math.sin(v.y*260)>0.4) o.offsetHSL(0,0,0.06); if (up>0.96) o.set(0x3a2418); });
  const m=mesh(geo, vcPhys({ roughness:0.5, clearcoat:0.35 }), 0.03, TOP-0.005, 0, g); m.rotation.set(0.25,0,-0.15); m.scale.setScalar(1.35);
  const st=vcPhys({ roughness:0.6 }); for (let i=0;i<5;i++){ const d=welded(new THREE.CylinderGeometry(0.018,0.018,0.014,16,1)); setColors(d,(v,n,o)=>{ o.set(0x9a7048); if (Math.abs(n.y)>0.8 && Math.sin(Math.atan2(v.z,v.x)*10)>0) o.offsetHSL(0,0,0.08); }); const s=mesh(d, st, -0.2+i*0.016, TOP+0.015, 0.1-i*0.004, g); s.rotation.z=Math.PI/2; } };
B.horncoral=(g,seed)=>{ base(g,seed,0xc2b49a);
  const one=(sc,x,z,ry,sd)=>{ const pts=curve([[-0.2,0,0],[-0.05,0.02,0],[0.07,0.08,0],[0.12,0.2,0]],30); const R=0.075;
    const geo=tube(pts, t=>0.004+R*Math.pow(t,0.9), 24, { ring:(t,a)=>1+0.035*Math.sin(t*70)+0.012*Math.cos(a*24), caps:false });
    setColors(geo,(v,n,o)=>{ o.set(0xa88458).lerp(_c.set(0xdcc29a), clamp(n.y*0.5+0.4,0,1)*0.5); o.offsetHSL(0,0,Math.sin((v.x+v.y)*220)*0.025+fbm(v.x*30,v.y*30,v.z*30,sd)*0.05); });
    const grp=new THREE.Group(); mesh(geo, vcPhys({ roughness:0.55, clearcoat:0.3, side:THREE.DoubleSide }), 0,0,0, grp);
    const cup=new THREE.CircleGeometry(R*0.98, 48, 0); const pc=cup.attributes.position; for (let i=0;i<pc.count;i++){ const r=Math.hypot(pc.getX(i),pc.getY(i)); pc.setZ(i, -0.035*(1-r/R)); } cup.computeVertexNormals();
    setColors(cup,(v,n,o)=>{ const a=Math.atan2(v.y,v.x), r=Math.hypot(v.x,v.y)/R; o.set(0x5a3a22).lerp(_c.set(0xc8a070), smooth(0.2,1,r)*0.5); if (Math.cos(a*24)>0.6 && r>0.15) o.set(0xd8bc90); });
    const e=pts[pts.length-1], d=pts[pts.length-1].clone().sub(pts[pts.length-2]).normalize(); const c=mesh(cup, vcPhys({ roughness:0.6, side:THREE.DoubleSide }), e.x,e.y,e.z, grp, false); c.lookAt(e.clone().add(d));
    grp.scale.setScalar(sc); grp.position.set(x,TOP+0.01,z); grp.rotation.y=ry; g.add(grp); };
  one(1,0.02,-0.02,0.3,1); one(0.6,-0.12,0.15,2.4,2); };
B.honeycomb=(g,seed)=>{ base(g,seed,0xbcb4a2,0.8,0.62,0.06);
  const geo=welded(new THREE.SphereGeometry(0.24,96,48,0,TAU,0,Math.PI*0.55)); const S=0.022;
  displace(geo,v=>{ v.y=v.y*0.62-0.02; const c=hexCell(v.x,v.z,S); const up=smooth(0.0,0.1,v.y); const r=Math.hypot(v.x,v.z);
    const k=1-0.012*smooth(0.0016,0.004,c.wall)*up/Math.max(0.1,v.length()/0.24); v.multiplyScalar(k); });
  setColors(geo,(v,n,o)=>{ const c=hexCell(v.x,v.z,S); const up=smooth(0.02,0.1,v.y); o.set(0xd8c8a6).lerp(_c.set(0x7a5a3a), smooth(0.002,0.006,c.wall)*up*0.85); if (up<0.5){ o.set(0xc8b48e); if (Math.sin(Math.atan2(v.z,v.x)*90)>0.3) o.offsetHSL(0,0,-0.08); } o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,2)*0.04); });
  mesh(geo, vcPhys({ roughness:0.7, clearcoat:0.15 }), 0, TOP-0.04, 0, g); };
B.vasesponge=(g,seed)=>{ base(g,seed,0xc8ba9c);
  const prof=[]; for (let i=0;i<=20;i++){ const t=i/20; prof.push(new THREE.Vector2(0.025+0.12*Math.pow(t,1.4), t*0.32)); } prof.push(new THREE.Vector2(0.135,0.322)); for (let i=20;i>=2;i--){ const t=i/20; prof.push(new THREE.Vector2(0.025+0.12*Math.pow(t,1.4)-0.016, t*0.32)); }
  const geo=new THREE.LatheGeometry(prof, 72); displace(geo,v=>{ const a=Math.atan2(v.z,v.x), k=1+0.04*Math.cos(a*14)*smooth(0.05,0.3,v.y)+fbm(v.x*12,v.y*12,v.z*12,5)*0.05; v.x*=k; v.z*=k; });
  setColors(geo,(v,n,o)=>{ const a=Math.atan2(v.z,v.x); o.set(0xd8b070).lerp(_c.set(0x8a6a3a), clamp(-n.y*0.5+0.2,0,1)*0.5); const pa=Math.floor(a*20), py=Math.floor(v.y*90); if (_h(pa,py,3,seed)>0.72 && Math.abs(Math.sin(a*20*Math.PI/Math.PI))>-1) o.lerp(_c.set(0x4a3420),0.6); if (Math.hypot(v.x,v.z)<0.11 && v.y>0.25 && n.y>0) o.offsetHSL(0,0,-0.12); });
  const m=mesh(geo, vcPhys({ roughness:0.8, side:THREE.DoubleSide }), 0.02, TOP-0.01, 0, g); m.rotation.z=-0.12; };
B.rolledtrilo=(g,seed)=>{ base(g,seed,0xb6ab96);
  const R=0.085, W=0.085, T=0.04;
  const geo=surf(90,40,(u,v)=>{ const ph=0.35+u*(TAU-0.5), a=v*TAU, end=Math.min(smooth(0,0.07,u),smooth(1,0.9,u)); const head=smooth(0.7,0.85,u);
    const seg=0.06*Math.max(0,Math.sin(u*60))*(1-head); const ax=0.014*Math.exp(-((Math.cos(a)*W/0.025)**2))*(Math.sin(a)>0?1:0);
    const th=T*(1+seg)*end*(1+head*0.4), wd=W*end*(1+head*0.15); const out=Math.sin(a)*th+ax; const rr=R+out;
    return [Math.cos(ph)*rr, Math.sin(ph)*rr, Math.cos(a)*wd]; });
  setColors(geo,(v,n,o)=>{ o.set(0x4a3a2c).lerp(_c.set(0x9a8066), clamp(n.y*0.4+0.4,0,1)*0.5); const ph=Math.atan2(v.y,v.x); if (Math.sin(((ph-0.35+TAU)%TAU)/(TAU-0.5)*60)>0.7) o.offsetHSL(0,0,0.06); if (Math.abs(Math.abs(v.z)-0.025)<0.004) o.offsetHSL(0,0,-0.06); });
  mesh(geo, vcPhys({ roughness:0.35, clearcoat:0.6 }), 0, TOP+R+0.02, 0, g).rotation.y=0.5;
  const eye=plainMat(0x2a2018,{ roughness:0.2, clearcoat:1 }); const ea=0.35+0.78*(TAU-0.5); for (const s of [1,-1]) mesh(new THREE.SphereGeometry(0.014,12,8), eye, Math.cos(ea)*(R+T*1.1)*Math.cos(0.5)+s*0.04*Math.sin(0.5), TOP+R+0.02+Math.sin(ea)*(R+T*1.1), -Math.cos(ea)*(R+T*1.1)*Math.sin(0.5)+s*0.04*Math.cos(0.5), g); };
B.spinytrilo=(g,seed)=>{ base(g,seed,0xa9a39a,0.84,0.62);
  const mat=vcPhys({ roughness:0.3, clearcoat:0.7 }), C=tone(0x3c2e24,0x1a120c,8,0.6,20);
  const geo=welded(new THREE.SphereGeometry(0.15,72,40,0,TAU,0,Math.PI*0.55)); displace(geo,v=>{ v.x*=1.5; v.y*=0.42; const ax=Math.exp(-((v.z/0.035)**2)); v.y+=0.018*ax*smooth(0.0,0.03,v.y);
    if (v.x<0.12 && v.x>-0.17) v.y-=0.004*Math.max(0,Math.sin(v.x*110))*smooth(0,0.02,v.y); });
  setColors(geo,(v,n,o)=>{ C(v,n,o); if (v.x<0.12 && Math.sin(v.x*110)>0.7) o.offsetHSL(0,0,0.06); if (v.x>0.12) o.offsetHSL(0,0.02,0.03); });
  mesh(geo, mat, 0, TOP, 0, g);
  for (const s of [1,-1]){ addHorn(g, mat, [0.12,TOP+0.01,s*0.11], 0.3, 0.014, [0, s*0.3, Math.PI/2], C, 0.0);
    const st=addHorn(g, mat, [0.15,TOP+0.05,s*0.04], 0.1, 0.008, [0,0,0], C, 0.05); st.rotation.set(s*0.15,0,-0.15); mesh(new THREE.SphereGeometry(0.016,14,10), plainMat(0x1e1814,{ roughness:0.15, clearcoat:1 }), 0.165, TOP+0.15, s*0.055, g); }
  for (let i=0;i<6;i++) addHorn(g, mat, [0.08-i*0.045,TOP+0.06,0], 0.07+0.01*(i%2), 0.008, [0,0,0.5], C, 0.3); };


/* ---- fish and sea reptiles ---- */
B.armorfish=(g,seed)=>{ base(g,seed,0x8e877a,0.86,0.66);
  const mat=vcPhys({ roughness:0.45, clearcoat:0.45 }), C=tone(0x5e554a,0x2a241e,6,0.6,14);
  const head=welded(new THREE.SphereGeometry(0.2,72,48)); displace(head,v=>{ v.x*=1.35; v.y*=0.72; v.z*=0.95; if (v.y<0) v.y*=0.45; if (v.x>0.12) v.y-=smooth(0.12,0.27,v.x)*0.05*(v.y>0?1:0); v.multiplyScalar(1+fbm(v.x*10,v.y*10,v.z*10,3)*0.025); });
  const seams=(v)=>{ const a=Math.abs(v.x-0.02-0.04*Math.sin(v.z*8))<0.004, b=Math.abs(Math.abs(v.z)-0.08-0.02*v.x*4)<0.004&&v.y>0.03, c=Math.abs(v.x+0.14)<0.004; return a||b||c; };
  setColors(head,(v,n,o)=>{ C(v,n,o); if (seams(v)) o.lerp(_c.set(0x1a1410),0.8); const e=Math.hypot((v.x-0.16)/0.035,(v.y-0.04)/0.035); if (Math.abs(v.z)>0.1 && e<1) o.lerp(_c.set(0x140e0a), 1-e*0.5); if (e>=1 && e<1.3 && Math.abs(v.z)>0.1) o.offsetHSL(0,0,0.08); });
  mesh(head, mat, 0, TOP+0.08, 0, g);
  const jaw=loft(24, t=>({ x:0.02+0.27*t, y:-0.01*t, w:0.1*(1-t*0.7), h:0.025*(1-t*0.4), p:3 }), 20); setColors(jaw, C);
  const j=mesh(jaw, mat, 0, TOP+0.04, 0, g); j.rotation.z=-0.22;
  const BC=tone(0x8a8274,0x3a342c,2,0.5); for (const s of [1,-1]){ addHorn(g, mat, [0.27,TOP+0.1,s*0.04], 0.1, 0.03, [Math.PI,0,0.25], BC, -0.3, 0.45); addHorn(g, mat, [0.26,TOP+0.03,s*0.035], 0.1, 0.028, [0,0,-0.35], BC, 0.3, 0.45); } };
B.raytooth=(g,seed)=>{ base(g,seed,0xc8bca2);
  const geo=welded(new THREE.BoxGeometry(0.4,0.05,0.26,60,4,40)); const S=0.02;
  displace(geo,v=>{ const arch=0.04*(1-(v.z/0.13)**2); v.y+=arch; if (v.y>arch){ const c=hexCell(v.x,v.z,S,0.55); v.y-=0.006*smooth(0.003,0.0005,c.wall); } });
  setColors(geo,(v,n,o)=>{ const c=hexCell(v.x,v.z,S,0.55); if (n.y>0.5){ o.set(0x2e2a28).lerp(_c.set(0x8a8682), 0.3+0.3*fbm(c.cx*30,c.cz*30,0,4)); if (c.wall<0.0015) o.set(0x141210); } else o.set(0x7a5a3a).offsetHSL(0,0,Math.sin(v.y*400)*0.04); });
  const m=mesh(geo, vcPhys({ roughness:0.18, clearcoat:1, clearcoatRoughness:0.06 }), 0, TOP+0.03, 0, g); m.rotation.y=0.35; };
B.sharkvert=(g,seed)=>{ base(g,seed,0xbfb39a,0.86,0.56);
  const prof=[]; for (let i=0;i<=24;i++){ const t=i/24, r=0.07*t; prof.push(new THREE.Vector2(Math.max(0.001,r), 0.018*(1-t*t)*0.9+0.002)); } for (let i=24;i>=0;i--){ const t=i/24; prof.push(new THREE.Vector2(Math.max(0.001,0.07*t), -0.018*(1-t*t)*0.9-0.002)); }
  const geo=new THREE.LatheGeometry(prof, 48); setColors(geo,(v,n,o)=>{ const r=Math.hypot(v.x,v.z); o.set(0x6e6254).lerp(_c.set(0xc4b498), clamp(Math.abs(n.y),0,1)*0.3); if (Math.abs(n.y)>0.3 && Math.sin(r*300)>0.5) o.offsetHSL(0,0,0.08); if (Math.abs(n.y)<0.3 && Math.sin(Math.atan2(v.z,v.x)*40)>0.6) o.offsetHSL(0,0,-0.06); });
  const mat=vcPhys({ roughness:0.5, clearcoat:0.35 });
  for (let i=0;i<4;i++){ const m=mesh(geo, mat, -0.2+i*0.075, TOP+0.075, 0.02*i, g); m.rotation.set(0.15*i,0,Math.PI/2+0.08*(i-1.5)); m.scale.setScalar(1-i*0.06); }
  const m=mesh(geo, mat, 0.2, TOP+0.025, 0.1, g); m.rotation.set(0.2,0,0.1); };
B.plesioflipper=(g,seed)=>{ base(g,seed,0xc4b59a,0.86,0.64);
  const mat=boneMat(), C=tone(0x9a7a52,0x4a3420,5,0.6);
  addBone(g, mat, [-0.34,TOP+0.035,0.0], [-0.1,TOP+0.035,0.0], 0.034, 0.06, C, 0.7);
  const fan=[-0.6,-0.28,0.02,0.32,0.62]; for (let d=0;d<5;d++){ let x=-0.06, z=0, a=fan[d]*0.6; const L=d===0||d===4?5:7;
    for (let k=0;k<L;k++){ const l=0.062*(1-k/9), nx=x+Math.cos(a)*l, nz=z+Math.sin(a)*l; addBone(g, mat, [x,TOP+0.022,z], [nx,TOP+0.022,nz], 0.012*(1-k/10), 0.02*(1-k/10), C, 0.7); x=nx+Math.cos(a)*0.006; z=nz+Math.sin(a)*0.006; a+=fan[d]*0.05; } } };
B.mosasaurjaw=(g,seed)=>{ base(g,seed,0xc8bc9e,0.9,0.6);
  const mat=boneMat(), C=tone(0xa8865c,0x4a3420,9,0.6,12);
  const jaw=loft(40, t=>({ x:-0.36+0.7*t, y:0.03*Math.sin(t*Math.PI), w:0.034*(1-t*0.4), h:0.07*(1-t*0.5), p:3 }), 22); setColors(jaw,C);
  const j=new THREE.Group(); mesh(jaw, mat, 0,0,0, j);
  const tm=glossMat(), TC=(v,n,o)=>{ o.set(0x2e241c).lerp(_c.set(0xc8b494), clamp(n.y*0.4+0.3,0,1)*0.6); };
  for (let i=0;i<10;i++){ const t=0.1+i*0.088, x=-0.36+0.7*t, h=0.07*(1-t*0.5); addHorn(j, tm, [x, h+0.03*Math.sin(t*Math.PI)-0.006, 0], 0.085*(1-t*0.35), 0.019*(1-t*0.3), [0,0,0.35], TC, 0.35); }
  j.position.set(0,TOP+0.045,0); j.rotation.set(-0.35,0.35,0); g.add(j);
  addHorn(g, tm, [0.24,TOP+0.01,0.16], 0.06, 0.013, [Math.PI/2-0.2,0.4,0], TC, 0.3); };
B.seaturtle=(g,seed)=>{ base(g,seed,0xc6b896,0.86,0.66);
  const mat=vcPhys({ roughness:0.5, clearcoat:0.35 }), cent=[];
  for (let i=0;i<5;i++) cent.push([0.13-i*0.065,0]); for (const s of [1,-1]) for (let i=0;i<4;i++) cent.push([0.1-i*0.065,s*0.09]); for (let i=0;i<20;i++){ const a=i/20*TAU; cent.push([Math.cos(a)*0.22,Math.sin(a)*0.17]); }
  const cell=(x,z)=>{ let d1=1e9,d2=1e9; for (const [cx,cz] of cent){ const d=Math.hypot(x-cx,(z-cz)*1.1); if (d<d1){ d2=d1; d1=d; } else if (d<d2) d2=d; } return (d2-d1)/2; };
  const geo=welded(new THREE.SphereGeometry(0.2,72,40,0,TAU,0,Math.PI*0.5)); displace(geo,v=>{ v.x*=1.15; v.z*=0.85; v.y*=0.48; v.y-=0.006*smooth(0.006,0.0,cell(v.x,v.z)); if (v.y>0.07) v.y+=0.004*Math.max(0,Math.sin(v.x*80)); });
  setColors(geo,(v,n,o)=>{ o.set(0x7a6a50).lerp(_c.set(0xc0aa84), clamp(n.y*0.5+0.3,0,1)*0.5); if (cell(v.x,v.z)<0.004) o.lerp(_c.set(0x2e241a),0.8); o.offsetHSL(0,0,fbm(v.x*20,v.y*20,v.z*20,3)*0.05); });
  mesh(geo, mat, 0, TOP-0.01, 0, g);
  const C=tone(0x7a6a50,0x3a2e22,4); for (const [x,s,L,a] of [[0.12,1,0.2,0.5],[0.12,-1,0.2,-0.5],[-0.15,1,0.11,2.4],[-0.15,-1,0.11,-2.4]]){ const f=loft(16,t=>({ x:L*t, w:0.03*(1-t*0.6)*(0.7+0.3*Math.sin(t*Math.PI)), h:0.008, p:2 }),12); setColors(f,C); const m=mesh(f, mat, x, TOP+0.005, s*0.12, g); m.rotation.y=-a; }
  const hd=welded(new THREE.SphereGeometry(0.045,24,16)); setColors(hd,C); mesh(hd, mat, 0.27, TOP+0.02, 0, g).scale.set(1.4,0.7,1); };

/* ---- plants ---- */
B.horsetail=(g,seed)=>{ const K=kit(0x4a3e2e); for (const [cx,cz] of [[0.2,0.18],[-0.22,-0.17]]){ for (let i=0;i<14;i++){ const a=i/14*TAU; K.cap(cx,cz,cx+Math.cos(a)*0.06,cz+Math.sin(a)*0.06,0.008,0.006,0x4a3e2e,0.003); } }
  stone(g,0.86,0.64,0.1,seed,(x,z)=>K.eval(x,z),0xbdb3a0);
  const mat=vcPhys({ roughness:0.6, clearcoat:0.2 });
  const one=(L,R,x,z,ry)=>{ const geo=loft(70, t=>({ x:-L/2+L*t, w:R, h:R }), 36, (t,a)=>{ const node=Math.abs(((t*L)/0.11)%1-0.5)>0.46; const odd=Math.floor(t*L/0.11)%2; return 1+0.05*Math.max(0,Math.cos(a*12+(odd?Math.PI/12*0.5:0)*12))+(node?0.05:0); });
    setColors(geo,(v,n,o)=>{ const t=(v.x+L/2)/L, a=Math.atan2(v.y,v.z), odd=Math.floor(t*L/0.11)%2; o.set(0x6e5c48).lerp(_c.set(0xb4a284), clamp(n.y*0.5+0.4,0,1)*0.5); if (Math.cos(a*12+(odd?Math.PI:0))<-0.7) o.offsetHSL(0,0,-0.1); if (Math.abs(((t*L)/0.11)%1-0.5)>0.46) o.lerp(_c.set(0x3a2e22),0.6); });
    const m=mesh(geo, mat, x, TOP+R*0.8, z, g); m.rotation.y=ry; };
  one(0.5,0.05,0.0,0.0,0.3); one(0.2,0.035,0.05,0.2,-0.9); };
B.petrifiedwood=(g,seed)=>{ base(g,seed,0xbfae90,0.8,0.62,0.06);
  const R=0.2, H=0.16, grp=new THREE.Group();
  const side=welded(new THREE.CylinderGeometry(R,R*1.04,H,72,8,true)); displace(side,v=>{ const k=1+fbm(v.x*10,v.y*10,v.z*10,4)*0.06+0.02*Math.sin(Math.atan2(v.z,v.x)*40); v.x*=k; v.z*=k; });
  setColors(side,(v,n,o)=>{ o.set(0x5a4030).lerp(_c.set(0x9a7a5a), clamp(fbm(v.x*30,v.y*8,v.z*30,2)*1.5+0.4,0,1)*0.5); if (Math.sin(Math.atan2(v.z,v.x)*60+v.y*20)>0.8) o.offsetHSL(0,0,-0.06); });
  mesh(side, vcPhys({ roughness:0.8 }), 0,0,0, grp);
  const top=new THREE.CircleGeometry(R*1.0,96,0); const ring=new THREE.RingGeometry(0.001,R,96,30); ring.rotateX(-Math.PI/2);
  setColors(ring,(v,n,o)=>{ const r=Math.hypot(v.x,v.z)/R, a=Math.atan2(v.z,v.x), w=r+fbm(v.x*8,0,v.z*8,6)*0.06; const band=Math.sin(w*70);
    o.set(0xb85a2a).lerp(_c.set(0xe8b070), band*0.5+0.5).lerp(_c.set(0x8a5a8a), smooth(0.2,0.6,fbm(v.x*5,1,v.z*5,9)+0.3)*0.4); if (r<0.12) o.set(0xf0ece0).lerp(_c.set(0xb8d0e0), r*4);
    if (r>0.93) o.set(0x4a3426); if (Math.abs(Math.sin(a*7+fbm(v.x*6,0,v.z*6,3)))<0.02 && r>0.2) o.offsetHSL(0,0,-0.15); });
  mesh(ring, vcPhys({ roughness:0.08, clearcoat:1, clearcoatRoughness:0.04 }), 0, H/2+0.001, 0, grp);
  grp.position.set(0, TOP+H/2-0.02, 0); grp.rotation.set(0.12,0,-0.1); g.add(grp); };
B.cycadcone=(g,seed)=>{ base(g,seed,0xc4b494);
  const prof=[]; for (let i=0;i<=40;i++){ const t=i/40; prof.push(new THREE.Vector2(Math.max(0.002,0.11*Math.sin(Math.PI*t)**0.75*(1-0.25*t)), t*0.34)); }
  const geo=welded(new THREE.LatheGeometry(prof, 72)); const cell=(v)=>{ const a=Math.atan2(v.z,v.x)/TAU, y=v.y/0.34; const s1=a*8+y*5, s2=a*13-y*8; return [s1-Math.floor(s1), s2-Math.floor(s2)]; };
  displace(geo,v=>{ const [p,q]=cell(v); const b=(1-Math.abs(p-0.5)*2)*(1-Math.abs(q-0.5)*2); const k=1+0.12*Math.sqrt(b); v.x*=k; v.z*=k; });
  setColors(geo,(v,n,o)=>{ const [p,q]=cell(v); const b=(1-Math.abs(p-0.5)*2)*(1-Math.abs(q-0.5)*2); o.set(0x3e2a1a).lerp(_c.set(0xa07850), smooth(0.0,0.4,b)); if (b>0.75) o.offsetHSL(0,0,-0.08); });
  const m=mesh(geo, vcPhys({ roughness:0.55, clearcoat:0.3 }), -0.15, TOP+0.09, 0, g); m.rotation.set(0.1,0.3,-Math.PI/2+0.1); };
B.stromatolite=(g,seed)=>{ base(g,seed,0xb8a68a,0.8,0.62,0.06);
  const rx=0.26, ry=0.24, rz=0.16, grp=new THREE.Group();
  const dome=welded(new THREE.SphereGeometry(1,64,40,0,Math.PI,0,Math.PI/2)); displace(dome,v=>{ const k=1+fbm(v.x*5,v.y*5,v.z*5,8)*0.12+0.06*Math.max(0,Math.sin(v.x*14)*Math.sin(v.z*14)); v.set(v.x*rx*k, v.y*ry*k, v.z*rz*k); });
  setColors(dome, tone(0x9a8a72,0x5a4a3a,8,0.5,8)); mesh(dome, vcPhys({ roughness:0.85 }), 0,0,0, grp);
  const face=new THREE.RingGeometry(0.0005,1,96,40,0,Math.PI); const pf=face.attributes.position; for (let i=0;i<pf.count;i++){ const x=pf.getX(i), y=pf.getY(i); const k=1+fbm(x*5,y*5,0,8)*0.12; pf.setXYZ(i, x*rx*k*0.995, y*ry*k*0.995, 0); }
  face.computeVertexNormals(); face.rotateY(Math.PI);
  setColors(face,(v,n,o)=>{ const w=v.y+0.025*Math.sin(v.x*28)*smooth(0,0.15,v.y)+fbm(v.x*20,v.y*20,0,2)*0.006; const b=Math.sin(w*150); o.set(0x6a5a4a).lerp(_c.set(0xe8dcc4), b*0.5+0.5).lerp(_c.set(0xb07a4a), smooth(0.6,1,Math.sin(w*23))*0.4); });
  mesh(face, vcPhys({ roughness:0.15, clearcoat:0.9, side:THREE.DoubleSide }), 0,0,0, grp);
  grp.position.set(0, TOP-0.04, 0); grp.rotation.y=Math.PI+0.5; g.add(grp); };

/* ---- insects and amber ---- */
B.amberbee=(g,seed)=>{ base(g,seed,0xcdbf9e);
  const inner=new THREE.Group(); inner.position.set(0,TOP+0.06,0); g.add(inner);
  const dk=plainMat(0x2a1a0e,{ roughness:0.5 }), yl=plainMat(0x9a6a10,{ roughness:0.4 });
  mesh(new THREE.SphereGeometry(0.022,14,10), dk, 0.05,0,0, inner, false); mesh(new THREE.SphereGeometry(0.03,14,10), dk, 0.012,0,0, inner, false).scale.set(1.1,0.9,1);
  for (let i=0;i<4;i++){ const m=mesh(new THREE.SphereGeometry(0.034-i*0.004,14,10), i%2?dk:yl, -0.03-i*0.016,0,0, inner, false); m.scale.set(0.55,0.85,0.95); }
  const wm=new THREE.MeshStandardMaterial({ color:0xc8a878, transparent:true, opacity:0.45, side:THREE.DoubleSide });
  for (const s of [1,-1]) for (const k of [0,1]){ const w=mesh(new THREE.CircleGeometry(0.05-k*0.015,16), wm, -0.01-k*0.01, 0.022, s*(0.045-k*0.005), inner, false); w.rotation.set(-Math.PI/2+s*0.25,0,s*0.25); w.scale.set(1.4,0.6,1); }
  for (const s of [1,-1]) for (let i=0;i<3;i++) mesh(tube([V3(0.02-i*0.015,-0.01,s*0.02),V3(0.03-i*0.02,-0.02,s*0.05),V3(0.02-i*0.028,-0.03,s*0.065)],t=>0.003,4), dk, 0,0,0, inner, false);
  const ag=welded(new THREE.SphereGeometry(0.17,48,32)); displace(ag,v=>{ v.x*=1.15; v.y=v.y>0?v.y*0.55:v.y*0.18; v.z*=0.82; });
  mesh(ag, amberMat(0xf0a828,0.5), 0, TOP+0.03, 0, g); };
B.amberlizard=(g,seed)=>{ base(g,seed,0xcdbf9e,0.86,0.56);
  const inner=new THREE.Group(); inner.position.set(0,TOP+0.06,0); g.add(inner); const dk=plainMat(0x3a2a14,{ roughness:0.5 });
  const body=loft(30,t=>({ x:-0.1+0.2*t, w:0.022*Math.sin(Math.PI*Math.min(1,t*1.1+0.05))+0.004, h:0.014*Math.sin(Math.PI*Math.min(1,t*1.1+0.05))+0.003 }),12); mesh(body, dk, 0,0,0, inner, false);
  mesh(new THREE.SphereGeometry(0.02,12,10), dk, 0.115,0.002,0, inner, false).scale.set(1.6,0.7,0.9);
  mesh(tube(curve([[-0.1,0,0],[-0.16,0,0.03],[-0.2,0,-0.01],[-0.24,0,-0.04]],16),t=>0.009*(1-t)+0.0015,6), dk, 0,0,0, inner, false);
  for (const [x,s] of [[0.06,1],[0.06,-1],[-0.06,1],[-0.06,-1]]){ mesh(tube([V3(x,0,s*0.015),V3(x+0.01,-0.004,s*0.04),V3(x+0.025*Math.sign(x),-0.008,s*0.05)],t=>0.004,5), dk, 0,0,0, inner, false);
    for (let k=-1;k<=1;k++) mesh(tube([V3(x+0.025*Math.sign(x),-0.008,s*0.05),V3(x+0.035*Math.sign(x)+k*0.006,-0.008,s*0.06)],t=>0.0015,3), dk, 0,0,0, inner, false); }
  const ag=loft(40,t=>({ x:-0.29+0.56*t, w:0.1*Math.pow(Math.sin(Math.PI*t),0.35), h:0.065*Math.pow(Math.sin(Math.PI*t),0.35), p:3 }),32); displace(ag,v=>{ v.multiplyScalar(1+fbm(v.x*6,v.y*6,v.z*6,3)*0.05); });
  mesh(ag, amberMat(0xe08a20,0.5), 0, TOP+0.05, 0, g); inner.rotation.y=0; };


/* ---- dinosaurs and other reptiles ---- */
// a skull part lofted along x from x0, with rounded ends and see-through-looking holes
function skullPart(L, x0, prof, holes, C, n=40, seg=32){ const f=t=>{ const r=prof(t), q=Math.max(0,Math.abs(t-0.5)*2-0.82)/0.18, e=Math.sqrt(Math.max(0,1-q*q)); return { x:x0+L*t, y:r.y, w:r.w*e, h:r.h*e, p:r.p||2.4, top:r.top, bot:r.bot }; };
  const geo=skullGeo(n, f, holes, seg); setColors(geo, holeTone(holes, C)); return geo; }
const edgeY=(prof,t)=>{ const r=prof(t); return r.y-r.h*(r.bot??1)*0.92; };
const darkBone=()=>tone(0x7a5a3e,0x30200f,6,0.65,12), toothC=(v,n,o)=>{ o.set(0x4a3a2a).lerp(_c.set(0xb8a080), clamp(v.y*-8+0.2,0,1)*0.3).lerp(_c.set(0x8a7a62), clamp(n.y,0,1)*0.3); };
B.trexskull=(g,seed)=>{ base(g,seed,0xb8a88a,0.92,0.64);
  const mat=boneMat(), tm=glossMat(), C=darkBone(), L=0.58, x0=-0.29;
  const prof=t=>({ y:0.035*(1-t), w:0.1-0.055*t, h:0.11-0.06*t+0.008*Math.sin(t*Math.PI*3), p:2.6, top:1, bot:0.72 });
  const holes=[[-0.14,0.085,0.028,0.034],[0.03,0.05,0.075,0.026],[-0.24,0.055,0.028,0.045],[0.25,0.03,0.014,0.012]];
  const sk=new THREE.Group(); mesh(skullPart(L,x0,prof,holes,C), mat, 0,0,0, sk);
  const jprof=t=>({ y:-0.02*t, w:0.085-0.045*t, h:0.034-0.012*t, p:2.2, top:0.8, bot:1 });
  const jaw=new THREE.Group(); mesh(skullPart(0.52,0,jprof,[[0.14,0.0,0.05,0.012]],C), mat, 0,0,0, jaw); jaw.position.set(-0.27,-0.075,0); jaw.rotation.z=-0.14; sk.add(jaw);
  for (let i=0;i<9;i++){ const t=0.48+i*0.055, r=prof(t), x=x0+L*t, y=edgeY(prof,t); for (const s of [1,-1]) addHorn(sk, tm, [x,y+0.008,s*r.w*0.8], 0.055*(1-i*0.04), 0.011, [Math.PI,0,0], toothC, 0.25); }
  for (let i=0;i<8;i++){ const t=0.5+i*0.055, r=jprof(t), x=0.52*t; for (const s of [1,-1]) addHorn(jaw, tm, [x,r.y+r.h*0.7,s*r.w*0.75], 0.04*(1-i*0.04), 0.009, [0,0,0], toothC, 0.25); }
  sk.position.set(0,TOP+0.13,0); sk.rotation.y=0.35; g.add(sk); };
B.trikeskull=(g,seed)=>{ base(g,seed,0xbcae90,0.92,0.68);
  const mat=boneMat(), C=tone(0x9a7a56,0x45301e,7,0.6,12), sk=new THREE.Group();
  const prof=t=>({ y:0.07*(1-t)-0.03*t*t, w:0.085-0.06*t, h:0.085-0.045*t, p:2.3, top:1, bot:0.8 });
  const holes=[[-0.02,0.075,0.022,0.024],[0.14,0.03,0.025,0.02]];
  mesh(skullPart(0.4,-0.14,prof,holes,C), mat, 0,0,0, sk);
  const jprof=t=>({ y:-0.02*t, w:0.06-0.04*t, h:0.03, p:2 }); const jw=mesh(skullPart(0.3,-0.1,jprof,[],C), mat, 0,-0.025,0, sk); jw.rotation.z=-0.05;
  const U=V3(-0.62,0.78,0).normalize(), Z=V3(0,0,1), O=V3(-0.11,0.09,0);
  const frill=surf(30,72,(u,v)=>{ const a=(v-0.5)*2.7, r=0.06+0.24*u+0.016*Math.pow(Math.max(0,Math.cos(a*13)),4)*smooth(0.85,1,u); const q=Math.cos(a)*r, s=Math.sin(a)*r; const curl=0.04*u*u;
    return [O.x+U.x*q-curl*0.6, O.y+U.y*q+curl*0.2, O.z+s]; });
  setColors(frill,(v,n,o)=>{ C(v,n,o); const r=v.clone().sub(O).length(); if (r>0.27) o.offsetHSL(0,0,0.06); if (Math.abs(Math.sin(Math.atan2(v.z,(v.y-O.y))*16+r*30))<0.08) o.offsetHSL(0,0,-0.07); });
  mesh(frill, vcPhys({ roughness:0.6, clearcoat:0.2, side:THREE.DoubleSide }), 0,0,0, sk);
  for (const s of [1,-1]) addHorn(sk, mat, [-0.03,0.13,s*0.04], 0.27, 0.026, [s*0.12,0,-0.9], tone(0xb89a70,0x4a3420,3), -0.15);
  addHorn(sk, mat, [0.15,0.07,0], 0.07, 0.02, [0,0,-0.5], C, -0.1);
  const beak=hornGeo(0.06,0.03,0.2,12,8,0.7); setColors(beak,toothC); const bk=mesh(beak, glossMat(), 0.25,0.0,0, sk); bk.rotation.z=Math.PI*0.75;
  sk.position.set(0.04,TOP+0.1,0); sk.rotation.y=0.55; g.add(sk); };
B.duckbillskull=(g,seed)=>{ base(g,seed,0xb8aa8c,0.96,0.6);
  const mat=boneMat(), C=darkBone(), sk=new THREE.Group();
  const prof=t=>({ y:0.03*(1-t), w:0.055-0.015*t+0.03*smooth(0.75,1,t), h:0.075-0.05*t, p:2.2+1.5*smooth(0.6,1,t), top:1, bot:0.8 });
  const holes=[[-0.07,0.05,0.022,0.026],[0.15,0.02,0.05,0.012]];
  mesh(skullPart(0.44,-0.18,prof,holes,C), mat, 0,0,0, sk);
  const jw=mesh(skullPart(0.38,-0.14,t=>({ y:0, w:0.045+0.015*t, h:0.02, p:2 }),[],C), mat, 0,-0.06,0, sk); jw.rotation.z=-0.06;
  const crest=tube(curve([[-0.06,0.07,0],[-0.16,0.13,0],[-0.3,0.17,0],[-0.42,0.19,0]],30), t=>0.03-0.006*t, 18, { squash:0.8 }); setColors(crest, (v,n,o)=>{ C(v,n,o); if (Math.abs(v.z)<0.004 && n.y>0.5) o.offsetHSL(0,0,-0.08); });
  mesh(crest, mat, 0,0,0, sk); sk.position.set(0.1,TOP+0.09,0); sk.rotation.y=0.3; g.add(sk); };
B.domeskull=(g,seed)=>{ base(g,seed,0xc0b296);
  const mat=boneMat(), C=tone(0x8a6e50,0x3e2c1c,5,0.6,10), sk=new THREE.Group();
  const dome=welded(new THREE.SphereGeometry(0.12,64,40)); displace(dome,v=>{ v.x*=1.15; v.z*=0.92; if (v.y<0) v.y*=0.5; v.multiplyScalar(1+fbm(v.x*14,v.y*14,v.z*14,4)*0.03); }); setColors(dome,(v,n,o)=>{ C(v,n,o); o.lerp(_c.set(0xc8aa84), clamp(n.y,0,1)*0.3); });
  mesh(dome, mat, -0.04,0.02,0, sk);
  const prof=t=>({ y:-0.01-0.01*t, w:0.06-0.03*t, h:0.05-0.02*t, p:2.2 }); mesh(skullPart(0.22,0.0,prof,[[0.05,0.0,0.02,0.02],[0.18,-0.015,0.012,0.01]],C), mat, 0,0,0, sk);
  const km=vcPhys({ roughness:0.6 }); for (let i=0;i<14;i++){ const a=Math.PI*0.35+i/13*Math.PI*1.3, kn=welded(new THREE.IcosahedronGeometry(0.016,2)); setColors(kn,C); mesh(kn, km, -0.04+Math.cos(a)*0.135, -0.01+0.02*Math.sin(i), Math.sin(a)*0.115, sk); }
  for (let i=0;i<5;i++){ const kn=welded(new THREE.IcosahedronGeometry(0.01,2)); setColors(kn,C); mesh(kn, km, 0.08+i*0.025, 0.03-i*0.004, (i%2?1:-1)*0.025, sk); }
  sk.position.set(0,TOP+0.07,0); sk.rotation.y=0.6; g.add(sk); };
B.pteroskull=(g,seed)=>{ base(g,seed,0xd2c4a6,0.96,0.5);
  const mat=boneMat(), C=tone(0xc8b08a,0x6a5034,9,0.55,14), sk=new THREE.Group();
  const prof=t=>({ y:0.02*(1-t), w:0.045*(1-t)**0.8+0.002, h:0.05*(1-t)**0.9+0.002, p:2.2, top:1, bot:0.6 });
  const holes=[[-0.06,0.035,0.022,0.025],[0.07,0.015,0.08,0.014]];
  mesh(skullPart(0.64,-0.14,prof,holes,C,60), mat, 0,0,0, sk);
  mesh(skullPart(0.54,-0.08,t=>({ y:0, w:0.028*(1-t)+0.002, h:0.012*(1-t)+0.002, p:2 }),[],C,40,16), mat, 0,-0.04,0, sk);
  const crest=loft(30,t=>({ x:-0.1-0.32*t, y:0.04+0.13*t, w:0.006*(1-t)+0.0015, h:0.035*(1-t)+0.004 }),12); setColors(crest,C); mesh(crest, mat, 0,0,0, sk);
  sk.position.set(-0.05,TOP+0.07,0); sk.rotation.y=0.25; g.add(sk); };
B.stegoplate=(g,seed)=>{ base(g,seed,0xb8a88a);
  const sh=new THREE.Shape(); sh.moveTo(-0.08,0); sh.bezierCurveTo(-0.2,0.08,-0.2,0.22,-0.05,0.42); sh.bezierCurveTo(0.05,0.36,0.18,0.26,0.17,0.12); sh.bezierCurveTo(0.15,0.05,0.1,0.02,0.08,0);
  const geo=new THREE.ExtrudeGeometry(sh,{ depth:0.012, bevelEnabled:true, bevelThickness:0.014, bevelSize:0.01, bevelSegments:4, curveSegments:40 }); geo.translate(0,0,-0.006);
  displace(geo,v=>{ v.z*=1+1.5*(1-smooth(0,0.3,v.y)); });
  setColors(geo,(v,n,o)=>{ o.set(0x8a6a48).lerp(_c.set(0xc8a878), clamp(Math.abs(n.z),0,1)*0.3); const a=Math.atan2(v.x,v.y+0.1); if (Math.abs(Math.sin(a*16+fbm(v.x*10,v.y*10,0,3)*1.5))<0.12 && v.y>0.05) o.offsetHSL(0,0,-0.09); if (v.y<0.04) o.lerp(_c.set(0x5a4430),0.5); o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,2)*0.04); });
  const m=mesh(geo, vcPhys({ roughness:0.55, clearcoat:0.3 }), 0.0, TOP-0.02, 0, g); m.rotation.y=0.55; };
B.clubtail=(g,seed)=>{ base(g,seed,0xb8ab8e,0.9,0.6);
  const mat=boneMat(), C=tone(0x7e6448,0x3a2a1a,4,0.6,18);
  const club=welded(new THREE.SphereGeometry(0.12,64,40)); displace(club,v=>{ v.z*=1.45; v.y*=0.6; v.x*=0.85; const gr=Math.exp(-((v.z/0.03)**2)); v.multiplyScalar(1-0.12*gr+fbm(v.x*25,v.y*25,v.z*25,6)*0.04); });
  setColors(club, C); mesh(club, mat, 0.18, TOP+0.05, 0, g);
  for (let i=0;i<6;i++){ const x=0.06-i*0.06; const v=loft(10,t=>({ x:-0.025+0.05*t, w:0.026+0.012*Math.abs(t-0.5)*2, h:0.022+0.01*Math.abs(t-0.5)*2 }),16); setColors(v,C); mesh(v, mat, x, TOP+0.03, 0, g).rotation.y=0.02*i; }
  for (const s of [1,-1]){ const td=tube(curve([[0.1,0.035,s*0.03],[-0.1,0.04,s*0.032],[-0.32,0.035,s*0.028]],20), t=>0.006, 6); setColors(td,C); mesh(td, mat, 0,TOP,0, g); } };
B.neckvertebra=(g,seed)=>{ base(g,seed,0xc2b496,0.94,0.6);
  const mat=boneMat(), C=tone(0xb89a6a,0x5a4028,3,0.55,12), grp=new THREE.Group();
  const holes=[[0.0,0.0,0.12,0.022]]; const prof=t=>({ y:0, w:0.042+0.01*Math.abs(t-0.5)*2, h:0.038+0.006*Math.abs(t-0.5)*2, p:2.3 });
  mesh(skullPart(0.48,-0.24,prof,holes,C), mat, 0,0,0, grp);
  const ball=welded(new THREE.SphereGeometry(0.042,24,16)); setColors(ball,C); mesh(ball, mat, 0.25,0,0, grp);
  const arch=loft(20,t=>({ x:-0.2+0.36*t, y:0.055+0.01*Math.sin(t*Math.PI), w:0.03, h:0.025*Math.sin(Math.PI*Math.min(1,t*1.1+0.05))+0.006 }),16); setColors(arch,C); mesh(arch, mat, 0,0,0, grp);
  for (const s of [1,-1]){ addHorn(grp, mat, [-0.04,0.07,s*0.02], 0.09, 0.016, [s*0.45,0,0.15], C, 0.1); addHorn(grp, mat, [0.13,0.06,s*0.025], 0.08, 0.01, [s*0.3,0,-1.1], C, 0.05);
    const rb=tube(curve([[0.14,-0.03,s*0.055],[0.0,-0.045,s*0.06],[-0.2,-0.05,s*0.06],[-0.36,-0.045,s*0.055]],20), t=>0.008*(1-t*0.7), 8); setColors(rb,C); mesh(rb, mat, 0,0,0, grp); }
  grp.position.set(0.02,TOP+0.06,0); grp.rotation.y=0.3; g.add(grp); };
B.dinorib=(g,seed)=>{ base(g,seed,0xc4b698,0.92,0.62);
  const mat=boneMat(), C=tone(0x9a7650,0x4a3420,8,0.6,14);
  const pts=curve([[-0.34,0,-0.14],[-0.14,0,0.08],[0.12,0,0.14],[0.34,0,0.02]],40);
  const geo=tube(pts, t=>0.024*(1-t*0.6)*(t<0.08?0.8+t*2.5:1), 18, { squash:0.42 }); setColors(geo,(v,n,o)=>{ C(v,n,o); o.offsetHSL(0,0,Math.sin((v.x+v.z)*80)*0.015); });
  mesh(geo, mat, 0, TOP+0.012, 0, g).rotation.set(Math.PI/2*0+0.0,0.2,0);
  const k1=welded(new THREE.SphereGeometry(0.026,20,14)); setColors(k1,C); mesh(k1, mat, -0.37*Math.cos(0.2)-(-0.17)*Math.sin(0.2)*0, TOP+0.02, -0.17, g);
  addHorn(g, mat, [-0.33,TOP+0.012,-0.12], 0.07, 0.016, [Math.PI/2,0,0.9], C, 0.1); };
B.femur=(g,seed)=>{ base(g,seed,0xbcae92,0.94,0.6);
  const mat=boneMat(), C=tone(0xb4966a,0x5a4028,2,0.6,10), grp=new THREE.Group();
  const shaft=loft(30,t=>{ const e=Math.max(smooth(0.3,0,t),smooth(0.6,1,t)); return { x:-0.3+0.6*t, w:0.042+0.05*e*(t>0.5?1.2:0.8), h:0.038+0.03*e }; },24); setColors(shaft,C); mesh(shaft, mat, 0,0,0, grp);
  const sp=(r,x,y,z,sx=1,sy=1,sz=1)=>{ const s=welded(new THREE.SphereGeometry(r,24,16)); displace(s,v=>v.multiplyScalar(1+fbm(v.x*30,v.y*30,v.z*30,5)*0.04)); setColors(s,C); mesh(s, mat, x,y,z, grp).scale.set(sx,sy,sz); };
  sp(0.055,-0.3,0.01,0.065); sp(0.045,-0.29,0.0,-0.035,1,1.2,1); sp(0.05,0.3,-0.005,0.045,1.1,0.9,1); sp(0.05,0.3,-0.005,-0.045,1.1,0.9,1); sp(0.02,-0.06,0.0,0.045,1.8,0.8,1);
  grp.position.set(0,TOP+0.05,0); grp.rotation.y=0.3; g.add(grp); };
B.sailspine=(g,seed)=>{ base(g,seed,0xa86a4a,0.86,0.56);
  const mat=boneMat(), C=tone(0x8a5a3a,0x3e2416,7,0.6,14);
  for (let i=0;i<6;i++){ const x=-0.19+i*0.075; const v=loft(10,t=>({ x:-0.03+0.06*t, w:0.026+0.01*Math.abs(t-0.5)*2, h:0.024+0.01*Math.abs(t-0.5)*2 }),16); setColors(v,C); mesh(v, mat, x, TOP+0.03, 0, g);
    const H=(0.16+0.16*Math.sin(Math.PI*(i+0.5)/6))*(i===4?0.6:1); const sp=tube(curve([[0,0,0],[-0.01,H*0.5,0],[-0.03,H,0]],16), t=>0.011*(1-t*0.6), 10, { ring:(t,a)=>1+0.15*Math.max(0,Math.sin(t*H*120))**4 }); setColors(sp,C); mesh(sp, mat, x, TOP+0.05, 0, g); } };

/* ---- mammals ---- */
B.sabertooth=(g,seed)=>{ base(g,seed,0x8a7a62,0.86,0.62);
  const mat=vcPhys({ roughness:0.35, clearcoat:0.6 }), C=tone(0x4a3626,0x1e140c,5,0.6,12), sk=new THREE.Group();
  const prof=t=>({ y:0.02+0.025*Math.sin(Math.PI*Math.min(1,t*1.4)), w:0.085-0.035*t, h:0.08-0.035*t, p:2.2, top:1, bot:0.75 });
  const holes=[[0.02,0.06,0.034,0.03],[0.14,0.035,0.015,0.015]];
  mesh(skullPart(0.36,-0.2,prof,holes,C), mat, 0,0,0, sk);
  const crest=loft(20,t=>({ x:-0.2+0.16*t, y:0.1+0.012*Math.sin(t*Math.PI), w:0.006, h:0.018*Math.sin(Math.PI*t)+0.002 }),10); setColors(crest,C); mesh(crest, mat, 0,0,0, sk);
  const sab=glossMat(); for (const s of [1,-1]){ const sg=tube(curve([[0,0,0],[0.01,-0.07,0],[-0.01,-0.13,0],[-0.04,-0.16,0]],24), t=>0.024*(1-t*0.85)+0.002, 14, { squash:0.45 }); setColors(sg,(v,n,o)=>{ o.set(0x3a2a1c).lerp(_c.set(0x9a8262), clamp(-v.y*5,0,1)*0.5); }); mesh(sg, sab, 0.1, -0.02, s*0.032, sk); }
  const jaw=new THREE.Group(); mesh(skullPart(0.3,0,t=>({ y:0, w:0.06-0.02*t, h:0.022+0.012*smooth(0.75,1,t), p:2 }),[],C), mat, 0,0,0, jaw); jaw.position.set(-0.13,-0.04,0); jaw.rotation.z=-0.55; sk.add(jaw);
  sk.position.set(0.02,TOP+0.14,0); sk.rotation.set(0,0.45,0.32); g.add(sk); };
B.mammothmolar=(g,seed)=>{ base(g,seed,0xbdae90);
  const geo=welded(new THREE.BoxGeometry(0.36,0.13,0.17,72,18,30)); const P=0.03;
  displace(geo,v=>{ const ex=Math.abs(v.x)/0.18, ez=Math.abs(v.z)/0.085, ey=(v.y+0.065)/0.13; const rnd=0.012*smooth(0.75,1,Math.max(ex,ez)); v.x*=1-rnd; v.z*=1-rnd*2; v.y+=0.03*(v.x/0.18)**2;
    if (ey>0.95){ const f=((v.x/P)%1+1)%1; const en=Math.abs(f-0.3)<0.06||Math.abs(f-0.7)<0.06; v.y+=en?0.006:(f>0.3&&f<0.7?-0.004:0); } });
  setColors(geo,(v,n,o)=>{ const f=((v.x/P)%1+1)%1; if (n.y>0.6){ const en=Math.abs(f-0.3)<0.06||Math.abs(f-0.7)<0.06; o.set(en?0xeee2c6:(f>0.3&&f<0.7?0x8a6a44:0x4e3a28)); }
    else { o.set(0x6a5038).lerp(_c.set(0xc8b08a), Math.abs(Math.sin(v.x/P*Math.PI))*0.5); o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,3)*0.05); } });
  const m=mesh(geo, vcPhys({ roughness:0.4, clearcoat:0.5 }), 0, TOP+0.06, 0, g); m.rotation.set(0.15,0.35,0); };
B.cavebear=(g,seed)=>{ base(g,seed,0xb4a68a,0.9,0.62);
  const mat=boneMat(), C=tone(0xd6c2a0,0x7a6244,3,0.55,10), sk=new THREE.Group();
  const prof=t=>({ y:0.035*(1-smooth(0.45,0.65,t))+0.005, w:0.09-0.035*t, h:0.085-0.03*smooth(0.45,0.65,t)-0.01*t, p:2.2, top:1, bot:0.75 });
  const holes=[[0.0,0.065,0.026,0.024],[-0.17,0.035,0.06,0.03]];
  mesh(skullPart(0.44,-0.24,prof,holes,C), mat, 0,0,0, sk);
  const crest=loft(20,t=>({ x:-0.24+0.18*t, y:0.115-0.02*t, w:0.006, h:0.012*Math.sin(Math.PI*t)+0.002 }),10); setColors(crest,C); mesh(crest, mat, 0,0,0, sk);
  const nose=new THREE.CircleGeometry(0.03,24); setColors(nose,(v,n,o)=>o.set(0x1e1610)); const nm=mesh(nose, plainMat(0xffffff,{ vertexColors:true, roughness:0.9 }), 0.2+0.001, 0.02, 0, sk, false); nm.rotation.y=Math.PI/2; nm.scale.set(0.7,1,1);
  const tm=glossMat(); for (const s of [1,-1]){ addHorn(sk, tm, [0.15,-0.035,s*0.035], 0.06, 0.012, [Math.PI,0,0], toothC, 0.25); }
  const jaw=new THREE.Group(); mesh(skullPart(0.38,0,t=>({ y:0, w:0.06-0.02*t, h:0.026, p:2 }),[],C), mat, 0,0,0, jaw); for (const s of [1,-1]) addHorn(jaw, tm, [0.34,0.02,s*0.03], 0.05, 0.011, [0,0,0], toothC, 0.25); jaw.position.set(-0.18,-0.075,0); jaw.rotation.z=-0.08; sk.add(jaw);
  sk.position.set(0.02,TOP+0.12,0); sk.rotation.y=0.4; g.add(sk); };
B.glyptodon=(g,seed)=>{ base(g,seed,0xc4b698,0.86,0.64,0.06);
  const geo=welded(new THREE.BoxGeometry(0.5,0.05,0.38,80,3,60)); const S=0.03;
  displace(geo,v=>{ const top=v.y>0; v.x*=1+fbm(v.z*8,0,0,3)*0.08; v.z*=1+fbm(v.x*8,0,0,5)*0.08; v.y+=0.09*(1-(v.x/0.25)**2*0.6-(v.z/0.19)**2*0.6);
    if (top){ const c=hexCell(v.x,v.z,S), a=Math.atan2(v.z-c.cz,v.x-c.cx); let b=0; if (c.d<S*0.38) b=0.008; else if (c.d>S*0.55 && c.d<S*0.8 && Math.cos(a*7)>0.3) b=0.006; if (c.wall<0.002) b=-0.004; v.y+=b; } });
  setColors(geo,(v,n,o)=>{ const c=hexCell(v.x,v.z,S); o.set(0xa88a62).lerp(_c.set(0xe0ccaa), clamp(n.y,0,1)*0.45); if (c.wall<0.002 && n.y>0.5) o.set(0x4a3626); if (n.y<0.3) o.set(0x8a6e4e).offsetHSL(0,0,fbm(v.x*40,v.y*40,v.z*40,2)*0.06); });
  mesh(geo, vcPhys({ roughness:0.6, clearcoat:0.2 }), 0, TOP-0.02, 0, g).rotation.y=0.3; };

/* ---- traces ---- */
B.coprolite=(g,seed)=>{ base(g,seed,0xc6b898);
  const one=(L,R,x,z,ry,sd)=>{ const pts=curve([[-L/2,0,0],[-L/6,0.01,0.02],[L/6,0,-0.015],[L/2,0.005,0.01]],40);
    const geo=tube(pts, t=>R*Math.sqrt(Math.sin(Math.PI*t))*(1-0.22*Math.pow(Math.max(0,Math.cos(t*20+sd)),4)), 24, { ring:(t,a)=>1+fbm(t*8,a,sd,4)*0.12 });
    setColors(geo,(v,n,o)=>{ const b=Math.sin(v.x*60+fbm(v.x*10,v.y*10,v.z*10,sd)*4); o.set(0x6a4a2a).lerp(_c.set(0xc07a3a), smooth(0.2,0.9,b)*0.7).lerp(_c.set(0x6a7a8a), smooth(0.4,0.9,fbm(v.x*12,v.y*12,v.z*12,sd+3))*0.6); });
    const m=mesh(geo, vcPhys({ roughness:0.12, clearcoat:1, clearcoatRoughness:0.05 }), x, TOP+R*0.8, z, g); m.rotation.y=ry; };
  one(0.36,0.065,0.02,-0.04,0.3,1); one(0.16,0.04,-0.12,0.16,-0.9,2); };

/* ================= v1.63: the reworked slab fossils =================
   These used to share one look: a round stone with a dark picture pressed into it. Each one now has its own shape:
   the find stands up off the rock in 3D, and the rock itself is cut, split, stacked or framed in its own way. */

// a tablet: a stone with a polygon outline (star shaped around 0,0), a flat top and a bottom, so it can be tilted or stood up
function tablet(parent, poly, h, seed, relief=null, tint=0xd7c6a2, seg=56){
  let W=0, D=0; for (const [x,z] of poly){ W=Math.max(W,Math.abs(x)); D=Math.max(D,Math.abs(z)); }
  const top=stone(parent, W*2+0.01, D*2+0.01, h, seed, relief, tint, seg, { poly });
  const sh=new THREE.Shape(poly.map(([x,z])=>new THREE.Vector2(x,z))), bot=new THREE.ShapeGeometry(sh); bot.rotateX(Math.PI/2);
  mesh(bot, plainMat(col(tint).offsetHSL(0,0,-0.12).getHex(), { roughness:0.95, clearcoat:0 }), 0, 0, 0, parent, false);
  return top; }
// a jittered ring of points, for round-ish tablets
const ring=(rx,rz,n,seed,j=0.08)=>{ const P=[]; for (let i=0;i<n;i++){ const a=i/n*TAU, k=1-j+_h(i,n,seed,3)*j*2; P.push([Math.cos(a)*rx*k, Math.sin(a)*rz*k]); } return P; };
// a squashed sphere, coloured
function ell3(parent, mat, C, r, sx, sy, sz, x, y, z, rot=[0,0,0], ws=24, hs=16, d=null){
  const s=welded(new THREE.SphereGeometry(r,ws,hs)); displace(s,v=>{ v.x*=sx; v.y*=sy; v.z*=sz; if (d) d(v); }); setColors(s,C);
  const m=mesh(s, mat, x, y, z, parent, false); m.rotation.set(rot[0],rot[1],rot[2]); return m; }
// a thin tapering tube through some points: legs, ribs, antennae, stalks
function limb(parent, mat, C, pts, r0, r1=r0*0.5, seg=6, n=0){ const P=curve(pts, n||Math.max(6,pts.length*4)); const geo=tube(P, t=>r0+(r1-r0)*t, seg); setColors(geo,C); return mesh(geo, mat, 0,0,0, parent, false); }
// a thin sheet spread out from 0,0 over an angle range: leaves, petals, fans. R(a) is the edge, lift(u,a) bends it
function fanSheet(R, a0, a1, lift, C, nu=20, nv=64){ const geo=surf(nu, nv, (u,v)=>{ const a=a0+(a1-a0)*v, r=R(a)*u; return [Math.cos(a)*r, lift(u,a), Math.sin(a)*r]; }); setColors(geo,C); return geo; }
const sheetMat=(o={})=>vcPhys(Object.assign({ roughness:0.5, clearcoat:0.35, side:THREE.DoubleSide }, o));

/* ---- sea life ---- */
B.brittlestar=(g,seed)=>{ tablet(g,[[-0.34,-0.12],[-0.18,-0.3],[0.16,-0.31],[0.36,-0.08],[0.3,0.22],[0.04,0.32],[-0.28,0.24]],0.05,seed,null,0x9aa0a6,48);
  const mat=vcPhys({ roughness:0.45, clearcoat:0.4 }), C=tone(0xc4703a,0x5a2410,4,0.55,22), y=0.05;
  ell3(g,mat,(v,n,o)=>{ C(v,n,o); if (v.y>0.006 && Math.cos(Math.atan2(v.z,v.x)*5-1.5)>0.55) o.offsetHSL(0,0,0.07); },0.068,1,0.38,1,0,y+0.012,0,[0,0,0],40,20,v=>{ const k=1+0.12*Math.cos(Math.atan2(v.z,v.x)*5-1.5); v.x*=k; v.z*=k; });
  for (let i=0;i<5;i++){ const a0=i*TAU/5+0.3, P=[]; for (let j=0;j<=30;j++){ const t=j/30, r=0.055+0.25*t, a=a0+Math.sin(t*4+i*1.7)*0.55*t; P.push(V3(Math.cos(a)*r, y+0.012+0.04*Math.sin(t*Math.PI)*((i%2)?1:0.4)-0.004*t, Math.sin(a)*r)); }
    const arm=tube(P,t=>0.02*(1-t*0.8)+0.003,10,{ squash:0.7, ring:(t,a)=>1+0.16*Math.max(0,Math.sin(t*120))**2 }); setColors(arm,C); mesh(arm,mat,0,0,0,g,false); } };
B.chaincoral=(g,seed)=>{ base(g,seed,0xb4aa96,0.74,0.58,0.05);
  const chains=[[[-0.36,-0.18],[-0.2,-0.08],[-0.05,-0.14],[0.1,-0.05],[0.3,-0.12]],[[-0.32,0.06],[-0.15,0.1],[0.0,0.02],[0.14,0.12],[0.34,0.08]],[[-0.25,0.24],[-0.1,0.18],[0.05,0.24],[0.2,0.2]],[[-0.05,-0.14],[-0.02,-0.04],[0.0,0.02]],[[0.14,0.12],[0.16,0.18],[0.2,0.2]]];
  const links=[]; for (const c of chains){ const P=path2(c.map(([x,z])=>[x*0.58,z*0.58]),64); for (let i=0;i<P.length-2;i+=3){ const [ax,az]=P[i],[bx,bz]=P[i+2], a=Math.atan2(bz-az,bx-ax); links.push([(ax+bx)/2,(az+bz)/2,Math.cos(a),Math.sin(a)]); } }
  const wall=(x,z)=>{ let w=-1; for (const [cx,cz,co,si] of links){ const dx=x-cx, dz=z-cz; if (Math.abs(dx)>0.016||Math.abs(dz)>0.016) continue; const e=Math.hypot((dx*co+dz*si)/0.0125,(-dx*si+dz*co)/0.0085); if (e<1.2) w=Math.max(w, e<0.6?0:1-Math.abs(e-0.9)/0.3); } return w; };
  const geo=welded(new THREE.BoxGeometry(0.46,0.15,0.34,96,12,72));
  displace(geo,v=>{ const top=v.y>0.074, ex=Math.abs(v.x)/0.23, ez=Math.abs(v.z)/0.17, k=1+fbm(v.x*6,v.y*6,v.z*6,3)*0.08-0.06*Math.max(ex,ez)**6*(v.y>0?1:0); v.x*=k; v.z*=k;
    if (v.y>0) v.y+=0.03*(1-ex*ex)*(1-ez*ez)-0.025*Math.max(ex,ez)**5; if (top){ const w=wall(v.x,v.z); v.y+= w>0? 0.011*w : (w===0? -0.009:0); } });
  setColors(geo,(v,n,o)=>{ if (n.y>0.55){ const w=wall(v.x,v.z); o.set(0x9a7450); if (w>0) o.lerp(_c.set(0xf0e6d0), 0.35+0.65*w); else if (w===0) o.set(0x4a2e1c); o.offsetHSL(0,0,fbm(v.x*30,0,v.z*30,5)*0.04); }
    else { o.set(0xa88c6a).offsetHSL(0,0,fbm(v.x*20,v.y*20,v.z*20,4)*0.07); if (Math.abs(Math.sin((v.x+v.z)*190))<0.12) o.offsetHSL(0,0,0.06); if (Math.abs(Math.sin(v.y*110))<0.08) o.offsetHSL(0,0,-0.07); } });
  const m=mesh(geo, vcPhys({ roughness:0.75, clearcoat:0.12 }), 0, 0.108, 0, g); m.rotation.set(0.05,0.4,-0.04); };
B.jellyfish=(g,seed)=>{ tablet(g,[[-0.42,-0.26],[0.4,-0.3],[0.44,0.24],[-0.38,0.3]],0.05,seed,null,0xc2a88c,48);
  const R=0.2, geo=welded(new THREE.SphereGeometry(R,96,28,0,TAU,0,Math.PI/2)), gro=a=>Math.pow(Math.max(0,Math.cos(a*16)),10);
  displace(geo,v=>{ const a=Math.atan2(v.z,v.x), r=Math.hypot(v.x,v.z)/R, k=1+0.06*Math.cos(a*16)*smooth(0.75,1,r); v.x*=k; v.z*=k; v.y*=0.32;
    v.y-=0.011*gro(a)*smooth(0.35,0.85,r); v.y+=0.004*Math.sin(r*44)*smooth(0.4,0.7,r);
    for (let i=0;i<4;i++){ const ga=i*TAU/4+0.4, d=Math.hypot(v.x-Math.cos(ga)*0.07, v.z-Math.sin(ga)*0.07); v.y-=0.01*Math.exp(-(((d-0.03)/0.008)**2)); } });
  setColors(geo,(v,n,o)=>{ const a=Math.atan2(v.z,v.x), r=Math.hypot(v.x,v.z)/R; o.set(0xe0c0a6).lerp(_c.set(0x8a5a4a), gro(a)*smooth(0.35,0.85,r)*0.85).lerp(_c.set(0x9a6a58), smooth(0.85,1,r)*0.5);
    for (let i=0;i<4;i++){ const ga=i*TAU/4+0.4, d=Math.hypot(v.x-Math.cos(ga)*0.07, v.z-Math.sin(ga)*0.07); if (Math.abs(d-0.03)<0.008) o.lerp(_c.set(0x7a4a3a),0.6); } o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,6)*0.05); });
  mesh(geo, vcPhys({ roughness:0.7, clearcoat:0.15 }), 0.08, 0.046, 0, g);
  const tm=vcPhys({ roughness:0.7 }), TC=tone(0xc8a088,0x7a5444,3,0.5); for (let i=0;i<5;i++){ const z0=-0.12+i*0.06; limb(g,tm,TC,[[-0.1,0.054,z0],[-0.19,0.056,z0+0.03],[-0.28,0.054,z0-0.02],[-0.37,0.053,z0+0.02]],0.009,0.003,6,20); } };
B.lacecoral=(g,seed)=>{ tablet(g,[[-0.3,-0.18],[0.02,-0.28],[0.3,-0.14],[0.28,0.2],[-0.06,0.27],[-0.3,0.12]],0.05,seed,null,0xb8b0a0,44);
  const mat=vcPhys({ roughness:0.6, clearcoat:0.25 }), C=tone(0xd6b482,0x6a4a2a,5,0.5,24), F=(u,v)=>{ const a=v*1.05, R=0.3*u; return [Math.sin(a)*R, 0.06+0.3*u, -0.06+(1-Math.cos(a))*R*0.9-0.05*u]; };
  limb(g,mat,C,[[0,0.05,-0.06],[0,0.07,-0.062],F(0.1,0)],0.016,0.01,8);
  for (let k=0;k<=14;k++){ const v=-1+2*k/14, u0=0.08+0.22*((k%4)/3), P=[]; for (let i=0;i<=16;i++){ const u=u0+(1-u0)*i/16; P.push(F(u,v)); } limb(g,mat,C,P,0.0075,0.005,5,24); }
  for (let j=1;j<=9;j++){ const u=0.18+0.82*j/9, P=[]; for (let i=0;i<=20;i++) P.push(F(u,-1+2*i/20)); limb(g,mat,C,P,0.0045,0.0045,5,40); } };
function graptoRelief(lines){ const K=kit(0xeae6da); const L=lines.map(([pts,side])=>{ const P=path2(pts,30); K.line(P,0.004,0.0035,0.007,0xeae6da); return { P, side }; });
  return (x,z)=>{ const r=K.eval(x,z); if (r) return r;
    for (const {P,side} of L){ for (let i=0;i<P.length-1;i++){ const [ax,az]=P[i],[bx,bz]=P[i+1], dx=bx-ax, dz=bz-az, l=Math.hypot(dx,dz), u=((x-ax)*dx+(z-az)*dz)/(l*l); if (u<0||u>1) continue;
      const px=-dz/l*side, pz=dx/l*side, off=(x-ax)*px+(z-az)*pz; if (off<0.002||off>0.018) continue; const s=((i+u)*l*1000/12)%1; if (s<off/0.018) return { h:0.005, c:0xe2ddd0, m:0.95 }; } }
    return null; }; }
B.graptolite=(g,seed)=>{
  const a=new THREE.Group(); tablet(a,[[-0.38,-0.1],[-0.1,-0.28],[0.36,-0.2],[0.3,0.12],[-0.2,0.2]],0.035,seed,graptoRelief([[[[-0.05,-0.05],[-0.2,-0.1],[-0.33,-0.11]],1],[[[-0.05,-0.05],[0.1,-0.13],[0.28,-0.16]],-1],[[[-0.18,0.1],[0.0,0.06],[0.22,0.06]],1]]),0x2c2e32,60); g.add(a);
  const b=new THREE.Group(); tablet(b,[[-0.22,-0.1],[0.14,-0.17],[0.22,0.1],[-0.12,0.15]],0.03,seed+3,graptoRelief([[[[-0.16,0.04],[0.0,-0.02],[0.16,-0.04]],1],[[[-0.1,0.1],[0.04,0.06],[0.16,0.07]],-1]]),0x3a3c42,48);
  b.position.set(0.06,0.034,0.1); b.rotation.set(0.1,0.45,0.05); g.add(b); };
B.eurypterid=(g,seed)=>{ tablet(g,[[-0.46,-0.16],[-0.2,-0.3],[0.3,-0.28],[0.46,0.0],[0.3,0.28],[-0.24,0.3]],0.05,seed,null,0x8e8c84,56);
  const mat=vcPhys({ roughness:0.3, clearcoat:0.75 }), C=tone(0x6e4c30,0x24160c,5,0.6,18), y=0.05;
  const body=loft(48,t=>({ x:0.21-0.46*t, w:(0.085*Math.pow(1-t,0.9)+0.014)*(t<0.04?0.7+t*7:1), h:0.024*(1-t*0.5)+0.005, p:2.6, bot:0.3 }),20,(t,a)=>1+0.07*Math.pow(Math.max(0,Math.sin(t*12*Math.PI)),3));
  setColors(body,(v,n,o)=>{ C(v,n,o); if (Math.sin((0.21-v.x)/0.46*12*Math.PI)<-0.85) o.offsetHSL(0,0,-0.1); }); mesh(body,mat,0,y+0.006,0,g,false);
  ell3(g,mat,C,0.08,1,0.32,1.05,0.27,y+0.008,0,[0,0,0],32,16);
  const eye=plainMat(0x140c08,{ roughness:0.15, clearcoat:1 }); for (const s of [1,-1]) mesh(new THREE.SphereGeometry(0.013,12,8), eye, 0.29, y+0.031, s*0.042, g, false);
  limb(g,mat,C,[[-0.24,y+0.012,0],[-0.34,y+0.012,0.005],[-0.45,y+0.008,0.0]],0.013,0.002,8);
  for (const s of [1,-1]){ limb(g,mat,C,[[0.22,y+0.01,s*0.06],[0.17,y+0.016,s*0.13],[0.1,y+0.012,s*0.17]],0.012,0.009);
    ell3(g,mat,C,0.055,1,0.16,0.5,0.06,y+0.012,s*0.2,[0,s*0.5,0],24,12);
    for (let j=0;j<3;j++) limb(g,mat,C,[[0.27-j*0.03,y+0.01,s*0.05],[0.31-j*0.03,y+0.03,s*(0.1+j*0.01)],[0.37-j*0.04,y+0.005,s*(0.12+j*0.03)]],0.006,0.003); } };
B.stonecrab=(g,seed)=>{ const R=0.19, el=ring(R*0.985,R*0.84*0.985,36,seed,0);
  const half=(sd,relief)=>{ const grp=new THREE.Group(); const n=welded(new THREE.SphereGeometry(R,48,20,0,TAU,Math.PI/2,Math.PI/2));
    displace(n,v=>{ v.z*=0.84; v.y*=0.5; v.multiplyScalar(1+fbm(v.x*8,v.y*8,v.z*8,sd)*0.06*smooth(-0.005,-0.04,v.y)); });
    setColors(n,tone(0xa8642c,0x5a3014,sd,0.6,10)); mesh(n,vcPhys({ roughness:0.85 }),0,0,0,grp);
    stone(grp,R*2,R*2*0.84,0.006,sd,relief,0x96764e,52,{ poly:el }); return grp; };
  const K=kit(0x6a4a30), h=-0.014; K.ell(0,0,0.07,0.09,0,h,undefined); for (const s of [1,-1]){ K.line(path2([[0.04,s*0.07],[0.09,s*0.11],[0.13,s*0.09]],8),0.016,0.012,h*0.9); K.ell(0.14,s*0.08,0.03,0.018,s*0.5,h); for (let j=0;j<4;j++) K.line([[0.02-j*0.03,s*0.08],[0.0-j*0.04,s*0.13],[-0.04-j*0.04,s*0.15]],0.006,0.004,h*0.7); }
  const A=half(seed,null); A.position.set(-0.2,0.095,-0.02); A.rotation.y=0.15; g.add(A);
  const Bh=half(seed+5,(x,z)=>{ const r=K.eval(-x,z); if (r){ r.shade=-0.05; r.m=0.55; } return r; }); Bh.position.set(0.2,0.11,0.04); Bh.rotation.set(0.32,-0.25,0.05); g.add(Bh);
  const mat=vcPhys({ roughness:0.35, clearcoat:0.6 }), CC=tone(0x7a4424,0x2a140a,7,0.6,20), cr=new THREE.Group();
  ell3(cr,mat,CC,0.075,1,0.32,1.2,0,0.014,0,[0,0,0],32,16,v=>{ v.y+=0.004*Math.sin(v.x*90)*Math.sin(v.z*90)*(v.y>0?1:0); });
  for (const s of [1,-1]){ limb(cr,mat,CC,[[0.05,0.01,s*0.07],[0.1,0.02,s*0.1],[0.13,0.014,s*0.085]],0.014,0.011);
    ell3(cr,mat,CC,0.03,1.25,0.5,0.7,0.155,0.014,s*0.075,[0,s*0.5,0],18,12); limb(cr,mat,CC,[[0.17,0.014,s*0.06],[0.2,0.014,s*0.05],[0.215,0.012,s*0.06]],0.006,0.002);
    for (let j=0;j<4;j++) limb(cr,mat,CC,[[0.02-j*0.03,0.008,s*0.08],[0.0-j*0.04,0.022,s*0.13],[-0.04-j*0.04,0.004,s*0.155]],0.006,0.003); }
  A.add(cr); };
B.fossilshrimp=(g,seed)=>{ tablet(g,[[-0.33,-0.22],[0.34,-0.23],[0.33,0.22],[-0.34,0.23]],0.04,seed,null,0xeadcb6,48);
  const mat=vcPhys({ roughness:0.35, clearcoat:0.6 }), C=tone(0xd88c52,0x7a3412,3,0.55,22), y=0.04;
  const P=curve([[0.17,y+0.03,0.0],[0.07,y+0.034,0.05],[-0.04,y+0.03,0.04],[-0.12,y+0.024,-0.02],[-0.15,y+0.018,-0.1]],44);
  const body=tube(P,t=>(t<0.32?0.04:0.04*(1-(t-0.32)*0.9))+0.004,16,{ squash:0.62, ring:(t,a)=>1+(t>0.32?0.12*Math.pow(Math.max(0,Math.sin((t-0.32)/0.68*6*Math.PI)),2):0.03*Math.sin(t*40)) });
  setColors(body,(v,n,o)=>{ C(v,n,o); if (n.y>0.7) o.offsetHSL(0,0,0.05); }); mesh(body,mat,0,0,0,g,false);
  const e=P[P.length-1]; for (const [dx,dz,ry] of [[-0.01,-0.04,0],[-0.03,-0.035,0.6],[0.01,-0.035,-0.6]]) ell3(g,mat,C,0.03,0.55,0.15,1,e.x+dx,y+0.016,e.z+dz,[0,ry,0],16,10);
  for (let i=0;i<5;i++){ const p=P[3+i*3]; limb(g,mat,C,[[p.x,p.y-0.01,p.z+0.02],[p.x+0.005,y+0.016,p.z+0.06],[p.x-0.015,y+0.004,p.z+0.085]],0.004,0.002); }
  for (const [tz,ty] of [[0.22,0.09],[-0.14,0.06]]) limb(g,mat,C,[[0.19,y+0.034,0.01],[0.28,y+ty,tz*0.4],[0.33,y+ty*0.6,tz]],0.0045,0.0015,5,24);
  mesh(new THREE.SphereGeometry(0.012,12,8), plainMat(0x1a100a,{ roughness:0.15, clearcoat:1 }), 0.185, y+0.05, 0.03, g, false); };
function fish3(parent, mat, x, z, L, ry){ const grp=new THREE.Group();
  const geo=loft(40,t=>{ const s=Math.sin(Math.PI*Math.min(1,t*1.08)); return { x:-L/2+L*t, w:L*0.15*Math.pow(s,0.7)+0.002, h:L*0.028*Math.pow(s,0.8)+0.0015, p:2.2 }; },18);
  setColors(geo,(v,n,o)=>{ const t=(v.x+L/2)/L; o.set(0x4a3626).lerp(_c.set(0x9a7a52), clamp(n.y,0,1)*0.3); if (t>0.25 && t<0.8 && Math.abs(Math.sin(t*L*Math.PI/0.011))<0.25 && n.y>0.5) o.lerp(_c.set(0x24160c),0.55);
    if (Math.abs(v.z)<0.003 && t<0.85) o.set(0x24160c); const e=Math.hypot(v.x-L*0.36,v.z-L*0.01); if (e<L*0.03 && e>L*0.017) o.set(0x1a100a); if (t>0.82) o.lerp(_c.set(0x6a5030),0.4); });
  mesh(geo, mat, 0,0,0, grp, false);
  const tail=fanSheet(a=>L*0.2*(1-0.4*Math.exp(-((a/0.15)**2))), -0.6, 0.6, (u)=>0, tone(0x5a4430,0x2a1a10,4,0.5,30), 8, 24); const tm=mesh(tail, sheetMat(), -L/2+0.004, 0, 0, grp, false); tm.rotation.y=Math.PI;
  const dor=fanSheet(a=>L*0.12, -0.5, 0.5, ()=>0, tone(0x5a4430,0x2a1a10,4,0.5,30), 6, 16); const dm=mesh(dor, sheetMat(), -L*0.04, 0, L*0.1, grp, false); dm.rotation.y=-Math.PI/2+0.3;
  grp.position.set(x,0,z); grp.rotation.y=ry; parent.add(grp); return grp; }
B.herring=(g,seed)=>{ tablet(g,[[-0.45,-0.3],[0.46,-0.31],[0.45,0.3],[-0.46,0.31]],0.05,seed,(x,z)=>({ h:0, c:0xcab48a, m:Math.abs(Math.sin(z*30+x*4))<0.05?0.35:0 }),0xdcc8a0,64);
  const mat=vcPhys({ roughness:0.4, clearcoat:0.5 }), y=0.05+0.006;
  for (const [x,z,L,ry] of [[0.06,-0.12,0.42,-0.15],[-0.12,0.1,0.34,0.25],[0.25,0.16,0.22,-0.4]]) fish3(g,mat,x,z,L,ry).position.y=y; };
B.ichthyosaur=(g,seed)=>{ const K=kit(0x34322e); K.ell(-0.02,-0.01,0.42,0.12,0.05,0.003,0x34322e,{ flat:true }); K.ell(0.3,0.0,0.24,0.05,0,0.003,0x34322e,{ flat:true });
  tablet(g,[[-0.56,-0.25],[0.55,-0.27],[0.56,0.25],[-0.55,0.27]],0.05,seed,(x,z)=>K.eval(x,z),0x66645e,84);
  const mat=boneMat(), C=tone(0xc09868,0x5a3e24,2,0.5,14), y=0.052;
  const sk=loft(30,t=>({ x:0.2+0.34*t, w:0.045*Math.pow(1-t,0.9)+0.005, h:0.026*Math.pow(1-t,0.9)+0.004, p:2.4 }),16); setColors(sk,(v,n,o)=>{ C(v,n,o); if (Math.abs(v.z)<0.002) o.offsetHSL(0,0,-0.1); }); mesh(sk,mat,0,y+0.014,0.005,g,false);
  const eyr=new THREE.TorusGeometry(0.022,0.006,8,24); eyr.rotateX(Math.PI/2); setColors(eyr,C); mesh(eyr,mat,0.27,y+0.03,0.012,g,false);
  const sp=curve([[0.21,y+0.012,0.01],[0.05,y+0.012,0.03],[-0.15,y+0.012,0.0],[-0.32,y+0.01,-0.04],[-0.5,y+0.008,-0.12]],120);
  const spine=tube(sp,t=>0.012*(1-t*0.6),10,{ ring:(t,a)=>1+0.25*Math.pow(Math.max(0,Math.sin(t*120*Math.PI)),2) }); setColors(spine,C); mesh(spine,mat,0,0,0,g,false);
  for (let i=4;i<56;i+=2){ const p=sp[i], q=sp[i+1], a=Math.atan2(q.z-p.z,q.x-p.x), L=0.1*Math.sin(Math.PI*(i-2)/58)+0.01; for (const s of [1,-1]){ const nx=-Math.sin(a)*s, nz=Math.cos(a)*s;
    limb(g,mat,C,[[p.x,p.y,p.z],[p.x+nx*L*0.6-0.012,p.y+0.006,p.z+nz*L*0.6],[p.x+nx*L-0.03,y+0.004,p.z+nz*L]],0.0035,0.002,5,8); } }
  const pad=(x,z,a,L,W)=>{ for (let r=0;r<5;r++) for (let q=0;q<4;q++){ const u=(r+0.5)/5, w=(q-1.5)/3*W*(1-u*0.5); ell3(g,mat,C,0.011,1,0.5,0.9, x+Math.cos(a)*u*L-Math.sin(a)*w, y+0.008, z+Math.sin(a)*u*L+Math.cos(a)*w, [0,-a,0],10,6); } };
  pad(0.13,0.1,2.1,0.13,0.06); pad(0.13,-0.08,-2.1,0.13,0.06); pad(-0.2,0.04,2.4,0.09,0.04); pad(-0.2,-0.08,-2.4,0.09,0.04); };

/* ---- plants ---- */
B.ginkgo=(g,seed)=>{ tablet(g,[[-0.36,-0.14],[-0.14,-0.3],[0.26,-0.28],[0.38,0.02],[0.2,0.28],[-0.24,0.26]],0.045,seed,null,0x55534e,56);
  const mat=sheetMat({ roughness:0.55 }), C=(v,n,o)=>{ const a=Math.atan2(v.z,v.x), r=Math.hypot(v.x,v.z); o.set(0xd8a23a).lerp(_c.set(0x9a6414), smooth(0.08,0.2,r)*0.5); if (Math.abs(Math.sin(a*34+r*8))<0.22) o.lerp(_c.set(0x7a4a10),0.6); };
  const R=a=>0.17*(1-0.38*Math.exp(-((a/0.1)**2)))*(1+0.04*Math.sin(a*14)), y=0.048;
  for (const [x,z,ry,s,lift] of [[-0.06,-0.06,0.2,1.05,0.02],[0.1,0.1,-2.2,0.85,0.012],[0.16,-0.12,1.2,0.7,0.016]]){ const geo=fanSheet(R,-1.05,1.05,(u,a)=>lift*u*u+0.006*Math.sin(a*3)*u,C,16,64);
    const m=mesh(geo,mat,x,y+0.004,z,g,false); m.rotation.y=ry; m.scale.setScalar(s); limb(g,sheetMat(),tone(0x9a6414,0x5a3a0a,2),[[x,y+0.004,z],[x-Math.cos(-ry)*0.06*s,y+0.003,z-Math.sin(-ry)*0.06*s],[x-Math.cos(-ry)*0.13*s,y+0.002,z-Math.sin(-ry)*0.13*s+0.01]],0.004,0.003,5,10); } };
B.palmfrond=(g,seed)=>{ tablet(g,[[-0.48,-0.2],[-0.2,-0.33],[0.3,-0.32],[0.48,-0.05],[0.4,0.3],[-0.1,0.34],[-0.46,0.18]],0.05,seed,null,0xd8caa6,64);
  const mat=sheetMat({ roughness:0.6 }), C=(v,n,o)=>{ o.set(0x5a5228).lerp(_c.set(0x2e2a14), clamp(0.5-n.y*0.5,0,1)); if (Math.abs(v.z)<0.002) o.set(0x2a2410); }, y=0.05, hx=-0.34, hz=0.02;
  for (let i=0;i<19;i++){ const a=-1.25+2.5*i/18, L=0.56*(1-0.42*Math.abs(Math.sin(a)))+0.02*Math.sin(a*7);
    const geo=loft(30,t=>({ x:L*t, w:0.028*Math.pow(Math.sin(Math.PI*Math.min(1,t*1.3+0.05)),0.4)*(1-t*0.55)+0.002, h:0.002 }),8,null,false); displace(geo,v=>{ v.y+=0.006*(1-Math.min(1,Math.abs(v.z)/0.02)); }); setColors(geo,C);
    const m=mesh(geo,mat,hx,y+0.006,hz,g,false); m.rotation.y=-a; }
  limb(g,vcPhys({ roughness:0.6 }),tone(0x5a4a28,0x2a2010,3),[[-0.47,y+0.008,-0.03],[-0.41,y+0.012,0.0],[hx,y+0.012,hz]],0.016,0.012,8);
  ell3(g,vcPhys({ roughness:0.6 }),tone(0x5a4a28,0x2a2010,3),0.035,1,0.4,1,hx,y+0.01,hz); };
B.scalebark=(g,seed)=>{ const L=0.62, R=0.15, geo=welded(new THREE.CylinderGeometry(R,R*1.06,L,120,44,false));
  const sc=v=>{ const a=Math.atan2(v.z,v.x)*R, u=v.y/0.05+a/0.032, w=v.y/0.05-a/0.032; return [u-Math.floor(u), w-Math.floor(w)]; }, cap=v=>Math.hypot(v.x,v.z)<R*0.985 && Math.abs(v.y)>L/2-0.001;
  displace(geo,v=>{ if (cap(v)){ v.y+=Math.sign(v.y)*(fbm(v.x*14,0,v.z*14,seed)*0.05-0.01); return; } const [fu,fv]=sc(v), e=Math.max(Math.abs(fu-0.5),Math.abs(fv-0.5))*2, k=(1+(e>0.84?-0.035:0.05*(1-e*e)))*(1+fbm(0,v.y*4,0,2)*0.04); v.x*=k; v.z*=k; });
  setColors(geo,(v,n,o)=>{ const r=Math.hypot(v.x,v.z); if (r<R*0.93 && Math.abs(n.y)>0.5){ const w=r/R+fbm(v.x*10,0,v.z*10,3)*0.08; o.set(0x7a5e40).lerp(_c.set(0x4a3626), Math.sin(w*40)*0.5+0.5); if (r<0.02) o.set(0x2e2016); return; }
    const [fu,fv]=sc(v), e=Math.max(Math.abs(fu-0.5),Math.abs(fv-0.5))*2; o.set(0x7a6a52).lerp(_c.set(0xa89878), (1-e)*0.4); if (e>0.84) o.set(0x2a2018); if (Math.hypot(fu-0.5,fv-0.42)<0.09) o.set(0x3a2c20); o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,4)*0.05); });
  const m=mesh(geo, vcPhys({ roughness:0.8, clearcoat:0.1 }), 0, R-0.005, 0, g); m.rotation.set(0,0.35,Math.PI/2); };
B.mapleleaf=(g,seed)=>{ tablet(g,[[-0.34,-0.2],[-0.06,-0.3],[0.34,-0.24],[0.38,0.12],[0.12,0.3],[-0.3,0.26],[-0.4,0.02]],0.045,seed,null,0xb8b0a2,60);
  const lobes=[0,0.8,-0.8,1.62,-1.62], Ls=[0.3,0.27,0.27,0.17,0.17];
  const R=a=>{ let r=0.12*smooth(2.6,1.9,Math.abs(a))+0.04; for (let i=0;i<5;i++){ const d=Math.abs(a-lobes[i]); r=Math.max(r, Ls[i]*(d<0.1?1:Math.exp(-(((d-0.1)/0.3)**2)))); } return r*(1+0.06*Math.max(0,Math.sin(a*40))); };
  const C=(v,n,o)=>{ const a=Math.atan2(v.z,v.x), r=Math.hypot(v.x,v.z); o.set(0xc8641e).lerp(_c.set(0x8a2e10), smooth(0.05,0.25,r)*0.6+fbm(v.x*12,0,v.z*12,4)*0.4); for (const l of lobes) if (Math.abs(Math.sin(a-l))*r<0.004 && Math.cos(a-l)>0) o.set(0x5a1e0a); };
  const geo=fanSheet(R,-2.55,2.55,(u,a)=>0.03*u*u*u+0.008*Math.sin(u*5)*u+0.01*Math.abs(Math.sin(a))*u*u,C,22,180); const m=mesh(geo,sheetMat(),0.04,0.052,0.01,g,false); m.rotation.y=0.35; m.scale.setScalar(1.15);
  limb(g,sheetMat(),tone(0x8a3410,0x4a1a08,2),[[0.02,0.052,0.01],[-0.06,0.051,-0.02],[-0.16,0.05,-0.035]],0.005,0.003,5,10); };
B.fossilflower=(g,seed)=>{ const P0=[[-0.34,-0.18],[0.0,-0.27],[0.34,-0.2],[0.38,0.1],[0.1,0.26],[-0.3,0.22]];
  [[0xc6b088,1,0,0,0],[0xd4c09c,0.86,0.03,-0.02,0.25],[0xe2d2b0,0.7,-0.02,0.03,-0.2]].forEach(([t,s,x,z,r],i)=>{ const L=new THREE.Group(); tablet(L,P0.map(([a,b],k)=>[a*s*(0.94+_h(k,i,seed,5)*0.12),b*s*(0.94+_h(k,i,seed,6)*0.12)]),0.022,seed+i,null,t,40); L.position.set(x,i*0.023,z); L.rotation.y=r; g.add(L); });
  const y=0.072, mat=sheetMat({ roughness:0.5, clearcoat:0.3 }), C=(v,n,o)=>{ const r=Math.hypot(v.x,v.z); o.set(0x5a2618).lerp(_c.set(0xc08050), smooth(0.04,0.1,r)*0.8); if (Math.abs(Math.sin(Math.atan2(v.z,v.x)*40))<0.15) o.offsetHSL(0,0,-0.06); };
  const fl=new THREE.Group(); fl.position.set(0.04,y,-0.02); fl.scale.setScalar(1.45); g.add(fl);
  for (let i=0;i<5;i++){ const geo=fanSheet(a=>0.11*Math.pow(Math.cos(a*1.6),0.6), -0.95, 0.95, (u,a)=>0.03*u*u+0.004*Math.cos(a*3), C, 14, 30); const m=mesh(geo,mat,0,0.006,0,fl,false); m.rotation.y=i/5*TAU+0.3; }
  const cm=vcPhys({ roughness:0.4, clearcoat:0.5 }), CC=tone(0x3a1c10,0x1a0c06,4); ell3(fl,cm,CC,0.026,1,0.6,1,0,0.016,0,[0,0,0],20,12); for (let i=0;i<10;i++){ const a=i/10*TAU; ell3(fl,cm,CC,0.007,1,1,1,Math.cos(a)*0.035,0.024,Math.sin(a)*0.035,[0,0,0],8,6); }
  limb(g,mat,tone(0x5a3a20,0x2a1a0c,3),[[-0.02,y+0.003,0.02],[-0.12,y+0.003,0.08],[-0.26,y+0.002,0.1]],0.006,0.004,5,12);
  const lf=fanSheet(a=>0.07*Math.pow(Math.cos(a*1.4),0.8), -1.1, 1.1, (u)=>0.006*u, C, 8, 20); const lm=mesh(lf,mat,-0.16,y+0.004,0.09,g,false); lm.rotation.y=-2.4; };

/* ---- insects ---- */
B.fossilspider=(g,seed)=>{ tablet(g,ring(0.27,0.23,11,seed),0.05,seed,null,0xe8e2d2,48);
  const mat=vcPhys({ roughness:0.3, clearcoat:0.7 }), C=tone(0x3e2c1e,0x120c08,5,0.6,26), y=0.05;
  ell3(g,mat,C,0.06,1.1,0.55,0.85,-0.06,y+0.03,0,[0,0,0],24,16); ell3(g,mat,C,0.04,1.05,0.5,0.95,0.04,y+0.024,0,[0,0,0],20,14);
  const eye=plainMat(0x0a0604,{ roughness:0.1, clearcoat:1 }); for (const s of [1,-1]) mesh(new THREE.SphereGeometry(0.008,10,8), eye, 0.08, y+0.036, s*0.012, g, false);
  for (const s of [1,-1]) for (let i=0;i<4;i++){ const d=i<2?1:-1, a=[0.35,0.95,1.75,2.4][i], bx=0.04-i*0.012, bz=s*0.03;
    limb(g,mat,C,[[bx,y+0.024,bz],[bx+Math.cos(a)*0.08,y+0.08,s*(0.04+Math.sin(a)*0.07)],[bx+Math.cos(a)*0.15,y+0.05,s*(0.05+Math.sin(a)*0.13)],[bx+Math.cos(a)*0.2,y+0.004,s*(0.06+Math.sin(a)*0.16)]],0.0075,0.003,6,20); }
  for (const s of [1,-1]) limb(g,mat,C,[[0.07,y+0.02,s*0.015],[0.1,y+0.03,s*0.03],[0.12,y+0.006,s*0.035]],0.005,0.003); };
B.roachfossil=(g,seed)=>{ tablet(g,[[-0.36,-0.2],[-0.1,-0.3],[0.34,-0.26],[0.38,0.08],[0.2,0.28],[-0.24,0.26],[-0.4,0.04]],0.11,seed,(x,z)=>({ h:0, c:0x4a4846, m:Math.sin(x*70+z*25)>0.93?0.6:0 }),0x2a2826,56);
  const mat=vcPhys({ roughness:0.22, clearcoat:0.9 }), C=tone(0x8e5a28,0x3a1c0a,8,0.55,20), y=0.11;
  ell3(g,mat,(v,n,o)=>{ C(v,n,o); if (v.x<0.08 && Math.abs(Math.sin(v.z*95+v.x*20))<0.16) o.offsetHSL(0,0,-0.08); if (Math.abs(v.z)<0.0035) o.set(0x2a140a); },0.12,1.15,0.22,0.62,-0.03,y+0.012,0,[0,0,0],40,20);
  ell3(g,mat,(v,n,o)=>{ C(v,n,o); if (Math.hypot(v.x/0.048,v.z/0.066)>0.82) o.offsetHSL(0,-0.1,0.1); },0.06,0.8,0.3,1.1,0.12,y+0.016,0,[0,0,0],24,14);
  ell3(g,mat,C,0.026,1,0.6,1,0.17,y+0.01,0,[0,0,0],14,10);
  for (const s of [1,-1]){ limb(g,mat,C,[[0.18,y+0.012,s*0.015],[0.28,y+0.03,s*0.08],[0.38,y+0.012,s*0.17]],0.003,0.0015,5,16);
    for (let j=0;j<3;j++){ const x=0.07-j*0.06; limb(g,mat,C,[[x,y+0.008,s*0.05],[x-0.01+j*0.0,y+0.03,s*0.12],[x-0.04,y+0.004,s*(0.17+j*0.01)]],0.0055,0.003); }
    limb(g,mat,C,[[-0.16,y+0.01,s*0.02],[-0.21,y+0.012,s*0.04]],0.004,0.0015); } };
B.arthropleura=(g,seed)=>{ tablet(g,[[-0.56,-0.14],[-0.3,-0.24],[0.3,-0.22],[0.56,-0.06],[0.54,0.16],[0.2,0.24],[-0.36,0.22],[-0.56,0.08]],0.05,seed,null,0x58544c,72);
  const P=path2([[0.44,0.06],[0.25,-0.02],[0.05,0.04],[-0.15,-0.04],[-0.32,0.02],[-0.46,-0.04]],60), mat=vcPhys({ roughness:0.35, clearcoat:0.6 }), C1=tone(0x8a6038,0x2e1c10,4,0.6,20), C2=tone(0x6e4a2c,0x241408,4,0.6,20), y=0.05;
  for (let i=0;i<28;i++){ const k=Math.min(P.length-2, Math.round(i/27*(P.length-2))), [x,z]=P[k], [x2,z2]=P[k+1], a=Math.atan2(z2-z,x2-x), w=0.068*(i<2?0.8:1)*(i>24?(28-i)/4*0.6+0.4:1);
    ell3(g,mat,i%2?C1:C2,1,0.021,0.017,w,x,y+0.012,z,[0,-a,0],16,10,v=>{ v.y+=0.004*(1-Math.abs(v.z)/w); });
    for (const s of [1,-1]){ const nx=-Math.sin(a)*s, nz=Math.cos(a)*s; limb(g,mat,C2,[[x+nx*w*0.85,y+0.01,z+nz*w*0.85],[x+nx*(w+0.022),y+0.014,z+nz*(w+0.022)],[x+nx*(w+0.038)-Math.cos(a)*0.012,y+0.003,z+nz*(w+0.038)-Math.sin(a)*0.012]],0.0035,0.002,5,8); } }
  for (const s of [1,-1]) limb(g,mat,C2,[[0.45,y+0.014,0.06],[0.5,y+0.03,0.06+s*0.05],[0.54,y+0.008,0.06+s*0.11]],0.0035,0.0015); };

/* ---- dinosaurs, birds and reptiles ---- */
B.dinoprint=(g,seed)=>{ const K=kit(0x5a2a18), d=-0.05; K.ell(-0.12,0,0.09,0.085,0,d,0x6a3420,{ flat:true });
  for (const [ex,ez] of [[0.26,0],[0.15,0.18],[0.15,-0.18]]){ K.cap(-0.1,0,ex,ez,0.05,d,0x6a3420,0.034,{ flat:true }); K.cap(ex,ez,ex+(ex+0.1)*0.18,ez*1.18,0.016,d*1.2,0x3a1a0c); }
  const R=kit(0xc8805a); for (const c of [[[-0.44,0.3],[-0.3,0.2],[-0.36,0.05],[-0.46,-0.04]],[[0.42,-0.32],[0.3,-0.25],[0.32,-0.08],[0.44,0.02]],[[-0.3,0.2],[-0.12,0.28],[0.05,0.33]],[[0.3,-0.25],[0.1,-0.3],[-0.1,-0.34]]]) R.line(path2(c,12),0.008,0.008,0.01,0xc8805a);
  tablet(g,[[-0.46,-0.3],[0.3,-0.38],[0.48,-0.04],[0.4,0.34],[-0.36,0.36],[-0.5,0.08]],0.16,seed,(x,z)=>K.eval(x,z)||R.eval(x,z),0xa85a38,88); };
B.firstbird=(g,seed)=>{ const K=kit(0x5a3a1e), c=0x5a3a1e, fc=0x8a6a42;
  K.ell(0.15,0.21,0.04,0.022,-1.0,0.012,c); K.ell(0.15,0.215,0.01,0.01,0,0.014,0x2a1a0e,{ ring:0.5 });
  K.line(path2([[0.13,0.18],[0.17,0.1],[0.1,0.06],[0.05,0.03]],14),0.006,0.007,0.01,c,{ band:200 });
  K.line([[0.05,0.03],[-0.13,-0.02]],0.008,0.007,0.011,c,{ band:250 }); for (let i=0;i<6;i++){ const x=0.02-i*0.025; K.cap(x,0.02,x-0.02,-0.04,0.0025,0.008,c); }
  const tail=path2([[-0.13,-0.02],[-0.28,-0.04],[-0.42,-0.07]],20); K.line(tail,0.006,0.003,0.01,c,{ band:300 }); for (let i=1;i<tail.length;i++){ const [x,z]=tail[i]; for (const s of [1,-1]) K.ell(x-0.03,z+s*0.025,0.04,0.008,-s*0.6,0.006,fc); }
  const wing=(s)=>{ K.line([[0.03,s*0.04],[-0.03,s*0.17],[0.08,s*0.25],[0.17,s*0.28]],0.006,0.004,0.011,c); K.line([[0.17,s*0.28],[0.21,s*0.26]],0.003,0.001,0.01,c);
    for (let i=0;i<11;i++){ const t=i/10, bx=-0.03+0.2*t, bz=s*(0.17+0.11*t), a=Math.atan2(s*0.9,-0.6+t*1.4), L=0.15-0.04*t; K.ell(bx+Math.cos(a)*L*0.5, bz+Math.sin(a)*L*0.5, L*0.5, 0.012, a, 0.007, fc); K.cap(bx,bz,bx+Math.cos(a)*L,bz+Math.sin(a)*L,0.002,0.009,c); } };
  wing(1); wing(-1);
  for (const s of [1,-1]) K.line([[-0.1,s*0.01],[-0.04,s*0.11],[-0.12,s*0.18],[-0.06,s*0.22]],0.006,0.003,0.011,c);
  const plate=new THREE.Group(), th=1.12; tablet(plate,[[-0.44,-0.33],[0.44,-0.34],[0.45,0.33],[-0.43,0.34]],0.045,seed,(x,z)=>{ const r=K.eval(x,-z); if (r) r.h*=2.4; return r; },0xe8d8a8,150);
  plate.rotation.x=th; plate.position.set(0,0.035+0.34*Math.sin(th),-0.02); g.add(plate);
  const wood=plainMat(0x6a4228,{ roughness:0.6, clearcoat:0.3 });
  mesh(new THREE.BoxGeometry(0.98,0.035,0.34), wood, 0, 0.0175, 0.04, g); mesh(new THREE.BoxGeometry(0.98,0.03,0.03), wood, 0, 0.05, 0.19, g);
  const st=mesh(new THREE.BoxGeometry(0.06,0.5,0.03), wood, 0, 0.25, -0.2, g); st.rotation.x=-0.45; };
B.fossilsnake=(g,seed)=>{ tablet(g,ring(0.38,0.32,9,seed,0.1),0.05,seed,null,0x8a9280,60);
  const mat=boneMat(), C=tone(0x7a5a3c,0x2e1e10,3,0.55,30), y=0.05, P=[]; for (let i=0;i<=360;i++){ const t=i/360, a=t*TAU*1.75, r=0.05+0.22*t; P.push(V3(0.02+Math.cos(a)*r, y+0.012, Math.sin(a)*r*0.82)); }
  const sp=tube(P,t=>0.005+0.007*Math.min(1,t*3),8,{ ring:(t,a)=>1+0.28*Math.pow(Math.max(0,Math.sin(t*150*Math.PI)),2) }); setColors(sp,C); mesh(sp,mat,0,0,0,g,false);
  for (let i=12;i<P.length-6;i+=6){ const p=P[i], q=P[i+1], a=Math.atan2(q.z-p.z,q.x-p.x), t=i/360, L=0.014+0.022*Math.min(1,t*3); for (const s of [1,-1]){ const nx=-Math.sin(a)*s, nz=Math.cos(a)*s;
    limb(g,mat,C,[[p.x,p.y,p.z],[p.x+nx*L*0.6,p.y+0.006,p.z+nz*L*0.6],[p.x+nx*L-Math.cos(a)*0.006,y+0.003,p.z+nz*L-Math.sin(a)*0.006]],0.0026,0.0016,4,6); } }
  const h=P[P.length-1], hq=P[P.length-2], ha=Math.atan2(h.z-hq.z,h.x-hq.x); ell3(g,mat,C,0.04,1.2,0.42,0.75,h.x+Math.cos(ha)*0.03,y+0.016,h.z+Math.sin(ha)*0.03,[0,-ha,0],20,12); };
B.fossilfrog=(g,seed)=>{ tablet(g,[[-0.38,-0.26],[0.34,-0.3],[0.4,0.22],[-0.34,0.3]],0.05,seed,null,0x5e5c56,56);
  const mat=boneMat(), C=tone(0xe4d4ac,0x8a7450,3,0.45,22), y=0.05;
  ell3(g,mat,(v,n,o)=>{ C(v,n,o); if (Math.hypot((v.x-0.005)/0.024,(Math.abs(v.z)-0.032)/0.024)<1) o.set(0x3a3630); },0.07,0.75,0.3,1.05,0.15,y+0.01,0,[0,0,0],28,14);
  for (let i=0;i<8;i++){ const x=0.09-i*0.014; ell3(g,mat,C,0.01,1.2,0.9,1.6,x,y+0.01,0,[0,0,0],10,8); limb(g,mat,C,[[x,y+0.008,-0.024*(1-i/10)],[x,y+0.01,0],[x,y+0.008,0.024*(1-i/10)]],0.003,0.003,4,6); }
  limb(g,mat,C,[[-0.02,y+0.01,0],[-0.07,y+0.01,0],[-0.12,y+0.008,0]],0.006,0.003);
  for (const s of [1,-1]){ limb(g,mat,C,[[-0.0,y+0.01,s*0.025],[-0.06,y+0.01,s*0.02],[-0.12,y+0.008,s*0.013]],0.005,0.004);
    limb(g,mat,C,[[-0.11,y+0.008,s*0.02],[-0.06,y+0.012,s*0.1],[-0.03,y+0.012,s*0.13],[-0.1,y+0.01,s*0.17],[-0.15,y+0.01,s*0.19],[-0.21,y+0.008,s*0.12]],0.0085,0.006,6,24);
    for (let k=0;k<5;k++) limb(g,mat,C,[[-0.21,y+0.008,s*0.12],[-0.25+k*0.008,y+0.007,s*(0.09+k*0.012)],[-0.29+k*0.016,y+0.005,s*(0.06+k*0.022)]],0.003,0.0018,4,6);
    limb(g,mat,C,[[0.08,y+0.01,s*0.05],[0.04,y+0.012,s*0.12],[0.11,y+0.01,s*0.16]],0.006,0.005); for (let k=0;k<4;k++) limb(g,mat,C,[[0.11,y+0.01,s*0.16],[0.14+k*0.006,y+0.008,s*(0.16+k*0.012)],[0.16+k*0.006,y+0.006,s*(0.15+k*0.024)]],0.0026,0.0016,4,6); } };
B.fossilfeather=(g,seed)=>{ tablet(g,[[-0.42,-0.1],[-0.2,-0.16],[0.3,-0.12],[0.42,0.02],[0.3,0.14],[-0.1,0.16],[-0.4,0.06]],0.045,seed,null,0xd4c8ac,56);
  const y=0.046, cv=new THREE.CatmullRomCurve3([[-0.4,y+0.006,-0.06],[-0.1,y+0.012,-0.01],[0.14,y+0.03,0.03],[0.34,y+0.08,0.07],[0.44,y+0.15,0.09]].map(p=>V3(...p))), up=V3(0,1,0);
  const rq=tube(cv.getPoints(60),t=>0.007*(1-t*0.8)+0.0015,8); setColors(rq,tone(0x2a1e14,0x140c08,3)); mesh(rq,vcPhys({ roughness:0.4, clearcoat:0.5 }),0,0,0,g,false);
  const vane=surf(70,24,(u,v)=>{ const t=0.14+0.85*u, p=cv.getPoint(t), tg=cv.getTangent(t), sd=V3().crossVectors(up,tg).normalize(), s=v*2-1, W=(s>0?0.11:0.055)*Math.pow(Math.sin(Math.PI*Math.min(1,u*1.02)),0.5);
    return [p.x+sd.x*s*W-tg.x*Math.abs(s)*W*0.35, p.y+0.014*s*s*W/0.11-0.002, p.z+sd.z*s*W-tg.z*Math.abs(s)*W*0.35]; });
  setColors(vane,(v,n,o)=>{ const b=Math.sin(v.x*150-v.z*90); o.set(0x9a7a56).lerp(_c.set(0x3e2a18), b>0.1?0.75:0); o.offsetHSL(0,0,fbm(v.x*20,v.y*20,v.z*20,3)*0.06); });
  mesh(vane, sheetMat({ roughness:0.7, clearcoat:0.1 }), 0,0,0, g, false); };
B.dawnhorse=(g,seed)=>{ const K=kit(0xb08a5c), c=0xb08a5c;
  K.ell(0.0,0.0,0.28,0.12,0,0.003,0x2a2420,{ flat:true }); K.ell(0.32,0.07,0.075,0.028,0.4,0.018,c); K.ell(0.29,0.08,0.012,0.012,0,0.02,0x1a120c,{ ring:0.5 });
  K.line(path2([[0.26,0.05],[0.2,0.05],[0.13,0.02]],10),0.007,0.008,0.016,c,{ band:200 }); const sp=path2([[0.13,0.02],[0.0,0.06],[-0.17,0.03]],24); K.line(sp,0.008,0.007,0.018,c,{ band:300 });
  for (let i=1;i<14;i++){ const [x,z]=sp[i]; K.line(path2([[x,z],[x-0.01,z-0.06],[x-0.0,z-0.11*Math.sin(Math.PI*i/15)-0.03]],6),0.0032,0.0022,0.012,c); }
  K.ell(-0.17,0.0,0.035,0.025,0.3,0.018,c); K.line([[-0.2,0.02],[-0.3,-0.01]],0.004,0.002,0.012,c,{ band:200 });
  for (const [o,cc] of [[0,c],[0.025,0x8a6a48]]){ K.line([[0.12-o,0.0],[0.15-o,-0.1],[0.13-o,-0.2],[0.16-o,-0.27]],0.007,0.004,0.016,cc); K.line([[-0.15-o,-0.01],[-0.08-o,-0.1],[-0.15-o,-0.2],[-0.12-o,-0.27]],0.008,0.004,0.016,cc); }
  tablet(g,[[-0.43,-0.31],[0.43,-0.31],[0.43,0.31],[-0.43,0.31]],0.05,seed,(x,z)=>K.eval(x,z),0x3c3832,88);
  const wood=plainMat(0x7a4e2c,{ roughness:0.55, clearcoat:0.35 });
  for (const s of [1,-1]){ mesh(new THREE.BoxGeometry(0.98,0.075,0.05), wood, 0, 0.0375, s*0.335, g); mesh(new THREE.BoxGeometry(0.05,0.075,0.72), wood, s*0.465, 0.0375, 0, g); }
  mesh(new THREE.BoxGeometry(0.16,0.006,0.03), plainMat(0xc8a050,{ metalness:0.7, roughness:0.3 }), 0, 0.078, 0.335, g, false); };

/* ---- traces ---- */
B.ripplerock=(g,seed)=>{ const trail=path2([[-0.36,-0.2],[-0.2,-0.1],[-0.24,0.05],[-0.06,0.1],[0.04,0.24]],40);
  tablet(g,[[-0.46,-0.18],[-0.2,-0.34],[0.32,-0.3],[0.48,0.02],[0.36,0.3],[-0.12,0.34],[-0.44,0.16]],0.12,seed,(x,z)=>{ let best=1e9; for (let i=0;i<trail.length-1;i++){ const [ax,az]=trail[i],[bx,bz]=trail[i+1], dx=bx-ax, dz=bz-az, l2=dx*dx+dz*dz, u=clamp(((x-ax)*dx+(z-az)*dz)/l2,0,1); best=Math.min(best,Math.hypot(x-ax-dx*u,z-az-dz*u)); }
    if (best<0.014) return { h:-0.01*(1-best/0.014), c:0x5a2a14, m:0.7 };
    const w=x*48+Math.sin(z*9)*0.9+fbm(x*3,z*3,0,4)*1.5, f=((w/TAU)%1+1)%1, r=f<0.7? f/0.7 : (1-f)/0.3, pit=_h(Math.floor(x*40),Math.floor(z*40),9,1)>0.985;
    return { h:0.03*Math.pow(r,1.6)-0.012+(pit?-0.004:0), c:r>0.75?0xe8b07a:0x8a4a2a, m:0.6, shade:pit?-0.1:0 }; },0xb06a44,96); };

/* ================= export ================= */
export const FOSSIL2_IDS = Object.keys(B);
export function buildFossil2Into(g, d){ const f=B[d.s]; if (!f) return false; f(g, hashStr('fos2'+d.s)%997); mergeStatic(g, new Set()); return true; }
