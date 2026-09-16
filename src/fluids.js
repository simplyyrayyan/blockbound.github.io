import { B, BLOCKS, isSolid } from './catalog.js';

const sides = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const aquatic = id => id === B.WATER || /^(seagrass|tall_seagrass|kelp|kelp_plant)$/.test(BLOCKS[id]?.reference || '');
export function waterHeight(world, x, y, z) {
  const id = world.get(x, y, z), state = world.stateAt(x, y, z);
  if (!aquatic(id) && !state.waterlogged) return 0;
  if (aquatic(world.get(x, y + 1, z)) || state.falling) return 1;
  return (8 - (state.fluidLevel || 0)) / 9;
}
export function bubbleColumn(world, x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (!waterHeight(world, x, y, z)) return 0;
  while (y > 0 && waterHeight(world, x, y, z) && !(world.stateAt(x, y, z).fluidLevel > 0)) y--;
  const floor = world.get(x, y, z);
  return floor === B.SOUL_SAND ? 1 : floor === B.MAGMA_BLOCK ? -1 : 0;
}
export function waterCurrent(world, x, y, z) {
  x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
  if (!waterHeight(world, x, y, z)) return { x: 0, z: 0 };
  const level = world.stateAt(x, y, z).fluidLevel || 0;
  let vx = 0, vz = 0;
  for (const [dx, dz] of sides) {
    const h = waterHeight(world, x + dx, y, z + dz), difference = h ? (world.stateAt(x + dx, y, z + dz).fluidLevel || 0) - level : world.get(x + dx, y, z + dz) === B.AIR ? 1 : 0;
    vx += dx * difference; vz += dz * difference;
  }
  const length = Math.hypot(vx, vz);
  return length ? { x: vx / length, z: vz / length } : { x: 0, z: 0 };
}
export function tickFluids(world, budget = 96, player = null) {
  // Snapshot the work list. A flow advances at most one cell per fluid tick.
  const pending = [];
  for (const key of world.fluidQueue) { pending.push(key); if (pending.length >= budget) break; }
  for (const key of pending) world.fluidQueue.delete(key);
  for (const key of pending) {
    const [x, y, z] = key.split(',').map(Number);
    if (!world.inside(x, y, z) || y <= 0) continue;
    if (player && Math.hypot(x - player.x, z - player.z) > 96) { world.fluidQueue.add(key); continue; }
    const id = world.get(x, y, z), state = world.stateAt(x, y, z);
    if (id === B.LAVA) {
      if (sides.some(([dx, dz]) => waterHeight(world, x + dx, y, z + dz)) || waterHeight(world, x, y + 1, z)) { world.set(x, y, z, state.fluidLevel ? B.COBBLESTONE : B.OBSIDIAN); continue; }
      if ((world.fluidTick || 0) % (world.dimension === 'nether' ? 2 : 4)) { world.fluidQueue.add(key); continue; }
      const below = world.get(x, y - 1, z), increment = world.dimension === 'nether' ? 1 : 2;
      if (y > 1 && below === B.AIR) { world.set(x, y - 1, z, B.LAVA); world.setState(x, y - 1, z, { fluidLevel: 1, falling: true }); }
      else if (isSolid(below) || below === B.LAVA) for (const [dx, dz] of sides) {
        const level = (state.fluidLevel || 0) + increment, neighbor = world.get(x + dx, y, z + dz);
        if (level < 8 && neighbor === B.AIR) { world.set(x + dx, y, z + dz, B.LAVA); world.setState(x + dx, y, z + dz, { fluidLevel: level }); }
      }
      if (state.fluidLevel > 0) {
        const above = world.get(x, y + 1, z) === B.LAVA;
        const fed = above || sides.some(([dx, dz]) => world.get(x + dx, y, z + dz) === B.LAVA && (world.stateAt(x + dx, y, z + dz).fluidLevel || 0) < state.fluidLevel);
        if (!fed) world.set(x, y, z, B.AIR);
      }
      continue;
    }
    if (id !== B.AIR && !aquatic(id) && !['plant', 'torch'].includes(BLOCKS[id]?.shape) && id !== B.TORCH && !state.waterlogged) continue;
    if (world.dimension === 'nether') { if (id === B.WATER) world.set(x, y, z, B.AIR); continue; }
    if ((aquatic(id) || state.waterlogged) && !state.fluidLevel && !state.falling) {
      // Source blocks remain sources. Only wake adjacent cells that can change.
      for (const [dx, dy, dz] of [[0, -1, 0], ...sides.map(([a, b]) => [a, 0, b])]) {
        const next = world.get(x + dx, y + dy, z + dz);
        if (world.inside(x + dx, y + dy, z + dz) && y + dy > 0 && (next === B.AIR || next === B.LAVA || world.stateAt(x + dx, y + dy, z + dz).fluidLevel > 0 || ['plant', 'torch'].includes(BLOCKS[next]?.shape) && !aquatic(next))) world.fluidQueue.add(world.key(x + dx, y + dy, z + dz));
      }
      continue;
    }
    let level = 8, falling = false, sources = 0;
    if (waterHeight(world, x, y + 1, z)) { level = 1; falling = true; }
    for (const [dx, dz] of sides) {
      if (!waterHeight(world, x + dx, y, z + dz)) continue;
      const neighbor = world.stateAt(x + dx, y, z + dz);
      if (!neighbor.fluidLevel && !neighbor.falling) sources++;
      const below = world.get(x + dx, y - 1, z + dz);
      if (isSolid(below) || aquatic(below)) level = Math.min(level, (neighbor.fluidLevel || 0) + 1);
    }
    const below = world.get(x, y - 1, z);
    if (sources >= 2 && (isSolid(below) || aquatic(below) && !world.stateAt(x, y - 1, z).fluidLevel)) { level = 0; falling = false; }
    if (level >= 8) { if (id === B.WATER) world.set(x, y, z, B.AIR); continue; }
    if (id !== B.WATER || state.fluidLevel !== level || !!state.falling !== falling) {
      world.set(x, y, z, B.WATER);
      world.setState(x, y, z, { fluidLevel: level, falling });
    }
  }
  return pending.length;
}
