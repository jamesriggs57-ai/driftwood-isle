// Ground cover (v1): grass tufts made of curved blades that sway, real little flowers, clover, pebbles,
// mushrooms and leaf litter. Everything is built once as a small geometry and drawn instanced.
// Colors live in vertex colors (shading from base to tip) multiplied by each instance's own color.
import * as THREE from 'three';

const TAU = Math.PI * 2;
const srand = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

class Build {
  constructor(){ this.p=[]; this.n=[]; this.c=[]; this.i=[]; }
  v(x,y,z, nx,ny,nz, c){ this.p.push(x,y,z); const l=Math.hypot(nx,ny,nz)||1; this.n.push(nx/l,ny/l,nz/l); this.c.push(c[0],c[1],c[2]); return this.p.length/3-1; }
  t(a,b,c){ this.i.push(a,b,c); }
  geo(){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(this.p,3)); g.setAttribute('normal',new THREE.Float32BufferAttribute(this.n,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.c,3)); g.setIndex(this.i); g.computeBoundingSphere(); return g; }
}

/* ---------- Wind: one shared clock for everything that sways ---------- */
const uTime = { value: 0 };
export function swayMat(o = {}){
  const m = new THREE.MeshStandardMaterial({ vertexColors:true, roughness:o.rough ?? 0.92, metalness:0, side:o.side ?? THREE.DoubleSide, color:o.color ?? 0xffffff });
  const H = o.height ?? 0.45, A = o.amp ?? 0.06;
  m.onBeforeCompile = sh => { sh.uniforms.uTime = uTime;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      { vec3 ip = vec3(0.0);
        #ifdef USE_INSTANCING
          ip = instanceMatrix[3].xyz;
        #endif
        float hh = clamp(position.y / ${H.toFixed(3)}, 0.0, 1.4); float s = hh*hh;
        float gust = 0.65 + 0.35*sin(uTime*0.45 + ip.x*0.05 + ip.z*0.03);
        transformed.x += (sin(uTime*1.7 + ip.x*0.35 + ip.z*0.21)*0.6 + sin(uTime*2.9 + ip.z*0.47)*0.4) * ${A.toFixed(3)} * s * gust;
        transformed.z += cos(uTime*1.3 + ip.z*0.31 + ip.x*0.17) * ${(A*0.6).toFixed(3)} * s * gust; }`);
  };
  m.customProgramCacheKey = () => 'sway:'+H+':'+A;
  return m;
}
// Call once per frame-ish; cheap. Attached to a mesh so it runs whenever that mesh is drawn.
export function tickWind(mesh){ mesh.onBeforeRender = () => { uTime.value = performance.now() / 1000; }; return mesh; }

/* ---------- Grass tuft: 6-9 tapered blades curving outward, dark at the root, light at the tip ---------- */
export function tuftGeo(variant = 0){
  const r = srand(101 + variant*37), B = new Build(), n = 8 + Math.floor(r()*3);
  for (let k = 0; k < n; k++){
    const a = k/n*TAU + (r()-0.5)*0.7, dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const h = 0.2 + r()*0.28, lean = 0.2 + r()*0.6, w = 0.022 + r()*0.012, r0 = 0.01 + r()*0.04;
    const out = t => r0 + h*Math.sin(lean)*t*t*1.1, ht = t => h*t*(1 - 0.18*lean*t);
    const up = [dx*0.35, 1, dz*0.35], idx = [];
    for (const [t, wf, shade] of [[0, 1, 0.72], [0.6, 0.62, 1.0]]){
      const o = out(t), y = ht(t), ww = w*wf, c = [shade, shade, shade*0.96];
      idx.push(B.v(dx*o + sx*ww, y, dz*o + sz*ww, ...up, c), B.v(dx*o - sx*ww, y, dz*o - sz*ww, ...up, c)); }
    const tip = B.v(dx*out(1), ht(1), dz*out(1), ...up, [1.3, 1.26, 1.0]);
    B.t(idx[0], idx[1], idx[3]); B.t(idx[0], idx[3], idx[2]); B.t(idx[2], idx[3], tip);
  }
  return B.geo();
}

/* ---------- Flowers ---------- */
// stem with two little leaves; green is baked in
export function flowerStemGeo(){
  const B = new Build(), g = [0.33, 0.6, 0.24], gl = [0.42, 0.72, 0.3], H = 0.34, w = 0.011;
  for (let k = 0; k < 3; k++){ const a = k/3*TAU, b = (k+1)/3*TAU, ca = Math.cos(a)*w, sa = Math.sin(a)*w, cb = Math.cos(b)*w, sb = Math.sin(b)*w;
    const i0 = B.v(ca,0,sa, ca,0,sa, g), i1 = B.v(cb,0,sb, cb,0,sb, g), i2 = B.v(ca*0.7,H,sa*0.7, ca,0,sa, gl), i3 = B.v(cb*0.7,H,sb*0.7, cb,0,sb, gl); B.t(i0,i2,i1); B.t(i1,i2,i3); }
  for (const [y, a, L] of [[0.07, 0.4, 0.12], [0.15, 0.4+Math.PI, 0.1]]){ const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const b = B.v(0,y,0, 0,1,0, g), l = B.v(dx*L*0.5+sx*L*0.22, y+L*0.22, dz*L*0.5+sz*L*0.22, 0,1,0, gl), rr = B.v(dx*L*0.5-sx*L*0.22, y+L*0.22, dz*L*0.5-sz*L*0.22, 0,1,0, gl), tp = B.v(dx*L, y+L*0.15, dz*L, 0,1,0, gl);
    B.t(b,l,tp); B.t(b,tp,rr); }
  return B.geo();
}
// daisy-like head: 7 flat petals, slightly cupped; petals are white so the instance color tints them
export function petalsDaisyGeo(){
  const B = new Build(), H = 0.345, n = 7;
  for (let k = 0; k < n; k++){ const a = k/n*TAU, dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx, r0 = 0.018, r1 = 0.088, w = 0.024;
    const b = B.v(dx*r0, H, dz*r0, 0,1,0, [0.82,0.82,0.82]), l = B.v(dx*(r0+r1)*0.55+sx*w, H+0.008, dz*(r0+r1)*0.55+sz*w, 0,1,0, [1,1,1]), rr = B.v(dx*(r0+r1)*0.55-sx*w, H+0.008, dz*(r0+r1)*0.55-sz*w, 0,1,0, [1,1,1]), tp = B.v(dx*r1, H+0.02, dz*r1, 0,1,0, [1.08,1.08,1.08]);
    B.t(b,l,tp); B.t(b,tp,rr); }
  return B.geo();
}
// cup / tulip head: 5 upright petals
export function petalsCupGeo(){
  const B = new Build(), H = 0.33, n = 5;
  for (let k = 0; k < n; k++){ const a = k/n*TAU, dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx, w = 0.034;
    const b = B.v(dx*0.012, H, dz*0.012, dx,0.3,dz, [0.78,0.78,0.78]), l = B.v(dx*0.045+sx*w, H+0.05, dz*0.045+sz*w, dx,0.2,dz, [1,1,1]), rr = B.v(dx*0.045-sx*w, H+0.05, dz*0.045-sz*w, dx,0.2,dz, [1,1,1]), tp = B.v(dx*0.05, H+0.1, dz*0.05, dx,0.4,dz, [1.08,1.08,1.08]);
    B.t(b,l,tp); B.t(b,tp,rr); }
  return B.geo();
}
export function flowerCenterGeo(){ const g = new THREE.SphereGeometry(0.032, 8, 5); g.scale(1, 0.55, 1); g.translate(0, 0.352, 0);
  const n = g.attributes.position.count, c = new Float32Array(n*3); for (let i = 0; i < n; i++){ c[i*3] = 1; c[i*3+1] = 0.78; c[i*3+2] = 0.2; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }

/* ---------- Clover: a few trefoils lying low in the grass ---------- */
export function cloverGeo(variant = 0){
  const r = srand(211 + variant*13), B = new Build(), n = 4 + Math.floor(r()*2);
  for (let k = 0; k < n; k++){ const cx = (r()-0.5)*0.42, cz = (r()-0.5)*0.42, y = 0.035 + r()*0.04, rot = r()*TAU, s = 0.05 + r()*0.02;
    for (let q = 0; q < 3; q++){ const a = rot + q/3*TAU, dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
      const c0 = B.v(cx, y, cz, 0,1,0, [0.8,0.8,0.8]);
      const pts = [[0.35, 0.55], [0.95, 0.55], [1.05, 0], [0.95, -0.55], [0.35, -0.55]].map(([f, g]) => B.v(cx+dx*s*f+sx*s*g, y+0.006*f, cz+dz*s*f+sz*s*g, 0,1,0, [1.05,1.05,1.05]));
      for (let j = 0; j < 4; j++) B.t(c0, pts[j], pts[j+1]); } }
  return B.geo();
}

/* ---------- Pebbles ---------- */
export function pebbleGeo(variant = 0){
  const r = srand(311 + variant*7), g = new THREE.IcosahedronGeometry(0.08, 1), p = g.attributes.position, v = new THREE.Vector3();
  const sx = 0.8 + r()*0.6, sz = 0.7 + r()*0.5;
  for (let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const k = 1 + Math.sin(v.x*40 + variant)*0.08 + Math.cos(v.z*37)*0.08; v.x *= sx*k; v.z *= sz*k; v.y = Math.max(-0.01, v.y*0.55); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); const n = p.count, c = new Float32Array(n*3); for (let i = 0; i < n; i++){ const y = p.getY(i); const s = 0.82 + Math.max(0, y)*3.5; c[i*3] = c[i*3+1] = c[i*3+2] = Math.min(1.12, s); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }

/* ---------- Mushrooms: stem and cap drawn separately so caps can take a color ---------- */
export function mushStemGeo(){ const g = new THREE.CylinderGeometry(0.022, 0.03, 0.12, 7); g.translate(0, 0.06, 0);
  const n = g.attributes.position.count, c = new Float32Array(n*3); for (let i = 0; i < n; i++){ c[i*3] = 1; c[i*3+1] = 0.95; c[i*3+2] = 0.86; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }
export function mushCapGeo(){ const g = new THREE.SphereGeometry(0.065, 12, 6, 0, TAU, 0, Math.PI/2); g.scale(1, 0.62, 1); g.translate(0, 0.115, 0);
  const p = g.attributes.position, n = p.count, c = new Float32Array(n*3); for (let i = 0; i < n; i++){ const y = p.getY(i); const s = 0.8 + (y-0.115)/0.04*0.3; c[i*3] = c[i*3+1] = c[i*3+2] = s; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; }

/* ---------- Fallen leaf: a pointed leaf with a slight fold ---------- */
export function fallenLeafGeo(){ const B = new Build(), L = 0.17, W = 0.07;
  const b = B.v(-L/2, 0, 0, 0,1,0, [0.85,0.85,0.85]), l1 = B.v(-L*0.1, 0.004, W, 0,1,0, [1,1,1]), tip = B.v(L/2, 0.012, 0, 0,1,0, [1.06,1.06,1.06]), r1 = B.v(-L*0.1, 0.004, -W, 0,1,0, [0.94,0.94,0.94]), mid = B.v(0, 0.012, 0, 0,1,0, [0.9,0.9,0.9]);
  B.t(b, l1, mid); B.t(l1, tip, mid); B.t(b, mid, r1); B.t(mid, tip, r1); return B.geo(); }
