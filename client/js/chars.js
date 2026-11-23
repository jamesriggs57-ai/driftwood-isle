// Characters v2: smooth, toy-like cartoon critters (Animal Crossing-like proportions, stuffed-animal shapes, no fabric textures).
// One builder for the player, residents, shopkeepers and friends. Same rig as before:
// g.userData = { body, head, arms, legs, ears, tail, hand } — ears/tail groups carry userData.base for the jelly animation.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const V3 = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/* ================= catalogue ================= */
// fur = main body, muzzle = face/belly light, accent = species marks (mask, stripes, spikes, mane, inner ears), nose = nose color
export const SPECIES = {
  hedgehog:{ name:'Hedgehog', schemes:[
    { name:'Chestnut', fur:0xf0d2a8, muzzle:0xfff2e0, accent:0x8a5a36, nose:0x2a1e1a },
    { name:'Smoky', fur:0xe6dcd2, muzzle:0xfaf6f0, accent:0x6a625c, nose:0x2a2424 },
    { name:'Ginger', fur:0xf6d6b0, muzzle:0xfff4e4, accent:0xc8743a, nose:0x3a2418 },
    { name:'Snowy', fur:0xfaf2e8, muzzle:0xffffff, accent:0xd8cfc4, nose:0xe8889a },
    { name:'Mossy', fur:0xe8e2bc, muzzle:0xfaf8e4, accent:0x6a7a44, nose:0x2a2a1a } ] },
  rabbit:{ name:'Rabbit', schemes:[
    { name:'Cotton', fur:0xf8f4ee, muzzle:0xffffff, accent:0xf4b0c0, nose:0xe8889a },
    { name:'Caramel', fur:0xdcaa78, muzzle:0xf8e8d0, accent:0xf0b8b0, nose:0xd87888 },
    { name:'Smoke', fur:0xa4a4b2, muzzle:0xeeeef4, accent:0xf0b8c8, nose:0xd88898 },
    { name:'Cocoa', fur:0x86644e, muzzle:0xead6c2, accent:0xe8a8a0, nose:0x3a2420 },
    { name:'Lilac', fur:0xccb8e2, muzzle:0xf6f0ff, accent:0xf0b8d8, nose:0xd880a8 } ] },
  raccoon:{ name:'Raccoon', schemes:[
    { name:'Classic', fur:0xa2a2a8, muzzle:0xf4f2ee, accent:0x3c3c44, nose:0x222226 },
    { name:'Brown', fur:0xa88e78, muzzle:0xf4ece0, accent:0x4a3a30, nose:0x2a201c },
    { name:'Slate', fur:0x8a9ab4, muzzle:0xeef2f8, accent:0x34405a, nose:0x1e2430 },
    { name:'Rust', fur:0xc4845e, muzzle:0xf8ecdc, accent:0x5a3424, nose:0x2a1810 },
    { name:'Cream', fur:0xdcd0b8, muzzle:0xfffaf0, accent:0x6a5e50, nose:0x3a3028 } ] },
  squirrel:{ name:'Squirrel', schemes:[
    { name:'Red', fur:0xd8783e, muzzle:0xfbe8d0, accent:0xa84a24, nose:0x3a2018 },
    { name:'Gray', fur:0xa09e9e, muzzle:0xf4f0ea, accent:0x6a6666, nose:0x2a2626 },
    { name:'Black', fur:0x524a4e, muzzle:0xdccec2, accent:0x2a2428, nose:0x1a1416 },
    { name:'Golden', fur:0xe8b254, muzzle:0xfff4dc, accent:0xc08030, nose:0x3a2818 },
    { name:'Cinnamon', fur:0xb46e44, muzzle:0xf0dcc4, accent:0x7a4022, nose:0x2a1810 } ] },
  chipmunk:{ name:'Chipmunk', schemes:[
    { name:'Classic', fur:0xd4945c, muzzle:0xfaf0e0, accent:0x5a3a24, nose:0x2a1c14 },
    { name:'Sandy', fur:0xe2bc8c, muzzle:0xfff6e6, accent:0x8a6040, nose:0x3a2818 },
    { name:'Chocolate', fur:0x8e5e3e, muzzle:0xf4e2cc, accent:0x3a2418, nose:0x1e140e },
    { name:'Ash', fur:0xb4a494, muzzle:0xf6f0e8, accent:0x5a5048, nose:0x2a2420 } ] },
  dog:{ name:'Dog', schemes:[
    { name:'Golden', fur:0xe8b872, muzzle:0xfff0d8, accent:0xc88a48, nose:0x2a1e1a },
    { name:'Spotty', fur:0xf8f6f2, muzzle:0xffffff, accent:0x3a3a3a, nose:0x1e1e1e },
    { name:'Chocolate', fur:0x8e5e42, muzzle:0xdcb494, accent:0x5a3624, nose:0x2a1810 },
    { name:'Husky', fur:0x9ca6b2, muzzle:0xffffff, accent:0x5a6470, nose:0x1e2228 },
    { name:'Shiba', fur:0xe28c4e, muzzle:0xfff4e6, accent:0xc8683a, nose:0x2a1810 } ] },
  cat:{ name:'Cat', schemes:[
    { name:'Orange tabby', fur:0xf2a454, muzzle:0xfff4e4, accent:0xd07a30, nose:0xe88a9a },
    { name:'Tuxedo', fur:0x403e46, muzzle:0xffffff, accent:0xf0a8b8, nose:0xe8889a },
    { name:'Gray', fur:0xaaaebc, muzzle:0xeef0f4, accent:0x7a8090, nose:0xd88898 },
    { name:'Cream', fur:0xf4e4c8, muzzle:0xfffaf0, accent:0xe0c090, nose:0xe8a0a8 },
    { name:'Lavender', fur:0xc4acda, muzzle:0xf6f0ff, accent:0xa088c0, nose:0xe090b0 } ] },
  gopher:{ name:'Gopher', schemes:[
    { name:'Sand', fur:0xcc9e6c, muzzle:0xf4e0c4, accent:0x8a6440, nose:0x3a2418 },
    { name:'Clay', fur:0xb47c5e, muzzle:0xf0d8c4, accent:0x7a4a34, nose:0x2a1810 },
    { name:'Dusk', fur:0x8e7e74, muzzle:0xe8ded4, accent:0x5a4e46, nose:0x2a2220 },
    { name:'Honey', fur:0xe2b264, muzzle:0xfff0d0, accent:0xb08040, nose:0x3a2818 } ] },
  lizard:{ name:'Lizard', schemes:[
    { name:'Leaf', fur:0x70c25e, muzzle:0xe2f2a4, accent:0x3a8a40, nose:0x2a4a24 },
    { name:'Sky', fur:0x5eb2e0, muzzle:0xdaf2ff, accent:0x2a70b0, nose:0x1e3a5a },
    { name:'Sunset', fur:0xf28e4e, muzzle:0xffe2b4, accent:0xc04a30, nose:0x6a2a18 },
    { name:'Desert', fur:0xdabb7c, muzzle:0xfff0d2, accent:0x9a7444, nose:0x4a3420 },
    { name:'Violet', fur:0x9e7eda, muzzle:0xeadeff, accent:0x5a4aa0, nose:0x2e2450 } ] },
  bear:{ name:'Bear', schemes:[
    { name:'Brown', fur:0xa4744e, muzzle:0xeacaa4, accent:0x6a4430, nose:0x2a1a14 },
    { name:'Honey', fur:0xe2aa64, muzzle:0xfff0d0, accent:0xb07a40, nose:0x3a2414 },
    { name:'Polar', fur:0xf4f0e8, muzzle:0xffffff, accent:0xd8d0c4, nose:0x2a2626 },
    { name:'Black', fur:0x4e444c, muzzle:0xdcc8ac, accent:0x2a2228, nose:0x1a1416 },
    { name:'Rosy', fur:0xf0b4bc, muzzle:0xfff2f2, accent:0xd88090, nose:0x8a4050 } ] },
  lion:{ name:'Lion', schemes:[
    { name:'Classic', fur:0xe8ba64, muzzle:0xfff0d2, accent:0xb06a30, nose:0x6a3a28 },
    { name:'White', fur:0xf4ecdc, muzzle:0xffffff, accent:0xd8c8a8, nose:0xd88a8a },
    { name:'Dark mane', fur:0xdcac5c, muzzle:0xfaeed4, accent:0x5a3424, nose:0x3a2018 },
    { name:'Rose', fur:0xf2bc94, muzzle:0xfff0e4, accent:0xd8707a, nose:0xa84858 },
    { name:'Sunny', fur:0xf2ca74, muzzle:0xfff6dc, accent:0xe08a30, nose:0x7a4024 } ] },
};
export const SPECIES_IDS = Object.keys(SPECIES);
export const OUTFITS = [ { id:'tee', name:'T-shirt' }, { id:'hoodie', name:'Hoodie' }, { id:'overalls', name:'Overalls' }, { id:'dress', name:'Dress' }, { id:'sweater', name:'Striped sweater' } ];
export const OUTFIT_COLORS = [0xe0574a, 0xf2a240, 0xf2d060, 0x6cbf6a, 0x4fb3b0, 0x5a8ad8, 0x9a76d0, 0xf08aac, 0xf4f0e6, 0x4a4a54];
export const EYES = [ { id:'bright', name:'Bright' }, { id:'sparkle', name:'Sparkly' }, { id:'dot', name:'Dot' }, { id:'angry', name:'Angry' }, { id:'sad', name:'Sad' } ];
export const NOSES = [ { id:'button', name:'Button' }, { id:'heart', name:'Heart' }, { id:'bean', name:'Bean' }, { id:'triangle', name:'Triangle' }, { id:'tiny', name:'Tiny' } ];
export const FINISHES = [ { id:'smooth', name:'Smooth' }, { id:'felt', name:'Felt' } ];
export const MOUTHS = [ { id:'smile', name:'Smile' }, { id:'grin', name:'Big grin' }, { id:'cat', name:'Little w' }, { id:'angry', name:'Grumpy' }, { id:'sad', name:'Sad' } ];

/* ================= look codes (saved and sent to friends) ================= */
// "species.scheme.outfit.color.eyes.nose.mouth.finish" using indexes, e.g. "rabbit.0.0.5.0.0.0.1" (older 7-part codes read as smooth)
export function defaultLook(){ return { sp:'rabbit', c:0, top:0, tc:5, e:0, n:0, m:0, f:0 }; }
export function lookCode(L){ return [L.sp, L.c, L.top, L.tc, L.e, L.n, L.m, L.f||0].join('.'); }
export function parseLook(code){ const d=defaultLook(); if (typeof code!=='string') return d; const p=code.split('.'); if ((p.length!==7 && p.length!==8) || !SPECIES[p[0]]) return d;
  const n=(i,max)=>{ const v=parseInt(p[i],10); return Number.isFinite(v) && v>=0 && v<max ? v : 0; };
  return { sp:p[0], c:n(1,SPECIES[p[0]].schemes.length), top:n(2,OUTFITS.length), tc:n(3,OUTFIT_COLORS.length), e:n(4,EYES.length), n:n(5,NOSES.length), m:n(6,MOUTHS.length), f:p.length===8?n(7,FINISHES.length):0 }; }
// A random look. moodBias: 0..1 chance of allowing the angry/sad faces (they are rarer for townsfolk).
export function randomLook(r=Math.random, moodBias=0.18){ const sp=SPECIES_IDS[Math.floor(r()*SPECIES_IDS.length)], face=()=>r()<moodBias ? 3+Math.floor(r()*2) : Math.floor(r()*3);
  return { sp, c:Math.floor(r()*SPECIES[sp].schemes.length), top:Math.floor(r()*OUTFITS.length), tc:Math.floor(r()*OUTFIT_COLORS.length), e:face(), n:Math.floor(r()*NOSES.length), m:face(), f:r()<0.35?1:0 }; }

/* ================= materials (smooth, soft vinyl; flagged as character so weather never paints them) ================= */
const MATS=new Map();
function mat(color, o={}){ const k=color+':'+JSON.stringify(o); if (!MATS.has(k)){ const m=new THREE.MeshStandardMaterial(Object.assign({ color, roughness:0.62, metalness:0 }, o)); m.userData.char=true; MATS.set(k,m); } return MATS.get(k); }
const gloss = c => mat(c, { roughness:0.25 });
function mesh(geo, m, x=0,y=0,z=0, parent, shadow=true){ const o=new THREE.Mesh(geo, m); o.position.set(x,y,z); o.castShadow=shadow; o.receiveShadow=true; if (parent) parent.add(o); return o; }
const sph=(r,w=22,h=16,...a)=>new THREE.SphereGeometry(r,w,h,...a);
const shade=(c,l,s=0)=>new THREE.Color(c).offsetHSL(0,s,l).getHex();
function vcol(geo, fn){ const p=geo.attributes.position, c=new Float32Array(p.count*3), v=V3(), o=new THREE.Color(); for (let i=0;i<p.count;i++){ v.fromBufferAttribute(p,i); fn(v,o); c[i*3]=o.r; c[i*3+1]=o.g; c[i*3+2]=o.b; } geo.setAttribute('color',new THREE.BufferAttribute(c,3)); return geo; }
const vmat = (o={}) => { const k='vc:'+JSON.stringify(o); if (!MATS.has(k)){ const m=new THREE.MeshStandardMaterial(Object.assign({ vertexColors:true, roughness:0.62 }, o)); m.userData.char=true; MATS.set(k,m); } return MATS.get(k); };
function tube(pts, rf, seg=12, rows=0){ const curve=new THREE.CatmullRomCurve3(pts.map(p=>Array.isArray(p)?V3(...p):p)), N=rows||Math.max(8,pts.length*6), P=curve.getPoints(N), pos=[], idx=[];
  for (let i=0;i<=N;i++){ const t=i/N, T=curve.getTangent(t), up=Math.abs(T.y)>0.9?V3(1,0,0):V3(0,1,0), s=V3().crossVectors(up,T).normalize(), b=V3().crossVectors(T,s).normalize(), r=rf(t);
    for (let k=0;k<=seg;k++){ const a=k/seg*TAU; pos.push(P[i].x+(s.x*Math.cos(a)+b.x*Math.sin(a))*r, P[i].y+(s.y*Math.cos(a)+b.y*Math.sin(a))*r, P[i].z+(s.z*Math.cos(a)+b.z*Math.sin(a))*r); } }
  for (let i=0;i<N;i++) for (let k=0;k<seg;k++){ const a=i*(seg+1)+k, b=a+seg+1; idx.push(a,a+1,b, a+1,b+1,b); }
  for (const [i,flip] of [[0,true],[N,false]]){ const c=pos.length/3; pos.push(P[i].x,P[i].y,P[i].z); for (let k=0;k<seg;k++){ const a=i*(seg+1)+k; if (flip) idx.push(c,a,a+1); else idx.push(c,a+1,a); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
const hexCss = c => '#'+new THREE.Color(c).getHexString();

/* ================= face drawings (shared by the 3D face and the creator's icons) ================= */
// eyes are drawn around (cx,cy) for one side; side = -1 (left on screen) or 1 (right). s = scale (1 = 512px face canvas)
export function drawEye(x, kind, cx, cy, side, s=1){
  // side: -1 = eye on the left of the picture, 1 = right. The face's middle is toward -side.
  x.save(); x.translate(cx,cy); x.scale(s,s); const ink='#1c1614';
  const shine=(dx,dy,r)=>{ x.fillStyle='#fff'; x.beginPath(); x.arc(dx,dy,r,0,TAU); x.fill(); };
  const line=(pts,w)=>{ x.strokeStyle=ink; x.lineCap='round'; x.lineJoin='round'; x.lineWidth=w; x.beginPath(); x.moveTo(pts[0][0],pts[0][1]); for (let i=1;i<pts.length;i++) x.lineTo(pts[i][0],pts[i][1]); x.stroke(); };
  if (kind==='bright'){ x.fillStyle=ink; x.beginPath(); x.ellipse(0,0,30,40,0,0,TAU); x.fill(); shine(-9,-15,11); shine(10,13,5); }
  else if (kind==='sparkle'){ x.fillStyle=ink; x.beginPath(); x.ellipse(0,0,33,43,0,0,TAU); x.fill(); x.fillStyle='#6a4430'; x.beginPath(); x.ellipse(0,9,23,28,0,0,TAU); x.fill(); x.fillStyle=ink; x.beginPath(); x.ellipse(0,7,13,18,0,0,TAU); x.fill();
    shine(-10,-16,12); shine(12,13,6); shine(-13,11,3.5);
    for (let k=0;k<3;k++){ const a=-Math.PI/2+side*(0.55+k*0.32), px=Math.cos(a)*33, py=Math.sin(a)*43; line([[px,py],[px*1.38,py*1.3]],6); } }
  else if (kind==='dot'){ x.fillStyle=ink; x.beginPath(); x.ellipse(0,4,15,19,0,0,TAU); x.fill(); shine(-4,-3,5); }
  else if (kind==='angry'){ const yIn=-2, yOut=-28; x.save(); x.beginPath(); x.moveTo(-70,90); x.lineTo(70,90); x.lineTo(70, side>0?yOut:yIn); x.lineTo(-70, side>0?yIn:yOut); x.closePath(); x.clip();
    x.fillStyle=ink; x.beginPath(); x.ellipse(0,8,27,32,0,0,TAU); x.fill(); shine(-7,8,8); x.restore();
    line([[-side*36,-12],[side*36,-42]],12); }
  else if (kind==='sad'){ x.fillStyle=ink; x.beginPath(); x.ellipse(0,8,27,33,0,0,TAU); x.fill(); shine(-8,-4,10); shine(9,18,5);
    x.strokeStyle=ink; x.lineCap='round'; x.lineWidth=10; x.beginPath(); x.moveTo(side*36,-36); x.quadraticCurveTo(side*8,-40,-side*24,-58); x.stroke();
    if (side>0){ x.fillStyle='rgba(120,190,255,0.9)'; x.beginPath(); x.moveTo(18,44); x.quadraticCurveTo(30,62,18,70); x.quadraticCurveTo(6,62,18,44); x.fill(); } }
  x.restore(); }
export function drawMouth(x, kind, cx, cy, s=1){
  x.save(); x.translate(cx,cy); x.scale(s,s); const ink='#2a1a18'; x.strokeStyle=ink; x.lineCap='round'; x.lineJoin='round'; x.lineWidth=9;
  if (kind==='smile'){ x.beginPath(); x.moveTo(-34,-6); x.quadraticCurveTo(0,34,34,-6); x.stroke(); }
  else if (kind==='grin'){ x.fillStyle='#6a2228'; x.beginPath(); x.moveTo(-38,-10); x.quadraticCurveTo(0,-2,38,-10); x.quadraticCurveTo(34,46,0,48); x.quadraticCurveTo(-34,46,-38,-10); x.fill(); x.stroke();
    x.fillStyle='#f08a96'; x.beginPath(); x.ellipse(0,32,20,12,0,0,TAU); x.fill(); x.fillStyle='#fff'; x.fillRect(-26,-8,52,9); }
  else if (kind==='cat'){ x.beginPath(); x.moveTo(-30,0); x.quadraticCurveTo(-15,20,0,2); x.quadraticCurveTo(15,20,30,0); x.stroke(); }
  else if (kind==='angry'){ x.fillStyle='#4a1c1e'; x.beginPath(); x.moveTo(-34,22); x.quadraticCurveTo(0,-14,34,22); x.lineTo(28,30); x.quadraticCurveTo(0,8,-28,30); x.closePath(); x.fill(); x.stroke();
    x.fillStyle='#fff'; x.beginPath(); x.moveTo(-22,18); x.quadraticCurveTo(0,0,22,18); x.lineTo(20,23); x.quadraticCurveTo(0,8,-20,23); x.closePath(); x.fill(); x.lineWidth=3; x.beginPath(); for (const t of [-11,0,11]){ x.moveTo(t,6); x.lineTo(t,24); } x.stroke(); }
  else if (kind==='sad'){ x.beginPath(); x.moveTo(-30,22); x.quadraticCurveTo(-10,0,0,4); x.quadraticCurveTo(12,0,30,22); x.stroke(); }
  x.restore(); }
export function drawNoseIcon(x, kind, cx, cy, s, color){
  x.save(); x.translate(cx,cy); x.scale(s,s); x.fillStyle=hexCss(color);
  if (kind==='button'){ x.beginPath(); x.ellipse(0,0,26,19,0,0,TAU); x.fill(); }
  else if (kind==='heart'){ x.beginPath(); x.moveTo(0,20); x.bezierCurveTo(-34,-4,-20,-30,0,-12); x.bezierCurveTo(20,-30,34,-4,0,20); x.fill(); }
  else if (kind==='bean'){ x.beginPath(); x.ellipse(0,0,36,15,0,0,TAU); x.fill(); }
  else if (kind==='triangle'){ x.beginPath(); x.moveTo(-26,-14); x.quadraticCurveTo(0,-22,26,-14); x.quadraticCurveTo(10,10,0,20); x.quadraticCurveTo(-10,10,-26,-14); x.fill(); }
  else { x.beginPath(); x.arc(0,0,11,0,TAU); x.fill(); }
  x.fillStyle='rgba(255,255,255,.55)'; x.beginPath(); x.ellipse(-7,-6,7,4,-0.4,0,TAU); x.fill(); x.restore(); }

/* ---------- face textures (cached) ---------- */
const TEX=new Map();
const FACE_SPAN=1.7, MUZ_SPAN=1.9;   // angular size of the face and muzzle patches
function faceTex(sp, sc, eye, extra){ const k=['f',sp,sc.fur,sc.accent,eye,extra.stripe?1:0].join(':'); if (TEX.has(k)) return TEX.get(k);
  const cv=document.createElement('canvas'); cv.width=cv.height=512; const x=cv.getContext('2d');
  const ex=113, ey=236;
  if (sp==='raccoon'){ x.fillStyle=hexCss(sc.accent); for (const s of [-1,1]){ x.beginPath(); x.ellipse(256+s*ex,ey+8,74,56,s*0.25,0,TAU); x.fill(); } x.fillRect(256-60,ey-14,120,40); }
  if (extra.stripe){ x.fillStyle='#3a3a40'; for (const s of [-1,1]){ x.beginPath(); x.ellipse(256+s*ex,ey+4,58,70,s*0.2,0,TAU); x.fill(); } x.fillStyle='#f6f4f0'; x.fillRect(256-30,0,60,ey-40); }
  if (sp==='chipmunk'){ x.fillStyle=hexCss(sc.accent); x.beginPath(); x.ellipse(256,40,22,120,0,0,TAU); x.fill(); for (const s of [-1,1]){ x.save(); x.translate(256+s*ex,ey+70); x.rotate(-s*0.25); x.fillRect(-60,-6,120,12); x.restore(); } }
  if (sp==='lizard'){ x.fillStyle=hexCss(sc.accent); for (let i=0;i<9;i++){ const a=i*2.4; x.beginPath(); x.arc(256+Math.cos(a)*190, 60+Math.abs(Math.sin(a*1.3))*90, 10+i%3*4, 0, TAU); x.fill(); } }
  if (sp==='dog' && sc.name==='Spotty'){ x.fillStyle=hexCss(sc.accent); x.beginPath(); x.ellipse(256+ex,ey-6,66,58,0.3,0,TAU); x.fill(); }
  if (sp==='cat' && (sc.name==='Orange tabby'||sc.name==='Gray')){ x.fillStyle=hexCss(sc.accent); for (const dx of [-36,0,36]){ x.beginPath(); x.moveTo(256+dx-12,0); x.lineTo(256+dx+12,0); x.lineTo(256+dx,90-Math.abs(dx)); x.fill(); } }
  // blush
  for (const s of [-1,1]){ const g=x.createRadialGradient(256+s*150,ey+86,4,256+s*150,ey+86,52); g.addColorStop(0,'rgba(255,128,140,.55)'); g.addColorStop(1,'rgba(255,128,140,0)'); x.fillStyle=g; x.fillRect(256+s*150-60,ey+26,120,120); }
  if (new THREE.Color(sc.fur).getHSL({}).l<0.36){ x.fillStyle=hexCss(sc.muzzle); for (const s of [-1,1]){ x.beginPath(); x.ellipse(256+s*ex,ey+4,50,58,0,0,TAU); x.fill(); } }   // light eye patches so dark faces still show their eyes
  for (const s of [-1,1]) drawEye(x, eye, 256+s*ex, ey, s, 1.12);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; TEX.set(k,t); return t; }
// markings on the back of the head: chipmunk racing stripes, tabby bands
function backTex(kind, sc){ const k='b:'+kind+':'+sc.fur+':'+sc.accent; if (TEX.has(k)) return TEX.get(k);
  const cv=document.createElement('canvas'); cv.width=cv.height=512; const x=cv.getContext('2d'); x.fillStyle=hexCss(sc.accent);
  if (kind==='chipmunk'){ for (const dx of [-120,0,120]){ x.beginPath(); x.ellipse(256+dx,250,dx?22:30,250,0,0,TAU); x.fill(); }
    x.fillStyle=hexCss(sc.muzzle); for (const dx of [-60,60]){ x.beginPath(); x.ellipse(256+dx,250,16,220,0,0,TAU); x.fill(); } }
  else { for (let i=0;i<5;i++){ const y=60+i*95; x.beginPath(); x.moveTo(256-200,y+30); x.quadraticCurveTo(256,y-30,256+200,y+30); x.quadraticCurveTo(256,y+6,256-200,y+30); x.fill(); } }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; TEX.set(k,t); return t; }
function mouthTex(mouth, gopher){ const k='m:'+mouth+':'+(gopher?1:0); if (TEX.has(k)) return TEX.get(k);
  const cv=document.createElement('canvas'); cv.width=cv.height=256; const x=cv.getContext('2d');
  x.strokeStyle='#2a1a18'; x.lineWidth=5; x.lineCap='round'; x.beginPath(); x.moveTo(128,112); x.lineTo(128,140); x.stroke();   // little line under the nose
  if (gopher){ x.fillStyle='#fffaf0'; x.strokeStyle='#5a4030'; x.lineWidth=3; for (const dx of [-13,1]){ x.beginPath(); x.roundRect(128+dx,150,13,26,3); x.fill(); x.stroke(); } }
  drawMouth(x, mouth, 128, gopher?150:152, 1.3);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; TEX.set(k,t); return t; }
function decal(R, span, tex, thetaOff=0){ const g=new THREE.SphereGeometry(R, 28, 22, Math.PI/2-span/2, span, Math.PI/2-span/2+thetaOff, span);
  const m=new THREE.MeshStandardMaterial({ map:tex, transparent:true, depthWrite:false, roughness:0.5, polygonOffset:true, polygonOffsetFactor:-2 }); m.userData.char=true;
  const o=new THREE.Mesh(g,m); o.renderOrder=2; o.castShadow=false; return o; }

/* ================= parts ================= */
function noseMesh(kind, color, parent, x, y, z, s=1){
  const m=gloss(color); let o;
  if (kind==='heart'||kind==='triangle'){ const sh=new THREE.Shape();
    if (kind==='heart'){ sh.moveTo(0,-0.034); sh.bezierCurveTo(-0.058,0.006,-0.034,0.05,0,0.02); sh.bezierCurveTo(0.034,0.05,0.058,0.006,0,-0.034); }
    else { sh.moveTo(-0.045,0.022); sh.quadraticCurveTo(0,0.036,0.045,0.022); sh.quadraticCurveTo(0.018,-0.012,0,-0.034); sh.quadraticCurveTo(-0.018,-0.012,-0.045,0.022); }
    const g=new THREE.ExtrudeGeometry(sh,{ depth:0.02, bevelEnabled:true, bevelThickness:0.014, bevelSize:0.01, bevelSegments:4, curveSegments:12 }); g.translate(0,0,-0.012); o=mesh(g, m, x,y,z, parent, false); }
  else { const r={ button:0.05, bean:0.044, tiny:0.026 }[kind]||0.05; o=mesh(sph(r,20,14), m, x,y,z, parent, false); o.scale.set(kind==='bean'?1.7:1.3, kind==='bean'?0.72:0.9, 0.8); }
  o.scale.multiplyScalar(s); return o; }
function ear(head, x,y,z, rz, build){ const p=new THREE.Group(); p.position.set(x,y,z); p.rotation.z=rz; head.add(p); build(p); p.userData.base=rz; return p; }

const MUZ = { // muzzle: radius, scale, how far it pokes out, color key
  hedgehog:{ r:0.13, s:[1.0,0.85,2.2], out:0.78, y:-0.1 }, rabbit:{ r:0.14, s:[1.35,0.8,0.62], out:0.4, y:-0.16 }, raccoon:{ r:0.14, s:[1.2,0.8,1.35], out:0.64, y:-0.13 },
  squirrel:{ r:0.14, s:[1.3,0.82,0.7], out:0.42, y:-0.15 }, chipmunk:{ r:0.14, s:[1.35,0.82,0.66], out:0.42, y:-0.15 }, dog:{ r:0.19, s:[1.22,0.85,1.35], out:0.74, y:-0.13 },
  cat:{ r:0.13, s:[1.45,0.8,0.55], out:0.36, y:-0.17 }, gopher:{ r:0.17, s:[1.3,0.85,0.8], out:0.5, y:-0.15 }, lizard:{ r:0.2, s:[1.75,0.6,1.1], out:0.58, y:-0.13, fur:true },
  bear:{ r:0.18, s:[1.3,0.85,0.95], out:0.58, y:-0.15 }, lion:{ r:0.18, s:[1.35,0.85,0.9], out:0.56, y:-0.14 },
  fox:{ r:0.15, s:[1.1,0.8,1.5], out:0.66, y:-0.13 }, otter:{ r:0.16, s:[1.4,0.85,0.8], out:0.5, y:-0.14 }, tortoise:{ r:0.17, s:[1.3,0.8,0.85], out:0.52, y:-0.14, fur:true },
  goat:{ r:0.17, s:[1.0,0.9,1.45], out:0.62, y:-0.18 }, frog:{ r:0.2, s:[1.6,0.62,0.9], out:0.5, y:-0.14, fur:true },
};

/* Animal features per critter (everyone shares the same head and body proportions). */
const SHAPE = {
  raccoon:{ tufts:'muzzle' }, cat:{ tufts:'fur' }, squirrel:{ crest:true }, gopher:{ claws:true }, lizard:{ toes:true, brows:true },
};

/* Many thin cones in one mesh, each shaded from base to tip (quills, spines). items: { p, d (unit), len, r } */
function spikeField(items, cBase, cMid, cTip, seg=5){
  const pos=[], col=[], idx=[], q=new THREE.Quaternion(), up=V3(0,1,0), t=V3(), C=[cBase,cMid,cTip].map(c=>new THREE.Color(c));
  for (const it of items){ q.setFromUnitVectors(up, it.d); const b=pos.length/3;
    for (const [h,rr,ci] of [[0,1,0],[0.5,0.62,1]]) for (let k=0;k<seg;k++){ const a=k/seg*TAU; t.set(Math.cos(a)*it.r*rr, it.len*h, Math.sin(a)*it.r*rr).applyQuaternion(q).add(it.p); pos.push(t.x,t.y,t.z); col.push(C[ci].r,C[ci].g,C[ci].b); }
    t.set(0,it.len,0).applyQuaternion(q).add(it.p); pos.push(t.x,t.y,t.z); col.push(C[2].r,C[2].g,C[2].b);
    for (let k=0;k<seg;k++){ const a=b+k, a2=b+(k+1)%seg, m=a+seg, m2=a2+seg; idx.push(a,m,a2, a2,m,m2, m,b+2*seg,m2); } }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setAttribute('color',new THREE.Float32BufferAttribute(col,3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
// one cone standing on point p, pointing along d, flattened across its width
function spike(parent, m, p, d, len, r, flat=1){ const o=mesh(new THREE.ConeGeometry(r,len,12), m, 0,0,0, parent); o.scale.z=flat; o.quaternion.setFromUnitVectors(V3(0,1,0), d.clone().normalize()); o.position.copy(p).addScaledVector(d.clone().normalize(), len/2); return o; }
const fib=(i,n)=>{ const el=Math.acos(1-2*(i+0.5)/n), a=i*2.39996; return V3(Math.sin(el)*Math.cos(a), Math.cos(el), Math.sin(el)*Math.sin(a)); };


/* Felt finish: matte fibers, a soft fuzzy sheen at the edges and a stitched seam over the head. */
let FELT_T=null;
function feltTextures(){ if (FELT_T) return FELT_T; const S=256;
  const b=document.createElement('canvas'); b.width=b.height=S; const x=b.getContext('2d'); x.fillStyle='#808080'; x.fillRect(0,0,S,S);
  let seed=7; const rnd=()=>{ seed=(seed*16807)%2147483647; return seed/2147483647; };
  for (let i=0;i<220;i++){ const px=rnd()*S, py=rnd()*S, r=10+rnd()*30, v=rnd()<0.5?255:0;   // soft lumps
    for (const ox of [-S,0,S]) for (const oy of [-S,0,S]){ const g=x.createRadialGradient(px+ox,py+oy,0,px+ox,py+oy,r); g.addColorStop(0,`rgba(${v},${v},${v},0.07)`); g.addColorStop(1,`rgba(${v},${v},${v},0)`); x.fillStyle=g; x.fillRect(px+ox-r,py+oy-r,r*2,r*2); } }
  for (let i=0;i<6000;i++){ const px=rnd()*S, py=rnd()*S, a=rnd()*TAU, l=2+rnd()*7, v=rnd()<0.5?255:0, al=0.06+rnd()*0.14, w=0.5+rnd()*0.8;   // fibers
    x.strokeStyle=`rgba(${v},${v},${v},${al})`; x.lineWidth=w;
    for (const ox of [-S,0,S]) for (const oy of [-S,0,S]){ x.beginPath(); x.moveTo(px+ox,py+oy); x.quadraticCurveTo(px+ox+Math.cos(a+0.6)*l*0.5, py+oy+Math.sin(a+0.6)*l*0.5, px+ox+Math.cos(a)*l, py+oy+Math.sin(a)*l); x.stroke(); } }
  const c=document.createElement('canvas'); c.width=c.height=S; const y=c.getContext('2d'); y.fillStyle='#fff'; y.fillRect(0,0,S,S); y.globalAlpha=0.22; y.drawImage(b,0,0);
  const mk=(cv,srgb)=>{ const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(5,3); t.anisotropy=4; if (srgb) t.colorSpace=THREE.SRGBColorSpace; return t; };
  return FELT_T={ bump:mk(b,false), map:mk(c,true) }; }
const FELT=new Map();
function feltMat(m){ let f=FELT.get(m); if (f) return f; const T=feltTextures(), white=new THREE.Color(0xffffff);
  f=new THREE.MeshPhysicalMaterial({ color:m.color.clone().multiplyScalar(1.06), vertexColors:m.vertexColors, side:m.side, roughness:1, metalness:0, map:T.map, bumpMap:T.bump, bumpScale:2.2,
    sheen:1, sheenRoughness:0.5, sheenColor:(m.vertexColors?white.clone():m.color.clone().lerp(white,0.5)).multiplyScalar(0.55) });
  f.userData.char=true; f.userData.felt=true; FELT.set(m,f); return f; }

function buildEars(head, sp, sc, R, ears){
  const fur=mat(sc.fur), inner=mat(sc.accent), acc=mat(sc.accent);
  const pair=(fn)=>{ for (const s of [-1,1]) ears.push(fn(s)); };
  switch (sp){
    case 'rabbit': pair(s=>ear(head, s*0.19,0.42,-0.04, s*-0.12, p=>{
      const seg=(par,y,len)=>{ const e=mesh(new THREE.CapsuleGeometry(0.11,len,8,16), fur, 0,y,0,par); e.scale.set(1,1,0.55); const i=mesh(new THREE.CapsuleGeometry(0.06,len*0.8,8,12), mat(sc.accent), 0,y,0.05,par); i.scale.set(1,1,0.35); };
      if (s<0) seg(p,0.32,0.42); else { seg(p,0.17,0.16); const tip=new THREE.Group(); tip.position.y=0.3; tip.rotation.set(0.35,0,-1.35); p.add(tip); seg(tip,0.17,0.2); } })); break;
    case 'cat': case 'fox': pair(s=>ear(head, s*0.3,0.4,0, s*-0.28, p=>{ const e=mesh(new THREE.ConeGeometry(0.17,0.32,24), fur, 0,0.12,0,p); e.scale.z=0.62; const i=mesh(new THREE.ConeGeometry(0.1,0.2,20), mat(sp==='fox'?0xfff4ea:sc.accent), 0,0.09,0.055,p); i.scale.z=0.3; if (sp==='fox') mesh(new THREE.ConeGeometry(0.075,0.11,16), mat(0x3a2a24), 0,0.25,0,p).scale.z=0.62; })); break;
    case 'squirrel': pair(s=>ear(head, s*0.28,0.42,-0.02, s*-0.2, p=>{ const e=mesh(new THREE.ConeGeometry(0.13,0.26,24), fur, 0,0.1,0,p); e.scale.z=0.6; mesh(new THREE.ConeGeometry(0.075,0.16,16), mat(sc.muzzle), 0,0.08,0.045,p).scale.z=0.3; const tuft=mesh(new THREE.ConeGeometry(0.05,0.14,12), acc, 0.0,0.27,0,p); tuft.rotation.z=-s*0.3; })); break;
    case 'dog': pair(s=>ear(head, s*0.55,0.26,0.0, s*-0.32, p=>{ const e=mesh(sph(0.17,24,16), mat(sc.accent), s*0.05,-0.14,0,p); e.scale.set(0.55,1.35,0.36); })); break;
    case 'goat': pair(s=>ear(head, s*0.5,0.1,0, s*-1.4, p=>{ const e=mesh(sph(0.14,20,14), fur, 0,0.14,0,p); e.scale.set(0.6,1.5,0.4); })); for (const s of [-1,1]){ const h=mesh(tube([[s*0.16,0.42,-0.08],[s*0.24,0.62,-0.18],[s*0.2,0.72,-0.32]], t=>0.06*(1-t*0.8)+0.008, 14), mat(0xd8c8a0), 0,0,0,head); } break;
    case 'lizard': case 'tortoise': case 'frog': break;
    case 'hedgehog': case 'gopher': case 'otter': { const sz=sp==='gopher'?0.1:sp==='otter'?0.1:0.11; pair(s=>ear(head, s*0.47,0.34,-0.04, s*-0.6, p=>{ const e=mesh(sph(sz,20,14), fur, 0,0,0,p); e.scale.z=0.55; mesh(sph(sz*0.6,16,12), mat(sp==='hedgehog'?sc.muzzle:sc.accent), 0,0,sz*0.35,p).scale.z=0.3; })); break; }
    default: { const sz = sp==='lion'?0.14 : sp==='chipmunk'?0.12 : 0.16; // bear, raccoon, lion, chipmunk
      pair(s=>ear(head, s*0.38,0.38,-0.04, s*-0.42, p=>{ const e=mesh(sph(sz,24,16), sp==='raccoon'?acc:fur, 0,0.05,0,p); e.scale.z=0.55; mesh(sph(sz*0.6,20,14), sp==='raccoon'?mat(sc.muzzle):mat(shade(sc.fur,0.12)), 0,0.05,sz*0.35,p).scale.z=0.3; })); }
  } }

function buildTail(body, sp, sc){
  const tail=new THREE.Group(); tail.position.set(0,0.46,-0.43); body.add(tail); let base=0;
  const fur=mat(sc.fur);
  switch (sp){
    case 'rabbit': mesh(sph(0.15,20,16), mat(sc.muzzle), 0,0,0,tail); break;
    case 'bear': case 'hedgehog': case 'gopher': case 'tortoise': mesh(sph(0.09,16,12), fur, 0,0,-0.02,tail); break;
    case 'dog': mesh(tube([[0,0,0],[0,0.12,-0.12],[0,0.32,-0.12],[0,0.42,-0.04]], t=>0.07*(1-t*0.5), 12), mat(sp==='dog'&&sc.name==='Husky'?sc.muzzle:sc.fur), 0,0,0,tail); break;
    case 'cat': mesh(tube([[0,0,0],[0,0.1,-0.25],[0,0.42,-0.35],[0.05,0.6,-0.24]], t=>0.055*(1-t*0.25), 12), fur, 0,0,0,tail); break;
    case 'lion': mesh(tube([[0,0,0],[0,0.05,-0.28],[0,0.25,-0.45],[0,0.42,-0.42]], t=>0.04, 10), fur, 0,0,0,tail); for (let k=0;k<6;k++){ const a=k/6*TAU; spike(tail, mat(k%2?sc.accent:shade(sc.accent,-0.08)), V3(0,0.4,-0.42), V3(Math.cos(a)*0.7,1,Math.sin(a)*0.7), 0.16, 0.05, 0.6); } mesh(sph(0.06,12,10), mat(sc.accent), 0,0.42,-0.42,tail); break;
    case 'raccoon': { const g=tube([[0,0,0],[0,0.05,-0.22],[0,0.22,-0.4],[0,0.42,-0.42]], t=>0.11*(1-t*0.35)+0.02, 16); vcol(g,(v,o)=>{ const d=Math.hypot(v.y,v.z); o.set(Math.sin(d*28)>0.2?sc.accent:sc.fur); }); mesh(g, vmat(), 0,0,0,tail); break; }
    case 'squirrel': { const g=tube([[0,-0.05,0],[0,0.05,-0.22],[0,0.45,-0.34],[0,0.82,-0.22],[0,0.9,-0.02]], t=>0.21*Math.sin(Math.PI*(0.15+t*0.8))+0.05, 18); vcol(g,(v,o)=>{ o.set(sc.fur).lerp(new THREE.Color(sc.accent), Math.max(0,(v.y-0.6)*2.2)); }); mesh(g, vmat(), 0,0,0,tail); break; }
    case 'chipmunk': { const g=tube([[0,0,0],[0,0.06,-0.2],[0,0.28,-0.32],[0,0.52,-0.26]], t=>0.09*Math.sin(Math.PI*(0.2+t*0.7))+0.03, 16); vcol(g,(v,o)=>{ o.set(Math.abs(v.x)<0.025?sc.accent:sc.fur); }); mesh(g, vmat(), 0,0,0,tail); break; }
    case 'lizard': { const g=tube([[0,-0.2,0],[0,-0.36,-0.25],[0.05,-0.44,-0.6],[0.2,-0.46,-0.85]], t=>0.13*(1-t)+0.015, 16); vcol(g,(v,o)=>{ o.set(sc.fur); if (Math.sin(v.z*30)>0.7) o.lerp(new THREE.Color(sc.accent),0.6); }); mesh(g, vmat(), 0,0,0,tail); base=0; break; }
    case 'fox': { const g=tube([[0,0,0],[0,0.02,-0.25],[0,0.15,-0.5],[0,0.35,-0.6]], t=>0.15*Math.sin(Math.PI*(0.15+t*0.75))+0.03, 18); vcol(g,(v,o)=>{ o.set(v.y>0.27?0xfff6ee:sc.fur); }); mesh(g, vmat(), 0,0,0,tail); break; }
    case 'otter': mesh(tube([[0,-0.05,0],[0,-0.2,-0.3],[0,-0.3,-0.6]], t=>0.09*(1-t*0.7), 12), fur, 0,0,0,tail); break;
    case 'goat': mesh(new THREE.ConeGeometry(0.07,0.18,12), fur, 0,0.06,0,tail); break;
    default: tail.visible=false;
  }
  tail.userData.base=base; return tail; }

/* ---------- outfits ---------- */
const TORSO_Y=0.7;
function shell(r, t0, t1, m, body, sx=1, sy=0.92, sz=0.86){ const o=mesh(sph(r,32,14,0,TAU,Math.PI*t0,Math.PI*(t1-t0)), m, 0,TORSO_Y,0,body); o.scale.set(sx,sy,sz); return o; }
function buildOutfit(body, arms, kind, color, sc){
  const c=mat(color), light=mat(0xf6f2ea), trim=mat(shade(color,-0.1));
  const sleeve=(len)=>{ for (const a of arms){ const s=a.userData.side, sl=mesh(new THREE.CapsuleGeometry(0.122,len,8,16), kind==='overalls'?light:c, s*0.03,-0.08+(0.12-len)*0.3,0, a); sl.rotation.z=s*0.25; } };
  if (kind==='tee'){ shell(0.488,0.15,0.6,c,body); sleeve(0.04); const hem=mesh(new THREE.TorusGeometry(0.44,0.03,10,40), trim, 0,0.48,0,body); hem.rotation.x=Math.PI/2; hem.scale.set(1,0.86,1); shell(0.484,0.6,0.86,mat(0x56688a),body); const col=mesh(new THREE.TorusGeometry(0.19,0.035,10,28), trim, 0,1.1,0.02,body); col.rotation.x=Math.PI/2; }
  else if (kind==='hoodie'){ shell(0.495,0.12,0.7,c,body); sleeve(0.13); for (const a of arms){ const s=a.userData.side; const cf=mesh(new THREE.TorusGeometry(0.1,0.03,8,20), trim, s*0.065,-0.2,0.015,a); cf.rotation.x=Math.PI/2; }
    const hood=mesh(new THREE.TorusGeometry(0.27,0.1,14,32,Math.PI*1.3), c, 0,1.1,-0.05,body); hood.rotation.set(Math.PI/2,0,-Math.PI*0.15-Math.PI*0.5); hood.scale.set(1,0.9,1);
    for (const s of [-1,1]){ mesh(new THREE.CylinderGeometry(0.008,0.008,0.22,6), light, s*0.08,0.98,0.4,body).rotation.x=0.15; mesh(sph(0.018,10,8), light, s*0.08,0.87,0.42,body); }
    const pk=mesh(new THREE.BoxGeometry(0.42,0.16,0.05), trim, 0,0.6,0.39,body); pk.rotation.x=-0.35; shell(0.484,0.7,0.88,mat(0x4a4a54),body); }
  else if (kind==='overalls'){ shell(0.488,0.14,0.55,light,body); sleeve(0.03); shell(0.494,0.5,0.88,c,body);
    const bib=mesh(new THREE.BoxGeometry(0.36,0.28,0.06), c, 0,0.86,0.39,body); bib.rotation.x=-0.25; const pk=mesh(new THREE.BoxGeometry(0.16,0.1,0.02), trim, 0,0.85,0.43,body); pk.rotation.x=-0.25;
    for (const s of [-1,1]){ const st=mesh(new THREE.BoxGeometry(0.07,0.42,0.05), c, s*0.15,1.0,0.24,body); st.rotation.x=-0.6; mesh(new THREE.CylinderGeometry(0.028,0.028,0.02,16), gloss(0xe8c050), s*0.15,0.98,0.425,body).rotation.x=Math.PI/2-0.25; } }
  else if (kind==='dress'){ shell(0.49,0.14,0.52,c,body); sleeve(0.03);
    const sk=new THREE.LatheGeometry([[0.4,0.62],[0.47,0.5],[0.56,0.3],[0.6,0.2],[0.58,0.17]].map(([x,y])=>new THREE.Vector2(x,y)),40); const s=mesh(sk, mat(color,{side:THREE.DoubleSide}), 0,0,0,body); s.scale.set(1,1,0.9);
    const hem=mesh(new THREE.TorusGeometry(0.585,0.022,8,48), light, 0,0.19,0,body); hem.rotation.x=Math.PI/2; hem.scale.set(1,0.9,1);
    for (let i=0;i<4;i++){ const bt=mesh(sph(0.022,10,8), light, 0,1.0-i*0.1,0.0,body); bt.position.z=Math.sqrt(Math.max(0,0.49*0.49-(bt.position.y-TORSO_Y)**2/0.85))*0.86+0.005; }
    const col=mesh(new THREE.TorusGeometry(0.2,0.04,10,28), light, 0,1.1,0.03,body); col.rotation.x=Math.PI/2; }
  else if (kind==='sweater'){ const g=sph(0.495,40,24,0,TAU,Math.PI*0.12,Math.PI*0.58); vcol(g,(v,o)=>o.set(Math.floor((v.y+0.6)*14)%2?color:0xf6f2ea)); const o=mesh(g, vmat(), 0,TORSO_Y,0,body); o.scale.set(1,0.92,0.86);
    for (const a of arms){ const s=a.userData.side, gg=new THREE.CapsuleGeometry(0.122,0.13,8,16); vcol(gg,(v,o2)=>o2.set(Math.floor((v.y+0.5)*14)%2?color:0xf6f2ea)); const sl=mesh(gg, vmat(), s*0.03,-0.1,0,a); sl.rotation.z=s*0.25; }
    const tn=mesh(new THREE.TorusGeometry(0.2,0.06,12,30), c, 0,1.12,0.0,body); tn.rotation.x=Math.PI/2; shell(0.484,0.7,0.88,mat(0x56688a),body); }
}

/* ---------- accessories (residents and shopkeepers keep theirs) ---------- */
function dressUp(body, head, acc, accC){
  const A=acc||[];
  if (A.includes('scarf')){ const c=mat(accC||0x5aae6a); const s=mesh(new THREE.TorusGeometry(0.28,0.08,14,30), c, 0,1.1,0,body); s.rotation.x=Math.PI/2; const t=mesh(new THREE.BoxGeometry(0.14,0.34,0.07), c, 0.16,0.92,0.38,body); t.rotation.set(-0.2,0,0.15); }
  if (A.includes('beanie')){ const c=mat(accC||0xf0c040); const b=mesh(sph(0.6,32,18,0,TAU,0,Math.PI*0.42), c, 0,0.08,-0.02,head); b.scale.set(1.06,1,1.04); const rim=mesh(new THREE.TorusGeometry(0.53,0.065,12,40), mat(shade(accC||0xf0c040,-0.08)), 0,0.28,-0.02,head); rim.rotation.x=Math.PI/2+0.08; mesh(sph(0.11,16,12), c, 0,0.68,-0.04,head); }
  if (A.includes('glasses')){ const fr=gloss(0x5a3a2a); for (const s of [-1,1]) mesh(new THREE.TorusGeometry(0.115,0.016,10,28), fr, s*0.2,0.03,0.54,head).castShadow=false; mesh(new THREE.CylinderGeometry(0.012,0.012,0.1,6), fr, 0,0.05,0.56,head).rotation.z=Math.PI/2; }
  if (A.includes('bow')){ const m=mat(accC||0xf08aa8); for (const s of [-1,1]){ const w=mesh(new THREE.ConeGeometry(0.1,0.18,16), m, s*0.1,0.46,0.16,head); w.rotation.z=s*Math.PI/2; } mesh(sph(0.05,12,10), m, 0,0.46,0.18,head); }
  if (A.includes('flower')){ const p=new THREE.Group(); p.position.set(0.3,0.38,0.32); head.add(p); for (let i=0;i<5;i++){ const a=i/5*TAU; mesh(sph(0.055,12,10), mat(0xffffff), Math.cos(a)*0.06,Math.sin(a)*0.06,0,p).scale.z=0.4; } mesh(sph(0.04,12,10), mat(0xf8d040), 0,0,0.02,p); }
  if (A.includes('headband')){ const hb=mesh(new THREE.TorusGeometry(0.57,0.05,10,40), mat(accC||0xe2483d), 0,0.2,0,head); hb.rotation.x=Math.PI/2-0.25; }
  if (A.includes('beret')){ const c=mat(accC||0x6a4aa8); const b=mesh(sph(0.42,28,12,0,TAU,0,Math.PI/2), c, -0.08,0.44,-0.02,head); b.scale.set(1.2,0.35,1.2); b.rotation.z=0.25; mesh(new THREE.CylinderGeometry(0.02,0.03,0.08,8), c, -0.1,0.6,0,head); }
  if (A.includes('pearls')){ for (let i=0;i<14;i++){ const a=Math.PI*0.1+i/13*Math.PI*0.8; mesh(sph(0.03,10,8), gloss(0xf8f4ec), Math.cos(a)*0.28, 1.08-Math.sin(a)*0.06, Math.sin(a)*0.25, body).castShadow=false; } }
  if (A.includes('apron')){ const ap=mesh(new THREE.BoxGeometry(0.5,0.46,0.04), mat(accC||0xf8e8f0), 0,0.6,0.41,body); ap.rotation.x=-0.18; }
  if (A.includes('vest')){ const v=mesh(sph(0.505,40,20,Math.PI*0.62,Math.PI*1.76,Math.PI*0.16,Math.PI*0.46), mat(accC||0x3a5a8a), 0,0.7,0,body); v.scale.set(1,0.92,0.86); }
}


// Merge static meshes that share a material within each moving part (body, head, arms, legs, ears, tail),
// so a character is a few dozen draw calls at most, not a hundred.
function mergeRig(g, rig){
  const rigSet=new Set(rig), m4=new THREE.Matrix4();
  for (const node of rig){ node.updateMatrixWorld(true); const inv=node.matrixWorld.clone().invert(), groups=new Map();
    node.traverse(o=>{ if (!o.isMesh || o===node || o.children.length) return;   // meshes carrying decals or parts stay whole
      let p=o.parent; while (p && !rigSet.has(p)) p=p.parent; if (p!==node) return;
      const geo=o.geometry, names=Object.keys(geo.attributes).filter(n=>n!=='uv'||o.material.map||o.material.bumpMap).sort().join(',');
      const k=o.material.uuid+'|'+names+'|'+o.renderOrder+'|'+o.castShadow; if (!groups.has(k)) groups.set(k,{ list:[], o }); groups.get(k).list.push(o); });
    for (const G of groups.values()){ if (G.list.length<2) continue; const names=Object.keys(G.o.geometry.attributes).filter(n=>n!=='uv'||G.o.material.map||G.o.material.bumpMap);
      const parts={}, idx=[]; for (const n of names) parts[n]=[]; let base=0;
      for (const o of G.list){ m4.multiplyMatrices(inv, o.matrixWorld); const gg=(o.geometry.index?o.geometry:o.geometry).clone().applyMatrix4(m4);
        if (m4.determinant()<0 && gg.index){ const I=gg.index.array; for (let i=0;i<I.length;i+=3){ const t=I[i+1]; I[i+1]=I[i+2]; I[i+2]=t; } }
        const cnt=gg.attributes.position.count; for (const n of names) parts[n].push(gg.attributes[n].array);
        if (gg.index) for (const i of gg.index.array) idx.push(i+base); else for (let i=0;i<cnt;i++) idx.push(i+base); base+=cnt; o.parent.remove(o); }
      const out=new THREE.BufferGeometry(); for (const n of names){ const sz=G.o.geometry.attributes[n].itemSize, len=parts[n].reduce((a,b)=>a+b.length,0), arr=new Float32Array(len); let off=0; for (const a of parts[n]){ arr.set(a,off); off+=a.length; } out.setAttribute(n,new THREE.BufferAttribute(arr,sz)); }
      out.setIndex(idx); out.computeBoundingSphere(); const mm=new THREE.Mesh(out, G.o.material); mm.castShadow=G.o.castShadow; mm.receiveShadow=true; mm.renderOrder=G.o.renderOrder; node.add(mm); } }
  // drop helper groups left empty
  const empty=[]; g.traverse(o=>{ if (o!==g && !o.isMesh && !rigSet.has(o) && o.children.length===0 && !o.isSprite) empty.push(o); }); for (const e of empty) e.parent && e.parent.remove(e);
}

/* ================= the builder ================= */
// look: a look object (see parseLook) or an NPC spec ({ species, fur, muzzle, shirt, top, acc, accC, stripe, cheek })
export function buildCritter(look, opts={}){
  const npc = !look.sp;
  const sp = npc ? look.species : look.sp;
  const sc = npc ? { name:'npc', fur:look.fur, muzzle:look.muzzle||look.belly||0xffffff, accent: look.accent ?? (sp==='rabbit'||sp==='cat'||sp==='mouse' ? (look.cheek||0xf0b0c0) : shade(look.fur,-0.18)), nose: ['rabbit','cat','mouse','sheep','hedgehog'].includes(sp)?0xe88a9a : sp==='frog'?0x3a6a2a : 0x2a1e1a }
                 : SPECIES[sp].schemes[look.c];
  const outfit = npc ? (look.top==='overalls'?'overalls':look.top==='stripe'?'sweater':'tee') : OUTFITS[look.top].id;
  const ocol = npc ? (look.shirt??0x6fb7d8) : OUTFIT_COLORS[look.tc];
  const eye = npc ? 'bright' : EYES[look.e].id, nose = npc ? 'button' : NOSES[look.n].id, mouth = npc ? 'smile' : MOUTHS[look.m].id;
  const extra = { stripe: !!look.stripe };
  const g=new THREE.Group(), body=new THREE.Group(); g.add(body);
  const wob=[];   // parts that flop on their own spring (quill coats, manes, spines); the game's jelly animation drives them
  const wobbler=(parent,x,y,z,k)=>{ const w=new THREE.Group(); w.position.set(x,y,z); w.userData.k=k; parent.add(w); wob.push(w); return w; };
  const fur=mat(sc.fur), muzM=mat(sc.muzzle), R=0.56, felt=!npc && look.f===1;
  const SH=SHAPE[sp]||{}, HS=SH.head||[1.08,0.95,1], TR=SH.trunk||[1,1], ft=SH.feet||1, pw=SH.paw||1, lb=SH.limb||1;
  // torso (mostly hidden by clothes). The trunk group gives each critter its girth; the animation only touches body.
  const trunk=new THREE.Group(); trunk.scale.set(TR[0],1,TR[1]); body.add(trunk);
  const torso=mesh(sph(0.46,24,16), fur, 0,TORSO_Y,0,trunk); torso.scale.set(1,0.92,0.86);
  // head: headRig is what the animation moves; the inner group carries the critter's head shape
  const headRig=new THREE.Group(); headRig.position.y=1.42; body.add(headRig);
  const head=new THREE.Group(); head.scale.set(HS[0]/1.08, HS[1]/0.95, HS[2]); head.position.y=SH.hy||0; head.rotation.z=SH.tilt||0; headRig.add(head);
  const hm=mesh(sph(R,40,28), fur, 0,0,0,head); hm.scale.set(1.08,0.95,1.0);
  if (felt){ const sg=new THREE.TorusGeometry(R*1.004,0.009,6,72,2.45); sg.rotateZ(-0.3); sg.rotateY(Math.PI/2); mesh(sg, mat(shade(sc.fur,-0.16)), 0,0,0, hm, false); }
  const face=decal(R*1.006, FACE_SPAN, faceTex(sp, sc, eye, extra)); hm.add(face);
  const bk = sp==='chipmunk' ? 'chipmunk' : (sp==='cat' && /tabby|Gray/.test(sc.name)) ? 'tabby' : null;
  if (bk){ const b=decal(R*1.006, 1.9, backTex(bk, sc)); b.rotation.y=Math.PI; hm.add(b); }
  // muzzle, nose, mouth
  const mz=MUZ[sp]||MUZ.bear, mr=mz.r, mzPos=V3(0, mz.y, Math.sqrt(R*R-mz.y*mz.y)-mr*mz.s[2]*(1-mz.out));
  const muz=mesh(sph(mr,28,18), mz.fur?fur:muzM, mzPos.x,mzPos.y,mzPos.z, head); muz.scale.set(...mz.s);
  const md=decal(mr*1.012, MUZ_SPAN, mouthTex(mouth, sp==='gopher'||sp==='rabbit'), 0.12); muz.add(md);
  const nz=mzPos.z+mr*mz.s[2]*0.92, ny=mzPos.y+mr*mz.s[1]*0.5;
  noseMesh(nose, sc.nose, head, 0, ny, nz-0.012, sp==='lizard'||sp==='frog'?0.7:1);
  if (sp==='cat'||sp==='lion'||sp==='otter') for (const s of [-1,1]) for (let k=0;k<2;k++){ const w=mesh(new THREE.CylinderGeometry(0.004,0.004,0.24,4), mat(0x5a4a44), s*0.2, mzPos.y+0.02-k*0.04, mzPos.z+0.06, head, false); w.rotation.z=Math.PI/2+s*(k?-0.14:0.1); }
  // ears
  const ears=[]; buildEars(head, sp, sc, R, ears); if (SH.ear) for (const e of ears) e.scale.setScalar(SH.ear);
  // species extras
  if (sp==='hedgehog'){
    const cap=mesh(sph(R*1.012,40,24,Math.PI*0.92,Math.PI*1.16,0,Math.PI*0.8), mat(new THREE.Color(sc.fur).lerp(new THREE.Color(sc.accent),0.35).getHex(),{side:THREE.DoubleSide}), 0,0,0, hm);
    let sd=11; const rnd=()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; }, sweep=V3(0,0.12,-1).normalize(), Q=[];
    for (let i=0;i<1500;i++){ const d=fib(i,1500); if (d.y < (d.z<-0.3?-0.85:-0.55) || d.z > 0.12 + 0.5*Math.max(0,d.y-0.3)) continue;   // leave the face and chin bare
      const p=d.clone().multiply(V3(R*1.08,R*0.95,R)).multiplyScalar(0.96), n=d.clone().multiply(V3(1/1.08,1/0.95,1)).normalize();
      const dir=n.multiplyScalar(0.42).addScaledVector(sweep,0.58).add(V3(rnd()-0.5,rnd()-0.5,rnd()-0.5).multiplyScalar(0.22)).normalize();
      Q.push({ p, d:dir, len:0.2+rnd()*0.12, r:0.026+rnd()*0.01 }); }
    const hq=wobbler(head, 0,0,0, 0.22); mesh(spikeField(Q, shade(sc.accent,-0.08), sc.accent, shade(sc.muzzle,-0.03)), vmat(), 0,0,0, hq);
    const B=[], down=V3(0,-0.45,-1).normalize();   // the coat carries on down the back, over the clothes
    for (let i=0;i<700;i++){ const d=fib(i,700); if (d.z>-0.25 || d.y<-0.55 || d.y>0.6) continue;   // stops below the neck so the head never slides through it
      const p=d.clone().multiply(V3(0.5,0.46,0.44)).add(V3(0,TORSO_Y,0)), dir=d.clone().multiplyScalar(0.38).addScaledVector(down,0.62).add(V3(rnd()-0.5,rnd()-0.5,rnd()-0.5).multiplyScalar(0.2)).normalize();
      B.push({ p, d:dir, len:0.2+rnd()*0.12, r:0.028+rnd()*0.01 }); }
    const bq=wobbler(trunk, 0,1.0,-0.3, 0.8); mesh(spikeField(B, shade(sc.accent,-0.08), sc.accent, shade(sc.muzzle,-0.03)), vmat(), 0,-1.0,0.3, bq);
  }
  if (sp==='lion'){ const M=[mat(sc.accent), mat(shade(sc.accent,-0.08)), mat(shade(sc.accent,0.07))], mh=head; { const head=wobbler(mh, 0,0,0, 0.6);
    mesh(sph(0.5,32,20), M[1], 0,0.02,-0.26, head).scale.set(1.24,1.18,0.7);
    // thick tapered locks that sweep outward and back, all curling the same way, in three layers and three shades
    const ring=(n, rr, len, w, z, off, back, shadeOff)=>{ for (let i=0;i<n;i++){ const a=(i+off)/n*TAU+Math.PI/2, c=Math.cos(a), sn=Math.sin(a), L=len*(0.9+0.2*((i*7)%5)/4);
      const rad=V3(c,sn,0), tan=V3(-sn,c,0), bk=V3(0,0,-1), p0=V3(c*rr*1.08, sn*rr*0.95, z);
      const p1=p0.clone().addScaledVector(rad,L*0.5).addScaledVector(bk,L*back*0.5).addScaledVector(tan,L*0.08);
      const p2=p0.clone().addScaledVector(rad,L*0.85).addScaledVector(bk,L*back).addScaledVector(tan,L*0.32);
      mesh(tube([p0,p1,p2], t=>w*Math.pow(1-t,0.85)+0.006, 7, 7), M[(i+shadeOff)%3], 0,0,0, head); } };
    ring(15, 0.4, 0.46, 0.13, -0.3, 0, 0.7, 0);      // long back locks
    ring(15, 0.48, 0.38, 0.115, -0.15, 0.5, 0.45, 1);  // middle layer
    ring(13, 0.53, 0.25, 0.09, 0.0, 0.25, 0.2, 2);     // short fringe framing the face
    // the back of the mane: locks covering the dome and hanging down, so there's no bald patch behind
    const C=V3(0,0.02,-0.26), RD=V3(0.62,0.59,0.35);
    for (let i=0;i<110;i++){ const d=fib(i,110); if (d.z>-0.3) continue; const L=0.26+0.08*((i*5)%4)/3;
      const p0=d.clone().multiply(RD).multiplyScalar(0.92).add(C), flow=d.clone().multiplyScalar(0.45).add(V3(0,-0.75,-0.2)).normalize(), tn=V3(-d.y,d.x,0).normalize();
      const p1=p0.clone().addScaledVector(flow,L*0.5), p2=p0.clone().addScaledVector(flow,L*0.9).addScaledVector(tn,L*0.25);
      mesh(tube([p0,p1,p2], t=>0.1*Math.pow(1-t,0.85)+0.006, 7, 7), M[i%3], 0,0,0, head); }
  } }
  if (sp==='lizard'){ const cm=mat(sc.accent);
    for (let i=0;i<7;i++){ const a=-0.35+i*0.36, d=V3(0,Math.cos(a),-Math.sin(a)); spike(head, cm, d.clone().multiply(V3(0,R*0.95,R)).multiplyScalar(0.97), d.clone().add(V3(0,0,-0.35)), 0.13+0.09*Math.sin(Math.PI*(i+1)/8), 0.06, 0.4); }
    const ls=wobbler(trunk, 0,0,0, 0.5); for (let i=0;i<6;i++){ const a=-0.15+i*0.32, d=V3(0,Math.sin(a),-Math.cos(a)); spike(ls, cm, d.clone().multiply(V3(0,0.46,0.44)).add(V3(0,TORSO_Y,0)), d.clone().add(V3(0,-0.25,0)), 0.17-i*0.015, 0.06, 0.4); } }
  if (sp==='chipmunk'||sp==='gopher') for (const s of [-1,1]) mesh(sph(0.12,24,16), muzM, s*0.26,-0.18,0.36, head).scale.set(1,0.85,0.7);
  if (SH.tufts){ const tm=SH.tufts==='muzzle'?muzM:fur; for (const s of [-1,1]) for (let k=0;k<3;k++){   // fluffy cheeks sticking out the sides
    const c=mesh(new THREE.ConeGeometry(0.1,0.3,12), tm, s*(0.58-k*0.02), -0.04-k*0.09, 0.08-k*0.04, head); c.rotation.z=s*(-Math.PI/2-0.3-k*0.3); c.scale.z=0.55; } }
  if (SH.brows) for (const s of [-1,1]){ const b=mesh(sph(0.15,24,16), fur, s*0.21,0.24,0.33, head); b.scale.set(1,0.7,0.8); }
  if (SH.crest) for (let k=0;k<3;k++){ const c=mesh(new THREE.ConeGeometry(0.06,0.2,12), mat(sc.accent), (k-1)*0.07, 0.5, 0.12-Math.abs(k-1)*0.03, head); c.rotation.set(0.5,0,(1-k)*0.35); c.scale.z=0.6; }
  if (sp==='frog') for (const s of [-1,1]){ const e=mesh(sph(0.17,24,18), fur, s*0.24,0.42,0.12, head); const w=mesh(sph(0.1,20,14), mat(0xffffff), s*0.24,0.46,0.26, head); w.scale.z=0.6; mesh(sph(0.06,16,12), gloss(0x1a1414), s*0.24,0.47,0.3, head).scale.z=0.6; }
  if (sp==='tortoise'){ const sh=mesh(sph(0.5,36,20,0,TAU,0,Math.PI/2), mat(0x6a7a4a), 0,0.75,-0.32,body); sh.rotation.x=-Math.PI/2+0.2; sh.scale.set(1,1,0.8);
    for (let i=0;i<6;i++){ const a=i/6*TAU; mesh(new THREE.CylinderGeometry(0.12,0.12,0.03,6), mat(0x8a9a5a), Math.cos(a)*0.24,0.78+Math.sin(a)*0.24,-0.74,body).rotation.x=Math.PI/2; } }
  // limbs: stubby, round paws in a slightly lighter shade
  const paw=mat(shade(sc.fur, sp==='lizard'?0.05:0.06)), pad=mat(sc.muzzle);
  const arms=[]; for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*(0.38*TR[0]+0.0),0.92,0.03*TR[1]); p.userData.side=s; body.add(p);
    const a=mesh(new THREE.CapsuleGeometry(0.11,0.08,8,16), fur, s*0.03,-0.12,0, p); a.rotation.z=s*0.25; a.scale.set(lb,1,lb); const h=mesh(sph(0.12,24,16), paw, s*0.07,-0.25,0.02, p); h.scale.setScalar(pw);
    if (SH.claws) for (let k=0;k<3;k++){ const c=mesh(new THREE.ConeGeometry(0.022,0.07,8), mat(0xf4ecdc), s*0.07+(k-1)*0.045, -0.36*pw+0.02, 0.06, p); c.rotation.x=Math.PI; }
    arms.push(p); }
  const legs=[]; for (const s of [-1,1]){ const p=new THREE.Group(); p.position.set(s*0.19*Math.max(1,TR[0]),0.3,0); g.add(p);
    const lg=mesh(new THREE.CapsuleGeometry(0.13,0.05,8,16), fur, 0,-0.1,0, p); lg.scale.set(lb,1,lb);
    const fz=0.05+0.1*(ft-1), f=mesh(sph(0.15,24,16), paw, 0,-0.22,fz, p); f.scale.set(0.92+0.08*ft,0.58,1.25*ft);
    const pd=mesh(sph(0.085,16,12), pad, 0,-0.21,fz+0.1875*ft-0.018, p, false); pd.scale.set(1,0.75,0.25);
    if (SH.toes) for (let k=0;k<3;k++) mesh(sph(0.045,12,10), paw, (k-1)*0.08, -0.24, fz+0.17*ft, p).scale.set(1,0.7,1);
    legs.push(p); }
  buildOutfit(trunk, arms, outfit, ocol, sc);
  dressUp(trunk, head, look.acc, look.accC);
  const tail = (npc && ['fox','otter','tortoise'].includes(sp) && opts.keeperTails===false) ? null : buildTail(body, sp, sc);
  if (tail) tail.position.z*=TR[1];
  if (felt) g.traverse(o=>{ if (o.isMesh && o.material.userData.char && !o.material.transparent && o.material.roughness>0.4) o.material=feltMat(o.material); });
  const hand=new THREE.Group(); hand.position.set(0.07,-0.27,0.06); arms[1].add(hand);
  mergeRig(g, [g, body, headRig, ...wob, ...arms, ...legs, ...ears, ...(tail?[tail]:[]), hand]);
  for (const c of g.children) c.userData.model=true;
  g.userData={ wobble:wob, body, head:headRig, arms, legs, ears, tail, hand, v2:true, species:sp };
  return g;
}

/* ---------- resident looks: random per island, but the same every visit ---------- */
function h32(str){ let h=2166136261; for (let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
// idx: the resident's place in the town list. Species are dealt from a shuffled deck per island, so neighbors don't repeat.
export function residentLook(islandSeed, id, idx=-1){ const L=randomLook(rng(h32(String(islandSeed)+':'+id)), 0.22);
  if (idx>=0){ const r=rng(h32(String(islandSeed)+':deck')), deck=SPECIES_IDS.slice(); for (let i=deck.length-1;i>0;i--){ const j=Math.floor(r()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
    L.sp=deck[idx%deck.length]; L.c=Math.min(L.c, SPECIES[L.sp].schemes.length-1); }
  return L; }
