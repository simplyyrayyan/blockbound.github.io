import { B, BLOCKS, ITEMS, freshItem } from './catalog.js';
import { SIZE, HEIGHT, SEA, hash, noise, clamp } from './world.js';

export const DIMENSIONS = ['overworld', 'nether', 'end'];
export const OVERWORLD_BIOMES = ['plains', 'forest', 'taiga', 'jungle', 'desert', 'badlands', 'savanna', 'swamp', 'mangrove_swamp', 'mountains', 'snowy_plains', 'cherry_grove', 'pale_garden', 'old_growth_taiga', 'snowy_taiga', 'meadow', 'birch_forest', 'stony_peaks', 'flower_forest', 'frozen_river'];
export const NETHER_BIOMES = ['nether_wastes', 'soul_sand_valley', 'crimson_forest', 'warped_forest', 'basalt_deltas'];
export const END_BIOMES = ['the_end', 'end_highlands', 'end_midlands', 'end_barrens', 'small_end_islands'];
export const STRUCTURE_TYPES = [
  ['village', 'Village', 'overworld', 14, 14], ['desert_pyramid', 'Desert Pyramid', 'overworld', 38, 13], ['jungle_temple', 'Jungle Temple', 'overworld', 66, 13],
  ['woodland_mansion', 'Woodland Mansion', 'overworld', 82, 36], ['ocean_monument', 'Ocean Monument', 'overworld', 15, 37], ['ocean_ruins', 'Ocean Ruins', 'overworld', 13, 62],
  ['shipwreck', 'Shipwreck', 'overworld', 35, 81], ['buried_treasure', 'Buried Treasure', 'overworld', 24, 70], ['pillager_outpost', 'Pillager Outpost', 'overworld', 64, 34],
  ['ruined_portal', 'Ruined Portal', 'overworld', 81, 83], ['stronghold', 'Stronghold', 'overworld', 65, 63, 5], ['ancient_city', 'Ancient City', 'overworld', 17, 81, 5],
  ['trial_chambers', 'Trial Chambers', 'overworld', 81, 60, 5], ['mineshaft', 'Mineshaft', 'overworld', 36, 32, 7], ['dungeon', 'Dungeon', 'overworld', 69, 81, 7],
  ['igloo', 'Igloo', 'overworld', 13, 82], ['witch_hut', 'Witch Hut', 'overworld', 35, 64], ['trail_ruins', 'Trail Ruins', 'overworld', 83, 15],
  ['nether_fortress', 'Nether Fortress', 'nether', 25, 24], ['bastion_remnant', 'Bastion Remnant', 'nether', 72, 65],
  ['nether_ruined_portal', 'Ruined Portal', 'nether', 73, 19], ['end_city', 'End City', 'end', 73, 67],
].map(([id, name, dimension, x, z, underground]) => ({ id, name, dimension, x, z, underground }));

export function regionBiome(world, x, z, y = HEIGHT) {
  if (world.dimension === 'nether') return NETHER_BIOMES[Math.min(4, Math.floor(clamp(x, 0, SIZE - 1) / SIZE * 5))];
  if (world.dimension === 'end') return Math.hypot(x - 48, z - 48) < 22 ? 'the_end' : END_BIOMES[1 + Math.floor((x + z) / 19) % 4];
  if (y < 11) return x > 35 && x < 63 && z < 33 ? 'sulfur_caves' : x < 32 && z > 67 ? 'deep_dark' : 'caves';
  if (Math.hypot(x - 48, z - 48) < 11) return 'plains';
  const ix = clamp(Math.floor(x / SIZE * 5), 0, 4), iz = clamp(Math.floor(z / SIZE * 4), 0, 3);
  return OVERWORLD_BIOMES[iz * 5 + ix];
}
export function habitatFor(world, x, y, z) {
  const name = world.version >= 3 ? regionBiome(world, x, z, y) : world.biome(x, z);
  if (world.get(Math.floor(x), Math.floor(y), Math.floor(z)) === B.WATER) return 'water';
  if (NETHER_BIOMES.includes(name)) return 'volcanic';
  if (END_BIOMES.includes(name)) return 'end';
  if (['sulfur_caves', 'pale_garden'].includes(name)) return name === 'pale_garden' ? 'pale' : name;
  if (/cave|deep_dark/.test(name)) return 'cave';
  if (/snow|frozen/.test(name)) return 'snow';
  if (/desert|badlands|savanna/.test(name)) return 'desert';
  if (/mountain|peaks/.test(name)) return 'mountain';
  if (/forest|grove|jungle|taiga|swamp|garden/.test(name)) return 'forest';
  return ['plains', 'meadow'].includes(name) ? 'meadow' : name;
}
const set = (w, x, y, z, id) => { if (Number.isInteger(id)) w.raw(x, y, z, id); };
function treeBlocks(biome) {
  const name = biome === 'cherry_grove' ? 'CHERRY' : biome === 'pale_garden' ? 'PALE_OAK' : biome === 'mangrove_swamp' ? 'MANGROVE' : biome === 'jungle' ? 'JUNGLE' : biome === 'savanna' ? 'ACACIA' : biome.includes('taiga') || biome.includes('snow') ? 'SPRUCE' : biome === 'birch_forest' ? 'BIRCH' : biome === 'forest' ? 'DARK_OAK' : 'OAK';
  return [B[`${name}_LOG`] || B.LOG, B[`${name}_LEAVES`] || B.LEAVES];
}
export function enrichOverworld(world) {
  for (let x = 1; x < SIZE - 1; x++) for (let z = 1; z < SIZE - 1; z++) {
    const h = world.heights[z * SIZE + x], biome = regionBiome(world, x, z), trees = treeBlocks(biome), safe = Math.hypot(x - 48, z - 48) < 10;
    for (let y = 1; y < HEIGHT - 1; y++) {
      const id = world.get(x, y, z), r = hash(x, y, z, world.number + 713);
      if (id === B.STONE) {
        const rock = y < 6 ? B.DEEPSLATE : r < .025 ? B.GRANITE : r < .05 ? B.DIORITE : r < .075 ? B.ANDESITE : r < .08 ? B.CALCITE : r < .09 ? B.TUFF : null;
        const ore = r < .008 && y < 12 ? B.EMERALD_ORE : r < .022 && y < 12 ? B.REDSTONE_ORE : r < .03 ? B.LAPIS_ORE : r < .047 ? B.COPPER_ORE : r < .055 ? B.AMETHYST : null;
        if (ore || rock) set(world, x, y, z, ore || rock);
      }
      if (y < 7 && [B.COAL, B.IRON, B.COPPER_ORE, B.GOLD, B.REDSTONE_ORE, B.LAPIS_ORE, B.DIAMOND, B.EMERALD_ORE].includes(id)) {
        const ref = BLOCKS[id].reference; set(world, x, y, z, B[`DEEPSLATE_${ref?.toUpperCase()}`] || id);
      }
      if (safe) continue;
      if ([B.LOG, B.LEAVES].includes(id)) set(world, x, y, z, /desert|badlands/.test(biome) ? B.AIR : trees[id === B.LOG ? 0 : 1]);
      if (y < h - 3 && regionBiome(world, x, z, y) === 'sulfur_caves') {
        const open = Math.sin(x * .2) + Math.cos(z * .22) + Math.sin(y * .5) > .5;
        if (y > 3 && y < 9 && open) set(world, x, y, z, B.AIR);
        else if (isRock(world.get(x, y, z))) set(world, x, y, z, r < .28 ? B.CINNABAR : B.SULFUR);
        if (y === 4 && open && r < .06) set(world, x, y, z, B.SULFUR_SPIKE);
      }
      if (y < 9 && regionBiome(world, x, z, y) === 'deep_dark' && isRock(id) && world.get(x, y + 1, z) === B.AIR) set(world, x, y, z, B.SCULK);
    }
    if (safe) continue;
    const sandy = biome === 'desert' || biome === 'badlands';
    if (sandy) {
      for (let y = h - 3; y <= h; y++) set(world, x, y, z, y === h ? biome === 'badlands' ? B.RED_SAND : B.SAND : biome === 'badlands' ? [B.RED_TERRACOTTA, B.ORANGE_TERRACOTTA, B.TERRACOTTA][y % 3] : B.SANDSTONE);
      if (world.get(x, h + 1, z) === B.AIR && hash(x, 1, z, world.number) < .01) for (let dy = 1; dy <= 3; dy++) set(world, x, h + dy, z, B.CACTUS);
    } else if (/snow|frozen/.test(biome)) set(world, x, h, z, h <= SEA ? biome === 'frozen_river' ? B.BLUE_ICE : B.PACKED_ICE : B.SNOW_BLOCK);
    else if (biome.includes('swamp')) { set(world, x, h, z, B.MUD); if (hash(x, 0, z, world.number + 91) < .18) set(world, x, h, z, B.WATER); }
    const roll = hash(x, 1, z, world.number + 211);
    if (world.get(x, h + 1, z) === B.AIR && !sandy && h > SEA && roll < .075) {
      const choices = biome === 'pale_garden' ? [B.OPEN_EYEBLOSSOM, B.PALE_MOSS_CARPET] : biome === 'flower_forest' ? [B.CORNFLOWER, B.ALLIUM, B.DANDELION, B.POPPY, B.BLUE_ORCHID, B.PEONY] : biome === 'jungle' ? [B.BAMBOO, B.FERN, B.MELON] : [B.SHORT_GRASS, B.FERN, B.POPPY, B.DANDELION];
      set(world, x, h + 1, z, choices[Math.floor(hash(x, 2, z, world.number) * choices.length)]);
    }
    if (h < SEA && roll < .04) set(world, x, h + 1, z, B.SEAGRASS);
  }
  // A shallow, reachable sulfur pool demonstrates the gas and geyser interaction.
  for (let x = 43; x <= 46; x++) for (let z = 18; z <= 21; z++) {
    set(world, x, 3, z, B.MAGMA_BLOCK); set(world, x, 4, z, B.POTENT_SULFUR); set(world, x, 5, z, B.WATER);
    for (let y = 6; y < 10; y++) set(world, x, y, z, B.AIR);
  }
  generateStructures(world);
}
function isRock(id) { return id && ![B.BEDROCK, B.WATER, B.LAVA, B.AIR].includes(id); }

export function generateDimension(world) {
  const nether = world.dimension === 'nether';
  for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) {
    const biome = regionBiome(world, x, z), h = nether ? Math.floor(10 + noise(x / 18, z / 18, world.number) * 12) : Math.floor(15 + noise(x / 22, z / 22, world.number) * 8);
    const island = Math.hypot(x - 48, z - 48) < 21 || Math.hypot(x - 73, z - 67) < 13 || Math.hypot(x - 18, z - 72) < 10 || Math.hypot(x - 76, z - 18) < 10;
    world.heights[z * SIZE + x] = nether || island ? h : 0;
    set(world, x, 0, z, B.BEDROCK);
    if (nether) {
      for (let y = 1; y < HEIGHT; y++) {
        const r = hash(x, y, z, world.number);
        let id = y <= h ? B.NETHERRACK : y < 13 ? B.LAVA : y >= HEIGHT - 5 + Math.floor(noise(x / 9, z / 9, world.number) * 3) ? B.NETHERRACK : B.AIR;
        if (y === HEIGHT - 1) id = B.BEDROCK;
        if (id === B.NETHERRACK && y < h) id = r < .013 && y < 9 ? B.ANCIENT_DEBRIS : r < .04 ? B.NETHER_QUARTZ_ORE : r < .065 ? B.NETHER_GOLD_ORE : id;
        if (y === h) id = biome === 'soul_sand_valley' ? r < .5 ? B.SOUL_SAND : B.SOUL_SOIL : biome === 'crimson_forest' ? B.CRIMSON_NYLIUM : biome === 'warped_forest' ? B.WARPED_NYLIUM : biome === 'basalt_deltas' ? r < .2 ? B.MAGMA_BLOCK : B.BLACKSTONE : B.NETHERRACK;
        set(world, x, y, z, id);
      }
      if (hash(x, 0, z, world.number + 71) < .014 && x > 4 && x < 91 && z > 4 && z < 91) {
        if (biome.includes('forest')) {
          const warped = biome === 'warped_forest';
          for (let y = h + 1; y <= h + 5; y++) set(world, x, y, z, warped ? B.WARPED_STEM : B.CRIMSON_STEM);
          for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 4; dy <= 6; dy++) set(world, x + dx, h + dy, z + dz, hash(dx, dy, dz, world.number) < .08 ? B.SHROOMLIGHT : warped ? B.WARPED_WART_BLOCK : B.NETHER_WART_BLOCK);
        } else if (biome === 'basalt_deltas') for (let y = h + 1; y < h + 7; y++) set(world, x, y, z, B.BASALT);
      }
      if (hash(x, 1, z, world.number + 12) < .025) set(world, x, HEIGHT - 7, z, B.GLOWSTONE);
    } else if (island) {
      for (let y = Math.max(2, h - 6); y <= h; y++) set(world, x, y, z, B.END_STONE);
      if (Math.hypot(x - 48, z - 48) > 25 && hash(x, 0, z, world.number) < .015) { for (let dy = 1; dy <= 4; dy++) set(world, x, h + dy, z, B.CHORUS_PLANT); set(world, x, h + 5, z, B.CHORUS_FLOWER); }
    }
  }
  const sy = nether ? 23 : world.heights[48 * SIZE + 48] + 1;
  for (let x = 44; x <= 52; x++) for (let z = 44; z <= 52; z++) { set(world, x, sy - 1, z, nether ? B.OBSIDIAN : B.END_STONE); for (let y = sy; y < sy + 7; y++) set(world, x, y, z, B.AIR); }
  world.spawn = { x: 48.5, y: sy, z: 48.5 };
  if (!nether) for (let i = 0; i < 6; i++) {
    const angle = i / 6 * Math.PI * 2, x = Math.round(48 + Math.cos(angle) * 15), z = Math.round(48 + Math.sin(angle) * 15), top = 27 + i % 3 * 3;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let y = 14; y <= top; y++) set(world, x + dx, y, z + dz, B.OBSIDIAN);
    set(world, x, top + 1, z, B.SEA_LANTERN);
  }
  generateStructures(world);
  makePortal(world, 53, sy, 48, nether ? B.NETHER_PORTAL : B.END_PORTAL, true);
  return world;
}

function fill(w, x, y, z, width, height, depth, id) { for (let dx = 0; dx < width; dx++) for (let dy = 0; dy < height; dy++) for (let dz = 0; dz < depth; dz++) set(w, x + dx, y + dy, z + dz, id); }
function room(w, x, y, z, width, height, depth, wall, floor = wall, roof = wall) {
  fill(w, x, y - 1, z, width, 1, depth, floor); fill(w, x, y, z, width, height, depth, B.AIR);
  fill(w, x, y, z, width, height, 1, wall); fill(w, x, y, z + depth - 1, width, height, 1, wall);
  fill(w, x, y, z, 1, height, depth, wall); fill(w, x + width - 1, y, z, 1, height, depth, wall); fill(w, x, y + height, z, width, 1, depth, roof);
  fill(w, x + Math.floor(width / 2), y, z, 1, 2, 1, B.AIR);
  set(w, x + 1, y, z + 1, B.TORCH);
}
export function makePortal(world, x, y, z, portal = B.NETHER_PORTAL, active = true) {
  for (let dx = 0; dx < 4; dx++) for (let dy = 0; dy < 5; dy++) set(world, x + dx, y + dy, z, dx === 0 || dx === 3 || dy === 0 || dy === 4 ? B.OBSIDIAN : active ? portal : B.AIR);
}
function chest(world, x, y, z, loot) {
  set(world, x, y, z, B.CHEST);
  const contents = Array(27).fill(null); loot.filter(([id]) => ITEMS[id]).forEach(([id, count], i) => contents[i] = freshItem(id, count));
  world.states.set(world.index(x, y, z), { contents });
}
export function generateStructures(world) {
  world.structures = [];
  for (const def of STRUCTURE_TYPES.filter(s => s.dimension === world.dimension)) {
    const { id, x, z } = def, y = def.underground || clamp(world.heights[z * SIZE + x] + 1, 6, 28), s = { ...def, y, spawns: [] };
    world.structures.push(s);
    const spawns = (...types) => types.forEach((type, i) => s.spawns.push({ type, x: x + i * 2, y, z: z + 1 }));
    if (id === 'village') {
      for (const [dx, dz, wood] of [[-5, -4, B.PLANKS], [3, -4, B.BIRCH_PLANKS], [-5, 4, B.SPRUCE_PLANKS]]) {
        room(world, x + dx, y, z + dz, 6, 4, 6, wood, B.COBBLESTONE);
        set(world, x + dx + 2, y + 2, z + dz + 5, B.GLASS); set(world, x + dx + 2, y, z + dz, B.OAK_DOOR); set(world, x + dx + 2, y + 1, z + dz, B.OAK_DOOR);
        world.states.set(world.index(x + dx + 2, y + 1, z + dz), { upper: true }); set(world, x + dx + 1, y, z + dz + 4, B.RED_BED);
      }
      fill(world, x + 1, y - 1, z - 6, 2, 1, 17, B.DIRT_PATH); set(world, x, y, z, B.BELL); set(world, x - 4, y, z - 1, B.TABLE); set(world, x + 4, y, z - 1, B.FURNACE);
      chest(world, x - 3, y, z + 7, [['bread', 5], ['iron', 3], ['emerald', 2], ['map', 1]]); spawns('villager', 'villager', 'iron_golem');
    } else if (id === 'desert_pyramid') {
      for (let level = 0; level < 7; level++) fill(world, x - 7 + level, y + level, z - 7 + level, 15 - level * 2, 1, 15 - level * 2, B.SANDSTONE);
      room(world, x - 3, y, z - 3, 7, 4, 7, B.CUT_SANDSTONE, B.CHISELED_SANDSTONE, B.SANDSTONE);
      chest(world, x + 1, y, z + 1, [['gold', 6], ['diamond', 2], ['dune_armor_trim_smithing_template', 1]]); set(world, x, y - 1, z, B.TNT); set(world, x, y, z, B.STONE_PRESSURE_PLATE); spawns('husk');
    } else if (id === 'jungle_temple') {
      room(world, x - 4, y, z - 4, 9, 5, 9, B.MOSSY_COBBLESTONE, B.COBBLESTONE);
      for (let i = 0; i < 3; i++) fill(world, x - 3 + i, y + 6 + i, z - 3 + i, 7 - i * 2, 1, 7 - i * 2, B.COBBLESTONE);
      chest(world, x + 2, y, z + 2, [['emerald', 5], ['bone', 5], ['wild_armor_trim_smithing_template', 1]]); set(world, x - 2, y, z + 1, B.LEVER); spawns('skeleton');
    } else if (id === 'woodland_mansion') {
      room(world, x - 7, y, z - 7, 15, 5, 15, B.DARK_OAK_PLANKS, B.COBBLESTONE); room(world, x - 7, y + 6, z - 7, 15, 5, 15, B.DARK_OAK_PLANKS, B.DARK_OAK_PLANKS, B.DARK_OAK_PLANKS);
      for (const dx of [-4, 0, 4]) for (const dy of [2, 8]) fill(world, x + dx, y + dy, z - 7, 2, 2, 1, B.GLASS);
      for (let i = 0; i < 6; i++) fill(world, x - 5, y + i, z + i - 4, 2, 1, 1, B.DARK_OAK_STAIRS);
      chest(world, x + 4, y + 6, z + 4, [['totem', 1], ['diamond_axe', 1], ['vex_armor_trim_smithing_template', 1]]); spawns('vindicator', 'evoker');
    } else if (id === 'ocean_monument' || id === 'ocean_ruins') {
      const radius = id === 'ocean_monument' ? 7 : 4;
      fill(world, x - radius - 2, y - 2, z - radius - 2, radius * 2 + 5, 7, radius * 2 + 5, B.WATER);
      room(world, x - radius, y, z - radius, radius * 2 + 1, 5, radius * 2 + 1, B.PRISMARINE_BRICKS, B.DARK_PRISMARINE, B.PRISMARINE);
      fill(world, x - radius + 1, y, z - radius + 1, radius * 2 - 1, 4, radius * 2 - 1, B.WATER);
      set(world, x, y + 5, z, B.SEA_LANTERN); chest(world, x + 2, y, z + 2, [['prismarine_shard', 12], ['heart_of_the_sea', 1], ['sponge', 2]]); spawns(id === 'ocean_monument' ? 'elder_guardian' : 'drowned');
    } else if (id === 'shipwreck') {
      for (let dy = 0; dy < 3; dy++) fill(world, x - 3 - dy, y + dy, z - 3, 7 + dy * 2, 1, 7, B.SPRUCE_PLANKS);
      fill(world, x - 4, y + 3, z - 2, 9, 1, 5, B.AIR); fill(world, x, y + 3, z, 1, 8, 1, B.SPRUCE_LOG); fill(world, x + 1, y + 7, z, 4, 3, 1, B.WOOL);
      chest(world, x - 2, y + 3, z, [['filled_map', 1], ['iron', 7], ['paper', 8], ['emerald', 3]]);
    } else if (id === 'buried_treasure') chest(world, x, y - 2, z, [['heart_of_the_sea', 1], ['diamond', 4], ['gold', 6], ['water_breathing_potion', 1]]);
    else if (id.includes('ruined_portal')) { fill(world, x - 3, y - 1, z - 2, 10, 1, 6, B.NETHERRACK); makePortal(world, x - 1, y, z, B.NETHER_PORTAL, false); set(world, x + 2, y + 4, z, B.AIR); chest(world, x - 2, y, z + 2, [['obsidian', 4], ['flint_steel', 1], ['gold', 5]]); }
    else if (id === 'pillager_outpost') {
      room(world, x - 3, y, z - 3, 7, 8, 7, B.DARK_OAK_LOG, B.COBBLESTONE, B.DARK_OAK_PLANKS); fill(world, x - 4, y + 6, z - 4, 9, 1, 9, B.DARK_OAK_PLANKS);
      chest(world, x + 1, y + 7, z + 1, [['crossbow', 1], ['arrow', 16], ['sentry_armor_trim_smithing_template', 1]]); spawns('pillager', 'pillager');
    } else if (id === 'stronghold') {
      room(world, x - 6, y, z - 6, 13, 6, 13, B.STONE_BRICKS, B.MOSSY_STONE_BRICKS);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if ((Math.abs(dx) === 2) !== (Math.abs(dz) === 2)) set(world, x + dx, y, z + dz, B.END_PORTAL_FRAME);
      fill(world, x - 1, y - 1, z - 1, 3, 1, 3, B.LAVA); chest(world, x - 4, y, z + 4, [['ender_eye', 12], ['book', 8], ['diamond', 2]]); spawns('silverfish');
    } else if (id === 'ancient_city') {
      room(world, x - 8, y, z - 8, 17, 7, 17, B.DEEPSLATE_BRICKS, B.SCULK, B.DEEPSLATE_TILES);
      fill(world, x - 3, y, z + 3, 2, 6, 2, B.REINFORCED_DEEPSLATE); fill(world, x + 2, y, z + 3, 2, 6, 2, B.REINFORCED_DEEPSLATE); fill(world, x - 3, y + 6, z + 3, 7, 1, 2, B.REINFORCED_DEEPSLATE);
      set(world, x, y, z, B.SCULK_SENSOR); chest(world, x - 5, y, z + 5, [['echo_shard', 6], ['swift_sneak_enchanted_book', 1], ['recovery_compass', 1]]); spawns('warden');
    } else if (id === 'trial_chambers') {
      room(world, x - 6, y, z - 6, 13, 6, 13, B.TUFF_BRICKS, B.POLISHED_TUFF, B.CHISELED_COPPER);
      for (const dx of [-4, 4]) for (const dz of [-4, 4]) { fill(world, x + dx, y, z + dz, 1, 5, 1, B.CUT_COPPER); set(world, x + dx, y + 4, z + dz, B.COPPER_BULB); }
      chest(world, x + 4, y, z + 4, [['breeze_rod', 3], ['mace', 1], ['wind_charge', 12]]); spawns('breeze', 'bogged');
    } else if (id === 'mineshaft') {
      fill(world, x - 10, y, z - 2, 21, 4, 5, B.AIR); fill(world, x - 10, y - 1, z - 2, 21, 1, 5, B.PLANKS);
      for (let dx = -9; dx <= 9; dx++) { set(world, x + dx, y, z, B.RAIL); if (dx % 4 === 0) { fill(world, x + dx, y, z - 2, 1, 3, 1, B.OAK_FENCE); fill(world, x + dx, y, z + 2, 1, 3, 1, B.OAK_FENCE); fill(world, x + dx, y + 3, z - 2, 1, 1, 5, B.PLANKS); } }
      chest(world, x + 8, y, z + 1, [['iron', 7], ['rail', 16], ['music_disc_bounce', 1]]); spawns('cave_spider');
    } else if (id === 'dungeon') { room(world, x - 4, y, z - 4, 9, 4, 9, B.MOSSY_COBBLESTONE); set(world, x, y, z, B.SPAWNER); chest(world, x + 2, y, z + 2, [['saddle', 1], ['name_tag', 2], ['golden_apple', 1]]); spawns('zombie', 'skeleton'); }
    else if (id === 'igloo') { room(world, x - 3, y, z - 3, 7, 3, 7, B.SNOW_BLOCK, B.SNOW_BLOCK); fill(world, x - 2, y + 4, z - 2, 5, 1, 5, B.SNOW_BLOCK); set(world, x + 1, y, z + 1, B.RED_BED); set(world, x - 1, y, z + 1, B.FURNACE); chest(world, x + 2, y, z, [['golden_apple', 1], ['splash_weakness_potion', 1]]); }
    else if (id === 'witch_hut') { for (const dx of [-3, 3]) for (const dz of [-3, 3]) fill(world, x + dx, y - 2, z + dz, 1, 3, 1, B.SPRUCE_LOG); room(world, x - 3, y + 1, z - 3, 7, 3, 7, B.SPRUCE_PLANKS); set(world, x + 1, y + 1, z + 1, B.CAULDRON); set(world, x - 1, y + 1, z + 1, B.BREWING_STAND); spawns('witch', 'cat'); }
    else if (id === 'trail_ruins') { for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = -3; dy <= 2; dy++) set(world, x + dx, y + dy, z + dz, hash(dx, dy, dz, world.number) < .25 ? B.SUSPICIOUS_GRAVEL : [B.TERRACOTTA, B.BRICKS, B.PACKED_MUD][(dx + dz + dy + 12) % 3]); chest(world, x, y - 2, z, [['angler_pottery_sherd', 2], ['resin_clump', 5], ['wayfinder_armor_trim_smithing_template', 1]]); }
    else if (id === 'nether_fortress') { room(world, x - 5, y, z - 5, 11, 6, 11, B.NETHER_BRICKS); fill(world, x - 14, y - 1, z - 1, 29, 1, 3, B.NETHER_BRICKS); fill(world, x - 1, y - 1, z - 14, 3, 1, 29, B.NETHER_BRICKS); chest(world, x + 3, y, z + 3, [['nether_wart', 8], ['blaze_rod', 3], ['gold', 8]]); spawns('blaze', 'wither_skeleton'); }
    else if (id === 'bastion_remnant') { room(world, x - 7, y, z - 7, 15, 9, 15, B.POLISHED_BLACKSTONE_BRICKS, B.BLACKSTONE); fill(world, x - 3, y, z + 3, 7, 2, 2, B.GOLD_BLOCK); chest(world, x, y + 2, z + 3, [['netherite_upgrade_smithing_template', 1], ['netherite_scrap', 4], ['gold', 12]]); spawns('piglin_brute', 'piglin'); }
    else if (id === 'end_city') { for (let dy = 0; dy < 15; dy += 5) room(world, x - 3, y + dy, z - 3, 7, 4, 7, B.PURPUR_BLOCK, B.PURPUR_PILLAR, B.PURPUR_SLAB); for (let i = 0; i < 12; i++) set(world, x - 2 + i % 4, y + i, z - 2 + Math.floor(i / 4), B.PURPUR_STAIRS); set(world, x, y + 16, z, B.END_ROD); chest(world, x + 1, y + 11, z + 1, [['elytra', 1], ['shulker_shell', 4], ['diamond_sword', 1]]); spawns('shulker', 'enderman'); }
  }
}
