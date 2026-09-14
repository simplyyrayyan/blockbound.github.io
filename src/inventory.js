import { ITEMS, RECIPES, freshItem, stackLimit } from './catalog.js';
import { insertStack, stackEqual } from './crafting.js';
import { ENCHANTMENTS } from './expansion.js';

export class Inventory {
  constructor(slots) { this.slots = slots ? slots.map(s => s ? structuredClone(s) : null) : Array(36).fill(null); }
  static starter(creative = false) {
    const inv = new Inventory();
    if (creative) {
      for (const [id, count] of [['diamond_pick', 1], ['grass', 64], ['stone', 64], ['log', 64], ['planks', 64], ['glass', 64], ['brick', 64], ['torch', 64], ['table', 64], ['sand', 64], ['leaves', 64], ['dirt', 64]]) inv.add(id, count);
    } else {
      inv.add('wood_pick', 1); inv.add('log', 3); inv.add('dirt', 16); inv.add('apple', 4);
    }
    return inv;
  }
  count(id) { return this.slots.reduce((sum, s) => sum + (s?.id === id ? s.count : 0), 0); }
  add(id, amount = 1, durability = null, metadata = null) {
    if (!Object.hasOwn(ITEMS, id) || !Number.isInteger(amount) || amount < 1) return amount;
    const stack = { ...freshItem(id, amount), ...(metadata ? structuredClone(metadata) : {}), id, count: amount };
    if (ITEMS[id].durability && Number.isFinite(durability)) stack.durability = Math.max(1, Math.min(ITEMS[id].durability, durability));
    return insertStack(this.slots, stack);
  }
  remove(id, amount) {
    if (this.count(id) < amount) return false;
    let left = amount;
    for (let i = 0; i < this.slots.length && left; i++) if (this.slots[i]?.id === id) {
      const n = Math.min(left, this.slots[i].count); this.slots[i].count -= n; left -= n;
      if (!this.slots[i].count) this.slots[i] = null;
    }
    return true;
  }
  move(from, to) {
    if (from === to || from < 0 || to < 0 || from >= 36 || to >= 36) return;
    const a = this.slots[from], b = this.slots[to];
    if (a && b && stackEqual(a, b) && stackLimit(a.id) > 1) {
      const n = Math.min(a.count, stackLimit(a.id) - b.count); a.count -= n; b.count += n;
      if (!a.count) this.slots[from] = null;
    } else { this.slots[from] = b; this.slots[to] = a; }
  }
  canCraft(recipe, nearTable = false, creative = false) {
    if (recipe.table && !nearTable && !creative) return { ok: false, reason: 'Place a crafting table nearby' };
    for (const [id, n] of Object.entries(recipe.needs)) if (this.count(id) < n && !creative) return { ok: false, reason: `Need ${n - this.count(id)} more ${ITEMS[id].name.toLowerCase()}` };
    const trial = new Inventory(this.slots);
    if (!creative) for (const [id, n] of Object.entries(recipe.needs)) trial.remove(id, n);
    if (trial.add(recipe.id, recipe.count)) return { ok: false, reason: 'Make room in your backpack' };
    return { ok: true, slots: trial.slots };
  }
  craft(recipe, nearTable = false, creative = false) {
    const result = this.canCraft(recipe, nearTable, creative);
    if (result.ok) this.slots = result.slots;
    return result;
  }
  static validate(slots) {
    return Array.isArray(slots) && slots.length === 36 && slots.every(validStack);
  }
}

export function validStack(s, depth = 0) {
  if (s === null) return true;
  if (!s || !Object.hasOwn(ITEMS, s.id) || !Number.isInteger(s.count) || s.count < 1 || s.count > stackLimit(s.id)) return false;
  if (ITEMS[s.id].durability && (!Number.isFinite(s.durability) || s.durability <= 0 || s.durability > ITEMS[s.id].durability)) return false;
  if (s.enchantments && (typeof s.enchantments !== 'object' || Object.entries(s.enchantments).some(([id, level]) => !Object.hasOwn(ENCHANTMENTS, id) || !Number.isInteger(level) || level < 1 || level > ENCHANTMENTS[id].max))) return false;
  if (s.name !== undefined && (typeof s.name !== 'string' || s.name.length > 40)) return false;
  if (s.text !== undefined && (typeof s.text !== 'string' || s.text.length > 8000)) return false;
  if (s.contents && (depth > 0 || !Array.isArray(s.contents) || s.contents.length > 27 || s.contents.some(item => !validStack(item, depth + 1)))) return false;
  return true;
}

export { RECIPES };
