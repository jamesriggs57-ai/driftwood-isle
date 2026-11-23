// v1.8 cottages: roofs with character (shingle courses, thatch, moss, gambrel), half-timbering, logs, stone,
// cute windows and doors. Used by the neighbors' homes and by the player's house builder (roofs and timber).
import * as THREE from 'three';
import { TAU, mulberry32, hashStr } from './util.js';
import { M, mk, G, windowMat, glowMat, addGlow, FURN_BUILDERS } from './models.js';

/* ---------- Textures and materials (cached) ---------- */
const col = (c, l=0, s=0) => new THREE.Color(c).offsetHSL(0, s, l).getHex();
const css = c => '#'+new THREE.Color(c).getHexString();
const TX = new Map(), MC = new Map();
function tex(kind, c){
  const key=kind+':'+c; if (TX.has(key)) return TX.get(key);
  const S=128, cv=document.createElement('canvas'); cv.width=cv.height=S; const x=cv.getContext('2d'), r=mulberry32(11);
  const f=(l)=>css(col(c,l)); x.fillStyle=css(c); x.fillRect(0,0,S,S);
  if (kind==='shingle'){            // two rows of round-bottomed shingles per tile
    x.fillStyle=f(-0.1); x.fillRect(0,0,S,S);
    for (let row=0; row<2; row++){ const y=row*64, off=row?16:0;
      for (let i=-32+off; i<S+32; i+=32){ x.fillStyle=f((r()-0.5)*0.06); x.beginPath(); x.moveTo(i+2,y); x.lineTo(i+30,y); x.lineTo(i+30,y+48); x.arc(i+16,y+48,14,0,Math.PI); x.closePath(); x.fill();
        x.fillStyle=f(0.06); x.fillRect(i+5,y+4,3,36); } }
  } else if (kind==='thatch'){
    for (let k=0;k<700;k++){ const px=r()*S, py=r()*S, h=10+r()*26; x.strokeStyle=f((r()-0.5)*0.22); x.lineWidth=1+r()*1.5; x.beginPath(); x.moveTo(px,py); x.lineTo(px+(r()-0.5)*3,py+h); x.stroke(); }
    for (let y=0;y<S;y+=32){ const g=x.createLinearGradient(0,y,0,y+32); g.addColorStop(0,'rgba(255,240,200,.10)'); g.addColorStop(0.8,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(60,30,0,.22)'); x.fillStyle=g; x.fillRect(0,y,S,32); }
  } else if (kind==='plaster'){
    for (let k=0;k<26;k++){ x.fillStyle=f((r()-0.5)*0.035); x.beginPath(); x.ellipse(r()*S,r()*S,10+r()*24,6+r()*14,r()*3,0,TAU); x.fill(); }
    for (let k=0;k<900;k++){ x.fillStyle=f((r()-0.5)*0.07); x.fillRect(r()*S,r()*S,2,2); }
  } else if (kind==='stone'){
    x.fillStyle=f(-0.22); x.fillRect(0,0,S,S);
    for (let y=0,row=0;y<S;y+=21,row++) for (let i=-(row%2)*18;i<S;i+=36){ const w=30+r()*6, h=17; x.fillStyle=f((r()-0.5)*0.16); x.beginPath(); x.roundRect?x.roundRect(i+2,y+2,w-4,h-2,7):x.rect(i+2,y+2,w-4,h-2); x.fill(); x.fillStyle='rgba(255,255,255,.12)'; x.fillRect(i+6,y+4,w-14,3); }
  } else if (kind==='board'){
    for (let i=0;i<S;i+=32){ x.fillStyle=f((r()-0.5)*0.06); x.fillRect(i,0,32,S); x.fillStyle=f(-0.14); x.fillRect(i,0,2,S); x.fillStyle=f(0.05); x.fillRect(i+13,0,6,S); }
    for (let k=0;k<6;k++){ x.fillStyle=f(-0.18); x.beginPath(); x.ellipse(r()*S,r()*S,2,4,0,0,TAU); x.fill(); }
  } else if (kind==='log'){
    for (let k=0;k<160;k++){ x.strokeStyle=f((r()-0.5)*0.12); x.lineWidth=1; const y=r()*S; x.beginPath(); x.moveTo(r()*S,y); x.lineTo(r()*S,y+(r()-0.5)*3); x.stroke(); }
  } else if (kind==='timber'){       // one tile per house-builder cell: posts, rails, a cross under the window
    const b=css(0x5a3c2a); x.fillStyle=b;
    x.fillRect(0,0,7,S); x.fillRect(S-7,0,7,S); x.fillRect(0,S-8,S,8); x.fillRect(0,0,S,7); x.fillRect(0,S*0.62,S,7);
    x.lineWidth=8; x.strokeStyle=b; x.beginPath(); x.moveTo(4,S*0.64); x.lineTo(S-4,S-6); x.moveTo(S-4,S*0.64); x.lineTo(4,S-6); x.stroke();
    x.lineWidth=6; x.beginPath(); x.moveTo(4,26); x.lineTo(24,4); x.moveTo(S-4,26); x.lineTo(S-24,4); x.stroke();
  }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; TX.set(key,t); return t;
}
export function tmat(kind, c, rx=1, ry=1, o){
  const key=kind+c+':'+rx.toFixed(2)+':'+ry.toFixed(2)+(o?JSON.stringify(o):'');
  if (!MC.has(key)){ const t=tex(kind,c).clone(); t.needsUpdate=true; t.repeat.set(rx,ry); MC.set(key, new THREE.MeshStandardMaterial(Object.assign({ map:t, roughness:0.92 }, o||{}))); }
  return MC.get(key);
}
// A box whose sides each repeat the texture by their own size
function tbox(kind, c, W, H, D, tile=1.2){
  const fr=tmat(kind,c,W/tile,H/tile), sd=tmat(kind,c,D/tile,H/tile), tp=M(col(c,-0.08));
  const m=new THREE.Mesh(G.box(W,H,D), [sd,sd,tp,tp,fr,fr]); m.castShadow=m.receiveShadow=true; return m;
}
const MOSS=[0x6f9a48,0x82ad54,0x5c8a3e,0x93b860];


/* ---------- Merge static pieces by material so a cottage costs a handful of draw calls, not hundreds ---------- */
export function mergeStatic(root, keep=[]){
  root.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(), rel=new THREE.Matrix4();
  const kept=o=>{ for (let p=o; p && p!==root; p=p.parent) if (keep.includes(p)) return true; return false; };
  const buckets=new Map(), dead=[];
  root.traverse(o=>{ if (!o.isMesh || Array.isArray(o.material) || kept(o) || !o.geometry.attributes.uv) return;
    const k=o.material.uuid+(o.castShadow?'s':''); if (!buckets.has(k)) buckets.set(k,{ mat:o.material, cast:o.castShadow, list:[] }); buckets.get(k).list.push(o); });
  for (const { mat, cast, list } of buckets.values()){ if (list.length<2) continue;
    const parts=list.map(o=>{ let g=o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); rel.multiplyMatrices(inv, o.matrixWorld); g.applyMatrix4(rel); return g; });
    let n=0; for (const g of parts) n+=g.attributes.position.count;
    const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let i=0;
    for (const g of parts){ pos.set(g.attributes.position.array, i*3); nor.set(g.attributes.normal.array, i*3); uv.set(g.attributes.uv.array, i*2); i+=g.attributes.position.count; g.dispose(); }
    const mg=new THREE.BufferGeometry(); mg.setAttribute('position',new THREE.BufferAttribute(pos,3)); mg.setAttribute('normal',new THREE.BufferAttribute(nor,3)); mg.setAttribute('uv',new THREE.BufferAttribute(uv,2)); mg.computeBoundingSphere();
    const m=new THREE.Mesh(mg, mat); m.castShadow=cast; m.receiveShadow=true; root.add(m); dead.push(...list); }
  for (const o of dead) o.parent && o.parent.remove(o);
  return root;
}

/* ---------- Roofs. Ridge runs along local x (or z with ridgeZ). Returns the height of the ridge top above o.y. ---------- */
// o: { style:'gable'|'steep'|'mossy'|'thatch'|'gambrel', L, S, y, c, trim, gableMat, moss, seed, ridgeZ, timber, beamC, gableWin, loft, finial }
export function cottageRoof(g, o){
  const grp=new THREE.Group(); g.add(grp); if (o.ridgeZ) grp.rotation.y=Math.PI/2;
  const L=o.L, S=o.S, r=mulberry32(o.seed||7), rake=0.32;
  if (o.style==='thatch'){ const h=thatchRoof(grp, o, L, S, r); mergeStatic(grp); return h; }
  const pitch = o.pitch || (o.style==='steep'||o.style==='mossy' ? 0.92 : 0.62), over=0.42, W=L+2*rake;
  const tr=M(o.trim), ca=tmat('shingle',o.c,W/0.62,1), cb=tmat('shingle',col(o.c,-0.05),W/0.62,1);
  const plane=(s, p, topZ, topY, len, flare)=>{
    const piv=new THREE.Group(); piv.position.set(0,topY,s*topZ); piv.rotation.x=s*p; grp.add(piv);
    mk(G.box(W,0.1,len), tr, 0,0.0,s*len/2, piv);
    const n=Math.max(3,Math.round(len/0.36)), cl=len/n;
    for (let k=0;k<n;k++){ const last=flare && k===n-1; const m=mk(G.box(W+0.02,0.08,cl+0.18+(last?0.12:0)), k%2?ca:cb, 0,0.1,s*((k+0.5)*cl+0.05+(last?0.06:0)), piv); m.rotation.x=-s*(last?0.24:0.07); }
    for (const e of [-1,1]) mk(G.box(0.1,0.26,len+0.06), tr, e*(W/2+0.04),0.04,s*len/2, piv);   // bargeboards
    return piv; };
  let ridgeY, prof;   // prof: gable outline points [z, y above o.y] from the left eave line to the ridge
  if (o.style==='gambrel'){
    const kz=S/2*0.56, kneeY=o.y+(S/2-kz)*Math.tan(1.12), lowLen=(S/2-kz+over*0.6)/Math.cos(1.12);
    ridgeY=kneeY+kz*Math.tan(0.44);
    for (const s of [1,-1]){
      const pv=new THREE.Group(); pv.position.set(0,kneeY,s*kz); grp.add(pv);
      const lo=new THREE.Group(); lo.rotation.x=s*1.12; pv.add(lo);
      mk(G.box(W,0.1,lowLen), tr, 0,0,s*lowLen/2, lo);
      const n=Math.max(3,Math.round(lowLen/0.36)), cl=lowLen/n;
      for (let k=0;k<n;k++){ const last=k===n-1; const m=mk(G.box(W+0.02,0.08,cl+0.18+(last?0.1:0)), k%2?ca:cb, 0,0.1,s*((k+0.5)*cl+0.05), lo); m.rotation.x=-s*(last?0.3:0.07); }
      for (const e of [-1,1]) mk(G.box(0.1,0.26,lowLen+0.06), tr, e*(W/2+0.04),0.04,s*lowLen/2, lo);
      plane(s, 0.44, 0, ridgeY, kz/Math.cos(0.44)+0.06, false);
      mk(G.box(W+0.1,0.12,0.16), tr, 0,kneeY+0.06,s*(kz+0.02), grp);
    }
    prof=[[-S/2,0],[-kz,kneeY-o.y],[0,ridgeY-o.y],[kz,kneeY-o.y],[S/2,0]];
  } else {
    ridgeY=o.y+(S/2)*Math.tan(pitch)+0.04; const len=(S/2+over)/Math.cos(pitch)+0.05;
    for (const s of [1,-1]) plane(s, pitch, 0, ridgeY, len, true);
    prof=[[-S/2,0],[0,ridgeY-o.y],[S/2,0]];
  }
  // ridge cap and finials
  const rc=mk(G.cyl(0.13,0.13,W+0.12,10), M(col(o.c,-0.09)), 0,ridgeY+0.15,0,grp); rc.rotation.z=Math.PI/2;
  for (const e of [-1,1]){ const f=new THREE.Group(); f.position.set(e*(W/2+0.06),ridgeY+0.12,0); grp.add(f); mk(G.sph(0.1,10,8), tr, 0,0.08,0,f); if (o.finial!==false) mk(G.cone(0.06,0.32,8), tr, 0,0.32,0,f); }
  // gable ends
  const sh=new THREE.Shape(); sh.moveTo(prof[0][0],prof[0][1]); for (let i=1;i<prof.length;i++) sh.lineTo(prof[i][0],prof[i][1]); sh.lineTo(prof[0][0],prof[0][1]);
  const gm=o.gableMat||M(0xfff6e6);
  for (const e of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(sh,{depth:0.1,bevelEnabled:false}), gm, e>0?L/2-0.1:-L/2, o.y, 0, grp); m.rotation.y=Math.PI/2; }
  const gh=ridgeY-o.y, fe=o.ridgeZ?-1:1;   // fe: which gable end faces the front of the house
  for (const e of [-1,1]){
    const face=new THREE.Group(); face.position.set(e*(L/2+0.01),o.y,0); face.rotation.y=e*Math.PI/2; grp.add(face);   // local +z = outward, local x across the gable
    if (o.timber){ const bm=M(o.beamC||0x5a3c2a);
      beam(face, 0,0.05, 0,gh-0.12, bm); beam(face, -S/2+0.05,0.06, S/2-0.05,0.06, bm);
      const cy=gh*0.42, cw=S/2*(1-0.42*(gh/(gh||1)))*0.98; beam(face, -cw+0.1,cy, cw-0.1,cy, bm);
      beam(face, -S/2*0.55,0.08, -0.05,cy, bm); beam(face, S/2*0.55,0.08, 0.05,cy, bm); }
    if (o.loft && e===fe){ const d=new THREE.Group(); d.position.set(0,gh*0.36,0.05); face.add(d); mk(G.box(0.9,0.85,0.06), M(0xfff6e6), 0,0,0,d); mk(G.box(0.74,0.7,0.06), M(0x8a5a3a), 0,0,0.03,d);
      for (const k of [-1,1]){ const x=mk(G.box(0.05,0.95,0.05), M(0xfff6e6), 0,0,0.07,d); x.rotation.z=k*0.82; } }
    else if (o.gableWin && (e===fe || o.gableWin==='both')) window1(face, 0, gh*0.4, 0.03, { type:'round', size:0.75 });
  }
  if (o.moss) mossRoof(grp, o, L, S, ridgeY, pitch, over, r);
  mergeStatic(grp);
  return ridgeY-o.y+0.28;
}
function beam(p, x1,y1, x2,y2, m, t=0.11){ const dx=x2-x1, dy=y2-y1, l=Math.hypot(dx,dy); const b=mk(G.box(l+t*0.6,t,0.07), m, (x1+x2)/2,(y1+y2)/2,0.035, p); b.rotation.z=Math.atan2(dy,dx); b.castShadow=false; return b; }
function clump(p, x,y,z, s, r, mat){ const n=2+Math.floor(r()*2); for (let i=0;i<n;i++){ const m=mk(G.ico(s*(0.6+r()*0.5),1), mat||M(MOSS[Math.floor(r()*MOSS.length)]), x+(r()-0.5)*s*1.4, y, z+(r()-0.5)*s*1.2, p); m.scale.y=0.42; m.castShadow=false; } }
function mossRoof(grp, o, L, S, ridgeY, pitch, over, r){
  const len=(S/2+over)/Math.cos(pitch), patches=Math.round(o.moss*L*1.9);
  for (const s of [1,-1]){
    const piv=new THREE.Group(); piv.position.set(0,ridgeY,0); piv.rotation.x=s*pitch; grp.add(piv);
    for (let i=0;i<patches;i++){ const cu=len*(0.35+Math.pow(r(),0.6)*0.62), cx=(r()-0.5)*(L+0.2), n=5+Math.floor(r()*7);
      for (let k=0;k<n;k++) clump(piv, cx+(r()-0.5)*0.7, 0.16, s*Math.min(len, cu+(r()-0.5)*0.5), 0.09+r()*0.08, r); }
    for (let x=-L/2; x<L/2; x+=0.22) if (r()<o.moss){ const d=mk(G.ico(0.1+r()*0.07,1), M(MOSS[Math.floor(r()*4)]), x, 0.06, s*(len+0.08), piv); d.scale.set(1.4,0.8,0.8); d.castShadow=false; }
  }
  for (let i=0;i<Math.round(o.moss*L*1.5);i++) clump(grp, (r()-0.5)*L, ridgeY+0.25, (r()-0.5)*0.22, 0.1, r);
}
function thatchRoof(grp, o, L, S, r){
  const pitch=o.pitch||0.8, over=0.5, rake=0.3, W=L+2*rake, ridgeY=o.y+(S/2)*Math.tan(pitch)+0.1, len=(S/2+over)/Math.cos(pitch);
  const th=tmat('thatch',o.c,W/1.1,len/0.9), thR=tmat('thatch',col(o.c,-0.04),3,1), dark=M(col(o.c,-0.22));
  for (const s of [1,-1]){
    const piv=new THREE.Group(); piv.position.set(0,ridgeY,0); piv.rotation.x=s*pitch; grp.add(piv);
    mk(G.box(W,0.42,len), th, 0,0.12,s*len/2, piv);
    const ev=mk(G.cyl(0.26,0.26,W,14), thR, 0,0.06,s*len, piv); ev.rotation.z=Math.PI/2;
    for (const e of [-1,1]){ const rr=mk(G.cyl(0.24,0.24,len,12), thR, e*W/2,0.1,s*len/2, piv); rr.rotation.x=Math.PI/2; mk(G.sph(0.27,12,10), thR, e*W/2,0.07,s*len, piv); }
    // ridge band with a scalloped edge
    for (let i=0, n=Math.round(W/0.34); i<n; i++){ const sc=mk(G.sph(0.17,10,6,0,TAU,0,Math.PI/2), dark, -W/2+0.17+i*(W-0.34)/(n-1), 0.3, s*0.58, piv); sc.scale.set(1,0.5,1.25); sc.castShadow=false; }
    mk(G.box(W+0.04,0.16,1.12), M(col(o.c,-0.12)), 0,0.33,0, piv);
    if (o.moss){ for (let i=0;i<Math.round(o.moss*L);i++){ const cx=(r()-0.5)*(L+0.2), cu=len*(0.45+r()*0.5); for (let k=0;k<5;k++) clump(piv, cx+(r()-0.5)*0.6, 0.35, s*(cu+(r()-0.5)*0.4), 0.1+r()*0.08, r); } }
  }
  const rc=mk(G.cyl(0.34,0.34,W+0.06,14), tmat('thatch',col(o.c,-0.1),3,1), 0,ridgeY+0.38,0,grp); rc.rotation.z=Math.PI/2;
  for (const s of [1,-1]){ const lg=mk(G.cyl(0.03,0.03,W+0.1,5), M(0x6a4a2a), 0,ridgeY+0.46,s*0.31,grp); lg.rotation.z=Math.PI/2; }
  for (const e of [-1,1]) mk(G.sph(0.35,14,10), tmat('thatch',col(o.c,-0.1),1,1), e*(W/2+0.02),ridgeY+0.38,0,grp);
  const sh=new THREE.Shape(); sh.moveTo(-S/2,0); sh.lineTo(S/2,0); sh.lineTo(0,ridgeY-o.y); sh.lineTo(-S/2,0);
  for (const e of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(sh,{depth:0.1,bevelEnabled:false}), o.gableMat||M(0xfff6e6), e>0?L/2-0.1:-L/2, o.y, 0, grp); m.rotation.y=Math.PI/2;
    const face=new THREE.Group(); face.position.set(e*(L/2+0.01),o.y,0); face.rotation.y=e*Math.PI/2; grp.add(face);
    if (o.timber){ const bm=M(o.beamC||0x5a3c2a); beam(face,0,0.05,0,ridgeY-o.y-0.2,bm); beam(face,-S/2+0.05,0.06,S/2-0.05,0.06,bm); }
    if (o.gableWin && (e===(o.ridgeZ?-1:1) || o.gableWin==='both')) window1(face, 0, (ridgeY-o.y)*0.4, 0.03, { type:'round', size:0.7 }); }
  return ridgeY-o.y+0.72;
}

/* ---------- Windows ---------- */
// type: 'cross' | 'round' | 'arched' | 'tall'.  shut: shutter color or null.  box: flower box
export function window1(p, x, y, z, o={}){
  const w0=new THREE.Group(); w0.position.set(x,y,z); p.add(w0); const s=o.size||1, fr=M(o.frame||0xffffff), type=o.type||'cross';
  let w=0.66*s, h=0.74*s;
  if (type==='round'){ const rr=0.32*s; const ring=mk(G.tor(rr+0.03,0.07,8,20), fr, 0,0,0.04,w0); ring.castShadow=false; mk(G.cyl(rr,rr,0.05,20), windowMat, 0,0,0.01,w0).rotation.x=Math.PI/2;
    mk(G.box(0.045,rr*2,0.05),fr,0,0,0.05,w0); mk(G.box(rr*2,0.045,0.05),fr,0,0,0.05,w0); w=h=rr*2; }
  else {
    if (type==='tall'){ w=0.56*s; h=1.0*s; }
    mk(G.box(w+0.14,h+0.14,0.07), fr, 0,0,0,w0); mk(G.box(w,h,0.05), windowMat, 0,0,0.03,w0);
    mk(G.box(0.045,h,0.06),fr,0,0,0.05,w0); mk(G.box(w,0.045,0.06),fr,0,type==='tall'?h*0.18:0,0.05,w0);
    if (type==='arched'){ const a=mk(G.cyl(w/2+0.07,w/2+0.07,0.07,16,1,false,0,Math.PI), fr, 0,h/2,0,w0); a.rotation.set(Math.PI/2,0,Math.PI/2); a.rotation.order='ZXY'; mk(new THREE.CircleGeometry(w/2,16,0,Math.PI), windowMat, 0,h/2,0.035,w0); }
    // sill and a little header
    mk(G.box(w+0.34,0.08,0.18), M(o.sill||col(o.frame||0xffffff,-0.12)), 0,-h/2-0.1,0.07,w0);
    if (type!=='arched') mk(G.box(w+0.3,0.1,0.12), M(o.header||col(o.frame||0xffffff,-0.12)), 0,h/2+0.11,0.04,w0);
  }
  if (o.shut!=null && type!=='round'){ const sc=M(o.shut), dk=M(col(o.shut,-0.16));
    for (const k of [-1,1]){ const sx=k*(w/2+0.18*s); mk(G.box(0.22*s,h+0.06,0.05), sc, sx,0,0.02,w0);
      for (const yy of [-h/2+0.1, h/2-0.1]) mk(G.box(0.17*s,0.04,0.06), dk, sx,yy,0.03,w0);
      const hs=heart(); const hm=mk(new THREE.ShapeGeometry(hs), dk, sx,0.02,0.052,w0); hm.scale.setScalar(0.07*s); hm.castShadow=false; } }
  if (o.box){ mk(G.box(w+0.2,0.17,0.24), M(0x8b5e3a), 0,-h/2-0.2,0.15,w0); const fc=o.flowers||[0xff7f7f,0xffd04d,0xffffff,0xc7a0ff,0xff9ec4];
    for (let k=0;k<5;k++){ mk(G.ico(0.065,1), M(0x5f9a48), -w/2+0.05+k*(w-0.1)/4, -h/2-0.09, 0.2+(k%2)*0.04, w0).scale.y=0.7; mk(G.ico(0.055,1), M(fc[(k+(o.seed||0))%fc.length]), -w/2+0.08+k*(w-0.16)/4, -h/2-0.05+(k%2)*0.04, 0.24, w0); } }
  return w0;
}
function heart(){ const s=new THREE.Shape(); s.moveTo(0,-0.8); s.bezierCurveTo(-1.2,0.1,-0.6,1.0,0,0.4); s.bezierCurveTo(0.6,1.0,1.2,0.1,0,-0.8); return s; }

/* ---------- Doors ---------- */
export function door1(p, x, y, z, o={}){
  const d=new THREE.Group(); d.position.set(x,y,z); p.add(d); const dc=M(o.color||0x8a5a3a), dk=M(col(o.color||0x8a5a3a,-0.12)), fr=M(o.frame||0xffffff), iron=M(0x3a302a), knob=M(0xf3c35a,{metalness:0.6,roughness:0.3});
  const type=o.type||'round';
  if (type==='round'){
    mk(G.box(1.08,1.45,0.08), fr, 0,0.72,0,d); const a=mk(G.cyl(0.54,0.54,0.08,18,1,false,0,Math.PI), fr, 0,1.45,0,d); a.rotation.set(Math.PI/2,0,Math.PI/2); a.rotation.order='ZXY';
    mk(G.box(0.86,1.42,0.07), dc, 0,0.71,0.03,d); const b=mk(G.cyl(0.43,0.43,0.07,18,1,false,0,Math.PI), dc, 0,1.42,0.03,d); b.rotation.set(Math.PI/2,0,Math.PI/2); b.rotation.order='ZXY';
    for (const k of [-0.22,0,0.22]) mk(G.box(0.025,1.6,0.075), dk, k,0.82,0.035,d);
    for (const yy of [0.35,1.15]) mk(G.box(0.5,0.06,0.08), iron, -0.15,yy,0.06,d);
    mk(G.cyl(0.13,0.13,0.03,14), windowMat, 0,1.5,0.07,d).rotation.x=Math.PI/2; mk(G.tor(0.13,0.025,6,14), iron, 0,1.5,0.08,d).castShadow=false;
    mk(G.sph(0.05,8,6), knob, 0.3,0.82,0.09,d);
  } else if (type==='dutch'){
    mk(G.box(1.0,1.85,0.08), fr, 0,0.92,0,d); mk(G.box(0.82,0.84,0.07), dc, 0,0.44,0.03,d); mk(G.box(0.82,0.84,0.07), dc, 0,1.31,0.03,d);
    mk(G.box(0.96,0.06,0.18), fr, 0,0.88,0.08,d); mk(G.box(0.42,0.4,0.05), windowMat, 0,1.33,0.07,d); mk(G.sph(0.05,8,6), knob, 0.3,0.95,0.12,d);
  } else {
    mk(G.box(1.0,1.85,0.08), fr, 0,0.92,0,d); mk(G.box(0.82,1.68,0.07), dc, 0,0.86,0.03,d);
    for (const k of [-0.2,0,0.2]) mk(G.box(0.02,1.6,0.075), dk, k,0.86,0.035,d);
    const zb=mk(G.box(0.07,1.0,0.08), dk, 0,0.86,0.07,d); zb.rotation.z=0.62; for (const yy of [0.45,1.3]) mk(G.box(0.74,0.08,0.08), dk, 0,yy,0.07,d);
    mk(G.sph(0.05,8,6), knob, 0.3,0.86,0.1,d);
  }
  // stoop and hood
  mk(G.box(1.3,0.16,0.62), tmat('stone',0xb0aaa0,1,0.5), 0,-0.08,0.3,d);
  if (o.hood==='gable'){ const hc=M(o.hoodC||0x8a5a3a); for (const s of [-1,1]){ const sl=mk(G.box(0.72,0.07,0.7), hc, s*0.32,2.12,0.3,d); sl.rotation.z=-s*0.6; }
    for (const s of [-1,1]){ const br=mk(G.box(0.07,0.42,0.07), M(0x6a4a30), s*0.5,1.86,0.34,d); br.rotation.x=-0.5; } }
  else if (o.hood==='awning'){ const aw=new THREE.Group(); aw.position.set(0,2.0,0.05); d.add(aw); const ac=[o.hoodC||0xe8604d, 0xfff4e4];
    for (let i=0;i<6;i++){ const st=mk(G.box(0.22,0.05,0.6), M(ac[i%2]), -0.55+i*0.22,0,0.3,aw); st.rotation.x=0.45; mk(G.cyl(0.11,0.11,0.05,10,1,false,0,Math.PI), M(ac[i%2]), -0.55+i*0.22,-0.15,0.58,aw).rotation.set(Math.PI/2,Math.PI/2,0); } }
  return d;
}

/* ---------- Bits ---------- */
export function wallLantern(p, x, y, z){ const l=new THREE.Group(); l.position.set(x,y,z); p.add(l); const iron=M(0x3a302a);
  mk(G.box(0.05,0.05,0.24), iron, 0,0.16,0.1,l); mk(G.box(0.17,0.22,0.17), glowMat(0xffd27a), 0,0,0.22,l); mk(G.cone(0.15,0.12,4), iron, 0,0.17,0.22,l).rotation.y=Math.PI/4; mk(G.box(0.2,0.03,0.2), iron, 0,-0.12,0.22,l); addGlow(l,0,2.4); return l; }
export function chimney1(p, x, z, baseY, topY, kind='stone', lean=0.04){
  const c=new THREE.Group(); c.position.set(x,0,z); c.rotation.z=lean; p.add(c); const h=topY-baseY;
  const body=tbox(kind==='brick'?'stone':'stone', kind==='brick'?0xb5643f:0xa8a49a, 0.56,h,0.56,0.7); body.position.y=baseY+h/2; c.add(body);
  mk(G.box(0.7,0.12,0.7), M(0x6a5a50), 0,topY,0,c); mk(G.cyl(0.11,0.13,0.26,10), M(0xc0683c), 0.1,topY+0.18,0.06,c); mk(G.cyl(0.09,0.11,0.2,10), M(0xc0683c), -0.12,topY+0.15,-0.06,c);
  return new THREE.Vector3(x+Math.sin(-lean)*(topY+0.3), topY+0.4, z);
}
export function ivy(p, x0, w, h, seed){ const r=mulberry32(seed||3), mats=[M(0x4f8a3c),M(0x5f9a48),M(0x3f7a34)];
  for (let i=0;i<Math.round(w*h*16);i++){ const t=r(), y=Math.pow(t,0.8)*h, spread=w*(1-t*0.55); const m=mk(G.ico(0.07+r()*0.05,0), mats[i%3], x0+(r()-0.5)*spread, 0.2+y, 0.04, p); m.scale.z=0.45; m.castShadow=false; } }
function flowerBed(p, x, z, w, r){ mk(G.box(w,0.16,0.42), M(0x6a4a30), x,0.08,z,p); const fc=[0xff7f9f,0xffd04d,0xffffff,0xc7a0ff,0xff9a5a];
  for (let i=0;i<Math.round(w*5);i++){ const fx=x-w/2+0.1+r()*(w-0.2), fz=z+(r()-0.5)*0.28; mk(G.ico(0.08,1), M(0x5f9a48), fx,0.22,fz,p).scale.y=0.8; mk(G.ico(0.06,1), M(fc[Math.floor(r()*fc.length)]), fx,0.3+r()*0.06,fz,p); } }
function woodpile(p, x, z){ for (let row=0;row<3;row++) for (let i=0;i<4-row;i++){ const l=mk(G.cyl(0.11,0.11,0.6,8), M(i%2?0x9a6a40:0x8a5a34), x+(i-(3-row)/2)*0.22, 0.12+row*0.19, z, p); l.rotation.x=Math.PI/2; mk(G.cyl(0.085,0.085,0.61,8), M(0xd8b080), x+(i-(3-row)/2)*0.22, 0.12+row*0.19, z, p).rotation.x=Math.PI/2; } }
function barrel(p, x, z, c=0x8a5a34){ mk(G.cyl(0.26,0.22,0.6,12), M(c), x,0.3,z,p); for (const y of [0.1,0.5]) mk(G.tor(0.245,0.025,5,14), M(0x4a4038), x,y,z,p).rotation.x=Math.PI/2; }

/* ---------- Walls with character ---------- */
// face frames: local x along the wall, local +z out of the wall, origin on the wall surface at ground level
function faces(W, D){ return { front:[0,D/2,0,W], back:[0,-D/2,Math.PI,W], right:[W/2,0,Math.PI/2,D], left:[-W/2,0,-Math.PI/2,D] }; }
function faceGroup(g, f, off=0){ const p=new THREE.Group(); const [x,z,ry]=f; p.position.set(x+Math.sin(ry)*off, 0, z+Math.cos(ry)*off); p.rotation.y=ry; g.add(p); return p; }
function logWalls(g, W, H, D, y0, c){
  mk(G.box(W-0.1,H,D-0.1), M(col(c,-0.18)), 0,y0+H/2,0,g);
  const rr=0.15, n=Math.floor(H/(rr*2)), lm=tmat('log',c,1,1), end=M(0xd8b080);
  for (let i=0;i<n;i++){ const y=y0+rr+i*rr*2, sh=(i%2)*0.08;
    for (const s of [-1,1]){ const a=mk(G.cyl(rr,rr,W+0.5+sh,10), lm, 0,y,s*D/2,g); a.rotation.z=Math.PI/2; const b=mk(G.cyl(rr,rr,D+0.5-sh,10), lm, s*W/2,y+0.0,0,g); b.rotation.x=Math.PI/2;
      for (const e of [-1,1]){ mk(G.cyl(rr*0.82,rr*0.82,0.02,10), end, e*(W/2+0.25+sh/2+0.005),y,s*D/2,g).rotation.z=Math.PI/2; } } }
}
function timberFace(p, len, y0, H, holes, bm){
  const T=0.12, half=len/2; let xs=[-half+0.06, half-0.06];
  for (const h of holes){ xs.push(h.x-h.w/2-0.08, h.x+h.w/2+0.08); }
  xs=xs.filter(x=>x>=-half && x<=half).sort((a,b)=>a-b); const merged=[]; for (const x of xs) if (!merged.length || x-merged[merged.length-1]>0.3) merged.push(x);
  for (let i=0;i<merged.length-1;i++){ const gap=merged[i+1]-merged[i]; if (gap>1.4){ const k=Math.ceil(gap/1.1); for (let j=1;j<k;j++) merged.push(merged[i]+gap*j/k); } }
  merged.sort((a,b)=>a-b);
  const inHole=(x1,x2,y1,y2)=>holes.some(h=>x2>h.x-h.w/2-0.02 && x1<h.x+h.w/2+0.02 && y2>h.y-h.h/2 && y1<h.y+h.h/2);
  const rail=y0+H*0.36, top=y0+H-0.06;
  for (const x of merged) if (!holes.some(h=>h.door && Math.abs(x-h.x)<h.w/2)) beam(p, x,y0+0.04, x,top, bm, T);
  for (const y of [y0+0.06, top]) beam(p, -half,y, half,y, bm, T+0.02);
  for (let i=0;i<merged.length-1;i++){ const a=merged[i], b=merged[i+1]; if (b-a<0.45) continue;
    if (!inHole(a,b,y0,rail)){ beam(p, a,y0+0.06, b,rail, bm); beam(p, b,y0+0.06, a,rail, bm); }
    if (!inHole(a,b,rail,top)){ if (a<0) beam(p, a,rail, b,top, bm); else beam(p, a,top, b,rail, bm); }
    if (!holes.some(h=>h.door && b>h.x-h.w/2 && a<h.x+h.w/2)) beam(p, a,rail, b,rail, bm); }
}

/* ---------- Neighbors' cottages ---------- */
// Each neighbor gets a house with its own personality. Footprints stay close to the old 4.2 x 3.4 houses.
const STYLES = {
  pippa:   { W:4.4, D:3.6, walls:'plaster', wallC:0xfff4e4, roof:'thatch', roofC:0xd8b070, H:[2.45], door:{ type:'round', hood:'none' }, win:{ type:'cross', shut:true, box:true }, gableWin:'front', chimney:'stone', extras:['bed','ivyL'] },
  bramble: { W:4.6, D:3.6, walls:'log', wallC:0x9a6a44, roof:'mossy', roofC:0x8a5a44, moss:0.9, H:[2.3], door:{ type:'plank', hood:'none' }, win:{ type:'cross', shut:false, box:false, frame:0xe8d8b8 }, chimney:'stone', chimSide:-1, extras:['wood','barrel'], base:'stone' },
  lumi:    { W:4.2, D:3.6, walls:'plaster', wallC:0xeee6f8, roof:'steep', ridgeZ:true, H:[2.4], door:{ type:'round', hood:'none' }, win:{ type:'round', box:false }, frontWins:[-1.25], turret:true, gableWin:'front', chimney:null, extras:['ivyR'] },
  otis:    { W:4.4, D:3.8, walls:'board', wallC:0xd8e4ee, roof:'gambrel', ridgeZ:true, H:[2.3], door:{ type:'dutch', hood:'awning' }, win:{ type:'cross', shut:true, box:false }, loft:true, chimney:'brick', extras:['barrel'] },
  mabel:   { W:4.4, D:3.6, walls:'stone', wallC:0xd8d0c0, roof:'mossy', moss:0.55, H:[2.4], door:{ type:'dutch', hood:'none' }, win:{ type:'cross', shut:true, box:true }, chimney:'brick', extras:['bed','ivyL'], gableWin:'both' },
  juniper: { W:4.2, D:3.4, walls:'timber', wallC:0xf6efe0, beamC:0x4a3226, roof:'steep', pitch:0.8, ridgeZ:true, H:[2.1,1.6], jetty:0.25, door:{ type:'round', hood:'none' }, win:{ type:'cross', shut:true, box:true }, chimney:'brick', extras:['bed'] },
  clover:  { W:4.4, D:3.6, walls:'plaster', wallC:0xf8f0d8, roof:'thatch', roofC:0xc8a868, moss:0.6, H:[2.4], door:{ type:'round', hood:'none' }, win:{ type:'round', box:true }, chimney:'stone', extras:['ivyR','bed'] },
};
export const COTTAGE_IDS = Object.keys(STYLES);
export function buildCottage(id, o={}){
  const st=STYLES[id] || STYLES[COTTAGE_IDS[hashStr(id||'x')%COTTAGE_IDS.length]], r=mulberry32(hashStr(id||'x')), g=new THREE.Group();
  const roofC = st.roofC || o.roofC || 0xe0745a, accent = o.accent || 0x6a9ad8, B=0.4, W=st.W, D=st.D;
  const trimFor = st.walls==='log' ? 0x6a4a30 : st.walls==='timber' ? st.beamC : 0xffffff;
  // stone base course
  const base=tbox('stone', 0xb0aaa0, W+0.3, B+0.6, D+0.3, 0.8); base.position.y=(B-0.6)/2; g.add(base);
  let y=B, topW=W, topD=D, chim=null;
  st.H.forEach((H, fl)=>{
    const grow = fl>0 ? (st.jetty||0) : 0, w=W+grow*2, d=D+grow*2, F=faces(w,d);
    if (fl>0){ mk(G.box(w+0.08,0.16,d+0.08), M(trimFor), 0,y+0.08,0,g); for (let i=0;i<Math.floor(w/0.42);i++) mk(G.box(0.12,0.12,0.2), M(trimFor), -w/2+0.2+i*0.42, y-0.04, D/2+0.1, g); y+=0.16; }
    // where the door and windows go, per face (local x)
    const doorX = fl===0 ? (st.doorX||0) : null, holes={ front:[], back:[], left:[], right:[] };
    const fw = st.frontWins && fl===0 ? st.frontWins : (fl===0 ? [-(w/2-0.72), w/2-0.72] : [-(w/4+0.2), w/4+0.2]);
    const wy = y + (fl===0 ? 1.2 : H*0.52);
    if (doorX!==null) holes.front.push({ x:doorX, y:y+0.95, w:1.15, h:2.1, door:true });
    fw.forEach(x=>{ if (doorX===null || Math.abs(x-doorX)>1.0) holes.front.push({ x, y:wy, w:0.95, h:1.0 }); });
    holes.right.push({ x:0, y:wy, w:0.95, h:1.0 }); holes.left.push({ x:0, y:wy, w:0.95, h:1.0 }); holes.back.push({ x:0, y:wy, w:0.95, h:1.0 });
    // walls
    if (st.walls==='log') logWalls(g, w, H, d, y, st.wallC);
    else { const kind = st.walls==='timber' ? 'plaster' : st.walls; const wl=tbox(kind, st.wallC, w, H, d, kind==='stone'?0.9:1.3); wl.position.y=y+H/2; g.add(wl);
      if (st.walls!=='timber') for (const ax of [-1,1]) for (const az of [-1,1]){ if (st.walls==='stone') for (let k=0;k<Math.floor(H/0.38);k++) mk(G.box(k%2?0.42:0.3,0.3,k%2?0.3:0.42), tmat('stone',col(st.wallC,-0.08),0.4,0.3), ax*(w/2-0.1+(k%2?0.08:0.02)), y+0.17+k*0.38, az*(d/2-0.1+(k%2?0.02:0.08)), g);
        else mk(G.box(0.16,H,0.16), M(st.walls==='board'?col(st.wallC,-0.12):0xf2e6d0), ax*w/2, y+H/2, az*d/2, g); }
      if (st.walls==='board') for (const f of Object.values(F)){ const p=faceGroup(g,f,0.01); for (let x=-f[3]/2+0.3; x<f[3]/2-0.1; x+=0.55) if (!holes[Object.keys(F).find(k=>F[k]===f)].some(h=>Math.abs(x-h.x)<h.w/2+0.05)) mk(G.box(0.07,H-0.1,0.05), M(col(st.wallC,-0.06)), x,y+H/2,0,p); }
      mk(G.box(w+0.1,0.12,d+0.1), M(trimFor), 0,y+H,0,g); }
    if (st.walls==='timber') for (const k of Object.keys(F)) timberFace(faceGroup(g,F[k],0.0), F[k][3], y, H, holes[k], M(st.beamC));
    // windows and door
    const fo = st.walls==='log' ? 0.16 : 0;
    const wo={ ...st.win, shut: st.win.shut ? accent : null, frame: st.win.frame || (st.walls==='timber'?0xf6efe0:0xffffff), seed:fl };
    for (const k of Object.keys(F)){ const p=faceGroup(g,F[k],fo); for (const h of holes[k]) if (!h.door) window1(p, h.x, h.y, 0.03, wo); }
    if (doorX!==null){ const p=faceGroup(g,F.front,fo); door1(p, doorX, y, 0.03, { type:st.door.type, color:o.doorC||col(accent,-0.08), hood:st.door.hood, hoodC: st.door.hood==='awning'?accent:(st.walls==='log'?0x6a4a30:col(roofC,-0.05)) });
      wallLantern(p, doorX+0.68, y+1.7, 0.0); }
    y+=H; topW=w; topD=d;
  });
  // roof
  const gableMat = st.walls==='log' ? tmat('log',st.wallC,1,1) : st.walls==='stone' ? tmat('plaster',0xf2ead8,1,1) : tmat(st.walls==='timber'?'plaster':st.walls, st.wallC, 0.8, 0.8);
  const rz=!!st.ridgeZ, L=rz?topD:topW, S=rz?topW:topD;
  const rise=cottageRoof(g, { style:st.roof, L, S, y, c:roofC, trim: st.roof==='thatch'?0x6a4a30:(st.walls==='timber'?st.beamC:(st.walls==='log'?0x6a4a30:0xf6efe6)), gableMat, moss:st.moss||0, seed:hashStr(id||'x'), ridgeZ:rz, timber:st.walls==='timber', beamC:st.beamC, gableWin:st.gableWin, loft:st.loft, pitch:st.pitch });
  if (st.chimney){ const cs=st.chimSide||1, cx=cs*(topW/2-0.75), cz=rz?-topD/4:-topD/4+0.2; chim=chimney1(g, cx, cz, y-0.2, y+rise*0.92+0.5, st.chimney, cs*0.035); }
  if (st.turret){ const t=new THREE.Group(); t.position.set(W/2+0.05,0,D/2-0.45); g.add(t); const tr=0.68, th=y+0.5;
    const tb=new THREE.Mesh(G.cyl(tr,tr,th-B,16), tmat('plaster',st.wallC,3,2)); tb.position.y=B+(th-B)/2; tb.castShadow=tb.receiveShadow=true; t.add(tb);
    mk(G.cyl(tr+0.06,tr+0.06,0.12,16), M(0xffffff), 0,th,0,t);
    const cone=mk(G.cone(tr+0.32,2.1,16), tmat('shingle',roofC,4,2.2), 0,th+1.05,0,t); mk(G.sph(0.09,8,6), M(0xf3c35a,{metalness:0.5,roughness:0.3}), 0,th+2.2,0,t); mk(G.cone(0.05,0.3,6), M(0xf3c35a,{metalness:0.5,roughness:0.3}), 0,th+2.4,0,t);
    const tw=new THREE.Group(); tw.position.set(0,0,0); t.add(tw); window1(tw, 0, B+1.4, tr+0.02, { type:'round', size:0.8 }); }
  // garden touches
  for (const e of st.extras||[]){
    if (e==='bed') flowerBed(g, -W/2+0.9, D/2+0.45, 1.3, r);
    if (e==='wood') woodpile(g, W/2+0.45, -0.2);
    if (e==='barrel') barrel(g, W/2+0.4, D/2-0.1);
    if (e==='ivyL') ivy(faceGroup(g,faces(W,D).left,0.02), D/2-0.45, 0.8, 2.0, hashStr(id||'x'));
    if (e==='ivyR') ivy(faceGroup(g,faces(W,D).right,0.02), -(D/2-0.45), 0.8, 2.1, hashStr(id||'x')+1);
  }
  mergeStatic(g);
  const mb=new THREE.Group(); mb.position.set(-W/2-0.45,0,D/2+1.0); FURN_BUILDERS.mailbox(mb); g.add(mb);
  g.userData.chimney=chim; g.userData.size={W, D}; return g;
}
