/* =====================================================================
   DRIFTWOOD ISLE: game logic
   Part 1: save state, renderer, island shape, terrain, water, paths, rooms
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32, hashStr, hash2, vnoise, fbm, weightedPick, inHours, inMonths, fmt, polyDist, segDist, Time, seasonOf } from './util.js';
import { ITEMS, NATIVE_FRUITS, PLANTS, TOOLS, WOODWORK, BACKPACKS, BASE_SLOTS, HOUSE_LEVELS, RESIDENTS, DIALOGUE, PEDDLER, EVENTS, rarityLabel, RARITY_COLORS, SHOPS, INVEST, KEEPERS, MUSEUM, BUILD,
  FOREIGN_FRUIT_PRICE, FRUIT_REGROW_DAYS, POTIONS, WIZARD, MAGIC, STORY, FAVOR_ASKS, CROPS, RECIPES, ARRIVE, MENTOR, islandSeedPool, ISLAND_SEED_BUY, GARDEN_FENCES, GARDEN_DECOR, FR, RARE_WORK, RARE_ODDS, PLAN_PRICE,
  WEAR_IDS, FAVOR_THEMES, DO_TASKS, ORIGINAL_RESIDENTS } from './content.js';
import { ACHIEVEMENTS, ACH_GROUPS } from './achieve.js';
import { BY_SLOT, SLOT_NAMES } from './wardrobe-data.js';
import { CELL, buildSoil, buildFences, buildStake, buildGardenSign, buildScarecrow, buildLanternPost, buildFlowerArch } from './farm.js';
import { Snd } from './audio.js';
import { LAYOUTS, DEFAULT_SHAPE, islandRadius, generateLayout, bluffD, generateTrip, TRIP_THEMES } from './layouts.js';
import { buildBike, MODEL, M, mk, G, outline, windowMat, glowMats, glowMat, glowSprites, addGlow, textSprite, PALETTE, buildItemModel, thumb, toolThumb, FURN_BUILDERS, MF,
  buildTree, buildStump, buildShrub, buildFlower, buildTool, buildAnimal, buildPlayer, buildHouse, buildStall, buildBoard, buildPlankDeck, buildRoom, buildBird, buildGull, buildDuck, buildWeedClump } from './models.js';
import './furn.js';
import './decor2.js';
import { addAura, buildBottle } from './rare.js';
import * as GC from './ground.js';
import * as CH from './chars.js';
import { openCreator } from './creator.js';
import { createParty } from './party.js';
import { buildPlot, buildStand, buildStore, buildTownHall, buildMuseumTier, buildCrop, buildStairs } from './models3.js';
import { buildCottage } from './cottage.js';
import { MIX_GROUPS, FOSSIL_CAP, SHELL_CAP, TANK_GROUPS, tankOf, isBigFossil, museumLayout, buildMuseumHall, buildDesk, buildBench, buildPalm, buildCenterpiece, buildShellCase, shellSlots, buildPedestal, fossilModel, shellModel, buildTank, buildTankView } from './museum.js';
import { buildShopBuilding, buildMuseum, buildKeeper, buildMossby, buildExhibit, buildTower, buildWizard } from './models2.js';
import { hasUpstairs, winAt, winKey, trelAt, balcAt, buildCustomHouse, buildHomeInterior, planGrid, planCells, planProblem, fixDoor, linkKey, linkOf, defaultExt, defaultRoom,
  NFLOORS, FLOOR_KEYS, STAIR_KEYS, FLOOR_NAME, FLOOR_SHORT, floorOf, floorHas, topFloor, stairsOf, shiftPlan, ex as hex_, ez as hez_, ix as hix_, iz as hiz_, cellInside, ridgeOf, cellRects,
  buildMossLayer, defaultMoss, mossCellAt, roofHit, roofPick, roofHalfCells, MOSS_GRID, balconyList, SIDES, LT } from './house.js';

const $ = s => document.querySelector(s);
const World = { weather:'sunny', season:seasonOf(Time.month()), night:0, inside:null };
let buildMode=null;   // set while the home builder is open
MODEL.season = World.season; MODEL.month = Time.month();

/* ---------- Save state ---------- */
const SAVE_KEY = 'driftwood-isle-save-v1';
function freshState(){
  return { v:2, player:'', island:'', seed:(Math.random()*1e9)|0, clams:1000, inv:[], seen:{}, rec:{}, placed:[], ground:[], plants:[], cut:{},
    friend:{}, house:0, fund:0, home:null, shops:{}, museum:{}, pack:-1, tools:{}, toolEver:{}, toolOffer:{}, equip:null, stats:{ bugs:0, fish:0, dug:0, chopped:0, watered:0 }, craft:null, craftHint:false, day:null, nativeFruit:null, caught:0,
    settings:{ sound:true, music:0.6, bright:1 }, layout:'classic', styles:{}, gardens:[] };
}
function migrate(s){
  // v1.23: better tools are offered by Pemberton. Old saves count what they already owned as offered.
  if (s.toolOffer===undefined) s.toolOffer=Object.assign({}, s.toolEver||{});
  if (s.v===1){ s.v=2; s.day=null; s.ground=[]; s.clams=(s.clams||0)+500; s.migratedFrom1=true; }
  const base=freshState(); for (const k in base) if (s[k]===undefined) s[k]=base[k];
  for (const k in base.stats) if (s.stats[k]===undefined) s.stats[k]=0;
  // v0.5: house levels become a designed house (rooms on a grid). Money paid toward the next level is returned.
  if (!s.home){
    const lv=s.house||0;
    if (lv===0) s.home={ built:false, paid:0, plan:{ rooms:[defaultRoom('r1',2,2,3,3)], links:{}, door:{i:3,j:4} }, ext:defaultExt() };
    else { const rooms = lv===1 ? [defaultRoom('r1',2,2,3,3)] : lv===2 ? [defaultRoom('r1',1,1,4,4)] : [defaultRoom('r1',1,1,4,4), defaultRoom('r2',5,1,2,3)];
      if (lv===3){ rooms[1].floor='carpet'; rooms[1].floorC=0x8ab0d8; rooms[1].paper='dots'; rooms[1].paperC=0xe8f0f8; }
      const plan={ rooms, links:{}, door:{ i: lv===1?3:2, j: lv===1?4:4 } }; fixDoor(plan);
      s.home={ built:true, paid:planCells(plan), plan, ext:Object.assign(defaultExt(), lv===3?{ porch:'covered', roofC:0x4a7ad8, stories:2 }:lv===2?{ porch:'deck' }:{}) }; }
    if (s.fund>0){ s.clams=(s.clams||0)+s.fund; s.fund=0; }
  }
  // v1.25: the house grid grew from 7 x 6 to 20 x 20 (the old lot is its front middle). Porch lamps became porch lights.
  if (s.home && !s.home.g2){ shiftPlan(s.home.plan, BUILD.SHIFT[0], BUILD.SHIFT[1]); s.home.g2=1; }
  if (s.home && s.home.ext && s.home.ext.light===undefined){ s.home.ext.light = s.home.ext.lamps ? 'lantern' : 'none'; if (s.home.ext.lamps){ s.styles=s.styles||{}; s.styles['lights:lantern']=true; } }
  for (const k of ['general','aquarium','garden']) if (!s.shops[k]) s.shops[k]={ tier:0, trade:0 };
  if (!s.museum.items) s.museum={ items:{}, met:false, gifts:0 };
  return s;
}
const BOOT = window.__BOOT || { mode:'guest' };
const GUEST = BOOT.mode==='guest', VISIT = BOOT.mode==='visit', CAN_EDIT = !VISIT || BOOT.role==='resident';
// v1.26: on a boat trip to a little island with no town. Your own things come along; the island is gone when you sail home.
const TRIP = BOOT.mode==='trip', TRIP_THEME = TRIP ? ((BOOT.trip && BOOT.trip.theme) || 'plain') : null;
if (TRIP_THEME==='moonlit'){ const h0=Time.hour.bind(Time); Time.hour=function(){ return 22.5 + (h0()%1)*0.8; }; }   // always night
if (TRIP_THEME==='frost'){ Time.month=function(){ return 1; }; World.season='winter'; }   // always winter
const GUEST_CAP = { clams:10000, cells:12, minRarity:3 };   // guest mode: wallet cap, house size, common and uncommon only
const allowedFind = it => !GUEST || (it.rarity ?? 5) >= GUEST_CAP.minRarity;
let S=null; if (BOOT.save) S=BOOT.save; else try { S=JSON.parse(localStorage.getItem(SAVE_KEY)); } catch(e){}
S = migrate((S && (S.v===1||S.v===2)) ? S : freshState());
// Generated islands (made in the island maker when signing up) carry their recipe in S.gen
const LAYOUT_ID = (S.layout==='gen' && S.gen) ? 'gen' : LAYOUTS[S.layout] ? S.layout : 'classic';
const LAY = Object.assign({}, DEFAULT_SHAPE, LAYOUT_ID==='gen' ? (S.gen.trip ? generateTrip(S.gen) : generateLayout(S.gen)) : LAYOUTS[LAYOUT_ID]);
const SC = LAY.scale || 1;   // island size (generated islands are about twice the area)
if (!S.terra) S.terra = { cells:{}, moved:{} };   // wizard work: reshaped land, dug water, moved buildings
if (!S.magic) S.magic = {};                       // wizard tower (unlocked by a quest) and where it stands
/* The town: who lives here so far, who's moving in next, the town hall and the island's public projects.
   New islands start with three neighbors; the rest move in rarely, and only once the town gets upgrades (see townCap). Islands from before v1.0
   (they already have a day on the clock or a player name) keep everyone they had. */
const START_RES=['pippa','bramble','mabel'], MOVE_ORDER=['lumi','otis','clover','juniper'];
if (!S.town){ const older = !!S.day || !!S.player; S.town = { res: older ? ORIGINAL_RESIDENTS.slice() : START_RES.slice(), next:null, last:null, hall:0, fund:0, met:{}, deco:0 }; }
S.town.met=S.town.met||{}; S.town.res=S.town.res.filter(id=>RESIDENTS.some(R=>R.id===id));
// v1.26: newer islanders get a home spot on this island when they first book a plot; it's kept here
S.town.homes=S.town.homes||{}; S.town.left=S.town.left||{};
const isOrig = id => ORIGINAL_RESIDENTS.includes(id);
for (const R of RESIDENTS) if (!isOrig(R.id)) R.home = S.town.homes[R.id] ? S.town.homes[R.id].slice() : null;
const livesHere = id => S.town.res.includes(id);
/* v1.19: clothes you own (wear them from Change my look) and achievements you've earned */
S.wardrobe = Array.isArray(S.wardrobe) ? S.wardrobe.filter(id=>ITEMS[id] && ITEMS[id].kind==='wear') : [];
if (S.stats) S.stats.maxClams=Math.max(S.stats.maxClams||0, S.clams||0);
if (VISIT && S.day && S.day.vpicked) S.ground = S.ground.filter(g=>!(g.beach && S.day.vpicked.includes(Math.round(g.x*10)+','+Math.round(g.z*10))));
if (LAY.homes) for (const R of RESIDENTS) if (LAY.homes[R.id]) R.home = LAY.homes[R.id];
if (!S.nativeFruit || !ITEMS[S.nativeFruit]) S.nativeFruit = NATIVE_FRUITS[S.seed % NATIVE_FRUITS.length];
const isTouchDevice = matchMedia('(pointer:coarse)').matches || matchMedia('(any-pointer:coarse)').matches || 'ontouchstart' in window || (navigator.maxTouchPoints||0)>0;
const CTRL_DEFAULT = { move: isTouchDevice ? 'joystick' : 'keys', tapWalk:true, clickWalk:true, floating:false, size:130, opacity:0.45, jx:null, jy:null, ax:null, ay:null };
// v1.11: control settings belong to the device, not the island save. The island save syncs between a player's phone and
// computer, so a computer's "keys" used to follow them onto their phone and leave them with no joystick.
const CTRL_KEY='driftwood-controls-v1';
S.settings.controls = (()=>{
  try { const v=JSON.parse(localStorage.getItem(CTRL_KEY)||'null'); if (v && typeof v==='object') return Object.assign({}, CTRL_DEFAULT, v); } catch(e){}
  // First visit on this device: phones start with the joystick (bottom left). Keep size/visibility/positions from the save,
  // and keep "tap to walk" only if it was picked (that option only exists on touch screens).
  const old=S.settings.controls||{}; return Object.assign({}, CTRL_DEFAULT, old, { move: isTouchDevice && old.move==='tap' ? 'tap' : CTRL_DEFAULT.move });
})();
// On a computer you walk with the keyboard and drag to look around; clicking the ground no longer walks you there.
if (!isTouchDevice) S.settings.controls.move='keys';
else if (S.settings.controls.move!=='tap') S.settings.controls.move='joystick';
function saveControls(){ try { localStorage.setItem(CTRL_KEY, JSON.stringify(S.settings.controls)); } catch(e){} }
saveControls();
// Keyboard shortcuts (Menu > Controls lets you change them)
const KEY_DEFAULT = { act:'e', swing:' ', tool:'q', bike:'b', sled:'g', bag:'i', turnL:'z', turnR:'c' };
S.settings.keys = Object.assign({}, KEY_DEFAULT, S.settings.keys||{});
const KB = () => S.settings.keys;
if (S.settings.bright===undefined) S.settings.bright=1;
let saveOK=true;
function save(){ if (typeof saveControls==='function' && S.settings && S.settings.controls) saveControls(); if (BOOT.onSave){ BOOT.onSave(S); return; } try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){ saveOK=false; } }

/* ---------- Inventory ---------- */
const slotsMax = () => S.pack>=0 ? BACKPACKS[S.pack].slots : BASE_SLOTS;
function canAdd(id){ const st=ITEMS[id].stack; return S.inv.some(s=>s.id===id && !s.m && s.n<st) || S.inv.length < slotsMax(); }
function addItem(id, meta){
  if (!canAdd(id)) return false;
  const st=ITEMS[id].stack, s = meta ? null : S.inv.find(s=>s.id===id && !s.m && s.n<st);
  if (s) s.n++; else S.inv.push(meta ? { id, n:1, m:meta } : { id, n:1 });
  const isNew = !S.seen[id]; if (isNew) S.seen[id] = Date.now();
  save(); return isNew ? 'new' : true;
}
function countItem(id){ return S.inv.reduce((a,s)=>a+(s.id===id?s.n:0),0); }
function removeAt(i, n=1){ const s=S.inv[i]; if(!s) return; s.n-=n; if(s.n<=0) S.inv.splice(i,1); save(); }
function removeItem(id, n=1){ for (let i=S.inv.length-1; i>=0 && n>0; i--){ const s=S.inv[i]; if (s.id!==id) continue; const k=Math.min(n,s.n); s.n-=k; n-=k; if (s.n<=0) S.inv.splice(i,1); } save(); }
function entryPrice(s){ const it=ITEMS[s.id]; if (it.kind==='fruit' && s.id!=='coconut' && S.nativeFruit && s.id!==S.nativeFruit) return FOREIGN_FRUIT_PRICE; return s.m ? Math.round(it.price*(0.85+0.4*(s.m.f||0))) : it.price; }
function addClams(n){ let v=Math.max(0,S.clams+n); if (GUEST && n>0 && v>GUEST_CAP.clams){ v=Math.max(S.clams,GUEST_CAP.clams); toast('Your wallet is full. Guest wallets hold up to 10,000 clams. Make an account to hold more.'); } S.clams=v; save(); updateHUD(); }
// Visitors (not residents) can look, harvest and shop, but not change the island
function noEdit(){ if (CAN_EDIT) return false; toast(`You're a visitor here, so you can't change ${BOOT.host?.name||'your friend'}'s island.`); Snd.fail(); return true; }
// Guest wallets can't go over the cap, so sales that would overflow are refused instead of losing clams
function walletOK(n){ if (!GUEST || S.clams+n<=GUEST_CAP.clams) return true; toast(`Your wallet can only hold ${fmt(GUEST_CAP.clams)} clams as a guest. Make an account to hold more.`); Snd.fail(); return false; }
const discovered = () => Object.keys(S.seen).length;
const bestFriends = () => Object.values(S.friend).filter(f=>f>=15).length;

/* Size and weight for each catch */
function rollStats(id){
  const it=ITEMS[id]; const r=Math.random(); let f = Math.pow(r,1.7); if (Math.random()<0.05) f = 0.88+Math.random()*0.12;
  const L = it.len[0] + (it.len[1]-it.len[0])*f;
  const grams = it.k*Math.pow(L,3);
  return { l:+L.toFixed(1), w:+grams.toFixed(it.kind==='bug'?2:0), f:+f.toFixed(3) };
}
function statText(id, m){
  const it=ITEMS[id]; if(!m) return '';
  const len = it.kind==='fish' ? `${m.l} cm` : `${m.l} mm`;
  const w = m.w>=1000 ? `${(m.w/1000).toFixed(2)} kg` : `${m.w} g`;
  return `${len} · ${w}`;
}
function recordCatch(id, m){
  const r = S.rec[id] || (S.rec[id]={ n:0, l:0, w:0 }); r.n++; let best=false; if (m.l>r.l){ r.l=m.l; best=r.n>1; } if (m.w>r.w) r.w=m.w; save(); return best;
}

/* ---------- Renderer, scene ---------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, powerPreference:'high-performance' });
const isMobile = isTouchDevice;
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile?1.75:2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xbfe6f0, 42, 150);
const camera = new THREE.PerspectiveCamera(38, 1, 0.3, 900);
const OUT = new THREE.Group(); scene.add(OUT);   // everything outdoors (hidden when you are inside a house)

const skyMat = new THREE.ShaderMaterial({
  uniforms:{ top:{value:new THREE.Color()}, bot:{value:new THREE.Color()} },
  vertexShader:'varying vec3 vW; void main(){ vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
  fragmentShader:'uniform vec3 top; uniform vec3 bot; varying vec3 vW; void main(){ float h=normalize(vW-cameraPosition).y; vec3 c=mix(bot,top,smoothstep(-0.02,0.55,h)); gl_FragColor=vec4(c,1.); \n#include <colorspace_fragment>\n }',
  side:THREE.BackSide, depthWrite:false, fog:false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), skyMat); sky.renderOrder=-1; scene.add(sky);
const starGeo = new THREE.BufferGeometry(); { const p=[]; const r=mulberry32(42); for(let i=0;i<800;i++){ const a=r()*TAU, e=0.08+r()*1.4; p.push(Math.cos(a)*Math.cos(e)*500, Math.sin(e)*500, Math.sin(a)*Math.cos(e)*500); } starGeo.setAttribute('position', new THREE.Float32BufferAttribute(p,3)); }
const starMat = new THREE.PointsMaterial({ color:0xfff8e0, size:2, sizeAttenuation:false, transparent:true, opacity:0, fog:false, depthWrite:false });
const stars = new THREE.Points(starGeo, starMat); scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 16), new THREE.MeshBasicMaterial({ color:0xfff3d0, fog:false, transparent:true })); scene.add(moon);
const hemi = new THREE.HemisphereLight(0xffffff, 0x6a8a50, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true;
sun.shadow.mapSize.set(isMobile?1024:2048, isMobile?1024:2048);
Object.assign(sun.shadow.camera, { left:-26, right:26, top:26, bottom:-26, near:1, far:120 });
sun.shadow.bias=-0.0006; sun.shadow.normalBias=0.03; scene.add(sun); scene.add(sun.target);

const SKY_KEYS = [
  { h:0,    top:0x1f3a7c, bot:0x4a64a8, sun:0xc4d2ff, si:1.35, hs:0xa2b6ec, hg:0x56628c, hi:1.55 },
  { h:4.5,  top:0x284284, bot:0x5c6aa8, sun:0xc8d0ff, si:1.3,  hs:0xa0b0e6, hg:0x565e88, hi:1.5 },
  { h:6,    top:0x7090d4, bot:0xf8bcae, sun:0xffc8aa, si:1.8,  hs:0xecd4e8, hg:0x8a8090, hi:1.4 },
  { h:7.5,  top:0x7ed0f4, bot:0xffeccc, sun:0xffe0b8, si:2.9,  hs:0xc8d8ff, hg:0x8aa07a, hi:1.3 },
  { h:12,   top:0x62c4f8, bot:0xdcf8ff, sun:0xfff0d8, si:3.1,  hs:0xc4d6ff, hg:0x8cac78, hi:1.35 },
  { h:16.5, top:0x72c0f0, bot:0xfff0cc, sun:0xffd8a0, si:2.9,  hs:0xccd0f4, hg:0x949a7a, hi:1.3 },
  { h:18.5, top:0x6880c8, bot:0xffb490, sun:0xffaa80, si:2.2,  hs:0xfcc8b8, hg:0x9a8080, hi:1.45 },
  { h:20,   top:0x34488a, bot:0x9276b6, sun:0xbcb4f0, si:1.6,  hs:0xaaa4dc, hg:0x605c80, hi:1.5 },
  { h:22,   top:0x253f80, bot:0x4a62a6, sun:0xc4d2ff, si:1.35, hs:0xa2b6ec, hg:0x56628c, hi:1.55 },
  { h:24,   top:0x1f3a7c, bot:0x4a64a8, sun:0xc4d2ff, si:1.35, hs:0xa2b6ec, hg:0x56628c, hi:1.55 },
];
const _c1=new THREE.Color(), _c2=new THREE.Color();
function keyLerp(h, f){ let a=SKY_KEYS[0], b=SKY_KEYS[1]; for(let i=0;i<SKY_KEYS.length-1;i++){ if(h>=SKY_KEYS[i].h && h<=SKY_KEYS[i+1].h){ a=SKY_KEYS[i]; b=SKY_KEYS[i+1]; break; } } return [a[f], b[f], (h-a.h)/(b.h-a.h||1)]; }
function colAt(h, f, out){ const [a,b,t]=keyLerp(h,f); return out.setHex(a).lerp(_c2.setHex(b), t); }
function numAt(h, f){ const [a,b,t]=keyLerp(h,f); return lerp(a,b,t); }

/* ---------- Island shape (heightAt is the single source of truth) ---------- */
const RIVER = LAY.river;
const POND = LAY.pond;
function islandR(a){ return islandRadius(LAY, a); }
// Cliff coast direction: c > 0 on the cliff side (for the preset Highlands this is the old cos(angle) on the west)
const cliffC = a => LAY.cliff ? -Math.cos(a - LAY.cliff.a) : 0;
function baseHeight(x, z){
  const r=Math.hypot(x,z), a=Math.atan2(z,x), t=r/islandR(a);
  let h = -2.4 + 2.75*smooth(1.13, 0.99, t) + 0.95*smooth(0.96, 0.88, t);
  if (LAY.cliff){   // sheer drop on the cliff side, wide gentle beach on the opposite side
    const c=cliffC(a), wW=smooth(-0.15,-0.6,c), wE=smooth(0.15,0.6,c);
    if (wW>0) h = lerp(h, -2.6 + 3.7*smooth(1.03, 0.995, t), wW);
    if (wE>0) h = lerp(h, -2.4 + 2.75*smooth(1.2, 0.99, t) + 0.95*smooth(0.86, 0.76, t), wE);
  }
  const inland = smooth(0.95, 0.78, t);
  h += inland*(fbm(x*0.045+3, z*0.045+7)-0.5)*1.2;
  for (const [bx,bz,A,r0,r1] of LAY.bumps) h += A*smooth(r0, r1, Math.hypot(x-bx, z-bz))*inland;
  const dR=polyDist(x,z,RIVER); if (dR<4.4){ const k=smooth(1.7,4.3,dR); h = lerp(Math.min(h,-1.15), h, k); }
  const dP=Math.hypot(x-POND.x, z-POND.z); if (dP<7.5) h = lerp(Math.min(h,-1.2), h, smooth(POND.r-0.4, POND.r+2.2, dP));
  return h;
}
/* v0.6 terrain preview, layered on top of the original island.
   'tiers' (default): broad gentle hills built from low, flat terraces (0.55 m steps). Every building, the plaza
   and your lot sit flat on one terrace; paths ramp smoothly between terraces.
   'hills': the earlier smooth-hills test. 'flat': the original island.
   Trees and rocks are still placed using the original heights, so every saved tree keeps its spot. */
const TERRAIN_STYLE='tiers';   // gentle terraces are the island's terrain (decided 2026-11-22)
const MOUNDS = LAY.mounds;   // tier style
const TIER = { step:0.55, off:0.85, riser:0.2 };   // terrace height, lowest terrace, share of each step used by the slope between terraces
const HGR = Math.ceil(62*SC);   // the height grid covers the whole island (bigger for generated islands)
const HG = { x0:-HGR, z0:-HGR, step:0.5, n:Math.round(HGR*4)+1, h:null, s:null };
function hillSample(arr, x, z){ const fx=(x-HG.x0)/HG.step, fz=(z-HG.z0)/HG.step; if(fx<0||fz<0||fx>=HG.n-1||fz>=HG.n-1) return 0;
  const i=Math.floor(fx), j=Math.floor(fz), u=fx-i, v=fz-j, n=HG.n, k=j*n+i; return (arr[k]*(1-u)+arr[k+1]*u)*(1-v) + (arr[k+n]*(1-u)+arr[k+n+1]*u)*v; }
function rawHeight(x, z){ const h=baseHeight(x,z); return HG.h ? h+hillSample(HG.h,x,z) : h; }
const hillSlope = (x,z) => HG.s ? hillSample(HG.s,x,z) : 0;
const MAX_SLOPE = TERRAIN_STYLE==='tiers' ? 2.2 : 0.9;   // steeper than this is a wall you walk around (terrace edges are low enough to step up)
const SAND_H = 0.62;
const DOCK = { z:4, w:1.3, x0:0, x1:0, y:0.72 };
{ let x=30*SC; while (rawHeight(x, DOCK.z) > 0.25 && x < 80*SC) x += 0.2; DOCK.x0 = x-3.5; DOCK.x1 = x+10; }
const onDock = (x,z) => x>DOCK.x0 && x<DOCK.x1 && Math.abs(z-DOCK.z)<DOCK.w;
// Bridges are placed across the river where paths need to cross
function makeBridge(i, t, len=8.5, w=1.35){ const a=RIVER[i], b=RIVER[i+1]; const cx=lerp(a[0],b[0],t), cz=lerp(a[1],b[1],t); const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz); return { x:cx, z:cz, ux:-dz/L, uz:dx/L, len, w }; }
const BRIDGES = LAY.bridges.map(([i,t])=>makeBridge(i,t));
function bridgeLocal(b,x,z){ const dx=x-b.x, dz=z-b.z; return [dx*b.ux+dz*b.uz, -dx*b.uz+dz*b.ux]; }
function onBridge(x,z){ for(const b of BRIDGES){ const [u,v]=bridgeLocal(b,x,z); if(Math.abs(u)<b.len/2 && Math.abs(v)<b.w) return b; } return null; }
const bridgeY = (b,x,z) => { const [u]=bridgeLocal(b,x,z); return 0.45+0.45*Math.cos(clamp(u/(b.len/2),-1,1)*Math.PI/2); };

/* Wizard terraforming: the island is split into TC-metre cells. d = terrace steps up (+) or down (-),
   w = dug water (1 pond, 2 river). Edges are softened a little so new terraces and banks look natural. */
const TC = 2.5;
const TERRA = S.terra.cells || (S.terra.cells = {});
const terraKey = (x,z) => Math.floor(x/TC)+','+Math.floor(z/TC);
const terraAt = (x,z) => TERRA[terraKey(x,z)];
const TERRA_ANY = Object.keys(TERRA).length>0;
const SOFT=[[-0.35,-0.35],[0,-0.35],[0.35,-0.35],[-0.35,0],[0,0],[0.35,0],[-0.35,0.35],[0,0.35],[0.35,0.35]];
function terraDelta(x,z){ if(!TERRA_ANY) return 0; let s=0; for(const [ox,oz] of SOFT){ const c=TERRA[terraKey(x+ox,z+oz)]; if(c&&c.d) s+=c.d; } return s/9; }
// New land raised from the sea by Wendell (cells with L). Blended between cell centers so the new shore slopes gently.
function terraLand(x,z){ if(!TERRA_ANY) return 0; const fx=x/TC-0.5, fz=z/TC-0.5, i=Math.floor(fx), j=Math.floor(fz), u=fx-i, v=fz-j; const L=(a,b)=>{ const c=TERRA[a+','+b]; return c&&c.L?1:0; };
  return (L(i,j)*(1-u)+L(i+1,j)*u)*(1-v) + (L(i,j+1)*(1-u)+L(i+1,j+1)*u)*v; }
function terraWet(x,z){ if(!TERRA_ANY) return 0; let s=0; for(const [ox,oz] of SOFT){ const c=TERRA[terraKey(x+ox,z+oz)]; if(c&&c.w) s++; } return s/9; }
// Waterfalls: a high pool on a little plateau spills over a sheer face into the river's source
const FALLS = [];
if (LAY.falls){ const s=RIVER[0], nx=RIVER[1], L=Math.hypot(s[0]-nx[0],s[1]-nx[1]); let dx=(s[0]-nx[0])/L, dz=(s[1]-nx[1])/L; if (LAY.falls.dir){ dx=LAY.falls.dir[0]; dz=LAY.falls.dir[1]; }
  FALLS.push({ sx:s[0], sz:s[1], dx, dz, cx:s[0]+dx*7, cz:s[1]+dz*7, top:LAY.falls.h, Rp:6.5 }); }
const fallLocal = (F,x,z) => { const ux=x-F.sx, uz=z-F.sz; return [ux*F.dx+uz*F.dz, -ux*F.dz+uz*F.dx]; };
function inFallPool(x,z){ for(const F of FALLS){ const [u,v]=fallLocal(F,x,z); if (((u-4)/2.7)**2+(v/2.1)**2<1) return F; } return null; }
const nearFall = (x,z,r=0) => FALLS.some(F=>Math.hypot(x-F.cx,z-F.cz)<F.Rp+6.5+r);

/* Rooms (house interiors) live far away from the island and are shown only when you are inside */
const ROOMS = {};
const roomOrigin = i => [700 + i*60, 700];
function roomAt(x,z){ for(const id in ROOMS){ const R=ROOMS[id]; if (Math.abs(x-R.ox)<R.w/2+1 && Math.abs(z-R.oz)<R.d/2+1.5) return R; } return null; }
const roomWalk = (R,x,z) => R.walk ? R.walk(x,z) : (Math.abs(x-R.ox)<R.w/2-0.4 && z>R.oz-R.d/2+0.4 && z<R.oz+R.d/2-0.05);

function groundY(x,z){ if (x>500) return 0; const b=onBridge(x,z); if(b) return bridgeY(b,x,z); if (onDock(x,z)) return DOCK.y; return Math.max(rawHeight(x,z), -0.2); }
const onWall = (x,z) => { if (!HG.wall) return false; const i=Math.round((x-HG.x0)/HG.step), j=Math.round((z-HG.z0)/HG.step); return i>=0&&j>=0&&i<HG.n&&j<HG.n && HG.wall[j*HG.n+i]===1; };   // sheer bluff edges
function walkable(x,z){ if (x>500){ const R=roomAt(x,z); return !!R && roomWalk(R,x,z); } return onDock(x,z) || !!onBridge(x,z) || (rawHeight(x,z) > 0.1 && hillSlope(x,z) < MAX_SLOPE && !(FALLS.length && inFallPool(x,z)) && !onWall(x,z)); }
function isFishWater(x,z){ return x<500 && !walkable(x,z) && rawHeight(x,z) < -0.15; }
function waterType(x,z){ if (Math.hypot(x-POND.x,z-POND.z)<POND.r+1.5) return 'pond'; const c=TERRA_ANY && terraAt(x,z); if (c && c.w) return c.w===2?'river':'pond'; const r=Math.hypot(x,z), t=r/islandR(Math.atan2(z,x)); if (polyDist(x,z,RIVER)<3.2 && t<1.0) return 'river'; return 'sea'; }
const isBeach = (x,z) => { const h=rawHeight(x,z), t=Math.hypot(x,z)/islandR(Math.atan2(z,x)); return h>0.15 && h<SAND_H && t>0.88; };

/* Layout: where buildings sit. Door is in front (+z).
   PLACES0 is the island as first made (trees and rocks are placed around it, so saved trees keep their spots).
   PLACES is where things stand now, after any buildings the wizard moved. */
const PLACES0 = JSON.parse(JSON.stringify(LAY.places)); delete PLACES0.tower;
for (const R of RESIDENTS) if (isOrig(R.id)) PLACES0[R.id]=R.home;
const LOT0 = { ...LAY.lot };
const PLACES = JSON.parse(JSON.stringify(PLACES0));
const LOT = { ...LOT0 };   // center of the player's building lot (7 x 6 cells)
if (S.magic.tower){ if (!S.magic.at) S.magic.at = LAY.places.tower ? LAY.places.tower.slice() : null; if (S.magic.at) PLACES.tower = S.magic.at.slice(); }
// The town hall stands near the plaza. Islands made before it existed get a spot picked the same way every time
// (dry, fairly flat, clear of every building and the dock); trees standing there just don't grow any more.
const HALL_FOOT=4.6;
function findHallSpot(){
  const r=mulberry32((S.seed|0)+4242), lr=[LOT0.x-BUILD.LW*BUILD.EC/2-5, LOT0.z-BUILD.LD*BUILD.EC/2-5, LOT0.x+BUILD.LW*BUILD.EC/2+5, LOT0.z+BUILD.LD*BUILD.EC/2+7];
  const tw = S.magic.at || LAY.places.tower;
  for (let k=0;k<2000;k++){ const a=r()*TAU, d=(10+r()*14)*Math.min(SC,1.2)+k*0.01, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if (Math.hypot(x,z)/islandR(a)>0.68 || polyDist(x,z,RIVER)<10 || Math.hypot(x-POND.x,z-POND.z)<POND.r+9 || nearFall(x,z,5)) continue;
    if (x>DOCK.x0-12 && Math.abs(z-DOCK.z)<10) continue; if (x>lr[0]&&x<lr[2]&&z>lr[1]&&z<lr[3]) continue;
    if (Object.entries(PLACES).some(([kk,p])=>kk!=='board' && Math.hypot(x-p[0],z-p[1]) < (kk==='plaza'?9:kk==='museum'?9.5:6.2)+HALL_FOOT)) continue;
    if (tw && Math.hypot(x-tw[0],z-tw[1])<HALL_FOOT+6.5) continue;
    let lo=99, hi=-99, bad=false; for (let i=0;i<=12;i++){ const aa=i/12*TAU, rr=i===12?0:HALL_FOOT, h=baseHeight(x+Math.cos(aa)*rr, z+Math.sin(aa)*rr); if (h<0.6){ bad=true; break; } lo=Math.min(lo,h); hi=Math.max(hi,h); }
    if (bad || hi-lo>1.2 || baseHeight(x,z+HALL_FOOT+3)<0.6) continue;
    return [+x.toFixed(1), +z.toFixed(1)]; }
  return null;
}
if (S.town && !VISIT && S.town.at===undefined) S.town.at = findHallSpot();
if (S.town && S.town.at) PLACES.hall = S.town.at.slice();
for (const R of RESIDENTS) if (!isOrig(R.id) && R.home) PLACES[R.id]=R.home.slice();
for (const [k,p] of Object.entries(S.terra.moved||{})){ if (!PLACES[k] || !Array.isArray(p)) continue; if (k==='home'){ LOT.x += p[0]-PLACES.home[0]; LOT.z += p[1]-PLACES.home[1]; } PLACES[k]=[p[0],p[1]]; }
for (const R of RESIDENTS) R.home = PLACES[R.id] || null;
/* Portal Station (v1.7): a stone entrance with stairs down to an underground hall of portals, one to each friend's island.
   Every island gets one near the plaza, picked the same way every time (so a visitor's game finds the same spot). */
const PORT_FOOT=2.6;
function findPortalSpot(){
  const r=mulberry32((S.seed|0)+7171), tw=S.magic.at || LAY.places.tower;
  for (let k=0;k<2500;k++){ const a=r()*TAU, d=(9+r()*16)*Math.min(SC,1.2)+k*0.01, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if (Math.hypot(x,z)/islandR(a)>0.66 || polyDist(x,z,RIVER)<8 || Math.hypot(x-POND.x,z-POND.z)<POND.r+7 || nearFall(x,z,5)) continue;
    if (x>DOCK.x0-12 && Math.abs(z-DOCK.z)<10) continue;
    if (Math.abs(x-LOT0.x)<BUILD.LW*BUILD.EC/2+6 && z>LOT0.z-BUILD.LD*BUILD.EC/2-6 && z<LOT0.z+BUILD.LD*BUILD.EC/2+8) continue;
    if (Object.entries(PLACES).some(([kk,p])=>kk!=='board' && Math.hypot(x-p[0],z-p[1]) < (kk==='plaza'?8:kk==='museum'?9.5:kk==='hall'?HALL_FOOT+3.5:6.5)+PORT_FOOT)) continue;
    if (tw && Math.hypot(x-tw[0],z-tw[1])<PORT_FOOT+7) continue;
    let lo=99, hi=-99, bad=false; for (let i=0;i<=10;i++){ const aa=i/10*TAU, rr=i===10?0:PORT_FOOT+0.6, h=baseHeight(x+Math.cos(aa)*rr, z+Math.sin(aa)*rr); if (h<0.6){ bad=true; break; } lo=Math.min(lo,h); hi=Math.max(hi,h); }
    if (bad || hi-lo>0.9 || baseHeight(x,z+PORT_FOOT+2.5)<0.6) continue;
    return [+x.toFixed(1), +z.toFixed(1)]; }
  return null; }
if (TRIP){}   // no Portal Station on a trip island
else if (Array.isArray(S.portalAt)) PLACES.portal=S.portalAt.slice();
else { const p=findPortalSpot(); if (p){ PLACES.portal=p; if (!VISIT) S.portalAt=p; } }
const MOVED = Object.keys(S.terra.moved||{}).length>0;
const ALTERED = MOVED || TERRA_ANY || FALLS.length>0 || !!PLACES.tower || !!PLACES.portal || !!LAY.gen;   // trees and rocks then also skip spots that changed
const door = (k,off=3.2) => [PLACES[k][0], PLACES[k][1]+off];
const door0 = (k,off=3.2) => [PLACES0[k][0], PLACES0[k][1]+off];
const doorOff = k => k==='portal'?2.9 : k==='museum'?6.2 : k==='aquarium'||k==='garden'?4.4 : k==='tower'?3.6 : k==='hall'?4.2 : 3.2;
const bA=BRIDGES[0], bB=BRIDGES[1];
const bEnd = (b,s) => [b.x+b.ux*s*(b.len/2+0.6), b.z+b.uz*s*(b.len/2+0.6)];
// The original island layout. Trees and rocks were placed around these, so they stay the reference for placing them
// (that keeps every saved tree in the same spot). The paths you actually see are PATHS below.
const PATHS_V4 = LAYOUT_ID!=='classic' ? [] : [
  [[0,0],[11,-3]], [[0,0],[-4,-1]], [[0,0],[-6,6],door0('home')], [[0,0],[14,3],[DOCK.x0-1,DOCK.z]],
  [[0,0],[10,8],door0('pippa')], [[0,0],[2,14],door0('lumi')], [[0,0],[-16,4],door0('bramble')], [[0,0],[20,-2],door0('otis')],
  [[0,0],[8,-14],door0('clover')],
  [[0,0],[0,-14],bEnd(bA,1)], [bEnd(bA,-1),[-7,-36],door0('mabel')], [bEnd(bA,-1),[-18,-36],door0('juniper')],
  [[-16,4],[-18,-4],bEnd(bB,1)],
];
const PATHS_NEW = LAYOUT_ID!=='classic' ? [] : [
  [[0,0],[1.5,-8],[3,-12.6]],                          // museum
  [[1.5,-8],[-5.5,-12],[-5.5,-20],bEnd(bA,1)],         // south bridge (goes around the museum)
  [[1.5,-8],[11,-10],[13,-20],door0('clover')],
  [[11,-10],[20,-11.4]],                               // aquarium shop
  [[-8.5,2.2],[-12,-1.8]],                             // bug & bloom
];
// Preset layouts: paths are generated from the plaza to every door (around buildings whose door faces away).
function genPaths(P){
  const out=[];
  const to=(k,off)=>{ const [x,z]=P[k], d=[x, z+(off||3.2)];
    if (z+1.5 < 0 || Math.abs(x) > Math.abs(z)+4) { out.push([[0,0],[x*0.55, Math.min(0, z)*0.55 + d[1]*0.45], d]); return; }
    const s = x>=0 ? 1 : -1; out.push([[0,0],[x+s*6.5, z+0.5],[x+s*4, d[1]+1.8],[x,d[1]]]); };
  for (const k of Object.keys(P)) if (k!=='plaza' && k!=='board') to(k, doorOff(k));
  out.push([[0,0],[-3.5,-3]]);
  out.push([[0,0],[14,3],[DOCK.x0-1,DOCK.z]]);
  out.push([[0,0],[-7,-8],[-8,-14],bEnd(bA,1)]);
  out.push([[-6,2],[-16,-6],[-18,-9],bEnd(bB,1)]);
  return out;
}
// Generated islands (and moved buildings): every door gets a path from the plaza, crossing the river on a bridge when needed.
function crossesWater(a, b){ const L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.max(2,Math.ceil(L/1.2));
  for(let s=1;s<n;s++){ const x=a[0]+(b[0]-a[0])*s/n, z=a[1]+(b[1]-a[1])*s/n; if (polyDist(x,z,RIVER)<3.8 && Math.hypot(x,z)<islandR(Math.atan2(z,x))) return true; if (Math.hypot(x-POND.x,z-POND.z)<POND.r+0.8) return true; } return false; }
function routeTo(from, to){
  if (!crossesWater(from,to)) return [from,to];
  let best=null, bc=1e9;
  for (const b of BRIDGES) for (const s of [1,-1]){ const e1=bEnd(b,s), e2=bEnd(b,-s); if (crossesWater(from,e1) || crossesWater(e2,to)) continue; const c=Math.hypot(e1[0]-from[0],e1[1]-from[1])+Math.hypot(to[0]-e2[0],to[1]-e2[1]); if (c<bc){ bc=c; best=[from,e1,e2,to]; } }
  return best || [from,to];
}
// A connected network (minimum spanning tree) from the plaza to every door, the dock and the bridges, so paths share
// trunks instead of each door getting its own line from the plaza. Paths avoid water except on bridges, and avoid other buildings.
function genPathsRouted(P){
  const nodes=[{ p:[0,0] }], leaves=[];
  for (const k of Object.keys(P)){ if (k==='plaza' || k==='board') continue; const d=door(k, doorOff(k)); const pre=[d[0], d[1]+1.6]; nodes.push({ p:pre, k }); leaves.push([pre, d]); }
  nodes.push({ p:[DOCK.x0-1, DOCK.z] });
  const bridgeOf=new Map(); for (const b of BRIDGES){ const i=nodes.length; nodes.push({ p:bEnd(b,1) }, { p:bEnd(b,-1) }); bridgeOf.set(i, i+1); bridgeOf.set(i+1, i); }
  const fp = P===PLACES ? PLACES : P;
  const cost=(i,j)=>{ if (bridgeOf.get(i)===j) return 0.01; const a=nodes[i].p, b=nodes[j].p; if (crossesWater(a,b)) return Infinity;
    let c=Math.hypot(b[0]-a[0],b[1]-a[1]); const L=c, n=Math.max(2,Math.ceil(L/1.5));
    for (let s=1;s<n;s++){ const x=a[0]+(b[0]-a[0])*s/n, z=a[1]+(b[1]-a[1])*s/n; for (const k in fp){ if (k==='plaza'||k==='board'||k===nodes[i].k||k===nodes[j].k) continue; const q=fp[k]; if (Math.hypot(x-q[0],z-q[1])<(k==='museum'?6.5:4)){ c+=6; break; } } }
    return c; };
  const N=nodes.length, inT=new Array(N).fill(false), best=new Array(N).fill(Infinity), par=new Array(N).fill(-1); best[0]=0; const out=[];
  for (let it=0; it<N; it++){ let u=-1; for (let v=0;v<N;v++) if(!inT[v] && (u<0 || best[v]<best[u])) u=v; if (u<0) break;
    if (best[u]===Infinity){ let bj=-1, bd=1e9; for (let v=0;v<N;v++) if (inT[v]){ const d=Math.hypot(nodes[u].p[0]-nodes[v].p[0], nodes[u].p[1]-nodes[v].p[1]); if (d<bd){ bd=d; bj=v; } } par[u]=bj; }   // cut off by water: connect anyway
    inT[u]=true; if (par[u]>=0 && bridgeOf.get(u)!==par[u]) out.push([nodes[par[u]].p, nodes[u].p]);
    for (let v=0;v<N;v++){ if (inT[v]) continue; const c=cost(u,v); if (c<best[v]){ best[v]=c; par[v]=u; } } }
  out.push(...leaves, [[0,0],[-3.5,-3]]);
  return out;
}
/* v1.0 paths: the network is laid out on a 1.25 m grid that knows where every building stands, so paths go around
   houses instead of straight through them. Each door connects to the network (a minimum spanning tree, so paths share
   trunks), water is crossed only on bridges, and a path keeps a little distance from walls.
   This only changes the paths you see. Trees and rocks are still placed around the original paths (PATHS_V4), so every
   saved tree keeps its key; trees that would now stand on a path just don't grow. */
const BLOCK_R = k => k==='portal'?2.4 : k==='museum'?6.4 : k==='home'?0 : k==='aquarium'||k==='garden'?4.0 : k==='shop'?3.4 : k==='tower'?3.0 : k==='hall'?HALL_FOOT-0.4 : 2.9;
function genPathsGrid(P, only){
  const ST=1.25, R0=Math.ceil(66*SC), n=Math.ceil(R0*2/ST), N=n*n, X=i=>-R0+(i+0.5)*ST;
  const blk=new Uint8Array(N), near=new Float32Array(N);
  const lr=[LOT.x-BUILD.LW*BUILD.EC/2-0.8, LOT.z-BUILD.LD*BUILD.EC/2-0.8, LOT.x+BUILD.LW*BUILD.EC/2+0.8, LOT.z+BUILD.LD*BUILD.EC/2+0.6];
  const bl=Object.entries(P).filter(([k])=>k!=='plaza'&&k!=='board'&&k!=='home').map(([k,p])=>[p[0], p[1]+(k==='museum'?1:0), BLOCK_R(k)]);
  for (let j=0;j<n;j++) for (let i=0;i<n;i++){ const x=X(i), z=X(j), c=j*n+i;
    if (onBridge(x,z) || onDock(x,z)) continue;
    const t=Math.hypot(x,z)/islandR(Math.atan2(z,x)); if (t>0.95 || baseHeight(x,z)<0.3){ blk[c]=1; continue; }
    if ((polyDist(x,z,RIVER)<3.8 && t<1) || Math.hypot(x-POND.x,z-POND.z)<POND.r+1.2 || (FALLS.length && nearFall(x,z,-4))){ blk[c]=1; continue; }
    if (x>lr[0]&&x<lr[2]&&z>lr[1]&&z<lr[3]){ blk[c]=1; continue; }
    let m=9; for (const [bx,bz,br] of bl){ const d=Math.hypot(x-bx,z-bz)-br; if (d<m) m=d; } if (m<0){ blk[c]=1; continue; } near[c]=m;
    const dl=Math.hypot(Math.max(lr[0]-x,0,x-lr[2]), Math.max(lr[1]-z,0,z-lr[3])); if (dl<near[c]) near[c]=dl; }
  const cellOf=p=>{ const i=clamp(Math.floor((p[0]+R0)/ST),0,n-1), j=clamp(Math.floor((p[1]+R0)/ST),0,n-1); return j*n+i; };
  const nodes=[[0,0]], leaves=[];
  for (const k of Object.keys(P)){ if (k==='plaza'||k==='board'||(only&&!only.includes(k))) continue; const d=[P[k][0], P[k][1]+doorOff(k)], pre=[d[0], d[1]+1.6]; nodes.push(pre); leaves.push([pre,d]); }
  if (!only) nodes.push([DOCK.x0-1, DOCK.z]);
  for (const p of nodes){ const c=cellOf(p); blk[c]=0; near[c]=9; }   // every node is reachable from its own cell
  const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  const stepCost=c=>1+(near[c]<1.6?(1.6-near[c])*2.2:0);
  const dijkstra=src=>{ const g=new Float64Array(N).fill(Infinity), from=new Int32Array(N).fill(-1), heap=[[0,src]]; g[src]=0;
    const push=(k,f)=>{ heap.push([f,k]); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
    const pop=()=>{ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let i=0; for(;;){ const l=i*2+1, r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
    while (heap.length){ const [f,c]=pop(); if (f>g[c]) continue; const i=c%n, j=(c-i)/n;
      for (const [di,dj,w] of NB){ const ni=i+di, nj=j+dj; if (ni<0||nj<0||ni>=n||nj>=n) continue; const nc=nj*n+ni; if (blk[nc]) continue; if (di&&dj&&(blk[j*n+ni]||blk[nj*n+i])) continue;
        const ng=f+w*stepCost(nc); if (ng<g[nc]){ g[nc]=ng; from[nc]=c; push(nc,ng); } } }
    return { g, from }; };
  const cells=nodes.map(cellOf), runs=cells.map(c=>dijkstra(c));
  // minimum spanning tree over the nodes, using real walking distances around buildings and water
  const M=nodes.length, inT=new Array(M).fill(false), best=new Array(M).fill(Infinity), par=new Array(M).fill(-1); best[0]=0; const out=[];
  const los=(a,b)=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]), k=Math.max(1,Math.ceil(L/0.5)); for (let s=0;s<=k;s++){ const x=a[0]+(b[0]-a[0])*s/k, z=a[1]+(b[1]-a[1])*s/k, c=cellOf([x,z]); if (blk[c] || near[c]<1.1) return false; } return true; };
  for (let it=0; it<M; it++){ let u=-1; for (let v=0;v<M;v++) if (!inT[v] && (u<0||best[v]<best[u])) u=v; if (u<0) break; inT[u]=true;
    if (par[u]>=0){ const pr=par[u]; let pts=[];
      if (isFinite(runs[pr].g[cells[u]])){ for (let c=cells[u]; c>=0; c=runs[pr].from[c]){ const i=c%n, j=(c-i)/n; pts.push([X(i),X(j)]); if (c===cells[pr]) break; } pts[0]=nodes[u]; pts[pts.length-1]=nodes[pr]; }
      else pts=[nodes[u], nodes[pr]];   // cut off by water: connect anyway
      const simp=[pts[0]]; let a=0; while (a<pts.length-1){ let b=pts.length-1; while (b>a+1 && !los(pts[a],pts[b])) b--; simp.push(pts[b]); a=b; }
      out.push(simp.map(q=>[+q[0].toFixed(2), +q[1].toFixed(2)])); }
    for (let v=0;v<M;v++){ if (inT[v]) continue; const c=runs[u].g[cells[v]]; if (c<best[v]){ best[v]=c; par[v]=u; } } }
  out.push(...leaves); if (!only) out.push([[0,0],[-3.5,-3]]);
  return out;
}
let PATHS;
if (LAYOUT_ID==='classic' && !MOVED){ PATHS = [...PATHS_V4.filter((p,i)=>i!==8 && i!==9), ...PATHS_NEW]; const add=['tower','hall','portal',...RESIDENTS.filter(R=>!isOrig(R.id)).map(R=>R.id)].filter(k=>PLACES[k]); if (add.length) PATHS.push(...genPathsGrid(PLACES, add)); }
else if (TRIP) PATHS = [];   // trip islands have no town, so no paths
else PATHS = genPathsGrid(PLACES);
const REROUTED = LAYOUT_ID!=='classic' || MOVED;   // the paths you see differ from the ones trees were placed around
if (LAYOUT_ID!=='classic' && !TRIP) PATHS_V4.push(...(LAYOUT_ID==='gen' ? genPathsRouted(PLACES0) : genPaths(PLACES0)));
let layoutPhase=true;   // true while the original trees and rocks are being placed
const pathDist = (x,z) => { let m=1e9; for(const p of (layoutPhase?PATHS_V4:PATHS)) m=Math.min(m, polyDist(x,z,p)); return m; };
const newPathDist = (x,z) => { let m=1e9; for(const p of PATHS_NEW) m=Math.min(m, polyDist(x,z,p)); return m; };

{ const { LW:GW, LD:GD, EC }=BUILD, lot=[LOT.x-GW*EC/2, LOT.z-GD*EC/2, LOT.x+GW*EC/2, LOT.z+GD*EC/2+2.2];
  const n=HG.n, h=new Float32Array(n*n);
  const lotDist=(x,z)=>Math.hypot(Math.max(lot[0]-x,0,x-lot[2]), Math.max(lot[1]-z,0,z-lot[3]));
  // where terrain may change at all: inland, away from the river, pond and coast
  const natMask=(x,z)=>{ const a=Math.atan2(z,x), t=Math.hypot(x,z)/islandR(a); let m=smooth(0.86,0.72,t);
    if (LAY.cliff){ const c=cliffC(a); m=lerp(m, smooth(0.995,0.97,t), smooth(-0.15,-0.6,c)); m=lerp(m, smooth(0.78,0.66,t), smooth(0.15,0.6,c)); }
    if(m<=0) return 0; return m*smooth(5,10,polyDist(x,z,RIVER))*smooth(8,13,Math.hypot(x-POND.x,z-POND.z)); };
  const pathNear=(x,z)=>{ let m=1e9; for(const p of PATHS){ m=Math.min(m, polyDist(x,z,p)); if(m<1.8) break; } return m; };
  {
    const { step, off, riser }=TIER, B=LAY.bluff, CL=LAY.cliff, amp=LAY.liftAmp??1.2;
    // cliffs islands: a high bluff with a sheer edge, except at ramps and where paths go up
    let bluffWall=false;
    const bluffLift=(x,z)=>{ bluffWall=false; const d=bluffD(B,x,z)+(fbm(x*0.05+40,z*0.05+11)-0.5)*8; if (d<-12 || d>12) return d>0?B.h:0;
      let rw=0; for(const q of B.ramps) rw=Math.max(rw, smooth(9,4,Math.hypot(x-q[0],z-q[1]))); if (rw<1) rw=Math.max(rw, smooth(3.6,1.6,pathNear(x,z)));
      const w=lerp(0.7, 11, rw); bluffWall = w<3 && Math.abs(d)<w/2+0.45; return B.h*smooth(-w/2, w/2, d); };
    const lift=(x,z)=>{ let v=amp*smooth(0.35,0.8,fbm(x*0.022+5,z*0.022+9)) + (CL && CL.lift ? CL.lift*smooth(CL.d0,CL.d1,x*Math.cos(CL.a)+z*Math.sin(CL.a)) : 0) + (B ? bluffLift(x,z) : 0);
      const wx=x+(fbm(x*0.06+21,z*0.06+3)-0.5)*10, wz=z+(fbm(x*0.06-7,z*0.06+17)-0.5)*10;   // warped so terraces have natural, wobbly outlines
      for(const [cx,cz,A,R] of MOUNDS){ const d=Math.hypot(wx-cx,wz-cz)/R; if(d<1) v+=A*(0.5+0.5*Math.cos(Math.PI*d)); } return v; };
    const cont=(x,z)=>baseHeight(x,z)+lift(x,z)*natMask(x,z);
    const quant=(v,r=riser)=>{ if(v<=off) return v; const q=(v-off)/step, k=Math.floor(q), f=q-k; return off+step*(k+smooth(1-r,1,f)); };
    const flatOf=v=>{ if(v<=off) return v; const k=Math.floor((v-off)/step); return off+step*(k+(1-riser)/2); };   // middle of the terrace v sits on
    // every building gets its own flat terrace
    const pads=Object.entries(PLACES).map(([k,p])=>{ const cx=p[0], cz=p[1]+(k==='museum'?3:1); return [cx,cz,k==='plaza'?7:5.5,flatOf(cont(cx,cz))]; });
    const lc=[(lot[0]+lot[2])/2,(lot[1]+lot[3])/2], lotV=flatOf(cont(lc[0],lc[1]));
    for(let j=0;j<n;j++) for(let i=0;i<n;i++){ const x=HG.x0+i*HG.step, z=HG.z0+j*HG.step;
      const nm=natMask(x,z); let pw=0;
      for(const [px,pz,r] of pads){ const d=Math.hypot(x-px,z-pz); if(d<r+5) pw=Math.max(pw,smooth(r+5,r,d)); }
      const ld=lotDist(x,z); if(ld<5) pw=Math.max(pw,smooth(5,1.2,ld));
      const ed=terraDelta(x,z), wt=terraWet(x,z), lm=terraLand(x,z);
      if(nm<=0 && pw<=0 && !ed && !wt && !lm && !(TERRA_ANY && (terraLand(x+1.7,z)||terraLand(x-1.7,z)||terraLand(x,z+1.7)||terraLand(x,z-1.7)))) continue;
      const b=baseHeight(x,z); let v=b+lift(x,z)*nm; if (B && bluffWall && nm>0.5) (HG.wall||(HG.wall=new Uint8Array(n*n)))[j*n+i]=1;
      for(const [px,pz,r,pv] of pads){ const d=Math.hypot(x-px,z-pz); if(d<r+5) v=lerp(v,pv,smooth(r+5,r,d)); }
      if(ld<5) v=lerp(v,lotV,smooth(5,1.2,ld));
      if (ed){ const v0=v; v+=ed*step; if (ed<0) v=Math.max(v, Math.min(v0, off+0.12)); }   // wizard edits; lowering never digs below the lowest terrace
      const f=quant(v);   // paths simply step up and down with the terraces (edges are low enough to walk over)
      let fin=lerp(b,f,Math.max(smooth(0,0.35,nm),pw,ed?1:0));
      if (lm>0 || terraLand(x+1.7,z)||terraLand(x-1.7,z)||terraLand(x,z+1.7)||terraLand(x,z-1.7)){   // new land from the sea, with a soft sandy shore
        const ls=(lm*2+terraLand(x+1.7,z)+terraLand(x-1.7,z)+terraLand(x,z+1.7)+terraLand(x,z-1.7))/6, top=quant(Math.max(off+0.06, off+0.06+ed*step));
        const tgt = lerp(0.3, top, smooth(0.5,0.85,ls)); fin=lerp(fin, Math.max(fin,tgt), smooth(0.0,0.5,ls)); }
      if (wt) fin=lerp(fin,-1.25,smooth(0,0.6,wt));   // dug ponds and rivers
      h[j*n+i]=fin-b; }
    // waterfalls: a plateau with a sheer front, a pool on top, terraced steps up the back and sides
    for (const F of FALLS){
      const I=(x)=>Math.round((x-HG.x0)/HG.step), r0=F.Rp+7, i0=Math.max(0,I(F.cx-r0)), i1=Math.min(n-1,I(F.cx+r0)), j0=Math.max(0,I(F.cz-r0)), j1=Math.min(n-1,I(F.cz+r0));
      let mx=-9; for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const x=HG.x0+i*HG.step, z=HG.z0+j*HG.step; if(Math.hypot(x-F.cx,z-F.cz)<F.Rp) mx=Math.max(mx, baseHeight(x,z)+h[j*n+i]); }
      F.top=Math.max(F.top, mx+0.35);
      for(let j=j0;j<=j1;j++) for(let i=i0;i<=i1;i++){ const x=HG.x0+i*HG.step, z=HG.z0+j*HG.step, d=Math.hypot(x-F.cx,z-F.cz); if(d>=r0) continue;
        if (Math.hypot(x,z)/islandR(Math.atan2(z,x))>0.9 || pads.some(([px,pz,r])=>Math.hypot(x-px,z-pz)<r+1.5)) continue;   // never over the sea or a building
        const [u,v]=fallLocal(F,x,z), b=baseHeight(x,z), cur=b+h[j*n+i]; let s=-9;
        if (d<F.Rp){ if (u>=1.4) s=F.top; else if (u>0.9) s=lerp(-1.3, F.top, (u-0.9)/0.5); }
        else { const k=(d-F.Rp)/7; s=quant(F.top*(1-k)+off*k*0.5, 0.35); if (u<1.4 && Math.abs(v)<F.Rp+1) s=Math.min(s, lerp(-1.3, s, smooth(0.9,1.4,u))); }
        let fin=Math.max(cur, s);
        if (((u-4)/2.7)**2+(v/2.1)**2<1) fin=F.top-0.65;   // the pool
        h[j*n+i]=fin-b; } }
  }
  if (TERRAIN_STYLE!=='flat'){
    const sl=new Float32Array(n*n);
    const H=(i,j)=>baseHeight(HG.x0+i*HG.step, HG.z0+j*HG.step)+h[j*n+i];
    for(let j=1;j<n-1;j++) for(let i=1;i<n-1;i++){ if(!h[j*n+i]&&!h[j*n+i+1]&&!h[j*n+i-1]&&!h[(j+1)*n+i]&&!h[(j-1)*n+i]) continue; sl[j*n+i]=Math.hypot(H(i+1,j)-H(i-1,j), H(i,j+1)-H(i,j-1))/(2*HG.step); }
    HG.h=h; HG.s=sl;
  }
}
function visPathDistH(x,z){ let m=1e9; for(const p of PATHS) m=Math.min(m, polyDist(x,z,p)); return m; }

/* ---------- Terrain (smooth, vertex colored) ---------- */
const PAL = PALETTE[World.season];
const visPathDist = (x,z) => { let m=1e9; for(const p of PATHS) m=Math.min(m, polyDist(x,z,p)); return m; };
const CLIFF_ROCK=new THREE.Color(0x9a8a74), TIER_EDGE=new THREE.Color(0x6f8c3c), SAND=new THREE.Color(0xf3dca6), WETSAND=new THREE.Color(0xd9be86), DIRT=new THREE.Color(0xc9a06a), SEABED=new THREE.Color(0x6fc8c0), DEEP=new THREE.Color(0x2f7f9a), RIVERBED=new THREE.Color(0x8ab89a);
// Painted ground: a tiling brush-stroke texture sampled in world space at two scales, strongest on grass
function groundTex(){ const cv=document.createElement('canvas'); cv.width=cv.height=512; const x=cv.getContext('2d'), W=512, r=mulberry32(5);
  x.fillStyle='rgb(128,128,128)'; x.fillRect(0,0,W,W);
  const wrap=f=>{ for (const dx of [-W,0,W]) for (const dy of [-W,0,W]){ x.save(); x.translate(dx,dy); f(); x.restore(); } };
  for (let i=0;i<46;i++){ const px=r()*W, py=r()*W, rad=40+r()*90, g=128+(r()-0.5)*120;           // G: soft warm/cool clumps
    wrap(()=>{ const gr=x.createRadialGradient(px,py,0,px,py,rad); gr.addColorStop(0,`rgba(128,${g|0},128,0.55)`); gr.addColorStop(1,'rgba(128,128,128,0)'); x.globalCompositeOperation='source-over'; x.fillStyle=gr; x.fillRect(px-rad,py-rad,rad*2,rad*2); }); }
  x.lineCap='round';
  for (let i=0;i<2600;i++){ const px=r()*W, py=r()*W, a=-Math.PI/2+(r()-0.5)*1.4, l=5+r()*12, v=r();         // R: short grass strokes, light and dark
    const R=v<0.5? 70+v*80 : 140+(v-0.5)*200; x.strokeStyle=`rgba(${R|0},128,128,${0.35+r()*0.4})`; x.lineWidth=1.5+r()*2.5;
    wrap(()=>{ x.beginPath(); x.moveTo(px,py); x.quadraticCurveTo(px+Math.cos(a)*l*0.5+2,py+Math.sin(a)*l*0.5,px+Math.cos(a)*l,py+Math.sin(a)*l); x.stroke(); }); }
  for (let i=0;i<500;i++){ const px=r()*W, py=r()*W, s2=1+r()*2.5;                                       // B: grit and speckle for sand and dirt
    x.fillStyle=`rgba(128,128,${r()<0.5?40:230},0.5)`; wrap(()=>{ x.beginPath(); x.arc(px,py,s2,0,TAU); x.fill(); }); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=renderer.capabilities.getMaxAnisotropy?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4; return t; }
let _terrainMat=null;
function terrainMat(){ if (_terrainMat) return _terrainMat;
  const m=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95 }); const tex=groundTex();
  m.userData.patch=sh=>{ sh.uniforms.uGround={ value:tex };
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float grassy; varying float vGrassy; varying vec3 vGW;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvGrassy=grassy; vGW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D uGround; varying float vGrassy; varying vec3 vGW;')
      .replace('#include <color_fragment>',`#include <color_fragment>
      { vec4 a=texture2D(uGround, vGW.xz*0.23); vec4 b=texture2D(uGround, vGW.xz*0.055+vec2(0.37,0.11)); float gr=clamp(vGrassy,0.0,1.0);
        vec4 f=texture2D(uGround, vGW.xz*0.85+vec2(0.19,0.53));   // fine blades up close
        float strokes=(a.r-0.5)*0.7*gr + (b.r-0.5)*0.22 + (f.r-0.5)*0.55*gr;
        float warm=(b.g-0.5)*1.6*gr;
        diffuseColor.rgb *= 1.0 + strokes;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.1,1.05,0.78), clamp(warm,0.0,1.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.86,0.97,1.08), clamp(-warm,0.0,1.0));
        diffuseColor.rgb *= 1.0 + (a.b-0.5)*0.16*(1.0-gr); }`); };
  m.onBeforeCompile=m.userData.patch; m.customProgramCacheKey=()=>'ground2'; return _terrainMat=m; }
function buildTerrain(){
  const SZ=132*SC, N=SC>1 ? (isMobile?320:400) : (isMobile?245:290);
  const g = new THREE.PlaneGeometry(SZ, SZ, N, N); g.rotateX(-Math.PI/2);
  const pos=g.attributes.position, cols=new Float32Array(pos.count*3), gw=new Float32Array(pos.count), c=new THREE.Color();
  const grass = PAL.grass.map(h=>new THREE.Color(h));
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), y=rawHeight(x,z); pos.setY(i,y);
    const inland = polyDist(x,z,RIVER)<4.5 || Math.hypot(x-POND.x,z-POND.z)<7.5 || (TERRA_ANY && terraWet(x,z)>0) || (FALLS.length && nearFall(x,z,-6));
    if (y < 0) { if (inland) c.copy(RIVERBED).lerp(DEEP, smooth(-0.2,-1.3,y)*0.5); else { c.copy(SEABED).lerp(DEEP, smooth(-0.1,-2.2,y)); c.lerp(SAND, smooth(-0.6,0,y)*0.6); } }
    else if (y < 0.18) c.copy(inland?new THREE.Color(0x9a8a6a):WETSAND);
    else if (y < SAND_H && !inland) c.copy(SAND).offsetHSL(0,0,(vnoise(x*1.3,z*1.3)-0.5)*0.04);
    else {
      const n=fbm(x*0.08,z*0.08); c.copy(grass[0]).lerp(grass[1], n).lerp(grass[2], smooth(0.55,0.85,vnoise(x*0.2,z*0.2))*0.7);
      c.offsetHSL(0,0,(vnoise(x*2.2,z*2.2)-0.5)*0.05);
      const pd=visPathDist(x,z); if (pd<1.4) c.lerp(DIRT, smooth(1.4,0.6,pd)*(World.season==='winter'?0.35:0.7));
      gw[i]=(1-smooth(1.4,0.6,pd)*0.8)*(inland?1:smooth(SAND_H, SAND_H+0.3, y));
      { const w=vnoise(x*0.045+7,z*0.045-3); c.offsetHSL((w-0.5)*0.035, (w-0.5)*0.12, (vnoise(x*0.6,z*0.6)-0.5)*0.05); }   // broad warm/cool meadow patches
      if (!inland) c.lerp(SAND, smooth(SAND_H+0.2, SAND_H, y)); else if (y<SAND_H) c.lerp(new THREE.Color(0x9a8a6a), smooth(SAND_H,0.2,y));
      if (HG.h && TERRAIN_STYLE==='tiers'){ const sl=hillSample(HG.s,x,z); if (sl>0.18 && pd>1.4) c.lerp(TIER_EDGE, smooth(0.18,0.6,sl)*0.75);
        if (sl>1.5 || onWall(x,z)) c.lerp(CLIFF_ROCK, Math.max(smooth(1.5,2.6,sl), onWall(x,z)?0.85:0)*0.9).offsetHSL(0,0,(vnoise(x*1.7,z*1.7)-0.5)*0.06); }   // sheer faces show bare rock
    }
    cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols,3)); g.setAttribute('grassy', new THREE.BufferAttribute(gw,1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, terrainMat()); m.receiveShadow = true; return m;
}
const terrain = buildTerrain(); OUT.add(terrain);

/* Ground picking by marching along the camera ray (cheap and exact enough) */
function rayGround(ray){
  const o=ray.origin, d=ray.direction; if (d.y>=-0.01) return null;
  let tPrev=0, t=0;
  for (let i=0;i<400;i++){ t += 0.35; const x=o.x+d.x*t, y=o.y+d.y*t, z=o.z+d.z*t; const gy = World.inside ? 0 : groundY(x,z);
    if (y <= gy){ let a=tPrev, b=t; for(let k=0;k<10;k++){ const m=(a+b)/2; const mx=o.x+d.x*m, my=o.y+d.y*m, mz=o.z+d.z*m; if (my <= (World.inside?0:groundY(mx,mz))) b=m; else a=m; } return new THREE.Vector3(o.x+d.x*b, o.y+d.y*b, o.z+d.z*b); }
    tPrev=t; }
  return null;
}

/* ---------- Water ---------- */
const waterGeo = new THREE.PlaneGeometry(320, 320, 110, 110); waterGeo.rotateX(-Math.PI/2);
const waterBase = waterGeo.attributes.position.array.slice();
const waterMat = new THREE.MeshStandardMaterial({ color:0x4cc3d6, transparent:true, opacity:0.78, roughness:0.32, metalness:0.05 });
const poolWaterMat = waterMat.clone();   // waterfall pools keep the plain look (made before the shader below is attached)
/* The water's look is painted in its shader, on top of the normal lit material (so sun, shadows and fog still apply):
   - color and see-through amount follow the depth (clear turquoise over sand, deeper blue offshore), read from a
     small depth map baked from the terrain when the island loads
   - soft moving light patterns in the shallows, drifting glints offshore, and small ripples that catch the sun
   - a foam line that laps at every shore, pond and riverbank
   - the fish shadows. They used to be separate see-through meshes just under the surface; see-through objects are
     drawn in order of distance to each object's center, and the water's center is the middle of the map, so the
     water usually drew first and hid them (and otherwise covered them 78%). Drawing them in the water itself
     means they always show. */
const WATER_FISH_MAX = 12, WATER_D_RES = 256, WATER_D_MAX = 2.5;
const waterDepthTex = (()=>{ const N=WATER_D_RES, d=new Uint8Array(N*N);
  for (let j=0;j<N;j++) for (let i=0;i<N;i++){ const x=(i+0.5)/N*320-160, z=(j+0.5)/N*320-160; d[j*N+i]=clamp(Math.round((-0.02-rawHeight(x,z))/WATER_D_MAX*255),0,255); }
  const t=new THREE.DataTexture(d,N,N,THREE.RedFormat,THREE.UnsignedByteType); t.magFilter=t.minFilter=THREE.LinearFilter; t.needsUpdate=true; return t; })();
const WU = { uTime:{ value:0 }, uDepth:{ value:waterDepthTex }, uShallow:{ value:new THREE.Color(0x5edbd0) }, uDeep:{ value:new THREE.Color(0x2b92c4) },
  uFish:{ value:Array.from({ length:WATER_FISH_MAX }, ()=>new THREE.Vector4()) }, uFishCol:{ value:new THREE.Color(0x10283a) }, uFishA:{ value:0.7 },
  uSpark:{ value:1 }, uFoamA:{ value:0.8 }, uTint:{ value:new THREE.Vector3(1,1,1) } };
const WATER_BASE = new THREE.Color(0x4cc3d6);   // the material's daytime color; updateSky tints it and the shader follows by this ratio
waterMat.onBeforeCompile = sh => {
  Object.assign(sh.uniforms, WU);
  sh.vertexShader = 'varying vec3 vWPos;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = `varying vec3 vWPos;
uniform float uTime, uFishA, uSpark, uFoamA; uniform sampler2D uDepth; uniform vec3 uShallow, uDeep, uFishCol, uTint; uniform vec4 uFish[${WATER_FISH_MAX}];
float wHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(wHash(i), wHash(i+vec2(1,0)), f.x), mix(wHash(i+vec2(0,1)), wHash(i+vec2(1,1)), f.x), f.y); }
// soft caustic net: two layers of warped cell edges drifting against each other
float wCaust(vec2 p, float t){ float c=0.0;
  for (int k=0;k<2;k++){ vec2 q = p*(1.0+float(k)*0.7) + vec2(t*0.11, -t*0.08)*(k==0?1.0:-1.3);
    q += vec2(wNoise(q*0.9+t*0.2), wNoise(q*0.9-t*0.17+3.1))*1.4;
    float v = sin(q.x*2.3)*sin(q.y*2.3); c += 1.0 - smoothstep(0.0, 0.18, abs(v)); }
  return c*0.5; }
float wFishShape(vec2 d, vec4 f){ // d: offset from the fish, f: x, z, heading, size
  float s=max(f.w, 0.001); vec2 h=vec2(cos(f.z), sin(f.z)); vec2 q=vec2(dot(d,h), dot(d, vec2(-h.y, h.x)))/s;
  q.y += sin(q.x*3.2 - uTime*7.0 + f.x) * 0.07 * clamp(0.6 - q.x, 0.0, 1.6);   // the tail sways
  float wdt = 0.36 * (1.0 - 0.45*smoothstep(0.2, -0.8, q.x));   // rounder at the head, narrowing toward the tail
  float body = 1.0 - smoothstep(0.6, 1.0, length(vec2(q.x/0.82, q.y/wdt)));
  float tx = -0.66 - q.x;                                          // a fan-shaped tail fin joined to the body
  float tail = (1.0 - smoothstep(-0.04, 0.06, abs(q.y) - (0.06 + tx*0.75))) * smoothstep(-0.06, 0.04, tx) * (1.0 - smoothstep(0.3, 0.42, tx));
  return max(body, tail*0.9); }
float wD, wFoam, wFish, wGlint; vec2 wN;
` + sh.fragmentShader
    .replace('#include <color_fragment>', `#include <color_fragment>
  { vec2 w = vWPos.xz; float t = uTime;
    wD = texture2D(uDepth, (w + 160.0)/320.0).r * ${WATER_D_MAX.toFixed(1)};
    float deep = smoothstep(0.05, 1.6, wD);
    // small ripples: the slope of two drifting noise layers bends the normal so the light moves across the water
    vec2 r1 = w*1.1 + vec2(t*0.35, t*0.22); float e=0.15, n0 = wNoise(r1);
    wN = vec2(wNoise(r1+vec2(e,0.0)) - n0, wNoise(r1+vec2(0.0,e)) - n0) * 1.1;
    vec3 col = mix(uShallow, uDeep, deep) * uTint;   // follows the day/night/weather tint set on the material
    // light patterns in the shallows
    float ca = wCaust(w*0.42 + wN*0.6, t) * (1.0 - smoothstep(0.3, 1.5, wD));
    col += vec3(0.85, 1.0, 0.95) * ca * 0.22 * uSpark;
    // darker and lighter patches offshore so open water isn't one flat color
    col *= 0.92 + 0.16*wNoise(w*0.08 + t*0.02);
    // foam: a band that laps up and back at the shore, and a thin line that rolls in behind it
    float lap = 0.24 + 0.1*sin(t*1.3 + wNoise(w*0.6)*5.0);   // shores drop off fast, so the band is set in depth, not distance
    float roll = fract(t*0.22 + wNoise(w*0.35)*0.6), ringD = mix(0.9, 0.2, roll);
    float edge = wNoise(w*3.0 + t*0.4);
    wFoam = (1.0 - smoothstep(lap - 0.03, lap + 0.01, wD - edge*0.08)) + (1.0 - smoothstep(0.0, 0.035, abs(wD - ringD) - edge*0.02)) * roll * (1.0 - roll) * 2.2;
    wFoam = clamp(wFoam, 0.0, 1.0) * step(0.001, wD) * uFoamA;
    col = mix(col, vec3(1.0), wFoam);
    // fish shadows (dark by day, a pale glow at night): slightly bent by the ripples, like they're under the surface
    wFish = 0.0; vec2 wq = w + wN*0.12;
    for (int i=0;i<${WATER_FISH_MAX};i++){ vec4 f = uFish[i]; if (f.w <= 0.0) continue; vec2 d = wq - f.xy; if (dot(d,d) > 6.0*f.w*f.w) continue; wFish = max(wFish, wFishShape(d, f)); }
    // drifting glints on open water
    float g = wNoise(w*4.5 + vec2(t*0.9, -t*0.6)) * wNoise(w*3.7 - vec2(t*0.7, t*0.8));
    wGlint = smoothstep(0.7, 0.82, g) * deep * uSpark;
    diffuseColor.rgb = col;
    diffuseColor.a = mix(0.5, 0.93, deep) + wFoam*0.4 + ca*0.1; diffuseColor.a = clamp(max(diffuseColor.a, wFoam*0.95), 0.0, 1.0); }`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  normal = normalize(normal + (viewMatrix * vec4(wN.x, 0.0, wN.y, 0.0)).xyz * (1.0 - wFoam));`)
    .replace('#include <opaque_fragment>', `outgoingLight += vec3(1.0, 0.98, 0.9) * wGlint * 0.3;
  outgoingLight = mix(outgoingLight, uFishCol, wFish * uFishA);
  diffuseColor.a = max(diffuseColor.a, wFish * uFishA);
  #include <opaque_fragment>`);
};
waterMat.customProgramCacheKey = () => 'driftwood-water-v1';
const water = new THREE.Mesh(waterGeo, waterMat); water.receiveShadow = true; OUT.add(water);
// The deep sea plane sits below the lowest sea floor. (At -1.2 it was level with the pond bed, so the two fought
// for the same pixels and the pond flickered.)
const deepSea = new THREE.Mesh(new THREE.PlaneGeometry(1200,1200), new THREE.MeshStandardMaterial({ color:0x2a8aa8, roughness:0.4 })); deepSea.rotation.x=-Math.PI/2; deepSea.position.y=-2.75; OUT.add(deepSea);
// Waves only roll on the open sea. Ponds and rivers lie still, so their big flat-shaded triangles no longer flash
// light and dark as they tilt (that was the glitchy pond lighting).
const waveAmp = new Float32Array(waterBase.length/3);
for (let i=0;i<waveAmp.length;i++){ const x=waterBase[i*3], z=waterBase[i*3+2], t=Math.hypot(x,z)/islandRadius(LAY, Math.atan2(z,x)); waveAmp[i]=smooth(0.86,1.02,t); }
function updateWater(t){ const a=waterGeo.attributes.position.array; for(let i=0,k=0;i<a.length;i+=3,k++){ const x=waterBase[i], z=waterBase[i+2], A=waveAmp[k]; a[i+1]=A>0.001 ? (Math.sin(x*0.25+t*0.9)*0.07+Math.cos(z*0.3+t*0.7)*0.06+Math.sin((x+z)*0.6+t*1.6)*0.025)*A-0.02 : -0.02; } waterGeo.attributes.position.needsUpdate=true; }

/* ---------- Waterfalls ---------- */
const fallFX=[];
const fallTex=(()=>{ const cv=document.createElement('canvas'); cv.width=64; cv.height=256; const x=cv.getContext('2d'); x.fillStyle='rgba(205,240,255,0.6)'; x.fillRect(0,0,64,256);
  const r=mulberry32(7); for(let i=0;i<90;i++){ x.fillStyle=`rgba(255,255,255,${0.35+r()*0.6})`; x.fillRect(r()*64, r()*256, 1+r()*3, 14+r()*60); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; })();
for (const F of FALLS){
  const g=new THREE.Group(); g.position.set(F.sx,0,F.sz); g.rotation.y=Math.atan2(F.dx,F.dz); OUT.add(g);   // local +z points up the river toward the pool
  const pm=poolWaterMat.clone(); pm.roughness=0.18; const pool=new THREE.Mesh(new THREE.CircleGeometry(1,40), pm); pool.rotation.x=-Math.PI/2; pool.scale.set(2.15,2.75,1); pool.position.set(0,F.top-0.14,4); g.add(pool);
  const rows=16, W=2.3, pos=[], uv=[], idx=[];
  for(let k=0;k<=rows;k++){ const t=k/rows, y=lerp(F.top-0.1,-0.2,t), u=1.5-0.95*Math.sqrt(t); for(const sx of [-1,1]){ pos.push(sx*W/2*(1+0.25*t), y, u); uv.push(sx<0?0:1, t*3); } if(k<rows){ const a=k*2; idx.push(a,a+1,a+2, a+1,a+3,a+2); } }
  const fg=new THREE.BufferGeometry(); fg.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); fg.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2)); fg.setIndex(idx); fg.computeVertexNormals();
  const sheet=new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map:fallTex, color:0xe6f8ff, transparent:true, opacity:0.92, side:THREE.DoubleSide, depthWrite:false })); g.add(sheet);
  const lip=mk(G.box(W+0.2,0.12,0.5), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.75 }), 0,F.top-0.08,1.5,g); lip.castShadow=false;
  const splash=new THREE.Mesh(new THREE.CircleGeometry(1.8,28), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, depthWrite:false })); splash.rotation.x=-Math.PI/2; splash.position.set(0,0.06,0.25); g.add(splash);
  const mist=[]; for(let i=0;i<14;i++){ const m=new THREE.Mesh(G.sph(0.32,8,6), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0, depthWrite:false })); m.castShadow=false; m.userData.ph=i/14; g.add(m); mist.push(m); }
  const rr=mulberry32(hashStr('falls'+F.sx)); for(const s of [-1,1]) for(let i=0;i<3;i++){ const rk=mk(G.dod(0.45+rr()*0.35), M([0x9aa1a8,0x8a9198,0xa8afb5][i],{flatShading:true}), s*(W/2+0.5+rr()*0.8), F.top-0.15+rr()*0.25, 1.7+i*1.2+rr()*0.5, g); rk.rotation.set(rr()*3,rr()*3,0); }
  fallFX.push({ F, splash, mist });
}
function updateFalls(dt,t){
  if (!fallFX.length) return; fallTex.offset.y-=dt*1.7;
  for (const fx of fallFX){ fx.splash.scale.setScalar(1+Math.sin(t*5)*0.06); fx.splash.material.opacity=0.45+Math.sin(t*7)*0.1;
    for (const m of fx.mist){ const p=(m.userData.ph+t*0.35)%1; m.position.set(Math.sin(m.userData.ph*40)*1.3, 0.2+p*2.4, 0.2-p*0.9); m.scale.setScalar(0.6+p*1.4); m.material.opacity=0.32*Math.sin(p*Math.PI); } }
}

/* ---------- Dock, bridges, paths ---------- */
{ const d=buildPlankDeck(DOCK.x1-DOCK.x0, DOCK.w*2, DOCK.y); d.position.set(DOCK.x0,0,DOCK.z); OUT.add(d);
  for(let x=DOCK.x0+1; x<DOCK.x1; x+=2.4) for(const s of [-1,1]) mk(G.cyl(0.12,0.14,2.6,8), M(0x8b5e3a), x,DOCK.y-1.1,DOCK.z+s*(DOCK.w-0.1),OUT);
  for(const s of [-1,1]) mk(G.cyl(0.13,0.13,0.5,8), M(0x8b5e3a), DOCK.x1-0.3,DOCK.y+0.2,DOCK.z+s*(DOCK.w-0.15),OUT); }
for (const b of BRIDGES){
  const g=new THREE.Group(); g.position.set(b.x,0,b.z); g.rotation.y=Math.atan2(-b.uz,b.ux); OUT.add(g);
  for(let u=-b.len/2; u<b.len/2; u+=0.5){ const y=0.45+0.45*Math.cos(clamp((u+0.25)/(b.len/2),-1,1)*Math.PI/2); mk(G.box(0.46,0.12,b.w*2), M(Math.round(u*2)%2?0xa8754a:0xc99a6a), u+0.25,y-0.06,0,g); }
  for(const s of [-1,1]){ for(let u=-b.len/2+0.3; u<=b.len/2; u+=1.4){ const y=0.45+0.45*Math.cos(clamp(u/(b.len/2),-1,1)*Math.PI/2); mk(G.cyl(0.07,0.07,0.8,8), M(0x8b5e3a), u,y+0.3,s*(b.w-0.05),g); }
    const pts=[]; for(let u=-b.len/2+0.3; u<=b.len/2; u+=0.5) pts.push(new THREE.Vector3(u,0.45+0.45*Math.cos(clamp(u/(b.len/2),-1,1)*Math.PI/2)+0.68,s*(b.w-0.05)));
    mk(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,0.05,6), M(0xc99a6a), 0,0,0,g); }
}
// Cobblestone paths (instanced): four worn, irregular stone shapes packed unevenly, each stone its own tone
function stoneGeo(seed){ const r=mulberry32(seed), g=new THREE.IcosahedronGeometry(0.3,2), p=g.attributes.position, v=new THREE.Vector3();
  const sx=0.85+r()*0.4, sz=0.75+r()*0.35, ph=r()*10;
  for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); const n=1+Math.sin(v.x*9+ph)*0.07+Math.cos(v.z*11+ph*2)*0.07+Math.sin((v.x+v.z)*15)*0.03;
    v.x*=sx*n; v.z*=sz*n; v.y=Math.max(-0.02, Math.min(v.y*0.32, 0.055+Math.sin(v.x*7+ph)*0.008)); p.setXYZ(i,v.x,v.y,v.z); }
  g.computeVertexNormals(); return g; }
function stoneTex(){ const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d'), r=mulberry32(19); x.fillStyle='#e8e8e8'; x.fillRect(0,0,128,128);
  for (let i=0;i<500;i++){ const v=150+r()*105|0; x.fillStyle=`rgba(${v},${v},${v},0.6)`; x.fillRect(r()*128,r()*128,1+r()*3,1+r()*3); }
  for (let i=0;i<10;i++){ x.strokeStyle='rgba(110,105,100,0.35)'; x.lineWidth=1; x.beginPath(); x.moveTo(r()*128,r()*128); x.lineTo(r()*128,r()*128); x.stroke(); }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; return t; }
{ const r=mulberry32(77), K=4, N=2000, mat=new THREE.MeshStandardMaterial({ roughness:0.88, map:stoneTex() });
  const ims=[...Array(K)].map((_,k)=>new THREE.InstancedMesh(stoneGeo(31+k*17), mat, N)), cnt=new Array(K).fill(0); const dm=new THREE.Object3D(), col=new THREE.Color();
  const stoneCols=[0xd8cdb8,0xc8bca6,0xe2d8c4,0xbfb29a,0xcfc2a8,0xb8b0a0,0xd8c8b0];
  for (const P of PATHS) for(let i=0;i<P.length-1;i++){ const [ax,az]=P[i], [bx,bz]=P[i+1]; const L=Math.hypot(bx-ax,bz-az); const nx=-(bz-az)/L, nz=(bx-ax)/L;
    for(let d=r()*0.25; d<L; d+=0.24+r()*0.16){ const per=r()<0.5?2:1;
      for (let q=0;q<per;q++){ const off=(r()*2-1)*0.72; const x=ax+(bx-ax)*d/L+nx*off, z=az+(bz-az)*d/L+nz*off;
        if (!walkable(x,z) || onBridge(x,z) || onDock(x,z) || rawHeight(x,z)<0.3 || r()<0.06) continue;
        const k=Math.floor(r()*K); if (cnt[k]>=N) continue; const s=0.55+r()*0.6*(1-Math.abs(off)*0.35);
        dm.position.set(x, groundY(x,z)-0.015-r()*0.02, z); dm.rotation.set((r()-0.5)*0.08, r()*TAU, (r()-0.5)*0.08); dm.scale.set(s,0.8+r()*0.5,s); dm.updateMatrix(); ims[k].setMatrixAt(cnt[k], dm.matrix);
        col.setHex(stoneCols[Math.floor(r()*stoneCols.length)]).offsetHSL((r()-0.5)*0.03,(r()-0.5)*0.06,(r()-0.5)*0.09); if (r()<0.12) col.lerp(new THREE.Color(0x8aa060), 0.25+r()*0.2);   // some mossy
        ims[k].setColorAt(cnt[k], col); cnt[k]++; } } }
  ims.forEach((im,k)=>{ im.count=cnt[k]; im.receiveShadow=true; im.castShadow=false; OUT.add(im); }); }
/* Part 2: entities (things you can interact with), tools, critters */

const ents=[]; const pickList=[];
class Ent {
  constructor(kind, x, z, r=0.6){ this.kind=kind; this.pos=new THREE.Vector3(x, groundY(x,z), z); this.r=r; this.solid=false; this.reach=r+1.0; this.obj=null; }
  parentGroup(){ if (this.pos.x>500){ const R=roomAt(this.pos.x,this.pos.z); return R?R.group:scene; } return OUT; }
  attach(obj){ this.obj=obj; obj.position.copy(this.pos); obj.traverse(c=>{ c.userData.ent=this; }); this.parentGroup().add(obj); ents.push(this); pickList.push(obj); return this; }
  swap(obj){ const i=pickList.indexOf(this.obj); const p=this.obj.parent; if(p) p.remove(this.obj); this.obj=obj; obj.position.copy(this.pos); obj.traverse(c=>{ c.userData.ent=this; }); (p||this.parentGroup()).add(obj); if(i>=0) pickList[i]=obj; else pickList.push(obj); }
  hitSphere(r, y){ const h=new THREE.Mesh(G.sph(r,6,4), new THREE.MeshBasicMaterial({ visible:false })); h.position.y=y; h.userData.ent=this; this.obj.add(h); }
  remove(keepMesh){ if(this.obj.parent && !keepMesh) this.obj.parent.remove(this.obj); this.obj.traverse(c=>{ if (c.userData.ent===this) delete c.userData.ent; }); const i=ents.indexOf(this); if(i>=0) ents.splice(i,1); const j=pickList.indexOf(this.obj); if(j>=0) pickList.splice(j,1); this.removed=true; }
  label(){ return null; } act(){} update(){}
}
const today = () => S.day ? S.day.key : Time.dayKey();
const dayNum = key => { const [y,m,d]=key.split('-').map(Number); return Math.round(Date.UTC(y,m-1,d)/864e5); };

/* ---------- Tools ---------- */
const hasTool = t => !!S.tools[t];
const toolTier = t => S.tools[t] ? S.tools[t].tier : -1;
const toolDef = t => TOOLS[t].tiers[toolTier(t)];
const article = n => /^[aeiou]/i.test(n) ? 'an' : 'a';
const isForever = t => { const T=S.tools[t]; return !!(T && TOOLS[t].tiers[T.tier] && TOOLS[t].tiers[T.tier].forever); };
function useTool(t){
  const T=S.tools[t]; if(!T) return false; if (isForever(t)){ save(); return true; } T.uses--;
  if (T.uses<=0){ const nm=TOOLS[t].tiers[T.tier].name; delete S.tools[t]; if(S.equip===t) S.equip=null; Snd.breakTool(); setTimeout(()=>toast(`Your ${nm} broke!`),400); updateHeld(); }
  else if (T.uses===5) setTimeout(()=>toast(`Your ${TOOLS[t].tiers[T.tier].name} is looking worn out.`),400);
  save(); return true;
}
function needTool(t){ if (hasTool(t)){ if (S.equip!==t) equip(t); return true; } toast(`Needs ${article(TOOLS[t].name)} ${TOOLS[t].name.toLowerCase()}.`); Snd.fail(); return false; }
function equip(t){ S.equip = (t && hasTool(t)) ? t : null; updateHeld(); updateToolBtn(); save(); }
const HOLD = { net:[1.3,0,0], rod:[1.0,0,0], shovel:[0.3,0,0], axe:[1.2,0,0], can:[0.2,0,0] };
function updateHeld(){
  const hand=player.obj.userData.hand; while(hand.children.length) hand.remove(hand.children[0]);
  if (!S.equip || !hasTool(S.equip)) return; const m=buildTool(S.equip, toolTier(S.equip)); const r=HOLD[S.equip]; m.rotation.set(r[0],r[1],r[2]); if(S.equip==='can'){ m.position.set(0,-0.1,0.05); } else m.position.y=-0.15; hand.add(m);
}

/* ---------- Trees and stumps ---------- */
class Tree extends Ent {
  constructor(key, x, z, type, fruit, rec){ super('tree',x,z,0.6); this.key=key; this.type=type; this.fruit=fruit; this.rec=rec||null; this.solid=true; this.reach=1.9; this.shake=0; this.attach(this.model()); this.obj.rotation.y=mulberry32(hashStr(key))()*TAU; this.refresh(); }
  get stage(){ return this.rec ? this.rec.stage : 3; }
  model(){ return buildTree(mulberry32(hashStr(this.key)), this.type, { fruit:this.fruit, stage:this.stage }); }
  rebuild(){ const ry=this.obj.rotation.y; this.swap(this.model()); this.obj.rotation.y=ry; this.solid=this.stage>=2; this.refresh(); }
  fruitLeft(){ if(!this.fruit || this.stage<3) return 0; if(!S.day) return 3;
    if (!VISIT && S.fruitPicked && S.fruitPicked[this.key]!==undefined && dayNum(today())-S.fruitPicked[this.key] < FRUIT_REGROW_DAYS) return 0;
    const v=S.day.fruit[this.key]; return v===undefined?3:v; }
  refresh(){ const n=this.fruitLeft(), fr=this.obj.userData.fruits||[], per=fr.length>3?2:1; fr.forEach((m,i)=>m.visible=i<n*per); }
  label(){ if (S.equip==='axe' && this.stage>=2) return 'Chop'; if (S.equip==='shovel' && this.stage<=1) return 'Dig up'; if (S.equip==='can' && this.stage<3 && this.rec && this.rec.watered!==today()) return 'Water'; return this.stage>=2 ? 'Shake' : 'Look'; }
  act(){
    const lab=this.label();
    if ((lab==='Chop'||lab==='Dig up'||lab==='Water') && noEdit()) return;
    if (lab==='Chop') return this.chop();
    if (lab==='Dig up'){ if(!useTool('shovel')) return; Snd.dig(); FX.hole(this.pos.clone(), 0.4, 1.4); S.plants.splice(S.plants.indexOf(this.rec),1); this.remove(); const id = this.type==='fruittree' ? this.fruit : this.type+'_sapling'; dropNear(ITEMS[id]?id:'oak_sapling', this.pos, 0.3, true); S.stats.dug++; save(); return; }
    if (lab==='Water'){ waterPlant(this.rec, this.pos); return; }
    if (lab==='Look') return;
    this.shake=1; Snd.rustle(); const tp=this.pos.clone(); tp.y+=2.8; puff(tp, World.season==='winter'?0xffffff:0x6cc050, 6, 0.8, 1, 1.2, 1);
    const n=this.fruitLeft();
    if (n>0){ track('shake'); S.day.fruit[this.key]=0; if (!VISIT) (S.fruitPicked=S.fruitPicked||{})[this.key]=dayNum(today()); for(let i=0;i<n;i++) setTimeout(()=>dropNear(this.fruit, this.pos, 1.6), 250+i*120); }
    else if (!S.day.branch[this.key] && Math.random()<0.7){ S.day.branch[this.key]=true; setTimeout(()=>dropNear('softwood', this.pos, 1.6), 300); }
    const sap=(S.day.sap=S.day.sap||{}); if (!sap[this.key]){ sap[this.key]=1; rareRoll('shake', 'goldsap', this.pos); }
    save(); setTimeout(()=>this.refresh(),250);
  }
  chop(){
    const tier=toolTier('axe'); if(!useTool('axe')) return;
    const n=(S.day.chop[this.key]||0); S.day.chop[this.key]=n+1; S.stats.chopped++; track('chop');
    this.shake=0.7; Snd.chop(); puff(this.pos.clone().add(new THREE.Vector3(0,1,0)), 0xd8b080, 5, 0.4, 1.5, 0.8, 0.5);
    if (n<3){ dropNear('wood', this.pos, 1.6); if (tier>=2) dropNear('wood', this.pos, 1.6); rareRoll('chop', 'heartwood', this.pos); }
    else if (TOOLS.axe.tiers[tier].nofell) toast('Too flimsy to fell it.');
    else { Snd.timber(); dropNear('wood', this.pos, 1.6);
      if (this.rec){ S.plants.splice(S.plants.indexOf(this.rec),1); } else S.cut[this.key]='gone';
      rareRoll('fell', 'heartwood', this.pos); const st={ key:this.key, x:this.pos.x, z:this.pos.z }; S.stumps.push(st); new Stump(st); FX.fell(this.obj, this.pos.clone(), this.type); this.remove(true); onFelled(this.pos.clone()); }
    save();
  }
  update(dt,t){ const top=this.obj.userData.top; if(!top) return; top.rotation.z=Math.sin(t*0.9+this.pos.x)*0.012+Math.sin(t*38)*0.07*this.shake; top.rotation.x=Math.cos(t*0.7+this.pos.z)*0.01; if(this.shake>0) this.shake=Math.max(0,this.shake-dt*1.6); }
}
class Stump extends Ent {
  constructor(rec){ super('stump',rec.x,rec.z,0.45); this.rec=rec; this.solid=true; this.reach=1.4; this.attach(buildStump()); }
  label(){ return S.equip==='shovel' ? 'Dig up' : 'Look'; }
  act(){ if (this.label()==='Look') return; if(!useTool('shovel')) return; Snd.dig(); S.stumps.splice(S.stumps.indexOf(this.rec),1);
    const pos=this.pos.clone(); FX.stumpOut(this.obj, pos); this.remove(true); setTimeout(()=>dropNear('stump', pos, 1.1), 900); rareRoll('stump', 'glimmermoss', pos); S.stats.dug++; track('dig'); save(); }
}
if (!S.stumps) S.stumps=[];

/* ---------- Rocks, dig spots, items, weeds ---------- */
function buildRockModel(r){ const g=new THREE.Group(); const c=[0x9aa1a8,0x8a9198,0xa8afb5]; mk(G.dod(0.75), M(c[0],{flatShading:true}), 0,0.45,0,g).scale.set(1.1,0.8,1); mk(G.dod(0.45), M(c[1],{flatShading:true}), 0.6,0.25,0.3,g); mk(G.dod(0.35), M(c[2],{flatShading:true}), -0.5,0.2,0.35,g); const moss=mk(G.sph(0.35,10,6), M(0x6a9a4a), -0.1,0.78,0.05,g); moss.scale.set(1.2,0.25,1); g.rotation.y=r()*TAU; return g; }
class Rock extends Ent {
  constructor(idx,x,z,r){ super('rock',x,z,0.95); this.idx=idx; this.solid=true; this.reach=1.9; this.hit=0; this.attach(buildRockModel(r)); }
  label(){ return 'Hit'; }
  act(){
    const t = (S.equip==='shovel'||S.equip==='axe') ? S.equip : (hasTool('shovel')?'shovel':(hasTool('axe')?'axe':null));
    if (!t){ toast('Needs a shovel or an axe.'); Snd.fail(); return; }
    if (S.equip!==t) equip(t);
    const used=S.day.rock[this.idx]||0; this.hit=1; Snd.thunk(); puff(this.pos.clone().add(new THREE.Vector3(0,0.6,0)), 0xb8bec4, 5, 0.6, 2, 0.8, 0.5);
    if (used>=4){ toast('The rock is all tapped out for today.'); return; }
    if (!useTool(t)) return; S.day.rock[this.idx]=used+1;
    if (this.idx===S.day.lucky){ const amt=[100,200,400,800][used]; addClams(amt); Snd.coin(); toast('A pouch of '+amt+' clams popped out!'); }
    else { const x=Math.random(); dropNear(x<0.6?'stone':(x<0.88?'clay':'iron'), this.pos, 1.7); rareRoll(World.night>0.5?'rockNight':'rock', 'starstone', this.pos); }
    save();
  }
  update(dt){ if(this.hit>0){ this.hit=Math.max(0,this.hit-dt*5); const s=1+Math.sin(this.hit*Math.PI)*0.08; this.obj.scale.set(s,2-s,s); } }
}
// v1.26: boat tickets to named islands (see the trips section)
const randomTicket = () => { const ids=Object.keys(ITEMS).filter(id=>ITEMS[id].kind==='ticket'); return ids[Math.floor(Math.random()*ids.length)]; };
class DigSpot extends Ent {
  constructor(i,x,z){ super('dig',x,z,0.4); this.i=i; this.reach=1.3; const g=new THREE.Group(); for(const a of [0.6,-0.6]){ const m=mk(G.box(0.7,0.03,0.12), M(0x6a4a30), 0,0.03,0,g); m.rotation.y=a; m.castShadow=false; } this.attach(g); this.hitSphere(0.5,0.2); }
  label(){ return 'Dig'; }
  act(){ if(!needTool('shovel') || !useTool('shovel')) return; Snd.dig(); puff(this.pos.clone().add(new THREE.Vector3(0,0.2,0)), 0xb08a5a, 8, 0.6, 2.5, 1, 0.6); S.day.digs[this.i].dug=true; S.stats.dug++; track('dig'); FX.hole(this.pos.clone(), 0.5, 1.6);
    const f=tierPick(Math.random, Object.values(ITEMS).filter(i=>i.kind==='fossil' && allowedFind(i)), i=>luckW(i,'dig'), 'dig'); this.remove(); setTimeout(()=>dropNear(f.id, this.pos, 0.3, true), 200);
    if (Math.random()<(potionOn('dig')?0.25:0.12)){ setTimeout(()=>{ const got=grantRandomStyle(); if(got){ Snd.jingle(); toast(`Swatch book: ${got}`); } }, 900); }
    if (!GUEST && Math.random()<rareChance('digPlan','dig')){ const pl=randomPlan(); if (pl){ const p=this.pos.clone(); setTimeout(()=>{ dropNear(pl, p, 0.9); sparkle(p.clone().add(new THREE.Vector3(0,1,0))); Snd.jingle(); toast('Something rolled up in the dirt...', thumb(pl), 'new', 'A rare plan!'); }, 1100); } }
    if (!GUEST && Math.random()<0.004){ const tk=randomTicket(), p=this.pos.clone(); setTimeout(()=>{ dropNear(tk, p, 0.9); Snd.jingle(); toast('A boat ticket was buried here!', thumb(tk), 'new'); }, 1100); }   // v1.26
    if (toolTier('shovel')>=2 && Math.random()<0.3){ addClams(300); toast(`Your ${TOOLS.shovel.tiers[toolTier('shovel')].name.toLowerCase()} turned up 300 clams too!`); Snd.coin(); } save(); }
}
class GroundItem extends Ent {
  constructor(rec){ super('item',rec.x,rec.z,0.35); this.rec=rec; this.reach=1.2; const it=ITEMS[rec.id]; const m=rec.bottle?buildBottle(rec.id):buildItemModel(rec.id); m.scale.setScalar(it.kind==='furniture'?0.6:0.95); const g=new THREE.Group(); g.add(m);
    if (it.rare || it.kind==='plan') this.aura=addAura(g, RARITY_COLORS[rarityLabel(it.rarity)], 0.35, 1.3); this.attach(g); this.hitSphere(0.45,0.3); this.spin=Math.random()*TAU; this.bounce=rec.fresh?1:0; delete rec.fresh; }
  label(){ return 'Pick up'; }
  act(){ if (!this.rec.beach && noEdit()) return; const id=this.rec.id;
    if (ITEMS[id].kind==='plan'){ const fresh=learnPlan(id); if (!fresh){ addClams(ITEMS[id].price); toast(`You already know that plan. Pemberton gave you ${fmt(ITEMS[id].price)} clams for the paper.`); }
      Snd.pop(); const i=S.ground.indexOf(this.rec); if(i>=0) S.ground.splice(i,1); this.remove(); save(); return; }
    const res=addItem(id, this.rec.m); if(!res){ toast('Your bag is full. Sell or drop something first.'); return; }
    for (let k=1;k<(this.rec.n||1);k++){ if (!addItem(id)) break; pickNote(id,'Picked up'); } Snd.pop(); const i=S.ground.indexOf(this.rec); if(i>=0) S.ground.splice(i,1); if (VISIT && this.rec.beach){ (S.day.vpicked=S.day.vpicked||[]).push(Math.round(this.rec.x*10)+','+Math.round(this.rec.z*10)); } this.remove(); { const kd=ITEMS[id].kind; if (kd==='fruit') track('fruit', this.rec.n||1); else if (kd==='shell') track('shell', this.rec.n||1); } save(); itemToast(id, res==='new', 'Picked up'); craftNudge(id); }
  update(dt,t){ if (this.aura) this.aura(t,dt); this.obj.children[0].rotation.y=this.spin+Math.sin(t*1.5+this.spin)*0.2; if(this.bounce>0){ this.bounce=Math.max(0,this.bounce-dt*2.2); this.obj.position.y=this.pos.y+Math.abs(Math.sin(this.bounce*Math.PI*2))*this.bounce*1.4; } }
}
class Weed extends Ent {
  constructor(i,x,z){ super('weed',x,z,0.5); this.i=i; this.reach=1.4; const g=buildWeedClump(hashStr(today()+':'+i)%9973+1, 1.45); g.rotation.y=i*1.7; this.attach(g); this.hitSphere(0.6,0.35); }
  label(){ return 'Pull'; }
  act(){ const r=addItem('weed'); if(!r){ toast('Your bag is full.'); return; } Snd.rustle(); puff(this.pos.clone().add(new THREE.Vector3(0,0.3,0)),0x6a8a2a,8,0.5,2,0.8,0.5); puff(this.pos.clone().add(new THREE.Vector3(0,0.1,0)),0x6a5038,5,0.4,1.5,0.7,0.5); S.day.weeds[this.i].pulled=true; track('weed'); FX.yank(this.obj); this.remove(true); if (World.night>0.5) rareRoll('weedNight', 'glimmermoss', this.pos); save(); itemToast('weed', r==='new','Pulled'); }
}

/* ---------- v1.9 harvesting ---------- */
const cropWord = (C,n) => { const w=C.name.toLowerCase(); return n>1&&!/s$/.test(w)&&!C.herb ? (C.name==='Tomato'||C.name==='Potato'?w+'es':w+'s') : w; };
const seedOf = rec => { const P=PLANTS[rec.sp]; return P.ptype==='crop' ? P.crop+'_seeds' : rec.sp+'_seeds'; };
// would these all fit in the bag?
function roomFor(list){ const inv=S.inv.map(x=>({...x})); for (const [id,k0] of list){ let k=k0; const st=ITEMS[id].stack; for (const x of inv){ if (x.id===id && !x.m && x.n<st){ const t=Math.min(k,st-x.n); x.n+=t; k-=t; } }
  while (k>0){ if (inv.length>=slotsMax()) return false; const t=Math.min(k,st); inv.push({ id, n:t }); k-=t; } } return true; }
// bulk: don't drop anything; return null if it won't fit
function harvestRec(rec, bulk){ const P=PLANTS[rec.sp], C=CROPS[P.crop], n=C.n[0]+Math.floor(Math.random()*(C.n[1]-C.n[0]+1)), seeds=1+Math.floor(Math.random()*4), sid=P.crop+'_seeds';
  if (bulk && !roomFor([[P.crop,n],[sid,seeds]])) return null;
  const at=new THREE.Vector3(rec.x, groundY(rec.x,rec.z), rec.z); let isNew=false, dropped=false;
  for (let i=0;i<n;i++){ const r=addItem(P.crop); if (r){ if (r==='new') isNew=true; } else { dropNear(P.crop, at, 0.9); dropped=true; } }
  for (let i=0;i<seeds;i++){ if (!addItem(sid)){ dropNear(sid, at, 0.9); dropped=true; } }
  const e=plantEntOf(rec);
  if (C.regrow){ rec.stage=C.regrowTo||1; if (e) e.rebuild(); } else { S.plants.splice(S.plants.indexOf(rec),1); if (e) e.remove(); }
  S.stats.harvested=(S.stats.harvested||0)+n; track('harvest'); return { n, seeds, isNew, dropped }; }
/* ---------- Planted flowers and shrubs ---------- */
function waterPlant(rec, pos){ if(!useTool('can')) return; rec.watered=today(); S.stats.watered++; track('water'); Snd.water(); for(let i=0;i<8;i++) puff(pos.clone().add(new THREE.Vector3((Math.random()-0.5)*0.6,0.8,(Math.random()-0.5)*0.6)),0x7fc8f0,1,0.15,-1,0.4,0.5); toast('Watered. It will grow faster tomorrow.'); save(); }
class Plant extends Ent {
  // Vegetables and herbs: pick a few. Tomatoes and herbs grow back; the rest come up whole.
  // Vegetables, herbs and berries: you get some of the crop and 1 to 4 seeds back. Tomatoes, herbs and berries stay planted and grow back.
  harvest(){ const r=harvestRec(this.rec, false); if (!r) return; Snd.pop(); puff(this.pos.clone().add(new THREE.Vector3(0,0.3,0)),0x7cc35a,6,0.5,1.5,0.7,0.5); save();
    const C=CROPS[PLANTS[this.rec.sp].crop]; toast(`${r.isNew?'New! ':''}Harvested ${r.n} ${cropWord(C,r.n)} and ${r.seeds} seed${r.seeds>1?'s':''}${r.dropped?' (some landed on the ground, your bag is full)':''}`, thumb(PLANTS[this.rec.sp].crop), r.isNew?'new':'');
    if (r.isNew) Snd.fanfare(); }
  constructor(rec){ super('plant',rec.x,rec.z,0.3); this.rec=rec; this.reach=1.3; this.attach(this.model()); this.hitSphere(0.4,0.3); this.obj.rotation.y=rec.rot||0; }
  model(){ const P=PLANTS[this.rec.sp]; return P.ptype==='crop' ? buildCrop(P.crop, this.rec.stage) : P.ptype==='flower' ? buildFlower(this.rec.sp, this.rec.stage, this.rec.color) : buildShrub(this.rec.sp, this.rec.stage, this.rec.color); }
  rebuild(){ const ry=this.obj.rotation.y; this.swap(this.model()); this.hitSphere(0.4,0.3); this.obj.rotation.y=ry; this.solid = PLANTS[this.rec.sp].ptype==='shrub' && this.rec.stage>=2; this.r = this.solid?0.6:0.3; }
  label(){ const P=PLANTS[this.rec.sp];
    if (S.equip==='can' && this.rec.watered!==today() && (this.rec.stage<3)) return 'Water';
    if (S.equip==='shovel') return 'Dig up';
    if (P.ptype==='flower' && this.rec.stage===3) return 'Pick';
    if (P.ptype==='crop' && this.rec.stage===3) return 'Harvest';
    if (S.equip==='can' && this.rec.watered!==today()) return 'Water';
    return 'Look'; }
  act(){ const lab=this.label(), P=PLANTS[this.rec.sp];
    if ((lab==='Water'||lab==='Dig up') && noEdit()) return;
    if (lab==='Water') return waterPlant(this.rec, this.pos);
    if (lab==='Harvest') return this.harvest();
    if (lab==='Pick'){ const r=addItem(this.rec.sp); if(!r){ toast('Your bag is full.'); return; } this.rec.stage=2; Snd.pop(); this.rebuild(); itemToast(this.rec.sp, r==='new', 'Picked'); save(); return; }
    if (lab==='Dig up'){ if(!useTool('shovel')) return; Snd.dig(); FX.hole(this.pos.clone(), 0.32, 1.2); S.plants.splice(S.plants.indexOf(this.rec),1); this.remove(); dropNear(P.ptype==='crop'?P.crop+'_seeds':P.ptype==='flower'?this.rec.sp+'_seeds':this.rec.sp+'_start', this.pos, 0.3, true); S.stats.dug++; save(); return; }
    const st=(P.ptype==='crop'?['just planted','sprouting','growing','ready to harvest']:['just planted','sprouting','growing','fully grown'])[this.rec.stage];
    toast(`${P.name}: ${st}.`);
  }
}

/* =====================================================================
   v1.9 GARDENS. Seeds go in on a grid (CELL squares). Planting next to a garden grows it; building one is free.
   A garden: { id, cells:['i,j'], gate:edgeKey, fence:style|null, fenced:[edgeKey], decor:{ sign, scarecrow, lanterns, arch } }
   Edge keys: 'i,j,E' is the side between squares (i,j) and (i+1,j); 'i,j,S' between (i,j) and (i,j+1).
   ===================================================================== */
const ckey=(i,j)=>i+','+j;
const cellOf=(x,z)=>[Math.round(x/CELL), Math.round(z/CELL)];
const GCELLS=new Map();
function indexGardens(){ GCELLS.clear(); for (const g of (S.gardens||[])) for (const k of g.cells) GCELLS.set(k,g); }
const gardenAtCell=(i,j)=>GCELLS.get(ckey(i,j));
const gardenAtXZ=(x,z)=>{ if (x>500) return null; const [i,j]=cellOf(x,z); return GCELLS.get(ckey(i,j)); };
const NB=[[1,0],[-1,0],[0,1],[0,-1]];
const edgeKey=(i,j,di,dj)=>di===1?`${i},${j},E`:di===-1?`${i-1},${j},E`:dj===1?`${i},${j},S`:`${i},${j-1},S`;
function edgeLine(k){ const [a,b,d]=k.split(','), i=+a, j=+b, h=CELL/2;
  return d==='E' ? { x:(i+0.5)*CELL, z:j*CELL, rot:Math.PI/2, p:[(i+0.5)*CELL, j*CELL-h, (i+0.5)*CELL, j*CELL+h] } : { x:i*CELL, z:(j+0.5)*CELL, rot:0, p:[i*CELL-h, (j+0.5)*CELL, i*CELL+h, (j+0.5)*CELL] }; }
// the garden's outside edge only: holes left around a tree or rock in the middle don't get fenced
function perimeter(g){ const set=new Set(g.cells), b=gardenBox(g), seen=new Set(), q=[];
  for (let i=b.i0-1;i<=b.i1+1;i++) for (let j=b.j0-1;j<=b.j1+1;j++) if (i===b.i0-1||i===b.i1+1||j===b.j0-1||j===b.j1+1){ const k=ckey(i,j); seen.add(k); q.push([i,j]); }
  while (q.length){ const [i,j]=q.pop(); for (const [di,dj] of NB){ const a=i+di, c=j+dj, k=ckey(a,c); if (a<b.i0||a>b.i1||c<b.j0||c>b.j1||seen.has(k)||set.has(k)) continue; seen.add(k); q.push([a,c]); } }
  const out=[]; for (const k of g.cells){ const [i,j]=k.split(',').map(Number); for (const [di,dj] of NB){ const n=ckey(i+di,j+dj); if (!set.has(n) && seen.has(n)) out.push({ key:edgeKey(i,j,di,dj), i, j, di, dj }); } } return out; }
const edgeOut=(e,d=0.6)=>[(e.i+e.di*0.5)*CELL+e.di*d, (e.j+e.dj*0.5)*CELL+e.dj*d];   // a point just outside a perimeter side
function gardenBox(g){ let a=1e9,b=-1e9,c=1e9,d=-1e9; for (const k of g.cells){ const [i,j]=k.split(',').map(Number); a=Math.min(a,i); b=Math.max(b,i); c=Math.min(c,j); d=Math.max(d,j); } return { i0:a, i1:b, j0:c, j1:d }; }
function nearestSide(g, x, z){ let best=null, bd=1e9; for (const e of perimeter(g)){ const [ox,oz]=edgeOut(e), d=Math.hypot(ox-x,oz-z)+(walkable(ox,oz)?0:50); if (d<bd){ bd=d; best=e; } } return best; }
function gateOf(g){ const per=perimeter(g); let e=per.find(p=>p.key===g.gate); if (!e){ e=nearestSide(g, player.pos.x, player.pos.z); g.gate=e?e.key:null; } return e; }
const gardenPlants = g => S.plants.filter(p=>gardenAtXZ(p.x,p.z)===g);
const plantEntOf = rec => plantEnts.find(e=>e.rec===rec && !e.removed);
const isRipe = rec => { const P=PLANTS[rec.sp]; return P && (P.ptype==='crop'||P.ptype==='flower') && rec.stage===3; };
const islandTerrain = () => LAYOUT_ID==='gen' ? ((S.gen&&S.gen.terrain)||'hilly') : LAYOUT_ID==='highlands' ? 'hilly' : 'flat';
const islandSeeds = () => islandSeedPool(S.seed, islandTerrain());

// Fences you can't walk through. Every side that has a fence piece is a segment; the gate is left open.
var FENCE_SEGS=[], moverFrom=null;
function fenceDist(x,z,s){ const [x1,z1,x2,z2]=s, dx=x2-x1, dz=z2-z1, t=Math.max(0,Math.min(1,((x-x1)*dx+(z-z1)*dz)/(dx*dx+dz*dz))); return Math.hypot(x-x1-dx*t, z-z1-dz*t); }
function fenceHit(x,z,r){ for (const s of FENCE_SEGS){ if (x<Math.min(s[0],s[2])-r-0.1 || x>Math.max(s[0],s[2])+r+0.1 || z<Math.min(s[1],s[3])-r-0.1 || z>Math.max(s[1],s[3])+r+0.1) continue;
  const d=fenceDist(x,z,s); if (d>=r) continue; if (moverFrom){ const d0=fenceDist(moverFrom.x,moverFrom.z,s); if (d0<r && d>=d0) continue; }   // already touching it: you can always step away
  return true; } return false; }

// Can a seed go in this square?
function cellFree(i,j, near){ const x=i*CELL, z=j*CELL; if (World.inside) return false;
  if (!walkable(x,z) || onDock(x,z) || onBridge(x,z) || rawHeight(x,z)<=SAND_H+0.05 || visPathDist(x,z)<1.0) return false;
  let lo=1e9, hi=-1e9; for (const [ox,oz] of [[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4],[0.4,0.4]]){ if (!walkable(x+ox,z+oz)) return false; const y=rawHeight(x+ox,z+oz); lo=Math.min(lo,y); hi=Math.max(hi,y); }
  if (hi-lo>0.35) return false;
  if (blocked(x,z,0.3)) return false;
  for (const q of (near||S.plants)) if (Math.abs(q.x-x)<0.55 && Math.abs(q.z-z)<0.55) return false;
  for (const t of trees) if (!t.removed && Math.abs(t.pos.x-x)<1.0 && Math.abs(t.pos.z-z)<1.0 && Math.hypot(t.pos.x-x,t.pos.z-z)<1.0) return false;
  return true; }

// Add squares to the garden they touch (merging gardens they join), or start a new one.
function addToGarden(cells){
  const touch=new Set(); for (const [i,j] of cells){ const g0=gardenAtCell(i,j); if (g0) touch.add(g0); for (const [di,dj] of NB){ const g=gardenAtCell(i+di,j+dj); if (g) touch.add(g); } }
  let g; if (!touch.size){ g={ id:'g'+Date.now().toString(36)+Math.floor(Math.random()*1e3), cells:[], gate:null, fence:null, fenced:[], decor:{} }; S.gardens.push(g); }
  else { const list=[...touch]; g=list[0]; for (const o of list.slice(1)){ g.cells.push(...o.cells); g.fenced=[...(g.fenced||[]), ...(o.fenced||[])]; if (!g.fence) g.fence=o.fence; g.decor=Object.assign({}, o.decor, g.decor); S.gardens.splice(S.gardens.indexOf(o),1); } }
  const set=new Set(g.cells); for (const [i,j] of cells) set.add(ckey(i,j)); g.cells=[...set]; indexGardens(); gateOf(g); return g; }

/* ---------- Drawing gardens: soil, fences, gate, decorations, the garden's stake (tap it for the garden menu) ---------- */
let GARDEN_GFX=null; const gardenEnts=[], COVER=[];
class GardenSpot extends Ent {
  constructor(g, x, z, rot, model){ super('garden', x, z, 0.3); this.g=g; this.reach=1.4; model.rotation.y=rot; this.attach(model); this.hitSphere(0.55,0.5); }
  label(){ return 'Garden'; }
  act(){ openGarden(this.g); }
  update(dt,t){ const b=this.obj.userData.bird; if (b) b.rotation.y=Math.sin(t*0.7)*0.6; }
}
// grass tufts, clover and wild flowers inside a garden are hidden so the soil shows
function applyCover(){ for (const c of COVER){ const a=c.im.instanceMatrix.array; a.set(c.orig); for (let k=0;k<c.im.count;k++){ if (gardenAtXZ(a[k*16+12], a[k*16+14])) for (let q=0;q<16;q++) a[k*16+q]=0; } c.im.instanceMatrix.needsUpdate=true; } }
function rebuildGardens(){
  indexGardens(); if (GARDEN_GFX) OUT.remove(GARDEN_GFX); GARDEN_GFX=new THREE.Group(); OUT.add(GARDEN_GFX);
  for (const e of gardenEnts) if (!e.removed) e.remove(); gardenEnts.length=0; FENCE_SEGS=[];
  GARDEN_GFX.add(buildSoil([...GCELLS.keys()].map(k=>{ const [i,j]=k.split(',').map(Number); return [i*CELL,j*CELL]; }), (x,z)=>groundY(x,z)));
  const byStyle={};
  for (const g of S.gardens){ if (!g.cells.length) continue; const per=perimeter(g), gate=gateOf(g), fenced=new Set(g.fenced||[]);
    if (g.fence){ const L=(byStyle[g.fence]=byStyle[g.fence]||{ edges:[], posts:new Map(), gates:[] });
      for (const e of per){ if (e.key===g.gate || !fenced.has(e.key)) continue; const l=edgeLine(e.key); L.edges.push({ x:l.x, y:groundY(l.x,l.z), z:l.z, rot:l.rot }); FENCE_SEGS.push(l.p);
        for (const [px,pz] of [[l.p[0],l.p[1]],[l.p[2],l.p[3]]]) L.posts.set(px.toFixed(2)+','+pz.toFixed(2), { x:px, y:groundY(px,pz), z:pz }); }
      if (gate){ const l=edgeLine(gate.key); for (const [px,pz] of [[l.p[0],l.p[1]],[l.p[2],l.p[3]]]){ L.posts.delete(px.toFixed(2)+','+pz.toFixed(2)); L.gates.push({ x:px, y:groundY(px,pz), z:pz }); } } }
    if (!gate) continue; const [sx,sz]=edgeOut(gate, 0.55), face=Math.atan2(gate.di, gate.dj), D=g.decor||{};
    // what grows here most, for the sign
    const counts={}; for (const p of gardenPlants(g)) counts[p.sp]=(counts[p.sp]||0)+1; const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0], TP=top&&PLANTS[top[0]];
    const stake = D.sign && D.sign!=='off' ? buildGardenSign(TP?TP.name:'Garden', TP&&TP.colors&&TP.colors[0]!==undefined?TP.colors[0]:0x6aae4a) : buildStake();
    const ox=Math.cos(face)*0.62, oz=-Math.sin(face)*0.62;   // beside the gate, not in it
    gardenEnts.push(new GardenSpot(g, sx+ox, sz+oz, face, stake));
    if (D.arch && D.arch!=='off'){ const l=edgeLine(gate.key), a=buildFlowerArch(); a.position.set(l.x, groundY(l.x,l.z), l.z); a.rotation.y=l.rot; GARDEN_GFX.add(a); }
    const bx=gardenBox(g), corners=[[bx.i0,bx.j0,-1,-1],[bx.i1,bx.j0,1,-1],[bx.i0,bx.j1,-1,1],[bx.i1,bx.j1,1,1]];
    if (D.lanterns && D.lanterns!=='off') for (const [ci,cj,si,sj] of corners){ let best=null, bd=1e9; for (const k of g.cells){ const [i,j]=k.split(',').map(Number), d=Math.abs(i-ci)+Math.abs(j-cj); if (d<bd){ bd=d; best=[i,j]; } }
      const x=(best[0]+si*0.5)*CELL+si*0.12, z=(best[1]+sj*0.5)*CELL+sj*0.12, lp=buildLanternPost(); lp.position.set(x, groundY(x,z), z); lp.rotation.y=Math.atan2(-si,-sj)+Math.PI/2; GARDEN_GFX.add(lp); }
    if (D.scarecrow && D.scarecrow!=='off'){ // in a corner square away from the gate, or just outside one
      const far=corners.slice().sort((a,b)=>Math.hypot(b[0]*CELL-sx,b[1]*CELL-sz)-Math.hypot(a[0]*CELL-sx,a[1]*CELL-sz));
      for (const [ci,cj,si,sj] of far){ const x=(ci+si*1.1)*CELL, z=(cj+sj*1.1)*CELL; if (!walkable(x,z) || gardenAtXZ(x,z)) continue; const sc=buildScarecrow(); sc.position.set(x, groundY(x,z), z); sc.rotation.y=Math.atan2(sx-x, sz-z); GARDEN_GFX.add(sc); break; } }
  }
  for (const [st,L] of Object.entries(byStyle)) GARDEN_GFX.add(buildFences(st, L.edges, [...L.posts.values()], L.gates));
  applyCover();
}

/* ---------- Furniture and buildings ---------- */
class Furniture extends Ent {
  constructor(rec){ const it=ITEMS[rec.id]; super('furn',rec.x,rec.z,it.r); this.rec=rec; this.solid=!it.flat; this.reach=it.r+1.1; const m=buildItemModel(rec.id); m.rotation.y=rec.rot||0; const g=new THREE.Group(); g.add(m); this.attach(g); this.model=m; if(it.flat) this.hitSphere(0.9,0.1); }
  get station(){ return (this.rec.id==='stove'||this.rec.id==='campfire') && S.cook; }
  label(){ return this.rec.id==='workbench' && S.craft ? 'Craft' : this.station ? 'Cook' : ITEMS[this.rec.id].store ? 'Open' : 'Arrange'; }
  act(){ const store=ITEMS[this.rec.id].store;
    if (!CAN_EDIT){ if (this.rec.id==='workbench' && S.craft) openCraft(); else if (this.station) openCraft('cook'); else if (store) toast('It\'s locked. Only the islanders who live here can open it.'); else toast('Nice, isn\'t it?'); return; }
    showChoices(ITEMS[this.rec.id].name, [
    ...(this.station ? [{ label:'Cook', fn:()=>openCraft('cook') }] : []),
    ...(store ? [{ label:'Open', fn:()=>openChest(this.rec) }] : []),
    ...(this.rec.id==='workbench' && S.craft ? [{ label:'Woodworking', fn:()=>openCraft() }] : []),
    { label:'Move', fn:()=>startPlacing(this.rec.id,'furn',this) },
    { label:'Rotate', fn:()=>{ this.rec.rot=((this.rec.rot||0)+Math.PI/4)%TAU; this.model.rotation.y=this.rec.rot; Snd.click(); save(); } },
    { label:'Pick up', fn:()=>{ if (store && this.rec.store && this.rec.store.length){ toast('Empty the chest before you pick it up.'); Snd.fail(); return; } if(!addItem(this.rec.id)){ toast('Your bag is full.'); return; } S.placed.splice(S.placed.indexOf(this.rec),1); this.remove(); Snd.pop(); save(); } },
    { label:'Leave it', alt:true, fn:()=>{} } ]); }
  update(dt,t){ runAnims(this.model, this.obj, t, dt); }
}
/* v1.19 storage chest: tap something in your bag to put the whole stack away, tap something in the chest to take it back.
   Each chest holds CHEST_SLOTS stacks, kept on the placed chest itself (rec.store), so it saves with the house. */
const CHEST_SLOTS=40;
function bagRoomFor(e){ const st=ITEMS[e.id].stack; if (e.m) return S.inv.length<slotsMax() ? 1 : 0;
  let room=S.inv.reduce((a,x)=>a+(x.id===e.id && !x.m ? Math.max(0,st-x.n) : 0),0); room+=(slotsMax()-S.inv.length)*st; return room; }
function openChest(rec){
  rec.store=rec.store||[];
  const cell=(s,i,key)=>`<div class="slot" data-${key}="${i}"><img src="${thumb(s.id)}" alt="">${s.n>1?`<span class="n">${s.n}</span>`:''}</div>`;
  const render=()=>{
    const bag=S.inv.map((s,i)=>cell(s,i,'put')).join('') + '<div class="slot empty"></div>'.repeat(Math.max(0,slotsMax()-S.inv.length));
    const box=rec.store.map((s,i)=>cell(s,i,'take')).join('') + '<div class="slot empty"></div>'.repeat(Math.min(6, CHEST_SLOTS-rec.store.length));
    pBody.innerHTML=`<div class="muted" style="margin-bottom:6px">Tap something in your bag to put it in the chest. Tap something in the chest to take it out.</div>
      <b>Bag</b> <span class="muted">${S.inv.length}/${slotsMax()}</span><div class="grid" style="margin:6px 0 12px">${bag}</div>
      <b>Chest</b> <span class="muted">${rec.store.length}/${CHEST_SLOTS}</span><div class="grid" style="margin-top:6px">${box}</div>`;
    pBody.querySelectorAll('[data-put]').forEach(el=>el.onclick=()=>{ const i=+el.dataset.put, s=S.inv[i]; if (!s) return;
      const st=ITEMS[s.id].stack; let n=s.n;
      if (!s.m) for (const x of rec.store){ if (n<=0) break; if (x.id===s.id && !x.m && x.n<st){ const k=Math.min(n, st-x.n); x.n+=k; n-=k; } }
      while (n>0 && rec.store.length<CHEST_SLOTS){ const k=s.m?n:Math.min(n,st); rec.store.push(s.m?{ id:s.id, n:k, m:s.m }:{ id:s.id, n:k }); n-=k; }
      const moved=s.n-n; if (!moved){ toast('The chest is full.'); Snd.fail(); return; }
      removeAt(i, moved); Snd.pop(); updateHUD(); save(); render(); });
    pBody.querySelectorAll('[data-take]').forEach(el=>el.onclick=()=>{ const i=+el.dataset.take, e=rec.store[i]; if (!e) return;
      const k=Math.min(e.n, bagRoomFor(e)); if (k<=0){ toast('Your bag is full.'); Snd.fail(); return; }
      if (e.m){ S.inv.push({ id:e.id, n:1, m:e.m }); } else { const st=ITEMS[e.id].stack; let n=k;
        for (const x of S.inv){ if (n<=0) break; if (x.id===e.id && !x.m && x.n<st){ const t=Math.min(n, st-x.n); x.n+=t; n-=t; } }
        while (n>0){ const t=Math.min(n,st); S.inv.push({ id:e.id, n:t }); n-=t; } }
      e.n-=k; if (e.n<=0) rec.store.splice(i,1); Snd.pop(); updateHUD(); save(); render(); });
  };
  openPanel('Storage Chest'); render();
}
class Building extends Ent {
  constructor(kind,x,z,r,obj,labelText,onAct){ super(kind,x,z,r); this.solid=true; this.reach=r+1.4; this._l=labelText; this._a=onAct; this.attach(obj); }
  label(){ return typeof this._l==='function'?this._l():this._l; } act(){ this._a(this); }
}

/* ---------- Residents ---------- */
const asleepNow = () => { const h=Time.hour(); return h>=23 || h<6; };
const HOME_ODDS=0.28;
class Resident extends Ent {
  constructor(spec){
    const [hx,hz]=spec.home; super('resident',hx+1,hz+3.4,0.45); this.spec=spec; this.reach=1.7; this.solid=true;
    this.attach(buildAnimal({ ...spec, look:CH.lookCode(CH.residentLook(S.seed, spec.id, RESIDENTS.indexOf(spec))) })); this.hitSphere(0.9,1.0);
    this.state='idle'; this.timer=1+Math.random()*3; this.target=null; this.face=0; this.stuckT=0; this.talking=false; this.loc='out'; this.lying=false;
    this.zzz=textSprite('z','#6a7ab8'); this.zzz.visible=false; scene.add(this.zzz);
  }
  get room(){ return ROOMS[this.spec.id]; }
  // v1.19: besides their fixed hours, islanders pop home in 45-minute blocks picked by a daily roll, so they're in
  // roughly a third of their waking hours (was about a tenth, which made their houses hard to visit)
  wantsHome(){ if (asleepNow()) return true; const h=Time.hour(); if ((this.spec.homeHours||[]).some(hr=>inHours(h,hr))) return true;
    const slot=Math.floor(h*60/45); return mulberry32(hashStr(today()+':home:'+this.spec.id+':'+slot+':'+S.seed))() < HOME_ODDS; }
  get asleep(){ return asleepNow() && this.loc==='in'; }
  label(){ return 'Talk'; }
  act(){ talkTo(this); }
  setLoc(loc){ const R=this.room; this.loc=loc; this.setLying(false);
    if (loc==='in'){ this.pos.set(R.entry[0], 0, R.entry[1]-0.8); this.obj.parent && this.obj.parent.remove(this.obj); R.group.add(this.obj); }
    else { this.pos.set(R.exit[0]+0.6, 0, R.exit[1]+0.4); this.pos.y=groundY(this.pos.x,this.pos.z); this.obj.parent && this.obj.parent.remove(this.obj); OUT.add(this.obj); }
    this.obj.position.copy(this.pos); this.state='idle'; this.timer=1; }
  setLying(on){ if (this.lying===on) return; this.lying=on; if (on){ const b=this.room.bed; this.pos.set(b[0],0.55,b[1]+0.2); this.obj.position.copy(this.pos); this.obj.rotation.set(-Math.PI/2,0,0); } else { this.obj.rotation.set(0,this.obj.rotation.y,0); this.pos.y = this.loc==='in'?0:groundY(this.pos.x,this.pos.z); } }
  update(dt,t){
    const u=this.obj.userData; this.zzz.visible=false; if (!this.lying && this.obj.visible!==false && (World.inside ? this.loc==='in' : this.loc==='out')){ const mv=Math.hypot(this.pos.x-(this.lx??this.pos.x), this.pos.z-(this.lz??this.pos.z))>dt*0.3; this.lx=this.pos.x; this.lz=this.pos.z; jelly(this.obj, this.jel=this.jel||{}, dt, mv, t, 0.7); }
    if (this.talking){ this.face=Math.atan2(player.pos.x-this.pos.x, player.pos.z-this.pos.z); this.applyFace(dt); u.body.position.y=Math.abs(Math.sin(t*6))*0.02; return; }
    const home=this.wantsHome(), R=this.room;
    if (home && this.loc==='out'){ // head home
      const d=Math.hypot(R.exit[0]-this.pos.x, R.exit[1]-this.pos.z);
      if (d>30 || (this.pos.distanceTo(player.pos)>35)) { this.setLoc('in'); return; }
      if (d<1.2) { this.setLoc('in'); return; }
      if (!this.moveToward(new THREE.Vector3(R.exit[0],0,R.exit[1]), dt, 2.2, t)) { this.stuckT+=dt; if(this.stuckT>4){ this.setLoc('in'); this.stuckT=0; } }
      this.applyFace(dt); return; }
    if (!home && this.loc==='in'){ if (World.inside!==this.spec.id){ this.setLoc('out'); return; }
      if (!this.moveToward(new THREE.Vector3(R.entry[0],0,R.entry[1]+0.3), dt, 1.8, t) || Math.hypot(this.pos.x-R.entry[0], this.pos.z-R.entry[1])<0.6) this.setLoc('out');
      this.applyFace(dt); return; }
    if (this.loc==='in' && asleepNow()){
      if (!this.lying){ const b=R.bed; if (Math.hypot(b[0]-this.pos.x,b[1]+1.4-this.pos.z)>0.5 && this.moveToward(new THREE.Vector3(b[0],0,b[1]+1.4),dt,1.5,t)) { this.applyFace(dt); return; } this.setLying(true); }
      this.zzz.visible = World.inside===this.spec.id; if(this.zzz.visible){ this.zzz.position.set(this.pos.x, 1.6+Math.sin(t*1.5)*0.15, this.pos.z-0.6); this.zzz.material.opacity=0.6+Math.sin(t*2)*0.4; }
      u.body.position.y=Math.sin(t*1.2)*0.02; return; }
    this.setLying(false);
    if (this.state==='idle'){ this.timer-=dt; u.body.position.y=0; u.arms.forEach(a=>a.rotation.x*=0.9); u.head.rotation.z=Math.sin(t*1.2)*0.08;
      if (this.timer<=0){ for(let k=0;k<12;k++){ let x,z; if (this.loc==='in'){ x=R.ox+(Math.random()-0.5)*(R.w-1.6); z=R.oz+(Math.random()-0.5)*(R.d-2); }
          else { const a=Math.random()*TAU, d=2+Math.random()*10; const base=Math.random()<0.65?[R.exit[0],R.exit[1]+2]:[0,0]; x=base[0]+Math.cos(a)*d; z=base[1]+Math.sin(a)*d; if(rawHeight(x,z)<SAND_H-0.1) continue; }
          if (walkable(x,z) && !blocked(x,z,0.5,this)){ this.target=new THREE.Vector3(x,0,z); this.state='walk'; break; } }
        this.timer=2+Math.random()*4; } }
    else if (this.state==='walk'){ if(!this.moveToward(this.target, dt, this.loc==='in'?1.2:1.7, t)){ this.state='idle'; this.timer=2+Math.random()*5; } }
    this.applyFace(dt);
  }
  moveToward(target, dt, speed, t){
    const d=target.clone().sub(this.pos); d.y=0; const L=d.length(); const u=this.obj.userData;
    if (L<0.3){ u.legs.forEach(l=>l.rotation.x=0); return false; }
    d.normalize(); const nx=this.pos.x+d.x*speed*dt, nz=this.pos.z+d.z*speed*dt;
    if (!walkable(nx,nz) || blocked(nx,nz,0.45,this) || Math.hypot(nx-player.pos.x,nz-player.pos.z)<0.9){ this.walkT=(this.walkT||0)+dt; if(this.walkT>0.6){ this.walkT=0; return false; } return true; }
    this.walkT=0; this.pos.x=nx; this.pos.z=nz; this.pos.y=groundY(nx,nz); this.obj.position.copy(this.pos);
    this.face=Math.atan2(d.x,d.z); const ph=t*9; u.legs[0].rotation.x=Math.sin(ph)*0.6; u.legs[1].rotation.x=-Math.sin(ph)*0.6; u.arms[0].rotation.x=-Math.sin(ph)*0.5; u.arms[1].rotation.x=Math.sin(ph)*0.5; u.body.position.y=Math.abs(Math.sin(ph))*0.06;
    return true;
  }
  applyFace(dt){ if(this.lying) return; let d=this.face-this.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); this.obj.rotation.y+=d*Math.min(1,dt*8); }
}
/* v1.26: Fennick comes through the Portal Station (once its beacon is lit) and pushes a little cart around the island,
   stopping here and there along the paths. Walk up to him and he waits for you. */
function buildMerchantCart(){
  const g=new THREE.Group(), wood=M(0x8a5e3a), dark=M(0x5a3e28), cloth=[M(0xd8604d),M(0xf4e6c8)], iron=M(0x2c2a28);
  mk(G.box(1.5,0.12,0.95), wood, 0,0.62,0,g); for (const sx of [-1,1]) mk(G.box(1.5,0.32,0.06), wood, 0,0.8,sx*0.46,g); mk(G.box(0.06,0.32,0.95), wood, 0.72,0.8,0,g);
  const wheels=[]; for (const sz of [-1,1]){ const w=new THREE.Group(); w.position.set(-0.1,0.38,sz*0.55); g.add(w); const t=mk(new THREE.TorusGeometry(0.33,0.05,6,16), dark, 0,0,0,w);
    for (let k=0;k<3;k++){ const sp=mk(G.box(0.62,0.04,0.04), dark, 0,0,0,w); sp.rotation.z=k/3*Math.PI; } mk(G.cyl(0.07,0.07,0.08,8), iron, 0,0,0,w).rotation.x=Math.PI/2; wheels.push(w); }
  mk(G.box(0.05,0.35,0.05), wood, 0.7,0.42,0,g);   // a leg at the front so it stands when parked
  for (const sz of [-1,1]){ const h=mk(G.box(0.9,0.05,0.05), wood, -1.05,0.86,sz*0.36,g); h.rotation.z=0.2; }
  mk(G.cyl(0.03,0.03,0.78,6), wood, -1.45,0.95,0,g).rotation.x=Math.PI/2;   // the handlebar
  // a striped awning on four posts
  for (const [px,pz] of [[-0.68,-0.42],[0.68,-0.42],[-0.68,0.42],[0.68,0.42]]) mk(G.cyl(0.03,0.03,1.0,6), wood, px,1.2,pz,g);
  for (let k=0;k<6;k++){ const st=mk(G.box(1.62/6,0.04,1.1), cloth[k%2], -0.81+(k+0.5)*1.62/6, 1.74+Math.sin(k/5*Math.PI)*0.08, 0, g); st.castShadow=true; }
  // crates, a sack and a jar or two
  mk(G.box(0.42,0.32,0.38), M(0xb8864e), -0.35,0.86,-0.18,g); mk(G.box(0.34,0.26,0.3), M(0xa8754a), 0.2,0.82,0.2,g);
  mk(G.sph(0.22,10,8), M(0xd8c49a), 0.42,0.86,-0.2,g).scale.set(1,1.2,1);
  mk(G.cyl(0.09,0.1,0.22,10), M(0x7ab0c8,{roughness:0.2}), -0.3,1.13,-0.18,g); mk(G.cyl(0.08,0.08,0.18,10), M(0xc87ab0,{roughness:0.2}), 0.2,1.04,0.2,g);
  g.userData.wheels=wheels; return g;
}
class Peddler extends Ent {
  constructor(){ const st=Peddler.start(); super('peddler',st[0],st[1],0.6); this.solid=true; this.reach=2.2;
    const g=new THREE.Group(); const a=buildAnimal({ species:'frog', ears:'none', fur:0x7fbf5a, muzzle:0xe8f0c0, shirt:0x8a5ab8, cheek:0xf5a3a3 }); g.add(a); this.a=a;
    const cart=buildMerchantCart(); cart.position.set(0,0,1.75); cart.rotation.y=-Math.PI/2; g.add(cart); this.cart=cart;
    this.attach(g); this.hitSphere(1.1,1.2); this.route=null; this.ri=0; this.wait=2+Math.random()*3; this.talking=0; this.face=0; }
  static start(){ if (PLACES.portal && portalEnt){ const d=portalEnt.doorPt; return [d[0], d[1]+2.4]; } return [DOCK.x0-2.5, DOCK.z-3.4]; }
  label(){ return 'Talk'; }
  act(){ this.talking=6; dialog(PEDDLER.name, PEDDLER.voice, [PEDDLER.greet], ()=>openShop('rare')); }
  pickRoute(){
    // somewhere along a path, not too far, not inside anything
    for (let k=0;k<12;k++){ const P=PATHS[Math.floor(Math.random()*PATHS.length)]; if (!P||!P.length) continue; const q=P[Math.floor(Math.random()*P.length)];
      const d=Math.hypot(q[0]-this.pos.x, q[1]-this.pos.z); if (d<6 || d>26 || !walkable(q[0],q[1]) || onBridge(q[0],q[1])) continue;
      this.solid=false; const r=findPath(this.pos.x, this.pos.z, q[0], q[1], 0.8); this.solid=true; if (r && r.length){ this.route=r; this.ri=0; return true; } }
    return false; }
  update(dt,t){
    const u=this.a.userData, near=Math.hypot(player.pos.x-this.pos.x, player.pos.z-this.pos.z)<4.2;
    if (this.talking>0) this.talking-=dt;
    if (near || this.talking>0 || dlgState){ const want=Math.atan2(player.pos.x-this.pos.x, player.pos.z-this.pos.z); this.turn(want, dt*3); u.body.position.y=Math.abs(Math.sin(t*2))*0.05; return; }
    if (!this.route){ this.wait-=dt; u.body.position.y=Math.abs(Math.sin(t*2))*0.05; if (this.wait<=0){ if (!this.pickRoute()) this.wait=3; } return; }
    const q=this.route[this.ri]; if (!q){ this.route=null; this.wait=8+Math.random()*10; return; }
    const tx=q.x!==undefined?q.x:q[0], tz=q.z!==undefined?q.z:q[1], dx=tx-this.pos.x, dz=tz-this.pos.z, d=Math.hypot(dx,dz);
    if (d<0.25){ this.ri++; return; }
    const sp=1.5*dt, nx=this.pos.x+dx/d*Math.min(sp,d), nz=this.pos.z+dz/d*Math.min(sp,d);
    this.turn(Math.atan2(dx,dz), dt*4); this.pos.set(nx, groundY(nx,nz), nz); this.obj.position.copy(this.pos);
    const ph=t*7; if (u.legs){ u.legs[0].rotation.x=Math.sin(ph)*0.5; u.legs[1].rotation.x=-Math.sin(ph)*0.5; } if (u.arms){ u.arms[0].rotation.x=-1.1; u.arms[1].rotation.x=-1.1; }
    for (const w of this.cart.userData.wheels) w.rotation.z-=sp/0.33;
  }
  turn(want, k){ let df=want-this.obj.rotation.y; df=Math.atan2(Math.sin(df),Math.cos(df)); this.obj.rotation.y+=df*Math.min(1,k); }
}

/* ---------- Bugs: sneak up slowly, or they flee ---------- */
const bugs=[];
const CATCH_BASE = { 'Common':0.85, 'Uncommon':0.72, 'Rare':0.58, 'Very rare':0.48, 'Legendary':0.4 };
const SKITTISH = { 'Common':0.7, 'Uncommon':1.1, 'Rare':1.6, 'Very rare':2.2, 'Legendary':3 };
class Bug extends Ent {
  constructor(id, x, z, extra={}){ super('bug',x,z,0.3); this.id=id; this.it=ITEMS[id]; this.where=this.it.where; this.reach=1.5;
    const m=buildItemModel(id); m.scale.setScalar(this.where==='air'?1.1:0.9); const g=new THREE.Group(); g.add(m); this.m=m; this.attach(g); this.hitSphere(0.8,0.5);
    this.home=new THREE.Vector3(x,0,z); this.ph=Math.random()*10; this.alt= this.where==='air' ? 0.8+Math.random()*1.4 : (this.where==='trunk'?1.1+Math.random()*0.6:0.05); this.flee=0; this.hop=0; this.trunk=extra.trunk||null;
    // trunk bugs sit on the side of the tree that faces the camera, so you can see them before you walk up
    if (this.trunk){ this.toff=(Math.random()-0.5)*1.1; this.ta=this.camSide()+this.toff; this.m.rotation.set(-Math.PI/2,0,0); this.placeOnTrunk(); }
    this.glow=addGlow(g, 0.35, 1.0, this.it.model.glow?0xe8ff9a:0xfff0c0); this.glow.userData.night=true;
    bugs.push(this); }
  get rarity(){ return rarityLabel(this.it.rarity); }
  camSide(){ return Math.atan2(camera.position.z-this.trunk.z, camera.position.x-this.trunk.x); }
  placeOnTrunk(){ const a=this.ta, R=0.34; this.pos.set(this.trunk.x+Math.cos(a)*R, groundY(this.trunk.x,this.trunk.z)+this.alt, this.trunk.z+Math.sin(a)*R); this.obj.rotation.y=Math.atan2(Math.cos(a),Math.sin(a)); this.obj.position.copy(this.pos); }
  label(){ return CatchMeter.bug===this ? 'Swing!' : 'Catch'; }
  // mode 'tap' = you tapped the bug and walked up automatically: a simple roll, about 70%.
  // mode 'manual' = you walked up yourself and pressed Catch: a timing swing. Nail it and almost nothing escapes.
  act(mode){
    if (!needTool('net')) return;
    if (mode==='manual'){ startCatchMeter(this); return; }
    this.swing(tapChance(this));
  }
  swing(chance, verdict){
    if(!useTool('net')) return; Snd.swoosh(); player.act=0.4;
    if (Math.random()<chance){ const meta=rollStats(this.id), id=this.id; setTimeout(()=>Snd.jingle(),120); sparkle(this.obj.position.clone()); this.despawn();
      const kept=r=>{ S.caught++; S.stats.bugs++; track('bug'); { const hr=Time.hour(); if (hr>=19||hr<5) track('bugnight'); } if (World.weather==='rain') track('bugrain'); S.stats.tapCatch=(S.stats.tapCatch||0)+(verdict?0:1); const best=recordCatch(id, meta); catchToast(id, meta, r==='new', best); save(); skillHint(); };
      const r=addItem(id, meta); if(!r){ fullBagCatch(id, meta, kept); return; } kept(r); }
    else { Snd.fail(); toast(verdict==='miss' ? ['Whiff!','It slipped away.','Too early!'][Math.floor(Math.random()*3)] : ['Whoosh! It got away.','Missed!','So close!'][Math.floor(Math.random()*3)]); this.startFlee(); }
  }
  startFlee(){ if(this.flee) return; this.flee=1; this.fleeDir=Math.atan2(this.pos.z-player.pos.z, this.pos.x-player.pos.x); }
  despawn(){ this.remove(); const i=bugs.indexOf(this); if(i>=0) bugs.splice(i,1); }
  update(dt,t){
    this.ph+=dt; const W=this.where;
    const pd=Math.hypot(player.pos.x-this.pos.x, player.pos.z-this.pos.z);
    if (!this.flee && CatchMeter.bug!==this && pd < (W==='air'?2.6:3.2) && Math.random()<SKITTISH[this.rarity]*dt*(player.speedFrac>0.55 ? 1 : player.targetEnt===this && player.speedFrac>0.05 ? 0.18 : 0)){ this.startFlee(); }
    if (this.flee){ this.flee+=dt; const sp=W==='air'||W==='flower'||W==='trunk'?5:3.5; this.pos.x+=Math.cos(this.fleeDir)*sp*dt; this.pos.z+=Math.sin(this.fleeDir)*sp*dt; if(W!=='ground'&&W!=='beach'&&W!=='pond') this.pos.y+=dt*2.5; this.obj.position.copy(this.pos); this.obj.rotation.y=Math.atan2(Math.cos(this.fleeDir),Math.sin(this.fleeDir)); this.flap(t,2); if(this.flee>2.2) this.despawn(); return; }
    if (W==='air'){ const w=this.ph*0.6; const x=this.home.x+Math.sin(w)*2.2+Math.sin(w*2.3)*0.8, z=this.home.z+Math.cos(w*0.8)*2.2; const ang=Math.atan2(x-this.pos.x, z-this.pos.z); this.pos.set(x, groundY(x,z)+this.alt+Math.sin(this.ph*3)*0.25, z); this.obj.rotation.y=ang; this.flap(t,1); }
    else if (W==='flower'){ if (Math.sin(this.ph*0.7)>0.93){ this.pos.y=groundY(this.pos.x,this.pos.z)+0.4+Math.sin(this.ph*8)*0.15; this.flap(t,1); } else { this.pos.y=groundY(this.pos.x,this.pos.z)+0.3; this.flap(t,0.15); } }
    else if (W==='trunk'){ this.flap(t,0.1);
      // if the view turned and the bug ended up behind the trunk, it crawls back round to the front
      let d=this.camSide()+this.toff-this.ta; d=Math.atan2(Math.sin(d),Math.cos(d)); if (Math.abs(d)>0.5){ this.ta+=Math.sign(d)*Math.min(Math.abs(d), dt*1.4); this.alt+=Math.sin(t*9)*dt*0.05; this.placeOnTrunk(); } }
    else if (W==='ground' || W==='beach'){ this.hop-=dt; if(this.hop<=0){ this.hop=1.5+Math.random()*3; const a=Math.random()*TAU; this.tx=this.pos.x+Math.cos(a)*1.2; this.tz=this.pos.z+Math.sin(a)*1.2; if(!walkable(this.tx,this.tz)){ this.tx=this.pos.x; this.tz=this.pos.z; } }
      if (this.tx!==undefined){ const dx=this.tx-this.pos.x, dz=this.tz-this.pos.z, L=Math.hypot(dx,dz); if(L>0.05){ const s=Math.min(L, dt*(W==='beach'?1.2:2.5)); this.pos.x+=dx/L*s; this.pos.z+=dz/L*s; this.obj.rotation.y=Math.atan2(dx,dz)+(W==='beach'?Math.PI/2:0); } }
      this.pos.y=groundY(this.pos.x,this.pos.z)+(W==='ground'&&this.hop>1.2?Math.sin((this.hop-1.2)*10)*0.2:0)+0.02; }
    else if (W==='pond'){ const w=this.ph*0.4; this.pos.set(this.home.x+Math.sin(w)*1.5, 0.03, this.home.z+Math.cos(w*1.3)*1.5); }
    if (!this.trunk) this.obj.position.copy(this.pos);
  }
  flap(t,s){ for(const wg of (this.m.userData.wings||[])) wg.rotation.z=wg.userData.side*Math.sin(t*22*s+this.ph)*0.7*Math.min(1,s+0.1); }
}

/* Catch chances.
   Tap-to-catch: about 60% for common bugs down to under 30% for legendary ones (a little more with a better net),
   and a bug may notice you walking up. On phones this was nearly a sure thing before v1.3.
   Manual swing: a marker sweeps across a bar. Perfect timing is ~97%, a decent swing ~85%, a sloppy one ~55%.
   It's harder at first and pays off once you get the feel for it. */
const TAP_BASE = { 'Common':0.6, 'Uncommon':0.5, 'Rare':0.42, 'Very rare':0.35, 'Legendary':0.28 };
const tapChance = b => clamp(TAP_BASE[b.rarity] + toolDef('net').bonus*0.3, 0.2, 0.68);
const SWEEP = { 'Common':1.5, 'Uncommon':1.3, 'Rare':1.1, 'Very rare':0.95, 'Legendary':0.8 };   // seconds per sweep
const CatchMeter = { bug:null, t:0, el:null };
function meterZones(b){ const nb=toolDef('net').bonus; const k={ 'Common':1, 'Uncommon':0.9, 'Rare':0.8, 'Very rare':0.7, 'Legendary':0.6 }[b.rarity];
  return { perfect:(0.05+nb*0.08)*k, great:(0.15+nb*0.12)*k, ok:(0.28+nb*0.1)*k }; }
function startCatchMeter(b){
  if (CatchMeter.bug) return; stopMove(); CatchMeter.bug=b; CatchMeter.t=0; player.face=Math.atan2(b.pos.x-player.pos.x, b.pos.z-player.pos.z);
  const z=meterZones(b), el=$('#meter'); CatchMeter.el=el; const pct=v=>(v*100).toFixed(1)+'%';
  el.querySelector('.ok').style.cssText=`left:${pct(0.5-z.ok)};width:${pct(z.ok*2)}`; el.querySelector('.great').style.cssText=`left:${pct(0.5-z.great)};width:${pct(z.great*2)}`; el.querySelector('.perfect').style.cssText=`left:${pct(0.5-z.perfect)};width:${pct(z.perfect*2)}`;
  el.classList.add('show'); Snd.click();
}
function meterPos(){ const b=CatchMeter.bug; const per=SWEEP[b.rarity]; return 0.5-0.5*Math.cos(CatchMeter.t/per*Math.PI); }
function resolveSwing(){
  const b=CatchMeter.bug; if(!b) return; const p=meterPos(), z=meterZones(b), d=Math.abs(p-0.5); endCatchMeter();
  const leg = b.rarity==='Legendary' ? 0.03 : 0;
  const [verdict, chance] = d<=z.perfect ? ['perfect',0.97-leg] : d<=z.great ? ['great',0.85-leg] : d<=z.ok ? ['ok',0.55] : ['miss',0.08];
  floatText(verdict==='perfect'?'Perfect!':verdict==='great'?'Great':verdict==='ok'?'Okay':'Miss', b.obj.position);
  if (!b.removed) b.swing(chance, verdict);
}
function endCatchMeter(){ CatchMeter.bug=null; if(CatchMeter.el) CatchMeter.el.classList.remove('show'); }
function updateCatchMeter(dt){
  const b=CatchMeter.bug; if(!b) return;
  if (b.removed || b.flee || Math.hypot(b.pos.x-player.pos.x,b.pos.z-player.pos.z)>b.reach+1.2){ endCatchMeter(); return; }
  CatchMeter.t+=dt; if (CatchMeter.t>4.5){ endCatchMeter(); b.startFlee(); Snd.fail(); toast('It flew off.'); return; }
  const v=b.obj.position.clone(); v.y+=1.4; v.project(camera); const el=CatchMeter.el;
  el.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; el.style.top=((-v.y*0.5+0.5)*innerHeight)+'px'; el.querySelector('.mk').style.left=(meterPos()*100)+'%';
}
function floatText(text, pos){ const e=document.createElement('div'); e.className='floatTxt'; e.textContent=text; const v=pos.clone(); v.y+=1.8; v.project(camera); e.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; e.style.top=((-v.y*0.5+0.5)*innerHeight)+'px'; document.body.appendChild(e); setTimeout(()=>e.remove(),1100); }
function skillHint(){}

/* A full bag never costs you a catch: let it go, or swap something out of the bag for it */
function fullBagCatch(id, meta, kept){
  const it=ITEMS[id], letGo=()=>{ toast(`You let the ${it.name} go.`, thumb(id)); Snd.swoosh(); };
  dialog('Your bag is full', 500, [], null, [
    { label:'Swap something out', fn:()=>openBag('swap', slot=>{ const s=S.inv[slot]; if(!s) return; const o=ITEMS[s.id], m=s.m, n=s.n; removeAt(slot,n);   // the whole stack, so the slot is free
        if (o.kind==='fish'||o.kind==='bug') toast(`You let the ${o.name} go.`); else for (let i=0;i<n;i++) dropNear(s.id, player.pos, 1.2+i*0.04, false, m);
        panelClose=null; closePanel(); const r=addItem(id, meta); if (r) kept(r); else letGo(); }, letGo) },
    { label:'Let it go', alt:true, fn:letGo } ]);
  dlgText.textContent=`You caught ${article(it.name)} ${it.name}! (${statText(id,meta)}) There's no room in your bag.`;
}
/* ---------- Fish shadows and fishing ---------- */
const SIZE_SCALE={ S:0.6, M:0.85, L:1.15, XL:1.55 };
const shadowGeo=G.sph(0.5,14,6);
const shadowMat=new THREE.MeshBasicMaterial({ color:0x163040, transparent:true, opacity:0.5, depthWrite:false });
const FISH_NIGHT=new THREE.Color(0x9fe0f0);   // at night fish show as a pale glow instead of a dark shadow
const fishes=[];
function fishPool(type){ const h=Time.hour(), m=Time.month(); return Object.values(ITEMS).filter(i=>i.kind==='fish' && i.where===type && inMonths(m,i.months) && inHours(h,i.hours)); }
function waterSpot(){ for(let k=0;k<40;k++){ const a=Math.random()*TAU, d=4+Math.random()*12; const x=player.pos.x+Math.cos(a)*d, z=player.pos.z+Math.sin(a)*d; if(isFishWater(x,z) && rawHeight(x,z)<-0.45 && !onDock(x,z) && !onBridge(x,z)) return [x,z]; } return null; }
function spawnFish(){ const p=waterSpot(); if(!p) return; const type=waterType(p[0],p[1]); const pool=fishPool(type).filter(allowedFind); if(!pool.length) return; const sp=tierPick(Math.random, pool, i=>luckW(i,'fish'), 'fish');
  // v1.26: the fish's length is decided when it spawns, and its shadow shows it: a big shadow is a big one for its species
  const meta=rollStats(sp.id), sz=(SIZE_SCALE[sp.size]||0.85)*(0.8+0.45*(meta.f||0));
  const m=new THREE.Mesh(shadowGeo, shadowMat); m.scale.set(sz*1.6,0.05,sz*0.8); m.position.set(p[0],-0.25,p[1]); m.visible=false; OUT.add(m);   // the water shader draws the shadow (see Water)
  fishes.push({ id:sp.id, meta, m, size:sz, age:0, home:new THREE.Vector3(p[0],0,p[1]), ph:Math.random()*10, state:'swim', t:0, nib:0 }); }
// Hand the nearest fish to the water shader: position, heading, size. They fade in when they appear and out when they flee.
function feedFishShadows(dt){ const U=WU.uFish.value, list=fishes.slice().sort((a,b)=>a.m.position.distanceToSquared(player.pos)-b.m.position.distanceToSquared(player.pos));
  for (let i=0;i<WATER_FISH_MAX;i++){ const f=list[i]; if (!f || World.inside){ U[i].set(0,0,0,0); continue; } f.age+=dt;
    const k=Math.min(1,f.age/1.2)*(f.state==='flee'?Math.max(0,1-f.t/1.1):1); U[i].set(f.m.position.x, f.m.position.z, -f.m.rotation.y, f.size*k); } }
const Fishing = { state:'idle', pt:null, fish:null, t:0, dip:0 };
const bobber = (()=>{ const g=new THREE.Group(); mk(G.sph(0.14,12,8,0,TAU,0,Math.PI/2), M(0xe2483d), 0,0,0,g); mk(G.sph(0.14,12,8,0,TAU,Math.PI/2,Math.PI/2), M(0xffffff), 0,0,0,g); g.visible=false; OUT.add(g); return g; })();
const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]); const fishLine=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.7 })); fishLine.visible=false; OUT.add(fishLine);
const exclaim=textSprite('!','#e2483d','rgba(255,255,255,.98)',1.1); exclaim.visible=false; scene.add(exclaim);
function biteWindow(f){ const it=ITEMS[f.id]; const pen={ 'Common':0, 'Uncommon':0.05, 'Rare':0.1, 'Very rare':0.15, 'Legendary':0.2 }[rarityLabel(it.rarity)] + (it.size==='XL'?0.05:0); return 0.9 - pen*0.6 + toolDef('rod').bonus; }
function loseInterest(f){ f.state='swim'; f.home.set(f.m.position.x-Math.sin(f.ph*0.3)*1.8, 0, f.m.position.z-Math.cos(f.ph*0.23)*1.8); f.ignore=Fishing.cast; if (Fishing.fish===f){ Fishing.fish=null; Fishing.t=1; } Snd.plip(); toast(['It lost interest.','It swam off.','Not hungry, that one.'][Math.floor(Math.random()*3)]); }
function castAt(pt){
  if (!needTool('rod')) return; stopMove(); Fishing.state='cast'; Fishing.cast=(Fishing.cast||0)+1; Fishing.lastLook=0; Fishing.pt=pt.clone(); Fishing.pt.y=0; Fishing.t=0; Fishing.fish=null; Fishing.dip=0;
  player.face=Math.atan2(pt.x-player.pos.x, pt.z-player.pos.z); bobber.visible=true; fishLine.visible=true; Snd.swoosh(); player.act=0.35;
}
function reel(){
  const f=Fishing.fish;
  if (Fishing.state==='bite' && f){ useTool('rod'); const meta=f.meta||rollStats(f.id), id=f.id; Snd.splash(); FX.fishCatch(id, bobber.position.clone()); setTimeout(()=>sparkle(player.pos.clone().add(new THREE.Vector3(0,2.3,0))), 600);
    const kept=r=>{ setTimeout(()=>Snd.fanfare(),150); S.caught++; S.stats.fish++; track('fish'); const best=recordCatch(id, meta); catchToast(id, meta, r==='new', best); rareRoll('catch', 'moonpearl', player.pos, 'fish'); save(); };
    const r=addItem(id, meta); if(!r) setTimeout(()=>fullBagCatch(id, meta, kept), 250); else kept(r);
    f.m.parent && f.m.parent.remove(f.m); fishes.splice(fishes.indexOf(f),1);
  } else if (f && (f.state==='nibble'||f.state==='approach')){ toast('Too soon!'); f.state='flee'; f.t=0; Snd.splash(); }
  Fishing.state='idle'; Fishing.fish=null; bobber.visible=false; fishLine.visible=false; exclaim.visible=false; player.act=0.4;
}
function updateFishing(dt,t){
  feedFishShadows(dt); if (World.inside) return;
  const near=fishes.filter(f=>f.m.position.distanceTo(player.pos)<22).length; if (near<3 && fishes.length<9 && Math.random()<dt*0.3) spawnFish();
  for (let i=fishes.length-1;i>=0;i--){ const f=fishes[i]; f.ph+=dt;
    if (f.state==='swim'){ if(f.m.position.distanceTo(player.pos)>45){ f.state='flee'; f.t=0.9; continue; } const x=f.home.x+Math.sin(f.ph*0.3)*1.8, z=f.home.z+Math.cos(f.ph*0.23)*1.8; if(isFishWater(x,z)){ const a=Math.atan2(z-f.m.position.z, x-f.m.position.x); f.m.position.x=x; f.m.position.z=z; f.m.rotation.y=-a; } }
    else if (f.state==='approach'){ f.hes=(f.hes||0)-dt; const d=Fishing.pt.clone().sub(f.m.position); d.y=0; const L=d.length();
      if (f.hes>0){ f.m.rotation.y+=Math.sin(t*3+f.ph)*dt*0.6; }   // hesitating, deciding whether it's worth it
      else if(L>0.55){ d.normalize(); f.m.position.addScaledVector(d, dt*0.75); f.m.rotation.y=-Math.atan2(d.z,d.x); if (Math.random()<dt*0.2) f.hes=0.4+Math.random()*0.9; }
      else { f.state='nibble'; f.t=0.9+Math.random()*1.4; const rar=ITEMS[f.id].rarity; f.nib=2+Math.floor(Math.random()*(rar<1.5?5:4)); } }
    else if (f.state==='nibble'){ f.t-=dt; if(f.t<=0){
        if (f.nib>0 && Math.random()<0.04){ loseInterest(f); continue; }   // sometimes it just swims off
        if(f.nib>0){ f.nib--; f.t=0.5+Math.random()*1.6; Snd.plip(); ripple(bobber.position.x,bobber.position.z,0.5); Fishing.dip=0.22; } else { f.state='bite'; Fishing.state='bite'; Fishing.t=0; Fishing.win=biteWindow(f); Snd.splash(); ripple(bobber.position.x,bobber.position.z,1.3); } } }
    else if (f.state==='flee'){ f.t+=dt; f.m.position.x+=dt*5; if(f.t>1.2){ f.m.parent && f.m.parent.remove(f.m); fishes.splice(i,1); } }
  }
  if (Fishing.state==='idle') return;
  const hand=player.pos.clone().add(new THREE.Vector3(Math.sin(player.face)*0.9, 1.9, Math.cos(player.face)*0.9));
  Fishing.t+=dt;
  if (Fishing.state==='cast'){ const k=Math.min(1,Fishing.t/0.5); bobber.position.lerpVectors(hand, Fishing.pt, k); bobber.position.y+=Math.sin(k*Math.PI)*1.5; if(k>=1){ Fishing.state='wait'; Fishing.t=0; Snd.plip(); ripple(Fishing.pt.x,Fishing.pt.z); } }
  else if (Fishing.state==='wait'){ bobber.position.set(Fishing.pt.x, Math.sin(t*2)*0.03-Fishing.dip, Fishing.pt.z); Fishing.dip=Math.max(0,Fishing.dip-dt);
    // Fish only notice a bobber that lands close by, and not every fish is hungry. Landing right on top of one scares it off.
    if (!Fishing.fish && Fishing.t>0.6 && Fishing.t-(Fishing.lastLook||0)>1.2){ Fishing.lastLook=Fishing.t; let best=null, bd=4.6;
      for(const f of fishes){ if(f.state!=='swim' || f.ignore===Fishing.cast) continue; const d=Math.hypot(f.m.position.x-Fishing.pt.x, f.m.position.z-Fishing.pt.z); if(d<bd){ bd=d; best=f; } }
      if (best){ const rar=ITEMS[best.id].rarity??5, want=clamp(0.6+rar*0.06,0.65,0.92);
        if (bd<0.5 && Fishing.t<1.4 && Math.random()<0.3){ best.state='flee'; best.t=0; Snd.splash(); toast('Splash! You scared it off.'); }
        else if (Math.random()<want){ best.state='approach'; best.hes=0.4+Math.random()*1.0; Fishing.fish=best; }
        else best.ignore=Fishing.cast; } }
    if (Fishing.t>25 && !Fishing.fish){ reel(); toast('Nothing biting.'); } }
  else if (Fishing.state==='bite'){ bobber.position.set(Fishing.pt.x, -0.22, Fishing.pt.z); exclaim.visible=true; exclaim.position.copy(player.pos).add(new THREE.Vector3(0,2.8,0));
    if (Fishing.t>Fishing.win){ exclaim.visible=false; toast('It got away!'); Snd.fail(); const f=Fishing.fish; f.state='flee'; f.t=0; Fishing.fish=null; Fishing.state='wait'; Fishing.t=0; } }
  const lp=lineGeo.attributes.position; lp.setXYZ(0,hand.x,hand.y+0.5,hand.z); lp.setXYZ(1,bobber.position.x,bobber.position.y+0.1,bobber.position.z); lp.needsUpdate=true;
}

/* ---------- Ambient wildlife ---------- */
const critters=[];
function spawnAmbient(){
  const r=mulberry32(S.seed+5);
  for(let i=0;i<6;i++){ const p=randLand(r,SAND_H+0.2,9,0.5); if(!p) continue; const b=buildBird([0x8a6a4a,0xd86a4a,0x5a7ab8,0xe8c040][i%4]); b.position.set(p[0],groundY(p[0],p[1]),p[1]); OUT.add(b); critters.push({ type:'bird', o:b, home:new THREE.Vector3(p[0],0,p[1]), t:Math.random()*3, fly:0 }); }
  for(let i=0;i<3;i++){ const g=buildGull(); OUT.add(g); critters.push({ type:'gull', o:g, a:Math.random()*TAU, r:(48+Math.random()*10)*SC, h:9+Math.random()*4, s:0.08+Math.random()*0.05 }); }
  for(let i=0;i<2;i++){ const d=buildDuck(); OUT.add(d); critters.push({ type:'duck', o:d, a:Math.random()*TAU, ph:Math.random()*5 }); }
}
function updateAmbient(dt,t){
  for(const c of critters){ const o=c.o;
    if (c.type==='gull'){ c.a+=dt*c.s; o.position.set(Math.cos(c.a)*c.r, c.h+Math.sin(t+c.r)*0.6, Math.sin(c.a)*c.r); o.rotation.y=-c.a; o.userData.wings.forEach(w=>w.rotation.z=w.userData.side*Math.sin(t*4+c.r)*0.5); }
    else if (c.type==='duck'){ c.ph+=dt*0.25; o.position.set(POND.x+Math.cos(c.ph+c.a)*2.8, 0.02+Math.sin(t*2)*0.02, POND.z+Math.sin(c.ph*1.3+c.a)*2.2); o.rotation.y=Math.atan2(-Math.sin(c.ph+c.a), Math.cos(c.ph*1.3+c.a)); }
    else if (c.type==='bird'){
      if (c.fly>0){ c.fly-=dt; o.position.y+=dt*4; o.position.x+=c.vx*dt; o.position.z+=c.vz*dt; o.userData.wings.forEach(w=>w.rotation.z=w.userData.side*Math.sin(t*30)*0.8); if(c.fly<=0){ const p=randLand(Math.random,SAND_H+0.2,9,0.5); if(p){ c.home.set(p[0],0,p[1]); } o.position.set(c.home.x,groundY(c.home.x,c.home.z),c.home.z); } continue; }
      if (!World.inside && Math.hypot(o.position.x-player.pos.x,o.position.z-player.pos.z)<3){ c.fly=3; const a=Math.atan2(o.position.z-player.pos.z,o.position.x-player.pos.x); c.vx=Math.cos(a)*6; c.vz=Math.sin(a)*6; o.rotation.y=Math.atan2(c.vx,c.vz); continue; }
      c.t-=dt; if(c.t<=0){ c.t=0.6+Math.random()*2; const a=Math.random()*TAU; const nx=o.position.x+Math.cos(a)*0.5, nz=o.position.z+Math.sin(a)*0.5; if(walkable(nx,nz) && Math.hypot(nx-c.home.x,nz-c.home.z)<4){ o.position.x=nx; o.position.z=nz; o.rotation.y=Math.atan2(Math.cos(a),Math.sin(a)); } }
      const hopT=Math.max(0,c.t-0.4); o.position.y=groundY(o.position.x,o.position.z)+(c.t>0.45?0:Math.abs(Math.sin(c.t*20))*0.08); o.children[1].rotation.x = Math.sin(t*3+c.home.x)>0.7?0.5:0;
    }
  }
}

/* ---------- Little action animations ----------
   A tree tips over and lands, holes open up when you dig or plant, stumps wiggle loose, weeds get yanked,
   and a caught fish leaps out of the water into your hands. Each effect owns its meshes and cleans up after itself. */
const fxList=[];
const holeMat=new THREE.MeshStandardMaterial({ color:0x3a2818, roughness:1, transparent:true, depthWrite:false });
const holeGeo=new THREE.CircleGeometry(1,20).rotateX(-Math.PI/2);
const easeOut=k=>1-Math.pow(1-k,3);
const FX = {
  add(fn){ fxList.push(fn); },
  // a hole in the ground with a little dirt pile beside it
  hole(pos, r=0.45, life=1.6){ const g=new THREE.Group(); g.position.set(pos.x, groundY(pos.x,pos.z)+0.025, pos.z);
    const hm=holeMat.clone(); const h=mk(holeGeo, hm, 0,0,0,g); h.castShadow=false; h.receiveShadow=false; h.scale.set(r,1,r*0.85);
    const pile=mk(G.sph(r*0.7,8,5), MF(0x6a5038), r*1.2,0,-r*0.2,g); pile.scale.set(1,0.01,0.8); pile.castShadow=false; OUT.add(g);
    puff(g.position.clone().add(new THREE.Vector3(0,0.15,0)), 0x8a6a48, 7, 0.45, 2.2, 0.9, 0.55);
    let t=0; FX.add(dt=>{ t+=dt; const k=Math.min(1,t/0.18); h.scale.set(r*easeOut(k),1,r*0.85*easeOut(k)); pile.scale.y=0.45*easeOut(k);
      const f=Math.max(0,(t-(life-0.5))/0.5); hm.opacity=1-f; pile.scale.y*=1-f; if (t>=life){ OUT.remove(g); hm.dispose(); return false; } return true; }); },
  // the tree tips away from you, picks up speed, thumps down with a bounce, then sinks away
  fell(obj, pos, type){ const pv=new THREE.Group(); pv.position.copy(obj.position); OUT.add(pv); obj.parent && obj.parent.remove(obj); obj.position.set(0,0,0); pv.add(obj);
    let dx=pos.x-player.pos.x, dz=pos.z-player.pos.z; const L=Math.hypot(dx,dz)||1; dx/=L; dz/=L; const axis=new THREE.Vector3(dz,0,-dx);
    let th=0.02, w=0, t=0, landed=0, bounced=false; const max=Math.PI/2-0.12, top=obj.userData.top;
    FX.add(dt=>{ t+=dt;
      if (!landed){ w+=(3.2*Math.sin(th)+0.5)*dt; th+=w*dt; if (top) top.rotation.z=Math.sin(t*30)*0.04*(1-th/max);
        if (th>=max){ th=max; if (!bounced){ bounced=true; w=-w*0.22; Snd.thunk(); const p=pos.clone(); p.x+=dx*3; p.z+=dz*3; p.y=groundY(p.x,p.z)+0.4;
            puff(p, World.season==='winter'?0xffffff:(type==='palm'?0x7ab84a:0x6cc050), 16, 1.6, 2.2, 1.4, 1.1); puff(p, 0xc8b08a, 8, 1.2, 1.2, 1, 0.8); }
          else { landed=t; } } }
      pv.quaternion.setFromAxisAngle(axis, th);
      if (landed){ const k=(t-landed-0.35)/0.5; if (k>0){ pv.scale.setScalar(Math.max(0.001,1-easeOut(Math.min(1,k)))); pv.position.y=groundY(pos.x,pos.z)-k*0.4; }
        if (k>=1){ OUT.remove(pv); return false; } }
      return t<8; }); },
  // the stump wobbles, works loose and pops out of the ground
  stumpOut(obj, pos){ FX.hole(pos, 0.55, 2.4); let t=0; const y0=obj.position.y;
    FX.add(dt=>{ t+=dt;
      if (t<0.45){ obj.rotation.z=Math.sin(t*40)*0.12*(t/0.45); obj.rotation.x=Math.cos(t*34)*0.08*(t/0.45); }
      else { const k=Math.min(1,(t-0.45)/0.4); obj.position.y=y0+Math.sin(k*Math.PI)*0.7; obj.rotation.z=k*0.9; obj.scale.setScalar(Math.max(0.001,1-k*k));
        if (!obj.userData.popped){ obj.userData.popped=1; Snd.pop(); puff(pos.clone().add(new THREE.Vector3(0,0.3,0)),0x8a6a48,10,0.7,2.8,1,0.7); } }
      if (t>0.85){ obj.parent && obj.parent.remove(obj); return false; } return true; }); },
  // a pulled weed comes up with a tug and vanishes
  yank(obj){ let t=0; const y0=obj.position.y; FX.add(dt=>{ t+=dt; const k=Math.min(1,t/0.35); obj.position.y=y0+easeOut(k)*0.7; obj.rotation.y+=dt*9; obj.scale.setScalar(Math.max(0.001,1-k*k)); if (k>=1){ obj.parent && obj.parent.remove(obj); return false; } return true; }); },
  // something you planted pokes up out of a fresh hole
  sprout(ent){ const o=ent.obj; FX.hole(ent.pos, 0.32, 1.1); o.scale.setScalar(0.001); let t=0;
    FX.add(dt=>{ t+=dt; if (ent.removed) return false; const k=Math.max(0,(t-0.3)/0.35); const s=k>=1?1:Math.max(0.001,easeOut(k)*(1+Math.sin(k*Math.PI)*0.25)); o.scale.setScalar(s); return k<1; }); },
  // a caught fish jumps out of the water, arcs over to you, and you hold it up
  fishCatch(id, from){ const m=buildItemModel(id), it=ITEMS[id]; const s=1.1*(SIZE_SCALE[it.size]||0.85)+0.5; m.scale.setScalar(s); const g=new THREE.Group(); g.add(m); scene.add(g);
    m.traverse(c=>{ if (c.isMesh) c.castShadow=false; }); const a=from.clone(); a.y=0; ripple(a.x,a.z,1.4); puff(a.clone().add(new THREE.Vector3(0,0.2,0)),0xdff4ff,10,0.6,3,0.9,0.7);
    let t=0; FX.add(dt=>{ t+=dt; const head=player.pos.clone().add(new THREE.Vector3(0,2.25,0));
      if (t<0.6){ const k=t/0.6; g.position.lerpVectors(a, head, k); g.position.y+=Math.sin(k*Math.PI)*2.2; m.rotation.z=k*TAU*1.25; m.rotation.y=Math.atan2(head.x-a.x, head.z-a.z)-Math.PI/2; }
      else { g.position.copy(head); m.rotation.z=Math.sin(t*16)*0.35*Math.max(0,1.6-t); m.rotation.y=Math.atan2(camera.position.x-head.x, camera.position.z-head.z); m.rotation.x=-0.35; player.act=Math.max(player.act,0.2);
        if (t>1.55){ const k=Math.min(1,(t-1.55)/0.25); g.scale.setScalar(Math.max(0.001,1-k)); if (k>=1){ scene.remove(g); return false; } } }
      return true; }); },
};
function updateFX(dt){ for (let i=fxList.length-1;i>=0;i--){ let keep=false; try{ keep=fxList[i](dt); }catch(e){ console.warn(e); } if (!keep) fxList.splice(i,1); } }

/* ---------- Particles ---------- */
const parts=[]; const partGeo=G.ico(0.1,0);
function puff(pos, color, n=8, spread=1, up=2, size=1, life=0.8){ for(let i=0;i<n;i++){ const m=new THREE.Mesh(partGeo, new THREE.MeshStandardMaterial({ color, flatShading:true, transparent:true })); m.position.copy(pos); m.scale.setScalar(size*(0.6+Math.random()*0.8)); scene.add(m); parts.push({ m, v:new THREE.Vector3((Math.random()-0.5)*spread*3, up*(0.5+Math.random()), (Math.random()-0.5)*spread*3), life, t:0, g:-6 }); } }
function sparkle(pos){ for(let i=0;i<10;i++){ const m=new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color:i%2?0xfff3a0:0xffffff, transparent:true })); m.position.copy(pos); m.scale.setScalar(0.7); scene.add(m); const a=i/10*TAU; parts.push({ m, v:new THREE.Vector3(Math.cos(a)*2.4,2+Math.random()*2,Math.sin(a)*2.4), life:0.7, t:0, g:-3 }); } }
const ripples=[]; const ringGeo=new THREE.RingGeometry(0.85,1,28); ringGeo.rotateX(-Math.PI/2);
function ripple(x,z,s=1){ const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.8, depthWrite:false })); m.position.set(x,0.08,z); m.scale.setScalar(0.2*s); scene.add(m); ripples.push({ m, t:0, s }); }
const smokeSrc=[]; let smokeT=0;
function updateParticles(dt){
  for(let i=parts.length-1;i>=0;i--){ const p=parts[i]; p.t+=dt; p.v.y+=p.g*dt; p.m.position.addScaledVector(p.v,dt); p.m.rotation.x+=dt*4; p.m.material.opacity=1-p.t/p.life; if(p.t>=p.life){ scene.remove(p.m); p.m.material.dispose(); parts.splice(i,1); } }
  for(let i=ripples.length-1;i>=0;i--){ const r=ripples[i]; r.t+=dt; r.m.scale.setScalar((0.2+r.t*1.6)*r.s); r.m.material.opacity=0.8*(1-r.t/1.1); if(r.t>1.1){ scene.remove(r.m); r.m.material.dispose(); ripples.splice(i,1); } }
  smokeT+=dt; if(smokeT>0.8 && !World.inside){ smokeT=0; for(const s of smokeSrc){ if (s.distanceTo(player.pos)>45) continue; const m=new THREE.Mesh(partGeo,new THREE.MeshStandardMaterial({ color:0xf4f4f4, transparent:true, opacity:0.8, flatShading:true })); m.position.copy(s); m.scale.setScalar(1.5); scene.add(m); parts.push({ m, v:new THREE.Vector3(0.3+Math.random()*0.2,0.9,0), life:3, t:0, g:0 }); } }
}

/* ---------- Placement helpers ---------- */
const RECTS=[];   // solid rectangles outdoors (buildings): [x0,z0,x1,z1, owner]
function inRects(x,z,r){ if (x>500) return false; for(const q of RECTS){ if (x>q[0]-r && x<q[2]+r && z>q[1]-r && z<q[3]+r) return q; } return null; }
let ignoreRects=false;
// Room kept free for buildings that grow later (museum, town hall, shops): trees and rocks don't grow there
const KEEPOUT=[]; const keptOut=(x,z)=>KEEPOUT.some(([a,b,r])=>Math.hypot(x-a,z-b)<r);
function blocked(x,z,r,self){ if (!ignoreRects && inRects(x,z,r)) return true; if (FENCE_SEGS && FENCE_SEGS.length && x<500 && fenceHit(x,z,r)) return true; for(const e of ents){ if(!e.solid||e===self||e.removed) continue; if(Math.abs(x-e.pos.x)>6||Math.abs(z-e.pos.z)>6) continue; if(Math.hypot(x-e.pos.x,z-e.pos.z) < e.r+r) return true; } return false; }
/* Would something lying at (x,z) be hidden from the camera? The camera looks north from the south (+z),
   so a tree canopy, a rock or a building just south of a spot covers it. */
function hiddenSpot(x,z){
  if (x>500) return false;
  for (const t of trees){ if (t.removed || (t.rec && t.rec.stage<2)) continue; const dz=t.pos.z-z; if (dz>-0.6 && dz<4.2 && Math.abs(t.pos.x-x)<1.9) return true; }
  for (const r of rocks){ if (r.removed) continue; const dz=r.pos.z-z; if (dz>-0.3 && dz<1.7 && Math.abs(r.pos.x-x)<1.15) return true; }
  if (inRects(x, z+1.4, 0.2) || inRects(x, z+2.8, 0.2)) return true;
  return false; }
function dropNear(id, at, rad=1.4, exact=false, meta){
  let x=at.x, z=at.z, fallback=null;
  // look for open ground on the camera's side first, and never tuck it behind a tree, rock or building
  for(let k=0;k<40;k++){ const a = k<20 ? Math.random()*Math.PI : Math.random()*TAU, d=exact?0:(rad*0.7+Math.random()*rad*0.6)*(k<30?1:1.6); const tx=at.x+Math.cos(a)*d, tz=at.z+Math.sin(a)*d;
    if(walkable(tx,tz) && !blocked(tx,tz,0.3)){ if (!hiddenSpot(tx,tz)){ x=tx; z=tz; fallback=null; break; } if (!fallback) fallback=[tx,tz]; } }
  if (fallback){ x=fallback[0]; z=fallback[1]; }
  const rec={ id, x, z, fresh:true }; if(meta) rec.m=meta; S.ground.push(rec); new GroundItem(rec); Snd.pop(); save();
}
/* Part 3: building the island, rooms, daily reset, sky, dialogue, UI, input, main loop */

/* ---------- Layout reservation ---------- */
const reserved=[]; const reserve=(x,z,r)=>reserved.push([x,z,r]);
const isFree=(x,z,r)=>{ for(const [a,b,c] of reserved) if(Math.hypot(x-a,z-b)<c+r) return false; return true; };
reserve(0,0,3.5); reserve(...PLACES0.board,2.5); reserve(...PLACES0.shop,4.5); reserve(PLACES0.home[0],PLACES0.home[1]+1,5.5);
for (const R of RESIDENTS) if (PLACES0[R.id]) reserve(PLACES0[R.id][0],PLACES0[R.id][1]+1,5.5);
reserve(DOCK.x0-2,DOCK.z-3,4); reserve(DOCK.x0,DOCK.z,3); for(const b of BRIDGES){ reserve(...bEnd(b,1),2.5); reserve(...bEnd(b,-1),2.5); }
function randLand(r, minH, maxH, rad, tries=60, near){
  for(let k=0;k<tries;k++){ let x,z; if(near){ const a=r()*TAU, d=4+r()*near[2]; x=near[0]+Math.cos(a)*d; z=near[1]+Math.sin(a)*d; } else { const a=r()*TAU, d=Math.sqrt(r())*56*SC; x=Math.cos(a)*d; z=Math.sin(a)*d; }
    const h=layoutPhase?baseHeight(x,z):rawHeight(x,z); if(h>minH && h<maxH && isFree(x,z,rad) && pathDist(x,z)>1.6 && !onDock(x,z) && !onBridge(x,z) && polyDist(x,z,RIVER)>4.6 && Math.hypot(x-POND.x,z-POND.z)>7.5 && (layoutPhase || (!inRects(x,z,rad+0.5) && !inLotZone(x,z,rad)))) return [x,z]; }
  return null;
}

/* ---------- Rooms ---------- */
const HOME_ROOM = { floor:0xc99a6a, wall:0xfff0d8, pattern:'stripe', accent:0x6a9ad8 };
// Living details on furniture (see furn.js). Skipped when hidden or far from the camera.
const _av=new THREE.Vector3();
function runAnims(m, root, t, dt){ const f=m.userData.flame; if(f){ f.scale.set(1+Math.sin(t*13)*0.08, 1+Math.sin(t*17+1)*0.15, 1+Math.cos(t*11)*0.08); }
  const A=m.userData.anims; if (!A) return; let o=root; while(o){ if(!o.visible) return; o=o.parent; } root.getWorldPosition(_av); if (_av.distanceToSquared(camera.position)>900) return; for (const fn of A) fn(t, Math.min(dt,0.1)); }
class Decor extends Ent { constructor(b,x,z,rot){ const it=ITEMS[b]||{r:DECOR_R[b]||0.6}; super('decor',x,z,it.r||0.6); this.solid=!it.flat; const g=new THREE.Group(); FURN_BUILDERS[b](g); g.rotation.y=rot||0; this.attach(g); pickList.splice(pickList.indexOf(this.obj),1); } update(dt,t){ runAnims(this.obj, this.obj, t, dt); } }
function makeRoom(id, idx, spec, W, D, exit){
  const [ox,oz]=roomOrigin(idx); const container=new THREE.Group(); container.visible=false; scene.add(container);
  const shell=buildRoom(spec,W,D); shell.position.set(ox,0,oz); container.add(shell);
  const R=ROOMS[id]={ id, ox, oz, w:W, d:D, group:container, shell, spec, entry:[ox, oz+D/2-1.2], exit, bed:[ox-2,oz-2] };
  for (const [b,x,z,rot] of (spec.items||[])){ new Decor(b, ox+x, oz+z, rot); if(b==='bed') R.bed=[ox+x, oz+z]; }
  return R;
}
const DECOR_R = { counter:1.25, shelfstock:0.95, seedtable:1.15 };
// The player's home: one interior per floor ('home', 'home2', 'home3', 'home4'), each in its own spot far from the island
const HOME_IDS=['home','home2','home3','home4'], HOME_SLOT=[0,13,14,15];
const homeFloorOf = id => HOME_IDS.indexOf(id);   // -1 if not a home floor
function rebuildHomeRoom(home=S.home){ for (let n=0;n<NFLOORS;n++) rebuildFloor(home, n); placeStairs(home); }
function rebuildFloor(home, n){
  if (n===true) n=1; else if (n===false) n=0;
  const id = HOME_IDS[n], [gx,gz]=roomOrigin(HOME_SLOT[n]); let R=ROOMS[id];
  if (n>0 && !(home.built && floorHas(home.plan,n) && n<=topFloor(home.plan))){ if (R){ if (R.shell) R.group.remove(R.shell); R.shell=null; R.ox=gx; R.oz=gz; R.w=0; R.d=0; R.walk=()=>false; R.stairsUp=R.stairsDown=null; } return; }
  if (!R){ const container=new THREE.Group(); container.visible=false; scene.add(container); R=ROOMS[id]={ id, group:container, bed:[gx-2,gz-2], exit:[0,0], floor:n }; if (n>0) R.exit=null; }
  if (R.shell){ R.group.remove(R.shell); R.shell.traverse(o=>{ if (o.isPointLight) o.dispose && o.dispose(); }); }
  if (!home.built){ const W=6, D=6; R.shell=buildRoom(HOME_ROOM,W,D); R.shell.position.set(gx,0,gz); Object.assign(R,{ ox:gx, oz:gz, w:W, d:D, entry:[gx,gz+D/2-1.2], walk:null, exitCheck:null, walls:null, stairsUp:null, stairsDown:null }); }
  else {
    const sh=buildHomeInterior(home, n); sh.position.set(gx,0,gz); const u=sh.userData, bb=u.bbox, occ=u.occ;
    const segs=u.segs.map(q=>[q[0]+gx,q[1]+gz,q[2]+gx,q[3]+gz]); const dr=[u.door[0]+gx, u.door[1]+gz];
    const at=p=>p?[p[0]+gx,p[1]+gz]:null;
    Object.assign(R,{ shell:sh, ox:gx+(bb[0]+bb[2])/2, oz:gz+(bb[1]+bb[3])/2, w:bb[2]-bb[0], d:bb[3]-bb[1], entry:n?null:[dr[0], dr[1]-1.1], walls:u.walls, gz, gx, cutState:null, stairsUp:at(u.stairsUp), stairsDown:at(u.stairsDown), floor:n,
      walk:(x,z)=>{ const [i,j]=cellInside(x-gx, z-gz); if(!(occ[j]?.[i]>=0)) return false; for(const q of segs){ if(segDist(x,z,q[0],q[1],q[2],q[3])<0.33) return false; } return true; },
      exitCheck: n ? (()=>false) : (x,z)=>z>dr[1]-0.42 && Math.abs(x-dr[0])<0.75 });
  }
  R.group.add(R.shell);
}
/* Stairs: walk up to them and press the action button to go to the next floor up or down */
class Stairs extends Ent {
  constructor(x,z,down,floor){ super('stairs',x,z,0.95); this.down=down; this.floor=floor; this.solid=!down; this.reach=1.9; this.attach(buildStairs(down)); }
  label(){ return this.down ? 'Go down' : 'Go up'; }
  act(){ const to = HOME_IDS[this.floor + (this.down?-1:1)], R=ROOMS[to]; const spot = R && (this.down ? R.stairsUp : R.stairsDown); if (!spot) return; Snd.door();
    fade(()=>{ World.inside=to; for(const k in ROOMS) ROOMS[k].group.visible=(k===to); stopMove();
      let p=null; for (const [ox,oz] of [[0,2.0],[0,-2.0],[2.0,0],[-2.0,0],[1.6,1.6],[-1.6,1.6],[1.6,-1.6],[-1.6,-1.6]]){ const x=spot[0]+ox, z=spot[1]+oz; if (walkable(x,z) && !blocked(x,z,0.35)){ p=[x,z]; break; } }
      p=p||spot; player.pos.set(p[0],0,p[1]); camTarget.copy(player.pos); R.cutState=null; updateSky(); updateCamera(1); }); }
}
let stairEnts=[];
function placeStairs(home){ for (const e of stairEnts) e.remove(); stairEnts=[]; if (!home.built || !hasUpstairs(home.plan)) return;
  HOME_IDS.forEach((id,n)=>{ const R=ROOMS[id]; if (!R || !R.shell) return; if (R.stairsUp) stairEnts.push(new Stairs(R.stairsUp[0], R.stairsUp[1], false, n)); if (R.stairsDown) stairEnts.push(new Stairs(R.stairsDown[0], R.stairsDown[1], true, n)); }); }
// Walls between you and the camera drop down so you can see into every room (like a dollhouse).
// Works for any camera direction: a wall drops when it faces the camera and sits between you and the camera.
const _wv=new THREE.Vector3();
function updateCutaway(){
  if (!World.inside) return; const R=ROOMS[World.inside]; if (!R) return;
  const yaw = buildMode ? buildMode.yaw : camYaw, cx=Math.sin(yaw), cz=Math.cos(yaw);
  const ref = buildMode ? camTarget : player.pos;
  const key=Math.round(ref.x*4)+','+Math.round(ref.z*4)+','+Math.round(yaw*20); if (R.cutState===key) return; R.cutState=key;
  if (R.walls){   // the player's own house
    for (const w of R.walls){
      if (w.cx===undefined){ let sx=0,sz=0; for(const m of w.meshes){ m.getWorldPosition(_wv); sx+=_wv.x; sz+=_wv.z; } w.cx=sx/Math.max(1,w.meshes.length); w.cz=sz/Math.max(1,w.meshes.length); }
      const facing = w.horiz ? Math.abs(cz)>0.42 : Math.abs(cx)>0.42;
      const ahead = (w.cx-ref.x)*cx + (w.cz-ref.z)*cz;
      const low = facing && ahead > 0.3 && (w.horiz ? Math.abs(w.cz-ref.z)>0.2 : Math.abs(w.cx-ref.x)>0.2);
      for(const m of w.meshes) m.scale.y = low?0.15:1; for(const l of w.lintels) l.visible=!low; }
  }
  const cw = R.shell && R.shell.userData.cutWalls;   // shops, museum, neighbors' homes
  if (cw) for (const w of cw){ const low = w.nx*cx + w.nz*cz > 0.35; for (const m of w.meshes) m.scale.y = low?0.12:1; for (const m of (w.hide||[])) m.visible=!low; }
}

/* ---------- Buildings ---------- */
const HOUSE_R=[1.9,2.6,3.1,3.9];
let houseEnt=null; const residentHomes=[];
function doorOf(ent){ const s=ent.obj.userData.size||{D:3.4}; return [ent.pos.x, ent.pos.z+s.D/2+1.3]; }
function setRects(owner, list){ for(let i=RECTS.length-1;i>=0;i--) if(RECTS[i][4]===owner) RECTS.splice(i,1); for(const q of list) RECTS.push([q[0],q[1],q[2],q[3],owner]); }
const lotRect = () => { const { LW:GW, LD:GD, EC }=BUILD; return [LOT.x-GW*EC/2, LOT.z-GD*EC/2, LOT.x+GW*EC/2, LOT.z+GD*EC/2+2.2]; };
const inLotZone = (x,z,m=1) => { const q=lotRect(); return x>q[0]-m && x<q[2]+m && z>q[1]-m && z<q[3]+m; };
// Put a building model so its door faces the path. The entity sits at the door; the walls are solid rectangles.
function placeBuilding(kind, cx, cz, model, label, act){
  const u=model.userData, dx=cx+u.door[0], dz=cz+u.door[1]+(u.porchD||0)+0.9;
  const wrap=new THREE.Group(); model.position.set(cx-dx, groundY(cx,cz)-groundY(dx,dz), cz-dz); wrap.add(model);
  if (u.chimney) wrap.userData.chimney=u.chimney.clone().add(model.position);
  const b=new Building(kind, dx, dz, 0.4, wrap, label, act); b.solid=false; b.reach=1.6; b.doorPt=[dx,dz]; b.model=model;
  setRects(kind, u.rects.map(q=>[q[0]+cx,q[1]+cz,q[2]+cx,q[3]+cz]));
  return b;
}
function buildPlayerHouse(home=S.home){
  if (houseEnt) houseEnt.remove(); setRects('home',[]);
  if (!home.built){ const [x,z]=PLACES.home; houseEnt=new Building('home',x,z,1.9,buildHouse(0),'Enter',()=>enterRoom('home')); houseEnt.doorPt=[x,z+3.0]; }
  else { houseEnt=placeBuilding('home', LOT.x, LOT.z, buildCustomHouse(home), 'Enter', ()=>enterRoom('home')); }
  if (ROOMS.home) ROOMS.home.exit=[houseEnt.doorPt[0], houseEnt.doorPt[1]+0.2];
  refreshSmoke();
}
if (!TRIP){ rebuildHomeRoom(); buildPlayerHouse(); }
const ROOF=[0xe0745a,0x7a9a5a,0x9a7ab8,0x4a7ad8,0xe88aa8,0x2a5a4a,0xd8b04a];
/* ---------- Neighbors' homes, and plots for neighbors still on the way ---------- */
const plotEnts={};
function buildResidentHome(R){
  const i=RESIDENTS.indexOf(R), obj=buildCottage(R.id, { roofC:ROOF[i%ROOF.length], accent:R.room.accent });
  const b=new Building('rhome',R.home[0],R.home[1],HOUSE_R[1],obj,()=>{ const res=residents&&residents.find(x=>x.spec.id===R.id); return res&&res.loc==='in'?'Enter':'Knock'; },()=>{
    const res=residents.find(x=>x.spec.id===R.id); Snd.door();
    if (res.loc==='in'){ enterRoom(R.id); if(res.asleep) setTimeout(()=>toast(`Shh... ${R.name} is fast asleep.`),500); }
    else toast(`Nobody's home. ${R.name} must be out and about.`); });
  residentHomes.push(b); if (!ROOMS[R.id]) makeRoom(R.id, i<7 ? i+1 : 21+(i-7), R.room, 8, 7, doorOf(b)); else ROOMS[R.id].exit=doorOf(b);
  return b;
}
function buildPlotEnt(R){
  if (plotEnts[R.id]) plotEnts[R.id].remove(); const soon = S.town.next && S.town.next.id===R.id;
  plotEnts[R.id]=new Building('plot', R.home[0], R.home[1], 0.9, buildPlot(soon), 'Read', ()=>{
    if (S.town.next && S.town.next.id===R.id) toast(`Someone is moving in here ${dayNum(S.town.next.day)<=dayNum(today())+0?'today':'tomorrow'}!`, null, 'new');
    else toast('An empty plot.'); });
  plotEnts[R.id].solid=false;
}
for (const R of RESIDENTS){ if (!R.home || TRIP) continue; if (livesHere(R.id)) buildResidentHome(R); else buildPlotEnt(R); }
const board = TRIP ? null : new Building('board',PLACES.board[0],PLACES.board[1],1.1,buildBoard(),'Read',()=>openBoard());

/* ---------- Shops and museum ---------- */
const shopOpen = id => { const h=SHOPS[id]?.hours; return !h || inHours(Time.hour(), h); };
const shopTier = id => S.shops[id]?.tier||0;
class Keeper extends Ent {
  constructor(spec, x, z, onTalk){ super('keeper',x,z,0.45); this.spec=spec; this.onTalk=onTalk; this.solid=true; this.reach=2.6; this.attach((spec.build||buildKeeper)(spec)); this.hitSphere(0.9,1.0); this.face=0; }
  label(){ return 'Talk'; }
  act(){ Snd.pop(); this.onTalk(this); }
  update(dt,t){ const u=this.obj.userData; jelly(this.obj, this.jel=this.jel||{}, dt, false, t); u.head.rotation.z=Math.sin(t*1.3)*0.06;
    const d=Math.hypot(player.pos.x-this.pos.x, player.pos.z-this.pos.z);
    // stand keepers potter about: turn to tidy the stand now and then, with a little bob, then look out at the road
    if (this.work && d>=7){ this.workT=(this.workT||0)-dt; if (this.workT<=0){ this.tidy=!this.tidy; this.workT=this.tidy?2.2+Math.random()*2:3+Math.random()*4; }
      this.rest = this.tidy ? this.work : 0; if (this.tidy && Math.sin(t*5)>0.97) (this.jel=this.jel||{}).v=(this.jel.v||0)-0.6; }
    const want = d<7 ? Math.atan2(player.pos.x-this.pos.x, player.pos.z-this.pos.z) : (this.rest||0);
    let df=want-this.obj.rotation.y; df=Math.atan2(Math.sin(df),Math.cos(df)); this.obj.rotation.y+=df*Math.min(1,dt*5); }
}
const keeperLine = (k, key) => { const v=KEEPERS[k][key]; return Array.isArray(v) ? v[Math.floor(Math.random()*v.length)] : v; };
// Tear down a room's furniture and entities so it can be rebuilt at a new size
function clearRoom(id){ const R=ROOMS[id]; if (!R) return; for (const e of ents.slice()) if (!(e instanceof Resident) && e.pos.x>500 && roomAt(e.pos.x,e.pos.z)===R && !(e instanceof Furniture)) e.remove(); scene.remove(R.group); delete ROOMS[id]; }

/* Pemberton's general store: a real shop. Today's furniture sits on display stands and shelves; walk up and buy.
   Talk to Pemberton for tools, bags, the garden counter, selling and investing. The room grows with each investment. */
const STORE_SIZE=[[10,8],[11,8.5],[13,9.5],[15,10.5]];
let storeEnt=null, pemberton=null;
class ShopItem extends Ent {
  constructor(list, i, id, x, z, onShelf){ super('shopitem',x,z,0.35); this.list=list; this.i=i; this.id=id; this.reach=onShelf?2.1:1.7; this.solid=false;
    const g=new THREE.Group(), m=buildItemModel(id), it=ITEMS[id]; m.scale.setScalar(it.kind==='furniture'?(onShelf?0.42:0.62):0.7); m.position.y=onShelf?0:0.62; g.add(m); this.m=m;
    if (!onShelf){ mk(G.cyl(0.42,0.46,0.6,14), M(0xe8dcc4), 0,0.3,0,g); mk(G.cyl(0.46,0.46,0.04,14), M(0xc99a6a), 0,0.61,0,g); }
    if (isRarePiece(id)){ const lab=rarityLabel(it.rarity); this.aura=addAura(g, RARITY_COLORS[lab], onShelf?0.3:1.1, lab==='Very rare'?2.2:1.6); if (!onShelf) mk(G.tor(0.47,0.025,8,32), M(parseInt(RARITY_COLORS[lab].slice(1),16),{metalness:0.5,roughness:0.3}), 0,0.62,0,g).rotation.x=Math.PI/2; }
    this.attach(g); this.hitSphere(0.55, onShelf?0.25:0.9); this.refresh(); }
  get sold(){ return this.list==='garden' ? !!S.day.gsold[this.i] : isSold('stall', this.id, this.i); }
  refresh(){ this.m.visible=!this.sold; }
  label(){ return this.sold ? null : 'Look'; }
  act(){ if (this.sold) return; const it=ITEMS[this.id], price=buyPrice('stall', it), k=KEEPERS.pemberton;
    const rl=isRarePiece(this.id)?rarityLabel(it.rarity):null;
    dialog(k.name, k.voice, [rl ? `Ah, the ${it.name}. ${rl==='Very rare'?'I\'ve only had one of these through the door once before.':'That one\'s rare. I don\'t get many.'} ${fmt(price)} clams.` : `Ah, the ${it.name}. ${fmt(price)} clams${it.kind==='seed'?', and it grows wherever there\'s grass':''}.`], null, [
      { label:`Buy it (${fmt(price)})`, fn:()=>{ if (S.clams<price){ toast('Not enough clams.'); Snd.fail(); return; } if (!canAdd(this.id)){ toast('Your bag is full.'); return; }
          S.clams-=price; if (this.list==='garden') S.day.gsold[this.i]=true; else markSold('stall', this.id, this.i); addTrade('stall',price); const r=addItem(this.id); Snd.coin(); updateHUD(); itemToast(this.id, r==='new', 'Bought'); this.refresh(); save(); } },
      { label:'Just looking', alt:true, fn:()=>{} } ]); }
  update(dt,t){ if (!this.m.visible) return; this.m.rotation.y=Math.sin(t*0.6+this.i)*0.4; runAnims(this.m, this.obj, t, dt); if (this.aura) this.aura(t,dt); }
}
function buildStoreAll(){
  const t=shopTier('general'), [W,D]=STORE_SIZE[t];
  if (storeEnt) storeEnt.remove(); setRects('shop',[]);
  storeEnt=placeBuilding('shop', PLACES.shop[0], PLACES.shop[1], buildStore(t), 'Enter', ()=>enterRoom('store'));
  clearRoom('store');
  const items=[['counter',0,-D/2+1.5,0],['rug',0,0.8,0],['seedtable',-W/2+2.0,D/2-2.0,0],['plant',-W/2+0.8,D/2-1.2,0],['plant',W/2-0.8,D/2-1.2,0]];
  for (let k=0;k<Math.min(4,2+t);k++) items.push(['shelfstock', k%2?W/2-0.6:-W/2+0.6, -D/2+1.6+Math.floor(k/2)*2.2, k%2?-Math.PI/2:Math.PI/2]);
  if (t>=2) items.push(['grandfather', -W/2+0.7, -D/2+0.6, 0]); if (t>=3) items.push(['lantern', W/2-0.7, -D/2+0.6, 0]);
  const R=makeRoom('store', 10, { floor:0xc8a070, wall:0xfff4dc, pattern:'stripe', accent:0x6a8a4a, items }, W, D, [storeEnt.doorPt[0], storeEnt.doorPt[1]+0.2]);
  pemberton=new Keeper(KEEPERS.pemberton, R.ox, R.oz-D/2+0.8, ()=>talkShop('general'));
  refreshStoreItems();
  // the Home Goods rack (added once the rest of the game has loaded, since it reads the house style lists)
  setTimeout(()=>{ if (ROOMS.store!==R) return; if (homeRack && !homeRack.removed) homeRack.remove(); homeRack=new HomeRack(R.ox+W/2-2.0, R.oz+D/2-2.1); }, 0);
}
// today's furniture on display stands, seeds laid out on a low table by the door
function refreshStoreItems(){
  const R=ROOMS.store; if (!R) return; for (const e of ents.slice()) if (e instanceof ShopItem) e.remove();
  const W=R.w, D=R.d, stock=shopStock('stall'), cols=Math.min(4, Math.ceil(stock.length/2)), sx=Math.min(2.2,(W-3.6)/Math.max(1,cols-1));
  stock.forEach((id,i)=>{ const c=i%cols, r=Math.floor(i/cols); new ShopItem('stall', i, id, R.ox+(c-(cols-1)/2)*sx, R.oz-D/2+3.3+r*1.8, false); });
  (S.day.garden||[]).forEach((id,i)=>{ const e=new ShopItem('garden', i, id, R.ox-W/2+1.3+(i%3)*0.7, R.oz+D/2-2.3+Math.floor(i/3)*0.6, true); e.obj.position.y=0.62; });
  if (!ents.some(e=>e instanceof SeedBin)) new SeedBin(R.ox-W/2+0.7, R.oz+D/2-3.3);
}
// v1.8: the seed bin holds this island's own seeds, always in stock
class SeedBin extends Ent { constructor(x,z){ super('seedbin',x,z,0.5); this.solid=true; this.reach=1.5; const g=new THREE.Group(); FURN_BUILDERS.seedbin(g); g.rotation.y=Math.PI/2; this.attach(g); this.hitSphere(0.6,0.5); }
  label(){ return 'Look'; } act(){ openShop('stall','garden'); } }

/* Specialist shops start as a market stand by the road. Back one (invest) and they build a real storefront you walk into. */
const SHOP_ROOMS = {
  aquarium:{ idx:8, W:8, D:7, spec:{ floor:0x9ab8c0, wall:0xe0f4f6, pattern:'stripe', accent:0x2f6ab0, items:[['counter',0,-1.9,0],['fishtank',-2.9,-2.8,0],['bigtank',2.2,-2.9,0],['shelfstock',-3.4,0.6,Math.PI/2],['anchor',3.2,0.9,-0.4],['lifering',3.4,-0.8,-Math.PI/2],['buoylamp',-3.3,2.4,0],['rug',0,1.0,0]] } },
  garden:{ idx:9, W:8, D:7, spec:{ floor:0x9a7a5a, wall:0xeef6e0, pattern:'dots', accent:0x7cb85a, items:[['counter',0,-1.9,0],['terrarium',-2.9,-2.8,0],['planter',2.4,-2.9,0],['shelfstock',-3.4,0.6,Math.PI/2],['skep',3.2,0.9,0],['plant',3.3,-0.8,0],['monstera',-3.3,2.4,0],['butterflyframe',2.9,2.3,-0.5]] } },
};
const shopEnts={}, shopKeepers={};
function buildShop(id){
  if (shopEnts[id]) shopEnts[id].remove(); if (shopKeepers[id]){ shopKeepers[id].remove(); shopKeepers[id]=null; } setRects(id,[]); clearRoom(id);
  const t=shopTier(id), k=KEEPERS[SHOPS[id].keeper], [px,pz]=PLACES[id];
  if (t===0){   // a stand: shop right there at the counter
    const st=buildStand(id, !shopOpen(id));
    shopEnts[id]=placeBuilding(id, px, pz+1.2, st, ()=>shopOpen(id)?'Shop':'Closed', ()=>{ if (!shopOpen(id)){ toast(k.closed); Snd.fail(); return; } talkShop(id); });
    shopEnts[id].standOpen=shopOpen(id);
    // the keeper stands beside the counter on the road side, so you can see them from the path
    if (shopOpen(id)){ let kx=px+2.05, kz=pz+1.75; if (!walkable(kx,kz) || blocked(kx,kz,0.4)){ kx=px-2.05; }
      const kp=shopKeepers[id]=new Keeper(k, kx, kz, ()=>talkShop(id)); kp.rest=0; kp.work=Math.atan2(px-kx, pz+1.2-kz); }
    return; }
  shopEnts[id]=placeBuilding(id, px, pz, buildShopBuilding(id, t), ()=>shopOpen(id)?'Enter':'Closed',
    ()=>{ if (!shopOpen(id)){ toast(k.closed); Snd.fail(); return; } enterRoom(id); });
  const SR=SHOP_ROOMS[id]; const R=makeRoom(id, SR.idx, SR.spec, SR.W, SR.D, [shopEnts[id].doorPt[0], shopEnts[id].doorPt[1]+0.2]);
  shopKeepers[id]=new Keeper(k, R.ox, R.oz-2.7, ()=>talkShop(id));
}
// a stand closes up for the night (and opens in the morning)
function refreshStands(){ for (const id of ['aquarium','garden']) if (shopTier(id)===0 && shopEnts[id] && shopEnts[id].standOpen!==shopOpen(id) && World.inside!==id) buildShop(id); }

/* The museum starts as one small room and each section grows on its own once it runs out of room (v1.22):
   - fish and bugs share one tank each (8 spaces) until it overflows; then that section gets its own wing with one
     themed tank per group, and later a new tank whenever a group with no tank yet gets its first donation
   - fossils: 3 pedestals in the main room, then a Fossil Hall with 6, then a second row for the rest
   - beach finds: a small case of 4, then a long case of 8
   A donation that doesn't fit waits in the back room; the builders make room overnight. */
const _ord = Object.fromEntries(Object.keys(ITEMS).map((k,i)=>[k,i]));
function donatedOf(kind){ return Object.keys(S.museum.items).filter(id=>ITEMS[id] && ITEMS[id].kind===kind).sort((a,b)=>(S.museum.items[a]-S.museum.items[b]) || (_ord[a]-_ord[b])); }
const tankGid = id => (tankOf(id)||{}).id;
const sortGroups = (k, ids) => TANK_GROUPS[k].map(g=>g.id).filter(g=>ids.includes(g));
function museumFitState(){   // the smallest museum that shows everything already donated (islands from before v1.22)
  const st={}; for (const k of ['fish','bug']){ const d=donatedOf(k); st[k] = d.length<=MIX_GROUPS[k].slots ? null : sortGroups(k, d.map(tankGid)); }
  const nf=donatedOf('fossil').length; st.fossil = nf<=FOSSIL_CAP[0]?0 : nf<=FOSSIL_CAP[1]?1 : 2; st.shell = donatedOf('shell').length<=SHELL_CAP[0]?0:1; return st; }
if (!S.museum.st) S.museum.st=museumFitState();
function onDisplay(kind){ const st=S.museum.st, d=donatedOf(kind);
  if (kind==='fish'||kind==='bug') return st[kind] ? d.filter(id=>st[kind].includes(tankGid(id))) : d.slice(0, MIX_GROUPS[kind].slots);
  if (kind==='fossil') return st.fossil>=2 ? d : d.slice(0, FOSSIL_CAP[st.fossil]);
  return d.slice(0, SHELL_CAP[st.shell]); }
const museumNeeds = () => MUSEUM.kinds.filter(k=>onDisplay(k).length<donatedOf(k).length);
const inStorage = () => MUSEUM.kinds.reduce((n,k)=>n+donatedOf(k).length-onDisplay(k).length, 0);
const museumTierNow = () => { const st=S.museum.st; return Math.min(3, (st.fish?1:0)+(st.bug?1:0)+(st.fossil?1:0)); };
const tankName = (k,g) => (TANK_GROUPS[k].find(x=>x.id===g)||{}).name;
// What the builders will do tonight, in words (for Professor Thistle)
function museumPlans(){ const st=S.museum.st, out=[];
  for (const k of museumNeeds()){
    if (k==='fish'||k==='bug'){ const nm=k==='fish'?'Aquarium':'Insectarium';
      if (!st[k]) out.push(`a proper ${nm} wing with a tank for each kind of ${k==='fish'?'fish':'bug'}`);
      else { const add=sortGroups(k, donatedOf(k).map(tankGid)).filter(g=>!st[k].includes(g)); out.push(`a new ${add.map(g=>tankName(k,g)).join(' and ')} ${k==='fish'?'tank':'terrarium'} in the ${nm}`); } }
    if (k==='fossil') out.push(st.fossil===0 ? 'a Fossil Hall across the back' : 'a second row of pedestals in the Fossil Hall');
    if (k==='shell') out.push('a bigger case for the beach finds'); }
  return out; }
function museumExpand(){ const st=S.museum.st, plans=museumPlans();
  for (const k of museumNeeds()){
    if (k==='fish'||k==='bug') st[k]=sortGroups(k, [...(st[k]||[]), ...donatedOf(k).map(tankGid)]);
    if (k==='fossil'){ st.fossil++; while (st.fossil<2 && FOSSIL_CAP[st.fossil]<donatedOf('fossil').length) st.fossil++; }
    if (k==='shell') st.shell=1; }
  S.museum.tier=Math.max(S.museum.tier||0, museumTierNow()); return plans; }
if (S.museum.tier===undefined) S.museum.tier=museumTierNow();
const museumKey = () => JSON.stringify(S.museum.st)+'|'+S.museum.tier;
let museumEnt=null, thistle=null;
const museumRoom=()=>ROOMS.museum;
function buildMuseumAll(){
  const t=S.museum.tier, LY=museumLayout(S.museum.st, donatedOf('fossil').length), W=LY.W, D=LY.D;
  if (museumEnt) museumEnt.remove(); setRects('museum',[]); clearMuseumEnts();
  museumEnt=placeBuilding('museum', PLACES.museum[0], PLACES.museum[1], buildMuseumTier(t), 'Enter', ()=>enterRoom('museum')); museumEnt.tier=t; museumEnt.key=museumKey();
  clearRoom('museum');
  const [ox,oz]=roomOrigin(11), container=new THREE.Group(); container.visible=false; scene.add(container);
  const shell=buildMuseumHall(LY); shell.position.set(ox,0,oz); container.add(shell);
  const put=(m,x,z,ry=0)=>{ m.position.set(ox+x,0,oz+z); m.rotation.y=ry; container.add(m); return m; };
  put(buildDesk(), LY.desk[0], LY.desk[1], Math.PI);
  for (const [x,z,ry] of LY.benches) put(buildBench(), x, z, ry);
  for (const [x,z] of LY.plants) put(buildPalm(), x, z);
  put(buildShellCase(LY.shells.len, LY.shells.slots), LY.shells.x, LY.shells.z);
  if (LY.center) put(buildCenterpiece(t), LY.center.x, LY.center.z);
  ROOMS.museum={ id:'museum', ox, oz, w:W, d:D, group:container, shell, spec:{ mood:'museum' }, layout:LY, entry:[ox, oz+D/2-1.2], exit:[museumEnt.doorPt[0], museumEnt.doorPt[1]+0.2], bed:[ox,oz],
    walk:(x,z)=>{ const lx=x-ox, lz=z-oz; if (!(Math.abs(lx)<W/2-0.4 && lz>-D/2+0.4 && lz<D/2-0.05)) return false; for (const b of LY.blocks) if (lx>b[0]-0.28 && lx<b[2]+0.28 && lz>b[1]-0.28 && lz<b[3]+0.28) return false; return true; } };
  thistle=new Keeper(KEEPERS.thistle, ox+LY.keeper[0], oz+LY.keeper[1], ()=>talkCurator());
  if (typeof spawnExhibits==='function') spawnExhibits();
}

// Keep room around every building for the biggest it can grow, so trees never end up inside a bigger version later
KEEPOUT.push([PLACES.museum[0], PLACES.museum[1]+0.5, 8.4], [PLACES.shop[0], PLACES.shop[1], 4.8], [PLACES.aquarium[0], PLACES.aquarium[1], 5.9], [PLACES.garden[0], PLACES.garden[1], 6.1]);
if (PLACES.hall) KEEPOUT.push([PLACES.hall[0], PLACES.hall[1]+0.6, HALL_FOOT+0.6]);
if (PLACES.portal) KEEPOUT.push([PLACES.portal[0], PLACES.portal[1]+0.4, PORT_FOOT+0.8]);
for (const R of RESIDENTS) if (!isOrig(R.id) && R.home) KEEPOUT.push([R.home[0], R.home[1]+0.6, 4.4]);
// Shops, museum and town hall go up once the day is set (the store shelves need today's stock)
function initTownBuildings(){ buildStoreAll(); for (const id of ['aquarium','garden']) buildShop(id); buildMuseumAll(); buildHall(); buildPlaza(); refreshSmoke(); }
let rebuildOnExit={};   // a shop you're standing in is rebuilt when you step outside
function rebuildPlace(id){ const room = id==='general'?'store':id; if (World.inside===room){ rebuildOnExit[id]=true; return; }
  if (id==='general') buildStoreAll(); else if (id==='museum') buildMuseumAll(); else buildShop(id); }

/* ---------- Town hall ---------- */
const HALL_COST=[0,60000,220000], HALL_NEED=[null,{ house:true },{ museum:1, shops:1 }];
let hallEnt=null, clerk=null;
function buildHall(){
  if (hallEnt){ hallEnt.remove(); hallEnt=null; } if (clerk){ clerk.remove(); clerk=null; } setRects('hall',[]);
  if (!PLACES.hall) return;
  const [hx,hz]=PLACES.hall, t=S.town.hall||0;
  hallEnt=placeBuilding('hall', hx, hz, buildTownHall(t), 'Read', ()=>talkHall());
  const [dx,dz]=hallEnt.doorPt; clerk=new Keeper(KEEPERS.clementine, dx+(t===0?1.9:1.6), dz-(t===0?0.6:0.3), ()=>talkHall()); clerk.rest=0; hallEnt.tier=t;
}
const HALL_NAMES=['Town Tent','Town Hall','Grand Town Hall'];
/* v1.26: nobody new moves in while the town is just a tent. Once the town hall is built, newcomers turn up every few
   days (at least MOVE_GAP days after the last one, then a coin flip each day) until 10 islanders live here.
   You can ask an islander to move away as long as at least MIN_RES stay. Someone who left won't come back for a month. */
const MOVE_GAP=2, MOVE_DAILY=0.5, TOWN_MAX=10, MIN_RES=5, RETURN_DAYS=30;
const townCap = () => (S.town.hall||0)>=1 ? TOWN_MAX : Math.max(START_RES.length, Math.min(TOWN_MAX, S.town.res.length));
// A spot for a newcomer's house: dry, fairly flat, clear of buildings, paths, gardens and anything you planted or placed
function findHomeSpot(id){
  const r=mulberry32(hashStr(id+':home:'+S.seed)), FOOT=3.6;
  for (let k=0;k<3000;k++){ const a=r()*TAU, d=(12+r()*30)*Math.min(SC,1.3)+k*0.004, x=Math.cos(a)*d, z=Math.sin(a)*d;
    if (Math.hypot(x,z)/islandR(a)>0.74 || polyDist(x,z,RIVER)<8 || Math.hypot(x-POND.x,z-POND.z)<POND.r+7 || nearFall(x,z,5)) continue;
    if (x>DOCK.x0-12 && Math.abs(z-DOCK.z)<10) continue;
    if (Math.abs(x-LOT.x)<BUILD.LW*BUILD.EC/2+6 && Math.abs(z-LOT.z)<BUILD.LD*BUILD.EC/2+7) continue;
    if (Object.entries(PLACES).some(([kk,p])=>p && kk!=='board' && Math.hypot(x-p[0],z-p[1]) < (kk==='plaza'?10:kk==='museum'?10.5:kk==='hall'?HALL_FOOT+5.5:8.5))) continue;
    if (visPathDist(x,z)<2.2 || visPathDist(x,z+3.2)<1.2) continue;
    let bad=false, lo=99, hi=-99; for (let i=0;i<=12;i++){ const aa=i/12*TAU, rr=i===12?0:FOOT, px=x+Math.cos(aa)*rr, pz=z+Math.sin(aa)*rr, h=rawHeight(px,pz);
      if (h<0.65 || !walkable(px,pz) || gardenAtXZ(px,pz) || inRects(px,pz,0.2)){ bad=true; break; } lo=Math.min(lo,h); hi=Math.max(hi,h); }
    if (bad || hi-lo>1.1 || !walkable(x,z+FOOT+1.5)) continue;
    if (S.plants.some(q=>!q.wild && Math.hypot(q.x-x,q.z-z)<FOOT+1.2) || S.placed.some(q=>q.x<500 && Math.hypot(q.x-x,q.z-z)<FOOT+1.2)) continue;
    if (ents.some(e=>!e.removed && e.solid && (e instanceof Building || e instanceof Resident || e instanceof Keeper) && Math.hypot(e.pos.x-x,e.pos.z-z)<FOOT+3)) continue;
    return [+x.toFixed(1), +z.toFixed(1)]; }
  return null; }
// Give a newcomer their spot: clear wild trees and rocks off it and mark it so nothing grows back there
function claimHomeSpot(R, spot){
  R.home=spot.slice(); PLACES[R.id]=spot.slice(); S.town.homes[R.id]=spot.slice(); KEEPOUT.push([spot[0], spot[1]+0.6, 4.4]);
  for (const e of ents.slice()){ if (e.removed) continue; const d=Math.hypot(e.pos.x-spot[0], e.pos.z-spot[1]);
    if (d<4.6 && ((e instanceof Tree && !e.rec) || e instanceof Rock || e instanceof Weed || e instanceof Stump)) e.remove(); } }
const dayKeyOf = n => { const d=new Date(n*864e5); return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0'); };
const daysHere = () => S.town.day0 ? dayNum(today())-dayNum(S.town.day0) : 0;
function hallReqs(t){ const q=HALL_NEED[t]; if (!q) return []; const out=[];
  if (q.res) out.push([`${q.res} islanders living here`, S.town.res.length>=q.res, `${S.town.res.length} of ${q.res}`]);
  if (q.house) out.push(['A house of your own', !!S.home.built, S.home.built?'done':'not yet']);
  if (q.museum) out.push(['The museum outgrows its cottage', (S.museum.tier||0)>=q.museum, (S.museum.tier||0)>=q.museum?'done':'not yet']);
  if (q.shops) out.push(['Back one of the shops', shopsBacked()>=q.shops, `${shopsBacked()} backed`]);
  return out; }
// Called once a day (and when the island loads): neighbors move in, the town hall and museum finish building
function townNewDay(key){
  if (VISIT || TRIP) return; const T=S.town; if (!T.day0) T.day0=key; const now=dayNum(key);
  if (T.next && now>=dayNum(T.next.day)){ const id=T.next.id; if (!T.res.includes(id)) T.res.push(id); T.met[id]=false; T.last=key; T.next=null; T.arrived=id; }
  if (T.leaving && now>=dayNum(T.leaving.day)){ const id=T.leaving.id; T.res=T.res.filter(x=>x!==id); T.left[id]=now; T.leaving=null; T.departed=id; T.last=T.last||key;
    Q.active=Q.active.filter(f=>f.who!==id && f.to!==id); delete Q.offers[id]; }
  if (T.hallPend){ T.hall=Math.min(2,(T.hall||0)+1); T.hallPend=false; T.fund=0; T.hallNews=true; }
  if (S.museum.grow){ const plans=museumExpand(); S.museum.grow=0; if (plans.length) S.museum.grewNews=plans; }
  if (T.next && T.res.length>=townCap()) T.next=null;   // saves from before v1.19 may have someone booked without room
  const ref = Math.max(dayNum(T.day0), T.last ? dayNum(T.last) : 0);
  if (!T.next && T.res.length<townCap() && now-ref>=MOVE_GAP && mulberry32(hashStr(key+':movein:'+S.seed))()<MOVE_DAILY){
    const free=x=>!T.res.includes(x) && !(T.left[x]!==undefined && now-T.left[x]<RETURN_DAYS) && !(T.leaving && T.leaving.id===x);
    const others=RESIDENTS.map(R=>R.id).filter(x=>free(x) && !MOVE_ORDER.includes(x));
    let id=MOVE_ORDER.find(free) || (others.length ? others[hashStr(key+':who:'+S.seed)%others.length] : null);
    if (id){ const R=RESIDENTS.find(x=>x.id===id);
      if (!R.home){ const spot=findHomeSpot(id); if (spot) claimHomeSpot(R, spot); else id=null; }   // no room anywhere: try again another day
      if (id) T.next={ id, day:dayKeyOf(now+1) }; } }
  anonDonation(mulberry32(hashStr(key+':anon:'+S.seed))); museumGrowCheck(); incomeNewDay(now);
}
// Make the world match S.town: new houses and neighbors, plots, the hall and museum after overnight work
function applyTown(){
  for (const R of RESIDENTS){ if (!R.home) continue;
    if (livesHere(R.id)){ if (!residents.some(r=>r.spec.id===R.id)){ if (plotEnts[R.id]){ plotEnts[R.id].remove(); delete plotEnts[R.id]; } buildResidentHome(R); residents.push(new Resident(R)); } }
    else { // moved away: their house and their walking self go, and the plot is empty again
      const ri=residents.findIndex(r=>r.spec.id===R.id); if (ri>=0){ residents[ri].remove(); residents.splice(ri,1); }
      for (let i=residentHomes.length-1;i>=0;i--){ const b=residentHomes[i]; if (!b.removed && Math.hypot(b.pos.x-R.home[0], b.pos.z-R.home[1])<0.5){ b.remove(); residentHomes.splice(i,1); } }
      if (World.inside===R.id) exitRoom();
      buildPlotEnt(R); } }
  if (hallEnt && hallEnt.tier!==(S.town.hall||0)){ buildHall(); buildPlaza(); }
  if (museumEnt && museumEnt.key!==museumKey()) rebuildPlace('museum'); else if (S.museum.news) spawnExhibits();
  refreshSmoke();
  const T=S.town;
  if (T.arrived){ const R=RESIDENTS.find(x=>x.id===T.arrived); T.arrived=null; if (R) setTimeout(()=>toast(`${R.name} moved in today!`, null, 'new'), 2400); }
  refreshIncome();
  if (T.departed){ const R=RESIDENTS.find(x=>x.id===T.departed); T.departed=null; if (R) setTimeout(()=>toast(`${R.name} moved away.`, null, '', 'Their plot is empty now. Someone new may take it.'), 2600); }
  if (T.hallNews){ T.hallNews=false; setTimeout(()=>{ Snd.fanfare(); toast(`The ${HALL_NAMES[T.hall]} is finished!`, null, 'new', T.hall===1?'Newcomers may start to notice the island, and the plaza got flower beds.':'A fountain in the plaza, and Wendell can now make new land.'); }, 3200); }
  if (S.museum.grewNews){ const g=S.museum.grewNews; S.museum.grewNews=false; setTimeout(()=>toast('The museum grew overnight!', null, 'new', Array.isArray(g)?'New: '+g.join(', ')+'.':''), 4000); }
  if (S.museum.news){ const nw=S.museum.news; S.museum.news=null; if (nw.clams) setTimeout(()=>{ Snd.coin(); toast(`+${fmt(nw.clams)} clams`, null, 'new', 'Someone left a donation at the museum. Professor Thistle sent it your way.'); }, 5000); }
  save();
}
/* The plaza gets nicer as the town hall grows: flower beds and benches, then a fountain and lanterns */
const plazaDeco=[];
function buildPlaza(){
  for (const e of plazaDeco) e.remove(); plazaDeco.length=0; const t=S.town.hall||0; if (!t) return;
  const spots=[]; for (let k=0;k<16 && spots.length<(t>=2?6:4);k++){ const a=k/16*TAU+0.2, r=5.4, x=Math.cos(a)*r, z=Math.sin(a)*r;
    if (!walkable(x,z) || visPathDist(x,z)<1.4 || Math.hypot(x-PLACES.board[0],z-PLACES.board[1])<2.6 || inRects(x,z,1) || spots.some(q=>Math.hypot(q[0]-x,q[1]-z)<3)) continue; spots.push([x,z,a]); }
  spots.forEach(([x,z,a],i)=>{ const b = i%2 ? 'bench' : 'planter'; plazaDeco.push(new Decor(b, x, z, -a+Math.PI/2)); });
  if (t>=2){ plazaDeco.push(new Decor('fountain', 0, 0, 0)); for (const [x,z] of [[2.2,2.2],[-2.2,2.2]]) if (walkable(x,z) && visPathDist(x,z)>0.9) plazaDeco.push(new Decor('lantern', x, z, 0)); }
}
function talkHall(){
  const k=KEEPERS.clementine, v=k.voice, T=S.town, t=T.hall||0;
  const menu=()=>dialog(k.name, v, [], null, [
    ...favorChoices(npcOf('clementine'), ()=>menu()),
    { label:'Town projects', fn:()=>openHallPanel() },
    ...(VISIT?[]:[{ label: !S.home.built ? 'A house?' : loanOpen() ? 'Pay my loan' : 'Home loan', fn:()=>talkLoan(menu) }]),
    { label:'New neighbors?', fn:()=>{ const nxt=T.next && RESIDENTS.find(R=>R.id===T.next.id), cap=townCap();
        const lines = nxt ? [`${nxt.name} is moving in ${dayNum(T.next.day)<=dayNum(today())?'today':'tomorrow'}! The boxes are already on the plot.`]
          : T.res.length>=TOWN_MAX ? [`${TOWN_MAX} islanders! Every plot on the island is taken. What a town we have!`]
          : T.res.length>=cap ? (t===0 ? ['Nobody moves to an island whose town hall is a tent, dear.','Fix the place up a bit. Folks hear about that sort of thing.']
              : [`Nobody new is looking at us right now. Every big town project makes the island a little more tempting to newcomers.`])
          : ['Word is getting around about this island. Someone new should turn up in the next few days.'];
        dialog(k.name, v, lines, menu); } },
    { label:'Island news', fn:()=>openBoard() },
    { label:'Bye!', alt:true, fn:()=>{} } ]);
  if (!T.metClerk){ T.metClerk=true; save(); dialog(k.name, v, k.first, menu); return; }
  dialog(k.name, v, [keeperLine('clementine','greet')], menu);
}
function openHallPanel(){
  const render=()=>{ const T=S.town, t=T.hall||0; let h=`<div class="notice"><b>${HALL_NAMES[t]}</b><br><span class="muted">${T.res.length} islanders live here.</span></div>`;
    if (T.hallPend) h+=`<div class="notice"><b>Building the ${HALL_NAMES[t+1]}</b><br>The builders work overnight. Check back tomorrow!</div>`;
    else if (t>=2) h+='<div class="notice">The Grand Town Hall is as grand as it gets. The whole island thanks you!</div>';
    else { const cost=HALL_COST[t+1], rq=hallReqs(t+1), ok=rq.every(r=>r[1]), fund=T.fund||0, left=Math.max(0,cost-fund);
      h+=`<div class="notice"><b>Next: ${HALL_NAMES[t+1]}</b><br><span class="muted">Clementine is saving up for something bigger. Who knows what it'll bring.</span>
        <div style="margin-top:8px"><b>${fmt(fund)}</b> of ${fmt(cost)} clams raised</div><div class="bar" style="margin:6px 0"><div style="width:${Math.min(100,fund/cost*100)}%"></div></div>
        ${left>0?`<div style="display:flex;gap:6px;flex-wrap:wrap">${[1000,10000].map(n=>`<button class="btn alt" data-fund="${n}" ${S.clams<Math.min(n,left)?'disabled':''}>Chip in ${fmt(Math.min(n,left))}</button>`).join('')}<button class="btn" data-fund="${left}" ${S.clams<1?'disabled':''}>Chip in ${fmt(Math.min(left,S.clams))}</button></div>`
          : `<button class="btn" id="hallGo" ${ok?'':'disabled'}>${ok?'Start building':'Fully funded. Clementine says the island isn\'t quite ready for it yet.'}</button>`}</div>`; }
    pBody.innerHTML=h;
    pBody.querySelectorAll('[data-fund]').forEach(b=>b.onclick=()=>{ if (noEdit()) return; const left=HALL_COST[S.town.hall+1]-(S.town.fund||0), n=Math.min(+b.dataset.fund, left, S.clams); if (n<=0) return; S.clams-=n; S.town.fund=(S.town.fund||0)+n; Snd.coin(); updateHUD(); save(); render(); });
    const go=pBody.querySelector('#hallGo'); if (go) go.onclick=()=>{ if (noEdit()) return; S.town.hallPend=true; save(); Snd.fanfare(); toast('The builders start tonight!', null, 'new', `The ${HALL_NAMES[S.town.hall+1]} will be ready tomorrow.`); render(); };
  };
  openPanel('Town Projects'); render();
}
/* =====================================================================
   v1.26: PASSIVE INCOME. Four people you meet around the island, each in their own spot, each something you fund and then
   upgrade over time: a fisherman who lost his boat, a beekeeper, an orchard keeper and a bookkeeper for the shops you back.
   Each one fills up over 3 days and then waits for you. Fish come at the usual odds, so a rare one is still rare.
   ===================================================================== */
const INC_DAYS=3, INC_UPGRADE_WAIT=7;
const INCOME = {
  boat:{ who:'Gill', voice:400, acc:['beanie'], accC:0x3a6ab0, unit:['fish','fish'], hint:'a fisherman sitting by a wrecked rowboat on the beach',
    tiers:[{ name:'Rowboat', cost:30000, per:2 }, { name:'Fishing Sloop', cost:150000, per:4 }, { name:'Trawler', cost:500000, per:7 }],
    meet:['Oh, hey there. Don\'t mind me. Just sitting with what\'s left of my boat.','Storm took her right out from under me. I fished these waters my whole life.',
      'Tell you what. If you bought me a new rowboat, I\'d split the catch with you. A couple of fish a day, and I\'ll keep them in a crate right here.'],
    up:['Business is good! The rowboat\'s doing fine, but she can only carry so much.','Get me a {name} and I could bring in a lot more for you.'] },
  bees:{ who:'Hollis', voice:300, acc:['beanie'], accC:0xe8b020, unit:['honey jar','honey jars'], hint:'a beekeeper out in a quiet meadow',
    tiers:[{ name:'Beehive', cost:20000, per:2 }, { name:'Three Hives', cost:90000, per:5 }, { name:'Apiary', cost:300000, per:9 }],
    meet:['Shh. Careful now. The bees are deciding whether they like you.','I keep bees, or I did. My last hive got blown over and the colony moved on.',
      'Buy me a new hive and I\'ll share the honey. More flowers nearby means more honey, so plant some if you like.'],
    up:['The bees are thriving. They want more room, I think.','A {name} would mean a lot more honey for both of us.'] },
  orchard:{ who:'Russet', voice:520, acc:['headband'], accC:0x7ab04a, unit:['piece of fruit','pieces of fruit'], hint:'an orchard keeper among the fruit trees',
    tiers:[{ name:'Fruit Ladder', cost:20000, per:4 }, { name:'Pony Cart', cost:100000, per:8 }, { name:'Cider Shed', cost:300000, per:14 }],
    meet:['Hello! Just admiring these trees. Somebody ought to be picking them properly.','I used to run an orchard back home. All I need is a good ladder.',
      'Get me one and I\'ll pick fruit while you\'re busy, and keep it in baskets for you.'],
    up:['These trees could give a lot more, you know.','With a {name}, I could get through twice the orchard.'] },
  books:{ who:'Quill', voice:640, acc:['glasses'], accC:0x2a2a2a, unit:['clam','clams'], hint:'a bookkeeper by the general store',
    tiers:[{ name:'Ledger', cost:25000, per:800 }, { name:'Counting House', cost:120000, per:2000 }, { name:'Trading Office', cost:400000, per:4500 }],
    meet:['Ah! You\'re the one who\'s been backing the shops. I\'ve been watching the numbers.','Nobody is collecting your share of the profits! It\'s a scandal.',
      'Buy me a proper ledger and I\'ll keep the books. Your cut piles up here every day, for each shop you\'ve backed.'],
    up:['The shops are doing well, and the paperwork is piling up.','A {name} and I could squeeze a lot more out of every shop you back.'] },
};
const INC_IDS=Object.keys(INCOME);
if (!S.income) S.income={};
const incOf = k => S.income[k] || (S.income[k]={ tier:-1 });
// when each one first turns up
function incUnlocked(k){ if (GUEST || VISIT) return false; const T=S.town, hall=(T.hall||0)>=1;
  if (k==='boat') return hall && (S.caught||0)>=40;
  if (k==='bees') return hall && (S.plants.filter(p=>!p.wild && PLANTS[p.sp] && PLANTS[p.sp].ptype==='flower').length>=5 || discovered()>=45);
  if (k==='orchard') return hall && daysHere()>=10 && trees.some(t=>!t.removed && t.fruit && t.fruit!=='coconut');
  if (k==='books') return shopsBacked()>=1;
  return false; }
function incPerDay(k){ const I=incOf(k), D=INCOME[k]; if (I.tier<0) return 0; let n=D.tiers[I.tier].per;
  if (k==='bees' && I.at){ const fl=S.plants.filter(p=>PLANTS[p.sp] && PLANTS[p.sp].ptype==='flower' && Math.hypot(p.x-I.at[0],p.z-I.at[1])<16).length; n+=Math.min(3, Math.floor(fl/4)); }
  if (k==='books') n*=shopsBacked();
  return n; }
function incomeNewDay(now){
  for (const k of INC_IDS){ const I=incOf(k); if (I.tier<0) continue; if (I.last===undefined){ I.last=now; continue; }
    const days=now-I.last; if (days<=0) continue; const per=incPerDay(k); I.acc=Math.min(per*INC_DAYS, (I.acc||0)+per*days); I.last=now; } }
// spots: each person has a place of their own, picked the same way every time on this island
function incSpot(k){
  const r=mulberry32(hashStr(k+':inc:'+S.seed)), far=(x,z,m)=>!Object.entries(PLACES).some(([kk,p])=>p && kk!=='board' && Math.hypot(x-p[0],z-p[1])<(kk==='plaza'?8:m))
    && !INC_IDS.some(o=>o!==k && S.income[o] && S.income[o].at && Math.hypot(x-S.income[o].at[0],z-S.income[o].at[1])<12);
  const clear=(x,z,rad)=>{ for (let i=0;i<=8;i++){ const a=i/8*TAU, rr=i===8?0:rad, px=x+Math.cos(a)*rr, pz=z+Math.sin(a)*rr; if (!walkable(px,pz) || inRects(px,pz,0.2) || gardenAtXZ(px,pz) || keptOut(px,pz)) return false; }
    return !S.plants.some(q=>!q.wild && Math.hypot(q.x-x,q.z-z)<rad+0.8) && !S.placed.some(q=>q.x<500 && Math.hypot(q.x-x,q.z-z)<rad+0.8) && !ents.some(e=>!e.removed && e.solid && Math.hypot(e.pos.x-x,e.pos.z-z)<rad+e.r); };
  for (let n=0;n<2500;n++){ let x, z;
    if (k==='boat'){ const a=r()*TAU, d=islandR(a)*(0.9+r()*0.08); x=Math.cos(a)*d; z=Math.sin(a)*d; if (!isBeach(x,z) || Math.hypot(x-DOCK.x0,z-DOCK.z)<16) continue;
      const ox=Math.cos(a), oz=Math.sin(a); if (!isFishWater(x+ox*4.5, z+oz*4.5)) continue; if (!far(x,z,9) || !clear(x,z,1.6)) continue; return [+x.toFixed(1), +z.toFixed(1), +a.toFixed(3)]; }
    if (k==='orchard'){ const fr=trees.filter(t=>!t.removed && t.fruit && t.fruit!=='coconut'); if (!fr.length) return null; const t=fr[Math.floor(r()*fr.length)], a=r()*TAU; x=t.pos.x+Math.cos(a)*3; z=t.pos.z+Math.sin(a)*3; }
    else if (k==='books'){ const p=PLACES.shop; if (!p) return null; const a=r()*TAU, d=6.5+r()*4; x=p[0]+Math.cos(a)*d; z=p[1]+Math.sin(a)*d; if (visPathDist(x,z)<1) continue;
      if (Object.entries(PLACES).some(([kk,q])=>q && kk!=='shop' && kk!=='plaza' && kk!=='board' && Math.hypot(x-q[0],z-q[1])<7)) continue; if (!clear(x,z,1.6)) continue; return [+x.toFixed(1), +z.toFixed(1), 0]; }
    else { const a=r()*TAU, d=islandR(a)*(0.35+r()*0.4); x=Math.cos(a)*d; z=Math.sin(a)*d; if (rawHeight(x,z)<SAND_H+0.3 || visPathDist(x,z)<3) continue; }
    if (!far(x,z,8.5) || !clear(x,z,2.2)) continue;
    let lo=99, hi=-99; for (let i=0;i<8;i++){ const h=rawHeight(x+Math.cos(i)*2,z+Math.sin(i)*2); lo=Math.min(lo,h); hi=Math.max(hi,h); } if (hi-lo>0.9) continue;
    return [+x.toFixed(1), +z.toFixed(1), 0]; }
  return null; }
// props: what they've got to work with, by tier
function buildIncomeProps(k, tier, at){
  const g=new THREE.Group(), wood=M(0x8a5e3a), dark=M(0x5a3e28), cloth=M(0xf4e6c8), red=M(0xd8604d);
  if (k==='boat'){ const a=at[2]||0, ox=Math.cos(a), oz=Math.sin(a);
    const hull=(L,W,H,c)=>{ const h=new THREE.Group(); const b=mk(G.box(L,H,W), M(c), 0,H/2,0,h); mk(G.box(L*0.3,H*0.9,W*0.7), M(c), L*0.55,H*0.55,0,h).rotation.y=Math.PI/4; mk(G.box(L*0.98,0.06,W+0.04), wood, 0,H,0,h); return h; };
    if (tier<0){ const w=hull(2.4,1.0,0.45,0x9a7a5a); w.rotation.set(0,0,Math.PI*0.92); w.position.set(ox*1.6+0.3, 0.55, oz*1.6+0.3); g.add(w); mk(G.box(0.9,0.06,0.18), wood, ox*1.1-0.6, 0.12, oz*1.1+0.5, g).rotation.y=0.7; }
    else { const B=new THREE.Group(); B.position.set(ox*(4+tier*1.2), 0, oz*(4+tier*1.2)); B.rotation.y=-a+Math.PI/2; g.add(B);
      const sz=[[2.4,1.1,0.5,0x5a8ab0],[3.6,1.5,0.7,0xe8e0d0],[5,2.1,0.9,0x3a6a8a]][tier]; const h=hull(...sz); h.position.y=-0.35; B.add(h);
      if (tier>=1){ mk(G.cyl(0.06,0.07,3.2,6), wood, 0,1.9,0,B); const sail=mk(G.box(0.04,2.2,1.4), cloth, 0,2.1,0.75,B); sail.castShadow=true; }
      if (tier>=2){ mk(G.box(1.4,1.0,1.4), M(0xf4f0e8), -1.1,0.8,0,B); mk(G.box(1.6,0.12,1.6), red, -1.1,1.36,0,B); }
      // the mooring rope back to the beach
      mk(G.cyl(0.02,0.02,4,4), M(0xc8b088), -ox*0, 0.2, 0, B).rotation.z=Math.PI/2; }
    // the catch crate by the fisherman
    mk(G.box(0.8,0.5,0.6), wood, -oz*1.1, 0.25, ox*1.1, g); g.userData.crate=mk(G.box(0.7,0.12,0.5), M(0x7ab0c8), -oz*1.1, 0.52, ox*1.1, g); }
  if (k==='bees'){ const n=[1,1,3,5][tier+1];
    for (let i=0;i<n;i++){ const a=i/Math.max(1,n)*TAU+0.6, d=n>1?2.2:1.8, hv=new THREE.Group(); hv.position.set(Math.cos(a)*d, 0, Math.sin(a)*d); g.add(hv);
      if (tier<0){ const b=mk(G.box(0.7,0.5,0.6), M(0xd8c8a0), 0,0.25,0,hv); b.rotation.z=1.2; continue; }
      mk(G.box(0.18,0.3,0.18), dark, 0,0.15,0,hv); for (let s=0;s<3;s++) mk(G.box(0.7,0.26,0.6), M([0xf0d890,0xe8c870,0xf0d890][s]), 0,0.42+s*0.27,0,hv);
      const roof=mk(G.cone(0.6,0.3,4), M(0x8a6a4a), 0,1.32,0,hv); roof.rotation.y=Math.PI/4; mk(G.box(0.2,0.05,0.03), M(0x3a2a1a), 0,0.36,0.31,hv); }
    g.userData.crate=mk(G.cyl(0.25,0.22,0.3,10), M(0xe8a020,{roughness:0.3}), -1.3,0.15,1.3,g); }
  if (k==='orchard'){
    if (tier>=0){ const ld=new THREE.Group(); ld.position.set(1.4,0,-0.6); ld.rotation.z=-0.25; g.add(ld); for (const s of [-1,1]) mk(G.box(0.06,2.4,0.06), wood, 0,1.2,s*0.25,ld); for (let i=0;i<6;i++) mk(G.box(0.05,0.05,0.5), wood, 0,0.3+i*0.38,0,ld); }
    if (tier>=1){ const c=new THREE.Group(); c.position.set(-1.8,0,-1.2); g.add(c); mk(G.box(1.4,0.5,0.9), wood, 0,0.55,0,c); for (const s of [-1,1]){ const w=mk(new THREE.TorusGeometry(0.3,0.05,6,14), dark, 0,0.32,s*0.5,c); } }
    if (tier>=2){ const sh=new THREE.Group(); sh.position.set(-0.4,0,-2.8); g.add(sh); mk(G.box(2.2,1.6,1.6), M(0xd8c4a0), 0,0.8,0,sh); const rf=mk(G.cone(1.7,0.8,4), M(0x8a4a3a), 0,2.0,0,sh); rf.rotation.y=Math.PI/4; mk(G.cyl(0.35,0.35,0.6,10), wood, 1.4,0.3,0.6,sh); }
    for (let i=0;i<2;i++) mk(G.cyl(0.32,0.26,0.32,12), M(0xc8a060), -0.9+i*0.75, 0.16, 1.0, g);
    g.userData.crate=mk(G.sph(0.24,10,8), M(0xe2483d), -0.9,0.36,1.0,g); }
  if (k==='books'){
    mk(G.box(1.2,0.08,0.7), wood, 0,0.8,0,g); for (const [x,z] of [[-0.5,-0.28],[0.5,-0.28],[-0.5,0.28],[0.5,0.28]]) mk(G.box(0.07,0.8,0.07), dark, x,0.4,z,g);
    mk(G.box(0.4,0.06,0.3), red, -0.2,0.87,0,g); mk(G.box(0.36,0.04,0.28), cloth, -0.2,0.91,0,g);
    if (tier>=1){ for (const x of [-0.75,0.75]) mk(G.cyl(0.04,0.04,2.2,6), wood, x,1.1,-0.5,g); mk(G.box(1.8,0.06,1.2), M(0x3a6a5a), 0,2.2,-0.1,g); }
    if (tier>=2){ mk(G.box(1.8,1.3,0.12), M(0xd8c8a8), 0,0.65,-0.6,g); mk(G.box(1.1,0.3,0.06), M(0x3a3028), 0,1.95,0.5,g); }
    g.userData.crate=mk(G.cyl(0.14,0.16,0.22,10), M(0xf3c35a,{metalness:0.6,roughness:0.3}), 0.35,0.95,0,g); }
  return g; }
const incEnts={};
function refreshIncome(){
  if (VISIT || GUEST) return;
  for (const k of INC_IDS){ const I=incOf(k);
    if (!I.met && !I.seen && !incUnlocked(k)) continue;
    if (!I.at){ const p=incSpot(k); if (!p) continue; I.at=p; I.seen=true; save(); setTimeout(()=>toast(`Someone new is on the island: ${INCOME[k].hint}.`, null, 'new'), 3600); }
    const E=incEnts[k]; if (E && E.tier===I.tier){ if (E.props.userData.crate) E.props.userData.crate.visible=(I.acc||0)>0; continue; }
    if (E){ OUT.remove(E.props); E.keeper.remove(); }
    const [x,z,a]=I.at, props=buildIncomeProps(k, I.tier, I.at); props.position.set(x, groundY(x,z), z); OUT.add(props);
    if (props.userData.crate) props.userData.crate.visible=(I.acc||0)>0;
    const D=INCOME[k], spec={ name:D.who, voice:D.voice, build:()=>buildAnimal({ look:CH.lookCode(CH.residentLook(S.seed, 'inc:'+k)), acc:D.acc, accC:D.accC }) };
    const kp=new Keeper(spec, x, z, ()=>talkIncome(k)); kp.rest = k==='boat' ? Math.atan2(Math.cos(a), Math.sin(a)) : 0;
    incEnts[k]={ tier:I.tier, props, keeper:kp }; } }
function incCollect(k){
  const I=incOf(k), D=INCOME[k]; let n=Math.floor(I.acc||0); if (n<=0) return 0; let got=0;
  if (k==='books'){ addClams(n); track('earned',n); I.acc=0; Snd.coin(); updateHUD(); save(); return n; }
  const m=Time.month(), seaPool=Object.values(ITEMS).filter(i=>i.kind==='fish' && i.where==='sea' && inMonths(m,i.months)).filter(allowedFind);
  const fruits=[...new Set(trees.filter(t=>!t.removed && t.fruit).map(t=>t.fruit))]; if (!fruits.length) fruits.push(S.nativeFruit||'apple');
  for (; got<n; got++){ let id, meta;
    if (k==='boat'){ const sp=tierPick(Math.random, seaPool, i=>luckW(i,'fish'), 'fish'); if (!sp) break; id=sp.id; meta=rollStats(id); }
    else if (k==='bees') id='honey';
    else id = Math.random()<0.75 && fruits.includes(S.nativeFruit) ? S.nativeFruit : fruits[Math.floor(Math.random()*fruits.length)];
    const r=addItem(id, meta); if (!r) break;
    if (meta){ recordCatch(id, meta); if (r==='new') itemToast(id, true, 'Received'); }
    else if (r==='new') itemToast(id, true, 'Received'); }
  I.acc=Math.max(0,(I.acc||0)-got); Snd.coin(); save(); updateHUD(); return got; }
function talkIncome(k){
  const D=INCOME[k], I=incOf(k), v=D.voice, nm=D.who, nowD=dayNum(today()), back=()=>talkIncome(k);
  if (VISIT){ dialog(nm, v, ['Nice to meet you! I work for the owner of this island.']); return; }
  if (I.tier<0){ const t=D.tiers[0];
    dialog(nm, v, I.met ? [`Still thinking about that ${t.name.toLowerCase()}? It's ${fmt(t.cost)} clams.`] : [...D.meet, `It'd cost ${fmt(t.cost)} clams.`], null, [
      { label:`Fund it (${fmt(t.cost)})`, fn:()=>{ if (noEdit()) return; if (S.clams<t.cost){ dialog(nm, v, ['Ah, looks like you\'re a little short. No rush, I\'ll be right here.']); return; }
          S.clams-=t.cost; I.tier=0; I.since=nowD; I.last=nowD; I.acc=0; I.met=true; updateHUD(); save(); Snd.fanfare(); refreshIncome();
          dialog(nm, v, [`You won't regret it! I'll get started tomorrow.`, `Come by any time. It fills up over about ${INC_DAYS} days, then I'll just hold on to it for you.`]); } },
      { label:'Not right now', alt:true, fn:()=>{ I.met=true; save(); dialog(nm, v, ['No worries. You know where to find me.']); } } ]);
    return; }
  const n=Math.floor(I.acc||0), cap=incPerDay(k)*INC_DAYS, nx=D.tiers[I.tier+1], canUp=nx && nowD-(I.since||0)>=INC_UPGRADE_WAIT, u=D.unit;
  const line = k==='books' ? `Your share is ${fmt(n)} clams so far. It holds up to ${fmt(cap)}.` : `I've got ${n} ${n===1?u[0]:u[1]} set aside for you. Room for ${cap}.`;
  const choices=[];
  if (n>0) choices.push({ label: k==='books' ? `Collect ${fmt(n)} clams` : 'Collect', fn:()=>{ const got=incCollect(k); refreshIncome();
      if (k==='books') dialog(nm, v, [`There you go: ${fmt(got)} clams.`], back);
      else if (got<n) dialog(nm, v, [got ? `Your bag's full after ${got}. I'll hold the rest.` : `Your bag's full! I'll keep them for you.`], back);
      else dialog(nm, v, ['All yours!'], back); } });
  if (canUp) choices.push({ label:`Upgrade: ${nx.name} (${fmt(nx.cost)})`, fn:()=>{
      dialog(nm, v, D.up.map(l=>l.replace('{name}',nx.name)), null, [
        { label:`Buy it (${fmt(nx.cost)})`, fn:()=>{ if (S.clams<nx.cost){ dialog(nm, v, ['Not quite enough clams yet. Next time!'], back); return; }
            S.clams-=nx.cost; I.tier++; I.since=nowD; updateHUD(); save(); Snd.fanfare(); refreshIncome(); dialog(nm, v, [`A ${nx.name}! This is going to be great.`], back); } },
        { label:'Maybe later', alt:true, fn:back } ]); } });
  choices.push({ label:'Bye!', alt:true, fn:()=>{} });
  dialog(nm, v, [`The ${D.tiers[I.tier].name.toLowerCase()} is working out great. ${line}`], null, choices);
}
/* =====================================================================
   v0.9: WENDELL THE WIZARD, POTIONS, FAVORS, SHAPING THE ISLAND
   ===================================================================== */
const MAGIC_CSS = `
.sw.mix{position:relative;background:conic-gradient(#e2483d,#f0c040,#7cc35a,#3aa6d8,#8a6ad8,#e2483d);overflow:hidden}
.sw.mix input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer;border:0;padding:0}
#potions{position:absolute;top:calc(env(safe-area-inset-top) + 74px);left:calc(env(safe-area-inset-left) + 10px);display:flex;flex-direction:column;gap:4px;pointer-events:none}
#potions .pc{background:rgba(255,248,234,.95);border:2px solid #c8b0ff;border-radius:14px;padding:3px 10px;font-size:13px;font-weight:600;display:flex;gap:6px;align-items:center}
#potions .pc i{width:10px;height:10px;border-radius:50%;display:inline-block}
#magicBar{position:fixed;left:0;right:0;bottom:0;display:none;flex-direction:column;gap:8px;background:var(--cream);border-top:4px solid var(--line);border-radius:22px 22px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,.18);z-index:22;padding:10px 12px calc(env(safe-area-inset-bottom) + 10px)}
#magicBar.show{display:flex}
#magicBar .tools{display:flex;gap:6px;flex-wrap:wrap}
#magicBar .tool{flex:1 1 60px;min-width:58px;border:3px solid var(--line);background:#fff;border-radius:14px;padding:6px 4px;font-family:inherit;font-weight:600;color:var(--brown);font-size:13px;cursor:pointer}
#magicBar .tool.on{border-color:#8a6ad8;background:#efe8ff}
#magicBar .row2{display:flex;gap:8px;align-items:center}
#magicBar .msg{flex:1;font-size:13px;line-height:1.25}
#hud.magic #act,#hud.magic #toolBtn,#hud.magic #bar,#hud.magic #joyZone,#hud.magic #hint{display:none}
.favor{border:3px solid var(--line);border-radius:14px;padding:8px 10px;margin:6px 0;background:#fffdf6}
.favor b{display:block}
.favor .fg{display:flex;align-items:center;gap:6px;margin-top:4px}.favor .fg img{width:30px;height:30px}
.achHead{display:flex;align-items:center;gap:10px}.achHead .bar{flex:1}
.achGrp{margin:14px 0 4px;font-weight:700;color:var(--brown)}.achGrp span{font-weight:500;color:var(--brown2);font-size:13px}
.achGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.ach{border:3px solid var(--line);border-radius:16px;background:#fffdf6;padding:8px;display:flex;gap:8px;align-items:center;min-height:64px}
.ach img{width:46px;height:46px;flex:0 0 46px}.ach .an{font-weight:700;font-size:14px;line-height:1.15;color:var(--brown)}.ach .ad{font-size:12px;line-height:1.2;color:var(--brown2)}
.ach.locked{background:#f3ede2;border-style:dashed}.ach.locked .an{color:#a8987f}
`;
{ const st=document.createElement('style'); st.textContent=MAGIC_CSS; document.head.appendChild(st);
  const pc=document.createElement('div'); pc.id='potions'; $('#hud').appendChild(pc);
  const mb=document.createElement('div'); mb.id='magicBar'; document.body.appendChild(mb); }
const DEV = (()=>{ try { if (location.hash==='#dev'){ localStorage.setItem('dwDev','1'); history.replaceState(null,'',location.pathname); } return localStorage.getItem('dwDev')==='1'; } catch(e){ return false; } })();

/* ---------- Potions ---------- */
if (!S.potions) S.potions={};
const nowMs = () => Time.now().getTime();
const potionOn = k => { const p=S.potions, n=nowMs(); return (p[k]||0)>n || (p.all||0)>n; };
// Luck: rare things (rarity weight under 3) become about 3.5x as likely, common ones a little less likely
const luckW = (it, k) => { const w=it.rarity ?? 5; return potionOn(k) ? (w<3 ? w*3.5 : w*0.75) : w; };
/* v1.19: very rare and legendary finds get a fixed share of each draw no matter how many common things are around,
   so "very rare" means very rare: the whole very rare group comes up about 0.4% of the time (one fish or bug in
   250) and legendary about 1 in 5,000. A luck potion triples those. Everything else keeps its usual weights. */
const TIER_SHARE = { 'Very rare':0.004, 'Legendary':0.0002 };
function tierPick(r, pool, wf, luckKey){
  if (pool.length<2) return pool[0];
  const tier=i=>rarityLabel(i.rarity ?? 5), n={}; let base=0;
  for (const i of pool){ const t=tier(i); if (TIER_SHARE[t]) n[t]=(n[t]||0)+1; else base+=wf(i); }
  if (base<=0) return weightedPick(r, pool, wf);
  const boost = luckKey && potionOn(luckKey) ? 3 : 1;
  return weightedPick(r, pool, i=>{ const t=tier(i); return TIER_SHARE[t] ? base*TIER_SHARE[t]*boost/n[t] : wf(i); }); }

/* ---------- v1.13 rare finds: showpiece plans and rare ingredients ----------
   Plans are learned the moment you pick one up (no duplicates). Ingredients turn up by chance while
   doing ordinary island things; the matching potion doubles the odds. Guests don't get either. */
if (!S.rare) S.rare={ plans:[], made:0 };
const knowsPlan = fid => S.rare.plans.includes(fid);
const unfoundPlans = () => RARE_WORK.filter(r=>!knowsPlan(r.id));
const rareChance = (k, potion) => RARE_ODDS[k]*(potion && potionOn(potion) ? 2 : 1);
function rareRoll(k, id, at, potion){
  if (GUEST || Math.random()>=rareChance(k, potion)) return false;
  const p=at.clone(); setTimeout(()=>{ dropNear(id, p, 1.4); sparkle(p.clone().add(new THREE.Vector3(0,1.4,0))); Snd.jingle(); toast('Rare find!', thumb(id), 'new', `${ITEMS[id].name} ${rarityTag(ITEMS[id])}`); }, 450);
  return true; }
function learnPlan(planId){ const fid=ITEMS[planId].learns; if (knowsPlan(fid)) return false; S.rare.plans.push(fid); save(); Snd.fanfare();
  toast(`Rare plan found: ${ITEMS[fid].name}!`, thumb(fid), 'new', S.craft ? 'It\'s in Woodworking now. The ingredients are the hard part.' : 'Once Bramble teaches you woodworking, you can make it.');
  return true; }
const randomPlan = (r=Math.random) => { const u=unfoundPlans(); return u.length ? u[Math.floor(r()*u.length)].plan : null; };
function beachSpot(r){ for(let k=0;k<40;k++){ const a=r()*TAU, d=(40+r()*16)*SC; const x=Math.cos(a)*d, z=Math.sin(a)*d; if(isBeach(x,z) && !onDock(x,z)) return [x,z]; } return null; }
// v1.13: daily stock is rolled by rarity. Investing in a shop makes rare and very rare pieces more likely.
const STOCK_W = { 'Common':10, 'Uncommon':5, 'Rare':1.4, 'Very rare':0.06 };   // v1.19: very rare pieces were 0.45
const TIER_BOOST = [[1,1],[1.3,1.4],[1.7,2],[2.2,3]];   // [rare, very rare] multipliers per investment tier
function stockWeight(it, t=0){ const r=rarityLabel(it.rarity ?? FR.c); let w=STOCK_W[r]||0; const b=TIER_BOOST[t]||TIER_BOOST[0]; if (r==='Rare') w*=b[0]; else if (r==='Very rare') w*=b[1]; return w; }
function pickWeighted(r, pool, k, have, wf){ const a=pool.filter(i=>!have.includes(i.id)), out=[];
  while (out.length<k && a.length){ const tot=a.reduce((s,i)=>s+wf(i),0); if (tot<=0) break; let x=r()*tot, j=0; for (;j<a.length-1;j++){ x-=wf(a[j]); if (x<=0) break; } out.push(a.splice(j,1)[0].id); }
  return out; }
const generalPool = m => Object.values(ITEMS).filter(i=>i.kind==='furniture' && i.shop==='stall' && inMonths(m,i.months) && allowedFind(i));
const isRarePiece = id => { const it=ITEMS[id]; return it && it.kind==='furniture' && it.rarity!==undefined && it.rarity<3; };
function drinkPotion(slot){
  const s=S.inv[slot]; if(!s) return; const it=ITEMS[s.id]; if (it.kind!=='potion') return;
  removeAt(slot,1); track('potion'); const k=it.luck, until=Math.max(nowMs(), S.potions[k]||0)+it.mins*60000; S.potions[k]=until; save();
  Snd.jingle(); sparkle(player.pos.clone().add(new THREE.Vector3(0,1.6,0))); toast(`You drank the ${it.name}! Luck lasts ${it.mins} minutes.`, thumb(s.id), 'new');
  updatePotionHUD();
}
const LUCK_NAMES = { fish:['Fishing luck',0x3aa6d8], bug:['Bug luck',0x7cc35a], dig:['Digging luck',0xd8a040], all:['Star luck',0xc8a0f0] };
function updatePotionHUD(){
  const el=$('#potions'); if(!el) return; const n=nowMs(); let h='';
  for (const [k,[nm,c]] of Object.entries(LUCK_NAMES)){ const left=(S.potions[k]||0)-n; if (left<=0) continue; const m=Math.floor(left/60000), sec=Math.floor(left/1000)%60;
    h+=`<div class="pc"><i style="background:#${c.toString(16).padStart(6,'0')}"></i>${nm} ${m}:${String(sec).padStart(2,'0')}</div>`; }
  const fl=(S.fed||0)-n; if (fl>0) h+=`<div class="pc"><i style="background:#f0a040"></i>Well fed ${Math.floor(fl/60000)}:${String(Math.floor(fl/1000)%60).padStart(2,'0')}</div>`;
  el.innerHTML=h;
}

/* ---------- The wizard tower ---------- */
let towerEnt=null, wizard=null;
const cellsBuilt = () => S.home && S.home.built ? Math.max(S.home.paid||0, planCells(S.home.plan)) : 0;
const shopsBacked = () => ['general','aquarium','garden'].filter(k=>(S.shops[k]?.tier||0)>=1).length;
const moveUnlocked = () => DEV&&S.devMagic || (cellsBuilt()>=MAGIC.unlockMove.cells && shopsBacked()>=MAGIC.unlockMove.shops);
const landUnlocked = () => DEV&&S.devMagic || (cellsBuilt()>=MAGIC.unlockLand.cells && shopsBacked()>=MAGIC.unlockLand.shops);
class Wizard extends Keeper {
  update(dt,t){ super.update(dt,t); const o=this.obj.userData.orb; if(o) o.material.emissiveIntensity=0.8+Math.sin(t*3)*0.4;
    const orbs=towerEnt && towerEnt.model.userData.orbs; if(orbs) orbs.forEach((b,i)=>{ const a=t*0.7+i*Math.PI/2; b.position.set(Math.cos(a)*2.9, 3.2+Math.sin(t*1.3+i)*0.6, Math.sin(a)*2.9); }); }
}
function buildTowerEnt(){
  if (towerEnt){ towerEnt.remove(); setRects('tower',[]); towerEnt=null; } if (wizard){ wizard.remove(); wizard=null; }
  if (!PLACES.tower) return;
  towerEnt=placeBuilding('tower', PLACES.tower[0], PLACES.tower[1], buildTower(), 'Knock', ()=>{ Snd.door(); toast('Wendell works outside. He says the inside is "a bit explode-y" at the moment.'); });
  const [dx,dz]=towerEnt.doorPt; wizard=new Wizard(Object.assign({ build:buildWizard }, WIZARD), dx+2.1, dz-0.2, ()=>talkWizard());
}
buildTowerEnt();
/* ---------- Portal Station (v1.7) ----------
   Outside: a round stone platform with an arch over stairs going down, a glowing crystal on top.
   Below: a hall with a portal arch for each friend's island you can visit (and one home, when you're visiting),
   plus the invite booth for inviting friends to yours. Step into a portal and you're off. */
let portalEnt=null; const portalArches=[];
/* v1.26: old-world look. A ring of rough, mossy stones round the stairwell, two weathered standing stones with a lintel
   over the stairs, faint carved runes, a hanging iron lantern, and a wooden signpost so people know what it is. */
function portalSignTex(){ const cv=document.createElement('canvas'); cv.width=512; cv.height=192; const x=cv.getContext('2d');
  const gr=x.createLinearGradient(0,0,0,192); gr.addColorStop(0,'#9a7350'); gr.addColorStop(1,'#7d5b3e'); x.fillStyle=gr; x.fillRect(0,0,512,192);
  x.strokeStyle='rgba(60,40,25,.35)'; x.lineWidth=2; for (let k=0;k<9;k++){ x.beginPath(); const y=14+k*20+Math.sin(k)*4; x.moveTo(0,y); x.bezierCurveTo(170,y+6,340,y-6,512,y+2); x.stroke(); }
  x.fillStyle='#f4e6c8'; x.textAlign='center'; x.textBaseline='middle'; x.font='700 64px Georgia, serif'; x.fillText('Portal Station',256,78);
  x.font='italic 600 34px Georgia, serif'; x.fillStyle='#ecdcb8'; x.fillText('to friends\' isles below',256,140);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; }
function buildPortalEntrance(){
  const g=new THREE.Group(), r=mulberry32(77), stone=M(0x9a978c,{flatShading:true}), stone2=M(0x87857a,{flatShading:true}), dark=M(0x1e1a1a), moss=M(0x5f8a3e), wood=M(0x6a4a32), iron=M(0x2c2a28,{metalness:0.3,roughness:0.6});
  // a low, uneven flagstone platform
  mk(G.cyl(2.3,2.5,0.34,14), stone2, 0,0.17,0,g);
  for (let i=0;i<14;i++){ const a=i/14*TAU+r()*0.2; if (Math.sin(a)>0.45) continue; const b=mk(G.dod(0.42+r()*0.12), i%2?stone:stone2, Math.cos(a)*2.15, 0.36, Math.sin(a)*2.15, g); b.scale.set(1.1,0.55,0.9); b.rotation.y=a;
    if (r()<0.6) mk(G.sph(0.22,7,5), moss, Math.cos(a)*2.15, 0.56, Math.sin(a)*2.15, g).scale.set(1.2,0.3,1); }
  // the stairwell and the first worn steps down into the dark
  mk(G.box(1.5,0.04,1.9), dark, 0,0.39,0.15,g).castShadow=false;
  for (let i=0;i<3;i++) mk(G.box(1.4,0.05,0.32), M(0x77746a-i*0x101010), 0,0.4-i*0.12, 0.95-i*0.42,g);
  for (let i=0;i<2;i++) mk(G.box(1.8,0.16,0.4), stone2, 0,0.08*(i+1),2.55-i*0.35,g);
  // two standing stones and a rough lintel, leaning just a touch
  for (const sx of [-1,1]){ const st=mk(G.box(0.5,2.6,0.55), stone, sx*1.02,1.55,0.15,g); st.rotation.z=-sx*0.04; st.rotation.y=sx*0.05;
    mk(G.sph(0.2,7,5), moss, sx*1.08,2.82,0.15,g).scale.set(1.4,0.4,1.3);
    for (let k=0;k<3;k++){ const rn=mk(G.box(0.18,0.05,0.02), new THREE.MeshStandardMaterial({ color:0xc8d8e8, emissive:0x5a8ab0, emissiveIntensity:0.5 }), sx*1.02, 1.0+k*0.5, 0.44, g); rn.rotation.z=(k%2?0.6:-0.6); rn.castShadow=false; } }
  const lin=mk(G.box(2.9,0.5,0.7), stone2, 0,3.05,0.15,g); lin.rotation.z=0.03;
  mk(G.sph(0.3,8,5), moss, -0.6,3.33,0.15,g).scale.set(1.6,0.35,1.2); mk(G.sph(0.2,8,5), moss, 0.8,3.32,0.25,g).scale.set(1.3,0.3,1);
  // a lantern hanging from the lintel
  mk(G.cyl(0.01,0.01,0.3,4), iron, 0,2.65,0.42,g).castShadow=false;
  const lan=new THREE.Group(); lan.position.set(0,2.32,0.42); g.add(lan);
  mk(G.box(0.22,0.28,0.22), glowMat(0xffc874), 0,0,0,lan); for (const [px,pz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.box(0.03,0.32,0.03), iron, px*0.12,0,pz*0.12,lan);
  const rf=mk(G.cone(0.22,0.16,4), iron, 0,0.22,0,lan); rf.rotation.y=Math.PI/4; addGlow(lan, 0, 2.4, 0xffc874);
  // a wooden signpost by the steps
  const sp=new THREE.Group(); sp.position.set(1.75,0,2.55); sp.rotation.y=-0.35; g.add(sp);
  mk(G.cyl(0.07,0.09,1.7,7), wood, 0,0.85,0,sp);
  const board=mk(G.box(1.5,0.58,0.07), wood, 0,1.45,0.08,sp); const face=new THREE.Mesh(new THREE.PlaneGeometry(1.42,0.52), new THREE.MeshStandardMaterial({ map:portalSignTex(), roughness:0.9, emissive:0x3a2a1a, emissiveIntensity:0.25 })); face.position.set(0,1.45,0.12); sp.add(face);
  mk(G.box(1.62,0.07,0.22), M(0x4a3a2c), 0,1.78,0.1,sp);   // a little drip cap
  g.userData.door=[0,1.75]; g.userData.rects=[[-2.3,-2.3,-0.78,1.6],[0.78,-2.3,2.3,1.6],[-0.78,-2.3,0.78,-0.6]];
  return g; }
function swirlTex(){ const cv=document.createElement('canvas'); cv.width=cv.height=128; const x=cv.getContext('2d'); x.translate(64,64);
  const gr=x.createRadialGradient(0,0,4,0,0,64); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.5,'rgba(255,255,255,0.55)'); gr.addColorStop(1,'rgba(255,255,255,0.15)'); x.fillStyle=gr; x.beginPath(); x.arc(0,0,64,0,TAU); x.fill();
  x.strokeStyle='rgba(255,255,255,0.9)'; x.lineWidth=5; x.lineCap='round'; for (let arm=0;arm<4;arm++){ x.beginPath(); for (let t=0;t<1;t+=0.02){ const a=arm/4*TAU+t*5, r=6+t*56; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.stroke(); }
  return new THREE.CanvasTexture(cv); }
let _swirl=null;
class PortalArch extends Ent {
  constructor(x, z, o){ super('portal',x,z,0.5); this.o=o; this.reach=2.0; this.solid=false;
    const g=new THREE.Group(), stone=M(0x8a86a0), on=!!o.on, col=new THREE.Color().setHSL(o.hue??0.75, 0.65, 0.62);
    for (const sx of [-0.95,0.95]) mk(G.box(0.3,2.0,0.36), stone, sx,1.0,0,g);
    const arch=new THREE.Mesh(new THREE.TorusGeometry(0.95,0.17,10,24,Math.PI), stone); arch.position.y=2.0; g.add(arch);
    const back=mk(G.box(1.62,2.0,0.06), new THREE.MeshBasicMaterial({ color: on ? col.clone().multiplyScalar(0.35) : 0x3a3648 }), 0,1.0,-0.05,g); back.castShadow=false;
    const backTop=new THREE.Mesh(new THREE.CircleGeometry(0.81,24,0,Math.PI), back.material); backTop.position.set(0,2.0,-0.05); g.add(backTop);
    _swirl=_swirl||swirlTex();
    const disc=new THREE.Mesh(new THREE.CircleGeometry(0.78,32), new THREE.MeshBasicMaterial({ map:_swirl, color: on ? col : 0x55506a, transparent:true, opacity: on?0.95:0.35, blending: on?THREE.AdditiveBlending:THREE.NormalBlending, depthWrite:false }));
    disc.position.set(0,1.45,0.02); g.add(disc); this.disc=disc;
    if (on) addGlow(g, 1.45, 2.6, col.getHex());
    const tag=nameTag(o.name); tag.position.y=3.35; g.add(tag);
    this.attach(g); this.hitSphere(1.0,1.4); this.obj.rotation.y=o.rot||0; }
  label(){ return this.o.verb; }
  act(){ this.o.act(this); }
  update(dt,t){ this.disc.rotation.z -= dt*(this.o.on?2.2:0.3); if (this.o.on){ const k=1+Math.sin(t*3+this.pos.x)*0.04; this.disc.scale.set(k,k,1); } }
}
function buildPortalStation(){
  if (portalEnt){ portalEnt.remove(); setRects('portal',[]); portalEnt=null; } clearRoom('portal');
  if (!PLACES.portal) return;
  const [px,pz]=PLACES.portal, model=buildPortalEntrance();
  portalEnt=placeBuilding('portal', px, pz, model, 'Go down', ()=>{ Snd.door(); enterRoom('portal'); });
  portalEnt.reach=2.2;
  const W=12, D=10, R=makeRoom('portal', 20, { floor:0x5a5e7a, wall:0x3a3c5e, pattern:'dots', accent:0x9a7ad8, items:[] }, W, D, [portalEnt.doorPt[0], portalEnt.doorPt[1]+0.2]);
  // glowing crystals in the corners and a booth for invites
  const cmat=new THREE.MeshStandardMaterial({ color:0xb89aff, emissive:0x6a3ad0, emissiveIntensity:0.8, roughness:0.3 });
  for (const [cx,cz,s] of [[-W/2+0.7,-D/2+0.7,1],[W/2-0.7,-D/2+0.7,0.8],[-W/2+0.6,D/2-1.6,0.6],[W/2-0.6,D/2-1.6,0.7]]){ const c=new THREE.Mesh(new THREE.OctahedronGeometry(0.4*s,0), cmat); c.scale.y=2.2; c.position.set(R.ox+cx, 0.9*s, R.oz+cz); R.group.add(c); addGlow(c, 0, 2.0, 0xb89aff); }
  new InviteBooth(R.ox-W/2+1.4, R.oz+0.6);
  refreshPortals(true); }
class InviteBooth extends Ent {
  constructor(x,z){ super('booth',x,z,0.6); this.reach=1.9; this.solid=true;
    const g=new THREE.Group(), brass=M(0xc9a04a), wood=M(0x8a5a3a);
    mk(G.box(1.1,1.1,0.8), wood, 0,0.55,0,g); mk(G.box(1.2,0.08,0.9), brass, 0,1.14,0,g);
    const scr=mk(G.box(0.8,0.5,0.06), new THREE.MeshStandardMaterial({ color:0x2a2050, emissive:0x8a6af0, emissiveIntensity:0.7 }), 0,1.5,-0.25,g); scr.rotation.x=-0.25;
    mk(G.box(0.36,0.06,0.12), M(0x2a2438), 0,1.19,0.28,g);   // ticket slot
    const bell=mk(G.sph(0.1,10,8), brass, 0.4,1.24,0.2,g);
    const tag=nameTag('Invites'); tag.position.y=2.3; g.add(tag);
    this.attach(g); this.hitSphere(0.8,0.8); this.obj.rotation.y=Math.PI/2; }
  label(){ return 'Invite'; }
  act(){ Snd.pop(); const P=BOOT.portal;
    if (!P || !P.online){ dialog('Station', 620, ['The portals need an account and an internet connection.', ...(GUEST?['Make an account from the Account button, and you can invite friends here.']:[])], GUEST&&P?()=>P.account():null); return; }
    if (VISIT){ toast('Make invites from the station on your own island.'); return; }
    P.invite(); } }
// (re)build the arches: one per island you can visit, plus home when you're visiting
let portalBusy=false;
async function refreshPortals(quick){
  const R=ROOMS.portal; if (!R || portalBusy) return; portalBusy=true;
  const list=[], P=BOOT.portal;
  try {
    if (!P || !P.online) list.push({ name: GUEST?'Needs an account':'Offline', on:false, verb:'Look', act:()=>toast(GUEST?'Make an account to visit friends and invite them here.':'The portals need an internet connection.') });
    else if (quick) list.push({ name:'...', on:false, verb:null, act:()=>{} });
    else {
      if (VISIT) list.push({ name:'Home', hue:0.33, on:true, verb:'Go home', act:a=>portalGo(a, 'your island', ()=>P.home()) });
      const f=await P.list(); const can=(f.canVisit||[]).filter(v=>!(VISIT && BOOT.host && v.ownerId===BOOT.host.id));
      const max = VISIT ? 4 : 5;
      can.slice(0, can.length>max ? max-1 : max).forEach(v=>{ const ok=v.standing || v.visitsLeft>0;
        list.push({ name:v.name, hue:(hashStr(v.ownerId)%360)/360, on:ok, verb: ok?'Visit':'Look', act: ok ? a=>portalGo(a, `${v.name}'s island`, ()=>P.visit(v.ownerId)) : ()=>toast(`No visits left to ${v.name}'s island. Ask for a new invite.`) }); });
      if (can.length>max) list.push({ name:`${can.length-max+1} more`, hue:0.6, on:true, verb:'More', act:()=>P.friends() });
      if (!can.length && !VISIT) list.push({ name:'No islands yet', on:false, verb:'Look', act:()=>dialog('Station',620,['No portals open yet. When a friend sends you an invite link and you open it, their island gets a portal here.', 'To invite friends to your island, use the booth.']) });
    }
  } catch(e){ list.length=0; list.push({ name:'Offline', on:false, verb:'Look', act:()=>toast('Could not reach the portals. Try again in a bit.') }); }
  for (const a of portalArches) a.remove(); portalArches.length=0;
  const n=list.length, gap=Math.min(2.4, (R.w-3)/Math.max(1,n));
  list.forEach((o,i)=>{ const a=new PortalArch(R.ox+(i-(n-1)/2)*gap, R.oz-1.9, o); R.group.add(a.obj); portalArches.push(a); });
  portalBusy=false; }
// step into a portal: walk in, spin down into the swirl, lilac shimmer, then the trip
function portalGo(a, where, go){
  dialog('Station', 620, [`Off to ${where}?`], null, [
    { label:'Step in', fn:()=>{ stopMove(); const from=player.pos.clone(), to=new THREE.Vector3(a.pos.x, from.y, a.pos.z+0.2), s0=player.obj.scale.clone(); cine={ camT:new THREE.Vector3(a.pos.x, 1, a.pos.z+0.5), dist:9, pitch:0.6, shake:0 }; $('#hud').classList.add('magic'); Snd.magic();
        timeline(1.2, (t)=>{ const k=Math.min(1,t/0.6); player.pos.lerpVectors(from,to,k); player.obj.position.copy(player.pos); player.face=Math.PI; if (t>0.6){ const q=(t-0.6)/0.6; player.obj.rotation.y=Math.PI+q*q*14; player.obj.scale.copy(s0).multiplyScalar(Math.max(0.02,1-q)); if (Math.random()<0.5) swirl(new THREE.Vector3(a.pos.x, 0.6, a.pos.z), 0.8, 1, a.o.hue!=null?new THREE.Color().setHSL(a.o.hue,0.6,0.7).getHex():0xc8b0ff); } },
          ()=>{ player.obj.visible=false; try { sessionStorage.setItem('dw-portal','1'); } catch(e){} document.documentElement.classList.add('magicret'); setTimeout(()=>go(), 450); }); } },
    { label:'Not now', alt:true, fn:()=>{} } ]); }
// arriving through a portal: pop out of the station entrance
function portalArrive(){
  const d=portalEnt ? portalEnt.doorPt : null; if (d){ player.pos.set(d[0], groundY(d[0],d[1]+0.4), d[1]+0.4); player.face=0; player.obj.rotation.y=0; player.obj.position.copy(player.pos); camTarget.copy(player.pos); updateCamera(1); }
  const s0=player.obj.scale.clone(); player.obj.scale.multiplyScalar(0.05);
  setTimeout(()=>document.documentElement.classList.remove('magicret'), 200);
  timeline(0.6, t=>{ const k=t/0.6, e=k<1 ? 1+Math.sin(k*Math.PI)*0.25 : 1; player.obj.scale.copy(s0).multiplyScalar(Math.max(0.05,k*e)); }, ()=>{ player.obj.scale.copy(s0); playerJelly.v=4; });
  setTimeout(()=>{ sparkBurst(player.pos.clone().add(new THREE.Vector3(0,1,0)), 20, 4); Snd.pop(); }, 250); }
buildPortalStation();
// Preset islands didn't plan a spot for the tower: find a dry, fairly flat, empty spot near the plaza
function findTowerSpot(ignoreTrees){
  if (LAY.places.tower) return LAY.places.tower.slice();
  const r=mulberry32(S.seed+991);
  for (let k=0;k<900;k++){ const a=r()*TAU, d=10+r()*16+k*0.02; const x=Math.cos(a)*d, z=Math.sin(a)*d;
    if (!walkable(x,z) || inRects(x,z,4.6) || inLotZone(x,z,4) || visPathDist(x,z)<3.4 || Math.hypot(x,z)<10 || nearFall(x,z,3)) continue;
    let lo=99, hi=-99, bad=false; for (let i=0;i<9;i++){ const aa=i/8*TAU, rr=i===8?0:3.4, px=x+Math.cos(aa)*rr, pz=z+Math.sin(aa)*rr; if(!walkable(px,pz)){ bad=true; break; } const h=rawHeight(px,pz); lo=Math.min(lo,h); hi=Math.max(hi,h); }
    if (bad || hi-lo>0.75 || !walkable(x,z+4) || polyDist(x,z,RIVER)<9) continue;
    if (Object.keys(PLACES).some(kk=>kk!=='plaza'&&kk!=='board'&&(Math.hypot(x-door(kk,doorOff(kk))[0], z-door(kk,doorOff(kk))[1])<6 || Math.hypot(x-PLACES[kk][0], z-PLACES[kk][1])<footOf(kk)+footOf('tower')+3))) continue;
    if (ents.some(e=>e.solid && !e.removed && e.pos.x<500 && !(ignoreTrees && e instanceof Tree && !e.rec) && (Math.hypot(e.pos.x-x,e.pos.z-z)<4.8 || Math.hypot(e.pos.x-x,e.pos.z-z-3.8)<2.6))) continue;
    if (S.plants.some(p=>Math.hypot(p.x-x,p.z-z)<4.8) || S.placed.some(p=>p.x<500 && Math.hypot(p.x-x,p.z-z)<4.8)) continue;
    return [+x.toFixed(1), +z.toFixed(1)]; }
  return ignoreTrees ? null : findTowerSpot(true);
}
function raiseTower(){
  const spot=findTowerSpot(); if (!spot){ toast('The magic fizzled. There was no room near the plaza. Clear a little space and talk to '+npcName(storyWho('wizard'))+' again.'); return false; }
  S.magic.tower=true; S.magic.at=spot; PLACES.tower=spot.slice(); save();
  for (const t of trees) if (!t.removed && !t.rec && (Math.hypot(t.pos.x-spot[0],t.pos.z-spot[1])<4.8 || Math.hypot(t.pos.x-spot[0],t.pos.z-spot[1]-3.8)<2.6)) t.remove();   // natural trees in the way step aside
  buildTowerEnt(); refreshSmoke();
  const p=new THREE.Vector3(spot[0], groundY(spot[0],spot[1])+3, spot[1]); for(let i=0;i<4;i++) setTimeout(()=>sparkle(p.clone().add(new THREE.Vector3((Math.random()-0.5)*3,Math.random()*3,(Math.random()-0.5)*3))), i*180);
  Snd.fanfare(); return true;
}
function talkWizard(){
  const W=WIZARD, v=W.voice;
  const menu=()=>dialog(W.name, v, [], null, [
    ...favorChoices(npcOf('wendell'), ()=>menu()),
    { label:'Potions', fn:()=>openPotionShop() },
    { label:'Move a building', fn:()=>{ if (noEdit()) return; if (!moveUnlocked()){ dialog(W.name, v, [W.moveLock], menu); return; } openMoveList(); } },
    { label:'Shape the land', fn:()=>{ if (noEdit()) return; if (!landUnlocked()){ dialog(W.name, v, [W.landLock], menu); return; } startMagic('land'); } },
    { label:'Bye!', alt:true, fn:()=>{} } ]);
  if (!S.magic.met){ S.magic.met=true; save(); dialog(W.name, v, W.first, menu); return; }
  const h=Time.hour(); dialog(W.name, v, [(h>=21||h<5) ? W.night[0] : W.greet[Math.floor(Math.random()*W.greet.length)]], menu);
}
function openPotionShop(){
  const render=()=>{ let h='';
    for (const id of POTIONS){ const it=ITEMS[id]; h+=`<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">${fmt(it.buy)} clams · ${it.desc}</div></div><button class="btn" data-p="${id}" ${S.clams<it.buy?'disabled':''}>Buy</button></div>`; }
    if (GUEST) h+='<div class="muted" style="margin-top:8px">Guest islands only have common and uncommon finds, so potions help with uncommon ones.</div>';
    pBody.innerHTML=h;
    pBody.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{ const it=ITEMS[b.dataset.p]; if(S.clams<it.buy) return; if(!canAdd(it.id)){ toast('Your bag is full.'); return; } S.clams-=it.buy; const r=addItem(it.id); Snd.coin(); updateHUD(); itemToast(it.id, r==='new', 'Bought'); render(); });
  };
  openPanel('Wendell\'s Potions'); render();
}

/* ---------- Favors (mini quests) ----------
   v1.19: every islander, every shopkeeper, Clementine, Professor Thistle and Wendell ask for things that fit who they are
   (FAVOR_THEMES in content.js) and say thanks with something on theme: furniture or clothes from their own list.
   A favor is put together from an opener, one of that character's asks, and a gift. "do" favors count what you do after you agree. */
if (!S.quests) S.quests={ offers:{}, active:[], done:0, story:{} };
const Q=S.quests; Q.offers=Q.offers||{}; Q.active=Q.active||[]; Q.story=Q.story||{}; Q.gifted=Q.gifted||[];
const MAX_FAVORS=4;
const KEEPER_IDS=['pemberton','marlo','sprig','clementine','thistle','wendell'];
const resById = id => residents.find(r=>r.spec.id===id);
// Anyone who can ask a favor: an islander, or a keeper (the shops, the town hall, the museum, the wizard)
function npcOf(id){ const r=resById(id); if (r) return { id, name:r.spec.name, voice:r.spec.voice, c:r.spec.catch, pos:r.pos, res:r };
  if (id==='wendell') return { id, name:WIZARD.name, voice:WIZARD.voice, c:FAVOR_THEMES.wendell.c, pos:player.pos };
  const k=KEEPERS[id]; return k ? { id, name:k.name, voice:k.voice, c:(FAVOR_THEMES[id]||{}).c||'', pos:player.pos } : null; }
const npcName = id => (npcOf(id)||{}).name || 'Someone';
const keeperAround = id => id==='wendell' ? !!S.magic.tower : KEEPER_IDS.includes(id);
const favorFor = id => Q.active.find(f=>f.who===id);
const KIND_WORD={ fish:['fish','fish'], bug:['bug','bugs'], fossil:['fossil','fossils'], shell:['beach find','beach finds'], flower:['flower','flowers'], fruit:['piece of fruit','pieces of fruit'],
  veg:['vegetable','vegetables'], herb:['herb','herbs'], berry:['berry','berries'], food:['home-cooked dish','home-cooked dishes'], furniture:['piece of furniture','pieces of furniture'] };
const KIND_VAL={ fish:350, bug:300, fossil:800, shell:120, flower:90, fruit:120, veg:150, herb:120, berry:110, food:450, furniture:1500 };
const favorItemName = f => f.kind==='kind' ? (KIND_WORD[f.item]||[f.item,f.item])[f.n>1?1:0] : ITEMS[f.item].name;
function favorTask(f){ if (f.to) return `Take the parcel to ${npcName(f.to)}`;
  if (f.kind==='do') return (DO_TASKS[f.item]||['Help out'])[0].replace('{n}',f.n).replace(/\{s\}/g,f.n>1?'s':'');
  return `Bring ${f.n>1?f.n+' ':''}${favorItemName(f)}${f.catch?' (catch one)':''}${f.cook?' (cook it)':''}`; }
/* v1.26: story quests aren't tied to one islander. Whoever already holds one keeps it; otherwise the islander it was
   written for takes it if they live here; otherwise it passes to someone who does (and on again if they move away). */
function storyWho(key){ const st=STORY[key]; if (!st) return null; Q.holder=Q.holder||{};
  const h=Q.holder[key]; if (h && livesHere(h)) return h;
  if (livesHere(st.who)){ Q.holder[key]=st.who; return st.who; }
  const busy=id=>Object.keys(STORY).some(k=>k!==key && Q.holder[k]===id && livesHere(id));
  const pool=S.town.res.filter(id=>!busy(id)), list=pool.length?pool:S.town.res.slice(); if (!list.length) return null;
  const pick=list[hashStr(key+':'+S.seed+':'+(S.town.left?Object.keys(S.town.left).length:0))%list.length]; Q.holder[key]=pick; return pick; }
const storyLines = (key, kind) => { const st=STORY[key]; return storyWho(key)===st.who ? st[kind] : (st['g'+kind]||st[kind]); };
function storyOpen(key){ const st=Q.story[key]; if (st==='done') return false;
  if (key==='wizard') return !S.magic.tower && (S.caught>=4 || discovered()>=10 || S.home.built);
  if (key==='beacon') return !GUEST && !!S.magic.tower && S.caught>=12;
  if (key==='swatches') return (S.friend[storyWho('swatches')]||0)>=6;
  return false; }
// A thank-you gift from someone's own list: clothes you don't own yet and things you haven't been given come first
function pickGift(who, r){ const T=FAVOR_THEMES[who]; if (!T) return null;
  const ok=id=>{ const it=ITEMS[id]; if (!it) return false; return it.kind==='wear' ? !ownsWear(id) : allowedFind(it); };
  const fresh=T.gifts.filter(id=>ok(id) && !Q.gifted.includes(id)), any=T.gifts.filter(ok), pool=fresh.length?fresh:any;
  return pool.length ? pool[Math.floor(r()*pool.length)] : null; }
function makeFavor(who, r){
  const T=FAVOR_THEMES[who]; if (!T) return null;
  const others=residents.filter(x=>x.spec.id!==who);
  const full=(()=>{ try { return museumFull(); } catch(e){ return false; } })();   // (favors are first rolled before the museum code has loaded)
  const asks=T.asks.filter(a=>(a.t!=='deliver' || others.length>0) && !(a.t==='do' && a.id==='potion' && !S.magic.tower) && !(a.t==='do' && a.id==='donate' && full));
  for (let tries=0; tries<14; tries++){
    const a=asks[Math.floor(r()*asks.length)], n=a.n[0]+Math.floor(r()*(a.n[1]-a.n[0]+1));
    const f={ who, kind:a.t, n, line:a.line, open:T.open[Math.floor(r()*T.open.length)], id:'f'+Date.now().toString(36)+Math.floor(r()*1e5) };
    if (a.t==='item'){ f.item = a.id==='native' ? S.nativeFruit : a.id; if (!ITEMS[f.item]) continue; f.value=ITEMS[f.item].price*n; }
    else if (a.t==='kind'){ f.item=a.id; f.value=(KIND_VAL[a.id]||200)*n; }
    else if (a.t==='catch'){ const m=Time.month(); const pool=Object.values(ITEMS).filter(i=>i.kind===a.id && inMonths(m,i.months) && (i.rarity??5)>=(GUEST?3:2.5) && (i.rarity??5)<6 && !i.weather); if (!pool.length) continue;
      const it=pool[Math.floor(r()*pool.length)]; f.kind='item'; f.item=it.id; f.n=1; f.catch=true; f.value=it.price*1.5; }
    else if (a.t==='cook'){ const rc=RECIPES[Math.floor(r()*RECIPES.length)]; f.kind='item'; f.item=rc.id; f.n=1; f.cook=true; f.value=ITEMS[rc.id].price*1.3; }
    else if (a.t==='deliver'){ const to=others[Math.floor(r()*others.length)]; f.kind='deliver'; f.to=to.spec.id; f.item='parcel'; f.n=1; f.value=500; }
    else if (a.t==='do'){ if (!DO_TASKS[a.id]) continue; f.item=a.id; f.prog=0; f.value=DO_TASKS[a.id][1]*n; }
    f.reward=Math.round((f.value+300)/50)*50; f.gift=pickGift(who, r); return f; }
  return null;
}
function rollFavors(r){
  if (VISIT) return;
  Q.offers={};
  const who=[...residents.map(x=>x.spec.id), ...KEEPER_IDS.filter(keeperAround)];
  for (const id of who){ if (favorFor(id) || Q.active.some(f=>f.to===id)) continue;
    const story=Object.keys(STORY).find(k=>storyWho(k)===id && storyOpen(k)); if (story){ Q.offers[id]={ story }; continue; }
    if (Q.active.length<MAX_FAVORS && r()<(KEEPER_IDS.includes(id)?0.32:0.42)){ const f=makeFavor(id, r); if (f) Q.offers[id]=f; } }
}
function haveFor(f){ if (f.story){ return STORY[f.story].need.every(([id,n])=> ITEMS[id] ? countItem(id)>=n : S.inv.filter(s=>ITEMS[s.id].kind===id).reduce((a,s)=>a+s.n,0)>=n); }
  if (f.kind==='do') return (f.prog||0)>=f.n;
  if (f.kind==='kind') return S.inv.filter(s=>ITEMS[s.id].kind===f.item).reduce((a,s)=>a+s.n,0)>=f.n; return countItem(f.item)>=f.n; }
function takeFor(needs){ for (const [id,n] of needs){ if (ITEMS[id]) { removeItem(id,n); continue; } let left=n; for (let i=S.inv.length-1;i>=0&&left>0;i--){ const s=S.inv[i]; if(ITEMS[s.id].kind!==id) continue; const k=Math.min(left,s.n); removeAt(i,k); left-=k; } } }
// Old favors (from before v1.19) still pay out with a random bonus
function favorBonus(){
  const x=Math.random();
  if (x<0.3){ const id=POTIONS[Math.floor(Math.random()*3)]; return { item:id }; }
  if (x<0.5){ const st=grantRandomStyle(); if (st) return { style:st }; }
  if (x<0.65){ const fr=NATIVE_FRUITS.filter(f=>f!==S.nativeFruit); return { item:fr[Math.floor(Math.random()*fr.length)], n:2 }; }
  if (x<0.8){ const pool=Object.values(ITEMS).filter(i=>i.kind==='furniture' && i.shop==='rare' && (i.rarity??FR.c)>=1.5); return { item:pool[Math.floor(Math.random()*pool.length)].id }; }
  return null;
}
function receive(id){ if (ITEMS[id].kind==='wear'){ grantWear(id); return; } const r=addItem(id); if (r) itemToast(id, r==='new', 'Received'); else { dropNear(id, player.pos); toast(`Your bag is full, so the ${ITEMS[id].name} is on the ground.`); } }
function giveReward(npc, f, then){
  const T=FAVOR_THEMES[npc.id], c={ c:npc.c };
  const lines=[fill(T ? T.thanks[Math.floor(Math.random()*T.thanks.length)] : ['Thank you so much, {p}! Here, this is for you, {c}.','You\'re the best, {c}! Take this, please.','Perfect! I owe you one, {c}. Here.'][Math.floor(Math.random()*3)], c)];
  addClams(f.reward); Q.done=(Q.done||0)+1;
  if (npc.res) S.friend[npc.id]=(S.friend[npc.id]||0)+3; else (S.kfriend=S.kfriend||{})[npc.id]=(S.kfriend[npc.id]||0)+3;   // keepers' goodwill is kept apart (bag upgrades count islander best friends)
  let gift=null, b=null;
  if ('gift' in f){ gift=f.gift; if (!gift || !ITEMS[gift] || (ITEMS[gift].kind==='wear' && ownsWear(gift))) gift=pickGift(npc.id, Math.random); }
  else b=favorBonus();
  if (gift){ Q.gifted.push(gift); const it=ITEMS[gift]; lines.push(fill(it.kind==='wear' ? `And this ${it.name.toLowerCase()} is for you. I think it'll suit you, {c}.` : `And I want you to have this ${it.name.toLowerCase()}, {c}.`, c)); }
  if (b && b.item) lines.push(fill(`Oh, and I found ${b.n?b.n+' ':article(ITEMS[b.item].name)+' '}${ITEMS[b.item].name}${b.n>1?'s':''} lying around. You should have ${b.n>1?'them':'it'}, {c}.`, c));
  if (b && b.style) lines.push(fill(`I also had a swatch book I don't need. Now you can use ${b.style} on your house, {c}.`, c));
  let tk=null; if (!GUEST && !VISIT && Math.random()<0.04){ tk=randomTicket(); lines.push(fill(`Oh, and here's a boat ticket. I'll never use it. Skipper Wick at the dock will know where it goes, {c}.`, c)); }
  save(); Snd.coin(); sparkle(npc.pos.clone().add(new THREE.Vector3(0,2,0)));
  dialog(npc.name, npc.voice, lines, ()=>{ toast(`Favor done! +${fmt(f.reward)} clams`, null, 'new'); if (gift) receive(gift); if (tk) receive(tk); if (b && b.item){ for(let i=0;i<(b.n||1);i++) receive(b.item); } checkAch(); then&&then(); });
}
function finishStory(res, key, then){
  const st=STORY[key], c={ c:res.spec.catch }; takeFor(st.need); Q.story[key]='done'; delete Q.offers[res.spec.id]; S.friend[res.spec.id]=(S.friend[res.spec.id]||0)+4; save();
  dialog(res.spec.name, res.spec.voice, storyLines(key,'done').map(l=>fill(l,c)), ()=>{
    if (key==='wizard'){ if (raiseTower()){ const [tx,tz]=PLACES.tower, dir=Math.abs(tx)>Math.abs(tz) ? (tx>0?'east':'west') : (tz>0?'south':'north');
      setTimeout(()=>{ toast(`A wizard tower appeared ${dir} of the plaza!`, null, 'new'); }, 400); } }
    if (key==='beacon'){ S.magic.beacon=true; delete S.magic.merchantLast; save(); toast('The portal beacon is lit!', null, 'new', 'Traveling merchants can find the island now. Fennick should turn up every few days.'); Snd.fanfare(); }
    if (key==='swatches'){ const got=[]; for(let i=0;i<4;i++){ const g=grantRandomStyle(); if(g) got.push(g); } toast(got.length?`New house styles: ${got.join(', ')}`:'You already own every style!', null, 'new'); Snd.fanfare(); }
    checkAch(); then&&then(); });
}
function favorLine(off, c){ const nm = off.kind==='kind' ? favorItemName(off) : off.kind==='do' ? '' : ITEMS[off.item].name+(off.n>1 && !off.catch && !off.cook && !/s$/.test(ITEMS[off.item].name) ? 's' : '');
  return fill(off.line.replace(/\{n\}/g,off.n).replace(/\{s\}/g,off.n>1?'s':'').replace('{item}', nm).replace('{to}', npcName(off.to)), c); }
// Talk options for anyone who asks favors: one they're offering, one you're doing for them, a parcel for them
function favorChoices(npc, menu){
  if (VISIT || !npc) return [];
  const id=npc.id, out=[], c={ c:npc.c }, nm=npc.name, v=npc.voice;
  const parcel=Q.active.find(f=>f.to===id);
  if (parcel) out.push({ label:`Parcel from ${npcName(parcel.who)}`, fn:()=>{ if(!countItem('parcel')){ dialog(nm,v,[fill('A parcel for me? I don\'t see one in your bag, {c}.',c)],menu); return; } removeItem('parcel',1); Q.active.splice(Q.active.indexOf(parcel),1); const from=npcOf(parcel.who)||npc; S.friend[id]=(S.friend[id]||0)+2;
    dialog(nm,v,[fill(`From ${from.name}? How sweet! Thank you for bringing it, {c}.`,c)], ()=>giveReward(from, parcel, menu)); } });
  const mine=favorFor(id);
  if (mine) out.push({ label:'About your favor...', fn:()=>{
    const skip = { label:'Can I skip this one?', alt:true, fn:()=>{ Q.active.splice(Q.active.indexOf(mine),1); if (mine.to && countItem('parcel')) removeItem('parcel',1); save(); dialog(nm,v,[fill('Of course! Don\'t worry about it, {c}.',c)], menu); } };
    if (mine.to){
      if (!countItem('parcel')){ if (!canAdd('parcel')){ dialog(nm,v,[fill('Lost the parcel? I have a spare, but your bag is full, {c}.',c)], menu); return; } addItem('parcel'); save(); dialog(nm,v,[fill(`Lost it? No worries, here's another one for ${npcName(mine.to)}, {c}.`,c)], menu); return; }
      dialog(nm,v,[fill(`Did you take my parcel to ${npcName(mine.to)}? They're not far, {c}.`,c)], null, [{ label:'On my way!', fn:menu }, skip]); return; }
    if (mine.kind==='do'){
      if (!haveFor(mine)){ dialog(nm,v,[fill(`How's it going? ${favorTask(mine)}: you're at ${mine.prog||0} of ${mine.n}. No rush, {c}!`,c)], null, [{ label:'Still on it', fn:menu }, skip]); return; }
      Q.active.splice(Q.active.indexOf(mine),1); dialog(nm,v,[fill('You did it? All of it? Oh, {c}!',c)], ()=>giveReward(npc, mine, menu)); return; }
    if (!haveFor(mine)){ dialog(nm,v,[fill(`Still hoping for ${mine.n>1?mine.n+' ':''}${favorItemName(mine)}, {c}. No rush!`,c)], null, [{ label:'Still looking', fn:menu }, skip]); return; }
    dialog(nm,v,[fill('Oh! Is that for me?',c)], null, [{ label:'Here you go!', fn:()=>{ if(mine.kind==='kind') takeFor([[mine.item,mine.n]]); else removeItem(mine.item,mine.n); Q.active.splice(Q.active.indexOf(mine),1); giveReward(npc, mine, menu); } }, { label:'Not yet', alt:true, fn:menu }]); } });
  const off=Q.offers[id];
  if (off && off.story && npc.res){ const st=STORY[off.story], res=npc.res;
    out.unshift({ label: Q.story[off.story]==='asked' ? 'About that wish...' : 'You look thoughtful', fn:()=>{
      if (Q.story[off.story]==='asked' && haveFor(off)) { dialog(nm,v,[fill('Did you bring them, {c}?',c)], null, [{ label:'I did!', fn:()=>finishStory(res, off.story, menu) }, { label:'Not yet', alt:true, fn:menu }]); return; }
      Q.story[off.story]='asked'; save(); dialog(nm,v,storyLines(off.story,'ask').map(l=>fill(l,c)), menu); } }); }
  else if (off && !off.story){
    out.unshift({ label:'Need a hand?', fn:()=>{
      const g=off.gift && ITEMS[off.gift], pay = g ? `If you do, I'll give you my ${g.name.toLowerCase()}, and ${fmt(off.reward)} clams on top.` : `I'd pay you ${fmt(off.reward)} clams for it.`;
      dialog(nm,v,[off.open?fill(off.open,c):null, favorLine(off,c), pay].filter(Boolean), null, [
        { label:'Sure!', fn:()=>{ if (Q.active.length>=MAX_FAVORS){ dialog(nm,v,[fill('You look busy already! Finish a favor or two first, {c}.',c)], menu); return; }
            if (off.to){ if(!canAdd('parcel')){ dialog(nm,v,[fill('Your bag looks full, {c}. Make room for the parcel first.',c)], menu); return; } addItem('parcel'); }
            if (off.kind==='do') off.prog=0;
            Q.active.push(off); delete Q.offers[id]; save(); Snd.jingle(); toast(`Favor for ${nm}: ${favorTask(off)}`, g?thumb(off.gift):null); menu(); } },
        { label:'Maybe later', alt:true, fn:menu } ]); } });
  }
  return out;
}
function favorsHTML(){
  if (!Q.active.length) return '<div class="muted">No favors right now. Islanders and shopkeepers sometimes need a hand, so stop and talk!</div>';
  return Q.active.map(f=>{ const ready=!f.to && haveFor(f), prog=f.kind==='do'?` · ${Math.min(f.prog||0,f.n)} of ${f.n}`:'', g=f.gift&&ITEMS[f.gift];
    return `<div class="favor"><b>${npcName(f.who)}</b>${favorTask(f)}${prog}${ready?` · <span style="color:#4f9a3a;font-weight:600">${f.kind==='do'?'Done! Go tell them':'Ready to hand over'}</span>`:''}
      <div class="fg">${g?`<img src="${thumb(f.gift)}">`:''}<span class="muted">${fmt(f.reward)} clams${g?' + '+g.name:''}</span></div></div>`; }).join('');
}

/* ---------- v1.19 wardrobe: clothes go straight into your wardrobe, never your bag ---------- */
const ownsWear = id => S.wardrobe.includes(id);
function grantWear(id, quiet){ if (!ITEMS[id] || ITEMS[id].kind!=='wear' || ownsWear(id)) return false; S.wardrobe.push(id); save();
  if (!quiet){ toast(`New clothes: ${ITEMS[id].name}`, thumb(id), 'new', 'Wear it from Menu, Change my look.'); Snd.fanfare(); } checkAch(); return true; }
// what the character creator may show: the original outfits and colors plus whatever you own
function wardrobeOwned(){ const o={ outfits:new Set(), colors:new Set(), acc:{ hat:new Set(), face:new Set(), neck:new Set(), back:new Set() } };
  for (const id of S.wardrobe){ const w=ITEMS[id].wear; if (w.t==='outfit') o.outfits.add(w.i); else if (w.t==='color') o.colors.add(w.i); else { for (const [slot,list] of Object.entries(BY_SLOT)){ const k=list.findIndex(a=>a.id===w.i); if (k>=0) o.acc[slot].add(k+1); } } }
  return o; }
const wearKind = it => it.wear.t==='outfit' ? 'Outfit' : it.wear.t==='color' ? 'Outfit color' : ({ hat:'Hat', face:'Glasses', neck:'Neckwear', back:'Worn on your back' })[(Object.entries(BY_SLOT).find(([,l])=>l.some(a=>a.id===it.wear.i))||['hat'])[0]];
// Pemberton's clothes rack: 7 pieces a day, rarer ones turn up less often
function clothesStock(){ const r=mulberry32(hashStr(S.day.key+':clothes:'+S.seed)), pool=WEAR_IDS.map(id=>ITEMS[id]).filter(i=>i.shop==='clothes'), out=[];
  for (let k=0;k<7 && pool.length;k++){ const tot=pool.reduce((a,i)=>a+i.rarity,0); let x=r()*tot, j=0; for (;j<pool.length-1;j++){ x-=pool[j].rarity; if (x<=0) break; } out.push(pool.splice(j,1)[0].id); }
  return out; }

/* ---------- v1.19 achievements ---------- */
// track(): count something you did. Feeds "do" favors and the achievement stats (S.stats.t_*).
function track(ev, n=1){ if (!S.stats || VISIT && ev!=='visit') return; const k='t_'+ev; S.stats[k]=(S.stats[k]||0)+n;
  const act=(S.quests&&S.quests.active)||[];
  for (const f of act) if (f.kind==='do' && f.item===ev && (f.prog||0)<f.n){ f.prog=Math.min(f.n,(f.prog||0)+n);
    if (f.prog>=f.n){ toast(`${favorTask(f)}: done!`, null, 'new', `Go tell ${npcName(f.who)}.`); Snd.jingle(); } }
  achDirty=true; }
let achDirty=true, achTicks=0;
const seenKinds = kind => Object.keys(S.seen).filter(id=>ITEMS[id] && ITEMS[id].kind===kind).length;
function achValue(stat){ const st=S.stats||{};
  switch (stat){
    case 'bugKinds': return seenKinds('bug'); case 'fishKinds': return seenKinds('fish'); case 'fossilKinds': return seenKinds('fossil'); case 'shellKinds': return seenKinds('shell');
    case 't_cook': return Math.max(st.t_cook||0, (S.cook&&S.cook.made)||0); case 'recipes': return (S.cook&&S.cook.kinds||[]).length;
    case 't_craft': return Math.max(st.t_craft||0, ((S.craft&&S.craft.made)||0)+((S.rare&&S.rare.made)||0)); case 'plans': return (S.rare&&S.rare.plans||[]).length;
    case 'museum': return donatedCount(); case 'favors': return Q.done||0; case 'stories': return Object.values(Q.story).filter(x=>x==='done').length;
    case 'bestFriends': return bestFriends(); case 'house': return S.home&&S.home.built?1:0; case 'cells': return cellsBuilt(); case 'rooms': return S.home&&S.home.built?S.home.plan.rooms.length:0;
    case 'styles': return Object.keys(S.styles||{}).filter(k=>{ const i=k.indexOf(':'), list=k.slice(0,i), opts=BUILD[list]; if (!opts) return false; const idx=opts.findIndex(o=>String(Array.isArray(o)?o[0]:o)===k.slice(i+1)); return idx>=freeCount(list); }).length;   // unlocked, not the free starters case 'placed': return S.placed.length; case 'wallet': return Math.max(st.maxClams||0, S.clams);
    case 'shops': return shopsBacked(); case 'grandShop': return Math.max(...['general','aquarium','garden'].map(k=>(S.shops[k]&&S.shops[k].tier)||0));
    case 'hall': return S.town.hall||0; case 'islanders': return S.town.res.length; case 'tower': return S.magic.tower?1:0;
    case 'wardrobe': return S.wardrobe.length; case 'pack': return (S.pack??-1)+1; case 'bike': return S.bike?1:0; case 'gardens': return (S.gardens||[]).length;
    case 'heirloom': return Object.entries(S.tools||{}).some(([t,o])=>o && TOOLS[t] && TOOLS[t].tiers[o.tier] && TOOLS[t].tiers[o.tier].forever)?1:0;
    default: return st[stat]||0; } }
const achCount = () => S.ach ? Object.keys(S.ach.got).length : 0;
function checkAch(){ if (VISIT) return; const first=!S.ach; if (first) S.ach={ got:{} };
  const fresh=[]; for (const a of ACHIEVEMENTS){ if (S.ach.got[a.id]) continue; let v=0; try { v=achValue(a.stat); } catch(e){ continue; } if (v>=a.n){ S.ach.got[a.id]=Date.now(); fresh.push(a); } }
  achDirty=false; if (!fresh.length){ if (first) save(); return; } save();
  if (first){ setTimeout(()=>toast(`You've already earned ${fresh.length} achievement${fresh.length>1?'s':''}!`, medalImg(fresh[fresh.length-1]), 'new', 'See them in Menu, Achievements.'), 4000); return; }
  Snd.fanfare(); fresh.slice(0,3).forEach((a,i)=>setTimeout(()=>toast(`Achievement: ${a.name}`, medalImg(a), 'new', a.desc), i*900));
  if (fresh.length>3) setTimeout(()=>toast(`And ${fresh.length-3} more achievements!`, null, 'new'), 2700); }
// once a second: things that depend on the clock, the weather or your wallet
function achTick(){ if (VISIT || !S.stats || !S.day) return; const st=S.stats, h=Time.hour();
  if (S.clams>(st.maxClams||0)) st.maxClams=S.clams;
  if (st.lastDay!==S.day.key){ st.lastDay=S.day.key; st.t_day=(st.t_day||0)+1; achDirty=true; }
  const flag=k=>{ if (!st[k]){ st[k]=1; achDirty=true; } };
  if (h<4) flag('t_nightowl'); if (h>=5 && h<7) flag('t_earlybird'); if (World.weather==='snow') flag('t_snowday'); if (World.weather==='rain') flag('t_rainday');
  if (achDirty || ++achTicks%5===0) checkAch(); }   // every 5 s anyway, for things nothing tracks (museum, house, furniture)
// medals: a ribbon and a disc in the group's colors, with tier stars
const ACH_COL = { bugs:['#7cc35a','#3f8a2a'], fish:['#5ab0e0','#2a6aa8'], dig:['#e8b070','#a8703a'], trees:['#9ad06a','#5a8a3a'], garden:['#f0a0c0','#c0507a'], kitchen:['#f2c060','#c08a20'],
  museum:['#c8b090','#806a4a'], friends:['#f59a9a','#c0505a'], home:['#e8a070','#b0603a'], money:['#f2d060','#c09a20'], town:['#b8a0e8','#7a5ac0'], style:['#f08ad0','#b04a90'], gear:['#a0b8c8','#5a7a90'], time:['#8ab0e8','#4a6ab0'] };
const MEDAL={};
function medalImg(a, locked){ const key=locked?'locked':a.id; if (MEDAL[key]) return MEDAL[key];
  const cv=document.createElement('canvas'); cv.width=cv.height=96; const x=cv.getContext('2d'); const [c1,c2]=locked?['#d8cfc0','#b0a490']:(ACH_COL[a.group]||['#f2d060','#c09a20']);
  x.fillStyle=locked?'#c8bca8':c2; x.beginPath(); x.moveTo(30,4); x.lineTo(46,40); x.lineTo(38,44); x.lineTo(20,8); x.fill(); x.beginPath(); x.moveTo(66,4); x.lineTo(50,40); x.lineTo(58,44); x.lineTo(76,8); x.fill();
  const g=x.createRadialGradient(40,46,4,48,56,34); g.addColorStop(0,'#fff8e0'); g.addColorStop(0.35,c1); g.addColorStop(1,c2); x.fillStyle=g; x.beginPath(); x.arc(48,58,32,0,Math.PI*2); x.fill();
  x.lineWidth=4; x.strokeStyle='rgba(255,255,255,.75)'; x.beginPath(); x.arc(48,58,25,0,Math.PI*2); x.stroke();
  x.fillStyle=locked?'#fff':'#fffdf4'; x.textAlign='center'; x.textBaseline='middle';
  if (locked){ x.font='bold 30px Fredoka, sans-serif'; x.fillText('?',48,59); }
  else { const tiers=ACHIEVEMENTS.filter(b=>b.stat===a.stat), t=tiers.indexOf(a), stars=tiers.length<2?1:t<tiers.length/3?1:t<tiers.length*2/3?2:3;
    const star=(cx,cy,R)=>{ x.beginPath(); for (let i=0;i<10;i++){ const an=-Math.PI/2+i*Math.PI/5, rr=i%2?R*0.45:R; x.lineTo(cx+Math.cos(an)*rr, cy+Math.sin(an)*rr); } x.closePath(); x.fill(); };
    if (stars===1) star(48,58,15); else if (stars===2){ star(38,58,11); star(58,58,11); } else { star(48,50,10); star(36,64,9); star(60,64,9); } }
  return MEDAL[key]=cv.toDataURL(); }
function openAchievements(){
  checkAch(); const got=S.ach.got, n=achCount();
  let h=`<div class="notice"><div class="achHead"><b>${n} of ${ACHIEVEMENTS.length} earned</b><div class="bar"><div style="width:${n/ACHIEVEMENTS.length*100}%"></div></div></div><span class="muted">The ones you haven't earned yet stay secret. Keep exploring!</span></div>`;
  for (const [g,name] of ACH_GROUPS){ const list=ACHIEVEMENTS.filter(a=>a.group===g); if (!list.length) continue; const k=list.filter(a=>got[a.id]).length;
    h+=`<div class="achGrp">${name} <span>· ${k} of ${list.length}</span></div><div class="achGrid">`;
    for (const a of list.slice().sort((p,q)=>(got[q.id]?1:0)-(got[p.id]?1:0))) h+= got[a.id]
      ? `<div class="ach"><img src="${medalImg(a)}"><div><div class="an">${a.name}</div><div class="ad">${a.desc}</div></div></div>`
      : `<div class="ach locked"><img src="${medalImg(a,true)}"><div><div class="an">???</div><div class="ad">Hidden</div></div></div>`;
    h+='</div>'; }
  openPanel('Achievements'); pBody.innerHTML=h;
}

/* ---------- Wizard map modes: move a building, shape the land ---------- */
let magicMode=null;   // { kind:'move'|'land', ... }
const MOVABLE = () => [['home','Your house',MAGIC.moveHome], ['shop','Pemberton\'s shop',MAGIC.moveOther], ['museum','Museum',MAGIC.moveOther], ['aquarium','Tidepool Aquarium Supply',MAGIC.moveOther], ['garden','Bug & Bloom',MAGIC.moveOther], ...(PLACES.tower?[['tower','Wizard tower',MAGIC.moveOther]]:[]), ...(PLACES.hall?[['hall','Town hall',MAGIC.moveOther]]:[]), ...residents.map(r=>[r.spec.id, r.spec.name+'\'s house', MAGIC.moveOther])];
const FOOTR = { home:6, shop:4.5, museum:7.5, aquarium:6, garden:6.5, tower:3.5, hall:HALL_FOOT, portal:PORT_FOOT };
const footOf = k => k==='home' ? homeFoot() : (FOOTR[k] || 4.2);
// How far the player's house reaches from its lot center (it can grow well past the original lot)
function homeFoot(){ if (!S.home || !S.home.built) return FOOTR.home; let m=0; for (const r of S.home.plan.rooms) for (const [i,j] of [[r.x,r.z],[r.x+r.w,r.z],[r.x,r.z+r.d],[r.x+r.w,r.z+r.d]]) m=Math.max(m, Math.hypot(hex_(i), hez_(j))); return Math.max(FOOTR.home, m+1.2); }
function openMoveList(){
  let h='';
  for (const [k,nm,cost] of MOVABLE()) h+=`<div class="row"><div class="grow"><div class="nm">${nm}</div><div class="sub">${fmt(cost)} clams</div></div><button class="btn" data-mv="${k}" ${S.clams<cost?'disabled':''}>Move</button></div>`;
  openPanel('Move a building'); pBody.innerHTML=h;
  pBody.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ panelClose=null; closePanel(); startMagic('move', b.dataset.mv); });
}
function magicCam(){ return magicMode && { camT:magicMode.camT, dist:magicMode.dist }; }
function startMagic(kind, key){
  if (riding) setRiding(false); stopMove();
  const at = kind==='move' ? new THREE.Vector3(PLACES[key][0], 0, PLACES[key][1]) : player.pos.clone();
  magicMode={ kind, key, camT:at.clone().setY(groundY(at.x,at.z)), dist:kind==='move'?34:26, tool:'raise', pend:{}, ghost:null, at:null, ok:false };
  $('#hud').classList.add('magic');
  if (kind==='move'){ const r=footOf(key); const g=new THREE.Group(); const ring=new THREE.Mesh(new THREE.CylinderGeometry(r,r,0.5,40,1,true), new THREE.MeshBasicMaterial({ color:0x9a7ad8, transparent:true, opacity:0.3, side:THREE.DoubleSide, depthWrite:false })); ring.position.y=0.25; g.add(ring);
    g.userData.ring=ring; scene.add(g); magicMode.ghost=g;
    // a see-through copy of the real building follows your finger, so you can see exactly how it will sit
    const src=bldObj(key); if (src){ const gh=ghostOf(src, PLACES[key]); scene.add(gh); magicMode.bghost=gh; }
    magicPlace(at.x, at.z+0.01); }
  else { magicMode.grid=new THREE.Group(); scene.add(magicMode.grid); magicMode.marks=new THREE.Group(); scene.add(magicMode.marks); drawGrid(); }
  renderMagicBar();
}
function endMagic(keep){ if (!magicMode) return; const M=magicMode; if (M.hid && !keep) for (const e of M.hid) e.obj.visible=true; if (M.ghost) scene.remove(M.ghost); if (M.grid) scene.remove(M.grid); if (!keep){ if (M.marks) scene.remove(M.marks); if (M.bghost) scene.remove(M.bghost); } magicMode=null; $('#magicBar').classList.remove('show'); if (!cine) $('#hud').classList.remove('magic'); }
// the building entity for a place key
function bldObj(key){ const e = key==='home'?houseEnt : key==='shop'?storeEnt : key==='museum'?museumEnt : key==='tower'?towerEnt : key==='hall'?hallEnt : shopEnts[key]
    || residentHomes.find(b=>!b.removed && PLACES[key] && Math.hypot(b.pos.x-PLACES[key][0], b.pos.z-PLACES[key][1])<4);
  return e && !e.removed ? e.obj : null; }
/* A ghost copy of a building: the same meshes, frozen where they stand, with see-through lilac materials.
   Its group sits at the origin of the place it came from; move the group by the offset to the new spot.
   g.userData.solid() swaps the real materials back in (used when the spell lands). */
function ghostOf(src, from){
  src.updateMatrixWorld(true); const g=new THREE.Group(), base=new THREE.Vector3(from[0], groundY(from[0],from[1]), from[1]), mats=[], swaps=[];
  const inv=new THREE.Matrix4().makeTranslation(-base.x, -base.y, -base.z);
  const gm=m=>{ const c=m.clone(); c.transparent=true; c.opacity=0.55*(m.opacity??1); c.depthWrite=true; if (c.emissive){ c.emissive=new THREE.Color(0x6a4ab8); c.emissiveIntensity=0.45; } mats.push(c); return c; };
  const walk=o=>{ if (!o.visible) return;
    if ((o.isMesh || o.isSprite) && o.material && !(o.material.visible===false)){ const orig=o.material, mat=Array.isArray(orig)?orig.map(gm):gm(orig); let c;
      if (o.isInstancedMesh){ c=new THREE.InstancedMesh(o.geometry, mat, o.count); c.instanceMatrix.array.set(o.instanceMatrix.array); }
      else if (o.isSprite) c=new THREE.Sprite(mat); else c=new THREE.Mesh(o.geometry, mat);
      c.matrixAutoUpdate=false; c.matrix.multiplyMatrices(inv, o.matrixWorld); c.castShadow=false; c.renderOrder=2; g.add(c); swaps.push([c, orig]); }
    for (const ch of o.children) walk(ch); };
  walk(src);
  g.userData.base=base; g.userData.mats=mats;
  g.userData.tint=bad=>{ for (const m of mats) if (m.emissive) m.emissive.setHex(bad?0xb03a2a:0x6a4ab8); };
  g.userData.solid=()=>{ for (const [c,orig] of swaps){ c.material=orig; c.castShadow=true; } };
  return g; }
const footprintClear = (x,z,r,self) => {
  const msgs=[];
  if (Math.hypot(x,z)/islandR(Math.atan2(z,x))>0.74) return 'Too close to the shore.';
  if (Math.hypot(x,z)<r+8) return 'That\'s the plaza.';
  if (polyDist(x,z,RIVER)<r+5 || Math.hypot(x-POND.x,z-POND.z)<POND.r+r+5) return 'Too close to the water.';
  if (nearFall(x,z,r)) return 'Too close to the waterfall.';
  if (x>DOCK.x0-r-6 && Math.abs(z-DOCK.z)<r+5) return 'That\'s the way to the dock.';
  for (const k in PLACES){ if (k===self || k==='plaza' || k==='board') continue; const p=PLACES[k]; if (Math.hypot(x-p[0],z-p[1]) < r+footOf(k)+2.5) return 'Too close to another building.'; }
  let lo=99, hi=-99; for (let i=0;i<13;i++){ const a=i/12*TAU, rr=i===12?0:r, px=x+Math.cos(a)*rr, pz=z+Math.sin(a)*rr; if (!walkable(px,pz) && !inRects(px,pz,0) || (TERRA_ANY && terraWet(px,pz)>0)) return 'There\'s water or a cliff in the way.'; const h=rawHeight(px,pz); lo=Math.min(lo,h); hi=Math.max(hi,h); }
  if (hi-lo>3.2) return 'The ground there is too steep.';
  if (!walkable(x, z+r+1.5)) return 'The front door would open onto water or a cliff.';
  const stuff=[...GCELLS.keys()].filter(k=>{ const [i,j]=k.split(',').map(Number); return Math.hypot(i*CELL-x,j*CELL-z)<r+0.5; }).length + S.plants.filter(p=>Math.hypot(p.x-x,p.z-z)<r+0.5 && !gardenAtXZ(p.x,p.z)).length + S.placed.filter(p=>p.x<500 && Math.hypot(p.x-x,p.z-z)<r+0.5).length;
  if (stuff) return `Clear the plants, garden or furniture there first.`;
  return null; };
function magicPlace(x,z){
  const M=magicMode; if (!M || M.kind!=='move') return; M.at=[+x.toFixed(1), +z.toFixed(1)];
  M.ghost.position.set(x, groundY(x,z), z); const why=footprintClear(x,z,footOf(M.key),M.key); M.ok=!why; M.why=why;
  M.ghost.userData.ring.material.color.setHex(M.ok?0x9a7ad8:0xe2604d);
  if (M.bghost){ M.bghost.position.set(x, groundY(x,z), z); M.bghost.userData.tint(!M.ok); }
  // trees and rocks under the new spot won't be there afterwards, so the preview leaves them out too
  const rr=footOf(M.key)+0.6; for (const e of [...trees, ...rocks]) if (!e.removed){ const under=Math.hypot(e.pos.x-x, e.pos.z-z)<rr; if (under) (M.hid=M.hid||new Set()).add(e); e.obj.visible=!under; }
  renderMagicBar();
}
// Land: grid of TC cells around the camera, and markers for planned changes
function drawGrid(){ const M=magicMode; if(!M||M.kind!=='land') return; const g=M.grid; while(g.children.length) g.remove(g.children[0]);
  const ci=Math.floor(M.camT.x/TC), cj=Math.floor(M.camT.z/TC), R=11, pts=[];
  const sea = M.tool==='land'||M.tool==='sea';
  for (let i=ci-R;i<=ci+R;i++) for (let j=cj-R;j<=cj+R;j++){ const x0=i*TC, z0=j*TC; const y=(x,z)=>Math.max(groundY(x,z),0.04)+0.06; if (!sea && rawHeight(x0+TC/2,z0+TC/2)<0.1 && !terraAt(x0+1,z0+1)) continue; if (sea && Math.hypot(x0,z0)>HGR) continue;
    pts.push(new THREE.Vector3(x0,y(x0,z0),z0), new THREE.Vector3(x0+TC,y(x0+TC,z0),z0), new THREE.Vector3(x0,y(x0,z0),z0), new THREE.Vector3(x0,y(x0,z0+TC),z0+TC)); }
  const ls=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.35 })); g.add(ls); M.gridAt=[ci,cj]; }
/* Land preview (v1.3): each planned square shows what it will become. Raised ground is a block of grass and earth,
   lowered ground shows the new level through the old one, dug water shows the water, new land shows sand. */
const PV = (()=>{ const t=c=>new THREE.MeshStandardMaterial({ color:c, roughness:0.95 }), see=(c,o)=>new THREE.MeshBasicMaterial({ color:c, transparent:true, opacity:o, depthWrite:false, depthTest:false });
  return { grass:t(0x74bd52), dirt:t(0x8a6a48), sand:t(0xe8d49a), cut:see(0xe0a040,0.28), low:see(0x5fae43,0.8), water:see(0x2f8fd0,0.82),
    edge:new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.8, depthTest:false }) }; })();
const pvBox = (w,h) => new THREE.BoxGeometry(w,h,w).translate(0,h/2,0);
const pvPlane = w => new THREE.PlaneGeometry(w,w).rotateX(-Math.PI/2);
function cellPreview(k, p){
  const [i,j]=k.split(',').map(Number), x=(i+0.5)*TC, z=(j+0.5)*TC, h0=groundY(x,z), w=TC*0.98, g=new THREE.Group(); g.position.set(x,0,z); g.userData={ k, x, z, h0, parts:[] };
  const add=(m,kind)=>{ g.add(m); g.userData.parts.push([m,kind,m.position.y]); m.renderOrder=3; return m; };
  if (p.L===1){ const b=add(new THREE.Mesh(pvBox(w, 0.75+Math.max(0,-h0)), [PV.dirt,PV.dirt,PV.sand,PV.dirt,PV.dirt,PV.dirt]), 'rise'); b.position.y=Math.min(h0,0)-0.15; }
  else if (p.L===0){ const pl=add(new THREE.Mesh(pvPlane(w), PV.water), 'water'); pl.position.y=Math.max(h0,0)+0.06; }
  else {
    const h1 = h0 + (p.d||0)*TIER.step;
    if (p.d>0){ const b=add(new THREE.Mesh(pvBox(w, h1-h0+0.05), [PV.dirt,PV.dirt,PV.grass,PV.dirt,PV.dirt,PV.dirt]), 'rise'); b.position.y=h0-0.05; }
    if (p.d<0){ const c=add(new THREE.Mesh(pvBox(w, h0-h1), PV.cut), 'cut'); c.position.y=h1; const pl=add(new THREE.Mesh(pvPlane(w), PV.low), 'sink'); pl.position.y=h1+0.02; pl.userData.from=h0; }
    if (p.w===1 || p.w===2){ const pl=add(new THREE.Mesh(pvPlane(w*(p.w===2?0.9:1)), PV.water), 'water'); pl.position.y=h1-0.35; }
    if (p.w===0){ const b=add(new THREE.Mesh(pvBox(w, 0.5), [PV.dirt,PV.dirt,PV.grass,PV.dirt,PV.dirt,PV.dirt]), 'rise'); b.position.y=h0-0.45; } }
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w,w).rotateX(-Math.PI/2)), PV.edge); e.position.y=Math.max(h0,0)+0.08; e.renderOrder=4; g.add(e);
  return g; }
function drawMarks(){ const M=magicMode; const g=M.marks; while(g.children.length) g.remove(g.children[0]);
  for (const [k,p] of Object.entries(M.pend)) g.add(cellPreview(k,p)); }
const pendCost = () => Object.values(magicMode.pend).reduce((a,p)=>a + Math.abs(p.d||0)*(p.d>0?MAGIC.raise:MAGIC.lower) + (p.w===1||p.w===2?MAGIC.water:0) + (p.w===0?MAGIC.fill:0) + (p.L===1?LAND_COST:p.L===0?SEA_COST:0), 0);
/* Making land: Wendell raises the seabed next to the shore into new low ground, one 2.5 m square at a time.
   Opens once the Grand Town Hall stands. New land has to touch the island (or other new land) and can't block the dock. */
const LAND_COST=4000, SEA_COST=2500;
const landMagicOK = () => (DEV&&S.devMagic) || (S.town.hall||0)>=2;
function landSeaTap(k, cx, cz, cur, pend, tool, no){
  const M=magicMode, isLand=(x,z)=>{ const kk=terraKey(x,z), c=TERRA[kk], p=M.pend[kk]; if (p && p.L!==undefined) return !!p.L; return (c&&c.L) || rawHeight(x,z)>0.25; };
  if (!landMagicOK()) return no('Wendell can\'t raise land from the sea yet. Maybe someday.');
  if (tool==='sea'){ if (pend.L===1){ delete pend.L; } else if (cur.L){ if (S.plants.some(p=>terraKey(p.x,p.z)===k) || S.placed.some(p=>p.x<500&&terraKey(p.x,p.z)===k)) return no('Move the plants or furniture there first.'); if (cur.d) return no('Lower it back down first.'); pend.L=0; } else return no('Only land Wendell made can go back to the sea.'); }
  else { if (cur.L && pend.L!==0) return no('That\'s already land.'); if (pend.L===0){ delete pend.L; }
    else { if (rawHeight(cx,cz)>0.25) return no('That\'s already land. Raise it instead.'); if (Math.hypot(cx,cz)>HGR-5) return no('That\'s as far out as the magic reaches.');
      if (cx>DOCK.x0-6 && Math.abs(cz-DOCK.z)<6) return no('Boats need the water by the dock.'); if (polyDist(cx,cz,RIVER)<5 || nearFall(cx,cz,2)) return no('The river needs to reach the sea.');
      if (![[TC,0],[-TC,0],[0,TC],[0,-TC]].some(([ox,oz])=>isLand(cx+ox,cz+oz))) return no('New land has to touch the island.');
      pend.L=1; } }
  if (Object.keys(pend).length) M.pend[k]=pend; else delete M.pend[k]; Snd.pop(); drawMarks(); renderMagicBar(); }
function landTap(x,z){
  const M=magicMode, k=terraKey(x,z), [i,j]=k.split(',').map(Number), cx=(i+0.5)*TC, cz=(j+0.5)*TC, cur=TERRA[k]||{}, pend=M.pend[k]||{}, tool=M.tool;
  const no = msg => { toast(msg); Snd.fail(); };
  if (tool==='undo'){ if (M.pend[k]){ delete M.pend[k]; Snd.click(); drawMarks(); renderMagicBar(); } return; }
  const curL = !!(cur.L || pend.L);
  if (tool==='land' || tool==='sea') return landSeaTap(k, cx, cz, cur, pend, tool, no);
  if (!curL && Math.hypot(cx,cz)/islandR(Math.atan2(cz,cx))>0.84) return no('Too close to the shore for that.');
  if (polyDist(cx,cz,RIVER)<5 || Math.hypot(cx-POND.x,cz-POND.z)<POND.r+3.5) return no('The old river and pond are too stubborn to change.');
  if (nearFall(cx,cz,2) || onBridge(cx,cz) || (cx>DOCK.x0-4 && Math.abs(cz-DOCK.z)<4)) return no('That spot is too important to change.');
  if (inRects(cx,cz,2.2) || inLotZone(cx,cz,1.5) || Math.hypot(cx,cz)<9) return no('There\'s a building in the way.');
  for (const kk in PLACES){ const p=PLACES[kk]; if (Math.hypot(cx-p[0], cz-p[1]-(kk==='museum'?3:1)) < (kk==='museum'?8:kk==='board'?3:5)) return no('Too close to a building.'); }
  for (const kk in PLACES){ if (kk==='plaza'||kk==='board') continue; const d=door(kk,doorOff(kk)); if (Math.hypot(cx-d[0],cz-d[1])<3.8) return no('That would block someone\'s front door.'); }
  const hasStuff = [...GCELLS.keys()].some(c=>{ const [i,j]=c.split(',').map(Number); return terraKey(i*CELL,j*CELL)===k; }) || S.plants.some(p=>terraKey(p.x,p.z)===k) || S.placed.some(p=>p.x<500 && terraKey(p.x,p.z)===k) || S.stumps.some(p=>terraKey(p.x,p.z)===k);
  const wetNow = (pend.w!==undefined ? pend.w : cur.w) || 0;
  if (tool==='raise' || tool==='lower'){ if (wetNow) return no('Fill the water in first.');
    const total=(cur.d||0)+(pend.d||0)+(tool==='raise'?1:-1); if (total>6) return no('That\'s as high as the magic goes.'); if (total<-4) return no('That\'s as low as the magic goes.');
    if (tool==='lower' && rawHeight(cx,cz)<TIER.off+0.25 && (pend.d||0)<=0) return no('That\'s already the lowest ground.');
    pend.d=(pend.d||0)+(tool==='raise'?1:-1); if (!pend.d) delete pend.d; }
  if (tool==='pond' || tool==='river'){ if (hasStuff) return no('Move the plants or furniture there first.'); if (wetNow) return no('That\'s already water.');
    const h=rawHeight(cx,cz)+(pend.d||0)*TIER.step; if (h>TIER.off+TIER.step*2.2) return no('Water only pools on low ground. Lower it first.');
    pend.w = tool==='pond'?1:2; }
  if (tool==='fill'){ if (!cur.w && !pend.w) return no('There\'s no dug water here to fill.'); if (pend.w && !cur.w) delete pend.w; else pend.w=0; }
  if (Object.keys(pend).length) M.pend[k]=pend; else delete M.pend[k];
  Snd.pop(); drawMarks(); renderMagicBar();
}
function renderMagicBar(){
  const M=magicMode, bar=$('#magicBar'); if(!M) return; bar.classList.add('show');
  if (M.kind==='move'){ const it=MOVABLE().find(x=>x[0]===M.key), cost=it[2];
    bar.innerHTML=`<div><b>Move: ${it[1]}</b></div>
      <div class="row2"><div class="msg">${M.ok?`Looks good! ${fmt(cost)} clams.`:`<span style="color:#c0503a">${M.why||'Pick a spot.'}</span>`}</div><button class="btn alt" id="mgNo">Cancel</button><button class="btn" id="mgOk" ${!M.ok||S.clams<cost?'disabled':''}>Cast ${fmt(cost)}</button></div>`; }
  else { const n=Object.keys(M.pend).length, cost=pendCost();
    const tools=[['raise','Raise'],['lower','Lower'],['pond','Pond'],['river','River'],['fill','Fill water'],...(landMagicOK()?[['land','New land'],['sea','Back to sea']]:[]),['undo','Undo']];
    bar.innerHTML=`<div class="tools">${tools.map(([k,l])=>`<button class="tool${M.tool===k?' on':''}" data-tl="${k}">${l}</button>`).join('')}</div>
      <div class="row2"><div class="msg">${n?`${n} spot${n>1?'s':''} planned · <b>${fmt(cost)} clams</b>`:'Tap the ground to plan changes.'}<br><span class="muted">Raise/lower ${fmt(MAGIC.raise)} per terrace, water ${fmt(MAGIC.water)}, filling ${fmt(MAGIC.fill)}${landMagicOK()?`, new land ${fmt(LAND_COST)}, back to sea ${fmt(SEA_COST)}`:''}.</span></div><button class="btn alt" id="mgNo">Cancel</button><button class="btn" id="mgOk" ${!n||S.clams<cost?'disabled':''}>Cast</button></div>`;
    bar.querySelectorAll('[data-tl]').forEach(b=>b.onclick=()=>{ const was=M.tool; M.tool=b.dataset.tl; Snd.click(); if ((was==='land'||was==='sea')!==(M.tool==='land'||M.tool==='sea')) drawGrid(); renderMagicBar(); }); }
  $('#mgNo').onclick=()=>{ Snd.click(); endMagic(); };
  $('#mgOk').onclick=()=>castMagic();
}
/* Casting (v1.3). First Wendell shows you the whole plan and asks if that's it. Then the spell plays out right there
   on the island: he pops in, the building lifts off as a glowing orb and lands at its new spot, or the land rumbles
   and rises, sinks or fills with water square by square. Then a lilac shimmer, the island reloads behind it,
   and you're back where you were, looking at the result. */
let cine=null;   // camera override for spell animations: { camT, dist, pitch, shake }
function pendBounds(){ const ks=Object.keys(magicMode.pend); let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9; for (const k of ks){ const [i,j]=k.split(',').map(Number); x0=Math.min(x0,i*TC); x1=Math.max(x1,(i+1)*TC); z0=Math.min(z0,j*TC); z1=Math.max(z1,(j+1)*TC); }
  const cx=(x0+x1)/2, cz=(z0+z1)/2; return { cx, cz, x0, x1, z0, z1, span:Math.max(x1-x0, z1-z0) }; }
function castMagic(){
  const M=magicMode; if(!M) return;
  const cost = M.kind==='move' ? MOVABLE().find(x=>x[0]===M.key)[2] : pendCost();
  if (M.kind==='move' ? (!M.ok || S.clams<cost) : (!Object.keys(M.pend).length || S.clams<cost)) return;
  if (!M.confirmed){
    // show the whole plan before paying
    if (M.kind==='move'){ const [x,z]=M.at; M.camT.set(x, groundY(x,z), z); M.dist=30; }
    else { const b=pendBounds(); M.camT.set(b.cx, groundY(b.cx,b.cz), b.cz); M.dist=clamp(b.span*1.7+12, 18, 46); }
    Snd.click(); const bar=$('#magicBar'); bar.classList.remove('show');
    dialog(WIZARD.name, WIZARD.voice, [M.kind==='move' ? `There it is. Like that? ${fmt(cost)} clams.` : `That's the plan, then. Like that? ${fmt(cost)} clams.`], null, [
      { label:'Cast it!', fn:()=>{ M.confirmed=true; castMagic(); } },
      { label:'Keep fiddling', alt:true, fn:()=>{ if (magicMode) renderMagicBar(); } } ]);
    return; }
  const P = M.kind==='move' ? { kind:'move', key:M.key, at:M.at.slice() } : Object.assign({ kind:'land', pend:M.pend }, pendBounds());
  if (M.kind==='move'){ S.clams-=cost; track('moved'); (S.terra.moved=S.terra.moved||{})[M.key]=M.at.slice(); if (M.key==='tower') S.magic.at=M.at.slice(); }
  else { S.clams-=cost; track('terra', Object.keys(M.pend).length);
    for (const [k,p] of Object.entries(M.pend)){ const c=Object.assign({}, TERRA[k]||{}); if (p.d) c.d=(c.d||0)+p.d; if (c.d===0) delete c.d; if (p.w!==undefined){ if (p.w) c.w=p.w; else delete c.w; } if (p.L!==undefined){ if (p.L) c.L=1; else delete c.L; } if (Object.keys(c).length) TERRA[k]=c; else delete TERRA[k]; }
    S.terra.cells=TERRA; }
  P.ghost=M.bghost; P.marks=M.marks; P.camT=M.camT.clone(); P.dist=M.dist;
  updateHUD(); save(); endMagic(true);
  cine={ camT:P.camT, dist:P.dist, pitch:1.0, shake:0 }; $('#hud').classList.add('magic');
  const line=WIZARD.cast[Math.floor(Math.random()*WIZARD.cast.length)];
  // a beat of Wendell's line first, then the spell
  floatText(line.length>34 ? 'Abracadabra!' : line, P.kind==='move' ? new THREE.Vector3(P.at[0], groundY(P.at[0],P.at[1])+2, P.at[1]) : new THREE.Vector3(P.cx, groundY(P.cx,P.cz)+2, P.cz));
  if (P.kind==='move') spellMove(P); else spellLand(P);
}
// a little glow texture for orbs and sparkles
const magicGlow = (()=>{ const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); const gr=x.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(220,200,255,0.6)'); gr.addColorStop(1,'rgba(160,120,255,0)'); x.fillStyle=gr; x.fillRect(0,0,64,64); return new THREE.CanvasTexture(cv); })();
function glowBall(color=0xd8c4ff, s=1){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:magicGlow, color, transparent:true, blending:THREE.AdditiveBlending, depthWrite:false })); sp.scale.setScalar(s); return sp; }
// sparkles that spiral up around a point
function swirl(c, R, n=1, col=0xc8b0ff){ for (let i=0;i<n;i++){ const sp=glowBall(Math.random()<0.4?0xffffff:col, 0.35+Math.random()*0.35); scene.add(sp); const a0=Math.random()*TAU, y0=c.y+Math.random()*0.6, life=1.1+Math.random()*0.6, rr=R*(0.8+Math.random()*0.4); let t=0;
    FX.add(dt=>{ t+=dt; const k=t/life, a=a0+t*3.2; sp.position.set(c.x+Math.cos(a)*rr*(1-k*0.35), y0+t*2.6, c.z+Math.sin(a)*rr*(1-k*0.35)); sp.material.opacity=Math.sin(Math.min(1,k)*Math.PI); if (k>=1){ scene.remove(sp); sp.material.dispose(); return false; } return true; }); } }
function sparkBurst(c, n=18, sp=4, col=0xe0d0ff){ for (let i=0;i<n;i++){ const g=glowBall(i%3?col:0xffffff, 0.5+Math.random()*0.4); g.position.copy(c); scene.add(g); const v=new THREE.Vector3(Math.random()-0.5, Math.random()*0.8+0.2, Math.random()-0.5).normalize().multiplyScalar(sp*(0.5+Math.random()*0.7)); let t=0;
    FX.add(dt=>{ t+=dt; v.y-=dt*3; g.position.addScaledVector(v,dt); g.material.opacity=Math.max(0,1-t/0.9); if (t>0.9){ scene.remove(g); g.material.dispose(); return false; } return true; }); } }
// Wendell pops in to cast, waves his staff, and pops off again
function wendellPop(x, z){ const w=buildWizard(WIZARD); w.position.set(x, groundY(x,z), z); w.rotation.y=Math.atan2(camera.position.x-x, camera.position.z-z)*0.6; w.scale.setScalar(0.01); scene.add(w);
  puff(w.position.clone().add(new THREE.Vector3(0,0.8,0)), 0xb89ae0, 12, 0.8, 2.4, 1, 0.7); Snd.pop(); const st={}; let t=0, leaving=-1;
  FX.add(dt=>{ t+=dt; const u=w.userData; jelly(w, st, dt, false, t);
    const k = leaving<0 ? Math.min(1,t/0.3) : Math.max(0,1-(t-leaving)/0.25); w.scale.setScalar(Math.max(0.01, k<1 ? easeOut(k)*(1+Math.sin(k*Math.PI)*0.2) : 1));
    if (u.arms){ u.arms[1].rotation.x=-2.3+Math.sin(t*7)*0.35; u.arms[0].rotation.x=-0.6+Math.sin(t*5)*0.25; }
    if (leaving>=0 && t-leaving>0.25){ scene.remove(w); return false; } return true; });
  return { leave(){ leaving=t; puff(w.position.clone().add(new THREE.Vector3(0,0.8,0)), 0xb89ae0, 12, 0.8, 2.4, 1, 0.7); Snd.pop(); }, pos:w.position }; }
// a little timeline helper: run fn(t) every frame for len seconds, then done()
function timeline(len, fn, done){ let t=0; FX.add(dt=>{ t+=dt; fn(Math.min(t,len), dt); if (t>=len){ if (done) done(); return false; } return true; }); }
function spellMove(P){
  const key=P.key, from=PLACES[key], src=bldObj(key), r=footOf(key), fromV=new THREE.Vector3(from[0], groundY(from[0],from[1]), from[1]), to=new THREE.Vector3(P.at[0], groundY(P.at[0],P.at[1]), P.at[1]);
  // the building that lifts off: a solid copy, so it can squash and stretch around its own middle
  let old=null; if (src){ old=ghostOf(src, from); old.userData.solid(); old.position.copy(fromV); scene.add(old); src.visible=false; }
  const land=P.ghost; if (land){ land.userData.solid(); land.visible=false; land.position.copy(to); }
  cine.camT=fromV.clone(); cine.dist=Math.max(24, r*4.2); const wz=wendellPop(from[0]-r-1.6, from[1]+r+1.2);
  Snd.magic(); const orb=new THREE.Group(), core=new THREE.Mesh(G.sph(0.55,16,12), new THREE.MeshBasicMaterial({ color:0xa98af0 })), halo=glowBall(0xe8dcff, 3.4); orb.add(core); orb.add(halo); orb.visible=false; scene.add(orb); let landed=false, sw=0;
  const kp=shopKeepers[key] && shopKeepers[key].obj.parent===OUT && shopKeepers[key].pos.x<500 ? shopKeepers[key] : null;   // a stand's keeper goes along for the ride
  timeline(5.0, (t,dt)=>{
    if (t<1.8){ sw+=dt; while (sw>0.03){ sw-=0.03; swirl(fromV, r+0.6, 1); } }
    if (old){ if (t>1.0 && t<1.5){ const k=(t-1.0)/0.5; old.scale.set(1+Math.sin(t*38)*0.04*k, 1+Math.sin(t*41)*0.05*k, 1+Math.cos(t*36)*0.04*k); }
      else if (t>=1.5 && t<1.8){ const k=(t-1.5)/0.3; old.scale.set(1+0.2*k, 1-0.32*k, 1+0.2*k); }
      else if (t>=1.8 && t<2.15){ const k=(t-1.8)/0.35; old.scale.set(Math.max(0.01,1.2*(1-k)), 0.68+1.4*k*(1-k*0.6), Math.max(0.01,1.2*(1-k))); old.position.y=fromV.y+k*2.5; }
      else if (t>=2.15 && old.visible){ old.visible=false; Snd.pop(); sparkBurst(fromV.clone().add(new THREE.Vector3(0,3,0)), 14, 3); if (kp){ kp.obj.visible=false; puff(kp.pos.clone().add(new THREE.Vector3(0,0.8,0)), 0xb89ae0, 8, 0.6, 2, 0.9, 0.6); } } }
    if (t>=2.15 && t<3.3){ const k=(t-2.15)/1.15, e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2; orb.visible=true; orb.position.lerpVectors(fromV, to, e); orb.position.y += 3 + Math.sin(k*Math.PI)*7; halo.scale.setScalar(3.4+Math.sin(t*20)*0.4); core.scale.setScalar(1+Math.sin(t*14)*0.12);
      cine.camT.copy(orb.position).setY(lerp(fromV.y,to.y,e)); if (Math.random()<0.6) swirl(orb.position.clone().setY(orb.position.y-0.5), 0.5, 1); }
    if (t>=3.3 && orb.visible){ orb.visible=false; sparkBurst(to.clone().add(new THREE.Vector3(0,3,0)), 18, 4); Snd.pop(); if (land) land.visible=true; cine.camT.copy(to); }
    if (land && t>=3.3 && t<3.7){ const k=(t-3.3)/0.4; land.position.y=to.y+7*(1-k*k); land.scale.set(0.8+0.2*k, 1.1, 0.8+0.2*k); }
    if (land && t>=3.7){ if (!landed){ landed=true; Snd.thunk(); cine.shake=0.25; puff(to.clone().add(new THREE.Vector3(0,0.3,0)), 0xd8c8a8, 22, r*0.6, 1.4, 1.3, 0.8); land.position.y=to.y; }
      const k=t-3.7, sq=Math.exp(-k*5)*Math.cos(k*16)*0.22; land.scale.set(1+sq*0.6, 1-sq, 1+sq*0.6); cine.shake*=Math.exp(-dt*6); }
    if (t>=4.2 && !wz.gone){ wz.gone=true; wz.leave(); }
  }, ()=>{ scene.remove(orb); magicExit(P); });
}
function spellLand(P){
  const cells=(P.marks?P.marks.children:[]).slice().sort((a,b)=>Math.hypot(a.userData.x-P.cx,a.userData.z-P.cz)-Math.hypot(b.userData.x-P.cx,b.userData.z-P.cz));
  if (P.marks) scene.add(P.marks);
  // start from how things are now: blocks flat, water gone, sinking planes at the old level
  for (const c of cells) for (const [m,kind,y] of c.userData.parts){ if (kind==='rise') m.scale.y=0.001; if (kind==='water') m.scale.set(0.001,1,0.001); if (kind==='sink') m.position.y=m.userData.from; }
  cine.camT=new THREE.Vector3(P.cx, groundY(P.cx,P.cz), P.cz); cine.dist=clamp(P.span*1.6+14, 18, 44);
  const wz=wendellPop(P.x0-1.8, P.z1+1.5); Snd.magic(); setTimeout(()=>Snd.rumble(), 350);
  const step=Math.min(0.14, 1.8/Math.max(1,cells.length)), total=0.6+step*cells.length+1.2; let sw=0;
  timeline(total+1.0, (t,dt)=>{
    cine.shake = t>0.4 && t<total-0.6 ? 0.12 : cine.shake*Math.exp(-dt*5);
    cells.forEach((c,i)=>{ const t0=0.6+i*step, k=(t-t0)/0.75; if (k<0) return; const u=c.userData;
      if (!u.started){ u.started=true; sparkBurst(new THREE.Vector3(u.x, u.h0+0.4, u.z), 6, 2.4); puff(new THREE.Vector3(u.x, u.h0+0.2, u.z), 0x9a7650, 5, 0.6, 1.6, 0.9, 0.5); }
      const kk=Math.min(1,k), el = kk>=1 ? 1 : 1 - Math.pow(2,-9*kk)*Math.cos(kk*9);   // springy settle
      for (const [m,kind,y] of u.parts){
        if (kind==='rise') m.scale.y=Math.max(0.001, el);
        if (kind==='cut') m.scale.y=Math.max(0.001, 1-easeOut(kk));
        if (kind==='sink') m.position.y=lerp(m.userData.from, y, easeOut(kk));
        if (kind==='water'){ const w=Math.max(0.001,easeOut(kk)); m.scale.set(w,1,w); if (!u.rip && kk>0.4){ u.rip=true; ripple(u.x,u.z,1.2); } } } });
    if (t<total){ sw+=dt; while (sw>0.06){ sw-=0.06; const c=cells[Math.floor(Math.random()*cells.length)]; if (c) swirl(new THREE.Vector3(c.userData.x, c.userData.h0, c.userData.z), TC*0.45, 1); } }
    if (t>=total-0.2 && !P.burst){ P.burst=true; sparkBurst(new THREE.Vector3(P.cx, groundY(P.cx,P.cz)+1, P.cz), 26, 5); Snd.jingle(); }
    if (t>=total && !wz.gone){ wz.gone=true; wz.leave(); }
  }, ()=>magicExit(P));
}
// the lilac shimmer comes up, the island is saved and reloaded behind it, and you land back where you were
async function magicExit(P){
  const ret={ kind:P.kind, at: P.kind==='move' ? P.at : [P.cx, P.cz], key:P.key||null, dist:cine?cine.dist:28, px:+player.pos.x.toFixed(2), pz:+player.pos.z.toFixed(2), face:+player.face.toFixed(2) };
  try { sessionStorage.setItem('dw-magic', JSON.stringify(ret)); } catch(e){}
  document.documentElement.classList.add('magicret'); Snd.swoosh();
  try { if (BOOT.flush) await BOOT.flush(); } catch(e){}
  setTimeout(()=>location.reload(), 700);
}
function magicPan(dx,dy){ const M=magicMode; const k=M.dist/innerHeight*1.5; M.camT.x-=dx*k; M.camT.z-=dy*k; const r=60*SC; M.camT.x=clamp(M.camT.x,-r,r); M.camT.z=clamp(M.camT.z,-r,r); M.camT.y=groundY(M.camT.x,M.camT.z);
  if (M.kind==='land'){ const ci=Math.floor(M.camT.x/TC), cj=Math.floor(M.camT.z/TC); if (!M.gridAt || Math.abs(ci-M.gridAt[0])>3 || Math.abs(cj-M.gridAt[1])>3) drawGrid(); } }
function magicTap(cx,cy){ const g=groundAtScreen(cx,cy); if(!g) return; if (magicMode.kind==='move'){ magicPlace(g.x,g.z); magicMode.camT.set(g.x, groundY(g.x,g.z), g.z); } else landTap(g.x,g.z); }
// after the wizard's spell the page reloads behind a lilac shimmer: this is where you were and what changed
const PORTAL_RET = (()=>{ try { const v=sessionStorage.getItem('dw-portal'); sessionStorage.removeItem('dw-portal'); return !!v; } catch(e){ return false; } })();
const MAGIC_RET = (()=>{ try { const v=sessionStorage.getItem('dw-magic'); sessionStorage.removeItem('dw-magic'); const o=v&&JSON.parse(v); return o&&o.at?o:null; } catch(e){ return null; } })();
function magicArrive(R){
  if (Number.isFinite(R.px) && walkable(R.px,R.pz) && !blocked(R.px,R.pz,0.35)){ player.pos.set(R.px, groundY(R.px,R.pz), R.pz); player.face=R.face||0; player.obj.rotation.y=player.face; player.obj.position.copy(player.pos); }
  const at=new THREE.Vector3(R.at[0], groundY(R.at[0],R.at[1]), R.at[1]);
  cine={ camT:at.clone(), dist:R.dist||28, pitch:1.0, shake:0 }; camTarget.copy(at); updateCamera(1); $('#hud').classList.add('magic');
  if (R.kind==='move'){ const o=bldObj(R.key); if (o){ const s0=o.scale.clone(); timeline(1.2, t=>{ const sq=Math.exp(-t*4)*Math.cos(t*14)*0.12; o.scale.set(s0.x*(1+sq*0.6), s0.y*(1-sq), s0.z*(1+sq*0.6)); }, ()=>o.scale.copy(s0)); } }
  let sw=0; timeline(2.4, (t,dt)=>{ sw+=dt; while (sw>0.04){ sw-=0.04; const a=Math.random()*TAU, d=Math.random()*7; const g=glowBall(Math.random()<0.5?0xffffff:0xd8c4ff, 0.3+Math.random()*0.3); g.position.set(at.x+Math.cos(a)*d, at.y+4+Math.random()*3, at.z+Math.sin(a)*d); scene.add(g); let k=0;
      FX.add(dd=>{ k+=dd; g.position.y-=dd*2.2; g.position.x+=Math.sin(k*3+a)*dd*0.6; g.material.opacity=Math.sin(Math.min(1,k/1.4)*Math.PI); if (k>1.4){ scene.remove(g); g.material.dispose(); return false; } return true; }); } },
    ()=>{ cine=null; $('#hud').classList.remove('magic'); toast(R.kind==='move'?'Poof! Moved.':'The land settles.', null, 'new'); });
  setTimeout(()=>document.documentElement.classList.remove('magicret'), 250);
}

function refreshSmoke(){ smokeSrc.length=0; OUT.updateMatrixWorld(true); const add=e=>{ const c=e.obj.userData.chimney; if(c) smokeSrc.push(c.clone().applyMatrix4(e.obj.matrixWorld)); }; if(houseEnt) add(houseEnt); residentHomes.forEach(add); }
refreshSmoke();
const CLASSIC_LAMPS = [[3,-1.5],[-7,4],[6,-4],[6,6],[-9,-6],[DOCK.x0-1.5,DOCK.z-1.8],[2,11],[1,-12],[bEnd(bA,1)[0]+1.2,bEnd(bA,1)[1]],[-8,-33],[14,-18],[24,0]];
function lampSpots(paths){ const L=[]; for(const p of paths){ let acc=5; for(let i=0;i<p.length-1;i++){ const [ax,az]=p[i], [bx,bz]=p[i+1], len=Math.hypot(bx-ax,bz-az); for(let d=0; d<len; d+=0.5){ acc+=0.5; if(acc<11) continue; const x=ax+(bx-ax)*d/len, z=az+(bz-az)*d/len, nx=-(bz-az)/len, nz=(bx-ax)/len;
    const lx=x+nx*1.3, lz=z+nz*1.3; if(L.some(q=>Math.hypot(q[0]-lx,q[1]-lz)<7)) continue; L.push([lx,lz]); acc=0; } } } return L; }
const lampOK = (x,z) => walkable(x,z) && !onBridge(x,z) && !(LAYOUT_ID!=='classic' && (inRects(x,z,0.8)||inLotZone(x,z,0.5)));
const PLAYER_ALTERED = MOVED || TERRA_ANY || !!PLACES.tower || !!PLACES.portal;
const refLampSpots = () => (LAYOUT_ID==='classic' ? CLASSIC_LAMPS : lampSpots(PATHS_V4)).filter(([x,z])=>lampOK(x,z));
if ((!S.refLamps || S.refLamps.id!==LAYOUT_ID) && !PLAYER_ALTERED) S.refLamps = { id:LAYOUT_ID, pts:refLampSpots().map(q=>[+q[0].toFixed(2),+q[1].toFixed(2)]) };
const REF_LAMPS = S.refLamps && S.refLamps.id===LAYOUT_ID ? S.refLamps.pts : refLampSpots();
for (const [x,z] of REF_LAMPS) reserve(x,z,0.8);   // trees and rocks are placed around where the lamps first stood
const lampClear = (x,z) => lampOK(x,z) && !keptOut(x,z) && !Object.entries(PLACES).some(([k,p])=>k!=='plaza'&&k!=='board'&&Math.hypot(x-p[0],z-p[1])<footOf(k)-0.5);
let LAMPS = (!PLAYER_ALTERED && !REROUTED) ? REF_LAMPS : (LAYOUT_ID==='classic' && !MOVED ? CLASSIC_LAMPS : lampSpots(PATHS)).filter(([x,z])=>lampClear(x,z));
/* v1.26: street lamps are crooked wooden posts with an arm, a hanging iron lantern under a little roof, and a bit of moss and ivy */
function buildStreetLamp(r){
  const g=new THREE.Group(), wood=M(0x8a6a4c,{roughness:0.95}), dark=M(0x5a4232), iron=M(0x2c2a28,{metalness:0.3,roughness:0.6}), moss=M(0x5f8a3e), ivy=M(0x4f8a3a);
  // the post: three short segments, each leaning a little, so it looks hand-hewn
  let x=0, y=0, z=0; const lean=[(r()-0.5)*0.16, (r()-0.5)*0.16];
  for (let i=0;i<3;i++){ const h=0.82, tx=(r()-0.5)*0.12+lean[0]*0.5, tz=(r()-0.5)*0.12+lean[1]*0.5, seg=mk(G.cyl(0.085-i*0.008,0.105-i*0.008,h,7), wood, x+tx/2, y+h/2, z+tz/2, g);
    seg.rotation.set(tz*1.2, 0, -tx*1.2); x+=tx; y+=h-0.03; z+=tz; }
  mk(G.cyl(0.15,0.19,0.18,7), dark, 0, 0.09, 0, g);                                   // a chunk of stone-ish base
  mk(G.sph(0.11,8,6), wood, x, y+0.02, z, g).scale.set(1,0.6,1);                     // rounded cap
  // the arm, with a little brace underneath
  const dir=r()*TAU, ax=Math.cos(dir), az=Math.sin(dir), L=0.62, armY=y-0.12;
  const arm=mk(G.box(L,0.07,0.07), wood, x+ax*L/2, armY, z+az*L/2, g); arm.rotation.y=-dir;
  const br=mk(G.box(0.36,0.05,0.05), wood, x+ax*0.17, armY-0.17, z+az*0.17, g); br.rotation.set(0,-dir,0); br.rotateZ(0.75);
  const hx=x+ax*(L-0.07), hz=z+az*(L-0.07);
  mk(G.cyl(0.008,0.008,0.24,4), iron, hx, armY-0.15, hz, g).castShadow=false;        // the chain
  // the lantern: an iron frame round a glowing box, with a small peaked roof and a finial
  const lan=new THREE.Group(); lan.position.set(hx, armY-0.52, hz); lan.rotation.y=-dir; g.add(lan);
  mk(G.box(0.24,0.3,0.24), glowMat(0xffd27a), 0, 0, 0, lan);
  for (const [px,pz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) mk(G.box(0.035,0.34,0.035), iron, px*0.13, 0, pz*0.13, lan);
  mk(G.box(0.3,0.04,0.3), iron, 0, -0.18, 0, lan); mk(G.box(0.3,0.035,0.3), iron, 0, 0.17, 0, lan);
  const roof=mk(G.cone(0.27,0.2,4), dark, 0, 0.29, 0, lan); roof.rotation.y=Math.PI/4;
  mk(G.sph(0.03,6,4), iron, 0, 0.42, 0, lan);
  addGlow(lan, 0, 3.2);
  // moss on the cap and the arm, ivy climbing the post
  mk(G.sph(0.1,8,5), moss, x, y+0.06, z, g).scale.set(1.25,0.35,1.25);
  mk(G.sph(0.07,7,4), moss, x+ax*0.25, armY+0.05, z+az*0.25, g).scale.set(1.6,0.4,1);
  if (r()<0.75){ const n=4+Math.floor(r()*4), a0=r()*TAU; for (let i=0;i<n;i++){ const t=i/n, a=a0+t*3.2, yy=0.25+t*1.5; mk(G.sph(0.06,6,4), ivy, Math.cos(a)*0.1+lean[0]*t, yy, Math.sin(a)*0.1+lean[1]*t, g).scale.set(1,0.55,1.2); } }
  return g;
}
function placeLamps(){ if (TRIP) return; LAMPS.forEach(([x,z],i)=>{ const g=buildStreetLamp(mulberry32(hashStr('lamp:'+i+':'+x.toFixed(1)))); g.position.set(x,groundY(x,z),z); OUT.add(g); }); }

/* ---------- Trees, rocks, scenery ---------- */
const trees=[], rocks=[], wildFlowerSpots=[];
// v0.5 buildings and paths went in after the island was made. Trees and rocks in their way just don't grow there.
// Spots that changed since the island was made (moved buildings, reshaped land, waterfalls, the wizard tower): nothing grows there now.
const changedSpot = p => { const [x,z]=p;
  if (LAY.gen && (!walkable(x,z) || hillSlope(x,z)>1.5 || rawHeight(x,z)<0.2)) return true;   // new islands: only sensible ground
  if (FALLS.length && nearFall(x,z,0.5) && (nearFall(x,z,-5.5) || hillSlope(x,z)>1.5 || inFallPool(x,z) || !walkable(x,z))) return true;
  if (TERRA_ANY){ for (const [ox,oz] of [[0,0],[TC,0],[-TC,0],[0,TC],[0,-TC]]) if (terraAt(x+ox,z+oz)){ if (!walkable(x,z) || hillSlope(x,z)>1.5 || terraWet(x,z)>0) return true; break; } }
  if (MOVED || PLACES.tower || LAY.gen || REROUTED || PLACES.hall || PLACES.portal){ if (visPathDist(x,z)<2.0) return true;
    for (const k in PLACES){ if (k==='plaza'||k==='board') continue; if (!LAY.gen && PLACES0[k] && PLACES0[k][0]===PLACES[k][0] && PLACES0[k][1]===PLACES[k][1]) continue; const d=door(k, doorOff(k)); if (Math.hypot(x-d[0],z-d[1])<2.6) return true; } }
  return false; };
const clearForNew = p => !!inRects(p[0],p[1],2.4) || newPathDist(p[0],p[1])<2.3 || inLotZone(p[0],p[1],1.4) || ['museum','aquarium','garden'].some(k=>Math.hypot(p[0]-PLACES[k][0], p[1]-PLACES[k][1]-(k==='museum'?6:4))<3.2)
  || ((ALTERED || REROUTED || !!PLACES.hall || !!PLACES.portal) && changedSpot(p)) || keptOut(p[0],p[1]);
{ const r=mulberry32(S.seed); let idx=0; const add=(type,fruit,minH,maxH)=>{ const p=randLand(r,minH,maxH,2.8); if(!p) return; reserve(p[0],p[1],2.3); const key='n'+(idx++);
    if (typeof type==='function') type=type(p); if(S.cut[key]==='gone' || clearForNew(p)){ return; } trees.push(new Tree(key,p[0],p[1],type,fruit)); };
  if (!LAY.gen){
    for(let i=0;i<14;i++) add('fruittree',S.nativeFruit,SAND_H+0.2,9);
    const kinds=['oak','oak','birch','maple','blossom','cedar','pine','pine'];
    for(let i=0;i<70;i++) add(kinds[Math.floor(r()*kinds.length)],null,SAND_H+0.2,9);
    for(let i=0;i<18;i++) add('palm','coconut',0.25,SAND_H);
  } else {   // generated islands: what grows depends on the terrain, and high ground leans to pines and cedars
    const F=LAY.flora, kinds=Object.entries(F.trees), tot=kinds.reduce((a,k)=>a+k[1],0);
    const kindAt = p => { if (rawHeight(p[0],p[1])>3.3 && r()<0.75) return r()<0.6?'pine':'cedar'; let x=r()*tot; for(const [k,w] of kinds){ x-=w; if(x<=0) return k; } return kinds[0][0]; };
    const TK = LAY.trip ? 0.3 : 1;   // trip islands are about a quarter the size
    for(let i=0;i<Math.round(24*F.fruit*TK);i++) add('fruittree', TRIP_THEME==='orchard' ? NATIVE_FRUITS[i%NATIVE_FRUITS.length] : S.nativeFruit, SAND_H+0.2,12);
    for(let i=0;i<Math.round(115*TK);i++) add(kindAt,null,SAND_H+0.2,12);
    for(let i=0;i<Math.round(20*F.palms*TK);i++) add('palm','coconut',0.25,SAND_H);
  }
  const nRocks = LAY.trip ? (TRIP_THEME==='fossil' ? 8 : 4) : LAY.gen ? (LAY.terrain==='mountainous'||LAY.terrain==='cliffs' ? 16 : 12) : 9;
  for(let i=0;i<nRocks;i++){ const p=randLand(r,SAND_H+0.1,12,2.2); if(!p) continue; reserve(p[0],p[1],2); if(clearForNew(p)) continue; rocks.push(new Rock(i,p[0],p[1],r)); }
}
layoutPhase=false;
// lamps go up once the trees are in, so a lamp never ends up inside a tree on islands whose paths were re-laid
if (REROUTED) LAMPS=LAMPS.filter(([x,z])=>!trees.some(t=>Math.hypot(t.pos.x-x,t.pos.z-z)<1.4) && !rocks.some(r=>Math.hypot(r.pos.x-x,r.pos.z-z)<1.6));
placeLamps();
for (const [x,z] of LAMPS) reserve(x,z,0.8);
for (const st of S.stumps) new Stump(st);
const plantEnts=[];
function spawnPlants(){ for(const e of plantEnts) if(!e.removed) e.remove(); plantEnts.length=0;
  for (const rec of S.plants){ const P=PLANTS[rec.sp]; if(!P) continue; plantEnts.push(P.ptype==='tree' ? new Tree(rec.id, rec.x, rec.z, rec.sp, rec.fruit||(rec.sp==='palm'?'coconut':null), rec) : new Plant(rec)); } }
// grass tufts, wild flowers, fallen leaves, driftwood (instanced)
const COVER0=OUT.children.length;
{ const r=mulberry32(S.seed+7); const dummy=new THREE.Object3D(); const col=new THREE.Color();
  const okGrass=(x,z,pd=1.3)=>{ const h=rawHeight(x,z); return !(h<SAND_H+0.15||pathDist(x,z)<pd||polyDist(x,z,RIVER)<4.3); };
  // grass: tufts of curved blades in three shapes, gathered into clumps that are denser in some places, swaying in the wind
  { const tuftN=Math.round((isMobile?3600:5800)*Math.min(1.7,SC*SC)), TV=3, per=Math.ceil(tuftN/TV)+8, gm=GC.swayMat({ height:0.45, amp:0.05 });
    const tms=[...Array(TV)].map((_,v)=>{ const im=new THREE.InstancedMesh(GC.tuftGeo(v), gm, per); im.count=0; im.receiveShadow=true; im.castShadow=false; return im; }); GC.tickWind(tms[0]);
    const gcol=PAL.grass.map(h=>new THREE.Color(h).offsetHSL(0,0.06,0.02)); let n=0;
    for(let k=0;k<tuftN*3 && n<tuftN;k++){ const x=(r()-0.5)*112*SC, z=(r()-0.5)*112*SC; if(!okGrass(x,z)) continue;
      const dens=vnoise(x*0.11+3,z*0.11-5), cl=2+Math.floor(dens*4);
      for(let j=0;j<cl&&n<tuftN;j++){ const xx=x+(r()-0.5)*0.6, zz=z+(r()-0.5)*0.6; if(!okGrass(xx,zz,1.15)) continue; const im=tms[Math.floor(r()*TV)]; if(im.count>=per) continue;
        dummy.position.set(xx, rawHeight(xx,zz)-0.015, zz); dummy.rotation.set((r()-0.5)*0.25,r()*TAU,(r()-0.5)*0.25); dummy.scale.setScalar(0.75+r()*0.7); dummy.updateMatrix(); im.setMatrixAt(im.count,dummy.matrix);
        col.copy(gcol[Math.floor(r()*gcol.length)]).offsetHSL((r()-0.5)*0.02,0,(r()-0.5)*0.07+(dens-0.5)*0.05); im.setColorAt(im.count,col); im.count++; n++; } }
    tms.forEach(im=>OUT.add(im)); }
  // clover: low trefoil patches tucked into the grass in drifts
  if (World.season!=='winter'){ const CN=Math.round((isMobile?1100:1700)*Math.min(1.7,SC*SC)), per=Math.ceil(CN/2)+4, cm=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85, side:THREE.DoubleSide });
    const cls=[0,1].map(v=>{ const im=new THREE.InstancedMesh(GC.cloverGeo(v), cm, per); im.count=0; im.receiveShadow=true; im.castShadow=false; return im; });
    const cc=new THREE.Color(PAL.grass[1]).offsetHSL(0.035,0.12,-0.13);
    for(let k=0;k<CN*6;k++){ const x=(r()-0.5)*112*SC, z=(r()-0.5)*112*SC; if(!okGrass(x,z,1.0) || vnoise(x*0.09-2,z*0.09+4)<0.5) continue; const im=cls[k%2]; if(im.count>=per) break;
      dummy.position.set(x, rawHeight(x,z)-0.01, z); dummy.rotation.set(0,r()*TAU,0); dummy.scale.setScalar(1.3+r()*0.8); dummy.updateMatrix(); im.setMatrixAt(im.count,dummy.matrix); im.setColorAt(im.count, col.copy(cc).offsetHSL((r()-0.5)*0.02,0,(r()-0.5)*0.06)); im.count++; }
    cls.forEach(im=>OUT.add(im)); }
  // wild flowers: daisies and little cups on leafy stems, in small drifts of one color
  if (PAL.flower.length){ const fN=Math.round(900*SC*SC*(LAY.flora?LAY.flora.flowers:1)), sm=GC.swayMat({ height:0.36, amp:0.03, rough:0.8 }), pm=GC.swayMat({ height:0.36, amp:0.03, rough:0.55 });
    const stems=new THREE.InstancedMesh(GC.flowerStemGeo(), sm, fN), daisy=new THREE.InstancedMesh(GC.petalsDaisyGeo(), pm, fN), cup=new THREE.InstancedMesh(GC.petalsCupGeo(), pm, fN), ctr=new THREE.InstancedMesh(GC.flowerCenterGeo(), pm, fN);
    daisy.count=cup.count=0; let m=0;
    for(let k=0;k<Math.round(150*SC*SC*(LAY.flora?LAY.flora.flowers:1))&&m<fN;k++){ const p=randLand(r,SAND_H+0.2,9,0.3,10); if(!p) continue; const fc=new THREE.Color(PAL.flower[Math.floor(r()*PAL.flower.length)]), isCup=r()<0.35; wildFlowerSpots.push(p);
      for(let j=0;j<7&&m<fN;j++){ const x=p[0]+(r()-0.5)*1.7, z=p[1]+(r()-0.5)*1.7; if(rawHeight(x,z)<SAND_H+0.1||pathDist(x,z)<1.2) continue;
        dummy.position.set(x,rawHeight(x,z)-0.02,z); dummy.rotation.set((r()-0.5)*0.15,r()*TAU,(r()-0.5)*0.15); dummy.scale.setScalar(1.15+r()*0.55); dummy.updateMatrix();
        stems.setMatrixAt(m,dummy.matrix); ctr.setMatrixAt(m,dummy.matrix); const hm=isCup?cup:daisy; hm.setMatrixAt(hm.count,dummy.matrix); hm.setColorAt(hm.count, col.copy(fc).offsetHSL(0,0,(r()-0.5)*0.06)); hm.count++; m++; } }
    stems.count=ctr.count=m; for (const o of [stems,daisy,cup,ctr]){ o.castShadow=false; o.receiveShadow=true; OUT.add(o); } GC.tickWind(stems); }
  // pebbles: mostly along the edges of paths, a few out in the grass
  { const PN=Math.round((isMobile?380:600)*Math.min(1.7,SC*SC)), per=Math.ceil(PN/3)+4, pm=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.85 });
    const pbs=[0,1,2].map(v=>{ const im=new THREE.InstancedMesh(GC.pebbleGeo(v), pm, per); im.count=0; im.receiveShadow=true; im.castShadow=false; return im; });
    const pc=[0xb8b0a2,0xa8a094,0xc8bca8,0x9a948a,0xd0c4ae].map(h=>new THREE.Color(h)); let placed=0;
    for(let k=0;k<PN*5 && placed<PN;k++){ let x,z;
      if (r()<0.7){ const P=PATHS[Math.floor(r()*PATHS.length)]; if(!P||P.length<2) continue; const i=Math.floor(r()*(P.length-1)), t=r(), [ax,az]=P[i], [bx,bz]=P[i+1], L=Math.hypot(bx-ax,bz-az)||1, s=r()<0.5?1:-1, off=0.85+r()*0.8;
        x=ax+(bx-ax)*t+(-(bz-az)/L)*s*off; z=az+(bz-az)*t+((bx-ax)/L)*s*off; }
      else { x=(r()-0.5)*112*SC; z=(r()-0.5)*112*SC; }
      if (rawHeight(x,z)<0.25 || !walkable(x,z) || onBridge(x,z) || onDock(x,z)) continue; const im=pbs[Math.floor(r()*3)]; if(im.count>=per) continue;
      dummy.position.set(x, groundY(x,z)-0.01, z); dummy.rotation.set(0,r()*TAU,0); dummy.scale.setScalar(0.55+r()*0.9); dummy.updateMatrix(); im.setMatrixAt(im.count,dummy.matrix); im.setColorAt(im.count, col.copy(pc[Math.floor(r()*pc.length)]).offsetHSL(0,0,(r()-0.5)*0.06)); im.count++; placed++; }
    pbs.forEach(im=>OUT.add(im)); }
  // mushrooms: small clusters at the foot of some trees
  if (World.season!=='winter'){ const MN=420, sm=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.7 }), cm=new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.45 });
    const mst=new THREE.InstancedMesh(GC.mushStemGeo(), sm, MN), mcp=new THREE.InstancedMesh(GC.mushCapGeo(), cm, MN); let m=0; const capC=[0xd8503a,0xc8905a,0xe8d4b0,0xb86a3a].map(h=>new THREE.Color(h));
    for(const tr of trees){ if (tr.type==='palm' || r()>0.32) continue; const nn=2+Math.floor(r()*3), a0=r()*TAU, d0=0.5+r()*0.45, cc=capC[Math.floor(r()*capC.length)];
      for(let j=0;j<nn&&m<MN;j++){ const a=a0+(r()-0.5)*0.9, d=d0+(r()-0.5)*0.25, x=tr.pos.x+Math.cos(a)*d, z=tr.pos.z+Math.sin(a)*d; if(!walkable(x,z)) continue;
        dummy.position.set(x, groundY(x,z)-0.01, z); dummy.rotation.set((r()-0.5)*0.3,r()*TAU,(r()-0.5)*0.3); dummy.scale.setScalar(j===0?1.15+r()*0.4:0.6+r()*0.5); dummy.updateMatrix();
        mst.setMatrixAt(m,dummy.matrix); mcp.setMatrixAt(m,dummy.matrix); mcp.setColorAt(m, col.copy(cc).offsetHSL(0,0,(r()-0.5)*0.08)); m++; } }
    mst.count=mcp.count=m; for (const o of [mst,mcp]){ o.castShadow=false; o.receiveShadow=true; OUT.add(o); } }
  if (World.season==='autumn'){ const lg=GC.fallenLeafGeo(); const LEAF_N=isMobile?2600:3600; const leaves=new THREE.InstancedMesh(lg,new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.9, side:THREE.DoubleSide }),LEAF_N); let m=0; const lc=[0xe8913a,0xd8642e,0xf0b84a,0xb8743a,0xc9a04a].map(h=>new THREE.Color(h));
    for(const tr of trees){ if(['palm','pine','cedar'].includes(tr.type)) continue; for(let j=0;j<32;j++){ const a=r()*TAU, d=Math.sqrt(r())*2.9; const x=tr.pos.x+Math.cos(a)*d, z=tr.pos.z+Math.sin(a)*d; if(!walkable(x,z)||m>=LEAF_N) continue; dummy.position.set(x,groundY(x,z)+0.012+r()*0.01,z); dummy.rotation.set((r()-0.5)*0.3,r()*TAU,(r()-0.5)*0.3); dummy.scale.setScalar(0.85+r()*0.8); dummy.updateMatrix(); leaves.setMatrixAt(m,dummy.matrix); leaves.setColorAt(m,lc[Math.floor(r()*lc.length)]); m++; } }   // light leaf litter under each tree
    leaves.count=m; leaves.receiveShadow=true; OUT.add(leaves); }
  for(let i=0;i<12;i++){ const p=randLand(r,0.15,SAND_H-0.05,1); if(!p) continue; const g=new THREE.Group(); const l=mk(G.cyl(0.12,0.16,1.6+r(),8),M(0xc8b49a),0,0.12,0,g); l.rotation.z=Math.PI/2; g.rotation.y=r()*TAU; g.position.set(p[0],groundY(p[0],p[1]),p[1]); OUT.add(g); }
  // lily pads + reeds on the pond and river
  for(let i=0;i<14;i++){ const a=r()*TAU, d=r()*POND.r*0.8; const p=mk(G.cyl(0.35,0.35,0.02,12,1,false,0,TAU*0.88),M(0x5aa84a),POND.x+Math.cos(a)*d,0.04,POND.z+Math.sin(a)*d,OUT); p.rotation.y=r()*TAU; p.castShadow=false; if(i%4===0) mk(G.ico(0.09,1),M(0xf8c0d8),p.position.x,0.1,p.position.z,OUT); }
  for(let i=0;i<40;i++){ const k=Math.floor(r()*(RIVER.length-1)), t=r(); const a=RIVER[k], b=RIVER[k+1]; const s=r()<0.5?1:-1; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); const x=lerp(a[0],b[0],t)+(-(b[1]-a[1])/L)*s*2.6, z=lerp(a[1],b[1],t)+((b[0]-a[0])/L)*s*2.6; if(rawHeight(x,z)<-0.3||rawHeight(x,z)>0.6||Math.hypot(x,z)>48*SC) continue; for(let j=0;j<4;j++){ const rd=mk(G.cyl(0.02,0.03,0.9+r()*0.5,4),M(0x7a9a4a),x+(r()-0.5)*0.4,0.4,z+(r()-0.5)*0.4,OUT); rd.rotation.set((r()-0.5)*0.3,0,(r()-0.5)*0.3); rd.castShadow=false; } }
}
// v1.8: remember the ground cover so gardens can hide it under their soil
for (const o of OUT.children.slice(COVER0)) if (o.isInstancedMesh) COVER.push({ im:o, orig:o.instanceMatrix.array.slice() });
const clouds=[]; { const r=mulberry32(99); for(let i=0;i<18;i++){ const g=new THREE.Group(); const n=3+Math.floor(r()*3); for(let k=0;k<n;k++){ const s=mk(G.ico(2+r()*2,2),new THREE.MeshStandardMaterial({ color:0xffffff, roughness:1, transparent:true, opacity:0.95 }),k*2.6-n*1.3,r()*1.2,r()*1.5,g); s.castShadow=false; s.receiveShadow=false; s.scale.y=0.65; } g.position.set((r()-0.5)*260, 36+r()*14, (r()-0.5)*260-30); g.userData.v=0.6+r()*0.8; OUT.add(g); clouds.push(g); } }
const residents = RESIDENTS.filter(R=>livesHere(R.id)).map(R=>new Resident(R));
spawnAmbient();

/* ---------- Player ---------- */
const player = { pos:new THREE.Vector3(PLACES.home[0]+1.5, 0, PLACES.home[1]+4.4), face:0, target:null, targetEnt:null, cb:null, act:0, obj:buildPlayer({ look:S.look }), stuck:0, lastD:0, speedFrac:0 };
if (TRIP) player.pos.set(DOCK.x0+3.2, 0, DOCK.z+0.3);   // you step off the boat onto the dock
player.pos.y=groundY(player.pos.x,player.pos.z); scene.add(player.obj);
const marker=(()=>{ const m=new THREE.Mesh(new THREE.RingGeometry(0.25,0.38,24).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.8, depthWrite:false })); m.visible=false; scene.add(m); return m; })();

/* ---------- Daily reset ---------- */
let dailyEnts=[], peddler=null, weatherOverride=null;
/* v1.26: no traveling merchant until the Portal Station's beacon is lit. Then Fennick comes through every 3 or 4 days. */
function merchantDay(key){
  if (GUEST || !S.magic || !S.magic.beacon) return false;
  const now=dayNum(key), last=S.magic.merchantLast;
  if (last===undefined){ S.magic.merchantLast=now; return true; }   // the first visit comes right after the beacon is lit
  const gap=now-last; if (gap<3) return false;
  if (gap>=4 || mulberry32(hashStr(key+':merchant:'+S.seed))()<0.5){ S.magic.merchantLast=now; return true; }
  return false; }
function rollDay(){
  const key=Time.dayKey(); if (S.day && (S.day.key===key || TRIP)) return false;   // a trip island doesn't refill at midnight
  const r=mulberry32(hashStr(key+':'+S.seed)); const m=Time.month(), season=seasonOf(m);
  const w=r(); const weather = TRIP_THEME==='moonlit' ? 'sunny' : TRIP_THEME==='frost' ? 'snow' : w<0.6?'sunny':(w<0.82?'cloudy':(season==='winter'?'snow':'rain'));
  const digs=[], weeds=[];
  // v1.26 trip themes: more spots, never better odds
  const nDig = TRIP ? (TRIP_THEME==='fossil' ? 36 : 8) : 6, nShell = TRIP ? ({ coral:26, shipwreck:14 }[TRIP_THEME]||8) : 8, nRare = TRIP ? ({ coral:4, shipwreck:5 }[TRIP_THEME]||1) : 1;
  for(let i=0;i<nDig;i++){ let p=null; for(let k=0;k<8;k++){ p=randLand(r,SAND_H+0.15,9,1.2); if(!p || !hiddenSpot(p[0],p[1])) break; } if(p) digs.push({x:p[0],z:p[1],dug:false}); }
  for(let i=0;i<7;i++){ const p=randLand(r,SAND_H+0.2,9,0.6); if(p) weeds.push({x:p[0],z:p[1],pulled:false}); }
  const pickN=(pool,n)=>{ const a=pool.slice(), o=[]; while(o.length<n && a.length) o.push(a.splice(Math.floor(r()*a.length),1)[0].id); return o; };
  const furnPool=generalPool(m), gt=shopTier('general');
  const seeds=Object.values(ITEMS).filter(i=>i.kind==='seed'), starts=Object.values(ITEMS).filter(i=>i.kind==='sapling'&&PLANTS[i.plant].ptype==='shrub'), saps=Object.values(ITEMS).filter(i=>i.kind==='sapling'&&i.buy>0&&PLANTS[i.plant].ptype==='tree');
  const shellPool=Object.values(ITEMS).filter(i=>i.kind==='shell');
  S.ground = S.ground.filter(g=>!g.beach);
  for(let i=0;i<nShell;i++){ for(let k=0;k<30;k++){ const a=r()*TAU, d=(40+r()*16)*SC; const x=Math.cos(a)*d, z=Math.sin(a)*d; if(isBeach(x,z) && !onDock(x,z)){ S.ground.push({ id:tierPick(r,shellPool.filter(allowedFind),i=>i.rarity).id, x, z, beach:true }); break; } } }
  // v1.9: this island's own crops grow wild in a few spots, ripe. Picking one gives the crop and 1 to 4 seeds. Topped back up to 6 each day.
  if (!VISIT){ const pool=islandSeeds(); let have=S.plants.filter(p=>p.wild).length, want=TRIP_THEME==='bloom'?18:6;
    for (let tries=0; have<want && tries<120; tries++){ const p=randLand(r,SAND_H+0.2,9,0.8); if (!p) continue; const [x,z]=p;
      if (gardenAtXZ(x,z) || visPathDist(x,z)<1.2 || blocked(x,z,0.45) || S.plants.some(q=>Math.hypot(q.x-x,q.z-z)<1.2) || trees.some(t=>!t.removed && Math.hypot(t.pos.x-x,t.pos.z-z)<1.3)) continue;
      const seed=pool[Math.floor(r()*pool.length)];
      S.plants.push({ id:'w'+key.replace(/\W/g,'')+have+Math.floor(r()*1e4), sp:ITEMS[seed].plant, x, z, stage:3, rot:r()*TAU, lastGrow:key, wild:true }); have++; } }
  // plants grow overnight (watered plants always grow)
  if (!VISIT) for (const p of S.plants){ if (p.lastGrow===key) continue; const watered = p.watered && p.watered!==key; if (p.stage<3 && (watered || r()<0.55)) p.stage++; p.watered=null; p.lastGrow=key; }
  S.day={ key, fruit:{}, branch:{}, chop:{}, rock:{}, lucky:Math.floor(r()*9), digs, weeds, weather, peddler:merchantDay(key),
    stock:pickWeighted(r, furnPool, 6, [], i=>stockWeight(i,gt)), sold:{}, garden:[...pickN(seeds,4), ...pickN(starts,1), ...pickN(saps,1)], gsold:{},
    pstock:pickWeighted(r, Object.values(ITEMS).filter(i=>i.shop==='rare'), 2, [], i=>stockWeight(i,0)), psold:{}, chat:{}, gift:{} };
  // v1.13 rare things on their own random stream, so they don't shift the rest of the day
  const rr=mulberry32(hashStr(key+':rare:'+S.seed));
  if (!GUEST){ const a=rr(), b=rr(), c=rr();
    if (a<RARE_ODDS.beachPearl){ const p=beachSpot(rr); if (p) S.ground.push({ id:'moonpearl', x:p[0], z:p[1], beach:true }); }
    const plan=randomPlan(rr); if (plan && b<RARE_ODDS.bottlePlan){ const p=beachSpot(rr); if (p) S.ground.push({ id:plan, x:p[0], z:p[1], beach:true, bottle:true }); }
    for (let k=1;k<nRare;k++){ if (rr()<RARE_ODDS.beachPearl){ const p=beachSpot(rr); if (p) S.ground.push({ id:'moonpearl', x:p[0], z:p[1], beach:true }); }
      const pl=randomPlan(rr); if (pl && rr()<RARE_ODDS.bottlePlan){ const p=beachSpot(rr); if (p) S.ground.push({ id:pl, x:p[0], z:p[1], beach:true, bottle:true }); } }
    if (S.day.peddler && plan && c<RARE_ODDS.peddlerPlan) S.day.pplan=randomPlan(rr); }
  townNewDay(key); save(); return true;
}
function spawnDaily(){
  for(const e of dailyEnts) if(!e.removed) e.remove(); dailyEnts=[];
  for(const e of ents.slice()) if(e instanceof GroundItem) e.remove();
  S.day.digs.forEach((d,i)=>{ if(!d.dug) dailyEnts.push(new DigSpot(i,d.x,d.z)); });
  S.day.weeds.forEach((d,i)=>{ if(!d.pulled) dailyEnts.push(new Weed(i,d.x,d.z)); });
  for(const g of S.ground) new GroundItem(g);
  peddler=null; if(S.day.peddler){ peddler=new Peddler(); dailyEnts.push(peddler); }
  spawnPlants(); trees.forEach(t=>t.refresh());
  World.weather = weatherOverride || S.day.weather;
}
rollDay(); spawnDaily();
function ensureFavors(){ if (VISIT || TRIP || Q.rolledFor===S.day.key) return; rollFavors(mulberry32(hashStr(S.day.key+':favors:'+S.seed))); Q.rolledFor=S.day.key;
  for (const [k,v] of Object.entries(S.fruitPicked||{})) if (dayNum(S.day.key)-v >= FRUIT_REGROW_DAYS) delete S.fruitPicked[k]; save(); }
ensureFavors();
// furniture: validate saved positions (the island changed shape in v2)
for (const rec of S.placed.slice()){ const inRoom=rec.x>500; if (!inRoom && (!walkable(rec.x,rec.z) || blocked(rec.x,rec.z,ITEMS[rec.id].r))){ S.placed.splice(S.placed.indexOf(rec),1); S.inv.length<slotsMax() ? S.inv.push({id:rec.id,n:1}) : null; continue; } new Furniture(rec); }
for (const res of residents) if (res.wantsHome()) res.setLoc('in');
S.gardens=S.gardens||[]; rebuildGardens();

/* ---------- Weather ---------- */
const RAIN_N=isMobile?600:1100; const rainGeo=new THREE.BufferGeometry(); const rainPos=new Float32Array(RAIN_N*6); rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({ color:0xcfe6ff, transparent:true, opacity:0.55 })); rain.frustumCulled=false; scene.add(rain);
const snowGeo=new THREE.BufferGeometry(); const snowPos=new Float32Array(RAIN_N*3); snowGeo.setAttribute('position',new THREE.BufferAttribute(snowPos,3));
const snow=new THREE.Points(snowGeo,new THREE.PointsMaterial({ color:0xffffff, size:0.18, transparent:true, opacity:0.9 })); snow.frustumCulled=false; scene.add(snow);
for(let i=0;i<RAIN_N;i++){ const x=(Math.random()-0.5)*50, y=Math.random()*25, z=(Math.random()-0.5)*50; rainPos.set([x,y,z,x,y-0.6,z],i*6); snowPos.set([x,y,z],i*3); }
function updatePrecip(dt,t){
  const c=player.pos; rain.visible=World.weather==='rain'&&!World.inside; snow.visible=World.weather==='snow'&&!World.inside;
  if(rain.visible){ for(let i=0;i<RAIN_N;i++){ let y=rainPos[i*6+1]-dt*22, x=rainPos[i*6], z=rainPos[i*6+2]; if(y<0){ y=20+Math.random()*6; x=c.x+(Math.random()-0.5)*50; z=c.z+(Math.random()-0.5)*50; } rainPos[i*6]=x; rainPos[i*6+1]=y; rainPos[i*6+2]=z; rainPos[i*6+3]=x+0.05; rainPos[i*6+4]=y-0.7; rainPos[i*6+5]=z; } rainGeo.attributes.position.needsUpdate=true; }
  if(snow.visible){ for(let i=0;i<RAIN_N;i++){ let y=snowPos[i*3+1]-dt*1.6, x=snowPos[i*3]+Math.sin(t+i)*dt*0.4, z=snowPos[i*3+2]; if(y<0){ y=16+Math.random()*6; x=c.x+(Math.random()-0.5)*50; z=c.z+(Math.random()-0.5)*50; } snowPos[i*3]=x; snowPos[i*3+1]=y; snowPos[i*3+2]=z; } snowGeo.attributes.position.needsUpdate=true; }
}

/* ---------- Bugs spawn by time, month, weather and habitat ---------- */
/* ---------- Snow buildup ---------- */
// Snow piles up over snowy winter days and melts on clear ones. It settles on anything facing up
// (ground, roofs, tree tops, fences, rocks), never on people or animals, and never indoors.
const SNOW_U={ value:0 };
function dayWeatherFor(daysAgo){ const d=new Date(Time.now().getTime()-daysAgo*864e5); const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const r=mulberry32(hashStr(key+':'+S.seed)); const w=r(); return seasonOf(d.getMonth()+1)!=='winter' ? 'none' : w<0.6?'sunny':(w<0.82?'cloudy':'snow'); }
let snowTarget=0;
function computeSnow(){
  if (World.season!=='winter') return 0;
  let lv=0.12;   // a little frost all winter
  for (let i=6;i>=1;i--){ const w=dayWeatherFor(i); if (w==='snow') lv=Math.min(1, lv+0.45); else if (w==='sunny') lv=Math.max(0.12, lv*0.7); else if (w==='cloudy') lv=Math.max(0.12, lv*0.92); }
  if (World.weather==='snow'){ const h=Time.hour()+Time.now().getMinutes()/60; lv=Math.min(1, lv + 0.6*clamp((h-0)/14,0.25,1)); }   // builds up through a snowy day
  else if (World.weather==='sunny') lv=Math.max(0.12, lv*0.85);
  if (weatherOverride==='snow') lv=Math.max(lv,0.9);
  return lv;
}
function patchSnow(mat){
  if (mat.userData.snow || mat.userData.char || mat.transparent || !mat.isMeshStandardMaterial) return; mat.userData.snow=true;
  const prev=mat.userData.patch, prevKey=prev?'g':'';
  mat.onBeforeCompile=sh=>{ if (prev) prev(sh); sh.uniforms.uSnow=SNOW_U;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSnN; varying vec3 vSnP;')
      .replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvSnN = normalize((vec4(transformedNormal,0.0)*viewMatrix).xyz);')
      .replace('#include <project_vertex>','#include <project_vertex>\n#ifdef USE_INSTANCING\nvSnP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;\n#else\nvSnP=(modelMatrix*vec4(transformed,1.0)).xyz;\n#endif');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSnow; varying vec3 vSnN; varying vec3 vSnP;')
      .replace('#include <color_fragment>','#include <color_fragment>\nif(uSnow>0.001){ float up=smoothstep(0.45,0.85,normalize(vSnN).y); vec2 c=floor(vSnP.xz*3.0); float nz=fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453); float nz2=fract(sin(dot(floor(vSnP.xz*0.7),vec2(39.3,11.7)))*24634.6345); float a=up*smoothstep(0.0,0.35,uSnow*1.25-nz*0.3-nz2*0.25); diffuseColor.rgb=mix(diffuseColor.rgb, vec3(0.95,0.97,1.0), clamp(a,0.0,0.94)); }');
  };
  mat.customProgramCacheKey=()=>'snow1'+prevKey; mat.needsUpdate=true;
}
function snowPass(){ if (World.season!=='winter') return; OUT.traverse(o=>{ if(!o.isMesh) return; const ms=Array.isArray(o.material)?o.material:[o.material]; for(const m of ms) if(m) patchSnow(m); }); }
let snowT=0;
function updateSnow(dt){
  if (World.season!=='winter'){ SNOW_U.value=0; return; }
  snowT-=dt; if (snowT<=0){ snowT=5; snowTarget=computeSnow(); snowPass(); }
  SNOW_U.value = World.inside ? 0 : lerp(SNOW_U.value, snowTarget, Math.min(1, dt*0.8));
}

function bugPool(){ const h=Time.hour(), m=Time.month(); return Object.values(ITEMS).filter(i=>i.kind==='bug' && inMonths(m,i.months) && inHours(h,i.hours) && (!i.weather || i.weather===World.weather) && !(World.weather==='rain' && !i.weather && i.where==='air' && i.hours && i.hours[0]<12)); }
let bugT=0;
function updateBugs(dt){
  if (World.inside) return; bugT-=dt; if(bugT>0) return; bugT=2.5;
  const pool=bugPool(); for(const b of bugs.slice()){ const far=b.pos.distanceTo(player.pos)>38; if(far && (!pool.includes(b.it) || Math.random()<0.15)) b.despawn(); }
  if (bugs.length>=8 || !pool.length || Math.random()<0.3) return;
  const okPool=pool.filter(allowedFind); if(!okPool.length) return; const sp=tierPick(Math.random,okPool,i=>luckW(i,'bug'),'bug'); const near=[player.pos.x,player.pos.z,22]; let p=null, extra={};
  switch(sp.where){
    case 'air': case 'ground': p=randLand(Math.random,SAND_H+0.1,9,0.5,30,near); break;
    case 'flower': { const spots=[...wildFlowerSpots, ...S.plants.filter(q=>PLANTS[q.sp].ptype==='flower'&&q.stage===3).map(q=>[q.x,q.z])].filter(s=>Math.hypot(s[0]-player.pos.x,s[1]-player.pos.z)<26&&Math.hypot(s[0]-player.pos.x,s[1]-player.pos.z)>5); if(spots.length){ const s=spots[Math.floor(Math.random()*spots.length)]; p=[s[0]+(Math.random()-0.5),s[1]+(Math.random()-0.5)]; } break; }
    case 'trunk': { const ts=trees.filter(t=>!t.removed&&t.stage>=2&&!['palm'].includes(t.type)&&t.pos.distanceTo(player.pos)<26&&t.pos.distanceTo(player.pos)>5&&!bugs.some(b=>b.trunk===t.pos)); if(ts.length){ const t=ts[Math.floor(Math.random()*ts.length)]; p=[t.pos.x,t.pos.z]; extra.trunk=t.pos; } break; }
    case 'beach': for(let k=0;k<30&&!p;k++){ const a=Math.random()*TAU, d=4+Math.random()*20; const x=player.pos.x+Math.cos(a)*d, z=player.pos.z+Math.sin(a)*d; if(isBeach(x,z)) p=[x,z]; } break;
    case 'pond': if (Math.hypot(player.pos.x-POND.x,player.pos.z-POND.z)<30) p=[POND.x+(Math.random()-0.5)*4, POND.z+(Math.random()-0.5)*4]; break;
  }
  if (p) new Bug(sp.id, p[0], p[1], extra);
}

/* ---------- Sky, light, inside/outside ---------- */
const sunDir=new THREE.Vector3();
const lanterns=[]; { for(let i=0;i<22;i++){ const g=new THREE.Group(); mk(G.cyl(0.22,0.28,0.45,8),glowMat(0xffb070),0,0,0,g).castShadow=false; const s=addGlow(g,0,2.4,0xffb070); s.userData.event=true; g.visible=false; g.userData={ a:Math.random()*TAU, d:(58+Math.random()*30)*SC, y:Math.random()*14, s:0.4+Math.random()*0.5 }; OUT.add(g); lanterns.push(g); } }
const activeEvents = () => { const d=Time.now(), h=Time.hour(); return EVENTS.filter(e=>e.active(d,h)); };
function updateSky(){
  const h=Time.hour(); const night = 1-smooth(5.2,7,h)+smooth(18.8,20.5,h); World.night=clamp(night,0,1);
  windowMat.emissiveIntensity = World.night*1.4;
  WU.uFishCol.value.setHex(0x10283a).lerp(FISH_NIGHT, smooth(0.2,0.5,World.night)); WU.uFishA.value = 0.7 - World.night*0.1;
  for(const m of glowMats) m.emissiveIntensity = 0.15 + World.night*1.6;
  for(const s of glowSprites) s.material.opacity = s.userData.night ? World.night*0.45 : (s.userData.event ? s.material.opacity : World.night*0.85);
  if (World.inside){
    sky.visible=stars.visible=moon.visible=false; scene.background=new THREE.Color(0x2e2420); scene.fog.color.setHex(0x2e2420); scene.fog.near=60; scene.fog.far=200;
    hemi.color.setHex(0xfff0dc); hemi.groundColor.setHex(0x8a6a50); hemi.intensity=1.6-World.night*0.35; sun.color.setHex(0xfff0dc); sun.intensity=1.3; sunDir.set(0.3,1,0.45).normalize();
    if (homeFloorOf(World.inside)>=0 && S.home && S.home.built){ hemi.color.setHex(0xfff0dc); hemi.groundColor.setHex(0x6a5040); hemi.intensity=LT.amb-World.night*0.2; sun.color.setHex(0xfff0dc); sun.intensity=LT.sun; sunDir.set(0.3,1,0.45).normalize(); }
    if (World.inside==='museum'){ hemi.color.setHex(0xffe4c4); hemi.groundColor.setHex(0x5a3e2c); hemi.intensity=0.85; sun.color.setHex(0xffdcb0); sun.intensity=0.6; sunDir.set(0.15,1,0.35).normalize(); }
    renderer.toneMappingExposure = 1.15*(S.settings.bright||1); return; }
  sky.visible=stars.visible=true; scene.background=null; scene.fog.near=42; scene.fog.far=150;
  const dim = World.weather==='sunny'?0:(World.weather==='cloudy'?0.3:0.6);
  const top=colAt(h,'top',new THREE.Color()), bot=colAt(h,'bot',new THREE.Color());
  const grey=new THREE.Color(0xb4bcc6).multiplyScalar(0.55+0.45*numAt(h,'si')/3.1); top.lerp(grey,dim); bot.lerp(grey,dim*0.9);
  skyMat.uniforms.top.value.copy(top); skyMat.uniforms.bot.value.copy(bot); scene.fog.color.copy(bot).lerp(top,0.2);
  sun.color.copy(colAt(h,'sun',_c1)); sun.intensity=numAt(h,'si')*Math.max(0.15,1-dim*1.15);
  hemi.color.copy(colAt(h,'hs',_c1)); hemi.groundColor.copy(colAt(h,'hg',_c1)); hemi.intensity=numAt(h,'hi')*(1-dim*0.15)+dim*0.35;
  const isDay=h>=5.5&&h<19; const ang = isDay ? clamp((h-6)/12,0,1)*Math.PI : (((h<6?h+24:h)-19)/11)*Math.PI;
  sunDir.set(Math.cos(ang)*0.8, Math.max(0.35,Math.sin(ang))*0.95, -0.55).normalize();
  starMat.opacity = World.night*(1-dim); moon.visible = World.night>0.3 && dim<0.4; moon.material.opacity=World.night;
  moon.position.copy(camera.position).add(new THREE.Vector3(-160,140,-320));
  waterMat.color.copy(WATER_BASE).lerp(_c1.setHex(0x3a64a8), World.night*0.5).lerp(_c2.setHex(0x7a9aa6), dim*0.5);
  { const c=waterMat.color, b=WATER_BASE; WU.uTint.value.set(c.r/b.r, c.g/b.g, c.b/b.b); }
  deepSea.material.color.setHex(0x2a8aa8).lerp(_c1.setHex(0x24427a), World.night*0.6); WU.uSpark.value=(1-World.night)*(1-dim*0.8); WU.uFoamA.value=0.8-World.night*0.3;
  renderer.toneMappingExposure = (1.15 + World.night*0.2) * (S.settings.bright||1);
  clouds.forEach(c=>c.children.forEach(s=>s.material.color.setHex(0xffffff).lerp(_c1.copy(bot),0.3+World.night*0.25).lerp(_c2.setHex(0x8a94a0),dim)));
}
const fadeEl=$('#fade');
function fade(cb){ fadeEl.classList.add('show'); setTimeout(()=>{ cb(); setTimeout(()=>fadeEl.classList.remove('show'), 60); }, 260); }
function enterRoom(id){
  if (id==='store') storeVisit++;
  if (id==='portal') setTimeout(()=>refreshPortals(), 400);
  fade(()=>{ const R=ROOMS[id]; World.inside=id; camYaw=0; OUT.visible=false; for(const k in ROOMS) ROOMS[k].group.visible=(k===id);
    if (Fishing.state!=='idle') reel(); stopMove(); player.pos.set(R.entry[0],0,R.entry[1]); player.face=Math.PI; player.obj.rotation.y=Math.PI; camTarget.copy(player.pos); updateSky(); updateCamera(1);
    const res=residents.find(r=>r.spec.id===id); if (res && res.loc==='in' && !res.asleep){ const P=DIALOGUE[res.spec.personality]; setTimeout(()=>dialog(res.spec.name,res.spec.voice,[fill(P.home[Math.floor(Math.random()*P.home.length)],{c:res.spec.catch})]),350); } });
  Snd.door();
}
function exitRoom(){
  const R=ROOMS[World.inside]; fade(()=>{ for (const id of Object.keys(rebuildOnExit)){ delete rebuildOnExit[id]; setTimeout(()=>rebuildPlace(id),0); } World.inside=null; camYaw=0; OUT.visible=true; for(const k in ROOMS) ROOMS[k].group.visible=false; stopMove();
    player.pos.set(R.exit[0],0,R.exit[1]); player.pos.y=groundY(player.pos.x,player.pos.z); player.face=0; player.obj.rotation.y=0; camTarget.copy(player.pos); updateSky(); updateCamera(1); });
  Snd.door();
}

/* ---------- Dialogue ---------- */
const dlgEl=$('#dlg'), dlgText=$('#dlgText'), dlgName=$('#dlgName'), dlgChoices=$('#dlgChoices'), dlgMore=$('#dlgMore');
let dlgState=null;
function fill(s, extra={}){ return s.replace(/\{p\}/g,S.player||'friend').replace(/\{isle\}/g,S.island||'the island').replace(/\{c\}/g,extra.c||'').replace(/\{item\}/g,extra.item||''); }
function dialog(name, voice, lines, done, choices){ dlgState={ name, voice, lines:lines.slice(), done, choices, i:0, chars:0, full:'' }; dlgName.textContent=name; dlgEl.classList.add('show'); dlgChoices.innerHTML=''; nextLine(); }
function nextLine(){
  const d=dlgState; if(!d) return;
  if (d.i>=d.lines.length){
    if (d.choices){ dlgChoices.innerHTML=''; dlgMore.style.display='none'; d.choices.forEach(c=>{ const b=document.createElement('button'); b.className='btn'+(c.alt?' alt':''); b.textContent=c.label; b.onclick=(e)=>{ e.stopPropagation(); Snd.click(); const fn=c.fn; closeDialog(false); fn(); }; dlgChoices.appendChild(b); }); dlgSel=0; markChoice(); return; }
    closeDialog(true); return; }
  d.full=d.lines[d.i++]; d.chars=0; dlgText.textContent=''; dlgMore.style.display='none';
}
function closeDialog(runDone){ const d=dlgState; dlgState=null; dlgEl.classList.remove('show'); dlgChoices.innerHTML=''; if(runDone && d && d.done) d.done(); }
function tickDialog(dt){
  const d=dlgState; if(!d || !d.full || d.chars>=d.full.length){ if(d && d.full && d.chars>=d.full.length && !dlgChoices.children.length) dlgMore.style.display=''; return; }
  d.acc=(d.acc||0)+dt*55; while(d.acc>=1 && d.chars<d.full.length){ d.acc--; d.chars++; const ch=d.full[d.chars-1]; if(d.chars%2===0 && /[a-z]/i.test(ch)) Snd.blip(d.voice); }
  dlgText.textContent=d.full.slice(0,d.chars);
}
function advanceDialog(){ const d=dlgState; if(!d) return; if(d.chars<d.full.length){ d.chars=d.full.length; dlgText.textContent=d.full; } else if(!dlgChoices.children.length || d.i<d.lines.length) nextLine(); }
$('#dlgBox').addEventListener('pointerdown', e=>{ e.stopPropagation(); advanceDialog(); });
// Keyboard: WASD / arrows pick a choice, Enter / Space / E advance or confirm
let dlgSel=0;
function markChoice(){ const bs=[...dlgChoices.children]; bs.forEach((b,i)=>b.classList.toggle('sel', i===dlgSel)); }
function dialogKey(k){
  const bs=[...dlgChoices.children];
  if (bs.length){
    if (['w','a','arrowup','arrowleft'].includes(k)){ dlgSel=(dlgSel-1+bs.length)%bs.length; markChoice(); Snd.click(); return true; }
    if (['s','d','arrowdown','arrowright'].includes(k)){ dlgSel=(dlgSel+1)%bs.length; markChoice(); Snd.click(); return true; }
    if (k==='enter'||k===' '||k==='e'){ (bs[dlgSel]||bs[0]).click(); return true; }
    return true;
  }
  if (k==='enter'||k===' '||k==='e'){ advanceDialog(); return true; }
  return ['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k);
}
function showChoices(title, choices){ dialog(title, 500, [], null, choices); dlgName.textContent=title; dlgText.textContent='What would you like to do?'; }
function friendLevel(id){ const f=S.friend[id]||0; return f>=15?2:(f>=5?1:0); }
function greetingFor(res){
  const P=DIALOGUE[res.spec.personality], h=Time.hour(), c={ c:res.spec.catch };
  let pool = res.loc==='in' ? P.home : World.weather==='rain'?P.rain : World.weather==='snow'?P.snow : h<10?P.morning : h<17?P.day : h<20?P.evening : P.night;
  if (friendLevel(res.spec.id)===2 && Math.random()<0.4) pool=P.best;
  return fill(pool[Math.floor(Math.random()*pool.length)], c);
}
function talkTo(res){
  const P=DIALOGUE[res.spec.personality], c={ c:res.spec.catch };
  if (res.asleep){ dialog(res.spec.name, res.spec.voice, [fill(P.sleep[0],c)]); return; }
  res.talking=true; Snd.pop(); const end=()=>{ res.talking=false; };
  if (S.town.met[res.spec.id]===false){ S.town.met[res.spec.id]=true; S.friend[res.spec.id]=(S.friend[res.spec.id]||0)+1; save();
    dialog(res.spec.name, res.spec.voice, (ARRIVE[res.spec.personality]||ARRIVE.cheerful).map(l=>fill(l,c)), end); return; }
  if (res.spec.id==='bramble' && !S.craft && (countItem('wood')+countItem('softwood'))>0 && teachWoodworking(res, end)) return;
  if (mentorMoment(res, end)) return;
  const menu=()=>dialog(res.spec.name, res.spec.voice, [], end, [
    ...favorChoices(npcOf(res.spec.id), ()=>menu()),
    { label:'Chat', fn:()=>{ const first=!S.day.chat[res.spec.id]; let line;
        if(first){ S.day.chat[res.spec.id]=true; S.friend[res.spec.id]=(S.friend[res.spec.id]||0)+1; save(); line=fill(P.chat[Math.floor(Math.random()*P.chat.length)],c); }
        else line=fill(P.again[Math.floor(Math.random()*P.again.length)],c);
        dialog(res.spec.name, res.spec.voice, [line], menu); } },
    { label:'Give a gift', fn:()=>{ if(S.day.gift[res.spec.id]){ dialog(res.spec.name,res.spec.voice,[fill('You already gave me something today, {c}! Save it for tomorrow.',c)],menu); return; }
        openBag('give', i=>{ panelClose=null; closePanel(); giveGift(res,i,menu); }, ()=>menu()); } },
    ...(canAskToLeave(res.spec.id) ? [{ label:'Ever think about moving?', fn:()=>askToLeave(res, menu) }] : []),
    { label:'Bye!', alt:true, fn:end } ]);
  if (!VISIT){ const tk=(S.day.talked=S.day.talked||{}); if (!tk[res.spec.id]){ tk[res.spec.id]=1; track('talk'); } }
  dialog(res.spec.name, res.spec.voice, [greetingFor(res)], menu);
}
/* v1.26: ask an islander to move away. They pack up overnight. At least MIN_RES islanders always stay. */
const canAskToLeave = id => !VISIT && !GUEST && livesHere(id) && S.town.res.length>MIN_RES && !S.town.leaving;
const LEAVE_LINES = {
  cheerful:['Moving? Me? Oh... I hadn\'t thought about it, {c}.','I guess there are lots of islands out there. Do you think I should?'],
  gruff:['Hrm. You trying to get rid of me, {c}?','...Say it straight. You want me to go?'],
  dreamy:['Moving... like a cloud drifting somewhere new, {c}?','Is that what the island wants?'],
  sporty:['Moving? Like a new training camp, {c}?','Huh. Is that what you think I should do?'],
  caring:['Oh, dear. Moving? At my age, {c}?','Is that what you\'d like, sweetheart?'],
  elegant:['Darling, are you suggesting I relocate, {c}?','Be honest with me.'],
  lazy:['Moving sounds like a lot of lifting, {c}.','...You think I should, though?'] };
function askToLeave(res, back){
  const R=res.spec, c={ c:R.catch }, v=R.voice;
  dialog(R.name, v, (LEAVE_LINES[R.personality]||LEAVE_LINES.cheerful).map(l=>fill(l,c)), null, [
    { label:'I think it might be time', fn:()=>{ if (!canAskToLeave(R.id)) return back();
        S.town.leaving={ id:R.id, day:dayKeyOf(dayNum(today())+1) }; if (S.town.next && S.town.next.id===R.id) S.town.next=null; save();
        dialog(R.name, v, [fill('Oh. Okay. I\'ll start packing tonight, {c}.',c), 'I\'ll be gone by tomorrow. It was nice living here.'], ()=>toast(`${R.name} will move away tomorrow.`)); } },
    { label:'No, never mind!', alt:true, fn:()=>dialog(R.name, v, [fill('Phew. Okay, {c}.',c)], back) } ]);
}
function giveGift(res, slot, menu){
  const P=DIALOGUE[res.spec.personality], s=S.inv[slot], it=ITEMS[s.id]; removeAt(slot,1); S.day.gift[res.spec.id]=true; track('gift');
  const tier = res.spec.loves.includes(it.kind)?'love' : res.spec.likes.includes(it.kind)?'like' : 'meh';
  const pts = tier==='love'?3:tier==='like'?2:1; S.friend[res.spec.id]=(S.friend[res.spec.id]||0)+pts; save();
  const c={ c:res.spec.catch, item:it.name }; const lines=[fill(P[tier][Math.floor(Math.random()*P[tier].length)],c)]; let reward=null;
  if ((S.friend[res.spec.id]>=4 && Math.random()<0.35) || (tier==='love' && Math.random()<0.2)){ const pool=Object.values(ITEMS).filter(i=>i.kind==='furniture'&&i.shop==='stall'&&inMonths(Time.month(),i.months)&&(i.rarity??FR.c)>=3); reward=pool[Math.floor(Math.random()*pool.length)].id; lines.push(fill(P.returnGift[0],c)); }
  let styleGift=null; if (!reward && S.friend[res.spec.id]>=6 && Math.random()<0.25){ styleGift=grantRandomStyle(); if(styleGift) lines.push(fill(`Oh, and I had some leftover supplies from fixing up my place. Here, try ${styleGift} on your house!`,c)); }
  if (!reward && !styleGift && !GUEST && !VISIT && S.friend[res.spec.id]>=15 && Math.random()<0.08){ reward=randomTicket(); lines.push(fill('You\'re one of my best friends, so... here. A boat ticket. Go somewhere nice, {c}.',c)); }   // v1.26
  if (tier==='love'){ Snd.jingle(); sparkle(res.pos.clone().add(new THREE.Vector3(0,2,0))); }
  dialog(res.spec.name, res.spec.voice, lines, ()=>{ if(reward){ const r=addItem(reward); if(r) itemToast(reward, r==='new', 'Received'); else dropNear(reward, player.pos); } menu(); });
}

/* ---------- UI: panels, toasts, HUD ---------- */
const scrim=$('#scrim'), pTitle=$('#pTitle'), pBody=$('#pBody'), pFoot=$('#pFoot');
let panelClose=null;
function openPanel(title, onClose){ pTitle.textContent=title; pBody.innerHTML=''; setFoot(''); scrim.classList.add('show'); panelClose=onClose||null; Snd.click(); pBody.scrollTop=0; }
function setFoot(html){ pFoot.innerHTML=html; pFoot.style.display=html?'':'none'; }
function closePanel(){ const f=panelClose; panelClose=null; scrim.classList.remove('show'); if(f) f(); }
$('#pClose').onclick=()=>closePanel();
scrim.addEventListener('pointerdown', e=>{ if(e.target===scrim) closePanel(); });
function toast(msg, img, cls, sub){ const t=document.createElement('div'); t.className='toast'+(cls?' '+cls:''); if(img){ const i=new Image(); i.src=img; t.appendChild(i); } const d=document.createElement('div'); d.textContent=msg; if(sub){ const s=document.createElement('div'); s.className='sub'; s.innerHTML=sub; d.appendChild(s); } t.appendChild(d); $('#toasts').appendChild(t); setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity=0; setTimeout(()=>t.remove(),400); }, sub?3800:2600); while($('#toasts').children.length>3) $('#toasts').firstChild.remove(); }
function itemToast(id, isNew, verb){ const n=ITEMS[id].name; if (!isNew && PICK_VERBS.has(verb)){ pickNote(id, verb); return; } toast((isNew?'New! ':'')+`${verb}: ${n}`, thumb(id), isNew?'new':''); if(isNew) Snd.fanfare(); }
/* Everyday pickups show as a small note under the clock. The same thing picked up again bumps the count instead of stacking notes. */
const PICK_VERBS=new Set(['Picked up','Pulled','Picked','Bought']); const picksEl=$('#picks'), pickMap=new Map();
function pickNote(id, verb){ const key=verb+':'+id; let p=pickMap.get(key);
  if (p && p.el.isConnected){ p.n++; p.el.querySelector('span').innerHTML=`${ITEMS[id].name} <b>x${p.n}</b>`; clearTimeout(p.to); p.el.classList.remove('out'); }
  else { const el=document.createElement('div'); el.className='pick'; el.innerHTML=`<img src="${thumb(id)}"><span>${ITEMS[id].name}</span>`; picksEl.appendChild(el); p={ el, n:1 }; pickMap.set(key,p);
    while (picksEl.children.length>4){ const f=picksEl.firstChild; f.remove(); for (const [k,v] of pickMap) if (v.el===f) pickMap.delete(k); } }
  p.to=setTimeout(()=>{ p.el.classList.add('out'); setTimeout(()=>{ p.el.remove(); if (pickMap.get(key)===p) pickMap.delete(key); }, 380); }, 1800); }
const rarityTag = it => { const r=rarityLabel(it.rarity); return `<span class="rar" style="background:${RARITY_COLORS[r]}">${r}</span>`; };
function catchToast(id, m, isNew, best){ const it=ITEMS[id]; toast(`${isNew?'New! ':''}You caught ${article(it.name)} ${it.name}!`, thumb(id), isNew||best?'new':'', `${statText(id,m)} ${rarityTag(it)}${best?' <b>New record!</b>':''}`); if(isNew) Snd.fanfare(); }
const WICONS = {
  sunny:'<svg viewBox="0 0 32 32"><circle cx="16" cy="16" r="7" fill="#ffc94d" stroke="#e8a530" stroke-width="2"/><g stroke="#e8a530" stroke-width="2.4" stroke-linecap="round"><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3"/></g></svg>',
  night:'<svg viewBox="0 0 32 32"><path d="M21 4a12 12 0 1 0 7 19A10 10 0 0 1 21 4z" fill="#ffe9a8" stroke="#d8b85a" stroke-width="2"/></svg>',
  cloudy:'<svg viewBox="0 0 32 32"><path d="M9 24a6 6 0 0 1 0-12 8 8 0 0 1 15 2 5 5 0 0 1 0 10z" fill="#fff" stroke="#a8b4c0" stroke-width="2"/></svg>',
  rain:'<svg viewBox="0 0 32 32"><path d="M9 19a6 6 0 0 1 0-12 8 8 0 0 1 15 2 5 5 0 0 1 0 10z" fill="#e8eef4" stroke="#8a9aaa" stroke-width="2"/><g stroke="#5fa8d8" stroke-width="2.4" stroke-linecap="round"><path d="M11 23l-1 4M17 23l-1 4M23 23l-1 4"/></g></svg>',
  snow:'<svg viewBox="0 0 32 32"><path d="M9 19a6 6 0 0 1 0-12 8 8 0 0 1 15 2 5 5 0 0 1 0 10z" fill="#fff" stroke="#9ab0c4" stroke-width="2"/><g fill="#9ac4e8"><circle cx="11" cy="25" r="1.8"/><circle cx="17" cy="27" r="1.8"/><circle cx="23" cy="25" r="1.8"/></g></svg>',
};
let lastWIcon='';
function updateHUD(){
  const d=Time.now(); let hh=d.getHours(), mm=d.getMinutes(); const ap=hh>=12?'PM':'AM'; hh=hh%12||12;
  $('#tTime').textContent=`${hh}:${String(mm).padStart(2,'0')} ${ap}`;
  $('#tDate').textContent=d.toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' })+' · '+World.season[0].toUpperCase()+World.season.slice(1);
  const wi=(World.weather==='sunny' && World.night>0.5)?'night':World.weather; if(wi!==lastWIcon){ $('#wIcon').innerHTML=WICONS[wi]; lastWIcon=wi; }
  $('#mAmt').textContent=fmt(S.clams);
}
const kindName = k => ({veg:'Vegetable',herb:'Herb',berry:'Berry',food:'Food',gear:'Gear',fruit:'Fruit',material:'Material',shell:'Beach find',fossil:'Fossil',fish:'Fish',bug:'Bug',furniture:'Furniture',flower:'Flower',seed:'Seeds',sapling:'Plant',potion:'Potion',quest:'Favor item',plan:'Rare plan'})[k]||k;
const canPlant = it => it.kind==='seed' || it.kind==='sapling' || (it.kind==='fruit' && it.plant);

/* Bag: tap an item and its actions appear in the bar pinned to the bottom of the panel */
function invGrid(sel, dim){ let h='<div class="grid">'; const N=slotsMax(); for(let i=0;i<N;i++){ const s=S.inv[i]; if(!s){ h+='<div class="slot empty"></div>'; continue; } h+=`<div class="slot${sel===i?' sel':''}" data-i="${i}" style="${dim&&dim(s)?'opacity:.35':''}"><img src="${thumb(s.id)}" alt="">${s.n>1?`<span class="n">${s.n}</span>`:''}</div>`; } return h+'</div>'; }
function itemDetail(s){ const it=ITEMS[s.id]; let sub=kindName(it.kind); if(s.m) sub+=` · ${statText(s.id,s.m)}`; if(it.rarity && (it.kind==='fish'||it.kind==='bug'||it.kind==='furniture'||it.rare)) sub+=' '+rarityTag(it); if (it.rare) sub+=`<br>${it.how}`; return `<img src="${thumb(s.id)}"><div class="grow"><div class="nm">${it.name}${s.n>1?` x${s.n}`:''}</div><div class="sub">${sub}</div><div class="sub">Sells for ${fmt(entryPrice(s))} clams</div></div>`; }
function openBag(mode='view', onPick, onCancel){
  let sel=-1;
  const render=()=>{
    pBody.innerHTML = (mode==='give'?'<div class="muted" style="margin-bottom:8px">Pick something to give.</div>':mode==='swap'?'<div class="muted" style="margin-bottom:8px">Pick something to make room. Fish and bugs are released; anything else (the whole stack) is set down on the ground next to you, so you can pick it up later.</div>':'') + invGrid(sel) + `<div class="muted" style="margin-top:10px">${S.inv.length}/${slotsMax()} slots${S.pack>=0?' ('+BACKPACKS[S.pack].name+')':''}</div>`;
    const s=S.inv[sel];
    if (s){ const it=ITEMS[s.id]; let b='';
      if (mode==='give') b+=`<button class="btn" data-a="give">Give</button>`;
      else if (mode==='swap') b+=`<button class="btn" data-a="give">${it.kind==='fish'||it.kind==='bug'?'Release this':'Set this down'}</button>`;
      else { if (it.kind==='potion') b+=`<button class="btn" data-a="drink">Drink</button>`; if (it.kind==='food') b+=`<button class="btn" data-a="eat">Eat</button>`; if (s.id==='sled') b+=`<button class="btn" data-a="sled">Ride</button>`; if (it.kind==='furniture') b+=`<button class="btn" data-a="place">Place</button>`; if (canPlant(it) && !World.inside) b+=`<button class="btn" data-a="plant">Plant</button>`; b+=`<button class="btn alt" data-a="drop">${it.kind==='fish'||it.kind==='bug'?'Release':'Drop'}</button>`; }
      setFoot(`<div class="detail">${itemDetail(s)}<div class="acts">${b}</div></div>`);
    } else setFoot(`<div class="muted" style="padding:4px 2px">${mode==='give'?'Tap an item to give it.':''}</div>`);
    pBody.querySelectorAll('.slot[data-i]').forEach(el=>el.onclick=()=>{ sel=+el.dataset.i; Snd.click(); render(); });
    pFoot.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const s=S.inv[sel]; if(!s) return; const a=b.dataset.a;
      if(a==='give') onPick(sel);
      if(a==='drink'){ drinkPotion(sel); if(!S.inv[sel]) sel=-1; render(); return; }
      if(a==='eat'){ eatFood(sel); if(!S.inv[sel]) sel=-1; render(); return; }
      if(a==='sled'){ panelClose=null; closePanel(); toggleSled(); return; }
      if(a==='place'){ panelClose=null; closePanel(); startPlacing(s.id,'furn'); }
      if(a==='plant'){ panelClose=null; closePanel(); if (ITEMS[s.id].kind==='seed') openPlantPanel(s.id); else startPlacing(s.id,'plant'); }
      if(a==='drop'){ const it=ITEMS[s.id]; const m=s.m; removeAt(sel,1); if(it.kind==='fish'||it.kind==='bug'){ toast(`You let the ${it.name} go.`); Snd.swoosh(); } else dropNear(s.id, player.pos, 1.2, false, m); if(!S.inv[sel]) sel=-1; render(); } });
  };
  openPanel(mode==='give'?'Give a gift':mode==='swap'?'Make room':'Your Bag', onCancel); render();
}

/* ---------- Woodworking ----------
   Built to avoid New Horizons' crafting complaints:
   craft any amount in one tap (no one-at-a-time animations), craft from anywhere (the workbench is optional),
   every plan is visible with its unlock shown (no random recipe drops or duplicates),
   materials show have/need, and you can never lose materials to a full bag. */
const MAT_NAMES = { wood:'Wood', softwood:'Branch', stone:'Stone', clay:'Clay', iron:'Iron', stump:'Stump', weed:'Weeds' };
function craftNudge(id){
  if (S.craft || S.craftHint || (id!=='wood' && id!=='softwood')) return;
  S.craftHint=true; save();
}
/* Bramble only shares his tools with someone he's gotten to know a little (chat or a gift first). He's gruff about it:
   he isn't being generous, he's tired of watching good wood get wasted. */
function teachWoodworking(res, end){
  const c={ c:res.spec.catch }, nm=res.spec.name, v=res.spec.voice;
  if ((S.friend.bramble||0)<2){
    if (S.day.brambleNo){ return false; } S.day.brambleNo=true; save();
    dialog(nm, v, [fill('...You\'re hauling wood around like it owes you money, {c}.', c), 'I don\'t hand out my tools to people I just met. Come back when I know you a bit better.'], end); return true; }
  dialog(nm, v, [
    fill('Hrm. You again. Still dragging that wood around, {c}.', c),
    'It\'s painful to watch. Good wood, sold for a handful of clams. Wood wants to be something.',
    'Fine. FINE. Take my old workbench. I was going to build a new one anyway. This isn\'t a favor.',
    fill('The plans are in there. Start with a stool. Don\'t make it wobbly. If it\'s wobbly, don\'t tell me, {c}.', c),
  ], ()=>{
    S.craft={ made:0, kinds:[] }; S.friend.bramble=(S.friend.bramble||0)+2;
    const r=addItem('workbench'); if(!r) dropNear('workbench', player.pos);
    save(); updateCraftBtn(); Snd.fanfare();
    toast('You learned woodworking!', thumb('workbench'), 'new');
    dialog(nm, v, [fill('And make them in batches. Doing one at a time is for people with nothing better to do. ...Hrmph. Go on, {c}.', c)], end);
  });
  return true;
}
/* Islanders' gifts (see MENTOR in content.js): once a neighbor knows you, they share something. Never all at once. */
function mentorMoment(res, end){
  if (VISIT || S.day.mentor) return false; S.mentor=S.mentor||{};
  const m=MENTOR.find(x=>x.who===res.spec.id && !S.mentor[x.who+(x.winter?':w':'')]); if (!m) return false;
  if (daysHere()<m.day || (S.friend[m.who]||0)<m.friend) return false;
  if (m.winter && World.season!=='winter') return false;
  S.mentor[m.who+(m.winter?':w':'')]=true; S.day.mentor=true; S.friend[m.who]=(S.friend[m.who]||0)+1; save();
  const c={ c:res.spec.catch };
  dialog(res.spec.name, res.spec.voice, m.lines.map(l=>fill(l,c)), ()=>{
    for (const [id0,n] of m.give){ const id = id0==='native' ? S.nativeFruit : id0; for (let i=0;i<n;i++){ if (!addItem(id)) dropNear(id, player.pos); } itemToast(id, false, n>1?`Received ${n}`:'Received'); }
    if (m.cook){ S.cook=S.cook||{ made:0, kinds:[] }; updateCraftBtn(); setTimeout(()=>{ Snd.fanfare(); toast('You can cook now!', thumb('tomato_soup'), 'new'); }, 600); }
    if (m.give.some(g=>g[0]==='sled')) setTimeout(()=>toast('Got a sled!'), 900);
    save(); end(); });
  return true;
}
/* ---------- Cooking ----------
   Same rules as woodworking: every recipe is listed, cook any amount at once, never lose things to a full bag.
   You cook standing next to a Wood Stove (any recipe) or a campfire (grilled and simple things). */
function nearStation(){ let best=null;
  for (const e of ents){ if (!(e instanceof Furniture) || e.removed || !entVisible(e)) continue; const id=e.rec.id; if (id!=='stove' && id!=='campfire') continue;
    if (Math.hypot(e.pos.x-player.pos.x, e.pos.z-player.pos.z)<3.2){ if (id==='stove') return 'stove'; best='campfire'; } }
  return best; }
const haveNeed = ([id,n],k=1) => (ITEMS[id] ? countItem(id) : S.inv.filter(s=>ITEMS[s.id].kind===id).reduce((a,s)=>a+s.n,0)) >= n*k;
const needName = id => ITEMS[id] ? ITEMS[id].name : ({ fish:'Any fish', fruit:'Any fruit', berry:'Any berries' })[id];
const needHave = id => ITEMS[id] ? countItem(id) : S.inv.filter(s=>ITEMS[s.id].kind===id).reduce((a,s)=>a+s.n,0);
function cookMax(r){ let k=99; for (const [id,n] of r.need) k=Math.min(k, Math.floor(needHave(id)/n)); while (k>0 && !cookFits(r,k)) k--; return k; }
function cookFits(r,k){ // never lose anything to a full bag: worst case, all ingredients free up no slot
  const inv=S.inv.map(x=>({...x})); for (const [id,n] of r.need){ let need=n*k; for (let i=inv.length-1;i>=0&&need>0;i--){ const x=inv[i]; if ((ITEMS[id]?x.id!==id:ITEMS[x.id].kind!==id)) continue; const t=Math.min(need,x.n); x.n-=t; need-=t; if (x.n<=0) inv.splice(i,1); } }
  let add=k; const st=ITEMS[r.id].stack; for (const x of inv){ if (x.id===r.id && x.n<st) add-=st-x.n; } return add<=0 || Math.ceil(add/st)<=slotsMax()-inv.length; }
function doCook(r,k,at){ if (k<=0 || (!r.fire && at!=='stove') || !at || !cookFits(r,k) || !r.need.every(q=>haveNeed(q,k))) return false;
  takeFor(r.need.map(([id,n])=>[id,n*k])); let isNew=false; for (let i=0;i<k;i++) if (addItem(r.id)==='new') isNew=true;
  S.cook.made+=k; track('cook',k); if (!S.cook.kinds.includes(r.id)) S.cook.kinds.push(r.id); save(); Snd.water(); setTimeout(()=>Snd.jingle(),160);
  puff(player.pos.clone().add(new THREE.Vector3(Math.sin(player.face)*1.2,1.0,Math.cos(player.face)*1.2)),0xf4f4f4,8,0.4,1.6,0.9,1.0);
  toast(`${isNew?'New! ':''}You cooked ${k>1?k+' '+r.name+(/s$/.test(r.name)?'':'s'):article(r.name)+' '+r.name}!`, thumb(r.id), isNew?'new':''); return true; }
function cookTab(h0){
  const at=nearStation(); let h=h0||'';
  h+=`<div class="notice"><b>Cookbook</b> <span class="muted">· ${S.cook.kinds.length} of ${RECIPES.length} dishes made</span><br><span class="muted">${at==='stove'?'You\'re at a Wood Stove: you can cook anything.':at==='campfire'?'You\'re at a campfire: grilled and simple things only. A Wood Stove does the rest.':'Stand next to a campfire or a Wood Stove you\'ve placed to cook.'} Dishes sell for more than what goes in them, islanders love them, and eating one helps you walk a little faster for a while.</span></div>`;
  RECIPES.forEach((r,i)=>{ const mx=cookMax(r), ok=at && (r.fire || at==='stove');
    const need=r.need.map(([id,n])=>{ const has=needHave(id); return `<span style="color:${has>=n?'inherit':'#c0503a'};font-weight:${has>=n?400:700}">${needName(id)} ${has}/${n}</span>`; }).join(' · ');
    h+=`<div class="row"><img src="${thumb(r.id)}"><div class="grow"><div class="nm">${r.name}${!S.cook.kinds.includes(r.id)?' <span style="color:#d08a10;font-size:12px">NEW</span>':''} <span class="muted" style="font-size:12px">${r.fire?'stove or campfire':'stove'}</span></div><div class="sub">${need} · sells for ${fmt(ITEMS[r.id].price)}</div></div>
      <button class="btn alt" data-ck="${i}:1" ${!ok||mx<1?'disabled':''}>Cook</button>${mx>1?`<button class="btn" data-ck="${i}:${mx}" ${!ok?'disabled':''}>All ${mx}</button>`:''}</div>`; });
  return h; }
function bindCook(render){ pBody.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>{ const [i,k]=b.dataset.ck.split(':').map(Number); if (doCook(RECIPES[i], k, nearStation())){ const st=pBody.scrollTop; render(); pBody.scrollTop=st; } }); }
// Eating a dish: a cozy little boost to walking speed
function eatFood(slot){ const s=S.inv[slot]; if (!s || ITEMS[s.id].kind!=='food') return; const it=ITEMS[s.id]; removeAt(slot,1); S.fed=Math.max(nowMs(),S.fed||0)+5*60000; save(); Snd.jingle();
  toast(`Mmm, ${it.name}! You feel well fed.`, thumb(s.id), 'new', 'You walk a little faster for 5 minutes.'); updatePotionHUD(); }
const wellFed = () => (S.fed||0)>nowMs();
const recipeOut = r => r.out||1;
const kindsMade = () => S.craft ? (S.craft.kinds||[]).length : 0;
const recipeOpen = r => r.plan ? !!S.craft && knowsPlan(r.id) : !!S.craft && kindsMade()>=r.unlock;
function craftFits(r, k){
  // Simulate the bag: take the materials out, put the results in. Never lose materials to a full bag.
  const inv=S.inv.map(x=>({...x})), max=slotsMax();
  for (const [m,n] of Object.entries(r.mats)){ let need=n*k; for(let i=inv.length-1;i>=0&&need>0;i--){ const x=inv[i]; if(x.id!==m||x.m) continue; const t=Math.min(need,x.n); x.n-=t; need-=t; if(x.n<=0) inv.splice(i,1); } }
  let add=recipeOut(r)*k; const st=ITEMS[r.id].stack;
  for (const x of inv){ if(add<=0) break; if(x.id===r.id && !x.m && x.n<st){ const t=Math.min(add, st-x.n); add-=t; } }
  const freeSlots=max-inv.length; return add <= freeSlots*st;
}
function craftMax(r){
  let k=Infinity; for (const [m,n] of Object.entries(r.mats)) k=Math.min(k, Math.floor(countItem(m)/n));
  k=Math.min(k, 99); while (k>0 && !craftFits(r,k)) k--; return k;
}
function bagBlocked(r){ return Object.entries(r.mats).every(([m,n])=>countItem(m)>=n) && !craftFits(r,1); }
function doCraft(r, k){
  if (k<=0 || !recipeOpen(r) || !craftFits(r,k)) return false;
  for (const [m,n] of Object.entries(r.mats)) if (countItem(m)<n*k) return false;
  for (const [m,n] of Object.entries(r.mats)) removeItem(m, n*k);
  const n=recipeOut(r)*k; let isNew=false; for(let i=0;i<n;i++){ if(addItem(r.id)==='new') isNew=true; }
  const before=kindsMade(); S.craft.made+=k; track('craft',k); S.craft.kinds=S.craft.kinds||[];
  if (r.plan){ S.rare.made+=k; save(); Snd.chop(); setTimeout(()=>Snd.fanfare(),200); sparkle(player.pos.clone().add(new THREE.Vector3(0,2.2,0)));
    toast(`You made the ${ITEMS[r.id].name}!`, thumb(r.id), 'new', `${rarityTag(ITEMS[r.id])} It's in your bag.`); return true; }
  if(!S.craft.kinds.includes(r.id)) S.craft.kinds.push(r.id); save();
  Snd.chop(); setTimeout(()=>Snd.jingle(),140);
  toast(`${isNew?'New! ':''}You made ${n>1?n+' ':''}${n>1?ITEMS[r.id].name+(ITEMS[r.id].name.endsWith('s')?'':'s'):article(ITEMS[r.id].name)+' '+ITEMS[r.id].name}!`, thumb(r.id), isNew?'new':'');
  const fresh=WOODWORK.filter(x=>x.unlock>before && x.unlock<=kindsMade());
  if (fresh.length) setTimeout(()=>{ Snd.fanfare(); toast('New woodworking plans!', thumb(fresh[0].id), 'new', fresh.map(x=>ITEMS[x.id].name).join(', ')); }, 900);
  return true;
}
// v1.13: rare plans sit at the top of Woodworking. Unfound ones show as silhouettes.
const RARE_MATS = ['heartwood','goldsap','starstone','moonpearl','glimmermoss'];
function rareCraftSection(){
  const found=S.rare.plans.length, any=found || RARE_MATS.some(m=>countItem(m));
  if (!any) return '';   // v1.24: the rare section stays secret until you find your first plan or rare ingredient
  let h=`<div class="notice" style="border-color:${RARITY_COLORS.Legendary}"><b>Rare plans</b> <span class="muted">· ${found} found${S.rare.made?` · ${S.rare.made} made`:''}</span>`;
  RARE_WORK.forEach((r,i)=>{ const it=ITEMS[r.id], known=knowsPlan(r.id);
    if (!known) return;
    const mx=craftMax(r), mats=Object.entries(r.mats).map(([m,n])=>{ const have=countItem(m), ok=have>=n, rare=ITEMS[m].rare; return `<span style="color:${ok?'inherit':'#c0503a'};font-weight:${ok&&!rare?400:700}">${ITEMS[m].name} ${have}/${n}</span>`; }).join(' · ');
    h+=`<div class="row" style="margin:8px 0 0"><img src="${thumb(r.id)}"><div class="grow"><div class="nm">${it.name} ${rarityTag(it)}</div><div class="sub">${mats}${bagBlocked(r)?'<br><b>Your bag is full.</b> Make room first.':''}</div></div><button class="btn" data-rc="${i}" ${mx<=0?'disabled':''}>Make</button></div>`; });
  if (any) h+=`<div style="margin-top:10px"><b style="font-size:13px">Rare ingredients</b>`+RARE_MATS.filter(m=>countItem(m)).map(m=>`<div class="sub" style="margin-top:4px"><b>${ITEMS[m].name} ${countItem(m)}</b></div>`).join('')+'</div>';
  return h+'</div>'; }
function openCraft(start){
  if (!S.craft && !S.cook) return;
  let filter='all', tab = start || (S.craft ? 'wood' : 'cook'); const qty={};
  const render=()=>{
    const tabsH = S.craft && S.cook ? '<div class="tabs">'+[['wood','Woodworking'],['cook','Cooking']].map(([k,n])=>`<button class="tab${k===tab?' on':''}" data-ct="${k}">${n}</button>`).join('')+'</div>' : '';
    const bindTabs=()=>pBody.querySelectorAll('[data-ct]').forEach(b=>b.onclick=()=>{ tab=b.dataset.ct; Snd.click(); render(); pBody.scrollTop=0; });
    if (tab==='cook'){ pTitle.textContent='Cooking'; pBody.innerHTML=cookTab(tabsH); bindTabs(); bindCook(render); return; }
    pTitle.textContent='Woodworking';
    const kd=kindsMade(), next=WOODWORK.map(r=>r.unlock).filter(u=>u>kd).sort((a,b)=>a-b)[0];
    // v1.24: no progress bar or locked plans. New plans just turn up as you make things.
    let h=tabsH+`<div class="notice"><b>Woodworking</b> <span class="muted">· ${kd} different things made · ${fmt(S.craft.made)} crafted</span>`;
    h+= next!==undefined ? '' : `<br><span class="muted">You know every plan. Bramble would be proud.</span>`;
    h+=`<div class="muted" style="margin-top:6px">Your materials: ${Object.keys(MAT_NAMES).map(m=>`${MAT_NAMES[m]} ${countItem(m)}`).join(' · ')}</div></div>`;
    h+=rareCraftSection();
    h+='<div class="tabs">'+[['all','All plans'],['now','Can make now']].map(([k,n])=>`<button class="tab${k===filter?' on':''}" data-f="${k}">${n}</button>`).join('')+'</div>';
    let shown=0;
    WOODWORK.forEach((r,i)=>{ const it=ITEMS[r.id], open=recipeOpen(r), mx=open?craftMax(r):0;
      if (filter==='now' && mx<=0) return; shown++;
      if (!open){ shown--; return; }
      const q=Math.max(1, Math.min(qty[i]||1, Math.max(1,mx)));
      const mats=Object.entries(r.mats).map(([m,n])=>{ const have=countItem(m), ok=have>=n*q; return `<span style="color:${ok?'inherit':'#c0503a'};font-weight:${ok?400:700}">${MAT_NAMES[m]} ${have}/${n*q}</span>`; }).join(' · ');
      const out=recipeOut(r)*q;
      h+=`<div class="row"><img src="${thumb(r.id)}"><div class="grow"><div class="nm">${it.name}${S.craft.kinds&&!S.craft.kinds.includes(r.id)?' <span style="color:#d08a10;font-size:12px">NEW</span>':''}${recipeOut(r)>1?` <span class="muted">x${recipeOut(r)}</span>`:''}</div><div class="sub">${mats}${bagBlocked(r)?'<br><b>Your bag is full.</b> Make room first.':''}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">
          <button class="btn alt" data-q="${i}:-1" ${q<=1?'disabled':''} style="padding:4px 12px">-</button><b style="min-width:22px;text-align:center">${q}</b><button class="btn alt" data-q="${i}:1" ${q>=mx?'disabled':''} style="padding:4px 12px">+</button>
          <button class="btn alt" data-q="${i}:max" ${mx<=1?'disabled':''} style="padding:4px 10px">Max ${mx>1?mx:''}</button>
          <button class="btn" data-c="${i}" ${mx<=0?'disabled':''}>Make${out>1?' '+out:''}</button></div></div></div>`; });
    if (!shown) h+='<div class="muted">Nothing you can make right now.</div>';
    pBody.innerHTML=h; bindTabs();
    pBody.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ filter=b.dataset.f; Snd.click(); render(); });
    pBody.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ const [i,d]=b.dataset.q.split(':'); const r=WOODWORK[+i], mx=craftMax(r); qty[i]= d==='max'?mx:Math.max(1,Math.min(mx,(qty[i]||1)+(+d))); Snd.click(); render(); });
    pBody.querySelectorAll('[data-rc]').forEach(b=>b.onclick=()=>{ const r=RARE_WORK[+b.dataset.rc]; if (doCraft(r,1)){ const st=pBody.scrollTop; render(); pBody.scrollTop=st; } });
    pBody.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.c, r=WOODWORK[i]; const k=Math.max(1,Math.min(qty[i]||1, craftMax(r))); if(doCraft(r,k)){ qty[i]=1; const st=pBody.scrollTop; render(); pBody.scrollTop=st; } });
  };
  openPanel('Woodworking'); render();
}
function updateCraftBtn(){ const b=$('#bCraft'); if(b) b.style.display = S.craft||S.cook ? '' : 'none'; }

/* Collection book */
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function monthsText(ms){ if(!ms||ms==='all') return 'All year'; return ms.length>4? MONTHS[ms[0]-1]+' to '+MONTHS[ms[ms.length-1]-1] : ms.map(m=>MONTHS[m-1]).join(', '); }
function hoursText(h){ if(!h) return 'All day'; const f=x=>{ const a=x%24; return (a%12||12)+(a<12?'am':'pm'); }; return f(h[0])+' to '+f(h[1]); }
const WHERE = { sea:'Sea', river:'River', pond:'Pond', air:'Flying', flower:'On flowers', trunk:'On tree trunks', ground:'On the ground', beach:'On the beach' };
function openBook(tab='fish'){
  const tabs=[['fish','Fish'],['bug','Bugs'],['fossil','Fossils'],['shell','Beach'],['flower','Flowers'],['furniture','Furniture']];
  const render=()=>{
    const list=Object.values(ITEMS).filter(i=>i.kind===tab); const got=list.filter(i=>S.seen[i.id]).length;
    let h='<div class="tabs">'+tabs.map(([k,n])=>`<button class="tab${k===tab?' on':''}" data-t="${k}">${n}</button>`).join('')+'</div>';
    h+=`<div class="muted" style="margin-bottom:8px">${got} of ${list.length} discovered</div><div class="bar" style="margin-bottom:12px"><div style="width:${got/list.length*100}%"></div></div>`;
    for(const it of list){ const k=!!S.seen[it.id]; let sub='';
      if (it.kind==='fish'||it.kind==='bug'){ const R=S.rec[it.id]; sub = k ? `${WHERE[it.where]} · ${monthsText(it.months)} · ${hoursText(it.hours)}${it.weather?' · rain only':''}<br>${rarityTag(it)} ${R?`Caught ${R.n} · Biggest ${it.kind==='fish'?R.l+' cm':R.l+' mm'}`:''}${S.museum.items[it.id]?' · <b>In the museum</b>':''}` : `${WHERE[it.where]} · Not found yet`; }
      else sub = k ? 'Worth '+fmt(it.price)+' clams'+(S.museum.items[it.id]?' · <b>In the museum</b>':'') : 'Not found yet';
      h+=`<div class="row" style="${k?'':'opacity:.72'}"><div class="slot ${k?'':'unk'}" style="width:56px;border-width:2px"><img src="${thumb(it.id)}"></div><div class="grow"><div class="nm">${k?it.name:'???'}</div><div class="sub">${sub}</div></div></div>`; }
    pBody.innerHTML=h; pBody.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; Snd.click(); render(); pBody.scrollTop=0; });
  };
  openPanel('Collection Book'); render();
}

/* Shops. Skyrim-style: Pemberton's General Store buys anything at the standard price. Specialists (Marlo's aquarium
   shop for fish, Sprig's Bug & Bloom for bugs and flowers) pay a lot more for what they love and refuse everything else.
   Later in the game you can invest in a shop: bigger building, more and rarer stock, cheaper prices, better sell prices. */
/* v1.23: better tools aren't on the shelf the moment you buy the one below. On a later visit, once you can use the next tier
   and have the clams for it, Pemberton brings it out from the back himself. One pitch per visit. After that it stays on the Tools tab. */
let storeVisit=0; const toolBoughtAt={}, PITCH_ORDER=['axe','shovel','rod','net','can'];
function buyTool(t, k, which='stall'){
  const tr=TOOLS[t].tiers[k]; if (S.clams<tr.cost) return false;
  S.clams-=tr.cost; addTrade(which,tr.cost); S.tools[t]={ tier:k, uses:tr.forever?0:tr.uses }; S.toolEver[t]=Math.max(S.toolEver[t]??-1, k); S.toolOffer[t]=Math.max(S.toolOffer[t]??-1, k);
  toolBoughtAt[t]=storeVisit; Snd.coin(); equip(t); updateHUD(); toast(`You got the ${tr.name}! It's in your hand now.`, toolThumb(t,k)); save(); return true;
}
let pitchedVisit=-1;
function toolPitch(){
  if (pitchedVisit===storeVisit) return null;
  for (const t of PITCH_ORDER){ const T=TOOLS[t], own=S.tools[t], ever=Math.max(own?own.tier:-1, S.toolEver[t]??-1), k=ever+1;
    if (ever<0 || k>=T.tiers.length || k<=(S.toolOffer[t]??-1)) continue;
    if (toolBoughtAt[t]===storeVisit) continue;            // bought the last one this visit: give it a chance first
    if (!reqMet(t,k) || S.clams<T.tiers[k].cost) continue;   // only pitch what you can use and afford
    return { t, k }; }
  return null;
}
const PITCH_PERK = {
  axe:  ['It actually brings a tree down, which yours won\'t, and it lasts three times as long.', 'Two pieces of wood a swing instead of one, and it lasts ages.', 'Never breaks. Never. You could hand it down to your grandkids.'],
  shovel:['Lasts three times as long.', 'Now and then it turns up a little pile of clams with whatever you dig. And it lasts ages.', 'Never breaks. Not ever.'],
  rod:  ['Lasts three times as long and gives you a little more time when something bites.', 'An even longer bite window, and it lasts ages.', 'Never breaks. Not ever.'],
  net:  ['Lasts three times as long and makes catching a bit easier.', 'Makes catching a whole lot easier, and it lasts ages.', 'Never breaks. Not ever.'],
  can:  ['Lasts seven times as long as yours.', 'Never breaks. Not ever.'],
};
const PITCH_DID = { axe:'You\'ve been chopping up a storm', shovel:'You\'ve dug up half the island', rod:'You\'ve been pulling fish out left and right', net:'You\'ve been catching bugs left and right', can:'You\'ve been keeping every plant on the island watered' };
function pitchTool(k, p, after){
  pitchedVisit=storeVisit;
  const T=TOOLS[p.t], tr=T.tiers[p.k], cur=T.tiers[p.k-1], own=S.tools[p.t], perk=(PITCH_PERK[p.t]||[])[p.k-1]||'';
  const open = tr.forever ? 'Hold on, partner. Before you look around. Come with me to the back a second.'
    : tr.req&&tr.req.stat ? `Hey, you! Word gets around. ${PITCH_DID[p.t]}, I hear.`
    : `Hey! How's that ${cur.name} treating you?${own&&own.tier===p.k-1&&!cur.forever&&own.uses<10?' Looks about done for, if I\'m honest.':''}`;
  const pitch = tr.forever ? `I don't show this to just anybody. The ${tr.name}. ${perk}`
    : `I actually have a better option for you, if you've got the clams. Came in on the last boat. The ${tr.name}. ${perk}`;
  S.toolOffer[p.t]=p.k; save();
  dialog(k.name, k.voice, [open, pitch, `${fmt(tr.cost)} clams. What do you say?`], null, [
    { label:`Buy it (${fmt(tr.cost)})`, fn:()=>{ if (!buyTool(p.t, p.k)) { after(); return; } dialog(k.name, k.voice, ['Pleasure doing business! You won\'t regret it.'], after); } },
    { label:'Maybe later', alt:true, fn:()=>dialog(k.name, k.voice, ['No rush. I\'ll keep it on the tools shelf for you.'], after) } ]);
}
/* v1.26: the pitch comes when you go to buy the lower tier again (say, a new flimsy rod after the last one broke).
   Pemberton offers the next tier at 20% off, once. Turn it down and it stays on the Tools shelf at full price. */
const PITCH_OFF=0.2;
function pitchOnBuy(t, k){
  const T=TOOLS[t], n=k+1; if (!T || n>=T.tiers.length || n<=(S.toolOffer[t]??-1) || (S.toolEver[t]??-1)<k || !reqMet(t,n)) return false;
  const tr=T.tiers[n], price=Math.round(tr.cost*(1-PITCH_OFF)); if (S.clams<price) return false;
  const kp=KEEPERS[SHOPS.general.keeper], perk=(PITCH_PERK[t]||[])[n-1]||'', own=S.tools[t], broke=!own || (own.tier===k && !T.tiers[k].forever && own.uses<=0);
  S.toolOffer[t]=n; save(); panelClose=null; closePanel();
  const back=()=>openShop('stall');
  dialog(kp.name, kp.voice, [broke ? `Another ${T.tiers[k].name}? You wore the last one clean out, didn't you. Hang on a second.` : `Another ${T.tiers[k].name}? Before you grab that, hang on a second.`,
      `Somebody who uses a tool that hard should have a better one. The ${tr.name}. ${perk}`,
      `Normally ${fmt(tr.cost)} clams, but since it's your first, I'll do ${fmt(price)}.`], null, [
    { label:`Buy it (${fmt(price)})`, fn:()=>{ const c=tr.cost; tr.cost=price; const ok=buyTool(t, n); tr.cost=c; dialog(kp.name, kp.voice, [ok?'Pleasure doing business! You won\'t regret it.':'Hm, looks like you\'re a little short.'], back); } },
    { label:`Just the ${T.tiers[k].name}`, alt:true, fn:()=>{ buyTool(t, k); dialog(kp.name, kp.voice, ['Suit yourself. I\'ll keep the good one on the tools shelf for you.'], back); } } ]);
  return true;
}
function reqMet(t, tier){ const q=TOOLS[t].tiers[tier].req; if(!q) return true; if(q.tool!==undefined && (S.toolEver[t]===undefined || S.toolEver[t]<q.tool)) return false; if(q.stat && (S.stats[TOOLS[t].stat]||0)<q.stat) return false; return true; }
function packReq(i){ const q=BACKPACKS[i].req; if(!q) return true; if(q.caught && S.caught<q.caught) return false; if(q.discovered && discovered()<q.discovered) return false; if(q.bestFriends && bestFriends()<q.bestFriends) return false; return true; }
const shopKey = which => which==='stall' ? 'general' : which;
const PLURAL = { fish:'fish', bug:'bugs', flower:'flowers' }; const buysText = sh => sh.buys.map(k=>PLURAL[k]||k+'s').join(' and ');
// what a shop pays for one bag entry, or null if it won't buy it
function sellPrice(s, which){
  const id=shopKey(which), base=entryPrice(s); if (which==='rare') return base;
  const sh=SHOPS[id]; if (!sh) return base; const t=shopTier(id);
  if (sh.buys && !sh.buys.includes(ITEMS[s.id].kind)) return null;
  return Math.round(base*sh.sell[t]);
}
const buyPrice = (which, it) => { const sh=SHOPS[shopKey(which)]; return Math.round(it.buy*(1-(sh&&which!=='rare'?sh.discount[shopTier(shopKey(which))]:0))); };
function addTrade(which, n){ const id=shopKey(which); if (S.shops[id]) S.shops[id].trade+=n; }
// Today's stock for a shop. Deterministic per day, grows with the investment tier.
function shopStock(which){
  if (which==='rare') return S.day.pstock;
  const id=shopKey(which), t=shopTier(id), n=SHOPS[id].slots[t], m=Time.month();
  const r=mulberry32(hashStr(S.day.key+':'+id+':'+S.seed));
  const pickN=(pool,k,have=[])=>{ const a=pool.filter(i=>!have.includes(i.id)), o=[]; while(o.length<k && a.length) o.push(a.splice(Math.floor(r()*a.length),1)[0].id); return o; };
  if (id==='general'){ const base=S.day.stock.slice(0,6).filter(x=>ITEMS[x]);
    return [...base, ...pickWeighted(r, generalPool(m), n-base.length, base, i=>stockWeight(i,t)), 'chest']; }   // v1.19: a storage chest is always on the shelf
  const pool=Object.values(ITEMS).filter(i=>i.kind==='furniture' && i.shop===id && (i.tier||0)<=t);
  let out=[...pool.filter(i=>(i.tier||0)===t).map(i=>i.id).slice(0,1)]; out=[...out, ...pickN(pool, n-out.length, out)];
  if (id==='garden'){ const seeds=Object.values(ITEMS).filter(i=>i.kind==='seed'||(i.kind==='sapling'&&i.buy>0&&(t>=1||PLANTS[i.plant].ptype!=='tree'))); out=[...out, ...pickN(seeds, 2+t)]; }
  return out;
}
const isSold = (which, id, i) => { if (which==='rare') return !!S.day.psold[i]; if (which==='stall') return !!(S.day.sold[i] && i<6 && S.day.stock[i]===id) || !!S.day.sold['id:'+id]; const m=(S.day.ssold=S.day.ssold||{}); return !!(m[which]&&m[which][id]); };
const markSold = (which, id, i) => { if (which==='rare'){ S.day.psold[i]=true; return; } if (which==='stall'){ S.day.sold['id:'+id]=true; return; } const m=(S.day.ssold=S.day.ssold||{}); (m[which]=m[which]||{})[id]=true; };

function talkShop(id){
  const k=KEEPERS[SHOPS[id].keeper], open=shopOpen(id), shop=()=>openShop(id==='general'?'stall':id);
  if (id==='general' && !open){ dialog(k.name, k.voice, [keeperLine(k.id,'night')], ()=>openShop('stall')); return; }
  talkShopRest(id, k, shop);
}
function talkShopRest(id, k, shop){
  // v1.19: shopkeepers ask favors too. With nothing to ask, talking goes straight to the shop like before.
  const menu=()=>dialog(k.name, k.voice, [], null, [ { label:'Let\'s shop', fn:shop }, ...favorChoices(npcOf(k.id), ()=>menu()), { label:'Bye!', alt:true, fn:()=>{} } ]);
  if (!favorChoices(npcOf(k.id), ()=>{}).length){ dialog(k.name, k.voice, [keeperLine(k.id,'greet')], shop); return; }
  dialog(k.name, k.voice, [keeperLine(k.id,'greet')], menu);
}
function investBox(id){
  const sh=SHOPS[id], st=S.shops[id], t=st.tier, k=KEEPERS[sh.keeper];
  let h=`<div class="notice"><b>${sh.tiers[t]}</b> <span class="muted">· tier ${t+1} of 4</span><br><span class="muted">${id==='general'?`Sells to you at ${Math.round(sh.discount[t]*100)}% off and pays ${Math.round(sh.sell[t]*100)}% for anything.`:`Sells to you at ${Math.round(sh.discount[t]*100)}% off and pays ${Math.round(sh.sell[t]*100)}% for ${buysText(sh)}.`} ${sh.slots[t]} items in stock a day.</span></div>`;
  if (t>=3) return h+`<div class="notice">${k.name}'s shop is as grand as it gets. Thank you, partner!</div>`;
  const cost=INVEST.cost[t+1], houseOk=S.home.built, tradeOk=st.trade>=INVEST.trade;
  if (!houseOk || !tradeOk) return h+`<div class="notice"><span class="muted">${k.lock}</span></div>`;   // v1.24: no checklist, just a hint
  h+=`<div class="notice"><b>Invest in ${sh.tiers[t+1]}</b><br><span class="muted">${sh.perks[t+1]}. The building grows too.</span><div style="margin-top:6px"><b>${fmt(cost)} clams</b></div>`;
  h+=`<button class="btn" data-invest="${id}" style="margin-top:8px" ${S.clams<cost?'disabled':''}>Invest ${fmt(cost)}</button>`;
  return h+'</div>';
}
function doInvest(id){ if (noEdit()) return false;
  const st=S.shops[id], cost=INVEST.cost[st.tier+1]; if (st.tier>=3 || S.clams<cost || !S.home.built || st.trade<INVEST.trade) return false;
  S.clams-=cost; st.tier++; save(); updateHUD(); Snd.fanfare();
  rebuildPlace(id);
  const k=KEEPERS[SHOPS[id].keeper]; closePanel(); dialog(k.name, k.voice, [k.invest[st.tier-1]]); toast(`${SHOPS[id].tiers[st.tier]}!`, null, 'new', SHOPS[id].perks[st.tier]);
  return true;
}
function openShop(which, startTab){
  let tab=startTab||'buy', sel=-1; const sid=shopKey(which);
  const tabs = which==='rare' ? [['buy','Rare finds'],['sell','Sell']] : which==='stall' ? [['buy','Furniture'],['clothes','Clothes'],['home','Home goods'],['garden','Garden'],['tools','Tools'],['packs','Bags & bike'],['sell','Sell'],['invest','Invest']] : [['buy','Shop'],['sell','Sell'],['invest','Invest']];
  const buyRow=(id,i,sold,price,orig)=>{ const it=ITEMS[id]; return `<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${it.name}${it.kind==='furniture'&&it.rarity!==undefined?' '+rarityTag(it):''}</div><div class="sub">${fmt(price)} clams${orig&&orig!==price?` <s>${fmt(orig)}</s>`:''}${it.kind==='seed'?' · plant on grass':''}${it.kind==='sapling'?' · needs a shovel to plant':''}</div></div><button class="btn" data-b="${i}" ${sold||S.clams<price?'disabled':''}>${sold?'Sold':'Buy'}</button></div>`; };
  let list=[];
  // v1.8: this island's own seeds, always in stock, cheap, by the handful
  const islandRows=()=>`<div class="notice" style="margin-bottom:10px"><b>Grows wild here</b> <span class="muted">· always in stock</span>`+islandSeeds().map(id=>{ const it=ITEMS[id];
    return `<div class="row" style="margin:8px 0 0"><img src="${thumb(id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">${fmt(ISLAND_SEED_BUY)} clams each${countItem(id)?` · you have ${countItem(id)}`:''}</div></div><button class="btn alt" data-is="${id}:1" ${S.clams<ISLAND_SEED_BUY?'disabled':''}>1</button><button class="btn" data-is="${id}:10" ${S.clams<ISLAND_SEED_BUY*10?'disabled':''}>10</button></div>`; }).join('')+'</div>';
  const render=()=>{
    let h='<div class="tabs">'+tabs.map(([k,n])=>`<button class="tab${k===tab?' on':''}" data-t="${k}">${n}</button>`).join('')+'</div>'; setFoot('');
    if (tab==='buy'){ list=shopStock(which);
      const intro = which==='rare'?'Rare finds, today only.' : which==='stall'?'New furniture every day. At night, leave clams in the jar.' : which==='aquarium'?'Marlo\'s salty stock changes every day.' : 'Sprig\'s plants and bug gear change every day.';
      h+=`<div class="muted" style="margin-bottom:8px">${intro}</div>`; if (sid==='garden') h+=islandRows();
      if (which==='rare' && S.day.pplan && ITEMS[S.day.pplan]){ const pl=ITEMS[S.day.pplan], known=knowsPlan(pl.learns);
        h+=`<div class="notice" style="margin-bottom:10px"><b>Something special</b> <span class="muted">· a plan, wrapped in oilcloth</span><div class="row" style="margin:8px 0 0"><img src="${thumb(pl.learns)}"><div class="grow"><div class="nm">${pl.name} ${rarityTag(pl)}</div><div class="sub">${fmt(PLAN_PRICE)} clams · teaches you to make it. You still need the rare ingredients.</div></div><button class="btn" id="buyPlan" ${known||S.clams<PLAN_PRICE?'disabled':''}>${known?'Known':'Buy'}</button></div></div>`; } list.forEach((id,i)=>h+=buyRow(id,i,isSold(which,id,i),buyPrice(which,ITEMS[id]),ITEMS[id].buy)); }
    if (tab==='garden'){ list=S.day.garden; h+=islandRows()+'<div class="muted" style="margin-bottom:8px">Other seeds and plants change daily.</div>'; list.forEach((id,i)=>h+=buyRow(id,i,S.day.gsold[i],buyPrice(which,ITEMS[id]),ITEMS[id].buy)); }
    if (tab==='tools'){
      for (const [t,T] of Object.entries(TOOLS)){ const own=S.tools[t];
        h+=`<div class="notice"><b>${T.name}</b> <span class="muted">· ${T.does}</span><br><span class="muted">${own?`You have: ${T.tiers[own.tier].name}, ${T.tiers[own.tier].forever?'never breaks':own.uses+' uses left'}`:'You don\'t have one yet.'}</span>`;
        // v1.23: better tools stay off the shelf until Pemberton offers them to you in person (see toolPitch)
        const ever=Math.max(own?own.tier:-1, S.toolEver[t]??-1), offered=S.toolOffer[t]??-1; let hidden=0;
        T.tiers.forEach((tr,k)=>{ const ok=reqMet(t,k), keep=own&&T.tiers[own.tier].forever&&k<=own.tier;
          if (k>0 && k>ever && k>offered){ hidden++; return; }
          h+=`<div class="row" style="margin:8px 0 0"><img src="${toolThumb(t,k)}"><div class="grow"><div class="nm">${tr.name}</div><div class="sub">${fmt(tr.cost)} clams · ${tr.forever?'<b>Never breaks</b>':tr.uses+' uses'}${tr.bonus&&t==='net'?` · +${Math.round(tr.bonus*100)}% catch`:''}${tr.bonus&&t==='rod'?` · longer bite window`:''}${tr.nofell?' · can\'t fell trees':''}${k>ever&&k>0?' <span style="color:#d08a10;font-weight:600">New!</span>':''}</div></div><button class="btn" data-tool="${t}:${k}" ${keep||!ok||S.clams<tr.cost?'disabled':''}>${keep?(k===own.tier?'Owned':'Kept'):'Buy'}</button></div>`; });
        if (hidden) h+=`<div class="muted" style="margin-top:6px"></div>`;
        h+='</div>'; } }
    if (tab==='packs'){
      h+=`<div class="muted" style="margin-bottom:8px">You have ${slotsMax()} slots now.</div>`;
      h+=`<div class="row"><img src="${bikeThumb()}"><div class="grow"><div class="nm">Bicycle</div><div class="sub">${fmt(BIKE_COST)} clams · about twice as fast outdoors.${GUEST?'<br>Guest wallets top out at 10,000 clams, so you need an account for this one.':''}</div></div>${S.bike?'<span class="muted">Owned</span>':`<button class="btn" id="buyBike" ${S.clams<BIKE_COST?'disabled':''}>Buy</button>`}</div>`;
      if (World.season==='winter' || countItem('sled')) h+=`<div class="row"><img src="${thumb('sled')}"><div class="grow"><div class="nm">Wooden Sled</div><div class="sub">${fmt(ITEMS.sled.buy)} clams · winter only · ride it down snowy hills${isTouchDevice?'':` (press ${KB().sled.toUpperCase()})`}</div></div>${countItem('sled')?'<span class="muted">Owned</span>':`<button class="btn" id="buySled" ${S.clams<ITEMS.sled.buy?'disabled':''}>Buy</button>`}</div>`;
      // v1.24: the next bag only shows up once you've earned it. No requirement lists.
      BACKPACKS.forEach((p,i)=>{ const owned=i<=S.pack, next=i===S.pack+1, ok=next&&packReq(i); if (i>S.pack+1 || (next && !ok)) return;
        h+=`<div class="row"><div class="slot" style="width:56px;border-width:2px;font-weight:700">${p.slots}</div><div class="grow"><div class="nm">${p.name}${next?' <span style="color:#d08a10;font-weight:600">New!</span>':''}</div><div class="sub">${p.slots} slots · ${fmt(p.cost)} clams</div></div>${owned?'<span class="muted">Owned</span>':`<button class="btn" data-pack="${i}" ${S.clams<p.cost?'disabled':''}>Buy</button>`}</div>`; }); }
    if (tab==='sell'){
      const sh=SHOPS[sid]; const pays = which==='rare' ? '' : sh.buys ? `${KEEPERS[sh.keeper].name} pays <b>${Math.round(sh.sell[shopTier(sid)]*100)}%</b> for ${buysText(sh)}. Nothing else.` : `Pemberton buys anything${shopTier('general')?` at <b>${Math.round(sh.sell[shopTier('general')]*100)}%</b>`:''}. Specialists pay more for their thing.`;
      h+=`<div class="muted" style="margin-bottom:8px">${pays} Bigger catches are worth more.</div>`+invGrid(sel, s=>sellPrice(s,which)===null);
      const s=S.inv[sel]; if(s){ const it=ITEMS[s.id], pr=sellPrice(s,which); const same=S.inv.filter(x=>x.id===s.id && !x.m).reduce((a,x)=>a+x.n,0);
        if (pr===null) setFoot(`<div class="detail">${itemDetail(s)}<div class="acts muted" style="max-width:220px">${KEEPERS[SHOPS[sid].keeper].refuse}</div></div>`);
        else { setFoot(`<div class="detail">${itemDetail(s).replace(/Sells for [\d,]+ clams/, `Sells here for <b>${fmt(pr)}</b> clams`)}<div class="acts"><button class="btn" id="s1">Sell 1</button>${!s.m&&same>1?`<button class="btn alt" id="sA">Sell all ${fmt(pr*same)}</button>`:''}</div></div>`);
          pFoot.querySelector('#s1').onclick=()=>{ if(!walletOK(pr)) return; removeAt(sel,1); addClams(pr); addTrade(which,pr); track('sold'); track('earned',pr); Snd.coin(); if(!S.inv[sel]||S.inv[sel].id!==s.id) sel=-1; render(); };
          const sa=pFoot.querySelector('#sA'); if(sa) sa.onclick=()=>{ if(!walletOK(pr*same)) return; removeItem(s.id,same); addClams(pr*same); addTrade(which,pr*same); track('sold',same); track('earned',pr*same); Snd.coin(); sel=-1; render(); }; }
      } else setFoot('');
      // quick sell-everything-they-want button for specialists
      if (which!=='stall' && which!=='rare'){ const total=S.inv.reduce((a,x)=>{ const p=sellPrice(x,which); return a+(p===null?0:p*x.n); },0); if(total>0) h+=`<button class="btn" id="sAllShop" style="margin-top:10px">Sell all ${buysText(SHOPS[sid])} for ${fmt(total)}</button>`; } }
    if (tab==='home'){ const st=homeStock();
      if (GUEST) h+='<div class="notice">Home goods are for homeowners. Make an account to get a house.</div>';
      else if (!st.length) h+='<div class="notice">You own every style Pemberton can get. Impressive!</div>';
      st.forEach((it,i)=>{ const own=homeOwned(it), p=homePrice(it); h+=`<div class="row">${homeSwatch(it)}<div class="grow"><div class="nm">${homeName(it.list,it.v)}</div><div class="sub">${fmt(p)} clams · ${homeWhere(it)}</div></div><div style="display:flex;flex-direction:column;gap:4px">${own?'':`<button class="btn alt sm" data-ht="${i}">Try it on</button>`}<button class="btn sm" data-hb="${i}" ${own||S.clams<p?'disabled':''}>${own?'Owned':'Buy'}</button></div></div>`; });
      }
    if (tab==='clothes'){ const L=clothesStock();
      h+=`<div class="muted" style="margin-bottom:8px">New clothes every day. They go straight into your wardrobe: wear them from Menu, Change my look.</div>`;
      L.forEach(id=>{ const it=ITEMS[id], own=ownsWear(id), p=buyPrice(which,it); h+=`<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${it.name} ${rarityTag(it)}</div><div class="sub">${fmt(p)} clams${it.buy!==p?` <s>${fmt(it.buy)}</s>`:''} · ${wearKind(it)}</div></div><button class="btn" data-cw="${id}" ${own||S.clams<p?'disabled':''}>${own?'Owned':'Buy'}</button></div>`; });
      h+=`<div class="muted" style="margin-top:10px">You own ${S.wardrobe.length} of ${WEAR_IDS.length} pieces. Some only come as thank-you gifts from islanders.</div>`; }
    if (tab==='invest') h+=investBox(sid);
    pBody.innerHTML=h;
    pBody.querySelectorAll('[data-cw]').forEach(b=>b.onclick=()=>{ const id=b.dataset.cw, it=ITEMS[id], price=buyPrice(which,it); if (ownsWear(id) || S.clams<price) return; S.clams-=price; addTrade(which,price); Snd.coin(); updateHUD(); grantWear(id); save(); render(); });
    pBody.querySelectorAll('[data-hb]').forEach(b=>b.onclick=()=>{ if (buyHome(homeStock()[+b.dataset.hb])) render(); });
    const bp=pBody.querySelector('#buyPlan'); if (bp) bp.onclick=()=>{ const pl=S.day.pplan; if (!pl || knowsPlan(ITEMS[pl].learns) || S.clams<PLAN_PRICE) return; S.clams-=PLAN_PRICE; updateHUD(); Snd.coin(); learnPlan(pl); save(); render(); };
    pBody.querySelectorAll('[data-ht]').forEach(b=>b.onclick=()=>{ const it=homeStock()[+b.dataset.ht];
      if (VISIT){ toast('You can try styles on your own house when you\'re home.'); return; }
      if (!S.home.built){ toast('Get a house first. Clementine at the town hall does home loans.'); Snd.fail(); return; }
      panelClose=null; closePanel(); openBuild({ tryItem:it }); });
    pBody.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; sel=-1; Snd.click(); render(); pBody.scrollTop=0; });
    pBody.querySelectorAll('.slot[data-i]').forEach(el=>el.onclick=()=>{ sel=+el.dataset.i; Snd.click(); render(); });
    const sAll=pBody.querySelector('#sAllShop'); if(sAll) sAll.onclick=()=>{ let tot=0, cnt=0; for(let i=S.inv.length-1;i>=0;i--){ const x=S.inv[i], p=sellPrice(x,which); if(p===null) continue; if(GUEST && S.clams+tot+p*x.n>GUEST_CAP.clams) continue; tot+=p*x.n; cnt+=x.n; S.inv.splice(i,1); } addClams(tot); addTrade(which,tot); track('sold',cnt); track('earned',tot); Snd.coin(); save(); sel=-1; render(); };
    pBody.querySelectorAll('[data-is]').forEach(b=>b.onclick=()=>{ const [id,k0]=b.dataset.is.split(':'), k=+k0, price=ISLAND_SEED_BUY*k; if (S.clams<price) return; if (!roomFor([[id,k]])){ toast('Your bag is full.'); return; }
      S.clams-=price; addTrade(which,price); let isNew=false; for (let q=0;q<k;q++) if (addItem(id)==='new') isNew=true; Snd.coin(); updateHUD(); toast(`${isNew?'New! ':''}Bought ${k} ${ITEMS[id].name.toLowerCase()}.`, thumb(id), isNew?'new':''); save(); render(); });
    pBody.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.b; const id=list[i], it=ITEMS[id], price=buyPrice(which,it);
      if(S.clams<price) return; if(!canAdd(id)){ toast('Your bag is full.'); return; } S.clams-=price; if(tab==='garden') S.day.gsold[i]=true; else markSold(which,id,i); addTrade(which,price); if (which==='rare') track('peddler'); const r=addItem(id); Snd.coin(); updateHUD(); itemToast(id, r==='new', 'Bought'); render(); });
    pBody.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ const [t,k]=b.dataset.tool.split(':');
      if (which==='stall' && !VISIT && pitchOnBuy(t,+k)) return;   // v1.26: Pemberton steps in when you reach for the old model
      if (buyTool(t,+k,which)) render(); });
    const bs=pBody.querySelector('#buySled'); if (bs) bs.onclick=()=>{ if (countItem('sled')||S.clams<ITEMS.sled.buy) return; if (!canAdd('sled')){ toast('Your bag is full.'); return; } S.clams-=ITEMS.sled.buy; addTrade(which,ITEMS.sled.buy); addItem('sled'); Snd.coin(); updateHUD(); setSledBtn(); toast('You got a sled! Find a snowy hill.'); save(); render(); };
    const bb=pBody.querySelector('#buyBike'); if(bb) bb.onclick=()=>{ if(S.bike||S.clams<BIKE_COST) return; S.clams-=BIKE_COST; addTrade(which,BIKE_COST); S.bike=true; Snd.fanfare(); updateHUD(); setBikeBtn(); toast('You got a bicycle!'); save(); render(); };
    pBody.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.pack, p=BACKPACKS[i]; if(i!==S.pack+1||!packReq(i)||S.clams<p.cost) return; S.clams-=p.cost; addTrade(which,p.cost); S.pack=i; Snd.fanfare(); updateHUD(); toast(`You got the ${p.name}! (${p.slots} slots)`); save(); render(); });
    pBody.querySelectorAll('[data-invest]').forEach(b=>b.onclick=()=>doInvest(b.dataset.invest));
  };
  openPanel(which==='rare'?'Fennick\'s Rare Finds':SHOPS[sid].name); render();
}

/* ---------- Museum ----------
   Professor Thistle takes one of every fish, bug, fossil and beach find. Each donation gets its own display inside. */
const MUSEUM_IDS = Object.fromEntries(MUSEUM.kinds.map(k=>[k, Object.values(ITEMS).filter(i=>i.kind===k).map(i=>i.id)]));
const MUSEUM_TOTAL = Object.values(MUSEUM_IDS).reduce((a,l)=>a+l.length,0);
const donatedCount = () => Object.keys(S.museum.items).length;
const MUSEUM_ORDER = MUSEUM.kinds.flatMap(k=>MUSEUM_IDS[k]);
function exhibitInfo(id){ const it=ITEMS[id], when=new Date(S.museum.items[id]), R=S.rec[id], anon=S.museum.anon&&S.museum.anon[id];
  return `${anon?'Given by an anonymous islander':'Donated'} ${when.toLocaleDateString('en-US',{month:'short',day:'numeric'})}${R&&!anon?` · your biggest: ${it.kind==='fish'?R.l+' cm':R.l+' mm'}`:''}${it.kind==='fish'||it.kind==='bug'?' · '+rarityTag(it):''}`; }
// A fossil pedestal (empty ones stay, waiting) or a beach find in the glass case
class Exhibit extends Ent {
  constructor(id, x, z, obj, spin, kind){ super('exhibit', x, z, 0.3); this.id=id; this.mk=kind; this.solid=false; this.reach=1.8; this.has=!!(id && S.museum.items[id]); this.spin=spin; this.attach(obj); }
  label(){ return this.has?'Look':null; }
  act(){ if (!this.has){ toast(this.mk==='fossil'?'An empty pedestal. Professor Thistle is saving it for a fossil.':'An empty spot in the case.'); return; } toast(ITEMS[this.id].name, thumb(this.id), '', exhibitInfo(this.id)); }
  update(dt){ if (this.spin) this.spin.rotation.y+=dt*0.35; }
}
// A whole aquarium tank or terrarium. Walk up and press View (or click it) for the fullscreen view.
class MuseumTank extends Ent {
  constructor(T, R, shown){ super('tank', R.ox+T.x, R.oz+T.z, 0.5); this.T=T; this.solid=false; this.reach=T.len/2+1.2;
    this.have=T.group.slots ? shown.slice(0, T.group.slots) : shown.filter(id=>T.group.ids.includes(id)); const g=buildTank(T.group, T.len, this.have); g.rotation.y=T.rot; this.attach(g); }
  label(){ return 'View'; }
  act(){ openTankView(this); }
  update(dt,t){ const u=this.obj.userData; if (u.update && World.inside==='museum') u.update(t,dt); }
}
const exhibits={}, museumTanks=[];
function clearMuseumEnts(){ for (const id in exhibits){ exhibits[id].remove(); delete exhibits[id]; } for (const e of museumTanks) e.remove(); museumTanks.length=0; }
// Everything on display is rebuilt together (cheap, and only when something changes)
function spawnExhibits(){ const R=museumRoom(); if (!R || !R.layout) return; clearMuseumEnts(); const LY=R.layout;
  const shown={ fish:onDisplay('fish'), bug:onDisplay('bug') };
  for (const T of LY.tanks) museumTanks.push(new MuseumTank(T, R, shown[T.kind]));
  const fos=onDisplay('fossil');
  LY.pedestals.forEach((p,i)=>{ const id=fos[i]||null, big=!!id && isBigFossil(id), g=buildPedestal(id, p.h, big, !!id); let m=null;
    if (id){ m=fossilModel(id, big); m.position.y=p.h+0.05+m.userData.h/2+0.02; g.add(m); }
    exhibits[id||('ped'+i)]=new Exhibit(id, R.ox+p.x, R.oz+p.z, g, m, 'fossil'); });
  const sl=shellSlots(LY.shells.len, LY.shells.slots); onDisplay('shell').forEach((id,i)=>{ if (!sl[i]) return; const m=shellModel(id), g=new THREE.Group(); m.position.y=0.89+m.userData.h/2; g.add(m);
    exhibits[id]=new Exhibit(id, R.ox+LY.shells.x+sl[i][0], R.oz+LY.shells.z+sl[i][1], g, null, 'shell'); }); }

/* ---------- Fullscreen tank view ---------- */
let tankView=null, tankZoom=null;
const tvEl=document.createElement('div'); tvEl.id='tankView';
tvEl.innerHTML=`<div class="tvHead"><div class="tvPlaque"><div class="tvName"></div><div class="tvSub"></div></div><button class="tvX" aria-label="Close">&times;</button></div>
  <div class="tvEmpty"></div><div class="tvCard"></div><div class="tvStrip"></div>`;
document.body.appendChild(tvEl);
{ const st=document.createElement('style'); st.textContent=`
#tankView{position:fixed;inset:0;z-index:26;display:none;touch-action:none;user-select:none;-webkit-user-select:none;box-shadow:inset 0 0 120px 30px rgba(20,12,6,.75)}
#tankView.show{display:block}
body.tankOpen #hud,body.tankOpen #grade{visibility:hidden}
#tankView .tvHead{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 12px);display:flex;justify-content:space-between;align-items:flex-start;padding:0 14px;pointer-events:none}
#tankView .tvPlaque{background:linear-gradient(180deg,#f2d58a,#c9973e);border:3px solid #7a5220;border-radius:12px;padding:7px 16px 8px;color:#3e2810;box-shadow:0 4px 14px rgba(0,0,0,.45);pointer-events:auto}
#tankView .tvName{font-weight:700;font-size:20px;line-height:1.1}
#tankView .tvSub{font-size:13px;opacity:.8;margin-top:2px}
#tankView .tvX{pointer-events:auto;width:48px;height:48px;border-radius:50%;border:3px solid var(--line,#e7d1a6);background:var(--cream,#fff8ea);font-size:28px;font-weight:700;color:#5b4336;line-height:1;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.4)}
#tankView .tvEmpty{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);background:rgba(255,248,234,.92);border:3px solid #e7d1a6;border-radius:18px;padding:14px 20px;color:#5b4336;font-weight:600;text-align:center;max-width:80vw;display:none}
#tankView .tvCard{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom) + 96px);transform:translateX(-50%);background:var(--cream,#fff8ea);border:3px solid var(--line,#e7d1a6);border-radius:18px;padding:10px 16px;color:#5b4336;display:none;align-items:center;gap:12px;width:min(440px,88vw);box-sizing:border-box;box-shadow:0 6px 18px rgba(0,0,0,.4)}
#tankView .tvCard.show{display:flex}
#tankView .tvCard img{width:56px;height:56px;flex:none}
#tankView .tvCard b{font-size:17px}
#tankView .tvCard .sub{font-size:13px;opacity:.85;margin-top:2px;line-height:1.35}
#tankView .tvStrip{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 12px);display:flex;gap:6px;padding:0 10px;overflow-x:auto;scrollbar-width:none;touch-action:pan-x}
#tankView .tvStrip>:first-child{margin-left:auto}#tankView .tvStrip>:last-child{margin-right:auto}
@media (max-width:600px){#tankView .tvChip{width:52px;height:52px}#tankView .tvChip img{width:42px;height:42px}#tankView .tvName{font-size:17px}}
#tankView .tvChip{flex:none;width:62px;height:62px;border-radius:14px;border:3px solid #c9973e;background:rgba(255,248,234,.92);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
#tankView .tvChip img{width:50px;height:50px}
#tankView .tvChip.no{background:rgba(40,28,20,.6);border-color:rgba(201,151,62,.45);color:rgba(255,240,210,.6);font-weight:700;font-size:22px}
#tankView .tvChip.sel{border-color:#fff;box-shadow:0 0 0 3px #f2b84a}
`; document.head.appendChild(st); }
function openTankView(ent){
  if (tankView || tankZoom) return; const T=ent.T, R=museumRoom(); stopMove(); hideHint();
  const c=new THREE.Vector3(R.ox+T.x, 1.42, R.oz+T.z), n=new THREE.Vector3(T.front[0]-T.x, 0, T.front[1]-T.z).normalize();
  tankZoom={ t:0, from:camera.position.clone(), to:c.clone().addScaledVector(n, 2.9).setY(1.8), look:c, lookFrom:camTarget.clone() };
  Snd.pop(); document.body.classList.add('tankOpen'); player.obj.visible=false;
  setTimeout(()=>fade(()=>{ tankZoom=null; try { tankView=buildTankView(T.group, ent.have); tankView.group=T.group; tankView.ent=ent; tankView.sel=null; renderTankUI(); tvEl.classList.add('show'); }
    catch(e){ console.error(e); tankView=null; tvEl.classList.remove('show'); document.body.classList.remove('tankOpen'); player.obj.visible=true; updateCamera(1); } }), 420);
}
function closeTankView(){ if (!tankView) return; Snd.click(); fade(()=>{ tvEl.classList.remove('show'); document.body.classList.remove('tankOpen'); player.obj.visible=true; tankView.dispose(); tankView=null; updateCamera(1); updateActButton.nh=undefined; }); }
function renderTankUI(){ const V=tankView, g=V.group, have=new Set(V.ent.have);
  const ids = g.slots ? [...V.ent.have, ...Array(Math.max(0,g.slots-have.size)).fill('')] : g.ids;
  tvEl.querySelector('.tvName').textContent=g.name; tvEl.querySelector('.tvSub').textContent = g.slots ? `${have.size} of ${g.slots} spaces · shared ${g.kind==='fish'?'tank':'terrarium'}` : `${have.size} of ${g.ids.length} species${have.size===g.ids.length?' · complete!':''}`;
  const em=tvEl.querySelector('.tvEmpty'); em.style.display=have.size?'none':'block'; em.textContent=`Nothing in this ${g.kind==='fish'?'tank':'terrarium'} yet. Bring Professor Thistle a ${g.kind==='fish'?'fish':'bug'}${g.slots?'':' from this group'} and it will go right in.`;
  tvEl.querySelector('.tvStrip').innerHTML=ids.map(id=>have.has(id)?`<button class="tvChip" data-id="${id}" title="${ITEMS[id].name}"><img src="${thumb(id)}" alt=""></button>`:`<button class="tvChip no" data-id="${id}">?</button>`).join('');
  tvEl.querySelectorAll('.tvChip').forEach(b=>b.onclick=e=>{ e.stopPropagation(); Snd.click(); tankSelect(b.dataset.id||'', true); });
  tvEl.querySelector('.tvCard').classList.remove('show'); }
function tankSelect(id, follow){ const V=tankView; if (!V) return; const card=tvEl.querySelector('.tvCard');
  tvEl.querySelectorAll('.tvChip').forEach(b=>b.classList.toggle('sel', !!id && b.dataset.id===id));
  if (id===''){ card.innerHTML=`<div><b>An empty space</b><div class="sub">This tank is shared until the ${V.group.kind==='fish'?'Aquarium':'Insectarium'} gets its own wing. Each new ${V.group.kind==='fish'?'fish':'bug'} you donate fills a space.</div></div>`; card.classList.add('show'); V.view.follow=null; return; }
  if (!id){ card.classList.remove('show'); V.view.follow=null; V.sel=null; return; } V.sel=id; const it=ITEMS[id];
  if (!S.museum.items[id]){ const seen=!!S.rec[id]; card.innerHTML=`<div><b>${seen?it.name:'Not in the collection yet'}</b><div class="sub">${seen?'You have caught one before. Bring one to Professor Thistle to add it here.':`Somewhere out there: ${WHERE[it.where]||'on the island'}.`}</div></div>`; card.classList.add('show'); V.view.follow=null; return; }
  card.innerHTML=`<img src="${thumb(id)}" alt=""><div><b>${it.name}</b><div class="sub">${WHERE[it.where]||''} · ${monthsText(it.months)} · ${hoursText(it.hours)}<br>${exhibitInfo(id)}</div></div>`; card.classList.add('show');
  V.view.follow = follow ? V.specs.find(s=>s.id===id)||null : null; }
tvEl.querySelector('.tvX').onclick=e=>{ e.stopPropagation(); closeTankView(); };
{ let pd=null;
  tvEl.addEventListener('pointerdown', e=>{ if (!tankView || e.target.closest('button,.tvCard,.tvStrip')) return; pd={ id:e.pointerId, x:e.clientX, y:e.clientY, sx:e.clientX, pan:tankView.view.panT, moved:false }; tvEl.setPointerCapture(e.pointerId); });
  tvEl.addEventListener('pointermove', e=>{ if (!pd || e.pointerId!==pd.id || !tankView) return; const dx=e.clientX-pd.sx; if (Math.abs(dx)>6){ pd.moved=true; tankView.view.follow=null; }
    tankView.view.panT=pd.pan-dx/innerWidth*9; tankView.view.yawT=THREE.MathUtils.clamp(-(e.clientX-pd.x)/innerWidth*0.6, -0.3, 0.3); });
  const up=e=>{ if (!pd || e.pointerId!==pd.id) return; const was=pd; pd=null; if (!tankView) return; tankView.view.yawT=0;
    if (!was.moved){ const sp=tankView.pick(e.clientX/innerWidth*2-1, -(e.clientY/innerHeight)*2+1); if (sp){ Snd.pop(); tankSelect(sp.id, true); } else tankSelect(null); } };
  tvEl.addEventListener('pointerup', up); tvEl.addEventListener('pointercancel', up);
  tvEl.addEventListener('wheel', e=>{ if (!tankView) return; e.preventDefault(); tankView.view.zoom=THREE.MathUtils.clamp(tankView.view.zoom*(1+e.deltaY*0.001), 0.6, 1); }, { passive:false }); }
/* Anonymous donors: now and then someone leaves a pouch of clams at the museum overnight, and Professor Thistle
   passes it on to you for all your work on the collection. (Before v1.3 they left fish and bugs, which took away finds you'd rather donate yourself.) */
function anonDonation(r){
  if (VISIT || r()>0.3) return null;
  const n=300+Math.floor(r()*6)*100; S.clams = GUEST ? Math.max(S.clams, Math.min(GUEST_CAP.clams, S.clams+n)) : S.clams+n; S.museum.news={ clams:n }; return n;
}
// The museum grows overnight once the collection outgrows it
function museumGrowCheck(){ if (museumNeeds().length && !S.museum.grow){ S.museum.grow=1; save(); return true; } return false; }
if (!TRIP){ initTownBuildings(); applyTown(); }
/* =====================================================================
   v1.26: BOAT TRIPS. Skipper Wick waits at the dock with her boat. Pay a flat fee for a random little island (mostly
   ones like yours, now and then a themed one), or hand her a ticket for a named island. You stay as long as you like;
   your bag is the limit. Sail home and the island is gone. Odds are never better out there, but some islands have more spots.
   ===================================================================== */
const TRIP_FEE=2000, SKIPPER={ name:'Skipper Wick', voice:460, acc:['beanie'], accC:0x2a4a7a };
function buildTripBoat(){ const g=new THREE.Group(), wood=M(0x8a5e3a), hullC=M(0x3a6a8a), cloth=M(0xf4e6c8);
  mk(G.box(4.2,0.7,1.6), hullC, 0,0.0,0,g); mk(G.box(1.2,0.66,1.1), hullC, 2.3,0.02,0,g).rotation.y=Math.PI/4; mk(G.box(4.3,0.08,1.66), wood, 0,0.38,0,g);
  mk(G.box(1.3,0.8,1.2), M(0xf4f0e8), -1.1,0.8,0,g); mk(G.box(1.5,0.1,1.4), M(0xd8604d), -1.1,1.25,0,g);
  mk(G.cyl(0.06,0.07,3.4,6), wood, 0.6,2.0,0,g); const sail=mk(G.box(0.04,2.4,1.3), cloth, 0.6,2.2,0.7,g); sail.castShadow=true;
  mk(G.cyl(0.25,0.25,0.12,10), M(0xffffff), 1.2,0.5,0.82,g).rotation.x=Math.PI/2; return g; }
let skipper=null;
function buildSkipper(){
  if (VISIT || GUEST) return;
  const sx=DOCK.x0+5.2, sz=DOCK.z-0.75;
  const spec={ name:SKIPPER.name, voice:SKIPPER.voice, build:()=>buildAnimal({ look:CH.lookCode(CH.residentLook(TRIP && BOOT.own ? BOOT.own.seed : S.seed, 'skipper')), acc:SKIPPER.acc, accC:SKIPPER.accC }) };
  skipper=new Keeper(spec, sx, sz, ()=>TRIP ? talkSkipperTrip() : talkSkipperHome()); skipper.rest=Math.PI;
  const boat=buildTripBoat(); boat.position.set(DOCK.x0+8.5, -0.1, DOCK.z+DOCK.w+1.5); OUT.add(boat); }
buildSkipper();
const invCounts = () => { const c={}; for (const s of S.inv) c[s.id]=(c[s.id]||0)+s.n; return c; };
function talkSkipperHome(){
  const v=SKIPPER.voice, nm=SKIPPER.name, tickets=S.inv.filter(s=>ITEMS[s.id] && ITEMS[s.id].kind==='ticket');
  if (!BOOT.flush && BOOT.mode!=='account'){ dialog(nm, v, ['Trips need an account, I\'m afraid.']); return; }
  const go=(theme, ticket)=>{
    if (noEdit()) return;
    if (!ticket && S.clams<TRIP_FEE){ dialog(nm, v, [`It's ${fmt(TRIP_FEE)} clams for a trip. Come back when you've got it.`]); return; }
    const r=Math.random(); let th=theme;
    if (!th){ const x=Math.random(); th = x<0.85 ? 'plain' : x<0.97 ? ['orchard','bloom','frost'][Math.floor(Math.random()*3)] : ['moonlit','castaway'][Math.floor(Math.random()*2)]; }
    const fruits=NATIVE_FRUITS.filter(f=>f!==S.nativeFruit), T=TRIP_THEMES[th];
    const trip={ seed:(Math.random()*1e9)|0, theme:th, name:T.name, fruit:fruits[Math.floor(Math.random()*fruits.length)], start:invCounts(), seen:Object.keys(S.seen||{}), from:S.island };
    if (ticket) removeItem(ticket,1); else S.clams-=TRIP_FEE;
    updateHUD(); save();
    dialog(nm, v, [th==='plain' ? 'All aboard! Let\'s see where the wind takes us.' : `All aboard for ${T.name}! ${T.blurb}`], async ()=>{
      try { sessionStorage.setItem('dw-trip', JSON.stringify(trip)); sessionStorage.removeItem('dw-trip-world'); } catch(e){}
      document.documentElement.classList.add('magicret'); Snd.swoosh();
      try { if (BOOT.flush) await BOOT.flush(); } catch(e){}
      setTimeout(()=>location.reload(), 600); });
  };
  dialog(nm, v, ['Ahoy! Fancy a trip? I know a lot of little islands out there.', `Somewhere new costs ${fmt(TRIP_FEE)} clams. Got a ticket? I\'ll take you right where it says.`], null, [
    { label:`Somewhere new (${fmt(TRIP_FEE)})`, fn:()=>go(null, null) },
    ...[...new Set(tickets.map(t=>t.id))].map(id=>({ label:`Use ${ITEMS[id].name.replace('Ticket to ','ticket: ')}`, fn:()=>go(ITEMS[id].theme, id) })),
    { label:'Not today', alt:true, fn:()=>{} } ]);
}
function talkSkipperTrip(){
  const v=SKIPPER.voice, nm=SKIPPER.name;
  dialog(nm, v, ['Ready to head home? Once we leave, I can never find the same island twice.'], null, [
    { label:'Sail home', fn:()=>tripGoHome() },
    { label:'Not yet', alt:true, fn:()=>dialog(nm, v, ['Take your time. I\'ll be right here.']) } ]);
}
async function tripGoHome(){
  const t=BOOT.trip||{}, now=invCounts(), got={};
  for (const [id,n] of Object.entries(now)){ const d=n-((t.start||{})[id]||0); if (d>0) got[id]=d; }
  const fresh=Object.keys(S.seen||{}).filter(id=>!(t.seen||[]).includes(id));
  try { sessionStorage.setItem('dw-trip-recap', JSON.stringify({ name:t.name, got, fresh, invite:S.tripInvite||null })); sessionStorage.removeItem('dw-trip'); sessionStorage.removeItem('dw-trip-world'); } catch(e){}
  delete S.tripInvite; save();
  document.documentElement.classList.add('magicret'); Snd.swoosh();
  try { if (BOOT.flush) await BOOT.flush(); } catch(e){}
  setTimeout(()=>{ location.href=location.pathname+location.search; }, 600);
}
// Back home: a recap card, and a castaway's answer if you invited one
function tripRecap(){
  let R=null; try { R=JSON.parse(sessionStorage.getItem('dw-trip-recap')||'null'); sessionStorage.removeItem('dw-trip-recap'); } catch(e){}
  if (!R || TRIP || VISIT) return;
  const rows=Object.entries(R.got||{}).filter(([id])=>ITEMS[id]).map(([id,n])=>`<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${ITEMS[id].name}${(R.fresh||[]).includes(id)?' <span style="color:#d08a10;font-weight:600">New!</span>':''}</div><div class="sub">x${n}</div></div></div>`).join('');
  openPanel(`Back from ${R.name||'your trip'}`);
  pBody.innerHTML = rows ? `<div class="muted" style="margin-bottom:8px">What you brought home:</div>${rows}` : '<div class="notice">You came home empty-handed this time. The sea air was nice, though.</div>';
  if (R.invite){ const RS=RESIDENTS.find(x=>x.id===R.invite), T=S.town;
    if (RS && !T.res.includes(RS.id) && !T.next && (T.hall||0)>=1 && T.res.length<TOWN_MAX){ if (!RS.home){ const sp=findHomeSpot(RS.id); if (sp) claimHomeSpot(RS, sp); }
      if (RS.home){ T.next={ id:RS.id, day:dayKeyOf(dayNum(today())+1) }; save(); applyTown(); pBody.insertAdjacentHTML('beforeend', `<div class="notice" style="margin-top:10px"><b>${RS.name} is moving in tomorrow!</b><br><span class="muted">They followed you home from ${R.name}.</span></div>`); } }
    else if (RS) pBody.insertAdjacentHTML('beforeend', `<div class="notice" style="margin-top:10px">${RS.name} wanted to move here, but there's no room right now${(T.hall||0)<1?' (the town hall needs building first)':''}.</div>`); }
}
// Trip island extras: a castaway camping near the middle, a wreck on the beach
if (TRIP){
  if (TRIP_THEME==='castaway'){ const own=(BOOT.own && BOOT.own.town) || { res:[], left:{} }, pool=RESIDENTS.filter(R=>!(own.res||[]).includes(R.id));
    const R=pool[Math.floor(mulberry32(S.seed)()*pool.length)];
    if (R){ let p=null; const rr=mulberry32(S.seed+5); for (let k=0;k<300 && !p;k++){ const a=rr()*TAU, d=6+rr()*10, x=Math.cos(a)*d, z=Math.sin(a)*d; if (walkable(x,z) && !blocked(x,z,1.2) && rawHeight(x,z)>SAND_H) p=[x,z]; }
      if (p){ const tent=new THREE.Group(); const c=mk(G.cone(1.3,1.6,4), M(0xd8a050), 0,0.8,0,tent); c.rotation.y=Math.PI/4; mk(G.box(0.5,0.9,0.05), M(0x5a3e28), 0,0.45,0.78,tent);
        for (let i=0;i<5;i++) mk(G.dod(0.14), M(0x8a8a8a), 1.6+Math.cos(i/5*TAU)*0.35, 0.08, 0.6+Math.sin(i/5*TAU)*0.35, tent); tent.position.set(p[0]-1.6, groundY(p[0],p[1]), p[1]-1.2); OUT.add(tent);
        const spec={ name:R.name, voice:R.voice, build:()=>buildAnimal({ ...R, look:CH.lookCode(CH.residentLook(BOOT.own?BOOT.own.seed:S.seed, R.id, RESIDENTS.indexOf(R))) }) };
        new Keeper(spec, p[0], p[1], ()=>{ const c={ c:R.catch };
          if (S.tripInvite===R.id) return dialog(R.name, R.voice, [fill('I\'m packed and ready, {c}! I\'ll follow your boat home.',c)]);
          dialog(R.name, R.voice, [fill('Oh! A visitor! I\'ve been camping out here for ages, {c}.',c), 'I\'d love a real home somewhere. Is your island nice?'], null, [
            { label:'Come live on my island!', fn:()=>{ S.tripInvite=R.id; save(); dialog(R.name, R.voice, [fill('Really?! I\'ll follow your boat home, {c}!',c), 'If there\'s room, I\'ll move in right away.']); } },
            { label:'Just passing through', alt:true, fn:()=>dialog(R.name, R.voice, [fill('Okay! Safe travels, {c}.',c)]) } ]); }); } } }
  if (TRIP_THEME==='shipwreck'){ const rr=mulberry32(S.seed+9); for (let k=0;k<400;k++){ const a=rr()*TAU, d=islandR(a)*0.93, x=Math.cos(a)*d, z=Math.sin(a)*d; if (!isBeach(x,z) || Math.hypot(x-DOCK.x0,z-DOCK.z)<12) continue;
      const w=new THREE.Group(), wood=M(0x6a4a32), dark=M(0x4a3424); const hull=mk(G.box(5,1.4,2), wood, 0,0.4,0,w); hull.rotation.z=0.35; hull.rotation.y=0.2;
      for (let i=0;i<5;i++){ const rib=mk(G.box(0.18,1.6,0.18), dark, -1.8+i*0.9, 1.2, 0.95, w); rib.rotation.z=0.3+i*0.04; }
      const mast=mk(G.cyl(0.1,0.12,4,6), wood, 0.4,1.6,0,w); mast.rotation.z=0.9; mk(G.box(1.4,0.9,0.05), M(0xe8dcc0), 1.6,2.2,0.3,w).rotation.z=0.6;
      w.position.set(x, groundY(x,z)-0.3, z); w.rotation.y=-a; OUT.add(w); setRects('wreck', [[x-2.2,z-2.2,x+2.2,z+2.2]]); break; } }
}
function talkCurator(){
  const k=KEEPERS.thistle, v=k.voice;
  const menu=()=>dialog(k.name, v, [], null, [
    ...favorChoices(npcOf('thistle'), ()=>menu()),
    { label:'Donate', fn:()=>openDonate() },
    { label:'How\'s the collection?', fn:()=>{ const by=MUSEUM.kinds.map(kd=>{ const l=MUSEUM_IDS[kd]; const n=l.filter(id=>S.museum.items[id]).length; return `${n} of ${l.length} ${kd==='shell'?'beach finds':kd==='fossil'?'fossils':kd+(kd==='fish'?'':'s')}`; });
        const next=MUSEUM.gifts.find(([n])=>donatedCount()<n);
        dialog(k.name, v, [`We have ${donatedCount()} of ${MUSEUM_TOTAL} things in the collection. ${by.join(', ')}.`, ...(museumPlans().length?[`Tonight the builders put in ${museumPlans().join(', and ')}.`]:[]), next?`When we reach ${next[0]}, I have a little something for you.`:'You have filled every display I have gifts for. Remarkable!'], menu); } },
    { label:'Bye!', alt:true, fn:()=>{} } ]);
  if (!S.museum.met){ S.museum.met=true; save(); dialog(k.name, v, k.first, menu); return; }
  const h=Time.hour(); dialog(k.name, v, [(h>=23||h<6) ? keeperLine('thistle','night') : keeperLine('thistle','greet')], menu);
}
function eligibleDonations(){ const seen=new Set(), out=[]; S.inv.forEach((s,i)=>{ const it=ITEMS[s.id]; if (MUSEUM.kinds.includes(it.kind) && !S.museum.items[s.id] && !seen.has(s.id)){ seen.add(s.id); out.push(i); } }); return out; }
const museumFull = () => donatedCount() >= MUSEUM_TOTAL;   // v1.21: every species has a place; the building still grows as the collection does
function donate(slot){
  const s=S.inv[slot], id=s.id; if (museumFull()) return false; removeAt(slot,1); S.museum.items[id]=Date.now(); track('donate'); save(); Snd.jingle(); return true;
}
function openDonate(){ if (noEdit()) return;
  const render=()=>{ const el=eligibleDonations();
    let h='';
    if (!el.length) h+='<div class="notice">Nothing new to donate right now. Catch fish and bugs, dig up fossils, or comb the beach.</div>';
    for (const i of el){ const s=S.inv[i], it=ITEMS[s.id]; h+=`<div class="row"><img src="${thumb(s.id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">${kindName(it.kind)}${s.m?' · '+statText(s.id,s.m):''}</div></div><button class="btn" data-d="${i}">Donate</button></div>`; }
    if (el.length>1) h+=`<button class="btn" id="dAll" style="margin-top:6px">Donate all ${el.length}</button>`;
    h+=`<div class="muted" style="margin-top:10px">${donatedCount()} of ${MUSEUM_TOTAL} donated.${inStorage()?` ${inStorage()} waiting in the back room until the builders make space tonight.`:''}</div>`;
    pBody.innerHTML=h;
    const before=museumPlans().join('|');
    const after=()=>{ spawnExhibits(); checkMuseumGifts(); museumGrowCheck(); const plans=museumPlans();
      if (plans.length && plans.join('|')!==before) setTimeout(()=>dialog(KEEPERS.thistle.name, KEEPERS.thistle.voice, ['My word, we are out of room! I will keep it safe in the back for now.', `Tonight the builders will put in ${plans.join(', and ')}.`]), 300); render(); };
    const full=()=>{ toast('Every display spot is taken!'); Snd.fail(); };
    pBody.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.d, id=S.inv[i].id; if (!donate(i)){ full(); return; } itemToast(id,false,'Donated'); after(); });
    const da=pBody.querySelector('#dAll'); if(da) da.onclick=()=>{ let n=0; for(;;){ const el2=eligibleDonations(); if(!el2.length) break; if (!donate(el2[0])){ full(); break; } n++; } if (n) toast(`Donated ${n} things! Professor Thistle is delighted.`); after(); };
  };
  openPanel('Donate to the Museum'); render();
}
function checkMuseumGifts(){ const n=donatedCount();
  while (S.museum.gifts<MUSEUM.gifts.length && n>=MUSEUM.gifts[S.museum.gifts][0]){ const [need,id]=MUSEUM.gifts[S.museum.gifts]; S.museum.gifts++; save();
    const r=addItem(id); if(!r) dropNear(id, player.pos); setTimeout(()=>{ Snd.fanfare(); toast(`${need} displays! Professor Thistle gave you a ${ITEMS[id].name}.`, thumb(id), 'new'); }, 600); } }

/* ---------- Mossby: a tiny, grumpy keeper of trees ----------
   Cut down 10 trees in one day and he pops out of a stump to complain, then explains how to plant more. */
let mossby=null;
const MOSSBY_VOICE=900;
function onFelled(pos){ S.day.felled=(S.day.felled||0)+1; save(); const n=S.day.felled, seen=S.day.mossby||0;
  const mood = n>=24&&seen<3 ? 'furious' : n>=16&&seen<2 ? 'angry' : n>=10&&seen<1 ? 'warn' : null;
  if (mood){ S.day.mossby=seen+1; save(); setTimeout(()=>spawnMossby(pos, mood), 1300); } }
function onReplant(pos){ if (!S.day.mossby) return; S.day.replant=(S.day.replant||0)+1; save(); if (S.day.replant===3) setTimeout(()=>spawnMossby(pos,'happy'), 900); }
class Mossby extends Ent {
  constructor(x,z,mood){ super('mossby',x,z,0.3); this.mood=mood; this.reach=2.0; this.attach(buildMossby()); this.hitSphere(0.5,0.4); this.state='rise'; this.t=0; this.obj.scale.setScalar(0.01); }
  label(){ return 'Talk'; } act(){ this.talk(); }
  talk(){ if (this.state==='talk'||this.state==='leave') return; this.state='talk'; stopMove(); if(CatchMeter.bug) endCatchMeter();
    const L = {
      warn:['HEY. You. Yes, you, with the axe.','Ten trees! TEN! Since this morning! Do you know how long it takes a tree to grow? I do. I was there for every one of them.',fill('I\'m Mossby. I look after the trees on {isle}. Somebody has to.'),'Here\'s how you fix it. Buy saplings at Pemberton\'s or Sprig\'s, or bury a piece of fruit with your shovel. Plant them on grass and water them. A few days later: trees.'],
      angry:['AGAIN?! I can hear every single one, you know. Thunk. Thunk. THUNK.','Wood is nice. Shade is nicer. Bugs live in trees! Birds live in trees! I live NEAR trees!','Plant three trees today and I\'ll stop yelling. Probably.'],
      furious:['That\'s it. I\'m writing a strongly worded letter. To myself. About you.','Saplings. Fruit. Shovel. Water. Please. I\'m begging. A little.'],
      happy:['Hmph. Three new trees.','...That\'s actually very nice. Carry on.'],
    }[this.mood];
    const gift = this.mood==='warn' && !S.mossbyGift;
    if (gift) L.push('Take these acorns. Plant them. I\'ll be watching. I\'m always watching. Mostly from stumps.');
    if (this.mood==='happy') Snd.jingle(); else Snd.fail();
    dialog('Mossby', MOSSBY_VOICE, L, ()=>{ if (gift){ S.mossbyGift=true; for(let i=0;i<3;i++){ if(!addItem('mossby_acorn')) dropNear('mossby_acorn', player.pos); } save(); itemToast('mossby_acorn', false, 'Received 3'); } this.state='leave'; this.t=0; });
  }
  update(dt,t){ this.t+=dt; const u=this.obj.userData; const dx=player.pos.x-this.pos.x, dz=player.pos.z-this.pos.z, d=Math.hypot(dx,dz);
    this.obj.rotation.y=Math.atan2(dx,dz);
    if (this.state==='rise'){ const k=Math.min(1,this.t/0.45); this.obj.scale.setScalar(k*(1+Math.sin(k*Math.PI)*0.3)); if(k>=1){ this.state='walk'; this.t=0; } this.obj.scale.multiplyScalar(1.35); }
    else if (this.state==='walk'){ const hop=Math.abs(Math.sin(this.t*9)); if (d>1.7){ const sp=2.6*dt; this.pos.x+=dx/d*sp; this.pos.z+=dz/d*sp; }
      this.obj.scale.setScalar(1.35); this.pos.y=(World.inside?0:groundY(this.pos.x,this.pos.z)); this.obj.position.set(this.pos.x, this.pos.y+hop*0.25, this.pos.z);
      u.legs.forEach((l,i)=>l.position.y=0.06+(i?hop:1-hop)*0.05); if (d<=1.7 || this.t>14) this.talk(); }
    else if (this.state==='talk'){ u.body.position.y=Math.abs(Math.sin(t*(this.mood==='happy'?4:10)))*0.04; u.arms.forEach((a,i)=>a.rotation.z=(i?-1:1)*(0.3+Math.sin(t*(this.mood==='happy'?3:12))*0.4)); }
    else if (this.state==='leave'){ const k=Math.max(0,1-this.t/0.5); this.obj.scale.setScalar(k*1.35); if(k<=0){ puff(this.pos.clone().add(new THREE.Vector3(0,0.3,0)),0x6cc050,10,0.6,2,0.8,0.6); this.remove(); if(mossby===this) mossby=null; } }
  }
}
function spawnMossby(pos, mood){
  if (mossby && !mossby.removed) mossby.remove(); if (World.inside) return;
  const st = S.stumps.slice().sort((a,b)=>Math.hypot(a.x-player.pos.x,a.z-player.pos.z)-Math.hypot(b.x-player.pos.x,b.z-player.pos.z))[0];
  let x=pos.x, z=pos.z; if (st && Math.hypot(st.x-player.pos.x,st.z-player.pos.z)<12){ x=st.x; z=st.z+0.5; }
  if (Math.hypot(x-player.pos.x,z-player.pos.z)>10){ const a=player.face+Math.PI*0.75; x=player.pos.x+Math.sin(a)*4; z=player.pos.z+Math.cos(a)*4; }
  mossby=new Mossby(x,z,mood); puff(new THREE.Vector3(x,groundY(x,z)+0.3,z),0x6cc050,12,0.7,2.5,1,0.7); Snd.pop();
}

/* ---------- Build mode (Sims-style home builder) ----------
   Layout: draw rooms on a 20 x 20 grid (up to four floors), move and resize them, choose doorways, open walls and where the
   front door goes; place windows, ivy trellises and balconies; turn each room's roof and give it its own roof style.
   Outside: wall material and color, roof style and color, moss you paint on, trim, door, windows, shutters, flower boxes,
   porch, porch lights, trellis and balcony styles, foundation, chimney, height. Inside: floor, wallpaper and lighting per room.
   Everything previews live in 3D. Zoom the plan with a pinch, the mouse wheel or + and -; turn, tilt and zoom the 3D view too.
   New floor squares cost clams on every floor alike (cheap at first, pricier as the house grows). Restyling is free. */
const costUpTo = n => { let c=0; for(let k=1;k<=n;k++) c+=BUILD.cellCost(k); return c; };
const houseCost = (cells, paid) => Math.max(0, costUpTo(cells)-costUpTo(paid||0));
const hexs = c => '#'+new THREE.Color(c).getHexString();
const buildEl=$('#build'), bBody=$('#bBody');
const ROOM_KEYS=['floor','floorC','paper','paperC','ceil','sconce','accent','roof'];
const allRooms = plan => { const out=[]; for (let n=0;n<NFLOORS;n++) out.push(...floorOf(plan,n).rooms); return out; };

/* Where the house can grow: squares on dry, fairly level land, clear of water, paths, street lamps and other buildings.
   The original lot always counts. Trees, rocks and furniture in the way are checked when you press Done. */
let landCache=null;
function homeBlocked(){
  const key=[LOT.x,LOT.z,RECTS.filter(q=>q[4]!=='home').length,Object.keys((S.terra&&S.terra.cells)||{}).length,LAMPS.length].join('|'); if (landCache && landCache.key===key) return landCache.set;
  const { GW, GD, EC, LW, LD, SHIFT }=BUILD, set=new Set(), base=groundY(LOT.x,LOT.z), others=RECTS.filter(q=>q[4]!=='home');
  const places=Object.entries(PLACES).filter(([k])=>k!=='home'&&k!=='board').map(([k,p])=>[p[0], p[1]+(k==='museum'?1:0), k==='plaza'?6.5:BLOCK_R(k)+0.4]);
  for (const R of RESIDENTS) if (R.home) places.push([R.home[0],R.home[1],3.4]);
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){
    if (i>=SHIFT[0] && i<SHIFT[0]+LW && j>=SHIFT[1] && j<SHIFT[1]+LD) continue;
    const x0=LOT.x+hex_(i), z0=LOT.z+hez_(j); let bad=false;
    for (const [u,v] of [[0.5,0.5],[0.1,0.1],[0.9,0.1],[0.1,0.9],[0.9,0.9]]){ const x=x0+u*EC, z=z0+v*EC;
      if (Math.hypot(x,z)/islandR(Math.atan2(z,x))>0.9 || rawHeight(x,z)<SAND_H+0.1 || onDock(x,z) || onBridge(x,z)){ bad=true; break; }
      if (polyDist(x,z,RIVER)<3.2 || Math.hypot(x-POND.x,z-POND.z)<POND.r+0.8 || (FALLS.length && nearFall(x,z,-3))){ bad=true; break; }
      const dh=groundY(x,z)-base; if (dh>0.3 || dh<-0.75){ bad=true; break; }
      if (others.some(q=>x>q[0]-0.6&&x<q[2]+0.6&&z>q[1]-0.6&&z<q[3]+0.6) || places.some(([px,pz,pr])=>Math.hypot(x-px,z-pz)<pr)){ bad=true; break; }
      if (visPathDist(x,z)<1.05 || LAMPS.some(([lx,lz])=>Math.hypot(x-lx,z-lz)<0.7)){ bad=true; break; } }
    if (bad) set.add(i+','+j); }
  landCache={ key, set }; return set; }
function landProblem(plan){ const set=homeBlocked(); for (const r of plan.rooms) for (let j=r.z;j<r.z+r.d;j++) for (let i=r.x;i<r.x+r.w;i++) if (set.has(i+','+j)) return 'Part of that room is on land you can\'t build on (water, a path, a slope or another building).'; return ''; }
const planIssue = plan => planProblem(plan) || landProblem(plan);
// Free squares, shown on the ground while you build
let landMesh=null;
function showLand(on){ if (landMesh){ OUT.remove(landMesh); landMesh.geometry.dispose(); landMesh=null; } if (!on) return;
  const set=homeBlocked(), { GW, GD, EC }=BUILD, pos=[]; const y=(x,z)=>groundY(x,z)+0.07;
  for (let j=0;j<GD;j++) for (let i=0;i<GW;i++){ if (set.has(i+','+j)) continue; const x0=LOT.x+hex_(i)+0.07, x1=x0+EC-0.14, z0=LOT.z+hez_(j)+0.07, z1=z0+EC-0.14;
    pos.push(x0,y(x0,z0),z0, x0,y(x0,z1),z1, x1,y(x1,z1),z1, x0,y(x0,z0),z0, x1,y(x1,z1),z1, x1,y(x1,z0),z0); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  landMesh=new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color:0xfff4d0, transparent:true, opacity:0.22, depthWrite:false })); landMesh.renderOrder=1; OUT.add(landMesh); }
// Middle, height and reach of the house, for the camera
function houseFrame(d){ const plan=d.plan; let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9; for (const r of plan.rooms){ x0=Math.min(x0,hex_(r.x)); x1=Math.max(x1,hex_(r.x+r.w)); z0=Math.min(z0,hez_(r.z)); z1=Math.max(z1,hez_(r.z+r.d)); }
  if (x0>x1){ x0=-3; x1=3; z0=-3; z1=3; } return { x:LOT.x+(x0+x1)/2, z:LOT.z+(z0+z1)/2, h:2.7+topFloor(plan)*2.2, r:Math.max(x1-x0, z1-z0)/2 }; }
// Floors you may build: as many as your height style allows (or the one you're trying on), never fewer than you have
const ownedFloors = () => { let m=1; for (const [v] of BUILD.stories) if (styleOwned('stories', v)) m=Math.max(m, v); return m; };
function maxFloors(){ const B=buildMode, d=B.draft; let m=ownedFloors(); if (d.ext.stories>m) m=d.ext.stories; return Math.min(NFLOORS, Math.max(m, topFloor(d.plan)+1)); }

function openBuild(opts){ if (VISIT){ toast('You can only build on your own island for now.'); Snd.fail(); return; }
  if (GUEST){ toast('Guests can\'t build. Make an account to get a house.'); Snd.fail(); return; }
  if (!S.home.built){ toast('Your first house comes from a home loan.', null, '', 'Talk to Clementine at the town hall.'); Snd.fail(); return; }
  if (buildMode || dlgState) return; if (placing) endPlacing(); stopMove(); endCatchMeter(); if (Fishing.state!=='idle') reel();
  const draft=JSON.parse(JSON.stringify(S.home)); const first=!draft.built; draft.built=true; draft.ext=Object.assign(defaultExt(), draft.ext); fixDoor(draft.plan);
  buildMode={ draft, first, tab:'layout', floor:0, sel:draft.plan.rooms[0]?draft.plan.rooms[0].id:null, mode:'rooms', yaw:0.55, pitch:0.6, prevInside:World.inside, prevDist:camDist, view:null, camT:new THREE.Vector3(), pan:new THREE.Vector3(), dist:25, pv:null, brush:null, bsize:1, stroke:null, tall:false, tryMixer:false };
  $('#hud').classList.add('building'); buildEl.classList.add('show'); Snd.click();
  const tr=opts&&opts.tryItem;
  if (tr){ if (tr.list==='mixer'){ buildMode.tab='ext'; buildMode.tryMixer=true; }
    else { const key=HOME_KEY[tr.list]; if (INSIDE_LISTS.has(tr.list)){ for (const r of allRooms(draft.plan)) r[key]=tr.v; buildMode.tab='int'; } else { draft.ext[key]=tr.v; buildMode.tab='ext'; } } }
  previewBuild(); setBuildView(buildMode.tab==='int'?'in0':'out'); renderBuild();
}
function setBuildView(v){
  const B=buildMode; if (!B || B.view===v) return; B.view=v; B.pan.set(0,0,0);
  if (v==='out'){ World.inside=null; OUT.visible=true; for(const k in ROOMS) ROOMS[k].group.visible=false; const f=houseFrame(B.draft), ak=clamp(1.25*innerHeight/innerWidth,1,2.2); B.camT.set(f.x, groundY(LOT.x,LOT.z)+1.2+f.h*0.35, f.z); showLand(true); B.dist=clamp((f.r*2.3+f.h*1.4+10)*ak,22,140); B.pitch=0.6; }
  else { const n=+v.slice(2)||0, id = ROOMS[HOME_IDS[n]] && ROOMS[HOME_IDS[n]].shell ? HOME_IDS[n] : 'home'; showLand(false); World.inside=id; OUT.visible=false; for(const k in ROOMS) ROOMS[k].group.visible=(k===id);
    const R=ROOMS[id], ak=clamp(1.25*innerHeight/innerWidth,1,2.2); B.camT.set(R.ox,0.4,R.oz+0.8); R.cutState=null; B.yaw=0; B.pitch=1.05; B.dist=clamp(Math.max(R.w,R.d)*1.45*ak, 18, 140); }
  camTarget.copy(B.camT); updateSky(); renderViewBar();
}
function previewBuild(which){ const B=buildMode, d=B.draft;
  if (which!=='room' && typeof which!=='number') buildPlayerHouse(d);
  if (which!=='house'){ if (typeof which==='number'){ rebuildFloor(d, which); placeStairs(d); } else rebuildHomeRoom(d); for (const id of HOME_IDS) if (ROOMS[id]) ROOMS[id].cutState=null;
    if (B.view && B.view!=='out'){ const n=+B.view.slice(2)||0; if (!(ROOMS[HOME_IDS[n]] && ROOMS[HOME_IDS[n]].shell)){ B.view=null; setBuildView('in0'); } else { const id=World.inside; for(const k in ROOMS) ROOMS[k].group.visible=(k===id); } } } }
// Rebuild at most once a frame while a slider or brush is moving
let previewQ=null; function previewSoon(which){ if (previewQ!==null){ previewQ = previewQ===which ? which : undefined; return; } previewQ=which; requestAnimationFrame(()=>{ const w=previewQ; previewQ=null; if (buildMode) previewBuild(w); }); }
/* Put a new or changed house in place (the builder's preview, or the base model). Returns how much furniture went
   back to the bag, or -1 if something is standing where the walls go. RECTS must already show the new house. */
function applyHome(d){
  const hr=RECTS.filter(q=>q[4]==='home'); const inHouse=(x,z,r=0.15)=>hr.some(q=>x>q[0]-r&&x<q[2]+r&&z>q[1]-r&&z<q[3]+r);
  const inWay=[];
  for (const e of ents.slice()){ if (e.removed || e.pos.x>500 || e===houseEnt || !inHouse(e.pos.x,e.pos.z, e.r*0.6)) continue;
    if (e instanceof Furniture) inWay.push(ITEMS[e.rec.id].name); else if (e instanceof Plant) inWay.push(PLANTS[e.rec.sp].name); else if (e instanceof Tree) inWay.push('a tree'); else if (e instanceof Stump) inWay.push('a stump'); else if (e instanceof Rock) inWay.push('a rock'); }
  if (inWay.length){ toast(`Move ${inWay.slice(0,3).join(', ')}${inWay.length>3?' and more':''} first.`, null, '', 'They\'re standing where the new walls go.'); Snd.fail(); return -1; }
  for (const e of ents.slice()){ if (e.removed || e.pos.x>500 || !inHouse(e.pos.x,e.pos.z)) continue;
    if (e instanceof Weed){ S.day.weeds[e.i].pulled=true; e.remove(); } else if (e instanceof DigSpot){ S.day.digs[e.i].dug=true; e.remove(); }
    else if (e instanceof GroundItem){ const ex=houseEnt.doorPt; e.rec.x=ex[0]+(Math.random()-0.5)*2; e.rec.z=ex[1]+1.2+Math.random(); e.remove(); new GroundItem(e.rec); }
    else if (e instanceof Bug) e.despawn(); }
  for (const res of residents){ if (res.loc==='out' && inHouse(res.pos.x,res.pos.z,0.4)){ res.pos.set(houseEnt.doorPt[0]+1.5,0,houseEnt.doorPt[1]+1.5); res.pos.y=groundY(res.pos.x,res.pos.z); res.obj.position.copy(res.pos); } }
  const cells=planCells(d.plan); S.home=d; S.home.paid=Math.max(S.home.paid||0, cells); save(); updateHUD();
  buildPlayerHouse(); rebuildHomeRoom();
  // furniture inside that no longer fits goes back to your bag
  let back=0; const R=ROOMS.home;
  for (const rec of S.placed.slice()){ const inHome=HOME_SLOT.some(k=>{ const [ox,oz]=roomOrigin(k); return rec.x>ox-BUILD.OX*BUILD.IC-2 && rec.x<ox+(BUILD.GW-BUILD.OX)*BUILD.IC+2 && rec.z>oz-BUILD.OZ*BUILD.IC-2 && rec.z<oz+(BUILD.GD-BUILD.OZ)*BUILD.IC+2; }); if (!inHome || walkable(rec.x,rec.z)) continue; const e=ents.find(x=>x instanceof Furniture && x.rec===rec);
    if (addItem(rec.id)){ S.placed.splice(S.placed.indexOf(rec),1); if(e) e.remove(); back++; } else { rec.x=R.entry[0]; rec.z=R.entry[1]-1; if(e){ e.pos.set(rec.x,0,rec.z); e.obj.position.copy(e.pos); } } }
  save(); Snd.fanfare(); sparkle(new THREE.Vector3(LOT.x, groundY(LOT.x,LOT.z)+3, LOT.z));
  return back;
}
/* ---------- Home loans (Clementine at the town hall) ----------
   The first house is the base model: one 3 x 3 room with nothing extra, built the moment you take the loan.
   Later, new floor squares go on a loan too, on any floor. One loan at a time: pay it off before borrowing again. No interest. */
const loanOpen = () => !!(S.loan && S.loan.owed>0);
// v1.26: one loan covers at most 9 new floor squares, so a big house takes several loans (prices still rise per square)
const LOAN_MAX_SQ=9;
const newSquares = plan => Math.max(0, planCells(plan)-(S.home.paid||0));
function buildBaseHouse(){
  if (S.home.built || GUEST || VISIT) return;
  const d={ built:true, g2:1, paid:0, plan:{ rooms:[defaultRoom('r1',2+BUILD.SHIFT[0],2+BUILD.SHIFT[1],3,3)], links:{}, door:{i:3+BUILD.SHIFT[0],j:4+BUILD.SHIFT[1]} }, ext:defaultExt() }; fixDoor(d.plan);
  buildPlayerHouse(d);
  if (applyHome(d)<0){ buildPlayerHouse(S.home); rebuildHomeRoom(S.home); return; }
  const cost=houseCost(planCells(d.plan),0); S.loan={ owed:cost, total:cost }; save(); updateHUD();
  if (!World.inside && inRects(player.pos.x,player.pos.z,0.4)){ const e=ROOMS.home.exit; player.pos.set(e[0],0,e[1]+0.8); player.pos.y=groundY(player.pos.x,player.pos.z); player.obj.position.copy(player.pos); }
  toast('Your house is built! Welcome home.', null, 'new', `You owe Clementine ${fmt(cost)} clams. Pay it back at the town hall, any amount at a time.`);
}
function talkLoan(back){
  const k=KEEPERS.clementine, v=k.voice;
  if (GUEST) return dialog(k.name, v, ['Home loans are for islanders with an account. Make one and I can set you up with a house!'], back);
  if (!S.home.built) return dialog(k.name, v, ['Ready to trade that tent for a real house? I can loan you a base-model house: one room, 9 floor squares, plain and sturdy.',
      `It's ${fmt(houseCost(9,0))} clams. Pay it back whenever you like, a little at a time. No interest!`, 'Paint, porches, shutters and bigger rooms all cost extra later on.'], null,
    [{ label:'Build it!', fn:()=>buildBaseHouse() }, { label:'Not yet', alt:true, fn:back }]);
  if (loanOpen()) return openLoanPanel();
  dialog(k.name, v, ['Your house is all paid off! Want more room? Draw new rooms in the builder, on any floor, and I\'ll put the new floor on a loan. One loan at a time, mind you, and up to 9 new squares per loan.'], back);
}
function openLoanPanel(){
  const render=()=>{ const L=S.loan; let h;
    if (!loanOpen()) h='<div class="notice"><b>All paid off!</b><br>Your house is yours, free and clear. Draw new rooms in the builder to take out a new loan for more floor.</div>';
    else h=`<div class="notice"><b>Home loan</b><br><b>${fmt(L.owed)}</b> of ${fmt(L.total)} clams left to pay<div class="bar" style="margin:6px 0"><div style="width:${Math.max(0,(1-L.owed/L.total)*100)}%"></div></div><span class="muted">No interest and no due date. Until it's paid off you can't borrow for more floor.</span></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${[1000,10000].filter(n=>n<L.owed).map(n=>`<button class="btn alt" data-pay="${n}" ${S.clams<n?'disabled':''}>Pay ${fmt(n)}</button>`).join('')}<button class="btn" data-pay="${L.owed}" ${S.clams<1?'disabled':''}>${S.clams>=L.owed?`Pay it all off (${fmt(L.owed)})`:`Pay ${fmt(S.clams)}`}</button></div>`;
    pBody.innerHTML=h;
    pBody.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{ if (noEdit() || !loanOpen()) return; const n=Math.min(+b.dataset.pay, S.loan.owed, S.clams); if (n<=0) return;
      S.clams-=n; S.loan.owed-=n; Snd.coin(); if (S.loan.owed<=0){ S.loan=null; track('loanpaid'); Snd.fanfare(); toast('Home loan paid off!', null, 'new', 'Want more room? Draw new rooms in the builder.'); } updateHUD(); save(); render(); });
  };
  openPanel('Home Loan'); render();
}
/* Layout changes cost a small remodel fee each: a room added, removed, moved or resized (on any floor), a doorway changed,
   a window or balcony added or taken out, the front door or any stairs moved. Compared against the saved house, so undoing a change is free.
   Trellises, roof direction and roof style per room, moss and lighting are styling, so they're free. */
const REMODEL_FEE=50;
function remodelEdits(a, b){ let n=0;
  for (let f=0;f<NFLOORS;f++){ const A=floorOf(a,f), Bf=floorOf(b,f), ra=A.rooms||[], rb=Bf.rooms||[], la=A.links||{}, lb=Bf.links||{};
    for (const id of new Set([...ra.map(r=>r.id), ...rb.map(r=>r.id)])){ const x=ra.find(r=>r.id===id), y=rb.find(r=>r.id===id); if (!x || !y || x.x!==y.x || x.z!==y.z || x.w!==y.w || x.d!==y.d) n++; }
    const has=new Set(rb.map(r=>r.id)); for (const k of new Set([...Object.keys(la), ...Object.keys(lb)])){ const [p,q]=k.split('|'); if (has.has(p) && has.has(q) && (la[k]||'door')!==(lb[k]||'door')) n++; } }
  for (const k of new Set([...Object.keys(a.win||{}), ...Object.keys(b.win||{})])){ const [row,rest]=k.split(':'), [i,j,sd]=rest.split(',').map(Number); if (winAt(a,i,j,sd,+row)!==winAt(b,i,j,sd,+row)) n++; }
  for (const k of new Set([...Object.keys(a.balc||{}), ...Object.keys(b.balc||{})])) if (!!(a.balc&&a.balc[k]) !== !!(b.balc&&b.balc[k])) n++;
  if (a.door && b.door && (a.door.i!==b.door.i || a.door.j!==b.door.j)) n++;
  for (const k of STAIR_KEYS.slice(1)) if (a[k] && b[k] && (a[k].i!==b[k].i || a[k].j!==b[k].j)) n++;
  return n; }
const remodelFee = (a, b) => remodelEdits(a, b)*REMODEL_FEE;
function closeBuild(commit){
  const B=buildMode; if (!B) return;
  if (commit){
    const d=B.draft, prob=planIssue(d.plan); if (prob){ toast(prob); Snd.fail(); return; }
    const un=draftUnowned(d); if (un.length){ toast(`You're only trying on ${un.map(u=>u.list==='mixer'?'a mixed color':homeName(u.list,u.v)).join(', ')}.`, null, '', 'Buy it, or put it back, to finish.'); Snd.fail(); renderBuild(); bBody.scrollTop=0; return; }
    const cells=planCells(d.plan), cost=houseCost(cells, S.home.paid), fee=remodelFee(S.home.plan, d.plan);
    if (cost>0 && loanOpen()){ toast(`Pay off your home loan before adding floor. You still owe ${fmt(S.loan.owed)} clams.`, null, '', 'Clementine at the town hall takes payments.'); Snd.fail(); return; }
    if (newSquares(d.plan)>LOAN_MAX_SQ){ toast(`One loan covers up to ${LOAN_MAX_SQ} new floor squares. You drew ${newSquares(d.plan)}.`, null, '', 'Build part of it now and the rest on your next loan.'); Snd.fail(); return; }
    if (fee>S.clams){ toast(`The remodel fee is ${fmt(fee)} clams. You have ${fmt(S.clams)}.`); Snd.fail(); return; }
    const back=applyHome(d); if (back<0) return;
    S.clams-=fee; if (cost>0) S.loan={ owed:cost, total:cost }; save(); updateHUD();
    toast('Remodel done!', null, 'new', [fee?`Remodel fee: ${fmt(fee)} clams.`:'', cost>0?`${fmt(cost)} clams of new floor went on a home loan. Pay Clementine back at the town hall.`:'', back?`${back} piece${back>1?'s':''} of furniture went back to your bag.`:''].filter(Boolean).join(' '));
  } else { buildPlayerHouse(S.home); rebuildHomeRoom(S.home); Snd.click(); }
  buildMode=null; camera.clearViewOffset(); camDist=B.prevDist; buildEl.classList.remove('show','tall'); $('#hud').classList.remove('building'); showLand(false); renderViewBar();
  World.inside=B.prevInside; if (homeFloorOf(World.inside)>0 && !(ROOMS[World.inside] && ROOMS[World.inside].shell)) World.inside='home';
  OUT.visible=!World.inside; for(const k in ROOMS) ROOMS[k].group.visible=(k===World.inside);
  if (homeFloorOf(World.inside)>=0){ const R=ROOMS[World.inside]; if (commit || !walkable(player.pos.x,player.pos.z)){ const p=R.entry || R.stairsDown || [R.ox,R.oz]; player.pos.set(p[0],0,p[1]+(R.entry?0:1.6)); if (!walkable(player.pos.x,player.pos.z) && R.stairsDown) player.pos.set(R.stairsDown[0],0,R.stairsDown[1]-1.6); } }
  else if (!World.inside && inRects(player.pos.x,player.pos.z,0.4)){ const e=ROOMS.home.exit; player.pos.set(e[0],0,e[1]+0.8); player.pos.y=groundY(player.pos.x,player.pos.z); }
  player.obj.position.copy(player.pos); camTarget.copy(player.pos); for (const id of HOME_IDS) if (ROOMS[id]) ROOMS[id].cutState=null; updateSky(); updateCamera(1);
}
$('#bCancel').onclick=()=>closeBuild(false); $('#bDone').onclick=()=>closeBuild(true);
$('#bBuild').onclick=()=>openBuild();

function renderBuild(keepScroll){
  const B=buildMode; if(!B) return; const plan=B.draft.plan; const st=bBody.scrollTop;
  $('#bTabs').querySelectorAll('[data-bt]').forEach(b=>{ b.classList.toggle('on', b.dataset.bt===B.tab); b.onclick=()=>{ if(B.tab===b.dataset.bt) return; B.tab=b.dataset.bt; B.brush=null; Snd.click(); if (B.tab==='int' && !floorHas(plan,B.floor)) B.floor=0; setBuildView(B.tab==='int'?'in'+B.floor:'out'); renderBuild(); }; });
  const cells=planCells(plan), cost=houseCost(cells,S.home.paid), fee=remodelFee(S.home.plan, plan), lo=loanOpen(), nr=allRooms(plan).length, fl=topFloor(plan)+1;
  $('#bCost').innerHTML=`${nr} room${nr>1?'s':''}${fl>1?` on ${fl} floors`:''} · ${cells} floor squares · ${cost>0 ? (lo ? `<b style="color:#c0503a">new floor needs a loan, but you still owe ${fmt(S.loan.owed)}</b>` : newSquares(plan)>LOAN_MAX_SQ ? `<b style="color:#c0503a">${newSquares(plan)} new squares: one loan covers up to ${LOAN_MAX_SQ}</b>` : `new floor (${newSquares(plan)} of ${LOAN_MAX_SQ} squares): <b>${fmt(cost)}</b> clams on a home loan`) : 'no new floor'} · ${fee ? `remodel fee: <b>${fmt(fee)}</b> (you have ${fmt(S.clams)})` : 'no remodel fee'}`;
  const prob=planIssue(plan), up=B.floor>0;
  $('#bMsg').innerHTML = prob ? `<b style="color:#c0503a">${prob}</b>` : B.tab==='layout' ? ({ rooms: up ? `Draw ${FLOOR_NAME[B.floor]} rooms over the rooms below. Tap a room to move or resize it.` : 'Drag an empty square to add a room. Tap a room, then drag it to move or drag an edge to resize. Shaded squares can\'t be built on.',
      doors: up ? 'Tap a wall between rooms on this floor: doorway, open, or solid.' : 'Tap a wall between rooms: doorway, open, or solid. Tap a front-facing wall to move the front door.',
      windows: 'Tap an outside wall to add or remove a window.', trellis: 'Tap an outside wall to add or remove a trellis. Two go by the front door until you place your own.',
      balcony: 'Tap an outside wall on this floor to add or remove a balcony. One goes over the front door until you place your own.',
      roof: 'Tap a room to pick how its roof points and what kind it is.', stairs:`Tap a square that has a room on this floor and the one below to put the stairs up to the ${FLOOR_NAME[B.floor]} there.` })[B.mode]
    : B.tab==='ext' ? (B.brush ? `Drag on the roof to ${B.brush==='moss'?'paint moss on. Go over a spot again for thicker moss':'scrub moss off'}.` : 'Drag the picture to look around. Use the buttons on the right to zoom and tilt.') : 'Pick a room on the plan, then its floor, wallpaper and lighting.';
  const trying=draftUnowned(B.draft).length>0; if (trying && !prob) $('#bMsg').innerHTML='<b style="color:#3a7ab0">Trying on a new style. Buy it or put it back to finish.</b>';
  $('#bDone').disabled = !!prob || (cost>0 && lo) || newSquares(plan)>LOAN_MAX_SQ || fee>S.clams || trying; $('#bDone').textContent = B.first ? 'Build it' : 'Done';
  buildEl.classList.toggle('tall', !!B.tall && B.tab!=='ext');
  if (B.tab==='layout') renderLayoutTab(); else if (B.tab==='ext') renderExtTab(); else renderIntTab();
  renderTryBar(); renderViewBar();
  if (keepScroll) bBody.scrollTop=st;
}

// ---- the blueprint: zoom with a pinch, the mouse wheel or the + and - buttons; pan with two fingers, or drag in the tools that tap ----
const FP = () => floorOf(buildMode.draft.plan, buildMode.floor, true);
const PV_MIN=8, PV_MAX=76;
function planCanvas(maxH){ const w=Math.round(Math.min(bBody.clientWidth-4, 760)), h=Math.round(clamp(maxH || (bBody.clientHeight-64), 200, 900));
  return `<div class="bpwrap"><canvas id="bp" width="${Math.round(w*devicePixelRatio)}" height="${Math.round(h*devicePixelRatio)}" style="width:${w}px;height:${h}px"></canvas>
    <div class="bpz"><button data-z="in" title="Zoom in">+</button><button data-z="out" title="Zoom out">&minus;</button><button data-z="fit" title="Fit the house">Fit</button>${maxH?'':`<button data-z="tall" title="${buildMode.tall?'Smaller panel':'Bigger panel'}">${buildMode.tall?'Less':'More'}</button>`}</div></div>`; }
// Size the plan to the room left in the panel below the tool buttons (or maxH)
function sizePlan(cv, maxH){ const bb=bBody.getBoundingClientRect(), top=cv.getBoundingClientRect().top; let h = maxH || Math.floor(bb.bottom - top - 8);
  h=Math.round(clamp(h, 200, 900)); const w=Math.round(Math.min(bBody.clientWidth-4, 760)); cv.style.width=w+'px'; cv.style.height=h+'px'; cv.width=Math.round(w*devicePixelRatio); cv.height=Math.round(h*devicePixelRatio); }
function planFit(cv){ const B=buildMode, plan=B.draft.plan, { GW, GD }=BUILD; let x0=GW,z0=GD,x1=0,z1=0;
  for (const r of allRooms(plan)){ x0=Math.min(x0,r.x); z0=Math.min(z0,r.z); x1=Math.max(x1,r.x+r.w); z1=Math.max(z1,r.z+r.d); }
  if (x0>x1){ x0=BUILD.SHIFT[0]; z0=BUILD.SHIFT[1]; x1=x0+BUILD.LW; z1=z0+BUILD.LD; }
  x0=Math.max(0,x0-2); z0=Math.max(0,z0-2); x1=Math.min(GW,x1+2); z1=Math.min(GD,z1+1);
  const W=cv.clientWidth-16, H=cv.clientHeight-34; B.pv={ cs:clamp(Math.min(W/(x1-x0), H/(z1-z0)), PV_MIN, PV_MAX), ox:(x0+x1)/2, oz:(z0+z1)/2 }; }
function bpGeom(cv){ const pv=buildMode.pv, W=cv.clientWidth, H=cv.clientHeight-20; return { cs:pv.cs, X:i=>W/2+(i-pv.ox)*pv.cs, Y:j=>H/2+(j-pv.oz)*pv.cs, W, H }; }
function bpPoint(cv, e){ const r=cv.getBoundingClientRect(), pv=buildMode.pv, W=cv.clientWidth, H=cv.clientHeight-20; return [(e.clientX-r.left-W/2)/pv.cs+pv.ox, (e.clientY-r.top-H/2)/pv.cs+pv.oz]; }
function bpZoom(cv, k, sx, sy){ const pv=buildMode.pv, W=cv.clientWidth, H=cv.clientHeight-20; if (sx===undefined){ sx=W/2; sy=H/2; }
  const gx=(sx-W/2)/pv.cs+pv.ox, gz=(sy-H/2)/pv.cs+pv.oz; pv.cs=clamp(pv.cs*k, PV_MIN, PV_MAX); pv.ox=gx-(sx-W/2)/pv.cs; pv.oz=gz-(sy-H/2)/pv.cs; bpClamp(); }
function bpClamp(){ const pv=buildMode.pv; pv.ox=clamp(pv.ox,-2,BUILD.GW+2); pv.oz=clamp(pv.oz,-2,BUILD.GD+2); }
// Roofs over the open parts of each room on a floor, as rectangles with their ridge direction
function roofParts(plan, n){ const above = n+1<NFLOORS && floorHas(plan,n+1) ? planGrid(floorOf(plan,n+1)) : null, out=[];
  for (const r of floorOf(plan,n).rooms){ const open=new Set(); for (let j=r.z;j<r.z+r.d;j++) for (let i=r.x;i<r.x+r.w;i++) if (!(above && above[j][i]>=0)) open.add(i+','+j);
    const parts = open.size===r.w*r.d ? [{ x:r.x, z:r.z, w:r.w, d:r.d }] : cellRects(open); for (const q of parts) out.push({ r, q, dir:ridgeOf(r, q.w*BUILD.EC, q.d*BUILD.EC) }); }
  return out; }
const HATCH = (()=>{ const c=document.createElement('canvas'); c.width=c.height=12; const x=c.getContext('2d'); x.fillStyle='#c9c2b2'; x.fillRect(0,0,12,12); x.strokeStyle='rgba(120,100,80,.35)'; x.lineWidth=2; x.beginPath(); x.moveTo(-2,14); x.lineTo(14,-2); x.stroke(); return c; })();
function drawPlan(cv, drawRect){
  const B=buildMode, full=B.draft.plan, n=B.floor, plan=FP(), up=n>0, row=n, { GW, GD }=BUILD; const x=cv.getContext('2d'); const dpr=devicePixelRatio; x.setTransform(dpr,0,0,dpr,0,0);
  const { cs, X, Y, W, H }=bpGeom(cv); x.clearRect(0,0,cv.clientWidth,cv.clientHeight); x.fillStyle='#b9cfa4'; x.fillRect(0,0,W,H);
  const i0=Math.max(0,Math.floor((0-X(0))/cs)), i1=Math.min(GW,Math.ceil((W-X(0))/cs)), j0=Math.max(0,Math.floor((0-Y(0))/cs)), j1=Math.min(GD,Math.ceil((H-Y(0))/cs));
  x.save(); x.beginPath(); x.rect(0,0,W,H); x.clip();
  x.fillStyle='#cfe3b8'; x.fillRect(X(0),Y(0),cs*GW,cs*GD);
  const blk=homeBlocked(), pat=x.createPattern(HATCH,'repeat'); x.fillStyle=pat; for (let j=j0;j<j1;j++) for (let i=i0;i<i1;i++) if (blk.has(i+','+j)) x.fillRect(X(i),Y(j),cs+0.5,cs+0.5);
  if (up){ x.fillStyle='rgba(91,67,50,.18)'; for (const r of floorOf(full,n-1).rooms) x.fillRect(X(r.x),Y(r.z),r.w*cs,r.d*cs); }   // the floor below
  x.strokeStyle='rgba(90,120,70,.3)'; x.lineWidth=1; for(let i=i0;i<=i1;i++){ x.beginPath(); x.moveTo(X(i),Y(j0)); x.lineTo(X(i),Y(j1)); x.stroke(); } for(let j=j0;j<=j1;j++){ x.beginPath(); x.moveTo(X(i0),Y(j)); x.lineTo(X(i1),Y(j)); x.stroke(); }
  x.strokeStyle='rgba(91,67,50,.55)'; x.lineWidth=2; x.setLineDash([6,4]); x.strokeRect(X(0),Y(0),cs*GW,cs*GD); x.setLineDash([]);
  const occ=planGrid(plan), LW=clamp(cs/9,1.6,5);
  plan.rooms.forEach(r=>{ x.fillStyle=hexs(new THREE.Color(r.floorC).lerp(new THREE.Color(0xffffff),0.35).getHex()); x.fillRect(X(r.x),Y(r.z),r.w*cs,r.d*cs); });
  const line=(x1,y1,x2,y2,w,c,dash)=>{ x.beginPath(); x.setLineDash(dash||[]); x.strokeStyle=c; x.lineWidth=w; x.moveTo(x1,y1); x.lineTo(x2,y2); x.stroke(); x.setLineDash([]); };
  const mids={}, pairs={}; for(let j=0;j<GD;j++) for(let i=0;i<GW;i++){ const k=occ[j][i]; if(k<0) continue; for(const [di,dj] of [[1,0],[0,1]]){ const nb=occ[j+dj]?.[i+di]; if(nb===undefined||nb<0||nb===k) continue; const key=linkKey(plan.rooms[k].id,plan.rooms[nb].id)+(dj?'h':'v'); (pairs[key]=pairs[key]||[]).push([i,j,di,dj]); } }
  for (const key in pairs){ const L=pairs[key]; L.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const m=L[Math.floor((L.length-1)/2)]; mids[m.join(',')]=true; }
  const E=B.draft.ext, balcs=new Set(balconyList(full, E, Array.from({length:topFloor(full)+1},(_,q)=>planGrid(floorOf(full,q))), topFloor(full)).map(q=>winKey(q[1],q[2],q[3],q[0])));
  for(let j=Math.max(0,j0-1);j<Math.min(GD,j1+1);j++) for(let i=Math.max(0,i0-1);i<Math.min(GW,i1+1);i++){ const k=occ[j][i]; if(k<0) continue; const X0=X(i), Y0=Y(j);
    [[0,1,X0,Y0+cs,X0+cs,Y0+cs,0],[0,-1,X0,Y0,X0+cs,Y0,1],[1,0,X0+cs,Y0,X0+cs,Y0+cs,2],[-1,0,X0,Y0,X0,Y0+cs,3]].forEach(([di,dj,x1,y1,x2,y2,wk])=>{ const nb=occ[j+dj]?.[i+di];
      if (nb===undefined||nb<0){ const isDoor = !up && dj===1 && full.door && full.door.i===i && full.door.j===j; line(x1,y1,x2,y2,LW+1,'#5b4332');
        const mx=(x1+x2)/2, my=(y1+y2)/2, hz=x1===x2, along=(a,c)=>line(mx-(hz?0:a),my-(hz?a:0),mx+(hz?0:a),my+(hz?a:0),c[0],c[1]);
        if(isDoor){ line(x1+cs*0.25,y1,x2-cs*0.25,y2,LW+3,'#e0745a'); if (cs>22){ x.fillStyle='#5b4332'; x.font='600 10px Fredoka, sans-serif'; x.textAlign='center'; x.fillText('door',mx,y1+13); } }
        else if (balcs.has(winKey(i,j,wk,row))){ along(cs*0.36,[LW+4,'#b07a4a']); const ox=hz?(di>0?1:-1):0, oz=hz?0:(dj>0?1:-1); x.strokeStyle='#b07a4a'; x.lineWidth=2; x.strokeRect(mx-cs*0.36*(hz?0.3:1)+ox*cs*0.06, my-cs*0.36*(hz?1:0.3)+oz*cs*0.06, cs*0.72*(hz?0.3:1), cs*0.72*(hz?1:0.3)); }
        else if (winAt(full,i,j,wk,row)) along(cs*0.22,[B.mode==='windows'?LW+3:LW+1,'#7cc8f0']);
        if (!up && trelAt(full,i,j,wk)){ const ox=hz?(di>0?4:-4):0, oy=hz?0:(dj>0?4:-4); x.strokeStyle='#4f9a3a'; x.lineWidth=LW+2; x.beginPath(); x.moveTo(mx-(hz?0:cs*0.3)+ox,my-(hz?cs*0.3:0)+oy); x.lineTo(mx+(hz?0:cs*0.3)+ox,my+(hz?cs*0.3:0)+oy); x.stroke(); }
        return; }
      if (nb===k || di<0 || dj<0) return; const t=linkOf(plan,plan.rooms[k].id,plan.rooms[nb].id);
      if (t==='wall') line(x1,y1,x2,y2,LW,'#5b4332'); else if (t==='open') line(x1,y1,x2,y2,Math.max(1.5,LW/2),'rgba(91,67,50,.45)',[4,4]);
      else { line(x1,y1,x2,y2,LW,'#5b4332'); if (mids[[i,j,di,dj].join(',')]){ const mx=(x1+x2)/2, my=(y1+y2)/2, hl=cs*0.27; line(mx-(dj?hl:0),my-(di?hl:0),mx+(dj?hl:0),my+(di?hl:0),LW+2,'#fff8ea'); } } }); }
  // roofs (ridge lines) in the roof tool
  if (B.mode==='roof' && B.tab==='layout') for (const { r, q, dir } of roofParts(full, n)){ const cx=X(q.x+q.w/2), cy=Y(q.z+q.d/2), sel=r.id===B.sel;
    const hx = dir==='x' ? (q.w/2-0.25)*cs : 0, hy = dir==='z' ? (q.d/2-0.25)*cs : 0; line(cx-hx,cy-hy,cx+hx,cy+hy, sel?LW+3:LW+1, sel?'#c0503a':'#8b5e3a');
    x.fillStyle=sel?'#c0503a':'#8b5e3a'; for (const s of [-1,1]){ x.beginPath(); x.arc(cx+s*hx, cy+s*hy, Math.max(2.5,LW), 0, TAU); x.fill(); }
    if (cs*Math.min(q.w,q.d)>34){ x.font='600 10px Fredoka, sans-serif'; x.textAlign='center'; x.fillText(r.roof ? BUILD.roofs.find(o=>o[0]===r.roof)[1] : (dir==='z'?'gable front':'gable side'), cx, cy+(dir==='x'?14:4)); } }
  // stairs: up to the next floor, and the ones you came up
  const stairsMark=(st, label, c)=>{ const X0=X(st.i), Y0=Y(st.j); x.fillStyle=c; for (let k=0;k<4;k++) x.fillRect(X0+cs*0.18, Y0+cs*(0.18+k*0.17), cs*0.64, cs*0.1); if (cs>26){ x.fillStyle='#5b4336'; x.font='600 10px Fredoka, sans-serif'; x.textAlign='center'; x.fillText(label, X0+cs/2, Y0+cs-3); } };
  { const su=stairsOf(full,n+1); if (su && (floorHas(full,n+1) || (B.mode==='stairs' && B.floor===n+1))) stairsMark(su, 'up', 'rgba(139,107,80,.85)'); const sd=n>0?stairsOf(full,n):null; if (sd) stairsMark(sd, 'down', 'rgba(90,120,170,.75)'); }
  const sel=plan.rooms.find(r=>r.id===B.sel); if (sel && (B.tab!=='layout' || B.mode==='rooms' || B.mode==='roof')){ x.strokeStyle='#4f9a3a'; x.lineWidth=3; x.setLineDash([6,4]); x.strokeRect(X(sel.x)+3,Y(sel.z)+3,sel.w*cs-6,sel.d*cs-6); x.setLineDash([]);
    if (B.tab==='layout' && B.mode==='rooms') for(const [hx,hy] of [[sel.x+sel.w/2,sel.z],[sel.x+sel.w/2,sel.z+sel.d],[sel.x,sel.z+sel.d/2],[sel.x+sel.w,sel.z+sel.d/2]]){ x.fillStyle='#4f9a3a'; x.beginPath(); x.arc(X(hx),Y(hy),7,0,TAU); x.fill(); x.fillStyle='#fff'; x.beginPath(); x.arc(X(hx),Y(hy),3,0,TAU); x.fill(); } }
  if (drawRect){ const [a,b]=drawRect; x.fillStyle='rgba(124,195,90,.45)'; x.strokeStyle='#4f9a3a'; x.lineWidth=2; const X0=Math.min(a[0],b[0]), Z0=Math.min(a[1],b[1]), w=Math.abs(a[0]-b[0])+1, d=Math.abs(a[1]-b[1])+1; x.fillRect(X(X0),Y(Z0),w*cs,d*cs); x.strokeRect(X(X0),Y(Z0),w*cs,d*cs); }
  x.restore();
  x.fillStyle='#8b6b50'; x.font='600 12px Fredoka, sans-serif'; x.textAlign='center'; x.fillText(up?`${FLOOR_NAME[n]} (shaded: rooms below) · front is at the bottom`:'front of the lot (path side) is at the bottom', W/2, H+15);
}
// Pointer handling for the plan: one finger or the mouse uses the current tool, two fingers pinch and pan, the wheel zooms
function bindPlan(cv, tool){
  const ptr=new Map(); let pinch=null, drag=null;
  cv.onwheel=e=>{ e.preventDefault(); const r=cv.getBoundingClientRect(); bpZoom(cv, Math.exp(-(e.ctrlKey?e.deltaY*3:e.deltaY)*0.0015), e.clientX-r.left, e.clientY-r.top); drawPlan(cv); };
  cv.onpointerdown=e=>{ e.preventDefault(); cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId,{ x:e.clientX, y:e.clientY });
    if (ptr.size===2){ if (drag && tool.cancel) tool.cancel(drag); drag=null; const [a,b]=[...ptr.values()]; pinch={ d:Math.hypot(a.x-b.x,a.y-b.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2 }; return; }
    if (ptr.size>2) return;
    if (e.button===1 || e.button===2){ drag={ pan:true, x:e.clientX, y:e.clientY }; return; }
    drag={ x:e.clientX, y:e.clientY, sx:e.clientX, sy:e.clientY, moved:false, t:tool.down ? tool.down(bpPoint(cv,e), e) : null }; };
  cv.onpointermove=e=>{ const p=ptr.get(e.pointerId); if (!p) return; p.x=e.clientX; p.y=e.clientY;
    if (pinch && ptr.size===2){ const [a,b]=[...ptr.values()], d=Math.hypot(a.x-b.x,a.y-b.y), mx=(a.x+b.x)/2, my=(a.y+b.y)/2, r=cv.getBoundingClientRect(), pv=buildMode.pv;
      bpZoom(cv, d/pinch.d, mx-r.left, my-r.top); pv.ox-=(mx-pinch.mx)/pv.cs; pv.oz-=(my-pinch.my)/pv.cs; bpClamp(); pinch={ d, mx, my }; drawPlan(cv); return; }
    if (!drag) return; const pv=buildMode.pv;
    if (drag.pan || (!drag.t && Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>6)){ drag.pan=true; pv.ox-=(e.clientX-drag.x)/pv.cs; pv.oz-=(e.clientY-drag.y)/pv.cs; bpClamp(); drag.x=e.clientX; drag.y=e.clientY; drawPlan(cv); return; }
    if (Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)>4) drag.moved=true; if (drag.t && tool.move) tool.move(drag.t, bpPoint(cv,e)); };
  const end=e=>{ if (!ptr.has(e.pointerId)) return; ptr.delete(e.pointerId); if (ptr.size<2) pinch=null; const d=drag; if (ptr.size===0) drag=null; else return;
    if (!d || d.pan) return; if (d.t && tool.up) tool.up(d.t, bpPoint(cv,e), d.moved); else if (!d.moved && tool.tap) tool.tap(bpPoint(cv,e)); };
  cv.onpointerup=end; cv.onpointercancel=e=>{ if (drag && drag.t && tool.cancel) tool.cancel(drag.t); drag=null; ptr.delete(e.pointerId); pinch=null; };
  cv.oncontextmenu=e=>e.preventDefault();
  cv.parentNode.querySelectorAll('[data-z]').forEach(b=>b.onclick=()=>{ const z=b.dataset.z; Snd.click();
    if (z==='in') bpZoom(cv,1.3); else if (z==='out') bpZoom(cv,1/1.3); else if (z==='fit') planFit(cv); else if (z==='tall'){ buildMode.tall=!buildMode.tall; buildMode.pv=null; renderBuild(true); return; } drawPlan(cv); });
}
function roomAtCell(plan,i,j){ return plan.rooms.find(r=>i>=r.x&&i<r.x+r.w&&j>=r.z&&j<r.z+r.d); }
function applyOrRevert(fn, revert){ const plan=buildMode.draft.plan; fn(); fixDoor(plan); const p=planIssue(plan); if (p){ revert(); fixDoor(plan); toast(p); Snd.fail(); return false; } return true; }
const floorChips = (onlyBuilt) => { const B=buildMode, plan=B.draft.plan, m=onlyBuilt ? topFloor(plan)+1 : maxFloors(); if (m<2) return '';
  let h='<div class="chips" style="margin-right:6px">'; for (let n=0;n<m;n++){ const can = n===0 || floorHas(plan,n-1); h+=`<button class="chip${B.floor===n?' on':''}" data-fl="${n}" ${can?'':'disabled'}>${FLOOR_SHORT[n]}</button>`; } return h+'</div>'; };
function bindFloorChips(){ bBody.querySelectorAll('[data-fl]').forEach(b=>b.onclick=()=>{ const B=buildMode, n=+b.dataset.fl; if (B.floor===n) return; B.floor=n; const F=FP(); B.sel=F.rooms[0]?F.rooms[0].id:null; Snd.click();
  if (B.mode==='trellis' && n>0) B.mode='rooms'; if ((B.mode==='balcony'||B.mode==='stairs') && n===0) B.mode='rooms'; if (B.tab==='int') setBuildView('in'+n); renderBuild(); }); }
function renderLayoutTab(){
  const B=buildMode, full=B.draft.plan, plan=FP(), { GW, GD }=BUILD, up=B.floor>0, E=B.draft.ext; let sel=plan.rooms.find(r=>r.id===B.sel);
  const modes=[['rooms','Rooms'],['doors','Doors & walls'],['windows','Windows'],...(up?[['balcony','Balconies'],['stairs','Stairs']]:[['trellis','Trellises']]),['roof','Roofs']];
  if (!modes.some(m=>m[0]===B.mode)) B.mode='rooms';
  bBody.innerHTML=`<div class="brow tools">${floorChips()}<div class="chips">${modes.map(([k,n])=>`<button class="chip${B.mode===k?' on':''}" data-m="${k}">${n}</button>`).join('')}</div></div>`
    + (B.mode==='roof' ? roofPanel(sel) : '') + planCanvas();
  if (B.mode==='rooms'&&sel&&(plan.rooms.length>1||up)) bBody.querySelector('.bpwrap').insertAdjacentHTML('beforeend','<button class="btn alt bpdel" id="bDel">Remove room</button>');
  bBody.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ B.mode=b.dataset.m; Snd.click(); renderBuild(); }); bindFloorChips();
  if (B.mode==='roof') bindRoofPanel(sel);
  const del=$('#bDel'); if (del) del.onclick=()=>{ const i=plan.rooms.indexOf(sel), saved=JSON.stringify(full); if (applyOrRevert(()=>{ plan.rooms.splice(i,1); if (up && !plan.rooms.length) delete full[STAIR_KEYS[B.floor]]; }, ()=>{ const p=JSON.parse(saved); for (const k of Object.keys(full)) delete full[k]; Object.assign(full, p); })){ B.sel=plan.rooms[0]?plan.rooms[0].id:null; previewBuild(); } renderBuild(); };
  const cv=$('#bp'); sizePlan(cv); if (!B.pv) planFit(cv); drawPlan(cv);
  const handle = (cs) => Math.min(0.45, Math.max(0.3, 12/cs));
  bindPlan(cv, {
    down:([fx,fz])=>{ const i=Math.floor(fx), j=Math.floor(fz);
      if (B.mode==='roof'){ const r=roomAtCell(plan,i,j); if (r){ B.sel=r.id; Snd.click(); renderBuild(true); } return null; }
      if (B.mode!=='rooms') return null;
      const r=roomAtCell(plan,i,j), m=handle(B.pv.cs);
      if (r && r.id===B.sel){ const d={ l:fx-r.x, r:r.x+r.w-fx, t:fz-r.z, b:r.z+r.d-fz }; const side=Object.entries(d).sort((a,b)=>a[1]-b[1])[0]; return { type: side[1]<m ? 'resize':'move', side:side[0], r, orig:{...r}, fx, fz, saved:JSON.stringify(full) }; }
      if (r){ B.sel=r.id; Snd.click(); drawPlan(cv); return { type:'move', r, orig:{...r}, fx, fz, saved:JSON.stringify(full), justSel:true }; }
      if (i>=0&&j>=0&&i<GW&&j<GD){ const t={ type:'draw', a:[i,j], b:[i,j] }; drawPlan(cv,[t.a,t.b]); return t; }
      return null; },
    move:(t,[fx,fz])=>{
      if (t.type==='draw'){ t.b=[clamp(Math.floor(fx),0,GW-1), clamp(Math.floor(fz),0,GD-1)]; drawPlan(cv,[t.a,t.b]); return; }
      if (t.type==='move'){ const o=t.orig; t.r.x=clamp(o.x+Math.round(fx-t.fx),0,GW-o.w); t.r.z=clamp(o.z+Math.round(fz-t.fz),0,GD-o.d); drawPlan(cv); return; }
      if (t.type==='resize'){ const o=t.orig, r=t.r, s=t.side;
        if (s==='r') r.w=clamp(Math.round(fx)-o.x,1,GW-o.x); if (s==='b') r.d=clamp(Math.round(fz)-o.z,1,GD-o.z);
        if (s==='l'){ const nx=clamp(Math.round(fx),0,o.x+o.w-1); r.x=nx; r.w=o.x+o.w-nx; } if (s==='t'){ const nz=clamp(Math.round(fz),0,o.z+o.d-1); r.z=nz; r.d=o.z+o.d-nz; }
        drawPlan(cv); } },
    cancel:(t)=>{ if (t.type==='move'||t.type==='resize') Object.assign(t.r, t.orig); drawPlan(cv); },
    up:(t,[fx,fz],moved)=>{
      if (t.type==='draw'){ const X0=Math.min(t.a[0],t.b[0]), Z0=Math.min(t.a[1],t.b[1]), w=Math.abs(t.a[0]-t.b[0])+1, dd=Math.abs(t.a[1]-t.b[1])+1;
        const like=plan.rooms.find(r=>r.id===B.sel)||plan.rooms[0]||full.rooms[0]; const nr=Object.assign(defaultRoom('r'+Date.now().toString(36),X0,Z0,w,dd), like?Object.fromEntries(ROOM_KEYS.filter(k=>k!=='roof').map(k=>[k,like[k]]).concat([['bright',like.bright??0.75],['warm',like.warm??0.5]])):{});
        const touches = !plan.rooms.length || plan.rooms.some(r=>(X0<r.x+r.w && r.x<X0+w && (Z0===r.z+r.d || r.z===Z0+dd)) || (Z0<r.z+r.d && r.z<Z0+dd && (X0===r.x+r.w || r.x===X0+w)));
        if (!touches){ toast('New rooms need to touch the house.'); Snd.fail(); drawPlan(cv); return; }
        const sk=STAIR_KEYS[B.floor], hadStairs=up?full[sk]:null, firstUp = up && !plan.rooms.length;
        if (applyOrRevert(()=>{ plan.rooms.push(nr); if (firstUp && !full[sk]){ const g0=planGrid(floorOf(full,B.floor-1)), below=B.floor>1?stairsOf(full,B.floor-1):null;
            for (let j=Z0;j<Z0+dd&&!full[sk];j++) for (let i=X0;i<X0+w&&!full[sk];i++) if (g0[j][i]>=0 && !(B.floor===1&&full.door&&full.door.i===i&&full.door.j===j) && !(below&&below.i===i&&below.j===j)) full[sk]={i,j}; } },
          ()=>{ plan.rooms.pop(); if (up){ if (hadStairs) full[sk]=hadStairs; else delete full[sk]; } })){ B.sel=nr.id; Snd.pop(); previewBuild(); if (firstUp) toast('Stairs added. Use the Stairs tool to move them.'); }
        renderBuild(true); return; }
      const changed = t.r.x!==t.orig.x||t.r.z!==t.orig.z||t.r.w!==t.orig.w||t.r.d!==t.orig.d;
      if (!changed){ drawPlan(cv); if(t.justSel) renderBuild(true); return; }
      if (applyOrRevert(()=>{}, ()=>{ const p=JSON.parse(t.saved); for (const k of Object.keys(full)) delete full[k]; Object.assign(full, p); })){ Snd.click(); previewBuild(); }
      renderBuild(true); },
    tap:([fx,fz])=>{ if (B.mode==='doors') doorTap(fx,fz); else if (B.mode==='windows') edgeTap(fx,fz,'win'); else if (B.mode==='trellis') edgeTap(fx,fz,'trel'); else if (B.mode==='balcony') edgeTap(fx,fz,'balc'); else if (B.mode==='stairs') stairsTap(fx,fz); }
  });
}
// The roof tool: direction and style for the picked room's roof
function roofPanel(r){ if (!r) return '<div class="muted" style="margin:4px 0">Tap a room on the plan.</div>';
  const B=GUEST?GUEST_BUILD:BUILD, dir=r.pitch||'auto', styles=[['', 'Same as the house'], ...B.roofs.filter(([v])=>styleOwned('roofs',v) || r.roof===v)];
  return `<div class="bsec" style="margin-top:2px"><b>This room's roof</b><div class="chips scroll">${[['auto','Automatic'],['z','Gable to the front'],['x','Gable to the side']].map(([v,n])=>`<button class="chip${dir===v?' on':''}" data-rp="${v}">${n}</button>`).join('')}</div>
    <div class="chips scroll" style="margin-top:6px">${styles.map(([v,n])=>`<button class="chip${(r.roof||'')===v?' on':''}" data-rs="${v}">${n}</button>`).join('')}</div></div>`; }
function bindRoofPanel(r){ if (!r) return;
  bBody.querySelectorAll('[data-rp]').forEach(b=>b.onclick=()=>{ const v=b.dataset.rp; if (v==='auto') delete r.pitch; else r.pitch=v; Snd.click(); previewBuild('house'); renderBuild(true); });
  bBody.querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{ const v=b.dataset.rs; if (!v) delete r.roof; else r.roof=v; Snd.click(); previewBuild('house'); renderBuild(true); }); }
// Tap an outside wall: a window, a trellis (ground floor) or a balcony (upper floors) goes on or comes off
function edgeTap(fx,fz,kind){
  const B=buildMode, full=B.draft.plan, plan=FP(), occ=planGrid(plan), row=B.floor, i=Math.floor(fx), j=Math.floor(fz), u=fx-i, v=fz-j, E=B.draft.ext;
  if (!(occ[j]?.[i]>=0)){ toast('Tap near an outside wall of a room.'); return; }
  const d=[[1-v,0],[v,1],[1-u,2],[u,3]].sort((a,b)=>a[0]-b[0]); const k=d[0][1], [di,dj]=SIDES[k];
  if (occ[j+dj]?.[i+di]>=0){ toast({ win:'Windows', trel:'Trellises', balc:'Balconies' }[kind]+' go on outside walls.'); return; }
  if (row===0 && k===0 && full.door && full.door.i===i && full.door.j===j){ toast('That\'s where the front door is.'); return; }
  if (kind==='win'){ full.win=full.win||{}; full.win[winKey(i,j,k,row)]=winAt(full,i,j,k,row)?0:1; Snd.click(); previewBuild(); }
  else if (kind==='trel'){ if (!E.trellis || E.trellis==='none'){ toast('Pick a trellis in the Outside tab first.'); Snd.fail(); return; }
    if (winAt(full,i,j,k,0)){ toast('There\'s a window on that wall. Take it out first, or pick another wall.'); Snd.fail(); return; }
    full.trel=full.trel||{}; const key=winKey(i,j,k,0); if (full.trel[key]) delete full.trel[key]; else full.trel[key]=1; Snd.click(); previewBuild('house'); }
  else { if (!E.balc || E.balc==='none'){ toast('Pick a balcony in the Outside tab first.'); Snd.fail(); return; }
    full.balc=full.balc||{}; const key=winKey(i,j,k,row); if (full.balc[key]) delete full.balc[key]; else full.balc[key]=1; Snd.click(); previewBuild(); }
  renderBuild(true); }
function stairsTap(fx,fz){
  const B=buildMode, full=B.draft.plan, n=B.floor, sk=STAIR_KEYS[n], i=Math.floor(fx), j=Math.floor(fz), old=full[sk];
  if (!n || !floorHas(full,n)){ toast(`Add a room on the ${FLOOR_NAME[n]} first, then place the stairs.`); return; }
  if (applyOrRevert(()=>{ full[sk]={i,j}; }, ()=>{ full[sk]=old; })){ Snd.pop(); previewBuild(); } renderBuild(true); }
function doorTap(fx,fz){
  const B=buildMode, full=B.draft.plan, plan=FP(), occ=planGrid(plan); const ex=fx-Math.round(fx), ez=fz-Math.round(fz); const m=Math.min(0.42, Math.max(0.32, 10/B.pv.cs));
  let A,Bn,front=null;
  if (Math.abs(ex)<Math.abs(ez) && Math.abs(ex)<m){ const L=Math.round(fx), j=Math.floor(fz); A=occ[j]?.[L-1]; Bn=occ[j]?.[L]; }
  else if (Math.abs(ez)<m){ const L=Math.round(fz), i=Math.floor(fx); A=occ[L-1]?.[i]; Bn=occ[L]?.[i]; if (A>=0 && !(Bn>=0) && B.floor===0) front={ i, j:L-1 }; }
  else return;
  if (front){ const old=full.door; if (applyOrRevert(()=>{ full.door=front; }, ()=>{ full.door=old; })){ Snd.pop(); previewBuild(); toast('Front door moved.'); } renderBuild(true); return; }
  if (!(A>=0) || !(Bn>=0) || A===Bn){ toast(B.floor?'Tap a wall between two rooms on this floor.':'Tap a wall between two rooms, or a front-facing outside wall.'); return; }
  const key=linkKey(plan.rooms[A].id, plan.rooms[Bn].id), cur=plan.links[key]||'door', nxt={ door:'open', open:'wall', wall:'door' }[cur];
  if (applyOrRevert(()=>{ plan.links[key]=nxt; }, ()=>{ plan.links[key]=cur; })){ Snd.click(); previewBuild(); toast({ door:'Doorway', open:'Open (no wall)', wall:'Solid wall' }[nxt]); }
  renderBuild(true);
}
// ---- outside ----
/* ---- House style unlocks ----
   Every paint, material and style has to be unlocked once (buy it from Pemberton's Home Goods rack, find a swatch while digging,
   or get one from a neighbor who likes you). After that, switching to it is always free. The builder only shows what you own;
   trying things on happens from the rack in the store. */
const STYLE_LIST={ wall:'walls', roof:'roofs', door:'doors', win:'windows', porch:'porches', found:'founds', chimney:'chimneys', stories:'stories', floor:'floors', paper:'papers', shutters:'shutters', boxes:'boxes', lamps:'lamps',
  light:'lights', trellis:'trellises', balc:'balconies', ceil:'ceilings', sconce:'sconces', accent:'accents',
  wallC:'wallColors', roofC:'roofColors', trimC:'trimColors', doorC:'doorColors', shutC:'doorColors', floorC:'floorColors', paperC:'wallColors' };
const STYLE_NAMES={ walls:'walls', roofs:'roof', doors:'door', windows:'windows', porches:'porch', founds:'foundation', chimneys:'chimney', stories:'height', floors:'floor', papers:'wallpaper', shutters:'shutters', boxes:'flower boxes',
  lights:'porch light', trellises:'trellis', balconies:'balcony', ceilings:'ceiling light', sconces:'wall lights', accents:'accent lighting',
  wallColors:'wall paint', roofColors:'roof paint', trimColors:'trim paint', doorColors:'door paint', floorColors:'floor stain' };
const STYLE_BASE={ walls:6800, roofs:5400, doors:2700, windows:3200, porches:4500, founds:2300, chimneys:6300, stories:60000, floors:4000, papers:3200, shutters:2300, boxes:1800, lamps:1400,
  lights:2400, trellises:3200, balconies:7500, ceilings:2600, sconces:2200, accents:3400 };   // v1.18: about 1.5x
const STORY_COST=[0, 60000, 120000, 200000];
const isColorList = list => /Colors$/.test(list);
const TOGGLE_LISTS = new Set(['shutters','boxes','lamps']);   // add-ons that are either on or off
// v1.15: only the base model's own option in each list is free (the first one). Everything else is bought or found.
const freeCount = list => 1;
function styleCost(list, i){ if (i<freeCount(list)) return 0; if (list==='stories') return STORY_COST[i]||STORY_COST[STORY_COST.length-1]; if (isColorList(list)) return 1200 + (i-1)*450; return Math.round(STYLE_BASE[list]*(1+(i-1)*0.75)/50)*50; }
function styleOwned(list, v){ const opts=BUILD[list]; const i=opts.findIndex(o=>String(Array.isArray(o)?o[0]:o)===String(v)); return i<0 || i<freeCount(list) || !!(S.styles&&S.styles[list+':'+v]); }
function unlockStyle(list, v){ (S.styles=S.styles||{})[list+':'+v]=true; save(); }
const styleLabel = (list, v) => { const o=BUILD[list].find(o=>String(Array.isArray(o)?o[0]:o)===String(v)); return TOGGLE_LISTS.has(list) ? o[1] : Array.isArray(o) ? `${o[1]} (${STYLE_NAMES[list]})` : `a new ${STYLE_NAMES[list]} color`; };
// A random locked style, for swatches you find or get as gifts
function grantRandomStyle(){
  const all=[]; for (const list of Object.keys(STYLE_NAMES)){ BUILD[list].forEach((o,i)=>{ const v=Array.isArray(o)?o[0]:o; if(!styleOwned(list,v) && (!GUEST || list in GUEST_BUILD && (GUEST_BUILD[list]||[]).some(x=>String(Array.isArray(x)?x[0]:x)===String(v)))) all.push([list,v,i]); }); }
  if (!all.length) return null; all.sort((a,b)=>a[2]-b[2]); const pick=all[Math.floor(Math.random()*Math.min(all.length, 8))];   // cheaper styles come first
  unlockStyle(pick[0], pick[1]); return styleLabel(pick[0], pick[1]);
}
// Grandfather: anything an existing house already uses counts as owned
function ownCurrentStyles(){ const h=S.home; if(!h) return; S.styles=S.styles||{}; const own=(key,val)=>{ const l=STYLE_LIST[key]; if(l && val!==undefined && val!==null) S.styles[l+':'+val]=true; };
  if (h.ext) for (const k in h.ext) own(k, h.ext[k]); if (h.plan && h.plan.rooms) for (const r of allRooms(h.plan)) for (const k of ROOM_KEYS) own(k, r[k]); }
if (!S.stylesGrandfathered){ ownCurrentStyles(); S.stylesGrandfathered=1; }
// v1.15: options that used to come free (first 2 styles, first 4 colors, shutters, flower boxes, door lamps) stay unlocked for houses already built
if (!S.stylesV115){ ownCurrentStyles(); if (S.home && S.home.built){ S.styles=S.styles||{};
  for (const list of Object.keys(STYLE_NAMES)){ if (['lights','trellises','balconies','ceilings','sconces','accents'].includes(list)) continue; const n = TOGGLE_LISTS.has(list) ? 2 : isColorList(list) ? 4 : list==='stories' ? 1 : 2; BUILD[list].slice(0,n).forEach(o=>{ S.styles[list+':'+(Array.isArray(o)?o[0]:o)]=true; }); }
  S.styles['lights:lantern']=true; }
  S.stylesV115=1; }
/* ---------- Home goods ----------
   New styles, paints and materials aren't for sale all the time. Pemberton's Home Goods rack gets a few in each day
   (more once the store is bigger), and now and then the paint mixer. Anything on the rack can be tried on your house
   in the builder before you buy it. In the builder you only see what's yours (bought from the rack, dug up as a swatch book,
   or given by a neighbor), plus whatever you're trying on. */
const HOME_KEY={ walls:'wall', roofs:'roof', doors:'door', windows:'win', porches:'porch', founds:'found', chimneys:'chimney', stories:'stories', floors:'floor', papers:'paper', shutters:'shutters', boxes:'boxes', lamps:'lamps',
  lights:'light', trellises:'trellis', balconies:'balc', ceilings:'ceil', sconces:'sconce', accents:'accent',
  wallColors:'wallC', roofColors:'roofC', trimColors:'trimC', doorColors:'doorC', floorColors:'floorC' };
const INSIDE_LISTS=new Set(['floors','papers','floorColors','ceilings','sconces','accents']);
const styleIndex = (list, v) => BUILD[list].findIndex(o=>String(Array.isArray(o)?o[0]:o)===String(v));
const MIXER_COST=22500, hasMixer=()=>!!(S.styles&&S.styles.mixer);
const homeOwned = it => it.list==='mixer' ? hasMixer() : styleOwned(it.list, it.v);
const homePrice = it => it.list==='mixer' ? MIXER_COST : styleCost(it.list, styleIndex(it.list, it.v));
function homeName(list, v){ if (list==='mixer') return 'Paint mixer'; const o=BUILD[list].find(o=>String(Array.isArray(o)?o[0]:o)===String(v)), nm=STYLE_NAMES[list]||list;
  if (!Array.isArray(o)) return nm[0].toUpperCase()+nm.slice(1); return list==='stories' || TOGGLE_LISTS.has(list) || ['lights','trellises','balconies','ceilings','sconces','accents'].includes(list) ? o[1] : `${o[1]} ${nm}`; }
const homeWhere = it => it.list==='mixer' ? 'mix any color for any paint, inside or out' : INSIDE_LISTS.has(it.list) ? 'for the rooms inside' : it.list==='stories' ? 'build this many floors' : 'for the outside of your house';
function homeSwatch(it){ if (it.list==='mixer') return `<div class="hgsw" style="background:conic-gradient(#e2604d,#f3c35a,#7cc35a,#7fd3e8,#8a6ad8,#e2604d)"></div>`;
  if (isColorList(it.list)) return `<div class="hgsw" style="background:${hexs(it.v)}"></div>`;
  const o=BUILD[it.list].find(o=>String(o[0])===String(it.v)); return `<div class="hgsw">${o?o[1]:''}</div>`; }
// Today's rack, rolled once a day and kept in the day's save so buying one doesn't reshuffle the rest
function homeStock(){
  if (!S.day || GUEST) return []; if (S.day.home) return S.day.home;   // guests can't build, so no home goods
  const r=mulberry32(hashStr(S.day.key+':home:'+S.seed)), BL=GUEST?GUEST_BUILD:BUILD, pool=[];
  for (const list of Object.keys(STYLE_NAMES)) (BL[list]||[]).forEach(o=>{ const v=Array.isArray(o)?o[0]:o; if (!styleOwned(list,v)) pool.push({ list, v, w:(isColorList(list)?1.3:1)/(1+0.35*Math.max(0,styleIndex(list,v)-freeCount(list))) }); });
  const n=3+(shopTier('general')>=2?1:0)+(shopTier('general')>=3?1:0), out=[];
  while (out.length<n && pool.length){ const tot=pool.reduce((a,p)=>a+p.w,0); let x=r()*tot, k=0; for (;k<pool.length-1;k++){ x-=pool[k].w; if (x<=0) break; } const p=pool.splice(k,1)[0]; out.push({ list:p.list, v:p.v }); }
  if (!GUEST && !hasMixer() && r()<0.15) out.push({ list:'mixer', v:null });
  S.day.home=out; save(); return out; }
function buyHome(it){ if (homeOwned(it)){ toast('You already have that one.'); return false; } const price=homePrice(it);
  if (S.clams<price){ toast(`That's ${fmt(price)} clams. You have ${fmt(S.clams)}.`); Snd.fail(); return false; }
  S.clams-=price; addTrade('stall', price); if (it.list==='mixer') (S.styles=S.styles||{}).mixer=true; else unlockStyle(it.list, it.v); it.sold=true; save(); updateHUD(); Snd.coin();
  toast(`${homeName(it.list,it.v)} is yours!`, null, 'new'); refreshHomeRack(); return true; }
// Styles the builder draft uses that you don't own yet (previews)
function draftUnowned(d){ const out=[], saved=new Set(), seen=new Set();
  const savedOf=(k,v)=>saved.add(k+':'+v); const de=defaultExt(), dr=defaultRoom('x',0,0,1,1); for (const k in de) savedOf(k,de[k]); for (const k of ROOM_KEYS) savedOf(k,dr[k]);
  if (S.home.ext) for (const k in S.home.ext) savedOf(k,S.home.ext[k]); for (const r of allRooms(S.home.plan)) for (const k of ROOM_KEYS) savedOf(k,r[k]);
  const chk=(key,val)=>{ const list=STYLE_LIST[key]; if (!list || val===undefined || val===null || saved.has(key+':'+val)) return; const i=styleIndex(list,val);
    const u = i<0 ? (isColorList(list) && !hasMixer() ? { list:'mixer', v:null } : null) : (!styleOwned(list,val) ? { list, v:val } : null);
    if (u && !seen.has(u.list+':'+u.v)){ seen.add(u.list+':'+u.v); out.push(u); } };
  for (const k in d.ext) chk(k, d.ext[k]); for (const r of allRooms(d.plan)) for (const k of ROOM_KEYS) chk(k, r[k]);
  return out; }
// Put previewed styles back to what the house had (or the first free option)
function putBack(d){ const un=draftUnowned(d), bad=(key,val)=>{ const list=STYLE_LIST[key]; return list && un.some(u=>u.list==='mixer' ? (isColorList(list) && styleIndex(list,val)<0) : (u.list===list && String(u.v)===String(val))); };
  const first=list=>{ const o=BUILD[list][0]; return Array.isArray(o)?o[0]:o; };
  for (const k in d.ext) if (bad(k,d.ext[k])) d.ext[k] = S.home.ext && S.home.ext[k]!==undefined && !bad(k,S.home.ext[k]) ? S.home.ext[k] : first(STYLE_LIST[k]);
  const old=allRooms(S.home.plan);
  for (const r of allRooms(d.plan)){ const o=old.find(x=>x.id===r.id); for (const k of ROOM_KEYS) if (bad(k,r[k])){ if (k==='roof'){ if (o && o.roof && !bad(k,o.roof)) r.roof=o.roof; else delete r.roof; } else r[k] = o && !bad(k,o[k]) ? o[k] : first(STYLE_LIST[k]); } }
  if (buildMode) buildMode.tryMixer=false; }
function renderTryBar(){ const B=buildMode; if (!B) return; const un=draftUnowned(B.draft); let bar=$('#tryBar'); if (bar) bar.remove(); if (!un.length) return;
  const st=homeStock(), onRack=u=>st.find(s=>!homeOwned(s) && s.list===u.list && String(s.v)===String(u.v));
  bar=document.createElement('div'); bar.id='tryBar';
  const rack=un.filter(onRack), off=un.filter(u=>!onRack(u));
  bar.innerHTML=`<b>Trying on: ${un.map(u=>u.list==='mixer'?'a mixed paint color':homeName(u.list,u.v)).join(', ')}</b><br><span class="muted">${off.length?`${off.map(u=>homeName(u.list,u.v)).join(', ')} ${off.length>1?'aren\'t':'isn\'t'} for sale today. Pemberton's Home Goods rack gets new styles every day, and swatch books turn up while digging.`:'On Pemberton\'s Home Goods rack today.'} Buy it or put it back to finish.</span>
    <div class="brow" style="margin:6px 0 0">${rack.map(u=>{ const it=onRack(u), p=homePrice(it); return `<button class="btn sm" data-tb="${st.indexOf(it)}" ${S.clams<p?'disabled':''}>Buy ${homeName(u.list,u.v)} (${fmt(p)})</button>`; }).join('')}<button class="btn alt sm" id="tbBack">Put it back</button></div>`;
  bBody.prepend(bar);
  bar.querySelectorAll('[data-tb]').forEach(b=>b.onclick=()=>{ if (buyHome(st[+b.dataset.tb])) renderBuild(true); });
  $('#tbBack').onclick=()=>{ putBack(B.draft); Snd.click(); previewBuild(); renderBuild(true); }; }
// Options you own, plus whatever is on the house right now (so something you're trying on shows as picked)
const chipRow = (obj, key, opts, type='s') => { const list=STYLE_LIST[key]; const shown=opts.filter(([v])=>!list || styleOwned(list,v) || obj[key]===v);
  return `<div class="chips">${shown.map(([v,n])=>{ const trying=list && !styleOwned(list,v); return `<button class="chip${obj[key]===v?' on':''}" data-k="${key}" data-v="${v}" data-ty="${type}">${n}${trying?'<span class="lk">trying on</span>':''}</button>`; }).join('')}</div>`; };
/* The paint mixer: once you own it, any color works for walls, roof, trim, doors, shutters, floors and wallpaper. */
const swatchRow = (obj, key, cols) => { const list=STYLE_LIST[key], custom=!cols.includes(obj[key]), mix=hasMixer() || (buildMode&&buildMode.tryMixer) || custom;
  return `<div class="sws">${cols.filter(c=>!list || styleOwned(list,c) || obj[key]===c).map(c=>`<div class="sw${obj[key]===c?' on':''}" style="background:${hexs(c)}" data-k="${key}" data-v="${c}" data-ty="n"></div>`).join('')}${mix?`<label class="sw mix${custom?' on':''}" title="Mix any color" style="${custom?`background:${hexs(obj[key])}`:''}"><input type="color" data-mix="${key}" value="${hexs(obj[key])}"></label>`:''}</div>`; };
const toggle = (obj, key, on, off) => { const list=STYLE_LIST[key]; if (list && !styleOwned(list,true) && obj[key]!==true) return ''; return chipRow(obj, key, [[true,on],[false,off]], 'b'); };
function bindStyle(obj, after, which){
  bBody.querySelectorAll('[data-mix]').forEach(inp=>{ const key=inp.dataset.mix;
    inp.oninput=()=>{ obj[key]=parseInt(inp.value.slice(1),16); inp.parentNode.style.background=inp.value; previewSoon(which || (buildMode.tab==='int'?buildMode.floor:'house')); };
    inp.onchange=()=>after(); });
  bBody.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>{ const t=el.dataset.ty, v=el.dataset.v;
    obj[el.dataset.k] = t==='n'?+v : t==='b'?v==='true' : v; Snd.click(); after(); }); }
// A Home Goods rack in Pemberton's store: today's swatches on a board, paint cans on the shelf
let homeRack=null;
function homeRackModel(){ const g=new THREE.Group(), W=M(0x8b5e3a), st=homeStock();
  for (const x of [-0.62,0.62]) mk(G.box(0.08,1.75,0.08), W, x,0.875,0,g);
  mk(G.box(1.3,1.0,0.05), M(0xf4e6c8), 0,1.2,-0.02,g); mk(G.box(1.42,0.08,0.1), W, 0,1.74,0,g); mk(G.box(1.36,0.05,0.34), W, 0,0.42,0.1,g);
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const x=cv.getContext('2d'); x.fillStyle='#6a8a4a'; x.fillRect(0,0,256,64); x.fillStyle='#fff8ea'; x.font='700 34px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('Home Goods',128,34);
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; mk(G.box(1.1,0.28,0.04), new THREE.MeshStandardMaterial({ map:tx, roughness:0.8 }), 0,1.95,0,g);
  const TILE={ walls:0xd8b890, roofs:0xb85a4a, doors:0x8a5a3a, windows:0xbfe0f0, porches:0xc8a070, founds:0x9a9a98, chimneys:0xa05a40, stories:0xe8d8b8, floors:0xc89a6a, papers:0xe8d0d8,
    lights:0xffd27a, trellises:0x6a9a4a, balconies:0xc8a878, ceilings:0xfff0c8, sconces:0xd8b060, accents:0xffe0a0 };
  st.forEach((it,i)=>{ if (i>=6) return; const c=i%3, rr=Math.floor(i/3), px=-0.4+c*0.4, py=1.42-rr*0.42, sold=homeOwned(it);
    if (it.list==='mixer'){ ['#e2604d','#f3c35a','#7cc35a','#7fd3e8'].forEach((h,k)=>{ if (!sold) mk(G.cyl(0.07,0.07,0.14,12), M(new THREE.Color(h).getHex()), -0.5+k*0.18+0.1,0.52,0.12,g); }); return; }
    const col=isColorList(it.list)?it.v:TILE[it.list]||0xd8c8a8;
    if (!sold){ mk(G.box(0.3,0.3,0.03), M(col), px,py,0.02,g); if (isColorList(it.list)) mk(G.cyl(0.075,0.075,0.15,12), M(col), px,0.52,0.12,g); }
    mk(G.cyl(0.012,0.012,0.06,5), M(0xb0a090), px,py+0.17,0.03,g).rotation.x=Math.PI/2; });
  return g; }
class HomeRack extends Ent {
  constructor(x,z){ super('rack',x,z,0.7); this.solid=true; this.reach=1.9; this.key=null; this.attach(new THREE.Group()); this.hitSphere(0.9,1.1); this.refresh(); }
  refresh(){ this.key=S.day&&S.day.key; const g=homeRackModel(); while (this.obj.children.length>1) this.obj.remove(this.obj.children[1]); g.children.slice().forEach(c=>this.obj.add(c)); this.obj.traverse(c=>{ c.userData.ent=this; }); }
  label(){ return 'Home goods'; }
  act(){ const k=KEEPERS.pemberton; if (GUEST){ dialog(k.name, k.voice, ['Home goods are for homeowners. Make an account and Clementine can set you up with a house!']); return; } dialog(k.name, k.voice, [homeStock().some(s=>!homeOwned(s)) ? 'Fresh in for the home today. Take one home and try it on before you buy, no charge for looking.' : 'All sold out of home goods today. More comes in tomorrow!'], ()=>openShop('stall','home')); }
  update(){ if (S.day && this.key!==S.day.key) this.refresh(); }
}
function refreshHomeRack(){ if (homeRack && !homeRack.removed) homeRack.refresh(); }
// Guests get a smaller set of house styles
const GUEST_BUILD = Object.assign({}, BUILD, { walls:BUILD.walls.slice(0,3), roofs:BUILD.roofs.slice(0,2), doors:BUILD.doors.slice(0,2), windows:BUILD.windows.slice(0,2), porches:BUILD.porches.slice(0,2), chimneys:BUILD.chimneys.slice(0,1), stories:BUILD.stories.slice(0,1),
  lights:BUILD.lights.slice(0,1), trellises:BUILD.trellises.slice(0,1), balconies:BUILD.balconies.slice(0,1), ceilings:BUILD.ceilings.slice(0,1), sconces:BUILD.sconces.slice(0,1), accents:BUILD.accents.slice(0,1) });
/* Moss you paint on: free once you own the Mossy shingles roof. Works on any roof style. */
const mossOK = () => styleOwned('roofs','mossy');
// A Mossy shingles roof you haven't painted yet starts from the moss it already shows, so the first stroke doesn't wipe it
function mossStart(){ const B=buildMode, E=B.draft.ext; if (E.moss) return; E.moss=defaultMoss(B.draft)||{}; }
let mossQ=false;
function mossPaintAt(cx, cy){ const B=buildMode, model=houseEnt && houseEnt.model; if (!B || !B.brush || !model) return;
  const rect=canvas.getBoundingClientRect(); ndc.set((cx-rect.left)/rect.width*2-1, -(cy-rect.top)/rect.height*2+1); ray.setFromCamera(ndc,camera);
  const cell=roofPick(model, ray.ray); if (!cell) return; mossStart();
  const [a,b]=cell, R=B.bsize, E=B.draft.ext; let changed=false; B.stroke=B.stroke||new Set();
  for (let da=-R;da<=R;da++) for (let db=-R;db<=R;db++){ if (da*da+db*db>R*R+0.6) continue; const k=(a+da)+','+(b+db); if (B.stroke.has(k)) continue; B.stroke.add(k);
    const cur=E.moss[k]||0, nv = B.brush==='moss' ? Math.min(3,cur+1) : Math.max(0,cur-1); if (nv===cur) continue; if (nv) E.moss[k]=nv; else delete E.moss[k]; changed=true; }
  if (changed && !mossQ){ mossQ=true; requestAnimationFrame(()=>{ mossQ=false; if (buildMode && houseEnt && houseEnt.model) buildMossLayer(houseEnt.model, buildMode.draft.ext.moss); }); } }
function renderExtTab(){
  const E=buildMode.draft.ext, B=GUEST ? GUEST_BUILD : BUILD, BM=buildMode; const sec=(t,h)=>`<div class="bsec"><b>${t}</b>${h}</div>`;
  const moss = mossOK() ? sec('Moss', `<div class="chips"><button class="chip${BM.brush==='moss'?' on':''}" data-brush="moss">Paint moss</button><button class="chip${BM.brush==='scrub'?' on':''}" data-brush="scrub">Scrub moss</button>${BM.brush?'<button class="chip" data-brush="">Stop painting</button>':''}</div>
      <div class="chips" style="margin-top:6px"><span class="muted" style="align-self:center">Brush</span>${[[0,'Small'],[1,'Medium'],[2,'Large']].map(([v,n])=>`<button class="chip${BM.bsize===v?' on':''}" data-bsize="${v}">${n}</button>`).join('')}<button class="chip" id="mossClear">Clear all moss</button></div>
      <div class="muted" style="margin-top:4px">${BM.brush?'Drag on the roof in the picture. Go over a spot again for thicker moss. Two fingers (or the buttons) still turn and zoom.':'Paint moss on any roof, as thick or thin as you like. It\'s free.'}</div>`) : '';
  bBody.innerHTML = `<div class="muted" style="margin:2px 0 4px">Only styles you own show here. New ones turn up on Pemberton's Home Goods rack, where you can try them on.</div>`
    + sec('Walls', chipRow(E,'wall',B.walls)+'<div style="height:6px"></div>'+swatchRow(E,'wallC',B.wallColors))
    + sec('Roof', chipRow(E,'roof',B.roofs)+'<div style="height:6px"></div>'+swatchRow(E,'roofC',B.roofColors)+'<div class="muted" style="margin-top:4px">Turn a room\'s roof, or give it its own style, in Layout &gt; Roofs.</div>') + moss
    + sec('Trim and window frames', swatchRow(E,'trimC',B.trimColors))
    + sec('Front door', chipRow(E,'door',B.doors)+'<div style="height:6px"></div>'+swatchRow(E,'doorC',B.doorColors))
    + sec('Windows', chipRow(E,'win',B.windows)+'<div style="height:6px"></div>'+toggle(E,'shutters','Shutters','No shutters')+(E.shutters?'<div style="height:6px"></div>'+swatchRow(E,'shutC',B.doorColors):'')+'<div style="height:6px"></div>'+toggle(E,'boxes','Flower boxes','No flower boxes'))
    + sec('Porch', chipRow(E,'porch',B.porches)) + sec('Porch light', chipRow(E,'light',B.lights))
    + sec('Trellis', chipRow(E,'trellis',B.trellises)+(E.trellis&&E.trellis!=='none'?'<div class="muted" style="margin-top:4px">Place them on any outside wall in Layout &gt; Trellises.</div>':''))
    + (topFloor(buildMode.draft.plan)>0 || E.balc!=='none' ? sec('Balcony', chipRow(E,'balc',B.balconies)+(E.balc&&E.balc!=='none'?'<div class="muted" style="margin-top:4px">Place them on upper floors in Layout &gt; Balconies.</div>':'')) : '')
    + sec('Foundation', chipRow(E,'found',B.founds)) + sec('Chimney', chipRow(E,'chimney',B.chimneys))
    + sec('Height', chipRow(E,'stories',B.stories,'n')+`<div class="muted" style="margin-top:4px">${topFloor(buildMode.draft.plan)>0?`You can build up to ${maxFloors()} floors. Your upstairs rooms set the height.`:ownedFloors()>1?`You can build up to ${ownedFloors()} floors: add rooms upstairs in the Layout tab.`:'Unlock more stories to build rooms upstairs.'}</div>`);
  bindStyle(E, ()=>{ previewBuild('house'); renderBuild(true); }, 'house');
  bBody.querySelectorAll('[data-brush]').forEach(b=>b.onclick=()=>{ BM.brush=b.dataset.brush||null; Snd.click(); renderBuild(true); });
  bBody.querySelectorAll('[data-bsize]').forEach(b=>b.onclick=()=>{ BM.bsize=+b.dataset.bsize; Snd.click(); renderBuild(true); });
  const mc=$('#mossClear'); if (mc) mc.onclick=()=>{ E.moss={}; Snd.click(); if (houseEnt && houseEnt.model) buildMossLayer(houseEnt.model, E.moss); previewBuild('house'); renderBuild(true); };
}
// ---- inside ----
function renderIntTab(){
  const B=buildMode, BD=GUEST?GUEST_BUILD:BUILD; if (!floorHas(B.draft.plan,B.floor)) B.floor=0; const plan=FP(); let r=plan.rooms.find(x=>x.id===B.sel)||plan.rooms[0]; B.sel=r.id;
  const sec=(t,h)=>`<div class="bsec"><b>${t}</b>${h}</div>`, bright=Math.round((r.bright??0.75)*100), warm=Math.round((r.warm??0.5)*100);
  bBody.innerHTML = `<div class="brow">${floorChips(true)}</div>`+planCanvas(Math.max(200, Math.min(320, bBody.clientHeight*0.48)))
    + sec('Floor', chipRow(r,'floor',BD.floors)+'<div style="height:6px"></div>'+swatchRow(r,'floorC',BD.floorColors))
    + sec('Wallpaper', chipRow(r,'paper',BD.papers)+'<div style="height:6px"></div>'+swatchRow(r,'paperC',BD.wallColors))
    + `<button class="btn alt" id="bAll" style="margin-top:8px">Use this floor and wallpaper in every room</button>`
    + sec('Lighting', `<div class="slrow"><span>Brightness</span><input type="range" min="0" max="100" value="${bright}" id="lBright"><b id="lBv">${bright}%</b></div>
      <div class="slrow"><span>Warmth</span><input type="range" min="0" max="100" value="${warm}" id="lWarm" class="warmth"><b id="lWv">${warm<35?'Cool':warm>65?'Warm':'Soft'}</b></div>
      <div class="muted" style="margin:2px 0 6px">The overhead light is free in every room. Lamps and fixtures you've bought show below.</div>
      <div class="sub2">Ceiling light</div>${chipRow(r,'ceil',BD.ceilings)}<div class="sub2">Wall lights</div>${chipRow(r,'sconce',BD.sconces)}<div class="sub2">Accent light</div>${chipRow(r,'accent',BD.accents)}`)
    + `<button class="btn alt" id="bAllL" style="margin-top:8px">Use this lighting in every room</button>`;
  const cv=$('#bp'); sizePlan(cv, Math.max(200, Math.min(320, bBody.clientHeight*0.48))); if (!B.pv) planFit(cv); drawPlan(cv);
  bindPlan(cv, { tap:([fx,fz])=>{ const hit=roomAtCell(plan,Math.floor(fx),Math.floor(fz)); if(hit){ B.sel=hit.id; Snd.click(); renderBuild(true); } } });
  bindStyle(r, ()=>{ previewBuild(B.floor); renderBuild(true); }, B.floor); bindFloorChips();
  const sl=(id, key, lab)=>{ const el=$(id); el.oninput=()=>{ r[key]=+el.value/100; $(lab).textContent = key==='bright' ? el.value+'%' : (+el.value<35?'Cool':+el.value>65?'Warm':'Soft'); previewSoon(B.floor); }; };
  sl('#lBright','bright','#lBv'); sl('#lWarm','warm','#lWv');
  $('#bAll').onclick=()=>{ for(const o of allRooms(B.draft.plan)){ o.floor=r.floor; o.floorC=r.floorC; o.paper=r.paper; o.paperC=r.paperC; } Snd.pop(); previewBuild('room'); renderBuild(true); };
  $('#bAllL').onclick=()=>{ for(const o of allRooms(B.draft.plan)){ o.bright=r.bright??0.75; o.warm=r.warm??0.5; o.ceil=r.ceil; o.sconce=r.sconce; o.accent=r.accent; } Snd.pop(); previewBuild('room'); renderBuild(true); };
}
/* The 3D view while building: turn, tilt and zoom buttons (hold to keep going), on top of drag, pinch and the wheel */
let viewBar=null, viewHold=null;
const VB_ICONS={ rl:'<path d="M7 5 3 9l4 4M3 9h10a5 5 0 0 1 0 10h-3"/>', rr:'<path d="M17 5l4 4-4 4M21 9H11a5 5 0 0 0 0 10h3"/>', zi:'<path d="M12 5v14M5 12h14"/>', zo:'<path d="M5 12h14"/>', tu:'<path d="M6 15l6-6 6 6"/>', td:'<path d="M6 9l6 6 6-6"/>', re:'<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>' };
function renderViewBar(){ const B=buildMode;
  if (!B){ if (viewBar) viewBar.style.display='none'; return; }
  if (!viewBar){ viewBar=document.createElement('div'); viewBar.id='bView'; document.body.appendChild(viewBar);
    viewBar.innerHTML=[['rl','Turn left'],['rr','Turn right'],['zi','Zoom in'],['zo','Zoom out'],['tu','Tilt up'],['td','Tilt down'],['re','Reset view']].map(([k,t])=>`<button data-vb="${k}" title="${t}" aria-label="${t}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${VB_ICONS[k]}</svg></button>`).join('');
    const step=k=>{ const B=buildMode; if (!B) return; if (k==='rl') B.yaw+=0.05; else if (k==='rr') B.yaw-=0.05; else if (k==='zi') B.dist=clamp(B.dist*0.96,6,140); else if (k==='zo') B.dist=clamp(B.dist/0.96,6,140); else if (k==='tu') B.pitch=clamp(B.pitch+0.03,0.12,1.4); else if (k==='td') B.pitch=clamp(B.pitch-0.03,0.12,1.4); };
    viewBar.querySelectorAll('[data-vb]').forEach(b=>{ const k=b.dataset.vb;
      b.onpointerdown=e=>{ e.preventDefault(); if (k==='re'){ const v=buildMode&&buildMode.view; if (buildMode){ buildMode.view=null; setBuildView(v||'out'); } Snd.click(); return; } step(k); clearInterval(viewHold); viewHold=setInterval(()=>step(k), 30); };
      for (const ev of ['pointerup','pointerleave','pointercancel']) b.addEventListener(ev, ()=>{ clearInterval(viewHold); viewHold=null; }); }); }
  viewBar.style.display='flex'; viewBar.style.bottom=(buildEl.offsetHeight+10)+'px'; viewBar.classList.toggle('painting', !!B.brush);
}

/* Island board */
function openBoard(){
  const render=()=>{ const d=Time.now();
    let h=`<div class="notice"><b>${S.island||'Island'} news</b><br>${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}. Weather: ${World.weather}.</div>`;
    if (S.day.peddler) h+=`<div class="notice">Fennick came through the Portal Station today and is pushing his cart around the island.${S.day.pplan&&ITEMS[S.day.pplan]&&!knowsPlan(ITEMS[S.day.pplan].learns)?' Word is he has a rare plan with him.':''}</div>`;
    { const rp=shopStock('stall').filter(isRarePiece); if (rp.length) h+=`<div class="notice">Pemberton has something rare on display today: ${rp.map(id=>ITEMS[id].name+' '+rarityTag(ITEMS[id])).join(', ')}.</div>`; }
    if (S.ground.some(g=>g.bottle)) h+=`<div class="notice">Someone saw a bottle wash up on the beach this morning.</div>`;
    for(const e of activeEvents()) h+=`<div class="notice">${e.notice}</div>`;
    h+=`<div class="notice">Ripe fruit trees: ${trees.filter(t=>!t.removed&&t.fruit&&t.fruitLeft()>0).length}. Cracks to dig: ${S.day.digs.filter(x=>!x.dug).length}. Islanders: ${residents.length}.</div>`;
    h+=`<div class="notice"><b>Your progress</b><br>Critters caught: ${S.caught} · Items discovered: ${discovered()} · Best friends: ${bestFriends()}</div>`;
    h+=`<div class="notice"><b>Your home</b><br>`;
    if (!S.home.built) h+= GUEST ? `You're living in a tent. Houses are for islanders with an account.` : `You're still in a tent! Clementine at the town hall can loan you a base-model house: one room of 9 floor squares for ${fmt(houseCost(9,0))} clams, paid back a little at a time.`;
    else h+=`${S.home.plan.rooms.length} room${S.home.plan.rooms.length>1?'s':''} · ${planCells(S.home.plan)} floor squares.${loanOpen()?` Home loan: <b>${fmt(S.loan.owed)}</b> of ${fmt(S.loan.total)} clams left.`:''} New styles, add-ons and paint cost clams (switching between ones you own is free), new floor goes on a home loan, and each layout change costs ${REMODEL_FEE} clams.${GUEST?'':`<br><button class="btn" id="bdOpen" style="margin-top:8px">Open build mode</button>`}`;
    h+=`</div><div class="notice"><b>Museum</b><br>${donatedCount()} of ${MUSEUM_TOTAL} displays filled. Professor Thistle is just south of the plaza.</div>`;
    if (!VISIT) h+=`<div class="notice"><b>Favors</b> <span class="muted">· ${Q.done||0} done so far · up to ${MAX_FAVORS} at a time</span>${favorsHTML()}</div>`;
    h+=`<div class="notice"><b>Achievements</b> <span class="muted">· ${achCount()} of ${ACHIEVEMENTS.length} earned</span><br><button class="btn alt" id="bdAch" style="margin-top:6px">See achievements</button></div>`;
    if (S.magic.tower) h+=`<div class="notice"><b>Wendell the wizard</b><br>Potions any time.${moveUnlocked()?' Moving buildings: ready.':''}${landUnlocked()?' Shaping land: ready.':''}</div>`;
    pBody.innerHTML=h;
    const bdo=pBody.querySelector('#bdOpen'); if (bdo) bdo.onclick=()=>{ panelClose=null; closePanel(); openBuild(); };
    const bda=pBody.querySelector('#bdAch'); if (bda) bda.onclick=()=>{ closePanel(); setTimeout(()=>openAchievements(), 60); };
  };
  openPanel('Island Board'); render();
}

/* Menu: settings, controls, testing tools */
let menuOpen=false;
const KEY_ROWS=[['act','Use / talk / pick up (Enter works too)'],['swing','Use your tool (chop, dig, cast...)'],['tool','Switch tool'],['bike','Hop on the bike'],['sled','Ride the sled'],['bag','Open the bag'],['turnL','Turn the view left'],['turnR','Turn the view right']];
const keyName = k => k===' '?'Space' : k.length===1 ? k.toUpperCase() : k[0].toUpperCase()+k.slice(1);
function openMenu(){
  const c=CT();
  const render=()=>{
    pBody.innerHTML=`<div class="notice"><b>${S.player}</b> of <b>${S.island}</b><br><span class="muted">Caught: ${S.caught} · Discovered: ${discovered()} · Bag: ${slotsMax()} slots</span><br><button class="btn alt" id="mLook" style="margin-top:8px">Change my look</button> <button class="btn alt" id="mAch" style="margin-top:8px">Achievements</button> <button class="btn alt" id="mParty" style="margin-top:8px">Party games</button></div>
    <label class="f">Sound <select id="mSnd"><option value="1">On</option><option value="0">Off</option></select></label>
    <label class="f">Music volume</label><input type="range" id="mMus" min="0" max="1" step="0.05" value="${S.settings.music}">
    <label class="f">Brightness</label><input type="range" id="mBr" min="0.7" max="1.7" step="0.05" value="${S.settings.bright}">
    <div class="notice" style="margin-top:14px"><b>Controls</b>
      ${isTouchDevice?'':`<div class="muted" style="margin:4px 0 6px">WASD or the arrow keys walk (hold Shift to sneak). Drag with the mouse, or swipe sideways with two fingers on a trackpad, to look around. Click things that are close by to use them.</div>
      ${KEY_ROWS.map(([k,n])=>`<div class="row" style="padding:4px 0"><div class="grow">${n}</div><button class="btn alt" data-kb="${k}" style="min-width:70px">${keyName(KB()[k])}</button></div>`).join('')}
      <button class="btn alt" id="kbReset" style="margin-top:6px">Reset keys</button>
      <label class="f">Click the ground to walk there <select id="cClick"><option value="1">On</option><option value="0">Off</option></select></label>`}
      <div id="cTouch" style="${isTouchDevice?'':'display:none'}">
      <label class="f">Walking <select id="cMove"><option value="joystick">On-screen joystick</option><option value="tap">Tap and hold to walk</option></select></label>
      <div id="cJoy">
        <button class="btn" id="cLayout" style="margin:8px 0">Move joystick and action button</button>
        <label class="f">Tap the ground to walk too <select id="cTap"><option value="1">On</option><option value="0">Off</option></select></label>
        <label class="f">Joystick style <select id="cFloat"><option value="0">Fixed in place</option><option value="1">Appears where you touch</option></select></label>
        <label class="f">Joystick size</label><input type="range" id="cSize" min="90" max="190" step="5" value="${c.size}">
        <label class="f">Joystick visibility</label><input type="range" id="cOp" min="0.1" max="0.9" step="0.05" value="${c.opacity}">
        <button class="btn alt" id="cReset" style="margin-top:10px">Reset controls</button>
      </div>
</div>
    </div>
    <div class="notice"><b>Testing tools</b><br><span class="muted">The game runs on your real clock. These preview other times and weather.</span>
      <label class="f">Preview time: <span id="mOffT"></span></label><input type="range" id="mOff" min="-23" max="23" step="1" value="${Time.offsetH}">
      <label class="f">Weather <select id="mW"><option value="">Today's weather</option><option>sunny</option><option>cloudy</option><option>rain</option><option>snow</option></select></label>
      ${DEV?`<div style="margin-top:8px"><b>Shortcuts</b> <span class="muted">(only on this device)</span><br><button class="btn alt" id="dvC">+50,000 clams</button> <button class="btn alt" id="dvT">${S.magic.tower?'Tower is up':'Raise the wizard tower'}</button> <button class="btn alt" id="dvM">${S.devMagic?'Wizard needs requirements again':'Skip wizard requirements'}</button> <button class="btn alt" id="dvF">New favors now</button> <button class="btn alt" id="dvD">Town: skip a day</button> <button class="btn alt" id="dvR">Rare kit</button> <button class="btn alt" id="dvOff">Hide shortcuts</button></div>`:''}
    </div>
    <button class="btn warn" id="mReset">Start a new island</button>${saveOK?'':'<div class="muted" style="margin-top:8px">Saving isn\'t available in this browser.</div>'}`;
    $('#mParty').onclick=()=>{ closePanel(); setTimeout(()=>PARTY.open(), 50); };
    $('#mLook').onclick=async()=>{ closePanel(); const L=await openCreator({ look:CH.parseLook(S.look), title:'Change your look', cancel:true, owned:wardrobeOwned() }); if (L){ const code=CH.lookCode(L); if (code!==S.look) track('look'); setPlayerLook(code); checkAch(); } };
    $('#mAch').onclick=()=>{ closePanel(); setTimeout(()=>openAchievements(), 60); };
    const snd=$('#mSnd'); snd.value=S.settings.sound?'1':'0'; snd.onchange=()=>{ Snd.setOn(snd.value==='1'); save(); };
    $('#mMus').oninput=e=>{ Snd.setMusic(+e.target.value); save(); };
    $('#mBr').oninput=e=>{ S.settings.bright=+e.target.value; save(); updateSky(); };
    const sync=()=>{ $('#cJoy').style.display=c.move==='joystick'?'':'none'; save(); applyControls(); };
    pBody.querySelectorAll('[data-kb]').forEach(b=>b.onclick=()=>{ b.textContent='Press a key...'; Snd.click();
      keyCapture=k=>{ keyCapture=null; if (k!=='escape' && !['w','a','s','d',' ','shift','arrowup','arrowdown','arrowleft','arrowright','enter'].includes(k)){ const kb=KB(); const clash=Object.keys(kb).find(x=>kb[x]===k && x!==b.dataset.kb); if (clash) kb[clash]=kb[b.dataset.kb]; kb[b.dataset.kb]=k; save(); applyControls(); } else if (k!=='escape') toast('That key is already used for walking or talking.'); render(); }; });
    const kr=$('#kbReset'); if (kr) kr.onclick=()=>{ Object.assign(KB(), KEY_DEFAULT); save(); applyControls(); render(); };
    $('#cMove').value=c.move; $('#cMove').onchange=e=>{ c.move=e.target.value; sync(); };
    const cc=$('#cClick'); if (cc){ cc.value=c.clickWalk!==false?'1':'0'; cc.onchange=e=>{ c.clickWalk=e.target.value==='1'; save(); applyControls(); }; }
    $('#cTap').value=c.tapWalk?'1':'0'; $('#cTap').onchange=e=>{ c.tapWalk=e.target.value==='1'; sync(); };
    $('#cFloat').value=c.floating?'1':'0'; $('#cFloat').onchange=e=>{ c.floating=e.target.value==='1'; sync(); };
    $('#cSize').oninput=e=>{ c.size=+e.target.value; sync(); };
    $('#cOp').oninput=e=>{ c.opacity=+e.target.value; sync(); };
    $('#cLayout').onclick=()=>{ closePanel(); startLayout(); };
    $('#cReset').onclick=()=>{ Object.assign(c, CTRL_DEFAULT, {move:'joystick'}); save(); applyControls(); render(); };
    const offT=()=>{ $('#mOffT').textContent = Time.offsetH===0?'now':(Time.offsetH>0?'+':'')+Time.offsetH+'h'; }; offT();
    $('#mOff').oninput=e=>{ Time.offsetH=+e.target.value; offT(); if(rollDay()) spawnDaily(); updateSky(); updateHUD(); };
    if (DEV){ $('#dvC').onclick=()=>{ S.clams+=50000; save(); updateHUD(); Snd.coin(); };
      $('#dvR').onclick=()=>{ for (const m of RARE_MATS) for (let k=0;k<5;k++) addItem(m); for (const r of RARE_WORK) if (!knowsPlan(r.id)) S.rare.plans.push(r.id); save(); toast('Rare kit: 5 of each rare ingredient and every rare plan.'); };
      $('#dvT').onclick=()=>{ if (!S.magic.tower){ closePanel(); Q.story.wizard='done'; raiseTower(); } };
      $('#dvM').onclick=()=>{ S.devMagic=!S.devMagic; save(); render(); };
      $('#dvD').onclick=()=>{ S.town.devDays=(S.town.devDays||0)+1; townNewDay(dayKeyOf(dayNum(today())+S.town.devDays)); applyTown(); toast(`Town moved ahead ${S.town.devDays} day${S.town.devDays>1?'s':''}: ${S.town.res.length} islanders${S.town.next?', '+S.town.next.id+' moving in next':''}.`); };
      $('#dvF').onclick=()=>{ Q.rolledFor=null; Q.offers={}; rollFavors(Math.random); Q.rolledFor=S.day.key; save(); toast('Islanders have new favors to ask.'); };
      $('#dvOff').onclick=()=>{ try{ localStorage.removeItem('dwDev'); }catch(e){} toast('Shortcuts hidden. Open the game with #dev at the end of the address to bring them back.'); render(); }; }
    const w=$('#mW'); w.value=weatherOverride||''; w.onchange=()=>{ weatherOverride=w.value||null; World.weather=weatherOverride||S.day.weather; updateSky(); updateHUD(); };
    $('#mReset').onclick=()=>{
      if (VISIT){ pBody.innerHTML=`<p>You're visiting a friend's island. Go back to your own island to start a new one.</p><button class="btn alt" id="rN">OK</button>`; $('#rN').onclick=render; return; }
      const acct=BOOT.mode==='account';
      pBody.innerHTML=`<p>${acct?'This replaces your island with a brand new one. Your house, items, clams and progress on it are erased. Friends you\'ve added stay your friends.':'This erases your island, items and friendships.'} Are you sure?</p><button class="btn warn" id="rY">Yes, start over</button> <button class="btn alt" id="rN">Keep my island</button>`;
      $('#rY').onclick=()=>{ if (acct){ try{ sessionStorage.setItem('dw-newisland','1'); }catch(e){} BOOT.onSave=()=>{}; location.reload(); return; } try{ localStorage.removeItem(SAVE_KEY); }catch(e){} location.reload(); }; $('#rN').onclick=render; };
    sync();
  };
  openPanel('Menu',()=>{ menuOpen=false; scrim.classList.remove('top'); $('#hud').classList.remove('menuprev'); }); menuOpen=true; scrim.classList.add('top'); $('#hud').classList.add('menuprev'); render();
}
$('#bBag').onclick=()=>openBag(); $('#bBook').onclick=()=>openBook(); $('#bMenu').onclick=()=>openMenu(); $('#bCraft').onclick=()=>openCraft(); updateCraftBtn();

/* Phones: the top bar keeps only what you reach for all the time (Bike, Build near home, Bag) and a More button.
   Book, Craft, Sled, Friends and Menu move into the More list. Buttons keep their own handlers wherever they sit. */
const MAIN_BTNS=['bBike','bBuild','bBag','bMore'];
const barEl=$('#bar'), morePop=$('#morePop'), moreBtn=$('#bMore');
const isCompact = () => isTouchDevice || innerWidth<760;
function layoutBar(){ const compact=isCompact(); document.body.classList.toggle('compact', compact);
  barObs.disconnect();
  const order=['bBike','bSled','bBook','bCraft','bBuild','bBag','bNet','bMenu','bMore'], moreOrder=['bBook','bCraft','bNet','bSled','bMenu'];
  const all=[...barEl.querySelectorAll('.rbtn'), ...morePop.querySelectorAll('.rbtn')];
  const inBar=all.filter(b=>!compact || MAIN_BTNS.includes(b.id)).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
  const inMore=all.filter(b=>!inBar.includes(b)).sort((a,b)=>moreOrder.indexOf(a.id)-moreOrder.indexOf(b.id));
  // only touch the DOM when something is out of place (moving nodes would wake the observers again)
  const same=(el,list)=>{ const cur=[...el.querySelectorAll(':scope > .rbtn')]; return cur.length===list.length && cur.every((b,i)=>b===list[i]); };
  if (!same(barEl,inBar)) for (const b of inBar) barEl.appendChild(b);
  if (!same(morePop,inMore)) for (const b of inMore) morePop.appendChild(b);
  barObs.observe(barEl, { childList:true });
  if (!compact) closeMore(); moreDot(); }
function moreDot(){ const any=[...morePop.querySelectorAll('.rbtn')].some(b=>b.querySelector('.dot') || b.classList.contains('on')); let d=moreBtn.querySelector(':scope > .dot'); if (any && !d){ d=document.createElement('i'); d.className='dot'; moreBtn.appendChild(d); } else if (!any && d) d.remove(); }
function closeMore(){ morePop.classList.remove('show'); moreBtn.classList.remove('on'); }
moreBtn.onclick=e=>{ e.stopPropagation(); const on=!morePop.classList.contains('show'); morePop.classList.toggle('show', on); moreBtn.classList.toggle('on', on); Snd.click(); };
morePop.addEventListener('click', ()=>setTimeout(closeMore, 0));
addEventListener('pointerdown', e=>{ if (morePop.classList.contains('show') && !morePop.contains(e.target) && e.target!==moreBtn && !moreBtn.contains(e.target)) closeMore(); }, true);
// new buttons (Bike, Sled, Friends) get added to the bar later; sort them into place
const barObs=new MutationObserver(()=>layoutBar());
new MutationObserver(()=>moreDot()).observe(morePop, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
layoutBar();

/* Tool selector */
const toolBtn=$('#toolBtn'), toolPop=$('#toolPop');
const swingBtn=$('#swingBtn'); swingBtn.addEventListener('click', e=>{ e.stopPropagation(); swing(); }); swingBtn.addEventListener('pointerdown', e=>e.stopPropagation());
const HAND_SVG='<svg viewBox="0 0 32 32"><path d="M10 17V8a2 2 0 0 1 4 0v7V6a2 2 0 0 1 4 0v9V8a2 2 0 0 1 4 0v10c0 6-3 10-8 10s-7-3-9-7l-2-4a2 2 0 0 1 3-2l2 3z" fill="#f3c9a5" stroke="#8b6b50" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function updateToolBtn(){ const on=S.equip&&hasTool(S.equip); toolBtn.innerHTML = on ? `<img src="${toolThumb(S.equip,toolTier(S.equip))}">` : HAND_SVG; swingBtn.classList.toggle('show', !!on); }
function cycleTool(){ const owned=['',...Object.keys(TOOLS).filter(hasTool)]; const i=owned.indexOf(S.equip||''); equip(owned[(i+1)%owned.length]||null); Snd.click(); }
toolBtn.addEventListener('click', e=>{ e.stopPropagation(); if(toolPop.classList.contains('show')){ toolPop.classList.remove('show'); return; }
  let h=`<button class="tp${!S.equip?' on':''}" data-t="">${HAND_SVG}<span>Hands</span></button>`;
  for(const t of Object.keys(TOOLS)){ const T=S.tools[t]; if(!T) continue; const d=TOOLS[t].tiers[T.tier]; h+=`<button class="tp${S.equip===t?' on':''}" data-t="${t}"><img src="${toolThumb(t,T.tier)}"><span>${TOOLS[t].name}</span><i style="width:${d.forever?100:Math.max(4,T.uses/d.uses*100)}%"></i></button>`; }
  if (!Object.keys(S.tools).length) h+='<div class="muted" style="padding:6px">No tools yet.</div>';
  h+=`<button class="tp" id="tpMap"><img src="${mapThumb()}"><span>Map</span></button>`;   // v1.26: the map is always on you, like a tool, and takes no bag space
  toolPop.innerHTML=h; toolPop.classList.add('show'); positionToolPop(); Snd.click();
  toolPop.querySelector('#tpMap').onclick=ev=>{ ev.stopPropagation(); toolPop.classList.remove('show'); openMap(); };
  toolPop.querySelectorAll('[data-t]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); equip(b.dataset.t||null); toolPop.classList.remove('show'); Snd.click(); }); });
/* v1.26: the island map. Land, water, paths, every building and whose house is whose. It doesn't show where anyone is. */
let _mapThumb=null;
function mapThumb(){ if (_mapThumb) return _mapThumb; const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d');
  x.translate(32,32); x.rotate(-0.12); x.fillStyle='#ecd9a8'; x.strokeStyle='#8b6b50'; x.lineWidth=2.5; x.beginPath(); x.moveTo(-22,-18); x.lineTo(-7,-22); x.lineTo(8,-18); x.lineTo(23,-22); x.lineTo(23,18); x.lineTo(8,22); x.lineTo(-7,18); x.lineTo(-22,22); x.closePath(); x.fill(); x.stroke();
  x.strokeStyle='rgba(139,107,80,.6)'; x.lineWidth=1.5; x.beginPath(); x.moveTo(-7,-22); x.lineTo(-7,18); x.moveTo(8,-18); x.lineTo(8,22); x.stroke();
  x.fillStyle='#7cbf5a'; x.beginPath(); x.ellipse(0,0,13,10,0.3,0,TAU); x.fill(); x.strokeStyle='#e2483d'; x.lineWidth=2.5; x.beginPath(); x.moveTo(3,-3); x.lineTo(9,3); x.moveTo(9,-3); x.lineTo(3,3); x.stroke();
  return _mapThumb=cv.toDataURL(); }
function mapExtent(){ let m=0; for (let i=0;i<64;i++) m=Math.max(m, islandR(i/64*TAU)); return m*1.12; }
function drawIslandMap(cv){
  const ctx=cv.getContext('2d'), W=cv.width, H=cv.height, E=mapExtent(), k=Math.min(W,H)/(E*2), X=x=>W/2+x*k, Z=z=>H/2+z*k;
  // land and water, sampled from the real terrain
  const N=Math.min(240, W), img=ctx.createImageData(N,N), step=E*2/N;
  for (let j=0;j<N;j++) for (let i=0;i<N;i++){ const x=-E+(i+0.5)*step, z=-E+(j+0.5)*step, h=rawHeight(x,z), o=(j*N+i)*4; let c;
    if (h< -0.15 || (!walkable(x,z) && h<0.2)){ const d=clamp(-h/3,0,1); c=[86-30*d, 186-40*d, 206-30*d]; }
    else if (h<SAND_H+0.08) c=[238,218,166];
    else { const t=clamp((h-SAND_H)/6,0,1); c=[128-40*t, 190-50*t, 98-30*t]; }
    img.data[o]=c[0]; img.data[o+1]=c[1]; img.data[o+2]=c[2]; img.data[o+3]=255; }
  const tmp=document.createElement('canvas'); tmp.width=tmp.height=N; tmp.getContext('2d').putImageData(img,0,0);
  ctx.imageSmoothingEnabled=true; ctx.drawImage(tmp, 0,0,N,N, X(-E),Z(-E),E*2*k,E*2*k);
  // paths and the dock
  ctx.strokeStyle='#e6cf9a'; ctx.lineWidth=Math.max(2,1.6*k); ctx.lineCap='round'; ctx.lineJoin='round';
  for (const P of PATHS){ ctx.beginPath(); P.forEach((q,i)=>i?ctx.lineTo(X(q[0]),Z(q[1])):ctx.moveTo(X(q[0]),Z(q[1]))); ctx.stroke(); }
  ctx.fillStyle='#a87a4e'; ctx.fillRect(X(DOCK.x0), Z(DOCK.z-DOCK.w), Math.max(4,(DOCK.x1-DOCK.x0)*k), DOCK.w*2*k);
  // buildings
  const labels=[];
  const mark=(p, col, name, big)=>{ if (!p) return; const r=big?7:5; ctx.fillStyle=col; ctx.strokeStyle='#5b4336'; ctx.lineWidth=1.6;
    ctx.beginPath(); ctx.moveTo(X(p[0]),Z(p[1])-r); ctx.lineTo(X(p[0])+r,Z(p[1])); ctx.lineTo(X(p[0])+r*0.75,Z(p[1])); ctx.lineTo(X(p[0])+r*0.75,Z(p[1])+r*0.9); ctx.lineTo(X(p[0])-r*0.75,Z(p[1])+r*0.9); ctx.lineTo(X(p[0])-r*0.75,Z(p[1])); ctx.lineTo(X(p[0])-r,Z(p[1])); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (name) labels.push([X(p[0]), Z(p[1])+r+3, name, big]); };
  ctx.fillStyle='#d8bc86'; ctx.beginPath(); ctx.arc(X(0),Z(0),Math.max(6,4.5*k),0,TAU); ctx.fill(); labels.push([X(0),Z(0)+Math.max(6,4.5*k)+3,'Plaza']);
  const B={ museum:['#f2c64a','Museum'], shop:['#f2c64a','General Store'], aquarium:['#7ac0d8','Aquarium'], garden:['#9ad070','Bug & Bloom'], hall:['#e8a060',HALL_NAMES[S.town.hall||0]], portal:['#b8b0c8','Portal Station'], tower:['#a8a0b8','Wizard Tower'] };
  for (const [key,[col,name]] of Object.entries(B)) if (PLACES[key] && (key!=='tower' || S.magic.tower)) mark(PLACES[key], col, name, true);
  if (S.home && S.home.built) mark([LOT.x, LOT.z], '#e2604d', 'Your house', true); else mark([LOT.x, LOT.z], '#e2604d', 'Your tent', true);
  for (const R of RESIDENTS) if (R.home && livesHere(R.id)) mark(R.home, '#ffffff', R.name);
  ctx.font='600 12px Fredoka, sans-serif'; ctx.textAlign='center'; ctx.textBaseline='top';
  for (const [x,y,t,big] of labels){ ctx.font=(big?'700 13px':'600 12px')+' Fredoka, sans-serif'; ctx.lineWidth=3.5; ctx.strokeStyle='rgba(255,250,238,.95)'; ctx.strokeText(t,x,y); ctx.fillStyle='#4a3628'; ctx.fillText(t,x,y); }
  // you are here
  if (!World.inside){ const px=X(player.pos.x), pz=Z(player.pos.z), f=player.face||0; ctx.save(); ctx.translate(px,pz); ctx.rotate(-f+Math.PI);
    ctx.fillStyle='#e2483d'; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(0,-9); ctx.lineTo(7,7); ctx.lineTo(0,3); ctx.lineTo(-7,7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  // compass
  ctx.fillStyle='#5b4336'; ctx.font='700 14px Fredoka, sans-serif'; ctx.textAlign='center'; ctx.fillText('N', W-22, 10); ctx.beginPath(); ctx.moveTo(W-22,28); ctx.lineTo(W-27,40); ctx.lineTo(W-17,40); ctx.closePath(); ctx.fill();
}
function openMap(){
  openPanel(`Map of ${S.island||'the island'}`); Snd.click();
  const w=Math.max(260, Math.min(pBody.clientWidth-8, 620)), cv=document.createElement('canvas'), dpr=Math.min(2, devicePixelRatio||1);
  cv.width=Math.round(w*dpr); cv.height=Math.round(w*dpr); cv.style.width=w+'px'; cv.style.height=w+'px'; cv.style.borderRadius='14px'; cv.style.display='block'; cv.style.margin='0 auto'; cv.style.background='#56bace';
  pBody.appendChild(cv); const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr); cv.width; // keep scale
  const off=document.createElement('canvas'); off.width=w; off.height=w; drawIslandMap(off); ctx.drawImage(off,0,0);
  const note=document.createElement('div'); note.className='muted'; note.style.cssText='margin-top:8px;text-align:center'; note.textContent=World.inside?'You\'re indoors right now.':'The red arrow is you.'; pBody.appendChild(note);
}
addEventListener('pointerdown', e=>{ if(!toolPop.contains(e.target) && e.target!==toolBtn && !toolBtn.contains(e.target)) toolPop.classList.remove('show'); });
function positionToolPop(){ const r=toolBtn.getBoundingClientRect(); const w=Math.min(300, innerWidth-20); toolPop.style.width=w+'px'; toolPop.style.left=clamp(r.left+r.width/2-w/2,10,innerWidth-w-10)+'px'; toolPop.style.top=Math.max(10, r.top-toolPop.offsetHeight-10)+'px'; }

/* Placement: furniture and planting */
let placing=null;
function placementModel(id, mode){
  const it=ITEMS[id];
  if (mode==='furn') return buildItemModel(id);
  const sp=it.plant, P=PLANTS[sp];
  if (P.ptype==='flower') return buildFlower(sp,1); if (P.ptype==='shrub') return buildShrub(sp,0); if (P.ptype==='crop') return buildCrop(P.crop,0);
  return buildTree(mulberry32(1), sp==='fruittree'?'fruittree':sp, { stage:0 });
}
// moving = an already placed Furniture entity (Arrange > Move). Otherwise the item comes out of your bag.
function startPlacing(id, mode, moving){ if (noEdit()) return;
  if (placing) endPlacing();
  const m=placementModel(id, mode); m.traverse(c=>{ if(c.material && !c.userData.outline){ const mm=(Array.isArray(c.material)?c.material:[c.material]).map(x=>{ const y=x.clone(); y.transparent=true; y.opacity=0.65; return y; }); c.material=Array.isArray(c.material)?mm:mm[0]; } });
  let p; if (moving){ p=moving.pos.clone(); moving.obj.visible=false; moving.solid=false; }
  else { p=player.pos.clone().add(new THREE.Vector3(Math.sin(player.face)*1.8,0,Math.cos(player.face)*1.8)); p.y=World.inside?0:groundY(p.x,p.z); }
  const rot = moving ? (moving.rec.rot||0) : 0; m.rotation.y=rot;
  m.position.copy(p); scene.add(m); placing={ id, mode, m, rot, moving }; $('#placeBar').classList.add('show'); $('#pOk').textContent=mode==='plant'?'Plant':'Place'; $('#pNo').textContent='Cancel';
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.62,0.78,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.75, depthWrite:false })); ring.position.y=0.04; m.add(ring); placing.ring=ring;
  checkPlace();
}
/* Fences: they snap end to end with fences already placed, sit right next to each other, turn in 45 degree steps,
   and after each one the next fence is ready at the end of the line until you tap Done. */
const isFence = id => id==='fence';
const fenceAxis = rot => [Math.cos(rot), -Math.sin(rot)];
function snapFence(){ const p=placing.m.position, a=fenceAxis(placing.rot); let best=null, bd=0.65;
  for (const e of ents){ if (!(e instanceof Furniture) || e.removed || !isFence(e.rec.id) || e===placing.moving || !entVisible(e)) continue; const af=fenceAxis(e.rec.rot||0);
    for (const se of [-1,1]){ const ex=e.pos.x+af[0]*0.5*se, ez=e.pos.z+af[1]*0.5*se;
      for (const sg of [-1,1]){ const cx=ex-a[0]*0.5*sg, cz=ez-a[1]*0.5*sg; if (Math.hypot(cx-e.pos.x,cz-e.pos.z)<0.3) continue; const d=Math.hypot(cx-p.x,cz-p.z); if (d<bd){ bd=d; best=[cx,cz]; } } } }
  if (best){ p.set(best[0], World.inside?0:groundY(best[0],best[1]), best[1]); } }
function blockedFence(x,z,self){ if (inRects(x,z,0.3)) return true; for (const e of ents){ if (!e.solid||e.removed||e===self) continue; if (e instanceof Furniture && isFence(e.rec.id)){ if (Math.hypot(x-e.pos.x,z-e.pos.z)<0.3) return true; continue; } if (Math.hypot(x-e.pos.x,z-e.pos.z)<e.r+0.3) return true; } return false; }
function checkPlace(){
  if (placing.mode==='grid') return checkGrid();
  if (placing.mode==='furn' && isFence(placing.id)) snapFence();
  const p=placing.m.position, it=ITEMS[placing.id]; let ok=walkable(p.x,p.z) && Math.hypot(p.x-player.pos.x,p.z-player.pos.z)>0.6 && !onDock(p.x,p.z) && !onBridge(p.x,p.z);
  if (placing.mode==='furn') ok = ok && (isFence(placing.id) ? !blockedFence(p.x,p.z,placing.moving) : !blocked(p.x,p.z,it.r));
  else { const P=PLANTS[it.plant], h=rawHeight(p.x,p.z); ok = ok && p.x<500 && (P.sand ? (h>0.15&&h<SAND_H) : h>SAND_H+0.05) && !blocked(p.x,p.z,P.ptype==='flower'||P.ptype==='crop'?0.3:0.8);
    const gap = P.ptype==='flower'||P.ptype==='crop'?0.55:1.6; ok = ok && !S.plants.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<gap) && !trees.some(t=>!t.removed&&Math.hypot(t.pos.x-p.x,t.pos.z-p.z)<(P.ptype==='tree'?2.2:1.0)); }
  placing.ok=ok; placing.m.traverse(c=>{ for(const mt of (Array.isArray(c.material)?c.material:[c.material])) if(mt&&mt.emissive&&!c.userData.outline) mt.emissive.setHex(ok?0x000000:0x882020); }); if(placing.ring) placing.ring.material.color.setHex(ok?0xffffff:0xe2604d); $('#pOk').disabled=!ok; return ok;
}
function endPlacing(){ const mv=placing.moving; if (mv && !placing.done){ mv.obj.visible=true; mv.solid=!ITEMS[mv.rec.id].flat; } scene.remove(placing.m); placing=null; $('#placeBar').classList.remove('show'); }
const turnBy = a => { if(!placing) return; if (placing.mode==='grid'){ placing.orient^=1; Snd.click(); checkGrid(); return; } if (isFence(placing.id)) a=Math.sign(a)*Math.PI/4; placing.rot=((placing.rot+a)%TAU+TAU)%TAU; placing.m.rotation.y=placing.rot; Snd.click(); checkPlace(); };
$('#pRotL').onclick=()=>turnBy(Math.PI/12); $('#pRotR').onclick=()=>turnBy(-Math.PI/12);
$('#pNo').onclick=()=>{ endPlacing(); Snd.click(); };
$('#pOk').onclick=()=>{ if (placing && placing.mode==='grid'){ plantGrid(); return; } if(!checkPlace()) return; const p=placing.m.position, id=placing.id, it=ITEMS[id];
  if (placing.moving){ const e=placing.moving, rec=e.rec; rec.x=p.x; rec.z=p.z; rec.rot=placing.rot; e.pos.set(p.x, World.inside?0:groundY(p.x,p.z), p.z); e.obj.position.copy(e.pos); e.model.rotation.y=rec.rot; e.obj.visible=true; e.solid=!it.flat; placing.done=true; }
  else if (placing.mode==='furn'){ const rec={ id, x:p.x, z:p.z, rot:placing.rot }; removeItem(id,1); S.placed.push(rec); new Furniture(rec); track('place');
    if (isFence(id) && countItem(id)>0){ const a=fenceAxis(placing.rot), nx=p.x+a[0], nz=p.z+a[1], rot=placing.rot;   // the next fence waits at the end of the line
      puff(p.clone().add(new THREE.Vector3(0,0.3,0)),0xffffff,6,0.5,1.2,0.8,0.5); Snd.pop(); save(); endPlacing();
      startPlacing(id,'furn'); if (placing){ placing.rot=rot; placing.m.rotation.y=rot; placing.m.position.set(nx, World.inside?0:groundY(nx,nz), nz); checkPlace(); $('#pNo').textContent='Done'; } return; } }
  else { const P=PLANTS[it.plant], soft=P.ptype==='flower'||P.ptype==='crop'; if (!soft && !needTool('shovel')) return; if (!soft) useTool('shovel');
    const rec={ id:'p'+Date.now().toString(36)+Math.floor(Math.random()*1e4), sp:it.plant, x:p.x, z:p.z, stage:0, rot:placing.rot, color:(P.colors&&P.colors.length)?P.colors[Math.floor(Math.random()*P.colors.length)]:undefined, lastGrow:today() };
    if (it.kind==='fruit') rec.fruit=id; removeItem(id,1); S.plants.push(rec); track('plant'); if (P.ptype==='tree') onReplant(p.clone()); const pe=P.ptype==='tree' ? new Tree(rec.id,rec.x,rec.z,rec.sp,rec.fruit||(rec.sp==='palm'?'coconut':null),rec) : new Plant(rec); plantEnts.push(pe); FX.sprout(pe); Snd.dig(); toast(`Planted! ${P.ptype==='tree'?'Trees take a few days to grow.':P.ptype==='crop'?`Ready in about ${P.days} days. Water it every day to speed it up.`:'Water it to help it grow.'}`);
    if (P.ptype==='crop' && countItem(id)>0 && !World.inside){ const last=p.clone(), keepId=id, rot=placing.rot; setTimeout(()=>{ if (placing || countItem(keepId)<1) return; startPlacing(keepId,'plant'); if (placing){ placing.m.position.set(last.x+0.9*Math.cos(rot), groundY(last.x+0.9,last.z), last.z-0.9*Math.sin(rot)); checkPlace(); } }, 50); } }
  if (placing.mode==='furn' || placing.moving) puff(p.clone().add(new THREE.Vector3(0,0.3,0)),0xffffff,8,0.6,1.5,1,0.6); Snd.pop(); save(); endPlacing(); };

/* =====================================================================
   v1.8 PLANTING IN ROWS. Pick how many and how long each row is (up to 10 x 10), then drag the patch where you want it.
   Near a garden, the patch snaps up against it (or into its empty squares) so gardens grow neatly.
   ===================================================================== */
const TILE_GEO=new THREE.PlaneGeometry(CELL*0.86, CELL*0.86).rotateX(-Math.PI/2), TILE_MAT=new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, depthWrite:false });
const GREEN=new THREE.Color(0x8fe08a), RED=new THREE.Color(0xe2604d);
function openPlantPanel(id, g){ if (noEdit()) return; const it=ITEMS[id]; const have=countItem(id); if (!have) return;
  let w=Math.min(10, have), n=Math.min(have, 100);
  openPanel('Plant '+it.name);
  pBody.innerHTML=`<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">You have ${have}</div></div></div>
    <label class="f">How many: <b id="gpN"></b></label><input type="range" id="gpNr" min="1" max="${Math.min(have,100)}" value="${n}">
    <label class="f">Row length: <b id="gpW"></b></label><input type="range" id="gpWr" min="1" max="10" value="${w}">
    <div id="gpGrid" style="display:grid;gap:3px;margin:12px auto 4px;width:max-content"></div>`;
  setFoot(`<button class="btn" id="gpGo">Choose a spot</button>`);
  const draw=()=>{ const max=Math.min(have, w*10); if (n>max) n=max; const nr=$('#gpNr'); nr.max=max; nr.value=n; const rows=Math.ceil(n/w);
    $('#gpN').textContent=n; $('#gpW').textContent=`${w} · ${rows} row${rows>1?'s':''}`;
    const gd=$('#gpGrid'); gd.style.gridTemplateColumns=`repeat(${w}, 16px)`; gd.innerHTML=Array.from({length:rows*w},(_,k)=>`<i style="display:block;width:16px;height:16px;border-radius:4px;background:${k<n?'#7a5a3a':'#eadfca'}"></i>`).join(''); };
  $('#gpNr').oninput=e=>{ n=+e.target.value; draw(); }; $('#gpWr').oninput=e=>{ w=+e.target.value; draw(); }; draw();
  $('#gpGo').onclick=()=>{ panelClose=null; closePanel(); startGridPlacing(id, n, w, g); }; }

function startGridPlacing(id, n, w, g){ if (noEdit()) return; if (placing) endPlacing();
  const grp=new THREE.Group(), tiles=new THREE.InstancedMesh(TILE_GEO, TILE_MAT, w*10); tiles.frustumCulled=false; tiles.count=0; grp.add(tiles); scene.add(grp);
  const f=player.face, rows=Math.ceil(n/w), orient = Math.abs(Math.sin(f))>Math.abs(Math.cos(f)) ? 1 : 0;   // rows run across the way you're facing
  const reach=(rows*CELL)/2+1.2; grp.position.set(player.pos.x+Math.sin(f)*reach, 0, player.pos.z+Math.cos(f)*reach);
  if (g && g.cells.length){ const b=gardenBox(g); grp.position.set((b.i0+b.i1)/2*CELL, 0, (b.j0+b.j1)/2*CELL); }
  placing={ id, mode:'grid', m:grp, tiles, n, w, orient, rot:0, cells:[] }; $('#placeBar').classList.add('show'); $('#pNo').textContent='Cancel';
  checkGrid(); }
// cells to plant, in reading order, from an origin square; skips squares that can't take a seed
function gridFill(i0, j0, P, near){ const out=[], bad=[]; const W=P.w;
  for (let r=0;r<10 && out.length<P.n;r++) for (let c=0;c<W && out.length<P.n;c++){ const [i,j] = P.orient ? [i0+r, j0+c] : [i0+c, j0+r]; (cellFree(i,j,near)?out:bad).push([i,j]); }
  return { out, bad }; }
function checkGrid(){ const P=placing, m=P.m, ax=m.position.x, az=m.position.z;
  const rows=Math.ceil(P.n/P.w), EW=P.orient?rows:P.w, EH=P.orient?P.w:rows;   // extent in squares along x and z
  let i0=Math.round(ax/CELL-(EW-1)/2), j0=Math.round(az/CELL-(EH-1)/2);
  // snap: into a nearby garden's empty squares, or flush against one of its sides
  let best=null, bd=1.6+(EW+EH)*CELL*0.25;
  for (const g of S.gardens){ const b=gardenBox(g), cx=(b.i0+b.i1)/2*CELL, cz=(b.j0+b.j1)/2*CELL; if (Math.hypot(cx-ax,cz-az) > 8+(b.i1-b.i0+b.j1-b.j0)*CELL) continue;
    const cand=[[b.i1+1,b.j0],[b.i1+1,b.j1-EH+1],[b.i0-EW,b.j0],[b.i0-EW,b.j1-EH+1],[b.i0,b.j1+1],[b.i1-EW+1,b.j1+1],[b.i0,b.j0-EH],[b.i1-EW+1,b.j0-EH]];
    if (gardenPlants(g).length<g.cells.length) cand.push([b.i0,b.j0]);
    for (const [ci,cj] of cand){ const d=Math.hypot((ci+(EW-1)/2)*CELL-ax, (cj+(EH-1)/2)*CELL-az); if (d<bd){ bd=d; best=[ci,cj]; } } }
  if (best){ [i0,j0]=best; }
  const near=S.plants.filter(q=>q.x>(i0-1)*CELL && q.x<(i0+EW+11)*CELL && q.z>(j0-1)*CELL && q.z<(j0+EH+11)*CELL);
  const { out, bad }=gridFill(i0, j0, P, near); P.cells=out;
  const cx=(i0+(EW-1)/2)*CELL, cz=(j0+(EH-1)/2)*CELL;
  const d=new THREE.Object3D(); let k=0; const put=([i,j],col)=>{ const x=i*CELL, z=j*CELL; d.position.set(x-cx, groundY(x,z)+0.09, z-cz); d.updateMatrix(); P.tiles.setMatrixAt(k,d.matrix); P.tiles.setColorAt(k,col); k++; };
  out.forEach(c=>put(c,GREEN)); bad.slice(0, P.tiles.instanceMatrix.count-out.length).forEach(c=>put(c,RED)); P.tiles.count=k; P.tiles.instanceMatrix.needsUpdate=true; if (P.tiles.instanceColor) P.tiles.instanceColor.needsUpdate=true;
  m.position.set(cx, 0, cz);
  P.ok=out.length>0; $('#pOk').disabled=!P.ok; $('#pOk').textContent=out.length?`Plant ${out.length}`:'No room'; return P.ok; }
function plantGrid(){ const P=placing; if (!checkGrid()) return; const id=P.id, it=ITEMS[id], PL=PLANTS[it.plant], n=Math.min(P.cells.length, countItem(id)); if (n<1){ endPlacing(); return; }
  const cells=P.cells.slice(0,n), made=[], base=Date.now().toString(36);
  cells.forEach(([i,j],k)=>{ const rec={ id:'p'+base+k.toString(36)+Math.floor(Math.random()*1e3), sp:it.plant, x:i*CELL, z:j*CELL, stage:0, rot:(PL.ptype==='crop'?(Math.random()-0.5)*0.5:Math.random()*TAU), color:(PL.colors&&PL.colors.length)?PL.colors[Math.floor(Math.random()*PL.colors.length)]:undefined, lastGrow:today() };
    S.plants.push(rec); track('plant'); const pe=new Plant(rec); plantEnts.push(pe); made.push(pe); pe.obj.scale.setScalar(0.001); });
  // pop up row by row
  let t=0; FX.add(dt=>{ t+=dt; let busy=false; made.forEach((pe,k)=>{ if (pe.removed) return; const q=Math.max(0,(t-k*0.015)/0.3); if (q<1) busy=true; pe.obj.scale.setScalar(q>=1?1:Math.max(0.001,easeOut(q)*(1+Math.sin(q*Math.PI)*0.25))); }); return busy; });
  if (made[0]) FX.hole(made[0].pos, 0.32, 1.1);
  removeItem(id, n); const g=addToGarden(cells); if (g.fence) g.fenced=[...new Set([...(g.fenced||[])])]; rebuildGardens();
  Snd.dig(); toast(`Planted ${n} ${it.name.replace(/ (Seeds|Starts)$/,'').toLowerCase()}${PL.ptype==='crop'?`. Ready in about ${PL.days} days`:''}.`, thumb(id));
  save(); endPlacing(); }

/* ---------- The garden menu (tap the garden's stake or sign) ---------- */
function openGarden(g){
  const render=()=>{ if (!S.gardens.includes(g)){ closePanel(); return; }
    const plants=gardenPlants(g), ripe=plants.filter(isRipe), dry=plants.filter(p=>p.stage<3 && p.watered!==today()), per=perimeter(g), fenced=new Set(g.fenced||[]);
    const sides=per.filter(e=>e.key!==g.gate), gaps=sides.filter(e=>!fenced.has(e.key)), seedStacks=[...new Set(S.inv.filter(x=>ITEMS[x.id].kind==='seed').map(x=>x.id))];
    let h=`<div class="muted" style="margin-bottom:8px">${g.cells.length} square${g.cells.length>1?'s':''} · ${plants.length} planted · ${ripe.length} ready</div>`;
    h+=`<div class="row"><div class="grow"><div class="nm">Harvest everything ready</div><div class="sub">${ripe.length ? `${ripe.length} plant${ripe.length>1?'s':''}` : 'Nothing is ready yet'}</div></div><button class="btn" id="gHv" ${ripe.length?'':'disabled'}>Harvest</button></div>`;
    h+=`<div class="row"><div class="grow"><div class="nm">Water everything</div><div class="sub">${!hasTool('can') ? 'Needs a watering can' : dry.length ? `${dry.length} plant${dry.length>1?'s':''} need water` : 'All watered today'}</div></div><button class="btn" id="gWa" ${hasTool('can')&&dry.length&&CAN_EDIT?'':'disabled'}>Water</button></div>`;
    if (CAN_EDIT){
      h+=`<div class="f" style="margin-top:12px;font-weight:700">Plant here</div>`;
      h+= seedStacks.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${seedStacks.map(id=>`<button class="btn alt" data-gs="${id}" style="display:flex;align-items:center;gap:6px;padding:4px 10px"><img src="${thumb(id)}" style="width:28px;height:28px">${ITEMS[id].name} x${countItem(id)}</button>`).join('')}</div>` : `<div class="muted">No seeds in your bag.</div>`;
      h+=`<div class="f" style="margin-top:14px;font-weight:700">Fence</div>`;
      if (g.fence && gaps.length) h+=`<div class="row"><div class="grow"><div class="nm">Close the gaps</div><div class="sub">${gaps.length} piece${gaps.length>1?'s':''} of ${GARDEN_FENCES[g.fence].name.toLowerCase()} · ${fmt(gaps.length*GARDEN_FENCES[g.fence].per)} clams</div></div><button class="btn" id="gGap" ${S.clams<gaps.length*GARDEN_FENCES[g.fence].per?'disabled':''}>Build</button></div>`;
      for (const [st,F] of Object.entries(GARDEN_FENCES)){ const cost=sides.length*F.per, cur=g.fence===st;
        h+=`<div class="row"><div class="grow"><div class="nm">${F.name}${cur?' <span class="muted">(yours)</span>':''}</div><div class="sub">${fmt(F.per)} clams a piece · ${sides.length} pieces · ${fmt(cost)} clams</div></div>${cur?'':`<button class="btn" data-gf="${st}" ${S.clams<cost?'disabled':''}>${g.fence?'Switch':'Build'}</button>`}</div>`; }
      h+=`<div class="row"><div class="grow"><div class="nm">Move the gate</div><div class="sub">To the side nearest where you're standing. Free.</div></div><button class="btn alt" id="gGate">Move</button></div>`;
      h+=`<div class="f" style="margin-top:14px;font-weight:700">Decorations</div>`;
      for (const [k,Dc] of Object.entries(GARDEN_DECOR)){ const own=g.decor&&g.decor[k], on=own&&own!=='off';
        h+=`<div class="row"><div class="grow"><div class="nm">${Dc.name}</div><div class="sub">${Dc.blurb}${own?'':` · ${fmt(Dc.price)} clams`}</div></div>${own?`<button class="btn alt" data-gd="${k}">${on?'Put away':'Put out'}</button>`:`<button class="btn" data-gd="${k}" ${S.clams<Dc.price?'disabled':''}>Buy</button>`}</div>`; }
      if (!plants.length) h+=`<div class="row" style="margin-top:12px"><div class="grow"><div class="nm">Take out this garden</div><div class="sub">The grass grows back. Fences and decorations aren't refunded.</div></div><button class="btn warn" id="gDel">Take out</button></div>`;
    }
    pBody.innerHTML=h; setFoot('');
    const pay=(n)=>{ if (S.clams<n){ toast('Not enough clams.'); Snd.fail(); return false; } S.clams-=n; Snd.coin(); updateHUD(); return true; };
    const on=(sel,fn)=>{ const b=pBody.querySelector(sel); if (b) b.onclick=fn; };
    on('#gHv', ()=>{ let n=0, seeds=0, kinds={}, full=false, isNew=false; for (const p of ripe){ const P=PLANTS[p.sp];
        if (P.ptype==='flower'){ const r=addItem(p.sp); if (!r){ full=true; break; } if (r==='new') isNew=true; p.stage=2; const e=plantEntOf(p); if (e) e.rebuild(); n++; continue; }
        const r=harvestRec(p, true); if (!r){ full=true; break; } n+=r.n; seeds+=r.seeds; if (r.isNew) isNew=true; kinds[P.crop]=(kinds[P.crop]||0)+r.n; }
      if (n){ Snd.pop(); if (isNew) Snd.fanfare(); for (const p of ripe.slice(0,12)) puff(new THREE.Vector3(p.x,groundY(p.x,p.z)+0.3,p.z),0x7cc35a,4,0.4,1.4,0.6,0.5);
        const what=Object.entries(kinds).map(([c,k])=>`${k} ${cropWord(CROPS[c],k)}`).join(', ')||`${n} flowers`; toast(`Harvested ${what}${seeds?` and ${seeds} seeds`:''}.${full?' Your bag filled up, so some are still growing.':''}`, ripe[0]?thumb(PLANTS[ripe[0].sp].crop||ripe[0].sp):null); }
      else if (full) toast('Your bag is full.'); save(); rebuildGardens(); render(); });
    on('#gWa', ()=>{ if (noEdit() || !needTool('can')) return; let n=0; for (const p of dry){ if (!S.tools.can) break; p.watered=today(); S.stats.watered++; track('water'); useTool('can'); n++; }
      Snd.water(); for (const p of dry.slice(0,16)) puff(new THREE.Vector3(p.x,groundY(p.x,p.z)+0.8,p.z),0x7fc8f0,2,0.2,-1,0.4,0.5); toast(`Watered ${n} plant${n>1?'s':''}. They'll grow faster tomorrow.`); save(); render(); });
    pBody.querySelectorAll('[data-gs]').forEach(b=>b.onclick=()=>{ panelClose=null; closePanel(); openPlantPanel(b.dataset.gs, g); });
    on('#gGap', ()=>{ if (!pay(gaps.length*GARDEN_FENCES[g.fence].per)) return; g.fenced=[...new Set([...(g.fenced||[]), ...gaps.map(e=>e.key)])]; rebuildGardens(); save(); render(); });
    pBody.querySelectorAll('[data-gf]').forEach(b=>b.onclick=()=>{ const st=b.dataset.gf; if (!pay(sides.length*GARDEN_FENCES[st].per)) return; g.fence=st; g.fenced=sides.map(e=>e.key); rebuildGardens(); save(); toast(`${GARDEN_FENCES[st].name} it is.`); render(); });
    on('#gGate', ()=>{ const e=nearestSide(g, player.pos.x, player.pos.z); if (!e) return; const old=g.gate; g.gate=e.key; if (g.fence && old && !(g.fenced||[]).includes(old)) g.fenced=[...(g.fenced||[]), old]; Snd.click(); rebuildGardens(); save(); render(); });
    pBody.querySelectorAll('[data-gd]').forEach(b=>b.onclick=()=>{ const k=b.dataset.gd; g.decor=g.decor||{}; if (g.decor[k]) g.decor[k] = g.decor[k]==='off' ? true : 'off'; else { if (!pay(GARDEN_DECOR[k].price)) return; g.decor[k]=true; } Snd.pop(); rebuildGardens(); save(); render(); });
    on('#gDel', ()=>{ if (gardenPlants(g).length) return; S.gardens.splice(S.gardens.indexOf(g),1); rebuildGardens(); save(); closePanel(); toast('The garden is gone. The grass will grow back.'); });
  };
  openPanel('Garden'); render(); }

/* ---------- Input ---------- */
const keys={};
addEventListener('keydown', e=>{ if(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA') return; const k=e.key.toLowerCase();
  if (dlgState){ if (!e.repeat && dialogKey(k)) e.preventDefault(); return; }
  if (tankView || tankZoom){ if (tankView && !e.repeat && (k==='escape'||k===KB().bag||k===KB().act||k==='enter'||k===' ')){ e.preventDefault(); closeTankView(); } return; }
  if (keyCapture){ e.preventDefault(); keyCapture(k); return; }
  keys[k]=true; if (e.repeat) return; const kb=KB();
  if (k===(kb.swing||' ')){ e.preventDefault(); swing(); return; }
  if (k===kb.act||k==='enter'){ e.preventDefault(); doAction(); return; }
  if (scrim.classList.contains('show')){ if (k===kb.bag && !menuOpen) closePanel(); return; }
  if (k===kb.tool) cycleTool(); else if (k===kb.bike) toggleBike(); else if (k===kb.sled) toggleSled(); else if (k===kb.bag && !buildMode && !placing) openBag(); });
let keyCapture=null;   // set while Menu > Controls waits for you to press a new key
addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(), plane0=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function entVisible(e){ if (World.inside){ const R=ROOMS[World.inside]; return e.pos.x>500 && roomAt(e.pos.x,e.pos.z)===R; } return e.pos.x<500 && e.obj.parent===OUT; }
function pickAt(cx,cy){
  const rect=canvas.getBoundingClientRect(); ndc.set((cx-rect.left)/rect.width*2-1, -(cy-rect.top)/rect.height*2+1); ray.setFromCamera(ndc,camera);
  const cand=pickList.filter(o=>{ const e=o.userData.ent; return e && !e.removed && entVisible(e) && e.pos.distanceTo(camTarget)<40; });
  const hits=ray.intersectObjects(cand,true); const g=rayGround(ray.ray);
  for (const h of hits){ if(h.object.userData.outline && hits.length>1) continue; let o=h.object; while(o && !o.userData.ent) o=o.parent; if(o){ const dg = g ? g.distanceTo(ray.ray.origin) : 1e9; if (h.distance < dg+0.8) return { ent:o.userData.ent, point:h.point }; } break; }
  if (g && (World.inside || g.y>-0.05)) return { ground:g };
  const wp=new THREE.Vector3(); if (!World.inside && ray.ray.intersectPlane(plane0,wp)) return { water:wp };
  return null;
}
function stopMove(){ player.target=null; player.targetEnt=null; player.cb=null; player.path=null; marker.visible=false; }
function goTo(point, ent, cb){ player.target=point.clone(); player.targetEnt=ent||null; player.cb=cb||null; player.stuck=0; player.repathed=false; player.repathT=0; planPath();
  if(!ent){ marker.position.set(point.x,(World.inside?0:groundY(point.x,point.z))+0.06,point.z); marker.visible=true; } else marker.visible=false; }

/* ---------- Path finding for tap-to-walk ----------
   A* on a 0.45 m grid around you and the target, so you walk around trees, rocks, houses and furniture
   instead of pushing into them. The path is then straightened so it doesn't zig-zag. */
const PCELL=0.45, PR=0.37;
function planPath(){ const t=player.target, e=player.targetEnt; if(!t) return;
  const goalR = e ? Math.max(0.35, e.reach-0.3) : 0.3;
  player.path = findPath(player.pos.x, player.pos.z, t.x, t.z, goalR, e); player.pathI=0; player.pathFor=t.clone(); }
function findPath(sx,sz,gx,gz,goalR,ent){
  const pad=7, x0=Math.min(sx,gx)-pad, z0=Math.min(sz,gz)-pad, x1=Math.max(sx,gx)+pad, z1=Math.max(sz,gz)+pad;
  const W=Math.ceil((x1-x0)/PCELL), H=Math.ceil((z1-z0)/PCELL); if (W*H>70000) return null;
  const sol=ents.filter(e=>e.solid && !e.removed && e.pos.x>x0-4 && e.pos.x<x1+4 && e.pos.z>z0-4 && e.pos.z<z1+4 && !(e instanceof Resident) && e!==ent);
  if (ent && ent.solid) sol.push(ent);
  const st=new Uint8Array(W*H); const cx=i=>x0+(i+0.5)*PCELL, cz=j=>z0+(j+0.5)*PCELL;
  const free=(i,j)=>{ if(i<0||j<0||i>=W||j>=H) return false; const k=j*W+i; if(!st[k]){ const x=cx(i), z=cz(j); let ok=walkable(x,z) && !inRects(x,z,PR);
      if(ok) for(const e of sol){ const dx=x-e.pos.x, dz=z-e.pos.z; const rr=e.r+PR; if(dx*dx+dz*dz<rr*rr){ ok=false; break; } } st[k]=ok?1:2; } return st[k]===1; };
  const si=clamp(Math.floor((sx-x0)/PCELL),0,W-1), sj=clamp(Math.floor((sz-z0)/PCELL),0,H-1); st[sj*W+si]=1;
  let gr=goalR; const gi=Math.floor((gx-x0)/PCELL), gj=Math.floor((gz-z0)/PCELL); if (!ent && !free(gi,gj)) gr=1.3;
  const hd=(i,j)=>Math.max(0, Math.hypot(cx(i)-gx, cz(j)-gz)-gr);
  const g=new Float32Array(W*H).fill(1e9), from=new Int32Array(W*H).fill(-1), closed=new Uint8Array(W*H);
  const heap=[]; const push=(k,f)=>{ heap.push([f,k]); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let i=0; for(;;){ const l=i*2+1, r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return top; };
  const s0=sj*W+si; g[s0]=0; push(s0,hd(si,sj)); let goal=-1, n=0;
  const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while (heap.length && n++<14000){ const [,k]=pop(); if(closed[k]) continue; closed[k]=1; const i=k%W, j=(k-i)/W;
    if (hd(i,j)<=0 && (k===s0 || free(i,j))){ goal=k; break; }
    for (const [di,dj,c] of NB){ const ni=i+di, nj=j+dj; if(!free(ni,nj)) continue; if(di&&dj && (!free(i+di,j)||!free(i,j+dj))) continue; const nk=nj*W+ni; if(closed[nk]) continue; const ng=g[k]+c*PCELL; if(ng<g[nk]){ g[nk]=ng; from[nk]=k; push(nk, ng+hd(ni,nj)); } } }
  if (goal<0) return null;
  const pts=[]; for(let k=goal;k>=0;k=from[k]){ const i=k%W, j=(k-i)/W; pts.push([cx(i),cz(j)]); } pts.reverse(); pts[0]=[sx,sz];
  if (!ent && gr<1) pts[pts.length-1]=[gx,gz];
  // straighten: keep only the waypoints needed to stay clear
  const clear=(a,b)=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]), n=Math.ceil(L/0.18); for(let s=1;s<n;s++){ const x=a[0]+(b[0]-a[0])*s/n, z=a[1]+(b[1]-a[1])*s/n; if(!free(Math.floor((x-x0)/PCELL), Math.floor((z-z0)/PCELL))) return false; } return true; };
  const out=[]; let a=0; while (a<pts.length-1){ let b=pts.length-1; while (b>a+1 && !clear(pts[a],pts[b])) b--; out.push(pts[b]); a=b; }
  return out;
}
function handleTap(cx,cy){
  if (cine) return;
  if (magicMode){ magicTap(cx,cy); return; }
  if (buildMode) return;
  if (CatchMeter.bug){ resolveSwing(); return; }
  if (Fishing.state!=='idle'){ reel(); return; }
  const p=pickAt(cx,cy); if(!p) return;
  if (placing){ if (placing.dragged) return; const pt=p.ground||p.point||p.water; if(pt){ placing.m.position.set(pt.x,World.inside?0:groundY(pt.x,pt.z),pt.z); checkPlace(); } return; }
  // On a computer, clicking walks you there (v1.19, on by default, Menu > Controls). With it off, clicking only uses
  // things that are close enough and you walk with the keys.
  if (!isTouchDevice && CT().clickWalk===false){
    if (p.ent){ const e=p.ent, d=Math.hypot(e.pos.x-player.pos.x, e.pos.z-player.pos.z); if (d<=e.reach+0.6){ stopMove(); interact(e); } else farClickHint(); return; }
    if (p.water){ const w=p.water; if(!isFishWater(w.x,w.z)) return; if(!hasTool('rod')){ toast('Needs a fishing rod.'); Snd.fail(); return; }
      if (Math.hypot(w.x-player.pos.x, w.z-player.pos.z)<8){ const tgt=w.clone(); castAt(tgt); } else farClickHint(); }
    return; }
  if (p.ent){ const e=p.ent; goTo(e.pos, e, ()=>interact(e)); return; }
  if (p.ground){ if(CT().move==='joystick' && !CT().tapWalk) return; goTo(p.ground); return; }
  if (p.water){ const w=p.water; if(!isFishWater(w.x,w.z)) return; if(!hasTool('rod')){ toast('Needs a fishing rod.'); Snd.fail(); return; }
    const dir=player.pos.clone().sub(w); dir.y=0; const L=dir.length(); dir.normalize(); let sp=null;
    for(let d=0; d<L; d+=0.25){ const x=w.x+dir.x*d, z=w.z+dir.z*d; if(walkable(x,z)){ sp=new THREE.Vector3(x+dir.x*0.4,0,z+dir.z*0.4); break; } }
    if(!sp) return; const tgt=w.clone(); if(tgt.distanceTo(sp)>7) tgt.copy(sp).addScaledVector(dir,-6);
    goTo(sp, null, ()=>castAt(tgt)); marker.visible=false; }
}
function farClickHint(){}
function interact(e, mode='tap'){ if(!ents.includes(e)) return; if (e.rag) return; player.face=Math.atan2(e.pos.x-player.pos.x, e.pos.z-player.pos.z); if(!(e instanceof Bug)) player.act=0.35; hideHint(); e.act(mode); }
function nearestEnt(){ let best=null, bd=1e9; for(const e of ents){ if(e.removed||!e.label()) continue; const d=Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z); if(d<e.reach+0.3 && d<bd && entVisible(e)){ bd=d; best=e; } } return best; }
function facingWater(){ if(World.inside) return null; for(const d of [2.5,3.5,4.5]){ const x=player.pos.x+Math.sin(player.face)*d, z=player.pos.z+Math.cos(player.face)*d; if(isFishWater(x,z)) return new THREE.Vector3(x,0,z); } return null; }
function doAction(){ if(cine||dlgState||scrim.classList.contains('show')||placing||layoutMode||buildMode||magicMode) return; if(riding) setRiding(false); if (sledding){ setSled(false); return; } if(CatchMeter.bug){ resolveSwing(); return; } if(Fishing.state!=='idle'){ reel(); return; } if (knockedDown()) return; const e=nearestEnt(); if(e){ stopMove(); interact(e,'manual'); return; } const w=facingWater(); if(w){ castAt(w); hideHint(); } }
$('#act').addEventListener('click', e=>{ e.stopPropagation(); if(layoutMode) return; doAction(); });
let hintHidden=false; function hideHint(){ if(hintHidden) return; hintHidden=true; $('#hint').style.opacity=0; }

/* Joystick (Menu > Controls). Position can be dragged anywhere in layout mode. */
const CT = () => S.settings.controls;
const joy={ x:0, y:0, active:false, id:null, cx:0, cy:0, sx:0, sy:0, t:0 };
const joyZone=$('#joyZone'), joyBase=$('#joyBase'), joyKnob=$('#joyKnob'), actBtn=$('#act');
let layoutMode=false;
function joyCenter(){ const c=CT(); return [ c.jx!=null ? c.jx*innerWidth : 26+c.size/2, c.jy!=null ? c.jy*innerHeight : innerHeight-26-c.size/2 ]; }
function actCenter(){ const c=CT(); return [ c.ax!=null ? c.ax*innerWidth : innerWidth-72, c.ay!=null ? c.ay*innerHeight : innerHeight-78 ]; }
function applyControls(){
  const c=CT(), on=c.move==='joystick'||layoutMode;
  joyZone.style.display = on ? '' : 'none';
  const [ax,ay]=actCenter(); actBtn.style.left=(ax-48)+'px'; actBtn.style.top=(ay-48)+'px'; actBtn.style.right='auto'; actBtn.style.bottom='auto';
  toolBtn.style.left=(clamp(ax-48-62, 8, innerWidth-60))+'px'; toolBtn.style.top=(ay-48-34)+'px';
  if (ay-48-34 < 120){ toolBtn.style.top=(ay+52)+'px'; }
  swingBtn.style.left=(clamp(ax-36, 8, innerWidth-80))+'px'; swingBtn.style.top=(ay-48-84)+'px'; if (ay-48-84 < 120) swingBtn.style.top=(ay+56)+'px';
  $('#hint').textContent = c.move==='keys' ? `WASD${c.clickWalk!==false?' or click':''} to walk, drag to look around. ${KB().act.toUpperCase()} to use or talk, ${keyName(KB().swing||' ')} to swing.` : c.move==='joystick' ? (c.tapWalk?'Use the joystick or tap to walk. Tap things to interact.':'Use the joystick to walk. Tap things to interact.') : 'Tap to walk, hold to keep walking. Tap things to interact.';
  if (!on) return;
  const s=c.size;
  if (c.floating && !layoutMode){ Object.assign(joyZone.style,{ left:'0', top:'45%', width:'50%', height:'55%' }); joyBase.style.opacity = joy.active?c.opacity:0; }
  else { const [jx,jy]=joyCenter(), z=s+36; Object.assign(joyZone.style,{ left:(jx-z/2)+'px', top:(jy-z/2)+'px', width:z+'px', height:z+'px' }); joyBase.style.opacity = layoutMode?Math.max(0.6,c.opacity):c.opacity; }
  Object.assign(joyBase.style,{ width:s+'px', height:s+'px' }); if(!joy.active) centerBase();
}
function centerBase(){ const c=CT(); if (c.floating && !layoutMode){ const [jx,jy]=joyCenter(); const r=joyZone.getBoundingClientRect(); joyBase.style.left=(clamp(jx,0,r.width)-r.left+r.left)+'px'; joyBase.style.top=(jy-r.top)+'px'; } else { joyBase.style.left='50%'; joyBase.style.top='50%'; } joyKnob.style.left='50%'; joyKnob.style.top='50%'; }
function moveJoy(e){ const R=CT().size/2; let dx=e.clientX-joy.cx, dy=e.clientY-joy.cy; const L=Math.hypot(dx,dy); if(L>R){ dx*=R/L; dy*=R/L; } joy.x=dx/R; joy.y=dy/R; joyKnob.style.left=`calc(50% + ${dx}px)`; joyKnob.style.top=`calc(50% + ${dy}px)`; }
let drag=null;
joyZone.addEventListener('pointerdown', e=>{ e.preventDefault(); e.stopPropagation(); joyZone.setPointerCapture(e.pointerId);
  if (layoutMode){ drag={ el:'joy', id:e.pointerId }; return; }
  if (joy.active) return; const c=CT(), r=joyZone.getBoundingClientRect();
  joy.active=true; joy.id=e.pointerId; joy.sx=e.clientX; joy.sy=e.clientY; joy.t=performance.now();
  if (c.floating){ joy.cx=e.clientX; joy.cy=e.clientY; joyBase.style.left=(e.clientX-r.left)+'px'; joyBase.style.top=(e.clientY-r.top)+'px'; joyBase.style.opacity=c.opacity; }
  else { const b=joyBase.getBoundingClientRect(); joy.cx=b.left+b.width/2; joy.cy=b.top+b.height/2; }
  moveJoy(e); });
joyZone.addEventListener('pointermove', e=>{ if(drag&&drag.el==='joy'){ const c=CT(); c.jx=clamp(e.clientX/innerWidth,0.05,0.95); c.jy=clamp(e.clientY/innerHeight,0.15,0.97); applyControls(); return; } if(joy.active && e.pointerId===joy.id) moveJoy(e); });
function endJoy(e){ if(drag){ drag=null; save(); return; } if(!joy.active || e.pointerId!==joy.id) return; const quick = performance.now()-joy.t<280 && Math.hypot(e.clientX-joy.sx,e.clientY-joy.sy)<12;
  joy.active=false; joy.x=joy.y=0; centerBase(); if(CT().floating) joyBase.style.opacity=0; if (quick && CT().floating && !dlgState && !scrim.classList.contains('show')) handleTap(e.clientX, e.clientY); }
joyZone.addEventListener('pointerup', endJoy); joyZone.addEventListener('pointercancel', endJoy);
actBtn.addEventListener('pointerdown', e=>{ if(!layoutMode) return; e.preventDefault(); actBtn.setPointerCapture(e.pointerId); drag={ el:'act' }; });
actBtn.addEventListener('pointermove', e=>{ if(!drag||drag.el!=='act') return; const c=CT(); c.ax=clamp(e.clientX/innerWidth,0.08,0.92); c.ay=clamp(e.clientY/innerHeight,0.2,0.95); applyControls(); });
actBtn.addEventListener('pointerup', ()=>{ if(drag){ drag=null; save(); } });
function startLayout(){ layoutMode=true; $('#hud').classList.add('layout'); $('#layoutBar').classList.add('show'); actBtn.textContent='Action'; actBtn.classList.add('show'); applyControls(); }
function endLayout(){ layoutMode=false; $('#hud').classList.remove('layout'); $('#layoutBar').classList.remove('show'); actLabel='~'; save(); applyControls(); }
$('#lDone').onclick=()=>{ endLayout(); Snd.click(); };
$('#lReset').onclick=()=>{ const c=CT(); c.jx=c.jy=c.ax=c.ay=null; save(); applyControls(); Snd.click(); };
addEventListener('resize', ()=>applyControls());
/* Phones: no page zoom, no text selection, no long-press menus. The game handles pinch itself on the island. */
for (const ev of ['gesturestart','gesturechange','gestureend']) document.addEventListener(ev, e=>e.preventDefault(), { passive:false });
document.addEventListener('touchmove', e=>{ if (e.touches.length>1 || (e.scale && e.scale!==1)) e.preventDefault(); }, { passive:false });
document.addEventListener('selectstart', e=>{ if (!e.target.closest || !e.target.closest('input,textarea')) e.preventDefault(); });
document.addEventListener('contextmenu', e=>{ if (!e.target.closest || !e.target.closest('input,textarea')) e.preventDefault(); });
document.addEventListener('dblclick', e=>e.preventDefault(), { passive:false });
let lastTouchEnd=0;
document.addEventListener('touchend', e=>{ const n=Date.now(), quick=n-lastTouchEnd<320; lastTouchEnd=n;
  // a quick second tap on the open game (not a button or field) would zoom the page on iOS
  if (quick && e.target && e.target.closest && !e.target.closest('button,input,select,textarea,label,a,.slot,.chip,.sw,.tab,.row,#dlgBox,.layoutCard,.tp,#bp')) e.preventDefault(); }, { passive:false });
/* Turning the phone: the browser reports the new size a beat late on some phones, so lay everything out again a few times */
function relayout(){ try{ window.scrollTo(0,0); document.documentElement.scrollTop=0; }catch(e){} resize(); applyControls(); layoutBar(); if (toolPop.classList.contains('show')) positionToolPop(); if (buildMode && buildMode.tab!=='ext') renderBuild(true); }
function relayoutSoon(){ for (const ms of [60,250,600,1200]) setTimeout(relayout, ms); }
addEventListener('orientationchange', relayoutSoon);
if (window.visualViewport) visualViewport.addEventListener('resize', relayoutSoon);
if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', relayoutSoon);

// Canvas pointer: tap, hold-to-walk, pinch-zoom, wheel-zoom
const ptrs=new Map(); let camDist=isMobile?21:22, pinch0=0, dist0=0;
// Camera turning: right-drag (mouse), two-finger twist (touch), or Z / C keys. Free indoors; outdoors a small swing that eases back.
let camYaw=0, camYawHeld=false, rotPtr=null, twist0=0, yaw0=0;
const CAM_OUT_SWING=0.45;
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('pointerdown', e=>{ if(e.button===2 && !buildMode){ rotPtr={ id:e.pointerId, x:e.clientX }; e.stopImmediatePropagation(); } }, true);
addEventListener('pointermove', e=>{ if(rotPtr && e.pointerId===rotPtr.id){ camYaw-=(e.clientX-rotPtr.x)*0.008; rotPtr.x=e.clientX; } });
addEventListener('pointerup', e=>{ if(rotPtr && e.pointerId===rotPtr.id) rotPtr=null; });
function groundAtScreen(cx,cy){ const rect=canvas.getBoundingClientRect(); ndc.set((cx-rect.left)/rect.width*2-1, -(cy-rect.top)/rect.height*2+1); ray.setFromCamera(ndc,camera); return rayGround(ray.ray); }
canvas.addEventListener('pointerdown', e=>{ canvas.focus(); ptrs.set(e.pointerId,{ x:e.clientX, y:e.clientY, t:performance.now(), sx:e.clientX, sy:e.clientY, held:false }); if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch0=Math.hypot(a.x-b.x,a.y-b.y); dist0=camDist; twist0=Math.atan2(b.y-a.y,b.x-a.x); yaw0=camYaw; if(placing) placing.drag=null; }
  if (buildMode && ptrs.size===1 && buildMode.brush && buildMode.view==='out'){ buildMode.stroke=new Set(); mossPaintAt(e.clientX,e.clientY); }
  if (buildMode && ptrs.size===2){ const [a,b]=[...ptrs.values()]; buildMode.mid=[(a.x+b.x)/2,(a.y+b.y)/2]; buildMode.stroke=null; }
  if (placing && ptrs.size===1 && !dlgState){ const g=groundAtScreen(e.clientX,e.clientY); if(g){ const m=placing.m.position; const near=Math.hypot(g.x-m.x,g.z-m.z)<2.2; placing.drag={ id:e.pointerId, ox:near?m.x-g.x:0, oz:near?m.z-g.z:0 }; placing.dragged=false; } } });
canvas.addEventListener('pointermove', e=>{ const p=ptrs.get(e.pointerId); if(!p) return; const px=p.x; p.x=e.clientX; p.y=e.clientY; if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const pd=Math.hypot(a.x-b.x,a.y-b.y); if(buildMode){ const B=buildMode; if(p.pd) B.dist=clamp(B.dist*p.pd/pd,6,140); p.pd=pd; const mid=[(a.x+b.x)/2,(a.y+b.y)/2]; if (B.mid) buildPan(mid[0]-B.mid[0], mid[1]-B.mid[1]); B.mid=mid; } else if(magicMode){ if(p.pd) magicMode.dist=clamp(magicMode.dist*p.pd/pd,14,60); p.pd=pd; } else { camDist=clamp(dist0*pinch0/pd,11,36); let da=Math.atan2(b.y-a.y,b.x-a.x)-twist0; da=Math.atan2(Math.sin(da),Math.cos(da)); camYaw=yaw0-da; } return; }
  if (buildMode && ptrs.size===1){ const B=buildMode, py=p.py??p.sy; p.py=e.clientY;
    if (B.brush && B.view==='out') mossPaintAt(e.clientX,e.clientY);
    else if (B.view==='out'){ B.yaw -= (e.clientX-px)*0.008; B.pitch=clamp(B.pitch+(e.clientY-py)*0.004,0.12,1.4); }
    else buildPan(e.clientX-px, e.clientY-py);
    p.held=true; return; }
  if (magicMode && ptrs.size===1){ const py=p.py??p.sy; p.py=e.clientY; if (Math.hypot(p.x-p.sx,p.y-p.sy)>8){
      // moving a building: drag the ghost if you grabbed it, otherwise look around
      if (p.mg===undefined){ const g0=groundAtScreen(p.sx,p.sy), M=magicMode; p.mg = M.kind==='move' && g0 && M.at && Math.hypot(g0.x-M.at[0], g0.z-M.at[1]) < footOf(M.key)+1.5; }
      if (p.mg){ const g=groundAtScreen(e.clientX,e.clientY); if(g) magicPlace(g.x,g.z); } else magicPan(e.clientX-px, e.clientY-py); p.held=true; } return; }
  if (e.pointerType==='mouse' && ptrs.size===1 && !(placing && placing.drag) && Math.hypot(p.x-p.sx,p.y-p.sy)>5){ camYaw-=(e.clientX-px)*0.008; lookDragT=performance.now(); p.held=true; return; }   // computer: drag to look around
  if (placing && placing.drag && placing.drag.id===e.pointerId && Math.hypot(p.x-p.sx,p.y-p.sy)>4){ const g=groundAtScreen(e.clientX,e.clientY); if(g){ const x=g.x+placing.drag.ox, z=g.z+placing.drag.oz; placing.m.position.set(x, World.inside?0:groundY(x,z), z); placing.dragged=true; p.held=true; checkPlace(); } } });
function endPtr(e){ const p=ptrs.get(e.pointerId); if(!p) return; ptrs.delete(e.pointerId); const moved=Math.hypot(p.x-p.sx,p.y-p.sy), dt=performance.now()-p.t;
  if(ptrs.size===0 && !p.held && moved<14 && dt<450 && !dlgState && !scrim.classList.contains('show') && !layoutMode) handleTap(e.clientX,e.clientY);
  if (buildMode && ptrs.size<2){ buildMode.mid=null; if (ptrs.size===0) buildMode.stroke=null; }
  if(p.held && !placing && !buildMode) stopMove(); if(placing && placing.drag && placing.drag.id===e.pointerId){ placing.drag=null; setTimeout(()=>{ if(placing) placing.dragged=false; },0); } }
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
// Wheel: zoom. Trackpad: two-finger swipe left/right turns the view, pinch zooms.
canvas.addEventListener('wheel', e=>{ e.preventDefault(); const dz=e.ctrlKey ? e.deltaY*3 : e.deltaY;
  if(buildMode){ const B=buildMode; if (e.shiftKey) B.pitch=clamp(B.pitch-dz*0.002,0.12,1.4); else B.dist=clamp(B.dist*Math.exp(dz*0.0012),6,140); if (B.view==='out') B.yaw-=e.deltaX*0.006; else buildPan(-e.deltaX*0.5,0); }
  else if(magicMode) magicMode.dist=clamp(magicMode.dist+dz*0.03,14,60);
  else { if (Math.abs(e.deltaX)>Math.abs(e.deltaY)*0.6 && !e.ctrlKey){ camYaw-=e.deltaX*0.006; lookDragT=performance.now(); } else camDist=clamp(camDist+dz*0.02,11,36); } }, { passive:false });
let lookDragT=0;
const _bt=new THREE.Vector3();
// Slide the builder's view across the ground (screen pixels)
function buildPan(dx, dy){ const B=buildMode; if (!B) return; const k=B.dist*0.0019, c=Math.cos(B.yaw), s=Math.sin(B.yaw);
  B.pan.x += (-dx*c - dy*s)*k; B.pan.z += (dx*s - dy*c)*k; const lim=Math.max(14, B.dist*0.8); B.pan.x=clamp(B.pan.x,-lim,lim); B.pan.z=clamp(B.pan.z,-lim,lim); }
let holdAcc=0;
function updateHold(dt){ if(CT().move!=='tap') return; holdAcc+=dt; if(holdAcc<0.08) return; holdAcc=0; if(ptrs.size!==1 || dlgState || placing || Fishing.state!=='idle') return; const p=[...ptrs.values()][0]; if(performance.now()-p.t<220 && Math.hypot(p.x-p.sx,p.y-p.sy)<14) return; p.held=true;
  const rect=canvas.getBoundingClientRect(); ndc.set((p.x-rect.left)/rect.width*2-1, -(p.y-rect.top)/rect.height*2+1); ray.setFromCamera(ndc,camera); const g=rayGround(ray.ray); if(g){ player.target=new THREE.Vector3(g.x,0,g.z); player.targetEnt=null; player.cb=null; marker.visible=false; } }

/* ---------- Movement and camera ---------- */
function movePlayer(dt,t){
  const u=player.obj.userData; let mv=null; if(riding && (World.inside||buildMode)) setRiding(false); if (sledding && (World.inside||buildMode||!snowyEnough())) setSled(false); const speed=(riding?10.2:5.4)*(wellFed()?1.15:1); let spd=1;
  const kx=(keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0), kz=(keys['s']||keys['arrowdown']?1:0)-(keys['w']||keys['arrowup']?1:0);
  const jm=Math.hypot(joy.x,joy.y), busy=dlgState||placing||layoutMode||buildMode||CatchMeter.bug||magicMode||cine||knockedDown();
  if (joy.active && jm>0.15 && !busy){ stopMove(); if(Fishing.state!=='idle') reel(); mv=new THREE.Vector3(joy.x*Math.cos(camYaw)+joy.y*Math.sin(camYaw),0,-joy.x*Math.sin(camYaw)+joy.y*Math.cos(camYaw)).normalize(); spd=clamp((jm-0.15)/0.7,0.25,1); hideHint(); }
  else if ((kx||kz) && !busy){ stopMove(); if(Fishing.state!=='idle') reel(); mv=new THREE.Vector3(kx*Math.cos(camYaw)+kz*Math.sin(camYaw),0,-kx*Math.sin(camYaw)+kz*Math.cos(camYaw)).normalize(); if(keys['shift']) spd=0.4; hideHint(); }
  else if (player.target){
    if (player.targetEnt){ if(player.targetEnt.removed) stopMove(); else player.target.copy(player.targetEnt.pos); }
    if (player.target){ const d=player.target.clone().sub(player.pos); d.y=0; const L=d.length(); const stopAt=player.targetEnt?player.targetEnt.reach:0.15;
      if (player.targetEnt instanceof Bug && L<5) spd=0.35;
      if (L<=stopAt){ const cb=player.cb; stopMove(); if(cb) cb(); }
      else {
        // moving targets (bugs, islanders): re-plan now and then
        player.repathT-=dt; if (player.targetEnt && player.repathT<=0 && player.pathFor && player.pathFor.distanceTo(player.target)>0.8){ planPath(); player.repathT=0.5; }
        let aim=player.target;
        if (player.path){ while (player.pathI<player.path.length-1 && Math.hypot(player.path[player.pathI][0]-player.pos.x, player.path[player.pathI][1]-player.pos.z)<0.3) player.pathI++;
          const wp=player.path[player.pathI]; if (wp && !(player.pathI===player.path.length-1 && Math.hypot(wp[0]-player.pos.x,wp[1]-player.pos.z)<0.2)) aim=new THREE.Vector3(wp[0],0,wp[1]); }
        const dd=aim.clone().sub(player.pos); dd.y=0; mv = dd.lengthSq()>1e-6 ? dd.normalize() : d.normalize();
        const moved=Math.hypot(player.pos.x-(player.lastX??player.pos.x), player.pos.z-(player.lastZ??player.pos.z));
        if (moved<speed*spd*dt*0.25){ player.stuck+=dt; if(player.stuck>0.45){ player.stuck=0;
            if (!player.repathed){ player.repathed=true; planPath(); }
            else { const cb=player.cb, te=player.targetEnt; stopMove(); if(te && L<te.reach+1.2 && cb) cb(); } } }
        else player.stuck=0; } }
  }
  player.speedFrac=0; player.lastX=player.pos.x; player.lastZ=player.pos.z;
  if (sledding){ if (player.target) stopMove(); if (!dlgState && !scrim.classList.contains('show')) sledMove(dt, mv, t); mv=null; }
  if (mv && !dlgState && Fishing.state==='idle' && !CatchMeter.bug && !buildMode && !magicMode){
    const step=speed*spd*dt; const p=player.pos; const nx=p.x+mv.x*step, nz=p.z+mv.z*step; let ok=false; ignoreRects = !World.inside && !!inRects(p.x,p.z,0.3); moverFrom=p;
    if(walkable(nx,nz)&&!blocked(nx,nz,0.35)){ p.x=nx; p.z=nz; ok=true; } else if(walkable(nx,p.z)&&!blocked(nx,p.z,0.35)){ p.x=nx; ok=true; } else if(walkable(p.x,nz)&&!blocked(p.x,nz,0.35)){ p.z=nz; ok=true; }
    if (!ok){ for(const s of [0.9,-0.9,1.6,-1.6]){ const c=Math.cos(s), sn=Math.sin(s); const vx=mv.x*c-mv.z*sn, vz=mv.x*sn+mv.z*c; const ax=p.x+vx*step, az=p.z+vz*step; if(walkable(ax,az)&&!blocked(ax,az,0.35)){ p.x=ax; p.z=az; ok=true; break; } } }
    ignoreRects=false; moverFrom=null; if (ok) player.speedFrac=spd;
    player.face=Math.atan2(mv.x,mv.z);
    if (riding){ bikeSpin(dt*spd*speed); const ph=t*9; u.legs[0].rotation.x=-0.9+Math.sin(ph)*0.5; u.legs[1].rotation.x=-0.9-Math.sin(ph)*0.5; u.arms[0].rotation.x=-0.9; u.arms[1].rotation.x=-0.9; } else {
    const ph=t*(5+6*spd); u.legs[0].rotation.x=Math.sin(ph)*0.7*spd; u.legs[1].rotation.x=-Math.sin(ph)*0.7*spd; u.arms[0].rotation.x=-Math.sin(ph)*0.6*spd; if(!S.equip) u.arms[1].rotation.x=Math.sin(ph)*0.6*spd; else u.arms[1].rotation.x=-0.3; u.body.position.y=Math.abs(Math.sin(ph))*0.07*spd; }
    if (!World.inside && Math.random()<dt*6*spd && rawHeight(p.x,p.z)<SAND_H && !onDock(p.x,p.z) && !onBridge(p.x,p.z)) puff(p.clone().add(new THREE.Vector3(0,0.05,0)),0xf3dca6,1,0.2,0.6,0.5,0.4);
  } else if (sledding){ /* sitting on the sled */ } else if (riding){ u.legs[0].rotation.x=-0.9; u.legs[1].rotation.x=-0.9; u.arms[0].rotation.x=-0.9; u.arms[1].rotation.x=-0.9; } else { u.legs.forEach(l=>l.rotation.x*=0.8); u.body.position.y*=0.8; u.arms[0].rotation.x*=0.8;
    u.arms[1].rotation.x = player.act>0 ? -Math.sin(player.act/0.35*Math.PI)*1.6 : (Fishing.state!=='idle'?-1.1:(S.equip?-0.3:u.arms[1].rotation.x*0.8)); }
  player.act=Math.max(0,player.act-dt);
  if (World.inside && !buildMode){ const R=ROOMS[World.inside]; if (R.exitCheck ? R.exitCheck(player.pos.x,player.pos.z) : (player.pos.z > R.oz+R.d/2-0.35 && Math.abs(player.pos.x-R.ox)<1.3)) exitRoom(); }
  player.pos.y=lerp(player.pos.y, World.inside?0:groundY(player.pos.x,player.pos.z), Math.min(1,dt*14));
  player.obj.position.copy(player.pos);
  let d=player.face-player.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); player.obj.rotation.y+=d*Math.min(1,dt*12);
  marker.material.opacity=0.5+Math.sin(t*6)*0.3;
}
const camTarget=new THREE.Vector3(), _tzl=new THREE.Vector3();
function updateCamera(dt){
  if (tankZoom){ tankZoom.t=Math.min(1, tankZoom.t+dt/0.42); const k=1-(1-tankZoom.t)**3; camera.position.lerpVectors(tankZoom.from, tankZoom.to, k); camera.lookAt(_tzl.lerpVectors(tankZoom.lookFrom, tankZoom.look, k)); return; }
  if (buildMode){ _bt.copy(buildMode.camT).add(buildMode.pan); camTarget.lerp(_bt, Math.min(1,dt*5)); const dist=buildMode.dist, pitch=buildMode.pitch, yaw=buildMode.yaw;
    if (World.inside){ scene.fog.near=Math.max(60,dist*1.2); scene.fog.far=Math.max(200,dist*3.5); }
    camera.position.set(camTarget.x+Math.sin(yaw)*Math.cos(pitch)*dist, camTarget.y+Math.sin(pitch)*dist, camTarget.z+Math.cos(yaw)*Math.cos(pitch)*dist); camera.lookAt(camTarget);
    camera.setViewOffset(innerWidth, innerHeight, 0, buildEl.offsetHeight*0.5, innerWidth, innerHeight);
    sky.position.copy(camera.position); stars.position.copy(camera.position); sun.target.position.copy(camTarget); sun.position.copy(camTarget).addScaledVector(sunDir,50); return; }
  if (cine){ camTarget.lerp(cine.camT, Math.min(1,dt*4)); const dist=cine.dist, pitch=cine.pitch||1.0, sh=cine.shake||0; camYaw*=Math.exp(-dt*4);
    const cy=cine.yaw||0; camera.position.set(camTarget.x+Math.sin(cy)*Math.cos(pitch)*dist+(Math.random()-0.5)*sh, camTarget.y+Math.sin(pitch)*dist+(Math.random()-0.5)*sh, camTarget.z+Math.cos(cy)*Math.cos(pitch)*dist); camera.lookAt(camTarget);
    sky.position.copy(camera.position); stars.position.copy(camera.position); sun.target.position.copy(camTarget); sun.position.copy(camTarget).addScaledVector(sunDir,50); return; }
  if (magicMode){ camTarget.lerp(magicMode.camT, Math.min(1,dt*6)); const dist=magicMode.dist, pitch=1.05; camYaw*=Math.exp(-dt*4);
    camera.position.set(camTarget.x, camTarget.y+Math.sin(pitch)*dist, camTarget.z+Math.cos(pitch)*dist); camera.lookAt(camTarget);
    sky.position.copy(camera.position); stars.position.copy(camera.position); sun.target.position.copy(camTarget); sun.position.copy(camTarget).addScaledVector(sunDir,50); return; }
  camTarget.lerp(player.pos.clone().add(new THREE.Vector3(0,0.8,0)), Math.min(1,dt*5));
  const turn=(keys[KB().turnR]?1:0)-(keys[KB().turnL]?1:0); if(turn && !dlgState) camYaw+=turn*dt*1.8;
  camYawHeld = !!rotPtr || ptrs.size===2 || !!turn || performance.now()-lookDragT<250;
  if (!World.inside){ camYaw=clamp(camYaw,-CAM_OUT_SWING,CAM_OUT_SWING); if(!camYawHeld) camYaw*=Math.exp(-dt*2.5); }   // outdoors: north stays up
  const dist = World.inside ? Math.min(camDist,15) : camDist; const pitch = World.inside ? 0.95 : 0.62+(camDist-11)/25*0.18;
  const ch=Math.cos(pitch)*dist; camera.position.set(camTarget.x+Math.sin(camYaw)*ch, camTarget.y+Math.sin(pitch)*dist, camTarget.z+Math.cos(camYaw)*ch); camera.lookAt(camTarget);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  sun.target.position.copy(camTarget); sun.position.copy(camTarget).addScaledVector(sunDir,50);
}
function resize(){ const w=innerWidth, h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov = w<h ? 48 : 38; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let actLabel='';
function updateActButton(){
  $('#hud').classList.toggle('uihide', !!(dlgState || placing || buildMode || (scrim.classList.contains('show') && !menuOpen)));
  if (magicMode) return;
  const nearHome = homeFloorOf(World.inside)>=0 || (!World.inside && Math.hypot(player.pos.x-LOT.x, player.pos.z-LOT.z)<12);
  if (nearHome!==updateActButton.nh){ updateActButton.nh=nearHome; $('#bBuild').style.display=nearHome?'':'none'; }
  if (layoutMode) return;
  let lab=''; if(!dlgState && !placing && !buildMode && !scrim.classList.contains('show')){ if(CatchMeter.bug) lab='Swing!'; else if(Fishing.state!=='idle') lab='Reel';  else { const e=nearestEnt(); if(e) lab=e.label(); else if(facingWater()) lab='Fish'; } }
  if(lab!==actLabel){ actLabel=lab; if(lab){ actBtn.textContent=lab; actBtn.classList.add('show'); } else actBtn.classList.remove('show'); }
  // v1.19: the swing button says what the tool in your hand does
  const tl = CatchMeter.bug ? 'Catch!' : Fishing.state!=='idle' ? 'Reel' : (TOOL_LABEL[S.equip] || 'Swing');
  if (tl!==swingBtn.textContent){ swingBtn.textContent=tl; swingBtn.setAttribute('aria-label', tl); }
}
const TOOL_LABEL = { axe:'Chop', shovel:'Dig', rod:'Cast', net:'Catch', can:'Water' };

/* ---------- Main loop ---------- */
const clock=new THREE.Clock(); let t=0, secT=0, saveT=0, started=false;
function frame(){
  const dt=Math.min(0.05, clock.getDelta()); t+=dt;
  secT+=dt; if(secT>1){ secT=0; if(rollDay()){ spawnDaily(); ensureFavors(); refreshStoreItems(); applyTown(); toast('A new day on '+(S.island||'the island')+'!'); } refreshStands(); setSledBtn(); updateSky(); updateHUD(); updatePotionHUD(); achTick(); }
  saveT+=dt; if(saveT>15){ saveT=0; save(); }
  updateRemotes(dt,t); updateSnow(dt); PARTY.update(dt,t);
  if (started && !tankView){ updateHold(dt); if (meBody.rag) updateRag(meBody,dt,t); else movePlayer(dt,t); bonkCool=Math.max(0,bonkCool-dt); updateBugs(dt); updateFishing(dt,t); updateCatchMeter(dt); tickDialog(dt); updateActButton(); updateCutaway(); }
  for(const e of ents.slice()){ if (e.removed) continue; if (e.rag){ updateRag(e,dt,t); continue; } if (e instanceof Resident || e instanceof Peddler || Math.abs(e.pos.x-player.pos.x)<40) e.update(dt,t); }
  WU.uTime.value=t; if (!World.inside){ updateWater(t); updateAmbient(dt,t); updateFalls(dt,t);
    for(const c of clouds){ c.position.x+=c.userData.v*dt; if(c.position.x>150) c.position.x=-150; }
    const lnOn=activeEvents().some(e=>e.id==='lantern-night');
    for(const l of lanterns){ l.visible=lnOn; if(lnOn){ const u=l.userData; u.y+=dt*u.s; if(u.y>18){ u.y=0; u.a=Math.random()*TAU; } l.position.set(Math.cos(u.a+t*0.01)*u.d, 1+u.y, Math.sin(u.a+t*0.01)*u.d); l.children[1].material.opacity=Math.min(1,u.y/2)*(1-u.y/18)*0.9; } } }
  updatePrecip(dt,t); updateParticles(dt); updateFX(dt); updateCamera(dt);
  if (tankView){ tankView.update(t, dt, innerWidth/innerHeight); renderer.render(tankView.scene, tankView.cam); } else renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
updateSky(); updateHUD(); camTarget.copy(player.pos); updateCamera(1); updateHeld(); updateToolBtn(); applyControls();
requestAnimationFrame(frame);


/* ---------- Looks ---------- */
if (S.look && CH.parseLook(S.look) && CH.lookCode(CH.parseLook(S.look))!==S.look) S.look=CH.lookCode(CH.parseLook(S.look));
function swapLook(old, o){ o.position.copy(old.position); o.rotation.copy(old.rotation); o.visible=old.visible;
  const ou=old.userData, nu=o.userData; if (ou.body && nu.body) nu.body.position.y=ou.body.position.y;
  for (const c of [...old.children]) if (!c.userData.model) o.add(c);
  if (old.parent){ const p=old.parent; p.remove(old); p.add(o); } return o; }
function setPlayerLook(code){ S.look=code; save(); player.obj=swapLook(player.obj, buildPlayer({ look:code })); for (const k in playerJelly) delete playerJelly[k]; updateHeld(); }

/* ---------- Start screen ---------- */
const isNew=!S.player || (BOOT.mode==='account' && !S.island);
if (isNew && S.player) $('#inName').value=S.player;
if (!isNew){ $('#newForm').classList.add('hide'); $('#backMsg').classList.remove('hide'); $('#backMsg').textContent= TRIP ? `You sailed to ${S.island}. ${(TRIP_THEMES[TRIP_THEME]||{}).blurb||''} Talk to Skipper Wick on the dock to sail home.` : 'Welcome back to '+S.island+', '+S.player+'!'; $('#bStart').textContent='Continue'; }
$('#loading').textContent='';
$('#bStart').onclick=async()=>{
  if (!S.look && (MAGIC_RET||PORTAL_RET) && !isNew){ S.look=CH.lookCode(CH.defaultLook()); player.obj=swapLook(player.obj, buildPlayer({ look:S.look })); }
  if ((MAGIC_RET||PORTAL_RET) && !isNew){ $('#start').remove(); started=true; Snd.init(S.settings, World); updateHUD(); if (MAGIC_RET) magicArrive(MAGIC_RET); else portalArrive();
    const wake=()=>{ if (Snd.ctx && Snd.ctx.state==='suspended') Snd.ctx.resume(); }; addEventListener('pointerdown', wake, { once:true }); addEventListener('keydown', wake, { once:true }); return; }
  if (isNew){ S.player=($('#inName').value||'').trim()||'Sam'; S.island=($('#inIsle').value||'').trim()||'Pebblewick'; save(); }
  if (!S.look){ $('#start').style.visibility='hidden';
    const L=await openCreator({ look:CH.defaultLook(), owned:wardrobeOwned(), title: isNew ? 'Make your character' : 'Pick your new look', sub: isNew ? 'Welcome to '+S.island+', '+S.player+'!' : '', doneLabel: isNew ? 'Let\'s go!' : 'Done' });
    setPlayerLook(CH.lookCode(L)); }
  Snd.init(S.settings, World); if(Snd.ctx && Snd.ctx.state==='suspended') Snd.ctx.resume();
  $('#start').remove(); started=true; updateHUD();
  const p=residents[0];
  if (isNew) setTimeout(()=>dialog(p.spec.name, p.spec.voice, [fill('Oh! Hi hi! You must be {p}! Welcome to {isle}, {c}!',{c:p.spec.catch}), 'Pemberton\'s shop by the plaza has tools. Come say hi to everyone, okay?']), 700);
  else if (S.migratedFrom1){ delete S.migratedFrom1; save(); setTimeout(()=>dialog(p.spec.name, p.spec.voice, [fill('{p}! Did you notice? The island got so much BIGGER overnight, {c}!',{c:p.spec.catch}), 'There\'s a river, a pond, and four new neighbors! And the stall sells tools now. You\'ll need them for bugs, fish and digging.', 'Your old furniture is safe. Anything that didn\'t fit went back in your bag.']), 700); }
  else if (TRIP) toast(`Welcome to ${S.island}!`, null, 'new', 'Gather all you like. Skipper Wick will take you home when you\'re ready.');
  else { toast('Welcome back, '+S.player+'!'); setTimeout(tripRecap, 900); }
};
if ((MAGIC_RET||PORTAL_RET) && !isNew) $('#bStart').onclick();
/* ---------- Bicycle ---------- */
const BIKE_COST=60000;
let riding=false, bikeObj=null;
const BIKE_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="8" cy="21" r="5.5" fill="none" stroke="#5b4336" stroke-width="2.5"/><circle cx="24" cy="21" r="5.5" fill="none" stroke="#5b4336" stroke-width="2.5"/><path d="M8 21l6-9h8l2 9M14 12l4 9h-10M20 9h4" fill="none" stroke="#d8604a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function bikeThumb(){ return 'data:image/svg+xml,'+encodeURIComponent(BIKE_SVG); }
function setRiding(on){
  on = !!on && !!S.bike && !World.inside && !buildMode;
  if (on===riding) return; riding=on;
  if (on && !bikeObj){ bikeObj=buildBike(); }
  const u=player.obj.userData;
  if (on){ player.obj.add(bikeObj); if(u.body) u.body.position.y=0.42; Snd.pop(); }
  else { if(bikeObj) player.obj.remove(bikeObj); if(u.body) u.body.position.y=0; }
  const b=$('#bBike'); if(b) b.classList.toggle('on', riding);
}
function toggleBike(){ if(!S.bike) return; if (sledding) setSled(false); if(World.inside){ toast('Park your bike outside first.'); return; } if(dlgState||placing||buildMode) return; setRiding(!riding); }
function bikeSpin(d){ if(bikeObj) for(const w of bikeObj.userData.wheels) w.rotation.x+=d/0.3; }
function setBikeBtn(){
  if (!S.bike || $('#bBike')) return;
  const bar=$('#bar'), b=document.createElement('button'); b.className='rbtn'; b.id='bBike';
  b.innerHTML=BIKE_SVG+'Bike'+(isTouchDevice?'':` (${KB().bike.toUpperCase()})`);
  bar.insertBefore(b, bar.firstChild); b.onclick=()=>toggleBike();
}
setTimeout(()=>{ setBikeBtn(); setSledBtn(); }, 0);

/* ---------- Sled ----------
   On a snowy island, hop on and gravity does the rest: you speed up going downhill and slow down on flat ground.
   Steer with the joystick or keys. Bump into something and you bounce off. */
let sledding=false, sledObj=null; const sledV=new THREE.Vector2();
const snowyEnough = () => World.season==='winter' || weatherOverride==='snow';
function toggleSled(){
  if (!countItem('sled')){ toast('You need a sled.'); Snd.fail(); return; }
  if (sledding){ setSled(false); return; }
  if (World.inside){ toast('Sleds are for snowy hills, not living rooms.'); return; } if (dlgState||placing||buildMode||magicMode) return;
  if (!snowyEnough()){ toast('There\'s no snow to sled on.'); Snd.fail(); return; }
  setSled(true); }
function setSled(on){
  if (on===sledding) return; sledding=on; const u=player.obj.userData;
  if (on){ track('sled'); if (riding) setRiding(false); stopMove(); if (Fishing.state!=='idle') reel(); if (!sledObj){ sledObj=buildItemModel('sled'); sledObj.scale.setScalar(1.15); } player.obj.add(sledObj); if (u.body) u.body.position.y=0.18; sledV.set(Math.sin(player.face)*1.5, Math.cos(player.face)*1.5); Snd.pop();
  }
  else { if (sledObj) player.obj.remove(sledObj); if (u.body) u.body.position.y=0; sledV.set(0,0); }
  const b=$('#bSled'); if (b) b.classList.toggle('on', sledding);
}
function sledMove(dt, inp, t){
  const p=player.pos, e=0.7, gx=(groundY(p.x+e,p.z)-groundY(p.x-e,p.z))/(2*e), gz=(groundY(p.x,p.z+e)-groundY(p.x,p.z-e))/(2*e);
  let ax=-gx*11, az=-gz*11; if (inp){ ax+=inp.x*3.2; az+=inp.z*3.2; }
  const sp=sledV.length(); if (sp>0.01){ const drag=0.9+sp*0.05; ax-=sledV.x/sp*drag; az-=sledV.y/sp*drag; }
  sledV.x+=ax*dt; sledV.y+=az*dt; if (sledV.length()>15) sledV.setLength(15); if (sledV.length()<0.15 && !inp) sledV.set(0,0);
  const nx=p.x+sledV.x*dt, nz=p.z+sledV.y*dt;
  if (walkable(nx,nz) && !blocked(nx,nz,0.45)){ p.x=nx; p.z=nz; }
  else { if (sledV.length()>4){ puff(p.clone().add(new THREE.Vector3(0,0.3,0)),0xffffff,8,0.6,1.5,0.8,0.6); Snd.thunk(); } sledV.multiplyScalar(-0.35); }
  const v=sledV.length(); if (v>0.4) player.face=Math.atan2(sledV.x,sledV.y); player.speedFrac=Math.min(1,v/8);
  if (v>3 && Math.random()<dt*v) puff(p.clone().add(new THREE.Vector3(0,0.1,0)),0xffffff,1,0.3,0.8,0.6,0.5);
  const u=player.obj.userData; u.legs[0].rotation.x=u.legs[1].rotation.x=-1.45; u.arms[0].rotation.x=u.arms[1].rotation.x=-0.6-Math.sin(t*6)*0.1*Math.min(1,v/6);
}
function setSledBtn(){
  const has=countItem('sled')>0, b0=$('#bSled'); if (!has){ if (b0) b0.remove(); return; } if (b0) return;
  const bar=$('#bar'), b=document.createElement('button'); b.className='rbtn'; b.id='bSled';
  b.innerHTML='<svg viewBox="0 0 32 32"><path d="M5 20h20c2 0 3-1 3-3" fill="none" stroke="#d8604a" stroke-width="2.6" stroke-linecap="round"/><path d="M8 20v-4h16v4M7 16h18" fill="none" stroke="#8b6b50" stroke-width="2.4" stroke-linejoin="round"/></svg>Sled'+(isTouchDevice?'':` (${KB().sled.toUpperCase()})`);
  bar.insertBefore(b, bar.firstChild); b.onclick=()=>toggleSled(); }
/* ---------- Other players (live visits) ---------- */
// Friends on the same island right now. Positions come from the live room; we smooth between updates.
const remotes=new Map();
const EMOTE_TEXT={ wave:'Hi!', happy:'Yay!', laugh:'Haha!', heart:'Love it!', surprised:'Whoa!', sad:'Aww...', thinking:'Hmm...', sleepy:'Zzz', thanks:'Thanks!', bye:'Bye!' };
const LOOKS=[[0xe88a6a,0x3a2a20],[0x7cc07a,0xc9a06a],[0xb08ad8,0x2a2a2a],[0xf2c64a,0x8a5a3a],[0x5a8ad8,0xe0c080],[0xe86a9a,0x6a4030]];
function nameTag(text){
  const cv=document.createElement('canvas'); cv.width=320; cv.height=80; const x=cv.getContext('2d'); x.font='700 40px Fredoka, sans-serif';
  const w=Math.min(300, x.measureText(text).width+44); x.fillStyle='rgba(255,248,234,.95)'; x.strokeStyle='#e7d1a6'; x.lineWidth=5;
  x.beginPath(); x.roundRect((320-w)/2, 10, w, 60, 30); x.fill(); x.stroke(); x.fillStyle='#5b4336'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(text,160,42);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:t, depthTest:false, transparent:true })); sp.scale.set(2.0,0.5,1); sp.renderOrder=10; return sp;
}
function remoteUpsert(id, name, st){
  let r=remotes.get(id);
  if (!r){ const lk=(st&&st.lk)||''; const obj=buildPlayer({ look:lk||CH.lookCode(CH.residentLook(id,'friend')) }); const tag=nameTag(name||'Friend'); tag.position.y=2.45; obj.add(tag);
    scene.add(obj); r={ id, name, obj, lk, pos:new THREE.Vector3(), tgt:new THREE.Vector3(), f:0, w:0, in:null, seen:false }; remotes.set(id,r); }
  if (st) remotePos(id, st);
  return r;
}
function remotePos(id, st){ const r=remotes.get(id); if(!r) return; if (st.lk && st.lk!==r.lk){ r.lk=st.lk; r.obj=swapLook(r.obj, buildPlayer({ look:st.lk })); r.jel={}; } r.tgt.set(st.x, st.y||0, st.z); r.f=st.f||0; r.w=st.w; r.in=st.in||null; r.rg=Array.isArray(st.rg)&&st.rg.length===4?st.rg:null; r.rs=st.rs?1:0;
  const wantBike=!!st.b; if(wantBike!==!!r.bike){ const u=r.obj.userData; if(wantBike){ r.bike=buildBike(0x5a9ad8); r.obj.add(r.bike); if(u.body) u.body.position.y=0.42; } else { r.obj.remove(r.bike); r.bike=null; if(u.body) u.body.position.y=0; } } if(!r.seen){ r.pos.copy(r.tgt); r.seen=true; } }
function remoteLeave(id){ PARTY.onLeave(id); const r=remotes.get(id); if(!r) return; scene.remove(r.obj); remotes.delete(id); if (r.rl && r.rl.stars) scene.remove(r.rl.stars); }
function remoteEmote(id, e){ const txt=EMOTE_TEXT[e]; if(!txt) return; const pos = id==='me' ? player.pos : remotes.get(id)?.pos; if(!pos) return; const v=pos.clone(); v.y+=0.6; floatText(txt, v); if(id!=='me') Snd.pop(); }
// Jelly feel: bodies squash and stretch on a little spring, and friends bump each other apart.
/* Jelly feel (v1.1): every critter is a soft plush on springs.
   - squash and stretch from a spring, kicked on every footstep and when stopping or starting
   - a slow breath while standing still
   - the head lags behind the body and nods back, ears and tails flop with the bounce
   - a little forward lean when walking, a sideways lean when turning */
function jelly(obj, st, dt, moving, t, speed=1){
  const u=obj.userData; if(!u.body) return; if (st.seed===undefined) st.seed=Math.random()*10;
  dt=Math.min(dt,0.05);
  if (u.anims) for (const f of u.anims) f(t, dt, moving);   // v1.19 worn accessories (wings, balloons)
  st.v=(st.v||0) + (-(st.x||0)*150 - (st.v||0)*7.5)*dt; st.x=(st.x||0)+st.v*dt;
  if (moving!==!!st.prevMoving){ st.v += moving ? 1.4 : -2.2; st.prevMoving=moving; }       // start: stretch up; stop: squish down
  if (moving){ const ph=(st.ph||0)+dt*(7+5*speed), step=Math.floor(ph/Math.PI); if (step!==st.step){ st.step=step; st.v-=1.1*Math.min(1,speed+0.3); } st.ph=ph; }
  const breath = moving ? 0 : Math.sin(t*2.1+st.seed)*0.018;
  const k=clamp(st.x+breath,-0.32,0.32); u.body.scale.set(1-k*0.55, 1+k, 1-k*0.55);
  // lean
  const yaw=obj.rotation.y, dy=Math.atan2(Math.sin(yaw-(st.yaw??yaw)),Math.cos(yaw-(st.yaw??yaw)))/Math.max(dt,1e-3); st.yaw=yaw;
  st.lean=lerp(st.lean||0, moving?0.1*speed:0, Math.min(1,dt*6)); st.roll=lerp(st.roll||0, clamp(-dy*0.04,-0.18,0.18), Math.min(1,dt*5));
  u.body.rotation.x=st.lean; u.body.rotation.z=st.roll + (moving?Math.sin(st.ph||0)*0.07*Math.min(1,speed+0.2):0);   // a little waddle
  // head: a softer spring that trails the body
  if (u.head){ st.hv=(st.hv||0) + (-(st.hx||0)*60 - (st.hv||0)*5 - st.v*2.2)*dt; st.hx=(st.hx||0)+st.hv*dt;
    u.head.rotation.x = clamp(st.hx*0.5,-0.25,0.25) + (moving?0:Math.sin(t*0.7+st.seed)*0.03); u.head.position.y = 1.42 + clamp(st.hx*0.03,-0.03,0.03); }
  // ears and tail flop with the bounce
  const flop=clamp(st.v*0.09 + st.hx*0.25,-0.5,0.5);
  if (u.ears) u.ears.forEach((e,i)=>{ e.rotation.z = e.userData.base + flop*(i%2?-1:1)*0.6 + Math.sin(t*1.7+st.seed+i)*0.04; e.rotation.x = -flop*0.5; });
  if (u.tail){ u.tail.rotation.y = Math.sin(t*(moving?9:2.5)+st.seed)*(moving?0.35:0.15); u.tail.rotation.x = u.tail.userData.base - flop*0.6; }
  // quill coats, manes and spines: a looser spring of their own, so they lag, overshoot and settle after each bounce
  if (u.wobble && u.wobble.length){ st.wv=(st.wv||0) + (-(st.wx||0)*45 - (st.wv||0)*3.2 - st.v*3.0 - st.hv*0.6)*dt; st.wx=(st.wx||0)+st.wv*dt;
    const sway=moving?Math.sin(st.ph||0)*0.05:0;
    for (const w of u.wobble){ const k=w.userData.k; w.rotation.x = clamp(st.wx*0.35*k,-0.22,0.22); w.rotation.z = sway*k; const sq=clamp(st.wx*0.06*k,-0.05,0.05); w.scale.set(1-sq,1+sq,1-sq); } }
}
const playerJelly={}, knock=new THREE.Vector2();
function bumpFriends(dt){
  if (!remotes.size) { knock.multiplyScalar(Math.exp(-dt*6)); return; }
  for (const r of remotes.values()){ if(!r.obj.visible) continue;
    const dx=player.pos.x-r.pos.x, dz=player.pos.z-r.pos.z, d=Math.hypot(dx,dz), R=riding||r.bike?1.3:0.95;
    if (d<R && d>1e-4){ const push=(R-d)/R;
      if (!r.touching){ r.touching=true; playerJelly.v=(playerJelly.v||0)-3.2*push-1.2; r.jel=r.jel||{}; r.jel.v=(r.jel.v||0)-3.2*push-1.2; Snd.pop(); }
      knock.x+=dx/d*push*26*dt; knock.y+=dz/d*push*26*dt; }
    else r.touching=false; }
  const p=player.pos, nx=p.x+knock.x*dt, nz=p.z+knock.y*dt;
  if (knock.lengthSq()>1e-4 && walkable(nx,nz) && !blocked(nx,nz,0.35)){ p.x=nx; p.z=nz; } else if (!walkable(nx,nz)||blocked(nx,nz,0.35)) knock.set(0,0);
  knock.multiplyScalar(Math.exp(-dt*6));
}
function updateRemotes(dt,t){
  if (started && !buildMode) bumpFriends(dt);
  jelly(player.obj, playerJelly, dt, player.speedFrac>0.05, t, player.speedFrac*(riding?1.6:1));
  for (const r of remotes.values()){ r.jel=r.jel||{}; jelly(r.obj, r.jel, dt, !!r.w, t);
    r.pos.lerp(r.tgt, Math.min(1, dt*(r.rg?14:8))); r.obj.position.copy(r.pos);
    r.obj.visible = r.seen && (r.in||null)===(World.inside||null);
    if (remoteRag(r, dt, t)) continue;
    let d=r.f-r.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); r.obj.rotation.y+=d*Math.min(1,dt*10);
    r.obj.visible = r.seen && (r.in||null)===(World.inside||null);
    const u=r.obj.userData; if(r.bike){ if(r.w) for(const w of r.bike.userData.wheels) w.rotation.x+=dt*30; if(u.legs){ u.legs[0].rotation.x=-0.9+Math.sin(t*9)*0.5*r.w; u.legs[1].rotation.x=-0.9-Math.sin(t*9)*0.5*r.w; } if(u.arms){ u.arms[0].rotation.x=-0.9; u.arms[1].rotation.x=-0.9; } continue; }
    if(u.legs){ const ph=t*11, a=r.w?1:0; u.legs[0].rotation.x=Math.sin(ph)*0.7*a; u.legs[1].rotation.x=-Math.sin(ph)*0.7*a; if(u.arms){ u.arms[0].rotation.x=-Math.sin(ph)*0.6*a; u.arms[1].rotation.x=Math.sin(ph)*0.6*a; } }
  }
}
/* ---------- Swing and ragdolls (v1.6) ----------
   Swing (Space, or the Swing button) is its own control, separate from Use/Talk (E, Enter, click, the Act button).
   A swing always plays: the axe chops the air, the shovel digs a little hole anywhere, the rod casts and reels back,
   the net sweeps, the can sprinkles. If it would hit something the tool works on (a tree, a rock, a bug, a plant, water),
   it does that. If a character is in front of you (an islander, a friend, a visitor) it sends them flying instead.
   Ragdoll: the body is launched up and away with a spin, falls, bounces, skids, rolls flat, lies there seeing stars,
   then springs back up. Arms, legs and head flop on loose springs. Your own character uses the same physics when a
   friend hits you, and your game sends the pose to everyone else, so they see the same tumble. */
const ragdolls=new Set();
const meBody={ pos:player.pos, get obj(){ return player.obj; }, jel:playerJelly, me:true, rag:null };
const isNpc = e => (e instanceof Resident || e instanceof Keeper) && !e.removed;
const knockedDown = () => !!meBody.rag;
let bonkCool=0;
function npcInSpace(e){ return e.obj.visible!==false && e.obj.parent && (e.pos.x>500)===!!World.inside && !(e instanceof Resident && (e.lying || (World.inside ? e.loc!=='in' : e.loc!=='out'))); }
// the character in front of you, close enough to hit: { npc } or { remote }
function swingTarget(){
  let best=null, bd=2.2;
  const look=(px,pz,v)=>{ const dx=px-player.pos.x, dz=pz-player.pos.z, d=Math.hypot(dx,dz); if (d>=bd) return;
    let a=Math.atan2(dx,dz)-player.face; a=Math.atan2(Math.sin(a),Math.cos(a)); if (Math.abs(a)>1.15 && d>0.9) return; best=v; bd=d; };
  for (const e of ents) if (isNpc(e) && !e.rag && !e.talking && npcInSpace(e)) look(e.pos.x, e.pos.z, { npc:e });
  for (const r of remotes.values()) if (r.obj.visible && !r.rg) look(r.pos.x, r.pos.z, { remote:r });
  return best; }
const TOOL_VERBS = { axe:['Chop','Hit'], shovel:['Dig','Dig up','Hit'], net:['Catch','Swing!'], can:['Water'] };
function swing(){
  if (cine||dlgState||scrim.classList.contains('show')||placing||layoutMode||buildMode||magicMode||meBody.rag||bonkCool>0) return;
  if (CatchMeter.bug){ resolveSwing(); return; }
  if (Fishing.state!=='idle'){ reel(); return; }
  if (riding) setRiding(false); if (sledding){ setSled(false); return; }
  const tool = S.equip && hasTool(S.equip) ? S.equip : null; hideHint();
  const tg=swingTarget();
  if (PARTY.trySwing(tg ? { d:Math.hypot((tg.npc||tg.remote).pos.x-player.pos.x, (tg.npc||tg.remote).pos.z-player.pos.z) } : null)) return;   // v1.13: Bonk Ball
  if (tg){ const p=tg.npc ? tg.npc.pos : tg.remote.pos, dx=p.x-player.pos.x, dz=p.z-player.pos.z, L=Math.hypot(dx,dz)||1;
    stopMove(); player.face=Math.atan2(dx,dz); player.obj.rotation.y=player.face; player.act=0.4; bonkCool=0.5; Snd.swoosh();
    setTimeout(()=>{ if (tg.npc){ const e=tg.npc; if (!e.removed && !e.rag && npcInSpace(e) && Math.hypot(e.pos.x-player.pos.x, e.pos.z-player.pos.z)<3.2) launchRag(e, dx/L, dz/L, tool?1:0.7); }
      else { const r=tg.remote; Snd.boing(); puff(r.pos.clone().add(new THREE.Vector3(0,1.4,0)), 0xffffff, 10, 0.6, 2.4, 0.8, 0.5); floatText('Bonk!', r.pos); if (BOOT.sendLive) BOOT.sendLive({ t:'bonk', to:r.id, dx:+(dx/L).toFixed(3), dz:+(dz/L).toFixed(3) }); } }, 120);
    return; }
  // something the tool works on, right in front: use it as usual
  if (tool==='rod'){ if (facingWater()){ doAction(); return; } }
  else if (tool){ const e=nearestEnt(); if (e && (TOOL_VERBS[tool]||[]).includes(e.label())){ let a=Math.atan2(e.pos.x-player.pos.x, e.pos.z-player.pos.z)-player.face; a=Math.atan2(Math.sin(a),Math.cos(a)); if (Math.abs(a)<1.4 || Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<1.1){ interact(e,'manual'); return; } } }
  airSwing(tool); }
// a swing at nothing: a little animation, then back to normal
function airSwing(tool){
  stopMove(); player.act=0.4; bonkCool=0.35; const f=player.face, front=new THREE.Vector3(player.pos.x+Math.sin(f)*1.1, 0, player.pos.z+Math.cos(f)*1.1); front.y=groundY(front.x,front.z);
  if (!tool){ Snd.swoosh(); return; }
  if (tool==='axe'){ Snd.swoosh(); setTimeout(()=>puff(front.clone().setY(front.y+0.9), 0xffffff, 4, 0.3, 1.2, 0.6, 0.3), 150); }
  else if (tool==='shovel'){ Snd.dig(); if (!World.inside && walkable(front.x,front.z) && rawHeight(front.x,front.z)>SAND_H-0.3){ FX.hole(front.clone(), 0.32, 1.6); puff(front.clone().setY(front.y+0.2), 0xb08a5a, 7, 0.5, 2.2, 0.9, 0.5); } else puff(front.clone().setY(front.y+0.2), 0xd8c8a8, 4, 0.3, 1.2, 0.6, 0.3); }
  else if (tool==='net'){ Snd.swoosh(); }
  else if (tool==='can'){ Snd.pop(); puff(front.clone().setY(front.y+0.3), 0x8ac8f0, 9, 0.35, 1.6, 0.8, 0.45); }
  else if (tool==='rod'){ Snd.swoosh(); airCast(); } }
// cast the line at nothing: the bobber arcs out, lands, and reels straight back
function airCast(){ const f=player.face, b=new THREE.Mesh(G.sph(0.11,10,8), M(0xe8503a)), line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]), new THREE.LineBasicMaterial({ color:0xf4f0e8 }));
  scene.add(b); scene.add(line); const d=3.6, to=new THREE.Vector3(player.pos.x+Math.sin(f)*d, 0, player.pos.z+Math.cos(f)*d); to.y=groundY(to.x,to.z)+0.08;
  timeline(1.3, t=>{ const tip=player.pos.clone().add(new THREE.Vector3(Math.sin(f)*0.7, 1.5, Math.cos(f)*0.7)); let k;
      if (t<0.45){ k=t/0.45; b.position.lerpVectors(tip, to, k); b.position.y+=Math.sin(k*Math.PI)*1.6; } else if (t<0.8){ b.position.copy(to); if (t-0.45<0.02) Snd.thunk(); } else { k=(t-0.8)/0.5; b.position.lerpVectors(to, tip, k*k); b.position.y+=Math.sin(k*Math.PI)*0.4; }
      line.geometry.setFromPoints([tip, b.position.clone()]); },
    ()=>{ scene.remove(b); scene.remove(line); line.geometry.dispose(); }); }

let _starTex=null;
function starTex(){ if (_starTex) return _starTex; const cv=document.createElement('canvas'); cv.width=cv.height=64; const x=cv.getContext('2d'); x.translate(32,32); x.beginPath();
  for (let i=0;i<10;i++){ const r=i%2?11:28, a=i/10*TAU-Math.PI/2; x.lineTo(Math.cos(a)*r, Math.sin(a)*r); } x.closePath(); x.fillStyle='#ffd24a'; x.fill(); x.lineWidth=4; x.strokeStyle='#e8952a'; x.lineJoin='round'; x.stroke();
  return _starTex=new THREE.CanvasTexture(cv); }
function starRing(){ const g=new THREE.Group(); for (let i=0;i<3;i++){ const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:starTex(), transparent:true, depthWrite:false })); sp.scale.setScalar(0.4); sp.userData.a=i/3*TAU; g.add(sp); } scene.add(g); return g; }
function spinStars(g, at, t){ g.position.copy(at); g.children.forEach(sp=>{ const a=sp.userData.a+t*5; sp.position.set(Math.cos(a)*0.42, Math.sin(t*7+sp.userData.a)*0.08, Math.sin(a)*0.42); }); }
// a friend hit me (from the live room)
function bonked(to, from, dx, dz){
  if (to==='me'){ launchRag(meBody, dx, dz, 1); const r=remotes.get(from); if (r) toast(`${r.name} bonked you!`); }
  else { const r=remotes.get(to); if (r){ Snd.boing(); puff(r.pos.clone().add(new THREE.Vector3(0,1.4,0)), 0xffffff, 8, 0.6, 2.2, 0.8, 0.5); } } }
function launchRag(e, dx, dz, power){
  if (e.rag || e.removed || e.talking) return;
  e.jel=e.jel||{};
  const o=e.obj, u=o.userData, h=0.7, yaw=e.me ? player.face : o.rotation.y; o.rotation.set(0,yaw,0);
  if (e.me){ if (riding) setRiding(false); if (sledding) setSled(false); if (Fishing.state!=='idle') reel(); if (CatchMeter.bug) endCatchMeter(); stopMove(); }
  const side=new THREE.Vector3(dz,0,-dx).normalize();     // tumble axis: head goes the way it was hit
  e.rag={ t:0, home: e instanceof Keeper ? e.pos.clone() : null, h, solid:e.solid,
    c:new THREE.Vector3(e.pos.x, e.pos.y+h, e.pos.z),                                   // centre of the body
    v:new THREE.Vector3(dx*(5+Math.random()*1.5)*power, (4.5+Math.random()*1.5)*power, dz*(5+Math.random()*1.5)*power),
    w:side.multiplyScalar(-(9+Math.random()*4)*power).add(new THREE.Vector3(0,(Math.random()-0.5)*8,0)),
    q:new THREE.Quaternion().setFromEuler(new THREE.Euler(0,yaw,0)), rest:0, up:-1,
    limbs:(u.arms||[]).concat(u.legs||[]).map(()=>({ x:0, vx:0, z:0, vz:0 })), headV:0, headZ:0, stars:null, hit:new Set([e]) };
  if (!e.me) e.solid=false;   // a tumbling islander never blocks anyone (v1.5 bug: you couldn't walk while one lay against you)
  ragdolls.add(e);
  Snd.boing(); puff(e.rag.c.clone().add(new THREE.Vector3(0,0.6,0)), 0xffffff, 10, 0.6, 2.4, 0.8, 0.5);
  floatText(['Bonk!','Boing!','Whee!','Oof!','Wahh!'][Math.floor(Math.random()*5)], e.pos);
}
// arms, legs and head on loose springs: wild while spinning, splayed out while lying still
function ragLimbs(u, L, spin, resting, t, dt){
  const parts=(u.arms||[]).concat(u.legs||[]), na=(u.arms||[]).length;
  parts.forEach((p,i)=>{ const S2=L.limbs[i]||(L.limbs[i]={ x:0, vx:0, z:0, vz:0 }), arm=i<na, sgn=i%2?-1:1;
    const tx = resting ? (arm?-0.3:0.25*sgn) : Math.sin(t*(13+i*2)+i)*0.25*spin/6 + (arm?-1.2:0.6)*Math.min(1,spin/8);
    const tz = resting ? sgn*(arm?1.25:0.35) : sgn*(arm?0.6:0.25) + Math.cos(t*(11+i*3))*0.35*Math.min(1,spin/6);
    S2.vx+=((tx-S2.x)*60-S2.vx*6)*dt; S2.x+=S2.vx*dt; S2.vz+=((tz-S2.z)*60-S2.vz*6)*dt; S2.z+=S2.vz*dt; p.rotation.x=S2.x; p.rotation.z=S2.z; });
  if (u.head){ L.headV+=((Math.sin(t*9)*0.25*Math.min(1,spin/5)-L.headZ)*50-L.headV*5)*dt; L.headZ+=L.headV*dt; u.head.rotation.z=L.headZ; } }
function resetLimbs(u){ (u.arms||[]).forEach(a=>{ a.rotation.x=0; a.rotation.z=0; }); (u.legs||[]).forEach(l=>{ l.rotation.x=0; l.rotation.z=0; }); if (u.head) u.head.rotation.z=0; }
const _q=new THREE.Quaternion(), _v=new THREE.Vector3(), UPV=new THREE.Vector3(0,1,0);
function updateRag(e, dt, t){
  const R=e.rag, o=e.obj, u=o.userData; R.t+=dt;
  const up=_v.copy(UPV).applyQuaternion(R.q), upright=Math.abs(up.y);
  const reach = R.h*upright + 0.42*(1-upright);              // how far the body's centre sits above the ground in this pose
  if (R.up<0){
    R.v.y-=20*dt; const nx=R.c.x+R.v.x*dt, nz=R.c.z+R.v.z*dt;
    if (!walkable(nx,nz) || blocked(nx,nz,0.35,e)){ R.v.x*=-0.45; R.v.z*=-0.45; R.w.multiplyScalar(-0.6); if (Math.abs(R.v.x)+Math.abs(R.v.z)>1.5) Snd.thunk(); }
    else { R.c.x=nx; R.c.z=nz; }
    R.c.y+=R.v.y*dt; const gy=groundY(R.c.x,R.c.z)+reach, grounded=R.c.y<=gy+0.02;
    if (R.c.y<gy){ R.c.y=gy;
      if (R.v.y<-3){ R.v.y*=-0.38; R.w.multiplyScalar(0.7); R.w.x+=(Math.random()-0.5)*4; R.w.z+=(Math.random()-0.5)*4; Snd.thunk(); puff(R.c.clone().setY(gy-reach+0.15), 0xd8c8a8, 6, 0.5, 1.4, 0.8, 0.4); e.jel.v=-3; }
      else R.v.y=0; }
    if (grounded){ const f=Math.exp(-dt*5); R.v.x*=f; R.v.z*=f; R.w.multiplyScalar(Math.exp(-dt*4));
      // roll onto the back, front or side
      if (upright>0.25){ const lay=new THREE.Vector3().crossVectors(up, UPV); if (lay.lengthSq()<0.04) lay.set(1,0,0).applyQuaternion(R.q).setY(0); lay.normalize(); R.w.addScaledVector(lay, -Math.sign(up.y||1)*dt*34*upright); } }
    else R.w.multiplyScalar(Math.exp(-dt*0.4));
    const wl=R.w.length(); if (wl>1e-4){ _q.setFromAxisAngle(_v.copy(R.w).divideScalar(wl), wl*dt); R.q.premultiply(_q).normalize(); }
    // knock over islanders it flies into (never you: you can always keep walking)
    const sp=Math.hypot(R.v.x,R.v.z);
    if (sp>2.2) for (const o2 of ents){ if (!isNpc(o2) || o2.rag || o2.talking || R.hit.has(o2) || !npcInSpace(o2)) continue; const d=Math.hypot(o2.pos.x-R.c.x, o2.pos.z-R.c.z); if (d<0.9){ R.hit.add(o2); launchRag(o2, R.v.x/sp, R.v.z/sp, Math.min(1, sp/6)); R.v.multiplyScalar(0.5); } }
    if (grounded && sp<0.4 && R.w.length()<1.2 && R.t>0.6){ R.rest+=dt; if (R.rest>(e.me?1.2:1.8)){ R.up=0; R.q0=R.q.clone(); R.c0=R.c.clone();
        const fy = e.me ? new THREE.Euler().setFromQuaternion(R.q,'YXZ').y : Math.atan2(player.pos.x-R.c.x, player.pos.z-R.c.z); R.q1=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,fy,0)); } }
    else R.rest=Math.max(0,R.rest-dt);
  } else {
    R.up+=dt; const k=Math.min(1,R.up/0.45), e2=1-Math.pow(1-k,3);
    R.q.slerpQuaternions(R.q0, R.q1, e2); R.c.y=lerp(R.c0.y, groundY(R.c.x,R.c.z)+R.h, e2)+Math.sin(k*Math.PI)*0.5;
    if (k>=1){ endRag(e); return; } }
  e.pos.x=R.c.x; e.pos.z=R.c.z; e.pos.y=groundY(R.c.x,R.c.z);
  o.quaternion.copy(R.q); o.position.copy(R.c).addScaledVector(_v.copy(UPV).applyQuaternion(R.q), -R.h);
  R.spin=Math.min(14,R.w.length()); R.resting=R.up<0 && R.rest>0.15;
  ragLimbs(u, R, R.spin, R.up<0 && R.rest>0.2, t, dt);
  if (R.resting && !R.stars) R.stars=starRing();
  if (R.stars){ R.stars.visible=R.resting && o.visible; spinStars(R.stars, _v.copy(UPV).applyQuaternion(R.q).multiplyScalar(0.75).add(R.c).add(new THREE.Vector3(0,0.45,0)), t); }
}
function endRag(e){
  const R=e.rag, o=e.obj, u=o.userData; if (R.stars) scene.remove(R.stars);
  const yaw=new THREE.Euler().setFromQuaternion(R.q,'YXZ').y; o.rotation.set(0,yaw,0); e.face=yaw;
  e.pos.set(R.c.x, groundY(R.c.x,R.c.z), R.c.z); o.position.copy(e.pos); resetLimbs(u);
  e.jel.v=4; Snd.pop(); e.rag=null; ragdolls.delete(e);
  if (e.me){ player.face=yaw; return; }
  e.solid=R.solid;
  floatText(['Hey!','Rude!','Again!','Wheee...','Oof.','Hmph!','Dizzy...'][Math.floor(Math.random()*7)], e.pos);
  if (e instanceof Resident){ e.state='idle'; e.timer=1.5; }
  // shopkeepers and Wendell hop back to their spot
  if (R.home && R.home.distanceTo(e.pos)>0.2){ const from=e.pos.clone(), to=R.home.clone(), n=Math.max(1,Math.round(from.distanceTo(to)/1.2));
    timeline(0.32*n, tt=>{ const k=tt/(0.32*n); e.pos.lerpVectors(from,to,k); e.pos.y=groundY(e.pos.x,e.pos.z)+Math.abs(Math.sin(k*n*Math.PI))*0.4; e.obj.position.copy(e.pos); }, ()=>{ e.pos.copy(to); e.obj.position.copy(to); }); }
}
// a friend's tumble, drawn from the pose their game sends: rotation (rg), lying still (rs)
function remoteRag(r, dt, t){
  const u=r.obj.userData;
  if (r.rg){ const q=new THREE.Quaternion(r.rg[0],r.rg[1],r.rg[2],r.rg[3]).normalize(); if (!r.rl){ r.rl={ limbs:[], headV:0, headZ:0, q:q.clone() }; r.obj.quaternion.copy(q); }
    const prev=r.rl.q.clone(); r.obj.quaternion.slerp(q, Math.min(1,dt*12)); r.rl.q.copy(r.obj.quaternion);
    const spin=Math.min(14, 2*Math.acos(Math.min(1,Math.abs(prev.dot(r.rl.q))))/Math.max(dt,1e-3));
    ragLimbs(u, r.rl, Math.max(spin, r.rs?0:3), !!r.rs, t, dt);
    if (r.rs && !r.rl.stars) r.rl.stars=starRing(); if (r.rl.stars){ r.rl.stars.visible=!!r.rs && r.obj.visible; spinStars(r.rl.stars, _v.copy(UPV).applyQuaternion(r.obj.quaternion).multiplyScalar(0.75).add(r.obj.position).add(new THREE.Vector3(0,0.95,0)), t); }
    return true; }
  if (r.rl){ if (r.rl.stars) scene.remove(r.rl.stars); r.rl=null; r.obj.rotation.set(0,r.f,0); resetLimbs(u); r.jel.v=4; }
  return false; }
const playerState = () => { const R=meBody.rag, P = R ? player.obj.position : player.pos;
  const st={ lk:S.look||'', b:riding?1:0, x:+P.x.toFixed(2), z:+P.z.toFixed(2), y:+P.y.toFixed(2), f:+player.face.toFixed(2), w:player.speedFrac>0.05?1:0, in:World.inside||null };
  if (R){ const q=player.obj.quaternion; st.rg=[+q.x.toFixed(3),+q.y.toFixed(3),+q.z.toFixed(3),+q.w.toFixed(3)]; st.rs=R.resting?1:0; }
  return st; };
// The server changed our bag (gift, mail or trade): take its copy
function setInventory(inv, seen, equip){ S.inv=inv; if(seen) S.seen=Object.assign(S.seen||{}, seen); if(equip!==undefined){ S.equip=equip; } try{ updateHeld(); updateToolBtn(); }catch(e){} updateHUD(); }
if (VISIT) setTimeout(()=>toast(`Visiting ${BOOT.host.name}'s island${BOOT.host.island?' ('+BOOT.host.island+')':''} as a ${BOOT.role}.`), 1500);

addEventListener('visibilitychange', ()=>{ if(document.hidden) save(); else if(Snd.ctx) Snd.ctx.resume(); });
/* ---------- Party games (v1.14): Bonk Ball and Crown Keeper, in party.js ---------- */
const PARTY = createParty({ scene, player, meBody, remotes, groundY, walkable, rawHeight, ents, isNpc, World, BOOT, toast, dialog, Snd, puff, sparkBurst, floatText, nameTag, launchRag, endRag, itemToast, addClams, exitRoom,
  get S(){ return S; },
  addItem:(id)=>addItem(id), dropNear:(id,at)=>dropNear(id,at),
  staticBlocked:(x,z,r)=>!!inRects(x,z,r) || (FENCE_SEGS.length>0 && fenceHit(x,z,r)) || keptOut(x,z),
  gardenAt:(x,z)=>gardenAtXZ(x,z),
  knockedDown:()=>knockedDown(),
  prep:()=>{ if (riding) setRiding(false); if (sledding) setSled(false); if (Fishing.state!=='idle') reel(); if (CatchMeter.bug) endCatchMeter(); stopMove(); },
  snapCam:()=>{ camTarget.copy(player.pos); updateCamera(1); },
  updateRag:(e,dt,t)=>updateRag(e,dt,t), jelly:(o,st,dt,mv,t,sp)=>jelly(o,st,dt,mv,t,sp),
  // practice buddies: copies of islanders who live here (the real one steps away while the game is on)
  buddies:(n)=>residents.filter(r=>!r.removed && !r.talking).sort(()=>Math.random()-0.5).slice(0,n).map(r=>({ id:'bot:'+r.spec.id, name:r.spec.name, voice:r.spec.voice,
    obj:buildAnimal({ ...r.spec, look:CH.lookCode(CH.residentLook(S.seed, r.spec.id, RESIDENTS.indexOf(r.spec))) }),
    away:()=>{ r.partyAway={ parent:r.obj.parent, solid:r.solid }; if (r.rag) endRag(r); r.solid=false; if (r.obj.parent) r.obj.parent.remove(r.obj); },
    keep:()=>{ if (r.partyAway && r.obj.parent){ r.partyAway.parent=r.obj.parent; r.obj.parent.remove(r.obj); } },
    back:()=>{ const a=r.partyAway; if (!a) return; delete r.partyAway; r.solid=a.solid; if (a.parent && !r.obj.parent) a.parent.add(r.obj); } })),
  swingAnim:(face)=>{ stopMove(); player.face=face; player.obj.rotation.y=face; player.act=0.4; bonkCool=0.35; Snd.swoosh(); } });
window.__game = { v123:{ toolPitch, pitchTool, buyTool, talkShop, get storeVisit(){ return storeVisit; } }, v120:{ track, checkAch, achValue, grantWear, ownsWear, openAchievements, makeFavor, rollFavors, favorChoices, npcOf, clothesStock, wardrobeOwned, get Q(){ return Q; } }, party:PARTY, v119:{ tierPick, openChest, townCap:()=>townCap() }, v13:{ shopStock:w=>shopStock(w), learnPlan, rareRoll, knowsPlan, unfoundPlans, stockWeight, RARE_WORK, GroundItem, ShopItem, Furniture }, v1:{ scene, camera, OUT, updateSky, updateHUD, snowPass, SNOW_U, townNewDay, applyTown, talkHall, openHallPanel, buildPlaza, refreshStoreItems, buildStoreAll, buildShop, buildMuseumAll, spawnExhibits, mentorMoment, teachWoodworking, openCraft, doCook, nearStation, toggleSled, setSled, get sledding(){ return sledding; }, sledV, eatFood, Plant, fullBagCatch, KB, landSeaTap, terraLand, LAMPS:()=>LAMPS, hasUpstairs, ShopItem, Stairs, get exhibits(){ return exhibits; }, onDisplay, museumNeeds, museumExpand, museumFitState, museumTanks, renderer, nearestEnt:()=>nearestEnt(), doAction:()=>doAction(), openTankView, closeTankView, get tankView(){ return tankView; }, KEEPOUT, dayKeyOf, World, startPlacing, checkPlace, get placing(){ return placing; }, FX, homeStock, buyHome, draftUnowned, get homeRack(){ return homeRack; }, openShop, openBuild:(o)=>openBuild(o), closeBuild, get buildMode(){ return buildMode; }, ents, Tree, Stump, Weed, Bug, bugs, player, interact, layoutBar, pickNote, itemToast, reel, Fishing, fishes, spawnFish, WU, relayout, enterRoom:(id)=>enterRoom(id), trees }, get S(){ return S; }, dbg:{ setCine:(c)=>{ cine=c; }, showChoices:(t,c)=>showChoices(t,c), dialog:(...a)=>dialog(...a), setRiding:(v)=>setRiding(v), enterRoom:(id)=>enterRoom(id), openBuild:()=>openBuild(), rooms:()=>Object.keys(ROOMS), get yaw(){ return camYaw; }, set yaw(v){ camYaw=v; }, get riding(){ return riding; }, get snow(){ return SNOW_U.value; }, setWeather:(w)=>{ weatherOverride=w; World.weather=w; snowT=0; }, get dlg(){ return !!dlgState; } }, walkable, blocked, groundY, launchRag, ragdolls, swing, meBody, refreshPortals, portalArches, get portalEnt(){ return portalEnt; }, enterRoom, PLACES, net:{ party:(id,d)=>PARTY.onNet(id,d), bonked, visibleRemotes:()=>[...remotes.values()].filter(r=>r.obj.visible).map(r=>[r.name,+r.pos.x.toFixed(1),+r.pos.z.toFixed(1)]), remoteUpsert, remotePos, remoteLeave, remoteEmote, playerState, setInventory, toast:(m)=>toast(m), updateHUD:()=>updateHUD(), get started(){ return started; } }, ITEMS, itemThumb:(id)=>thumb(id), layoutInfo:()=>({ id:LAYOUT_ID, PLACES, PATHS, LOT, rects:RECTS.map(r=>r.slice(0,4)), lot:lotRect() }), terrainH:(x,z)=>rawHeight(x,z), terrainSlope:(x,z)=>hillSlope(x,z), interact, spawnBug:(id,x,z)=>new Bug(id,x,z), tapOdds:()=>Object.fromEntries(Object.keys(TAP_BASE).map(k=>[k, +tapChance({rarity:k}).toFixed(2)])), placingObj:()=>placing&&placing.m, toScreen:v=>{ const p=v.clone().project(camera); return [(p.x*0.5+0.5)*innerWidth, (-p.y*0.5+0.5)*innerHeight]; }, rebuildHome:()=>{ buildPlayerHouse(); rebuildHomeRoom(); }, openBuild, closeBuild, get buildMode(){ return buildMode; }, talkShop, openDonate, talkCurator, spawnMossby, onFelled, findPath, startPlacing, LOT, RECTS, shopEnts, museumEnt, houseEnt:()=>houseEnt, Time, player, ents, ITEMS, residents, World, ROOMS, goTo, handleTap, doAction, updateSky, rollDay, spawnDaily, castAt, Fishing, fishes, bugs, openBag, openBook, openShop, openBoard, openMenu, openCraft, doCraft, WOODWORK, enterRoom, exitRoom, equip, startLayout, endLayout, trees, applyControls, magic:{ startMagic, endMagic, landTap, magicPlace, castMagic, get mode(){ return magicMode; }, raiseTower, talkWizard, drinkPotion, potionOn, luckW, rollFavors, Q, favorChoices, findTowerSpot, get tower(){ return towerEnt; }, PLACES, TERRA, FALLS } };
// v1.26 test hooks
window.__game.v126 = { townNewDay, applyTown, findHomeSpot, claimHomeSpot, townCap, incomeNewDay, refreshIncome, talkIncome, incCollect, incOf, INCOME, incEnts, openMap, talkSkipperHome, talkSkipperTrip, tripGoHome, tripRecap, storyWho, askToLeave, canAskToLeave, pitchOnBuy, merchantDay, get peddler(){ return peddler; }, get skipper(){ return skipper; }, newSquares, LOAN_MAX_SQ, TRIP, TRIP_THEME, residents, residentHomes, plotEnts, KEEPOUT, Q, PATHS, camTarget, updateCamera, set camDist(v){ camDist=v; }, get camDist(){ return camDist; }, set camYaw(v){ camYaw=v; } };
// v1.25 test hooks for the house builder
window.__game.house = { LT, previewBuild:(w)=>previewBuild(w), renderBuild:(k)=>renderBuild(k), homeBlocked, planIssue, setBuildView:(v)=>setBuildView(v), mossPaintAt, buildMossLayer, roofHit, houseFrame, rebuildFloor, HOME_IDS, get houseEnt(){ return houseEnt; }, edgeTap, stairsTap, landProblem, closeBuild };
window.__game.farm = { openPlantPanel, startGridPlacing, plantGrid, checkGrid, openGarden, rebuildGardens, gardenAtXZ, islandSeeds, harvestRec, perimeter, get fenceSegs(){ return FENCE_SEGS; }, fenceHit, get placing(){ return placing; }, plantEnts, gardenEnts, CELL };
