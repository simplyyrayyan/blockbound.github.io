import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import assets from '../src/data/mob-assets.json' with { type: 'json' };
import { B, ITEMS, RECIPES, freshItem } from '../src/catalog.js';
import { World, collides, HEIGHT } from '../src/world.js';
import { Inventory } from '../src/inventory.js';
import { MobSystem } from '../src/mobs.js';
import { WorldSystems } from '../src/systems.js';
import { useItem, dropStack } from '../src/actions.js';
import { placeBlock, mineBlock } from '../src/rules.js';
import { craftGrid, fillCraftGrid } from '../src/crafting.js';
import { buildReferenceGeometry } from '../src/reference-mobs.js';
import { referencePose } from '../src/reference-poses.js';
import { encodeSave, decodeSave } from '../src/save.js';
import { buildChunkMesh } from '../src/chunk-mesh.js';
import { structureCandidates, STRUCTURE_BIOMES, terrainColumn } from '../src/terrain.js';

function fixture() {
  const world = new World('regression', 1);
  for (let x = 0; x < 35; x++) for (let z = 0; z < 35; z++) { world.raw(x, 0, z, B.BEDROCK); world.raw(x, 9, z, B.GRASS); }
  const mobs = new MobSystem(world, { mobs: [] }), systems = new WorldSystems(world);
  mobs.systems = systems;
  return { id: 'regressions', world, mobs, systems, inventory: new Inventory(), player: { x: 15.5, y: 10, z: 15.5, yaw: 0, pitch: 0 }, mode: 'survival', selected: 0, health: 20, food: 20, xp: 500, elapsed: 0, effects: {}, equipment: {}, progress: {} };
}

test('reference mob bodies meet their legs and every species has finite textured geometry', () => {
  assert.equal(Object.keys(assets).length, 84);
  for (const [id, source] of Object.entries(assets)) {
    const { geometry, bones } = buildReferenceGeometry(referencePose(id, source));
    assert.ok(geometry.attributes.position.count > 0, id);
    for (const attribute of Object.values(geometry.attributes)) assert.ok(Array.from(attribute.array).every(Number.isFinite), id);
    if (['cow', 'pig', 'chicken', 'sheep'].includes(id)) {
      const pos = geometry.attributes.position, skin = geometry.attributes.skinIndex, ranges = {};
      for (let i = 0; i < pos.count; i++) {
        const name = bones[skin.getX(i)].name.toLowerCase(), range = ranges[name] ||= [Infinity, -Infinity];
        range[0] = Math.min(range[0], pos.getY(i)); range[1] = Math.max(range[1], pos.getY(i));
      }
      assert.ok(ranges.body[0] >= .25, id + ' body below legs');
      assert.ok(ranges.body[0] <= ranges.leg0[1] + .06, id + ' detached body');
      assert.ok(ranges.head[0] <= ranges.body[1], id + ' detached head');
      assert.ok(Math.abs(ranges.leg0[0]) < .05, id + ' missing feet');
    }
    geometry.dispose();
  }
});

test('a walking skinned cow keeps its torso and leg joint attached', () => {
  const { geometry, bones, root } = buildReferenceGeometry(referencePose('cow', assets.cow));
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); mesh.add(root); mesh.bind(new THREE.Skeleton(bones));
  const leg = bones.find(b => b.name === 'leg0'), torso = bones.find(b => b.name === 'body');
  const before = torso.getWorldPosition(new THREE.Vector3()), joint = leg.getWorldPosition(new THREE.Vector3());
  leg.rotation.x = .6; mesh.updateMatrixWorld(true); mesh.skeleton.update();
  assert.ok(before.distanceTo(torso.getWorldPosition(new THREE.Vector3())) < 1e-8);
  assert.ok(joint.distanceTo(leg.getWorldPosition(new THREE.Vector3())) < 1e-8);
  mesh.skeleton.dispose(); geometry.dispose(); mesh.material.dispose();
});

test('pickup retains names, enchantments, durability, and the exact dropped amount', () => {
  const s = fixture(); s.inventory.slots[0] = { ...freshItem('iron_sword'), name: 'Kept', enchantments: { sharpness: 2 }, durability: 13 };
  assert.ok(dropStack(s, 0)); const loot = s.mobs.drops[0]; Object.assign(s.player, { x: loot.x, y: loot.y, z: loot.z });
  s.mobs.tick(.05, s); assert.deepEqual(s.inventory.slots[0], { id: 'iron_sword', count: 1, durability: 13, name: 'Kept', enchantments: { sharpness: 2 } });
  s.mobs.addDrop('log', 2, s.player, null, { id: 'log', count: 9 });
  assert.equal(s.mobs.drops[0].count, 2);
});

test('right-click toggles a lever and two-block doors without consuming the held item', () => {
  const s = fixture(); s.world.set(15, 10, 13, B.LEVER);
  const hit = { id: B.LEVER, x: 15, y: 10, z: 13, normal: { x: 0, y: 1, z: 0 }, adjacent: { x: 15, y: 11, z: 13 } };
  assert.ok(useItem(s, hit, { x: 0, y: 0, z: -1 }).handled); assert.equal(s.world.stateAt(15, 10, 13).on, true);
  s.inventory.add('oak_door', 1);
  assert.ok(placeBlock(s.world, s.inventory, 0, { id: B.GRASS, x: 17, y: 9, z: 13, normal: { x: 0, y: 1, z: 0 }, adjacent: { x: 17, y: 10, z: 13 } }, s.player).ok);
  assert.equal(s.world.get(17, 11, 13), B.OAK_DOOR);
  useItem(s, { x: 17, y: 10, z: 13, id: B.OAK_DOOR }, { x: 0, y: 0, z: -1 });
  assert.ok(s.world.stateAt(17, 10, 13).open); assert.ok(s.world.stateAt(17, 11, 13).open);
  mineBlock(s.world, s.inventory, { x: 17, y: 11, z: 13, id: B.OAK_DOOR }, 0, true);
  assert.equal(s.world.get(17, 10, 13), B.AIR);
});

test('splash and lingering potions apply their effects on impact', () => {
  for (const delivery of ['splash', 'lingering']) {
    const s = fixture(); s.inventory.add(delivery + '_poison_potion');
    const mob = s.mobs.spawn('zombie', { x: 15.5, y: 10, z: 11.5 }).mob;
    useItem(s, null, { x: 0, y: 0, z: -1 });
    for (let i = 0; i < 12; i++) s.mobs.updateProjectiles(.05, s);
    assert.equal(mob.status?.type, 'poison');
    assert.equal(s.systems.clouds.length, delivery === 'lingering' ? 1 : 0);
    assert.equal(s.inventory.count(delivery + '_poison_potion'), 0);
  }
});

test('enchanting uses station equipment and lapis atomically', () => {
  const s = fixture(); s.world.set(15, 10, 13, B.ENCHANTING_TABLE); const key = s.world.index(15, 10, 13), machine = s.systems.machine(key);
  machine.slots[0] = freshItem('iron_sword'); machine.slots[1] = freshItem('lapis', 4);
  assert.ok(s.systems.operate(key, s, { enchantment: 'sharpness' }).ok);
  assert.equal(machine.slots[0].enchantments.sharpness, 1); assert.equal(machine.slots[1].count, 3); assert.equal(s.xp, 400);
  const before = JSON.stringify(machine.slots); assert.equal(s.systems.operate(key, s, { enchantment: 'silk_touch' }).ok, false); assert.equal(JSON.stringify(machine.slots), before);
});

test('recipe book fills authentic sword patterns and preserves materials on failure', () => {
  const s = fixture(), grid = Array(9).fill(null), recipe = RECIPES.find(r => r.id === 'iron_sword');
  s.inventory.add('iron', 2); s.inventory.add('stick', 1);
  assert.ok(fillCraftGrid(recipe, grid, s.inventory, 3).ok);
  assert.equal(grid.filter(Boolean).length, 3);
  assert.ok(craftGrid(grid, s.inventory, 3).ok); assert.equal(s.inventory.count('iron_sword'), 1);
  const before = JSON.stringify(s.inventory.slots); assert.equal(fillCraftGrid(recipe, Array(4).fill(null), s.inventory, 2).ok, false); assert.equal(JSON.stringify(s.inventory.slots), before);
});

test('v5 terrain is deterministic, supported, and seamless across streamed chunk order', () => {
  const hashChunk = (w, x, z) => { w.ensureChunk(x, z); const values = []; for (let y = 0; y < HEIGHT; y++) for (let dz = 0; dz < 16; dz++) for (let dx = 0; dx < 16; dx++) values.push(w.get(x * 16 + dx, y, z * 16 + dz)); return createHash('sha256').update(Buffer.from(new Uint16Array(values).buffer)).digest('hex'); };
  for (const dimension of ['overworld', 'nether', 'end']) {
    const a = new World('781209', 5, dimension).generate(), b = new World('781209', 5, dimension).generate();
    assert.equal(collides(a, a.spawn), false); assert.equal(collides(a, { ...a.spawn, y: a.spawn.y - .05 }), true);
    const positions = [[-2, -1], [6, 3], [19, -3]]; for (const [x, z] of positions.toReversed()) b.ensureChunk(x, z);
    for (const [x, z] of positions) assert.equal(hashChunk(a, x, z), hashChunk(b, x, z), dimension);
    assert.equal(a.get(-16, 0, -10), dimension === 'end' ? B.AIR : B.BEDROCK);
  }
});

test('v5 structures respect biome, ocean depth, ground support, and End island rules', () => {
  const seenTypes = new Set();
  for (const dimension of ['overworld', 'nether', 'end']) {
    const w = new World('438529', 5, dimension);
    for (let x = -80; x < 80; x += 3) for (let z = -80; z < 80; z += 4) for (const s of structureCandidates(w, x, z)) {
      seenTypes.add(s.id); assert.equal(s.dimension, dimension);
      if (STRUCTURE_BIOMES[s.id]) assert.ok(STRUCTURE_BIOMES[s.id].includes(s.biome), s.id);
      if (s.id === 'ocean_monument') assert.ok(s.y + 5 < w.seaLevel);
      // End cities sit in the outer islands: past the 16-block void gap that
      // follows the central island (which ends 96 blocks from the middle).
      if (s.id === 'end_city') assert.ok(Math.hypot(s.x - 48, s.z - 48) >= 116);
      if (s.underground) assert.ok(s.y + 7 < terrainColumn(w, s.x, s.z).h);
    }
  }
  assert.ok(seenTypes.size >= 10, [...seenTypes].join(','));
});

test('v5 high and distant edits persist and legacy worlds retain their build height', () => {
  const s = fixture(); s.world = new World('96731', 5).generate(); s.player = { ...s.world.spawn, yaw: 0, pitch: 0 };
  s.world.set(-201, 100, 101, B.GLASS); s.world.setState(-201, 100, 101, { custom: true });
  const save = decodeSave(encodeSave(s)), w = new World(save.seed, save.worldVersion).generate(); w.applyEdits(save.edits); w.applyFarEdits(save.farEdits); w.applyFarStates(save.farBlockStates);
  assert.equal(w.get(-201, 100, 101), B.GLASS); assert.equal(w.stateAt(-201, 100, 101).custom, true);
  const old = new World('old', 4); assert.equal(old.height, 48); assert.equal(old.inside(10, 80, 10), false);
});

test('worker mesh data can be installed without discarding player edits', () => {
  const main = new World('1234', 5), worker = new World('1234', 5);
  worker.ensureChunk(-1, 1); const blocks = worker.terrainChunks.get('-1,1');
  main.set(-10, 90, 20, B.GLASS); main.acceptChunk(-1, 1, blocks);
  assert.equal(main.get(-10, 90, 20), B.GLASS);
  const mesh = buildChunkMesh(main, -1, 1); assert.ok(mesh.buffers.some(b => b.indices.length));
  for (const buffer of mesh.buffers) { assert.equal(buffer.positions.length / 3, buffer.normals.length / 3); assert.equal(buffer.positions.length / 3, buffer.uvs.length / 2); for (const i of buffer.indices) assert.ok(i < buffer.positions.length / 3); }
});
