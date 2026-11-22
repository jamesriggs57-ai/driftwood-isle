/* =====================================================================
   DRIFTWOOD ISLE: game logic
   Part 1: save state, renderer, island shape, terrain, water, paths, rooms
   ===================================================================== */
import * as THREE from 'three';
import { TAU, clamp, lerp, smooth, mulberry32, hashStr, hash2, vnoise, fbm, weightedPick, inHours, inMonths, fmt, polyDist, segDist, Time, seasonOf } from './util.js';
import { ITEMS, NATIVE_FRUITS, PLANTS, TOOLS, WOODWORK, BACKPACKS, BASE_SLOTS, HOUSE_LEVELS, RESIDENTS, DIALOGUE, PEDDLER, EVENTS, rarityLabel, RARITY_COLORS, SHOPS, INVEST, KEEPERS, MUSEUM, BUILD } from './content.js';
import { Snd } from './audio.js';
import { LAYOUTS } from './layouts.js';
import { MODEL, M, mk, G, outline, windowMat, glowMats, glowMat, glowSprites, addGlow, textSprite, PALETTE, buildItemModel, thumb, toolThumb, FURN_BUILDERS,
  buildTree, buildStump, buildShrub, buildFlower, buildTool, buildAnimal, buildPlayer, buildHouse, buildStall, buildBoard, buildPlankDeck, buildRoom, buildBird, buildGull, buildDuck } from './models.js';
import { buildCustomHouse, buildHomeInterior, buildShopBuilding, buildMuseum, buildKeeper, buildMossby, buildExhibit, planGrid, planCells, planProblem, fixDoor, linkKey, linkOf, defaultExt, defaultRoom } from './models2.js';

const $ = s => document.querySelector(s);
const World = { weather:'sunny', season:seasonOf(Time.month()), night:0, inside:null };
let buildMode=null;   // set while the home builder is open
MODEL.season = World.season; MODEL.month = Time.month();

/* ---------- Save state ---------- */
const SAVE_KEY = 'driftwood-isle-save-v1';
function freshState(){
  return { v:2, player:'', island:'', seed:(Math.random()*1e9)|0, clams:1000, inv:[], seen:{}, rec:{}, placed:[], ground:[], plants:[], cut:{},
    friend:{}, house:0, fund:0, home:null, shops:{}, museum:{}, pack:-1, tools:{}, toolEver:{}, equip:null, stats:{ bugs:0, fish:0, dug:0, chopped:0, watered:0 }, craft:null, craftHint:false, day:null, nativeFruit:null, caught:0,
    settings:{ sound:true, music:0.6, bright:1 }, layout:'classic' };
}
function migrate(s){
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
  for (const k of ['general','aquarium','garden']) if (!s.shops[k]) s.shops[k]={ tier:0, trade:0 };
  if (!s.museum.items) s.museum={ items:{}, met:false, gifts:0 };
  return s;
}
const BOOT = window.__BOOT || { mode:'guest' };
const GUEST = BOOT.mode==='guest', VISIT = BOOT.mode==='visit', CAN_EDIT = !VISIT || BOOT.role==='resident';
const GUEST_CAP = { clams:10000, cells:12, minRarity:3 };   // guest mode: wallet cap, house size, common and uncommon only
const allowedFind = it => !GUEST || (it.rarity ?? 5) >= GUEST_CAP.minRarity;
let S=null; if (BOOT.save) S=BOOT.save; else try { S=JSON.parse(localStorage.getItem(SAVE_KEY)); } catch(e){}
S = migrate((S && (S.v===1||S.v===2)) ? S : freshState());
const LAY = LAYOUTS[S.layout] || LAYOUTS.classic, LAYOUT_ID = LAYOUTS[S.layout] ? S.layout : 'classic';
if (VISIT && S.day && S.day.vpicked) S.ground = S.ground.filter(g=>!(g.beach && S.day.vpicked.includes(Math.round(g.x*10)+','+Math.round(g.z*10))));
if (LAY.homes) for (const R of RESIDENTS) if (LAY.homes[R.id]) R.home = LAY.homes[R.id];
if (!S.nativeFruit || !ITEMS[S.nativeFruit]) S.nativeFruit = NATIVE_FRUITS[S.seed % NATIVE_FRUITS.length];
const isTouchDevice = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const CTRL_DEFAULT = { move: isTouchDevice ? 'joystick' : 'tap', tapWalk:true, floating:false, size:130, opacity:0.45, jx:null, jy:null, ax:null, ay:null };
S.settings.controls = Object.assign({}, CTRL_DEFAULT, S.settings.controls||{});
if (S.settings.bright===undefined) S.settings.bright=1;
let saveOK=true;
function save(){ if (BOOT.onSave){ BOOT.onSave(S); return; } try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch(e){ saveOK=false; } }

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
function entryPrice(s){ const it=ITEMS[s.id]; return s.m ? Math.round(it.price*(0.85+0.4*(s.m.f||0))) : it.price; }
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
scene.fog = new THREE.Fog(0xbfe6f0, 70, 170);
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
  { h:7.5,  top:0x7ed0f4, bot:0xffeccc, sun:0xffecd0, si:2.7,  hs:0xf0f8ff, hg:0xa8b88a, hi:1.6 },
  { h:12,   top:0x62c4f8, bot:0xdcf8ff, sun:0xfffaf0, si:3.1,  hs:0xf4faff, hg:0xa8c48a, hi:1.75 },
  { h:16.5, top:0x72c0f0, bot:0xfff0cc, sun:0xffe6b8, si:2.8,  hs:0xfcf2e2, hg:0xa8ae8a, hi:1.6 },
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
const RIVER = [[-30,-6],[-20,-16],[-8,-24],[2,-34],[8,-46],[12,-64]];
const POND = { x:30, z:20, r:5 };
function islandR(a){ return 50 + 4.5*Math.sin(3*a+1) + 3*Math.sin(5*a+2) + 1.5*Math.sin(7*a+0.5); }
function baseHeight(x, z){
  const r=Math.hypot(x,z), a=Math.atan2(z,x), t=r/islandR(a);
  let h = -2.4 + 2.75*smooth(1.13, 0.99, t) + 0.95*smooth(0.96, 0.88, t);
  if (LAY.cliff){   // highlands: sheer drop on the west, wide gentle beach on the east
    const c=Math.cos(a), wW=smooth(-0.15,-0.6,c), wE=smooth(0.15,0.6,c);
    if (wW>0) h = lerp(h, -2.6 + 3.7*smooth(1.03, 0.995, t), wW);
    if (wE>0) h = lerp(h, -2.4 + 2.75*smooth(1.2, 0.99, t) + 0.95*smooth(0.86, 0.76, t), wE);
  }
  const inland = smooth(0.95, 0.78, t);
  h += inland*(fbm(x*0.045+3, z*0.045+7)-0.5)*1.2;
  h += 1.9*smooth(14, 3, Math.hypot(x+36, z+14))*inland;
  h += 1.2*smooth(9, 2, Math.hypot(x-38, z+24))*inland;
  const dR=polyDist(x,z,RIVER); if (dR<4.4){ const k=smooth(1.7,4.3,dR); h = lerp(Math.min(h,-1.15), h, k); }
  const dP=Math.hypot(x-POND.x, z-POND.z); if (dP<7.5) h = lerp(Math.min(h,-1.2), h, smooth(POND.r-0.4, POND.r+2.2, dP));
  return h;
}
/* v0.6 terrain preview, layered on top of the original island.
   'tiers' (default): broad gentle hills built from low, flat terraces (0.55 m steps). Every building, the plaza
   and your lot sit flat on one terrace; paths ramp smoothly between terraces.
   'hills': the earlier smooth-hills test. 'flat': the original island.
   Trees and rocks are still placed using the original heights, so every saved tree keeps its spot. */
let TERRAIN_STYLE='tiers'; try { TERRAIN_STYLE=localStorage.getItem('driftwood-terrain')||'tiers'; } catch(e){}
if (!['tiers','hills','flat'].includes(TERRAIN_STYLE)) TERRAIN_STYLE='tiers';
const HILLS = [ [-38,-16,7,14], [-24,30,6.5,13], [18,34,5.5,11], [30,-25,5.5,11] ];   // smooth style: x, z, height, radius
const MOUNDS = LAY.mounds;   // tier style
const TIER = { step:0.55, off:0.85, riser:0.2 };   // terrace height, lowest terrace, share of each step used by the slope between terraces
const HG = { x0:-62, z0:-62, step:0.5, n:249, h:null, s:null };
function hillSample(arr, x, z){ const fx=(x-HG.x0)/HG.step, fz=(z-HG.z0)/HG.step; if(fx<0||fz<0||fx>=HG.n-1||fz>=HG.n-1) return 0;
  const i=Math.floor(fx), j=Math.floor(fz), u=fx-i, v=fz-j, n=HG.n, k=j*n+i; return (arr[k]*(1-u)+arr[k+1]*u)*(1-v) + (arr[k+n]*(1-u)+arr[k+n+1]*u)*v; }
function rawHeight(x, z){ const h=baseHeight(x,z); return HG.h ? h+hillSample(HG.h,x,z) : h; }
const hillSlope = (x,z) => HG.s ? hillSample(HG.s,x,z) : 0;
const MAX_SLOPE = TERRAIN_STYLE==='tiers' ? 2.2 : 0.9;   // steeper than this is a wall you walk around (terrace edges are low enough to step up)
const SAND_H = 0.62;
const DOCK = { z:4, w:1.3, x0:0, x1:0, y:0.72 };
{ let x=30; while (rawHeight(x, DOCK.z) > 0.25 && x < 80) x += 0.2; DOCK.x0 = x-3.5; DOCK.x1 = x+10; }
const onDock = (x,z) => x>DOCK.x0 && x<DOCK.x1 && Math.abs(z-DOCK.z)<DOCK.w;
// Bridges are placed across the river where paths need to cross
function makeBridge(i, t, len=8.5, w=1.35){ const a=RIVER[i], b=RIVER[i+1]; const cx=lerp(a[0],b[0],t), cz=lerp(a[1],b[1],t); const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz); return { x:cx, z:cz, ux:-dz/L, uz:dx/L, len, w }; }
const BRIDGES = [ makeBridge(2,0.5), makeBridge(1,0.35) ];
function bridgeLocal(b,x,z){ const dx=x-b.x, dz=z-b.z; return [dx*b.ux+dz*b.uz, -dx*b.uz+dz*b.ux]; }
function onBridge(x,z){ for(const b of BRIDGES){ const [u,v]=bridgeLocal(b,x,z); if(Math.abs(u)<b.len/2 && Math.abs(v)<b.w) return b; } return null; }
const bridgeY = (b,x,z) => { const [u]=bridgeLocal(b,x,z); return 0.45+0.45*Math.cos(clamp(u/(b.len/2),-1,1)*Math.PI/2); };

/* Rooms (house interiors) live far away from the island and are shown only when you are inside */
const ROOMS = {};
const roomOrigin = i => [700 + i*60, 700];
function roomAt(x,z){ for(const id in ROOMS){ const R=ROOMS[id]; if (Math.abs(x-R.ox)<R.w/2+1 && Math.abs(z-R.oz)<R.d/2+1.5) return R; } return null; }
const roomWalk = (R,x,z) => R.walk ? R.walk(x,z) : (Math.abs(x-R.ox)<R.w/2-0.4 && z>R.oz-R.d/2+0.4 && z<R.oz+R.d/2-0.05);

function groundY(x,z){ if (x>500) return 0; const b=onBridge(x,z); if(b) return bridgeY(b,x,z); if (onDock(x,z)) return DOCK.y; return Math.max(rawHeight(x,z), -0.2); }
function walkable(x,z){ if (x>500){ const R=roomAt(x,z); return !!R && roomWalk(R,x,z); } return onDock(x,z) || !!onBridge(x,z) || (rawHeight(x,z) > 0.1 && hillSlope(x,z) < MAX_SLOPE); }
function isFishWater(x,z){ return x<500 && !walkable(x,z) && rawHeight(x,z) < -0.15; }
function waterType(x,z){ if (Math.hypot(x-POND.x,z-POND.z)<POND.r+1.5) return 'pond'; const r=Math.hypot(x,z), t=r/islandR(Math.atan2(z,x)); if (polyDist(x,z,RIVER)<3.2 && t<1.0) return 'river'; return 'sea'; }
const isBeach = (x,z) => { const h=rawHeight(x,z), t=Math.hypot(x,z)/islandR(Math.atan2(z,x)); return h>0.15 && h<SAND_H && t>0.88; };

/* Layout: where buildings sit. Door is in front (+z). */
const PLACES = JSON.parse(JSON.stringify(LAY.places));
const LOT = { ...LAY.lot };   // center of the player's building lot (7 x 6 cells)
for (const R of RESIDENTS) PLACES[R.id]=R.home;
const door = (k,off=3.2) => [PLACES[k][0], PLACES[k][1]+off];
const bA=BRIDGES[0], bB=BRIDGES[1];
const bEnd = (b,s) => [b.x+b.ux*s*(b.len/2+0.6), b.z+b.uz*s*(b.len/2+0.6)];
// The original island layout. Trees and rocks were placed around these, so they stay the reference for placing them
// (that keeps every saved tree in the same spot). The paths you actually see are PATHS below.
const PATHS_V4 = [
  [[0,0],[11,-3]], [[0,0],[-4,-1]], [[0,0],[-6,6],door('home')], [[0,0],[14,3],[DOCK.x0-1,DOCK.z]],
  [[0,0],[10,8],door('pippa')], [[0,0],[2,14],door('lumi')], [[0,0],[-16,4],door('bramble')], [[0,0],[20,-2],door('otis')],
  [[0,0],[8,-14],door('clover')],
  [[0,0],[0,-14],bEnd(bA,1)], [bEnd(bA,-1),[-7,-36],door('mabel')], [bEnd(bA,-1),[-18,-36],door('juniper')],
  [[-16,4],[-18,-4],bEnd(bB,1)],
];
const PATHS_NEW = [
  [[0,0],[1.5,-8],[3,-12.6]],                          // museum
  [[1.5,-8],[-5.5,-12],[-5.5,-20],bEnd(bA,1)],         // south bridge (goes around the museum)
  [[1.5,-8],[11,-10],[13,-20],door('clover')],
  [[11,-10],[20,-11.4]],                               // aquarium shop
  [[-8.5,2.2],[-12,-1.8]],                             // bug & bloom
];
// Other layouts: paths are generated from the plaza to every door (around buildings whose door faces away).
function genPaths(){
  const out=[], P=PLACES;
  const to=(k,off)=>{ const [x,z]=P[k], d=[x, z+(off||3.2)];
    if (z+1.5 < 0 || Math.abs(x) > Math.abs(z)+4) { out.push([[0,0],[x*0.55, Math.min(0, z)*0.55 + d[1]*0.45], d]); return; }
    const s = x>=0 ? 1 : -1; out.push([[0,0],[x+s*6.5, z+0.5],[x+s*4, d[1]+1.8],[x,d[1]]]); };
  for (const k of Object.keys(P)) if (k!=='plaza' && k!=='board') to(k, k==='museum'?6.2:k==='aquarium'||k==='garden'?4.4:3.2);
  out.push([[0,0],[-3.5,-3]]);
  out.push([[0,0],[14,3],[DOCK.x0-1,DOCK.z]]);
  out.push([[0,0],[-7,-8],[-8,-14],bEnd(bA,1)]);
  out.push([[-6,2],[-16,-6],[-18,-9],bEnd(bB,1)]);
  return out;
}
const PATHS = LAYOUT_ID==='classic' ? [...PATHS_V4.filter((p,i)=>i!==8 && i!==9), ...PATHS_NEW] : genPaths();
if (LAYOUT_ID!=='classic'){ PATHS_V4.length=0; PATHS_V4.push(...PATHS); PATHS_NEW.length=0; }
let layoutPhase=true;   // true while the original trees and rocks are being placed
const pathDist = (x,z) => { let m=1e9; for(const p of (layoutPhase?PATHS_V4:PATHS)) m=Math.min(m, polyDist(x,z,p)); return m; };
const newPathDist = (x,z) => { let m=1e9; for(const p of PATHS_NEW) m=Math.min(m, polyDist(x,z,p)); return m; };

{ const { GW, GD, EC }=BUILD, lot=[LOT.x-GW*EC/2, LOT.z-GD*EC/2, LOT.x+GW*EC/2, LOT.z+GD*EC/2+2.2];
  const n=HG.n, h=new Float32Array(n*n);
  const lotDist=(x,z)=>Math.hypot(Math.max(lot[0]-x,0,x-lot[2]), Math.max(lot[1]-z,0,z-lot[3]));
  // where terrain may change at all: inland, away from the river, pond and coast
  const natMask=(x,z)=>{ const a=Math.atan2(z,x), t=Math.hypot(x,z)/islandR(a); let m=smooth(0.86,0.72,t);
    if (LAY.cliff){ const c=Math.cos(a); m=lerp(m, smooth(0.995,0.97,t), smooth(-0.15,-0.6,c)); m=lerp(m, smooth(0.78,0.66,t), smooth(0.15,0.6,c)); }
    if(m<=0) return 0; return m*smooth(5,10,polyDist(x,z,RIVER))*smooth(8,13,Math.hypot(x-POND.x,z-POND.z)); };
  if (TERRAIN_STYLE==='hills'){
    const spots=Object.entries(PLACES).map(([k,p])=>[p[0], p[1]+(k==='museum'?3:1), k==='plaza'?7:6.5]);
    for(let j=0;j<n;j++) for(let i=0;i<n;i++){ const x=HG.x0+i*HG.step, z=HG.z0+j*HG.step;
      let m=natMask(x,z); if(m<=0) continue;
      m*=smooth(1.4,4.5,visPathDistH(x,z)); if(m<=0) continue;
      for(const [px,pz,r] of spots){ m*=smooth(r,r+5,Math.hypot(x-px,z-pz)); if(m<=0) break; } if(m<=0) continue;
      m*=smooth(1,5,lotDist(x,z)); if(m<=0) continue;
      let v=1.5*smooth(0.42,0.78,fbm(x*0.035+11,z*0.035-4));
      for(const [cx,cz,A,R] of HILLS){ const d=Math.hypot(x-cx,z-cz)/R; if(d<1) v+=A*(0.5+0.5*Math.cos(Math.PI*d)); }
      h[j*n+i]=v*m; }
  } else if (TERRAIN_STYLE==='tiers'){
    const { step, off, riser }=TIER;
    const lift=(x,z)=>{ let v=1.2*smooth(0.35,0.8,fbm(x*0.022+5,z*0.022+9)) + (LAY.cliff ? 2.2*smooth(-16,-40,x) : 0); const wx=x+(fbm(x*0.06+21,z*0.06+3)-0.5)*10, wz=z+(fbm(x*0.06-7,z*0.06+17)-0.5)*10;   // warped so terraces have natural, wobbly outlines
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
      if(nm<=0 && pw<=0) continue;
      const b=baseHeight(x,z); let v=b+lift(x,z)*nm;
      for(const [px,pz,r,pv] of pads){ const d=Math.hypot(x-px,z-pz); if(d<r+5) v=lerp(v,pv,smooth(r+5,r,d)); }
      if(ld<5) v=lerp(v,lotV,smooth(5,1.2,ld));
      const f=quant(v);   // paths simply step up and down with the terraces (edges are low enough to walk over)
      h[j*n+i]=(lerp(b,f,Math.max(smooth(0,0.35,nm),pw)))-b; }
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
const TIER_EDGE=new THREE.Color(0x6f8c3c), SAND=new THREE.Color(0xf3dca6), WETSAND=new THREE.Color(0xd9be86), DIRT=new THREE.Color(0xc9a06a), SEABED=new THREE.Color(0x6fc8c0), DEEP=new THREE.Color(0x2f7f9a), RIVERBED=new THREE.Color(0x8ab89a);
function buildTerrain(){
  const SZ=TERRAIN_STYLE==='tiers'?132:150, N=TERRAIN_STYLE==='tiers'?(isMobile?245:290):(isMobile?190:230);
  const g = new THREE.PlaneGeometry(SZ, SZ, N, N); g.rotateX(-Math.PI/2);
  const pos=g.attributes.position, cols=new Float32Array(pos.count*3), c=new THREE.Color();
  const grass = PAL.grass.map(h=>new THREE.Color(h));
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getZ(i), y=rawHeight(x,z); pos.setY(i,y);
    const inland = polyDist(x,z,RIVER)<4.5 || Math.hypot(x-POND.x,z-POND.z)<7.5;
    if (y < 0) { if (inland) c.copy(RIVERBED).lerp(DEEP, smooth(-0.2,-1.3,y)*0.5); else { c.copy(SEABED).lerp(DEEP, smooth(-0.1,-2.2,y)); c.lerp(SAND, smooth(-0.6,0,y)*0.6); } }
    else if (y < 0.18) c.copy(inland?new THREE.Color(0x9a8a6a):WETSAND);
    else if (y < SAND_H && !inland) c.copy(SAND).offsetHSL(0,0,(vnoise(x*1.3,z*1.3)-0.5)*0.04);
    else {
      const n=fbm(x*0.08,z*0.08); c.copy(grass[0]).lerp(grass[1], n).lerp(grass[2], smooth(0.55,0.85,vnoise(x*0.2,z*0.2))*0.7);
      c.offsetHSL(0,0,(vnoise(x*2.2,z*2.2)-0.5)*0.05);
      const pd=visPathDist(x,z); if (pd<1.4) c.lerp(DIRT, smooth(1.4,0.6,pd)*(World.season==='winter'?0.35:0.7));
      if (!inland) c.lerp(SAND, smooth(SAND_H+0.2, SAND_H, y)); else if (y<SAND_H) c.lerp(new THREE.Color(0x9a8a6a), smooth(SAND_H,0.2,y));
      if (HG.h && TERRAIN_STYLE==='hills'){ const hl=hillSample(HG.h,x,z); if (hl>0.4) c.offsetHSL(0.012,-0.03,smooth(0.4,5,hl)*0.07); }
      if (HG.h && TERRAIN_STYLE==='tiers'){ const sl=hillSample(HG.s,x,z); if (sl>0.18 && pd>1.4) c.lerp(TIER_EDGE, smooth(0.18,0.6,sl)*0.75); }
    }
    cols[i*3]=c.r; cols[i*3+1]=c.g; cols[i*3+2]=c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols,3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:0.95 })); m.receiveShadow = true; return m;
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
const waterMat = new THREE.MeshStandardMaterial({ color:0x4cc3d6, transparent:true, opacity:0.78, roughness:0.18, metalness:0.05, flatShading:true });
const water = new THREE.Mesh(waterGeo, waterMat); water.receiveShadow = true; OUT.add(water);
const deepSea = new THREE.Mesh(new THREE.PlaneGeometry(1200,1200), new THREE.MeshStandardMaterial({ color:0x2a8aa8, roughness:0.4 })); deepSea.rotation.x=-Math.PI/2; deepSea.position.y=-1.2; OUT.add(deepSea);
function updateWater(t){ const a=waterGeo.attributes.position.array; for(let i=0;i<a.length;i+=3){ const x=waterBase[i], z=waterBase[i+2]; a[i+1]=Math.sin(x*0.25+t*0.9)*0.07+Math.cos(z*0.3+t*0.7)*0.06+Math.sin((x+z)*0.6+t*1.6)*0.025-0.02; } waterGeo.attributes.position.needsUpdate=true; }
const foam = (()=>{ const N=260, inner=[], outer=[]; for(let i=0;i<=N;i++){ const a=i/N*TAU; let r=35; while(rawHeight(Math.cos(a)*r, Math.sin(a)*r)>0 && r<80) r+=0.08; inner.push([Math.cos(a)*(r-0.5), Math.sin(a)*(r-0.5)]); outer.push([Math.cos(a)*(r+0.6), Math.sin(a)*(r+0.6)]); }
  const p=[], idx=[]; for(let i=0;i<=N;i++){ p.push(inner[i][0],0.05,inner[i][1], outer[i][0],0.05,outer[i][1]); if(i<N){ const k=i*2; idx.push(k,k+1,k+2, k+1,k+3,k+2); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.setIndex(idx);
  const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.55, depthWrite:false })); OUT.add(m); return m; })();

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
// Cobblestone paths (instanced)
{ const r=mulberry32(77); const geo=G.cyl(0.26,0.3,0.08,8); const N=2600; const im=new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness:0.9 }), N); let n=0; const dm=new THREE.Object3D(), col=new THREE.Color();
  const stoneCols=[0xd8cdb8,0xc8bca6,0xe2d8c4,0xbfb29a];
  for (const P of PATHS) for(let i=0;i<P.length-1;i++){ const [ax,az]=P[i], [bx,bz]=P[i+1]; const L=Math.hypot(bx-ax,bz-az); const nx=-(bz-az)/L, nz=(bx-ax)/L;
    for(let d=0; d<L && n<N; d+=0.62){ for(const off of [-0.5,0.05,0.55]){ const j=(r()-0.5)*0.22; const x=ax+(bx-ax)*d/L+nx*(off+j), z=az+(bz-az)*d/L+nz*(off+j);
      if (!walkable(x,z) || onBridge(x,z) || onDock(x,z) || rawHeight(x,z)<0.3 || r()<0.12) continue;
      dm.position.set(x, groundY(x,z)+0.0, z); dm.rotation.set((r()-0.5)*0.06, r()*TAU, (r()-0.5)*0.06); const s=0.75+r()*0.45; dm.scale.set(s,1,s*(0.8+r()*0.3)); dm.updateMatrix(); im.setMatrixAt(n, dm.matrix); im.setColorAt(n, col.setHex(stoneCols[n%4]).offsetHSL(0,0,(r()-0.5)*0.05)); n++; } } }
  im.count=n; im.receiveShadow=true; OUT.add(im); }
/* Part 2: entities (things you can interact with), tools, critters */

const ents=[]; const pickList=[];
class Ent {
  constructor(kind, x, z, r=0.6){ this.kind=kind; this.pos=new THREE.Vector3(x, groundY(x,z), z); this.r=r; this.solid=false; this.reach=r+1.0; this.obj=null; }
  parentGroup(){ if (this.pos.x>500){ const R=roomAt(this.pos.x,this.pos.z); return R?R.group:scene; } return OUT; }
  attach(obj){ this.obj=obj; obj.position.copy(this.pos); obj.traverse(c=>{ c.userData.ent=this; }); this.parentGroup().add(obj); ents.push(this); pickList.push(obj); return this; }
  swap(obj){ const i=pickList.indexOf(this.obj); const p=this.obj.parent; if(p) p.remove(this.obj); this.obj=obj; obj.position.copy(this.pos); obj.traverse(c=>{ c.userData.ent=this; }); (p||this.parentGroup()).add(obj); if(i>=0) pickList[i]=obj; else pickList.push(obj); }
  hitSphere(r, y){ const h=new THREE.Mesh(G.sph(r,6,4), new THREE.MeshBasicMaterial({ visible:false })); h.position.y=y; h.userData.ent=this; this.obj.add(h); }
  remove(){ if(this.obj.parent) this.obj.parent.remove(this.obj); const i=ents.indexOf(this); if(i>=0) ents.splice(i,1); const j=pickList.indexOf(this.obj); if(j>=0) pickList.splice(j,1); this.removed=true; }
  label(){ return null; } act(){} update(){}
}
const today = () => S.day ? S.day.key : Time.dayKey();

/* ---------- Tools ---------- */
const hasTool = t => !!S.tools[t];
const toolTier = t => S.tools[t] ? S.tools[t].tier : -1;
const toolDef = t => TOOLS[t].tiers[toolTier(t)];
const article = n => /^[aeiou]/i.test(n) ? 'an' : 'a';
const isForever = t => { const T=S.tools[t]; return !!(T && TOOLS[t].tiers[T.tier] && TOOLS[t].tiers[T.tier].forever); };
function useTool(t){
  const T=S.tools[t]; if(!T) return false; if (isForever(t)){ save(); return true; } T.uses--;
  if (T.uses<=0){ const nm=TOOLS[t].tiers[T.tier].name; delete S.tools[t]; if(S.equip===t) S.equip=null; Snd.breakTool(); setTimeout(()=>toast(`Your ${nm} broke! Buy a new one at the stall.`),400); updateHeld(); }
  else if (T.uses===5) setTimeout(()=>toast(`Your ${TOOLS[t].tiers[T.tier].name} is looking worn out.`),400);
  save(); return true;
}
function needTool(t){ if (hasTool(t)){ if (S.equip!==t) equip(t); return true; } toast(`You need ${article(TOOLS[t].name)} ${TOOLS[t].name.toLowerCase()} for that. The stall sells them.`); Snd.fail(); return false; }
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
  fruitLeft(){ if(!this.fruit || this.stage<3) return 0; if(!S.day) return 3; const v=S.day.fruit[this.key]; return v===undefined?3:v; }
  refresh(){ const n=this.fruitLeft(), fr=this.obj.userData.fruits||[], per=fr.length>3?2:1; fr.forEach((m,i)=>m.visible=i<n*per); }
  label(){ if (S.equip==='axe' && this.stage>=2) return 'Chop'; if (S.equip==='shovel' && this.stage<=1) return 'Dig up'; if (S.equip==='can' && this.stage<3 && this.rec && this.rec.watered!==today()) return 'Water'; return this.stage>=2 ? 'Shake' : 'Look'; }
  act(){
    const lab=this.label();
    if ((lab==='Chop'||lab==='Dig up'||lab==='Water') && noEdit()) return;
    if (lab==='Chop') return this.chop();
    if (lab==='Dig up'){ if(!useTool('shovel')) return; Snd.dig(); S.plants.splice(S.plants.indexOf(this.rec),1); this.remove(); const id = this.type==='fruittree' ? this.fruit : this.type+'_sapling'; dropNear(ITEMS[id]?id:'oak_sapling', this.pos, 0.3, true); S.stats.dug++; save(); return; }
    if (lab==='Water'){ waterPlant(this.rec, this.pos); return; }
    if (lab==='Look'){ toast(`A young ${(PLANTS[this.type]||{name:'tree'}).name.toLowerCase()}. It grows a little every day, faster if watered.`); return; }
    this.shake=1; Snd.rustle(); const tp=this.pos.clone(); tp.y+=2.8; puff(tp, World.season==='winter'?0xffffff:0x6cc050, 6, 0.8, 1, 1.2, 1);
    const n=this.fruitLeft();
    if (n>0){ S.day.fruit[this.key]=0; for(let i=0;i<n;i++) setTimeout(()=>dropNear(this.fruit, this.pos, 1.6), 250+i*120); }
    else if (!S.day.branch[this.key] && Math.random()<0.7){ S.day.branch[this.key]=true; setTimeout(()=>dropNear('softwood', this.pos, 1.6), 300); }
    save(); setTimeout(()=>this.refresh(),250);
  }
  chop(){
    const tier=toolTier('axe'); if(!useTool('axe')) return;
    const n=(S.day.chop[this.key]||0); S.day.chop[this.key]=n+1; S.stats.chopped++;
    this.shake=0.7; Snd.chop(); puff(this.pos.clone().add(new THREE.Vector3(0,1,0)), 0xd8b080, 5, 0.4, 1.5, 0.8, 0.5);
    if (n<3){ dropNear('wood', this.pos, 1.6); if (tier>=2) dropNear('wood', this.pos, 1.6); if (n===2 && !TOOLS.axe.tiers[tier].nofell) setTimeout(()=>toast('One more chop will cut this tree down.'),300); }
    else if (TOOLS.axe.tiers[tier].nofell) toast('This flimsy axe can\'t cut a tree down. A sturdy axe can.');
    else { Snd.timber(); dropNear('wood', this.pos, 1.6);
      if (this.rec){ S.plants.splice(S.plants.indexOf(this.rec),1); } else S.cut[this.key]='gone';
      const st={ key:this.key, x:this.pos.x, z:this.pos.z }; S.stumps.push(st); new Stump(st); this.remove(); onFelled(this.pos.clone()); puff(this.pos.clone().add(new THREE.Vector3(0,2,0)), 0x6cc050, 14, 1.4, 2, 1.4, 1.2); }
    save();
  }
  update(dt,t){ const top=this.obj.userData.top; if(!top) return; top.rotation.z=Math.sin(t*0.9+this.pos.x)*0.012+Math.sin(t*38)*0.07*this.shake; top.rotation.x=Math.cos(t*0.7+this.pos.z)*0.01; if(this.shake>0) this.shake=Math.max(0,this.shake-dt*1.6); }
}
class Stump extends Ent {
  constructor(rec){ super('stump',rec.x,rec.z,0.45); this.rec=rec; this.solid=true; this.reach=1.4; this.attach(buildStump()); }
  label(){ return S.equip==='shovel' ? 'Dig up' : 'Look'; }
  act(){ if (this.label()==='Look'){ toast('A tree stump. Dig it up with a shovel.'); return; } if(!useTool('shovel')) return; Snd.dig(); puff(this.pos.clone().add(new THREE.Vector3(0,0.3,0)),0xb08a5a,8,0.6,2.5,1,0.6); S.stumps.splice(S.stumps.indexOf(this.rec),1); this.remove(); dropNear('wood', this.pos, 1); S.stats.dug++; save(); }
}
if (!S.stumps) S.stumps=[];

/* ---------- Rocks, dig spots, items, weeds ---------- */
function buildRockModel(r){ const g=new THREE.Group(); const c=[0x9aa1a8,0x8a9198,0xa8afb5]; mk(G.dod(0.75), M(c[0],{flatShading:true}), 0,0.45,0,g).scale.set(1.1,0.8,1); mk(G.dod(0.45), M(c[1],{flatShading:true}), 0.6,0.25,0.3,g); mk(G.dod(0.35), M(c[2],{flatShading:true}), -0.5,0.2,0.35,g); const moss=mk(G.sph(0.35,10,6), M(0x6a9a4a), -0.1,0.78,0.05,g); moss.scale.set(1.2,0.25,1); g.rotation.y=r()*TAU; return g; }
class Rock extends Ent {
  constructor(idx,x,z,r){ super('rock',x,z,0.95); this.idx=idx; this.solid=true; this.reach=1.9; this.hit=0; this.attach(buildRockModel(r)); }
  label(){ return 'Hit'; }
  act(){
    const t = (S.equip==='shovel'||S.equip==='axe') ? S.equip : (hasTool('shovel')?'shovel':(hasTool('axe')?'axe':null));
    if (!t){ toast('You need a shovel or an axe to break off rocks.'); Snd.fail(); return; }
    if (S.equip!==t) equip(t);
    const used=S.day.rock[this.idx]||0; this.hit=1; Snd.thunk(); puff(this.pos.clone().add(new THREE.Vector3(0,0.6,0)), 0xb8bec4, 5, 0.6, 2, 0.8, 0.5);
    if (used>=4){ toast('The rock is all tapped out for today.'); return; }
    if (!useTool(t)) return; S.day.rock[this.idx]=used+1;
    if (this.idx===S.day.lucky){ const amt=[100,200,400,800][used]; addClams(amt); Snd.coin(); toast('A pouch of '+amt+' clams popped out!'); }
    else { const x=Math.random(); dropNear(x<0.6?'stone':(x<0.88?'clay':'iron'), this.pos, 1.7); }
    save();
  }
  update(dt){ if(this.hit>0){ this.hit=Math.max(0,this.hit-dt*5); const s=1+Math.sin(this.hit*Math.PI)*0.08; this.obj.scale.set(s,2-s,s); } }
}
class DigSpot extends Ent {
  constructor(i,x,z){ super('dig',x,z,0.4); this.i=i; this.reach=1.3; const g=new THREE.Group(); for(const a of [0.6,-0.6]){ const m=mk(G.box(0.7,0.03,0.12), M(0x6a4a30), 0,0.03,0,g); m.rotation.y=a; m.castShadow=false; } this.attach(g); this.hitSphere(0.5,0.2); }
  label(){ return 'Dig'; }
  act(){ if(!needTool('shovel') || !useTool('shovel')) return; Snd.dig(); puff(this.pos.clone().add(new THREE.Vector3(0,0.2,0)), 0xb08a5a, 8, 0.6, 2.5, 1, 0.6); S.day.digs[this.i].dug=true; S.stats.dug++;
    const f=weightedPick(Math.random, Object.values(ITEMS).filter(i=>i.kind==='fossil' && allowedFind(i)), i=>i.rarity); this.remove(); setTimeout(()=>dropNear(f.id, this.pos, 0.3, true), 200);
    if (toolTier('shovel')>=2 && Math.random()<0.3){ addClams(300); toast(`Your ${TOOLS.shovel.tiers[toolTier('shovel')].name.toLowerCase()} turned up 300 clams too!`); Snd.coin(); } save(); }
}
class GroundItem extends Ent {
  constructor(rec){ super('item',rec.x,rec.z,0.35); this.rec=rec; this.reach=1.2; const m=buildItemModel(rec.id); m.scale.setScalar(ITEMS[rec.id].kind==='furniture'?0.6:0.95); const g=new THREE.Group(); g.add(m); this.attach(g); this.hitSphere(0.45,0.3); this.spin=Math.random()*TAU; this.bounce=rec.fresh?1:0; delete rec.fresh; }
  label(){ return 'Pick up'; }
  act(){ if (!this.rec.beach && noEdit()) return; const id=this.rec.id, res=addItem(id, this.rec.m); if(!res){ toast('Your bag is full. Sell or drop something first.'); return; } Snd.pop(); const i=S.ground.indexOf(this.rec); if(i>=0) S.ground.splice(i,1); if (VISIT && this.rec.beach){ (S.day.vpicked=S.day.vpicked||[]).push(Math.round(this.rec.x*10)+','+Math.round(this.rec.z*10)); } this.remove(); save(); itemToast(id, res==='new', 'Picked up'); craftNudge(id); }
  update(dt,t){ this.obj.children[0].rotation.y=this.spin+Math.sin(t*1.5+this.spin)*0.2; if(this.bounce>0){ this.bounce=Math.max(0,this.bounce-dt*2.2); this.obj.position.y=this.pos.y+Math.abs(Math.sin(this.bounce*Math.PI*2))*this.bounce*1.4; } }
}
class Weed extends Ent {
  constructor(i,x,z){ super('weed',x,z,0.35); this.i=i; this.reach=1.2; this.attach(buildItemModel('weed')); this.hitSphere(0.45,0.25); }
  label(){ return 'Pull'; }
  act(){ const r=addItem('weed'); if(!r){ toast('Your bag is full.'); return; } Snd.rustle(); puff(this.pos.clone().add(new THREE.Vector3(0,0.3,0)),0x5a9a3a,5,0.4,2,0.7,0.5); S.day.weeds[this.i].pulled=true; this.remove(); save(); itemToast('weed', r==='new','Pulled'); }
}

/* ---------- Planted flowers and shrubs ---------- */
function waterPlant(rec, pos){ if(!useTool('can')) return; rec.watered=today(); S.stats.watered++; Snd.water(); for(let i=0;i<8;i++) puff(pos.clone().add(new THREE.Vector3((Math.random()-0.5)*0.6,0.8,(Math.random()-0.5)*0.6)),0x7fc8f0,1,0.15,-1,0.4,0.5); toast('Watered. It will grow faster tomorrow.'); save(); }
class Plant extends Ent {
  constructor(rec){ super('plant',rec.x,rec.z,0.3); this.rec=rec; this.reach=1.3; this.attach(this.model()); this.hitSphere(0.4,0.3); this.obj.rotation.y=rec.rot||0; }
  model(){ const P=PLANTS[this.rec.sp]; return P.ptype==='flower' ? buildFlower(this.rec.sp, this.rec.stage, this.rec.color) : buildShrub(this.rec.sp, this.rec.stage, this.rec.color); }
  rebuild(){ const ry=this.obj.rotation.y; this.swap(this.model()); this.hitSphere(0.4,0.3); this.obj.rotation.y=ry; this.solid = PLANTS[this.rec.sp].ptype==='shrub' && this.rec.stage>=2; this.r = this.solid?0.6:0.3; }
  label(){ const P=PLANTS[this.rec.sp];
    if (S.equip==='can' && this.rec.watered!==today() && (this.rec.stage<3)) return 'Water';
    if (S.equip==='shovel') return 'Dig up';
    if (P.ptype==='flower' && this.rec.stage===3) return 'Pick';
    if (S.equip==='can' && this.rec.watered!==today()) return 'Water';
    return 'Look'; }
  act(){ const lab=this.label(), P=PLANTS[this.rec.sp];
    if ((lab==='Water'||lab==='Dig up') && noEdit()) return;
    if (lab==='Water') return waterPlant(this.rec, this.pos);
    if (lab==='Pick'){ const r=addItem(this.rec.sp); if(!r){ toast('Your bag is full.'); return; } this.rec.stage=2; Snd.pop(); this.rebuild(); itemToast(this.rec.sp, r==='new', 'Picked'); save(); return; }
    if (lab==='Dig up'){ if(!useTool('shovel')) return; Snd.dig(); S.plants.splice(S.plants.indexOf(this.rec),1); this.remove(); dropNear(P.ptype==='flower'?this.rec.sp+'_seeds':this.rec.sp+'_start', this.pos, 0.3, true); S.stats.dug++; save(); return; }
    const st=['just planted','sprouting','growing','fully grown'][this.rec.stage];
    toast(`${P.name}: ${st}.${this.rec.stage<3?' Water it to help it grow.':''}`);
  }
}

/* ---------- Furniture and buildings ---------- */
class Furniture extends Ent {
  constructor(rec){ const it=ITEMS[rec.id]; super('furn',rec.x,rec.z,it.r); this.rec=rec; this.solid=!it.flat; this.reach=it.r+1.1; const m=buildItemModel(rec.id); m.rotation.y=rec.rot||0; const g=new THREE.Group(); g.add(m); this.attach(g); this.model=m; if(it.flat) this.hitSphere(0.9,0.1); }
  label(){ return this.rec.id==='workbench' && S.craft ? 'Craft' : 'Arrange'; }
  act(){ if (!CAN_EDIT){ if (this.rec.id==='workbench' && S.craft) openCraft(); else toast('Nice, isn\'t it?'); return; } showChoices(ITEMS[this.rec.id].name, [
    ...(this.rec.id==='workbench' && S.craft ? [{ label:'Woodworking', fn:()=>openCraft() }] : []),
    { label:'Move', fn:()=>startPlacing(this.rec.id,'furn',this) },
    { label:'Rotate', fn:()=>{ this.rec.rot=((this.rec.rot||0)+Math.PI/4)%TAU; this.model.rotation.y=this.rec.rot; Snd.click(); save(); } },
    { label:'Pick up', fn:()=>{ if(!addItem(this.rec.id)){ toast('Your bag is full.'); return; } S.placed.splice(S.placed.indexOf(this.rec),1); this.remove(); Snd.pop(); save(); } },
    { label:'Leave it', alt:true, fn:()=>{} } ]); }
  update(dt,t){ const f=this.model.userData.flame; if(f){ f.scale.set(1+Math.sin(t*13)*0.08, 1+Math.sin(t*17+1)*0.15, 1+Math.cos(t*11)*0.08); } }
}
class Building extends Ent {
  constructor(kind,x,z,r,obj,labelText,onAct){ super(kind,x,z,r); this.solid=true; this.reach=r+1.4; this._l=labelText; this._a=onAct; this.attach(obj); }
  label(){ return typeof this._l==='function'?this._l():this._l; } act(){ this._a(this); }
}

/* ---------- Residents ---------- */
const asleepNow = () => { const h=Time.hour(); return h>=23 || h<6; };
class Resident extends Ent {
  constructor(spec){
    const [hx,hz]=spec.home; super('resident',hx+1,hz+3.4,0.45); this.spec=spec; this.reach=1.7; this.solid=true;
    this.attach(buildAnimal(spec)); this.hitSphere(0.9,1.0);
    this.state='idle'; this.timer=1+Math.random()*3; this.target=null; this.face=0; this.stuckT=0; this.talking=false; this.loc='out'; this.lying=false;
    this.zzz=textSprite('z','#6a7ab8'); this.zzz.visible=false; scene.add(this.zzz);
  }
  get room(){ return ROOMS[this.spec.id]; }
  wantsHome(){ if (asleepNow()) return true; const h=Time.hour(); return (this.spec.homeHours||[]).some(hr=>inHours(h,hr)); }
  get asleep(){ return asleepNow() && this.loc==='in'; }
  label(){ return 'Talk'; }
  act(){ talkTo(this); }
  setLoc(loc){ const R=this.room; this.loc=loc; this.setLying(false);
    if (loc==='in'){ this.pos.set(R.entry[0], 0, R.entry[1]-0.8); this.obj.parent && this.obj.parent.remove(this.obj); R.group.add(this.obj); }
    else { this.pos.set(R.exit[0]+0.6, 0, R.exit[1]+0.4); this.pos.y=groundY(this.pos.x,this.pos.z); this.obj.parent && this.obj.parent.remove(this.obj); OUT.add(this.obj); }
    this.obj.position.copy(this.pos); this.state='idle'; this.timer=1; }
  setLying(on){ if (this.lying===on) return; this.lying=on; if (on){ const b=this.room.bed; this.pos.set(b[0],0.55,b[1]+0.2); this.obj.position.copy(this.pos); this.obj.rotation.set(-Math.PI/2,0,0); } else { this.obj.rotation.set(0,this.obj.rotation.y,0); this.pos.y = this.loc==='in'?0:groundY(this.pos.x,this.pos.z); } }
  update(dt,t){
    const u=this.obj.userData; this.zzz.visible=false;
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
class Peddler extends Ent {
  constructor(){ const x=DOCK.x0-2.5, z=DOCK.z-3.4; super('peddler',x,z,0.6); this.solid=true; this.reach=1.9;
    const g=new THREE.Group(); const a=buildAnimal({ species:'frog', ears:'none', fur:0x7fbf5a, muzzle:0xe8f0c0, shirt:0x8a5ab8, cheek:0xf5a3a3 }); g.add(a); this.a=a;
    mk(G.box(2,0.04,1.4), M(0xd8604d), 1.4,0.02,0.2,g).castShadow=false; mk(G.box(0.6,0.4,0.4), M(0xa8754a), 1.0,0.2,0,g); mk(G.box(0.5,0.5,0.4), M(0x8a6ab8), 1.8,0.25,0.2,g);
    this.attach(g); this.hitSphere(1.0,1.0); this.obj.rotation.y=-0.4; }
  label(){ return 'Talk'; }
  act(){ dialog(PEDDLER.name, PEDDLER.voice, [PEDDLER.greet], ()=>openShop('rare')); }
  update(dt,t){ this.a.userData.body.position.y=Math.abs(Math.sin(t*2))*0.05; }
}

/* ---------- Bugs: sneak up slowly, or they flee ---------- */
const bugs=[];
const CATCH_BASE = { 'Common':0.85, 'Uncommon':0.72, 'Rare':0.58, 'Very rare':0.48, 'Legendary':0.4 };
const SKITTISH = { 'Common':0.7, 'Uncommon':1.1, 'Rare':1.6, 'Very rare':2.2, 'Legendary':3 };
class Bug extends Ent {
  constructor(id, x, z, extra={}){ super('bug',x,z,0.3); this.id=id; this.it=ITEMS[id]; this.where=this.it.where; this.reach=1.5;
    const m=buildItemModel(id); m.scale.setScalar(this.where==='air'?1.1:0.9); const g=new THREE.Group(); g.add(m); this.m=m; this.attach(g); this.hitSphere(0.8,0.5);
    this.home=new THREE.Vector3(x,0,z); this.ph=Math.random()*10; this.alt= this.where==='air' ? 0.8+Math.random()*1.4 : (this.where==='trunk'?1.1+Math.random()*0.6:0.05); this.flee=0; this.hop=0; this.trunk=extra.trunk||null;
    if (this.trunk){ const a=Math.random()*TAU; this.pos.set(this.trunk.x+Math.cos(a)*0.32, groundY(this.trunk.x,this.trunk.z)+this.alt, this.trunk.z+Math.sin(a)*0.32); this.m.rotation.set(-Math.PI/2,0,0); this.obj.rotation.y=Math.atan2(Math.cos(a),Math.sin(a)); this.obj.position.copy(this.pos); }
    this.glow=addGlow(g, 0.35, 1.0, this.it.model.glow?0xe8ff9a:0xfff0c0); this.glow.userData.night=true;
    bugs.push(this); }
  get rarity(){ return rarityLabel(this.it.rarity); }
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
    if (Math.random()<chance){ const meta=rollStats(this.id); const r=addItem(this.id, meta); if(!r){ toast('Your bag is full! You let it go.'); this.startFlee(); return; }
      setTimeout(()=>Snd.jingle(),120); sparkle(this.obj.position.clone()); this.despawn(); S.caught++; S.stats.bugs++; S.stats.tapCatch=(S.stats.tapCatch||0)+(verdict?0:1); const best=recordCatch(this.id, meta); catchToast(this.id, meta, r==='new', best); save(); skillHint(); }
    else { Snd.fail(); toast(verdict==='miss' ? ['Swung too early!','Bad timing. It slipped away.','Whiff! Watch the marker.'][Math.floor(Math.random()*3)] : ['Whoosh! It got away.','Missed! Try sneaking closer.','So close! It slipped out of the net.'][Math.floor(Math.random()*3)]); this.startFlee(); }
  }
  startFlee(){ if(this.flee) return; this.flee=1; this.fleeDir=Math.atan2(this.pos.z-player.pos.z, this.pos.x-player.pos.x); }
  despawn(){ this.remove(); const i=bugs.indexOf(this); if(i>=0) bugs.splice(i,1); }
  update(dt,t){
    this.ph+=dt; const W=this.where;
    const pd=Math.hypot(player.pos.x-this.pos.x, player.pos.z-this.pos.z);
    if (!this.flee && CatchMeter.bug!==this && pd < (W==='air'?2.6:3.2) && player.speedFrac>0.55 && Math.random()<SKITTISH[this.rarity]*dt){ this.startFlee(); if (S.equip==='net' || player.targetEnt===this) toast('You spooked it! Move slowly near bugs.'); }
    if (this.flee){ this.flee+=dt; const sp=W==='air'||W==='flower'||W==='trunk'?5:3.5; this.pos.x+=Math.cos(this.fleeDir)*sp*dt; this.pos.z+=Math.sin(this.fleeDir)*sp*dt; if(W!=='ground'&&W!=='beach'&&W!=='pond') this.pos.y+=dt*2.5; this.obj.position.copy(this.pos); this.obj.rotation.y=Math.atan2(Math.cos(this.fleeDir),Math.sin(this.fleeDir)); this.flap(t,2); if(this.flee>2.2) this.despawn(); return; }
    if (W==='air'){ const w=this.ph*0.6; const x=this.home.x+Math.sin(w)*2.2+Math.sin(w*2.3)*0.8, z=this.home.z+Math.cos(w*0.8)*2.2; const ang=Math.atan2(x-this.pos.x, z-this.pos.z); this.pos.set(x, groundY(x,z)+this.alt+Math.sin(this.ph*3)*0.25, z); this.obj.rotation.y=ang; this.flap(t,1); }
    else if (W==='flower'){ if (Math.sin(this.ph*0.7)>0.93){ this.pos.y=groundY(this.pos.x,this.pos.z)+0.4+Math.sin(this.ph*8)*0.15; this.flap(t,1); } else { this.pos.y=groundY(this.pos.x,this.pos.z)+0.3; this.flap(t,0.15); } }
    else if (W==='trunk'){ this.flap(t,0.1); }
    else if (W==='ground' || W==='beach'){ this.hop-=dt; if(this.hop<=0){ this.hop=1.5+Math.random()*3; const a=Math.random()*TAU; this.tx=this.pos.x+Math.cos(a)*1.2; this.tz=this.pos.z+Math.sin(a)*1.2; if(!walkable(this.tx,this.tz)){ this.tx=this.pos.x; this.tz=this.pos.z; } }
      if (this.tx!==undefined){ const dx=this.tx-this.pos.x, dz=this.tz-this.pos.z, L=Math.hypot(dx,dz); if(L>0.05){ const s=Math.min(L, dt*(W==='beach'?1.2:2.5)); this.pos.x+=dx/L*s; this.pos.z+=dz/L*s; this.obj.rotation.y=Math.atan2(dx,dz)+(W==='beach'?Math.PI/2:0); } }
      this.pos.y=groundY(this.pos.x,this.pos.z)+(W==='ground'&&this.hop>1.2?Math.sin((this.hop-1.2)*10)*0.2:0)+0.02; }
    else if (W==='pond'){ const w=this.ph*0.4; this.pos.set(this.home.x+Math.sin(w)*1.5, 0.03, this.home.z+Math.cos(w*1.3)*1.5); }
    if (!this.trunk) this.obj.position.copy(this.pos);
  }
  flap(t,s){ for(const wg of (this.m.userData.wings||[])) wg.rotation.z=wg.userData.side*Math.sin(t*22*s+this.ph)*0.7*Math.min(1,s+0.1); }
}

/* Catch chances.
   Tap-to-catch: about 70% (a little lower for rare bugs, a little higher with a better net). No skill needed.
   Manual swing: a marker sweeps across a bar. Perfect timing is ~97%, a decent swing ~85%, a sloppy one ~55%.
   It's harder at first and pays off once you get the feel for it. */
const TAP_BASE = { 'Common':0.74, 'Uncommon':0.71, 'Rare':0.68, 'Very rare':0.65, 'Legendary':0.6 };
const tapChance = b => clamp(TAP_BASE[b.rarity] + toolDef('net').bonus*0.3, 0.5, 0.8);
const SWEEP = { 'Common':1.5, 'Uncommon':1.3, 'Rare':1.1, 'Very rare':0.95, 'Legendary':0.8 };   // seconds per sweep
const CatchMeter = { bug:null, t:0, el:null };
function meterZones(b){ const nb=toolDef('net').bonus; const k={ 'Common':1, 'Uncommon':0.9, 'Rare':0.8, 'Very rare':0.7, 'Legendary':0.6 }[b.rarity];
  return { perfect:(0.05+nb*0.08)*k, great:(0.15+nb*0.12)*k, ok:(0.28+nb*0.1)*k }; }
function startCatchMeter(b){
  if (CatchMeter.bug) return; stopMove(); CatchMeter.bug=b; CatchMeter.t=0; player.face=Math.atan2(b.pos.x-player.pos.x, b.pos.z-player.pos.z);
  const z=meterZones(b), el=$('#meter'); CatchMeter.el=el; const pct=v=>(v*100).toFixed(1)+'%';
  el.querySelector('.ok').style.cssText=`left:${pct(0.5-z.ok)};width:${pct(z.ok*2)}`; el.querySelector('.great').style.cssText=`left:${pct(0.5-z.great)};width:${pct(z.great*2)}`; el.querySelector('.perfect').style.cssText=`left:${pct(0.5-z.perfect)};width:${pct(z.perfect*2)}`;
  el.classList.add('show'); Snd.click();
  if (!S.meterTip){ S.meterTip=true; save(); toast('Skill swing! Press Catch again when the marker is in the gold.', null, 'new', 'Tap the bug instead for an easy ~70% grab.'); }
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
  CatchMeter.t+=dt; if (CatchMeter.t>4.5){ endCatchMeter(); b.startFlee(); Snd.fail(); toast('It got nervous and flew off. Swing sooner!'); return; }
  const v=b.obj.position.clone(); v.y+=1.4; v.project(camera); const el=CatchMeter.el;
  el.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; el.style.top=((-v.y*0.5+0.5)*innerHeight)+'px'; el.querySelector('.mk').style.left=(meterPos()*100)+'%';
}
function floatText(text, pos){ const e=document.createElement('div'); e.className='floatTxt'; e.textContent=text; const v=pos.clone(); v.y+=1.8; v.project(camera); e.style.left=((v.x*0.5+0.5)*innerWidth)+'px'; e.style.top=((-v.y*0.5+0.5)*innerHeight)+'px'; document.body.appendChild(e); setTimeout(()=>e.remove(),1100); }
function skillHint(){ if (S.skillTip || (S.stats.tapCatch||0)<6) return; S.skillTip=true; save();
  setTimeout(()=>toast('Tip: walk up to a bug yourself and press Catch for a skill swing.', null, 'new', 'Hit the gold zone and almost nothing gets away.'), 1600); }

/* ---------- Fish shadows and fishing ---------- */
const SIZE_SCALE={ S:0.6, M:0.85, L:1.15, XL:1.55 };
const shadowGeo=G.sph(0.5,14,6);
const shadowMat=new THREE.MeshBasicMaterial({ color:0x163040, transparent:true, opacity:0.5, depthWrite:false });
const fishes=[];
function fishPool(type){ const h=Time.hour(), m=Time.month(); return Object.values(ITEMS).filter(i=>i.kind==='fish' && i.where===type && inMonths(m,i.months) && inHours(h,i.hours)); }
function waterSpot(){ for(let k=0;k<40;k++){ const a=Math.random()*TAU, d=4+Math.random()*12; const x=player.pos.x+Math.cos(a)*d, z=player.pos.z+Math.sin(a)*d; if(isFishWater(x,z) && rawHeight(x,z)<-0.45 && !onDock(x,z) && !onBridge(x,z)) return [x,z]; } return null; }
function spawnFish(){ const p=waterSpot(); if(!p) return; const type=waterType(p[0],p[1]); const pool=fishPool(type).filter(allowedFind); if(!pool.length) return; const sp=weightedPick(Math.random, pool, i=>i.rarity);
  const m=new THREE.Mesh(shadowGeo, shadowMat); m.scale.set(SIZE_SCALE[sp.size]*1.6,0.05,SIZE_SCALE[sp.size]*0.8); m.position.set(p[0],-0.25,p[1]); OUT.add(m);
  fishes.push({ id:sp.id, m, home:new THREE.Vector3(p[0],0,p[1]), ph:Math.random()*10, state:'swim', t:0, nib:0 }); }
const Fishing = { state:'idle', pt:null, fish:null, t:0, dip:0 };
const bobber = (()=>{ const g=new THREE.Group(); mk(G.sph(0.14,12,8,0,TAU,0,Math.PI/2), M(0xe2483d), 0,0,0,g); mk(G.sph(0.14,12,8,0,TAU,Math.PI/2,Math.PI/2), M(0xffffff), 0,0,0,g); g.visible=false; OUT.add(g); return g; })();
const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]); const fishLine=new THREE.Line(lineGeo,new THREE.LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.7 })); fishLine.visible=false; OUT.add(fishLine);
const exclaim=textSprite('!','#e2483d','rgba(255,255,255,.98)',1.1); exclaim.visible=false; scene.add(exclaim);
function biteWindow(f){ const it=ITEMS[f.id]; const pen={ 'Common':0, 'Uncommon':0.05, 'Rare':0.1, 'Very rare':0.15, 'Legendary':0.2 }[rarityLabel(it.rarity)] + (it.size==='XL'?0.05:0); return 0.62 - pen + toolDef('rod').bonus; }
function castAt(pt){
  if (!needTool('rod')) return; stopMove(); Fishing.state='cast'; Fishing.pt=pt.clone(); Fishing.pt.y=0; Fishing.t=0; Fishing.fish=null; Fishing.dip=0;
  player.face=Math.atan2(pt.x-player.pos.x, pt.z-player.pos.z); bobber.visible=true; fishLine.visible=true; Snd.swoosh(); player.act=0.35;
}
function reel(){
  const f=Fishing.fish;
  if (Fishing.state==='bite' && f){ useTool('rod'); const meta=rollStats(f.id); const r=addItem(f.id, meta);
    if(!r){ toast('Your bag is full! You let it go.'); }
    else { Snd.splash(); setTimeout(()=>Snd.fanfare(),150); sparkle(bobber.position.clone()); S.caught++; S.stats.fish++; const best=recordCatch(f.id, meta); catchToast(f.id, meta, r==='new', best); save(); }
    f.m.parent && f.m.parent.remove(f.m); fishes.splice(fishes.indexOf(f),1);
  } else if (f && (f.state==='nibble'||f.state==='approach')){ toast('Too soon! Wait for the big splash.'); f.state='flee'; f.t=0; Snd.splash(); }
  Fishing.state='idle'; Fishing.fish=null; bobber.visible=false; fishLine.visible=false; exclaim.visible=false; player.act=0.4;
}
function updateFishing(dt,t){
  if (World.inside) return;
  const near=fishes.filter(f=>f.m.position.distanceTo(player.pos)<22).length; if (near<5 && fishes.length<12 && Math.random()<dt*0.8) spawnFish();
  for (let i=fishes.length-1;i>=0;i--){ const f=fishes[i]; f.ph+=dt;
    if (f.state==='swim'){ if(f.m.position.distanceTo(player.pos)>45){ f.state='flee'; f.t=0.9; continue; } const x=f.home.x+Math.sin(f.ph*0.3)*1.8, z=f.home.z+Math.cos(f.ph*0.23)*1.8; if(isFishWater(x,z)){ const a=Math.atan2(z-f.m.position.z, x-f.m.position.x); f.m.position.x=x; f.m.position.z=z; f.m.rotation.y=-a; } }
    else if (f.state==='approach'){ const d=Fishing.pt.clone().sub(f.m.position); d.y=0; const L=d.length(); if(L>0.55){ d.normalize(); f.m.position.addScaledVector(d, dt*1.3); f.m.rotation.y=-Math.atan2(d.z,d.x); } else { f.state='nibble'; f.t=0.6+Math.random()*0.9; const rar=ITEMS[f.id].rarity; f.nib=1+Math.floor(Math.random()*(rar<1.5?4:3)); } }
    else if (f.state==='nibble'){ f.t-=dt; if(f.t<=0){ if(f.nib>0){ f.nib--; f.t=0.6+Math.random()*1.1; Snd.plip(); ripple(bobber.position.x,bobber.position.z,0.5); Fishing.dip=0.22; } else { f.state='bite'; Fishing.state='bite'; Fishing.t=0; Fishing.win=biteWindow(f); Snd.splash(); ripple(bobber.position.x,bobber.position.z,1.3); } } }
    else if (f.state==='flee'){ f.t+=dt; f.m.position.x+=dt*5; if(f.t>1.2){ f.m.parent && f.m.parent.remove(f.m); fishes.splice(i,1); } }
  }
  if (Fishing.state==='idle') return;
  const hand=player.pos.clone().add(new THREE.Vector3(Math.sin(player.face)*0.9, 1.9, Math.cos(player.face)*0.9));
  Fishing.t+=dt;
  if (Fishing.state==='cast'){ const k=Math.min(1,Fishing.t/0.5); bobber.position.lerpVectors(hand, Fishing.pt, k); bobber.position.y+=Math.sin(k*Math.PI)*1.5; if(k>=1){ Fishing.state='wait'; Fishing.t=0; Snd.plip(); ripple(Fishing.pt.x,Fishing.pt.z); } }
  else if (Fishing.state==='wait'){ bobber.position.set(Fishing.pt.x, Math.sin(t*2)*0.03-Fishing.dip, Fishing.pt.z); Fishing.dip=Math.max(0,Fishing.dip-dt);
    if (!Fishing.fish && Fishing.t>0.6){ let best=null, bd=7; for(const f of fishes){ if(f.state!=='swim') continue; const d=Math.hypot(f.m.position.x-Fishing.pt.x, f.m.position.z-Fishing.pt.z); if(d<bd){ bd=d; best=f; } } if(best){ best.state='approach'; Fishing.fish=best; } }
    if (Fishing.t>25 && !Fishing.fish){ reel(); toast('Nothing biting here. Cast right next to a fish shadow.'); } }
  else if (Fishing.state==='bite'){ bobber.position.set(Fishing.pt.x, -0.22, Fishing.pt.z); exclaim.visible=true; exclaim.position.copy(player.pos).add(new THREE.Vector3(0,2.8,0));
    if (Fishing.t>Fishing.win){ exclaim.visible=false; toast('It got away! Reel in the instant you see the splash.'); Snd.fail(); const f=Fishing.fish; f.state='flee'; f.t=0; Fishing.fish=null; Fishing.state='wait'; Fishing.t=0; } }
  const lp=lineGeo.attributes.position; lp.setXYZ(0,hand.x,hand.y+0.5,hand.z); lp.setXYZ(1,bobber.position.x,bobber.position.y+0.1,bobber.position.z); lp.needsUpdate=true;
}

/* ---------- Ambient wildlife ---------- */
const critters=[];
function spawnAmbient(){
  const r=mulberry32(S.seed+5);
  for(let i=0;i<6;i++){ const p=randLand(r,SAND_H+0.2,9,0.5); if(!p) continue; const b=buildBird([0x8a6a4a,0xd86a4a,0x5a7ab8,0xe8c040][i%4]); b.position.set(p[0],groundY(p[0],p[1]),p[1]); OUT.add(b); critters.push({ type:'bird', o:b, home:new THREE.Vector3(p[0],0,p[1]), t:Math.random()*3, fly:0 }); }
  for(let i=0;i<3;i++){ const g=buildGull(); OUT.add(g); critters.push({ type:'gull', o:g, a:Math.random()*TAU, r:48+Math.random()*10, h:9+Math.random()*4, s:0.08+Math.random()*0.05 }); }
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
function blocked(x,z,r,self){ if (!ignoreRects && inRects(x,z,r)) return true; for(const e of ents){ if(!e.solid||e===self||e.removed) continue; if(Math.abs(x-e.pos.x)>6||Math.abs(z-e.pos.z)>6) continue; if(Math.hypot(x-e.pos.x,z-e.pos.z) < e.r+r) return true; } return false; }
function dropNear(id, at, rad=1.4, exact=false, meta){
  let x=at.x, z=at.z;
  for(let k=0;k<24;k++){ const a=Math.random()*TAU, d=exact?0:(rad*0.7+Math.random()*rad*0.6); const tx=at.x+Math.cos(a)*d, tz=at.z+Math.sin(a)*d; if(walkable(tx,tz) && !blocked(tx,tz,0.3)){ x=tx; z=tz; break; } }
  const rec={ id, x, z, fresh:true }; if(meta) rec.m=meta; S.ground.push(rec); new GroundItem(rec); Snd.pop(); save();
}
/* Part 3: building the island, rooms, daily reset, sky, dialogue, UI, input, main loop */

/* ---------- Layout reservation ---------- */
const reserved=[]; const reserve=(x,z,r)=>reserved.push([x,z,r]);
const isFree=(x,z,r)=>{ for(const [a,b,c] of reserved) if(Math.hypot(x-a,z-b)<c+r) return false; return true; };
reserve(0,0,3.5); reserve(...PLACES.board,2.5); reserve(...PLACES.shop,4.5); reserve(PLACES.home[0],PLACES.home[1]+1,5.5);
for (const R of RESIDENTS) reserve(R.home[0],R.home[1]+1,5.5);
reserve(DOCK.x0-2,DOCK.z-3,4); reserve(DOCK.x0,DOCK.z,3); for(const b of BRIDGES){ reserve(...bEnd(b,1),2.5); reserve(...bEnd(b,-1),2.5); }
function randLand(r, minH, maxH, rad, tries=60, near){
  for(let k=0;k<tries;k++){ let x,z; if(near){ const a=r()*TAU, d=4+r()*near[2]; x=near[0]+Math.cos(a)*d; z=near[1]+Math.sin(a)*d; } else { const a=r()*TAU, d=Math.sqrt(r())*56; x=Math.cos(a)*d; z=Math.sin(a)*d; }
    const h=layoutPhase?baseHeight(x,z):rawHeight(x,z); if(h>minH && h<maxH && isFree(x,z,rad) && pathDist(x,z)>1.6 && !onDock(x,z) && !onBridge(x,z) && polyDist(x,z,RIVER)>4.6 && Math.hypot(x-POND.x,z-POND.z)>7.5 && (layoutPhase || (!inRects(x,z,rad+0.5) && !inLotZone(x,z,rad)))) return [x,z]; }
  return null;
}

/* ---------- Rooms ---------- */
const HOME_ROOM = { floor:0xc99a6a, wall:0xfff0d8, pattern:'stripe', accent:0x6a9ad8 };
class Decor extends Ent { constructor(b,x,z,rot){ const it=ITEMS[b]||{r:DECOR_R[b]||0.6}; super('decor',x,z,it.r||0.6); this.solid=!it.flat; const g=new THREE.Group(); FURN_BUILDERS[b](g); g.rotation.y=rot||0; this.attach(g); pickList.splice(pickList.indexOf(this.obj),1); } }
function makeRoom(id, idx, spec, W, D, exit){
  const [ox,oz]=roomOrigin(idx); const container=new THREE.Group(); container.visible=false; scene.add(container);
  const shell=buildRoom(spec,W,D); shell.position.set(ox,0,oz); container.add(shell);
  const R=ROOMS[id]={ id, ox, oz, w:W, d:D, group:container, shell, spec, entry:[ox, oz+D/2-1.2], exit, bed:[ox-2,oz-2] };
  for (const [b,x,z,rot] of (spec.items||[])){ new Decor(b, ox+x, oz+z, rot); if(b==='bed') R.bed=[ox+x, oz+z]; }
  return R;
}
const DECOR_R = { counter:1.25, shelfstock:0.95 };
function rebuildHomeRoom(home=S.home){
  const [gx,gz]=roomOrigin(0); let R=ROOMS.home;
  if (!R){ const container=new THREE.Group(); container.visible=false; scene.add(container); R=ROOMS.home={ id:'home', group:container, bed:[gx-2,gz-2], exit:[0,0] }; }
  if (R.shell) R.group.remove(R.shell);
  if (!home.built){ const W=6, D=6; R.shell=buildRoom(HOME_ROOM,W,D); R.shell.position.set(gx,0,gz); Object.assign(R,{ ox:gx, oz:gz, w:W, d:D, entry:[gx,gz+D/2-1.2], walk:null, exitCheck:null, walls:null }); }
  else {
    const sh=buildHomeInterior(home); sh.position.set(gx,0,gz); const u=sh.userData, bb=u.bbox, occ=u.occ, { GW, GD, IC }=BUILD;
    const segs=u.segs.map(q=>[q[0]+gx,q[1]+gz,q[2]+gx,q[3]+gz]); const dr=[u.door[0]+gx, u.door[1]+gz];
    Object.assign(R,{ shell:sh, ox:gx+(bb[0]+bb[2])/2, oz:gz+(bb[1]+bb[3])/2, w:bb[2]-bb[0], d:bb[3]-bb[1], entry:[dr[0], dr[1]-1.1], walls:u.walls, gz, cutState:null,
      walk:(x,z)=>{ const i=Math.floor((x-gx)/IC+GW/2), j=Math.floor((z-gz)/IC+GD/2); if(!(occ[j]?.[i]>=0)) return false; for(const q of segs){ if(segDist(x,z,q[0],q[1],q[2],q[3])<0.33) return false; } return true; },
      exitCheck:(x,z)=>z>dr[1]-0.42 && Math.abs(x-dr[0])<0.75 });
  }
  R.group.add(R.shell);
}
// Walls between you and the camera drop down so you can see into every room (like a dollhouse).
function updateCutaway(){
  const R=ROOMS.home; if (!R || !R.walls || World.inside!=='home') return;
  const refZ = buildMode ? camTarget.z-1 : player.pos.z; const key=Math.round(refZ*4); if (R.cutState===key) return; R.cutState=key;
  for (const w of R.walls){ if(!w.horiz) continue; const low = w.z+R.gz > refZ+0.3; for(const m of w.meshes) m.scale.y = low?0.15:1; for(const l of w.lintels) l.visible=!low; }
}

/* ---------- Buildings ---------- */
const HOUSE_R=[1.9,2.6,3.1,3.9];
let houseEnt=null; const residentHomes=[];
function doorOf(ent){ const s=ent.obj.userData.size||{D:3.4}; return [ent.pos.x, ent.pos.z+s.D/2+1.3]; }
function setRects(owner, list){ for(let i=RECTS.length-1;i>=0;i--) if(RECTS[i][4]===owner) RECTS.splice(i,1); for(const q of list) RECTS.push([q[0],q[1],q[2],q[3],owner]); }
const lotRect = () => { const { GW, GD, EC }=BUILD; return [LOT.x-GW*EC/2, LOT.z-GD*EC/2, LOT.x+GW*EC/2, LOT.z+GD*EC/2+2.2]; };
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
  else houseEnt=placeBuilding('home', LOT.x, LOT.z, buildCustomHouse(home), 'Enter', ()=>enterRoom('home'));
  if (ROOMS.home) ROOMS.home.exit=[houseEnt.doorPt[0], houseEnt.doorPt[1]+0.2];
  refreshSmoke();
}
rebuildHomeRoom();
buildPlayerHouse();
const ROOF=[0xe0745a,0x7a9a5a,0x9a7ab8,0x4a7ad8,0xe88aa8,0x2a5a4a,0xd8b04a];
RESIDENTS.forEach((R,i)=>{ const obj=buildHouse(1, 0xfff4e4, ROOF[i%ROOF.length], R.room.accent);
  const b=new Building('rhome',R.home[0],R.home[1],HOUSE_R[1],obj,()=>{ const res=residents&&residents.find(x=>x.spec.id===R.id); return res&&res.loc==='in'?'Enter':'Knock'; },()=>{
    const res=residents.find(x=>x.spec.id===R.id); Snd.door();
    if (res.loc==='in'){ enterRoom(R.id); if(res.asleep) setTimeout(()=>toast(`Shh... ${R.name} is fast asleep.`),500); }
    else toast(`Nobody's home. ${R.name} must be out and about.`); });
  residentHomes.push(b); makeRoom(R.id, i+1, R.room, 8, 7, doorOf(b)); });
const stall=new Building('shop',PLACES.shop[0],PLACES.shop[1],2.0,buildStall(),'Shop',()=>openShop('stall'));
const board=new Building('board',PLACES.board[0],PLACES.board[1],1.1,buildBoard(),'Read',()=>openBoard());

/* ---------- Shops and museum ---------- */
const shopOpen = id => { const h=SHOPS[id]?.hours; return !h || inHours(Time.hour(), h); };
const shopTier = id => S.shops[id]?.tier||0;
class Keeper extends Ent {
  constructor(spec, x, z, onTalk){ super('keeper',x,z,0.45); this.spec=spec; this.onTalk=onTalk; this.solid=true; this.reach=2.6; this.attach(buildKeeper(spec)); this.hitSphere(0.9,1.0); this.face=0; }
  label(){ return 'Talk'; }
  act(){ Snd.pop(); this.onTalk(this); }
  update(dt,t){ const u=this.obj.userData; u.body.position.y=Math.abs(Math.sin(t*2.2))*0.03; u.head.rotation.z=Math.sin(t*1.3)*0.06;
    const d=Math.hypot(player.pos.x-this.pos.x, player.pos.z-this.pos.z); const want = d<7 ? Math.atan2(player.pos.x-this.pos.x, player.pos.z-this.pos.z) : 0;
    let df=want-this.obj.rotation.y; df=Math.atan2(Math.sin(df),Math.cos(df)); this.obj.rotation.y+=df*Math.min(1,dt*5); }
}
const keeperLine = (k, key) => { const v=KEEPERS[k][key]; return Array.isArray(v) ? v[Math.floor(Math.random()*v.length)] : v; };
// Pemberton runs the general store out of the old market stall
const pemberton = new Keeper(KEEPERS.pemberton, PLACES.shop[0]-2.3, PLACES.shop[1]+1.0, ()=>talkShop('general'));
function stallExtras(){ const g=stall.obj; if (g.userData.extra) g.remove(g.userData.extra); const x=new THREE.Group(); g.add(x); g.userData.extra=x; const t=shopTier('general');
  if (t>=1){ for(let i=0;i<3;i++){ const c=new THREE.Group(); c.position.set(-2.4,0,-0.4+i*0.75); FURN_BUILDERS.crate(c); x.add(c); } }
  if (t>=2){ for(const s of [-1,1]){ const l=new THREE.Group(); l.position.set(s*2.0,0,1.6); FURN_BUILDERS.lantern(l); x.add(l); } const b=new THREE.Group(); b.position.set(2.5,0,0.2); FURN_BUILDERS.bookshelf(b); b.rotation.y=-Math.PI/2; x.add(b); }
  if (t>=3){ const cg=new THREE.Group(); x.add(cg); for(let i=0;i<5;i++){ const s=mk(G.box(0.5,0.05,1.6),M(i%2?0xffffff:0x6a8a4a),2.0+i*0.0,2.3,0.4,cg); s.position.x=-1.0+i*0.5; s.position.z=2.0; s.rotation.x=0.3; } for(const s of [-1.2,1.2]) mk(G.cyl(0.06,0.06,2.3,8),M(0x8b5e3a),s,1.15,2.7,cg); }
}
stallExtras();
const SHOP_ROOMS = {
  aquarium:{ idx:8, W:8, D:7, spec:{ floor:0x9ab8c0, wall:0xe0f4f6, pattern:'stripe', accent:0x2f6ab0, items:[['counter',0,-1.9,0],['fishtank',-2.9,-2.8,0],['bigtank',2.2,-2.9,0],['shelfstock',-3.4,0.6,Math.PI/2],['anchor',3.2,0.9,-0.4],['lifering',3.4,-0.8,-Math.PI/2],['buoylamp',-3.3,2.4,0],['rug',0,1.0,0]] } },
  garden:{ idx:9, W:8, D:7, spec:{ floor:0x9a7a5a, wall:0xeef6e0, pattern:'dots', accent:0x7cb85a, items:[['counter',0,-1.9,0],['terrarium',-2.9,-2.8,0],['planter',2.4,-2.9,0],['shelfstock',-3.4,0.6,Math.PI/2],['skep',3.2,0.9,0],['plant',3.3,-0.8,0],['monstera',-3.3,2.4,0],['butterflyframe',2.9,2.3,-0.5]] } },
};
const shopEnts={};
function buildShop(id){
  if (shopEnts[id]) shopEnts[id].remove();
  shopEnts[id]=placeBuilding(id, PLACES[id][0], PLACES[id][1], buildShopBuilding(id, shopTier(id)), ()=>shopOpen(id)?'Enter':'Closed',
    ()=>{ if (!shopOpen(id)){ toast(KEEPERS[SHOPS[id].keeper].closed); Snd.fail(); return; } enterRoom(id); });
  if (ROOMS[id]) ROOMS[id].exit=[shopEnts[id].doorPt[0], shopEnts[id].doorPt[1]+0.2];
}
for (const id of ['aquarium','garden']){ buildShop(id); const SR=SHOP_ROOMS[id]; const R=makeRoom(id, SR.idx, SR.spec, SR.W, SR.D, [shopEnts[id].doorPt[0], shopEnts[id].doorPt[1]+0.2]);
  new Keeper(KEEPERS[SHOPS[id].keeper], R.ox, R.oz-2.7, ()=>talkShop(id)); }
// Museum
const museumEnt = placeBuilding('museum', PLACES.museum[0], PLACES.museum[1], buildMuseum(), 'Enter', ()=>enterRoom('museum'));
const MUSEUM_ROOM = { floor:0xd8c8a8, wall:0xf4eee0, pattern:'plain', accent:0x5a7a8a, items:[['counter',-8,6.2,0],['rug',0,6.5,0],['monstera',-12,8.5,0],['monstera',12,8.5,0],['bench',6,7.8,0],['bench',-3,8.4,0],['floorlamp',12.2,4.5,0],['floorlamp',-12.2,4.5,0]] };
const museumRoom = makeRoom('museum', 11, MUSEUM_ROOM, 26, 20, [museumEnt.doorPt[0], museumEnt.doorPt[1]+0.2]);
const thistle = new Keeper(KEEPERS.thistle, museumRoom.ox-8, museumRoom.oz+5.3, ()=>talkCurator());
function refreshSmoke(){ smokeSrc.length=0; OUT.updateMatrixWorld(true); const add=e=>{ const c=e.obj.userData.chimney; if(c) smokeSrc.push(c.clone().applyMatrix4(e.obj.matrixWorld)); }; if(houseEnt) add(houseEnt); residentHomes.forEach(add); }
refreshSmoke();
{ const lamps = LAYOUT_ID==='classic' ? [[3,-1.5],[-7,4],[6,-4],[6,6],[-9,-6],[DOCK.x0-1.5,DOCK.z-1.8],[2,11],[1,-12],[bEnd(bA,1)[0]+1.2,bEnd(bA,1)[1]],[-8,-33],[14,-18],[24,0]] : (()=>{
    const L=[]; for(const p of PATHS){ let acc=5; for(let i=0;i<p.length-1;i++){ const [ax,az]=p[i], [bx,bz]=p[i+1], len=Math.hypot(bx-ax,bz-az); for(let d=0; d<len; d+=0.5){ acc+=0.5; if(acc<11) continue; const x=ax+(bx-ax)*d/len, z=az+(bz-az)*d/len, nx=-(bz-az)/len, nz=(bx-ax)/len;
      const lx=x+nx*1.3, lz=z+nz*1.3; if(L.some(q=>Math.hypot(q[0]-lx,q[1]-lz)<7)) continue; L.push([lx,lz]); acc=0; } } } return L; })();
  for(const [x,z] of lamps){ if(!walkable(x,z)||onBridge(x,z)||(LAYOUT_ID!=='classic'&&(inRects(x,z,0.8)||inLotZone(x,z,0.5)))) continue; const g=new THREE.Group(); mk(G.cyl(0.07,0.09,2.4,8),M(0x4a3a30),0,1.2,0,g); mk(G.box(0.34,0.42,0.34),glowMat(0xffd27a),0,2.5,0,g); mk(G.cone(0.3,0.25,4),M(0x3a2e26),0,2.83,0,g).rotation.y=Math.PI/4; addGlow(g,2.5,3.2); g.position.set(x,groundY(x,z),z); OUT.add(g); reserve(x,z,0.8); } }

/* ---------- Trees, rocks, scenery ---------- */
const trees=[], rocks=[], wildFlowerSpots=[];
// v0.5 buildings and paths went in after the island was made. Trees and rocks in their way just don't grow there.
const clearForNew = p => !!inRects(p[0],p[1],2.4) || newPathDist(p[0],p[1])<2.3 || inLotZone(p[0],p[1],1.4) || ['museum','aquarium','garden'].some(k=>Math.hypot(p[0]-PLACES[k][0], p[1]-PLACES[k][1]-(k==='museum'?6:4))<3.2);
{ const r=mulberry32(S.seed); let idx=0; const add=(type,fruit,minH,maxH)=>{ const p=randLand(r,minH,maxH,2.8); if(!p) return; reserve(p[0],p[1],2.3); const key='n'+(idx++); if(S.cut[key]==='gone' || clearForNew(p)){ return; } trees.push(new Tree(key,p[0],p[1],type,fruit)); };
  for(let i=0;i<14;i++) add('fruittree',S.nativeFruit,SAND_H+0.2,9);
  const kinds=['oak','oak','birch','maple','blossom','cedar','pine','pine'];
  for(let i=0;i<70;i++) add(kinds[Math.floor(r()*kinds.length)],null,SAND_H+0.2,9);
  for(let i=0;i<18;i++) add('palm','coconut',0.25,SAND_H);
  for(let i=0;i<9;i++){ const p=randLand(r,SAND_H+0.1,9,2.2); if(!p) continue; reserve(p[0],p[1],2); if(clearForNew(p)) continue; rocks.push(new Rock(i,p[0],p[1],r)); }
}
layoutPhase=false;
for (const st of S.stumps) new Stump(st);
const plantEnts=[];
function spawnPlants(){ for(const e of plantEnts) if(!e.removed) e.remove(); plantEnts.length=0;
  for (const rec of S.plants){ const P=PLANTS[rec.sp]; if(!P) continue; plantEnts.push(P.ptype==='tree' ? new Tree(rec.id, rec.x, rec.z, rec.sp, rec.fruit||(rec.sp==='palm'?'coconut':null), rec) : new Plant(rec)); } }
// grass tufts, wild flowers, fallen leaves, driftwood (instanced)
{ const r=mulberry32(S.seed+7); const dummy=new THREE.Object3D(); const col=new THREE.Color();
  const tuftN=isMobile?3200:5200; const tg=G.cone(0.07,0.42,4); tg.translate(0,0.21,0);
  const tufts=new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ roughness:1 }), tuftN); let n=0;
  const gcol=PAL.grass.map(h=>new THREE.Color(h).offsetHSL(0,0.05,0.0));
  for(let k=0;k<tuftN*3 && n<tuftN;k++){ const x=(r()-0.5)*112, z=(r()-0.5)*112; const h=rawHeight(x,z); if(h<SAND_H+0.15||pathDist(x,z)<1.3||polyDist(x,z,RIVER)<4.3) continue;
    for(let j=0;j<3&&n<tuftN;j++){ const xx=x+(r()-0.5)*0.4, zz=z+(r()-0.5)*0.4; dummy.position.set(xx, rawHeight(xx,zz)-0.02, zz); dummy.rotation.set((r()-0.5)*0.5,r()*TAU,(r()-0.5)*0.5); dummy.scale.setScalar(0.7+r()*0.8); dummy.updateMatrix(); tufts.setMatrixAt(n,dummy.matrix); tufts.setColorAt(n,col.copy(gcol[n%3]).offsetHSL(0,0,(r()-0.5)*0.08)); n++; } }
  tufts.count=n; tufts.receiveShadow=true; OUT.add(tufts);
  if (PAL.flower.length){ const fN=900; const sg=G.cyl(0.012,0.012,0.32,3); sg.translate(0,0.16,0); const hg=G.ico(0.075,1); hg.translate(0,0.34,0);
    const stems=new THREE.InstancedMesh(sg,M(0x4f9a3a),fN), heads=new THREE.InstancedMesh(hg,new THREE.MeshStandardMaterial({roughness:0.7}),fN); let m=0;
    for(let k=0;k<150&&m<fN;k++){ const p=randLand(r,SAND_H+0.2,9,0.3,10); if(!p) continue; const fc=new THREE.Color(PAL.flower[Math.floor(r()*PAL.flower.length)]); wildFlowerSpots.push(p);
      for(let j=0;j<6&&m<fN;j++){ const x=p[0]+(r()-0.5)*1.6, z=p[1]+(r()-0.5)*1.6; if(rawHeight(x,z)<SAND_H+0.1||pathDist(x,z)<1.2) continue; dummy.position.set(x,rawHeight(x,z)-0.02,z); dummy.rotation.set(0,r()*TAU,0); dummy.scale.setScalar(0.8+r()*0.5); dummy.updateMatrix(); stems.setMatrixAt(m,dummy.matrix); heads.setMatrixAt(m,dummy.matrix); heads.setColorAt(m,fc); m++; } }
    stems.count=heads.count=m; OUT.add(stems,heads); }
  if (World.season==='autumn'){ const lg=G.box(0.16,0.01,0.1); const leaves=new THREE.InstancedMesh(lg,new THREE.MeshStandardMaterial({roughness:1}),1500); let m=0; const lc=[0xe8913a,0xd8642e,0xf0b84a].map(h=>new THREE.Color(h));
    for(const tr of trees){ if(['palm','pine','cedar'].includes(tr.type)) continue; for(let j=0;j<18;j++){ const a=r()*TAU, d=r()*2.6; const x=tr.pos.x+Math.cos(a)*d, z=tr.pos.z+Math.sin(a)*d; if(!walkable(x,z)||m>=1500) continue; dummy.position.set(x,groundY(x,z)+0.01,z); dummy.rotation.set(0,r()*TAU,0); dummy.scale.setScalar(1); dummy.updateMatrix(); leaves.setMatrixAt(m,dummy.matrix); leaves.setColorAt(m,lc[m%3]); m++; } }
    leaves.count=m; leaves.receiveShadow=true; OUT.add(leaves); }
  for(let i=0;i<12;i++){ const p=randLand(r,0.15,SAND_H-0.05,1); if(!p) continue; const g=new THREE.Group(); const l=mk(G.cyl(0.12,0.16,1.6+r(),8),M(0xc8b49a),0,0.12,0,g); l.rotation.z=Math.PI/2; g.rotation.y=r()*TAU; g.position.set(p[0],groundY(p[0],p[1]),p[1]); OUT.add(g); }
  // lily pads + reeds on the pond and river
  for(let i=0;i<14;i++){ const a=r()*TAU, d=r()*POND.r*0.8; const p=mk(G.cyl(0.35,0.35,0.02,12,1,false,0,TAU*0.88),M(0x5aa84a),POND.x+Math.cos(a)*d,0.04,POND.z+Math.sin(a)*d,OUT); p.rotation.y=r()*TAU; p.castShadow=false; if(i%4===0) mk(G.ico(0.09,1),M(0xf8c0d8),p.position.x,0.1,p.position.z,OUT); }
  for(let i=0;i<40;i++){ const k=Math.floor(r()*(RIVER.length-1)), t=r(); const a=RIVER[k], b=RIVER[k+1]; const s=r()<0.5?1:-1; const L=Math.hypot(b[0]-a[0],b[1]-a[1]); const x=lerp(a[0],b[0],t)+(-(b[1]-a[1])/L)*s*2.6, z=lerp(a[1],b[1],t)+((b[0]-a[0])/L)*s*2.6; if(rawHeight(x,z)<-0.3||rawHeight(x,z)>0.6||Math.hypot(x,z)>48) continue; for(let j=0;j<4;j++){ const rd=mk(G.cyl(0.02,0.03,0.9+r()*0.5,4),M(0x7a9a4a),x+(r()-0.5)*0.4,0.4,z+(r()-0.5)*0.4,OUT); rd.rotation.set((r()-0.5)*0.3,0,(r()-0.5)*0.3); rd.castShadow=false; } }
}
const clouds=[]; { const r=mulberry32(99); for(let i=0;i<18;i++){ const g=new THREE.Group(); const n=3+Math.floor(r()*3); for(let k=0;k<n;k++){ const s=mk(G.ico(2+r()*2,2),new THREE.MeshStandardMaterial({ color:0xffffff, roughness:1, transparent:true, opacity:0.95 }),k*2.6-n*1.3,r()*1.2,r()*1.5,g); s.castShadow=false; s.receiveShadow=false; s.scale.y=0.65; } g.position.set((r()-0.5)*260, 36+r()*14, (r()-0.5)*260-30); g.userData.v=0.6+r()*0.8; OUT.add(g); clouds.push(g); } }
const residents = RESIDENTS.map(R=>new Resident(R));
spawnAmbient();

/* ---------- Player ---------- */
const player = { pos:new THREE.Vector3(PLACES.home[0]+1.5, 0, PLACES.home[1]+4.4), face:0, target:null, targetEnt:null, cb:null, act:0, obj:buildPlayer(), stuck:0, lastD:0, speedFrac:0 };
player.pos.y=groundY(player.pos.x,player.pos.z); scene.add(player.obj);
const marker=(()=>{ const m=new THREE.Mesh(new THREE.RingGeometry(0.25,0.38,24).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.8, depthWrite:false })); m.visible=false; scene.add(m); return m; })();

/* ---------- Daily reset ---------- */
let dailyEnts=[], peddler=null, weatherOverride=null;
function rollDay(){
  const key=Time.dayKey(); if (S.day && S.day.key===key) return false;
  const r=mulberry32(hashStr(key+':'+S.seed)); const m=Time.month(), season=seasonOf(m);
  const w=r(); const weather = w<0.6?'sunny':(w<0.82?'cloudy':(season==='winter'?'snow':'rain'));
  const digs=[], weeds=[];
  for(let i=0;i<6;i++){ const p=randLand(r,SAND_H+0.15,9,1.2); if(p) digs.push({x:p[0],z:p[1],dug:false}); }
  for(let i=0;i<7;i++){ const p=randLand(r,SAND_H+0.2,9,0.6); if(p) weeds.push({x:p[0],z:p[1],pulled:false}); }
  const pickN=(pool,n)=>{ const a=pool.slice(), o=[]; while(o.length<n && a.length) o.push(a.splice(Math.floor(r()*a.length),1)[0].id); return o; };
  const furnPool=Object.values(ITEMS).filter(i=>i.kind==='furniture' && i.shop==='stall' && inMonths(m,i.months));
  const seeds=Object.values(ITEMS).filter(i=>i.kind==='seed'), starts=Object.values(ITEMS).filter(i=>i.kind==='sapling'&&PLANTS[i.plant].ptype==='shrub'), saps=Object.values(ITEMS).filter(i=>i.kind==='sapling'&&i.buy>0&&PLANTS[i.plant].ptype==='tree');
  const shellPool=Object.values(ITEMS).filter(i=>i.kind==='shell');
  S.ground = S.ground.filter(g=>!g.beach);
  for(let i=0;i<8;i++){ for(let k=0;k<30;k++){ const a=r()*TAU, d=40+r()*16; const x=Math.cos(a)*d, z=Math.sin(a)*d; if(isBeach(x,z) && !onDock(x,z)){ S.ground.push({ id:weightedPick(r,shellPool.filter(allowedFind),i=>i.rarity).id, x, z, beach:true }); break; } } }
  // plants grow overnight (watered plants always grow)
  if (!VISIT) for (const p of S.plants){ if (p.lastGrow===key) continue; const watered = p.watered && p.watered!==key; if (p.stage<3 && (watered || r()<0.55)) p.stage++; p.watered=null; p.lastGrow=key; }
  S.day={ key, fruit:{}, branch:{}, chop:{}, rock:{}, lucky:Math.floor(r()*9), digs, weeds, weather, peddler:!GUEST && r()<0.35,
    stock:pickN(furnPool,6), sold:{}, garden:[...pickN(seeds,4), ...pickN(starts,1), ...pickN(saps,1)], gsold:{},
    pstock:pickN(Object.values(ITEMS).filter(i=>i.shop==='rare'),2), psold:{}, chat:{}, gift:{} };
  save(); return true;
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
// furniture: validate saved positions (the island changed shape in v2)
for (const rec of S.placed.slice()){ const inRoom=rec.x>500; if (!inRoom && (!walkable(rec.x,rec.z) || blocked(rec.x,rec.z,ITEMS[rec.id].r))){ S.placed.splice(S.placed.indexOf(rec),1); S.inv.length<slotsMax() ? S.inv.push({id:rec.id,n:1}) : null; continue; } new Furniture(rec); }
for (const res of residents) if (res.wantsHome()) res.setLoc('in');

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
function bugPool(){ const h=Time.hour(), m=Time.month(); return Object.values(ITEMS).filter(i=>i.kind==='bug' && inMonths(m,i.months) && inHours(h,i.hours) && (!i.weather || i.weather===World.weather) && !(World.weather==='rain' && !i.weather && i.where==='air' && i.hours && i.hours[0]<12)); }
let bugT=0;
function updateBugs(dt){
  if (World.inside) return; bugT-=dt; if(bugT>0) return; bugT=2.5;
  const pool=bugPool(); for(const b of bugs.slice()){ const far=b.pos.distanceTo(player.pos)>38; if(far && (!pool.includes(b.it) || Math.random()<0.15)) b.despawn(); }
  if (bugs.length>=8 || !pool.length || Math.random()<0.3) return;
  const okPool=pool.filter(allowedFind); if(!okPool.length) return; const sp=weightedPick(Math.random,okPool,i=>i.rarity); const near=[player.pos.x,player.pos.z,22]; let p=null, extra={};
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
const lanterns=[]; { for(let i=0;i<22;i++){ const g=new THREE.Group(); mk(G.cyl(0.22,0.28,0.45,8),glowMat(0xffb070),0,0,0,g).castShadow=false; const s=addGlow(g,0,2.4,0xffb070); s.userData.event=true; g.visible=false; g.userData={ a:Math.random()*TAU, d:58+Math.random()*30, y:Math.random()*14, s:0.4+Math.random()*0.5 }; OUT.add(g); lanterns.push(g); } }
const activeEvents = () => { const d=Time.now(), h=Time.hour(); return EVENTS.filter(e=>e.active(d,h)); };
function updateSky(){
  const h=Time.hour(); const night = 1-smooth(5.2,7,h)+smooth(18.8,20.5,h); World.night=clamp(night,0,1);
  windowMat.emissiveIntensity = World.night*1.4;
  for(const m of glowMats) m.emissiveIntensity = 0.15 + World.night*1.6;
  for(const s of glowSprites) s.material.opacity = s.userData.night ? World.night*0.45 : (s.userData.event ? s.material.opacity : World.night*0.85);
  if (World.inside){
    sky.visible=stars.visible=moon.visible=false; scene.background=new THREE.Color(0x2e2420); scene.fog.color.setHex(0x2e2420); scene.fog.near=60; scene.fog.far=200;
    hemi.color.setHex(0xfff0dc); hemi.groundColor.setHex(0x8a6a50); hemi.intensity=1.6-World.night*0.35; sun.color.setHex(0xfff0dc); sun.intensity=1.3; sunDir.set(0.3,1,0.45).normalize();
    renderer.toneMappingExposure = 1.15*(S.settings.bright||1); return; }
  sky.visible=stars.visible=true; scene.background=null; scene.fog.near=70; scene.fog.far=170;
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
  waterMat.color.setHex(0x4cc3d6).lerp(_c1.setHex(0x3a64a8), World.night*0.5).lerp(_c2.setHex(0x7a9aa6), dim*0.5);
  deepSea.material.color.setHex(0x2a8aa8).lerp(_c1.setHex(0x24427a), World.night*0.6);
  foam.material.opacity=0.55-World.night*0.25;
  renderer.toneMappingExposure = (1.15 + World.night*0.2) * (S.settings.bright||1);
  clouds.forEach(c=>c.children.forEach(s=>s.material.color.setHex(0xffffff).lerp(_c1.copy(bot),0.3+World.night*0.25).lerp(_c2.setHex(0x8a94a0),dim)));
  shadowMat.color.setHex(World.night>0.5?0x0a1a2a:0x163040); shadowMat.opacity = 0.5+World.night*0.15;
}
const fadeEl=$('#fade');
function fade(cb){ fadeEl.classList.add('show'); setTimeout(()=>{ cb(); setTimeout(()=>fadeEl.classList.remove('show'), 60); }, 260); }
function enterRoom(id){
  fade(()=>{ const R=ROOMS[id]; World.inside=id; OUT.visible=false; for(const k in ROOMS) ROOMS[k].group.visible=(k===id);
    if (Fishing.state!=='idle') reel(); stopMove(); player.pos.set(R.entry[0],0,R.entry[1]); player.face=Math.PI; player.obj.rotation.y=Math.PI; camTarget.copy(player.pos); updateSky(); updateCamera(1);
    const res=residents.find(r=>r.spec.id===id); if (res && res.loc==='in' && !res.asleep){ const P=DIALOGUE[res.spec.personality]; setTimeout(()=>dialog(res.spec.name,res.spec.voice,[fill(P.home[Math.floor(Math.random()*P.home.length)],{c:res.spec.catch})]),350); } });
  Snd.door();
}
function exitRoom(){
  const R=ROOMS[World.inside]; fade(()=>{ World.inside=null; OUT.visible=true; for(const k in ROOMS) ROOMS[k].group.visible=false; stopMove();
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
    if (d.choices){ dlgChoices.innerHTML=''; dlgMore.style.display='none'; d.choices.forEach(c=>{ const b=document.createElement('button'); b.className='btn'+(c.alt?' alt':''); b.textContent=c.label; b.onclick=(e)=>{ e.stopPropagation(); Snd.click(); const fn=c.fn; closeDialog(false); fn(); }; dlgChoices.appendChild(b); }); return; }
    closeDialog(true); return; }
  d.full=d.lines[d.i++]; d.chars=0; dlgText.textContent=''; dlgMore.style.display='none';
}
function closeDialog(runDone){ const d=dlgState; dlgState=null; dlgEl.classList.remove('show'); dlgChoices.innerHTML=''; if(runDone && d && d.done) d.done(); }
function tickDialog(dt){
  const d=dlgState; if(!d || !d.full || d.chars>=d.full.length){ if(d && d.full && d.chars>=d.full.length && !dlgChoices.children.length) dlgMore.style.display=''; return; }
  d.acc=(d.acc||0)+dt*55; while(d.acc>=1 && d.chars<d.full.length){ d.acc--; d.chars++; const ch=d.full[d.chars-1]; if(d.chars%2===0 && /[a-z]/i.test(ch)) Snd.blip(d.voice); }
  dlgText.textContent=d.full.slice(0,d.chars);
}
$('#dlgBox').addEventListener('pointerdown', e=>{ e.stopPropagation(); const d=dlgState; if(!d) return; if(d.chars<d.full.length){ d.chars=d.full.length; dlgText.textContent=d.full; } else if(!dlgChoices.children.length || d.i<d.lines.length) nextLine(); });
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
  if (res.spec.id==='bramble' && !S.craft && (countItem('wood')+countItem('softwood'))>0){ teachWoodworking(res, end); return; }
  const menu=()=>dialog(res.spec.name, res.spec.voice, [], end, [
    { label:'Chat', fn:()=>{ const first=!S.day.chat[res.spec.id]; let line;
        if(first){ S.day.chat[res.spec.id]=true; S.friend[res.spec.id]=(S.friend[res.spec.id]||0)+1; save(); line=fill(P.chat[Math.floor(Math.random()*P.chat.length)],c); }
        else line=fill(P.again[Math.floor(Math.random()*P.again.length)],c);
        dialog(res.spec.name, res.spec.voice, [line], menu); } },
    { label:'Give a gift', fn:()=>{ if(S.day.gift[res.spec.id]){ dialog(res.spec.name,res.spec.voice,[fill('You already gave me something today, {c}! Save it for tomorrow.',c)],menu); return; }
        openBag('give', i=>{ panelClose=null; closePanel(); giveGift(res,i,menu); }, ()=>menu()); } },
    { label:'Bye!', alt:true, fn:end } ]);
  dialog(res.spec.name, res.spec.voice, [greetingFor(res)], menu);
}
function giveGift(res, slot, menu){
  const P=DIALOGUE[res.spec.personality], s=S.inv[slot], it=ITEMS[s.id]; removeAt(slot,1); S.day.gift[res.spec.id]=true;
  const tier = res.spec.loves.includes(it.kind)?'love' : res.spec.likes.includes(it.kind)?'like' : 'meh';
  const pts = tier==='love'?3:tier==='like'?2:1; S.friend[res.spec.id]=(S.friend[res.spec.id]||0)+pts; save();
  const c={ c:res.spec.catch, item:it.name }; const lines=[fill(P[tier][Math.floor(Math.random()*P[tier].length)],c)]; let reward=null;
  if ((S.friend[res.spec.id]>=4 && Math.random()<0.35) || (tier==='love' && Math.random()<0.2)){ const pool=Object.values(ITEMS).filter(i=>i.kind==='furniture'&&i.shop==='stall'&&inMonths(Time.month(),i.months)); reward=pool[Math.floor(Math.random()*pool.length)].id; lines.push(fill(P.returnGift[0],c)); }
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
function itemToast(id, isNew, verb){ const n=ITEMS[id].name; toast((isNew?'New! ':'')+`${verb}: ${n}`, thumb(id), isNew?'new':''); if(isNew) Snd.fanfare(); }
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
const kindName = k => ({fruit:'Fruit',material:'Material',shell:'Beach find',fossil:'Fossil',fish:'Fish',bug:'Bug',furniture:'Furniture',flower:'Flower',seed:'Seeds',sapling:'Plant'})[k]||k;
const canPlant = it => it.kind==='seed' || it.kind==='sapling' || (it.kind==='fruit' && it.plant);

/* Bag: tap an item and its actions appear in the bar pinned to the bottom of the panel */
function invGrid(sel, dim){ let h='<div class="grid">'; const N=slotsMax(); for(let i=0;i<N;i++){ const s=S.inv[i]; if(!s){ h+='<div class="slot empty"></div>'; continue; } h+=`<div class="slot${sel===i?' sel':''}" data-i="${i}" style="${dim&&dim(s)?'opacity:.35':''}"><img src="${thumb(s.id)}" alt="">${s.n>1?`<span class="n">${s.n}</span>`:''}</div>`; } return h+'</div>'; }
function itemDetail(s){ const it=ITEMS[s.id]; let sub=kindName(it.kind); if(s.m) sub+=` · ${statText(s.id,s.m)}`; if(it.rarity && (it.kind==='fish'||it.kind==='bug')) sub+=' '+rarityTag(it); return `<img src="${thumb(s.id)}"><div class="grow"><div class="nm">${it.name}${s.n>1?` x${s.n}`:''}</div><div class="sub">${sub}</div><div class="sub">Sells for ${fmt(entryPrice(s))} clams</div></div>`; }
function openBag(mode='view', onPick, onCancel){
  let sel=-1;
  const render=()=>{
    pBody.innerHTML = (mode==='give'?'<div class="muted" style="margin-bottom:8px">Pick something to give.</div>':'') + invGrid(sel) + `<div class="muted" style="margin-top:10px">${S.inv.length}/${slotsMax()} slots${S.pack>=0?' ('+BACKPACKS[S.pack].name+')':''}</div>`;
    const s=S.inv[sel];
    if (s){ const it=ITEMS[s.id]; let b='';
      if (mode==='give') b+=`<button class="btn" data-a="give">Give</button>`;
      else { if (it.kind==='furniture') b+=`<button class="btn" data-a="place">Place</button>`; if (canPlant(it) && !World.inside) b+=`<button class="btn" data-a="plant">Plant</button>`; b+=`<button class="btn alt" data-a="drop">${it.kind==='fish'||it.kind==='bug'?'Release':'Drop'}</button>`; }
      setFoot(`<div class="detail">${itemDetail(s)}<div class="acts">${b}</div></div>`);
    } else setFoot(`<div class="muted" style="padding:4px 2px">${mode==='give'?'Tap an item to give it.':'Tap an item to see what you can do with it.'}</div>`);
    pBody.querySelectorAll('.slot[data-i]').forEach(el=>el.onclick=()=>{ sel=+el.dataset.i; Snd.click(); render(); });
    pFoot.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{ const s=S.inv[sel]; if(!s) return; const a=b.dataset.a;
      if(a==='give') onPick(sel);
      if(a==='place'){ panelClose=null; closePanel(); startPlacing(s.id,'furn'); }
      if(a==='plant'){ panelClose=null; closePanel(); startPlacing(s.id,'plant'); }
      if(a==='drop'){ const it=ITEMS[s.id]; const m=s.m; removeAt(sel,1); if(it.kind==='fish'||it.kind==='bug'){ toast(`You let the ${it.name} go.`); Snd.swoosh(); } else dropNear(s.id, player.pos, 1.2, false, m); if(!S.inv[sel]) sel=-1; render(); } });
  };
  openPanel(mode==='give'?'Give a gift':'Your Bag', onCancel); render();
}

/* ---------- Woodworking ----------
   Built to avoid New Horizons' crafting complaints:
   craft any amount in one tap (no one-at-a-time animations), craft from anywhere (the workbench is optional),
   every plan is visible with its unlock shown (no random recipe drops or duplicates),
   materials show have/need, and you can never lose materials to a full bag. */
const MAT_NAMES = { wood:'Wood', softwood:'Branch', stone:'Stone', clay:'Clay', iron:'Iron' };
function craftNudge(id){
  if (S.craft || S.craftHint || (id!=='wood' && id!=='softwood')) return;
  S.craftHint=true; save();
  setTimeout(()=>toast('Bramble the bear is handy with wood. Maybe show him what you found?'), 1200);
}
function teachWoodworking(res, end){
  const c={ c:res.spec.catch }, nm=res.spec.name, v=res.spec.voice;
  dialog(nm, v, [
    fill('Hrm. That\'s decent wood you\'re hauling around, {c}.', c),
    'Seems a waste to just sell it. Wood wants to be something.',
    'I built half the stuff in my house. A stool, a bench, the shelves. Nothing fancy. Just honest work.',
    fill('Here. Take my old workbench, {c}. And these plans. Start small. A stool. Then you\'ll want to make everything.', c),
  ], ()=>{
    S.craft={ made:0, kinds:[] }; S.friend.bramble=(S.friend.bramble||0)+2;
    const r=addItem('workbench'); if(!r) dropNear('workbench', player.pos);
    save(); updateCraftBtn(); Snd.fanfare();
    toast('You learned woodworking! Tap the Craft button any time.', thumb('workbench'), 'new', 'Crafting works anywhere. The workbench is yours to place if you like.');
    dialog(nm, v, [fill('One more thing. Make as many as you want at once. No sense doing it one at a time, {c}.', c)], end);
  });
}
const recipeOut = r => r.out||1;
const kindsMade = () => S.craft ? (S.craft.kinds||[]).length : 0;
const recipeOpen = r => S.craft && kindsMade()>=r.unlock;
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
  const before=kindsMade(); S.craft.made+=k; S.craft.kinds=S.craft.kinds||[]; if(!S.craft.kinds.includes(r.id)) S.craft.kinds.push(r.id); save();
  Snd.chop(); setTimeout(()=>Snd.jingle(),140);
  toast(`${isNew?'New! ':''}You made ${n>1?n+' ':''}${n>1?ITEMS[r.id].name+(ITEMS[r.id].name.endsWith('s')?'':'s'):article(ITEMS[r.id].name)+' '+ITEMS[r.id].name}!`, thumb(r.id), isNew?'new':'');
  const fresh=WOODWORK.filter(x=>x.unlock>before && x.unlock<=kindsMade());
  if (fresh.length) setTimeout(()=>{ Snd.fanfare(); toast('New woodworking plans!', thumb(fresh[0].id), 'new', fresh.map(x=>ITEMS[x.id].name).join(', ')); }, 900);
  return true;
}
function openCraft(){
  if (!S.craft) return;
  let filter='all'; const qty={};
  const render=()=>{
    const kd=kindsMade(), next=WOODWORK.map(r=>r.unlock).filter(u=>u>kd).sort((a,b)=>a-b)[0];
    let h=`<div class="notice"><b>Woodworking</b> <span class="muted">· ${kd} of ${WOODWORK.length} plans made · ${fmt(S.craft.made)} crafted</span>`;
    h+= next!==undefined ? `<div class="bar" style="margin:8px 0 4px"><div style="width:${Math.min(100,kd/next*100)}%"></div></div><span class="muted">Make ${next-kd} more different thing${next-kd>1?'s':''} to unlock new plans.</span>` : `<br><span class="muted">You know every plan. Bramble would be proud.</span>`;
    h+=`<div class="muted" style="margin-top:6px">Your materials: ${Object.keys(MAT_NAMES).map(m=>`${MAT_NAMES[m]} ${countItem(m)}`).join(' · ')}</div></div>`;
    h+='<div class="tabs">'+[['all','All plans'],['now','Can make now']].map(([k,n])=>`<button class="tab${k===filter?' on':''}" data-f="${k}">${n}</button>`).join('')+'</div>';
    let shown=0;
    WOODWORK.forEach((r,i)=>{ const it=ITEMS[r.id], open=recipeOpen(r), mx=open?craftMax(r):0;
      if (filter==='now' && mx<=0) return; shown++;
      if (!open){ h+=`<div class="row" style="opacity:.6"><img src="${thumb(r.id)}" style="filter:grayscale(1)"><div class="grow"><div class="nm">${it.name}</div><div class="sub">Unlocks after making ${r.unlock} different things (${r.unlock-kd} to go)<br>${Object.entries(r.mats).map(([m,n])=>`${MAT_NAMES[m]} ${n}`).join(' · ')}</div></div></div>`; return; }
      const q=Math.max(1, Math.min(qty[i]||1, Math.max(1,mx)));
      const mats=Object.entries(r.mats).map(([m,n])=>{ const have=countItem(m), ok=have>=n*q; return `<span style="color:${ok?'inherit':'#c0503a'};font-weight:${ok?400:700}">${MAT_NAMES[m]} ${have}/${n*q}</span>`; }).join(' · ');
      const out=recipeOut(r)*q;
      h+=`<div class="row"><img src="${thumb(r.id)}"><div class="grow"><div class="nm">${it.name}${S.craft.kinds&&!S.craft.kinds.includes(r.id)?' <span style="color:#d08a10;font-size:12px">NEW</span>':''}${recipeOut(r)>1?` <span class="muted">x${recipeOut(r)}</span>`:''}</div><div class="sub">${mats}${bagBlocked(r)?'<br><b>Your bag is full.</b> Make room first.':''}</div>
        <div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap">
          <button class="btn alt" data-q="${i}:-1" ${q<=1?'disabled':''} style="padding:4px 12px">-</button><b style="min-width:22px;text-align:center">${q}</b><button class="btn alt" data-q="${i}:1" ${q>=mx?'disabled':''} style="padding:4px 12px">+</button>
          <button class="btn alt" data-q="${i}:max" ${mx<=1?'disabled':''} style="padding:4px 10px">Max ${mx>1?mx:''}</button>
          <button class="btn" data-c="${i}" ${mx<=0?'disabled':''}>Make${out>1?' '+out:''}</button></div></div></div>`; });
    if (!shown) h+='<div class="muted">Nothing you can make right now. Chop some trees or shake them for branches.</div>';
    pBody.innerHTML=h;
    pBody.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ filter=b.dataset.f; Snd.click(); render(); });
    pBody.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ const [i,d]=b.dataset.q.split(':'); const r=WOODWORK[+i], mx=craftMax(r); qty[i]= d==='max'?mx:Math.max(1,Math.min(mx,(qty[i]||1)+(+d))); Snd.click(); render(); });
    pBody.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.c, r=WOODWORK[i]; const k=Math.max(1,Math.min(qty[i]||1, craftMax(r))); if(doCraft(r,k)){ qty[i]=1; const st=pBody.scrollTop; render(); pBody.scrollTop=st; } });
  };
  openPanel('Woodworking'); render();
}
function updateCraftBtn(){ const b=$('#bCraft'); if(b) b.style.display = S.craft ? '' : 'none'; }

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
  if (id==='general'){ const base=S.day.stock.slice(0,6); const pool=Object.values(ITEMS).filter(i=>i.kind==='furniture' && ((i.shop==='stall' && inMonths(m,i.months)) || (i.shop==='general' && i.tier<=t) || (t>=3 && i.shop==='rare')));
    return [...base, ...pickN(pool, n-base.length, base)]; }
  const pool=Object.values(ITEMS).filter(i=>i.kind==='furniture' && i.shop===id && (i.tier||0)<=t);
  let out=[...pool.filter(i=>(i.tier||0)===t).map(i=>i.id).slice(0,1)]; out=[...out, ...pickN(pool, n-out.length, out)];
  if (id==='garden'){ const seeds=Object.values(ITEMS).filter(i=>i.kind==='seed'||(i.kind==='sapling'&&i.buy>0&&(t>=1||PLANTS[i.plant].ptype!=='tree'))); out=[...out, ...pickN(seeds, 2+t)]; }
  return out;
}
const isSold = (which, id, i) => { if (which==='rare') return !!S.day.psold[i]; if (which==='stall') return !!(S.day.sold[i] && i<6 && S.day.stock[i]===id) || !!S.day.sold['id:'+id]; const m=(S.day.ssold=S.day.ssold||{}); return !!(m[which]&&m[which][id]); };
const markSold = (which, id, i) => { if (which==='rare'){ S.day.psold[i]=true; return; } if (which==='stall'){ S.day.sold['id:'+id]=true; return; } const m=(S.day.ssold=S.day.ssold||{}); (m[which]=m[which]||{})[id]=true; };

function talkShop(id){
  const k=KEEPERS[SHOPS[id].keeper], open=shopOpen(id);
  if (id==='general' && !open){ dialog(k.name, k.voice, [keeperLine(k.id,'night')], ()=>openShop('stall')); return; }
  dialog(k.name, k.voice, [keeperLine(k.id,'greet')], ()=>openShop(id==='general'?'stall':id));
}
function investBox(id){
  const sh=SHOPS[id], st=S.shops[id], t=st.tier, k=KEEPERS[sh.keeper];
  let h=`<div class="notice"><b>${sh.tiers[t]}</b> <span class="muted">· tier ${t+1} of 4</span><br><span class="muted">${id==='general'?`Sells to you at ${Math.round(sh.discount[t]*100)}% off and pays ${Math.round(sh.sell[t]*100)}% for anything.`:`Sells to you at ${Math.round(sh.discount[t]*100)}% off and pays ${Math.round(sh.sell[t]*100)}% for ${buysText(sh)}.`} ${sh.slots[t]} items in stock a day.</span></div>`;
  if (t>=3) return h+`<div class="notice">${k.name}'s shop is as grand as it gets. Thank you, partner!</div>`;
  const cost=INVEST.cost[t+1], houseOk=S.home.built, tradeOk=st.trade>=INVEST.trade;
  h+=`<div class="notice"><b>Invest in ${sh.tiers[t+1]}</b><br><span class="muted">${sh.perks[t+1]}. The building grows too.</span><div style="margin-top:6px"><b>${fmt(cost)} clams</b></div>`;
  if (!houseOk || !tradeOk){ h+=`<div class="muted" style="margin-top:6px">${fill(k.lock.replace('{t}',fmt(INVEST.trade)))}</div><div class="muted" style="margin-top:6px">${houseOk?'Built a house: yes':'Build a house first (Island Board)'}<br>Trade here: ${fmt(Math.min(st.trade,INVEST.trade))} / ${fmt(INVEST.trade)} clams</div><div class="bar" style="margin-top:6px"><div style="width:${Math.min(100,st.trade/INVEST.trade*100)}%"></div></div>`; }
  else h+=`<button class="btn" data-invest="${id}" style="margin-top:8px" ${S.clams<cost?'disabled':''}>Invest ${fmt(cost)}</button>`;
  return h+'</div>';
}
function doInvest(id){ if (noEdit()) return false;
  const st=S.shops[id], cost=INVEST.cost[st.tier+1]; if (st.tier>=3 || S.clams<cost || !S.home.built || st.trade<INVEST.trade) return false;
  S.clams-=cost; st.tier++; save(); updateHUD(); Snd.fanfare();
  if (id==='general') stallExtras(); else buildShop(id);
  const k=KEEPERS[SHOPS[id].keeper]; closePanel(); dialog(k.name, k.voice, [k.invest[st.tier-1]]); toast(`${SHOPS[id].tiers[st.tier]}!`, null, 'new', SHOPS[id].perks[st.tier]);
  return true;
}
function openShop(which){
  let tab='buy', sel=-1; const sid=shopKey(which);
  const tabs = which==='rare' ? [['buy','Rare finds'],['sell','Sell']] : which==='stall' ? [['buy','Furniture'],['garden','Garden'],['tools','Tools'],['packs','Backpacks'],['sell','Sell'],['invest','Invest']] : [['buy','Shop'],['sell','Sell'],['invest','Invest']];
  const buyRow=(id,i,sold,price,orig)=>{ const it=ITEMS[id]; return `<div class="row"><img src="${thumb(id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">${fmt(price)} clams${orig&&orig!==price?` <s>${fmt(orig)}</s>`:''}${it.kind==='seed'?' · plant on grass':''}${it.kind==='sapling'?' · needs a shovel to plant':''}</div></div><button class="btn" data-b="${i}" ${sold||S.clams<price?'disabled':''}>${sold?'Sold':'Buy'}</button></div>`; };
  let list=[];
  const render=()=>{
    let h='<div class="tabs">'+tabs.map(([k,n])=>`<button class="tab${k===tab?' on':''}" data-t="${k}">${n}</button>`).join('')+'</div>'; setFoot('');
    if (tab==='buy'){ list=shopStock(which);
      const intro = which==='rare'?'Rare finds, today only.' : which==='stall'?'New furniture every day. At night, leave clams in the jar.' : which==='aquarium'?'Marlo\'s salty stock changes every day.' : 'Sprig\'s plants and bug gear change every day.';
      h+=`<div class="muted" style="margin-bottom:8px">${intro}</div>`; list.forEach((id,i)=>h+=buyRow(id,i,isSold(which,id,i),buyPrice(which,ITEMS[id]),ITEMS[id].buy)); }
    if (tab==='garden'){ list=S.day.garden; h+='<div class="muted" style="margin-bottom:8px">Seeds and plants change daily. Water them to help them grow. Sprig\'s Bug & Bloom has more.</div>'; list.forEach((id,i)=>h+=buyRow(id,i,S.day.gsold[i],buyPrice(which,ITEMS[id]),ITEMS[id].buy)); }
    if (tab==='tools'){
      h+='<div class="muted" style="margin-bottom:8px">Tools wear out with use. Better tools last longer and work better. Heirloom tools never break.</div>';
      for (const [t,T] of Object.entries(TOOLS)){ const own=S.tools[t];
        h+=`<div class="notice"><b>${T.name}</b> <span class="muted">· ${T.does}</span><br><span class="muted">${own?`You have: ${T.tiers[own.tier].name}, ${T.tiers[own.tier].forever?'never breaks':own.uses+' uses left'}`:'You don\'t have one yet.'}</span>`;
        T.tiers.forEach((tr,k)=>{ const ok=reqMet(t,k), keep=own&&T.tiers[own.tier].forever&&k<=own.tier; h+=`<div class="row" style="margin:8px 0 0"><img src="${toolThumb(t,k)}"><div class="grow"><div class="nm">${tr.name}</div><div class="sub">${fmt(tr.cost)} clams · ${tr.forever?'<b>Never breaks</b>':tr.uses+' uses'}${tr.bonus&&t==='net'?` · +${Math.round(tr.bonus*100)}% catch`:''}${tr.bonus&&t==='rod'?` · longer bite window`:''}${tr.nofell?' · can\'t fell trees':''}${!ok?`<br>Locked: ${tr.req.desc}`:''}</div></div><button class="btn" data-tool="${t}:${k}" ${keep||!ok||S.clams<tr.cost?'disabled':''}>${keep?(k===own.tier?'Owned':'Kept'):'Buy'}</button></div>`; });
        h+='</div>'; } }
    if (tab==='packs'){
      h+=`<div class="muted" style="margin-bottom:8px">Bigger backpacks hold more. Each one is harder to get. You have ${slotsMax()} slots now.</div>`;
      BACKPACKS.forEach((p,i)=>{ const owned=i<=S.pack, next=i===S.pack+1, ok=next&&packReq(i);
        h+=`<div class="row"><div class="slot" style="width:56px;border-width:2px;font-weight:700">${p.slots}</div><div class="grow"><div class="nm">${p.name}</div><div class="sub">${p.slots} slots · ${fmt(p.cost)} clams${p.req?`<br>${p.req.desc}`:''}${next&&p.req?`<br>Progress: ${S.caught} caught · ${discovered()} discovered · ${bestFriends()} best friends`:''}</div></div>${owned?'<span class="muted">Owned</span>':`<button class="btn" data-pack="${i}" ${!ok||S.clams<p.cost?'disabled':''}>${next?'Buy':'Locked'}</button>`}</div>`; }); }
    if (tab==='sell'){
      const sh=SHOPS[sid]; const pays = which==='rare' ? '' : sh.buys ? `${KEEPERS[sh.keeper].name} pays <b>${Math.round(sh.sell[shopTier(sid)]*100)}%</b> for ${buysText(sh)}. Nothing else.` : `Pemberton buys anything${shopTier('general')?` at <b>${Math.round(sh.sell[shopTier('general')]*100)}%</b>`:''}. Specialists pay more for their thing.`;
      h+=`<div class="muted" style="margin-bottom:8px">${pays} Bigger catches are worth more.</div>`+invGrid(sel, s=>sellPrice(s,which)===null);
      const s=S.inv[sel]; if(s){ const it=ITEMS[s.id], pr=sellPrice(s,which); const same=S.inv.filter(x=>x.id===s.id && !x.m).reduce((a,x)=>a+x.n,0);
        if (pr===null) setFoot(`<div class="detail">${itemDetail(s)}<div class="acts muted" style="max-width:220px">${KEEPERS[SHOPS[sid].keeper].refuse}</div></div>`);
        else { setFoot(`<div class="detail">${itemDetail(s).replace(/Sells for [\d,]+ clams/, `Sells here for <b>${fmt(pr)}</b> clams`)}<div class="acts"><button class="btn" id="s1">Sell 1</button>${!s.m&&same>1?`<button class="btn alt" id="sA">Sell all ${fmt(pr*same)}</button>`:''}</div></div>`);
          pFoot.querySelector('#s1').onclick=()=>{ if(!walletOK(pr)) return; removeAt(sel,1); addClams(pr); addTrade(which,pr); Snd.coin(); if(!S.inv[sel]||S.inv[sel].id!==s.id) sel=-1; render(); };
          const sa=pFoot.querySelector('#sA'); if(sa) sa.onclick=()=>{ if(!walletOK(pr*same)) return; removeItem(s.id,same); addClams(pr*same); addTrade(which,pr*same); Snd.coin(); sel=-1; render(); }; }
      } else setFoot('<div class="muted" style="padding:4px 2px">Tap an item to sell it.</div>');
      // quick sell-everything-they-want button for specialists
      if (which!=='stall' && which!=='rare'){ const total=S.inv.reduce((a,x)=>{ const p=sellPrice(x,which); return a+(p===null?0:p*x.n); },0); if(total>0) h+=`<button class="btn" id="sAllShop" style="margin-top:10px">Sell all ${buysText(SHOPS[sid])} for ${fmt(total)}</button>`; } }
    if (tab==='invest') h+=investBox(sid);
    pBody.innerHTML=h;
    pBody.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ tab=b.dataset.t; sel=-1; Snd.click(); render(); pBody.scrollTop=0; });
    pBody.querySelectorAll('.slot[data-i]').forEach(el=>el.onclick=()=>{ sel=+el.dataset.i; Snd.click(); render(); });
    const sAll=pBody.querySelector('#sAllShop'); if(sAll) sAll.onclick=()=>{ let tot=0; for(let i=S.inv.length-1;i>=0;i--){ const x=S.inv[i], p=sellPrice(x,which); if(p===null) continue; if(GUEST && S.clams+tot+p*x.n>GUEST_CAP.clams) continue; tot+=p*x.n; S.inv.splice(i,1); } addClams(tot); addTrade(which,tot); Snd.coin(); save(); sel=-1; render(); };
    pBody.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.b; const id=list[i], it=ITEMS[id], price=buyPrice(which,it);
      if(S.clams<price) return; if(!canAdd(id)){ toast('Your bag is full.'); return; } S.clams-=price; if(tab==='garden') S.day.gsold[i]=true; else markSold(which,id,i); addTrade(which,price); const r=addItem(id); Snd.coin(); updateHUD(); itemToast(id, r==='new', 'Bought'); render(); });
    pBody.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{ const [t,k]=b.dataset.tool.split(':'); const tr=TOOLS[t].tiers[+k]; if(S.clams<tr.cost) return; S.clams-=tr.cost; addTrade(which,tr.cost); S.tools[t]={ tier:+k, uses:tr.forever?0:tr.uses }; S.toolEver[t]=Math.max(S.toolEver[t]??-1, +k); Snd.coin(); equip(t); updateHUD(); toast(`You got the ${tr.name}! It's in your hand now.`, toolThumb(t,+k)); save(); render(); });
    pBody.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.pack, p=BACKPACKS[i]; if(i!==S.pack+1||!packReq(i)||S.clams<p.cost) return; S.clams-=p.cost; addTrade(which,p.cost); S.pack=i; Snd.fanfare(); updateHUD(); toast(`You got the ${p.name}! Your bag now holds ${p.slots} items.`); save(); render(); });
    pBody.querySelectorAll('[data-invest]').forEach(b=>b.onclick=()=>doInvest(b.dataset.invest));
  };
  openPanel(which==='rare'?'Fennick\'s Rare Finds':SHOPS[sid].name); render();
}

/* ---------- Museum ----------
   Professor Thistle takes one of every fish, bug, fossil and beach find. Each donation gets its own display inside. */
const MUSEUM_IDS = Object.fromEntries(MUSEUM.kinds.map(k=>[k, Object.values(ITEMS).filter(i=>i.kind===k).map(i=>i.id)]));
const MUSEUM_TOTAL = Object.values(MUSEUM_IDS).reduce((a,l)=>a+l.length,0);
const donatedCount = () => Object.keys(S.museum.items).length;
// Where each item's display stands, relative to the museum room's center
function exhibitSpot(id){
  const k=ITEMS[id].kind, i=MUSEUM_IDS[k].indexOf(id);
  if (k==='fish') return [-11.05+(i%18)*1.3, i<18?-8.6:-6.4];
  if (k==='bug') return [-11.5+(i%9)*1.25, -3.4+Math.floor(i/9)*1.9];
  const j = k==='fossil' ? i : MUSEUM_IDS.fossil.length+i; return [2.6+(j%5)*2.1, -3.4+Math.floor(j/5)*1.9];
}
class Exhibit extends Ent {
  constructor(id){ const [x,z]=exhibitSpot(id); super('exhibit', museumRoom.ox+x, museumRoom.oz+z, 0.42); this.id=id; this.solid=true; this.reach=1.6;
    this.attach(buildExhibit(id, ITEMS[id].kind)); this.ph=Math.random()*10; }
  label(){ return 'Look'; }
  act(){ const it=ITEMS[this.id], when=new Date(S.museum.items[this.id]); const R=S.rec[this.id];
    toast(it.name, thumb(this.id), '', `Donated ${when.toLocaleDateString('en-US',{month:'short',day:'numeric'})}${R?` · your biggest: ${it.kind==='fish'?R.l+' cm':R.l+' mm'}`:''}${it.kind==='fish'||it.kind==='bug'?' · '+rarityTag(it):''}`); }
  update(dt,t){ const u=this.obj.userData; if(u.swim){ u.swim.position.x=Math.sin(t*0.8+this.ph)*0.18; u.swim.rotation.y=Math.PI/2+Math.cos(t*0.8+this.ph)*0.5; } if(u.spin) u.spin.rotation.y+=dt*0.4; }
}
const exhibits={};
{ // faint floor markers for every empty spot, so you can see what's still missing
  const geo=G.box(0.82,0.02,0.82), mat=new THREE.MeshStandardMaterial({ color:0xc8b898, roughness:1 }); const all=Object.values(MUSEUM_IDS).flat();
  const im=new THREE.InstancedMesh(geo, mat, all.length); const dm=new THREE.Object3D(); all.forEach((id,i)=>{ const [x,z]=exhibitSpot(id); dm.position.set(museumRoom.ox+x,0.01,museumRoom.oz+z); dm.updateMatrix(); im.setMatrixAt(i,dm.matrix); }); im.receiveShadow=true; museumRoom.group.add(im); }
function spawnExhibits(){ for (const id in S.museum.items) if (!exhibits[id] && ITEMS[id]) exhibits[id]=new Exhibit(id); }
spawnExhibits();
function talkCurator(){
  const k=KEEPERS.thistle, v=k.voice;
  const menu=()=>dialog(k.name, v, [], null, [
    { label:'Donate', fn:()=>openDonate() },
    { label:'How\'s the collection?', fn:()=>{ const by=MUSEUM.kinds.map(kd=>{ const l=MUSEUM_IDS[kd]; const n=l.filter(id=>S.museum.items[id]).length; return `${n} of ${l.length} ${kd==='shell'?'beach finds':kd==='fossil'?'fossils':kd+(kd==='fish'?'':'s')}`; });
        const next=MUSEUM.gifts.find(([n])=>donatedCount()<n);
        dialog(k.name, v, [`We have ${donatedCount()} of ${MUSEUM_TOTAL} displays filled. ${by.join(', ')}.`, next?`When we reach ${next[0]}, I have a little something for you.`:'You have filled every display I have gifts for. Remarkable!'], menu); } },
    { label:'Bye!', alt:true, fn:()=>{} } ]);
  if (!S.museum.met){ S.museum.met=true; save(); dialog(k.name, v, k.first, menu); return; }
  const h=Time.hour(); dialog(k.name, v, [(h>=23||h<6) ? keeperLine('thistle','night') : keeperLine('thistle','greet')], menu);
}
function eligibleDonations(){ const seen=new Set(), out=[]; S.inv.forEach((s,i)=>{ const it=ITEMS[s.id]; if (MUSEUM.kinds.includes(it.kind) && !S.museum.items[s.id] && !seen.has(s.id)){ seen.add(s.id); out.push(i); } }); return out; }
function donate(slot){
  const s=S.inv[slot], id=s.id; removeAt(slot,1); S.museum.items[id]=Date.now(); save(); exhibits[id]=new Exhibit(id); Snd.jingle();
}
function openDonate(){ if (noEdit()) return;
  const render=()=>{ const el=eligibleDonations();
    let h=`<div class="muted" style="margin-bottom:8px">Things in your bag the museum doesn't have yet. Each one gets its own display.</div>`;
    if (!el.length) h+='<div class="notice">Nothing new to donate right now. Catch fish and bugs, dig up fossils, or comb the beach.</div>';
    for (const i of el){ const s=S.inv[i], it=ITEMS[s.id]; h+=`<div class="row"><img src="${thumb(s.id)}"><div class="grow"><div class="nm">${it.name}</div><div class="sub">${kindName(it.kind)}${s.m?' · '+statText(s.id,s.m):''}</div></div><button class="btn" data-d="${i}">Donate</button></div>`; }
    if (el.length>1) h+=`<button class="btn" id="dAll" style="margin-top:6px">Donate all ${el.length}</button>`;
    h+=`<div class="muted" style="margin-top:10px">${donatedCount()} of ${MUSEUM_TOTAL} displays filled.</div>`;
    pBody.innerHTML=h;
    const after=()=>{ checkMuseumGifts(); render(); };
    pBody.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ const i=+b.dataset.d, id=S.inv[i].id; donate(i); itemToast(id,false,'Donated'); after(); });
    const da=pBody.querySelector('#dAll'); if(da) da.onclick=()=>{ let n=0; for(;;){ const el2=eligibleDonations(); if(!el2.length) break; donate(el2[0]); n++; } toast(`Donated ${n} things! Professor Thistle is delighted.`); after(); };
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
   Layout: draw rooms on a 7 x 6 lot, move and resize them, choose doorways, open walls and where the front door goes.
   Outside: wall material and color, roof style and color, trim, door, windows, shutters, flower boxes, porch,
   foundation, chimney, height. Inside: floor and wallpaper per room. Everything previews live in 3D.
   New floor squares cost clams (cheap at first, pricier as the house grows). Restyling is free. */
const costUpTo = n => { let c=0; for(let k=1;k<=n;k++) c+=BUILD.cellCost(k); return c; };
const houseCost = (cells, paid) => Math.max(0, costUpTo(cells)-costUpTo(paid||0));
const hexs = c => '#'+new THREE.Color(c).getHexString();
const buildEl=$('#build'), bBody=$('#bBody');
const lotMarker = (()=>{ const q=lotRect(), pts=[]; const P=(x,z)=>pts.push(new THREE.Vector3(x,groundY(x,z)+0.08,z)); const N=16;
  for(let i=0;i<=N;i++) P(q[0]+(q[2]-q[0])*i/N, q[1]); for(let i=0;i<=N;i++) P(q[2], q[1]+(q[3]-2.2-q[1])*i/N); for(let i=N;i>=0;i--) P(q[0]+(q[2]-q[0])*i/N, q[3]-2.2); for(let i=N;i>=0;i--) P(q[0], q[1]+(q[3]-2.2-q[1])*i/N);
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color:0xffffff, dashSize:0.4, gapSize:0.25, transparent:true, opacity:0.9 })); l.computeLineDistances(); l.visible=false; OUT.add(l); return l; })();

function openBuild(){ if (VISIT){ toast('You can only build on your own island for now.'); Snd.fail(); return; }
  if (buildMode || dlgState) return; if (placing) endPlacing(); stopMove(); endCatchMeter(); if (Fishing.state!=='idle') reel();
  const draft=JSON.parse(JSON.stringify(S.home)); const first=!draft.built; draft.built=true; fixDoor(draft.plan);
  buildMode={ draft, first, tab:'layout', sel:draft.plan.rooms[0]?draft.plan.rooms[0].id:null, mode:'rooms', yaw:0.55, prevInside:World.inside, prevDist:camDist, view:null, camT:new THREE.Vector3(), dist:25 }; $('#hud').classList.add('building'); buildEl.classList.add('show'); Snd.click();
  previewBuild(); setBuildView('out'); renderBuild();
  if (first) setTimeout(()=>toast('This is your lot. Drag on an empty square of the plan to add a room.', null, 'new', 'Tap a room to select it, then drag it to move or drag its edge to resize.'), 300);
}
function setBuildView(v){
  const B=buildMode; if (!B || B.view===v) return; B.view=v;
  if (v==='out'){ World.inside=null; OUT.visible=true; for(const k in ROOMS) ROOMS[k].group.visible=false; B.camT.set(LOT.x, groundY(LOT.x,LOT.z)+1.4, LOT.z+0.6); lotMarker.visible=true; B.dist=25; }
  else { World.inside='home'; OUT.visible=false; for(const k in ROOMS) ROOMS[k].group.visible=(k==='home'); const R=ROOMS.home; B.camT.set(R.ox,0.4,R.oz+0.8); ROOMS.home.cutState=null; B.yaw=0; B.dist=Math.max(18, Math.max(R.w,R.d)*1.45); }
  camTarget.copy(B.camT); updateSky();
}
function previewBuild(which){ const d=buildMode.draft; if (which!=='room') buildPlayerHouse(d); if (which!=='house'){ rebuildHomeRoom(d); ROOMS.home.cutState=null; } }
function closeBuild(commit){
  const B=buildMode; if (!B) return;
  if (commit){
    const d=B.draft, prob=planProblem(d.plan); if (prob){ toast(prob); Snd.fail(); return; }
    const cells=planCells(d.plan), cost=houseCost(cells, S.home.paid); if (GUEST && cells>GUEST_CAP.cells){ toast(`Guest houses can be up to ${GUEST_CAP.cells} floor squares. Make an account to build bigger.`); Snd.fail(); return; } if (cost>S.clams){ toast(`That much new floor costs ${fmt(cost)} clams. You have ${fmt(S.clams)}.`); Snd.fail(); return; }
    // anything standing where the new walls go?
    const hr=RECTS.filter(q=>q[4]==='home'); const inHouse=(x,z,r=0.15)=>hr.some(q=>x>q[0]-r&&x<q[2]+r&&z>q[1]-r&&z<q[3]+r);
    const inWay=[];
    for (const e of ents.slice()){ if (e.removed || e.pos.x>500 || e===houseEnt || !inHouse(e.pos.x,e.pos.z, e.r*0.6)) continue;
      if (e instanceof Furniture) inWay.push(ITEMS[e.rec.id].name); else if (e instanceof Plant) inWay.push(PLANTS[e.rec.sp].name); else if (e instanceof Tree) inWay.push('a tree'); else if (e instanceof Stump) inWay.push('a stump'); else if (e instanceof Rock) inWay.push('a rock'); }
    if (inWay.length){ toast(`Move ${inWay.slice(0,3).join(', ')}${inWay.length>3?' and more':''} first.`, null, '', 'They\'re where the new walls would go.'); Snd.fail(); return; }
    for (const e of ents.slice()){ if (e.removed || e.pos.x>500 || !inHouse(e.pos.x,e.pos.z)) continue;
      if (e instanceof Weed){ S.day.weeds[e.i].pulled=true; e.remove(); } else if (e instanceof DigSpot){ S.day.digs[e.i].dug=true; e.remove(); }
      else if (e instanceof GroundItem){ const ex=houseEnt.doorPt; e.rec.x=ex[0]+(Math.random()-0.5)*2; e.rec.z=ex[1]+1.2+Math.random(); e.remove(); new GroundItem(e.rec); }
      else if (e instanceof Bug) e.despawn(); }
    for (const res of residents){ if (res.loc==='out' && inHouse(res.pos.x,res.pos.z,0.4)){ res.pos.set(houseEnt.doorPt[0]+1.5,0,houseEnt.doorPt[1]+1.5); res.pos.y=groundY(res.pos.x,res.pos.z); res.obj.position.copy(res.pos); } }
    const firstBuild=!S.home.built; S.clams-=cost; S.home=d; S.home.paid=Math.max(S.home.paid||0, cells); save(); updateHUD();
    buildPlayerHouse(); rebuildHomeRoom();
    // furniture inside that no longer fits goes back to your bag
    let back=0; const R=ROOMS.home;
    for (const rec of S.placed.slice()){ if (Math.abs(rec.x-700)>14 || Math.abs(rec.z-700)>14 || walkable(rec.x,rec.z)) continue; const e=ents.find(x=>x instanceof Furniture && x.rec===rec);
      if (addItem(rec.id)){ S.placed.splice(S.placed.indexOf(rec),1); if(e) e.remove(); back++; } else { rec.x=R.entry[0]; rec.z=R.entry[1]-1; if(e){ e.pos.set(rec.x,0,rec.z); e.obj.position.copy(e.pos); } } }
    save(); Snd.fanfare(); sparkle(new THREE.Vector3(LOT.x, groundY(LOT.x,LOT.z)+3, LOT.z));
    toast(firstBuild ? 'Your house is built! Welcome home.' : 'Remodel done!', null, 'new', `${cost>0?`Spent ${fmt(cost)} clams. `:''}${back?`${back} piece${back>1?'s':''} of furniture went back to your bag.`:''}`);
  } else { buildPlayerHouse(S.home); rebuildHomeRoom(S.home); Snd.click(); }
  buildMode=null; camera.clearViewOffset(); camDist=B.prevDist; buildEl.classList.remove('show'); $('#hud').classList.remove('building'); lotMarker.visible=false;
  World.inside=B.prevInside; OUT.visible=!World.inside; for(const k in ROOMS) ROOMS[k].group.visible=(k===World.inside);
  if (World.inside==='home'){ const R=ROOMS.home; if (commit || !walkable(player.pos.x,player.pos.z)) player.pos.set(R.entry[0],0,R.entry[1]); }
  else if (!World.inside && inRects(player.pos.x,player.pos.z,0.4)){ const e=ROOMS.home.exit; player.pos.set(e[0],0,e[1]+0.8); player.pos.y=groundY(player.pos.x,player.pos.z); }
  player.obj.position.copy(player.pos); camTarget.copy(player.pos); ROOMS.home.cutState=null; updateSky(); updateCamera(1);
}
$('#bCancel').onclick=()=>closeBuild(false); $('#bDone').onclick=()=>closeBuild(true);
$('#bBuild').onclick=()=>openBuild();

function renderBuild(keepScroll){
  const B=buildMode; if(!B) return; const plan=B.draft.plan; const st=bBody.scrollTop;
  $('#bTabs').querySelectorAll('[data-bt]').forEach(b=>{ b.classList.toggle('on', b.dataset.bt===B.tab); b.onclick=()=>{ if(B.tab===b.dataset.bt) return; B.tab=b.dataset.bt; Snd.click(); setBuildView(B.tab==='int'?'in':'out'); renderBuild(); }; });
  const cells=planCells(plan), cost=houseCost(cells,S.home.paid);
  $('#bCost').innerHTML=`${plan.rooms.length} room${plan.rooms.length>1?'s':''} · ${cells} floor squares · ${cost>0?`new floor: <b>${fmt(cost)}</b> clams (you have ${fmt(S.clams)})`:'no cost'}`;
  const prob=planProblem(plan);
  $('#bMsg').innerHTML = prob ? `<b style="color:#c0503a">${prob}</b>` : B.tab==='layout' ? (B.mode==='rooms' ? 'Drag an empty square to add a room. Tap a room, then drag it to move or drag an edge to resize.' : 'Tap a wall between rooms: doorway, open, or solid. Tap a front-facing wall to move the front door.') : B.tab==='ext' ? 'Drag the picture above to look around your house.' : 'Pick a room on the plan, then its floor and wallpaper.';
  $('#bDone').disabled = !!prob || cost>S.clams; $('#bDone').textContent = B.first ? 'Build it' : 'Done';
  if (B.tab==='layout') renderLayoutTab(); else if (B.tab==='ext') renderExtTab(); else renderIntTab();
  if (keepScroll) bBody.scrollTop=st;
}
// ---- the blueprint ----
function planCanvas(maxH){ const { GW, GD }=BUILD; const pad=12; const cs=Math.max(30, Math.min((Math.min(bBody.clientWidth-4,520)-pad*2)/GW, ((maxH||bBody.clientHeight-56)-pad*2-18)/GD)); const w=Math.round(cs*GW+pad*2), h=Math.round(cs*GD+pad*2+18);
  return `<canvas id="bp" width="${Math.round(w*devicePixelRatio)}" height="${Math.round(h*devicePixelRatio)}" style="width:${w}px;height:${h}px"></canvas>`; }
function bpGeom(cv){ const { GW }=BUILD; const w=cv.clientWidth, pad=12, cs=(w-pad*2)/GW; return { pad, cs }; }
function drawPlan(cv, drawRect){
  const B=buildMode, plan=B.draft.plan, { GW, GD }=BUILD; const x=cv.getContext('2d'); const dpr=devicePixelRatio; x.setTransform(dpr,0,0,dpr,0,0);
  const { pad, cs }=bpGeom(cv); const W=cv.clientWidth, H=cv.clientHeight; x.clearRect(0,0,W,H);
  x.fillStyle='#cfe3b8'; x.fillRect(pad,pad,cs*GW,cs*GD);
  x.strokeStyle='rgba(90,120,70,.35)'; x.lineWidth=1; for(let i=0;i<=GW;i++){ x.beginPath(); x.moveTo(pad+i*cs,pad); x.lineTo(pad+i*cs,pad+cs*GD); x.stroke(); } for(let j=0;j<=GD;j++){ x.beginPath(); x.moveTo(pad,pad+j*cs); x.lineTo(pad+cs*GW,pad+j*cs); x.stroke(); }
  const occ=planGrid(plan);
  plan.rooms.forEach(r=>{ x.fillStyle=hexs(new THREE.Color(r.floorC).lerp(new THREE.Color(0xffffff),0.35).getHex()); x.fillRect(pad+r.x*cs,pad+r.z*cs,r.w*cs,r.d*cs); });
  // walls
  const line=(x1,y1,x2,y2,w,c,dash)=>{ x.beginPath(); x.setLineDash(dash||[]); x.strokeStyle=c; x.lineWidth=w; x.moveTo(x1,y1); x.lineTo(x2,y2); x.stroke(); x.setLineDash([]); };
  const mids={}; // middle unit edge for each room pair (where the doorway goes)
  const pairs={}; for(let j=0;j<GD;j++) for(let i=0;i<GW;i++){ const k=occ[j][i]; if(k<0) continue; for(const [di,dj] of [[1,0],[0,1]]){ const n=occ[j+dj]?.[i+di]; if(n===undefined||n<0||n===k) continue; const key=linkKey(plan.rooms[k].id,plan.rooms[n].id)+(dj?'h':'v'); (pairs[key]=pairs[key]||[]).push([i,j,di,dj]); } }
  for (const key in pairs){ const L=pairs[key]; L.sort((a,b)=>a[0]-b[0]||a[1]-b[1]); const m=L[Math.floor((L.length-1)/2)]; mids[m.join(',')]=true; }
  for(let j=0;j<GD;j++) for(let i=0;i<GW;i++){ const k=occ[j][i]; if(k<0) continue; const X=pad+i*cs, Y=pad+j*cs;
    for (const [di,dj,x1,y1,x2,y2] of [[1,0,X+cs,Y,X+cs,Y+cs],[-1,0,X,Y,X,Y+cs],[0,1,X,Y+cs,X+cs,Y+cs],[0,-1,X,Y,X+cs,Y]]){ const n=occ[j+dj]?.[i+di];
      if (n===undefined||n<0){ const isDoor = dj===1 && plan.door && plan.door.i===i && plan.door.j===j; line(x1,y1,x2,y2,5,'#5b4332'); if(isDoor){ line(x1+cs*0.25,y1,x2-cs*0.25,y2,7,'#e0745a'); x.fillStyle='#5b4332'; x.font='600 10px Fredoka, sans-serif'; x.textAlign='center'; x.fillText('door',(x1+x2)/2,y1+13); } continue; }
      if (n===k || di<0 || dj<0) continue; const t=linkOf(plan,plan.rooms[k].id,plan.rooms[n].id);
      if (t==='wall') line(x1,y1,x2,y2,4,'#5b4332'); else if (t==='open') line(x1,y1,x2,y2,2,'rgba(91,67,50,.45)',[4,4]);
      else { line(x1,y1,x2,y2,3,'#5b4332'); if (mids[[i,j,di,dj].join(',')]){ const mx=(x1+x2)/2, my=(y1+y2)/2, hl=cs*0.27; line(mx-(dj?hl:0),my-(di?hl:0),mx+(dj?hl:0),my+(di?hl:0),5,'#fff8ea'); } } } }
  // selection
  const sel=plan.rooms.find(r=>r.id===B.sel); if (sel && (B.tab!=='layout' || B.mode==='rooms')){ x.strokeStyle='#4f9a3a'; x.lineWidth=3; x.setLineDash([6,4]); x.strokeRect(pad+sel.x*cs+3,pad+sel.z*cs+3,sel.w*cs-6,sel.d*cs-6); x.setLineDash([]);
    if (B.tab==='layout') for(const [hx,hy] of [[sel.x+sel.w/2,sel.z],[sel.x+sel.w/2,sel.z+sel.d],[sel.x,sel.z+sel.d/2],[sel.x+sel.w,sel.z+sel.d/2]]){ x.fillStyle='#4f9a3a'; x.beginPath(); x.arc(pad+hx*cs,pad+hy*cs,6,0,TAU); x.fill(); x.fillStyle='#fff'; x.beginPath(); x.arc(pad+hx*cs,pad+hy*cs,2.5,0,TAU); x.fill(); } }
  if (drawRect){ const [a,b]=drawRect; x.fillStyle='rgba(124,195,90,.45)'; x.strokeStyle='#4f9a3a'; x.lineWidth=2; const X0=Math.min(a[0],b[0]), Z0=Math.min(a[1],b[1]), w=Math.abs(a[0]-b[0])+1, d=Math.abs(a[1]-b[1])+1; x.fillRect(pad+X0*cs,pad+Z0*cs,w*cs,d*cs); x.strokeRect(pad+X0*cs,pad+Z0*cs,w*cs,d*cs); }
  x.fillStyle='#8b6b50'; x.font='600 12px Fredoka, sans-serif'; x.textAlign='center'; x.fillText('front of the lot (path side)', W/2, pad+cs*GD+15);
}
function bpPoint(cv, e){ const r=cv.getBoundingClientRect(), { pad, cs }=bpGeom(cv); return [(e.clientX-r.left-pad)/cs, (e.clientY-r.top-pad)/cs]; }
function roomAtCell(plan,i,j){ return plan.rooms.find(r=>i>=r.x&&i<r.x+r.w&&j>=r.z&&j<r.z+r.d); }
function applyOrRevert(fn, revert){ const plan=buildMode.draft.plan; fn(); fixDoor(plan); const p=planProblem(plan); if (p){ revert(); fixDoor(plan); toast(p); Snd.fail(); return false; } return true; }
function renderLayoutTab(){
  const B=buildMode, plan=B.draft.plan, { GW, GD }=BUILD; const sel=plan.rooms.find(r=>r.id===B.sel);
  bBody.innerHTML=`<div class="brow"><div class="chips"><button class="chip${B.mode==='rooms'?' on':''}" data-m="rooms">Rooms</button><button class="chip${B.mode==='doors'?' on':''}" data-m="doors">Doors &amp; walls</button></div>
    ${B.mode==='rooms'&&sel&&plan.rooms.length>1?'<button class="btn alt" id="bDel" style="padding:4px 12px;font-size:13px">Remove room</button>':''}</div>`+planCanvas();
  bBody.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ B.mode=b.dataset.m; Snd.click(); renderBuild(); });
  const del=$('#bDel'); if (del) del.onclick=()=>{ const i=plan.rooms.indexOf(sel), saved=JSON.stringify(plan); if (applyOrRevert(()=>{ plan.rooms.splice(i,1); }, ()=>Object.assign(plan, JSON.parse(saved)))){ B.sel=plan.rooms[0].id; previewBuild(); } renderBuild(); };
  const cv=$('#bp'); drawPlan(cv); let drag=null;
  cv.onpointerdown=e=>{ e.preventDefault(); cv.setPointerCapture(e.pointerId); const [fx,fz]=bpPoint(cv,e), i=Math.floor(fx), j=Math.floor(fz);
    if (B.mode==='doors'){ drag={ type:'tap' }; return; }
    const r=roomAtCell(plan,i,j), m=0.32;
    if (r && r.id===B.sel){ const d={ l:fx-r.x, r:r.x+r.w-fx, t:fz-r.z, b:r.z+r.d-fz }; const side=Object.entries(d).sort((a,b)=>a[1]-b[1])[0]; drag={ type: side[1]<m ? 'resize':'move', side:side[0], r, orig:{...r}, fx, fz, saved:JSON.stringify(plan) }; }
    else if (r){ B.sel=r.id; Snd.click(); drawPlan(cv); drag={ type:'move', r, orig:{...r}, fx, fz, saved:JSON.stringify(plan), justSel:true }; }
    else if (i>=0&&j>=0&&i<GW&&j<GD){ drag={ type:'draw', a:[i,j], b:[i,j] }; drawPlan(cv, [drag.a,drag.b]); } };
  cv.onpointermove=e=>{ if(!drag) return; const [fx,fz]=bpPoint(cv,e);
    if (drag.type==='draw'){ drag.b=[clamp(Math.floor(fx),0,GW-1), clamp(Math.floor(fz),0,GD-1)]; drawPlan(cv,[drag.a,drag.b]); return; }
    if (drag.type==='move'){ const o=drag.orig; drag.r.x=clamp(o.x+Math.round(fx-drag.fx),0,GW-o.w); drag.r.z=clamp(o.z+Math.round(fz-drag.fz),0,GD-o.d); drawPlan(cv); return; }
    if (drag.type==='resize'){ const o=drag.orig, r=drag.r, s=drag.side;
      if (s==='r') r.w=clamp(Math.round(fx)-o.x,1,GW-o.x); if (s==='b') r.d=clamp(Math.round(fz)-o.z,1,GD-o.z);
      if (s==='l'){ const nx=clamp(Math.round(fx),0,o.x+o.w-1); r.x=nx; r.w=o.x+o.w-nx; } if (s==='t'){ const nz=clamp(Math.round(fz),0,o.z+o.d-1); r.z=nz; r.d=o.z+o.d-nz; }
      drawPlan(cv); } };
  cv.onpointerup=e=>{ const d=drag; drag=null; if(!d) return; const [fx,fz]=bpPoint(cv,e);
    if (d.type==='tap'){ doorTap(fx,fz); return; }
    if (d.type==='draw'){ const X0=Math.min(d.a[0],d.b[0]), Z0=Math.min(d.a[1],d.b[1]), w=Math.abs(d.a[0]-d.b[0])+1, dd=Math.abs(d.a[1]-d.b[1])+1;
      const like=plan.rooms.find(r=>r.id===B.sel)||plan.rooms[0]; const nr=Object.assign(defaultRoom('r'+Date.now().toString(36),X0,Z0,w,dd), like?{ floor:like.floor, floorC:like.floorC, paper:like.paper, paperC:like.paperC }:{});
      const touches = !plan.rooms.length || plan.rooms.some(r=>(X0<r.x+r.w && r.x<X0+w && (Z0===r.z+r.d || r.z===Z0+dd)) || (Z0<r.z+r.d && r.z<Z0+dd && (X0===r.x+r.w || r.x===X0+w)));
      if (!touches){ toast('New rooms need to touch the house.'); Snd.fail(); drawPlan(cv); return; }
      if (applyOrRevert(()=>plan.rooms.push(nr), ()=>plan.rooms.pop())){ B.sel=nr.id; Snd.pop(); previewBuild(); }
      renderBuild(); return; }
    const changed = d.r.x!==d.orig.x||d.r.z!==d.orig.z||d.r.w!==d.orig.w||d.r.d!==d.orig.d;
    if (!changed){ drawPlan(cv); if(d.justSel) renderBuild(true); return; }
    if (applyOrRevert(()=>{}, ()=>{ const p=JSON.parse(d.saved); plan.rooms=p.rooms; plan.door=p.door; plan.links=p.links; })){ Snd.click(); previewBuild(); }
    renderBuild(); };
}
function doorTap(fx,fz){
  const B=buildMode, plan=B.draft.plan, occ=planGrid(plan); const ex=fx-Math.round(fx), ez=fz-Math.round(fz);
  let A,Bn,front=null;
  if (Math.abs(ex)<Math.abs(ez) && Math.abs(ex)<0.32){ const L=Math.round(fx), j=Math.floor(fz); A=occ[j]?.[L-1]; Bn=occ[j]?.[L]; }
  else if (Math.abs(ez)<0.32){ const L=Math.round(fz), i=Math.floor(fx); A=occ[L-1]?.[i]; Bn=occ[L]?.[i]; if (A>=0 && !(Bn>=0)) front={ i, j:L-1 }; }
  else return;
  if (front){ plan.door=front; Snd.pop(); previewBuild(); renderBuild(true); toast('Front door moved.'); return; }
  if (!(A>=0) || !(Bn>=0) || A===Bn){ toast('Tap a wall between two rooms, or a front-facing outside wall.'); return; }
  const key=linkKey(plan.rooms[A].id, plan.rooms[Bn].id), cur=plan.links[key]||'door', nxt={ door:'open', open:'wall', wall:'door' }[cur];
  if (applyOrRevert(()=>{ plan.links[key]=nxt; }, ()=>{ plan.links[key]=cur; })){ Snd.click(); previewBuild(); toast({ door:'Doorway', open:'Open (no wall)', wall:'Solid wall' }[nxt]); }
  renderBuild(true);
}
// ---- outside ----
const chipRow = (obj, key, opts, type='s') => `<div class="chips">${opts.map(([v,n])=>`<button class="chip${obj[key]===v?' on':''}" data-k="${key}" data-v="${v}" data-ty="${type}">${n}</button>`).join('')}</div>`;
const swatchRow = (obj, key, cols) => `<div class="sws">${cols.map(c=>`<div class="sw${obj[key]===c?' on':''}" style="background:${hexs(c)}" data-k="${key}" data-v="${c}" data-ty="n"></div>`).join('')}</div>`;
const toggle = (obj, key, on, off) => chipRow(obj, key, [[true,on],[false,off]], 'b');
function bindStyle(obj, after){ bBody.querySelectorAll('[data-k]').forEach(el=>el.onclick=()=>{ const t=el.dataset.ty, v=el.dataset.v; obj[el.dataset.k] = t==='n'?+v : t==='b'?v==='true' : v; Snd.click(); after(); }); }
// Guests get a smaller set of house styles
const GUEST_BUILD = Object.assign({}, BUILD, { walls:BUILD.walls.slice(0,3), roofs:BUILD.roofs.slice(0,2), doors:BUILD.doors.slice(0,2), windows:BUILD.windows.slice(0,2), porches:BUILD.porches.slice(0,2), chimneys:BUILD.chimneys.slice(0,1), stories:BUILD.stories.slice(0,1) });
function renderExtTab(){
  const E=buildMode.draft.ext, B=GUEST ? GUEST_BUILD : BUILD; const sec=(t,h)=>`<div class="bsec"><b>${t}</b>${h}</div>`;
  bBody.innerHTML = sec('Walls', chipRow(E,'wall',B.walls)+'<div style="height:6px"></div>'+swatchRow(E,'wallC',B.wallColors))
    + sec('Roof', chipRow(E,'roof',B.roofs)+'<div style="height:6px"></div>'+swatchRow(E,'roofC',B.roofColors))
    + sec('Trim and window frames', swatchRow(E,'trimC',B.trimColors))
    + sec('Front door', chipRow(E,'door',B.doors)+'<div style="height:6px"></div>'+swatchRow(E,'doorC',B.doorColors))
    + sec('Windows', chipRow(E,'win',B.windows)+'<div style="height:6px"></div>'+toggle(E,'shutters','Shutters','No shutters')+'<div style="height:6px"></div>'+swatchRow(E,'shutC',B.doorColors)+'<div style="height:6px"></div>'+toggle(E,'boxes','Flower boxes','No flower boxes'))
    + sec('Porch', chipRow(E,'porch',B.porches)) + sec('Foundation', chipRow(E,'found',B.founds)) + sec('Chimney', chipRow(E,'chimney',B.chimneys))
    + sec('Height', chipRow(E,'stories',B.stories,'n')) + sec('Door lamps', toggle(E,'lamps','On','Off'));
  bindStyle(E, ()=>{ previewBuild('house'); renderBuild(true); });
}
// ---- inside ----
function renderIntTab(){
  const B=buildMode, plan=B.draft.plan, BD=BUILD; let r=plan.rooms.find(x=>x.id===B.sel)||plan.rooms[0]; B.sel=r.id;
  const sec=(t,h)=>`<div class="bsec"><b>${t}</b>${h}</div>`;
  bBody.innerHTML = `<div class="muted" style="margin:4px 0 6px">Tap a room to style it.</div>`+planCanvas(190)
    + sec('Floor', chipRow(r,'floor',BD.floors)+'<div style="height:6px"></div>'+swatchRow(r,'floorC',BD.floorColors))
    + sec('Wallpaper', chipRow(r,'paper',BD.papers)+'<div style="height:6px"></div>'+swatchRow(r,'paperC',BD.wallColors))
    + `<button class="btn alt" id="bAll" style="margin-top:8px">Use this style in every room</button>`;
  const cv=$('#bp'); drawPlan(cv);
  cv.onpointerdown=e=>{ const [fx,fz]=bpPoint(cv,e); const hit=roomAtCell(plan,Math.floor(fx),Math.floor(fz)); if(hit){ B.sel=hit.id; Snd.click(); renderBuild(true); } };
  bindStyle(r, ()=>{ previewBuild('room'); renderBuild(true); });
  $('#bAll').onclick=()=>{ for(const o of plan.rooms){ o.floor=r.floor; o.floorC=r.floorC; o.paper=r.paper; o.paperC=r.paperC; } Snd.pop(); previewBuild('room'); renderBuild(true); };
}

/* Island board */
function openBoard(){
  const render=()=>{ const d=Time.now();
    let h=`<div class="notice"><b>${S.island||'Island'} news</b><br>${d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}. Weather: ${World.weather}.</div>`;
    if (S.day.peddler) h+=`<div class="notice">A traveling peddler named Fennick is near the dock today.</div>`;
    for(const e of activeEvents()) h+=`<div class="notice">${e.notice}</div>`;
    h+=`<div class="notice">Ripe fruit trees: ${trees.filter(t=>!t.removed&&t.fruit&&t.fruitLeft()>0).length}. Cracks to dig: ${S.day.digs.filter(x=>!x.dug).length}. Islanders: ${RESIDENTS.length}.</div>`;
    h+=`<div class="notice"><b>Your progress</b><br>Critters caught: ${S.caught} · Items discovered: ${discovered()} · Best friends: ${bestFriends()}</div>`;
    h+=`<div class="notice"><b>Your home</b><br>`;
    if (!S.home.built) h+=`You're still in a tent! Design a real house: draw the rooms, pick the walls, roof, windows, door and porch, then lay out the inside. A starter house of 9 floor squares costs ${fmt(houseCost(9,0))} clams. <br><button class="btn" id="bdOpen" style="margin-top:8px">Design my house</button>`;
    else h+=`${S.home.plan.rooms.length} room${S.home.plan.rooms.length>1?'s':''} · ${planCells(S.home.plan)} floor squares. Restyling is always free; new floor space costs clams. You can also tap <b>Build</b> near your house.<br><button class="btn" id="bdOpen" style="margin-top:8px">Open build mode</button>`;
    h+=`</div><div class="notice"><b>Museum</b><br>${donatedCount()} of ${MUSEUM_TOTAL} displays filled. Professor Thistle is just south of the plaza.</div>`;
    pBody.innerHTML=h;
    pBody.querySelector('#bdOpen').onclick=()=>{ panelClose=null; closePanel(); openBuild(); };
  };
  openPanel('Island Board'); render();
}

/* Menu: settings, controls, testing tools */
let menuOpen=false;
function openMenu(){
  const c=CT();
  const render=()=>{
    pBody.innerHTML=`<div class="notice"><b>${S.player}</b> of <b>${S.island}</b><br><span class="muted">Caught: ${S.caught} · Discovered: ${discovered()} · Bag: ${slotsMax()} slots</span></div>
    <label class="f">Sound <select id="mSnd"><option value="1">On</option><option value="0">Off</option></select></label>
    <label class="f">Music volume</label><input type="range" id="mMus" min="0" max="1" step="0.05" value="${S.settings.music}">
    <label class="f">Brightness</label><input type="range" id="mBr" min="0.7" max="1.7" step="0.05" value="${S.settings.bright}">
    <label class="f">Terrain (preview) <select id="mTer"><option value="tiers">Gentle terraces</option><option value="hills">Smooth hills</option><option value="flat">Original flat</option></select></label>
    <div class="notice" style="margin-top:14px"><b>Controls</b>
      <label class="f">Walking <select id="cMove"><option value="joystick">On-screen joystick</option><option value="tap">Tap and hold to walk</option></select></label>
      <div id="cJoy">
        <button class="btn" id="cLayout" style="margin:8px 0">Move joystick and action button</button>
        <label class="f">Tap the ground to walk too <select id="cTap"><option value="1">On</option><option value="0">Off</option></select></label>
        <label class="f">Joystick style <select id="cFloat"><option value="0">Fixed in place</option><option value="1">Appears where you touch</option></select></label>
        <label class="f">Joystick size</label><input type="range" id="cSize" min="90" max="190" step="5" value="${c.size}">
        <label class="f">Joystick visibility</label><input type="range" id="cOp" min="0.1" max="0.9" step="0.05" value="${c.opacity}">
        <button class="btn alt" id="cReset" style="margin-top:10px">Reset controls</button>
      </div>
      <div class="muted" style="margin-top:8px">Tapping things always works. Walk slowly near bugs or they fly off. Keyboard: WASD to walk, E or Space to act, Q to switch tools.</div>
    </div>
    <div class="notice"><b>Testing tools</b><br><span class="muted">The game runs on your real clock. These preview other times and weather.</span>
      <label class="f">Preview time: <span id="mOffT"></span></label><input type="range" id="mOff" min="-23" max="23" step="1" value="${Time.offsetH}">
      <label class="f">Weather <select id="mW"><option value="">Today's weather</option><option>sunny</option><option>cloudy</option><option>rain</option><option>snow</option></select></label>
    </div>
    <button class="btn warn" id="mReset">Start a new island</button>${saveOK?'':'<div class="muted" style="margin-top:8px">Saving isn\'t available in this browser.</div>'}`;
    const snd=$('#mSnd'); snd.value=S.settings.sound?'1':'0'; snd.onchange=()=>{ Snd.setOn(snd.value==='1'); save(); };
    $('#mMus').oninput=e=>{ Snd.setMusic(+e.target.value); save(); };
    const ter=$('#mTer'); ter.value=TERRAIN_STYLE; ter.onchange=()=>{ try{ localStorage.setItem('driftwood-terrain', ter.value); }catch(e){} save(); location.reload(); };
    $('#mBr').oninput=e=>{ S.settings.bright=+e.target.value; save(); updateSky(); };
    const sync=()=>{ $('#cJoy').style.display=c.move==='joystick'?'':'none'; save(); applyControls(); };
    $('#cMove').value=c.move; $('#cMove').onchange=e=>{ c.move=e.target.value; sync(); };
    $('#cTap').value=c.tapWalk?'1':'0'; $('#cTap').onchange=e=>{ c.tapWalk=e.target.value==='1'; sync(); };
    $('#cFloat').value=c.floating?'1':'0'; $('#cFloat').onchange=e=>{ c.floating=e.target.value==='1'; sync(); };
    $('#cSize').oninput=e=>{ c.size=+e.target.value; sync(); };
    $('#cOp').oninput=e=>{ c.opacity=+e.target.value; sync(); };
    $('#cLayout').onclick=()=>{ closePanel(); startLayout(); };
    $('#cReset').onclick=()=>{ Object.assign(c, CTRL_DEFAULT, {move:'joystick'}); save(); applyControls(); render(); };
    const offT=()=>{ $('#mOffT').textContent = Time.offsetH===0?'now':(Time.offsetH>0?'+':'')+Time.offsetH+'h'; }; offT();
    $('#mOff').oninput=e=>{ Time.offsetH=+e.target.value; offT(); if(rollDay()) spawnDaily(); updateSky(); updateHUD(); };
    const w=$('#mW'); w.value=weatherOverride||''; w.onchange=()=>{ weatherOverride=w.value||null; World.weather=weatherOverride||S.day.weather; updateSky(); updateHUD(); };
    $('#mReset').onclick=()=>{ pBody.innerHTML=`<p>This erases your island, items and friendships. Are you sure?</p><button class="btn warn" id="rY">Yes, start over</button> <button class="btn alt" id="rN">Keep my island</button>`; $('#rY').onclick=()=>{ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} location.reload(); }; $('#rN').onclick=render; };
    sync();
  };
  openPanel('Menu',()=>{ menuOpen=false; scrim.classList.remove('top'); $('#hud').classList.remove('menuprev'); }); menuOpen=true; scrim.classList.add('top'); $('#hud').classList.add('menuprev'); render();
}
$('#bBag').onclick=()=>openBag(); $('#bBook').onclick=()=>openBook(); $('#bMenu').onclick=()=>openMenu(); $('#bCraft').onclick=()=>openCraft(); updateCraftBtn();

/* Tool selector */
const toolBtn=$('#toolBtn'), toolPop=$('#toolPop');
const HAND_SVG='<svg viewBox="0 0 32 32"><path d="M10 17V8a2 2 0 0 1 4 0v7V6a2 2 0 0 1 4 0v9V8a2 2 0 0 1 4 0v10c0 6-3 10-8 10s-7-3-9-7l-2-4a2 2 0 0 1 3-2l2 3z" fill="#f3c9a5" stroke="#8b6b50" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function updateToolBtn(){ toolBtn.innerHTML = S.equip&&hasTool(S.equip) ? `<img src="${toolThumb(S.equip,toolTier(S.equip))}">` : HAND_SVG; }
function cycleTool(){ const owned=['',...Object.keys(TOOLS).filter(hasTool)]; const i=owned.indexOf(S.equip||''); equip(owned[(i+1)%owned.length]||null); Snd.click(); }
toolBtn.addEventListener('click', e=>{ e.stopPropagation(); if(toolPop.classList.contains('show')){ toolPop.classList.remove('show'); return; }
  let h=`<button class="tp${!S.equip?' on':''}" data-t="">${HAND_SVG}<span>Hands</span></button>`;
  for(const t of Object.keys(TOOLS)){ const T=S.tools[t]; if(!T) continue; const d=TOOLS[t].tiers[T.tier]; h+=`<button class="tp${S.equip===t?' on':''}" data-t="${t}"><img src="${toolThumb(t,T.tier)}"><span>${TOOLS[t].name}</span><i style="width:${d.forever?100:Math.max(4,T.uses/d.uses*100)}%"></i></button>`; }
  if (!Object.keys(S.tools).length) h+='<div class="muted" style="padding:6px">No tools yet. The stall sells them.</div>';
  toolPop.innerHTML=h; toolPop.classList.add('show'); positionToolPop(); Snd.click();
  toolPop.querySelectorAll('[data-t]').forEach(b=>b.onclick=ev=>{ ev.stopPropagation(); equip(b.dataset.t||null); toolPop.classList.remove('show'); Snd.click(); }); });
addEventListener('pointerdown', e=>{ if(!toolPop.contains(e.target) && e.target!==toolBtn && !toolBtn.contains(e.target)) toolPop.classList.remove('show'); });
function positionToolPop(){ const r=toolBtn.getBoundingClientRect(); const w=Math.min(300, innerWidth-20); toolPop.style.width=w+'px'; toolPop.style.left=clamp(r.left+r.width/2-w/2,10,innerWidth-w-10)+'px'; toolPop.style.top=Math.max(10, r.top-toolPop.offsetHeight-10)+'px'; }

/* Placement: furniture and planting */
let placing=null;
function placementModel(id, mode){
  const it=ITEMS[id];
  if (mode==='furn') return buildItemModel(id);
  const sp=it.plant, P=PLANTS[sp];
  if (P.ptype==='flower') return buildFlower(sp,1); if (P.ptype==='shrub') return buildShrub(sp,0);
  return buildTree(mulberry32(1), sp==='fruittree'?'fruittree':sp, { stage:0 });
}
// moving = an already placed Furniture entity (Arrange > Move). Otherwise the item comes out of your bag.
function startPlacing(id, mode, moving){ if (noEdit()) return;
  if (placing) endPlacing();
  const m=placementModel(id, mode); m.traverse(c=>{ if(c.material && !c.userData.outline){ const mm=(Array.isArray(c.material)?c.material:[c.material]).map(x=>{ const y=x.clone(); y.transparent=true; y.opacity=0.65; return y; }); c.material=Array.isArray(c.material)?mm:mm[0]; } });
  let p; if (moving){ p=moving.pos.clone(); moving.obj.visible=false; moving.solid=false; }
  else { p=player.pos.clone().add(new THREE.Vector3(Math.sin(player.face)*1.8,0,Math.cos(player.face)*1.8)); p.y=World.inside?0:groundY(p.x,p.z); }
  const rot = moving ? (moving.rec.rot||0) : 0; m.rotation.y=rot;
  m.position.copy(p); scene.add(m); placing={ id, mode, m, rot, moving }; $('#placeBar').classList.add('show'); $('#pOk').textContent=mode==='plant'?'Plant':'Place';
  const ring=new THREE.Mesh(new THREE.RingGeometry(0.62,0.78,32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.75, depthWrite:false })); ring.position.y=0.04; m.add(ring); placing.ring=ring;
  if (!S.dragTip){ S.dragTip=true; save(); toast('Drag it with your finger to place it exactly. The arrows turn it.'); }
  checkPlace();
}
function checkPlace(){
  const p=placing.m.position, it=ITEMS[placing.id]; let ok=walkable(p.x,p.z) && Math.hypot(p.x-player.pos.x,p.z-player.pos.z)>0.6 && !onDock(p.x,p.z) && !onBridge(p.x,p.z);
  if (placing.mode==='furn') ok = ok && !blocked(p.x,p.z,it.r);
  else { const P=PLANTS[it.plant], h=rawHeight(p.x,p.z); ok = ok && p.x<500 && (P.sand ? (h>0.15&&h<SAND_H) : h>SAND_H+0.05) && !blocked(p.x,p.z,P.ptype==='flower'?0.3:0.8);
    const gap = P.ptype==='flower'?0.55:1.6; ok = ok && !S.plants.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<gap) && !trees.some(t=>!t.removed&&Math.hypot(t.pos.x-p.x,t.pos.z-p.z)<(P.ptype==='tree'?2.2:1.0)); }
  placing.ok=ok; placing.m.traverse(c=>{ for(const mt of (Array.isArray(c.material)?c.material:[c.material])) if(mt&&mt.emissive&&!c.userData.outline) mt.emissive.setHex(ok?0x000000:0x882020); }); if(placing.ring) placing.ring.material.color.setHex(ok?0xffffff:0xe2604d); $('#pOk').disabled=!ok; return ok;
}
function endPlacing(){ const mv=placing.moving; if (mv && !placing.done){ mv.obj.visible=true; mv.solid=!ITEMS[mv.rec.id].flat; } scene.remove(placing.m); placing=null; $('#placeBar').classList.remove('show'); }
const turnBy = a => { if(!placing) return; placing.rot=((placing.rot+a)%TAU+TAU)%TAU; placing.m.rotation.y=placing.rot; Snd.click(); };
$('#pRotL').onclick=()=>turnBy(Math.PI/12); $('#pRotR').onclick=()=>turnBy(-Math.PI/12);
$('#pNo').onclick=()=>{ endPlacing(); Snd.click(); };
$('#pOk').onclick=()=>{ if(!checkPlace()) return; const p=placing.m.position, id=placing.id, it=ITEMS[id];
  if (placing.moving){ const e=placing.moving, rec=e.rec; rec.x=p.x; rec.z=p.z; rec.rot=placing.rot; e.pos.set(p.x, World.inside?0:groundY(p.x,p.z), p.z); e.obj.position.copy(e.pos); e.model.rotation.y=rec.rot; e.obj.visible=true; e.solid=!it.flat; placing.done=true; }
  else if (placing.mode==='furn'){ const rec={ id, x:p.x, z:p.z, rot:placing.rot }; removeItem(id,1); S.placed.push(rec); new Furniture(rec); }
  else { const P=PLANTS[it.plant]; if (P.ptype!=='flower' && !needTool('shovel')) return; if (P.ptype!=='flower') useTool('shovel');
    const rec={ id:'p'+Date.now().toString(36)+Math.floor(Math.random()*1e4), sp:it.plant, x:p.x, z:p.z, stage:0, rot:placing.rot, color:(P.colors&&P.colors.length)?P.colors[Math.floor(Math.random()*P.colors.length)]:undefined, lastGrow:today() };
    if (it.kind==='fruit') rec.fruit=id; removeItem(id,1); S.plants.push(rec); if (P.ptype==='tree') onReplant(p.clone()); plantEnts.push(P.ptype==='tree' ? new Tree(rec.id,rec.x,rec.z,rec.sp,rec.fruit||(rec.sp==='palm'?'coconut':null),rec) : new Plant(rec)); Snd.dig(); toast(`Planted! ${P.ptype==='tree'?'Trees take a few days to grow.':'Water it to help it grow.'}`); }
  puff(p.clone().add(new THREE.Vector3(0,0.3,0)),0xffffff,8,0.6,1.5,1,0.6); Snd.pop(); save(); endPlacing(); };

/* ---------- Input ---------- */
const keys={};
addEventListener('keydown', e=>{ if(e.target.tagName==='INPUT') return; const k=e.key.toLowerCase(); keys[k]=true; if((k===' '||k==='e') && !e.repeat){ e.preventDefault(); doAction(); } if(k==='q' && !e.repeat) cycleTool(); });
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
  if (buildMode) return;
  if (CatchMeter.bug){ resolveSwing(); return; }
  if (Fishing.state!=='idle'){ reel(); return; }
  const p=pickAt(cx,cy); if(!p) return;
  if (placing){ if (placing.dragged) return; const pt=p.ground||p.point||p.water; if(pt){ placing.m.position.set(pt.x,World.inside?0:groundY(pt.x,pt.z),pt.z); checkPlace(); } return; }
  if (p.ent){ const e=p.ent; goTo(e.pos, e, ()=>interact(e)); return; }
  if (p.ground){ if(CT().move==='joystick' && !CT().tapWalk) return; goTo(p.ground); return; }
  if (p.water){ const w=p.water; if(!isFishWater(w.x,w.z)) return; if(!hasTool('rod')){ toast('You need a fishing rod to fish. The stall sells them.'); Snd.fail(); return; }
    const dir=player.pos.clone().sub(w); dir.y=0; const L=dir.length(); dir.normalize(); let sp=null;
    for(let d=0; d<L; d+=0.25){ const x=w.x+dir.x*d, z=w.z+dir.z*d; if(walkable(x,z)){ sp=new THREE.Vector3(x+dir.x*0.4,0,z+dir.z*0.4); break; } }
    if(!sp) return; const tgt=w.clone(); if(tgt.distanceTo(sp)>7) tgt.copy(sp).addScaledVector(dir,-6);
    goTo(sp, null, ()=>castAt(tgt)); marker.visible=false; }
}
function interact(e, mode='tap'){ if(!ents.includes(e)) return; player.face=Math.atan2(e.pos.x-player.pos.x, e.pos.z-player.pos.z); if(!(e instanceof Bug)) player.act=0.35; hideHint(); e.act(mode); }
function nearestEnt(){ let best=null, bd=1e9; for(const e of ents){ if(e.removed||!e.label()) continue; const d=Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z); if(d<e.reach+0.3 && d<bd && entVisible(e)){ bd=d; best=e; } } return best; }
function facingWater(){ if(World.inside) return null; for(const d of [2.5,3.5,4.5]){ const x=player.pos.x+Math.sin(player.face)*d, z=player.pos.z+Math.cos(player.face)*d; if(isFishWater(x,z)) return new THREE.Vector3(x,0,z); } return null; }
function doAction(){ if(dlgState||scrim.classList.contains('show')||placing||layoutMode||buildMode) return; if(CatchMeter.bug){ resolveSwing(); return; } if(Fishing.state!=='idle'){ reel(); return; } const e=nearestEnt(); if(e){ stopMove(); interact(e,'manual'); return; } const w=facingWater(); if(w){ castAt(w); hideHint(); } }
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
  $('#hint').textContent = c.move==='joystick' ? (c.tapWalk?'Use the joystick or tap to walk. Tap things to interact.':'Use the joystick to walk. Tap things to interact.') : 'Tap to walk, hold to keep walking. Tap things to interact.';
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

// Canvas pointer: tap, hold-to-walk, pinch-zoom, wheel-zoom
const ptrs=new Map(); let camDist=isMobile?21:22, pinch0=0, dist0=0;
function groundAtScreen(cx,cy){ const rect=canvas.getBoundingClientRect(); ndc.set((cx-rect.left)/rect.width*2-1, -(cy-rect.top)/rect.height*2+1); ray.setFromCamera(ndc,camera); return rayGround(ray.ray); }
canvas.addEventListener('pointerdown', e=>{ canvas.focus(); ptrs.set(e.pointerId,{ x:e.clientX, y:e.clientY, t:performance.now(), sx:e.clientX, sy:e.clientY, held:false }); if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; pinch0=Math.hypot(a.x-b.x,a.y-b.y); dist0=camDist; if(placing) placing.drag=null; }
  if (placing && ptrs.size===1 && !dlgState){ const g=groundAtScreen(e.clientX,e.clientY); if(g){ const m=placing.m.position; const near=Math.hypot(g.x-m.x,g.z-m.z)<2.2; placing.drag={ id:e.pointerId, ox:near?m.x-g.x:0, oz:near?m.z-g.z:0 }; placing.dragged=false; } } });
canvas.addEventListener('pointermove', e=>{ const p=ptrs.get(e.pointerId); if(!p) return; const px=p.x; p.x=e.clientX; p.y=e.clientY; if(ptrs.size===2){ const [a,b]=[...ptrs.values()]; const pd=Math.hypot(a.x-b.x,a.y-b.y); if(buildMode){ if(p.pd) buildMode.dist=clamp(buildMode.dist*p.pd/pd,12,40); p.pd=pd; } else camDist=clamp(dist0*pinch0/pd,11,36); return; }
  if (buildMode && ptrs.size===1){ if (buildMode.view==='out') buildMode.yaw -= (e.clientX-px)*0.008; p.held=true; return; }
  if (placing && placing.drag && placing.drag.id===e.pointerId && Math.hypot(p.x-p.sx,p.y-p.sy)>4){ const g=groundAtScreen(e.clientX,e.clientY); if(g){ const x=g.x+placing.drag.ox, z=g.z+placing.drag.oz; placing.m.position.set(x, World.inside?0:groundY(x,z), z); placing.dragged=true; p.held=true; checkPlace(); } } });
function endPtr(e){ const p=ptrs.get(e.pointerId); if(!p) return; ptrs.delete(e.pointerId); const moved=Math.hypot(p.x-p.sx,p.y-p.sy), dt=performance.now()-p.t;
  if(ptrs.size===0 && !p.held && moved<14 && dt<450 && !dlgState && !scrim.classList.contains('show') && !layoutMode) handleTap(e.clientX,e.clientY);
  if(p.held && !placing && !buildMode) stopMove(); if(placing && placing.drag && placing.drag.id===e.pointerId){ placing.drag=null; setTimeout(()=>{ if(placing) placing.dragged=false; },0); } }
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e=>{ e.preventDefault(); if(buildMode) buildMode.dist=clamp(buildMode.dist+e.deltaY*0.02,12,40); else camDist=clamp(camDist+e.deltaY*0.02,11,36); }, { passive:false });
let holdAcc=0;
function updateHold(dt){ if(CT().move!=='tap') return; holdAcc+=dt; if(holdAcc<0.08) return; holdAcc=0; if(ptrs.size!==1 || dlgState || placing || Fishing.state!=='idle') return; const p=[...ptrs.values()][0]; if(performance.now()-p.t<220 && Math.hypot(p.x-p.sx,p.y-p.sy)<14) return; p.held=true;
  const rect=canvas.getBoundingClientRect(); ndc.set((p.x-rect.left)/rect.width*2-1, -(p.y-rect.top)/rect.height*2+1); ray.setFromCamera(ndc,camera); const g=rayGround(ray.ray); if(g){ player.target=new THREE.Vector3(g.x,0,g.z); player.targetEnt=null; player.cb=null; marker.visible=false; } }

/* ---------- Movement and camera ---------- */
function movePlayer(dt,t){
  const u=player.obj.userData; let mv=null; const speed=5.4; let spd=1;
  const kx=(keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0), kz=(keys['s']||keys['arrowdown']?1:0)-(keys['w']||keys['arrowup']?1:0);
  const jm=Math.hypot(joy.x,joy.y), busy=dlgState||placing||layoutMode||buildMode||CatchMeter.bug;
  if (joy.active && jm>0.15 && !busy){ stopMove(); if(Fishing.state!=='idle') reel(); mv=new THREE.Vector3(joy.x,0,joy.y).normalize(); spd=clamp((jm-0.15)/0.7,0.25,1); hideHint(); }
  else if ((kx||kz) && !busy){ stopMove(); if(Fishing.state!=='idle') reel(); mv=new THREE.Vector3(kx,0,kz).normalize(); if(keys['shift']) spd=0.4; hideHint(); }
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
  if (mv && !dlgState && Fishing.state==='idle' && !CatchMeter.bug && !buildMode){
    const step=speed*spd*dt; const p=player.pos; const nx=p.x+mv.x*step, nz=p.z+mv.z*step; let ok=false; ignoreRects = !World.inside && !!inRects(p.x,p.z,0.3);
    if(walkable(nx,nz)&&!blocked(nx,nz,0.35)){ p.x=nx; p.z=nz; ok=true; } else if(walkable(nx,p.z)&&!blocked(nx,p.z,0.35)){ p.x=nx; ok=true; } else if(walkable(p.x,nz)&&!blocked(p.x,nz,0.35)){ p.z=nz; ok=true; }
    if (!ok){ for(const s of [0.9,-0.9,1.6,-1.6]){ const c=Math.cos(s), sn=Math.sin(s); const vx=mv.x*c-mv.z*sn, vz=mv.x*sn+mv.z*c; const ax=p.x+vx*step, az=p.z+vz*step; if(walkable(ax,az)&&!blocked(ax,az,0.35)){ p.x=ax; p.z=az; ok=true; break; } } }
    ignoreRects=false; if (ok) player.speedFrac=spd;
    player.face=Math.atan2(mv.x,mv.z);
    const ph=t*(5+6*spd); u.legs[0].rotation.x=Math.sin(ph)*0.7*spd; u.legs[1].rotation.x=-Math.sin(ph)*0.7*spd; u.arms[0].rotation.x=-Math.sin(ph)*0.6*spd; if(!S.equip) u.arms[1].rotation.x=Math.sin(ph)*0.6*spd; else u.arms[1].rotation.x=-0.3; u.body.position.y=Math.abs(Math.sin(ph))*0.07*spd;
    if (!World.inside && Math.random()<dt*6*spd && rawHeight(p.x,p.z)<SAND_H && !onDock(p.x,p.z) && !onBridge(p.x,p.z)) puff(p.clone().add(new THREE.Vector3(0,0.05,0)),0xf3dca6,1,0.2,0.6,0.5,0.4);
  } else { u.legs.forEach(l=>l.rotation.x*=0.8); u.body.position.y*=0.8; u.arms[0].rotation.x*=0.8;
    u.arms[1].rotation.x = player.act>0 ? -Math.sin(player.act/0.35*Math.PI)*1.6 : (Fishing.state!=='idle'?-1.1:(S.equip?-0.3:u.arms[1].rotation.x*0.8)); }
  player.act=Math.max(0,player.act-dt);
  if (World.inside && !buildMode){ const R=ROOMS[World.inside]; if (R.exitCheck ? R.exitCheck(player.pos.x,player.pos.z) : (player.pos.z > R.oz+R.d/2-0.35 && Math.abs(player.pos.x-R.ox)<1.3)) exitRoom(); }
  player.pos.y=lerp(player.pos.y, World.inside?0:groundY(player.pos.x,player.pos.z), Math.min(1,dt*14));
  player.obj.position.copy(player.pos);
  let d=player.face-player.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); player.obj.rotation.y+=d*Math.min(1,dt*12);
  marker.material.opacity=0.5+Math.sin(t*6)*0.3;
}
const camTarget=new THREE.Vector3();
function updateCamera(dt){
  if (buildMode){ camTarget.lerp(buildMode.camT, Math.min(1,dt*5)); const dist=buildMode.dist, pitch=buildMode.view==='in'?1.05:0.6, yaw=buildMode.yaw;
    camera.position.set(camTarget.x+Math.sin(yaw)*Math.cos(pitch)*dist, camTarget.y+Math.sin(pitch)*dist, camTarget.z+Math.cos(yaw)*Math.cos(pitch)*dist); camera.lookAt(camTarget);
    camera.setViewOffset(innerWidth, innerHeight, 0, buildEl.offsetHeight*0.5, innerWidth, innerHeight);
    sky.position.copy(camera.position); stars.position.copy(camera.position); sun.target.position.copy(camTarget); sun.position.copy(camTarget).addScaledVector(sunDir,50); return; }
  camTarget.lerp(player.pos.clone().add(new THREE.Vector3(0,0.8,0)), Math.min(1,dt*5));
  const dist = World.inside ? Math.min(camDist,15) : camDist; const pitch = World.inside ? 0.95 : 0.62+(camDist-11)/25*0.18;
  camera.position.set(camTarget.x, camTarget.y+Math.sin(pitch)*dist, camTarget.z+Math.cos(pitch)*dist); camera.lookAt(camTarget);
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  sun.target.position.copy(camTarget); sun.position.copy(camTarget).addScaledVector(sunDir,50);
}
function resize(){ const w=innerWidth, h=innerHeight; renderer.setSize(w,h,false); camera.aspect=w/h; camera.fov = w<h ? 48 : 38; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
let actLabel='';
function updateActButton(){
  $('#hud').classList.toggle('uihide', !!(dlgState || placing || buildMode || (scrim.classList.contains('show') && !menuOpen)));
  const nearHome = World.inside==='home' || (!World.inside && Math.hypot(player.pos.x-LOT.x, player.pos.z-LOT.z)<12);
  if (nearHome!==updateActButton.nh){ updateActButton.nh=nearHome; $('#bBuild').style.display=nearHome?'':'none'; }
  if (layoutMode) return;
  let lab=''; if(!dlgState && !placing && !buildMode && !scrim.classList.contains('show')){ if(CatchMeter.bug) lab='Swing!'; else if(Fishing.state!=='idle') lab='Reel'; else { const e=nearestEnt(); if(e) lab=e.label(); else if(facingWater()) lab='Fish'; } }
  if(lab!==actLabel){ actLabel=lab; if(lab){ actBtn.textContent=lab; actBtn.classList.add('show'); } else actBtn.classList.remove('show'); }
}

/* ---------- Main loop ---------- */
const clock=new THREE.Clock(); let t=0, secT=0, saveT=0, started=false;
function frame(){
  const dt=Math.min(0.05, clock.getDelta()); t+=dt;
  secT+=dt; if(secT>1){ secT=0; if(rollDay()){ spawnDaily(); toast('A new day on '+(S.island||'the island')+'!'); } updateSky(); updateHUD(); }
  saveT+=dt; if(saveT>15){ saveT=0; save(); }
  updateRemotes(dt,t);
  if (started){ updateHold(dt); movePlayer(dt,t); updateBugs(dt); updateFishing(dt,t); updateCatchMeter(dt); tickDialog(dt); updateActButton(); updateCutaway(); }
  for(const e of ents.slice()){ if (e.removed) continue; if (e instanceof Resident || Math.abs(e.pos.x-player.pos.x)<40) e.update(dt,t); }
  if (!World.inside){ updateWater(t); updateAmbient(dt,t); foam.scale.setScalar(1+Math.sin(t*0.8)*0.006);
    for(const c of clouds){ c.position.x+=c.userData.v*dt; if(c.position.x>150) c.position.x=-150; }
    const lnOn=activeEvents().some(e=>e.id==='lantern-night');
    for(const l of lanterns){ l.visible=lnOn; if(lnOn){ const u=l.userData; u.y+=dt*u.s; if(u.y>18){ u.y=0; u.a=Math.random()*TAU; } l.position.set(Math.cos(u.a+t*0.01)*u.d, 1+u.y, Math.sin(u.a+t*0.01)*u.d); l.children[1].material.opacity=Math.min(1,u.y/2)*(1-u.y/18)*0.9; } } }
  updatePrecip(dt,t); updateParticles(dt); updateCamera(dt);
  renderer.render(scene,camera); requestAnimationFrame(frame);
}
updateSky(); updateHUD(); camTarget.copy(player.pos); updateCamera(1); updateHeld(); updateToolBtn(); applyControls();
requestAnimationFrame(frame);

/* ---------- Start screen ---------- */
const isNew=!S.player || (BOOT.mode==='account' && !S.island);
if (isNew && S.player) $('#inName').value=S.player;
if (!isNew){ $('#newForm').classList.add('hide'); $('#backMsg').classList.remove('hide'); $('#backMsg').textContent='Welcome back to '+S.island+', '+S.player+'!'; $('#bStart').textContent='Continue'; }
$('#loading').textContent='';
$('#bStart').onclick=()=>{
  if (isNew){ S.player=($('#inName').value||'').trim()||'Sam'; S.island=($('#inIsle').value||'').trim()||'Pebblewick'; save(); }
  Snd.init(S.settings, World); if(Snd.ctx && Snd.ctx.state==='suspended') Snd.ctx.resume();
  $('#start').remove(); started=true; updateHUD();
  const p=residents[0];
  if (isNew) setTimeout(()=>dialog(p.spec.name, p.spec.voice, [fill('Oh! Hi hi! You must be {p}! Welcome to {isle}, {c}!',{c:p.spec.catch}), 'The stall by the plaza sells tools. Grab a net, a fishing rod and a shovel first. You\'ll need them for bugs, fish and fossils!', 'Oh, and sneak up on bugs slowly. They\'re shy. Come say hi to all seven of us, okay?']), 700);
  else if (S.migratedFrom1){ delete S.migratedFrom1; save(); setTimeout(()=>dialog(p.spec.name, p.spec.voice, [fill('{p}! Did you notice? The island got so much BIGGER overnight, {c}!',{c:p.spec.catch}), 'There\'s a river, a pond, and four new neighbors! And the stall sells tools now. You\'ll need them for bugs, fish and digging.', 'Your old furniture is safe. Anything that didn\'t fit went back in your bag.']), 700); }
  else toast('Welcome back, '+S.player+'!');
};
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
  if (!r){ const lk=LOOKS[hashStr(id)%LOOKS.length]; const obj=buildPlayer({ shirt:lk[0], hair:lk[1] }); const tag=nameTag(name||'Friend'); tag.position.y=2.45; obj.add(tag);
    scene.add(obj); r={ id, name, obj, pos:new THREE.Vector3(), tgt:new THREE.Vector3(), f:0, w:0, in:null, seen:false }; remotes.set(id,r); }
  if (st) remotePos(id, st);
  return r;
}
function remotePos(id, st){ const r=remotes.get(id); if(!r) return; r.tgt.set(st.x, st.y||0, st.z); r.f=st.f||0; r.w=st.w; r.in=st.in||null; if(!r.seen){ r.pos.copy(r.tgt); r.seen=true; } }
function remoteLeave(id){ const r=remotes.get(id); if(!r) return; scene.remove(r.obj); remotes.delete(id); }
function remoteEmote(id, e){ const txt=EMOTE_TEXT[e]; if(!txt) return; const pos = id==='me' ? player.pos : remotes.get(id)?.pos; if(!pos) return; const v=pos.clone(); v.y+=0.6; floatText(txt, v); if(id!=='me') Snd.pop(); }
function updateRemotes(dt,t){
  for (const r of remotes.values()){
    r.pos.lerp(r.tgt, Math.min(1, dt*8)); r.obj.position.copy(r.pos);
    let d=r.f-r.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d)); r.obj.rotation.y+=d*Math.min(1,dt*10);
    r.obj.visible = r.seen && (r.in||null)===(World.inside||null);
    const u=r.obj.userData; if(u.legs){ const ph=t*11, a=r.w?1:0; u.legs[0].rotation.x=Math.sin(ph)*0.7*a; u.legs[1].rotation.x=-Math.sin(ph)*0.7*a; if(u.arms){ u.arms[0].rotation.x=-Math.sin(ph)*0.6*a; u.arms[1].rotation.x=Math.sin(ph)*0.6*a; } }
  }
}
const playerState = () => ({ x:+player.pos.x.toFixed(2), z:+player.pos.z.toFixed(2), y:+player.pos.y.toFixed(2), f:+player.face.toFixed(2), w:player.speedFrac>0.05?1:0, in:World.inside||null });
// The server changed our bag (gift, mail or trade): take its copy
function setInventory(inv, seen, equip){ S.inv=inv; if(seen) S.seen=Object.assign(S.seen||{}, seen); if(equip!==undefined){ S.equip=equip; } try{ updateHeld(); updateToolBtn(); }catch(e){} updateHUD(); }
if (VISIT) setTimeout(()=>toast(`Visiting ${BOOT.host.name}'s island${BOOT.host.island?' ('+BOOT.host.island+')':''} as a ${BOOT.role}.`), 1500);

addEventListener('visibilitychange', ()=>{ if(document.hidden) save(); else if(Snd.ctx) Snd.ctx.resume(); });
window.__game = { get S(){ return S; }, net:{ visibleRemotes:()=>[...remotes.values()].filter(r=>r.obj.visible).map(r=>[r.name,+r.pos.x.toFixed(1),+r.pos.z.toFixed(1)]), remoteUpsert, remotePos, remoteLeave, remoteEmote, playerState, setInventory, toast:(m)=>toast(m), updateHUD:()=>updateHUD(), get started(){ return started; } }, ITEMS, itemThumb:(id)=>thumb(id), layoutInfo:()=>({ id:LAYOUT_ID, PLACES, PATHS, LOT, rects:RECTS.map(r=>r.slice(0,4)), lot:lotRect() }), terrainH:(x,z)=>rawHeight(x,z), terrainSlope:(x,z)=>hillSlope(x,z), interact, spawnBug:(id,x,z)=>new Bug(id,x,z), tapOdds:()=>Object.fromEntries(Object.keys(TAP_BASE).map(k=>[k, +tapChance({rarity:k}).toFixed(2)])), placingObj:()=>placing&&placing.m, toScreen:v=>{ const p=v.clone().project(camera); return [(p.x*0.5+0.5)*innerWidth, (-p.y*0.5+0.5)*innerHeight]; }, rebuildHome:()=>{ buildPlayerHouse(); rebuildHomeRoom(); }, openBuild, closeBuild, get buildMode(){ return buildMode; }, talkShop, openDonate, talkCurator, spawnMossby, onFelled, findPath, startPlacing, LOT, RECTS, shopEnts, museumEnt, houseEnt:()=>houseEnt, Time, player, ents, ITEMS, residents, World, ROOMS, goTo, handleTap, doAction, updateSky, rollDay, spawnDaily, castAt, Fishing, fishes, bugs, openBag, openBook, openShop, openBoard, openMenu, openCraft, doCraft, WOODWORK, enterRoom, exitRoom, equip, startLayout, endLayout, trees, applyControls };
