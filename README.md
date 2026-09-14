# Blockbound

A small Minecraft-inspired browser game with original procedural textures, a first-person voxel world, and local saves. Built with Three.js and Vite; no server account or external art assets are required.

## Play locally

Requires Node.js 20.19+ or 22.12+.

```sh
cd /home/jamal/Projects/blockbound
npm install
npm run dev
```

Open the URL printed by Vite, normally **http://localhost:5173**. `npm run build` produces a standalone static site in `dist/`; `npm run preview` serves that build.

## What's included

- Deterministic 96 × 96 × 48 worlds with forests, rivers, hills, caves, coal, iron, gold, diamonds, and a safe starting clearing.
- A live home-screen landscape, seed selection, Survival and Creative modes, saved-world selection, pause menu, and field guide.
- A 36-slot inventory with a nine-slot hotbar, stack transfers, 12 crafting recipes, nearby crafting-table requirements, and tool durability.
- Actual 3D textured blocks and held tools, animated sheep, face targeting, timed mining, crack effects, particles, and collision-safe placement.
- Walking, sprinting, jumping, swimming, food, health, fall damage, daylight, torches, sound, and Creative flight.
- Touch controls and responsive menus. Landscape is recommended for playing on a phone.

## Controls

| Action | Control |
| --- | --- |
| Walk | W A S D |
| Look | Mouse; drag when pointer lock is unavailable; arrow keys also work |
| Jump / swim upward | Space |
| Sprint | Shift |
| Mine | Hold left mouse button |
| Place / use table / eat | Right mouse button |
| Select hotbar | 1–9 or mouse wheel |
| Inventory | E |
| Pause | Escape or pause button |
| Creative flight | F to toggle; Space up, Shift down |

Select a stack and then another slot to move or swap it. Shift-click moves a stack between your backpack and hotbar. With a stack selected, press 1–9 to put it in that hotbar slot. Crafting is selected from the recipe book and confirmed with the craft button.

Start with a wooden pickaxe, three logs, dirt, and apples. Make planks, sticks, and a crafting table. Mine stone with a wooden pickaxe; place a table to craft a stone pickaxe. Stone picks gather iron; iron picks gather gold and diamonds. Gold appears below Y 12 and diamonds below Y 9.

This deliberately small game uses still water, persistent tree canopies, and ready-to-use ore drops. It does not implement multiplayer, hostile mobs, fluid simulation, or a separate furnace. Creative building materials are unlimited; bedrock remains unbreakable.

## Saves

Worlds are stored separately in this browser's local storage. The game saves every 20 seconds, on crafting, when paused, and when leaving. Saved terrain includes both mined and placed blocks; inventory, durability, location, health, progress, and time are restored. Clearing browser data removes saves. Saved data stays on your device.

## Verify

```sh
npm test
npm run build
```

The tests cover deterministic generation, ores, spawn safety, ray traversal, tier requirements, full-inventory handling, transactional crafting, stack transfers, collisions, placement, durability, and save roundtrips.

For an actual browser smoke test, leave the dev server running in another terminal:

```sh
npx playwright install chromium
npm run test:browser
```

Screenshots are written to `artifacts/`. The browser test uses isolated temporary browser storage, so it does not touch your own saved games.

## Source layout

- `game.js`: input, UI, gameplay loop, audio, and local storage integration.
- `src/world.js`: generation, voxel storage, raycasting, and collision checks.
- `src/catalog.js`: block definitions, tools, and recipes.
- `src/inventory.js`: stack operations and atomic crafting.
- `src/rules.js`: mining and placement rules shared by the game and tests.
- `src/render.js`: pixel textures, chunk meshes, lighting, tools, and models.
- `src/save.js`: save encoding and validation.
