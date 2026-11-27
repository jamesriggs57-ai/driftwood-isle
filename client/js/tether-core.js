/* =====================================================================
   v1.76 CHESTS THAT FEED CRAFTING, AND SORTING: the rules, with no THREE and no DOM, so node tests can import them.

   A storage chest set down right beside a crafting spot (any crafting table, the Wood Stove, a campfire or the
   sewing machine) is tethered to it. While you stand at that spot, what's in its tethered chests counts as yours
   for crafting, cooking and sewing there, as if it were in your bag. Your bag is used up first, then the chests.
   Reach: a chest is tethered when the gap between its edge and the spot's edge is no more than the spot's own
   width (at least TETHER_MIN). One chest can feed several spots, and one spot can be fed by several chests.

   Sorting: groups a bag or a chest by what kind of thing it is (SORT_KINDS order), then by name, and tops up
   part stacks of the same thing so they take fewer slots. Things with their own details (a fish's size) stay as they are.
   ===================================================================== */
import { ITEMS } from './content.js';
import { BENCH_IDS, NEAR } from './benches-core.js';

export const STATIONS = [...BENCH_IDS, 'stove', 'campfire', 'sewmachine'];
export const isStation = id => STATIONS.includes(id);
export const isChest = id => !!(ITEMS[id] && ITEMS[id].store);
export const TETHER_MIN = 1.2;
const R = id => (ITEMS[id] && ITEMS[id].r) || 0.5;
export const tetherGap = id => Math.max(TETHER_MIN, 2*R(id));
// st and ch are { id, x, z }
export const tethers = (st, ch) => Math.hypot(st.x-ch.x, st.z-ch.z) - R(st.id) - R(ch.id) <= tetherGap(st.id) + 1e-6;
// standing "at" a crafting spot, the same reach the crafting tables use
export const atStation = (st, p) => Math.hypot(st.x-p.x, st.z-p.z) <= R(st.id) + NEAR;
// the chests that feed whatever crafting spots you're standing at. chests are { id, x, z, store }
export function feedChests(stations, chests, p){
  const near=stations.filter(s=>atStation(s,p)); if (!near.length) return [];
  return chests.filter(c=>Array.isArray(c.store) && near.some(s=>tethers(s,c))); }

// an entry matches an item id, or a kind of thing ('fish', 'fruit', 'berry') for recipes that take any of a kind
export const entryIs = (e, id) => !!e && (ITEMS[id] ? e.id===id : !!ITEMS[e.id] && ITEMS[e.id].kind===id);
export const poolCount = (stores, id) => stores.reduce((a,L)=>a+L.reduce((b,e)=>b+(entryIs(e,id) ? e.n : 0), 0), 0);
// take n of an id (or kind) out of chest stores, last stack first. Returns how many it couldn't find.
export function poolTake(stores, id, n){
  for (const L of stores){ for (let i=L.length-1; i>=0 && n>0; i--){ const e=L[i]; if (!entryIs(e,id)) continue; const k=Math.min(n, e.n); e.n-=k; n-=k; if (e.n<=0) L.splice(i,1); }
    if (n<=0) break; }
  return n; }

// ---------- sorting ----------
export const SORT_KINDS = ['material','seed','sapling','fruit','veg','herb','berry','flower','food','potion','fish','bug','shell','coral','fossil','furniture','gear','plan','relic','quest','ticket','note','wear'];
const kindRank = id => { const k=ITEMS[id] ? ITEMS[id].kind : ''; const i=SORT_KINDS.indexOf(k); return i<0 ? SORT_KINDS.length : i; };
const nameOf = id => ITEMS[id] ? ITEMS[id].name : id;
const plain = e => !e.m && Object.keys(e).every(k=>k==='id' || k==='n');
// returns a new list (the entries in it may be the old objects). Never more stacks than it started with.
export function sortStacks(list){
  const out=[];
  for (const e of list){ if (!e || !ITEMS[e.id]) { if (e) out.push(e); continue; }
    if (!plain(e)){ out.push(e); continue; }
    const st=ITEMS[e.id].stack||1; let n=e.n;
    for (const x of out){ if (n<=0) break; if (x.id===e.id && plain(x) && x.n<st){ const k=Math.min(n, st-x.n); x.n+=k; n-=k; } }
    while (n>0){ const k=Math.min(n, st); out.push({ id:e.id, n:k }); n-=k; } }
  const order=new Map(out.map((e,i)=>[e,i]));
  return out.sort((a,b)=>kindRank(a.id)-kindRank(b.id) || nameOf(a.id).localeCompare(nameOf(b.id)) || (a.id<b.id?-1:a.id>b.id?1:0) || (b.n-a.n) || order.get(a)-order.get(b)); }
// sort in place (keeps the same array, which the save points to)
export function sortInPlace(list){ const s=sortStacks(list); list.length=0; list.push(...s); return list; }
export const sameOrder = (a, b) => a.length===b.length && a.every((e,i)=>e.id===b[i].id && e.n===b[i].n && e.m===b[i].m);
