import { mkdir, writeFile } from 'node:fs/promises';

// Only the compact, version-pinned fields used by Blockbound are shipped.
const root = new URL('../', import.meta.url);
const source = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/pc/26.1/';
const fetchJSON = async name => {
  const response = await fetch(`${source}${name}.json`, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
};
const items = await fetchJSON('items');
const names = new Map(items.map(i => [i.id, i.name]));
const blocks = await fetchJSON('blocks');
const recipes = await fetchJSON('recipes');
const foods = await fetchJSON('foods');
const enchantments = await fetchJSON('enchantments');
const itemNames = new Set(names.values());
const data = {
  version: '26.1',
  items: items.filter(i => i.name !== 'air').map(i => ({ id: i.name, name: i.displayName, stack: i.stackSize, ...(i.maxDurability ? { durability: i.maxDurability } : {}) })),
  blocks: blocks.filter(b => itemNames.has(b.name) && b.name !== 'air' || ['water', 'lava', 'nether_portal', 'end_portal', 'end_gateway', 'powder_snow', 'fire'].includes(b.name)).map(b => ({
    id: b.name, name: b.displayName, time: b.diggable ? Math.max(.1, b.hardness) : -1,
    tool: b.material?.split('/')[1], solid: b.boundingBox !== 'empty', transparent: b.transparent,
    light: b.emitLight, drops: b.drops.map(i => names.get(i)).filter(Boolean),
  })),
  recipes: Object.values(recipes).flat().map(r => ({
    id: names.get(r.result.id), count: r.result.count,
    ...(r.inShape ? { pattern: r.inShape.map(row => row.map(i => names.get(i) || null)) } : { ingredients: r.ingredients?.map(i => names.get(i)).filter(Boolean) }),
  })).filter(r => r.id && (r.pattern || r.ingredients?.length)),
  foods: foods.map(f => ({ id: f.name, food: f.foodPoints, saturation: f.saturation })),
  enchantments: enchantments.map(e => ({ id: e.name, name: e.displayName, max: e.maxLevel, category: e.category, excludes: e.exclude, curse: e.curse })),
};
await mkdir(new URL('src/data/', root), { recursive: true });
await writeFile(new URL('src/data/reference.json', root), JSON.stringify(data));
console.log(`Reference data: ${data.items.length} items, ${data.blocks.length} blocks, ${data.recipes.length} recipes, ${data.enchantments.length} enchantments`);
