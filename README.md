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
