/* =====================================================================
   v1.64 SEWING: the Sewing tab. Pick a rug or a piece of clothing, set its shape and size, then paint it
   pixel by pixel. The more you've sewn, the finer the grid (8x8 up to 32x32) and the more (and stranger)
   alterations your clothes can carry. Rugs go in your bag; clothes go in your closet and you wear them.
   main.js builds C and calls createSewing(C). C needs:
     S(), save(), toast(msg,img,cls,sub), Snd, thumb(id), fmt(n), countItem(id), removeItem(id,n), addItem(id), canAdd(id),
     pBody(), pTitle(), setFoot(html), addClams(n), noEdit(), VISIT(), today(), track(k,n), buildPlayer(look), setLook(code), look(),
     openPanel(title), dialog(name,voice,lines,done,choices), owns(id) (in the bag, a chest or placed)
   You sew at a Sewing Machine (bought from Pemberton): using a placed machine calls open().
   Saved in S.craft.sew (craft is already a player key).
   ===================================================================== */
import * as THREE from 'three';
import { ITEMS } from './content.js';
import * as T from './textile-core.js';
import { buildRug } from './textile-models.js';
import * as CH from './chars.js';
import { COLLAR, COLLAR_MATS } from './pets-core.js';   // v1.67 pet collars
export * from './textile-core.js';

const BONUS_PER_DAY = 2;
const MAT_WORD = { weed:'Weeds', softwood:'Branches', iron:'Iron', clay:'Clay' };
const esc = s => String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const hex = c => '#'+c.toString(16).padStart(6,'0');

export function createSewing(C){
  const S = () => C.S();
  const st = () => { const s=S(); if (!s.craft) return null; const c=s.craft.sew || (s.craft.sew={ made:0, rugs:[], clothes:[], closet:[], sold:[] });
    for (const k of ['rugs','clothes','closet','sold']) if (!Array.isArray(c[k])) c[k]=[]; return c; };
  const ok = () => !C.VISIT() && !!S().craft;
  const lvl = () => T.levelOf((st()||{}).made||0);
  const L = () => T.LEVELS[lvl()];
  const gridI = () => lvl();     // grid index = level (8, 12, 16, 24, 32)
  const matName = m => MAT_WORD[m] || (ITEMS[m] ? ITEMS[m].name : m);
  const matsOf = d => d.kind==='rug' ? T.rugMats(d) : T.garmentMats(d);
  const lacks = d => Object.entries(matsOf(d)).filter(([m,n])=>C.countItem(m)<n);
  const codeOf = d => d.kind==='rug' ? T.encodeRug(d) : T.encodeGarment(d);
  const decode = c => c[0]==='r' ? T.decodeRug(c) : T.decodeGarment(c);
  const remember = (list, code) => { const a=st()[list]; const i=a.indexOf(code); if (i>=0) a.splice(i,1); a.unshift(code); if (a.length>40) a.length=40; };

  function newRug(){ const G=T.GRIDS[gridI()]; return { kind:'rug', shape:0, w:10, d:6, edge:1, pile:0, ec:1, gi:gridI(), G, px:T.starterPattern(G,'border',25,1) }; }
  function newGarment(){ const G=T.GRIDS[gridI()]; return { kind:'garment', base:0, sleeve:1, hem:1, flare:1, alts:0, gi:gridI(), G, px:T.starterPattern(G,'stripes',19,0) }; }

  /* ---------- making ---------- */
  function make(d){
    if (C.noEdit()) return false;
    if (T.needLevel(d)>lvl()){ C.toast(`You need to be a ${T.LEVELS[T.needLevel(d)].name} for that.`); C.Snd.fail(); return false; }
    if (lacks(d).length){ C.toast('You\'re missing some materials.'); C.Snd.fail(); return false; }
    const code=codeOf(d);
    if (d.kind==='rug'){ const id='cr_'+code; if (!C.canAdd(id)){ C.toast('Your bag is full. Make room first.'); C.Snd.fail(); return false; }
      for (const [m,n] of Object.entries(matsOf(d))) C.removeItem(m,n); C.addItem(id); remember('rugs', code); }
    else { for (const [m,n] of Object.entries(matsOf(d))) C.removeItem(m,n); remember('clothes', code); const cl=st().closet; if (!cl.includes(code)){ cl.unshift(code); if (cl.length>30) cl.length=30; } }
    const c=st(), before=lvl(); c.made++; if (C.track) C.track('sewn', 1); C.save(); C.Snd.jingle();
    if (d.kind==='rug') C.toast(`You made a ${ITEMS['cr_'+code].name}!`, C.thumb('cr_'+code), 'new', 'It\'s in your bag. Place it like any furniture.');
    else C.toast('You sewed something new!', null, 'new', 'It\'s in your closet in the Sewing tab. Press Wear to put it on.');
    if (lvl()>before) setTimeout(()=>{ C.Snd.fanfare(); C.toast(`Sewing skill: ${L().name}!`, null, 'new', `You can paint on a ${L().grid} by ${L().grid} grid now${L().alts?` and add up to ${L().alts} alteration${L().alts>1?'s':''} to clothes`:''}.`); }, 1200);
    return true; }

  /* ---------- 3D preview ---------- */
  let R=null, scene=null, cam=null, holder=null, raf=0, spin=0;
  function preview(canvas, d){
    if (!R){ R=new THREE.WebGLRenderer({ antialias:true, alpha:true }); R.outputColorSpace=THREE.SRGBColorSpace; R.toneMapping=THREE.ACESFilmicToneMapping; R.shadowMap.enabled=true;
      scene=new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xfff6e8,0x8a7a6a,1.5)); const sun=new THREE.DirectionalLight(0xffffff,2.0); sun.position.set(3,6,5); sun.castShadow=true; scene.add(sun);
      cam=new THREE.PerspectiveCamera(30, 1.4, 0.05, 40); }
    const w=canvas.clientWidth||300, h=canvas.clientHeight||200; R.setPixelRatio(Math.min(2, window.devicePixelRatio||1)); R.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
    if (holder){ scene.remove(holder); holder.traverse(o=>{ if (o.isMesh && o.geometry) o.geometry.dispose(); }); }
    holder=new THREE.Group(); const code=codeOf(d);
    if (d.kind==='rug'){ buildRug(holder, 'cr_'+code); }
    else { const look=CH.parseLook(C.look()); look.ct=code; const p=C.buildPlayer(look); holder.add(p); }
    scene.add(holder);
    const box=new THREE.Box3().setFromObject(holder), size=box.getSize(new THREE.Vector3()), ctr=box.getCenter(new THREE.Vector3()), tf=Math.tan(cam.fov*Math.PI/360);
    if (d.kind==='rug'){ const r=Math.max(size.x,size.z)*0.62+0.1; const dist=r/tf*0.95; cam.position.set(ctr.x, dist*0.85, ctr.z+dist*0.6); cam.lookAt(ctr.x,0,ctr.z); }
    else { const hh=size.y*0.58+0.08, dist=Math.max(hh/tf, (size.x*0.62)/(tf*cam.aspect)); cam.position.set(0, ctr.y+dist*0.12, dist); cam.lookAt(0, ctr.y, 0); }
    const ctx=canvas.getContext('2d'); cancelAnimationFrame(raf); let last=performance.now(); const anims=[]; holder.traverse(o=>{ if (o.userData && o.userData.anims) anims.push(...o.userData.anims); });
    const loop=t=>{ if (!canvas.isConnected) return; if (t-last>40){ spin+=(t-last)/1000*(d.kind==='rug'?0.25:0.6); last=t; holder.rotation.y = d.kind==='rug' ? spin : Math.sin(spin)*1.1;
        for (const a of anims) a(t/1000); R.render(scene,cam); canvas.width=R.domElement.width; canvas.height=R.domElement.height; ctx.drawImage(R.domElement,0,0); }
      raf=requestAnimationFrame(loop); };
    raf=requestAnimationFrame(loop); }

  /* a flat picture of a painting (for lists) */
  function flatThumb(d, size=56){ const cv=document.createElement('canvas'); cv.width=cv.height=size; const x=cv.getContext('2d'), c=size/d.G;
    for (let j=0;j<d.G;j++) for (let i=0;i<d.G;i++){ x.fillStyle=hex(T.YARN[d.px[j*d.G+i]]); x.fillRect(Math.floor(i*c),Math.floor(j*c),Math.ceil(c),Math.ceil(c)); } return cv.toDataURL(); }

  /* ---------- the tab ---------- */
  let mode='list', draft=null, color=8, color2=0, tool='brush', mirror=false, lastArgs=['',null];
  const chip=(label, attrs, on, locked, title='')=>`<button ${attrs} ${locked?'disabled':''} title="${esc(title)}" style="font:inherit;font-size:12px;padding:4px 9px;border-radius:999px;border:2px solid ${on?'#5b4336':'#e7d1a6'};background:${on?'#5b4336':locked?'#f4ead8':'#fff'};color:${on?'#fff':locked?'#b0a090':'#5b4336'};margin:0 4px 4px 0;cursor:${locked?'default':'pointer'}">${label}</button>`;
  const lockTitle = lv => `Needs ${T.LEVELS[lv].name} skill (${T.LEVELS[lv].at} pieces sewn)`;
  const matsHTML = d => Object.entries(matsOf(d)).map(([m,n])=>{ const hv=C.countItem(m); return `<span style="color:${hv>=n?'inherit':'#c0503a'};font-weight:${hv>=n?400:700}">${matName(m)} ${hv}/${n}</span>`; }).join(' · ');
  function levelBar(){ const c=st(), l=lvl(), nx=T.LEVELS[l+1]; const pct = nx ? Math.round((c.made-T.LEVELS[l].at)/(nx.at-T.LEVELS[l].at)*100) : 100;
    return `<div class="notice"><b>Sewing: ${L().name}</b> <span class="muted">· ${c.made} sewn · ${L().grid}x${L().grid} grid${L().alts?` · ${L().alts} alteration${L().alts>1?'s':''}`:''}</span>
      <div style="height:8px;background:#f1e4cc;border-radius:6px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#7cc35a"></div></div>
      <div class="sub muted" style="margin-top:4px">${nx ? `${nx.at-c.made} more to ${nx.name}: ${nx.grid}x${nx.grid} grid${nx.alts>L().alts?' and stranger alterations':''}.` : 'The finest grid and every alteration are yours.'}</div></div>`; }
  function listHTML(){ const c=st(); let h=levelBar();
    h+=`<div style="margin:6px 0"><button class="btn" data-snew="rug">New rug</button> <button class="btn" data-snew="garment">New clothes</button></div>`;
    if (c.closet.length){ const worn=(CH.parseLook(C.look()).ct)||''; h+='<div style="margin:10px 0 4px"><b>Your closet</b></div>';
      for (const code of c.closet){ const d=T.decodeGarment(code); if (!d) continue; const on=worn===code;
        h+=`<div class="row"><img src="${flatThumb(d)}" style="image-rendering:pixelated"><div class="grow"><div class="nm">${T.GARMENTS[d.base].name}${on?' <span class="muted">(wearing)</span>':''}</div><div class="sub">${T.SLEEVES[d.sleeve].name}${T.altList(d.alts).length?' · '+T.altList(d.alts).map(([a])=>a.name.toLowerCase()).join(', '):''}</div>
          <div style="display:flex;gap:6px;margin-top:6px">${on?`<button class="btn alt" data-soff="1">Take off</button>`:`<button class="btn" data-swear="${code}">Wear</button>`}<button class="btn alt" data-sedit="${code}">Change</button><button class="btn alt" data-sbin="${code}">Unpick</button></div></div></div>`; } }
    if (c.rugs.length){ h+='<div style="margin:10px 0 4px"><b>Your rug designs</b></div>';
      for (const code of c.rugs){ const d=T.decodeRug(code); if (!d) continue; const id='cr_'+code, miss=lacks(d);
        h+=`<div class="row"><img src="${C.thumb(id)}"><div class="grow"><div class="nm">${esc(ITEMS[id].name)}</div><div class="sub">${T.rugSize(d.w)} x ${d.shape===1?T.rugSize(d.w):T.rugSize(d.d)} m · ${matsHTML(d)}${!c.sold.includes(code)&&T.rugBonus(d)?`<br>First sale: +${C.fmt(T.rugBonus(d))} for the art`:''}</div>
          <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" data-smake="${code}" ${miss.length||T.needLevel(d)>lvl()?'disabled':''}>Make</button><button class="btn alt" data-sedit="${code}">Change</button><button class="btn alt" data-sforget="${code}">Forget</button></div></div></div>`; } }
    if (!c.closet.length && !c.rugs.length) h+='<div class="muted" style="margin-top:8px">Nothing sewn yet. Weeds are your yarn: pull them, then start a rug or some clothes.</div>';
    // v1.67: pet collars, a quick sew from weeds
    { const miss=Object.entries(COLLAR_MATS).some(([m,n])=>C.countItem(m)<n);
      h+=`<div style="margin:10px 0 4px"><b>Little things</b></div><div class="row"><img src="${C.thumb(COLLAR)}"><div class="grow"><div class="nm">${esc(ITEMS[COLLAR].name)}</div><div class="sub">${Object.entries(COLLAR_MATS).map(([m,n])=>`${n} ${matName(m)}`).join(', ')} · fits a dog or a cat${C.countItem(COLLAR)?` · you have ${C.countItem(COLLAR)}`:''}</div>
        <div style="display:flex;gap:6px;margin-top:6px"><button class="btn" data-scollar="1" ${miss?'disabled':''}>Sew one</button></div></div></div>`; }
    return h; }
  function editHTML(){ const d=draft, l=lvl(), G=d.G, rug=d.kind==='rug', need=T.needLevel(d), miss=lacks(d), maxG=T.GRIDS[l];
    let h=`<canvas id="sxPrev" style="width:100%;height:${rug?170:230}px;display:block;background:linear-gradient(#fbf3e4,#f1e4cc);border-radius:14px;margin-bottom:8px"></canvas>`;
    h+=`<div class="notice" style="margin-top:0"><b>${rug?esc(T.rugName(d)):T.GARMENTS[d.base].name}</b><div class="sub" style="margin-top:4px">${matsHTML(d)}</div>
      ${rug?`<div class="sub">Each copy sells for ${C.fmt(T.rugPrice(d))}.${T.rugBonus(d)?` Your first sale of this rug adds ${C.fmt(T.rugBonus(d))} for the art.`:''}</div>`:''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"><button class="btn" id="sxMake" ${miss.length||need>l?'disabled':''}>${rug?'Make it':'Sew it'}</button><button class="btn alt" id="sxSave">Save design</button><button class="btn alt" id="sxBack">Back</button></div>
      ${need>l?`<div class="sub" style="margin-top:6px"><b>${lockTitle(need)}.</b></div>`:''}</div>`;
    const row=(label, key, list, hide)=>{ if (hide) return ''; return `<div style="margin:8px 0 2px"><b>${label}</b></div><div>${list.map((o,i)=>chip(o.name, `data-sopt="${key}:${i}"`, d[key]===i, o.lv>l, o.lv>l?lockTitle(o.lv):'')).join('')}</div>`; };
    if (rug){ h+=row('Shape','shape',T.RUG_SHAPES);
      const sl=(label,key)=>`<div style="margin:8px 0 2px"><b>${label}</b> <span class="muted">${T.rugSize(d[key])} m</span></div><input type="range" min="0" max="24" value="${d[key]}" data-ssize="${key}" style="width:100%">`;
      h+=sl(d.shape===1?'Size':'Width','w'); if (d.shape!==1) h+=sl('Length','d');
      h+=row('Edge','edge',T.RUG_EDGES)+row('Pile','pile',T.RUG_PILES);
      h+=`<div style="margin:8px 0 2px"><b>Edge colour</b></div><div>${T.YARN.map((c,i)=>`<button data-sec="${i}" title="${T.YARN_NAMES[i]}" style="width:22px;height:22px;border-radius:50%;margin:0 3px 3px 0;background:${hex(c)};border:3px solid ${d.ec===i?'#5b4336':'#fff'};box-shadow:0 0 0 1px #e7d1a6"></button>`).join('')}</div>`; }
    else { h+=row('Garment','base',T.GARMENTS)+row('Sleeves','sleeve',T.SLEEVES)+row('Length','hem',T.HEMS)+row('Skirt','flare',T.FLARES, !(d.base===1||d.base===4));
      const used=T.altList(d.alts).length; h+=`<div style="margin:8px 0 2px"><b>Alterations</b> <span class="muted">${used}/${L().alts}</span></div><div>${T.ALTS.map((a,i)=>{ const on=!!(d.alts&(1<<i)), lock=a.lv>l || (!on && used>=L().alts); return chip(a.name, `data-salt="${i}"`, on, lock, a.lv>l?lockTitle(a.lv):lock?'You can\'t add more yet':''); }).join('')}</div>`; }
    // the painter
    h+=`<div style="margin:12px 0 4px"><b>Paint it</b> <span class="muted">· ${G}x${G}${G<maxG?` · <a href="#" id="sxFiner">use your ${maxG}x${maxG} grid</a>`:''}</span></div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${chip('Brush','data-stool="brush"',tool==='brush')}${chip('Fill','data-stool="fill"',tool==='fill')}${chip('Pick colour','data-stool="pick"',tool==='pick')}${chip(mirror?'Mirror: on':'Mirror: off','id="sxMirror"',mirror)}</div>
      <div style="position:relative"><canvas id="sxPaint" style="width:100%;max-width:340px;aspect-ratio:1;display:block;margin:0 auto;touch-action:none;image-rendering:pixelated;border-radius:8px;box-shadow:0 0 0 2px #e7d1a6;cursor:crosshair"></canvas></div>
      ${rug?'':'<div class="sub muted" style="text-align:center;margin-top:4px">The middle half is the front; the left and right quarters wrap round the back.</div>'}
      <div style="margin:8px 0 2px"><b>Colour</b> <span class="muted">${T.YARN_NAMES[color]}</span></div><div>${T.YARN.map((c,i)=>`<button data-scol="${i}" title="${T.YARN_NAMES[i]}" style="width:26px;height:26px;border-radius:6px;margin:0 3px 3px 0;background:${hex(c)};border:3px solid ${color===i?'#5b4336':'#fff'};box-shadow:0 0 0 1px #e7d1a6"></button>`).join('')}</div>
      <div style="margin:8px 0 2px"><b>Start from</b> <span class="muted">(your colour and ${T.YARN_NAMES[color2]})</span></div><div>${['Plain','Stripes','Check','Border','Diamond'].map(k=>chip(k,`data-sstart="${k.toLowerCase()}"`,false)).join('')}${chip('Second colour: '+T.YARN_NAMES[color2],'id="sxC2"',false)}</div>`;
    return h; }
  function drawPainter(cv){ const d=draft, G=d.G, W=G*Math.ceil(340/G); cv.width=cv.height=W; const x=cv.getContext('2d'), c=W/G;
    for (let j=0;j<G;j++) for (let i=0;i<G;i++){ x.fillStyle=hex(T.YARN[d.px[j*G+i]]); x.fillRect(i*c,j*c,c+0.5,c+0.5); }
    x.strokeStyle='rgba(0,0,0,0.08)'; x.lineWidth=1; for (let k=1;k<G;k++){ x.beginPath(); x.moveTo(k*c,0); x.lineTo(k*c,W); x.stroke(); x.beginPath(); x.moveTo(0,k*c); x.lineTo(W,k*c); x.stroke(); }
    if (d.kind==='garment'){ x.strokeStyle='rgba(91,67,54,0.45)'; x.setLineDash([6,5]); x.lineWidth=2; for (const k of [G/4, G*3/4]){ x.beginPath(); x.moveTo(k*c,0); x.lineTo(k*c,W); x.stroke(); } x.setLineDash([]); } }
  function paintAt(cv, ev, first){ const d=draft, G=d.G, r=cv.getBoundingClientRect(), i=Math.floor((ev.clientX-r.left)/r.width*G), j=Math.floor((ev.clientY-r.top)/r.height*G);
    if (i<0||j<0||i>=G||j>=G) return false; const at=j*G+i;
    if (tool==='pick'){ if (first){ color=d.px[at]; tool='brush'; return 'redraw'; } return false; }
    if (tool==='fill'){ if (!first) return false; const from=d.px[at]; if (from===color) return false; const q=[at]; while (q.length){ const k=q.pop(); if (d.px[k]!==from) continue; d.px[k]=color; const x=k%G, y=(k/G)|0; if (x>0) q.push(k-1); if (x<G-1) q.push(k+1); if (y>0) q.push(k-G); if (y<G-1) q.push(k+G); } return true; }
    let ch=false; for (const ii of mirror ? [i, G-1-i] : [i]){ const k=j*G+ii; if (d.px[k]!==color){ d.px[k]=color; ch=true; } } return ch; }
  function renderTab(tabsH, bind){ lastArgs=[tabsH, bind]; const pB=C.pBody(); if (C.pTitle()) C.pTitle().textContent='Sewing'; C.setFoot('');
    if (!st()){ pB.innerHTML=tabsH; if (bind) bind(); return; }
    pB.innerHTML = tabsH + (mode==='edit' && draft ? editHTML() : listHTML()); if (bind) bind(); bindTab(pB);
    if (mode==='edit' && draft){ const pv=pB.querySelector('#sxPrev'); if (pv) preview(pv, draft); const cv=pB.querySelector('#sxPaint'); if (cv) drawPainter(cv); } }
  function bindTab(pB){ const re=()=>{ const y=pB.scrollTop; renderTab(...lastArgs); pB.scrollTop=y; }, q=s=>pB.querySelector(s);
    pB.querySelectorAll('[data-snew]').forEach(b=>b.onclick=()=>{ draft = b.dataset.snew==='rug' ? newRug() : newGarment(); mode='edit'; C.Snd.click(); re(); pB.scrollTop=0; });
    pB.querySelectorAll('[data-sedit]').forEach(b=>b.onclick=()=>{ const d=decode(b.dataset.sedit); if (!d) return; draft=d; mode='edit'; C.Snd.click(); re(); pB.scrollTop=0; });
    pB.querySelectorAll('[data-smake]').forEach(b=>b.onclick=()=>{ const d=decode(b.dataset.smake); if (d && make(d)) re(); });
    pB.querySelectorAll('[data-scollar]').forEach(b=>b.onclick=()=>{ if (C.noEdit()) return; if (Object.entries(COLLAR_MATS).some(([m,n])=>C.countItem(m)<n)){ C.toast('You need more weeds.'); C.Snd.fail(); return; }
      if (!C.canAdd(COLLAR)){ C.toast('Your bag is full. Make room first.'); C.Snd.fail(); return; }
      for (const [m,n] of Object.entries(COLLAR_MATS)) C.removeItem(m,n); C.addItem(COLLAR); C.save(); C.Snd.jingle(); C.toast('You sewed a Pet Collar!', C.thumb(COLLAR), 'new', 'Put it on a stray that trusts you.'); re(); });
    pB.querySelectorAll('[data-sforget]').forEach(b=>b.onclick=()=>{ const c=st(); c.rugs=c.rugs.filter(x=>x!==b.dataset.sforget); C.save(); re(); });
    pB.querySelectorAll('[data-sbin]').forEach(b=>b.onclick=()=>{ const c=st(), code=b.dataset.sbin; c.closet=c.closet.filter(x=>x!==code); if (CH.parseLook(C.look()).ct===code) wear(null); C.save(); C.Snd.click(); re(); });
    pB.querySelectorAll('[data-swear]').forEach(b=>b.onclick=()=>{ wear(b.dataset.swear); re(); });
    pB.querySelectorAll('[data-soff]').forEach(b=>b.onclick=()=>{ wear(null); re(); });
    pB.querySelectorAll('[data-sopt]').forEach(b=>b.onclick=()=>{ const [k,i]=b.dataset.sopt.split(':'); draft[k]=+i; C.Snd.click(); re(); });
    pB.querySelectorAll('[data-ssize]').forEach(b=>b.oninput=()=>{ draft[b.dataset.ssize]=+b.value; const lab=b.previousElementSibling.querySelector('.muted'); if (lab) lab.textContent=T.rugSize(+b.value)+' m'; });
    pB.querySelectorAll('[data-ssize]').forEach(b=>b.onchange=()=>re());
    pB.querySelectorAll('[data-sec]').forEach(b=>b.onclick=()=>{ draft.ec=+b.dataset.sec; C.Snd.click(); re(); });
    pB.querySelectorAll('[data-salt]').forEach(b=>b.onclick=()=>{ draft.alts ^= (1<<+b.dataset.salt); C.Snd.click(); re(); });
    pB.querySelectorAll('[data-stool]').forEach(b=>b.onclick=()=>{ tool=b.dataset.stool; C.Snd.click(); re(); });
    pB.querySelectorAll('[data-scol]').forEach(b=>b.onclick=()=>{ color=+b.dataset.scol; if (tool==='pick') tool='brush'; C.Snd.click(); re(); });
    pB.querySelectorAll('[data-sstart]').forEach(b=>b.onclick=()=>{ const k=b.dataset.sstart; draft.px = k==='plain' ? T.blankPixels(draft.G, color) : T.starterPattern(draft.G, k, color, color2); C.Snd.click(); re(); });
    if (q('#sxC2')) q('#sxC2').onclick=()=>{ color2=color; C.Snd.click(); re(); };
    if (q('#sxMirror')) q('#sxMirror').onclick=()=>{ mirror=!mirror; C.Snd.click(); re(); };
    if (q('#sxFiner')) q('#sxFiner').onclick=e=>{ e.preventDefault(); const G1=T.GRIDS[lvl()]; draft.px=T.resample(draft.px, draft.G, G1); draft.G=G1; draft.gi=lvl(); re(); };
    if (q('#sxBack')) q('#sxBack').onclick=()=>{ mode='list'; draft=null; C.Snd.click(); re(); };
    if (q('#sxSave')) q('#sxSave').onclick=()=>{ remember(draft.kind==='rug'?'rugs':'clothes', codeOf(draft)); C.save(); C.Snd.jingle(); C.toast('Design saved.'); };
    if (q('#sxMake')) q('#sxMake').onclick=()=>{ if (make(draft)){ mode='list'; draft=null; re(); } };
    const cv=q('#sxPaint'); if (cv){ let down=false;
      cv.onpointerdown=e=>{ down=true; cv.setPointerCapture(e.pointerId); const r=paintAt(cv,e,true); if (r==='redraw') re(); else if (r) drawPainter(cv); };
      cv.onpointermove=e=>{ if (down && paintAt(cv,e,false)) drawPainter(cv); };
      cv.onpointerup=cv.onpointercancel=()=>{ if (!down) return; down=false; const pv=q('#sxPrev'); if (pv) preview(pv, draft); }; } }
  function wear(code){ if (C.noEdit && C.noEdit()) return; const look=CH.parseLook(C.look()); if (code) look.ct=code; else delete look.ct; C.setLook(CH.lookCode(look)); C.Snd.jingle(); }

  /* ---------- selling a rug you made: the art bonus, at most 2 new designs a day ---------- */
  function bonusLeft(){ const c=st(), t=C.today(); if (!c.bonusDay || c.bonusDay.d!==t) c.bonusDay={ d:t, n:0 }; return Math.max(0, BONUS_PER_DAY-c.bonusDay.n); }
  function sold(id){ if (!T.isRugId(id)) return 0; const c=st(), code=id.slice(3); if (!c || !c.rugs.includes(code) || c.sold.includes(code) || !bonusLeft()) return 0;
    const b=T.rugBonus(T.decodeRug(code)); if (!b) return 0; c.sold.push(code); c.bonusDay.n++; C.addClams(b); setTimeout(()=>C.toast(`Art bonus: ${C.fmt(b)} clams`, C.thumb(id), 'new', 'For the first one of a rug you designed.'), 300); C.save(); return b; }
  function sellNote(id){ if (!T.isRugId(id)) return ''; const c=st(), code=id.slice(3); if (!c || !c.rugs.includes(code) || c.sold.includes(code)) return ''; const b=T.rugBonus(T.decodeRug(code)); if (!b) return '';
    return bonusLeft() ? `<br><b>First sale of your rug: +${C.fmt(b)} for the art</b>` : '<br><span class="muted">You\'ve had today\'s art bonuses. Sell this one tomorrow for its bonus.</span>'; }

  /* ---------- the machine ---------- */
  function open(){ if (C.VISIT()){ C.toast('It\'s not your machine. Ask whoever lives here.'); return; } if (!ok()){ C.toast('Learn woodworking from Bramble first, then you can sew.'); return; } C.openPanel('Sewing'); renderTab('', null); }
  function keeperChoices(k, menu){
    if (!ok() || C.owns(T.MACHINE)) return [];
    return [{ label:'Do you sell sewing machines?', fn:()=>C.dialog(k.name, k.voice, ['A sewing machine? I\'ve got one in the back. Treadle, cast iron, runs like a dream.', `${C.fmt(T.MACHINE_PRICE)} clams and she's yours.`], null, [
      { label:`Buy it (${C.fmt(T.MACHINE_PRICE)})`, fn:()=>{ if (C.noEdit()) return; if (S().clams<T.MACHINE_PRICE){ C.Snd.fail(); C.dialog(k.name, k.voice, ['Come back when you\'ve saved up. It\'ll keep.'], menu); return; }
          if (!C.canAdd(T.MACHINE)){ C.Snd.fail(); C.dialog(k.name, k.voice, ['Your bag\'s full. Make some room and come back.'], menu); return; }
          C.addClams(-T.MACHINE_PRICE); C.addItem(T.MACHINE); C.save(); C.Snd.coin();
          C.dialog(k.name, k.voice, ['There you go. Put it somewhere with good light.', 'Weeds make decent yarn, if you didn\'t know.'], ()=>C.toast('Sewing Machine', C.thumb(T.MACHINE), 'new', 'Place it, then use it to sew rugs and clothes.')); } },
      { label:'Not right now', alt:true, fn:menu } ]) }]; }

  return { hasTab:ok, renderTab, open, keeperChoices, sold, sellNote,
    dev:{ setMade(n){ st().made=n; C.save(); }, newRug, newGarment, make, encodeRug:T.encodeRug, encodeGarment:T.encodeGarment, wear, st, draft:()=>draft, setDraft(d){ draft=d; mode='edit'; } } };
}
