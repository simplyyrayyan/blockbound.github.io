import { ITEMS, RECIPES, stackLimit, freshItem } from './catalog.js';

function trim(rows) {
  rows = rows.map(row => [...row]);
  while (rows.length && rows[0].every(v => !v)) rows.shift();
  while (rows.length && rows.at(-1).every(v => !v)) rows.pop();
  if (!rows.length) return [];
  while (rows.every(row => !row[0])) for (const row of rows) row.shift();
  while (rows.every(row => !row.at(-1))) for (const row of rows) row.pop();
  return rows;
}
export function matchCraftGrid(slots, size = 3) {
  const cells = slots.slice(0, size * size).map(s => s?.id || null);
  const actual = trim(Array.from({ length: size }, (_, y) => cells.slice(y * size, y * size + size)));
  const counts = {}; for (const id of cells.filter(Boolean)) counts[id] = (counts[id] || 0) + 1;
  return RECIPES.find(recipe => {
    if (Object.keys(counts).length !== Object.keys(recipe.needs).length || Object.entries(recipe.needs).some(([id, n]) => counts[id] !== n)) return false;
    if (recipe.shapeless) return true;
    const expected = trim(Array.from({ length: 3 }, (_, y) => Array.from({ length: 3 }, (_, x) => recipe.pattern[y * 3 + x] || null)));
    return JSON.stringify(actual) === JSON.stringify(expected) || JSON.stringify(actual) === JSON.stringify(expected.map(row => [...row].reverse()));
  }) || null;
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
