import { B, BLOCKS, ITEMS, isSolid } from './catalog.js';
import { blockOverlapsPlayer, HEIGHT } from './world.js';
import { Inventory } from './inventory.js';
import { enchantLevel, wearItem } from './enchanting.js';

export function miningInfo(id, item, creative = false) {
  const block = BLOCKS[id], tool = ITEMS[item?.id];
  if (!block || !id || id === B.WATER || id === B.LAVA) return { ok: false, reason: 'Nothing to mine' };
  if (id === B.BEDROCK) return { ok: false, reason: 'Bedrock is unbreakable' };
  if (creative) return { ok: true, time: .12 };
  if (block.tier && (tool?.tool !== 'pick' || tool.tier < block.tier)) {
    const tier = ['', 'wooden', 'stone', 'iron', 'diamond'][block.tier];
    return { ok: false, reason: `Needs a ${tier} pickaxe` };
  }
  const speed = tool?.tool === block.tool ? (tool.speed || 1) + enchantLevel(item, 'efficiency') ** 2 : 1;
  return { ok: true, time: block.time / speed };
}

export function mineBlock(world, inventory, hit, selected, creative = false) {
  const id = world.get(hit.x, hit.y, hit.z);
  if (id !== hit.id) return { ok: false, reason: 'Block changed' };
  const check = miningInfo(id, inventory.slots[selected], creative);
  if (!check.ok) return check;
  const block = BLOCKS[id];
  const trial = new Inventory(inventory.slots);
  const held = inventory.slots[selected], silk = enchantLevel(held, 'silk_touch');
  const drop = silk && ITEMS[block.item]?.block ? block.item : block.drop;
  const amount = !silk && block.reference?.includes('ore') && !ITEMS[drop]?.block ? 1 + Math.floor(Math.random() * (enchantLevel(held, 'fortune') + 1)) : 1;
  if (!creative && drop && trial.add(drop, amount)) return { ok: false, reason: 'Your backpack is full' };
  const partner = world.stateAt(hit.x, hit.y, hit.z).partner;
  if (!world.set(hit.x, hit.y, hit.z, B.AIR)) return { ok: false, reason: 'Cannot break this block' };
  if (partner && world.get(partner.x, partner.y, partner.z) === id) world.set(partner.x, partner.y, partner.z, B.AIR);
  let brokeTool = false;
  if (!creative) {
    const item = trial.slots[selected];
    if (item?.durability && wearItem(item)) { trial.slots[selected] = null; brokeTool = true; }
    inventory.slots = trial.slots;
  }
  return { ok: true, drop, xp: silk ? 0 : block.xp || 1, brokeTool };
}

export function placeBlock(world, inventory, selected, hit, player, creative = false) {
  const item = inventory.slots[selected], def = ITEMS[item?.id];
  if (!def?.block) return { ok: false, reason: 'Select a building block in your hotbar' };
  if (!hit) return { ok: false, reason: 'Aim at a nearby block' };
  const { x, y, z } = hit.adjacent;
  if (!world.inside(x, y, z) || y >= HEIGHT || y <= 0) return { ok: false, reason: 'Outside the build limit' };
  const current = world.get(x, y, z), block = BLOCKS[def.block], shape = block.shape;
  if (shape === 'slab' && hit.id === def.block && !world.stateAt(hit.x, hit.y, hit.z).double) {
    world.setState(hit.x, hit.y, hit.z, { double: true });
    if (!creative && --item.count === 0) inventory.slots[selected] = null;
    return { ok: true, id: def.block, x: hit.x, y: hit.y, z: hit.z };
  }
  if (![B.AIR, B.WATER].includes(current) && BLOCKS[current]?.shape !== 'plant') return { ok: false, reason: 'That space is occupied' };
  if (blockOverlapsPlayer(x, y, z, player)) return { ok: false, reason: 'Step back to place this block' };
  const torch = BLOCKS[def.block].shape === 'torch';
  if (torch && (!isSolid(hit.id) || hit.normal.y < 0 || world.waterHeight(x, y, z))) return { ok: false, reason: 'Torches need a dry floor or wall' };
  const facing = ((Math.round(-player.yaw / (Math.PI / 2)) % 4) + 4) % 4 || 0;
  const bedDir = [[0, -1], [1, 0], [0, 1], [-1, 0]][facing];
  const partner = shape === 'door' ? { x, y: y + 1, z } : shape === 'bed' ? { x: x + bedDir[0], y, z: z + bedDir[1] } : null;
  if (partner && (!world.inside(partner.x, partner.y, partner.z) || ![B.AIR, B.WATER].includes(world.get(partner.x, partner.y, partner.z)) || blockOverlapsPlayer(partner.x, partner.y, partner.z, player))) return { ok: false, reason: 'Not enough room' };
  if (!world.set(x, y, z, def.block)) return { ok: false, reason: 'Cannot place this block' };
  if (torch && hit.normal.y === 0) world.setState(x, y, z, { wall: true, facing: hit.normal.x > 0 ? 1 : hit.normal.x < 0 ? 3 : hit.normal.z > 0 ? 2 : 0 });
  if (!torch && shape !== 'cube') world.setState(x, y, z, { facing, ...(current === B.WATER && ['slab', 'stairs', 'fence', 'wall', 'pane', 'trapdoor'].includes(shape) ? { waterlogged: true } : {}) });
  if (partner) { world.set(partner.x, partner.y, partner.z, def.block); world.setState(partner.x, partner.y, partner.z, { facing, upper: shape === 'door', head: shape === 'bed', partner: { x, y, z } }); world.setState(x, y, z, { partner }); }
  if (!creative) { item.count--; if (!item.count) inventory.slots[selected] = null; }
  return { ok: true, id: def.block, x, y, z };
}
