import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { B, freshItem } from '../src/catalog.js';
import { Inventory } from '../src/inventory.js';
import { encodeSave } from '../src/save.js';
import { makePortal } from '../src/regions.js';

const url = process.env.BLOCKBOUND_URL || 'http://127.0.0.1:5173/';
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
const errors = [];
let activePage;
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
function fixture(kind, mode = 'survival') {
  const world = new World('240913', 4).generate(), inventory = new Inventory();
  for (const [id, count] of [['iron_pick', 1], ['log', 3], ['planks', 3], ['stick', 2], ['torch', 8], ['bucket', 1], ['water_bucket', 1]]) inventory.add(id, count);
  inventory.slots[0] = { ...freshItem('iron_pick'), durability: 42, name: 'Test pick' };
  let player = { x: 48.5, y: 23, z: 48.5, yaw: 0, pitch: -.25 };
  if (kind === 'craft') world.set(48, 23, 45, B.TABLE);
  if (kind === 'boundary') {
    for (let x = 88; x < 118; x++) for (let z = 36; z <= 44; z++) { world.set(x, 30, z, B.STONE); for (let y = 31; y < 36; y++) world.set(x, y, z, B.AIR); }
    player = { x: 94.5, y: 31, z: 40.5, yaw: -Math.PI / 2, pitch: 0 };
  }
  if (kind === 'water') {
    for (let x = 45; x <= 52; x++) for (let z = 44; z <= 53; z++) for (let y = 20; y <= 28; y++) world.set(x, y, z, x === 45 || x === 52 || z === 44 || z === 53 || y === 20 ? B.STONE : y < 28 ? B.WATER : B.AIR);
    player = { x: 48.5, y: 22, z: 49.5, yaw: 0, pitch: 0 };
  }
  if (kind === 'portal') {
    makePortal(world, 47, 23, 45);
    // Record the frame as edits, as a player-built portal would be saved.
    for (let x = 47; x <= 50; x++) for (let y = 23; y <= 27; y++) world.set(x, y, 45, world.get(x, y, 45));
    player = { x: 48.5, y: 24, z: 48.5, yaw: 0, pitch: 0 };
    for (let z = 45; z <= 50; z++) world.set(48, 23, z, B.OBSIDIAN);
  }
  return encodeSave({ id: kind, world, player, inventory, mode, selected: 0, health: 20, food: 20, xp: 0, elapsed: 0, equipment: {}, effects: {}, progress: {}, mobs: { serialize: () => ({ mobs: [], drops: [], crops: [], spawnedStructures: world.structures.flatMap(s => (s.spawns || []).map((_, i) => `${s.key || s.id}:${i}`)) }) } });
}
async function open(kind, { mobile = false, mode = 'survival' } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(({ text, id }) => {
    HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new DOMException('Test fallback', 'NotAllowedError'));
    if (!localStorage.getItem(`blockbound.world.v1.${id}`)) localStorage.setItem(`blockbound.world.v1.${id}`, text);
  }, { text: fixture(kind, mode), id: kind });
  const page = await context.newPage(); activePage = page; page.setDefaultTimeout(25000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(url, { waitUntil: 'networkidle' }); await page.locator('#continue-btn').click(); await page.locator('#loading').waitFor({ state: 'hidden' });
  return page;
}
async function snapshot(page, id) {
  await page.locator('#pause-btn').click();
  return page.evaluate(id => JSON.parse(localStorage.getItem(`blockbound.world.v1.${id}`)), id);
}
async function canvasCheck(page) {
  const result = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.querySelector('#game-canvas'), gl = canvas.getContext('webgl2'), colors = new Set(), sample = new Uint8Array(4);
    for (let x = 1; x < 16; x++) for (let y = 1; y < 12; y++) { gl.readPixels(Math.floor(canvas.width * x / 16), Math.floor(canvas.height * y / 12), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample); colors.add(sample.slice(0, 3).join(',')); }
    resolve(colors.size);
  })));
  assert.ok(result > 25, `Blank or untextured canvas: ${result} colors`);
}
async function fits(page, selector) {
  const failures = await page.locator(selector).evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > innerWidth + 1 || r.top < 0 || r.bottom > innerHeight + 1 || el.scrollWidth > el.clientWidth + 2); }).map(el => el.id || el.className));
  assert.deepEqual(failures, [], `Layout overflow: ${failures}`);
}
try {
  if (!only || only === 'craft') {
  const page = await open('craft');
  await canvasCheck(page);
  await page.keyboard.press('e');
  await page.locator('#inventory-grid button').nth(1).dragTo(page.locator('#manual-grid button').nth(0));
  await page.locator('#manual-output').click();
  await page.locator('#inventory-grid button').nth(0).dragTo(page.locator('#manual-grid button').nth(3));
  await page.locator('#manual-grid button').nth(3).dragTo(page.locator('#inventory-grid button').nth(9));
  await page.screenshot({ path: 'artifacts/manual-crafting-desktop.png' });
  await page.locator('#close-inventory').click();
  const first = await snapshot(page, 'craft');
  assert.equal(first.inventory[9].durability, 42); assert.equal(first.inventory[9].name, 'Test pick');
  assert.equal(first.inventory.filter(s => s?.id === 'log').reduce((n, s) => n + s.count, 0), 2);
  assert.equal(first.inventory.filter(s => s?.id === 'planks').reduce((n, s) => n + s.count, 0), 7);
  await page.locator('#resume-btn').click();
  await page.locator('#target-label').filter({ hasText: 'Crafting table' }).waitFor();
  await page.mouse.click(640, 400, { button: 'right' });
  await page.locator('#station-modal').waitFor({ state: 'visible' });
  await page.locator('#station-inventory button').nth(2).click();
  for (const i of [0, 1, 2]) await page.locator('#station-grid button').nth(i).click();
  await page.locator('#station-inventory button').nth(2).click();
  await page.locator('#station-inventory button').nth(3).click();
  for (const i of [4, 7]) await page.locator('#station-grid button').nth(i).click();
  await page.screenshot({ path: 'artifacts/manual-workbench-desktop.png' });
  await page.locator('#station-output').click();
  const logSlot = page.locator('#station-inventory button[aria-label*="Oak log"]');
  await logSlot.dragTo(page.locator('#station-grid button').nth(3));
  await page.locator('#close-station').click();
  const tableSave = await snapshot(page, 'craft');
  assert.ok(tableSave.inventory.some(s => s?.id === 'wood_pick' && s.durability > 0));
  assert.ok(tableSave.systems.machines.some(([, m]) => m.slots[3]?.id === 'log' && m.slots[3].count === 2));
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#continue-btn').click(); await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('#target-label').filter({ hasText: 'Crafting table' }).waitFor(); await page.mouse.click(640, 400, { button: 'right' });
  await page.locator('#station-grid button[aria-label*="Oak log"]').waitFor();
  console.log('Desktop exact-slot dragging, manual 2x2/3x3 crafting, metadata and table persistence passed');
  await page.context().close();
  }

  if (!only || only === 'boundary') {
  const boundary = await open('boundary', { mode: 'creative' });
  await boundary.keyboard.down('w');
  await boundary.waitForFunction(() => Number(document.querySelector('#coords-label').textContent.match(/X (-?\d+)/)[1]) >= 104);
  await boundary.keyboard.up('w');
  await boundary.keyboard.down('ArrowDown');
  await boundary.locator('#target-label').filter({ hasText: 'Stone' }).waitFor(); await boundary.keyboard.up('ArrowDown');
  await boundary.keyboard.press('5'); await boundary.mouse.click(640, 400, { button: 'right' });
  await boundary.locator('#target-label').filter({ hasText: 'Torch' }).waitFor();
  await boundary.screenshot({ path: 'artifacts/streamed-torch.png' }); await canvasCheck(boundary);
  const crossed = await snapshot(boundary, 'boundary'); assert.ok(crossed.player.x > 100); assert.ok(crossed.farEdits.some(([, id]) => id === B.TORCH));
  await boundary.reload({ waitUntil: 'networkidle' }); await boundary.locator('#continue-btn').click(); await boundary.locator('#loading').waitFor({ state: 'hidden' });
  const again = await snapshot(boundary, 'boundary'); assert.ok(again.player.x > 100); assert.ok(again.farEdits.some(([, id]) => id === B.TORCH));
  console.log('Walking past the old border, rendered torches and far-edit reload passed');
  await boundary.context().close();
  }

  if (!only || only === 'mobile') {
  const phone = await open('craft', { mobile: true });
  await phone.locator('#touch-inventory').tap();
  await phone.locator('#inventory-grid button').nth(1).tap(); await phone.locator('#manual-grid button').nth(0).tap(); await phone.locator('#manual-output').tap();
  await fits(phone, '#manual-grid, #inventory-grid, #close-inventory, .equipment-row');
  await phone.screenshot({ path: 'artifacts/manual-crafting-mobile.png' });
  await phone.locator('#close-inventory').tap(); await phone.locator('#touch-place').tap(); await phone.locator('#station-modal').waitFor({ state: 'visible' });
  await phone.locator('#station-inventory button').nth(2).tap();
  for (const i of [0, 1, 2]) await phone.locator('#station-grid button').nth(i).tap();
  await phone.locator('#station-inventory button').nth(2).tap(); await phone.locator('#station-inventory button').nth(3).tap();
  for (const i of [4, 7]) await phone.locator('#station-grid button').nth(i).tap();
  await fits(phone, '#station-grid, #station-inventory, #station-output');
  await phone.screenshot({ path: 'artifacts/manual-workbench-mobile.png' }); await phone.locator('#station-output').tap();
  await phone.setViewportSize({ width: 844, height: 390 }); await fits(phone, '#station-grid, #station-inventory, #station-output');
  await phone.screenshot({ path: 'artifacts/manual-workbench-landscape.png' });
  await phone.locator('#close-station').tap(); await fits(phone, '#touch-joystick, .touch-actions, #hotbar');
  await phone.screenshot({ path: 'artifacts/controls-landscape.png' });
  console.log('Mobile tap crafting, table output and portrait/landscape layouts passed');
  await phone.context().close();
  }

  if (!only || only === 'water') {
  const water = await open('water', { mobile: true });
  await water.locator('#water-overlay.underwater').waitFor(); await water.locator('#oxygen-meter.active').waitFor();
  await water.waitForFunction(() => document.querySelectorAll('.air-bubble.full').length < 10);
  await water.screenshot({ path: 'artifacts/underwater-mobile.png' });
  const jump = await water.getByRole('button', { name: 'Jump', exact: true }).boundingBox();
  await water.mouse.move(jump.x + jump.width / 2, jump.y + jump.height / 2); await water.mouse.down();
  await water.waitForFunction(() => !document.querySelector('#water-overlay').classList.contains('underwater')); await water.mouse.up();
  await canvasCheck(water);
  console.log('Submersion, depleting air bubbles and swim-to-surface touch control passed');
  await water.context().close();
  }

  if (!only || only === 'portal') {
  const portal = await open('portal', { mode: 'creative' });
  await portal.keyboard.down('w'); await portal.waitForFunction(() => document.querySelector('#world-title').textContent.toLowerCase().includes('nether')); await portal.keyboard.up('w');
  await portal.locator('#loading').waitFor({ state: 'hidden' }); await canvasCheck(portal); await portal.screenshot({ path: 'artifacts/nether-streamed.png' });
  const nether = await snapshot(portal, 'portal'); assert.equal(nether.dimension, 'nether'); assert.equal(nether.worldVersion, 4); assert.equal(nether.dimensions.overworld.worldVersion, 4);
  assert.ok(nether.entities.mobs.every(m => !['cow', 'sheep', 'villager'].includes(m.type)));
  await portal.reload({ waitUntil: 'networkidle' }); await portal.locator('#continue-btn').click(); await portal.locator('#loading').waitFor({ state: 'hidden' });
  const netherReload = await snapshot(portal, 'portal'); assert.equal(netherReload.dimension, 'nether'); assert.equal(netherReload.worldVersion, 4);
  await portal.locator('#resume-btn').click();
  await portal.mouse.move(640, 400); await portal.mouse.down();
  await portal.mouse.move(640 + netherReload.player.yaw / .0028, 400 + netherReload.player.pitch / .0028, { steps: 4 }); await portal.mouse.up();
  await portal.keyboard.down('w'); await portal.waitForFunction(() => document.querySelector('#world-title').textContent.toLowerCase().includes('overworld')); await portal.keyboard.up('w');
  await portal.locator('#loading').waitFor({ state: 'hidden' });
  const returned = await snapshot(portal, 'portal'); assert.equal(returned.dimension, 'overworld'); assert.equal(returned.dimensions.nether.worldVersion, 4);
  console.log('Player-built portal, Nether rendering, dimension spawns and dimension save reload passed');
  }
  assert.deepEqual(errors, [], 'No browser runtime or asset errors'); console.log('INTERACTION SMOKE TEST PASSED');
} catch (error) {
  if (activePage && !activePage.isClosed()) {
    console.log('Failure state:', await activePage.evaluate(() => ({ title: document.querySelector('#world-title')?.textContent, coordinates: document.querySelector('#coords-label')?.textContent, toast: document.querySelector('#toast')?.textContent, loading: !document.querySelector('#loading')?.classList.contains('hidden') })));
    await activePage.screenshot({ path: 'artifacts/interaction-failure.png' });
  }
  throw error;
} finally {
  console.log('Browser errors:', errors);
  await browser.close();
}
