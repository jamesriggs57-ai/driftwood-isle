// v1.21 museum: a real museum hall. Aquarium tanks down the left wall, insect terrariums down the right,
// fossils on lit pedestals and in glass cases at the back and beach finds in a glass case near the door.
// v1.68: tanks are shared (up to 20 specimens from several groups) and the hall only grows when something is full.
// Clicking a tank opens a fullscreen view of it (buildTankView).
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { ITEMS } from './content.js';
import { M, MF, mk, G, buildItemModel, FURN_BUILDERS } from './models.js';
import { woodMat, glassMat, brass } from './look.js';

/* ---------- Groups ---------- */
const GROUPS0 = {
  fish:[
    { id:'pond',  name:'Pond & Marsh',      theme:'pond',  ids:['tadpole','bluegill','crayfish','killifish','goldfish','turtle','mooncarp','koi'] },
    { id:'river', name:'River Run',         theme:'river', ids:['dace','loach','carp','smelt','trout','darter','catfish','salmon','pike','char'] },
    { id:'coast', name:'Coastal Shallows',  theme:'coast', ids:['minnow','silverbream','sardine','mackerel','flounder','snapper','cod'] },
    { id:'bay',   name:'Cay Bay Reef',      theme:'ocean', ids:['wrasse','goby','blenny','bannerfin','velvetray','parrotfish','grouper','goldseahorse','cardinal','flashlight'] },
    // v1.52 wave 1 (before the last tank, which keeps catching anything without a group)
    { id:'shallows', name:'Sandy Shallows',  theme:'coast', ids:['needlefish','gardeneel','sole','flyingfish','searobin','boxfish','cuttlefish','mantisshrimp'] },
    { id:'wonders',  name:'Reef Wonders',    theme:'ocean', ids:['butterflyfish','lionfish','triggerfish','mandarin','lobster','pinecone','unicornfish','humphead','seadragon','whaleshark'] },
    { id:'rapids',   name:'Rapids & Riverbed', theme:'river', ids:['sculpin','hatchetfish','mudskipper','lamprey','piranha','grayling','paddlefish','arowana','sturgeon'] },
    { id:'lily',     name:'Lily Pool',       theme:'pond',  ids:['frog','stickleback','glassfish','angelfish','betta','elephantnose','lungfish','axolotl'] },
    { id:'faraway',  name:'Isles & Far Shores', theme:'coast', ids:['batfish','moray','stargazer','ratfish','lumpsucker','wolffish','blindfish','coelacanth','foureyes','icefish','bichir'] },
    { id:'deep',     name:'The Deep',        theme:'ocean', ids:['angler','frilledshark','oarfish','swordfish','hammerhead','viperfish','gulper','barreleye'] },
    { id:'ocean', name:'Reef & Open Ocean', theme:'ocean', ids:['coraldart','puffer','seahorse','octopus','squid','eel','lanternfish','barrel','ray','sunfish','shark'] } ],
  bug:[
    { id:'butterfly', name:'Butterfly Garden',    theme:'meadow', ids:['sunwing','ember','bluebell','peacock','swallowtail','wanderer','leafdancer','rainwing'] },
    { id:'garden',    name:'Garden & Pond',       theme:'garden', ids:['bee','bumblebee','ladybug','mantis','orchidmantis','dragonfly','damselfly','skater','snail'] },
    { id:'wood',      name:'Woodland & Shore',    theme:'wood',   ids:['cicada','barkbeetle','treecricket','walkingstick','stag','rhino','grasshopper','cricket','pillbug','fiddler','hermit','sandhopper'] },
    // v1.52 wave 1
    { id:'wings2',   name:'Butterfly House',     theme:'meadow', ids:['skipper','comma','hairstreak','longwing','glasswing','morpho','birdwing'] },
    { id:'flyers',   name:'Flies, Wasps & Lacewings', theme:'garden', ids:['cranefly','hoverfly','mayfly','lacewing','paperwasp','robberfly','cuckoowasp','beefly','scorpionfly'] },
    { id:'beetles',  name:'Beetle Hall',         theme:'wood',   ids:['chafer','jewelbeetle','tortoisebeetle','weevil','tigerbeetle','dungbeetle','longhorn','atlasbeetle','giraffeweevil','divingbeetle'] },
    { id:'creepers', name:'Creepy Crawlies',     theme:'wood',   ids:['earwig','centipede','millipede','tarantula','peacockspider','crabspider','scorpion','cavecricket','molecricket','velvetant','icecrawler','leafcutter'] },
    { id:'oddities', name:'Hoppers, Mimics & Shore', theme:'garden', ids:['assassin','treehopper','leafinsect','treesnail','spittlebug','mosskatydid','shieldbug','antlion','molecrab','horseshoe','waterscorpion'] },
    { id:'moonmoths',name:'Moon Moths',          theme:'night',  ids:['rosymaple','hawkmoth','tigermoth','lanternfly','plumemoth','ribbonmoth','atlasmoth','glowworm'] },
    { id:'night',     name:'Moths & Night Lights',theme:'night',  ids:['moth','snowmoth','frostmoth','starmoth','lunamoth','owlmoth','glowbug'] } ] };
// Anything added to the game later that isn't in a group yet goes in the last tank of its kind
export const TANK_GROUPS = (() => { const out={};
  for (const k of ['fish','bug']){ const gs=GROUPS0[k].map(g=>({ ...g, kind:k, ids:g.ids.filter(id=>ITEMS[id]) })); const seen=new Set(gs.flatMap(g=>g.ids));
    for (const it of Object.values(ITEMS)) if (it.kind===k && !seen.has(it.id)) gs[gs.length-1].ids.push(it.id); out[k]=gs; }
  return out; })();
export const tankOf = id => { for (const k in TANK_GROUPS) for (const g of TANK_GROUPS[k]) if (g.ids.includes(id)) return g; return null; };
// Big fossils stand on their own pedestals, in this order (v1.68: pedestals are added two at a time as they are needed).
const BIG_ORDER = ['pteroskull','duckbillskull','trikeskull','trexskull','dinoegg','stegoplate','claw','femur',
  'ammonite','ichthyosaur','mosasaurjaw','armorfish','firstbird','tusk','cavebear','dawnhorse'];
const BIG_FOSSIL = new Set(BIG_ORDER);
export const isBigFossil = id => BIG_FOSSIL.has(id);
/* Small fossils share glass cases of 8. They are shelved in this order, so related fossils sit together, and each case is
   named after the theme most of its fossils come from. Fossils added later that aren't listed go at the end. */
const FOSSIL_CASES0 = [
  { name:'Shells of the Old Sea', sub:'Coiled and pointed shells', ids:['orthocone','belemnite','nautilus','hookammonite','turritella','moonsnail','gryphaea','opalclam'] },
  { name:'Clams and Corals', sub:'Reef builders', ids:['brachiopod','fossilscallop','horncoral','honeycomb','chaincoral','lacecoral','vasesponge','stromatolite'] },
  { name:'Stars and Sea Lilies', sub:'Soft and spiny sea life', ids:['urchin','sealily','brittlestar','blastoid','jellyfish','graptolite','stonecrab','fossilshrimp'] },
  { name:'Trilobites and Crawlers', sub:'Shells with legs', ids:['trilobite','rolledtrilo','spinytrilo','eurypterid','roachfossil','fossilspider','arthropleura','wingfossil'] },
  { name:'Ancient Plants', sub:'Leaves, bark and cones', ids:['fern','ginkgo','palmfrond','horsetail','scalebark','petrifiedwood','cycadcone','mapleleaf'] },
  { name:'Fish and Swimmers', sub:'Teeth, bones and flippers', ids:['herring','sharktooth','raytooth','sharkvert','plesioflipper','seaturtle','fossilsnake','fossilfrog'] },
  { name:'Amber and Small Wonders', sub:'Caught in time', ids:['amber','amberbee','amberlizard','fossilflower','fossilfeather','coprolite','ripplerock','dinoprint'] },
  { name:'Dinosaurs and Ice Age', sub:'Bones of the giants', ids:['domeskull','sailspine','clubtail','neckvertebra','dinorib','mammothmolar','glyptodon','sabertooth'] } ];
export const FOSSIL_HALL = (() => {
  const big=BIG_ORDER.filter(id=>ITEMS[id] && ITEMS[id].kind==='fossil'), cases=FOSSIL_CASES0.map(c=>({ ...c, ids:c.ids.filter(id=>ITEMS[id] && !BIG_FOSSIL.has(id)) })).filter(c=>c.ids.length);
  const used=new Set([...big, ...cases.flatMap(c=>c.ids)]), rest=Object.values(ITEMS).filter(i=>i.kind==='fossil' && !used.has(i.id)).map(i=>i.id);
  for (let i=0;i<rest.length;i+=8) cases.push({ name:'More Finds', sub:'New to the museum', ids:rest.slice(i,i+8) });
  return { big, cases }; })();
// Before there is more than one tank, the tank on each side is a shared one with these names
export const MIX_GROUPS = {
  fish:{ id:'mixfish', kind:'fish', name:'Island Waters', theme:'river', ids:[] },
  bug: { id:'mixbug',  kind:'bug',  name:'Island Critters', theme:'garden', ids:[] } };

/* ---------- v1.68: a compact museum that grows only when it is full ----------
   Everything shares one hall. Fish tanks run down the left wall and terrariums down the right; fossils stand in the
   middle at the back and the beach finds sit in a case near the door.
   - Tanks are shared: each holds up to TANK_CAP specimens from any groups. Groups are kept together in one tank
     where they fit; the builders add a tank only when a group no longer fits in any tank.
   - Big fossils stand on pedestals, PED_STEP at a time (2 to start). Small fossils share glass cases of 8.
   - Beach finds: a case of 4, then a case of 8.
   - The hall is 11 wide and gets longer as the tank rows do. It widens only when the fossils in the middle would
     otherwise make it longer than the tanks need.
   A donation that has no space waits in the back room and the builders make room overnight.
   st = { v:2, fish:tanks, bug:tanks, ped:pedestals, cases:fossil cases, shell:0|1 } */
export const TANK_CAP=20, TANK_LEN=5.0, CASE_CAP=8, PED_STEP=2, SHELL_CAP=[4, 8];
const GROUP_IX = {}, IN_GROUP = {};
for (const k of ['fish','bug']) TANK_GROUPS[k].forEach((g,gi)=>{ GROUP_IX[g.id]=gi; g.ids.forEach((id,i)=>{ IN_GROUP[id]=[g, gi*1000+i]; }); });
const BIG_RANK = Object.fromEntries(FOSSIL_HALL.big.map((id,i)=>[id,i]));
const SMALL_RANK = {}, CASE_THEME = {};
FOSSIL_HALL.cases.forEach((c,ci)=>c.ids.forEach((id,i)=>{ SMALL_RANK[id]=ci*100+i; CASE_THEME[id]=c; }));

// Groups (in museum order) with the donated members of each, in catalog order
function groupsOf(kind, ids){ const by=new Map();
  for (const id of ids){ const e=IN_GROUP[id]; if (!e) continue; if (!by.has(e[0])) by.set(e[0], []); by.get(e[0]).push(id); }
  return [...by.entries()].sort((a,b)=>GROUP_IX[a[0].id]-GROUP_IX[b[0].id]).map(([g,m])=>({ g, m:m.sort((a,b)=>IN_GROUP[a][1]-IN_GROUP[b][1]) })); }
// First fit: each group goes whole into the first tank with room for it (a new tank if none has). Returns the tanks.
function packWhole(gs, cap){ const bins=[];
  for (const x of gs){ let b=bins.find(b=>b.n+x.m.length<=cap); if (!b){ b={ n:0, parts:[] }; bins.push(b); } b.parts.push({ g:x.g, m:x.m.slice() }); b.n+=x.m.length; }
  return bins; }
export const tanksNeeded = (kind, ids) => Math.max(1, packWhole(groupsOf(kind, ids), TANK_CAP).length);
// Put what's shown into n tanks: whole groups where they fit, and if a group fits nowhere whole (only until the builders
// come that night) it is split over the free space, so nothing on display ever goes back into storage.
function fillTanks(kind, ids, n){
  const gs=groupsOf(kind, ids), bins=Array.from({ length:n }, ()=>({ n:0, parts:[] })), left=[];
  for (const x of gs){ const b=bins.find(b=>b.n+x.m.length<=TANK_CAP); if (b){ b.parts.push({ g:x.g, m:x.m.slice() }); b.n+=x.m.length; } else left.push(x); }
  for (const x of left){ let m=x.m.slice(); for (const b of bins){ if (!m.length) break; const k=TANK_CAP-b.n; if (k<=0) continue; b.parts.push({ g:x.g, m:m.slice(0,k) }); b.n+=Math.min(k,m.length); m=m.slice(k); } }
  return bins.map((b,i)=>{
    const have=b.parts.flatMap(p=>p.m), main=b.parts.slice().sort((p,q)=>q.m.length-p.m.length)[0];
    // a group's missing species show as "?" in the tank that holds most of it
    const home=b.parts.filter(p=>{ let best=0, at=-1; bins.forEach((bb,j)=>{ const c=bb.parts.filter(q=>q.g===p.g).reduce((s,q)=>s+q.m.length,0); if (c>best){ best=c; at=j; } }); return at===i; }).map(p=>p.g);
    const gNames=[...new Set(b.parts.map(p=>p.g.name))];
    const name = !b.parts.length ? MIX_GROUPS[kind].name : gNames.length===1 ? gNames[0] : gNames.length===2 ? gNames.join(' and ') : MIX_GROUPS[kind].name;
    const miss=[...new Set(home)].flatMap(g=>g.ids.filter(id=>!have.includes(id) && !ids.includes(id)));
    return { id:`${kind}tank${i}`, kind, name, theme:main?main.g.theme:MIX_GROUPS[kind].theme, have, ids:[...have, ...miss], slots:TANK_CAP, groups:gNames }; }); }
const byTime = (don, kind) => don[kind] || [];
// The smallest museum that shows every donation
export function museumFit(don){
  const fos=byTime(don,'fossil'), big=fos.filter(id=>BIG_FOSSIL.has(id)).length, small=fos.length-big;
  return { v:2, fish:tanksNeeded('fish', byTime(don,'fish')), bug:tanksNeeded('bug', byTime(don,'bug')),
    ped:Math.max(PED_STEP, PED_STEP*Math.ceil(big/PED_STEP)), cases:Math.max(1, Math.ceil(small/CASE_CAP)), shell:byTime(don,'shell').length>SHELL_CAP[0]?1:0 }; }
const GROW_KEYS = ['fish','bug','ped','cases','shell'];
// What the builders add tonight (never takes anything away)
export const museumGrown = (st, don) => { const f=museumFit(don), out={ ...st }; for (const k of GROW_KEYS) out[k]=Math.max(st[k]||0, f[k]); out.v=2; return out; };
export const museumShort = (st, don) => { const f=museumFit(don); return GROW_KEYS.filter(k=>f[k]>(st[k]||0)); };
const WORDS=['no','one','two','three','four','five','six','seven','eight','nine','ten'];
const nw = n => WORDS[n] || String(n);
export function museumPlanWords(st, don){ const f=museumFit(don), out=[];
  for (const k of museumShort(st, don)){ const d=f[k]-(st[k]||0);
    if (k==='fish') out.push(d===1 ? 'another fish tank' : `${nw(d)} more fish tanks`);
    if (k==='bug') out.push(d===1 ? 'another terrarium for the bugs' : `${nw(d)} more terrariums for the bugs`);
    if (k==='ped') out.push(`${nw(d)} more pedestals for the big fossils`);
    if (k==='cases') out.push(d===1 ? 'another glass case for fossils' : `${nw(d)} more glass cases for fossils`);
    if (k==='shell') out.push('a bigger case for the beach finds'); }
  return out; }
// Which "wing" milestones the collection has passed (for the town hall and Wendell's isles): more than 8 fish,
// more than 8 bugs, more than 3 fossils. These are the points where the old museum built its wings and halls.
export const museumTierOf = don => Math.min(3, (byTime(don,'fish').length>8?1:0)+(byTime(don,'bug').length>8?1:0)+(byTime(don,'fossil').length>3?1:0));
// What is on display and where. Anything past the space there is (the newest donations) waits in the back room.
export function museumShow(st, don){
  const out={ tanks:{}, shown:{} };
  for (const k of ['fish','bug']){ const ids=byTime(don,k).slice(0, st[k]*TANK_CAP); out.tanks[k]=fillTanks(k, ids, st[k]); out.shown[k]=out.tanks[k].flatMap(t=>t.have); }
  const fos=byTime(don,'fossil'), big=fos.filter(id=>BIG_FOSSIL.has(id)).slice(0, st.ped).sort((a,b)=>BIG_RANK[a]-BIG_RANK[b]);
  const small=fos.filter(id=>!BIG_FOSSIL.has(id)).slice(0, st.cases*CASE_CAP).sort((a,b)=>(SMALL_RANK[a]??1e6)-(SMALL_RANK[b]??1e6));
  out.peds=Array.from({ length:st.ped }, (_,i)=>big[i]||null);
  out.cases=Array.from({ length:st.cases }, (_,i)=>{ const ids=small.slice(i*CASE_CAP, i*CASE_CAP+CASE_CAP), cnt=new Map();
    for (const id of ids){ const c=CASE_THEME[id]; if (c) cnt.set(c, (cnt.get(c)||0)+1); }
    const top=[...cnt.entries()].sort((a,b)=>b[1]-a[1])[0];
    return { ids, name: top ? top[0].name : 'Fossil Finds', sub: !ids.length ? 'Waiting for fossils' : cnt.size===1 && top ? top[0].sub : 'Mixed finds' }; });
  out.shown.fossil=[...big, ...small];
  out.shown.shell=byTime(don,'shell').slice(0, SHELL_CAP[st.shell?1:0]);
  return out; }

/* ---------- Layout (room coordinates: door at +z, back wall at -z) ---------- */
export const FCASE_LEN=3.4, FCASE_DEP=1.3;
const SLOT=TANK_LEN+0.6, PED_ROW=2.3, PED_GAP=2.3, CASE_ROW=2.6, CASE_GAP=1.2, WIDTHS=[11, 15, 19, 23];
const TANK0=3.6;   // the tank rows start this far in from the front wall (clear of the curator's desk)
const centerW = W => W-5.8;   // the middle strip between the two tank aisles
const pedPerRow = W => Math.max(2, Math.floor((centerW(W)-1.24)/PED_GAP)+1);
const casesPerRow = W => Math.max(1, Math.floor((centerW(W)+CASE_GAP)/(FCASE_LEN+CASE_GAP)));
// depth the middle needs, back wall to the front: fossil rows, the beach case, then room for the desk
function middle(W, st){
  const pr=Math.ceil(st.ped/pedPerRow(W)), cr=Math.ceil(st.cases/casesPerRow(W));
  const zPed0=1.3, pedEnd=zPed0+(pr-1)*PED_ROW+0.62, zCase0=pedEnd+1.35+FCASE_DEP/2, caseEnd=cr?zCase0+(cr-1)*CASE_ROW+FCASE_DEP/2:pedEnd;
  const zShell=caseEnd+1.6+0.6;
  return { pr, cr, zPed0, pedEnd, zCase0, caseEnd, zShell, need:zShell+0.62+4.2 }; }
export function museumLayout(st){
  const L={ tanks:[], pedestals:[], fcases:[], shells:null, blocks:[], benches:[], plants:[], cols:[], zones:[], signs:[], sconces:[], lights:[], desk:null, keeper:null, center:null };
  const nT=Math.max(st.fish, st.bug), dTanks=Math.max(10.5, TANK0+nT*SLOT+0.6);
  // the narrowest hall whose middle is no longer than the tank rows; if none is, the narrowest that makes the middle shortest
  let W=WIDTHS[0], best=1e9; for (const w of WIDTHS){ const n=middle(w, st).need; if (n<=dTanks+1.0){ W=w; break; } if (n<best-0.01){ best=n; W=w; } }
  const M=middle(W, st), D=Math.max(dTanks, M.need), front=D/2, back=-D/2, cw=centerW(W);
  const wings={ fish:st.fish>1, bug:st.bug>1 }, fd=M.caseEnd+0.9, zLB=back+fd;
  Object.assign(L, { W, D, front, back, zLB, W0:W, wings, fd, cw });
  // floors: a tiled aisle along each tank row, stone under the fossils, planks and a rug down the middle
  const run0=front-TANK0+0.2, run1=front-TANK0-nT*SLOT-0.2, aisle=2.6;
  if (st.fish) L.zones.push({ x0:-W/2, z0:front-TANK0-st.fish*SLOT-0.2, x1:-W/2+aisle, z1:run0, floor:'fish' });
  if (st.bug) L.zones.push({ x0:W/2-aisle, z0:front-TANK0-st.bug*SLOT-0.2, x1:W/2, z1:run0, floor:'bug' });
  L.zones.push({ x0:-W/2+aisle, z0:back, x1:W/2-aisle, z1:zLB, floor:'fossil' });
  L.zones.push({ x0:-W/2+aisle, z0:zLB, x1:W/2-aisle, z1:front, floor:'planks', rug:true });
  // tanks: fish down the left wall, bugs down the right, front to back
  for (const [k,s] of [['fish',-1],['bug',1]]){ const x=s*(W/2-0.75), rot=s<0?Math.PI/2:-Math.PI/2, z1=front-TANK0;
    for (let i=0;i<st[k];i++){ const z=z1-SLOT*(i+0.5);
      L.tanks.push({ kind:k, index:i, x, z, len:TANK_LEN, rot, front:[x-s*0.95, z] }); L.blocks.push([x-0.62, z-TANK_LEN/2-0.08, x+0.62, z+TANK_LEN/2+0.08]);
      L.sconces.push({ wall:s<0?'L':'R', at:z-TANK_LEN/2-0.3 }, { wall:s<0?'L':'R', at:z+TANK_LEN/2+0.3 }); }
    const zm=z1-SLOT*st[k]/2; L.signs.push({ wall:s<0?'L':'R', at:zm, text:st[k]>1?(k==='fish'?'Aquarium':'Insectarium'):MIX_GROUPS[k].name, w:st[k]>1?3.0:2.6 }); }
  // fossils: pedestals at the back, then the glass cases
  const ppr=pedPerRow(W), cpr=casesPerRow(W);
  for (let r=0;r<M.pr;r++){ const cnt=Math.min(ppr, st.ped-r*ppr), z=back+M.zPed0+r*PED_ROW;
    for (let i=0;i<cnt;i++){ const x=-(cnt-1)*PED_GAP/2+i*PED_GAP; L.pedestals.push({ x, z, h:r===0?1.05:0.8 }); L.blocks.push([x-0.62, z-0.62, x+0.62, z+0.62]); } }
  for (let i=0;i<st.cases;i++){ const r=Math.floor(i/cpr), inRow=Math.min(cpr, st.cases-r*cpr), k=i%cpr;
    const x=-(inRow-1)*(FCASE_LEN+CASE_GAP)/2+k*(FCASE_LEN+CASE_GAP), z=back+M.zCase0+r*CASE_ROW;
    L.fcases.push({ x, z, len:FCASE_LEN }); L.blocks.push([x-FCASE_LEN/2-0.05, z-FCASE_DEP/2-0.05, x+FCASE_LEN/2+0.05, z+FCASE_DEP/2+0.05]); }
  const big=st.ped>PED_STEP || st.cases>1; L.signs.push({ wall:'B', at:0, text:big?'Fossil Hall':'Fossils', w:big?3.0:2.2 });
  // beach finds near the door
  { const len=st.shell?3.6:2.0, z=front-4.8; L.shells={ x:0, z, len, slots:SHELL_CAP[st.shell?1:0] }; L.blocks.push([-len/2-0.2, z-0.62, len/2+0.2, z+0.62]); }
  // the free middle between the fossils and the beach case: a fountain once there's room, then benches facing the tanks
  { let z0=back+fd+0.4, z1=front-4.8-0.62-0.6;
    if (z1-z0>=4.2){ const cz=z1-2.0; L.center={ x:0, z:cz }; L.blocks.push([-1.75,cz-1.75,1.75,cz+1.75]); z1=cz-1.75-0.8; }
    for (let z=z1-1.0; z-1.0>=z0; z-=4.2){ L.benches.push([0, z, 0]); L.blocks.push([-0.42, z-1.0, 0.42, z+1.0]); } }
  // warm lights down the middle, one every 9 or so
  { const n=Math.min(4, Math.max(1, Math.round(D/9))); for (let i=0;i<n;i++) L.lights.push([0, back+D*(i+0.5)/n]); }
  // Professor Thistle's desk by the door, plants in the front corners
  L.desk=[-3.3, front-2.3]; L.keeper=[-3.3, front-3.15]; L.blocks.push([-4.6, front-2.75, -2.0, front-1.85]);
  for (const x of [-W/2+0.9, W/2-0.9]){ const z=front-1.0; L.plants.push([x,z]); L.blocks.push([x-0.45,z-0.45,x+0.45,z+0.45]); }
  return L;
}
export function colPoints(c){ const out=[];
  if (c.axis==='z'){ const n=Math.max(2,Math.round((c.z1-c.z0)/2.6)); for (let i=0;i<=n;i++) out.push([c.x, c.z0+(c.z1-c.z0)*i/n]); }
  else { const n=Math.max(2,Math.round((c.x1-c.x0)/2.6)); for (let i=0;i<=n;i++){ const x=c.x0+(c.x1-c.x0)*i/n; if (Math.abs(x)>c.gap) out.push([x, c.z]); } }
  return out; }

/* ---------- Small helpers ---------- */
const TEXC = new Map();
function ctex(key, w, h, draw, repeat){ if (TEXC.has(key)) return TEXC.get(key); const cv=document.createElement('canvas'); cv.width=w; cv.height=h; draw(cv.getContext('2d'), w, h);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; if (repeat){ t.wrapS=t.wrapT=THREE.RepeatWrapping; } TEXC.set(key,t); return t; }
const rep = (t, x, y) => { const c=t.clone(); c.wrapS=c.wrapT=THREE.RepeatWrapping; c.repeat.set(x,y); c.needsUpdate=true; return c; };
const hexs = c => '#'+new THREE.Color(c).getHexString();
const plane = (w,h) => new THREE.PlaneGeometry(w,h);
const ocyl = (a,b,h,s) => new THREE.CylinderGeometry(a,b,h,s,1,true);
const basic = (o) => new THREE.MeshBasicMaterial(o);
const noShadow = m => { m.castShadow=false; m.receiveShadow=false; return m; };
const radialTex = ctex('m:radial', 128, 128, (x)=>{ const g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,.45)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); });
const beamTex = ctex('m:beam', 64, 128, (x)=>{ const g=x.createLinearGradient(0,0,0,128); g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,128);
  const h=x.createLinearGradient(0,0,64,0); h.addColorStop(0,'rgba(0,0,0,1)'); h.addColorStop(0.3,'rgba(0,0,0,0)'); h.addColorStop(0.7,'rgba(0,0,0,0)'); h.addColorStop(1,'rgba(0,0,0,1)'); x.globalCompositeOperation='destination-out'; x.fillStyle=h; x.fillRect(0,0,64,128); });
// A soft pool of warm light on the floor or a wall
function lightPool(parent, w, d, x, y, z, color=0xffcf8a, op=0.5, vertical=false){
  const m=noShadow(new THREE.Mesh(new THREE.PlaneGeometry(w,d), basic({ map:radialTex, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false })));
  if (!vertical) m.rotation.x=-Math.PI/2; m.position.set(x,y,z); m.renderOrder=2; parent.add(m); return m; }
// A faint cone of light from above, like a gallery spotlight
function beam(parent, x, y, z, h, r, color=0xffd9a0, op=0.13){
  const g=new THREE.ConeGeometry(r, h, 24, 1, true); g.translate(0,-h/2,0);
  const m=noShadow(new THREE.Mesh(g, basic({ map:beamTex, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide, toneMapped:false })));
  m.position.set(x,y,z); m.renderOrder=3; parent.add(m); return m; }
function glowBall(parent, x, y, z, s, color=0xffd090, op=0.8){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:radialTex, color, transparent:true, opacity:op, blending:THREE.AdditiveBlending, depthWrite:false, toneMapped:false })); sp.position.set(x,y,z); sp.scale.set(s,s,1); parent.add(sp); return sp; }
function textPlate(text, sub, w=512, h=128, style='brass'){
  return ctex('plate:'+style+text+sub+w, w, h, (x)=>{
    const g=x.createLinearGradient(0,0,0,h); if (style==='brass'){ g.addColorStop(0,'#f2d58a'); g.addColorStop(0.5,'#d6a64a'); g.addColorStop(1,'#a8782a'); } else { g.addColorStop(0,'#4a3222'); g.addColorStop(1,'#2e1e14'); }
    x.fillStyle=g; x.fillRect(0,0,w,h); x.strokeStyle=style==='brass'?'#8a5e1e':'#c9a050'; x.lineWidth=h*0.06; x.strokeRect(h*0.06,h*0.06,w-h*0.12,h-h*0.12);
    x.fillStyle=style==='brass'?'#3e2810':'#f4d690'; x.textAlign='center'; x.textBaseline='middle';
    // v1.68 long names (a shared tank's two group names) shrink to fit the plate
    const fit=(size, weight, t)=>{ let f=size; x.font=`${weight} ${f}px Fredoka, sans-serif`; const mw=w*0.88, tw=x.measureText ? x.measureText(t).width : 0; if (tw>mw){ f=Math.max(8, Math.floor(f*mw/tw)); x.font=`${weight} ${f}px Fredoka, sans-serif`; } };
    fit(Math.round(h*(sub?0.36:0.48)), 700, text); x.fillText(text, w/2, sub?h*0.4:h*0.53);
    if (sub){ fit(Math.round(h*0.22), 500, sub); x.globalAlpha=0.8; x.fillText(sub, w/2, h*0.74); } }); }
function wrapModel(id, size, axis){   // model centered on its middle, scaled so its longest side (or length) is `size`
  const m=buildItemModel(id), box=new THREE.Box3().setFromObject(m), s=box.getSize(new THREE.Vector3()), c=box.getCenter(new THREE.Vector3());
  const k=size/Math.max(0.001, axis==='x'?s.x:Math.max(s.x,s.z)); m.position.sub(c); const p=new THREE.Group(); p.add(m); p.scale.setScalar(k); p.userData.u=m.userData; p.userData.h=s.y*k; return p; }

/* ---------- Materials ---------- */
const WALNUT=0x5a3826, DARKW=0x3a2418;
const darkWood = () => woodMat(WALNUT);
const trimWood = () => woodMat(DARKW);
const floorTex = () => ctex('m:planks', 256, 256, (x,w,h)=>{
  const r=mulberry32(11), cols=['#7a5236','#80583a','#744e32','#7e5638','#77513a'];
  const bh=32; for (let row=0; row<h/bh; row++){ let px=-(row*97%160); while (px<w){ const L=120+Math.floor(r()*80); x.fillStyle=cols[Math.floor(r()*cols.length)]; x.fillRect(px, row*bh, L, bh);
      x.globalAlpha=0.08; x.fillStyle='#2a1808'; for (let k=0;k<4;k++) x.fillRect(px, row*bh+3+r()*(bh-6), L, 1); x.globalAlpha=1;
      x.fillStyle='rgba(30,16,6,.55)'; x.fillRect(px, row*bh, 1.5, bh); px+=L; }
    x.fillStyle='rgba(30,16,6,.5)'; x.fillRect(0, row*bh, w, 1.5); } }, true);
const rugTex = () => ctex('m:rug', 128, 512, (x,w,h)=>{ x.fillStyle='#7a2a2a'; x.fillRect(0,0,w,h); x.strokeStyle='#d8a848'; x.lineWidth=6; x.strokeRect(9,9,w-18,h-18); x.lineWidth=2; x.strokeRect(19,19,w-38,h-38);
  x.fillStyle='#8e3630'; x.fillRect(22,22,w-44,h-44); x.fillStyle='#d8a848'; for (let y=60;y<h-40;y+=64){ x.save(); x.translate(w/2,y); x.rotate(Math.PI/4); x.fillRect(-9,-9,18,18); x.restore(); x.fillStyle='#6a2424'; x.beginPath(); x.arc(w/2,y,4,0,TAU); x.fill(); x.fillStyle='#d8a848'; } });
const wallTex = (c) => ctex('m:wall'+c, 128, 128, (x,w,h)=>{ x.fillStyle=hexs(c); x.fillRect(0,0,w,h); x.fillStyle=hexs(new THREE.Color(c).offsetHSL(0,0,0.035));
  for (let i=0;i<2;i++) for (let j=0;j<2;j++){ const cx=i*64+32, cy=j*64+32; x.beginPath(); x.ellipse(cx,cy,12,20,0,0,TAU); x.fill(); x.beginPath(); x.ellipse(cx+32,cy+32-64*(j),5,8,0,0,TAU); x.fill(); } }, true);
const panelTex = () => ctex('m:panel', 256, 128, (x,w,h)=>{ const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,'#6a4430'); g.addColorStop(1,'#4e3020'); x.fillStyle=g; x.fillRect(0,0,w,h);
  for (let i=0;i<2;i++){ const px=i*128+14, py=16, pw=100, ph=h-32; x.fillStyle='rgba(0,0,0,.22)'; x.fillRect(px,py,pw,ph); x.fillStyle='rgba(255,230,200,.08)'; x.fillRect(px+4,py+4,pw-8,ph-8); x.strokeStyle='rgba(255,220,170,.18)'; x.lineWidth=2; x.strokeRect(px+1,py+1,pw-2,ph-2); } }, true);

/* ---------- The hall ---------- */
const WALL_C = { left:0x3e6a6c, right:0x56704a, back:0x7c4a3a, front:0x6c5a48, small:0x6a5a4a };
const tileTex = (key, a, b, line) => ctex('m:tile'+key, 128, 128, (x,w,h)=>{ const r=mulberry32(key.length*17);
  for (let j=0;j<2;j++) for (let i=0;i<2;i++){ x.fillStyle=(i+j)%2?a:b; x.fillRect(i*64,j*64,64,64); x.globalAlpha=0.12; for (let k=0;k<30;k++){ x.fillStyle=r()<0.5?'#fff':'#000'; x.fillRect(i*64+r()*64, j*64+r()*64, 2+r()*4, 1+r()*2); } x.globalAlpha=1; }
  x.strokeStyle=line; x.lineWidth=2; for (let k=0;k<=2;k++){ x.beginPath(); x.moveTo(k*64,0); x.lineTo(k*64,h); x.stroke(); x.beginPath(); x.moveTo(0,k*64); x.lineTo(w,k*64); x.stroke(); } }, true);
const FLOORS = { fish:()=>tileTex('fish','#5f7478','#6a8084','#3e4e52'), bug:()=>tileTex('bug','#a86a4a','#b8785a','#6e4430'), fossil:()=>tileTex('fossil','#cdbf9e','#d8cbac','#9a8a6a') };
export function buildMuseumHall(L){
  const g=new THREE.Group(), H=3.7, { W, D, back, front } = L;
  const floor=mk(G.box(W,0.1,D), new THREE.MeshStandardMaterial({ map:rep(floorTex(), W/3.4, D/3.4), roughness:0.55, metalness:0.0 }), 0,-0.05,0,g); floor.castShadow=false;
  for (const zn of L.zones){ const w=zn.x1-zn.x0, d=zn.z1-zn.z0, cx=(zn.x0+zn.x1)/2, cz=(zn.z0+zn.z1)/2;
    if (zn.floor!=='planks'){ const f=noShadow(mk(G.box(w,0.012,d), new THREE.MeshStandardMaterial({ map:rep(FLOORS[zn.floor](), w/1.6, d/1.6), roughness:0.45 }), cx,0.006,cz,g)); f.receiveShadow=true; }
    if (zn.rug){ const rl=d-1.0; const rug=mk(G.box(2.2,0.025,rl), new THREE.MeshStandardMaterial({ map:rep(rugTex(),1,Math.max(1,Math.round(rl/6))), roughness:0.95 }), 0,0.014,front-0.2-rl/2,g); rug.castShadow=false; } }
  // pale border strips round the edge. v1.34: they sit clearly above the hall floors (were 2 mm apart, which flickered)
  // and the side strips stop short of the front and back ones so no two strips share the same patch of floor.
  for (const [w,d,x,z] of [[W,0.4,0,back+0.2],[W,0.4,0,front-0.2],[0.4,D-0.8,-W/2+0.2,0],[0.4,D-0.8,W/2-0.2,0]]) noShadow(mk(G.box(w,0.03,d), M(0xe8dcc8,{roughness:0.3}), x,0.02,z,g)).receiveShadow=true;
  const cutWalls=[];
  // walls: dark wainscot panels, a painted upper wall, chair rail and crown molding. Each wall is one group so it can drop.
  // v1.34: the side walls (side=true) fit between the front and back walls instead of running through them, and
  // their trim stops where the back and front trim begins. Before, the corners had two copies of every molding in
  // the same spot, and the crown molding's top sat exactly level with the wall's top, so edges shimmered.
  const wall=(len, color, x, z, ry, nx, nz, door, side)=>{
    const grp=new THREE.Group(); grp.position.set(x,0,z); grp.rotation.y=ry; g.add(grp); const hide=[];
    const pieces = door ? [[-(len/2+1.3)/2, (len/2-1.3)], [(len/2+1.3)/2, (len/2-1.3)]] : [[0,len]];
    const tin = side ? 0.24 : 0;   // trim inset at each end of a side wall
    for (const [cx,l] of pieces){ if (l<=0.01) continue;
      mk(G.box(side?l-0.08:l,1.05,0.24), new THREE.MeshStandardMaterial({ map:rep(panelTex(), l/1.8, 1), roughness:0.6 }), cx,0.525,0.02,grp);
      mk(G.box(l,H-1.05,0.2), new THREE.MeshStandardMaterial({ map:rep(wallTex(color), l/1.4, (H-1.05)/1.4), roughness:0.9 }), cx,1.05+(H-1.05)/2,0,grp);
      const tl = side ? l-2*tin : l+0.04;   // front/back trim pokes just past the wall's ends so their end faces never coincide
      mk(G.box(tl,0.08,0.3), trimWood(), cx,1.085,0.04,grp); mk(G.box(tl,0.2,0.32), M(0xf0e4cc), cx,H-0.08,0.05,grp); mk(G.box(tl,0.12,0.28), trimWood(), cx,0.07,0.04,grp); }
    if (door){ mk(G.box(2.6,H-2.55,0.22), new THREE.MeshStandardMaterial({ map:rep(wallTex(color), 2, 1), roughness:0.9 }), 0,2.55+(H-2.55)/2,0,grp);
      for (const s of [-1,1]) mk(G.box(0.18,2.6,0.34), trimWood(), s*1.3,1.3,0.04,grp); mk(G.box(2.96,0.22,0.36), trimWood(), 0,2.62,0.04,grp); }
    cutWalls.push({ meshes:[grp], hide, nx, nz }); return { grp, hide }; };
  const small=!L.wings.fish && !L.wings.bug && !L.fd;
  const WL={ L:wall(D, L.wings.fish?WALL_C.left:WALL_C.small, -W/2-0.1, 0, Math.PI/2, -1, 0, false, true), R:wall(D, L.wings.bug?WALL_C.right:WALL_C.small, W/2+0.1, 0, -Math.PI/2, 1, 0, false, true),
    B:wall(W+0.4, L.fd?WALL_C.back:WALL_C.small, 0, back-0.1, 0, 0, -1) };
  wall(W+0.4, WALL_C.front, 0, front+0.1, Math.PI, 0, 1, true);
  const along=(w, at)=> w==='L' ? -at : w==='R' ? at : at;   // wall-local x for a room coordinate along that wall
  // section signs: dark wood with gold letters
  for (const sg of L.signs){ const Wl=WL[sg.wall], s=new THREE.Group(); s.position.set(along(sg.wall,sg.at), sg.wall==='B'&&L.fd?3.12:3.0, 0.16); Wl.grp.add(s); Wl.hide.push(s);
    mk(G.box(sg.w,0.5,0.06), trimWood(), 0,0,0,s); noShadow(mk(plane(sg.w-0.12,0.42), new THREE.MeshStandardMaterial({ map:textPlate(sg.text,'',512,96,'wood'), roughness:0.5, metalness:0.2 }), 0,0,0.035,s)); }
  // a mural behind the fossils once they have their own hall: an old sea, in warm sepia
  if (L.fd){ const mt=ctex('m:mural', 512, 160, (x,w,h)=>{ const gr=x.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#d9b98a'); gr.addColorStop(1,'#b48a5a'); x.fillStyle=gr; x.fillRect(0,0,w,h);
      x.fillStyle='rgba(90,55,30,.35)'; x.beginPath(); x.moveTo(0,h); for (let i=0;i<=w;i+=16) x.lineTo(i, h*0.72-Math.sin(i*0.02)*14-Math.sin(i*0.07)*6); x.lineTo(w,h); x.fill();
      x.strokeStyle='rgba(90,55,30,.4)'; x.lineWidth=3; for (const [cx,cy,r] of [[80,70,26],[400,60,20],[250,95,14]]){ x.beginPath(); for (let a=0;a<TAU*2.6;a+=0.1){ const rr=r*a/(TAU*2.6); x.lineTo(cx+Math.cos(a)*rr, cy+Math.sin(a)*rr); } x.stroke(); }
      x.fillStyle='rgba(90,55,30,.3)'; for (const [cx,cy] of [[170,50],[330,40],[460,85]]){ x.beginPath(); x.ellipse(cx,cy,22,8,-0.2,0,TAU); x.fill(); x.beginPath(); x.moveTo(cx-20,cy); x.lineTo(cx-34,cy-9); x.lineTo(cx-34,cy+9); x.fill(); }
      x.strokeStyle='#8a5e2e'; x.lineWidth=8; x.strokeRect(4,4,w-8,h-8); });
    const mw=Math.min(W-6, 11), mu=new THREE.Group(); mu.position.set(0,2.05,0.13); WL.B.grp.add(mu); WL.B.hide.push(mu);
    mk(G.box(mw+0.2,1.55,0.05), M(0xb8904a,{ metalness:0.6, roughness:0.35 }), 0,0,0,mu); noShadow(mk(plane(mw,1.4), new THREE.MeshStandardMaterial({ map:mt, roughness:0.9 }), 0,0,0.03,mu));
    L.sconces.push({ wall:'B', at:-mw/2-0.5 }, { wall:'B', at:mw/2+0.5 }); }
  // brass wall sconces beside the cases
  const seen=new Set();
  for (const sc0 of L.sconces){ const key=sc0.wall+Math.round(sc0.at*4); if (seen.has(key)) continue; seen.add(key);
    const Wl=WL[sc0.wall], sc=new THREE.Group(); sc.position.set(along(sc0.wall,sc0.at),2.55,0.14); Wl.grp.add(sc); Wl.hide.push(sc);
    mk(G.box(0.16,0.24,0.05), brass(), 0,0,0.05,sc); const arm=mk(G.cyl(0.02,0.02,0.22,6), brass(), 0,0.04,0.16,sc); arm.rotation.x=Math.PI/2;
    mk(ocyl(0.06,0.11,0.14,12), new THREE.MeshStandardMaterial({ color:0xfff0d0, emissive:0xffc070, emissiveIntensity:1.2, side:THREE.DoubleSide }), 0,0.12,0.27,sc);
    glowBall(sc, 0,0.12,0.3, 0.9, 0xffc080, 0.55); lightPool(sc, 1.6,1.9, 0,0.1,0.02, 0xffb070, 0.22, true); }
  // colonnades between the main room and each hall
  for (const c of L.cols) for (const [x,z] of colPoints(c)){ const p=new THREE.Group(); p.position.set(x,0,z); g.add(p);
    mk(G.box(0.5,0.22,0.5), M(0xe0d4bc,{roughness:0.4}), 0,0.11,0,p); mk(G.cyl(0.17,0.2,H-0.6,14), M(0xf0e6d2,{roughness:0.35}), 0,0.22+(H-0.6)/2,0,p);
    mk(G.box(0.48,0.2,0.48), M(0xe0d4bc,{roughness:0.4}), 0,H-0.28,0,p); mk(G.box(0.56,0.08,0.56), M(0xf2e8d4,{roughness:0.5}), 0,H-0.14,0,p); }
  // the room's own lights: warm and low, so the cases glow
  for (const [x,z] of L.lights){ const l=new THREE.PointLight(0xffd6a0, small?22:26, small?13:16, 1.4); l.position.set(x,3.0,z); g.add(l); }
  g.userData.cutWalls=cutWalls; return g;
}

/* ---------- Fixtures ---------- */
export function buildDesk(){ const g=new THREE.Group();
  mk(G.box(2.5,1.0,0.75), darkWood(), 0,0.5,0,g); mk(G.box(2.64,0.07,0.86), M(0x2e1e14,{roughness:0.35}), 0,1.03,0,g);
  for (const x of [-0.82,0,0.82]) mk(G.box(0.7,0.7,0.02), woodMat(0x6a4430), x,0.5,0.385,g);
  mk(G.box(0.6,0.2,0.04), new THREE.MeshStandardMaterial({ map:textPlate('Curator','Professor Thistle',512,160), metalness:0.6, roughness:0.35 }), 0,0.82,0.4,g);
  const lamp=new THREE.Group(); lamp.position.set(0.85,1.07,-0.1); g.add(lamp); mk(G.cyl(0.08,0.1,0.04,12), brass(), 0,0.02,0,lamp); mk(G.cyl(0.015,0.015,0.32,6), brass(), 0,0.18,0,lamp);
  mk(ocyl(0.07,0.16,0.14,14), new THREE.MeshStandardMaterial({ color:0x2a6a4a, side:THREE.DoubleSide, roughness:0.4 }), 0,0.38,0,lamp); glowBall(lamp,0,0.3,0,0.8,0xffd090,0.7);
  for (let i=0;i<3;i++) mk(G.box(0.3,0.05,0.22), M([0x8a3a30,0x3a5a8a,0x5a7a3a][i]), -0.7,1.09+i*0.05,0,g).rotation.y=i*0.2;
  mk(G.box(0.42,0.02,0.3), M(0xf4ecd8), -0.15,1.075,0.05,g).rotation.y=-0.2; return g; }
export function buildCenterpiece(tier=2){ const g=new THREE.Group();
  mk(G.cyl(1.75,1.85,0.18,32), M(0xe4d8c2,{roughness:0.35}), 0,0.09,0,g); mk(G.cyl(1.6,1.6,0.02,32), brass(), 0,0.19,0,g);
  const f=new THREE.Group(); FURN_BUILDERS.fountain(f); f.scale.setScalar(1.45); f.position.y=0.18; g.add(f);
  for (let i=0;i<(tier>=3?6:4);i++){ const a=i/(tier>=3?6:4)*TAU+Math.PI/4, p=buildPalm(); p.scale.setScalar(0.7); p.position.set(Math.cos(a)*1.45,0.18,Math.sin(a)*1.45); g.add(p); }
  lightPool(g, 5, 5, 0,0.21,0, 0xffd090, 0.3); beam(g, 0,3.6,0, 3.3, 1.9, 0xffe0b0, 0.07); return g; }
export function buildBench(){ const g=new THREE.Group(); mk(G.box(0.62,0.1,1.8), darkWood(), 0,0.46,0,g); mk(G.box(0.58,0.06,1.7), M(0x7a2a2a,{roughness:0.95}), 0,0.53,0,g);
  for (const z of [-0.75,0.75]) for (const x of [-0.24,0.24]) mk(G.cyl(0.04,0.03,0.42,8), brass(), x,0.21,z,g); return g; }
export function buildPalm(){ const g=new THREE.Group(); mk(G.cyl(0.32,0.25,0.5,14), M(0xe8dcc8,{roughness:0.3}), 0,0.25,0,g); mk(G.cyl(0.33,0.33,0.06,14), brass(), 0,0.48,0,g);
  for (let i=0;i<7;i++){ const a=i/7*TAU, l=mk(G.sph(0.3,8,6), M(0x3f7a3a), Math.cos(a)*0.36,0.95+(i%3)*0.18,Math.sin(a)*0.36,g); l.scale.set(1.6,0.18,0.5); l.rotation.y=-a; l.rotation.z=-0.5; }
  mk(G.cyl(0.04,0.06,0.9,6), M(0x6a5a3a), 0,0.85,0,g); return g; }

/* Glass case for beach finds: 8 compartments, two rows */
export function shellSlots(len, n=8){ const c=n/2, out=[]; for (let r=0;r<2;r++) for (let i=0;i<c;i++) out.push([-len/2+len/(2*c)+i*len/c, r?0.2:-0.2]); return out; }
export function buildShellCase(len, n=8){ const g=new THREE.Group();
  mk(G.box(len,0.82,1.0), darkWood(), 0,0.41,0,g); mk(G.box(len+0.06,0.05,1.06), brass(), 0,0.84,0,g);
  mk(G.box(len-0.1,0.02,0.92), M(0x2a4a6a,{roughness:0.95}), 0,0.86,0,g);
  for (const [x,z] of shellSlots(len,n)) mk(G.cyl(0.18,0.18,0.02,20), M(0xe8dcc0,{roughness:0.6}), x,0.875,z,g);
  const glass=noShadow(mk(G.box(len-0.06,0.42,0.96), glassMat(0xe8f4ff,0.16), 0,1.08,0,g));
  for (const x of [-len/2+0.03, len/2-0.03]) for (const z of [-0.47,0.47]) mk(G.box(0.04,0.44,0.04), brass(), x,1.08,z,g);
  for (const z of [-0.49,0.49]) mk(G.box(len,0.03,0.03), brass(), 0,1.3,z,g); for (const x of [-len/2+0.02,len/2-0.02]) mk(G.box(0.03,0.03,1.0), brass(), x,1.3,0,g);
  for (const s of [-1,1]) mk(G.box(Math.min(1.2,len*0.6),0.24,0.02), new THREE.MeshStandardMaterial({ map:textPlate('Beach Finds','Shells, glass and pearls',512,128), metalness:0.6, roughness:0.35 }), 0,0.6,s*0.51,g).rotation.y=s<0?Math.PI:0;
  lightPool(g, len+1.6, 2.4, 0,0.02,0, 0xffcf8a, 0.32); lightPool(g, len*0.9, 0.8, 0,0.9,0, 0xffe0b0, 0.25); return g; }

/* Fossil pedestal: marble plinth, brass plaque; lit and domed once something is on it */
export function buildPedestal(id, h, big, filled){ const g=new THREE.Group(), r=big?0.55:0.4, stone=M(0x3e3834,{roughness:0.45}), cap=M(0x524a44,{roughness:0.3});
  mk(G.box(r*2+0.14,0.1,r*2+0.14), M(0x2c2622,{roughness:0.5}), 0,0.05,0,g); mk(G.box(r*2,h-0.18,r*2), stone, 0,0.1+(h-0.18)/2,0,g);
  mk(G.box(r*2+0.1,0.08,r*2+0.1), cap, 0,h-0.04,0,g); mk(G.box(r*2+0.12,0.02,r*2+0.12), brass(), 0,h-0.085,0,g);
  const it=id&&ITEMS[id]; mk(G.box(r*1.5,0.2,0.02), new THREE.MeshStandardMaterial({ map:textPlate(filled?it.name:'?', filled?'Fossil':'Waiting for a fossil',512,128), metalness:0.6, roughness:0.35 }), 0,h*0.6,r+0.011,g);
  if (filled){ mk(G.cyl(r*0.55,r*0.62,0.05,20), brass(), 0,h+0.025,0,g);
    beam(g, 0,3.5,0, 3.5-h, r*1.35, 0xffdcaa, 0.12); lightPool(g, r*2.6, r*2.6, 0,h+0.01,0, 0xffd090, 0.22); lightPool(g, r*4, r*4, 0,0.015,0.2, 0xffcf8a, 0.3); }
  g.userData.top=h+0.05; return g; }
export function fossilModel(id, big){ return wrapModel(id, big?0.85:0.55); }

/* v1.65 glass case for small fossils in the full Fossil Hall: 8 trays in two rows of 4 */
export function fossilCaseSlots(len=FCASE_LEN){ const out=[]; for (let r=0;r<2;r++) for (let i=0;i<4;i++) out.push([-len/2+len/8+i*len/4, r?0.3:-0.3]); return out; }
export const FCASE_TOP = 0.885;   // where a fossil sits, on its tray
export function buildFossilCase(len, name, sub){ const g=new THREE.Group(), d=FCASE_DEP;
  mk(G.box(len,0.82,d), darkWood(), 0,0.41,0,g); mk(G.box(len+0.06,0.05,d+0.06), brass(), 0,0.84,0,g);
  mk(G.box(len-0.1,0.02,d-0.08), M(0x5a4632,{roughness:0.95}), 0,0.86,0,g);
  for (const [x,z] of fossilCaseSlots(len)) mk(G.box(len/4-0.12,0.016,0.5), M(0xd8c8a4,{roughness:0.85}), x,0.876,z,g);
  noShadow(mk(G.box(len-0.06,0.5,d-0.04), glassMat(0xe8f4ff,0.16), 0,1.12,0,g));
  for (const x of [-len/2+0.03, len/2-0.03]) for (const z of [-d/2+0.03,d/2-0.03]) mk(G.box(0.04,0.52,0.04), brass(), x,1.12,z,g);
  for (const z of [-d/2+0.01,d/2-0.01]) mk(G.box(len,0.03,0.03), brass(), 0,1.38,z,g); for (const x of [-len/2+0.02,len/2-0.02]) mk(G.box(0.03,0.03,d), brass(), x,1.38,0,g);
  const plate=new THREE.MeshStandardMaterial({ map:textPlate(name, sub, 512,128), metalness:0.6, roughness:0.35 });
  for (const s of [-1,1]) mk(G.box(Math.min(1.5,len*0.5),0.28,0.02), plate, 0,0.58,s*(d/2+0.01),g).rotation.y=s<0?Math.PI:0;
  lightPool(g, len+1.4, d+1.4, 0,0.02,0, 0xffcf8a, 0.3); lightPool(g, len*0.9, d*0.8, 0,0.9,0, 0xffe0b0, 0.22); return g; }
// a fossil for a case tray: no wider than the tray and low enough to fit under the glass
export function caseFossilModel(id){ const m=wrapModel(id, 0.5); if (m.userData.h>0.4){ const k=0.4/m.userData.h; m.scale.multiplyScalar(k); m.userData.h=0.4; } return m; }
export function shellModel(id){ return wrapModel(id, 0.28); }

/* ---------- Painted backdrops for tanks ---------- */
const THEME = {
  pond:  { top:'#7fbf9a', bot:'#2f5a3e', water:0x5aa88a, floor:'#4a3a24', floor2:'#6a5434', fog:0x3f6e58 },
  river: { top:'#8fd0e0', bot:'#3a6e7e', water:0x6ac0d8, floor:'#7a7468', floor2:'#9a9488', fog:0x4a8494 },
  coast: { top:'#8ee0f0', bot:'#2a7aa8', water:0x5ad0f0, floor:'#d8c08a', floor2:'#ecd8a8', fog:0x3a8ab8 },
  ocean: { top:'#3a7ac8', bot:'#0c1e48', water:0x2a6ac0, floor:'#c8b080', floor2:'#a89060', fog:0x10285a },
  meadow:{ top:'#cfe8f4', bot:'#f4e2b0', floor:'#5a7a34', floor2:'#7a9a44', hills:'#9ac46a' },
  garden:{ top:'#d8eef0', bot:'#e8eec0', floor:'#5a4630', floor2:'#6e8a3a', hills:'#8ab85a' },
  wood:  { top:'#b8d4a8', bot:'#5a6a3a', floor:'#4a3622', floor2:'#6a5232', hills:'#4a6a34' },
  night: { top:'#141a3a', bot:'#3a3a6a', floor:'#2a3020', floor2:'#3a4a2a', hills:'#232a40' } };
function backdrop(theme, w=512, h=256){ const T=THEME[theme]; return ctex('bd:'+theme+w, w, h, (x)=>{
  const g=x.createLinearGradient(0,0,0,h); g.addColorStop(0,T.top); g.addColorStop(1,T.bot); x.fillStyle=g; x.fillRect(0,0,w,h); const r=mulberry32(theme.length*31);
  if (T.water){ // water: soft light from above and distant rock shapes
    x.globalAlpha=0.18; for (let i=0;i<6;i++){ const px=r()*w; const gr=x.createLinearGradient(px,0,px+40,h); gr.addColorStop(0,'#fff'); gr.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gr; x.beginPath(); x.moveTo(px-10,0); x.lineTo(px+30,0); x.lineTo(px+90,h); x.lineTo(px+20,h); x.fill(); }
    x.globalAlpha=0.35; x.fillStyle=T.bot; x.beginPath(); x.moveTo(0,h); for (let i=0;i<=w;i+=8) x.lineTo(i, h*0.72-Math.abs(Math.sin(i*0.013+1))*h*0.22-r()*4); x.lineTo(w,h); x.fill(); x.globalAlpha=1;
    if (theme==='ocean'){ x.fillStyle='rgba(255,255,255,.5)'; for (let i=0;i<60;i++){ x.fillRect(r()*w, r()*h, 1.2, 1.2); } }
  } else { // terrarium: a little painted landscape behind the glass
    if (theme==='night'){ x.fillStyle='#fff8d8'; for (let i=0;i<90;i++){ x.globalAlpha=0.3+r()*0.6; x.fillRect(r()*w, r()*h*0.6, 1.5, 1.5); } x.globalAlpha=1; const mg=x.createRadialGradient(w*0.75,h*0.25,0,w*0.75,h*0.25,60); mg.addColorStop(0,'rgba(255,248,220,1)'); mg.addColorStop(0.25,'rgba(255,248,220,.9)'); mg.addColorStop(0.3,'rgba(255,240,200,.25)'); mg.addColorStop(1,'rgba(255,240,200,0)'); x.fillStyle=mg; x.fillRect(0,0,w,h); }
    x.fillStyle=T.hills; for (let k=0;k<2;k++){ x.globalAlpha=k?1:0.6; x.beginPath(); x.moveTo(0,h); for (let i=0;i<=w;i+=8) x.lineTo(i, h*(0.6+k*0.12)-Math.sin(i*0.01+k*2)*h*0.08); x.lineTo(w,h); x.fill(); }
    if (theme==='wood'){ x.globalAlpha=0.5; x.fillStyle='#3a2a1a'; for (let i=0;i<7;i++){ const px=r()*w, tw=8+r()*14; x.fillRect(px,0,tw,h); } }
    if (theme!=='night' && theme!=='wood'){ for (let i=0;i<70;i++){ x.globalAlpha=0.8; x.fillStyle=['#f4a0b8','#f8e070','#ffffff','#b8a0f0'][i%4]; x.beginPath(); x.arc(r()*w, h*0.72+r()*h*0.28, 1.6+r()*2, 0, TAU); x.fill(); } }
    x.globalAlpha=1; } }); }
function floorTexOf(theme){ const T=THEME[theme]; return ctex('fl:'+theme, 256, 256, (x,w,h)=>{ x.fillStyle=T.floor; x.fillRect(0,0,w,h); const r=mulberry32(7+theme.length);
  for (let i=0;i<900;i++){ x.globalAlpha=0.25+r()*0.4; x.fillStyle=r()<0.5?T.floor2:hexs(new THREE.Color(T.floor).offsetHSL(0,0,-0.08)); const s=1+r()*3; x.fillRect(r()*w,r()*h,s,s); }
  if (theme==='coast'||theme==='ocean'){ x.globalAlpha=0.18; x.strokeStyle='#fff'; x.lineWidth=2; for (let y=8;y<h;y+=22){ x.beginPath(); for (let i=0;i<=w;i+=8) x.lineTo(i, y+Math.sin(i*0.05+y)*4); x.stroke(); } }
  x.globalAlpha=1; }, true); }

/* ---------- Tank / terrarium in the hall ---------- */
// Length runs along x, the glass faces +z. Returns a group with userData.update(t,dt).
const SIZE_ROOM = { S:0.2, M:0.28, L:0.38, XL:0.5 };
// v1.52 bugs have their own models (model.x) and no model.w: how they move comes from where they live, their size from how long they grow
const MOTHS2 = new Set(['rosymaple','hawkmoth','tigermoth','plumemoth','ribbonmoth','atlasmoth']);
const MOVE2 = { treesnail:'snail', cavecricket:'hopper', mosskatydid:'hopper', spittlebug:'hopper', treehopper:'hopper', waterscorpion:'skater' };
export const bugMove = it => it.model.w || MOVE2[it.id] || (['air','starfall'].includes(it.move||it.where) ? (MOTHS2.has(it.id) ? 'moth' : 'fly') : 'beetle');
const bugLen = it => Math.min(1.45, Math.max(0.55, 0.42+0.36*Math.log10(Math.max(4, (it.len||[10,20])[1]))));
const BOTTOM2 = new Set(), BOT2 = new Set(['flounder','crayfish','octopus']), HOVER2 = new Set(['seahorse','squid','seadragon','boxfish','pinecone','frog']);
const BUG_SIZE = { fly:0.3, moth:0.3, dragon:0.32, bee:0.17, lady:0.13, mantis:0.26, cicada:0.2, beetle:0.17, hopper:0.2, stick:0.34, stag:0.24, rhino:0.24, pill:0.14, snail:0.18, crab:0.2, hermit:0.2, skater:0.22 };
export function buildTank(group, len, have){
  const g=new THREE.Group(), fish=group.kind==='fish', T=THEME[group.theme], Dp=1.05, y0=0.82, y1=2.02, hgt=y1-y0, anims=[]; const r=mulberry32(group.id.length*97);
  // cabinet with panels, brass trim and a plaque
  mk(G.box(len,y0,Dp), darkWood(), 0,y0/2,0,g); mk(G.box(len+0.06,0.1,Dp+0.06), trimWood(), 0,0.05,0,g);
  const np=Math.max(1,Math.round(len/1.2)); for (let i=0;i<np;i++){ const pw=len/np-0.16; mk(G.box(pw,y0-0.3,0.02), woodMat(0x6a4430), -len/2+len/np*(i+0.5),y0/2+0.02,Dp/2+0.01,g); }
  const n=have.length;
  mk(G.box(Math.min(1.5,len*0.55),0.3,0.03), new THREE.MeshStandardMaterial({ map:textPlate(group.name, group.slots?`${n} of ${group.slots} spaces`:`${n} of ${group.ids.length} species`, 512,128), metalness:0.6, roughness:0.35 }), 0,y0*0.56,Dp/2+0.03,g);
  mk(G.box(len+0.04,0.05,Dp+0.04), brass(), 0,y0+0.0,0,g);
  // inside: floor, painted back, then glass and frame
  const inner=new THREE.Group(); inner.position.y=y0; g.add(inner);
  const fl=mk(G.box(len-0.06,0.12,Dp-0.06), new THREE.MeshStandardMaterial({ map:rep(floorTexOf(group.theme),len/1.5,0.7), roughness:0.95 }), 0,0.06,0,inner); fl.castShadow=false;
  noShadow(mk(plane(len-0.06,hgt), basic({ map:backdrop(group.theme) }), 0,hgt/2,-Dp/2+0.04,inner));
  for (const s of [-1,1]) noShadow(mk(plane(Dp-0.08,hgt), basic({ map:backdrop(group.theme), color:0xcccccc }), s*(len/2-0.04),hgt/2,0,inner)).rotation.y=-s*Math.PI/2;
  tankProps(inner, group.theme, len, Dp, hgt, r, anims, 'room');
  if (fish){ const wm=new THREE.MeshPhysicalMaterial({ color:T.water, transparent:true, opacity:0.26, roughness:0.05, clearcoat:1, depthWrite:false });
    noShadow(mk(G.box(len-0.08,hgt-0.12,Dp-0.08), wm, 0,(hgt-0.12)/2+0.02,0,inner)).renderOrder=1;
    const surf=noShadow(mk(plane(len-0.08,Dp-0.08), basic({ color:0xd8f4ff, transparent:true, opacity:0.25, depthWrite:false }), 0,hgt-0.1,0,inner)); surf.rotation.x=-Math.PI/2;
    for (let i=0;i<3;i++){ const b=beam(inner, -len/3+i*len/3+(r()-0.5)*0.3, hgt-0.1, 0, hgt-0.2, 0.28, 0xffffff, 0.06); b.scale.set(1,1,0.6); } }
  noShadow(mk(G.box(len-0.04,hgt,0.02), glassMat(0xe8f6ff,0.12), 0,y0+hgt/2,Dp/2-0.01,g));
  for (const x of [-len/2+0.02, len/2-0.02]) for (const z of [-Dp/2+0.02, Dp/2-0.02]) mk(G.box(0.05,hgt,0.05), trimWood(), x,y0+hgt/2,z,g);
  // hood with a warm light strip
  for (const z of [-Dp/2+0.03, Dp/2-0.03]) mk(G.box(len+0.06,0.07,0.07), trimWood(), 0,y1+0.03,z,g);
  for (const x of [-len/2+0.03, len/2-0.03]) mk(G.box(0.07,0.07,Dp), trimWood(), x,y1+0.03,0,g);
  const bar=new THREE.Group(); bar.position.set(0,y1+0.16,-Dp/2+0.12); g.add(bar);
  mk(G.box(len-0.1,0.09,0.16), brass(), 0,0,0,bar); noShadow(mk(G.box(len-0.2,0.02,0.1), basic({ color:0xfff0c8, toneMapped:false }), 0,-0.05,0.02,bar));
  for (const x of [-len/2+0.25, len/2-0.25]) mk(G.cyl(0.015,0.015,0.2,6), brass(), x,-0.1,-0.04,bar);
  lightPool(g, len+0.9, 1.8, 0,0.015,Dp/2+0.75, 0xffcf8a, 0.34);
  lightPool(g, len*0.9, hgt*0.95, 0,y0+hgt*0.55,-Dp/2+0.06, fish?0xbfe8ff:0xfff0c0, fish?0.22:0.16, true);
  // specimens
  for (const id of have){ const it=ITEMS[id];
    if (fish){ const m=wrapModel(id, SIZE_ROOM[it.size]||0.28, 'x'); inner.add(m); const bottom=BOT2.has(id) || !!m.userData.u.bottom;
      const A={ m, ph:r()*TAU, w:0.25+r()*0.25, ax:len/2-0.25-(SIZE_ROOM[it.size]||0.28)/2, az:Dp/2-0.22, y: bottom?0.12+m.userData.h/2+0.04:0.3+r()*(hgt-0.7), bob:r()*TAU, bottom };
      anims.push((t)=>{ const s=t*A.w+A.ph, x=Math.sin(s)*A.ax, z=Math.sin(s*2+A.bob)*A.az*0.6, dx=Math.cos(s)*A.ax, dz=Math.cos(s*2+A.bob)*A.az*1.2;
        A.m.position.set(x, A.y+(A.bottom?0:Math.sin(t*0.9+A.bob)*0.06), z); A.m.rotation.y=Math.atan2(-dz,dx); const tl=A.m.userData.u.tail; if (tl) tl.rotation.y=Math.sin(t*7+A.ph)*0.35; if (A.m.userData.u.idle) A.m.userData.u.idle(t); }); }
    else { const w=bugMove(it), m=wrapModel(id, it.model.w ? (BUG_SIZE[w]||0.2) : bugLen(it)*0.25); inner.add(m); const fly=['fly','moth','dragon'].includes(w)||(w==='beetle'&&it.model.glow);
      const px=(r()-0.5)*(len-0.5), pz=(r()-0.3)*(Dp-0.4)*0.6; const A={ m, ph:r()*TAU, fly, base:new THREE.Vector3(px, 0.12+m.userData.h/2+(fly?0.35+r()*0.5:0), pz), rot:r()*TAU };
      m.position.copy(A.base); m.rotation.y=A.rot;
      anims.push((t)=>{ const wings=A.m.userData.u.wings||[];
        if (A.fly){ A.m.position.set(A.base.x+Math.sin(t*0.5+A.ph)*0.3, A.base.y+Math.sin(t*1.3+A.ph)*0.08, A.base.z+Math.sin(t*0.8+A.ph)*0.12); A.m.rotation.y=A.rot+Math.sin(t*0.5+A.ph)*0.8;
          for (const wg of wings) wg.rotation.z=wg.userData.side*(0.3+Math.sin(t*14+A.ph)*0.5); }
        else for (const wg of wings) wg.rotation.z=wg.userData.side*(0.1+Math.max(0,Math.sin(t*0.7+A.ph))*0.25);
        if (A.m.userData.u.idle) A.m.userData.u.idle(t); }); } }
  g.userData.update=(t,dt)=>{ for (const f of anims) f(t,dt); };
  return g;
}

/* Theme props, used both in the hall (scale 'room') and the fullscreen view ('view').
   Sizes are given for the room tank and multiplied up for the big view. */
function ribbon(parent, h, w, color, x, z, anims, ph, segs=10, sway=0.08){
  const geo=new THREE.PlaneGeometry(w, h, 1, segs); geo.translate(0,h/2,0); const base=geo.attributes.position.array.slice();
  const m=new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, side:THREE.DoubleSide, roughness:0.7 })); m.position.set(x,0,z); m.rotation.y=ph; m.castShadow=true; parent.add(m);
  anims.push((t)=>{ const p=geo.attributes.position.array; for (let i=0;i<p.length;i+=3){ const y=base[i+1], k=Math.max(0,y/h)**1.4; p[i]=base[i]+Math.sin(t*0.9+y*1.6/h*3+ph)*sway*k*h; p[i+2]=base[i+2]+Math.cos(t*0.7+y*2/h+ph)*sway*0.5*k*h; } geo.attributes.position.needsUpdate=true; });
  return m; }
function flowerAt(parent, x, z, h, s, color, r){ const st=mk(G.cyl(0.012*s,0.016*s,h,5), M(0x4f8a3a), x,h/2,z,parent);
  const head=new THREE.Group(); head.position.set(x,h,z); parent.add(head); for (let i=0;i<6;i++){ const a=i/6*TAU, p=mk(G.sph(0.06*s,8,6), M(color), Math.cos(a)*0.06*s,0,Math.sin(a)*0.06*s,head); p.scale.set(1.3,0.35,0.8); p.rotation.y=-a; }
  mk(G.sph(0.035*s,8,6), M(0xf2c030), 0,0.015*s,0,head); const lf=mk(G.sph(0.06*s,8,6), M(0x5a9a3a), x+0.04*s, h*0.4, z, parent); lf.scale.set(1.6,0.25,0.7); lf.rotation.z=0.4;
  return head.position.clone().add(new THREE.Vector3(0,0.02*s,0)); }
function tankProps(P, theme, len, Dp, hgt, r, anims, mode){
  const S = mode==='view' ? 1 : 0.2;   // the view's tank is 12 wide; the hall's is ~2-3
  const perches=[]; const X=()=> (r()-0.5)*(len-0.3*S*5), Z=()=> -Dp/2+0.15+r()*(Dp*0.45);
  const rock=(x,z,s,c=0x8a8a84)=>{ const m=mk(G.dod(s), MF(c), x,s*0.45,z,P); m.scale.set(1.2,0.7+r()*0.4,1); m.rotation.y=r()*TAU; return m; };
  const pebble=(x,z,s,c)=>{ const m=mk(G.sph(s,10,8), M(c,{roughness:0.5}), x,s*0.4+0.12*(mode==='room'?1:0),z,P); m.scale.set(1.2,0.55,1); m.rotation.y=r()*TAU; return m; };
  const fy = mode==='room' ? 0.12 : 0;   // floor height
  const grpAt=(y)=>{ const q=new THREE.Group(); q.position.y=y; P.add(q); return q; };
  const F=grpAt(fy);
  if (theme==='pond'||theme==='river'||theme==='coast'||theme==='ocean'){
    const nr=mode==='view'?9:4; for (let i=0;i<nr;i++) rock.call(null, X(), Z(), (0.25+r()*0.45)*S*(theme==='ocean'?1.2:1), theme==='ocean'?0x6a6a7a:0x8a8478).position.y+=fy;
    if (theme==='river'||theme==='pond') for (let i=0;i<(mode==='view'?40:12);i++){ const m=pebble(X(), (r()-0.5)*Dp*0.8, (0.06+r()*0.1)*S*1.5, [0x9a948a,0x7a7468,0xb0a898,0x6a6050][i%4]); m.position.y+= (mode==='room'?0:0); }
    const nPl = mode==='view'?14:6;
    if (theme==='coast') for (let i=0;i<nPl;i++) ribbon(F, (2.4+r()*2.6)*S, 0.3*S, [0x6a7a2a,0x8a7a2a,0x5a6a28][i%3], X(), Z(), anims, r()*TAU, 10, 0.06);
    if (theme==='river') for (let i=0;i<nPl;i++) ribbon(F, (1.4+r()*2.4)*S, 0.12*S, [0x4a8a3a,0x5a9a4a][i%2], X(), Z(), anims, r()*TAU, 8, 0.12);
    if (theme==='pond'){ for (let i=0;i<nPl;i++){ const x=X(), z=Z(), h=(3.5+r()*1.8)*S; mk(G.cyl(0.03*S,0.05*S,h,5), M(0x5a7a34), x,h/2,z,F); if (i%2) mk(G.cap(0.09*S,0.4*S,4,8), M(0x5a3a22), x,h*0.82,z,F); }
      for (let i=0;i<(mode==='view'?9:4);i++){ const pad=noShadow(mk(new THREE.CircleGeometry((0.45+r()*0.4)*S, 20, 0.3, TAU-0.5), new THREE.MeshStandardMaterial({ color:0x4a8a3a, side:THREE.DoubleSide, roughness:0.6 }), X(), hgt-(mode==='room'?0.1:0.06), (r()-0.5)*Dp*0.8, P)); pad.rotation.x=-Math.PI/2; pad.rotation.z=r()*TAU;
        if (i%3===0){ const f=new THREE.Group(); f.position.copy(pad.position).add(new THREE.Vector3(0,0.02,0)); P.add(f); for (let k=0;k<8;k++){ const a=k/8*TAU, p=mk(G.sph(0.09*S,8,6), M(k%2?0xf6c0d8:0xfff0f4), Math.cos(a)*0.08*S,0.05*S,Math.sin(a)*0.08*S,f); p.scale.set(1.4,0.6,0.6); p.rotation.y=-a; p.rotation.z=0.5; } } }
      const lg=mk(G.cyl(0.18*S,0.22*S,len*0.35,10), M(0x4a3422), X(), 0.18*S, Z(), F); lg.rotation.z=Math.PI/2; lg.rotation.y=r(); }
    if (theme==='ocean'){ const cc=[0xf06a7a,0xf0a040,0xb86ad0,0xf2e0a0,0x60c0b0];
      for (let i=0;i<(mode==='view'?10:4);i++){ const x=X(), z=Z(), c=cc[i%5]; const co=new THREE.Group(); co.position.set(x,0,z); F.add(co); const br=(p,d,l,rx,rz)=>{ const m=mk(G.cyl(0.04*S*(3-d)/2,0.06*S*(3-d)/2,l*S,6), M(c), 0,0,0,p); m.geometry=m.geometry.clone(); m.geometry.translate(0,l*S/2,0); m.rotation.set(rx,0,rz); if (d<2) for (let k=0;k<2;k++){ const q=new THREE.Group(); q.position.y=l*S; m.add(q); br(q,d+1,l*0.75,(r()-0.5)*1.2,(r()-0.5)*1.2); } else mk(G.sph(0.06*S,6,5), M(c), 0,l*S,0,m); };
        if (i%3===2){ const bc=mk(G.sph(0.4*S,16,12), M(c,{roughness:0.9}), 0,0.2*S,0,co); bc.scale.y=0.7; } else if (i%3===1){ const fan=noShadow(mk(new THREE.CircleGeometry(0.7*S,18,0,Math.PI), new THREE.MeshStandardMaterial({ color:c, side:THREE.DoubleSide, roughness:0.8, transparent:true, opacity:0.9 }), 0,0.05,0,co)); fan.rotation.y=r()*TAU; } else br(co,0,0.7,0,0); }
      for (let i=0;i<(mode==='view'?5:2);i++){ const an=new THREE.Group(); an.position.set(X(),0,Z()); F.add(an); for (let k=0;k<10;k++){ ribbon(an, 0.5*S, 0.05*S, 0xf8a0c0, Math.cos(k)*0.08*S, Math.sin(k)*0.08*S, anims, k, 4, 0.12); } } }
    if (theme==='coast'){ for (const id of ['starfish','scallop','sanddollar']) if (ITEMS[id]){ const m=wrapModel(id, 0.45*S*2); m.position.set(X(), m.userData.h/2, Z()+Dp*0.25); F.add(m); } }
  } else {
    // terrariums
    const grass=(x,z,h,c)=>{ for (let k=0;k<5;k++){ const b=mk(G.cone(0.03*S,h,4), M(c), x+(r()-0.5)*0.15*S, h/2, z+(r()-0.5)*0.15*S, F); b.rotation.set((r()-0.5)*0.5,0,(r()-0.5)*0.5); } };
    const mound=(x,z,s,c)=>{ const m=mk(G.sph(s,12,8), M(c,{roughness:1}), x,0,z,F); m.scale.y=0.45; };
    const n=mode==='view'?1:0.4;
    for (let i=0;i<18*n;i++) grass(X(), (r()-0.5)*Dp*0.8, (0.4+r()*0.7)*S, theme==='night'?0x3a5a3a:[0x5a9a3a,0x7aaa44][i%2]);
    for (let i=0;i<8*n;i++) mound(X(), (r()-0.5)*Dp*0.7, (0.3+r()*0.4)*S, theme==='night'?0x34502e:0x5f8a3a);
    for (let i=0;i<22*n;i++){ const lf=mk(G.sph(0.1*S,6,4), M([0xc87a3a,0xa8642a,0xd8a040,0x8a6a2a][i%4]), X(), 0.01, (r()-0.5)*Dp*0.85, F); lf.scale.set(1.5,0.15,0.8); lf.rotation.y=r()*TAU; }
    if (mode==='view'){ const bc = theme==='night'?[0x24402c,0x2e4a30,0x1e3626]:[0x4a8a3a,0x5a9a44,0x3e7a34,0x6aaa4a];
      for (let i=0;i<9;i++){ const bx=-len/2+0.6+i*(len-1.2)/8+(r()-0.5)*0.5, bz=-Dp/2+0.55+r()*0.5, bs=0.5+r()*0.45; const bu=new THREE.Group(); bu.position.set(bx,0,bz); F.add(bu);
        for (let k=0;k<9;k++){ const a=r()*TAU, rr=r()*bs*0.8, lf=mk(G.sph(0.32*bs+0.1,10,8), M(bc[(i+k)%bc.length],{roughness:0.85}), Math.cos(a)*rr, 0.25+r()*bs*1.3, Math.sin(a)*rr*0.6, bu); lf.scale.set(1.3,0.7,0.9); lf.rotation.set(r(),r()*TAU,r()); } }
      for (let i=0;i<6;i++){ const fx=(r()-0.5)*(len-1), fz=-Dp*0.05+(r()-0.5)*Dp*0.5; for (let k=0;k<7;k++) ribbon(F, 0.6+r()*0.5, 0.12, theme==='night'?0x2e5034:0x4f8f3a, fx+Math.cos(k)*0.05, fz+Math.sin(k)*0.05, anims, k*0.9+r(), 6, 0.05); } }
    // a branch across the tank
    const bx=-len*0.42, pts=[new THREE.Vector3(bx,0,-Dp*0.3), new THREE.Vector3(bx+len*0.15,hgt*0.35,-Dp*0.2), new THREE.Vector3(bx+len*0.42,hgt*0.55,-Dp*0.1), new THREE.Vector3(bx+len*0.62,hgt*0.5,0)];
    const cv=new THREE.CatmullRomCurve3(pts); const bm=new THREE.Mesh(new THREE.TubeGeometry(cv, 20, 0.08*S, 8), M(0x6a4a30,{roughness:1})); bm.castShadow=true; F.add(bm);
    for (let i=1;i<=4;i++){ const p=cv.getPoint(i/4); perches.push({ p:p.clone().add(new THREE.Vector3(0,0.09*S+F.position.y,0)), kind:'branch' }); }
    for (let i=0;i<10*n;i++){ const p=cv.getPoint(0.3+r()*0.7); const lf=mk(G.sph(0.14*S,8,6), M(0x5a9a3a), p.x+(r()-0.5)*0.3*S, p.y+0.1*S, p.z+(r()-0.5)*0.3*S, F); lf.scale.set(1.6,0.25,0.8); lf.rotation.set(r()-0.5, r()*TAU, r()-0.5); }
    if (theme==='meadow'||theme==='garden'){ const cols=[0xf490b0,0xf8d850,0xffffff,0xb090f0,0xf08a50];
      for (let i=0;i<(mode==='view'?11:4);i++){ const x=(i/(mode==='view'?10:3)-0.5)*(len-0.6*S*3)+(r()-0.5)*0.4*S, z=-Dp*0.1+(r()-0.5)*Dp*0.5; const top=flowerAt(F, x, z, (0.9+r()*1.5)*S*(mode==='view'?0.85:1), S*(mode==='view'?3.6:2.2), cols[i%5], r); perches.push({ p:top.add(new THREE.Vector3(0,F.position.y,0)), kind:'flower' }); } }
    if (theme==='garden'){ const pr=1.1*S*(mode==='view'?1:1.6); const pool=noShadow(mk(new THREE.CircleGeometry(pr, 28), new THREE.MeshStandardMaterial({ color:0x4a8ab8, roughness:0.1, metalness:0.1 }), len*0.28, 0.02, Dp*0.12, F)); pool.rotation.x=-Math.PI/2;
      for (let k=0;k<14;k++){ const a=k/14*TAU; rock(len*0.28+Math.cos(a)*pr, Dp*0.12+Math.sin(a)*pr, 0.12*S, 0x9a948a).position.y=0.05*S; }
      perches.push({ p:new THREE.Vector3(len*0.28, F.position.y+0.03, Dp*0.12), kind:'pool', r:pr*0.75 }); }
    if (theme==='wood'){ const st=mk(G.cyl(0.55*S,0.65*S,1.2*S,14), M(0x6a4a30,{roughness:1}), len*0.3, 0.6*S, -Dp*0.15, F); mk(G.cyl(0.52*S,0.52*S,0.02,14), M(0xd8b088), len*0.3, 1.21*S, -Dp*0.15, F);
      perches.push({ p:new THREE.Vector3(len*0.3, F.position.y+1.22*S, -Dp*0.15), kind:'stump' }, { p:new THREE.Vector3(len*0.3, F.position.y+0.6*S, -Dp*0.15+0.62*S), kind:'trunk' });
      const sand=noShadow(mk(new THREE.CircleGeometry(len*0.2, 24), M(0xe0c890,{roughness:1}), -len*0.3, 0.015, Dp*0.15, F)); sand.rotation.x=-Math.PI/2; sand.receiveShadow=true;
      perches.push({ p:new THREE.Vector3(-len*0.3, F.position.y+0.02, Dp*0.15), kind:'sand', r:len*0.16 }); }
    if (theme==='night'){ const lp=new THREE.Group(); lp.position.set(len*0.25, 0, -Dp*0.15); F.add(lp); mk(G.cyl(0.03*S,0.04*S,2.6*S,6), M(0x3a3028), 0,1.3*S,0,lp);
      mk(G.sph(0.2*S,14,10), new THREE.MeshStandardMaterial({ color:0xfff4c0, emissive:0xffd070, emissiveIntensity:2, toneMapped:false }), 0,2.7*S,0,lp); glowBall(lp, 0,2.7*S,0, 1.6*S*(mode==='view'?2:1.2), 0xffd080, 0.6);
      perches.push({ p:new THREE.Vector3(len*0.25, F.position.y+2.7*S, -Dp*0.15), kind:'lamp' }); }
    perches.push({ p:new THREE.Vector3(0, F.position.y, 0), kind:'ground', r:len*0.4 });
  }
  return perches;
}

/* ---------- Fullscreen view of one tank ---------- */
const SIZE_VIEW = { S:0.8, M:1.15, L:1.6, XL:2.4 };
const BUG_VIEW = { fly:1.25, moth:1.25, dragon:1.4, bee:0.75, lady:0.6, mantis:1.1, cicada:0.85, beetle:0.75, hopper:0.85, stick:1.35, stag:1.05, rhino:1.05, pill:0.62, snail:0.8, crab:0.85, hermit:0.85, skater:0.9 };
let causticT=null;
function causticTex(){ if (causticT) return causticT; const N=128, cv=document.createElement('canvas'); cv.width=cv.height=N; const x=cv.getContext('2d'), img=x.createImageData(N,N), r=mulberry32(3), pts=[];
  for (let i=0;i<18;i++) pts.push([r()*N, r()*N]);
  for (let j=0;j<N;j++) for (let i=0;i<N;i++){ let d1=1e9, d2=1e9; for (const [px,py] of pts) for (let ox=-1;ox<=1;ox++) for (let oy=-1;oy<=1;oy++){ const d=Math.hypot(i-px-ox*N, j-py-oy*N); if (d<d1){ d2=d1; d1=d; } else if (d<d2) d2=d; }
    const v=Math.max(0, 1-(d2-d1)/5)**2*255; const k=(j*N+i)*4; img.data[k]=img.data[k+1]=img.data[k+2]=v; img.data[k+3]=255; }
  x.putImageData(img,0,0); causticT=new THREE.CanvasTexture(cv); causticT.wrapS=causticT.wrapT=THREE.RepeatWrapping; return causticT; }

export function buildTankView(group, have){
  const scene=new THREE.Scene(), fish=group.kind==='fish', T=THEME[group.theme], TW=12, TH=fish?6:4.8, TD=5, anims=[], specs=[], r=mulberry32(group.id.length*131);
  scene.background=new THREE.Color(0x120c08);
  if (fish) scene.fog=new THREE.Fog(T.fog, 9, 24);
  const cam=new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  // lights
  scene.add(new THREE.HemisphereLight(fish?0xd8f0ff:(group.theme==='night'?0x8890c8:0xfff4e0), fish?0x3a5a6a:0x5a4a30, group.theme==='night'?0.7:1.3));
  const key=new THREE.DirectionalLight(group.theme==='night'?0xb0b8ff:0xfff0d8, group.theme==='night'?0.9:2.2); key.position.set(-3,12,6); key.target.position.set(0,0,0); key.castShadow=true;
  key.shadow.mapSize.set(1024,1024); Object.assign(key.shadow.camera,{ left:-8, right:8, top:8, bottom:-8, near:1, far:30 }); key.shadow.bias=-0.0008; scene.add(key, key.target);
  const warm=new THREE.PointLight(0xffd8a0, 30, 16, 1.5); warm.position.set(0, TH-0.3, 1.5); scene.add(warm);
  // the box: painted back and sides, floor
  const back=noShadow(mk(plane(TW,TH), basic({ map:backdrop(group.theme, 1024, 512), fog:false }), 0,TH/2,-TD/2,scene));
  for (const s of [-1,1]) { const sd=noShadow(mk(plane(TD,TH), basic({ map:backdrop(group.theme, 1024, 512), color:0xb8b8b8, fog:false }), s*TW/2,TH/2,0,scene)); sd.rotation.y=-s*Math.PI/2; }
  const fg=new THREE.PlaneGeometry(TW,TD,48,20); fg.rotateX(-Math.PI/2); { const p=fg.attributes.position.array; for (let i=0;i<p.length;i+=3) p[i+1]=Math.sin(p[i]*0.9)*0.06+Math.sin(p[i+2]*1.7+p[i])*0.05+(p[i+2]<-1.5?(-1.5-p[i+2])*0.25:0); fg.computeVertexNormals(); }
  const flm=new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map:rep(floorTexOf(group.theme),4,1.8), roughness:0.95 })); flm.receiveShadow=true; scene.add(flm);
  const lid=noShadow(mk(plane(TW,TD), basic({ color:fish?(group.theme==='ocean'?0x6a9ad8:0xd8f4ff):(group.theme==='night'?0x262c50:new THREE.Color(T.top).lerp(new THREE.Color(0xfff4dc),0.4).getHex()), fog:false, side:THREE.DoubleSide }), 0,TH+0.01,0,scene)); lid.rotation.x=Math.PI/2;
  const perches=tankProps(scene, group.theme, TW, TD, TH, r, anims, 'view');
  // frame: dark wood around the glass, with a brass edge
  const fr=new THREE.Group(); fr.position.z=TD/2+0.15; scene.add(fr);
  mk(G.box(TW+1.2,0.6,0.3), darkWood(), 0,TH+0.3,0,fr); mk(G.box(TW+1.2,1.4,0.5), darkWood(), 0,-0.7,0.1,fr); for (const s of [-1,1]) mk(G.box(0.6,TH+2,0.3), darkWood(), s*(TW/2+0.3),TH/2,0,fr);
  mk(G.box(TW+0.1,0.05,0.06), brass(), 0,TH,0.12,fr); mk(G.box(TW+0.1,0.05,0.06), brass(), 0,0.02,0.12,fr);
  const sheen=noShadow(mk(plane(TW,TH), basic({ map:beamTex, color:0xffffff, transparent:true, opacity:0.05, blending:THREE.AdditiveBlending, depthWrite:false }), 0,TH/2,0.05,fr)); sheen.rotation.z=0.5; sheen.scale.set(0.3,2.2,1);
  if (fish){
    // caustics on the floor, light shafts, bubbles, and specks drifting in the deep tank
    const ct=causticTex(); const cms=[0,1].map(k=>{ const t=ct.clone(); t.needsUpdate=true; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(3+k,1.3+k*0.5);
      const m=noShadow(new THREE.Mesh(new THREE.PlaneGeometry(TW,TD), basic({ map:t, color:group.theme==='ocean'?0x4a7ac0:0x9ad8e8, transparent:true, opacity:group.theme==='pond'?0.18:0.32, blending:THREE.AdditiveBlending, depthWrite:false }))); m.rotation.x=-Math.PI/2; m.position.y=0.09+k*0.01; scene.add(m); return t; });
    anims.push((t)=>{ cms[0].offset.set(t*0.02, t*0.013); cms[1].offset.set(-t*0.016, t*0.019); });
    const shafts=[]; for (let i=0;i<6;i++){ const b=beam(scene, -TW/2+1+i*(TW-2)/5+(r()-0.5), TH+0.4, -TD*0.2+(r()-0.5)*TD*0.6, TH+0.6, 0.9+r()*0.6, 0xffffff, 0.06); b.rotation.z=0.18; b.scale.z=0.35; shafts.push([b, r()*TAU]); }
    anims.push((t)=>{ for (const [b,p] of shafts) b.material.opacity=(group.theme==='ocean'?0.035:0.06)*(0.6+0.4*Math.sin(t*0.4+p)); });
    const surf=noShadow(mk(plane(TW,TD), basic({ map:ct, color:0x8ab8d0, transparent:true, opacity:0.3, blending:THREE.AdditiveBlending, depthWrite:false, side:THREE.DoubleSide }), 0,TH-0.02,0,scene)); surf.rotation.x=Math.PI/2;
    const NB=36, bub=new THREE.InstancedMesh(G.sph(0.05,8,6), new THREE.MeshPhysicalMaterial({ color:0xffffff, transparent:true, opacity:0.55, roughness:0, clearcoat:1 }), NB); bub.castShadow=false; scene.add(bub);
    const bs=[]; const bx=TW*0.38; for (let i=0;i<NB;i++) bs.push({ y:r()*TH, x:bx+(r()-0.5)*0.3, z:-TD*0.25+(r()-0.5)*0.3, s:0.6+r()*1.2, v:0.8+r()*0.8, p:r()*TAU });
    mk(G.dod(0.28), MF(0x7a7a72), bx,0.12,-TD*0.25,scene);
    const _m=new THREE.Matrix4(), _q=new THREE.Quaternion(), _s=new THREE.Vector3(), _p=new THREE.Vector3();
    anims.push((t,dt)=>{ for (let i=0;i<NB;i++){ const b=bs[i]; b.y+=dt*b.v; if (b.y>TH-0.1) b.y=0.2; _p.set(b.x+Math.sin(t*3+b.p)*0.08*(b.y/TH+0.3), b.y, b.z); _s.setScalar(b.s*(0.6+b.y/TH*0.6)); _m.compose(_p,_q,_s); bub.setMatrixAt(i,_m); } bub.instanceMatrix.needsUpdate=true; });
    if (group.theme==='ocean'||group.theme==='pond'){ const N=260, pg=new THREE.BufferGeometry(), pa=new Float32Array(N*3); for (let i=0;i<N;i++){ pa[i*3]=(r()-0.5)*TW; pa[i*3+1]=r()*TH; pa[i*3+2]=(r()-0.5)*TD; } pg.setAttribute('position', new THREE.BufferAttribute(pa,3));
      const pts=new THREE.Points(pg, new THREE.PointsMaterial({ color:group.theme==='ocean'?0xd8e8ff:0xd8e8b0, size:0.035, transparent:true, opacity:0.6, depthWrite:false })); scene.add(pts);
      anims.push((t,dt)=>{ for (let i=0;i<N;i++){ pa[i*3+1]-=dt*0.05; pa[i*3]+=Math.sin(t*0.3+i)*dt*0.03; if (pa[i*3+1]<0) pa[i*3+1]=TH; } pg.attributes.position.needsUpdate=true; }); }
    // fish
    const BOT={ has:id=>BOT2.has(id) || !!(ITEMS[id] && ITEMS[id].model.x && BOTTOM2.has(id)) }, HOVER=HOVER2;
    for (const id of have){ const it=ITEMS[id], L=SIZE_VIEW[it.size]||1.1, m=wrapModel(id, L, 'x'); scene.add(m); m.userData.id=id; if (m.userData.u.bottom) BOTTOM2.add(id);
      const F={ id, m, L, p:new THREE.Vector3((r()-0.5)*(TW-L-1), BOT.has(id)?0.1+m.userData.h/2:0.8+r()*(TH-1.8), (r()-0.5)*(TD-1.6)), v:new THREE.Vector3(r()-0.5,0,r()-0.5).normalize().multiplyScalar(0.4),
        tgt:new THREE.Vector3(), tt:0, sp:(it.size==='XL'?0.55:it.size==='L'?0.7:0.85)*(BOT.has(id)?0.35:HOVER.has(id)?0.3:1), ph:r()*TAU, bottom:BOT.has(id), hover:HOVER.has(id), yaw:0 };
      F.pick=()=>{ const mx=TW/2-F.L/2-0.3, mz=TD/2-0.9; F.tgt.set((r()*2-1)*mx, F.bottom?F.p.y:Math.max(0.6+m.userData.h/2, Math.min(TH-0.8, F.p.y+(r()-0.5)*(F.hover?1:2.4))), (r()*2-1)*mz); F.tt=(F.hover?6:3)+r()*5; };
      F.pick(); specs.push(F); }
    anims.push((t,dt)=>{ const des=new THREE.Vector3();
      for (const F of specs){ F.tt-=dt; if (F.tt<=0 || F.p.distanceTo(F.tgt)<0.4) F.pick();
        des.subVectors(F.tgt, F.p); const d=des.length(); des.normalize().multiplyScalar(F.sp*Math.min(1, d/1.2+0.25));
        // keep a little space from the others
        for (const o of specs){ if (o===F) continue; const dx=F.p.x-o.p.x, dy=F.p.y-o.p.y, dz=F.p.z-o.p.z, dd=Math.hypot(dx,dy,dz), md=(F.L+o.L)*0.45; if (dd<md && dd>0.001){ des.x+=dx/dd*0.5; des.y+=dy/dd*0.25; des.z+=dz/dd*0.5; } }
        F.v.lerp(des, Math.min(1, dt*(F.hover?0.6:1.1))); F.p.addScaledVector(F.v, dt);
        F.p.x=THREE.MathUtils.clamp(F.p.x,-TW/2+F.L/2+0.2,TW/2-F.L/2-0.2); F.p.z=THREE.MathUtils.clamp(F.p.z,-TD/2+0.6,TD/2-0.6); F.p.y=THREE.MathUtils.clamp(F.p.y,0.15,TH-0.5);
        const sp=Math.hypot(F.v.x,F.v.z); if (sp>0.03 && !F.hover){ const want=Math.atan2(-F.v.z, F.v.x); let df=want-F.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); F.yaw+=df*Math.min(1,dt*2.5); }
        else if (F.hover){ const want=F.v.x>=0?0:Math.PI; let df=want-F.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); F.yaw+=df*Math.min(1,dt*0.8); }
        F.m.position.set(F.p.x, F.p.y+(F.bottom?0:Math.sin(t*1.1+F.ph)*0.05), F.p.z); F.m.rotation.set(0, F.yaw, F.bottom?0:THREE.MathUtils.clamp(F.v.y*0.6,-0.4,0.4), 'YZX');
        const tl=F.m.userData.u.tail; if (tl) tl.rotation.y=Math.sin(t*(4+sp*8)+F.ph)*(0.2+Math.min(0.35,sp*0.6));
        if (F.id==='ray') F.m.rotation.x=Math.sin(t*1.6+F.ph)*0.12; if (F.m.userData.u.idle) F.m.userData.u.idle(t); } });
  } else {
    // bugs: flyers drift between flowers and branches and rest with their wings slowly opening; crawlers potter about
    const FLY=new Set(['fly','moth','dragon','bee']);
    const ofKind=k=>perches.filter(p=>p.kind===k), ground=perches.find(p=>p.kind==='ground');
    const spot=(P)=>{ if (P.r){ const a=r()*TAU, d=Math.sqrt(r())*P.r; return P.p.clone().add(new THREE.Vector3(Math.cos(a)*d, 0, Math.sin(a)*d*0.6)); } return P.p.clone(); };
    const used=new Map();
    for (const id of have){ const it=ITEMS[id], w=bugMove(it), L=it.model.w ? (BUG_VIEW[w]||0.6) : bugLen(it), m=wrapModel(id, L); scene.add(m); m.userData.id=id; const fly=FLY.has(w)||(w==='beetle'&&!!it.model.glow);
      let home; const wh=it.move||it.where;
      const pools = wh==='pond' ? ofKind('pool') : wh==='beach' ? ofKind('sand') : wh==='trunk' ? [...ofKind('branch'),...ofKind('stump'),...ofKind('trunk')] : wh==='flower' ? (ofKind('flower').length?ofKind('flower'):ofKind('branch')) : wh==='ground' ? [ground] : [...ofKind('flower'),...ofKind('branch'),...ofKind('stump'),...ofKind('lamp')];
      const list=pools.filter(Boolean).length?pools.filter(Boolean):[ground];
      const pickPerch=()=>{ let best=null, bn=1e9; for (const P of list){ const n=(used.get(P)||0)+r()*0.8; if (n<bn){ bn=n; best=P; } } used.set(best,(used.get(best)||0)+1); return best; };
      const B={ id, m, L, fly, w, h:m.userData.h, perch:pickPerch(), state:'rest', tt:2+r()*5, ph:r()*TAU, from:new THREE.Vector3(), to:new THREE.Vector3(), ctl:new THREE.Vector3(), k:0, yaw:r()*TAU, walk:null, lampy:group.theme==='night' };
      const sit=(P)=>{ const p=spot(P); p.y+=B.h*0.5; if (P.kind==='flower'||P.kind==='branch'||P.kind==='lamp') p.y+=0.02; return p; };
      B.at=sit(B.perch); m.position.copy(B.at); if (fly) B.yaw=(r()<0.5?1:-1)*Math.PI/2;
      B.go=()=>{ used.set(B.perch, Math.max(0,(used.get(B.perch)||1)-1)); B.perch=pickPerch(); B.from.copy(B.m.position); B.to.copy(sit(B.perch)); B.ctl.copy(B.from).lerp(B.to,0.5); B.ctl.y=Math.max(B.from.y,B.to.y)+1.2+r()*1.2; B.k=0; B.state='fly'; B.dur=Math.max(1.6, B.from.distanceTo(B.to)/1.3); };
      specs.push(B); }
    const _a=new THREE.Vector3(), _b=new THREE.Vector3();
    anims.push((t,dt)=>{ for (const B of specs){ const wings=B.m.userData.u.wings||[];
      if (B.state==='fly'){ B.k=Math.min(1,B.k+dt/B.dur); const k=B.k, u=1-k; _a.set(u*u*B.from.x+2*u*k*B.ctl.x+k*k*B.to.x, u*u*B.from.y+2*u*k*B.ctl.y+k*k*B.to.y+Math.sin(t*5+B.ph)*0.06*Math.sin(k*Math.PI), u*u*B.from.z+2*u*k*B.ctl.z+k*k*B.to.z);
        if (B.lampy && B.perch.kind==='lamp' && k>0.4){ const a=t*1.6+B.ph, rr=0.6*(1-k)+0.25; _a.x+=Math.cos(a)*rr; _a.z+=Math.sin(a)*rr*0.7; }
        _b.subVectors(_a, B.m.position); if (_b.lengthSq()>1e-6){ const want=Math.atan2(_b.x,_b.z); let df=want-B.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); B.yaw+=df*Math.min(1,dt*6); }
        B.tilt=(B.tilt||0)*Math.max(0,1-dt*4); B.m.position.copy(_a); B.m.rotation.set(B.tilt,B.yaw,0,'YXZ'); for (const wg of wings) wg.rotation.z=wg.userData.side*Math.sin(t*(B.w==='bee'?40:B.w==='dragon'?30:16)+B.ph)*0.75;
        if (B.k>=1){ B.state='rest'; B.tt=(B.w==='bee'?2:4)+r()*6; B.restYaw=(r()<0.5?1:-1)*Math.PI/2+(r()-0.5)*0.5; } continue; }
      B.tt-=dt;
      if (B.fly){ // butterflies rest side-on with wings up, slowly opening and closing; moths and the rest rest with wings spread
        if (B.restYaw===undefined) B.restYaw=(r()<0.5?1:-1)*Math.PI/2+(r()-0.5)*0.5;
        const wantY = B.w==='moth' ? Math.PI+(B.ph-3)*0.08 : B.restYaw; let df=wantY-B.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); B.yaw+=df*Math.min(1,dt*2);
        // moths settle head-up with their wings spread toward you, the way they sit on bark and walls
        B.tilt=(B.tilt||0)+((B.w==='moth'?-1.05:0)-(B.tilt||0))*Math.min(1,dt*2.5); B.m.rotation.set(B.tilt,B.yaw,0,'YXZ');
        const o=0.5+0.5*Math.sin(t*0.8+B.ph); for (const wg of wings) wg.rotation.z=wg.userData.side*(B.w==='fly'?0.55+o*0.75:0.05+o*0.12);
        if (B.tt<=0) B.go(); continue; }
      // crawlers: turn, take a few steps, hop now and then
      if (!B.walk && B.tt<=0){ const P=B.perch; if (P.r || P.kind==='ground'){ const to=spot(P); to.y=B.m.position.y; B.walk={ to, hop:B.w==='hopper' }; } else B.tt=3+r()*5; }
      if (B.walk){ _b.subVectors(B.walk.to, B.m.position); _b.y=0; const d=_b.length(); const want=Math.atan2(_b.x,_b.z); let df=want-B.yaw; df=Math.atan2(Math.sin(df),Math.cos(df)); B.yaw+=df*Math.min(1,dt*3);
        const sp=B.walk.hop?1.6:B.w==='snail'?0.08:B.w==='skater'?0.5:0.25;
        if (Math.abs(df)<0.5){ const st=Math.min(d, sp*dt); B.m.position.addScaledVector(_b.normalize(), st); if (B.walk.hop){ B.walk.k=(B.walk.k||0)+st; B.m.position.y=B.at.y+Math.sin(Math.min(1,B.walk.k/Math.max(0.01,d+B.walk.k))*Math.PI)*0.5; } }
        if (d<0.05){ if (B.walk.hop) B.m.position.y=B.at.y; B.walk=null; B.tt=2+r()*6; } }
      B.m.rotation.set(0,B.yaw,0); for (const wg of wings) wg.rotation.z=wg.userData.side*0.05; } });
  }
  // camera: looks into the glass; drag pans along the tank and turns it a touch
  const view={ pan:0, panT:0, yaw:0, yawT:0, zoom:1, follow:null };
  function update(t, dt, aspect){
    for (const f of anims) f(t, dt);
    cam.aspect=aspect; const fitH=TH+0.9, fitW=TW+0.5, vf=Math.tan(THREE.MathUtils.degToRad(cam.fov/2));
    const wantW=THREE.MathUtils.clamp(fitH*aspect, 5, fitW); const dist=Math.max(fitH/2/vf, wantW/2/(vf*aspect))*view.zoom;
    const visHalf=vf*aspect*dist, maxPan=Math.max(0, TW/2+0.3-visHalf);
    if (view.follow && !view.follow.m.parent) view.follow=null;
    if (view.follow) view.panT=view.follow.m.position.x;
    view.panT=THREE.MathUtils.clamp(view.panT,-maxPan,maxPan); view.pan+= (view.panT-view.pan)*Math.min(1,dt*4); view.yaw+=(view.yawT-view.yaw)*Math.min(1,dt*4);
    const cx=view.pan, cy=TH*0.48, cz=TD/2+dist, up=fish?0.25:1.1;
    cam.position.set(cx+Math.sin(view.yaw)*dist*0.25, cy+up+Math.sin(t*0.25)*0.04, cz); cam.lookAt(cx, cy-(fish?0:0.25), 0); cam.updateProjectionMatrix();
  }
  const ray=new THREE.Raycaster();
  function pick(nx, ny){ ray.setFromCamera(new THREE.Vector2(nx,ny), cam); const hits=ray.intersectObjects(specs.map(s=>s.m), true); for (const h of hits){ let o=h.object; while (o && !o.userData.id) o=o.parent; if (o) return specs.find(s=>s.m===o)||null; } return null; }
  function dispose(){ scene.traverse(o=>{ if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
  return { scene, cam, update, pick, view, specs, dispose };
}
