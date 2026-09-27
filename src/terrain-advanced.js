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
    let h = Math.floor(22 + fractal(x / 75, z / 75, seed + 55, 3) * 34);
    const blend = smooth(clamp((distance - 9) / 12, 0, 1)); h = Math.round(44 * (1 - blend) + h * blend);
    result = { h, biome, fluid: B.LAVA, level: 32, top: biome === 'soul_sand_valley' ? B.SOUL_SAND : biome === 'crimson_forest' ? B.CRIMSON_NYLIUM : biome === 'warped_forest' ? B.WARPED_NYLIUM : biome === 'basalt_deltas' ? B.BLACKSTONE : B.NETHERRACK };
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
  const x0 = cx * CHUNK, z0 = cz * CHUNK, seed = world.number, height = world.height, sea = world.seaLevel;
  const core = cx >= 0 && cz >= 0 && cx < SIZE / CHUNK && cz < SIZE / CHUNK;
  const buffer = core ? world.blocks : world.terrainChunks.get(cx + ',' + cz);
  const write = (x, y, z, id) => { if (x < x0 || x >= x0 + CHUNK || z < z0 || z >= z0 + CHUNK || y < 0 || y >= height || !Number.isInteger(id)) return; buffer[core ? (y * SIZE + z) * SIZE + x : (y * CHUNK + z - z0) * CHUNK + x - x0] = id; };
  const density = new Map();
  const caveAt = (x, y, z) => {
    const gx = Math.floor(x / 4), gy = Math.floor(y / 4), gz = Math.floor(z / 4), u = smooth((x % 4 + 4) % 4 / 4), v = smooth(y % 4 / 4), w = smooth((z % 4 + 4) % 4 / 4);
    const sample = (a, b, c) => { const k = a + ',' + b + ',' + c; if (!density.has(k)) density.set(k, volumeNoise(a * .19, b * .24, c * .19, seed + 715)); return density.get(k); };
    return lerp(lerp(lerp(sample(gx, gy, gz), sample(gx + 1, gy, gz), u), lerp(sample(gx, gy + 1, gz), sample(gx + 1, gy + 1, gz), u), v), lerp(lerp(sample(gx, gy, gz + 1), sample(gx + 1, gy, gz + 1), u), lerp(sample(gx, gy + 1, gz + 1), sample(gx + 1, gy + 1, gz + 1), u), v), w);
  };
  for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) {
    const col = advancedColumn(world, x, z), { h, biome, top } = col;
    if (core) world.heights[z * SIZE + x] = Math.max(0, h);
    const caves = caveBiome(world, x, z), roof = 101 + Math.floor(noise(x / 37, z / 37, seed) * 15);
    const max = world.dimension === 'nether' ? height - 1 : Math.max(h, col.level);
    for (let y = 0; y <= max; y++) {
      let id = B.AIR;
      const r = hash(x, y, z, seed + 333);
      if (world.dimension === 'end') id = h >= 0 && y >= h - col.depth && y <= h ? B.END_STONE : B.AIR;
      else if (y === 0 || world.dimension === 'nether' && y === height - 1) id = B.BEDROCK;
      else if (world.dimension === 'nether') {
        id = y <= h || y >= roof ? y === h ? top : r < .009 && y < 24 ? B.ANCIENT_DEBRIS : r < .035 ? B.NETHER_QUARTZ_ORE : r < .05 ? B.NETHER_GOLD_ORE : B.NETHERRACK : y <= col.level ? B.LAVA : B.AIR;
        if (y === roof - 1 && r < .03) id = B.GLOWSTONE;
      } else if (y > h) id = y <= sea ? biome === 'frozen_river' && y === sea ? B.ICE : B.WATER : B.AIR;
      else if (y === h) id = top;
      else if (y >= h - 3) id = top === B.SAND ? B.SANDSTONE : top === B.RED_SAND ? B.TERRACOTTA : B.DIRT;
      else {
        id = y < 22 ? B.DEEPSLATE : r > .975 ? B.GRANITE : r > .95 ? B.ANDESITE : r > .93 ? B.DIORITE : B.STONE;
        const vein = hash(Math.floor(x / 3), Math.floor(y / 3), Math.floor(z / 3), seed + 845);
        const ore = vein < .028 && y < 18 ? B.DIAMOND : vein > .965 && y < 32 ? B.GOLD : vein > .12 && vein < .2 ? B.IRON : vein > .42 && vein < .5 && y > 20 ? B.COAL : vein > .6 && vein < .65 && y > 20 ? B.COPPER_ORE : vein > .72 && vein < .745 && y < 25 ? B.REDSTONE_ORE : vein > .81 && vein < .835 ? B.LAPIS_ORE : vein > .85 && vein < .858 && h > 70 ? B.EMERALD_ORE : null;
        if (ore && r < .75) id = y < 22 ? B['DEEPSLATE_' + BLOCKS[ore].reference?.toUpperCase()] || ore : ore;
        if (y > 3 && y < h - 5 && caveAt(x, y, z) > .665) id = y < 8 ? B.LAVA : B.AIR;
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
  for (let x = x0 - 4; x < x0 + CHUNK + 4; x++) for (let z = z0 - 4; z < z0 + CHUNK + 4; z++) {
    const { h, biome, top } = advancedColumn(world, x, z), nether = world.dimension === 'nether';
    const tutorial = world.dimension === 'overworld' && (x === 49 && z === 44 || x === 43 && z === 46);
    const forest = /forest|jungle|taiga|garden|grove/.test(biome), density = forest ? .014 : .0018;
    if (world.dimension === 'end' || nether && !biome.includes('forest') || !nether && ![B.GRASS, B.SNOW_BLOCK].includes(top)) continue;
    if (!tutorial && (Math.hypot(x - 48, z - 48) < 12 || hash(x, 0, z, seed + 33) >= density || hash(x - 1, 0, z, seed + 33) < density)) continue;
    const family = nether ? biome === 'warped_forest' ? 'WARPED' : 'CRIMSON' : /taiga|snow/.test(biome) ? 'SPRUCE' : biome === 'birch_forest' ? 'BIRCH' : biome === 'cherry_grove' ? 'CHERRY' : biome === 'pale_garden' ? 'PALE_OAK' : biome === 'dark_forest' ? 'DARK_OAK' : biome === 'jungle' ? 'JUNGLE' : biome === 'savanna' ? 'ACACIA' : biome === 'mangrove_swamp' ? 'MANGROVE' : 'OAK';
    const log = B[family + (nether ? '_STEM' : '_LOG')] || B.LOG, leaf = nether ? family === 'CRIMSON' ? B.NETHER_WART_BLOCK : B.WARPED_WART_BLOCK : B[family + '_LEAVES'] || B.LEAVES;
    const tall = 5 + Math.floor(hash(x, h, z, seed) * (family === 'JUNGLE' || family === 'SPRUCE' ? 6 : 3));
    for (let dy = 1; dy <= tall; dy++) write(x, h + dy, z, log);
    for (let dy = 2; dy <= tall + 1; dy++) {
      const radius = family === 'SPRUCE' ? Math.max(0, Math.floor((tall + 1 - dy) / 3)) : dy < tall - 2 ? 0 : dy === tall + 1 ? 1 : 2;
      if (!radius && dy !== tall + 1) continue;
      for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
        if (!dx && !dz && dy <= tall || Math.abs(dx) + Math.abs(dz) > radius * 1.5 + .5) continue;
        const px = x + dx, pz = z + dz, py = h + dy;
        if (px < x0 || px >= x0 + CHUNK || pz < z0 || pz >= z0 + CHUNK) continue;
        const old = buffer[core ? (py * SIZE + pz) * SIZE + px : (py * CHUNK + pz - z0) * CHUNK + px - x0];
        if (!old || BLOCKS[old]?.shape === 'plant') write(px, py, pz, nether && hash(px, dy, pz, seed) < .08 ? B.SHROOMLIGHT : leaf);
      }
    }
  }
  world.generationBounds = { x0, z0 }; generateStructures(world, advancedStructures(world, cx, cz)); world.generationBounds = null;
  if (world.dimension !== 'overworld') {
    const sy = advancedColumn(world, 48, 48).h + 1;
    for (let x = 43; x <= 54; x++) for (let z = 41; z <= 53; z++) { write(x, sy - 1, z, B.OBSIDIAN); for (let y = sy; y < sy + 7; y++) write(x, y, z, B.AIR); }
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) write(46 + dx, sy - 1 + dy, 43, !dx || dx === 3 || !dy || dy === 4 ? B.OBSIDIAN : world.dimension === 'nether' ? B.NETHER_PORTAL : B.END_PORTAL);
    if (world.dimension === 'end') for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, px = Math.round(48 + Math.cos(angle) * 36), pz = Math.round(48 + Math.sin(angle) * 36), top = 78 + i % 3 * 5;
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (dx * dx + dz * dz < 6) for (let y = advancedColumn(world, px, pz).h; y <= top; y++) write(px + dx, y, pz + dz, B.OBSIDIAN);
      write(px, top + 1, pz, B.SEA_LANTERN);
    }
  }
}
