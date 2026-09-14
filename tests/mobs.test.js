import test from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS, ITEMS, RECIPES, freshItem } from '../src/catalog.js';
import { World, collides } from '../src/world.js';
import { Inventory } from '../src/inventory.js';
import { MOBS, MOB_LIST, TRADES } from '../src/mob-catalog.js';
import { MobSystem, MOB_LIMIT } from '../src/mobs.js';
import { mobParts } from '../src/mob-models.js';
import { attackMob, useItem, equip, unequip, hitPlayer, updateEffects, defense, dropStack } from '../src/actions.js';
import { encodeSave, decodeSave } from '../src/save.js';

const requested = 'Allay,Armadillo,Axolotl,Bat,Bee,Blaze,Bogged,Breeze,Camel,Cat,Cave Spider,Chicken,Cod,Cow,Creaking,Creeper,Dolphin,Donkey,Drowned,Elder Guardian,Ender Dragon,Enderman,Endermite,Evoker,Fox,Frog,Ghast,Glow Squid,Goat,Guardian,Hoglin,Horse,Husk,Iron Golem,Llama,Magma Cube,Mooshroom,Mule,Ocelot,Panda,Parrot,Phantom,Pig,Piglin,Piglin Brute,Pillager,Polar Bear,Rabbit,Ravager,Salmon,Sheep,Shulker,Silverfish,Skeleton,Skeleton Horse,Slime,Sniffer,Snow Golem,Spider,Squid,Stray,Strider,Tadpole,Trader Llama,Tropical Fish,Turtle,Vex,Villager,Vindicator,Wandering Trader,Warden,Witch,Wither,Wither Skeleton,Wolf,Zoglin,Zombie,Zombie Horse,Zombie Villager,Zombified Piglin'.split(',');
function fixture(mode = 'survival') {
  const world = new World('mob-tests');
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) { world.raw(x, 0, z, B.BEDROCK); world.raw(x, 9, z, B.GRASS); world.heights[z * 96 + x] = 9; }
  for (let x = 30; x < 45; x++) for (let z = 30; z < 45; z++) for (let y = 10; y <= 12; y++) world.raw(x, y, z, B.WATER);
  const mobs = new MobSystem(world, { mobs: [] });
  return { id: 'mob-save', world, mobs, mode, inventory: new Inventory(), equipment: {}, effects: {}, player: { x: 20.5, y: 10, z: 20.5, yaw: 0, pitch: 0, vy: 0 }, selected: 0, health: 20, food: 20, xp: 0, elapsed: 700, progress: {}, attackCooldown: 0 };
}
const spawn = (s, type, x = 20.5, z = 18) => { const result = s.mobs.spawn(type, { x, y: 10, z }); assert.ok(result.ok, `${type}: ${result.reason}`); return result.mob; };
const tick = (s, seconds) => { for (let i = 0; i < seconds * 20; i++) { s.elapsed += .05; s.mobs.update(.05, s); } };
const hold = (s, id, count = 1) => { s.inventory.slots[0] = freshItem(id, count); s.selected = 0; };
const dir = { x: 0, y: 0, z: -1 };

test('all 80 requested species have eggs, detailed finite anatomy, valid drops and weapons', () => {
  assert.deepEqual(MOB_LIST.map(m => m.name).sort(), [...requested].sort());
  for (const d of MOB_LIST) {
    assert.equal(ITEMS[`${d.id}_spawn_egg`].spawn, d.id);
    const parts = mobParts(d.id); assert.ok(parts.length >= 6, d.id);
    for (const p of parts) for (const key of ['x', 'y', 'z', 'w', 'h', 'l']) assert.ok(Number.isFinite(p[key]), `${d.id}: ${key}`);
    for (const p of parts) assert.ok(p.w > 0 && p.h > 0 && p.l > 0, d.id);
    for (const loot of d.drops) assert.ok(ITEMS[loot.id], `${d.id}: ${loot.id}`);
    if (d.weapon) assert.ok(ITEMS[d.weapon], d.id);
  }
  assert.ok(Object.values(ITEMS).filter(d => !d.spawn).length >= 73);
  assert.ok(BLOCKS.length < 256);
});
test('all species spawn into valid space; aquatic species require water; population is bounded', () => {
  const s = fixture();
  for (const d of MOB_LIST) {
    s.mobs.mobs = [];
    const m = spawn(s, d.id, d.movement === 'swim' ? 36 : 20, d.movement === 'swim' ? 36 : 18);
    assert.equal(collides(s.world, m, d.height, Math.min(.85, d.width / 2)), false, d.id);
  }
  s.mobs.mobs = [];
  assert.equal(s.mobs.spawn('cod', { x: 10, y: 10, z: 10 }).ok, false);
  for (let i = 0; i < MOB_LIMIT; i++) spawn(s, 'chicken', 10 + i % 10, 10 + Math.floor(i / 10));
  assert.equal(s.mobs.spawn('cow', s.player).ok, false);
});
test('empty-hand interactions do not accidentally tame arbitrary mobs', () => {
  const s = fixture(), cow = spawn(s, 'cow');
  s.mobs.interact(cow, s); assert.equal(cow.tamed, undefined);
  s.mobs.think(cow, s); assert.notEqual(cow.activity, 'follow');
});
test('melee honors cooldown, weapon durability, death drops and pickup', () => {
  const s = fixture(), cow = spawn(s, 'cow'); hold(s, 'diamond_sword');
  assert.ok(attackMob(s, cow, dir)); assert.equal(cow.health, 3); assert.equal(s.inventory.slots[0].durability, ITEMS.diamond_sword.durability - 1);
  assert.equal(attackMob(s, cow, dir), false); s.attackCooldown = 0; attackMob(s, cow, dir);
  assert.ok(!s.mobs.mobs.includes(cow)); assert.ok(s.mobs.drops.some(d => d.id === 'raw_beef'));
  Object.assign(s.player, { x: cow.x, y: cow.y, z: cow.z }); tick(s, .1); assert.ok(s.inventory.count('raw_beef') > 0);
});
test('entity targeting and projectiles respect solid block occlusion', () => {
  const s = fixture(), zombie = spawn(s, 'zombie', 20.5, 15.5);
  const origin = { x: 20.5, y: 11.5, z: 20.5 };
  assert.equal(s.mobs.raycast(origin, dir, 8)?.mob, zombie);
  for (let y = 10; y <= 13; y++) s.world.raw(20, y, 18, B.STONE);
  assert.equal(s.mobs.raycast(origin, dir, 8), null);
  s.mobs.shoot('arrow', origin, { x: 20.5, y: 11.5, z: 15 }, 'player', 6);
  s.mobs.updateProjectiles(.2, s); assert.equal(zombie.health, 20); assert.equal(s.mobs.projectiles.length, 0);
  for (let y = 10; y <= 13; y++) s.world.raw(20, y, 18, B.AIR);
  s.mobs.shoot('arrow', origin, { x: 20.5, y: 11.5, z: 15 }, 'player', 6);
  for (let i = 0; i < 10; i++) s.mobs.updateProjectiles(.05, s);
  assert.equal(zombie.health, 14);
});
test('hostiles chase and damage survival players, while creative players are ignored', () => {
  const s = fixture(), zombie = spawn(s, 'zombie', 20.5, 18.5);
  tick(s, 4); assert.ok(s.mobs.events.some(e => e.type === 'damage'));
  const creative = fixture('creative'); spawn(creative, 'zombie'); tick(creative, 4); assert.ok(!creative.mobs.events.some(e => e.type === 'damage'));
  assert.ok(Number.isFinite(zombie.x));
});
test('skeletons shoot, creepers explode, and explosions preserve bedrock', () => {
  const s = fixture(); spawn(s, 'skeleton', 20.5, 11); tick(s, 1.5);
  assert.ok(s.mobs.projectiles.some(p => p.type === 'arrow') || s.mobs.events.some(e => e.type === 'damage'));
  s.mobs.mobs = []; const creeper = spawn(s, 'creeper', 20.5, 18.6); tick(s, 4);
  assert.ok(!s.mobs.mobs.includes(creeper)); assert.ok(s.mobs.events.some(e => e.type === 'blast'));
  s.mobs.explode({ x: 20, y: 1, z: 20 }); assert.equal(s.world.get(20, 0, 20), B.BEDROCK);
});
test('taming, saddling, riding, pet armor, milking, shearing, brushing and curing work', () => {
  const s = fixture(), wolf = spawn(s, 'wolf'); hold(s, 'bone', 3); s.mobs.interact(wolf, s); assert.ok(wolf.tamed); assert.equal(s.inventory.count('bone'), 2);
  hold(s, 'wolf_armor'); s.mobs.interact(wolf, s); assert.ok(wolf.petArmor);
  const horse = spawn(s, 'horse', 23, 20); hold(s, 'apple', 3); s.mobs.interact(horse, s); assert.ok(horse.tamed); hold(s, 'saddle'); s.mobs.interact(horse, s); assert.ok(horse.saddled); s.mobs.interact(horse, s); assert.equal(s.riding, horse.uid);
  const cow = spawn(s, 'cow', 24, 20); hold(s, 'bucket'); s.mobs.interact(cow, s); assert.equal(s.inventory.count('milk_bucket'), 1);
  const sheep = spawn(s, 'sheep', 25, 20); hold(s, 'shears'); s.mobs.interact(sheep, s); assert.equal(s.inventory.count('wool'), 3); s.mobs.interact(sheep, s); assert.equal(s.inventory.count('wool'), 3);
  const armadillo = spawn(s, 'armadillo', 26, 20); hold(s, 'brush'); s.mobs.interact(armadillo, s); assert.equal(s.inventory.count('armadillo_scute'), 1); s.mobs.interact(armadillo, s); assert.equal(s.inventory.count('armadillo_scute'), 1);
  const zombie = spawn(s, 'zombie_villager', 27, 20); hold(s, 'golden_apple'); s.mobs.interact(zombie, s); assert.equal(zombie.type, 'villager');
});
test('breeding produces one baby and applies cooldown to both parents', () => {
  const s = fixture(), a = spawn(s, 'cow', 20, 17), b = spawn(s, 'cow', 21, 17); hold(s, 'wheat', 4);
  s.mobs.interact(a, s); s.mobs.interact(b, s); tick(s, 1);
  assert.equal(s.mobs.mobs.filter(m => m.baby).length, 1); assert.ok(a.breedCooldown > 0 && b.breedCooldown > 0); assert.equal(s.inventory.count('wheat'), 2);
});
test('trades are atomic and require an actual nearby trader', () => {
  const s = fixture(), villager = spawn(s, 'villager'); hold(s, 'wheat', 12);
  assert.ok(s.mobs.trade(villager.uid, 0, s).ok); assert.equal(s.inventory.count('wheat'), 0); assert.equal(s.inventory.count('emerald'), 1);
  assert.equal(s.mobs.trade(villager.uid, 0, s).ok, false);
  s.player.x = 80; assert.equal(s.mobs.trade(villager.uid, 2, s).ok, false);
});
test('armor reduces damage and wears, equipment swaps are lossless, and a totem prevents death', () => {
  const s = fixture(); hold(s, 'diamond_chestplate'); assert.ok(equip(s)); assert.equal(s.inventory.slots[0], null); assert.equal(defense(s), 6);
  hitPlayer(s, 10); assert.ok(s.health > 10); assert.equal(s.equipment.chestplate.durability, ITEMS.diamond_chestplate.durability - 1);
  assert.ok(unequip(s, 'chestplate')); assert.equal(s.inventory.slots[0].id, 'diamond_chestplate');
  s.equipment.offhand = freshItem('totem'); hitPlayer(s, 100); assert.equal(s.health, 8); assert.equal(s.equipment.offhand, null);
});
test('projectile ammo, spawn eggs, food and potions consume only successful uses', () => {
  const s = fixture(); hold(s, 'bow'); assert.match(useItem(s, null, dir).message, /Need/); assert.equal(s.mobs.projectiles.length, 0);
  s.inventory.add('arrow', 4); useItem(s, null, dir); assert.equal(s.inventory.count('arrow'), 3); assert.equal(s.mobs.projectiles.length, 1);
  hold(s, 'cod_spawn_egg'); useItem(s, { adjacent: { x: 10, y: 10, z: 10 } }, dir); assert.equal(s.inventory.count('cod_spawn_egg'), 1);
  useItem(s, { adjacent: { x: 35, y: 10, z: 35 } }, dir); assert.equal(s.inventory.count('cod_spawn_egg'), 0);
  hold(s, 'healing_potion'); s.health = 5; useItem(s, null, dir); assert.equal(s.health, 13); assert.equal(s.inventory.count('healing_potion'), 0);
  hold(s, 'steak'); s.food = 3; useItem(s, null, dir); assert.equal(s.food, 11);
});
test('planted crops grow and harvest, and bone meal speeds growth', () => {
  const s = fixture(); const hit = { x: 21, y: 9, z: 20, id: B.GRASS, normal: { y: 1 } };
  hold(s, 'seeds', 2); useItem(s, hit, dir); assert.equal(s.mobs.crops.length, 1); hold(s, 'bone_meal'); useItem(s, hit, dir); assert.equal(s.mobs.crops[0].age, 30);
  s.inventory.slots[0] = null; useItem(s, hit, dir); assert.equal(s.inventory.count('wheat'), 2); assert.equal(s.mobs.crops.length, 0);
});
test('save roundtrips mobs, pets, drops, armor and crops without altering v1 terrain', () => {
  const s = fixture(); const wolf = spawn(s, 'wolf'); wolf.tamed = true; wolf.sitting = true; wolf.petArmor = true;
  s.equipment.helmet = freshItem('iron_helmet'); s.equipment.helmet.durability = 25; s.effects.speed = 10;
  s.mobs.addDrop('iron_sword', 1, wolf, 17); s.mobs.crops.push({ x: 21.5, y: 10, z: 20.5, harvest: 'wheat', age: 15 });
  const saved = decodeSave(encodeSave(s)), restored = new MobSystem(s.world, saved.entities);
  assert.equal(restored.mobs[0].tamed, true); assert.equal(restored.mobs[0].petArmor, true); assert.equal(restored.drops[0].durability, 17); assert.equal(saved.equipment.helmet.durability, 25); assert.equal(restored.crops[0].age, 15);
  const old = { ...JSON.parse(encodeSave(s)), version: 1 }; delete old.worldVersion; const decoded = decodeSave(JSON.stringify(old)); assert.equal(decoded.worldVersion, 1);
  assert.notDeepEqual(new World('old', 1).generate().blocks, new World('old', 2).generate().blocks);
  assert.deepEqual(new World('old', decoded.worldVersion).generate().blocks, new World('old', 1).generate().blocks);
});
test('a full inventory leaves ground loot intact and preserves worn dropped tools', () => {
  const s = fixture(); s.inventory = new Inventory(Array.from({ length: 36 }, () => freshItem('dirt', 64)));
  s.mobs.addDrop('iron_sword', 1, s.player, 11); tick(s, .1); assert.equal(s.mobs.drops.length, 1);
  s.inventory.slots[0] = null; tick(s, .1); assert.equal(s.inventory.slots[0].durability, 11); assert.equal(s.mobs.drops.length, 0);
});
test('every ranged hostile can shoot and all species simulate without invalid state', () => {
  for (const d of MOB_LIST) {
    const s = fixture(); const m = spawn(s, d.id, d.movement === 'swim' ? 36 : 20.5, d.movement === 'swim' ? 36 : 15);
    if (d.movement === 'swim') Object.assign(s.player, { x: 36, y: 11, z: 41 });
    if (d.ranged) m.angry = 20;
    const shots = [], shoot = s.mobs.shoot.bind(s.mobs); s.mobs.shoot = (...args) => { shots.push(args[0]); return shoot(...args); };
    tick(s, 3);
    if (d.ranged) assert.ok(shots.includes(d.ranged), `${d.name} never fired ${d.ranged}`);
    for (const entity of s.mobs.mobs) for (const key of ['x', 'y', 'z', 'yaw', 'health']) assert.ok(Number.isFinite(entity[key]), `${d.id}: ${key}`);
  }
});

test('special AI freezes observed Creaking, angers Endermen and splits slimes', () => {
  const s = fixture(), creaking = spawn(s, 'creaking'); s.mobs.think(creaking, s); assert.equal(creaking.activity, 'frozen');
  s.player.yaw = Math.PI; s.mobs.think(creaking, s); assert.equal(creaking.activity, 'chase');
  s.mobs.mobs = []; const enderman = spawn(s, 'enderman'); s.player.yaw = 0; s.mobs.think(enderman, s); assert.ok(enderman.angry > 0);
  const before = [enderman.x, enderman.z]; s.mobs.hurt(enderman, 1); assert.notDeepEqual([enderman.x, enderman.z], before);
  s.mobs.mobs = []; const slime = spawn(s, 'slime'); s.mobs.hurt(slime, 20); assert.equal(s.mobs.mobs.length, 2); assert.ok(s.mobs.mobs.every(m => m.scale === .5));
});
test('dropping equipment retains durability and refuses to delete it at the loot cap', () => {
  const s = fixture(); hold(s, 'iron_sword'); s.inventory.slots[0].durability = 13;
  assert.ok(dropStack(s, 0)); assert.equal(s.mobs.drops[0].durability, 13); assert.equal(s.inventory.slots[0], null);
  hold(s, 'iron_sword'); s.mobs.drops = Array.from({ length: 256 }, (_, i) => ({ id: 'dirt', count: 64, x: i % 96, y: 10, z: 5 }));
  assert.equal(dropStack(s, 0), false); assert.equal(s.inventory.slots[0].id, 'iron_sword');
});
test('fire resistance protects players and fireproof mobs from fire damage', () => {
  const s = fixture(); s.effects.fire_resistance = 20; assert.equal(hitPlayer(s, 6, 'fire'), false); assert.equal(s.health, 20);
  const blaze = spawn(s, 'blaze'); s.mobs.explode(blaze, 2, 10, 'player', 'fire'); assert.equal(blaze.health, 20);
  delete s.effects.fire_resistance; hitPlayer(s, 2, 'fire'); updateEffects(s, 1); assert.ok(s.health < 18);
});
test('malformed entity species and prototype item IDs cannot enter the game', () => {
  const s = fixture(); assert.equal(s.mobs.spawn('constructor', s.player).ok, false); assert.equal(s.inventory.add('__proto__', 1), 1);
  assert.equal(Inventory.validate([{ id: 'constructor', count: 1 }, ...Array(35).fill(null)]), false);
  const restored = new MobSystem(s.world, { mobs: [{ uid: 1, type: 'constructor', ...s.player, health: 10 }, { uid: 2, type: 'cow', x: null, y: 10, z: 20, health: 10 }], drops: [], crops: [] }); assert.equal(restored.mobs.length, 0);
});
test('mounting moves the player onto the mount, respects headroom, and Striders stand on lava', () => {
  const s = fixture('creative'), horse = spawn(s, 'horse');
  hold(s, 'saddle'); s.mobs.interact(horse, s); assert.ok(horse.saddled);
  s.mobs.interact(horse, s); assert.equal(s.riding, horse.uid); assert.equal(s.player.z, horse.z);
  s.riding = null; s.world.raw(Math.floor(horse.x), 12, Math.floor(horse.z), B.STONE);
  assert.match(s.mobs.interact(horse, s), /headroom/); assert.equal(s.riding, null);
  s.world.raw(25, 9, 25, B.LAVA);
  assert.equal(s.mobs.floor(25.5, 25.5, 10, 'strider'), 10);
  assert.equal(s.mobs.floor(25.5, 25.5, 10, 'pig'), null);
});
