import * as THREE from 'three';
import '@fontsource-variable/space-grotesk';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import { B, BLOCKS, ITEMS, RECIPES } from './src/catalog.js';
import { World, SIZE, HEIGHT, clamp, raycast, collides } from './src/world.js';
import { Inventory } from './src/inventory.js';
import { miningInfo, mineBlock, placeBlock } from './src/rules.js';
import { VoxelRenderer } from './src/render.js';
import { SAVE_PREFIX, encodeSave, decodeSave } from './src/save.js';

const $ = selector => document.querySelector(selector);
const canvas = $('#game-canvas');
let view;
try { view = new VoxelRenderer(canvas); }
catch (error) { $('#webgl-error').classList.remove('hidden'); $('#play-btn').disabled = true; throw error; }
let state = null, overlay = 'home', helpReturn = 'home', selectedMode = 'survival';
let selectedRecipe = 0, carriedSlot = null, target = null, mining = null, mineHeld = false;
let lastTime = 0, uiTimer = 0, saveTimer = 0, soundEnabled = true, swing = 0, footstepTime = 0;
let toastTimer = 0, lastWarning = '', warningTime = 0, pointerDrag = null;
const keys = new Set(), direction = new THREE.Vector3();
const touch = matchMedia('(pointer: coarse)').matches;
const iconCache = new Map();
let audio;

function tone(kind) {
  if (!soundEnabled) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const now = audio.currentTime, gain = audio.createGain(); gain.connect(audio.destination);
    if (kind === 'mine' || kind === 'step' || kind === 'place') {
      const length = kind === 'step' ? .06 : .11, buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * length), audio.sampleRate);
      const data = buffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      const source = audio.createBufferSource(); source.buffer = buffer;
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = kind === 'step' ? 450 : 1500;
      source.connect(filter); filter.connect(gain); gain.gain.value = kind === 'step' ? .08 : .15; source.start();
    } else {
      const osc = audio.createOscillator(); osc.type = 'sine'; osc.connect(gain);
      osc.frequency.setValueAtTime(kind === 'craft' ? 660 : kind === 'hurt' ? 120 : 420, now); osc.frequency.exponentialRampToValueAtTime(kind === 'craft' ? 990 : 220, now + .15);
      gain.gain.setValueAtTime(.06, now); gain.gain.exponentialRampToValueAtTime(.001, now + .2); osc.start(now); osc.stop(now + .2);
    }
  } catch { /* Audio is optional; the world remains playable without it. */ }
}

function toast(message) {
  $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2900);
}
function warn(message) {
  const now = performance.now(); if (message === lastWarning && now - warningTime < 1600) return;
  warningTime = now; lastWarning = message; toast(message);
}

function icon(id) {
  if (iconCache.has(id)) return iconCache.get(id);
  const def = ITEMS[id]; if (!def) return '';
  const c = def.color, light = new THREE.Color(c).offsetHSL(0, 0, .12).getStyle(), dark = new THREE.Color(c).offsetHSL(0, 0, -.17).getStyle();
  let drawing;
  if (def.tool) {
    drawing = '<path d="M10 31h5v-5h5v-5h5v-5h-5v5h-5v5h-5z" fill="#765239"/><path d="M12 29h3v-4h4v-4h3v-3h-4v5h-4z" fill="#bc905c"/>';
    drawing += def.tool === 'pick' ? `<path d="M8 10V6h15v4h5v5h5v10h-5v-7h-5v-5h-8v-3z" fill="${dark}"/><path d="M8 6h16v4h5v5h4v5h-5v-5h-5v-5H8z" fill="${c}"/><path d="M9 6h14v2H9z" fill="${light}"/>` : def.tool === 'axe' ? `<path d="M10 7h12v5h6v10H16v-5h-6z" fill="${c}"/><path d="M10 7h12v3H10z" fill="${light}"/>` : `<path d="M19 5h10v5h5v9h-5v5H19v-5h-5v-9h5z" fill="${c}"/><path d="M19 7h10v3H19z" fill="${light}"/>`;
  } else if (def.shape === 'stick') drawing = '<path d="M9 30h5v-5h5v-5h5v-5h5V7h-5v5h-5v5h-5v5H9z" fill="#775239"/><path d="M12 28h3v-5h5v-5h5v-5h3V8h-3v5h-5v5h-5v5h-3z" fill="#bd915e"/>';
  else if (def.shape === 'apple') drawing = '<path d="M18 5h4v8h-4z" fill="#745538"/><path d="M22 6h8v4h-8z" fill="#749a4c"/><path d="M8 14h5v-3h6v3h4v-3h6v3h4v14h-5v5H13v-5H8z" fill="#ce6549"/><path d="M11 16h5v7h-5z" fill="#f39e79"/><path d="M29 18h4v10h-5v5H16v-3h13z" fill="#b44f3f"/>';
  else if (def.shape === 'gem') drawing = `<path d="M12 8h17l7 11-14 17L5 20z" fill="${dark}"/><path d="M12 8h17l-6 11H5z" fill="${light}"/><path d="M23 19h13L22 36z" fill="${c}"/>`;
  else if (def.shape === 'ingot') drawing = `<path d="m7 19 7-10h19l4 10-8 10H7z" fill="${dark}"/><path d="m7 19 7-10h19l-7 10z" fill="${light}"/><path d="M7 19h19v10H7z" fill="${c}"/>`;
  else if (id === 'torch') drawing = '<path d="M18 17h6v20h-6z" fill="#856340"/><path d="M15 6h12v13H15z" fill="#eaa44f"/><path d="M18 4h6v11h-6z" fill="#fff0a3"/>';
  else {
    drawing = `<path d="m20 3 16 9-16 9L4 12z" fill="${light}"/><path d="M4 12l16 9v18L4 30z" fill="${c}"/><path d="m20 21 16-9v18l-16 9z" fill="${dark}"/>`;
    if (id === 'grass') drawing += '<path d="M4 17l16 9v13L4 30z" fill="#9b714e"/><path d="m20 26 16-9v13l-16 9z" fill="#775135"/>';
    if (id === 'log' || id === 'planks' || id === 'table' || id === 'brick') drawing += `<path d="m8 15 0 15m6-12v16m10-14v14m7-18v14M4 22l16 9 16-9" fill="none" stroke="${dark}" stroke-width="1.5" opacity=".5"/>`;
    if (id === 'table') drawing += '<path d="m12 7 16 10m-8-14v18M4 12l16 9 16-9" stroke="#745133" stroke-width="1.5" fill="none"/>';
    if (id === 'glass') drawing += '<path d="m9 20 7 4m-7 0 4 2m11 4 8-4" fill="none" stroke="#e6f6f0" stroke-width="2"/>';
  }
  const svg = `<svg class="item-icon" viewBox="0 0 40 42" aria-hidden="true" shape-rendering="crispEdges">${drawing}</svg>`;
  iconCache.set(id, svg); return svg;
}

function slotContents(item, index, hotbar = false) {
  const number = hotbar || index < 9 ? `<span class="slot-number">${index + 1}</span>` : '';
  if (!item) return number;
  const durability = item.durability ? `<span class="durability"><i style="width:${item.durability / ITEMS[item.id].durability * 100}%"></i></span>` : '';
  return number + icon(item.id) + `<span class="slot-count">${state.mode === 'creative' && ITEMS[item.id].block ? '∞' : item.count > 1 ? item.count : ''}</span>` + durability;
}
function renderHotbar() {
  if (!state) return;
  $('#hotbar').innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const item = state.inventory.slots[i], button = document.createElement('button');
    button.className = `hot-slot${i === state.selected ? ' selected' : ''}`; button.innerHTML = slotContents(item, i, true);
    button.setAttribute('aria-label', `Slot ${i + 1}: ${item ? ITEMS[item.id].name : 'empty'}`); button.setAttribute('aria-pressed', i === state.selected); button.title = item ? ITEMS[item.id].name : 'Empty';
    button.onclick = () => selectSlot(i); $('#hotbar').append(button);
  }
  const item = state.inventory.slots[state.selected]; $('#selected-label').textContent = item ? ITEMS[item.id].name : 'Empty hand';
  view.setHeld(item?.id || 'hand'); updateQuest();
}
function selectSlot(index) { if (!state) return; state.selected = index; mining = null; renderHotbar(); }
function updateQuest() {
  const stages = [
    ['planks', 'Make yourself at home', 'Open your backpack with E. Turn a log into oak planks.'],
    ['table', 'A place to make things', 'Craft a table from 4 planks. You can move stacks to your hotbar.'],
    ['placedTable', 'Put down roots', 'Select your table, aim at the ground, and right-click to place it.'],
    ['stone_pick', 'The stone age', 'Mine stone with your wooden pickaxe. Craft a stone pickaxe by your table.'],
    ['iron_pick', 'A little deeper', 'Look for peach-colored iron ore. Three ingots make an iron pickaxe.'],
    ['diamond', 'Something worth finding', 'Bring torches. Diamond ore appears below Y 9.'],
  ];
  const step = stages.findIndex(([key]) => !state.progress[key]);
  $('#quest .quest-number').textContent = step < 0 ? '✦' : String(step + 1).padStart(2, '0');
  $('#quest-title').textContent = step < 0 ? 'The world is yours' : stages[step][1];
  $('#quest-detail').textContent = state.mode === 'creative' ? 'F to fly. Open E for unlimited blocks. Make something wonderful.' : step < 0 ? 'Build a home, follow a river, or find your next adventure.' : stages[step][2];
}

function renderInventory() {
  const grid = $('#inventory-grid'); grid.innerHTML = '';
  const slots = state.inventory.slots;
  slots.forEach((item, i) => {
    const button = document.createElement('button'); button.className = `inv-slot${item ? '' : ' empty'}${carriedSlot === i ? ' carried' : ''}${i < 9 ? ' belt-slot' : ''}`;
    button.innerHTML = slotContents(item, i); button.setAttribute('aria-label', `Backpack slot ${i + 1}: ${item ? `${ITEMS[item.id].name}, ${item.count}` : 'empty'}`); button.title = item ? `${ITEMS[item.id].name}${item.durability ? ` · ${item.durability} uses` : ''}` : 'Empty slot';
    button.onclick = event => {
      if (event.shiftKey && item) {
        const start = i < 9 ? 9 : 0, end = i < 9 ? 36 : 9;
        let destination = -1;
        for (let j = start; j < end; j++) if (slots[j]?.id === item.id && !ITEMS[item.id].tool && slots[j].count < 64) { destination = j; break; }
        if (destination < 0) for (let j = start; j < end; j++) if (!slots[j]) { destination = j; break; }
        if (destination >= 0) state.inventory.move(i, destination); else toast('No free slot in that part of your backpack.');
        carriedSlot = null;
      } else if (carriedSlot !== null) { state.inventory.move(carriedSlot, i); carriedSlot = null; }
      else if (item) carriedSlot = i;
      renderInventory(); renderHotbar();
    }; grid.append(button);
  });
  $('#item-count').textContent = `${slots.filter(Boolean).length} / 36 SLOTS`;
  $('#inventory-mode').textContent = state.mode.toUpperCase();
  $('#slot-help').textContent = carriedSlot === null ? 'Select a stack, then a slot to move it. The first nine slots are your hotbar.' : `Moving ${ITEMS[slots[carriedSlot].id].name}. Click another slot or press 1–9 to assign.`;
  const near = state.world.nearTable(state.player), creative = state.mode === 'creative';
  $('#table-status').textContent = near || creative ? 'TABLE READY' : 'HAND CRAFTING';
  $('#table-status').classList.toggle('ready', near || creative);
  const recipe = RECIPES[selectedRecipe];
  $('#recipe-name').textContent = ITEMS[recipe.id].name; $('#recipe-yield').textContent = `×${recipe.count}`;
  $('#recipe-note').textContent = recipe.note;
  $('#craft-grid').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="craft-slot">${recipe.pattern[i] ? icon(recipe.pattern[i]) : ''}</div>`).join('');
  $('#craft-output').innerHTML = icon(recipe.id) + `<span class="count">×${recipe.count}</span>`;
  $('#recipe-ingredients').innerHTML = Object.entries(recipe.needs).map(([id, qty]) => `<span class="ingredient${slots.filter(s => s?.id === id).reduce((n, s) => n + s.count, 0) >= qty || creative ? ' available' : ''}">${ITEMS[id].name} <b>${state.inventory.count(id)}/${qty}</b></span>`).join('');
  const available = state.inventory.canCraft(recipe, near, creative);
  $('#craft-button').disabled = !available.ok; $('#craft-button').textContent = available.ok ? `Craft ${recipe.count > 1 ? `${recipe.count} ` : ''}${ITEMS[recipe.id].name.toLowerCase()}` : available.reason;
  $('#recipe-list').innerHTML = '';
  RECIPES.forEach((r, i) => {
    const button = document.createElement('button'); button.className = `recipe-card${i === selectedRecipe ? ' selected' : ''}${state.inventory.canCraft(r, near, creative).ok ? ' available' : ''}`;
    button.innerHTML = icon(r.id); button.title = ITEMS[r.id].name + (r.table ? ' · crafting table' : ''); button.setAttribute('aria-label', `Recipe: ${ITEMS[r.id].name}`); button.setAttribute('aria-pressed', i === selectedRecipe);
    button.onclick = () => { selectedRecipe = i; renderInventory(); }; $('#recipe-list').append(button);
  });
  $('#recipe-count').textContent = `${RECIPES.length} RECIPES`;
  $('#creative-palette').classList.toggle('hidden', !creative);
  if (creative) {
    $('#palette-grid').innerHTML = '';
    for (const [id, def] of Object.entries(ITEMS)) {
      const button = document.createElement('button'); button.className = 'recipe-card'; button.innerHTML = icon(id); button.title = `Add ${def.name}`; button.setAttribute('aria-label', `Add ${def.name}`);
      button.onclick = () => { if (state.inventory.add(id, def.tool ? 1 : 64)) toast('Your backpack is full.'); renderInventory(); renderHotbar(); }; $('#palette-grid').append(button);
    }
  }
}
function craft() {
  const recipe = RECIPES[selectedRecipe]; const result = state.inventory.craft(recipe, state.world.nearTable(state.player), state.mode === 'creative');
  if (!result.ok) return toast(result.reason);
  carriedSlot = null; state.progress[recipe.id] = true; state.xp += 2;
  tone('craft'); toast(`Made ${recipe.count} ${ITEMS[recipe.id].name.toLowerCase()}.`); renderInventory(); renderHotbar(); saveWorld();
}

function clearInput() { keys.clear(); mineHeld = false; mining = null; pointerDrag = null; }
function setOverlay(next) {
  overlay = next; clearInput();
  $('#home-screen').classList.toggle('active', next === 'home'); $('#game-screen').classList.toggle('active', !!state && next !== 'home');
  for (const name of ['inventory', 'pause', 'help']) $(`#${name}-modal`).classList.toggle('hidden', next !== name);
  if (next !== 'play' && document.pointerLockElement) document.exitPointerLock();
  $('#capture-hint').classList.toggle('hidden', next !== 'play' || !!document.pointerLockElement || touch);
  if (next === 'inventory') { carriedSlot = null; renderInventory(); $('#close-inventory').focus(); }
  if (next === 'pause') { saveWorld(); $('#resume-btn').focus(); }
  if (next === 'help') $('#close-help').focus();
}
function capture() {
  if (touch || overlay !== 'play' || document.pointerLockElement) return;
  try { const request = canvas.requestPointerLock?.(); request?.catch?.(() => $('#capture-hint').classList.remove('hidden')); } catch { $('#capture-hint').classList.remove('hidden'); }
}
function saveWorld(show = false) {
  if (!state) return false;
  try {
    localStorage.setItem(SAVE_PREFIX + state.id, encodeSave(state));
    localStorage.setItem('blockbound.last-world', state.id);
    $('#save-status').textContent = '✓ Saved locally';
    if (show) toast('Your world is saved in this browser.'); return true;
  } catch { $('#save-status').textContent = 'Save unavailable'; if (show) toast('Browser storage is full or unavailable. Keep this tab open to keep playing.'); return false; }
}
function refreshSaves() {
  const saves = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i); if (!key.startsWith(SAVE_PREFIX)) continue;
      try { const s = decodeSave(localStorage.getItem(key)); saves.push(s); } catch { /* Preserve unsupported saves without listing them. */ }
    }
    saves.sort((a, b) => b.savedAt - a.savedAt);
    $('#world-select').innerHTML = '';
    for (const s of saves) { const option = document.createElement('option'); option.value = s.id; option.textContent = `${s.seed} · ${s.mode}`; $('#world-select').append(option); }
    $('#saved-worlds').classList.toggle('hidden', !saves.length);
  } catch { $('#saved-worlds').classList.add('hidden'); }
}

async function enterWorld(saved = null) {
  $('#loading').classList.remove('hidden'); $('#play-btn').disabled = true;
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  try {
    const seed = saved?.seed || $('#seed-input').value.trim() || 'cedar-valley';
    const world = new World(seed).generate(); if (saved) world.applyEdits(saved.edits);
    const mode = saved?.mode || selectedMode;
    const player = { ...world.spawn, yaw: -.245, pitch: -.015, vy: 0, grounded: false, flying: false, ...(saved?.player || {}) };
    if (collides(world, player)) Object.assign(player, world.spawn);
    state = { id: saved?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, world, mode, player, inventory: saved ? new Inventory(saved.inventory) : Inventory.starter(mode === 'creative'), selected: saved?.selected || 0, health: saved?.health || 20, food: saved?.food ?? 20, xp: saved?.xp || 0, elapsed: saved?.elapsed || 0, progress: saved?.progress || {}, survivalTimer: 0, oxygen: 12 };
    view.attach(world); renderHotbar(); $('#world-title').textContent = seed.replaceAll('-', ' ').toUpperCase(); $('#world-seed-label').textContent = `${mode.toUpperCase()} · ${SIZE} × ${SIZE} WORLD`;
    $('#quest').classList.remove('hidden'); saveTimer = 0; setOverlay('play'); updateHud();
    if (!saveWorld()) toast('Saving is unavailable in this browser. Your world will last while this tab is open.');
    else toast(saved ? 'Welcome back. Your little world missed you.' : 'A new adventure. Press E to open your backpack.');
  } catch (error) { console.error(error); setOverlay('home'); toast(`Could not open this world: ${error.message}`); }
  finally { $('#loading').classList.add('hidden'); $('#play-btn').disabled = false; }
}

function respawn() {
  Object.assign(state.player, state.world.spawn, { vy: 0, yaw: -.245, pitch: -.015 });
  // A player may have built over the clearing since their last visit.
  for (let y = state.world.spawn.y; y < HEIGHT + 2; y++) { state.player.y = y; if (!collides(state.world, state.player)) break; }
  state.health = 20; state.food = Math.max(12, state.food); state.oxygen = 12; clearInput();
  toast('Back at the clearing. Your backpack came with you.'); saveWorld();
}
function damage(amount) {
  if (state.mode === 'creative') return;
  state.health = Math.max(0, state.health - amount); tone('hurt'); $('#damage-overlay').classList.add('flash'); setTimeout(() => $('#damage-overlay').classList.remove('flash'), 220);
  if (state.health <= 0) respawn();
}

function movePlayer(dt) {
  const p = state.player, world = state.world;
  const water = world.get(Math.floor(p.x), Math.floor(p.y + .5), Math.floor(p.z)) === B.WATER;
  const submerged = world.get(Math.floor(p.x), Math.floor(p.y + 1.6), Math.floor(p.z)) === B.WATER;
  $('#water-overlay').classList.toggle('underwater', submerged);
  let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')), side = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const length = Math.hypot(forward, side); if (length) { forward /= length; side /= length; }
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const speed = p.flying ? 9 : water ? 2.8 : sprint && state.food > 3 ? 6.4 : 4.2;
  const dx = (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * side) * speed * dt;
  const dz = (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * side) * speed * dt;
  const moveAxis = (axis, distance) => {
    const count = Math.max(1, Math.ceil(Math.abs(distance) / .12));
    for (let i = 0; i < count; i++) { const old = p[axis]; p[axis] += distance / count; if (collides(world, p)) { p[axis] = old; return false; } }
    return true;
  };
  moveAxis('x', dx); moveAxis('z', dz);
  if (p.flying) { p.vy = 0; moveAxis('y', (Number(keys.has('Space')) - Number(sprint)) * 7 * dt); p.y = Math.min(p.y, HEIGHT + 20); }
  else {
    if (keys.has('Space') && (p.grounded || water)) { p.vy = water ? 4 : 8.2; p.grounded = false; }
    p.vy = Math.max(water ? -4 : -26, p.vy - (water ? 8 : 23) * dt);
    const wasFalling = p.vy; p.grounded = false;
    if (!moveAxis('y', p.vy * dt)) { p.grounded = wasFalling < 0; if (p.grounded && wasFalling < -12 && !water) damage(Math.floor((Math.abs(wasFalling) - 10) * .6)); p.vy = 0; }
  }
  if (p.y < -5) respawn();
  p.yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.65;
  p.pitch = clamp(p.pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * dt * 1.2, -1.53, 1.53);
  if (length && p.grounded) { footstepTime += dt; if (footstepTime > (sprint ? .28 : .43)) { tone('step'); footstepTime = 0; } }
  if (state.mode !== 'creative') {
    if (length) state.food = Math.max(0, state.food - dt * (sprint ? .035 : .012));
    state.oxygen = submerged ? Math.max(0, state.oxygen - dt) : 12;
    state.survivalTimer += dt;
    if (state.survivalTimer > 4) {
      state.survivalTimer = 0;
      if (state.oxygen <= 0) damage(2);
      if (state.food <= 0 && state.health > 2) damage(1);
      if (state.food >= 16 && state.health < 20) { state.health++; state.food -= .2; }
    }
  }
  return length > 0;
}

function mineUpdate(dt) {
  if (!mineHeld || !target) { mining = null; return; }
  const id = `${target.x},${target.y},${target.z}`;
  const info = miningInfo(target.id, state.inventory.slots[state.selected], state.mode === 'creative');
  if (!info.ok) { warn(info.reason); mining = null; return; }
  if (!mining || mining.id !== id) mining = { id, elapsed: 0, total: info.time };
  mining.elapsed += dt; swing = (swing + dt * 3) % 1;
  if (mining.elapsed < mining.total) return;
  const hit = { ...target }; const result = mineBlock(state.world, state.inventory, hit, state.selected, state.mode === 'creative');
  mining = null;
  if (!result.ok) return warn(result.reason);
  tone('mine'); view.debris(hit); state.xp += result.xp; state.progress[result.drop] = true;
  if (hit.id === B.LEAVES && state.mode !== 'creative' && Math.random() < .16) state.inventory.add('apple', 1);
  if (result.brokeTool) toast('Your tool wore out. Time to craft a new one.');
  renderHotbar(); $('#save-status').textContent = 'Unsaved changes';
}
function interact() {
  if (overlay !== 'play') return;
  // Interactions can arrive between rendered frames (including two quick clicks).
  // Trace the current world so a just-placed workbench is immediately usable.
  const p = state.player;
  direction.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
  target = raycast(state.world, { x: p.x, y: p.y + 1.62, z: p.z }, direction, state.mode === 'creative' ? 8 : 6);
  const item = state.inventory.slots[state.selected], def = ITEMS[item?.id];
  if (target?.id === B.TABLE && !keys.has('ShiftLeft') && !keys.has('ShiftRight')) { selectedRecipe = 6; setOverlay('inventory'); return; }
  if (def?.food) {
    if (state.food >= 20) return warn('You are already full.');
    state.food = Math.min(20, state.food + def.food); if (state.mode !== 'creative') { item.count--; if (!item.count) state.inventory.slots[state.selected] = null; }
    tone('craft'); renderHotbar(); toast('A little snack for the road.'); return;
  }
  const result = placeBlock(state.world, state.inventory, state.selected, target, state.player, state.mode === 'creative');
  if (!result.ok) return warn(result.reason);
  if (result.id === B.TABLE) { state.progress.placedTable = true; toast('Your workbench is ready. Right-click it or press E nearby.'); }
  swing = .35; tone('place'); renderHotbar(); $('#save-status').textContent = 'Unsaved changes';
}

function updateHud() {
  if (!state) return;
  const p = state.player, hours = (8.67 + state.elapsed / 60) % 24;
  $('#coords-label').textContent = `X ${Math.floor(p.x)} · Y ${Math.floor(p.y)} · Z ${Math.floor(p.z)}`;
  $('#time-label').textContent = `DAY ${String(1 + Math.floor((8.67 + state.elapsed / 60) / 24)).padStart(2, '0')} · ${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor(hours % 1 * 60)).padStart(2, '0')}`;
  $('#health-value').textContent = Math.ceil(state.health); $('#food-value').textContent = Math.ceil(state.food);
  $('#health-bar').style.width = `${state.health * 5}%`; $('#food-bar').style.width = `${state.food * 5}%`;
  $('#level-value').textContent = state.mode === 'creative' ? '∞' : Math.floor(state.xp / 100) + 1;
  $('#mode-label').textContent = p.flying ? 'FLYING' : state.mode === 'creative' ? 'CREATIVE' : 'EXPLORER'; $('#xp-bar').style.width = `${state.xp % 100}%`;
  const item = state.inventory.slots[state.selected]; const info = target ? miningInfo(target.id, item, state.mode === 'creative') : null;
  $('#target-label').textContent = target ? `${BLOCKS[target.id].name}${!info.ok ? ` · ${info.reason}` : target.id === B.TABLE ? ' · Right-click to craft' : ''}` : '';
  $('#target-label').classList.toggle('requires-tool', !!target && !info.ok);
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - (lastTime || now)) / 1000); lastTime = now;
  if (document.hidden) return;
  let moving = false;
  if (state && overlay !== 'home') {
    if (overlay === 'play') { state.elapsed += dt; moving = movePlayer(dt); }
    const p = state.player;
    view.camera.position.set(p.x, p.y + 1.62, p.z); view.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    view.camera.getWorldDirection(direction); target = raycast(state.world, view.camera.position, direction, state.mode === 'creative' ? 8 : 6);
    if (overlay === 'play') mineUpdate(dt);
    const progress = mining ? clamp(mining.elapsed / mining.total, 0, 1) : 0;
    view.target(overlay === 'play' ? target : null, progress);
    $('#mine-progress').classList.toggle('active', progress > 0); $('#mine-progress i').style.width = `${progress * 100}%`;
    if (!mineHeld) swing = Math.max(0, swing - dt * 3);
    view.update(overlay === 'play' ? dt : 0, (8.67 + state.elapsed / 60) % 24, p, { moving, swing });
    uiTimer += dt; saveTimer += overlay === 'play' ? dt : 0;
    if (uiTimer > .12) { updateHud(); uiTimer = 0; }
    if (saveTimer > 20) { saveWorld(); saveTimer = 0; }
  } else {
    const angle = .59 + Math.sin(now * .000035) * .12;
    view.camera.position.set(48 + Math.sin(angle) * 30, 38, 48 + Math.cos(angle) * 30);
    view.camera.lookAt(41, 17, 43); view.target(null, 0);
    view.update(dt, 9.4, { x: 48, y: 19, z: 48 }, { menu: true });
  }
}

$('#play-btn').onclick = () => { tone('click'); enterWorld(); };
$('#continue-btn').onclick = () => { try { enterWorld(decodeSave(localStorage.getItem(SAVE_PREFIX + $('#world-select').value))); } catch (error) { toast(error.message); } };
$('#random-seed').onclick = () => { const a = ['cedar', 'mossy', 'quiet', 'sunlit', 'bluebird', 'fern', 'amber'], b = ['valley', 'hollow', 'meadow', 'ridge', 'island', 'grove']; $('#seed-input').value = `${a[Math.floor(Math.random() * a.length)]}-${b[Math.floor(Math.random() * b.length)]}-${Math.floor(Math.random() * 999)}`; };
document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { selectedMode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', b === button); }); });
$('#pause-btn').onclick = () => setOverlay('pause');
$('#resume-btn').onclick = () => { setOverlay('play'); capture(); };
$('#save-btn').onclick = () => saveWorld(true);
$('#leave-btn').onclick = () => { if (!saveWorld(true)) return; setOverlay('home'); refreshSaves(); };
$('#respawn-btn').onclick = () => { respawn(); setOverlay('play'); capture(); };
$('#sound-btn').onclick = () => { soundEnabled = !soundEnabled; $('#sound-btn span').textContent = soundEnabled ? 'ON' : 'OFF'; };
$('#hide-quest').onclick = () => $('#quest').classList.add('hidden');
$('#home-help').onclick = () => { helpReturn = 'home'; setOverlay('help'); };
$('#help-btn').onclick = () => { helpReturn = 'pause'; setOverlay('help'); };
$('#close-help').onclick = () => setOverlay(helpReturn);
$('#close-inventory').onclick = () => { setOverlay('play'); saveWorld(); capture(); };
$('#craft-button').onclick = craft;

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  // Keep keyboard focus in the currently open dialog.
  if (e.code === 'Tab' && ['inventory', 'pause', 'help'].includes(overlay)) {
    const controls = [...$(`#${overlay}-modal`).querySelectorAll('button:not(:disabled), select')].filter(el => el.getClientRects().length);
    const index = controls.indexOf(document.activeElement), next = e.shiftKey ? (index - 1 + controls.length) % controls.length : (index + 1) % controls.length;
    e.preventDefault(); controls[next]?.focus(); return;
  }
  if (e.code === 'Escape') {
    e.preventDefault(); if (e.repeat) return;
    if (overlay === 'help') setOverlay(helpReturn); else if (overlay === 'inventory') setOverlay('play'); else if (overlay === 'pause') setOverlay('play'); else if (overlay === 'play') setOverlay('pause'); return;
  }
  if (!state || overlay === 'home' || overlay === 'help' || overlay === 'pause') return;
  if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); if (overlay === 'play') setOverlay('inventory'); else { setOverlay('play'); saveWorld(); capture(); } return; }
  if (/^Digit[1-9]$/.test(e.code)) {
    e.preventDefault(); const index = Number(e.code.slice(-1)) - 1;
    if (overlay === 'inventory' && carriedSlot !== null) { state.inventory.move(carriedSlot, index); carriedSlot = null; renderInventory(); }
    selectSlot(index); return;
  }
  if (overlay !== 'play') return;
  if (e.code === 'KeyF' && !e.repeat && state.mode === 'creative') { state.player.flying = !state.player.flying; state.player.vy = 0; toast(state.player.flying ? 'Flight on. Space rises, Shift descends.' : 'Feet back on the ground.'); }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { if (overlay === 'play') setOverlay('pause'); else clearInput(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && overlay === 'play') setOverlay('pause'); });
document.addEventListener('pointerlockchange', () => {
  $('#capture-hint').classList.toggle('hidden', !!document.pointerLockElement || overlay !== 'play' || touch);
  if (!document.pointerLockElement) clearInput();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  if (overlay !== 'play') return;
  e.preventDefault(); if (e.pointerType === 'touch') { pointerDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); return; }
  capture(); pointerDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  if (e.button === 0) mineHeld = true;
  if (e.button === 2) interact();
});
window.addEventListener('pointermove', e => {
  if (overlay !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && (!pointerDrag || pointerDrag.id !== e.pointerId)) return;
  const dx = locked ? e.movementX : e.clientX - pointerDrag.x, dy = locked ? e.movementY : e.clientY - pointerDrag.y;
  state.player.yaw -= dx * .0028; state.player.pitch = clamp(state.player.pitch - dy * .0028, -1.53, 1.53);
  if (pointerDrag) { pointerDrag.x = e.clientX; pointerDrag.y = e.clientY; }
});
window.addEventListener('pointerup', e => { if (e.pointerType !== 'touch' && e.button === 0) mineHeld = false; if (pointerDrag?.id === e.pointerId) pointerDrag = null; });
window.addEventListener('pointercancel', e => { if (e.pointerType !== 'touch') mineHeld = false; if (pointerDrag?.id === e.pointerId) pointerDrag = null; });
canvas.addEventListener('wheel', e => { if (overlay === 'play') { e.preventDefault(); selectSlot((state.selected + (e.deltaY > 0 ? 1 : 8)) % 9); } }, { passive: false });
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(button.dataset.key); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(button.dataset.key));
}
$('#touch-mine').addEventListener('pointerdown', e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); mineHeld = true; });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#touch-mine').addEventListener(event, () => mineHeld = false);
$('#touch-place').onclick = interact; $('#touch-inventory').onclick = () => setOverlay('inventory');
window.addEventListener('resize', () => view.resize());
window.addEventListener('pagehide', () => saveWorld());
window.addEventListener('beforeunload', () => saveWorld());

view.attach(new World('cedar-valley').generate());
refreshSaves(); requestAnimationFrame(frame);
