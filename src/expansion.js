import reference from './data/reference.json' with { type: 'json' };

export const ALIASES = {
  grass_block: 'grass', oak_log: 'log', oak_leaves: 'leaves', oak_planks: 'planks', crafting_table: 'table', stone_bricks: 'brick', brick: 'brick_item',
  coal_ore: 'coal_ore', iron_ingot: 'iron', gold_ingot: 'gold', copper_ingot: 'copper', lapis_lazuli: 'lapis', redstone: 'redstone',
  amethyst_shard: 'amethyst', slime_ball: 'slime_ball', prismarine_crystals: 'prismarine_crystal', scute: 'turtle_scute',
  wheat_seeds: 'seeds', poppy: 'flower', red_mushroom: 'mushroom', beef: 'raw_beef', cooked_beef: 'steak',
  porkchop: 'raw_porkchop', chicken: 'raw_chicken', mutton: 'raw_mutton', rabbit: 'raw_rabbit',
  flint_and_steel: 'flint_steel', totem_of_undying: 'totem', turtle_helmet: 'turtle_helmet',
  snow_block: 'snow', moss_block: 'moss', hay_block: 'hay', white_wool: 'wool',
  wooden_pickaxe: 'wood_pick', stone_pickaxe: 'stone_pick', iron_pickaxe: 'iron_pick', diamond_pickaxe: 'diamond_pick',
  wooden_axe: 'wood_axe', wooden_sword: 'wood_sword', stone_shovel: 'shovel',
  golden_sword: 'gold_sword', golden_axe: 'gold_axe', golden_shovel: 'gold_shovel',
  golden_helmet: 'gold_helmet', golden_chestplate: 'gold_chestplate', golden_leggings: 'gold_leggings', golden_boots: 'gold_boots',
  netherite_pickaxe: 'netherite_pick', golden_pickaxe: 'gold_pick', copper_pickaxe: 'copper_pick',
};
export const canonicalItem = id => ALIASES[id] || id;
export const ENCHANTMENTS = Object.fromEntries(reference.enchantments.map(e => [e.id, e]));
export const DYES = { white: '#e9ecec', orange: '#f07613', magenta: '#bd44b3', light_blue: '#3aafd9', yellow: '#f8c627', lime: '#70b919', pink: '#ed8dac', gray: '#3e4447', light_gray: '#8e8e86', cyan: '#158991', purple: '#792aac', blue: '#35399d', brown: '#724728', green: '#546d1b', red: '#a12722', black: '#191b20' };
export const WOODS = { oak: '#b8945f', spruce: '#725332', birch: '#d7c185', jungle: '#af7e56', acacia: '#ac5c35', dark_oak: '#49321e', mangrove: '#763730', cherry: '#e6b4ae', pale_oak: '#e1d7c0', bamboo: '#c7b65b', crimson: '#6a314c', warped: '#28766f' };
export const POTIONS = {
  water: ['Water Bottle', '#779bc6', null], awkward: ['Awkward Potion', '#6e93bf', null], mundane: ['Mundane Potion', '#728cac', null], thick: ['Thick Potion', '#8091bc', null],
  healing: ['Potion of Healing', '#f2474b', 'healing'], regeneration: ['Potion of Regeneration', '#dd62a0', 'regeneration'],
  fire_resistance: ['Potion of Fire Resistance', '#e6a12b', 'fire_resistance'], strength: ['Potion of Strength', '#922824', 'strength'],
  swiftness: ['Potion of Swiftness', '#79b9db', 'speed'], slowness: ['Potion of Slowness', '#7b849b', 'slowness'],
  leaping: ['Potion of Leaping', '#6ddb33', 'jump_boost'], water_breathing: ['Potion of Water Breathing', '#3767d5', 'water_breathing'],
  night_vision: ['Potion of Night Vision', '#4266ca', 'night_vision'], invisibility: ['Potion of Invisibility', '#a7acba', 'invisibility'],
  poison: ['Potion of Poison', '#589420', 'poison'], weakness: ['Potion of Weakness', '#6b6967', 'weakness'],
  harming: ['Potion of Harming', '#511747', 'harming'], slow_falling: ['Potion of Slow Falling', '#e6ddcf', 'slow_falling'],
  turtle_master: ['Potion of the Turtle Master', '#688d77', 'turtle_master'], infestation: ['Potion of Infestation', '#877957', 'infestation'],
  oozing: ['Potion of Oozing', '#8dad49', 'oozing'], weaving: ['Potion of Weaving', '#b6b0aa', 'weaving'],
  wind_charging: ['Potion of Wind Charging', '#b8dedb', 'wind_charging'],
};
export const potionId = (type, delivery = 'drink') => delivery === 'drink' ? ({ water: 'water_bottle', healing: 'healing_potion', regeneration: 'regeneration_potion', fire_resistance: 'fire_resistance_potion', strength: 'strength_potion', swiftness: 'speed_potion', water_breathing: 'water_breathing_potion', slow_falling: 'slow_falling_potion' }[type] || `${type}_potion`) : `${delivery}_${type}_potion`;
export const STATIONS = {
  furnace: 'smelt', blast_furnace: 'blast', smoker: 'smoke', stonecutter: 'stonecut', anvil: 'anvil', grindstone: 'grind',
  smithing_table: 'smith', cartography_table: 'cartography', fletching_table: 'fletch', loom: 'loom', composter: 'compost',
  brewing_stand: 'brew', enchanting_table: 'enchant', lectern: 'lectern', cauldron: 'cauldron', crafter: 'craft',
};
export const CONTAINERS = { chest: 27, large_chest: 54, trapped_chest: 27, barrel: 27, ender_chest: 27, hopper: 5, dispenser: 9, dropper: 9, crafter: 9, chiseled_bookshelf: 6 };

function colorFor(name) {
  for (const [wood, color] of Object.entries(WOODS)) if (name.includes(wood)) return color;
  for (const [dye, color] of Object.entries(DYES).sort((a, b) => b[0].length - a[0].length)) if (name.startsWith(`${dye}_`)) return color;
  if (/deepslate|blackstone|netherite/.test(name)) return '#494950';
  if (/copper/.test(name)) return name.includes('oxidized') ? '#51a384' : name.includes('weathered') ? '#659675' : name.includes('exposed') ? '#a48161' : '#c37a58';
  if (/sulfur/.test(name)) return '#d3ba4a';
  if (/cinnabar/.test(name)) return '#a93835';
  if (/diamond/.test(name)) return '#57d8d1';
  if (/emerald/.test(name)) return '#43b65b';
  if (/gold/.test(name)) return '#e9c34a';
  if (/redstone|nether_wart|crimson/.test(name)) return '#b92e32';
  if (/prismarine|warped/.test(name)) return '#61a59c';
  if (/purpur|amethyst|shulker/.test(name)) return '#ab83b4';
  if (/sand|end_stone/.test(name)) return '#ddd09b';
  if (/dirt|mud|root/.test(name)) return '#856344';
  if (/ice|snow|quartz|calcite|iron|bone/.test(name)) return '#cbd6d9';
  if (/leaf|leaves|grass|vine|moss|fern|kelp|plant|seagrass/.test(name)) return '#5f9a3b';
  if (/nether|brick/.test(name)) return '#9c5549';
  return '#92928c';
}
export function shapeFor(name) {
  if (name.endsWith('_stairs')) return 'stairs';
  if (name.endsWith('_slab')) return 'slab';
  if (name.endsWith('_fence_gate')) return 'gate';
  if (name.endsWith('_fence')) return 'fence';
  if (name.endsWith('_wall')) return 'wall';
  if (name.endsWith('_trapdoor')) return 'trapdoor';
  if (name.endsWith('_door')) return 'door';
  if (name.endsWith('_button') || name === 'lever') return name === 'lever' ? 'lever' : 'button';
  if (name.endsWith('_pressure_plate') || /carpet|lily_pad|rail|redstone_wire|repeater|comparator/.test(name)) return 'plate';
  if (/glass_pane|iron_bars/.test(name)) return 'pane';
  if (/hanging_sign/.test(name)) return 'hanging_sign';
  if (name.endsWith('_sign')) return 'sign';
  if (/banner/.test(name)) return 'banner';
  if (/torch|end_rod|candle|chain|lightning_rod/.test(name)) return 'rod';
  if (/lantern/.test(name)) return 'lantern';
  if (/chest|barrel|shulker_box/.test(name)) return 'chest';
  if (name === 'hopper') return 'hopper';
  if (name === 'cauldron') return 'cauldron';
  if (name === 'brewing_stand') return 'brewing_stand';
  if (name === 'anvil') return 'anvil';
  if (name === 'enchanting_table') return 'enchanting_table';
  if (name.endsWith('_bed')) return 'bed';
  if (/pointed_dripstone|sulfur_spike/.test(name)) return 'spike';
  if (/ladder|vine|lichen/.test(name)) return 'ladder';
  if (name === 'scaffolding') return 'scaffolding';
  if (/sapling|flower|tulip|dandelion|poppy|orchid|allium|bluet|daisy|lily_of|rose|sunflower|lilac|peony|torchflower|eyeblossom|fern|short_grass|tall_grass|seagrass|mushroom$|nether_wart$|sugar_cane|wheat$|kelp$|dead_bush|dripleaf|pitcher_plant/.test(name) && !/block|leaves/.test(name)) return 'plant';
  return 'cube';
}
function textureFor(name, shape) {
  if (/ore|ancient_debris/.test(name)) return 'ore';
  if (/log|stem$|hyphae|wood$|pillar/.test(name)) return 'log';
  if (/planks|bamboo_mosaic/.test(name)) return 'planks';
  if (/leaves/.test(name)) return 'leaves';
  if (/glass|ice/.test(name)) return 'glass';
  if (/bricks|tiles/.test(name)) return 'brick';
  if (/cobble/.test(name)) return 'cobble';
  if (/wool|carpet/.test(name)) return 'wool';
  if (/copper|iron_block|gold_block|diamond_block/.test(name)) return 'metal';
  if (/lantern|glowstone|shroomlight|froglight/.test(name)) return 'glow';
  if (/sculk/.test(name)) return 'sculk';
  if (shape === 'plant') return 'plant';
  return 'stone';
}

export function registerExpansion(B, BLOCKS, ITEMS, RECIPES, mobs) {
  const existingBlocks = {
    grass_block: B.GRASS, dirt: B.DIRT, stone: B.STONE, sand: B.SAND, oak_log: B.LOG, oak_leaves: B.LEAVES, water: B.WATER,
    coal_ore: B.COAL, iron_ore: B.IRON, gold_ore: B.GOLD, diamond_ore: B.DIAMOND, oak_planks: B.PLANKS,
    crafting_table: B.TABLE, bedrock: B.BEDROCK, glass: B.GLASS, torch: B.TORCH, stone_bricks: B.BRICK,
  };
  for (const b of BLOCKS.slice(18)) existingBlocks[b.item] = b.id;
  Object.assign(existingBlocks, { white_wool: B.WOOL, snow_block: B.SNOW, moss_block: B.MOSS, hay_block: B.HAY, amethyst_block: B.AMETHYST, quartz_block: B.QUARTZ, lapis_ore: B.LAPIS_ORE });
  const excluded = /^(air|barrier|light|structure_void|structure_block|jigsaw|command_block|chain_command_block|repeating_command_block|debug_stick|test_block|test_instance_block|knowledge_book)$/;
  const blockIds = new Map();
  for (const b of reference.blocks) {
    if (excluded.test(b.id)) continue;
    const local = canonicalItem(b.id), old = existingBlocks[b.id] ?? (ITEMS[local]?.block);
    const shape = shapeFor(b.id), id = old ?? BLOCKS.length;
    const definition = old === undefined ? { name: b.name, color: colorFor(b.id), drop: canonicalItem(b.drops[0] || b.id), time: b.time < 0 ? Infinity : b.time, tool: b.tool === 'pickaxe' ? 'pick' : b.tool, solid: b.solid, transparent: b.transparent || shape !== 'cube', texture: textureFor(b.id, shape), tier: /diamond|emerald|gold_ore|redstone_ore/.test(b.id) ? 3 : /iron_ore|copper_ore|lapis_ore/.test(b.id) ? 2 : /obsidian|ancient_debris/.test(b.id) ? 4 : 0 } : BLOCKS[old];
    Object.assign(definition, { id, item: local, reference: b.id, shape, light: b.light, station: STATIONS[b.id], container: CONTAINERS[b.id] || (b.id.endsWith('shulker_box') ? 27 : 0), redstone: /redstone|lever|button|pressure_plate|piston|dispenser|dropper|hopper|crafter|observer|repeater|comparator|daylight_detector|sculk_sensor|target|tripwire|copper_bulb/.test(b.id) });
    if (old === undefined) BLOCKS.push(definition);
    B[b.id.toUpperCase()] = id; blockIds.set(b.id, id);
    if (!ITEMS[local]) ITEMS[local] = { name: b.name, color: definition.color, block: id, category: 'blocks', reference: b.id };
    else Object.assign(ITEMS[local], { block: id, reference: b.id });
    if (shape === 'plant') definition.solid = false;
  }
  for (const i of reference.items) {
    if (excluded.test(i.id) || i.id.endsWith('_spawn_egg') && !mobs.some(m => `${m.id}_spawn_egg` === i.id)) continue;
    const id = canonicalItem(i.id);
    if (ITEMS[id]) { ITEMS[id].reference ||= i.id; continue; }
    const def = { name: i.name, color: colorFor(i.id), stack: i.stack, reference: i.id, category: 'materials', shape: 'material', ...(i.durability ? { durability: i.durability } : {}) };
    const tool = i.id.match(/^(wooden|stone|copper|iron|golden|diamond|netherite)_(pickaxe|axe|shovel|hoe|sword|spear)$/);
    if (tool) {
      const tiers = { wooden: [1, 2, 4, 59], golden: [1, 12, 4, 32], stone: [2, 4, 5, 131], copper: [2, 5, 5, 190], iron: [3, 6, 6, 250], diamond: [4, 8, 7, 1561], netherite: [5, 9, 8, 2031] };
      const [tier, speed, damage, durability] = tiers[tool[1]];
      Object.assign(def, { tier, speed, damage, durability, stack: 1, cooldown: tool[2] === 'spear' ? .9 : .55, shape: tool[2] === 'pickaxe' ? 'pick' : tool[2] });
      if (['sword', 'spear'].includes(tool[2])) Object.assign(def, { weapon: tool[2], category: 'combat', reach: tool[2] === 'spear' ? 4.5 : 3, ...(tool[2] === 'spear' ? { action: 'spear' } : {}) });
      else Object.assign(def, { tool: tool[2] === 'pickaxe' ? 'pick' : tool[2], category: 'tools', ...(tool[2] === 'hoe' ? { action: 'hoe' } : {}) });
    }
    const armor = i.id.match(/^(leather|copper|chainmail|iron|golden|diamond|netherite)_(helmet|chestplate|leggings|boots)$/);
    if (armor) Object.assign(def, { armorSlot: armor[2], shape: armor[2], defense: ({ leather: 1, copper: 1.4, chainmail: 1.8, iron: 2, golden: 1.5, diamond: 3, netherite: 3.5 }[armor[1]]) * ({ helmet: 1, chestplate: 2, leggings: 1.5, boots: 1 }[armor[2]]), stack: 1, durability: i.durability || 200, category: 'combat' });
    if (/dye$/.test(i.id)) Object.assign(def, { color: DYES[i.id.replace('_dye', '')] || def.color, action: 'dye' });
    if (/boat|raft|minecart/.test(i.id)) Object.assign(def, { action: 'vehicle', vehicle: /minecart/.test(i.id) ? 'cart' : 'boat', category: 'transport', stack: 1, shape: 'vehicle' });
    if (/horse_armor|nautilus_armor/.test(i.id)) Object.assign(def, { action: 'mount_armor', category: 'combat', shape: 'chestplate', stack: 1 });
    if (i.id.endsWith('_harness')) Object.assign(def, { action: 'harness', category: 'transport', shape: 'saddle', stack: 1 });
    if (i.id.endsWith('_bucket')) Object.assign(def, { action: 'mob_bucket', bucketMob: i.id.replace('_bucket', ''), shape: 'bucket', category: 'tools', stack: 1 });
    if (/banner_pattern|pottery_sherd|smithing_template/.test(i.id)) Object.assign(def, { action: 'template', category: 'materials' });
    if (/music_disc/.test(i.id)) Object.assign(def, { action: 'disc', shape: 'disc', category: 'tools', stack: 1 });
    ITEMS[id] = def;
  }
  const addBlock = (id, options = {}) => {
    if (ITEMS[id]?.block) return ITEMS[id].block;
    const block = BLOCKS.length, color = options.color || colorFor(id);
    const def = { id: block, item: id, reference: id, name: id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '), color, drop: id, time: 1.2, tool: 'pick', shape: shapeFor(id), texture: textureFor(id, shapeFor(id)), ...options };
    def.transparent ||= def.shape !== 'cube'; BLOCKS.push(def); B[id.toUpperCase()] = block;
    ITEMS[id] = { name: def.name, color, block, reference: id, category: 'blocks' }; return block;
  };
  for (const material of ['cinnabar', 'sulfur']) {
    for (const base of [material, `polished_${material}`, `${material}_bricks`]) {
      addBlock(base);
      for (const suffix of ['stairs', 'slab', 'wall']) addBlock(`${base.replace(/bricks$/, 'brick')}_${suffix}`);
    }
    addBlock(`chiseled_${material}`);
  }
  addBlock('sulfur_spike', { solid: false }); addBlock('potent_sulfur', { light: 4 });
  addBlock('large_chest', { container: 54, tool: 'axe' });
  addBlock('piston_head', { shape: 'piston_head', time: Infinity });
  addBlock('redstone_wire', { name: 'Redstone Dust', solid: false, shape: 'wire', redstone: true, drop: 'redstone', color: '#b02222' });
  ITEMS.redstone.block = B.REDSTONE_WIRE;
  for (const [id, def] of Object.entries(ITEMS)) if (def.block) {
    const block = BLOCKS[def.block];
    if (!ITEMS[block.drop]) block.drop = id;
    if (block.station || block.container || block.redstone) def.category = 'redstone';
    if (['plant', 'spike'].includes(block.shape) || /leaves|moss/.test(id)) def.category = 'nature';
    if (['sign', 'hanging_sign'].includes(block.shape)) block.action = 'sign';
  }
  for (const f of reference.foods) if (ITEMS[canonicalItem(f.id)]) Object.assign(ITEMS[canonicalItem(f.id)], { food: f.food, category: 'food', shape: /stew|soup/.test(f.id) ? 'bowl' : /fish|salmon|cod/.test(f.id) ? 'fish' : 'food' });
  for (const [type, [name, color, effect]] of Object.entries(POTIONS)) for (const delivery of ['drink', 'splash', 'lingering']) {
    const id = potionId(type, delivery);
    ITEMS[id] = { name: delivery === 'drink' ? name : `${delivery === 'splash' ? 'Splash' : 'Lingering'} ${name}`, color, effect, potion: type, delivery, action: 'potion', shape: 'bottle', category: 'combat', stack: 1, reference: delivery === 'drink' ? 'potion' : `${delivery}_potion` };
  }
  for (const [id, action, category = 'tools', shape] of [
    ['compass', 'compass'], ['recovery_compass', 'recovery_compass'], ['clock', 'clock'], ['spyglass', 'spyglass'], ['filled_map', 'map'], ['map', 'map'],
    ['bundle', 'bundle'], ['name_tag', 'name'], ['ender_eye', 'eye'], ['firework_rocket', 'rocket', 'combat'], ['elytra', 'elytra', 'transport', 'wings'],
    ['writable_book', 'write'], ['written_book', 'read'], ['knowledge_book', 'recipes'], ['painting', 'decoration'], ['item_frame', 'frame'], ['glow_item_frame', 'frame'], ['armor_stand', 'armor_stand'],
    ['powder_snow_bucket', 'powder_snow', 'tools', 'bucket'],
  ]) { ITEMS[id] ||= { name: id.replaceAll('_', ' '), color: '#a1afa5', stack: 1 }; Object.assign(ITEMS[id], { action, category, ...(shape ? { shape } : {}) }); }
  ITEMS.elytra.armorSlot = 'chestplate'; ITEMS.elytra.defense = 0; ITEMS.elytra.durability = 432;
  ITEMS.sulfur_cube_bucket = { name: 'Bucket of Sulfur Cube', color: '#d1bf56', stack: 1, action: 'mob_bucket', bucketMob: 'sulfur_cube', category: 'tools', shape: 'bucket' };
  ITEMS.music_disc_bounce = { name: 'Music Disc - Bounce', color: '#d5b846', action: 'disc', shape: 'disc', category: 'tools', stack: 1 };
  ITEMS.nautilus_armor = { ...ITEMS.iron_nautilus_armor, name: 'Nautilus Armor', action: 'mount_armor', color: '#c4cecc', shape: 'chestplate', category: 'combat', stack: 1 };
  for (const [id, def] of Object.entries(ENCHANTMENTS)) ITEMS[`${id}_enchanted_book`] = { name: `${def.name} Enchanted Book`, color: '#a977aa', shape: 'book', enchantment: id, category: 'enchanting', stack: 1, reference: 'enchanted_book' };
  for (const [id, potion] of Object.entries(POTIONS)) if (potion[2]) ITEMS[`${id}_tipped_arrow`] = { name: `Arrow of ${potion[0].replace('Potion of ', '')}`, color: potion[1], shape: 'arrow', category: 'combat', arrowEffect: potion[2], reference: 'tipped_arrow' };
  ITEMS.spectral_arrow.arrowEffect = 'glowing';
  ITEMS.tipped_arrow.arrowEffect = 'poison';
  for (const [id, effect] of [['enchanted_golden_apple', 'enchanted_apple'], ['poisonous_potato', 'poison'], ['suspicious_stew', 'night_vision'], ['chorus_fruit', 'chorus']]) if (ITEMS[id]) ITEMS[id].effect = effect;
  // Stable old recipes stay first; the canonical book adds all material variants.
  const known = new Set(RECIPES.map(r => `${r.id}:${JSON.stringify(r.needs)}`));
  for (const r of reference.recipes) {
    const id = canonicalItem(r.id), cells = r.pattern?.map(row => row.map(v => v ? canonicalItem(v) : null));
    const ingredients = cells?.flat().filter(Boolean) || r.ingredients.map(canonicalItem), needs = {};
    if (!ITEMS[id] || ingredients.some(i => !ITEMS[i]) || ingredients.includes(id)) continue;
    for (const i of ingredients) needs[i] = (needs[i] || 0) + 1;
    const key = `${id}:${JSON.stringify(needs)}`; if (known.has(key)) continue; known.add(key);
    const pattern = cells ? Array.from({ length: 9 }, (_, i) => cells[Math.floor(i / 3)]?.[i % 3] || null) : [...ingredients, ...Array(9).fill(null)].slice(0, 9);
    RECIPES.push({ id, count: r.count, needs, pattern, table: cells ? cells.length > 2 || cells.some(row => row.length > 2) : ingredients.length > 4, shapeless: !cells, note: '' });
  }
  const addRecipe = (id, needs, count = 1) => RECIPES.push({ id, needs, count, table: true, pattern: Object.entries(needs).flatMap(([key, n]) => Array(Math.min(n, 9)).fill(key)).slice(0, 9), shapeless: true, note: '' });
  for (const material of ['cinnabar', 'sulfur']) {
    addRecipe(`polished_${material}`, { [material]: 4 }, 4); addRecipe(`${material}_bricks`, { [`polished_${material}`]: 4 }, 4); addRecipe(`chiseled_${material}`, { [`${material}_slab`]: 2 });
    for (const base of [material, `polished_${material}`, `${material}_bricks`]) for (const [suffix, cost, count] of [['stairs', 6, 4], ['slab', 3, 6], ['wall', 6, 6]]) addRecipe(`${base.replace(/bricks$/, 'brick')}_${suffix}`, { [base]: cost }, count);
  }
  addRecipe('potent_sulfur', { sulfur: 9 }); addRecipe('sulfur', { sulfur_spike: 4 });
  addRecipe('large_chest', { chest: 2 });
  for (const [name, value] of Object.entries(B)) if (!Number.isInteger(value)) throw new Error(`Invalid block constant ${name}`);
}
