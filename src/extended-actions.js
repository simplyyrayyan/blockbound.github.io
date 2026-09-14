import { B, BLOCKS, ITEMS, freshItem, isSolid } from './catalog.js';
import { DYES } from './expansion.js';
import { MOBS } from './mob-catalog.js';
import { collides, SIZE, clamp } from './world.js';
import { enchantLevel } from './enchanting.js';

export function applyEffect(state, effect, duration = 60) {
  if (!effect) return;
  if (effect === 'healing') state.health = Math.min(20, state.health + 8);
  else if (effect === 'harming') { if (state.mode !== 'creative') state.health = Math.max(0, state.health - 6); }
  else if (effect === 'turtle_master') { state.effects.slowness = duration; state.effects.resistance = duration; }
  else if (effect === 'enchanted_apple') { state.effects.regeneration = 30; state.effects.fire_resistance = 180; state.effects.resistance = 180; state.effects.absorption = 120; }
  else state.effects[effect] = Math.max(state.effects[effect] || 0, duration);
}
function ignitePortal(world, hit) {
  for (const axis of ['x', 'z']) for (let offset = -3; offset <= 0; offset++) for (let down = -4; down <= 0; down++) {
    const start = { x: hit.x, y: hit.y + down, z: hit.z, [axis]: hit[axis] + offset };
    let valid = start.y > 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      const p = { ...start, [axis]: start[axis] + i, y: start.y + j }, edge = i === 0 || i === 3 || j === 0 || j === 4;
      const id = world.get(p.x, p.y, p.z);
      if (edge ? id !== B.OBSIDIAN : ![B.AIR, B.FIRE, B.NETHER_PORTAL].includes(id)) valid = false;
    }
    if (valid) { for (let i = 1; i <= 2; i++) for (let j = 1; j <= 3; j++) { const p = { ...start, [axis]: start[axis] + i, y: start.y + j }; world.set(p.x, p.y, p.z, B.NETHER_PORTAL); } return true; }
  }
  return false;
}
function finishEndPortal(world, hit) {
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    const cx = hit.x + dx, cz = hit.z + dz;
    let valid = true;
    for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if ((Math.abs(x) === 2) !== (Math.abs(z) === 2)) {
      if (world.get(cx + x, hit.y, cz + z) !== B.END_PORTAL_FRAME || !world.stateAt(cx + x, hit.y, cz + z).eye) valid = false;
    }
    if (valid) { for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) world.set(cx + x, hit.y, cz + z, B.END_PORTAL); return true; }
  }
  return false;
}
export function useExtendedItem(state, hit, direction, entity, { consume, give }) {
  const stack = state.inventory.slots[state.selected], def = ITEMS[stack?.id], w = state.world, p = state.player, systems = state.systems;
  const done = message => ({ handled: true, message });
  const from = { x: p.x, y: p.y + 1.5, z: p.z };
  if (entity && def?.action === 'name') return { handled: true, panel: 'name', entity: entity.uid };
  if (entity && def?.action === 'dye' && entity.type === 'sheep') { entity.dye = stack.id.replace('_dye', ''); consume(); return done('Wool dyed'); }
  if (hit && def?.tool === 'axe') {
    const target = BLOCKS[hit.id].reference || BLOCKS[hit.id].item || '';
    const stripped = B[`STRIPPED_${target.toUpperCase()}`];
    if (stripped && /log|wood|stem|hyphae/.test(target)) { w.set(hit.x, hit.y, hit.z, stripped); consume(); return done(''); }
    if (/copper/.test(target)) {
      const next = target.replace(/^waxed_/, '').replace(/^oxidized_/, 'weathered_').replace(/^weathered_/, 'exposed_').replace(/^exposed_/, '');
      if (B[next.toUpperCase()] && next !== target) { w.set(hit.x, hit.y, hit.z, B[next.toUpperCase()]); consume(); return done('Copper scraped'); }
    }
  }
  if (hit && stack?.id === 'honeycomb') {
    const waxed = B[`WAXED_${BLOCKS[hit.id].reference?.toUpperCase()}`];
    if (waxed) { w.set(hit.x, hit.y, hit.z, waxed); consume(); return done('Copper waxed'); }
  }
  if (hit && def?.action === 'dye') {
    const target = BLOCKS[hit.id].reference, color = stack.id.replace('_dye', '');
    const family = ['wool', 'carpet', 'terracotta', 'glass', 'glass_pane', 'concrete', 'concrete_powder'].find(f => target === f || target.endsWith(`_${f}`));
    const id = family && B[`${color}_${family === 'glass' || family === 'glass_pane' ? `stained_${family}` : family}`.toUpperCase()];
    if (id) { w.set(hit.x, hit.y, hit.z, id); consume(); return done('Block dyed'); }
  }
  if (def?.action === 'hoe') {
    if (!hit || ![B.GRASS, B.DIRT, B.COARSE_DIRT, B.ROOTED_DIRT].includes(hit.id) || w.get(hit.x, hit.y + 1, hit.z)) return done('Requires uncovered soil');
    w.set(hit.x, hit.y, hit.z, B.FARMLAND); consume(); return done('');
  }
  if (hit && ['carrot', 'potato', 'beetroot_seeds'].includes(stack?.id) && hit.id === B.FARMLAND && !state.mobs.crops.some(c => c.x === hit.x + .5 && c.z === hit.z + .5)) {
    state.mobs.crops.push({ x: hit.x + .5, y: hit.y + 1, z: hit.z + .5, age: 0, harvest: stack.id === 'beetroot_seeds' ? 'beetroot' : stack.id }); consume(); return done('Planted');
  }
  if (def?.action === 'brush' && hit && [B.SUSPICIOUS_SAND, B.SUSPICIOUS_GRAVEL].includes(hit.id)) {
    const drops = ['angler_pottery_sherd', 'archer_pottery_sherd', 'arms_up_pottery_sherd', 'emerald', 'resin_clump'];
    give(drops[Math.floor(state.mobs.roll() * drops.length)]); consume(); w.set(hit.x, hit.y, hit.z, hit.id === B.SUSPICIOUS_SAND ? B.SAND : B.GRAVEL); return done('Relic recovered');
  }
  if (def?.action === 'ignite' && hit && hit.id === B.OBSIDIAN && ignitePortal(w, hit)) { consume(); return done('Portal ignited'); }
  if (def?.action === 'eye') {
    if (hit?.id === B.END_PORTAL_FRAME) { if (!w.stateAt(hit.x, hit.y, hit.z).eye) { w.setState(hit.x, hit.y, hit.z, { eye: true }); consume(); } return done(finishEndPortal(w, hit) ? 'End portal opened' : 'Eye placed'); }
    return { handled: true, panel: 'map', locate: 'stronghold' };
  }
  if (def?.action === 'spear') { state.spearCharge ||= { elapsed: 0, hits: new Set() }; return done(''); }
  if (def?.action === 'potion' && systems) {
    if (def.delivery === 'drink') { applyEffect(state, def.effect, 60); consume(); give('glass_bottle'); }
    else {
      const to = { x: from.x + direction.x * 18, y: from.y + direction.y * 18, z: from.z + direction.z * 18 };
      if (state.mobs.shoot('potion', from, to, 'player', 0)) { Object.assign(state.mobs.projectiles.at(-1), { effect: def.effect, delivery: def.delivery, color: def.color }); consume(); }
    }
    return done('');
  }
  if (def?.action === 'mob_bucket') {
    if (!hit) return done('Aim at a surface');
    const a = hit.adjacent;
    if (isSolid(w.get(a.x, a.y, a.z))) return done('Space occupied');
    const aquatic = MOBS[def.bucketMob]?.movement === 'swim';
    if (!MOBS[def.bucketMob]) return done('This bucket has no creature');
    if (aquatic && !w.inside(a.x, a.y, a.z)) return done('Outside world');
    const old = w.get(a.x, a.y, a.z);
    if (aquatic) w.set(a.x, a.y, a.z, B.WATER);
    const result = state.mobs.spawn(def.bucketMob, { x: a.x + .5, y: a.y, z: a.z + .5 }, stack.captured || {});
    if (!result.ok) { if (aquatic) w.set(a.x, a.y, a.z, old); return done(result.reason); }
    consume(); give('bucket'); return done('Creature released');
  }
  if (def?.action === 'powder_snow' && hit) { const a = hit.adjacent; if (!w.get(a.x, a.y, a.z) && w.set(a.x, a.y, a.z, B.POWDER_SNOW)) { consume(); give('bucket'); } return done(''); }
  if (def?.action === 'bucket' && hit?.id === B.POWDER_SNOW) { w.set(hit.x, hit.y, hit.z, B.AIR); consume(); give('powder_snow_bucket'); return done(''); }
  if (def?.action === 'clock') { const hour = (8.67 + state.elapsed / 60) % 24; return done(`${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor(hour % 1 * 60)).padStart(2, '0')}`); }
  if (['map', 'compass', 'recovery_compass'].includes(def?.action)) return { handled: true, panel: 'map', locate: def.action === 'recovery_compass' ? 'death' : def.action === 'compass' ? 'spawn' : def.locate };
  if (def?.action === 'spyglass') { state.zoom = !state.zoom; return done(''); }
  if (def?.action === 'rocket') {
    if (state.equipment.chestplate?.id === 'elytra' && !p.grounded) { state.boost = 3; consume(); return done(''); }
    if (state.mobs.shoot('firework', from, { x: p.x, y: p.y + 20, z: p.z }, 'player', 0)) { consume(); state.mobs.projectiles.at(-1).life = 1.5; }
    return done('');
  }
  if (def?.action === 'vehicle' && systems) {
    if (!hit || systems.vehicles.length >= 32) return done('No room for another vehicle');
    const a = hit.adjacent, floor = w.get(a.x, a.y - 1, a.z), water = floor === B.WATER || hit.id === B.WATER;
    if (def.vehicle === 'boat' && !water && w.get(a.x, a.y, a.z) !== B.WATER) return done('Boats need water');
    if (def.vehicle === 'cart' && !BLOCKS[hit.id]?.reference?.includes('rail') && !BLOCKS[floor]?.reference?.includes('rail')) return done('Minecarts need rails');
    const vehicle = { uid: ++systems.serial, item: stack.id, type: def.vehicle, x: a.x + .5, y: water ? a.y - .14 : a.y, z: a.z + .5, yaw: p.yaw, facing: Math.round((-p.yaw / (Math.PI / 2) + 4) % 4), storage: Array(27).fill(null) };
    systems.vehicles.push(vehicle); consume(); return done('');
  }
  if (['bundle', 'write', 'read', 'recipes'].includes(def?.action)) return { handled: true, panel: def.action, itemIndex: state.selected };
  if (['decoration', 'frame', 'armor_stand'].includes(def?.action) && systems) {
    if (!hit || systems.decorations.length >= 128) return done('No room for a decoration');
    const a = hit.adjacent;
    systems.decorations.push({ uid: ++systems.serial, item: stack.id, x: a.x + .5 - hit.normal.x * .45, y: a.y + .5 - hit.normal.y * .45, z: a.z + .5 - hit.normal.z * .45, facing: Math.round(p.yaw / (Math.PI / 2)), content: null }); consume(); return done('');
  }
  if (hit && systems) {
    const name = BLOCKS[hit.id].reference;
    if (name === 'jukebox') {
      const m = systems.machine(w.index(hit.x, hit.y, hit.z), state);
      if (def?.action === 'disc') { if (m.slots[0]) give(m.slots[0].id); m.slots[0] = freshItem(stack.id); consume(); state.music = { id: stack.id, started: systems.clock }; return done(ITEMS[m.slots[0].id].name); }
      if (m.slots[0]) { give(m.slots[0].id); m.slots[0] = null; state.music = null; return done('Disc ejected'); }
    }
    if (name === 'beehive' || name === 'bee_nest') {
      const s = w.stateAt(hit.x, hit.y, hit.z);
      if ((s.honey || 0) >= 3 && ['shears', 'glass_bottle'].includes(stack?.id)) { give(stack.id === 'shears' ? 'honeycomb' : 'honey_bottle', stack.id === 'shears' ? 3 : 1); consume(); w.setState(hit.x, hit.y, hit.z, { honey: 0 }); return done('Honey harvested'); }
    }
    if (name === 'respawn_anchor') {
      const s = w.stateAt(hit.x, hit.y, hit.z);
      if (stack?.id === 'glowstone' && (s.charges || 0) < 4) { w.setState(hit.x, hit.y, hit.z, { charges: (s.charges || 0) + 1 }); consume(); return done('Anchor charged'); }
      if (s.charges && w.dimension === 'nether') { state.spawnPoint = { x: hit.x + .5, y: hit.y + 1, z: hit.z + .5, dimension: 'nether' }; return done('Respawn point set'); }
      if (s.charges) { state.mobs.explode({ x: hit.x, y: hit.y, z: hit.z }, 3, 12); return done(''); }
    }
    if (BLOCKS[hit.id].shape === 'bed') {
      if (w.dimension !== 'overworld') { state.mobs.explode(hit, 3, 12); return done(''); }
      state.spawnPoint = { x: hit.x + .5, y: hit.y + 1, z: hit.z + .5, dimension: 'overworld' };
      const hour = (8.67 + state.elapsed / 60) % 24;
      if (hour < 6 || hour > 18) { state.elapsed += (30 - hour) % 24 * 60; state.health = Math.min(20, state.health + 5); return done('Respawn point set. Morning has arrived.'); }
      return done('Respawn point set');
    }
    if (['sign', 'hanging_sign'].includes(BLOCKS[hit.id].shape)) return { handled: true, panel: 'sign', block: { x: hit.x, y: hit.y, z: hit.z } };
  }
  return null;
}

export function updateSpear(state, dt, held) {
  if (!state.spearCharge) return;
  const item = state.inventory.slots[state.selected], def = ITEMS[item?.id];
  if (!held || def?.weapon !== 'spear') { state.spearCharge = null; return; }
  const charge = state.spearCharge; charge.elapsed += dt;
  if (charge.elapsed < .35 || charge.elapsed > 4 || (state.moveSpeed || 0) < 4.6) return;
  const p = state.player, forward = { x: -Math.sin(p.yaw), z: -Math.cos(p.yaw) };
  for (const m of [...state.mobs.mobs]) {
    const dx = m.x - p.x, dz = m.z - p.z, distance = Math.hypot(dx, dz), dot = (dx * forward.x + dz * forward.z) / Math.max(.01, distance);
    if (distance < 2 || distance > 4.5 || dot < .86 || charge.hits.has(m.uid)) continue;
    charge.hits.add(m.uid); state.mobs.hurt(m, def.damage + state.moveSpeed * .8 + enchantLevel(item, 'lunge'), 'player', forward);
  }
}
