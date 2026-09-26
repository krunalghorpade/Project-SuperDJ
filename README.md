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

## Goals and quests

Select the current quest on the top-left HUD, or open **I → Goals**, to see all ten primary goals from the start. Their path runs from **The First Set** through **Monsoon Main Stage**. Each goal contains two to four measurable quests. Quests award XP once when completed; finishing a goal also awards XP, cash, and reputation. The Local travel pass lowers train fares, Mira’s master tape improves new releases, and the final goal awards a headliner plaque. Future goal requirements stay visible so you can plan ahead.

Goal, quest, item, and career progress are saved in the same version 2 JSON format. Older saves infer completed work and gigs from their journal where possible; remaining quests can be completed normally.

## Quest deadlines and pins

Open **I → Goals** or select the top-left goal card to see three optional timed opportunities alongside the ten primary goals. Accepting an opportunity starts its deadline in **in-game hours**. Time advances when you take actions, travel, or sleep; the goal menu and pinned HUD show the time remaining. Work, sampling, and gig progress count only after acceptance. The primary goals have no deadlines.

You can pin any incomplete primary quest or active timed opportunity from the Goals menu. The top-left HUD shows up to **three** pins with their progress or countdown. Unpin one at any time, or choose which existing pin to replace when all three slots are full. Completed or expired quests unpin automatically. Pins and timed quest state persist in browser and exported saves.

Chai Rush fails when its eight-hour window closes. City Sound Hunt disappears until the next in-game day if its ten-hour window closes. Booker’s Booking fails after 30 hours and costs three reputation. Successful opportunities award XP, cash, and sometimes reputation. Each offer can be accepted once per in-game day, including after a previous completion or expiry.

## Tests

Run `node --test tests/progression.test.cjs`. Tests use Node's built-in test runner and need no installed packages.
