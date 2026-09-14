# Blockbound

A small Minecraft-inspired browser game with a first-person voxel world, local saves, and a bundled reference-art pipeline. Built with Three.js and Vite; the game runs entirely in the browser with no server account.

## Play locally

Requires Node.js 20.19+ or 22.12+.

```sh
cd /home/jamal/Projects/blockbound
npm install
npm run dev
```

Open the URL printed by Vite, normally **http://localhost:5173**. `npm run build` produces a standalone static site in `dist/`; `npm run preview` serves that build.

## GitHub Pages

The game is published at **https://simplyyrayyan.github.io/blockbound.github.io/**.

One-time setup in the repository:

1. Open **Settings > Pages > Build and deployment**.
2. Set **Source** to **GitHub Actions**.
3. Push the deployment configuration to `main`. Under **Actions**, wait for **Deploy Blockbound to GitHub Pages** to finish. You can also select **Run workflow** to deploy again.

The workflow installs locked dependencies, runs the game tests, builds with Vite, and publishes only `dist/`. Later pushes to `main` deploy automatically. Do not publish the source branch directly: GitHub Pages does not bundle the source files or install JavaScript dependencies for you.

Vite uses relative asset paths, so the built JavaScript, CSS, fonts, and favicon load correctly beneath `/blockbound.github.io/`. Keep `dist/` ignored by Git; the workflow creates and uploads it.

## Wildlife update

- All **84 catalogued mob species**, including the requested list plus Nautilus, Happy Ghast, Sulfur Cube, and Pufferfish. Every species has a spawn egg, voxel anatomy, movement/AI, health, targeting, and a defined loot table. Species that normally have no death drops intentionally have empty loot tables.
- **1,663 items**, **1,041 block definitions**, and **1,742 recipes** are loaded from the local 26.1 reference catalog, including the requested tools, weapons, armor, food, potions, dyes, workstations, storage, transport, projectiles, and new Cinnabar/Sulfur blocks.
- Three generated dimensions (Overworld, Nether, and End), biome palettes, and 22 deterministic structure types provide distinct exploration targets.
- 43 enchantments, workstations (smelting, brewing, anvil, grindstone, smithing, stonecutting, loom, cartography, fletching, composting), redstone components, containers, vehicles, portals, and map/name/settings overlays are playable systems.
- Swords, axes, bows, crossbows, tridents, a mace, ammunition, shields, five armor materials, turtle helmets, wolf armor, potions, food, resources, and building materials.
- Melee and projectile combat, pickupable drops, tool and armor durability, status effects, boss health bars, a working totem of undying, and TNT.
- Taming, following/staying, riding, breeding with baby growth, shearing, milking, brushing, villager trading, piglin bartering, fishing, planting, growth, fertilizer, and harvesting.
- Deterministic 96 x 96 x 48 terrain with oak, birch, spruce, and cherry trees, new ores, snowy/desert/pale regions, and small volcanic and End-stone regions.
- A reference-inspired title screen, stone-colored beveled menus, locally bundled textured item icons, hearts, hunger, armor, XP, searchable/paginated Creative inventory, equipment slots, and an 84-species field journal.
- Backward-compatible local saves, responsive menus, touch controls, and Creative flight.

The six supplied reference images are left unchanged in the project root. Procedural geometry remains available as a fallback when a reference model is missing.

Reference-backed textures and mob samples are bundled under `public/assets/` for offline play. Their source and Minecraft EULA notice are preserved in [`public/assets/NOTICE.txt`](public/assets/NOTICE.txt); Blockbound is an unofficial, non-affiliated fan project.

## Controls

| Action | Control |
| --- | --- |
| Walk | W A S D |
| Look | Mouse; drag when pointer lock is unavailable; arrow keys also work |
| Jump / swim upward | Space |
| Sprint | Shift |
| Mine / melee attack | Hold left mouse button |
| Place / interact / eat / fire ranged weapon | Right mouse button |
| Select hotbar | 1–9 or mouse wheel |
| Inventory | E |
| Pause | Escape or pause button |
| Creative flight | F to toggle; Space up, Shift down |

Select a stack and then another slot to move or swap it. Shift-click moves a stack between your backpack and hotbar. With a stack selected, press 1–9 to put it in that hotbar slot. Crafting is selected from the recipe book and confirmed with the craft button.

In Creative, open the inventory, select the Mobs tab, and search by name. Click a spawn egg to add it, or Shift-click to put it directly into the selected hotbar slot. Right-click a surface to spawn it. Aquatic mobs require nearby water; bosses need space. The same item catalog includes all new tools, food, armor, and building blocks.

Select an armor stack and click the shirt button to equip it. Clicking an occupied equipment slot returns it to the backpack. Armor can also be equipped by right-clicking while holding it. The drop button drops the selected stack into the world; equipment durability is preserved on pickup.

### Mob interactions

| Mob / family | Implemented behavior |
| --- | --- |
| Hostile ground mobs | Chase, local A* obstacle navigation, melee or ranged attacks, retaliate, drop loot and XP |
| Skeleton, Stray, Bogged, Pillager, Drowned | Visible weapons; arrows, slowing/poison arrows, crossbow bolts, or tridents |
| Creeper | Approach, visible fuse pulse, cancellable fuse, terrain-damaging explosion; avoids cats/ocelots |
| Enderman / Creaking / Warden | Gaze-triggered anger and teleporting / freezes while observed / movement-sensitive pursuit and sonic shots |
| Blaze, Ghast, Breeze, Shulker, Witch | Fireballs, wind charges, levitation shots, poison; Witch regenerates out of combat |
| Evoker / Vex | Fang projectiles, bounded Vex summons, flying melee allies |
| Ender Dragon, Wither, Elder Guardian | Boss health, ranged attacks, loot/XP; Wither regeneration; guardian mining fatigue |
| Slime / Magma Cube | Hopping, splitting into smaller mobs on death |
| Wolf, Cat, Parrot, Horse family | Guaranteed taming with bone, cod, seeds, or apple; follow/stay; wolf defense |
| Horse, Donkey, Mule, Camel, Pig, Strider, Llama | Saddle/riding where applicable; right-click again to dismount |
| Cow, Goat, Mooshroom | Empty bucket collects milk; bowl collects Mooshroom stew |
| Sheep, Mooshroom, Bogged, Snow Golem | Shearing; sheep regrow wool; Mooshrooms become cows |
| Armadillo, Turtle, Goat | Brush collects scutes or a horn, with a cooldown |
| Chicken, Sniffer, Bee | Lay eggs, dig torchflower seeds, produce collectible honey |
| Allay | Toggle companionship and retrieve nearby dropped items; holding an item sets its collection filter |
| Fox, Axolotl, Frog, Dolphin | Hunt chickens / aquatic prey; frogs eat small slimes; dolphins grant speed nearby |
| Villager / Wandering Trader / Piglin | Transactional trading / gold bartering |
| Zombie Villager | Golden apple cures it into a trading Villager |
| Breedable animals | Matching food brings two nearby adults together; one baby, growth timer, parent cooldown |

Food preferences are declared per species in `src/mob-catalog.js`. Examples: wheat for sheep/cows/goats, carrots for pigs/rabbits, seeds for chickens, bamboo for pandas, slime balls for frogs, seagrass for turtles, and golden carrots for horses. Tadpoles grow into frogs.

Start with a wooden pickaxe, three logs, dirt, and apples. Make planks, sticks, and a crafting table. Mine stone with a wooden pickaxe; place a table to craft a stone pickaxe. Stone picks gather iron; iron picks gather gold and diamonds. Gold appears below Y 12 and diamonds below Y 9.

### Small-game differences

This is a playable, simplified clone, not complete Minecraft parity. Mob families share AI and anatomical building blocks, with species-specific traits. Boss health, loot quantities, taming, breeding times, and recipes are tuned for a small map. Creaking uses health rather than a linked heart block. Evoker fangs and guardian beams use the projectile system. Goat horns and turtle scutes are brush rewards. Fishing is an immediate catch with a cooldown.

Water and lava stay still; trees retain their canopies; ore drops usable materials; cooking and brewing happen at their dedicated stations. Redstone is intentionally compact but includes power propagation, repeaters/comparators, pistons, doors, lamps, TNT, dispensers, hoppers, observers, note blocks, and sculk sensors. There is no multiplayer, raid system, or villager profession simulation. Bosses are available through Creative eggs; the Wither can also be summoned by using three wither skulls on soul sand. Some rare ingredients are easiest to obtain from Creative. Bedrock remains unbreakable.

### Performance

Mob models, equipment, ground loot, and projectiles share an instanced box renderer. AI uses a fixed 20 Hz step, local bounded A* paths, slower distant decisions, and simulation distance limits. Natural population is capped at 28; the total cap including player-spawned mobs is 64. Projectile, loot, and crop counts are bounded. Static inventory/pause screens stop redrawing the 3D scene; the title panorama runs at a reduced frame rate.

## Saves

Worlds are stored separately in this browser's local storage. The game saves every 20 seconds, on crafting, when paused, and when leaving. Terrain edits, inventory/durability, equipment, effects, mobs, tamed/saddled pets, dropped items, crops, lit TNT, player state, and time are restored. Clearing browser data removes saves. Saved data stays on your device.

Old version-1 worlds regenerate with their original terrain algorithm before edits are applied. New worlds use terrain version 3 and retain the old block IDs/storage prefix for compatibility. Create a new world to see the new dimensions, biomes, structures, and reference-backed catalog; old worlds still support the new items and mobs.

## Verify

```sh
npm test
npm run build
```

Tests cover terrain and old-save compatibility, mining, recipes, inventory transactions, all 84 species/models, spawning limits, AI, combat, projectile obstruction, drops, taming, breeding, equipment, trading, farming, and entity save roundtrips. Browser smoke tests additionally cover dimensions, catalog pagination, responsive controls, and the production GitHub Pages path.

For an actual browser smoke test, leave the dev server running in another terminal:

```sh
npx playwright install chromium
npm run test:browser
node scripts/wildlife-smoke.mjs
```

Screenshots are written to `artifacts/`. The browser test uses isolated temporary browser storage, so it does not touch your own saved games.

The wildlife suite runs against the dev server. It tests combat, loot pickup, trading, catalog search/pagination, actual egg spawning, mobile layouts, canvas pixels, and four model-gallery screenshots covering all 84 species. It also checks animation changes pixels and the model renderer uses a bounded number of draw calls.

To check the production build under the same repository path as GitHub Pages (the test starts and stops its own preview server):

```sh
npm run build
npm run test:browser -- --preview
```

To run the same gameplay checks against the deployed site:

```sh
BLOCKBOUND_URL=https://simplyyrayyan.github.io/blockbound.github.io/ npm run test:browser
```

## Source layout

- `game.js`: input, UI, gameplay loop, audio, and local storage integration.
- `src/world.js`: generation, voxel storage, raycasting, and collision checks.
- `src/catalog.js`: block definitions, tools, and recipes assembled from the local reference catalog.
- `src/data/reference.json`: pinned 26.1 item, block, recipe, food, and enchantment data.
- `src/regions.js`: dimensions, biomes, and deterministic structure placement.
- `src/systems.js`: workstations, storage, redstone, vehicles, and machine persistence.
- `src/extended-actions.js`: portals, buckets, dyes, potions, farming, maps, and special interactions.
- `src/content.js`: appended block IDs, new items, equipment, and recipes.
- `src/mob-catalog.js`: all species, stats, habitat, interactions, and loot tables.
- `src/mobs.js`: fixed-step AI, spawning, combat/projectiles, loot, trading, and entity persistence.
- `src/mob-models.js`: species anatomy, procedural skins, animation, and instanced rendering.
- `src/actions.js`: equipment, consumables, ranged weapons, farming, and player effects.
- `src/item-art.js`: cached raster item icons using the actual terrain atlas for blocks.
- `src/inventory.js`: stack operations and atomic crafting.
- `src/rules.js`: mining and placement rules shared by the game and tests.
- `src/render.js`: pixel textures, chunk meshes, lighting, tools, and models.
- `src/save.js`: save encoding and validation.
