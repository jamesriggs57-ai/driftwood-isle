/* =====================================================================
   ISLAND LAYOUTS: where buildings, residents and hills go.
   'classic' is the original island (spread out) and must never change, because existing saves
   (trees, rocks, felled stumps) are keyed to it. New layouts can be added freely.
   Coordinates: +x is east (screen right), +z is toward the camera (screen down). Doors face +z.
   The three preset layouts share one river, pond and dock. Generated islands ('gen') make their own.
   ===================================================================== */
import { TAU, clamp, lerp, mulberry32, polyDist } from './util.js';

export const LAYOUTS = {
  classic: {
    name: 'Spread out',
    blurb: 'Neighbors live all over the island, some across the river. Lots of walking and room to explore.',
    places: { plaza:[0,0], board:[-4,-3.5], shop:[11,-6], home:[-14,9], museum:[3,-18], aquarium:[20,-15], garden:[-12,-5] },
    lot: { x:-14, z:8.5 },
    homes: null,   // residents keep the homes in content.js
    mounds: [ [-36,-16,1.0,20], [-22,28,2.4,18], [20,32,2.0,15], [30,-24,2.0,15], [-4,16,1.3,13], [8,-26,1.1,10] ],
  },
  village: {
    name: 'Village',
    blurb: 'Everyone lives close together around the plaza. Cozy and quick to get around.',
    places: { plaza:[0,0], board:[-4,-3.5], shop:[9,-5], home:[-12,10], museum:[2,-17], aquarium:[17,-11], garden:[-11,-6] },
    lot: { x:-12, z:9.5 },
    homes: { pippa:[11,10], lumi:[0,15], bramble:[-24,2], otis:[23,0], mabel:[15,-24], juniper:[-24,16], clover:[22,13] },
    mounds: [ [-30,30,2.2,16], [26,-30,2.0,14], [-34,-12,1.4,14], [8,32,1.6,12] ],
  },
  highlands: {
    name: 'Highlands',
    blurb: 'A hilly town on terraces. Tall cliffs on the west side, a wide sandy beach on the east. A waterfall feeds the river.',
    places: { plaza:[0,0], board:[-4,-3.5], shop:[9,-5], home:[-13,9], museum:[2,-17], aquarium:[17,-11], garden:[-11,-6] },
    lot: { x:-13, z:8.5 },
    homes: { pippa:[11,10], lumi:[0,16], bramble:[-25,0], otis:[22,-1], mabel:[14,-25], juniper:[-25,15], clover:[20,13] },
    mounds: [ [-30,8,2.2,22], [-14,26,2.2,16], [-30,-16,1.4,14], [4,30,1.8,12], [20,-28,1.6,12], [0,4,1.0,16] ],
    cliff: { a:Math.PI, lift:2.2, d0:16, d1:40 },   // tall cliff coast on the west, wide beach on the east
    falls: { h:2.75, dir:[-1,0] },                   // hilly islands always get a waterfall at the river's source
  },
};

export const GUEST_LAYOUTS = ['village', 'classic', 'highlands'];

/* Shared defaults for the preset layouts (generated islands bring their own) */
export const DEFAULT_SHAPE = { R:50, ph:[1,2,0.5], scale:1,
  river:[[-30,-6],[-20,-16],[-8,-24],[2,-34],[8,-46],[12,-64]], pond:{ x:30, z:20, r:5 },
  bridges:[[2,0.5],[1,0.35]], bumps:[[-36,-14,1.9,14,3],[38,-24,1.2,9,2]] };
export const islandRadius = (L, a) => L.R*(1 + 0.09*Math.sin(3*a+L.ph[0]) + 0.06*Math.sin(5*a+L.ph[1]) + 0.03*Math.sin(7*a+L.ph[2]));

/* =====================================================================
   ISLAND MAKER: new islands for accounts.
   Terrain changes the hills, cliffs, waterfalls and which trees and flowers grow most.
   Town changes how close together the buildings are. Same seed + same choices = same island.
   Generated islands are about twice the area of the preset ones.
   ===================================================================== */
export const TERRAINS = {
  flat:        { name:'Flat',        blurb:'Gentle meadows and long beaches. Lots of flowers and fruit trees.' },
  hilly:       { name:'Hilly',       blurb:'Rolling terraced hills, maples and oaks, and a waterfall feeding the river.' },
  mountainous: { name:'Mountainous', blurb:'Big terraced peaks covered in pines and cedars, and a tall waterfall.' },
  cliffs:      { name:'Cliffs',      blurb:'A high bluff with ramps up, sheer sea cliffs on one side, and a waterfall.' },
};
export const TOWNS = {
  dense:   { name:'Dense',      blurb:'Everyone lives close to the plaza.' },
  suburbs: { name:'Suburbs',    blurb:'Shops in the middle, neighbors in little clusters around them.' },
  spread:  { name:'Spread out', blurb:'Homes all over the island. More walking, more room.' },
};
// Which trees grow most on each terrain (weights). Higher ground on any island leans toward pines and cedars.
const FLORA = {
  flat:        { trees:{ oak:4, birch:3, blossom:3, maple:2, pine:1, cedar:1 }, fruit:1.4, flowers:1.4, palms:1.0 },
  hilly:       { trees:{ oak:3, maple:4, birch:2, blossom:1, pine:2, cedar:1 }, fruit:1.0, flowers:1.0, palms:0.9 },
  mountainous: { trees:{ pine:5, cedar:4, birch:2, maple:1, oak:1 },             fruit:0.7, flowers:0.6, palms:0.7 },
  cliffs:      { trees:{ pine:4, cedar:3, oak:2, birch:1, maple:1 },             fruit:0.8, flowers:0.8, palms:1.0 },
};
export const RESIDENT_IDS = ['pippa','bramble','lumi','otis','mabel','juniper','clover'];
// footprint radius (for spacing) of each building
const FOOT = { museum:9, shop:5.5, aquarium:7, garden:7.5, tower:4.5, home:7, res:5 };

export function generateLayout(gen){
  const terrain = TERRAINS[gen.terrain] ? gen.terrain : 'hilly', town = TOWNS[gen.town] ? gen.town : 'suburbs';
  for (let attempt=0; attempt<12; attempt++){
    const L = tryGenerate((gen.seed|0) + attempt*7919, terrain, town);
    if (L) return L;
  }
  return tryGenerate(gen.seed|0, terrain, town, true);
}

function tryGenerate(seed, terrain, town, force){
  const r = mulberry32(seed ^ 0x5eed);
  const scale = Math.SQRT2, R = 50*scale;   // twice the area of the preset islands
  const rr = (a,b) => a + r()*(b-a);
  const ph = [rr(0,TAU), rr(0,TAU), rr(0,TAU)];
  const L = { gen:true, name:'Your island', terrain, town, R, ph, scale, bumps:[], places:{ plaza:[0,0], board:[-4,-3.5] }, homes:{}, mounds:[], flora:FLORA[terrain] };
  const radiusAt = a => islandRadius(L, a);
  const tOf = (x,z) => Math.hypot(x,z)/radiusAt(Math.atan2(z,x));
  const inDockLane = (x,z,m=0) => x > 0.42*R && Math.abs(z-4) < 7+m;
  const angDist = (a,b) => Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b)));

  // Cliff side (cliffs terrain): west, north-west or north, so it never blocks the view or the dock
  if (terrain==='cliffs'){
    const a = [Math.PI, -3*Math.PI/4, -Math.PI/2][Math.floor(r()*3)];
    L.cliff = { a, lift:0, d0:16, d1:40 };
    const d0 = rr(0.24, 0.32)*R;
    const ca=Math.cos(a), sa=Math.sin(a), px=-sa, pz=ca;
    const ramps=[]; for (const o of [-0.34, 0, 0.34]){ const x=ca*d0+px*o*R, z=sa*d0+pz*o*R; if (tOf(x,z)<0.8) ramps.push([+x.toFixed(1), +z.toFixed(1)]); }
    L.bluff = { a, d0, h:2.75, ramps };
  }

  // River: from an inland spring out to the coast, wiggling a little. The mouth stays away from the dock (east).
  let river=null;
  for (let k=0; k<60 && !river; k++){
    const as = rr(0,TAU), rs = rr(0.42,0.54)*R, side = r()<0.5?1:-1, am = as + side*rr(0.45,0.95);
    if (angDist(am,0) < 0.75 || angDist(as,0) < 0.5) continue;
    if (L.cliff && (angDist(am, L.cliff.a) < 1.0 || angDist(as, L.cliff.a) < 0.7)) continue;
    const pts=[]; for (let i=0;i<=5;i++){ const f=i/5, a=lerp(as, am, Math.pow(f,0.85)), rad=lerp(rs, radiusAt(am)*1.28, f);
      const w=Math.sin(f*Math.PI)*rr(-6,6); pts.push([Math.cos(a)*rad - Math.sin(a)*w, Math.sin(a)*rad + Math.cos(a)*w]); }
    if (Math.min(...pts.map(p=>Math.hypot(p[0],p[1]))) < 24) continue;
    if (polyDist(0,0,pts) < 26) continue;
    river = pts.map(p=>[+p[0].toFixed(1), +p[1].toFixed(1)]);
  }
  if (!river) return null;
  L.river = river;
  L.bridges = [[1,0.45],[2,0.5],[3,0.4]];   // segment index, position along it

  // Waterfall at the spring for every hilly island
  if (terrain!=='flat') L.falls = { h: terrain==='mountainous' ? 3.85 : terrain==='cliffs' ? 3.3 : 2.75 };
  const s=river[0], n=river[1], dl=Math.hypot(s[0]-n[0],s[1]-n[1]);
  const fallC = L.falls ? [s[0]+(s[0]-n[0])/dl*7, s[1]+(s[1]-n[1])/dl*7] : null;
  if (fallC && Math.hypot(fallC[0],fallC[1]) < 20) return null;

  // Pond
  let pond=null;
  for (let k=0;k<80 && !pond;k++){ const a=rr(0,TAU), d=rr(0.36,0.62)*R, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if (polyDist(x,z,river)<18 || inDockLane(x,z,4) || (fallC && Math.hypot(x-fallC[0],z-fallC[1])<22) || tOf(x,z)>0.7) continue;
    if (L.bluff && bluffD(L.bluff,x,z) > -6) continue;
    pond={ x:+x.toFixed(1), z:+z.toFixed(1), r:+rr(4.8,6).toFixed(1) }; }
  if (!pond) return null;
  L.pond = pond;

  // Hills
  const mk = (n, A0, A1, R0, R1, dmin, dmax, avoidPlaza=10) => { for (let i=0,k=0; i<n && k<200; k++){ const a=rr(0,TAU), d=rr(dmin,dmax)*R, x=Math.cos(a)*d, z=Math.sin(a)*d;
      if (Math.hypot(x,z) < avoidPlaza || polyDist(x,z,river) < 8 || Math.hypot(x-pond.x,z-pond.z) < 12) continue; L.mounds.push([+x.toFixed(1),+z.toFixed(1),+rr(A0,A1).toFixed(2),+rr(R0,R1).toFixed(1)]); i++; } };
  if (terrain==='flat'){ mk(3, 0.5, 0.9, 10, 16, 0.25, 0.65); L.liftAmp=0.45; }
  if (terrain==='hilly'){ mk(8, 1.4, 2.6, 12, 22, 0.2, 0.7); L.liftAmp=1.2; }
  if (terrain==='mountainous'){ mk(2, 4.2, 5.6, 20, 27, 0.4, 0.6, 30); mk(5, 1.5, 2.5, 12, 18, 0.2, 0.7); L.liftAmp=1.6; }
  if (terrain==='cliffs'){ mk(4, 1.0, 2.0, 12, 18, 0.2, 0.65); L.liftAmp=0.9; }

  // Buildings
  const placed=[['plaza',0,0,8],['board',-4,-3.5,2]];
  const ok = (x,z,f,sep) => {
    if (tOf(x,z) > 0.72 || tOf(x,z+f) > 0.76) return false;
    if (polyDist(x,z,river) < f+7 || polyDist(x,z+f*0.6+3,river) < 6) return false;
    if (Math.hypot(x-pond.x,z-pond.z) < pond.r+f+6) return false;
    if (fallC && Math.hypot(x-fallC[0],z-fallC[1]) < f+16) return false;
    if (inDockLane(x,z,f)) return false;
    if (L.bluff && Math.abs(bluffD(L.bluff,x,z)) < f+5) return false;
    for (const m of L.mounds) if (m[2]>3 && Math.hypot(x-m[0],z-m[1]) < m[3]*0.75) return false;
    for (const p of placed) if (Math.hypot(x-p[1],z-p[2]) < f+p[3]+sep) return false;
    return true; };
  const put = (key, f, dmin, dmax, sep, near) => {
    for (let k=0;k<400;k++){ const a=rr(0,TAU), d=rr(dmin,dmax)+k*0.04, cx=near?near[0]:0, cz=near?near[1]:0, x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d;
      if (!ok(x,z,f,sep)) continue; const p=[+x.toFixed(1),+z.toFixed(1)]; placed.push([key,p[0],p[1],f]); return p; }
    if (force){ for (let k=0;k<2000;k++){ const a=rr(0,TAU), d=rr(10,0.65*R), x=Math.cos(a)*d, z=Math.sin(a)*d; if (ok(x,z,f,1)){ const p=[+x.toFixed(1),+z.toFixed(1)]; placed.push([key,p[0],p[1],f]); return p; } } }
    return null; };
  const shopsR = town==='spread' ? [12, 30] : [10, 20], sep = town==='dense' ? 2 : 3;
  for (const k of ['museum','shop','aquarium','garden','tower']){ const p=put(k, FOOT[k], shopsR[0], shopsR[1], sep); if(!p) return null; L.places[k]=p; }
  const homeR = town==='dense' ? [12,24] : town==='suburbs' ? [18,32] : [16,40];
  const home = put('home', FOOT.home, homeR[0], homeR[1], sep); if (!home) return null;
  L.places.home = home; L.lot = { x:home[0], z:+(home[1]-0.5).toFixed(1) };
  if (town==='suburbs'){
    const centers=[]; for (let c=0;c<3;c++){ for (let k=0;k<200;k++){ const a=rr(0,TAU), d=rr(0.36,0.52)*R, x=Math.cos(a)*d, z=Math.sin(a)*d; if (tOf(x,z)>0.62 || centers.some(q=>Math.hypot(q[0]-x,q[1]-z)<26)) continue; centers.push([x,z]); break; } }
    if (centers.length<2) return null;
    RESIDENT_IDS.forEach((id,i)=>{ if (!L) return; const c=centers[i%centers.length]; const p=put(id, FOOT.res, 4, 13, sep, c) || put(id, FOOT.res, 14, 0.62*R, sep); L.homes[id]=p; });
  } else {
    const rr2 = town==='dense' ? [12, 30] : [16, 0.68*R];
    for (const id of RESIDENT_IDS){ const p=put(id, FOOT.res, rr2[0], rr2[1], town==='spread'?8:sep); L.homes[id]=p; }
  }
  if (Object.values(L.homes).some(p=>!p)) return null;
  return L;
}
// signed distance past the bluff edge (positive = up on the bluff)
export function bluffD(B, x, z){ return x*Math.cos(B.a) + z*Math.sin(B.a) - B.d0; }

/* A small top-down map of a layout, for the island maker */
export function drawIslandPreview(cv, L){
  const ctx=cv.getContext("2d"), W=cv.width, H=cv.height, S=W/(L.R*2.45), cx=W/2, cz=H/2;
  const X=x=>cx+x*S, Z=z=>cz+z*S;
  ctx.fillStyle='#4cc3d6'; ctx.fillRect(0,0,W,H);
  const ring=(k,col)=>{ ctx.beginPath(); for(let i=0;i<=96;i++){ const a=i/96*TAU, rd=islandRadius(L,a)*k; const x=Math.cos(a)*rd, z=Math.sin(a)*rd; i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)); } ctx.fillStyle=col; ctx.fill(); };
  ring(1.02,'#f3dca6'); ring(0.9,'#8cc46a');
  for (const m of L.mounds){ const g=ctx.createRadialGradient(X(m[0]),Z(m[1]),0,X(m[0]),Z(m[1]),m[3]*S); const k=clamp(m[2]/5.6,0.15,1); g.addColorStop(0,`rgba(70,110,50,${0.35+0.5*k})`); g.addColorStop(1,'rgba(70,110,50,0)'); ctx.fillStyle=g; ctx.beginPath(); ctx.arc(X(m[0]),Z(m[1]),m[3]*S,0,TAU); ctx.fill(); }
  if (L.bluff){ const B=L.bluff; ctx.save(); ctx.beginPath(); for(let i=0;i<=96;i++){ const a=i/96*TAU, rd=islandRadius(L,a)*0.92; const x=Math.cos(a)*rd, z=Math.sin(a)*rd; i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)); } ctx.clip();
    const ca=Math.cos(B.a), sa=Math.sin(B.a); ctx.fillStyle='rgba(90,120,60,.55)'; ctx.beginPath(); const p0=[ca*B.d0-sa*200, sa*B.d0+ca*200], p1=[ca*B.d0+sa*200, sa*B.d0-ca*200]; ctx.moveTo(X(p0[0]),Z(p0[1])); ctx.lineTo(X(p1[0]),Z(p1[1])); ctx.lineTo(X(p1[0]+ca*300),Z(p1[1]+sa*300)); ctx.lineTo(X(p0[0]+ca*300),Z(p0[1]+sa*300)); ctx.fill();
    ctx.strokeStyle='#6b5a44'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(X(p0[0]),Z(p0[1])); ctx.lineTo(X(p1[0]),Z(p1[1])); ctx.stroke();
    ctx.fillStyle='#d8c48a'; for (const q of B.ramps){ ctx.beginPath(); ctx.arc(X(q[0]),Z(q[1]),4,0,TAU); ctx.fill(); } ctx.restore(); }
  if (L.cliff){ ctx.strokeStyle='#6b5a44'; ctx.lineWidth=4; ctx.beginPath(); for(let i=0;i<=40;i++){ const a=L.cliff.a-0.9+i/40*1.8, rd=islandRadius(L,a); const x=Math.cos(a)*rd, z=Math.sin(a)*rd; i?ctx.lineTo(X(x),Z(z)):ctx.moveTo(X(x),Z(z)); } ctx.stroke(); }
  ctx.strokeStyle='#3aa6c8'; ctx.lineWidth=Math.max(3, 5*S); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.beginPath(); L.river.forEach((p,i)=>i?ctx.lineTo(X(p[0]),Z(p[1])):ctx.moveTo(X(p[0]),Z(p[1]))); ctx.stroke();
  ctx.fillStyle='#3aa6c8'; ctx.beginPath(); ctx.arc(X(L.pond.x),Z(L.pond.z),L.pond.r*S*1.1,0,TAU); ctx.fill();
  if (L.falls){ const [sx,sz]=L.river[0]; ctx.fillStyle='#ffffff'; ctx.strokeStyle='#3aa6c8'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(X(sx),Z(sz),5,0,TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle='#c8a26a'; ctx.beginPath(); ctx.arc(X(0),Z(0),6,0,TAU); ctx.fill();
  const dot=(p,col,rad)=>{ ctx.fillStyle=col; ctx.strokeStyle='#5b4336'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(X(p[0]),Z(p[1]),rad,0,TAU); ctx.fill(); ctx.stroke(); };
  for (const k of ['museum','shop','aquarium','garden','tower']) if (L.places[k]) dot(L.places[k], k==='tower'?'#9a7ad8':'#f2c64a', 5);
  for (const p of Object.values(L.homes||{})) if (p) dot(p,'#ffffff',3.5);
  if (L.places.home) dot(L.places.home,'#e2604d',5);
}

/* =====================================================================
   v1.26 TRIP ISLANDS: small islands you sail to from the dock. About a quarter the area of a generated island,
   no town, just things to gather. They're made from a seed and a theme, and they're gone once you sail home.
   Places that a home island has (museum, shops, your lot) are parked far out of the world so nothing is built.
   ===================================================================== */
export const TRIP_THEMES = {
  plain:     { name:'A quiet island',  terrain:'hilly', blurb:'An island a lot like yours.' },
  orchard:   { name:'Orchard Isle',    terrain:'flat',  blurb:'Fruit trees of every kind.', fruit:4 },
  bloom:     { name:'Bloom Isle',      terrain:'flat',  blurb:'Wild flowers and crops that don\'t grow on your island.', flowers:3 },
  frost:     { name:'Frost Isle',      terrain:'hilly', blurb:'Snowy all year, with winter critters out any month.' },
  moonlit:   { name:'Moonlit Isle',    terrain:'flat',  blurb:'Always night. Night bugs and night fish at any hour.' },
  coral:     { name:'Coral Atoll',     terrain:'flat',  blurb:'A low, sandy atoll with beach finds everywhere.', small:true },
  fossil:    { name:'Fossil Bluffs',   terrain:'mountainous', blurb:'Dig spots everywhere you look.' },
  shipwreck: { name:'Shipwreck Cove',  terrain:'hilly', blurb:'An old wreck on the beach, and bottles washing up.' },
  castaway:  { name:'Castaway Isle',   terrain:'flat',  blurb:'Someone is camping here. Maybe they\'d like a real home.' },
};
const FAR = 4000;
export function generateTrip(gen){
  for (let attempt=0; attempt<20; attempt++){ const L=tryTrip((gen.seed|0)+attempt*7919, gen.theme); if (L) return L; }
  return tryTrip(gen.seed|0, gen.theme, true);
}
function tryTrip(seed, theme, force){
  const T = TRIP_THEMES[theme] || TRIP_THEMES.plain, terrain = T.terrain, r = mulberry32(seed ^ 0x7a1b);
  const scale = T.small ? 0.6 : 0.72, R = 50*scale, rr=(a,b)=>a+r()*(b-a);
  const ph=[rr(0,TAU), rr(0,TAU), rr(0,TAU)];
  const base = FLORA[terrain] || FLORA.hilly;
  const flora = { trees:base.trees, fruit:(T.fruit||1)*base.fruit, flowers:(T.flowers||1)*base.flowers, palms:base.palms*(T.small?1.6:1) };
  const L = { gen:true, trip:true, theme, name:T.name, terrain, town:'trip', R, ph, scale, bumps:[], mounds:[], flora, homes:{},
    places:{ plaza:[0,0], board:[FAR,FAR] } };
  const radiusAt = a => islandRadius(L, a), tOf=(x,z)=>Math.hypot(x,z)/radiusAt(Math.atan2(z,x));
  const angDist = (a,b) => Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b)));
  // a short creek out to the coast, away from the dock on the east
  let river=null;
  for (let k=0;k<60 && !river;k++){ const as=rr(0,TAU), am=as+(r()<0.5?1:-1)*rr(0.3,0.7); if (angDist(am,0)<0.9 || angDist(as,0)<0.7) continue;
    const pts=[]; for (let i=0;i<=3;i++){ const f=i/3, a=lerp(as,am,f), rad=lerp(0.42*R, radiusAt(am)*1.3, f), w=Math.sin(f*Math.PI)*rr(-3,3); pts.push([Math.cos(a)*rad-Math.sin(a)*w, Math.sin(a)*rad+Math.cos(a)*w]); }
    if (polyDist(0,0,pts) < 10) continue; river=pts.map(p=>[+p[0].toFixed(1), +p[1].toFixed(1)]); }
  if (!river) return null;
  L.river=river; L.bridges=[[1,0.5]];
  let pond=null;
  for (let k=0;k<80 && !pond;k++){ const a=rr(0,TAU), d=rr(0.3,0.55)*R, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if (polyDist(x,z,river)<10 || (x>0.3*R && Math.abs(z-4)<10) || tOf(x,z)>0.65 || Math.hypot(x,z)<8) continue; pond={ x:+x.toFixed(1), z:+z.toFixed(1), r:+rr(3.2,4.2).toFixed(1) }; }
  if (!pond) return null;
  L.pond=pond;
  const hills=(n,A0,A1,R0,R1)=>{ for (let i=0,k=0;i<n && k<200;k++){ const a=rr(0,TAU), d=rr(0.2,0.6)*R, x=Math.cos(a)*d, z=Math.sin(a)*d;
      if (Math.hypot(x,z)<8 || polyDist(x,z,river)<6 || Math.hypot(x-pond.x,z-pond.z)<8 || (x>0.3*R && Math.abs(z-4)<8)) continue; L.mounds.push([+x.toFixed(1),+z.toFixed(1),+rr(A0,A1).toFixed(2),+rr(R0,R1).toFixed(1)]); i++; } };
  if (terrain==='flat'){ hills(2,0.4,0.8,7,11); L.liftAmp=0.4; }
  else if (terrain==='mountainous'){ hills(2,2.4,3.4,9,13); hills(2,1.0,1.8,6,9); L.liftAmp=1.2; }
  else { hills(4,1.0,2.0,7,12); L.liftAmp=0.9; }
  // home-island places, parked out of the world
  ['museum','shop','aquarium','garden','tower','home'].forEach((k,i)=>{ L.places[k]=[FAR+i*40, FAR]; });
  L.lot={ x:FAR+200, z:FAR }; RESIDENT_IDS.forEach((id,i)=>{ L.homes[id]=[FAR+400+i*40, FAR]; });
  return L;
}
