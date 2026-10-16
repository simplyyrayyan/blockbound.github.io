import { B, BLOCKS, isTransparent } from './catalog.js';
import { CHUNK, SIZE } from './world.js';
import { blockBoxes } from './block-shapes.js';

export const ATLAS_TILES = 2 ** Math.ceil(Math.log2(Math.ceil(Math.sqrt(BLOCKS.length * 3))));
const faces = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: .86 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: .76 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: .56 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: .92 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: .8 },
];

export function buildChunkMesh(world, cx, cz) {
  const buffers = Array.from({ length: 4 }, () => ({ positions: [], normals: [], uvs: [], colors: [], indices: [] })), lights = [];
  const x0 = cx * CHUNK, z0 = cz * CHUNK, height = world.height;
  // A padded dense view turns all face-neighbor tests into cheap array reads.
  const stride = CHUNK + 2, plane = stride * stride, voxels = new Uint16Array(plane * height);
  // Inner columns are read straight from the backing typed arrays: routing all
  // ~30k voxels through world.get rebuilds chunk-key strings and re-runs
  // ensureChunk for every single one. The 1-block perimeter keeps world.get so
  // neighbouring chunks still generate and edits still apply.
  const inCore = cx >= 0 && cz >= 0 && cx < SIZE / CHUNK && cz < SIZE / CHUNK;
  const SS = SIZE * SIZE;
  const far = inCore ? null : (world.terrainChunks.get(`${cx},${cz}`) || null);
  const edits = inCore ? world.edits : world.farEdits;
  const hasEdits = edits.size > 0;
  const hasStates = (inCore ? world.states : world.farStates).size > 0 || world.baseStates.size > 0;
  for (let x = -1; x <= CHUNK; x++) for (let z = -1; z <= CHUNK; z++) {
    const wx = x0 + x, wz = z0 + z;
    const inner = x >= 0 && x < CHUNK && z >= 0 && z < CHUNK;
    const colBlocks = inner ? (inCore ? world.blocks : far) : null;
    const colBase = inCore ? wz * SIZE + wx : z * CHUNK + x;
    const colStride = inCore ? SS : CHUNK * CHUNK;
    for (let y = 0; y < height; y++) {
      let id;
      if (colBlocks) {
        const idx = y * colStride + colBase, raw = colBlocks[idx];
        id = hasEdits ? (inCore ? edits.get(idx) ?? raw : edits.get(`${wx},${y},${wz}`) ?? raw) : raw;
      } else id = world.get(wx, y, wz);
      voxels[y * plane + (z + 1) * stride + x + 1] = id;
    }
  }
  const at = (x, y, z) => y < 0 || y >= height ? B.AIR : voxels[y * plane + (z + 1) * stride + x + 1];
  const EMPTY_STATE = {};
  for (let x = 0; x < CHUNK; x++) for (let z = 0; z < CHUNK; z++) for (let y = 0; y < height; y++) {
    const actual = at(x, y, z); if (!actual) continue;
    const wx = x0 + x, wz = z0 + z, state = hasStates ? world.stateAt(wx, y, wz) : EMPTY_STATE, actualDef = BLOCKS[actual];
    if (actualDef.shape === 'torch') lights.push({ x: wx, y, z: wz });
    for (const id of state.waterlogged && actual !== B.WATER ? [actual, B.WATER] : [actual]) {
      const def = BLOCKS[id], fluid = id === B.WATER || id === B.LAVA;
      const lit = def.light > 0 && (!/copper_bulb|redstone_lamp/.test(def.reference || '') || state.lit);
      const buf = buffers[id === B.WATER ? 1 : /glass|ice/.test(def.reference || '') ? 2 : lit ? 3 : 0];
      const boxes = blockBoxes(id, state);
      for (const box of boxes) for (let f = 0; f < 6; f++) {
        const face = faces[f], [nx, ny, nz] = face.n, neighbor = at(x + nx, y + ny, z + nz);
        const cube = !def.shape || def.shape === 'cube';
        if (cube && (!isTransparent(neighbor) || neighbor === id && (fluid || /glass|leaves|ice/.test(def.reference || '')))) continue;
        if (def.shape === 'torch' && f === 3 && !state.wall) continue;
        const tile = id * 3 + (f === 2 ? 0 : f === 3 ? 2 : 1), torch = def.shape === 'torch';
        const u0 = (tile % ATLAS_TILES + (torch ? 7 / 16 : .001)) / ATLAS_TILES, u1 = (tile % ATLAS_TILES + (torch ? 9 / 16 : .999)) / ATLAS_TILES;
        const v0 = 1 - (Math.floor(tile / ATLAS_TILES) + .999) / ATLAS_TILES, v1 = 1 - (Math.floor(tile / ATLAS_TILES) + (torch ? .375 : .001)) / ATLAS_TILES;
        const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], start = buf.positions.length / 3;
        const fluidTop = id === B.WATER ? world.waterHeight(wx, y, wz) : id === B.LAVA ? world.get(wx, y + 1, wz) === B.LAVA ? 1 : (8 - (state.fluidLevel || 0)) / 9 : 1;
        for (let vi = 0; vi < 4; vi++) {
          const v = face.v[vi], vx = box[0] + v[0] * (box[3] - box[0]), vz = box[2] + v[2] * (box[5] - box[2]);
          let vy = box[1] + v[1] * (box[4] - box[1]); if (fluid && vy === 1) vy = fluidTop;
          buf.positions.push(wx + vx, y + vy, wz + vz); buf.normals.push(nx, ny, nz); buf.uvs.push(...uv[vi]);
          const depth = Math.max(.72, Math.min(1, .64 + y / Math.max(24, world.seaLevel))), shade = face.shade * (lit ? 1 : depth);
          if (def.shape === 'wire' && state.power) buf.colors.push(1, .2, .13); else buf.colors.push(shade, shade, shade);
        }
        buf.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
  }
  return { buffers: buffers.map(b => ({ positions: new Float32Array(b.positions), normals: new Float32Array(b.normals), uvs: new Float32Array(b.uvs), colors: new Float32Array(b.colors), indices: new Uint32Array(b.indices) })), lights };
}
