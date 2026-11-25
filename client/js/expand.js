/* =====================================================================
   v1.36 NEW LAND: Wendell raises whole new islands out of the sea, one at a time, each about a quarter the size of
   the main island, joined to it by a long bridge (the last one hangs off the bluff on a rope bridge).
   This file holds the shapes and the models. main.js decides when each one is built (only as you come near).

   An isle: { k, kind, name, cx, cz, r, ph:[3], top, dir:[x,z], from:'main'|k, br:{ type, w, gap } }
   Heights: isleRaw(I,x,z) is the isle on its own (sea floor far away). Terraces use the same 0.55 m steps as the island.
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32, hashStr, fbm, vnoise } from './util.js';
import { M, mk, G, glowMat, addGlow } from './models.js';
import { mergeStatic } from './cottage.js';

export const ISLE_ORDER = ['meadow', 'dunes', 'bluff', 'crags'];
export const ISLE_INFO = {
  meadow:{ name:'Clover Meadow', bridge:'causeway', gap:26, blurb:'rolling grass, wildflowers and an orchard of fruit that doesn\'t grow on the main island', sand:false },
  dunes: { name:'Sandpiper Dunes', bridge:'boardwalk', gap:30, blurb:'sand hills, palms and an old shipwreck; the beach there is good for shells', sand:true },
  bluff: { name:'Lantern Bluff', bridge:'trestle', gap:30, blurb:'a high plateau of pines on sheer cliffs, with a lighthouse and good rocks to mine', sand:false },
  crags: { name:'Hollow Crags', bridge:'rope', gap:20, blurb:'mossy stone spires and old ruins out past the bluff, across a rope bridge; rocks heavy with iron', sand:false },
};
// What Wendell asks for each one. need: [item id or item kind, how many]. days: days since the last one rose.
export const ISLE_QUESTS = [
  { kind:'meadow', clams:60000,  need:[['wood',30],['stone',15],['flower',10]], days:0,
    ask:['Hmm. Hmm hmm. The sea out west has been humming at me all week.','There\'s land down there, you know. Old land. It sank long before anyone named this island.','I could bring a piece of it up. A meadow, I think. It wants to be a meadow.',
      'It takes a lot out of a wizard, though. Bring me 30 wood and 15 stone for the footings, 10 flowers so it remembers how to grow, and 60,000 clams for my trouble.'],
    done:['Wood, stone, flowers... and the clams. Yes. Yes! Stand back. No, further back. Further.'] },
  { kind:'dunes', clams:120000, need:[['shell',10],['softwood',20],['coconut',6]], days:3,
    ask:['The meadow took. Good. The sea is jealous now, and it\'s offering more.','There\'s a sandbank down there that used to be dunes. Shipwrecks too, I think. Lovely for beachcombing.',
      'Bring me 10 beach finds, 20 branches and 6 coconuts. It wants to know what a beach is supposed to feel like. And 120,000 clams.'],
    done:['Shells, branches, coconuts. Just so. Now, a little hum, a little wiggle...'] },
  { kind:'bluff', clams:220000, need:[['stone',40],['iron',8],['clay',10]], days:3,
    ask:['This one is bigger. Taller. There\'s a bluff out north, all stone, sitting on the seabed sulking.','It would need a trestle bridge up to the top. And somewhere up there an old lighthouse is waiting to be lit again.',
      'Bring me 40 stone, 8 iron nuggets and 10 clay. And 220,000 clams. Bluffs are heavy.'],
    done:['That\'s a lot of rock. Excellent. Hold onto your hat. Actually, hold onto mine too.'] },
  { kind:'crags', clams:350000, need:[['iron',15],['stone',30],['fossil',2]], days:3,
    ask:['Out past the bluff there are crags. Old, mossy, a bit grumpy. They used to be part of the bluff before the sea cut them off.','I can lift them, but there\'s no way to reach them from here. You\'d have to cross from the cliff on a rope bridge.',
      'Bring me 15 iron nuggets, 30 stone and 2 fossils. The crags like old things. And 350,000 clams. This is the big one.'],
    done:['Iron, stone, fossils. The crags will be pleased. Well. Less grumpy.'] },
];
export const ISLE_STEP = 0.55, ISLE_OFF = 0.85;
const quant = (v, riser=0.2) => { if (v<=ISLE_OFF) return v; const q=(v-ISLE_OFF)/ISLE_STEP, k=Math.floor(q), f=q-k; return ISLE_OFF+ISLE_STEP*(k+smooth(1-riser,1,f)); };
export const PLATEAU = ISLE_OFF + ISLE_STEP*8;   // 5.25 m: the bluff and crag tops, level with each other so the rope bridge can hang between them

/* ---------- Where they go ----------
   o: { seed, SC, shore(a) -> main island shore radius at angle a, ok(a) -> can a bridge land on the main island there }
   Meadow, dunes and bluff each hang off the main island at their own angle; the crags hang off the bluff. */
export function planIsles(n, o){
  const out=[], R=50*o.SC, used=[], r=mulberry32((o.seed|0)+90210);
  const angDist=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const prefer={ meadow:Math.PI, dunes:Math.PI*0.62, bluff:-Math.PI*0.42 };
  for (let k=0;k<Math.min(n,4);k++){
    const kind=ISLE_ORDER[k], info=ISLE_INFO[kind], I={ k, kind, name:info.name, sand:info.sand, ph:[r()*TAU, r()*TAU, r()*TAU] };
    I.r = R*0.51*(kind==='bluff'||kind==='crags' ? 1.08 : 1);   // about a quarter of the main island's area (cliff isles a bit wider: their edges are cliff)
    I.br={ type:info.bridge, gap:info.gap*Math.min(1.25, 0.85+0.15*o.SC), w:info.bridge==='rope'?0.95:1.2 };
    if (kind!=='crags'){
      let best=null, bd=1e9; const saved=o.angles && Number.isFinite(o.angles[k]) ? o.angles[k] : null;
      if (saved===null) for (let i=0;i<144;i++){ const a=-Math.PI+i/144*TAU; if (!o.ok(a)) continue; if (used.some(u=>angDist(u,a)<1.05)) continue; const d=angDist(a,prefer[kind]); if (d<bd){ bd=d; best=a; } }
      if (saved!==null){ best=saved; bd=0; }
      if (best===null) for (let i=0;i<144;i++){ const a=-Math.PI+i/144*TAU; if (used.some(u=>angDist(u,a)<0.9)) continue; const d=angDist(a,prefer[kind]); if (d<bd){ bd=d; best=a; } }
      const a=best??prefer[kind]; used.push(a); I.a=a; I.dir=[Math.cos(a), Math.sin(a)]; I.from='main';
      const shore=o.shore(a); I.cx=I.dir[0]*(shore+I.br.gap+I.r*0.97); I.cz=I.dir[1]*(shore+I.br.gap+I.r*0.97);
    } else {
      const B=out[2]; if (!B) break;
      // out past the bluff, turned away from the main island so it never comes back toward it
      let a=Math.atan2(B.cz, B.cx) + 0.75; const tryAt=aa=>[B.cx+Math.cos(aa)*(B.r*0.97+I.br.gap+I.r*0.97), B.cz+Math.sin(aa)*(B.r*0.97+I.br.gap+I.r*0.97)];
      let [x,z]=tryAt(a); if (out.some(J=>J!==B && Math.hypot(x-J.cx,z-J.cz)<J.r+I.r+20)){ a=Math.atan2(B.cz,B.cx)-0.75; [x,z]=tryAt(a); }
      I.a=a; I.dir=[Math.cos(a), Math.sin(a)]; I.from=2; I.cx=x; I.cz=z;
    }
    const ext=I.r*1.3+8; I.box=[I.cx-ext, I.cz-ext, I.cx+ext, I.cz+ext];
    // spires on the crags (sheer, you walk round them), a lighthouse knoll on the bluff, a windmill hill on the meadow
    const lr=mulberry32((o.seed|0)+k*977+5);
    const towardHome=Math.atan2(-I.dir[1], -I.dir[0]);
    if (kind==='crags'){ I.spires=[0,1].map(i=>{ const aa=towardHome+Math.PI*(0.55+i*0.9)+(lr()-0.5)*0.4, d=I.r*(0.38+lr()*0.12); return [I.cx+Math.cos(aa)*d, I.cz+Math.sin(aa)*d, 3+lr()*1.2, 4.5+lr()*2.5]; }); }
    { const aa=towardHome+Math.PI+(lr()-0.5)*0.8, d=I.r*(kind==='dunes'?0.62:0.42); I.mark=[I.cx+Math.cos(aa)*d, I.cz+Math.sin(aa)*d, aa]; }
    out.push(I);
  }
  return out;
}

/* ---------- Heights ---------- */
export function isleRadius(I, a){ return I.r*(1 + 0.1*Math.sin(3*a+I.ph[0]) + 0.06*Math.sin(5*a+I.ph[1]) + 0.035*Math.sin(7*a+I.ph[2])); }
export function isleT(I, x, z){ const dx=x-I.cx, dz=z-I.cz; return Math.hypot(dx,dz)/isleRadius(I, Math.atan2(dz,dx)); }
export function inBox(I, x, z){ const b=I.box; return x>b[0] && x<b[2] && z>b[1] && z<b[3]; }
export function isleRaw(I, x, z){
  if (!inBox(I,x,z)) return -2.7;
  const t=isleT(I,x,z), K=I.kind, sx=x*0.05+I.k*31, sz=z*0.05-I.k*17;
  if (K==='meadow'){
    const base=-2.7+3.05*smooth(1.12,0.98,t)+0.95*smooth(0.95,0.86,t), m=smooth(0.92,0.62,t);
    const lift=m*(1.5*smooth(0.3,0.78,fbm(x*0.03+I.k*7,z*0.03-3)) + 1.1*smooth(0.55,0.0,Math.hypot(x-I.mark[0],z-I.mark[1])/I.r));
    return t>1.05 ? base : quant(base+lift); }
  if (K==='dunes'){
    const base=-2.7+3.05*smooth(1.16,0.97,t)+0.55*smooth(0.8,0.55,t), m=smooth(0.85,0.5,t);
    const ridge=0.5+0.5*Math.sin(x*0.16+z*0.09+fbm(sx,sz)*4);
    return base + m*(0.9*ridge*ridge*smooth(0.25,0.75,fbm(sx*1.3,sz*1.3)) + 0.35*fbm(x*0.11,z*0.11)); }
  // bluff and crags: a plateau on sheer cliffs
  const rim=t+(fbm(sx*2.2,sz*2.2)-0.5)*0.09;
  let top=PLATEAU + smooth(0.86,0.5,rim)*(K==='bluff' ? quant(ISLE_OFF+1.2*smooth(0.35,0.8,fbm(sx,sz)))-ISLE_OFF : 0.55*Math.floor(2*smooth(0.3,0.85,fbm(sx*1.7,sz*1.7))));
  if (K==='bluff' && I.mark){ const d=Math.hypot(x-I.mark[0],z-I.mark[1]); top=Math.max(top, lerp(top, PLATEAU+ISLE_STEP*2, smooth(9,5,d))); }
  let h = lerp(-2.7, top, smooth(0.985, 0.93, rim));
  if (I.spires) for (const [px,pz,pr,ph] of I.spires){ const d=Math.hypot(x-px,z-pz)/(pr*(1+0.18*Math.sin(Math.atan2(z-pz,x-px)*5+px))); if (d<1.25) h=Math.max(h, PLATEAU+ph*smooth(1.08,0.82,d)); }
  return h;
}
export function isleSlope(I, x, z){ const e=0.45; return Math.hypot(isleRaw(I,x+e,z)-isleRaw(I,x-e,z), isleRaw(I,x,z+e)-isleRaw(I,x,z-e))/(2*e); }

/* ---------- Bridges ----------
   A bridge runs from a (on the home side) to b (on the isle). yAt(s) gives the deck height for s from 0 (a) to 1 (b). */
export function makeIsleBridge(type, a, b, ya, yb, w){
  const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz), ux=dx/len, uz=dz/len;
  const hump = type==='causeway' ? 0.55 : type==='boardwalk' ? 0.35 : 0, sag = type==='rope' ? Math.min(1.3, len*0.055) : 0, low = type==='trestle' ? 0 : 1.05;
  const yAt = s => { s=clamp(s,0,1); const base=lerp(ya,yb,s);
    if (type==='rope') return base - sag*Math.sin(Math.PI*s);
    if (type==='trestle') return lerp(ya, yb, s*s*(3-2*s)*0.35+s*0.65);
    const mid=Math.max(low,(ya+yb)/2), e=smooth(0, Math.min(0.5, 4/len), Math.min(s,1-s));
    return lerp(base, mid, e) + hump*Math.sin(Math.PI*s); };
  return { x:(a[0]+b[0])/2, z:(a[1]+b[1])/2, ux, uz, len, w, type, a, b, ya, yb, yAtS:yAt, yAt:u=>yAt(u/len+0.5) };
}
// local frame: the group sits at a, +x runs toward b
export function buildIsleBridge(B, groundAt){
  const g=new THREE.Group(), L=B.len, w=B.w, T=B.type; g.position.set(B.a[0],0,B.a[1]); g.rotation.y=Math.atan2(-B.uz, B.ux);
  // the rope bridge swings about the line between its anchors, so its deck hangs from a pivot at anchor height
  const pivot=new THREE.Group(); pivot.position.y = T==='rope' ? (B.ya+B.yb)/2 : 0; g.add(pivot);
  const deck=new THREE.Group(); deck.position.y=-pivot.position.y; pivot.add(deck); g.userData.swing = T==='rope' ? pivot : null;
  const wood=M(0xb08458), wood2=M(0x9a7048), dark=M(0x6e4c32), rope=M(0xcbb38a), post=M(0x7a5638), stone=M(0x9a978c,{flatShading:true});
  const step = T==='rope' ? 0.62 : 0.5, nP=Math.ceil(L/step);
  const yAt=s=>B.yAtS(s), wx=(s)=>[B.a[0]+B.ux*s*L, B.a[1]+B.uz*s*L];
  for (let i=0;i<nP;i++){ const u=(i+0.5)*L/nP, s=u/L, y=yAt(s), s2=Math.min(1,(u+0.2)/L), s1=Math.max(0,(u-0.2)/L);
    const pl=mk(G.box(T==='rope'?0.5:0.46, T==='rope'?0.07:0.11, w*2), i%2?wood:wood2, u, y-0.06, (T==='rope'?(Math.sin(i*2.3)*0.04):0), deck);
    pl.rotation.z=Math.atan2(yAt(s2)-yAt(s1), (s2-s1)*L); if (T==='rope') pl.rotation.y=Math.sin(i*1.7)*0.04; }
  // stringers under the deck (not on the rope bridge)
  if (T!=='rope') for (const sd of [-1,1]){ for (let i=0;i<Math.ceil(L/2);i++){ const u0=i*2, u1=Math.min(L,u0+2), y0=yAt(u0/L), y1=yAt(u1/L), b=mk(G.box(Math.hypot(u1-u0,y1-y0)+0.05,0.16,0.14), dark, (u0+u1)/2, (y0+y1)/2-0.18, sd*(w-0.25), deck); b.rotation.z=Math.atan2(y1-y0,u1-u0); } }
  // posts and rails
  const railH = T==='rope' ? 1.0 : 0.85;
  const pstep = T==='rope' ? L : T==='boardwalk' ? 3 : 2.2;
  for (const sd of [-1,1]){
    const pts=[];
    for (let u=0; u<=L+0.01; u+=pstep){ const y=yAt(u/L); if (T==='rope'){ continue; }
      mk(G.cyl(0.07,0.08,railH+0.1,7), post, u, y+railH/2, sd*(w-0.06), deck); pts.push([u,y+railH]); }
    if (T==='rope'){ // hand ropes hang between two big posts at each end, plus little vertical cords
      for (const u of [0,L]){ const y=yAt(u/L); mk(G.cyl(0.13,0.16,2.2,8), post, u, y+0.9, sd*(w+0.1), g).castShadow=true; mk(G.sph(0.15,8,6), post, u, y+2.02, sd*(w+0.1), g); }
      const ys=s=>yAt(s)+railH;
      for (let i=0;i<40;i++){ const s0=i/40, s1=(i+1)/40, y0=ys(s0), y1=ys(s1), u0=s0*L, u1=s1*L;
        const c=mk(G.cyl(0.03,0.03,Math.hypot(u1-u0,y1-y0)+0.02,5), rope, (u0+u1)/2, (y0+y1)/2, sd*(w-0.02), deck); c.rotation.z=Math.atan2(y1-y0,u1-u0)-Math.PI/2; c.castShadow=false;
        if (i%2===0){ const v=mk(G.cyl(0.015,0.015,railH,4), rope, u0, (y0+yAt(s0))/2, sd*(w-0.02), deck); v.castShadow=false; } }
      // the ropes tie off up the end posts
      for (const [u,s] of [[0,0],[L,1]]){ const y=yAt(s); const c=mk(G.cyl(0.03,0.03,1.2,5), rope, u, y+1.6, sd*(w+0.05), g); c.castShadow=false; }
    } else {
      for (let i=0;i<pts.length-1;i++){ const [u0,y0]=pts[i], [u1,y1]=pts[i+1]; const r=mk(T==='boardwalk'?G.cyl(0.035,0.035,Math.hypot(u1-u0,y1-y0),5):G.box(Math.hypot(u1-u0,y1-y0),0.08,0.08), T==='boardwalk'?rope:wood2, (u0+u1)/2, (y0+y1)/2, sd*(w-0.06), deck);
        r.rotation.z=Math.atan2(y1-y0,u1-u0)-(T==='boardwalk'?Math.PI/2:0); } }
  }
  // what holds it up: piles into the sea for the low bridges, braced timber legs for the trestle
  if (T==='causeway' || T==='boardwalk'){ for (let u=1.5; u<L-1; u+=T==='boardwalk'?3:4){ const [x,z]=wx(u/L), gy=groundAt(x,z); if (gy>0.4) continue; const y=yAt(u/L); for (const sd of [-1,1]) mk(G.cyl(0.13,0.15,y-gy+0.2,7), dark, u, (y+gy)/2-0.1, sd*(w-0.3), deck); } }
  if (T==='trestle'){ for (let u=2; u<L-1; u+=3.2){ const [x,z]=wx(u/L), gy=Math.max(-2.6, groundAt(x,z)), y=yAt(u/L), H=y-gy; if (H<0.6) continue;
      for (const sd of [-1,1]){ const lg=mk(G.box(0.22,H+0.1,0.22), dark, u, gy+H/2, sd*(w+0.05), deck); lg.rotation.x=sd*0.08; }
      for (let k=0;k<Math.floor(H/1.6);k++){ const yy=gy+0.8+k*1.6; const br=mk(G.box(0.1,0.1,w*2.3), wood2, u, yy, 0, deck); br.rotation.x=(k%2?1:-1)*0.5; }
      mk(G.box(0.3,0.18,w*2.4), wood2, u, y-0.25, 0, deck); } }
  if (T==='boardwalk'){ for (let u=4; u<L-2; u+=8){ const y=yAt(u/L), lp=new THREE.Group(); lp.position.set(u, y, -(w-0.06)); deck.add(lp);
      mk(G.cyl(0.05,0.05,1.5,6), post, 0,0.75,0, lp); const ln=mk(G.box(0.2,0.26,0.2), glowMat(0xffd27a), 0,1.45,0.0, lp); ln.castShadow=false; addGlow(lp, 1.45, 2.4); } }
  // stone abutments at both ends
  for (const [u,s] of [[0,0],[L,1]]){ const y=yAt(s); mk(G.box(1.0,0.5,w*2+0.5), stone, u, y-0.3, 0, g); }
  mergeStatic(deck); return g;
}

/* ---------- Landmarks ---------- */
export function buildLandmark(kind, seed){
  const g=new THREE.Group(), r=mulberry32(seed|0), stone=M(0xb8b0a0,{flatShading:true}), stone2=M(0x9a948a,{flatShading:true}), wood=M(0x8a5e3a), dark=M(0x5a3e28), white=M(0xf4efe6), red=M(0xc8503d), moss=M(0x5f8a3e);
  g.userData.spin=null; g.userData.desc='';
  if (kind==='meadow'){ // a stone windmill with cloth sails that turn in the wind
    mk(G.cyl(1.6,2.2,6.2,12), stone, 0,3.1,0,g); mk(G.cyl(1.7,1.7,0.2,12), stone2, 0,6.2,0,g);
    const cap=mk(G.cone(2.0,2.2,12), M(0x7a4a3a), 0,7.4,0,g); cap.castShadow=true;
    mk(G.box(0.9,1.6,0.1), dark, 0,0.8,2.15,g); for (const y of [2.6,4.4]) mk(G.box(0.6,0.7,0.1), M(0x3a4a5a), 0,y,1.98-y*0.07,g);
    const hub=new THREE.Group(); hub.position.set(0,6.4,1.95); g.add(hub); mk(G.cyl(0.25,0.25,0.5,10), dark, 0,0,0,hub).rotation.x=Math.PI/2;
    for (let i=0;i<4;i++){ const arm=new THREE.Group(); arm.rotation.z=i*Math.PI/2; hub.add(arm); mk(G.box(0.18,4.2,0.12), wood, 0,2.1,0.1,arm);
      const sail=mk(G.box(1.1,3.2,0.04), M(0xf4ecd8), 0.62,2.4,0.14,arm); sail.castShadow=true; for (let k=0;k<4;k++) mk(G.box(1.1,0.04,0.06), wood, 0.62,1.0+k*0.9,0.16,arm); }
    g.userData.spin=hub; g.userData.desc='An old stone windmill. The sails still turn, slow and creaky, whenever the wind comes off the sea.';
    g.userData.rects=[[-2.3,-2.3,2.3,2.3]]; }
  if (kind==='dunes'){ // a shipwreck half buried in the sand
    const hull=new THREE.Group(); hull.rotation.z=0.22; hull.rotation.y=0.3; hull.position.y=1.45; g.add(hull);   // the keel sits just under the sand, the ribs stick up out of it
    for (let i=0;i<9;i++){ const x=-4+i*1.0, s=Math.sin((i+0.5)/9*Math.PI); const rib=mk(new THREE.TorusGeometry(1.6*s+0.4, 0.12, 6, 14, Math.PI), dark, x, 0.2, 0, hull); rib.rotation.y=Math.PI/2; rib.rotation.x=Math.PI; }
    for (let k=0;k<5;k++){ const pl=mk(G.box(7.2,0.12,0.5), wood, 0, -0.3-k*0.32+0.1, (k%2?1:-1)*(1.6-k*0.25), hull); pl.rotation.x=(k%2?1:-1)*(0.5+k*0.12); }
    const mast=mk(G.cyl(0.16,0.2,4.6,8), dark, 0.6, 0.6, 0.1, hull); mast.rotation.z=-0.5; mk(G.box(1.8,0.12,0.12), dark, 1.4, 2.0, 0.1, hull).rotation.z=0.4;
    for (let i=0;i<4;i++) mk(G.dod(0.3+r()*0.3), stone2, -3+r()*6, 0.1, -2.4+r()*4.8, g);
    g.userData.desc='The bones of an old ship. The name on the stern has worn away, but someone has carved a little crab next to where it was.';
    g.userData.rects=[[-4.4,-2.2,4.4,2.2]]; }
  if (kind==='bluff'){ // a striped lighthouse with a lamp that turns at night
    mk(G.cyl(2.2,2.5,0.8,14), stone2, 0,0.4,0,g);
    for (let i=0;i<5;i++) mk(G.cyl(1.55-i*0.13, 1.68-i*0.13, 1.5, 14), i%2?red:white, 0, 1.55+i*1.5, 0, g);
    mk(G.cyl(1.35,1.35,0.18,14), dark, 0,8.4,0,g);
    const lamp=mk(G.cyl(0.8,0.8,1.2,12), glowMat(0xfff0c0), 0,9.1,0,g); lamp.castShadow=false; addGlow(g, 9.1, 5, 0xfff0c0);
    for (let i=0;i<8;i++){ const a=i/8*TAU; mk(G.box(0.06,1.2,0.06), dark, Math.cos(a)*0.85, 9.1, Math.sin(a)*0.85, g); }
    mk(G.cone(1.15,1.0,12), red, 0,10.2,0,g); mk(G.sph(0.14,8,6), M(0xf3c35a,{metalness:0.5,roughness:0.3}), 0,10.8,0,g);
    const beam=new THREE.Group(); beam.position.y=9.1; g.add(beam);
    const bm=new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 16, 1, true), new THREE.MeshBasicMaterial({ color:0xfff4c8, transparent:true, opacity:0.0, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }));
    bm.rotation.z=Math.PI/2; bm.position.x=8; beam.add(bm); g.userData.beam=beam; g.userData.beamMat=bm.material;
    mk(G.box(0.9,1.6,0.1), dark, 0,1.6,1.62,g);
    g.userData.desc='The old lighthouse on the bluff. Wendell says the lamp lights itself now. "It\'s been waiting a long time," he says. "It doesn\'t want to miss anything."';
    g.userData.rects=[[-2.5,-2.5,2.5,2.5]]; }
  if (kind==='crags'){ // a ruined stone arch and broken columns, mossy
    for (const sx of [-1,1]){ for (let k=0;k<5;k++){ const b=mk(G.box(0.9,0.62,0.9), k%2?stone:stone2, sx*1.7+(r()-0.5)*0.08, 0.31+k*0.62, (r()-0.5)*0.08, g); b.rotation.y=(r()-0.5)*0.2; }
      mk(G.sph(0.35,7,5), moss, sx*1.7, 3.2, 0, g).scale.set(1.4,0.4,1.3); }
    for (let i=0;i<7;i++){ const a=Math.PI*(i/6), b=mk(G.box(0.7,0.55,0.9), stone, Math.cos(a)*1.7, 3.1+Math.sin(a)*1.1, 0, g); b.rotation.z=a-Math.PI/2; }
    for (let i=0;i<4;i++){ const a=r()*TAU, d=3.2+r()*1.5, h=0.8+r()*1.6; mk(G.cyl(0.32,0.38,h,8), stone2, Math.cos(a)*d, h/2, Math.sin(a)*d, g); mk(G.sph(0.3,7,5), moss, Math.cos(a)*d, h+0.05, Math.sin(a)*d, g).scale.set(1.2,0.35,1.2); }
    mk(G.box(4.6,0.12,1.6), stone2, 0,0.06,0,g);
    g.userData.desc='An old stone arch standing on its own. There are faint carvings of waves on the inside. Whoever built it knew the sea well.';
    g.userData.rects=[[-2.3,-0.6,-1.1,0.6],[1.1,-0.6,2.3,0.6]]; }
  return g;
}
