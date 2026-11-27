/* =====================================================================
   v1.63 CUSTOM FURNITURE: the game side. The Design tab in crafting, islanders' requests,
   sketches you find while digging, chopping and fishing, and the first-sale craftsmanship bonus.
   Data and rules are in custom-core.js, the 3D parts in custom-models.js.
   main.js builds C and calls createCustom(C). C needs:
     S(), save(), toast(msg,img,cls,sub), Snd, thumb(id), fmt(n), countItem(id), removeItem(id,n), addItem(id), canAdd(id),
     dialog(name,voice,lines,done,choices), openPanel(title,onClose), closePanel(), pBody(), pTitle(), setFoot(html),
     addClams(n), noEdit(), GUEST(), VISIT(), bench() (crafting table tier in reach, 0 = none), benchBanner(),
     kinds() (different woodworking pieces made), today() (day string), dayNum(), sparkle(at), track(k,n)
   Saved in S.craft.custom (craft is already a player key): designs, crafted, sold, found, made, req.
   ===================================================================== */
import * as THREE from 'three';
import { ITEMS } from './content.js';
import { BASES, BASE_IDS, STYLES, STYLE_NAME, WOODS, METALS, FABRICS, PATTERNS, encode, decode, isCustomId, partsOf, usesFabric, usesMetal,
  matsOf, copyPrice, firstBonus, optionOpen, matOpen, generate, likeness, styleOf, nameOf, PERSONALITY_STYLE, shapeCount } from './custom-core.js';
import { buildCustom } from './custom-models.js';
import { BENCH_NAME } from './benches-core.js';
import { mulberry32, hashStr } from './util.js';
import { searchBox, sk, bindSearch } from './search.js';   // v1.70
export * from './custom-core.js';

const NEED_KINDS = 10;           // different woodworking pieces made before the Design tab shows up
const MAX_DESIGNS = 80;
const REQ_GAP = 14;              // days before the same islander asks again
const REQ_MAX = 2;               // open requests at once
const BONUS_PER_DAY = 2;         // new designs that can earn the craftsmanship bonus each day, so tweaking one part over and over isn't a money farm
const FIND = { dig:0.012, fell:0.02, fish:0.004 };   // chance of finding a sketch
const MAT_WORD = { wood:'Wood', softwood:'Branches', stone:'Stone', clay:'Clay', iron:'Iron', weed:'Weeds', stump:'Stumps', plank:'Planks' };
const esc = s => String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const hex = c => '#'+c.toString(16).padStart(6,'0');

export function createCustom(C){
  const S = () => C.S();
  const st = () => { const s=S(); if (!s.craft) return null; const c=s.craft.custom || (s.craft.custom={ designs:[], crafted:[], sold:[], found:[], made:0, req:{} });
    for (const k of ['designs','crafted','sold','found']) if (!Array.isArray(c[k])) c[k]=[]; c.req=c.req||{}; return c; };
  const ok = () => !C.VISIT() && !!S().craft && C.kinds()>=NEED_KINDS;
  const tier = () => Math.max(0, C.bench()|0);
  const known = () => (st()||{}).found || [];
  const open = (base, slot, i, t=tier()) => optionOpen(base, slot, i, Math.max(1,t), known());
  const matName = m => MAT_WORD[m] || (ITEMS[m] ? ITEMS[m].name : m);
  const have = m => C.countItem(m);
  const lacks = d => Object.entries(matsOf(d)).filter(([m,n])=>have(m)<n);
  const fresh = base => { const B=BASES[base], parts={}; for (const sl of B.slots) parts[sl]=0; return { base, parts, w:1, w2:1, m:0, f:0, p:0 }; };
  // does this design need a bigger table than the one in reach? returns the tier it needs
  const needTier = d => Math.max(1, ...partsOf(d).map(([,o])=>o.t), WOODS[d.w].tier, WOODS[d.w2].tier, usesMetal(d)?METALS[d.m].tier:1, usesFabric(d)?PATTERNS[d.p].tier:1);
  const foundAll = d => partsOf(d).every(([sl,o],k)=>!o.find || known().includes(d.base+'.'+sl+'.'+d.parts[sl]));
  const canBuildHere = d => needTier(d)<=tier() && foundAll(d);
  function saveDesign(id){ const c=st(); c.designs=c.designs.filter(x=>x!==id); c.designs.unshift(id); if (c.designs.length>MAX_DESIGNS) c.designs.length=MAX_DESIGNS; C.save(); }
  function learnParts(d){ const c=st(); let n=0; for (const [sl,o] of partsOf(d)){ const k=d.base+'.'+sl+'.'+d.parts[sl]; if ((o.find || o.t>Math.max(1,tier())) && !c.found.includes(k)){ c.found.push(k); n++; } } return n; }

  /* ---------- making a piece ---------- */
  function make(d){
    if (C.noEdit()) return false; const id=encode(d);
    if (!canBuildHere(d)) { C.toast(`You need a ${BENCH_NAME[needTier(d)]} for that.`); C.Snd.fail(); return false; }
    if (lacks(d).length) { C.toast('You\'re missing some materials.'); C.Snd.fail(); return false; }
    if (!C.canAdd(id)) { C.toast('Your bag is full. Make room first.'); C.Snd.fail(); return false; }
    for (const [m,n] of Object.entries(matsOf(d))) C.removeItem(m, n);
    const c=st(); C.addItem(id); c.made++; saveDesign(id); if (!c.crafted.includes(id)) c.crafted.push(id);
    if (C.track) C.track('craft', 1); C.save(); C.Snd.chop(); setTimeout(()=>C.Snd.jingle(), 140);
    const first = !c.sold.includes(id) ? ` First sale pays a ${C.fmt(firstBonus(d))}-clam craftsmanship bonus.` : '';
    C.toast(`You made the ${ITEMS[id].name}!`, C.thumb(id), 'new', `It's in your bag.${first}`); return true; }

  /* ---------- 3D preview in the panel ---------- */
  // v1.74: the piece no longer spins on its own. It holds still at a three-quarter view and turns only when you drag it.
  let R=null, scene=null, cam=null, holder=null, yaw=-0.6, raf=0;
  function dragTurn(canvas){ let dn=null; canvas.style.touchAction='pan-y'; canvas.style.cursor='grab';
    canvas.onpointerdown=e=>{ dn={ x:e.clientX, y:yaw, id:e.pointerId }; try{ canvas.setPointerCapture(e.pointerId); }catch(_){} canvas.style.cursor='grabbing'; };
    canvas.onpointermove=e=>{ if (dn && e.pointerId===dn.id) yaw=dn.y+(e.clientX-dn.x)*0.012; };
    canvas.onpointerup=canvas.onpointercancel=()=>{ dn=null; canvas.style.cursor='grab'; }; }
  function preview(canvas, id){
    if (!R){ R=new THREE.WebGLRenderer({ antialias:true, alpha:true }); R.outputColorSpace=THREE.SRGBColorSpace; R.toneMapping=THREE.ACESFilmicToneMapping; R.shadowMap.enabled=true;
      scene=new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xfff6e8,0x8a7a6a,1.5)); const sun=new THREE.DirectionalLight(0xffffff,2.1); sun.position.set(3,6,5); sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); scene.add(sun);
      const fl=new THREE.Mesh(new THREE.CircleGeometry(2.4,40), new THREE.ShadowMaterial({ opacity:0.18 })); fl.rotation.x=-Math.PI/2; fl.receiveShadow=true; scene.add(fl);
      cam=new THREE.PerspectiveCamera(30, 1.4, 0.1, 40); }
    const w=canvas.clientWidth||300, h=canvas.clientHeight||210, pr=Math.min(2, window.devicePixelRatio||1);
    R.setPixelRatio(pr); R.setSize(w, h, false); cam.aspect=w/h; cam.updateProjectionMatrix();
    if (holder){ scene.remove(holder); holder.traverse(o=>{ if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
    holder=new THREE.Group(); buildCustom(holder, id); holder.traverse(o=>{ if (o.isSprite) o.visible=false; }); scene.add(holder);
    const box=new THREE.Box3().setFromObject(holder), size=box.getSize(new THREE.Vector3()), r=Math.max(size.x, size.y*1.1, size.z)*0.5+0.15;
    const y=size.y*0.5, tf=Math.tan(cam.fov*Math.PI/360), hh=size.y*0.62+0.12, hw=Math.max(size.x,size.z)*0.62+0.12, dist=Math.max(hh/tf, hw/(tf*cam.aspect))*1.05; cam.position.set(0, y+dist*0.32, dist); cam.lookAt(0, y, 0);
    const ctx=canvas.getContext('2d'); cancelAnimationFrame(raf); let last=performance.now();
    dragTurn(canvas);
    const loop=t=>{ if (!canvas.isConnected) return; if (t-last>33){ last=t; holder.rotation.y=yaw;
        for (const a of holder.userData.anims||[]) a(t/1000, 0.033); R.render(scene, cam); canvas.width=R.domElement.width; canvas.height=R.domElement.height; ctx.drawImage(R.domElement,0,0); }
      raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop); }

  /* ---------- the Design tab ---------- */
  let mode='list', draft=null, style='cottage', base='chair';
  function chip(label, attrs, on, locked, title=''){ return `<button class="chip${on?' on':''}" ${attrs} ${locked?'disabled':''} title="${esc(title)}" style="font:inherit;font-size:12px;padding:4px 9px;border-radius:999px;border:2px solid ${on?'#5b4336':'#e7d1a6'};background:${on?'#5b4336':locked?'#f4ead8':'#fff'};color:${on?'#fff':locked?'#b0a090':'#5b4336'};margin:0 4px 4px 0;cursor:${locked?'default':'pointer'}">${label}</button>`; }
  function swatch(c, attrs, on, locked, title){ return `<button ${attrs} ${locked?'disabled':''} title="${esc(title)}" style="width:28px;height:28px;border-radius:50%;margin:0 5px 5px 0;background:${hex(c)};border:3px solid ${on?'#5b4336':'#fff'};box-shadow:0 0 0 1px #e7d1a6;opacity:${locked?0.3:1};cursor:${locked?'default':'pointer'}"></button>`; }
  function matsHTML(d){ return Object.entries(matsOf(d)).map(([m,n])=>{ const hv=have(m), okk=hv>=n; return `<span style="color:${okk?'inherit':'#c0503a'};font-weight:${okk?400:700}">${matName(m)} ${hv}/${n}</span>`; }).join(' · '); }

  function renderTab(tabsH='', bind){
    const pB=C.pBody(); if (C.pTitle()) C.pTitle().textContent='Design'; C.setFoot('');
    const c=st(); if (!c){ pB.innerHTML=tabsH; if (bind) bind(); return; }
    let h=tabsH;
    if (mode==='edit' && draft) h+=editHTML(); else h+=listHTML();
    pB.innerHTML=h; if (bind) bind(); bindTab(pB); bindSearch(pB);
    if (mode==='edit' && draft){ const cv=pB.querySelector('#cuPrev'); if (cv) preview(cv, encode(draft)); }
  }
  function listHTML(){
    const c=st(), t=tier();
    let h = searchBox('Search designs or materials')+(C.benchBanner ? C.benchBanner() : '');   // v1.70
    h+=`<div class="notice" data-shide><b>Custom furniture</b> <span class="muted">· ${c.designs.length} saved design${c.designs.length===1?'':'s'} · ${C.fmt(c.made)} made</span><br><span class="muted">Pick a piece, choose every part and finish, and make it. Bigger crafting tables open more parts. Sketches you find open the rare ones.</span></div>`;
    if (!t) h+='<div class="notice">Stand by a Workbench to design and make furniture.</div>';
    h+=`<div data-sgrp><div style="margin:6px 0 4px"><b>New design</b></div><div>${BASE_IDS.map(b=>chip(BASES[b].name, `data-cnew="${b}"${sk(BASES[b].name)}`, false, !t)).join('')}</div></div>`;
    const reqs=Object.entries(c.req).filter(([,r])=>r && r.want && !r.done);
    if (reqs.length){ h+='<div class="notice" data-sgrp style="margin-top:8px"><b>Requests</b>';
      for (const [who,r] of reqs){ const d=decode(r.want); h+=`<div class="row"${sk(r.name||who, BASES[d.base].name, STYLE_NAME[styleOf(d)])} style="margin:8px 0 0"><img src="${C.thumb(r.want)}" style="width:64px;height:64px"><div class="grow"><div class="nm">${esc(r.name||who)} wants a ${BASES[d.base].name.toLowerCase()} like this</div><div class="sub">${STYLE_NAME[styleOf(d)]}. Match the shape, wood and fabric as closely as you can, then give it to them.</div></div><button class="btn alt" data-ccopy="${r.want}" ${t?'':'disabled'}>Try it</button></div>`; }
      h+='</div>'; }
    if (c.designs.length){ h+='<div data-sgrp><div style="margin:10px 0 4px"><b>Your designs</b></div>';
      for (const id of c.designs){ const d=decode(id); if (!d) continue; const can=canBuildHere(d), miss=lacks(d);
        h+=`<div class="row"${sk(ITEMS[id].name, STYLE_NAME[styleOf(d)], BASES[d.base].name, Object.keys(matsOf(d)).map(matName))}><img src="${C.thumb(id)}"><div class="grow"><div class="nm">${esc(ITEMS[id].name)} <span class="muted" style="font-size:12px">${STYLE_NAME[styleOf(d)]}</span></div><div class="sub">${matsHTML(d)}${!can&&t?`<br><b>Needs a ${BENCH_NAME[needTier(d)]}</b>`:''}${!c.sold.includes(id)&&c.crafted.includes(id)?`<br>First sale: +${C.fmt(firstBonus(d))} craftsmanship`:''}</div>
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" data-cmake="${id}" ${!can||miss.length?'disabled':''}>Make</button><button class="btn alt" data-cedit="${id}" ${t?'':'disabled'}>Change</button><button class="btn alt" data-cdel="${id}">Forget</button></div></div></div>`; } h+='</div>'; }
    else h+='<div class="muted" data-shide style="margin-top:8px">No designs yet. Start one above.</div>';
    return h; }
  // v1.74: the preview, the name, the cost and the Make button stay pinned at the top while you scroll, and the options are split
  // into Shape and Colors so the list is short. Colors your table can't do yet are left out instead of shown faded.
  let section='shape';
  function editHTML(){
    const d=draft, B=BASES[d.base], t=Math.max(1,tier()), id=encode(d), it=ITEMS[id], can=canBuildHere(d), miss=lacks(d), c=st();
    let h=`<div id="cuTop" style="position:sticky;top:-14px;z-index:2;background:var(--cream,#fdf6e8);margin:0 -16px 6px;padding:2px 16px 6px;border-bottom:2px solid #efe0c4">
      <canvas id="cuPrev" style="width:100%;height:clamp(130px,24vh,200px);display:block;background:linear-gradient(#fbf3e4,#f1e4cc);border-radius:14px"></canvas>
      <div style="display:flex;align-items:baseline;gap:6px;margin-top:5px"><b style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.name)}</b><span class="muted" style="font-size:11px;white-space:nowrap">${STYLE_NAME[styleOf(d)]} · drag to turn</span></div>
      <div class="sub" style="font-size:12px;margin-top:2px">${matsHTML(d)} · sells for ${C.fmt(copyPrice(d))}${c.sold.includes(id)?'':` (+${C.fmt(firstBonus(d))} first sale)`}</div>
      ${!can?`<div class="sub" style="font-size:12px"><b>${foundAll(d)?`Needs a ${BENCH_NAME[needTier(d)]}.`:'Uses a part you haven\'t found a sketch for.'}</b></div>`:''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center"><button class="btn" id="cuMake" ${!can||miss.length?'disabled':''}>Make it</button><button class="btn alt" id="cuSave">Save</button><button class="btn alt" id="cuBack">Back</button>
        <span style="flex:1"></span>${[['shape','Shape'],['color','Colors']].map(([k,n])=>chip(n, `data-csec="${k}"`, section===k)).join('')}</div></div>`;
    if (section==='shape'){
      h+=`<div style="margin:2px 0 2px"><b>Surprise me</b> <span class="muted" style="font-size:12px">· a matching set of parts in one style</span></div><div>${STYLES.map(s=>chip(STYLE_NAME[s], `data-csty="${s}"`, s===style)).join('')}</div>`;
      for (const sl of B.slots){ h+=`<div style="margin:6px 0 2px"><b>${B.labels[sl]}</b> <span class="muted" style="font-size:12px">· ${esc(B[sl][d.parts[sl]].name)}</span></div><div>`;
        B[sl].forEach((o,i)=>{ const op=open(d.base, sl, i, t); if (!op && o.find && !known().includes(d.base+'.'+sl+'.'+i)) return;
          h+=chip(esc(o.name), `data-cpart="${sl}:${i}"`, d.parts[sl]===i, !op, op?'':`Needs a ${BENCH_NAME[o.t]}`); });
        h+='</div>'; }
      return h; }
    // Colors: only what the table in reach can do. A locked color already on the design (a sketch or a copy) still shows, marked, so you can see what to swap.
    let hidden=0;
    const row = (label, key, list, colorOf) => { const cur=list[d[key]]; let r=`<div style="margin:6px 0 2px"><b>${label}</b> <span class="muted" style="font-size:12px">· ${esc(cur?cur.name:'')}</span></div><div>`;
      list.forEach((x,i)=>{ const op=matOpen(list,i,t); if (!op && d[key]!==i){ hidden++; return; } r+=swatch(colorOf(x), `data-cmat="${key}:${i}"`, d[key]===i, !op, x.name+(op?'':` (needs a ${BENCH_NAME[x.tier]})`)); }); return r+'</div>'; };
    h+=row('Wood or paint', 'w', WOODS, x=>x.c) + row('Second wood', 'w2', WOODS, x=>x.c);
    if (usesMetal(d)) h+=row('Metal', 'm', METALS, x=>x.c);
    if (usesFabric(d)){ h+=row('Fabric', 'f', FABRICS, x=>x.c);
      h+=`<div style="margin:6px 0 2px"><b>Pattern</b> <span class="muted" style="font-size:12px">· ${esc(PATTERNS[d.p].name)}</span></div><div>${PATTERNS.map((p,i)=>{ const op=matOpen(PATTERNS,i,t); if (!op && d.p!==i){ hidden++; return ''; } return chip(p.name, `data-cmat="p:${i}"`, d.p===i, !op); }).join('')}</div>`; }
    if (hidden && t<3) h+=`<div class="muted" style="font-size:12px;margin-top:6px">A ${BENCH_NAME[t+1]} opens more colors${t+1<3?' and finishes':''}.</div>`;
    return h; }
  function bindTab(pB){
    const re=()=>renderTab(...lastArgs);
    pB.querySelectorAll('[data-cnew]').forEach(b=>b.onclick=()=>{ base=b.dataset.cnew; const r=mulberry32((Date.now()^hashStr(base))>>>0);
      draft=generate(r, { base, style, open:(bb,sl,i)=>open(bb,sl,i), tier:Math.max(1,tier()) }); delete draft.style; mode='edit'; C.Snd.click(); re(); pB.scrollTop=0; });
    pB.querySelectorAll('[data-cedit],[data-ccopy]').forEach(b=>b.onclick=()=>{ const d=decode(b.dataset.cedit||b.dataset.ccopy); if (!d) return; draft=d; mode='edit'; C.Snd.click(); re(); pB.scrollTop=0; });
    pB.querySelectorAll('[data-cmake]').forEach(b=>b.onclick=()=>{ const d=decode(b.dataset.cmake); if (d && make(d)) re(); });
    pB.querySelectorAll('[data-cdel]').forEach(b=>b.onclick=()=>{ const c=st(); c.designs=c.designs.filter(x=>x!==b.dataset.cdel); C.save(); C.Snd.click(); re(); });
    pB.querySelectorAll('[data-cpart]').forEach(b=>b.onclick=()=>{ const [sl,i]=b.dataset.cpart.split(':'); draft.parts[sl]=+i; C.Snd.click(); re(); });
    pB.querySelectorAll('[data-cmat]').forEach(b=>b.onclick=()=>{ const [k,i]=b.dataset.cmat.split(':'); draft[k]=+i; C.Snd.click(); re(); });
    pB.querySelectorAll('[data-csec]').forEach(b=>b.onclick=()=>{ if (section===b.dataset.csec) return; section=b.dataset.csec; C.Snd.click(); re(); const top=pB.querySelector('#cuTop'); if (top) pB.scrollTop=Math.min(pB.scrollTop, top.offsetTop); });
    pB.querySelectorAll('[data-csty]').forEach(b=>b.onclick=()=>{ style=b.dataset.csty; const r=mulberry32((Date.now()^hashStr(style))>>>0);
      draft=generate(r, { base:draft.base, style, open:(bb,sl,i)=>open(bb,sl,i), tier:Math.max(1,tier()) }); delete draft.style; C.Snd.click(); re(); });
    const q=s=>pB.querySelector(s);
    if (q('#cuBack')) q('#cuBack').onclick=()=>{ mode='list'; draft=null; C.Snd.click(); re(); };
    if (q('#cuSave')) q('#cuSave').onclick=()=>{ saveDesign(encode(draft)); C.Snd.jingle(); C.toast('Design saved.', C.thumb(encode(draft))); };
    if (q('#cuMake')) q('#cuMake').onclick=()=>{ if (make(draft)) re(); };
  }
  let lastArgs=['', null];
  const renderTabKeep = (tabsH, bind) => { lastArgs=[tabsH, bind]; renderTab(tabsH, bind); };

  /* ---------- islanders' requests ---------- */
  function requestFor(spec){ const c=st(), r=c.req[spec.id]; return r && r.want && !r.done ? r : null; }
  function openRequests(){ return Object.values(st().req).filter(r=>r && r.want && !r.done).length; }
  function wantsToAsk(spec){
    const c=st(), r=c.req[spec.id], now=C.dayNum();
    if (requestFor(spec) || openRequests()>=REQ_MAX || (S().friend[spec.id]||0)<3) return false;
    if (r && r.next && now<r.next) return false;
    return mulberry32(hashStr(spec.id+':cfreq:'+C.today()))()<0.25; }   // about one day in four
  function showSketch(spec, id, lines, choices){
    C.openPanel(`${spec.name}'s sketch`); const d=decode(id);
    C.pBody().innerHTML=`<div style="text-align:center"><img src="${C.thumb(id)}" style="width:180px;height:180px;background:#fbf3e4;border-radius:16px"></div>
      <div class="notice">${lines.map(esc).join('<br>')}</div><div class="muted">A ${STYLE_NAME[styleOf(d)].toLowerCase()} ${BASES[d.base].name.toLowerCase()}. Get the shape, the wood and the fabric as close as you can.</div>`;
    C.setFoot(choices.map((ch,i)=>`<button class="btn ${i?'alt':''}" data-cq="${i}">${esc(ch.label)}</button>`).join(' '));
    document.querySelectorAll('[data-cq]').forEach(b=>b.onclick=()=>{ const ch=choices[+b.dataset.cq]; C.closePanel(); ch.fn(); }); }
  const ASK = { cheerful:['Ooh, I saw your furniture! Could you make one for me? I drew what I mean!'], gruff:['That chair of yours. Not bad. Could you make me something. Here. Like this.'],
    dreamy:['I dreamed about a piece of furniture last night. I drew it when I woke up. Could you make it real?'], sporty:['I need something for my place. Clean. Sturdy. Like this sketch!'],
    caring:['I know you\'re busy, dear, but would you make me something like this? I\'d pay you properly.'], elegant:['Darling, I have a vision. Here is the sketch. I trust your hands entirely.'],
    lazy:['So... I drew a thing. Could you make it? For me? I\'d sit on it. Or near it.'] };
  const ASK_ANY = ['I\'ve been admiring your furniture. Could you make something for me, like this sketch?'];
  function requestChoices(spec, menu){
    if (!ok() || !spec) return [];
    const r=requestFor(spec);
    if (r){ const want=decode(r.want);
      const mine=[...new Set(S().inv.filter(x=>isCustomId(x.id) && decode(x.id)?.base===want.base).map(x=>x.id))].slice(0,4);
      return [{ label:`About that ${BASES[want.base].name.toLowerCase()}...`, fn:()=>{
        if (!mine.length) return showSketch(spec, r.want, ['Did you start on it yet? Here\'s my sketch again.'], [{ label:'Okay', fn:menu }]);
        C.dialog(spec.name, spec.voice, ['Ooh, is that it? Let me see...'], null, [...mine.map(id=>({ label:`Give the ${ITEMS[id].name}`, fn:()=>deliver(spec, id, menu) })), { label:'Not yet', alt:true, fn:menu }]); } }]; }
    if (!wantsToAsk(spec)) return [];
    return [{ label:'You look like you want to ask me something', fn:()=>{
      const style=PERSONALITY_STYLE[spec.personality] || 'cottage', rr=mulberry32(hashStr(spec.id+':'+C.today()));
      const want=generate(rr, { style, open:(b,sl,i)=>open(b,sl,i,Math.max(1,tier())), tier:Math.max(1,tier()) }); delete want.style; const id=encode(want);
      showSketch(spec, id, ASK[spec.personality]||ASK_ANY, [
        { label:'I\'ll make it', fn:()=>{ st().req[spec.id]={ want:id, since:C.dayNum(), name:spec.name }; C.save(); C.Snd.jingle(); C.dialog(spec.name, spec.voice, ['Yay! No rush. Well, a little rush.'], menu); } },
        { label:'Not right now', fn:()=>{ const c=st(); c.req[spec.id]={ next:C.dayNum()+3 }; C.save(); C.dialog(spec.name, spec.voice, ['That\'s okay! Maybe another time.'], menu); } } ]); } }]; }
  function deliver(spec, id, menu){
    if (C.noEdit()) return; const r=requestFor(spec); if (!r) return menu(); const want=decode(r.want), got=decode(id), like=likeness(want, got);
    if (like<0.5){ C.dialog(spec.name, spec.voice, ['Hmm. It\'s lovely, but it\'s not really what I drew.', 'Could you try again? Look at the sketch.'], menu); return; }
    const pay=Math.round((firstBonus(want)+copyPrice(want)*2+1500)*(0.5+like)/50)*50, fr = like>=0.9 ? 3 : 2;
    C.removeItem(id, 1); C.addClams(pay); S().friend[spec.id]=(S().friend[spec.id]||0)+fr; r.done=true; r.next=C.dayNum()+REQ_GAP; C.save(); C.Snd.fanfare();
    const line = like>=0.95 ? 'It\'s EXACTLY what I drew! How did you do that?!' : like>=0.75 ? 'Oh, that\'s so close to my sketch! I love it.' : 'It\'s not quite my sketch, but it\'s charming. I\'ll take it!';
    C.dialog(spec.name, spec.voice, [line, `Here, ${C.fmt(pay)} clams. You earned every one.`], menu); }

  /* ---------- sketches you find ---------- */
  function findSketch(kind){
    if (!ok() || Math.random()>=(FIND[kind]||0)) return null;
    const c=st(), t=Math.max(1,tier()), r=mulberry32((Date.now()*7+c.made)>>>0);
    // a sketch is a whole design from one style that may use parts a table or two above yours, and the rare found-only ones
    const d=generate(r, { open:(b,sl,i)=>{ const o=BASES[b][sl][i]; return o.t<=t+1 || o.find; } }); delete d.style; const id=encode(d);
    const n=learnParts(d); saveDesign(id); C.save(); return { id, n }; }
  function planRoll(kind, at){ const f=findSketch(kind); if (!f) return false;
    setTimeout(()=>{ C.Snd.fanfare(); if (C.sparkle && at) C.sparkle(at.clone().add(new THREE.Vector3(0,1,0)));
      C.toast('A furniture sketch!', C.thumb(f.id), 'new', `${ITEMS[f.id].name}. It's in your designs${f.n?`, and you learned ${f.n} new part${f.n>1?'s':''}`:''}.`); }, 900); return true; }

  /* ---------- selling ---------- */
  const bonusLeft = () => { const c=st(), t=C.today(); if (!c.bonusDay || c.bonusDay.d!==t) c.bonusDay={ d:t, n:0 }; return Math.max(0, BONUS_PER_DAY-c.bonusDay.n); };
  function sold(id){ if (!isCustomId(id)) return 0; const c=st(); if (!c || !c.crafted.includes(id) || c.sold.includes(id) || !bonusLeft()) return 0;
    const d=decode(id), b=firstBonus(d); c.sold.push(id); c.bonusDay.n++; if (b>0){ C.addClams(b); setTimeout(()=>C.toast(`Craftsmanship bonus: ${C.fmt(b)} clams`, C.thumb(id), 'new', 'For the first one of a design you made yourself.'), 300); } C.save(); return b; }
  function sellNote(id){ if (!isCustomId(id)) return ''; const c=st(); if (!c || !c.crafted.includes(id) || c.sold.includes(id)) return ''; const n=bonusLeft(); return n ? `<br><b>First sale of your design: +${C.fmt(firstBonus(decode(id)))} craftsmanship bonus</b> <span class="muted">(${n} more new design${n>1?'s':''} today)</span>` : '<br><span class="muted">You\'ve had today\'s craftsmanship bonuses. Sell this one tomorrow for its bonus.</span>'; }

  return {
    hasTab: ok,
    renderTab: renderTabKeep,
    requestChoices, planRoll, sold, sellNote,
    dev:{ learnAll(){ const c=st(); for (const b of BASE_IDS) for (const sl of BASES[b].slots) BASES[b][sl].forEach((o,i)=>{ const k=b+'.'+sl+'.'+i; if (o.find && !c.found.includes(k)) c.found.push(k); }); C.save(); },
      sketch(kind='dig'){ const keep=FIND[kind]; FIND[kind]=1; const r=planRoll(kind, null); FIND[kind]=keep; return r; },
      request(spec){ const c=st(); delete c.req[spec.id]; const r=mulberry32(1); const want=generate(r,{ style:PERSONALITY_STYLE[spec.personality]||'cottage', open:(b,sl,i)=>open(b,sl,i,1), tier:1 }); delete want.style; c.req[spec.id]={ want:encode(want), since:C.dayNum(), name:spec.name }; C.save(); return c.req[spec.id]; },
      choices:spec=>requestChoices(spec, ()=>{}), make:id=>make(decode(id)), deliver:(spec,id)=>deliver(spec,id,()=>{}), sold, shapes:shapeCount, decode, encode, generate, st },
  };
}
