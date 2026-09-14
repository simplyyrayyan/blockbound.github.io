import test from 'node:test';
import assert from 'node:assert/strict';
import { B, ITEMS, RECIPES, freshItem } from '../src/catalog.js';
import { World, SIZE, HEIGHT, raycast, collides } from '../src/world.js';
import { Inventory } from '../src/inventory.js';
import { miningInfo, mineBlock, placeBlock } from '../src/rules.js';
import { encodeSave, decodeSave } from '../src/save.js';

test('the same seed reproduces every voxel; a different seed produces a different world', () => {
  const first = new World('cedar-valley').generate();
  assert.deepEqual(first.blocks, new World('cedar-valley').generate().blocks);
  assert.notDeepEqual(first.blocks, new World('quiet-meadow').generate().blocks);
});

test('terrain has trees, water, caves, all ores, a safe spawn, and an unbroken bedrock floor', () => {
  for (const seed of ['cedar-valley', '73', 'a', 'diamonds', '']) {
    const world = new World(seed).generate(), found = new Set(world.blocks);
    for (const id of [B.GRASS, B.DIRT, B.STONE, B.SAND, B.LOG, B.LEAVES, B.WATER, B.COAL, B.IRON, B.GOLD, B.DIAMOND]) assert.ok(found.has(id), `${seed}: missing block ${id}`);
    assert.equal(collides(world, world.spawn), false, `${seed}: unsafe spawn`);
    let caveAir = 0;
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) { assert.equal(world.get(x, 0, z), B.BEDROCK); if (!world.get(x, 6, z)) caveAir++; }
    assert.ok(caveAir > 20);
  }
});

test('mining requires the right pickaxe tier and never breaks bedrock', () => {
  assert.equal(miningInfo(B.STONE, null).ok, false);
  assert.equal(miningInfo(B.LOG, null).ok, true);
  assert.equal(miningInfo(B.IRON, freshItem('wood_pick')).ok, false);
  assert.equal(miningInfo(B.IRON, freshItem('stone_pick')).ok, true);
  assert.equal(miningInfo(B.DIAMOND, freshItem('stone_pick')).ok, false);
  assert.equal(miningInfo(B.DIAMOND, freshItem('iron_pick')).ok, true);
  assert.equal(miningInfo(B.BEDROCK, freshItem('diamond_pick'), true).ok, false);
  assert.ok(miningInfo(B.STONE, freshItem('diamond_pick')).time < miningInfo(B.STONE, freshItem('wood_pick')).time);
});

test('mining removes one block, awards its drop, and wears out the actual selected tool', () => {
  const world = new World(), inv = new Inventory(); inv.add('stone_pick'); inv.slots[0].durability = 1;
  world.raw(10, 10, 10, B.IRON);
  const result = mineBlock(world, inv, { x: 10, y: 10, z: 10, id: B.IRON }, 0);
  assert.equal(result.ok, true); assert.equal(world.get(10, 10, 10), B.AIR); assert.equal(inv.count('iron'), 1); assert.equal(inv.slots[0], null); assert.equal(result.brokeTool, true);
  assert.equal(world.edits.get(world.index(10, 10, 10)), B.AIR);
});

test('a full inventory cannot destroy a block or its drop', () => {
  const world = new World(), inv = new Inventory(Array.from({ length: 36 }, () => freshItem('dirt', 64)));
  world.raw(10, 10, 10, B.LOG);
  assert.equal(mineBlock(world, inv, { x: 10, y: 10, z: 10, id: B.LOG }, 0).ok, false);
  assert.equal(world.get(10, 10, 10), B.LOG); assert.equal(world.edits.size, 0);
});

test('stacking returns overflow and respects the maximum stack size', () => {
  const inv = new Inventory(); assert.equal(inv.add('dirt', 130), 0); assert.deepEqual(inv.slots.slice(0, 3).map(s => s.count), [64, 64, 2]);
  assert.equal(inv.add('stone_pick', 2), 0); assert.equal(inv.slots[3].count, 1); assert.equal(inv.slots[4].count, 1);
  const full = new Inventory(Array.from({ length: 36 }, () => freshItem('stone', 64))); assert.equal(full.add('log', 9), 9); assert.equal(full.count('log'), 0);
});

test('moving stacks merges within capacity and swaps unlike items', () => {
  const inv = new Inventory(); inv.slots[0] = freshItem('dirt', 60); inv.slots[1] = freshItem('dirt', 8); inv.slots[2] = freshItem('log', 3);
  inv.move(1, 0); assert.equal(inv.slots[0].count, 64); assert.equal(inv.slots[1].count, 4);
  inv.move(2, 0); assert.equal(inv.slots[0].id, 'log'); assert.equal(inv.slots[2].count, 64);
});

test('crafting is atomic, including insufficient materials and insufficient space', () => {
  const recipe = RECIPES.find(r => r.id === 'planks');
  const inv = new Inventory(); assert.equal(inv.craft(recipe).ok, false); inv.add('log', 3);
  assert.equal(inv.craft(recipe).ok, true); assert.equal(inv.count('log'), 2); assert.equal(inv.count('planks'), 4);
  const full = new Inventory(Array.from({ length: 36 }, () => freshItem('dirt', 64))); full.slots[0] = freshItem('log', 64);
  const before = JSON.stringify(full.slots); assert.equal(full.craft(recipe).ok, false); assert.equal(JSON.stringify(full.slots), before);
  full.slots[0] = freshItem('log', 1); assert.equal(full.craft(recipe).ok, true); assert.equal(full.count('planks'), 4);
});

test('advanced tools require a nearby table; the beginner recipes can be hand-crafted', () => {
  const inv = new Inventory(); inv.add('stone', 3); inv.add('stick', 2);
  const recipe = RECIPES.find(r => r.id === 'stone_pick'); assert.equal(inv.craft(recipe).ok, false); assert.equal(inv.count('stone'), 3);
  assert.equal(inv.craft(recipe, true).ok, true); assert.equal(inv.count('stone_pick'), 1);
  const world = new World(); world.raw(10, 9, 10, B.TABLE);
  assert.equal(world.nearTable({ x: 11, y: 10, z: 11 }), true); assert.equal(world.nearTable({ x: 30, y: 10, z: 30 }), false);
});

test('every recipe consumes precisely its requirements and produces its advertised output', () => {
  for (const recipe of RECIPES) {
    const inv = new Inventory(); for (const [id, n] of Object.entries(recipe.needs)) inv.add(id, n);
    assert.equal(inv.craft(recipe, true).ok, true, recipe.id);
    assert.equal(inv.count(recipe.id), recipe.count);
    for (const id of Object.keys(recipe.needs)) assert.equal(inv.count(id), 0);
    assert.ok(Inventory.validate(inv.slots));
  }
});

test('voxel raycasting hits the correct cell and placement face in both directions', () => {
  const world = new World(); world.raw(5, 4, 3, B.STONE);
  let hit = raycast(world, { x: 1.5, y: 4.5, z: 3.5 }, { x: 1, y: 0, z: 0 });
  assert.equal(hit.x, 5); assert.deepEqual(hit.normal, { x: -1, y: 0, z: 0 }); assert.deepEqual(hit.adjacent, { x: 4, y: 4, z: 3 });
  hit = raycast(world, { x: 7.5, y: 4.5, z: 3.5 }, { x: -1, y: 0, z: 0 }); assert.deepEqual(hit.adjacent, { x: 6, y: 4, z: 3 });
  assert.equal(raycast(world, { x: 15, y: 4.5, z: 3.5 }, { x: -1, y: 0, z: 0 }, 2), null);
});

test('placing consumes exactly one item, rejects player overlap and occupied blocks, and supports creative infinity', () => {
  const world = new World(), inv = new Inventory(); inv.add('dirt', 2);
  const player = { x: 10.5, y: 10, z: 10.5 }, hit = { adjacent: { x: 12, y: 10, z: 10 } };
  assert.equal(placeBlock(world, inv, 0, hit, player).ok, true); assert.equal(inv.count('dirt'), 1); assert.equal(world.get(12, 10, 10), B.DIRT);
  assert.equal(placeBlock(world, inv, 0, hit, player).ok, false); assert.equal(inv.count('dirt'), 1);
  assert.equal(placeBlock(world, inv, 0, { adjacent: { x: 10, y: 10, z: 10 } }, player).ok, false);
  assert.equal(placeBlock(world, inv, 0, { adjacent: { x: 13, y: 10, z: 10 } }, player, true).ok, true); assert.equal(inv.count('dirt'), 1);
});

test('collisions include headroom, world boundaries, and ignore water', () => {
  const world = new World(), p = { x: 10.5, y: 10, z: 10.5 };
  world.raw(10, 11, 10, B.STONE); assert.equal(collides(world, p), true);
  world.raw(10, 11, 10, B.WATER); assert.equal(collides(world, p), false);
  assert.equal(collides(world, { x: .1, y: 10, z: 10 }), true);
});

test('save roundtrip preserves edits, inventory, tool durability, mode, and player state', () => {
  const world = new World('73').generate(), inventory = Inventory.starter();
  world.set(48, 18, 48, B.AIR); world.set(50, 30, 50, B.PLANKS); inventory.slots[0].durability = 32;
  const state = { id: 'save-test', world, inventory, mode: 'survival', player: { ...world.spawn, yaw: .4, pitch: -.2 }, selected: 0, health: 18, food: 16, xp: 38, elapsed: 95, progress: { planks: true } };
  const saved = decodeSave(encodeSave(state)); const restored = new World(saved.seed).generate(); restored.applyEdits(saved.edits);
  assert.deepEqual(restored.blocks, world.blocks); assert.deepEqual(saved.inventory, inventory.slots); assert.deepEqual(saved.player, state.player); assert.equal(saved.progress.planks, true);
});

test('malformed saves and bedrock edits are rejected', () => {
  assert.throws(() => decodeSave('{bad')); assert.throws(() => decodeSave('{}'));
  const world = new World(); assert.throws(() => world.applyEdits([[0, B.AIR]])); assert.throws(() => world.applyEdits([[world.blocks.length + 1, B.STONE]]));
  assert.equal(Inventory.validate(Array(36).fill({ id: 'diamond', count: -1 })), false);
  assert.equal(Inventory.validate(Array(36).fill({ id: 'wood_pick', count: 1, durability: -5 })), false);
});
