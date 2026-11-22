// v0.5 models: player-designed houses (outside and inside), shops, museum, new furniture, shopkeepers, Mossby.
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { BUILD } from './content.js';
import { M, MF, mk, G, outline, windowMat, glowMat, addGlow, FURN_BUILDERS, buildItemModel, buildAnimal } from './models.js';

/* ---------- Canvas textures (cached by kind + color) ---------- */
const TEX = new Map();
const hex = c => '#'+new THREE.Color(c).getHexString();
const shade = (c, l) => hex(new THREE.Color(c).offsetHSL(0,0,l));
function canvasTex(key, draw, size=128){
  if (TEX.has(key)) return TEX.get(key);
  const cv=document.createElement('canvas'); cv.width=cv.height=size; draw(cv.getContext('2d'), size);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; TEX.set(key,t); return t;
}
function surfTex(kind, color){
  return canvasTex(kind+':'+color, (x,S)=>{
    const r=mulberry32(7); x.fillStyle=hex(color); x.fillRect(0,0,S,S);
    if (kind==='siding'){ for(let y=0;y<S;y+=16){ x.fillStyle=shade(color,-0.09); x.fillRect(0,y+13,S,3); x.fillStyle=shade(color,0.05); x.fillRect(0,y,S,2); } }
    else if (kind==='plank'){ for(let i=0;i<S;i+=22){ x.fillStyle=shade(color,-0.1); x.fillRect(i,0,3,S); x.fillStyle=shade(color,-0.03); x.fillRect(i+9,0,5,S); } }
    else if (kind==='shingle'||kind==='roof'){ const h=kind==='roof'?16:14; for(let y=0,row=0;y<S;y+=h,row++){ for(let i=-(row%2)*10;i<S;i+=20){ x.fillStyle=shade(color,(r()-0.5)*0.08); x.fillRect(i+1,y,18,h-2); x.fillStyle=shade(color,-0.14); x.fillRect(i,y+h-2,20,2); } } }
    else if (kind==='brick'){ x.fillStyle='#e8dccc'; x.fillRect(0,0,S,S); for(let y=0,row=0;y<S;y+=16,row++) for(let i=-(row%2)*16;i<S;i+=32){ x.fillStyle=shade(color,(r()-0.5)*0.1); x.fillRect(i+2,y+2,28,12); } }
    else if (kind==='stone'){ x.fillStyle=shade(color,-0.18); x.fillRect(0,0,S,S); for(let k=0;k<26;k++){ const cx=r()*S, cy=r()*S, w=14+r()*16, h=10+r()*10; x.fillStyle=shade(color,(r()-0.5)*0.14); x.beginPath(); x.ellipse(cx,cy,w/2,h/2,0,0,TAU); x.fill(); x.beginPath(); x.ellipse(cx-S*Math.sign(cx-S/2),cy,w/2,h/2,0,0,TAU); x.fill(); } }
    else if (kind==='stucco'){ for(let k=0;k<900;k++){ x.fillStyle=shade(color,(r()-0.5)*0.07); x.fillRect(r()*S,r()*S,2,2); } }
    else if (kind==='log'){ for(let y=0;y<S;y+=21){ const g=x.createLinearGradient(0,y,0,y+21); g.addColorStop(0,shade(color,-0.12)); g.addColorStop(0.4,shade(color,0.06)); g.addColorStop(1,shade(color,-0.16)); x.fillStyle=g; x.fillRect(0,y,S,21); } }
    else if (kind==='wood'){ for(let y=0;y<S;y+=16){ x.fillStyle=shade(color,(r()-0.5)*0.08); x.fillRect(0,y,S,15); x.fillStyle=shade(color,-0.12); x.fillRect(0,y+15,S,1); x.fillRect(((y*37)%S),y,1,15); } }
    else if (kind==='parquet'){ for(let i=0;i<4;i++) for(let j=0;j<4;j++){ const vert=(i+j)%2; for(let k=0;k<4;k++){ x.fillStyle=shade(color,(r()-0.5)*0.1); if(vert) x.fillRect(i*32+k*8,j*32,7,31); else x.fillRect(i*32,j*32+k*8,31,7); } } }
    else if (kind==='tile'){ for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?hex(color):'#f4efe6'; x.fillRect(i*32,j*32,32,32); } x.strokeStyle='rgba(0,0,0,.08)'; for(let i=0;i<=4;i++){ x.beginPath(); x.moveTo(i*32,0); x.lineTo(i*32,S); x.moveTo(0,i*32); x.lineTo(S,i*32); x.stroke(); } }
    else if (kind==='carpet'){ for(let k=0;k<1400;k++){ x.fillStyle=shade(color,(r()-0.5)*0.06); x.fillRect(r()*S,r()*S,2,2); } }
    else if (kind==='lattice'){ x.fillStyle='#3a2a20'; x.fillRect(0,0,S,S); x.strokeStyle=hex(color); x.lineWidth=7; for(let i=-S;i<S*2;i+=32){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+S,S); x.stroke(); x.beginPath(); x.moveTo(i,S); x.lineTo(i+S,0); x.stroke(); } }
    // wallpapers
    else if (kind==='p:stripe'){ x.fillStyle=shade(color,-0.06); for(let i=0;i<4;i++) x.fillRect(i*32,0,14,S); }
    else if (kind==='p:dots'){ x.fillStyle=shade(color,-0.08); for(let i=0;i<4;i++) for(let j=0;j<4;j++){ x.beginPath(); x.arc(i*32+16+(j%2)*16,j*32+16,5,0,TAU); x.fill(); } }
    else if (kind==='p:check'){ x.fillStyle=shade(color,-0.05); for(let i=0;i<4;i++) for(let j=0;j<4;j++) if((i+j)%2) x.fillRect(i*32,j*32,32,32); }
    else if (kind==='p:wainscot'){ x.fillStyle=shade(color,-0.25); x.fillRect(0,S*0.62,S,S*0.38); x.fillStyle=shade(color,-0.32); for(let i=0;i<S;i+=32) x.fillRect(i,S*0.62,3,S*0.38); x.fillStyle='#ffffff'; x.fillRect(0,S*0.6,S,5); }
    else if (kind==='p:brick'){ x.fillStyle='#efe6da'; x.fillRect(0,0,S,S); for(let y=0,row=0;y<S;y+=16,row++) for(let i=-(row%2)*16;i<S;i+=32){ x.fillStyle=shade(color,(r()-0.5)*0.08); x.fillRect(i+2,y+2,28,12); } }
  });
}
// A material whose texture repeats every `tile` meters for a surface of size w x h
function tiled(kind, color, w, h, tile=1.2, extra){
  const t=surfTex(kind, color).clone(); t.needsUpdate=true; t.repeat.set(Math.max(0.2,w/tile), Math.max(0.2,h/tile));
  return new THREE.MeshStandardMaterial(Object.assign({ map:t, roughness:0.9 }, extra||{}));
}
// A box whose side faces are each tiled to their own size
function texBox(kind, color, W, H, D, tile=1.2){
  const side=tiled(kind,color,D,H,tile), front=tiled(kind,color,W,H,tile), top=M(new THREE.Color(color).offsetHSL(0,0,-0.08).getHex());
  return new THREE.Mesh(G.box(W,H,D), [side,side,top,top,front,front]);
}

/* ---------- Plan helpers shared by the builder UI and the house models ---------- */
export function planGrid(plan){
  const { GW, GD } = BUILD; const occ=[]; for(let j=0;j<GD;j++){ occ.push(new Array(GW).fill(-1)); }
  plan.rooms.forEach((r,k)=>{ for(let j=r.z;j<r.z+r.d;j++) for(let i=r.x;i<r.x+r.w;i++) if(j>=0&&j<GD&&i>=0&&i<GW) occ[j][i]=k; });
  return occ;
}
export const linkKey = (a,b) => a<b ? a+'|'+b : b+'|'+a;
export const linkOf = (plan,a,b) => (plan.links||{})[linkKey(a,b)] || 'door';
export function planCells(plan){ return plan.rooms.reduce((a,r)=>a+r.w*r.d,0); }
// Problems with a plan, or '' if it's fine. Used live by the editor.
export function planProblem(plan){
  const { GW, GD } = BUILD; if (!plan.rooms.length) return 'A house needs at least one room.';
  for (const r of plan.rooms){ if (r.x<0||r.z<0||r.x+r.w>GW||r.z+r.d>GD||r.w<1||r.d<1) return 'A room is outside the lot.'; }
  for (let a=0;a<plan.rooms.length;a++) for (let b=a+1;b<plan.rooms.length;b++){ const A=plan.rooms[a], B=plan.rooms[b]; if (A.x<B.x+B.w && B.x<A.x+A.w && A.z<B.z+B.d && B.z<A.z+A.d) return 'Rooms can\'t overlap.'; }
  // every room must be reachable from the front door through doorways or open walls
  const occ=planGrid(plan), d=plan.door; if (!d || occ[d.j]?.[d.i]===undefined || occ[d.j][d.i]<0 || (d.j+1<GD && occ[d.j+1][d.i]>=0)) return 'The front door needs an outside wall facing the front.';
  const seen=new Set([occ[d.j][d.i]]), q=[occ[d.j][d.i]];
  while (q.length){ const k=q.pop(); const r=plan.rooms[k];
    for (let j=r.z;j<r.z+r.d;j++) for (let i=r.x;i<r.x+r.w;i++) for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){ const n=occ[j+dj]?.[i+di]; if (n===undefined||n<0||n===k||seen.has(n)) continue; if (linkOf(plan,plan.rooms[k].id,plan.rooms[n].id)==='wall') continue; seen.add(n); q.push(n); } }
  if (seen.size<plan.rooms.length) return 'Every room needs a way in. Add a doorway.';
  return '';
}
// Move the front door somewhere valid if it isn't (prefers the old column)
export function fixDoor(plan){
  const { GD } = BUILD; const occ=planGrid(plan); const ok=(i,j)=>occ[j]?.[i]>=0 && !(j+1<GD && occ[j+1][i]>=0);
  if (plan.door && ok(plan.door.i,plan.door.j)) return;
  const want=plan.door?plan.door.i:3; let best=null, bd=1e9;
  for (let j=0;j<GD;j++) for (let i=0;i<BUILD.GW;i++) if (ok(i,j)){ const s=Math.abs(i-want)*2+(GD-j); if(s<bd){ bd=s; best={i,j}; } }
  plan.door=best;
}
export function defaultExt(){ return { wall:'siding', wallC:0xfff1d6, roof:'gable', roofC:0xe0745a, trimC:0xffffff, door:'plank', doorC:0x8a5a3a, win:'square', shutters:true, shutC:0x6a9ad8, boxes:true, found:'stone', porch:'step', chimney:'brick', stories:1, lamps:true }; }
export function defaultRoom(id,x,z,w,d){ return { id, x, z, w, d, floor:'wood', floorC:0xc99a6a, paper:'stripe', paperC:0xfff0d8 }; }

/* ---------- Roofs ---------- */
function roofOn(g, style, W, D, baseY, roofC, trimC, wallKind, wallC){
  // returns roof height above baseY. Ridge runs along the longer side.
  const roofTex=(w,h)=>tiled('roof', roofC, w, h, 1.0);
  const along = W>=D; const L = along?W:D, S = along?D:W; const grp=new THREE.Group(); g.add(grp); if(!along) grp.rotation.y=Math.PI/2;
  if (style==='flat'){
    mk(G.box(W+0.3,0.22,D+0.3), M(new THREE.Color(roofC).offsetHSL(0,0,-0.1).getHex()), 0,baseY+0.11,0,g);
    for (const s of [-1,1]){ mk(G.box(W+0.4,0.32,0.16), M(trimC), 0,baseY+0.3,s*(D/2+0.12),g); mk(G.box(0.16,0.32,D+0.4), M(trimC), s*(W/2+0.12),baseY+0.3,0,g); }
    return 0.5;
  }
  if (style==='hip'){
    const rise=S/2*Math.tan(0.55)+0.15; const cone=new THREE.ConeGeometry(1,rise,4,1); cone.rotateY(Math.PI/4);
    const m=mk(cone, new THREE.MeshStandardMaterial({ map:surfTex('roof',roofC), color:0xffffff, roughness:0.85, flatShading:true }), 0, baseY+rise/2+0.05, 0, g);
    m.scale.set((W+0.7)/Math.SQRT2, 1, (D+0.7)/Math.SQRT2);
    mk(G.box(W+0.5,0.12,D+0.5), M(trimC), 0,baseY+0.04,0,g);
    return rise;
  }
  if (style==='shed'){
    const rise=S*0.32+0.2, span=S+0.6, slope=Math.atan2(rise,span), Ls=span/Math.cos(slope);
    const slab=mk(G.box(L+0.6,0.16,Ls), roofTex(L+0.6,Ls), 0, baseY+rise/2+0.08, 0, grp); slab.rotation.x=slope;
    const tri=new THREE.Shape(); tri.moveTo(-S/2,0); tri.lineTo(S/2,0); tri.lineTo(-S/2,rise*S/span); tri.lineTo(-S/2,0);
    const gm=tiled(wallKind, wallC, 1, 1, 1.2); gm.map.repeat.set(0.83,0.83);
    for (const s of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(tri,{depth:0.1,bevelEnabled:false}), gm, s*(L/2)-(s>0?0.1:0), baseY, 0, grp); m.rotation.y=Math.PI/2; m.position.x = s>0? L/2-0.1 : -L/2; }
    return rise;
  }
  // gable / steep
  const pitch = style==='steep' ? 0.95 : 0.55, over=0.4, hd=S/2+over, rise=hd*Math.tan(pitch), Ls=hd/Math.cos(pitch);
  for (const s of [1,-1]){ const slab=new THREE.Group(); slab.position.set(0, baseY+rise/2+0.05, s*hd/2); slab.rotation.x=s*pitch; grp.add(slab);
    mk(G.box(L+0.7,0.12,Ls), M(trimC), 0,-0.04,0,slab); mk(G.box(L+0.75,0.1,Ls+0.04), roofTex(L+0.75,Ls), 0,0.06,0,slab); }
  mk(G.box(L+0.8,0.16,0.26), M(new THREE.Color(roofC).offsetHSL(0,0,-0.12).getHex()), 0,baseY+rise+0.1,0,grp);
  const tri=new THREE.Shape(); const gh=rise*(S/2)/hd; tri.moveTo(-S/2,0); tri.lineTo(S/2,0); tri.lineTo(0,gh); tri.lineTo(-S/2,0);
  const gm=tiled(wallKind, wallC, 1, 1, 1.2); gm.map.repeat.set(0.83,0.83);
  for (const s of [-1,1]){ const m=mk(new THREE.ExtrudeGeometry(tri,{depth:0.1,bevelEnabled:false}), gm, 0, baseY, 0, grp); m.rotation.y=Math.PI/2; m.position.x = s>0? L/2-0.1 : -L/2; }
  return rise;
}

/* ---------- Windows and doors ---------- */
function houseWindow(g, x, y, z, ry, E, sz=1){
  const p=new THREE.Group(); p.position.set(x,y,z); p.rotation.y=ry; g.add(p);
  const frame=M(0xffffff), st=E.win;
  let w=0.62*sz, h=0.62*sz;
  if (st==='tall'){ w=0.5*sz; h=0.95*sz; } if (st==='wide'){ w=0.95*sz; h=0.55*sz; }
  if (st==='round'){ const r=0.34*sz; mk(G.cyl(r+0.08,r+0.08,0.08,20), frame, 0,0,0,p).rotation.x=Math.PI/2; mk(G.cyl(r,r,0.06,20), windowMat, 0,0,0.03,p).rotation.x=Math.PI/2; mk(G.box(0.04,r*2,0.08),frame,0,0,0.05,p); mk(G.box(r*2,0.04,0.08),frame,0,0,0.05,p); w=h=r*2; }
  else {
    mk(G.box(w+0.14,h+0.14,0.08), frame, 0,0,0,p); mk(G.box(w,h,0.06), windowMat, 0,0,0.03,p);
    mk(G.box(0.04,h,0.08), frame, 0,0,0.05,p); mk(G.box(w,0.04,0.08), frame, 0,0,0.05,p);
    if (st==='arched'){ const a=mk(G.cyl(w/2+0.07,w/2+0.07,0.08,16,1,false,0,Math.PI), frame, 0,h/2,0,p); a.rotation.set(Math.PI/2,0,Math.PI/2); a.rotation.order='ZXY'; const ag=mk(new THREE.CircleGeometry(w/2,16,0,Math.PI), windowMat, 0,h/2,0.035,p); }
  }
  if (E.shutters && st!=='round') for (const s of [-1,1]){ const sh=mk(G.box(0.24*sz,h+0.08,0.05), M(E.shutC), s*(w/2+0.2*sz),0,0.02,p); for(let k=0;k<3;k++) mk(G.box(0.18*sz,0.03,0.06), M(new THREE.Color(E.shutC).offsetHSL(0,0,-0.1).getHex()), s*(w/2+0.2*sz),-h/3+k*h/3,0.03,p); }
  if (E.boxes){ mk(G.box(w+0.16,0.16,0.22), M(0x8b5e3a), 0,-h/2-0.13,0.13,p); const fc=[0xff7f7f,0xffd04d,0xffffff,0xc7a0ff]; for(let k=0;k<4;k++) mk(G.ico(0.07,1), M(fc[k]), -w/2+0.1+k*(w-0.2)/3, -h/2+0.0, 0.16, p); }
  return p;
}
function houseDoor(g, x, y, z, E){
  const p=new THREE.Group(); p.position.set(x,y,z); g.add(p); const dc=M(E.doorC), tr=M(0xffffff), knob=M(0xf3c35a,{metalness:0.6,roughness:0.3});
  if (E.door==='glass'){ mk(G.box(1.12,1.82,0.1),tr,0,0.91,0,p); for(const s of [-1,1]){ mk(G.box(0.46,1.66,0.08),dc,s*0.25,0.85,0.03,p); mk(G.box(0.3,1.1,0.06),windowMat,s*0.25,0.98,0.07,p); mk(G.sph(0.035,8,6),knob,s*0.06,0.85,0.1,p); } }
  else if (E.door==='arched'){ mk(G.box(1.0,1.5,0.1),tr,0,0.75,0,p); const a=mk(G.cyl(0.5,0.5,0.1,16,1,false,0,Math.PI),tr,0,1.5,0,p); a.rotation.set(Math.PI/2,0,Math.PI/2); a.rotation.order='ZXY';
    mk(G.box(0.8,1.45,0.08),dc,0,0.72,0.03,p); const b=mk(G.cyl(0.4,0.4,0.08,16,1,false,0,Math.PI),dc,0,1.45,0.03,p); b.rotation.set(Math.PI/2,0,Math.PI/2); b.rotation.order='ZXY'; mk(G.sph(0.05,8,6),knob,0.28,0.8,0.09,p); }
  else if (E.door==='dutch'){ mk(G.box(1.0,1.8,0.1),tr,0,0.9,0,p); mk(G.box(0.82,0.82,0.08),dc,0,0.43,0.03,p); mk(G.box(0.82,0.82,0.08),dc,0,1.28,0.03,p); mk(G.box(0.95,0.06,0.18),tr,0,0.86,0.08,p); mk(G.box(0.4,0.4,0.06),windowMat,0,1.3,0.07,p); mk(G.sph(0.05,8,6),knob,0.3,0.9,0.12,p); }
  else { mk(G.box(1.0,1.8,0.1),tr,0,0.9,0,p); mk(G.box(0.8,1.62,0.08),dc,0,0.83,0.03,p); for(const s of [-1,1]) mk(G.box(0.02,1.5,0.09),M(new THREE.Color(E.doorC).offsetHSL(0,0,-0.1).getHex()),s*0.14,0.82,0.035,p); mk(G.cyl(0.12,0.12,0.04,14),windowMat,0,1.32,0.08,p).rotation.x=Math.PI/2; mk(G.sph(0.05,8,6),knob,0.28,0.8,0.09,p); }
  return p;
}

/* ---------- Player house, outside. Origin = lot center. ---------- */
export function buildCustomHouse(home){
  const { GW, GD, EC } = BUILD; const plan=home.plan, E=home.ext; const g=new THREE.Group();
  const occ=planGrid(plan); const cx=i=>(i-GW/2)*EC, cz=j=>(j-GD/2)*EC; const F=0.35, H = E.stories===2 ? 4.3 : 2.35;
  const rects=[]; let chimney=null, best=null;
  const foundKind = { stone:['stone',0xa8a8a0], brick:['brick',0xb5523b], wood:['lattice',0xc8a878], none:['stucco',0x9a948a] }[E.found]||['stone',0xa8a8a0];
  plan.rooms.forEach(r=>{
    const x0=cx(r.x), x1=cx(r.x+r.w), z0=cz(r.z), z1=cz(r.z+r.d), W=x1-x0, D=z1-z0, mx=(x0+x1)/2, mz=(z0+z1)/2;
    rects.push([x0,z0,x1,z1]);
    const fh = E.found==='none' ? 0.15 : F; const fd=texBox(foundKind[0], foundKind[1], W+0.2, fh+0.8, D+0.2, 0.9); fd.position.set(mx,(fh-0.8)/2,mz); g.add(fd); fd.castShadow=true; fd.receiveShadow=true;
    const wl=texBox(E.wall, E.wallC, W, H, D); wl.position.set(mx, F+H/2, mz); wl.castShadow=wl.receiveShadow=true; g.add(wl);
    mk(G.box(W+0.12,0.12,D+0.12), M(E.trimC), mx, F+H, mz, g);
    if (E.stories===2) mk(G.box(W+0.1,0.1,D+0.1), M(E.trimC), mx, F+2.15, mz, g);
    for (const ax of [x0,x1]) for (const az of [z0,z1]) mk(G.box(0.14,H,0.14), M(E.trimC), ax, F+H/2, az, g);
    const rg=new THREE.Group(); rg.position.set(mx,0,mz); g.add(rg);
    const rise=roofOn(rg, E.roof, W, D, F+H, E.roofC, E.trimC, E.wall, E.wallC);
    if (!best || r.w*r.d>best.a) best={ a:r.w*r.d, x:x1-Math.min(0.7,W*0.25), z:z0+Math.min(0.7,D*0.3), top:F+H+rise+0.6 };
  });
  // windows on outside edges (every other cell, skipping the door)
  const d=plan.door; const rows = E.stories===2 ? [F+1.25, F+3.3] : [F+1.3];
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ if (occ[j][i]<0) continue;
    const empty=(a,b)=>!(occ[b]?.[a]>=0);
    const sides=[ [0,1, cx(i)+EC/2, cz(j+1)+0.03, 0], [0,-1, cx(i)+EC/2, cz(j)-0.03, Math.PI], [1,0, cx(i+1)+0.03, cz(j)+EC/2, Math.PI/2], [-1,0, cx(i)-0.03, cz(j)+EC/2, -Math.PI/2] ];
    sides.forEach(([di,dj,x,z,ry],k)=>{ if(!empty(i+di,j+dj)) return; const isDoor = d && d.i===i && d.j===j && dj===1;
      rows.forEach((y,ri)=>{ if (isDoor && ri===0) return; if (isDoor && ri===1){ houseWindow(g,x,y,z,ry,E,0.8); return; } if ((i+j+k+ri)%2===0) houseWindow(g,x,y,z,ry,E,0.85); }); });
  }
  // front door, porch, lamps
  let doorPt=[0,0], porchD=0;
  if (d){ const x=cx(d.i)+EC/2, z=cz(d.j+1); doorPt=[x,z];
    houseDoor(g, x, F, z+0.03, E);
    if (E.lamps) for (const s of [-1,1]){ const l=new THREE.Group(); l.position.set(x+s*0.72,F+1.55,z+0.12); g.add(l); mk(G.box(0.16,0.24,0.16), glowMat(0xffd27a), 0,0,0.04,l); mk(G.cone(0.15,0.1,4), M(0x3a2e26), 0,0.16,0.04,l).rotation.y=Math.PI/4; addGlow(l,0,2.2); }
    // porch spans the door cell and its front-facing neighbours in the same room
    const k=occ[d.j][d.i]; let a=d.i, b=d.i; const front=(i)=>occ[d.j][i]===k && !(d.j+1<GD && occ[d.j+1][i]>=0);
    while (a-1>=0 && front(a-1) && d.i-(a-1)<=1) a--; while (b+1<GW && front(b+1) && (b+1)-d.i<=1) b++;
    const px0=cx(a)+0.05, px1=cx(b+1)-0.05, pw=px1-px0, pmx=(px0+px1)/2;
    if (E.porch==='deck'||E.porch==='covered'){ porchD=1.5;
      const deck=mk(G.box(pw,0.14,porchD), tiled('wood',0xc99a6a,pw,porchD,1.0), pmx,F-0.04,z+porchD/2,g);
      for (const s of [-1,1]) mk(G.box(0.12,F+0.4,0.12), M(0x8b5e3a), pmx+s*(pw/2-0.08), (F-0.4)/2, z+porchD-0.08, g);
      for (let s=0;s<2;s++) mk(G.box(1.0,0.12,0.36), M(0xc0b8a8), x, F-0.18-s*0.17, z+porchD+0.18+s*0.34, g);
      for (const s of [-1,1]){ if (Math.abs(pw)<2.2) continue; mk(G.box(0.06,0.6,porchD-0.1), M(E.trimC), pmx+s*(pw/2-0.05), F+0.3, z+porchD/2, g); }
      if (E.porch==='covered'){ for (const s of [-1,1]) mk(G.cyl(0.07,0.08,2.0,10), M(E.trimC), pmx+s*(pw/2-0.15), F+1.0, z+porchD-0.15, g);
        const pr=mk(G.box(pw+0.4,0.12,porchD+0.4), tiled('roof',E.roofC,pw+0.4,porchD+0.4,1.0), pmx, F+2.1, z+porchD/2, g); pr.rotation.x=0.22; porchD+=0.1; }
    } else if (E.porch==='step'){ porchD=0.7; for (let s=0;s<2;s++) mk(G.box(1.2,0.14,0.36), M(0xc0b8a8), x, F-0.1-s*0.15, z+0.2+s*0.32, g); }
    else { porchD=0.3; mk(G.box(1.1,0.12,0.4), M(0xb8b0a0), x, 0.1, z+0.2, g); }
  }
  if (E.chimney!=='none' && best){ const ch=new THREE.Group(); ch.position.set(best.x,0,best.z); g.add(ch); const h=best.top; const cm=E.chimney==='stone'?['stone',0xa8a8a0]:['brick',0xb06a50];
    const cb=texBox(cm[0],cm[1],0.5,h-F,0.5,0.7); cb.position.y=F+(h-F)/2; ch.add(cb); cb.castShadow=true; mk(G.box(0.62,0.12,0.62), M(0x5a4a40), 0,h,0,ch); chimney=new THREE.Vector3(best.x,h+0.2,best.z); }
  // mailbox at the front left of the lot
  const mb=new THREE.Group(); mb.position.set(cx(0)-0.2,0,cz(GD)+0.6); FURN_BUILDERS.mailbox(mb); g.add(mb);
  g.userData={ chimney, door:doorPt, porchD, rects, size:{W:GW*EC,D:GD*EC} };
  return g;
}

/* ---------- Player house, inside. Origin = grid center. ---------- */
const FLOOR_KIND = { wood:'wood', parquet:'parquet', tile:'tile', stone:'stone', carpet:'carpet' };
export function buildHomeInterior(home){
  const { GW, GD, IC } = BUILD; const plan=home.plan; const g=new THREE.Group(); const occ=planGrid(plan);
  const cx=i=>(i-GW/2)*IC, cz=j=>(j-GD/2)*IC; const WH=3.0, T=0.16;
  const walls=[], segs=[]; let bb=[1e9,1e9,-1e9,-1e9];
  const paperMat = (r, len) => tiled(r.paper==='plain'?'stucco':'p:'+r.paper, r.paperC, len, WH, 1.6);
  plan.rooms.forEach(r=>{ const x0=cx(r.x), x1=cx(r.x+r.w), z0=cz(r.z), z1=cz(r.z+r.d);
    bb=[Math.min(bb[0],x0),Math.min(bb[1],z0),Math.max(bb[2],x1),Math.max(bb[3],z1)];
    const fl=mk(G.box(x1-x0,0.1,z1-z0), tiled(FLOOR_KIND[r.floor]||'wood', r.floorC, x1-x0, z1-z0, r.floor==='tile'?2.4:1.6, {roughness:r.floor==='tile'?0.5:0.85}), (x0+x1)/2,-0.05,(z0+z1)/2,g); fl.castShadow=false; });
  // a wall piece. horiz = runs along x (constant z). side = which way the room is (+1 / -1) for the paper face.
  const piece=(xa,za,xb,zb,room,side,h=WH,y0=0,shared)=>{
    const horiz=Math.abs(za-zb)<1e-6, len=horiz?Math.abs(xb-xa):Math.abs(zb-za); if (len<0.02) return null;
    const th = shared ? T/2 : T; const geo = horiz ? G.box(len,h,th) : G.box(th,h,len); geo.translate(0,h/2,0);
    const m=new THREE.Mesh(geo, paperMat(room, len)); m.castShadow=false; m.receiveShadow=true;
    const off = shared ? side*th/2 : -side*th/2; // shared halves sit on their room's side; outer walls sit outside the room
    m.position.set(horiz?(xa+xb)/2:xa+off, y0, horiz?za+off:(za+zb)/2); g.add(m);
    return m;
  };
  const addWall=(xa,za,xb,zb,kind,rA,sA,rB,sB,gap)=>{
    const horiz=Math.abs(za-zb)<1e-6; const ms=[]; const lintels=[];
    const parts = gap ? [[0, gap[0]], [gap[1], 1]] : [[0,1]];
    const P=(t)=>[xa+(xb-xa)*t, za+(zb-za)*t];
    for (const [t0,t1] of parts){ const [ax,az]=P(t0), [bx,bz]=P(t1); if (Math.hypot(bx-ax,bz-az)<0.02) continue; segs.push([ax,az,bx,bz]);
      if (kind==='ext'){ const m=piece(ax,az,bx,bz,rA,sA); m&&ms.push(m); } else { const m1=piece(ax,az,bx,bz,rA,sA,WH,0,true), m2=piece(ax,az,bx,bz,rB,sB,WH,0,true); m1&&ms.push(m1); m2&&ms.push(m2); } }
    if (gap){ const [ax,az]=P(gap[0]), [bx,bz]=P(gap[1]); const geo=horiz?G.box(Math.abs(bx-ax),WH-2.3,T):G.box(T,WH-2.3,Math.abs(bz-az)); const l=new THREE.Mesh(geo, M(0xf2ead8)); l.position.set((ax+bx)/2+(kind==='ext'&&!horiz?-sA*T/2:0), 2.3+(WH-2.3)/2, (az+bz)/2+(kind==='ext'&&horiz?-sA*T/2:0)); g.add(l); lintels.push(l);
      for (const t of gap){ const [px,pz]=P(t); const post=mk(horiz?G.box(0.1,2.3,T+0.04):G.box(T+0.04,2.3,0.1), M(0xf2ead8), px+(kind==='ext'&&!horiz?-sA*T/2:0), 1.15, pz+(kind==='ext'&&horiz?-sA*T/2:0), g); post.castShadow=false; lintels.push(post); } }
    walls.push({ meshes:ms, lintels, horiz, z: horiz?za:null });
  };
  // outer walls, merged along runs
  const d=plan.door; let doorPt=[0,0];
  const runs=[]; // [line, a, b, dir, roomIdx]
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ const k=occ[j][i]; if (k<0) continue;
    const e=(a,b)=>!(occ[b]?.[a]>=0);
    if (e(i,j-1)) runs.push({ horiz:true, z:cz(j), a:cx(i), b:cx(i+1), side:+1, k, cell:[i,j], front:false });
    if (e(i,j+1)) runs.push({ horiz:true, z:cz(j+1), a:cx(i), b:cx(i+1), side:-1, k, cell:[i,j], front:true });
    if (e(i-1,j)) runs.push({ horiz:false, x:cx(i), a:cz(j), b:cz(j+1), side:+1, k, cell:[i,j] });
    if (e(i+1,j)) runs.push({ horiz:false, x:cx(i+1), a:cz(j), b:cz(j+1), side:-1, k, cell:[i,j] });
  }
  for (const r of runs){ const room=plan.rooms[r.k]; const isDoor = r.front && d && d.i===r.cell[0] && d.j===r.cell[1];
    if (r.horiz){ const gap = isDoor ? [(IC/2-0.65)/IC, (IC/2+0.65)/IC] : null; if (isDoor) doorPt=[(r.a+r.b)/2, r.z];
      addWall(r.a, r.z, r.b, r.z, 'ext', room, r.side, null, 0, gap);
      if (!r.front && (r.cell[0]%2===0)){ const w=new THREE.Group(); w.position.set((r.a+r.b)/2,1.7,r.z+0.02); g.add(w); mk(G.box(1.1,1.0,0.06),M(0xffffff),0,0,0,w); mk(G.box(0.92,0.82,0.04),windowMat,0,0,0.03,w); mk(G.box(0.05,0.82,0.06),M(0xffffff),0,0,0.05,w); mk(G.box(1.2,0.08,0.16),M(0xffffff),0,-0.5,0.06,w); }
    } else addWall(r.x, r.a, r.x, r.b, 'ext', room, r.side, null, 0, null);
  }
  // inside walls between rooms
  const shared=new Map();
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ const k=occ[j][i]; if (k<0) continue;
    for (const [di,dj] of [[1,0],[0,1]]){ const n=occ[j+dj]?.[i+di]; if (n===undefined||n<0||n===k) continue;
      const A=plan.rooms[k], B=plan.rooms[n]; const key=linkKey(A.id,B.id)+(dj?':h':':v');
      if (!shared.has(key)) shared.set(key, { A:k, B:n, horiz:!!dj, cells:[] }); shared.get(key).cells.push([i,j]); } }
  for (const s of shared.values()){
    const A=plan.rooms[s.A], B=plan.rooms[s.B], type=linkOf(plan,A.id,B.id); if (type==='open') continue;
    s.cells.sort((p,q)=>s.horiz?p[0]-q[0]:p[1]-q[1]);
    const a0 = s.horiz ? cx(s.cells[0][0]) : cz(s.cells[0][1]), a1 = s.horiz ? cx(s.cells[s.cells.length-1][0]+1) : cz(s.cells[s.cells.length-1][1]+1);
    const len=a1-a0, gap = type==='door' ? [(len/2-0.65)/len, (len/2+0.65)/len] : null;
    // side: A is above (lower z) / left of B
    if (s.horiz){ const z=cz(s.cells[0][1]+1); addWall(a0,z,a1,z,'int',A,-1,B,+1,gap); }
    else { const x=cx(s.cells[0][0]+1); addWall(x,a0,x,a1,'int',A,-1,B,+1,gap); }
  }
  // front door frame inside
  if (d){ mk(G.box(1.3,0.08,0.3), M(0x8b5e3a), doorPt[0], 0.04, doorPt[1]+0.1, g).castShadow=false; mk(G.box(1.1,0.04,0.6), M(0xc04a3a), doorPt[0], 0.02, doorPt[1]-0.5, g).castShadow=false; }
  const light=new THREE.PointLight(0xffe0b0, 40, 26, 1.4); light.position.set((bb[0]+bb[2])/2, 2.8, (bb[1]+bb[3])/2+0.5); g.add(light);
  g.userData={ walls, segs, door:doorPt, bbox:bb, occ };
  return g;
}

/* ---------- Shops and museum (outside) ---------- */
function signBoard(text, bg='#fff1d6', fg='#5b4336', w=2.4){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const x=cv.getContext('2d');
  x.fillStyle=bg; x.fillRect(0,0,512,128); x.fillStyle=fg; x.font='700 58px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,256,68);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; const g=new THREE.Group();
  mk(G.box(w+0.12,w/4+0.12,0.08), M(0x8b5e3a), 0,0,0,g); mk(G.box(w,w/4,0.1), new THREE.MeshStandardMaterial({ map:t, roughness:0.8 }), 0,0,0.01,g); return g;
}
export function buildShopBuilding(kind, tier=0){
  const g=new THREE.Group(); const W=5.2, D=4.2, F=0.3;
  if (kind==='aquarium'){
    const H=2.6; const wall=texBox('siding',0x8ad0d8,W,H,D); wall.position.set(0,F+H/2,0); g.add(wall); wall.castShadow=wall.receiveShadow=true;
    mk(G.box(W+0.3,F,D+0.3), M(0xd8d0c0), 0,F/2,0,g); const rg=new THREE.Group(); g.add(rg); roofOn(rg,'gable',W,D,F+H,0x2f6ab0,0xffffff,'siding',0x8ad0d8);
    for (const s of [-1,1]){ const pw=new THREE.Group(); pw.position.set(s*1.55,F+1.4,D/2+0.03); g.add(pw); mk(G.tor(0.36,0.08,8,20),M(0xd8a040,{metalness:0.6,roughness:0.3}),0,0,0,pw); mk(G.cyl(0.36,0.36,0.04,20),windowMat,0,0,0,pw).rotation.x=Math.PI/2; }
    const sign=signBoard('Tidepool','#2f6ab0','#ffffff',2.6); sign.position.set(0,F+H+0.45,D/2+0.3); g.add(sign);
    const fish=new THREE.Group(); fish.position.set(0,F+H+1.6,0.8); g.add(fish); const fb=mk(G.sph(0.5,16,12),M(0xf2894a),0,0,0,fish); fb.scale.set(1.5,0.8,0.4); const ft=mk(G.cone(0.4,0.5,4),M(0xf2894a),-0.9,0,0,fish); ft.rotation.z=Math.PI/2; mk(G.sph(0.08,8,6),M(0x222222),0.45,0.12,0.18,fish); g.userData.spin=fish;
    for (const s of [-1,1]){ mk(G.cyl(0.08,0.08,0.9,8),M(0x8b5e3a),s*1.6,0.45,D/2+1.4,g); } const rope=mk(G.cyl(0.03,0.03,3.2,6),M(0xd8c8a0),0,0.75,D/2+1.4,g); rope.rotation.z=Math.PI/2;
    if (tier>=1){ for(let i=0;i<6;i++){ const s=mk(G.box(0.55,0.05,1.0),M(i%2?0xffffff:0x2f8ac0),-1.38+i*0.55,F+2.3,D/2+0.45,g); s.rotation.x=0.35; } }
    if (tier>=2){ const wg=texBox('siding',0x8ad0d8,2.4,2.2,3.2); wg.position.set(W/2+1.2,F+1.1,-0.3); g.add(wg); const r2=new THREE.Group(); r2.position.set(W/2+1.2,0,-0.3); g.add(r2); roofOn(r2,'shed',2.4,3.2,F+2.2,0x2f6ab0,0xffffff,'siding',0x8ad0d8); const tk=mk(G.box(1.6,1.0,0.06),M(0x9ad8e8,{transparent:true,opacity:0.7,roughness:0.1}),W/2+1.2,F+1.2,1.32,g); }
    if (tier>=3){ const tw=new THREE.Group(); tw.position.set(-W/2+0.6,0,-D/2+0.6); g.add(tw); const c=texBox('siding',0xffffff,1.2,6.4,1.2); c.position.y=3.2; tw.add(c); for(let k=0;k<3;k++) mk(G.box(1.24,0.4,1.24),M(0xe2483d),0,1.2+k*1.8,0,tw); mk(G.cyl(0.5,0.5,0.7,10),glowMat(0xfff0b0),0,6.8,0,tw); mk(G.cone(0.7,0.6,10),M(0xe2483d),0,7.45,0,tw); addGlow(tw,6.8,4.5); }
  } else if (kind==='garden'){
    const H=2.4; const frame=M(0xf2ead8), glass=new THREE.MeshStandardMaterial({ color:0xc8f0d8, transparent:true, opacity:0.42, roughness:0.08, metalness:0.1, depthWrite:false });
    mk(G.box(W+0.3,F,D+0.3), M(0xb8a88a), 0,F/2,0,g); const back=texBox('brick',0xb06a50,W,1.0,D); back.position.set(0,F+0.5,0); g.add(back);
    const gl=mk(G.box(W-0.1,H-1.0,D-0.1), glass, 0,F+1.0+(H-1.0)/2,0,g); gl.castShadow=false;
    for (let i=0;i<=5;i++){ const x=-W/2+i*W/5; for (const z of [-D/2,D/2]) mk(G.box(0.08,H,0.08),frame,x,F+H/2,z,g); }
    for (let i=0;i<=4;i++){ const z=-D/2+i*D/4; for (const x of [-W/2,W/2]) mk(G.box(0.08,H,0.08),frame,x,F+H/2,z,g); }
    const roof=new THREE.Group(); g.add(roof); const pitch=0.6, hd=D/2+0.15, Ls=hd/Math.cos(pitch), rise=hd*Math.tan(pitch);
    for (const s of [1,-1]){ const sl=new THREE.Group(); sl.position.set(0,F+H+rise/2,s*hd/2); sl.rotation.x=s*pitch; roof.add(sl); const pg=mk(G.box(W+0.2,0.04,Ls),glass,0,0,0,sl); pg.castShadow=false; for(let i=0;i<=6;i++) mk(G.box(0.06,0.08,Ls),frame,-W/2-0.1+i*(W+0.2)/6,0.03,0,sl); }
    mk(G.box(W+0.3,0.12,0.14),frame,0,F+H+rise,0,roof);
    for (let i=0;i<5;i++){ const p=new THREE.Group(); p.position.set(-1.8+i*0.9,F+1.1,-0.6+(i%2)*0.9); g.add(p); mk(G.cyl(0.18,0.14,0.28,10),M(0xd27a4f),0,0.14,0,p); mk(G.ico(0.22,1),M(i%2?0x5fae43:0x7cc35a),0,0.42,0,p); }
    const dr=mk(G.box(1.0,1.9,0.08),frame,0,F+0.95,D/2+0.02,g); mk(G.box(0.8,1.7,0.04),glass,0,F+0.95,D/2+0.06,g);
    const sign=signBoard('Bug & Bloom','#7cb85a','#ffffff',2.6); sign.position.set(0,F+H+0.35,D/2+0.25); g.add(sign);
    const fc=[0xff7f7f,0xffd04d,0xc7a0ff,0xffffff]; for (const s of [-1,1]){ mk(G.box(1.2,0.35,0.45),M(0x8b5e3a),s*1.8,0.18,D/2+0.6,g); for(let k=0;k<5;k++) mk(G.ico(0.1,1),M(fc[k%4]),s*1.8-0.45+k*0.22,0.46,D/2+0.6,g); }
    if (tier>=1){ const arch=new THREE.Group(); arch.position.set(0,0,D/2+2.2); g.add(arch); FURN_BUILDERS.rosearch(arch); }
    if (tier>=2){ const wg=new THREE.Group(); wg.position.set(-W/2-1.3,0,0); g.add(wg); mk(G.box(2.4,F,3.2),M(0xb8a88a),0,F/2,0,wg); const gg=mk(G.box(2.3,2.0,3.1),glass,0,F+1.0,0,wg); gg.castShadow=false; for(const x of [-1.2,1.2]) for(const z of [-1.6,1.6]) mk(G.box(0.08,2.1,0.08),frame,x,F+1.05,z,wg); mk(G.box(2.5,0.1,3.3),frame,0,F+2.05,0,wg); for(let k=0;k<4;k++) mk(G.ico(0.3,1),M(0x4f9a3a),-0.6+(k%2)*1.2,F+0.6,-0.8+Math.floor(k/2)*1.6,wg); }
    if (tier>=3){ const dome=mk(G.sph(1.6,20,12,0,TAU,0,Math.PI/2),glass,W/2+1.6,F,0,g); dome.castShadow=false; mk(G.tor(1.6,0.06,6,24),frame,W/2+1.6,F+0.02,0,g).rotation.x=Math.PI/2; for(let k=0;k<6;k++){ const a=k/6*Math.PI; const rb=mk(G.tor(1.6,0.04,6,24,Math.PI),frame,W/2+1.6,F,0,g); rb.rotation.y=a; } mk(G.ico(0.7,1),M(0x3f8a3a),W/2+1.6,F+0.7,0,g); }
  }
  g.userData.door=[0, D/2]; g.userData.rects=[[-W/2,-D/2,W/2,D/2]];
  if (kind==='aquarium' && tier>=2) g.userData.rects.push([W/2,-1.9,W/2+2.4,1.3]);
  if (kind==='garden' && tier>=2) g.userData.rects.push([-W/2-2.5,-1.6,-W/2,1.6]);
  if (kind==='garden' && tier>=3) g.userData.rects.push([W/2,-1.6,W/2+3.2,1.6]);
  if (kind==='aquarium' && tier>=3) g.userData.rects.push([-W/2,-D/2,-W/2+1.2,-D/2+1.2]);
  return g;
}
export function buildMuseum(){
  const g=new THREE.Group(); const W=9.5, D=6.5, F=0.6, H=3.4; const stone=0xe8e0d0;
  const base=texBox('stone',0xc8c0b0,W+0.6,F,D+0.6,1.2); base.position.y=F/2; g.add(base);
  const body=texBox('stucco',stone,W,H,D); body.position.y=F+H/2; g.add(body); body.castShadow=body.receiveShadow=true;
  for (let s=0;s<3;s++) mk(G.box(4.2-s*0.3,0.2,0.5), M(0xd8d0c0), 0, F-0.1-s*0.2, D/2+0.4+s*0.45, g);
  for (let i=0;i<6;i++){ const x=-3.75+i*1.5; const c=mk(G.cyl(0.24,0.28,H,14),M(0xf4efe4),x,F+H/2,D/2+0.6,g); mk(G.box(0.62,0.18,0.62),M(0xf4efe4),x,F+H-0.02,D/2+0.6,g); mk(G.box(0.62,0.18,0.62),M(0xf4efe4),x,F+0.09,D/2+0.6,g); }
  mk(G.box(W+0.4,0.4,D+1.6), M(0xf4efe4), 0,F+H+0.2,0.5,g);
  const tri=new THREE.Shape(); tri.moveTo(-W/2-0.2,0); tri.lineTo(W/2+0.2,0); tri.lineTo(0,1.3); tri.lineTo(-W/2-0.2,0);
  mk(new THREE.ExtrudeGeometry(tri,{depth:0.3,bevelEnabled:false}), M(0xf4efe4), 0, F+H+0.4, D/2+0.95, g);
  const rf=new THREE.Group(); rf.position.set(0,0,0); g.add(rf); roofOn(rf,'gable',W+0.4,D+0.6,F+H+0.4,0x5a7a8a,0xf4efe4,'stucco',stone);
  const dome=mk(G.sph(1.5,24,14,0,TAU,0,Math.PI/2), M(0x6aa8a0,{metalness:0.3,roughness:0.5}), 0,F+H+2.4,-0.8,g); mk(G.cyl(1.55,1.55,0.6,24),M(0xf4efe4),0,F+H+2.1,-0.8,g); mk(G.sph(0.18,10,8),M(0xf3c35a,{metalness:0.7,roughness:0.3}),0,F+H+4.0,-0.8,g);
  const dr=mk(G.box(1.5,2.4,0.1),M(0x5a3a2a),0,F+1.2,D/2+0.05,g); mk(G.cyl(0.75,0.75,0.1,16,1,false,0,Math.PI),M(0x5a3a2a),0,F+2.4,D/2+0.05,g).rotation.set(Math.PI/2,0,Math.PI/2);
  const sign=signBoard('Museum','#f4efe4','#5a4a3a',2.4); sign.position.set(0,F+H+0.9,D/2+1.12); g.add(sign);
  for (const s of [-1,1]){ const b=mk(G.box(0.7,1.8,0.04),M(s>0?0xb5523b:0x2f6ab0),s*2.2,F+2.0,D/2+0.92,g); b.castShadow=false; }
  for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*3.1,0,D/2+2.4); g.add(p); mk(G.box(0.7,0.5,0.7),M(0xd8d0c0),0,0.25,0,p); mk(G.ico(0.42,1),M(0x5fae43),0,0.8,0,p); }
  g.userData.door=[0, D/2+1.6]; g.userData.rects=[[-W/2-0.3,-D/2-0.3,W/2+0.3,D/2+1.0],[-2.2,D/2+1.0,2.2,D/2+1.6]];
  return g;
}

/* ---------- Shopkeepers ---------- */
export function buildKeeper(spec){
  const a=buildAnimal(spec); const u=a.userData;
  if (spec.species==='tortoise'){ const sh=outline(mk(G.sph(0.5,16,12,0,TAU,0,Math.PI/2), M(0x6a7a4a), 0,0.75,-0.32,u.body)); sh.rotation.x=-Math.PI/2+0.2; sh.scale.set(1,1,0.8);
    for(let i=0;i<5;i++){ const a2=i/5*TAU; mk(G.cyl(0.12,0.12,0.03,6),M(0x8a9a5a),Math.cos(a2)*0.22,0.75+Math.sin(a2)*0.22,-0.72,u.body).rotation.x=Math.PI/2; }
    for (const s of [-1,1]){ const gl=mk(G.tor(0.1,0.02,6,16),M(0x3a2a20),s*0.19,0.07,0.47,u.head); } mk(G.box(0.12,0.02,0.02),M(0x3a2a20),0,0.08,0.48,u.head); }
  if (spec.species==='fox'){ const t=outline(mk(G.sph(0.22,12,10),M(spec.fur),0,0.6,-0.55,u.body)); t.scale.set(0.8,0.8,2); t.rotation.x=0.6; mk(G.sph(0.14,10,8),M(0xffffff),0,0.85,-0.85,u.body); }
  if (spec.species==='otter'){ const t=mk(G.cap(0.08,0.6,4,8),M(spec.fur),0,0.4,-0.5,u.body); t.rotation.x=-1.2; for(const s of [-1,1]) for(let k=0;k<2;k++){ const w=mk(G.cyl(0.004,0.004,0.3,3),M(0xffffff),s*0.28,-0.12+k*0.05,0.42,u.head); w.rotation.z=Math.PI/2+s*0.1*(k?1:-1); } }
  if (spec.stripe){ const st=mk(G.box(0.16,0.05,0.9),M(0xffffff),0,0.47,-0.05,u.head); st.rotation.x=-0.3; for(const s of [-1,1]){ const e=mk(G.box(0.12,0.04,0.5),M(0x3a3a40),s*0.2,0.22,0.3,u.head); e.rotation.set(-0.3,0,s*0.25); } }
  if (spec.id==='pemberton'||spec.id==='sprig'||spec.id==='marlo'){ const ap=mk(G.box(0.62,0.62,0.06),M(spec.id==='marlo'?0xffffff:0xf2ead8),0,0.72,0.4,u.body); ap.rotation.x=0.08; }
  return a;
}

/* ---------- Mossby, the grumpy little tree keeper ---------- */
export function buildMossby(){
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const moss=M(0x6a9a4a), mossD=M(0x557f3a), face=M(0xc8d8a0);
  const b=outline(mk(G.sph(0.32,18,14), moss, 0,0.36,0,body)); b.scale.set(1,1.05,0.95);
  for(let i=0;i<9;i++){ const a=i/9*TAU; const t=mk(G.ico(0.09,0), mossD, Math.cos(a)*0.28, 0.32+Math.sin(i*2.3)*0.12, Math.sin(a)*0.26, body); t.castShadow=false; }
  mk(G.sph(0.2,14,10), face, 0,0.34,0.17,body).scale.set(1,0.9,0.6);
  for(const s of [-1,1]){ mk(G.sph(0.035,8,6), M(0x221a1a), s*0.08,0.4,0.29,body); const br=mk(G.box(0.16,0.05,0.06), M(0xf2ead8), s*0.1,0.48,0.27,body); br.rotation.z=s*-0.45; }
  const mo=mk(G.tor(0.05,0.012,6,12,Math.PI), M(0x5a2a2a), 0,0.28,0.29,body); // frown
  const cap=new THREE.Group(); cap.position.y=0.62; body.add(cap); const c=outline(mk(G.sph(0.24,16,10,0,TAU,0,Math.PI/2), M(0x8a5a32), 0,0,0,cap)); c.scale.set(1,0.6,1);
  for(let i=0;i<10;i++){ const a=i/10*TAU; mk(G.box(0.04,0.02,0.18),M(0x6a4422),Math.cos(a)*0.16,0.07,Math.sin(a)*0.16,cap).rotation.y=-a; }
  mk(G.cyl(0.02,0.03,0.14,5), M(0x6a4422), 0,0.2,0,cap); const lf=mk(G.sph(0.08,8,4), M(0x7cc35a), 0.08,0.26,0,cap); lf.scale.set(1.6,0.35,0.8);
  const arms=[]; for(const s of [-1,1]){ const a=new THREE.Group(); a.position.set(s*0.3,0.36,0.02); body.add(a); const tw=mk(G.cyl(0.018,0.025,0.26,5), M(0x7a5232), s*0.1,-0.04,0,a); tw.rotation.z=s*1.1; const f=mk(G.cyl(0.012,0.015,0.1,4),M(0x7a5232),s*0.2,0.03,0,a); f.rotation.z=s*0.3; arms.push(a); }
  const legs=[]; for(const s of [-1,1]){ const l=mk(G.cyl(0.05,0.06,0.12,8), M(0x7a5232), s*0.12,0.06,0,g); legs.push(l); }
  g.userData={ body, arms, legs, mouth:mo }; return g;
}

/* ---------- Museum exhibits ---------- */
function fitInside(m, w, h, d){ const box=new THREE.Box3().setFromObject(m), s=box.getSize(new THREE.Vector3()); const k=Math.min(w/(s.x||1), h/(s.y||1), d/(s.z||1)); m.scale.multiplyScalar(k); const b2=new THREE.Box3().setFromObject(m); m.position.y -= b2.min.y; return m; }
export function buildExhibit(id, kind){
  const g=new THREE.Group(); const wood=M(0x6a4a3a), glass=new THREE.MeshStandardMaterial({ color:0xd8f0ff, transparent:true, opacity:0.22, roughness:0.05, depthWrite:false });
  if (kind==='fish'){
    mk(G.box(1.1,0.6,0.7),wood,0,0.3,0,g); const water=mk(G.box(1.0,0.72,0.6),new THREE.MeshStandardMaterial({ color:0x6ad0e8, transparent:true, opacity:0.35, roughness:0.05, depthWrite:false }),0,0.97,0,g); water.castShadow=false;
    mk(G.box(1.0,0.08,0.6),M(0xf3dca6),0,0.64,0,g); mk(G.box(1.06,0.05,0.66),M(0x3a2a20),0,1.35,0,g);
    for(let k=0;k<3;k++){ const w=mk(G.cyl(0.015,0.02,0.25+k*0.08,4),M(0x4f9a3a),-0.35+k*0.1,0.75+k*0.04,-0.15,g); }
    const f=fitInside(buildItemModel(id),0.8,0.45,0.4); f.position.y+=0.78; f.rotation.y=Math.PI/2; g.add(f); g.userData.swim=f;
  } else if (kind==='bug'){
    mk(G.cyl(0.32,0.36,0.65,12),wood,0,0.32,0,g); mk(G.cyl(0.3,0.3,0.05,16),M(0x8a6a3a),0,0.67,0,g);
    const dome=mk(G.sph(0.3,16,10,0,TAU,0,Math.PI/2),glass,0,0.68,0,g); dome.castShadow=false; dome.scale.y=1.4;
    mk(G.cyl(0.015,0.02,0.3,4),M(0x7a5232),0.08,0.82,0,g).rotation.z=0.3;
    const b=fitInside(buildItemModel(id),0.36,0.3,0.36); b.position.y+=0.72; g.add(b);
  } else {
    mk(G.box(0.7,0.7,0.7),M(0xe8e0d0),0,0.35,0,g); mk(G.box(0.8,0.08,0.8),M(0xd8d0c0),0,0.72,0,g); mk(G.box(0.8,0.08,0.8),M(0xd8d0c0),0,0.04,0,g);
    const sz = kind==='fossil'?0.7:0.5; const it=fitInside(buildItemModel(id),sz,sz,sz); it.position.y+=0.76; g.add(it); g.userData.spin=it;
  }
  return g;
}

/* ---------- New furniture ---------- */
const WOOD=0xa8754a, WOOD2=0x8b5e3a;
Object.assign(FURN_BUILDERS, {
  counter(g){ mk(G.box(2.4,1.0,0.7), M(WOOD), 0,0.5,0,g); mk(G.box(2.5,0.08,0.8), M(0xc99a6a), 0,1.02,0,g); mk(G.box(0.28,0.22,0.22), M(0xd8a040,{metalness:0.5,roughness:0.4}), 0.8,1.17,0,g); mk(G.cyl(0.14,0.12,0.2,10), M(0xbfe6f0,{transparent:true,opacity:0.7}), -0.8,1.15,0,g); },
  shelfstock(g){ mk(G.box(1.8,1.9,0.5), M(WOOD2), 0,0.95,0,g); const cols=[0xe2483d,0x4a7ad8,0xf0c040,0x5aae46,0xf08a5a,0x8a4fa8]; for(let s=0;s<3;s++){ mk(G.box(1.7,0.05,0.46),M(0xc99a6a),0,0.4+s*0.55,0.02,g); for(let i=0;i<5;i++){ const c=cols[(i+s)%6]; if((i+s)%3===0) mk(G.cyl(0.11,0.11,0.3,10),M(c),-0.64+i*0.32,0.58+s*0.55,0.06,g); else mk(G.box(0.24,0.3,0.24),M(c),-0.64+i*0.32,0.58+s*0.55,0.06,g); } } },
  fishtank(g){ mk(G.box(1.0,0.6,0.5),M(WOOD2),0,0.3,0,g); mk(G.box(0.95,0.6,0.45),new THREE.MeshStandardMaterial({color:0x6ad0e8,transparent:true,opacity:0.45,roughness:0.05}),0,0.92,0,g); mk(G.box(0.95,0.06,0.45),M(0xf3dca6),0,0.65,0,g); for(let i=0;i<3;i++){ const f=mk(G.sph(0.06,8,6),M([0xf2894a,0xf0c040,0x4a7ad8][i]),-0.25+i*0.25,0.85+i*0.08,0,g); f.scale.set(1.6,0.9,0.6); } mk(G.cyl(0.015,0.02,0.3,4),M(0x4f9a3a),0.35,0.8,-0.1,g); },
  lifering(g){ mk(G.box(0.08,1.3,0.08),M(WOOD2),0,0.65,-0.05,g); const r=mk(G.tor(0.32,0.09,10,20),M(0xffffff),0,0.95,0.02,g); for(let i=0;i<4;i++){ const s=mk(G.tor(0.32,0.095,10,4,Math.PI/8),M(0xe2483d),0,0.95,0.02,g); s.rotation.z=i*Math.PI/2; } },
  anchor(g){ const ir=M(0x5a6068,{metalness:0.6,roughness:0.5}); mk(G.cyl(0.05,0.05,1.1,8),ir,0,0.7,0,g); mk(G.tor(0.12,0.04,6,12),ir,0,1.32,0,g); mk(G.box(0.55,0.06,0.06),ir,0,1.1,0,g); const arc=mk(G.tor(0.38,0.05,6,16,Math.PI),ir,0,0.38,0,g); arc.rotation.z=Math.PI; for(const s of [-1,1]){ const t=mk(G.cone(0.08,0.18,4),ir,s*0.38,0.42,0,g); } },
  shipwheel(g){ mk(G.box(0.14,1.0,0.14),M(WOOD2),0,0.5,-0.1,g); const w=new THREE.Group(); w.position.set(0,1.05,0); g.add(w); mk(G.tor(0.4,0.04,8,24),M(WOOD),0,0,0,w); mk(G.cyl(0.08,0.08,0.1,10),M(WOOD2),0,0,0,w).rotation.x=Math.PI/2; for(let i=0;i<8;i++){ const sp=mk(G.cyl(0.025,0.025,1.1,6),M(WOOD),0,0,0,w); sp.rotation.z=i*Math.PI/8*2/2+i*Math.PI/8; mk(G.sph(0.045,8,6),M(WOOD2),Math.cos(i*Math.PI/4)*0.55,Math.sin(i*Math.PI/4)*0.55,0,w); } },
  buoylamp(g){ mk(G.cyl(0.25,0.3,0.12,12),M(0x3a3a40),0,0.06,0,g); mk(G.cyl(0.05,0.05,0.8,8),M(0x3a3a40),0,0.5,0,g); const b=mk(G.sph(0.28,16,12),M(0xe2483d),0,1.05,0,g); mk(G.cyl(0.29,0.29,0.1,16),M(0xffffff),0,1.05,0,g); mk(G.sph(0.12,10,8),glowMat(0xfff0b0),0,1.38,0,g); addGlow(g,1.35,2.4); },
  corallamp(g){ mk(G.cyl(0.2,0.25,0.2,12),M(0xf4efe4),0,0.1,0,g); for(let i=0;i<6;i++){ const a=i/6*TAU; const br=mk(G.cyl(0.04,0.06,0.6,6),glowMat(0xf27a9a),Math.cos(a)*0.1,0.45,Math.sin(a)*0.1,g); br.rotation.set(Math.sin(a)*0.4,0,-Math.cos(a)*0.4); mk(G.sph(0.06,8,6),glowMat(0xf8a0b8),Math.cos(a)*0.22,0.72,Math.sin(a)*0.22,g); } addGlow(g,0.6,2.2,0xff9ab0); },
  bigtank(g){ mk(G.box(2.2,0.7,0.9),M(WOOD2),0,0.35,0,g); mk(G.box(2.1,1.1,0.8),new THREE.MeshStandardMaterial({color:0x5ac8e0,transparent:true,opacity:0.45,roughness:0.05}),0,1.25,0,g); mk(G.box(2.1,0.1,0.8),M(0xf3dca6),0,0.75,0,g); for(let i=0;i<7;i++){ const f=mk(G.sph(0.08,8,6),M([0xf2894a,0xf0c040,0x4a7ad8,0xe2483d][i%4]),-0.8+i*0.27,1.0+(i%3)*0.22,(i%2)*0.2-0.1,g); f.scale.set(1.7,0.9,0.6); } for(let k=0;k<5;k++) mk(G.cyl(0.02,0.03,0.4+k*0.1,4),M(0x4f9a3a),-0.9+k*0.45,1.0,-0.25,g); mk(G.box(2.2,0.08,0.9),M(0x3a2a20),0,1.84,0,g); },
  terrarium(g){ mk(G.box(0.8,0.5,0.5),M(WOOD),0,0.25,0,g); mk(G.box(0.75,0.5,0.45),new THREE.MeshStandardMaterial({color:0xd8f0e0,transparent:true,opacity:0.3,roughness:0.05}),0,0.75,0,g); mk(G.box(0.75,0.06,0.45),M(0x6b4a30),0,0.52,0,g); mk(G.cyl(0.015,0.02,0.4,4),M(0x7a5232),-0.1,0.7,0,g).rotation.z=0.4; mk(G.ico(0.12,1),M(0x5fae43),0.2,0.62,0.05,g); const bt=mk(G.sph(0.05,8,6),M(0x2a7a4a),0.02,0.75,0.05,g); bt.scale.set(1,0.6,1.4); },
  skep(g){ mk(G.cyl(0.32,0.32,0.08,12),M(WOOD2),0,0.5,0,g); for(let i=0;i<5;i++) mk(G.tor(0.3-i*0.05,0.05,6,16),M(0xd8b060),0,0.6+i*0.1,0,g).rotation.x=Math.PI/2; mk(G.sph(0.1,8,6),M(0xd8b060),0,1.08,0,g); mk(G.cyl(0.05,0.05,0.5,6),M(WOOD2),0,0.25,0,g); mk(G.box(0.08,0.06,0.03),M(0x3a2a20),0,0.64,0.3,g); },
  gnome(g){ mk(G.cyl(0.2,0.24,0.4,10),M(0x4a7ad8),0,0.2,0,g); mk(G.sph(0.15,10,8),M(0xf3c9a5),0,0.52,0,g); mk(G.cone(0.17,0.4,10),M(0xe2483d),0,0.82,0,g); const bd=mk(G.cone(0.13,0.25,8),M(0xffffff),0,0.38,0.08,g); bd.rotation.x=Math.PI; mk(G.sph(0.04,6,5),M(0xf0a090),0,0.52,0.14,g); },
  butterflyframe(g){ mk(G.box(0.08,1.2,0.08),M(WOOD2),0,0.6,-0.05,g); mk(G.box(0.9,0.7,0.06),M(WOOD),0,1.2,0,g); mk(G.box(0.8,0.6,0.02),M(0xfff8ea),0,1.2,0.035,g); const cs=[0x5a9ae8,0xf0a030,0xe86aa8]; for(let i=0;i<3;i++) for(const s of [-1,1]){ const w=mk(G.sph(0.06,8,4),M(cs[i]),-0.25+i*0.25+s*0.05,1.22,0.05,g); w.scale.set(1,1.3,0.2); } },
  mothlamp(g){ mk(G.cyl(0.04,0.05,1.5,8),M(0x4a3a30),0,0.75,0,g); mk(G.cyl(0.2,0.24,0.06,10),M(0x4a3a30),0,0.03,0,g); mk(G.sph(0.2,12,10),glowMat(0xe8ffb0),0,1.65,0,g); addGlow(g,1.65,2.6,0xe8ffb0); for(let i=0;i<3;i++){ const a=i*2.1; const m=mk(G.sph(0.04,6,4),M(0xd8c8a0),Math.cos(a)*0.32,1.7+i*0.05,Math.sin(a)*0.32,g); m.scale.set(1.8,0.3,1); } },
  rosearch(g){ const fr=M(0xf2ead8); for(const x of [-0.9,0.9]) mk(G.box(0.1,2.0,0.1),fr,x,1.0,0,g); const arc=mk(G.tor(0.9,0.05,6,20,Math.PI),fr,0,2.0,0,g); for(let i=0;i<18;i++){ const a=i/17*Math.PI; const x=Math.cos(a)*0.9, y=2.0+Math.sin(a)*0.9; mk(G.ico(0.13,0),M(0x4f9a3a),x,y,0.05,g); if(i%2) mk(G.ico(0.08,1),M(i%4===1?0xe2483d:0xf5a0c0),x,y,0.14,g); } for(let i=0;i<6;i++){ mk(G.ico(0.12,0),M(0x5fae43),(i<3?-0.9:0.9),0.4+(i%3)*0.5,0.06,g); } },
  fountain(g){ const st=M(0xc8c4b8); mk(G.cyl(1.0,1.05,0.4,24),st,0,0.2,0,g); mk(G.cyl(0.9,0.9,0.05,24),new THREE.MeshStandardMaterial({color:0x6ad0e8,roughness:0.1,transparent:true,opacity:0.8}),0,0.38,0,g); mk(G.cyl(0.12,0.16,1.0,10),st,0,0.8,0,g); mk(G.cyl(0.45,0.2,0.2,16),st,0,1.3,0,g); mk(G.cyl(0.38,0.38,0.04,16),M(0x6ad0e8,{roughness:0.1}),0,1.4,0,g); mk(G.sph(0.1,8,6),st,0,1.55,0,g); for(let i=0;i<6;i++){ const a=i/6*TAU; mk(G.sph(0.04,6,4),M(0xbfe6f0),Math.cos(a)*0.35,1.2,Math.sin(a)*0.35,g); } },
  grandfather(g){ mk(G.box(0.6,2.2,0.4),M(0x6a4a3a),0,1.1,0,g); mk(G.cyl(0.22,0.22,0.04,20),M(0xfff8ea),0,1.8,0.21,g).rotation.x=Math.PI/2; mk(G.box(0.02,0.16,0.02),M(0x222222),0,1.85,0.24,g); mk(G.box(0.12,0.02,0.02),M(0x222222),0.05,1.8,0.24,g); mk(G.box(0.36,0.8,0.02),M(0xbfe6f0,{transparent:true,opacity:0.6}),0,0.9,0.21,g); mk(G.sph(0.08,10,8),M(0xd8a040,{metalness:0.7,roughness:0.3}),0,0.7,0.18,g); mk(G.box(0.7,0.12,0.5),M(0x5a3a2a),0,2.25,0,g); },
  piano(g){ mk(G.box(1.5,1.2,0.6),M(0x2a2228),0,0.75,0,g); mk(G.box(1.4,0.08,0.3),M(0xffffff),0,0.78,0.42,g); for(let i=0;i<10;i++) mk(G.box(0.05,0.03,0.18),M(0x111111),-0.6+i*0.14,0.83,0.38,g); mk(G.box(1.5,0.08,0.7),M(0x2a2228),0,1.38,0.03,g); for(const x of [-0.65,0.65]) mk(G.box(0.08,0.3,0.4),M(0x2a2228),x,0.15,0.25,g); mk(G.box(0.8,0.5,0.35),M(0x2a2228),0,0.25,1.0,g); },
  globe(g){ mk(G.cyl(0.25,0.3,0.06,14),M(WOOD2),0,0.03,0,g); mk(G.cyl(0.03,0.03,0.6,6),M(WOOD2),0,0.33,0,g); const gl=mk(G.sph(0.3,20,14),M(0x4a8ad8),0,0.85,0,g); for(let i=0;i<4;i++){ const c=mk(G.sph(0.12,8,6),M(0x6ab84a),Math.cos(i*1.7)*0.24,0.85+Math.sin(i*2.3)*0.15,Math.sin(i*1.7)*0.24,g); c.scale.set(1,0.6,0.3); c.lookAt(0,0.85,0); } const r=mk(G.tor(0.34,0.02,6,24,Math.PI*1.4),M(0xd8a040,{metalness:0.6}),0,0.85,0,g); r.rotation.y=Math.PI/2; },
  skeleton(g){ const b=M(0xf4efe0); mk(G.box(1.4,0.08,0.6),M(WOOD2),0,0.04,0,g); for(let i=0;i<9;i++){ const v=mk(G.sph(0.07,8,6),b,-0.55+i*0.14,0.75+Math.sin(i/8*Math.PI)*0.2,0,g); } mk(G.box(0.3,0.18,0.16),b,-0.75,0.88,0,g); for(let i=0;i<4;i++){ const r=mk(G.tor(0.16,0.02,4,10,Math.PI),b,-0.25+i*0.14,0.75,0,g); r.rotation.set(0,Math.PI/2,Math.PI); } for(const x of [-0.3,0.35]) for(const z of [-0.12,0.12]) mk(G.cyl(0.03,0.03,0.7,5),b,x,0.4,z,g); mk(G.cyl(0.02,0.04,0.5,5),b,0.75,0.8,0,g).rotation.z=-1.1; },
  statue(g){ const st=M(0xd8d4c8); mk(G.box(0.8,0.6,0.8),st,0,0.3,0,g); mk(G.cap(0.2,0.5,4,10),st,0,1.05,0,g); mk(G.sph(0.2,12,10),st,0,1.6,0,g); mk(G.cyl(0.26,0.26,0.05,14),st,0,1.75,0,g); mk(G.cyl(0.14,0.16,0.14,12),st,0,1.83,0,g); const arm=mk(G.cap(0.06,0.4,4,8),st,0.25,1.4,0.1,g); arm.rotation.z=-2.4; mk(G.cyl(0.03,0.03,0.4,6),st,0.48,1.68,0.1,g).rotation.z=0.3; },
});
