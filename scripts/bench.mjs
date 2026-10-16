import { World } from '../src/world.js';
import { buildChunkMesh } from '../src/chunk-mesh.js';

function t(label, fn) { const s = performance.now(); const r = fn(); console.log(label.padEnd(50), (performance.now() - s).toFixed(0).padStart(6), 'ms'); return r; }

t('v5 generate() (new world)', () => new World('777', 5).generate());
t('v5 generate() again (warm cache)', () => new World('777', 5).generate());

const w = new World('777', 5);
t('ensureChunk x16 (far chunks)', () => { for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) w.ensureChunk(x, z); });
t('buildChunkMesh x16', () => { for (let x = -4; x < 4; x++) for (let z = -4; z < 4; z++) buildChunkMesh(w, x, z); });

// Per-phase timing of generation
const w2 = new World('777', 5);
t('  generate(): chunks 2..5', () => { for (let cx = 2; cx < 5; cx++) for (let cz = 2; cz < 5; cz++) w2.ensureChunk(cx, cz); });
t('  chooseSpawn()', () => w2.chooseSpawn());

// ore census
const c = new World('777', 5).generate();
const counts = {};
for (const key of c.generatedChunks) {
  const [cx, cz] = key.split(',').map(Number);
  for (let x = cx*16; x < cx*16+16; x++) for (let z = cz*16; z < cz*16+16; z++) for (let y = 0; y < 128; y++) {
    const id = c.get(x,y,z);
    if (id >= 8 && id <= 11) counts[id] = (counts[id]||0)+1;
  }
}
console.log('\nore block counts in', c.generatedChunks.size, 'chunks: coal/iron/gold/diamond =', [8,9,10,11].map(i => counts[i]||0).join('/'));
