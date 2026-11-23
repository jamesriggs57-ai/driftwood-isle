// v1.1 look: felt and knit for the plush characters, painted textures for fish and bug wings, wood and fabric for furniture.
// Everything is generated on canvases at load time (no image files) and cached.
import * as THREE from 'three';
import { TAU, mulberry32, hashStr } from './util.js';

const cache = new Map();
const once = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };
const col = c => new THREE.Color(c);
function canvas(w, h, draw){ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const x=cv.getContext('2d'); draw(x, w, h); return cv; }
function tex(cv, srgb=true, rx=1, ry=1){ const t=new THREE.CanvasTexture(cv); if (srgb) t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); t.anisotropy=4; return t; }

/* ---------- Felt: soft fibers, a little fuzz on the edges (sheen), never shiny ---------- */
const feltFibers = () => once('felt-fibers', ()=>canvas(256,256,(x,W,H)=>{ const r=mulberry32(11); x.fillStyle='#f2f2f2'; x.fillRect(0,0,W,H);
  for (let i=0;i<5200;i++){ const a=r()*TAU, l=3+r()*9, px=r()*W, py=r()*H, v=200+Math.floor(r()*55); x.strokeStyle=`rgba(${v},${v},${v},${0.35+r()*0.4})`; x.lineWidth=0.6+r()*0.8; x.beginPath(); x.moveTo(px,py); x.quadraticCurveTo(px+Math.cos(a+1)*l*0.6, py+Math.sin(a+1)*l*0.6, px+Math.cos(a)*l, py+Math.sin(a)*l); x.stroke(); }
  for (let i=0;i<500;i++){ const v=255; x.fillStyle=`rgba(${v},${v},${v},${0.25*r()})`; x.fillRect(r()*W,r()*H,1.5,1.5); } }));
const feltMap = () => once('felt-map', ()=>tex(feltFibers(), true, 3, 2));
const feltBump = () => once('felt-bump', ()=>tex(feltFibers(), false, 3, 2));
export function felt(color, o={}){ return once('felt:'+color+':'+JSON.stringify(o), ()=>{
  const c=col(color), sh=c.clone().lerp(col(0xffffff),0.45);
  const m=new THREE.MeshPhysicalMaterial({ color:c, map:feltMap(), bumpMap:feltBump(), bumpScale:0.35, roughness:0.95, metalness:0, sheen:1, sheenRoughness:0.75, sheenColor:sh, ...o });
  m.userData.char=true; return m; }); }
// Knit (sweaters, scarves, hats): rows of little V stitches, optional stripes
export function knit(color, stripe=null, rows=10){ return once('knit:'+color+':'+stripe+':'+rows, ()=>{
  const cv=canvas(128,128,(x,W,H)=>{ const rh=H/rows; for (let j=0;j<rows;j++){ const c = stripe!==null && j%4>=2 ? stripe : color; const base=col(c);
      x.fillStyle='#'+base.getHexString(); x.fillRect(0,j*rh,W,rh);
      for (let i=0;i<16;i++){ const cx=i*8+4, y0=j*rh; const lt='#'+base.clone().offsetHSL(0,0,0.08).getHexString(), dk='#'+base.clone().offsetHSL(0,0,-0.1).getHexString();
        x.fillStyle=lt; x.beginPath(); x.ellipse(cx-2,y0+rh*0.5,2.2,rh*0.42,0.5,0,TAU); x.fill(); x.beginPath(); x.ellipse(cx+2,y0+rh*0.5,2.2,rh*0.42,-0.5,0,TAU); x.fill();
        x.strokeStyle=dk; x.lineWidth=0.7; x.beginPath(); x.moveTo(cx,y0+rh*0.1); x.lineTo(cx,y0+rh*0.95); x.stroke(); } } });
  const m=new THREE.MeshPhysicalMaterial({ map:tex(cv,true,4,2), bumpMap:tex(cv,false,4,2), bumpScale:0.6, roughness:0.95, sheen:1, sheenRoughness:0.7, sheenColor:col(color).lerp(col(0xffffff),0.4) });
  m.userData.char=true; return m; }); }
// Shiny plastic "safety eyes" and noses, like on a real plush
export const eyeMat = () => once('eye', ()=>{ const m=new THREE.MeshPhysicalMaterial({ color:0x1c1414, roughness:0.12, clearcoat:1, clearcoatRoughness:0.05 }); m.userData.char=true; return m; });
export const noseMat = c => once('nose:'+c, ()=>{ const m=new THREE.MeshPhysicalMaterial({ color:c, roughness:0.3, clearcoat:0.8 }); m.userData.char=true; return m; });
export const glintMat = () => once('glint', ()=>{ const m=new THREE.MeshBasicMaterial({ color:0xffffff }); m.userData.char=true; return m; });
export const threadMat = c => once('thread:'+c, ()=>{ const m=new THREE.MeshStandardMaterial({ color:c, roughness:1 }); m.userData.char=true; return m; });

/* ---------- Fish skins ----------
   Painted around a lathe body: u goes around the fish (0.75 = top, 0.25 = belly), v runs head (0) to tail (1). */
const smooth01 = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
const FISH_LOOK = {
  minnow:{ pat:'line', iri:0.8 }, silverbream:{ pat:'scales', iri:1 }, sardine:{ pat:'dots', n:7, dot:0x2a3a5a, iri:0.9 }, coraldart:{ pat:'bands', bands:[0.22,0.48,0.75], band:0xffffff, edge:0x1a1a1a },
  mackerel:{ pat:'tiger', mark:0x1a2a3a, iri:0.6 }, flounder:{ pat:'speck', mark:0x7a6a4a, n:140 }, snapper:{ pat:'scales', glow:0xffd2a8 }, puffer:{ pat:'spots', mark:0x5a4a20, n:30 },
  eel:{ pat:'mottle', mark:0x3a4a2a }, cod:{ pat:'speck', mark:0x6a7a80, n:120, line:true }, squid:{ pat:'chroma', mark:0xd06a8a, clear:true }, octopus:{ pat:'spots', mark:0xf8c0a8, n:40 },
  lanternfish:{ pat:'photo', mark:0xffe08a, glow:true }, seahorse:{ pat:'rings', mark:0xd08020 }, barrel:{ pat:'mottle', mark:0x4a3a2a }, ray:{ pat:'spots', mark:0xe8e0f0, n:50 },
  sunfish:{ pat:'mottle', mark:0xb8c4d0, iri:0.4 }, shark:{ pat:'counter' }, dace:{ pat:'line', iri:0.8 }, loach:{ pat:'blotch', mark:0x4a3a2a }, carp:{ pat:'scales', big:true },
  smelt:{ pat:'line', clear:true, iri:0.6 }, trout:{ pat:'trout', mark:0x2a3a2a, red:0xd8504a }, darter:{ pat:'rainbow' }, catfish:{ pat:'mottle', mark:0x3a3a2a },
  salmon:{ pat:'salmon' }, pike:{ pat:'bean', mark:0xe8e8a0 }, char:{ pat:'speck', mark:0xfff6d0, n:60, iri:0.5 }, tadpole:{ pat:'speck', mark:0x6a6a4a, n:40 },
  bluegill:{ pat:'bars', mark:0x3a5a7a, gill:0x1a2a6a }, crayfish:{ pat:'segments', mark:0x8a2a1a }, killifish:{ pat:'line', iri:0.5, fin:0x4a8ad8 }, goldfish:{ pat:'gold', flowy:true },
  turtle:{ pat:'hex', mark:0x3a4a2a }, mooncarp:{ pat:'scales', iri:1, pearl:true }, koi:{ pat:'koi' },
};
export const fishLook = id => FISH_LOOK[id] || { pat:'scales' };
export function fishSkin(id, d){ return once('fish:'+id, ()=>{
  const L=fishLook(id), W=512, H=256, back=col(d.c), belly=col(d.c2), r=mulberry32(hashStr(id)), mark=col(L.mark||0x333333);
  const blobs=[]; for (let i=0;i<(L.n||12);i++) blobs.push([r(), 0.45+r()*0.5, 0.012+r()*0.03]);
  const koi=[]; for (let i=0;i<7;i++) koi.push([0.1+r()*0.75, r()*0.18, 0.1+r()*0.1, i>4]);
  const emit = L.glow===true;
  const cvs=[canvas(W,H,()=>{}), emit?canvas(W,H,()=>{}):null];
  const ctx=cvs[0].getContext('2d'), img=ctx.createImageData(W,H), eimg=emit?cvs[1].getContext('2d').createImageData(W,H):null, c=new THREE.Color();
  for (let py=0; py<H; py++) for (let px=0; px<W; px++){ const u=px/W, v=py/H, up=-Math.sin(TAU*u);   // up: 1 top, -1 belly
    c.copy(belly).lerp(back, smooth01(-0.35,0.45,up));
    const P=L.pat;
    if (P==='line' && Math.abs(up-0.05)<0.05) c.lerp(col(0xd8e0e8),0.6);
    if ((P==='scales'||P==='gold') ){ const s=L.big?14:24, gx=v*s, gy=(up+1)*s*0.35, fx=gx-Math.floor(gx), fy=gy-Math.floor(gy)+((Math.floor(gx)%2)*0.5); const e=Math.abs(Math.hypot(fx-0.5,(fy%1)-0.1)-0.5); if (e<0.08) c.offsetHSL(0,0,-0.07); else c.offsetHSL(0,0,0.02*(1-fx)); }
    if (P==='dots'){ if (Math.abs(up-0.15)<0.06 && (v*(L.n||7))%1<0.35 && v>0.15 && v<0.8) c.copy(mark); }
    if (P==='bands'){ for (const b of L.bands){ const dd=Math.abs(v-b); if (dd<0.05) c.copy(col(L.band)); else if (dd<0.065) c.copy(col(L.edge)); } }
    if (P==='tiger' && up>0.1 && Math.sin(v*60 + Math.sin(up*6)*2.2)>0.55) c.lerp(mark,0.85);
    if (P==='bars' && Math.sin(v*38)>0.4 && v>0.15 && v<0.8) c.lerp(mark,0.45);
    if (P==='bars' && v<0.18 && Math.abs(up)<0.4 && v>0.12) c.copy(col(L.gill));
    if (P==='speck'||P==='spots'||P==='dots'||P==='bean'||P==='trout'){ for (const [bu,bv,br] of blobs){ if (Math.abs(v-bv*0.9)>0.08) continue; const du=Math.min(Math.abs(u-bu),1-Math.abs(u-bu)), dv=Math.abs(v-bv*0.9); const rr=P==='spots'?br*1.6:P==='bean'?br*1.3:br; if (Math.hypot(du*(P==='bean'?1.6:1), dv)<rr && up>-0.6) c.lerp(mark,0.9); } }
    if (P==='trout' && Math.abs(up-0.0)<0.08) c.lerp(col(L.red),0.55);
    if (P==='trout'){ for (const [bu,bv,br] of blobs.slice(0,6)){ const du=Math.min(Math.abs(u-((bu+0.5)%1)),1-Math.abs(u-((bu+0.5)%1))); if (Math.hypot(du,v-bv*0.9)<br) c.copy(col(L.red)); } }
    if (P==='mottle'||P==='blotch'){ const n=Math.sin(u*31+Math.sin(v*17)*3)*Math.sin(v*23+u*9); if (n>(P==='blotch'?0.45:0.25) && up>-0.5) c.lerp(mark,0.6); }
    if (P==='rainbow'){ const k=Math.sin(v*42)*0.5+0.5; c.copy(col(0x4a8ad8)).lerp(col(0xf08a4a), k); c.lerp(belly, smooth01(0.2,-0.6,up)); }
    if (P==='salmon'){ c.copy(col(0x5a7a5a)).lerp(col(0xc84a3a), smooth01(0.15,0.4,v)); c.lerp(col(0xf8c8b0), smooth01(0.1,-0.7,up)); }
    if (P==='counter'){ c.copy(back).lerp(col(0xf4f6f8), smooth01(0.0,-0.3,up)); }
    if (P==='koi'){ c.copy(col(0xfdfaf2)); for (const [kv,ku,kr,kb] of koi){ const dt=Math.min(Math.abs(u-0.75),1-Math.abs(u-0.75)); if (Math.hypot(Math.max(0,dt-ku)*1.1,(v-kv))<kr*(kb?0.5:1) && up>-0.45) c.copy(col(kb?0x1a1a1e:0xe8502a)); } }
    if (P==='rings' && Math.sin(v*70)>0.6) c.lerp(mark,0.5);
    if (P==='segments' && Math.sin(v*40)>0.7) c.lerp(mark,0.6);
    if (P==='hex'){ const hx=v*9, hy=(up+1)*3+(Math.floor(hx)%2)*0.5; const fx=hx%1, fy=hy%1; if (fx<0.08||fy<0.08) c.lerp(mark,0.7); else c.offsetHSL(0,0,(0.5-Math.hypot(fx-0.5,fy-0.5))*0.12); }
    if (P==='chroma'){ for (const [bu,bv,br] of blobs){ const du=Math.min(Math.abs(u-bu),1-Math.abs(u-bu)); if (Math.hypot(du,v-bv*0.9)<br*0.8) c.lerp(mark,0.7); } }
    if (P==='gold'){ c.lerp(col(0xffe8a0), smooth01(-0.3,-0.9,up)*0.6); }
    if (L.pearl) c.lerp(col(0xf0f4ff), 0.2*Math.sin(v*20+u*13)+0.2);
    if (v<0.1) c.offsetHSL(0,0,-0.04);   // head a touch darker
    // gill cover: a curved seam with a light rim, and the mouth line at the snout
    { const gv=0.2+0.05*up*up; const dg=v-gv; if (Math.abs(up)<0.78 && dg>-0.012 && dg<0) c.offsetHSL(0,0.04,-0.13); else if (Math.abs(up)<0.78 && dg>=0 && dg<0.008) c.offsetHSL(0,0,0.05); else if (Math.abs(up)<0.7 && v<gv && v>0.08) c.offsetHSL(0,0,0.02*(1-Math.abs(up))); }
    if (v<0.045 && up>-0.42 && up<-0.08 && Math.abs(up+0.25-v*1.5)<0.035) c.offsetHSL(0,0.05,-0.18);
    // fine scale shimmer on every scaled fish, lateral line dots
    if (!['eel','loach','catfish','squid','octopus','shark','tadpole','turtle','seahorse','ray'].includes(id) && v>0.2 && v<0.92){ const gx=v*70, gy=(up+1)*12+(Math.floor(gx)%2)*0.5, fx=gx-Math.floor(gx), fy=gy-Math.floor(gy); const e=Math.hypot(fx-0.15,(fy-0.5)*0.8); if (e>0.45&&e<0.52) c.offsetHSL(0,0,-0.035); else if (e<0.3) c.offsetHSL(0,0,0.012); }
    if (v>0.22 && v<0.92 && Math.abs(up-0.12+v*0.06)<0.012 && (v*90)%1<0.55) c.offsetHSL(0,0,-0.08);
    const i=(py*W+px)*4; img.data[i]=c.r*255; img.data[i+1]=c.g*255; img.data[i+2]=c.b*255; img.data[i+3]=255;
    if (eimg){ let e=0; if (P==='photo'){ for (const [bu,bv] of blobs){ if (Math.hypot(Math.min(Math.abs(u-((bu*0.5)+0.12)),1),v-bv*0.9)<0.018 && up<0.2) e=1; } if (Math.abs(up+0.35)<0.04 && (v*14)%1<0.4) e=1; }
      eimg.data[i]=eimg.data[i+1]=eimg.data[i+2]=e*255; eimg.data[i+3]=255; if (e) { img.data[i]=255; img.data[i+1]=230; img.data[i+2]=140; } } }
  ctx.putImageData(img,0,0); if (eimg) cvs[1].getContext('2d').putImageData(eimg,0,0);
  const m=new THREE.MeshPhysicalMaterial({ map:tex(cvs[0]), roughness:0.32, clearcoat:0.7, clearcoatRoughness:0.2, transparent:!!L.clear, opacity:L.clear?0.78:1,
    iridescence:L.iri||0, iridescenceIOR:1.6, iridescenceThicknessRange:[200,700] });
  if (emit){ m.emissiveMap=tex(cvs[1]); m.emissive=col(0xffe08a); m.emissiveIntensity=1.4; }
  return m; }); }
// Fins: a soft gradient that fades to see-through at the edges
export function finMat(color, edge=null){ return once('fin:'+color+':'+edge, ()=>{
  const cv=canvas(64,64,(x,W,H)=>{ const g=x.createLinearGradient(0,0,W,0); const c=col(color), e=col(edge??color).lerp(col(0xffffff),0.3);
    g.addColorStop(0,`rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},0.95)`); g.addColorStop(1,`rgba(${e.r*255|0},${e.g*255|0},${e.b*255|0},0.35)`); x.fillStyle=g; x.fillRect(0,0,W,H);
    x.strokeStyle='rgba(255,255,255,0.35)'; x.lineWidth=1; for (let i=0;i<9;i++){ x.beginPath(); x.moveTo(0,H/2); x.lineTo(W,i*H/8); x.stroke(); } });
  return new THREE.MeshPhysicalMaterial({ map:tex(cv), transparent:true, side:THREE.DoubleSide, roughness:0.3, depthWrite:false, iridescence:0.4 }); }); }

/* ---------- Wings ----------
   Each butterfly and moth gets its own painted wing: base color, dark borders, veins, and its own marks
   (eyespots, bands, swallowtails, frost speckles, stars). Painted on a 256 canvas, mapped onto the wing shape. */
const WING_LOOK = {
  sunwing:{ border:0.16, spots:'white', vein:true }, ember:{ border:0.2, band:0xffd060, vein:true }, bluebell:{ grad:0xb8d8ff, border:0.14, vein:true },
  peacock:{ eye:[0x4a6ad8,0xf0e0a0,0x1a1a2a], border:0.1, vein:true }, swallowtail:{ band:0x9af0c0, border:0.22, tails:true, vein:true }, wanderer:{ border:0.12, vein:'heavy', spots:'white' },
  leafdancer:{ leaf:true }, rainwing:{ grad:0xe0f8ff, border:0.18, drops:true, vein:true }, moth:{ fuzz:true, line:true }, snowmoth:{ fuzz:true, frost:true }, frostmoth:{ fuzz:true, frost:true, line:true },
  starmoth:{ stars:true, fuzz:true }, lunamoth:{ eye:[0xf0d070,0x8a6a3a,0xf8f0c0], tails:'long', fuzz:true }, owlmoth:{ eye:[0x2a1a10,0xf0e0b0,0x1a1008], big:true, fuzz:true, line:true },
};
export function wingTex(id, d){ return once('wing:'+id, ()=>{
  const L=WING_LOOK[id]||{}, r=mulberry32(hashStr(id)), c=col(d.c), c2=col(d.c2), hex=k=>'#'+col(k).getHexString();
  const cv=canvas(512,512,(x,W,H)=>{ x.scale(2,2); W=256; H=256;
    const g=x.createRadialGradient(0,H*0.5,10,0,H*0.5,W*1.05); g.addColorStop(0, L.grad?hex(L.grad):hex(c.clone().offsetHSL(0,0,-0.08))); g.addColorStop(0.7, hex(c)); g.addColorStop(1, hex(c.clone().offsetHSL(0,0.05,0.08))); x.fillStyle=g; x.fillRect(0,0,W,H);
    if (L.leaf){ x.strokeStyle=hex(c2); x.lineWidth=4; x.beginPath(); x.moveTo(0,H*0.5); x.lineTo(W,H*0.45); x.stroke(); for (let i=1;i<6;i++){ x.lineWidth=2; x.beginPath(); x.moveTo(i*W/6,H*0.49); x.lineTo(i*W/6+30,H*0.15); x.moveTo(i*W/6,H*0.49); x.lineTo(i*W/6+30,H*0.85); x.stroke(); } }
    if (L.band){ x.fillStyle=hex(L.band); x.globalAlpha=0.85; x.beginPath(); x.ellipse(W*0.55,H*0.5,W*0.12,H*0.42,0.2,0,TAU); x.fill(); x.globalAlpha=1; }
    if (L.vein){ x.strokeStyle=hex(c2); x.globalAlpha=L.vein==='heavy'?0.9:0.55; x.lineWidth=L.vein==='heavy'?4:2; for (let i=0;i<7;i++){ x.beginPath(); x.moveTo(0,H*0.5); x.quadraticCurveTo(W*0.5,H*(0.5+(i-3)*0.06),W,H*(0.08+i*0.14)); x.stroke(); } x.globalAlpha=1; }
    if (L.border){ const b=L.border*W; x.fillStyle=hex(c2); x.fillRect(W-b,0,b,H); x.beginPath(); x.ellipse(W*0.6,0,W*0.6,b*0.9,0,0,TAU); x.fill(); x.beginPath(); x.ellipse(W*0.6,H,W*0.6,b*0.9,0,0,TAU); x.fill();
      if (L.spots==='white'){ x.fillStyle='#fff8ec'; for (let i=0;i<7;i++){ x.beginPath(); x.arc(W-b*0.5,H*(0.1+i*0.13),b*0.18,0,TAU); x.fill(); } } }
    if (L.eye){ const [o,m,i]=L.eye.map(hex), ex=W*0.62, ey=H*0.4, s=L.big?60:38; x.fillStyle=o; x.beginPath(); x.arc(ex,ey,s,0,TAU); x.fill(); x.fillStyle=m; x.beginPath(); x.arc(ex,ey,s*0.62,0,TAU); x.fill(); x.fillStyle=i; x.beginPath(); x.arc(ex,ey,s*0.34,0,TAU); x.fill(); x.fillStyle='#ffffff'; x.beginPath(); x.arc(ex-s*0.12,ey-s*0.12,s*0.1,0,TAU); x.fill(); }
    if (L.fuzz){ for (let i=0;i<1800;i++){ x.fillStyle=`rgba(255,255,255,${r()*0.12})`; x.fillRect(r()*W,r()*H,2,2); x.fillStyle=`rgba(0,0,0,${r()*0.06})`; x.fillRect(r()*W,r()*H,2,2); } }
    if (L.line){ x.strokeStyle=hex(c2); x.lineWidth=5; x.beginPath(); x.moveTo(W*0.35,0); x.bezierCurveTo(W*0.5,H*0.3,W*0.3,H*0.7,W*0.45,H); x.stroke(); x.beginPath(); x.moveTo(W*0.7,0); x.bezierCurveTo(W*0.8,H*0.4,W*0.65,H*0.6,W*0.78,H); x.stroke(); }
    if (L.frost){ for (let i=0;i<60;i++){ x.fillStyle=hex(c2); x.globalAlpha=0.6; const px=r()*W, py=r()*H, s=2+r()*4; x.fillRect(px-s,py-0.5,s*2,1); x.fillRect(px-0.5,py-s,1,s*2); } x.globalAlpha=1; }
    if (L.stars){ x.fillStyle='#fff3c0'; for (let i=0;i<40;i++){ x.globalAlpha=0.5+r()*0.5; x.beginPath(); x.arc(r()*W,r()*H,1+r()*2.5,0,TAU); x.fill(); } x.globalAlpha=1; }
    if (L.drops){ for (let i=0;i<14;i++){ const px=r()*W, py=r()*H, s=6+r()*8; const gg=x.createRadialGradient(px-s*0.3,py-s*0.3,1,px,py,s); gg.addColorStop(0,'rgba(255,255,255,.9)'); gg.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=gg; x.beginPath(); x.arc(px,py,s,0,TAU); x.fill(); } }
    if (!L.leaf && !L.fuzz){ const sh=x.createLinearGradient(0,0,W,H); sh.addColorStop(0,'rgba(255,255,255,0.18)'); sh.addColorStop(0.5,'rgba(255,255,255,0)'); sh.addColorStop(1,'rgba(255,255,255,0.12)'); x.fillStyle=sh; x.fillRect(0,0,W,H); }
  });
  const t=tex(cv); t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping; return t; }); }
export const wingLook = id => WING_LOOK[id]||{};
// Clear veined wings (dragonflies, bees, cicadas): mostly see-through, with a rainbow sheen
export function clearWingMat(tint=0xd8f0ff, spot=null){ return once('cw:'+tint+':'+spot, ()=>{
  const cv=canvas(128,128,(x,W,H)=>{ const c=col(tint); x.fillStyle=`rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},0.28)`; x.fillRect(0,0,W,H); x.strokeStyle='rgba(60,70,80,0.55)'; x.lineWidth=1;
    for (let i=0;i<14;i++){ x.beginPath(); x.moveTo(0,i*H/13); x.lineTo(W,i*H/13+Math.sin(i)*4); x.stroke(); } for (let i=0;i<22;i++){ x.beginPath(); x.moveTo(i*W/21,0); x.lineTo(i*W/21+3,H); x.stroke(); }
    if (spot!==null){ const s=col(spot); x.fillStyle=`rgba(${s.r*255|0},${s.g*255|0},${s.b*255|0},0.7)`; x.fillRect(W*0.78,H*0.35,W*0.1,H*0.3); } });
  return new THREE.MeshPhysicalMaterial({ map:tex(cv), transparent:true, side:THREE.DoubleSide, roughness:0.15, depthWrite:false, iridescence:1, iridescenceIOR:1.5, iridescenceThicknessRange:[250,650] }); }); }
// Shells and carapaces: glossy, some shimmer like a real beetle
export function shellMat(color, o={}){ return once('shell:'+color+':'+JSON.stringify(o), ()=>new THREE.MeshPhysicalMaterial({ color, roughness:0.25, clearcoat:1, clearcoatRoughness:0.08, ...o })); }
export const fuzzMat = color => once('fuzz:'+color, ()=>new THREE.MeshPhysicalMaterial({ color, map:feltMap(), roughness:1, sheen:1, sheenRoughness:0.5, sheenColor:col(color).lerp(col(0xffffff),0.5) }));

/* ---------- Furniture surfaces ---------- */
export function woodMat(color, o={}){ return once('wood:'+color+':'+JSON.stringify(o), ()=>{
  const cv=canvas(128,256,(x,W,H)=>{ const r=mulberry32(color%997), c=col(color); x.fillStyle='#'+c.getHexString(); x.fillRect(0,0,W,H);
    for (let i=0;i<46;i++){ const xx=r()*W, w=1+r()*3, sh=(r()-0.5)*0.12; x.strokeStyle='#'+c.clone().offsetHSL(0,0,sh).getHexString(); x.lineWidth=w; x.beginPath(); x.moveTo(xx,0); for (let y=0;y<=H;y+=16) x.lineTo(xx+Math.sin(y*0.03+i)*4,y); x.stroke(); }
    for (let k=0;k<2;k++){ const kx=r()*W, ky=r()*H; for (let rr=10;rr>1;rr-=2){ x.strokeStyle='#'+c.clone().offsetHSL(0,0,-0.12+rr*0.008).getHexString(); x.lineWidth=1; x.beginPath(); x.ellipse(kx,ky,rr*0.6,rr*1.6,0,0,TAU); x.stroke(); } } });
  return new THREE.MeshStandardMaterial({ map:tex(cv,true,1,1), roughness:0.7, ...o }); }); }
export function fabricMat(color, pattern='plain', color2=0xffffff){ return once('fab:'+color+':'+pattern+':'+color2, ()=>{
  const cv=canvas(128,128,(x,W,H)=>{ const c=col(color), c2=col(color2), h=k=>'#'+k.getHexString(); x.fillStyle=h(c); x.fillRect(0,0,W,H);
    if (pattern==='check'){ x.fillStyle=h(c2); x.globalAlpha=0.45; for (let i=0;i<8;i++){ x.fillRect(i*16,0,8,H); x.fillRect(0,i*16,W,8); } x.globalAlpha=1; }
    if (pattern==='quilt'){ const r=mulberry32(5); const pal=[c,c2,c.clone().offsetHSL(0.08,0,0.1),c2.clone().offsetHSL(-0.06,0,-0.05)]; for (let i=0;i<4;i++) for (let j=0;j<4;j++){ x.fillStyle=h(pal[Math.floor(r()*4)]); x.fillRect(i*32,j*32,32,32); x.strokeStyle='rgba(255,255,255,.6)'; x.setLineDash([3,3]); x.strokeRect(i*32+3,j*32+3,26,26); x.setLineDash([]); } }
    if (pattern==='flower'){ x.fillStyle=h(c2); for (let i=0;i<10;i++){ const px=(i*37)%W, py=(i*53)%H; for (let k=0;k<5;k++){ x.beginPath(); x.arc(px+Math.cos(k*1.26)*5,py+Math.sin(k*1.26)*5,3.5,0,TAU); x.fill(); } } }
    if (pattern==='rings'){ for (let rr=64;rr>4;rr-=10){ x.strokeStyle=rr%20<10?h(c2):h(c.clone().offsetHSL(0,0,-0.08)); x.lineWidth=5; x.beginPath(); x.arc(64,64,rr,0,TAU); x.stroke(); } }
    for (let i=0;i<1600;i++){ x.fillStyle=`rgba(${Math.random()<0.5?0:255},${Math.random()<0.5?0:255},255,0.03)`; x.fillRect(Math.random()*W,Math.random()*H,1,2); } });
  return new THREE.MeshPhysicalMaterial({ map:tex(cv), roughness:0.9, sheen:0.6, sheenRoughness:0.8, sheenColor:col(color).lerp(col(0xffffff),0.4) }); }); }
export const glassMat = (tint=0xd8f0ff, op=0.3) => once('glass:'+tint+op, ()=>new THREE.MeshPhysicalMaterial({ color:tint, transparent:true, opacity:op, roughness:0.05, clearcoat:1, depthWrite:false }));
export const brass = () => once('brass', ()=>new THREE.MeshPhysicalMaterial({ color:0xd8a040, metalness:0.9, roughness:0.28, clearcoat:0.5 }));
export const ceramic = c => once('cer:'+c, ()=>new THREE.MeshPhysicalMaterial({ color:c, roughness:0.25, clearcoat:0.9, clearcoatRoughness:0.1 }));
export const waterMat2 = (c=0x5ac8e0) => once('wtr:'+c, ()=>new THREE.MeshPhysicalMaterial({ color:c, transparent:true, opacity:0.6, roughness:0.05, transmission:0, clearcoat:1, depthWrite:false }));
