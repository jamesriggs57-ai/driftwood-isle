// Character creator: pick a critter, its colors, an outfit and a face. Live 3D preview you can turn.
import * as THREE from 'three';
import * as CH from './chars.js';

const css = `
#creator{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:12px;background:linear-gradient(180deg,rgba(127,211,232,.6),rgba(255,226,181,.7));backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
#creator .cbox{background:var(--cream,#fff8ea);border:4px solid var(--line,#e7d1a6);border-radius:28px;width:min(940px,100%);max-height:100%;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 0 rgba(91,67,50,.2),0 20px 50px rgba(0,0,0,.25)}
#creator .chead{padding:14px 18px 4px;text-align:center}#creator h2{margin:0;color:var(--brown,#5b4336);font-size:26px}#creator .csub{color:var(--brown2,#8a6a50);font-size:15px}
#creator .cmain{display:flex;gap:12px;min-height:0;flex:1;padding:6px 14px 0}
#creator .cprev{flex:0 0 42%;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:0}
#creator .cprev canvas{width:100%;max-width:380px;aspect-ratio:1;border-radius:22px;background:radial-gradient(circle at 50% 40%,#fffdf6,#f1e3c6);touch-action:none;cursor:grab}
#creator .chint{font-size:12px;color:var(--brown2,#8a6a50);opacity:.8;margin-top:4px}
#creator .copts{flex:1;overflow-y:auto;padding:0 4px 10px;min-height:0}
#creator .crow{margin:8px 0 2px;font-weight:700;color:var(--brown,#5b4336);font-size:15px}
#creator .cchips{display:flex;flex-wrap:wrap;gap:6px}
#creator .chip{border:3px solid transparent;background:#fff;border-radius:14px;padding:6px 10px;font:600 14px Fredoka,sans-serif;color:var(--brown,#5b4336);cursor:pointer;box-shadow:0 2px 0 rgba(91,67,50,.15)}
#creator .chip.on{border-color:#f2a240;background:#fff3dc}
#creator .sw{width:38px;height:38px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px rgba(91,67,50,.2);cursor:pointer;position:relative}
#creator .sw.on{box-shadow:0 0 0 3px #f2a240}
#creator .sw i{position:absolute;right:-2px;bottom:-2px;width:15px;height:15px;border-radius:50%;border:2px solid #fff}
#creator .ic{padding:3px;line-height:0}#creator .ic canvas{width:74px;height:50px;border-radius:10px}
#creator .cfoot{display:flex;gap:10px;justify-content:center;padding:10px 14px 14px;border-top:2px dashed var(--line,#e7d1a6)}
#creator .cfoot .btn{font-size:18px;padding:10px 22px}
@media (max-width:700px),(max-height:520px){ #creator .cmain{flex-direction:column} #creator .cprev{flex:0 0 auto} #creator .cprev canvas{max-width:min(240px,34vh)} #creator h2{font-size:21px} }
@media (max-height:520px) and (min-width:600px){ #creator .cmain{flex-direction:row} #creator .cprev canvas{max-width:min(260px,62vh)} }
`;
const hex = c => '#'+new THREE.Color(c).getHexString();
const esc = s => String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

function iconCanvas(draw){ const cv=document.createElement('canvas'); cv.width=148; cv.height=100; draw(cv.getContext('2d')); return cv; }

export function openCreator({ look=CH.defaultLook(), title='Make your character', sub='', doneLabel='Done', cancel=false }={}){
  return new Promise(resolve=>{
    if (!document.getElementById('creatorCss')){ const st=document.createElement('style'); st.id='creatorCss'; st.textContent=css; document.head.appendChild(st); }
    const L={ ...look };
    const el=document.createElement('div'); el.id='creator';
    el.innerHTML=`<div class="cbox"><div class="chead"><h2>${esc(title)}</h2>${sub?`<div class="csub">${esc(sub)}</div>`:''}</div>
      <div class="cmain"><div class="cprev"><canvas id="crCv"></canvas></div><div class="copts" id="crOpts"></div></div>
      <div class="cfoot"><button class="btn alt" id="crRnd">Surprise me</button>${cancel?'<button class="btn alt" id="crCancel">Cancel</button>':''}<button class="btn" id="crDone">${esc(doneLabel)}</button></div></div>`;
    document.body.appendChild(el);
    const opts=el.querySelector('#crOpts');

    // ---------- preview ----------
    const cv=el.querySelector('#crCv'), R=new THREE.WebGLRenderer({ canvas:cv, antialias:true, alpha:true });
    R.outputColorSpace=THREE.SRGBColorSpace; R.toneMapping=THREE.ACESFilmicToneMapping; R.setPixelRatio(Math.min(2, devicePixelRatio||1));
    const sc=new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xfff8ee,0xc8b090,2.0)); const dl=new THREE.DirectionalLight(0xfff2e0,2.3); dl.position.set(2,4,4); sc.add(dl); const rim=new THREE.DirectionalLight(0xd8ecff,1.0); rim.position.set(-3,2,-3); sc.add(rim);
    const cam=new THREE.PerspectiveCamera(28,1,0.1,50); cam.position.set(0,1.5,5.4); cam.lookAt(0,0.95,0);
    const holder=new THREE.Group(); sc.add(holder); let obj=null, rotY=0.35, drag=null, alive=true, t0=performance.now(), pop=0;
    const disposeObj=o=>o.traverse(m=>{ if (m.isMesh) m.geometry.dispose(); });
    function rebuild(){ if (obj){ holder.remove(obj); disposeObj(obj); } obj=CH.buildCritter(L); holder.add(obj); pop=1; }
    const size=()=>{ const r=cv.getBoundingClientRect(); const w=Math.max(120,r.width|0); R.setSize(w,w,false); };
    cv.addEventListener('pointerdown',e=>{ drag={ x:e.clientX, r:rotY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove',e=>{ if (drag) rotY=drag.r+(e.clientX-drag.x)*0.012; });
    cv.addEventListener('pointerup',()=>drag=null); cv.addEventListener('pointercancel',()=>drag=null);
    (function loop(){ if (!alive) return; requestAnimationFrame(loop); size(); const t=(performance.now()-t0)/1000; holder.rotation.y=rotY;
      if (obj){ const u=obj.userData; pop*=0.9; const k=Math.sin(t*2.2)*0.02 + Math.sin(pop*9)*pop*0.12; u.body.scale.set(1-k*0.55,1+k,1-k*0.55);
        if (u.arms) u.arms.forEach((a,i)=>a.rotation.z=(i?-1:1)*(0.05+Math.sin(t*1.6+i)*0.05)); if (u.tail) u.tail.rotation.y=Math.sin(t*2.5)*0.2; if (u.ears) u.ears.forEach((e,i)=>e.rotation.z=e.userData.base+Math.sin(t*1.7+i)*0.05); }
      R.render(sc,cam); })();

    // ---------- options ----------
    const sp=()=>CH.SPECIES[L.sp], sch=()=>sp().schemes[L.c];
    function render(){
      const s=sp(), S=sch();
      opts.innerHTML=`
        <div class="crow">Critter</div><div class="cchips">${CH.SPECIES_IDS.map(id=>`<button class="chip ${id===L.sp?'on':''}" data-sp="${id}">${CH.SPECIES[id].name}</button>`).join('')}</div>
        <div class="crow">Colors · <span style="font-weight:500">${esc(S.name)}</span></div><div class="cchips">${s.schemes.map((x,i)=>`<div class="sw ${i===L.c?'on':''}" data-c="${i}" title="${esc(x.name)}" style="background:${hex(x.fur)}"><i style="background:${hex(x.accent)}"></i></div>`).join('')}</div>
        <div class="crow">Finish</div><div class="cchips">${CH.FINISHES.map((o,i)=>`<button class="chip ${i===(L.f||0)?'on':''}" data-f="${i}">${o.name}</button>`).join('')}</div>
        <div class="crow">Outfit</div><div class="cchips">${CH.OUTFITS.map((o,i)=>`<button class="chip ${i===L.top?'on':''}" data-top="${i}">${o.name}</button>`).join('')}</div>
        <div class="crow">Outfit color</div><div class="cchips">${CH.OUTFIT_COLORS.map((c,i)=>`<div class="sw ${i===L.tc?'on':''}" data-tc="${i}" style="background:${hex(c)}"></div>`).join('')}</div>
        <div class="crow">Eyes · <span style="font-weight:500">${CH.EYES[L.e].name}</span></div><div class="cchips" id="crEyes"></div>
        <div class="crow">Nose · <span style="font-weight:500">${CH.NOSES[L.n].name}</span></div><div class="cchips" id="crNoses"></div>
        <div class="crow">Mouth · <span style="font-weight:500">${CH.MOUTHS[L.m].name}</span></div><div class="cchips" id="crMouths"></div>`;
      const dark = new THREE.Color(S.fur).getHSL({}).l<0.36, bgFace = dark ? S.muzzle : S.fur;
      const add=(boxId, list, key, draw)=>{ const box=opts.querySelector(boxId); list.forEach((it,i)=>{ const b=document.createElement('button'); b.className='chip ic'+(i===L[key]?' on':''); b.title=it.name;
        b.appendChild(iconCanvas(x=>{ x.fillStyle=hex(bgFace); x.beginPath(); x.roundRect(0,0,148,100,18); x.fill(); draw(x,it.id); })); b.onclick=()=>{ L[key]=i; rebuild(); render(); }; box.appendChild(b); }); };
      add('#crEyes', CH.EYES, 'e', (x,id)=>{ for (const s2 of [-1,1]) CH.drawEye(x,id,74+s2*36,52,s2,0.55); });
      add('#crNoses', CH.NOSES, 'n', (x,id)=>{ x.fillStyle=hex(S.muzzle); x.beginPath(); x.ellipse(74,54,48,34,0,0,Math.PI*2); x.fill(); CH.drawNoseIcon(x,id,74,48,1.0,S.nose); });
      add('#crMouths', CH.MOUTHS, 'm', (x,id)=>{ x.fillStyle=hex(S.muzzle); x.beginPath(); x.ellipse(74,52,52,38,0,0,Math.PI*2); x.fill(); CH.drawMouth(x,id,74,44,0.85); });
      opts.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{ L.sp=b.dataset.sp; L.c=Math.min(L.c, CH.SPECIES[L.sp].schemes.length-1); rebuild(); render(); });
      opts.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ L.c=+b.dataset.c; rebuild(); render(); });
      opts.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ L.f=+b.dataset.f; rebuild(); render(); });
      opts.querySelectorAll('[data-top]').forEach(b=>b.onclick=()=>{ L.top=+b.dataset.top; rebuild(); render(); });
      opts.querySelectorAll('[data-tc]').forEach(b=>b.onclick=()=>{ L.tc=+b.dataset.tc; rebuild(); render(); });
    }
    const close=(val)=>{ alive=false; if (obj) disposeObj(obj); R.dispose(); try{ R.forceContextLoss(); }catch(e){} el.remove(); resolve(val); };
    el.querySelector('#crRnd').onclick=()=>{ Object.assign(L, CH.randomLook(Math.random, 0.25)); rebuild(); render(); };
    el.querySelector('#crDone').onclick=()=>close({ ...L });
    if (cancel) el.querySelector('#crCancel').onclick=()=>close(null);
    rebuild(); render();
  });
}
