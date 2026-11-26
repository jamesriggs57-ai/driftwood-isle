/* =====================================================================
   v1.63 SEWING: 3D for rugs (an item model) and painted clothes (worn on the character).
   The painting becomes a canvas texture, one block per pixel, with a light weave so it reads as fabric.
   ===================================================================== */
import * as THREE from 'three';
import { YARN, decodeRug, decodeGarment, rugSize, altList, isRugId } from './textile-core.js';

const TAU=Math.PI*2, TORSO_Y=0.7;
const cache=new Map(); const once=(k,f)=>{ if (!cache.has(k)) cache.set(k,f()); return cache.get(k); };
const col = c => new THREE.Color(c);
const shade=(c,l)=>col(c).offsetHSL(0,0,l).getHex();
function mesh(geo, m, x=0,y=0,z=0, parent){ const o=new THREE.Mesh(geo, m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; if (parent) parent.add(o); return o; }
const plain=(c,o={})=>once('pl'+c+JSON.stringify(o), ()=>{ const m=new THREE.MeshStandardMaterial({ color:c, roughness:0.9, ...o }); m.userData.char=true; return m; });
const glow=c=>once('gl'+c, ()=>new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:1.1, roughness:0.4 }));

/* the painting as a texture. weave: 'rug' (knotted look) or 'cloth' (fine twill). G = grid size. */
export function paintTexture(px, G, weave='cloth'){
  return once(`tx:${weave}:${G}:${px.join(',')}`, ()=>{
    const cell = G<=12 ? 16 : G<=24 ? 10 : 8, W=G*cell, cv=document.createElement('canvas'); cv.width=cv.height=W; const x=cv.getContext('2d');
    for (let j=0;j<G;j++) for (let i=0;i<G;i++){ x.fillStyle='#'+col(YARN[px[j*G+i]]).getHexString(); x.fillRect(i*cell, j*cell, cell, cell); }
    if (weave==='rug'){ for (let j=0;j<G;j++) for (let i=0;i<G;i++){ const cx=i*cell, cy=j*cell; x.fillStyle='rgba(0,0,0,0.12)'; x.fillRect(cx, cy+cell-1, cell, 1); x.fillRect(cx+cell-1, cy, 1, cell);
        x.fillStyle='rgba(255,255,255,0.10)'; x.beginPath(); x.ellipse(cx+cell*0.5, cy+cell*0.45, cell*0.32, cell*0.2, 0.5, 0, TAU); x.fill(); } }
    else { x.strokeStyle='rgba(0,0,0,0.06)'; x.lineWidth=1; for (let k=-W;k<W;k+=3){ x.beginPath(); x.moveTo(k,0); x.lineTo(k+W,W); x.stroke(); } }
    const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; t.magFilter = weave==='rug' ? THREE.LinearFilter : THREE.NearestFilter; t.generateMipmaps=true; return t; }); }
const clothMat = (px, G) => once(`cm:${G}:${px.join(',')}`, ()=>{ const m=new THREE.MeshStandardMaterial({ map:paintTexture(px,G,'cloth'), roughness:0.85, side:THREE.DoubleSide }); return m; });
// the colour a piece "is" (for trims): the most used, and the second most used
function mainColors(px){ const c={}; for (const p of px) c[p]=(c[p]||0)+1; const s=Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>YARN[+e[0]]); return [s[0], s[1]??shade(s[0],-0.15)]; }

/* =====================================================================
   RUGS
   ===================================================================== */
function rugShape(k){ const s=new THREE.Shape();
  const poly=(n, f)=>{ for (let i=0;i<=n;i++){ const a=i/n*TAU, [x,y]=f(a,i); i?s.lineTo(x,y):s.moveTo(x,y); } };
  if (k===0||k===3){ const r=0.04; s.moveTo(-0.5+r,-0.5); s.lineTo(0.5-r,-0.5); s.quadraticCurveTo(0.5,-0.5,0.5,-0.5+r); s.lineTo(0.5,0.5-r); s.quadraticCurveTo(0.5,0.5,0.5-r,0.5); s.lineTo(-0.5+r,0.5); s.quadraticCurveTo(-0.5,0.5,-0.5,0.5-r); s.lineTo(-0.5,-0.5+r); s.quadraticCurveTo(-0.5,-0.5,-0.5+r,-0.5); }
  else if (k===1||k===2) poly(64, a=>[Math.cos(a)*0.5, Math.sin(a)*0.5]);
  else if (k===4) poly(8, a=>[Math.cos(a+Math.PI/8)*0.52, Math.sin(a+Math.PI/8)*0.52]);
  else if (k===5) poly(120, a=>{ const r=0.42+0.06*Math.abs(Math.sin(a*3.5)); return [Math.cos(a)*r, Math.sin(a)*r*0.92]; });
  else if (k===6) poly(10, (a,i)=>{ const r=i%2?0.22:0.5, b=a+Math.PI/2; return [Math.cos(b)*r, Math.sin(b)*r]; });
  else if (k===7) poly(64, a=>[0.36*Math.sign(Math.sin(a))*Math.pow(Math.abs(Math.sin(a)),1.4), 0.5*Math.cos(a)]);
  else if (k===8){ s.moveTo(0,-0.47); const N=60; for (let i=0;i<=N;i++){ const a=Math.PI*(0.12+0.76*i/N), r=0.9*(1+0.05*Math.abs(Math.sin(i/N*Math.PI*7))); s.lineTo(Math.cos(a)*r*0.6, -0.47+Math.sin(a)*r); } s.lineTo(0,-0.47); }
  return s; }
export function buildRug(g, id){
  const d=decodeRug(id.slice(3)); if (!d){ mesh(new THREE.BoxGeometry(1,0.02,1), plain(0xccbbaa), 0,0.01,0,g); return g; }
  const W=rugSize(d.w), D=d.shape===1 ? W : rugSize(d.d), shape=rugShape(d.shape);
  const tex=paintTexture(d.px, d.G, 'rug').clone(); tex.needsUpdate=true; tex.offset.set(0.5,0.5); tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  const h = d.pile===1 ? 0.035 : 0.012, bev = d.pile===1 ? 0.012 : 0.003;
  const geo=new THREE.ExtrudeGeometry(shape, { depth:h, bevelEnabled:true, bevelThickness:bev, bevelSize:bev, bevelSegments:2, curveSegments:24 });
  geo.rotateX(-Math.PI/2); geo.scale(W, 1, D); geo.translate(0, bev, 0);
  const top=new THREE.MeshStandardMaterial({ map:tex, roughness:0.95 }), side=plain(shade(YARN[d.ec], -0.05));
  const m=mesh(geo, [top, side], 0,0,0,g); m.castShadow=false;
  const ec=plain(YARN[d.ec]), y=h+bev*2, per=shape.getSpacedPoints(d.shape===0||d.shape===3?80:90).map(p=>[p.x*W, -p.y*D]);
  if (d.pile===2) for (const k of [0.97,0.9]){ const pts=per.map(([x,z])=>new THREE.Vector3(x*k, y, z*k)); mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 140, 0.022, 6, true), plain(shade(YARN[d.ec], k<0.95?0.08:0)), 0,0,0,g); }
  if (d.edge===1){ const fr=plain(shade(YARN[d.ec],0.1));
    if (d.shape===0||d.shape===3){ for (const sz of [-1,1]) for (let i=0;i<=Math.round(W/0.05);i++){ const f=mesh(new THREE.BoxGeometry(0.012,0.006,0.1), fr, -W/2+i*W/Math.round(W/0.05), 0.004, sz*(D/2+0.05), g); f.castShadow=false; } }
    else for (let i=0;i<per.length;i+=1){ const [x,z]=per[i], a=Math.atan2(z,x), f=mesh(new THREE.BoxGeometry(0.09,0.006,0.012), fr, x+Math.cos(a)*0.045, 0.004, z+Math.sin(a)*0.045, g); f.rotation.y=-a; f.castShadow=false; } }
  if (d.edge===2){ const pts=per.map(([x,z])=>new THREE.Vector3(x, y-0.002, z)); mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.03, 6, true), ec, 0,0,0,g).scale.y=0.4; }
  if (d.edge===3){ const corners = d.shape===0||d.shape===3 ? [[-W/2,-D/2],[W/2,-D/2],[-W/2,D/2],[W/2,D/2]] : per.filter((_,i)=>i%Math.round(per.length/6)===0);
    for (const [x,z] of corners){ mesh(new THREE.SphereGeometry(0.03,10,8), ec, x,0.03,z,g); const t=mesh(new THREE.ConeGeometry(0.035,0.12,10), ec, x*1.0+Math.sign(x)*0.05,0.015,z+Math.sign(z)*0.05,g); t.rotation.set(Math.sign(z)*1.4,0,-Math.sign(x)*1.4*0); } }
  if (d.edge===4) for (let i=0;i<per.length;i+=3){ const [x,z]=per[i], a=Math.atan2(z,x), b=mesh(new THREE.CylinderGeometry(0.06,0.06,0.012,16,1,false,0,Math.PI), ec, x+Math.cos(a)*0.0, 0.006, z+Math.sin(a)*0.0, g); b.rotation.y=-a+Math.PI/2; b.castShadow=false; }
  if (d.edge===5) for (let i=0;i<per.length;i+=4){ const [x,z]=per[i], a=Math.atan2(z,x); mesh(new THREE.SphereGeometry(0.035,10,8), i%8?ec:plain(YARN[d.px[0]]), x+Math.cos(a)*0.04, 0.03, z+Math.sin(a)*0.04, g); }
  return g; }

/* =====================================================================
   CLOTHES on the character rig. trunk: the torso group; arms: the two arm groups (userData.side).
   ctx: { anim(fn(t)), rig(group) } so moving bits keep moving after the rig is merged.
   ===================================================================== */
// a slice of the torso, wrapped so the middle of the painting is the front
function shell(r, t0, t1, m, body, sx=1, sy=0.92, sz=0.86){ const o=mesh(new THREE.SphereGeometry(r,40,18,-Math.PI/2,TAU,Math.PI*t0,Math.PI*(t1-t0)), m, 0,TORSO_Y,0,body); o.scale.set(sx,sy,sz); return o; }
const surfZ = (y, r=0.49) => Math.sqrt(Math.max(0, r*r-((y-TORSO_Y)/0.92)**2))*0.86;
const yAt = t => TORSO_Y + Math.cos(Math.PI*t)*0.49*0.92;
export function buildCustomOutfit(body, arms, code, sc, ctx={}){
  const d=decodeGarment(code); if (!d) return false;
  const M=clothMat(d.px, d.G), [c1,c2]=mainColors(d.px), trim=plain(c2), pants=plain(0x56688a), light=plain(0xf6f2ea);
  const hemT=[0.5,0.6,0.7][d.hem];
  let hemY=yAt(hemT), neckY=1.1;
  // body
  if (d.base===0){ shell(0.488,0.15,hemT,M,body); shell(0.484,hemT-0.02,0.86,pants,body); }
  else if (d.base===1||d.base===4){ const robe=d.base===4; shell(robe?0.497:0.49,0.14,0.52,M,body);
    const flare=[0.47,0.56,0.66,0.8][d.flare], bottom=robe ? [0.12,0.05,0.0][d.hem] : [0.36,0.2,0.06][d.hem], pts=[[0.4,0.62],[0.47,0.5],[(0.47+flare)/2+0.02,(0.5+bottom)/2],[flare,bottom+0.03],[flare-0.02,bottom]];
    const lg=new THREE.LatheGeometry(pts.map(([x,y])=>new THREE.Vector2(x,y)), 48, Math.PI, TAU); const sk=mesh(lg, M, 0,0,0,body); sk.scale.set(1,1,0.9); hemY=bottom+0.02;
    if (robe){ const sash=mesh(new THREE.TorusGeometry(0.47,0.035,8,40), trim, 0,0.6,0,body); sash.rotation.x=Math.PI/2; sash.scale.set(1,0.86,1); mesh(new THREE.SphereGeometry(0.05,10,8), trim, 0.2,0.58,0.4,body); } }
  else if (d.base===2){ const t1=[0.62,0.75,0.88][d.hem]; shell(0.497,0.12,t1,M,body); shell(0.484,t1-0.02,0.86,pants,body); hemY=yAt(t1);
    const ln=mesh(new THREE.BoxGeometry(0.012,1.1-hemY,0.01), trim, 0,(1.1+hemY)/2,0,body); ln.position.z=0.425; ln.rotation.x=-0.05; }
  else if (d.base===3){ shell(0.488,0.14,0.55,light,body); shell(0.494,0.5,0.88,M,body);
    const bib=mesh(new THREE.BoxGeometry(0.36,0.28,0.06), M, 0,0.86,0.39,body); bib.rotation.x=-0.25;
    for (const s of [-1,1]){ const st=mesh(new THREE.BoxGeometry(0.07,0.42,0.05), M, s*0.15,1.0,0.24,body); st.rotation.x=-0.6; mesh(new THREE.CylinderGeometry(0.028,0.028,0.02,16), plain(0xe8c050,{ metalness:0.4, roughness:0.4 }), s*0.15,0.98,0.425,body).rotation.x=Math.PI/2-0.25; } hemY=0.3; }
  // sleeves
  const sleeveM = d.base===3 ? light : M;
  for (const a of arms){ const s=a.userData.side;
    if (d.sleeve===1){ const sl=mesh(new THREE.CapsuleGeometry(0.122,0.04,8,16), sleeveM, s*0.03,-0.06,0, a); sl.rotation.z=s*0.25; }
    if (d.sleeve===2||d.sleeve===3){ const sl=mesh(new THREE.CapsuleGeometry(0.122,0.13,8,16), sleeveM, s*0.03,-0.1,0, a); sl.rotation.z=s*0.25;
      if (d.sleeve===3){ const b=mesh(new THREE.CylinderGeometry(0.13,0.2,0.14,16,1,true), sleeveM, s*0.08,-0.24,0.01, a); b.rotation.z=s*0.25; } }
    if (d.sleeve===4){ mesh(new THREE.SphereGeometry(0.17,16,12), sleeveM, s*0.02,-0.02,0, a); } }
  // alterations
  const alts=altList(d.alts).map(([,i])=>i), has=i=>alts.includes(i), shoulder=s=>[s*0.36, 1.02, 0.02];
  if (has(0)) for (const s of [-1,1]){ const p=mesh(new THREE.BoxGeometry(0.13,0.12,0.02), trim, s*0.17, 0.55, surfZ(0.55)+0.012, body); p.rotation.y=s*0.32; }
  if (has(1)){ const c=mesh(new THREE.TorusGeometry(0.2,0.045,10,28), d.base===3?trim:light, 0,1.1,0.03,body); c.rotation.x=Math.PI/2; }
  if (has(2)) for (const a of arms){ const s=a.userData.side, len=d.sleeve>=2?-0.22:-0.1; const cf=mesh(new THREE.TorusGeometry(0.115,0.03,8,20), trim, s*0.06,len,0.012,a); cf.rotation.x=Math.PI/2; }
  if (has(3)) for (let i=0;i<4;i++){ const y=1.0-i*0.12; if (y<hemY+0.05) break; mesh(new THREE.SphereGeometry(0.024,10,8), trim, 0,y,surfZ(y)+0.01,body); }
  if (has(4)){ for (let i=0;i<22;i++){ const a=i/22*TAU, R=d.base===1||d.base===4?[0.47,0.56,0.66,0.8][d.flare]:0.46; const f=mesh(new THREE.SphereGeometry(0.05,8,6), trim, Math.sin(a)*R, hemY-0.01, Math.cos(a)*R*(d.base===1||d.base===4?0.9:0.86), body); f.scale.set(1,0.55,1); } }
  if (has(5)){ const m=plain(c2); for (const s of [-1,1]){ const w=mesh(new THREE.ConeGeometry(0.09,0.16,14), m, s*0.09,1.02,0.38,body); w.rotation.z=s*Math.PI/2; } mesh(new THREE.SphereGeometry(0.045,12,10), m, 0,1.02,0.4,body); }
  if (has(6)){ const h=mesh(new THREE.TorusGeometry(0.27,0.1,14,32,Math.PI*1.3), M, 0,1.1,-0.05,body); h.rotation.set(Math.PI/2,0,-Math.PI*0.65); h.scale.set(1,0.9,1); }
  if (has(7)){ const lace=plain(0xfffaf0); for (let i=0;i<26;i++){ const a=i/26*TAU; mesh(new THREE.SphereGeometry(0.02,6,5), lace, Math.sin(a)*0.21, 1.1, Math.cos(a)*0.19+0.02, body); }
    if (d.base!==1 && d.base!==4) for (let i=0;i<30;i++){ const a=i/30*TAU; mesh(new THREE.SphereGeometry(0.02,6,5), lace, Math.sin(a)*0.46, hemY+0.005, Math.cos(a)*0.4, body); } }
  if (has(8)){ const cp=mesh(new THREE.CylinderGeometry(0.34,0.56,0.86,24,1,true,Math.PI*0.55,Math.PI*0.9), M, 0,0.66,-0.04,body); cp.scale.z=0.95; mesh(new THREE.TorusGeometry(0.24,0.03,8,24,Math.PI), trim, 0,1.08,-0.02,body).rotation.set(Math.PI/2,0,Math.PI); }
  if (has(9)) for (const s of [-1,1]) for (let k=0;k<3;k++){ const [x,y,z]=shoulder(s); const st=mesh(new THREE.ConeGeometry(0.03,0.08,8), plain(0xc8ccd2,{ metalness:0.8, roughness:0.3 }), x-s*k*0.06, y+0.03-k*0.01, z-0.06+k*0.06, body); st.rotation.z=-s*0.5; }
  if (has(10)) for (const s of [-1,1]){ const t=mesh(new THREE.BoxGeometry(0.16,0.5,0.03), M, s*0.1,0.2,-0.36,body); t.rotation.set(0.25,0,s*0.08); }
  if (has(11)){ const cs=[0xe2483d,0xf2d060,0x5a8ad8,0x9fc86a]; [[-0.16,0.75],[0.18,0.6],[0.05,0.42]].forEach(([x,y],i)=>{ const p=mesh(new THREE.BoxGeometry(0.1,0.1,0.012), plain(cs[i]), x,y,surfZ(y)+0.008,body); p.rotation.set(-0.15,x*0.6,0.2*(i-1)); });
    for (const a of arms){ const s=a.userData.side; mesh(new THREE.BoxGeometry(0.08,0.08,0.012), plain(cs[3]), s*0.05,-0.12,0.13,a); } }
  if (has(12)){ const lf=plain(0x5f9a4a,{ side:THREE.DoubleSide }); for (let i=0;i<20;i++){ const a=Math.PI*(-0.65+i/19*1.3); const l=mesh(new THREE.SphereGeometry(0.08,8,6), i%3?lf:plain(0x7fb85a,{ side:THREE.DoubleSide }), Math.sin(a)*0.36, 1.02-Math.abs(Math.sin(a))*0.06, Math.cos(a)*0.33, body); l.scale.set(0.5,1.3,0.2); l.rotation.set(0.9*Math.cos(a), a, 0.5*Math.sin(a)); } }
  if (has(13)) for (const s of [-1,1]){ const [x,y,z]=shoulder(s); const cap=mesh(new THREE.SphereGeometry(0.1,16,8,0,TAU,0,Math.PI/2), plain(0xc8403a,{ roughness:0.5 }), x,y+0.02,z,body); cap.scale.y=0.7; for (let k=0;k<4;k++){ const a=k/4*TAU+0.5; mesh(new THREE.SphereGeometry(0.016,6,4), plain(0xfff6e8), x+Math.cos(a)*0.06, y+0.075, z+Math.sin(a)*0.06, body); } }
  if (has(14)) for (let i=0;i<5;i++){ const y=1.0-i*0.13, f=mesh(new THREE.ConeGeometry(0.05,0.16-i*0.015,4), plain(c2), 0,y,-surfZ(y)-0.05,body); f.rotation.x=-1.9; f.scale.x=0.35; }
  if (has(15)){ const gm=glow(shade(c1, 0.15)); const a=mesh(new THREE.TorusGeometry(0.21,0.014,6,30), gm, 0,1.09,0.03,body); a.rotation.x=Math.PI/2;
    const R=d.base===1||d.base===4?[0.47,0.56,0.66,0.8][d.flare]:0.465; const b=mesh(new THREE.TorusGeometry(R,0.014,6,48), gm, 0,hemY+0.01,0,body); b.rotation.x=Math.PI/2; b.scale.y=0.88; }
  if (has(16)){ const orb=new THREE.Group(); orb.position.set(0,0.8,0); body.add(orb); if (ctx.rig) ctx.rig(orb);
    for (let i=0;i<3;i++){ const st=mesh(new THREE.OctahedronGeometry(0.045), glow([0xfff0a0,0xa8d8ff,0xffb8e0][i]), Math.cos(i/3*TAU)*0.72, (i-1)*0.18, Math.sin(i/3*TAU)*0.72, orb); st.castShadow=false; }
    if (ctx.anim) ctx.anim(t=>{ orb.rotation.y=t*0.9; orb.children.forEach((c,i)=>c.rotation.set(t*2+i, t*3, 0)); }); }
  if (has(17)){ const wm=plain(0xf8f4ff,{ side:THREE.DoubleSide, roughness:0.6 }); for (const s of [-1,1]){ const w=new THREE.Group(); w.position.set(s*0.12,0.95,-0.36); body.add(w); if (ctx.rig) ctx.rig(w);
      const sh=new THREE.Shape(); sh.moveTo(0,0); sh.bezierCurveTo(0.15,0.25,0.42,0.3,0.48,0.1); sh.bezierCurveTo(0.38,0.05,0.3,-0.05,0.22,-0.12); sh.bezierCurveTo(0.12,-0.08,0.05,-0.06,0,0);
      const m=mesh(new THREE.ShapeGeometry(sh), wm, 0,0,0,w); m.scale.x=s; w.rotation.y=s*0.5;
      if (ctx.anim) ctx.anim(t=>{ w.rotation.y=s*(0.5+Math.sin(t*5)*0.25); }); } }
  return true; }

/* the Sewing Machine: a cast-iron treadle machine on a little wooden table */
export function buildMachine(g){
  const wood=once('smw', ()=>new THREE.MeshStandardMaterial({ color:0x8a5a3a, roughness:0.55 })), iron=plain(0x2a2826,{ metalness:0.5, roughness:0.45 }), body=once('smb', ()=>new THREE.MeshPhysicalMaterial({ color:0x1e1e22, roughness:0.25, clearcoat:1 })), gold=plain(0xd8a840,{ metalness:0.8, roughness:0.3 }), steel=plain(0xc8ccd2,{ metalness:0.9, roughness:0.25 });
  // table top and drawers
  mesh(new THREE.BoxGeometry(0.95,0.05,0.5), wood, 0,0.74,0,g); for (const s of [-1,1]){ mesh(new THREE.BoxGeometry(0.2,0.14,0.44), wood, s*0.36,0.64,0,g); mesh(new THREE.SphereGeometry(0.016,8,6), gold, s*0.36,0.64,0.225,g); }
  // treadle legs: two cast iron side frames with a scroll, a treadle plate and the big wheel
  for (const s of [-1,1]){ const x=s*0.4; mesh(new THREE.BoxGeometry(0.03,0.62,0.04), iron, x,0.36,0.17,g); mesh(new THREE.BoxGeometry(0.03,0.62,0.04), iron, x,0.36,-0.17,g); mesh(new THREE.BoxGeometry(0.035,0.04,0.46), iron, x,0.04,0,g);
    const sc=mesh(new THREE.TorusGeometry(0.1,0.012,6,20), iron, x,0.34,0,g); sc.rotation.y=Math.PI/2; }
  mesh(new THREE.BoxGeometry(0.62,0.025,0.26), iron, 0,0.12,0.05,g).rotation.x=0.12;
  const wh=mesh(new THREE.TorusGeometry(0.16,0.014,6,28), iron, 0.32,0.38,0,g); wh.rotation.y=Math.PI/2; for (let k=0;k<4;k++){ const sp=mesh(new THREE.BoxGeometry(0.01,0.3,0.01), iron, 0.32,0.38,0,g); sp.rotation.x=k*Math.PI/4; }
  // the machine: base, pillar, curved arm, head with needle, hand wheel, spool
  mesh(new THREE.BoxGeometry(0.5,0.04,0.24), body, 0,0.785,0,g);
  mesh(new THREE.BoxGeometry(0.1,0.2,0.12), body, 0.16,0.9,0,g);
  const arm=mesh(new THREE.CylinderGeometry(0.055,0.06,0.36,16), body, 0,1.0,0,g); arm.rotation.z=Math.PI/2;
  mesh(new THREE.BoxGeometry(0.09,0.16,0.11), body, -0.19,0.92,0,g);
  mesh(new THREE.CylinderGeometry(0.004,0.004,0.06,6), steel, -0.2,0.82,0.03,g);
  const hw=mesh(new THREE.CylinderGeometry(0.07,0.07,0.03,20), steel, 0.24,0.97,0,g); hw.rotation.z=Math.PI/2;
  for (const [x,z] of [[0.05,0.06],[-0.08,0.06]]){ const d=mesh(new THREE.BoxGeometry(0.06,0.04,0.004), gold, x,1.0,z,g); d.position.z=0.061; }
  mesh(new THREE.CylinderGeometry(0.004,0.004,0.06,6), steel, 0.04,1.08,0,g); mesh(new THREE.CylinderGeometry(0.022,0.022,0.04,12), plain(0xe2483d), 0.04,1.1,0,g);
  // a bit of cloth under the needle
  const cl=mesh(new THREE.BoxGeometry(0.22,0.006,0.18), plain(0x8ad0e8), -0.17,0.81,0.06,g); cl.rotation.y=0.3;
  return g; }

/* register the rug and machine models with the item builder table (main passes it in, to avoid an import loop) */
export function registerRug(ITEM_BUILDERS){ ITEM_BUILDERS.rug = (g, d, id) => buildRug(g, id || d.code); ITEM_BUILDERS.sewmachine = g => buildMachine(g); }
export { isRugId };
