/* =====================================================================
   v1.40 TOOLS AND ENCHANTING
   Every tool can be repaired, crafted and enchanted.

   - Enchantments are learned like recipes. Pippa teaches the first charms, Wendell teaches the stronger ones,
     and scrolls turn up around the island the way plans do. Once you know one, you can put it on a tool any
     time you have the ingredients.
   - A tool holds one enchantment. The Twin Charm (Wendell, late game, once you know the strongest form of
     several enchantments) lets a tool hold two.
   - Strengths are never shown as numbers: only "slightly", "moderately" or "greatly increased ...".
   - A worn tool can be repaired anywhere (Tools tab) or by Pemberton for clams.
   - v1.50: a tool that breaks isn't gone. It waits in S.rare.broken with its tier and enchantments, and you can fix it
     at any crafting table for BROKEN_MULT full repairs' worth of materials. Getting a tool of that kind at the same or
     a better tier (bought or made) scraps the broken one.
   - Double Output, Triple Output and One-Swing never stack: they share one family, so a tool has at most one.

   Save shape (all inside keys that already exist, so nothing new to sync):
     S.tools[t].ench = ['lucky3', 'tough2']        // the enchantments on that tool, at most 2
     S.rare.broken = { rod:{ tier:2, ench:['lucky2'] } }   // v1.50: tools that broke, waiting to be fixed
     S.rare.ench = { v:1, known:[...ids], twin:false, applied:0, lessons:{ pippa:0 }, lastLesson:'' }

   This file is data and pure logic only (no DOM, no THREE), so it runs in node for tests.
   enchant.js has the menus, the teachers and the hooks main.js calls. Every number that matters is in this file.
   ===================================================================== */
import { ITEMS, TOOLS, def } from './content.js';

/* ---------- Families and strengths ----------
   A family is one kind of effect. Each enchantment is one strength (rank 1 to 3) of a family.
   tools: which tools a family can go on. 'all' = every tool. */
const ALL = ['axe','shovel','net','rod','can'];
export const FAMILIES = {
  tough:  { tools:ALL,                         what:'durability' },
  bonk:   { tools:ALL,                         what:'bonk power' },
  lucky:  { tools:['axe','shovel','net','rod'], what:{ axe:'chance of rare finds', shovel:'chance of rare finds', net:'chance of rare bugs', rod:'chance of rare fish' } },
  output: { tools:['axe','shovel'],             what:'output' },
  sure:   { tools:['net','rod'],                what:{ net:'stealth around bugs', rod:'pull on nearby fish' } },
  big:    { tools:['net','rod'],                what:'chance of big catches' },
  spray:  { tools:['can'],                      what:'watering spread' },
};
export const WORDS = ['', 'Slightly', 'Moderately', 'Greatly'];

/* Each enchantment. need = ingredients used up each time you put it on a tool.
   learn = where it can be learned: 'pippa', 'wendell' (with price and conditions), and every one but Twin can be a scroll. */
export const ENCH = {
  tough1:  { fam:'tough',  rank:1, name:'Tough',        need:[['stone',4],['iron',1]],                         learn:'pippa' },
  tough2:  { fam:'tough',  rank:2, name:'Tougher',      need:[['iron',3],['clay',2],['plank',1]],              learn:'wendell', price:25000 },
  tough3:  { fam:'tough',  rank:3, name:'Ultratough',   need:[['iron',4],['fitting',2],['starstone',1]],       learn:'wendell', price:80000 },
  bonk1:   { fam:'bonk',   rank:1, name:'Bonk',         need:[['softwood',5],['clay',2]],                      learn:'pippa' },
  bonk2:   { fam:'bonk',   rank:2, name:'Big Bonk',     need:[['softwood',8],['honey',2],['plank',1]],         learn:'wendell', price:20000 },
  bonk3:   { fam:'bonk',   rank:3, name:'Ultrabonk',    need:[['plank',2],['honey',3],['goldsap',1]],          learn:'wendell', price:60000 },
  lucky1:  { fam:'lucky',  rank:1, name:'Lucky',        need:[['weed',6],['clay',2],['honey',1]],              learn:'pippa' },
  lucky2:  { fam:'lucky',  rank:2, name:'Luckier',      need:[['honey',2],['clay',3],['moonpearl',1]],         learn:'wendell', price:30000 },
  lucky3:  { fam:'lucky',  rank:3, name:'Luckiest',     need:[['moonpearl',2],['starstone',1],['goldsap',1]],  learn:'wendell', price:100000 },
  sure1:   { fam:'sure',   rank:1, name:'Steady',       need:[['softwood',4],['weed',8]],                      learn:'pippa', later:true },
  sure2:   { fam:'sure',   rank:2, name:'Sure',         need:[['softwood',6],['honey',2],['plank',1]],         learn:'wendell', price:25000 },
  sure3:   { fam:'sure',   rank:3, name:'Sure Catch',   need:[['honey',2],['moonpearl',1],['glimmermoss',2]],  learn:'wendell', price:80000 },
  big1:    { fam:'big',    rank:1, name:'Hefty',        need:[['iron',2],['clay',3]],                          learn:'pippa', later:true },
  big2:    { fam:'big',    rank:2, name:'Trophy',       need:[['iron',4],['honey',1],['fitting',1]],           learn:'wendell', price:25000 },
  big3:    { fam:'big',    rank:3, name:'Big Game',     need:[['fitting',2],['moonpearl',1],['heartwood',1]],  learn:'wendell', price:80000 },
  spray1:  { fam:'spray',  rank:1, name:'Splash',       need:[['clay',3],['stone',2]],                         learn:'pippa', later:true },
  spray2:  { fam:'spray',  rank:2, name:'Shower',       need:[['clay',5],['iron',2]],                          learn:'wendell', price:15000 },
  spray3:  { fam:'spray',  rank:3, name:'Downpour',     need:[['clay',6],['fitting',1],['glimmermoss',1]],     learn:'wendell', price:50000 },
  double:  { fam:'output', rank:2, name:'Double Output',need:[['wood',20],['iron',4],['heartwood',1]],         learn:'wendell', price:40000 },
  triple:  { fam:'output', rank:3, name:'Triple Output',need:[['heartwood',3],['starstone',2],['fitting',3]],   learn:'wendell', price:150000, late:true },
  oneswing:{ fam:'output', rank:3, name:'One-Swing',    need:[['heartwood',2],['starstone',2],['goldsap',2],['fitting',2]], learn:'wendell', price:150000, late:true },
};
for (const [id,e] of Object.entries(ENCH)) e.id=id;
// The Twin Charm isn't put on a tool. Knowing it lets a tool hold a second enchantment; the second one costs this on top.
export const TWIN = { id:'twin', name:'Twin Charm', price:300000, bind:[['starstone',1],['goldsap',1]], needRank3:3, needApplied:25 };
export const TWIN_SLOTS = 2;

/* ---------- Strengths (hidden from the player) ----------
   These are the only numbers. Change them here. */
export const POWER = {
  tough:  [1, 1.25, 1.5, 2],          // durability multiplier (Ultratough = double, as asked)
  bonk:   [1, 1.25, 1.5, 2],          // how far a bonk sends someone, multiplier on distance (Ultrabonk = twice as far)
  lucky:  [1, 1.5, 2, 3],             // odds of rare-or-better finds (Luckiest = x3)
  output: { double:2, triple:3 },     // drops per action. One-Swing: a tree falls in one chop and drops ONE_SWING_WOOD wood; a rock gives everything at once
  sure:   [                            // net: bugs flee less, catch bar wider, tap catch better. rod: fish notice the bobber from farther, want it more, scare less, give a longer bite
    { flee:1,    zone:1,    tap:0,    notice:1,    want:0,    scare:1,    lose:1,    win:0 },
    { flee:0.75, zone:1.15, tap:0.04, notice:1.15, want:0.05, scare:0.75, lose:0.75, win:0.06 },
    { flee:0.5,  zone:1.3,  tap:0.08, notice:1.3,  want:0.1,  scare:0.5,  lose:0.5,  win:0.12 },
    { flee:0.25, zone:1.5,  tap:0.13, notice:1.5,  want:0.18, scare:0.2,  lose:0.25, win:0.2 } ],
  big:    [ { pow:1.7, top:0.05 }, { pow:1.5, top:0.1 }, { pow:1.3, top:0.16 }, { pow:1.0, top:0.25 } ],   // size roll: f=r^pow, chance of a top-size one
  spray:  [0, 1.7, 2.6, 3.6],         // also waters dry plants within this many metres
};
export const ONE_SWING_WOOD = 6;
// rarity weights under this count as "rare or better" (content.js: Rare starts at 3 > w >= 1.5)
const RARE_W = 3;

/* ---------- Learning: Pippa, Wendell, scrolls ---------- */
export const PIPPA = { friend:6, later:{ friend:10, applied:3 } };   // first lesson at friendship 6; second (sure, big, spray) at 10 after 3 enchantments put on
// Wendell's conditions per strength: rank 2 needs rank 1 of that family known; rank 3 needs rank 2 known and this many enchantments put on in all
export const WENDELL = { rank3Applied:8, doubleApplied:3, lateApplied:15 };
// scroll drop chances per action (Guests never get them). Roughly: one per 250 digs, rarer from felling and catches.
export const SCROLL_ODDS = { dig:0.004, fell:0.003, catch:0.0015, bottle:0.004, peddler:0.05 };
export const SCROLL_PRICE = id => Math.round((ENCH[id].price || 6000)*0.15/100)*100;   // what Pemberton pays for a spare scroll
// Fennick now and then has a scroll on his cart (SCROLL_ODDS.peddler per visit). Only ones Wendell teaches, at a discount on Wendell's fee,
// since a scroll also skips Wendell's conditions. About one Fennick visit in 20; he comes every 3 or 4 days.
export const FENNICK_SCROLL_SHARE = 0.6;
export const FENNICK_SCROLL_PRICE = id => Math.round((ENCH[id].price||0)*FENNICK_SCROLL_SHARE/1000)*1000;

/* ---------- Repair and crafting ---------- */
// Materials for a full repair by tier (scaled by how worn the tool is). The can's tiers are 0 basic, 1 golden.
export const REPAIR = {
  0: [['wood',2],['softwood',2]],
  1: [['wood',3],['iron',1]],
  2: [['iron',4],['stone',4]],
};
const canTier = (t,k) => t==='can' && k>=1 ? k+1 : k;   // map the can's tiers onto the others' (it skips Sturdy)
export const REPAIR_CLAMS = 0.45;   // Pemberton's full repair costs this share of the tool's price
export const BROKEN_MULT = 2;       // v1.50: fixing a broken tool costs twice a full repair (Flimsy: 4 wood, 4 branches; Sturdy: 6 wood, 2 iron; Golden: 8 iron, 8 stone)
export const FIX_BENCH = 1;         // and needs a crafting table (any: Workbench or bigger)
// Crafting a tool from materials. Same requirements as buying it (reqMet). Heirloom tools are a long haul on purpose.
export const CRAFT = {
  net:    [ [['softwood',4],['weed',6]], [['wood',4],['softwood',3],['iron',2]], [['iron',6],['fitting',2],['goldsap',1]], [['heartwood',3],['starstone',3],['goldsap',3],['moonpearl',3],['glimmermoss',3],['fitting',4]] ],
  rod:    [ [['softwood',4],['weed',4]], [['wood',4],['softwood',3],['iron',2]], [['iron',6],['fitting',2],['goldsap',1]], [['heartwood',3],['starstone',3],['goldsap',3],['moonpearl',3],['glimmermoss',3],['fitting',4]] ],
  shovel: [ [['wood',3],['stone',2]],    [['wood',4],['iron',3]],                [['iron',6],['fitting',2],['goldsap',1]], [['heartwood',3],['starstone',3],['goldsap',3],['moonpearl',3],['glimmermoss',3],['fitting',4]] ],
  axe:    [ [['wood',3],['stone',3]],    [['wood',5],['iron',3]],                [['iron',6],['fitting',2],['goldsap',1]], [['heartwood',3],['starstone',3],['goldsap',3],['moonpearl',3],['glimmermoss',3],['fitting',4]] ],
  can:    [ [['clay',4],['iron',1]],                                             [['iron',6],['fitting',2],['goldsap',1]], [['heartwood',3],['starstone',3],['goldsap',3],['moonpearl',3],['glimmermoss',3],['fitting',4]] ],
};

/* ---------- Scroll items (one per enchantment, learned the moment you pick it up, like plans) ---------- */
const SCROLL_RARITY = { 1:1.8, 2:1, 3:0.5 };
for (const [id,e] of Object.entries(ENCH)){
  def('escroll_'+id, { name:'Enchanting Scroll: '+e.name, kind:'plan', ench:id, learns:null, price:SCROLL_PRICE(id), rarity:SCROLL_RARITY[e.rank], stack:1, noGift:true, model:{ t:'escroll', fam:e.fam, rank:e.rank } });
}

/* =====================================================================
   PURE LOGIC: works on a save object. No DOM, no THREE scene, so tests can run it in node.
   ===================================================================== */
export function migrate(S){
  if (!S.rare) S.rare={ plans:[], made:0 };
  const E=S.rare.ench || (S.rare.ench={});
  if (!E.v){ E.v=1; }
  if (!Array.isArray(E.known)) E.known=[];
  E.known=E.known.filter(id=>ENCH[id]);
  if (typeof E.twin!=='boolean') E.twin=false;
  if (!(E.applied>=0)) E.applied=0;
  if (!E.lessons || typeof E.lessons!=='object') E.lessons={};
  for (const t of Object.keys(S.tools||{})){ const T=S.tools[t]; if (!T) continue;
    if (T.ench!==undefined){ if (!Array.isArray(T.ench)) delete T.ench; else { T.ench=T.ench.filter(id=>ENCH[id] && fits(id,t)).slice(0, TWIN_SLOTS); if (!T.ench.length) delete T.ench; } } }
  // v1.50 broken tools: drop anything that doesn't make sense (unknown tool, bad tier, an heirloom, or a broken one no better than the one you hold)
  if (S.rare.broken!==undefined && (!S.rare.broken || typeof S.rare.broken!=='object' || Array.isArray(S.rare.broken))) delete S.rare.broken;
  for (const [t,B] of Object.entries(S.rare.broken||{})){ const tr=TOOLS[t] && B && TOOLS[t].tiers[B.tier], own=S.tools && S.tools[t];
    if (!tr || tr.forever || (own && own.tier>=B.tier)){ delete S.rare.broken[t]; continue; }
    if (B.ench!==undefined){ if (!Array.isArray(B.ench)) delete B.ench; else { B.ench=B.ench.filter(id=>ENCH[id] && fits(id,t)).slice(0, TWIN_SLOTS); if (!B.ench.length) delete B.ench; } } }
  return E;
}
export const fits = (id, t) => { const e=ENCH[id], F=e && FAMILIES[e.fam]; return !!(F && F.tools.includes(t)); };
export const knows = (S, id) => id==='twin' ? !!S.rare.ench.twin : S.rare.ench.known.includes(id);
export const enchOf = (S, t) => (S.tools[t] && S.tools[t].ench) || [];
export const slotsOf = S => S.rare.ench.twin ? TWIN_SLOTS : 1;
export const isForeverTool = (S, t) => { const T=S.tools[t]; return !!(T && TOOLS[t].tiers[T.tier] && TOOLS[t].tiers[T.tier].forever); };
// the strength of a family on a tool (0 if none)
export function rankOn(S, t, fam){ let r=0; for (const id of enchOf(S,t)){ const e=ENCH[id]; if (e.fam===fam && e.rank>r) r=e.rank; } return r; }
export const hasEnch = (S, t, id) => enchOf(S,t).includes(id);

export function describe(id, t){
  const e=ENCH[id]; if (!e) return ''; const F=FAMILIES[e.fam];
  if (id==='oneswing') return t==='shovel' ? 'Breaks a rock open in a single swing' : t==='axe' ? 'Fells a whole tree in a single chop' : 'Fells a tree in one chop, or breaks a rock open in one swing';
  const what = typeof F.what==='string' ? F.what : (t ? F.what[t] : Object.values(F.what)[0]);
  return `${WORDS[e.rank]} increased ${what}`;
}
// for the list of what an enchantment can go on
export const toolsText = id => FAMILIES[ENCH[id].fam].tools.length===ALL.length ? 'Any tool' : FAMILIES[ENCH[id].fam].tools.map(t=>TOOLS[t].name+'s').join(', ').replace(/, ([^,]*)$/, ' and $1');

export function baseUses(S, t){ const T=S.tools[t]; if (!T) return 0; const d=TOOLS[t].tiers[T.tier]; return d.forever ? 0 : d.uses; }
export function maxUses(S, t){ const b=baseUses(S,t); return Math.round(b*POWER.tough[rankOn(S,t,'tough')]); }

/* Can this enchantment go on this tool right now? replaceId (optional): which one comes off when the tool is full.
   Returns { ok, why, need, replace, bind, miss }. replace = what comes off. bind = the Twin Charm's binding, charged whenever
   the tool ends up holding two enchantments (a second one, or a swap on a tool that already holds two). */
export function canApply(S, t, id, inv, replaceId){
  const e=ENCH[id], T=S.tools[t]; if (!e) return { ok:false, why:'Unknown enchantment.' };
  if (!T) return { ok:false, why:`You don't have ${TOOLS[t] ? 'a '+TOOLS[t].name.toLowerCase() : 'that tool'}.` };
  if (!fits(id,t)) return { ok:false, why:`${e.name} doesn't work on ${TOOLS[t].name.toLowerCase()}s.` };
  if (!knows(S,id)) return { ok:false, why:`You haven't learned ${e.name} yet.` };
  if (e.fam==='tough' && isForeverTool(S,t)) return { ok:false, why:'An heirloom tool never wears out. It doesn\'t need that.' };
  const cur=enchOf(S,t); if (cur.includes(id)) return { ok:false, why:'It already has that.' };
  const same=cur.find(x=>ENCH[x].fam===e.fam);   // same family (a stronger or different variant): it takes that one's place
  const replace = same || (cur.length>=slotsOf(S) ? (replaceId && cur.includes(replaceId) ? replaceId : cur[cur.length-1]) : null);
  const endsWith = cur.length - (replace?1:0) + 1, bind = endsWith>=2 ? TWIN.bind : null;
  const need=needFor(id, bind), miss=missing(need, inv);
  if (miss.length) return { ok:false, why:'Missing '+miss.map(([m,n])=>`${n} ${ITEMS[m]?ITEMS[m].name:m}`).join(', '), need, replace, bind, miss };
  return { ok:true, need, replace, bind };
}
export const needFor = (id, bind) => { const out={}; for (const [m,n] of ENCH[id].need.concat(bind||[])) out[m]=(out[m]||0)+n; return Object.entries(out); };
export const missing = (need, inv) => need.filter(([m,n])=>inv.count(m)<n).map(([m,n])=>[m, n-inv.count(m)]);
// keep the tool's worn share when its max changes
function rescale(T, before, after){ if (before>0 && after>0 && after!==before) T.uses=Math.max(1, Math.min(after, Math.round(T.uses*after/before))); }

/* Put it on. Uses up the ingredients and counts toward Wendell's lessons. */
export function apply(S, t, id, inv, replaceId){
  const c=canApply(S,t,id,inv,replaceId); if (!c.ok) return c;
  const T=S.tools[t], before=maxUses(S,t), cur=enchOf(S,t).filter(x=>x!==c.replace);
  for (const [m,n] of c.need) inv.take(m,n);
  cur.push(id); T.ench=cur; rescale(T, before, maxUses(S,t));
  S.rare.ench.applied++;
  return { ok:true, removed:c.replace||null };
}
export function remove(S, t, id){ const T=S.tools[t]; if (!T || !T.ench || !T.ench.includes(id)) return false; const before=maxUses(S,t); T.ench=T.ench.filter(x=>x!==id); if (!T.ench.length) delete T.ench; rescale(T, before, maxUses(S,t)); return true; }

export function learn(S, id){
  if (id==='twin'){ if (S.rare.ench.twin) return false; S.rare.ench.twin=true; return true; }
  if (!ENCH[id] || knows(S,id)) return false; S.rare.ench.known.push(id); return true; }

/* Repair: worn share of the full cost, at least 1 of each material. */
export function wornShare(S, t){ const mx=maxUses(S,t); if (!mx) return 0; return Math.max(0, Math.min(1, 1-S.tools[t].uses/mx)); }
export function repairNeed(S, t){ const T=S.tools[t]; if (!T || isForeverTool(S,t)) return null; const w=wornShare(S,t); if (w<=0) return null;
  return REPAIR[canTier(t,T.tier)].map(([m,n])=>[m, Math.max(1, Math.ceil(n*w))]); }
export function repairClams(S, t){ const T=S.tools[t]; if (!T || isForeverTool(S,t)) return 0; const w=wornShare(S,t); if (w<=0) return 0;
  return Math.max(50, Math.round(TOOLS[t].tiers[T.tier].cost*REPAIR_CLAMS*w*(1+0.25*enchOf(S,t).length)/10)*10); }   // enchanted tools cost a bit more to fix
export function repair(S, t, inv){ const need=repairNeed(S,t); if (!need) return { ok:false, why:'It doesn\'t need fixing.' }; const miss=missing(need, inv); if (miss.length) return { ok:false, why:'Missing materials.', miss };
  for (const [m,n] of need) inv.take(m,n); S.tools[t].uses=maxUses(S,t); return { ok:true }; }
export function repairForClams(S, t, pay){ const c=repairClams(S,t); if (!c) return { ok:false, why:'It doesn\'t need fixing.' }; if (!pay(c)) return { ok:false, why:'Not enough clams.' }; S.tools[t].uses=maxUses(S,t); return { ok:true, cost:c }; }

/* v1.50: broken tools. breakTool runs when a tool's last use is spent: the tool leaves your hands but keeps its tier
   and enchantments in S.rare.broken until you fix it at a crafting table. Fixing puts it back in your hands, good as new.
   If you're holding a stand-in of that kind (say a Flimsy Rod you bought after your Golden Rod broke), the fixed one
   takes its place, and anything on the stand-in is lost (the Tools tab asks first). */
export const brokenOf = (S, t) => (S.rare && S.rare.broken && S.rare.broken[t]) || null;
export const brokenList = S => Object.keys(TOOLS).filter(t=>brokenOf(S,t));
export function breakTool(S, t){ const T=S.tools[t]; if (!T) return null; delete S.tools[t];
  if (TOOLS[t].tiers[T.tier] && TOOLS[t].tiers[T.tier].forever) return null;
  const B=(S.rare.broken=S.rare.broken||{}); B[t]={ tier:T.tier }; if (T.ench && T.ench.length) B[t].ench=T.ench.slice(); return B[t]; }
export const fixNeed = (t, k) => REPAIR[canTier(t,k)].map(([m,n])=>[m, n*BROKEN_MULT]);
// bench = the best crafting table in reach (0 none, 1 to 3)
export function canFix(S, t, inv, bench){ const B=brokenOf(S,t); if (!B) return { ok:false, why:'Nothing to fix.' };
  const need=fixNeed(t,B.tier), own=S.tools[t], lose=own && own.ench && own.ench.length ? own.ench.filter(id=>!(B.ench||[]).includes(id)) : [];
  const base={ need, replaces:own ? own.tier : null, loses:lose.length ? lose : null };
  if ((bench|0)<FIX_BENCH) return { ok:false, why:'Needs a crafting table.', ...base };
  const miss=missing(need, inv); if (miss.length) return { ok:false, why:'Missing materials.', miss, ...base };
  return { ok:true, ...base }; }
export function fix(S, t, inv, bench){ const c=canFix(S,t,inv,bench); if (!c.ok) return c; const B=brokenOf(S,t);
  for (const [m,n] of c.need) inv.take(m,n);
  S.tools[t]={ tier:B.tier, uses:0 }; const keep=(B.ench||[]).filter(id=>ENCH[id] && fits(id,t)); if (keep.length) S.tools[t].ench=keep;
  S.tools[t].uses=maxUses(S,t); delete S.rare.broken[t]; return { ok:true, replaced:c.replaces, lost:c.loses }; }

/* A new tool of the same kind (bought or made) takes the old one's enchantments with it. Only a broken tool loses them.
   The one exception: Tough can't sit on an heirloom (it never wears out), so it comes off. Returns what came off. */
export function carryDrops(S, t, k){ const old=S.tools[t], d=TOOLS[t].tiers[k]||{}; return (old && old.ench || []).filter(id=>ENCH[id] && (!fits(id,t) || (ENCH[id].fam==='tough' && d.forever))); }
export function upgradeTool(S, t, k){
  const old=S.tools[t], d=TOOLS[t].tiers[k], drop=carryDrops(S,t,k), keep=(old && old.ench || []).filter(id=>ENCH[id] && !drop.includes(id));
  S.tools[t]={ tier:k, uses:0 }; if (keep.length) S.tools[t].ench=keep; S.tools[t].uses = d.forever ? 0 : maxUses(S,t);
  const B=brokenOf(S,t); if (B && B.tier<=k) delete S.rare.broken[t];   // v1.50: a tool as good or better scraps the broken one
  return drop; }
// v1.50: what getting tier k of tool t would scrap: the broken one, if it's no better (null if nothing, or nothing on it worth a warning)
export function scrapsBroken(S, t, k){ const B=brokenOf(S,t); return B && B.tier<=k ? B : null; }

/* Craft: same requirements as buying (pass reqMet). You can't craft a tool you already have at that tier or better. */
export function craftNeed(t, k){ return (CRAFT[t]||[])[k] || null; }
export function canCraft(S, t, k, inv, reqMet){
  const tr=TOOLS[t] && TOOLS[t].tiers[k], need=craftNeed(t,k); if (!tr || !need) return { ok:false, why:'No recipe.' };
  const own=S.tools[t]; if (own && own.tier>=k) return { ok:false, why: own.tier===k ? 'You already have one.' : 'You already have a better one.' };
  if (!reqMet(t,k)) return { ok:false, why:tr.req ? tr.req.desc : 'Not yet.' };
  const miss=missing(need, inv); if (miss.length) return { ok:false, why:'Missing materials.', miss, need };
  const d=carryDrops(S,t,k); return { ok:true, need, loses:d.length ? d : null };
}
export function craft(S, t, k, inv, reqMet){
  const c=canCraft(S,t,k,inv,reqMet); if (!c.ok) return c; const tr=TOOLS[t].tiers[k];
  for (const [m,n] of c.need) inv.take(m,n);
  const lost=upgradeTool(S,t,k); S.toolEver[t]=Math.max(S.toolEver[t]??-1, k); S.toolOffer[t]=Math.max(S.toolOffer[t]??-1, k);
  S.stats.toolsMade=(S.stats.toolsMade||0)+1; return { ok:true, lost:lost.length ? lost : null };
}

/* What a teacher can teach right now. kind 'pippa' or 'wendell'. Returns [{ id, price }]. */
export function teachable(S, who, friend=0){
  const E=S.rare.ench, out=[];
  if (who==='pippa'){
    if (friend<PIPPA.friend) return out;
    const late = friend>=PIPPA.later.friend && E.applied>=PIPPA.later.applied;
    for (const e of Object.values(ENCH)) if (e.learn==='pippa' && (!e.later || late) && !knows(S,e.id)) out.push({ id:e.id, price:0 });
    return out; }
  if (who==='wendell'){
    for (const e of Object.values(ENCH)){ if (e.learn!=='wendell' || knows(S,e.id)) continue;
      if (e.fam==='output'){ if (e.id==='double' ? E.applied>=WENDELL.doubleApplied : (knows(S,'double') && E.applied>=WENDELL.lateApplied)) out.push({ id:e.id, price:e.price }); continue; }
      const prev=Object.values(ENCH).find(x=>x.fam===e.fam && x.rank===e.rank-1);
      if (prev && !knows(S,prev.id)) continue;
      if (e.rank===3 && E.applied<WENDELL.rank3Applied) continue;
      out.push({ id:e.id, price:e.price }); }
    if (!E.twin && rank3Known(S)>=TWIN.needRank3 && E.applied>=TWIN.needApplied) out.push({ id:'twin', price:TWIN.price });
    return out; }
  return out;
}
// how many families you know the strongest form of (Triple Output and One-Swing both count for output, once)
export function rank3Known(S){ const f=new Set(); for (const id of S.rare.ench.known){ const e=ENCH[id]; if (e && e.rank===3) f.add(e.fam); } return f.size; }
// a scroll for something you don't know yet; rarer for stronger ones
export function scrollPick(S, r=Math.random, only=null){
  const pool=Object.values(ENCH).filter(e=>!knows(S,e.id) && (!only || only(e))); if (!pool.length) return null;
  const w=e=>[0,6,3,1][e.rank]*(e.late?0.5:1); const tot=pool.reduce((a,e)=>a+w(e),0); let x=r()*tot;
  for (const e of pool){ x-=w(e); if (x<=0) return 'escroll_'+e.id; } return 'escroll_'+pool[pool.length-1].id; }

/* ---------- Effects (what the game asks while you play) ---------- */
const owned = (S,t) => !!S.tools[t];
export const outputOf = (S, t) => { for (const id of enchOf(S,t)){ if (POWER.output[id]) return POWER.output[id]; } return 1; };
export const oneSwing = (S, t) => hasEnch(S, t, 'oneswing');
export const luckOf = (S, t) => POWER.lucky[rankOn(S,t,'lucky')];
export const bonkPower = (S, t) => t && owned(S,t) ? Math.sqrt(POWER.bonk[rankOn(S,t,'bonk')]) : 1;   // launch speed; flight distance grows with its square
export const sureOf = (S, t) => POWER.sure[rankOn(S,t,'sure')];
export const bigOf = (S, t) => POWER.big[rankOn(S,t,'big')];
export const sprayOf = (S, t='can') => POWER.spray[rankOn(S,t,'spray')];
// which tool's luck counts for a luck key / rare roll
export const LUCK_TOOL = { fish:'rod', bug:'net', dig:'shovel' };
export const RARE_TOOL = { chop:'axe', fell:'axe', stump:'shovel', digPlan:'shovel', catch:'rod' };   // rock / rockNight: whatever you hit it with
export function luckFor(S, key, equip){ const t = key==='rock'||key==='rockNight' ? (equip==='axe'?'axe':'shovel') : (LUCK_TOOL[key]||RARE_TOOL[key]); return t && owned(S,t) ? luckOf(S,t) : 1; }
// size roll for a catch (same shape as main.js rollStats); kind 'fish' uses the rod, 'bug' the net
export function bigRoll(S, kind, r=Math.random){ const B=bigOf(S, kind==='fish'?'rod':'net'); let f=Math.pow(r(), B.pow); if (r()<B.top) f=0.88+r()*0.12; return f; }

// Wide watering: other dry plants near the one you watered (a watered plant has p.watered === day). One use of the can covers them all.
export function sprayTargets(S, rec, day){ const R=sprayOf(S); if (!R || !S.plants) return [];
  return S.plants.filter(p=>p!==rec && p.watered!==day && Math.hypot(p.x-rec.x, p.z-rec.z)<=R); }
