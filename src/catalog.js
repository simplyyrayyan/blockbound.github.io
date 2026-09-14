export const B = Object.freeze({ AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, LOG: 5, LEAVES: 6, WATER: 7, COAL: 8, IRON: 9, GOLD: 10, DIAMOND: 11, PLANKS: 12, TABLE: 13, BEDROCK: 14, GLASS: 15, TORCH: 16, BRICK: 17 });

export const BLOCKS = [
  { name: 'Air', solid: false },
  { name: 'Grass block', color: '#80a94d', drop: 'dirt', time: .55, tool: 'shovel' },
  { name: 'Dirt', color: '#916341', drop: 'dirt', time: .45, tool: 'shovel' },
  { name: 'Stone', color: '#858b8b', drop: 'stone', time: 1.5, tool: 'pick', tier: 1 },
  { name: 'Sand', color: '#decc92', drop: 'sand', time: .4, tool: 'shovel' },
  { name: 'Oak log', color: '#896041', drop: 'log', time: 1.05, tool: 'axe' },
  { name: 'Oak leaves', color: '#508348', drop: 'leaves', time: .2 },
  { name: 'Water', color: '#549dba', solid: false },
  { name: 'Coal ore', color: '#444846', drop: 'coal', time: 1.8, tool: 'pick', tier: 1, xp: 3 },
  { name: 'Iron ore', color: '#c8947e', drop: 'iron', time: 2.1, tool: 'pick', tier: 2, xp: 5 },
  { name: 'Gold ore', color: '#e6bd52', drop: 'gold', time: 2.4, tool: 'pick', tier: 3, xp: 7 },
  { name: 'Diamond ore', color: '#6fdacb', drop: 'diamond', time: 2.8, tool: 'pick', tier: 3, xp: 12 },
  { name: 'Oak planks', color: '#c49860', drop: 'planks', time: .75, tool: 'axe' },
  { name: 'Crafting table', color: '#b5834d', drop: 'table', time: 1.1, tool: 'axe' },
  { name: 'Bedrock', color: '#42494b', time: Infinity },
  { name: 'Glass', color: '#badfe0', drop: 'glass', time: .35 },
  { name: 'Torch', color: '#f0c366', drop: 'torch', time: .12, solid: false },
  { name: 'Stone bricks', color: '#a2a49b', drop: 'brick', time: 1.3, tool: 'pick', tier: 1 },
];

export const ITEMS = {
  dirt: { name: 'Dirt', block: B.DIRT, color: '#916341' },
  grass: { name: 'Grass block', block: B.GRASS, color: '#80a94d' },
  stone: { name: 'Stone', block: B.STONE, color: '#858b8b' },
  sand: { name: 'Sand', block: B.SAND, color: '#decc92' },
  log: { name: 'Oak log', block: B.LOG, color: '#896041' },
  leaves: { name: 'Oak leaves', block: B.LEAVES, color: '#508348' },
  planks: { name: 'Oak planks', block: B.PLANKS, color: '#c49860' },
  table: { name: 'Crafting table', block: B.TABLE, color: '#b5834d' },
  glass: { name: 'Glass', block: B.GLASS, color: '#badfe0' },
  torch: { name: 'Torch', block: B.TORCH, color: '#f0c366' },
  brick: { name: 'Stone bricks', block: B.BRICK, color: '#a2a49b' },
  coal: { name: 'Coal', color: '#373d40', shape: 'gem' },
  iron: { name: 'Iron ingot', color: '#dfc4b8', shape: 'ingot' },
  gold: { name: 'Gold ingot', color: '#efd169', shape: 'ingot' },
  diamond: { name: 'Diamond', color: '#6ddbcf', shape: 'gem' },
  stick: { name: 'Sticks', color: '#a7794f', shape: 'stick' },
  apple: { name: 'Apple', color: '#e77759', shape: 'apple', food: 5 },
  wood_pick: { name: 'Wooden pickaxe', color: '#c79c68', tool: 'pick', tier: 1, speed: 1.3, durability: 64, stack: 1 },
  stone_pick: { name: 'Stone pickaxe', color: '#a5afae', tool: 'pick', tier: 2, speed: 2.4, durability: 132, stack: 1 },
  iron_pick: { name: 'Iron pickaxe', color: '#dfc4b8', tool: 'pick', tier: 3, speed: 3.7, durability: 252, stack: 1 },
  diamond_pick: { name: 'Diamond pickaxe', color: '#6ddbcf', tool: 'pick', tier: 4, speed: 5.5, durability: 1024, stack: 1 },
  wood_axe: { name: 'Wooden axe', color: '#c79c68', tool: 'axe', speed: 2.8, durability: 80, stack: 1 },
  shovel: { name: 'Stone shovel', color: '#a5afae', tool: 'shovel', speed: 3.2, durability: 132, stack: 1 },
};

// Recipe patterns are also shown in the workbench, so requirements stay visible.
export const RECIPES = [
  { id: 'planks', count: 4, needs: { log: 1 }, pattern: ['log'], note: 'A little wood goes a long way.' },
  { id: 'stick', count: 4, needs: { planks: 2 }, pattern: [null, 'planks', null, null, 'planks'], note: 'The beginning of a good tool.' },
  { id: 'table', count: 1, needs: { planks: 4 }, pattern: ['planks', 'planks', null, 'planks', 'planks'], note: 'Place it, then right-click to make better tools.' },
  { id: 'wood_pick', count: 1, needs: { planks: 3, stick: 2 }, pattern: ['planks', 'planks', 'planks', null, 'stick', null, null, 'stick'], note: 'Your first step into the stone age.' },
  { id: 'wood_axe', count: 1, needs: { planks: 3, stick: 2 }, pattern: ['planks', 'planks', null, 'planks', 'stick', null, null, 'stick'], note: 'Makes short work of trees.' },
  { id: 'torch', count: 4, needs: { coal: 1, stick: 1 }, pattern: [null, 'coal', null, null, 'stick'], note: 'Place a warm light in the dark.' },
  { id: 'stone_pick', count: 1, needs: { stone: 3, stick: 2 }, table: true, pattern: ['stone', 'stone', 'stone', null, 'stick', null, null, 'stick'], note: 'Strong enough to gather iron.' },
  { id: 'shovel', count: 1, needs: { stone: 1, stick: 2 }, table: true, pattern: [null, 'stone', null, null, 'stick', null, null, 'stick'], note: 'Dig through dirt and sand faster.' },
  { id: 'iron_pick', count: 1, needs: { iron: 3, stick: 2 }, table: true, pattern: ['iron', 'iron', 'iron', null, 'stick', null, null, 'stick'], note: 'Find gold and diamonds in the depths.' },
  { id: 'diamond_pick', count: 1, needs: { diamond: 3, stick: 2 }, table: true, pattern: ['diamond', 'diamond', 'diamond', null, 'stick', null, null, 'stick'], note: 'A trusty companion for a long adventure.' },
  { id: 'glass', count: 4, needs: { sand: 4, coal: 1 }, table: true, pattern: ['sand', 'sand', null, 'sand', 'sand', null, null, 'coal'], note: 'Coal-fired glass for a room with a view.' },
  { id: 'brick', count: 4, needs: { stone: 4 }, table: true, pattern: ['stone', 'stone', null, 'stone', 'stone'], note: 'A solid foundation.' },
];

export const isSolid = id => id > 0 && BLOCKS[id].solid !== false;
export const isTransparent = id => id === B.AIR || id === B.WATER || id === B.LEAVES || id === B.GLASS || id === B.TORCH;
export const stackLimit = id => ITEMS[id]?.stack || 64;
export const freshItem = (id, count = 1) => ({ id, count, ...(ITEMS[id]?.durability ? { durability: ITEMS[id].durability } : {}) });
