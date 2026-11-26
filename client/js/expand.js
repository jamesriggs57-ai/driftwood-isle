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
import { buildGrandfatherStump } from './reef.js';

// v1.37: Old Pinewood (Bramble's dream) rises third. Islands raised before v1.37 keep the order they rose in (S.terra.isleK).
export const ISLE_ORDER = ['meadow', 'dunes', 'pines', 'bluff', 'crags', 'starfall'];   // v1.41 Starfall Isle floats above the crags, last of all
export const OLD_ORDER = ['meadow', 'dunes', 'bluff', 'crags'];
export const ISLE_INFO = {
  meadow:{ name:'Clover Meadow', bridge:'causeway', gap:26, blurb:'rolling grass, wildflowers and an orchard of fruit that doesn\'t grow on the main island', sand:false },
  pines: { name:'Old Pinewood', bridge:'causeway', gap:26, blurb:'a misty ridge of tall old pines that grow back the day after you cut them, ferns and mossy boulders, and room for Bramble\'s workshop', sand:false },
  dunes: { name:'Sandpiper Dunes', bridge:'boardwalk', gap:30, blurb:'sand hills, palms and an old shipwreck; the beach there is good for shells', sand:true },
  bluff: { name:'Lantern Bluff', bridge:'trestle', gap:30, blurb:'a high plateau of pines on sheer cliffs, with a lighthouse and good rocks to mine', sand:false },
  crags: { name:'Hollow Crags', bridge:'rope', gap:20, blurb:'mossy stone spires and old ruins out past the bluff, across a rope bridge; rocks heavy with iron', sand:false },
  starfall:{ name:'Starfall Isle', bridge:'stair', gap:22, blurb:'a small island hanging in the sky above the crags, up a stair of glowing stones; it is always night up there', sand:false },
};
// What Wendell asks for each one. need: [item id or item kind, how many]. days: days since the last one rose.
export const ISLE_QUESTS = [
  { kind:'meadow', clams:60000,  need:[['wood',30],['stone',15],['flower',10]], days:0, relics:['relic_acorn'],
    ask:['Hmm. Hmm hmm. The sea out west has been humming at me all week.','There\'s land down there, you know. Old land. It sank long before anyone named this island.','I could bring a piece of it up. A meadow, I think. It wants to be a meadow.',
      'It takes a lot out of a wizard, though. Bring me 30 wood and 15 stone for the footings, 10 flowers so it remembers how to grow, and 60,000 clams for my trouble.'],
    done:['Wood, stone, flowers... and the clams. Yes. Yes! Stand back. No, further back. Further.'] },
  { kind:'dunes', clams:120000, need:[['shell',10],['softwood',20],['coconut',6]], days:3, relics:['relic_leystone'],
    ask:['The meadow took. Good. The sea is jealous now, and it\'s offering more.','There\'s a sandbank down there that used to be dunes. Shipwrecks too, I think. Lovely for beachcombing.',
      'Bring me 10 beach finds, 20 branches and 6 coconuts. It wants to know what a beach is supposed to feel like. And 120,000 clams.'],
    done:['Shells, branches, coconuts. Just so. Now, a little hum, a little wiggle...'] },
  { kind:'pines', clams:180000, need:[['wood',60],['stone',20]], days:3, relics:['relic_frostpine','relic_amber','relic_acorn'],
    ask:['{who}\'s workshop. Yes, I heard. Half the island has heard about it.','There is an old pine forest sunk off the east shore. The trees there were planted by people long gone, and their roots still remember.',
      'Raised, they would grow back as fast as you cut them. Bring me 60 wood so the roots know what they are for, 20 stone for the footings, and 180,000 clams.'],
    done:['Wood and stone, and the clams. The old forest is listening. Stand back, and mind the pine cones.'] },
  { kind:'bluff', clams:220000, need:[['plank',30],['iron',8],['clay',10]], days:3, relics:['relic_moonsap'],
    ask:['This one is bigger. Taller. There\'s a bluff out north, all stone, sitting on the seabed sulking.','It would need a trestle bridge up to the top. And somewhere up there an old lighthouse is waiting to be lit again.',
      'Bring me 30 planks from the workshop for the trestle, 8 iron nuggets and 10 clay. And 220,000 clams. Bluffs are heavy.'],
    done:['Planks, iron, clay. Excellent. Hold onto your hat. Actually, hold onto mine too.'] },
  { kind:'crags', clams:350000, need:[['iron',15],['stone',30],['fossil',2]], days:3, relics:['relic_amber','relic_coralcrown'],
    ask:['Out past the bluff there are crags. Old, mossy, a bit grumpy. They used to be part of the bluff before the sea cut them off.','I can lift them, but there\'s no way to reach them from here. You\'d have to cross from the cliff on a rope bridge.',
      'Bring me 15 iron nuggets, 30 stone and 2 fossils. The crags like old things. And 350,000 clams. This is the big one.'],
    done:['Iron, stone, fossils. The crags will be pleased. Well. Less grumpy.'] },
  // v1.41: the last one. One thing from each of the island's chains (the workshop, the apiary, the tea room, the forge, the mill, the bathhouse).
  { kind:'starfall', clams:500000, need:[['plank',1],['honey',1],['teacake',1],['fitting',1],['flour',1],['bathsalts',1]], days:3, relics:['relic_coralcrown','relic_starglass','relic_moonsap'],
    ask:['Sit down. No, really, sit. This one is different.','Hazel\'s last page. The island that hung in the sky above the old land. I thought it was a sailor\'s story. It is not. It is still up there, above the crags, waiting.',
      'I can bring it down to where you can reach it, and lay a stair of starlight up from Hollow Crags. But it has to know this island is a real home now.',
      'Bring me one thing from each of the things you built together: a plank from the workshop, a jar of honey, one of the tea room\'s cakes, an iron fitting from the forge, a sack of flour from the mill and a jar of bath salts. And 500,000 clams. This is the last of it, and the biggest.'],
    done:['A plank, honey, cake, a fitting, flour and bath salts. The whole island, in a basket. Look up. Keep looking up.'] },
];
export const isleQuestFor = kind => ISLE_QUESTS.find(q=>q.kind===kind);
export const ISLE_STEP = 0.55, ISLE_OFF = 0.85;
const quant = (v, riser=0.2) => { if (v<=ISLE_OFF) return v; const q=(v-ISLE_OFF)/ISLE_STEP, k=Math.floor(q), f=q-k; return ISLE_OFF+ISLE_STEP*(k+smooth(1-riser,1,f)); };
export const PLATEAU = ISLE_OFF + ISLE_STEP*8;   // 5.25 m: the bluff and crag tops, level with each other so the rope bridge can hang between them
export const SKY = PLATEAU + ISLE_STEP*14;   // v1.41 13.0 m: Starfall Isle's top. Its ground stops at SKY_CUT; below that is the rocky underside (a model)
export const SKY_CUT = SKY - 4;

/* ---------- Where they go ----------
   o: { seed, SC, shore(a) -> main island shore radius at angle a, ok(a) -> can a bridge land on the main island there }
   Meadow, dunes and bluff each hang off the main island at their own angle; the crags hang off the bluff. */
export function planIsles(kinds, o){
  if (typeof kinds==='number') kinds=OLD_ORDER.slice(0,kinds);
  const out=[], R=50*o.SC, used=[], r=mulberry32((o.seed|0)+90210), n=kinds.length;
  const angDist=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
  const prefer={ meadow:Math.PI, dunes:Math.PI*0.62, bluff:-Math.PI*0.42, pines:Math.PI*0.2 };
  for (let k=0;k<Math.min(n,6);k++){
    const kind=kinds[k], info=ISLE_INFO[kind], I={ k, kind, name:info.name, sand:info.sand, ph:[r()*TAU, r()*TAU, r()*TAU] };
    I.r = R*0.51*(kind==='bluff'||kind==='crags' ? 1.08 : kind==='starfall' ? 0.72 : 1);   // about a quarter of the main island's area (cliff isles a bit wider: their edges are cliff; Starfall is small)
    if (kind==='starfall') I.sky=true;
    I.br={ type:info.bridge, gap:info.gap*Math.min(1.25, 0.85+0.15*o.SC), w:info.bridge==='rope'?0.95:1.2 };
    if (kind!=='crags' && kind!=='starfall'){
      let best=null, bd=1e9; const saved=o.angles && Number.isFinite(o.angles[k]) ? o.angles[k] : null;
      if (saved===null) for (let i=0;i<144;i++){ const a=-Math.PI+i/144*TAU; if (!o.ok(a)) continue; if (used.some(u=>angDist(u,a)<1.05)) continue; const d=angDist(a,prefer[kind]); if (d<bd){ bd=d; best=a; } }
      if (saved!==null){ best=saved; bd=0; }
      if (best===null) for (let i=0;i<144;i++){ const a=-Math.PI+i/144*TAU; if (used.some(u=>angDist(u,a)<0.9)) continue; const d=angDist(a,prefer[kind]); if (d<bd){ bd=d; best=a; } }
      const a=best??prefer[kind]; used.push(a); I.a=a; I.dir=[Math.cos(a), Math.sin(a)]; I.from='main';
      const shore=o.shore(a); I.cx=I.dir[0]*(shore+I.br.gap+I.r*0.97); I.cz=I.dir[1]*(shore+I.br.gap+I.r*0.97);
    } else if (kind==='crags'){
      const B=out.find(J=>J.kind==='bluff'); if (!B) break;
      // out past the bluff, turned away from the main island so it never comes back toward it
      let a=Math.atan2(B.cz, B.cx) + 0.75; const tryAt=aa=>[B.cx+Math.cos(aa)*(B.r*0.97+I.br.gap+I.r*0.97), B.cz+Math.sin(aa)*(B.r*0.97+I.br.gap+I.r*0.97)];
      let [x,z]=tryAt(a); if (out.some(J=>J!==B && Math.hypot(x-J.cx,z-J.cz)<J.r+I.r+20)){ a=Math.atan2(B.cz,B.cx)-0.75; [x,z]=tryAt(a); }
      I.a=a; I.dir=[Math.cos(a), Math.sin(a)]; I.from=out.indexOf(B); I.cx=x; I.cz=z;
    } else {   // v1.41 Starfall: up a stair from the crags, further out again, clear of everything else
      const C=out.find(J=>J.kind==='crags'); if (!C) break; const base=Math.atan2(C.cz, C.cx);
      const at=aa=>[C.cx+Math.cos(aa)*(C.r*0.97+I.br.gap+I.r*0.97), C.cz+Math.sin(aa)*(C.r*0.97+I.br.gap+I.r*0.97)];
      let a=base, x, z; for (const d of [0.55,-0.55,1.1,-1.1,0,1.6,-1.6]){ a=base+d; [x,z]=at(a); if (!out.some(J=>J!==C && Math.hypot(x-J.cx,z-J.cz)<J.r+I.r+16) && Math.hypot(x,z)>R*1.3+I.r) break; }
      I.a=a; I.dir=[Math.cos(a), Math.sin(a)]; I.from=out.indexOf(C); I.cx=x; I.cz=z;
    }
    const ext=I.r*1.3+8; I.box=[I.cx-ext, I.cz-ext, I.cx+ext, I.cz+ext];
    // spires on the crags (sheer, you walk round them), a lighthouse knoll on the bluff, a windmill hill on the meadow
    const lr=mulberry32((o.seed|0)+k*977+5);
    const towardHome=Math.atan2(-I.dir[1], -I.dir[0]);
    if (kind==='crags'){ I.spires=[0,1].map(i=>{ const aa=towardHome+Math.PI*(0.55+i*0.9)+(lr()-0.5)*0.4, d=I.r*(0.38+lr()*0.12); return [I.cx+Math.cos(aa)*d, I.cz+Math.sin(aa)*d, 3+lr()*1.2, 4.5+lr()*2.5]; }); }
    { const aa=towardHome+Math.PI+(lr()-0.5)*0.8, d=I.r*(kind==='dunes'?0.62:0.42); I.mark=[I.cx+Math.cos(aa)*d, I.cz+Math.sin(aa)*d, aa]; }
    out.push(I);
  }
  planGrowth(out, o);
  for (const I of out){ const ext=I.r*1.3*(I.gmax||1)+8; I.box=[I.cx-ext, I.cz-ext, I.cx+ext, I.cz+ext]; I.fxPlan=planFx(I, (o.seed|0)); }
  return out;
}

/* ---------- v1.57 RICHER ISLES ----------
   Each isle grows out on the side away from its bridges (I.gr: a radius multiplier for each of 72 directions), and carries a list
   of features (I.fxPlan) planned from the seed in the isle's own frame: hills, a pond and its brook, a spring with a waterfall,
   sea stacks, more spires, a sunken grotto, old ruins, an orchard, flower fields. main.js settles them once per save with
   finalizeFx (each feature has a few spots to try, so nothing lands on what you placed), and keeps the result in S.terra.isleFx. */
const GROW = { meadow:[0.34,1.4], dunes:[1.05,1.25], pines:[0,1], bluff:[0.24,1.6], crags:[0.34,1.4], starfall:[0.36,1.4] };   // [how much further out, how narrow]
const GN=72;
export function growAt(I, a){ const g=I.gr; if (!g) return 1; let f=(((a/TAU)%1)+1)%1*GN; const i=Math.floor(f); f-=i; return g[i%GN]*(1-f)+g[(i+1)%GN]*f; }
const baseR = (I, a) => I.r*(1 + 0.1*Math.sin(3*a+I.ph[0]) + 0.06*Math.sin(5*a+I.ph[1]) + 0.035*Math.sin(7*a+I.ph[2]));
const angD = (a,b) => Math.abs(Math.atan2(Math.sin(a-b), Math.cos(a-b)));
function planGrowth(out, o){
  for (const I of out){
    // a shape saved with the save stays as it is (things may be placed on it); it only ever gives way to an isle that rose later
    const saved = o.grow && o.grow[I.kind], [G,P]=GROW[I.kind]||[0,1], g=new Float32Array(GN);
    const outA=Math.atan2(I.dir[1], I.dir[0]), kids=out.filter(J=>J!==I && out[J.from]===I).map(J=>Math.atan2(J.cz-I.cz, J.cx-I.cx));
    if (Array.isArray(saved) && saved.length===GN) for (let i=0;i<GN;i++) g[i]=clamp(+saved[i]||1, 1, 2.2);
    else if (G>0) for (let i=0;i<GN;i++){ const a=i/GN*TAU; let v=1+G*Math.pow(Math.max(0, Math.cos(a-outA)), P); for (const ca of kids) v=lerp(1, v, smooth(0.6, 1.1, angD(a,ca))); g[i]=v; }
    else { I.gr=null; I.gmax=1; continue; }
    for (const ca of kids) for (let i=0;i<GN;i++) g[i]=lerp(1, g[i], smooth(0.35, 0.7, angD(i/GN*TAU,ca)));   // never across a bridge that goes on from here
    // never toward the main island or another isle (counting how far that one may grow too)
    for (let i=0;i<GN;i++){ const a=i/GN*TAU, b=baseR(I,a);
      while (g[i]>1.001){ const R=b*g[i]*1.08+4, px=I.cx+Math.cos(a)*R, pz=I.cz+Math.sin(a)*R; let bad=!I.sky && o.shore && Math.hypot(px,pz) < o.shore(Math.atan2(pz,px))*1.06+14;
        for (const J of out) if (J!==I && !bad && Math.hypot(px-J.cx, pz-J.cz) < J.r*1.14*(J.gmax || 1+((GROW[J.kind]||[0])[0]))+10) bad=true;
        if (!bad) break; g[i]=Math.max(1, g[i]-0.03); } }
    for (let k=0;k<6;k++) for (let i=0;i<GN;i++) g[i]=Math.min(g[i], g[(i+GN-1)%GN]+0.05, g[(i+1)%GN]+0.05);   // no sudden notches
    I.gr=g; I.gmax=Math.max(...g); }
}
// the plan: each feature lists a few spots (alts) in the isle's frame; u runs out from the bridge (-1) to the far side, v across
const wAt = (I, u, v) => [I.cx+(I.dir[0]*u - I.dir[1]*v)*I.r, I.cz+(I.dir[1]*u + I.dir[0]*v)*I.r];
function planFx(I, seed){
  const r=mulberry32(seed + I.k*4001 + 77 + hashStr(I.kind)), s=r()<0.5?1:-1, L=[], K=I.kind, R=I.r;
  const at=(u,v)=>wAt(I,u,v), add=(id,t,alts,o={})=>L.push({ id, t, alts, ...o });
  const mv = I.mark ? (((I.mark[0]-I.cx)*-I.dir[1] + (I.mark[1]-I.cz)*I.dir[0])/R) : 0, ms = mv>=0 ? 1 : -1;   // which side of the middle the landmark sits
  if (K==='meadow'){
    add('pond','pond', [[0.0,s*0.56],[-0.12,s*0.6],[0.2,s*0.55],[0.0,-s*0.58]].map(([u,v])=>({ c:at(u,v), r:4.3, bed:-1.05 })), { w:'pond' });
    add('brook','stream', [s,-s].map(ss=>({ pts:[at(0.0,ss*0.62),at(0.16,ss*0.78),at(0.06,ss*0.96),at(0.14,ss*1.2),at(0.12,ss*1.45)], w:1.05, bed:-0.85, side:ss })), { w:'river', needs:'pond' });
    add('orchard','orchard', [[-0.12,-s*0.45],[0.15,-s*0.5],[-0.3,-s*0.42],[0.2,s*0.15]].map(([u,v])=>({ c:at(u,v), n:[3,4], sp:4.3 })));
    add('field0','field', [[0.62,-s*0.28],[0.85,-s*0.1],[0.5,-s*0.55]].map(([u,v])=>({ c:at(u,v), r:7 })));
    add('field1','field', [[0.82,s*0.32],[0.95,s*0.1],[0.6,s*0.3]].map(([u,v])=>({ c:at(u,v), r:6 })));
    add('hill0','hill', [[1.0,-s*0.12],[0.92,s*0.05],[0.75,-s*0.35]].map(([u,v])=>({ c:at(u,v), r:9, h:1.15 })));
    add('hill1','hill', [[-0.45,-s*0.72],[-0.35,-s*0.8],[-0.5,s*0.75],[0.95,s*0.62]].map(([u,v])=>({ c:at(u,v), r:6.5, h:0.6 })));
  }
  if (K==='dunes'){   // long rolling dunes running out to the far point
    add('dune0','dune', [[1.3,-ms*0.2],[1.25,ms*0.35],[0.5,-ms*0.75]].map(([u,v])=>({ c:at(u,v), r:10, h:1.3 })));   // clear of the wreck, which sits about 0.62 out
    add('dune1','dune', [[1.85,ms*0.15],[1.8,-ms*0.3],[-0.1,ms*0.6]].map(([u,v])=>({ c:at(u,v), r:9.5, h:1.15 })));
    add('dune2','dune', [[0.05,-ms*0.55],[1.0,-ms*0.65],[0.0,ms*0.62]].map(([u,v])=>({ c:at(u,v), r:7.5, h:0.85 })));
    add('dune3','dune', [[-0.5,-ms*0.5],[-0.5,ms*0.5]].map(([u,v])=>({ c:at(u,v), r:6.5, h:0.7 })));
  }
  if (K==='bluff'){
    add('knoll0','knoll', [[0.85,-ms*0.2],[0.7,-ms*0.45],[-0.2,-ms*0.6]].map(([u,v])=>({ c:at(u,v), r:5.5, h:ISLE_STEP*2 })));
    add('knoll1','knoll', [[-0.1,ms*0.65],[0.25,-ms*0.62]].map(([u,v])=>({ c:at(u,v), r:4.5, h:ISLE_STEP })));
    add('spring','spring', [[0.2,-ms*0.42,-ms],[0.45,-ms*0.4,-ms],[0.05,ms*0.5,ms],[0.55,ms*0.42,ms]].map(([u,v,sd])=>({ c:at(u,v), r:2.8, pts:[at(u,v), at(u+0.06,v+sd*0.25), at(u+0.04,v+sd*0.55), at(u+0.06,v+sd*0.8)], w:0.75 })));
    add('stacks','stacks', [{ list:[[0.3,7,3.2,0.82],[-0.1,11,2.4,0.62],[-0.5,8,2.8,0.74],[0.95,6,2.2,0.55],[-1.05,9,2.0,0.5]] }]);   // [turn from straight out, metres past the cliff, width, height as a share of the plateau]
  }
  if (K==='crags'){
    add('grotto','grotto', [[0.5,-ms*0.55],[0.5,ms*0.55],[0.2,-ms*0.6],[0.2,ms*0.6],[-0.35,-ms*0.55],[-0.35,ms*0.55],[0.9,-ms*0.4],[0.9,ms*0.4]].map(([u,v])=>({ c:at(u,v), R:8.5, rp:3.0 })));
    for (let i=0;i<6;i++){ const u=-0.35+r()*1.5, v=(r()-0.5)*1.5, rr=2.0+r()*1.6, hh=3.2+r()*4;
      add('spire'+i,'spire', [0,1,2].map(j=>({ c:at(u+(j?(r()-0.5)*0.4:0), v+(j?(r()-0.5)*0.4:0)), r:rr, h:hh }))); }
    for (let i=0;i<4;i++){ const u=-0.2+r()*1.1, v=(r()-0.5)*1.3, rot=r()*TAU;   // the first spot, then others spread round the isle
      add('ruin'+i,'ruin', [0,1,2,3,4].map(j=>{ const a=j ? i*1.7+j*1.25 : 0, uu=j ? 0.35+0.55*Math.cos(a) : u, vv=j ? 0.6*Math.sin(a) : v; return { c:at(uu,vv), rot:rot+j, kind:['wall','colonnade','tower','wall'][i], r:i===2?3.0:3.4 }; })); }
  }
  if (K==='starfall'){
    add('glowpool','skypool', [[-0.2,-ms*0.55],[0.1,-ms*0.65],[-0.3,ms*0.55],[0.95,-ms*0.4],[0.95,ms*0.4]].map(([u,v])=>({ c:at(u,v), r:2.9 })));
    add('garden','garden', [[1.0,ms*0.2],[0.75,-ms*0.55],[-0.3,ms*0.5],[0.3,-ms*0.62]].map(([u,v])=>({ c:at(u,v), r:6 })));
  }
  return L;
}
// a concrete feature: where it is and what it covers (circles), from its plan and the spot picked
function makeFx(I, f, A){
  const F={ id:f.id, t:f.t, w:f.w };
  if (A.c){ F.x=A.c[0]; F.z=A.c[1]; }
  if (f.t==='pond'){ Object.assign(F, { r:A.r, bed:A.bed }); F.foot=[[F.x,F.z,A.r+1.6]]; }
  else if (f.t==='stream'){ Object.assign(F, { pts:A.pts, hw:A.w, bed:A.bed }); F.foot=A.pts.slice(0,-1).flatMap((p,i)=>{ const q=A.pts[i+1], out=[]; for (let k=0;k<=3;k++) out.push([lerp(p[0],q[0],k/3), lerp(p[1],q[1],k/3), A.w+1.6]); return out; }); }
  else if (f.t==='hill' || f.t==='dune' || f.t==='knoll'){ Object.assign(F, { r:A.r, h:A.h }); F.foot=[[F.x,F.z,A.r*0.75]]; F.lift=true; }
  else if (f.t==='orchard'){ const [nr,nc]=A.n, sp=A.sp, ux=I.dir[0], uz=I.dir[1]; F.trees=[]; for (let i=0;i<nr;i++) for (let j=0;j<nc;j++){ const a=(i-(nr-1)/2)*sp, b=(j-(nc-1)/2)*sp; F.trees.push([F.x+ux*a-uz*b, F.z+uz*a+ux*b]); } F.foot=F.trees.map(([x,z])=>[x,z,1.6]); }
  else if (f.t==='field' || f.t==='garden'){ F.r=A.r; F.foot=[[F.x,F.z,1.0]]; F.soft=true; }
  else if (f.t==='spring'){ Object.assign(F, { r:A.r, pts:A.pts, hw:A.w }); F.foot=[[F.x,F.z,A.r+1.4], ...A.pts.map(([x,z])=>[x,z,A.w+1.3])]; }
  else if (f.t==='skypool'){ F.r=A.r; F.foot=[[F.x,F.z,A.r+1.4]]; }
  else if (f.t==='stacks'){ const oa=Math.atan2(I.dir[1],I.dir[0]); F.list=A.list.map(([da,ex,rr,hh])=>{ const a=oa+da, d=isleRadius(I,a)+ex+rr; return [I.cx+Math.cos(a)*d, I.cz+Math.sin(a)*d, rr, hh]; }); F.foot=[]; F.sea=true; }
  else if (f.t==='grotto'){ Object.assign(F, { R:A.R, rp:A.rp }); F.foot=[[F.x,F.z,A.R+1.5]];
    F.spires=[0.15,1.9,3.6,4.6].map((a,i)=>{ const aa=a+hashStr(I.kind+i)%7*0.07, d=A.R+1.6+(i%2)*0.8; return [F.x+Math.cos(aa)*d, F.z+Math.sin(aa)*d, 2.2+(i%3)*0.5, 4.5+i*0.9]; }); F.foot.push(...F.spires.map(([x,z,rr])=>[x,z,rr*1.3])); }
  else if (f.t==='spire'){ F.spire=[F.x, F.z, A.r, A.h]; F.foot=[[F.x,F.z,A.r*1.3+0.6]]; }
  else if (f.t==='ruin'){ Object.assign(F, { rot:A.rot, kind:A.kind, r:A.r }); F.foot=[[F.x,F.z,A.r]]; }
  F.bb=[1e9,1e9,-1e9,-1e9]; const pad=F.t==='grotto'?F.R+0.5 : F.t==='stream'?F.hw+2.4 : F.t==='spring'?Math.max(F.r+1.6, F.hw+1.2) : F.t==='pond'?F.r+2.4 : (F.r||0)+0.5;
  const grow=(x,z,p)=>{ F.bb[0]=Math.min(F.bb[0],x-p); F.bb[1]=Math.min(F.bb[1],z-p); F.bb[2]=Math.max(F.bb[2],x+p); F.bb[3]=Math.max(F.bb[3],z+p); };
  if (F.x!==undefined) grow(F.x,F.z,pad); for (const p of (F.pts||[])) grow(p[0],p[1],pad);
  return F; }
/* o: { pick: saved {id: spot index or -1} or null, avoid(F)->true if F would cover a bridge, path, landmark, story spot or something placed }
   Returns the picks to keep. Raised water levels (the bluff's spring, Starfall's pool) are read off the ground before carving. */
export function finalizeFx(I, o={}){
  const pick={}, act=[], plan=I.fxPlan||[]; I.fxWhy={};
  for (const f of plan){
    let j = o.pick && Number.isInteger(o.pick[f.id]) ? o.pick[f.id] : null;
    if (j!==null && (j>=f.alts.length || j<-1)) j=null;
    if (j===null){ j=-1; const why=I.fxWhy[f.id]=[];
      if (!(f.needs && pick[f.needs]===-1)) for (let k=0;k<f.alts.length;k++){ const F=makeFx(I, f, f.alts[k]);
        if (f.needs==='pond'){ const P=act.find(a=>a.id==='pond'); if (!P || Math.hypot(F.pts[0][0]-P.x, F.pts[0][1]-P.z)>P.r+3){ why.push('not at the pond'); continue; } }   // the brook leaves the pond
        const av=o.avoid && o.avoid(F); if (av){ why.push(av); continue; }
        if (!F.lift && !F.sea && F.t!=='grotto' && I.spires && I.spires.some(([px,pz,pr])=>F.foot.some(([x,z,rr])=>Math.hypot(x-px,z-pz)<rr+pr*1.3))){ why.push('on a spire'); continue; }   // (the grotto may take an old spire's place)
        const hit=act.find(a=>a.id!==f.needs && !a.soft && !F.soft && a.foot && F.foot.some(([x,z,rr])=>a.foot.some(([x2,z2,r2])=>Math.hypot(x-x2,z-z2)<rr+r2))); if (hit){ why.push('on '+hit.id); continue; }   // features keep clear of each other
        j=k; break; } }
    pick[f.id]=j; if (j>=0){ const F=makeFx(I, f, f.alts[j]); if (F.t==='stacks' && o.seaOK) F.list=F.list.filter(([x,z,rr])=>o.seaOK(x,z,rr+5));
      if (F.t==='grotto' && I.spires) I.spires=I.spires.filter(([px,pz,pr])=>Math.hypot(F.x-px,F.z-pz)>F.R+1.5+pr*1.3);
      if (F.spires && o.keepRock){ F.spires=F.spires.filter(([x,z,rr])=>o.keepRock(x,z,rr*1.3)); F.foot=[F.foot[0], ...F.spires.map(([x,z,rr])=>[x,z,rr*1.3])]; }   // the grotto's rocks never stand on a path
      act.push(F); } }
  I.fxOn=act.filter(F=>F.lift);   // read the ground with only the hills on to set water levels
  for (const F of act){
    if (F.t==='spring'){ let lo=99; for (let k=0;k<16;k++){ const a=k/16*TAU; lo=Math.min(lo, isleRaw(I, F.x+Math.cos(a)*(F.r+0.6), F.z+Math.sin(a)*(F.r+0.6))); }
      const out=[]; for (let i=0;i<F.pts.length-1;i++){ const [ax,az]=F.pts[i], [bx,bz]=F.pts[i+1]; for (let s=0;s<1;s+=0.1){ const x=lerp(ax,bx,s), z=lerp(az,bz,s), h=isleRaw(I,x,z); if (h<PLATEAU-0.4){ out.push([x,z]); break; } lo=Math.min(lo,h); } if (out.length) break; }
      F.lvl=lo-0.16; F.lip = out[0] || F.pts[F.pts.length-1]; const k=F.pts.findIndex((p,i)=>i>0 && Math.hypot(p[0]-F.x,p[1]-F.z)>=Math.hypot(F.lip[0]-F.x,F.lip[1]-F.z)-0.01); F.run=[...F.pts.slice(0, k<0?F.pts.length:k), F.lip]; }
    if (F.t==='skypool'){ let lo=99; for (let k=0;k<16;k++){ const a=k/16*TAU; lo=Math.min(lo, isleRaw(I, F.x+Math.cos(a)*(F.r+0.7), F.z+Math.sin(a)*(F.r+0.7))); } F.lvl=lo-0.14; } }
  I.fxOn=act; I.fxSpires=[]; for (const F of act){ if (F.spire) I.fxSpires.push(F.spire); if (F.spires) I.fxSpires.push(...F.spires); }
  I.fxStacks=act.filter(F=>F.t==='stacks').flatMap(F=>F.list);
  return pick; }
export const fxGet = (I, id) => (I.fxOn||[]).find(F=>F.id===id) || null;
const inBB = (F,x,z) => x>F.bb[0] && x<F.bb[2] && z>F.bb[1] && z<F.bb[3];
// hills and dunes raise the ground before it is cut into terraces
function fxLift(I, x, z){ let h=0; for (const F of I.fxOn) if (F.lift && inBB(F,x,z)){ const d=Math.hypot(x-F.x,z-F.z); if (d<F.r) h+=F.h*smooth(F.r, F.r*(F.t==='knoll'?0.55:0.12), d); } return h; }
// ponds, brooks, the spring and its run, the grotto
function fxCut(I, x, z, h){
  for (const F of I.fxOn){ if (!inBB(F,x,z)) continue;
    if (F.t==='pond'){ const d=Math.hypot(x-F.x,z-F.z); h=lerp(Math.min(h,F.bed), h, smooth(F.r-0.4, F.r+2.2, d)); }
    else if (F.t==='stream'){ const d=polyD(x,z,F.pts); h=lerp(Math.min(h,F.bed), h, smooth(F.hw, F.hw+2.2, d)); }
    else if (F.t==='spring' && F.lvl!==undefined){ const d=Math.hypot(x-F.x,z-F.z), dc=polyD(x,z,F.run);
      h=Math.min(h, lerp(F.lvl-0.6, h, smooth(F.r-0.5, F.r+1.3, d)), lerp(F.lvl-0.4, h, smooth(F.hw-0.15, F.hw+0.9, dc))); }
    else if (F.t==='skypool' && F.lvl!==undefined){ const d=Math.hypot(x-F.x,z-F.z); h=Math.min(h, lerp(F.lvl-0.55, h, smooth(F.r-0.5, F.r+1.3, d))); }
    else if (F.t==='grotto'){ const d=Math.hypot(x-F.x,z-F.z); if (d>F.R+0.5) continue;
      // old stone steps going down in rings to a pool at sea level
      let tg; if (d<F.rp+1.0) tg=lerp(-1.15, 0.35, smooth(F.rp-1.4, F.rp+1.0, d));
      else { const raw=0.35+(PLATEAU-0.35)*clamp((d-F.rp-1.0)/(F.R-F.rp-1.4),0,1), q=(raw-0.35)/ISLE_STEP, k=Math.floor(q), f=q-k; tg=0.35+ISLE_STEP*(k+smooth(0.62,1,f)); }
      h=Math.min(h, lerp(tg, h, smooth(F.R-0.6, F.R+0.4, d))); } }
  return h; }
const polyD = (x,z,pts) => { let m=1e9; for (let i=0;i<pts.length-1;i++){ const [ax,az]=pts[i], [bx,bz]=pts[i+1], dx=bx-ax, dz=bz-az, t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1); m=Math.min(m, Math.hypot(x-ax-dx*t, z-az-dz*t)); } return m; };
// fishable water an isle's features make at sea level: 'pond', 'river' or null
export function fxWater(I, x, z){ for (const F of (I.fxOn||[])){ if (!inBB(F,x,z)) continue;
    if (F.t==='pond' && Math.hypot(x-F.x,z-F.z)<F.r+1.5) return 'pond';
    if (F.t==='stream' && polyD(x,z,F.pts)<F.hw+1.5) return 'river';
    if (F.t==='grotto' && Math.hypot(x-F.x,z-F.z)<F.rp+1.5) return 'pond'; } return null; }
// raised water you can't walk into (the bluff's spring and its run, Starfall's pool)
export function fxWet(I, x, z){ for (const F of (I.fxOn||[])){ if (F.lvl===undefined || !inBB(F,x,z)) continue;
    if (Math.hypot(x-F.x,z-F.z)<F.r+0.1) return true; if (F.run && polyD(x,z,F.run)<F.hw+0.05) return true; } return false; }
// the pond's edge, for ducks, reeds and lily pads
export function fxSpots(I, t){ return (I.fxOn||[]).filter(F=>F.t===t); }
// is (x,z) on a feature, so trees, rocks and grass keep off it (hills, dunes and flower fields don't count)
export function fxBlock(I, x, z, rad=0){ for (const F of (I.fxOn||[])){ if (F.lift || F.soft || F.sea || !F.foot) continue; if (x<F.bb[0]-rad-2 || x>F.bb[2]+rad+2 || z<F.bb[1]-rad-2 || z>F.bb[3]+rad+2) continue;
    if (F.foot.some(([fx,fz,fr])=>Math.hypot(x-fx,z-fz)<fr+rad)) return true; } return false; }

/* ---------- Heights ---------- */
export function isleRadius(I, a){ return baseR(I,a)*growAt(I,a); }
export function isleT(I, x, z){ const dx=x-I.cx, dz=z-I.cz; return Math.hypot(dx,dz)/isleRadius(I, Math.atan2(dz,dx)); }
export function inBox(I, x, z){ const b=I.box; return x>b[0] && x<b[2] && z>b[1] && z<b[3]; }
export function isleRaw(I, x, z){
  if (!inBox(I,x,z)) return -2.7;
  const h=isleBase(I,x,z);
  return I.fxOn && I.fxOn.length ? fxCut(I,x,z,h) : h; }
function isleBase(I, x, z){
  const t=isleT(I,x,z), K=I.kind, sx=x*0.05+I.k*31, sz=z*0.05-I.k*17, L=I.fxOn && I.fxOn.length ? fxLift(I,x,z) : 0;
  if (K==='meadow'){
    const base=-2.7+3.05*smooth(1.12,0.98,t)+0.95*smooth(0.95,0.86,t), m=smooth(0.92,0.62,t);
    const lift=m*(1.5*smooth(0.3,0.78,fbm(x*0.03+I.k*7,z*0.03-3)) + 1.1*smooth(0.55,0.0,Math.hypot(x-I.mark[0],z-I.mark[1])/I.r) + L);
    return t>1.05 ? base : quant(base+lift); }
  if (K==='pines'){   // v1.37 a terraced ridge across the far side, low ground by the bridge
    const base=-2.7+3.05*smooth(1.12,0.98,t)+0.95*smooth(0.95,0.86,t), m=smooth(0.93,0.6,t), dx=x-I.cx, dz=z-I.cz, along=(dx*I.dir[0]+dz*I.dir[1])/I.r;
    const ridge=smooth(0.62,0.05,Math.abs(along-0.22+0.12*Math.sin((dx*-I.dir[1]+dz*I.dir[0])/I.r*3+I.ph[0])));
    const lift=m*(2.6*ridge + 0.9*smooth(0.35,0.8,fbm(x*0.04+I.k*5,z*0.04+2)));
    return t>1.05 ? base : quant(base+lift); }
  if (K==='dunes'){
    const base=-2.7+3.05*smooth(1.16,0.97,t)+0.55*smooth(0.8,0.55,t), m=smooth(0.85,0.5,t);
    const ridge=0.5+0.5*Math.sin(x*0.16+z*0.09+fbm(sx,sz)*4);
    return base + m*(0.9*ridge*ridge*smooth(0.25,0.75,fbm(sx*1.3,sz*1.3)) + 0.35*fbm(x*0.11,z*0.11) + L*(0.75+0.5*fbm(sx*2.1,sz*2.1))); }
  if (K==='starfall'){   // v1.41 a floating plate: a gentle top with two low steps, a short rim, nothing under it (the model hangs below)
    const rim=t+(fbm(sx*2.2,sz*2.2)-0.5)*0.07; if (rim>1.06) return -2.7;
    const top=SKY + ISLE_STEP*Math.floor(2*smooth(0.35,0.85,fbm(sx*1.4,sz*1.4)))*smooth(0.82,0.5,rim);
    return lerp(SKY_CUT-0.6, top, smooth(1.0, 0.93, rim)); }
  // bluff and crags: a plateau on sheer cliffs
  const rim=t+(fbm(sx*2.2,sz*2.2)-0.5)*0.09;
  let top=PLATEAU + smooth(0.86,0.5,rim)*(K==='bluff' ? quant(ISLE_OFF+1.2*smooth(0.35,0.8,fbm(sx,sz)))-ISLE_OFF : 0.55*Math.floor(2*smooth(0.3,0.85,fbm(sx*1.7,sz*1.7))));
  if (K==='bluff' && I.mark){ const d=Math.hypot(x-I.mark[0],z-I.mark[1]); top=Math.max(top, lerp(top, PLATEAU+ISLE_STEP*2, smooth(9,5,d))); }
  if (L>0) top=quant(top+L*smooth(0.9,0.6,rim), 0.3);   // v1.57 knolls: a terrace or two up
  let h = lerp(-2.7, top, smooth(0.985, 0.93, rim));
  for (const S of [I.spires, I.fxSpires]) if (S) for (const [px,pz,pr,ph] of S){ const d=Math.hypot(x-px,z-pz)/(pr*(1+0.18*Math.sin(Math.atan2(z-pz,x-px)*5+px))); if (d<1.25) h=Math.max(h, PLATEAU+ph*smooth(1.08,0.82,d)); }
  if (I.fxStacks) for (const [px,pz,pr,ph] of I.fxStacks){ const d=Math.hypot(x-px,z-pz)/(pr*(1+0.2*Math.sin(Math.atan2(z-pz,x-px)*4+pz))); if (d<1.3) h=Math.max(h, lerp(-2.7, PLATEAU*ph, smooth(1.12,0.9,d))); }   // sea stacks off the bluff
  return h;
}
export function isleSlope(I, x, z){ const e=0.45; return Math.hypot(isleRaw(I,x+e,z)-isleRaw(I,x-e,z), isleRaw(I,x,z+e)-isleRaw(I,x,z-e))/(2*e); }

/* ---------- Bridges ----------
   A bridge runs from a (on the home side) to b (on the isle). yAt(s) gives the deck height for s from 0 (a) to 1 (b). */
export function makeIsleBridge(type, a, b, ya, yb, w){
  const dx=b[0]-a[0], dz=b[1]-a[1], len=Math.hypot(dx,dz), ux=dx/len, uz=dz/len;
  const hump = type==='causeway' ? 0.55 : type==='boardwalk' ? 0.35 : 0, sag = type==='rope' ? Math.min(1.3, len*0.055) : 0, low = type==='trestle' ? 0 : 1.05;
  const yAt = s => { s=clamp(s,0,1); const base=lerp(ya,yb,s);
    if (type==='stair') return base;
    if (type==='rope') return base - sag*Math.sin(Math.PI*s);
    if (type==='trestle') return lerp(ya, yb, s*s*(3-2*s)*0.35+s*0.65);
    const mid=Math.max(low,(ya+yb)/2), e=smooth(0, Math.min(0.5, 4/len), Math.min(s,1-s));
    return lerp(base, mid, e) + hump*Math.sin(Math.PI*s); };
  return { x:(a[0]+b[0])/2, z:(a[1]+b[1])/2, ux, uz, len, w, type, a, b, ya, yb, yAtS:yAt, yAt:u=>yAt(u/len+0.5) };
}
// local frame: the group sits at a, +x runs toward b
export function buildIsleBridge(B, groundAt){
  if (B.type==='stair') return buildStair(B);
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

// v1.41 Wendell's stair of starlight: pale stone steps hanging in the air, each lit from inside, a few loose stones drifting under it
function buildStair(B){
  const g=new THREE.Group(), L=B.len, w=B.w; g.position.set(B.a[0],0,B.a[1]); g.rotation.y=Math.atan2(-B.uz, B.ux); g.userData.swing=null;
  const stone=M(0xd8d4e8,{ flatShading:true, roughness:0.7 }), lit=glowMat(0xbfd8ff), r=mulberry32(Math.round(L*100));
  const n=Math.ceil(L/0.42), drift=new THREE.Group(); g.add(drift); g.userData.drift=drift;
  for (let i=0;i<n;i++){ const u=(i+0.5)*L/n, y=B.yAtS(u/L);
    mk(G.box(L/n+0.04, 0.16, w*2), stone, u, y-0.08, 0, g);
    const e=mk(G.box(0.06, 0.05, w*2-0.1), lit, u+L/n/2-0.03, y-0.01, 0, g); e.castShadow=false;
    if (i%9===4){ addGlow(g, y+0.4, 2.2, 0xbfd8ff).position.x=u; }
    if (i%3===1){ const k=mk(G.dod(0.14+r()*0.2), stone, u+(r()-0.5)*0.6, y-0.7-r()*1.4, (r()-0.5)*2.4*w, drift); k.userData.ph=r()*TAU; k.userData.y0=k.position.y; } }
  for (const [u,s] of [[0,0],[L,1]]){ const y=B.yAtS(s); mk(G.box(1.1,0.4,w*2+0.5), stone, u, y-0.25, 0, g);
    for (const sd of [-1,1]){ mk(G.cyl(0.09,0.12,1.4,6), stone, u, y+0.7, sd*(w+0.15), g); const c=mk(G.ico(0.16,0), lit, u, y+1.55, sd*(w+0.15), g); c.castShadow=false; addGlow(g, y+1.55, 1.6, 0xd8e4ff).position.set(u, y+1.55, sd*(w+0.15)); } }
  return g; }
// the underside of a floating isle: rock tapering to a point, following the isle's own outline, with a few crystals and roots hanging off it
export function buildSkyUnder(I){
  const g=new THREE.Group(), RING=[[1.0,0.15],[0.985,0],[0.93,-1.8],[0.78,-4.6],[0.56,-8.2],[0.32,-11.6],[0.1,-14.2],[0,-15.4]], NA=56, r=mulberry32(I.k*131+7);
  const pos=[], col=[], idx=[], c=new THREE.Color(), moss=new THREE.Color(0x5a7a4a), rock=new THREE.Color(0x7a7088), deep=new THREE.Color(0x4a4258);
  RING.forEach(([f,dy],j)=>{ for (let i=0;i<NA;i++){ const a=i/NA*TAU, wob=j>0 && j<RING.length-1 ? 1+(r()-0.5)*0.14 : 1, rr=isleRadius(I,a)*f*wob;
      pos.push(Math.cos(a)*rr, SKY_CUT+dy+(j>1 && j<RING.length-1 ? (r()-0.5)*1.1 : 0), Math.sin(a)*rr);
      c.copy(j<2 ? moss : rock).lerp(deep, j/(RING.length-1)).offsetHSL(0,0,(r()-0.5)*0.06); col.push(c.r,c.g,c.b); } });
  for (let j=0;j<RING.length-1;j++) for (let i=0;i<NA;i++){ const a=j*NA+i, b=j*NA+(i+1)%NA, c2=(j+1)*NA+i, d=(j+1)*NA+(i+1)%NA; idx.push(a,c2,b, b,c2,d); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col,3)); geo.setIndex(idx); geo.computeVertexNormals();
  const m=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors:true, flatShading:true, roughness:0.95, side:THREE.DoubleSide })); m.castShadow=true; m.receiveShadow=true; g.add(m);
  const cry=glowMat(0xa8c8ff), root=M(0x5a4a3a);
  for (let i=0;i<14;i++){ const a=r()*TAU, f=0.35+r()*0.5, rr=isleRadius(I,a)*f, y=SKY_CUT-2-(1-f)*11-r()*1.5;
    const k=mk(G.cone(0.25+r()*0.3, 1.4+r()*2.2, 5), cry, Math.cos(a)*rr, y, Math.sin(a)*rr, g); k.rotation.x=Math.PI; k.rotation.z=(r()-0.5)*0.4; k.castShadow=false; }
  for (let i=0;i<10;i++){ const a=r()*TAU, rr=isleRadius(I,a)*(0.9+r()*0.08), h=1.5+r()*3; const rt=mk(G.cyl(0.04,0.07,h,5), root, Math.cos(a)*rr, SKY_CUT-0.6-h/2, Math.sin(a)*rr, g); rt.rotation.z=(r()-0.5)*0.3; rt.castShadow=false; }
  g.position.set(I.cx, 0, I.cz); return g; }

/* ---------- Landmarks ---------- */
export function buildLandmark(kind, seed){
  const g=new THREE.Group(), r=mulberry32(seed|0), stone=M(0xb8b0a0,{flatShading:true}), stone2=M(0x9a948a,{flatShading:true}), wood=M(0x8a5e3a), dark=M(0x5a3e28), white=M(0xf4efe6), red=M(0xc8503d), moss=M(0x5f8a3e);
  g.userData.spin=null; g.userData.desc='';
  if (kind==='pines') return buildGrandfatherStump();
  if (kind==='starfall'){ // v1.41 the star altar: a ring of pale stones round a dais, a star turning slowly over it
    const pale=M(0xd8d4e8,{flatShading:true}), lit=glowMat(0xd8e4ff), gold=M(0xf3c35a,{ metalness:0.6, roughness:0.3 });
    mk(G.cyl(2.4,2.7,0.35,16), pale, 0,0.17,0,g); mk(G.cyl(1.6,1.8,0.3,16), stone, 0,0.5,0,g); mk(G.cyl(0.4,0.55,1.1,8), pale, 0,1.2,0,g); mk(G.cyl(0.62,0.62,0.12,10), gold, 0,1.8,0,g);
    for (let i=0;i<7;i++){ const a=i/7*TAU, h=1.3+r()*0.9, s=mk(G.box(0.45,h,0.32), pale, Math.cos(a)*3.4, h/2, Math.sin(a)*3.4, g); s.rotation.y=-a; s.rotation.z=(r()-0.5)*0.12;
      const gl=mk(G.box(0.08,h*0.6,0.02), lit, Math.cos(a)*3.23, h*0.5, Math.sin(a)*3.23, g); gl.rotation.y=-a+Math.PI/2; gl.castShadow=false; }
    const star=new THREE.Group(); star.position.y=3.0; g.add(star); const sh=new THREE.Shape(); for (let i=0;i<10;i++){ const a=i/10*TAU+Math.PI/2, rr=i%2?0.22:0.55; i?sh.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):sh.moveTo(Math.cos(a)*rr,Math.sin(a)*rr); }
    const sm=new THREE.Mesh(new THREE.ExtrudeGeometry(sh,{ depth:0.16, bevelEnabled:true, bevelSize:0.04, bevelThickness:0.04, bevelSegments:1 }), glowMat(0xfff0b0)); sm.position.z=-0.08; star.add(sm); addGlow(g, 3.0, 4.2, 0xfff0c0);
    g.userData.spin=star; g.userData.desc='A ring of pale stones on the top of the sky. A star turns slowly over the altar, warm to stand near.';
    g.userData.rects=[[-2.5,-2.5,2.5,2.5]]; return g; }
  if (kind==='meadow'){ // a stone windmill with cloth sails that turn in the wind
    mk(G.cyl(1.6,2.2,6.2,12), stone, 0,3.1,0,g); mk(G.cyl(1.7,1.7,0.2,12), stone2, 0,6.2,0,g);
    const cap=mk(G.cone(2.0,2.2,12), M(0x7a4a3a), 0,7.4,0,g); cap.castShadow=true;
    mk(G.box(0.9,1.6,0.1), dark, 0,0.8,2.15,g); for (const y of [2.6,4.4]) mk(G.box(0.6,0.7,0.1), M(0x3a4a5a), 0,y,1.98-y*0.07,g);
    const hub=new THREE.Group(); hub.position.set(0,6.4,1.95); g.add(hub); mk(G.cyl(0.25,0.25,0.5,10), dark, 0,0,0,hub).rotation.x=Math.PI/2;
    // v1.39: the sails start out rotted (tattered grey cloth) until Barley's new ones go up; main.js calls setMill
    const sailM=M(0xf4ecd8), rotM=M(0x9a9080,{ roughness:1 }), good=[], torn=[];
    for (let i=0;i<4;i++){ const arm=new THREE.Group(); arm.rotation.z=i*Math.PI/2; hub.add(arm); mk(G.box(0.18,4.2,0.12), wood, 0,2.1,0.1,arm);
      const sail=mk(G.box(1.1,3.2,0.04), sailM, 0.62,2.4,0.14,arm); sail.castShadow=true; good.push(sail); for (let k=0;k<4;k++) mk(G.box(1.1,0.04,0.06), wood, 0.62,1.0+k*0.9,0.16,arm);
      for (let k=0;k<3;k++){ const t=mk(G.box(0.5+r()*0.5,0.5+r()*0.4,0.03), rotM, 0.45+r()*0.3, 1.2+k*1.05, 0.14, arm); t.rotation.z=(r()-0.5)*0.5; t.visible=false; torn.push(t); } }
    // the water wheel and its wooden millrace on the east side (hidden until Wendell digs the stream)
    const wheel=new THREE.Group(); wheel.position.set(2.45,1.3,0); wheel.visible=false; g.add(wheel);
    const wh=new THREE.Group(); wheel.add(wh); const wd2=M(0x7a5a3a);
    for (const s2 of [-0.32,0.32]){ const rim=mk(G.tor(1.15,0.07,6,20), wd2, s2,0,0,wh); rim.rotation.y=Math.PI/2; }
    for (let i=0;i<10;i++){ const a=i/10*TAU, sp=mk(G.box(0.06,2.2,0.06), wd2, 0,0,0,wh); sp.rotation.x=a; const pd=mk(G.box(0.7,0.08,0.34), wood, 0, Math.cos(a)*1.15, Math.sin(a)*1.15, wh); pd.rotation.x=a; }
    mk(G.cyl(0.14,0.14,0.9,8), dark, 0,0,0,wh).rotation.z=Math.PI/2;
    const race=mk(G.box(0.8,0.3,7), wd2, 0.15,-1.15,-0.5,wheel), water=mk(G.box(0.62,0.04,6.9), M(0x5aa8c8,{ roughness:0.15, metalness:0.1, transparent:true, opacity:0.85 }), 0.15,-1.03,-0.5,wheel); water.castShadow=false;
    for (const z of [-3.6,-1.2,1.2]) mk(G.box(0.12,1.0,0.12), dark, 0.62,-1.5,z,wheel);
    g.userData.spin=hub; g.userData.wheel=wh; g.userData.desc='An old stone windmill. The sails are rotted through and they barely turn, creaking whenever the wind comes off the sea.';
    g.userData.setMill=(o={})=>{ const ok=!!o.sails; good.forEach(m=>m.visible=ok); torn.forEach(m=>m.visible=!ok); g.userData.spinRate=ok?1:0.15; wheel.visible=!!o.wheel;
      g.userData.desc = !ok ? 'An old stone windmill. The sails are rotted through and they barely turn, creaking whenever the wind comes off the sea.'
        : o.wheel ? 'Barley\'s mill. The sails turn, the water wheel turns, and there\'s flour dust on everything.' : 'The old windmill, with new sails. They turn steady and white whenever the wind comes off the sea.'; };
    g.userData.setMill({ sails:false });
    g.userData.rects=[[-2.3,-2.3,3.3,2.3]]; }
  if (kind==='dunes'){ // a shipwreck half buried in the sand
    const WS=2.3, hull=new THREE.Group(); hull.rotation.z=0.22; hull.rotation.y=0.3; hull.position.y=2.9; hull.scale.setScalar(WS); g.add(hull);   // v1.57 a much bigger ship, the Saltwren as she was   // the keel sits just under the sand, the ribs stick up out of it
    for (let i=0;i<9;i++){ const x=-4+i*1.0, s=Math.sin((i+0.5)/9*Math.PI); const rib=mk(new THREE.TorusGeometry(1.6*s+0.4, 0.12, 6, 14, Math.PI), dark, x, 0.2, 0, hull); rib.rotation.y=Math.PI/2; rib.rotation.x=Math.PI; }
    for (let k=0;k<5;k++){ const pl=mk(G.box(7.2,0.12,0.5), wood, 0, -0.3-k*0.32+0.1, (k%2?1:-1)*(1.6-k*0.25), hull); pl.rotation.x=(k%2?1:-1)*(0.5+k*0.12); }
    const mast=mk(G.cyl(0.16,0.2,4.6,8), dark, 0.6, 0.6, 0.1, hull); mast.rotation.z=-0.5; mk(G.box(1.8,0.12,0.12), dark, 1.4, 2.0, 0.1, hull).rotation.z=0.4;
    // a second mast snapped off, the bowsprit, the rudder, spilled crates and barrels, a sail half buried
    const m2=mk(G.cyl(0.13,0.17,3.0,8), dark, -2.2, 0.4, -0.1, hull); m2.rotation.z=0.35; m2.rotation.x=0.2;
    const bs=mk(G.cyl(0.08,0.12,2.6,6), dark, 4.6, 0.2, 0, hull); bs.rotation.z=-1.2;
    mk(G.box(0.18,1.3,0.9), wood, -4.3, -0.2, 0, hull).rotation.z=0.2;
    { const sg=new THREE.PlaneGeometry(5.2,3.4,10,6), P=sg.attributes.position;   // the old sail, torn and lying in folds on the sand beside her
      for (let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i); P.setZ(i, 0.22*Math.sin(x*1.9+y*0.7)+0.12*Math.sin(y*2.6)+0.1); } sg.computeVertexNormals();
      const sail=mk(sg, M(0xe8dcc0,{ side:THREE.DoubleSide, roughness:0.95 }), 2.0, 0.05, -6.2, g); sail.rotation.set(-Math.PI/2, 0, 0.5); sail.castShadow=false; }
    const crate=M(0x9a6a3a), band=M(0x5a5048,{ metalness:0.3, roughness:0.6 });
    for (let i=0;i<7;i++){ const a=r()*TAU, d=7+r()*6, x=Math.cos(a)*d, z=Math.sin(a)*d*0.7, y=0.15;
      if (i%2){ const c=mk(G.box(0.8,0.7,0.8), crate, x, y+0.2, z, g); c.rotation.set((r()-0.5)*0.4, r()*TAU, (r()-0.5)*0.3); }
      else { const b=mk(G.cyl(0.38,0.38,0.9,10), crate, x, y+0.2, z, g); b.rotation.set(Math.PI/2*(r()<0.5?1:0)+0.2, r()*TAU, 0); mk(G.cyl(0.4,0.4,0.08,10), band, 0,0.25,0, b); mk(G.cyl(0.4,0.4,0.08,10), band, 0,-0.25,0, b); } }
    for (let i=0;i<9;i++) mk(G.dod(0.3+r()*0.45), stone2, (r()-0.5)*20, 0.1, (r()-0.5)*13, g);
    g.userData.desc='The bones of an old ship, bigger than any boat that comes to the island now. The name on the stern has worn away, but someone has carved a little crab next to where it was.';
    // the hull is solid: little boxes along its keel (in the landmark's own frame; main.js turns them with it)
    g.userData.hull=[]; for (let i=-4;i<=4;i++){ const lx=i*WS, hw=(0.8+1.5*Math.sin((i+4.5)/9*Math.PI))*WS*0.85; g.userData.hull.push([lx*Math.cos(0.3), -lx*Math.sin(0.3), hw]); }
    g.userData.bellAt=[3.6, 7.8]; g.userData.exitAt=[3.6, 10.0];   // the diving bell stands clear of the bigger hull, on the island side
    g.userData.rects=[[-4.4,-2.2,4.4,2.2]]; }
  if (kind==='bluff'){ // a striped lighthouse with a lamp that turns at night
    mk(G.cyl(2.2,2.5,0.8,14), stone2, 0,0.4,0,g);
    for (let i=0;i<5;i++) mk(G.cyl(1.55-i*0.13, 1.68-i*0.13, 1.5, 14), i%2?red:white, 0, 1.55+i*1.5, 0, g);
    mk(G.cyl(1.35,1.35,0.18,14), dark, 0,8.4,0,g);
    // v1.38: the lamp room stands dark until Skipper Wick's lamp is fitted (main.js calls setLit)
    const litM=glowMat(0xfff0c0), darkM=M(0x5a6670,{ roughness:0.25, metalness:0.3, transparent:true, opacity:0.7 });
    const lamp=mk(G.cyl(0.8,0.8,1.2,12), darkM, 0,9.1,0,g); lamp.castShadow=false; const halo=addGlow(g, 9.1, 5, 0xfff0c0); halo.visible=false;
    for (let i=0;i<8;i++){ const a=i/8*TAU; mk(G.box(0.06,1.2,0.06), dark, Math.cos(a)*0.85, 9.1, Math.sin(a)*0.85, g); }
    mk(G.cone(1.15,1.0,12), red, 0,10.2,0,g); mk(G.sph(0.14,8,6), M(0xf3c35a,{metalness:0.5,roughness:0.3}), 0,10.8,0,g);
    const beam=new THREE.Group(); beam.position.y=9.1; g.add(beam);
    const bm=new THREE.Mesh(new THREE.ConeGeometry(2.2, 16, 16, 1, true), new THREE.MeshBasicMaterial({ color:0xfff4c8, transparent:true, opacity:0.0, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending }));
    bm.rotation.z=Math.PI/2; bm.position.x=8; beam.add(bm); g.userData.beam=beam; g.userData.beamMat=bm.material;
    mk(G.box(0.9,1.6,0.1), dark, 0,1.6,1.62,g);
    g.userData.lit=false; g.userData.setLit=on=>{ g.userData.lit=!!on; lamp.material=on?litM:darkM; halo.visible=!!on; beam.visible=!!on; }; beam.visible=false;
    g.userData.desc='The old lighthouse on the bluff. The lamp room is empty and the glass is cracked. It would take a whole new lamp to light it again.';
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

/* ---------- v1.57 what the features look like ----------
   gy(x,z) is the ground height. Returns a group; userData.rects are solid boxes (world [x0,z0,x1,z1]) for the ruins,
   userData.tick(dt,t) moves the waterfall and the glowing things, userData.solid lists [x,z,r] for round solid bits. */
let _fallTex=null;
function fallTexture(){ if (_fallTex) return _fallTex; const cv=document.createElement('canvas'); cv.width=64; cv.height=256; const x=cv.getContext('2d'); x.fillStyle='rgba(205,240,255,0.6)'; x.fillRect(0,0,64,256);
  const r=mulberry32(11); for (let i=0;i<90;i++){ x.fillStyle=`rgba(255,255,255,${0.35+r()*0.6})`; x.fillRect(r()*64, r()*256, 1+r()*3, 14+r()*60); }
  _fallTex=new THREE.CanvasTexture(cv); _fallTex.wrapS=_fallTex.wrapT=THREE.RepeatWrapping; return _fallTex; }
function ribbon(pts, hw, y, mat){ const pos=[], idx=[]; for (let i=0;i<pts.length;i++){ const p=pts[i], q=pts[Math.min(i+1,pts.length-1)], o=pts[Math.max(i-1,0)], dx=q[0]-o[0], dz=q[1]-o[1], L=Math.hypot(dx,dz)||1, nx=-dz/L*hw, nz=dx/L*hw;
    pos.push(p[0]+nx, y, p[1]+nz, p[0]-nx, y, p[1]-nz); if (i<pts.length-1){ const a=i*2; idx.push(a,a+2,a+1, a+1,a+2,a+3); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); const m=new THREE.Mesh(g, mat); m.receiveShadow=true; m.castShadow=false; return m; }
const densify = (pts, step=0.6) => { const out=[]; for (let i=0;i<pts.length-1;i++){ const [ax,az]=pts[i], [bx,bz]=pts[i+1], n=Math.max(1, Math.ceil(Math.hypot(bx-ax,bz-az)/step)); for (let k=0;k<n;k++) out.push([lerp(ax,bx,k/n), lerp(az,bz,k/n)]); } out.push(pts[pts.length-1]); return out; };
export function buildIsleFx(I, gy, seed){
  const g=new THREE.Group(), r=mulberry32(seed|0), rects=[], solid=[], ticks=[], keep=[];
  const stone=M(0xb4ac9c,{flatShading:true}), stone2=M(0x9a948a,{flatShading:true}), mossM=M(0x5f8a3e), moss2=M(0x6f9a48), reedM=M(0x6a8a3a), padM=M(0x4f8a3a,{ side:THREE.DoubleSide });
  const waterM=new THREE.MeshStandardMaterial({ color:0x4cc3d6, transparent:true, opacity:0.8, roughness:0.18, metalness:0.05 });
  const mossCap=(x,y,z,s,p=g)=>{ const m=mk(G.sph(s,8,5), r()<0.5?mossM:moss2, x,y,z,p); m.scale.set(1,0.3,1); m.castShadow=false; return m; };
  // a solid strip of blocks from (x0,z0) along a heading, as rects
  const block=(x,z,w,h,d,rot,mat=stone)=>{ const y=gy(x,z), b=mk(G.box(w,h,d), mat, x, y+h/2-0.05, z, g); b.rotation.y=rot; return b; };
  const rectAt=(x,z,hw)=>rects.push([x-hw,z-hw,x+hw,z+hw]);
  for (const F of (I.fxOn||[])){
    if (F.t==='ruin'){ const c=Math.cos(F.rot), s=Math.sin(F.rot), at=(u,v)=>[F.x+c*u-s*v, F.z+s*u+c*v];
      if (F.kind==='wall'){   // a broken wall with a doorway, blocks fallen off it
        for (let i=-3;i<=3;i++){ if (i===0) continue; const h=(1.0+r()*1.7)*(Math.abs(i)===3?0.6:1), [x,z]=at(i*0.95,0); block(x,z,0.92,h,0.62,-F.rot); mossCap(x, gy(x,z)+h-0.02, z, 0.42); rectAt(x,z,0.5); }
        { const [x,z]=at(0,0); const lt=block(x,z,2.9,0.36,0.62,-F.rot); lt.position.y=gy(x,z)+2.2; }   // the lintel still spans the doorway
        for (let i=0;i<3;i++){ const [x,z]=at((r()-0.5)*5, 1.2+r()*1.2); const b=block(x,z,0.9,0.5,0.6,r()*TAU, stone2); b.rotation.z=(r()-0.5)*0.4; mossCap(x,gy(x,z)+0.48,z,0.35); } }
      else if (F.kind==='colonnade'){   // two rows of columns, some broken, one lying in the grass
        for (const v of [-1.5,1.5]) for (let i=0;i<4;i++){ const [x,z]=at(-2.4+i*1.6, v), y=gy(x,z), h= r()<0.35 ? 0.7+r()*0.9 : 3.1;
          if (i===2 && v>0){ const fc=mk(G.cyl(0.32,0.32,2.8,9), stone, x+c*0.4, y+0.32, z+s*0.4, g); fc.rotation.set(0,-F.rot,Math.PI/2); fc.rotation.order='YXZ'; continue; }
          mk(G.cyl(0.45,0.5,0.3,9), stone2, x, y+0.15, z, g); mk(G.cyl(0.3,0.34,h,9), stone, x, y+0.3+h/2, z, g); mossCap(x, y+0.3+h, z, 0.36); solid.push([x,z,0.45]); }
        { const [x,z]=at(-1.6,-1.5); const b=mk(G.box(3.6,0.32,0.62), stone, 0,0,0,g); b.position.set(x+c*0.8, gy(x,z)+3.55, z+s*0.8); b.rotation.y=-F.rot; }   // a lintel across the first pair
        { const [x,z]=at(0,0); const fl=mk(G.box(6.4,0.08,3.8), stone2, x, gy(x,z)+0.03, z, g); fl.rotation.y=-F.rot; fl.castShadow=false; } }   // the old floor
      else {   // the stump of a round tower, open on one side
        const R=2.3, y0=gy(F.x,F.z); for (let i=0;i<14;i++){ if (i===0 || i===13) continue; const a=F.rot+i/14*TAU, x=F.x+Math.cos(a)*R, z=F.z+Math.sin(a)*R, h=1.4+2.6*Math.abs(Math.sin(i*1.7+F.rot))*(i>4&&i<10?1:0.55);
          const b=mk(G.box(1.1,h,0.6), stone, x, gy(x,z)+h/2-0.05, z, g); b.rotation.y=-a+Math.PI/2; mossCap(x, gy(x,z)+h, z, 0.4); solid.push([x,z,0.55]); }
        const fl=mk(G.cyl(R-0.2,R-0.2,0.1,14), stone2, F.x, y0+0.02, F.z, g); fl.castShadow=false;
        for (let i=0;i<4;i++){ const a=F.rot+Math.PI+(r()-0.5)*1.4, d=R+1+r()*1.6, x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d; const b=block(x,z,0.8,0.45,0.55,r()*TAU, stone2); b.rotation.x=(r()-0.5)*0.3; } } }
    else if (F.t==='spire' || F.t==='grotto'){   // moss and a few ferns-like tufts on the spire tops (v1.58 bare stone tops with a patch or two of moss, was one cap over the whole top)
      for (const [px,pz,pr,ph] of (F.spire ? [F.spire] : F.spires)){ const y=PLATEAU+ph, ca=r()*TAU, cd=pr*0.3; mossCap(px+Math.cos(ca)*cd, y-0.1, pz+Math.sin(ca)*cd, pr*0.42); mossCap(px-Math.cos(ca)*cd*1.2, y-0.1, pz-Math.sin(ca)*cd*1.2, pr*0.22); for (let k=0;k<3;k++){ const a=r()*TAU; mossCap(px+Math.cos(a)*pr*0.9, y-0.9-r()*1.6, pz+Math.sin(a)*pr*0.9, 0.5+r()*0.3); } }
      if (F.t==='grotto'){   // a still pool at the bottom, stepping stones, glowing moss on the walls
        const glow=glowMat(0x8fe0b0); for (let k=0;k<16;k++){ const a=k/16*TAU+r()*0.3, d=F.rp+1.6+r()*(F.R-F.rp-2.4), x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d; const m=mk(G.sph(0.22+r()*0.2,6,4), r()<0.4?glow:mossM, x, gy(x,z)+0.04, z, g); m.scale.y=0.4; m.castShadow=false; }
        for (let k=0;k<5;k++){ const a=r()*TAU, d=r()*F.rp*0.7, x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d; const p=mk(G.cyl(0.35+r()*0.2,0.38,0.04,10), padM, x, 0.03, z, g); p.castShadow=false; } } }
    else if (F.t==='pond'){   // reeds round the edge, lily pads, a flat stone to fish from
      for (let k=0;k<18;k++){ const a=r()*TAU, d=F.r+0.2+r()*0.9, x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d, y=Math.max(gy(x,z),-0.1); if (gy(x,z)>0.6) continue;
        for (let j=0;j<4;j++){ const h=0.7+r()*0.6, rd=mk(G.cyl(0.025,0.035,h,4), reedM, x+(r()-0.5)*0.4, y+h/2, z+(r()-0.5)*0.4, g); rd.rotation.set((r()-0.5)*0.25,0,(r()-0.5)*0.25); rd.castShadow=false; } }
      for (let k=0;k<9;k++){ const a=r()*TAU, d=r()*F.r*0.8, x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d; const p=mk(G.cyl(0.32+r()*0.18,0.32,0.03,10), padM, x, 0.03, z, g); p.castShadow=false; if (r()<0.4) mk(G.sph(0.09,6,4), M(0xf4c8d8), x, 0.1, z, g); } }
    else if (F.t==='stream'){ const P=densify(F.pts, 1.4); for (let k=1;k<P.length-1;k++) if (r()<0.55){ const [x,z]=P[k], s2=(r()<0.5?1:-1)*(F.hw+0.4+r()*0.5), dx=P[k+1][0]-P[k-1][0], dz=P[k+1][1]-P[k-1][1], L=Math.hypot(dx,dz)||1, xx=x-dz/L*s2, zz=z+dx/L*s2, y=gy(xx,zz);
        if (y<0.8) for (let j=0;j<3;j++){ const h=0.6+r()*0.5; mk(G.cyl(0.025,0.035,h,4), reedM, xx+(r()-0.5)*0.4, Math.max(y,-0.1)+h/2, zz+(r()-0.5)*0.4, g).castShadow=false; } } }
    else if ((F.t==='spring' || F.t==='skypool') && F.lvl!==undefined){
      const glow=F.t==='skypool', wm=glow ? new THREE.MeshStandardMaterial({ color:0x6ac8f0, emissive:0x2a7ab8, emissiveIntensity:0.45, transparent:true, opacity:0.85, roughness:0.15 }) : waterM;
      const pool=new THREE.Mesh(new THREE.CircleGeometry(F.r+0.25, 32), wm); pool.rotation.x=-Math.PI/2; pool.position.set(F.x, F.lvl, F.z); pool.receiveShadow=true; g.add(pool);
      for (let k=0;k<12;k++){ const a=k/12*TAU+r()*0.3, d=F.r+0.5+r()*0.4, x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d; if (F.run && polyD(x,z,F.run)<F.hw+0.6) continue; const b=mk(G.dod(0.3+r()*0.3), stone2, x, gy(x,z)+0.1, z, g); b.rotation.set(r()*3,r()*3,0); }
      if (glow){ for (let k=0;k<7;k++){ const a=r()*TAU, d=r()*F.r*0.7, s=mk(G.sph(0.06,6,4), glowMat(0xd8f4ff), F.x+Math.cos(a)*d, F.lvl+0.3+r()*0.8, F.z+Math.sin(a)*d, g); s.castShadow=false; s.userData.ph=r()*TAU; s.userData.y0=s.position.y; keep.push(s); ticks.push((dt,t)=>{ s.position.y=s.userData.y0+Math.sin(t*0.8+s.userData.ph)*0.25; }); } }
      if (F.run && F.run.length>1){ g.add(ribbon(densify(F.run,0.5), F.hw+0.2, F.lvl-0.02, wm));
        // the waterfall: over the cliff edge and down to the sea
        const [lx,lz]=F.lip, pr=F.run[F.run.length-2], dx=lx-pr[0], dz=lz-pr[1], L=Math.hypot(dx,dz)||1, ux=dx/L, uz=dz/L;
        let out=0.4; for (; out<6; out+=0.2) if (isleRaw(I, lx+ux*out, lz+uz*out) < 0.3) break;
        const fg=new THREE.Group(); fg.position.set(lx, 0, lz); fg.rotation.y=Math.atan2(ux, uz); g.add(fg); keep.push(fg);
        const rows=16, W=(F.hw+0.15)*2, pos=[], uv=[], idx=[];
        for (let k=0;k<=rows;k++){ const t=k/rows, y=lerp(F.lvl-0.05, -0.2, t), z=out*Math.sqrt(t)+0.15; for (const sx of [-1,1]){ pos.push(sx*W/2*(1+0.3*t), y, z); uv.push(sx<0?0:1, t*3); } if (k<rows){ const a=k*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } }
        const sg=new THREE.BufferGeometry(); sg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); sg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); sg.setIndex(idx); sg.computeVertexNormals();
        const tex=fallTexture(), sheet=new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map:tex, color:0xe6f8ff, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false })); fg.add(sheet);
        const splash=new THREE.Mesh(new THREE.CircleGeometry(1.6,24), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.5, depthWrite:false })); splash.rotation.x=-Math.PI/2; splash.position.set(0,0.06,out+0.3); fg.add(splash);
        ticks.push((dt,t)=>{ tex.offset.y-=dt*1.7; splash.scale.setScalar(1+Math.sin(t*5)*0.07); splash.material.opacity=0.42+Math.sin(t*7)*0.1; }); } }
    else if (F.t==='garden'){   // Starfall: glowing mushrooms and crystals
      const cols=[0x9ad8ff,0xc8a8ff,0xa8ffd8], cap=cols.map(c=>glowMat(c)), stem=M(0xe8e4f0), crys=cols.map(c=>{ const m=glowMat(c); m.transparent=true; m.opacity=0.85; m.flatShading=true; return m; });
      for (let k=0;k<22;k++){ const a=r()*TAU, d=Math.sqrt(r())*F.r, x=F.x+Math.cos(a)*d, z=F.z+Math.sin(a)*d, y=gy(x,z), s=0.6+r()*0.9;
        if (k%3){ mk(G.cyl(0.04*s,0.06*s,0.35*s,6), stem, x, y+0.17*s, z, g).castShadow=false; const c2=mk(G.sph(0.16*s,8,5,0,TAU,0,Math.PI/2), cap[k%3], x, y+0.33*s, z, g); c2.castShadow=false; }
        else { const c2=mk(G.cone(0.14*s, 0.8*s, 5), crys[k%3], x, y+0.35*s, z, g); c2.rotation.set((r()-0.5)*0.5, r()*3, (r()-0.5)*0.5); c2.castShadow=false; } }
      addGlow(g, 0, 7, 0xb8d8ff).position.set(F.x, gy(F.x,F.z)+0.6, F.z); } }
  // Starfall: rocks drifting round the edge of the island
  if (I.kind==='starfall'){ const rm=M(0xc8c4d8,{flatShading:true}), lit=glowMat(0xbfd8ff);
    for (let k=0;k<12;k++){ const a=r()*TAU, d=isleRadius(I,a)*(1.08+r()*0.25), x=I.cx+Math.cos(a)*d, z=I.cz+Math.sin(a)*d, s=0.4+r()*1.1, y=SKY-2+r()*6;
      const rk=mk(G.dod(s), rm, x, y, z, g); rk.rotation.set(r()*3,r()*3,r()*3); rk.castShadow=false; if (r()<0.5) mk(G.sph(s*0.25,6,4), lit, 0, s*0.7, 0, rk).castShadow=false;
      const ph=r()*TAU, sp=0.2+r()*0.3; keep.push(rk); ticks.push((dt,t)=>{ rk.position.y=y+Math.sin(t*sp+ph)*0.6; rk.rotation.y+=dt*0.05; }); } }
  // sea stacks: grass and moss on top, seabird perches
  for (const [px,pz,pr,ph] of (I.fxStacks||[])){ const y=PLATEAU*ph; mossCap(px, y-0.1, pz, pr*0.9); }
  g.userData.rects=rects; g.userData.solid=solid; g.userData.keep=keep; g.userData.tick=(dt,t)=>{ for (const f of ticks) f(dt,t); };
  return g; }
