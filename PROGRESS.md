# Progress

## Where things stand

- **What it does:** the Bedrock edition of Ore Cutter, with the Java edition's recipes. Each
  deepslate ore is crafted from a block of its material and one deepslate (iron, gold and copper:
  the raw or the smelted block), and each ore swaps with its deepslate twin in the stonecutter,
  one for one, both ways. A behaviour pack of recipes only: 11 crafting and 16 stonecutter recipes
  (Bedrock recipes take one item per ingredient, so the three metals have a recipe per block).
- **Broken:** nothing known.
- **Next:** the listing (Gabby, by hand). A recipe change in the Java edition goes in here too.
- **The price rule** is the Java edition's: a crafted ore costs a whole block, never a single
  piece. The unit tests check a single piece has no recipe.

## Sessions

| Date | Session | What happened |
|---|---|---|
| 2026-11-11 | The whole add-on | The person who asked for Ore Cutter plays on a phone, so this is the same mod for Bedrock. `packs/bp` holds the manifest, the icon and 27 recipes; `npm run build` writes the `.mcaddon`. Unit tests, 4 pass: the manifest; every recipe's identifier, result and unlock; both stonecutter swaps for all eight ores; each deepslate ore crafted from its block (or either block, for the three metals) and a deepslate, with no recipe for a single piece. Every file passes the community recipe schema (27 passes; the manifest shows the one known schema lag). On a Bedrock Dedicated Server 1.26.63.1 with a fresh flat world the pack and its 27 recipes load with no error or warning lines in the console or the content log. Proof run: with one recipe's block renamed to an item that doesn't exist, the server logs four recipe errors and the check fails; with the name put back it passes. Not done yet: crafting in a real game. |
| 2026-11-11 | Hand play and release | CI passes from a clean copy (build, unit tests, schema check, the add-on attached). Hand play by Gabby in the Windows game: the `.mcaddon` imported by opening it, the pack was switched on under Behaviour Packs, and all the recipes craft. The release commit, with the add-on rebuilt from it for the GitHub release. |
