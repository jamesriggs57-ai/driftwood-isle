/* =====================================================================
   CONTENT: everything collectible, buyable, plantable or talkable.
   To add something new, add one entry here; the game picks it up.
   ===================================================================== */
import { range } from './util.js';
const ALL='all';
export const ITEMS = {};
export function def(id, o){ ITEMS[id] = Object.assign({ id, stack: 30 }, o); return ITEMS[id]; }

/* Rarity: weight used when rolling spawns. Higher = more common. */
export function rarityLabel(w){ return w>=5?'Common':w>=3?'Uncommon':w>=1.5?'Rare':w>=0.8?'Very rare':'Legendary'; }
export const RARITY_COLORS = { 'Common':'#8b6b50', 'Uncommon':'#4f9a3a', 'Rare':'#2f7fc0', 'Very rare':'#8a4fc0', 'Legendary':'#d08a10' };

/* ---------- Fruit (one native fruit per island; palms give coconuts). Fruit can be planted to grow a fruit tree. ---------- */
def('apple',  {name:'Apple',  kind:'fruit', price:100, plant:'fruittree', model:{t:'fruit', c:0xe2483d}});
def('pear',   {name:'Pear',   kind:'fruit', price:100, plant:'fruittree', model:{t:'fruit', c:0xc9d65a, pear:true}});
def('peach',  {name:'Peach',  kind:'fruit', price:100, plant:'fruittree', model:{t:'fruit', c:0xffb08a}});
def('orange', {name:'Orange', kind:'fruit', price:100, plant:'fruittree', model:{t:'fruit', c:0xf59a2f}});
def('plum',   {name:'Plum',   kind:'fruit', price:100, plant:'fruittree', model:{t:'fruit', c:0x8a4fa8}});
def('cherry', {name:'Cherries',kind:'fruit',price:100, plant:'fruittree', model:{t:'fruit', c:0xc8202a, cherry:true}});
def('lemon',  {name:'Lemon',  kind:'fruit', price:100, plant:'fruittree', model:{t:'fruit', c:0xf5dc40, pear:true}});
def('coconut',{name:'Coconut',kind:'fruit', price:150, plant:'palm', model:{t:'fruit', c:0x8a5a35, big:true}});
// Fruit that isn't native to the island sells for more (New Horizons pays 5x; ours is 2.5x because fruit is easier to farm here)
export const FOREIGN_FRUIT_PRICE = 250;
export const FRUIT_REGROW_DAYS = 3;   // a picked tree grows fruit again after this many days (New Horizons: 3)
export const NATIVE_FRUITS = ['apple','pear','peach','orange','plum','cherry','lemon'];

/* ---------- Materials ---------- */
def('wood',     {name:'Wood',           kind:'material', price:60,  model:{t:'log'}});
def('softwood', {name:'Driftwood Branch',kind:'material', price:20, model:{t:'branch'}});
def('stone',    {name:'Stone',          kind:'material', price:75,  model:{t:'stone'}});
def('clay',     {name:'Clay',           kind:'material', price:100, model:{t:'clay'}});
def('iron',     {name:'Iron Nugget',    kind:'material', price:375, model:{t:'iron'}});
def('weed',     {name:'Clump of Weeds', kind:'material', price:10,  model:{t:'weed'}});
def('stump',    {name:'Tree Stump',     kind:'material', price:180, stack:10, model:{t:'stump'}});   // dug up with a shovel; woodworkers turn it into stump furniture

/* ---------- Beach finds ---------- */
def('scallop',   {name:'Scallop',      kind:'shell', price:60,  rarity:5,   model:{t:'shell', s:'scallop', c:0xf5b9a0}});
def('cowrie',    {name:'Cowrie',       kind:'shell', price:40,  rarity:6,   model:{t:'shell', s:'cowrie', c:0xf3e2c4}});
def('conch',     {name:'Spiral Conch', kind:'shell', price:180, rarity:2.5, model:{t:'shell', s:'conch', c:0xf2c6a8}});
def('sanddollar',{name:'Sand Dollar',  kind:'shell', price:120, rarity:3,   model:{t:'shell', s:'disc', c:0xe9dcc0}});
def('starfish',  {name:'Starfish',     kind:'shell', price:150, rarity:3,   model:{t:'shell', s:'star', c:0xf08a5a}});
def('coral',     {name:'Pink Coral',   kind:'shell', price:500, rarity:1,   model:{t:'shell', s:'coral', c:0xf27a9a}});
def('seaglass',  {name:'Sea Glass',    kind:'shell', price:220, rarity:2,   model:{t:'shell', s:'glass', c:0x7ad8b0}});
def('pearl',     {name:'Pearl Oyster', kind:'shell', price:1200,rarity:0.4, model:{t:'shell', s:'pearl', c:0x9aa3ad}});

/* ---------- Fossils (dig cracks with a shovel) ---------- */
def('ammonite', {name:'Spiral Ammonite',   kind:'fossil', price:700,  rarity:4, model:{t:'fossil', s:'spiral'}});
def('trilobite',{name:'Tiny Trilobite',    kind:'fossil', price:600,  rarity:4, model:{t:'fossil', s:'bug'}});
def('fern',     {name:'Fern Imprint',      kind:'fossil', price:550,  rarity:5, model:{t:'fossil', s:'leaf'}});
def('sharktooth',{name:'Shark Tooth',      kind:'fossil', price:900,  rarity:3, model:{t:'fossil', s:'tooth'}});
def('amber',    {name:'Amber Drop',        kind:'fossil', price:1200, rarity:2, model:{t:'fossil', s:'amber'}});
def('urchin',   {name:'Sea Urchin Fossil', kind:'fossil', price:650,  rarity:4, model:{t:'fossil', s:'urchin'}});
def('claw',     {name:'Raptor Claw',       kind:'fossil', price:1500, rarity:1.5, model:{t:'fossil', s:'claw'}});
def('sealily',  {name:'Sea Lily Fossil',   kind:'fossil', price:800,  rarity:3, model:{t:'fossil', s:'lily'}});
def('wingfossil',{name:'Dragonfly Wing Fossil',kind:'fossil',price:1100,rarity:2, model:{t:'fossil', s:'wing'}});
def('tusk',     {name:'Mammoth Tusk',      kind:'fossil', price:1800, rarity:1, model:{t:'fossil', s:'tusk'}});
def('dinoegg',  {name:'Dino Egg',          kind:'fossil', price:2500, rarity:0.6, model:{t:'fossil', s:'egg'}});

/* ---------- Fish ----------
   where: sea | river | pond.  size: S M L XL (shadow).  hours [start,end) wrap past midnight.
   len: [min,max] cm.  k: weight factor (grams = k * cm^3).  m: model shape. */
const fish = (id, name, price, where, size, months, hours, rarity, len, k, m) =>
  def(id, { name, kind:'fish', price, where, size, months, hours, rarity, len, k, stack:1, model:Object.assign({t:'fish'}, m) });
// Sea
fish('minnow','Sand Minnow',120,'sea','S',ALL,null,6,[5,12],0.011,{c:0xb9c4c9,c2:0xe8eef0,l:0.7});
fish('silverbream','Silver Bream',220,'sea','M',ALL,null,5,[18,40],0.014,{c:0x9fb4c8,c2:0xeef4f8,l:0.9});
fish('sardine','Moon Sardine',260,'sea','S',ALL,[19,5],4,[12,24],0.009,{c:0x9fb2d8,c2:0xf4f6ff,l:0.75});
fish('coraldart','Coral Dart',300,'sea','S',range(4,10),[9,17],4,[8,16],0.012,{c:0xf2894a,c2:0xffffff,l:0.7});
fish('mackerel','Harbor Mackerel',400,'sea','M',range(6,11),null,4,[25,45],0.011,{c:0x3f7f8a,c2:0xcfe6e0,l:1.0});
fish('flounder','Sand Flounder',450,'sea','M',ALL,null,3.5,[20,50],0.012,{c:0xb8a27a,c2:0xe8dcc0,l:0.9,s:'flat'});
fish('snapper','Amber Snapper',500,'sea','M',range(9,12),null,3,[30,70],0.015,{c:0xd9663f,c2:0xffd2a8,l:1.0});
fish('puffer','Puffer Plum',650,'sea','S',[7,8,9],null,2,[10,25],0.03,{c:0xd8c25a,c2:0xfff3c0,l:0.6,s:'puff'});
fish('eel','Ribbon Eel',900,'sea','L',range(5,10),[16,9],2,[60,140],0.0015,{c:0x5c6b3f,c2:0xb8c27a,l:1.6,s:'eel'});
fish('cod','Frost Cod',700,'sea','L',[11,12,1,2,3],null,3,[40,90],0.012,{c:0x8aa0ae,c2:0xe6eef2,l:1.2});
fish('squid','Glass Squid',800,'sea','M',[11,12,1,2,3,4],[18,6],2,[15,40],0.01,{c:0xe8d8f0,c2:0xffffff,l:0.9,s:'squid'});
fish('octopus','Reef Octopus',1100,'sea','M',ALL,[17,7],1.6,[30,90],0.012,{c:0xd8604a,c2:0xf0a090,l:0.9,s:'octo'});
fish('lanternfish','Lantern Fish',1300,'sea','S',ALL,[20,4],1.3,[6,15],0.01,{c:0x3a3f6a,c2:0xffe08a,l:0.7,glow:true});
fish('seahorse','Seahorse',1100,'sea','S',range(4,11),null,1.2,[8,20],0.004,{c:0xf0b040,c2:0xffe0a0,l:0.6,s:'horse'});
fish('barrel','Old Barrelfish',1500,'sea','XL',ALL,[16,8],1,[80,160],0.013,{c:0x6b5a4a,c2:0xc9b49a,l:1.6});
fish('ray','Dawn Ray',2500,'sea','XL',range(4,11),[4,9],0.6,[80,200],0.006,{c:0x7a8fb0,c2:0xf0d8c8,l:1.4,s:'ray'});
fish('sunfish','Ocean Sunfish',4000,'sea','XL',[7,8,9],[9,16],0.4,[100,250],0.03,{c:0x9aa8b4,c2:0xdfe6ec,l:1.4,s:'sun'});
fish('shark','Tide Shark',8000,'sea','XL',[6,7,8,9],[16,4],0.25,[150,350],0.006,{c:0x6a7a8a,c2:0xe8eef2,l:1.8,s:'shark'});
// River
fish('dace','River Dace',140,'river','S',ALL,null,6,[8,18],0.011,{c:0xa8b4a0,c2:0xeef0e0,l:0.7});
fish('loach','Pebble Loach',200,'river','S',ALL,null,5,[8,16],0.007,{c:0x9a8a6a,c2:0xd8ccb0,l:0.8,s:'eel'});
fish('carp','Copper Carp',300,'river','L',ALL,null,4.5,[30,70],0.016,{c:0xb8803a,c2:0xf0d8a0,l:1.1});
fish('smelt','Sweet Smelt',350,'river','S',[3,4,5],null,4,[10,20],0.008,{c:0xc8d8d0,c2:0xffffff,l:0.75});
fish('trout','Speckled Trout',450,'river','M',range(3,11),[4,19],3.5,[20,55],0.012,{c:0x7a9a6a,c2:0xf0c8b0,l:1.0});
fish('darter','Rainbow Darter',600,'river','S',range(4,9),[9,16],2.5,[5,9],0.01,{c:0x4a8ad8,c2:0xf08a4a,l:0.6});
fish('catfish','Willow Catfish',800,'river','L',ALL,[16,9],2.5,[40,100],0.011,{c:0x5a5a4a,c2:0xb8b090,l:1.3,s:'cat'});
fish('salmon','Salmon Runner',900,'river','L',[9,10,11],null,2.5,[50,90],0.012,{c:0xc86a5a,c2:0xf8c0a8,l:1.2});
fish('pike','River Pike',1800,'river','L',[9,10,11,12,1,2],null,1.2,[50,120],0.009,{c:0x6a8a4a,c2:0xd8e0b0,l:1.5});
fish('char','Golden Char',3000,'river','M',[10,11,12,1,2,3],[4,8],0.6,[30,60],0.012,{c:0xe0b040,c2:0xfff0b0,l:1.0});
// Pond
fish('tadpole','Tadpole',100,'pond','S',[3,4,5,6,7],null,5,[2,5],0.05,{c:0x3a3a2a,c2:0x6a6a4a,l:0.4,s:'tad'});
fish('bluegill','Bluegill',200,'pond','S',ALL,[9,16],5,[10,22],0.02,{c:0x5a86b8,c2:0xd8e4a0,l:0.8});
fish('crayfish','Crayfish',220,'pond','S',range(4,9),null,4,[6,14],0.03,{c:0xc0402a,c2:0xe8805a,l:0.6,s:'cray'});
fish('killifish','Pond Killifish',260,'pond','S',ALL,null,4,[3,6],0.012,{c:0xd8a04a,c2:0xf8e0a0,l:0.5});
fish('goldfish','Lily Goldfish',1300,'pond','S',ALL,null,1.5,[5,15],0.02,{c:0xf08a20,c2:0xffd080,l:0.6});
fish('turtle','Mud Turtle',1200,'pond','M',range(5,10),[6,18],1.5,[15,30],0.09,{c:0x5a6a3a,c2:0xa8a070,l:0.8,s:'turtle'});
fish('mooncarp','Moon Carp',1600,'pond','M',ALL,[19,5],1.5,[30,60],0.016,{c:0xd8dcf0,c2:0xffffff,l:1.0});
fish('koi','Pond Koi',4000,'pond','M',ALL,null,0.5,[30,70],0.016,{c:0xffffff,c2:0xe8502a,l:1.1,s:'koi'});

/* ---------- Bugs ----------
   where: air (flies around) | flower (sits on flowers) | trunk (on tree trunks) | ground | beach | pond.
   len in mm. weather:'rain' = only when raining. */
const bug = (id, name, price, where, months, hours, rarity, len, k, m, weather) =>
  def(id, { name, kind:'bug', price, where, months, hours, rarity, len, k, weather, stack:1, model:Object.assign({t:'bug'}, m) });
bug('moth','Meadow Moth',120,'air',range(3,11),[19,4],5,[25,40],0.00004,{c:0xeae4d4,c2:0xc9bfa8,w:'moth'});
bug('sunwing','Sunwing Butterfly',160,'air',range(3,9),[7,17],5,[40,60],0.00002,{c:0xffe066,c2:0x3a3a3a,w:'fly'});
bug('ember','Ember Butterfly',220,'air',[9,10,11],[7,17],5,[40,60],0.00002,{c:0xf08a3c,c2:0x5a2a1a,w:'fly'});
bug('bluebell','Bluebell Butterfly',260,'air',[4,5,6],[8,16],3,[35,50],0.00002,{c:0x6fa8ff,c2:0x223355,w:'fly'});
bug('peacock','Peacock Butterfly',450,'air',[3,4,5,6],[8,17],2.5,[50,60],0.00002,{c:0xb83a3a,c2:0x4a6ad8,w:'fly'});
bug('swallowtail','Emerald Swallowtail',900,'air',[6,7,8],[8,16],1.5,[70,100],0.00002,{c:0x2ab070,c2:0x1a2a2a,w:'fly'});
bug('wanderer','Wanderer Butterfly',700,'air',[9,10,11],[8,16],2,[80,100],0.00002,{c:0xf09020,c2:0x2a1a10,w:'fly'});
bug('leafdancer','Leaf Dancer',300,'air',[10,11,12],[9,17],3,[30,45],0.00003,{c:0xc98a3c,c2:0x7a4a1a,w:'fly'});
bug('dragonfly','Dusk Dragonfly',280,'air',range(5,10),[15,20],3,[50,70],0.00003,{c:0x4fb0a0,c2:0xd8f0ff,w:'dragon'});
bug('damselfly','Ribbon Damselfly',350,'air',range(5,9),[8,17],3,[30,45],0.00002,{c:0x3a7ad8,c2:0xd8f0ff,w:'dragon'});
bug('snowmoth','Snowflake Moth',350,'air',[12,1,2],[16,23],4,[20,35],0.00004,{c:0xffffff,c2:0xbfd8ff,w:'moth'});
bug('frostmoth','Frost Moth',500,'air',[11,12,1,2],[18,6],3,[20,30],0.00004,{c:0xd8e8f8,c2:0x8aa8c8,w:'moth'});
bug('rainwing','Rainwing',500,'air',range(3,11),null,3,[40,55],0.00002,{c:0x5fc0d8,c2:0x204050,w:'fly'},'rain');
bug('starmoth','Star Moth',1200,'air',ALL,[22,4],1.2,[40,60],0.00004,{c:0x2a2f5a,c2:0xffe9a0,w:'moth',glow:true});
bug('glowbug','Glowbug',400,'air',[6,7,8],[19,4],3,[10,18],0.0001,{c:0x4a4a2a,c2:0xd8ff6a,w:'beetle',glow:true});
bug('lunamoth','Luna Moth',1800,'air',range(4,8),[21,3],0.8,[80,110],0.00003,{c:0xb8f0c0,c2:0xe8ffe8,w:'moth'});
bug('owlmoth','Great Owl Moth',2600,'air',range(6,9),[20,4],0.6,[120,160],0.00003,{c:0x8a6a4a,c2:0xe8d8b0,w:'moth'});
bug('bee','Honeybee',200,'flower',range(3,10),[8,17],4,[12,16],0.00008,{c:0xf0c030,c2:0x2a2010,w:'bee'});
bug('bumblebee','Bumblebee',300,'flower',range(4,9),[8,17],3,[15,25],0.0001,{c:0xf8d040,c2:0x1a1a1a,w:'bee',fat:true});
bug('ladybug','Ladybug',200,'flower',[3,4,5,6,10,11],[8,17],4,[5,9],0.0002,{c:0xe0302a,c2:0x1a1a1a,w:'lady'});
bug('mantis','Garden Mantis',450,'flower',range(3,11),[8,17],2.5,[60,90],0.00003,{c:0x7ac04a,c2:0xb8e080,w:'mantis'});
bug('orchidmantis','Orchid Mantis',2400,'flower',range(6,10),[8,17],0.6,[25,60],0.00003,{c:0xf8d0e8,c2:0xffffff,w:'mantis'});
bug('cicada','Song Cicada',300,'trunk',[7,8],[8,17],4,[30,45],0.00008,{c:0x5a6a3a,c2:0xd0e0d8,w:'cicada'});
bug('barkbeetle','Bark Beetle',150,'trunk',ALL,null,4,[5,12],0.0002,{c:0x4a3020,c2:0x6a4a30,w:'beetle'});
bug('treecricket','Tree Cricket',300,'trunk',range(8,11),[17,5],4,[12,20],0.0001,{c:0x9ac06a,c2:0xd8f0a0,w:'hopper'});
bug('walkingstick','Walking Stick',600,'trunk',range(7,11),[4,19],2,[70,120],0.00002,{c:0x8a7a4a,c2:0xa89a6a,w:'stick'});
bug('stag','Stag Beetle',2000,'trunk',[6,7,8],[19,4],0.8,[40,80],0.0001,{c:0x3a2a1a,c2:0x6a4a2a,w:'stag'});
bug('rhino','Rhino Beetle',1500,'trunk',range(6,9),[19,4],1,[50,80],0.0001,{c:0x2a1a10,c2:0x5a3a20,w:'rhino'});
bug('grasshopper','Grasshopper',160,'ground',range(7,11),[8,17],5,[30,55],0.00005,{c:0x7ab040,c2:0xb8d880,w:'hopper'});
bug('cricket','Field Cricket',130,'ground',[9,10,11],[17,6],5,[15,25],0.00006,{c:0x2a2018,c2:0x4a3a28,w:'hopper'});
bug('pillbug','Pill Bug',250,'ground',ALL,[17,8],3.5,[8,15],0.0003,{c:0x6a6a70,c2:0x8a8a90,w:'pill'});
bug('snail','Garden Snail',250,'ground',range(3,12),null,4,[20,35],0.0004,{c:0xc8a070,c2:0xb8b0a0,w:'snail'},'rain');
bug('fiddler','Fiddler Crab',300,'beach',range(4,10),[8,18],4,[15,30],0.0004,{c:0xe0602a,c2:0xf0d0a0,w:'crab'});
bug('hermit','Hermit Crab',1000,'beach',ALL,[19,8],2,[20,40],0.0004,{c:0xe08a6a,c2:0xf2c6a8,w:'hermit'});
bug('sandhopper','Sand Hopper',220,'beach',ALL,[18,6],4,[10,20],0.00008,{c:0xd8c8a0,c2:0xb8a880,w:'hopper'});
bug('skater','Pond Skater',140,'pond',range(5,9),[8,19],4,[10,16],0.00002,{c:0x3a3a3a,c2:0x6a6a6a,w:'skater'});

/* ---------- Plants ----------
   ptype: flower | shrub | tree.  days: days to fully grow.  bloom: months a shrub flowers. */
export const PLANTS = {
  tulip:     { name:'Tulip',     ptype:'flower', days:3, colors:[0xe8403a,0xf8d040,0xf8a0c0,0xffffff,0x8a4ac0], shape:'cup' },
  rose:      { name:'Rose',      ptype:'flower', days:4, colors:[0xd8202a,0xf8b0c0,0xffffff,0xf8d860,0x3a1a2a], shape:'rose' },
  daisy:     { name:'Daisy',     ptype:'flower', days:2, colors:[0xffffff,0xf8e8a0], shape:'daisy' },
  sunflower: { name:'Sunflower', ptype:'flower', days:4, colors:[0xf8c020], shape:'sun' },
  lily:      { name:'Lily',      ptype:'flower', days:3, colors:[0xffffff,0xf8a060,0xf8c0d0], shape:'star' },
  pansy:     { name:'Pansy',     ptype:'flower', days:2, colors:[0x6a4ac0,0xf8d040,0xe0503a,0xffffff], shape:'flat' },
  cosmos:    { name:'Cosmos',    ptype:'flower', days:3, colors:[0xf890c0,0xffffff,0xd8304a,0xf8b040], shape:'daisy' },
  hyacinth:  { name:'Hyacinth',  ptype:'flower', days:3, colors:[0x6a7ae0,0xf0a0d0,0xffffff], shape:'spike' },
  poppy:     { name:'Poppy',     ptype:'flower', days:2, colors:[0xe8302a,0xf8a030,0xffffff], shape:'cup' },
  lavender:  { name:'Lavender',  ptype:'flower', days:3, colors:[0x9a7ad8], shape:'lav' },
  bellflower:{ name:'Bellflower',ptype:'flower', days:3, colors:[0x5a7ae0,0xffffff], shape:'bell' },
  marigold:  { name:'Marigold',  ptype:'flower', days:2, colors:[0xf8a020,0xf8d040], shape:'pom' },
  hydrangea: { name:'Hydrangea', ptype:'shrub', days:4, bloom:[6,7], colors:[0x7a9ae8,0xf0a0c8] },
  azalea:    { name:'Azalea',    ptype:'shrub', days:4, bloom:[4,5], colors:[0xf060a0,0xffffff] },
  boxwood:   { name:'Boxwood',   ptype:'shrub', days:3, bloom:[], colors:[] },
  holly:     { name:'Holly',     ptype:'shrub', days:4, bloom:[11,12,1,2], colors:[0xd0202a], berries:true },
  hibiscus:  { name:'Hibiscus',  ptype:'shrub', days:4, bloom:[7,8,9], colors:[0xe8304a,0xf8e040] },
  camellia:  { name:'Camellia',  ptype:'shrub', days:4, bloom:[1,2,3], colors:[0xe8406a,0xffffff] },
  lilac:     { name:'Lilac',     ptype:'shrub', days:4, bloom:[4,5], colors:[0xb88ae0] },
  rosebush:  { name:'Rose Bush', ptype:'shrub', days:4, bloom:[5,6,7,8,9,10], colors:[0xd8202a,0xf8b0c0] },
  oak:       { name:'Oak',          ptype:'tree', days:5 },
  birch:     { name:'Birch',        ptype:'tree', days:5 },
  maple:     { name:'Maple',        ptype:'tree', days:5 },
  blossom:   { name:'Cherry Blossom',ptype:'tree', days:5 },
  cedar:     { name:'Cedar',        ptype:'tree', days:5 },
  pine:      { name:'Pine',         ptype:'tree', days:5 },
  palm:      { name:'Palm',         ptype:'tree', days:5, sand:true },
  fruittree: { name:'Fruit Tree',   ptype:'tree', days:5 },
};
for (const [id,p] of Object.entries(PLANTS)){
  if (p.ptype==='flower'){
    def(id, { name:p.name, kind:'flower', price:80, model:{t:'flower', sp:id} });
    def(id+'_seeds', { name:p.name+' Seeds', kind:'seed', plant:id, price:60, buy:240, model:{t:'seed', sp:id} });
  } else if (p.ptype==='shrub') def(id+'_start', { name:p.name+' Start', kind:'sapling', plant:id, price:70, buy:280, model:{t:'start', sp:id} });
  else if (id!=='fruittree' && id!=='palm') def(id+'_sapling', { name:p.name+' Sapling', kind:'sapling', plant:id, price:160, buy:640, model:{t:'sapling', sp:id} });
}
def('palm_sapling', { name:'Palm Sapling', kind:'sapling', plant:'palm', price:160, buy:640, model:{t:'sapling', sp:'palm'} });

/* ---------- Furniture ----------
   b = builder in models.js. r = footprint radius. shop: 'stall' daily stock, 'rare' peddler only. indoor/outdoor are both fine. */
const furn = (id, name, buy, r, o={}) => def(id, Object.assign({ name, kind:'furniture', buy, price:Math.round(buy/4), r, shop:'stall', stack:5, model:{t:'furn', b:o.b||id} }, o));
// v1.13 rarity: every shop piece has a rarity weight (same scale as fish and bugs, see rarityLabel).
// Shops roll their daily stock by rarity, so commons show up most days and very rare pieces only now and then.
export const FR = { c:8, u:4, r:1.8, v:1, l:0.5 };
const C={rarity:FR.c}, U={rarity:FR.u}, R={rarity:FR.r}, V={rarity:FR.v};
furn('stool','Stump Stool',400,0.45,C);
furn('bench','Log Bench',900,0.9,C);
furn('table','Round Garden Table',1100,0.75,U);
furn('plant','Potted Fern',500,0.4,C);
furn('monstera','Potted Monstera',900,0.45,U);
furn('lantern','Garden Lantern',1200,0.35,{glow:true,...U});
furn('crate','Fruit Crate',600,0.5,C);
furn('planter','Flower Planter',800,0.7,C);
furn('blanket','Picnic Blanket',700,0.9,{flat:true,...C});
furn('birdbath','Stone Birdbath',1500,0.5,U);
furn('signpost','Wooden Signpost',450,0.3,C);
furn('fence','Wooden Fence',300,0.55,{stack:30,...C});
furn('mailbox','Mailbox',700,0.3,C);
furn('bed','Cozy Bed',2500,1.0,U);
furn('bookshelf','Bookshelf',1800,0.7,U);
furn('rug','Round Rug',1200,1.1,{flat:true,...U});
furn('armchair','Armchair',1500,0.6,U);
furn('floorlamp','Floor Lamp',1300,0.35,{glow:true,...U});
furn('dresser','Dresser',1600,0.65,U);
furn('desk','Writing Desk',1700,0.75,U);
furn('stove','Wood Stove',3000,0.6,{glow:true,...U});
furn('pumpkin','Harvest Pumpkin',650,0.5,{months:[9,10,11],...C});
furn('snowbuddy','Snow Buddy',650,0.5,{months:[12,1,2],...C});
// v1.13 new everyday pieces
furn('wickerbasket','Wicker Basket',450,0.4,C);
furn('bookstack','Stack of Books',500,0.35,C);
furn('cactus','Potted Cactus',450,0.35,C);
furn('ottoman','Knit Ottoman',800,0.45,C);
furn('sidetable','Side Table',900,0.4,C);
furn('tulipvase','Tulip Vase',550,0.3,C);
furn('rocker','Rocking Chair',2400,0.6,U);
furn('gramophone','Gramophone',3400,0.5,U);
furn('hammock','Hammock',3600,1.3,U);
furn('easel','Painter\'s Easel',2800,0.55,U);
furn('birdfeeder','Bird Feeder',1900,0.4,U);
// Rare and very rare: they still turn up at Pemberton's, just not often
furn('grandfather','Grandfather Clock',5200,0.5,R);
furn('piano','Upright Piano',12000,0.8,R);
furn('shipbottle','Ship in a Bottle',6500,0.4,R);
furn('orrery','Brass Orrery',9500,0.5,R);
furn('musicbox','Carousel Music Box',8200,0.45,R);
furn('tiffany','Stained Glass Lamp',7200,0.4,{glow:true,...R});
furn('crystalball','Crystal Ball',26000,0.45,{glow:true,...V});
furn('harp','Gilded Harp',34000,0.55,V);
furn('beaconlamp','Lighthouse Lamp',29000,0.5,{glow:true,...V});
// Fennick's cart
furn('umbrella','Beach Umbrella',2200,0.5,{shop:'rare',...R});
furn('campfire','Cozy Campfire',2800,0.8,{shop:'rare',glow:true,...R});
furn('windchime','Shell Wind Chime',2000,0.35,{shop:'rare',...R});
furn('telescope','Brass Telescope',4200,0.5,{shop:'rare',...R});
furn('birdcage','Golden Birdcage',30000,0.45,{shop:'rare',...V});
// Crafted only (shop:'craft' keeps them out of the stall and peddler)
furn('workbench','Workbench',1600,0.75,{shop:'craft'});
furn('logpile','Log Pile',500,0.7,{shop:'craft'});
furn('birdhouse','Birdhouse',800,0.3,{shop:'craft'});
furn('driftchair','Driftwood Chair',1100,0.5,{shop:'craft'});
furn('arbor','Driftwood Arbor',2400,1.0,{shop:'craft'});
furn('planterbox','Planter Box',900,0.6,{shop:'craft'});
// Stump woodworking: every piece needs a stump you dug up yourself
furn('stumpstool','Mossy Stump Seat',700,0.4,{shop:'craft'});
furn('stumptable','Stump Side Table',1400,0.55,{shop:'craft'});
furn('stumpplanter','Hollow Stump Planter',1500,0.5,{shop:'craft'});
furn('stumplamp','Mushroom Stump Lamp',2600,0.45,{shop:'craft',glow:true});
furn('stumpbench','Split Stump Bench',2400,0.9,{shop:'craft'});
// v1.14 party game prizes (never sold in shops)
furn('bonkcup','Bonk Ball Cup',4000,0.4,{shop:'party',rarity:FR.r});
furn('crowncup','Crown Keeper Cup',4000,0.4,{shop:'party',rarity:FR.r});

/* ---------- v1.13 Rare woodworking ----------
   Showpiece furniture. You need the plan (found, never bought in a shop except from Fennick now and then)
   and rare ingredients that only turn up by chance while doing ordinary island things. */
const RM = (id, name, price, how, o={}) => def(id, Object.assign({ name, kind:'material', price, rarity:FR.v, stack:10, rare:true, how, model:{t:'rare', s:id} }, o));
RM('heartwood',  'Heartwood',    2500, 'Now and then when you chop wood, more often when a tree comes down');
RM('goldsap',    'Golden Sap',   2500, 'Now and then when you shake a tree (once per tree a day)');
RM('starstone',  'Starstone',    3000, 'Now and then when you hit rocks, more often at night');
RM('moonpearl',  'Moonpearl',    3000, 'Now and then with a catch, or washed up on the beach');
RM('glimmermoss','Glimmer Moss', 2000, 'Grows on old stumps: sometimes comes up when you dig one out, or with weeds at night');
const legend = (id, name, buy, r, o={}) => furn(id, name, buy, r, Object.assign({ shop:'craft', rarity:FR.l, legendary:true, glow:true, stack:1 }, o));
legend('lanterntree',  'Heartwood Lantern Tree', 90000, 0.75);
legend('pearlfountain','Moonpearl Fountain',    110000, 1.0);
legend('armillary',    'Celestial Armillary',   100000, 0.6);
legend('saplamp',      'Golden Sap Lamp',        80000, 0.45);
legend('grotto',       'Glimmer Grotto',        120000, 1.0);
legend('wishwell',     'Wishing Well',          130000, 0.9);
export const RARE_WORK = [
  { id:'lanterntree',   mats:{ heartwood:3, glimmermoss:2, goldsap:1, wood:12 } },
  { id:'pearlfountain', mats:{ moonpearl:3, starstone:1, stone:12, clay:4 } },
  { id:'armillary',     mats:{ starstone:3, goldsap:1, iron:6 } },
  { id:'saplamp',       mats:{ goldsap:3, heartwood:1, iron:3 } },
  { id:'grotto',        mats:{ glimmermoss:3, starstone:2, moonpearl:1, stone:10 } },
  { id:'wishwell',      mats:{ heartwood:2, moonpearl:2, goldsap:1, stone:10, wood:4 } },
];
// One plan item per showpiece. Plans are learned the moment you pick one up, so you never hold duplicates.
for (const r of RARE_WORK){ r.plan='plan_'+r.id; def(r.plan, { name:'Plan: '+ITEMS[r.id].name, kind:'plan', learns:r.id, price:6000, rarity:FR.l, stack:1, model:{t:'plan', of:r.id} }); }
// How often rare things turn up (chance per action). Potions double the matching ones.
export const RARE_ODDS = { chop:0.012, fell:0.06, shake:0.02, rock:0.012, rockNight:0.03, catch:0.015, stump:0.1, weedNight:0.03,
  beachPearl:0.06, digPlan:0.015, bottlePlan:0.03, peddlerPlan:0.35 };
export const PLAN_PRICE = 45000;   // Fennick's price for a plan

/* ---------- Woodworking ----------
   No random recipe drops: every plan is visible from the start, with its unlock shown.
   unlock = how many DIFFERENT things you've made, so variety opens plans, not spamming fences. out = how many one craft makes. */
export const WOODWORK = [
  { id:'stool',      mats:{ wood:3 },              unlock:0 },
  { id:'fence',      mats:{ wood:2 },   out:3,     unlock:0 },
  { id:'logpile',    mats:{ wood:5 },              unlock:0 },
  { id:'signpost',   mats:{ wood:2, softwood:1 },  unlock:0 },
  { id:'workbench',  mats:{ wood:6, iron:1 },      unlock:0 },
  { id:'birdhouse',  mats:{ wood:3, softwood:2 },  unlock:2 },
  { id:'crate',      mats:{ wood:4, softwood:2 },  unlock:2 },
  { id:'bench',      mats:{ wood:6 },              unlock:2 },
  { id:'planterbox', mats:{ wood:5, clay:1 },      unlock:5 },
  { id:'driftchair', mats:{ softwood:6, wood:2 },  unlock:5 },
  { id:'table',      mats:{ wood:6, iron:1 },      unlock:5 },
  { id:'bookshelf',  mats:{ wood:8, iron:1 },      unlock:8 },
  { id:'desk',       mats:{ wood:8, iron:2 },      unlock:8 },
  { id:'dresser',    mats:{ wood:8, iron:2 },      unlock:11 },
  { id:'arbor',      mats:{ softwood:10, wood:4 }, unlock:11 },
  { id:'stumpstool', mats:{ stump:1 },             unlock:0 },
  { id:'stumptable', mats:{ stump:1, wood:3 },     unlock:2 },
  { id:'stumpplanter',mats:{ stump:1, clay:1, weed:3 }, unlock:5 },
  { id:'stumpbench', mats:{ stump:2, wood:4 },     unlock:5 },
  { id:'stumplamp',  mats:{ stump:1, iron:1, softwood:2 }, unlock:8 },
];

/* ---------- Tools ----------
   Each tool has tiers. uses = durability. Golden tiers need you to prove yourself first (req).
   forever:true = Heirloom tier, never breaks. */
export const TOOLS = {
  net:    { name:'Net',          does:'Catch bugs', stat:'bugs', tiers:[
    { name:'Flimsy Net',   cost:400,   uses:30,  bonus:0 },
    { name:'Sturdy Net',   cost:2500,  uses:90,  bonus:0.12, req:{ tool:0, desc:'Own a Flimsy Net first' } },
    { name:'Golden Net',   cost:40000, uses:300, bonus:0.25, req:{ tool:1, stat:40, desc:'Catch 40 bugs' } },
    { name:'Heirloom Net', cost:120000, uses:0, forever:true, bonus:0.25, req:{ tool:2, stat:120, desc:'Own a Golden Net and catch 120 bugs' } } ] },
  rod:    { name:'Fishing Rod',  does:'Catch fish', stat:'fish', tiers:[
    { name:'Flimsy Rod',   cost:400,   uses:30,  bonus:0 },
    { name:'Sturdy Rod',   cost:2500,  uses:90,  bonus:0.12, req:{ tool:0, desc:'Own a Flimsy Rod first' } },
    { name:'Golden Rod',   cost:40000, uses:300, bonus:0.25, req:{ tool:1, stat:40, desc:'Catch 40 fish' } },
    { name:'Heirloom Rod', cost:120000, uses:0, forever:true, bonus:0.25, req:{ tool:2, stat:120, desc:'Own a Golden Rod and catch 120 fish' } } ] },
  shovel: { name:'Shovel',       does:'Dig fossils, plant saplings, dig up plants and stumps', stat:'dug', tiers:[
    { name:'Flimsy Shovel',cost:500,   uses:30,  bonus:0 },
    { name:'Sturdy Shovel',cost:2500,  uses:90,  bonus:0.15, req:{ tool:0, desc:'Own a Flimsy Shovel first' } },
    { name:'Golden Shovel',cost:40000, uses:300, bonus:0.3, req:{ tool:1, stat:30, desc:'Dig up 30 things' } },
    { name:'Heirloom Shovel',cost:120000, uses:0, forever:true, bonus:0.3, req:{ tool:2, stat:100, desc:'Own a Golden Shovel and dig up 100 things' } } ] },
  axe:    { name:'Axe',          does:'Chop wood. Sturdy and Golden axes can cut trees down', stat:'chopped', tiers:[
    { name:'Flimsy Axe',   cost:600,   uses:30,  bonus:0, nofell:true },
    { name:'Sturdy Axe',   cost:3000,  uses:90,  bonus:0, req:{ tool:0, desc:'Own a Flimsy Axe first' } },
    { name:'Golden Axe',   cost:40000, uses:300, bonus:1, req:{ tool:1, stat:60, desc:'Chop 60 times' } },
    { name:'Heirloom Axe', cost:120000, uses:0, forever:true, bonus:1, req:{ tool:2, stat:180, desc:'Own a Golden Axe and chop 180 times' } } ] },
  can:    { name:'Watering Can', does:'Water plants so they grow faster', stat:'watered', tiers:[
    { name:'Watering Can', cost:500,   uses:40,  bonus:0 },
    { name:'Golden Can',   cost:30000, uses:300, bonus:1, req:{ tool:0, stat:40, desc:'Water 40 times' } },
    { name:'Heirloom Can', cost:90000, uses:0, forever:true, bonus:1, req:{ tool:1, stat:120, desc:'Own a Golden Can and water 120 times' } } ] },
};

/* ---------- Backpacks: each one is harder to get ---------- */
export const BASE_SLOTS = 20;
export const BACKPACKS = [
  { name:'Canvas Backpack',       slots:30, cost:5000 },
  { name:'Explorer Pack',         slots:40, cost:30000,  req:{ caught:25, desc:'Catch 25 fish or bugs' } },
  { name:'Voyager Pack',          slots:50, cost:100000,  req:{ caught:80, discovered:60, desc:'Catch 80 critters and discover 60 items' } },
  { name:'Grand Expedition Pack', slots:60, cost:300000, req:{ caught:200, discovered:110, bestFriends:3, desc:'Catch 200 critters, discover 110 items and become best friends with 3 islanders' } },
];

/* ---------- Home upgrades (pay into the Island Board at your own pace). room = interior size [w,d] ---------- */
export const HOUSE_LEVELS = [
  { name:'Camping Tent',  cost:0,     room:[6,6] },
  { name:'Cozy Cottage',  cost:1500,  room:[8,7] },
  { name:'Seaside House', cost:8000,  room:[10,9] },
  { name:'Grand Manor',   cost:30000, room:[13,11] },
];

/* ---------- Residents ----------
   ears: long | round | cat | goat | mouse | deer | sheep.  loves/likes: item kinds for gift reactions.
   homeHours: extra hours they spend indoors (they always sleep at home 11pm to 6am).
   room: interior. items are [builder, x, z, rotation] relative to room center. */
export const RESIDENTS = [
  { id:'pippa', acc:['flower'], top:'overalls', name:'Pippa', species:'rabbit', ears:'long', fur:0xf2dccb, muzzle:0xfff3e8, shirt:0xf6d04d, cheek:0xf5a3a3, home:[18,12], voice:620,
    personality:'cheerful', catch:'hop-hop', loves:['fruit','flower'], likes:['bug','shell'], homeHours:[[12,13]],
    room:{ floor:0xe8c49a, wall:0xfff0c8, pattern:'dots', accent:0xf6a04d, items:[['bed',-2,-2,0],['rug',0,0.5,0],['plant',2.4,-2.4,0],['table',1.6,0.6,0],['stool',2.6,1.4,0],['floorlamp',-2.6,0.8,0],['planter',0,-2.6,0]] } },
  { id:'bramble', acc:['scarf'], accC:0x5aae6a, name:'Bramble', species:'bear', ears:'round', fur:0x9a6b4a, muzzle:0xd9b48f, shirt:0xb5523b, cheek:0xd98a7a, home:[-30,6], voice:240,
    personality:'gruff', catch:'hrmph', loves:['fish','material'], likes:['fruit','furniture'], homeHours:[[6,8],[17,18]],
    room:{ floor:0x9a6a40, wall:0xd8c0a0, pattern:'stripe', accent:0x7a3a2a, items:[['bed',-2,-2,0],['stove',2.2,-2.4,0],['armchair',1.4,0,-0.6],['crate',-2.6,1,0],['bookshelf',0,-2.7,0],['rug',0,0.6,0]] } },
  { id:'lumi', acc:['beret'], accC:0x6a4aa8, name:'Lumi', species:'cat', ears:'cat', fur:0xc9b8e6, muzzle:0xf2ecff, shirt:0x5fbdb7, cheek:0xf0a0c8, home:[4,24], voice:470,
    personality:'dreamy', catch:'mrrm', loves:['shell','fossil'], likes:['bug','flower'], homeHours:[[14,16]],
    room:{ floor:0xc8b8d8, wall:0xe8e0f8, pattern:'dots', accent:0x8a6ac0, items:[['bed',-2,-2,0],['telescope',2.2,-2.2,-0.6],['rug',0,0.5,0],['monstera',-2.6,1.2,0],['desk',2.2,0.6,-Math.PI/2],['floorlamp',2.6,-0.8,0]] } },
  { id:'otis', acc:['headband'], accC:0xe2483d, name:'Otis', species:'goat', ears:'goat', fur:0xe8e0d0, muzzle:0xfff8f0, shirt:0x3a7ad8, cheek:0xf0a0a0, home:[32,-8], voice:380,
    personality:'sporty', catch:'let\'s go', loves:['fish','bug'], likes:['fruit','material'], homeHours:[[13,14]],
    room:{ floor:0xb8b8b8, wall:0xd8e8f0, pattern:'stripe', accent:0x3a7ad8, items:[['bed',-2,-2,0],['bench',1.8,-2.4,0],['crate',2.6,1,0],['rug',0,0.5,0],['plant',-2.6,1,0],['dresser',0,-2.6,0]] } },
  { id:'mabel', acc:['apron'], accC:0xf8e8f0, name:'Mabel', species:'mouse', ears:'mouse', fur:0xb8a8a0, muzzle:0xf0e4dc, shirt:0xe88aa8, cheek:0xf5a3b3, home:[-8,-42], voice:700,
    personality:'caring', catch:'dear', loves:['flower','fruit'], likes:['shell','furniture'], homeHours:[[9,11],[16,17]],
    room:{ floor:0xd8a878, wall:0xfff0f0, pattern:'check', accent:0xe88aa8, items:[['bed',-2,-2,0],['table',1.2,0,0],['stool',2.2,0.4,0],['stool',0.4,0.8,0],['stove',2.4,-2.4,0],['planter',-2.6,0.6,Math.PI/2],['rug',-0.4,1,0]] } },
  { id:'juniper', acc:['pearls'], name:'Juniper', species:'deer', ears:'deer', fur:0xc8905a, muzzle:0xf8e8d8, shirt:0x2a5a4a, cheek:0xf0a090, home:[-30,-30], voice:540,
    personality:'elegant', catch:'darling', loves:['furniture','fossil'], likes:['flower','shell'], homeHours:[[10,12]],
    room:{ floor:0x6a4a3a, wall:0xe8f0e0, pattern:'stripe', accent:0x2a5a4a, items:[['bed',-2,-2,0],['bookshelf',1.6,-2.7,0],['armchair',2,0.2,-0.8],['floorlamp',2.8,-1,0],['rug',0,0.6,0],['monstera',-2.6,1,0],['birdbath',-0.2,-2.4,0]] } },
  { id:'clover', acc:['glasses'], top:'stripe', name:'Clover', species:'sheep', ears:'sheep', fur:0xfafafa, muzzle:0xf0e0d0, shirt:0x9ac06a, cheek:0xf5b0b0, home:[16,-30], voice:420,
    personality:'lazy', catch:'mmbaa', loves:['fruit','fish'], likes:['flower','furniture'], homeHours:[[11,14]],
    room:{ floor:0xc8a878, wall:0xf8f0d8, pattern:'check', accent:0x9ac06a, items:[['bed',-2,-2,0],['blanket',1.2,0.4,0.3],['crate',2.6,-2.2,0],['crate',2.6,-1.3,0.4],['armchair',-1.6,0.8,0.7],['plant',2.6,1.4,0]] } },
];

/* ---------- Dialogue by personality ----------
   {p}=player name, {c}=catchphrase, {item}=gift name, {isle}=island name */
export const DIALOGUE = {
  cheerful: {
    morning:['Good morning, {p}! The air smells like adventure today, {c}!','Up early too? We are basically sunrise twins, {c}!'],
    day:['Oh! {p}! I was JUST thinking about you, {c}!','Hiii, {p}! Isn\'t {isle} the best island ever, {c}?'],
    evening:['The sky is going all peachy. Isn\'t that the best, {c}?'],
    night:['Ooh, a night walk? I love it when the stars come out, {c}!'],
    rain:['Puddles! Puddles everywhere, {c}! Best. Day. Ever.'], snow:['Snow! We should make snow buddies, {c}!'],
    home:['You came to visit! Make yourself at home, {c}!','Welcome to my burrow! Well, house. But it FEELS like a burrow, {c}.'],
    chat:['I tried counting all the flowers on the island. I got to 41 and then saw a butterfly.','If you find a really shiny shell, would you show me? I promise I will only stare at it a little.','I think the island hums at night. Have you heard it?','Bramble pretends to be grumpy, but he waved at a seagull yesterday. I saw it!','I want to plant a whole row of fruit trees someday. A fruit tunnel, {c}!','Otis challenged me to a race. I lost, but I found a ladybug, so who really won?'],
    again:['Hehe, talking to you twice in one day? Lucky me, {c}!','I am going to go look for ladybugs. Wanna race? Kidding, you would win.'],
    love:['For ME?! A {item}! I am going to treasure it forever and ever, {c}!'], like:['Ooh, a {item}! Thank you, {p}!'], meh:['Oh! A {item}. That is... very thoughtful, {c}!'],
    returnGift:['Wait wait wait, I have something for you too! Here!'], best:['You are my best friend on the whole island, {p}. Do not tell the butterflies.'],
    sleep:['Zzz... hop... hop... mmm... carrots...'],
  },
  gruff: {
    morning:['Mornin\'. You\'re up early. ...Good. {c}.'], day:['Oh. It\'s you, {p}. Fine weather for working, {c}.','Hm. Don\'t trample the grass. It\'s trying its best.'],
    evening:['Sun\'s going down. Don\'t stay out too late, {c}.'], night:['What are you doing up? ...Not that I care. Watch your step, {c}.'],
    rain:['Rain\'s good for the trees. Don\'t tell anyone I said something nice, {c}.'], snow:['Snow. Cold. Fine. I like it, {c}.'],
    home:['Wipe your feet. ...Fine, come in. {c}.','You found my place. Don\'t touch the stove.'],
    chat:['Fixed the wobbly plank on the dock. Somebody had to.','Pippa keeps leaving flowers on my porch. I put them in water. So they don\'t go to waste.','A good stick is hard to find. You find a good stick, you hold onto it.','Fish bite better near dawn and dusk. Not that I\'m giving you tips.','Get yourself a real axe. A flimsy one won\'t take a tree down.','Mabel brought me soup. I didn\'t ask. It was good soup.'],
    again:['We already talked. I\'m not a talking machine, {c}.','...Still here? Go catch a fish or something.'],
    love:['...This is a really good {item}. You didn\'t have to. Thanks, {c}.'], like:['Huh. A {item}. I\'ll find a spot for it.'], meh:['A {item}. ...Okay. I\'ll take it, {c}.'],
    returnGift:['Here. I made too many of these. Take one before I change my mind.'], best:['You\'re... alright, {p}. More than alright. {c}.'],
    sleep:['Snrrrk... {c}... five more minutes...'],
  },
  dreamy: {
    morning:['The morning light is all soft and gold today, {c}. Did you notice?'], day:['Oh, hello, {p}. I was listening to the waves. They have opinions, {c}.','Do you ever feel like the island is smiling? I do, {c}.'],
    evening:['This is my favorite hour. Everything glows a little, {c}.'], night:['The stars are out. I like to think they watch the island back, {c}.'],
    rain:['Rain is just the sky telling a very long story, {c}.'], snow:['Every snowflake is a tiny letter from the clouds, {c}.'],
    home:['Oh, you found my little nest. I was just looking at the stars, {c}.'],
    chat:['I dreamed the island was a big sleepy turtle. I hope it\'s comfortable.','Every shell is a tiny house someone moved out of. Isn\'t that sweet?','I found a fossil once that looked like a spiral staircase.','Do you think fish dream? I think they dream about being birds.','I\'m writing a poem about Bramble. It\'s mostly about his eyebrows.','Moths at night are just butterflies who like secrets.'],
    again:['We could just sit here a while, {c}. Quiet is nice too.','Mm. I\'m still thinking about what you said earlier, {p}. Or what I imagined you said.'],
    love:['A {item}... it\'s beautiful. I\'ll keep it by my window, {c}.'], like:['Oh, a {item}. That\'s lovely, {p}.'], meh:['A {item}. Hmm. I\'ll find a meaning for it, {c}.'],
    returnGift:['I was saving this for someone. I think it was you.'], best:['When I think of this island, I think of you, {p}.'],
    sleep:['...{c}... floating... zzz...'],
  },
  sporty: {
    morning:['Morning, {p}! Already did my laps around the island, {c}!','Rise and shine! Muscles don\'t build themselves, {c}!'], day:['Hey hey, {p}! Wanna do some stretches? No? Next time, {c}!','Perfect weather for a jog, {c}!'],
    evening:['Cooldown time. Very important. Never skip the cooldown, {c}.'], night:['Night run? Respect, {p}. Respect, {c}.'],
    rain:['Running in the rain builds character, {c}!'], snow:['Snow sprints! Great for the calves, {c}!'],
    home:['Welcome to the training center! Also my house. Same thing, {c}!'],
    chat:['I tried to carry a whole rock home yesterday. The rock won.','Catching bugs is basically cardio if you do it right.','Bramble says he doesn\'t exercise, but have you seen him chop wood? Power, {c}!','Big fish give the best workout. Reel hard, {p}!','Fun fact: I can do 40 push-ups. Unfun fact: I counted wrong. It was 14.','A sturdy net is like good shoes. Worth every clam.'],
    again:['Back for more? I like the energy, {c}!','Talk later, I gotta hydrate.'],
    love:['A {item}?! This is champion-tier, {p}! {c}!'], like:['Nice, a {item}! Thanks, teammate!'], meh:['A {item}... okay, I\'ll lift it as a weight, {c}.'],
    returnGift:['Team spirit! Here, take this!'], best:['You\'re my best training partner, {p}. Always, {c}.'],
    sleep:['Zzz... one more rep... zzz...'],
  },
  caring: {
    morning:['Good morning, {p}! Did you eat breakfast? You need your energy, {c}.'], day:['Oh, {p}, there you are. Wear a hat, the sun is strong today, {c}.','Have you been drinking water? Good. Good, {c}.'],
    evening:['Getting chilly. Don\'t forget a sweater, {c}.'], night:['Out this late? Be careful by the water, {c}.'],
    rain:['Come here, you\'re soaked! Dry off when you get home, {c}.'], snow:['Bundle up, {c}! Mittens and everything.'],
    home:['Come in, come in! I just made tea. Sit anywhere, {c}.','My door is always open for you, {c}.'],
    chat:['I knitted Bramble a scarf. He says he hates it. He wears it every day.','Lumi forgets to eat when she\'s stargazing. I leave muffins on her porch.','If you plant flowers, water them every day. They notice, {c}.','Clover napped through lunch again. I brought her a sandwich.','You\'re doing a wonderful job with the island, {p}. Really.','A full bag is a happy bag, but a bigger backpack is even happier.'],
    again:['Back again? I love the company, {c}.','Don\'t forget to rest, {p}. Resting is important too.'],
    love:['Oh, {p}, a {item}! You shouldn\'t have. I adore it, {c}.'], like:['A {item}, how lovely. Thank you, {c}.'], meh:['A {item}! It\'s the thought that counts, {c}.'],
    returnGift:['I made you something. Take it, take it.'], best:['You\'re like family to me, {p}. You know that, {c}?'],
    sleep:['Zzz... did everyone... eat... zzz...'],
  },
  elegant: {
    morning:['Good morning, {p}. The dew is simply exquisite today, {c}.'], day:['Ah, {p}. Lovely to see you looking so... outdoorsy, {c}.','The light today is very flattering, {c}.'],
    evening:['The golden hour, {c}. Everyone looks better in it. Even Bramble.'], night:['A moonlit stroll. How terribly romantic, {c}.'],
    rain:['Rain. My fur will be impossible, {c}.'], snow:['Snow does make everything look rather expensive, {c}.'],
    home:['Welcome to my humble home, {c}. Well. Not that humble.'],
    chat:['Fossils are the antiques of the earth, {c}. I collect them, naturally.','I rearranged my furniture four times this week. It\'s nearly right.','Otis invited me jogging. I declined. Gracefully.','A garden should look effortless. That takes a great deal of effort.','I adore a good bookshelf. It says you think, {c}.','Have you considered a lantern by your door? Lighting is everything.'],
    again:['Twice in a day? I\'m flattered, {c}.','I must go, darling. Places to be. Mostly my armchair.'],
    love:['A {item}. Oh, {p}, you have taste. I\'m impressed, {c}.'], like:['A {item}. Charming. Thank you, {c}.'], meh:['A {item}. How... rustic, {c}.'],
    returnGift:['Something for you, darling. Do display it properly.'], best:['You\'re my dearest friend, {p}. Don\'t let it go to your head, {c}.'],
    sleep:['Zzz... beauty sleep... do not disturb... zzz...'],
  },
  lazy: {
    morning:['Mmm, morning already? Wake me at lunch, {c}...'], day:['Oh hey, {p}. I was thinking about snacks. Still am, {c}.','Is it nap time? It feels like nap time, {c}.'],
    evening:['Dinner time is my favorite time. Then dessert time, {c}.'], night:['Midnight snack run? I\'m in, {c}.'],
    rain:['Rain is nature\'s way of saying stay inside and eat, {c}.'], snow:['Snow looks like sugar. I tried it. It\'s not, {c}.'],
    home:['Oh! Visitors! Sorry about the crates. They\'re full of snacks, {c}.'],
    chat:['I planted an apple tree so I can nap under it AND eat. Efficiency, {c}.','Otis keeps asking me to jog. I keep saying maybe. Maybe means no.','The best fish is a cooked fish. Just saying.','Mabel makes the best soup. I go over every day. By accident.','I found a fossil once. I used it as a pillow.','Do you think clouds taste like marshmallows? I need to know.'],
    again:['More talking? Okay, but I\'m lying down for it, {c}.','Zzz... oh! Sorry. Hi again.'],
    love:['A {item}! Is it edible? Doesn\'t matter, I love it, {c}!'], like:['A {item}, nice. Thanks, {p}.'], meh:['A {item}. Can I nap on it? Maybe, {c}.'],
    returnGift:['Here, I found this under my bed. It\'s yours now.'], best:['You\'re my favorite person to nap near, {p}. That\'s a big deal, {c}.'],
    sleep:['Zzzzz... more pie... zzzzz...'],
  },
};

export const PEDDLER = { name:'Fennick', greet:'Ribbit-ho, traveler! I wash up wherever the tide takes me. Today, that\'s here! Care to browse my rare finds?', voice:330 };

/* Events: small things that happen on certain days or times. */
export const EVENTS = [
  { id:'lantern-night', name:'Lantern Night', active:(d,h)=>d.getDay()===6 && (h>=18 || h<1), notice:'Lantern Night: paper lanterns drift over the sea on Saturday evenings.' },
];

/* =====================================================================
   v0.5 CONTENT: shops run by islanders, museum, home builder options
   ===================================================================== */

/* ---------- New shop furniture (tier = shop investment tier needed before it shows up in stock) ---------- */
// Tidepool Aquarium Supply
furn('fishtank','Little Fish Tank',1800,0.5,{shop:'aquarium',tier:0,...C});
furn('lifering','Life Ring Stand',900,0.4,{shop:'aquarium',tier:0,...C});
furn('anchor','Old Anchor',1500,0.55,{shop:'aquarium',tier:0,...C});
furn('shipwheel','Ship\'s Wheel',2400,0.5,{shop:'aquarium',tier:1,...U});
furn('buoylamp','Buoy Lamp',2000,0.4,{shop:'aquarium',tier:1,glow:true,...U});
furn('corallamp','Coral Lamp',3200,0.4,{shop:'aquarium',tier:2,glow:true,...R});
furn('bigtank','Grand Aquarium',9000,1.0,{shop:'aquarium',tier:3,...R});
// Sprig's Bug & Bloom
furn('terrarium','Bug Terrarium',1600,0.45,{shop:'garden',tier:0,...C});
furn('skep','Straw Bee Skep',1400,0.45,{shop:'garden',tier:0,...C});
furn('gnome','Garden Gnome',900,0.35,{shop:'garden',tier:0,...C});
furn('butterflyframe','Butterfly Frame',2200,0.45,{shop:'garden',tier:1,...U});
furn('mothlamp','Moth Lantern',2000,0.35,{shop:'garden',tier:1,glow:true,...U});
furn('rosearch','Rose Arch',3500,1.0,{shop:'garden',tier:2,...R});
furn('fountain','Garden Fountain',8000,1.0,{shop:'garden',tier:3,...R});
// Museum thank-you gifts (never sold)
furn('globe','Antique Globe',3000,0.45,{shop:'gift'});
furn('skeleton','Mini Dino Skeleton',6000,0.8,{shop:'gift'});
furn('statue','Explorer Statue',9000,0.6,{shop:'gift'});
// Mossby's gift
def('mossby_acorn',{ name:'Mossby\'s Acorn', kind:'sapling', plant:'oak', price:50, buy:0, model:{t:'sapling', sp:'oak'} });

/* ---------- Shops: each run by an islander. Skyrim-style: the general store buys anything at the standard price,
   specialists pay more for what they love and won't touch the rest. Investing (later in the game) upgrades them. ---------- */
export const SHOPS = {
  general:{ id:'general', name:'Pemberton\'s General Store', keeper:'pemberton', buys:null, hours:null,
    sell:[1.0,1.03,1.06,1.1], discount:[0,0.05,0.1,0.15], slots:[6,8,10,12],
    tiers:['Market Stall','Corner Shop','General Store','Grand Emporium'],
    perks:['', 'Two more furniture slots, rare pieces a little more often, 5% off, +3% when you sell', 'Two more slots, rare pieces almost twice as often, very rare twice as often, 10% off, +6% when you sell', 'Two more slots, rare pieces over twice as often, very rare 3x as often, 15% off, +10% when you sell'] },
  aquarium:{ id:'aquarium', name:'Tidepool Aquarium Supply', keeper:'marlo', buys:['fish'], hours:[8,22],
    sell:[1.2,1.3,1.4,1.5], discount:[0,0.05,0.1,0.15], slots:[3,4,5,6],
    tiers:['Bait Shack','Aquarium Supply','Tidepool Aquarium','Grand Aquarium Hall'],
    perks:['', 'Fish sell for 130%, ship\'s wheels and buoy lamps', 'Fish sell for 140%, coral lamps', 'Fish sell for 150%, the Grand Aquarium'] },
  garden:{ id:'garden', name:'Sprig\'s Bug & Bloom', keeper:'sprig', buys:['bug','flower'], hours:[8,22],
    sell:[1.2,1.3,1.4,1.5], discount:[0,0.05,0.1,0.15], slots:[4,5,6,8],
    tiers:['Seed Cart','Bug & Bloom','Bug & Bloom Greenhouse','Botanical Conservatory'],
    perks:['', 'Bugs and flowers sell for 130%, saplings and moth lanterns', 'Bugs and flowers sell for 140%, rose arches', 'Bugs and flowers sell for 150%, garden fountains'] },
};
// Investing opens once you have a real house and you've done this much trade at the shop (buying plus selling).
export const INVEST = { cost:[0,100000,300000,800000], trade:50000 };

export const KEEPERS = {
  pemberton:{ id:'pemberton', acc:['beanie'], accC:0xf0c040, top:'overalls',  name:'Pemberton', species:'bear', ears:'round', fur:0x8a8a92, muzzle:0xf4f0ea, shirt:0x6a8a4a, cheek:0xe0a0a0, voice:300, stripe:true,
    greet:['Ah, a customer! Pemberton\'s buys anything and everything, friend. Fair prices, no fuss.','Morning! Or afternoon. Shopkeepers lose track. What can I do for you?'],
    night:['Shop\'s on the honor system after dark. Leave clams in the jar. I trust you.'],
    lock:'Tell you what. Once you\'ve got a proper house and we\'ve done {t} clams of business, I might let you buy a share of the place.',
    invest:['A partner! Ha! I\'ll knock out the back wall this week.','You\'re a fine investor. I\'ve ordered fancier stock.','Grand Emporium! My grandmother would weep. Happy tears.'] },
  marlo:{ id:'marlo', acc:['beanie'], accC:0x2f8ac0,  name:'Marlo', species:'otter', ears:'round', fur:0x9a6a48, muzzle:0xe8d4bc, shirt:0x2f8ac0, cheek:0xf0a090, voice:560,
    greet:['Ahoy! Fish, tanks, salty knick-knacks. I pay top clam for anything with fins.','Welcome aboard! Bring me fish and I\'ll pay better than Pemberton ever will.'],
    refuse:'Sorry, mate, I only deal in fish. Pemberton\'s General Store takes everything else.',
    closed:'Closed. Tidepool Aquarium Supply opens at 8 AM.',
    lock:'Someday, when you\'ve got your own house and we\'ve traded {t} clams, maybe you\'ll back a bigger shop?',
    invest:['You\'re backing me? Splash! I\'ll put up an awning and stock ship\'s wheels!','More tanks! More coral! You won\'t regret it.','A Grand Aquarium Hall! I\'m going to cry into a bucket.'] },
  sprig:{ id:'sprig', acc:['vest'], accC:0x3a5a8a,  name:'Sprig', species:'fox', ears:'cat', fur:0xe8803a, muzzle:0xfff4e8, shirt:0x7cb85a, cheek:0xf5a3a3, voice:640,
    greet:['Hi hi! Bugs and blooms, that\'s my whole world. I pay extra for both!','Psst. I just got a terrarium in. It\'s beautiful. Want to see?'],
    refuse:'Oh, I only buy bugs and flowers! Pemberton takes the rest.',
    closed:'Closed for the night. Bug & Bloom opens at 8 AM. (Shh, the beetles are sleeping.)',
    lock:'If you ever get a real house, and we trade {t} clams, I\'d love a partner to help me grow!',
    invest:['A partner! I\'ll build a little greenhouse!','More glass, more plants, more bugs! Thank you!','A conservatory. A whole conservatory. I need to sit down.'] },
  clementine:{ id:'clementine', acc:['bow'], accC:0xf08aa8,  name:'Clementine', species:'hedgehog', ears:'round', fur:0xa88a6a, muzzle:0xf4e6d4, shirt:0xe8a040, cheek:0xf0a0a0, voice:520,
    greet:['Town business, town business! What can I do for you?','Good to see you! The island is growing every day.','Oh! Hello! I was just sorting the mail by smell. Long story.'],
    first:['Oh, you must be the new face everyone is talking about! I\'m Clementine. I run the town.','Well, I run the tent. It\'s a very official tent.','New neighbors come to me first, and so do the island\'s big projects. Chip in a few clams and we\'ll turn this tent into a proper town hall!','I also do home loans. When you\'re ready to move out of your tent, come talk to me.'] },
  thistle:{ id:'thistle', acc:['glasses'],  name:'Professor Thistle', species:'tortoise', ears:'none', fur:0x9ab07a, muzzle:0xd8e0b8, shirt:0x8a6a4a, cheek:0xe0b0a0, voice:200,
    greet:['Ah, welcome, welcome. Slowly now. Everything in here is very old. Including me.','Hello again! Have you brought something for the collection?'],
    night:['Mm? Oh. I was resting my eyes. The museum never closes. Neither do I, apparently.'],
    first:['A visitor! How marvelous. I am Professor Thistle, curator of this very empty museum.','Fish, bugs, fossils, beach finds. Bring me one of each kind and I will put it on display for the whole island.','Each donation is shown in here for good. Do come back often. I will be right here. I do not move quickly.'] },
};

/* ---------- Museum: every fish, bug, fossil and beach find gets a display. Gifts at milestones. ---------- */
export const MUSEUM = { kinds:['fish','bug','fossil','shell'], gifts:[[10,'globe'],[30,'skeleton'],[60,'statue']] };

/* ---------- Home builder ----------
   The house is a set of rectangular rooms on a 7 x 6 grid. Outside, each cell is 1.25 m; inside, 2.4 m (cozy logic).
   Floor squares are bought with a home loan from Clementine at the town hall (one loan open at a time).
   The first 9 squares are the base-model house, 50,000 clams. Styles you already own are free to switch. */
export const BUILD = {
  GW:7, GD:6, EC:1.25, IC:2.4,
  cellCost:n => n<=9 ? (n===1?5560:5555) : n<=12 ? 12000 : n<=24 ? 25000 : 40000,   // first 9 squares add up to 50,000 (the base-model house)
  walls:[['siding','Siding'],['plank','Board & batten'],['shingle','Shingles'],['brick','Brick'],['stone','Stone'],['stucco','Stucco'],['log','Log cabin'],['timber','Half-timbered']],
  roofs:[['gable','Gable'],['steep','Steep gable'],['hip','Hip'],['shed','Lean-to'],['flat','Flat'],['thatch','Thatch'],['mossy','Mossy shingles'],['gambrel','Gambrel']],
  doors:[['plank','Plank'],['arched','Arched'],['glass','French'],['dutch','Dutch']],
  windows:[['square','Square'],['tall','Tall'],['round','Round'],['arched','Arched'],['wide','Picture']],
  founds:[['stone','Stone'],['brick','Brick'],['wood','Wood lattice'],['none','None']],
  porches:[['none','None'],['step','Steps'],['deck','Deck'],['covered','Covered porch']],
  chimneys:[['none','None'],['brick','Brick'],['stone','Stone']],
  stories:[[1,'One story'],[2,'Two stories']],
  shutters:[[false,'No shutters'],[true,'Shutters']], boxes:[[false,'No flower boxes'],[true,'Flower boxes']], lamps:[[false,'No lamps'],[true,'Door lamps']],
  floors:[['wood','Wood planks'],['parquet','Parquet'],['tile','Checker tile'],['stone','Flagstone'],['carpet','Carpet']],
  papers:[['plain','Plain'],['stripe','Stripes'],['dots','Dots'],['check','Check'],['wainscot','Wainscot'],['brick','Brick']],
  wallColors:[0xfff1d6,0xffffff,0xf6e0c8,0xe8d0b0,0xf2c9b0,0xf0b8b0,0xd8e8c8,0xbfe0d8,0xc8d8f0,0xd8c8e8,0xa8b8c8,0x8a6a50,0x5a6a7a,0x3a4a3a],
  roofColors:[0xe0745a,0xb5523b,0x7a9a5a,0x2a5a4a,0x4a7ad8,0x2a3a5a,0x9a7ab8,0xe88aa8,0xd8b04a,0x6a5a50,0x3a3a40,0xf0e8d8],
  trimColors:[0xffffff,0xf2ead8,0x8b5e3a,0x5a4030,0x3a3a40,0x6a9ad8,0x2a5a4a,0xb5523b],
  doorColors:[0x8a5a3a,0x5a3a2a,0xe2483d,0x2f6ab0,0x3a8a5a,0xf0c040,0xe88aa8,0xffffff,0x3a3a40,0x6ac0c0],
  floorColors:[0xc99a6a,0xe8c49a,0x9a6a40,0x6a4a3a,0xd8d0c0,0x8a9098,0xe0a090,0x8ab0d8,0x9ac08a,0xc0a0d0,0xf0e0c0],
};

/* =====================================================================
   v0.9 CONTENT: Wendell the wizard (potions, moving buildings, shaping land) and islanders' favors
   ===================================================================== */
/* Potions: drink from your bag. Each lasts 10 real minutes and makes rare finds of one kind much more likely. */
def('potion_fish', { name:'Angler\'s Draught', kind:'potion', price:400, buy:3000, luck:'fish', mins:10, stack:10, model:{t:'potion', c:0x3aa6d8}, desc:'Rare fish bite far more often for 10 minutes.' });
def('potion_bug',  { name:'Fluttercharm Tonic', kind:'potion', price:400, buy:3000, luck:'bug', mins:10, stack:10, model:{t:'potion', c:0x7cc35a}, desc:'Rare bugs show up far more often for 10 minutes.' });
def('potion_dig',  { name:'Diviner\'s Elixir', kind:'potion', price:400, buy:3000, luck:'dig', mins:10, stack:10, model:{t:'potion', c:0xd8a040}, desc:'Rare fossils and beach finds turn up far more often for 10 minutes, and dig spots hide more swatch books.' });
def('potion_star', { name:'Lucky Star Elixir', kind:'potion', price:1200, buy:8000, luck:'all', mins:10, stack:10, model:{t:'potion', c:0xc8a0f0}, desc:'All three luck charms at once, for 10 minutes.' });
export const POTIONS = ['potion_fish','potion_bug','potion_dig','potion_star'];
def('parcel', { name:'Neighbor\'s Parcel', kind:'quest', price:0, stack:1, model:{t:'parcel'} });

export const WIZARD = { id:'wendell', name:'Wendell', voice:260,
  first:['Ah! So YOU are the one who answered the starfish wish. Splendid.','I am Wendell. Wizard, retired. Mostly retired. Semi-retired.','I brew luck potions, and for a fee I can move buildings and reshape the very land. Island magic is fussy, though. It needs a well-loved island to work with.'],
  greet:['Mm? Oh, hello. Mind the cauldron, it bites.','Back again! The stars said you would be. Or was it the pigeons?','Potions, spells, unsolicited advice. What will it be?'],
  night:['The stars are out. My best working hours, truthfully.'],
  moveLock:'Moving whole buildings takes a lot of island magic. Come back when you\'ve built a house of at least {cells} floor squares and backed at least {shops} of the shops.',
  landLock:'Shaping land is the hardest magic of all. I\'ll need a house of at least {cells} floor squares, and every shop on the island backed by you.',
  cast:['Hocus... focus... TERRA-FIRMA-RE-FORMA!','A wiggle of the staff, a pinch of star dust, and...','Stand back. Further. A little further. Perfect.'] };
// Wizard services. Moving prices follow New Horizons (your house 30,000; anything else 50,000). Land work is per cell.
export const MAGIC = { moveHome:30000, moveOther:50000, raise:1500, lower:1500, water:2500, fill:2500,
  unlockMove:{ cells:16, shops:2 }, unlockLand:{ cells:24, shops:3 } };

/* Favors: islanders ask for small things. Rewards are clams plus a chance at something rare.
   Story favors unlock things on the island. */
export const STORY = {
  wizard:{ who:'lumi', need:[['starfish',2],['sanddollar',1]],
    ask:['I keep seeing little sparkles near the plaza at night, {c}. Like someone magic is looking for a place to live.','They say wizards can\'t resist a wish made on starfish. Could you bring me 2 starfish and a sand dollar? They wash up on the beach.'],
    done:['You found them! Okay, okay. I\'m making the wish right now, {c}...','...','Did you feel that? The ground went all tingly! Look over there!'] },
  beacon:{ who:'otis', need:[['iron',3],['wood',10]],
    ask:['Hey {p}! The old dock beacon is busted, {c}. Traders sail right past us at night.','Bring me 3 iron nuggets and 10 wood and I\'ll fix it up. More traders means more rare stuff!'],
    done:['Perfect! A few whacks with the hammer and... she\'s shining, {c}!','Fennick and friends will find the dock much more often now.'] },
  swatches:{ who:'juniper', need:[['fossil',1],['lantern',1]],
    ask:['Darling, your house deserves better finishes, {c}. I have a cousin in the paint trade.','Bring me any fossil and a Garden Lantern, and I\'ll have her send you a few of her sample books.'],
    done:['Exquisite. My cousin will be thrilled, {c}.','Here, these swatch books are yours. Do use them with restraint.'] },
};
// Things islanders ask for. kind:'item' = a specific item, kind:'kind' = anything of that kind.
export const FAVOR_ASKS = [
  { kind:'item', id:'wood', n:[5,10], line:'Could you bring me {n} wood? I\'m fixing a wobbly chair, {c}.' },
  { kind:'item', id:'softwood', n:[4,8], line:'I need {n} branches for a little project. Don\'t ask what it is yet, {c}!' },
  { kind:'item', id:'stone', n:[3,6], line:'I\'m building a rock garden. Could you bring me {n} stones, {c}?' },
  { kind:'item', id:'clay', n:[2,3], line:'I want to try pottery! Could you find me {n} clay, {c}?' },
  { kind:'item', id:'iron', n:[1,2], line:'My gate hinge snapped. Could you bring me {n} iron nugget{s}, {c}?' },
  { kind:'item', id:'native', n:[3,6], line:'I\'m baking a pie. Could you bring me {n} {item}, {c}?' },
  { kind:'item', id:'coconut', n:[2,3], line:'I have a coconut craving. {n} coconuts, please, {c}!' },
  { kind:'item', id:'weed', n:[5,8], line:'Odd request, but I need {n} clumps of weeds for compost, {c}.' },
  { kind:'kind', id:'fish', n:[1,2], line:'I\'d love {n} fish for dinner. Any kind, {c}!' },
  { kind:'kind', id:'bug', n:[1,2], line:'I\'m sketching bugs. Could you bring me {n} bug{s}? Any kind, {c}.' },
  { kind:'kind', id:'fossil', n:[1,1], line:'I\'ve always wanted a fossil for my shelf. Any fossil, {c}.' },
  { kind:'kind', id:'shell', n:[2,3], line:'Could you bring me {n} beach finds? I\'m making a mobile, {c}.' },
  { kind:'kind', id:'flower', n:[2,4], line:'My vase is empty. {n} flowers would brighten things up, {c}.' },
  { kind:'catch', id:'fish', n:[1,1], line:'Have you ever caught a {item}? I\'d love to see one up close, {c}.' },
  { kind:'catch', id:'bug', n:[1,1], line:'I keep hearing about the {item}. Could you catch me one, {c}?' },
  { kind:'deliver', n:[1,1], line:'Could you take this parcel to {to} for me? I promised I\'d send it today, {c}.' },
];

/* =====================================================================
   v1.0 CONTENT: farming, cooking, the sled, new neighbors, islanders' gifts
   ===================================================================== */
/* ---------- Vegetables and herbs: plant seeds on grass (no shovel), water them, harvest when ripe.
   regrow: after picking, the plant grows back (tomatoes and herbs). Otherwise you pull up the whole plant. ---------- */
export const CROPS = {
  tomato:  { name:'Tomato',   price:120, days:4, n:[2,4], regrow:true,  c:0xe2483d, herb:false },
  carrot:  { name:'Carrot',   price:110, days:3, n:[2,3], regrow:false, c:0xf08a2a },
  potato:  { name:'Potato',   price:100, days:4, n:[3,4], regrow:false, c:0xc8a070 },
  pumpkin: { name:'Pumpkin',  price:300, days:5, n:[1,2], regrow:false, c:0xf0902a },
  lettuce: { name:'Lettuce',  price:110, days:3, n:[1,2], regrow:false, c:0x9ad86a },
  onion:   { name:'Onion',    price:100, days:3, n:[2,3], regrow:false, c:0xe8d8b0 },
  basil:   { name:'Basil',    price:90,  days:2, n:[1,2], regrow:true,  c:0x4f9a3a, herb:true },
  mint:    { name:'Mint',     price:90,  days:2, n:[1,2], regrow:true,  c:0x7cd8a0, herb:true },
  rosemary:{ name:'Rosemary', price:100, days:3, n:[1,2], regrow:true,  c:0x6a8a6a, herb:true },
  // v1.8 berries: perennial, you pick the berries and the plant stays. regrowTo: the stage it drops back to after picking.
  strawberry:{ name:'Strawberries', price:80, days:3, n:[2,4], regrow:true, regrowTo:2, c:0xe0303a, berry:true },
  blueberry: { name:'Blueberries',  price:90, days:4, n:[3,5], regrow:true, regrowTo:2, c:0x4a5ab8, berry:true },
  raspberry: { name:'Raspberries',  price:90, days:4, n:[2,4], regrow:true, regrowTo:2, c:0xd8406a, berry:true },
};
for (const [id,c] of Object.entries(CROPS)){
  const pid='crop_'+id;   // the plant is crop_x, the harvest is x
  PLANTS[pid]={ name:c.name, ptype:'crop', days:c.days, colors:[c.c], crop:id };
  def(id, { name:c.name, kind:c.herb?'herb':c.berry?'berry':'veg', price:c.price, model:{t:'furn', b:'v_'+id} });
  // v1.8: crop seeds stack to 99 and sell for little, since every harvest gives some back
  def(id+'_seeds', { name:(c.berry?c.name.replace(/ies$/,'y').replace(/s$/,''):c.name)+(c.herb?' Starts':' Seeds'), kind:'seed', plant:pid, price:10, buy:c.herb?320:240, stack:99, model:{t:'seed', sp:pid} });
}
/* ---------- v1.8: island seeds ----------
   Every island has a few crops that grow wild there: cheap and always in stock at the shops, and their seed packets turn up
   on the ground every day. Which ones is random per island, weighted by the island's terrain. */
export const SEED_TERRAIN = {
  flat:        { lettuce:3, strawberry:3, tomato:3, carrot:2, pumpkin:2, basil:2, onion:1, potato:1, mint:1, blueberry:1, raspberry:1, rosemary:1 },
  hilly:       { potato:3, carrot:3, raspberry:3, blueberry:2, onion:2, pumpkin:2, tomato:1, lettuce:1, strawberry:1, mint:1, basil:1, rosemary:1 },
  mountainous: { potato:3, blueberry:3, rosemary:3, onion:2, carrot:2, raspberry:2, mint:2, lettuce:1, pumpkin:1, strawberry:1, tomato:1, basil:1 },
  cliffs:      { rosemary:3, mint:3, tomato:2, strawberry:2, onion:2, basil:2, carrot:1, potato:1, lettuce:1, blueberry:1, raspberry:1, pumpkin:1 },
};
export const ISLAND_SEED_N = 4, ISLAND_SEED_BUY = 30;
export function islandSeedPool(seed, terrain){
  let s=(seed^0x5eed5)>>>0; const r=()=>{ s=(s+0x6D2B79F5)|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  const w=Object.entries(SEED_TERRAIN[terrain]||SEED_TERRAIN.flat), out=[];
  while (out.length<ISLAND_SEED_N && w.length){ const tot=w.reduce((a,[,v])=>a+v,0); let x=r()*tot, k=0; while (k<w.length-1 && (x-=w[k][1])>0) k++; out.push(w.splice(k,1)[0][0]+'_seeds'); }
  return out;
}
/* ---------- v1.8: gardens. Building one is free; fences and decorations cost clams. per = clams per fence piece (one side of one square). ---------- */
export const GARDEN_FENCES = {
  rustic: { name:'Rustic rails',   per:40 },
  picket: { name:'White picket',   per:60 },
  stone:  { name:'Low stone wall', per:70 },
  hedge:  { name:'Boxwood hedge',  per:90 },
};
export const GARDEN_DECOR = {
  sign:      { name:'Garden sign',     price:500,  blurb:'A painted sign by the gate.' },
  scarecrow: { name:'Scarecrow',       price:1200, blurb:'Keeps an eye on things.' },
  lanterns:  { name:'Corner lanterns', price:1600, blurb:'Glow on the corners at night. Needs a fence.' },
  arch:      { name:'Flower arch',     price:2000, blurb:'Climbing roses over the gate.' },
};
/* ---------- Cooking: every recipe is listed from the start. Cook at a Wood Stove (anything) or a campfire (simple things). ---------- */
export const RECIPES = [
  { id:'grilled_fish',  name:'Grilled Fish',       need:[['fish',1]],                              fire:true },
  { id:'baked_potato',  name:'Baked Potato',       need:[['potato',1]],                            fire:true },
  { id:'roast_carrots', name:'Herb Roasted Carrots',need:[['carrot',2],['rosemary',1]],            fire:true },
  { id:'mint_tea',      name:'Mint Tea',           need:[['mint',2]],                              fire:true },
  { id:'garden_salad',  name:'Garden Salad',       need:[['lettuce',1],['tomato',1],['carrot',1]] },
  { id:'tomato_soup',   name:'Tomato Basil Soup',  need:[['tomato',2],['basil',1]] },
  { id:'veg_stew',      name:'Vegetable Stew',     need:[['carrot',1],['potato',1],['onion',1]] },
  { id:'pumpkin_soup',  name:'Pumpkin Soup',       need:[['pumpkin',1],['onion',1]] },
  { id:'fish_chips',    name:'Fish & Chips',       need:[['fish',1],['potato',2]] },
  { id:'fruit_tart',    name:'Fruit Tart',         need:[['fruit',3]] },
  { id:'coconut_curry', name:'Coconut Curry',      need:[['coconut',1],['carrot',1],['onion',1]] },
  { id:'berry_tart',    name:'Berry Tart',         need:[['berry',4]] },
  { id:'berry_jam',     name:'Berry Jam',          need:[['berry',3],['mint',1]],                 fire:true },
];
const KIND_VALUE = { fish:200, fruit:120, berry:90 };
for (const r of RECIPES){
  const v=r.need.reduce((a,[id,n])=>a+(ITEMS[id]?ITEMS[id].price:KIND_VALUE[id]||100)*n,0);
  def(r.id, { name:r.name, kind:'food', price:Math.round((v*1.5+100)/10)*10, stack:10, model:{t:'furn', b:'d_'+r.id} });
}
def('sled', { name:'Wooden Sled', kind:'gear', price:500, buy:3000, stack:1, model:{t:'furn', b:'sled'} });
// a campfire is now something you can build yourself
WOODWORK.push({ id:'campfire', mats:{ stone:4, wood:3, softwood:2 }, unlock:2 });
ITEMS.campfire.shop='rare';
// who loves a good meal
for (const R of RESIDENTS){ if (['lazy','caring'].includes(R.personality)) R.loves.push('food'); else R.likes.push('food'); }

/* ---------- A new neighbor's first hello ---------- */
export const ARRIVE = {
  cheerful:['Hi hi! I just moved in! Everything still smells like cardboard, {c}!','I\'m so happy to be here. Will you be my first friend on the island?'],
  gruff:['Hrm. You\'re the welcome committee? ...Fine. I just moved in.','Don\'t mind the boxes. I\'ll sort them. Eventually. {c}.'],
  dreamy:['Oh. Hello. I followed a shooting star here, and here I am, {c}.','My boxes are full of shells and old maps. I think I\'m going to like it here.'],
  sporty:['Hey! New neighbor here! Moved all my boxes in one trip, {c}!','This island has great jogging paths. We should race sometime!'],
  caring:['Oh, hello, dear! I just moved in. Have you eaten today, {c}?','I\'ll bake something once the oven is unpacked. You must come by.'],
  elegant:['Darling, I\'ve arrived. Do try to contain your excitement, {c}.','The house is small, but I have plans. Big plans. Wallpaper plans.'],
  lazy:['Oh hey. I just moved in. Moving is exhausting. Nap time, {c}.','If you need me, I\'ll be unpacking. Slowly. Very slowly.'],
};

/* ---------- Islanders' gifts: once they know you a little, neighbors share something useful.
   Not on day one: each has a day and friendship it waits for, and only one of these happens per day. ---------- */
export const MENTOR = [
  { who:'pippa', day:1, friend:3, give:[['tulip_seeds',3],['daisy_seeds',2]],
    lines:['{p}! I saved these for you, {c}! Tulip and daisy seeds!','Plant them by your door, and every morning they\'ll say hi to you. That\'s how flowers work. I\'m pretty sure.'] },
  { who:'mabel', day:2, friend:3, cook:true, give:[['tomato_seeds',3],['basil_seeds',2],['potato_seeds',2],['campfire',1]],
    lines:['{p}, dear, you look like you\'ve been living on fruit and nothing else, {c}.','Here. Seeds from my garden. Tomatoes, basil, potatoes. Plant them on grass and water them every day.','And take my old campfire. Grill a fish on it, or bake a potato. When you get a Wood Stove, you can make soups and stews too.','Every recipe I know is in your Cookbook now. Promise me you\'ll eat properly.'] },
  { who:'clover', day:3, friend:4, give:[['blanket',1],['native',3]],
    lines:['Mmm, {p}. I was going to nap on this, but then I thought... you need a nap more, {c}.','A picnic blanket. And some fruit. For snacks. During the nap. You\'re welcome.'] },
  { who:'lumi', day:4, friend:5, give:[['mothlamp',1],['potion_bug',1]],
    lines:['{p}, I made you something, {c}. A little lantern for the moths. They get lonely in the dark.','And this tonic... Wendell gave it to me, but I think the bugs would rather meet you.'] },
  { who:'otis', day:4, friend:4, winter:true, give:[['sled',1]],
    lines:['{p}! You know what snow means? SLED SEASON, {c}!','Here, take my spare sled. Hop on at the top of a hill and let gravity do the cardio!'] },
];
