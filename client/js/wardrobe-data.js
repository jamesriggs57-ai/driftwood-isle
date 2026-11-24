// v1.19 wardrobe data (no Three.js here: content.js, and through it the server, import this file).
// Order matters: look codes store indexes, so only ever APPEND to these lists.
export const OUTFITS_NEW = [
  { id:'sailor',   name:'Sailor top' },
  { id:'raincoat', name:'Rain slicker' },
  { id:'cardigan', name:'Knit cardigan' },
  { id:'puffer',   name:'Puffer jacket' },
  { id:'flannel',  name:'Flannel shirt' },
  { id:'robe',     name:'Starry robe' },
  { id:'peacoat',  name:'Peacoat' },
  { id:'pajamas',  name:'Striped pajamas' },
  { id:'ruffle',   name:'Ruffle party dress' },
  { id:'varsity',  name:'Varsity jacket' },
];
export const BASE_COLOR_NAMES = ['Tomato','Tangerine','Lemon','Leaf','Teal','Sky','Violet','Rose','Cream','Charcoal'];
export const COLORS_NEW = [ [0xa8423a,'Brick'], [0xd8a030,'Mustard'], [0x9ab08a,'Sage'], [0x3a6a48,'Forest'], [0x2e3f6e,'Navy'],
  [0xc8b4ea,'Lavender'], [0xf6b89a,'Peach'], [0xa8e0c8,'Mint'], [0x7a3a6a,'Plum'], [0x7a5440,'Cocoa'] ];
export const SLOTS = ['hat','face','neck','back'];
export const SLOT_NAMES = { hat:'Hat', face:'Glasses', neck:'Neck', back:'Back' };
export const ACCESSORIES = [
  { id:'strawhat',   name:'Straw sun hat',      slot:'hat'  },
  { id:'sailorcap',  name:'Sailor cap',         slot:'hat'  },
  { id:'pombeanie',  name:'Pompom beanie',      slot:'hat'  },
  { id:'wizardhat',  name:'Wizard hat',         slot:'hat'  },
  { id:'flowercrown',name:'Flower crown',       slot:'hat'  },
  { id:'buckethat',  name:'Bucket hat',         slot:'hat'  },
  { id:'tophat',     name:'Top hat',            slot:'hat'  },
  { id:'anglercap',  name:'Angler\'s hat',      slot:'hat'  },
  { id:'ballcap',    name:'Ball cap',           slot:'hat'  },
  { id:'crown',      name:'Little gold crown',  slot:'hat'  },
  { id:'nightcap',   name:'Sleepy nightcap',    slot:'hat'  },
  { id:'roundspecs', name:'Round specs',        slot:'face' },
  { id:'shades',     name:'Sunglasses',         slot:'face' },
  { id:'starshades', name:'Star shades',        slot:'face' },
  { id:'monocle',    name:'Monocle',            slot:'face' },
  { id:'goggles',    name:'Aviator goggles',    slot:'face' },
  { id:'pearls',     name:'Pearl strands',      slot:'neck' },
  { id:'puka',       name:'Puka shell necklace',slot:'neck' },
  { id:'locket',     name:'Gold locket',        slot:'neck' },
  { id:'bandana',    name:'Bandana',            slot:'neck' },
  { id:'bowtie',     name:'Bow tie',            slot:'neck' },
  { id:'longscarf',  name:'Striped scarf',      slot:'neck' },
  { id:'lei',        name:'Flower lei',         slot:'neck' },
  { id:'moonstone',  name:'Moonstone pendant',  slot:'neck' },
  { id:'rucksack',   name:'Explorer rucksack',  slot:'back' , hideTail:true },
  { id:'bwings',     name:'Butterfly wings',    slot:'back' },
  { id:'shellpack',  name:'Seashell backpack',  slot:'back' , hideTail:true },
  { id:'cape',       name:'Starry cape',        slot:'back' },
  { id:'teddypack',  name:'Teddy backpack',     slot:'back' , hideTail:true },
  { id:'balloon',    name:'Heart balloon',      slot:'back' },
];
export const BY_SLOT = Object.fromEntries(SLOTS.map(s=>[s, ACCESSORIES.filter(a=>a.slot===s)]));
export const SLOT_N = Object.fromEntries(SLOTS.map(s=>[s, BY_SLOT[s].length]));
export const ACC_BY_ID = Object.fromEntries(ACCESSORIES.map(a=>[a.id,a]));

