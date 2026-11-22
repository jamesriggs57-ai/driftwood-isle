// Shared helpers: math, seeded randomness, noise, and the game clock.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function hashStr(s){let h=1779033703^s.length;for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return h>>>0;}
export function hash2(x,y){let h=Math.imul(x,374761393)+Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
export function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=hash2(xi,yi),b=hash2(xi+1,yi),c=hash2(xi,yi+1),d=hash2(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
export function fbm(x,y){return vnoise(x,y)*0.5+vnoise(x*2.1+5,y*2.1+3)*0.3+vnoise(x*4.3+9,y*4.3+1)*0.2;}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export function weightedPick(r, arr, wf){ let tot=0; for(const a of arr) tot+=wf(a); let x=r()*tot; for(const a of arr){ x-=wf(a); if(x<=0) return a; } return arr[arr.length-1]; }
export function inHours(h, hrs){ if(!hrs) return true; const [s,e]=hrs; return s<=e ? (h>=s&&h<e) : (h>=s||h<e); }
export function inMonths(m, ms){ return !ms || ms==='all' || ms.includes(m); }
export const fmt = n => Math.round(n).toLocaleString('en-US');
export function segDist(px,pz,ax,az,bx,bz){ const dx=bx-ax,dz=bz-az; const t=clamp(((px-ax)*dx+(pz-az)*dz)/(dx*dx+dz*dz||1),0,1); return Math.hypot(px-(ax+dx*t), pz-(az+dz*t)); }
export function polyDist(x,z,pts){ let m=1e9; for(let i=0;i<pts.length-1;i++) m=Math.min(m, segDist(x,z,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1])); return m; }
export const range = (a,b) => { const o=[]; if(a<=b){ for(let i=a;i<=b;i++) o.push(i); } else { for(let i=a;i<=12;i++) o.push(i); for(let i=1;i<=b;i++) o.push(i); } return o; };

/* The game runs on the real clock. offsetH is only for testing (Menu > Preview time). */
export const Time = {
  offsetH: 0,
  serverMs: 0,   // server clock minus device clock, set at startup when online (stops clock-change time skipping)
  now(){ return new Date(Date.now() + this.serverMs + this.offsetH * 3600e3); },
  hour(){ const d=this.now(); return d.getHours()+d.getMinutes()/60+d.getSeconds()/3600; },
  month(){ return this.now().getMonth()+1; },
  dayKey(){ const d=this.now(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },
};
export const seasonOf = m => (m>=3&&m<=5)?'spring':(m>=6&&m<=8)?'summer':(m>=9&&m<=11)?'autumn':'winter';
