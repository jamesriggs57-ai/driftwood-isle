/* =====================================================================
   v1.58 THE FAR SHORE: one side of the main island reaches further out to sea, about half as much land again.
   The new land is all off one side, left wild: trees, rocks, flowers and critters, no buildings or paths.
   Everything here is pure maths so main.js (and a visitor's game) work out the same shape from the same save.

   E = { a, W, D } : the direction it reaches (radians, like islandRadius), its half-width in radians, and how far
   the coast moves out at its middle (metres). The old coast is R0(a); the new one is R0(a) + D*bulge(a).
   Old saves keep every building, path, tree and placed item where it was: only the coastline on that side moves.
   ===================================================================== */
import { TAU, smooth, segDist } from './util.js';

export const EXT_GROW = 0.5;   // half as much land again
const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b)));

/* v1.62 EVEN GROWTH: E = { even:1, D, ph:[3 phases] } moves the whole coast out, a little more in some places than others,
   so the island keeps its own shape and simply grows all round. Its bulge is about 1 everywhere (0.7 to 1.3). */
export const evenG = (E, a) => 1 + 0.16*Math.sin(2*a+E.ph[0]) + 0.10*Math.sin(3*a+E.ph[1]) + 0.05*Math.sin(5*a+E.ph[2]);
export function makeEven(R0, seed){ let s=(seed|0)+6203; const r=()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^(s>>>15), 1|s); t=(t+Math.imul(t^(t>>>7), 61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
  const E={ even:1, a:0, W:Math.PI, D:0, ph:[r()*TAU, r()*TAU, r()*TAU].map(v=>+v.toFixed(3)) };
  E.D=+extDepth(R0, 0, Math.PI, E).toFixed(2); return E; }
// how far out the coast moves at angle a, from 0 (old coast) to 1 (the full reach); a few slow wobbles so it isn't a perfect arc
export function extBulge(E, a){ if (!E) return 0; if (E.even) return evenG(E, a); const d=angDist(a, E.a); if (d>=E.W) return 0;
  const s=Math.atan2(Math.sin(a-E.a), Math.cos(a-E.a)); return smooth(E.W, E.W*0.45, d)*(1 + 0.07*Math.sin(s*7+1.3) + 0.04*Math.sin(s*13+0.4)); }
export const extR = (R0, E, a) => R0(a) + (E ? E.D*extBulge(E, a) : 0);

/* Where a point sits between the middle (0) and the coast (1), as the island's own shape code expects.
   Inland (up to 0.7 of the old radius) it is exactly what it always was, so old ground keeps its height.
   Near the new coast it is measured back from that coast at the old scale, so the new beach is the same width as the old ones. */
export function extT(R0, E, x, z){ const a=Math.atan2(z,x), r=Math.hypot(x,z), r0=R0(a), t=r/r0;
  if (!E || t<=0.7) return t; const b=extBulge(E, a); if (b<=0) return t;
  return Math.max(0.7, 1-(r0+E.D*b-r)/r0); }

// the depth D that adds EXT_GROW of the old area for a given half-width W
export function extDepth(R0, a, W, base){ const old=area(R0, null);
  let lo=0, hi=200; for (let it=0; it<40; it++){ const D=(lo+hi)/2, add=area(R0, { ...(base||{}), a, W, D })-old; if (add<old*EXT_GROW) lo=D; else hi=D; }
  return (lo+hi)/2; }
function area(R0, E){ let s=0; const N=720; for (let i=0;i<N;i++){ const a=i/N*TAU, r=extR(R0, E, a); s+=r*r/2; } return s*TAU/N; }

/* Pick the side. o: { R0(a), SC, pref (radians), isles:[{cx,cz,r}], bridges:[[ax,az,bx,bz]], avoid:[[x,z,r]], avoidA:[[a, half-width]] }
   Isles already raised, or still to come in their usual places, must stay clear, and so must their bridges, the dock and the river mouth.
   Tries a broad side first and narrows it (reaching further) if nothing fits. */
export function chooseExt(o){
  const { R0, SC, pref }=o, need=4*SC, best={ E:null, c:-1e9 };
  for (const W of [0.87, 0.74, 0.62, 0.5]){
    const D0=extDepth(R0, 0, W);   // the depth hardly depends on the direction; refined for the winner below
    let pick=null, pd=1e9;
    for (let i=0;i<120;i++){ const a=-Math.PI+i/120*TAU; if (o.avoidA.some(([aa,w])=>angDist(a,aa)<W+w)) continue;
      const E={ a, W, D:D0 }, c=clearance(E, o);
      if (c>best.c){ best.c=c; best.E=E; }
      if (c>=need){ const d=angDist(a, pref); if (d<pd){ pd=d; pick=E; } } }
    if (pick){ pick.D=extDepth(R0, pick.a, W); return round(pick); }
  }
  const E=best.E || { a:pref, W:0.5, D:0 }; E.D=extDepth(R0, E.a, E.W); return round(E);   // nothing fits cleanly: the least crowded side
}
const round = E => ({ a:+E.a.toFixed(4), W:+E.W.toFixed(3), D:+E.D.toFixed(2) });
// how close the new land (plus a strip of sea for its beach) comes to anything it must keep clear of; below 0 means it overlaps
export function clearance(E, o){
  const { R0, SC }=o; let m=1e9;
  for (let i=0;i<=24;i++){ const a=E.a-E.W+i/24*2*E.W, b=extBulge(E, a); if (b<=0.01) continue; const r0=R0(a), r1=r0+E.D*b+8*SC, ux=Math.cos(a), uz=Math.sin(a);
    for (let k=0;k<=6;k++){ const r=r0*0.9+(r1-r0*0.9)*k/6, x=ux*r, z=uz*r;
      for (const I of o.isles) m=Math.min(m, Math.hypot(x-I.cx, z-I.cz)-I.r*1.25);
      for (const [ax,az,bx,bz] of o.bridges) m=Math.min(m, segDist(x,z,ax,az,bx,bz)-3*SC);
      for (const [px,pz,pr] of o.avoid) m=Math.min(m, Math.hypot(x-px,z-pz)-pr); } }
  return m;
}
// a few gentle terraced hills out on the new land (same form as a layout's mounds: [x, z, height, radius])
export function extMounds(R0, E, SC, avoidA){
  if (!E) return [];
  if (E.even){   // v1.62 small hills here and there round the new ring of land, kept away from the dock, the river mouth and the isles' bridges
    const out=[], av=avoidA||[];
    for (let i=0;i<14 && out.length<6;i++){ const a=(i*0.618034*TAU+E.ph[0])%TAU, g=evenG(E,a); if (g<0.9 || av.some(([aa,w])=>angDist(a,aa)<w)) continue;
      if (out.some(m=>Math.hypot(m[0]-Math.cos(a)*R0(a), m[1]-Math.sin(a)*R0(a))<30*SC)) continue;
      const r=R0(a)+E.D*g*0.5; out.push([+(Math.cos(a)*r).toFixed(1), +(Math.sin(a)*r).toFixed(1), +(0.9+0.4*(g-0.9)).toFixed(2), +(6*SC).toFixed(1)]); }
    return out; }
  const at=(da, f)=>{ const a=E.a+da*E.W, r=R0(a)+E.D*extBulge(E,a)*f; return [Math.cos(a)*r, Math.sin(a)*r]; };
  return [ [...at(0.05, 0.55), 2.0, 14*SC], [...at(-0.45, 0.4), 1.4, 11*SC], [...at(0.5, 0.35), 1.2, 10*SC] ];
}
// the box that holds the old island and the new land, plus a margin of sea
export function extBox(R0, E, pad){ let x0=0, z0=0, x1=0, z1=0;
  for (let i=0;i<360;i++){ const a=i/360*TAU, r=extR(R0, E, a)+pad; x0=Math.min(x0, Math.cos(a)*r); x1=Math.max(x1, Math.cos(a)*r); z0=Math.min(z0, Math.sin(a)*r); z1=Math.max(z1, Math.sin(a)*r); }
  return [x0, z0, x1, z1]; }
