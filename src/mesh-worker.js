import { World } from './world.js';
import { buildChunkMesh } from './chunk-mesh.js';

let world, epoch;
self.onmessage = ({ data }) => {
  try {
    if (data.type === 'world') {
      epoch = data.epoch; world = new World(data.seed, data.version, data.dimension, { streaming: true });
      if (data.version < 4) world.generate();
      world.edits = new Map(data.edits); world.states = new Map(data.states);
      world.farEdits = new Map(data.farEdits); world.farStates = new Map(data.farStates);
      return;
    }
    if (!world || data.epoch !== epoch) return;
    for (const [key, change] of data.changes || []) {
      const p = world.position(key), core = world.core(p.x, p.y, p.z);
      if (change.id !== undefined) { (core ? world.edits : world.farEdits).set(key, change.id); (core ? world.states : world.farStates).delete(key); world.baseStates.delete(key); }
      if (change.state) (core ? world.states : world.farStates).set(key, change.state);
    }
    const start = performance.now(), mesh = buildChunkMesh(world, data.cx, data.cz);
    const blocks = new Uint16Array(16 * 16 * world.height);
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) for (let y = 0; y < world.height; y++) blocks[(y * 16 + z) * 16 + x] = world.get(data.cx * 16 + x, y, data.cz * 16 + z);
    const inChunk = key => { const p = world.position(key); return Math.floor(p.x / 16) === data.cx && Math.floor(p.z / 16) === data.cz; };
    const baseStates = [...world.baseStates].filter(([key]) => inChunk(key));
    const structures = world.structures.filter(s => Math.abs(s.x - data.cx * 16) < 36 && Math.abs(s.z - data.cz * 16) < 36);
    const transfer = [blocks.buffer, ...mesh.buffers.flatMap(b => Object.values(b).map(a => a.buffer))];
    self.postMessage({ ...mesh, blocks, baseStates, structures, epoch, key: data.key, ticket: data.ticket, duration: performance.now() - start }, transfer);
  } catch (error) { self.postMessage({ epoch, key: data.key, error: error.message }); }
};
