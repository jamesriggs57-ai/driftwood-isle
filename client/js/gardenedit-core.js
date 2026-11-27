/* =====================================================================
   v1.71 GARDEN EDITOR: the parts with no 3D in them, so they can be tested on their own.
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

/* v1.73 soil squares. A set of squares split into the pieces that touch side by side (biggest first). */
export function splitCells(keys){ const left=new Set(keys), out=[];
  while (left.size){ const first=left.values().next().value, part=[first], q=[first]; left.delete(first);
    while (q.length){ const [i,j]=parseCell(q.pop()); for (const [a,b] of [[1,0],[-1,0],[0,1],[0,-1]]){ const k=ckey(i+a,j+b); if (left.has(k)){ left.delete(k); part.push(k); q.push(k); } } }
    out.push(part); }
  return out.sort((a,b)=>b.length-a.length); }
/* Take squares out of a list of gardens. A garden left in pieces splits: the biggest piece keeps the garden (its gate, fence and
   decorations), the others become gardens of their own with the same fence style. Empty gardens go. newId makes ids.
   Returns the new list of gardens. */
export function cutSquares(gardens, keys, newId){ const cut=new Set(keys), out=[];
  for (const g of gardens){ const rest=g.cells.filter(k=>!cut.has(k)); if (rest.length===g.cells.length){ out.push(g); continue; }
    if (!rest.length) continue;
    const parts=splitCells(rest); g.cells=parts[0]; out.push(g);
    for (const p of parts.slice(1)) out.push({ id:newId(), cells:p, gate:null, fence:g.fence||null, fenced:(g.fenced||[]).slice(), decor:{} }); }
  return out; }
// the one garden whose squares are exactly these, or null
export function wholeOf(gardens, keys){ const set=new Set(keys); if (!set.size) return null;
  for (const g of gardens) if (g.cells.length===set.size && g.cells.every(k=>set.has(k))) return g; return null; }
