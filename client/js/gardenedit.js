/* =====================================================================
   v1.71 THE GARDEN EDITOR. Plants you planted are safe from the shovel; this is where you change them instead.
   Open it with the Garden button (shown near anything you planted) or from a garden's stake menu.
   The view goes overhead. Tap plants you planted to pick them (tap again to drop one), or tap a garden's soil
   or stake to pick the whole garden. Then:
     Move: a see-through copy follows your finger (or tap the ground to send it there). Garden plants snap to the
     garden squares; turn it a quarter at a time. Growth, watering and colors stay as they are. A whole garden
     takes its soil, fence, gate and decorations along. Plants moved onto bare ground start a garden there (or
     join the one they touch); the squares they left stay as soil.
     Take out: plants come out and you get their seeds, starts or saplings back (what digging up used to give).
     Ripe ones are harvested first. Taking out a whole garden also clears its soil (fences and decorations
     aren't refunded, the same as the garden menu's Take out).
   v1.72 Soil: switch the bar to Soil, then tap soil squares to pick them (Whole garden and Empty squares pick many at once).
     Move takes the squares and the plants of yours on them to a new spot; they join any garden they touch, or start one.
     Take out clears the squares back to grass, and plants of yours on them come out as above. A garden cut in two
     becomes two gardens. Picking every square of one garden moves or takes out that garden whole, fence and all.
   It uses main.js's overhead view (magicMode with kind 'garden'): drag to look around, pinch or the wheel to zoom.
   main.js builds C and calls createGardenEdit(C).
   ===================================================================== */
import * as THREE from 'three';
import { rotQ, centerCell, moveGarden, itemBack, isMine, parseCell, ckey, cutSquares, wholeOf } from './gardenedit-core.js';

export function createGardenEdit(C){
  const { CELL } = C, S = () => C.S();
  const TILE_GEO=new THREE.PlaneGeometry(CELL*0.86, CELL*0.86).rotateX(-Math.PI/2);
  const RING_GEO=new THREE.RingGeometry(0.42, 0.56, 28).rotateX(-Math.PI/2);
  const OK_C=new THREE.Color(0x8fe08a), BAD_C=new THREE.Color(0xe2604d), SEL_C=0xffd84a;
  let E=null;

  const entOf = rec => C.plantEntOf(rec);
  const soft = rec => { const P=C.PLANTS[rec.sp]; return P && (P.ptype==='crop' || P.ptype==='flower'); };
  const solidAt = rec => { const P=C.PLANTS[rec.sp]; return P && (P.ptype==='tree' || P.ptype==='shrub') && (rec.stage|0)>=2; };
  const word = n => `${n} plant${n===1?'':'s'}`;
  // v1.72 the highest ground under a square, so its marker shows above soil laid on a slope
  const topY = (x, z) => { let y=C.groundY(x,z); for (const [a,b] of [[-0.36,-0.36],[0.36,-0.36],[-0.36,0.36],[0.36,0.36]]) y=Math.max(y, C.groundY(x+a,z+b)); return y+0.05; };

  /* ---------- start and stop ---------- */
  function start(o={}){
    const pp=C.player.pos; let at=new THREE.Vector3(pp.x, 0, pp.z), dist=16, ctx=o.g||null;
    if (!ctx){ let bd=12; for (const g of S().gardens||[]) for (const k of g.cells){ const [i,j]=parseCell(k), d=Math.hypot(i*CELL-pp.x, j*CELL-pp.z); if (d<bd){ bd=d; ctx=g; } } }
    if (o.g){ const cs=o.g.cells.map(parseCell), [ci,cj]=centerCell(cs); at.set(ci*CELL, 0, cj*CELL); const span=Math.max(...cs.map(([i,j])=>Math.max(Math.abs(i-ci),Math.abs(j-cj))))*2*CELL; dist=Math.max(11, Math.min(30, span*1.5+9)); }
    at.y=C.groundY(at.x, at.z);
    E={ kind:'garden', camT:at, dist, minD:7, phase:'pick', mode:'plants', sel:new Set(), whole:null, squares:new Set(), sqOn:false, ctx, marks:new THREE.Group(), ghost:null, ask:false, msg:'' };
    C.scene.add(E.marks);
    if (o.g) pickWhole(o.g); else if (o.rec && isMine(o.rec)) E.sel.add(o.rec);
    drawMarks(); return E; }
  function cleanup(){ if (!E) return; if (E.phase==='move') dropGhost(); C.scene.remove(E.marks); E=null; }

  /* ---------- picking ---------- */
  function pickWhole(g){ E.whole=g; E.ctx=g; E.sel=new Set(C.gardenPlants(g).filter(isMine)); E.ask=false; }
  function toggle(rec){ if (E.whole){ E.whole=null; E.sel.clear(); }   // tapping one plant after the whole garden starts a fresh pick
    if (E.sel.has(rec)) E.sel.delete(rec); else E.sel.add(rec); const g=C.gardenAtXZ(rec.x, rec.z); if (g) E.ctx=g; E.ask=false; }
  // the plant of yours nearest a point on the ground, within reach of a finger
  function mineNear(x, z, r=0.7){ let best=null, bd=r; for (const p of S().plants){ if (!isMine(p) || p.x>500) continue; const d=Math.hypot(p.x-x, p.z-z); if (d<bd){ bd=d; best=p; } } return best; }
  function tap(cx, cy){ if (!E) return;
    if (E.phase==='move'){ const g=C.groundAtScreen(cx, cy); if (g){ setAnchor(g.x, g.z); C.Snd.click(); } return; }
    if (E.mode==='soil') return soilTap(cx, cy);
    const p=C.pickAt(cx, cy); if (!p) return;
    const e=p.ent;
    if (e && e.kind==='garden' && e.g){ pickWhole(e.g); C.Snd.click(); return redraw(); }
    if (e && (e.kind==='plant' || e.kind==='tree') && e.rec){
      if (!isMine(e.rec)){ C.toast('That one grows wild, so it isn\'t yours to move. The shovel can dig it up.'); return; }
      toggle(e.rec); C.Snd.click(); return redraw(); }
    const pt=p.ground || p.point; if (!pt) return;
    const rec=mineNear(pt.x, pt.z); if (rec){ toggle(rec); C.Snd.click(); return redraw(); }
    const g=C.gardenAtXZ(pt.x, pt.z); if (g){ pickWhole(g); C.Snd.click(); return redraw(); } }
  /* ---------- v1.72 picking soil squares ---------- */
  const cellKeyOf = rec => ckey(...C.cellOf(rec.x, rec.z));
  const mineOn = keys => { const set=keys instanceof Set ? keys : new Set(keys); return S().plants.filter(p=>isMine(p) && p.x<500 && set.has(cellKeyOf(p))); };
  const emptyOf = g => { const used=new Set(S().plants.filter(p=>p.x<500).map(cellKeyOf)); return g.cells.filter(k=>!used.has(k)); };
  function soilTap(cx, cy){ const p=C.pickAt(cx, cy);
    if (p && p.ent && p.ent.kind==='garden' && p.ent.g){ E.squares=new Set(p.ent.g.cells); E.ctx=p.ent.g; E.ask=false; C.Snd.click(); return redraw(); }
    const pt=C.groundAtScreen(cx, cy) || (p && (p.ground || p.point)); if (!pt) return;
    const [i,j]=C.cellOf(pt.x, pt.z), k=ckey(i,j), g=C.gardenAtCell(i,j);
    if (!g){ C.toast('Tap the soil of a garden to pick its squares.'); return; }
    if (E.squares.has(k)) E.squares.delete(k); else E.squares.add(k); E.ctx=g; E.ask=false; C.Snd.click(); redraw(); }
  function setMode(m){ if (E.mode===m) return; E.mode=m; E.sel.clear(); E.whole=null; E.squares.clear(); E.sqOn=false; E.ask=false; C.Snd.click(); redraw(); }
  // turn a soil pick into what moving or taking out works on: a whole garden, or loose squares with your plants on them
  function soilPrep(){ const w=wholeOf(S().gardens||[], [...E.squares]);
    if (w){ pickWhole(w); E.sqOn=false; } else { E.whole=null; E.sqOn=true; E.sel=new Set(mineOn(E.squares)); } }
  function soilReset(){ if (E.mode!=='soil') return; E.whole=null; E.sqOn=false; E.sel.clear(); }
  const newGardenId = () => 'g'+Date.now().toString(36)+Math.floor(Math.random()*1e4);
  const sqWord = n => `${n} square${n===1?'':'s'}`;

  function drawMarks(){ const m=E.marks; while (m.children.length) m.remove(m.children[0]); if (E.phase!=='pick') return;
    const mat=new THREE.MeshBasicMaterial({ color:SEL_C, transparent:true, opacity:0.9, depthWrite:false });
    for (const rec of (E.mode==='soil' ? mineOn(E.squares) : E.sel)){ const r=new THREE.Mesh(RING_GEO, mat); r.position.set(rec.x, C.groundY(rec.x, rec.z)+0.06, rec.z); if (!soft(rec)) r.scale.setScalar(1.8); m.add(r); }
    const cs0 = E.mode==='soil' ? [...E.squares] : E.whole ? E.whole.cells : null;
    if (cs0 && cs0.length){ const cs=cs0, tiles=new THREE.InstancedMesh(TILE_GEO, new THREE.MeshBasicMaterial({ color:SEL_C, transparent:true, opacity:0.32, depthWrite:false }), cs.length), d=new THREE.Object3D();
      cs.forEach((k,n)=>{ const [i,j]=parseCell(k), x=i*CELL, z=j*CELL; d.position.set(x, topY(x,z)+0.05, z); d.updateMatrix(); tiles.setMatrixAt(n, d.matrix); }); tiles.frustumCulled=false; m.add(tiles); } }
  function redraw(){ if (!E) return; drawMarks(); C.renderBar(); }

  /* ---------- moving ---------- */
  // a copy to show while moving. three.js copies userData as JSON and a model's userData points back at its plant, so it is left off the copy.
  function ghostOf(obj){ const kept=[]; obj.traverse(o=>{ kept.push([o, o.userData]); o.userData={}; });
    try { return obj.clone(true); } finally { for (const [o,u] of kept) o.userData=u; } }
  // Each picked plant becomes an item: garden plants by their square, the rest (trees, bushes, single plantings) by position.
  function liftGhost(){
    if (E.mode==='soil') soilPrep();
    const recs=[...E.sel], g=E.whole, grp = g ? g.cells : E.sqOn ? [...E.squares] : null, grid=recs.filter(r=>!!C.gardenAtXZ(r.x, r.z) && soft(r)), snap=!!grp || grid.length>0;
    const cells = grp ? grp.map(parseCell) : grid.map(r=>C.cellOf(r.x, r.z));
    let from; if (snap) from=centerCell(cells.length?cells:recs.map(r=>C.cellOf(r.x, r.z)));
    else { let x=0, z=0; for (const r of recs){ x+=r.x; z+=r.z; } from=[x/recs.length, z/recs.length]; }
    const fw = snap ? [from[0]*CELL, from[1]*CELL] : from;
    E.items=recs.map(rec=>{ const e=entOf(rec), onGrid=snap && (grp ? true : grid.includes(rec)); const it={ rec, e, onGrid };
      if (onGrid && !grp){ const [i,j]=C.cellOf(rec.x, rec.z); it.a=i-from[0]; it.b=j-from[1]; } else { it.a=rec.x-fw[0]; it.b=rec.z-fw[1]; }
      if (e){ it.vis=e.obj.visible; it.sol=e.solid; e.obj.visible=false; e.solid=false; } return it; });
    E.cells = grp ? cells.map(([i,j])=>[i-from[0], j-from[1]]) : E.items.filter(it=>it.onGrid).map(it=>[it.a, it.b]);
    E.snap=snap; E.from=from; E.to=from.slice(); E.q=0;
    const grp=new THREE.Group();
    for (const it of E.items){ if (!it.e) continue; const c=ghostOf(it.e.obj); c.visible=true;
      c.traverse(o=>{ if (o.material && o.material.visible!==false){ const mm=(Array.isArray(o.material)?o.material:[o.material]).map(x=>{ const y=x.clone(); y.transparent=true; y.opacity=0.62; y.depthWrite=false; return y; }); o.material=Array.isArray(o.material)?mm:mm[0]; } });
      it.ghost=c; it.r0=c.rotation.y; grp.add(c);
      if (!it.onGrid){ const ring=new THREE.Mesh(RING_GEO, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.85, depthWrite:false })); if (!soft(it.rec)) ring.scale.setScalar(1.8); grp.add(ring); it.ring=ring; } }
    const tiles=new THREE.InstancedMesh(TILE_GEO, new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, depthWrite:false }), Math.max(1, E.cells.length)); tiles.frustumCulled=false; tiles.count=0; grp.add(tiles); E.tiles=tiles;
    C.scene.add(grp); E.ghost=grp; E.phase='move'; E.ask=false; drawMarks(); update(); }
  function dropGhost(){ for (const it of E.items||[]) if (it.e && !it.e.removed){ it.e.obj.visible=it.vis; it.e.solid=it.sol; } if (E.ghost) C.scene.remove(E.ghost); E.ghost=null; E.items=null; E.phase='pick'; soilReset(); }
  // where everything would land with the current spot and turn
  function plan(){ const out=[], q=E.q, to=E.to, toW = E.snap ? [to[0]*CELL, to[1]*CELL] : to;
    for (const it of E.items){ const [a,b]=rotQ(it.a, it.b, q);
      if (it.onGrid && !E.whole && !E.sqOn){ const i=to[0]+a, j=to[1]+b; out.push({ it, x:i*CELL, z:j*CELL, cell:[i,j] }); }
      else out.push({ it, x:toW[0]+a, z:toW[1]+b }); }
    const cells=E.cells.map(([a0,b0])=>{ const [a,b]=rotQ(a0,b0,q); return [to[0]+a, to[1]+b]; });
    return { out, cells }; }
  // Can a garden square go here? (the same test as planting seeds, leaving out what you're moving)
  function cellOk(i, j, others){ const x=i*CELL, z=j*CELL;
    if (!C.walkable(x,z) || C.onDock(x,z) || C.onBridge(x,z) || x>500 || C.rawHeight(x,z)<=C.SAND_H+0.05) return 'water';
    if (C.visPathDist(x,z)<1.0) return 'path';
    for (const [ox,oz] of [[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4],[0.4,0.4]]) if (!C.walkable(x+ox,z+oz)) return 'water';   // v1.72 any slope will do; the soil tilts to fit
    if (C.blocked(x,z,0.3)) return 'blocked';
    for (const q of others) if (Math.abs(q.x-x)<0.55 && Math.abs(q.z-z)<0.55) return 'plants';
    for (const t of C.trees) if (!t.removed && Math.hypot(t.pos.x-x,t.pos.z-z)<1.0) return 'blocked';
    if (E.whole){ const g=C.gardenAtCell(i,j); if (g && g!==E.whole) return 'garden'; }
    return null; }
  // Can a tree, bush or single planting stand here? (the same test as planting one)
  function spotOk(rec, x, z, others){ const P=C.PLANTS[rec.sp], h=C.rawHeight(x,z), sf=soft(rec);
    if (!C.walkable(x,z) || C.onDock(x,z) || C.onBridge(x,z) || x>=500) return 'water';
    if (!(P.sand ? (h>0.15 && h<C.SAND_H) : h>C.SAND_H+0.05)) return P.sand ? 'sand' : 'water';
    if (C.blocked(x,z, sf?0.3:0.8)) return 'blocked';
    const gap = sf ? 0.55 : 1.6; if (others.some(q=>Math.hypot(q.x-x,q.z-z)<gap)) return 'plants';
    if (C.trees.some(t=>!t.removed && Math.hypot(t.pos.x-x,t.pos.z-z)<(P.ptype==='tree'?2.2:1.0))) return 'blocked';
    return null; }
  const WHY = { water:'There\'s water or the edge of the island there.', path:'That\'s too close to a path.', blocked:'Something is in the way.',
    plants:'That\'s too close to other plants.', garden:'That would sit on top of another garden.', sand:'That one only grows on sand.', you:'You\'re standing right there.' };
  function update(){ if (!E || E.phase!=='move') return; const { out, cells }=plan(), sel=new Set(E.items.map(it=>it.rec));
    let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for (const o of out){ x0=Math.min(x0,o.x); x1=Math.max(x1,o.x); z0=Math.min(z0,o.z); z1=Math.max(z1,o.z); }
    for (const [i,j] of cells){ x0=Math.min(x0,i*CELL); x1=Math.max(x1,i*CELL); z0=Math.min(z0,j*CELL); z1=Math.max(z1,j*CELL); }
    const others=S().plants.filter(p=>!sel.has(p) && p.x>x0-2 && p.x<x1+2 && p.z>z0-2 && p.z<z1+2);
    let why=null; const pp=C.player.pos, d=new THREE.Object3D(), tw = E.snap ? [E.to[0]*CELL, E.to[1]*CELL] : E.to;
    E.ghost.position.set(tw[0], 0, tw[1]);
    let k=0; for (const [i,j] of cells){ const w=cellOk(i,j,others), x=i*CELL, z=j*CELL; if (w && !why) why=w;
      d.position.set(x-tw[0], topY(x,z)+0.04, z-tw[1]); d.updateMatrix(); E.tiles.setMatrixAt(k, d.matrix); E.tiles.setColorAt(k, w?BAD_C:OK_C); k++; }
    E.tiles.count=k; E.tiles.instanceMatrix.needsUpdate=true; if (E.tiles.instanceColor) E.tiles.instanceColor.needsUpdate=true;
    for (const o of out){ const it=o.it; let w=null;
      if (!it.onGrid) w=spotOk(it.rec, o.x, o.z, others);
      else if ((E.whole || E.sqOn) && !C.walkable(o.x,o.z)) w='water';
      if (!w && solidAt(it.rec) && Math.hypot(pp.x-o.x, pp.z-o.z)<1.2) w='you';
      if (w && !why) why=w;
      if (it.ghost){ it.ghost.position.set(o.x-tw[0], C.groundY(o.x,o.z), o.z-tw[1]); it.ghost.rotation.y=it.r0+E.q*Math.PI/2; }
      if (it.ring){ it.ring.position.set(o.x-tw[0], C.groundY(o.x,o.z)+0.06, o.z-tw[1]); it.ring.material.color.setHex(w?0xe2604d:0x9ae08a); } }
    const ok=!why, msg=why?WHY[why]:''; E.plan={ out, cells }; if (ok!==E.ok || msg!==E.msg){ E.ok=ok; E.msg=msg; C.renderBar(); } }
  function setAnchor(x, z){ if (!E || E.phase!=='move') return; E.to = E.snap ? [Math.round(x/CELL), Math.round(z/CELL)] : [x, z]; update(); }
  // dragging: true when the finger came down on the copy (then it follows the finger), otherwise the view pans
  function grab(g0){ if (!E || E.phase!=='move' || !g0 || !E.plan) return false;
    const near=E.plan.out.some(o=>Math.hypot(o.x-g0.x, o.z-g0.z)<1.1) || E.plan.cells.some(([i,j])=>Math.abs(i*CELL-g0.x)<CELL*0.7 && Math.abs(j*CELL-g0.z)<CELL*0.7);
    if (!near) return false; const tw = E.snap ? [E.to[0]*CELL, E.to[1]*CELL] : E.to; E.grabOff=[tw[0]-g0.x, tw[1]-g0.z]; return true; }
  function drag(g){ if (!E || !E.grabOff) return; setAnchor(g.x+E.grabOff[0], g.z+E.grabOff[1]); }
  function turn(dq){ E.q=((E.q+dq)%4+4)%4; C.Snd.click(); update(); }
  function putDown(){ if (!E || E.phase!=='move') return; update(); if (!E.ok) return;
    const { out, cells }=E.plan, g=E.whole, sq=E.sqOn, q=E.q, s=S(), soil=E.mode==='soil';
    if (sq){ const list=cutSquares(s.gardens, [...E.squares], newGardenId); s.gardens.splice(0, s.gardens.length, ...list); C.indexGardens(); C.addToGarden(cells); }
    if (g){ const nf=moveGarden(g, E.to, q); g.cells=nf.cells; g.fenced=nf.fenced; g.gate=nf.gate; }
    for (const o of out){ const rec=o.it.rec, e=o.it.e; rec.x=+o.x.toFixed(3); rec.z=+o.z.toFixed(3);
      if (q && e && e.kind!=='tree') rec.rot=((rec.rot||0)+q*Math.PI/2)%(Math.PI*2);
      if (e && !e.removed){ e.pos.set(rec.x, C.groundY(rec.x, rec.z), rec.z); e.obj.position.copy(e.pos); e.obj.rotation.y = e.kind==='tree' ? e.obj.rotation.y+q*Math.PI/2 : (rec.rot||0); } }
    const nq = sq ? cells.map(([i,j])=>ckey(i,j)) : g ? g.cells.slice() : null;
    dropGhost(); C.indexGardens(); if (soil && nq) E.squares=new Set(nq);
    if (!g && !sq){ const loose=out.filter(o=>o.cell && !C.gardenAtCell(o.cell[0], o.cell[1])).map(o=>o.cell); if (loose.length) C.addToGarden(loose); }
    C.rebuildGardens(); C.save(); C.Snd.pop();
    for (const o of out.slice(0,10)) C.puff(new THREE.Vector3(o.x, C.groundY(o.x,o.z)+0.3, o.z), 0xffffff, 3, 0.4, 1.2, 0.6, 0.5);
    C.toast(g ? 'The garden is in its new spot.' : sq ? `Moved ${sqWord(cells.length)} of soil${out.length?` and ${word(out.length)}`:''}.` : `Moved ${word(out.length)}.`); redraw(); }

  /* ---------- taking out ---------- */
  function takeOut(){ if (!E) return; const soil=E.mode==='soil'; if (soil){ if (!E.squares.size) return; soilPrep(); }
    if (!E.sel.size && !E.whole && !E.sqOn) return; const s=S(), recs=[...E.sel], sq=E.sqOn ? [...E.squares] : null; let n=0, ground=false;
    for (const rec of recs){ if (!s.plants.includes(rec)) continue; const P=C.PLANTS[rec.sp], at=new THREE.Vector3(rec.x, C.groundY(rec.x, rec.z), rec.z);
      if (C.isRipe(rec)){ if (P.ptype==='crop') C.harvestRec(rec, true); else if (P.ptype==='flower' && C.addItem(rec.sp)) rec.stage=2; }   // ripe ones are picked first
      if (s.plants.includes(rec)){ s.plants.splice(s.plants.indexOf(rec),1); const e=entOf(rec); if (e) e.remove(); const id=itemBack(rec, P, C.ITEMS); if (id && !C.addItem(id)){ C.dropNear(id, at, 0.3, true); ground=true; } }
      if (n<10) C.puff(at.clone().add(new THREE.Vector3(0,0.2,0)), 0xb08a5a, 4, 0.4, 1.5, 0.7, 0.5); n++; }
    const g=E.whole; if (g && s.gardens.includes(g)) s.gardens.splice(s.gardens.indexOf(g),1);
    if (sq){ const list=cutSquares(s.gardens, sq, newGardenId); s.gardens.splice(0, s.gardens.length, ...list); }
    E.sel.clear(); E.whole=null; E.sqOn=false; E.squares.clear(); E.ask=false; if (E.ctx && !s.gardens.includes(E.ctx)) E.ctx=null;
    C.rebuildGardens(); C.save(); C.Snd.dig();
    C.toast(g ? `Took out the garden${n?` and ${word(n)}`:''}. The grass will grow back.` : sq ? `Took out ${sqWord(sq.length)} of soil${n?` and ${word(n)}`:''}. The grass will grow back.` : `Took out ${word(n)}.`, null, null, ground ? 'Your bag is full, so some are on the ground.' : (n ? 'Their seeds, starts and saplings are in your bag.' : ''));
    redraw(); }

  /* ---------- the bar along the bottom ---------- */
  function renderBar(bar){ if (!E) return; let h='';
    if (E.phase==='move'){ const n=E.items.length, what = E.whole ? 'the garden' : E.sqOn ? `${sqWord(E.cells.length)} of soil` : word(n);
      h=`<div><b>Moving ${what}</b></div>
        <div class="row2"><div class="msg">${E.ok ? (E.snap ? 'Drag it, or tap the ground, to move it. It snaps to the garden squares.' : 'Drag it, or tap the ground, to move it.') : `<span style="color:#c0503a">${E.msg}</span>`}</div></div>
        <div class="row2"><button class="btn alt" id="geL" aria-label="Turn left" style="font-size:22px;padding:4px 12px">&#10226;</button><button class="btn alt" id="geR" aria-label="Turn right" style="font-size:22px;padding:4px 12px">&#10227;</button><div class="msg"></div><button class="btn alt" id="geBack">Back</button><button class="btn" id="geOk" ${E.ok?'':'disabled'}>Put it here</button></div>`; }
    else if (E.ask && E.mode==='soil'){ const w=wholeOf(S().gardens||[], [...E.squares]), n=mineOn(E.squares).length;
      h=`<div><b>${w ? 'Take out this garden?' : `Take out ${sqWord(E.squares.size)} of soil?`}</b></div>
        <div class="row2"><div class="msg">The grass grows back. ${n?`${word(n)} of yours on ${w?'it':'them'} come${n===1?'s':''} out too, and you get their seeds, starts or saplings back. `:''}${w?'Fences and decorations aren\'t refunded.':''}</div><button class="btn alt" id="geKeep">Keep</button><button class="btn warn" id="geYes">Take out</button></div>`; }
    else if (E.ask){ const n=E.sel.size;
      h=`<div><b>${E.whole ? 'Take out this garden?' : `Take out ${word(n)}?`}</b></div>
        <div class="row2"><div class="msg">${n?'You get their seeds, starts or saplings back. Anything ripe is harvested first. ':''}${E.whole?'The soil goes too; fences and decorations aren\'t refunded.':''}</div><button class="btn alt" id="geKeep">Keep</button><button class="btn warn" id="geYes">Take out</button></div>`; }
    else if (E.mode==='soil'){ const n=E.squares.size, ctx=E.ctx && S().gardens.includes(E.ctx) ? E.ctx : null, w=n ? wholeOf(S().gardens||[], [...E.squares]) : null, mine=n ? mineOn(E.squares).length : 0;
      const empty = ctx ? emptyOf(ctx) : [], allEmpty = empty.length>0 && empty.length===n && empty.every(k=>E.squares.has(k));
      const msg = w ? `The whole garden: ${sqWord(n)}, ${word(mine)}.` : n ? `${sqWord(n)} of soil picked${mine?`, with ${word(mine)} of yours on them`:''}. Tap more, or tap one again to drop it.` : 'Tap soil squares to pick them. Your plants on them go along when you move them. Drag to look around.';
      h=`<div class="row2"><b style="flex:1">Garden editor</b>${modeBtns()}</div>
        <div class="row2"><div class="msg">${msg}</div></div>
        <div class="tools">${ctx && !(w===ctx) ? '<button class="tool" id="geWhole">Whole garden</button>' : ''}${ctx && empty.length && !allEmpty ? `<button class="tool" id="geEmpty">Empty squares</button>` : ''}${n ? '<button class="tool" id="geClear">Clear</button><button class="tool" id="geOut">Take out</button><button class="tool on" id="geMove">Move</button>' : ''}<button class="tool" id="geDone" style="flex:0 0 auto;padding:6px 16px">Done</button></div>`; }
    else { const n=E.sel.size, g=E.whole;
      const msg = g ? `The whole garden: ${g.cells.length} square${g.cells.length===1?'':'s'}, ${word(n)}.` : n ? `${word(n)} picked. Tap more to add them, or tap one again to drop it.` : 'Tap plants you planted to pick them. Tap a garden\'s soil or stake for the whole garden. Drag to look around.';
      h=`<div class="row2"><b style="flex:1">Garden editor</b>${modeBtns()}</div>
        <div class="row2"><div class="msg">${msg}</div></div>
        <div class="tools">${E.ctx && S().gardens.includes(E.ctx) && E.whole!==E.ctx ? '<button class="tool" id="geWhole">Whole garden</button>' : ''}${n||g ? '<button class="tool" id="geClear">Clear</button><button class="tool" id="geOut">Take out</button><button class="tool on" id="geMove">Move</button>' : ''}<button class="tool" id="geDone" style="flex:0 0 auto;padding:6px 16px">Done</button></div>`; }
    bar.innerHTML=h; const on=(id,fn)=>{ const b=bar.querySelector('#'+id); if (b) b.onclick=fn; };
    on('geWhole', ()=>{ if (E.mode==='soil') E.squares=new Set(E.ctx.cells); else pickWhole(E.ctx); C.Snd.click(); redraw(); });
    on('geEmpty', ()=>{ E.squares=new Set(emptyOf(E.ctx)); C.Snd.click(); redraw(); });
    on('geModeP', ()=>setMode('plants')); on('geModeS', ()=>setMode('soil'));
    on('geClear', ()=>{ E.sel.clear(); E.whole=null; E.squares.clear(); C.Snd.click(); redraw(); });
    on('geOut', ()=>{ E.ask=true; C.Snd.click(); C.renderBar(); });
    on('geKeep', ()=>{ E.ask=false; C.Snd.click(); C.renderBar(); });
    on('geYes', ()=>takeOut());
    on('geMove', ()=>{ if (E.mode==='soil' ? !E.squares.size : (!E.sel.size && !E.whole)) return; C.Snd.click(); liftGhost(); C.renderBar(); });
    on('geDone', ()=>{ C.Snd.click(); C.end(); });
    on('geL', ()=>turn(1)); on('geR', ()=>turn(3));
    on('geBack', ()=>{ dropGhost(); C.Snd.click(); redraw(); });
    on('geOk', ()=>putDown()); }

  // Plants or Soil: what a tap picks
  const modeBtns = () => `<button class="tool${E.mode==='plants'?' on':''}" id="geModeP" style="flex:0 0 auto;padding:4px 12px">Plants</button><button class="tool${E.mode==='soil'?' on':''}" id="geModeS" style="flex:0 0 auto;padding:4px 12px">Soil</button>`;

  // is there anything of yours to edit near here? (for showing the Garden button)
  function near(x, z, r=7){ const s=S(); if (s.plants.some(p=>isMine(p) && p.x<500 && Math.abs(p.x-x)<r && Math.abs(p.z-z)<r)) return true;
    for (const g of s.gardens||[]) for (const k of g.cells){ const [i,j]=parseCell(k); if (Math.abs(i*CELL-x)<r && Math.abs(j*CELL-z)<r) return true; } return false; }

  return { start, cleanup, tap, grab, drag, renderBar, near, get state(){ return E; }, _dev:{ liftGhost, setAnchor, turn, putDown, takeOut, pickWhole, toggle, setMode, plan:()=>E&&E.plan } };
}
