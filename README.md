# Project SuperDJ · Mumbai After Dark

A self-contained pixel-art DJ life game. Open `index.html` in a browser to play; it needs no server, account, network access, or external assets. The complete original browser build is preserved in the repository's first commit (`a30a4ea`).

Move with WASD or the arrow keys, click a building to walk to it, and press **E** near a door. **I** opens your character and career journal, **M** opens the Mumbai map, and **Esc** opens settings, saving, and the offline game download. Gigs use **D F J K**.

## Progression

The top-left HUD always shows Player Level and XP toward the next level. The cost of the next level is `round(100 × level^1.4)` XP. Successful activities, shifts, friendships, records, releases, upgrades, district discoveries, and completed gigs award XP. Failed or cancelled actions do not. District discovery pays once per district.

| Level | Main unlocks |
| --- | --- |
| 1 | Dadar, starter work, Gully Signal |
| 2 | Bandra, tier 2 jobs, Vinyl Veranda, secondhand decks |
| 3 | Fort, Shaadi Circuit, original releases |
| 4 | Lower Parel, tier 3 jobs, Mill 46, auto-rickshaws, studio flats |
| 5 | Andheri, Neon Local, club-ready setup, Mira collaborations |
| 6 | Worli, tier 4 jobs, rare record stores |
| 7 | Arabian Rooftop, express taxis |
| 8 | Colaba, The Harbour Room, dream studio rigs, skyline homes |
| 9 | Juhu, music director work, Deco After Dark |
| 10 | Monsoon Frequency festival main stage |

Each level beyond 10 adds 1% to gig pay and morning royalties. Existing mixing, production, fan, original-track, district, time, energy, and cash requirements still apply.

Browser saves use `project-superdj-v2`. Existing version 2 saves without XP gain a starting level based on their career progress. Older `afterhours-v1` saves still migrate. Export a JSON save from **Esc** for a portable backup; use **Download offline game** to save the current one-file game.

## Tests

Run `node --test tests/progression.test.cjs`. Tests use Node's built-in test runner and need no installed packages.
