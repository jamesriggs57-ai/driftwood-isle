/* =====================================================================
   v1.40 CRAFTING TABLES: models for the two new tables and their pieces, and the hooks main.js calls.
   Rules and numbers are in benches-core.js.
   ===================================================================== */
import * as THREE from 'three';
import { ITEMS } from './content.js';
import { M, mk, G, glowMat, FURN_BUILDERS } from './models.js';
import { BENCH_IDS, BENCH_NAME, NEW_BENCHES, BENCH_PIECES, benchTierOf, benchFor, bestBench, benchProgress, toolBench, enchBench, TWIN_BENCH, FIELD } from './benches-core.js';
export * from './benches-core.js';

const WOOD=0xa8754a, WOOD2=0x8b5e3a, WOODL=0xc99a6a, DARK=0x6a4a3a, IRON=0x6a6a70, BRASS=0xc8a040;
const metal = c => M(c, { metalness:0.6, roughness:0.4 });
const anim = (g, fn) => { (g.userData.anims ||= []).push(fn); };
const legs = (g, w, d, h, t=0.1, c=WOOD2) => { for (const x of [-w/2, w/2]) for (const z of [-d/2, d/2]) mk(G.box(t,h,t), M(c), x,h/2,z,g); };

Object.assign(FURN_BUILDERS, {
  // a long bench with a vise, a pegboard of tools and a saw
  carpbench(g){ mk(G.box(1.8,0.12,0.8), M(WOODL), 0,0.86,0,g); legs(g,1.6,0.62,0.8,0.12); mk(G.box(1.6,0.06,0.6), M(WOOD), 0,0.28,0,g);
    mk(G.box(1.8,0.9,0.08), M(WOOD2), 0,1.36,-0.38,g);   // pegboard
    for (const [x,h] of [[-0.6,0.36],[-0.3,0.28],[0.05,0.4],[0.4,0.3]]){ mk(G.cyl(0.025,0.025,h,6), M(WOOD), x,1.4,-0.32,g); mk(G.box(0.12,0.08,0.05), metal(IRON), x,1.4+h/2,-0.32,g); }
    const saw=mk(G.box(0.5,0.16,0.01), metal(0xb8bcc4), 0.62,1.36,-0.32,g); saw.rotation.z=0.2; mk(G.box(0.14,0.1,0.04), M(DARK), 0.84,1.42,-0.32,g);
    mk(G.box(0.22,0.18,0.2), metal(IRON), -0.78,0.98,0.32,g); const sc=mk(G.cyl(0.02,0.02,0.36,6), metal(0x9a9aa0), -0.78,0.98,0.48,g); sc.rotation.x=Math.PI/2;   // vise
    mk(G.box(0.36,0.06,0.12), M(WOOD), 0.2,0.95,0.12,g); mk(G.box(0.26,0.04,0.26), M(0xe8d8b8), -0.25,0.94,0.05,g);   // plank offcut, plans
    mk(G.box(0.5,0.2,0.3), M(WOOD), 0.45,0.4,0.05,g); },
  // a heavy oak bench with an iron frame, a lamp, drawers and a glowing charm board for enchanting
  masterbench(g){ mk(G.box(2,0.14,0.9), M(DARK), 0,0.9,0,g); for (const x of [-0.92,0.92]) for (const z of [-0.36,0.36]) mk(G.box(0.14,0.84,0.14), metal(0x3a3836), x,0.42,z,g);
    mk(G.box(1.8,0.5,0.7), M(WOOD2), 0,0.4,0,g); for (const x of [-0.6,0,0.6]){ mk(G.box(0.5,0.18,0.02), M(WOOD), x,0.5,0.36,g); mk(G.sph(0.03,8,6), metal(BRASS), x,0.5,0.38,g); mk(G.box(0.5,0.18,0.02), M(WOOD), x,0.28,0.36,g); mk(G.sph(0.03,8,6), metal(BRASS), x,0.28,0.38,g); }
    mk(G.box(2,1.1,0.1), M(DARK), 0,1.52,-0.42,g); mk(G.box(1.9,0.06,0.16), M(WOODL), 0,1.2,-0.34,g);   // back board and shelf
    for (const [x,c] of [[-0.7,0x5ac06a],[-0.45,0x5ab0e0],[-0.2,0xf08a3a]]){ mk(G.cyl(0.05,0.06,0.16,10), M(c,{ transparent:true, opacity:0.75, roughness:0.2 }), x,1.31,-0.34,g); }
    const ring=mk(G.tor(0.26,0.025,8,32), glowMat(0x9ab8ff), 0.45,1.62,-0.36,g); const rune=mk(G.cyl(0.18,0.18,0.01,6), glowMat(0xc8a8ff), 0.45,1.62,-0.36,g); rune.rotation.x=Math.PI/2;
    anim(g, t=>{ ring.rotation.z=t*0.6; rune.rotation.y=Math.sin(t*1.3)*0.3; });
    const arm=mk(G.cyl(0.02,0.02,0.6,6), metal(BRASS), -0.75,1.26,0.1,g); arm.rotation.z=0.3; mk(G.cone(0.12,0.14,12), metal(0x3a5a4a), -0.66,1.5,0.1,g); mk(G.sph(0.05,8,6), glowMat(0xffe0a0), -0.66,1.43,0.1,g);
    mk(G.box(0.3,0.05,0.22), M(0xe8d8b8), 0.1,0.99,0.1,g); mk(G.box(0.4,0.1,0.16), metal(IRON), 0.6,1.02,0.15,g); },
  rockinghorse(g){ const h=new THREE.Group(); g.add(h);
    for (const z of [-0.2,0.2]){ const r=mk(G.tor(0.55,0.035,6,24,Math.PI*0.6), M(WOOD2), 0,0.6,z,h); r.rotation.z=Math.PI*1.2; }
    mk(G.box(0.08,0.14,0.42), M(WOOD), -0.3,0.14,0,h); mk(G.box(0.08,0.14,0.42), M(WOOD), 0.3,0.14,0,h);
    for (const x of [-0.25,0.25]) for (const z of [-0.12,0.12]) mk(G.cyl(0.04,0.04,0.3,6), M(WOOD), x,0.3,z,h);
    const body=mk(G.cap(0.15,0.45,6,10), M(0xf0e4d0), 0,0.56,0,h); body.rotation.z=Math.PI/2;
    const nk=mk(G.cyl(0.08,0.11,0.32,8), M(0xf0e4d0), 0.3,0.74,0,h); nk.rotation.z=-0.6; mk(G.box(0.3,0.14,0.14), M(0xf0e4d0), 0.47,0.86,0,h);
    mk(G.box(0.24,0.06,0.03), M(0x8a3a2a), 0.25,0.84,0,h); mk(G.box(0.2,0.04,0.3), M(0xc04a3a), -0.02,0.71,0,h); mk(G.cone(0.05,0.3,6), M(0x8a3a2a), -0.4,0.55,0,h).rotation.z=1.2;
    for (const z of [-0.07,0.07]) mk(G.sph(0.025,6,5), M(0x2a2420), 0.55,0.9,z,h);
    anim(g, t=>{ h.rotation.z=Math.sin(t*1.6)*0.08; }); },
  wagon(g){ mk(G.box(1.1,0.3,0.6), M(0xb84a3a), 0,0.48,0,g); mk(G.box(1.04,0.04,0.54), M(WOODL), 0,0.36,0,g);
    for (const x of [-0.38,0.38]) for (const z of [-0.34,0.34]){ const w=mk(G.cyl(0.18,0.18,0.06,16), M(DARK), x,0.18,z,g); w.rotation.x=Math.PI/2; const hub=mk(G.cyl(0.05,0.05,0.08,8), metal(IRON), x,0.18,z,g); hub.rotation.x=Math.PI/2; }
    const hd=mk(G.cyl(0.02,0.02,0.7,6), M(WOOD2), 0.85,0.4,0,g); hd.rotation.z=1.2; mk(G.box(0.04,0.04,0.24), M(WOOD2), 1.15,0.53,0,g);
    for (const [x,z,c] of [[-0.25,-0.1,0x5aa04a],[0.05,0.12,0xe8a040],[0.3,-0.08,0xe05a6a]]) mk(G.sph(0.14,10,8), M(c), x,0.66,z,g); },
  rolltop(g){ mk(G.box(1.2,0.08,0.6), M(WOOD), 0,0.76,0,g); for (const x of [-0.45,0.45]) mk(G.box(0.3,0.72,0.56), M(WOOD2), x,0.36,0,g);
    for (const x of [-0.45,0.45]) for (const y of [0.2,0.45,0.66]){ mk(G.box(0.24,0.16,0.02), M(WOOD), x,y,0.29,g); mk(G.sph(0.02,6,5), metal(BRASS), x,y,0.31,g); }
    mk(G.box(1.2,0.5,0.2), M(WOOD2), 0,1.05,-0.2,g); const top=mk(new THREE.CylinderGeometry(0.32,0.32,1.2,16,1,false,0,Math.PI/2), M(WOOD), 0,0.8,-0.08,g); top.rotation.z=Math.PI/2;
    for (const x of [-0.4,-0.2,0,0.2,0.4]) mk(G.box(0.14,0.14,0.14), M(DARK), x,0.88,-0.12,g);
    mk(G.box(0.26,0.02,0.2), M(0xf0e8d8), 0.1,0.81,0.1,g); mk(G.cyl(0.012,0.012,0.18,6), M(0x2a2a2a), 0.3,0.82,0.12,g).rotation.z=Math.PI/2; },
  pergola(g){ for (const x of [-0.95,0.95]) for (const z of [-0.95,0.95]) mk(G.box(0.14,2.2,0.14), M(WOODL), x,1.1,z,g);
    for (const z of [-0.95,0.95]) mk(G.box(2.3,0.14,0.12), M(WOOD), 0,2.2,z,g);
    for (let i=0;i<6;i++) mk(G.box(0.08,0.1,2.3), M(WOOD), -0.95+i*0.38,2.32,0,g);
    const leaf=M(0x5a9a4a,{ roughness:0.9 }), bloom=M(0xd070b0);
    for (let i=0;i<22;i++){ const a=i*2.4, x=Math.sin(a*1.7)*0.95, z=Math.cos(a)*0.9; mk(G.sph(0.18+(i%3)*0.04,8,6), leaf, x,2.4+(i%2)*0.06,z,g); if (i%3===0) mk(G.sph(0.06,6,5), bloom, x+0.08,2.5,z,g); }
    for (const [x,z] of [[-0.95,-0.95],[0.95,0.95]]) for (let k=0;k<5;k++) mk(G.sph(0.12,8,6), leaf, x+(k%2?0.08:-0.08),0.4+k*0.4,z+0.08,g); },
  musicbox(g){ mk(G.box(0.7,0.24,0.7), M(DARK), 0,0.12,0,g); mk(G.box(0.74,0.04,0.74), metal(BRASS), 0,0.26,0,g);
    const top=new THREE.Group(); top.position.y=0.28; g.add(top);
    mk(G.cyl(0.3,0.3,0.04,20), M(0xf0e0c8), 0,0.02,0,top); mk(G.cyl(0.02,0.02,0.6,8), metal(BRASS), 0,0.32,0,top); mk(G.cone(0.34,0.18,16), M(0xd05a6a), 0,0.68,0,top); mk(G.sph(0.04,8,6), metal(BRASS), 0,0.79,0,top);
    const horses=[]; for (let i=0;i<4;i++){ const a=i*Math.PI/2, x=Math.cos(a)*0.22, z=Math.sin(a)*0.22; mk(G.cyl(0.008,0.008,0.5,4), metal(BRASS), x,0.32,z,top);
      const h=mk(G.cap(0.04,0.08,4,8), M([0xffffff,0xf0d8a0,0xc8d8f0,0xf0c8d8][i]), x,0.22,z,top); h.rotation.z=Math.PI/2; h.rotation.y=-a; horses.push(h); }
    mk(G.sph(0.05,8,6), glowMat(0xffe0a0), 0,0.6,0,top);
    const key=mk(G.box(0.03,0.12,0.03), metal(BRASS), 0.37,0.14,0,g);
    anim(g, t=>{ top.rotation.y=t*0.7; horses.forEach((h,i)=>{ h.position.y=0.22+Math.sin(t*3+i*1.6)*0.04; }); key.rotation.x=t*2; }); },
  loom(g){ for (const x of [-0.6,0.6]){ mk(G.box(0.1,1.5,0.1), M(WOOD2), x,0.75,-0.3,g); mk(G.box(0.1,0.9,0.1), M(WOOD2), x,0.45,0.35,g); mk(G.box(0.08,0.08,0.75), M(WOOD), x,0.85,0.02,g); }
    for (const y of [1.45,0.85]) mk(G.box(1.3,0.08,0.08), M(WOOD), 0,y,-0.3,g);
    const cloth=mk(G.box(1.1,0.55,0.02), M(0x4a7ab8), 0,1.12,-0.3,g); for (let i=0;i<5;i++) mk(G.box(1.1,0.04,0.025), M([0xe8c040,0xd05a5a,0xf0f0e8][i%3]), 0,0.92+i*0.1,-0.3,g);
    const warp=M(0xf0ece0); for (let i=0;i<10;i++){ const s=mk(G.box(0.006,0.06,0.6), warp, -0.5+i*0.11,0.87,0.03,g); s.rotation.x=-0.05; }
    mk(G.box(1.25,0.06,0.3), M(WOODL), 0,0.55,0.4,g); const bar=mk(G.box(1.2,0.08,0.06), M(WOOD), 0,0.95,0.15,g);
    const sh=mk(G.cap(0.03,0.16,4,8), M(WOODL), 0.3,0.88,0.05,g); sh.rotation.z=Math.PI/2;
    anim(g, t=>{ bar.position.z=0.15+Math.sin(t*1.4)*0.05; sh.position.x=Math.sin(t*0.7)*0.45; }); },
  windmill(g){ mk(G.cyl(0.32,0.5,1.8,8), M(0xe8e0d0), 0,0.9,0,g); mk(G.cone(0.42,0.5,8), M(0xb84a3a), 0,2.05,0,g);
    mk(G.box(0.22,0.38,0.04), M(DARK), 0,0.2,0.47,g); for (const y of [0.9,1.4]) mk(G.box(0.16,0.16,0.04), M(0x9ac8e8), 0,y,0.38-0.04*(y-0.9),g);
    mk(G.cyl(0.05,0.05,0.3,8), metal(IRON), 0,1.8,0.42,g).rotation.x=Math.PI/2;
    const hub=new THREE.Group(); hub.position.set(0,1.8,0.58); g.add(hub);
    for (let i=0;i<4;i++){ const a=new THREE.Group(); a.rotation.z=i*Math.PI/2; hub.add(a); mk(G.box(0.05,0.85,0.03), M(WOOD2), 0,0.45,0,a); mk(G.box(0.22,0.6,0.015), M(0xf0e8d8), 0.12,0.55,0,a); }
    mk(G.sph(0.07,8,6), M(DARK), 0,0,0,hub);
    anim(g, (t,dt)=>{ hub.rotation.z-=(dt||0.016)*1.4; }); },
  gazebo(g){ const n=6, R=1.45; mk(G.cyl(R+0.1,R+0.15,0.16,n), M(0xc8c0b0), 0,0.08,0,g);
    for (let i=0;i<n;i++){ const a=i/n*Math.PI*2; mk(G.cyl(0.06,0.07,2.1,8), M(0xf4f0e8), Math.cos(a)*R,1.2,Math.sin(a)*R,g);
      if (i!==1){ const b=mk(G.box(R*1.02,0.06,0.06), M(0xf4f0e8), Math.cos(a+Math.PI/n)*R*0.87,0.75,Math.sin(a+Math.PI/n)*R*0.87,g); b.rotation.y=-(a+Math.PI/n)+Math.PI/2; } }
    mk(G.cone(R+0.35,0.9,n), M(0x6a8a9a), 0,2.7,0,g); mk(G.cyl(0.04,0.04,0.4,6), metal(BRASS), 0,3.3,0,g); mk(G.sph(0.08,8,6), metal(BRASS), 0,3.52,0,g);
    mk(G.cyl(0.45,0.45,0.05,16), M(WOODL), 0,0.62,0,g); mk(G.cyl(0.05,0.08,0.45,8), M(WOOD2), 0,0.38,0,g);
    const lamp=mk(G.sph(0.1,10,8), glowMat(0xffe0a0), 0,2.05,0,g); mk(G.cyl(0.008,0.008,0.2,4), metal(IRON), 0,2.2,0,g); lamp.castShadow=false; },
});

/* ---------- hooks for main.js ----------
   C: S(), tables() -> [[id, distance, size]] for crafting tables in reach, learnWood(id), toast, thumb, Snd, save */
export function createBenches(C){
  let devAny=0;   // #dev: act as if at this table tier everywhere
  const S=()=>C.S();
  const H = {
    isBench:id=>benchTierOf(id)>0,
    tier:()=>Math.max(devAny, bestBench(C.tables())),
    need:r=>benchFor(r),
    canHere:r=>benchFor(r)<=H.tier(),
    name:k=>BENCH_NAME[k],
    // a line under a plan you can't make here
    note:r=>{ const b=benchFor(r); return b>H.tier() ? `<br><b>Needs a ${BENCH_NAME[b]}</b>` : ''; },
    // the line at the top of the crafting panel
    banner(){ const t=H.tier(); if (t===0) return `<div class="notice"><b>No crafting table nearby.</b> <span class="muted">Out here you can repair your tools and make a few simple things. Stand at a crafting table for the rest.</span></div>`;
      return `<div class="muted" style="margin:-2px 0 8px">At your ${BENCH_NAME[t]}${t<3?'. A bigger table makes more.':''}</div>`; },
    toolBench, enchBench, TWIN_BENCH,
    // after making something: table plans, and the pieces a table you built teaches. Returns new plan ids.
    progress:()=>benchProgress(S(), id=>C.learnWood(id)),
    dev:{ NEW_BENCHES, BENCH_PIECES, FIELD, tier:()=>H.tier(), give(){ for (const id of BENCH_IDS) C.addItem(id); C.save(); },
      learn(){ for (const p of [...NEW_BENCHES, ...BENCH_PIECES]) C.learnWood(p.id); C.save(); },
      // #dev: unlock table tier k (1-3) as if you'd built your way there: its plan, every table below it, and their pieces
      unlock(k){ const S0=S(); if (!S0.craft) S0.craft={ made:0, kinds:[], known:[], ms:0 }; const K=S0.craft.kinds||(S0.craft.kinds=[]);
        for (const id of FIELD) C.learnWood(id);
        for (let t=1; t<=k; t++){ const id=BENCH_IDS[t-1]; C.learnWood(id); if (t<k && !K.includes(id)) K.push(id); }
        for (const p of BENCH_PIECES) if (p.bench<=k) C.learnWood(p.id); C.save(); return BENCH_IDS[k-1]; },
      // #dev: count as standing at table tier k anywhere (0 = back to normal). Not saved.
      anywhere(k){ devAny=k|0; return devAny; }, get any(){ return devAny; } },
  };
  return H;
}
