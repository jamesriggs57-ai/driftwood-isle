/* =====================================================================
   v1.40 CRAFTING TABLES: data and rules (no THREE, no DOM, so node tests can import it).
   Away from a crafting table you can only repair tools and make a few simple things.
   Three tables, each a step up:
     1 Workbench (Bramble's, as before): all the everyday woodworking, Sturdy tools, first enchantments
     2 Carpenter's Bench: showpieces from rare plans, Golden tools, middle enchantments, its own pieces
     3 Master Workbench: Heirloom tools, the strongest enchantments and the Twin Charm, its own pieces
   The bigger tables are woodworking plans you learn by making enough DIFFERENT things.
   Building a table teaches its own pieces. A table does everything the smaller ones do.
   ===================================================================== */
import { ITEMS, WOODWORK, RARE_WORK, def } from './content.js';

export const BENCH_IDS = ['workbench', 'carpbench', 'masterbench'];   // index+1 = tier
export const BENCH_NAME = ['away from a crafting table', 'Workbench', 'Carpenter\'s Bench', 'Master Workbench'];
export const benchTierOf = id => BENCH_IDS.indexOf(id) + 1;   // 0 = not a table
export const NEAR = 2.6;   // how close (beyond the table's own size) counts as "at" it

// What you can make anywhere: the simple things. Everything else in woodworking needs at least a Workbench.
export const FIELD = ['stool', 'fence', 'logpile', 'signpost', 'stumpstool', 'campfire', 'workbench'];

// The two new tables. plan = how many different things you've made before you work out how to build one.
export const NEW_BENCHES = [
  { id:'carpbench',   name:'Carpenter\'s Bench', buy:9000,  r:0.9, mats:{ wood:16, softwood:6, iron:4, stone:4 },        bench:1, kinds:12 },
  { id:'masterbench', name:'Master Workbench',   buy:24000, r:1.0, mats:{ wood:24, iron:10, plank:6, heartwood:1 },      bench:2, kinds:24, after:'carpbench' },
];
// The pieces each table teaches when you first build it (furniture you can only make there)
export const BENCH_PIECES = [
  { id:'rockinghorse', name:'Rocking Horse',       buy:3600,  r:0.55, mats:{ wood:8, softwood:4, weed:2 },          bench:2 },
  { id:'wagon',        name:'Garden Wagon',        buy:5200,  r:0.75, mats:{ wood:10, iron:3, stump:1 },            bench:2 },
  { id:'rolltop',      name:'Rolltop Desk',        buy:7000,  r:0.75, mats:{ wood:12, iron:2, clay:1 },             bench:2 },
  { id:'pergola',      name:'Vine Pergola',        buy:6000,  r:1.2,  mats:{ wood:12, softwood:8, weed:6 },         bench:2 },
  { id:'musicbox',     name:'Carousel Music Box',  buy:9000,  r:0.45, mats:{ wood:6, iron:4, plank:2 },             bench:3, glow:true },
  { id:'loom',         name:'Weaving Loom',        buy:12000, r:0.85, mats:{ wood:12, plank:4, softwood:6, weed:10 }, bench:3 },
  { id:'windmill',     name:'Garden Windmill',     buy:14000, r:0.7,  mats:{ wood:14, iron:4, plank:4 },            bench:3 },
  { id:'gazebo',       name:'Garden Gazebo',       buy:22000, r:1.6,  mats:{ wood:20, plank:8, iron:4, stone:6 },   bench:3 },
];

// items and recipes (same shape as furn() and WOODWORK in content.js; shop:'craft' keeps them out of every shop)
for (const p of [...NEW_BENCHES, ...BENCH_PIECES]){
  if (!ITEMS[p.id]) def(p.id, { name:p.name, kind:'furniture', buy:p.buy, price:Math.round(p.buy/4), r:p.r, shop:'craft', stack:p.id.endsWith('bench')?1:5, model:{ t:'furn', b:p.id }, ...(p.glow?{ glow:true }:{}) });
  if (!WOODWORK.some(r=>r.id===p.id)) WOODWORK.push({ id:p.id, mats:p.mats, bench:p.bench });
}
for (const r of WOODWORK) if (r.bench===undefined) r.bench = FIELD.includes(r.id) ? 0 : 1;
for (const r of RARE_WORK) if (r.bench===undefined) r.bench = 2;   // showpieces from rare plans
export const benchFor = r => r && r.bench!==undefined ? r.bench : 1;

// Tools: Flimsy anywhere, then one table step per tier. Repairs anywhere.
export const TOOL_BENCH = [0, 1, 2, 3];
export const toolBench = k => TOOL_BENCH[k] ?? 3;
// Enchanting: an enchantment's rank is the table it needs. The Twin Charm's binding needs the Master Workbench.
export const enchBench = rank => Math.max(1, Math.min(3, rank|0));
export const TWIN_BENCH = 3;

export const missingMat = (mats, have) => Object.entries(mats).filter(([m,n])=>have(m)<n);

/* Which table plans and table pieces you should know now. learn(id) adds a woodworking plan and says whether it was new. */
export function benchProgress(S, learn){
  const C=S.craft; if (!C) return [];
  const kinds=C.kinds||[], got=[];
  for (const b of NEW_BENCHES){
    if (kinds.length>=b.kinds && (!b.after || kinds.includes(b.after)) && learn(b.id)) got.push(b.id); }
  // a table you've built teaches its pieces
  for (const p of BENCH_PIECES) if (kinds.includes(BENCH_IDS[p.bench-1]) && learn(p.id)) got.push(p.id);
  return got; }

/* the best table within reach. tables = [[id, distance, size]] */
export function bestBench(tables){ let t=0; for (const [id,d,r] of tables){ const k=benchTierOf(id); if (k>t && d<=(r||0)+NEAR) t=k; } return t; }
