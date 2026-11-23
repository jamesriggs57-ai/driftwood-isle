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
const LEAF_H={};
function leafH(kind,u,v){ const L=LEAF_H[kind]; if (!L) return 0.5; const S=L.S, x=((Math.floor(u*S)%S)+S)%S, y=((Math.floor(v*S)%S)+S)%S; return L.d[(y*S+x)*4]/255; }
// Seamless leaf skin: R = leaf albedo, G = leaf height (for bumps). Drawn wrapped so it tiles.
function leafSkin(kind){ return once('skin:'+kind, ()=>{ const S=512, cvA=document.createElement('canvas'), cvH=document.createElement('canvas'); cvA.width=cvA.height=cvH.width=cvH.height=S;
  const A=cvA.getContext('2d'), Hc=cvH.getContext('2d'), r=srand(kind==='needle'?77:kind==='small'?53:31);
  const needle=kind==='needle';
  A.fillStyle=needle?'rgb(70,70,70)':'rgb(150,150,150)'; A.fillRect(0,0,S,S); Hc.fillStyle=needle?'#000':'rgb(40,40,40)'; Hc.fillRect(0,0,S,S);
  const wrap=(x,y,f)=>{ for (const dx of [-S,0,S]) for (const dy of [-S,0,S]){ const px=x+dx, py=y+dy; if (px<-160||px>S+160||py<-160||py>S+160) continue; f(px,py); } };
  if (needle){
    // pine sprigs: a twig with crisp paired needles (herringbone), mostly drooping, layered
    for (let i=0;i<95;i++){ const x=r()*S, y=r()*S, ang=Math.PI/2+(r()-0.5)*0.9, len=110+r()*60, v=0.72+r()*0.28, nl=24+r()*8;
      wrap(x,y,(px,py)=>{ for (const [ctx,isH] of [[A,false],[Hc,true]]){ ctx.save(); ctx.translate(px,py); ctx.rotate(ang); ctx.lineCap='round';
        for (let t=6;t<len;t+=7){ const k=1-t/len*0.45, L=nl*k;
          for (const sd of [-1,1]){ ctx.beginPath(); ctx.moveTo(t,0); ctx.lineTo(t+L*0.55, sd*L*0.85);
            if (isH){ ctx.strokeStyle='rgb(255,255,255)'; ctx.lineWidth=3.2; ctx.stroke(); }
            else { const g=Math.round((v*(0.82+0.18*(t/len)))*255); ctx.strokeStyle='rgb(30,30,30)'; ctx.lineWidth=4.6; ctx.stroke(); ctx.strokeStyle=`rgb(${g},${g},${g})`; ctx.lineWidth=2.6; ctx.stroke(); } } }
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(len,0); ctx.strokeStyle=isH?'rgb(150,150,150)':'rgb(55,55,55)'; ctx.lineWidth=2.4; ctx.stroke(); ctx.restore(); } }); }
  } else {
    // big, clearly drawn leaves: dark outline, midrib and side veins, one half shaded so each leaf reads as folded
    const n=kind==='small'?520:300, L=[];
    for (let i=0;i<n;i++) L.push([r()*S, r()*S, Math.PI/2+(r()-0.5)*0.55, r(), r(), r()]);
    L.sort((p,q)=>q[1]-p[1]);   // lower leaves first, so each row overlaps the one below it like shingles
    for (const [x,y,ang,ra,rb,rc] of L){ const rr=[ra,rb,rc]; let qi=0; const r2=()=>rr[qi++]; { const len=(kind==='small'?52:84)+r2()*30, wid=len*(0.46+r2()*0.12), v=0.7+r2()*0.3;
      wrap(x,y,(px,py)=>{ for (const [ctx,isH] of [[A,false],[Hc,true]]){ ctx.save(); ctx.translate(px,py); ctx.rotate(ang);
        const half=(sd)=>{ ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.bezierCurveTo(-len/2,sd*wid*0.85,len*0.12,sd*wid*0.8,len/2,0); ctx.closePath(); };
        const leaf=()=>{ ctx.beginPath(); ctx.moveTo(-len/2,0); ctx.bezierCurveTo(-len/2,-wid*0.85,len*0.12,-wid*0.8,len/2,0); ctx.bezierCurveTo(len*0.12,wid*0.8,-len/2,wid*0.85,-len/2,0); };
        if (isH){ const g=ctx.createLinearGradient(0,-wid/2,0,wid/2); g.addColorStop(0,'rgb(60,60,60)'); g.addColorStop(0.5,'rgb(255,255,255)'); g.addColorStop(1,'rgb(60,60,60)'); leaf(); ctx.fillStyle=g; ctx.fill(); }
        else { const k=Math.round(v*255), k2=Math.round(v*0.8*255);
          half(-1); ctx.fillStyle=`rgb(${k},${k},${k})`; ctx.fill(); half(1); ctx.fillStyle=`rgb(${k2},${k2},${k2})`; ctx.fill();
          leaf(); ctx.strokeStyle='rgba(40,40,40,0.55)'; ctx.lineWidth=2.0; ctx.stroke();
          ctx.strokeStyle=`rgba(${k-80},${k-80},${k-80},0.55)`; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(-len*0.45,0); ctx.lineTo(len*0.42,0); ctx.stroke();
          ctx.strokeStyle=`rgba(${k-60},${k-60},${k-60},0.35)`; ctx.lineWidth=1.0; for (let q=-0.25;q<0.35;q+=0.17) for (const sd of [-1,1]){ ctx.beginPath(); ctx.moveTo(len*q,0); ctx.lineTo(len*(q+0.13),sd*wid*0.33); ctx.stroke(); }
          ctx.fillStyle='rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(-len*0.1,-wid*0.22,len*0.2,wid*0.13,0,0,TAU); ctx.fill(); }
        ctx.restore(); } }); } }
  }
  const a=A.getImageData(0,0,S,S).data, h=Hc.getImageData(0,0,S,S).data, out=A.createImageData(S,S);
  for (let i=0;i<a.length;i+=4){ out.data[i]=a[i]; out.data[i+1]=h[i]; out.data[i+2]=0; out.data[i+3]=255; }
  A.putImageData(out,0,0); LEAF_H[kind]={ d:h, S }; const t=new THREE.CanvasTexture(cvA); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.NoColorSpace; t.anisotropy=8; return t; }); }
// Leaf material: the leaf skin is projected from three sides (no seams, no stretching at the top) and used for both color and bumps.
function skinMat(kind){ const tex=leafSkin(kind), m=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.86, metalness:0, side:THREE.DoubleSide, shadowSide:THREE.BackSide });
  const scale = kind==='needle' ? 0.26 : kind==='small' ? 0.5 : 0.3, bump = kind==='needle' ? 1.6 : 2.4;
  m.onBeforeCompile=sh=>{ sh.uniforms.tLeaf={ value:tex }; sh.uniforms.leafScale={ value:scale }; sh.uniforms.leafBump={ value:bump };
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTPos; varying vec3 vTNrm; attribute float aLeaf; varying float vLeaf;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvTPos=position; vTNrm=normal; vLeaf=aLeaf;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D tLeaf; uniform float leafScale; uniform float leafBump; varying vec3 vTPos; varying vec3 vTNrm; varying float vLeaf;
vec4 triLeaf(){ vec3 bw=pow(abs(normalize(vTNrm)),vec3(4.0)); bw/=(bw.x+bw.y+bw.z); vec3 p=vTPos*leafScale;
  return texture2D(tLeaf,p.zy)*bw.x+texture2D(tLeaf,p.xz+0.37)*bw.y+texture2D(tLeaf,p.xy+0.71)*bw.z; }
vec3 leafPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection){
  vec3 vSigmaX=normalize(dFdx(surf_pos)), vSigmaY=normalize(dFdy(surf_pos)), vN=surf_norm;
  vec3 R1=cross(vSigmaY,vN), R2=cross(vN,vSigmaX); float fDet=dot(vSigmaX,R1)*faceDirection;
  vec3 vGrad=sign(fDet)*(dHdxy.x*R1+dHdxy.y*R2); return normalize(abs(fDet)*surf_norm-vGrad); }`)
      .replace('#include <map_fragment>','#include <map_fragment>\nvec4 lf=triLeaf(); diffuseColor.rgb*=mix(1.0, lf.r*1.45, 0.95*(1.0-vLeaf));')
      .replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=leafPerturb(-vViewPosition, normal, vec2(dFdx(lf.g),dFdy(lf.g))*leafBump*0.12*(1.0-vLeaf), faceDirection);'); };
  m.customProgramCacheKey=()=>'leafskin:'+kind; return m; }
export function foliageMat(kind){ return once('fm2:'+kind, ()=>skinMat(kind==='blossom'||kind==='frond'?'broad':kind)); }
function _oldFoliageMat(kind){
  return once('fm:'+kind, ()=>{ const map=frondTex();
  const m=new THREE.MeshStandardMaterial({ map, vertexColors:true, alphaTest:0.42, side:THREE.DoubleSide, roughness:0.92 });
  m.userData.depth=new THREE.MeshDepthMaterial({ map, alphaTest:0.42, depthPacking:THREE.RGBADepthPacking, side:THREE.DoubleSide }); return m; }); }
export const barkMat = birch => once('bm:'+birch, ()=>new THREE.MeshStandardMaterial({ map:birch?birchTex():barkTex(), vertexColors:true, roughness:0.95 }));
export function leafy(mesh, mat){ mesh.material=mat; if (mat.userData.depth) mesh.customDepthMaterial=mat.userData.depth; mesh.castShadow=true; mesh.receiveShadow=true; return mesh; }

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

/* ---------- Whole-tree foliage (v2) ----------
   A crown is ONE continuous sculpted surface: the crown spheres are melted together (smooth union),
   then shaped by seeded noise into big soft lobes with a leafy, scalloped skin. Nothing sits underneath it,
   nothing overlaps, and every tree gets its own noise, so no two crowns repeat.
   Shading is painted into vertex colors: sunlit top, cool shaded underside, darker creases between lobes. */
const _h3=(x,y,z,s)=>{ let h=(x*374761393+y*668265263+z*2147483647+s*144665)|0; h=Math.imul(h^(h>>>13),1274126177); return ((h^(h>>>16))>>>0)/4294967296; };
function vnoise3(x,y,z,s){ const xi=Math.floor(x), yi=Math.floor(y), zi=Math.floor(z), xf=x-xi, yf=y-yi, zf=z-zi;
  const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), w=zf*zf*(3-2*zf);
  const a0=_h3(xi,yi,zi,s), a1=_h3(xi+1,yi,zi,s), a2=_h3(xi,yi+1,zi,s), a3=_h3(xi+1,yi+1,zi,s), b0=_h3(xi,yi,zi+1,s), b1=_h3(xi+1,yi,zi+1,s), b2=_h3(xi,yi+1,zi+1,s), b3=_h3(xi+1,yi+1,zi+1,s);
  const x0=a0+(a1-a0)*u, x1=a2+(a3-a2)*u, x2=b0+(b1-b0)*u, x3=b2+(b3-b2)*u, y0=x0+(x1-x0)*v, y1=x2+(x3-x2)*v;
  return (y0+(y1-y0)*w)*2-1; }
const smin=(a,b,k)=>{ const h=Math.max(k-Math.abs(a-b),0)/k; return Math.min(a,b)-h*h*k*0.25; };
// An indexed, evenly subdivided sphere (shared vertices, so normals come out smooth)
function unitSphere(detail){ const src=new THREE.IcosahedronGeometry(1,detail), P=src.attributes.position, map=new Map(), dirs=[], idx=[];
  for (let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i), z=P.getZ(i), k=Math.round(x*1e4)+','+Math.round(y*1e4)+','+Math.round(z*1e4);
    let j=map.get(k); if (j===undefined){ j=dirs.length/3; map.set(k,j); dirs.push(x,y,z); } idx.push(j); }
  src.dispose(); return { dirs, idx }; }
function smoothNormals(pos, idx){ const n=new Float32Array(pos.length), a=new THREE.Vector3(), b=new THREE.Vector3(), c=new THREE.Vector3();
  for (let i=0;i<idx.length;i+=3){ const i0=idx[i]*3, i1=idx[i+1]*3, i2=idx[i+2]*3;
    a.set(pos[i1]-pos[i0],pos[i1+1]-pos[i0+1],pos[i1+2]-pos[i0+2]); b.set(pos[i2]-pos[i0],pos[i2+1]-pos[i0+1],pos[i2+2]-pos[i0+2]); c.crossVectors(a,b);
    for (const k of [i0,i1,i2]){ n[k]+=c.x; n[k+1]+=c.y; n[k+2]+=c.z; } }
  for (let i=0;i<n.length;i+=3){ const l=Math.hypot(n[i],n[i+1],n[i+2])||1; n[i]/=l; n[i+1]/=l; n[i+2]/=l; } return n; }
function geoFrom(pos, nrm, col, idx){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(nrm,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(pos.length/3*2),2)); g.setIndex(idx); g.computeBoundingSphere(); return g; }
const SPHERE = { };
const sphereOf = d => SPHERE[d] || (SPHERE[d]=unitSphere(d));

/* ---------- Leafy canopies (v3): a few big clumps, each its own full mass of leaves ----------
   Each clump is a rounded leafy volume with large leaves painted on its skin, plus real leaf shapes that
   poke out of its edges and hang off its underside. Clumps tuck into each other with a soft contact shadow. */
const _cU=new THREE.Vector3(0,1,0), _ca=new THREE.Vector3(), _cb=new THREE.Vector3(), _cc=new THREE.Vector3(), _cd=new THREE.Vector3();
// Adds one leaf (a pointed, slightly folded blade) to the arrays. base = where it attaches, axis = direction it points, face = which way its top faces.
function addLeaf(B, base, axis, face, L, W, cBase, cTip, fold=0.18, curl=0.0){
  const side=_ca.crossVectors(axis, face).normalize(), up=_cb.crossVectors(side, axis).normalize(), i0=B.pos.length/3;
  const pts=[[0,0,0],[0.32,-0.55,-0.02],[0.68,-0.42,-0.02],[1,0,curl],[0.68,0.42,-0.02],[0.32,0.55,-0.02],[0.45,0,fold]];  // along, across, lift
  for (const [a,c,l] of pts){ const k=a*a; B.pos.push(base.x+axis.x*a*L+side.x*c*W+up.x*(l*W - k*curl*L*0.6), base.y+axis.y*a*L+side.y*c*W+up.y*(l*W - k*curl*L*0.6), base.z+axis.z*a*L+side.z*c*W+up.z*(l*W - k*curl*L*0.6));
    const t=a; B.col.push(cBase.r+(cTip.r-cBase.r)*t, cBase.g+(cTip.g-cBase.g)*t, cBase.b+(cTip.b-cBase.b)*t); B.leaf.push(1); }
  for (const [p,q] of [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]]) B.idx.push(i0+6, i0+p, i0+q);
}
function finishGeo(B){ const P=new Float32Array(B.pos); const g=geoFrom(P, smoothNormals(P,B.idx), new Float32Array(B.col), B.idx); g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(new Float32Array(B.leaf),1)); return g; }

export function canopyGeo(crowns, pal, r, tint, o={}){
  const kind=o.kind||'broad', seed=Math.floor(r()*1e6), small=kind==='small';
  const B={ pos:[], col:[], idx:[], leaf:[] };
  let top=-1e9, bot=1e9; for (const [,y,,s] of crowns){ top=Math.max(top,y+s); bot=Math.min(bot,y-s); }
  const pc=pal.map(h=>new THREE.Color(h)), hsl={}, c=new THREE.Color(), cT=new THREE.Color();
  const shadeAt=(x,y,z,nx,ny,nz,base,extra)=>{ base.getHSL(hsl);
    const h=THREE.MathUtils.clamp((y-bot)/(top-bot||1),0,1), sun=Math.max(0,nx*0.35+ny*0.8+nz*0.3);
    let contact=0; for (const [cx,cy,cz,s] of crowns){ const d=Math.sqrt((x-cx)**2+(y-cy)**2+(z-cz)**2)/s; if (d<1.12) contact=Math.max(contact, 0); }
    const shd=Math.min(1,(1-h)*0.45 + (1-Math.max(0,ny))*0.35 + extra), warm=hsl.h<0.17||hsl.h>0.9;
    const L=hsl.l+tint.l-0.02+h*0.05+sun*0.12-shd*0.17, S=Math.min(hsl.s*(1+tint.s)*(0.95+sun*0.1)+shd*0.1,0.86), H=hsl.h+tint.h+(sun-0.5)*0.02+shd*(warm?-Math.min(0.02,Math.max(0,(hsl.h<0.5?hsl.h:0)-0.005)*0.6):0.03);
    return c.setHSL((H+1)%1, THREE.MathUtils.clamp(S,0,1), THREE.MathUtils.clamp(L,0.04,0.9)); };
  const { dirs, idx } = sphereOf(small?5:6), N=dirs.length/3;
  crowns.forEach(([cx,cy,cz,s],ci)=>{
    const base=pc[ci%pc.length].clone().lerp(pc[(ci+1)%pc.length], r()*0.5), off=r()*100, sq=0.86, i0=B.pos.length/3, P=new Float32Array(N*3);
    const rad=(dx,dy,dz)=>{ const e=s/Math.sqrt(dx*dx+(dy/sq)*(dy/sq)+dz*dz); return e*(1+vnoise3(dx*1.7+off,dy*1.7,dz*1.7,seed+ci)*0.11+vnoise3(dx*3.6,dy*3.6+off,dz*3.6,seed+ci+50)*0.05); };
    for (let i=0;i<N;i++){ let dx=dirs[i*3], dy=dirs[i*3+1], dz=dirs[i*3+2]; let R=rad(dx,dy,dz); if (dy<-0.5) R*=1-((-dy-0.5)/0.5)**2*0.25;   // softly flattened underside
      P[i*3]=cx+dx*R; P[i*3+1]=cy+dy*R; P[i*3+2]=cz+dz*R; }
    const NR=smoothNormals(P, idx);
    for (let i=0;i<N;i++){ const x=P[i*3], y=P[i*3+1], z=P[i*3+2];
      // contact shadow where this clump tucks into a neighbour
      let ct=0; crowns.forEach(([ox,oy,oz,os],j)=>{ if (j===ci) return; const d=Math.sqrt((x-ox)**2+((y-oy)/sq)**2+(z-oz)**2)/os; ct=Math.max(ct, THREE.MathUtils.clamp((1.35-d)/0.45,0,1)); });
      const col=shadeAt(x,y,z,NR[i*3],NR[i*3+1],NR[i*3+2],base, ct*0.5 + vnoise3(x*1.2+off,y*1.2,z*1.2,seed+7)*0.06);
      B.pos.push(x,y,z); B.col.push(col.r,col.g,col.b); B.leaf.push(0); }
    for (const k of idx) B.idx.push(i0+k);
    // real leaves around the edge and hanging underneath
    const nL=Math.round((small?18:14)*s+5);
    for (let k=0;k<nL;k++){ const u=r(), dy=u<0.8 ? -0.8+r()*0.85 : 0.05+r()*0.6, a=r()*TAU, q=Math.sqrt(Math.max(0,1-dy*dy)), dx=q*Math.cos(a), dz=q*Math.sin(a);
      const R=rad(dx,dy,dz)*0.9; _cc.set(cx+dx*R, cy+dy*R, cz+dz*R);
      const out=_cd.set(dx,dy,dz).normalize();
      // lie along the surface and hang: mostly downhill along the clump, only a little outward
      const downhill=_cU.clone().multiplyScalar(-1).addScaledVector(out, out.y).normalize();
      const axis=downhill.multiplyScalar(0.8).addScaledVector(out,0.45).add(new THREE.Vector3(r()-0.5,0,r()-0.5).multiplyScalar(0.5)).normalize();
      const face=out.clone().addScaledVector(_cU,0.3).normalize();
      const L=s*(small?0.34:0.5)*(0.85+r()*0.3), W=L*(small?0.5:0.58);
      const cb=shadeAt(_cc.x,_cc.y,_cc.z,dx,dy,dz,base,0.18).clone(); cT.copy(shadeAt(_cc.x,_cc.y,_cc.z,dx,Math.max(dy,0.2),dz,base,-0.12)); cT.offsetHSL(0,0,0.03);
      addLeaf(B, _cc.clone(), axis, face, L, W, cb, cT, 0.16, -0.05+r()*0.1); }
  });
  return finishGeo(B);
}

/* Pines: every tier is its own drooping skirt, fringed with needle sprays that stick out and hang off the rim. */
export function coniferGeo(tiers, pal, r, tint){
  const B={ pos:[], col:[], idx:[], leaf:[] }, c=new THREE.Color(), hsl={}, seed=Math.floor(r()*1e6);
  const botY=tiers[0][0]-tiers[0][2]/2, topY=tiers[tiers.length-1][0]+tiers[tiers.length-1][2]/2;
  const tone=(hex,L0,hOff=0)=>{ c.set(hex); c.getHSL(hsl); return new THREE.Color().setHSL((hsl.h+tint.h+hOff+1)%1, THREE.MathUtils.clamp(hsl.s*(1+tint.s),0,1), THREE.MathUtils.clamp(hsl.l+tint.l+L0,0.03,0.85)); };
  tiers.forEach(([y,R,H],ti)=>{ const last=ti===tiers.length-1, seg=36, rings=7, under=2, nS=6+Math.floor(r()*3), ph=r()*TAU, base=B.pos.length/3, ring=[], tips=[];
    const apex=y+H*(last?0.62:0.42), rim=y-H*0.5;
    const scal=th=>{ const a=0.5+0.5*Math.sin(th*nS+ph+vnoise3(th*1.5,ti,0,seed)*0.8); return Math.pow(a,1.6)*1.1-0.3; };
    for (let j=0;j<=rings+under;j++){ const row=[];
      for (let k=0;k<seg;k++){ const th=k/seg*TAU, s=scal(th); let rad, yy, top=true;
        if (j<=rings){ const u=j/rings; rad=R*Math.pow(u,1.05)*(1+0.14*s*u*u); yy=apex-(apex-rim)*Math.pow(u,0.9) - H*0.12*Math.max(0,s)*u*u*u; }
        else { const v=(j-rings)/under, rr=R*(1+0.14*s); rad=rr*(1-v*0.55); yy=rim-H*0.12*Math.max(0,s)+v*H*0.2; top=false; }
        if (j===0) rad=0.0001;
        B.pos.push(Math.cos(th)*rad, yy, Math.sin(th)*rad); const u=Math.min(1,j/rings), h=(yy-botY)/(topY-botY);
        let L=0.0+h*0.07; if (top){ if (!last) L-=(1-THREE.MathUtils.smoothstep(u,0.25,0.8))*0.1; L+=Math.max(0,s)*u*u*0.05; } else L+=0.02;
        const col=tone(pal[(ti+(s>0.4?1:0))%pal.length], L); B.col.push(col.r,col.g,col.b); B.leaf.push(0); row.push(base+j*seg+k);
        if (j===rings) tips.push([th, rad, yy, s]); }
      ring.push(row); }
    for (let j=0;j<rings+under;j++) for (let k=0;k<seg;k++){ const a=ring[j][k], b=ring[j][(k+1)%seg], c2=ring[j+1][k], d=ring[j+1][(k+1)%seg]; B.idx.push(a,c2,b, b,c2,d); }
  });
  return finishGeo(B);
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

/* ---------- Palm: a handful of big, flat, solid leaves ---------- */
export function frondsGeo(top, n, len, pal, r, tint){
  const B={ pos:[], col:[], idx:[], leaf:[] }, c=new THREE.Color(), hsl={}, count=Math.min(n,7), seg=14, across=4;
  const tone=(hex,L0,hOff=0)=>{ c.set(hex); c.getHSL(hsl); return new THREE.Color().setHSL((hsl.h+tint.h+hOff+1)%1, THREE.MathUtils.clamp(hsl.s*(1+tint.s),0,1), THREE.MathUtils.clamp(hsl.l+tint.l+L0,0.04,0.85)); };
  for (let f=0;f<count;f++){ const a=f/count*TAU+r()*0.35, L=len*(0.95+r()*0.3), droop=0.55+r()*0.35, W=L*0.3, base=B.pos.length/3, hex=pal[f%pal.length];
    const dir=new THREE.Vector3(Math.cos(a),0,Math.sin(a)), side=new THREE.Vector3(-Math.sin(a),0,Math.cos(a)), notch=4+Math.floor(r()*2), nph=r();
    for (let i=0;i<=seg;i++){ const t=i/seg, p=top.clone().addScaledVector(dir,L*t).add(new THREE.Vector3(0,L*(0.28*t-droop*t*t*0.75),0));
      let w=W*Math.sin(Math.PI*Math.min(1,t*1.08+0.02))*(1-0.3*t);
      const cut=Math.pow(Math.max(0,Math.sin((t*notch+nph)*Math.PI)),10)*0.45*Math.min(1,t*3); w*=1-cut;   // a few soft splits along the edge
      for (let j=0;j<=across;j++){ const v=j/across*2-1, fold=(1-Math.abs(v))*W*0.1*(1-t*0.5) - Math.abs(v)*W*0.08*t;   // raised midrib, edges drooping
        const q=p.clone().addScaledVector(side, v*w).add(new THREE.Vector3(0,fold,0)); B.pos.push(q.x,q.y,q.z);
        const col=tone(hex, -0.07+t*0.1-Math.abs(v)*0.05+(Math.abs(v)<0.3?0.04:0), Math.abs(v)<0.3?0.015:0); B.col.push(col.r,col.g,col.b); B.leaf.push(1); } }
    for (let i=0;i<seg;i++) for (let j=0;j<across;j++){ const k=base+i*(across+1)+j; B.idx.push(k,k+across+1,k+1, k+1,k+across+1,k+across+2); } }
  return finishGeo(B);
}
