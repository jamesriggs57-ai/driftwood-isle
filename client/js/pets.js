/* =====================================================================
   v1.67 PETS: one dog or cat that follows you, roams the island or stays home.
   While you have no pet (and no Pet Basket in your bag), a stray dog wanders one small part of your island
   each day and a stray cat another. Winning one over:
     1. Wary: it keeps at least 5 m away and runs if you get closer.
     2. Drop some food (fish, fruit, a crop, a dish) near it and walk off. It eats, and stops avoiding you.
        It still runs a few metres if you come at it fast (running) or head straight at it from close by.
     3. Call it (Psst / Tchk) or pet it. Three calls (or a pet and a call) and it trusts you: it comes to you
        and follows you a short way.
     4. Put a Pet Collar on it (sewn at the sewing machine). It's yours.
   Owned pets: Follow me (comes everywhere except boat trips, including friends' islands), Explore the island
   (wanders your island), Stay home (inside your house). Give it away: it goes in a Pet Basket in your bag,
   which can be mailed or traded to a friend and let out on their island.
   main.js builds C and calls createPets(C). C needs:
     Ent, GroundItem, ents, player, S(), save(), toast(), dialog(), Snd, floatText(text,pos), walkable(x,z), blocked(x,z,r,self),
     groundY(x,z), rawHeight(x,z), SAND_H, OUT, ROOMS, roomAt(x,z), World, VISIT, TRIP, today(), coastR(a), inRects(x,z,r),
     PLACES, countItem(id), removeItem(id,n), addItem(id,meta), canAdd(id,meta), takeGround(ent), scene
   Saved: S.pet = { sp, c, n, mode } and S.petStray = { day, dog:{ st, tr }, cat:{ st, tr } }, S.petHint (both player keys).
   ===================================================================== */
import * as THREE from 'three';
import { mulberry32, hashStr, clamp, TAU } from './util.js';
import { M, mk, G, asChar, addGlow } from './models.js';
import * as P from './pets-core.js';
export * from './pets-core.js';

const ZONE_R = 7, WARY_R = 5, FOLLOW_GAP = 1.4;

/* ---------- models: small, round and simple ---------- */
function seeded(n){ return mulberry32(n>>>0); }
export const buildPet = asChar((sp, coatId, collar) => {
  const c=P.coatOf(sp, coatId), cat=sp==='cat';
  const base=M(c.base, c.glow ? { emissive:c.glow, emissiveIntensity:0.18, roughness:0.7 } : c.sheen ? { metalness:0.3, roughness:0.45 } : { roughness:0.85 });
  const alt=M(c.alt, { roughness:0.85 }), dark=M(c.dark, c.pat==='stars' ? { emissive:c.dark, emissiveIntensity:0.9 } : { roughness:0.85 });
  const nose=M(c.nose, { roughness:0.5 }), eyeM=M(0x161210, { roughness:0.2 }), shine=M(0xffffff, { emissive:0xffffff, emissiveIntensity:0.6 });
  const g=new THREE.Group(), rig=new THREE.Group(); g.add(rig);
  const R=cat?0.13:0.155, BY=cat?0.25:0.29, BL=cat?0.24:0.22;
  // body
  const body=mk(G.cap(R, BL, 6, 14), base, 0, BY, 0, rig); body.rotation.x=Math.PI/2;
  const belly=mk(G.sph(R*0.9, 12, 8), alt, 0, BY-R*0.32, 0.03, rig); belly.scale.set(0.95, 0.6, 1.5);
  // head
  const head=new THREE.Group(); head.position.set(0, BY+(cat?0.17:0.19), BL/2+(cat?0.1:0.12)); rig.add(head);
  const HR=cat?0.135:0.15; mk(G.sph(HR, 16, 12), base, 0, 0, 0, head).scale.set(cat?1.08:1, cat?0.92:1, 0.95);
  const muz=mk(G.sph(cat?0.06:0.085, 12, 8), alt, 0, -0.04, HR*0.82, head); muz.scale.set(cat?1.5:1.1, 0.75, cat?0.8:1.1);
  if (cat) mk(G.sph(0.022, 8, 6), nose, 0, -0.012, HR*0.95+0.01, head).scale.set(1.3, 0.8, 0.8);
  else mk(G.sph(0.032, 10, 8), nose, 0, -0.01, HR*0.82+0.09, head).scale.set(1.3, 0.9, 1);
  const eyeY=cat?0.03:0.035, eyeX=cat?0.058:0.062;
  for (const s of [-1,1]){
    if (cat){ const e=mk(G.sph(0.03, 10, 8), M(c.eye, { roughness:0.2 }), s*eyeX, eyeY, HR*0.86, head); e.scale.set(1, 1.1, 0.6);
      mk(G.sph(0.016, 8, 6), eyeM, s*eyeX, eyeY, HR*0.86+0.016, head).scale.set(0.45, 1.1, 0.5); }
    else mk(G.sph(0.026, 10, 8), eyeM, s*eyeX, eyeY, HR*0.88, head);
    mk(G.sph(0.008, 6, 4), shine, s*eyeX+0.008, eyeY+0.012, HR*0.88+(cat?0.03:0.022), head);
  }
  const ears=[];
  for (const s of [-1,1]){ const ear=new THREE.Group(); head.add(ear); ears.push(ear);
    const earM = (c.pat==='points' || c.pat==='blaze' && false) ? dark : c.pat==='socks' ? base : (c.pat==='patches' && s>0) ? dark : base;
    if (cat){ ear.position.set(s*0.075, HR*0.8, -0.005); ear.rotation.z=-s*0.25;
      mk(G.cone(0.055, 0.1, 4), earM, 0, 0.04, 0, ear).rotation.y=Math.PI/4; mk(G.cone(0.034, 0.065, 4), M(0xf0a8b0), 0, 0.035, 0.018, ear).rotation.y=Math.PI/4; }
    else { ear.position.set(s*0.13, 0.06, -0.01); ear.rotation.z=s*0.35; const e=mk(G.sph(0.075, 10, 8), c.pat==='solid'&&c.id!=='cream' ? M(c.dark, { roughness:0.85 }) : earM, s*0.02, -0.06, 0, ear); e.scale.set(0.45, 1.25, 0.9); }
  }
  // legs (pivot at the hip so they swing)
  const legs=[], LH=cat?0.16:0.19;
  for (const [sx,sz] of [[-1,1],[1,1],[-1,-1],[1,-1]]){ const L=new THREE.Group(); L.position.set(sx*R*0.6, BY-0.02, sz*BL*0.42); rig.add(L); legs.push(L);
    const sock = c.pat==='socks' || c.pat==='tux' || c.pat==='points' || c.pat==='blaze';
    mk(G.cyl(0.042, 0.04, LH, 8), base, 0, -LH/2, 0, L);
    mk(G.sph(0.05, 10, 8), sock ? (c.pat==='points' ? dark : alt) : base, 0, -LH+0.01, 0.02, L).scale.set(1, 0.7, 1.25); }
  // tail
  const tail=new THREE.Group(); tail.position.set(0, BY+0.06, -BL/2-0.1); rig.add(tail);
  const tailM = c.pat==='points' ? dark : base;
  if (cat){ let p=tail; for (let i=0;i<4;i++){ const seg=new THREE.Group(); seg.position.y = i ? 0.075 : 0; seg.rotation.x = i ? -0.32 : -0.5; p.add(seg);
      mk(G.cap(0.026, 0.05, 4, 8), (c.pat==='stripes'||c.pat==='calico') && i%2 ? dark : tailM, 0, 0.04, 0, seg); p=seg; } }
  else { const tg=new THREE.Group(); tg.rotation.x=-0.9; tail.add(tg); mk(G.cap(0.034, 0.12, 4, 8), tailM, 0, 0.08, 0, tg);
    if (c.pat==='blaze' || c.id==='blacktan') mk(G.sph(0.038, 8, 6), c.id==='blacktan' ? base : alt, 0, 0.17, 0, tg); }
  // patterns
  const rnd=seeded(hashStr(sp+coatId));
  const dot=(mat, r, ox, oy, oz, sx=1, sy=0.35, sz=1)=>{ const m=mk(G.sph(r, 10, 6), mat, ox, oy, oz, rig); m.scale.set(sx, sy, sz); return m; };
  const onBody=(a, zf)=>{ // a point on the body's surface: a = angle round the body (0 = top), zf = -1..1 along it
    return [Math.sin(a)*R*0.98, BY+Math.cos(a)*R*0.98, zf*BL*0.55]; };
  const lay=(m, a)=>{ m.rotation.z=-a; };
  if (c.pat==='spots' || c.pat==='stars'){ const n=c.pat==='stars' ? 9 : 11;
    for (let i=0;i<n;i++){ const a=(rnd()-0.5)*2.4, zf=rnd()*2-1, [x,y,z]=onBody(a, zf);
      const m=dot(dark, c.pat==='stars' ? 0.014 : 0.03+rnd()*0.025, x, y, z, 1, c.pat==='stars'?1:0.35, 1); lay(m, a); }
    if (c.pat==='stars'){ addGlow(rig, BY+0.1, 0.9, c.glow).userData.night=false; } }
  if (c.pat==='patches' || c.pat==='calico'){ const mats = c.pat==='calico' ? [dark, M(0x2a2624, { roughness:0.85 })] : [dark];
    for (let i=0;i<5;i++){ const a=(rnd()-0.5)*2.2, zf=rnd()*1.8-0.9, [x,y,z]=onBody(a, zf); const m=dot(mats[i%mats.length], 0.07+rnd()*0.03, x, y, z, 1.2, 0.3, 1.4); lay(m, a); }
    const hp=mk(G.sph(0.07, 10, 6), mats[mats.length-1], 0.07, 0.06, 0.04, head); hp.scale.set(0.8, 0.9, 1.1); }
  if (c.pat==='stripes'){ for (let i=0;i<5;i++){ const zf=-0.8+i*0.4; const tr=mk(G.tor(R*1.0, 0.012, 4, 16, Math.PI*0.9), dark, 0, BY, zf*BL*0.55, rig); tr.rotation.set(0, Math.PI/2, Math.PI/2-Math.PI*0.45); }
    for (let i=-1;i<=1;i++){ const s=mk(G.box(0.012, 0.004, 0.06), dark, i*0.025, HR*0.95, 0.02, head); s.rotation.x=-0.5; } }
  if (c.pat==='tux' || c.pat==='blaze'){ const ch=mk(G.sph(R*0.75, 12, 8), alt, 0, BY+0.02, BL/2+0.06, rig); ch.scale.set(0.9, 1.0, 0.55);
    if (c.pat==='blaze'){ const bl=mk(G.sph(0.03, 8, 6), alt, 0, 0.06, HR*0.9, head); bl.scale.set(0.7, 2.2, 0.5); } }
  if (c.pat==='points'){ const mask=mk(G.sph(0.08, 12, 8), dark, 0, -0.02, HR*0.78, head); mask.scale.set(1.3, 1.0, 0.6); }
  if (c.pat==='socks'){ for (const s of [-1,1]) mk(G.sph(0.018, 8, 6), alt, s*0.06, 0.085, HR*0.85, head); }
  if (c.glow && c.pat!=='stars') addGlow(rig, BY+0.12, 0.9, c.glow).userData.night=false;
  // collar with a bell
  const col=new THREE.Group(); col.visible=!!collar; head.add(col);
  const ring=mk(G.tor(HR*0.62, 0.02, 6, 20), M(0xd84a4a, { roughness:0.6 }), 0, -HR*0.62, -0.02, col); ring.rotation.x=Math.PI/2-0.35;
  mk(G.sph(0.022, 8, 6), M(0xf0c040, { metalness:0.7, roughness:0.3 }), 0, -HR*0.9, HR*0.48, col);
  g.userData.pet={ rig, head, legs, tail, ears, body, collar:col, BY, cat };
  g.traverse(o=>{ if (o.isMesh){ o.castShadow=true; o.receiveShadow=false; } });
  return g;
});

/* item pictures: the collar and the basket */
export function registerPetModels(ITEM_BUILDERS){
  ITEM_BUILDERS.petcollar = g => { const r=mk(G.tor(0.16, 0.04, 8, 24), M(0xd84a4a, { roughness:0.6 }), 0, 0.2, 0, g); r.rotation.x=0.4;
    for (let i=0;i<10;i++){ const a=i/10*TAU; mk(G.sph(0.012, 6, 4), M(0xf8e8c8), Math.cos(a)*0.16, 0.2+Math.sin(a)*0.16*Math.sin(0.4)*-1, Math.sin(a)*0.16*Math.cos(0.4), g); }
    mk(G.sph(0.05, 10, 8), M(0xf0c040, { metalness:0.7, roughness:0.3 }), 0, 0.02, 0.06, g); mk(G.box(0.06, 0.012, 0.012), M(0x6a5020), 0, 0.03, 0.105, g); };
  ITEM_BUILDERS.petbasket = (g, d, id) => { const w=M(0xc89458, { roughness:0.95 }), w2=M(0xa87440, { roughness:0.95 });
    mk(G.cyl(0.32, 0.26, 0.22, 16), w, 0, 0.11, 0, g); mk(G.tor(0.31, 0.04, 6, 20), w2, 0, 0.22, 0, g).rotation.x=Math.PI/2;
    for (let i=0;i<8;i++){ const s=mk(G.box(0.02, 0.2, 0.012), w2, 0, 0.11, 0, g); const a=i/8*TAU; s.position.set(Math.cos(a)*0.3, 0.11, Math.sin(a)*0.3); s.rotation.y=-a; }
    mk(G.cyl(0.27, 0.27, 0.04, 16), M(0xe86a6a, { roughness:1 }), 0, 0.2, 0, g);
    const h=mk(G.tor(0.26, 0.025, 6, 20, Math.PI), w2, 0, 0.22, 0, g); h.rotation.y=Math.PI/2;
    const p=buildPet('cat', 'ginger', true); p.scale.setScalar(0.85); p.position.set(0, 0.06, -0.05); const u=p.userData.pet; u.legs.forEach(l=>l.visible=false); u.rig.position.y=-0.05; g.add(p); };
}

/* ---------- the game side ---------- */
export function createPets(C){
  const S=()=>C.S(), player=C.player;
  const own = () => !C.VISIT && !C.TRIP;
  const D = (a,b) => Math.hypot(a.x-b.x, a.z-b.z);
  const hasBasket = () => (S().inv||[]).some(x=>x.id===P.BASKET);
  const strayAllowed = () => own() && !S().pet && !hasBasket() && !!C.started();
  let strays=[], owned=null, strayDay='';
  const ft = (text, pos) => C.floatText(text, pos.clone().setY(pos.y-1.25));

  /* where the strays live today: two small, grassy spots away from town, picked fresh each day */
  function zones(){
    const r=seeded(hashStr(C.today()+':pets:'+(S().seed||0))), found=[];
    const plaza=C.PLACES.plaza||[0,0], home=C.PLACES.home||[0,0];
    for (let k=0;k<400 && found.length<2;k++){
      const a=r()*TAU, R=C.coastR(a), d=R*(0.25+r()*0.55), x=Math.cos(a)*d, z=Math.sin(a)*d;
      if (!C.walkable(x,z) || C.rawHeight(x,z)<C.SAND_H+0.2 || C.inRects(x,z,4)) continue;
      if (Math.hypot(x-plaza[0], z-plaza[1])<14 || Math.hypot(x-home[0], z-home[1])<10) continue;
      let ok=0; for (let i=0;i<8;i++){ const b=i/8*TAU; if (C.walkable(x+Math.cos(b)*ZONE_R*0.8, z+Math.sin(b)*ZONE_R*0.8)) ok++; } if (ok<6) continue;
      if (found.length && Math.hypot(x-found[0][0], z-found[0][1]) < (k<250 ? 35 : 18)) continue;
      found.push([x,z]); }
    return found; }
  function strayState(){ const s=S(), t=C.today();
    if (!s.petStray || s.petStray.day!==t) s.petStray={ day:t, dog:{ st:0, tr:0 }, cat:{ st:0, tr:0 } };
    return s.petStray; }
  const coatToday = sp => P.rollCoat(sp, seeded(hashStr(C.today()+':coat:'+sp+':'+(S().seed||0)))());

  /* a 4-legged critter that walks about: shared by strays and owned pets */
  class Critter extends C.Ent {
    constructor(sp, coat, x, z, collar){ super('pet', x, z, 0.35); this.sp=sp; this.coat=coat; this.solid=false; this.reach=1.8;
      this.attach(buildPet(sp, coat, collar)); this.hitSphere(0.38, 0.3); this.u=this.obj.userData.pet; this.face=Math.random()*TAU; this.obj.rotation.y=this.face;
      this.target=null; this.timer=1+Math.random()*2; this.sitT=0; this.moving=0; this.ph=Math.random()*10; this.say=0; }
    get room(){ return this.pos.x>500 ? C.roomAt(this.pos.x, this.pos.z) : null; }
    place(x, z){ this.pos.set(x, C.groundY(x,z), z); const want = x>500 ? (C.roomAt(x,z)||{}).group || C.scene : C.OUT;
      if (this.obj.parent!==want){ if (this.obj.parent) this.obj.parent.remove(this.obj); want.add(this.obj); } this.obj.position.copy(this.pos); }
    step(tx, tz, speed, dt, loose){ const dx=tx-this.pos.x, dz=tz-this.pos.z, L=Math.hypot(dx,dz); if (L<0.12){ this.moving=0; return false; }
      const s=Math.min(L, speed*dt), nx=this.pos.x+dx/L*s, nz=this.pos.z+dz/L*s; this.face=Math.atan2(dx,dz);
      const can=(x,z)=>C.walkable(x,z) && (loose || !C.blocked(x,z,0.22,this));
      if (can(nx,nz)) this.place(nx,nz);
      else { let ok=false; for (const b of [0.7,-0.7,1.4,-1.4]){ const ax=this.pos.x+(dx/L*Math.cos(b)-dz/L*Math.sin(b))*s, az=this.pos.z+(dx/L*Math.sin(b)+dz/L*Math.cos(b))*s; if (can(ax,az)){ this.place(ax,az); ok=true; break; } }
        if (!ok){ this.stuck=(this.stuck||0)+dt; this.moving=0; return this.stuck<0.6; } }
      this.stuck=0; this.moving=Math.min(1, speed/2.6); this.sitT=0; return true; }
    animate(dt, t){ const u=this.u; this.ph+=dt*(4+this.moving*12);
      let d=this.face-this.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); this.obj.rotation.y+=d*Math.min(1, dt*9);
      const mv=this.moving>0.01, sw=Math.sin(this.ph)*0.7*(mv?1:0);
      u.legs[0].rotation.x=sw; u.legs[3].rotation.x=sw; u.legs[1].rotation.x=-sw; u.legs[2].rotation.x=-sw;
      if (!mv) this.sitT+=dt; const sit=clamp((this.sitT-1.2)*2, 0, 1);   // sits down after a moment standing still
      u.rig.rotation.x = -0.32*sit; u.rig.position.y = -0.03*sit + (mv ? Math.abs(Math.sin(this.ph))*0.025 : 0);
      u.legs[2].rotation.x += -1.0*sit; u.legs[3].rotation.x += -1.0*sit; u.legs[0].rotation.x += 0.32*sit; u.legs[1].rotation.x += 0.32*sit;
      const wag = u.cat ? Math.sin(t*1.6+this.ph*0.1)*0.35 : Math.sin(t*(this.happy?18:7))*(this.happy?0.7:0.35);
      u.tail.rotation.y = wag; u.tail.rotation.x = u.cat ? 0 : (this.wary ? 0.6 : 0);
      u.head.rotation.x = this.look ? -0.15 : Math.sin(t*0.9+this.ph*0.05)*0.06; u.head.rotation.z = this.tilt ? Math.sin(t*3)*0.18 : 0;
      for (const e of u.ears) e.rotation.x = this.wary ? (u.cat ? 0.5 : -0.2) : 0;
      this.obj.position.copy(this.pos); this.happy=Math.max(0, (this.happy||0)-dt); }
    faceTo(x, z){ this.face=Math.atan2(x-this.pos.x, z-this.pos.z); }
    wanderNear(cx, cz, r, dt, speed=1.0){
      if (this.target){ if (!this.step(this.target[0], this.target[1], speed, dt)){ this.target=null; this.timer=2+Math.random()*4; } return; }
      this.timer-=dt; if (this.timer>0) return;
      for (let k=0;k<10;k++){ const a=Math.random()*TAU, d=Math.random()*r, x=cx+Math.cos(a)*d, z=cz+Math.sin(a)*d;
        if (C.walkable(x,z) && !C.blocked(x,z,0.25,this)){ this.target=[x,z]; break; } }
      this.timer=2+Math.random()*4; }
  }

  /* ---------- strays ---------- */
  class Stray extends Critter {
    constructor(sp, zone){ const coat=coatToday(sp); super(sp, coat, zone[0], zone[1], false); this.zone=zone; this.flee=0; this.food=null; this.eatT=0; this.callCd=0; }
    get st(){ return strayState()[this.sp]; }
    get wary(){ return this.st.st===0 || this.flee>0; }
    get look(){ return this.st.st>0 && D(this.pos, player.pos)<8; }
    get tilt(){ return this.say>0; }
    label(){ const s=this.st.st, d=D(this.pos, player.pos); if (s===0 || this.flee>0) return null;
      if (d<1.9) return s===2 && C.countItem(P.COLLAR)>0 ? 'Put on collar' : 'Pet';
      return P.SPECIES[this.sp].call; }
    act(){ const s=this.st, d=D(this.pos, player.pos); if (s.st===0 || this.flee>0) return;
      if (d<1.9){ if (s.st===2 && C.countItem(P.COLLAR)>0){ adopt(this); return; }
        this.happy=2; ft(P.SPECIES[this.sp].happy, this.pos); C.Snd.pop(); this.trust(2); return; }
      if (this.callCd>0) return; this.callCd=0.9; C.floatText(P.SPECIES[this.sp].call, player.pos); C.Snd.blip(this.sp==='cat'?900:520); this.say=1.2; this.faceTo(player.pos.x, player.pos.z);
      // it takes a step or two your way
      const L=Math.max(0.01,d), n=Math.min(1.2, d-1.8); if (n>0) this.target=[this.pos.x+(player.pos.x-this.pos.x)/L*n, this.pos.z+(player.pos.z-this.pos.z)/L*n];
      this.trust(1); }
    trust(n){ const s=this.st; s.tr+=n;
      if (s.st===1 && s.tr>=3){ s.st=2; this.happy=3; setTimeout(()=>ft(P.SPECIES[this.sp].hi, this.pos), 500);
        const st=S(); if (!st.petHint){ st.petHint=1; setTimeout(()=>C.toast(`The ${this.sp} trusts you.`, null, 'new', 'Put a Pet Collar on it and it\'s yours. Collars are sewn at a sewing machine.'), 900); } }
      C.save(); }
    nearFood(){ let best=null, bd=10;
      for (const e of C.ents){ if (!(e instanceof C.GroundItem) || e.removed || !e.rec || e.rec.note) continue; const it=C.ITEMS[e.rec.id]; if (!it || !P.FOOD_KINDS.includes(it.kind)) continue;
        const d=D(e.pos, this.pos); if (d<bd && D(e.pos, this.zoneV)<ZONE_R+9){ bd=d; best=e; } }
      return best; }
    get zoneV(){ return { x:this.zone[0], z:this.zone[1] }; }
    update(dt, t){
      const s=this.st, pd=D(this.pos, player.pos); this.reach = s.st===0 ? 0 : 6; this.say=Math.max(0, this.say-dt); this.callCd=Math.max(0, this.callCd-dt);
      if (C.World.inside){ this.animate(dt,t); return; }
      // running off
      if (this.flee>0){ this.flee-=dt; const L=Math.max(0.01,pd), tx=this.pos.x+(this.pos.x-player.pos.x)/L*2, tz=this.pos.z+(this.pos.z-player.pos.z)/L*2;
        if (!this.step(tx, tz, 3.4, dt) || D(this.pos, this.zoneV)>ZONE_R*2.6){ const zx=this.zone[0]+(this.pos.x-this.zone[0])*0.3, zz=this.zone[1]+(this.pos.z-this.zone[1])*0.3; this.step(zx, zz, 3.4, dt); }
        this.animate(dt,t); return; }
      // food on the ground near its spot
      if (s.st<2){ const f=this.food && !this.food.removed ? this.food : (this.food=this.nearFood());
        if (f && D(f.pos, player.pos)>2.8){ if (this.eatT>0){ this.eatT-=dt; this.u.head.rotation.x=0.4; this.moving=0; this.faceTo(f.pos.x, f.pos.z);
            if (this.eatT<=0){ C.takeGround(f); this.food=null; C.Snd.pop(); ft(s.st===0?'nom nom':'nom', this.pos); if (s.st===0){ s.st=1; this.say=2; } else this.trust(1); C.save(); }
            this.animate(dt,t); if (this.eatT>0) this.u.head.rotation.x=0.45; return; }
          if (D(this.pos, f.pos)<0.55){ this.eatT=1.4; } else this.step(f.pos.x, f.pos.z, s.st===0?1.6:1.4, dt, true);
          this.animate(dt,t); return; }
        this.eatT=0; }
      if (s.st===0){ // wary: keep at least 5 m away
        if (pd<WARY_R){ const L=Math.max(0.01,pd); let tx=this.pos.x+(this.pos.x-player.pos.x)/L*1.5, tz=this.pos.z+(this.pos.z-player.pos.z)/L*1.5;
          if (!this.step(tx, tz, 3.0, dt)){ const a=Math.atan2(tz-this.pos.z, tx-this.pos.x)+(Math.random()<0.5?1.2:-1.2); this.step(this.pos.x+Math.cos(a)*1.5, this.pos.z+Math.sin(a)*1.5, 3.0, dt); }
          this.target=null; this.faceTo(this.pos.x*2-player.pos.x, this.pos.z*2-player.pos.z); }
        else this.wanderNear(this.zone[0], this.zone[1], ZONE_R, dt, 1.0);
        if (!this.met && pd<9){ this.met=true; const st=S(); if (!st.petMet){ st.petMet=1; C.toast(`A stray ${this.sp}. It keeps its distance.`, null, '', 'Maybe it\'s hungry.'); C.save(); } }
        this.animate(dt,t); return; }
      if (s.st===1){ // calm, but spooked by a fast or head-on approach
        const sp=player.speedFrac||0;
        if (pd<4 && sp>0.05){ const toMe=Math.atan2(this.pos.x-player.pos.x, this.pos.z-player.pos.z), ang=Math.abs(Math.atan2(Math.sin(toMe-player.face), Math.cos(toMe-player.face)));
          if (sp>0.55 || (pd<3 && ang<0.3)){ this.flee=1.5; this.target=null; ft('!', this.pos); C.Snd.blip(1200); this.animate(dt,t); return; } }
        if (this.target){ if (!this.step(this.target[0], this.target[1], 1.2, dt)) this.target=null; }
        else if (pd<9){ this.moving=0; this.faceTo(player.pos.x, player.pos.z); }
        else this.wanderNear(this.zone[0], this.zone[1], ZONE_R, dt, 0.9);
        this.animate(dt,t); return; }
      // trusts you: comes over and follows a short way
      const zd=D(this.pos, this.zoneV);
      if (pd>1.7 && pd<10 && D(player.pos, this.zoneV)<ZONE_R+9){ const L=pd, tx=player.pos.x-(player.pos.x-this.pos.x)/L*1.5, tz=player.pos.z-(player.pos.z-this.pos.z)/L*1.5; this.step(tx, tz, pd>4?2.6:1.6, dt, true); this.happy=Math.max(this.happy,0.3); }
      else if (pd>=10 || zd>ZONE_R+8){ if (zd>ZONE_R) this.step(this.zone[0], this.zone[1], 1.4, dt); else this.wanderNear(this.zone[0], this.zone[1], ZONE_R, dt, 1.0); }
      else { this.moving=0; this.faceTo(player.pos.x, player.pos.z); }
      this.animate(dt,t); }
  }
  function clearStrays(){ for (const e of strays) if (!e.removed) e.remove(); strays=[]; }
  function spawnStrays(){ clearStrays(); strayDay=C.today(); if (!strayAllowed()) return;
    const z=zones(); if (z.length<2) return; strayState();
    strays.push(new Stray('dog', z[0]), new Stray('cat', z[1])); }

  function adopt(st){
    if (C.countItem(P.COLLAR)<1) return; C.removeItem(P.COLLAR, 1);
    const name=P.NAMES[Math.floor(Math.random()*P.NAMES.length)];
    S().pet={ sp:st.sp, c:st.coat, n:name, mode:'follow', since:C.today() }; S().petStray=null;
    const at=[st.pos.x, st.pos.z]; clearStrays(); spawnOwned(at); C.save(); C.Snd.fanfare();
    const co=P.coatOf(st.sp, st.coat);
    C.toast(`You have a ${st.sp}!`, null, 'new', `${co.name}${co.r!=='Common'?' ('+co.r.toLowerCase()+' coat)':''}. It'll follow you around. Tap it to change that.`);
    setTimeout(()=>nameMenu(true), 700); }

  /* ---------- your pet ---------- */
  const MODES = { follow:'Following you', roam:'Exploring the island', home:'At home' };
  class Pet extends Critter {
    constructor(at){ const p=S().pet; super(p.sp, p.c, at[0], at[1], true); this.reach=1.9; this.pausT=0; }
    get look(){ return D(this.pos, player.pos)<3; }
    label(){ return 'Pet'; }
    act(){ const p=S().pet; if (!p) return; this.happy=2.5; ft(P.SPECIES[p.sp].happy, this.pos); C.Snd.pop(); this.faceTo(player.pos.x, player.pos.z); petMenu(); }
    update(dt, t){ const p=S().pet; if (!p){ this.animate(dt,t); return; }
      const inside=C.World.inside||null, myRoom=this.pos.x>500 ? (this.room ? roomId(this.room) : null) : null;
      if (p.mode==='follow'){
        if (inside!==myRoom || D(this.pos, player.pos)>14){ this.toPlayer(); this.animate(dt,t); return; }
        const pd=D(this.pos, player.pos), bx=player.pos.x-Math.sin(player.face)*FOLLOW_GAP, bz=player.pos.z-Math.cos(player.face)*FOLLOW_GAP;
        if (pd>FOLLOW_GAP+0.5){ const ps=(player.speedFrac||0)*5.6*(C.riding()?1.9:1); this.step(bx, bz, Math.max(2.0, pd>4 ? ps*1.15+1 : ps), dt, true); }
        else { this.moving=0; this.pausT+=dt; if (this.pausT>3) this.faceTo(player.pos.x, player.pos.z); }
        if (this.moving) this.pausT=0;
      } else if (p.mode==='roam'){
        const pd=D(this.pos, player.pos);
        if (!inside && pd<7 && Math.random()<dt*0.08) this.visitT=5;
        if (this.visitT>0 && !inside){ this.visitT-=dt; if (pd>1.8) this.step(player.pos.x, player.pos.z, 2.2, dt, true); else { this.moving=0; this.faceTo(player.pos.x, player.pos.z); } }
        else { const h=C.PLACES.home||[0,0]; this.wanderNear(h[0], h[1]+4, 26, dt, 1.1); }
      } else { // home
        const R=C.ROOMS.home; if (R) this.wanderNear(R.ox, R.oz, Math.min(R.w, R.d)/2-1.2, dt, 0.8); else { const h=C.PLACES.home||[0,0]; this.wanderNear(h[0], h[1]+4, 4, dt, 0.8); }
      }
      this.animate(dt,t); }
    toPlayer(){ const a=player.face+Math.PI; let x=player.pos.x+Math.sin(a)*FOLLOW_GAP, z=player.pos.z+Math.cos(a)*FOLLOW_GAP;
      if (!C.walkable(x,z)){ x=player.pos.x+0.3; z=player.pos.z+0.3; } this.place(x,z); this.target=null; }
  }
  const roomId = R => { for (const k in C.ROOMS) if (C.ROOMS[k]===R) return k; return null; };
  function ownedWanted(){ const p=S().pet; if (!p || C.TRIP || !C.started()) return null;
    if (p.mode==='follow') return 'follow'; if (C.VISIT) return null; return p.mode; }
  function spawnOwned(at){ if (owned && !owned.removed) owned.remove(); owned=null; const want=ownedWanted(); if (!want) return;
    let pos=at;
    if (!pos){ if (want==='follow') pos=[player.pos.x-0.8, player.pos.z-1.2];
      else if (want==='home' && C.ROOMS.home){ const R=C.ROOMS.home; pos=[R.ox, R.oz]; }
      else { const h=C.PLACES.home||[0,0]; pos=[h[0]+2, h[1]+5]; } }
    owned=new Pet(pos); if (want==='follow') owned.toPlayer();
    else if (want==='home' && C.ROOMS.home) owned.place(pos[0], pos[1]); }

  /* ---------- menus ---------- */
  function petMenu(){ const p=S().pet; if (!p) return; const sp=P.SPECIES[p.sp], co=P.coatOf(p.sp, p.c);
    const set = m => () => { p.mode=m; C.save(); C.Snd.click();
      if (m==='follow'){ if (!owned || owned.removed) spawnOwned(); C.toast(`${p.n} is following you.`); }
      else if (!own()){ if (owned && !owned.removed) owned.remove(); owned=null; C.toast(`${p.n} trots off home.`, null, '', m==='home' ? 'It\'ll be waiting in your house.' : 'It\'ll be out exploring your island.'); }
      else { const pos = owned && !owned.removed ? [owned.pos.x, owned.pos.z] : null; if (m==='home'){ spawnOwned(); C.toast(`${p.n} heads home.`, null, '', 'It\'ll be waiting in your house.'); } else { spawnOwned(pos && pos[0]<500 ? pos : null); C.toast(`${p.n} runs off to explore.`); } } };
    const ch=[];
    if (p.mode!=='follow') ch.push({ label:'Follow me', fn:set('follow') });
    if (p.mode!=='roam') ch.push({ label:'Go explore the island', fn:set('roam') });
    if (p.mode!=='home') ch.push({ label:'Stay home', fn:set('home') });
    ch.push({ label:'New name', fn:()=>nameMenu(false) }, { label:'Give to a friend', fn:giveMenu }, { label:'Never mind', alt:true, fn:()=>{} });
    C.dialog(p.n, p.sp==='cat'?620:300, [`${sp.hi} (${co.name} ${p.sp}. ${MODES[p.mode]}.)`], null, ch); }
  function nameMenu(first){ const p=S().pet; if (!p) return; const pool=P.NAMES.filter(n=>n!==p.n), pick=[];
    while (pick.length<3){ const n=pool[Math.floor(Math.random()*pool.length)]; if (!pick.includes(n)) pick.push(n); }
    const chose = n => () => { p.n=n; C.save(); C.Snd.jingle(); C.toast(`Hello, ${n}!`); if (owned) { owned.happy=3; ft(P.SPECIES[p.sp].hi, owned.pos); } };
    C.dialog(first ? 'Your new '+p.sp : p.n, p.sp==='cat'?620:300, [first ? `What will you call your ${p.sp}?` : 'Pick a new name.'], null,
      [...pick.map(n=>({ label:n, fn:chose(n) })), { label:'Other names', fn:()=>nameMenu(first) }, { label:`Keep ${p.n}`, alt:true, fn:()=>{} }]); }
  function giveMenu(){ const p=S().pet; if (!p) return;
    if (C.noEdit && C.noEdit()) return;
    if (!C.canAdd(P.BASKET, { sp:p.sp, c:p.c, n:p.n })){ C.toast('Your bag is full. Make room for the basket first.'); C.Snd.fail(); return; }
    C.dialog(p.n, p.sp==='cat'?620:300, [`Put ${p.n} in a basket to give to a friend? You can mail or trade the basket, or let ${p.n} out again yourself.`], null, [
      { label:'Into the basket', fn:()=>{ const pet=S().pet; if (!pet) return; C.addItem(P.BASKET, { sp:pet.sp, c:pet.c, n:pet.n }); S().pet=null; if (owned && !owned.removed) owned.remove(); owned=null; C.save(); C.Snd.pop();
          C.toast(`${pet.n} is curled up in a Pet Basket.`, C.thumb(P.BASKET), '', 'It\'s in your bag. Mail it from the Friends tab, or trade it.'); } },
      { label:'Keep them', alt:true, fn:()=>{} } ]); }

  /* a Pet Basket in your bag: let the pet out */
  function letOut(slot){ const s=S(), e=s.inv[slot]; if (!e || e.id!==P.BASKET) return false; const m=e.m||{};
    if (C.TRIP){ C.toast('Wait till you\'re home. Pets don\'t come on boat trips.'); return false; }
    if (s.pet){ C.toast(`You already have ${s.pet.n}. One pet at a time.`); C.Snd.fail(); return false; }
    if (!P.SPECIES[m.sp]){ C.toast('The basket is empty.'); return false; }
    e.n--; if (e.n<=0) s.inv.splice(slot,1);
    s.pet={ sp:m.sp, c:P.coatOf(m.sp, m.c).id, n:m.n || P.NAMES[0], mode:'follow', since:C.today() }; s.petStray=null; clearStrays(); spawnOwned(); C.save(); C.Snd.jingle();
    C.toast(`${s.pet.n} hops out of the basket!`, null, 'new', 'Tap your pet to have it follow you, explore the island or stay home.'); return true; }

  /* ---------- per frame ---------- */
  function update(){ if (!C.started()) return;
    if (strayAllowed()){ if (strayDay!==C.today()) spawnStrays(); }
    else { if (strays.length) clearStrays(); strayDay=''; }
    const want=ownedWanted();
    if (want && (!owned || owned.removed)) spawnOwned();
    else if (!want && owned && !owned.removed){ owned.remove(); owned=null; }
    else if (owned && want==='home' && C.ROOMS.home && owned.pos.x<500) spawnOwned();
    else if (owned && want==='roam' && owned.pos.x>500) spawnOwned(); }
  // the main loop only updates nearby things; keep your following pet with you even far away
  function tickFar(dt, t){ if (owned && !owned.removed && S().pet && S().pet.mode==='follow' && Math.abs(owned.pos.x-player.pos.x)>=40) owned.update(dt,t); }

  /* ---------- friends see your pet ---------- */
  function netState(){ if (!owned || owned.removed || !S().pet) return null; const o=owned, R=o.pos.x>500 ? roomId(o.room) : null;
    return [o.sp, o.coat, +o.pos.x.toFixed(2), +o.pos.z.toFixed(2), +o.face.toFixed(2), o.moving>0.01?1:0, R]; }
  function remoteUpdate(r, dt, t){ const st=r.pt;
    if (!Array.isArray(st) || !P.SPECIES[st[0]]){ if (r.petObj){ C.scene.remove(r.petObj); r.petObj=null; } return; }
    const key=st[0]+':'+st[1]; if (!r.petObj || r.petKey!==key){ if (r.petObj) C.scene.remove(r.petObj); r.petObj=buildPet(st[0], st[1], true); r.petKey=key; r.petPh=0; C.scene.add(r.petObj); r.petPos=new THREE.Vector3(st[2], C.groundY(st[2],st[3]), st[3]); }
    const tgt=new THREE.Vector3(st[2], C.groundY(st[2],st[3]), st[3]); if (r.petPos.distanceTo(tgt)>8) r.petPos.copy(tgt); r.petPos.lerp(tgt, Math.min(1, dt*8));
    const o=r.petObj, u=o.userData.pet; o.position.copy(r.petPos); let d=st[4]-o.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); o.rotation.y+=d*Math.min(1,dt*9);
    o.visible = (st[6]||null)===(C.World.inside||null) && r.seen;
    r.petPh+=dt*(st[5]?14:3); const sw=st[5]?Math.sin(r.petPh)*0.7:0; u.legs[0].rotation.x=sw; u.legs[3].rotation.x=sw; u.legs[1].rotation.x=-sw; u.legs[2].rotation.x=-sw;
    u.tail.rotation.y=Math.sin(t*(u.cat?1.6:7))*0.35; }
  function remoteGone(r){ if (r.petObj){ C.scene.remove(r.petObj); r.petObj=null; } }

  function newDay(){ strayDay=''; }

  return { update, tickFar, letOut, netState, remoteUpdate, remoteGone, newDay, get owned(){ return owned; }, get strays(){ return strays; },
    wantsFood:()=>strays.some(s=>!s.removed && s.st.st<2 && D(s.pos, player.pos)<14),
    dev:{ spawnStrays, zones, adopt:()=>strays[0] && adopt(strays[0]), strays:()=>strays, owned:()=>owned, petMenu, letOut, P } };
}
