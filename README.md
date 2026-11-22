# Driftwood Isle (online build)

The cozy island game plus everything needed to run it online: guest mode, accounts, cloud saves, friend invites, visits (async and live), mailbox gifts and item trades.

```
client/          the game (static files). Three.js is bundled in client/vendor, no CDN needed.
  js/boot.js     decides how the game starts: guest, your account, or visiting a friend
  js/online.js   cloud saves, Friends panel, live room, gifts, trades
  js/layouts.js  island layouts (Village, Spread out = the original island, Highlands)
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
