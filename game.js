import * as THREE from 'three';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import '@fontsource/vt323';
import { createIcons, BookOpen, Shuffle, Pickaxe, Blocks, ArrowRight, Play, Pause, X, ArrowUp, ArrowDown, ArrowLeft, ArrowUpFromLine, Backpack, Hand, Shirt, ArrowDownToLine, Grid3x3, PawPrint, Swords, Apple, Gem, Sprout, ChevronLeft, ChevronRight, Save, House, LogOut, HardHat, Columns2, Footprints, Shield, Settings2, Check, Map as MapIcon, Navigation, Maximize, ZoomIn, RotateCcw } from 'lucide';
import { B, BLOCKS, ITEMS, RECIPES } from './src/catalog.js';
import { World, SIZE, HEIGHT, clamp, hashString, raycast, collides } from './src/world.js';
import { Inventory } from './src/inventory.js';
import { miningInfo, mineBlock, placeBlock } from './src/rules.js';
import { VoxelRenderer } from './src/render.js';
import { stepPhysics, updateBreath } from './src/physics.js';
import { WorldSystems } from './src/systems.js';
import { ENCHANTMENTS } from './src/expansion.js';
import { canEnchant, mendEquipment, enchantLevel } from './src/enchanting.js';
import { applyEffect, updateSpear } from './src/extended-actions.js';
import { craftGrid, matchCraftGrid, fillCraftGrid, insertStack, transferStack, transferSlot, stackData } from './src/crafting.js';
import { setReferenceItems } from './src/item-art.js';
import itemSprites from './src/data/item-sprites.json' with { type: 'json' };
import { terrainColumn } from './src/terrain.js';
import { DIMENSIONS, STRUCTURE_TYPES, regionBiome } from './src/regions.js';
import { SAVE_PREFIX, encodeSave, decodeSave } from './src/save.js';
import { MobSystem } from './src/mobs.js';
import { MOBS, MOB_LIST, TRADES } from './src/mob-catalog.js';
import { useItem, attackMob, updateEffects, hitPlayer, defense, equip, unequip, dropStack } from './src/actions.js';
import { itemIcon } from './src/item-art.js';

const $ = selector => document.querySelector(selector);
const icons = { BookOpen, Shuffle, Pickaxe, Blocks, ArrowRight, Play, Pause, X, ArrowUp, ArrowDown, ArrowLeft, ArrowUpFromLine, Backpack, Hand, Shirt, ArrowDownToLine, Grid3x3, PawPrint, Swords, Apple, Gem, Sprout, ChevronLeft, ChevronRight, Save, House, LogOut, HardHat, Columns2, Footprints, Shield, Settings2, Check, Map: MapIcon, Navigation, Maximize, ZoomIn, RotateCcw };
const canvas = $('#game-canvas');
let view;
try { view = new VoxelRenderer(canvas); }
catch (error) { $('#webgl-error').classList.remove('hidden'); $('#play-btn').disabled = true; throw error; }
let state = null, overlay = 'home', helpReturn = 'home', selectedMode = 'survival';
let recipePage = 0, bookItemIndex = null, bookReadOnly = false;
let selectedRecipe = 0, carriedSlot = null, carriedSource = null, carriedItem = null, target = null, mining = null, mineHeld = false;
let useHeld = false, touchLook = null, quickHelpReturn = 'home';
let lastTime = 0, uiTimer = 0, saveTimer = 0, soundEnabled = true, swing = 0, footstepTime = 0;
let toastTimer = 0, lastWarning = '', warningTime = 0, pointerDrag = null;
let mobTarget = null, paletteCategory = 'all', palettePage = 0, activeTrader = null, activeStation = null, activePortableStorage = null, activeNameMob = null;
let activeMapDimension = 'overworld', settingsReturn = 'pause';
let settings = { renderDistance: 90, fov: 74, touchSensitivity: 1.25, controlScale: 1, quality: 'balanced', difficulty: 'normal', clouds: true, viewBob: true, autoJump: true };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('blockbound.settings') || '{}') }; } catch { /* Use defaults when browser storage is unavailable. */ }
let needsRender = true, lastMenuFrame = 0;
const keys = new Set(), direction = new THREE.Vector3();
const touchMove = { forward: 0, side: 0 };
const touch = matchMedia('(pointer: coarse)').matches;
document.documentElement.style.setProperty('--control-scale', settings.controlScale);
let audio;
const assetReady = (async () => {
  view.configure(settings);
  const itemImage = new Image(); itemImage.src = new URL('assets/items.png', document.baseURI).href;
  await Promise.all([view.loadTextures(), view.mobRenderer.reference.load(), itemImage.decode().then(() => setReferenceItems(itemImage, itemSprites)).catch(() => {})]);
})();

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
  return itemIcon(id);
}

function slotContents(item, index, hotbar = false) {
  const number = hotbar || index < 9 ? `<span class="slot-number">${index + 1}</span>` : '';
  if (!item) return number;
  const durability = item.durability ? `<span class="durability"><i style="width:${item.durability / ITEMS[item.id].durability * 100}%"></i></span>` : '';
  return number + icon(item.id) + `<span class="slot-count">${hotbar && state.mode === 'creative' && ITEMS[item.id].block ? '∞' : item.count > 1 ? item.count : ''}</span>` + durability;
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
function clearCarry() { carriedSlot = null; carriedSource = null; carriedItem = null; }
function slotArray(source) {
  return source === 'inventory' ? state.inventory.slots : source === 'crafting' ? state.craftingSlots : activePortableStorage || state.systems.machine(activeStation, state)?.slots;
}
function refreshSlots() { overlay === 'station' ? renderStation() : renderInventory(); renderHotbar(); }
function bindSlot(button, source, index, input = true) {
  const slots = slotArray(source), item = slots[index];
  button.draggable = !!item;
  button.classList.toggle('carried', carriedSource === source && carriedSlot === index);
  const select = () => { if (slots[index]) { carriedSource = source; carriedSlot = index; } };
  const place = (single = false) => {
    if (carriedSource === null || !input) return false;
    if (carriedSource === source && carriedSlot === index) { clearCarry(); return true; }
    const from = slotArray(carriedSource), amount = single ? 1 : Infinity;
    const moved = transferSlot(from, carriedSlot, slots, index, amount, !single);
    if (moved && (!single || !from[carriedSlot])) clearCarry();
    return moved;
  };
  button.onclick = event => {
    if (event.shiftKey && item && source === 'inventory' && carriedSource === null) {
      if (overlay === 'station') {
        const machine = state.systems.machine(activeStation, state), target = slotArray('station');
        for (let i = 0; i < target.length && slots[index]; i++) if (!(i === 2 && ['smelt', 'smoke', 'blast'].includes(machine?.station) || i === 3 && machine?.station === 'brew')) transferSlot(slots, index, target, i, Infinity, false);
      } else {
        const start = index < 9 ? 9 : 0, end = index < 9 ? 36 : 9;
        for (let i = start; i < end && slots[index]; i++) transferSlot(slots, index, slots, i, Infinity, false);
      }
    } else if (carriedSource !== null) place(source !== 'inventory');
    else select();
    refreshSlots();
  };
  button.oncontextmenu = event => { event.preventDefault(); if (carriedSource !== null) place(true); else select(); refreshSlots(); };
  button.ondragstart = event => { select(); event.dataTransfer?.setData('text/plain', `${source}:${index}`); if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'; button.classList.add('carried'); };
  button.ondragover = event => { if (carriedSource !== null && input) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } };
  button.ondrop = event => { event.preventDefault(); if (place(event.shiftKey)) refreshSlots(); };
  button.ondragend = () => { clearCarry(); document.querySelectorAll('.carried').forEach(el => el.classList.remove('carried')); };
}
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
    const button = document.createElement('button'); button.draggable = !!item; button.className = `inv-slot${item ? '' : ' empty'}${carriedSlot === i ? ' carried' : ''}${i < 9 ? ' belt-slot' : ''}`;
    button.innerHTML = slotContents(item, i); button.setAttribute('aria-label', `Backpack slot ${i + 1}: ${item ? `${ITEMS[item.id].name}, ${item.count}` : 'empty'}`); button.title = item ? `${ITEMS[item.id].name}${item.durability ? ` · ${item.durability} uses` : ''}` : 'Empty slot';
    bindSlot(button, 'inventory', i); grid.append(button);
  });
  $('#item-count').textContent = `${slots.filter(Boolean).length} / 36 SLOTS`;
  $('#inventory-mode').textContent = state.mode.toUpperCase();
  $('#slot-help').textContent = carriedSlot === null ? '' : ITEMS[slots[carriedSlot]?.id]?.name || '';
  $('#equip-item').disabled = carriedSource !== 'inventory' || !ITEMS[slots[carriedSlot]?.id]?.armorSlot;
  $('#drop-item').disabled = carriedSource !== 'inventory';
  $('#equipment-grid').innerHTML = '';
  for (const name of ['helmet', 'chestplate', 'leggings', 'boots', 'offhand']) {
    const item = state.equipment[name], button = document.createElement('button'); button.className = 'inv-slot equipment-slot';
    button.innerHTML = item ? icon(item.id) : `<i data-lucide="${{ helmet: 'hard-hat', chestplate: 'shirt', leggings: 'columns-2', boots: 'footprints', offhand: 'shield' }[name]}"></i>`;
    button.title = item ? ITEMS[item.id].name : name; button.setAttribute('aria-label', item ? `Unequip ${ITEMS[item.id].name}` : `Empty ${name}`);
    button.onclick = () => { if (item && !unequip(state, name)) toast('Backpack is full'); renderInventory(); renderHotbar(); }; $('#equipment-grid').append(button);
  }
  const near = state.world.nearTable(state.player), creative = state.mode === 'creative';
  $('#table-status').textContent = near || creative ? 'TABLE READY' : 'HAND CRAFTING';
  $('#table-status').classList.toggle('ready', near || creative);
  const recipe = RECIPES[selectedRecipe];
  $('#recipe-name').textContent = ITEMS[recipe.id].name; $('#recipe-yield').textContent = `×${recipe.count}`;
  $('#recipe-note').textContent = recipe.note;
  $('#craft-grid').innerHTML = Array.from({ length: 9 }, (_, i) => `<div class="craft-slot">${recipe.pattern[i] ? icon(recipe.pattern[i]) : ''}</div>`).join('');
  $('#craft-output').innerHTML = icon(recipe.id) + `<span class="count">×${recipe.count}</span>`;
  $('#recipe-ingredients').innerHTML = Object.entries(recipe.needs).map(([id, qty]) => `<span class="ingredient${slots.filter(s => s?.id === id).reduce((n, s) => n + s.count, 0) >= qty || creative ? ' available' : ''}">${ITEMS[id].name} <b>${state.inventory.count(id)}/${qty}</b></span>`).join('');
  const combined = new Inventory(slots); for (const item of state.craftingSlots) if (item) combined.add(item.id, item.count, item.durability, item);
  const available = combined.canCraft(recipe, near, creative);
  $('#craft-button').disabled = !available.ok; $('#craft-button').textContent = available.ok ? `Craft ${recipe.count > 1 ? `${recipe.count} ` : ''}${ITEMS[recipe.id].name.toLowerCase()}` : available.reason;
  $('#recipe-list').innerHTML = '';
  const recipeQuery = $('#recipe-search').value.toLowerCase().trim();
  const recipeSeen = new Map();
  const filteredRecipes = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => !recipeQuery || ITEMS[r.id].name.toLowerCase().includes(recipeQuery));
  const pages = Math.max(1, Math.ceil(filteredRecipes.length / 36)); recipePage = Math.min(recipePage, pages - 1);
  $('#recipe-page').textContent = (recipePage + 1) + ' / ' + pages; $('#recipe-prev').disabled = recipePage === 0; $('#recipe-next').disabled = recipePage >= pages - 1;
  filteredRecipes.slice(recipePage * 36, recipePage * 36 + 36).forEach(({ r, i }) => {
    if (recipeQuery && !ITEMS[r.id].name.toLowerCase().includes(recipeQuery)) return;
    const button = document.createElement('button'); button.className = `recipe-card${i === selectedRecipe ? ' selected' : ''}${state.inventory.canCraft(r, near, creative).ok ? ' available' : ''}`;
    const recipeName = ITEMS[r.id].name;
    const duplicate = recipeSeen.get(r.id) || 0;
    recipeSeen.set(r.id, duplicate + 1);
    const detail = duplicate ? ` (${Object.keys(r.needs || {}).join(' + ')})` : '';
    button.innerHTML = icon(r.id); button.title = recipeName + detail + (r.table ? ' · crafting table' : ''); button.setAttribute('aria-label', `Recipe: ${recipeName}${detail}`); button.setAttribute('aria-pressed', i === selectedRecipe);
    button.onclick = () => { selectedRecipe = i; if (!r.table) { const filled = fillCraftGrid(r, state.craftingSlots, state.inventory, 2, creative); if (!filled.ok) toast(filled.reason); } renderInventory(); }; $('#recipe-list').append(button);
  });
  $('#recipe-count').textContent = `${RECIPES.length} RECIPES`;
  $('#creative-palette').classList.toggle('hidden', !creative);
  if (creative) renderPalette();
  renderManualCraft(); renderPlayerPreview();
  createIcons({ icons });
}
function renderManualCraft() {
  const grid = $('#manual-grid'); if (!grid || !state) return;
  grid.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const item = state.craftingSlots?.[i], button = document.createElement('button'); button.draggable = !!item; button.className = `inv-slot${item ? '' : ' empty'}`; button.innerHTML = slotContents(item, i);
    button.setAttribute('aria-label', `Crafting cell ${i + 1}: ${item ? ITEMS[item.id].name : 'empty'}`); button.title = item ? ITEMS[item.id].name : 'Empty crafting cell';
    bindSlot(button, 'crafting', i); grid.append(button);
  }
  const output = matchGridOutput(); $('#manual-output').innerHTML = output ? icon(output.id) + `<span class="count">×${output.count}</span>` : '';
  $('#manual-output').disabled = !output; $('#manual-output').title = output ? ITEMS[output.id].name : 'No output';
  $('#manual-output').onclick = () => {
    const result = craftGrid(state.craftingSlots, state.inventory, 2);
    if (!result.ok) return toast(result.reason);
    clearCarry(); state.progress[result.recipe.id] = true; state.xp += 2; tone('craft'); renderInventory(); renderHotbar(); saveWorld();
  };
}
function matchGridOutput() {
  const slots = [...(state.craftingSlots || []).slice(0, 4), ...Array(5).fill(null)];
  const r = matchCraftGrid(slots, 2); return r ? { id: r.id, count: r.count } : null;
}
function renderPlayerPreview() {
  const canvas = $('#player-preview'); if (!canvas || !state) return; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#202722'; ctx.fillRect(5, 4, 86, 119); ctx.fillStyle = '#151b18'; ctx.fillRect(15, 114, 66, 5);
  const skin = '#c58f72', shirt = '#15999a', pants = '#303f92', hair = '#4b3229';
  ctx.fillStyle = pants; ctx.fillRect(34, 79, 13, 34); ctx.fillRect(50, 79, 13, 34); ctx.fillStyle = '#20294f'; ctx.fillRect(32, 109, 17, 6); ctx.fillRect(48, 109, 17, 6);
  ctx.fillStyle = shirt; ctx.fillRect(29, 49, 39, 34); ctx.fillStyle = skin; ctx.fillRect(19, 51, 10, 29); ctx.fillRect(68, 51, 10, 29); ctx.fillStyle = '#15676f'; ctx.fillRect(26, 78, 46, 7);
  ctx.fillStyle = skin; ctx.fillRect(35, 17, 27, 31); ctx.fillStyle = hair; ctx.fillRect(34, 15, 29, 10); ctx.fillRect(34, 21, 5, 20); ctx.fillRect(58, 21, 5, 18); ctx.fillStyle = '#2b2522'; ctx.fillRect(40, 30, 4, 4); ctx.fillRect(53, 30, 4, 4); ctx.fillStyle = '#765047'; ctx.fillRect(45, 39, 8, 3);
  ctx.strokeStyle = '#d8e4d1'; ctx.strokeRect(5, 4, 86, 119);
}
function renderPalette() {
  const query = $('#item-search').value.trim().toLowerCase();
  const entries = Object.entries(ITEMS).filter(([, d]) => (paletteCategory === 'all' || d.category === paletteCategory) && d.name.toLowerCase().includes(query));
  const pages = Math.max(1, Math.ceil(entries.length / 45)); palettePage = Math.min(palettePage, pages - 1);
  $('#palette-grid').innerHTML = '';
  for (const [id, def] of entries.slice(palettePage * 45, (palettePage + 1) * 45)) {
    const button = document.createElement('button'); button.className = 'recipe-card'; button.innerHTML = icon(id); button.title = `Add ${def.name}`; button.setAttribute('aria-label', `Add ${def.name}`);
    button.onclick = event => {
      if (event.shiftKey) state.inventory.slots[state.selected] = { id, count: def.stack === 1 || def.spawn ? 1 : 64, ...(def.durability ? { durability: def.durability } : {}) };
      else if (state.inventory.add(id, def.stack === 1 || def.spawn ? 1 : 64)) toast('Your backpack is full.');
      renderInventory(); renderHotbar();
    }; $('#palette-grid').append(button);
  }
  $('#palette-count').textContent = `${entries.length} items`;
  $('#palette-page').textContent = `${palettePage + 1} / ${pages}`; $('#palette-prev').disabled = palettePage <= 0; $('#palette-next').disabled = palettePage >= pages - 1;
}
function renderTrade() {
  const mob = state.mobs.mobs.find(m => m.uid === activeTrader); if (!mob) return setOverlay('play');
  $('#trader-name').textContent = MOBS[mob.type].name;
  $('#trade-list').innerHTML = '';
  for (const [i, trade] of TRADES.entries()) {
    const button = document.createElement('button'); button.className = 'trade-offer';
    button.innerHTML = `<span>${icon(trade.take)}<b>${trade.amount}</b></span><i data-lucide="arrow-right"></i><span>${icon(trade.give)}<b>${trade.count}</b></span><span>${ITEMS[trade.give].name}</span>`;
    button.title = `${trade.amount} ${ITEMS[trade.take].name} for ${trade.count} ${ITEMS[trade.give].name}`; button.setAttribute('aria-label', button.title);
    button.disabled = state.inventory.count(trade.take) < trade.amount;
    button.onclick = () => { const result = state.mobs.trade(activeTrader, i, state); if (!result.ok) toast(result.reason); else { tone('craft'); renderHotbar(); renderTrade(); saveWorld(); } }; $('#trade-list').append(button);
  }
  $('#trade-balance').textContent = `${state.inventory.count('emerald')} emeralds`; createIcons({ icons });
}
function updateSettingOutputs() {
  for (const id of ['render-distance', 'fov', 'touch-sensitivity', 'control-scale']) { const el = $(`#${id}`); const out = $(`#${id}-value`); if (el && out) out.textContent = id === 'touch-sensitivity' || id === 'control-scale' ? `${Number(el.value).toFixed(2)}×` : el.value; }
}
function renderSettings() {
  for (const [id, value] of Object.entries(settings)) { const el = $(`#${id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`); if (!el) continue; if (el.type === 'checkbox') el.checked = !!value; else el.value = value; }
  updateSettingOutputs();
  createIcons({ icons });
}
function applySettings() {
  for (const id of ['render-distance', 'fov', 'touch-sensitivity', 'control-scale', 'quality', 'difficulty', 'clouds', 'view-bob', 'auto-jump']) { const el = $(`#${id}`); if (!el) continue; const key = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()); settings[key] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value; }
  try { localStorage.setItem('blockbound.settings', JSON.stringify(settings)); } catch { /* Preferences remain active for this session. */ }
  state && (state.settings = settings); view.configure(settings); document.documentElement.style.setProperty('--control-scale', settings.controlScale); renderHotbar();
}
function stationRecipes(machine) {
  const type = machine?.station;
  if (!type) return [];
  return RECIPES.filter(r => type === 'stonecut' ? ITEMS[r.id]?.block && Object.keys(r.needs).length === 1 : type === 'fletch' ? ['arrow'].includes(r.id) || r.id.includes('tipped') : type === 'compost' ? r.id === 'bone_meal' : r.table);
}
function renderStation() {
  const machine = activePortableStorage ? { block: B.CHEST, station: null, slots: activePortableStorage } : activeStation === null ? null : state.systems.machine(activeStation, state); if (!machine) return setOverlay('play');
  const def = BLOCKS[machine.block] || BLOCKS[B.CHEST]; $('#station-name').textContent = activePortableStorage ? 'Storage' : def.name; $('#station-grid').innerHTML = '';
  const crafting = machine.station === 'craft';
  $('#station-grid').classList.toggle('table-grid', crafting);
  for (let i = 0; i < machine.slots.length; i++) {
    const item = machine.slots[i], button = document.createElement('button'); button.className = `inv-slot${item ? '' : ' empty'}`; button.innerHTML = slotContents(item, 9); button.setAttribute('aria-label', `${item ? ITEMS[item.id].name : 'Empty'} workstation slot ${i + 1}`); button.title = item ? ITEMS[item.id].name : 'Empty slot';
    bindSlot(button, 'station', i, !(i === 2 && ['smelt', 'smoke', 'blast'].includes(machine.station) || i === 3 && machine.station === 'brew'));
    $('#station-grid').append(button);
  }
  const recipe = crafting ? matchCraftGrid(machine.slots, 3) : null, output = machine.output || recipe;
  $('#station-output').classList.toggle('hidden', !crafting);
  $('#station-output').innerHTML = output ? icon(output.id) + `<span class="count">${output.count}</span>` : '';
  $('#station-output').disabled = !output;
  $('#station-output').onclick = () => {
    if (machine.output) { const target = [machine.output]; transferStack(target, 0, state.inventory.slots); machine.output = target[0]; }
    else { const result = craftGrid(machine.slots, state.inventory, 3); if (!result.ok) toast(result.reason); else state.xp += 2; }
    clearCarry(); renderStation(); renderHotbar(); saveWorld();
  };
  $('#station-inventory').innerHTML = '';
  for (let i = 0; i < 36; i++) {
    const item = state.inventory.slots[i], button = document.createElement('button'); button.className = `inv-slot${i < 9 ? ' belt-slot' : ''}`; button.innerHTML = slotContents(item, i); button.title = item ? ITEMS[item.id].name : 'Empty slot'; button.setAttribute('aria-label', `Station backpack slot ${i + 1}: ${item ? ITEMS[item.id].name : 'empty'}`);
    bindSlot(button, 'inventory', i); $('#station-inventory').append(button);
  }
  const previousRecipe = $('#station-recipe').value;
  $('#station-recipe').innerHTML = machine.station === 'enchant' ? Object.entries(ENCHANTMENTS).filter(([id]) => canEnchant(machine.slots[0], id)).map(([id, e]) => '<option value="' + id + '">' + e.name + '</option>').join('') : stationRecipes(machine).map(r => `<option value="${r.id}">${ITEMS[r.id]?.name || r.id}</option>`).join('');
  if ([...$('#station-recipe').options].some(o => o.value === previousRecipe)) $('#station-recipe').value = previousRecipe;
  $('#station-name-input').classList.toggle('hidden', machine.station !== 'anvil');
  $('#station-recipe').classList.toggle('hidden', !['enchant', 'stonecut'].includes(machine.station)); $('#station-status').textContent = machine.status === 'Cooking' || machine.status === 'Brewing' ? `${machine.status} ${Math.round(machine.progress / (machine.duration || 1) * 100)}%` : machine.status || 'Ready';
  $('.station-actions').classList.toggle('hidden', !machine.station || crafting);
  $('#station-process').disabled = !!activePortableStorage || !['anvil', 'grind', 'smith', 'stonecut', 'loom', 'cartography', 'fletch', 'compost', 'craft', 'enchant'].includes(machine.station); createIcons({ icons });
}
function renderMap() {
  const world = state.world; $('#map-title').textContent = `${world.dimension === 'overworld' ? 'World' : world.dimension === 'nether' ? 'Nether' : 'The End'} Atlas`;
  $('#map-player').style.left = '50%'; $('#map-player').style.top = '50%';
  const mapCanvas = $('#atlas-terrain'), ctx = mapCanvas.getContext('2d'), scale = 3;
  for (let x = 0; x < 96; x++) for (let z = 0; z < 96; z++) {
    const wx = Math.floor(state.player.x) + (x - 48) * scale, wz = Math.floor(state.player.z) + (z - 48) * scale;
    const col = terrainColumn(world, wx, wz);
    ctx.fillStyle = col.h < 0 ? '#19131f' : col.h < col.level ? world.dimension === 'nether' ? '#e87523' : '#376bab' : BLOCKS[col.top]?.color || '#72a14a';
    ctx.fillRect(x * 2, z * 2, 2, 2);
  }
  const found = [...world.structures].sort((a, b) => Math.hypot(a.x - state.player.x, a.z - state.player.z) - Math.hypot(b.x - state.player.x, b.z - state.player.z)).slice(0, 32);
  $('#map-list').innerHTML = found.map((s, i) => `<button class="map-marker" data-structure="${i}"><span>${s.name}</span><b>${s.x}, ${s.z}</b></button>`).join('');
  document.querySelectorAll('#dimension-buttons button').forEach(button => { button.classList.toggle('selected', button.dataset.dimension === world.dimension); button.disabled = state.mode !== 'creative' && button.dataset.dimension !== world.dimension; });
  document.querySelectorAll('.map-marker').forEach(button => button.onclick = () => { const marker = found[Number(button.dataset.structure)]; if (marker && state.mode === 'creative') { Object.assign(state.player, { x: marker.x + .5, y: world.surface(marker.x, marker.z) + 1, z: marker.z + .5, vy: 0, fallDistance: 0 }); setOverlay('play'); } });
  createIcons({ icons });
}
function returnCrafting() {
  if (!state?.craftingSlots) return;
  for (let i = 0; i < 4; i++) if (state.craftingSlots[i]) {
    const stack = state.craftingSlots[i], left = state.inventory.add(stack.id, stack.count, stack.durability, stack);
    state.craftingSlots[i] = left && !state.mobs.addDrop(stack.id, left, state.player, stack.durability, stack) ? { ...stack, count: left } : null;
  }
  clearCarry();
}
function craft() {
  returnCrafting();
  const recipe = RECIPES[selectedRecipe]; const result = state.inventory.craft(recipe, state.world.nearTable(state.player), state.mode === 'creative');
  if (!result.ok) return toast(result.reason);
  carriedSlot = null; state.progress[recipe.id] = true; state.xp += 2;
  tone('craft'); toast(`Made ${recipe.count} ${ITEMS[recipe.id].name.toLowerCase()}.`); renderInventory(); renderHotbar(); saveWorld();
}

function clearInput() { keys.clear(); useHeld = false; touchLook = null; touchMove.forward = touchMove.side = 0; const stick = $('#touch-stick'); if (stick) stick.style.transform = 'translate(-50%, -50%)'; mineHeld = false; mining = null; pointerDrag = null; }
function setOverlay(next) {
  if (overlay === 'inventory' && next !== 'inventory') returnCrafting();
  if (overlay === 'station' && next !== 'station') { $('#station-name-input').value = ''; if (activeStation !== null) state?.systems?.close(activeStation); activeStation = null; activePortableStorage = null; }
  clearCarry();
  overlay = next; clearInput(); needsRender = true;
  if (next === 'home' && view.world !== menuWorld) { view.attach(menuWorld, menuCenter); view.mobSystem = null; }
  $('#home-screen').classList.toggle('active', next === 'home'); $('#game-screen').classList.toggle('active', !!state && next !== 'home');
  for (const name of ['inventory', 'pause', 'help', 'trade', 'settings', 'station', 'map', 'name', 'quick-help', 'book']) $(`#${name}-modal`).classList.toggle('hidden', next !== name);
  if (next !== 'play' && document.pointerLockElement) document.exitPointerLock();
  $('#capture-hint').classList.toggle('hidden', next !== 'play' || !!document.pointerLockElement || touch);
  if (next === 'inventory') { carriedSlot = null; renderInventory(); $('#close-inventory').focus(); }
  if (next === 'pause') { saveWorld(); $('#resume-btn').focus(); }
  if (next === 'help') $('#close-help').focus();
  if (next === 'trade') { renderTrade(); $('#close-trade').focus(); }
  if (next === 'settings') { renderSettings(); $('#render-distance').focus(); }
  if (next === 'station') { renderStation(); $('#close-station').focus(); }
  if (next === 'map') { renderMap(); $('#close-map').focus(); }
  if (next === 'name') { $('#name-input').value = ''; $('#name-input').focus(); }
  if (next === 'quick-help') { showHelpControls(touch); $('#close-quick-help').focus(); }
  if (next === 'book') $('#close-book').focus();
  if (next === 'play') document.activeElement?.blur();
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
    await assetReady;
    const rawSeed = saved?.seed ?? $('#seed-input').value.trim();
    const seed = saved ? rawSeed : /^-?\d+$/.test(rawSeed) ? BigInt(rawSeed).toString() : String(hashString(rawSeed || '0'));
    const world = new World(seed, saved ? saved.worldVersion || 1 : 5, saved?.dimension || 'overworld', { streaming: !saved || (saved.worldVersion || 1) >= 4 }).generate(); if (saved) { world.applyEdits(saved.edits); world.applyStates(saved.blockStates); world.applyFarEdits(saved.farEdits); world.applyFarStates(saved.farBlockStates); }
    const mode = saved?.mode || selectedMode;
    const player = { ...world.spawn, yaw: -.245, pitch: -.015, vy: 0, grounded: false, flying: false, ...(saved?.player || {}) };
    if (collides(world, player)) Object.assign(player, world.spawn);
    state = { id: saved?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, world, mode, player, inventory: saved ? new Inventory(saved.inventory) : Inventory.starter(mode === 'creative'), selected: saved?.selected || 0, health: saved?.health ?? 20, food: saved?.food ?? 20, xp: saved?.xp || 0, elapsed: saved?.elapsed || 0, progress: saved?.progress || {}, survivalTimer: 0, fluidTimer: 0, oxygen: 12, settings, dimensions: saved?.dimensions || {}, enderStorage: saved?.enderStorage || Array(27).fill(null), craftingSlots: saved?.craftingSlots || Array(4).fill(null), spawnPoint: saved?.spawnPoint || null, deathPoint: saved?.deathPoint || null };
    state.equipment = saved?.equipment || {}; state.effects = saved?.effects || {}; state.attackCooldown = 0; state.riding = null; state.vehicle = null; state.music = null; state.settings = settings;
    state.oxygen = 15; state.portalExitRequired = true;
    state.systems = new WorldSystems(world, saved?.systems);
    state.mobs = new MobSystem(world, saved?.entities);
    state.mobs.systems = state.systems;
    view.attach(world, player); view.mobSystem = state.mobs; renderHotbar(); $('#world-title').textContent = `${seed.replaceAll('-', ' ')} · ${world.dimension}`.toUpperCase(); $('#world-seed-label').textContent = `${mode.toUpperCase()} · STREAMED WORLD`;
    $('#quest').classList.remove('hidden'); saveTimer = 0; setOverlay('play'); updateHud();
    if (!saveWorld()) toast('Saving is unavailable in this browser. Your world will last while this tab is open.');
    else toast(saved ? 'World loaded' : 'World created');
  } catch (error) { console.error(error); setOverlay('home'); toast(`Could not open this world: ${error.message}`); }
  finally { $('#loading').classList.add('hidden'); $('#play-btn').disabled = false; }
}

function respawn() {
  state.deathPoint = { x: state.player.x, y: state.player.y, z: state.player.z, dimension: state.world.dimension };
  const spawn = state.spawnPoint?.dimension === state.world.dimension ? state.spawnPoint : state.world.spawn;
  Object.assign(state.player, spawn, { vy: 0, yaw: -.245, pitch: -.015 });
  // A player may have built over the clearing since their last visit.
  for (let y = spawn.y; y < state.world.height + 2; y++) { state.player.y = y; if (!collides(state.world, state.player)) break; }
  state.health = 20; state.food = Math.max(12, state.food); state.oxygen = 15; state.player.fallDistance = 0; clearInput();
  state.effects = {}; state.riding = null; state.vehicle = null; state.player.flying = false; state.player.vx = state.player.vz = 0;
  toast('Respawned. Your inventory is safe.'); saveWorld();
}
function damage(amount, effect = null) {
  if (!hitPlayer(state, amount, effect)) return;
  tone('hurt'); $('#damage-overlay').classList.add('flash'); setTimeout(() => $('#damage-overlay').classList.remove('flash'), 220);
  if (state.health <= 0) respawn();
}

function movePlayer(dt) {
  const p = state.player, world = state.world;
  const water = world.inWater({ ...p, y: p.y + .4 });
  const forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS')) + touchMove.forward, side = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + touchMove.side;
  const length = Math.hypot(forward, side);
  const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const mount = state.mobs.mobs.find(m => m.uid === state.riding);
  if (state.riding && !mount) state.riding = null;
  const bodyHeight = mount ? 1.82 + MOBS[mount.type].height * .45 : 1.8;
  const bodyRadius = mount ? Math.min(.65, MOBS[mount.type].width / 2) : .29;
  const speed = (mount ? MOBS[mount.type].speed * 2.5 : state.vehicle ? (state.vehicle.type === 'boat' ? 5 : 4) : p.flying ? 9 : water ? 2.2 : keys.has('KeyC') ? 1.3 : sprint && state.food > 3 ? 5.612 : 4.317) * (state.effects.speed ? 1.4 : state.effects.slowness ? .55 : 1) * (state.dash ? 1.8 : 1);
  state.moveSpeed = speed;
  state.sneaking = keys.has('KeyC');
  const result = stepPhysics(world, p, { forward, side, jump: keys.has('Space'), sneak: keys.has('KeyC'), sprint, descend: keys.has('KeyC') || keys.has('ControlLeft') || p.flying && sprint }, dt, { speed, height: bodyHeight, radius: bodyRadius, autoJump: settings.autoJump && !mount && !state.vehicle, levitation: state.effects.levitation, slowFalling: state.effects.slow_falling, jumpBoost: state.effects.jump_boost, gliding: state.equipment.chestplate?.id === 'elytra' && (keys.has('Space') || state.gliding), boost: state.boost, flyingMount: !!mount && MOBS[mount.type].flyingMount });
  const { submerged, bubble } = result;
  if (result.fallDamage) damage(result.fallDamage * Math.max(.2, 1 - enchantLevel(state.equipment.boots, 'feather_falling') * .18));
  state.submerged = submerged;
  const drowning = updateBreath(state, submerged, bubble, dt); if (drowning) damage(drowning);
  state.dash = Math.max(0, (state.dash || 0) - dt); state.boost = Math.max(0, (state.boost || 0) - dt);
  p.y = Math.min(p.y, state.world.height + 20);
  if (mount?.type === 'strider' && p.vy <= 0 && world.get(Math.floor(p.x), Math.floor(p.y - .05), Math.floor(p.z)) === B.LAVA) { p.y = Math.floor(p.y - .05) + 1; p.vy = 0; p.grounded = true; }
  if (p.y < -5) respawn();
  p.yaw += (Number(keys.has('ArrowLeft')) - Number(keys.has('ArrowRight'))) * dt * 1.65;
  p.pitch = clamp(p.pitch + (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) * dt * 1.2, -1.53, 1.53);
  if (length && p.grounded) { footstepTime += dt; if (footstepTime > (sprint ? .28 : .43)) { tone('step'); footstepTime = 0; } }
  if (state.mode !== 'creative') {
    if (length) state.food = Math.max(0, state.food - dt * (sprint ? .035 : .012));
    if (mount?.type !== 'strider' && world.get(Math.floor(p.x), Math.floor(p.y + .2), Math.floor(p.z)) === B.LAVA) damage(dt * 4, 'fire');
    state.survivalTimer += dt;
    if (state.survivalTimer > 4) {
      state.survivalTimer = 0;
      if (state.food <= 0 && state.health > 2) damage(1);
      if (state.food >= 16 && state.health < 20) { state.health++; state.food -= .2; }
    }
  }
  if (mount) { mount.previousX = mount.x = p.x; mount.previousY = mount.y = p.y; mount.previousZ = mount.z = p.z; mount.yaw = p.yaw; mount.activity = length ? 'wander' : 'idle'; }
  if (state.vehicle) { state.vehicle.x = p.x; state.vehicle.y = p.y - .6; state.vehicle.z = p.z; state.vehicle.yaw = p.yaw; }
  return length > 0;
}

function mineUpdate(dt) {
  if (mineHeld && mobTarget) {
    mining = null;
    if (attackMob(state, mobTarget.mob, direction)) { swing = .7; tone('mine'); renderHotbar(); $('#save-status').textContent = 'Unsaved changes'; }
    return;
  }
  if (!mineHeld || !target) { mining = null; return; }
  const id = `${target.x},${target.y},${target.z}`;
  const info = miningInfo(target.id, state.inventory.slots[state.selected], state.mode === 'creative');
  if (!info.ok) { warn(info.reason); mining = null; return; }
  if (!mining || mining.id !== id) mining = { id, elapsed: 0, total: info.time * (state.effects.fatigue ? 2.5 : 1) };
  mining.elapsed += dt; swing = (swing + dt * 3) % 1;
  if (mining.elapsed < mining.total) return;
  const hit = { ...target }; const result = mineBlock(state.world, state.inventory, hit, state.selected, state.mode === 'creative');
  mining = null;
  if (!result.ok) return warn(result.reason);
  tone('mine'); view.debris(hit); state.xp += mendEquipment(state, result.xp); state.progress[result.drop] = true;
  if (hit.id === B.LEAVES && state.mode !== 'creative' && Math.random() < .16) state.inventory.add('apple', 1);
  if (hit.id === B.GRASS && state.mode !== 'creative' && state.mobs.roll() < .35) state.mobs.addDrop('seeds', 1, hit);
  if (hit.id === B.STONE && state.mode !== 'creative' && state.mobs.roll() < .15) state.mobs.addDrop('flint', 1, hit);
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
  const entity = state.mobs.raycast({ x: p.x, y: p.y + 1.62, z: p.z }, direction, state.mode === 'creative' ? 8 : 6)?.mob;
  const vehicleHit = state.mobs?.vehicleRaycast({ x: p.x, y: p.y + 1.62, z: p.z }, direction, state.mode === 'creative' ? 8 : 6)?.vehicle;
  if (vehicleHit) {
    const held = state.inventory.slots[state.selected], heldDef = ITEMS[held?.id];
    if (heldDef?.action === 'name') { vehicleHit.name = $('#name-input')?.value || vehicleHit.name; return; }
    if (state.vehicle?.uid === vehicleHit.uid) { state.vehicle = null; toast('Dismounted'); return; }
    if (heldDef?.action === 'mount_armor' || held?.id === 'saddle') { vehicleHit.equipment = held.id; if (state.mode !== 'creative') { held.count--; if (!held.count) state.inventory.slots[state.selected] = null; } toast('Vehicle equipped'); renderHotbar(); return; }
    if (vehicleHit.storage && keys.has('ShiftLeft')) { activeStation = null; activePortableStorage = vehicleHit.storage; setOverlay('station'); return; }
    if (vehicleHit.type === 'boat' || vehicleHit.type === 'cart') { state.vehicle = vehicleHit; Object.assign(p, { x: vehicleHit.x, y: vehicleHit.y + .7, z: vehicleHit.z, vy: 0 }); toast(`Riding ${ITEMS[vehicleHit.item]?.name || 'vehicle'}`); return; }
    if (vehicleHit.storage && keys.has('ShiftLeft')) { activeStation = null; activePortableStorage = vehicleHit.storage; setOverlay('station'); return; }
    return;
  }
  if (!entity && target && state.systems && (BLOCKS[target.id]?.station || BLOCKS[target.id]?.container) && !keys.has('ShiftLeft') && !keys.has('ShiftRight')) {
    const machine = state.systems.open(state.world.index(target.x, target.y, target.z), state);
    if (machine) { activeStation = state.world.index(target.x, target.y, target.z); activePortableStorage = null; setOverlay('station'); return; }
  }
  const action = useItem(state, target, direction, entity);
  if (action.handled) {
    if (action.result?.trade) { activeTrader = action.result.trade; setOverlay('trade'); }
    else if (action.panel === 'map') setOverlay('map');
    else if (action.panel === 'name') { activeNameMob = action.entity; setOverlay('name'); }
    else if (action.panel === 'bundle') { const item = state.inventory.slots[action.itemIndex]; item.contents ||= Array(9).fill(null); activePortableStorage = item.contents; activeStation = null; setOverlay('station'); }
    else if (action.panel === 'write' || action.panel === 'read') { bookItemIndex = action.itemIndex; bookReadOnly = action.panel === 'read'; setOverlay('book'); $('#book-text').value = state.inventory.slots[bookItemIndex]?.text || ''; $('#book-text').readOnly = bookReadOnly; $('#book-save').classList.toggle('hidden', bookReadOnly); }
    else if (action.panel === 'recipes') { setOverlay('inventory'); $('#recipe-book').open = true; }
    else if (action.panel === 'sign') { activeNameMob = action.block; setOverlay('name'); }
    else if (action.message || typeof action.result === 'string') toast(action.message || action.result);
    swing = .35; tone('place'); renderHotbar(); $('#save-status').textContent = 'Unsaved changes'; return;
  }
  const result = placeBlock(state.world, state.inventory, state.selected, target, state.player, state.mode === 'creative');
  if (!result.ok) return warn(result.reason);
  if (result.id === B.TABLE) { state.progress.placedTable = true; toast('Your workbench is ready. Right-click it or press E nearby.'); }
  swing = .35; tone('place'); renderHotbar(); $('#save-status').textContent = 'Unsaved changes';
}

function updateHud() {
  if (!state) return;
  const p = state.player, hours = (8.67 + state.elapsed / 60) % 24;
  $('#water-overlay').classList.toggle('underwater', !!state.submerged);
  $('#oxygen-meter').classList.toggle('active', !!state.submerged && state.mode !== 'creative');
  const air = Math.ceil(state.oxygen / 1.5);
  if ($('#oxygen-meter').dataset.air !== String(air)) { $('#oxygen-meter').dataset.air = String(air); $('#oxygen-meter').innerHTML = Array.from({ length: 10 }, (_, i) => '<i class="air-bubble' + (i < air ? ' full' : '') + '"></i>').join(''); }
  $('#oxygen-meter').setAttribute('aria-label', 'Air: ' + Math.ceil(state.oxygen) + ' seconds');
  $('#touch-fly').classList.toggle('hidden', state.mode !== 'creative');

  $('#world-title').textContent = `${state.world.seed} · ${state.world.dimension}`.toUpperCase();
  $('#coords-label').textContent = `X ${Math.floor(p.x)} · Y ${Math.floor(p.y)} · Z ${Math.floor(p.z)}`;
  $('#time-label').textContent = `DAY ${String(1 + Math.floor((8.67 + state.elapsed / 60) / 24)).padStart(2, '0')} · ${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.floor(hours % 1 * 60)).padStart(2, '0')}`;
  $('#health-value').textContent = Math.ceil(state.health); $('#food-value').textContent = Math.ceil(state.food);
  $('#health-bar').style.width = `${state.health * 5}%`; $('#food-bar').style.width = `${state.food * 5}%`;
  $('#level-value').textContent = state.mode === 'creative' ? '∞' : Math.floor(state.xp / 100) + 1;
  for (const [selector, value, symbol] of [['#heart-icons', state.health, 'heart'], ['#hunger-icons', state.food, 'food'], ['#armor-icons', defense(state), 'armor']]) {
    $(selector).innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="pixel-${symbol} ${value >= (i + 1) * 2 ? 'full' : value > i * 2 ? 'half' : 'empty'}"></i>`).join('');
    $(selector).setAttribute('aria-label', `${symbol}: ${Math.ceil(value)} of 20`);
  }
  $('#effect-list').textContent = Object.entries(state.effects).filter(([, time]) => time > 0).map(([key, time]) => `${key.replaceAll('_', ' ')} ${Math.ceil(time)}s`).join(' · ');
  $('#mob-count').textContent = `${state.mobs.mobs.length} mobs`;
  const boss = state.mobs.mobs.find(m => MOBS[m.type].boss && Math.hypot(m.x - p.x, m.z - p.z) < 40);
  $('#boss-bar').classList.toggle('hidden', !boss);
  if (boss) { $('#boss-name').textContent = MOBS[boss.type].name; $('#boss-health').style.width = `${boss.health / MOBS[boss.type].health * 100}%`; }
  $('#mode-label').textContent = p.flying ? 'FLYING' : state.mode === 'creative' ? 'CREATIVE' : 'EXPLORER'; $('#xp-bar').style.width = `${state.xp % 100}%`;
  const item = state.inventory.slots[state.selected]; const info = target ? miningInfo(target.id, item, state.mode === 'creative') : null;
  $('#target-label').textContent = mobTarget ? `${MOBS[mobTarget.mob.type].name} · ${Math.ceil(mobTarget.mob.health)} HP${mobTarget.mob.tamed ? ' · Tamed' : ''}` : target ? `${BLOCKS[target.id].name}${!info.ok ? ` · ${info.reason}` : ''}` : '';
  $('#target-label').classList.toggle('requires-tool', !mobTarget && !!target && !info.ok);
}

function processMobEvents() {
  for (const event of state.mobs.events.splice(0)) {
    if (event.type === 'damage') damage(event.amount, event.effect);
    if (event.type === 'xp') state.xp += mendEquipment(state, event.amount);
    if (event.type === 'inventory') renderHotbar();
    if (event.type === 'message') toast(event.message);
    if (event.type === 'blast') { const d = Math.hypot(state.player.x - event.x, state.player.y - event.y, state.player.z - event.z); if (d < event.radius + 1) damage(event.amount * (1 - d / (event.radius + 1)), event.effect); tone('mine'); }
    if (event.type === 'wind' && Math.hypot(state.player.x - event.x, state.player.z - event.z) < 3) state.player.vy = 9;
  }
  for (const event of state.systems?.events.splice(0) || []) {
    if (event.type === 'xp') state.xp += mendEquipment(state, event.amount);
    if (event.type === 'effect') applyEffect(state, event.effect, event.duration);
    if (event.type === 'note') tone('craft');
  }
}

function levelSnapshot() {
  return { worldVersion: state.world.version, edits: [...state.world.edits], blockStates: [...state.world.states], farEdits: [...(state.world.farEdits || [])], farBlockStates: [...(state.world.farStates || [])], systems: state.systems.serialize(), entities: state.mobs.serialize(), player: { x: state.player.x, y: state.player.y, z: state.player.z, yaw: state.player.yaw, pitch: state.player.pitch } };
}
async function switchDimension(dimension) {
  if (!state || state.transitioning || !DIMENSIONS.includes(dimension) || state.world.dimension === dimension) return;
  state.transitioning = true;
  const previous = state.world.dimension, saved = state.dimensions[dimension]; state.dimensions[previous] = levelSnapshot();
  $('#loading').classList.remove('hidden'); clearInput();
  await new Promise(resolve => requestAnimationFrame(resolve));
  try {
    const world = new World(state.world.seed, saved ? saved.worldVersion || 3 : 5, dimension, { streaming: true }).generate(); if (saved) { world.applyEdits(saved.edits); world.applyStates(saved.blockStates); world.applyFarEdits(saved.farEdits); world.applyFarStates(saved.farBlockStates); }
    state.world = world; state.player = { ...(saved?.player || world.spawn), yaw: saved?.player?.yaw ?? -.245, pitch: saved?.player?.pitch ?? -.015, vy: 0, grounded: false, flying: false };
    if (collides(world, state.player)) Object.assign(state.player, world.spawn);
    state.systems = new WorldSystems(world, saved?.systems); state.mobs = new MobSystem(world, saved?.entities); state.mobs.systems = state.systems; state.riding = null; state.vehicle = null; state.portalCooldown = 2;
    state.portalExitRequired = true;
    view.attach(world, state.player); view.mobSystem = state.mobs; renderHotbar(); updateHud(); setOverlay('play'); toast(`Entered ${dimension === 'overworld' ? 'the Overworld' : dimension === 'nether' ? 'the Nether' : 'the End'}`); saveWorld();
  } catch (error) { toast(`Could not enter ${dimension}: ${error.message}`); }
  finally { state.transitioning = false; $('#loading').classList.add('hidden'); }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.1, (now - (lastTime || now)) / 1000); lastTime = now;
  if (document.hidden) return;
  if (state && !['play', 'station'].includes(overlay) && overlay !== 'home' && !needsRender) return;
  if ((!state || overlay === 'home') && now - lastMenuFrame < 50) return;
  if (!state || overlay === 'home') lastMenuFrame = now;
  needsRender = false;
  let moving = false;
  if (state && overlay !== 'home') {
    if (overlay === 'play' && !state.transitioning) { state.elapsed += dt; state.portalCooldown = Math.max(0, (state.portalCooldown || 0) - dt); updateEffects(state, dt); for (let remaining = dt; remaining > .0001; remaining -= Math.min(remaining, 1 / 60)) moving = movePlayer(Math.min(remaining, 1 / 60)) || moving; state.moving = moving; state.fluidTimer = (state.fluidTimer || 0) + dt; if (state.fluidTimer > .12) { state.world.tickFluids(192, state.player); state.fluidTimer = 0; } state.mobs.update(dt, state); }
    if (overlay === 'play' || overlay === 'station') state.systems?.update(dt, state);
    processMobEvents(); if (overlay === 'play' && state.health <= 0) respawn();
    const p = state.player;
    const mount = state.mobs.mobs.find(m => m.uid === state.riding);
    view.camera.position.set(p.x, p.y + 1.62 + (mount ? MOBS[mount.type].height * .45 : 0), p.z); view.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    view.camera.getWorldDirection(direction); target = raycast(state.world, view.camera.position, direction, state.mode === 'creative' ? 8 : 6);
    mobTarget = state.mobs.raycast(view.camera.position, direction, state.mode === 'creative' ? 8 : 6);
    if (mobTarget?.mob.uid === state.riding) mobTarget = null;
    if (overlay === 'play') { mineUpdate(dt); updateSpear(state, dt, useHeld); }
    const progress = mining ? clamp(mining.elapsed / mining.total, 0, 1) : 0;
    view.target(overlay === 'play' && !mobTarget ? target : null, progress);
    $('#mine-progress').classList.toggle('active', progress > 0); $('#mine-progress i').style.width = `${progress * 100}%`;
    if (!mineHeld) swing = Math.max(0, swing - dt * 3);
    view.zoom = !!state.zoom; view.nightVision = !!state.effects.night_vision;
    view.update(overlay === 'play' ? dt : 0, (8.67 + state.elapsed / 60) % 24, p, { moving, swing });
    if (overlay === 'play' && state.portalCooldown <= 0) {
      const portal = state.world.get(Math.floor(p.x), Math.floor(p.y + .2), Math.floor(p.z));
      if (![B.NETHER_PORTAL, B.END_PORTAL].includes(portal)) state.portalExitRequired = false;
      if (!state.portalExitRequired && portal === B.NETHER_PORTAL) switchDimension(state.world.dimension === 'nether' ? 'overworld' : 'nether');
      if (!state.portalExitRequired && portal === B.END_PORTAL) switchDimension(state.world.dimension === 'end' ? 'overworld' : 'end');
    }
    uiTimer += dt; saveTimer += overlay === 'play' ? dt : 0;
    if (uiTimer > .12) { updateHud(); uiTimer = 0; }
    if (saveTimer > 20) { saveWorld(); saveTimer = 0; }
  } else {
    const angle = .59 + Math.sin(now * .000035) * .12;
    view.camera.position.set(menuCenter.x + Math.sin(angle) * 28, menuWorld.heightAt(menuCenter.x, menuCenter.z) + 12, menuCenter.z + Math.cos(angle) * 28);
    view.camera.lookAt(menuCenter.x - 7, menuWorld.heightAt(menuCenter.x - 7, menuCenter.z - 7) + 3, menuCenter.z - 7); view.target(null, 0);
    view.update(dt, 9.4, menuCenter, { menu: true });
  }
}

$('#play-btn').onclick = () => { tone('click'); enterWorld(); };
$('#continue-btn').onclick = () => { try { enterWorld(decodeSave(localStorage.getItem(SAVE_PREFIX + $('#world-select').value))); } catch (error) { toast(error.message); } };
$('#random-seed').onclick = () => {
  const values = new Uint32Array(2); if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(values); else { values[0] = Math.random() * 0xffffffff; values[1] = Math.random() * 0xffffffff; }
  $('#seed-input').value = String((BigInt(values[0]) << 32n | BigInt(values[1])) % 1000000000000n);
};
document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => { selectedMode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', b === button); }); });
$('#pause-btn').onclick = () => setOverlay('pause');
$('#resume-btn').onclick = () => { setOverlay('play'); capture(); };
$('#save-btn').onclick = () => saveWorld(true);
$('#leave-btn').onclick = () => { if (!saveWorld(true)) return; setOverlay('home'); refreshSaves(); };
$('#respawn-btn').onclick = () => { respawn(); setOverlay('play'); capture(); };
$('#sound-btn').onclick = () => { soundEnabled = !soundEnabled; $('#sound-btn span').textContent = soundEnabled ? 'ON' : 'OFF'; };
$('#hide-quest').onclick = () => $('#quest').classList.add('hidden');
$('#home-help').onclick = () => { quickHelpReturn = 'home'; setOverlay('quick-help'); };
$('#help-btn').onclick = () => { helpReturn = 'pause'; setOverlay('help'); };
$('#close-help').onclick = () => setOverlay(helpReturn);
function showHelpControls(mobile) {
  $('#pc-controls').classList.toggle('hidden', mobile); $('#touch-guide').classList.toggle('hidden', !mobile);
  $('#help-pc').classList.toggle('selected', !mobile); $('#help-touch').classList.toggle('selected', mobile);
}
$('#quick-help-btn').onclick = () => { quickHelpReturn = 'play'; setOverlay('quick-help'); };
$('#close-quick-help').onclick = () => setOverlay(quickHelpReturn);
$('#help-pc').onclick = () => showHelpControls(false);
$('#help-touch').onclick = () => showHelpControls(true);
$('#help-journal').onclick = () => { helpReturn = 'quick-help'; setOverlay('help'); };
$('#close-book').onclick = () => setOverlay('play');
$('#book-save').onclick = () => { const item = state.inventory.slots[bookItemIndex]; if (item && !bookReadOnly) { item.text = $('#book-text').value.slice(0, 8000); saveWorld(); toast('Pages saved'); } };
$('#touch-fly').onclick = () => { if (state?.mode === 'creative') { state.player.flying = !state.player.flying; state.player.vy = 0; updateHud(); } };

$('#close-inventory').onclick = () => { setOverlay('play'); saveWorld(); capture(); };
$('#craft-button').onclick = craft;
$('#item-search').oninput = () => { palettePage = 0; renderPalette(); };
$('#recipe-search').oninput = () => { recipePage = 0; renderInventory(); };
$('#recipe-prev').onclick = () => { recipePage--; renderInventory(); };
$('#recipe-next').onclick = () => { recipePage++; renderInventory(); };
$('#palette-prev').onclick = () => { palettePage--; renderPalette(); };
$('#palette-next').onclick = () => { palettePage++; renderPalette(); };
for (const button of document.querySelectorAll('[data-category]')) button.onclick = () => { paletteCategory = button.dataset.category; palettePage = 0; document.querySelectorAll('[data-category]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-selected', b === button); }); renderPalette(); };
$('#equip-item').onclick = () => { if (carriedSlot !== null) equip(state, carriedSlot); carriedSlot = null; renderInventory(); renderHotbar(); };
$('#drop-item').onclick = () => { if (carriedSlot === null) return; if (!dropStack(state, carriedSlot)) toast('No room for more ground items'); carriedSlot = null; renderInventory(); renderHotbar(); };
$('#close-trade').onclick = () => { setOverlay('play'); saveWorld(); capture(); };
$('#settings-btn').onclick = () => { settingsReturn = 'pause'; setOverlay('settings'); };
$('#home-options').onclick = () => { settingsReturn = 'home'; setOverlay('settings'); };
$('#close-settings').onclick = () => setOverlay(settingsReturn);
$('#settings-done').onclick = () => { applySettings(); setOverlay(settingsReturn); };
for (const id of ['render-distance', 'fov', 'touch-sensitivity', 'control-scale']) $(`#${id}`).oninput = updateSettingOutputs;
$('#close-station').onclick = () => { setOverlay('play'); saveWorld(); capture(); };
$('#station-process').onclick = () => {
  if (activeStation === null) return;
  const result = state.systems.operate(activeStation, state, { recipe: $('#station-recipe').value, enchantment: $('#station-recipe').value, name: $('#station-name-input').value });
  if (!result.ok) toast(result.reason); else { tone('craft'); $('#station-name-input').value = ''; renderStation(); renderHotbar(); saveWorld(); }
};
$('#close-map').onclick = () => { setOverlay('play'); capture(); };
for (const button of document.querySelectorAll('#dimension-buttons button')) button.onclick = () => switchDimension(button.dataset.dimension);
$('#close-name').onclick = () => { activeNameMob = null; setOverlay('play'); capture(); };
$('#name-apply').onclick = () => {
  const value = $('#name-input').value.trim().slice(0, 40);
  if (!value) return toast('Enter a name');
  if (typeof activeNameMob === 'number') {
    const mob = state.mobs.mobs.find(m => m.uid === activeNameMob); if (mob) mob.customName = value;
  } else if (activeNameMob && Number.isFinite(activeNameMob.x)) state.world.setState(activeNameMob.x, activeNameMob.y, activeNameMob.z, { text: value });
  activeNameMob = null; setOverlay('play'); renderHotbar(); saveWorld(); toast(`Named ${value}`); capture();
};

window.addEventListener('keydown', e => {
  if ((e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) && e.code !== 'Escape' && e.code !== 'Tab') return;
  // Keep keyboard focus in the currently open dialog.
  if (e.code === 'Tab' && ['inventory', 'pause', 'help', 'trade', 'settings', 'station', 'map', 'name', 'quick-help', 'book'].includes(overlay)) {
    const controls = [...$(`#${overlay}-modal`).querySelectorAll('button:not(:disabled), select, input')].filter(el => el.getClientRects().length);
    const index = controls.indexOf(document.activeElement), next = e.shiftKey ? (index - 1 + controls.length) % controls.length : (index + 1) % controls.length;
    e.preventDefault(); controls[next]?.focus(); return;
  }
  if (e.code === 'Slash' && e.shiftKey || e.code === 'F1') { e.preventDefault(); quickHelpReturn = overlay; setOverlay('quick-help'); return; }
  if (e.code === 'Escape') {
    e.preventDefault(); if (e.repeat) return;
    if (overlay === 'quick-help') setOverlay(quickHelpReturn); else if (overlay === 'book') setOverlay('play'); else if (overlay === 'help') setOverlay(helpReturn); else if (overlay === 'inventory' || overlay === 'trade' || overlay === 'station' || overlay === 'map' || overlay === 'name') setOverlay('play'); else if (overlay === 'settings') setOverlay(settingsReturn); else if (overlay === 'pause') setOverlay('play'); else if (overlay === 'play') setOverlay('pause'); return;
  }
  if (overlay === 'station' && e.code === 'KeyE' && !e.repeat) { e.preventDefault(); setOverlay('play'); saveWorld(); capture(); return; }
  if (!state || overlay === 'home' || ['help', 'pause', 'settings', 'station', 'map', 'name', 'quick-help', 'book'].includes(overlay)) return;
  if (e.code === 'KeyE' && !e.repeat) { e.preventDefault(); if (overlay === 'play') setOverlay('inventory'); else { setOverlay('play'); saveWorld(); capture(); } return; }
  if (/^Digit[1-9]$/.test(e.code)) {
    e.preventDefault(); const index = Number(e.code.slice(-1)) - 1;
    if (overlay === 'inventory' && carriedSlot !== null) { transferSlot(slotArray(carriedSource), carriedSlot, state.inventory.slots, index); clearCarry(); renderInventory(); }
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
  if (e.button === 2) { useHeld = true; interact(); }
});
window.addEventListener('pointermove', e => {
  if (overlay !== 'play') return;
  const locked = document.pointerLockElement === canvas;
  if (!locked && (!pointerDrag || pointerDrag.id !== e.pointerId)) return;
  const dx = locked ? e.movementX : e.clientX - pointerDrag.x, dy = locked ? e.movementY : e.clientY - pointerDrag.y;
  const sensitivity = .0028 * (e.pointerType === 'touch' ? settings.touchSensitivity : 1);
  state.player.yaw -= dx * sensitivity; state.player.pitch = clamp(state.player.pitch - dy * sensitivity, -1.53, 1.53);
  if (pointerDrag) { pointerDrag.x = e.clientX; pointerDrag.y = e.clientY; }
});
window.addEventListener('pointerup', e => { if (e.button === 2) useHeld = false; if (e.pointerType !== 'touch' && e.button === 0) mineHeld = false; if (pointerDrag?.id === e.pointerId) pointerDrag = null; });
window.addEventListener('pointercancel', e => { useHeld = false; if (e.pointerType !== 'touch') mineHeld = false; if (pointerDrag?.id === e.pointerId) pointerDrag = null; });
canvas.addEventListener('wheel', e => { if (overlay === 'play') { e.preventDefault(); selectSlot((state.selected + (e.deltaY > 0 ? 1 : 8)) % 9); } }, { passive: false });
for (const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(button.dataset.key); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(button.dataset.key));
}
const joystick = $('#touch-joystick'), stick = $('#touch-stick');
if (joystick && stick) {
  let joystickPointer = null;
  const releaseJoystick = () => { joystickPointer = null; touchMove.forward = touchMove.side = 0; stick.style.transform = 'translate(-50%, -50%)'; };
  const moveJoystick = event => {
    if (joystickPointer !== event.pointerId) return;
    const r = joystick.getBoundingClientRect(), max = r.width * .34, dx = event.clientX - (r.left + r.width / 2), dy = event.clientY - (r.top + r.height / 2);
    const length = Math.hypot(dx, dy), scale = length > max ? max / length : 1, x = dx * scale, y = dy * scale;
    stick.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    const strength = Math.max(0, Math.min(1, length / max) - .12) / .88;
    touchMove.forward = length ? -dy / length * strength : 0; touchMove.side = length ? dx / length * strength : 0;
  };
  joystick.addEventListener('pointerdown', event => { event.preventDefault(); joystickPointer = event.pointerId; joystick.setPointerCapture(event.pointerId); moveJoystick(event); });
  joystick.addEventListener('pointermove', moveJoystick);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) joystick.addEventListener(event, releaseJoystick);
}
$('#touch-mine').addEventListener('pointerdown', e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); mineHeld = true; });
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#touch-mine').addEventListener(event, () => mineHeld = false);
$('#touch-place').onclick = interact; $('#touch-inventory').onclick = () => setOverlay('inventory');
window.addEventListener('resize', () => { view.resize(); needsRender = true; });
window.addEventListener('pagehide', () => saveWorld());
window.addEventListener('beforeunload', () => saveWorld());

const menuCenter = { x: 62, y: 64, z: 57 };
const menuWorld = new World('240913', 5).generate();
view.attach(menuWorld, menuCenter); view.mobSystem = null;
$('#bestiary-list').innerHTML = MOB_LIST.map(m => `<article><div>${icon(`${m.id}_spawn_egg`)}</div><strong>${m.name}</strong><span>${m.health} HP · ${m.habitat}</span><small>${m.drops.map(d => ITEMS[d.id].name).join(', ') || 'No item drops'}</small></article>`).join('');
createIcons({ icons });
refreshSaves(); requestAnimationFrame(frame);
