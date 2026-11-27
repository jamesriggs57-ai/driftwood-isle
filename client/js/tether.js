/* =====================================================================
   v1.76 CHESTS THAT FEED CRAFTING: the hooks main.js calls, and the faint tether lines shown while you place a chest
   or a crafting spot. Rules and numbers are in tether-core.js.
   C: furn() -> [{ id, x, z, rec }] placed furniture you can see right now, player() -> { x, z },
      canUse() -> whether chests count here (your own island), scene, y(x,z) -> floor height for the lines
   ===================================================================== */
import * as THREE from 'three';
import { isStation, isChest, tethers, feedChests, poolCount, poolTake, sortInPlace, sameOrder } from './tether-core.js';
export * from './tether-core.js';

export function createTether(C){
  let cache=null, cacheT=-1e9, lines=null;
  // the chest stores feeding the crafting spots you're at. Looked up at most 5 times a second; counts read the live stores.
  function stores(){ const now=performance.now(); if (cache && now-cacheT<200) return cache; cacheT=now;
    if (!C.canUse()) return (cache=[]);
    const F=C.furn();
    cache=feedChests(F.filter(f=>isStation(f.id)), F.filter(f=>isChest(f.id)).map(f=>({ id:f.id, x:f.x, z:f.z, store:f.rec.store })), C.player()).map(c=>c.store);
    return cache; }
  const H = {
    stores, sortInPlace, sameOrder,
    fresh(){ cache=null; },
    chests:()=>stores().length,
    extra:id=>poolCount(stores(), id),
    take(id, n){ const left=poolTake(stores(), id, n); return n-left; },
    // a line at the top of a crafting panel when chests are feeding it
    note(){ const n=stores().length; if (!n) return '';
      const items=stores().reduce((a,L)=>a+L.reduce((b,e)=>b+(e?e.n:0),0),0);
      return `<div class="muted" data-shide style="margin:-2px 0 8px">${n===1?'A chest':n+' chests'} beside you add${n===1?'s':''} ${items} thing${items===1?'':'s'} to what you can use here. Your bag is used first.</div>`; },
    // tether lines from the thing being placed (a chest or a crafting spot) to whatever it would be tethered to
    showLines(id, x, z, skip){ H.clearLines(); const st=isStation(id), ch=isChest(id); if ((!st && !ch) || !C.canUse()) return 0;
      const me={ id, x, z }, F=C.furn().filter(f=>f.rec!==skip && (st ? isChest(f.id) && tethers(me, f) : isStation(f.id) && tethers(f, me)));
      if (!F.length) return 0;
      const y0=C.y(x,z)+0.32, pts=[]; for (const f of F) pts.push(x, y0, z, f.x, C.y(f.x,f.z)+0.32, f.z);
      const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      lines=new THREE.LineSegments(g, new THREE.LineDashedMaterial({ color:0xfff1c8, dashSize:0.22, gapSize:0.14, transparent:true, opacity:0.75, depthWrite:false }));
      lines.computeLineDistances(); lines.renderOrder=5; C.scene.add(lines); return F.length; },
    clearLines(){ if (!lines) return; C.scene.remove(lines); lines.geometry.dispose(); lines.material.dispose(); lines=null; },
    get lineCount(){ return lines ? lines.geometry.attributes.position.count/2 : 0; },
  };
  return H;
}
