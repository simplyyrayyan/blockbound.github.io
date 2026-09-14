import { Inventory } from './inventory.js';
import { SIZE, HEIGHT } from './world.js';

export const SAVE_PREFIX = 'blockbound.world.v1.';
export function encodeSave(state) {
  return JSON.stringify({ version: 1, id: state.id, seed: state.world.seed, mode: state.mode, player: { x: state.player.x, y: state.player.y, z: state.player.z, yaw: state.player.yaw, pitch: state.player.pitch }, inventory: state.inventory.slots, selected: state.selected, health: state.health, food: state.food, xp: state.xp, elapsed: state.elapsed, progress: state.progress, edits: [...state.world.edits], savedAt: Date.now() });
}
export function decodeSave(text) {
  const s = JSON.parse(text);
  if (s.version !== 1 || typeof s.id !== 'string' || typeof s.seed !== 'string' || s.seed.length > 36 || !['survival', 'creative'].includes(s.mode) || !Inventory.validate(s.inventory)) throw new Error('This save is not compatible');
  if (!s.player || !['x', 'y', 'z', 'yaw', 'pitch'].every(k => Number.isFinite(s.player[k])) || s.player.x < 0 || s.player.x >= SIZE || s.player.z < 0 || s.player.z >= SIZE || s.player.y < 0 || s.player.y > HEIGHT + 30) throw new Error('This save has an invalid position');
  if (!Number.isInteger(s.selected) || s.selected < 0 || s.selected > 8 || ![s.health, s.food, s.xp, s.elapsed].every(Number.isFinite) || s.health < 0 || s.health > 20 || s.food < 0 || s.food > 20 || s.xp < 0 || s.elapsed < 0) throw new Error('This save has invalid player data');
  if (!Array.isArray(s.edits)) throw new Error('This save has invalid blocks');
  s.progress = s.progress && typeof s.progress === 'object' ? s.progress : {};
  return s;
}
