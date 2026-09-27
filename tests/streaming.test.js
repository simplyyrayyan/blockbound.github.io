import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { World, HEIGHT, collides, validFarKey } from '../src/world.js';
import { B, BLOCKS, freshItem } from '../src/catalog.js';
import { terrainColumn, structureCandidates, STRUCTURE_BIOMES } from '../src/terrain.js';
import { WorldSystems } from '../src/systems.js';
import { Inventory } from '../src/inventory.js';
import { transferSlot, craftGrid } from '../src/crafting.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { MobSystem } from '../src/mobs.js';
import { MOBS } from '../src/mob-catalog.js';
import { regionBiome } from '../src/regions.js';
import { blockBoxes } from '../src/block-shapes.js';
import { placeBlock } from '../src/rules.js';
import { bubbleColumn } from '../src/fluids.js';
import { moveBody, stepPhysics, updateBreath } from '../src/physics.js';

function flat() {
  const world = new World('101', 1);
  for (let x = 0; x < 40; x++) for (let z = 0; z < 40; z++) { world.raw(x, 0, z, B.BEDROCK); world.raw(x, 1, z, B.STONE); }
  return world;
}
function stateFor(world) {
  const inventory = new Inventory(), mobs = new MobSystem(world, { mobs: [] });
  return { id: 'stream-test', world, player: { ...world.spawn, yaw: 0, pitch: 0 }, mode: 'survival', selected: 0, health: 20, food: 20, xp: 0, elapsed: 0, inventory, mobs, equipment: {}, effects: {}, progress: {}, systems: new WorldSystems(world) };
}
function digest(world, cx, cz) {
  const data = [];
  for (let x = cx * 16; x < cx * 16 + 16; x++) for (let z = cz * 16; z < cz * 16 + 16; z++) for (let y = 0; y < HEIGHT; y++) data.push(world.get(x, y, z));
  return createHash('sha256').update(Buffer.from(new Uint16Array(data).buffer)).digest('hex');
}
function settle(world, count = 90) { for (let i = 0; i < count; i++) world.tickFluids(8192); }

test('version 4 chunks are deterministic in any order, across negative and original boundaries', () => {
  for (const dimension of ['overworld', 'nether', 'end']) {
    const a = new World('8675309', 4, dimension), b = new World('8675309', 4, dimension);
    const positions = [[-1, -1], [0, -1], [5, 3], [6, 3], [17, -15]];
    for (const [x, z] of positions) a.ensureChunk(x, z);
    for (const [x, z] of [...positions].reverse()) b.ensureChunk(x, z);
    for (const [x, z] of positions) assert.equal(digest(a, x, z), digest(b, x, z), `${dimension} ${x},${z}`);
    assert.equal(collides(a, { x: -24.5, y: HEIGHT + 1, z: 105.5 }), false);
  }
});

test('new dimensions have safe spawns and edited chunks regenerate without losing changes', () => {
  for (const dimension of ['overworld', 'nether', 'end']) {
    const w = new World('12345', 4, dimension).generate();
    assert.equal(collides(w, w.spawn), false, dimension);
    assert.equal(collides(w, { ...w.spawn, y: w.spawn.y - .03 }), true, dimension);
    w.set(-24, 30, 120, B.GLASS); w.setState(-24, 30, 120, { test: true });
    w.terrainChunks.delete('-2,7'); w.generatedChunks.delete('-2,7');
    assert.equal(w.get(-24, 30, 120), B.GLASS); assert.equal(w.stateAt(-24, 30, 120).test, true);
  }
});

test('regional structures obey biome tags, terrain support, and dimensions', () => {
  let count = 0;
  for (const dimension of ['overworld', 'nether', 'end']) {
    const w = new World('442291', 4, dimension), seen = new Set();
    for (let cx = -60; cx <= 60; cx += 2) for (let cz = -30; cz <= 30; cz += 3) {
      for (const s of structureCandidates(w, cx, cz)) {
        if (seen.has(s.key)) continue; seen.add(s.key); count++;
        assert.equal(s.dimension, dimension);
        if (STRUCTURE_BIOMES[s.id]) assert.ok(STRUCTURE_BIOMES[s.id].includes(s.biome), `${s.id}: ${s.biome}`);
        if (s.underground) assert.ok(s.y + 7 < terrainColumn(w, s.x, s.z).h);
        if (s.id === 'bastion_remnant') assert.notEqual(s.biome, 'basalt_deltas');
        if (s.id === 'ocean_monument') assert.ok(s.y + 5 < 12);
      }
    }
  }
  assert.ok(count > 20, `Only found ${count} structures`);
});

test('far machines and dimension terrain versions persist through save roundtrip', () => {
  const w = new World('1701', 4), state = stateFor(w);
  const p = { x: -17, y: 30, z: 122 }, key = w.index(p.x, p.y, p.z);
  w.set(p.x, p.y, p.z, B.FURNACE); state.player = { ...p, yaw: 0, pitch: 0 };
  const furnace = state.systems.machine(key, state); furnace.slots[0] = freshItem('raw_iron'); furnace.slots[1] = freshItem('coal');
  for (let i = 0; i < 70; i++) state.systems.tick(.1, state);
  assert.equal(furnace.slots[2]?.id, 'iron');
  state.dimensions = { nether: { worldVersion: 4, edits: [], farEdits: [[key, B.CHEST]], farBlockStates: [] } };
  state.craftingSlots = [freshItem('log'), null, null, null];
  const saved = decodeSave(encodeSave(state)); assert.equal(saved.worldVersion, 4); assert.equal(saved.dimensions.nether.worldVersion, 4);
  const restored = new World(saved.seed, saved.worldVersion); restored.applyEdits(saved.edits); restored.applyFarEdits(saved.farEdits); restored.applyFarStates(saved.farBlockStates);
  const machines = new WorldSystems(restored, saved.systems);
  assert.equal(machines.machine(key).slots[2].id, 'iron'); assert.equal(saved.craftingSlots[0].id, 'log');
  for (const key of ['--2,3,4', '-2,0,4', '-2,128,4', '-30000001,3,4', '2,3,4', '-02,3,4']) assert.equal(validFarKey(key), false);
  assert.throws(() => restored.applyFarEdits([['-2,0,4', B.AIR]]));
});

test('exact-cell transfers preserve metadata, cap stacks, swap, and reject partial mismatches', () => {
  const source = [freshItem('log', 10), { ...freshItem('iron_sword'), name: 'Keep me', enchantments: { sharpness: 1 } }];
  const target = [freshItem('log', 63), null, null, freshItem('stone')];
  assert.ok(transferSlot(source, 0, target, 0)); assert.equal(target[0].count, 64); assert.equal(source[0].count, 9);
  assert.ok(transferSlot(source, 0, target, 2, 1)); assert.equal(target[1], null); assert.equal(target[2].count, 1);
  assert.equal(transferSlot(source, 0, target, 3, 1), false);
  const sword = structuredClone(source[1]); assert.ok(transferSlot(source, 1, target, 3)); assert.deepEqual(target[3], sword); assert.equal(source[1].id, 'stone');
  assert.equal(transferSlot(target, 2, target, 2), false);
  assert.equal(transferSlot(target, 2, target, 9), false);
});

test('manual 2x2 and 3x3 crafting produces real tools and fails atomically when full', () => {
  const inventory = new Inventory(), grid = [freshItem('log'), null, null, null];
  assert.ok(craftGrid(grid, inventory, 2).ok); assert.equal(inventory.count('planks'), 4);
  const table = [freshItem('planks'), freshItem('planks'), freshItem('planks'), null, freshItem('stick'), null, null, freshItem('stick'), null];
  assert.ok(craftGrid(table, inventory, 3).ok); assert.equal(inventory.slots.find(i => i?.id === 'wood_pick').durability, freshItem('wood_pick').durability);
  const full = new Inventory(Array.from({ length: 36 }, () => freshItem('stone', 64))), blocked = [freshItem('log'), null, null, null];
  assert.equal(craftGrid(blocked, full, 2).ok, false); assert.equal(blocked[0].count, 1);
  const world = flat(); world.set(10, 2, 10, B.TABLE); assert.equal(new WorldSystems(world).machine(world.index(10, 2, 10)).slots.length, 9);
});

test('water flows seven cells, falls, renews sources, and recedes when disconnected', () => {
  const w = flat(); w.set(15, 2, 15, B.WATER); settle(w);
  assert.equal(w.get(22, 2, 15), B.WATER); assert.equal(w.get(23, 2, 15), B.AIR);
  assert.equal(w.stateAt(22, 2, 15).fluidLevel, 7); assert.ok(w.waterHeight(22, 2, 15) < w.waterHeight(15, 2, 15));
  w.set(15, 2, 15, B.AIR); settle(w, 130);
  assert.equal(w.get(16, 2, 15), B.AIR); assert.equal(w.get(22, 2, 15), B.AIR);
  w.set(10, 2, 10, B.WATER); w.set(12, 2, 10, B.WATER); settle(w);
  assert.equal(w.stateAt(11, 2, 10).fluidLevel, 0);
  const falling = flat(); falling.set(15, 8, 15, B.WATER); settle(falling, 30);
  assert.equal(falling.get(15, 3, 15), B.WATER); assert.equal(falling.stateAt(15, 3, 15).falling, true);
});

test('water cools lava, evaporates in the Nether, and powers bubble columns', () => {
  const w = flat(); w.set(10, 2, 10, B.LAVA); w.set(11, 2, 10, B.WATER); settle(w, 3); assert.equal(w.get(10, 2, 10), B.OBSIDIAN);
  w.set(15, 1, 15, B.SOUL_SAND); for (let y = 2; y < 6; y++) w.set(15, y, 15, B.WATER);
  assert.equal(bubbleColumn(w, 15, 4, 15), 1); w.set(15, 1, 15, B.MAGMA_BLOCK); assert.equal(bubbleColumn(w, 15, 4, 15), -1);
  w.dimension = 'nether'; settle(w, 20); assert.equal(w.get(15, 4, 15), B.AIR);
});

test('movement resolves contact, jumps one block, and never steps through a wall', () => {
  const w = flat(), p = { x: 10.5, y: 2, z: 10.5, yaw: 0, vy: 0 };
  for (let i = 0; i < 60; i++) stepPhysics(w, p, {}, 1 / 60);
  assert.ok(Math.abs(p.y - 2) < .003); assert.ok(p.grounded);
  let peak = p.y;
  for (let i = 0; i < 90; i++) { stepPhysics(w, p, { jump: i === 0 }, 1 / 60); peak = Math.max(peak, p.y); }
  assert.ok(peak > 3.1 && peak < 3.3, `${peak}`); assert.ok(Math.abs(p.y - 2) < .003);
  for (let y = 2; y < 8; y++) w.set(12, y, 10, B.STONE);
  assert.equal(moveBody(w, p, 'x', 5), false); assert.ok(p.x < 11.72); assert.equal(collides(w, p), false);
});

test('water buoyancy, bubble forces, oxygen recovery and drowning are functional', () => {
  const w = flat(); for (let x = 8; x < 14; x++) for (let z = 8; z < 14; z++) for (let y = 2; y < 9; y++) w.raw(x, y, z, B.WATER);
  const p = { x: 10.5, y: 3, z: 10.5, yaw: 0, vy: 0 };
  for (let i = 0; i < 30; i++) stepPhysics(w, p, { jump: true }, 1 / 60); assert.ok(p.y > 3.8);
  w.set(10, 1, 10, B.SOUL_SAND); const before = p.y;
  for (let i = 0; i < 30; i++) stepPhysics(w, p, {}, 1 / 60); assert.ok(p.y > before + 1);
  const state = { mode: 'survival', effects: {}, equipment: {}, oxygen: 15 }; let damage = 0;
  for (let i = 0; i < 180; i++) damage += updateBreath(state, true, 0, .1);
  assert.ok(damage >= 4); assert.equal(state.oxygen, 0); updateBreath(state, false, 0, 1); assert.equal(state.oxygen, 5);
  assert.equal(updateBreath(state, true, 1, 1), 0); assert.equal(state.oxygen, 10);
});

test('natural populations obey dimensions and aquatic mobs fit in high pools', () => {
  for (const dimension of ['nether', 'end']) {
    const w = new World('2432', 4, dimension).generate(), mobs = new MobSystem(w);
    assert.ok(mobs.mobs.length > 0);
    assert.ok(mobs.mobs.every(m => ['volcanic', 'end'].includes(MOBS[m.type].habitat)), JSON.stringify(mobs.mobs.map(m => m.type)));
    assert.equal(mobs.mobs.some(m => ['cow', 'sheep', 'villager'].includes(m.type)), false);
  }
  const w = flat(); for (let x = 8; x < 16; x++) for (let z = 8; z < 16; z++) for (let y = 23; y <= 27; y++) w.raw(x, y, z, B.WATER);
  const system = new MobSystem(w, { mobs: [] }), result = system.spawn('dolphin', { x: 10, y: 26, z: 10 });
  assert.ok(result.ok); assert.ok(result.mob.y > 20); assert.ok(system.swims('dolphin', result.mob.x, result.mob.y, result.mob.z));
  const far = new World('99', 4), distant = new MobSystem(far, { mobs: [] });
  const x = -124, z = 120, y = far.surface(x, z); const animal = distant.spawn('cow', { x, y, z });
  assert.ok(animal.ok); assert.ok(animal.mob.x < 0); assert.equal(new MobSystem(far, distant.serialize()).mobs.length, 1);
});

test('torches have a narrow non-solid shape and can attach to dry floors and walls', () => {
  const w = flat(), inv = new Inventory(); inv.add('torch', 5);
  assert.equal(BLOCKS[B.TORCH].shape, 'torch'); assert.deepEqual(blockBoxes(B.TORCH, {}, true), []);
  const box = blockBoxes(B.TORCH)[0]; assert.ok(box[3] - box[0] <= .15); assert.ok(box[4] < 1);
  w.set(10, 3, 10, B.STONE);
  const hit = { x: 10, y: 3, z: 10, id: B.STONE, normal: { x: 1, y: 0, z: 0 }, adjacent: { x: 11, y: 3, z: 10 } };
  assert.ok(placeBlock(w, inv, 0, hit, { x: 3, y: 2, z: 3 }).ok); assert.equal(w.stateAt(11, 3, 10).wall, true);
  assert.equal(collides(w, { x: 11.5, y: 3, z: 10.5 }), false);
});

test('every species has a spawn path and structure tables only name real mobs', () => {
  const source = readFileSync(new URL('../src/regions.js', import.meta.url), 'utf8');
  const named = new Set();
  for (const call of source.matchAll(/spawns\(([\s\S]*?)\);/g)) for (const quoted of call[1].matchAll(/'([a-z0-9_]+)'/g)) named.add(quoted[1]);
  const structures = new Set([...source.matchAll(/export const STRUCTURE_TYPES = \[([\s\S]*?)\];/g)].flatMap(m => [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1])));
  for (const id of named) assert.ok(Object.hasOwn(MOBS, id) || structures.has(id), `${id} is not a species`);
  const natural = new Set();
  for (const dimension of ['overworld', 'nether', 'end']) {
    const world = new World('spawn-paths', 5, dimension, { streaming: true }).generate(), mobs = new MobSystem(world, { mobs: [] });
    for (let x = 2; x < 96; x += 6) for (let z = 2; z < 96; z += 6) {
      const h = world.heightAt(x, z);
      for (const y of [h + 1, h + 3, 6, 12]) for (const night of [false, true]) for (const type of mobs.naturalTypes(x, y, z, night)) natural.add(type.id);
    }
  }
  assert.ok(natural.size >= 45, `only ${natural.size} species spawn naturally`);
});

test('pumpkins build golems and eggs hatch into their species', () => {
  const w = flat(), mobs = new MobSystem(w, { mobs: [] });
  w.set(10, 2, 10, B.SNOW); w.set(10, 1, 10, B.SNOW);
  assert.equal(mobs.checkBuild(10, 3, 10, B.PUMPKIN, {}), true);
  assert.equal(mobs.mobs.some(m => m.type === 'snow_golem'), true);
  for (const [dx, dy, dz] of [[0, -1, 0], [1, -1, 0], [-1, -1, 0], [0, -2, 0]]) w.set(20 + dx, 3 + dy, 20 + dz, B.IRON_BLOCK);
  w.set(20, 3, 20, B.PUMPKIN);
  assert.equal(mobs.checkBuild(20, 3, 20, B.PUMPKIN, {}), true);
  assert.equal(mobs.mobs.some(m => m.type === 'iron_golem'), true);
  w.set(30, 3, 30, B.SNIFFER_EGG);
  mobs.checkBuild(30, 3, 30, B.SNIFFER_EGG, {});
  mobs.tick(13, stateFor(w));
  assert.equal(mobs.mobs.some(m => m.type === 'sniffer'), true);
});

test('wandering traders, horse crosses, and hoglins in the overworld follow their rules', () => {
  const w = new World('mob-rules', 5).generate(), state = stateFor(w), mobs = state.mobs;
  state.player = { ...w.spawn, yaw: 0, pitch: 0 };
  mobs.mobs.length = 0; mobs.traderTimer = 300;
  mobs.tick(1, state);
  const trader = mobs.mobs.find(m => m.type === 'wandering_trader');
  assert.ok(trader); assert.equal(mobs.mobs.filter(m => m.type === 'trader_llama').length, 2);
  mobs.mobs.length = 0;
  const ground = world => { const x = Math.floor(world.spawn.x), z = Math.floor(world.spawn.z); return world.heightAt(x, z) + 1; };
  const gy = ground(w);
  const horse = mobs.spawn('horse', { x: Math.floor(w.spawn.x) + .5, y: gy, z: Math.floor(w.spawn.z) + .5 }, {}).mob, donkey = mobs.spawn('donkey', { x: Math.floor(w.spawn.x) + 2.5, y: gy, z: Math.floor(w.spawn.z) + .5 }, {}).mob;
  horse.love = 30; donkey.love = 30;
  for (let i = 0; i < 40; i++) mobs.tick(.05, state);
  assert.equal(mobs.mobs.some(m => m.type === 'mule'), true);
  mobs.mobs.length = 0;
  const hoglin = mobs.spawn('hoglin', { x: Math.floor(w.spawn.x) + 4.5, y: gy, z: Math.floor(w.spawn.z) + 4.5 }, { health: 40 }).mob;
  for (let i = 0; i < 400; i++) mobs.tick(.05, state);
  assert.equal(hoglin.type, 'zoglin');
});

test('ores are vein-shaped, buried, and banded by depth and biome', () => {
  const world = new World('ore-rules', 5, 'overworld', { streaming: true }).generate();
  const tally = new Map(), depths = new Map();
  let exposedRare = 0, rareTotal = 0, emeraldOutsideMountains = 0;
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 1; y < 110; y++) {
    const ref = BLOCKS[world.get(x, y, z)]?.reference;
    if (!ref?.endsWith('_ore')) continue;
    tally.set(ref, (tally.get(ref) || 0) + 1);
    const band = depths.get(ref) || [999, 0];
    depths.set(ref, [Math.min(band[0], y), Math.max(band[1], y)]);
    const rare = /diamond|emerald|gold|redstone|lapis/.test(ref);
    if (rare) {
      rareTotal++;
      const open = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
        .filter(([dx, dy, dz]) => [B.AIR, B.WATER].includes(world.get(x + dx, y + dy, z + dz))).length;
      // Terrain keeps veins buried; only a structure carving past one may reveal a
      // face, which is exactly how Minecraft's mineshaft walls look.
      if (open > 1) exposedRare++;
    }
    if (ref === 'emerald_ore' && !/peaks|mountain|meadow|snowy_taiga|cherry/.test(regionBiome(world, x, z, y))) emeraldOutsideMountains++;
  }
  const sum = pattern => [...tally.entries()].filter(([k]) => k.includes(pattern)).reduce((n, [, v]) => n + v, 0);
  assert.ok(sum('diamond') > 0, 'the rare ores exist at all');
  // Emerald is a mountain-only ore, so look for a world that has mountains.
  const mountainWorld = new World('mountains', 5, 'overworld', { streaming: true }).generate();
  let emerald = 0;
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 1; y < 110; y++) if (BLOCKS[mountainWorld.get(x, y, z)]?.reference === 'emerald_ore') emerald++;
  assert.ok(emerald > 0, 'emerald ore exists in mountain worlds');
  assert.ok(sum('coal') > sum('iron') && sum('iron') > sum('diamond'), 'ores get rarer as they get better');
  assert.ok(exposedRare <= rareTotal * .05, `${exposedRare}/${rareTotal} rare ore blocks sat open to the air`);
  const diamondDepths = [...depths.entries()].filter(([k]) => k.includes('diamond')).map(([, band]) => band);
  assert.ok(diamondDepths.length && Math.max(...diamondDepths.map(b => b[1])) <= 16, 'diamond stays in the deepslate band');
  assert.ok(emeraldOutsideMountains <= sum('emerald') * .05, 'emerald is a mountain ore');
  // veins, not speckles: each 4-block cell holds a cluster
  const cells = new Set();
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) for (let y = 1; y < 30; y++) if (BLOCKS[world.get(x, y, z)]?.reference === 'diamond_ore') cells.add(`${x >> 2},${y >> 2},${z >> 2}`);
  const diamond = sum('diamond');
  assert.ok(diamond / Math.max(1, cells.size) >= 2.5, 'diamond arrives in clusters of a few blocks');
});

test('the Nether is a 3D cavern with lava, biomes, and a safe arrival platform', () => {
  const world = new World('nether-cavern', 5, 'nether', { streaming: true }).generate();
  const p = world.spawn;
  assert.equal(BLOCKS[world.get(Math.floor(p.x), Math.floor(p.y) - 1, Math.floor(p.z))].name, 'Obsidian');
  assert.equal(BLOCKS[world.get(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))].name, 'Air');
  assert.equal(collides(world, p, 1.8, .3), false, 'the arrival spot is clear');
  let lava = 0, open = 0, standable = 0, columns = 0;
  for (const seed of ['nether-cavern', '999', 'alpha']) {
    const world = new World(seed, 5, 'nether', { streaming: true }).generate();
    for (let x = 1; x < 95; x++) for (let z = 1; z < 95; z++) {
      columns++;
      let floor = false;
      for (let y = 1; y < 127; y++) {
        const id = world.get(x, y, z);
        if (id === B.LAVA) lava++;
        else if (id === B.AIR) {
          open++;
          const below = world.get(x, y - 1, z);
          if (below !== B.AIR && below !== B.LAVA) floor = true;
        }
      }
      if (floor) standable++;
    }
  }
  assert.ok(lava > columns * .3, 'a lava sea fills the low ground');
  assert.ok(open / columns > 8, `open cavern space per column (${(open / columns).toFixed(1)})`);
  assert.ok(standable / columns > .25, `most columns have somewhere to stand (${(standable / columns * 100).toFixed(0)}%)`);
  // the cavern is bounded like Minecraft's: bedrock floor and ceiling
  assert.equal(world.get(40, 0, 40), B.BEDROCK);
  assert.equal(world.get(40, world.height - 1, 40), B.BEDROCK);
  const biome = terrainColumn(world, 48, 48).biome;
  assert.ok(['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest', 'basalt_deltas'].includes(biome));
});

test('mobs jump one-block ledges and passive animals never hurt the player', () => {
  const w = new World('mob-climb', 1);
  for (let x = 30; x <= 60; x++) for (let z = 30; z <= 60; z++) { w.raw(x, 0, z, B.BEDROCK); w.raw(x, 1, z, B.STONE); for (let y = 2; y < 8; y++) w.raw(x, y, z, B.AIR); }
  for (let x = 45; x <= 46; x++) for (let z = 30; z <= 60; z++) w.raw(x, 2, z, B.STONE);
  const state = stateFor(w), mobs = state.mobs;
  state.player = { x: 58, y: 2, z: 45, yaw: 0, pitch: 0 };
  for (const type of ['zombie', 'cow', 'pig']) {
    mobs.mobs.length = 0;
    const mob = mobs.spawn(type, { x: 32.5, y: 2, z: 45.5 }, { natural: true }).mob;
    let jumped = false, peak = mob.y;
    for (let i = 0; i < 1500; i++) {
      mob.brain = 999; mob.goal = { x: 55.5, y: 2, z: 45.5 }; mob.path = [{ x: 55.5, z: 45.5 }];
      mobs.tick(.05, state);
      if (mob.jumping > 0) jumped = true;
      peak = Math.max(peak, mob.y);
    }
    assert.ok(jumped, `${type} jumped the ledge`);
    assert.ok(peak >= 2.9, `${type} reached the top of the ledge (peak y=${peak.toFixed(2)})`);
  }
  // passive species deal no damage even when provoked
  mobs.mobs.length = 0;
  const events = [];
  mobs.emit = (type, detail) => { if (type === 'damage') events.push(detail); };
  for (const type of ['cow', 'pig', 'sheep', 'chicken', 'villager', 'horse', 'rabbit', 'cat']) {
    mobs.mobs.length = 0;
    const mob = mobs.spawn(type, { x: 34.5, y: 2, z: 45.5 }, { natural: true }).mob;
    mobs.hurt(mob, 1, 'player');
    const before = events.length;
    let fled = false;
    for (let i = 0; i < 200; i++) { mob.brain = 999; mobs.tick(.05, state); if (mob.flee > 0) fled = true; }
    assert.equal(events.length, before, `${type} never damaged the player`);
    assert.ok(fled || !mobs.mobs.includes(mob), `${type} ran away instead of fighting`);
  }
});

test('caverns are 3D: players dig into caves instead of walking over a hollow shell', () => {
  const world = new World('cave-shape', 5, 'overworld', { streaming: true }).generate();
  let columns = 0, withCave = 0, deepOpen = 0, deepTotal = 0, surfaceOpen = 0;
  for (let x = 2; x < 94; x++) for (let z = 2; z < 94; z++) {
    const h = terrainColumn(world, x, z).h;
    if (h < 30) continue;
    columns++;
    let found = false;
    for (let y = 5; y < 48; y++) {
      deepTotal++;
      if (world.get(x, y, z) === B.AIR) { deepOpen++; if (!found) { withCave++; found = true; } }
      if (y > h - 4 && world.get(x, y, z) === B.AIR) surfaceOpen++;
    }
  }
  assert.ok(withCave / columns > .45, `only ${(withCave / columns * 100).toFixed(0)}% of columns meet a cave`);
  assert.ok(deepOpen / deepTotal > .08, `the deep rock is ${(deepOpen / deepTotal * 100).toFixed(1)}% open`);
  assert.ok(surfaceOpen / columns < .6, 'the surface is not riddled with holes');
});
