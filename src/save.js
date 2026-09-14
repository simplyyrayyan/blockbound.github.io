import { Inventory } from './inventory.js';
import { SIZE, HEIGHT } from './world.js';
import { ITEMS, BLOCKS } from './catalog.js';

export const SAVE_PREFIX = 'blockbound.world.v1.';
export function encodeSave(state) {
  return JSON.stringify({ version: 3, worldVersion: state.world.version, dimension: state.world.dimension || 'overworld', dimensions: state.dimensions || {}, blockStates: [...state.world.states], systems: state.systems?.serialize(), enderStorage: state.enderStorage, spawnPoint: state.spawnPoint, deathPoint: state.deathPoint, craftingSlots: state.craftingSlots || Array(4).fill(null), id: state.id, seed: state.world.seed, mode: state.mode, player: { x: state.player.x, y: state.player.y, z: state.player.z, yaw: state.player.yaw, pitch: state.player.pitch }, inventory: state.inventory.slots, equipment: state.equipment || {}, effects: state.effects || {}, entities: state.mobs?.serialize(), selected: state.selected, health: state.health, food: state.food, xp: state.xp, elapsed: state.elapsed, progress: state.progress, edits: [...state.world.edits], savedAt: Date.now() });
}
export function decodeSave(text) {
  const s = JSON.parse(text);
  if (![1, 2, 3].includes(s.version) || typeof s.id !== 'string' || typeof s.seed !== 'string' || s.seed.length > 36 || !['survival', 'creative'].includes(s.mode) || !Inventory.validate(s.inventory)) throw new Error('This save is not compatible');
  if (!s.player || !['x', 'y', 'z', 'yaw', 'pitch'].every(k => Number.isFinite(s.player[k])) || s.player.x < 0 || s.player.x >= SIZE || s.player.z < 0 || s.player.z >= SIZE || s.player.y < 0 || s.player.y > HEIGHT + 30) throw new Error('This save has an invalid position');
  if (!Number.isInteger(s.selected) || s.selected < 0 || s.selected > 8 || ![s.health, s.food, s.xp, s.elapsed].every(Number.isFinite) || s.health < 0 || s.health > 20 || s.food < 0 || s.food > 20 || s.xp < 0 || s.elapsed < 0) throw new Error('This save has invalid player data');
  if (!Array.isArray(s.edits)) throw new Error('This save has invalid blocks');
  s.progress = s.progress && typeof s.progress === 'object' ? s.progress : {};
  if (s.craftingSlots !== undefined && (!Array.isArray(s.craftingSlots) || s.craftingSlots.length !== 4 || !Inventory.validate([...s.craftingSlots, ...Array(32).fill(null)]))) throw new Error('Invalid crafting slots');
  s.worldVersion = s.version === 1 ? 1 : s.worldVersion || 2;
  if (![1, 2, 3].includes(s.worldVersion)) throw new Error('Unsupported terrain version');
  s.dimension ||= 'overworld';
  if (!['overworld', 'nether', 'end'].includes(s.dimension)) throw new Error('Invalid dimension');
  validateLevel(s);
  s.dimensions ||= {};
  for (const [name, level] of Object.entries(s.dimensions)) { if (!['overworld', 'nether', 'end'].includes(name)) throw new Error('Invalid dimension'); validateLevel(level); }
  if (s.enderStorage && (!Array.isArray(s.enderStorage) || s.enderStorage.length !== 27 || !Inventory.validate([...s.enderStorage, ...Array(9).fill(null)]))) throw new Error('Invalid ender storage');
  const equipment = {};
  for (const slot of ['helmet', 'chestplate', 'leggings', 'boots', 'offhand']) {
    const item = s.equipment?.[slot];
    if (item && (ITEMS[item.id]?.armorSlot !== slot || !Inventory.validate([item, ...Array(35).fill(null)]))) throw new Error('Invalid saved equipment');
    equipment[slot] = item || null;
  }
  s.equipment = equipment;
  s.effects = Object.fromEntries(['fire', 'poison', 'wither', 'hunger', 'slowness', 'levitation', 'regeneration', 'speed', 'strength', 'fire_resistance', 'water_breathing', 'slow_falling', 'fatigue', 'jump_boost', 'night_vision', 'invisibility', 'weakness', 'resistance', 'infestation', 'oozing', 'weaving', 'wind_charging', 'nausea', 'absorption', 'glowing'].filter(key => Number.isFinite(s.effects?.[key]) && s.effects[key] > 0).map(key => [key, Math.min(600, s.effects[key])]));
  if (s.entities && (!Array.isArray(s.entities.mobs) || s.entities.mobs.length > 64)) throw new Error('Invalid saved mobs');
  return s;
}

function validateLevel(level) {
  if (!level || !Array.isArray(level.edits) || level.edits.length > SIZE * SIZE * HEIGHT) throw new Error('Invalid dimension blocks');
  for (const pair of level.edits) if (!Array.isArray(pair) || !Number.isInteger(pair[0]) || pair[0] < SIZE * SIZE || pair[0] >= SIZE * SIZE * HEIGHT || !Number.isInteger(pair[1]) || !BLOCKS[pair[1]]) throw new Error('Invalid block edit');
  level.blockStates ||= [];
  if (!Array.isArray(level.blockStates) || level.blockStates.length > SIZE * SIZE * HEIGHT) throw new Error('Invalid block states');
  for (const pair of level.blockStates) if (!Array.isArray(pair) || !Number.isInteger(pair[0]) || pair[0] < SIZE * SIZE || pair[0] >= SIZE * SIZE * HEIGHT || !pair[1] || typeof pair[1] !== 'object' || Array.isArray(pair[1])) throw new Error('Invalid block state');
}
