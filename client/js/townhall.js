// v1.41 the town hall's inside: Clementine's office desk, the island crest, the Island Records board, a wall of islander
// portraits, a table with a map of the island, benches for town meetings, and on the Grand Town Hall columns, a chandelier,
// a long runner and a trophy case. main.js builds the room around these (makeHallRoom) and fills the boards when you walk in.
import * as THREE from 'three';
import { TAU } from './util.js';
import { M, mk, G, glowMat, addGlow, FURN_BUILDERS, buildRoom } from './models.js';
import { SPECIES } from './chars.js';

const WOOD=0xa8754a, WOOD2=0x8b5e3a, WOODD=0x6a4a32, CORK=0xc8955a, BLUE=0x4a7ad8, GOLD=0xe0b450;
export const HALL_ROOM = [null, { W:12, D:10 }, { W:16, D:12 }];

const canvasMat = (cv, o={}) => { const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return new THREE.MeshStandardMaterial(Object.assign({ map:t, roughness:0.85 }, o)); };
const newCanvas = (w,h) => { const c=document.createElement('canvas'); c.width=w; c.height=h; return c; };
const refresh = mat => { if (mat && mat.map) mat.map.needsUpdate=true; };
function roundRect(x, X, Y, w, h, r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }
const col = c => '#'+new THREE.Color(c).getHexString();

/* ---------- pieces ---------- */
// the island crest on the back wall: a blue banner with a shell and the island's name
function crest(name, big){
  const g=new THREE.Group(), w=big?3.0:2.4, h=big?2.0:1.6, cv=newCanvas(512, 340), x=cv.getContext('2d');
  const draw=n=>{ x.clearRect(0,0,512,340); x.fillStyle='#3a62b8'; x.beginPath(); x.moveTo(0,0); x.lineTo(512,0); x.lineTo(512,270); x.lineTo(256,340); x.lineTo(0,270); x.closePath(); x.fill();
    x.strokeStyle='#e8c060'; x.lineWidth=14; x.stroke();
    x.fillStyle='#fff4dc'; x.save(); x.translate(256,120); for (let i=-3;i<=3;i++){ x.save(); x.rotate(i*0.24); x.beginPath(); x.ellipse(0,-12,15,62,0,0,TAU); x.fill(); x.restore(); } x.restore();
    x.fillStyle='#e8c060'; x.beginPath(); x.arc(256,178,20,0,TAU); x.fill();
    x.fillStyle='#fff4dc'; x.textAlign='center'; x.textBaseline='middle'; let fs=46; x.font=`700 ${fs}px Fredoka, sans-serif`; const t=String(n||'Our island').slice(0,22);
    while (x.measureText(t).width>440 && fs>24){ fs-=2; x.font=`700 ${fs}px Fredoka, sans-serif`; } x.fillText(t,256,248); };
  draw(name); const mat=canvasMat(cv);
  const shape=mk(G.box(w,h,0.05), mat, 0,0,0.04,g); shape.castShadow=false;
  mk(G.cyl(0.04,0.04,w+0.4,8), M(GOLD,{metalness:0.6,roughness:0.35}), 0,h/2+0.06,0.06,g).rotation.z=Math.PI/2;
  for (const s of [-1,1]) mk(G.sph(0.07,10,8), M(GOLD,{metalness:0.6,roughness:0.35}), s*(w/2+0.2),h/2+0.06,0.06,g);
  g.userData.setName=n=>{ draw(n); refresh(mat); }; return g; }
// a little standing flag
function flag(c){ const g=new THREE.Group(); mk(G.cyl(0.18,0.22,0.12,12), M(WOODD), 0,0.06,0,g); mk(G.cyl(0.03,0.03,2.4,8), M(GOLD,{metalness:0.6,roughness:0.35}), 0,1.2,0,g);
  mk(G.sph(0.06,10,8), M(GOLD,{metalness:0.6,roughness:0.35}), 0,2.44,0,g); const f=mk(G.box(0.9,0.6,0.02), M(c), 0.46,2.05,0,g); f.castShadow=false; g.userData.cloth=f; return g; }
// Clementine's desk: wide, with a green leather top, papers, a stamp, an inkwell and a brass bell
function desk(big){ const g=new THREE.Group(), w=big?3.2:2.6, d=0.95;
  mk(G.box(w,0.86,d), M(WOOD2), 0,0.43,0,g); mk(G.box(w+0.14,0.07,d+0.12), M(WOOD), 0,0.9,0,g); mk(G.box(w-0.3,0.012,d-0.25), M(0x3f7a55), 0,0.94,0,g);
  for (const s of [-1,1]) mk(G.box(0.7,0.6,0.02), M(WOOD), s*(w/2-0.55),0.45,d/2+0.01,g);
  mk(G.box(0.9,0.3,0.03), M(0xfff1d6), 0,0.6,d/2+0.02,g);   // name plate panel
  const pl=newCanvas(256,96), px=pl.getContext('2d'); px.fillStyle='#fff1d6'; px.fillRect(0,0,256,96); px.fillStyle='#5b4336'; px.font='700 34px Fredoka, sans-serif'; px.textAlign='center'; px.textBaseline='middle'; px.fillText('Island Office',128,50);
  mk(G.box(0.86,0.28,0.01), canvasMat(pl), 0,0.6,d/2+0.04,g);
  for (let i=0;i<3;i++){ const p=mk(G.box(0.34,0.012,0.44), M(0xfffaf0), -w/2+0.6+i*0.05, 0.955+i*0.012, -0.05+i*0.03, g); p.rotation.y=0.1*i-0.1; p.castShadow=false; }
  mk(G.cyl(0.06,0.07,0.08,10), M(0x2a2a3a), w/2-0.55,0.99,-0.1,g); mk(G.cyl(0.012,0.012,0.22,6), M(0xffffff), w/2-0.5,1.07,-0.12,g).rotation.z=-0.4;
  const st=new THREE.Group(); st.position.set(-0.2,0.95,0.12); g.add(st); mk(G.cyl(0.06,0.07,0.05,10), M(0xc0503a), 0,0.025,0,st); mk(G.cyl(0.025,0.025,0.1,8), M(WOODD), 0,0.1,0,st); mk(G.sph(0.045,10,8), M(WOODD), 0,0.17,0,st);
  const bell=new THREE.Group(); bell.position.set(0.45,0.95,0.2); g.add(bell); mk(G.cyl(0.09,0.1,0.02,14), M(WOODD), 0,0.01,0,bell); mk(G.sph(0.08,14,10,0,TAU,0,Math.PI/2), M(GOLD,{metalness:0.7,roughness:0.3}), 0,0.02,0,bell); mk(G.sph(0.018,8,6), M(GOLD,{metalness:0.7,roughness:0.3}), 0,0.11,0,bell);
  g.userData.size=[w+0.2, d+0.2]; return g; }
// a cork board for the Island Records, with pinned cards (drawn by drawRecords)
function recordsBoard(){ const g=new THREE.Group(), w=2.6, h=1.6, cv=newCanvas(640, 400), mat=canvasMat(cv);
  mk(G.box(w+0.16,h+0.16,0.08), M(WOODD), 0,0,0,g); mk(G.box(w,h,0.03), mat, 0,0,0.05,g);
  const cap=newCanvas(512,96), cx=cap.getContext('2d'); cx.fillStyle='#5b4336'; cx.fillRect(0,0,512,96); cx.fillStyle='#fff1d6'; cx.font='700 52px Fredoka, sans-serif'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText('Island Records',256,52);
  mk(G.box(1.5,0.3,0.05), canvasMat(cap), 0,h/2+0.26,0.02,g);
  g.userData.canvas=cv; g.userData.mat=mat; return g; }
export function drawRecords(board, cards){ const cv=board.userData.canvas, x=cv.getContext('2d'); x.fillStyle=col(CORK); x.fillRect(0,0,640,400);
  for (let i=0;i<260;i++){ x.fillStyle=`rgba(${90+Math.random()*60|0},${50+Math.random()*40|0},20,0.18)`; x.fillRect(Math.random()*640, Math.random()*400, 3, 3); }
  const tints=['#fff8ea','#fdf0c8','#e8f4ff','#f4e8ff','#e8ffe8','#ffe8e0'];
  cards.slice(0,6).forEach((c,i)=>{ const cx=26+(i%3)*204, cy=24+Math.floor(i/3)*190, tilt=((i*37)%7-3)*0.012; x.save(); x.translate(cx+92,cy+82); x.rotate(tilt);
    x.fillStyle='rgba(0,0,0,0.18)'; x.fillRect(-88,-74,184,160); x.fillStyle=tints[i%tints.length]; x.fillRect(-92,-80,184,160);
    x.fillStyle='#8a6a4a'; x.font='600 22px Fredoka, sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText(c[0],0,-46);
    x.fillStyle='#3a2e28'; let fs=54; x.font=`700 ${fs}px Fredoka, sans-serif`; while (x.measureText(c[1]).width>168 && fs>26){ fs-=2; x.font=`700 ${fs}px Fredoka, sans-serif`; } x.fillText(c[1],0,8);
    if (c[2]){ x.fillStyle='#8a7a6a'; x.font='500 19px Fredoka, sans-serif'; x.fillText(c[2],0,54); }
    x.fillStyle='#d8504a'; x.beginPath(); x.arc(0,-72,8,0,TAU); x.fill(); x.restore(); });
  refresh(board.userData.mat); }
// the islanders' portraits, two rows of little framed heads with names (drawn by drawPortraits)
function portraitWall(){ const g=new THREE.Group(), w=3.4, h=1.7, cv=newCanvas(800, 400), mat=canvasMat(cv, { transparent:true });
  mk(G.box(w,h,0.02), mat, 0,0,0.02,g).castShadow=false;
  const cap=newCanvas(512,96), cx=cap.getContext('2d'); cx.fillStyle='#5b4336'; cx.fillRect(0,0,512,96); cx.fillStyle='#fff1d6'; cx.font='700 50px Fredoka, sans-serif'; cx.textAlign='center'; cx.textBaseline='middle'; cx.fillText('Our islanders',256,52);
  mk(G.box(1.4,0.28,0.05), canvasMat(cap), 0,h/2+0.22,0.02,g);
  g.userData.canvas=cv; g.userData.mat=mat; return g; }
const EARS = { hedgehog:'round', rabbit:'long', raccoon:'point', squirrel:'point', chipmunk:'round', dog:'flop', cat:'point', gopher:'round', lizard:'none', bear:'round', lion:'round' };
export function drawPortraits(wall, list){ const cv=wall.userData.canvas, x=cv.getContext('2d'); x.clearRect(0,0,800,400);
  const n=Math.max(1,list.length), per=Math.min(5, Math.ceil(n/2)||1), rows=n>5?2:1;
  list.slice(0,10).forEach((p,i)=>{ const r=Math.floor(i/per), c=i%per, inRow=Math.min(per, n-r*per), fw=140, fh=180, gap=(800-inRow*fw)/(inRow+1);
    const X=gap+c*(fw+gap), Y=rows===1?110:10+r*196;
    x.fillStyle='#8b5e3a'; roundRect(x,X,Y,fw,fh,10); x.fill(); x.fillStyle='#e8c060'; roundRect(x,X+6,Y+6,fw-12,fh-12,8); x.fill(); x.fillStyle=p.bg||'#d8ecf4'; roundRect(x,X+12,Y+12,fw-24,fh-52,6); x.fill();
    const hx=X+fw/2, hy=Y+76, fur=col(p.fur), acc=col(p.accent), muz=col(p.muzzle), ear=EARS[p.sp]||'round';
    x.fillStyle=col(p.shirt||0x6a9ad8); roundRect(x,hx-38,hy+30,76,40,16); x.fill();
    x.fillStyle=fur; if (ear==='long') for (const s of [-1,1]){ x.beginPath(); x.ellipse(hx+s*16,hy-48,11,30,s*0.15,0,TAU); x.fill(); }
    else if (ear==='point') for (const s of [-1,1]){ x.beginPath(); x.moveTo(hx+s*12,hy-28); x.lineTo(hx+s*36,hy-56); x.lineTo(hx+s*38,hy-18); x.fill(); }
    else if (ear==='flop') for (const s of [-1,1]){ x.beginPath(); x.ellipse(hx+s*36,hy-6,11,22,s*0.5,0,TAU); x.fill(); }
    else if (ear==='big') for (const s of [-1,1]){ x.beginPath(); x.arc(hx+s*30,hy-32,20,0,TAU); x.fill(); }
    else if (ear==='round') for (const s of [-1,1]){ x.beginPath(); x.arc(hx+s*28,hy-30,13,0,TAU); x.fill(); }
    x.beginPath(); x.arc(hx,hy,38,0,TAU); x.fill();
    x.fillStyle=acc; if (ear!=='none' && ear!=='flop') for (const s of [-1,1]){ x.beginPath(); x.arc(hx+s*(ear==='long'?16:28),hy-(ear==='long'?44:30),5,0,TAU); x.fill(); }
    x.fillStyle=muz; x.beginPath(); x.ellipse(hx,hy+14,20,14,0,0,TAU); x.fill();
    x.fillStyle='#2a1e1a'; for (const s of [-1,1]){ x.beginPath(); x.arc(hx+s*13,hy-4,4.5,0,TAU); x.fill(); } x.fillStyle=col(p.nose||0x2a1e1a); x.beginPath(); x.ellipse(hx,hy+8,5,3.5,0,0,TAU); x.fill();
    x.fillStyle='rgba(255,120,120,0.35)'; for (const s of [-1,1]){ x.beginPath(); x.arc(hx+s*24,hy+10,6,0,TAU); x.fill(); }
    x.fillStyle='#fff1d6'; roundRect(x,X+14,Y+fh-38,fw-28,26,5); x.fill(); x.fillStyle='#5b4336'; let fs=20; x.font=`600 ${fs}px Fredoka, sans-serif`; x.textAlign='center'; x.textBaseline='middle';
    while (x.measureText(p.name).width>fw-34 && fs>12){ fs--; x.font=`600 ${fs}px Fredoka, sans-serif`; } x.fillText(p.name,hx,Y+fh-25); });
  refresh(wall.userData.mat); }
export const lookColors = L => { const S=SPECIES[L.sp]||SPECIES.rabbit, sc=S.schemes[L.c]||S.schemes[0]; return { sp:L.sp, fur:sc.fur, muzzle:sc.muzzle, accent:sc.accent, nose:sc.nose }; };
// a long table with a map of the island laid on it (the map is drawn onto mapCanvas)
function mapTable(big){ const g=new THREE.Group(), w=big?2.6:2.2, d=big?1.7:1.4, cv=newCanvas(512,512), mat=canvasMat(cv, { roughness:0.6 });
  mk(G.box(w,0.08,d), M(WOOD), 0,0.82,0,g); for (const sx of [-1,1]) for (const sz of [-1,1]) mk(G.box(0.1,0.8,0.1), M(WOOD2), sx*(w/2-0.12),0.4,sz*(d/2-0.12),g);
  const m=mk(G.box(Math.min(w,d)*0.95,0.012,Math.min(w,d)*0.95), mat, 0,0.866,0,g); m.castShadow=false;
  for (const s of [-1,1]){ const sc=mk(G.cyl(0.045,0.045,0.42,10), M(0xf2e6c8), s*(w/2-0.28),0.9,0,g); sc.rotation.x=Math.PI/2; }   // rolled-up charts at the ends
  mk(G.cyl(0.05,0.03,0.16,8), M(GOLD,{metalness:0.6,roughness:0.3}), w/2-0.25,0.94,d/2-0.25,g);   // a brass weight
  g.userData.canvas=cv; g.userData.mat=mat; g.userData.size=[w+0.1,d+0.1]; return g; }
export const mapRefresh = t => refresh(t.userData.mat);
// a trophy case for the Grand Town Hall: one little prize for every ten achievements (up to eight)
function trophyCase(){ const g=new THREE.Group(); mk(G.box(1.8,0.5,0.6), M(WOOD2), 0,0.25,0,g); mk(G.box(1.8,1.3,0.56), new THREE.MeshStandardMaterial({ color:0xd8f0ff, transparent:true, opacity:0.25, roughness:0.1 }), 0,1.15,0,g).castShadow=false;
  mk(G.box(1.86,0.08,0.62), M(WOOD), 0,1.84,0,g); for (const sx of [-1,1]) mk(G.box(0.06,1.3,0.58), M(WOOD), sx*0.9,1.15,0,g); mk(G.box(1.7,0.03,0.5), M(WOODL()), 0,1.12,0,g);
  const prizes=new THREE.Group(); g.add(prizes); g.userData.prizes=prizes; return g; }
function WOODL(){ return 0xc99a6a; }
export function setTrophies(tc, n){ const P=tc.userData.prizes; while (P.children.length) P.remove(P.children[0]);
  const kinds=[0xe0b450,0xc8c8d0,0xd8905a,0x7ac0e0,0xc0a0e8,0x8ad08a,0xf09090,0xf0d070];
  for (let i=0;i<Math.min(n,8);i++){ const x=-0.66+(i%4)*0.44, y=i<4?0.55:1.15, c=kinds[i], g=new THREE.Group(); g.position.set(x,y,0); P.add(g);
    if (i%3===0){ mk(G.cyl(0.05,0.07,0.06,10), M(WOODD), 0,0.03,0,g); mk(G.cyl(0.1,0.04,0.16,12), M(c,{metalness:0.7,roughness:0.3}), 0,0.16,0,g); for (const s of [-1,1]) mk(G.tor(0.04,0.012,6,12), M(c,{metalness:0.7,roughness:0.3}), s*0.1,0.18,0,g).rotation.y=Math.PI/2; }
    else if (i%3===1){ mk(G.cyl(0.07,0.07,0.03,12), M(WOODD), 0,0.015,0,g); const m=mk(G.cyl(0.09,0.09,0.02,16), M(c,{metalness:0.7,roughness:0.3}), 0,0.13,0,g); m.rotation.x=Math.PI/2; mk(G.box(0.02,0.1,0.02), M(0x4a7ad8), 0,0.06,0,g); }
    else { mk(G.box(0.12,0.04,0.08), M(WOODD), 0,0.02,0,g); mk(G.ico(0.08,0), M(c,{metalness:0.4,roughness:0.2}), 0,0.12,0,g); } } }
// a chandelier for the Grand Town Hall
// (kept small and up by the ceiling: the camera looks down into the room, so anything hanging low hides the floor)
function chandelier(){ const g=new THREE.Group(), brass=M(GOLD,{metalness:0.65,roughness:0.3}); mk(G.cyl(0.015,0.015,0.3,6), brass, 0,0.15,0,g); const ring=mk(G.tor(0.34,0.025,6,24), brass, 0,0,0,g); ring.rotation.x=Math.PI/2;
  for (let i=0;i<6;i++){ const a=i/6*TAU, c=new THREE.Group(); c.position.set(Math.cos(a)*0.34,0,Math.sin(a)*0.34); g.add(c); mk(G.cyl(0.018,0.018,0.1,8), M(0xfff8ea), 0,0.06,0,c); mk(G.sph(0.022,8,6), glowMat(0xffd080), 0,0.13,0,c); }
  addGlow(g, 0.1, 1.0, 0xffd08a); return g; }
function column(h){ const g=new THREE.Group(); mk(G.box(0.62,0.18,0.62), M(0xe8e0d0), 0,0.09,0,g); mk(G.cyl(0.22,0.24,h-0.36,16), M(0xf4efe4), 0,h/2,0,g); mk(G.box(0.6,0.18,0.6), M(0xe8e0d0), 0,h-0.09,0,g); return g; }
function runner(len){ const g=new THREE.Group(); mk(G.box(1.5,0.02,len), M(0xb04a4a), 0,0.012,0,g).castShadow=false; for (const s of [-1,1]) mk(G.box(0.08,0.022,len), M(GOLD), s*0.68,0.013,0,g).castShadow=false; return g; }

/* ---------- the whole room ----------
   Returns the shell (walls, floor and the fixed pieces), plus the pieces main.js turns into things you can walk up to,
   and the rectangles you can't walk through (local to the room's middle). */
export function buildHallRoom(tier, island){
  const big=tier>=2, { W, D }=HALL_ROOM[Math.min(2,Math.max(1,tier))];
  const shell=buildRoom({ floor:big?0xb88a5a:0xc89a6a, wall:big?0xf4eee0:0xfff3dc, pattern:big?'check':'stripe', accent:BLUE }, W, D);
  const cw=shell.userData.cutWalls, back=cw[0].hide, left=(cw[1].hide=cw[1].hide||[]), right=(cw[2].hide=cw[2].hide||[]);
  const add=(o,x,y,z,ry=0,list=null)=>{ o.position.set(x,y,z); o.rotation.y=ry; shell.add(o); if (list) list.push(o); return o; };
  const solid=[];   // [x0,z0,x1,z1] you can't walk through
  const box=(x,z,w,d)=>solid.push([x-w/2,z-d/2,x+w/2,z+d/2]);
  // the back: crest between two flags, Clementine's desk in front of it
  const cr=add(crest(island, big), 0, big?2.0:1.85, -D/2+0.02, 0, back);
  for (const s of [-1,1]){ const f=add(flag(s<0?BLUE:0xe0745a), s*(big?2.2:1.85), 0, -D/2+0.45, s<0?0:Math.PI); }
  box(-(big?2.2:1.85), -D/2+0.45, 0.5, 0.5); box(big?2.2:1.85, -D/2+0.45, 0.5, 0.5);
  const dk=desk(big), deskZ=-D/2+2.1; add(dk, 0, 0, deskZ); box(0, deskZ, dk.userData.size[0], dk.userData.size[1]);
  const clerkAt=[0, -D/2+1.15];
  // left wall: the Island Records board; right wall: the islanders' portraits
  const board=recordsBoard(); add(board, -W/2+0.06, 1.75, -0.6, Math.PI/2, left);
  const wall=portraitWall(); add(wall, W/2-0.04, 1.75, -0.6, -Math.PI/2, right);
  // bookshelves with the island's ledgers in the back corners
  for (const s of [-1,1]){ const b=new THREE.Group(); FURN_BUILDERS.bookshelf(b); add(b, s*(W/2-0.75), 0, -D/2+0.45, 0); box(s*(W/2-0.75), -D/2+0.45, 1.4, 0.7); }
  // the map table in the middle, benches for town meetings in front
  const mt=mapTable(big), mapAt=[0, big?-0.2:0.1]; add(mt, mapAt[0], 0, mapAt[1]); box(mapAt[0], mapAt[1], mt.userData.size[0], mt.userData.size[1]);
  const rows = big ? [D/2-3.6, D/2-2.0] : [D/2-2.4];
  for (const z of rows) for (const s of [-1,1]){ const bx=s*(big?3.6:3.0); const b=new THREE.Group(); FURN_BUILDERS.bench(b); add(b, bx, 0, z, Math.PI); box(bx, z, 1.8, 0.7); if (big){ const b2=new THREE.Group(); FURN_BUILDERS.bench(b2); add(b2, bx+s*1.9, 0, z, Math.PI); box(bx+s*1.9, z, 1.8, 0.7); } }
  for (const s of [-1,1]){ const p=new THREE.Group(); FURN_BUILDERS[big?'monstera':'plant'](p); add(p, s*(W/2-0.6), 0, D/2-0.7); box(s*(W/2-0.6), D/2-0.7, 0.7, 0.7);
    const l=new THREE.Group(); FURN_BUILDERS.floorlamp(l); add(l, s*(W/2-0.55), 0, deskZ+0.2); box(s*(W/2-0.55), deskZ+0.2, 0.5, 0.5); }
  let trophies=null;
  if (big){
    add(runner(D-3.2), 0, 0, 1.0);
    for (const sx of [-1,1]) for (const z of [-D/2+3.4, D/2-1.2]){ add(column(3.2), sx*(W/2-2.0), 0, z); box(sx*(W/2-2.0), z, 0.62, 0.62); }
    for (const cz of [-D/2+3.4, D/2-1.2]) add(chandelier(), 0, 2.95, cz);
    const gf=new THREE.Group(); FURN_BUILDERS.grandfather(gf); add(gf, -W/2+0.55, 0, 2.2, Math.PI/2); box(-W/2+0.55, 2.2, 0.7, 0.8);
    trophies=trophyCase(); add(trophies, W/2-0.5, 0, 2.4, -Math.PI/2); box(W/2-0.5, 2.4, 0.7, 1.9);
    const gl=new THREE.Group(); FURN_BUILDERS.globe(gl); add(gl, -2.0, 0, deskZ+0.1); box(-2.0, deskZ+0.1, 0.6, 0.6);
    const lt=new THREE.PointLight(0xffe0b0, 22, 16, 1.6); lt.position.set(0,2.4,mapAt[1]); lt.castShadow=false; shell.add(lt);
  } else { const gl=new THREE.Group(); FURN_BUILDERS.globe(gl); add(gl, -W/2+0.6, 0, 1.6); box(-W/2+0.6, 1.6, 0.6, 0.6); }
  return { shell, W, D, solid, board, wall, map:mt, mapAt, crest:cr, trophies, clerkAt, deskZ,
    boardSpot:[-W/2+0.06, -0.6], wallSpot:[W/2-0.04, -0.6] }; }
