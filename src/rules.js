import { B, BLOCKS, ITEMS } from './catalog.js';
import { blockOverlapsPlayer, HEIGHT } from './world.js';
import { Inventory } from './inventory.js';

export function miningInfo(id, item, creative = false) {
  const block = BLOCKS[id], tool = ITEMS[item?.id];
  if (!block || !id || id === B.WATER) return { ok: false, reason: 'Nothing to mine' };
  if (id === B.BEDROCK) return { ok: false, reason: 'Bedrock is unbreakable' };
  if (creative) return { ok: true, time: .12 };
  if (block.tier && (tool?.tool !== 'pick' || tool.tier < block.tier)) {
    const tier = ['', 'wooden', 'stone', 'iron'][block.tier];
    return { ok: false, reason: `Needs a ${tier} pickaxe` };
  }
  return { ok: true, time: block.time / (tool?.tool === block.tool ? tool.speed : 1) };
}

export function mineBlock(world, inventory, hit, selected, creative = false) {
  const id = world.get(hit.x, hit.y, hit.z);
  if (id !== hit.id) return { ok: false, reason: 'Block changed' };
  const check = miningInfo(id, inventory.slots[selected], creative);
  if (!check.ok) return check;
  const block = BLOCKS[id];
  const trial = new Inventory(inventory.slots);
  if (!creative && trial.add(block.drop, 1)) return { ok: false, reason: 'Your backpack is full' };
  if (!world.set(hit.x, hit.y, hit.z, B.AIR)) return { ok: false, reason: 'Cannot break this block' };
  let brokeTool = false;
  if (!creative) {
    const item = trial.slots[selected];
    if (item?.durability) { item.durability--; if (item.durability <= 0) { trial.slots[selected] = null; brokeTool = true; } }
    inventory.slots = trial.slots;
  }
  return { ok: true, drop: block.drop, xp: block.xp || 1, brokeTool };
}

export function placeBlock(world, inventory, selected, hit, player, creative = false) {
  const item = inventory.slots[selected], def = ITEMS[item?.id];
  if (!def?.block) return { ok: false, reason: 'Select a building block in your hotbar' };
  if (!hit) return { ok: false, reason: 'Aim at a nearby block' };
  const { x, y, z } = hit.adjacent;
  if (!world.inside(x, y, z) || y >= HEIGHT || y <= 0) return { ok: false, reason: 'The edge of your little world' };
  if (![B.AIR, B.WATER].includes(world.get(x, y, z))) return { ok: false, reason: 'That space is occupied' };
  if (blockOverlapsPlayer(x, y, z, player)) return { ok: false, reason: 'Step back to place this block' };
  if (def.block === B.TORCH && !world.get(x, y - 1, z)) return { ok: false, reason: 'Torches need a block underneath' };
  world.set(x, y, z, def.block);
  if (!creative) { item.count--; if (!item.count) inventory.slots[selected] = null; }
  return { ok: true, id: def.block, x, y, z };
}
