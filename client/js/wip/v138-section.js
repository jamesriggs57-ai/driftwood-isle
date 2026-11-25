/* =====================================================================
   v1.38 ISLAND STORIES PHASE 2 (design: claude/driftwood-isle-quests.md, sections 3, 6 and 7).
   - relics: each of Wendell's isles now needs an old thing that remembers the sunken land. They lie buried under
     rune stones on trip islands. He attunes you to one the first time he asks for it, with a ticket to the right kind
     of isle. His other conditions are reworked and stay hidden: he only hints (hall, trade, museum, a neighbor's
     dream, the price). The day after an isle rises, he writes to you about where the next one is.
   - Hollis's apiary: six colors of flowers in bloom near the hives doubles the honey and opens a fourth tier.
   - Mabel's Tea Room (once there's honey and fruit): Clementine runs the project, then Mabel buys fruit, honey and
     garden crops at half again their price. Islanders take tea on the terrace.
   - the lighthouse: Skipper Wick wants it lit. A lens from Marlo, a lamp frame from the workshop, three moonpearls.
     Lit, it draws night fish into Cay Bay and Wick runs a night voyage once a week.
   - Pemberton's Forge on Hollow Crags: iron into fittings overnight, and iron furniture.
   - Thistle's Reef Hall: Marlo's giant tank, ten cuttings of grown coral from the bay, every bay fish donated.
     A walk-through reef beside the museum.
   - workshop commissions: four-poster bed, boat bookcase, long table (and the lamp frame).
   Old saves load as they were: nothing here starts until you talk to the right person.
   ===================================================================== */
const sday2 = () => dayNum(today());

/* ---------- relics ---------- */
const RELIC_THEME = { relic_acorn:'orchard', relic_leystone:'shipwreck', relic_frostpine:'frost', relic_amber:'fossil', relic_moonsap:'moonlit', relic_coralcrown:'coral' };
const relicSt = () => { const R=SY.relic || (SY.relic={}); R.att=R.att||{}; R.free=R.free||{}; return R; };
const andList = L => L.length>1 ? L.slice(0,-1).join(', ')+' and '+L[L.length-1] : (L[0]||'');
const relicMissing = q => (q.Qd.relics||[]).filter(id=>countItem(id)<1);
function relicAttune(q){ const R=relicSt(), fresh=[]; for (const id of relicMissing(q)){ R.att[id]=true; if (!R.free[id]){ R.free[id]=true; fresh.push(id); } } return fresh; }
function relicLines(miss, fresh){ if (!miss.length) return [];
  const L=[`The old land sleeps deep. To wake it I need things that remember it: ${andList(miss.map(id=>'a '+ITEMS[id].name))}. Such things wash up on the far isles, if one has patient eyes.`];
  if (fresh.length) L.push(fresh.length>1 ? 'Here. Tickets from Skipper Wick. He owes me a favor, and those are the isles I\'d start with.' : 'Here. A ticket from Skipper Wick. He owes me a favor, and that\'s the isle I\'d start with.');
  return L; }
function relicGifts(fresh, done){ for (const id of fresh){ const t='ticket_'+RELIC_THEME[id]; if (!ITEMS[t]) continue; const r=addItem(t); if (r) itemToast(t, r==='new', 'Received'); else dropNear(t, player.pos, 1.2); } save(); if (done) done(); }
// the relics you're looking for right now (Wendell has asked, you don't have them yet)
function wantedRelics(){ if (VISIT || GUEST || TRIP || !S.magic || !S.magic.tower) return []; const q=isleQuest(); if (!q || !q.asked) return []; const R=relicSt(); return (q.Qd.relics||[]).filter(id=>R.att[id] && countItem(id)<1); }
// is one buried on the island you're about to sail to? Its own kind of isle 60%, another themed isle 15%, a plain one 5%
function rollTripRelic(theme){ const want=wantedRelics(); if (!want.length) return null; const own=want.filter(id=>RELIC_THEME[id]===theme), r=Math.random(), any=()=>want[Math.floor(Math.random()*want.length)];
  if (own.length) return r<0.6 ? own[0] : null;
  if (theme && theme!=='plain') return r<0.15 ? any() : null;
  return r<0.05 ? any() : null; }
// on the trip island: a rune stone, and the relic buried at its foot
function setupRelic(){
  const id=BOOT.trip && BOOT.trip.relic; if (!id || !ITEMS[id] || !id.startsWith('relic_')) return;
  if (!TX.relic){ const r=tripRand('relic'); let p=null;
    for (let k=0;k<400 && !p;k++){ const a=r()*TAU, d=(0.2+r()*0.6)*islandR(a), x=Math.cos(a)*d, z=Math.sin(a)*d;
      if (!walkable(x,z) || blocked(x,z,1.4) || !walkable(x,z+1.3) || blocked(x,z+1.3,0.6) || rawHeight(x,z)<SAND_H+0.2 || hillSlope(x,z)>1.1 || Math.hypot(x-DOCK.x0,z-DOCK.z)<14 || hiddenSpot(x,z) || onBridge(x,z)) continue;
      if (TX.map && Math.hypot(TX.map.x-x, TX.map.z-z)<6) continue; p=[x,z]; }
    if (!p) return; TX.relic={ id, x:+p[0].toFixed(1), z:+p[1].toFixed(1), dug:false }; save(); }
  const R=TX.relic, stone=S2.buildRuneStone(hashStr(R.id)), rune=stone.userData.rune;
  new Thing('runestone', R.x, R.z, 0.7, stone, 'Look', ()=>dialog('A rune stone', 420, R.dug ? ['An old standing stone, carved with runes. It has gone quiet now.'] : ['An old standing stone, carved with runes nobody has read in a long time.','They hum when you stand close. Something is buried at its foot.']),
    { hit:[0.8,1.0], update:(th,dt,t)=>{ if (rune && rune.material) rune.material.emissiveIntensity = R.dug ? 0.05 : 0.35+Math.sin(t*2.2)*0.25; } });
  if (!R.dug) new SecretDig(R.x, R.z+1.15, ()=>true, pos=>{ R.dug=true; save(); dropNear(R.id, pos, 0.3, true); Snd.jingle(); sparkle(pos.clone().add(new THREE.Vector3(0,0.6,0))); toast(`${ITEMS[R.id].name}!`, thumb(R.id), 'new', 'Something old, that remembers the sunken land. Wendell will want this.'); }, true);
  if (!R.dug) setTimeout(()=>toast('Something on this island is humming.', null, '', 'Wendell said to keep patient eyes.'), 2800); }

/* ---------- Wendell's isles: what he needs before he'll raise the next one ---------- */
const WEN = {
  hall:'Land answers to a gathered people. Your hall is... modest. The ley lines run thin where few gather.',
  shops:'A growing island needs a growing trade. When your merchants prosper, the ground will feel it.',
  museum:'The land wants to be remembered before it rises. Thistle\'s halls are still half empty.',
  dream:'Not yet. Something on this island is still waiting on you. Listen to your neighbors.',
  timber:'That bluff would need a trestle of sawn timber, and nobody on this island can saw it. Yet.',
  price:'Everything is ready but the price. Magic of this size is not cheap.' };
// in order: hall, trade, museum, a neighbor's dream (the relics and the price are checked around this)
function isleBlock(kind){
  const hall=S.town.hall||0, mt=museumTierNow();
  if (S.devMagic && DEV) return null;
  if (kind==='meadow'){ if (hall<1) return WEN.hall; if (shopsBacked()<1) return WEN.shops; }
  if (kind==='dunes'){ if (shopTier('aquarium')<1) return WEN.shops; if (mt<1) return WEN.museum; }
  if (kind==='pines'){ if (hall<2) return WEN.hall; if (shopTier('general')<1) return WEN.shops; if (!SY.shop || SY.shop.st==='pending') return WEN.dream; }
  if (kind==='bluff'){ if (mt<3) return WEN.museum; if (!(SY.shop && SY.shop.st==='open')) return WEN.timber; }
  if (kind==='crags'){ if (['general','aquarium','garden'].some(k=>shopTier(k)<2)) return WEN.shops; if (reefStage()<4) return WEN.dream; }
  return null; }
function isleQuest(){
  const kind=nextIsleKind(); if (!kind) return null; const n=ISLE_K.length, Qd=ISL.isleQuestFor(kind), st=(S.magic.isleQ=S.magic.isleQ||{}), now=dayNum(today());
  const wait = n>0 ? Math.max(0, Qd.days-(now-(st.last||0))) : 0, block=isleBlock(kind);
  return { n, kind, Qd, st, wait, ready:!block, block, asked: st.asked===kind || st.asked===n && !st.askedK }; }
function isleChoices(menu){
  if (VISIT || GUEST || TRIP || !S.magic.tower) return []; const q=isleQuest(); if (!q) return [];
  const W=WIZARD, v=W.voice;
  if (q.n===0 && q.block) return [];   // the first isle isn't mentioned until the island is ready for it (as in v1.36)
  if (q.wait>0) return [{ label:'Any more land out there?', fn:()=>dialog(W.name, v, [`Patience. The sea is still settling after the last one. Give it ${q.wait} more day${q.wait>1?'s':''}.`], menu) }];
  return [{ label: q.asked ? 'About the new land...' : 'You look distracted', fn:()=>{
    if (noEdit()) return;
    const dev=S.devMagic && DEV;
    if (!q.asked){ q.st.asked=q.kind; q.st.askedK=true; const miss=relicMissing(q), fresh=dev?[]:relicAttune(q); save();
      dialog(W.name, v, [...isleAsk(q,'ask'), ...(dev?[]:relicLines(miss, fresh))], ()=>relicGifts(fresh, menu)); return; }
    const miss=dev?[]:relicMissing(q);
    if (miss.length){ const fresh=relicAttune(q); save(); dialog(W.name, v, relicLines(miss, fresh), ()=>relicGifts(fresh, menu)); return; }
    if (q.block){ dialog(W.name, v, [q.block], menu); return; }
    const need=q.Qd.need.filter(x=>!haveNeed(x));
    if (need.length){ dialog(W.name, v, [`Not yet. I still need ${andList(need.map(([id,k])=>`${k} ${isleNeedName(id,k)}`))}.`, 'The sea isn\'t going anywhere. Well. It is, but slowly.'], menu); return; }
    if (S.clams<q.Qd.clams){ dialog(W.name, v, [WEN.price, `${fmt(q.Qd.clams)} clams, and we can begin.`], menu); return; }
    dialog(W.name, v, ['You have everything? Let me see...'], null, [
      { label:`Raise it (${fmt(q.Qd.clams)})`, fn:()=>{ if (S.clams<q.Qd.clams || q.Qd.need.some(x=>!haveNeed(x)) || (!dev && relicMissing(q).length)) return menu();
          takeFor(q.Qd.need); if (!dev) for (const id of (q.Qd.relics||[])) removeItem(id,1); S.clams-=q.Qd.clams; updateHUD(); track('isle'); dialog(W.name, v, isleAsk(q,'done'), ()=>raiseIsle(q.n, q.kind)); } },
      { label:'Not yet', alt:true, fn:menu } ]); } }]; }
// a day after an isle rises, Wendell writes about the next one (which way to look, nothing more)
const COMPASS=['east','northeast','north','northwest','west','southwest','south','southeast'];
function isleDirWord(kind){ try { const kinds=[...ISLE_K, kind]; mainOnly=true; const plan=ISL.planIsles(kinds, { seed:S.seed|0, SC, shore:a=>islandR(a)*1.03, ok:landingOK, angles:S.terra.isleA||[] })[ISLE_K.length]; mainOnly=false;
  if (!plan) return null; const a=Math.atan2(-plan.cz, plan.cx); return COMPASS[((Math.round(a/(Math.PI/4))%8)+8)%8]; } catch(e){ mainOnly=false; return null; } }
function wendellLetter(){ if (VISIT || GUEST || TRIP || !SY.wl || sday2()<=SY.wl.day) return; const kind=nextIsleKind(); delete SY.wl; save(); if (!kind) return; const dir=isleDirWord(kind); if (!dir) return;
  S.letters.inbox.unshift({ id:'L'+Date.now().toString(36)+'w', from:'wendell', name:WIZARD.name, lines:[`I walked the shore last night and felt something under the water to the ${dir}. Older than the last. Come and see me.`, 'Wendell'], gift:null, at:today(), read:false });
  save(); setTimeout(()=>toast('A letter from Wendell', null, 'new', 'Read it from Menu > Pen pals.'), 2600); }

/* ---------- Hollis's apiary ---------- */
const BEE_COLORS=6;
INCOME.bees.tiers.push({ name:'Grand Apiary', cost:500000, per:14, gate:()=>!!(SY.apiary && SY.apiary.st==='done') });
function colorFam(c){ const r=(c>>16&255)/255, g=(c>>8&255)/255, b=(c&255)/255, mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2, d=mx-mn;
  if (l<0.2) return 'dark'; if (d<0.12) return l>0.6 ? 'white' : 'dark';
  let h = mx===r ? ((g-b)/d)%6 : mx===g ? (b-r)/d+2 : (r-g)/d+4; h*=60; if (h<0) h+=360;
  if (h<15 || h>=345) return l>0.72 ? 'pink' : 'red'; if (h<42) return 'orange'; if (h<70) return 'yellow'; if (h<165) return 'green'; if (h<255) return 'blue'; if (h<290) return 'purple'; return 'pink'; }
// how many colors are in bloom near the hives
function hiveColors(){ const I=incOf('bees'); if (!I.at) return 0; const fams=new Set();
  for (const p of S.plants){ const P=PLANTS[p.sp]; if (!P || P.ptype!=='flower' || (p.stage??3)<3 || Math.hypot(p.x-I.at[0],p.z-I.at[1])>16) continue; fams.add(colorFam(p.color??(P.colors||[0xffffff])[0])); }
  return fams.size; }
function apiaryChoices(back){ const D=INCOME.bees, v=D.voice, nm=D.who, I=incOf('bees'), A=SY.apiary;
  if (VISIT || GUEST || I.tier<0 || !ISLE_K.includes('meadow')) return [];
  if (!A) return [{ label:'The bees seem restless', fn:()=>{ if (noEdit()) return; SY.apiary={ st:'asked', d:sday2() }; save();
    dialog(nm, v, ['They\'ve been out over that new meadow every day. They come back fussy.','They want variety. One kind of flower is like eating the same soup every day.','Plant a real mix of colors near the hives and see what they make of it.'], back); } }];
  if (A.st!=='asked') return [];
  return [{ label:'How are the bees?', fn:()=>{ const n=hiveColors();
    if (n>=BEE_COLORS){ if (noEdit()) return; A.st='done'; A.done=sday2(); save(); Snd.fanfare(); refreshIncome();
      dialog(nm, v, ['Hear that? That\'s a happy hive.','Every color out there makes a different honey, and they\'re making twice what they did.','If you ever want to go big, I\'ve got plans for a Grand Apiary.'], back); return; }
    dialog(nm, v, [n ? `They're working the ${n===1?'one color':`${n} colors`} in bloom near the hives. They want more variety than that.` : 'Nothing much in bloom near the hives. They want flowers, and lots of different colors.'], back); } }]; }

/* ---------- placing a story building on the main island ---------- */
var S2B = { tea:null, teaKey:'', forge:null, forgeKey:'', hall:null, hallKey:'' };
function storySpot(tag, near, dmin, dmax, rad, zoff=0){
  const r=mulberry32(hashStr(tag+':v138:'+S.seed));
  const ok=(x,z)=>walkable(x,z) && !inRects(x,z,0.3) && !gardenAtXZ(x,z) && !keptOut(x,z) && !onBridge(x,z) && !onDock(x,z) && rawHeight(x,z)>SAND_H+0.25;
  for (let n=0;n<4000;n++){ const a=r()*TAU, d=dmin+r()*(dmax-dmin), x=near[0]+Math.cos(a)*d, z=near[1]+Math.sin(a)*d, cz=z+zoff;
    if (isleAt(x,cz) || inLotZone(x,cz,rad)) continue;
    if (Object.entries(PLACES).some(([k,p])=>p && Math.hypot(x-p[0],cz-p[1])<rad+(k==='plaza'?5:k==='board'?1.5:4))) continue;
    if (RESIDENTS.some(R=>R.home && Math.hypot(x-R.home[0],cz-R.home[1])<rad+4)) continue;
    if (INC_IDS.some(k=>S.income[k] && S.income[k].at && Math.hypot(x-S.income[k].at[0],cz-S.income[k].at[1])<rad+3.5)) continue;
    if ([SY.tea,SY.reefhall].some(o=>o && o.at && Math.hypot(x-o.at[0],cz-o.at[1])<rad+6)) continue;
    let fine=ok(x,cz), lo=99, hi=-99;
    for (let i=0;i<16 && fine;i++){ const aa=i/16*TAU; for (const rr of [rad, rad*0.55]){ const px=x+Math.cos(aa)*rr, pz=cz+Math.sin(aa)*rr; if (!ok(px,pz)){ fine=false; break; } const h=rawHeight(px,pz); lo=Math.min(lo,h); hi=Math.max(hi,h); } }
    if (!fine || hi-lo>0.8) continue;
    const pd=visPathDist(x,cz); if (pd<rad*0.7 || pd>rad+7) continue;
    if (S.plants.some(q=>Math.hypot(q.x-x,q.z-cz)<rad+0.5) || S.placed.some(q=>q.x<500 && Math.hypot(q.x-x,q.z-cz)<rad+0.5)) continue;
    if (ents.some(e=>!e.removed && e.solid && e.pos.x<500 && !(e instanceof Resident) && !(e instanceof Keeper) && !(e instanceof Tree && !e.rec) && Math.hypot(e.pos.x-x,e.pos.z-cz)<rad+e.r)) continue;
    return [+x.toFixed(1), +z.toFixed(1)]; }
  return null; }
// wild trees step aside, and nothing grows back there
function claimSpot(p, rad, zoff=0){ KEEPOUT.push([p[0], p[1]+zoff, rad]); clearPatch(p[0], p[1]+zoff, rad+0.5); }
for (const [D,rad,zoff] of [[SY.tea,5.6,1.4],[SY.reefhall,4.8,0]]) if (D && D.at) KEEPOUT.push([D.at[0], D.at[1]+zoff, rad]);
function storySmoke(add){ for (const e of [S2B.tea, S2B.forge]) if (e && !e.removed) add(e); }
function refreshStory2(){ if (TRIP || GUEST) return; for (const f of [refreshTea, refreshForge, refreshReefHall]){ try { f(); } catch(e){ console.warn('v1.38', e); } } }

/* ---------- Mabel's Tea Room ---------- */
DREAM_FOR.tea='mabel';
const TEA_PROJECT={ clams:150000, need:[['plank',40],['stone',20]] }, TEA_RATE=1.5, TEA_KINDS=['fruit','veg','herb','berry'];
const BEATS2 = { tea:{
  dream:['I\'ve always wanted a little tea room. Cakes, jam, a window seat.','But you can\'t bake without honey and fruit, and you can\'t have a tea room without a room.','Well. There\'s honey now, and fruit. I wonder if Clementine would help with the room.'],
  dreamg:['Mabel always talked about opening a little tea room. Cakes, jam, a window seat.','There\'s honey on the island now, and fruit. I\'ve half a mind to do it myself. I wonder if Clementine would help with the room.'],
  open:['The tea room is open! Come and sit on the terrace any time.','Bring me fruit, honey, anything from the garden. I\'ll pay you more than the shops do. Cakes don\'t bake themselves.'] } };
const teaOpen = () => !!(SY.tea && SY.tea.st==='open');
function teaPrice(s){ const it=ITEMS[s.id]; if (!it || !(TEA_KINDS.includes(it.kind) || s.id==='honey')) return null; return Math.round(entryPrice(s)*TEA_RATE); }
function refreshTea(){
  const D=SY.tea, key = !D ? '' : D.st==='open' ? 'open' : ['project','building'].includes(D.st) ? 'site' : '';
  if (key===S2B.teaKey) return; S2B.teaKey=key; if (S2B.tea){ S2B.tea.remove(); setRects('tearoom',[]); S2B.tea=null; } if (!key) return;
  if (!D.at){ if (VISIT) return; const p=storySpot('tea', PLACES.plaza||[0,0], 11, 34, 5.4, 1.4); if (!p){ S2B.teaKey=''; return; } D.at=p; claimSpot(p, 5.6, 1.4); save(); }
  const [x,z]=D.at, model = key==='open' ? S2.buildTeaRoom() : S2.buildSite(6.2, 4.4, holderName('tea')+'\'s', 'Tea Room', 'stone');
  S2B.tea=placeBuilding('tearoom', x, z, model, key==='open'?'Tea Room':'Look', ()=> key==='open' ? openTeaRoom() : dialog('Building site', 420, [D.st==='building' ? 'The builders are working through the night. It\'ll be open in the morning.' : `${holderName('tea')}'s tea room will go here, once the town has raised the money. Clementine at the town hall is running the project.`]));
  refreshSmoke(); }
function openTeaRoom(){
  const D=SY.tea, own=npcName(D.owner||dreamHolder('tea'));
  if (VISIT){ dialog(`${own}'s Tea Room`, 420, ['Cakes under glass, a pot always on, and a window seat with a view of the sea.']); return; }
  const render=()=>{ let h=`<div class="notice"><b>${own}'s Tea Room</b><br><span class="muted">${own} buys fruit, honey and anything from the garden at half again what it's worth, for the cakes and jam. ${fmt(D.nsold||0)} sold so far.</span></div>`;
    const rows=[]; S.inv.forEach((s,i)=>{ const p=teaPrice(s); if (p!==null) rows.push([i,s,p]); });
    if (!rows.length) h+=`<div class="notice"><span class="muted">Nothing in your bag ${own} can bake with right now.</span></div>`;
    else { h+=`<div class="notice"><b>Sell to ${own}</b>`; for (const [i,s,p] of rows) h+=`<div class="row"><img src="${thumb(s.id)}"><div class="grow"><div class="nm">${ITEMS[s.id].name}${s.n>1?' x'+s.n:''}</div><div class="sub">${fmt(p)} clams each</div></div><button class="btn alt" data-ts="${i}">Sell 1</button>${s.n>1?` <button class="btn" data-ta="${i}">All</button>`:''}</div>`; h+='</div>'; }
    h+=stakeHTML('tea'); pBody.innerHTML=h; bindStake('tea', render);
    const sell=(i,n)=>{ if (noEdit()) return; const s=S.inv[i]; if (!s) return; const p=teaPrice(s); if (p===null) return; n=Math.min(n,s.n); removeAt(i,n); addClams(p*n); track('earned',p*n); D.nsold=(D.nsold||0)+n; Snd.coin(); save(); render(); };
    pBody.querySelectorAll('[data-ts]').forEach(b=>b.onclick=()=>sell(+b.dataset.ts,1)); pBody.querySelectorAll('[data-ta]').forEach(b=>b.onclick=()=>sell(+b.dataset.ta,1e9)); };
  openPanel(`${own}'s Tea Room`); render(); }
// Clementine's project (in the town hall panel)
function teaProjectHTML(){ const D=SY.tea; if (!D || !['project','building'].includes(D.st)) return ''; const nm=holderName('tea');
  if (D.st==='building') return `<div class="notice"><b>${nm}'s Tea Room</b><br>The builders are at it tonight. It'll open tomorrow!</div>`;
  const fund=D.fund||0, left=Math.max(0,TEA_PROJECT.clams-fund), mat=!!D.mats, ok=!left && mat;
  return `<div class="notice"><b>${nm}'s Tea Room</b><br><span class="muted">A little tea room near the plaza, with a terrace for the whole town.</span>
    <div style="margin-top:8px"><b>${fmt(fund)}</b> of ${fmt(TEA_PROJECT.clams)} clams raised</div><div class="bar" style="margin:6px 0"><div style="width:${Math.min(100,fund/TEA_PROJECT.clams*100)}%"></div></div>
    ${left>0?`<div style="display:flex;gap:6px;flex-wrap:wrap">${[1000,10000].map(n=>`<button class="btn alt" data-tf="${n}" ${S.clams<Math.min(n,left)?'disabled':''}>Chip in ${fmt(Math.min(n,left))}</button>`).join('')}<button class="btn" data-tf="${left}" ${S.clams<1?'disabled':''}>Chip in ${fmt(Math.min(left,S.clams))}</button></div>`:''}
    <div style="margin-top:8px">${mat?'Building materials delivered.':`The builders need ${needText(TEA_PROJECT.need)}.`}</div>${mat?'':`<button class="btn alt" id="tfMat" style="margin-top:6px" ${TEA_PROJECT.need.every(x=>haveNeed(x))?'':'disabled'}>Hand over the materials</button>`}
    ${ok?'<button class="btn" id="tfGo" style="margin-top:8px">Start building</button>':''}</div>`; }
function bindTeaProject(render){
  pBody.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{ if (noEdit()) return; const D=SY.tea, left=TEA_PROJECT.clams-(D.fund||0), n=Math.min(+b.dataset.tf, left, S.clams); if (n<=0) return; S.clams-=n; D.fund=(D.fund||0)+n; Snd.coin(); updateHUD(); save(); render(); });
  const m=pBody.querySelector('#tfMat'); if (m) m.onclick=()=>{ if (noEdit() || !TEA_PROJECT.need.every(x=>haveNeed(x))) return; takeFor(TEA_PROJECT.need); SY.tea.mats=true; save(); Snd.thunk(); render(); };
  const g=pBody.querySelector('#tfGo'); if (g) g.onclick=()=>{ if (noEdit()) return; SY.tea.st='building'; SY.tea.bday=sday2(); save(); Snd.fanfare(); toast('The builders start tonight!', null, 'new', `${holderName('tea')}'s Tea Room will open tomorrow.`); refreshTea(); render(); }; }
// islanders take tea on the terrace: each chair goes to whoever the day's roll picks, in 40-minute sittings, 10 to 6
function teaSeatOf(res){ if (!teaOpen() || !S2B.tea || !SY.tea.at) return null; const h=Time.hour(); if (h<10 || h>=18) return null;
  const pool=S.town.res, slot=Math.floor(h*60/40);
  for (let k=0;k<S2.TEA_SEATS.length;k++){ const pick=pool[Math.floor(mulberry32(hashStr(today()+':tea:'+k+':'+slot+':'+S.seed))()*pool.length*1.7)]; if (pick===res.spec.id) return k; }
  return null; }
function teaUnsit(res){ if (res.teaK===undefined) return; res.teaK=undefined; const u=res.obj.userData; (u.legs||[]).forEach(l=>l.rotation.x=0); res.pos.y=groundY(res.pos.x,res.pos.z); res.obj.position.copy(res.pos); }
function teaSit(res, dt, t){
  if (res.loc!=='out'){ teaUnsit(res); return false; } const k=teaSeatOf(res); if (k===null){ teaUnsit(res); return false; }
  const [sx,sz,ry]=S2.TEA_SEATS[k], [cx,cz]=SY.tea.at, x=cx+sx, z=cz+sz;
  if (res.teaK!==k){ teaUnsit(res); const d=Math.hypot(x-res.pos.x, z-res.pos.z);
    if (d>0.3){ if (d>45 || !res.moveToward(new THREE.Vector3(x,0,z), dt, 1.7, t)){ if (d>45 || (res.stuckT=(res.stuckT||0)+dt)>5){ res.pos.set(x,groundY(x,z),z); res.obj.position.copy(res.pos); res.stuckT=0; } } res.applyFace(dt); return true; }
    res.teaK=k; }
  res.pos.set(x, groundY(x,z), z); res.obj.position.set(x, res.pos.y+0.3, z); res.face=ry; res.obj.rotation.y=ry; const u=res.obj.userData; (u.legs||[]).forEach(l=>l.rotation.x=-1.4); if (u.body) u.body.position.y=0; return true; }
// a pot of tea with someone on the terrace: a little friendship, once a day each
const TEA_CHAT=['Sit, sit! Mabel\'s scones are still warm.','Best seat on the island, this. You can see the boats come in.','I come here for the jam. I stay for the gossip.','One lump or two? I\'ll pretend I didn\'t see that.','Have you tried the honey cake? Hollis\'s bees and Russet\'s apples. Heaven.'];
function teaChoices(res, menu){ if (VISIT || GUEST || res.teaK===undefined) return []; const id=res.spec.id, T=(S.day.tea=S.day.tea||{});
  return [{ label:'Share a pot of tea', fn:()=>{ const first=!T[id]; if (first){ T[id]=1; S.friend[id]=(S.friend[id]||0)+1; save(); }
    dialog(res.spec.name, res.spec.voice, [fill(TEA_CHAT[Math.floor(Math.random()*TEA_CHAT.length)], { c:res.spec.catch })], menu); } }]; }

/* ---------- the lighthouse and night voyages ---------- */
const LENS_COST=10000, NIGHT_FEE=8000;
const lightLit = () => !!(SY.light && SY.light.st==='lit');
const nightBay = () => lightLit() && reefStage()>=3 ? NIGHT_BAY.filter(id=>ITEMS[id]) : [];
const bluffIsle = () => ISLES.find(I=>I.kind==='bluff');
function lighthouseAct(lm){
  const nm=ISL.ISLE_INFO.bluff.name, L=SY.light;
  if (lightLit()) return dialog(nm, 420, ['The lamp turns slow and steady. Out at sea, the far isles catch its light.']);
  if (!L || VISIT || GUEST) return dialog(nm, 420, [lm.userData.desc]);
  const lens=L.lens===2, frame=countItem('lampframe')>0, pearls=countItem('moonpearl')>=3;
  const lines=[lm.userData.desc]; if (lens) lines.push('Marlo\'s new lens is up here, wrapped in sailcloth and waiting.');
  if (lens && frame && pearls) return dialog(nm, 420, lines, null, [
    { label:'Fit the lamp', fn:()=>{ if (noEdit() || countItem('lampframe')<1 || countItem('moonpearl')<3) return; removeItem('lampframe',1); removeItem('moonpearl',3);
        L.st='lit'; L.litDay=sday2(); save(); if (lm.userData.setLit) lm.userData.setLit(true); Snd.fanfare(); const p=player.pos.clone().add(new THREE.Vector3(0,3,0)); for (let i=0;i<5;i++) setTimeout(()=>sparkle(p.clone().add(new THREE.Vector3((Math.random()-0.5)*3,Math.random()*3,(Math.random()-0.5)*3))), i*160);
        dialog(nm, 420, ['The frame goes in, then the lens. Three moonpearls in the cradle, and the whole lamp room fills with a soft silver light.','Somewhere down at the dock, Skipper Wick is going to be very happy.']); } },
    { label:'Not yet', alt:true, fn:()=>{} } ]);
  dialog(nm, 420, lines); }
function lightChoicesMarlo(k, menu){
  if (VISIT || GUEST || !SY.light || SY.light.st==='lit') return []; const L=SY.light, v=k.voice, nm=k.name;
  if (L.lens===1) return [{ label:'About that lens...', fn:()=>dialog(nm, v, ['Grinding it now. Rings and rings of glass, like a seashell. I\'ll carry it up the bluff myself tomorrow.'], menu) }];
  if (L.lens) return [];
  return [{ label:'A lens for the lighthouse?', fn:()=>dialog(nm, v, ['A lighthouse lens! Ground glass in rings, like the inside of a shell. Throws light for miles.',`I can make one. ${fmt(LENS_COST)} clams, and I'll carry it up the bluff myself tomorrow.`], null, [
    { label:`Order it (${fmt(LENS_COST)})`, fn:()=>{ if (noEdit()) return; if (S.clams<LENS_COST){ dialog(nm, v, ['Bit short, mate. No rush.'], menu); return; } S.clams-=LENS_COST; L.lens=1; L.lensDay=sday2(); updateHUD(); save(); Snd.coin(); dialog(nm, v, ['Lovely. It\'ll be up there by morning.'], menu); } },
    { label:'Not yet', alt:true, fn:menu } ]) }]; }
STAKES.wick={ unit:'ticket_moonlit', place:'in the night voyages', extraWord:t=>`now and then a Moonlit ticket`,
  tiers:[{ name:'A share', cost:25000, per:800, extra:0.15 }, { name:'Partner', cost:120000, per:2000, extra:0.3 }, { name:'Co-owner', cost:400000, per:4500, extra:0.5 }],
  due:()=>!!(SY.light && (SY.light.nv||0)>=1),
  offer:['Folks will pay for the dark. You\'ll get a cut of every fare.','Put some clams into the boat and a share of the takings is yours, with a ticket now and then.'] };
// what Wick says about the lighthouse (called from his menu)
function wickChoices(go, back){
  if (VISIT || GUEST || !SY.light) return []; const L=SY.light, v=SKIPPER.voice, nm=SKIPPER.name, out=[];
  if (!lightLit()) return [{ label:'About the lighthouse...', fn:()=>dialog(nm, v, [L.lens===2 ? 'Marlo\'s lens is up there already. Now it wants a frame and something to burn.' : 'It\'d want a new lens. Marlo knows glass. Bramble could build a frame. And the old keepers burned moonpearls, three at a time.'], back) }];
  if (stakeOfferDue('wick')) out.push({ label:'How are the night voyages?', fn:()=>{ stakeOffer('wick'); dialog(nm, v, STAKES.wick.offer, back); } });
  const wait=7-(sday2()-(L.lastNV??-99));
  out.push(wait<=0 ? { label:`Night voyage (${fmt(NIGHT_FEE)})`, fn:()=>go('moonlit', null, null, NIGHT_FEE) }
    : { label:'Night voyage?', fn:()=>dialog(nm, v, [`Once a week, no more. The dark's not for every night. Come back in ${wait} day${wait>1?'s':''}.`], back) });
  if (stakeOf('wick').offered) out.push({ label:'Your share', fn:()=>{ openPanel('Night voyages'); const render=()=>{ pBody.innerHTML=stakeHTML('wick'); bindStake('wick', render); }; render(); } });
  return out; }

/* ---------- Pemberton's Forge on Hollow Crags ---------- */
const FORGE_PROJECT={ clams:200000, need:[['iron',30],['stone',30],['plank',20]] }, FIT_IRON=5, fitCap=()=>10, FORGE_FURN=[['ironlantern',4,1500],['irongate',8,2500],['weathervane',5,2000]];
const cragsIsle = () => ISLES.find(I=>I.kind==='crags');
STAKES.forge={ unit:'fitting', place:'in the forge', tiers:[{ name:'A share', cost:30000, per:900, extra:1 }, { name:'Partner', cost:140000, per:2200, extra:2 }, { name:'Co-owner', cost:420000, per:4800, extra:3 }],
  due:()=>!!(SY.forge && SY.forge.st==='open' && (SY.forge.made||0)>=10),
  offer:['You found the iron. A share of the forge is only right.','Put some clams in and you get a cut of what it brings in, and a few fittings besides. Come by the forge.'] };
STAKES.tea={ unit:'teacake', place:'in the tea room', tiers:[{ name:'A share', cost:25000, per:800, extra:1 }, { name:'Partner', cost:120000, per:2000, extra:2 }, { name:'Co-owner', cost:400000, per:4500, extra:3 }],
  due:()=>!!(SY.tea && SY.tea.st==='open' && sday2()-(SY.tea.built||0)>=7 && (SY.tea.nsold||0)>=30),
  offer:['The tea room\'s paying for itself already. I want you to have a slice.','Put some clams in and a share of the takings is yours, with a few cakes besides. Come by the tea room.'] };
function forgeChoices(k, menu){
  if (VISIT || GUEST) return []; const v=k.voice, nm=k.name, F=SY.forge;
  if (!F){ if (!ISLE_K.includes('crags')) return [];
    return [{ label:'You look thoughtful', fn:()=>{ SY.forge={ st:'dream', d:sday2() }; save(); dialog(nm, v, ['Every nail and hinge on this island comes over on the boat, and I pay through the nose.','With iron like that up in the crags, a forge would pay for itself.','I\'d need someone to work it with me, mind. An apprentice. And a fair bit of money.'], menu); } }]; }
  if (F.st==='open'){ if (stakeOfferDue('forge')) return [{ label:'How\'s the forge?', fn:()=>{ stakeOffer('forge'); dialog(nm, v, STAKES.forge.offer, menu); } }];
    return [{ label:'The forge', fn:()=>openForge() }]; }
  if (F.st==='building') return [{ label:'About the forge...', fn:()=>dialog(nm, v, ['The builders are up on the crags tonight. Hot work. It\'ll be lit by morning.'], menu) }];
  return [{ label:'About the forge...', fn:()=>{
    if (!F.app || !livesHere(F.app)){ const ok=S.town.res.filter(id=>(S.friend[id]||0)>=10);
      if (!ok.length){ dialog(nm, v, ['I need an apprentice. Strong, patient, doesn\'t mind soot on their nose.','Nobody here knows me well enough to sign up for that. Somebody who\'d do it for you, maybe. A good friend of yours.'], menu); return; }
      dialog(nm, v, ['I need an apprentice. Strong, patient, doesn\'t mind soot on their nose. Who would you ask?'], null, [
        ...ok.slice(0,4).map(id=>({ label:npcName(id), fn:()=>{ F.app=id; save(); Snd.jingle(); dialog(nm, v, [`${npcName(id)}? Good choice. I'll have a word.`], menu); } })),
        { label:'Never mind', alt:true, fn:menu } ]); return; }
    const P=FORGE_PROJECT, has=P.need.every(x=>haveNeed(x));
    dialog(nm, v, [`${npcName(F.app)} is keen. Now the forge itself.`, `${fmt(P.clams)} clams, ${needText(P.need)}. I'll have it built on the crags overnight.`], null, [
      { label:`Build it (${fmt(P.clams)})`, fn:()=>{ if (noEdit()) return; if (S.clams<P.clams || !P.need.every(x=>haveNeed(x))){ dialog(nm, v, ['Not quite enough yet. The crags will wait.'], menu); return; }
          takeFor(P.need); S.clams-=P.clams; F.st='building'; F.bday=sday2(); updateHUD(); save(); Snd.fanfare(); refreshForge(); dialog(nm, v, ['Right. Tomorrow morning there\'ll be smoke over the crags.'], menu); } },
      { label:'Not yet', alt:true, fn:menu } ]); } }]; }
function refreshForge(){
  const I=cragsIsle(); if (!I || !I.ready) return; const F=SY.forge, key=!F?'': F.st==='open'?'open': F.st==='building'?'site':'';
  if (key===S2B.forgeKey) return; S2B.forgeKey=key; if (S2B.forge){ S2B.forge.remove(); setRects('forge',[]); S2B.forge=null; } if (!key) return;
  const [x,z]=SY.cragsAt||workshopSpot(I), model = key==='open' ? S2.buildForge() : S2.buildSite(5.6, 4.4, 'Pemberton\'s', 'Forge', 'stone');
  S2B.forge=placeBuilding('forge', x, z, model, key==='open'?'Forge':'Look', ()=> key==='open' ? openForge() : dialog('Building site', 420, ['The builders have the hearth in already. It\'ll be lit by morning.']));
  if (I.full){ S2B.forge.obj.parent && S2B.forge.obj.parent.remove(S2B.forge.obj); OUT.add(S2B.forge.obj); }
  refreshSmoke(); }
function openForge(){
  const F=SY.forge, nm=KEEPERS.pemberton.name, app=F.app && livesHere(F.app) ? npcName(F.app) : null;
  if (VISIT){ dialog('The Forge', 420, ['A stone smithy with a glowing hearth. Somebody has hung horseshoes over the door for luck.']); return; }
  const render=()=>{ const ready=F.ready||0, ord=F.order, cap=fitCap();
    let h=`<div class="notice"><b>Pemberton's Forge</b><br><span class="muted">${FIT_IRON} iron nuggets make 1 iron fitting. Leave iron today and the fittings are ready tomorrow, up to ${cap} a day${app?`. ${app} works the bellows`:''}. ${fmt(F.made||0)} made so far.</span></div>`;
    if (ready) h+=`<div class="notice"><b>${ready} fitting${ready>1?'s':''} ready</b><br><button class="btn" id="fgTake" style="margin-top:6px">Take them</button></div>`;
    if (ord) h+=`<div class="notice">In the fire tonight: ${ord.n} fitting${ord.n>1?'s':''}.</div>`;
    else { const iron=countItem('iron'), mx=Math.min(cap, Math.floor(iron/FIT_IRON));
      h+=`<div class="notice"><b>Order fittings</b> <span class="muted">· you have ${iron} iron</span><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${[2,5].filter(n=>n<mx).map(n=>`<button class="btn alt" data-fg="${n}">${n} fittings (${n*FIT_IRON} iron)</button>`).join('')}<button class="btn" data-fg="${mx}" ${mx<1?'disabled':''}>${mx||0} fitting${mx===1?'':'s'} (${(mx||0)*FIT_IRON} iron)</button></div></div>`; }
    h+=`<div class="notice"><b>Ironwork</b> <span class="muted">· made while you wait</span>`;
    for (const [id,iron,cost] of FORGE_FURN){ const ok=countItem('iron')>=iron && S.clams>=cost; h+=`<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${ITEMS[id].name}</div><div class="sub">${iron} iron and ${fmt(cost)} clams</div></div><button class="btn alt" data-fi="${id}" ${ok?'':'disabled'}>Make it</button></div>`; }
    h+='</div>'+stakeHTML('forge');
    pBody.innerHTML=h; bindStake('forge', render);
    pBody.querySelectorAll('[data-fg]').forEach(b=>b.onclick=()=>{ if (noEdit()) return; const n=+b.dataset.fg; if (n<1 || F.order || countItem('iron')<n*FIT_IRON) return; removeItem('iron', n*FIT_IRON); F.order={ n, day:sday2() }; save(); Snd.thunk(); render(); });
    pBody.querySelectorAll('[data-fi]').forEach(b=>b.onclick=()=>{ if (noEdit()) return; const [id,iron,cost]=FORGE_FURN.find(f=>f[0]===b.dataset.fi); if (countItem('iron')<iron || S.clams<cost) return; if (!canAdd(id)){ toast('Your bag is full.'); return; }
      removeItem('iron', iron); S.clams-=cost; const r=addItem(id); updateHUD(); save(); Snd.thunk(); itemToast(id, r==='new', 'Made'); render(); });
    const tk=pBody.querySelector('#fgTake'); if (tk) tk.onclick=()=>{ let got=0; while ((F.ready||0)>0 && canAdd('fitting')){ addItem('fitting'); F.ready--; got++; } F.made=(F.made||0)+got; save(); if (got){ Snd.coin(); itemToast('fitting', false, 'Picked up'); } else toast('Your bag is full.'); render(); };
  };
  openPanel('Pemberton\'s Forge'); render(); }

/* ---------- Thistle's Reef Hall ---------- */
const REEF_TANK={ clams:100000, need:[['fitting',10]] }, CUTTINGS=10;
const bayCore = () => CORAL_KINDS.flatMap(k=>CORAL_FISH[k]).filter(id=>ITEMS[id]);
const reefHallOpen = () => !!(SY.reefhall && SY.reefhall.st==='open');
function reefHallThistle(k, menu){
  if (VISIT || GUEST) return []; const v=k.voice, nm=k.name, D=SY.reefhall;
  if (!D){ if (reefStage()<5) return [];
    return [{ label:'The reef is thriving', fn:()=>{ SY.reefhall={ st:'dream', d:sday2() }; save(); dialog(nm, v, ['I went out to the cays with Gill last week. I\'m not ashamed to say I wept.','Here is my dream. A living exhibit. Not a tank of fish, a piece of reef, growing in the museum.','A walk-through hall, glass all around. Marlo would have to build the tank. A big one.'], menu); } }]; }
  if (D.st==='open'){ if (!D.gift){ return [{ label:'The Reef Hall', fn:()=>{ D.gift=true; const r=addItem('reeftank'); if (!r) dropNear('reeftank', player.pos, 1.2); else itemToast('reeftank', r==='new', 'Received'); save();
      dialog(nm, v, ['Have you walked through it yet? Schoolchildren from three islands over have.','Here. Marlo made a little one for your home. A piece of the reef to keep.'], menu); } }]; } return []; }
  if (D.st==='dream' || D.st==='tank') return [{ label:'About the Reef Hall...', fn:()=>dialog(nm, v, [D.st==='tank' ? 'Marlo is building the tank! I keep going round to look. He keeps sending me away.' : 'It all starts with a tank. A very big one. Marlo is the only one who could build it.'], menu) }];
  if (D.st==='building') return [{ label:'About the Reef Hall...', fn:()=>dialog(nm, v, ['The builders are in tonight. We open in the morning!'], menu) }];
  return [{ label:'About the Reef Hall...', fn:()=>{
    if (countItem('cutting')<CUTTINGS){ const n=countItem('cutting'); dialog(nm, v, ['The tank is in, and it is magnificent. Now it needs a reef.',`Cuttings from grown coral out in the bay. Ten good ones.${n?` You have ${n} so far.`:''} The coral grows back, don't worry.`], menu); return; }
    const miss=bayCore().filter(id=>!S.museum.items[id]); if (miss.length){ dialog(nm, v, ['Ten cuttings! Wonderful.','But visitors should know what lives in a reef before they walk through one. Every fish from Cay Bay belongs in the aquarium first.'], menu); return; }
    dialog(nm, v, ['Ten cuttings, and every fish from the bay on display. We\'re ready.'], null, [
      { label:'Open the Reef Hall', fn:()=>{ if (noEdit() || countItem('cutting')<CUTTINGS) return; removeItem('cutting', CUTTINGS); D.st='building'; D.bday=sday2(); save(); Snd.fanfare(); refreshReefHall(); dialog(nm, v, ['The builders start tonight. Come back tomorrow, and bring everyone!'], menu); } },
      { label:'Not yet', alt:true, fn:menu } ]); } }]; }
function reefHallMarlo(k, menu){
  if (VISIT || GUEST || !SY.reefhall || SY.reefhall.st!=='dream') return []; const v=k.voice, nm=k.name, P=REEF_TANK, D=SY.reefhall;
  return [{ label:'Thistle wants a giant tank', fn:()=>dialog(nm, v, ['A walk-through tank? Glass on both sides and over your head? Mate. I\'ve dreamed about this.',`It'll take ${fmt(P.clams)} clams for the glass and ${needText(P.need)} to hold it together. The pressure on a tank that size is no joke.`], null, [
    { label:`Build it (${fmt(P.clams)})`, fn:()=>{ if (noEdit()) return; if (S.clams<P.clams || !P.need.every(x=>haveNeed(x))){ dialog(nm, v, [P.need.some(x=>!haveNeed(x)) ? 'It needs iron fittings. Pemberton\'s forge makes them.' : 'Bit short on clams, mate. I\'ll be here.'], menu); return; }
        takeFor(P.need); S.clams-=P.clams; D.st='tank'; D.tankDay=sday2(); updateHUD(); save(); Snd.fanfare(); dialog(nm, v, ['Right! I\'ll have it in the museum by morning. Tell Thistle to stop hovering.'], menu); } },
    { label:'Not yet', alt:true, fn:menu } ]) }]; }
// a cutting from a grown coral in the bay: the coral drops back a stage and grows again by tomorrow
function bayCutting(q){ if (!q.rec || plotAge(q.rec)<2 || countItem('cutting')>=CUTTINGS*2) return; if (!canAdd('cutting')){ toast('Your bag is full.'); return; }
  q.rec.d=sday2()-1; addItem('cutting'); save(); Snd.plip(); bayRipple(q.p.x, q.p.z, 1); toast(`Coral cutting (${countItem('cutting')})`, thumb('cutting'), '', 'It\'ll grow back by tomorrow.'); bayPopulate(); }
function refreshReefHall(){
  const D=SY.reefhall, key=!D?'': D.st==='open'?'open': D.st==='building'?'site':'';
  if (key===S2B.hallKey) return; S2B.hallKey=key; if (S2B.hall){ S2B.hall.remove(); setRects('reefhall',[]); S2B.hall=null; } if (!key) return;
  if (!D.at){ if (VISIT) return; const p=storySpot('reefhall', PLACES.museum, 11, 26, 4.6, 0); if (!p){ S2B.hallKey=''; return; } D.at=p; claimSpot(p, 4.8); save(); }
  const [x,z]=D.at, model = key==='open' ? S2.buildReefHall() : S2.buildSite(6.8, 6.8, 'Reef Hall', 'Opening soon', 'stone');
  S2B.hall=placeBuilding('reefhall', x, z, model, key==='open'?'Enter':'Look', ()=> key==='open' ? enterRoom('reefhall') : dialog('Building site', 420, ['A big round footing, and a crate stamped GLASS: THIS WAY UP. It opens tomorrow.']));
  if (key==='open') makeReefHallRoom(); }
function makeReefHallRoom(){
  const exit=[S2B.hall.doorPt[0], S2B.hall.doorPt[1]+0.2]; if (ROOMS.reefhall){ ROOMS.reefhall.exit=exit; return; }
  const W=12, D=15, [ox,oz]=roomOrigin(90), container=new THREE.Group(); container.visible=false; scene.add(container);
  const shell=S2.buildReefHallRoom(W, D, S.seed|0); shell.position.set(ox,0,oz); container.add(shell);
  const u=shell.userData, TW=2.6, t0=u.tz-u.TL/2, t1=u.tz+u.TL/2, bz=D/2-2.3;
  ROOMS.reefhall={ id:'reefhall', ox, oz, w:W, d:D, group:container, shell, spec:{ mood:'museum' }, entry:[ox, oz+D/2-1.2], exit, bed:[ox,oz],
    walk:(x,z)=>{ const lx=x-ox, lz=z-oz; if (lz>D/2-0.05 || lz<t0+0.3) return false;
      if (lz>t1){ if (Math.abs(lx)>W/2-0.5) return false; if (Math.abs(lx)>W/2-2.2 && Math.abs(lz-bz)<0.55) return false; return true; }
      return Math.abs(lx)<TW/2-0.3; } }; }

/* ---------- workshop commissions ---------- */
const COMMISSIONS=[ { id:'fourposter', need:[['plank',24]], clams:6000, days:2 }, { id:'boatshelf', need:[['plank',16]], clams:4000, days:1 }, { id:'longtable', need:[['plank',20]], clams:3500, days:1 },
  { id:'lampframe', need:[['plank',20],['iron',4]], clams:0, days:1, gate:()=>!!(SY.light && SY.light.st!=='lit') && !countItem('lampframe') && !(SY.shop.comm && SY.shop.comm.id==='lampframe') } ];
function commissionHTML(own){
  const D=SY.shop, c=D.comm; let h=`<div class="notice"><b>Commissions</b> <span class="muted">· big pieces, one at a time</span>`;
  if (c){ const it=ITEMS[c.id], left=c.day-sday2();
    h+= left<=0 ? `<div class="row"><img src="${thumb(c.id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">Finished!</div></div><button class="btn" id="wcTake">Take it</button></div>`
      : `<div class="row"><img src="${thumb(c.id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">${own} is working on it. Ready ${left<=1?'tomorrow':`in ${left} days`}.</div></div></div>`; }
  else for (const C of COMMISSIONS.filter(C=>!C.gate || C.gate())){ const ok=C.need.every(x=>haveNeed(x)) && S.clams>=C.clams;
    h+=`<div class="row"><img src="${thumb(C.id)}"><div class="grow"><div class="nm">${ITEMS[C.id].name}</div><div class="sub">${needText(C.need)}${C.clams?` and ${fmt(C.clams)} clams`:''} · ${C.days>1?`${C.days} days`:'overnight'}</div></div><button class="btn alt" data-wc="${C.id}" ${ok?'':'disabled'}>Order</button></div>`; }
  return h+'</div>'; }
function bindCommission(render){
  pBody.querySelectorAll('[data-wc]').forEach(b=>b.onclick=()=>{ if (noEdit()) return; const D=SY.shop, C=COMMISSIONS.find(x=>x.id===b.dataset.wc); if (!C || D.comm || !C.need.every(x=>haveNeed(x)) || S.clams<C.clams) return;
    takeFor(C.need); S.clams-=C.clams; D.comm={ id:C.id, day:sday2()+C.days }; updateHUD(); save(); Snd.thunk(); render(); });
  const tk=pBody.querySelector('#wcTake'); if (tk) tk.onclick=()=>{ const D=SY.shop, c=D.comm; if (!c || c.day>sday2()) return; if (!canAdd(c.id)){ toast('Your bag is full.'); return; } const r=addItem(c.id); D.comm=null; save(); Snd.fanfare(); itemToast(c.id, r==='new', 'Picked up'); render(); }; }

/* ---------- the day turning over, beats, gossip, the board ---------- */
function storyNewDay2(now){
  if (!SY.tea && SY.apiary && SY.apiary.st==='done' && incOf('orchard').tier>=0) SY.tea={ st:'pending', at:now+1 };
  if (SY.tea && SY.tea.st==='building' && now>SY.tea.bday){ SY.tea.st='open'; SY.tea.built=now; SY.tea.owner=dreamHolder('tea'); SY.tea.news=true; }
  if (SY.light && SY.light.lens===1 && now>SY.light.lensDay) SY.light.lens=2;
  if (SY.forge && SY.forge.st==='building' && now>SY.forge.bday){ SY.forge.st='open'; SY.forge.built=now; SY.forge.news=true; }
  if (SY.forge && SY.forge.order && now>SY.forge.order.day){ SY.forge.ready=(SY.forge.ready||0)+SY.forge.order.n; SY.forge.order=null; }
  if (SY.reefhall && SY.reefhall.st==='tank' && now>SY.reefhall.tankDay) SY.reefhall.st='cuttings';
  if (SY.reefhall && SY.reefhall.st==='building' && now>SY.reefhall.bday){ SY.reefhall.st='open'; SY.reefhall.news=true; } }
function story2News(){ const N=[];
  if (SY.tea && SY.tea.news){ SY.tea.news=false; N.push([`${npcName(SY.tea.owner||dreamHolder('tea'))}'s Tea Room is open!`, 'Out near the plaza. Bring fruit and honey.']); }
  if (SY.forge && SY.forge.news){ SY.forge.news=false; N.push(['There\'s smoke over Hollow Crags!', 'Pemberton\'s Forge is lit.']); }
  if (SY.reefhall && SY.reefhall.news){ SY.reefhall.news=false; N.push(['The Reef Hall is open!', 'Beside the museum. Walk right through the reef.']); }
  if (N.length){ save(); N.forEach(([a,b],i)=>setTimeout(()=>toast(a, null, 'new', b), 3200+i*2600)); } }
function storyBeat2(res){
  const id=res.spec.id, now=sday2(), D=SY.tea; if (!D || !isFor('tea', id)) return null;
  if (D.sold && !D.sold.told && D.sold.to===id){ D.sold.told=true; save(); return { lines:[`${npcName(D.sold.from)} left me the tea room. I'll keep the kettle on.`] }; }
  if (D.st==='pending' && now>=D.at){ D.st='project'; save(); setTimeout(()=>refreshTea(), 0); return { lines: asWritten('tea') ? BEATS2.tea.dream : BEATS2.tea.dreamg }; }
  if (D.st==='open' && !D.toldOpen){ D.toldOpen=true; save(); return { lines:BEATS2.tea.open }; }
  if (D.st==='open' && stakeOfferDue('tea')){ stakeOffer('tea', res); return { lines:STAKES.tea.offer }; }
  return null; }
const GOSSIP2 = {
  tea:{ project:['Clementine says the whole town is chipping in for a tea room. A tea room!','Mabel has been practicing scones. I\'ve had six. I regret nothing.'],
    open:['Have you had tea on the terrace? Mabel does a honey cake that would make you weep.','I spent the whole afternoon at the tea room yesterday. Don\'t tell anyone.'] },
  light:{ parts:['Skipper Wick keeps staring up at the old lighthouse.','Wick says the far isles look different at night. I wouldn\'t know. I\'m asleep.'],
    lit:['Did you see the lighthouse last night? I watched it from my window till midnight.','Wick took a boatload out after dark. They came back whispering.'] },
  forge:{ open:['You can hear the hammer from the crags all morning now. Clang, clang, clang.','Pemberton gave me a hinge. Just handed it to me. It\'s a very good hinge.'] },
  reefhall:{ open:['I walked through the Reef Hall and a ray swam right over my head!','Thistle stands at the door of the Reef Hall all day, beaming at people.'] } };
function storyGossip2(R){ const out=[];
  if (SY.tea && !isFor('tea', R.id)){ const g=GOSSIP2.tea[SY.tea.st==='building'?'project':SY.tea.st]; if (g) out.push(...g); }
  if (SY.light && R.id!=='gill'){ const g=GOSSIP2.light[SY.light.st==='lit'?'lit':'parts']; if (g) out.push(...g); }
  if (SY.forge && SY.forge.st==='open') out.push(...GOSSIP2.forge.open);
  if (reefHallOpen()) out.push(...GOSSIP2.reefhall.open);
  return out.map(l=>l.replace(/Mabel/g, SY.tea ? holderName('tea') : 'Mabel')); }
function storiesHTML2(){ const L=[];
  if (SY.relic && Object.keys(SY.relic.att||{}).length && nextIsleKind()){ const w=wantedRelics(); if (w.length) L.push(`Wendell is waiting on ${andList(w.map(id=>'a '+ITEMS[id].name))} from the far isles.`); }
  if (SY.apiary && SY.apiary.st==='asked') L.push('Hollis says the bees want more colors to choose from.');
  if (SY.tea){ const nm=holderName('tea'), st=SY.tea.st;
    if (st==='project') L.push(`Clementine is raising clams for ${nm}'s tea room.`); else if (st==='building') L.push('Builders are putting up a tea room near the plaza.'); else if (st==='open') L.push(`${npcName(SY.tea.owner||dreamHolder('tea'))}'s Tea Room is open. The terrace is never empty.`); }
  if (SY.light) L.push(lightLit() ? 'The lighthouse on Lantern Bluff is lit again. Skipper Wick runs a night voyage once a week.' : 'Skipper Wick wants the old lighthouse lit again.');
  if (SY.forge){ const st=SY.forge.st; L.push(st==='open' ? 'Pemberton\'s Forge is working on Hollow Crags.' : st==='building' ? 'A forge is going up on Hollow Crags.' : 'Pemberton has plans for a forge up on the crags.'); }
  if (SY.reefhall){ const st=SY.reefhall.st; L.push(st==='open' ? 'The Reef Hall is open beside the museum.' : st==='dream' ? 'Professor Thistle dreams of a living reef in the museum.' : st==='tank'||st==='cuttings' ? 'Marlo\'s giant tank is waiting for coral from the bay.' : 'The Reef Hall opens tomorrow!'); }
  return L; }

/* ---------- dev shortcuts ---------- */
function dev138(what){
  const q=isleQuest(); const msg=[];
  if (what==='relics'){ if (q){ for (const id of (q.Qd.relics||[])) if (!countItem(id)) addItem(id); msg.push('Relics for the '+q.kind+' in your bag.'); } }
  if (what==='stories'){
    if (!SY.apiary || SY.apiary.st!=='done'){ SY.apiary={ st:'done', d:sday2(), done:sday2() }; incOf('bees').tier=Math.max(0, incOf('bees').tier); const o=incOf('orchard'); if (o.tier<0){ o.tier=0; o.since=o.last=sday2(); o.acc=0; } msg.push('Apiary done, orchard funded.'); }
    else if (!SY.tea){ SY.tea={ st:'project', at:null }; msg.push('Tea room project started.'); }
    else if (SY.tea.st!=='open'){ SY.tea.st='building'; SY.tea.bday=sday2()-1; storyNewDay2(sday2()); msg.push('Tea room open.'); }
    else if (!SY.light){ SY.light={ st:'parts', lens:2 }; addItem('lampframe'); for (let i=0;i<3;i++) addItem('moonpearl'); msg.push('Lighthouse parts in hand: go fit the lamp.'); }
    else if (!lightLit()){ SY.light.st='lit'; SY.light.litDay=sday2(); msg.push('Lighthouse lit.'); }
    else if (!SY.forge || SY.forge.st!=='open'){ SY.forge=Object.assign(SY.forge||{}, { st:'open', built:sday2(), app:S.town.res[0] }); msg.push('Forge open (if the crags are up).'); }
    else if (!SY.reefhall){ SY.reefhall={ st:'cuttings' }; for (let i=0;i<CUTTINGS;i++) addItem('cutting'); for (const id of bayCore()) S.museum.items[id]=S.museum.items[id]||Date.now(); msg.push('Reef Hall: tank in, cuttings in your bag, bay fish donated.'); }
    else if (!reefHallOpen()){ SY.reefhall.st='open'; msg.push('Reef Hall open.'); }
    else msg.push('Every phase 2 story is open.'); }
  save(); applyTown(); toast(msg.join(' ') || 'Nothing to do.'); }
