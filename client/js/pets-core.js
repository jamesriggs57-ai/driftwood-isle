/* =====================================================================
   v1.67 PETS: data and rules only (no THREE, no DOM), so the server can import it too.
   One pet per player: a dog or a cat. Each has 4 common coats, 2 rare, 2 very rare and 1 legendary.
   Items: the Pet Collar (sewn at the sewing machine) and the Pet Basket (a pet you're giving away; it carries
   { sp, c, n } in its meta so it can be mailed or traded to a friend and let out on their island).
   ===================================================================== */
import { ITEMS, def } from './content.js';

export const SPECIES = { dog:{ name:'Dog', call:'Tchk tchk tchk', hi:'Arf!', calm:'Wuff?', happy:'Arf arf!' },
                         cat:{ name:'Cat', call:'Psst psst psst', hi:'Mrrp!', calm:'Mrrp?', happy:'Prrrrr' } };

/* coats: base (fur), alt (belly, muzzle, socks), dark (pattern), nose, eye. pat = pattern drawn on the body.
   rarity uses the game's labels: Common, Rare, Very rare, Legendary. glow: soft light (legendary only) */
export const COATS = {
  dog: [
    { id:'golden',   name:'Golden',        r:'Common',    base:0xe2a24c, alt:0xf6e2bc, dark:0xb87a34, nose:0x3a2a22, eye:0x2a1e18, pat:'solid' },
    { id:'cocoa',    name:'Cocoa',         r:'Common',    base:0x7a4a2c, alt:0xc8946a, dark:0x5a3420, nose:0x2a1a14, eye:0x1e1410, pat:'solid' },
    { id:'blacktan', name:'Black and Tan', r:'Common',    base:0x2e2824, alt:0xc8843e, dark:0x1e1a18, nose:0x141010, eye:0x3a2416, pat:'socks' },
    { id:'cream',    name:'Cream',         r:'Common',    base:0xf2e4c8, alt:0xffffff, dark:0xd8c098, nose:0x4a3428, eye:0x2a1e18, pat:'solid' },
    { id:'dotty',    name:'Dotty',         r:'Rare',      base:0xf8f6f0, alt:0xffffff, dark:0x26221e, nose:0x1e1a18, eye:0x2a1e18, pat:'spots' },
    { id:'merle',    name:'Blue Merle',    r:'Rare',      base:0x9aa4b4, alt:0xe8e8ec, dark:0x3e4652, nose:0x2a2a30, eye:0x4a7ab0, pat:'patches' },
    { id:'ember',    name:'Ember',         r:'Very rare', base:0xd2582a, alt:0xfff6ea, dark:0x8a2e14, nose:0x2a1a14, eye:0x3a2416, pat:'blaze' },
    { id:'silver',   name:'Silver',        r:'Very rare', base:0xc8ccd6, alt:0xf2f4f8, dark:0x8a92a2, nose:0x3a3a44, eye:0x5a8ac8, pat:'solid', sheen:true },
    { id:'starlit',  name:'Starlit',       r:'Legendary', base:0x2c3266, alt:0x5a64a8, dark:0xfff0b0, nose:0x141630, eye:0xffe8a0, pat:'stars', glow:0xfff0b0 },
  ],
  cat: [
    { id:'ginger',   name:'Ginger Tabby',  r:'Common',    base:0xe8964a, alt:0xfbe6c8, dark:0xb8642a, nose:0xd87a7a, eye:0x7ab040, pat:'stripes' },
    { id:'grey',     name:'Grey',          r:'Common',    base:0x8e939c, alt:0xd4d8de, dark:0x6a7078, nose:0xb07a84, eye:0xd8b040, pat:'solid' },
    { id:'black',    name:'Black',         r:'Common',    base:0x2a2624, alt:0x3a3532, dark:0x1a1716, nose:0x3a2a2a, eye:0xe8c030, pat:'solid' },
    { id:'tuxedo',   name:'Tuxedo',        r:'Common',    base:0x2a2624, alt:0xfaf8f2, dark:0x1a1716, nose:0xd8909a, eye:0x8ac050, pat:'tux' },
    { id:'calico',   name:'Calico',        r:'Rare',      base:0xfaf6ee, alt:0xffffff, dark:0xe0862e, nose:0xe09aa0, eye:0xc8a030, pat:'calico' },
    { id:'siamese',  name:'Siamese',       r:'Rare',      base:0xf0e2c8, alt:0xfaf2e2, dark:0x5a3e30, nose:0x4a3430, eye:0x4a90e0, pat:'points' },
    { id:'lilac',    name:'Lilac',         r:'Very rare', base:0xc4aecc, alt:0xece0f0, dark:0x9a84a6, nose:0xd890b0, eye:0xe0a040, pat:'solid', sheen:true },
    { id:'smoke',    name:'Snow Smoke',    r:'Very rare', base:0xdcdcdc, alt:0xf8f8f8, dark:0x6a6a70, nose:0xc8909a, eye:0x6ab0c8, pat:'spots' },
    { id:'moonlit',  name:'Moonlit',       r:'Legendary', base:0xe8f0ff, alt:0xffffff, dark:0x9ab8f0, nose:0xb0c0f0, eye:0x80c8ff, pat:'stripes', glow:0xb8d8ff },
  ],
};
/* odds per stray: the same shares as the rest of the game's finds (very rare 0.4%, legendary 1 in 5,000) */
export const COAT_ODDS = { 'Common':0.8958, 'Rare':0.10, 'Very rare':0.004, 'Legendary':0.0002 };
export function rollCoat(sp, r){   // r: a 0..1 number
  const list=COATS[sp]; let acc=0, tier='Common';
  for (const [t,p] of [['Legendary',COAT_ODDS.Legendary],['Very rare',COAT_ODDS['Very rare']],['Rare',COAT_ODDS.Rare]]){ acc+=p; if (r<acc){ tier=t; break; } }
  const pool=list.filter(c=>c.r===tier), k=Math.min(pool.length-1, Math.floor(((r*7919)%1)*pool.length));
  return pool[k].id; }
export const coatOf = (sp, id) => (COATS[sp]||COATS.dog).find(c=>c.id===id) || COATS[sp||'dog'][0];

/* names: picked from a list (no free text, like letters) */
export const NAMES = ['Biscuit','Pickle','Mochi','Pepper','Waffles','Juniper','Noodle','Clover','Pip','Maple','Bean','Toffee','Sprout','Muffin',
  'Olive','Pumpkin','Basil','Nutmeg','Tater','Dumpling','Wren','Fig','Button','Marbles','Pebble','Socks','Banjo','Scout','Doodle','Honey',
  'Cinder','Fennel','Moss','Taffy','Barnaby','Pudding','Ziggy','Lentil','Kipper','Sesame','Gravy','Rascal','Pancake','Turnip','Bramble'];

export const FOOD_KINDS = ['fish','fruit','food','veg','herb','berry'];
export const COLLAR = 'petcollar', BASKET = 'petbasket';
export const COLLAR_MATS = { weed:6 };

def(COLLAR, { name:'Pet Collar', kind:'item', price:40, stack:10, model:{ t:'petcollar' },
  desc:'A soft woven collar with a little bell. Fits a dog or a cat. Put it on a stray that trusts you and it\'s yours.' });
def(BASKET, { name:'Pet Basket', kind:'item', price:0, stack:1, noSell:true, noGift:true, model:{ t:'petbasket' },
  desc:'A pet curled up in a cosy basket, ready to go to a new home. Mail it or trade it to a friend, or let it out yourself.' });
