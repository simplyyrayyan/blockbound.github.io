import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import JSON5 from 'json5';
import { BLOCKS, ITEMS } from '../src/catalog.js';
import { MOB_LIST } from '../src/mob-catalog.js';

const root = new URL('../', import.meta.url);
const cache = new URL('artifacts/reference-cache/', root);
const output = new URL('public/assets/', root);
const samplesCommit = '736072450c26a7c67f07b1661f29d9a5ebaa14b1';
const samples = `https://raw.githubusercontent.com/Mojang/bedrock-samples/${samplesCommit}/resource_pack/`;
const assets = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/26.1/';
await mkdir(cache, { recursive: true }); await mkdir(output, { recursive: true });
const pending = new Map();
async function bytes(url) {
  if (pending.has(url)) return pending.get(url);
  const task = (async () => {
    const file = new URL(Buffer.from(url).toString('base64url').slice(-210), cache);
    try { return await readFile(file); } catch { /* Cache misses fetch their pinned source. */ }
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer()); await writeFile(file, data); return data;
  })();
  pending.set(url, task); return task;
}
async function json(url) { const data = await bytes(url); return data ? JSON5.parse(data.toString()) : null; }
async function pool(values, action, concurrency = 8) {
  const queue = [...values], workers = Array.from({ length: concurrency }, async () => { while (queue.length) await action(queue.shift()); });
  await Promise.all(workers);
}
function blit(source, dest, x, y, size = 16, tint = null) {
  for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
    const a = (Math.floor(yy / size * Math.min(source.width, source.height)) * source.width + Math.floor(xx / size * source.width)) * 4;
    const b = ((y + yy) * dest.width + x + xx) * 4;
    for (let c = 0; c < 4; c++) dest.data[b + c] = Math.round(source.data[a + c] * (tint && c < 3 ? tint[c] / 255 : 1));
  }
}
const models = await json(`${assets}blocks_models.json`), states = await json(`${assets}blocks_states.json`);
function resolveModel(id, seen = new Set()) {
  id = id?.replace(/^minecraft:block\//, ''); if (!id || seen.has(id)) return {};
  seen.add(id); const model = models[id] || {};
  const parent = resolveModel(model.parent, seen);
  return { ...parent, ...model, textures: { ...parent.textures, ...model.textures } };
}
function blockTextures(name) {
  let model = models[name] ? resolveModel(name) : null;
  if (!model) {
    const state = states[name], variants = Object.entries(state?.variants || {});
    const match = variants.find(([key]) => (!key.includes('open=') || key.includes('open=false')) && (!key.includes('half=') || key.includes('half=bottom') || key.includes('half=lower')) && (!key.includes('facing=') || key.includes('facing=north')) && (!key.includes('type=') || key.includes('type=bottom'))) || variants[0];
    let value = match?.[1] || state?.multipart?.[0]?.apply; if (Array.isArray(value)) value = value[0];
    model = resolveModel(value?.model);
  }
  const t = model?.textures || {};
  const texture = key => {
    let value = t[key] || t.all || t.texture || t.particle || name;
    if (typeof value !== 'string') value = value?.texture || value?.sprite || name;
    for (let i = 0; i < 10 && typeof value === 'string' && value.startsWith('#'); i++) value = t[value.slice(1)] || name;
    if (typeof value !== 'string') value = name;
    return value.replace(/^minecraft:block\//, '');
  };
  return [texture(t.top ? 'top' : t.end ? 'end' : t.up ? 'up' : 'all'), texture(t.front ? 'front' : t.side ? 'side' : t.north ? 'north' : 'all'), texture(t.bottom ? 'bottom' : t.end ? 'end' : t.down ? 'down' : 'all')];
}
const tiles = 2 ** Math.ceil(Math.log2(Math.ceil(Math.sqrt(BLOCKS.length * 3))));
const atlas = new PNG({ width: tiles * 16, height: tiles * 16 });
let blockCount = 0;
await pool(BLOCKS.slice(1), async block => {
  const name = block.reference || block.item;
  if (!name) return;
  const textures = blockTextures(name);
  for (let side = 0; side < 3; side++) {
    const texture = textures[side];
    const data = await bytes(`${assets}blocks/${texture}.png`) || await bytes(`${samples}textures/blocks/${texture}.png`);
    if (!data) continue;
    let source; try { source = PNG.sync.read(data); } catch { continue; }
    const tile = block.id * 3 + side;
    const tint = /(^grass_block_top$|leaves)/.test(texture) && !/cherry|azalea|pale/.test(texture) ? [116, 166, 72] : /water/.test(texture) ? [73, 130, 219] : null;
    blit(source, atlas, tile % tiles * 16, Math.floor(tile / tiles) * 16, 16, tint);
    if (side === 0) blockCount++;
  }
});
await writeFile(new URL('terrain.png', output), PNG.sync.write(atlas));
console.log(`Terrain textures: ${blockCount}/${BLOCKS.length - 1}`);

const itemTiles = 64, itemAtlas = new PNG({ width: 1024, height: 1024 }), itemMap = {};
let index = 0;
await pool(Object.entries(ITEMS).filter(([, d]) => !d.block && !d.spawn), async ([id, def]) => {
  const name = def.reference || id;
  const data = await bytes(`${assets}items/${name}.png`);
  if (!data) return;
  let source; try { source = PNG.sync.read(data); } catch { return; }
  const tile = index++; itemMap[id] = tile;
  blit(source, itemAtlas, tile % itemTiles * 16, Math.floor(tile / itemTiles) * 16);
});
await writeFile(new URL('items.png', output), PNG.sync.write(itemAtlas));
await writeFile(new URL('src/data/item-sprites.json', root), JSON.stringify(itemMap));
console.log(`Item sprites: ${index}`);

const tree = await json(`https://api.github.com/repos/Mojang/bedrock-samples/git/trees/${samplesCommit}?recursive=1`);
const geometries = new Map();
await pool(tree.tree.filter(f => f.path.startsWith('resource_pack/models/entity/') && f.path.endsWith('.json')), async file => {
  const data = await json(`https://raw.githubusercontent.com/Mojang/bedrock-samples/${samplesCommit}/${file.path}`);
  for (const [key, value] of Object.entries(data || {})) if (key.startsWith('geometry.') && value.bones) geometries.set(key.split(':')[0], { ...value, inherits: key.split(':').slice(1) });
  for (const g of data?.['minecraft:geometry'] || []) geometries.set(g.description.identifier, { ...g, texturewidth: g.description.texture_width, textureheight: g.description.texture_height });
});
const mobAssets = {};
function resolveGeometry(name, depth = 0) {
  const geometry = geometries.get(name); if (!geometry || depth > 8) return null;
  const bones = new Map(); let inherited = {};
  for (const parent of geometry.inherits || []) { const base = resolveGeometry(parent, depth + 1); if (base) { inherited = { ...inherited, ...base }; for (const b of base.bones) bones.set(b.name, b); } }
  for (const b of geometry.bones) bones.set(b.name, { ...bones.get(b.name), ...b });
  return { ...inherited, ...geometry, bones: [...bones.values()] };
}
const clients = { horse: 'horse_v3', donkey: 'donkey_v3', mule: 'mule_v3', skeleton_horse: 'skeleton_horse_v3', zombie_horse: 'zombie_horse_v3', villager: 'villager_v2', zombie_villager: 'zombie_villager_v2', trader_llama: 'llama', snow_golem: 'snow_golem', tropical_fish: 'tropicalfish', zombified_piglin: 'zombie_pigman' };
await mkdir(new URL('mobs/', output), { recursive: true });
await pool(MOB_LIST, async mob => {
  const data = await json(`${samples}entity/${clients[mob.id] || mob.id}.entity.json`);
  const d = data?.['minecraft:client_entity']?.description; if (!d) return;
  const geo = d.geometry?.default || Object.values(d.geometry || {})[0];
  const geometry = resolveGeometry(geo); if (!geometry) return;
  const skin = d.textures?.default || Object.values(d.textures || {})[0];
  const texture = skin && await bytes(`${samples}${skin}.png`); if (!texture) return;
  try { PNG.sync.read(texture); } catch { return; }
  await writeFile(new URL(`mobs/${mob.id}.png`, output), texture);
  mobAssets[mob.id] = { width: geometry.texturewidth || 64, height: geometry.textureheight || 32, bones: geometry.bones };
});
await writeFile(new URL('src/data/mob-assets.json', root), JSON.stringify(mobAssets));
await writeFile(new URL('NOTICE.txt', output), 'Minecraft reference artwork and sample models: Copyright Mojang AB. All rights reserved.\nSource: https://github.com/PrismarineJS/minecraft-assets (26.1), https://github.com/Mojang/bedrock-samples (' + samplesCommit + ').\nThese assets are subject to the Minecraft EULA: https://www.minecraft.net/en-us/eula\nBlockbound is an unofficial, non-affiliated fan project. The artwork is not covered by the minecraft-data MIT license.\n');
console.log(`Reference mob models: ${Object.keys(mobAssets).length}/${MOB_LIST.length}`);
