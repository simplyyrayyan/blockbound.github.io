import { B, BLOCKS } from './catalog.js';
import { CHUNK, SIZE, hash, noise, clamp } from './world.js';
import { STRUCTURE_TYPES, generateStructures } from './regions.js';
import { STRUCTURE_BIOMES, caveBiome } from './terrain.js';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
function fractal(x, z, seed, octaves = 4) {
  let value = 0, weight = 1, sum = 0;
  for (let i = 0; i < octaves; i++) { value += noise(x, z, seed + i * 1013) * weight; sum += weight; weight *= .5; x *= 2; z *= 2; }
  return value / sum;
}
function volumeNoise(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), u = smooth(x - ix), v = smooth(y - iy), w = smooth(z - iz);
  return lerp(lerp(lerp(hash(ix, iy, iz, seed), hash(ix + 1, iy, iz, seed), u), lerp(hash(ix, iy + 1, iz, seed), hash(ix + 1, iy + 1, iz, seed), u), v), lerp(lerp(hash(ix, iy, iz + 1, seed), hash(ix + 1, iy, iz + 1, seed), u), lerp(hash(ix, iy + 1, iz + 1, seed), hash(ix + 1, iy + 1, iz + 1, seed), u), v), w);
}

// Climate and terrain use different scales. Domain warping bends rivers and
// biome borders while preserving exactly the same answer across chunk edges.
export function advancedColumn(world, x, z) {
  x = Math.floor(x); z = Math.floor(z);
  const key = x + ',' + z, cache = world.columnCache;
  if (cache.has(key)) return cache.get(key);
  const seed = world.number, sea = world.seaLevel, distance = Math.hypot(x - 48, z - 48);
  let result;
  if (world.dimension === 'nether') {
    const climate = noise(x / 120, z / 120, seed + 9);
    const biome = ['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest', 'basalt_deltas'][Math.min(4, Math.floor(climate * 5))];
    // `h` is the walkable floor of the great cavern; the lava sea sits at
    // sea level 31 the way Minecraft's Nether does.
    // Dry standing height: the lava sea surface is where players actually walk.
    let h = Math.max(netherFloor(world, x, z), NETHER_LAVA_LEVEL + 2);
    const blend = smooth(clamp((distance - 9) / 12, 0, 1)); h = Math.round(40 * (1 - blend) + h * blend);
    result = { h, biome, fluid: B.LAVA, level: 31, top: biome === 'soul_sand_valley' ? B.SOUL_SAND : biome === 'crimson_forest' ? B.CRIMSON_NYLIUM : biome === 'warped_forest' ? B.WARPED_NYLIUM : biome === 'basalt_deltas' ? B.BLACKSTONE : B.NETHERRACK };
  } else if (world.dimension === 'end') {
    const center = 1 - (distance / 82) ** 2;
    const islands = distance < 96 ? center : distance < 112 ? -1 : fractal(x / 75, z / 75, seed + 31, 3) * 2 - .98;
    const h = islands > .08 ? Math.floor(50 + islands * 13 + noise(x / 23, z / 23, seed) * 5) : -1;
    result = { h, depth: islands > .08 ? 5 + Math.floor(islands * 19) : 0, biome: distance < 112 ? 'the_end' : islands > .4 ? 'end_highlands' : islands > .2 ? 'end_midlands' : islands > .08 ? 'end_barrens' : 'small_end_islands', top: B.END_STONE, level: -1 };
  } else {
    // The world is only 96 blocks across, so landforms and climates are scaled
    // to fit inside it: a seed now spans several continents, rivers and biomes
    // instead of a single uniform sheet of terrain.
    const wx = x + (noise(x / 320, z / 320, seed + 197) - .5) * 48;
    const wz = z + (noise(x / 320, z / 320, seed + 239) - .5) * 48;
    const continent = fractal(wx / 150, wz / 150, seed + 5, 3);
    const erosion = fractal(wx / 76, wz / 76, seed + 107, 3);
    const peaks = 1 - Math.abs(fractal(wx / 88, wz / 88, seed + 761, 3) * 2 - 1);
    const temperature = clamp((fractal(wx / 118, wz / 118, seed + 17, 3) - .5) * 1.9 + .5, 0, 1);
    const moisture = clamp((fractal(wx / 96, wz / 96, seed + 83, 3) - .5) * 1.9 + .5, 0, 1);
    const riverDistance = Math.abs(noise(wx / 78, wz / 78, seed + 301) - .5);
    let h = sea + (continent - .43) * 100 + (erosion - .5) * 10;
    h += Math.max(0, peaks - .68) ** 2 * 310 * clamp((continent - .47) * 7, 0, 1);
    h += (fractal(x / 32, z / 32, seed, 3) - .5) * 8;
    if (continent < .39) h = lerp(22, sea - 3, clamp(continent / .39, 0, 1));
    if (continent > .38 && riverDistance < .048) h = lerp(sea - 4, h, smooth(clamp((riverDistance - .014) / .034, 0, 1)));
    // Only a small pad near spawn is levelled; the rest of the seed shows through.
    const safe = smooth(clamp((distance - 4) / 7, 0, 1));
    h = Math.floor(lerp(sea + 3, clamp(h, 18, 109), safe));
    let biome = h < sea - 10 ? 'deep_ocean' : h < sea ? riverDistance < .04 && continent > .38 ? 'river' : 'ocean' : h <= sea + 2 ? 'beach' :
      h > 85 ? temperature < .5 ? 'snowy_taiga' : 'stony_peaks' : temperature < .23 ? moisture > .45 ? 'snowy_taiga' : 'snowy_plains' :
      temperature > .7 ? moisture < .32 ? 'desert' : moisture > .61 ? 'jungle' : 'savanna' :
      moisture > .77 ? temperature > .57 ? 'mangrove_swamp' : 'swamp' : moisture < .31 ? 'plains' :
      temperature < .36 ? moisture > .65 ? 'old_growth_taiga' : 'taiga' : moisture > .65 ? 'dark_forest' : moisture > .56 ? 'birch_forest' : moisture > .42 ? 'forest' : h > 65 ? 'meadow' : 'plains';
    if (biome === 'desert' && noise(x / 90, z / 90, seed + 67) > .67) biome = 'badlands';
    if (biome === 'forest' && h > 64 && noise(x / 65, z / 65, seed + 99) > .65) biome = 'cherry_grove';
    else if (biome === 'forest' && noise(x / 80, z / 80, seed + 81) > .73) biome = 'flower_forest';
    if (biome === 'dark_forest' && noise(x / 80, z / 80, seed + 99) > .68) biome = 'pale_garden';
    // A rare fungal clearing gives mooshrooms somewhere to live.
    if ((biome === 'forest' || biome === 'dark_forest') && moisture > .66 && noise(x / 42, z / 42, seed + 131) > .72) biome = 'mushroom_fields';
    if (temperature < .2 && biome === 'river') biome = 'frozen_river';
    if (distance < 5) biome = 'plains';
    if (biome.includes('swamp')) h = sea;
    const top = /ocean|river|beach|desert/.test(biome) ? B.SAND : biome === 'badlands' ? B.RED_SAND : /snow/.test(biome) ? B.SNOW_BLOCK : biome.includes('swamp') ? B.MUD : /peaks|mountains/.test(biome) ? B.STONE : B.GRASS;
    result = { h, biome, top, fluid: B.WATER, level: sea, temperature, moisture, riverDistance };
  }
  if (cache.size >= 16384) cache.delete(cache.keys().next().value);
  cache.set(key, result); return result;
}


// ---------------------------------------------------------------------------
// Nether shape. Minecraft's Nether is a 3D cave network between a jagged
// bedrock floor and ceiling, with a lava sea at y=31. Terrain is carved from
// large cavern noise instead of a per-column height field.
// ---------------------------------------------------------------------------
export const NETHER_LAVA_LEVEL = 31;
export function netherFloor(world, x, z) {
  // Floor undulates around the lava sea at y=31: some of it is submerged, some
  // stands above it as islands and shelves.
  return Math.floor(22 + fractal(x / 58, z / 58, world.number + 55, 2) * 10);
}
export function netherCeiling(world, x, z) {
  return Math.floor(97 + fractal(x / 70, z / 70, world.number + 77, 2) * 20);
}

// Ore veins. Every 4x4x4 cell rolls a handful of salted hashes; a hit grows a
// blob of ore around a point inside the cell, which reads like Minecraft's
// veins instead of speckled stone. Bands and rates follow the real game's
// distribution, scaled to this 128-block world.
const OVERWORLD_VEINS = [
  { ore: 'COAL', salt: 1601, p: .0260, r: 1.5, min: 6, max: 78, stone: true },
  { ore: 'IRON', salt: 1609, p: .0210, r: 1.45, min: 4, max: 46, stone: true },
  { ore: 'COPPER_ORE', salt: 1619, p: .0080, r: 1.5, min: 16, max: 52, stone: true },
  { ore: 'GOLD', salt: 1627, p: .0060, r: 1.3, min: 2, max: 34, stone: true },
  { ore: 'REDSTONE_ORE', salt: 1637, p: .0080, r: 1.3, min: 2, max: 18, stone: true },
  { ore: 'LAPIS_ORE', salt: 1649, p: .0050, r: 1.2, min: 2, max: 32, stone: true },
  { ore: 'DIAMOND', salt: 1657, p: .0060, r: 1.3, min: 2, max: 16, stone: true, hidden: true },
  { ore: 'EMERALD_ORE', salt: 1667, p: .0044, r: .9, min: 8, max: 64, stone: true, hidden: true, biomes: ['mountains', 'stony_peaks', 'meadow', 'snowy_taiga', 'cherry_grove'] },
];
const NETHER_VEINS = [
  { ore: 'NETHER_QUARTZ_ORE', salt: 1701, p: .0100, r: 1.6, min: 8, max: 118 },
  { ore: 'NETHER_GOLD_ORE', salt: 1709, p: .0060, r: 1.4, min: 8, max: 118 },
  { ore: 'ANCIENT_DEBRIS', salt: 1721, p: .0009, r: 1.0, min: 8, max: 24 },
];
const DEEPSLATE_LINE = 22;

// Placement follows Minecraft's dimension and biome tags. One candidate per
// region, independent of exploration order, avoids overlapping landmarks.
export function advancedStructures(world, cx, cz) {
  const span = 64, result = [], x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let rx = Math.floor((x0 - 24) / span); rx <= Math.floor((x0 + CHUNK + 24) / span); rx++) for (let rz = Math.floor((z0 - 24) / span); rz <= Math.floor((z0 + CHUNK + 24) / span); rz++) {
    const key = world.dimension + ':' + rx + ',' + rz;
    if (!world.structureCache.has(key)) {
      // One landmark per region: look for the flattest fitting spot so hills and
      // noisy biomes still host villages and temples instead of nothing at all.
      let chosen = null, flattest = null;
      if (hash(rx, 8, rz, world.number) > .88) { world.structureCache.set(key, null); }
      else for (let attempt = 0; attempt < 16; attempt++) {
        const x = rx * span + 10 + Math.floor(hash(rx, attempt + 711, rz, world.number) * (span - 20));
        const z = rz * span + 10 + Math.floor(hash(rx, attempt + 891, rz, world.number) * (span - 20));
        const distance = Math.hypot(x - 48, z - 48);
        const col = advancedColumn(world, x, z), cave = caveBiome(world, x, z);
        const eligible = STRUCTURE_TYPES.filter(d => d.dimension === world.dimension && (!STRUCTURE_BIOMES[d.id] || STRUCTURE_BIOMES[d.id].includes(d.underground ? cave : col.biome)));
        if (!eligible.length || distance < 26) continue;
        // Prefer a visible landmark over yet another dungeon when the biome allows
        // one, so villages and temples are not crowded out by caves.
        const surface = eligible.filter(d => !d.underground);
        const pool = surface.length && hash(rx, attempt + 977, rz, world.number) > .34 ? surface : eligible;
        const def = pool[Math.min(pool.length - 1, Math.floor(hash(rx, attempt + 911, rz, world.number) * pool.length))];
        const samples = [[-7, -7], [7, -7], [-7, 7], [7, 7], [0, 0]].map(([dx, dz]) => advancedColumn(world, x + dx, z + dz));
        const low = Math.min(...samples.map(c => c.h)), high = Math.max(...samples.map(c => c.h)), relief = high - low;
        const aquatic = /ocean_monument|ocean_ruins|shipwreck/.test(def.id);
        if (low < 0) continue;
        if (!def.underground && !aquatic && low < (col.level || 0)) continue;
        if (def.id === 'ocean_monument' && (high > world.seaLevel - 8 || samples.some(c => !c.biome.includes('ocean')))) continue;
        if (def.id === 'end_city' && distance < 116) continue;
        const y = def.underground ? def.id === 'ancient_city' ? 13 : 20 : aquatic ? col.h + 1 : high + 1;
        if (def.underground && low < y + 12 || y + 19 >= world.height) continue;
        const candidate = { ...def, x, z, y, key, biome: def.underground ? cave : col.biome, spawns: [] };
        if (def.underground || aquatic || relief <= 10) { chosen = candidate; break; }
        if (!flattest || relief < flattest.relief) flattest = { ...candidate, relief };
      }
      // Hilly region with an eligible surface landmark: level the ground for it.
      if (!chosen && flattest) { chosen = { ...flattest }; delete chosen.relief; }
      if (world.structureCache.size > 512) world.structureCache.delete(world.structureCache.keys().next().value);
      world.structureCache.set(key, chosen);
    }
    const s = world.structureCache.get(key);
    if (s && s.x + 24 >= x0 && s.x - 24 < x0 + CHUNK && s.z + 24 >= z0 && s.z - 24 < z0 + CHUNK) result.push(s);
  }
  return result;
}

export function generateAdvancedChunk(world, cx, cz) {
  const x0 = cx * CHUNK, z0 = cz * CHUNK, seed = world.number, height = world.height, sea = world.seaLevel, nether = world.dimension === 'nether';
  const core = cx >= 0 && cz >= 0 && cx < SIZE / CHUNK && cz < SIZE / CHUNK;
  const buffer = core ? world.blocks : world.terrainChunks.get(cx + ',' + cz);
  const index = (x, y, z) => core ? (y * SIZE + z) * SIZE + x : (y * CHUNK + z - z0) * CHUNK + x - x0;
  const write = (x, y, z, id) => { if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK || y < 0 || y >= height || !Number.isInteger(id)) return; buffer[index(x, y, z)] = id; };
  const read = (x, y, z) => (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK || y < 0 || y >= height) ? -1 : buffer[index(x, y, z)];
  // Smooth 3D noise, sampled on a 4-block lattice and interpolated: the same
  // shape is produced no matter which chunk is generated first.
  const sampler = (salt, sx, sy, sz) => {
    const cache = new Map();
    const at = (a, b, c) => { const key = a + ',' + b + ',' + c; let v = cache.get(key); if (v === undefined) { v = volumeNoise(a * sx, b * sy, c * sz, seed + salt); cache.set(key, v); } return v; };
    return (x, y, z) => {
      const gx = Math.floor(x / 4), gy = Math.floor(y / 4), gz = Math.floor(z / 4);
      const u = smooth((x % 4 + 4) % 4 / 4), v = smooth((y % 4 + 4) % 4 / 4), w = smooth((z % 4 + 4) % 4 / 4);
      return lerp(lerp(lerp(at(gx, gy, gz), at(gx + 1, gy, gz), u), lerp(at(gx, gy + 1, gz), at(gx + 1, gy + 1, gz), u), v),
        lerp(lerp(at(gx, gy, gz + 1), at(gx + 1, gy, gz + 1), u), lerp(at(gx, gy + 1, gz + 1), at(gx + 1, gy + 1, gz + 1), u), v), w);
    };
  };
  const cheese = sampler(715, .19, .24, .19);
  const spaghettiA = sampler(1103, .105, .075, .105);
  const spaghettiB = sampler(1217, .1, .07, .1);
  const noodle = sampler(1301, .06, .05, .06);
  const canyonField = sampler(1601, .021, .11, .021);
  const netherMass = sampler(1451, .031, .038, .031);
  const netherDetail = sampler(1523, .082, .105, .082);

  // Caves: Minecraft-style cheese caverns, long spaghetti tunnels, thin noodles
  // and rare ravines. Openings reach the surface so cave mouths exist.
  const caveAir = (x, y, z, h) => {
    const deep = clamp((46 - y) / 40, 0, 1);
    if (cheese(x, y, z) > .70 - .07 * deep) return true;
    const a = spaghettiA(x, y, z) - .5, b = spaghettiB(x, y, z) - .5;
    if (a * a + b * b < .0026) return true;
    if (Math.abs(noodle(x, y, z) - .5) < .0022) return true;
    if (y > 4 && y < 62 && Math.abs(canyonField(x, y * .35, z) - .5) < .006) return true;
    return h - y < 4 && cheese(x, y, z) > .80;
  };
  // Nether masses: solid where the noise is high, with wide open caverns in the
  // middle band and tighter rock against the floor and ceiling.
  const netherSolid = (x, y, z, floor, ceil) => {
    // Rock is thinnest halfway between floor and ceiling, which produces the
    // Nether's huge caverns with pillars and floating masses.
    const edge = clamp(Math.min(y - floor, ceil - y) / 18, 0, 1);
    const density = netherMass(x, y, z) * .68 + netherDetail(x, y, z) * .32;
    return density > .42 + .125 * edge;
  };
  const veinBlock = (x, y, z, defs, biome) => {
    const gx = Math.floor(x / 4), gy = Math.floor(y / 4), gz = Math.floor(z / 4);
    for (const def of defs) {
      if (y < def.min || y > def.max) continue;
      if (def.biomes && !def.biomes.includes(biome)) continue;
      if (hash(gx, gy, gz, seed + def.salt) >= def.p) continue;
      const vx = gx * 4 + hash(gx, gy, gz, seed + def.salt + 1) * 4;
      const vy = gy * 4 + hash(gx, gy, gz, seed + def.salt + 2) * 4;
      const vz = gz * 4 + hash(gx, gy, gz, seed + def.salt + 3) * 4;
      if (Math.hypot(x - vx, y - vy, z - vz) > def.r) continue;
      return def;
    }
    return null;
  };

  if (nether) {
    // ---- Pass 1: 3D carve between floor, ceiling and the lava sea ----
    for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) {
      const floor = netherFloor(world, x, z), ceil = netherCeiling(world, x, z);
      if (core) world.heights[z * SIZE + x] = Math.max(1, floor);
      for (let y = 0; y < height; y++) {
        let id;
        // Both boundaries wobble in 3D so the Nether reads as jagged rock rather
        // than two flat sheets.
        const roughness = (netherDetail(x, y, z) - .5) * 16;
        const floorEdge = floor + roughness * .7, ceilEdge = ceil + roughness;
        if (y === 0) id = B.BEDROCK;
        else if (y >= height - 1) id = B.BEDROCK;
        else if (y === 1 || y === height - 2) id = hash(x, y, z, seed + 333) < .45 ? B.BEDROCK : B.NETHERRACK;
        else if (y <= floorEdge) id = hash(x, y, z, seed + 341) < .12 && y > floor - 3 ? B.MAGMA_BLOCK : B.NETHERRACK;
        else if (y >= ceilEdge) id = B.NETHERRACK;
        else if (netherSolid(x, y, z, floor, ceil)) id = B.NETHERRACK;
        else id = y <= NETHER_LAVA_LEVEL ? B.LAVA : B.AIR;
        write(x, y, z, id);
      }
      // Lava falls: rare streams pouring from the ceiling into the sea.
      if (hash(x, 7, z, seed + 505) < .004) {
        const from = Math.max(NETHER_LAVA_LEVEL + 2, ceil - 1);
        for (let y = NETHER_LAVA_LEVEL; y <= from; y++) if (read(x, y, z) === B.AIR) write(x, y, z, B.LAVA);
      }
    }
    // ---- Pass 2: biome skins, glowstone, fire, veins and gravel ----
    for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) {
      const col = advancedColumn(world, x, z), biome = col.biome, roll = hash(x, 3, z, seed + 211);
      for (let y = 1; y < height - 1; y++) {
        const id = read(x, y, z);
        if (id !== B.NETHERRACK) {
          if (id === B.AIR && y > NETHER_LAVA_LEVEL && read(x, y + 1, z) === B.NETHERRACK && y > 40 && hash(x, y, z, seed + 1701) < .0075) write(x, y, z, B.GLOWSTONE);
          continue;
        }
        const above = read(x, y + 1, z);
        const open = above === B.AIR || above === B.LAVA;
        if (open) {
          // Biome skin on the exposed surface, exactly where a player would stand.
          if (biome === 'soul_sand_valley') write(x, y, z, roll < .42 ? B.SOUL_SAND : roll < .52 ? B.SOUL_SOIL : B.NETHERRACK);
          else if (biome === 'crimson_forest') write(x, y, z, roll < .72 ? B.CRIMSON_NYLIUM : B.NETHERRACK);
          else if (biome === 'warped_forest') write(x, y, z, roll < .72 ? B.WARPED_NYLIUM : B.NETHERRACK);
          else if (biome === 'basalt_deltas') write(x, y, z, roll < .38 ? B.BASALT : roll < .52 ? B.BLACKSTONE : B.NETHERRACK);
          else if (roll < .06) write(x, y, z, B.GRAVEL);
          else if (y <= NETHER_LAVA_LEVEL + 3 && roll > .93) write(x, y, z, B.MAGMA_BLOCK);
          const top = read(x, y, z);
          if (y > NETHER_LAVA_LEVEL && (top === B.NETHERRACK || top === B.SOUL_SOIL) && hash(x, y, z, seed + 1901) < .01) write(x, y + 1, z, B.FIRE);
          else if (top === B.SOUL_SAND && hash(x, y, z, seed + 1907) < .012) write(x, y + 1, z, B.SOUL_FIRE);
        } else if (open === false && read(x, y - 1, z) === B.AIR) {
          // Ceiling underside: glowstone hangs in clusters.
          if (y > 44 && hash(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2), seed + 1733) < .05) write(x, y, z, B.GLOWSTONE);
        }
        const vein = veinBlock(x, y, z, NETHER_VEINS, biome);
        if (vein) write(x, y, z, B[vein.ore]);
      }
      // Stalactites hang from the ceiling, stalagmites rise from the floor.
      for (let y = height - 3; y > NETHER_LAVA_LEVEL; y--) if (read(x, y, z) === B.NETHERRACK && read(x, y - 1, z) === B.AIR) {
        if (y > 62 && hash(x, y, z, seed + 2203) < .05) {
          const length = 2 + Math.floor(hash(x, y, z, seed + 2207) * 5);
          for (let k = 1; k <= length && read(x, y - k, z) === B.AIR; k++) write(x, y - k, z, B.NETHERRACK);
        }
        break;
      }
      for (let y = NETHER_LAVA_LEVEL + 1; y < height - 3; y++) if (read(x, y, z) === B.AIR && read(x, y - 1, z) !== B.AIR && read(x, y - 1, z) !== B.LAVA) {
        if (y < 46 && hash(x, y, z, seed + 2211) < .04 && read(x, y - 1, z) === B.NETHERRACK) {
          const length = 1 + Math.floor(hash(x, y, z, seed + 2213) * 4);
          for (let k = 0; k < length && read(x, y + k, z) === B.AIR; k++) write(x, y + k, z, B.NETHERRACK);
        }
        break;
      }
    }
    // Huge fungi in the forests, planted on nylium.
    for (let x = x0 - 4; x < x0 + CHUNK + 4; x++) for (let z = z0 - 4; z < z0 + CHUNK + 4; z++) {
      const biome = advancedColumn(world, x, z).biome;
      if (!biome.includes('forest') || hash(x, 0, z, seed + 33) >= .022 || hash(x - 1, 0, z, seed + 33) < .022) continue;
      let base = -1;
      for (let y = height - 3; y > 1; y--) if (read(x, y, z) === B.NETHERRACK && read(x, y + 1, z) === B.AIR) { base = y; break; }
      if (base < NETHER_LAVA_LEVEL + 2) continue;
      const family = biome === 'warped_forest' ? 'WARPED' : 'CRIMSON';
      const stem = B[family + '_STEM'] || B.CRIMSON_STEM, wart = family === 'CRIMSON' ? B.NETHER_WART_BLOCK : B.WARPED_WART_BLOCK;
      const tall = 4 + Math.floor(hash(x, base, z, seed) * 6);
      for (let dy = 1; dy <= tall; dy++) write(x, base + dy, z, stem);
      for (let dy = tall - 1; dy <= tall + 1; dy++) {
        const radius = dy === tall + 1 ? 1 : 2;
        for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > radius * 1.5 + .5) continue;
          const py = base + dy, px = x + dx, pz = z + dz;
          const old = read(px, py, pz);
          if (old === B.AIR || old === B.GLOWSTONE || BLOCKS[old]?.shape === 'plant') write(px, py, pz, hash(px, dy, pz, seed) < .07 ? B.SHROOMLIGHT : wart);
        }
      }
    }
  } else {
    // ---- Overworld and End pass 1: columns, caves, surfaces ----
    for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) {
      const col = advancedColumn(world, x, z), { h, biome, top } = col;
      if (core) world.heights[z * SIZE + x] = Math.max(0, h);
      const caves = caveBiome(world, x, z);
      const max = world.dimension === 'end' ? h : Math.max(h, col.level);
      for (let y = 0; y <= max; y++) {
        let id = B.AIR;
        const r = hash(x, y, z, seed + 333);
        if (world.dimension === 'end') id = h >= 0 && y >= h - col.depth && y <= h ? B.END_STONE : B.AIR;
        else if (y === 0) id = B.BEDROCK;
        else if (y > h) id = y <= sea ? biome === 'frozen_river' && y === sea ? B.ICE : B.WATER : B.AIR;
        else if (y === h) id = top;
        else if (y >= h - 3) id = top === B.SAND ? B.SANDSTONE : top === B.RED_SAND ? B.TERRACOTTA : B.DIRT;
        else {
          id = y < DEEPSLATE_LINE ? B.DEEPSLATE : r > .975 ? B.GRANITE : r > .95 ? B.ANDESITE : r > .93 ? B.DIORITE : B.STONE;
          if (y > 3 && caveAir(x, y, z, h)) id = y < 9 ? B.LAVA : B.AIR;
          if (id !== B.AIR && id !== B.LAVA && y < 23 && caves === 'deep_dark' && r < .38) id = B.SCULK;
          if (id === B.DEEPSLATE && caves === 'sulfur_caves' && r < .25) id = r < .08 ? B.CINNABAR : B.SULFUR;
        }
        write(x, y, z, id);
      }
      const roll = hash(x, 1, z, seed + 211);
      if (world.dimension === 'overworld') {
        if (h < sea - 1 && roll < .07) { write(x, h + 1, z, B.SEAGRASS); world.generatedState(x, h + 1, z, { waterlogged: true }); }
        if (biome === 'desert' && roll < .007) for (let dy = 1; dy < 4; dy++) write(x, h + dy, z, B.CACTUS);
        if (top === B.GRASS && h > sea && roll < .085 && Math.hypot(x - 48, z - 48) > 7) write(x, h + 1, z, roll < .008 ? B.POPPY : roll < .016 ? B.DANDELION : B.SHORT_GRASS);
      } else if (world.dimension === 'end' && h > 0 && biome !== 'the_end' && roll < .02) { for (let dy = 1; dy < 5; dy++) write(x, h + dy, z, B.CHORUS_PLANT); write(x, h + 5, z, B.CHORUS_FLOWER); }
    }
    // ---- Pass 2: ore veins, hidden from the surface like the real game ----
    if (world.dimension === 'overworld') for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) {
      const col = advancedColumn(world, x, z), biome = col.biome, surface = col.h;
      for (let y = 1; y < Math.min(surface - 3, DEEPSLATE_LINE + 40); y++) {
        const id = read(x, y, z);
        if (id !== B.STONE && id !== B.DEEPSLATE) continue;
        // Ore never sits in open air: a vein shows at most one exposed face, and
        // the rare deep ores stay buried in the rock.
        const faces = [read(x + 1, y, z), read(x - 1, y, z), read(x, y + 1, z), read(x, y - 1, z), read(x, y, z + 1), read(x, y, z - 1)].filter(n => n === B.AIR || n === B.WATER).length;
        const vein = veinBlock(x, y, z, OVERWORLD_VEINS, biome);
        if (!vein) continue;
        if (faces > (vein.hidden ? 1 : 2)) continue;
        write(x, y, z, y < DEEPSLATE_LINE ? B['DEEPSLATE_' + (BLOCKS[B[vein.ore]]?.reference || '').toUpperCase()] || B[vein.ore] : B[vein.ore]);
      }
    }
    // ---- Trees and plants ----
    for (let x = x0 - 4; x < x0 + CHUNK + 4; x++) for (let z = z0 - 4; z < z0 + CHUNK + 4; z++) {
      const { h, biome, top } = advancedColumn(world, x, z);
      const tutorial = world.dimension === 'overworld' && (x === 49 && z === 44 || x === 43 && z === 46);
      const forest = /forest|jungle|taiga|garden|grove/.test(biome), density = forest ? .014 : .0018;
      if (world.dimension === 'end' || ![B.GRASS, B.SNOW_BLOCK].includes(top)) continue;
      if (!tutorial && (Math.hypot(x - 48, z - 48) < 12 || hash(x, 0, z, seed + 33) >= density || hash(x - 1, 0, z, seed + 33) < density)) continue;
      const family = /taiga|snow/.test(biome) ? 'SPRUCE' : biome === 'birch_forest' ? 'BIRCH' : biome === 'cherry_grove' ? 'CHERRY' : biome === 'pale_garden' ? 'PALE_OAK' : biome === 'dark_forest' ? 'DARK_OAK' : biome === 'jungle' ? 'JUNGLE' : biome === 'savanna' ? 'ACACIA' : biome === 'mangrove_swamp' ? 'MANGROVE' : 'OAK';
      const log = B[family + '_LOG'] || B.LOG, leaf = B[family + '_LEAVES'] || B.LEAVES;
      const tall = 5 + Math.floor(hash(x, h, z, seed) * (family === 'JUNGLE' || family === 'SPRUCE' ? 6 : 3));
      for (let dy = 1; dy <= tall; dy++) write(x, h + dy, z, log);
      for (let dy = 2; dy <= tall + 1; dy++) {
        const radius = family === 'SPRUCE' ? Math.max(0, Math.floor((tall + 1 - dy) / 3)) : dy < tall - 2 ? 0 : dy === tall + 1 ? 1 : 2;
        if (!radius && dy !== tall + 1) continue;
        for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
          if (!dx && !dz && dy <= tall || Math.abs(dx) + Math.abs(dz) > radius * 1.5 + .5) continue;
          const px = x + dx, pz = z + dz, py = h + dy;
          if (px < x0 || px >= x0 + CHUNK || pz < z0 || pz >= z0 + CHUNK) continue;
          const old = read(px, py, pz);
          if (!old || BLOCKS[old]?.shape === 'plant') write(px, py, pz, leaf);
        }
      }
    }
  }
  world.generationBounds = { x0, z0 }; generateStructures(world, advancedStructures(world, cx, cz)); world.generationBounds = null;
  if (world.dimension !== 'overworld') {
    // A safe arrival platform: floor, walls and headroom carved above the lava.
    const sy = Math.max(NETHER_LAVA_LEVEL + 2, nether ? netherFloor(world, 48, 48) + 1 : advancedColumn(world, 48, 48).h + 1);
    world.platformY = sy;
    for (let x = 43; x <= 54; x++) for (let z = 41; z <= 53; z++) { write(x, sy - 1, z, B.OBSIDIAN); for (let y = sy; y < sy + 7; y++) write(x, y, z, B.AIR); }
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) write(46 + dx, sy - 1 + dy, 43, !dx || dx === 3 || !dy || dy === 4 ? B.OBSIDIAN : world.dimension === 'nether' ? B.NETHER_PORTAL : B.END_PORTAL);
    if (world.dimension === 'end') for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, px = Math.round(48 + Math.cos(angle) * 36), pz = Math.round(48 + Math.sin(angle) * 36), top = 78 + i % 3 * 5;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (dx * dx + dz * dz < 6) for (let y = advancedColumn(world, px, pz).h; y <= top; y++) write(px + dx, y, pz + dz, B.OBSIDIAN);
      write(px, top + 1, pz, B.SEA_LANTERN);
    }
  }
}
