/* Driftwood Isle wiki. Guide text lives in guide.js; every catalog table is built here from the game's own
   data (../js/content.js, ../js/achieve.js), so prices, seasons and rarities always match the live game. */
import { ITEMS, rarityLabel, RARITY_COLORS, RESIDENTS, TOOLS, BACKPACKS, CROPS, RECIPES, WOODWORK, RARE_WORK,
  WOOD_START, WOOD_TEN, PLANTS, FOREIGN_FRUIT_PRICE, SHOPS, whereText } from '../js/content.js';
import { ACHIEVEMENTS, ACH_GROUPS } from '../js/achieve.js';
// v1.40: these add the new tables, table pieces and Enchanting Scrolls to ITEMS/WOODWORK, and hold the enchanting rules (no DOM, no THREE)
import { benchFor, toolBench, BENCH_IDS, NEW_BENCHES, BENCH_PIECES } from '../js/benches-core.js';
import { ENCH, FAMILIES, WORDS, CRAFT, REPAIR, BROKEN_MULT, toolsText, describe } from '../js/enchant-core.js';
import { PAGES, GROUPS, GUIDE_VERSION, GUIDE_UPDATED } from './guide.js';

const $ = s => document.querySelector(s);
const fmt = n => (n==null || n==='') ? '' : Number(n).toLocaleString('en-US');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const name = id => ITEMS[id] ? ITEMS[id].name : id;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const KIND_NAME = { fish:'any fish', fruit:'any fruit', berry:'any berries', shell:'beach finds', flower:'flowers', fossil:'fossils', bug:'bugs',
  material:'materials', furniture:'furniture', food:'food' };

function months(m){
  if (m==='all' || !m) return 'All year';
  const a=[...m].sort((x,y)=>x-y);
  // find runs, allowing wrap (Nov-Feb)
  const set=new Set(a), runs=[]; let start=null;
  for (let i=1;i<=12;i++){ if (set.has(i) && start==null) start=i; if (!set.has(i) && start!=null){ runs.push([start,i-1]); start=null; } }
  if (start!=null) runs.push([start,12]);
  if (runs.length>1 && runs[0][0]===1 && runs[runs.length-1][1]===12){ const f=runs.shift(); runs[runs.length-1][1]=f[1]+12; }
  return runs.map(([s,e])=> s===e ? MON[s-1] : `${MON[s-1]} to ${MON[(e-1)%12]}`).join(', ');
}
const hours = h => !h ? 'All day' : `${String(h[0]).padStart(2,'0')}:00 to ${String(h[1]%24).padStart(2,'0')}:00`;
const rarity = w => { const L=rarityLabel(w ?? 5); return `<span class="rar" style="--rc:${RARITY_COLORS[L]}">${L}</span>`; };
const RANK = { 'Common':0,'Uncommon':1,'Rare':2,'Very rare':3,'Legendary':4 };
const mats = o => Object.entries(o).map(([id,n])=>`${n} ${esc(name(id))}`).join(', ');

/* A sortable, filterable table. cols: [label, (row)=>html, sortKey(row)?] */
function table(id, rows, cols, opts={}){
  const filters = opts.filters ? `<div class="chips" data-for="${id}">${opts.filters.map((f,i)=>`<button class="chip${i?'':' on'}" data-f="${esc(f[0])}">${esc(f[1])}</button>`).join('')}</div>` : '';
  const head = cols.map((c,i)=>`<th data-i="${i}" ${c[2]?'class="sortable"':''}>${c[0]}</th>`).join('');
  const body = rows.map(r=>`<tr data-f="${esc(opts.tag ? opts.tag(r) : '')}" data-name="${esc((r.name||'').toLowerCase())}">${cols.map(c=>`<td>${c[1](r)}</td>`).join('')}</tr>`).join('');
  TABLES[id] = { rows, cols };
  return `${filters}<div class="tw"><table class="t data" id="${id}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="count" data-count="${id}">${rows.length} entries</p>`;
}
const TABLES = {};

const WHERE = { sea:'Sea', river:'River', pond:'Pond', bay:'Cay Bay', air:'Flying', flower:'On flowers', trunk:'Tree trunks', ground:'Ground', beach:'Beach', glade:'Lumi\'s glade', starfall:'Starfall Isle' };
// v1.52 isle and trip critters (and the late reef fish) say exactly where: 'Sea off Hollow Crags', 'Castaway Isle trips, flying'
const whereOf = r => (r.where==='isle'||r.where==='trip'||r.reef) ? whereText(r) : (WHERE[r.where]||r.where);
const SIZE = { S:'Small', M:'Medium', L:'Large', XL:'Huge' };
const items = k => Object.values(ITEMS).filter(i=>i.kind===k);
const byPrice = (a,b)=>a.price-b.price;

function furnWhere(i){
  if (i.salvage) return `Hazel's wreck (${i.salvage})`;
  if (i.route) return 'Trade route keepsake';
  if (i.legendary) return 'Woodworking (rare plan)';
  const s = { stall:'Pemberton\'s', home:'Pemberton\'s shelf', trip:'Trip islands', story:'Island stories', rare:'Fennick\'s cart', craft:'Woodworking',
    party:'Party game prize', gift:'Museum gift', favor:'Favor gift' }[i.shop];
  if (s) return s;
  if (i.shop==='backroom') return 'Pemberton\'s back room';   // v1.44
  if (i.shop==='aquarium') return `Tidepool${i.special?' rare shelf':''}${i.tier?` (tier ${i.tier})`:''}`;
  if (i.shop==='garden') return `Bug &amp; Bloom${i.tier?` (tier ${i.tier})`:''}`;
  return esc(i.shop||'');
}

const TABLE_NAME = ['Anywhere', 'Workbench', 'Carpenter\'s Bench', 'Master Workbench'];
function woodLearn(r, start, ten){
  const b=NEW_BENCHES.find(x=>x.id===r.id); if (b) return `After ${b.kinds} different things made${b.after?`, one a ${esc(name(b.after))}`:''}`;
  const p=BENCH_PIECES.find(x=>x.id===r.id); if (p) return `Build a ${esc(name(BENCH_IDS[p.bench-1]))}`;
  return start.has(r.id)?'Known from the start':ten.has(r.id)?'After 3 starting pieces and 10 things made':'Milestone, plan or study';
}

const DATA = {
  residents(){
    const rows = RESIDENTS.map(r=>({ ...r }));
    return table('tResidents', rows, [
      ['Name', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Species', r=>esc(r.species), r=>r.species], ['Personality', r=>esc(r.personality), r=>r.personality],
      ['Loves', r=>(r.loves||[]).map(k=>KIND_NAME[k]||k).join(', ')], ['Likes', r=>(r.likes||[]).map(k=>KIND_NAME[k]||k).join(', ')],
      ['Start', r=>['pippa','bramble','mabel'].includes(r.id)?'Yes':''] ])
    + `<p class="muted">Shopkeepers and others: Pemberton (bear), Marlo (otter), Sprig (fox), Clementine (hedgehog), Professor Thistle (tortoise), Wendell (wizard), Fennick (frog merchant), Skipper Wick (boat captain), Gill, Hollis, Russet and Quill (passive income), Mossby (tree spirit).</p>`;
  },
  shopfurn(){
    const rows = Object.values(ITEMS).filter(i=>i.kind==='furniture' && (i.shop==='aquarium'||i.shop==='garden'));
    return `<h3>Shop-only furniture</h3>` + table('tShopFurn', rows, [['Item', r=>esc(r.name), r=>r.name], ['Shop', r=>furnWhere(r)], ['Buy', r=>fmt(r.buy), r=>r.buy]]);
  },
  tools(){
    let h = '<h3>Tools</h3>';
    const rows=[]; for (const [k,t] of Object.entries(TOOLS)) t.tiers.forEach((x,i)=>rows.push({ name:x.name, tool:t.name, does:t.does, ...x, tier:i, key:k }));
    h += table('tTools', rows, [['Tool', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Price', r=>fmt(r.cost), r=>r.cost], ['Uses', r=>r.forever?'Never breaks':fmt(r.uses), r=>r.forever?1e9:r.uses],
      ['Needs', r=>esc(r.req ? r.req.desc : '')]], { filters:[['','All'], ...Object.values(TOOLS).map(t=>[t.name,t.name])], tag:r=>r.tool });
    const mk=rows.filter(r=>CRAFT[r.key] && CRAFT[r.key][r.tier]);
    h += '<h3>Making tools</h3><p>Same experience needed as buying.</p>' + table('tToolMake', mk, [['Tool', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Materials', r=>mats(Object.fromEntries(CRAFT[r.key][r.tier]))],
      ['Make it at', r=>TABLE_NAME[toolBench(r.tier)], r=>toolBench(r.tier)]], { filters:[['','All'], ...Object.values(TOOLS).map(t=>[t.name,t.name])], tag:r=>r.tool });
    h += '<h3>Repair materials</h3><p>For a fully worn tool. A part-worn one needs that share of it, at least 1 of each. Heirloom tools never need fixing.</p>'
      + table('tRepair', [['Flimsy tools and the basic Watering Can', 0], ['Sturdy tools', 1], ['Golden tools and the Golden Can', 2]].map(([n,k])=>({ n, k })),
        [['Tier', r=>`<b>${esc(r.n)}</b>`], ['Materials', r=>mats(Object.fromEntries(REPAIR[r.k]))], ['Fix if broken (at a crafting table)', r=>mats(Object.fromEntries(REPAIR[r.k].map(([m,n])=>[m,n*BROKEN_MULT])))]]);
    h += '<h3>Backpacks</h3><p>You start with 20 bag slots.</p>';
    h += table('tBags', BACKPACKS, [['Bag', r=>`<b>${esc(r.name)}</b>`], ['Slots', r=>r.slots], ['Price', r=>fmt(r.cost)], ['Needs', r=>esc(r.req ? r.req.desc : '')]]);
    return h;
  },
  crops(){
    const rows = Object.entries(CROPS).map(([id,c])=>({ id, ...c, seed:ITEMS[id+'_seeds'] }));
    return '<h3>Crops</h3>' + table('tCrops', rows, [['Crop', r=>`<b>${esc(r.name)}</b>${r.story?' <span class="tag">story</span>':''}`, r=>r.name],
      ['Seed price', r=>fmt(r.seed && r.seed.buy), r=>r.seed?r.seed.buy:0], ['Days', r=>r.days, r=>r.days], ['Harvest', r=>`${r.n[0]} to ${r.n[1]}`],
      ['Stays planted', r=>r.regrow?'Yes':''], ['Sells', r=>fmt(r.price), r=>r.price]])
      + '<p class="muted">Island seeds (4 per island, always in stock) cost 30. Wheat comes from Barley\'s mill story; chili, melon and sweetcorn come by post on Wren\'s trade routes.</p>';
  },
  woodwork(){
    const start=new Set(WOOD_START), ten=new Set(WOOD_TEN);
    const rows = WOODWORK.filter(w=>ITEMS[w.id]).map(w=>({ ...w, name:ITEMS[w.id].name, it:ITEMS[w.id] }));
    let h = '<h3>Woodworking plans</h3>' + table('tWood', rows, [['Piece', r=>`<b>${esc(r.name)}</b>${r.out?` (x${r.out})`:''}`, r=>r.name], ['Materials', r=>mats(r.mats)],
      ['How you learn it', r=>woodLearn(r, start, ten)], ['Make it at', r=>TABLE_NAME[benchFor(r)], r=>benchFor(r)], ['Sells', r=>fmt(r.it.price), r=>r.it.price]]);
    const rr = RARE_WORK.map(w=>({ ...w, name:ITEMS[w.id].name, it:ITEMS[w.id] }));
    h += '<h3>Legendary showpieces</h3><p>Made at a Carpenter\'s Bench or bigger.</p>' + table('tRareWork', rr, [['Piece', r=>`<b>${esc(r.name)}</b>`], ['Materials', r=>mats(r.mats)], ['Worth', r=>fmt(r.it.buy)]]);
    return h;
  },
  enchanting(){
    const fam = e => { const w=FAMILIES[e.fam].what; if (e.id==='oneswing' || typeof w==='string') return esc(describe(e.id));
      const by={}; for (const [t,x] of Object.entries(w)) (by[x]||(by[x]=[])).push(TOOLS[t].name.toLowerCase());
      return `${esc(WORDS[e.rank])} increased ` + Object.entries(by).map(([x,ts])=>`${esc(x)} (${esc(ts.join(', '))})`).join('; '); };
    const from = e => e.learn==='pippa' ? `Pippa, free${e.later?' (her second lesson)':''}` : `Wendell, ${fmt(e.price)}`;
    const rows = Object.values(ENCH).map(e=>({ ...e }));
    return '<h3>Enchantments</h3>' + table('tEnch', rows, [['Enchantment', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['What it does', fam], ['Goes on', r=>esc(toolsText(r.id))],
      ['Learn from', r=>from(r)+' or a scroll', r=>r.price||0], ['Ingredients each time', r=>mats(Object.fromEntries(r.need))], ['Put on at', r=>TABLE_NAME[Math.max(1, r.rank)], r=>r.rank]],
      { filters:[['','All'], ['tough','Durability'], ['bonk','Bonk'], ['lucky','Luck'], ['output','Output'], ['sure','Catching'], ['big','Big catches'], ['spray','Watering']], tag:r=>r.fam });
  },
  recipes(){
    const rows = RECIPES.map(r=>({ ...r, it:ITEMS[r.id] }));
    return table('tRecipes', rows, [['Dish', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Ingredients', r=>r.need.map(([id,n])=>`${n} ${esc(ITEMS[id]?ITEMS[id].name:KIND_NAME[id]||id)}`).join(', ')],
      ['Campfire OK', r=>r.fire?'Yes':'Stove only'], ['Sells', r=>fmt(r.it.price), r=>r.it.price]]);
  },
  fish(){
    const rows = items('fish').sort(byPrice);
    return table('tFish', rows, [['Fish', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Where', r=>esc(whereOf(r)), r=>r.where], ['Shadow', r=>SIZE[r.size]||r.size, r=>'SMLX'.indexOf(r.size[0])+r.size.length],
      ['Months', r=>months(r.months)], ['Hours', r=>hours(r.hours)], ['Rarity', r=>rarity(r.rarity), r=>RANK[rarityLabel(r.rarity)]], ['Sells', r=>fmt(r.price), r=>r.price]],
      { filters:[['','All'],['sea','Sea'],['river','River'],['pond','Pond'],['bay','Cay Bay'],['isle','Isles'],['trip','Trips']], tag:r=>r.where });
  },
  bugs(){
    const rows = items('bug').sort(byPrice);
    return table('tBugs', rows, [['Bug', r=>`<b>${esc(r.name)}</b>${r.weather==='rain'?' <span class="tag">rain</span>':''}`, r=>r.name], ['Where', r=>esc(whereOf(r)), r=>r.where],
      ['Months', r=>months(r.months)], ['Hours', r=>hours(r.hours)], ['Rarity', r=>rarity(r.rarity), r=>RANK[rarityLabel(r.rarity)]], ['Sells', r=>fmt(r.price), r=>r.price]],
      { filters:[['','All'],['air','Flying'],['flower','Flowers'],['trunk','Trunks'],['ground','Ground'],['beach','Beach'],['pond','Pond'],['glade','Glade'],['isle','Isles'],['starfall','Starfall'],['trip','Trips']], tag:r=>r.where });
  },
  dig(){
    const cols = [['Name', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Rarity', r=>rarity(r.rarity), r=>RANK[rarityLabel(r.rarity)]], ['Sells', r=>fmt(r.price), r=>r.price]];
    return '<h3>Fossils</h3>' + table('tFossil', items('fossil').sort(byPrice), cols) + '<h3>Beach finds</h3>' + table('tShell', items('shell').sort(byPrice), cols)
      + '<h3>Coral</h3>' + table('tCoral', items('coral').sort(byPrice), [['Name', r=>`<b>${esc(r.name)}</b>`], ['Sells', r=>r.noSell?'Can\'t sell':fmt(r.price)], ['About', r=>esc(r.desc||'')]]);
  },
  plants(){
    const fruit = items('fruit').map(r=>({ ...r }));
    let h = '<h3>Fruit</h3>' + table('tFruit', fruit, [['Fruit', r=>`<b>${esc(r.name)}</b>`], ['Native price', r=>fmt(r.price)], ['As foreign fruit', r=>r.id==='coconut'?fmt(r.price):fmt(FOREIGN_FRUIT_PRICE)]]);
    const fl = Object.entries(PLANTS).filter(([,p])=>p.ptype==='flower').map(([id,p])=>({ id, name:p.name, days:p.days, story:p.story, night:p.night, fk:p.fk, of:p.of, it:ITEMS[id], seed:ITEMS[id+'_seeds'] }));
    const FK = { color:'rare color', hybrid:'hybrid', glow:'glows' };   // v1.44 Sprig's rare seeds
    h += '<h3>Flowers</h3>' + table('tFlowers', fl, [['Flower', r=>`<b>${esc(r.name)}</b>${r.night?' <span class="tag">night</span>':''}${r.fk?` <span class="tag">${FK[r.fk]}</span>`:''}${r.of?`<br><span class="muted">${esc(r.of)}</span>`:''}`, r=>r.name], ['Days to bloom', r=>r.days], ['Seeds', r=>fmt(r.seed&&r.seed.buy)], ['Sells', r=>fmt(r.it.price)]]);
    const sap = Object.values(ITEMS).filter(i=>i.kind==='sapling' && i.buy).map(i=>({ ...i, p:PLANTS[i.plant] }));
    h += '<h3>Saplings and shrubs</h3>' + table('tSap', sap, [['Plant', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Type', r=>r.p?r.p.ptype:''], ['Days', r=>r.p?r.p.days:''],
      ['Blooms', r=>r.p&&r.p.bloom&&r.p.bloom.length?months(r.p.bloom):''], ['Buy', r=>fmt(r.buy), r=>r.buy]]);
    return h;
  },
  materials(){
    const rows = Object.values(ITEMS).filter(i=>['material','relic','potion','ticket','gear','food','herb','berry','veg'].includes(i.kind) && !RECIPES.some(r=>r.id===i.id) && !CROPS[i.id]);
    const KN = { material:'Material', relic:'Relic', potion:'Potion', ticket:'Ticket', gear:'Gear', food:'Food', herb:'Herb', berry:'Berry', veg:'Vegetable' };
    return table('tMats', rows, [['Item', r=>`<b>${esc(r.name)}</b>${r.rare?' <span class="tag">rare</span>':''}`, r=>r.name], ['Type', r=>KN[r.kind]||r.kind, r=>r.kind],
      ['Sells', r=>r.noSell?'Can\'t sell':fmt(r.price), r=>r.price], ['Buy', r=>fmt(r.buy), r=>r.buy||0], ['How to get it / about', r=>esc(r.how||r.desc||'')]],
      { filters:[['','All'],['material','Materials'],['relic','Relics'],['potion','Potions'],['ticket','Tickets'],['food','Food']], tag:r=>r.kind });
  },
  furniture(){
    const rows = items('furniture').sort((a,b)=>a.name.localeCompare(b.name));
    const src = r => r.salvage?'story':r.route?'story':r.legendary?'craft':['stall','home','backroom'].includes(r.shop)?'pemberton':r.shop;
    return table('tFurn', rows, [['Piece', r=>`<b>${esc(r.name)}</b>${r.glow?' <span class="tag">lights up</span>':''}`, r=>r.name], ['Where', r=>furnWhere(r), r=>src(r)],
      ['Rarity', r=>r.rarity!=null?rarity(r.rarity):'', r=>r.rarity!=null?RANK[rarityLabel(r.rarity)]:-1], ['Buy', r=>r.buy?fmt(r.buy):'', r=>r.buy||0], ['Sells', r=>fmt(r.price), r=>r.price]],
      { filters:[['','All'],['pemberton','Pemberton\'s'],['aquarium','Tidepool'],['garden','Bug & Bloom'],['rare','Fennick'],['craft','Crafted'],['story','Stories'],['favor','Favors'],['trip','Trips'],['gift','Museum'],['party','Party']], tag:src });
  },
  clothes(){
    const rows = items('wear').sort((a,b)=>a.name.localeCompare(b.name));
    const slot = r => (r.wear && r.wear.t) || '';
    return table('tWear', rows, [['Piece', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['Slot', r=>esc(slot(r)), r=>slot(r)], ['Where', r=>r.shop==='clothes'?'Pemberton\'s clothes':r.shop==='favor'?'Favor gift':esc(r.shop||'')],
      ['Rarity', r=>r.rarity!=null?rarity(r.rarity):'', r=>r.rarity!=null?RANK[rarityLabel(r.rarity)]:-1], ['Buy', r=>r.buy?fmt(r.buy):'', r=>r.buy||0]]);
  },
  achievements(){
    const G = Object.fromEntries(ACH_GROUPS);
    const rows = ACHIEVEMENTS.map(a=>({ ...a, gname:G[a.group]||a.group }));
    return table('tAch', rows, [['Achievement', r=>`<b>${esc(r.name)}</b>`, r=>r.name], ['How', r=>esc(r.desc)], ['Group', r=>esc(r.gname), r=>r.gname]],
      { filters:[['','All'], ...ACH_GROUPS.map(([k,n])=>[k,n])], tag:r=>r.group }) ;
  },
};

/* ---------- page rendering ---------- */
const byId = Object.fromEntries(PAGES.map(p=>[p.id,p]));
function nav(){
  $('#nav').innerHTML = GROUPS.map(([g,label])=>`<div class="ng"><div class="ngt">${esc(label)}</div>${PAGES.filter(p=>p.group===g).map(p=>`<a href="#${p.id}" data-id="${p.id}">${esc(p.title)}</a>`).join('')}</div>`).join('');
}
function show(id){
  const p = byId[id] || PAGES[0];
  const gi = GROUPS.findIndex(g=>g[0]===p.group), list = PAGES, i = list.indexOf(p);
  const prev = list[i-1], next = list[i+1];
  let h = `<div class="crumb">${esc(GROUPS[gi][1])}</div><h1>${esc(p.title)}</h1>${p.html}`;
  if (p.data && DATA[p.data]){ try { h += DATA[p.data](); } catch(e){ h += `<p class="muted">This table couldn't be built (${esc(e.message)}).</p>`; } }
  h += `<div class="pn">${prev?`<a href="#${prev.id}">&larr; ${esc(prev.title)}</a>`:'<span></span>'}${next?`<a href="#${next.id}">${esc(next.title)} &rarr;</a>`:''}</div>`;
  $('#page').innerHTML = h;
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('on', a.dataset.id===p.id));
  document.title = `${p.title} - Driftwood Isle Wiki`;
  bindTables(); document.body.classList.remove('menu'); window.scrollTo(0,0);
}

function bindTables(){
  document.querySelectorAll('.chips').forEach(c=>c.onclick=e=>{ const b=e.target.closest('.chip'); if (!b) return;
    c.querySelectorAll('.chip').forEach(x=>x.classList.toggle('on', x===b));
    const t=document.getElementById(c.dataset.for), f=b.dataset.f; let n=0;
    t.querySelectorAll('tbody tr').forEach(tr=>{ const ok=!f || tr.dataset.f===f; tr.hidden=!ok; if (ok) n++; });
    const cnt=document.querySelector(`[data-count="${c.dataset.for}"]`); if (cnt) cnt.textContent=`${n} entries`; });
  document.querySelectorAll('table.data th.sortable').forEach(th=>th.onclick=()=>{
    const t=th.closest('table'), T=TABLES[t.id], i=+th.dataset.i, key=T.cols[i][2], dir = th.dataset.dir==='asc' ? -1 : 1;
    t.querySelectorAll('th').forEach(x=>delete x.dataset.dir); th.dataset.dir = dir>0?'asc':'desc';
    const trs=[...t.tBodies[0].rows], vals=new Map(trs.map((tr,k)=>[tr, key(T.rows[tr.sectionRowIndex])]));
    trs.sort((a,b)=>{ const x=vals.get(a), y=vals.get(b); return (typeof x==='string' ? x.localeCompare(y) : (x??0)-(y??0))*dir; });
    // keep rows array in the same order as the DOM so the next sort reads the right values
    const rows=trs.map(tr=>T.rows[tr.sectionRowIndex]); trs.forEach(tr=>t.tBodies[0].appendChild(tr)); T.rows.splice(0, T.rows.length, ...rows); });
}

/* ---------- search: pages by text, plus every item in the game ---------- */
const plain = h => h.replace(/<[^>]+>/g,' ').replace(/&[a-z]+;/g,' ');
function search(q){
  q=q.trim().toLowerCase(); const box=$('#results');
  if (q.length<2){ box.hidden=true; return; }
  const pages = PAGES.filter(p=>p.title.toLowerCase().includes(q) || plain(p.html).toLowerCase().includes(q)).slice(0,8);
  const CAT = { fish:'fish', bug:'bugs', fossil:'fossils', shell:'fossils', coral:'fossils', fruit:'fruit', flower:'fruit', sapling:'fruit', seed:'garden', veg:'garden', herb:'garden', berry:'garden',
    furniture:'furniture', wear:'clothes', material:'materials', relic:'relics', potion:'wendell', ticket:'trips', food:'cooking', plan:'crafting', gear:'tools' };
  const its = Object.values(ITEMS).filter(i=>i.name && i.name.toLowerCase().includes(q)).slice(0,12);
  let h='';
  if (its.length) h += `<div class="rh">Items</div>` + its.map(i=>{ const pg=i.ench ? 'enchanting' : CAT[i.kind]||'materials'; return `<a href="#${pg}" data-hl="${esc(i.ench ? ENCH[i.ench].name : i.name)}">${esc(i.name)} <span>${esc(byId[pg]?byId[pg].title:'')}${i.price&&!i.noSell?` · sells ${fmt(i.price)}`:''}</span></a>`; }).join('');
  if (pages.length) h += `<div class="rh">Guide pages</div>` + pages.map(p=>`<a href="#${p.id}">${esc(p.title)}</a>`).join('');
  box.innerHTML = h || '<div class="rh">Nothing found</div>'; box.hidden=false;
}
function highlight(q){
  q=q.toLowerCase(); const tr=[...document.querySelectorAll('#page table.data tbody tr')].find(r=>r.dataset.name===q) || [...document.querySelectorAll('#page table.data tbody tr')].find(r=>r.dataset.name.includes(q));
  if (tr){ tr.hidden=false; tr.classList.add('hl'); tr.scrollIntoView({ block:'center' }); }
}

nav();
$('#ver').textContent = `Game ${GUIDE_VERSION} · updated ${GUIDE_UPDATED}`;
$('#q').addEventListener('input', e=>search(e.target.value));
$('#results').addEventListener('click', e=>{ const a=e.target.closest('a'); if (!a) return; $('#results').hidden=true;
  if (a.dataset.hl){ e.preventDefault(); const id=a.getAttribute('href').slice(1); if (location.hash!=='#'+id) location.hash=id; else show(id); setTimeout(()=>highlight(a.dataset.hl), 30); } });
document.addEventListener('click', e=>{ if (!e.target.closest('.search')) $('#results').hidden=true; });
$('#menuBtn').onclick=()=>document.body.classList.toggle('menu');
window.addEventListener('hashchange', ()=>show(location.hash.slice(1)));
show(location.hash.slice(1));
