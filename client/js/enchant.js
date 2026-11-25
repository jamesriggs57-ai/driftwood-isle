/* =====================================================================
   v1.40 TOOLS AND ENCHANTING: the game side (menus, teachers, scroll model, hooks for main.js).
   Data, numbers and rules are in enchant-core.js.
   ===================================================================== */
import * as THREE from 'three';
import { ITEMS, TOOLS } from './content.js';
import { M, mk, G, glowMat, addGlow, ITEM_BUILDERS } from './models.js';
import { ENCH, FAMILIES, TWIN, TWIN_SLOTS, POWER, CRAFT, REPAIR, SCROLL_ODDS, WORDS, migrate, fits, knows, enchOf, slotsOf, rankOn, describe, toolsText, maxUses,
  canApply, needFor, missing, apply, remove, learn, repairNeed, repairClams, repair, repairForClams, craftNeed, canCraft, craft, teachable, rank3Known, scrollPick,
  outputOf, oneSwing, luckFor, bonkPower, sureOf, bigRoll, sprayOf, sprayTargets, ONE_SWING_WOOD } from './enchant-core.js';
import { toolBench, enchBench, TWIN_BENCH, BENCH_NAME } from './benches-core.js';
export * from './enchant-core.js';

const FAM_COLOR = { tough:0x8a9aa8, bonk:0xf08a3a, lucky:0x5ac06a, output:0xd8a040, sure:0x5ab0e0, big:0x3a6ad8, spray:0x7ad8f0 };
ITEM_BUILDERS.escroll = (g, d) => {
  const c=FAM_COLOR[d.fam]||0xa070e0, paper=M(0xf2e6c8,{ roughness:0.8 });
  const roll=mk(G.cyl(0.11,0.11,0.62,16), paper, 0,0.11,0,g); roll.rotation.z=Math.PI/2;
  for (const x of [-1,1]){ mk(G.cyl(0.03,0.03,0.08,8), M(0x5a3a28), x*0.34,0.11,0,g).rotation.z=Math.PI/2; }
  for (let i=0;i<d.rank;i++){ const b=mk(G.tor(0.112,0.012,6,20), glowMat(c), (i-(d.rank-1)/2)*0.12,0.11,0,g); b.rotation.y=Math.PI/2; }
  mk(G.sph(0.045,10,8), glowMat(c), 0,0.11,0.12,g);
  addGlow(g, 0.14, 0.7, c);
};

/* =====================================================================
   THE GAME SIDE: menus, teachers, hooks. main.js builds C and calls createEnchant(C).
   C needs: S(), toast(msg,img,cls,sub), Snd, save(), countItem(id), removeItem(id,n), addItem(id), canAdd(id), dropNear(id,at,rad),
   sparkle(at), thumb(id), toolThumb(t,k), fmt(n), dialog(name,voice,lines,done,choices), openPanel(title,onClose), pBody(), pTitle(),
   closePanel(), reqMet(t,k), friend(id), updateHeld(), updateHUD(), equip(t), noEdit(), GUEST(), VISIT(), addClams(n), npcName(id)
   Optional: confirm(text, yes) for "are you sure" (falls back to dialog choices).
   ===================================================================== */
export function createEnchant(C){
  const S=()=>C.S(); const inv={ count:id=>C.countItem(id), take:(id,n)=>C.removeItem(id,n) };
  const fmt=n=>C.fmt?C.fmt(n):String(n);
  migrate(S());
  const ok=()=>!C.GUEST() && !C.VISIT();
  const matsHTML = need => need.map(([m,n])=>{ const have=C.countItem(m), good=have>=n; return `<span style="color:${good?'inherit':'#c0503a'};font-weight:${good?400:700}">${ITEMS[m]?ITEMS[m].name:m} ${have}/${n}</span>`; }).join(' · ');
  const nm = id => id==='twin' ? TWIN.name : ENCH[id].name;
  const thumbE = id => C.thumb('escroll_'+(id==='twin'?'triple':id));

  /* --- hooks called from main.js --- */
  // v1.40 crafting tables: C.bench() is the best table in reach (0 none, 1 Workbench, 2 Carpenter's Bench, 3 Master Workbench)
  const here=()=>C.bench ? C.bench() : 3;
  const applyBench=(id,c)=>Math.max(enchBench(ENCH[id].rank), c&&c.bind?TWIN_BENCH:0);
  const benchLine=b=>b>here() ? `<br><b>Needs a ${BENCH_NAME[b]}</b>` : '';
  const H = {
    maxUses:t=>maxUses(S(),t),
    // after T.uses-- in useTool: warn before an enchanted tool breaks, and say what was lost when it does
    onUse(t, T){ const mx=maxUses(S(),t), en=T.ench||[]; if (!en.length || !mx) return;
      if (T.uses<=0){ setTimeout(()=>C.toast(`The ${en.map(nm).join(' and ')} enchantment${en.length>1?'s':''} went with it.`), 900); return; }
      const warn=Math.max(3, Math.round(mx*0.1)); if (T.uses===warn) setTimeout(()=>C.toast(`Your ${TOOLS[t].tiers[T.tier].name} is wearing thin. Repair it before it breaks, or its enchantments go with it.`), 600); },
    output:t=>outputOf(S(),t), oneSwing:t=>oneSwing(S(),t), ONE_SWING_WOOD,
    luck:(key)=>luckFor(S(), key, S().equip),
    rareMult:(key)=>luckFor(S(), key, S().equip),
    bonk:()=>bonkPower(S(), S().equip),
    sure:t=>sureOf(S(),t), big:(kind,r)=>bigRoll(S(),kind,r), spray:()=>sprayOf(S()),
    sprayAround:(rec, day)=>sprayTargets(S(), rec, day),
    // a scroll in a bottle on the beach, rolled with the day's rare stream (r). Returns an item id or null.
    dailyScroll(r){ if (!ok()) return null; const a=r(); if (a>=SCROLL_ODDS.bottle) return null; return scrollPick(S(), r); },
    // a scroll from an ordinary action (dig, fell, catch). at: a THREE.Vector3
    scrollRoll(kind, at){ if (!ok() || Math.random()>=(SCROLL_ODDS[kind]||0)) return false; const id=scrollPick(S()); if (!id) return false; const p=at.clone();
      setTimeout(()=>{ C.dropNear(id, p, 1.2); if (C.sparkle) C.sparkle(p.clone().add(new THREE.Vector3(0,1,0))); C.Snd.jingle(); C.toast('An enchanting scroll!', C.thumb(id), 'new', ENCH[ITEMS[id].ench].name); }, 1000); return true; },
    // picked up an escroll_ item (from learnPlan). Returns true if it was new.
    learnScroll(itemId){ const id=ITEMS[itemId].ench; if (!learn(S(), id)) return false; C.save(); C.Snd.fanfare();
      C.toast(`Enchantment learned: ${ENCH[id].name}!`, C.thumb(itemId), 'new', describe(id)+'. Put it on a tool from the Tools tab.'); return true; },
    // the shop's buy button: say what an upgrade would cost you before replacing an enchanted tool
    replaceWarning(t){ const T=S().tools[t]; return T && T.ench && T.ench.length ? `Your ${TOOLS[t].tiers[T.tier].name} has ${T.ench.map(nm).join(' and ')} on it. A new one starts plain, and those enchantments are lost.` : ''; },
    // the shop keeper's choices (Pemberton repairs for clams)
    keeperChoices(k, menu){ if (!ok() || k.id!=='pemberton') return []; const worn=Object.keys(S().tools).filter(t=>repairClams(S(),t)>0); if (!worn.length) return [];
      return [{ label:'Fix my tools', fn:()=>repairByKeeper(k, menu) }]; },
    // a resident's choices (Pippa's lessons) and Wendell's
    teachChoices(who, menu, spec){ if (!ok()) return [];
      if (who==='pippa'){ const L=teachable(S(),'pippa', C.friend('pippa')); if (!L.length) return []; return [{ label:'Charms?', fn:()=>pippaLesson(L, menu, spec) }]; }
      if (who==='wendell'){ if (!S().magic || !S().magic.met) return []; return [{ label:'Enchanting', fn:()=>wendellLessons(menu) }]; }
      return []; },
    hasTab:()=>ok() && !!S().craft,
    renderTab, openTools:()=>{ C.openPanel('Tools'); renderTab(); },
  };

  function repairByKeeper(k, menu){
    const tools=Object.keys(S().tools).filter(t=>repairClams(S(),t)>0);
    const ch=tools.map(t=>{ const T=S().tools[t], c=repairClams(S(),t); return { label:`${TOOLS[t].tiers[T.tier].name} (${fmt(c)})`, fn:()=>{ if (C.noEdit()) return; const r=repairForClams(S(),t, n=>{ if (S().clams<n) return false; C.addClams(-n); return true; });
      if (!r.ok){ C.dialog(k.name, k.voice, [r.why==='Not enough clams.' ? 'Bit short, friend. Come back when the jar\'s fuller.' : r.why], menu); return; }
      C.Snd.coin(); C.save(); C.dialog(k.name, k.voice, ['Good as new. Mind the edge.'], menu); } }; });
    C.dialog(k.name, k.voice, ['I can fix that up. Takes no time at all.'], null, [...ch, { label:'Never mind', alt:true, fn:menu }]); }

  function pippaLesson(L, menu, spec){ const v=(spec&&spec.voice)||620, cat=(spec&&spec.catch)||'friend', first=!S().rare.ench.lessons.pippa;
    const lines = first
      ? ['Okay, so. Wendell showed me a little trick and I\'ve been DYING to show somebody.','You tie a charm onto your tool. Some string, a bit of this, a bit of that. And it just works better! Magic!','Here, I\'ll show you a few. Watch my paws, {c}.']
      : ['Ooh, I worked out some new ones! For nets and rods, and even the watering can!','Watch closely. It\'s all in the knot.'];
    const ids=L.map(x=>x.id); for (const id of ids) learn(S(), id); S().rare.ench.lessons.pippa=(S().rare.ench.lessons.pippa||0)+1; C.save(); C.Snd.fanfare();
    C.dialog('Pippa', v, lines.map(l=>l.replace('{c}', cat)), ()=>{ C.toast(`Enchantments learned: ${ids.map(nm).join(', ')}`, thumbE(ids[0]), 'new', 'Put them on a tool at a workbench, from the Tools tab in crafting.'); menu(); }); }

  function wendellLessons(menu){ const v=260, L=teachable(S(),'wendell');
    if (!L.length){ const k=S().rare.ench.known.length; C.dialog('Wendell', v, [k ? 'Put the charms you know to work first. Magic grows with use, apprentice. Come back when your tools have seen some.' : 'Enchanting? Pippa has a knack for the simple charms. Start with her. I teach the serious ones.'], menu); return; }
    const ch=L.slice(0,4).map(({id,price})=>({ label:`${nm(id)} (${fmt(price)})`, fn:()=>{ if (C.noEdit()) return; if (S().clams<price){ C.dialog('Wendell', v, ['The stars are generous. I am less so. Come back with the clams.'], menu); return; }
      C.addClams(-price); learn(S(), id); C.save(); C.Snd.magic ? C.Snd.magic() : C.Snd.fanfare();
      const text = id==='twin' ? ['The Twin Charm. Two enchantments, one tool. Bind the second with a starstone and a drop of golden sap, at a Master Workbench.','Choose your pairs wisely. A tool can only carry so much magic.'] : [`${ENCH[id].name}. ${describe(id)}.`, 'Mind you, magic on a tool is only as lasting as the tool. Keep it mended.'];
      C.dialog('Wendell', v, text, ()=>{ C.toast(`Enchantment learned: ${nm(id)}!`, thumbE(id), 'new'); menu(); }); } }));
    C.dialog('Wendell', v, ['Ah, an apprentice of the charm arts. I can teach you these, for a fee. Magic isn\'t free. Neither is tea.'], null, [...ch, { label:'Not now', alt:true, fn:menu }]); }

  /* --- the Tools tab: your tools, repair, enchant, make --- */
  let sel=null, mode='tools';
  function renderTab(tabsH='', bind){
    const pB=C.pBody(); if (C.pTitle()) C.pTitle().textContent='Tools';
    const s=S(), E=s.rare.ench, tools=Object.keys(TOOLS);
    if (sel && !s.tools[sel]) sel=null; if (!sel) sel=tools.find(t=>s.tools[t])||null;
    let h=tabsH+`<div class="tabs">${[['tools','Your tools'],['make','Make a tool'],['known','Enchantments']].map(([k,n])=>`<button class="tab${k===mode?' on':''}" data-em="${k}">${n}</button>`).join('')}</div>`;
    if (C.benchBanner) h+=C.benchBanner();
    if (mode==='tools'){
      if (!sel) h+='<div class="muted">You don\'t have any tools. Pemberton sells them, or you can make one.</div>';
      else { h+='<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">'+tools.filter(t=>s.tools[t]).map(t=>`<button class="btn ${t===sel?'':'alt'}" data-et="${t}" style="padding:4px 10px"><img src="${C.toolThumb(t,s.tools[t].tier)}" style="width:26px;height:26px;vertical-align:middle"> ${TOOLS[t].name}</button>`).join('')+'</div>';
        const T=s.tools[sel], d=TOOLS[sel].tiers[T.tier], mx=maxUses(s,sel), en=enchOf(s,sel);
        h+=`<div class="notice"><b>${d.name}</b><br><span class="muted">${d.forever?'Never breaks':`${T.uses} of ${mx} uses left`}</span>`;
        if (!d.forever) h+=`<div class="bar" style="margin-top:6px"><div style="width:${Math.max(3,T.uses/mx*100)}%"></div></div>`;
        h+=`<div style="margin-top:8px"><b>Enchantments</b> <span class="muted">· ${en.length} of ${slotsOf(s)}</span></div>`;
        if (!en.length) h+='<div class="muted">None yet.</div>';
        for (const id of en) h+=`<div class="row" style="margin:6px 0 0"><img src="${thumbE(id)}"><div class="grow"><div class="nm">${ENCH[id].name}</div><div class="sub">${describe(id,sel)}</div></div><button class="btn alt" data-erm="${id}">Remove</button></div>`;
        const rn=repairNeed(s,sel); if (rn) h+=`<div class="row" style="margin:10px 0 0"><div class="grow"><div class="nm">Repair</div><div class="sub">${matsHTML(rn)}</div></div><button class="btn" id="eRep" ${missing(rn,inv).length?'disabled':''}>Repair</button></div>`;
        h+='</div>';
        const opts=E.known.filter(id=>fits(id,sel));
        if (!E.known.length) h+='<div class="muted" style="margin-top:8px">You don\'t know any enchantments yet. Pippa might.</div>';
        else if (!opts.length) h+=`<div class="muted" style="margin-top:8px">None of the enchantments you know work on ${TOOLS[sel].name.toLowerCase()}s.</div>`;
        else { h+='<div class="notice"><b>Enchant</b>';
          for (const id of opts){ const c=canApply(s,sel,id,inv), need=c.need||needFor(id, null), on=en.includes(id), bb=applyBench(id,c), at=bb<=here();
            const note = on ? 'On this tool' : [c.replace ? `Replaces ${ENCH[c.replace].name}` : '', c.bind ? 'Two on one tool: uses the Twin Charm\'s binding too' : ''].filter(Boolean).join('. ');
            h+=`<div class="row" style="margin:8px 0 0"><img src="${thumbE(id)}"><div class="grow"><div class="nm">${ENCH[id].name}</div><div class="sub">${describe(id,sel)}${note?`<br><i>${note}</i>`:''}<br>${on?'':matsHTML(need)}${!on&&!c.ok&&!c.miss?`<br>${c.why}`:''}${on?'':benchLine(bb)}</div></div><button class="btn" data-eap="${id}" ${c.ok&&at?'':'disabled'}>${on?'On':'Enchant'}</button></div>`; }
          h+='</div>'; } } }
    if (mode==='make'){
      h+='<div class="muted" style="margin-bottom:8px">Tools you make are the same as the ones Pemberton sells, and need the same experience. A new tool starts with no enchantments. A Flimsy tool can be made anywhere. Better ones need a bigger crafting table.</div>';
      for (const t of tools){ const own=s.tools[t]; h+=`<div class="notice"><b>${TOOLS[t].name}</b> <span class="muted">· ${own?'You have: '+TOOLS[t].tiers[own.tier].name:'You don\'t have one'}</span>`;
        TOOLS[t].tiers.forEach((tr,k)=>{ const c=canCraft(s,t,k,inv,C.reqMet), need=craftNeed(t,k); if (!need) return; if (own && own.tier>=k) return; if (!C.reqMet(t,k) && k>((s.toolEver[t]??-1)+1)) return;
          h+=`<div class="row" style="margin:8px 0 0"><img src="${C.toolThumb(t,k)}"><div class="grow"><div class="nm">${tr.name}</div><div class="sub">${matsHTML(need)}${!C.reqMet(t,k)&&tr.req?`<br>${tr.req.desc}`:''}${benchLine(toolBench(k))}</div></div><button class="btn" data-emk="${t}:${k}" ${c.ok&&toolBench(k)<=here()?'':'disabled'}>Make</button></div>`; });
        h+='</div>'; } }
    if (mode==='known'){
      h+=`<div class="muted" style="margin-bottom:8px">${E.known.length} of ${Object.keys(ENCH).length} known${E.twin?' · Twin Charm: tools hold two':''}</div>`;
      for (const e of Object.values(ENCH)){ const k=knows(s,e.id);
        h+=`<div class="row" style="${k?'':'opacity:.6'}"><img src="${thumbE(e.id)}"><div class="grow"><div class="nm">${k?e.name:'???'}</div><div class="sub">${k?describe(e.id)+'<br>'+toolsText(e.id)+' · '+matsHTML(e.need):'Not learned yet'}</div></div></div>`; } }
    pB.innerHTML=h; if (bind) bind();
    pB.querySelectorAll('[data-em]').forEach(b=>b.onclick=()=>{ mode=b.dataset.em; C.Snd.click(); renderTab(tabsH, bind); pB.scrollTop=0; });
    pB.querySelectorAll('[data-et]').forEach(b=>b.onclick=()=>{ sel=b.dataset.et; C.Snd.click(); renderTab(tabsH, bind); });
    const rer=()=>{ const st=pB.scrollTop; renderTab(tabsH, bind); pB.scrollTop=st; };
    const rep=pB.querySelector('#eRep'); if (rep) rep.onclick=()=>{ if (C.noEdit()) return; const r=repair(s,sel,inv); if (r.ok){ C.Snd.coin(); C.toast(`Your ${TOOLS[sel].tiers[s.tools[sel].tier].name} is good as new.`, C.toolThumb(sel,s.tools[sel].tier)); C.save(); } rer(); };
    pB.querySelectorAll('[data-erm]').forEach(b=>b.onclick=()=>{ if (C.noEdit()) return; const id=b.dataset.erm; confirm(`Take ${ENCH[id].name} off? The charm unravels, so you'd need the ingredients again to put it back.`, ()=>{ remove(s,sel,id); C.save(); C.Snd.click(); rer(); }); });
    pB.querySelectorAll('[data-eap]').forEach(b=>b.onclick=()=>{ if (C.noEdit()) return; const id=b.dataset.eap, c=canApply(s,sel,id,inv); if (!c.ok || applyBench(id,c)>here()) return;
      const go=out=>{ const r=apply(s,sel,id,inv,out); if (!r.ok){ C.toast(r.why); return; } C.Snd.fanfare(); C.toast(`${ENCH[id].name} is on your ${TOOLS[sel].tiers[s.tools[sel].tier].name}.`, thumbE(id), 'new', describe(id,sel)+(r.removed?`. ${ENCH[r.removed].name} came off.`:'')); C.save(); C.updateHeld(); rer(); };
      const cur=enchOf(s,sel), same=cur.find(x=>ENCH[x].fam===ENCH[id].fam);
      if (same) confirm(`${ENCH[id].name} takes the place of ${ENCH[same].name}.`, ()=>go(same));
      else if (cur.length>=slotsOf(s)){ if (cur.length===1) confirm(`${ENCH[id].name} takes the place of ${ENCH[cur[0]].name}.`, ()=>go(cur[0]));
        else pick(`Which one comes off for ${ENCH[id].name}?`, cur.map(x=>({ label:ENCH[x].name, fn:()=>go(x) }))); }
      else go(null); });
    pB.querySelectorAll('[data-emk]').forEach(b=>b.onclick=()=>{ if (C.noEdit()) return; const [t,k]=b.dataset.emk.split(':'), kk=+k, c=canCraft(s,t,kk,inv,C.reqMet); if (!c.ok || toolBench(kk)>here()) return;
      const go=()=>{ const r=craft(s,t,kk,inv,C.reqMet); if (!r.ok){ C.toast(r.why); return; } C.Snd.fanfare(); C.equip(t); C.toast(`You made a ${TOOLS[t].tiers[kk].name}!`, C.toolThumb(t,kk), 'new'); C.save(); C.updateHUD(); rer(); };
      if (c.loses) confirm(`Your old ${TOOLS[t].name.toLowerCase()} has ${c.loses.map(nm).join(' and ')} on it. The new one starts plain, and those are lost.`, go); else go(); });
  }
  // a yes/no inside the panel (no dialog box, so the panel stays open)
  function confirm(text, yes){ if (C.confirm) return C.confirm(text, yes); const pB=C.pBody(), box=document.createElement('div'); box.className='notice'; box.style.cssText='position:sticky;bottom:0;z-index:2;box-shadow:0 -4px 14px rgba(0,0,0,.15)';
    box.innerHTML=`<div>${text}</div><div style="margin-top:8px;display:flex;gap:8px"><button class="btn">Okay</button><button class="btn alt">Cancel</button></div>`; pB.appendChild(box); box.scrollIntoView({ block:'nearest' });
    const [a,b]=box.querySelectorAll('button'); a.onclick=()=>{ box.remove(); yes(); }; b.onclick=()=>{ box.remove(); C.Snd.click(); }; }
  function pick(text, choices){ const pB=C.pBody(), box=document.createElement('div'); box.className='notice'; box.style.cssText='position:sticky;bottom:0;z-index:2;box-shadow:0 -4px 14px rgba(0,0,0,.15)';
    box.innerHTML=`<div>${text}</div><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">${choices.map((c,i)=>`<button class="btn alt" data-i="${i}">${c.label}</button>`).join('')}<button class="btn alt" data-i="x">Cancel</button></div>`; pB.appendChild(box); box.scrollIntoView({ block:'nearest' });
    box.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{ box.remove(); if (b.dataset.i!=='x') choices[+b.dataset.i].fn(); }); }

  /* --- #dev test hooks (window.__game.v140) --- */
  H.dev = {
    ENCH, POWER, FAMILIES, TWIN, CRAFT, REPAIR, migrate, canApply, apply, remove, learn, teachable, scrollPick, describe, maxUses, repairNeed, repairClams, canCraft, rank3Known, bigRoll, luckFor,
    S:()=>S(), inv,
    learnAll(){ for (const id of Object.keys(ENCH)) learn(S(), id); learn(S(),'twin'); C.save(); return S().rare.ench.known.length; },
    kit(){ for (const m of ['wood','softwood','stone','clay','iron','weed','honey','plank','fitting','heartwood','starstone','goldsap','moonpearl','glimmermoss']) for (let i=0;i<20;i++) C.addItem(m); C.save(); },
    give(t, k=0){ const tr=TOOLS[t].tiers[k]; S().tools[t]={ tier:k, uses:tr.forever?0:tr.uses }; C.save(); C.updateHeld(); },
    put(t, ...ids){ const T=S().tools[t]; if (!T) return false; T.ench=ids.filter(id=>ENCH[id] && fits(id,t)).slice(0,TWIN_SLOTS); if (!T.ench.length) delete T.ench; C.save(); return T.ench||[]; },
    wear(t, n){ const T=S().tools[t]; if (T) T.uses=Math.max(1,T.uses-n); C.save(); return T&&T.uses; },
    open:()=>H.openTools(),
  };
  return H;
}
