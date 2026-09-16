import { ITEMS, RECIPES, stackLimit, freshItem } from './catalog.js';

// Only item data crosses inventory, entity, and container boundaries.
export function stackData(stack) {
  const result = {};
  for (const key of ['id', 'count', 'durability', 'enchantments', 'name', 'text', 'contents', 'trim', 'trimPattern', 'pattern', 'dye', 'mapScale', 'locked', 'captured']) {
    if (stack?.[key] !== undefined) result[key] = structuredClone(stack[key]);
  }
  return result;
}

function trim(rows) {
  rows = rows.map(row => [...row]);
  while (rows.length && rows[0].every(v => !v)) rows.shift();
  while (rows.length && rows.at(-1).every(v => !v)) rows.pop();
  if (!rows.length) return [];
  while (rows.every(row => !row[0])) for (const row of rows) row.shift();
  while (rows.every(row => !row.at(-1))) for (const row of rows) row.pop();
  return rows;
}
let recipeIndex;
export function matchCraftGrid(slots, size = 3) {
  recipeIndex ||= new Map();
  const cells = slots.slice(0, size * size).map(s => s?.id || null);
  const actual = trim(Array.from({ length: size }, (_, y) => cells.slice(y * size, y * size + size)));
  const counts = {}; for (const id of cells.filter(Boolean)) counts[id] = (counts[id] || 0) + 1;
  const signature = JSON.stringify([size, actual]);
  if (recipeIndex.has(signature)) return recipeIndex.get(signature);
  const result = RECIPES.find(recipe => {
    if (size === 2 && recipe.table) return false;
    if (Object.keys(counts).length !== Object.keys(recipe.needs).length || Object.entries(recipe.needs).some(([id, n]) => counts[id] !== n)) return false;
    if (recipe.shapeless) return true;
    const expected = trim(Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => recipe.pattern[y * 3 + x] || null)));
    return JSON.stringify(actual) === JSON.stringify(expected) || JSON.stringify(actual) === JSON.stringify(expected.map(row => [...row].reverse()));
  }) || null;
  if (recipeIndex.size > 4096) recipeIndex.clear();
  recipeIndex.set(signature, result); return result;
}
export function fillCraftGrid(recipe, slots, inventory, size = 3, creative = false) {
  const rows = trim(Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => recipe.pattern[y * 3 + x] || null)));
  if (rows.length > size || rows.some(row => row.length > size) || size === 2 && recipe.table) return { ok: false, reason: 'Use a crafting table for this recipe' };
  const trial = inventory.slots.map(s => s && structuredClone(s));
  for (const item of slots) if (item && insertStack(trial, item)) return { ok: false, reason: 'Make room to return the crafting ingredients' };
  const grid = Array(size * size).fill(null);
  for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
    const id = rows[y][x]; if (!id) continue;
    const index = trial.findIndex(s => s?.id === id);
    if (index < 0 && !creative) return { ok: false, reason: 'Missing ' + ITEMS[id].name };
    grid[y * size + x] = freshItem(id);
    if (!creative && --trial[index].count === 0) trial[index] = null;
  }
  inventory.slots = trial; slots.splice(0, slots.length, ...grid); return { ok: true };
}
export function craftGrid(slots, inventory, size = 3) {
  const recipe = matchCraftGrid(slots, size); if (!recipe) return { ok: false, reason: 'No matching recipe' };
  const trial = inventory.slots.map(s => s && structuredClone(s));
  const result = insertStack(trial, freshItem(recipe.id, recipe.count));
  if (result) return { ok: false, reason: 'Inventory is full' };
  inventory.slots = trial;
  for (let i = 0; i < size * size; i++) if (slots[i]) { if (--slots[i].count === 0) slots[i] = null; }
  return { ok: true, recipe };
}
export function stackEqual(a, b) {
  if (!a || !b || a.id !== b.id) return false;
  const { count: ca, ...ma } = a, { count: cb, ...mb } = b;
  return JSON.stringify(ma) === JSON.stringify(mb);
}
export function insertStack(slots, stack) {
  if (!stack || !ITEMS[stack.id]) return stack?.count || 0;
  let left = stack.count, limit = stackLimit(stack.id);
  for (const item of slots) if (item && stackEqual(item, stack) && item.count < limit) { const n = Math.min(left, limit - item.count); item.count += n; left -= n; if (!left) return 0; }
  for (let i = 0; i < slots.length && left; i++) if (!slots[i]) { const count = Math.min(left, limit); slots[i] = { ...structuredClone(stack), count }; left -= count; }
  return left;
}
export function transferStack(from, index, to, amount = Infinity) {
  const stack = from[index]; if (!stack) return false;
  const count = Math.min(stack.count, amount), leftover = insertStack(to, { ...structuredClone(stack), count });
  stack.count -= count - leftover; if (!stack.count) from[index] = null;
  return leftover < count;
}

// Commit only to the requested cell. Selection and canceled drags never remove items.
export function transferSlot(from, index, to, target, amount = Infinity, swap = true) {
  if (!Number.isInteger(index) || !Number.isInteger(target) || index < 0 || index >= from.length || target < 0 || target >= to.length || from === to && index === target) return false;
  const source = from[index], destination = to[target];
  if (!source || amount <= 0) return false;
  if (destination && !stackEqual(source, destination)) {
    if (!swap || amount < source.count) return false;
    from[index] = destination; to[target] = source; return true;
  }
  const count = Math.min(source.count, Math.floor(amount), stackLimit(source.id) - (destination?.count || 0));
  if (count <= 0) return false;
  to[target] = { ...structuredClone(source), count: (destination?.count || 0) + count };
  source.count -= count;
  if (!source.count) from[index] = null;
  return true;
}
