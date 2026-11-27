// v1.25: the player's house. Plan helpers (a 20 x 20 grid, up to four floors), the outside (a roof per room you can turn,
// chimneys, porches, lights, trellises, balconies, moss you paint on) and the inside (floors, walls, lighting per room).
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { BUILD } from './content.js';
import { M, mk, G, windowMat, glowMat, addGlow, FURN_BUILDERS } from './models.js';
import { mergeStatic, tmat, pot } from './cottage.js';
import { tiled, texBox, roofOn } from './models2.js';

/* ---------- Plan helpers ---------- */
// Floors: the plan itself is the ground floor; plan.up, plan.up3 and plan.up4 are the ones above.
// Stairs from floor n-1 up to floor n: plan.stairs (n=1), plan.stairs2, plan.stairs3.
export const NFLOORS = 4;
export const FLOOR_KEYS = [null, 'up', 'up3', 'up4'];
export const STAIR_KEYS = [null, 'stairs', 'stairs2', 'stairs3'];
export const FLOOR_NAME = ['ground floor', '2nd floor', '3rd floor', '4th floor'];
export const FLOOR_SHORT = ['Ground', '2nd', '3rd', '4th'];
const EMPTY = Object.freeze({ rooms:[], links:{} });
export function floorOf(plan, n, make){ if (!n) return plan; const k=FLOOR_KEYS[n]; if (!plan[k] && make) plan[k]={ rooms:[], links:{} }; const F=plan[k]; if (F && !F.links) F.links={}; return F || EMPTY; }
export const floorHas = (plan, n) => { const F = n ? plan[FLOOR_KEYS[n]] : plan; return !!(F && F.rooms && F.rooms.length); };
export function topFloor(plan){ let t=0; for (let n=1;n<NFLOORS;n++){ if (floorHas(plan,n)) t=n; else break; } return t; }
export const stairsOf = (plan, n) => plan[STAIR_KEYS[n]] || null;
export const hasUpstairs = plan => floorHas(plan, 1);
export function planGrid(plan){
  const { GW, GD } = BUILD; const occ=[]; for (let j=0;j<GD;j++) occ.push(new Array(GW).fill(-1));
  (plan.rooms||[]).forEach((r,k)=>{ for (let j=r.z;j<r.z+r.d;j++) for (let i=r.x;i<r.x+r.w;i++) if (j>=0&&j<GD&&i>=0&&i<GW) occ[j][i]=k; });
  return occ;
}
export const linkKey = (a,b) => a<b ? a+'|'+b : b+'|'+a;
export const linkOf = (plan,a,b) => (plan.links||{})[linkKey(a,b)] || 'door';
export function planCells(plan){ let n=0; for (let f=0;f<NFLOORS;f++) n+=floorOf(plan,f).rooms.reduce((a,r)=>a+r.w*r.d,0); return n; }
// Windows (and trellises and balconies): every outside wall edge of a cell. side k: 0 front (+z), 1 back, 2 east, 3 west. row = floor.
export const winDefault = (i,j,k,row) => (i+j+k+row)%2===0;
export const winKey = (i,j,k,row) => `${row}:${i},${j},${k}`;
export function winAt(plan,i,j,k,row){ const v=plan.win&&plan.win[winKey(i,j,k,row)]; return v===undefined ? winDefault(i,j,k,row) : !!v; }
export const trelAt = (plan,i,j,k) => !!(plan.trel && plan.trel[winKey(i,j,k,0)]);
export const balcAt = (plan,i,j,k,row) => !!(row>0 && plan.balc && plan.balc[winKey(i,j,k,row)]);
export const SIDES = [[0,1],[0,-1],[1,0],[-1,0]];
// Grid to local coordinates. Outside: meters from the lot center. Inside: meters from the room's origin.
export const ex = i => (i-BUILD.OX)*BUILD.EC, ez = j => (j-BUILD.OZ)*BUILD.EC;
export const ix = i => (i-BUILD.OX)*BUILD.IC, iz = j => (j-BUILD.OZ)*BUILD.IC;
export const cellInside = (x,z) => [Math.floor(x/BUILD.IC+BUILD.OX), Math.floor(z/BUILD.IC+BUILD.OZ)];

function floorProblem(F, label){
  const { GW, GD } = BUILD;
  for (const r of F.rooms){ if (r.x<0||r.z<0||r.x+r.w>GW||r.z+r.d>GD||r.w<1||r.d<1) return `A room ${label} is outside the lot.`; }
  for (let a=0;a<F.rooms.length;a++) for (let b=a+1;b<F.rooms.length;b++){ const A=F.rooms[a], B=F.rooms[b]; if (A.x<B.x+B.w && B.x<A.x+A.w && A.z<B.z+B.d && B.z<A.z+A.d) return `Rooms ${label} can't overlap.`; }
  return ''; }
function reachable(F, startK){ const occ=planGrid(F), seen=new Set([startK]), q=[startK];
  while (q.length){ const k=q.pop(); const r=F.rooms[k];
    for (let j=r.z;j<r.z+r.d;j++) for (let i=r.x;i<r.x+r.w;i++) for (const [di,dj] of SIDES){ const n=occ[j+dj]?.[i+di]; if (n===undefined||n<0||n===k||seen.has(n)) continue; if (linkOf(F,F.rooms[k].id,F.rooms[n].id)==='wall') continue; seen.add(n); q.push(n); } }
  return seen.size; }
/* v1.74: inside walls. A wall, or a wall with a doorway, along a grid line inside one room, so part of a room can be closed off
   without splitting it into two rooms (a room of its own would get a roof of its own). Kept per floor in F.iw = { key:'wall'|'door' }.
   'v:i,j' is the line x=i between squares (i-1,j) and (i,j); 'h:i,j' is the line z=j between squares (i,j-1) and (i,j).
   A line only counts while both of its squares belong to the same room. */
export const iwKey = (kind, i, j) => kind+':'+i+','+j;
export function iwParse(key){ const [kind,rest]=key.split(':'), [i,j]=rest.split(',').map(Number); return { kind, i, j, cells: kind==='v' ? [[i-1,j],[i,j]] : [[i,j-1],[i,j]] }; }
export function innerWalls(F, occ){ occ=occ||planGrid(F); const out=[];
  for (const key in (F.iw||{})){ const t=F.iw[key]; if (t!=='wall' && t!=='door') continue; const q=iwParse(key), [[a,b],[c,d]]=q.cells, k=occ[b]?.[a];
    if (k===undefined || k<0 || occ[d]?.[c]!==k) continue; out.push({ key, kind:q.kind, i:q.i, j:q.j, t, k }); }
  return out; }
// drop lines that no longer sit inside one room (after a room was moved, resized or removed)
export function pruneInner(F){ if (!F || !F.iw) return; const keep=new Set(innerWalls(F).map(w=>w.key)); for (const k of Object.keys(F.iw)) if (!keep.has(k)) delete F.iw[k]; if (!Object.keys(F.iw).length) delete F.iw; }
// a room moved by (dx, dz): its inside walls move with it. r is the room's rectangle before the move.
export function shiftInner(F, r, dx, dz){ if (!F || !F.iw || (!dx && !dz)) return; const inR=([i,j])=>i>=r.x && i<r.x+r.w && j>=r.z && j<r.z+r.d, out={};
  for (const key in F.iw){ const q=iwParse(key); if (q.cells.every(inR)) out[iwKey(q.kind, q.i+dx, q.j+dz)]=F.iw[key]; }
  for (const key in F.iw){ const q=iwParse(key); if (!q.cells.every(inR) && !(key in out)) out[key]=F.iw[key]; }
  F.iw=out; }
// Which grid lines between two squares you can walk through: every line inside a room unless an inside wall stands on it
// (a doorway in it lets you through), and between rooms the doorway's middle line(s) or the whole of an open wall.
export function passLines(F, occ){ occ=occ||planGrid(F); const { GW, GD } = BUILD, pass=new Set(), block=new Set();
  for (const w of innerWalls(F, occ)) if (w.t==='wall') block.add(w.key);
  const pairs={};
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ const k=occ[j][i]; if (k<0) continue;
    for (const [di,dj] of [[1,0],[0,1]]){ const nb=occ[j+dj]?.[i+di]; if (nb===undefined || nb<0) continue; const key = di ? iwKey('v',i+1,j) : iwKey('h',i,j+1);
      if (nb===k){ if (!block.has(key)) pass.add(key); continue; }
      const pk=linkKey(F.rooms[k].id, F.rooms[nb].id)+(dj?'h':'v'); (pairs[pk]=pairs[pk]||{ t:linkOf(F,F.rooms[k].id,F.rooms[nb].id), keys:[] }).keys.push([di?j:i, key]); } }
  for (const pk in pairs){ const P=pairs[pk]; if (P.t==='wall') continue; if (P.t==='open'){ P.keys.forEach(([,key])=>pass.add(key)); continue; }
    P.keys.sort((a,b)=>a[0]-b[0]); const L=P.keys.length; if (L%2){ pass.add(P.keys[(L-1)/2][1]); continue; }
    // an even run's doorway is centred on the line between its two middle squares; an inside wall ending there splits it too narrow to pass
    const q=iwParse(P.keys[L/2][1]), split = q.kind==='h' ? block.has(iwKey('v',q.i,q.j-1)) || block.has(iwKey('v',q.i,q.j)) : block.has(iwKey('h',q.i-1,q.j)) || block.has(iwKey('h',q.i,q.j));
    if (!split){ pass.add(P.keys[L/2-1][1]); pass.add(P.keys[L/2][1]); } }
  return pass; }
// how many squares you can reach from (si, sj) on one floor
export function cellsReached(F, si, sj, occ){ occ=occ||planGrid(F); if (!(occ[sj]?.[si]>=0)) return 0; const pass=passLines(F, occ), seen=new Set([si+','+sj]), q=[[si,sj]];
  while (q.length){ const [i,j]=q.pop();
    for (const [di,dj,key] of [[1,0,iwKey('v',i+1,j)],[-1,0,iwKey('v',i,j)],[0,1,iwKey('h',i,j+1)],[0,-1,iwKey('h',i,j)]]){ const a=i+di, b=j+dj;
      if (!(occ[b]?.[a]>=0) || seen.has(a+','+b) || !pass.has(key)) continue; seen.add(a+','+b); q.push([a,b]); } }
  return seen.size; }
const floorSquares = F => F.rooms.reduce((a,r)=>a+r.w*r.d,0);
// Problems with a plan, or '' if it's fine. Used live by the editor.
export function planProblem(plan){
  const { GD } = BUILD; if (!plan.rooms.length) return 'A house needs at least one room.';
  const fp=floorProblem(plan,'downstairs').replace(' downstairs',''); if (fp) return fp;
  const top=topFloor(plan);
  for (let n=top+1;n<NFLOORS;n++) if (floorHas(plan,n)) return `The ${FLOOR_NAME[n]} needs a ${FLOOR_NAME[n-1]} under it.`;
  for (let n=1;n<=top;n++){ const U=floorOf(plan,n), p2=floorProblem(U,'on the '+FLOOR_NAME[n]); if (p2) return p2;
    const g0=planGrid(floorOf(plan,n-1)), g1=planGrid(U);
    for (let j=0;j<GD;j++) for (let i=0;i<BUILD.GW;i++) if (g1[j][i]>=0 && !(g0[j][i]>=0)) return `Rooms on the ${FLOOR_NAME[n]} need a room under them.`;
    const st=stairsOf(plan,n); if (!st || !(g0[st.j]?.[st.i]>=0) || !(g1[st.j]?.[st.i]>=0)) return `Add stairs up to the ${FLOOR_NAME[n]}: pick a square with a room on both floors.`;
    if (n===1 && plan.door && st.i===plan.door.i && st.j===plan.door.j) return 'The stairs can\'t go right inside the front door.';
    if (n>1){ const sb=stairsOf(plan,n-1); if (sb && sb.i===st.i && sb.j===st.j) return `Two staircases can't share a square on the ${FLOOR_NAME[n-1]}.`; }
    if (reachable(U, g1[st.j][st.i])<U.rooms.length) return `Every room on the ${FLOOR_NAME[n]} needs a way in from the stairs.`;
    if (U.iw && cellsReached(U, st.i, st.j, g1)<floorSquares(U)) return `Every corner of the ${FLOOR_NAME[n]} needs a way in from the stairs. Add a doorway to an inside wall.`; }
  // every room must be reachable from the front door through doorways or open walls
  const occ=planGrid(plan), d=plan.door; if (!d || occ[d.j]?.[d.i]===undefined || occ[d.j][d.i]<0 || (d.j+1<GD && occ[d.j+1][d.i]>=0)) return 'The front door needs an outside wall facing the front.';
  if (reachable(plan, occ[d.j][d.i])<plan.rooms.length) return 'Every room needs a way in. Add a doorway.';
  if (plan.iw && cellsReached(plan, d.i, d.j, occ)<floorSquares(plan)) return 'Every corner of the house needs a way in. Add a doorway to an inside wall.';
  return '';
}
// Move the front door somewhere valid if it isn't (prefers the old column)
export function fixDoor(plan){
  const { GD, GW } = BUILD; const occ=planGrid(plan); const ok=(i,j)=>occ[j]?.[i]>=0 && !(j+1<GD && occ[j+1][i]>=0);
  if (plan.door && ok(plan.door.i,plan.door.j)) return;
  const want=plan.door?plan.door.i:Math.floor(BUILD.OX); let best=null, bd=1e9;
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++) if (ok(i,j)){ const s=Math.abs(i-want)*2+(GD-j); if(s<bd){ bd=s; best={i,j}; } }
  plan.door=best;
}
// v1.25: the grid grew from 7 x 6 to 20 x 20. Old plans move so the house stays exactly where it stood.
export function shiftPlan(plan, dx, dz){
  for (let n=0;n<NFLOORS;n++){ const F = n ? plan[FLOOR_KEYS[n]] : plan; if (!F || !F.rooms) continue; for (const r of F.rooms){ r.x+=dx; r.z+=dz; } }
  for (const k of ['door', ...STAIR_KEYS.slice(1)]) if (plan[k]){ plan[k].i+=dx; plan[k].j+=dz; }
  for (const key of ['win','trel','balc']) if (plan[key]){ const o={}; for (const s in plan[key]){ const [row,rest]=s.split(':'); const [i,j,k]=rest.split(',').map(Number); o[`${row}:${i+dx},${j+dz},${k}`]=plan[key][s]; } plan[key]=o; }
}
export function defaultExt(){ return { wall:'siding', wallC:0xfff1d6, roof:'gable', roofC:0xe0745a, trimC:0xffffff, door:'plank', doorC:0x8a5a3a, win:'square', shutters:false, shutC:0x8a5a3a, boxes:false, found:'stone', porch:'none', chimney:'none', stories:1, lamps:false, light:'none', trellis:'none', balc:'none' }; }   // the base model: nothing extra
export function defaultRoom(id,x,z,w,d){ return { id, x, z, w, d, floor:'wood', floorC:0xc99a6a, paper:'plain', paperC:0xfff1d6, ceil:'bulb', sconce:'none', accent:'none', bright:0.75, warm:0.5 }; }
// Split a set of cells into rectangles (rows first), for roofs over the parts of a room with nothing above them
export function cellRects(cells){
  const out=[], used=new Set(), has=(i,j)=>cells.has(i+','+j)&&!used.has(i+','+j);
  const list=[...cells].map(s=>s.split(',').map(Number)).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  for (const [i,j] of list){ if (!has(i,j)) continue; let w=1; while (has(i+w,j)) w++; let d=1; for (;;){ let ok=true; for (let k=0;k<w;k++) if (!has(i+k,j+d)){ ok=false; break; } if (!ok) break; d++; }
    for (let a=0;a<d;a++) for (let k=0;k<w;k++) used.add((i+k)+','+(j+a)); out.push({ x:i, z:j, w, d }); }
  return out; }
// Which way a room's roof ridge runs: 'x' (gables to the sides), 'z' (gable to the front) or auto (along the longer side)
export const ridgeOf = (r, w, d) => r.pitch==='x' ? 'x' : r.pitch==='z' ? 'z' : (w>=d ? 'x' : 'z');

/* ---------- Heights ---------- */
export const F0=0.35, H1=2.35, HU=2.2;
export const floorY = n => n ? F0+H1+(n-1)*HU : F0;
export const floorH = n => n ? HU : H1;

/* ---------- Little things that make the outside cozy ---------- */
const glassM = () => new THREE.MeshStandardMaterial({ color:0xfff6dc, roughness:0.15, metalness:0.1, transparent:true, opacity:0.45 });
const iron = () => M(0x2e2824, { roughness:0.55, metalness:0.4 });
const brass = () => M(0xc9a050, { roughness:0.35, metalness:0.7 });
const LEAF=[0x4f9a3a,0x5fae43,0x3f8a34,0x6cbf50];
// Several small geometries as one (non-indexed), so a flower is one mesh instead of six
function mergeGeos(list){ let n=0; const parts=list.map(g=>{ const q=g.index?g.toNonIndexed():g; n+=q.attributes.position.count; return q; });
  const pos=new Float32Array(n*3), nor=new Float32Array(n*3), uv=new Float32Array(n*2); let i=0;
  for (const q of parts){ pos.set(q.attributes.position.array,i*3); nor.set(q.attributes.normal.array,i*3); uv.set(q.attributes.uv.array,i*2); i+=q.attributes.position.count; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(pos,3)); g.setAttribute('normal',new THREE.BufferAttribute(nor,3)); g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); g.computeBoundingSphere(); return g; }
const PETALS = mergeGeos(Array.from({length:5},(_,q)=>{ const a=q/5*TAU; const g=new THREE.SphereGeometry(0.03,6,4); g.scale(1,0.42,1); g.translate(Math.cos(a)*0.032,0,Math.sin(a)*0.032); return g; }));
// A planter under a window: plank box on brackets, leafy mound, five-petal flowers and trailing ivy
export function flowerBox(p, w, y, z, seed=1, cols){ const r=mulberry32(seed*97+13), bx=new THREE.Group(); bx.position.set(0,y,z); p.add(bx);
  const wood=M(0x8b5e3a), dk=M(0x6a4428);
  mk(G.box(w+0.18,0.2,0.24), wood, 0,0,0,bx); for (const yy of [-0.055,0.055]) mk(G.box(w+0.19,0.014,0.245), dk, 0,yy,0,bx);
  for (const s of [-1,1]){ mk(G.box(0.035,0.22,0.255), dk, s*(w/2+0.09),0,0,bx); const br=mk(G.box(0.04,0.18,0.04), dk, s*(w/2-0.04),-0.16,-0.05,bx); br.rotation.x=0.55; }
  mk(G.box(w+0.12,0.03,0.2), M(0x4a3426), 0,0.1,0,bx).castShadow=false;
  const n=Math.max(4,Math.round(w*10)); for (let k=0;k<n;k++){ const l=mk(G.sph(0.065+r()*0.03,7,5), M(LEAF[k%4]), -w/2+0.05+r()*(w-0.1),0.14+r()*0.04,(r()-0.5)*0.12,bx); l.scale.set(1.25,0.6,1); l.rotation.y=r()*TAU; l.castShadow=false; }
  const fc=cols||[0xff8fa8,0xffd04d,0xffffff,0xc7a0ff,0xff9a5a], nf=Math.max(3,Math.round(w*6));
  for (let k=0;k<nf;k++){ const fx=-w/2+0.07+(k+0.2+r()*0.6)*(w-0.14)/nf, fy=0.2+r()*0.07, fz=(r()-0.5)*0.12+0.02, c=M(fc[Math.floor(r()*fc.length)]);
    const pt=mk(PETALS, c, fx, fy, fz, bx); pt.rotation.y=r()*TAU; pt.castShadow=false;
    mk(G.sph(0.018,6,4), M(0xf2c440), fx,fy+0.013,fz,bx).castShadow=false; }
  for (let k=0;k<Math.max(2,Math.round(w*3));k++){ const tx=-w/2+r()*w, len=2+Math.floor(r()*3); for (let q=0;q<len;q++){ const l=mk(G.sph(0.034,6,4), M(LEAF[(k+q)%4]), tx+(r()-0.5)*0.04, 0.05-q*0.065, 0.13+q*0.008, bx); l.scale.set(1,0.85,0.5); l.castShadow=false; } }
  return bx; }
// Lantern head: iron frame, glass panes, a warm flame, pyramid cap and finial. Origin at the lantern's middle.
function lanternHead(p, s=1, glow=true){ const l=new THREE.Group(); l.scale.setScalar(s); p.add(l); const ir=iron();
  for (const [x,z] of [[1,1],[1,-1],[-1,1],[-1,-1]]) mk(G.box(0.025,0.34,0.025), ir, x*0.095,0,z*0.095,l);
  mk(G.box(0.18,0.3,0.18), glassM(), 0,0,0,l).castShadow=false; const core=mk(G.sph(0.05,10,8), glowMat(0xffc860), 0,-0.02,0,l); core.scale.y=1.35;
  mk(G.box(0.23,0.03,0.23), ir, 0,-0.16,0,l); mk(G.cone(0.12,0.1,4), ir, 0,-0.22,0,l).rotation.set(Math.PI,Math.PI/4,0);
  mk(G.box(0.24,0.03,0.24), ir, 0,0.165,0,l); mk(G.cone(0.17,0.14,4), ir, 0,0.25,0,l).rotation.y=Math.PI/4; mk(G.sph(0.03,8,6), brass(), 0,0.35,0,l); mk(G.tor(0.035,0.01,5,10), ir, 0,0.39,0,l).castShadow=false;
  if (glow) addGlow(l, 0, 2.2); return l; }
function carriageLantern(p, x, y, z){ const g=new THREE.Group(); g.position.set(x,y,z); p.add(g); const ir=iron();
  mk(G.box(0.13,0.3,0.035), ir, 0,0.02,0.02,g); const arm=mk(G.box(0.03,0.03,0.2), ir, 0,0.1,0.12,g); mk(G.tor(0.05,0.012,5,10,Math.PI), ir, 0,0.03,0.13,g).rotation.y=Math.PI/2;
  const h=new THREE.Group(); h.position.set(0,0.0,0.24); g.add(h); lanternHead(h, 0.95); return g; }
function brassSconce(p, x, y, z){ const g=new THREE.Group(); g.position.set(x,y,z); p.add(g); const b=brass();
  mk(G.cyl(0.08,0.08,0.025,16), b, 0,0,0.015,g).rotation.x=Math.PI/2; const arm=mk(G.cyl(0.015,0.015,0.16,6), b, 0,0,0.09,g); arm.rotation.x=Math.PI/2;
  const sh=mk(new THREE.CylinderGeometry(0.06,0.1,0.2,14,1,true), new THREE.MeshStandardMaterial({ color:0xfff4dc, emissive:0xffc070, emissiveIntensity:0.6, side:THREE.DoubleSide, roughness:0.6 }), 0,0.07,0.17,g); sh.castShadow=false;
  mk(G.sph(0.04,8,6), glowMat(0xffe0a0), 0,0.05,0.17,g); mk(G.tor(0.1,0.012,5,16), b, 0,-0.03,0.17,g).rotation.x=Math.PI/2; addGlow(g,0.05,1.8); return g; }
function hangingLantern(p, x, y, z, side=1){ const g=new THREE.Group(); g.position.set(x,y,z); p.add(g); const ir=iron();
  mk(G.box(0.08,0.22,0.03), ir, 0,0.4,0.015,g); mk(G.box(0.03,0.03,0.42), ir, 0,0.45,0.22,g); const sc=mk(G.tor(0.07,0.012,5,12,Math.PI*1.5), ir, 0,0.36,0.1,g); sc.rotation.y=Math.PI/2;
  for (let k=0;k<4;k++){ const ln=mk(G.tor(0.022,0.006,4,8), ir, 0,0.4-k*0.05,0.42,g); ln.rotation.y=k%2?Math.PI/2:0; ln.castShadow=false; }
  const h=new THREE.Group(); h.position.set(0,0.02,0.42); g.add(h); lanternHead(h, 1.05); return g; }
function lampPost(p, x, z, y0=0){ const g=new THREE.Group(); g.position.set(x,y0,z); p.add(g); const ir=iron();
  mk(G.cyl(0.14,0.18,0.14,12), ir, 0,0.07,0,g); mk(G.cyl(0.05,0.065,1.6,10), ir, 0,0.9,0,g); for (const y of [0.3,1.55]) mk(G.tor(0.06,0.015,5,12), ir, 0,y,0,g).rotation.x=Math.PI/2;
  const cb=mk(G.box(0.36,0.025,0.025), ir, 0,1.62,0,g); for (const s of [-1,1]) mk(G.tor(0.05,0.01,4,10,Math.PI), ir, s*0.14,1.58,0,g);
  const h=new THREE.Group(); h.position.set(0,1.88,0); g.add(h); lanternHead(h, 1.15); return g; }
function stringLights(p, xa, xb, y, z, sag=0.28, seed=3){ const r=mulberry32(seed), n=Math.max(5,Math.round((xb-xa)/0.32)), cable=M(0x2a2420), bulbs=[glowMat(0xffd27a), glowMat(0xffe7b0), glowMat(0xffb86a)];
  let prev=null; for (let k=0;k<=n;k++){ const t=k/n, x=xa+(xb-xa)*t, yy=y-Math.sin(t*Math.PI)*sag, pt=new THREE.Vector3(x,yy,z);
    if (prev){ const d=pt.clone().sub(prev), c=mk(G.cyl(0.008,0.008,d.length(),4), cable, (x+prev.x)/2,(yy+prev.y)/2,z,p); c.rotation.z=Math.atan2(d.y,d.x)-Math.PI/2; c.castShadow=false; }
    if (k>0 && k<n){ mk(G.cyl(0.012,0.012,0.04,6), cable, x,yy-0.03,z,p).castShadow=false; const b=mk(G.sph(0.035,8,6), bulbs[k%3], x,yy-0.075,z,p); b.scale.y=1.3; b.castShadow=false; if (k%3===1) addGlow(b,0,0.9); }
    prev=pt; } }

/* ---------- Chimneys: plain, or crooked and cozy ---------- */
// base: where it starts (inside the house), roofY: where the roof starts (bends begin above it), top: how high it reaches
function chimneyOn(g, kind, x, z, base, roofY, top, seed){ const r=mulberry32(seed||5), c=new THREE.Group(); c.position.set(x,0,z); g.add(c);
  const potM=M(0xc0683c), dk=M(0x5a4a40), smoke=new THREE.Vector3();
  const stack=(parent, tex, col, w, h, y)=>{ const b=texBox(tex, col, w, h, w, 0.7); b.position.y=y+h/2; b.castShadow=true; parent.add(b); return b; };
  const pots=(parent, y, tilt=0)=>{ const a=mk(G.cyl(0.1,0.13,0.3,12), potM, 0.1,y+0.15,0.05,parent); a.rotation.z=tilt; mk(G.tor(0.1,0.025,5,12), potM, 0.1+Math.sin(-tilt)*0.15,y+0.3,0.05,parent).rotation.x=Math.PI/2;
    const b=mk(G.cyl(0.08,0.11,0.22,12), potM, -0.13,y+0.11,-0.06,parent); b.rotation.z=-tilt*0.6; };
  if (kind==='brick' || kind==='stone' || !kind){ const brick=kind!=='stone', col=brick?0xb06a50:0xa8a8a0, tex=brick?'brick':'stone';
    stack(c, tex, col, 0.52, top-base, base); mk(G.box(0.64,0.1,0.64), dk, 0,top-0.18,0,c); mk(G.box(0.7,0.1,0.7), dk, 0,top,0,c); pots(c, top+0.05); smoke.set(x+0.1, top+0.5, z); return smoke; }
  // crooked ones: straight up through the house, then a few leaning sections above the roof
  // the bends start a little under the top, so they show above the roof instead of hiding in it
  const straight=Math.max(0.3, Math.max(roofY+0.35, top-1.5)-base); if (kind!=='pipe') stack(c, kind==='wonky'?'brick':'stone', kind==='wonky'?0xb06a50:0x9c9a92, 0.56, straight, base);
  else { const pp=mk(G.cyl(0.11,0.11,straight,14), M(0x4a4440,{ metalness:0.5, roughness:0.45 }), 0,base+straight/2,0,c); pp.castShadow=true; }
  let parent=c, y=base+straight; const left=kind==='pipe' ? 2.0 : 1.9, n=kind==='pipe'?4:3;
  const leans = kind==='crooked' ? [0.24,-0.22,0.3] : kind==='wonky' ? [0.34,-0.08,-0.3] : [0.0,0.62,-0.75,0.5];
  for (let k=0;k<n;k++){ const sg=new THREE.Group(); sg.position.y=(k===0?y:0); sg.rotation.z=leans[k]*(0.8+r()*0.4); sg.rotation.x=(r()-0.5)*0.12; parent.add(sg);
    const h=left/n*(kind==='pipe'?0.95:1);
    if (kind==='pipe'){ mk(G.cyl(0.11,0.11,h,14), M(0x4a4440,{ metalness:0.5, roughness:0.45 }), 0,h/2,0,sg); mk(G.sph(0.125,12,10), M(0x6a5a4a,{ metalness:0.5, roughness:0.4 }), 0,0,0,sg); mk(G.tor(0.115,0.018,5,14), M(0xb87a3a,{ metalness:0.6, roughness:0.35 }), 0,h*0.5,0,sg).rotation.x=Math.PI/2; }
    else { const w=0.54-k*0.05; const b=texBox(kind==='wonky'?'brick':'stone', kind==='wonky'?0xb06a50:0x9c9a92, w, h+0.04, w, 0.7); b.position.y=h/2; b.castShadow=true; sg.add(b);
      if (kind==='crooked') for (let q=0;q<3;q++){ const st=mk(G.dod(0.07+r()*0.05), M(0x8a8880,{flatShading:true}), (r()-0.5)*w, r()*h, (r()<0.5?-1:1)*w/2, sg); st.castShadow=false; } }
    const hold=new THREE.Group(); hold.position.y=h; sg.add(hold); parent=hold; }
  if (kind==='pipe'){ mk(G.cyl(0.02,0.02,0.12,6), M(0x4a4440), 0,0.06,0,parent); const hat=mk(G.cone(0.26,0.18,16), M(0x4a4440,{ metalness:0.5, roughness:0.45 }), 0,0.22,0,parent); mk(G.sph(0.03,8,6), M(0xb87a3a,{ metalness:0.6 }), 0,0.32,0,parent); }
  else { const cap=mk(G.box(0.62,0.1,0.62), dk, 0,0.05,0,parent); cap.rotation.z=(r()-0.5)*0.12; pots(parent, 0.08, kind==='wonky'?0.25:0.12);
    if (kind==='crooked'){ const hood=new THREE.Group(); hood.position.y=0.5; parent.add(hood); for (const s of [-1,1]){ const sl=mk(G.box(0.3,0.04,0.5), dk, s*0.12,0,0,hood); sl.rotation.z=-s*0.5; } for (const s of [-1,1]) mk(G.box(0.03,0.22,0.03), dk, s*0.2,-0.12,0,hood); } }
  c.updateMatrixWorld(true); smoke.set(0,0.45,0).applyMatrix4(parent.matrixWorld); return smoke; }

/* ---------- Trellises and balconies ---------- */
const TREL_BLOOM = { ivy:null, rose:[0xe8506a,0xff8fa8,0xc8304a], wisteria:[0xb89ae8,0xc8b0f0,0x9a7ad8], pea:[0xffb0d0,0xd8b8ff,0xfff0f4] };
// A wooden lattice on the wall with something climbing it. Frame: origin on the wall at the bottom middle, +z out of the wall.
const LATTICE = (()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d');
  for (const [c,lw] of [['rgba(150,125,90,.9)',13],['#f2e8d2',9]]){ x.strokeStyle=c; x.lineWidth=lw; for (let i=-128;i<=256;i+=43){ x.beginPath(); x.moveTo(i,-2); x.lineTo(i+130,130); x.stroke(); x.beginPath(); x.moveTo(i,130); x.lineTo(i+130,-2); x.stroke(); } }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=4; return t; })();
const LMAT=new Map();
const latticeMat=(w,h)=>{ const k=w.toFixed(2)+'x'+h.toFixed(2); if (!LMAT.has(k)){ const t=LATTICE.clone(); t.needsUpdate=true; t.repeat.set(w/0.6,h/0.6); LMAT.set(k, new THREE.MeshStandardMaterial({ map:t, alphaTest:0.5, side:THREE.DoubleSide, roughness:0.85 })); } return LMAT.get(k); };
function trellisOn(p, w, h, style, seed){ const r=mulberry32(seed), t=new THREE.Group(); p.add(t); const wood=M(0xe8dcc4);
  for (const s of [-1,1]) mk(G.box(0.05,h,0.04), wood, s*w/2,h/2,0.03,t); mk(G.box(w+0.1,0.05,0.06), wood, 0,h,0.03,t); mk(G.box(w+0.06,0.04,0.05), wood, 0,0.04,0.03,t);
  const lat=mk(new THREE.PlaneGeometry(w,h), latticeMat(w,h), 0,h/2,0.03,t); lat.castShadow=true;
  const bloom=TREL_BLOOM[style], dense = style==='ivy' ? 1.25 : 0.9;
  for (let k=0;k<Math.round(w*h*30*dense);k++){ const tt=r(), y=Math.pow(tt,0.75)*h, spread=w*(1.05-tt*0.25); const l=mk(G.sph(0.055+r()*0.04,6,4), M(LEAF[k%4]), (r()-0.5)*spread, 0.1+y, 0.07+r()*0.05, t); l.scale.set(1.2,0.85,0.42); l.rotation.z=(r()-0.5)*1.2; l.castShadow=false; }
  // a few long strands of vine
  for (let k=0;k<3;k++){ let x=(r()-0.5)*w*0.6; for (let y=0.1;y<h;y+=0.18){ x+=(r()-0.5)*0.12; const v=mk(G.cyl(0.012,0.012,0.2,4), M(0x5a6a2a), x,y,0.06,t); v.rotation.z=(r()-0.5)*0.6; v.castShadow=false; } }
  if (bloom){ const n=Math.round(w*h*(style==='wisteria'?5:9));
    for (let k=0;k<n;k++){ const c=M(bloom[k%bloom.length]), x=(r()-0.5)*w*0.95, y=style==='wisteria' ? h*(0.55+r()*0.42) : 0.25+r()*(h-0.3);
      if (style==='wisteria'){ const cl=mk(G.cone(0.07,0.32+r()*0.15,8), c, x, y-0.16, 0.12, t); cl.rotation.x=Math.PI; cl.castShadow=false; }
      else if (style==='rose'){ const b=mk(G.sph(0.055,8,6), c, x,y,0.12,t); b.scale.z=0.7; b.castShadow=false; const ri=mk(G.tor(0.035,0.016,5,10), c, x,y+0.005,0.15,t); ri.castShadow=false; }
      else { for (let q=0;q<3;q++){ const pt=mk(G.sph(0.03,6,4), c, x+Math.cos(q*2.1)*0.03, y+Math.sin(q*2.1)*0.03, 0.12, t); pt.scale.z=0.4; pt.castShadow=false; } } } }
  return t; }
// A little balcony off an upper floor. Frame: origin on the wall at floor level, +z out of the wall.
function balconyOn(p, w, style, E, seed){ const b=new THREE.Group(); p.add(b); const r=mulberry32(seed);
  const juliet = style==='juliet', D = juliet ? 0.32 : 0.95, trim=M(E.trimC);
  if (!juliet){ mk(G.box(w+0.1,0.12,D), tiled('wood',0xb98a5a,w,D,0.9), 0,-0.06,D/2,b); mk(G.box(w+0.16,0.06,0.08), trim, 0,-0.09,D,b);
    for (const s of [-1,1]){ const br=mk(G.box(0.08,0.62,0.08), M(0x8b5e3a), s*(w/2-0.12),-0.36,0.32,b); br.rotation.x=-0.62; mk(G.box(0.08,0.4,0.08), M(0x8b5e3a), s*(w/2-0.12),-0.3,0.05,b); } }
  const railH=0.85, ir=style==='iron'||juliet;
  const rail = ir ? iron() : M(0xfff6e6), post = ir ? iron() : M(0xf2e8d4);
  const sides = juliet ? [[0,D,w,0]] : [[0,D,w,0],[-w/2,D/2,D,Math.PI/2],[w/2,D/2,D,Math.PI/2]];
  for (const [x,z,len,ry] of sides){ const s=new THREE.Group(); s.position.set(x,0,z); s.rotation.y=ry; b.add(s);
    mk(G.box(len+0.05,0.06,0.07), rail, 0,railH,0,s); mk(G.box(len,0.04,0.05), rail, 0,0.08,0,s);
    const n=Math.max(2,Math.round(len/0.14));
    for (let k=0;k<=n;k++){ const xx=-len/2+k*len/n; if (ir){ mk(G.cyl(0.012,0.012,railH-0.08,5), post, xx,railH/2+0.04,0,s); if (k<n && k%2===0){ const cu=mk(G.tor(0.05,0.01,4,10), post, xx+len/n/2,railH*0.55,0,s); cu.castShadow=false; } }
      else mk(G.box(0.04,railH-0.08,0.04), post, xx,railH/2+0.04,0,s); }
    if (style==='flower' && ry===0) flowerBox(s, len-0.2, railH-0.02, 0.15, seed+7); }
  if (style==='flower' && !juliet) for (const s of [-1,1]) pot(b, s*(w/2-0.25), 0, D-0.3, 0.75, 0x5fae43, 0xff8fa8);
  return b; }
// French doors where a balcony meets the wall. Frame: origin on the wall at floor level.
function frenchDoor(p, E){ const d=new THREE.Group(); p.add(d); const tr=M(E.trimC), dc=M(E.doorC);
  mk(G.box(1.04,1.86,0.08), tr, 0,0.93,0,d); for (const s of [-1,1]){ mk(G.box(0.44,1.72,0.06), dc, s*0.235,0.88,0.03,d); mk(G.box(0.3,1.3,0.05), windowMat, s*0.235,0.98,0.06,d); mk(G.box(0.02,1.3,0.07), dc, s*0.235,0.98,0.065,d); mk(G.box(0.3,0.02,0.07), dc, s*0.235,1.2,0.065,d); }
  mk(G.box(1.16,0.1,0.14), tr, 0,1.9,0.05,d); return d; }

/* ---------- Windows and doors ---------- */
function houseWindow(g, x, y, z, ry, E, sz=1, seed=1){
  const p=new THREE.Group(); p.position.set(x,y,z); p.rotation.y=ry; g.add(p);
  const frame=M(0xffffff), st=E.win; let w=0.62*sz, h=0.62*sz;
  if (st==='tall'){ w=0.5*sz; h=0.95*sz; } if (st==='wide'){ w=0.95*sz; h=0.55*sz; }
  if (st==='round'){ const r=0.34*sz; mk(G.cyl(r+0.08,r+0.08,0.08,20), frame, 0,0,0,p).rotation.x=Math.PI/2; mk(G.cyl(r,r,0.06,20), windowMat, 0,0,0.03,p).rotation.x=Math.PI/2; mk(G.box(0.04,r*2,0.08),frame,0,0,0.05,p); mk(G.box(r*2,0.04,0.08),frame,0,0,0.05,p); w=h=r*2; }
  else {
    mk(G.box(w+0.14,h+0.14,0.08), frame, 0,0,0,p); mk(G.box(w,h,0.06), windowMat, 0,0,0.03,p);
    mk(G.box(0.04,h,0.08), frame, 0,0,0.05,p); mk(G.box(w,0.04,0.08), frame, 0,0,0.05,p);
    if (st==='arched'){ const a=mk(G.cyl(w/2+0.07,w/2+0.07,0.08,16,1,false,0,Math.PI), frame, 0,h/2,0,p); a.rotation.set(Math.PI/2,0,Math.PI/2); a.rotation.order='ZXY'; mk(new THREE.CircleGeometry(w/2,16,0,Math.PI), windowMat, 0,h/2,0.035,p); }
    else mk(G.box(w+0.28,0.09,0.12), M(new THREE.Color(E.trimC).offsetHSL(0,0,-0.08).getHex()), 0,h/2+0.11,0.04,p);
    if (!E.boxes) mk(G.box(w+0.3,0.07,0.16), M(new THREE.Color(E.trimC).offsetHSL(0,0,-0.08).getHex()), 0,-h/2-0.1,0.07,p);
  }
  if (E.shutters && st!=='round') for (const s of [-1,1]){ mk(G.box(0.24*sz,h+0.08,0.05), M(E.shutC), s*(w/2+0.2*sz),0,0.02,p); for(let k=0;k<3;k++) mk(G.box(0.18*sz,0.03,0.06), M(new THREE.Color(E.shutC).offsetHSL(0,0,-0.1).getHex()), s*(w/2+0.2*sz),-h/3+k*h/3,0.03,p); }
  if (E.boxes) flowerBox(p, w, -h/2-0.14, 0.13, seed);
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

/* ---------- Porches ---------- */
function railRun(p, x0, z0, x1, z1, y, mat){ const L=Math.hypot(x1-x0,z1-z0); if (L<0.1) return; const s=new THREE.Group(); s.position.set((x0+x1)/2,y,(z0+z1)/2); s.rotation.y=-Math.atan2(z1-z0,x1-x0); p.add(s);
  mk(G.box(L+0.06,0.06,0.08), mat, 0,0.62,0,s); mk(G.box(L,0.04,0.05), mat, 0,0.1,0,s); const n=Math.max(1,Math.round(L/0.16)); for (let k=1;k<n;k++) mk(G.box(0.035,0.5,0.035), mat, -L/2+k*L/n,0.36,0,s); }
function porchOn(g, E, x, z, px0, px1, F, roofTop){
  let porchD=0.3; const pw=px1-px0, pmx=(px0+px1)/2, wood=tiled('wood',0xc99a6a,pw,1.6,1.0), trim=M(E.trimC), stone=M(0xc0b8a8);
  if (E.porch==='deck'||E.porch==='covered'||E.porch==='veranda'){ porchD = E.porch==='veranda' ? 1.75 : 1.5;
    mk(G.box(pw,0.14,porchD), wood, pmx,F-0.04,z+porchD/2,g);
    mk(G.box(pw+0.06,0.06,0.08), trim, pmx,F-0.1,z+porchD,g);   // fascia
    const skirt=texBox('lattice',0xc8a878,pw,F,0.04,0.6); skirt.position.set(pmx,(F-0.1)/2,z+porchD-0.02); g.add(skirt);
    for (let s=0;s<2;s++) mk(G.box(1.1,0.12,0.36), stone, x, F-0.18-s*0.17, z+porchD+0.18+s*0.34, g);
    const postX=[px0+0.08, px1-0.08]; const covered = E.porch!=='deck';
    // railings along the front (leaving the steps open) and the sides
    const gap=[x-0.6, x+0.6];
    if (pw>1.6){ if (gap[0]-px0>0.3) railRun(g, px0+0.06, z+porchD-0.08, gap[0], z+porchD-0.08, F, trim); if (px1-gap[1]>0.3) railRun(g, gap[1], z+porchD-0.08, px1-0.06, z+porchD-0.08, F, trim); }
    for (const sx of postX) railRun(g, sx, z+0.1, sx, z+porchD-0.1, F, trim);
    if (covered){ const yTop=Math.min(F+2.3, roofTop-0.05), yLow=yTop-0.32;
      for (const sx of postX){ const pst=new THREE.Group(); pst.position.set(sx,F,z+porchD-0.12); g.add(pst); mk(G.box(0.16,0.12,0.16), trim, 0,0.06,0,pst); mk(G.cyl(0.07,0.08,yLow-F-0.2,10), trim, 0,(yLow-F)/2,0,pst);
        for (const y of [0.35, yLow-F-0.32]) mk(G.tor(0.08,0.02,5,12), trim, 0,y,0,pst).rotation.x=Math.PI/2; mk(G.box(0.18,0.1,0.18), trim, 0,yLow-F-0.08,0,pst);
        for (const s of [-1,1]){ const br=mk(G.box(0.05,0.36,0.05), trim, s*0.16,yLow-F-0.25,0,pst); br.rotation.z=s*0.7; } }
      const len=Math.hypot(porchD+0.35, yTop-yLow), slope=Math.atan2(yTop-yLow, porchD+0.35), rf=new THREE.Group(); rf.position.set(pmx,(yTop+yLow)/2,z+(porchD+0.35)/2-0.05); rf.rotation.x=slope; g.add(rf);
      mk(G.box(pw+0.5,0.08,len), trim, 0,0,0,rf); const ca=tmat('shingle',E.roofC,(pw+0.5)/0.62,1), cb=tmat('shingle',new THREE.Color(E.roofC).offsetHSL(0,0,-0.05).getHex(),(pw+0.5)/0.62,1);
      const nC=Math.max(3,Math.round(len/0.34)); for (let k=0;k<nC;k++){ const m=mk(G.box(pw+0.52,0.07,len/nC+0.14), k%2?ca:cb, 0,0.07,-len/2+(k+0.5)*len/nC, rf); m.rotation.x=-0.07; }
      mk(G.box(pw+0.56,0.16,0.08), trim, 0,-0.04,len/2+0.02,rf);
      mk(G.box(pw,0.1,0.12), trim, pmx,yLow-0.06,z+porchD-0.12,g);   // beam over the posts
      if (E.light==='hanging') hangingLantern(g, x+0.9, yLow-0.95, z+0.05);
      porchD+=0.1; }
    // a couple of pots on the deck
    pot(g, px0+0.35, F+0.03, z+porchD-0.45, 0.8, 0x5fae43, 0xffd04d); if (pw>2.4) pot(g, px1-0.35, F+0.03, z+porchD-0.45, 0.8, 0x4f9a3a, 0xff8fa8);
    if (E.porch==='veranda' && pw>3.2){ const bn=new THREE.Group(); bn.position.set(px0+1.0+(x>pmx?0:pw-2.0),F+0.03,z+0.45); g.add(bn); const bw=M(0x9a6a40); mk(G.box(1.1,0.06,0.38), bw, 0,0.42,0,bn); mk(G.box(1.1,0.4,0.05), bw, 0,0.66,-0.17,bn); for (const s of [-1,1]) mk(G.box(0.06,0.42,0.36), bw, s*0.52,0.21,0,bn); }
  } else if (E.porch==='step'){ porchD=0.7; for (let s=0;s<2;s++){ mk(G.box(1.2,0.14,0.36), stone, x, F-0.1-s*0.15, z+0.2+s*0.32, g); } pot(g, x-0.85, 0.02, z+0.35, 0.85, 0x5fae43, 0xff8fa8); }
  else { porchD=0.3; mk(G.box(1.1,0.12,0.4), M(0xb8b0a0), x, 0.1, z+0.2, g); }
  return porchD; }

// Balconies that show: the ones placed in the builder, or one over the front door until you place your own. [row,i,j,k]
export function balconyList(plan, E, grids, top){
  if (!E.balc || E.balc==='none' || top<1) return [];
  const outside=(grid,i,j,k)=>grid && grid[j]?.[i]>=0 && !(grid[j+SIDES[k][1]]?.[i+SIDES[k][0]]>=0);
  let list=Object.keys(plan.balc||{}).filter(s=>plan.balc[s]).map(s=>{ const [row,rest]=s.split(':'); const [i,j,k]=rest.split(',').map(Number); return [+row,i,j,k]; });
  const d=plan.door; if (!list.length && d && outside(grids[1],d.i,d.j,0)) list=[[1,d.i,d.j,0]];
  return list.filter(([row,i,j,k])=>row>=1 && row<=top && outside(grids[row],i,j,k)); }
/* ---------- Player house, outside. Origin = lot center. ---------- */
export function buildCustomHouse(home){
  const { GW, GD, EC } = BUILD; const plan=home.plan, E=Object.assign(defaultExt(), home.ext); const g=new THREE.Group();
  const top=topFloor(plan), grids=[]; for (let n=0;n<=top;n++) grids.push(planGrid(floorOf(plan,n)));
  const occ=grids[0], fake = top===0 && E.stories>=2 ? Math.min(4,E.stories) : 1;
  const Hn = n => n===0 ? (fake>1 ? H1+(fake-1)*1.95 : H1) : HU;
  const rects=[]; let best=null;
  const foundKind = { stone:['stone',0xa8a8a0], brick:['brick',0xb5523b], wood:['lattice',0xc8a878], none:['stucco',0x9a948a] }[E.found]||['stone',0xa8a8a0];
  const roofs=[];   // [x0,z0,x1,z1,top] of every roof, for the porch
  const rbox=(x0,z0,x1,z1)=>[ex(x0),ez(z0),ex(x1),ez(z1)];
  for (let n=0;n<=top;n++){ const F=floorOf(plan,n), y0=floorY(n), h=Hn(n), above=grids[n+1];
    F.rooms.forEach(r=>{
      const [x0,z0,x1,z1]=rbox(r.x,r.z,r.x+r.w,r.z+r.d), W=x1-x0, D=z1-z0, mx=(x0+x1)/2, mz=(z0+z1)/2;
      if (n===0){ const fh = E.found==='none' ? 0.15 : F0; const fd=texBox(foundKind[0], foundKind[1], W+0.2, fh+0.8, D+0.2, 0.9); fd.position.set(mx,(fh-0.8)/2,mz); g.add(fd); fd.castShadow=fd.receiveShadow=true; rects.push([x0,z0,x1,z1]); }
      const wl=texBox(E.wall, E.wallC, W, h, D); wl.position.set(mx, y0+h/2, mz); wl.castShadow=wl.receiveShadow=true; g.add(wl);
      mk(G.box(W+0.12,0.12,D+0.12), M(E.trimC), mx, y0+h, mz, g);
      if (n===0 && fake>1) for (let k=1;k<fake;k++) mk(G.box(W+0.1,0.1,D+0.1), M(E.trimC), mx, F0+2.15+(k-1)*1.95, mz, g);
      for (const ax of [x0,x1]) for (const az of [z0,z1]) mk(G.box(0.14,h,0.14), M(E.trimC), ax, y0+h/2, az, g);
      // roofs over the parts of the room with nothing above
      const open=new Set(); for (let j=r.z;j<r.z+r.d;j++) for (let i=r.x;i<r.x+r.w;i++) if (!(above && above[j][i]>=0)) open.add(i+','+j);
      if (open.size<r.w*r.d) mk(G.box(W+0.1,0.16,D+0.1), M(new THREE.Color(E.roofC).offsetHSL(0,0,-0.1).getHex()), mx, y0+h+0.04, mz, g);
      const parts = open.size===r.w*r.d ? [{ x:r.x, z:r.z, w:r.w, d:r.d }] : cellRects(open);
      for (const q of parts){ const [a0,b0,a1,b1]=rbox(q.x,q.z,q.x+q.w,q.z+q.d), QW=a1-a0, QD=b1-b0, rg=new THREE.Group(); rg.position.set((a0+a1)/2,0,(b0+b1)/2); g.add(rg);
        const style=r.roof||E.roof; const rise=roofOn(rg, style, QW, QD, y0+h, E.roofC, E.trimC, E.wall, E.wallC, { ridge:ridgeOf(r,QW,QD), moss:0, seed:r.x*7+r.z*13+n*31 });
        roofs.push([a0,b0,a1,b1,y0+h]);
        const score=q.w*q.d*(1+n*1.5); if (!best || score>best.a) best={ a:score, x:a1-Math.min(0.7,QW*0.25), z:b0+Math.min(0.7,QD*0.3), roofY:y0+h, top:y0+h+rise+0.6 }; }
    });
  }
  // balconies on upper floors (placed in the builder; one over the front door until you place your own)
  const d=plan.door; let wseed=1;
  const outside=(grid,i,j,k)=>grid[j]?.[i]>=0 && !(grid[j+SIDES[k][1]]?.[i+SIDES[k][0]]>=0);
  const edgeFrame=(i,j,k,y)=>{ const f=new THREE.Group(); const [x,z,ry] = k===0 ? [ex(i)+EC/2, ez(j+1), 0] : k===1 ? [ex(i)+EC/2, ez(j), Math.PI] : k===2 ? [ex(i+1), ez(j)+EC/2, Math.PI/2] : [ex(i), ez(j)+EC/2, -Math.PI/2]; f.position.set(x,y,z); f.rotation.y=ry; g.add(f); return f; };
  const balcs=balconyList(plan, E, grids, top), balcSet=new Set(balcs.map(q=>winKey(q[1],q[2],q[3],q[0])));
  for (const [row,i,j,k] of balcs){ const f=edgeFrame(i,j,k,floorY(row)); f.position.add(new THREE.Vector3(Math.sin(f.rotation.y)*0.03,0,Math.cos(f.rotation.y)*0.03)); frenchDoor(f, E); balconyOn(f, EC-0.08, E.balc, E, i*5+j*11+k); }
  // windows on outside edges (placed in the builder, or the default checkerboard), skipping the front door and balconies
  const winRow=(grid, y, row, sizeK)=>{ for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ if (grid[j][i]<0) continue; const empty=(a,b)=>!(grid[b]?.[a]>=0);
    const sides=[ [0,1, ex(i)+EC/2, ez(j+1)+0.03, 0], [0,-1, ex(i)+EC/2, ez(j)-0.03, Math.PI], [1,0, ex(i+1)+0.03, ez(j)+EC/2, Math.PI/2], [-1,0, ex(i)-0.03, ez(j)+EC/2, -Math.PI/2] ];
    sides.forEach(([di,dj,x,z,ry],k)=>{ if(!empty(i+di,j+dj)) return; const isDoor = d && d.i===i && d.j===j && dj===1;
      if (balcSet.has(winKey(i,j,k,row))) return;
      if (isDoor && row===0) return; if (isDoor && row===1 && top===0){ if (winAt(plan,i,j,k,1)) houseWindow(g,x,y,z,ry,E,0.8,wseed++); return; }
      if (winAt(plan,i,j,k,row)) houseWindow(g,x,y,z,ry,E,sizeK,wseed++); }); } };
  winRow(occ, F0+1.3, 0, 0.85);
  for (let n=1;n<=top;n++) winRow(grids[n], floorY(n)+1.15, n, 0.85);
  if (top===0) for (let k=1;k<fake;k++) winRow(occ, F0+3.3+(k-1)*1.95, k, 0.85);
  // trellises on the ground floor walls (placed in the builder; two by the front door until you place your own)
  if (E.trellis && E.trellis!=='none'){ let list=Object.keys(plan.trel||{}).filter(s=>plan.trel[s]).map(s=>{ const [,rest]=s.split(':'); return rest.split(',').map(Number); });
    if (!list.length && d){ const cand=[]; for (let j=0;j<GD;j++) for (let i=0;i<GW;i++) for (let k=0;k<4;k++){ if (!outside(occ,i,j,k) || winAt(plan,i,j,k,0) || (k===0 && i===d.i && j===d.j)) continue;
        cand.push([Math.hypot(i-d.i,(j-d.j)*1.3)+(k===1?6:0),i,j,k]); }
      cand.sort((a,b)=>a[0]-b[0]); list=cand.slice(0,2).map(c=>c.slice(1)); }
    for (const [i,j,k] of list){ if (!outside(occ,i,j,k)) continue; const f=edgeFrame(i,j,k,F0); f.position.add(new THREE.Vector3(Math.sin(f.rotation.y)*0.04,0,Math.cos(f.rotation.y)*0.04)); trellisOn(f, 0.92, Hn(0)-0.25, E.trellis, i*13+j*7+k*3); } }
  // front door, porch, lights
  let doorPt=[0,0], porchD=0;
  if (d){ const x=ex(d.i)+EC/2, z=ez(d.j+1); doorPt=[x,z];
    houseDoor(g, x, F0, z+0.03, E);
    // the porch runs along the front of the door's room (next squares for a porch, the whole front for a veranda)
    const k=occ[d.j][d.i]; let a=d.i, b=d.i; const front=(i)=>occ[d.j][i]>=0 && (E.porch==='veranda' || occ[d.j][i]===k) && !(d.j+1<GD && occ[d.j+1][i]>=0);
    const reach = E.porch==='veranda' ? 4 : 1;
    while (a-1>=0 && front(a-1) && d.i-(a-1)<=reach) a--; while (b+1<GW && front(b+1) && (b+1)-d.i<=reach) b++;
    porchD=porchOn(g, E, x, z, ex(a)+0.05, ex(b+1)-0.05, F0, floorY(1)-0.1);
    const L=E.light||(E.lamps?'lantern':'none');
    if (L==='lantern') for (const s of [-1,1]) carriageLantern(g, x+s*0.74, F0+1.55, z+0.03);
    else if (L==='sconce') for (const s of [-1,1]) brassSconce(g, x+s*0.74, F0+1.62, z+0.03);
    else if (L==='hanging' && !(E.porch==='covered'||E.porch==='veranda')) hangingLantern(g, x+0.82, F0+1.5, z+0.03);
    else if (L==='post'){ for (const s of [-1,1]) lampPost(g, x+s*1.35, z+porchD+0.55, 0); }
    else if (L==='string'){ const R=plan.rooms[k]; if (R){ const xa=ex(R.x)+0.1, xb=ex(R.x+R.w)-0.1, yy=floorY(0)+Hn(0)-0.12; stringLights(g, xa, xb, yy, z+0.12, 0.22, d.i*7+d.j); } }
  }
  if (E.chimney!=='none' && best) best.smoke=chimneyOn(g, E.chimney, best.x, best.z, F0, best.roofY, best.top, plan.rooms.length*17+(best.x*10|0));
  mergeStatic(g);
  // mailbox by the path, to the left of the front door
  const mb=new THREE.Group(); mb.position.set(doorPt[0]-1.9, 0, doorPt[1]+Math.max(porchD,0.7)+0.5); FURN_BUILDERS.mailbox(mb); g.add(mb);
  const chimney = best && best.smoke ? best.smoke.clone() : null;
  g.userData={ chimney, door:doorPt, porchD, rects, size:{W:GW*EC,D:GD*EC}, house:true };
  // moss: what you've painted, or (for Mossy shingles you haven't painted) a natural sprinkling
  const moss = E.moss!=null ? E.moss : defaultMoss(home); if (moss) buildMossLayer(g, moss);
  return g;
}

/* ---------- Painted moss: drawn over whatever roof is underneath ----------
   moss: { 'a,b': level 1-3 } on half squares of the outside grid (a = 2*i + 0/1). */
export const MOSS_GRID = 2;
export const mossCellAt = (x, z) => [Math.floor((x/BUILD.EC+BUILD.OX)*MOSS_GRID), Math.floor((z/BUILD.EC+BUILD.OZ)*MOSS_GRID)];
const mossCenter = (a, b) => [((a+0.5)/MOSS_GRID-BUILD.OX)*BUILD.EC, ((b+0.5)/MOSS_GRID-BUILD.OZ)*BUILD.EC];
const MOSS_COL=[0x6f9a48,0x82ad54,0x5c8a3e,0x93b860,0x5a7a3a];
const _q=new THREE.Quaternion(), _up=new THREE.Vector3(0,1,0), _m=new THREE.Matrix4(), _s=new THREE.Vector3(), _p=new THREE.Vector3(), _t1=new THREE.Vector3(), _t2=new THREE.Vector3();
// The top surface of the house over every half square: { 'a,b': [local point, normal] }. Built once per model by walking its
// triangles (much faster than casting a ray per square), and cached on the model.
export function roofMap(model){ const U=model.userData; if (U.roofMap) return U.roofMap; const map=new Map(); model.updateMatrixWorld(true);
  const inv=new THREE.Matrix4().copy(model.matrixWorld).invert(), rel=new THREE.Matrix4(), A=new THREE.Vector3(), B=new THREE.Vector3(), C=new THREE.Vector3(), e1=new THREE.Vector3(), e2=new THREE.Vector3(), n=new THREE.Vector3();
  const { EC, OX, OZ } = BUILD, K=MOSS_GRID, hx=x=>(x/EC+OX)*K-0.5, hz=z=>(z/EC+OZ)*K-0.5;
  model.traverse(o=>{ if (!o.isMesh || o.isInstancedMesh || o.name==='moss') return; const mats=Array.isArray(o.material)?o.material:[o.material]; if (mats.every(m=>m && m.transparent)) return;
    rel.multiplyMatrices(inv, o.matrixWorld); const pos=o.geometry.attributes.position, idx=o.geometry.index, nt=(idx?idx.count:pos.count)/3;
    for (let t=0;t<nt;t++){ const ia=idx?idx.getX(t*3):t*3, ib=idx?idx.getX(t*3+1):t*3+1, ic=idx?idx.getX(t*3+2):t*3+2;
      A.fromBufferAttribute(pos,ia).applyMatrix4(rel); B.fromBufferAttribute(pos,ib).applyMatrix4(rel); C.fromBufferAttribute(pos,ic).applyMatrix4(rel);
      if (Math.max(A.y,B.y,C.y)<F0+1.0) continue; e1.subVectors(B,A); e2.subVectors(C,A); n.crossVectors(e1,e2); const L=n.length(); if (L<1e-9) continue; n.divideScalar(L); if (n.y<0.3) continue;
      const a0=Math.ceil(hx(Math.min(A.x,B.x,C.x))), a1=Math.floor(hx(Math.max(A.x,B.x,C.x))), b0=Math.ceil(hz(Math.min(A.z,B.z,C.z))), b1=Math.floor(hz(Math.max(A.z,B.z,C.z)));
      if (a1<a0 || b1<b0) continue; const det=(B.z-C.z)*(A.x-C.x)+(C.x-B.x)*(A.z-C.z); if (Math.abs(det)<1e-9) continue;
      for (let a=a0;a<=a1;a++) for (let b=b0;b<=b1;b++){ const [x,z]=mossCenter(a,b);
        const w1=((B.z-C.z)*(x-C.x)+(C.x-B.x)*(z-C.z))/det, w2=((C.z-A.z)*(x-C.x)+(A.x-C.x)*(z-C.z))/det, w3=1-w1-w2; if (w1<-1e-4||w2<-1e-4||w3<-1e-4) continue;
        const y=w1*A.y+w2*B.y+w3*C.y, k=a+','+b, cur=map.get(k); if (!cur || y>cur[0].y) map.set(k, [new THREE.Vector3(x,y,z), n.clone()]); } } });
  U.roofMap=map; return map; }
export function roofHit(model, a, b){ return roofMap(model).get(a+','+b) || null; }
// Which half square of roof a ray (in world space) lands on, or null. Marches along the ray over the cached roof map.
export function roofPick(model, ray){ const map=roofMap(model); model.updateMatrixWorld(true); const o=model.worldToLocal(ray.origin.clone()), d=ray.direction;
  for (let t=0;t<260;t+=0.12){ const x=o.x+d.x*t, y=o.y+d.y*t, z=o.z+d.z*t; if (y<F0) break; const [a,b]=mossCellAt(x,z), h=map.get(a+','+b); if (h && y<=h[0].y+0.04) return [a,b]; }
  return null; }
export function buildMossLayer(model, moss){
  const old=model.getObjectByName('moss'); if (old){ model.remove(old); old.geometry.dispose(); }
  if (!moss) return null; const keys=Object.keys(moss).filter(k=>moss[k]>0); if (!keys.length) return null;
  const per=[0,7,13,22]; let total=0; for (const k of keys) total+=per[Math.min(3,moss[k])]||0;
  const geo=new THREE.IcosahedronGeometry(1,1), mat=new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.95 });
  const im=new THREE.InstancedMesh(geo, mat, Math.max(1,total)); im.name='moss'; im.castShadow=false; im.receiveShadow=true; let n=0; const col=new THREE.Color();
  for (const k of keys){ const [a,b]=k.split(',').map(Number), L=Math.min(3,moss[k]), hit=roofHit(model,a,b); if (!hit) continue; const [p0,nn]=hit, r=mulberry32(a*928+b*131+7);
    _t2.copy(nn).multiplyScalar(nn.x); _t1.set(1,0,0).sub(_t2).normalize(); _t2.crossVectors(nn,_t1).normalize(); _q.setFromUnitVectors(_up, nn); const half=BUILD.EC/MOSS_GRID*0.55;
    for (let q=0;q<per[L];q++){ const u=(r()-0.5)*2*half, v=(r()-0.5)*2*half, s=(0.045+r()*0.06)*(0.9+L*0.16);
      _p.copy(p0).addScaledVector(_t1,u).addScaledVector(_t2,v).addScaledVector(nn, 0.1+s*0.2); _s.set(s*(1.1+r()*0.6), s*(0.3+r()*0.25), s*(0.9+r()*0.5));
      _m.compose(_p, _q, _s); im.setMatrixAt(n, _m); col.setHex(MOSS_COL[Math.floor(r()*MOSS_COL.length)]).offsetHSL(0,0,(r()-0.5)*0.06); im.setColorAt(n, col); n++; } }
  im.count=n; im.instanceMatrix.needsUpdate=true; if (im.instanceColor) im.instanceColor.needsUpdate=true; model.add(im); return im; }
// Mossy shingles you haven't painted: patchy moss over those roofs, the same every time
export function defaultMoss(home){ const plan=home.plan, E=Object.assign(defaultExt(), home.ext), top=topFloor(plan), out={}; let any=false;
  for (let n=0;n<=top;n++) for (const r of floorOf(plan,n).rooms){ if ((r.roof||E.roof)!=='mossy') continue; any=true;
    for (let a=r.x*MOSS_GRID-1;a<(r.x+r.w)*MOSS_GRID+1;a++) for (let b=r.z*MOSS_GRID-1;b<(r.z+r.d)*MOSS_GRID+1;b++){ const v=mulberry32(a*7919+b*104729+n*31)(), L = v<0.3?0 : v<0.6?1 : v<0.86?2 : 3; if (L) out[a+','+b]=Math.max(out[a+','+b]||0, L); } }
  return any ? out : null; }
// Every half square a roof covers (to start a painted map from an all-mossy roof)
export function roofHalfCells(home){ const out=[], plan=home.plan, top=topFloor(plan); const seen=new Set();
  for (let n=0;n<=top;n++) for (const r of floorOf(plan,n).rooms) for (let a=r.x*MOSS_GRID-1;a<(r.x+r.w)*MOSS_GRID+1;a++) for (let b=r.z*MOSS_GRID-1;b<(r.z+r.d)*MOSS_GRID+1;b++){ const k=a+','+b; if (!seen.has(k)){ seen.add(k); out.push([a,b]); } }
  return out; }

/* ---------- Player house, inside. Origin = the room's origin; the grid sits like the outside one. ---------- */
const FLOOR_KIND = { wood:'wood', parquet:'parquet', tile:'tile', stone:'stone', carpet:'carpet' };
const ctx = (()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d'); const g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,.45)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; })();
const beamTex = (()=>{ const cv=document.createElement('canvas'); cv.width=64; cv.height=128; const x=cv.getContext('2d'); const g=x.createLinearGradient(0,0,0,128); g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,128);
  const h=x.createLinearGradient(0,0,64,0); h.addColorStop(0,'rgba(0,0,0,1)'); h.addColorStop(0.3,'rgba(0,0,0,0)'); h.addColorStop(0.7,'rgba(0,0,0,0)'); h.addColorStop(1,'rgba(0,0,0,1)'); x.globalCompositeOperation='destination-out'; x.fillStyle=h; x.fillRect(0,0,64,128); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; })();
const addMat = (color, op) => new THREE.MeshBasicMaterial({ map:ctx, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false });
function pool(p, w, d, x, y, z, color, op, vertical=false){ const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d), addMat(color, op)); m.castShadow=m.receiveShadow=false; if (!vertical) m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.renderOrder=2; p.add(m); return m; }
function glowBall(p, x, y, z, s, color, op){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:ctx, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false })); sp.position.set(x,y,z); sp.scale.set(s,s,1); p.add(sp); return sp; }
function lightBeam(p, x, y, z, h, r, color, op){ const g=new THREE.ConeGeometry(r, h, 20, 1, true); g.translate(0,-h/2,0); const m=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map:beamTex, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, toneMapped:false })); m.castShadow=false; m.position.set(x,y,z); m.renderOrder=3; p.add(m); return m; }
// Warm, neutral or cool, from the room's warmth slider (0..1, 0.5 = the old warm white)
export function lightColor(warm){ const w=warm??0.5; const a=new THREE.Color(0xffb46a), b=new THREE.Color(0xffe2b8), c=new THREE.Color(0xe6efff); return w>=0.5 ? b.clone().lerp(a,(w-0.5)*2) : b.clone().lerp(c,(0.5-w)*2); }
const MAX_LIGHTS = 8;
// Room light tuning: intensity = (k0 + sqrt(floor area) * k1) * brightness^pw * kb; reach = room diagonal * dk + d0. amb/sun: the ambient light in your home.
export const LT = { k0:3, k1:1.0, pw:1.4, kb:2.4, dk:0.62, d0:2.5, dec:1.3, amb:0.6, sun:0.38 };   // real lights per floor (phones); smaller rooms past that glow with light pools only
function ceilingFixture(p, kind, x, z, WH, col, b){ const f=new THREE.Group(); f.position.set(x,0,z); p.add(f); const em=(c,k=1)=>new THREE.MeshStandardMaterial({ color:c, emissive:col, emissiveIntensity:(0.25+b*1.4)*k, roughness:0.5 });
  const cord=(len)=>{ mk(G.cyl(0.012,0.012,len,4), M(0x3a302a), 0,WH-len/2,0,f).castShadow=false; mk(G.cyl(0.09,0.09,0.03,12), M(0xf2ead8), 0,WH-0.015,0,f).castShadow=false; };
  if (kind==='pendant'){ cord(0.75); const sh=mk(new THREE.SphereGeometry(0.22,16,10,0,TAU,0,Math.PI*0.55), new THREE.MeshStandardMaterial({ color:0xd8f0e8, roughness:0.2, transparent:true, opacity:0.55, side:THREE.DoubleSide }), 0,WH-0.75,0,f); sh.rotation.x=Math.PI; sh.castShadow=false; mk(G.sph(0.07,10,8), em(0xfff4dc,1.4), 0,WH-0.85,0,f); }
  else if (kind==='chandelier'){ cord(0.5); const y=WH-0.75; mk(G.tor(0.38,0.02,6,24), brass(), 0,y,0,f).rotation.x=Math.PI/2; mk(G.sph(0.07,10,8), brass(), 0,y+0.12,0,f);
    for (let k=0;k<6;k++){ const a=k/6*TAU, cx=Math.cos(a)*0.38, cz=Math.sin(a)*0.38; mk(G.cyl(0.03,0.025,0.06,8), brass(), cx,y+0.04,cz,f); const fl=mk(G.cone(0.025,0.08,8), em(0xfff0c0,1.6), cx,y+0.12,cz,f); fl.castShadow=false; const sp=new THREE.Group(); sp.position.set(cx,y+0.12,cz); f.add(sp); glowBall(sp,0,0,0,0.45,col,0.35*b+0.1); } }
  else if (kind==='paper'){ cord(0.65); const l=mk(G.sph(0.3,16,12), em(0xfff6e6,0.8), 0,WH-0.95,0,f); l.scale.y=0.9; l.castShadow=false; for (let k=-1;k<=1;k++) mk(G.tor(0.3*Math.cos(k*0.45),0.006,4,20), M(0xd8c8a8), 0,WH-0.95+k*0.12,0,f).rotation.x=Math.PI/2; }
  else if (kind==='bulbs'){ mk(G.cyl(0.14,0.14,0.03,14), M(0x3a302a), 0,WH-0.015,0,f).castShadow=false;
    for (let k=0;k<3;k++){ const a=k/3*TAU+0.4, rx=Math.cos(a)*0.12, rz=Math.sin(a)*0.12, len=0.45+k*0.22; mk(G.cyl(0.008,0.008,len,4), M(0x2a2420), rx,WH-len/2,rz,f).castShadow=false; mk(G.cyl(0.025,0.025,0.05,8), brass(), rx,WH-len-0.02,rz,f).castShadow=false;
      const bl=mk(G.sph(0.06,10,8), em(0xffe6b0,1.6), rx,WH-len-0.1,rz,f); bl.scale.y=1.35; bl.castShadow=false; const sp=new THREE.Group(); sp.position.set(rx,WH-len-0.1,rz); f.add(sp); glowBall(sp,0,0,0,0.5,col,0.2+b*0.3); } }
  else { cord(0.45); mk(G.cyl(0.03,0.03,0.06,8), M(0xb8a888), 0,WH-0.48,0,f); const bl=mk(G.sph(0.06,10,8), em(0xfff4dc,1.5), 0,WH-0.56,0,f); bl.scale.y=1.2; bl.castShadow=false; }
  return f; }
export function buildHomeInterior(home, n=0){
  const { GW, GD, IC } = BUILD; const full=home.plan, F=floorOf(full,n), plan = n ? { rooms:F.rooms, links:F.links||{}, iw:F.iw, door:null } : full; const g=new THREE.Group(); const occ=planGrid(plan);
  const row=n, cx=ix, cz=iz; const WH=3.0, T=0.16;
  const walls=[], segs=[]; let bb=[1e9,1e9,-1e9,-1e9];
  const paperMat = (r, len) => tiled(r.paper==='plain'?'stucco':'p:'+r.paper, r.paperC, len, WH, 1.6);
  plan.rooms.forEach(r=>{ const x0=cx(r.x), x1=cx(r.x+r.w), z0=cz(r.z), z1=cz(r.z+r.d);
    bb=[Math.min(bb[0],x0),Math.min(bb[1],z0),Math.max(bb[2],x1),Math.max(bb[3],z1)];
    const fl=mk(G.box(x1-x0,0.1,z1-z0), tiled(FLOOR_KIND[r.floor]||'wood', r.floorC, x1-x0, z1-z0, r.floor==='tile'?2.4:1.6, {roughness:r.floor==='tile'?0.5:0.85}), (x0+x1)/2,-0.05,(z0+z1)/2,g); fl.castShadow=false; });
  const piece=(xa,za,xb,zb,room,side,h=WH,y0=0,shared)=>{
    const horiz=Math.abs(za-zb)<1e-6, len=horiz?Math.abs(xb-xa):Math.abs(zb-za); if (len<0.02) return null;
    const th = shared ? T/2 : T; const geo = horiz ? G.box(len,h,th) : G.box(th,h,len); geo.translate(0,h/2,0);
    const m=new THREE.Mesh(geo, paperMat(room, len)); m.castShadow=false; m.receiveShadow=true;
    const off = shared ? side*th/2 : -side*th/2;
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
    const w={ meshes:ms, lintels, horiz, z: horiz?za:null }; walls.push(w); return w;
  };
  const inWin=(w, x, z, ry)=>{ const p=new THREE.Group(); p.position.set(x,1.7,z); p.rotation.y=ry; g.add(p); mk(G.box(1.1,1.0,0.06),M(0xffffff),0,0,0,p); mk(G.box(0.92,0.82,0.04),windowMat,0,0,0.03,p); mk(G.box(0.05,0.82,0.06),M(0xffffff),0,0,0.05,p); mk(G.box(1.2,0.08,0.16),M(0xffffff),0,-0.5,0.06,p); w.lintels.push(p); };
  const inBalc=(w, x, z, ry)=>{ const p=new THREE.Group(); p.position.set(x,0,z); p.rotation.y=ry; g.add(p); mk(G.box(1.2,2.2,0.06),M(0xffffff),0,1.1,0,p); for (const s of [-1,1]){ mk(G.box(0.5,2.05,0.04),windowMat,s*0.27,1.06,0.03,p); mk(G.box(0.04,2.05,0.06),M(0xffffff),s*0.02,1.06,0.05,p); } w.lintels.push(p); };
  const d=plan.door; let doorPt=[0,0];
  const runs=[];
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ const k=occ[j][i]; if (k<0) continue;
    const e=(a,b)=>!(occ[b]?.[a]>=0);
    if (e(i,j-1)) runs.push({ horiz:true, z:cz(j), a:cx(i), b:cx(i+1), side:+1, k, cell:[i,j], front:false, wk:1 });
    if (e(i,j+1)) runs.push({ horiz:true, z:cz(j+1), a:cx(i), b:cx(i+1), side:-1, k, cell:[i,j], front:true, wk:0 });
    if (e(i-1,j)) runs.push({ horiz:false, x:cx(i), a:cz(j), b:cz(j+1), side:+1, k, cell:[i,j], wk:3 });
    if (e(i+1,j)) runs.push({ horiz:false, x:cx(i+1), a:cz(j), b:cz(j+1), side:-1, k, cell:[i,j], wk:2 });
  }
  const roomWalls=plan.rooms.map(()=>[]);
  const tf=topFloor(full), allG=[]; for (let q=0;q<=tf;q++) allG.push(planGrid(floorOf(full,q)));
  const balcSet=new Set(balconyList(full, Object.assign(defaultExt(), home.ext), allG, tf).map(q=>winKey(q[1],q[2],q[3],q[0])));
  for (const r of runs){ const room=plan.rooms[r.k]; const isDoor = r.front && d && d.i===r.cell[0] && d.j===r.cell[1]; let w, win=false;
    const bal = balcSet.has(winKey(r.cell[0], r.cell[1], r.wk, row));
    if (r.horiz){ const gap = isDoor ? [(IC/2-0.65)/IC, (IC/2+0.65)/IC] : null; if (isDoor) doorPt=[(r.a+r.b)/2, r.z];
      w=addWall(r.a, r.z, r.b, r.z, 'ext', room, r.side, null, 0, gap);
      if (bal) inBalc(w, (r.a+r.b)/2, r.z+r.side*0.02, r.side>0?0:Math.PI); else if (!isDoor && winAt(full, r.cell[0], r.cell[1], r.wk, row)){ inWin(w, (r.a+r.b)/2, r.z+r.side*0.02, r.side>0?0:Math.PI); win=true; }
    } else { w=addWall(r.x, r.a, r.x, r.b, 'ext', room, r.side, null, 0, null);
      if (bal) inBalc(w, r.x+r.side*0.02, (r.a+r.b)/2, r.side>0?Math.PI/2:-Math.PI/2); else if (winAt(full, r.cell[0], r.cell[1], r.wk, row)){ inWin(w, r.x+r.side*0.02, (r.a+r.b)/2, r.side>0?Math.PI/2:-Math.PI/2); win=true; } }
    roomWalls[r.k].push({ w, r, open: !win && !isDoor && !bal }); }
  // inside walls between rooms
  const shared=new Map();
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ const k=occ[j][i]; if (k<0) continue;
    for (const [di,dj] of [[1,0],[0,1]]){ const nn=occ[j+dj]?.[i+di]; if (nn===undefined||nn<0||nn===k) continue;
      const A=plan.rooms[k], B=plan.rooms[nn]; const key=linkKey(A.id,B.id)+(dj?':h':':v');
      if (!shared.has(key)) shared.set(key, { A:k, B:nn, horiz:!!dj, cells:[] }); shared.get(key).cells.push([i,j]); } }
  for (const s of shared.values()){
    const A=plan.rooms[s.A], B=plan.rooms[s.B], type=linkOf(plan,A.id,B.id); if (type==='open') continue;
    s.cells.sort((p,q)=>s.horiz?p[0]-q[0]:p[1]-q[1]);
    const a0 = s.horiz ? cx(s.cells[0][0]) : cz(s.cells[0][1]), a1 = s.horiz ? cx(s.cells[s.cells.length-1][0]+1) : cz(s.cells[s.cells.length-1][1]+1);
    const len=a1-a0, gap = type==='door' ? [(len/2-0.65)/len, (len/2+0.65)/len] : null;
    if (s.horiz){ const z=cz(s.cells[0][1]+1); addWall(a0,z,a1,z,'int',A,-1,B,+1,gap); }
    else { const x=cx(s.cells[0][0]+1); addWall(x,a0,x,a1,'int',A,-1,B,+1,gap); }
  }
  // v1.74: inside walls within one room (both faces take that room's wallpaper), each with an optional doorway
  for (const w of innerWalls(plan, occ)){ const room=plan.rooms[w.k], gap = w.t==='door' ? [(IC/2-0.65)/IC, (IC/2+0.65)/IC] : null;
    if (w.kind==='h'){ const z=cz(w.j); addWall(cx(w.i), z, cx(w.i+1), z, 'int', room, -1, room, +1, gap); }
    else { const x=cx(w.i); addWall(x, cz(w.j), x, cz(w.j+1), 'int', room, -1, room, +1, gap); } }
  if (d){ mk(G.box(1.3,0.08,0.3), M(0x8b5e3a), doorPt[0], 0.04, doorPt[1]+0.1, g).castShadow=false; mk(G.box(1.1,0.04,0.6), M(0xc04a3a), doorPt[0], 0.02, doorPt[1]-0.5, g).castShadow=false; }
  // ---- lighting, room by room: an overhead light (free, with brightness and warmth), plus fixtures you've installed ----
  const order=plan.rooms.map((r,k)=>[r.w*r.d,k]).sort((a,b)=>b[0]-a[0]).map(q=>q[1]), real=new Set(order.slice(0,MAX_LIGHTS)), lights=[];
  plan.rooms.forEach((r,k)=>{ const x0=cx(r.x), x1=cx(r.x+r.w), z0=cz(r.z), z1=cz(r.z+r.d), W=x1-x0, D=z1-z0, mx=(x0+x1)/2, mz=(z0+z1)/2;
    const b=Math.max(0, Math.min(1, r.bright??0.75)), col=lightColor(r.warm), area=W*D;
    if (b>0.02 && real.has(k)){ const L=new THREE.PointLight(col, (LT.k0+Math.sqrt(area)*LT.k1)*Math.pow(b,LT.pw)*LT.kb, Math.max(7, Math.hypot(W,D)*LT.dk+LT.d0), LT.dec); L.position.set(mx, 2.95, mz); g.add(L); lights.push(L); }
    // the overhead fixture(s): one per 4 x 4 squares or so
    const nx=Math.max(1,Math.round(r.w/3.5)), nz=Math.max(1,Math.round(r.d/3.5));
    for (let a=0;a<nx;a++) for (let c=0;c<nz;c++){ const fx=x0+(a+0.5)*W/nx, fz=z0+(c+0.5)*D/nz; ceilingFixture(g, r.ceil||'bulb', fx, fz, WH, col, b);
      if (b>0.02) pool(g, Math.min(W/nx,6)*1.2, Math.min(D/nz,6)*1.2, fx, 0.012, fz, col, 0.05+b*0.12); }
    const accent=r.accent||'none', sconce=r.sconce||'none';
    // wall lights: on plain stretches of outside wall, every other square, at most 6 per room
    if (sconce!=='none'){ let used=0; roomWalls[k].forEach((q,idx)=>{ if (!q.open || used>=6 || (q.r.cell[0]+q.r.cell[1])%2) return; used++;
      const R=q.r, horiz=R.horiz, px=horiz?(R.a+R.b)/2:R.x+R.side*0.1, pz=horiz?R.z+R.side*0.1:(R.a+R.b)/2, ry = horiz ? (R.side>0?0:Math.PI) : (R.side>0?Math.PI/2:-Math.PI/2);
      const sc=new THREE.Group(); sc.position.set(px,2.0,pz); sc.rotation.y=ry; g.add(sc); q.w.lintels.push(sc);
      if (sconce==='candle'){ mk(G.box(0.14,0.22,0.03), brass(), 0,0,0.015,sc); for (const s of [-1,1]){ const arm=mk(G.cyl(0.012,0.012,0.18,5), brass(), s*0.08,0.02,0.09,sc); arm.rotation.z=s*0.7; mk(G.cyl(0.03,0.03,0.12,8), M(0xfff4e0), s*0.14,0.14,0.12,sc); mk(G.cone(0.018,0.05,8), new THREE.MeshStandardMaterial({ color:0xffd080, emissive:0xffa040, emissiveIntensity:1.6 }), s*0.14,0.23,0.12,sc).castShadow=false; glowBall(sc, s*0.14,0.24,0.14, 0.5, col, 0.25+b*0.35); } }
      else if (sconce==='iron'){ const h=new THREE.Group(); h.position.set(0,0,0.2); sc.add(h); lanternHead(h, 0.8, false); mk(G.box(0.03,0.03,0.2), iron(), 0,0.12,0.1,sc); glowBall(sc, 0,0,0.2, 0.8, col, 0.25+b*0.35); }
      else { mk(G.box(0.16,0.24,0.05), brass(), 0,0,0.025,sc); const arm=mk(G.cyl(0.02,0.02,0.22,6), brass(), 0,0.04,0.14,sc); arm.rotation.x=Math.PI/2; mk(new THREE.CylinderGeometry(0.06,0.11,0.14,12,1,true), new THREE.MeshStandardMaterial({ color:0xfff0d0, emissive:0xffc070, emissiveIntensity:0.5+b*1.0, side:THREE.DoubleSide }), 0,0.12,0.25,sc).castShadow=false; glowBall(sc, 0,0.12,0.28, 0.9, col, 0.25+b*0.4); }
      pool(sc, 1.5, 1.9, 0,0.1,0.02, col, 0.08+b*0.2, true); }); }
    if (accent==='cove'){ roomWalls[k].forEach(q=>{ const R=q.r, horiz=R.horiz, len=horiz?Math.abs(R.b-R.a):Math.abs(R.b-R.a), px=horiz?(R.a+R.b)/2:R.x+R.side*0.12, pz=horiz?R.z+R.side*0.12:(R.a+R.b)/2, ry = horiz ? (R.side>0?0:Math.PI) : (R.side>0?Math.PI/2:-Math.PI/2);
      const cv=new THREE.Group(); cv.position.set(px,WH-0.25,pz); cv.rotation.y=ry; g.add(cv); q.w.lintels.push(cv);
      mk(G.box(len,0.12,0.12), M(0xe8dcc8), 0,0,0.04,cv).castShadow=false; mk(G.box(len-0.05,0.03,0.04), new THREE.MeshStandardMaterial({ color:0xfff4dc, emissive:col, emissiveIntensity:0.5+b*1.4 }), 0,-0.07,0.06,cv).castShadow=false;
      pool(cv, len*1.05, 1.6, 0,-0.8,0.01, col, 0.08+b*0.2, true); }); }
    else if (accent==='spots'){ const spots=Math.min(4,Math.max(2,Math.round((r.w+r.d)/3))); for (let q=0;q<spots;q++){ const t=(q+0.5)/spots, sx = W>=D ? x0+t*W : mx+(q%2?0.6:-0.6), sz = W>=D ? mz+(q%2?0.5:-0.5) : z0+t*D;
      const can=mk(G.cyl(0.07,0.1,0.16,10), M(0x2e2824), sx,WH-0.1,sz,g); can.castShadow=false; lightBeam(g, sx,WH-0.18,sz, WH-0.2, 0.75, col, 0.05+b*0.1); pool(g, 1.7,1.7, sx,0.014,sz, col, 0.08+b*0.2); } }
    else if (accent==='fairy'){ const r2=mulberry32(r.x*31+r.z*7+3), bl=new THREE.MeshStandardMaterial({ color:0xfff4dc, emissive:col, emissiveIntensity:0.6+b*1.6 }); const nS=Math.max(2,Math.round(Math.max(W,D)/3.2));
      for (let s=0;s<nS;s++){ const along=W>=D, t=(s+0.5)/nS, ax=along?x0+0.2:x0+t*W, az=along?z0+t*D:z0+0.2, bx=along?x1-0.2:x0+t*W, bz=along?z0+t*D:z1-0.2, L=Math.hypot(bx-ax,bz-az), nb=Math.round(L/0.45);
        for (let q=0;q<=nb;q++){ const u=q/nb, y=WH-0.15-Math.sin(u*Math.PI)*0.55; const pb=mk(G.sph(0.03,6,4), bl, ax+(bx-ax)*u, y, az+(bz-az)*u, g); pb.castShadow=false; if (q%3===1) glowBall(g, pb.position.x, y, pb.position.z, 0.45, col, 0.18+b*0.25); } } }
  });
  let stairsUp=null, stairsDown=null;
  if (floorHas(full,n+1)){ const st=stairsOf(full,n+1); if (st) stairsUp=[cx(st.i)+IC/2, cz(st.j)+IC/2]; }
  if (n>0){ const st=stairsOf(full,n); if (st) stairsDown=[cx(st.i)+IC/2, cz(st.j)+IC/2]; }
  g.userData={ walls, segs, door:doorPt, bbox:bb, occ, stairsUp, stairsDown, lights, floor:n };
  return g;
}
