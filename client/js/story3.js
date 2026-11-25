/* =====================================================================
   v1.39 ISLAND STORIES PHASE 3: models only (main.js decides what happens).
   - mill things: sailcloth, the new sails, flour, a country loaf (the windmill itself is dressed in expand.js)
   - Wren's post office
   - Tobin's hot spring: steam vents, the open pool, the bathhouse with its steam room and rock pools, bath salts
   - Lumi's glade: the firefly swarm, the glade stones, the glow jar
   - Hazel's wreck: the diving bell, the wreck inside (deck, hold, cabin, vault), the antiques shop, salvage furniture
   - keepsakes the trade-route towns send by post
   ===================================================================== */
import * as THREE from 'three';
import { TAU, mulberry32 } from './util.js';
import { M, mk, G, glowMat, addGlow, ITEM_BUILDERS, FURN_BUILDERS } from './models.js';
import { tmat, tbox, mergeStatic, cottageRoof, window1, wallLantern, chimney1, hangingSign, scallopAwning, mossTop, barrel1, flowerBed1, sack, pot } from './cottage.js';

const IRON = () => M(0x3a3a42, { metalness:0.55, roughness:0.45 });
const BRASS = () => M(0xd0a048, { metalness:0.7, roughness:0.3 });
const OAK = () => M(0x7a5232, { roughness:0.85 });
const OLDWOOD = () => M(0x5a4a3a, { roughness:1 });
const glass = (c=0xbfe8f4, o=0.3) => new THREE.MeshPhysicalMaterial({ color:c, transparent:true, opacity:o, roughness:0.05, metalness:0, depthWrite:false, side:THREE.DoubleSide });
const warmWater = () => new THREE.MeshStandardMaterial({ color:0x7ac8c8, roughness:0.08, metalness:0.1, transparent:true, opacity:0.88 });
function label(text, w=256, h=96, bg='#f4e6c8', fg='#5b4336', px=40){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const x=cv.getContext('2d'); x.fillStyle=bg; x.fillRect(0,0,w,h); x.fillStyle=fg; x.textAlign='center'; x.textBaseline='middle';
  x.font=`700 ${px}px Fredoka, sans-serif`; x.fillText(text, w/2, h/2+2); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map:t, roughness:0.85 }); }

/* ---------- bag things ---------- */
ITEM_BUILDERS.sailcloth = (g) => { const c=M(0xeee4cc,{ roughness:0.95 }); const roll=mk(G.cyl(0.16,0.16,0.7,14), c, 0,0.17,0,g); roll.rotation.z=Math.PI/2;
  mk(G.cyl(0.165,0.165,0.02,14), M(0xd8ccb0), 0.36,0.17,0,g).rotation.z=Math.PI/2; for (const x of [-0.2,0.2]){ const t=mk(G.tor(0.165,0.014,5,16), M(0xa8875a), x,0.17,0,g); t.rotation.y=Math.PI/2; } };
ITEM_BUILDERS.millsails = (g) => { for (let i=0;i<4;i++){ const s=mk(G.box(0.5,0.04,0.9), M(0xf4ecd8), 0,0.04+i*0.05,0,g); s.rotation.y=i*0.12; mk(G.box(0.06,0.05,0.95), OAK(), -0.22,0.06+i*0.05,0,g).rotation.y=i*0.12; }
  const t=mk(G.tor(0.3,0.015,4,16), M(0xa8875a), 0,0.12,0,g); t.rotation.x=Math.PI/2; t.scale.set(0.9,1.6,1); };
ITEM_BUILDERS.flour = (g) => { sack(g, 0, 0, 0xf0e8d8, null); mk(G.box(0.22,0.12,0.01), M(0xd8b060), 0,0.24,0.21,g); };
ITEM_BUILDERS.bread = (g) => { const b=mk(G.cap(0.14,0.3,4,12), M(0xc88a4a), 0,0.14,0,g); b.rotation.z=Math.PI/2; b.scale.set(1,0.85,1); for (let i=0;i<3;i++){ const c=mk(G.box(0.02,0.012,0.18), M(0xf0d090), -0.12+i*0.12,0.26,0,g); c.rotation.y=0.5; } };
ITEM_BUILDERS.bathsalts = (g) => { mk(G.cyl(0.14,0.14,0.28,14), glass(0xeef8f8,0.35), 0,0.15,0,g); mk(G.cyl(0.125,0.125,0.2,14), M(0xe8b8d8,{ roughness:0.9 }), 0,0.12,0,g);
  for (let i=0;i<6;i++) mk(G.ico(0.02,0), M([0x9a7ad8,0x7cd8a0,0xf8d040][i%3]), Math.cos(i)*0.07,0.21,Math.sin(i)*0.07,g); mk(G.cyl(0.08,0.07,0.07,10), M(0xa8784a), 0,0.32,0,g); };
ITEM_BUILDERS.crowbar = (g) => { const ir=IRON(); const bar=mk(G.cyl(0.025,0.025,0.8,8), ir, 0,0.05,0,g); bar.rotation.z=Math.PI/2; const hook=mk(G.tor(0.08,0.025,6,10,Math.PI), ir, 0.4,0.12,0,g); hook.rotation.z=-Math.PI/2;
  mk(G.box(0.08,0.02,0.06), ir, -0.43,0.05,0,g); };
ITEM_BUILDERS.wrecklens = (g) => { const r=mk(G.tor(0.18,0.03,8,24), BRASS(), 0,0.22,0,g); mk(G.cyl(0.17,0.17,0.05,24), glass(0xd8f0ff,0.55), 0,0.22,0,g).rotation.x=Math.PI/2; r.rotation.y=0; mk(G.box(0.08,0.1,0.04), BRASS(), 0,0.04,0,g); addGlow(g, 0.22, 0.6, 0xd8f0ff); };
ITEM_BUILDERS.chartpiece = (g) => { const sh=new THREE.Shape(); sh.moveTo(-0.25,-0.2); sh.lineTo(0.28,-0.22); sh.lineTo(0.2,0.12); sh.lineTo(0.05,0.24); sh.lineTo(-0.27,0.18); sh.lineTo(-0.25,-0.2);
  const p=mk(new THREE.ShapeGeometry(sh), M(0xe8d8a8,{ side:THREE.DoubleSide, roughness:1 }), 0,0.02,0,g); p.rotation.x=-Math.PI/2;
  const ink=M(0x6a4a2a); for (let i=0;i<4;i++){ const l=mk(G.box(0.012,0.003,0.3), ink, 0,0.026,0,g); l.rotation.y=i*Math.PI/4; } mk(G.tor(0.08,0.008,4,16), ink, 0,0.027,0,g).rotation.x=Math.PI/2;
  mk(G.box(0.03,0.004,0.03), M(0xc8302a), 0.12,0.028,-0.08,g).rotation.y=0.78; };

/* ---------- furniture ---------- */
Object.assign(FURN_BUILDERS, {
  glowjar(g){ mk(G.cyl(0.18,0.2,0.42,16), glass(0xeefaf0,0.28), 0,0.23,0,g); mk(G.cyl(0.13,0.15,0.06,12), M(0xa8784a), 0,0.47,0,g); const h=mk(G.tor(0.09,0.012,5,12,Math.PI), IRON(), 0,0.5,0,g);
    const lit=glowMat(0xd8ff6a); for (let i=0;i<7;i++) mk(G.sph(0.022,6,5), lit, Math.cos(i*2.4)*0.09, 0.1+i*0.045, Math.sin(i*2.4)*0.09, g); mk(G.box(0.2,0.012,0.08), M(0x5f8a3c), 0,0.03,0,g); addGlow(g, 0.25, 1.0, 0xd8ff6a); },
  shipwheel(g){ const w=OAK(), br=BRASS(); mk(G.box(0.3,0.8,0.24), w, 0,0.4,0,g); const hub=new THREE.Group(); hub.position.set(0,1.0,0.16); g.add(hub);
    mk(G.tor(0.42,0.04,8,24), w, 0,0,0,hub); mk(G.cyl(0.08,0.08,0.1,12), br, 0,0,0,hub).rotation.x=Math.PI/2;
    for (let i=0;i<8;i++){ const a=i/8*TAU, s=mk(G.cyl(0.022,0.022,0.84,6), w, 0,0,0,hub); s.rotation.z=a; const hd=mk(G.cyl(0.03,0.02,0.18,6), w, Math.sin(a)*0.52, Math.cos(a)*0.52, 0, hub); hd.rotation.z=-a; } },
  figurehead(g){ const w=M(0xc8a070,{ roughness:0.8 }), paint=M(0x5a8ab8); mk(G.box(0.5,0.1,0.5), OAK(), 0,0.05,0,g); const fg=new THREE.Group(); fg.position.y=0.1; fg.rotation.x=-0.25; g.add(fg);
    const tail=mk(G.cone(0.16,0.6,10), paint, 0,0.3,0,fg); tail.rotation.x=Math.PI; mk(G.cone(0.14,0.18,4), paint, 0,0.04,0.06,fg).rotation.x=1.2;
    mk(G.cap(0.13,0.35,4,10), w, 0,0.8,0,fg); mk(G.sph(0.12,12,10), w, 0,1.18,0.04,fg); const hair=mk(G.sph(0.15,10,8,0,TAU,0,Math.PI*0.6), M(0x8a4a2a), 0,1.2,-0.02,fg); hair.scale.set(1,1.2,1.1);
    for (const s of [-1,1]){ const arm=mk(G.cap(0.04,0.3,3,6), w, s*0.17,0.86,0.04,fg); arm.rotation.z=-s*0.3; arm.rotation.x=-0.5; } },
  seachest(g){ const w=M(0x6a4a2a), ir=IRON(); mk(G.box(0.9,0.42,0.55), w, 0,0.21,0,g); const lid=mk(G.cyl(0.275,0.275,0.9,14,1,false,0,Math.PI), w, 0,0.42,0,g); lid.rotation.z=Math.PI/2; lid.rotation.y=Math.PI/2;
    for (const x of [-0.3,0.3]){ mk(G.box(0.06,0.44,0.57), ir, x,0.21,0,g); const b=mk(G.tor(0.276,0.03,4,14,Math.PI), ir, x,0.42,0,g); b.rotation.y=Math.PI/2; } mk(G.box(0.1,0.12,0.04), BRASS(), 0,0.36,0.29,g); },
  shiplantern(g){ const br=BRASS(); mk(G.cyl(0.15,0.17,0.06,8), br, 0,0.03,0,g); mk(G.cyl(0.13,0.13,0.34,8), glass(0xfff0c0,0.35), 0,0.23,0,g); for (let i=0;i<4;i++){ const a=i/4*TAU; mk(G.box(0.025,0.36,0.025), br, Math.cos(a)*0.13,0.23,Math.sin(a)*0.13,g); }
    mk(G.cone(0.17,0.16,8), br, 0,0.48,0,g); mk(G.tor(0.05,0.012,5,10), br, 0,0.6,0,g); mk(G.sph(0.06,8,6), glowMat(0xffc860), 0,0.22,0,g); addGlow(g, 0.24, 1.6, 0xffc060); },
  captaindesk(g){ const w=M(0x5a3420), top=M(0x4a2a18); mk(G.box(1.5,0.06,0.8), top, 0,0.78,0,g); for (const x of [-0.55,0.55]) mk(G.box(0.36,0.75,0.74), w, x,0.38,0,g);
    for (const x of [-0.55,0.55]) for (const y of [0.25,0.55]) mk(G.sph(0.025,6,5), BRASS(), x,y,0.38,g);
    const map=mk(G.box(0.6,0.005,0.42), M(0xe8d8a8), -0.15,0.815,0,g); map.rotation.y=0.15; mk(G.cyl(0.04,0.05,0.1,8), M(0x2a2a3a), 0.45,0.86,-0.18,g);
    const q=mk(G.box(0.02,0.24,0.01), M(0xf4f0e8), 0.48,0.95,-0.18,g); q.rotation.z=0.3; mk(G.cyl(0.05,0.05,0.04,10), BRASS(), 0.35,0.83,0.2,g); },
  shipglobe(g){ const br=BRASS(), w=OAK(); for (let i=0;i<3;i++){ const a=i/3*TAU, l=mk(G.cyl(0.025,0.02,0.6,6), w, Math.cos(a)*0.18,0.3,Math.sin(a)*0.18,g); l.rotation.set(Math.sin(a)*0.25,0,-Math.cos(a)*0.25); }
    mk(G.tor(0.26,0.02,6,24), w, 0,0.62,0,g).rotation.x=Math.PI/2; const glb=mk(G.sph(0.23,20,14), M(0x6a9ac0,{ roughness:0.6 }), 0,0.75,0,g); glb.rotation.z=0.4;
    for (let i=0;i<5;i++){ const c=mk(G.sph(0.08,8,6), M(0xd8c890), Math.cos(i*1.3)*0.17, 0.75+Math.sin(i*2.1)*0.12, Math.sin(i*1.3)*0.17, g); c.scale.set(1,0.5,0.8); }
    const m=mk(G.tor(0.27,0.012,5,24,Math.PI), br, 0,0.75,0,g); m.rotation.z=0.4; },
  treasurechest(g){ FURN_BUILDERS.seachest(g); const gold=M(0xf0c040,{ metalness:0.8, roughness:0.25 }); for (let i=0;i<9;i++) mk(G.cyl(0.05,0.05,0.015,10), gold, -0.3+(i%3)*0.3+(i>5?0.05:0), 0.66+Math.floor(i/3)*0.015, -0.05+(i%2)*0.06, g);
    mk(G.sph(0.05,8,6), M(0xd8203a,{ roughness:0.2 }), 0.15,0.7,0.05,g); mk(G.sph(0.045,8,6), M(0x30a060,{ roughness:0.2 }), -0.2,0.69,0.02,g); addGlow(g, 0.7, 1.2, 0xffd070); },
  shipbell(g){ const br=BRASS(); mk(G.box(0.12,0.9,0.12), OAK(), 0,0.45,-0.15,g); mk(G.box(0.12,0.08,0.45), OAK(), 0,0.92,0.05,g); mk(G.box(0.4,0.06,0.4), OAK(), 0,0.03,-0.1,g);
    const b=mk(G.cyl(0.08,0.16,0.26,14,1,true), br, 0,0.68,0.2,g); b.material.side=THREE.DoubleSide; mk(G.sph(0.08,12,8,0,TAU,0,Math.PI/2), br, 0,0.8,0.2,g); mk(G.sph(0.03,6,5), IRON(), 0,0.57,0.2,g);
    const rope=mk(G.cyl(0.01,0.01,0.3,4), M(0xe8dcc0), 0.05,0.45,0.22,g); rope.rotation.z=0.1; },
  dryingrack(g){ const w=M(0x9a7a50); for (const x of [-0.6,0.6]){ const a=mk(G.box(0.07,1.2,0.07), w, x,0.55,0.15,g); a.rotation.x=0.2; const b=mk(G.box(0.07,1.2,0.07), w, x,0.55,-0.15,g); b.rotation.x=-0.2; }
    mk(G.cyl(0.03,0.03,1.3,6), w, 0,1.1,0,g).rotation.z=Math.PI/2; for (let i=0;i<4;i++){ const f=mk(G.sph(0.08,8,6), M(0xc8a070), -0.45+i*0.3,0.86,0,g); f.scale.set(0.5,1.8,0.3); mk(G.cone(0.06,0.08,4), M(0xa88050), -0.45+i*0.3,0.64,0,g).rotation.x=Math.PI; mk(G.cyl(0.006,0.006,0.12,3), M(0xe8dcc0), -0.45+i*0.3,1.03,0,g); } },
  abbeybell(g){ const br=BRASS(); mk(G.cyl(0.16,0.2,0.05,12), OAK(), 0,0.025,0,g); const b=mk(G.cyl(0.06,0.14,0.22,14,1,true), br, 0,0.17,0,g); b.material.side=THREE.DoubleSide; mk(G.sph(0.06,10,8,0,TAU,0,Math.PI/2), br, 0,0.28,0,g);
    mk(G.cyl(0.025,0.03,0.22,8), M(0x5a3a24), 0,0.42,0,g); mk(G.sph(0.035,8,6), M(0x5a3a24), 0,0.55,0,g); },
  circusdrum(g){ const red=M(0xd8303a), wh=M(0xf8f0e0); mk(G.cyl(0.32,0.32,0.4,18), red, 0,0.24,0,g); for (const y of [0.05,0.43]) mk(G.cyl(0.335,0.335,0.04,18), wh, 0,y,0,g);
    for (let i=0;i<8;i++){ const a=i/8*TAU, s=mk(G.cyl(0.008,0.008,0.46,4), M(0xf0c040), Math.cos(a)*0.33,0.24,Math.sin(a)*0.33,g); s.rotation.set(Math.sin(a)*0.5,0,-Math.cos(a)*0.5); }
    for (const s of [-1,1]){ const st=mk(G.cyl(0.012,0.012,0.36,5), OAK(), s*0.1,0.5,0.05,g); st.rotation.z=s*1.2; mk(G.sph(0.025,6,5), wh, s*0.27,0.55,0.05,g); } },
  minilight(g){ const red=M(0xc8503d), wh=M(0xf4efe6); mk(G.cyl(0.2,0.24,0.08,12), M(0x9a948a), 0,0.04,0,g); for (let i=0;i<4;i++) mk(G.cyl(0.14-i*0.015,0.155-i*0.015,0.16,12), i%2?red:wh, 0,0.16+i*0.16,0,g);
    mk(G.cyl(0.1,0.1,0.12,10), glowMat(0xfff0c0), 0,0.8,0,g); mk(G.cone(0.13,0.12,10), red, 0,0.92,0,g); addGlow(g, 0.8, 1.2, 0xfff0c0); },
  smugglerlamp(g){ const ir=IRON(); mk(G.cyl(0.14,0.16,0.05,6), ir, 0,0.025,0,g); mk(G.cyl(0.12,0.12,0.3,6), glass(0x60d890,0.45), 0,0.2,0,g); for (let i=0;i<6;i++){ const a=i/6*TAU; mk(G.box(0.02,0.32,0.02), ir, Math.cos(a)*0.12,0.2,Math.sin(a)*0.12,g); }
    mk(G.cone(0.15,0.14,6), ir, 0,0.42,0,g); mk(G.box(0.1,0.12,0.01), ir, 0,0.22,0.125,g); mk(G.sph(0.05,8,6), glowMat(0x8affb0), 0,0.2,0,g); addGlow(g, 0.2, 1.2, 0x8affb0); },
  noticeboard(g){ const w=OAK(); for (const x of [-0.45,0.45]) mk(G.box(0.08,1.2,0.08), w, x,0.6,0,g); mk(G.box(1.0,0.7,0.05), M(0xa8784a), 0,0.95,0,g); const roof=mk(G.box(1.15,0.05,0.3), M(0x6a4a3a), 0,1.36,0.02,g); roof.rotation.x=0.2;
    const cols=[0xf8f0d8,0xf8e0e0,0xe0f0f8,0xf8f8c8,0xe8f8e0]; for (let i=0;i<5;i++){ const p=mk(G.box(0.22,0.26,0.01), M(cols[i]), -0.32+(i%3)*0.32, 1.1-Math.floor(i/3)*0.3, 0.035, g); p.rotation.z=(i%2?0.08:-0.06); mk(G.sph(0.015,5,4), M(0xd8302a), p.position.x,p.position.y+0.11,0.045,g); } },
});

/* ---------- Wren's post office: a little brick office with a blue awning, a big red post box and a parcel cart ---------- */
export function buildPostOffice(){
  const g=new THREE.Group(), W=5.0, D=4.0, H=2.4;
  const base=tbox('stone', 0x8a8680, W+0.3, 0.4, D+0.3, 0.8); base.position.y=0.05; g.add(base);
  const walls=new THREE.Mesh(G.box(W,H,D), tmat('brick',0xb86a50,2,1.4)); walls.position.y=0.25+H/2; walls.castShadow=walls.receiveShadow=true; g.add(walls);
  const front=new THREE.Group(); front.position.set(0,0.25,D/2+0.01); g.add(front);
  mk(G.box(1.0,1.9,0.08), M(0x2a5a8a), 1.3,1.2,D/2+0.03,g); mk(G.sph(0.04,6,5), BRASS(), 1.0,1.2,D/2+0.09,g);
  window1(front, -1.0, 1.45, 0.02, { type:'grid', shut:0x2a5a8a, size:1.2, seed:4 });
  scallopAwning(g, -1.0, 2.35, D/2+0.02, 1.9, 0.75, 0x3a6ab0, 0xfff4e4);
  const roofH=cottageRoof(g, { style:'slate', L:D, S:W, y:0.25+H, c:0x4a5a6a, trim:0x3a3e46, moss:0.2, seed:39, over:0.35 });
  const ch=chimney1(g, W/2-0.8, -0.6, 0.25, 0.25+H+roofH+0.7, 'brick', 0.02);
  hangingSign(g, 1.3, 2.6, D/2+0.02, 'Post', '#f4f0e0', '#2a5a8a', Math.PI);
  // the post box out front, and a cart of parcels by the side
  const pb=new THREE.Group(); pb.position.set(-2.1,0,D/2+1.0); g.add(pb); const red=M(0xd8302a,{ roughness:0.5 });
  mk(G.cyl(0.26,0.3,1.1,16), red, 0,0.55,0,pb); mk(G.sph(0.27,16,8,0,TAU,0,Math.PI/2), red, 0,1.1,0,pb); mk(G.box(0.28,0.04,0.02), M(0x1a1a1a), 0,0.9,0.27,pb); mk(G.cyl(0.3,0.3,0.06,16), M(0x1a1a1a), 0,0.03,0,pb);
  const cart=new THREE.Group(); cart.position.set(W/2+0.9,0,0.6); g.add(cart); mk(G.box(0.9,0.08,1.2), OAK(), 0,0.42,0,cart);
  for (const z of [-0.45,0.45]) { const wh=mk(G.cyl(0.25,0.25,0.06,12), M(0x5a3a24), 0.48,0.25,z,cart); wh.rotation.z=Math.PI/2; }
  const pc=[0xc8a070,0xd8b888,0xb89060]; for (let i=0;i<5;i++){ const b=mk(G.box(0.3+i%2*0.1,0.22,0.26), M(pc[i%3]), -0.2+(i%2)*0.38, 0.57+Math.floor(i/2)*0.22, -0.35+(i%3)*0.3, cart); b.rotation.y=i*0.3; mk(G.box(0.02,0.23,0.27), M(0xe8dcc0), b.position.x,b.position.y,b.position.z,cart).rotation.y=i*0.3; }
  wallLantern(front, -2.2, 1.9, 0.02); flowerBed1(g, -1.0, D/2+0.45, 1.6, 12);
  mergeStatic(g); g.userData.door=[1.3, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-W/2-0.1,-D/2-0.1,W/2+1.5,D/2+0.1],[-2.45,D/2+0.65,-1.75,D/2+1.35]]; g.userData.chimney=ch; return g; }

/* ---------- Tobin's hot spring ---------- */
// a crack in the ground ringed with warm stones. main.js puffs steam over the real one (and a thin wisp over the others).
export function buildVent(seed=1){
  const g=new THREE.Group(), r=mulberry32(seed), st=M(0x8a8478,{ flatShading:true, roughness:0.95 });
  for (let i=0;i<7;i++){ const a=i/7*TAU+r()*0.4, d=0.55+r()*0.15; mk(G.dod(0.16+r()*0.1), st, Math.cos(a)*d, 0.06, Math.sin(a)*d, g).rotation.set(r()*3,r()*3,0); }
  const crack=mk(G.box(0.7,0.02,0.12), M(0x3a2e28), 0,0.015,0,g); crack.rotation.y=r()*3; const c2=mk(G.box(0.35,0.02,0.08), M(0x3a2e28), 0.15,0.016,0.1,g); c2.rotation.y=crack.rotation.y+0.8;
  mk(G.cyl(0.5,0.6,0.02,14), M(0xb8a888,{ roughness:1 }), 0,0.005,0,g);
  g.userData.rects=[]; return g; }
// stage 1: the open pool (rocks, warm water). 2: the bathhouse beside it. 3: the steam room. 4: rock pools looking out to sea.
export const BATH_SEATS = [[-1.5,1.6,Math.PI*0.85],[0.2,2.2,Math.PI],[1.7,1.3,-Math.PI*0.8],[-2.0,-0.2,Math.PI*0.5]];   // sitting in the pool, local to its center
export function buildBathhouse(stage=1, seed=3){
  const g=new THREE.Group(), r=mulberry32(seed), rock=M(0x8a8680,{ flatShading:true, roughness:0.95 }), dark=M(0x6a665e,{ flatShading:true });
  // the pool sits at the front, the house behind it
  const pool=new THREE.Group(); pool.position.set(0,0,1.2); g.add(pool);
  mk(G.cyl(2.6,2.6,0.12,28), M(0x5a6a6a), 0,0.02,0,pool); const wtr=mk(G.cyl(2.45,2.45,0.04,28), warmWater(), 0,0.12,0,pool); wtr.castShadow=false; g.userData.water=wtr;
  for (let i=0;i<20;i++){ const a=i/20*TAU, d=2.6+r()*0.2, s=0.28+r()*0.22; mk(G.dod(s), i%3?rock:dark, Math.cos(a)*d, 0.12+s*0.3, Math.sin(a)*d, pool).rotation.set(r()*3,r()*3,r()*3); }
  if (stage>=2){ // a timber bathhouse with a steep cedar roof, paper-pale windows and noren curtains at the door
    const W=6.0, D=3.6, H=2.4, hs=new THREE.Group(); hs.position.set(0,0,-2.6); g.add(hs);
    const base=tbox('stone', 0x7a766e, W+0.3, 0.35, D+0.3, 0.8); base.position.y=0.05; hs.add(base);
    const walls=new THREE.Mesh(G.box(W,H,D), tmat('timber',0xc8a478,2,1.2)); walls.position.y=0.22+H/2; walls.castShadow=walls.receiveShadow=true; hs.add(walls);
    const fr=new THREE.Group(); fr.position.set(0,0.22,D/2+0.01); hs.add(fr);
    for (const x of [-2.0,2.0]) window1(fr, x, 1.4, 0.02, { type:'grid', shut:0x6a4a2a, size:1.0, seed:7 });
    mk(G.box(1.2,2.0,0.06), M(0x4a2a1a), 0,1.22,D/2+0.03,hs); for (let i=0;i<3;i++) mk(G.box(0.38,0.7,0.02), M(0x3a5a8a), -0.4+i*0.4,1.85,D/2+0.08,hs);
    cottageRoof(hs, { style:'shingle', L:D, S:W, y:0.22+H, c:0x6a4a3a, trim:0x4a3020, moss:0.25, seed:19, over:0.5 });
    hangingSign(hs, 1.4, 2.5, D/2+0.02, 'Baths', '#f4ead8', '#6a3a2a', Math.PI);
    for (const x of [-W/2-0.1, W/2+0.1]) mk(G.box(0.14,0.14,0.14), M(0xf0e0c0), x,2.0,D/2-0.2,hs);
    const lamp=new THREE.Group(); lamp.position.set(-0.85,1.9,D/2+0.15); hs.add(lamp); mk(G.cyl(0.13,0.13,0.3,10), glowMat(0xffc080), 0,0,0,lamp); addGlow(lamp, 0, 1.4, 0xffb060);
    g.userData.chimney=new THREE.Vector3(-W/2+0.6, 3.6, -2.6); mk(G.cyl(0.18,0.22,1.4,8), M(0x5a5048), -W/2+0.6, 3.1, -2.6-0.2, g);
    // a bench and a tea table by the pool for the lounge
    const bench=new THREE.Group(); bench.position.set(-3.6,0,0.4); bench.rotation.y=Math.PI/2; g.add(bench); mk(G.box(1.4,0.08,0.4), OAK(), 0,0.42,0,bench); for (const x of [-0.6,0.6]) mk(G.box(0.08,0.42,0.36), OAK(), x,0.21,0,bench); }
  if (stage>=3){ // the steam room: a little cedar hut off the east side, its own chimney puffing
    const sr=new THREE.Group(); sr.position.set(4.2,0,-2.4); g.add(sr);
    mk(G.box(2.2,2.0,2.2), tmat('log',0x9a6a40,1.2,1), 0,1.0,0,sr); const rf=mk(G.cone(1.8,1.0,4), M(0x5a3a2a), 0,2.5,0,sr); rf.rotation.y=Math.PI/4;
    mk(G.box(0.8,1.5,0.05), M(0x4a2a1a), 0,0.75,1.11,sr); mk(G.box(0.4,0.3,0.03), glass(0xf0f8ff,0.6), 0,1.3,1.13,sr); mk(G.cyl(0.12,0.14,0.8,8), M(0x5a5048), 0.6,3.0,0,sr);
    g.userData.steamroom=new THREE.Vector3(4.8,3.4,-2.4); }
  if (stage>=4){ // rock pools stepping down toward the sea
    for (const [x,z,rr] of [[4.2,1.8,1.1],[5.2,3.6,0.9],[3.2,3.9,0.8]]){ const p=new THREE.Group(); p.position.set(x,0,z); g.add(p);
      mk(G.cyl(rr,rr,0.06,18), warmWater(), 0,0.1,0,p); for (let i=0;i<9;i++){ const a=i/9*TAU, s=0.2+r()*0.15; mk(G.dod(s), rock, Math.cos(a)*(rr+0.1), 0.1, Math.sin(a)*(rr+0.1), p).rotation.set(r()*3,r()*3,0); } } }
  mossTop(g, -2.2, 0.3, 3.4, 1.2, 0.4, 5, 4);
  const keep=[g.userData.water].filter(Boolean); mergeStatic(g, keep);
  g.userData.door=[0, 3.9]; g.userData.size={ W:6, D:7 };
  g.userData.rects = stage>=2 ? [[-3.2,-4.6,3.2,-0.7],...(stage>=3?[[3.0,-3.6,5.4,-1.2]]:[])] : [];
  g.userData.pool=[0,1.2,2.45]; return g; }

/* ---------- Lumi's glade ---------- */
// a ring of mossy stones and a little wooden sign, where Lumi wants the fireflies
export function buildGladeStones(seed=5){
  const g=new THREE.Group(), r=mulberry32(seed), st=M(0x8a8a80,{ flatShading:true, roughness:0.95 }), moss=M(0x5f8a3c,{ roughness:1 });
  for (let i=0;i<6;i++){ const a=i/6*TAU+r()*0.3, d=2.2+r()*0.4, h=0.35+r()*0.4; const s=mk(G.dod(0.3), st, Math.cos(a)*d, h*0.5, Math.sin(a)*d, g); s.scale.set(1,h/0.3,1); s.rotation.y=r()*3; mk(G.sph(0.22,7,5), moss, Math.cos(a)*d, h+0.05, Math.sin(a)*d, g).scale.set(1.2,0.35,1.2); }
  const sp=new THREE.Group(); sp.position.set(0,0,2.9); g.add(sp); mk(G.box(0.07,0.9,0.07), OAK(), 0,0.45,0,sp); mk(G.box(0.6,0.3,0.04), label('Glade',192,96,'#e8dcc0','#4a5a3a',44), 0,0.85,0.04,sp);
  mergeStatic(g); g.userData.rects=[]; return g; }
// the fireflies: a cloud of glowing points that drift and blink. main.js sets how many show and fades them by hour.
export function buildFireflies(n=120, R=8, seed=7){
  const r=mulberry32(seed), pos=new Float32Array(n*3), base=[];
  for (let i=0;i<n;i++){ const a=r()*TAU, d=Math.sqrt(r())*R, y=0.4+r()*2.6; base.push([Math.cos(a)*d, y, Math.sin(a)*d, r()*TAU, 0.4+r()*0.8]); pos.set([Math.cos(a)*d,y,Math.sin(a)*d], i*3); }
  const geo=new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos,3)); geo.setDrawRange(0,0);
  const cv=document.createElement('canvas'); cv.width=cv.height=32; const x=cv.getContext('2d'), gr=x.createRadialGradient(16,16,0,16,16,16); gr.addColorStop(0,'rgba(255,255,220,1)'); gr.addColorStop(0.35,'rgba(220,255,120,0.8)'); gr.addColorStop(1,'rgba(200,255,100,0)'); x.fillStyle=gr; x.fillRect(0,0,32,32);
  const mat=new THREE.PointsMaterial({ size:0.42, map:new THREE.CanvasTexture(cv), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, color:0xd8ff8a, opacity:0 });
  const pts=new THREE.Points(geo, mat); pts.frustumCulled=false;
  pts.userData.tick=(t, show, alpha, blue)=>{ geo.setDrawRange(0, Math.min(n, show|0)); mat.opacity=alpha; mat.color.setHex(blue?0xb8e8ff:0xd8ff8a); const P=geo.attributes.position;
    for (let i=0;i<Math.min(n,show|0);i++){ const b=base[i], ph=b[3]+t*b[4]; P.setXYZ(i, b[0]+Math.sin(ph*0.7)*0.6, b[1]+Math.sin(ph*1.3)*0.25, b[2]+Math.cos(ph*0.6)*0.6); } P.needsUpdate=true; };
  return pts; }

/* ---------- Hazel's wreck ---------- */
// a brass diving bell with round portholes, hung from a timber A-frame at the end of a little jetty
export function buildDivingBell(){
  const g=new THREE.Group(), w=OAK(), br=BRASS();
  for (let i=0;i<5;i++) mk(G.box(1.6,0.08,0.5), M(i%2?0xa8805a:0x9a7048), 0,0.5,-1.0+i*0.5,g);
  for (const x of [-0.7,0.7]) for (const z of [-1.1,1.1]) mk(G.cyl(0.08,0.08,1.1,6), M(0x5a4030), x,0.05,z,g);
  for (const s of [-1,1]){ const a=mk(G.box(0.12,3.0,0.12), w, s*0.6,1.95,0.6,g); a.rotation.z=-s*0.2; }
  mk(G.box(1.6,0.14,0.14), w, 0,3.35,0.6,g); mk(G.cyl(0.02,0.02,0.9,4), M(0x3a302a), 0,2.85,0.6,g);
  const bell=new THREE.Group(); bell.position.set(0,1.6,0.6); g.add(bell);
  mk(G.cyl(0.42,0.62,1.0,18), br, 0,0,0,bell); mk(G.sph(0.42,18,8,0,TAU,0,Math.PI/2), br, 0,0.5,0,bell); mk(G.tor(0.62,0.05,6,24), br, 0,-0.5,0,bell).rotation.x=Math.PI/2;
  for (let i=0;i<3;i++){ const a=i/3*TAU+0.5; const p=mk(G.cyl(0.13,0.13,0.06,14), glass(0xa8e0f0,0.6), Math.sin(a)*0.52, 0.05, Math.cos(a)*0.52, bell); p.rotation.x=Math.PI/2; p.rotation.z=-a; const rim=mk(G.tor(0.13,0.025,5,14), IRON(), Math.sin(a)*0.53, 0.05, Math.cos(a)*0.53, bell); rim.rotation.y=a; }
  mk(G.tor(0.1,0.03,5,10), IRON(), 0,0.95,0,bell);
  const winch=new THREE.Group(); winch.position.set(0.85,0.85,-0.6); g.add(winch); mk(G.cyl(0.18,0.18,0.5,12), w, 0,0,0,winch).rotation.x=Math.PI/2; mk(G.tor(0.2,0.03,5,12), IRON(), 0,0,0.27,winch);
  g.userData.door=[0,1.4]; g.userData.size={ W:1.8, D:2.6 }; g.userData.rects=[[-0.85,-1.3,0.85,-0.2]]; return g; }
// inside the wreck: one long hull, four parts one after another (deck, hold, cabin, vault), each closed by a bulkhead until it's opened
export const WRECK_LAYERS = ['deck','hold','cabin','vault'];
export function buildWreckRoom(W=8, D=26, seed=11){
  const g=new THREE.Group(), r=mulberry32(seed), dk=OLDWOOD(), plank=M(0x6a5642,{ roughness:1 }), sand=M(0xc8b890,{ roughness:1 }), L=D/4;
  mk(G.box(W+1,0.1,D+1), sand, 0,-0.05,0,g); for (let i=0;i<Math.floor(D/0.6);i++) mk(G.box(W-1.2,0.04,0.55), i%3?plank:M(0x5a4a38), 0,0.02,-D/2+0.3+i*0.6,g);
  // ribs arching overhead, a hull wall either side, the water dark blue beyond
  for (let i=0;i<=D/1.6;i++){ const z=-D/2+i*1.6; const rib=mk(G.tor(W/2,0.14,6,16,Math.PI), dk, 0,0.1,z,g); }
  for (const s of [-1,1]){ const wall=mk(G.box(0.2,3.4,D), plank, s*(W/2-0.1),1.7,0,g); wall.material=plank; }
  mk(G.box(W,0.05,D), M(0x1a3a5a,{ transparent:true, opacity:0.6, side:THREE.DoubleSide }), 0,4.1,0,g);
  // seaweed, barnacles, sand drifts, a few fish swimming through a hole
  const weed=M(0x3a7a4a), sw=[];
  for (let i=0;i<26;i++){ const s=r()<0.5?-1:1, z=-D/2+r()*D, h=0.5+r()*1.4, k=mk(G.cyl(0.03,0.05,h,4), weed, s*(W/2-0.5-r()*0.5), h/2, z, g); sw.push(k); }
  for (let i=0;i<16;i++){ const s=r()<0.5?-1:1; mk(G.sph(0.06+r()*0.05,6,4), M(0xd8d0c0), s*(W/2-0.22), 0.4+r()*2.5, -D/2+r()*D, g).scale.y=0.6; }
  for (let i=0;i<10;i++){ const d=mk(G.sph(0.6+r()*0.5,10,6,0,TAU,0,Math.PI/2), sand, (r()-0.5)*(W-2), -0.15, -D/2+r()*D, g); d.scale.y=0.3; }
  const fish=new THREE.Group(); g.add(fish); for (let i=0;i<8;i++){ const f=mk(G.sph(0.08,8,6), M([0xf0a040,0x6ab8d8,0xe8e0d0][i%3]), (r()-0.5)*(W-2), 1+r()*2, -D/2+r()*D, fish); f.scale.set(1.8,0.8,0.5); f.userData.ph=r()*TAU; }
  g.userData.fish=fish;
  // bulkheads between the parts, each with a door that's barred, rusted shut, pitch dark or sealed until it's opened
  const gates={}; const names=['hold','cabin','vault'];
  names.forEach((nm,i)=>{ const z=-D/2+L*(3-i), bh=new THREE.Group(); bh.position.z=z; g.add(bh);
    for (const s of [-1,1]) mk(G.box((W-1.6)/2,3.4,0.25), plank, s*((W-1.6)/4+0.8),1.7,0,bh); mk(G.box(1.6,1.2,0.25), plank, 0,2.8,0,bh);
    const gate=new THREE.Group(); bh.add(gate);
    if (nm==='hold'){ for (let k=0;k<4;k++) mk(G.box(1.6,0.14,0.1), M(0x5a4a38), 0,0.3+k*0.5,0.12,gate); mk(G.box(0.3,0.3,0.1), IRON(), 0,1.1,0.2,gate); }
    else if (nm==='cabin'){ mk(G.box(1.5,2.2,0.12), M(0x2a2a30), 0,1.1,0,gate); mk(G.box(0.1,0.3,0.05), BRASS(), 0.5,1.1,0.08,gate); }
    else { mk(G.box(1.5,2.2,0.2), IRON(), 0,1.1,0,gate); const wh=mk(G.tor(0.32,0.05,6,18), BRASS(), 0,1.2,0.14,gate); for (let k=0;k<4;k++) mk(G.box(0.05,0.62,0.04), BRASS(), 0,1.2,0.14,gate).rotation.z=k*Math.PI/4; }
    gates[nm]=gate; });
  // a dark curtain of water hides each part that isn't open yet, so you only see as far as you can go
  const veils={}; names.forEach((nm,i)=>{ const z=-D/2+L*(3-i)-0.2, v=mk(G.box(W-0.6,3.6,0.05), M(0x0a1a2a,{ roughness:1 }), 0,1.8,z,g); v.castShadow=false; veils[nm]=v; });
  // lamps along the way (a soft blue-green glow)
  for (let i=0;i<4;i++){ const lz=-D/2+L*(i+0.5), lp=new THREE.Group(); lp.position.set(W/2-0.45,2.2,lz); g.add(lp); mk(G.cyl(0.1,0.1,0.22,8), glowMat(0x9ae8d0), 0,0,0,lp); addGlow(lp, 0, 1.8, 0x9ae8d0); }
  // where the salvage lies in each part (local x, z): two pieces each
  const spots={}; WRECK_LAYERS.forEach((nm,i)=>{ const zc=-D/2+L*(3-i)+L/2; spots[nm]=[[-W/2+1.6, zc-0.6],[W/2-1.6, zc+0.4]]; });
  // in the vault, a strongbox with the last pages
  const box=new THREE.Group(); box.position.set(0,0,-D/2+1.4); g.add(box); FURN_BUILDERS.treasurechest(box); box.scale.setScalar(1.2);
  g.userData.gates=gates; g.userData.veils=veils; g.userData.spots=spots; g.userData.L=L; g.userData.D=D; g.userData.W=W; g.userData.weed=sw;
  return g; }
export function swimWreck(g, t){ const f=g.userData.fish; if (f) f.children.forEach((c,i)=>{ const ph=c.userData.ph+t*0.4; c.position.x+=Math.cos(ph)*0.008; c.position.z+=Math.sin(ph)*0.012; c.rotation.y=-ph; });
  (g.userData.weed||[]).forEach((w,i)=>{ w.rotation.z=Math.sin(t*1.2+i)*0.12; }); }
// Hazel's antiques: a narrow shop of weathered blue boards, a bay window of salvage and a ship's lantern by the door
export function buildAntiques(){
  const g=new THREE.Group(), W=4.6, D=4.0, H=2.6;
  const base=tbox('stone', 0x8a8680, W+0.3, 0.4, D+0.3, 0.8); base.position.y=0.05; g.add(base);
  const walls=new THREE.Mesh(G.box(W,H,D), tmat('board',0x6a8aa0,2,1.4)); walls.position.y=0.25+H/2; walls.castShadow=walls.receiveShadow=true; g.add(walls);
  const front=new THREE.Group(); front.position.set(0,0.25,D/2+0.01); g.add(front);
  mk(G.box(0.95,1.95,0.08), M(0x3a2a20), 1.25,1.22,D/2+0.03,g); window1(front, -0.9, 1.45, 0.02, { type:'grid', shut:0x3a4a5a, size:1.3, seed:8 });
  cottageRoof(g, { style:'shingle', L:D, S:W, y:0.25+H, c:0x5a4a3a, trim:0x3a3020, moss:0.4, seed:61, over:0.35 });
  const ch=chimney1(g, -W/2+0.6, -0.5, 0.25, 4.6, 'stone', 0.06);
  hangingSign(g, 1.25, 2.6, D/2+0.02, 'Antiques', '#e8dcc0', '#3a4a5a', Math.PI);
  const ln=new THREE.Group(); ln.position.set(2.0,0,D/2+0.4); g.add(ln); FURN_BUILDERS.shiplantern(ln); ln.position.y=0.25;
  barrel1(g, -W/2-0.2, D/2+0.6, 0x6a5040); const an=new THREE.Group(); an.position.set(-W/2-0.1,0,D/2-0.6); an.rotation.y=0.4; g.add(an);
  { const ir=IRON(); mk(G.cyl(0.06,0.06,1.0,8), ir, 0,0.5,0,an); const fl=mk(G.tor(0.28,0.05,6,12,Math.PI), ir, 0,0.08,0,an); fl.rotation.x=Math.PI; mk(G.box(0.7,0.08,0.08), ir, 0,0.9,0,an); mk(G.tor(0.08,0.02,5,10), ir, 0,1.05,0,an); }
  mergeStatic(g); g.userData.door=[1.25, D/2]; g.userData.size={ W, D }; g.userData.rects=[[-W/2-0.6,-D/2-0.1,W/2+0.1,D/2+0.1]]; g.userData.chimney=ch; return g; }
