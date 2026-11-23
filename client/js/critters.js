// Critters v2: highly detailed fossils, fish and bugs.
// Same contract as the old builders in models.js: fish face +x, bugs face +z, both sit around y≈0.1-0.35;
// g.userData.wings = groups that flap on rotation.z (userData.side = ±1); g.userData.tail = fish tail (wags on rotation.y).
import * as THREE from 'three';
import { TAU, mulberry32, hashStr } from './util.js';
import { fishSkin, fishLook, finMat, wingTex, wingLook, clearWingMat, shellMat, fuzzMat, ceramic, glintMat, eyeMat } from './look.js';

/* ================= shared helpers ================= */
const V3 = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const once = (()=>{ const c=new Map(); return (k,f)=>{ if(!c.has(k)) c.set(k,f()); return c.get(k); }; })();
function mesh(geo, mat, x=0,y=0,z=0, parent, shadow=true){ const m=new THREE.Mesh(geo, mat); m.position.set(x,y,z); m.castShadow=shadow; m.receiveShadow=true; if(parent) parent.add(m); return m; }
const vcMat = (o={}) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors:true, roughness:0.85, metalness:0 }, o));
const vcPhys = (o={}) => new THREE.MeshPhysicalMaterial(Object.assign({ vertexColors:true, roughness:0.4, clearcoat:0.6, clearcoatRoughness:0.25 }, o));
const col = (c)=>new THREE.Color(c);
// cheap smooth noise (value noise, 2D and 3D)
const _h=(x,y,z,s)=>{ let h=(x*374761393+y*668265263+z*1442695041+s*144665)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
function n3(x,y,z,s=0){ const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z), xf=x-xi, yf=y-yi, zf=z-zi, u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf);
  const a=(i,j,k)=>_h(xi+i,yi+j,zi+k,s), L=(p,q,t)=>p+(q-p)*t;
  return L(L(L(a(0,0,0),a(1,0,0),u),L(a(0,1,0),a(1,1,0),u),v), L(L(a(0,0,1),a(1,0,1),u),L(a(0,1,1),a(1,1,1),u),v), w)*2-1; }
const fbm = (x,y,z,s=0)=> n3(x,y,z,s)*0.55 + n3(x*2.1,y*2.1,z*2.1,s+1)*0.28 + n3(x*4.3,y*4.3,z*4.3,s+2)*0.17;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
// distance from point to a segment (2D)
function segD(px,py,ax,ay,bx,by){ const dx=bx-ax, dy=by-ay, t=clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1),0,1); return Math.hypot(px-ax-dx*t, py-ay-dy*t); }
function setColors(geo, fn){ const p=geo.attributes.position, n=geo.attributes.normal, c=new Float32Array(p.count*3), v=V3(), nn=V3(), o=new THREE.Color();
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); if(n) nn.fromBufferAttribute(n,i); fn(v,nn,o,i); c[i*3]=o.r; c[i*3+1]=o.g; c[i*3+2]=o.b; } geo.setAttribute('color', new THREE.BufferAttribute(c,3)); return geo; }
function displace(geo, fn){ const p=geo.attributes.position, v=V3(); for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); fn(v,i); p.setXYZ(i,v.x,v.y,v.z); } geo.computeVertexNormals(); return geo; }
// merges duplicate vertices so displaced spheres stay closed and smooth
function welded(geo){ const g=geo.index?geo.toNonIndexed():geo; g.deleteAttribute('uv'); g.deleteAttribute('normal'); const p=g.attributes.position, map=new Map(), pos=[], idx=[];
  for (let i=0;i<p.count;i++){ const k=Math.round(p.getX(i)*1e4)+','+Math.round(p.getY(i)*1e4)+','+Math.round(p.getZ(i)*1e4); let j=map.get(k); if (j===undefined){ j=pos.length/3; map.set(k,j); pos.push(p.getX(i),p.getY(i),p.getZ(i)); } idx.push(j); }
  const o=new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); o.setIndex(idx); o.computeVertexNormals(); return o; }

// A tube along a list of points with a radius per point (rf(t) -> radius) and an optional cross-section squash.
function tube(pts, rf, seg=8, opts={}){
  const N=pts.length, pos=[], idx=[], uvs=[], up=V3(0,1,0), side=V3(), nrm=V3(), dir=V3(), prevSide=V3(1,0,0);
  for (let i=0;i<N;i++){ const t=i/(N-1); dir.copy(pts[Math.min(i+1,N-1)]).sub(pts[Math.max(i-1,0)]).normalize();
    side.crossVectors(Math.abs(dir.y)>0.92?V3(1,0,0):up, dir).normalize(); if (i>0 && side.dot(prevSide)<0) side.negate(); prevSide.copy(side); nrm.crossVectors(dir, side).normalize();
    const r=rf(t,i), sq=opts.squash||1;
    for (let k=0;k<=seg;k++){ const a=k/seg*TAU, ca=Math.cos(a), sa=Math.sin(a), rr=r*(opts.ring?opts.ring(t,a):1);
      pos.push(pts[i].x+(side.x*ca+nrm.x*sa*sq)*rr, pts[i].y+(side.y*ca+nrm.y*sa*sq)*rr, pts[i].z+(side.z*ca+nrm.z*sa*sq)*rr); uvs.push(k/seg, t); } }
  for (let i=0;i<N-1;i++) for (let k=0;k<seg;k++){ const a=i*(seg+1)+k, b=a+seg+1; idx.push(a,b,a+1, a+1,b,b+1); }
  if (opts.caps!==false){ // close both ends with a fan
    for (const [i,flip] of [[0,true],[N-1,false]]){ const c=pos.length/3; pos.push(pts[i].x,pts[i].y,pts[i].z); uvs.push(0.5,i?1:0);
      for (let k=0;k<seg;k++){ const a=i*(seg+1)+k; if (flip) idx.push(c,a+1,a); else idx.push(c,a,a+1); } } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2)); g.setIndex(idx); g.computeVertexNormals(); return g; }
// a smooth curve through control points, sampled n times
const curve = (ctrl, n=12)=>new THREE.CatmullRomCurve3(ctrl.map(p=>Array.isArray(p)?V3(...p):p)).getPoints(n-1);
// jointed insect leg: hip -> knee -> foot, three tapered segments with little joint knobs
function leg(parent, mat, hip, knee, ankle, foot, r=0.008, spines=0){
  const segs=[[hip,knee,r,r*0.8],[knee,ankle,r*0.8,r*0.55],[ankle,foot,r*0.55,r*0.3]];
  for (const [a,b,r0,r1] of segs){ mesh(tube([V3(...a),V3(...b)], t=>r0+(r1-r0)*t, 6), mat, 0,0,0, parent, false); }
  for (const p of [knee, ankle]) mesh(new THREE.SphereGeometry(r*0.95,8,6), mat, p[0],p[1],p[2], parent, false);
  if (spines) for (let i=1;i<=spines;i++){ const t=i/(spines+1), a=V3(...knee).lerp(V3(...ankle),t), dir=V3(...ankle).sub(V3(...knee)).normalize(), out=V3(0,-1,0).addScaledVector(dir,0.3).normalize();
    mesh(tube([a, a.clone().addScaledVector(out, r*2.2)], t=>r*0.35*(1-t)+0.0008, 4), mat, 0,0,0, parent, false); }
}
// the six legs of an insect, splayed from a body point; mirrored. z0 = first pair z, dz = spacing
function sixLegs(parent, mat, y, z0, dz, span=0.16, r=0.008, opts={}){
  for (let i=0;i<3;i++) for (const s of [1,-1]){ const z=z0-i*dz, fwd=(1-i)*0.6, sp=span*(opts.scale?opts.scale[i]:1), h=opts.high||1;
    leg(parent, mat, [s*0.02, y, z], [s*sp*0.45, y+0.05*h, z+fwd*sp*0.25], [s*sp*0.85, y-0.04, z+fwd*sp*0.45], [s*sp*1.05, Math.max(0.005,y-0.14*h), z+fwd*sp*0.6], r, opts.spines?opts.spines[i]:0); } }
// compound eye: dense little facets on a dark glossy dome
function compoundEye(parent, x,y,z, r, color=0x221a18){ const g=new THREE.IcosahedronGeometry(r, 3), m=new THREE.MeshPhysicalMaterial({ color, roughness:0.2, clearcoat:1, clearcoatRoughness:0.05, flatShading:true, iridescence:0.6, iridescenceIOR:1.5 });
  const e=mesh(g, m, x,y,z, parent, false); mesh(new THREE.SphereGeometry(r*0.22,6,5), glintMat(), x+r*0.35, y+r*0.55, z+r*0.55, parent, false); return e; }
// antenna as a thin curving tube; style: 'club' (butterfly), 'feather' (moth), 'elbow' (bee/beetle), 'whip'
function antennae(parent, mat, base, len, style='whip', spread=0.5, r=0.004){
  for (const s of [1,-1]){
    let pts;
    if (style==='elbow') pts=curve([[base[0]+s*0.01,base[1],base[2]],[base[0]+s*0.03,base[1]+len*0.45,base[2]+len*0.2],[base[0]+s*len*spread*0.8,base[1]+len*0.55,base[2]+len*0.75]],10);
    else pts=curve([[base[0]+s*0.01,base[1],base[2]],[base[0]+s*len*spread*0.4,base[1]+len*0.45,base[2]+len*0.45],[base[0]+s*len*spread,base[1]+len*0.6,base[2]+len*0.9]],14);
    mesh(tube(pts, t=>r*(1-t*0.4), 5), mat, 0,0,0, parent, false);
    const tip=pts[pts.length-1];
    if (style==='club'){ const c=mesh(new THREE.SphereGeometry(r*2.6,8,6), mat, tip.x,tip.y,tip.z, parent, false); c.scale.set(1,1,1.8); c.lookAt(pts[pts.length-2]); }
    if (style==='feather'){ for (let i=2;i<pts.length-1;i++){ const p=pts[i], d=V3().subVectors(pts[i+1],pts[i-1]).normalize(), sd=V3().crossVectors(d,V3(0,1,0)).normalize(); const L=len*0.16*Math.sin(i/(pts.length-1)*Math.PI);
      for (const q of [1,-1]) mesh(tube([p, p.clone().addScaledVector(sd,q*L).addScaledVector(d,L*0.4)], t=>r*0.45*(1-t)+0.0006, 3, {caps:false}), mat, 0,0,0, parent, false); } }
    if (style==='elbow'||style==='whip') for (let i=2;i<pts.length;i+=2) mesh(new THREE.SphereGeometry(r*1.3,6,4), mat, pts[i].x,pts[i].y,pts[i].z, parent, false);
  } }
// shared stone: a rounded slab (W x D), relief(x,z) adds height and tint. Returns the mesh; top at y≈h.
function slab(parent, W, D, h, seed, relief=null, tint=0xd7c6a2){
  const segX=110, segZ=Math.round(110*D/W), g=new THREE.PlaneGeometry(W, D, segX, segZ); g.rotateX(-Math.PI/2);
  const base=col(tint), dark=base.clone().offsetHSL(0.01,0.05,-0.2), light=base.clone().offsetHSL(0,-0.03,0.07), fos=new THREE.Color(), out=[];
  const edge=(x,z)=>{ const a=Math.atan2(z/D,x/W), wob=1+fbm(Math.cos(a)*1.6,Math.sin(a)*1.6,seed,seed)*0.18; const e=Math.hypot(x/(W/2),z/(D/2))/wob; return e; };
  const p=g.attributes.position, cArr=new Float32Array(p.count*3), keep=new Uint8Array(p.count);
  for (let i=0;i<p.count;i++){ let x=p.getX(i), z=p.getZ(i), e=edge(x,z); let y, c;
    if (e>1){ x/=e; z/=e; p.setX(i,x); p.setZ(i,z); e=1; }   // pull outside points onto the outline: a clean edge
    const ee=Math.min(1,e), dome=Math.sqrt(Math.max(0,1-ee**3)), rimDrop=Math.pow(Math.max(0,1-ee**6),0.35);
    const rock=fbm(x*4,z*4,seed,seed)*0.025 + fbm(x*14,z*14,seed+3,seed)*0.006;
    y=h*(0.0+1.0*rimDrop)*(0.55+0.45*dome)+rock*dome;
    const strata=(Math.sin((y*38+fbm(x*2,z*2,seed,7)*3))*0.5+0.5)*dome;
    c=base.clone().lerp(dark, (1-dome)*0.55+ Math.max(0,-rock*14)*0.3).lerp(light, strata*0.2*dome);
    const spk=_h(Math.floor(x*180),Math.floor(z*180),seed,2); if (spk>0.93) c.offsetHSL(0,0,-0.08); else if (spk<0.04) c.offsetHSL(0,0,0.06);
    if (relief && e<0.95){ const r=relief(x,z); if (r){ y+=r.h*dome; if (r.c!==undefined){ fos.set(r.c); c.lerp(fos, r.m??0.85); } if (r.shade) c.offsetHSL(0,0,r.shade); } }
    p.setY(i, y); cArr[i*3]=c.r; cArr[i*3+1]=c.g; cArr[i*3+2]=c.b; keep[i]=1; }
  // drop triangles outside the outline
  const I=g.index.array, ni=[]; for (let i=0;i<I.length;i+=3) if (keep[I[i]]&&keep[I[i+1]]&&keep[I[i+2]]) ni.push(I[i],I[i+1],I[i+2]); g.setIndex(ni);
  g.setAttribute('color', new THREE.BufferAttribute(cArr,3)); g.computeVertexNormals();
  return mesh(g, vcMat({ roughness:0.93 }), 0,0,0, parent); }

/* ================= FOSSILS ================= */
export function buildFossilInto(g, d){
  const s=d.s, seed=hashStr('fos'+s)%997;
  if (s==='leaf'){ // fern frond pressed into a split stone
    const H=0.62, rach=(z)=>Math.sin(z*3.2)*0.035;
    slab(g, 0.86, 0.64, 0.13, seed, (x,z)=>{ const zz=x, xx=z; // frond runs along x
      if (zz<-0.34||zz>0.36) return null; const cx=rach(zz); const t=(zz+0.34)/0.7; let dd=Math.abs(xx-cx)-0.008*(1.4-t);
      let h=0, m=0; if (dd<0.004){ h=0.012; m=1; }
      const step=0.045; const k=Math.round(zz/step); for (const kk of [k-1,k,k+1]){ const z0=kk*step, sd=(kk%2?1:-1); if (z0<-0.3||z0>0.33) continue; const tt=(z0+0.34)/0.7, L=0.21*Math.sin(Math.PI*Math.min(1,tt*1.05+0.04))*(1-tt*0.35), ang=0.95;
        for (const q of [1,-1]){ const sdq=q; const ax=rach(z0), az=z0, bx=ax+sdq*L*Math.sin(ang), bz=az+L*Math.cos(ang)*0.55;
          const dl=segD(xx,zz,ax,az,bx,bz); if (dl<0.004){ h=Math.max(h,0.009); m=1; }
          // pinnules: little oval lobes along the leaflet
          for (let j=1;j<7;j++){ const u=j/7, px=ax+(bx-ax)*u, pz=az+(bz-az)*u, w=0.016*(1-u*0.6); const ex=(xx-px), ez=(zz-pz)-0.0; const dd2=Math.hypot(ex/(w), ez/(w*0.55)); if (dd2<1){ h=Math.max(h,0.007*(1-dd2*dd2)+0.003); m=Math.max(m,0.75); } } } }
      return h? { h, c:0x6f5a3a, m:m*0.9, shade:-0.02 } : null; }, 0xd9c9a4);
    return; }
  if (s==='wing'){ // dragonfly wing imprint with full venation
    slab(g, 0.92, 0.6, 0.12, seed, (x,z)=>{
      const wings=[[0.02,0.06,0.4,0.085,0.12],[0.02,-0.06,0.36,0.095,-0.14]]; let best=null;
      for (const [ox,oz,L,Wd,rot] of wings){ const c=Math.cos(rot), sn=Math.sin(rot), lx=(x-ox)*c+(z-oz)*sn, lz=-(x-ox)*sn+(z-oz)*c; if (lx<0||lx>L) continue;
        const t=lx/L, half=Wd*Math.sin(Math.PI*Math.min(1,t*0.95+0.05))**0.7*(1-0.25*t); if (Math.abs(lz)>half) continue;
        let h=0.004, m=0.35;
        const longi=[-0.75,-0.45,-0.15,0.2,0.5,0.8]; for (const f of longi) if (Math.abs(lz-f*half*0.95)<0.0035){ h=0.009; m=0.95; }
        const cell=0.018, cx=lx%cell, jitter=Math.sin(Math.floor(lx/cell)*3.1+Math.floor(lz/0.012))*0.003; if (Math.abs(cx-cell/2+jitter)<0.0018){ h=Math.max(h,0.007); m=Math.max(m,0.8); }
        if (t>0.72&&t<0.82&&lz>half*0.6) { h=0.008; m=1; }   // pterostigma
        if (Math.abs(Math.abs(lz)-half)<0.004){ h=0.009; m=1; }
        best={ h, c:0x4a3a2a, m:Math.min(1,m*1.1) }; }
      // a hint of the body along the left
      const bd=segD(x,z,-0.36,0,0.04,0); if (bd<0.022){ return { h:0.016*(1-bd/0.022)+0.004, c:0x6a5440, m:0.9 }; }
      return best; }, 0xcfc0a0);
    return; }
  if (s==='bug'){ // trilobite raised out of the stone
    slab(g, 0.84, 0.66, 0.11, seed, (x,z)=>{ const L=0.25, Wd=0.15; const ex=x/L, ez=z/Wd; const e=Math.hypot(ex, ez); if (e>1.02) return null;
      let h=0.03*Math.sqrt(Math.max(0,1-e*e));
      const head=x>0.11, tail=x<-0.15; const ax=Math.abs(z)<0.035+(head?0.01:0);
      if (ax) h+=0.016*(1-Math.abs(z)/0.05);       // raised axial lobe
      if (!head && !tail){ const seg=Math.sin((x+0.2)*120); if (seg>0.6) h-=0.006; }     // thorax segments
      if (tail){ const seg=Math.sin((x+0.2)*90); if (seg>0.7) h-=0.004; }
      if (head){ for (const q of [1,-1]){ const de=Math.hypot(x-0.17, z-q*0.06); if (de<0.022) h+=0.014*(1-de/0.022); } }   // eyes
      if (Math.abs(Math.abs(z)-0.04)<0.004) h-=0.004;                                // axial furrows
      if (e>0.88) h+=0.004;                                                              // rim
      return { h, c:e>0.9?0x5c4630:0x7b6142, m:0.92, shade:(Math.sin((x+0.2)*120)>0.6&&!head&&!tail)?-0.06:0 }; }, 0xd2c09a);
    return; }
  if (s==='lily'){ // crinoid: segmented stem curling into a feathery crown
    const stem=curve([[-0.36,0,-0.12],[-0.2,0,-0.02],[-0.02,0,-0.06],[0.1,0,0.02]],40);
    slab(g, 0.9, 0.62, 0.12, seed, (x,z)=>{ let best=1e9, ti=0; for (let i=0;i<stem.length-1;i++){ const dd=segD(x,z,stem[i].x,stem[i].z,stem[i+1].x,stem[i+1].z); if (dd<best){ best=dd; ti=i; } }
      if (best<0.016){ const ring=Math.sin(ti*2.4)>0.2; return { h:0.012*(1-best/0.02)+(ring?0.004:0), c:0x6b5540, m:0.9, shade:ring?0.04:-0.03 }; }
      // calyx and arms
      const cx=0.12, cz=0.03; const dc=Math.hypot(x-cx,z-cz); if (dc<0.035) return { h:0.018, c:0x6b5540, m:0.9 };
      for (let a=0;a<5;a++){ const ang=-0.9+a*0.45; for (let k=0;k<2;k++){ const L=0.2-k*0.03, ax=cx+Math.cos(ang)*0.02, az=cz+Math.sin(ang)*0.02, bx=cx+Math.cos(ang+k*0.12)*L, bz=cz+Math.sin(ang+k*0.12)*L;
        const dl=segD(x,z,ax,az,bx,bz); if (dl<0.006) return { h:0.01, c:0x6b5540, m:0.9 };
        const u=clamp(((x-ax)*(bx-ax)+(z-az)*(bz-az))/(L*L),0,1); if (u>0.15 && dl<0.022 && Math.sin(u*60)>0.3) return { h:0.006, c:0x6f5a44, m:0.7 }; } }
      return null; }, 0xd5c6a6);
    return; }
  // 3D fossils sit on a smaller stone
  slab(g, 0.78, 0.6, 0.1, seed, null, s==='amber'?0xc8b892:0xd3c3a0);
  const bone=vcPhys({ roughness:0.62, clearcoat:0.25 }), top=0.1;
  if (s==='spiral'){ // ammonite: tightly coiled, ribbed shell, lying in the stone
    const turns=3.1, k=0.15, pts=[], N=170; for (let i=0;i<N;i++){ const t=i/(N-1), a=t*TAU*turns, r=0.0085*Math.exp(a*k); pts.push(V3(Math.cos(a)*r, 0, Math.sin(a)*r)); }
    const g2=tube(pts, t=>0.0085*Math.exp(t*TAU*turns*k)*0.6, 20, { squash:0.78, ring:(t,a)=>1+0.08*Math.max(0,Math.sin(t*turns*46))**2*(0.5+0.5*Math.abs(Math.sin(a))) });
    setColors(g2,(v,n,o,i)=>{ const t=Math.floor(i/21)/(N-1), a=Math.atan2(v.z,v.x); o.set(0xb88a58).lerp(col(0xf2dcb2), clamp(n.y*0.5+0.5,0,1)*0.55); if (Math.sin(t*turns*46)>0.6) o.offsetHSL(0,0.03,0.05); if (Math.sin(t*turns*46*0.5+Math.sin(a*6)*0.8)>0.97) o.offsetHSL(0,0.05,-0.16); o.offsetHSL(0,0,fbm(v.x*40,v.y*40,v.z*40,4)*0.05); });
    const am=mesh(g2, vcPhys({ roughness:0.4, clearcoat:0.55, iridescence:0.35, iridescenceIOR:1.4 }), 0.0, top+0.065, 0, g); am.rotation.x=0.22; am.rotation.y=0.4; am.scale.setScalar(1.25); return; }
  if (s==='tooth'){ // serrated shark tooth: glossy dark enamel blade, tan two-lobed root
    const shape=new THREE.Shape(); const W=0.15, H=0.27; shape.moveTo(-W,0.02);
    for (let i=0;i<=40;i++){ const t=i/40, x=-W*(1-t)*(1-0.12*Math.sin(t*Math.PI)), y=0.02+(H-0.02)*t; shape.lineTo(x-(i%2?0.003:0), y); }
    for (let i=40;i>=0;i--){ const t=i/40, x=W*(1-t)*(1-0.12*Math.sin(t*Math.PI)), y=0.02+(H-0.02)*t; shape.lineTo(x+(i%2?0.003:0), y); }
    shape.lineTo(W,0.02); shape.bezierCurveTo(W*0.9,-0.04,W*0.3,-0.05,0,-0.015); shape.bezierCurveTo(-W*0.3,-0.05,-W*0.9,-0.04,-W,0.02);
    const tg=new THREE.ExtrudeGeometry(shape,{ depth:0.016, bevelEnabled:true, bevelThickness:0.014, bevelSize:0.01, bevelSegments:4, curveSegments:8 }); tg.translate(0,0,-0.008);
    displace(tg, v=>{ v.z*= 1+ (1-Math.abs(v.x)/0.15)*0.6; });
    setColors(tg,(v,n,o)=>{ const t=clamp((v.y-0.03)/0.24,0,1); if (v.y<0.035) o.set(0xb89466).offsetHSL(0,0,fbm(v.x*60,v.y*60,v.z*60,3)*0.08); else { o.set(0x2c343c).lerp(col(0x6a7884), t*0.55).lerp(col(0xa8b4bc), Math.max(0,n.z)*0.15); } if (v.y>0.03&&v.y<0.045) o.set(0x5a4a3a); });
    const t=mesh(tg, vcPhys({ roughness:0.15, clearcoat:1, clearcoatRoughness:0.06 }), 0, top+0.04, 0, g); t.rotation.set(-0.3,0.35,0.05); return; }
  if (s==='claw'){ // curved raptor claw with keratin ridges
    const pts=[]; for (let i=0;i<24;i++){ const t=i/23, a=-0.2+t*1.9; pts.push(V3(Math.cos(a)*0.2-0.06, Math.sin(a)*0.2*0.95, 0)); }
    const cg=tube(pts, t=>0.058*Math.pow(1-t,0.8)+0.002, 16, { squash:0.7, ring:(t,a)=>1+0.03*Math.sin(a*6) });
    setColors(cg,(v,n,o,i)=>{ o.set(0x3a2c24).lerp(col(0x9a7a5a), clamp(n.y*0.4+0.5,0,1)*0.6); o.offsetHSL(0,0,Math.sin(Math.atan2(v.y,v.x+0.06)*70)*0.03); });
    const c=mesh(cg, vcPhys({ roughness:0.3, clearcoat:0.8 }), -0.02, top-0.005, 0, g); c.rotation.set(0.1,0.5,0);
    return; }
  if (s==='tusk'){ // mammoth tusk: a long upward curl with growth bands, cracks and a worn tip
    const pts=[]; for (let i=0;i<36;i++){ const t=i/35; pts.push(V3(-0.3+0.52*t, 0.0+0.19*t*t*t, -0.04+0.1*t*t)); }
    const tg=tube(pts, t=>0.07*(1-t)**0.55+0.008, 20);
    setColors(tg,(v,n,o,i)=>{ const t=Math.floor(i/21)/35; o.set(0xe8cfa0).lerp(col(0x9a7448), smooth(0.6,1,t)*0.75).lerp(col(0x8a6a48), smooth(0.08,0,t)*0.6); if (Math.sin(t*170)>0.8) o.offsetHSL(0,0,-0.05); if (Math.abs(n3(v.x*30,v.y*12,v.z*30,9))<0.03) o.offsetHSL(0,0.05,-0.22); o.lerp(col(0xfbf4e2), clamp(n.y,0,1)*0.15); });
    const tk=mesh(tg, vcPhys({ roughness:0.42, clearcoat:0.45 }), 0.02, top+0.05, 0, g); tk.rotation.set(0,0.35,0.08); return; }
  if (s==='egg'){ // dinosaur egg: pebbly shell, cracks, nested in sediment with shell shards
    const eg=welded(new THREE.SphereGeometry(0.17,64,48)); displace(eg,(v)=>{ v.y*=1.28; const b=Math.max(0,n3(v.x*70,v.y*70,v.z*70,3))*0.012; const l=v.length(); v.multiplyScalar((l+b)/l); });
    setColors(eg,(v,n,o)=>{ o.set(0xe4d4b4).lerp(col(0xb8a07a), clamp(-n.y*0.5+0.3,0,1)); o.offsetHSL(0,0,fbm(v.x*24,v.y*24,v.z*24,2)*0.06); const ck=Math.abs(n3(v.x*11,v.y*6,v.z*11,5)); if (ck<0.012 && v.y>0.02) o.lerp(col(0x6a5238),0.8); });
    const e=mesh(eg, vcPhys({ roughness:0.7, clearcoat:0.15 }), 0, top+0.13, 0, g); e.rotation.z=0.35;
    const rim=welded(new THREE.TorusGeometry(0.2,0.06,10,32)); displace(rim,v=>{ v.multiplyScalar(1+fbm(v.x*12,v.y*12,v.z*12,1)*0.1); }); setColors(rim,(v,n,o)=>{ o.set(0xc0aa84).offsetHSL(0,0,fbm(v.x*20,v.y*20,v.z*20,3)*0.08); });
    const rm=mesh(rim, vcMat({ roughness:0.95 }), 0, top+0.02, 0, g); rm.rotation.x=Math.PI/2; rm.scale.set(1,1,0.6);
    for (let i=0;i<4;i++){ const a=i*1.7+0.4; const sh=mesh(new THREE.SphereGeometry(0.05,10,6,0,1.3,0,1.1), new THREE.MeshPhysicalMaterial({ color:0xe0d0b0, roughness:0.7, side:THREE.DoubleSide }), Math.cos(a)*0.28, top+0.01, Math.sin(a)*0.2, g); sh.rotation.set(1.2+i*0.3,a,0.4); }
    return; }
  if (s==='urchin'){ // sea urchin test: five-fold petal star and rows of tubercles
    const ug=welded(new THREE.SphereGeometry(0.16,72,40)); displace(ug,v=>{ const l=v.length(), a=Math.atan2(v.z,v.x), up=v.y/l; v.y*= v.y<0?0.45:0.62; const petal=Math.max(0,Math.cos(a*5))**6*smooth(-0.2,0.7,up); const tub=Math.max(0,Math.sin(a*45)*Math.sin(up*42))**3; v.multiplyScalar(1+petal*0.04+tub*0.03); });
    setColors(ug,(v,n,o)=>{ const a=Math.atan2(v.z,v.x), up=clamp(v.y/0.1,-1,1); o.set(0xbfa27c).lerp(col(0xe6d2ae),clamp(n.y,0,1)*0.4); const petal=Math.max(0,Math.cos(a*5))**8*smooth(-0.1,0.8,up); o.lerp(col(0x8a6a4a), petal*0.55); if (Math.max(0,Math.cos(a*5))**8>0.6 && Math.sin(up*50)>0.6) o.offsetHSL(0,0,-0.1); });
    mesh(ug, vcPhys({ roughness:0.55, clearcoat:0.3 }), 0, top+0.07, 0, g); return; }
  if (s==='amber'){ // amber nugget with a tiny gnat and bubbles caught inside
    const ag=welded(new THREE.IcosahedronGeometry(0.17,4)); displace(ag,v=>{ v.multiplyScalar(1+fbm(v.x*5,v.y*5,v.z*5,7)*0.22); v.y*=0.8; });
    const am=new THREE.MeshPhysicalMaterial({ color:0xf0a030, roughness:0.08, transmission:0.6, thickness:0.3, transparent:true, opacity:0.78, clearcoat:1, emissive:0x6a3000, emissiveIntensity:0.35, ior:1.55, depthWrite:false });
    const inner=new THREE.Group(); inner.position.set(0,top+0.13,0); g.add(inner);
    const dark=new THREE.MeshStandardMaterial({ color:0x2a1608, roughness:0.6 });
    mesh(new THREE.SphereGeometry(0.018,10,8), dark, 0,0,0.02, inner, false).scale.set(1,0.9,1.4); mesh(new THREE.SphereGeometry(0.026,10,8), dark, 0,-0.004,-0.022, inner, false).scale.set(0.8,0.7,1.6);
    for (const s2 of [1,-1]){ const w=mesh(new THREE.CircleGeometry(0.04,10), new THREE.MeshStandardMaterial({ color:0x6a3a10, transparent:true, opacity:0.55, side:THREE.DoubleSide }), s2*0.035,0.012,-0.01, inner, false); w.rotation.set(-Math.PI/2,0,s2*0.4); w.scale.set(0.5,1,1);
      for (let i=0;i<3;i++) mesh(tube([V3(s2*0.008,0,0.01-i*0.012),V3(s2*0.03,-0.012,0.016-i*0.014),V3(s2*0.042,-0.03,0.02-i*0.016)],t=>0.002,4), dark, 0,0,0, inner, false); }
    for (let i=0;i<7;i++){ const b=mesh(new THREE.SphereGeometry(0.004+((i*7)%3)*0.003,8,6), new THREE.MeshPhysicalMaterial({ color:0xfff4d8, roughness:0, transparent:true, opacity:0.6 }), Math.sin(i*2.3)*0.09, Math.cos(i*1.7)*0.05, Math.cos(i*2.9)*0.08, inner, false); }
    const a=mesh(ag, am, 0, top+0.13, 0, g); a.renderOrder=2; return; }
}


// Merge every static mesh under root into one mesh per material (wings and tails stay separate so they can move).
// Keeps a caught fish or a tank of fish to a handful of draw calls instead of dozens.
function mergeStatic(root, keep){
  root.updateMatrixWorld(true); const inv=root.matrixWorld.clone().invert(), groups=new Map(), m4=new THREE.Matrix4();
  const skip=o=>{ for (let p=o; p && p!==root; p=p.parent) if (keep.has(p)) return true; return false; };
  root.traverse(o=>{ if (!o.isMesh || Array.isArray(o.material) || skip(o)) return; const geo=o.geometry, names=Object.keys(geo.attributes).sort().join(',');
    const k=o.material.uuid+'|'+names+'|'+(o.renderOrder||0); if (!groups.has(k)) groups.set(k,{ mat:o.material, list:[], cast:false, ro:o.renderOrder||0 }); const G=groups.get(k); G.list.push(o); G.cast=G.cast||o.castShadow; });
  for (const G of groups.values()){ if (G.list.length<2) continue;
    const names=Object.keys(G.list[0].geometry.attributes), parts={}, idx=[]; for (const n of names) parts[n]=[]; let base=0;
    for (const o of G.list){ m4.multiplyMatrices(inv, o.matrixWorld); const g=o.geometry.clone().applyMatrix4(m4); const cnt=g.attributes.position.count;
      for (const n of names) parts[n].push(g.attributes[n].array);
      if (g.index) for (const i of g.index.array) idx.push(i+base); else for (let i=0;i<cnt;i++) idx.push(i+base);
      base+=cnt; o.parent.remove(o); }
    const out=new THREE.BufferGeometry(); for (const n of names){ const sz=G.list[0].geometry.attributes[n].itemSize, len=parts[n].reduce((a,b)=>a+b.length,0), arr=new Float32Array(len); let off=0; for (const a of parts[n]){ arr.set(a,off); off+=a.length; } out.setAttribute(n,new THREE.BufferAttribute(arr,sz)); }
    out.setIndex(base>65535? new THREE.Uint32BufferAttribute(idx,1) : new THREE.Uint16BufferAttribute(idx,1)); out.computeBoundingSphere();
    const mm=new THREE.Mesh(out, G.mat); mm.castShadow=G.cast; mm.receiveShadow=true; mm.renderOrder=G.ro; root.add(mm); }
  // drop groups left empty
  const empties=[]; root.traverse(o=>{ if (o!==root && !o.isMesh && o.children.length===0 && !keep.has(o)) empties.push(o); }); for (const e of empties) e.parent && e.parent.remove(e);
}

/* ================= FISH ================= */
// species body proportions: depth (height of body vs length), flat (side-to-side), tail style, extras
const FISH_FORM = {
  minnow:{ H:0.13 }, silverbream:{ H:0.2, flat:0.38 }, sardine:{ H:0.12 }, coraldart:{ H:0.17, flat:0.42 }, mackerel:{ H:0.14, tail:'fork', finlets:true },
  snapper:{ H:0.18, spiny:true }, cod:{ H:0.15, barbel:true, dorsals:3 }, lanternfish:{ H:0.14 }, barrel:{ H:0.19 }, dace:{ H:0.13 }, carp:{ H:0.18, barbel:true }, smelt:{ H:0.11, adipose:true },
  trout:{ H:0.15, adipose:true }, darter:{ H:0.12, spiny:true, dorsals:2 }, salmon:{ H:0.16, adipose:true, hook:true }, pike:{ H:0.12, duck:true, rearDorsal:true }, char:{ H:0.15, adipose:true },
  bluegill:{ H:0.21, flat:0.38, spiny:true, ear:true }, killifish:{ H:0.12 }, goldfish:{ H:0.19, tail:'flowy' }, mooncarp:{ H:0.18, barbel:true }, koi:{ H:0.17, barbel:true, tail:'flowy' },
  shark:{ H:0.14, tail:'shark' }, sunfish:{ H:0.3, flat:0.35 }, flounder:{ H:0.2, flat:0.22 }, puffer:{ H:0.24, flat:0.9 }, eel:{ H:0.1 }, loach:{ H:0.1, barbel:true }, catfish:{ H:0.11, whisk:true },
};
// body radius along the fish (t: 0 snout .. 1 tail root): blunt rounded head, deep shoulders, narrow tail root
function profR(t, H, form){ const sh=form.duck?0.08:0.2;
  let r=H*Math.pow(Math.sin(Math.PI*clamp((t+0.004)/1.008,0,1)),form.duck?0.5:0.36)*(1-0.68*smooth(0.42,1,t));
  r*= 1 + 0.07*Math.exp(-((t-sh)**2)/0.012);
  if (form.duck) r*= smooth(-0.05,0.3,t)*0.62+0.38;
  return r; }
function fishBodyGeo(half, H, flat, form){
  // profile: blunt head, deep shoulders, narrow peduncle; built by lathe then squashed side to side
  const pts=[]; const N=48; for (let i=0;i<=N;i++){ const t=i/N; pts.push(new THREE.Vector2(Math.max(0.002,profR(t,H,form)), half-(t*2*half))); }
  const geo=new THREE.LatheGeometry(pts, 40); geo.rotateZ(-Math.PI/2);
  { const I=geo.index.array; for (let i=0;i<I.length;i+=3){ const t=I[i+1]; I[i+1]=I[i+2]; I[i+2]=t; } }   // the profile runs head to tail, which turns the lathe inside out: flip it
  { const uv=geo.attributes.uv; for (let i=0;i<uv.count;i++) uv.setY(i, 1-uv.getY(i)); }   // and the skin is painted head (v=0) to tail (v=1)
  // flatten sideways, slightly flatter belly than back, and a gentle downward mouth
  displace(geo, v=>{ v.z*=flat; if (v.y<0) v.y*=0.92; });
  return geo; }
// fin with visible rays: a fan shape. pts: list of [x,y] outline points (first = root front, last = root back), rays fan from root
function rayFin(outline, mat, rays=9, thick=0.0025){
  const shape=new THREE.Shape(); shape.moveTo(outline[0][0],outline[0][1]); for (let i=1;i<outline.length;i++){ const p=outline[i]; if (p.length===4) shape.quadraticCurveTo(p[0],p[1],p[2],p[3]); else shape.lineTo(p[0],p[1]); }
  const geo=new THREE.ShapeGeometry(shape, 10); geo.computeBoundingBox(); const b=geo.boundingBox, uv=geo.attributes.uv, p=geo.attributes.position;
  for (let i=0;i<p.count;i++) uv.setXY(i,(p.getX(i)-b.min.x)/((b.max.x-b.min.x)||1),(p.getY(i)-b.min.y)/((b.max.y-b.min.y)||1));
  const g=new THREE.Group(); const fm=mesh(geo, mat, 0,0,0, g, false); fm.renderOrder=1;
  // rays: thin ridges from the root out to the edge
  const root=V3((outline[0][0]+outline[outline.length-1][0])/2,(outline[0][1]+outline[outline.length-1][1])/2,0), pts=shape.getSpacedPoints(60);
  const rm=new THREE.MeshStandardMaterial({ color:0xffffff, transparent:true, opacity:0.5, roughness:0.5 }); rm.color.copy(mat.userData.rayC||col(0xffffff));
  for (let i=1;i<rays;i++){ const q=pts[Math.round(8+i/rays*36)]; if(!q) continue; mesh(tube([root.clone(), V3(q.x,q.y,0)], t=>thick*(1-t*0.6), 3, {caps:false}), rm, 0,0,0, g, false); }
  return g; }
function finMaterial(c, c2, id){ return once('fmat:'+c+':'+c2+':'+id, ()=>{ const m=finMat(c, c2).clone(); m.opacity=0.92; m.userData.rayC=col(c).offsetHSL(0,0.05,-0.12); return m; }); }
function fishEye(g, x, y, z, s, iris=0xd8b048){
  // a shallow lens set into the head: dark rim, gold iris, black pupil, two highlights. Kept flat so it never shows through the far side.
  for (const k of [1,-1]){ const e=new THREE.Group(); e.position.set(x, y, k*z); g.add(e);
    const ball=mesh(new THREE.SphereGeometry(0.03*s,24,16), ceramic(0x1a1612), 0,0,0, e, false); ball.scale.z=0.3;
    const ir=mesh(new THREE.SphereGeometry(0.025*s,24,16), ceramic(iris), 0,0,k*0.0025*s, e, false); ir.scale.z=0.3;
    const pu=mesh(new THREE.SphereGeometry(0.015*s,16,12), ceramic(0x080606), 0.002*s,0,k*0.005*s, e, false); pu.scale.z=0.28;
    mesh(new THREE.SphereGeometry(0.006*s,8,6), glintMat(), 0.008*s, 0.009*s, k*0.009*s, e, false); mesh(new THREE.SphereGeometry(0.003*s,6,5), glintMat(), -0.007*s, -0.006*s, k*0.008*s, e, false); } }
export function buildFishInto(g, d, id){ _buildFish(g,d,id); mergeStatic(g, new Set([g.userData.tail].filter(Boolean))); }
function _buildFish(g, d, id){
  id=id||'x'; const L=d.l*0.6, look=fishLook(id), skin=fishSkin(id,d), fin=finMaterial(look.fin||d.c, d.c2, id), form=FISH_FORM[id]||{};
  const special = { ray:buildRay, squid:buildSquid, octo:buildOcto, turtle:buildTurtle, cray:buildCray, tad:buildTadpole, horse:buildSeahorse }[d.s];
  if (special){ special(g,d,id,{skin,fin,look}); return; }
  const half=L*0.62, H=(form.H||0.15)*(d.s==='eel'?0.75:1)*clamp(0.7+L*0.4,0.8,1.15), flat=form.flat||(d.s==='eel'?0.62:0.48), y0=0.22;
  const bodyGeo=fishBodyGeo(half, H, flat, form); const body=mesh(bodyGeo, skin, 0, y0, 0, g);
  if (d.s==='puff'){ for (let i=0;i<60;i++){ const a=i*2.4, e=Math.acos(1-2*(i+0.5)/60), px=Math.cos(e)*half*0.75, py=Math.sin(e)*Math.cos(a)*H, pz=Math.sin(e)*Math.sin(a)*H*flat; const sp=mesh(new THREE.ConeGeometry(0.008,0.05,5), shellMat(d.c2), px, y0+py, pz, g, false); sp.lookAt(px*2, y0+py*3, pz*3); sp.rotateX(Math.PI/2); } }
  // lips: a small soft lip at the snout (the gill cover and mouth line are painted into the skin)
  const gx=half*0.42, mouthM=shellMat(col(d.c2).offsetHSL(0,0.08,-0.18).getHex(),{roughness:0.4});
  const lip=mesh(new THREE.SphereGeometry(H*0.13,12,8), mouthM, half*0.975, y0-H*0.14, 0, g, false); lip.scale.set(0.55,0.42,1.25*flat);
  if (form.ear) for (const k of [1,-1]){ const ef=mesh(new THREE.SphereGeometry(H*0.11,12,8), shellMat(0x101830), half*0.54, y0+H*0.08, k*H*flat*0.7, g, false); ef.scale.set(1.5,0.75,0.2); }
  // tail
  const ts=Math.min(1.25,0.65+L*0.5), style=form.tail||((look.flowy||d.s==='koi')?'flowy':d.s==='eel'?'eel':'normal');
  const tailPts = style==='flowy' ? [[0,0.03],[-0.12,0.24,-0.36,0.24],[-0.26,0.06,-0.36,0.0],[-0.26,-0.06,-0.36,-0.24],[-0.12,-0.24,0,-0.03]]
    : style==='fork' ? [[0,0.025],[-0.08,0.1,-0.22,0.21],[-0.14,0.02],[-0.22,-0.21],[-0.08,-0.1,0,-0.025]]
    : style==='shark' ? [[0,0.03],[-0.08,0.14,-0.2,0.3],[-0.13,0.04],[-0.17,-0.12],[0,-0.03]]
    : style==='eel' ? [[0,0.03],[-0.12,0.04,-0.18,0],[-0.12,-0.04,0,-0.03]]
    : [[0,0.025],[-0.1,0.12,-0.2,0.17],[-0.16,0.0],[-0.2,-0.17],[-0.1,-0.12,0,-0.025]];
  const tail=rayFin(tailPts, fin, 12); tail.position.set(-half+0.02, y0, 0); tail.scale.set(ts,ts,1); g.add(tail); g.userData.tail=tail;
  // dorsal fin(s)
  const dsc=Math.min(1.3,0.6+L*0.55)*(style==='flowy'?1.25:1);
  if (d.s==='eel'){ const df=rayFin([[half*0.6,0],[0,0.06,-half*0.95,0.0]], fin, 30); df.position.set(0,y0+H*0.8,0); g.add(df); const af=rayFin([[half*0.2,0],[-0.2,-0.05,-half*0.95,0]], fin, 20); af.position.set(0,y0-H*0.8,0); g.add(af); }
  else {
    const nD=form.dorsals||(form.spiny?2:1);
    if (form.spiny || nD>=2){ const sp=rayFin([[0.12,0],[0.1,0.1],[0.06,0.11],[0.02,0.1],[-0.02,0.08],[-0.04,0.03],[-0.05,0]], fin, 8, 0.003); sp.position.set(half*0.08, y0+H*0.92, 0); sp.scale.setScalar(dsc); g.add(sp);
      const so=rayFin([[0.04,0],[0.0,0.08,-0.12,0.07],[-0.16,0]], fin, 9); so.position.set(-half*0.18, y0+H*0.86, 0); so.scale.setScalar(dsc); g.add(so);
      if (nD>=3){ const s3=rayFin([[0.04,0],[0.0,0.06,-0.08,0.05],[-0.1,0]], fin, 7); s3.position.set(-half*0.5, y0+H*0.62, 0); s3.scale.setScalar(dsc); g.add(s3); } }
    else if (form.rearDorsal){ const df=rayFin([[0.06,0],[0.02,0.1,-0.1,0.09],[-0.14,0]], fin, 9); df.position.set(-half*0.55, y0+H*0.7, 0); df.scale.setScalar(dsc); g.add(df); }
    else { const df=rayFin(d.s==='shark'?[[0.07,0],[0.02,0.06,-0.04,0.2],[-0.1,0]]:[[0.11,0],[0.04,0.13,-0.1,0.1],[-0.16,0]], fin, 11); df.position.set(half*0.02, y0+H*0.9, 0); df.scale.setScalar(dsc); g.add(df); }
    if (form.adipose){ const ad=mesh(new THREE.SphereGeometry(0.03,10,8), shellMat(d.c), -half*0.62, y0+H*0.55, 0, g, false); ad.scale.set(1.2,0.7,0.25); }
    if (form.finlets) for (let i=0;i<4;i++) for (const sgn of [1,-1]){ const fl=mesh(new THREE.ConeGeometry(0.012,0.03,4), shellMat(d.c2), -half*(0.55+i*0.08), y0+sgn*H*(0.45-i*0.07), 0, g, false); fl.rotation.z=sgn>0?-0.8:Math.PI+0.8; }
    // anal fin (underneath, toward the tail)
    const an=rayFin([[0.06,0],[0.02,-0.08,-0.08,-0.07],[-0.12,0]], fin, 8); an.position.set(-half*0.38, y0-H*0.82, 0); an.scale.setScalar(dsc*0.85); g.add(an);
    // pelvic fins (pair, underneath, behind the head)
    for (const k of [1,-1]){ const pv=rayFin([[0.03,0],[-0.02,-0.06,-0.08,-0.05],[-0.06,0]], fin, 6); pv.position.set(half*0.12, y0-H*0.8, k*H*flat*0.4); pv.rotation.x=k*0.5; pv.scale.setScalar(dsc*0.8); g.add(pv); }
    // pectoral fins (pair, behind the gill cover)
    for (const k of [1,-1]){ const pf=rayFin([[0,0.014],[-0.04,0.06,-0.13,0.045],[-0.15,0.0,-0.11,-0.025],[0,-0.014]], fin, 10); pf.position.set(half*0.34, y0-H*0.18, k*H*flat*0.78); pf.rotation.set(k*0.2, k*0.3, -0.3); pf.scale.setScalar(Math.min(1.45,0.8+L*0.55)); g.add(pf); }
  }
  if (form.barbel||d.s==='cat') for (const k of [1,-1]){ const n=d.s==='cat'?2:1; for (let i=0;i<n;i++){ const pts=curve([[half*0.97,y0-H*0.22,k*H*flat*0.3],[half*1.05,y0-H*0.35-i*0.03,k*(H*flat*0.5+0.02)],[half*(d.s==='cat'?0.95:1.02),y0-H*0.55-i*0.06,k*(H*flat*0.7+(d.s==='cat'?0.12:0.02))]],8); mesh(tube(pts,t=>0.006*(1-t*0.7),5), shellMat(col(d.c).offsetHSL(0,0,-0.1).getHex()), 0,0,0,g,false); } }
  if (d.glow){ const stalk=curve([[half*0.5,y0+H*0.95,0],[half*0.75,y0+H*1.9,0],[half*1.05,y0+H*1.7,0]],10); mesh(tube(stalk,t=>0.006*(1-t*0.5),5), shellMat(d.c), 0,0,0,g,false); const lure=mesh(new THREE.SphereGeometry(0.03,14,10), new THREE.MeshStandardMaterial({ color:0xffe08a, emissive:0xffd060, emissiveIntensity:2.2 }), stalk[9].x, stalk[9].y-0.015, 0, g, false); }
  { const ex=half*0.64, t=(half-ex)/(2*half), R=profR(t,H,form), ey=H*0.2, es=Math.min(1.45,0.85+L*0.4);
    fishEye(g, ex, y0+ey, Math.sqrt(Math.max(0,R*R-ey*ey))*flat-0.004*es, es, d.s==='shark'?0x3a4048:look.pat==='gold'?0xe8c040:0xc8a050); }
}
function buildRay(g,d,id,{skin,fin}){
  const s=new THREE.Shape(); s.moveTo(0.42,0); s.bezierCurveTo(0.3,0.18,0.05,0.5,-0.14,0.48); s.bezierCurveTo(-0.12,0.25,-0.18,0.08,-0.3,0); s.bezierCurveTo(-0.18,-0.08,-0.12,-0.25,-0.14,-0.48); s.bezierCurveTo(0.05,-0.5,0.3,-0.18,0.42,0);
  const geo=new THREE.ExtrudeGeometry(s,{depth:0.02,bevelEnabled:true,bevelThickness:0.04,bevelSize:0.04,bevelSegments:6,curveSegments:24});
  geo.computeBoundingBox(); const b=geo.boundingBox, p=geo.attributes.position, uv=geo.attributes.uv; for (let i=0;i<p.count;i++) uv.setXY(i, 0.62+0.26*((p.getY(i)-b.min.y)/(b.max.y-b.min.y)), 1-((p.getX(i)-b.min.x)/(b.max.x-b.min.x)));
  displace(geo,v=>{ const r=Math.hypot(v.x*1.4,v.y); v.z+=Math.max(0,0.06-r*0.12); v.z+= Math.abs(v.y)>0.3? (Math.abs(v.y)-0.3)*0.25:0; }); geo.rotateX(Math.PI/2);
  mesh(geo, skin, 0,0.18,0, g); const t=curve([[-0.3,0.18,0],[-0.55,0.17,0.03],[-0.85,0.15,-0.02]],14); mesh(tube(t,t2=>0.016*(1-t2)+0.002,6), shellMat(d.c), 0,0,0,g);
  const barb=mesh(new THREE.ConeGeometry(0.01,0.07,5), shellMat(0x3a2a20), -0.5,0.19,0.03, g, false); barb.rotation.z=Math.PI/2;
  for (const k of [1,-1]){ mesh(new THREE.SphereGeometry(0.03,14,10), ceramic(0x2a2420), 0.2,0.24,k*0.07,g,false); mesh(new THREE.SphereGeometry(0.01,8,6), glintMat(), 0.21,0.26,k*0.075,g,false); const sp=mesh(new THREE.SphereGeometry(0.02,10,8), shellMat(col(d.c).offsetHSL(0,0,-0.15).getHex()), 0.14,0.23,k*0.08,g,false); sp.scale.set(1,0.5,1); }
}
function buildSquid(g,d,id,{skin,fin}){
  const glass=new THREE.MeshPhysicalMaterial({ color:d.c, transparent:true, opacity:0.62, roughness:0.1, iridescence:1, clearcoat:1, depthWrite:false });
  const mant=welded(new THREE.SphereGeometry(0.12,32,24)); displace(mant,v=>{ const t=(v.y+0.12)/0.24; v.y*=3.6; v.x*=0.9-t*0.4; v.z*=0.9-t*0.4; });
  const m=mesh(mant, glass, -0.02,0.24,0,g); m.rotation.z=-Math.PI/2;
  const inner=mesh(new THREE.SphereGeometry(0.075,16,12), skin, 0.0,0.24,0,g); inner.scale.set(3,1,1);
  for (const k of [1,-1]){ const f=rayFin([[0,0],[0.06,0.08,0.2,0.0]], fin, 10); f.position.set(-0.4,0.24,0); f.rotation.x=k*Math.PI/2; g.add(f); }
  mesh(new THREE.SphereGeometry(0.07,20,14), glass, 0.3,0.24,0,g).scale.set(1,0.9,1.05);
  for (let i=0;i<8;i++){ const a=i/8*TAU, r0=0.045; const pts=curve([[0.34,0.24+Math.cos(a)*r0,Math.sin(a)*r0],[0.5,0.24+Math.cos(a)*r0*1.4-0.02,Math.sin(a)*r0*1.5],[0.66,0.24+Math.cos(a)*r0*1.2-0.05+Math.sin(i)*0.03,Math.sin(a)*r0*1.8]],12);
    mesh(tube(pts,t=>0.014*(1-t*0.85),7), glass, 0,0,0,g,false); for (let k=2;k<10;k+=2) mesh(new THREE.SphereGeometry(0.004,6,4), ceramic(0xfff4ea), pts[k].x, pts[k].y-0.01, pts[k].z, g, false); }
  for (const k of [1,-1]){ const pts=curve([[0.34,0.22,k*0.02],[0.6,0.18,k*0.05],[0.82,0.16,k*0.03]],14); mesh(tube(pts,t=>0.007,6), glass, 0,0,0,g,false); const club=mesh(new THREE.SphereGeometry(0.02,12,8), glass, 0.84,0.16,k*0.03, g,false); club.scale.set(2.2,0.8,1); }
  fishEye(g, 0.3, 0.27, 0.066, 1.5, 0xd0d8e0);
}
function buildOcto(g,d,id,{skin}){
  const og=g; g=new THREE.Group(); g.scale.setScalar(0.72); og.add(g);
  const mant=welded(new THREE.SphereGeometry(0.24,40,30)); displace(mant,v=>{ v.y*=1.22; if (v.y>0) v.z-=v.y*0.25; v.multiplyScalar(1+fbm(v.x*14,v.y*14,v.z*14,4)*0.025); });
  mesh(mant, skin, 0,0.42,-0.05,g);
  const sucker=ceramic(col(d.c2).offsetHSL(0,0,0.06).getHex());
  for (let i=0;i<8;i++){ const a=i/8*TAU+0.2, ca=Math.cos(a), sa=Math.sin(a), curl=(i%2?1:-1)*0.6;
    const ctrl=[[ca*0.1,0.26,sa*0.1],[ca*0.3,0.08,sa*0.3],[ca*0.48,0.03,sa*0.48],[ca*0.6+(-sa)*curl*0.08,0.08,sa*0.6+ca*curl*0.08],[ca*0.58+(-sa)*curl*0.16,0.16,sa*0.58+ca*curl*0.16]];
    const pts=curve(ctrl,26); mesh(tube(pts,t=>0.06*(1-t)**1.1+0.006,10), skin, 0,0,0,g);
    for (let k=3;k<24;k+=2){ const p=pts[k], t=k/25, r=0.016*(1-t)+0.005; for (const q of [1,-1]){ const sd=V3(-sa,0,ca).multiplyScalar(q*r*0.9); const su=mesh(new THREE.SphereGeometry(r,8,6), sucker, p.x+sd.x, p.y-0.035*(1-t)-0.004, p.z+sd.z, g, false); su.scale.y=0.5; } } }
  // web between the arm roots
  const web=welded(new THREE.SphereGeometry(0.2,32,16,0,TAU,Math.PI*0.45,Math.PI*0.35)); mesh(web, skin, 0,0.28,0,g).scale.set(1.15,0.7,1.15);
  for (const k of [1,-1]){ const e=mesh(new THREE.SphereGeometry(0.06,16,12), skin, 0.15,0.48,k*0.12,g,false); e.scale.set(0.9,0.8,0.9); }
  fishEye(g, 0.19, 0.5, 0.135, 1.5, 0xe8c060);
}
function buildTurtle(g,d,id,{skin}){
  const shell=welded(new THREE.SphereGeometry(0.32,64,32,0,TAU,0,Math.PI/2)); displace(shell,v=>{ v.x*=1.15; v.y*=0.62;
    // raised scutes: hex cells
    const hx=v.x*6.5, hz=v.z*6.5, cx=Math.round(hx), cz=Math.round(hz+((cx%2)?0.5:0)), dd=Math.hypot(hx-cx, hz-cz+((cx%2)?0.5:0)); if (v.y>0.03) v.y+= Math.max(0,0.5-dd)*0.035; });
  setColors(shell,(v,n,o)=>{ const hx=v.x*6.5, hz=v.z*6.5, cx=Math.round(hx), cz=hz+((cx%2)?0.5:0), dd=Math.hypot(hx-cx, cz-Math.round(cz)); o.set(d.c).lerp(col(d.c2), clamp(0.45-dd,0,0.45)*0.7); if (dd>0.47) o.offsetHSL(0,0,-0.14); o.offsetHSL(0,0,Math.sin(dd*40)*0.02); o.offsetHSL(0,0,fbm(v.x*30,v.y*30,v.z*30,3)*0.04); });
  mesh(shell, vcPhys({ roughness:0.35, clearcoat:0.55 }), 0,0.1,0,g);
  const rim=mesh(new THREE.TorusGeometry(0.33,0.025,8,48), shellMat(col(d.c).offsetHSL(0,0,-0.1).getHex()), 0,0.105,0,g); rim.rotation.x=Math.PI/2; rim.scale.set(1.13,1,1);
  mesh(new THREE.CylinderGeometry(0.34,0.3,0.05,40), shellMat(d.c2), 0,0.085,0,g).scale.set(1.12,1,0.96);
  const skinM=shellMat(col(d.c2).offsetHSL(0,0,-0.1).getHex(),{ roughness:0.6 });
  const neck=curve([[0.3,0.11,0],[0.4,0.15,0],[0.47,0.18,0]],8); mesh(tube(neck,t=>0.06-t*0.01,10), skinM,0,0,0,g);
  const head=mesh(new THREE.SphereGeometry(0.075,20,14), skinM, 0.52,0.19,0,g); head.scale.set(1.3,0.85,0.9);
  const beak=mesh(new THREE.ConeGeometry(0.03,0.05,10), shellMat(0x3a3020), 0.61,0.18,0,g); beak.rotation.z=-Math.PI/2;
  for (const [x,z,r] of [[0.22,0.27,0.5],[0.22,-0.27,-0.5],[-0.22,0.25,2.6],[-0.22,-0.25,-2.6]]){ const f=mesh(new THREE.SphereGeometry(0.08,14,10), skinM, x,0.07,z,g); f.scale.set(1.6,0.35,0.7); f.rotation.y=r; for (let k=0;k<3;k++) mesh(new THREE.ConeGeometry(0.008,0.02,5), shellMat(0x3a3020), x+Math.cos(r)*0.11+Math.sin(r)*(k-1)*0.03, 0.065, z-Math.sin(r)*0.11+Math.cos(r)*(k-1)*0.03, g,false).rotation.z=-Math.PI/2; }
  const tl=mesh(new THREE.ConeGeometry(0.025,0.1,8), skinM, -0.4,0.09,0,g); tl.rotation.z=Math.PI/2;
  fishEye(g, 0.56, 0.21, 0.055, 0.6, 0x8a6a30);
}
function buildCray(g,d,id,{fin}){
  const shell=shellMat(d.c,{ clearcoat:1, roughness:0.3 }), light=shellMat(d.c2,{ clearcoat:0.8 });
  const cara=welded(new THREE.SphereGeometry(0.09,32,20)); displace(cara,v=>{ v.x*=1.7; v.z*=0.85; v.y*=0.8; v.multiplyScalar(1+fbm(v.x*60,v.y*60,v.z*60,2)*0.03); });
  mesh(cara, shell, 0.1,0.12,0,g);
  const ros=mesh(new THREE.ConeGeometry(0.02,0.08,8), shell, 0.27,0.13,0,g); ros.rotation.z=-Math.PI/2;
  for (let i=0;i<6;i++){ const r=0.07-i*0.008, s=mesh(new THREE.SphereGeometry(r,20,12,0,TAU,0,Math.PI*0.62), i%2?shell:light, -0.04-i*0.058,0.1,0,g); s.scale.set(0.75,0.8,1.05); mesh(new THREE.TorusGeometry(r*0.92,0.004,6,20,Math.PI), shell, -0.04-i*0.058+0.02,0.1,0,g).rotation.set(0,Math.PI/2,0); }
  // tail fan: five plates
  const fan=new THREE.Group(); fan.position.set(-0.4,0.1,0); g.add(fan); for (let i=0;i<5;i++){ const a=(i-2)*0.4; const p=mesh(new THREE.SphereGeometry(0.05,14,8), light, -Math.cos(a)*0.05, 0, Math.sin(a)*0.05, fan, false); p.scale.set(1.3,0.15,0.7); p.rotation.y=a; }
  for (const k of [1,-1]){
    const arm=curve([[0.16,0.11,k*0.05],[0.25,0.12,k*0.14],[0.35,0.12,k*0.18]],8); mesh(tube(arm,t=>0.022-t*0.006,8), shell,0,0,0,g,false);
    const claw=mesh(new THREE.SphereGeometry(0.06,18,12), shell, 0.44,0.12,k*0.2,g); claw.scale.set(1.5,0.55,0.8); claw.rotation.y=-k*0.3;
    for (const q of [1,-1]){ const fg=mesh(new THREE.ConeGeometry(0.018,0.12,8), shell, 0.55,0.12,k*0.2+q*0.022,g,false); fg.rotation.set(0,-k*0.3+q*0.15,-Math.PI/2); }
    for (let i=0;i<4;i++) leg(g, shell, [0.08-i*0.04,0.09,k*0.04], [0.06-i*0.045,0.13,k*0.13], [0.04-i*0.05,0.06,k*0.19], [0.03-i*0.05,0.005,k*0.22], 0.007);
    mesh(tube(curve([[0.24,0.14,k*0.02],[0.45,0.2,k*0.08],[0.7,0.18,k*0.2]],14),t=>0.004*(1-t*0.6),4), shell,0,0,0,g,false);
    mesh(tube(curve([[0.24,0.14,k*0.01],[0.3,0.17,k*0.04],[0.36,0.16,k*0.07]],6),t=>0.003,4), shell,0,0,0,g,false); }
  compoundEye(g, 0.24, 0.16, 0.035, 0.016); compoundEye(g, 0.24, 0.16, -0.035, 0.016);
}
function buildTadpole(g,d,id,{skin,fin}){
  const b=welded(new THREE.SphereGeometry(0.12,32,24)); displace(b,v=>{ v.x*=1.15; v.y*=0.85; if (v.x<0) v.x*=1.2; });
  mesh(b, skin, 0,0.12,0,g); const t=rayFin([[0.0,0.05],[-0.15,0.09,-0.4,0.0],[-0.15,-0.09,0,-0.05]], fin, 14); t.position.set(-0.06,0.12,0); g.add(t); g.userData.tail=t;
  mesh(tube(curve([[-0.05,0.12,0],[-0.25,0.12,0],[-0.43,0.12,0]],10),tt=>0.025*(1-tt)+0.002,8), skin,0,0,0,g,false);
  fishEye(g, 0.08, 0.16, 0.075, 0.85, 0xc8a040);
}
function buildSeahorse(g,d,id,{skin,fin}){
  const sp=curve([[0.0,0.62,0],[0.03,0.52,0],[0.0,0.4,0],[-0.04,0.28,0],[-0.02,0.16,0],[0.05,0.08,0],[0.09,0.03,0],[0.06,-0.0,0],[0.02,0.02,0]],40);
  const body=tube(sp, t=>0.075*Math.sin(Math.PI*clamp(t*1.25+0.08,0,1))**0.6*(1-t*0.75)+0.008, 14, { ring:(t,a)=>1+0.12*Math.max(0,Math.sin(t*150))*(Math.abs(Math.cos(a*2))*0.5+0.5) });
  const bm=mesh(body, skin, 0,0.04,0,g);
  const head=mesh(new THREE.SphereGeometry(0.07,20,14), skin, 0.04,0.72,0,g); head.scale.set(1.1,0.95,0.8);
  const snout=mesh(tube([V3(0.08,0.71,0),V3(0.2,0.69,0)],t=>0.028-t*0.008,10), skin, 0,0,0,g); mesh(new THREE.TorusGeometry(0.02,0.006,6,12), skin, 0.2,0.69,0,g).rotation.y=Math.PI/2;
  for (let i=0;i<5;i++){ const a=i/5*TAU; const c=mesh(new THREE.ConeGeometry(0.012,0.05,6), skin, 0.02+Math.cos(a)*0.03,0.8,Math.sin(a)*0.03,g,false); c.rotation.set(Math.sin(a)*0.4,0,-Math.cos(a)*0.4); }
  const df=rayFin([[0.04,0],[0.0,0.06,-0.06,0.05],[-0.08,0]], fin, 12); df.position.set(-0.07,0.44,0); df.rotation.z=1.2; g.add(df);
  for (let i=0;i<6;i++){ const c=mesh(new THREE.ConeGeometry(0.01,0.03,5), skin, -0.05-0.01*i, 0.62-i*0.07, 0, g, false); c.rotation.z=1.2; }
  fishEye(g, 0.07, 0.75, 0.055, 0.9, 0xe0a040);
}

/* ================= BUGS ================= */
function wingGeoHi(pts){ const s=new THREE.Shape(); s.moveTo(0,0); for (const p of pts){ if (p.length===4) s.quadraticCurveTo(p[0],p[1],p[2],p[3]); else if (p.length===6) s.bezierCurveTo(...p); else s.lineTo(p[0],p[1]); } s.lineTo(0,0);
  const g=new THREE.ShapeGeometry(s,24); g.computeBoundingBox(); const b=g.boundingBox, uv=g.attributes.uv, p=g.attributes.position; for (let i=0;i<p.count;i++) uv.setXY(i,(p.getX(i)-b.min.x)/((b.max.x-b.min.x)||1),(p.getY(i)-b.min.y)/((b.max.y-b.min.y)||1)); g.rotateX(-Math.PI/2); return g; }
const WING = {
  fore:{ fly:[[0.05,0.16,0.22,0.3,0.4,0.2],[0.44,0.12,0.42,0.02],[0.3,-0.02,0.12,-0.02]], moth:[[0.1,0.18,0.3,0.22,0.44,0.1],[0.44,0.0,0.38,-0.04],[0.2,-0.05,0.12,-0.04]], big:[[0.1,0.24,0.36,0.32,0.58,0.16],[0.6,0.02,0.52,-0.06],[0.3,-0.07,0.14,-0.05]] },
  hind:{ fly:[[0.06,-0.02],[0.28,-0.02,0.34,-0.14,0.26,-0.26],[0.16,-0.3,0.06,-0.16]], tails:[[0.06,-0.02],[0.3,-0.04,0.32,-0.16,0.24,-0.22],[0.22,-0.42],[0.17,-0.24],[0.05,-0.15]], long:[[0.06,-0.02],[0.28,-0.05,0.28,-0.18,0.2,-0.22],[0.2,-0.58],[0.13,-0.24],[0.04,-0.13]],
    moth:[[0.06,-0.03],[0.3,-0.02,0.34,-0.16,0.24,-0.2],[0.12,-0.2,0.06,-0.12]], big:[[0.06,-0.03],[0.4,-0.03,0.44,-0.24,0.32,-0.3],[0.16,-0.3,0.08,-0.17]] } };
// soft scalloped trailing edge: rebuilds the outline points along a bezier, then wobbles them
function bugWings(g, wings, mat, fore, hind, y, z, size){
  for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,y,z); p.scale.set(s*size,1,size); g.add(p);
    const f=mesh(wingGeoHi(fore), mat, 0,0.003,0, p, false), h=mesh(wingGeoHi(hind), mat, 0,0,0, p, false);
    p.userData.side=s; wings.push(p); } }
function bodySegments(g, mat, pts, rf, seg=14, rings=0){ const geo=tube(curve(pts, 24), rf, seg, rings?{ ring:(t)=>1-0.08*Math.max(0,Math.sin(t*Math.PI*rings*2))**4 }:{}); return mesh(geo, mat, 0,0,0, g); }
export function buildBugInto(g, d, id){ _buildBug(g,d,id); mergeStatic(g, new Set(g.userData.wings||[])); }
function _buildBug(g, d, id){
  const w=d.w, dark=shellMat(0x2a2420,{ roughness:0.35 }), wings=[]; g.userData.wings=wings; id=id||'x';
  const glow = d.glow ? new THREE.MeshStandardMaterial({ color:d.c2, emissive:d.c2, emissiveIntensity:1.8, roughness:0.4 }) : null;
  switch (w){
    case 'fly': case 'moth': {
      const L=wingLook(id), moth=w==='moth', fuzz=fuzzMat(moth?d.c:0x2a2420), fuzz2=fuzzMat(moth?col(d.c).offsetHSL(0,0,-0.12).getHex():0x3a3028);
      // abdomen with rings, furry thorax, head with big eyes and a curled proboscis
      bodySegments(g, fuzz2, [[0,0.32,0.06],[0,0.315,-0.02],[0,0.31,-0.1],[0,0.305,-0.16]], t=>0.038*Math.sin(Math.PI*clamp(t*0.9+0.12,0,1))**0.7+0.006, 12, 6);
      mesh(new THREE.SphereGeometry(0.045,18,14), fuzz, 0,0.325,0.07,g).scale.set(1,0.95,1.15);
      mesh(new THREE.SphereGeometry(0.03,16,12), fuzz, 0,0.33,0.125,g);
      compoundEye(g, 0.022,0.335,0.14, 0.017, moth?0x3a2a20:0x1a1418); compoundEye(g, -0.022,0.335,0.14, 0.017, moth?0x3a2a20:0x1a1418);
      if (!moth){ const pr=[]; for (let i=0;i<14;i++){ const a=i/13*TAU*1.6; pr.push(V3(0, 0.31-0.012*Math.sin(a)-i*0.0012, 0.15+0.012*Math.cos(a)+0.004)); } mesh(tube(pr,t=>0.0022,4), dark,0,0,0,g,false); }
      const mat=new THREE.MeshPhysicalMaterial({ map:wingTex(id,d), side:THREE.DoubleSide, roughness:0.55, sheen:1, sheenRoughness:0.6, sheenColor:col(0xffffff), iridescence:moth?0:0.4, iridescenceIOR:1.6, transparent:true, alphaTest:0.05,
        emissive: d.glow?0xffffff:0x000000, emissiveMap: d.glow?wingTex(id,d):null, emissiveIntensity:d.glow?0.35:0 });
      const fore=L.big?WING.fore.big:moth?WING.fore.moth:WING.fore.fly, hind=L.tails==='long'?WING.hind.long:L.tails?WING.hind.tails:L.big?WING.hind.big:moth?WING.hind.moth:WING.hind.fly;
      bugWings(g, wings, mat, fore, hind, 0.335, 0.06, moth?0.85:0.8);
      antennae(g, dark, [0,0.35,0.14], moth?0.12:0.17, moth?'feather':'club', 0.6, moth?0.003:0.0035);
      sixLegs(g, moth?fuzz2:dark, 0.3, 0.1, 0.035, 0.12, 0.0045);
      return; }
    case 'dragon': {
      const damsel=id==='damselfly', bodyM=shellMat(d.c,{ iridescence:1, iridescenceIOR:1.8, metalness:0.35, roughness:0.25 });
      bodySegments(g, bodyM, [[0,0.3,0.06],[0,0.3,-0.06],[0,0.3,-0.2],[0,0.305,-0.36]], t=>(damsel?0.012:0.018)*(1-t*0.35)+0.004, 10, 9);
      mesh(new THREE.SphereGeometry(0.035,18,14), bodyM, 0,0.305,0.09,g).scale.set(1,1.05,1.35);
      if (damsel){ compoundEye(g, 0.032,0.31,0.15, 0.018, 0x1a3a6a); compoundEye(g,-0.032,0.31,0.15,0.018,0x1a3a6a); }
      else { compoundEye(g, 0.02,0.315,0.15, 0.03, 0x1a3a5a); compoundEye(g,-0.02,0.315,0.15,0.03,0x1a3a5a); }
      const wm=clearWingMat(d.c2, damsel?null:0x3a3a3a);
      for (const [z,sz,ang] of [[0.1,damsel?0.26:0.34,0.08],[0.07,damsel?0.24:0.31,-0.12]]){ const fore=[[0.06,0.05,0.2,0.055,sz,0.03],[sz,-0.01,sz*0.9,-0.025],[0.25,-0.035,0.1,-0.03]];
        for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.31,z); p.scale.set(s,1,1); p.rotation.y=-s*ang; g.add(p); mesh(wingGeoHi(fore), wm, 0,0,0,p,false); p.userData.side=s; wings.push(p); } }
      sixLegs(g, dark, 0.29, 0.11, 0.03, 0.09, 0.004, { spines:[3,3,3] });
      antennae(g, dark, [0,0.33,0.16], 0.03, 'whip', 0.6, 0.002);
      return; }
    case 'bee': {
      const fz=fuzzMat(d.c), bk=fuzzMat(d.c2), f=d.fat?1.18:0.92;
      // striped furry abdomen, thorax, head with eyes, elbowed antennae
      for (let i=0;i<5;i++){ const r=0.085*f*Math.sin(Math.PI*clamp(0.25+i/5,0,1))**0.5; mesh(new THREE.SphereGeometry(r,20,16), i%2?bk:fz, 0,0.29,-0.02-i*0.042*f,g).scale.set(1,0.92,0.75); }
      mesh(new THREE.ConeGeometry(0.008,0.05,6), dark, 0,0.29,-0.25*f,g).rotation.x=-Math.PI/2;
      mesh(new THREE.SphereGeometry(0.075*f,22,18), fz, 0,0.31,0.07,g).scale.set(1,0.95,0.9);
      for (let i=0;i<40;i++){ const a=i*2.4, e=Math.acos(1-2*(i+0.5)/40), p=V3(Math.sin(e)*Math.cos(a),Math.cos(e),Math.sin(e)*Math.sin(a)).multiplyScalar(0.078*f); const h=mesh(new THREE.ConeGeometry(0.004,0.022,3), i%3?fz:bk, p.x, 0.31+p.y, 0.07+p.z, g, false); h.lookAt(p.x*3,0.31+p.y*3,0.07+p.z*3); h.rotateX(Math.PI/2); }
      mesh(new THREE.SphereGeometry(0.05,18,14), bk, 0,0.31,0.15,g).scale.set(1.15,1,0.8);
      compoundEye(g, 0.04,0.32,0.15, 0.022); compoundEye(g,-0.04,0.32,0.15,0.022);
      const wm=clearWingMat(0xf8f4ff);
      for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.375,0.06); p.scale.set(s,1,1); g.add(p); mesh(wingGeoHi([[0.06,0.05,0.16,0.05,0.21,0.01],[0.2,-0.03,0.12,-0.04],[0.05,-0.035,0.02,-0.02]]), wm,0,0.002,0,p,false); mesh(wingGeoHi([[0.05,-0.02,0.12,-0.02,0.14,-0.06],[0.1,-0.09,0.03,-0.05]]), wm,0,0,0,p,false); p.userData.side=s; wings.push(p); }
      antennae(g, dark, [0,0.34,0.18], 0.07, 'elbow', 0.6, 0.004);
      sixLegs(g, dark, 0.25, 0.1, 0.04, 0.13, 0.006, { scale:[0.9,1,1.2] });
      return; }
    case 'lady': {
      const sh=shellMat(d.c,{ clearcoat:1, clearcoatRoughness:0.04, roughness:0.2 }), sp=shellMat(d.c2,{ clearcoat:1 });
      for (const s of [1,-1]){ const el=mesh(new THREE.SphereGeometry(0.12,32,20,s>0?0:Math.PI,Math.PI,0,Math.PI/2), sh, s*0.003,0.17,-0.01,g); el.scale.set(1,0.85,1.18); }
      { const arc=[]; for (let i=0;i<=20;i++){ const a=-Math.PI/2+i/20*Math.PI*0.92; arc.push(V3(0, 0.17+Math.cos(a)*0.12*0.85+0.001, -0.01+Math.sin(a)*0.12*1.18)); } mesh(tube(arc,()=>0.0022,5), sp,0,0,0,g,false); }
      for (const [a,el,r] of [[0.5,0.5,0.028],[1.0,1.0,0.024],[2.2,0.75,0.026],[-0.5,0.5,0.028],[-1.0,1.0,0.024],[-2.2,0.75,0.026],[1.6,0.35,0.02],[-1.6,0.35,0.02]]){
        const p=V3(Math.sin(el)*Math.sin(a)*0.12, Math.cos(el)*0.12*0.85, Math.sin(el)*Math.cos(a)*0.12*1.18-0.01); const s2=mesh(new THREE.SphereGeometry(r,16,10), sp, p.x,0.17+p.y,p.z,g,false); s2.lookAt(p.x*3, 0.17+p.y*3, p.z*3); s2.scale.set(1,1,0.25); }
      const pr=mesh(new THREE.SphereGeometry(0.065,20,14,0,TAU,0,Math.PI/2), sp, 0,0.16,0.12,g); pr.scale.set(1.15,0.7,0.65);
      for (const s of [1,-1]) mesh(new THREE.SphereGeometry(0.022,12,8), ceramic(0xfff8ee), s*0.045,0.2,0.14,g,false).scale.set(1,0.6,0.7);
      mesh(new THREE.SphereGeometry(0.038,16,12), sp, 0,0.16,0.17,g).scale.set(1.1,0.75,0.8);
      for (const s of [1,-1]) mesh(new THREE.SphereGeometry(0.012,10,8), ceramic(0xffffff), s*0.025,0.175,0.195,g,false);
      antennae(g, dark, [0,0.17,0.2], 0.045, 'club', 0.7, 0.0025);
      sixLegs(g, dark, 0.13, 0.08, 0.06, 0.13, 0.006);
      return; }
    case 'mantis': {
      const orchid=id==='orchidmantis', bm=orchid?ceramic(d.c):shellMat(d.c,{ roughness:0.4 }), pm=orchid?ceramic(d.c2):shellMat(d.c2);
      bodySegments(g, bm, [[0,0.24,0.02],[0,0.23,-0.08],[0,0.22,-0.16],[0,0.24,-0.24]], t=>0.034*Math.sin(Math.PI*clamp(t*0.9+0.1,0,1))**0.6+0.006, 12, 6);
      const thorax=curve([[0,0.24,0.04],[0,0.3,0.12],[0,0.38,0.18]],10); mesh(tube(thorax,t=>0.016-t*0.004,8), bm,0,0,0,g);
      const head=mesh(new THREE.ConeGeometry(0.05,0.07,3), bm, 0,0.41,0.2,g); head.rotation.set(Math.PI*0.62,0,0); head.scale.set(1.25,1,0.7);
      compoundEye(g, 0.042,0.43,0.2, 0.017, orchid?0xd090b8:0x8ab858); compoundEye(g,-0.042,0.43,0.2,0.017, orchid?0xd090b8:0x8ab858);
      antennae(g, bm, [0,0.43,0.22], 0.14, 'whip', 0.5, 0.002);
      for (const s of [1,-1]){ // raptorial forelegs folded in prayer, with spines
        leg(g, bm, [s*0.015,0.36,0.16],[s*0.03,0.3,0.24],[s*0.025,0.36,0.23],[s*0.02,0.31,0.25], 0.011, 4); }
      for (const [z,sp] of [[0.06,0.17],[-0.02,0.21]]) for (const s of [1,-1]) leg(g, bm, [s*0.015,0.24,z],[s*sp*0.5,0.3,z+0.02],[s*sp*0.95,0.15,z-0.02],[s*sp*1.1,0.005,z-0.05], 0.0055);
      const wm=clearWingMat(orchid?0xffe0f0:d.c2);
      for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(s*0.004,0.26,0.05); p.scale.set(s,1,1); g.add(p); mesh(wingGeoHi([[0.03,-0.03],[0.05,-0.22,0.02,-0.3],[0.0,-0.28]]), wm,0,0,0,p,false); p.userData.side=s; wings.push(p); }
      if (orchid) for (const s of [1,-1]) for (let i=0;i<2;i++){ const pet=mesh(new THREE.SphereGeometry(0.07,20,12), pm, s*0.075,0.18,0.06-i*0.1,g); pet.scale.set(0.9,0.12,0.6); pet.rotation.z=s*0.3; }
      return; }
    case 'cicada': {
      const bm=shellMat(d.c,{ iridescence:0.4, roughness:0.35 });
      bodySegments(g, bm, [[0,0.24,0.05],[0,0.24,-0.05],[0,0.23,-0.15]], t=>0.075*Math.sin(Math.PI*clamp(t*0.8+0.2,0,1))**0.5+0.01, 16, 6);
      mesh(new THREE.SphereGeometry(0.07,22,16), bm, 0,0.27,0.08,g).scale.set(1.15,0.8,0.9);
      const hd=mesh(new THREE.SphereGeometry(0.055,20,14), bm, 0,0.26,0.15,g); hd.scale.set(1.6,0.7,0.7);
      compoundEye(g, 0.085,0.27,0.155, 0.024, 0x8a2a1a); compoundEye(g,-0.085,0.27,0.155,0.024,0x8a2a1a);
      for (const s of [-1,0,1]) mesh(new THREE.SphereGeometry(0.006,6,4), ceramic(0xe85a3a), s*0.015,0.3,0.15,g,false);
      const wm=clearWingMat(d.c2, null);
      for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(0,0.31,0.1); p.scale.set(s,1,1); p.rotation.z=s*-0.5; g.add(p); mesh(wingGeoHi([[0.1,-0.02,0.13,-0.18,0.08,-0.36],[0.03,-0.4],[0.0,-0.2]]), wm,0,0.002,0,p,false); mesh(wingGeoHi([[0.06,-0.04,0.09,-0.14,0.05,-0.2],[0.01,-0.12]]), wm,0,0,0,p,false); p.userData.side=s; wings.push(p); }
      sixLegs(g, bm, 0.2, 0.1, 0.045, 0.12, 0.007);
      antennae(g, dark, [0,0.27,0.19], 0.03, 'whip', 0.7, 0.002);
      return; }
    case 'hopper': {
      const bm=shellMat(d.c,{ roughness:0.4 }), lm=shellMat(d.c2,{ roughness:0.45 });
      bodySegments(g, bm, [[0,0.16,0.08],[0,0.155,-0.04],[0,0.15,-0.14],[0,0.16,-0.2]], t=>0.042*Math.sin(Math.PI*clamp(t*0.85+0.12,0,1))**0.5+0.006, 14, 7);
      const pr=mesh(new THREE.SphereGeometry(0.05,20,12,0,TAU,0,Math.PI*0.6), bm, 0,0.16,0.08,g); pr.scale.set(1,1.05,1.3);
      const hd=mesh(new THREE.SphereGeometry(0.048,20,14), bm, 0,0.18,0.16,g); hd.scale.set(0.95,1.15,0.9);
      compoundEye(g, 0.04,0.2,0.17, 0.016); compoundEye(g,-0.04,0.2,0.17,0.016);
      for (const s of [1,-1]) mesh(new THREE.BoxGeometry(0.01,0.025,0.012), dark, s*0.018,0.14,0.2,g,false); // mandibles
      antennae(g, bm, [0,0.22,0.19], id==='treecricket'||id==='cricket'?0.26:0.12, 'whip', 0.5, 0.0025);
      for (const s of [1,-1]){ // big jumping legs: thick femur, thin spiny tibia
        const fem=curve([[s*0.035,0.14,0.02],[s*0.07,0.19,-0.06],[s*0.08,0.21,-0.16]],8); mesh(tube(fem,t=>0.022*(1-t*0.55)+0.004,10), lm,0,0,0,g);
        leg(g, lm, [s*0.08,0.21,-0.16],[s*0.085,0.13,-0.1],[s*0.09,0.04,-0.05],[s*0.095,0.004,0.0], 0.007, 5); }
      for (const [z,sp] of [[0.12,0.1],[0.06,0.11]]) for (const s of [1,-1]) leg(g, bm, [s*0.02,0.13,z],[s*sp*0.5,0.17,z+0.03],[s*sp*0.9,0.08,z+0.04],[s*sp*1.05,0.005,z+0.06], 0.005);
      const wm=id==='cricket'?shellMat(d.c2):clearWingMat(d.c2);
      for (const s of [1,-1]){ const p=new THREE.Group(); p.position.set(s*0.01,0.2,0.06); p.scale.set(s,1,1); p.rotation.z=s*-0.35; g.add(p); mesh(wingGeoHi([[0.04,-0.02],[0.06,-0.2,0.04,-0.28],[0.0,-0.25]]), wm,0,0,0,p,false); p.userData.side=s; wings.push(p); }
      return; }
    case 'stick': {
      const bm=shellMat(d.c,{ roughness:0.7, clearcoat:0.1 });
      const pts=curve([[0,0.08,0.3],[0,0.085,0.15],[0,0.08,0],[0,0.082,-0.15],[0,0.075,-0.32]],40);
      mesh(tube(pts,t=>0.016*(1-Math.abs(t-0.4)*0.6), 8, { ring:(t,a)=>1+0.12*Math.max(0,Math.sin(t*90))**8+0.05*Math.sin(a*4) }), bm,0,0,0,g);
      for (let i=0;i<6;i++){ const k=mesh(new THREE.ConeGeometry(0.006,0.02,4), bm, (i%2?1:-1)*0.01, 0.095, 0.2-i*0.08, g, false); k.rotation.x=-0.6; }
      for (const [z,sp] of [[0.18,0.2],[0.03,0.17],[-0.08,0.19]]) for (const s of [1,-1]) leg(g, bm, [s*0.012,0.08,z],[s*sp*0.45,0.14,z+0.02],[s*sp*0.95,0.06,z+0.02],[s*sp*1.15,0.005,z+0.05], 0.0045);
      antennae(g, bm, [0,0.09,0.31], 0.16, 'whip', 0.4, 0.002);
      compoundEye(g, 0.012,0.095,0.3, 0.007, 0x4a3a20); compoundEye(g,-0.012,0.095,0.3,0.007,0x4a3a20);
      return; }
    case 'beetle': case 'stag': case 'rhino': {
      const irid = w!=='beetle' || id==='glowbug' ? 0.65 : 0.25, sh=shellMat(d.c,{ iridescence:irid, iridescenceIOR:1.9, metalness:0.3, roughness:0.22, clearcoat:1 }), hm=shellMat(d.c2,{ metalness:0.25, clearcoat:0.8 });
      for (const s of [1,-1]){ const eg=welded(new THREE.SphereGeometry(0.15,40,24,s>0?0:Math.PI,Math.PI,0,Math.PI/2)); displace(eg,v=>{ const a=Math.atan2(v.x,v.y); v.multiplyScalar(1-0.012*Math.max(0,Math.sin(a*26))**6); });
        const e=mesh(eg, sh, s*0.003,0.15,-0.04,g); e.scale.set(1,0.62,1.38); }
      { const arc=[]; for (let i=0;i<=22;i++){ const a=-Math.PI/2+i/22*Math.PI*0.95; arc.push(V3(0, 0.15+Math.cos(a)*0.15*0.62+0.001, -0.04+Math.sin(a)*0.15*1.38)); } mesh(tube(arc,()=>0.0026,5), dark,0,0,0,g,false); }
      const pr=mesh(new THREE.SphereGeometry(0.1,28,16,0,TAU,0,Math.PI/2), hm, 0,0.15,0.17,g); pr.scale.set(1.1,0.75,0.75);
      const hd=mesh(new THREE.SphereGeometry(0.058,20,14), hm, 0,0.15,0.25,g); hd.scale.set(1.15,0.7,0.85);
      compoundEye(g, 0.05,0.16,0.26, 0.016); compoundEye(g,-0.05,0.16,0.26,0.016);
      if (w==='stag') for (const s of [1,-1]){ const m=curve([[s*0.03,0.15,0.29],[s*0.08,0.165,0.36],[s*0.075,0.175,0.43],[s*0.035,0.18,0.48]],14); mesh(tube(m,t=>0.016*(1-t*0.7)+0.003,8), hm,0,0,0,g); for (const t of [0.4,0.6]){ const p=m[Math.round(t*13)]; const tooth=mesh(new THREE.ConeGeometry(0.006,0.025,5), hm, p.x, p.y, p.z, g, false); tooth.rotation.z=s*Math.PI/2; } }
      else for (const s of [1,-1]) mesh(new THREE.ConeGeometry(0.008,0.03,6), dark, s*0.015,0.14,0.3,g,false).rotation.x=Math.PI/2;
      if (w==='rhino'){ const hn=curve([[0,0.17,0.28],[0,0.25,0.36],[0,0.36,0.37],[0,0.4,0.33]],14); mesh(tube(hn,t=>0.024*(1-t*0.8)+0.003,10), hm,0,0,0,g); const fk=curve([[0,0.38,0.35],[0.012,0.42,0.34]],4); mesh(tube(fk,t=>0.004,5), hm,0,0,0,g); const tp=curve([[0,0.24,0.18],[0,0.3,0.24],[0,0.31,0.3]],8); mesh(tube(tp,t=>0.015*(1-t)+0.003,8), hm,0,0,0,g); }
      if (glow){ mesh(new THREE.SphereGeometry(0.07,16,12), glow, 0,0.15,-0.24,g).scale.set(1,0.7,0.8); }
      sixLegs(g, dark, 0.12, 0.15, 0.09, 0.17, 0.008, { spines:[2,2,3] });
      antennae(g, dark, [0,0.16,0.3], 0.07, 'elbow', 0.8, 0.004);
      return; }
    case 'pill': {
      const m=shellMat(d.c,{ iridescence:0.45, metalness:0.3, roughness:0.3 }), m2=shellMat(d.c2,{ iridescence:0.3, metalness:0.25 });
      for (let i=0;i<9;i++){ const t=i/8, r=0.1*Math.sin(Math.PI*clamp(0.15+t*0.85,0,1))**0.4; const s=mesh(new THREE.SphereGeometry(r,28,14,0,TAU,0,Math.PI/2), i%2?m:m2, 0,0.02,-0.18+i*0.045,g); s.scale.set(1.05,0.85,0.38); }
      const hd=mesh(new THREE.SphereGeometry(0.045,16,10,0,TAU,0,Math.PI/2), m, 0,0.02,0.2,g); hd.scale.set(1.2,0.7,0.7);
      antennae(g, m2, [0,0.04,0.22], 0.08, 'elbow', 1.2, 0.004);
      for (let i=0;i<7;i++) for (const s of [1,-1]) leg(g, m2, [s*0.05,0.025,0.14-i*0.045],[s*0.09,0.03,0.14-i*0.045],[s*0.105,0.012,0.15-i*0.045],[s*0.11,0.002,0.155-i*0.045],0.004);
      return; }
    case 'snail': {
      const shell=new THREE.Group(); shell.position.set(0,0.15,-0.05); g.add(shell);
      const pts=[]; for (let i=0;i<140;i++){ const t=i/139, a=t*TAU*3.3, r=0.009*Math.exp(a*0.105); pts.push(V3(Math.cos(a)*r, Math.sin(a)*r, -t*0.04)); }
      const sg=tube(pts, t=>0.0075*Math.exp(t*TAU*3.3*0.105)*0.98, 18, { ring:(t,a)=>1+0.03*Math.max(0,Math.sin(t*240)) });
      setColors(sg,(v,n,o,i)=>{ const t=Math.floor(i/19)/139; o.set(d.c).lerp(col(d.c).offsetHSL(0.02,0.1,-0.25), (Math.sin(t*TAU*3.2*1.0)*0.5+0.5)*0.0+ (Math.sin(t*50)>0.6?0.45:0)); o.offsetHSL(0,0,clamp(n.y,0,1)*0.08); });
      const sm=mesh(sg, vcPhys({ roughness:0.3, clearcoat:0.8 }), 0,0,0,shell); shell.rotation.set(0,Math.PI/2,0); shell.position.set(0,0.13,-0.04);
      const ft=welded(new THREE.CapsuleGeometry(0.04,0.28,8,16)); displace(ft,v=>{ v.multiplyScalar(1+fbm(v.x*60,v.y*60,v.z*60,3)*0.04); });
      const foot=mesh(ft, ceramic(d.c2), 0,0.04,0.03,g); foot.rotation.x=Math.PI/2; foot.scale.set(1.1,1,0.75);
      for (const s of [1,-1]){ const st=curve([[s*0.015,0.06,0.17],[s*0.025,0.12,0.2],[s*0.035,0.17,0.21]],8); mesh(tube(st,t=>0.008*(1-t*0.4),6), ceramic(d.c2),0,0,0,g,false); mesh(new THREE.SphereGeometry(0.011,10,8), ceramic(0x1a1410), s*0.035,0.175,0.212,g,false);
        mesh(tube(curve([[s*0.012,0.045,0.18],[s*0.025,0.05,0.22],[s*0.03,0.045,0.24]],6),t=>0.005,5), ceramic(d.c2),0,0,0,g,false); }
      return; }
    case 'crab': case 'hermit': {
      const sm=shellMat(d.c,{ clearcoat:0.9, roughness:0.3 }), lm=shellMat(col(d.c).offsetHSL(0,0,0.08).getHex(),{ clearcoat:0.7 });
      if (w==='hermit'){ const shell=new THREE.Group(); shell.position.set(0,0.13,-0.07); g.add(shell);
        const pts=[]; for (let i=0;i<120;i++){ const t=i/119, a=t*TAU*3.0, r=0.008*Math.exp(a*0.12); pts.push(V3(Math.cos(a)*r, Math.sin(a)*r, t*0.16)); }
        const sg=tube(pts, t=>0.0075*Math.exp(t*TAU*3.0*0.12)*0.95, 18, { ring:(t,a)=>1+0.06*Math.max(0,Math.sin(a*8))*t });
        setColors(sg,(v,n,o,i)=>{ const t=Math.floor(i/19)/119; o.set(d.c2).lerp(col(d.c2).offsetHSL(0.03,0.1,-0.2), Math.sin(t*80)>0.4?0.5:0); o.offsetHSL(0,0,clamp(n.y,0,1)*0.1); });
        mesh(sg, vcPhys({ roughness:0.35, clearcoat:0.6 }), 0,0,0,shell); shell.position.set(0,0.13,-0.24); shell.rotation.set(-0.35,0,0); }
      else { const ca=welded(new THREE.SphereGeometry(0.13,40,24)); displace(ca,v=>{ v.x*=1.35; v.y*=0.45; v.z*=1.0; if (v.z>0) v.z*=0.85; v.multiplyScalar(1+fbm(v.x*30,v.y*30,v.z*30,6)*0.02); });
        setColors(ca,(v,n,o)=>{ o.set(d.c).lerp(col(d.c).offsetHSL(0.02,0.05,-0.2), clamp(-n.y,0,1)); o.lerp(col(0xfff0e0), Math.max(0,n.y)*0.12); if (Math.abs(n3(v.x*20,v.y*20,v.z*20,2))<0.05) o.offsetHSL(0,0,-0.06); });
        mesh(ca, vcPhys({ roughness:0.3, clearcoat:0.8 }), 0,0.1,0,g); }
      for (const s of [1,-1]){ const big = w==='crab' && s>0 ? 1.9 : 1;
        const arm=curve([[s*0.1,0.1,0.07],[s*0.16,0.12,0.13],[s*0.19,0.12,0.17]],8); mesh(tube(arm,t=>0.018*Math.sqrt(big)-t*0.004,8), sm,0,0,0,g,false);
        const cl=mesh(new THREE.SphereGeometry(0.045*big,20,14), lm, s*(0.21+0.02*big),0.125,0.21,g); cl.scale.set(1.0,0.65,1.4);
        for (const q of [1,-1]){ const fg=mesh(new THREE.ConeGeometry(0.016*big,0.07*big,8), q>0?lm:sm, s*(0.21+0.02*big)+q*0.012*big, 0.125+q*0.008, 0.21+0.075*big, g,false); fg.rotation.x=Math.PI/2; fg.rotation.z=q*0.15; }
        for (let i=0;i<4;i++) leg(g, sm, [s*0.09,0.08,0.03-i*0.04],[s*0.17,0.13,0.04-i*0.05],[s*0.23,0.07,0.04-i*0.06],[s*0.25,0.005,0.05-i*0.07], 0.009);
        const st=curve([[s*0.03,0.13,0.11],[s*0.04,0.19,0.12],[s*0.045,0.22,0.12]],6); mesh(tube(st,t=>0.006,6), sm,0,0,0,g,false); compoundEye(g, s*0.045,0.225,0.12, 0.014); }
      antennae(g, sm, [0,0.12,0.13], 0.06, 'whip', 0.8, 0.002);
      return; }
    case 'skater': {
      const m=shellMat(d.c,{ roughness:0.35 }), m2=shellMat(d.c2);
      bodySegments(g, m, [[0,0.05,0.09],[0,0.05,0.0],[0,0.045,-0.08]], t=>0.016*Math.sin(Math.PI*clamp(t*0.9+0.1,0,1))**0.6+0.004, 10, 5);
      mesh(new THREE.SphereGeometry(0.014,12,10), m, 0,0.05,0.11,g); compoundEye(g, 0.012,0.055,0.115, 0.007); compoundEye(g,-0.012,0.055,0.115,0.007);
      for (const s of [1,-1]){ leg(g, m2, [s*0.01,0.04,0.07],[s*0.04,0.05,0.1],[s*0.06,0.03,0.12],[s*0.07,0.005,0.13],0.003);
        leg(g, m2, [s*0.01,0.045,0.02],[s*0.12,0.08,0.05],[s*0.26,0.03,0.08],[s*0.32,0.004,0.1],0.0035);
        leg(g, m2, [s*0.01,0.045,-0.01],[s*0.11,0.07,-0.08],[s*0.22,0.03,-0.16],[s*0.28,0.004,-0.2],0.0035);
        for (const [x,z] of [[0.32,0.1],[0.28,-0.2]]){ const dp=mesh(new THREE.RingGeometry(0.01,0.03,24), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.35, depthWrite:false }), s*x,0.003,z,g,false); dp.rotation.x=-Math.PI/2; } }
      antennae(g, m, [0,0.055,0.12], 0.06, 'whip', 0.6, 0.0018);
      return; }
  }
}
