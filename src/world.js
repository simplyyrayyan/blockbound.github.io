import { B, BLOCKS, isSolid } from './catalog.js';
import { blockBoxes, intersectBox } from './block-shapes.js';
import { regionBiome, enrichOverworld, generateDimension } from './regions.js';

export const SIZE = 96;
export const HEIGHT = 48;
export const CHUNK = 16;
export const SEA = 12;
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
  constructor(seed = 'cedar-valley', version = 3, dimension = 'overworld') {
    this.version = version;
    this.dimension = dimension;
    this.structures = [];
    this.seed = String(seed).slice(0, 36);
    this.number = hashString(this.seed);
    this.blocks = new Uint16Array(SIZE * SIZE * HEIGHT);
    this.heights = new Uint8Array(SIZE * SIZE);
    this.edits = new Map();
    this.states = new Map();
    this.revision = 0;
    this.dirty = new Set();
    this.spawn = { x: SIZE / 2 + .5, y: 23, z: SIZE / 2 + .5 };
  }
  index(x, y, z) { return (y * SIZE + z) * SIZE + x; }
  inside(x, y, z) { return x >= 0 && x < SIZE && y >= 0 && y < HEIGHT && z >= 0 && z < SIZE; }
  get(x, y, z) { return this.inside(x, y, z) ? this.blocks[this.index(x, y, z)] : B.AIR; }
  raw(x, y, z, id) { if (this.inside(x, y, z)) this.blocks[this.index(x, y, z)] = id; }
  stateAt(x, y, z) { return this.states.get(this.index(x, y, z)) || {}; }
  setState(x, y, z, values) {
    if (!this.inside(x, y, z) || !this.get(x, y, z)) return false;
    const index = this.index(x, y, z);
    const old = this.states.get(index) || {};
    if (Object.entries(values).every(([key, value]) => old[key] === value)) return false;
    this.states.set(index, { ...this.states.get(index), ...values });
    this.dirty.add(`${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`);
    this.revision++; return true;
  }
  set(x, y, z, id) {
    if (!this.inside(x, y, z) || y === 0 || !BLOCKS[id]) return false;
    this.raw(x, y, z, id);
    this.states.delete(this.index(x, y, z)); this.revision++;
    this.edits.set(this.index(x, y, z), id);
    for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const cx = Math.floor((x + dx) / CHUNK), cz = Math.floor((z + dz) / CHUNK);
      if (cx >= 0 && cx < SIZE / CHUNK && cz >= 0 && cz < SIZE / CHUNK) this.dirty.add(`${cx},${cz}`);
    }
    return true;
  }
  surface(x, z) {
    for (let y = this.dimension === 'nether' ? HEIGHT - 9 : HEIGHT - 1; y >= 0; y--) if (isSolid(this.get(Math.floor(x), y, Math.floor(z)))) return y + 1;
    return 1;
  }
  generate() {
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
    return this;
  }
  biome(x, z) {
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
      this.blocks[index] = id;
      this.edits.set(index, id);
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
  if (p.x - radius < 0 || p.z - radius < 0 || p.x + radius >= SIZE || p.z + radius >= SIZE || p.y < 0) return true;
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
