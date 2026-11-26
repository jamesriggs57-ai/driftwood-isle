# Driftwood Isle: notes for Claude

## Keep the wiki current (vinatix.com/wiki)

The player guide lives in `client/wiki/` and is served at vinatix.com/wiki.

- `client/wiki/wiki.js` builds every catalog table (fish, bugs, fossils, furniture, clothes, crops, recipes, tools, woodworking, achievements, residents) straight from `client/js/content.js` and `client/js/achieve.js`. New items there show up on their own. If you add a new item kind, a new export the tables should use, or rename a field they read, update `wiki.js` too.
- `client/wiki/guide.js` holds the hand-written pages: how things unlock, quest steps, characters, odds and any prices or rules that live in `main.js`, `voyage.js` or `expand.js` (loans, town hall, Wendell's isles, trip odds, passive income, stakes, island stories).

**Whenever a change touches something a player would look up** (a new character, quest or story step, an unlock condition, a price or rule outside content.js, a new island type, changed odds, a new feature), update the matching page in `guide.js` in the same commit, add a line to the "What's changed" page, and bump `GUIDE_VERSION` / `GUIDE_UPDATED` at the top of `guide.js`. Only write what the code actually does. Plain words, no em dashes, no emoji.

Check it renders: serve `client/` (for example `python3 -m http.server` from `client/`) and open `/wiki/`.
