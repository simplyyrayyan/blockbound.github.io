import { B, ITEMS, isSolid } from './catalog.js';
import { MOBS } from './mob-catalog.js';
import { clamp, collides, SIZE } from './world.js';
import { useExtendedItem, applyEffect } from './extended-actions.js';
import { enchantLevel, wearItem } from './enchanting.js';

export function consumeHeld(state) {
  if (state.mode === 'creative') return;
  const item = state.inventory.slots[state.selected];
  if (!item) return;
  if (item.durability) { if (wearItem(item)) state.inventory.slots[state.selected] = null; }
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
  if (previous && enchantLevel(previous, 'binding_curse') && state.mode !== 'creative') return false;
  state.equipment[def.armorSlot] = item; state.inventory.slots[slot] = previous; return true;
}
export function unequip(state, slot) {
  const item = state.equipment[slot]; if (!item) return false;
  if (enchantLevel(item, 'binding_curse') && state.mode !== 'creative') return false;
  const index = state.inventory.slots.indexOf(null); if (index < 0) return false;
  state.inventory.slots[index] = item; state.equipment[slot] = null; return true;
}
export function dropStack(state, index) {
  const item = state.inventory.slots[index];
  if (!item) return false;
  const p = state.player, spot = { x: clamp(p.x - Math.sin(p.yaw) * 3, 1, SIZE - 1), y: p.y, z: clamp(p.z - Math.cos(p.yaw) * 3, 1, SIZE - 1) };
  if (!state.mobs.addDrop(item.id, item.count, spot, item.durability, item)) return false;
  state.inventory.slots[index] = null; return true;
}
export function defense(state) {
  return Math.min(20, Object.values(state.equipment).reduce((sum, item) => sum + (ITEMS[item?.id]?.defense || 0), 0));
}
export function hitPlayer(state, amount, effect = null) {
  if (state.mode === 'creative') return false;
  if (effect === 'fire' && state.effects.fire_resistance > 0) return false;
  const protection = Object.values(state.equipment).reduce((sum, item) => sum + enchantLevel(item, 'protection') + (effect === 'fire' ? enchantLevel(item, 'fire_protection') * 2 : effect === 'blast' ? enchantLevel(item, 'blast_protection') * 2 : effect === 'projectile' ? enchantLevel(item, 'projectile_protection') * 2 : 0), 0);
  const difficulty = state.settings?.difficulty === 'easy' ? .6 : state.settings?.difficulty === 'hard' ? 1.4 : 1;
  state.health = Math.max(0, state.health - Math.max(.05, amount * difficulty * (1 - defense(state) * .035) * (1 - Math.min(20, protection) * .035) * (state.effects.resistance ? .4 : 1)));
  if (effect) state.effects[effect] = Math.max(state.effects[effect] || 0, effect === 'levitation' ? 4 : 8);
  for (const [slot, item] of Object.entries(state.equipment)) if (item?.durability && wearItem(item)) state.equipment[slot] = null;
  if (state.effects.infestation && state.mobs.roll() < .12) state.mobs.spawn('silverfish', state.player);
  for (const m of state.mobs.mobs) if (Math.hypot(m.x - state.player.x, m.z - state.player.z) < 2) {
    const thorns = Object.values(state.equipment).reduce((sum, i) => sum + enchantLevel(i, 'thorns'), 0); if (thorns && state.mobs.roll() < .15) state.mobs.hurt(m, thorns, 'player');
  }
  if (state.health <= 0 && state.equipment.offhand?.id === 'totem') { state.equipment.offhand = null; state.health = 8; state.effects = { regeneration: 20, fire_resistance: 20 }; state.mobs.emit('message', { message: 'Totem of undying activated' }); }
  return true;
}
export function attackMob(state, mob, direction) {
  if (state.attackCooldown > 0) return false;
  const held = state.inventory.slots[state.selected], def = ITEMS[held?.id];
  const range = Math.hypot(mob.x - state.player.x, mob.z - state.player.z);
  if (def?.weapon === 'spear' && (range < 2 || range > 4.7)) return false;
  state.attackCooldown = def?.cooldown || .5;
  let damage = def?.damage || (def?.tool === 'axe' ? 5 : def?.tool ? 2 : 1);
  if (state.effects.strength > 0) damage += 3;
  if (state.effects.weakness > 0) damage = Math.max(1, damage - 3);
  damage += enchantLevel(held, 'sharpness') * .7;
  if (/zombie|skeleton|wither|husk|drowned|phantom|zoglin/.test(mob.type)) damage += enchantLevel(held, 'smite') * 2.5;
  if (/spider|silverfish|endermite/.test(mob.type)) damage += enchantLevel(held, 'bane_of_arthropods') * 2.5;
  if (MOBS[mob.type].movement === 'swim') damage += enchantLevel(held, 'impaling') * 2.5;
  if (held?.id === 'mace' && state.player.vy < -4) damage += Math.min(24, -state.player.vy * 2);
  if (enchantLevel(held, 'fire_aspect')) mob.status = { type: 'fire', until: state.mobs.clock + 4 * enchantLevel(held, 'fire_aspect') };
  state.mobs.playerLooting = enchantLevel(held, 'looting');
  state.mobs.hurt(mob, damage, 'player', { x: direction.x * (1 + enchantLevel(held, 'knockback')), z: direction.z * (1 + enchantLevel(held, 'knockback')) });
  state.mobs.playerLooting = 0;
  if (enchantLevel(held, 'sweeping_edge')) for (const other of [...state.mobs.mobs]) if (other !== mob && Math.hypot(other.x - mob.x, other.z - mob.z) < 1.7) state.mobs.hurt(other, damage * .5, 'player');
  if (def?.weapon === 'spear' && enchantLevel(held, 'lunge')) state.dash = .2 + .1 * enchantLevel(held, 'lunge');
  if (def?.durability) consumeHeld(state);
  return true;
}

export function useItem(state, hit, direction, entity = null) {
  const p = state.player, item = state.inventory.slots[state.selected], def = ITEMS[item?.id], system = state.mobs;
  const done = message => ({ handled: true, message });
  const from = { x: p.x, y: p.y + 1.5, z: p.z }, to = { x: from.x + direction.x * 25, y: from.y + direction.y * 25, z: from.z + direction.z * 25 };
  if (state.riding) { state.riding = null; return done('Dismounted'); }
  if (state.vehicle) { state.vehicle = null; return done('Dismounted'); }
  const extended = useExtendedItem(state, hit, direction, entity, { consume: () => consumeHeld(state), give: (id, count) => give(state, id, count) });
  if (extended) return extended;
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
    const ammo = def.ammo && (state.inventory.slots.find(s => s && (s.id === 'arrow' || ITEMS[s.id].arrowEffect))?.id || def.ammo);
    const infinity = item?.id === 'bow' && enchantLevel(item, 'infinity');
    if (ammo && state.mode !== 'creative' && !state.inventory.count(ammo)) return done(`Need ${ITEMS[ammo].name}`);
    if (system.shoot(def.projectile || def.action, from, to, 'player', (def.damage || (def.action === 'fireball' ? 6 : 2)) + enchantLevel(item, 'power'))) {
      const projectile = system.projectiles.at(-1); projectile.effect = ITEMS[ammo]?.arrowEffect || (enchantLevel(item, 'flame') ? 'fire' : null); projectile.piercing = enchantLevel(item, 'piercing');
      if (enchantLevel(item, 'multishot')) for (const offset of [-3, 3]) system.shoot('arrow', from, { ...to, x: to.x + offset }, 'player', def.damage);
      if (ammo && !infinity && state.mode !== 'creative') state.inventory.remove(ammo, 1);
      consumeHeld(state); state.attackCooldown = (def.cooldown || .6) / (1 + enchantLevel(item, 'quick_charge') * .2);
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
    else if (def.effect === 'chorus') { const x = clamp(p.x + (system.roll() - .5) * 12, 2, SIZE - 2), z = clamp(p.z + (system.roll() - .5) * 12, 2, SIZE - 2), y = state.world.surface(x, z); if (!collides(state.world, { x, y, z })) Object.assign(p, { x, y, z, vy: 0 }); }
    else if (def.effect) applyEffect(state, def.effect, 15);
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
    if (def.action === 'bottle') { if (water.id !== B.WATER) return done('Aim at water'); consumeHeld(state); give(state, 'water_bottle'); return done('Water bottle filled'); }
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
    if (!hit || ![B.DIRT, B.GRASS, B.FARMLAND].includes(hit.id) || hit.normal.y !== 1) return done('Plant on grass, dirt, or farmland');
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
