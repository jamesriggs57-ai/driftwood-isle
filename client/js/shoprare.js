/* =====================================================================
   v1.44 SHOP REWARDS and FISHING TIPS (game side). Items and numbers are in content.js ("v1.44 SHOP REWARDS"); models in shoprare-models.js.
   - Pemberton's back room (stall tier 3 and up): one piece a week from BACKROOM, found nowhere else, and sometimes a rare woodworking plan.
   - Marlo's rare shelf (aquarium tier 3+) and Sprig's rare seeds (garden tier 3+): extra stock each day, see RARE_SHELF.
   - What's biting: Marlo tips for home waters (better with his shop tier), Gill tips for Cay Bay (better with his boat).
     A tip is true: while the told fish is biting where you were told, a spawn there has a small extra chance (TIPS.swap) to be it.
   Saved state: S.shops.general.back (the week's roll) and S.day.tips (today's tips, and who you asked). Both live under keys that already sync.
   ===================================================================== */
import { mulberry32, hashStr, inMonths } from './util.js';
import { ITEMS, BACKROOM, RARE_SHELF, TIPS, SPRIG_RARE_IDS, rarityLabel } from './content.js';

const WHERE = { sea:'off the beach', pond:'in the pond', river:'in the river', bay:'out by the cays' };
const SHADOW = { S:'a little shadow', M:'a middling shadow', L:'a big shadow', XL:'a huge shadow' };
const h12 = h => { h=((h%24)+24)%24; return (h%12||12)+(h<12?' AM':' PM'); };
// a rough time of day for an hours range ([start,end), may wrap midnight)
function roughTime(hrs){ if (!hrs) return 'all day'; const [s,e]=hrs, len=(e-s+24)%24||24, mid=(s+len/2)%24;
  if (len>=16) return 'most of the day'; if (mid>=21||mid<4) return 'at night'; if (mid<10) return 'in the morning'; if (mid<16) return 'in the middle of the day'; return 'in the evening'; }
const exactTime = hrs => hrs ? `between ${h12(hrs[0])} and ${h12(hrs[1])}` : 'all day long';

export function createShopRare(C){
  const S=()=>C.S(); let devWeek=0;

  /* ---------- extra daily stock: Marlo's rare shelf, Sprig's rare seeds ---------- */
  function extraStock(id){ if (C.TRIP() || C.VISIT() || C.GUEST()) return []; const t=C.shopTier(id), n=(RARE_SHELF[id]||[])[t]||0; if (!n) return [];
    const pool = id==='aquarium' ? Object.values(ITEMS).filter(i=>i.special && i.shop==='aquarium' && (i.tier||0)<=t).map(i=>i.id)
      : id==='garden' ? SPRIG_RARE_IDS.filter(p=>ITEMS[p].sprig<=t).map(p=>p+'_seeds') : [];
    const r=mulberry32(hashStr(C.today()+':rareshelf:'+id+':'+(S().seed||0))), a=pool.slice(), out=[];
    while (out.length<n && a.length) out.push(a.splice(Math.floor(r()*a.length),1)[0]); return out; }
  const onRareShelf = id => !!(ITEMS[id] && (ITEMS[id].special || ITEMS[id].sprig));

  /* ---------- Pemberton's back room ---------- */
  const backOpen = () => !C.VISIT() && !C.GUEST() && !C.TRIP() && C.shopTier('general')>=BACKROOM.minTier;
  const week = () => Math.floor(C.sday()/7)+devWeek;
  function back(){ const st=S().shops.general, wk=week();
    if (!st.back || st.back.wk!==wk){ const got=(st.back&&st.back.got)||[], r=mulberry32(hashStr('back:'+wk+':'+(S().seed||0)));
      let pool=BACKROOM.ids.filter(id=>!got.includes(id)); if (!pool.length) pool=BACKROOM.ids.slice();
      const piece=pool[Math.floor(r()*pool.length)], plans=C.unfoundPlans(), pr=r(), plan=plans.length ? plans[Math.floor(r()*plans.length)].plan : null;
      st.back={ wk, piece, sold:false, plan, planRoll:pr, got }; C.save(); }
    return st.back; }
  // the plan shows when this week's roll beats the odds for the shop's tier now (so investing mid-week can open it up)
  const backPlan = b => b.plan && ITEMS[b.plan] && b.planRoll < (BACKROOM.planOdds[C.shopTier('general')]||0) && !C.knowsPlan(ITEMS[b.plan].learns) ? b.plan : null;
  const daysLeft = () => 7 - (((C.sday()%7)+7)%7);
  function backHTML(){ const b=back(), id=b.piece, it=ITEMS[id], price=C.buyPrice('stall', it), pl=backPlan(b), seen=b.got.length;
    let h=`<div class="muted" style="margin-bottom:8px">Pemberton's back room. One piece a week, things he picks up on his travels. You won't find them anywhere else. New piece in ${daysLeft()} day${daysLeft()>1?'s':''}.</div>`;
    h+=`<div class="row"><img src="${C.thumb(id)}"><div class="grow"><div class="nm">${it.name} ${C.rarityTag(it)}</div><div class="sub">${C.fmt(price)} clams${price!==it.buy?` <s>${C.fmt(it.buy)}</s>`:''} · back room only</div></div><button class="btn" data-bk="piece" ${b.sold||S().clams<price?'disabled':''}>${b.sold?'Sold':'Buy'}</button></div>`;
    if (pl){ const fid=ITEMS[pl].learns; h+=`<div class="notice" style="margin-top:10px"><b>Under a dust sheet</b> <span class="muted">· a rare woodworking plan</span><div class="row" style="margin:8px 0 0"><img src="${C.thumb(fid)}"><div class="grow"><div class="nm">${ITEMS[pl].name} ${C.rarityTag(ITEMS[pl])}</div><div class="sub">${C.fmt(C.PLAN_PRICE)} clams · teaches you to make it. You still need the rare ingredients.</div></div><button class="btn" data-bk="plan" ${S().clams<C.PLAN_PRICE?'disabled':''}>Buy</button></div></div>`; }
    h+=`<div class="muted" style="margin-top:10px">You've found ${seen} of ${BACKROOM.ids.length} back room pieces.</div>`;
    return h; }
  function buyBack(kind){ if (C.noEdit()) return false; const b=back();
    if (kind==='piece'){ const id=b.piece, price=C.buyPrice('stall', ITEMS[id]); if (b.sold || S().clams<price) return false; if (!C.canAdd(id)){ C.toast('Your bag is full.'); return false; }
      S().clams-=price; C.addTrade('stall', price); b.sold=true; if (!b.got.includes(id)) b.got.push(id); const r=C.addItem(id); C.Snd.coin(); C.updateHUD(); C.itemToast(id, r==='new', 'Bought'); C.save(); return true; }
    if (kind==='plan'){ const pl=backPlan(b); if (!pl || S().clams<C.PLAN_PRICE) return false; S().clams-=C.PLAN_PRICE; C.addTrade('stall', C.PLAN_PRICE); C.updateHUD(); C.Snd.coin(); C.learnPlan(pl); C.save(); return true; }
    return false; }
  const bindBack = (root, rerender) => root.querySelectorAll('[data-bk]').forEach(el=>el.onclick=()=>{ if (buyBack(el.dataset.bk)) rerender(); });

  /* ---------- What's biting ---------- */
  // tip level 0-3: Marlo by his shop tier, Gill by his boat (none, rowboat... up to his best)
  const tipLevel = who => who==='marlo' ? C.shopTier('aquarium') : Math.max(0, Math.min(3, C.boatTier()+1));
  function tipPool(who){ const m=C.month(), ok=i=>i && i.kind==='fish' && (i.rarity??5)>=TIPS.minRarity && (i.rarity??5)<=TIPS.maxRarity && inMonths(m,i.months) && C.allowedFind(i);
    if (who==='gill') return [...new Set(C.bayIds())].map(id=>ITEMS[id]).filter(ok);
    const W=C.homeWaters(); return Object.values(ITEMS).filter(i=>ok(i) && W.includes(i.where)); }
  // today's two tip fish for each teller, picked once a day and kept, so asking twice gives the same answer
  function tips(who){ const D=S().day, T=(D.tips=D.tips||{}); if (T[who] && T[who].every(id=>ITEMS[id])) return T[who];
    const r=mulberry32(hashStr(C.today()+':tips:'+who+':'+(S().seed||0))), a=tipPool(who).sort((x,y)=>x.id<y.id?-1:1), out=[];
    while (out.length<2 && a.length) out.push(a.splice(Math.floor(r()*a.length),1)[0].id);
    T[who]=out; C.save(); return out; }
  const told = who => !!((S().day.tips||{}).told||{})[who];
  // the fish a tip covers: the first, plus the second at the top level
  const tipped = who => told(who) ? tips(who).slice(0, tipLevel(who)>=3 ? 2 : 1) : [];
  function tipLine(who, id, L, second){ const it=ITEMS[id], where=who==='gill' ? WHERE.bay : (WHERE[it.where]||'out there'), sh=SHADOW[it.size]||'a shadow';
    if (L<=0) return `Something's biting ${where} today. That's all I know.`;
    if (L===1) return `There's ${sh} ${where} today. ${rarityLabel(it.rarity)}, by the look of it.`;
    if (L===2) return `Keep an eye out for the ${it.name} ${where} today, ${it.hours ? 'mostly '+roughTime(it.hours) : 'any time of day'}.`;
    return `${second?'And the':'Keep an eye out for the'} ${it.name} ${where} today, ${exactTime(it.hours)}. It shows as ${sh}.`; }
  function tell(who){ const L=tipLevel(who), list=tips(who); if (!list.length) return null;
    const D=S().day; ((D.tips=D.tips||{}).told=D.tips.told||{})[who]=true; C.save();
    const lines=[tipLine(who, list[0], L)]; if (L>=3 && list[1]) lines.push(tipLine(who, list[1], L, true));
    return lines; }
  const OUTRO = { marlo:['That\'s what my regulars are saying, anyway.','Better gear in the shop, better gossip at the counter. Funny how that works.'],
    gill:['Take it or leave it. Fish don\'t read the paper.','A bigger boat sees more water. I\'d know more with a bigger boat. Just saying.'] };
  const NONE = { marlo:'Nothing worth telling today, mate. Just the usual tiddlers.', gill:'Quiet out there today. Just the regulars.' };
  function tipDialog(who, k, back){ const lines=tell(who), L=tipLevel(who);
    if (!lines) { C.dialog(k.name, k.voice, [NONE[who]], back); return; }
    C.dialog(k.name, k.voice, [...lines, L<3 ? OUTRO[who][1] : OUTRO[who][0]], back); }
  // swap a spawn for a tipped fish now and then, if that fish is in this spawn's pool (so only where and when it's really biting)
  function tipSwap(sp, pool, who, rnd=Math.random){ if (C.TRIP()) return sp; for (const id of tipped(who)){ if (id===sp.id) return sp; const f=pool.find(i=>i.id===id); if (!f) continue;
      if (rnd() < (TIPS.swap[rarityLabel(f.rarity)]||0)) return f; } return sp; }

  /* ---------- dialog choices ---------- */
  function keeperChoices(id, k, menu){ if (C.VISIT() || C.GUEST() || C.TRIP()) return [];
    if (id==='general' && backOpen()) return [{ label:'The back room', fn:()=>{ const first=!S().shops.general.back; back();
      C.dialog(k.name, k.voice, first ? ['Ah, you\'ve earned a look. Come on through, mind the boxes.','One piece a week back here. Things I pick up on my travels. You won\'t find them anywhere else.'] : ['Back room\'s open. Mind the boxes.'], ()=>C.openShop('stall','back')); } }];
    if (id==='aquarium') return [{ label:'What\'s biting?', fn:()=>tipDialog('marlo', k, menu) }];
    return []; }
  const gillChoices = (k, back) => C.gillTips() ? [{ label:'What\'s biting?', fn:()=>tipDialog('gill', k, back) }] : [];

  const dev = { nextWeek(){ devWeek++; return back(); }, back, tips, tipped, tipLevel, tell, tipLine, extraStock, tipSwap, tipPool };
  return { extraStock, onRareShelf, backOpen, backHTML, bindBack, buyBack, keeperChoices, gillChoices, tipSwap, dev };
}
