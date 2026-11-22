// Painterly trees (v1.2). Canopies are clouds of hand-painted leaf clumps (alpha-cut cards) around a dark core,
// lit with normals that point out from the crown's center so each crown shades like one soft volume.
// Color lives in vertex colors, so every tree gets its own hue, value and light-to-shade gradient
// while all trees of a kind share one material (one draw call per canopy).
import * as THREE from 'three';

const TAU=Math.PI*2, CACHE=new Map();
const once=(k,f)=>{ if(!CACHE.has(k)) CACHE.set(k,f()); return CACHE.get(k); };
const srand=seed=>()=>{ seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };

/* ---------- Painted textures ---------- */
function paint(w,h,draw){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'),w,h); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t; }
const gray=v=>{ const k=Math.round(v*255); return `rgb(${k},${k},${k})`; };
// A clump of leaves painted in grays (vertex color does the tinting). The center is solid so the core can sample it.
function leafTex(kind){ return once('leaf:'+kind, ()=>paint(256,256,(x,W,H)=>{
  const r=srand(kind.length*977+13), cx=W/2, cy=H/2;
  x.fillStyle=gray(0.62); x.beginPath(); x.arc(cx,cy,W*0.2,0,TAU); x.fill();
  const leaf=(px,py,len,wid,ang,v)=>{ x.save(); x.translate(px,py); x.rotate(ang);
    if (kind==='needle'){ x.strokeStyle=gray(v); x.lineWidth=wid; x.lineCap='round'; x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(len*0.5,len*0.08,len,0); x.stroke(); }
    else { x.fillStyle=gray(v); x.beginPath(); x.moveTo(0,0); x.quadraticCurveTo(len*0.45,-wid,len,0); x.quadraticCurveTo(len*0.45,wid,0,0); x.fill();
      x.strokeStyle=gray(Math.max(0,v-0.22)); x.globalAlpha=0.5; x.lineWidth=1.2; x.beginPath(); x.moveTo(len*0.08,0); x.lineTo(len*0.85,0); x.stroke(); x.globalAlpha=1;
      x.fillStyle=gray(Math.min(1,v+0.12)); x.globalAlpha=0.35; x.beginPath(); x.ellipse(len*0.4,-wid*0.25,len*0.25,wid*0.25,0,0,TAU); x.fill(); x.globalAlpha=1; }
    x.restore(); };
  const N = kind==='needle'?150 : kind==='small'?80 : kind==='blossom'?80 : 42;
  for (let i=0;i<N;i++){ const a=r()*TAU, d=Math.sqrt(r())*W*0.32, px=cx+Math.cos(a)*d, py=cy+Math.sin(a)*d*0.9, ang=a+(r()-0.5)*1.2;
    const v=0.55+0.45*(1-d/(W*0.32))*0.5+r()*0.25;
    if (kind==='needle') leaf(px,py,22+r()*18,2.2,ang,v);
    else if (kind==='small') leaf(px,py,16+r()*10,7+r()*3,ang,v);
    else if (kind==='blossom'){ if (i%3) leaf(px,py,18+r()*8,8,ang,v); else { x.fillStyle=gray(Math.min(1,v+0.2)); for (let k=0;k<5;k++){ x.beginPath(); x.arc(px+Math.cos(k*1.256)*5,py+Math.sin(k*1.256)*5,4.5,0,TAU); x.fill(); } } }
    else leaf(px,py,42+r()*22,15+r()*6,ang,v); }
}));}
function frondTex(){ return once('frond', ()=>paint(64,256,(x,W,H)=>{ x.strokeStyle=gray(0.5); x.lineWidth=4; x.beginPath(); x.moveTo(W/2,0); x.lineTo(W/2,H); x.stroke();
  for (let i=0;i<34;i++){ const y=6+i*7.3, l=W*0.48*(1-Math.pow(i/34,2)*0.6); for (const s of [-1,1]){ x.strokeStyle=gray(0.7+((i*7)%5)*0.06); x.lineWidth=4.5; x.lineCap='round'; x.beginPath(); x.moveTo(W/2,y); x.quadraticCurveTo(W/2+s*l*0.6,y+3,W/2+s*l,y+14); x.stroke(); } } })); }
function barkTex(){ return once('bark', ()=>{ const t=paint(128,256,(x,W,H)=>{ const r=srand(91); x.fillStyle=gray(0.8); x.fillRect(0,0,W,H);
  for (let i=0;i<70;i++){ const px=r()*W, w=2+r()*6; x.strokeStyle=gray(0.45+r()*0.5); x.globalAlpha=0.6; x.lineWidth=w; x.beginPath(); x.moveTo(px,r()*H); x.bezierCurveTo(px+(r()-0.5)*10,r()*H,px+(r()-0.5)*10,r()*H,px+(r()-0.5)*6,r()*H); x.stroke(); }
  x.globalAlpha=1; }); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }); }
function birchTex(){ return once('birchbark', ()=>{ const t=paint(128,256,(x,W,H)=>{ const r=srand(7); x.fillStyle=gray(0.96); x.fillRect(0,0,W,H);
  for (let i=0;i<26;i++){ x.fillStyle=gray(0.15+r()*0.2); const y=r()*H, w=10+r()*40; x.beginPath(); x.ellipse(r()*W,y,w,1.5+r()*2.5,0,0,TAU); x.fill(); }
  for (let i=0;i<40;i++){ x.fillStyle=gray(0.8+r()*0.15); x.fillRect(r()*W,r()*H,1+r()*3,r()*20); } }); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }); }

/* ---------- Materials (shared) ---------- */
export function foliageMat(kind){ return once('fm:'+kind, ()=>{ const map=kind==='frond'?frondTex():leafTex(kind);
  const m=new THREE.MeshStandardMaterial({ map, vertexColors:true, alphaTest:0.42, side:THREE.DoubleSide, roughness:0.92 });
  m.userData.depth=new THREE.MeshDepthMaterial({ map, alphaTest:0.42, depthPacking:THREE.RGBADepthPacking, side:THREE.DoubleSide }); return m; }); }
export const barkMat = birch => once('bm:'+birch, ()=>new THREE.MeshStandardMaterial({ map:birch?birchTex():barkTex(), vertexColors:true, roughness:0.95 }));
export function leafy(mesh, mat){ mesh.material=mat; mesh.customDepthMaterial=mat.userData.depth; mesh.castShadow=true; mesh.receiveShadow=true; return mesh; }

/* ---------- Geometry builder ---------- */
class Geo { constructor(){ this.p=[]; this.n=[]; this.c=[]; this.uv=[]; this.i=[]; }
  vert(p,n,c,u,v){ this.p.push(p.x,p.y,p.z); this.n.push(n.x,n.y,n.z); this.c.push(c.r,c.g,c.b); this.uv.push(u,v); return this.p.length/3-1; }
  build(){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(this.uv,2)); g.setIndex(this.i); g.computeBoundingSphere(); return g; }
  // add a Three geometry, coloring each vertex with fn(position, normal) -> Color
  addGeo(geo, colorFn, uvFn){ const P=geo.attributes.position, N=geo.attributes.normal, U=geo.attributes.uv, base=this.p.length/3, a=new THREE.Vector3(), b=new THREE.Vector3();
    for (let k=0;k<P.count;k++){ a.fromBufferAttribute(P,k); b.fromBufferAttribute(N,k); const uv=uvFn?uvFn(a,k):[U.getX(k),U.getY(k)]; this.vert(a,b,colorFn(a,b),uv[0],uv[1]); }
    const I=geo.index; if (I) for (let k=0;k<I.count;k++) this.i.push(base+I.getX(k)); else for (let k=0;k<P.count;k++) this.i.push(base+k); }
}
const _v=new THREE.Vector3(), _t1=new THREE.Vector3(), _t2=new THREE.Vector3(), _up=new THREE.Vector3(0,1,0);
// One leaf card: centered at pos, facing normal dir, size w*h, rotated by spin around dir. Shading normal is `sn`.
function card(G, pos, dir, sn, w, h, spin, col){
  _t1.copy(Math.abs(dir.y)>0.95?_v.set(1,0,0):_up).cross(dir).normalize(); _t2.copy(dir).cross(_t1).normalize();
  const cs=Math.cos(spin), sn2=Math.sin(spin), ax=_t1.clone().multiplyScalar(cs).addScaledVector(_t2,sn2), ay=_t2.clone().multiplyScalar(cs).addScaledVector(_t1,-sn2);
  const b=G.p.length/3; for (const [u,v] of [[0,0],[1,0],[1,1],[0,1]]){ const p=pos.clone().addScaledVector(ax,(u-0.5)*w).addScaledVector(ay,(v-0.5)*h); G.vert(p,sn,col,u,v); }
  G.i.push(b,b+1,b+2,b,b+2,b+3);
}
// Per-tree palette: shift the season colors so neighbouring trees never match exactly
export function treeTint(r){ return { h:(r()-0.5)*0.06, s:(r()-0.5)*0.16, l:(r()-0.5)*0.1 }; }
function tone(hex, tint, extraL=0, extraH=0){ const c=new THREE.Color(hex); const hsl={}; c.getHSL(hsl); c.setHSL((hsl.h+tint.h+extraH+1)%1, THREE.MathUtils.clamp(hsl.s*(1+tint.s),0,1), THREE.MathUtils.clamp(hsl.l+tint.l+extraL,0.03,0.95)); return c; }

/* ---------- Canopy: crowns = [[x,y,z,radius], ...] ---------- */
export function canopyGeo(crowns, pal, r, tint, o={}){
  const G=new Geo(), dens=o.density||26, cardK=o.card||0.72, center=new THREE.Vector3();
  let top=-1e9, bot=1e9; for (const [,y,,s] of crowns){ top=Math.max(top,y+s); bot=Math.min(bot,y-s); }
  for (const [x,y,z,s] of crowns){ center.set(x,y,z);
    // dark core fills the gaps between clumps so light never shines through a crown
    const core=new THREE.IcosahedronGeometry(s*0.66,2); const cp=core.attributes.position;
    for (let k=0;k<cp.count;k++){ _v.fromBufferAttribute(cp,k); const n=1+(Math.sin(_v.x*5+r()*0.2)*Math.cos(_v.z*4)*0.08); _v.multiplyScalar(n); cp.setXYZ(k,_v.x+x,_v.y+y,_v.z+z); }
    core.computeVertexNormals();
    G.addGeo(core, (p,nm)=>{ const h=(p.y-bot)/(top-bot||1); return tone(pal[0],tint,-0.07+h*0.06,0.01); }, ()=>[0.5,0.5]);
    const n=Math.round(dens*s*s+10);
    for (let k=0;k<n;k++){
      const u=r()*2-1, a=r()*TAU, q=Math.sqrt(1-u*u); const d=new THREE.Vector3(q*Math.cos(a), u*0.9+0.08, q*Math.sin(a)).normalize();
      const pos=center.clone().addScaledVector(d, s*(0.6+r()*0.38));
      const sn=d.clone().addScaledVector(_up,0.35).normalize();                              // soft, slightly sky-facing shading
      const h=(pos.y-bot)/(top-bot||1), light=(d.y*0.5+0.5);
      const col=tone(pal[Math.floor(r()*pal.length)], tint, -0.1+light*0.14+h*0.06+(r()-0.5)*0.06, (r()-0.5)*0.025+(light-0.5)*0.015);
      const sz=s*cardK*(0.85+r()*0.45);
      const face=d.clone().addScaledVector(new THREE.Vector3(r()-0.5,r()-0.5,r()-0.5),0.7).normalize();
      card(G, pos, face, sn, sz, sz, r()*TAU, col); }
  }
  return G.build();
}

/* ---------- Conifer: tiers = [[y, radius, height], ...] ---------- */
export function coniferGeo(tiers, pal, r, tint){
  const G=new Geo(); const topY=tiers[tiers.length-1][0]+tiers[tiers.length-1][2]/2, botY=tiers[0][0]-tiers[0][2]/2;
  tiers.forEach(([y,R,H],ti)=>{
    const cone=new THREE.ConeGeometry(R*0.72,H*(ti===tiers.length-1?0.55:0.8),14,3,true); const cp=cone.attributes.position;
    for (let k=0;k<cp.count;k++){ _v.fromBufferAttribute(cp,k); const ang=Math.atan2(_v.z,_v.x), w=1+Math.sin(ang*7+ti)*0.06; cp.setXYZ(k,_v.x*w,_v.y+y-H*0.08,_v.z*w); } cone.computeVertexNormals();
    G.addGeo(cone, p=>tone(pal[0],tint,-0.05+((p.y-botY)/(topY-botY))*0.06), ()=>[0.5,0.5]);
    const n=Math.round(30*R*R+20);
    for (let k=0;k<n;k++){ const a=r()*TAU, t=0.06+Math.sqrt(r())*0.98;
      const out=new THREE.Vector3(Math.cos(a)*H, R, Math.sin(a)*H).normalize();
      const pos=new THREE.Vector3(Math.cos(a)*R*t, y+H*(0.5-t)-0.04, Math.sin(a)*R*t).addScaledVector(out,0.06);
      const sn=out.clone().addScaledVector(_up,0.3).normalize(), h=(pos.y-botY)/(topY-botY);
      const col=tone(pal[Math.floor(r()*pal.length)], tint, -0.08+h*0.1+t*0.05+(r()-0.5)*0.06, (r()-0.5)*0.02);
      const sz=(0.5+R*0.28)*(0.8+r()*0.4); card(G, pos, out.clone().addScaledVector(new THREE.Vector3(r()-0.5,r()-0.5,r()-0.5),0.5).normalize(), sn, sz, sz*0.85, r()*TAU, col); }
  });
  return G.build();
}

/* ---------- Trunk and branches, bent and flared, bark-tinted per tree ---------- */
export function trunkGeo(o, r){
  // o: { h, r0 (base radius), r1 (top radius), bend:[x,z], branches:[[y, angle, len, up]], color, flare }
  const G=new Geo(), col=new THREE.Color(o.color), seg=8;
  const bentAt=t=>new THREE.Vector3(o.bend[0]*t*t, t*o.h, o.bend[1]*t*t);
  const tube=(pts, r0, r1, vScale)=>{ const N=pts.length-1, base=G.p.length/3;
    for (let i=0;i<=N;i++){ const t=i/N, p=pts[i], dir=(i<N?pts[i+1].clone().sub(p):p.clone().sub(pts[i-1])).normalize();
      const a1=new THREE.Vector3().crossVectors(Math.abs(dir.y)>0.9?new THREE.Vector3(1,0,0):_up, dir).normalize(), a2=new THREE.Vector3().crossVectors(dir,a1);
      const rad=(r0+(r1-r0)*t)*(o.flare&&r0===o.r0 ? 1+0.55*Math.pow(1-t,6) : 1);
      for (let k=0;k<=seg;k++){ const ang=k/seg*TAU, nrm=a1.clone().multiplyScalar(Math.cos(ang)).addScaledVector(a2,Math.sin(ang)); const wob=1+Math.sin(ang*3+t*9)*0.05;
        const c=col.clone().multiplyScalar(0.82+0.3*t+(Math.sin(ang*2+i)*0.04)); G.vert(p.clone().addScaledVector(nrm,rad*wob), nrm, c, k/seg*1.5, t*vScale); } }
    for (let i=0;i<N;i++) for (let k=0;k<seg;k++){ const a=base+i*(seg+1)+k, b=a+seg+1; G.i.push(a,b,a+1, b,b+1,a+1); } };
  const pts=[]; for (let i=0;i<=8;i++) pts.push(bentAt(i/8)); tube(pts, o.r0, o.r1, o.h*0.6);
  for (const [by, ang, len, up] of o.branches||[]){ const s=bentAt(by/o.h), d=new THREE.Vector3(Math.cos(ang), up, Math.sin(ang)).normalize(), bp=[];
    for (let i=0;i<=4;i++){ const t=i/4; bp.push(s.clone().addScaledVector(d,len*t).add(new THREE.Vector3(0,len*0.25*t*t,0))); }
    const rb=o.rb||o.r1; tube(bp, rb*0.75, rb*0.25, len*0.6);
    if (o.twigs) for (const f of [0.55,0.9]){ const s2=bp[Math.round(f*4)], a2=ang+(r()-0.5)*1.8, d2=new THREE.Vector3(Math.cos(a2), 0.9+r()*0.6, Math.sin(a2)).normalize(), tp=[]; const l2=len*(0.35+r()*0.2);
      for (let i=0;i<=3;i++) tp.push(s2.clone().addScaledVector(d2,l2*i/3)); tube(tp, rb*0.3, rb*0.08, l2*0.6); } }
  return G.build();
}

/* ---------- Palm fronds ---------- */
export function frondsGeo(top, n, len, pal, r, tint){
  const G=new Geo();
  for (let f=0;f<n;f++){ const a=f/n*TAU+r()*0.3, droop=0.5+r()*0.5, L=len*(0.85+r()*0.3), W=0.55*L/2.2, segs=8, base=G.p.length/3;
    const dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a)), side=new THREE.Vector3(-Math.sin(a),0,Math.cos(a)), tw=(r()-0.5)*0.6;
    for (let i=0;i<=segs;i++){ const t=i/segs, p=top.clone().addScaledVector(dir,L*t).add(new THREE.Vector3(0,(0.35*t-droop*t*t)*L*0.6,0));
      const w=W*Math.sin(Math.min(1,t*1.4+0.12)*Math.PI*0.9), sd=side.clone().applyAxisAngle(dir,tw*t), nrm=new THREE.Vector3(0,1,0).applyAxisAngle(dir,tw*t).addScaledVector(dir,-0.2).normalize();
      const c=tone(pal[f%pal.length], tint, -0.08+t*0.1);
      G.vert(p.clone().addScaledVector(sd,-w),nrm,c,0,t); G.vert(p.clone().addScaledVector(sd,w),nrm,c,1,t); }
    for (let i=0;i<segs;i++){ const k=base+i*2; G.i.push(k,k+2,k+1, k+1,k+2,k+3); } }
  return G.build();
}
