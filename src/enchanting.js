import { ITEMS } from './catalog.js';
import { ENCHANTMENTS } from './expansion.js';

export const enchantLevel = (stack, id) => stack?.enchantments?.[id] || 0;
export function canEnchant(stack, id) {
  const item = ITEMS[stack?.id], enchantment = ENCHANTMENTS[id];
  if (!item || !enchantment) return false;
  if (stack.id === 'book' || stack.id === 'enchanted_book') return true;
  if (enchantment.excludes.some(key => enchantLevel(stack, key))) return false;
  if (['unbreaking', 'mending', 'vanishing_curse'].includes(id)) return !!item.durability;
  if (id === 'binding_curse') return !!item.armorSlot;
  if (id === 'lunge') return item.weapon === 'spear';
  if (['efficiency', 'fortune', 'silk_touch'].includes(id)) return !!item.tool;
  if (['power', 'punch', 'flame', 'infinity'].includes(id)) return stack.id === 'bow';
  if (['quick_charge', 'multishot', 'piercing'].includes(id)) return stack.id === 'crossbow';
  if (['channeling', 'impaling', 'loyalty', 'riptide'].includes(id)) return stack.id === 'trident';
  if (['density', 'breach', 'wind_burst'].includes(id)) return stack.id === 'mace';
  if (['feather_falling', 'depth_strider', 'frost_walker', 'soul_speed'].includes(id)) return item.armorSlot === 'boots';
  if (['respiration', 'aqua_affinity'].includes(id)) return item.armorSlot === 'helmet';
  if (id === 'swift_sneak') return item.armorSlot === 'leggings';
  if (/protection|thorns/.test(id)) return !!item.armorSlot && item.armorSlot !== 'offhand';
  return !!item.weapon || item.tool === 'axe' || stack.id === 'mace';
}
export function enchantItem(state, index, id) {
  const item = state.inventory.slots[index], def = ENCHANTMENTS[id];
  if (!canEnchant(item, id)) return { ok: false, reason: 'Incompatible enchantment' };
  const next = enchantLevel(item, id) + 1;
  if (next > def.max) return { ok: false, reason: 'Maximum enchantment level' };
  const cost = next * 100;
  if (state.mode !== 'creative' && (state.xp < cost || state.inventory.count('lapis') < next)) return { ok: false, reason: `Requires ${next} level${next > 1 ? 's' : ''} and ${next} lapis` };
  if (state.mode !== 'creative') { state.xp -= cost; state.inventory.remove('lapis', next); }
  item.enchantments = { ...item.enchantments, [id]: next };
  return { ok: true };
}
export function wearItem(stack, amount = 1, roll = Math.random) {
  if (!stack?.durability) return false;
  for (let i = 0; i < amount; i++) if (roll() < 1 / (1 + enchantLevel(stack, 'unbreaking'))) stack.durability--;
  return stack.durability <= 0;
}
export function mendEquipment(state, xp) {
  let left = xp;
  const items = [...Object.values(state.equipment || {}), ...state.inventory.slots];
  for (const item of items) if (left > 0 && enchantLevel(item, 'mending') && item.durability < ITEMS[item.id].durability) {
    const used = Math.min(left, Math.ceil((ITEMS[item.id].durability - item.durability) / 2));
    item.durability = Math.min(ITEMS[item.id].durability, item.durability + used * 2); left -= used;
  }
  return left;
}
