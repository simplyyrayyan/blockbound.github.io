// New blocks append to the original IDs so existing terrain edits remain valid.
export const EXTRA_BLOCKS = [
  ['BIRCH_LOG', 'birch_log', 'Birch log', '#d6d6c3', 'log'],
  ['BIRCH_PLANKS', 'birch_planks', 'Birch planks', '#d9c68e', 'planks'],
  ['CHERRY_LOG', 'cherry_log', 'Cherry log', '#68505b', 'log'],
  ['CHERRY_PLANKS', 'cherry_planks', 'Cherry planks', '#dca5aa', 'planks'],
  ['CHERRY_LEAVES', 'cherry_leaves', 'Cherry leaves', '#e4a5c2', 'leaves'],
  ['SPRUCE_LOG', 'spruce_log', 'Spruce log', '#685442', 'log'],
  ['SPRUCE_PLANKS', 'spruce_planks', 'Spruce planks', '#917450', 'planks'],
  ['SPRUCE_LEAVES', 'spruce_leaves', 'Spruce leaves', '#456d58', 'leaves'],
  ['MOSS', 'moss', 'Moss', '#698646', 'moss'],
  ['COBBLESTONE', 'cobblestone', 'Cobblestone', '#818481', 'cobble'],
  ['DEEPSLATE', 'deepslate', 'Deepslate', '#51545a', 'brick'],
  ['GRANITE', 'granite', 'Granite', '#aa7e70', 'stone'],
  ['DIORITE', 'diorite', 'Diorite', '#c8c8c1', 'stone'],
  ['ANDESITE', 'andesite', 'Andesite', '#92998e', 'stone'],
  ['COPPER_ORE', 'copper_ore', 'Copper ore', '#c18d66', 'ore', 'copper'],
  ['EMERALD_ORE', 'emerald_ore', 'Emerald ore', '#62ce79', 'ore', 'emerald'],
  ['REDSTONE_ORE', 'redstone_ore', 'Redstone ore', '#da4a43', 'ore', 'redstone'],
  ['LAPIS_ORE', 'lapis_ore', 'Lapis ore', '#466dce', 'ore', 'lapis'],
  ['OBSIDIAN', 'obsidian', 'Obsidian', '#44394f', 'stone'],
  ['NETHERRACK', 'netherrack', 'Netherrack', '#934b4d', 'stone'],
  ['END_STONE', 'end_stone', 'End stone', '#d4d69b', 'stone'],
  ['SOUL_SAND', 'soul_sand', 'Soul sand', '#71615a', 'sand'],
  ['BASALT', 'basalt', 'Basalt', '#66666c', 'log'],
  ['GLOWSTONE', 'glowstone', 'Glowstone', '#dfb764', 'glow', 'glowstone_dust'],
  ['PRISMARINE', 'prismarine', 'Prismarine', '#70a69a', 'brick'],
  ['SEA_LANTERN', 'sea_lantern', 'Sea lantern', '#a3d8c6', 'glow'],
  ['WOOL', 'wool', 'White wool', '#deded3', 'wool'],
  ['RED_WOOL', 'red_wool', 'Red wool', '#b34c43', 'wool'],
  ['BLUE_WOOL', 'blue_wool', 'Blue wool', '#4b68a4', 'wool'],
  ['GREEN_WOOL', 'green_wool', 'Green wool', '#62864b', 'wool'],
  ['HAY', 'hay', 'Hay bale', '#bfaa46', 'hay'],
  ['PUMPKIN', 'pumpkin', 'Pumpkin', '#ce8b3e', 'pumpkin'],
  ['MELON', 'melon', 'Melon', '#91ad48', 'pumpkin', 'melon_slice'],
  ['SNOW', 'snow', 'Snow block', '#e5edef', 'snow', 'snowball'],
  ['ICE', 'ice', 'Ice', '#9cc5dd', 'glass'],
  ['CLAY', 'clay', 'Clay', '#a8acba', 'stone', 'clay_ball'],
  ['TERRACOTTA', 'terracotta', 'Terracotta', '#b08068', 'stone'],
  ['BOOKSHELF', 'bookshelf', 'Bookshelf', '#b69567', 'bookshelf'],
  ['TNT', 'tnt', 'TNT', '#d9654e', 'tnt'],
  ['SCULK', 'sculk', 'Sculk', '#255b5b', 'sculk'],
  ['SPONGE', 'sponge', 'Sponge', '#bdb763', 'sponge'],
  ['DRAGON_EGG', 'dragon_egg', 'Dragon egg', '#44344d', 'sculk'],
  ['LAVA', 'lava', 'Lava', '#f3a141', 'lava'],
  ['CACTUS', 'cactus', 'Cactus', '#638548', 'cactus'],
  ['AMETHYST', 'amethyst_block', 'Amethyst block', '#b496c9', 'crystal'],
  ['QUARTZ', 'quartz_block', 'Quartz block', '#d7d4cf', 'brick'],
  ['COPPER_BLOCK', 'copper_block', 'Copper block', '#be8569', 'metal'],
  ['IRON_BLOCK', 'iron_block', 'Iron block', '#c4c8c6', 'metal'],
  ['GOLD_BLOCK', 'gold_block', 'Gold block', '#e5c663', 'metal'],
  ['DIAMOND_BLOCK', 'diamond_block', 'Diamond block', '#64cccb', 'metal'],
].map(([key, item, name, color, texture, drop], i) => ({
  key, item, name, color, texture, id: i + 18, drop: drop || item,
  time: texture === 'leaves' ? .2 : texture === 'log' ? 1.05 : 1.2,
  tool: ['log', 'planks', 'bookshelf'].includes(texture) ? 'axe' : ['sand', 'snow', 'moss'].includes(texture) ? 'shovel' : 'pick',
  tier: texture === 'ore' ? 2 : key === 'OBSIDIAN' ? 4 : 0,
  solid: key !== 'LAVA', transparent: ['leaves', 'glass', 'lava'].includes(texture),
}));

const material = (name, color, extra = {}) => ({ name, color, shape: 'material', category: 'materials', ...extra });
export const EXTRA_ITEMS = {
  copper: material('Copper ingot', '#c38b6c', { shape: 'ingot' }), emerald: material('Emerald', '#60c878', { shape: 'gem' }),
  redstone: material('Redstone dust', '#d15550'), lapis: material('Lapis lazuli', '#547dcc', { shape: 'gem' }),
  quartz: material('Nether quartz', '#dfdfd4', { shape: 'gem' }), amethyst: material('Amethyst shard', '#ae8ac9', { shape: 'gem' }),
  netherite_scrap: material('Netherite scrap', '#827b73'), netherite_ingot: material('Netherite ingot', '#6a656a', { shape: 'ingot' }),
  leather: material('Leather', '#a77954'), bone: material('Bone', '#e4e2cc', { shape: 'bone' }),
  string: material('String', '#d5d9d8'), feather: material('Feather', '#e7e4d7', { shape: 'feather' }),
  gunpowder: material('Gunpowder', '#666d6e'), rotten_flesh: material('Rotten flesh', '#9b6e4e', { food: 2, effect: 'hunger', category: 'food' }),
  spider_eye: material('Spider eye', '#a44153', { food: 2, effect: 'poison', category: 'food' }),
  ender_pearl: material('Ender pearl', '#498f86', { action: 'pearl', shape: 'orb' }),
  blaze_rod: material('Blaze rod', '#edb957', { shape: 'rod' }), breeze_rod: material('Breeze rod', '#9abdbf', { shape: 'rod' }),
  blaze_powder: material('Blaze powder', '#efb053'), ghast_tear: material('Ghast tear', '#e1e5df', { shape: 'gem' }),
  slime_ball: material('Slime ball', '#90bd6c', { shape: 'orb' }), magma_cream: material('Magma cream', '#d89656', { shape: 'orb' }),
  prismarine_shard: material('Prismarine shard', '#81b7a3', { shape: 'gem' }), prismarine_crystal: material('Prismarine crystal', '#a7d7c8', { shape: 'gem' }),
  ink_sac: material('Ink sac', '#4b5358'), glow_ink_sac: material('Glow ink sac', '#61b5aa'),
  armadillo_scute: material('Armadillo scute', '#b88f73'), turtle_scute: material('Turtle scute', '#80a36d'),
  rabbit_hide: material('Rabbit hide', '#bdab8b'), rabbit_foot: material('Rabbit foot', '#bcb7a5'),
  phantom_membrane: material('Phantom membrane', '#b2b9b1'), shulker_shell: material('Shulker shell', '#af90b7'),
  nether_star: material('Nether star', '#cfe7df', { shape: 'star' }), wither_skull: material('Wither skull', '#53575b', { action: 'wither' }),
  dragon_breath: material('Dragon breath', '#be8ac3', { shape: 'bottle' }),
  glowstone_dust: material('Glowstone dust', '#e0c37b'), gold_nugget: material('Gold nugget', '#e9ca6c', { shape: 'gem' }),
  flint: material('Flint', '#6e747c', { shape: 'gem' }), clay_ball: material('Clay ball', '#adb1c1', { shape: 'orb' }),
  paper: material('Paper', '#dcded8'), book: material('Book', '#a07355', { shape: 'book' }),
  sugar: material('Sugar', '#f0ede2'), wheat: material('Wheat', '#c9b46d', { category: 'nature', shape: 'plant' }),
  seeds: material('Wheat seeds', '#9ca65a', { category: 'nature', action: 'plant', harvest: 'wheat', shape: 'seeds' }),
  torchflower_seeds: material('Torchflower seeds', '#d18c58', { category: 'nature', action: 'plant', harvest: 'flower', shape: 'seeds' }),
  bamboo: material('Bamboo', '#7b9f51', { category: 'nature', shape: 'plant' }),
  flower: material('Poppy', '#dd6453', { category: 'nature', action: 'plant', harvest: 'flower', shape: 'flower' }),
  seagrass: material('Seagrass', '#73a472', { category: 'nature', shape: 'plant' }),
  mushroom: material('Red mushroom', '#c6574d', { category: 'nature', shape: 'mushroom' }),
  red_dye: material('Red dye', '#cf5b53'), blue_dye: material('Blue dye', '#6785c9'), green_dye: material('Green dye', '#85a450'),
  bone_meal: material('Bone meal', '#dbded0', { action: 'fertilize' }),
  egg: material('Egg', '#e5ddc8', { action: 'egg', shape: 'egg' }),
  honey_bottle: material('Honey bottle', '#d8ac52', { food: 6, effect: 'cure', category: 'food', shape: 'bottle' }),
  honeycomb: material('Honeycomb', '#e4b34f'),
  bowl: material('Bowl', '#a68661', { shape: 'bowl', category: 'tools' }),
  bucket: material('Bucket', '#bec4c6', { action: 'bucket', shape: 'bucket', stack: 16, category: 'tools' }),
  water_bucket: material('Water bucket', '#6ea7d2', { action: 'water', shape: 'bucket', stack: 1, category: 'tools' }),
  lava_bucket: material('Lava bucket', '#e9a65d', { action: 'lava', shape: 'bucket', stack: 1, category: 'tools' }),
  milk_bucket: material('Milk bucket', '#e6e5d5', { action: 'milk', shape: 'bucket', stack: 1, category: 'food' }),
  glass_bottle: material('Glass bottle', '#b7d2d3', { shape: 'bottle', action: 'bottle' }),
  saddle: material('Saddle', '#b47e51', { category: 'tools', stack: 1, shape: 'saddle' }),
  shears: material('Shears', '#c3c7c3', { category: 'tools', stack: 1, durability: 238, action: 'shear', shape: 'shears' }),
  brush: material('Brush', '#c0a97a', { category: 'tools', stack: 1, durability: 80, action: 'brush', shape: 'brush' }),
  lead: material('Lead', '#a7855a', { category: 'tools', action: 'lead' }),
  flint_steel: material('Flint and steel', '#a7adae', { category: 'tools', stack: 1, durability: 64, action: 'ignite' }),
  fishing_rod: material('Fishing rod', '#b8936b', { category: 'tools', stack: 1, durability: 96, action: 'fish', shape: 'bow' }),
  shield: material('Shield', '#b39b78', { category: 'combat', stack: 1, durability: 336, armorSlot: 'offhand', defense: 3, shape: 'shield' }),
  totem: material('Totem of undying', '#d4bd71', { category: 'combat', stack: 1, armorSlot: 'offhand', shape: 'totem' }),
  goat_horn: material('Goat horn', '#b4a285', { category: 'tools', action: 'horn', shape: 'horn' }),
  wind_charge: material('Wind charge', '#bcd5d3', { category: 'combat', action: 'wind', shape: 'orb' }),
  snowball: material('Snowball', '#e7f0ed', { category: 'combat', action: 'snowball', shape: 'orb' }),
  arrow: material('Arrow', '#bbb9a4', { category: 'combat', shape: 'arrow' }),
  fire_charge: material('Fire charge', '#e9a354', { category: 'combat', action: 'fireball', shape: 'orb' }),
  wolf_armor: material('Wolf armor', '#b5937f', { category: 'combat', stack: 1, action: 'wolf_armor', shape: 'chestplate' }),
};

for (const [id, name, color, food] of [
  ['raw_beef', 'Raw beef', '#bd5a58', 3], ['steak', 'Steak', '#ad7757', 8],
  ['raw_porkchop', 'Raw porkchop', '#dea5a0', 3], ['cooked_porkchop', 'Cooked porkchop', '#c39472', 8],
  ['raw_chicken', 'Raw chicken', '#d2bfa4', 2], ['cooked_chicken', 'Cooked chicken', '#b58e5f', 6],
  ['raw_mutton', 'Raw mutton', '#c26a67', 2], ['cooked_mutton', 'Cooked mutton', '#a67560', 6],
  ['raw_rabbit', 'Raw rabbit', '#c3aa93', 3], ['cooked_rabbit', 'Cooked rabbit', '#b18c6c', 5],
  ['cod', 'Raw cod', '#c8bca1', 2], ['cooked_cod', 'Cooked cod', '#ccb797', 5],
  ['salmon', 'Raw salmon', '#c77467', 2], ['cooked_salmon', 'Cooked salmon', '#be9377', 6],
  ['tropical_fish', 'Tropical fish', '#eba962', 1], ['bread', 'Bread', '#c3a16b', 5],
  ['carrot', 'Carrot', '#e8a152', 3], ['potato', 'Potato', '#ccb67e', 1], ['baked_potato', 'Baked potato', '#b8a17b', 5],
  ['sweet_berries', 'Sweet berries', '#ba5263', 2], ['melon_slice', 'Melon slice', '#d17970', 2],
  ['cookie', 'Cookie', '#b79a70', 2], ['pumpkin_pie', 'Pumpkin pie', '#cba274', 8],
  ['mushroom_stew', 'Mushroom stew', '#a78c76', 6], ['rabbit_stew', 'Rabbit stew', '#b9a08a', 10],
  ['golden_carrot', 'Golden carrot', '#e3c664', 6], ['golden_apple', 'Golden apple', '#eed16d', 8],
]) EXTRA_ITEMS[id] = { name, color, food, shape: ['cod', 'salmon', 'tropical_fish'].includes(id) ? 'fish' : id.includes('stew') ? 'bowl' : 'food', category: 'food', ...(id === 'golden_apple' ? { effect: 'regeneration' } : {}) };

for (const [tier, label, color, ingredient, strength, durability] of [
  ['wood', 'Wooden', '#b29466', 'planks', 4, 64], ['stone', 'Stone', '#929c98', 'stone', 5, 132],
  ['iron', 'Iron', '#c9d1ce', 'iron', 6, 252], ['gold', 'Golden', '#dfc467', 'gold', 4, 48],
  ['diamond', 'Diamond', '#69cdc7', 'diamond', 7, 1024], ['netherite', 'Netherite', '#777079', 'netherite_ingot', 8, 1600],
]) {
  EXTRA_ITEMS[`${tier}_sword`] = { name: `${label} sword`, color, category: 'combat', weapon: 'sword', damage: strength, cooldown: .5, durability, stack: 1, ingredient, shape: 'sword' };
  if (tier !== 'wood') EXTRA_ITEMS[`${tier}_axe`] = { name: `${label} axe`, color, category: 'tools', tool: 'axe', speed: strength / 1.4, damage: strength + 2, cooldown: .9, durability, stack: 1, ingredient };
  if (tier !== 'wood' && tier !== 'stone') EXTRA_ITEMS[`${tier}_shovel`] = { name: `${label} shovel`, color, category: 'tools', tool: 'shovel', speed: strength / 1.2, durability, stack: 1, ingredient };
}
for (const [id, name, color, damage, projectile, ammo, durability] of [
  ['bow', 'Bow', '#b79769', 5, 'arrow', 'arrow', 384], ['crossbow', 'Crossbow', '#998468', 8, 'arrow', 'arrow', 465],
  ['trident', 'Trident', '#86bcb5', 8, 'trident', null, 250],
]) EXTRA_ITEMS[id] = { name, color, damage, projectile, ammo, durability, stack: 1, cooldown: id === 'crossbow' ? 1.2 : .8, category: 'combat', shape: id };
EXTRA_ITEMS.mace = { name: 'Mace', color: '#a8b1b8', damage: 10, cooldown: 1.1, durability: 500, stack: 1, category: 'combat', shape: 'mace' };

for (const [type, label, color, ingredient, strength] of [
  ['leather', 'Leather', '#b68e69', 'leather', 1], ['iron', 'Iron', '#c7cfcb', 'iron', 2],
  ['gold', 'Golden', '#e1c46c', 'gold', 1.5], ['diamond', 'Diamond', '#72cac5', 'diamond', 3],
  ['netherite', 'Netherite', '#79727b', 'netherite_ingot', 3.5],
]) for (const [slot, label2, mult] of [['helmet', 'helmet', 1], ['chestplate', 'chestplate', 2], ['leggings', 'leggings', 1.5], ['boots', 'boots', 1]]) {
  EXTRA_ITEMS[`${type}_${slot}`] = { name: `${label} ${label2}`, color, armorSlot: slot, defense: strength * mult, durability: strength * 150, stack: 1, category: 'combat', shape: slot, ingredient };
}
EXTRA_ITEMS.turtle_helmet = { name: 'Turtle shell helmet', color: '#8dad70', armorSlot: 'helmet', defense: 2, durability: 275, stack: 1, category: 'combat', shape: 'helmet', ingredient: 'turtle_scute', effect: 'water_breathing' };
for (const [id, name, color, effect] of [
  ['healing_potion', 'Potion of healing', '#e59091', 'healing'], ['strength_potion', 'Potion of strength', '#c27b67', 'strength'],
  ['speed_potion', 'Potion of swiftness', '#92c9cd', 'speed'], ['fire_resistance_potion', 'Potion of fire resistance', '#dfaf65', 'fire_resistance'],
  ['water_breathing_potion', 'Potion of water breathing', '#8aaad0', 'water_breathing'], ['regeneration_potion', 'Potion of regeneration', '#cf8fb2', 'regeneration'],
  ['slow_falling_potion', 'Potion of slow falling', '#d2dccc', 'slow_falling'], ['poison_potion', 'Splash potion of poison', '#8fa464', 'poison'],
]) EXTRA_ITEMS[id] = { name, color, shape: 'bottle', category: 'combat', stack: 16, action: 'potion', effect };

export function contentRecipes() {
  const recipes = [];
  const add = (id, needs, count = 1, table = true) => recipes.push({ id, needs, count, table, pattern: Object.entries(needs).flatMap(([key, n]) => Array(Math.min(n, 9)).fill(key)).slice(0, 9), note: '' });
  for (const tree of ['birch', 'cherry', 'spruce']) { add(`${tree}_planks`, { [`${tree}_log`]: 1 }, 4, false); add('stick', { [`${tree}_planks`]: 2 }, 4, false); }
  for (const [id, def] of Object.entries(EXTRA_ITEMS)) {
    if (def.ingredient && def.armorSlot) add(id, { [def.ingredient]: { helmet: 5, chestplate: 8, leggings: 7, boots: 4 }[def.armorSlot] });
    else if (def.ingredient) add(id, { [def.ingredient]: def.weapon ? 2 : def.tool === 'axe' ? 3 : 1, stick: def.weapon ? 1 : 2 });
  }
  for (const [raw, cooked] of [['raw_beef', 'steak'], ['raw_porkchop', 'cooked_porkchop'], ['raw_chicken', 'cooked_chicken'], ['raw_mutton', 'cooked_mutton'], ['raw_rabbit', 'cooked_rabbit'], ['cod', 'cooked_cod'], ['salmon', 'cooked_salmon'], ['potato', 'baked_potato']]) add(cooked, { [raw]: 1, coal: 1 });
  for (const [id, needs, count = 1, table = true] of [
    ['bow', { stick: 3, string: 3 }], ['crossbow', { stick: 3, string: 2, iron: 1 }], ['arrow', { flint: 1, stick: 1, feather: 1 }, 4],
    ['trident', { prismarine_shard: 6, diamond: 2, stick: 2 }], ['mace', { breeze_rod: 2, iron_block: 1 }],
    ['shield', { planks: 6, iron: 1 }], ['saddle', { leather: 5, iron: 2 }], ['shears', { iron: 2 }], ['brush', { feather: 1, copper: 1, stick: 1 }],
    ['bucket', { iron: 3 }], ['glass_bottle', { glass: 3 }, 3], ['bowl', { planks: 3 }, 4, false], ['fishing_rod', { stick: 3, string: 2 }],
    ['lead', { string: 4, slime_ball: 1 }, 2], ['flint_steel', { flint: 1, iron: 1 }], ['wolf_armor', { armadillo_scute: 6 }],
    ['bread', { wheat: 3 }, 1, false], ['cookie', { wheat: 2, sweet_berries: 1 }, 8], ['pumpkin_pie', { pumpkin: 1, sugar: 1, egg: 1 }],
    ['mushroom_stew', { mushroom: 2, bowl: 1 }, 1, false], ['rabbit_stew', { cooked_rabbit: 1, baked_potato: 1, carrot: 1, bowl: 1 }],
    ['golden_carrot', { carrot: 1, gold_nugget: 8 }], ['golden_apple', { apple: 1, gold: 8 }],
    ['bone_meal', { bone: 1 }, 3, false], ['leather', { rabbit_hide: 4 }, 1, false], ['gold', { gold_nugget: 9 }],
    ['blaze_powder', { blaze_rod: 1 }, 2, false], ['magma_cream', { blaze_powder: 1, slime_ball: 1 }],
    ['wind_charge', { breeze_rod: 1 }, 4, false], ['fire_charge', { blaze_powder: 1, coal: 1, gunpowder: 1 }, 3],
    ['netherite_ingot', { netherite_scrap: 4, gold: 4 }], ['netherite_scrap', { obsidian: 4, blaze_powder: 2 }],
    ['red_dye', { flower: 1 }, 2, false], ['blue_dye', { lapis: 1 }, 2, false], ['green_dye', { cactus: 1, coal: 1 }],
    ['red_wool', { wool: 1, red_dye: 1 }], ['blue_wool', { wool: 1, blue_dye: 1 }], ['green_wool', { wool: 1, green_dye: 1 }], ['wool', { string: 4 }],
    ['hay', { wheat: 9 }], ['snow', { snowball: 4 }], ['terracotta', { clay_ball: 4, coal: 1 }], ['cobblestone', { stone: 1 }, 1, false],
    ['bookshelf', { planks: 6, book: 3 }], ['paper', { bamboo: 3 }, 3], ['book', { paper: 3, leather: 1 }],
    ['tnt', { gunpowder: 5, sand: 4 }], ['prismarine', { prismarine_shard: 4 }], ['sea_lantern', { prismarine_shard: 4, prismarine_crystal: 5 }],
    ['glowstone', { glowstone_dust: 4 }], ['quartz_block', { quartz: 4 }], ['amethyst_block', { amethyst: 4 }],
    ['copper_block', { copper: 9 }], ['iron_block', { iron: 9 }], ['gold_block', { gold: 9 }], ['diamond_block', { diamond: 9 }],
    ['totem', { nether_star: 1, gold: 4, emerald: 2 }], ['sugar', { sweet_berries: 2 }, 2],
    ['healing_potion', { glass_bottle: 1, melon_slice: 1, gold_nugget: 1 }], ['strength_potion', { glass_bottle: 1, blaze_powder: 1 }],
    ['speed_potion', { glass_bottle: 1, sugar: 2 }], ['fire_resistance_potion', { glass_bottle: 1, magma_cream: 1 }],
    ['water_breathing_potion', { glass_bottle: 1, turtle_scute: 1 }], ['regeneration_potion', { glass_bottle: 1, ghast_tear: 1 }],
    ['slow_falling_potion', { glass_bottle: 1, phantom_membrane: 1 }], ['poison_potion', { glass_bottle: 1, spider_eye: 1 }],
    ['amethyst', { shulker_shell: 1 }, 4], ['quartz', { diorite: 1 }, 2],
  ]) add(id, needs, count, table);
  return recipes;
}
