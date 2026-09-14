import { ITEMS, RECIPES, freshItem, stackLimit } from './catalog.js';

export class Inventory {
  constructor(slots) { this.slots = slots ? slots.map(s => s ? { ...s } : null) : Array(36).fill(null); }
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
  add(id, amount = 1, durability = null) {
    if (!Object.hasOwn(ITEMS, id) || !Number.isInteger(amount) || amount < 1) return amount;
    let left = amount;
    const max = stackLimit(id);
    if (max > 1) for (const s of this.slots) {
      if (s?.id === id && s.count < max) { const n = Math.min(left, max - s.count); s.count += n; left -= n; if (!left) return 0; }
    }
    for (let i = 0; i < this.slots.length && left; i++) if (!this.slots[i]) {
      const n = Math.min(left, max); this.slots[i] = freshItem(id, n); left -= n;
      if (ITEMS[id].durability && Number.isFinite(durability)) this.slots[i].durability = Math.max(1, Math.min(ITEMS[id].durability, durability));
    }
    return left;
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
    if (a && b && a.id === b.id && stackLimit(a.id) > 1) {
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
    return Array.isArray(slots) && slots.length === 36 && slots.every(s => s === null || (Object.hasOwn(ITEMS, s?.id) && Number.isInteger(s.count) && s.count > 0 && s.count <= stackLimit(s.id) && (!ITEMS[s.id].durability || (Number.isFinite(s.durability) && s.durability > 0 && s.durability <= ITEMS[s.id].durability))));
  }
}

export { RECIPES };
