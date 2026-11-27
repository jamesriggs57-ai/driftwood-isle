/* =====================================================================
   v1.72 THE BALCONY ROUND THE TOP OF WENDELL'S TOWER.
   Once Wendell counts you as a friend, the little door in the observatory glass lets you out onto the balcony
   under the eaves (models2.js buildTower draws it). You walk round it in the usual camera, the way you walk the
   lighthouse galleries (lighthouse.js has the shared walking code), and go back in by the same door.
   main.js does the room change both ways (towerRoof / back in) and hands this controller:
     ctx: player, camera, scene, model (the tower model), Thing, fade, toast, stopMove, interact, dialogOpen, input,
          getCamYaw, setCamYaw, setPerch, hud, skyFollow, step, goIn() (back into the observatory)
   ===================================================================== */
import * as THREE from 'three';
import { perchKit, deckMove, followCam, behind, fadeTo, angD } from './lighthouse.js';

export function makeTowerBalcony(ctx){
  const M=ctx.model, B=M.userData.balcony, P=ctx.player, kit=perchKit(ctx, { fog:[60, 220] }), { hud } = kit;
  const st = { mode:'off', t:0, a:B.doorA, r:B.rIn, look:new THREE.Vector3(), camP:new THREE.Vector3(), camSnap:false };
  const roof = M.userData.roof, roofMat = roof && roof.material;
  const where = () => { const c=new THREE.Vector3(); M.getWorldPosition(c); const q=new THREE.Quaternion(); M.getWorldQuaternion(q); const e=new THREE.Euler().setFromQuaternion(q, 'YXZ'); return { cx:c.x, cz:c.z, y:c.y+B.y, rot:e.y }; };
  let W=where();
  const DECK = { get cx(){ return W.cx; }, get cz(){ return W.cz; }, get rot(){ return W.rot; }, get Gy(){ return W.y; }, rMin:B.rIn, rMax:B.rOut, door:{ a:B.doorA, half:0.28 }, speed:2.6, wedges:()=>[], circles:()=>[] };
  const VIEW = { dist:14, pitch:0.6, up:1.0 };
  // the door back in: a Thing so a tap or the action button can use it
  const door = new ctx.Thing('towerbalc', 0, 0, 0.3, new THREE.Group(), ()=>st.mode==='top' ? 'Go back in' : null, ()=>{ if (st.mode==='top') goIn(); }, { solid:false, reach:1.3 });
  const placeDoor = () => { const a=B.doorA+W.rot; door.pos.set(W.cx+Math.sin(a)*B.rIn, W.y, W.cz+Math.cos(a)*B.rIn); door.obj.position.copy(door.pos); };
  placeDoor();
  const showRoof = on => { if (!roof) return; fadeTo(roofMat, !on, on ? 1 : 0); roof.children.forEach(c=>{ if (c.userData.outline) c.visible=roofMat.opacity>0.99; }); };

  // main.js has already taken you out of the observatory; this puts you on the balcony by the door
  function arrive(){ W=where(); placeDoor(); ctx.setPerch(perch); hud('top'); st.mode='top'; st.t=0; st.a=B.doorA; st.r=B.rOut; P.obj.visible=true;   // a step out from the door, so a nudge inward doesn't send you straight back
    const a=st.a+W.rot; P.pos.set(W.cx+Math.sin(a)*st.r, W.y, W.cz+Math.cos(a)*st.r); P.obj.position.copy(P.pos); P.face=a; P.obj.rotation.y=a;
    st.camSnap=true; ctx.toast('Out on Wendell\'s balcony', null, '', 'Walk round it. Go back in at the little door.'); }
  function goIn(){ if (st.mode!=='top') return; st.mode='leaving'; ctx.stopMove(); ctx.goIn(()=>{ st.mode='off'; showRoof(true); hud(false); ctx.setPerch(null); }); }

  const perch = {
    get mode(){ return st.mode; },
    move(dt, t){ st.t+=dt;
      if (st.mode==='top'){ if (deckMove(ctx, kit, st, DECK, dt, t)==='door' && st.t>0.6) goIn(); return true; }
      if (st.mode==='leaving'){ kit.still(); return true; }
      return false; },
    cam(dt){ if (st.mode==='off') return false;
      followCam(ctx, kit, st, VIEW, dt); kit.farFog();
      if (roof){ fadeTo(roofMat, behind(P, W.cx, W.cz, ctx.getCamYaw()), dt); roof.children.forEach(c=>{ if (c.userData.outline) c.visible=roofMat.opacity>0.99; }); }
      return true; },
    tap(p){ if (st.mode!=='top' || ctx.dialogOpen()) return;
      if (p && p.ent===door){ P.target=door.pos.clone(); P.targetEnt=door; P.cb=()=>ctx.interact(door); return; }
      const pt = p && (p.ground || p.water || p.point); if (pt){ P.target=pt.clone(); P.targetEnt=null; P.cb=null; } },
    act(){ if (st.mode!=='top') return; if (Math.hypot(door.pos.x-P.pos.x, door.pos.z-P.pos.z)<door.reach+0.3){ ctx.stopMove(); goIn(); } },
  };
  return { perch, door, arrive, get mode(){ return st.mode; } };
}
