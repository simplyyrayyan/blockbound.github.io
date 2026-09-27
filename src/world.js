import { B, BLOCKS, isSolid } from './catalog.js';
import { blockBoxes, intersectBox } from './block-shapes.js';
import { regionBiome, enrichOverworld, generateDimension } from './regions.js';
import { generateChunk, terrainColumn } from './terrain.js';
import { tickFluids, waterHeight } from './fluids.js';

export const SIZE = 96;
export const HEIGHT = 128;
export const CHUNK = 16;
export const SEA = 12;
export const WORLD_LIMIT = 30000000;
export function validFarKey(key, height = HEIGHT) {
  if (typeof key !== 'string' || !/^-?\d+,\d+,-?\d+$/.test(key)) return false;
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z].every(Number.isSafeInteger) && key === `${x},${y},${z}` && y > 0 && y < height && Math.abs(x) < WORLD_LIMIT && Math.abs(z) < WORLD_LIMIT && !(x >= 0 && x < SIZE && z >= 0 && z < SIZE);
}
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function hashString(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function hash(x, y, z, seed = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ seed;
  h = Math.imul(h ^ h >>> 13, 1274126177);
  return ((h ^ h >>> 16) >>> 0) / 4294967295;
}
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
export function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz);
  return mix(mix(hash(ix, 0, iz, seed), hash(ix + 1, 0, iz, seed), u), mix(hash(ix, 0, iz + 1, seed), hash(ix + 1, 0, iz + 1, seed), u), v);
}
const fbm = (x, z, seed) => noise(x, z, seed) * .6 + noise(x * 2, z * 2, seed + 71) * .27 + noise(x * 4, z * 4, seed + 172) * .13;

export class World {
  constructor(seed = 'cedar-valley', version = 3, dimension = 'overworld', options = {}) {
    this.version = version;
    this.dimension = dimension;
    this.height = version >= 5 ? HEIGHT : 48;
    this.seaLevel = version >= 5 ? 48 : SEA;
    this.structures = [];
    this.seed = version >= 4 ? String(seed).trim().slice(0, 36) || '0' : String(seed).slice(0, 36);
    this.number = hashString(this.seed);
    this.streaming = version >= 4 || !!options.streaming;
    this.blocks = new Uint16Array(SIZE * SIZE * this.height);
    this.heights = new Uint8Array(SIZE * SIZE);
    this.edits = new Map();
    this.states = new Map();
    this.farEdits = new Map();
    this.farStates = new Map();
    this.baseStates = new Map();
    this.terrainChunks = new Map();
    this.generatedChunks = new Set();
    this.columnCache = new Map();
    this.structureCache = new Map();
    this.chunkEdits = new Map();
    this.chunkStates = new Map();
    this.changed = new Set();
    this.fluidQueue = new Set();
    this.fluidsSeeded = false;
    this.revision = 0;
    this.dirty = new Set();
    this.meshChanges = new Map();
    this.spawn = { x: SIZE / 2 + .5, y: 23, z: SIZE / 2 + .5 };
  }
  core(x, y, z) { return x >= 0 && x < SIZE && y >= 0 && y < this.height && z >= 0 && z < SIZE; }
  index(x, y, z) { return this.core(x, y, z) ? (y * SIZE + z) * SIZE + x : this.key(x, y, z); }
  inside(x, y, z) { return Number.isFinite(x + y + z) && y >= 0 && y < this.height && (this.streaming ? Math.abs(x) < WORLD_LIMIT && Math.abs(z) < WORLD_LIMIT : this.core(x, y, z)); }
  position(index) { if (typeof index === 'string') { const [x, y, z] = index.split(',').map(Number); return { x, y, z }; } return { x: index % SIZE, y: Math.floor(index / (SIZE * SIZE)), z: Math.floor(index / SIZE) % SIZE }; }
  blockAt(index) { const p = this.position(index); return this.get(p.x, p.y, p.z); }
  bound(value, margin = 2) { return clamp(value, this.streaming ? -WORLD_LIMIT + margin : margin, this.streaming ? WORLD_LIMIT - margin : SIZE - margin); }
  key(x, y, z) { return `${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`; }
  ensureChunk(cx, cz) {
    const key = `${cx},${cz}`;
    if (this.generatedChunks.has(key) || this.version < 4 && cx >= 0 && cx < SIZE / CHUNK && cz >= 0 && cz < SIZE / CHUNK) return;
    this.generatedChunks.add(key);
    if (cx < 0 || cz < 0 || cx >= SIZE / CHUNK || cz >= SIZE / CHUNK) this.terrainChunks.set(key, new Uint16Array(CHUNK * CHUNK * this.height));
    generateChunk(this, cx, cz);
    if (this.terrainChunks.size > 256) {
      const oldest = this.terrainChunks.keys().next().value;
      this.terrainChunks.delete(oldest); this.generatedChunks.delete(oldest);
      for (const index of this.baseStates.keys()) { const p = this.position(index); if (`${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}` === oldest) this.baseStates.delete(index); }
    }
  }
  heightAt(x, z) { return this.version >= 4 || !this.core(x, 1, z) ? terrainColumn(this, Math.floor(x), Math.floor(z)).h : this.heights[Math.floor(z) * SIZE + Math.floor(x)]; }
  acceptChunk(cx, cz, blocks, states = [], structures = []) {
    const key = cx + ',' + cz;
    if (!this.generatedChunks.has(key)) {
      if (cx >= 0 && cz >= 0 && cx < SIZE / CHUNK && cz < SIZE / CHUNK) {
        for (let y = 0; y < this.height; y++) for (let z = 0; z < CHUNK; z++) {
          const source = (y * CHUNK + z) * CHUNK, target = (y * SIZE + cz * CHUNK + z) * SIZE + cx * CHUNK;
          this.blocks.set(blocks.subarray(source, source + CHUNK), target);
        }
      } else this.terrainChunks.set(key, blocks);
      this.generatedChunks.add(key);
      for (const [index, value] of states) { const p = this.position(index); if (!(this.core(p.x, p.y, p.z) ? this.edits : this.farEdits).has(index)) this.baseStates.set(index, value); }
    }
    for (const structure of structures) if (!this.structures.some(s => s.key === structure.key)) this.structures.push(structure);
    if (this.structures.length > 512) this.structures.splice(0, this.structures.length - 512);
    if (this.terrainChunks.size > 256) {
      const oldest = this.terrainChunks.keys().next().value; this.terrainChunks.delete(oldest); this.generatedChunks.delete(oldest);
      for (const index of this.baseStates.keys()) { const p = this.position(index); if (Math.floor(p.x / CHUNK) + ',' + Math.floor(p.z / CHUNK) === oldest) this.baseStates.delete(index); }
    }
  }
  generatedState(x, y, z, value) {
    const bounds = this.generationBounds;
    if (bounds && (x < bounds.x0 || x >= bounds.x0 + CHUNK || z < bounds.z0 || z >= bounds.z0 + CHUNK)) return;
    const key = this.index(x, y, z);
    if ((this.core(x, y, z) ? this.edits : this.farEdits).has(key)) return;
    this.baseStates.set(key, value); this.changed.add(key);
  }
  get(x, y, z) {
    if (!this.inside(x, y, z)) return B.AIR;
    if (this.streaming) this.ensureChunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK));
    if (this.core(x, y, z)) return this.edits.get(this.index(x, y, z)) ?? this.blocks[this.index(x, y, z)];
    const chunk = this.terrainChunks.get(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`);
    return this.farEdits.get(this.key(x, y, z)) ?? chunk?.[(y * CHUNK + (z % CHUNK + CHUNK) % CHUNK) * CHUNK + (x % CHUNK + CHUNK) % CHUNK] ?? B.AIR;
  }
  raw(x, y, z, id) {
    if (!this.inside(x, y, z)) return;
    const bounds = this.generationBounds;
    if (bounds && (x < bounds.x0 || x >= bounds.x0 + CHUNK || z < bounds.z0 || z >= bounds.z0 + CHUNK)) return;
    if (bounds && (BLOCKS[id]?.station || BLOCKS[id]?.redstone)) this.changed.add(this.index(x, y, z));
    if (this.core(x, y, z)) this.blocks[this.index(x, y, z)] = id;
    else {
      const key = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
      if (!this.terrainChunks.has(key)) this.terrainChunks.set(key, new Uint16Array(CHUNK * CHUNK * this.height));
      this.terrainChunks.get(key)[(y * CHUNK + (z % CHUNK + CHUNK) % CHUNK) * CHUNK + (x % CHUNK + CHUNK) % CHUNK] = id;
    }
  }
  stateAt(x, y, z) { const key = this.index(x, y, z); return (this.core(x, y, z) ? this.states : this.farStates).get(key) || this.baseStates.get(key) || {}; }
  setState(x, y, z, values) {
    if (!this.inside(x, y, z) || !this.get(x, y, z)) return false;
    const index = this.index(x, y, z), states = this.core(x, y, z) ? this.states : this.farStates, old = this.stateAt(x, y, z);
    if (Object.entries(values).every(([key, value]) => old[key] === value)) return false;
    states.set(index, { ...old, ...values });
    this.meshChanges.set(index, { ...this.meshChanges.get(index), state: states.get(index) });
    if (values.fluidLevel !== undefined) this.queueFluid(x, y, z);
    this.dirty.add(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`);
    if (x % CHUNK === 0) this.dirty.add(`${Math.floor(x / CHUNK) - 1},${Math.floor(z / CHUNK)}`);
    if ((x % CHUNK + CHUNK) % CHUNK === CHUNK - 1) this.dirty.add(`${Math.floor(x / CHUNK) + 1},${Math.floor(z / CHUNK)}`);
    if (z % CHUNK === 0) this.dirty.add(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK) - 1}`);
    if ((z % CHUNK + CHUNK) % CHUNK === CHUNK - 1) this.dirty.add(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK) + 1}`);
    this.revision++; return true;
  }
  set(x, y, z, id) {
    if (!this.inside(x, y, z) || y <= 0 || !BLOCKS[id] || this.get(x, y, z) === B.BEDROCK) return false;
    this.raw(x, y, z, id);
    const index = this.index(x, y, z), states = this.core(x, y, z) ? this.states : this.farStates;
    states.delete(index); this.baseStates.delete(index); this.revision++;
    (this.core(x, y, z) ? this.edits : this.farEdits).set(index, id);
    this.meshChanges.set(index, { id, state: null });
    this.changed.add(index); this.queueFluid(x, y, z);
    for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const cx = Math.floor((x + dx) / CHUNK), cz = Math.floor((z + dz) / CHUNK);
      if (this.streaming || (cx >= 0 && cx < SIZE / CHUNK && cz >= 0 && cz < SIZE / CHUNK)) this.dirty.add(`${cx},${cz}`);
    }
    return true;
  }
  surface(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    for (let y = this.dimension === 'nether' ? Math.min(this.height - 9, this.heightAt(x, z) + 1) : this.height - 1; y >= 0; y--) if (isSolid(this.get(x, y, z))) return y + 1;
    return this.dimension === 'end' ? 0 : 1;
  }
  seedFluids() {
    if (this.fluidsSeeded) return;
    this.fluidsSeeded = true;
    for (const key of [...this.edits.keys(), ...this.farEdits.keys()]) { const p = this.position(key); this.queueFluid(p.x, p.y, p.z); }
  }
  queueFluid(x, y, z) {
    for (const [dx, dy, dz] of [[0, 0, 0], [0, -1, 0], [0, 1, 0], [-1, 0, 0], [1, 0, 0], [0, 0, -1], [0, 0, 1]]) if (this.inside(x + dx, y + dy, z + dz) && this.fluidQueue.size < 65536) this.fluidQueue.add(this.key(x + dx, y + dy, z + dz));
  }
  tickFluids(limit = 96, player = null) { this.seedFluids(); this.fluidTick = (this.fluidTick || 0) + 1; return tickFluids(this, limit, player); }
  waterHeight(x, y, z) { return waterHeight(this, x, y, z); }
  inWater(p) { const y = Math.floor(p.y); return p.y < y + waterHeight(this, Math.floor(p.x), y, Math.floor(p.z)); }
  // Pick a dry, walkable spawn near the middle of the map and level a small pad
  // so nobody wakes up inside an ocean or halfway down a cliff.
  chooseSpawn() {
    const sea = this.seaLevel ?? SEA;
    let best = null;
    const usable = (x, z) => {
      const col = terrainColumn(this, x, z);
      if (col.h <= sea + 1 || /ocean|river/.test(col.biome)) return null;
      for (const [ox, oz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (Math.abs(terrainColumn(this, x + ox, z + oz).h - col.h) > 4) return null;
      // A spawn should sit on open ground, not at the foot of a cliff.
      for (const [ox, oz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, 4], [4, -4], [-4, -4]]) {
        const near = terrainColumn(this, x + ox, z + oz);
        if (Math.abs(near.h - col.h) > 3 || near.h <= sea + 1 || /ocean|river/.test(near.biome)) return null;
      }
      return col;
    };
    // Look just outside the levelled clearing first so the view at spawn is the
    // real seed; fall back to the clearing itself only on all-ocean worlds.
    const scan = predicate => {
      for (let r = 6; r <= 42; r += 2) for (let dx = -r; dx <= r; dx += 2) for (let dz = -r; dz <= r; dz += 2) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const col = usable(48 + dx, 48 + dz);
        if (col && predicate(48 + dx, 48 + dz, col)) return { x: 48 + dx, z: 48 + dz, h: col.h, top: col.top };
      }
      return null;
    };
    // Woodland and plains first: a spawn with trees in sight plays like Minecraft.
    const homely = (x, z, tier) => tier === 0
      ? /plains|meadow|flower_forest/.test(terrainColumn(this, x, z).biome)
      : /birch|forest|taiga|jungle/.test(terrainColumn(this, x, z).biome);
    // The Nether and the End arrive on the platform the generator carves at the
    // middle of the map, not somewhere out in the rock.
    if (this.dimension !== 'overworld' && Number.isFinite(this.platformY)) { this.spawn = { x: 48.5, y: this.platformY, z: 48.5 }; this.spawnYaw = -.245; return; }
    const spot = scan((x, z) => homely(x, z, 0)) || scan((x, z) => homely(x, z, 1)) || scan(() => true) || (() => { const c = terrainColumn(this, 48, 48); return { x: 48, z: 48, h: Math.max(c.h, sea + 1), top: B.GRASS }; })();
    this.spawn = { x: spot.x + .5, y: spot.h + 1, z: spot.z + .5 };
    this.spawnYaw = -.245;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const x = spot.x + dx, z = spot.z + dz;
      for (let y = spot.h + 1; y <= spot.h + 4; y++) this.set(x, y, z, B.AIR);
      this.set(x, spot.h, z, B.GRASS);
      for (let y = spot.h - 1, filled = 0; y > 0 && filled < 4 && this.get(x, y, z) === B.AIR; y--, filled++) this.set(x, y, z, B.DIRT);
    }
    // A starter grove: a biome-appropriate pocket of wood in sight of spawn, with
    // the opening view kept clear so the landscape still reads on the first frame.
    if (this.dimension === 'overworld') {
      const biome = terrainColumn(this, spot.x, spot.z).biome;
      const species = /snow|frozen|taiga/.test(biome) ? ['SPRUCE_LOG', 'SPRUCE_LEAVES'] : /desert|badlands|savanna/.test(biome) ? ['ACACIA_LOG', 'ACACIA_LEAVES']
        : /jungle/.test(biome) ? ['JUNGLE_LOG', 'JUNGLE_LEAVES'] : /birch/.test(biome) ? ['BIRCH_LOG', 'BIRCH_LEAVES']
          : /cherry/.test(biome) ? ['CHERRY_LOG', 'CHERRY_LEAVES'] : /dark|pale/.test(biome) ? ['DARK_OAK_LOG', 'DARK_OAK_LEAVES'] : ['LOG', 'LEAVES'];
      const [logId, leafId] = species.map(name => B[name] || (name.endsWith('LOG') ? B.LOG : B.LEAVES));
      const plant = (x, z, base = terrainColumn(this, x, z).h, trunk = 6) => {
        if (!Number.isInteger(base) || !this.inside(x, base, z) || Math.abs(base - spot.h) > 4) return false;
        for (let y = base + 1; y <= base + trunk + 1; y++) if (![B.AIR, B.LOG, B.LEAVES].includes(this.get(x, y, z))) return false;
        for (let y = 1; y <= trunk; y++) this.set(x, base + y, z, logId);
        // The canopy sits at the top of the trunk so the view under it stays open.
        for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) > 4) continue;
          const y = base + trunk + dy;
          if (this.get(x + dx, y, z + dz) === B.AIR) this.set(x + dx, y, z + dz, leafId);
        }
        return true;
      };
      const level = (x, z) => {
        if (!this.inside(x, spot.h, z)) return;
        for (let y = spot.h + 1; y <= spot.h + 8; y++) this.set(x, y, z, B.AIR);
        this.set(x, spot.h, z, B.GRASS);
        for (let y = spot.h - 1, filled = 0; y > 0 && filled < 4 && this.get(x, y, z) === B.AIR; y--, filled++) this.set(x, y, z, B.DIRT);
      };
      // Level a short corridor ahead so the opening view lands on the starter tree.
      const fx = -Math.sin(this.spawnYaw), fz = -Math.cos(this.spawnYaw);
      for (let r = 2; r <= 9; r++) for (const lateral of [-1, 0, 1]) level(Math.round(spot.x + fx * r + fz * lateral), Math.round(spot.z + fz * r - fx * lateral));
      plant(Math.round(spot.x + fx * 7), Math.round(spot.z + fz * 7), spot.h);
      for (const [ox, oz] of [[15, 9], [-13, 14], [17, -11], [-16, -8]]) plant(spot.x + ox, spot.z + oz);
      // Clear anything the world already grew in front of spawn, so the first
      // frame shows terrain rather than the inside of a canopy.
      const side = { x: fz, z: -fx }, felled = new Set([B.LOG, B.LEAVES, B.SPRUCE_LOG, B.SPRUCE_LEAVES, B.BIRCH_LOG, B.BIRCH_LEAVES, B.JUNGLE_LOG, B.JUNGLE_LEAVES, B.ACACIA_LOG, B.ACACIA_LEAVES, B.DARK_OAK_LOG, B.DARK_OAK_LEAVES, B.CHERRY_LOG, B.CHERRY_LEAVES]);
      for (let depth = 2; depth <= 20; depth++) for (let lateral = -8; lateral <= 8; lateral++) {
        const x = Math.round(spot.x + fx * depth + side.x * lateral), z = Math.round(spot.z + fz * depth + side.z * lateral);
        if (!this.inside(x, spot.h, z) || Math.hypot(x - spot.x, z - spot.z) < 4) continue;
        for (let y = spot.h + 1; y < spot.h + 24; y++) if (felled.has(this.get(x, y, z))) this.set(x, y, z, B.AIR);
      }
    }
  }
  generate() {
    if (this.version >= 4) {
      const lo = this.version >= 5 ? 2 : 0, hi = this.version >= 5 ? 5 : SIZE / CHUNK;
      for (let cx = lo; cx < hi; cx++) for (let cz = lo; cz < hi; cz++) this.ensureChunk(cx, cz);
      if (this.version >= 5) this.chooseSpawn();
      else this.spawn.y = this.dimension === 'end' ? terrainColumn(this, 48, 48).h + 1 : 23;
      return this;
    }
    if (this.dimension !== 'overworld') return generateDimension(this);
    const seed = this.number;
    const cx = SIZE / 2, cz = SIZE / 2;
    for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
      const n = fbm(x / 31, z / 31, seed);
      let h = Math.floor(8 + n * 26);
      // A winding lake valley, with a small, safe clearing at the spawn.
      const riverX = 27 + Math.sin(z / 17 + seed % 7) * 9;
      const river = Math.max(0, 1 - Math.abs(x - riverX) / 8);
      h = Math.floor(mix(h, 9, river * .92));
      const distance = Math.hypot(x - cx, z - cz);
      if (distance < 12) h = Math.round(mix(22, h, smooth(clamp((distance - 6) / 6, 0, 1))));
      h = clamp(h, 5, 32);
      this.heights[z * SIZE + x] = h;
      const sandy = h <= SEA + 1;
      const rocky = h >= 29;
      for (let y = 0; y <= Math.max(h, SEA); y++) {
        let id = y === 0 ? B.BEDROCK : y > h ? B.WATER : y === h ? (sandy ? B.SAND : rocky ? B.STONE : B.GRASS) : y > h - 3 ? (sandy ? B.SAND : B.DIRT) : B.STONE;
        if (id === B.STONE) {
          const vein = hash(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2), seed + 845);
          const fleck = hash(x, y, z, seed + 333);
          if (vein < .035 && y < 9 && fleck < .75) id = B.DIAMOND;
          else if (vein > .95 && y < 12 && fleck < .8) id = B.GOLD;
          else if (vein > .12 && vein < .22 && y < 22 && fleck < .8) id = B.IRON;
          else if (vein > .42 && vein < .54 && fleck < .8) id = B.COAL;
          // Caves are dry below their roofs and never cut bedrock.
          const cave = Math.sin(x * .19 + y * .36 + seed % 31) + Math.sin(z * .21 - y * .31) + Math.sin((x + z) * .13 + y * .37);
          if (y > 2 && y < h - 3 && h > SEA + 1 && cave > 2.25) id = B.AIR;
        }
        this.raw(x, y, z, id);
      }
    }
    // An open, walkable cave winds down from the clearing to the ore layers.
    for (let t = 0; t < 34; t++) {
      const x = cx + 9 + Math.sin(t / 8) * 2, z = cz - 9 - t * .65;
      const top = this.heights[Math.floor(z) * SIZE + Math.floor(x)] + 1;
      const y = t === 0 ? top : Math.max(5, 23 - t * .55);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 3; dy++) {
        if (dx * dx + dz * dz <= 5) this.raw(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz, B.AIR);
      }
    }
    // A small rocky outcrop makes coal discoverable on the first walk.
    for (let dx = 0; dx < 5; dx++) for (let dz = 0; dz < 4; dz++) {
      const x = cx + 5 + dx, z = cz - 5 - dz, y = this.heights[z * SIZE + x];
      this.raw(x, y, z, B.STONE);
      if ((dx + dz) % 3 === 0) this.raw(x, y + 1, z, B.COAL);
    }
    for (let x = 3; x < SIZE - 3; x++) for (let z = 3; z < SIZE - 3; z++) {
      const y = this.heights[z * SIZE + x];
      if (Math.hypot(x - cx, z - cz) < 7 || (x > cx + 5 && x < cx + 15 && z < cz && z > cz - 35)) continue;
      if (this.get(x, y, z) === B.GRASS && hash(x, 0, z, seed + 33) < .025) this.tree(x, y + 1, z);
    }
    this.tree(cx + 1, 23, cz - 4);
    this.tree(cx - 5, 23, cz - 2);
    this.spawn.y = 23;
    if (this.version === 2) this.enrich();
    if (this.version >= 3) enrichOverworld(this);
    this.fluidsSeeded = false;
    return this;
  }
  biome(x, z) {
    if (this.streaming && !this.core(x, 1, z)) return terrainColumn(this, x, z).biome;
    if (this.version >= 3) return regionBiome(this, x, z);
    if (x > 73 && z < 24) return 'volcanic';
    if (x > 73 && z > 73) return 'end';
    if (x < 23 && z > 70) return 'snow';
    if (x > 64 && z > 42 && z < 70) return 'pale';
    if (x < 23 && z < 23) return 'desert';
    const h = this.heights[Math.floor(z) * SIZE + Math.floor(x)];
    if (h <= SEA) return 'water';
    if (h <= SEA + 1) return 'beach';
    if (h >= 27) return 'mountain';
    return (x + z) % 37 < 21 ? 'forest' : 'meadow';
  }
  enrich() {
    for (let x = 1; x < SIZE - 1; x++) for (let z = 1; z < SIZE - 1; z++) {
      const h = this.heights[z * SIZE + x], biome = this.biome(x, z);
      for (let y = 1; y < HEIGHT; y++) {
        const id = this.get(x, y, z), r = hash(x, y, z, this.number + 713);
        if (id === B.STONE) {
          const next = r < .008 && y < 12 ? B.EMERALD_ORE : r < .022 && y < 12 ? B.REDSTONE_ORE : r < .03 ? B.LAPIS_ORE : r < .047 ? B.COPPER_ORE : r < .055 ? B.AMETHYST : y < 5 ? B.DEEPSLATE : null;
          if (next) this.raw(x, y, z, next);
        }
        // Keep the starting clearing and its two tutorial trees unchanged.
        if (Math.hypot(x - 48, z - 48) < 9) continue;
        if (id === B.LOG || id === B.LEAVES) {
          const log = id === B.LOG;
          const type = biome === 'snow' ? (log ? B.SPRUCE_LOG : B.SPRUCE_LEAVES) : biome === 'pale' ? (log ? B.BIRCH_LOG : B.LEAVES) : z > 56 ? (log ? B.CHERRY_LOG : B.CHERRY_LEAVES) : x % 19 < 10 ? (log ? B.BIRCH_LOG : B.LEAVES) : id;
          this.raw(x, y, z, ['desert', 'volcanic', 'end'].includes(biome) ? B.AIR : type);
        }
      }
      if (Math.hypot(x - 48, z - 48) < 10) continue;
      if (biome === 'volcanic' || biome === 'end' || biome === 'desert') {
        for (let y = h - 2; y <= Math.max(h, SEA); y++) this.raw(x, y, z, biome === 'volcanic' ? (y === h && hash(x, 0, z, this.number) < .13 ? B.LAVA : B.NETHERRACK) : biome === 'end' ? B.END_STONE : B.SAND);
        if (biome === 'volcanic' && hash(x, 1, z, this.number) < .055) this.raw(x, h, z, B.GLOWSTONE);
        if (biome === 'desert' && hash(x, 1, z, this.number) < .015) for (let y = h + 1; y <= h + 3; y++) this.raw(x, y, z, B.CACTUS);
      } else if (biome === 'snow') this.raw(x, h, z, h <= SEA ? B.ICE : B.SNOW);
      else if (this.get(x, h, z) === B.GRASS && this.get(x, h + 1, z) === B.AIR && hash(x, 1, z, this.number + 211) < .008) this.raw(x, h + 1, z, z > 55 ? B.MELON : B.PUMPKIN);
    }
  }
  tree(x, y, z) {
    const length = 5 + Math.floor(hash(x, y, z, this.number) * 2);
    for (let dy = 0; dy < length; dy++) this.raw(x, y + dy, z, B.LOG);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -2; dy <= 1; dy++) {
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && (dy !== -1 || hash(x + dx, y + dy, z + dz, this.number) < .5)) continue;
      if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
      if (this.get(x + dx, y + length + dy, z + dz) === B.AIR) this.raw(x + dx, y + length + dy, z + dz, B.LEAVES);
    }
  }
  nearTable(p, reach = 4) {
    for (let x = Math.floor(p.x - reach); x <= p.x + reach; x++) for (let z = Math.floor(p.z - reach); z <= p.z + reach; z++) for (let y = Math.floor(p.y - 2); y <= p.y + 3; y++) {
      if (this.get(x, y, z) === B.TABLE && Math.hypot(x + .5 - p.x, y + .5 - p.y, z + .5 - p.z) < reach + 1) return true;
    }
    return false;
  }
  applyEdits(edits) {
    if (!Array.isArray(edits) || edits.length > this.blocks.length) throw new Error('Invalid saved world');
    for (const pair of edits) {
      if (!Array.isArray(pair)) throw new Error('Invalid saved block');
      const [index, id] = pair;
      if (!Number.isInteger(index) || index < SIZE * SIZE || index >= this.blocks.length || !Number.isInteger(id) || !BLOCKS[id]) throw new Error('Invalid saved block');
      if (this.version >= 4 && this.blocks[index] === B.BEDROCK && id !== B.BEDROCK) throw new Error('Cannot replace bedrock');
      this.blocks[index] = id;
      this.edits.set(index, id);
      this.baseStates.delete(index); this.changed.add(index);
    }
  }
  applyFarEdits(edits = []) {
    if (!Array.isArray(edits) || edits.length > 200000) throw new Error('Invalid streamed world');
    for (const pair of edits) {
      if (!Array.isArray(pair) || !validFarKey(pair[0], this.height) || !Number.isInteger(pair[1]) || !BLOCKS[pair[1]]) throw new Error('Invalid streamed block');
      const p = this.position(pair[0]);
      if (this.get(p.x, p.y, p.z) === B.BEDROCK) throw new Error('Cannot replace bedrock');
      this.farEdits.set(pair[0], pair[1]);
      this.baseStates.delete(pair[0]); this.changed.add(pair[0]);
    }
  }
  applyFarStates(states = []) {
    if (!Array.isArray(states) || states.length > 200000) throw new Error('Invalid streamed states');
    for (const pair of states) {
      if (!Array.isArray(pair) || !validFarKey(pair[0], this.height) || !pair[1] || typeof pair[1] !== 'object' || Array.isArray(pair[1])) throw new Error('Invalid streamed state');
      this.farStates.set(pair[0], structuredClone(pair[1]));
    }
  }
  applyStates(states = []) {
    for (const [index, value] of states) if (Number.isInteger(index) && index >= SIZE * SIZE && index < this.blocks.length && value && typeof value === 'object') this.states.set(index, structuredClone(value));
  }
}

// Voxel traversal returns the actual face hit, including the adjacent placement cell.
export function raycast(world, origin, direction, max = 6) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const axes = ['x', 'y', 'z'];
  const cell = { x, y, z }, step = {}, delta = {}, next = {};
  for (const a of axes) {
    step[a] = direction[a] < 0 ? -1 : 1;
    delta[a] = direction[a] === 0 ? Infinity : Math.abs(1 / direction[a]);
    next[a] = direction[a] === 0 ? Infinity : ((direction[a] < 0 ? origin[a] - cell[a] : cell[a] + 1 - origin[a]) * delta[a]);
  }
  let distance = 0, normal = { x: 0, y: 0, z: 0 };
  while (distance <= max) {
    const id = world.get(cell.x, cell.y, cell.z);
    if (id !== B.AIR && id !== B.WATER) {
      let intersection = null;
      for (const box of blockBoxes(id, world.stateAt(cell.x, cell.y, cell.z))) {
        const candidate = intersectBox(origin, direction, box, cell, max);
        if (candidate && (!intersection || candidate.distance < intersection.distance)) intersection = candidate;
      }
      if (intersection) { const n = intersection.normal; return { ...cell, id, normal: n, distance: intersection.distance, adjacent: { x: cell.x + n.x, y: cell.y + n.y, z: cell.z + n.z } }; }
    }
    const axis = next.x < next.y ? (next.x < next.z ? 'x' : 'z') : (next.y < next.z ? 'y' : 'z');
    if (!Number.isFinite(next[axis])) break;
    cell[axis] += step[axis]; distance = next[axis]; next[axis] += delta[axis];
    normal = { x: 0, y: 0, z: 0 }; normal[axis] = -step[axis];
  }
  return null;
}

export function collides(world, p, height = 1.8, radius = .29) {
  if (!Number.isFinite(p.x + p.y + p.z) || !world.streaming && (p.x - radius < 0 || p.z - radius < 0 || p.x + radius >= SIZE || p.z + radius >= SIZE || p.y < 0) || world.streaming && (Math.abs(p.x) + radius >= WORLD_LIMIT || Math.abs(p.z) + radius >= WORLD_LIMIT)) return true;
  for (let x = Math.floor(p.x - radius); x <= Math.floor(p.x + radius); x++) for (let z = Math.floor(p.z - radius); z <= Math.floor(p.z + radius); z++) for (let y = Math.floor(p.y + .001); y <= Math.floor(p.y + height - .001); y++) {
    for (const box of blockBoxes(world.get(x, y, z), world.stateAt(x, y, z), true)) {
      if (p.x + radius > x + box[0] + .001 && p.x - radius < x + box[3] - .001 && p.y + height > y + box[1] + .001 && p.y < y + box[4] - .001 && p.z + radius > z + box[2] + .001 && p.z - radius < z + box[5] - .001) return true;
    }
  }
  return false;
}

export function blockOverlapsPlayer(x, y, z, p) {
  return x < p.x + .29 && x + 1 > p.x - .29 && z < p.z + .29 && z + 1 > p.z - .29 && y < p.y + 1.8 && y + 1 > p.y;
}
