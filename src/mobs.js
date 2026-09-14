import PF from 'pathfinding';
import { MOBS, MOB_LIST, TRADES } from './mob-catalog.js';
import { B, ITEMS, freshItem, isSolid } from './catalog.js';
import { SIZE, HEIGHT, SEA, clamp, hash, collides, raycast } from './world.js';
import { Inventory } from './inventory.js';
import { habitatFor } from './regions.js';

export const MOB_LIMIT = 64;
export const NATURAL_LIMIT = 28;
export const PROJECTILE_LIMIT = 96;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true });
const friendly = m => m.tamed || MOBS[m.type].temperament === 'guardian';
const waterAt = (world, p) => world.get(Math.floor(p.x), Math.floor(p.y + .2), Math.floor(p.z)) === B.WATER;
const projectileColor = { fireball: '#f6ae46', arrow: '#bca382', trident: '#77cecb', poison: '#9bbe69', poison_arrow: '#9bbe69', slow_arrow: '#91c6db', wind: '#c1ece7', beam: '#e8cb91', fangs: '#c9c8b9', dragon_breath: '#c17dd8', wither_skull: '#777b82', shulker_bullet: '#dab8df', sonic: '#6eddd4', spit: '#eae7df', snowball: '#ecf3ef' };
const railDirections = facing => [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }][facing % 4];

function rayBox(origin, dir, min, max) {
  let lo = 0, hi = Infinity;
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(dir[axis]) < 1e-8) { if (origin[axis] < min[axis] || origin[axis] > max[axis]) return null; continue; }
    const a = (min[axis] - origin[axis]) / dir[axis], b = (max[axis] - origin[axis]) / dir[axis];
    lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return null;
  }
  return lo;
}

export class MobSystem {
  constructor(world, saved = null) {
    this.world = world; this.mobs = []; this.drops = []; this.projectiles = []; this.crops = [];
    this.events = []; this.serial = 0; this.clock = 0; this.accumulator = 0; this.spawnTimer = 0;
    if (saved) this.restore(saved); else this.populate();
  }
  emit(type, detail = {}) { this.events.push({ ...detail, type }); }
  roll(salt = 0) { return hash(++this.serial, salt, Math.floor(this.clock * 10), this.world.number); }
  fits(type, x, y, z) {
    const d = MOBS[type];
    return !collides(this.world, { x, y, z }, d.height, Math.min(.85, d.width / 2));
  }
  floor(x, z, y, type) {
    for (let dy = 1; dy >= -4; dy--) {
      const ny = Math.floor(y) + dy;
      const support = this.world.get(Math.floor(x), ny - 1, Math.floor(z));
      if ((isSolid(support) || type === 'strider' && support === B.LAVA) && this.fits(type, x, ny, z)) return ny;
    }
    return null;
  }
  spawn(type, position, options = {}) {
    const d = MOBS[type];
    if (!Object.hasOwn(MOBS, type)) return { ok: false, reason: 'Unknown mob species' };
    if (!position || !['x', 'y', 'z'].every(key => Number.isFinite(position[key]))) return { ok: false, reason: 'Invalid spawn position' };
    if (this.mobs.length >= MOB_LIMIT) return { ok: false, reason: `Mob limit reached (${MOB_LIMIT})` };
    let spot = null;
    for (let r = 0; r <= 5 && !spot; r++) for (let i = 0; i < (r ? 12 : 1); i++) {
      const a = i / 12 * Math.PI * 2;
      const x = clamp(position.x + Math.sin(a) * r, 2, SIZE - 2), z = clamp(position.z + Math.cos(a) * r, 2, SIZE - 2);
      if (d.movement === 'swim') {
        for (let y = Math.min(SEA, HEIGHT - 2); y >= 2; y--) if (waterAt(this.world, { x, y, z }) && this.fits(type, x, y, z)) { spot = { x, y: y + .05, z }; break; }
      } else if (d.movement === 'fly' || d.movement === 'hover') {
        const desired = position.y + 1;
        const y = clamp(this.fits(type, x, desired, z) ? desired : this.world.surface(x, z) + 1, 2, HEIGHT + 8);
        if (this.fits(type, x, y, z)) spot = { x, y, z };
      } else {
        const y = this.floor(x, z, position.y, type) ?? this.world.surface(x, z);
        if (y < HEIGHT && this.fits(type, x, y, z) && (d.amphibious || !waterAt(this.world, { x, y, z }))) spot = { x, y, z };
      }
      if (spot) break;
    }
    if (!spot) return { ok: false, reason: d.movement === 'swim' ? 'This mob needs a pool of water' : 'Not enough room for this mob' };
    const mob = { uid: ++this.serial, type, ...spot, health: d.health, yaw: this.roll() * Math.PI * 2, age: 0, cooldown: 1, brain: 0, activity: 'idle', angry: 0, love: 0, breedCooldown: 0, produce: 15 + this.roll() * 20, scale: 1, ...options };
    this.mobs.push(mob);
    return { ok: true, mob };
  }
  populate() {
    if (this.world.structures?.length) for (const structure of this.world.structures) for (const spawn of structure.spawns || []) {
      if (this.mobs.length >= MOB_LIMIT) break;
      this.spawn(spawn.type, spawn, { structure: structure.id, natural: true });
    }
    if (this.world.dimension === 'end' && this.mobs.length < MOB_LIMIT) this.spawn('ender_dragon', { x: 48.5, y: 28, z: 48.5 }, { natural: true });
    for (const [type, dx, dz] of [['sheep', -3, 5], ['cow', 5, 4], ['pig', -5, 7], ['chicken', 3, 6], ['villager', -7, -5], ['wolf', -11, 5], ['horse', 10, 8], ['bee', -5, -8]]) this.spawn(type, { x: 48.5 + dx, y: 23, z: 48.5 + dz }, { natural: true });
    for (let i = 0; i < 110 && this.mobs.length < 24; i++) {
      const x = 4 + this.roll() * (SIZE - 8), z = 4 + this.roll() * (SIZE - 8), biome = habitatFor(this.world, x, this.world.surface(x, z), z);
      const candidates = MOB_LIST.filter(d => !d.boss && d.temperament !== 'hostile' && (d.habitat === biome || biome === 'water' && d.movement === 'swim' || biome === 'sulfur_caves' && d.id === 'sulfur_cube'));
      const d = candidates[Math.floor(this.roll() * candidates.length)];
      if (d) this.spawn(d.id, { x, y: this.world.surface(x, z), z }, { natural: true });
    }
  }
  raycast(origin, dir, max = 6) {
    const block = raycast(this.world, origin, dir, max);
    let nearest = block ? block.distance : max, result = null;
    for (const m of this.mobs) {
      const d = MOBS[m.type], w = d.width * m.scale / 2, h = d.height * m.scale;
      const t = rayBox(origin, dir, { x: m.x - w, y: m.y, z: m.z - w }, { x: m.x + w, y: m.y + h, z: m.z + w });
      if (t !== null && t < nearest) { nearest = t; result = { mob: m, distance: t }; }
    }
    return result;
  }
  vehicleRaycast(origin, dir, max = 6) {
    let result = null, nearest = max;
    const slab = (min, maxv, o, d) => Math.abs(d) < 1e-8 ? (o >= min && o <= maxv ? [0, Infinity] : null) : [Math.min((min - o) / d, (maxv - o) / d), Math.max((min - o) / d, (maxv - o) / d)];
    for (const vehicle of this.vehicles || []) {
      let lo = 0, hi = Infinity; for (const axis of ['x', 'y', 'z']) { const interval = slab(vehicle[axis] - .7, vehicle[axis] + .7, origin[axis], dir[axis]); if (!interval) { lo = 1; hi = 0; break; } lo = Math.max(lo, interval[0]); hi = Math.min(hi, interval[1]); }
      if (lo <= hi && lo < nearest) { nearest = Math.max(0, lo); result = { vehicle, distance: nearest }; }
    }
    return result;
  }
  addDrop(id, count, p, durability = null, metadata = null) {
    if (!Object.hasOwn(ITEMS, id) || !Number.isInteger(count) || count < 1) return false;
    const stack = !ITEMS[id].durability && !metadata && this.drops.find(d => d.id === id && distance(d, p) < 2 && d.count + count <= 64);
    if (stack) stack.count += count;
    else if (this.drops.length < 256) this.drops.push({ uid: ++this.serial, id, count, x: p.x, y: p.y + .25, z: p.z, age: 0, ...(Number.isFinite(durability) ? { durability } : {}), ...(metadata ? structuredClone(metadata) : {}) });
    else return false;
    return true;
  }
  hurt(m, amount, source = 'player', knock = null) {
    if (!this.mobs.includes(m)) return;
    const d = MOBS[m.type];
    if (m.rolled) amount *= .2;
    if (m.petArmor) amount *= .5;
    m.health -= amount; m.hurt = .25;
    if (!['sun', 'water', 'lava', 'dry', 'poison'].includes(source)) { m.angry = 15; m.flee = d.temperament === 'passive' ? 4 : 0; }
    if (d.groupAnger) for (const ally of this.mobs) if (ally.type === m.type && distance(ally, m) < 12) ally.angry = 20;
    if (source === 'player') for (const pet of this.mobs) if (pet.tamed && MOBS[pet.type].defender) pet.enemy = m.uid;
    if (d.teleport && m.health > 0) this.teleport(m);
    if (knock) this.moveGround(m, knock.x * .4, knock.z * .4);
    if (m.health > 0) return;
    this.mobs.splice(this.mobs.indexOf(m), 1);
    for (const loot of d.drops) if (this.roll() <= loot.chance && !(m.sheared && loot.id === d.shear)) this.addDrop(loot.id, loot.min + Math.floor(this.roll() * (loot.max - loot.min + 1)) + (this.playerLooting || 0), m);
    if (m.saddled) this.addDrop('saddle', 1, m);
    if (m.harnessed) this.addDrop('happy_ghast_harness', 1, m);
    if (m.nautilusArmor) this.addDrop(m.nautilusArmor, 1, m);
    if (m.petArmor) this.addDrop('wolf_armor', 1, m);
    if (d.split && m.scale > .6) for (let i = 0; i < 2; i++) this.spawn(m.type, { x: m.x + (i ? .6 : -.6), y: m.y, z: m.z }, { scale: .5, health: 4, angry: 10 });
    if (source === 'player' || source === 'pet') this.emit('xp', { amount: d.xp });
    this.emit('death', { mob: m });
  }
  teleport(m) {
    for (let i = 0; i < 8; i++) {
      const x = clamp(m.x + (this.roll() - .5) * 12, 2, SIZE - 2), z = clamp(m.z + (this.roll() - .5) * 12, 2, SIZE - 2), y = this.world.surface(x, z);
      if (this.fits(m.type, x, y, z) && !waterAt(this.world, { x, y, z })) { m.x = x; m.y = y; m.z = z; return; }
    }
  }
  shoot(type, from, to, owner = 'player', damage = 4) {
    if (this.projectiles.length >= PROJECTILE_LIMIT) return false;
    const len = Math.max(.01, distance(from, to)), speed = ['beam', 'sonic'].includes(type) ? 28 : type === 'shulker_bullet' ? 5 : 15;
    this.projectiles.push({ uid: ++this.serial, type, ...from, vx: (to.x - from.x) / len * speed, vy: (to.y - from.y) / len * speed, vz: (to.z - from.z) / len * speed, owner, damage, life: 4, color: projectileColor[type] || '#d9d8c1' });
    return true;
  }
  explode(p, radius = 3, damage = 10, owner = null, effect = null) {
    for (const m of [...this.mobs]) { const d = distance(m, p); if (d < radius + 1 && !(effect === 'fire' && MOBS[m.type].fireproof)) this.hurt(m, damage * Math.max(.2, 1 - d / (radius + 1)), owner); }
    this.emit('blast', { ...p, radius, amount: damage, effect });
    let removed = 0;
    for (let x = Math.floor(p.x - radius); x <= p.x + radius; x++) for (let y = Math.floor(p.y - radius); y <= p.y + radius; y++) for (let z = Math.floor(p.z - radius); z <= p.z + radius; z++) {
      const id = this.world.get(x, y, z);
      if (id && ![B.BEDROCK, B.OBSIDIAN, B.WATER, B.LAVA].includes(id) && Math.hypot(x + .5 - p.x, y + .5 - p.y, z + .5 - p.z) < radius && removed < 90) { this.world.set(x, y, z, B.AIR); removed++; }
    }
  }
  interact(m, state) {
    const d = MOBS[m.type], item = state.inventory.slots[state.selected], id = item?.id, creative = state.mode === 'creative';
    const consume = () => { if (!creative && item) { if (item.durability) { if (--item.durability <= 0) state.inventory.slots[state.selected] = null; } else if (--item.count <= 0) state.inventory.slots[state.selected] = null; } };
    const give = (dropId, count = 1) => { const left = state.inventory.add(dropId, count); if (left) this.addDrop(dropId, left, m); };
    if (id === 'nautilus_armor' && m.type === 'nautilus' && m.tamed) { consume(); m.nautilusArmor = id; return 'Nautilus armor equipped'; }
    if ((id === 'harness' || id === 'happy_ghast_harness') && m.type === 'happy_ghast' && !m.harnessed && !m.baby) { consume(); m.harnessed = true; return 'Harness equipped'; }
    if (id === 'wolf_armor' && m.type === 'wolf' && m.tamed && !m.petArmor) { consume(); m.petArmor = true; return 'Wolf armor equipped'; }
    if (id === 'lead' && d.temperament !== 'hostile') { m.leashed = !m.leashed; return m.leashed ? `${d.name} is following` : 'Lead released'; }
    if (d.milk && id === 'bucket') { consume(); give('milk_bucket'); return 'Filled milk bucket'; }
    if (d.stew && id === 'bowl') { consume(); give('mushroom_stew'); return 'Collected mushroom stew'; }
    if (id === 'shears' && d.shear && !m.sheared) {
      consume(); give(d.shear, d.shear === 'wool' ? 3 : 2); m.sheared = true; m.produce = 35;
      if (m.type === 'mooshroom') m.type = 'cow';
      return `Collected ${ITEMS[d.shear].name}`;
    }
    if (id === 'brush' && d.brush) {
      if (m.brushCooldown > 0) return 'Nothing to collect yet';
      consume(); give(d.brush); m.brushCooldown = 25; return `Collected ${ITEMS[d.brush].name}`;
    }
    if (d.pollinate && id === 'glass_bottle') {
      if (m.produce > 0) return 'No honey yet';
      consume(); give('honey_bottle'); m.produce = 30; return 'Collected honey';
    }
    if (d.cure && id === 'golden_apple') { consume(); m.type = 'villager'; m.health = 24; m.angry = 0; return 'Zombie villager cured'; }
    if (d.barter && id === 'gold') { consume(); give(['ender_pearl', 'quartz', 'obsidian', 'gravel', 'string'].filter(i => ITEMS[i])[Math.floor(this.roll() * 4)], 2); return 'Barter complete'; }
    if (m.type === 'sulfur_cube' && d.absorb && ITEMS[id]?.block && !['slab', 'stairs', 'wall'].some(part => ITEMS[id].name.toLowerCase().includes(part))) { if (m.absorbed) give(m.absorbed.id || m.absorbed, 1); m.absorbed = structuredClone(item); consume(); m.sitting = true; return 'Sulfur cube absorbed the block'; }
    if (m.absorbed && id === 'shears') { give(m.absorbed.id || m.absorbed, 1); consume(); m.absorbed = null; m.sitting = false; return 'Block extracted'; }
    if (id && (d.tame === id || d.trust === id || m.type === 'nautilus' && ['pufferfish', 'pufferfish_bucket'].includes(id)) && !m.tamed) { consume(); m.tamed = true; m.angry = 0; m.sitting = false; m.health = d.health; return `${d.name} befriended`; }
    if (id && d.breed === id && m.breedCooldown <= 0 && !m.baby) { consume(); m.love = 30; m.health = Math.min(d.health, m.health + 4); return `${d.name} is ready to breed`; }
    if (d.ride && id === 'saddle' && !m.saddled) {
      if (d.tame && !m.tamed && !creative) return `${d.name} is not tamed`;
      consume(); m.saddled = true; return 'Saddle equipped';
    }
    if (d.ride && (m.saddled || m.harnessed || creative || d.model === 'llama')) {
      if (collides(this.world, m, 1.82 + d.height * .45, Math.min(.65, d.width / 2))) return 'Not enough headroom to ride';
      Object.assign(state.player, { x: m.x, y: m.y, z: m.z, vy: 0, flying: false }); state.riding = m.uid; return `Riding ${d.name}`;
    }
    if (d.trade) return { trade: m.uid };
    if (d.collect) { m.tamed = !m.tamed; m.collectId = id || null; return m.tamed ? 'Allay is gathering dropped items' : 'Allay released'; }
    if (m.tamed) { m.sitting = !m.sitting; return m.sitting ? `${d.name} is staying` : `${d.name} is following`; }
    return `${d.name} - ${Math.ceil(m.health)} / ${d.health} HP`;
  }
  trade(mobUid, index, state) {
    const m = this.mobs.find(m => m.uid === mobUid), trade = TRADES[index];
    if (!m || !MOBS[m.type].trade || distance(m, state.player) > 7 || !trade) return { ok: false, reason: 'Trader is out of reach' };
    const inv = new Inventory(state.inventory.slots);
    if (!inv.remove(trade.take, trade.amount)) return { ok: false, reason: `Need ${trade.amount} ${ITEMS[trade.take].name}` };
    if (inv.add(trade.give, trade.count)) return { ok: false, reason: 'Backpack is full' };
    state.inventory.slots = inv.slots; this.emit('xp', { amount: 3 }); return { ok: true };
  }
  moveGround(m, dx, dz) {
    const d = MOBS[m.type];
    for (const [ax, delta] of [['x', dx], ['z', dz]]) {
      const p = { ...m, [ax]: m[ax] + delta };
      const floor = this.floor(p.x, p.z, m.y, m.type);
      if (floor !== null && Math.abs(floor - m.y) < (d.climb || d.hop ? 3 : 1.1) && (d.amphibious || !waterAt(this.world, { ...p, y: floor }))) { m[ax] = p[ax]; m.y = floor; }
    }
  }
  path(m, goal) {
    const radius = 7, size = radius * 2 + 1, ox = Math.floor(m.x) - radius, oz = Math.floor(m.z) - radius;
    const grid = new PF.Grid(size, size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      const wx = ox + x + .5, wz = oz + z + .5, y = this.floor(wx, wz, m.y, m.type);
      grid.setWalkableAt(x, z, y !== null && (MOBS[m.type].amphibious || !waterAt(this.world, { x: wx, y, z: wz })));
    }
    grid.setWalkableAt(radius, radius, true);
    const gx = clamp(Math.floor(goal.x) - ox, 0, size - 1), gz = clamp(Math.floor(goal.z) - oz, 0, size - 1);
    const path = grid.isWalkableAt(gx, gz) ? finder.findPath(radius, radius, gx, gz, grid) : [];
    m.path = path.slice(1, 8).map(([x, z]) => ({ x: x + ox + .5, z: z + oz + .5 }));
  }
  think(m, state) {
    const d = MOBS[m.type], p = state.player, dist = distance(m, p), creative = state.mode === 'creative';
    m.enemy = m.enemy && this.mobs.some(other => other.uid === m.enemy) ? m.enemy : null;
    let enemy = this.mobs.find(other => other.uid === m.enemy);
    if (d.defender && (!d.tame || m.tamed) && !m.sitting) enemy ||= this.mobs.find(other => other !== m && MOBS[other.type].temperament === 'hostile' && distance(m, other) < 10);
    if (d.predator) enemy ||= this.mobs.find(other => other !== m && (d.movement === 'swim' ? ['cod', 'salmon', 'guardian'].includes(other.type) : other.type === 'chicken') && distance(m, other) < 7);
    if (d.eatsSlime) enemy ||= this.mobs.find(other => ['slime', 'magma_cube'].includes(other.type) && other.scale < .7 && distance(m, other) < 7);
    const looking = -Math.sin(p.yaw) * (m.x - p.x) - Math.cos(p.yaw) * (m.z - p.z) > Math.hypot(m.x - p.x, m.z - p.z) * .88;
    const visible = !raycast(this.world, { x: p.x, y: p.y + 1.5, z: p.z }, { x: (m.x - p.x) / Math.max(.1, dist), y: (m.y - p.y) / Math.max(.1, dist), z: (m.z - p.z) / Math.max(.1, dist) }, Math.max(0, dist - 1));
    if (d.stare && looking && visible && dist < 12 && !creative) m.angry = 15;
    if (d.goldAnger && !Object.values(state.equipment || {}).some(item => item?.id.startsWith('gold_')) && dist < 8 && !creative) m.angry = 10;
    const playerHostile = !creative && !m.tamed && ((d.temperament === 'hostile' && dist < (d.boss ? 28 : 16)) || m.angry > 0) && (!d.blind || state.moving || m.angry > 0 || dist < 3);
    if (playerHostile && !enemy) enemy = p;
    if (d.fuse && this.mobs.some(other => MOBS[other.type].repel === 'creeper' && distance(m, other) < 6)) { enemy = null; m.flee = 2; }
    if (d.watched && looking && visible && dist < 20) { m.goal = null; m.activity = 'frozen'; return; }
    m.rolled = !!d.roll && dist < 4 && state.moving;
    if (m.rolled || m.sitting || state.riding === m.uid) { m.goal = null; m.activity = m.rolled ? 'rolled' : 'rest'; return; }
    if (enemy) {
      m.enemy = enemy.uid || null; m.goal = enemy; m.activity = 'chase';
      const reach = distance(m, enemy);
      const range = d.ranged ? 15 : d.width + .9;
      if (reach < range && visible && m.cooldown <= 0) {
        m.cooldown = d.ranged ? d.boss ? 1.1 : 2.2 : 1.2; m.attack = .45;
        if (d.ranged) {
          const from = { x: m.x, y: m.y + d.height * .65, z: m.z }, to = { x: enemy.x, y: enemy.y + (enemy.uid ? MOBS[enemy.type].height * .5 : 1), z: enemy.z };
          this.shoot(d.ranged, from, to, m.uid, d.damage);
          if (d.summon && this.mobs.filter(other => other.type === d.summon).length < 4) this.spawn(d.summon, m, { angry: 10 });
        } else if (!d.fuse) {
          if (enemy.uid) { this.hurt(enemy, d.eatsSlime ? 12 : d.damage, m.tamed ? 'pet' : m.uid); if (d.eatsSlime && enemy.health <= 0 && enemy.type === 'magma_cube') this.addDrop('sea_lantern', 1, m); }
          else this.emit('damage', { amount: d.damage, effect: d.poison ? 'poison' : d.wither ? 'wither' : d.hunger ? 'hunger' : null });
        }
      }
      if (d.ranged && reach < 8 && !d.swoop) m.goal = { x: m.x - (enemy.x - m.x) * .35, y: m.y, z: m.z - (enemy.z - m.z) * .35 };
    } else if (m.flee > 0) { m.goal = { x: m.x + (m.x - p.x), y: m.y, z: m.z + (m.z - p.z) }; m.activity = 'flee'; }
    else if ((m.tamed || m.leashed || d.breed && d.breed === state.inventory.slots[state.selected]?.id) && dist < 30 && dist > 3) { m.goal = p; m.activity = 'follow'; }
    else if (!m.goal || distance(m, { ...m.goal, y: m.y }) < 1 || this.roll() < .12) {
      const angle = this.roll() * Math.PI * 2, r = 3 + this.roll() * 6;
      m.goal = { x: clamp(m.x + Math.sin(angle) * r, 2, SIZE - 2), y: m.y, z: clamp(m.z + Math.cos(angle) * r, 2, SIZE - 2) }; m.activity = 'wander';
    }
    if (d.collect && m.tamed) {
      const loot = this.drops.find(drop => (!m.collectId || drop.id === m.collectId) && distance(m, drop) < 16);
      if (loot) { m.goal = loot; if (distance(m, loot) < 2) { loot.x = p.x; loot.y = p.y; loot.z = p.z; } }
    }
    if (m.love > 0 && m.breedCooldown <= 0) {
      const mate = this.mobs.find(other => other !== m && other.type === m.type && other.love > 0 && other.breedCooldown <= 0 && distance(m, other) < 5);
      if (mate) {
        m.goal = mate;
        if (distance(m, mate) < 2) {
          const result = this.spawn(m.type === 'frog' ? 'tadpole' : m.type, m, { baby: true, scale: .5, tamed: m.tamed && mate.tamed });
          if (result.ok) { m.love = mate.love = 0; m.breedCooldown = mate.breedCooldown = 90; this.emit('xp', { amount: 5 }); }
        }
      }
    }
    if (m.goal && ['ground', 'stationary'].includes(d.movement) && d.movement !== 'stationary') this.path(m, m.goal);
  }
  tick(dt, state) {
    this.clock += dt;
    const p = state.player, hour = (8.67 + state.elapsed / 60) % 24, night = hour < 6 || hour > 18;
    for (const m of [...this.mobs]) {
      const d = MOBS[m.type]; m.age += dt;
      for (const key of ['cooldown', 'brain', 'angry', 'flee', 'hurt', 'attack', 'love', 'breedCooldown', 'brushCooldown']) m[key] = Math.max(0, (m[key] || 0) - dt);
      const dist = distance(m, p);
      if (m.baby && m.age > 120) { m.baby = false; m.scale = 1; }
      if (d.growInto && m.age > 90) { m.type = d.growInto; m.scale = 1; }
      if (m.health <= 0) continue;
      if (d.regenerate && m.angry <= 0) m.health = Math.min(d.health, m.health + dt * .6);
      if (d.burns && !night && m.y >= this.world.surface(m.x, m.z) - .1 && !waterAt(this.world, m)) { m.burning = true; this.hurt(m, dt * .8, 'sun'); } else m.burning = false;
      if (!this.mobs.includes(m)) continue;
      if (d.teleport && waterAt(this.world, m)) { this.hurt(m, dt * 3, 'water'); this.teleport(m); }
      if (!d.fireproof && this.world.get(Math.floor(m.x), Math.floor(m.y), Math.floor(m.z)) === B.LAVA) this.hurt(m, dt * 6, 'lava');
      if (m.status && m.status.until > this.clock && m.health > 1) this.hurt(m, dt, 'poison');
      if (d.grace && dist < 6) state.effects.speed = Math.max(state.effects.speed || 0, 2);
      if (d.poison && dist < 2.5 && m.angry > 0 && state.mode !== 'creative') this.emit('damage', { amount: .6, effect: 'poison' });
      if (d.fatigue && dist < 12 && state.mode !== 'creative') state.effects.fatigue = Math.max(state.effects.fatigue || 0, 3);
      m.produce -= dt;
      if (m.produce <= 0) {
        if (d.produce) this.addDrop(d.produce, 1, m);
        if (d.dig) { this.addDrop('torchflower_seeds', 1, m); m.activity = 'dig'; }
        if (d.graze && m.sheared) m.sheared = false;
        if (!d.pollinate) m.produce = 30 + this.roll() * 25;
      }
      if (dist > 44 && !m.tamed && !m.leashed) { m.activity = 'idle'; continue; }
      if (m.brain <= 0) { this.think(m, state); m.brain = dist < 20 ? .45 : 1.2; }
      if (d.fuse && state.mode !== 'creative' && dist < 2.8 && m.activity === 'chase') {
        m.fuse = (m.fuse || 0) + dt;
        if (m.fuse > 1.6) { this.mobs.splice(this.mobs.indexOf(m), 1); this.explode(m, 2.8, 12); continue; }
      } else m.fuse = Math.max(0, (m.fuse || 0) - dt * 2);
      if (state.riding === m.uid) continue;
      if (m.goal && !m.sitting && !m.rolled && m.activity !== 'frozen' && d.movement !== 'stationary') {
        const goal = d.movement === 'ground' ? m.path?.[0] : m.goal;
        if (goal) {
          const dx = goal.x - m.x, dz = goal.z - m.z, len = Math.hypot(dx, dz), speed = d.speed * (m.flee > 0 || d.ram && m.activity === 'chase' ? 1.6 : 1) * dt;
          m.yaw = Math.atan2(-dx, -dz);
          if (len > .1) {
            const nx = m.x + dx / len * Math.min(speed, len), nz = m.z + dz / len * Math.min(speed, len);
            if (d.movement === 'ground') { this.moveGround(m, nx - m.x, nz - m.z); if (len < .5) m.path.shift(); }
            else if (d.movement === 'swim') {
              const ny = clamp(m.y + Math.sin(this.clock + m.uid) * dt * .4, 1, SEA - d.height + .7);
              if (waterAt(this.world, { x: nx, y: ny, z: nz }) && this.fits(m.type, nx, ny, nz)) { m.x = nx; m.y = ny; m.z = nz; }
              else { m.goal = null; if (!waterAt(this.world, m)) this.hurt(m, dt, 'dry'); }
            } else {
              const ground = this.world.surface(nx, nz), desired = m.activity === 'chase' ? p.y + (d.swoop ? 1 : 3) : ground + (d.boss ? 5 : 2) + Math.sin(this.clock * .5 + m.uid);
              const ny = clamp(m.y + clamp(desired - m.y, -2, 2) * dt, 1, HEIGHT + 12);
              if (this.fits(m.type, nx, ny, nz)) { m.x = nx; m.y = ny; m.z = nz; } else { m.y += this.fits(m.type, m.x, m.y + dt * 2, m.z) ? dt * 2 : 0; m.goal = null; }
            }
          }
        }
      }
      const support = this.world.get(Math.floor(m.x), Math.floor(m.y) - 1, Math.floor(m.z));
      if (d.movement === 'ground' && !isSolid(support) && !(m.type === 'strider' && support === B.LAVA)) {
        const ny = Math.max(1, m.y - dt * 5); if (this.fits(m.type, m.x, ny, m.z)) m.y = ny;
      }
    }
    this.updateProjectiles(dt, state);
    for (const vehicle of this.vehicles || []) {
      if (!Number.isFinite(vehicle.x) || vehicle.type !== 'cart' || state.vehicle === vehicle.uid) continue;
      const floor = this.world.get(Math.floor(vehicle.x), Math.floor(vehicle.y - .2), Math.floor(vehicle.z));
      const rail = BLOCKS[floor]?.reference?.includes('rail');
      if (!rail) continue;
      const dir = railDirections(vehicle.facing || 0); vehicle.x += dir.x * dt * 3; vehicle.z += dir.z * dt * 3; vehicle.y = this.world.surface(vehicle.x, vehicle.z);
      if (vehicle.item === 'tnt_minecart' && vehicle.powered) this.explode(vehicle, 3, 16, 'player');
    }
    for (const loot of [...this.drops]) {
      loot.age += dt;
      const below = this.world.get(Math.floor(loot.x), Math.floor(loot.y - .3), Math.floor(loot.z));
      if (!isSolid(below) && loot.y > 1) loot.y -= dt * 3;
      if (distance(loot, p) < 2) {
        const left = state.inventory.add(loot.id, loot.count, loot.durability);
        if (left !== loot.count) { loot.count = left; this.emit('inventory'); }
        if (!left) this.drops.splice(this.drops.indexOf(loot), 1);
      }
      if (loot.age > 600 && this.drops.includes(loot)) this.drops.splice(this.drops.indexOf(loot), 1);
    }
    for (const crop of this.crops) crop.age += dt;
    this.spawnTimer += dt;
    if (this.spawnTimer > 8 && this.mobs.filter(m => m.natural).length < NATURAL_LIMIT) { this.spawnTimer = 0; this.naturalSpawn(state, night); }
  }
  updateProjectiles(dt, state) {
    for (const shot of [...this.projectiles]) {
      shot.life -= dt;
      if (shot.type === 'tnt') { if (shot.life <= 0) this.explode(shot, 3.3, 16, shot.owner); }
      else {
        const step = { x: shot.vx * dt, y: shot.vy * dt, z: shot.vz * dt }, len = Math.hypot(step.x, step.y, step.z);
        const dir = { x: step.x / len, y: step.y / len, z: step.z / len };
        const block = raycast(this.world, shot, dir, len);
        let hit = block, hitDistance = block?.distance ?? len + 1;
        const source = this.mobs.find(m => m.uid === shot.owner);
        for (const m of this.mobs) {
          if (m.uid === shot.owner || shot.owner !== 'player' && (!source || friendly(m) === friendly(source) && MOBS[m.type].temperament === MOBS[source.type].temperament)) continue;
          const d = MOBS[m.type], w = d.width * m.scale / 2;
          const t = rayBox(shot, dir, { x: m.x - w, y: m.y, z: m.z - w }, { x: m.x + w, y: m.y + d.height * m.scale, z: m.z + w });
          if (t !== null && t <= len && t < hitDistance) { hit = { mob: m }; hitDistance = t; }
        }
        if (shot.owner !== 'player' && state.mode !== 'creative') {
          const p = state.player, t = rayBox(shot, dir, { x: p.x - .3, y: p.y, z: p.z - .3 }, { x: p.x + .3, y: p.y + 1.8, z: p.z + .3 });
          if (t !== null && t <= len && t < hitDistance) { hit = { player: true }; hitDistance = t; }
        }
        if (shot.type === 'shulker_bullet' && shot.owner !== 'player') { const p = state.player, l = Math.max(1, distance(shot, p)); shot.vx += ((p.x - shot.x) / l * 5 - shot.vx) * dt; shot.vz += ((p.z - shot.z) / l * 5 - shot.vz) * dt; }
        const travel = hit ? Math.max(0, hitDistance) : len;
        shot.x += dir.x * travel; shot.y += dir.y * travel; shot.z += dir.z * travel;
        if (hit) {
          shot.life = 0;
          const effect = ['poison', 'poison_arrow'].includes(shot.type) ? 'poison' : shot.type === 'slow_arrow' ? 'slowness' : shot.type === 'wither_skull' ? 'wither' : shot.type === 'shulker_bullet' ? 'levitation' : shot.type === 'fireball' ? 'fire' : null;
          if (hit.mob) { if (!(shot.type === 'fireball' && MOBS[hit.mob.type].fireproof)) this.hurt(hit.mob, shot.damage, shot.owner); if (effect) hit.mob.status = { type: effect, until: this.clock + 6 }; }
          if (hit.player) this.emit('damage', { amount: shot.damage, effect });
          if (['fireball', 'wither_skull', 'dragon_breath'].includes(shot.type)) this.explode(shot, 1.5, shot.damage, shot.owner, shot.type === 'fireball' ? 'fire' : null);
          if (shot.type === 'wind') this.emit('wind', { ...shot });
        }
      }
      if (shot.life <= 0) this.projectiles.splice(this.projectiles.indexOf(shot), 1);
    }
  }
  naturalSpawn(state, night) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = this.roll() * Math.PI * 2, r = 18 + this.roll() * 15;
      const x = clamp(state.player.x + Math.sin(angle) * r, 3, SIZE - 3), z = clamp(state.player.z + Math.cos(angle) * r, 3, SIZE - 3);
      const underground = state.player.y < this.world.heights[Math.floor(state.player.z) * SIZE + Math.floor(state.player.x)] - 3;
      const habitat = underground ? 'cave' : this.world.biome(x, z);
      const candidates = MOB_LIST.filter(d => !d.boss && (d.habitat === habitat || night && d.habitat === 'night') && (night || habitat === 'volcanic' || habitat === 'cave' || habitat === 'end' || d.temperament !== 'hostile'));
      if (!candidates.length) continue;
      const d = candidates[Math.floor(this.roll() * candidates.length)];
      if (this.spawn(d.id, { x, y: underground ? state.player.y : this.world.surface(x, z), z }, { natural: true }).ok) return;
    }
  }
  update(dt, state) {
    this.accumulator += Math.min(dt, .15);
    let steps = 0;
    while (this.accumulator >= .05 && steps++ < 3) { this.tick(.05, state); this.accumulator -= .05; }
  }
  serialize() {
    const fields = ['uid', 'type', 'x', 'y', 'z', 'yaw', 'health', 'age', 'scale', 'tamed', 'sitting', 'saddled', 'harnessed', 'nautilusArmor', 'petArmor', 'sheared', 'absorbed', 'baby', 'natural', 'produce', 'love', 'breedCooldown', 'brushCooldown', 'collectId', 'leashed'];
    return { serial: this.serial, clock: this.clock, mobs: this.mobs.map(m => Object.fromEntries(fields.filter(k => m[k] !== undefined).map(k => [k, m[k]]))), drops: this.drops, crops: this.crops, projectiles: this.projectiles.filter(s => s.type === 'tnt') };
  }
  restore(saved) {
    this.serial = Number.isSafeInteger(saved.serial) ? Math.max(0, saved.serial) : 0;
    this.clock = Number.isFinite(saved.clock) ? Math.max(0, saved.clock) : 0;
    const validPosition = m => m && ['x', 'y', 'z'].every(k => Number.isFinite(m[k])) && m.x > 0 && m.x < SIZE && m.z > 0 && m.z < SIZE && m.y >= 0 && m.y < HEIGHT + 20;
    const seen = new Set();
    for (const m of (Array.isArray(saved.mobs) ? saved.mobs : []).slice(0, MOB_LIMIT)) {
      const d = MOBS[m?.type];
      if (!Object.hasOwn(MOBS, m?.type) || !validPosition(m) || !Number.isFinite(m.health) || m.health <= 0 || !Number.isSafeInteger(m.uid) || m.uid <= 0 || seen.has(m.uid)) continue;
      seen.add(m.uid); this.serial = Math.max(this.serial, m.uid);
      this.mobs.push({ ...m, health: Math.min(m.health, d.health), scale: m.scale === .5 ? .5 : 1, yaw: Number.isFinite(m.yaw) ? m.yaw : 0, age: Number.isFinite(m.age) ? m.age : 0, cooldown: 1, brain: 0, produce: Number.isFinite(m.produce) ? m.produce : 30, activity: 'idle', love: 0, breedCooldown: Number.isFinite(m.breedCooldown) ? m.breedCooldown : 0 });
    }
    this.drops = (Array.isArray(saved.drops) ? saved.drops : []).filter(d => validPosition(d) && Object.hasOwn(ITEMS, d.id) && Number.isInteger(d.count) && d.count > 0 && d.count <= 64).slice(0, 256).map(d => ({ ...d, age: Number.isFinite(d.age) ? d.age : 0 }));
    this.crops = (Array.isArray(saved.crops) ? saved.crops : []).filter(c => validPosition(c) && Object.hasOwn(ITEMS, c.harvest) && Number.isFinite(c.age)).slice(0, 128);
    this.projectiles = (Array.isArray(saved.projectiles) ? saved.projectiles : []).filter(s => s.type === 'tnt' && validPosition(s) && Number.isFinite(s.life) && s.life > 0 && s.life <= 3).slice(0, PROJECTILE_LIMIT);
  }
}
