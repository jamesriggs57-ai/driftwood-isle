/* =====================================================================
   DRIFTWOOD ISLE WIKI: the hand-written guide pages.
   Item lists, prices, rarities and seasons are NOT written here: the catalog pages read them live from
   client/js/content.js (see wiki.js), so they are always current. This file holds everything else.

   KEEP THIS UP TO DATE. Whenever a game change touches something a player would look up (a new character,
   quest step, unlock requirement, price that lives in main.js, island type, odds, feature), update the matching
   page here in the same commit. See CLAUDE.md at the repo root.
   This is a player's guide: state how the game works now, matter of fact. No version numbers, no "was X",
   no "since v1.xx", no notes about old saves, no changelog.

   Each page: { id, group, title, html }. A page may also have data:'<table id>' to append a live table
   built in wiki.js. Writing rules: plain words, no em dashes, no emoji, only facts the code supports.
   ===================================================================== */


const tip = s => `<div class="tip"><b>Tip</b> ${s}</div>`;
const note = s => `<div class="note">${s}</div>`;
const steps = a => `<ol class="steps">${a.map(s=>`<li>${s}</li>`).join('')}</ol>`;

/* [id, full name, short tab label, one line for the home page] */
export const GROUPS = [
  ['start', 'Getting started', 'Start', 'Controls, clams, time and your first days'],
  ['island', 'Life on your island', 'Island', 'House, town, shops, tools, crafting and gardening'],
  ['magic', 'Wendell and new land', 'Wendell', 'The wizard, his isles and relics'],
  ['away', 'Trips, friends and mail', 'Trips & friends', 'Boat trips, island types, pen pals, visiting friends'],
  ['money', 'Income and investing', 'Money', 'Passive income and thank-you stakes'],
  ['stories', 'Island stories (quests)', 'Stories', 'Every islander\'s dream, step by step'],
  ['catalog', 'Catalog', 'Catalog', 'Every fish, bug, fossil, plant, item and piece of furniture'],
  ['done', 'Completing the game', '100%', 'The full checklist'],
];

export const PAGES = [

/* ============================== GETTING STARTED ============================== */
{ id:'welcome', group:'start', title:'Welcome to Driftwood Isle', html:`
<p>Driftwood Isle is a cozy island life game you play in the browser at <a href="/">vinatix.com</a>. You arrive with a tent, a few neighbors and a lot of open beach. From there you fish, catch bugs, dig fossils, grow gardens, build a house, fill a museum, grow a town, and eventually help every islander chase a dream of their own.</p>
<p>Catalog pages (fish, bugs, furniture and so on) are read straight from the game's own data, so their prices and seasons always match the game.</p>
<h3>Your first days</h3>
${steps([
 'Pick up what is lying around: branches, fruit, beach finds. Shake trees for fruit and sometimes a surprise.',
 'Buy a Flimsy tool or two from <b>Pemberton</b> at the general store (axe, shovel, net, rod, watering can).',
 'Sell to the right shop. Pemberton buys anything at the standard price; <b>Marlo</b> (Tidepool) pays more for fish and <b>Sprig</b> (Bug &amp; Bloom) pays more for bugs and flowers.',
 'Talk to everyone every day. Friendship opens favors, gifts, conversations and later the island stories.',
 'Visit <b>Clementine</b> at the town tent. She can loan you a base-model house (50,000 clams, no interest, pay back any time).',
 'Bring your first fish, bug, fossil and beach find to <b>Professor Thistle</b> at the museum.',
 'Chip in to turn the town tent into a Town Hall. Nobody new moves in until it is built.'])}
${tip('Everything unlocks quietly. Characters hint at what they want in their own words; there are no checklists. This guide spells it out.')}
`},

{ id:'controls', group:'start', title:'Controls', html:`
<h3>Computer</h3>
<table class="t"><tr><th>Key</th><th>Does</th></tr>
<tr><td>W A S D</td><td>Walk</td></tr><tr><td>E or Enter</td><td>Use, talk, pick up</td></tr>
<tr><td>Space</td><td>Swing your tool (chop, dig, cast, catch, water)</td></tr><tr><td>Q</td><td>Switch tool</td></tr>
<tr><td>B</td><td>Bike</td></tr><tr><td>G</td><td>Sled (winter)</td></tr><tr><td>I</td><td>Bag</td></tr><tr><td>Z / C</td><td>Turn the camera</td></tr></table>
<p>Drag to look around. Clicking the ground walks you there (turn it off in Menu &gt; Controls). Every key can be changed in Menu &gt; Controls.</p>
<p>Clicking one thing a tree or rock dropped (fruit, branches, wood, stone, clay, iron, and any rare find, plan or scroll from it) picks up everything else that same tree or rock dropped, as long as it fits in your bag. Pieces still falling go straight into your bag when they land. Pressing E picks up one thing at a time. Beach finds and things you dropped yourself are always picked up one at a time.</p>
<h3>Phone and tablet</h3>
<p>A joystick sits bottom left. The green <b>Act</b> button uses and talks; the orange <b>Swing</b> button shows whenever you hold a tool. You can switch to tap-to-walk and resize or move the controls in Menu &gt; Controls; the choice is remembered on that device.</p>
<p>Tapping one thing a tree or rock dropped picks up the rest of that drop too, the same as clicking on a computer. The Act button picks up one at a time.</p>
<p>The top bar keeps Bike, Build (near home), Bag and More. Book, Craft, Sled, Friends and Menu are under More.</p>
${tip('Menu &gt; Battery saver lowers resolution and turns off shadows if your phone gets warm.')}
`},

{ id:'clams', group:'start', title:'Clams and selling', html:`
<p>Clams are the island's money. They can never be sent or traded between players.</p>
<h3>Where to sell</h3>
<table class="t"><tr><th>Shop</th><th>Buys</th><th>Rate</th></tr>
<tr><td>Pemberton's General Store</td><td>Anything</td><td>100%, up to 110% as you invest</td></tr>
<tr><td>Tidepool (Marlo)</td><td>Fish only</td><td>120%, up to 150% as you invest</td></tr>
<tr><td>Bug &amp; Bloom (Sprig)</td><td>Bugs and flowers</td><td>120%, up to 150% as you invest</td></tr>
<tr><td>Mabel's Tea Room (story)</td><td>Fruit, vegetables, herbs, berries, honey</td><td>150%</td></tr></table>
<p>To see what something is worth, hover over it in your bag with a mouse, or tap it on a phone. It shows the most any shop pays for it today (with your shop upgrades and the size of a catch counted) and who pays that. Story items say they can't be sold.</p>
<h3>Good money makers</h3>
<ul>
<li><b>Foreign fruit.</b> Your island has one native fruit. Other fruit sells for 250 each (native 100, coconut 150). Plant foreign fruit you bring back from trips and orchards pay for themselves.</li>
<li><b>Rare fish and bugs</b>, sold to Marlo and Sprig rather than Pemberton.</li>
<li><b>Cooking.</b> Dishes sell for about 1.5x their ingredients plus a bit.</li>
<li><b>Cay Bay fish</b> once the reef is growing: about double a sea fish of the same rarity.</li>
<li><b>Passive income and stakes</b> later on (see Income).</li></ul>
${note('Guest mode caps your wallet at 10,000 clams. Make an account to lift it.')}
`},

{ id:'time', group:'start', title:'Time, seasons and weather', html:`
<p>The island runs on real time, taken from the server (changing your phone's clock does nothing). Days reset overnight: fruit, dig spots, beach finds, shop stock and favors refresh, and builders finish projects.</p>
<p>Seasons follow the real month, and many fish and bugs only appear in certain months and hours (see the Fish and Bugs catalog). Some bugs only come out in the rain. Trees turn in autumn and go bare in winter; snow brings out the sled.</p>
<h3>Events</h3>
<ul><li><b>Lantern Night</b>: paper lanterns drift over the sea on Saturday evenings.</li></ul>
`},

{ id:'guest', group:'start', title:'Guest mode vs an account', html:`
<table class="t"><tr><th></th><th>Guest</th><th>Account</th></tr>
<tr><td>Saved</td><td>In this browser only</td><td>On the server, any device</td></tr>
<tr><td>Island</td><td>Pick Village, Spread out or Highlands</td><td>Island maker: terrain (Flat, Hilly, Mountainous, Cliffs) and town (Dense, Suburbs, Spread out)</td></tr>
<tr><td>Wallet</td><td>Up to 10,000</td><td>No cap</td></tr>
<tr><td>Finds</td><td>Common and uncommon only</td><td>Everything</td></tr>
<tr><td>House</td><td>Up to 12 squares, fewer styles</td><td>Up to 20 x 20, four floors</td></tr>
<tr><td>Friends, trips, loans, income</td><td>No</td><td>Yes</td></tr></table>
<p>Sign in with an emailed 6-digit code, no password. Making an account can carry your guest island over, or start fresh in the island maker. Hilly, mountainous and cliff islands get a waterfall.</p>
<p>In the island maker, <b>Reroll</b> makes a whole new island, not the same one turned round: the shape of the coast (bays and headlands), where the hills and the river's spring are, where the shops and houses go, and which way Wendell's isles will rise. The preview shows the island as it will be, with the far shore.</p>
`},

/* ============================== ISLAND LIFE ============================== */
{ id:'house', group:'island', title:'Your house', html:`
<h3>Getting a house</h3>
<p>You start in a tent. Clementine (town tent or town hall) loans you a <b>base-model house</b>: one 3 x 3 room, 9 floor squares, for 50,000 clams. It is built on the spot. No interest and no due date; pay any amount at the town hall.</p>
<h3>Growing it</h3>
<p>Draw new rooms in the builder (Build button near home). New floor squares go on a new loan, on any floor. Rules:</p>
<ul><li>One loan at a time: pay it off before borrowing again.</li>
<li>Each loan covers at most 9 new squares.</li>
<li>Squares get pricier as the house grows:</li></ul>
<table class="t"><tr><th>Square number</th><th>Price each</th></tr>
<tr><td>1 to 9</td><td>about 5,555 (50,000 total)</td></tr><tr><td>10 to 12</td><td>12,000</td></tr>
<tr><td>13 to 24</td><td>25,000</td></tr><tr><td>25 and up</td><td>40,000</td></tr></table>
<p>The grid is 20 x 20, up to four floors. Upper floors need a Height style (Two, Three or Four stories). The house only grows onto free land; water, paths, slopes and other buildings are shaded out. Layout changes cost a 50-clam remodel fee each (undoing a change is free). Roof direction, moss, trellises and lighting are free.</p>
<h3>Styles</h3>
<p>Walls, roofs, doors, windows, porches, foundations, chimneys, floors, wallpaper and add-ons are <b>owned</b> styles. Switching between ones you own is free. Get new ones from:</p>
<ul><li>Pemberton's <b>Home Goods</b> rack (3 new things a day, more as the store grows). "Try it on" previews it on your house.</li>
<li><b>Swatch books</b> from digging and neighbor gifts, and Juniper's swatch favor (any fossil plus a Garden Lantern).</li>
<li>The <b>paint mixer</b> (22,500, sometimes on the rack) lets you mix any color.</li></ul>
<p>Once you own Mossy shingles you can paint moss onto any roof. Each room has a free light with brightness and warmth sliders; ceiling lights, sconces and accent lights are bought.</p>
<h3>Storage</h3>
<p>The <b>Storage Chest</b> holds 40 stacks. Pemberton stocks it about half the days (2,400), or make it at the workbench (8 wood, 2 iron).</p>
`},

{ id:'town', group:'island', title:'The town and Clementine', html:`
<p>Clementine the hedgehog runs the town from a tent near the plaza. Chip in clams to upgrade it; builders work overnight.</p>
<table class="t"><tr><th>Tier</th><th>Cost</th><th>Needs</th><th>Opens</th></tr>
<tr><td>Town Tent</td><td>Start</td><td></td><td>Home loans</td></tr>
<tr><td>Town Hall</td><td>60,000</td><td>A house of your own</td><td>New islanders, flower beds and benches, passive income characters, many stories</td></tr>
<tr><td>Grand Town Hall</td><td>220,000</td><td>Museum outgrows its cottage, one shop backed</td><td>Fountain, Old Pinewood (with other conditions)</td></tr></table>
<h3>Islanders moving in and out</h3>
<ul><li>New islands start with <b>Pippa, Bramble and Mabel</b>.</li>
<li>Nobody moves in while the town is a tent. After the Town Hall, newcomers come about a week apart: nobody new for 5 days after the last arrival, then a 40% chance each day, until 10 live there. A "Moving in!" sign and boxes appear the day before. A keeper turning up (see Passive income) also resets the 5 days.</li>
<li>Who comes: Lumi, Otis, Clover and Juniper first, in that order. Then Barley, Wren, Tobin, Hazel and Marigold, in that order (anyone among them whose dream has already stirred jumps ahead), so their stories start one at a time. Anyone else after that.</li>
<li>Ask someone to leave with "Ever think about moving?". They pack overnight. At least 5 always stay, and anyone who left won't come back for 30 days.</li>
<li>Good pen pals from trip towns can be invited to move in (see Pen pals).</li></ul>
<p>Clementine also runs every big building project in the island stories (the workshop, tea room, post office, bathhouse).</p>
<h3>Inside the town hall</h3>
<p>The tent has no inside, so Clementine works out front. Once the Town Hall is built you walk in and find her at her desk (the same goes for the Charter Hall). Inside:</p>
<ul><li><b>Island Records</b> board: islanders, museum donations, shops backed, things found, achievements and best friends. Read it for the island stories so far and a shortcut to Town projects.</li>
<li><b>Our islanders</b>: a portrait of everyone who lives here. Look at it for each islander's friendship hearts.</li>
<li>A table with a <b>map of the island</b> (Look opens the full map), and benches for town meetings.</li>
<li>The <b>Grand Town Hall</b> is bigger, with columns, two chandeliers, a grandfather clock and a trophy case that gets a prize for every 10 achievements (up to 8).</li></ul>
`},

{ id:'farshore', group:'island', title:'The far shore', html:`
<p>Your island reaches further out to sea all the way round: about half as much land again, left wild.</p>
<ul><li><b>How far</b>: the coast moves out by different amounts in different places, so the island keeps its own shape with a gentle wobble. On average that is about 11 metres on a Village, Spread out or Highlands island (often 8 to 14 metres) and about 16 metres on an island from the island maker (often 11 to 20 metres). The wobble is picked once for each island and never changes.</li>
<li><b>What grows there</b>: up to 6 low hills (kept away from the dock, the river mouth and the directions Wendell's isles rise), grass and wild flowers, trees, fruit trees of your island's fruit, palms along the beach, and a few rocks to hit.</li>
<li><b>What turns up</b>: bugs, dig spots, weeds and beach finds, like anywhere else on the island.</li>
<li><b>The dock and the river</b>: the dock sits out on the new beach, at the end of a straight path. The river runs on through the new land to the sea.</li>
<li><b>What doesn't</b>: no other paths, and nobody moves in out there. New islanders' houses, the keepers and the town's buildings all go on the old part of the island.</li>
<li>It's still yours to use: place furniture, plant, have Wendell move a building out there, or shape the land.</li></ul>
`},

{ id:'islanders', group:'island', title:'Islanders and friendship', data:'residents', html:`
<p>There are 12 islanders who can live on your island. Each has a personality, things they love and like as gifts, their own lines, and three little branching conversations that raise friendship (each comes up at most once every 21 days).</p>
<h3>Friendship</h3>
<ul><li>Talk daily and give gifts. A gift of a kind they love counts most.</li>
<li><b>5+</b>: "About your house..." lets you talk them into moving or redecorating their house (pick the argument that suits their personality; a wrong guess means try again tomorrow). Once a week each.</li>
<li><b>10+</b>: they can be a <b>helper</b> on a story project, and Pemberton's forge apprentice.</li>
<li><b>15+ (best friends)</b>: they agree to anything, and sometimes give you a boat ticket. The biggest backpack needs 3 best friends.</li></ul>
<p>Islanders are home about a third of their waking hours and always sleep at home from 11pm to 6am.</p>
${tip('Holding an axe or shovel, swing at an islander and they go flying like a ragdoll. Harmless, no effect on friendship.')}
`},

{ id:'favors', group:'island', title:'Favors and the Island Board', html:`
<p>Islanders, the shopkeepers, Clementine, Thistle and Wendell ask for things that fit who they are (Bramble wants firewood and fish, Lumi wants beach finds and night bugs, Juniper wants fossils and furniture, Pemberton wants you to sell to him). Up to 4 favors at a time, listed on the Island Board. Some are "do" favors that count what you do after agreeing (catch 5 bugs, water 6 plants).</p>
<p>Rewards: clams, friendship, and a thank-you gift from that character's list (furniture or clothes, some favor-only), sometimes a potion, a swatch book, foreign fruit or a boat ticket (about 4%).</p>
<h3>Story favors that unlock things</h3>
<table class="t"><tr><th>Favor</th><th>Bring</th><th>Unlocks</th></tr>
<tr><td>Lumi's wish (sparkles near the plaza)</td><td>2 starfish, 1 sand dollar</td><td>Wendell's wizard tower</td></tr>
<tr><td>Otis and the dark beacon</td><td>3 iron nuggets, 10 wood</td><td>Lights the Portal Station beacon: Fennick's cart starts visiting</td></tr>
<tr><td>Juniper's paint cousin</td><td>Any fossil, a Garden Lantern</td><td>Swatch books (house styles)</td></tr></table>
${note('If the islander a story favor was written for doesn\'t live on your island, another islander takes it over.')}
<p>The Island Board also shows achievements (160 of them, hidden until earned) and an "Island stories" page with one line per open dream.</p>
`},

{ id:'museum', group:'island', title:'The museum', html:`
<p>Professor Thistle the tortoise takes one of every fish, bug, fossil and beach find. Each donation is displayed for good.</p>
<h3>How it grows</h3>
<p>It starts as one small room: a shared tank (8 fish), a shared terrarium (8 bugs), 3 fossil pedestals and a 4-space case of beach finds. When a section runs out of room, the donation waits in the back room and builders expand that night:</p>
<ul><li>Fish or bugs past 8: an <b>Aquarium</b> wing (left) or <b>Insectarium</b> wing (right) with one themed tank per group. A group's tank is built the night after its first donation, so the wings get longer as you fill them. Fish groups: Pond &amp; Marsh, River Run, Coastal Shallows, Cay Bay Reef, Sandy Shallows, Reef Wonders, Rapids &amp; Riverbed, Lily Pool, Isles &amp; Far Shores, The Deep, Reef &amp; Open Ocean. Bug groups: Butterfly Garden, Garden &amp; Pond, Woodland &amp; Shore, Butterfly House, Flies, Wasps &amp; Lacewings, Beetle Hall, Creepy Crawlies, Hoppers, Mimics &amp; Shore, Moon Moths, Moths &amp; Night Lights.</li>
<li>Fossils past 3: a <b>Fossil Hall</b> across the back. Past 6: the <b>full Fossil Hall</b>, the width of the whole museum, with a spot for every fossil in the game. The 16 big fossils (the skulls, the Mammoth Tusk, the Dino Egg and the like) each have their own pedestal in two rows at the back, and the other 64 sit in 8 themed glass cases of 8 in front of them: Shells of the Old Sea, Clams and Corals, Stars and Sea Lilies, Trilobites and Crawlers, Ancient Plants, Fish and Swimmers, Amber and Small Wonders, and Dinosaurs and Ice Age. An empty pedestal or an empty tray in a case means that fossil is still out there.</li>
<li>Beach finds past 4: an 8-space case.</li></ul>
<p>The outside building grows a step per wing. The first wing counts as "outgrowing its cottage" for the Grand Town Hall. All three wings are needed for Lantern Bluff.</p>
<p>Click a tank (or walk up and press View) for a fullscreen view: tap a specimen for its card (where, when, your biggest).</p>
<h3>Thank-you gifts</h3>
<table class="t"><tr><th>Donations</th><th>Gift</th></tr><tr><td>10</td><td>Antique Globe</td></tr><tr><td>30</td><td>Mini Dino Skeleton</td></tr><tr><td>60</td><td>Explorer Statue</td></tr></table>
<p>Anonymous islanders sometimes leave clams (300 to 800) at the museum that Thistle passes on. Later, the <b>Reef Hall</b> story adds a walk-through reef wing.</p>
`},

{ id:'shops', group:'island', title:'Shops and investing', html:`
<table class="t"><tr><th>Shop</th><th>Keeper</th><th>Sells</th><th>Hours</th></tr>
<tr><td>Pemberton's General Store</td><td>Pemberton (bear)</td><td>Furniture, tools, bags, seeds, Home Goods, clothes, the storage chest</td><td>Always (honor jar at night)</td></tr>
<tr><td>Tidepool Aquarium Supply</td><td>Marlo (otter)</td><td>Aquarium furniture</td><td>8am to 10pm</td></tr>
<tr><td>Sprig's Bug &amp; Bloom</td><td>Sprig (fox)</td><td>Garden furniture, seeds, saplings</td><td>8am to 10pm</td></tr></table>
<p>Stock changes every day and is rolled by rarity, so rare pieces show up now and then. Each day one kind of tool is sold out if you already own one.</p>
<h3>Investing</h3>
<p>Once you have a house and have done 50,000 clams of trade (buying plus selling) at a shop, the keeper lets you buy in. Each tier upgrades the building, adds stock slots, makes rare stock more common, and raises what they pay.</p>
<table class="t"><tr><th>Tier</th><th>Cost</th><th>Pemberton</th><th>Marlo / Sprig</th></tr>
<tr><td>1</td><td>100,000</td><td>Corner Shop: 5% off, +3% selling</td><td>Pay 130%</td></tr>
<tr><td>2</td><td>200,000</td><td>General Store: 10% off, +6%</td><td>Pay 140%</td></tr>
<tr><td>3</td><td>400,000</td><td>Grand Emporium: 15% off, +10%</td><td>Pay 150%</td></tr></table>
<p>Backing a shop also counts toward the Grand Town Hall, Wendell's spells and isles, and brings Quill the bookkeeper (see Passive income). After investing, the keeper offers to move the shop for free.</p>
<h3>The top two tiers</h3>
<p>At tier 2 and tier 3 each shop opens up things you can't get anywhere else. Guests and visitors don't see them.</p>
<p><b>Pemberton's back room</b> (General Store and up): a <b>Back room</b> tab in his shop, or ask him about it. It holds one piece a week, from eight pieces that are sold nowhere else: the Seashell Jukebox, Treadle Sewing Machine, Cuckoo Clock, Steamer Trunk, Penny-Farthing, Marble Chess Table, Old Typewriter and Grand Hourglass. A new piece comes in every 7 days, and ones you haven't bought there yet come first. They get his usual discount. Sometimes a rare woodworking plan is under a dust sheet too (45,000 clams, you still need the rare ingredients): about a 25% chance a week at the General Store and 50% at the Grand Emporium.</p>
<p><b>Marlo's rare shelf</b>: at the Tidepool Aquarium, one rare piece a day joins his stock (Jellyfish Lamp, Seahorse Column Tank, Nautilus Shell Lamp). At the Grand Aquarium Hall it's two a day, and the Kelp Forest Tank, Porthole Aquarium and Octopus Lamp join the shelf. These pieces aren't in his everyday stock. Prices are in the table below.</p>
<p><b>Sprig's rare seeds</b>: at the Greenhouse, two packets a day from the rare colors (Blue Rose, Black Tulip, Jade Hyacinth, Rainbow Pansy) and the Starbell hybrid. At the Botanical Conservatory it's three a day, adding the Sunburst Daisy and Peppermint Poppy hybrids and the <b>Lantern Bloom</b>, which glows after dark and counts as a night flower for Lumi's glade. Sprig breeds the hybrids; you buy them as seeds and grow them like any flower. Seed prices are on the Fruit, flowers and plants page.</p>
<h3>What's biting</h3>
<p>Ask Marlo <b>What's biting?</b> for a tip about your home waters (sea, pond and river). Once Gill has lent you his rowboat and the reef is at least Stirring, ask him the same about Cay Bay. Tips are picked once a day and point at an uncommon, rare or very rare fish that is in season. How much they tell you depends on Marlo's shop tier and on Gill's boat.</p>
<table class="t"><tr><th>Level</th><th>Marlo</th><th>Gill</th><th>The tip tells you</th></tr>
<tr><td>0</td><td>Bait Shack</td><td>No boat yet</td><td>Where something is biting</td></tr>
<tr><td>1</td><td>Aquarium Supply</td><td>Dinghy</td><td>Where, its shadow size and its rarity</td></tr>
<tr><td>2</td><td>Tidepool Aquarium</td><td>Trawler</td><td>The fish, where, and roughly what time of day</td></tr>
<tr><td>3</td><td>Grand Aquarium Hall</td><td>Driftwood Queen</td><td>The fish, where and its exact hours, plus a second fish</td></tr></table>
<p>Tips are true. Once you've asked, each fish that appears in the tipped fish's water while it's biting has an extra chance to be that fish: 12% for uncommon, 8% for rare, 5% for very rare. At level 3 both fish get it. This works on your own island and in Cay Bay, not on trips.</p>
<h3>Better tools</h3>
<p>Better tool tiers don't just appear. When you go to rebuy a tool you wore out, Pemberton notices and offers the next tier at 20% off the first one.</p>
`, data:'shopfurn' },

{ id:'tools', group:'island', title:'Tools, bags and the bike', data:'tools', html:`
<p>Tools break after a number of uses. Golden tools need you to prove yourself first, and Heirloom tools never break. Only Sturdy and Golden (and Heirloom) axes can cut a tree down; the Flimsy axe only chops wood.</p>
<p>Other gear: the <b>bike</b> (60,000), the <b>Wooden Sled</b> (3,000, for winter hills) and the <b>map</b>, which has its own round button at the top left of the screen, under the clock, and shows land, paths, buildings and whose house is whose (not where anyone is).</p>
<h3>Repairing</h3>
<p>Fix a worn tool before it breaks. Two ways:</p>
<ul><li><b>Yourself</b>: the Tools tab in the Craft panel, anywhere, no crafting table needed. It costs materials by tier (see the table below), scaled by how worn the tool is, at least 1 of each.</li>
<li><b>Pemberton</b>: "Fix my tools" at the General Store, for clams. The more worn the tool, the more it costs, and enchanted tools cost a bit more to fix.</li></ul>
<p>Heirloom tools never wear out, so they never need fixing. You get one warning when an enchanted tool is wearing thin.</p>
<h3>Broken tools</h3>
<p>A tool that breaks leaves your hands but isn't gone. It waits in the Tools tab under <b>Broken tools</b>, with its enchantments still on it, until you fix it. Fixing a broken tool needs a crafting table nearby (any one, a Workbench is enough) and costs twice a full repair: Flimsy 4 wood and 4 driftwood branches, Sturdy 6 wood and 2 iron, Golden 8 iron and 8 stone (the Golden Can too; the basic can costs the same as a Flimsy tool). The fixed tool comes back with all its uses and enchantments, and goes straight into your hand. Pemberton only fixes tools that are worn, not broken.</p>
<ul><li>If you bought or made a cheaper stand-in while it was broken, the fixed tool takes its place, and anything enchanted on the stand-in is lost. The Tools tab asks first.</li>
<li>Buying or making a tool of that kind that's as good or better scraps the broken one, enchantments and all. Pemberton and the Tools tab warn you first if it had any.</li>
<li>At a crafting table, the top of Woodworking lists any broken tool, and any tool with a quarter or less of its uses left, with a button to the Tools tab.</li></ul>
<h3>Making tools</h3>
<p>The Tools tab's "Make a tool" list makes the same tools Pemberton sells, from materials. You need the same experience as buying (the "Needs" column below). A Flimsy tool (and the basic Watering Can) can be made anywhere; each better tier needs a bigger crafting table: Sturdy at a Workbench, Golden at a Carpenter's Bench, Heirloom at a Master Workbench. The watering can skips Sturdy, so the Golden Can needs only a Workbench and the Heirloom Can a Carpenter's Bench. See <a href="#tables">Crafting tables</a>.</p>
<p>A new tool of the same kind, bought or made, takes the old one's enchantments with it. The one exception: Tough, Tougher and Ultratough come off when you move up to an Heirloom tool, because it never wears out. The shop and the Tools tab warn you first.</p>
`},

{ id:'enchanting', group:'island', title:'Enchanting tools', data:'enchanting', html:`
<p>Enchantments make a tool better at something. You learn each one once, like a plan, then put it on a tool whenever you have the ingredients. The game never shows exact strengths: only "slightly", "moderately" or "greatly increased".</p>
<h3>Where to do it</h3>
<p>Open the Craft panel and pick the <b>Tools</b> tab (it shows up once Bramble has given you his workbench). "Your tools" lists each tool with its enchantments, a Repair button and an Enchant list. A first-rank enchantment needs a Workbench nearby, a second-rank one a Carpenter's Bench, and the strongest ones a Master Workbench. Taking one off works anywhere, but the charm unravels: you'd need the ingredients again to put it back.</p>
<h3>Learning them</h3>
<ul><li><b>Pippa</b> teaches the first rank for free. Once your friendship with her reaches 6, talk to her and pick "Charms?" for Tough, Bonk and Lucky. At friendship 10, after you've put 3 enchantments on tools, she has Steady, Hefty and Splash too.</li>
<li><b>Wendell</b> teaches the stronger ones for clams ("Enchanting", once you've met him). He offers up to 4 at a time. A second rank needs the first rank of that kind known. A third rank needs the second known and 8 enchantments put on tools in all. Double Output needs 3 put on. Triple Output and One-Swing need Double Output known and 15 put on.</li>
<li><b>Enchanting Scrolls</b> teach one enchantment you don't know yet the moment you pick them up. They're rare finds: now and then when you dig up a fossil, fell a tree or catch a fish, and sometimes in a bottle on the beach. Stronger ones are rarer. Fennick sometimes has one on his cart too (see <a href="#fennick">Fennick's cart</a>). Guests don't find them.</li></ul>
<h3>Rules</h3>
<ul><li>A tool holds <b>one</b> enchantment until you learn the Twin Charm.</li>
<li>Putting on a stronger (or different) enchantment of the same kind replaces the old one. On a full tool you pick which one comes off.</li>
<li>Double Output, Triple Output and One-Swing are one kind, so a tool never has more than one of them.</li>
<li>Tough can't go on an Heirloom tool, since it never wears out.</li>
<li>Your enchantments move over when you buy or make a better tool of the same kind. A broken tool keeps them until you fix it at a crafting table (see <a href="#tools">Broken tools</a>), but replacing it instead scraps them.</li></ul>
<h3>What the special ones do</h3>
<ul><li><b>Bonk</b>: swing at an islander (or a friend) and they fly farther.</li>
<li><b>Lucky</b>: better odds of rare-or-better finds. On the axe that's things like heartwood, on the shovel fossils and other finds, on the net bugs, on the rod fish. On rocks it counts for whichever of the axe or shovel you hit with.</li>
<li><b>Steady, Sure, Sure Catch</b>: on the net, bugs are less skittish and catching is easier. On the rod, fish notice the bobber from farther, scare less and give you a longer bite.</li>
<li><b>Hefty, Trophy, Big Game</b>: bigger fish and bugs more often.</li>
<li><b>Splash, Shower, Downpour</b>: watering one plant also waters dry plants around it, for one use of the can.</li>
<li><b>Double and Triple Output</b>: more from each swing: wood from chopping and felling, stone, clay and iron from rocks, stumps, and the fossil from a dig spot.</li>
<li><b>One-Swing</b>: on the axe, a tree comes down in one chop with a pile of wood (even a Flimsy axe can do it). On the shovel, one swing taps a rock out for the day.</li></ul>
<h3>The Twin Charm</h3>
<p>Late game, Wendell teaches the Twin Charm (300,000) once you know the strongest form of 3 different kinds and have put 25 enchantments on tools. After that every tool can hold two. Whenever a tool ends up holding two, it also uses 1 Starstone and 1 Golden Sap, and that has to be done at a Master Workbench.</p>
${note('Guests can learn from Pippa and enchant, but don\'t find scrolls. On a friend\'s island you can\'t enchant.')}
`},

{ id:'garden', group:'island', title:'Gardening and farming', data:'crops', html:`
<h3>Seeds</h3>
<p>Every island has <b>4 crops that grow wild</b>, picked from the island's seed and weighted by terrain. They cost 30 each, always in stock (Pemberton's Garden tab, Sprig, a seed bin in the store), and about 6 ripe plants of each stand around the island, topped up daily. Other seeds rotate daily at normal prices. Each island also has 3 wild flower species; picking a clump gives the flower and 1 to 3 seeds.</p>
<h3>Planting</h3>
<p>Seeds open a planter: choose how many and how long each row is (up to 10 x 10). Drag the patch into place; green squares plant, red ones are skipped (you never lose seeds). Near a garden it snaps flush to its side. No shovel needed for crops.</p>
<h3>Gardens</h3>
<p>Planting makes a garden, which is free. Tap its stake for the garden menu: harvest all, water all, plant, fences, decorations, move the gate.</p>
<ul><li>Fences per piece: rustic 40, white picket 60, low stone 70, boxwood hedge 90.</li>
<li>Decorations (one-time per garden): sign 500, scarecrow 1,200, corner lanterns 1,600 (needs a fence), flower arch 2,000.</li></ul>
<h3>Harvesting</h3>
<p>No tool needed. Every harvest gives the crop plus 1 to 4 seeds. Tomatoes, herbs and berries stay planted (berries drop back a stage and are ready again in about a day). Watering speeds growth.</p>
<h3>Trees and orchards</h3>
<p>Plant fruit to grow a fruit tree; picked trees regrow fruit in 3 days. With 2+ saplings or fruit in your bag you can plant a whole block (up to 25, Tight, Roomy or Wide spacing).</p>
<h3>Mossby</h3>
<p>Cut down too many trees in one day (10, 16, 24) and Mossby, the island's little tree spirit, pops up to scold you, angrier each time. Replant 3 and he cheers up. He only looks after your home island, so felling trees on a trip island won't bring him out.</p>
`},

{ id:'crafting', group:'island', title:'Woodworking', data:'woodwork', html:`
<p>Make furniture from the Craft panel. Away from a crafting table you can only make a few simple things (Stump Stool, Wooden Fence, Log Pile, Wooden Signpost, Mossy Stump Seat, Cozy Campfire and the Workbench itself); everything else needs a table nearby, and rare showpieces need a Carpenter's Bench. See <a href="#tables">Crafting tables</a>. You start knowing 4 plans (Stump Stool, Fence, Log Pile, Mossy Stump Seat). Making 3 different ones of those, and 10 things in all, teaches 6 more (Signpost, Birdhouse, Crate, Bench, Workbench, Campfire).</p>
<p>After that new plans come from:</p>
<ul><li>A batch of 3 at each variety milestone. Each different piece you make counts for up to 3 points: making it once is 1 point, three times is 3, and making it more often adds nothing. The milestones are at 24, 33, 42, 51, 60, 69, 78 and 87 points, so you need to make most of what you know, a few times each, before more comes. You get at most one batch a day; if you pass a milestone after that, the plans come the next day (open the Craft panel).</li>
<li>Woodworking Plan items: dug up (1.5% of digs), from felled trees (1%), or Pemberton's one-a-day plan.</li>
<li>Studying a piece you own from the Woodworking panel, once a day.</li></ul>
<p>Digging up a stump gives a Tree Stump for stump furniture.</p>
<p>What a piece sells for follows what went into it. A piece made only from wood, branches, stone and weeds sells for about its materials plus 15% (3 fences from 2 wood sell for 45 in all), so woodworking adds a little to chopping rather than replacing it. A piece that needs iron, clay, stumps, planks or rare finds sells for more, and never for less than its materials plus 15%.</p>
${tip('Making 14 <b>different</b> pieces is what starts Bramble\'s workshop story.')}
<h3>Rare showpieces</h3>
<p>Six legendary pieces need a rare plan (found very rarely, Fennick sometimes sells one for 45,000, or pick one at the Plan Library island) and rare ingredients that turn up by chance:</p>
<ul><li><b>Heartwood</b>: chopping, more when a tree comes down.</li><li><b>Golden Sap</b>: shaking trees.</li>
<li><b>Starstone</b>: hitting rocks, more at night.</li><li><b>Moonpearl</b>: with a catch, or on the beach.</li>
<li><b>Glimmer Moss</b>: digging out old stumps, or with weeds at night.</li></ul>
<p>Luck potions make them more likely. Golden Grove (sap and heartwood) and Stardrift Isle (starstones) are full of them.</p>
`},

{ id:'tables', group:'island', title:'Crafting tables', html:`
<p>Place a crafting table and stand next to it, then open the Craft panel. The top of the panel says which table you're at. A bigger table does everything the smaller ones do.</p>
<table class="t"><tr><th>Table</th><th>How you get it</th><th>What it adds</th></tr>
<tr><td>None</td><td></td><td>Repair tools, make Flimsy tools and a few simple pieces</td></tr>
<tr><td>Workbench</td><td>Bramble gives you one when he teaches woodworking; you can make more</td><td>All everyday woodworking, Sturdy tools, first-rank enchantments</td></tr>
<tr><td>Carpenter's Bench</td><td>Its plan comes once you've made 16 different things</td><td>Rare-plan showpieces, Golden tools, second-rank enchantments and Double Output, plus Rocking Horse, Garden Wagon, Rolltop Desk and Vine Pergola</td></tr>
<tr><td>Master Workbench</td><td>Its plan comes once you've made 30 different things, one of them a Carpenter's Bench</td><td>Heirloom tools, the strongest enchantments and the Twin Charm's binding, plus Carousel Music Box, Weaving Loom, Garden Windmill and Garden Gazebo</td></tr></table>
<p>Building a table for the first time teaches its pieces. Materials are in the <a href="#crafting">Woodworking</a> table.</p>
`},

{ id:'custom', group:'island', title:'Custom furniture', html:`
<p>Once you've made 10 different woodworking pieces, crafting gets a <b>Design</b> tab. Stand at a crafting table, pick a piece and choose every part of it yourself.</p>
<table class="t"><tr><th>Piece</th><th>Parts you choose</th></tr>
<tr><td>Chair</td><td>11 legs, 12 backs, 7 seats, 5 arms, 8 trims</td></tr>
<tr><td>Table</td><td>10 bases, 8 tops, 6 aprons, 9 things on top</td></tr>
<tr><td>Bed</td><td>7 frames, 10 headboards, 6 footboards, 7 beddings, 5 canopies</td></tr>
<tr><td>Shelf</td><td>7 bodies, 6 crowns, 5 bases, 7 fillings</td></tr>
<tr><td>Lamp</td><td>7 bases, 6 stems, 9 shades, 5 finishes</td></tr>
<tr><td>Dresser</td><td>6 bodies, 6 feet, 7 fronts, 6 handles, 6 tops</td></tr></table>
<p>That's 68,412 shapes. On top of that: 16 woods and paints, a second wood, 5 metals, 14 fabrics and 9 patterns. A spinning preview shows the piece as you go. <b>Surprise me</b> picks a matching set in one style (rustic, cottage, antique, modern or woodland).</p>
<h3>Unlocking parts</h3>
<ul><li>A <b>Workbench</b> opens the everyday parts, woods and finishes.</li>
<li>A <b>Carpenter's Bench</b> opens fancier ones (turned and twisted legs, wingbacks, marble tops, damask and velvet).</li>
<li>A <b>Master Workbench</b> opens the finest (cabriole and claw feet, shield backs, sleigh beds, stained glass, gold leaf, ebony).</li>
<li>A few rare parts only come from <b>sketches</b>: claw feet, carved leaf backs, moss cushions, moonpearl finials, starstone inlay, root bases, hollow-trunk shelves, carved forest headboards and more.</li></ul>
<h3>Sketches</h3>
<p>Now and then a whole furniture sketch turns up: about 1 dig in 80, 1 felled tree in 50 and 1 catch in 250. The sketch goes straight into your designs and teaches any rare parts it uses.</p>
<h3>What pieces are worth</h3>
<ul><li>Every copy sells for its materials plus 15%, so you can't get rich making the same chair over and over.</li>
<li>The <b>first time you sell a design you made yourself</b>, you get a craftsmanship bonus on top: more for detailed parts and for materials you can't farm (iron, planks, clay, stumps, rare ingredients). It's usually 700 to 3,500 clams, and much more when rare ingredients go in.</li>
<li>Only 2 new designs a day earn the bonus. Sell the rest another day and they still get it.</li></ul>
<h3>Islanders' requests</h3>
<p>An islander you're friends with (friendship 3+) sometimes asks you to make something and shows you a sketch of it, in a style that suits them (gruff: rustic, elegant: antique, dreamy: woodland, sporty and lazy: modern, cheerful and caring: cottage). Make it at a crafting table, then talk to them and hand it over.</p>
<ul><li>The closer it is to the sketch, the more they pay. Shape counts most, then the wood, then the fabric.</li>
<li>Get at least half of it right or they'll ask you to try again.</li>
<li>A close match is +3 friendship, a looser one +2. They keep the piece.</li>
<li>Each islander asks at most once every 2 weeks, and you can have 2 requests open at once. Open requests show in the Design tab, with a "Try it" button that loads the sketch into the designer.</li></ul>
${tip('Your saved designs are kept, so making a matching set of chairs is quick: press Make on the saved design.')}
`},
{ id:'pets', group:'island', title:'Pets: dogs and cats', html:`
<p>You can have one pet: a dog or a cat. It follows you around, explores your island or stays at home.</p>
<h3>Finding one</h3>
<p>While you don't have a pet (and there's no Pet Basket in your bag), a stray dog wanders one small part of your island each day and a stray cat wanders another. They move to new spots every day. They only turn up on your own island, never on a friend's island or a boat trip.</p>
<h3>Winning one over</h3>
<ol><li><b>Wary.</b> At first it keeps at least 5 m away and backs off if you get closer.</li>
<li><b>Food.</b> Drop some food near it (fish, fruit, a crop or something you cooked) and step back. It comes over and eats it once you're a few metres from the food. Fish you drop near a stray are set down instead of released. After eating it stops avoiding you, but it still runs off a few metres if you <b>run</b> at it, or walk <b>straight</b> at it from close by. Hold Shift, or push the joystick only part way, to walk slowly, and come at it from the side.</li>
<li><b>Trust.</b> Call it (<i>Psst psst psst</i> for a cat, <i>Tchk tchk tchk</i> for a dog) from up to 6 m away, or pet it if you can get right next to it. Each call counts once and a pet counts twice. After 3 it trusts you: it comes over and follows you a short way, but not far from its spot.</li>
<li><b>Collar.</b> Walk up with a <b>Pet Collar</b> in your bag and choose <b>Put on collar</b>. The pet is yours, and you pick its name from a list.</li></ol>
<p>How far you've got with each stray is kept until the end of the day. Tomorrow's strays start over.</p>
<h3>Pet Collars</h3>
<p>Sewn at a <b>Sewing Machine</b> (see Sewing) from <b>6 weeds</b>. One collar fits a dog or a cat.</p>
<h3>Coats</h3>
<p>Each stray's coat is rolled when it turns up: Common 89.6%, Rare 10%, Very rare 0.4%, Legendary 1 in 5,000.</p>
<table class="t"><tr><th>Rarity</th><th>Dogs</th><th>Cats</th></tr>
<tr><td>Common</td><td>Golden, Cocoa, Black and Tan, Cream</td><td>Ginger Tabby, Grey, Black, Tuxedo</td></tr>
<tr><td>Rare</td><td>Dotty, Blue Merle</td><td>Calico, Siamese</td></tr>
<tr><td>Very rare</td><td>Ember, Silver</td><td>Lilac, Snow Smoke</td></tr>
<tr><td>Legendary</td><td>Starlit (glows)</td><td>Moonlit (glows)</td></tr></table>
<h3>Looking after your pet</h3>
<p>Walk up to your pet and choose <b>Pet</b> to give it a fuss and pick what it does:</p>
<ul><li><b>Follow me</b>: it comes everywhere with you, into houses and onto friends' islands. Pets don't come on boat trips; it waits at home and joins you again when you're back.</li>
<li><b>Go explore the island</b>: it wanders around your island near your house and sometimes trots over to say hello.</li>
<li><b>Stay home</b>: it stays inside your house.</li>
<li><b>New name</b>: pick another name from the list.</li></ul>
<p>Friends on the same island as you see your pet.</p>
<h3>Giving a pet away</h3>
<p>Choose <b>Give to a friend</b>. Your pet curls up in a <b>Pet Basket</b> in your bag. Mail the basket from the Friends tab or put it in a trade. Whoever has the basket chooses <b>Let it out</b> in their bag to take the pet, as long as they don't already have one. You can also let it out again yourself. A basket can't be sold, set down on the ground or given to an islander. While you have a basket in your bag, no strays turn up.</p>
`},

{ id:'sewing', group:'island', title:'Sewing: rugs and clothes', html:`
<p>You sew at a <b>Sewing Machine</b>. Once you know woodworking, ask Pemberton <i>"Do you sell sewing machines?"</i> and he'll sell you one for <b>12,000 clams</b> (he only offers it while you don't already own one). Place it on your island or in your house, walk up and press <b>Sew</b>. Weeds are your yarn. Pick a rug or a piece of clothing, set its shape and size, then <b>paint it pixel by pixel</b> from 32 yarn colours.</p>
<p>The machine sells back for 3,000. You can't use a machine on a friend's island.</p>
<h3>Getting better</h3>
<p>Every piece you sew counts toward your sewing skill. The better you get, the finer your grid (more detail) and the more alterations your clothes can carry.</p>
<table class="t"><tr><th>Skill</th><th>Pieces sewn</th><th>Grid</th><th>Alterations</th><th>Opens</th></tr>
<tr><td>Beginner</td><td>0</td><td>8 x 8</td><td>0</td><td>Rectangle, round, oval and runner rugs; shirts and dresses</td></tr>
<tr><td>Apprentice</td><td>3</td><td>12 x 12</td><td>1</td><td>Octagon rugs, borders, plush pile; coats and overalls; pockets, collars, cuffs, buttons</td></tr>
<tr><td>Tailor</td><td>8</td><td>16 x 16</td><td>2</td><td>Cloud rugs, tassels, braided edges; robes, bell sleeves; ruffles, bows, hoods, lace</td></tr>
<tr><td>Artisan</td><td>16</td><td>24 x 24</td><td>3</td><td>Star and leaf rugs, scalloped edges; puffed sleeves, ballgowns; capes, studs, coat tails, patches</td></tr>
<tr><td>Master</td><td>30</td><td>32 x 32</td><td>5</td><td>Shell rugs, pom-poms; the strange ones: leaf mantles, toadstool epaulettes, fins down the back, glowing trim, orbiting stars, little wings</td></tr></table>
<p>An old design painted on a coarser grid can be moved up to your current grid with one click, then refined.</p>
<h3>Painting</h3>
<ul><li><b>Brush</b> paints one square, <b>Fill</b> fills a patch of one colour, <b>Pick colour</b> copies a colour from the painting.</li>
<li><b>Mirror</b> paints both sides at once.</li>
<li><b>Start from</b> stripes, a check, a border or a diamond in your two colours, then paint over it.</li>
<li>On clothes, the middle half of the painting is the front; the outer quarters wrap round the back.</li></ul>
<h3>Rugs</h3>
<p>Choose the shape, width and length (0.6 to 3 m), edge, pile and edge colour. A rug costs weeds by its size (plush pile and tassels or pom-poms take a few more). It goes in your bag; place it like any furniture.</p>
<ul><li>Copies sell for their materials plus 15%.</li>
<li>The first time you sell a rug you designed, you get an art bonus for the work: more colours, a finer grid and fancier shapes and edges pay more (from a few hundred for a simple two-colour rug to about 3,000 for a big, detailed one). Up to 2 new rugs a day get the bonus.</li></ul>
<h3>Clothes</h3>
<p>Choose a garment (shirt, dress, coat, overalls, robe), sleeves, length and, for dresses and robes, how full the skirt is. Then add alterations. Clothes take weeds, plus a little extra for some alterations (iron for studs, branches for a leaf mantle, clay for toadstools, glimmer moss for glowing trim, a starstone for orbiting stars, heartwood for wings).</p>
<p>Finished clothes go in your <b>closet</b> at the Sewing Machine. Press <b>Wear</b> to put one on, <b>Take off</b> to go back to your usual outfit. Friends see what you're wearing, painting and all. Picking a different outfit in Menu &gt; Change my look takes sewn clothes off.</p>
`},
{ id:'cooking', group:'island', title:'Cooking', data:'recipes', html:`
<p>Mabel teaches cooking once she knows you. Cook at a <b>campfire</b> (craftable; simple dishes marked "fire") or a <b>Wood Stove</b> (anything). Dishes sell well, islanders love them, and eating one makes you walk a little faster for 5 minutes. "Fish" or "fruit" in a recipe means any fish or fruit.</p>
`},

{ id:'style', group:'island', title:'Clothes and your look', html:`
<p>Change my look lets you restyle your character any time. Pemberton has a Clothes tab (4 pieces a day); some pieces only come as favor gifts. There are outfits, outfit colors and accessories in four slots: hat, glasses, neck and back. Clothes go straight to your wardrobe, never the bag. Wings and the balloon animate.</p>
`},

/* ============================== MAGIC ============================== */
{ id:'wendell', group:'magic', title:'Wendell the wizard', html:`
<p>Wendell is a semi-retired wizard whose tower appears near the plaza after Lumi's wish (2 starfish and a sand dollar).</p>
<h3>Inside the tower</h3>
<p>Wendell works inside his tower. Walk up to the door and press Enter. The first time you go in, he introduces himself if you haven't met yet, or says hello and tells you where things are if you have.</p>
<p><b>Downstairs, the workroom:</b></p>
<ul><li><b>Wendell</b>, by his cauldron. Talk to him for everything on this page: potions, enchanting lessons, moving buildings, shaping land and the isles.</li>
<li><b>The cauldron</b>: tap it to go straight to the potion shop.</li>
<li><b>The bookshelves</b>: pull out a book at random. Two of them tell you how close you are to his moving and land spells.</li>
<li><b>The lectern</b>: his enchanting lessons, once you've met him.</li>
<li><b>The scrying bowl</b>: another way to start moving a building or shaping the land.</li>
<li><b>The star chart</b>, the workbench, his owl Hoot and the armchair are there to look at. Starfall Isle shows on the chart once it has risen.</li></ul>
<p>Moving a building, shaping land and raising an isle all happen outdoors, so you step out of the tower before the spell starts.</p>
<p><b>Upstairs, the observatory</b> (take the stair by the star chart):</p>
<ul><li><b>The telescope</b>: by day you see sky and clouds. At night you see one of five constellations, a different one each day, or Starfall Isle hanging over the Crags once it has risen.</li>
<li><b>The glass dome</b>: an empty cushion waiting for Starglass. Once Starfall Isle has risen, a Starglass Shard sits there.</li>
<li>The orrery, the star globe and the desk are for looking at.</li></ul>
<h3>Luck potions</h3>
<p>Each lasts 10 real minutes and makes rare finds of one kind far more likely (rare things about 3.5x, very rare and legendary about 3x).</p>
<table class="t"><tr><th>Potion</th><th>Price</th><th>Luck for</th></tr>
<tr><td>Angler's Draught</td><td>3,000</td><td>Fish</td></tr><tr><td>Fluttercharm Tonic</td><td>3,000</td><td>Bugs</td></tr>
<tr><td>Diviner's Elixir</td><td>3,000</td><td>Fossils, beach finds, swatch books</td></tr><tr><td>Lucky Star Elixir</td><td>8,000</td><td>All three</td></tr></table>
<h3>Moving buildings</h3>
<p>Needs a house with 16 floor squares and 2 shops backed. Your house 30,000, anything else 50,000. You see a see-through preview before paying. (Keepers you've invested in will also move their own buildings for free.)</p>
<p>The check uses the building's real outline, so buildings can stand about a step apart. If a spot is a little off, the preview slides over to the nearest spot that fits. When it can't fit, it says what is in the way (the sea, the beach, a river or pond, a cliff, a bridge, the plaza, a garden, ground that's too uneven, or which building is too close) and a red marker shows where.</p>
<p>Shop stands, the museum and the town hall are checked at the size they grow to, so there is always room for the next upgrade. That also means other buildings can't go where one of those will grow.</p>
<p>Things you placed or planted where it lands (furniture, flowers, saplings, dropped items) are set down beside it; if there is no room anywhere near, furniture goes to your bag. Wild flowers and stumps there are cleared.</p>
<h3>Shaping land</h3>
<p>Needs a house with 24 squares and all 3 shops backed. Raise or lower terraces, dig ponds and rivers, fill them in, priced per square. A preview shows the plan first.</p>
<p>Wendell also raises new isles from the sea, below.</p>
`},

{ id:'isles', group:'magic', title:'Wendell\'s isles', html:`
<p>Once the tower is up and the island is ready, Wendell starts talking about old land sunk under the sea ("You look distracted"). He raises six isles, one at a time, at least 3 days apart. He never lists requirements: he says one hint for the first thing missing, in this order: relics, then the town hall, trade (shops), the museum, a neighbor's dream, then the price.</p>
<table class="t"><tr><th>#</th><th>Isle</th><th>Hidden requirements</th><th>Relics</th><th>Clams and materials</th><th>What's there</th></tr>
<tr><td>1</td><td>Clover Meadow</td><td>Town Hall, one shop backed</td><td>Heartwood Acorn</td><td>60,000, 30 wood, 15 stone, 10 flowers</td><td>Grass and wildflower fields, an orchard of a fruit you don't grow, a fishing pond with a brook and a footbridge, low hills, an old windmill</td></tr>
<tr><td>2</td><td>Sandpiper Dunes</td><td>Marlo backed, museum's first wing</td><td>Sunken Ley Stone</td><td>120,000, 10 beach finds, 20 branches, 6 coconuts</td><td>All sand and palms, a long spit of dunes running out to sea, a big shipwreck, the best beachcombing</td></tr>
<tr><td>3</td><td>Old Pinewood</td><td>Grand Town Hall, Pemberton backed, Bramble's workshop dream open</td><td>Frostpine Cone, Amber Sliver, Heartwood Acorn</td><td>180,000, 60 wood, 20 stone</td><td>Big misty pines that grow back overnight, the Grandfather Stump, site of Bramble's workshop</td></tr>
<tr><td>4</td><td>Lantern Bluff</td><td>All three museum wings, the workshop open</td><td>Moonsap Vial</td><td>220,000, 30 planks, 8 iron, 10 clay</td><td>Cliff-top plateau with raised knolls, a spring that spills over the cliff as a waterfall, sea stacks offshore, pines, good rocks, the old lighthouse</td></tr>
<tr><td>5</td><td>Hollow Crags</td><td>All three shops at tier 2, the reef at Teeming</td><td>Amber Sliver, Living Coral Crown</td><td>350,000, 15 iron, 30 stone, 2 fossils</td><td>Bare stone and gravel, a quarry of iron-rich rocks (and now and then an emerald), boulders, scree and rock outcrops, stone spires, old ruins, a sunken grotto with steps down to a pool; site of Pemberton's forge</td></tr>
<tr><td>6</td><td>Starfall Isle</td><td>The Island Charter signed and Wendell's last letter</td><td>Living Coral Crown, Starglass Shard, Moonsap Vial</td><td>500,000, and one each of: plank, honey, tea cake, iron fitting, flour, bath salts</td><td>A small isle in the sky beside Hollow Crags, up a stair of glowing stones. Always night up there, with its own bugs and the star altar</td></tr></table>
<p>Each isle rises off the new coast (see The far shore). On islands from the island maker, the directions the isles rise in are picked for that island, so they're not in the same places on every island. Wendell tells you which direction an isle will rise in when he first brings it up.</p>
<p>The first isle isn't mentioned at all until the island is ready for it. The day after each isle rises, Wendell writes a letter hinting which way to look for the next. Starfall Isle is different: Wendell says nothing about it until the Island Charter is signed, and his letter the day after is the hint.</p>
<h3>What each isle gives</h3>
<ul><li><b>Clover Meadow</b>: the pond and the brook are fishable (pond fish and river fish). 7 fruit trees, an orchard of 12 more, and 28 other trees.</li>
<li><b>Sandpiper Dunes</b>: 34 palms and nothing else grows there. Every day it has 12 shells, 5 pieces of coral and 5 dig spots. The shipwreck is big. Hazel's wreck story and the diving bell are there.</li>
<li><b>Old Pinewood</b>: 32 big pines and cedars. Each gives 5 wood when it falls with a plain axe, 7 with One-Swing. They grow back the next day.</li>
<li><b>Lantern Bluff</b>: 5 rocks and 34 trees.</li>
<li><b>Hollow Crags</b>: 12 rocks. A crags rock is iron-rich: each hit gives iron half the time (stone 30%, clay 20%), plus a 1 in 5 chance of an extra iron, a 4% chance of a fossil and a 2% chance of an <b>emerald</b>. That is about 2.8 iron per rock per day, against about half an iron from a rock on your island, and about 1 emerald a day if you tap out all 12 rocks (4 hits each). Emeralds come from nowhere else. They are very rare, sell for 2,500 clams, and land in the same pile as the rest of that rock's drops, so one click picks them up. The ground is bare stone and gravel, with grass and ferns only in a few mossy hollows, loose boulders and scree everywhere, and a few solid rock outcrops you walk round. 7 trees. The grotto pool at the bottom of the steps is fishable.</li>
<li><b>Starfall Isle</b>: a glowing pool, a garden of glowing mushrooms and crystals, and small rocks drifting round the edge. 18 trees.</li></ul>
<p>Trees cut on the isles grow back: Old Pinewood's the next day, the other isles' after 3 days.</p>
<h3>Starfall Isle</h3>
<p>The stair climbs from Hollow Crags. Up top it is always night, whatever the clock says, and three bugs live nowhere else: the Sky Drifter, the Comet Beetle and the rare Nebula Moth. They're in the bug catalog under "On Starfall Isle".</p>
<p>The <b>star altar</b> takes two of Wendell's spells. Leave the clams in the bowl:</p>
<ul><li><b>Aurora</b> (80,000): green and violet curtains of light over your island every clear night. Since the camera looks down at the island, you see it where its light lands: bands of green and violet drifting across the grass, streaks of it on the sea, and small lights floating in the air around you. It doesn't show in the rain, and it's fainter when it's cloudy.</li>
<li><b>Glowing paths</b> (50,000): every stone on every path lights up, each with a rune in it and its own color, and pulses of light run along the paths. Sparks rise off the stones near you. A line of glowing stones also runs down each isle's path. It's brightest at night, and you can just see it in the daytime.</li></ul>
<p>When you cast one, a beam of light goes up from the altar and the view swings out over your island so you can see the sky for a moment.</p>
<p>Both are for looks only. You can lift either one at the altar and bring it back later for free.</p>
${note('Stardrift Isle, the legendary trip island, is a different place.')}
`},

{ id:'relics', group:'magic', title:'Relics', html:`
<p>Relics are old things that remember the sunken land. They only exist once Wendell has asked for them (he "attunes" you). The first time he asks for each one he gives you a <b>free ticket</b> to the right kind of island.</p>
<table class="t"><tr><th>Relic</th><th>Best place to look</th><th>Needed for</th></tr>
<tr><td>Heartwood Acorn</td><td>Orchard Isle</td><td>Clover Meadow, Old Pinewood</td></tr>
<tr><td>Sunken Ley Stone</td><td>Shipwreck Cove</td><td>Sandpiper Dunes</td></tr>
<tr><td>Frostpine Cone</td><td>Frost Isle</td><td>Old Pinewood</td></tr>
<tr><td>Amber Sliver</td><td>Fossil Bluffs</td><td>Old Pinewood, Hollow Crags</td></tr>
<tr><td>Moonsap Vial</td><td>Moonlit Isle</td><td>Lantern Bluff, Starfall Isle</td></tr>
<tr><td>Living Coral Crown</td><td>Coral Atoll</td><td>Hollow Crags, Starfall Isle</td></tr>
<tr><td>Starglass Shard</td><td>Any rare or legendary island (always, while Wendell wants it); Moonlit Isle</td><td>Starfall Isle</td></tr></table>
<h3>Finding one</h3>
<p>Look for a <b>rune stone that hums</b> on a trip island; the relic is buried at its foot (shovel). Chances a trip holds one you still need: 60% on its own kind of island, 15% on another themed island, 5% on a plain one.</p>
${note('Relics can\'t be sold, gifted, mailed or traded. A storage chest holds them.')}
`},

/* ============================== AWAY ============================== */
{ id:'trips', group:'away', title:'Boat trips (Skipper Wick)', html:`
<p>Skipper Wick waits at the dock. <b>2,000 clams</b> buys a trip to a random small island, or hand him a ticket to go to a named one. There's no time limit: stay until your bag is full, then sail home and see what you brought back. Trip islands don't refill and don't change your home island.</p>
<h3>Odds for a 2,000-clam trip</h3>
<table class="t"><tr><th>Result</th><th>Chance</th></tr>
<tr><td>Quiet island (nobody there, always a surprise)</td><td>38%</td></tr><tr><td>Small town</td><td>38%</td></tr>
<tr><td>Themed: Orchard, Bloom or Frost Isle</td><td>20%</td></tr><tr><td>Moonlit or Castaway Isle</td><td>2%</td></tr>
<tr><td>Rare island</td><td>1.5%</td></tr><tr><td>Legendary island</td><td>0.5%</td></tr></table>
<h3>Tickets</h3>
<p>Tickets go to a named themed island: Orchard, Bloom, Frost, Moonlit, Coral Atoll, Fossil Bluffs, Shipwreck Cove or Castaway. They come from favors (about 4%), digging (0.4%), best-friend gifts (8%), Wendell's relic asks, the circus camp and the noticeboard village. Rare and legendary islands are luck only.</p>
<h3>Group trips</h3>
<p>With friends on your island, Wick asks who's coming. Everyone gets their own copy of the island's stuff, you see each other live, and only the leader pays.</p>
<h3>Night voyages</h3>
<p>Once the lighthouse on Lantern Bluff is lit, Wick runs a night voyage once a week for 8,000, always to a Moonlit isle.</p>
<h3>Sailing home</h3>
<p>Talk to Wick on the trip island when you're done. He checks you're ready before you go; pick "Not yet" to stay.</p>
`},

{ id:'tripislands', group:'away', title:'Trip island types', html:`
<h3>Themed islands</h3>
<p>Odds never change on themed islands: the look, time of day, season and number of spots do.</p>
<table class="t"><tr><th>Island</th><th>What's special</th></tr>
<tr><td>Orchard Isle</td><td>Fruit trees of every kind; Heartwood Acorns</td></tr>
<tr><td>Bloom Isle</td><td>24 clumps of every wildflower, never winter</td></tr>
<tr><td>Frost Isle</td><td>Always winter; Frostpine Cones</td></tr>
<tr><td>Moonlit Isle</td><td>Night; Moonsap Vials</td></tr>
<tr><td>Coral Atoll</td><td>Lots of beach finds, 15 to 20 coral fragments; Living Coral Crown</td></tr>
<tr><td>Fossil Bluffs</td><td>36 dig spots; Amber Slivers</td></tr>
<tr><td>Shipwreck Cove</td><td>More bottles, sailcloth on the beach; Sunken Ley Stones and chart pieces</td></tr>
<tr><td>Castaway Isle</td><td>An islander camping who can follow you home</td></tr></table>
<h3>Weird layouts</h3>
<p>About 70% of quiet and town islands get an odd shape: River Maze, Dune Isle (all sand), The Scattered Isles, Ring Island, Mesa Isle, Crater Isle, Mossmire or Thicket Isle.</p>
<h3>Surprises on quiet islands</h3>
<ul><li><b>Treasure map in a bottle</b>: the X is a real spot on that island with a landmark clue. Dig it for a chest.</li>
<li><b>Letter in a bottle</b>: the writer becomes a pen pal.</li>
<li><b>Cave behind a waterfall</b> with a chest.</li>
<li><b>Low-tide islet</b>: walkable 12 minutes of every half hour.</li>
<li><b>Half-sunken temple</b> with a fossil in its floor.</li>
<li><b>Giant tortoise</b> asleep on the beach: climb its shell and dig.</li>
<li><b>Mushroom ring</b>: stand in it at night for Glimmer Moss.</li>
<li><b>Hot spring</b>: soak for 5 faster bites.</li></ul>
<h3>Small towns</h3>
<table class="t"><tr><th>Town</th><th>What to do</th></tr>
<tr><td>Fishing Hamlet</td><td>The old angler pays triple for one fish</td></tr>
<tr><td>Hilltop Abbey</td><td>Trade 5 fruit for 5 seeds your island doesn't grow</td></tr>
<tr><td>Circus Camp</td><td>A 300-clam cup game that wins boat tickets</td></tr>
<tr><td>Lighthouse Point</td><td>Tap Climb up at the door to climb the stairs to the top. Walk round the rail for the view. The keeper waits up there and gives you a Lighthouse Lantern once per visit. Tap Head down to leave.</td></tr>
<tr><td>Smugglers' Cove</td><td>Favor-only and rare pieces at twice the price</td></tr>
<tr><td>Noticeboard Village</td><td>Three small favors, a ticket each</td></tr></table>
<p>Townsfolk are made fresh for each town and go into your contacts as pen pals.</p>
`},

{ id:'special', group:'away', title:'Rare and legendary islands', html:`
<p>Pure luck on a 2,000-clam trip (1.5% rare, 0.5% legendary). There is no cap on what you gather; how much you can carry home is the limit. Clamstone Isle's rocks and Golden Grove's trees each pay once, and Stardrift Isle's star shower drops a star every 10 to 14 seconds and ends after 100 falling stars (on top of the 22 lying about when you land), about 20 minutes of falling.</p>
<table class="t"><tr><th>Island</th><th>Tier</th><th>What happens</th></tr>
<tr><td>Clamstone Isle</td><td>Rare</td><td>Every rock pays clams</td></tr>
<tr><td>Golden Grove</td><td>Rare</td><td>Golden sap from every shake, heartwood from every first chop</td></tr>
<tr><td>The Wizard's Garden</td><td>Rare</td><td>Bellamy, Wendell's old teacher, gives a 50,000-clam spell voucher</td></tr>
<tr><td>The Plan Library</td><td>Rare</td><td>Pick any plan you don't know</td></tr>
<tr><td>The Wishing Workshop</td><td>Legendary</td><td>Bring 10 wood, get any furniture at all</td></tr>
<tr><td>Stardrift Isle</td><td>Legendary</td><td>Always night; starstones lying around and falling</td></tr>
<tr><td>The Collector's Attic</td><td>Legendary</td><td>Any museum specimen you're missing</td></tr>
<tr><td>Shimmer Lagoon</td><td>Legendary</td><td>Only very rare and legendary fish</td></tr></table>
`},

{ id:'fennick', group:'away', title:'Fennick\'s cart', html:`
<p>Fennick is a traveling frog merchant. He only comes once Otis's beacon favor lights the beacon on the Portal Station (3 iron, 10 wood). After that he arrives through the portal every 3 or 4 days and pushes his cart around the island.</p>
<p>He carries rare goods you can't get elsewhere: beach umbrellas, campfires, wind chimes, telescopes, the Golden Birdcage, now and then a rare woodworking plan (45,000), and about 1 day in 3 a bolt of <b>Sailcloth</b> for Barley's mill.</p>
<p>About 1 visit in 20 he also has an <b>Enchanting Scroll</b> for one of Wendell's enchantments you don't know yet, at 60% of Wendell's fee (for example 60,000 for Luckiest). It teaches you the enchantment straight away, without Wendell's conditions. Guests don't get them.</p>
`},

{ id:'penpals', group:'away', title:'Pen pals and letters', html:`
<p>Everyone you talk to goes into your contacts: islanders, shopkeepers, helpers, trip townsfolk, people from bottles, and real friends. Open them from the town hall, the desk in the Portal Station, or Menu &gt; Pen pals.</p>
<ul><li>Letters are preset templates, one a day per person, with an optional gift.</li>
<li>Replies come the next day, sometimes with a gift. Good pen pals write first now and then.</li>
<li>A pen pal from another island at friendship 8+ who has answered at least 2 letters can be <b>invited to move in</b> (needs the Town Hall and fewer than 10 islanders). They arrive the next day.</li>
<li>Letters to real friends go through the mail (Friends &gt; Mail).</li></ul>
<p>Pen pals in trip towns are also the start of Wren's trade routes.</p>
`},

{ id:'portal', group:'away', title:'The Portal Station and friends', html:`
<p>Every island has a Portal Station near the plaza: a stone platform with an arch over stairs. "Go down" leads to the portal hall.</p>
<ul><li><b>Portal arches</b>: one per friend's island (up to 5; more opens the Friends list). Step in to travel. A dark arch means no visits left.</li>
<li><b>Home portal</b> while you're visiting.</li>
<li><b>Invite booth</b>: opens the Friends tab, to invite a friend over or make an invite link.</li>
<li><b>Pen pal desk</b>.</li></ul>
<h3>Friends</h3>
<p>New friends only come through invite links (one use, one person, 14 days). There's no search and no stranger contact.</p>
<p>Once you're friends, either of you can invite the other over without a new link: Friends tab, <b>Invite a friend over</b>. It lists friends who can't visit you right now (they only ever invited you, or their one visit was used). Tap Invite and they get a letter in their mailbox saying they can come. Whether by link or from the list, you choose one visit or any time, and a role:</p>
<table class="t"><tr><th>Role</th><th>Can</th></tr>
<tr><td>Visitor</td><td>Look around, pick fruit, dig fossils, collect beach finds, shop. Their picks come from their own copy of the day, so they never use up yours. Can't chop, plant, place, donate, invest or build.</td></tr>
<tr><td>Resident</td><td>Everything the owner can except building their own house. Changes sync live.</td></tr></table>
<p>Owners can switch a friend's role or remove them. When you're on an island together you see each other live with name tags.</p>
<h3>With friends</h3>
<ul><li>Ten preset reactions (Hi!, Yay!, Haha! and so on). No free text.</li>
<li>Mail an item, hand one over in person, or trade items (both tap Ready). Clams can never move between players.</li>
<li>Swing a tool at a friend and they flop over like a jelly toy. Harmless.</li></ul>
`},

{ id:'party', group:'away', title:'Party games', html:`
<p>Start one from Menu &gt; Party games or Friends &gt; Here now. A ring pops up on the flattest spot nearby, and up to 4 players can join.</p>
<table class="t"><tr><th>Game</th><th>How to win</th></tr>
<tr><td>Bonk Ball (3 min, first to 5)</td><td>Whack a beach ball into someone else's goal. The axe hits hardest, the shovel scoops it high. A fast ball knocks people over.</td></tr>
<tr><td>Crown Keeper (2:30, first to 30)</td><td>Stand alone in the glowing ring for a point a second. Two or more in it: nobody scores. Bonk rivals out. The ring moves every 16 seconds.</td></tr></table>
<p>Prizes need 2+ players: the winner gets a <b>Bonk Ball Cup</b> or <b>Crown Keeper Cup</b> (never in shops) and 500 clams, everyone else 200.</p>
`},

/* ============================== MONEY ============================== */
{ id:'income', group:'money', title:'Passive income', html:`
<p>Four characters turn up once you've progressed. Fund them and they work while you're away. Each fills over <b>3 days</b> and then waits for you to collect. Upgrades are offered after a tier has run a week.</p>
<table class="t"><tr><th>Who</th><th>Appears when</th><th>Tiers (cost, per day)</th></tr>
<tr><td>Gill the fisherman, on a beach</td><td>Town Hall built and 40 fish caught (part of the reef story).</td><td>Dinghy 25,000; Trawler 125,000 + 40 planks; Driftwood Queen 300,000 + 60 planks + 10 iron fittings. Catch scales with the reef.</td></tr>
<tr><td>Hollis the beekeeper, in a meadow</td><td>Town Hall and 5 planted flowers (or 45 things discovered)</td><td>Beehive 13,000 (2 honey); Three Hives 35,000 (5); Apiary 60,000 (9); Grand Apiary 185,000 (14) after his story</td></tr>
<tr><td>Russet the orchard keeper</td><td>Town Hall, 10 days on the island, a fruit tree</td><td>Fruit Ladder 14,000 (4 fruit); Pony Cart 30,000 (8); Cider Shed 50,000 (14)</td></tr>
<tr><td>Quill the bookkeeper, by the general store</td><td>One shop backed</td><td>Ledger 24,000 (800 clams per shop backed); Counting House 60,000 (2,000); Trading Office 135,000 (4,500)</td></tr></table>
<p>Keepers turn up one at a time: at least 3 days after anyone new arrived (an islander or another keeper), and never while someone is about to move in. If two are ready, the second waits.</p>
<p>Every tier, here and in the thank-you stakes, costs about a month of what it brings in, so each one pays for itself in roughly 30 days. More flowers near Hollis's hives give a little more honey. Hollis, Russet and Quill offer to move their spot for free after you fund or upgrade them.</p>
`},

{ id:'stakes', group:'money', title:'Thank-you stakes', html:`
<p>Every island-story business offers you a share once it's running, as a thanks. Like passive income, a stake fills over 3 days, pays clams plus a little of what the business makes, and has 3 tiers (upgrade after a week). If the keeper moves away and sells the business, your stake carries over.</p>
<table class="t"><tr><th>Business</th><th>Offered when</th><th>Tiers (cost / clams a day)</th><th>Extra</th></tr>
<tr><td>Bramble's Workshop</td><td>Open a week, 100 planks made</td><td>30k / 900, 85k / 2,200, 170k / 4,800</td><td>Planks</td></tr>
<tr><td>Pemberton's Forge</td><td>After 10 fittings</td><td>30k / 900, 120k / 2,200, 225k / 4,800</td><td>Iron fittings</td></tr>
<tr><td>Mabel's Tea Room</td><td>Open a week, 30 sales</td><td>25k / 800, 100k / 2,000, 195k / 4,500</td><td>Tea cakes</td></tr>
<tr><td>Wick's night voyages</td><td>After your first night voyage</td><td>25k / 800, 65k / 2,000, 145k / 4,500</td><td>A Moonlit ticket now and then</td></tr>
<tr><td>Barley's Mill</td><td>Water wheel built</td><td>25k / 800, 75k / 2,000, 160k / 4,500</td><td>Flour</td></tr>
<tr><td>Wren's Post Office</td><td>3 routes at level 2</td><td>25k / 800, 75k / 2,000, 160k / 4,500</td><td>Foreign seeds</td></tr>
<tr><td>Tobin's Bathhouse</td><td>Steam room built</td><td>25k / 800, 80k / 2,000, 160k / 4,500</td><td>Bath salts</td></tr>
<tr><td>Hazel's Antiques</td><td>Shop open</td><td>25k / 800, 70k / 2,000, 155k / 4,500</td><td>Salvage now and then</td></tr></table>
`},

/* ============================== STORIES ============================== */
{ id:'stories', group:'stories', title:'How island stories work', html:`
<p>Every resident and keeper has a dream, every dream needs help from someone else, and every finished dream makes something another dream needs. Planks from the workshop build boats and the lighthouse; fittings from the forge finish the diving bell; honey feeds the tea room, and so on.</p>
<ul><li>A dream <b>opens</b> when its hidden conditions are met, then the holder brings it up 1 to 3 days later, the first time you talk that day.</li>
<li>Other islanders <b>gossip</b> about how stories are going. That's where most hints come from.</li>
<li>The Island Board's <b>Island stories</b> page has one line per open dream, no checklists.</li>
<li><b>Helpers</b>: islanders at friendship 10+ can be asked "Want to help with something?" for a boost (+1 coral starter a day, +10 planks a day) and +1 friendship a week.</li>
<li>If a dream's holder moves away, another islander takes it over. A keeper who moves away <b>sells the business</b> to the next islander; your stake stays.</li></ul>
<h3>Rough order</h3>
${steps(['The Reef (Gill, Sprig, Marlo) and Bramble\'s workshop dream start early.',
 'Clover Meadow rises: Hollis\'s apiary, then Mabel\'s tea room, and Barley\'s mill.',
 'Sandpiper Dunes: Hazel\'s shipwreck.',
 'Old Pinewood: Bramble\'s workshop is built. Planks unlock most of what follows.',
 'Lantern Bluff: the lighthouse and night voyages.',
 'Hollow Crags (needs the reef at Teeming): Pemberton\'s forge, which finishes the Driftwood Queen and the wreck\'s hold.',
 'Reef Thriving: Thistle\'s Reef Hall.',
 'Alongside: Wren\'s trade routes, Tobin\'s bathhouse and Lumi\'s firefly glade.',
 'Small threads once the town hall is up: Juniper\'s reading nook, Otis\'s race course, Marigold\'s flower show and a newcomer who wants to meet people.',
 'The Island Charter, then the Driftwood Festival every season.',
 'Last of all: Starfall Isle.'])}
`},

{ id:'reef', group:'stories', title:'The Reef and Cay Bay', html:`
<p><b>Who:</b> Gill, Sprig, Marlo. <b>Starts:</b> Gill is on his beach once the Town Hall is built and you've caught 40 fish.</p>
${steps([
 'Gill tells you the reef off the cays died and took the fish with it. He wonders if Sprig could grow coral.',
 'Sprig asks for <b>3 coral fragments</b>. Fragments wash up on beaches from day 1 (brain, staghorn, sea fan, table; table is rarer). More on Sandpiper Dunes, and 15 to 20 on a Coral Atoll trip.',
 'Marlo builds a nursery tank beside Sprig\'s shop: <b>20,000 clams, 10 stone, 4 iron</b>. Ready the next day.',
 'At the nursery: <b>2 fragments of one kind + 300 clams = 1 coral starter</b>, ready tomorrow. 3 a day, 4/5/7 as you invest in Sprig, +1 with a helper.',
 'Gill lends you his old rowboat at the dock. "Row out" takes you to <b>Cay Bay</b>.',
 'Row with the joystick or WASD. Over old rubble, <b>Drop</b> a starter. Anywhere else, <b>Cast</b>. Row to the buoy to go home.'])}
<h3>Reef stages</h3>
<p>Coral grows over 2 days (sprig, small, full). Fish only arrive between visits. Score = full-grown coral + 5 for each coral kind with 5 or more grown.</p>
<table class="t"><tr><th>Stage</th><th>Score</th><th>What changes</th></tr>
<tr><td>Barren</td><td>0</td><td>Grey rubble</td></tr><tr><td>First Fins</td><td>6</td><td>A few fish shadows</td></tr>
<tr><td>Stirring</td><td>15</td><td>Small schools. Gill offers the Dinghy (25,000)</td></tr>
<tr><td>Schooling</td><td>30</td><td>Schools at each patch; bay fish in Gill's crate; night fish if the lighthouse is lit</td></tr>
<tr><td>Teeming</td><td>50</td><td>Big shadows, a sea turtle. Trawler (125,000 + 40 planks). Needed for Hollow Crags</td></tr>
<tr><td>Thriving</td><td>75</td><td>Rays. 24 outer reef plots open. Thistle's Reef Hall dream</td></tr>
<tr><td>Restored</td><td>100, every kind 15+</td><td>Dolphins. Driftwood Queen (300,000 + 60 planks + 10 fittings)</td></tr></table>
<p>The bay has 72 plots in 6 patches, so Restored needs the outer reef.</p>
<h3>Bay fish</h3>
<p>Each coral kind brings two species once 5 of that kind have grown: brain (Sunset Wrasse, Coral Grouper), staghorn (Lantern Goby, Bannerfin), sea fan (Fan Blenny, Velvet Ray), table (Reef Parrotfish, Gilded Seahorse). The first of each you catch, Gill buys at 3x. Two night fish (Moonlight Cardinalfish, Flashlight Fish) come once the lighthouse is lit and the reef is Schooling.</p>
<p>Six bigger reef fish come back as the whole reef grows, whatever coral you planted: Picasso Triggerfish and Mandarin Dragonet at Stirring, Spiny Lobster and Pinecone Fish at Schooling, the Leafy Seadragon at Teeming, and the Whale Shark (May to August) once the reef is Restored. Gill counts them as bay fish, so the first of each is worth 3x to him too, and he can tip you about them.</p>
${tip('Plant a mix. Table coral is the bottleneck and its fish include the 30,000-clam Gilded Seahorse.')}
`},

{ id:'workshop', group:'stories', title:'Bramble\'s Workshop', html:`
<p><b>Who:</b> Bramble, Wendell, Clementine. <b>Starts:</b> after you've made 14 different woodworking pieces.</p>
${steps([
 'Bramble admits he always wanted a real workshop, but there are hardly any pines. Next he wonders if Wendell could help.',
 'Wendell raises <b>Old Pinewood</b> (needs Grand Town Hall, Pemberton backed, 3 relics, 180,000 + 60 wood + 20 stone). Pines there grow back overnight and Mossby doesn\'t mind.',
 'Clementine runs the build: <b>120,000 + 80 wood, 20 stone, 6 iron</b>. Opens the next day.',
 'Bramble saws <b>4 wood into 1 plank</b> overnight, up to 20 a day (30 with a helper).'])}
<h3>Commissions</h3>
<table class="t"><tr><th>Piece</th><th>Cost</th><th>Time</th></tr>
<tr><td>Four-Poster Bed</td><td>24 planks + 6,000</td><td>2 days</td></tr><tr><td>Boat Bookcase</td><td>16 planks + 4,000</td><td>1 day</td></tr>
<tr><td>Long Table</td><td>20 planks + 3,500</td><td>1 day</td></tr>
<tr><td>Lamp Frame (lighthouse)</td><td>20 planks + 4 iron</td><td></td></tr>
<tr><td>Windmill Sails (mill)</td><td>15 planks + 3 sailcloth</td><td>overnight</td></tr>
<tr><td>Diving Bell Frame (wreck)</td><td>25 planks</td><td></td></tr></table>
<p>Stake once it's been open a week and made 100 planks. Lantern Bluff waits on the workshop.</p>
`},

{ id:'apiary', group:'stories', title:'Hollis\'s Apiary and Mabel\'s Tea Room', html:`
<h3>The apiary</h3>
<p><b>Starts:</b> once Clover Meadow rises (and you've funded Hollis). Hollis says the bees are restless and want variety.</p>
${steps(['Get flowers of <b>6 different color families</b> in bloom within 16 m of the hives (white, red, pink, orange, yellow, blue, purple, green).',
 'Honey output doubles and the fourth tier opens: <b>Grand Apiary</b> (185,000, 14 honey a day).'])}
<h3>The tea room</h3>
<p><b>Starts:</b> the day after the apiary is happy and Russet's orchard is funded. Mabel (or whoever holds her dream) wants a tea room.</p>
${steps(['Clementine runs the project: <b>150,000 + 40 planks + 20 stone</b>. Opens the next morning near the plaza.',
 'Mabel buys fruit, vegetables, herbs, berries and honey at <b>1.5x</b>, and later flour.',
 'Islanders take tea on the terrace from 10 to 6. "Share a pot of tea" with one is +1 friendship once a day.'])}
<p>Stake after a week and 30 sales (paid with Honey Tea Cakes).</p>
`},

{ id:'lighthouse', group:'stories', title:'The Lighthouse and night voyages', html:`
<p><b>Starts:</b> the first time you talk to Skipper Wick after Lantern Bluff rises.</p>
${steps(['Marlo grinds a lens: <b>10,000</b>, waiting up the bluff the next day.',
 'Bramble makes a <b>lamp frame</b> (workshop commission: 20 planks + 4 iron).',
 'Bring <b>3 moonpearls</b> (rare: now and then with a catch, or washed up on the beach).',
 'Climb to the lamp room at the top of the lighthouse and fit the lamp there. The beam turns at night.'])}
<p>Payoff: two night fish in Cay Bay (once Schooling), Wick's weekly night voyage to a Moonlit isle (8,000), and a stake after your first voyage.</p>
<h3>Inside the lighthouse</h3>
<p>The old lighthouse is a tall striped tower on top of the bluff. Its red and white paint stays faded until the lamp is lit, then it gets a fresh coat. Tap Go in at the tower to walk inside. On the ground floor you can walk about, read the old keeper's logbook pages and tap Climb the stair. The stair winds round the inside wall all the way up to the lamp room and the gallery. At the top, walk round the gallery for the view, look round the lamp room, or tap Head down. Tap Go outside, or walk out through the door, to leave.</p>
<p>The tower is in a bad way to begin with, and it gets mended as the story moves on:</p>
<table><tr><th>When</th><th>What you see</th></tr>
<tr><td>Before the lens</td><td>Treads missing or snapped on the stair (you hop the gaps and keep to the wall), a fallen beam across the floor, puddles, cobwebs, peeling paint and rust, boarded windows, gulls' nests, logbook pages on the floor, and an empty lamp room with cracked glass.</td></tr>
<tr><td>Marlo's lens is up</td><td>Fresh planks over the gaps in the stair, rope across the gaps in the rail, and the lens waiting in its crate up top.</td></tr>
<tr><td>The lamp frame is made or being made</td><td>New treads all the way up, the boards off the windows, new glass in the lamp room, the fallen beam gone and fresh plaster on the walls.</td></tr>
<tr><td>Lit</td><td>Fresh paint inside and out, a brass rail, lamps on the walls, the keeper's logbook back on its desk and the lamp turning.</td></tr></table>
${note('The tower stands on a bigger stone base than the old one. Anything you had left right next to the old tower is moved just outside the new base the first time you go near it.')}
`},

{ id:'forge', group:'stories', title:'Pemberton\'s Forge', html:`
<p><b>Starts:</b> once Hollow Crags is up. Pemberton is tired of shipping in nails.</p>
${steps(['Find an <b>apprentice</b>: any islander at friendship 10+.',
 'Pay <b>200,000 + 30 iron + 30 stone + 20 planks</b>. Built on the crags overnight.',
 'The forge turns <b>5 iron into 1 iron fitting</b> overnight, up to 10 a day.'])}
<p>It also makes iron furniture while you wait: Iron Lantern, Iron Gate, Weathervane, and the <b>Crowbar</b> for Hazel's wreck (3 iron + 1,500). Fittings finish the Driftwood Queen, the Reef Hall tank, the diving bell and the bathhouse pipes. Stake after 10 fittings.</p>
`},

{ id:'reefhall', group:'stories', title:'Thistle\'s Reef Hall', html:`
<p><b>Starts:</b> when the reef reaches Thriving. Thistle dreams of a living exhibit.</p>
${steps(['Marlo builds the giant tank: <b>100,000 + 10 iron fittings</b>, overnight.',
 'Take <b>10 coral cuttings</b> in Cay Bay ("Take cutting" when you row up to grown coral; that coral drops back a day and regrows).',
 'Donate <b>every bay fish</b> to the museum.'])}
<p>The next day a round glass hall opens beside the museum with a glass tunnel through a reef. Thistle gives you a <b>Reef Tank</b> for your home. No stake.</p>
`},

{ id:'mill', group:'stories', title:'Barley\'s Mill', html:`
<p><b>Starts:</b> a day or three after Clover Meadow rises. Barley wants the old windmill working.</p>
${steps(['<b>Sails</b>: workshop commission, 15 planks + 3 sailcloth, overnight. Sailcloth: Fennick about 1 day in 3, or 1 to 2 on a Shipwreck Cove beach. Fit them at the windmill.',
 '<b>Millstone</b>: Thistle trades it for <b>3 fossils the museum doesn\'t have yet</b> (3 rare bugs or fish if every fossil is in). Arrives overnight.',
 'Sprig starts selling <b>wheat seeds</b>. The mill grinds 2 wheat into 1 flour overnight, up to 10 a day.',
 'Wendell wakes a stream beside it for <b>15,000</b>. The water wheel doubles it to 20 a day.'])}
<p>Pemberton sells Country Loaf after the first flour, and Mabel buys flour. Stake once the wheel turns.</p>
`},

{ id:'post', group:'stories', title:'Wren\'s Trade Routes', html:`
<p><b>Starts:</b> once the Town Hall is up and you have a pen pal in one of the trip towns. Wren wants a post office.</p>
${steps(['Clementine\'s project: <b>80,000 + 30 planks + 10 stone</b>. Opens near the plaza the next day.',
 'Every trip town with a pen pal at friendship 5+ becomes a <b>route</b>.',
 'Pack one crate per route every 7 days. Wick sails it overnight and the route levels up (max 5).'])}
<table class="t"><tr><th>Town</th><th>Wants</th><th>Keepsake</th></tr>
<tr><td>Fishing Hamlet</td><td>Planks</td><td>Fish Drying Rack</td></tr><tr><td>Abbey</td><td>Honey</td><td>Abbey Hand Bell</td></tr>
<tr><td>Circus Camp</td><td>Fruit</td><td>Circus Drum</td></tr><tr><td>Lighthouse Point</td><td>Iron fittings</td><td>Little Lighthouse</td></tr>
<tr><td>Smugglers' Cove</td><td>Bath salts or iron</td><td>Smuggler's Lamp</td></tr><tr><td>Noticeboard Village</td><td>Letters from your islanders</td><td>Village Noticeboard</td></tr></table>
<p>Each delivery gets a letter back with 3 foreign seeds (corn, chili or melon), or the town's keepsake at levels 3 and 5. The amount wanted grows with the level. Stake once 3 routes reach level 2.</p>
`},

{ id:'bathhouse', group:'stories', title:'Tobin\'s Bathhouse', html:`
<p><b>Starts:</b> once the Town Hall and wizard tower are up. Tobin's gran swore there was warm water under the island.</p>
${steps(['Give Wendell <b>3 Diviner\'s Elixirs</b>. Five patches of steaming ground appear. Dig them: only one is real.',
 'Marlo pipes it: <b>15,000 + 6 iron fittings</b>. The pool fills overnight.',
 'Clementine\'s project: <b>100,000 + 60 planks + 20 stone</b>.',
 'Sprig mixes <b>bath salts</b> (2 flowers + 1 weeds a jar). Stock the lounge with 10 (needs the tea room). Islanders soak from 6 to 10pm.',
 'Upgrades: steam room (40,000 + 20 stone + 10 planks), then rock pools (80,000 + 30 stone).'])}
<p>A soak once a day makes you <b>Well rested</b>: the first chat with each islander that day is +2 friendship. Stake once the steam room is built.</p>
`},

{ id:'glade', group:'stories', title:'Lumi\'s Firefly Glade', html:`
<p><b>Starts:</b> once the Town Hall is up and 8 bugs are donated. Lumi picks a ring of old stones past the plaza.</p>
<p>Four conditions, all within 11 m of the glade, checked each night:</p>
<ul><li><b>Dark</b>: no street lamps within 16 m (ask Clementine to switch them off).</li>
<li><b>Still water</b>: pond squares you shaped with Wendell, or the island pond.</li>
<li><b>Night flowers</b>: Moonflower and Evening Primrose (Sprig sells the seeds once Lumi asks).</li>
<li><b>Old logs</b>: stumps Mossby approves. Knock on one near the glade. Dig up an approved one and he's cross for 3 days.</li></ul>
<table class="t"><tr><th>Conditions</th><th>Result</th></tr><tr><td>2</td><td>A faint glow</td></tr>
<tr><td>All 4</td><td>A swarm. Lumi gives you a Glow Jar (Sprig sells more)</td></tr><tr><td>All 4 strong</td><td>New night bugs</td></tr></table>
<p>Glade bugs (night only, near the glade, March to November): Glade Firefly from the start, Blue Spark with plenty of water, Moss Glowmoth with plenty of logs, Starlantern Beetle when everything is strong. No stake.</p>
`},

{ id:'wreck', group:'stories', title:'Hazel\'s Shipwreck', html:`
<p><b>Starts:</b> a day or three after Sandpiper Dunes rises. Hazel finds a page from a captain's logbook.</p>
${steps(['<b>Diving bell</b>: Marlo\'s glass (20,000, on the sand the next day), a frame from the workshop (25 planks), and 6 iron fittings. Put it together at the wreck.',
 '<b>Deck</b>: open straight away.',
 '<b>Hold</b>: needs Pemberton\'s crowbar (3 iron + 1,500, needs the forge).',
 '<b>Cabin</b>: needs Marlo\'s lantern lens (8,000, ready the next day).',
 '<b>Vault</b>: needs 4 treasure chart pieces. They wash up on trip beaches once the cabin is open (50% on Shipwreck Cove, 15% on a themed island, 6% on a plain one).'])}
<p>Each part holds two pieces of salvage furniture and pages of the <i>Saltwren</i>'s logbook (12 in all; reread them with Hazel or at the wreck). The day after the vault opens, <b>Hazel's Antiques</b> opens near the museum with three pieces of salvage a day, and offers a stake.</p>
`},

{ id:'nook', group:'stories', title:'Juniper\'s Reading Nook', html:`
<p><b>Starts:</b> once the town hall is up and Bramble's workshop is open, a day or three later. Juniper (or whoever holds the dream) wants a reading nook beside the museum.</p>
${steps(['<b>Rare plans</b>: know 3 of the 6 rare plans, the ones for the legendary showpieces (see <a href="#crafting">Woodworking</a>). Juniper brings it up again the next time you talk once you do.',
 '<b>Shelves</b>: commission the Reading Nook Shelves at the workshop (20 planks, 5 clay, 15,000; ready the next day).',
 '<b>Build</b>: give Juniper the shelves. The builders work overnight and the reading room opens the next morning.'])}
<p>Inside you can reread every island story, every letter you kept, and the <i>Saltwren</i>'s logbook pages you've found.</p>
`},

{ id:'race', group:'stories', title:'Otis\'s Race Course', html:`
<p><b>Starts:</b> with the town hall up, a bike, 3 of Wendell's isles risen and the workshop open. Otis (or whoever holds the dream) wants a bike race right round the island.</p>
${steps(['<b>Sign</b>: commission the Race Course Sign at the workshop (10 planks, 2 iron, 8,000; ready the next day).',
 '<b>Course</b>: give Otis the sign and the start arch goes up near the plaza.',
 '<b>Race</b>: start at the arch on your bike. Ride through 7 flags in order (the next one lights up) and back through the arch.'])}
<p>Every islander has a time to beat, set by their personality and the length of your island's course. Sporty islanders are fastest, lazy ones slowest. Getting off the bike, going inside or taking over 6 minutes ends the race. Beat everyone once for <b>5,000 clams</b> and the Island Race Cup. Your best time is kept.</p>
`},

{ id:'flowershow', group:'stories', title:'Marigold\'s Flower Show', html:`
<p><b>Starts:</b> with the town hall up and the garden shop backed. Marigold (or whoever holds the dream) sets their heart on one rare flower color, picked for your island: a purple tulip, black rose, red pansy, orange cosmos, pink hyacinth, orange lily, yellow rose or white tulip.</p>
${steps(['<b>Grow it</b>: plant that flower until a seed comes up in that color. Wild flowers don\'t count.',
 '<b>Enter</b>: tell Marigold once it blooms. The show is two days later, on a table by the plaza.',
 '<b>Win</b>: it takes first prize the next day, and Marigold gives you the Flower Show Rosette.'])}
<h3>The spring show</h3>
<p>After that, a show is held every year on the first Saturday of April. Enter your whole garden at the table: the judges count every different flower and color you planted that is blooming that day. You get 1,500 clams per kind, up to 40,000. 12 or more kinds is first prize (and a rosette if you don't have one), 6 or more second, fewer third. Once a year.</p>
`},

{ id:'newcomer', group:'stories', title:'The newcomer', html:`
<p><b>Starts:</b> with the town hall up, a day or three after someone new moves in who isn't one of your first islanders and doesn't already hold a dream. They don't know anyone yet.</p>
${steps(['Talk to them and pick <b>Come and meet people</b>. They follow you for the rest of the day (until bedtime). "Wait here for now" stops them.',
 'Walk up to another islander with them close by and pick <b>Meet</b>. Each introduction gives +1 friendship to both.',
 'After 4 introductions they settle in.'])}
<p>Once they have, they can help on island projects straight away, without the usual friendship 10.</p>
`},

{ id:'charter', group:'stories', title:'The Island Charter and the Driftwood Festival', html:`
<p><b>Starts:</b> Clementine brings it up ("You look pleased with yourself") once all of these are in place: Gill's Trawler, the workshop on Old Pinewood, the tea room, the lighthouse lit, the forge and 10 islanders. Before that, ask her "What's next for the town?" and she says what's still missing.</p>
<p><b>Cost:</b> 500,000 clams (chip in at the town projects, any amount), 50 planks, 20 iron fittings and 10 honey. Sign it, the whole town signs overnight, and the next day it's official.</p>
<ul><li>The hall becomes the <b>Charter Hall</b>, with flags and bunting at the door. Ask Clementine about the charter for a brass copy to hang up.</li>
<li>The day after, Wendell writes his last letter. That opens Starfall Isle (see <a href="#isles">Wendell's isles</a>).</li></ul>
<h3>The Driftwood Festival</h3>
<p>The first one is two days after the charter. After that it's the first Saturday and Sunday of March, June, September and December, 9 in the morning to 9 at night. Up to six islanders run stalls around the plaza, a different few each day. Each stall sells two festival things that suit its owner (candy apples, hand pies, pinwheels, fish kites, paper star lanterns, bunting).</p>
<p>Visit every stall on a festival day and Clementine gives you that season's keepsake: a Blossom Festival Lantern, Summer Festival Drum, Harvest Festival Wreath or Winter Festival Snow Globe.</p>
`},

/* ============================== CATALOG (live) ============================== */
{ id:'fish', group:'catalog', title:'Fish', data:'fish', html:`<p>Sea fish are caught from the beach, river fish in the river, pond fish in ponds, and bay fish only in Cay Bay. A fish's shadow shows its size. Hours are 24-hour. Sell to Marlo for more. Marlo and Gill can tell you what's biting today (see Shops and investing).</p>
<h3>Isle and trip fish</h3>
<p>Some fish live only in the sea right around one of Wendell's isles: stand on or near that isle and cast into the sea. Clover Meadow has the Red-lipped Batfish, Sandpiper Dunes the Spotted Moray and Stargazer, Old Pinewood the Ghost Ratfish, Lantern Bluff the Lumpsucker and Wolffish, and Hollow Crags the Hollow Blindfish and the Coelacanth. Others turn up only on certain boat trips: Castaway Isle (Four-eyed Fish, any water), Coral Atoll (Unicornfish and Humphead Wrasse, sea), Frost Isle (Icefish, any water), Fossil Bluffs (Dragon Bichir, any water), Moonlit Isle (Viperfish and Gulper Eel, sea) and Shipwreck Cove (Barreleye, sea). Marlo's tips only cover your home waters, so he won't tip you about these.</p>
<p>Cay Bay also has six bigger reef fish that come back as the reef grows (see The Reef and Cay Bay).</p>` },
{ id:'bugs', group:'catalog', title:'Bugs', data:'bugs', html:`<p>At most 3 bugs are out at once. Sell to Sprig for more.</p>
<h3>Isle, Starfall and trip bugs</h3>
<p>Isle bugs only come out while you're on or right by their isle, and they always land on it. Clover Meadow: Spittlebug (flowers) and Cuckoo Wasp (flying). Old Pinewood: Longhorn Beetle and Moss Katydid (tree trunks). Sandpiper Dunes: Antlion (ground) and Mole Crab (beach). Lantern Bluff: Garden Tiger Moth (flying) and Lanternfly (tree trunks). Hollow Crags: Cave Cricket and Rock Scorpion (ground) and the Atlas Beetle (tree trunks). Starfall Isle adds the Star Plume Moth and the Ribbontail Moth to its sky bugs.</p>
<p>Trip bugs: Orchard Isle (Shield Bug), Bloom Isle (Bee Fly), Castaway Isle (Giraffe Weevil, Atlas Moth, Golden Birdwing), Fossil Bluffs (Scorpionfly), Moonlit Isle (Moonlit Glow-worm) and Frost Isle (Ice Crawler).</p>` },
{ id:'fossils', group:'catalog', title:'Fossils and beach finds', data:'dig', html:`<p>Dig cracks with a shovel for fossils. There are 80 kinds. A fossil you have never found is twice as likely to turn up as one you have, so the last few come sooner. That doesn't apply to the very rare and legendary ones, which keep their own odds. Beach finds wash up daily. Very rare finds come up about 0.4% of the time as a group, legendary about 1 in 5,000.</p>` },
{ id:'fruit', group:'catalog', title:'Fruit, flowers and plants', data:'plants', html:`<p>Your island has one native fruit (100). Every other fruit sells for 250.</p>` },
{ id:'materials', group:'catalog', title:'Materials and special items', data:'materials', html:`` },
{ id:'furniture', group:'catalog', title:'Furniture', data:'furniture', html:`<p>Shop furniture sells for a quarter of its buy price. Pieces you make sell for about what went into them (see Woodworking). "Where" shows where a piece comes from.</p>` },
{ id:'clothes', group:'catalog', title:'Clothes', data:'clothes', html:`` },
{ id:'achievements', group:'catalog', title:'Achievements', data:'achievements', html:`<p>Hidden in game until you earn them. Spoilers below.</p>` },

/* ============================== DONE ============================== */
{ id:'checklist', group:'done', title:'100% checklist', html:`
<p>There's no credits screen. Here's everything there is to finish:</p>
<ul class="check">
<li>Every fish, bug, fossil and beach find in the museum (including bay and glade species)</li>
<li>All three museum wings and the Reef Hall</li>
<li>Grand Town Hall and 10 islanders</li>
<li>All three shops at tier 3 (Grand Emporium, Grand Aquarium Hall, Botanical Conservatory)</li>
<li>House: pay off every loan; four floors if you like</li>
<li>Every tool at Heirloom tier, the Grand Expedition Pack and the bike</li>
<li>All 6 of Wendell's isles, and both of Wendell's spells at the star altar</li>
<li>The reef Restored and the Driftwood Queen</li>
<li>Every story business: workshop, apiary, tea room, lighthouse, forge, mill, post office with routes at level 5, bathhouse with rock pools, glade at full strength, all 4 wreck layers and the antiques shop</li>
<li>All six legendary woodworking showpieces</li>
<li>The reading room, the race course record, the flower show won, the newcomer settled in</li>
<li>The Island Charter, and all four seasons' festival keepsakes</li>
<li>Every rare custom-furniture part from sketches, and a request finished for every islander</li>
<li>Every enchantment and the Twin Charm</li>
<li>Every passive income and stake at its top tier</li>
<li>Best friends with everyone</li>
<li>Both party game cups</li>
<li>Every rare and legendary island (good luck)</li>
<li>All 160 achievements</li></ul>
`},


];

/* one line per page for the cards on each tab: what the page covers */
export const SUMS = {
  welcome: "What the game is and what to do in your first days",
  controls: "Keys, clicks and touch controls",
  clams: "How money works and where to sell for the best price",
  time: "The clock, days, seasons and weather",
  guest: "Playing as a guest versus with an account",
  house: "Building, extending and decorating your home",
  town: "Clementine, loans and growing the Town Hall",
  farshore: "The wild land round the edge of your island",
  islanders: "Who can move in, gifts and friendship",
  favors: "Errands islanders ask for and the Island Board",
  museum: "Donating to Professor Thistle and the museum wings",
  shops: "Every shop, what it sells and backing shopkeepers",
  tools: "Tool tiers, how long they last, bags and the bike",
  enchanting: "Every enchantment, its cost and what it does",
  garden: "Planting, watering, crops and flowers",
  crafting: "Learning woodworking and every plan",
  tables: "Crafting table tiers and what each adds",
  custom: "Designing your own furniture part by part",
  sewing: "The Sewing Machine, pixel-painted rugs and clothes",
  pets: "Winning over a stray dog or cat, collars, coats and giving pets away",
  cooking: "Learning to cook and every recipe",
  style: "Changing your look and wearing clothes",
  wendell: "How Wendell arrives and what he does in his tower",
  isles: "All six isles, what they need and what they hold",
  relics: "Where to find each relic and what it is for",
  trips: "Skipper Wick's boat trips and how they work",
  tripislands: "Every kind of island a trip can land on",
  special: "The rarest trip islands and what makes them special",
  fennick: "The traveling merchant who comes through the portal",
  penpals: "Writing letters and what pen pals send back",
  portal: "Visiting friends and having them over",
  party: "Games to play with friends, and how to win them",
  income: "Gill, Hollis, Russet and Quill: costs and daily returns",
  stakes: "A share in each island-story business",
  stories: "How dreams open and how stories move along",
  reef: "Growing the reef and Cay Bay, step by step",
  workshop: "Bramble's story and the workshop on Old Pinewood",
  apiary: "Hollis's bees and Mabel's tea room",
  lighthouse: "Lighting the lighthouse and sailing at night",
  forge: "Pemberton's forge on Hollow Crags",
  reefhall: "Marlo's giant tank and Thistle's living exhibit",
  mill: "Getting the old windmill on Clover Meadow working",
  post: "Wren's trade routes",
  bathhouse: "Tobin's bathhouse, step by step",
  glade: "Lumi's ring of stones and what it needs each night",
  wreck: "Hazel's wreck and the diving bell",
  nook: "Juniper's reading nook beside the museum",
  race: "A bike race right round the island",
  flowershow: "Marigold's flower show, step by step",
  newcomer: "Helping a new islander meet people",
  charter: "Signing the charter and the festival",
  fish: "Every fish: where, when, rarity and price",
  bugs: "Every bug: where, when, rarity and price",
  fossils: "Every fossil, shell, coral and beach find",
  fruit: "Fruit, flowers, saplings and wild plants",
  materials: "Wood, stone, iron and every special item",
  furniture: "Every piece of furniture and where to get it",
  clothes: "Every piece of clothing and where to get it",
  achievements: "Every achievement and how to earn it",
  checklist: "Everything there is to finish",
};
