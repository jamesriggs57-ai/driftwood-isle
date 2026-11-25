/* =====================================================================
   v1.27 VOYAGES: what boat trips can turn up, plus pen pals.
   Data and small pure helpers only; main.js builds the world side (layouts.js shapes the land).

   Flat-fee trip odds (Skipper Wick):
     76%  ordinary islands, split evenly: 38% quiet (nobody lives there), 38% a small town
     20%  themed (Orchard, Bloom, Frost)
      2%  Moonlit or Castaway
    1.5%  rare islands      (Clamstone, Golden Grove, Wizard's Garden, Plan Library)
    0.5%  legendary islands (Wishing Workshop, Starfall, Collector's Attic, Shimmer Lagoon)
   Tickets only ever go to the named themed islands; rare and legendary islands are luck only.
   Quiet and town islands also get a layout style (some of them weird), and every quiet island has a surprise.
   ===================================================================== */
import { mulberry32, hashStr } from './util.js';
import { RESIDENTS } from './content.js';
import * as CH from './chars.js';

export const TRIP_ODDS = { quiet:0.38, town:0.38, themed:0.20, special:0.02, rare:0.015, legendary:0.005 };
export const RARE_ISLANDS = ['clamstone','grove','wizgarden','library'];
export const LEGEND_ISLANDS = ['workshop','starfall','attic','shimmer'];
export const HAUL_CAP = 200000;   // most clams plus sell value one rare or legendary island can hand out (gifts don't count)

const pick = (a, r) => a[Math.floor(r()*a.length)%a.length];
export function rollTrip(r=Math.random){
  const x=r(), O=TRIP_ODDS; let c=0;
  if (x < (c+=O.quiet)) return 'plain';
  if (x < (c+=O.town)) return 'town';
  if (x < (c+=O.themed)) return pick(['orchard','bloom','frost'], r);
  if (x < (c+=O.special)) return pick(['moonlit','castaway'], r);
  if (x < (c+=O.rare)) return pick(RARE_ISLANDS, r);
  return pick(LEGEND_ISLANDS, r);
}

/* Layout styles for quiet and town islands. 'normal' is the usual hilly island with a creek. */
export const STYLES = {
  normal:      { name:null,                 blurb:'' },
  rivers:      { name:'River Maze',         blurb:'More water than land, with little bridges everywhere.' },
  dunes:       { name:'Dune Isle',          blurb:'Sand from end to end. Palms, shells and things buried deep.' },
  archipelago: { name:'The Scattered Isles',blurb:'A cluster of islets tied together with rope bridges.' },
  ring:        { name:'Ring Island',        blurb:'A thin loop of land around a big blue lagoon.' },
  mesa:        { name:'Mesa Isle',          blurb:'One tall stepped mesa in the middle. Climb it.' },
  crater:      { name:'Crater Isle',        blurb:'A ring of hills with a hidden meadow inside.' },
  swamp:       { name:'Mossmire',           blurb:'Pools and reeds everywhere you step.' },
  forest:      { name:'Thicket Isle',       blurb:'A wood so thick you have to find your way through.' },
};
export const WEIRD = Object.keys(STYLES).filter(k=>k!=='normal');

/* Surprises on quiet islands (every quiet island has at least one) */
export const SECRETS = {
  map:      'A bottle with half a treasure map in it.',
  bottle:   'A letter in a bottle from someone far away.',
  cave:     'A cave tucked behind a waterfall.',
  tide:     'A tiny islet you can only walk to at low tide.',
  ruins:    'Stepping stones out to a half-sunken temple.',
  tortoise: 'A giant tortoise napping on the beach.',
  mushroom: 'A fairy ring of mushrooms that wakes up at night.',
  spring:   'A hidden hot spring.',
};
// styles a secret can't sit on (a waterfall cave needs hills and a creek; a tortoise needs a beach)
const SECRET_BAD = { cave:['rivers','dunes','archipelago','ring','swamp','mesa'], tide:['ring'], ruins:['ring'], tortoise:['ring'] };

/* Small towns: a few people and one thing to do */
export const TOWN_KINDS = {
  hamlet:    { name:'Fishing Hamlet',       folk:3, blurb:'A few huts by the water. The old angler is buying.' },
  monastery: { name:'Hilltop Monastery',    folk:2, blurb:'Quiet monks who trade rare seeds for fruit.' },
  circus:    { name:'Circus Camp',          folk:3, blurb:'A traveling circus between shows. Games with ticket prizes.' },
  lighthouse:{ name:'Lighthouse Point',     folk:1, blurb:'A lighthouse keeper who doesn\'t get many visitors.' },
  smugglers: { name:'Smugglers\' Cove',     folk:2, blurb:'Somebody here sells things you can\'t get anywhere else.' },
  board:     { name:'Noticeboard Village',  folk:3, blurb:'The villagers post little favors on a board.' },
};
const TOWN_IDS = Object.keys(TOWN_KINDS);

/* Rare and legendary islands */
export const SPECIAL = {
  clamstone: { tier:'rare',      name:'Clamstone Isle',     blurb:'Every rock here spits out clams.' },
  grove:     { tier:'rare',      name:'Golden Grove',       blurb:'Golden sap and heartwood in every tree.' },
  wizgarden: { tier:'rare',      name:'The Wizard\'s Garden',blurb:'Wendell\'s old teacher lives here.' },
  library:   { tier:'rare',      name:'The Plan Library',   blurb:'Shelves of rare woodworking plans.' },
  workshop:  { tier:'legendary', name:'The Wishing Workshop',blurb:'An old craftsman who can make anything at all.' },
  starfall:  { tier:'legendary', name:'Starfall Isle',      blurb:'Always night. Falling stars land as starstones.' },
  attic:     { tier:'legendary', name:'The Collector\'s Attic',blurb:'A curator with a spare of everything.' },
  shimmer:   { tier:'legendary', name:'Shimmer Lagoon',     blurb:'Only very rare and legendary fish swim here.' },
};

const PLACE_A = ['Pebble','Salt','Drift','Kelp','Gull','Tide','Moss','Fern','Sorrel','Cobble','Bramble','Heron','Willow','Amber','Clover','Barnacle','Thistle','Marram','Sandpiper','Juniper'];
const PLACE_B = ['wick','by','haven','mouth','stead','combe','holm','ford','well','nook','ton','bay'];
export const placeName = r => pick(PLACE_A, r)+pick(PLACE_B, r);

/* Everything about a trip that comes from its seed. The skipper calls this when you set off, and main.js again on arrival. */
export function tripPlan(theme, seed){
  const r=mulberry32((seed|0) ^ 0x51ab3), out={ theme, style:'normal', kind:null, secrets:[], town:null, name:null, blurb:'' };
  if (theme==='plain' || theme==='town'){
    out.style = r()<0.3 ? 'normal' : pick(WEIRD, r);
    if (theme==='town'){ out.kind=pick(TOWN_IDS, r); out.town=placeName(r); const K=TOWN_KINDS[out.kind]; out.name=out.town+(out.kind==='hamlet'?' Hamlet':out.kind==='monastery'?' Abbey':out.kind==='circus'?' Circus Camp':out.kind==='lighthouse'?' Point':out.kind==='smugglers'?' Cove':' Village'); out.blurb=K.blurb;
      if (r()<0.5) out.secrets.push(r()<0.5?'map':'bottle'); }
    else { const pool=Object.keys(SECRETS); let s=pick(pool, r);
      if ((SECRET_BAD[s]||[]).includes(out.style)){ if (s==='cave') out.style='normal'; else s=r()<0.5?'map':'bottle'; }
      out.secrets.push(s);
      if (r()<0.35){ const s2=pick(['map','bottle','mushroom','spring'], r); if (s2!==s) out.secrets.push(s2); }
      const st=STYLES[out.style]; out.name = st.name || 'A quiet island'; out.blurb = st.name ? st.blurb : 'An island a lot like yours, with nobody else around.'; }
  } else if (SPECIAL[theme]){ out.name=SPECIAL[theme].name; out.blurb=SPECIAL[theme].blurb; }
  return out;
}

/* ---------- People you meet out there ---------- */
const FIRST = ['Basil','Poppy','Wilbur','Fig','Nutmeg','Oswin','Pip','Rosalind','Gus','Tansy','Ferris','Juno','Waffles','Mirabel','Cobb','Dot','Rufus','Saffron','Bea','Linus','Olive','Percy','Quince','Ruby','Sid','Tuppence','Ursa','Violet','Wally','Yarrow','Ziggy','Bunty','Cleo','Dex','Esme','Fennel','Gilly','Hugo','Ivy','Jasper','Kit','Lark','Moss','Nell','Orrin','Pumpkin','Remy','Sable','Tilly','Umber','Vance','Winnie','Acorn','Bramwell','Clove','Dulcie','Ember','Flint','Greta','Hob'];
const CATCH = { cheerful:['yay-yay','tee-hee','zippity','huzzah','sunbeam'], gruff:['hmph','grumble','yep','harrumph','eh'], dreamy:['la-la','starlight','hmm-mm','twinkle','drift'],
  sporty:['go-go','hup','pow','let\'s roll','boom'], caring:['dearie','honey','sweet pea','petal','lovey'], elegant:['ma chère','indeed','darling','splendid','charmed'], lazy:['zzz','meh','munch','yawn','snooze'] };
const PERS = Object.keys(CATCH);
const KINDS = ['fruit','fish','bug','shell','fossil','flower','furniture','material'];
const VOICE = { cheerful:[560,680], gruff:[220,300], dreamy:[440,540], sporty:[340,420], caring:[600,720], elegant:[480,560], lazy:[360,440] };
const ACC = [['flower',0xf08ab0],['scarf',0x5aae6a],['beret',0x6a4aa8],['headband',0xe2483d],['apron',0xf8e8f0],['glasses',0x333333],['pearls',0xffffff],['beanie',0x3a6ab0]];
const idOf = s => 'pp'+(hashStr(s)>>>0).toString(36);

// One person from a trip island (or a bottle). Stable for the same seed and slot, so they're the same person next time.
export function makeFolk(seed, slot, from, role){
  const r=mulberry32(hashStr('folk:'+seed+':'+slot)), personality=pick(PERS, r), base=RESIDENTS.filter(R=>R.personality===personality);
  const tpl=base.length ? pick(base, r) : RESIDENTS[0], [v0,v1]=VOICE[personality], look=CH.randomLook(r, 0.22);
  const loves=[pick(KINDS, r)]; let lk=pick(KINDS, r); if (lk===loves[0]) lk=pick(KINDS, r); const likes=[lk];
  if (['lazy','caring'].includes(personality)) loves.push('food'); else likes.push('food');
  const [acc, accC]=pick(ACC, r), hue=Math.floor(r()*360);
  const col = (s,l) => { const c=hslHex(hue/360+r()*0.08, s, l); return c; };
  return { id:idOf(seed+':'+slot), name:pick(FIRST, r), personality, catch:pick(CATCH[personality], r), voice:Math.round(v0+r()*(v1-v0)),
    species:CH.SPECIES[look.sp] ? look.sp : 'rabbit', ears:'round', look:CH.lookCode(look), acc:[acc], accC, home:null, homeHours:[[11+Math.floor(r()*4), 13+Math.floor(r()*3)]],
    loves, likes, from:from||'a faraway island', role:role||null,
    room:{ floor:col(0.25,0.62), wall:col(0.3,0.92), pattern:pick(['dots','stripe','check'], r), accent:col(0.5,0.55), items:JSON.parse(JSON.stringify(tpl.room.items)) } };
}
function hslHex(h, s, l){ h=((h%1)+1)%1; const k=n=>(n+h*12)%12, a=s*Math.min(l,1-l), f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1)); return (Math.round(f(0)*255)<<16)|(Math.round(f(8)*255)<<8)|Math.round(f(4)*255); }
export const speciesName = code => { const L=CH.parseLook(code||''); return (CH.SPECIES[L.sp]||{}).name || 'Islander'; };

// Things out-of-towners say (they don't know your neighbors)
export const FOLK_CHAT = {
  cheerful:['Visitors! We hardly ever get visitors! This is the best day, {c}!','Do you have a dock where you live? Ours wobbles, but it\'s OUR wobble, {c}.','I collect pretty pebbles. I have four hundred. Want to see? Kidding! ...Unless?'],
  gruff:['Hrm. Boat folk. Don\'t step on the nets, {c}.','Quiet out here. I like it that way. ...You can stay a bit.','Weather\'s turning. Always is. {c}.'],
  dreamy:['The sea brought you here. It brings the best things, {c}.','I watch the boats go by and make up where they\'re going.','Do you think the stars over your island are the same as ours?'],
  sporty:['Rowed here? Sailed? Either way, respect, {c}!','I swim to the next island and back every morning. Well. Halfway.','You look strong. Arm wrestle later? {c}!'],
  caring:['Oh, you must be tired from the trip. Sit a while, {c}.','Did you bring a snack for the boat home? Take care of yourself, {c}.','It\'s lovely to see a new face out here, really.'],
  elegant:['A traveler! How terribly adventurous of you, {c}.','The light out here is wasted on most people. Not on me, {c}.','One does get tired of the same twelve faces.'],
  lazy:['Oh. Hi. I was just about to nap. Or I was napping. Hard to say, {c}.','Boat trips sound like a lot of effort. Good for you though.','Got any snacks? No? That\'s okay. {c}.'],
};
export const PENPAL_ASK = {
  cheerful:'Ooh, we should be pen pals! Write me, okay? I\'ll write back. Every time. {c}!',
  gruff:'...You can write me a letter. If you want. I\'d probably answer. {c}.',
  dreamy:'Write to me sometime? Letters are like bottles that know where they\'re going, {c}.',
  sporty:'Pen pals? Heck yes. Send me a letter and I\'ll write back fast, {c}!',
  caring:'You\'ll write to me, won\'t you? I\'d love to hear how you\'re getting on, {c}.',
  elegant:'Do write, darling. My correspondence could use some excitement, {c}.',
  lazy:'Write me a letter? I\'ll write back. Slowly. But I will, {c}.',
};
export const MOVE_ASK = {
  cheerful:'Wait, you want me to live on YOUR island?! Yes yes yes! I\'ll pack tonight, {c}!',
  gruff:'Move to your island? ...Hrm. Alright. I\'ll come. Don\'t make a fuss about it, {c}.',
  dreamy:'Your island... I\'ve dreamed about it from your letters. Yes. I\'ll come, {c}.',
  sporty:'New island, new training ground! I\'m in, {c}!',
  caring:'Oh, sweetheart. I\'d love to. I\'ll bring muffins, {c}.',
  elegant:'Relocate? For you, darling, I\'d consider anything. Yes, {c}.',
  lazy:'Moving sounds like work. ...But you\'re worth it. Okay, {c}.',
};

/* Pen pal replies: a greeting, a line about the letter, a line about any gift, and a sign-off */
const REPLY = {
  cheerful:{ open:['Dear {p}!!','Hi hi, {p}!'], body:['I read your letter three times! Then once more out loud to a seagull.','Getting mail from you is the best part of my week, {c}!'], close:['Write back soon! Your pen pal, {n}','Hugs from {n}'] },
  gruff:{ open:['{p},','Hey, {p}.'], body:['Got your letter. Read it twice. Don\'t tell anyone.','Things are fine here. Fixed the roof again. {c}.'], close:['- {n}','Write again. If you want. - {n}'] },
  dreamy:{ open:['Dear {p},','Hello, {p}, across the water,'], body:['Your letter smelled a little like the sea. I kept it by my window.','Last night the moon looked like it was reading over my shoulder.'], close:['Drifting your way, {n}','Yours under the same stars, {n}'] },
  sporty:{ open:['Yo, {p}!','Hey, {p}!'], body:['Ran to the mailbox when I saw your letter. Personal best, {c}!','Training\'s going great. I can almost do a whole pull-up now.'], close:['Stay strong! {n}','Your teammate, {n}'] },
  caring:{ open:['Dearest {p},','My dear {p},'], body:['It warms my heart to hear from you. Are you eating properly? Sleeping enough?','I baked too much again today and thought of you, {c}.'], close:['With love, {n}','Take care of yourself, {n}'] },
  elegant:{ open:['My dear {p},','Darling {p},'], body:['Your letter was simply delightful. Your handwriting is improving, too.','I redecorated again. It\'s nearly perfect. Nearly, {c}.'], close:['Ever so fondly, {n}','Yours, with taste, {n}'] },
  lazy:{ open:['Hey {p},','Oh hi {p},'], body:['Got your letter. Read it lying down. Very relaxing, {c}.','Not much new. Had a nap. Then another nap. Big week.'], close:['Zzz, {n}','Later, {n}'] },
};
const GIFT_LINE = { love:'And the {item}! I love it so much. Thank you, thank you.', like:'Thank you for the {item}. It\'s lovely.', meh:'Thanks for the {item}. I\'ll find a spot for it.' };
export function penpalReply(person, letterId, giftName, giftTier, playerName, r=Math.random){
  const P=REPLY[person.personality]||REPLY.cheerful, f=s=>s.replace(/\{p\}/g, playerName||'friend').replace(/\{n\}/g, person.name).replace(/\{c\}/g, person.catch||'').replace(/\{item\}/g, giftName||'');
  const about = { thanks:'You didn\'t have to thank me. But I liked it.', miss:'I miss you too, you know.', found:'What did you find? Now I\'m curious!', visit:'Maybe I will visit one day!', weather:'The weather here is about the same. Breezy and nice.', cheer:'That was really sweet. It helped.', gift:'', hello:'' }[letterId] || '';
  const lines=[f(pick(P.open, r)), f(pick(P.body, r))]; if (about) lines.push(about); if (giftName) lines.push(f(GIFT_LINE[giftTier]||GIFT_LINE.like)); lines.push(f(pick(P.close, r)));
  return lines;
}

/* Short descriptions for the contact list */
const PERS_WORD = { cheerful:'Cheerful', gruff:'Gruff', dreamy:'Dreamy', sporty:'Sporty', caring:'Caring', elegant:'Elegant', lazy:'Laid-back' };
export const persWord = p => PERS_WORD[p] || 'Friendly';
export const KEEPER_SUMMARY = {
  pemberton:'Runs the general store. Buys anything, sells tools, furniture and clothes.',
  marlo:'Runs Tidepool Aquarium Supply. Pays well for fish.',
  sprig:'Runs Bug & Bloom. Pays well for bugs and flowers.',
  clementine:'Looks after town business from the town hall.',
  thistle:'Curator of the museum. Loves a good donation.',
  wendell:'A semi-retired wizard. Potions, moving buildings, reshaping land.',
  fennick:'A traveling merchant who comes through the portal.',
  skipper:'Sails you to little islands from the dock.',
  gill:'A fisherman you set up with a boat.', hollis:'A beekeeper you set up with hives.', russet:'An orchard keeper who picks your fruit.', quill:'A bookkeeper who pays out your shop stakes.',
};
