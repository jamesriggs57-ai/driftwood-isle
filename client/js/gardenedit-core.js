/* =====================================================================
   v1.68 GARDEN EDITOR: the parts with no 3D in them, so they can be tested on their own.
   Squares are 'i,j' keys on the CELL grid; fence sides are edge keys 'i,j,E' (between (i,j) and (i+1,j))
   or 'i,j,S' (between (i,j) and (i,j+1)), the same as main.js.
   A quarter turn matches three.js rotation.y = +PI/2: a local offset (a,b) becomes (b,-a).
   ===================================================================== */

// q quarter turns of the offset (a,b)
export function rotQ(a, b, q){ q=((q%4)+4)%4; for (let k=0;k<q;k++){ const t=a; a=b; b=-t; } return [a===0?0:a, b===0?0:b]; }

export const parseCell = k => k.split(',').map(Number);
export const ckey = (i,j) => i+','+j;
export const edgeKey = (i,j,di,dj) => di===1?`${i},${j},E`:di===-1?`${i-1},${j},E`:dj===1?`${i},${j},S`:`${i},${j-1},S`;
// an edge key as one square and the way out of it
export function parseEdge(k){ const [a,b,d]=k.split(','); return { i:+a, j:+b, di:d==='E'?1:0, dj:d==='S'?1:0 }; }

// the square at the middle of a set of squares (rounded), as [ci, cj]
export function centerCell(cells){ let a=1e9,b=-1e9,c=1e9,d=-1e9; for (const [i,j] of cells){ a=Math.min(a,i); b=Math.max(b,i); c=Math.min(c,j); d=Math.max(d,j); }
  return [Math.round((a+b)/2), Math.round((c+d)/2)]; }

// where a square goes: offsets are taken from the old centre square, turned, then added to the new one
export function moveCell(i, j, from, to, q){ const [a,b]=rotQ(i-from[0], j-from[1], q); return [to[0]+a, to[1]+b]; }
export function moveEdge(k, from, to, q){ const e=parseEdge(k), [i,j]=moveCell(e.i, e.j, from, to, q), [di,dj]=rotQ(e.di, e.dj, q); return edgeKey(i, j, di, dj); }

/* A whole garden moved and turned: its squares, fenced sides and gate go with it. Fence style and decorations don't change.
   Returns the new fields; the caller writes them onto the garden. */
export function moveGarden(g, to, q){ const cells=g.cells.map(parseCell), from=centerCell(cells);
  return { cells:cells.map(([i,j])=>ckey(...moveCell(i,j,from,to,q))), fenced:(g.fenced||[]).map(k=>moveEdge(k,from,to,q)), gate:g.gate ? moveEdge(g.gate,from,to,q) : null }; }

// what you get back when a planted plant comes out (the same as digging it up used to give)
export function itemBack(rec, P, ITEMS){ if (!P) return null;
  if (P.ptype==='tree'){ const id = rec.sp==='fruittree' ? rec.fruit : rec.sp+'_sapling'; return ITEMS[id] ? id : (ITEMS.oak_sapling ? 'oak_sapling' : null); }
  const id = P.ptype==='crop' ? P.crop+'_seeds' : P.ptype==='flower' ? rec.sp+'_seeds' : rec.sp+'_start'; return ITEMS[id] ? id : null; }

// planted by you (wild crops and wild flower clumps carry wild:true)
export const isMine = rec => !!rec && !rec.wild;
