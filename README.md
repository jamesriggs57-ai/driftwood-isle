# Driftwood Isle (online build)

The cozy island game plus everything needed to run it online: guest mode, accounts, cloud saves, friend invites, visits (async and live), mailbox gifts and item trades.

```
client/          the game (static files). Three.js is bundled in client/vendor, no CDN needed.
  js/boot.js     decides how the game starts: guest, your account, or visiting a friend
  js/online.js   cloud saves, Friends panel, live room, gifts, trades
  js/layouts.js  island layouts (Village, Spread out = the original island, Highlands) and the island maker for new accounts
  js/main.js     the game itself
server/          Cloudflare Worker (API), D1 database, Durable Object (live rooms)
  src/index.js   all server code
  schema.sql     database tables
  wrangler.toml  Cloudflare config
```

## Run it on your computer

Needs Node.js 18 or newer.

```
cd server
npm install
cp .dev.vars.example .dev.vars          # DEV_LOGIN=1: sign-in links show on screen instead of being emailed
npx wrangler d1 execute driftwood --local --file=schema.sql
npx wrangler dev
```

Open http://localhost:8787. To test two players, use a normal window and a private window.

## Put it online (Cloudflare)

You need a Cloudflare account (the Workers free plan covers testing; check Cloudflare's pricing page for limits on D1 and Durable Objects at your scale) and, for real emails, a Resend account with your domain verified.

1. `cd server && npm install`
2. `npx wrangler login`
3. `npx wrangler d1 create driftwood`, then copy the `database_id` it prints into `wrangler.toml`.
4. `npx wrangler d1 execute driftwood --remote --file=schema.sql`
5. Email: in `wrangler.toml` set `MAIL_FROM` to an address on your verified Resend domain, then `npx wrangler secret put RESEND_API_KEY` and paste your Resend key. Do **not** set DEV_LOGIN in production.
6. `npx wrangler deploy`. It prints a `*.workers.dev` address you can play on right away.
7. Your own domain: add the domain to Cloudflare, then attach it to the `driftwood-isle` Worker under the Worker's domain settings in the dashboard.

Invite links use whatever address the game was opened on, so after adding your domain, share links from that domain.

## How it works

**Guest mode** (no account): pick Village, Spread out or Highlands. Saved only in the browser, with warnings. Limits: wallet up to 10,000 clams (sales that would go over are refused), common and uncommon finds only (no rare or better fish, bugs, fossils or beach finds, no traveling rare-goods seller), house up to 12 floor squares, a smaller set of house styles. "Make an account" moves the guest island online; the server re-applies the guest limits once on import in case the browser copy was edited, then lifts them.

**Accounts**: sign up with name, email and character name. Sign in by emailed link (no passwords). One island per account. Saves are versioned so an old copy can't overwrite a newer one. Game time comes from the server, so changing the phone's clock no longer skips time.

**Friends**: only through invite links (each link works once, for one person, for 14 days). There is no search or public player list, so strangers can't find anyone. Options: visitor or resident, one visit or any time. Making a resident invite shows a warning to only invite people you know and trust. Owners can switch a friend between visitor and resident or remove them; friends can remove an island from their list.

**Visits**: you bring your own bag and clams. Visitors can look around, pick fruit, dig fossils, collect beach finds and shop; their picks and shop purchases come from their own copy of the day, so they never use up the owner's. Visitors can't chop, plant, water, dig up, place or move things, donate, invest or build. Residents can do everything the owner can, except building their own house (not built yet). When both are on the island at once, you see each other move in real time, with name tags.

**Talking**: no free text between players. Ten preset reactions (Hi!, Yay!, Haha!, Love it!, Whoa!, Aww..., Hmm..., Zzz, Thanks!, Bye!).

**Gifts and trades**: mail an item to any friend, give one directly to someone on the island with you, or trade items (both tap Ready). Clams can never be sent or traded. The server moves the items itself inside one database transaction, so items can't be duplicated or lost.

## What is and isn't protected yet

- Enforced by the server: who can visit and with what role, visitors can't save island changes, every item that moves between players, guest limits when a guest island comes online, one-time invites and visits.
- Not enforced yet: your own clams and items on your own island are still trusted from the game, so someone who edits their own save could give themselves things, and then gift those items to friends. Fully server-run economy is a bigger later step.
- Owner and resident editing at the same time: changes are merged part by part (trees, furniture, plants, house, and so on). If both changed the same part, the newer save wins and the other player sees a banner. The game doesn't redraw the island live; it asks you to reload.
- Not built yet: residents building their own house; character-name filtering; rate limiting; a privacy policy and terms page. Account deletion is in the Friends panel.
- Tested on a local Cloudflare dev server with two headless browsers (sign-up, guest import, invites, visits, live presence, gift, trade, resident edit, permissions, account deletion). Not yet deployed or tested on a real phone.

## v0.9: island maker, wizard, favors, new prices

**Island maker (new accounts).** Signing up with a guest island in the browser asks: keep it, or start from scratch. Starting from scratch (and every account with no guest island) opens the island maker: terrain (Flat, Hilly, Mountainous, Cliffs) and town (Dense, Suburbs, Spread out), a map preview and a Reroll button. Made islands are about twice the area of the preset ones. The save stores only the recipe (`layout:'gen'`, `gen:{seed, terrain, town}`), so the same recipe always rebuilds the same island. Guests still pick from the three preset layouts.

**Waterfalls.** Every hilly, mountainous or cliffs island (and the Highlands preset) has a waterfall at the river's spring: a pool on a small plateau that spills down a sheer rock face.

**Wendell the wizard.** Unlocked by a favor for Lumi (bring 2 starfish and a sand dollar). His tower appears near the plaza. He sells luck potions (10 minutes each), moves buildings (your house 30,000, anything else 50,000) once your house has 16 floor squares and 2 shops are backed, and reshapes land (raise or lower terraces, dig ponds and rivers, fill them back in) once your house has 24 squares and all 3 shops are backed. A spell saves the island and reloads it.

**Favors.** Islanders sometimes ask for things (materials, fruit, a fish or bug, a delivery to a neighbor). Up to 3 at a time, listed on the Island Board. Rewards are clams, friendship and sometimes a potion, a swatch book, foreign fruit or a rare piece of furniture. Three story favors unlock things: Lumi (the wizard), Otis (traders visit more often), Juniper (house styles).

**Prices.** Rebalanced toward New Horizons' ratios: fruit regrows 3 days after picking, coconuts sell for 150, fruit from other islands sells for 250, and houses, investing, tools, bags, the bike and house styles cost more. Values are in `client/js/content.js` (and `BIKE_COST`, `STYLE_BASE` in `main.js`).

**Testing shortcuts.** Open the game with `#dev` at the end of the address (for example `https://vinatix.com/#dev`). Menu > Testing tools then has +50,000 clams, raise the wizard tower, skip wizard requirements and new favors. They only show on a device that opened the `#dev` link.

## v1.0: a growing town, cooking, two-story houses

**Town.** New islands start with three neighbors (Pippa, Bramble, Mabel). The rest move in over the next days: a "Moving in!" sign and boxes appear on their plot the day before. Islands made before v1.0 keep everyone. Clementine runs the town from a tent near the plaza; chip in clams to grow it into the Town Hall (room for more neighbors, flower beds and benches in the plaza) and then the Grand Town Hall (a fountain, and Wendell learns to make new land). Builders work overnight.

**Museum.** Starts as a tiny curio cottage and grows overnight as the collection does (12, 35 and 65 donations): a hall, the full museum, then two wings. Anonymous islanders sometimes leave a common find at the museum overnight.

**Shops.** Pemberton's is a real shop you walk into: today's furniture is on display stands and seeds are on a table, walk up to buy; talk to Pemberton for tools, bags, selling and investing. Marlo's and Sprig's start as market stands by the road and build a storefront once you back them. Better tools only show up in the shop once you could buy and use them.

**Paths.** Islands other than the original Spread out layout (and any island where buildings were moved) lay their paths on a grid that knows where buildings stand, so paths go around houses instead of through them. Trees are still placed around the original paths, so saved trees keep their keys; trees that now stand on a path don't grow.

**Houses.** Place windows yourself (Layout > Windows), mix any paint color once the paint mixer is unlocked, and with the Two stories style unlocked, build real upstairs rooms (Layout > Upstairs) connected by stairs.

**Farming and cooking.** Vegetable and herb seeds (tomato, carrot, potato, pumpkin, lettuce, onion, basil, mint, rosemary) plant on grass without a shovel. Mabel teaches cooking once she knows you. Cook at a campfire (now craftable) or a Wood Stove; dishes sell well, islanders love them, and eating one makes you walk a little faster for 5 minutes.

**Other.** Sled (winter, or with the snow weather preview) slides you down hills. Fences snap end to end and the next one is ready at the end of the line. Fishing takes more patience: fish only notice a bobber close by, may hesitate or lose interest, and landing right on top of one scares it. A catch with a full bag asks whether to let it go or swap something out. Wendell can raise new land from the sea next to the shore. On a computer, clicking no longer walks you anywhere: walk with WASD, drag (or swipe sideways on a trackpad) to look around, and change shortcuts in Menu > Controls. The pond no longer flickers (the deep-sea plane sat at the same height as the pond bed). Testing tools add "Town: skip a day".

## v1.1: plush characters, painted fish and bugs, living decor

**Characters.** Everyone is now a stuffed toy: felt and knit textures, round heads, short round bodies, stubby arms and legs with foot pads, shiny safety eyes and stitched mouths. Each neighbor has clothes and an accessory (scarf, beanie, overalls, glasses, beret, pearls, apron, vest and more, set per character in `content.js`). Snouts, noses and whiskers differ by species. Movement is springier: bodies squash on every step, kick when starting and stopping, breathe when idle, and heads, ears and tails lag and flop behind.

**Fish and bugs.** Every fish has its own painted skin (koi patches, trout spots, tiger stripes, scales that shimmer, a glowing lanternfish lure) with see-through fins. Butterflies and moths have their own wing art (eye spots, borders, tails, frost, stars), dragonflies and bees get glassy veined wings, beetles get glossy and iridescent shells. Bag icons show fish in profile and bugs from above.

**Decor.** Furniture uses real-looking materials (wood grain, fabric, glass, brass, glazed ceramic). Many pieces move: fish swim in the tanks with swaying weeds and bubbles, moths circle the moth lamp, bees buzz around the skep, the globe turns, the grandfather clock tells the real time and swings its pendulum, chimes sway, the fountain splashes and ripples, a bird hops on the bird bath, a firefly drifts in the terrarium, embers rise from the campfire. Animations only run for pieces near the camera.

Code: `client/js/look.js` (materials and painted textures), `client/js/furn.js` (decor builders and `userData.anims`). `client/preview.html` is a bare page used to render lineups during development.

**Trees (v1.1.1).** Trees and shrubs are painted instead of built from flat balls: canopies are clouds of hand-painted leaf clumps around a soft core, shaded like one volume, with dappled shadows. Each tree gets its own shape, lean, size, trunk bend and color shift, so no two match (autumn mixes reds, oranges and golds across a grove). Trunks are bent, flared at the base and carry bark texture; birches have papery bark. Winter trees show twiggy bare branches. Pines and cedars are layered needle clumps, palms have painted fronds. Code: `client/js/trees.js`.

**Ground and light (v1.1.2).** The grass has painted brush strokes (sampled in world space at two scales, strongest on grass, a light grit on sand and dirt) and broad warm and cool meadow patches. Paths use four worn, irregular stone shapes packed unevenly, with more color variation and the odd mossy stone. Daytime light is a warm sun with cool sky-colored shadows, haze starts closer so distant land fades, and a light vignette frames the screen. Tests can call `__game.v1.updateSky()` after changing `Time.offsetH`.

## v1.2: home goods, stumps, little animations, phone fixes

**Home goods.** House styles, paints and materials are no longer bought straight from the builder. Pemberton's store has a Home Goods rack (walk up to it, or the Home goods tab when you talk to him) with 3 new things a day, 4 or 5 once the store is bigger, and sometimes the paint mixer. "Try it on" opens the builder with it applied to your house. In the builder, locked styles can still be tapped to preview them; you can't press Done until you buy what you're trying (if it's on the rack today) or put it back. Swatch books from digging and neighbor gifts still unlock styles too. Code: `homeStock`, `draftUnowned`, `renderTryBar`, `HomeRack` in `main.js`.

**Cottages (v1.8).** Houses are built from `client/js/cottage.js`. Each neighbor has their own cottage (Pippa thatch, Bramble mossy log cabin, Lumi storybook with a turret, Otis gambrel barn, Mabel mossy stone, Juniper two-story half-timbered with an overhanging upper floor, Clover mossy thatch); styles are in `STYLES` there. Gable and steep roofs everywhere (your house, shops, museum) now have shingle courses, flared eaves, bargeboards, a ridge cap and finials. New unlockable styles for your house: Thatch, Mossy shingles and Gambrel roofs, Half-timbered walls. `mergeStatic` merges each house's pieces by material so the extra detail stays cheap on phones.

**Shops and stands (v1.10).** The Bait Shack and Seed Cart stands have turned posts, a peaked striped canopy with a scalloped edge, bunting, a lantern and a pennant; the Bait Shack has rope-wrapped posts, a life ring and floats, the Seed Cart has wagon wheels and seed sacks. Pemberton's store (all 4 tiers) and Tidepool now face the path with their gable: stone base, board or plaster walls, shingle roof, display windows with flower boxes and striped awnings, a hanging sign, lanterns, pots and crates; the Grand Emporium tower has a shingled spire and clock. Bug & Bloom got iron ridge cresting, an arched transom, hanging baskets, pots and ivy. Shared pieces (`scallopAwning`, `bunting`, `hangingSign`, `sack`, `pot`) are in `cottage.js`; the buildings are in `buildStand`/`buildStore` (`models3.js`) and `buildShopBuilding` (`models2.js`). Town hall and museum are unchanged.

**Shops pushed further (v1.16).** Pemberton's: tier 0 thatched; tier 1 mossy shingles with a dormer each side; tiers 2-3 half-timbered with a timbered gable, two dormers a side and a heavy mossy roof; all tiers have bay windows with little shingled roofs, a round door with climbing roses, ivy on the corners, a mossy stone chimney, a lamp post and a log pile. Tidepool: fish-scale shingle walls, mossy roof, porthole dormers, stovepipe, plank porch, drying net, lobster traps, oars and dune grass; the tank wing is a mossy annex. Bug & Bloom: lush plants inside, vines hanging off every eave, flowering ivy, moss on the brick, potting bench, wheelbarrow, birdhouse; the tier 2 wing is a sage-green potting shed. Stands: mossy shingle roof (Bait Shack, with a net and trap) and mossy thatch (Seed Cart, with flowering vines), hanging vines under the eaves. New helpers in `cottage.js`: `dormer`, `bayWindow`, `drapedNet`, `lobsterTrap`, `hangingVines`, `lushPlants`, `mossTop`.

**Controls per device (v1.11).** Walking mode and joystick settings are kept in this browser (`driftwood-controls-v1` in localStorage), not in the island save, which syncs between a player's phone and computer. Phones and tablets start with the joystick in the bottom left; a computer always uses the keyboard. Whatever you pick in Menu > Controls (joystick or tap to walk, size, visibility, positions) is remembered on that device. The first time on a device, size, visibility and positions carry over from the old save.

**Stumps.** Digging up a stump gives you a Tree Stump. New woodworking plans use them: Mossy Stump Seat, Stump Side Table, Hollow Stump Planter, Split Stump Bench, Mushroom Stump Lamp (builders in `furn.js`).

**Animations** (`FX` in `main.js`): trees tip over away from you and land with a thump, digging and planting open a hole first, stumps wobble loose and pop out, pulled weeds come up with a tug, caught fish leap out of the water and you hold them up.

**Phone fixes.** The top bar keeps Bike, Build (near home), Bag and More; Book, Craft, Sled, Friends and Menu are under More. Everyday pickups show as small notes under the clock (repeats count up: "Wood x3"); other messages are smaller and sit lower on phones. Page zoom, text selection and long-press menus are blocked. Turning the phone re-lays out the controls several times as the browser settles. Bugs on tree trunks stay on the side facing the camera. Weeds are bigger, scragglier clumps.

## v1.3: wizard spells you can watch, ten songs, bonking friends, fewer tips

**Wendell's spells.** Moving a building shows a see-through copy of the real building where it will go (trees and rocks it would replace disappear from the preview). Shaping land shows each planned square as it will look: raised blocks of grass and earth, the new lower level, water, sand. Pressing Cast first frames the whole plan and asks "Like that?". Then the spell plays on the island: Wendell pops in, sparkles swirl, the building squashes, stretches and lifts off as a glowing orb that arcs over and lands at the new spot with a bounce, or the land rises, sinks and fills with water square by square while the camera shakes. A lilac shimmer covers the reload, and you come back where you were, looking at the result, without the start screen. Code: `ghostOf`, `cellPreview`, `castMagic`, `spellMove`, `spellLand`, `magicExit`, `magicArrive`, `cine` in `main.js`; `#magicVeil` in `index.html`.

**Music.** Ten ambient songs, one for each part of the day (dawn, morning, late morning, noon, afternoon, evening, dusk, night, deep night) plus one for indoors. Each is a few slow layers: a low drone, overlapping pad chords, sparse held melody notes with vibrato, trills, glassy bells, soft plucks and tremolo tones. Phrases are regenerated every loop so songs drift. Code: `SONGS` and `Snd.tick` in `audio.js`.

**Bonk.** With friends on your island, swing a tool at one (Action button, or tap them while holding a tool) and they flop over like a jelly toy: tip past flat with a bounce, wobble with stars over their head, spring back up. No damage, nothing lost, a short cooldown. The server relays it to everyone in the room (`bonk` message, rate-limited). Code: `tryBonk`, `startFlop`, `updateFlops` in `main.js`.

**Other changes.**
- About 90% of the how-to tips are gone (looking at stumps and saplings, chopping, fishing and bug tips, first-time builder and placing tips, shop panel explanations, Wendell's instructions). Short feedback stays.
- Dropped items look for open ground on the camera side and never land behind a tree, rock or building. Daily dig spots avoid those spots too.
- Fish shadows turn into a pale glow at night instead of going darker. Fishing is easier again: fish notice the bobber from further away, bite more often, hesitate less, lose interest less, and the bite window is longer.
- Tap-to-catch bugs: about 60% for common bugs down to under 30% for legendary ones, and a bug can notice you walking up. The timing swing is unchanged.
- Marlo and Sprig stand beside their market stands on the road side and tidy them now and then, so you can see them.
- Anonymous museum donations are now clams (300 to 800) that Professor Thistle passes on to you, not fish or bugs. Critters donated anonymously before v1.3 stay on display.

## v1.5: bonk islanders (ragdoll)

Holding an axe or shovel, press Action facing an islander (or tap them) and they go flying: launched up and away with a spin, they fall, bounce and skid, roll onto their back, front or side, and lie there with stars over their head before springing back up with a short line ("Hey!", "Rude!", "Again!"). Arms, legs and head flop on loose springs driven by the spin. An islander who flies into another knocks that one over too. Shopkeepers and Wendell hop back to their spot afterward; residents carry on from where they land. No effect on friendship or saves. Islanders mid-conversation can't be bonked. Net, rod and watering can still talk, so you don't have to put tools away to chat.
Code: `npcBonkTarget`, `tryBonkNpc`, `launchRag`, `updateRag`, `endRag` in `main.js`. Friends still use the synced flop from v1.3.

## v1.6: Swing is its own control; friends and visitors ragdoll too

- **Two controls.** Use/Talk is E, Enter, clicking or tapping things, or the green Act button. Swing is Space or the orange Swing button (shown whenever you hold a tool; the key can be changed in Menu > Controls). Talking never bonks and swinging never talks.
- **Swing anytime.** If something the tool works on is right in front (a tree to chop, a rock, a dig spot, a bug, a plant to water, water to fish in), the swing does that. Otherwise it plays on its own: the axe chops the air, the shovel digs a little hole that fills back in, the rod casts the bobber out and reels it back, the net sweeps, the can sprinkles. If a character is in front of you, the swing sends them flying.
- **Friends and visitors ragdoll** with the same physics as islanders. The person who gets hit runs the tumble in their own game and sends their pose (`rg` rotation, `rs` lying still) with their position, so everyone sees the same thing. While you tumble you can't walk; you're back up in about 2 to 3 seconds.
- **Fixed:** an islander tumbling into you no longer stops you from walking (tumbling islanders aren't solid until they get up), and islanders never knock you over.
Code: `swing`, `airSwing`, `airCast`, `swingTarget`, `launchRag`, `updateRag`, `remoteRag`, `meBody` in `main.js`; `rg`/`rs` accepted in the server's `pos` message.

## v1.7: Portal Station

Every island now has a Portal Station near the plaza: a round stone platform with an arch over stairs going down (spot picked the same way every time from the island seed, saved as `S.portalAt`, with a path to it on the classic island). "Go down" leads to an underground hall:
- **Portal arches**, one per island you can visit (from your friends list), each with the friend's name and its own color. Step in, confirm, and you spin into the swirl, a lilac shimmer covers the trip, and you pop out of the Portal Station on their island. Up to 5 arches; with more friends the last arch opens the Friends list. Islands with no visits left show a dark arch.
- **Home portal** when you're visiting someone.
- **Invite booth** opens the invite panel (make a visitor or resident link). Visitors are told to make invites from their own island; guests are pointed to making an account.
The old Friends button still works the same way. Code: `findPortalSpot`, `buildPortalStation`, `PortalArch`, `InviteBooth`, `refreshPortals`, `portalGo`, `portalArrive` in `main.js`; `B.portal` in `online.js`.

## v1.9: gardens, planting in rows, island seeds, berries

**Island seeds.** Every island has 4 crops that grow wild there, picked at random from the island seed and weighted by terrain (`SEED_TERRAIN`, `islandSeedPool` in `content.js`; Village and the classic island count as flat, Highlands as hilly, made islands use their terrain). They cost 30 clams each and are always in stock: a "Grows wild here" section in Pemberton's Garden tab and at Sprig's (buy 1 or 10), and a seed bin next to the seed table in Pemberton's store. They also grow wild: about 6 ripe plants of them stand around the island (off paths, away from trees and gardens). Picking one gives the crop and 1 to 4 seeds like any harvest; berries and herbs stay, the rest are gone, and the island tops back up to 6 each day. Other seeds still rotate daily at the old prices. Crop seeds now stack to 99 and sell for 10.

**Planting in rows.** Seeds (vegetables, herbs, berries and flowers) open a planter: how many, and how long each row is (up to 10 rows of 10). Then a preview patch shows green where seeds go and red where they can't (paths, trees, rocks, buildings, water, steep terrace edges, other plants). Drag it where you want it; the turn buttons swap rows and columns. Near a garden it snaps flush against one of its sides, or into its empty squares, so a second 10 x 10 lands right next to the first. Blocked squares are skipped and the next free ones are used, so you never lose seeds.

**Gardens.** Planting makes a garden: tilled soil with furrows (grass, clover and wild flowers under it are hidden). Planting next to one grows it; joining two merges them. Gardens are free. Tap the garden's stake (or sign) by the gate for the garden menu: harvest everything ready, water everything (one watering can use per plant), plant seeds from your bag, fences, decorations, move the gate, take the garden out (only when empty).
- Fences, priced per piece (one side of one square): rustic rails 40, white picket 60, low stone wall 70, boxwood hedge 90. Only the outside edge is fenced, never holes around a tree in the middle. The gate stays open; you can't walk through fence pieces. When a fenced garden grows, the new sides stay open until you pay to close the gaps. Switching style re-buys the whole fence.
- Decorations, one-time per garden, can be put away and back out for free: sign by the gate showing what grows most (500), scarecrow on a far corner (1,200), lantern posts on the four corners that glow at night (1,600), flower arch with roses over the gate (2,000).

**Harvesting.** No tool needed. Every harvest gives some of the crop and 1 to 4 seeds. Tomatoes, herbs and the new berries stay planted: strawberries, blueberries and raspberries drop back one stage and are ready again in about a day. New recipes: Berry Tart (4 berries) and Berry Jam (3 berries and mint, campfire).

Saves: new world key `gardens` (client `boot.js`, `online.js`, server `WORLD_KEYS`). Wendell won't reshape land or drop a building on a garden. Code: `farm.js` (soil, instanced fences, decorations), the v1.8 GARDENS and PLANTING IN ROWS sections in `main.js` (`cellFree`, `addToGarden`, `perimeter`, `rebuildGardens`, `fenceHit`, `openPlantPanel`, `checkGrid`, `plantGrid`, `openGarden`, `harvestRec`), berry looks in `models3.js`. Test hooks: `__game.farm`.

## v1.14: party games (Bonk Ball and Crown Keeper)

Start one from Menu > Party games, or Friends > Here now > Party games. Whoever starts it hosts. The game finds the flattest open spot nearby (no buildings; it prefers few trees and a clear view from the camera side), a ring of driftwood posts with rope and pennants pops up, and you're moved into it. Trees, rocks, stumps, weeds, dig spots, dropped items and outdoor furniture inside the ring poof away for the game and come back after (only on screen, nothing is saved). Everyone else on the island gets a "Join / No thanks" card at the top of the screen (up to 4 players). The host presses Start: everyone is placed at their spot, 3-2-1, play, then the winner is shown and the ring goes away.

- **Bonk Ball** (3 minutes, first to 5): a big beach ball. Swing near it to whack it (the axe hits hardest, the shovel scoops it high); walking into it nudges it. Each player has a goal in their color on the ring; knocking the ball into someone else's goal scores. Own goals score nothing. A fast ball someone else hit knocks you (and islanders) over.
- **Crown Keeper** (2:30, first to 30 seconds held): stand in the glowing ring alone to wear the crown and earn a point a second. Two or more in it: nobody scores. Knocked-down players don't count, so bonk them out. The ring moves every 16 seconds.
- **Prizes** only with 2 or more players: the winner gets a Bonk Ball Cup or Crown Keeper Cup (rare furniture, never in shops; it drops at your feet if your bag is full) and 500 clams, everyone else 200. Alone it's practice.
- While you're in a game the Swing button shows even without a tool.

How it works: the host's game runs the clock, scoring and the crown, and sends the state about 10 times a second through the live room (new `game` message: relayed by the server as-is, rate-limited, max 1,500 bytes, never touches saves). Every player also simulates the ball so hits feel instant, and drifts back to the host's ball when they disagree. If the host leaves, the game ends. Code: `client/js/party.js` (`createParty`), hooks in `main.js` (`swing` asks `PARTY.trySwing` first, `PARTY.update` in the frame loop, `remoteLeave`), `online.js` (`game` and `hello`), cups in `content.js`/`furn.js`. Test hooks: `__game.party` (`open`, `state`, `findArena(R)`, `GAMES` to shorten rounds).

**Practice (v1.14.1).** Menu > Party games > Practice with islanders: Bonk Ball 1 on 1, Bonk Ball 3 way, or Crown Keeper against two islanders. Buddies are copies of neighbors who live on your island (the real one steps away until the game ends). In Bonk Ball they guard their goal, get behind the ball and whack it toward yours (with some wobble in their aim). In Crown Keeper they head for the ring, wander inside it, and bonk you or each other when crowded, with a short grace period after you get back up. You can bonk them too, and a fast ball knocks them over. Practice runs only on your screen (nothing is sent to friends), starts right after the rules, has Play again and Done at the end, and gives no prizes. Code: `addBots`, `botsTick`, `ballBot`, `crownBot` in `party.js`; `buddies` in the `createParty` hooks in `main.js`. Test hook: `__game.party.practice('ball', { ball: 1 })`.

**Playtest changes (Nov 23).** Bonk Ball's field is bigger (radius 9, was 7) with slightly wider goals. Crown Keeper's ring is bigger (radius 2.1, was 1.7, in an arena of radius 7, was 6) and drifts steadily around the arena the whole round (a slow loop that swings in and out and now and then turns back the other way) instead of jumping every 16 seconds. The rope is now a real fence: players in a game can't walk out (or get knocked out) until the game ends, and people who aren't playing can't walk in. Buddies are fenced in too. The scoreboard sits under the clock on the left instead of in the middle of the screen, and during play its button is on the title line to keep it short.

## v1.19: islanders at home, slower move-ins, rarer finds, storage chest

- **Islanders stay home more.** Besides their fixed hours, each islander pops home in 45-minute blocks picked by a daily roll, so they're in about a third of their waking hours (`HOME_ODDS` in `main.js`).
- **Move-ins.** Nobody moves in while the town hall is a tent. Each upgrade (town hall, grand hall, museum outgrowing its cottage, backing a shop) makes room for one more islander (`townCap`). A newcomer comes at least 30 real days after the last one, then on a 20% chance per day (`MOVE_GAP`, `MOVE_DAILY`). The town hall upgrades no longer need a number of islanders.
- **Rarity.** Very rare fish, bugs, fossils and shells come up about 0.4% of draws as a group, legendary about 1 in 5,000 (`TIER_SHARE`). Rare ingredients, plans and very rare shop pieces were cut too (`RARE_ODDS` in `content.js`, `STOCK_W`).
- **Controls.** The character maker no longer spins on its own. On a computer, clicking the ground walks you there again (Menu > Controls to turn it off). The Swing button shows what your tool does: Chop, Dig, Cast, Catch, Water.
- **Storage Chest.** Always on Pemberton's shelf (2,400) or made at the workbench (8 wood, 2 iron). Holds 40 stacks; its contents save with the chest.

## v1.20: themed favors, achievements, clothes, 20 new furniture pieces

- **Favors fit the character.** Every islander, the three shopkeepers, Clementine, Professor Thistle and Wendell (once his tower is up) ask for things that match who they are: Bramble wants firewood and fish, Lumi wants beach finds and bugs caught after dark, Juniper wants fossils and furniture, Pemberton wants you to sell him things, and so on (`FAVOR_THEMES` in `content.js`). Each favor is put together from an opener, one of that character's asks and a thank-you gift from their own list (furniture or clothes), plus clams. New "do" favors count what you do after you agree (catch 5 bugs, water 6 plants, donate 2 things...), with progress on the Island Board. Up to 4 favors at a time. Old favors in a save still work.
- **Achievements**: 160, grouped (bugs, fish, digging, trees, gardening, cooking and crafting, museum, friends, home, clams, town and magic, style, gear, time). Menu > Achievements, or the Island Board. Ones you haven't earned are hidden. No rewards yet. Islands from before this version get the ones they already qualify for, quietly, with one toast.
- **Wardrobe**: 10 new outfits, 10 new outfit colors and 30 accessories in four slots (hat, glasses, neck, back). Pemberton has a Clothes tab with 7 pieces a day; some pieces only come as favor gifts. Clothes go straight into your wardrobe (`S.wardrobe`), never the bag; wear them from Change my look. Wings and the balloon animate. Look codes grow to 12 parts only when an accessory is worn (the server's live-room check accepts both).
- **Furniture**: Tea Trolley, Knitting Basket, Star Lamp, Moon Mobile, Fishing Rod Rack, Whittling Bench, Backyard Trampoline, Cloud Beanbag, Hanging Egg Chair, Vanity Table, Silver Candelabra, Flower Cart, Porch Swing, Potting Bench, Ladybug Lamp, Diving Helmet, Brass Cash Register, Mail Sorting Shelf, Curiosity Cabinet, Bubbling Cauldron (`decor2.js`). Six are favor-only.
- Visiting a friend now carries your own look, clothes and achievements (they were missing from the visit's player data).

## v1.21: the museum hall

- **Layout.** Inside, the museum is now a hall (`client/js/museum.js`): aquarium tanks down the left wall, insect terrariums down the right, fossils on lit stone pedestals across the back (a tall back row and a lower front row), and beach finds in a glass case in the middle. Professor Thistle has a desk by the door. Warm, low light: wall sconces, a light bar on every tank, spotlights and light pools on the pedestals. Dark wainscot, painted walls, plank floor, a runner rug and section signs (Aquarium, Insectarium, Fossil Hall).
- **Tanks.** Four fish tanks (Pond & Marsh 8, River Run 10, Coastal Shallows 7, Reef & Open Ocean 11) and four terrariums (Butterfly Garden 8, Garden & Pond 9, Woodland & Shore 12, Moths & Night Lights 7). Groups are in `TANK_GROUPS`; species added later go in the last tank of their kind automatically. Each tank shows its donated species swimming or perched, with a brass plaque ("6 of 8 species").
- **Fullscreen view.** Walk up and press View, or click a tank: the camera moves in and the tank opens fullscreen (`buildTankView`). Fish swim around rocks, plants, caustics, light shafts and bubbles; butterflies fly between flowers and rest side-on with their wings up, moths rest head-up near a lamp, crawlers wander and hop. Drag to look along the tank, tap a specimen or its chip for its card (where, when, donated date, your biggest), the strip shows "?" for species still missing. Close with the X or Esc.

## v1.22: the museum starts small and each section grows on its own

- A new museum is one small room (11x10.5): a shared fish tank ("Island Waters", 8 spaces) on the left wall, a shared terrarium ("Island Critters", 8 spaces) on the right, 3 fossil pedestals at the back and a 4-space case of beach finds.
- When a section runs out of room, the donation is still accepted and waits in the back room; that night the builders make space:
  - Fish or bugs past 8: that section gets its own wing (Aquarium on the left, Insectarium on the right) behind a colonnade, with one themed tank for each group that has a donation. Later, the first donation from a group with no tank adds that tank the next night.
  - Fossils past 3: a Fossil Hall across the back with 6 pedestals; past 6: more rows for the rest.
  - Beach finds past 4: an 8-space case.
- Professor Thistle says what the builders will put in; the next morning's toast lists what was built. The donate panel shows how many things are waiting in the back room.
- The room grows to fit (up to about 22x24 with everything). Each wing has its own floor (slate for the Aquarium, terracotta for the Insectarium, sandstone for the Fossil Hall), sign, lights and benches. A fountain appears in the main room once it's deep enough.
- The outside building's tier now follows the halls (one step per wing or Fossil Hall) and never shrinks. Islands from before v1.22 get the smallest museum that shows everything they've already donated.
- State: `S.museum.st = { fish, bug, fossil, shell }` (fish and bug are `null` for the shared tank or a list of tank group ids).

## v1.25: a bigger, taller, cozier house builder

**Size.** The house grid is now 20 x 20 squares and up to four floors (Ground, 2nd, 3rd, 4th). Every square on every floor is bought the same way as the ground floor, on a home loan, at the same rising price per square. The island was laid out around the old 7 x 6 lot, so that lot is the front middle of the new grid (`BUILD.OX`, `OZ`, `SHIFT` in `content.js`); old saves shift their plan once on load (`shiftPlan`, `S.home.g2`). The house can only grow onto free land: shaded squares in the plan are water, paths, slopes, street lamps or other buildings (`homeBlocked` in `main.js`); trees, rocks and furniture in the way are reported when you press Done. A Height style now unlocks how many floors you may build (Two, Three, Four stories).

**Builder.** The plan zooms (pinch, mouse wheel, + and -, Fit) and pans (two fingers, right-drag, or drag in any tapping tool); "More" makes the panel taller. Layout tools: Rooms, Doors & walls, Windows, Trellises (ground floor), Balconies and Stairs (upper floors), Roofs. In Roofs, tap a room to point its gable to the front or the side, or give it its own roof style. The 3D view turns, tilts and zooms with drag, pinch, the wheel and a row of buttons (hold to keep going), and pans inside. The builder now only shows styles you own (plus anything you're trying on from Pemberton's rack); the store only shows "Try it on" for things you don't own.

**Outside.** Roofs go on each part of a room with nothing above it, so upper floors get their own roofs. New chimneys: Crooked stone, Wonky brick, Bent stovepipe (they bend above the roof). Porch lights: carriage lanterns, brass sconces, a hanging lantern, lamp posts, string lights (old door lamps became carriage lanterns). Trellises (ivy, climbing roses, wisteria, sweet peas) and balconies (wood, iron, flower, Juliet, with French doors) go where you tap; until you place your own, two trellises flank the door and one balcony sits over it. A Wide veranda porch, railings and turned posts on porches, pots on the deck. Flower boxes, pots (`pot` in `cottage.js`), wall lanterns and the Flower Planter and Planter Box furniture have real leaves, five-petal flowers and trailing ivy.

**Moss.** Once you own Mossy shingles you can paint moss onto any roof (Outside > Moss: paint, scrub, three brush sizes, clear). Go over a spot again for thicker moss (3 levels). Saved as `ext.moss` on half squares; drawn as one instanced mesh over a cached map of the roof's top surface (`roofMap`, `buildMossLayer` in `house.js`). An unpainted Mossy shingles roof gets a patchy default (`defaultMoss`).

**Lighting inside.** Each room has a free overhead light with brightness and warmth sliders (Inside > Lighting). Bought fixtures: ceiling lights (glass pendant, paper lantern, hanging bulbs, brass chandelier), wall lights (brass sconces, candle sconces, iron lanterns) and accents (picture-rail glow, gallery spotlights, fairy lights), in the museum's style of warm light pools and beams. Up to 8 real lights per floor (`MAX_LIGHTS`); home interiors use a lower ambient light so the rooms' own lights set the mood (`LT` in `house.js`).

**Code.** The player's house moved to `client/js/house.js` (plan helpers, outside, inside, moss). Floors: `plan`, `plan.up`, `plan.up3`, `plan.up4`; stairs up to floor n: `plan.stairs`, `stairs2`, `stairs3`; trellises `plan.trel`, balconies `plan.balc` (keys like windows: `row:i,j,side`). Interiors: `home`, `home2`, `home3`, `home4`. Per room: `pitch` ('x' or 'z'), `roof`, `ceil`, `sconce`, `accent`, `bright`, `warm`.

## v1.26: boat trips, a bigger town, passive income, a map

**Town.** New islands still start with Pippa, Bramble and Mabel. Once the town hall is built, a newcomer arrives every few days (`MOVE_GAP` 2 days, then a 50% chance each day) until 10 islanders live there (`TOWN_MAX`). Five new islanders can move in: Hazel, Tobin, Wren, Barley and Marigold. Their home spot is picked on each island when they first book a plot (`findHomeSpot`, saved in `S.town.homes`), so existing islands keep their layout. Talk to any islander and pick "Ever think about moving?" to ask them to leave; they pack overnight. At least 5 always stay (`MIN_RES`), and someone who left won't return for 30 days.

**Story quests pass between islanders.** The wizard tower, portal beacon and swatch book quests belong to whoever holds them (`Q.holder`). If the islander they were written for isn't living there, someone else takes the quest, with neutral dialogue (`gask`/`gdone` in `STORY`).

**Merchants.** No traveling merchant until the beacon quest is done; it now lights the beacon on the Portal Station. After that Fennick comes through the portal every 3 or 4 days and pushes a cart around the island along the paths.

**Look.** The Portal Station has standing stones, a lintel, a hanging lantern and a wooden "Portal Station" sign. Wendell, his tower and his staff are greyer and older-looking. Street lamps are crooked wooden posts with a hanging iron lantern, moss and ivy. Coconuts hang lower and bigger.

**Home loans.** One loan covers at most 9 new floor squares (`LOAN_MAX_SQ`); prices per square are unchanged.

**Passive income** (`INCOME` in main.js). Four people turn up once you've progressed: Gill (fisherman, on a beach), Hollis (beekeeper, in a meadow), Russet (orchard keeper, by fruit trees) and Quill (bookkeeper, by the general store, once you back a shop). Fund them, then upgrade after a week. Each fills over 3 days and then waits. Gill's fish use the normal odds. Honey is a new item. Saved in `S.income`.

**Map.** A map sits with your tools (no bag slot). It shows land, water, paths, buildings and whose house is whose, not where anyone is.

**Fish.** A fish's size is rolled when it spawns and its shadow shows it, so a big shadow is a big one for its species.

**Pemberton.** The tool pitch now happens when you go to buy the lower tier again (say, a new Flimsy Rod), with 20% off the first one.

**Boat trips.** Skipper Wick waits at the dock. 2,000 clams buys a trip to a random small island (85% plain, 12% Orchard/Bloom/Frost, 3% Moonlit/Castaway), or hand her a ticket for a named island. Tickets turn up from favors (4%), digging (0.4%) and best-friend gifts (8%). Trip islands are about a quarter the size, have no town, and are made from a seed and a theme (`generateTrip` in layouts.js). Odds never change; themes change the look, the time of day or season, and how many spots there are (Fossil Bluffs has 36 dig spots, Coral Atoll lots of beach finds, Shipwreck Cove more bottle rolls). Castaway Isle has an islander camping who can follow you home. There's no time limit and the island doesn't refill. Sailing home shows what you brought back.

How it works: boot.js starts in `trip` mode when `sessionStorage['dw-trip']` is set. Your player keys come along; the island's own state lives in `sessionStorage['dw-trip-world']` so reloading doesn't refill it. online.js saves only player keys to your own save during a trip. Friends can't come along yet.

## v1.27: weirder islands, surprises, little towns, rare islands, pen pals

**Trip odds** (Skipper Wick, flat 2,000 clams; `TRIP_ODDS` in `voyage.js`): 38% quiet islands, 38% small towns, 20% themed (Orchard, Bloom, Frost), 2% Moonlit or Castaway, 1.5% rare, 0.5% legendary. Tickets still only go to the named themed islands; rare and legendary islands are luck only.

**Layouts.** Quiet and town islands get a layout style from their seed (`tripPlan`): about 30% normal, the rest one of River Maze (three channels, two bridges each), Dune Isle (all sand, palms, more buried things), The Scattered Isles (islets around a little lagoon, rope bridges), Ring Island (a lagoon in the middle), Mesa Isle (a stepped mesa), Crater Isle (a ring of hills around a meadow), Mossmire (pools and reeds) and Thicket Isle (dense woods). The shapes come from new layout fields read by `baseHeight`: `xw` (extra channels), `pools`, `rings`, `pads` (flat ground), `islet`, `bar`, `stones`, `tortoise`, `sand`, `treeMul`.

**Every quiet island has a surprise** (sometimes two): a treasure map in a bottle (its X is a real spot on that island, with a clue from a landmark; dig it up for a chest, and the X shows on your map), a letter in a bottle from someone far away (they become a pen pal), a cave beside a waterfall with a chest, an islet you can walk to at low tide (12 minutes of every half hour, with a sign), stepping stones to a half-sunken temple with a fossil in its floor, a giant tortoise asleep on the beach (walk up its shell and dig), a mushroom ring that gives Glimmer Moss if you stand in it at night, and a hot spring (soak for 5 faster bites).

**Small towns** (`TOWN_KINDS`): a fishing hamlet (the angler pays triple for one fish), a hilltop abbey (5 fruit for 5 seeds your island doesn't grow), a circus camp (a 300-clam cup game that wins boat tickets), a lighthouse (climb it, then the keeper gives you a Lighthouse Lantern), a smugglers' cove (favor-only and rare pieces at twice the price) and a noticeboard village (three small favors, a ticket each). Townsfolk are new people made from the island's seed (`makeFolk`), with their own looks and personalities.

**Rare and legendary islands** (`SPECIAL`). Rare: Clamstone Isle (every rock pays clams), Golden Grove (golden sap from every shake, heartwood from every first chop), The Wizard's Garden (Bellamy gives a 50,000-clam spell voucher Wendell takes off the next spell), The Plan Library (pick any plan you don't know). Legendary: The Wishing Workshop (bring 10 wood, get any furniture at all), Starfall Isle (always night, starstones lying around and falling), The Collector's Attic (any museum specimen you're missing), Shimmer Lagoon (only very rare and legendary fish). Clams plus sell value gathered on one of these is capped at 200,000 (`HAUL_CAP`); gifts don't count.

**Pen pals.** Everyone you talk to goes into your contacts (islanders, shopkeepers, helpers, trip townsfolk, friends). Open them from the town hall, the new desk in the Portal Station, or Menu > Pen pals. Letters are preset templates (`LETTERS` in `content.js`), one a day per person, with an optional gift; replies arrive the next day in personality-flavored words, sometimes with a gift, and good pen pals write first now and then. A pen pal from another island at 8+ friendship who has answered at least 2 letters can be invited to move in (town hall needed, under 10 islanders); they arrive the next day and keep their look (`S.town.extra`). Letters to real friends go through the server mail (`/api/mail` accepts a `letter` id, with or without an item) and show in Friends > Mail. Player save keys added: `contacts`, `letters`.

## v1.29: wildflowers

Each island has 3 flower species (picked from the island's seed) that grow wild in little clumps: 10 on your island, 5 on trip islands, 24 of every species on Bloom Isle. Picking a clump takes it whole and gives the flower plus 1 to 3 of its seeds, so you can start a flower bed for free. Clumps are topped back up each day and wilt away in winter (Bloom Isle never has winter). The scenery flowers in the grass are unchanged and still can't be picked. Code: `islandFlowerPool` in `content.js`, `buildWildFlower` in `models.js`, `Plant.pickWild` and the wildflower block in `rollDay` in `main.js`.
