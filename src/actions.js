import { B, ITEMS, isSolid } from './catalog.js';
import { MOBS } from './mob-catalog.js';
import { clamp, collides, SIZE } from './world.js';

export function consumeHeld(state) {
  if (state.mode === 'creative') return;
  const item = state.inventory.slots[state.selected];
  if (!item) return;
  if (item.durability) { if (--item.durability <= 0) state.inventory.slots[state.selected] = null; }
  else if (--item.count <= 0) state.inventory.slots[state.selected] = null;
}
function give(state, id, count = 1) {
  const left = state.inventory.add(id, count);
  if (left) state.mobs.addDrop(id, left, state.player);
}
export function equip(state, slot = state.selected) {
  const item = state.inventory.slots[slot], def = ITEMS[item?.id];
  if (!def?.armorSlot) return false;
  const previous = state.equipment[def.armorSlot] || null;
  state.equipment[def.armorSlot] = item; state.inventory.slots[slot] = previous; return true;
}
export function unequip(state, slot) {
  const item = state.equipment[slot]; if (!item) return false;
  const index = state.inventory.slots.indexOf(null); if (index < 0) return false;
  state.inventory.slots[index] = item; state.equipment[slot] = null; return true;
}
export function dropStack(state, index) {
  const item = state.inventory.slots[index];
  if (!item) return false;
  const p = state.player, spot = { x: clamp(p.x - Math.sin(p.yaw) * 3, 1, SIZE - 1), y: p.y, z: clamp(p.z - Math.cos(p.yaw) * 3, 1, SIZE - 1) };
  if (!state.mobs.addDrop(item.id, item.count, spot, item.durability)) return false;
  state.inventory.slots[index] = null; return true;
}
export function defense(state) {
  return Math.min(20, Object.values(state.equipment).reduce((sum, item) => sum + (ITEMS[item?.id]?.defense || 0), 0));
}
export function hitPlayer(state, amount, effect = null) {
  if (state.mode === 'creative') return false;
  if (effect === 'fire' && state.effects.fire_resistance > 0) return false;
  state.health = Math.max(0, state.health - Math.max(.1, amount * (1 - defense(state) * .035)));
  if (effect) state.effects[effect] = Math.max(state.effects[effect] || 0, effect === 'levitation' ? 4 : 8);
  for (const [slot, item] of Object.entries(state.equipment)) if (item?.durability) { item.durability--; if (item.durability <= 0) state.equipment[slot] = null; }
  if (state.health <= 0 && state.equipment.offhand?.id === 'totem') { state.equipment.offhand = null; state.health = 8; state.effects = { regeneration: 20, fire_resistance: 20 }; state.mobs.emit('message', { message: 'Totem of undying activated' }); }
  return true;
}
export function attackMob(state, mob, direction) {
  if (state.attackCooldown > 0) return false;
  const held = state.inventory.slots[state.selected], def = ITEMS[held?.id];
  state.attackCooldown = def?.cooldown || .5;
  let damage = def?.damage || (def?.tool === 'axe' ? 5 : def?.tool ? 2 : 1);
  if (state.effects.strength > 0) damage += 3;
  if (held?.id === 'mace' && state.player.vy < -4) damage += Math.min(24, -state.player.vy * 2);
  state.mobs.hurt(mob, damage, 'player', direction);
  if (def?.durability) consumeHeld(state);
  return true;
}

export function useItem(state, hit, direction, entity = null) {
  const p = state.player, item = state.inventory.slots[state.selected], def = ITEMS[item?.id], system = state.mobs;
  const done = message => ({ handled: true, message });
  const from = { x: p.x, y: p.y + 1.5, z: p.z }, to = { x: from.x + direction.x * 25, y: from.y + direction.y * 25, z: from.z + direction.z * 25 };
  if (state.riding) { state.riding = null; return done('Dismounted'); }
  if (def?.spawn) {
    if (!hit) return done('Aim at a surface to spawn a mob');
    const result = system.spawn(def.spawn, { x: hit.adjacent.x + .5, y: hit.adjacent.y, z: hit.adjacent.z + .5 });
    if (result.ok) consumeHeld(state);
    return done(result.ok ? `${MOBS[def.spawn].name} spawned` : result.reason);
  }
  if (entity && !(def?.projectile || ['wind', 'fireball', 'snowball', 'potion'].includes(def?.action))) return { handled: true, result: system.interact(entity, state) };
  if (def?.armorSlot) { equip(state); return done(`${def.name} equipped`); }
  if (def?.projectile || ['wind', 'fireball', 'snowball'].includes(def?.action)) {
    if (state.attackCooldown > 0) return done('');
    if (def.ammo && state.mode !== 'creative' && !state.inventory.count(def.ammo)) return done(`Need ${ITEMS[def.ammo].name}`);
    if (system.shoot(def.projectile || def.action, from, to, 'player', def.damage || (def.action === 'fireball' ? 6 : 2))) {
      if (def.ammo && state.mode !== 'creative') state.inventory.remove(def.ammo, 1);
      consumeHeld(state); state.attackCooldown = def.cooldown || .6;
    }
    return done('');
  }
  if (def?.action === 'potion') {
    if (def.effect === 'poison') system.shoot('poison', from, to, 'player', 3);
    else if (def.effect === 'healing') state.health = Math.min(20, state.health + 8);
    else state.effects[def.effect] = 60;
    consumeHeld(state); give(state, 'glass_bottle'); return done(def.name);
  }
  if (def?.action === 'milk') { consumeHeld(state); state.effects = {}; give(state, 'bucket'); return done('Effects cleared'); }
  if (def?.food) {
    if (state.food >= 20 && !def.effect) return done('You are already full');
    state.food = Math.min(20, state.food + def.food);
    if (def.effect === 'cure') delete state.effects.poison;
    else if (def.effect) state.effects[def.effect] = 15;
    consumeHeld(state); if (def.shape === 'bowl') give(state, 'bowl'); return done('');
  }
  if (def?.action === 'pearl') {
    if (!hit) return done('Aim at a surface within reach');
    const spot = { ...p, x: hit.adjacent.x + .5, y: hit.adjacent.y, z: hit.adjacent.z + .5 };
    if (collides(state.world, spot)) return done('No safe landing space');
    Object.assign(p, spot, { vy: 0 }); consumeHeld(state); system.emit('damage', { amount: 3 }); return done('');
  }
  if (def?.action === 'horn') {
    for (const m of system.mobs) if (m.tamed) { m.sitting = false; m.leashed = true; }
    return done('Companions called');
  }
  if (def?.action === 'wither') {
    if (!hit) return done('Aim at soul sand');
    if (hit.id !== B.SOUL_SAND || state.inventory.count('wither_skull') < 3 && state.mode !== 'creative') return done('Requires soul sand and 3 wither skulls');
    const result = system.spawn('wither', { x: hit.x + .5, y: hit.y + 2, z: hit.z + .5 });
    if (result.ok && state.mode !== 'creative') state.inventory.remove('wither_skull', 3);
    return done(result.ok ? 'Wither summoned' : result.reason);
  }
  if (def?.action === 'ignite') {
    if (hit?.id === B.TNT && system.projectiles.length < 96) {
      state.world.set(hit.x, hit.y, hit.z, B.AIR); consumeHeld(state);
      system.projectiles.push({ uid: ++system.serial, type: 'tnt', x: hit.x + .5, y: hit.y + .5, z: hit.z + .5, life: 3, owner: 'player' }); return done('TNT ignited');
    }
    return done('Aim at TNT');
  }
  if (def?.action === 'egg') { if (hit && system.roll() < .25) system.spawn('chicken', { x: hit.adjacent.x + .5, y: hit.adjacent.y, z: hit.adjacent.z + .5 }, { baby: true, scale: .5 }); consumeHeld(state); system.shoot('snowball', from, to, 'player', 0); return done(''); }
  if (['bucket', 'bottle', 'fish'].includes(def?.action)) {
    let water = null;
    for (let step = 0; step < 7; step += .15) {
      const spot = { x: Math.floor(from.x + direction.x * step), y: Math.floor(from.y + direction.y * step), z: Math.floor(from.z + direction.z * step) };
      const id = state.world.get(spot.x, spot.y, spot.z);
      if ([B.WATER, B.LAVA].includes(id)) { water = { ...spot, id }; break; }
      if (isSolid(id)) break;
    }
    if (!water) return done('Aim at water');
    if (def.action === 'bucket') { consumeHeld(state); give(state, water.id === B.LAVA ? 'lava_bucket' : 'water_bucket'); state.world.set(water.x, water.y, water.z, B.AIR); }
    if (def.action === 'bottle') { if (water.id !== B.WATER) return done('Aim at water'); consumeHeld(state); give(state, 'glass_bottle'); return done('Bottle filled for brewing'); }
    if (def.action === 'fish') {
      if (state.fishingCooldown > 0) return done('The water is quiet');
      if (water.id !== B.WATER) return done('Fish need water');
      consumeHeld(state); give(state, system.roll() < .6 ? 'cod' : 'salmon'); state.fishingCooldown = 6; return done('Fish caught');
    }
    return done('Bucket filled');
  }
  if (['water', 'lava'].includes(def?.action)) {
    if (!hit || !state.world.inside(hit.adjacent.x, hit.adjacent.y, hit.adjacent.z)) return done('Aim at a nearby surface');
    const a = hit.adjacent;
    if (isSolid(state.world.get(a.x, a.y, a.z))) return done('That space is occupied');
    if (!state.world.set(a.x, a.y, a.z, def.action === 'water' ? B.WATER : B.LAVA)) return done('Cannot place fluid there');
    consumeHeld(state); give(state, 'bucket'); return done('');
  }
  if (def?.action === 'plant') {
    if (!hit || ![B.DIRT, B.GRASS].includes(hit.id) || hit.normal.y !== 1) return done('Plant on grass or dirt');
    const spot = { x: hit.x + .5, y: hit.y + 1, z: hit.z + .5 };
    if (system.crops.length >= 128 || system.crops.some(c => c.x === spot.x && c.z === spot.z && c.y === spot.y)) return done('That space is already planted');
    system.crops.push({ ...spot, age: 0, harvest: def.harvest }); consumeHeld(state); return done('Planted');
  }
  if (def?.action === 'fertilize') {
    const crop = hit && system.crops.find(c => Math.abs(c.x - hit.x - .5) < .2 && Math.abs(c.z - hit.z - .5) < .2);
    if (crop) { crop.age = 30; consumeHeld(state); return done('Crop ripened'); }
    if (hit?.id === B.GRASS) { give(state, 'seeds', 2); give(state, 'flower'); consumeHeld(state); return done('Plants gathered'); }
    return done('Aim at a crop or grass');
  }
  const crop = hit && system.crops.find(c => c.age >= 30 && c.x === hit.x + .5 && c.z === hit.z + .5 && c.y === hit.y + 1);
  if (crop) { give(state, crop.harvest, 2); give(state, 'seeds', 2); system.crops.splice(system.crops.indexOf(crop), 1); return done('Harvest collected'); }
  return { handled: false };
}

export function updateEffects(state, dt) {
  state.attackCooldown = Math.max(0, (state.attackCooldown || 0) - dt);
  state.fishingCooldown = Math.max(0, (state.fishingCooldown || 0) - dt);
  for (const key of Object.keys(state.effects)) {
    state.effects[key] -= dt; if (state.effects[key] <= 0) { delete state.effects[key]; continue; }
    if (state.mode === 'creative') continue;
    if (key === 'poison') state.health = Math.max(1, state.health - dt * .6);
    if (key === 'wither') state.health = Math.max(0, state.health - dt * .6);
    if (key === 'fire' && !state.effects.fire_resistance) state.health = Math.max(0, state.health - dt);
    if (key === 'regeneration') state.health = Math.min(20, state.health + dt * .8);
    if (key === 'hunger') state.food = Math.max(0, state.food - dt * .5);
    if (key === 'levitation') state.player.vy = 2;
  }
}
