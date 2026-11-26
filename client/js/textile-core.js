/* =====================================================================
   v1.64 SEWING: rugs and clothes you paint pixel by pixel. Data and rules only (no THREE, no DOM),
   so the server can import it.
   A design is a short string: a few fields, then the pixels, run-length coded in the base64url alphabet.
     rug:      'r' shape w d edge pile edgeColor grid | pixels      item id 'cr_' + code
     garment:  'g' base sleeve hem flare alt alt alt grid | pixels  worn as look code suffix '~' + code
   Pixel coding: a char below 32 is one pixel of that palette color; a char 32..63 repeats the last color
   (value-30) more times (2..33). Nothing here may be reordered: saved codes hold indexes. Only append.
   Skill: the more pieces you've sewn, the finer the grid and the stranger the alterations you can use.
   ===================================================================== */
import { ITEMS, def } from './content.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const n2c = n => B64[n|0], c2n = c => B64.indexOf(c);

// 32 yarn colors (index = palette slot; never reorder)
export const YARN = [
  0xfbf6ea, 0xe8dcc4, 0xb8a888, 0x7a6a58, 0x4a3e36, 0x24201e, 0xa8a8b0, 0x5a5a64,
  0xe2483d, 0xb4302e, 0xf08a5a, 0xf2a240, 0xf2d060, 0xd8b048, 0x9fc86a, 0x5a9a4a,
  0x2e6a48, 0x4fb3b0, 0x8ad0e8, 0x5a8ad8, 0x2e3f6e, 0x9a76d0, 0x5a3a8a, 0xf2b8c8,
  0xe86a9a, 0xa8423a, 0xc89a6a, 0x8a5a3a, 0xd8e8b0, 0xc8e0f0, 0xf6e0a8, 0x3a2a4a ];
export const YARN_NAMES = ['Snow','Oatmeal','Stone','Bark','Earth','Ink','Pebble','Slate','Poppy','Berry','Coral','Marigold','Sunshine','Honey','Fern','Moss',
  'Pine','Lagoon','Sky','Cornflower','Navy','Lilac','Plum','Blossom','Rose','Brick','Biscuit','Chestnut','Pistachio','Mist','Butter','Night'];

// Skill levels: pieces sewn to reach each, grid size, alterations you can add at once
export const LEVELS = [
  { name:'Beginner',   at:0,  grid:8,  alts:0 },
  { name:'Apprentice', at:3,  grid:12, alts:1 },
  { name:'Tailor',     at:8,  grid:16, alts:2 },
  { name:'Artisan',    at:16, grid:24, alts:3 },
  { name:'Master',     at:30, grid:32, alts:5 } ];
export const GRIDS = [8, 12, 16, 24, 32];
export const levelOf = made => { let l=0; LEVELS.forEach((L,i)=>{ if (made>=L.at) l=i; }); return l; };

/* ---------- rugs ---------- */
export const RUG_SHAPES = [ ['Rectangle',0], ['Round',0], ['Oval',0], ['Runner',0], ['Octagon',1], ['Cloud',2], ['Star',3], ['Leaf',3], ['Shell',4] ].map(([name,lv])=>({ name, lv }));
export const RUG_EDGES = [ ['Plain',0], ['Fringe',0], ['Border',1], ['Tassels',2], ['Scalloped',3], ['Pom-poms',4] ].map(([name,lv])=>({ name, lv }));
export const RUG_PILES = [ ['Flat weave',0], ['Plush',1], ['Braided',2] ].map(([name,lv])=>({ name, lv }));
// size steps: 0.6 m + 0.1 m a step, 0..24 (0.6 m to 3.0 m)
export const rugSize = s => +(0.6 + s*0.1).toFixed(2);

/* ---------- clothes ---------- */
export const GARMENTS = [ ['Shirt',0], ['Dress',0], ['Coat',1], ['Overalls',1], ['Robe',2] ].map(([name,lv])=>({ name, lv }));
export const SLEEVES = [ ['No sleeves',0], ['Short sleeves',0], ['Long sleeves',0], ['Bell sleeves',2], ['Puffed sleeves',3] ].map(([name,lv])=>({ name, lv }));
export const HEMS = [ ['Cropped',0], ['Regular',0], ['Long',0] ].map(([name,lv])=>({ name, lv }));
export const FLARES = [ ['Straight',0], ['A-line',0], ['Full',1], ['Ballgown',3] ].map(([name,lv])=>({ name, lv }));
// Alterations, roughly in order of how strange they get. lv = skill level needed; mats = extra materials
export const ALTS = [
  ['Pockets',1], ['Round collar',1], ['Cuffs',1], ['Buttons',1],
  ['Ruffled hem',2], ['Big bow',2], ['Hood',2], ['Lace trim',2],
  ['Cape',3], ['Shoulder studs',3,{ iron:1 }], ['Coat tails',3], ['Patchwork patches',3],
  ['Leaf mantle',4,{ softwood:4 }], ['Toadstool epaulettes',4,{ clay:1 }], ['Fins down the back',4], ['Glowing trim',4,{ glimmermoss:1 }], ['Orbiting stars',4,{ starstone:1 }], ['Little wings',4,{ heartwood:1 }],
].map(([name,lv,mats])=>({ name, lv, mats:mats||{} }));

/* ---------- pixels ---------- */
export function packPixels(px){ let s='', last=-1, run=0;
  const flush=()=>{ while (run>0){ const k=Math.min(run,33); if (k>=2){ s+=n2c(30+k); run-=k; } else { s+=n2c(last); run-=1; } } };
  for (const c of px){ if (c===last && last>=0){ run++; continue; } flush(); s+=n2c(c); last=c; run=0; }
  flush(); return s; }
export function unpackPixels(str, n){ const out=[]; let last=0;
  for (const ch of str){ const v=c2n(ch); if (v<0) return null; if (v<32){ out.push(v); last=v; } else for (let k=0;k<v-30;k++) out.push(last); if (out.length>n) return null; }
  while (out.length<n) out.push(last); return out; }

export function encodeRug(d){ return 'r'+[d.shape, d.w, d.d, d.edge, d.pile, d.ec, d.gi].map(n2c).join('')+packPixels(d.px); }
export function encodeGarment(d){ const a=d.alts|0; return 'g'+[d.base, d.sleeve, d.hem, d.flare, a&63, (a>>6)&63, (a>>12)&63, d.gi].map(n2c).join('')+packPixels(d.px); }
export const MAX_CODE = 1400;
export function decodeRug(code){ if (typeof code!=='string' || code[0]!=='r' || code.length<9 || code.length>MAX_CODE) return null;
  const v=[...code.slice(1,8)].map(c2n); if (v.some(x=>x<0)) return null; const [shape,w,d,edge,pile,ec,gi]=v;
  if (!RUG_SHAPES[shape] || w>24 || d>24 || !RUG_EDGES[edge] || !RUG_PILES[pile] || ec>31 || !GRIDS[gi]) return null;
  const G=GRIDS[gi], px=unpackPixels(code.slice(8), G*G); if (!px) return null; return { kind:'rug', shape, w, d, edge, pile, ec, gi, G, px }; }
export function decodeGarment(code){ if (typeof code!=='string' || code[0]!=='g' || code.length<10 || code.length>MAX_CODE) return null;
  const v=[...code.slice(1,9)].map(c2n); if (v.some(x=>x<0)) return null; const [base,sleeve,hem,flare,a0,a1,a2,gi]=v;
  if (!GARMENTS[base] || !SLEEVES[sleeve] || !HEMS[hem] || !FLARES[flare] || !GRIDS[gi]) return null;
  const G=GRIDS[gi], px=unpackPixels(code.slice(9), G*G); if (!px) return null; return { kind:'garment', base, sleeve, hem, flare, alts:a0|(a1<<6)|(a2<<12), gi, G, px }; }
export const altList = alts => ALTS.map((a,i)=>[a,i]).filter(([,i])=>alts & (1<<i));
export const isRugId = id => typeof id==='string' && id.startsWith('cr_');

/* ---------- what a piece needs, what level it takes, what it's worth ---------- */
export const colorsUsed = px => new Set(px).size;
export function rugArea(d){ const w=rugSize(d.w), dd=rugSize(d.d), f=[1,0.785,0.785,1,0.83,0.8,0.55,0.62,0.7][d.shape]; return w*dd*f; }
export function rugMats(d){ const a=rugArea(d); const m={ weed:Math.max(4, Math.ceil(a*4*(d.pile===1?1.5:d.pile===2?1.3:1))) }; if (d.edge===3||d.edge===5) m.weed+=2; return m; }
export function garmentMats(d){ const m={ weed:8+(d.base===4||d.base===2?4:0)+(d.flare>=2?3:0) }; for (const [a] of altList(d.alts)){ m.weed+=1; for (const [k,n] of Object.entries(a.mats)) m[k]=(m[k]||0)+n; } return m; }
export function needLevel(d){
  if (d.kind==='rug') return Math.max(RUG_SHAPES[d.shape].lv, RUG_EDGES[d.edge].lv, RUG_PILES[d.pile].lv, d.gi);
  const alts=altList(d.alts); let need=Math.max(GARMENTS[d.base].lv, SLEEVES[d.sleeve].lv, FLARES[d.flare].lv, d.gi, ...alts.map(([a])=>a.lv));
  for (let l=0;l<LEVELS.length;l++) if (LEVELS[l].alts>=alts.length){ need=Math.max(need,l); break; }
  return need; }
const val = m => (ITEMS[m] && ITEMS[m].price) || 20;
export const matValue = mats => Object.entries(mats).reduce((a,[m,n])=>a+val(m)*n, 0);
// copies sell for their materials plus 15%, like custom furniture
export const rugPrice = d => Math.max(20, Math.round(matValue(rugMats(d))*1.15/5)*5);
// the first sale of a rug you made pays for the art: more colours on a finer grid is more work
export function rugBonus(d){ const k=colorsUsed(d.px); if (k<2) return 0; return Math.round((120*Math.min(k,12) + 25*d.G + 120*RUG_EDGES[d.edge].lv + 150*RUG_SHAPES[d.shape].lv)/50)*50; }

const SHAPE_NOUN = ['Rug','Round Rug','Oval Rug','Runner','Octagon Rug','Cloud Rug','Star Rug','Leaf Rug','Shell Rug'];
export function rugName(d){ const counts={}; for (const c of d.px) counts[c]=(counts[c]||0)+1; const top=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  const pile=d.pile===1?'Plush ':d.pile===2?'Braided ':''; return `${YARN_NAMES[top]} ${pile}${SHAPE_NOUN[d.shape]}`; }
export function rugItem(id){ if (!isRugId(id)) return null; const d=decodeRug(id.slice(3)); if (!d) return null;
  const r=Math.max(rugSize(d.w), rugSize(d.d))/2;
  return def(id, { name:rugName(d), kind:'furniture', buy:0, price:rugPrice(d), r:+r.toFixed(2), flat:true, shop:'custom', stack:5, custom:true,
    desc:`A hand-made rug, ${rugSize(d.w)} by ${rugSize(d.d)} m, ${colorsUsed(d.px)} colours on a ${d.G} by ${d.G} grid.`, model:{ t:'rug', code:id } }); }
if (typeof ITEMS.__resolve === 'function') ITEMS.__resolve(rugItem);

/* the Sewing Machine: you sew at one. Pemberton sells it; it isn't in any random shop stock. */
export const MACHINE = 'sewmachine', MACHINE_PRICE = 12000;
def(MACHINE, { name:'Sewing Machine', kind:'furniture', buy:MACHINE_PRICE, price:3000, r:0.55, shop:'pemberton-order', stack:1,
  desc:'A treadle sewing machine on its own little table. Place it, then use it to sew rugs and clothes.', model:{ t:'sewmachine' } });

/* ---------- starting points: a blank, or a simple pattern to paint over ---------- */
export function blankPixels(G, fill=1){ return new Array(G*G).fill(fill); }
export function starterPattern(G, kind, a, b){ const px=new Array(G*G);
  for (let y=0;y<G;y++) for (let x=0;x<G;x++){ const i=y*G+x;
    px[i] = kind==='stripes' ? ((Math.floor(y/Math.max(1,G/8))%2)?a:b)
      : kind==='check' ? (((Math.floor(x/Math.max(1,G/8))+Math.floor(y/Math.max(1,G/8)))%2)?a:b)
      : kind==='border' ? ((x<G/8||y<G/8||x>=G-G/8||y>=G-G/8)?a:b)
      : kind==='diamond' ? ((Math.abs(x-G/2+0.5)+Math.abs(y-G/2+0.5))<G/3?a:b) : b; }
  return px; }
// scale a painting to another grid size (when your skill grows, old designs can be refined)
export function resample(px, G0, G1){ const out=new Array(G1*G1); for (let y=0;y<G1;y++) for (let x=0;x<G1;x++) out[y*G1+x]=px[Math.floor(y*G0/G1)*G0+Math.floor(x*G0/G1)]; return out; }
