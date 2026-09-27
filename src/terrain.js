import { B, BLOCKS } from './catalog.js';
import { CHUNK, HEIGHT, SEA, SIZE, hash, noise, clamp } from './world.js';
import { STRUCTURE_TYPES, generateStructures } from './regions.js';
import { advancedColumn, advancedStructures, generateAdvancedChunk } from './terrain-advanced.js';

// Minecraft biome tags: https://github.com/misode/mcmeta/tree/data/data/minecraft/tags/worldgen/biome/has_structure
export const STRUCTURE_BIOMES = {
  village: ['plains', 'meadow', 'desert', 'savanna', 'snowy_plains', 'taiga'],
  desert_pyramid: ['desert'], jungle_temple: ['jungle'], woodland_mansion: ['dark_forest', 'pale_garden'],
  ocean_monument: ['deep_ocean'], ocean_ruins: ['ocean', 'deep_ocean'], shipwreck: ['ocean', 'deep_ocean', 'beach'], buried_treasure: ['beach'],
  pillager_outpost: ['plains', 'meadow', 'desert', 'savanna', 'taiga', 'snowy_plains', 'mountains'],
  igloo: ['snowy_plains', 'snowy_taiga'], witch_hut: ['swamp'], trail_ruins: ['taiga', 'snowy_taiga', 'jungle', 'birch_forest'],
  ancient_city: ['deep_dark'],
  bastion_remnant: ['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest'],
  end_city: ['end_highlands', 'end_midlands', 'the_end'],
};
const NETHER = ['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest', 'basalt_deltas'];
export function terrainColumn(world, x, z) {
  if (world.version >= 5) return advancedColumn(world, x, z);
  const seed = world.number, distance = Math.hypot(x - 48, z - 48);
  if (world.dimension === 'nether') {
    const biome = NETHER[Math.min(4, Math.floor(noise(x / 70, z / 70, seed + 9) * 5))];
    let h = Math.floor(8 + noise(x / 35, z / 35, seed + 50) * 16);
    if (distance < 18) { const flat = clamp((distance - 9) / 9, 0, 1); h = Math.round(22 * (1 - flat) + h * flat); }
    return { h, biome, fluid: B.LAVA, level: 12, top: biome === 'soul_sand_valley' ? B.SOUL_SAND : biome === 'crimson_forest' ? B.CRIMSON_NYLIUM : biome === 'warped_forest' ? B.WARPED_NYLIUM : biome === 'basalt_deltas' ? B.BLACKSTONE : B.NETHERRACK };
  }
  if (world.dimension === 'end') {
    const islands = distance < 32 ? 1 - distance / 45 : distance < 65 ? 0 : noise(x / 27, z / 27, seed + 31);
    const h = islands > .53 ? Math.floor(15 + noise(x / 25, z / 25, seed) * 10) : -1;
    return { h, biome: distance < 65 ? 'the_end' : islands > .7 ? 'end_highlands' : islands > .6 ? 'end_midlands' : islands > .53 ? 'end_barrens' : 'small_end_islands', top: B.END_STONE, level: -1 };
  }
  const land = noise(x / 120, z / 120, seed + 5), temperature = noise(x / 85, z / 85, seed + 17), moisture = noise(x / 76, z / 76, seed + 83);
  const ridge = Math.abs(noise(x / 53, z / 53, seed + 7) * 2 - 1);
  const river = Math.abs(noise(x / 68, z / 68, seed + 301) - .5);
  let h = Math.floor(9 + land * 17 + noise(x / 24, z / 24, seed) * 4 + Math.max(0, ridge - .48) * 25);
  if (land < .27) h = Math.floor(3 + land * 26);
  else if (river < .025) h = 8 + Math.floor(river * 100);
  const flat = clamp((distance - 8) / 8, 0, 1);
  h = Math.round(22 * (1 - flat) + h * flat);
  let biome = h < 7 ? 'deep_ocean' : h < SEA ? (river < .025 && land >= .27 ? 'river' : 'ocean') : h <= SEA + 1 ? 'beach' :
    h >= 30 ? temperature < .4 ? 'snowy_taiga' : 'mountains' : temperature < .24 ? moisture > .5 ? 'snowy_taiga' : 'snowy_plains' :
      temperature > .67 ? moisture < .4 ? 'desert' : moisture > .65 ? 'jungle' : 'savanna' :
        moisture > .74 ? 'swamp' : moisture < .3 ? 'plains' : temperature < .35 ? 'taiga' :
          moisture > .62 ? temperature > .52 ? 'cherry_grove' : 'dark_forest' : moisture > .54 ? 'birch_forest' : 'forest';
  if (distance < 16) biome = 'plains';
  if (biome === 'dark_forest' && noise(x / 35, z / 35, seed + 99) > .66) biome = 'pale_garden';
  if (biome === 'desert' && temperature > .76) biome = 'badlands';
  if (biome === 'swamp' && temperature > .54) biome = 'mangrove_swamp';
  if (biome === 'forest' && noise(x / 35, z / 35, seed + 99) > .7) biome = 'flower_forest';
  if (biome.includes('swamp')) h = SEA;
  const top = /ocean|river|beach|desert/.test(biome) ? B.SAND : /snow/.test(biome) ? B.SNOW_BLOCK : biome === 'swamp' ? B.MUD : biome === 'mountains' ? B.STONE : B.GRASS;
  return { h, biome, top: biome === 'badlands' ? B.RED_SAND : biome === 'mangrove_swamp' ? B.MUD : top, fluid: B.WATER, level: SEA };
}
export function caveBiome(world, x, z) {
  const value = noise(x / 48, z / 48, world.number + 703);
  return value < .25 ? 'deep_dark' : value > .79 ? 'sulfur_caves' : 'caves';
}
export function structureCandidates(world, cx, cz) {
  if (world.version >= 5) return advancedStructures(world, cx, cz);
  const HEIGHT = world.height;
  const result = [], span = 96, x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let rx = Math.floor((x0 - 16) / span); rx <= Math.floor((x0 + CHUNK + 16) / span); rx++) for (let rz = Math.floor((z0 - 16) / span); rz <= Math.floor((z0 + CHUNK + 16) / span); rz++) {
    if (hash(rx, 81, rz, world.number) > .75) continue;
    for (let attempt = 0; attempt < 10; attempt++) {
      const x = rx * span + 16 + Math.floor(hash(rx, attempt + 711, rz, world.number) * 64), z = rz * span + 16 + Math.floor(hash(rx, attempt + 891, rz, world.number) * 64);
      if (Math.hypot(x - 48, z - 48) < 27) continue;
      const col = terrainColumn(world, x, z);
      const eligible = STRUCTURE_TYPES.filter(d => d.dimension === world.dimension && (!STRUCTURE_BIOMES[d.id] || STRUCTURE_BIOMES[d.id].includes(d.underground ? caveBiome(world, x, z) : col.biome)));
      if (!eligible.length) continue;
      const def = eligible[Math.floor(hash(rx, attempt + 911, rz, world.number) * eligible.length)];
      const samples = [[-10, -10], [10, -10], [-10, 10], [10, 10]].map(([dx, dz]) => terrainColumn(world, x + dx, z + dz));
      const low = Math.min(col.h, ...samples.map(c => c.h)), high = Math.max(col.h, ...samples.map(c => c.h));
      const aquatic = /ocean_monument|ocean_ruins|shipwreck/.test(def.id);
      if (low < 0 || def.underground && low < def.underground + 10) continue;
      if (!def.underground && !aquatic && (low < (col.level ?? 0) || high - low > 3)) continue;
      if (def.id === 'ocean_monument' && (high > SEA - 7 || samples.some(c => !c.biome.includes('ocean')))) continue;
      const y = def.underground || (aquatic ? col.h + 1 : high + 1);
      if (def.id === 'end_city' && y + 17 >= HEIGHT || !def.underground && y + 13 >= HEIGHT) continue;
      const s = { ...def, x, z, y, biome: def.underground ? caveBiome(world, x, z) : col.biome, key: `${world.dimension}:${rx},${rz}`, spawns: [] };
      if (x + 16 >= x0 && x - 16 < x0 + CHUNK && z + 16 >= z0 && z - 16 < z0 + CHUNK) result.push(s);
      break;
    }
  }
  return result;
}

export function generateChunk(world, cx, cz) {
  if (world.version >= 5) return generateAdvancedChunk(world, cx, cz);
  const HEIGHT = world.height;
  const x0 = cx * CHUNK, z0 = cz * CHUNK, seed = world.number, columns = new Map();
  const column = (x, z) => { const key = `${x},${z}`; if (!columns.has(key)) columns.set(key, terrainColumn(world, x, z)); return columns.get(key); };
  const put = (x, y, z, id) => { if (x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK && y >= 0 && y < HEIGHT) world.raw(x, y, z, id); };
  for (let x = x0; x < x0 + CHUNK; x++) for (let z = z0; z < z0 + CHUNK; z++) {
    const { h, biome, top, fluid, level } = column(x, z);
    const caveType = world.dimension === 'overworld' ? caveBiome(world, x, z) : null;
    if (x >= 0 && x < SIZE && z >= 0 && z < SIZE) world.heights[z * SIZE + x] = Math.max(0, h);
    for (let y = 0; y < HEIGHT; y++) {
      let id = B.AIR;
      if (world.dimension === 'end') id = h >= 0 && y >= h - 7 && y <= h ? B.END_STONE : B.AIR;
      else if (y === 0 || world.dimension === 'nether' && y === HEIGHT - 1) id = B.BEDROCK;
      else if (world.dimension === 'nether') {
        const r = hash(x, y, z, seed), roof = 42 + Math.floor(noise(x / 13, z / 13, seed) * 3);
        id = y === h ? top : y < h || y >= roof ? r < .008 && y < 10 ? B.ANCIENT_DEBRIS : r < .035 ? B.NETHER_QUARTZ_ORE : r < .05 ? B.NETHER_GOLD_ORE : B.NETHERRACK : y <= level ? fluid : B.AIR;
        if (y === roof - 1 && r < .025) id = B.GLOWSTONE;
      } else if (y > h) id = y <= level ? fluid : B.AIR;
      else if (y === h) id = top;
      else if (y > h - 3) id = top === B.SAND ? B.SANDSTONE : top === B.RED_SAND ? B.TERRACOTTA : B.DIRT;
      else {
        const vein = hash(Math.floor(x / 2), Math.floor(y / 2), Math.floor(z / 2), seed + 845), r = hash(x, y, z, seed + 333);
        id = y < 6 ? B.DEEPSLATE : r > .95 ? B.GRANITE : r > .92 ? B.ANDESITE : r > .9 ? B.DIORITE : B.STONE;
        if (r < .8) {
          const ore = vein < .027 && y < 9 ? B.DIAMOND : vein > .965 && y < 13 ? B.GOLD : vein > .12 && vein < .22 ? B.IRON : vein > .42 && vein < .53 ? B.COAL : vein > .6 && vein < .64 ? B.COPPER_ORE : vein > .72 && vein < .74 && y < 12 ? B.REDSTONE_ORE : vein > .81 && vein < .83 ? B.LAPIS_ORE : vein > .84 && vein < .846 && /mountain|taiga/.test(biome) ? B.EMERALD_ORE : null;
          if (ore) id = y < 6 ? B[`DEEPSLATE_${BLOCKS[ore].reference?.toUpperCase()}`] || ore : ore;
        }
        const cave = Math.sin(x * .12 + y * .32 + seed % 31) + Math.sin(z * .13 - y * .29) + Math.sin((x + z) * .08 + y * .37);
        if (y > 2 && y < h - 4 && cave > 2.2) id = B.AIR;
        if (y < 7 && caveType === 'deep_dark' && id === B.DEEPSLATE) id = B.SCULK;
        if (y < 10 && caveType === 'sulfur_caves' && [B.STONE, B.DEEPSLATE].includes(id)) id = r < .2 ? B.CINNABAR : B.SULFUR;
      }
      put(x, y, z, id);
    }
    const roll = hash(x, 1, z, seed + 211);
    if (world.dimension === 'overworld') {
      if (h < SEA && roll < .16) { put(x, h + 1, z, B.SEAGRASS); world.generatedState(x, h + 1, z, { waterlogged: true }); }
      else if (biome === 'desert' && roll < .01) for (let dy = 1; dy < 4; dy++) put(x, h + dy, z, B.CACTUS);
      else if (h > SEA + 1 && top === B.GRASS && roll < .09 && Math.hypot(x - 48, z - 48) > 7) put(x, h + 1, z, roll < .015 ? B.POPPY : B.SHORT_GRASS);
    } else if (world.dimension === 'end' && h >= 0 && biome !== 'the_end' && roll < .016) { for (let dy = 1; dy < 4; dy++) put(x, h + dy, z, B.CHORUS_PLANT); put(x, h + 4, z, B.CHORUS_FLOWER); }
  }
  for (let x = x0 - 3; x < x0 + CHUNK + 3; x++) for (let z = z0 - 3; z < z0 + CHUNK + 3; z++) {
    const { h, biome, top } = column(x, z), netherTree = world.dimension === 'nether' && biome.includes('forest');
    const tutorial = world.dimension === 'overworld' && (x === 49 && z === 44 || x === 43 && z === 46);
    const density = /forest|jungle|taiga|garden|grove/.test(biome) ? .025 : .003;
    if (!tutorial && (Math.hypot(x - 48, z - 48) < 10 || hash(x, 0, z, seed + 33) >= density)) continue;
    if (world.dimension === 'end' || !netherTree && ![B.GRASS, B.SNOW_BLOCK].includes(top) || h <= SEA) continue;
    const family = netherTree ? biome === 'warped_forest' ? 'WARPED' : 'CRIMSON' : biome === 'cherry_grove' ? 'CHERRY' : biome === 'pale_garden' ? 'PALE_OAK' : biome === 'dark_forest' ? 'DARK_OAK' : /taiga|snow/.test(biome) ? 'SPRUCE' : biome === 'birch_forest' ? 'BIRCH' : biome === 'jungle' ? 'JUNGLE' : biome === 'savanna' ? 'ACACIA' : 'OAK';
    const log = B[`${family}_${netherTree ? 'STEM' : 'LOG'}`] || B.LOG, leaf = netherTree ? B[`${family}_WART_BLOCK`] : B[`${family}_LEAVES`] || B.LEAVES;
    const height = 5 + Math.floor(hash(x, h, z, seed) * 2);
    for (let dy = 1; dy <= height; dy++) put(x, h + dy, z, log);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = height - 2; dy <= height + 1; dy++) {
      if (dy <= height && dx === 0 && dz === 0 || dy === height + 1 && Math.abs(dx) + Math.abs(dz) > 1 || Math.abs(dx) + Math.abs(dz) === 4 && dy !== height - 1) continue;
      put(x + dx, h + dy, z + dz, netherTree && hash(x + dx, dy, z + dz, seed) < .07 ? B.SHROOMLIGHT : leaf);
    }
  }
  const structures = structureCandidates(world, cx, cz);
  // Structure writers are clipped per chunk, so generation order cannot erase a neighbor or player edit.
  world.generationBounds = { x0, z0 };
  generateStructures(world, structures);
  world.generationBounds = null;
  if (world.dimension !== 'overworld') {
    const sy = world.dimension === 'nether' ? 23 : terrainColumn(world, 48, 48).h + 1;
    for (let x = 44; x <= 57; x++) for (let z = 40; z <= 52; z++) { put(x, sy - 1, z, B.OBSIDIAN); for (let y = sy; y < sy + 6; y++) put(x, y, z, B.AIR); }
    for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) put(46 + dx, sy - 1 + dy, 43, !dx || dx === 3 || !dy || dy === 4 ? B.OBSIDIAN : world.dimension === 'nether' ? B.NETHER_PORTAL : B.END_PORTAL);
  }
}
