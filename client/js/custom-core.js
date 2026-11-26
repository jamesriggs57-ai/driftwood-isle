/* =====================================================================
   v1.41 CUSTOM FURNITURE: data and rules (no THREE, no DOM, so the server and node tests can import it).
   A custom piece is a base (chair, table, bed, shelf, lamp, dresser), one option per slot, and materials.
   The whole design lives in its item id: 'cf_' + base letter + one base-36 digit per field, so every
   player, the server and a friend's island can rebuild any piece from the id alone.
   NEVER reorder or remove options below: ids are saved. Only append.

   Options: [name, short tag for names, styles, weight 1-3, detail 0-3, table tier 1-3, mats, flags]
     styles: rustic cottage antique modern woodland (generated plans stay inside one style)
     weight: how heavy it looks; generated plans keep every part within one step of the others
     detail: craftsmanship, it raises the first-sale bonus
     flags:  up = upholstered (uses the fabric), mt = shows the metal, glow = lights up, find = only from a found plan
   ===================================================================== */
import { ITEMS, def } from './content.js';

export const STYLES = ['rustic', 'cottage', 'antique', 'modern', 'woodland'];
export const STYLE_NAME = { rustic:'Rustic', cottage:'Cottage', antique:'Antique', modern:'Modern', woodland:'Woodland' };
// Neighbouring styles a player-made piece can mix and still count as one style (for requests)
export const STYLE_NEAR = { rustic:['cottage','woodland'], cottage:['rustic','antique','woodland'], antique:['cottage'], modern:['cottage'], woodland:['rustic','cottage'] };

const O = (name, tag, styles, w, d, t, mats={}, flags='') => ({ name, tag, styles:styles.split(' '), w, d, t, mats, up:/\bup\b/.test(flags), mt:/\bmt\b/.test(flags), glow:/\bglow\b/.test(flags), find:/\bfind\b/.test(flags) });

export const BASES = {
  chair: { letter:'c', name:'Chair', r:0.5, slots:['legs','back','seat','arms','trim'], key:'back',
    labels:{ legs:'Legs', back:'Back', seat:'Seat', arms:'Arms', trim:'Trim' },
    legs:[
      O('Square legs','Square','rustic cottage modern',2,0,1,{ wood:2 }),
      O('Tapered legs','Tapered','modern cottage',1,1,1,{ wood:2 }),
      O('Turned legs','Turned','cottage antique',2,2,2,{ wood:3 }),
      O('Cabriole legs','Cabriole','antique',2,3,3,{ wood:3, plank:1 }),
      O('Log legs','Log','rustic woodland',3,0,1,{ wood:3 }),
      O('Splayed stick legs','Stick','rustic cottage',1,1,1,{ wood:1, softwood:2 }),
      O('Hairpin legs','Hairpin','modern',1,1,2,{ iron:1 },'mt'),
      O('Sled base','Sled','modern',2,1,3,{ iron:2 },'mt'),
      O('Twig legs','Twig','woodland',1,1,2,{ softwood:4 }),
      O('Claw feet','Claw-foot','antique',3,3,3,{ wood:3, iron:1 },'mt find'),
      O('Rockers','Rocking','cottage rustic',2,2,2,{ wood:4 }) ],
    back:[
      O('Ladder back','Ladder-back','rustic cottage',2,1,1,{ wood:2 }),
      O('Spindle back','Spindle-back','cottage rustic',1,1,1,{ wood:1, softwood:2 }),
      O('Vase splat','Splat-back','antique cottage',2,2,2,{ wood:2 }),
      O('Heart cutout','Heart-back','cottage',2,1,1,{ wood:2 }),
      O('Oval medallion','Medallion','antique',2,3,3,{ wood:2, plank:1 },'up'),
      O('Shield back','Shield-back','antique',2,3,3,{ wood:3 }),
      O('Low curved back','Curve-back','modern',1,0,1,{ wood:2 }),
      O('Tall slats','Slat-back','modern',2,1,2,{ wood:3 }),
      O('Branch back','Branch','rustic woodland',3,1,1,{ softwood:3 }),
      O('Twig lattice','Lattice','woodland',2,2,2,{ softwood:5 }),
      O('Wingback','Wingback','antique cottage',3,2,2,{ wood:3 },'up'),
      O('Carved leaf','Leaf-back','woodland',2,3,3,{ wood:2, heartwood:1 },'find') ],
    seat:[
      O('Plank seat','Plank','rustic cottage modern',2,0,1,{ wood:2 }),
      O('Woven rush','Rush','cottage rustic',1,1,1,{ weed:4 }),
      O('Cushion','Cushion','cottage modern antique',2,1,1,{},'up'),
      O('Carved saddle','Saddle','rustic modern',2,2,2,{ wood:3 }),
      O('Padded seat','Padded','antique',2,2,2,{ wood:1 },'up'),
      O('Live-edge slab','Slab','rustic woodland',3,1,2,{ wood:3 }),
      O('Moss cushion','Mossy','woodland',2,2,3,{ glimmermoss:1 },'find') ],
    arms:[
      O('No arms','','rustic cottage antique modern woodland',1,0,1),
      O('Plain arms','Arm','rustic cottage modern',2,0,1,{ wood:2 }),
      O('Curved arms','Arm','antique cottage',2,2,2,{ wood:2 }),
      O('Rolled arms','Club','antique cottage',3,2,3,{ wood:2 },'up'),
      O('Branch arms','Arm','woodland rustic',2,1,2,{ softwood:3 }) ],
    trim:[
      O('No trim','','rustic cottage antique modern woodland',1,0,1),
      O('Ball finials','','cottage antique rustic',1,1,1,{ wood:1 }),
      O('Carved crest','','antique',2,2,2,{ wood:1 }),
      O('Ribbon bows','','cottage',1,1,2,{}),
      O('Mushroom caps','','woodland',1,2,2,{ wood:1 }),
      O('Brass studs','','antique modern',1,1,2,{ iron:1 },'mt'),
      O('Starstone inlay','Starlit','antique woodland',1,3,3,{ starstone:1 },'glow find'),
      O('Moonpearl finials','Moonpearl','antique cottage',1,3,3,{ moonpearl:1 },'find') ] },

  table: { letter:'t', name:'Table', r:0.8, slots:['base','top','skirt','extra'], key:'base',
    labels:{ base:'Base', top:'Top', skirt:'Apron', extra:'On top' },
    base:[
      O('Square legs','','rustic cottage modern',2,0,1,{ wood:4 }),
      O('Turned legs','Turned','cottage antique',2,2,2,{ wood:5 }),
      O('Cabriole legs','Cabriole','antique',2,3,3,{ wood:4, plank:1 }),
      O('Trestle','Trestle','rustic',3,1,1,{ wood:5 }),
      O('Pedestal','Pedestal','antique cottage',2,2,2,{ wood:4 }),
      O('X-frame','X-frame','rustic modern',2,1,1,{ wood:4 }),
      O('Tree stump','Stump','rustic woodland',3,0,1,{ stump:1 }),
      O('Hairpin legs','Hairpin','modern',1,1,2,{ iron:2 },'mt'),
      O('Root base','Root','woodland',3,3,3,{ wood:4, stump:1 },'find'),
      O('Claw-foot pedestal','Claw-foot','antique',3,3,3,{ wood:4, iron:1 },'mt') ],
    top:[
      O('Square top','','rustic cottage modern antique',2,0,1,{ wood:3 }),
      O('Round top','Round','cottage antique modern',2,1,1,{ wood:3 }),
      O('Long top','Long','rustic cottage modern',3,0,1,{ wood:4 }),
      O('Live-edge slab','Slab','rustic woodland',3,1,2,{ wood:5 }),
      O('Octagon top','Octagon','antique',2,2,2,{ wood:3, plank:1 }),
      O('Marble top','Marble','antique modern',2,2,2,{ stone:4 }),
      O('Mosaic top','Mosaic','cottage woodland',2,3,3,{ clay:3 }),
      O('Glass top','Glass','modern',1,2,3,{ clay:2, iron:1 },'mt') ],
    skirt:[
      O('No apron','','rustic cottage antique modern woodland',1,0,1),
      O('Plain apron','','rustic cottage modern antique',2,0,1,{ wood:1 }),
      O('Scalloped skirt','','cottage',2,1,1,{ wood:1 }),
      O('Carved apron','','antique',2,2,2,{ wood:2 }),
      O('Drawer','','rustic cottage antique',2,1,2,{ wood:1, iron:1 },'mt'),
      O('Lower shelf','','rustic modern cottage',2,1,1,{ wood:2 }) ],
    extra:[
      O('Nothing on top','','rustic cottage antique modern woodland',1,0,1),
      O('Lace cloth','','cottage antique',1,1,1,{},'up'),
      O('Table runner','','rustic cottage modern',1,0,1,{},'up'),
      O('Candlesticks','','antique cottage',1,1,2,{ iron:1 },'mt glow'),
      O('Flower vase','','cottage antique modern',1,1,1,{ clay:1 }),
      O('Fern pot','','woodland cottage rustic',1,1,1,{ clay:1 }),
      O('Bowl of fruit','','rustic cottage',1,1,1,{}),
      O('Mushroom lamp','','woodland',1,2,2,{ stump:1 },'glow'),
      O('Starstone geode','','modern woodland',1,3,3,{ starstone:1 },'glow find') ] },

  bed: { letter:'b', name:'Bed', r:1.1, slots:['frame','head','foot','bedding','canopy'], key:'head',
    labels:{ frame:'Frame', head:'Headboard', foot:'Footboard', bedding:'Bedding', canopy:'Canopy' },
    frame:[
      O('Box frame','','rustic cottage modern',2,0,1,{ wood:6 }),
      O('Turned legs','','cottage antique',2,2,2,{ wood:7 }),
      O('Log frame','','rustic woodland',3,0,1,{ wood:8 }),
      O('Low platform','','modern',1,0,1,{ wood:5 }),
      O('Brass frame','','antique cottage',2,2,2,{ iron:3 },'mt'),
      O('Twig frame','','woodland',2,2,2,{ softwood:10 }),
      O('Sleigh frame','','antique',3,3,3,{ wood:6, plank:2 }) ],
    head:[
      O('Plain panel','Panel','rustic cottage modern',2,0,1,{ wood:3 }),
      O('Spindle headboard','Spindle','cottage rustic',1,1,1,{ wood:2, softwood:3 }),
      O('Arched headboard','Arched','cottage antique',2,1,1,{ wood:3 }),
      O('Sleigh scroll','Sleigh','antique',3,3,3,{ wood:4, plank:1 }),
      O('Tufted headboard','Tufted','antique modern',2,2,2,{ wood:2 },'up'),
      O('Log headboard','Log','rustic',3,0,1,{ wood:5 }),
      O('Brass bars','Brass','cottage antique',1,2,2,{ iron:2 },'mt'),
      O('Tree branches','Bower','woodland',2,2,2,{ softwood:6 }),
      O('Carved forest','Forest','woodland antique',3,3,3,{ wood:4, heartwood:1 },'find'),
      O('Moon and stars','Starlit','woodland cottage',2,3,3,{ wood:3, starstone:1 },'glow find') ],
    foot:[
      O('No footboard','','rustic cottage antique modern woodland',1,0,1),
      O('Low panel','','rustic cottage modern',2,0,1,{ wood:2 }),
      O('Spindle footboard','','cottage rustic',1,1,1,{ softwood:3 }),
      O('Scroll footboard','','antique',3,2,3,{ wood:3 }),
      O('Bench','','antique cottage',2,2,2,{ wood:2 },'up'),
      O('Log footboard','','rustic woodland',3,0,1,{ wood:3 }) ],
    bedding:[
      O('Plain quilt','','rustic cottage modern antique woodland',2,0,1,{},'up'),
      O('Patchwork quilt','Patchwork','cottage rustic',2,1,1,{},'up'),
      O('Knit throw','','cottage modern',2,1,1,{},'up'),
      O('Striped duvet','','modern cottage',2,0,1,{},'up'),
      O('Floral duvet','','cottage antique',2,1,1,{},'up'),
      O('Velvet coverlet','','antique',2,2,2,{},'up'),
      O('Moss blanket','Mossy','woodland',2,2,3,{ glimmermoss:1 },'find') ],
    canopy:[
      O('No canopy','','rustic cottage antique modern woodland',1,0,1),
      O('Four posts','Four-Poster','antique cottage rustic',2,1,2,{ wood:4 }),
      O('Drapes','Canopy','antique cottage',3,2,3,{ wood:4 },'up'),
      O('Fairy lights','','cottage woodland modern',1,1,2,{ iron:1 },'glow'),
      O('Ivy canopy','','woodland',2,2,2,{ softwood:4, weed:6 }) ] },

  shelf: { letter:'s', name:'Shelf', r:0.7, slots:['body','crown','foot','fill'], key:'body',
    labels:{ body:'Body', crown:'Crown', foot:'Base', fill:'On the shelves' },
    body:[
      O('Open shelves','Open','rustic cottage modern woodland',2,0,1,{ wood:5 }),
      O('Cubbies','Cubby','modern cottage',2,1,1,{ wood:6 }),
      O('Ladder shelf','Ladder','modern cottage',1,1,1,{ wood:4 }),
      O('Glass-front cabinet','Glass-front','antique',2,2,2,{ wood:6, clay:1 }),
      O('Arched niche','Arched','cottage antique',2,2,2,{ wood:6 }),
      O('Log shelves','Log','rustic woodland',3,0,1,{ wood:6 }),
      O('Hollow trunk','Hollow-trunk','woodland',3,3,3,{ stump:2 },'find') ],
    crown:[
      O('No crown','','rustic cottage antique modern woodland',1,0,1),
      O('Cornice','','antique cottage',2,1,1,{ wood:1 }),
      O('Gable top','','cottage rustic',2,1,1,{ wood:1 }),
      O('Scroll pediment','','antique',2,3,2,{ wood:2 }),
      O('Leafy garland','','woodland cottage',1,2,2,{ weed:4 }),
      O('Clock crown','','antique',2,3,3,{ wood:1, iron:1 },'mt') ],
    foot:[
      O('Plinth','','rustic cottage modern antique',2,0,1,{ wood:1 }),
      O('Bun feet','','cottage antique',2,1,1,{ wood:1 }),
      O('Bracket feet','','antique',2,2,2,{ wood:1 }),
      O('Tall legs','','modern',1,1,1,{ wood:2 }),
      O('Roots','','woodland',3,2,2,{ softwood:3 }) ],
    fill:[
      O('Empty','','rustic cottage antique modern woodland',1,0,1),
      O('Books','','cottage antique modern rustic',2,0,1,{}),
      O('Jars','','cottage rustic',1,1,1,{ clay:1 }),
      O('Plants','','cottage woodland modern',1,1,1,{ clay:1 }),
      O('Curiosities','','antique woodland',2,2,2,{ stone:1 }),
      O('A bit of everything','','rustic cottage antique woodland',2,1,1,{}),
      O('Crystals','','woodland modern',1,3,3,{ starstone:1 },'glow find') ] },

  lamp: { letter:'l', name:'Lamp', r:0.35, slots:['base','stem','shade','top'], key:'shade', glow:true,
    labels:{ base:'Base', stem:'Stem', shade:'Shade', top:'Finish' },
    base:[
      O('Round foot','','cottage modern antique',2,0,1,{ wood:1 }),
      O('Square block','','modern rustic',2,0,1,{ wood:1 }),
      O('Tripod','','modern rustic',1,1,1,{ wood:2 }),
      O('Stump','','rustic woodland',3,0,1,{ stump:1 }),
      O('Urn','','antique cottage',2,2,2,{ clay:2 }),
      O('Mushroom','','woodland',2,2,2,{ clay:1 }),
      O('Claw foot','','antique',2,3,3,{ iron:1 },'mt') ],
    stem:[
      O('Straight stem','','modern cottage rustic',1,0,1,{ wood:1 }),
      O('Turned stem','','cottage antique',2,2,1,{ wood:1 }),
      O('Twisted stem','','antique woodland',2,2,2,{ iron:1 },'mt'),
      O('Arc stem','Arc','modern',1,1,2,{ iron:1 },'mt'),
      O('Branch stem','','woodland rustic',2,1,1,{ softwood:2 }),
      O('Stacked rings','','modern cottage',2,1,1,{ wood:1 }) ],
    shade:[
      O('Drum shade','Drum','modern cottage rustic',2,0,1,{},'up'),
      O('Empire shade','Empire','cottage antique',2,1,1,{},'up'),
      O('Tulip glass','Tulip','antique cottage',1,2,2,{ clay:1 }),
      O('Dome shade','Dome','modern',2,1,1,{ iron:1 },'mt'),
      O('Lantern cage','Lantern','rustic',2,1,1,{ iron:1 },'mt'),
      O('Paper globe','Globe','modern cottage',2,0,1,{ weed:2 }),
      O('Mushroom cap','Toadstool','woodland',2,2,2,{ clay:1 }),
      O('Stained glass','Stained-glass','antique',2,3,3,{ clay:2, iron:1 }),
      O('Leaf cluster','Leaf','woodland',1,3,3,{ softwood:2, glimmermoss:1 },'find') ],
    top:[
      O('Plain','','rustic cottage antique modern woodland',1,0,1),
      O('Finial','','cottage antique',1,1,1,{ wood:1 }),
      O('Pull chain','','antique modern rustic',1,1,1,{ iron:1 },'mt'),
      O('Tassels','','antique cottage',1,1,2,{}),
      O('Firefly','','woodland',1,3,3,{ glimmermoss:1 },'find') ] },

  dresser: { letter:'d', name:'Dresser', r:0.7, slots:['body','feet','fronts','pulls','top'], key:'fronts',
    labels:{ body:'Body', feet:'Feet', fronts:'Fronts', pulls:'Handles', top:'On top' },
    body:[
      O('Chest of drawers','','rustic cottage modern antique',2,0,1,{ wood:8 }),
      O('Wide sideboard','Sideboard','cottage antique modern',3,1,1,{ wood:9 }),
      O('Tall cabinet','Cabinet','antique cottage rustic',3,1,2,{ wood:10 }),
      O('Bombe chest','Bombe','antique',3,3,3,{ wood:8, plank:2 }),
      O('Apothecary chest','Apothecary','cottage rustic',2,2,2,{ wood:8 }),
      O('Log chest','Log','rustic woodland',3,0,1,{ wood:10 }) ],
    feet:[
      O('Plinth','','rustic cottage modern',2,0,1,{ wood:1 }),
      O('Bun feet','','cottage antique',2,1,1,{ wood:1 }),
      O('Tapered legs','','modern cottage',1,1,1,{ wood:2 }),
      O('Bracket feet','','antique',2,2,2,{ wood:1 }),
      O('Cabriole legs','','antique',2,3,3,{ wood:2 }),
      O('Roots','','woodland',3,2,2,{ softwood:3 }) ],
    fronts:[
      O('Plain drawers','','rustic cottage modern antique',2,0,1,{}),
      O('Panel doors','Panelled','cottage antique rustic',2,1,1,{ wood:1 }),
      O('Glass doors','Glass-front','antique cottage',2,2,2,{ clay:1 }),
      O('Carved fronts','Carved','antique woodland',2,3,3,{ wood:2, heartwood:1 },'find'),
      O('Painted flowers','Painted','cottage',2,2,2,{ flower:2 }),
      O('Plank doors','Plank','rustic',2,0,1,{ wood:1 }),
      O('Slatted fronts','Slatted','modern',2,1,2,{ wood:1 }) ],
    pulls:[
      O('Wood knobs','','rustic cottage modern woodland',1,0,1,{}),
      O('Brass rings','','antique',1,1,1,{ iron:1 },'mt'),
      O('Iron bars','','rustic modern',1,1,1,{ iron:1 },'mt'),
      O('Cup pulls','','cottage modern',1,1,2,{ iron:1 },'mt'),
      O('Leaf pulls','','woodland',1,2,2,{ softwood:1 }),
      O('Crystal knobs','','antique cottage',1,2,3,{ clay:1 }) ],
    top:[
      O('Nothing on top','','rustic cottage antique modern woodland',1,0,1),
      O('Mirror','','antique cottage',2,2,2,{ wood:2, clay:1 }),
      O('Gallery rail','','cottage antique rustic',1,1,1,{ wood:1 }),
      O('Carved crown','','antique',2,3,3,{ wood:2 }),
      O('Potted plant','','cottage woodland modern',1,1,1,{ clay:1 }),
      O('Candles','','antique cottage rustic',1,1,2,{ iron:1 },'glow') ] },
};
export const BASE_IDS = Object.keys(BASES);
const BY_LETTER = Object.fromEntries(BASE_IDS.map(k=>[BASES[k].letter, k]));

/* Materials. tier = which crafting table you need before you can choose it. paint = flat colour, no grain. */
export const WOODS = [
  ['Pine',0xd9b27c,1], ['Oak',0xb98a55,1], ['Cherry',0xa0522d,2], ['Walnut',0x6b4a32,1], ['Ebony',0x3a2a22,3], ['Birch',0xe8d3a8,1],
  ['Driftwood',0xb8ad9c,1], ['Mahogany',0x7a3524,2], ['White',0xf4efe4,1,'paint'], ['Cream',0xf2e2c0,1,'paint'], ['Sage',0x9fb58f,1,'paint'],
  ['Duck-egg',0xa9cfd0,2,'paint'], ['Navy',0x34476a,2,'paint'], ['Rose',0xe4a4a4,2,'paint'], ['Mustard',0xd9a63a,2,'paint'], ['Forest',0x3f6a4a,2,'paint'],
].map(([name,c,tier,paint])=>({ name, c, tier, paint:!!paint }));
export const METALS = [ ['Black iron',0x2e2c2a,1], ['Brass',0xd8a040,1], ['Copper',0xc47a4a,2], ['Silver',0xc8ccd2,2], ['Gold leaf',0xf0c850,3] ].map(([name,c,tier])=>({ name, c, tier }));
export const FABRICS = [ ['Cream',0xf2e8d4], ['Rust',0xb4553a], ['Mustard',0xd9a63a], ['Forest',0x3f6a4a], ['Sage',0x9fb58f], ['Dusty rose',0xd99a9a], ['Burgundy',0x7a2a34],
  ['Emerald',0x2a7a5a], ['Navy',0x34476a], ['Sky',0x8ac0e0], ['Lavender',0xb4a0d0], ['Charcoal',0x4a4a50], ['Ochre',0xc08a3a], ['Toadstool red',0xc8403a] ].map(([name,c])=>({ name, c }));
export const PATTERNS = [ ['Plain',1], ['Gingham',1], ['Stripes',1], ['Floral',1], ['Damask',2], ['Velvet',2], ['Patchwork',2], ['Leaves',2], ['Stars',3] ].map(([name,tier])=>({ name, tier }));
// What each style picks from when a plan is generated
export const PALETTE = {
  rustic:   { wood:[0,1,3,6], wood2:[0,1,3,6,15], metal:[0,2], fabric:[0,1,2,3,12], pattern:[0,1,2,6] },
  cottage:  { wood:[8,9,10,11,13,0,5], wood2:[8,9,0,5,1], metal:[1,0,3], fabric:[0,5,9,10,4,2], pattern:[0,1,3,6] },
  antique:  { wood:[3,7,2,4], wood2:[3,7,2,4], metal:[1,4], fabric:[6,7,8,2,0], pattern:[0,4,5] },
  modern:   { wood:[5,1,4,8,12,14], wood2:[5,4,8,12], metal:[0,3,2], fabric:[11,0,2,8,9,1], pattern:[0,2] },
  woodland: { wood:[6,1,3,5,15], wood2:[6,3,1,15], metal:[2,0], fabric:[3,4,12,13,0], pattern:[0,7,8,1] },
};

/* ---------- design codes ---------- */
const D36 = '0123456789abcdefghijklmnopqrstuvwxyz';
export const isCustomId = id => typeof id==='string' && id.startsWith('cf_');
// A design: { base, parts:{ slot:index }, w, w2, m, f, p }
export function encode(d){ const B=BASES[d.base]; if (!B) return null;
  return 'cf_'+B.letter+B.slots.map(s=>D36[d.parts[s]|0]).join('')+[d.w,d.w2,d.m,d.f,d.p].map(n=>D36[n|0]).join(''); }
export function decode(id){
  if (!isCustomId(id)) return null; const s=id.slice(3), base=BY_LETTER[s[0]]; if (!base) return null;
  const B=BASES[base], n=B.slots.length; if (s.length!==1+n+5) return null;
  const v=[...s.slice(1)].map(ch=>D36.indexOf(ch)); if (v.some(x=>x<0)) return null;
  const parts={}; B.slots.forEach((sl,i)=>parts[sl]=v[i]);
  const [w,w2,m,f,p]=v.slice(n);
  if (B.slots.some(sl=>!B[sl][parts[sl]]) || !WOODS[w] || !WOODS[w2] || !METALS[m] || !FABRICS[f] || !PATTERNS[p]) return null;
  return { base, parts, w, w2, m, f, p };
}
export const partsOf = d => BASES[d.base].slots.map(sl=>[sl, BASES[d.base][sl][d.parts[sl]]]);
export const usesFabric = d => partsOf(d).some(([,o])=>o.up);
export const usesMetal = d => partsOf(d).some(([,o])=>o.mt);
export const glows = d => !!BASES[d.base].glow || partsOf(d).some(([,o])=>o.glow);

// The style a design reads as: the one most of its parts share
export function styleOf(d){ const n={}; for (const [,o] of partsOf(d)) if (o.styles.length<5) for (const s of o.styles) n[s]=(n[s]||0)+1;
  return Object.entries(n).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'cottage'; }

export function nameOf(d){
  const B=BASES[d.base], key=B[B.key][d.parts[B.key]], wood=WOODS[d.w].name, extra=[];
  for (const [sl,o] of partsOf(d)) if (sl!==B.key && o.tag && !extra.length) extra.push(o.tag);
  const tag = key.tag || extra[0] || '';
  const noun = d.base==='chair' && d.parts.legs===10 ? 'Rocking Chair' : d.base==='chair' && d.parts.arms>0 ? (d.parts.arms===3 ? 'Club Chair' : 'Armchair')
    : d.base==='bed' && d.parts.canopy===1 ? 'Four-Poster' : d.base==='shelf' && d.parts.body===3 ? 'Cabinet' : B.name;
  return [wood, tag, noun].filter(Boolean).join(' ').replace(/\b(\w+) \1\b/g, '$1');
}

/* ---------- materials and value ---------- */
export function matsOf(d){ const out={};
  for (const [,o] of partsOf(d)) for (const [m,n] of Object.entries(o.mats)) out[m]=(out[m]||0)+n;
  if (!Object.keys(out).length) out.wood=1;
  return out; }
// things you can mass-produce: copies of a piece made only from these sell for little over their value
const FARM = new Set(['wood','softwood','stone','weed']);
const valOf = m => (ITEMS[m] && ITEMS[m].price) || (m==='flower' ? 80 : 40);
export function matValue(d){ return Object.entries(matsOf(d)).reduce((a,[m,n])=>a+valOf(m)*n, 0); }
export const detailOf = d => partsOf(d).reduce((a,[,o])=>a+o.d, 0);
// Every copy sells for its materials plus 15%
export const copyPrice = d => Math.max(10, Math.round(matValue(d)*1.15/5)*5);
// The first time you sell a design you made yourself: a craftsmanship bonus for detail and for materials you can't farm
export function firstBonus(d){ const hard=Object.entries(matsOf(d)).filter(([m])=>!FARM.has(m)).reduce((a,[m,n])=>a+valOf(m)*n,0);
  return Math.round((350*detailOf(d) + hard*1.5 + 150*partsOf(d).filter(([,o])=>o.d>=2).length)/50)*50; }

/* ---------- items: any cf_ id becomes a furniture item the moment something asks for it ---------- */
export function customItem(id){
  const d=decode(id); if (!d) return null; const B=BASES[d.base];
  return def(id, { name:nameOf(d), kind:'furniture', buy:0, price:copyPrice(d), r:B.r, shop:'custom', stack:5, custom:true, glow:glows(d), style:styleOf(d),
    model:{ t:'custom', code:id } });
}
if (typeof ITEMS.__resolve === 'function') ITEMS.__resolve(customItem);

/* ---------- unlocks ---------- */
// What a player can use: options at or below their table tier (find-only options need a found plan), plus anything found
export function optionOpen(base, slot, i, tier, found){ const o=BASES[base][slot][i]; if (!o) return false;
  if (found && found.includes(base+'.'+slot+'.'+i)) return true; return !o.find && o.t<=tier; }
export const matOpen = (list, i, tier) => (list[i].tier||1)<=tier;

/* ---------- generated plans: stay in one style, keep the parts in proportion, pick colours from the style ---------- */
const pick = (a, r) => a[Math.floor(r()*a.length)%a.length];
export function generate(r, o={}){
  const base = o.base || pick(o.bases || BASE_IDS, r), B=BASES[base], style = o.style || pick(STYLES, r), P=PALETTE[style];
  const ok = (sl,i) => !o.open || o.open(base, sl, i);
  const fits = (opt, w) => Math.abs(opt.w-w)<=1;
  let w0=null; const parts={};
  for (const sl of B.slots){
    const opts=B[sl].map((x,i)=>[x,i]).filter(([x,i])=>x.styles.includes(style) && ok(sl,i));
    let pool = w0===null ? opts : opts.filter(([x])=>fits(x,w0));
    if (!pool.length) pool = opts.length ? opts : B[sl].map((x,i)=>[x,i]).filter(([,i])=>ok(sl,i));
    if (!pool.length) pool=[[B[sl][0],0]];
    // the "nothing" option (index 0 on optional slots) comes up about a third of the time, not more
    const none = pool.find(([x,i])=>i===0 && !x.d && x.styles.length===5);
    let ch = none && pool.length>1 ? (r()<0.34 ? none : pick(pool.filter(p=>p!==none), r)) : pick(pool, r);
    parts[sl]=ch[1]; if (w0===null) w0=ch[0].w;
  }
  const tierOk = (list, ix) => !o.tier || ix.filter(i=>matOpen(list,i,o.tier));
  const fromList = (list, ix) => { const ok2=tierOk(list, ix); return pick(ok2 && ok2.length ? ok2 : ix, r); };
  const w=fromList(WOODS, P.wood), w2 = r()<0.55 ? w : fromList(WOODS, P.wood2);
  return { base, parts, w, w2, m:fromList(METALS, P.metal), f:fromList(FABRICS, P.fabric), p:fromList(PATTERNS, P.pattern), style };
}

/* ---------- requests: how close is a piece to what an islander asked for (0..1) ---------- */
export function likeness(want, got){
  if (!want || !got || want.base!==got.base) return 0;
  const B=BASES[want.base]; let s=0, n=0;
  for (const sl of B.slots){ n+=2; if (want.parts[sl]===got.parts[sl]) s+=2; else { const a=B[sl][want.parts[sl]], b=B[sl][got.parts[sl]]; if (a && b && a.styles.some(x=>b.styles.includes(x)) && a.styles.length<5) s+=0.5; } }
  const woodNear = (a,b) => a===b ? 1 : (WOODS[a].paint===WOODS[b].paint ? 0.4 : 0);
  n+=2; s+=2*woodNear(want.w, got.w);
  if (usesFabric(want)){ n+=1; s+= want.f===got.f ? 1 : 0; }
  return Math.min(1, s/n); }

export const PERSONALITY_STYLE = { cheerful:'cottage', gruff:'rustic', dreamy:'woodland', sporty:'modern', caring:'cottage', elegant:'antique', lazy:'modern' };

// How many different shapes there are (for the wiki and for bragging)
export function shapeCount(){ let n=0; for (const k of BASE_IDS){ const B=BASES[k]; n+=B.slots.reduce((a,sl)=>a*B[sl].length, 1); } return n; }
