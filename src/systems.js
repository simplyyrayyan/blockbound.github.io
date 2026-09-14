import { B, BLOCKS, ITEMS, RECIPES, freshItem, isSolid } from './catalog.js';
import { POTIONS, potionId } from './expansion.js';
import { Inventory } from './inventory.js';
import { insertStack, transferStack, matchCraftGrid } from './crafting.js';
import { enchantItem, enchantLevel } from './enchanting.js';
import { SIZE, HEIGHT, clamp } from './world.js';
import { MOBS } from './mob-catalog.js';

export const SMELTING = {
  raw_beef: 'steak', raw_porkchop: 'cooked_porkchop', raw_chicken: 'cooked_chicken', raw_mutton: 'cooked_mutton', raw_rabbit: 'cooked_rabbit', cod: 'cooked_cod', salmon: 'cooked_salmon', potato: 'baked_potato', kelp: 'dried_kelp',
  raw_iron: 'iron', raw_copper: 'copper', raw_gold: 'gold', iron_ore: 'iron', deepslate_iron_ore: 'iron', copper_ore: 'copper', deepslate_copper_ore: 'copper', gold_ore: 'gold', deepslate_gold_ore: 'gold', ancient_debris: 'netherite_scrap',
  sand: 'glass', red_sand: 'glass', cobblestone: 'stone', stone: 'smooth_stone', cobbled_deepslate: 'deepslate', clay_ball: 'brick_item', clay: 'terracotta', cactus: 'green_dye', netherrack: 'nether_brick', log: 'charcoal',
};
const FUEL = { coal: 48, charcoal: 48, coal_block: 480, lava_bucket: 480, stick: 3, bamboo: 2, blaze_rod: 72 };
const BREW = { nether_wart: 'awkward', glistering_melon_slice: 'healing', ghast_tear: 'regeneration', magma_cream: 'fire_resistance', blaze_powder: 'strength', sugar: 'swiftness', rabbit_foot: 'leaping', pufferfish: 'water_breathing', golden_carrot: 'night_vision', spider_eye: 'poison', phantom_membrane: 'slow_falling', turtle_helmet: 'turtle_master', stone: 'infestation', slime_block: 'oozing', cobweb: 'weaving', breeze_rod: 'wind_charging' };
const directions = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]];
const neighbors = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const position = index => ({ x: index % SIZE, y: Math.floor(index / (SIZE * SIZE)), z: Math.floor(index / SIZE) % SIZE });
const near = (a, b, range) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= range;
function take(slots, i, n = 1) { if (slots[i]) { slots[i].count -= n; if (slots[i].count <= 0) slots[i] = null; } }
function safeSlots(slots, count) { return Array.from({ length: count }, (_, i) => slots?.[i] && Inventory.validate([slots[i], ...Array(35).fill(null)]) ? structuredClone(slots[i]) : null); }
export function smeltingRecipe(id, station) {
  const result = SMELTING[id] || (/(_log|_wood|_stem)$/.test(id || '') ? 'charcoal' : null);
  if (!result) return null;
  const food = !!ITEMS[result]?.food;
  if (station === 'smoke' && !food || station === 'blast' && !/ore|raw_|ancient_debris/.test(id)) return null;
  return result;
}
export function brewingRecipe(bottle, ingredient) {
  const potion = ITEMS[bottle], type = potion?.potion;
  if (!type) return null;
  if (ingredient === 'gunpowder' && potion.delivery === 'drink') return potionId(type, 'splash');
  if (ingredient === 'dragon_breath' && potion.delivery === 'splash') return potionId(type, 'lingering');
  if (ingredient === 'fermented_spider_eye') {
    const corrupt = { water: 'weakness', healing: 'harming', poison: 'harming', swiftness: 'slowness', leaping: 'slowness', night_vision: 'invisibility' }[type];
    return corrupt ? potionId(corrupt, potion.delivery) : null;
  }
  const next = BREW[ingredient];
  return next && (type === 'water' && next === 'awkward' || type === 'awkward' && next !== 'awkward') ? potionId(next, potion.delivery) : null;
}

export class WorldSystems {
  constructor(world, saved = null) {
    this.world = world; this.machines = new Map(); this.active = new Map(); this.clock = 0; this.accumulator = 0; this.events = [];
    this.vehicles = []; this.decorations = []; this.clouds = []; this.serial = 0; this.revision = -1;
    for (let index = SIZE * SIZE; index < world.blocks.length; index++) this.track(index);
    if (saved) this.restore(saved);
  }
  track(index) {
    const def = BLOCKS[this.world.blocks[index]];
    if (def?.station || def?.container || def?.redstone || /door|gate|bulb|lamp|tnt|note_block|jukebox|beehive|bee_nest|potent_sulfur|respawn_anchor/.test(def?.reference || '')) this.active.set(index, def.reference);
    else this.active.delete(index);
  }
  machine(index, state = null) {
    const def = BLOCKS[this.world.blocks[index]];
    if (!def || !def.station && !def.container && !['jukebox', 'beehive', 'bee_nest', 'respawn_anchor'].includes(def.reference)) return null;
    if (this.machines.get(index)?.block !== this.world.blocks[index]) this.machines.delete(index);
    if (!this.machines.has(index)) {
      const count = ['smelt', 'blast', 'smoke'].includes(def.station) ? 3 : def.station === 'brew' ? 4 : def.container || 3;
      const p = position(index), initial = this.world.stateAt(p.x, p.y, p.z).contents;
      this.machines.set(index, { block: this.world.blocks[index], type: def.reference, station: def.station, slots: safeSlots(initial, count), fuel: 0, progress: 0, output: null, status: 'Idle' });
    }
    const m = this.machines.get(index);
    if (def.reference === 'ender_chest' && state) m.slots = state.enderStorage ||= Array(27).fill(null);
    return m;
  }
  open(index, state) {
    const p = position(index); if (!near(p, state.player, 7)) return null;
    const machine = this.machine(index, state);
    if (machine) this.world.setState(p.x, p.y, p.z, { open: true });
    return machine;
  }
  close(index) { const p = position(index); this.world.setState(p.x, p.y, p.z, { open: false }); }
  giveFromMachine(index, slot, state, single = false) {
    const m = this.machine(index, state); if (!m || !near(position(index), state.player, 7)) return false;
    return transferStack(m.slots, slot, state.inventory.slots, single ? 1 : Infinity);
  }
  putInMachine(index, sourceSlot, targetSlot, state, single = false) {
    const m = this.machine(index, state), item = state.inventory.slots[sourceSlot];
    if (!m || !item || !near(position(index), state.player, 7) || targetSlot < 0 || targetSlot >= m.slots.length) return false;
    if (['smelt', 'blast', 'smoke'].includes(m.station) && targetSlot === 2 || m.station === 'brew' && targetSlot === 3) return false;
    const target = [m.slots[targetSlot]], count = single ? 1 : item.count;
    const left = insertStack(target, { ...structuredClone(item), count });
    if (left === count) return false;
    take(state.inventory.slots, sourceSlot, count - left); m.slots[targetSlot] = target[0]; return true;
  }
  processFurnace(m, dt) {
    const result = smeltingRecipe(m.slots[0]?.id, m.station);
    const out = result && freshItem(result), capacity = out && insertStack([m.slots[2] && { ...m.slots[2] }], out) === 0;
    m.fuel = Math.max(0, m.fuel - dt);
    if (!result || !capacity) { m.progress = 0; m.status = result ? 'Output full' : 'Idle'; return; }
    if (m.fuel <= 0) {
      const id = m.slots[1]?.id, burn = FUEL[id] || (/planks|log|wood|stem/.test(id || '') ? 12 : 0);
      if (burn) { m.fuel = burn; take(m.slots, 1); if (id === 'lava_bucket') m.slots[1] = freshItem('bucket'); }
      else { m.status = 'No fuel'; return; }
    }
    m.duration = m.station === 'smelt' ? 6 : 3; m.progress += dt; m.status = 'Cooking';
    if (m.progress >= m.duration) { take(m.slots, 0); const slots = [m.slots[2]]; insertStack(slots, out); m.slots[2] = slots[0]; m.progress = 0; this.events.push({ type: 'xp', amount: 2 }); }
  }
  processBrewing(m, dt) {
    const result = brewingRecipe(m.slots[0]?.id, m.slots[1]?.id);
    if (!result || m.slots[3]) { m.progress = 0; m.status = m.slots[3] ? 'Output full' : 'Idle'; return; }
    if (m.fuel <= 0) { if (m.slots[2]?.id !== 'blaze_powder') { m.status = 'No blaze powder'; return; } take(m.slots, 2); m.fuel = 20; }
    m.duration = 8; m.progress += dt; m.status = 'Brewing';
    if (m.progress >= 8) { take(m.slots, 0); take(m.slots, 1); m.slots[3] = freshItem(result); m.fuel--; m.progress = 0; }
  }
  operate(index, state, options = {}) {
    const m = this.machine(index, state); if (!m || !near(position(index), state.player, 7)) return { ok: false, reason: 'Workstation out of reach' };
    const a = m.slots[0], b = m.slots[1]; let result;
    const fail = reason => ({ ok: false, reason });
    if (m.station === 'enchant') return enchantItem(state, options.itemIndex, options.enchantment);
    if (m.station === 'stonecut') {
      const id = options.recipe;
      if (!a || !ITEMS[id]?.block || !RECIPES.some(r => r.id === id && Object.keys(r.needs).length === 1 && r.needs[a.id])) return fail('Select a matching stonecutting recipe');
      result = freshItem(id, id.endsWith('_slab') ? 2 : 1);
    } else if (m.station === 'anvil') {
      if (!a) return fail('Add an item');
      result = structuredClone(a); result.count = 1;
      const label = String(options.name || '').trim().slice(0, 40); if (label) result.name = label;
      const ench = ITEMS[b?.id]?.enchantment;
      if (ench) {
        const fake = { ...state, inventory: new Inventory([result, ...Array(35).fill(null)]), mode: 'creative' };
        const applied = enchantItem(fake, 0, ench); if (!applied.ok) return applied; result = fake.inventory.slots[0];
      } else if (b?.id === a.id && a.durability) result.durability = Math.min(ITEMS[a.id].durability, a.durability + b.durability + Math.floor(ITEMS[a.id].durability * .05));
      else if (!label) return fail('Add a matching item, enchanted book, or a name');
      if (state.mode !== 'creative' && state.xp < 100) return fail('Requires 1 level');
    } else if (m.station === 'grind') {
      if (!a?.durability && !a?.enchantments) return fail('Add equipment');
      result = structuredClone(a); result.enchantments = Object.fromEntries(Object.entries(a.enchantments || {}).filter(([id]) => id.endsWith('_curse')));
      if (b?.id === a.id && a.durability) result.durability = Math.min(ITEMS[a.id].durability, a.durability + b.durability + 10);
    } else if (m.station === 'smith') {
      if (!a || !b) return fail('Add equipment and an ingot or trim material');
      result = structuredClone(a);
      const upgraded = a.id.replace(/^diamond_/, 'netherite_');
      if (a.id.startsWith('diamond_') && b.id === 'netherite_ingot' && ITEMS[upgraded]) { result.id = upgraded; result.durability = ITEMS[upgraded].durability; }
      else if (ITEMS[a.id]?.armorSlot && ['iron', 'gold', 'copper', 'diamond', 'emerald', 'amethyst', 'redstone', 'lapis', 'quartz', 'resin_brick'].includes(b.id)) { result.trim = b.id; result.trimPattern = options.pattern || 'sentry'; }
      else return fail('Incompatible smithing materials');
    } else if (m.station === 'loom') {
      if (!a?.id.includes('banner') || !b?.id.endsWith('_dye')) return fail('Add a banner and dye');
      result = { ...structuredClone(a), count: 1, pattern: options.pattern || 'stripe', dye: b.id.replace('_dye', '') };
    } else if (m.station === 'cartography') {
      if (!a?.id.includes('map') || !['paper', 'map', 'glass_pane'].includes(b?.id)) return fail('Add a map and paper, empty map, or glass pane');
      result = { ...structuredClone(a), id: 'filled_map', count: b.id === 'map' ? 2 : 1, mapScale: Math.min(4, (a.mapScale || 0) + (b.id === 'paper' ? 1 : 0)), locked: b.id === 'glass_pane' };
    } else if (m.station === 'fletch') {
      if (a?.id === 'arrow' && ITEMS[b?.id]?.potion) result = freshItem(`${ITEMS[b.id].potion}_tipped_arrow`, 4);
      else if (a?.id === 'stick' && b?.id === 'flint') result = freshItem('arrow', 4);
      else return fail('Add sticks and flint, or arrows and a potion');
    } else if (m.station === 'compost') {
      if (!a || !(ITEMS[a.id]?.food || ITEMS[a.id]?.category === 'nature')) return fail('Add plants or food');
      result = freshItem('bone_meal');
    } else if (m.station === 'craft') {
      const r = matchCraftGrid(m.slots, 3); if (!r) return fail('No matching recipe');
      const output = [m.output]; if (insertStack(output, freshItem(r.id, r.count))) return fail('Output full');
      for (let i = 0; i < 9; i++) if (m.slots[i]) take(m.slots, i); m.output = output[0]; return { ok: true };
    } else return fail('This workstation has no matching operation');
    const output = [m.slots[2]]; if (insertStack(output, result)) return fail('Output full');
    take(m.slots, 0); if (b && m.station !== 'stonecut' && m.station !== 'compost') take(m.slots, 1);
    m.slots[2] = output[0]; if (m.station === 'anvil' && state.mode !== 'creative') state.xp -= 100;
    if (m.station === 'grind') state.xp += 20;
    return { ok: true };
  }
  piston(index, powered, sticky) {
    const p = position(index), s = this.world.stateAt(p.x, p.y, p.z);
    if (!!s.extended === powered) return;
    const [dx, dy, dz] = directions[s.facing || 0], at = n => ({ x: p.x + dx * n, y: p.y + dy * n, z: p.z + dz * n });
    const front = at(1), get = q => this.world.get(q.x, q.y, q.z);
    if (powered) {
      let length = 1;
      while (length <= 12 && isSolid(get(at(length)))) { const q = at(length), id = get(q), d = BLOCKS[id]; if (id === B.BEDROCK || d.container || d.station || !Number.isFinite(d.time) || id === B.OBSIDIAN) return; length++; }
      if (length > 12 || !this.world.inside(at(length).x, at(length).y, at(length).z)) return;
      for (let n = length; n >= 2; n--) { const to = at(n), from = at(n - 1); this.world.set(to.x, to.y, to.z, get(from)); }
      this.world.set(front.x, front.y, front.z, B.PISTON_HEAD);
      this.world.setState(front.x, front.y, front.z, { facing: s.facing || 0, piston: index });
    } else {
      if (get(front) === B.PISTON_HEAD) this.world.set(front.x, front.y, front.z, B.AIR);
      const q = at(2), id = get(q), d = BLOCKS[id];
      if (sticky && isSolid(id) && d && !d.container && !d.station && Number.isFinite(d.time) && id !== B.OBSIDIAN) { this.world.set(front.x, front.y, front.z, id); this.world.set(q.x, q.y, q.z, B.AIR); }
    }
    this.world.setState(p.x, p.y, p.z, { extended: powered });
  }
  redstone(state) {
    const w = this.world, levels = new Map(), queue = [], source = (index, level) => { if ((levels.get(index) || 0) < level) { levels.set(index, level); queue.push(index); } };
    for (const [index, name] of this.active) {
      const p = position(index), s = w.stateAt(p.x, p.y, p.z); let power = 0;
      if (name === 'redstone_block') power = 15;
      if (name === 'lever' && s.on || name.endsWith('_button') && (s.until || 0) > this.clock) power = 15;
      if (/pressure_plate|tripwire/.test(name) && near({ ...p, y: p.y + .5 }, state.player, 1.25)) power = 15;
      if (name === 'daylight_detector') power = Math.round(Math.max(0, Math.sin(((8.67 + state.elapsed / 60) % 24 - 6) / 24 * Math.PI * 2)) * 15);
      if (name === 'trapped_chest' && s.open) power = 15;
      if (/sculk_sensor/.test(name) && state.moving && near(p, state.player, 8)) power = 15;
      if (name === 'target' && (s.until || 0) > this.clock) power = 15;
      if (name === 'redstone_torch' && !s.disabled) power = 15;
      if (name === 'repeater' || name === 'comparator') power = s.output || 0;
      if (name === 'observer') {
        const [dx, , dz] = directions[s.facing || 0], observed = w.get(p.x + dx, p.y, p.z + dz);
        if (s.observed !== undefined && s.observed !== observed) w.setState(p.x, p.y, p.z, { until: this.clock + .3 });
        w.setState(p.x, p.y, p.z, { observed }); if ((s.until || 0) > this.clock) power = 15;
      }
      if (power) source(index, power);
    }
    for (let i = 0; i < queue.length && i < 16384; i++) {
      const index = queue[i], p = position(index), level = levels.get(index), from = this.active.get(index);
      for (const [dx, dy, dz] of neighbors) {
        const x = p.x + dx, y = p.y + dy, z = p.z + dz, target = w.index(x, y, z);
        if (!w.inside(x, y, z) || !this.active.has(target)) continue;
        if (from === 'repeater' || from === 'comparator') { const s = w.stateAt(p.x, p.y, p.z), dir = directions[s.facing || 0]; if (dx !== dir[0] || dy !== 0 || dz !== dir[2]) continue; }
        if (this.active.get(target) === 'redstone_wire' && level > 1) source(target, from === 'redstone_wire' ? level - 1 : level);
      }
    }
    for (const [index, name] of this.active) {
      const p = position(index), s = w.stateAt(p.x, p.y, p.z);
      const around = neighbors.map(([dx, dy, dz]) => levels.get(w.index(p.x + dx, p.y + dy, p.z + dz)) || 0);
      const power = name === 'redstone_wire' ? levels.get(index) || 0 : Math.max(levels.get(index) || 0, ...around), powered = power > 0, rising = powered && !s.power;
      if (name === 'repeater' || name === 'comparator') {
        const [dx, , dz] = directions[s.facing || 0], backIndex = w.index(p.x - dx, p.y, p.z - dz);
        const container = this.machines.get(backIndex), input = levels.get(backIndex) || (container ? Math.floor(container.slots.filter(Boolean).length / container.slots.length * 14) + (container.slots.some(Boolean) ? 1 : 0) : 0);
        if (input !== s.input) w.setState(p.x, p.y, p.z, { input, changeAt: this.clock + (s.delay || .1) });
        else if ((s.changeAt || 0) <= this.clock) w.setState(p.x, p.y, p.z, { output: name === 'repeater' ? input ? 15 : 0 : input });
      }
      if (name === 'redstone_torch') { const [dx, , dz] = directions[s.facing || 0]; w.setState(p.x, p.y, p.z, { disabled: (levels.get(w.index(p.x - dx, p.y, p.z - dz)) || 0) > 0 }); }
      if (/door|fence_gate/.test(name) && (powered || s.power)) { w.setState(p.x, p.y, p.z, { open: powered }); if (BLOCKS[w.get(p.x, p.y + 1, p.z)]?.shape === 'door') w.setState(p.x, p.y + 1, p.z, { open: powered }); }
      if (name.includes('copper_bulb') && rising) w.setState(p.x, p.y, p.z, { lit: !s.lit });
      if (name === 'redstone_lamp') w.setState(p.x, p.y, p.z, { lit: powered });
      if (/^(sticky_)?piston$/.test(name)) this.piston(index, powered, name === 'sticky_piston');
      if (name === 'tnt' && rising && state.mobs.projectiles.length < 96) { w.set(p.x, p.y, p.z, B.AIR); state.mobs.projectiles.push({ uid: ++state.mobs.serial, type: 'tnt', x: p.x + .5, y: p.y + .5, z: p.z + .5, owner: 'player', life: 3 }); }
      if (rising && ['dispenser', 'dropper', 'crafter'].includes(name)) {
        const m = this.machine(index, state);
        if (name === 'crafter') this.operate(index, { ...state, player: p });
        else {
          const slot = m.slots.findIndex(Boolean), item = m.slots[slot], dir = directions[s.facing || 0];
          if (item) {
            const point = { x: p.x + .5 + dir[0], y: p.y + .5, z: p.z + .5 + dir[2] }, def = ITEMS[item.id];
            let used = false;
            if (name === 'dispenser' && def.spawn) used = state.mobs.spawn(def.spawn, point).ok;
            else if (name === 'dispenser' && /arrow|snowball|fire_charge|egg|wind_charge/.test(item.id)) used = state.mobs.shoot(item.id === 'fire_charge' ? 'fireball' : item.id.includes('arrow') ? 'arrow' : item.id, point, { x: point.x + dir[0] * 20, y: point.y, z: point.z + dir[2] * 20 }, 'player', 4);
            else used = state.mobs.addDrop(item.id, 1, point, item.durability);
            if (used) take(m.slots, slot);
          }
        }
      }
      if (name === 'note_block' && rising) this.events.push({ type: 'note', note: s.note || 0 });
      if (w.get(p.x, p.y, p.z)) w.setState(p.x, p.y, p.z, { power });
    }
  }
  toggle(hit) {
    const def = BLOCKS[hit.id], name = def.reference, w = this.world, s = w.stateAt(hit.x, hit.y, hit.z);
    if (['door', 'gate', 'trapdoor'].includes(def.shape)) {
      if (/iron|copper/.test(name)) return { handled: true, message: 'Requires redstone power' };
      w.setState(hit.x, hit.y, hit.z, { open: !s.open });
      if (def.shape === 'door') { const y = hit.y + (s.upper ? -1 : 1); if (w.get(hit.x, y, hit.z) === hit.id) w.setState(hit.x, y, hit.z, { open: !s.open }); }
      return { handled: true };
    }
    if (name === 'lever') { w.setState(hit.x, hit.y, hit.z, { on: !s.on }); return { handled: true }; }
    if (name.endsWith('_button')) { w.setState(hit.x, hit.y, hit.z, { until: this.clock + 1 }); return { handled: true }; }
    if (name === 'repeater') { w.setState(hit.x, hit.y, hit.z, { delay: ((s.delay || .1) + .1) % .5 || .1 }); return { handled: true }; }
    if (name === 'note_block') { w.setState(hit.x, hit.y, hit.z, { note: ((s.note || 0) + 1) % 25 }); this.events.push({ type: 'note', note: s.note || 0 }); return { handled: true }; }
    return { handled: false };
  }
  tick(dt, state) {
    this.clock += dt;
    if (this.revision !== this.world.revision) { for (const index of this.world.edits.keys()) this.track(index); this.revision = this.world.revision; }
    for (const [index, m] of this.machines) {
      if (this.world.blocks[index] !== m.block) { for (const item of m.slots.filter(Boolean)) state.mobs.addDrop(item.id, item.count, position(index), item.durability, item); this.machines.delete(index); continue; }
      if (['smelt', 'blast', 'smoke'].includes(m.station)) this.processFurnace(m, dt);
      if (m.station === 'brew') this.processBrewing(m, dt);
    }
    this.redstone(state);
    for (const [index, name] of this.active) if (name === 'hopper') {
      const p = position(index); if (this.world.stateAt(p.x, p.y, p.z).power) continue;
      const own = this.machine(index, state), above = this.machine(index + SIZE * SIZE, state), below = this.machine(index - SIZE * SIZE, state);
      if (above) { const slot = ['smelt', 'blast', 'smoke'].includes(above.station) ? 2 : above.slots.findIndex(Boolean); if (slot >= 0) transferStack(above.slots, slot, own.slots, 1); }
      else { const drop = state.mobs.drops.find(d => near(d, { x: p.x + .5, y: p.y + 1, z: p.z + .5 }, 1.1)); if (drop) { const left = insertStack(own.slots, freshItem(drop.id, 1)); if (!left && --drop.count <= 0) state.mobs.drops.splice(state.mobs.drops.indexOf(drop), 1); } }
      if (below) { const slot = own.slots.findIndex(Boolean); if (slot >= 0) transferStack(own.slots, slot, below.slots, 1); }
    }
    for (const cloud of [...this.clouds]) { cloud.life -= dt; if (cloud.life <= 0) this.clouds.splice(this.clouds.indexOf(cloud), 1); else if (Math.floor(this.clock * 2) !== cloud.lastTick) { cloud.lastTick = Math.floor(this.clock * 2); this.applyAreaEffect(cloud, state); } }
    for (const [index, name] of this.active) if (name === 'potent_sulfur') {
      const p = position(index); if (this.world.get(p.x, p.y + 1, p.z) !== B.WATER || !near(p, state.player, 5)) continue;
      state.effects.nausea = 3;
      if ([B.MAGMA_BLOCK, B.LAVA].includes(this.world.get(p.x, p.y - 1, p.z)) && (this.clock % 50 < 5 || this.world.get(p.x, p.y - 1, p.z) === B.LAVA)) state.player.vy = 12;
    }
    state.mobs.vehicles = this.vehicles; state.mobs.decorations = this.decorations; state.mobs.effectClouds = this.clouds;
  }
  applyAreaEffect(cloud, state) {
    if (near(cloud, state.player, cloud.radius)) this.events.push({ type: 'effect', effect: cloud.effect, duration: 15 });
    for (const mob of [...state.mobs.mobs]) if (near(cloud, mob, cloud.radius)) {
      if (cloud.effect === 'healing') mob.health = Math.min(MOBS[mob.type].health, mob.health + 4);
      else if (cloud.effect === 'harming') state.mobs.hurt(mob, 6, 'player');
      else mob.status = { type: cloud.effect, until: state.mobs.clock + 15 };
    }
  }
  update(dt, state) { this.accumulator += Math.min(.2, dt); if (this.accumulator >= .1) { const step = this.accumulator; this.accumulator = 0; this.tick(step, state); } }
  serialize() { return { clock: this.clock, serial: this.serial, machines: [...this.machines], vehicles: this.vehicles, decorations: this.decorations }; }
  restore(saved) {
    this.clock = Number.isFinite(saved.clock) ? clamp(saved.clock, 0, 1e9) : 0; this.serial = Number.isSafeInteger(saved.serial) ? saved.serial : 0;
    for (const pair of (Array.isArray(saved.machines) ? saved.machines : []).slice(0, 8192)) {
      if (!Array.isArray(pair)) continue;
      const [index, data] = pair; if (!Number.isInteger(index) || !data || index < SIZE * SIZE || index >= this.world.blocks.length || data.block !== this.world.blocks[index]) continue;
      const m = this.machine(index); if (!m) continue;
      m.slots = safeSlots(data.slots, m.slots.length); m.progress = clamp(Number(data.progress) || 0, 0, 30); m.fuel = clamp(Number(data.fuel) || 0, 0, 480); m.output = safeSlots([data.output], 1)[0];
    }
    const positioned = value => value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key])) && value.x >= 0 && value.x < SIZE && value.z >= 0 && value.z < SIZE && value.y > 0 && value.y < HEIGHT + 20;
    this.vehicles = (Array.isArray(saved.vehicles) ? saved.vehicles : []).filter(v => positioned(v) && ITEMS[v.item]?.vehicle).slice(0, 32).map(v => ({ ...v, storage: safeSlots(v.storage, 27) }));
    this.decorations = (Array.isArray(saved.decorations) ? saved.decorations : []).filter(positioned).slice(0, 128);
  }
}

export { position as blockPosition };
