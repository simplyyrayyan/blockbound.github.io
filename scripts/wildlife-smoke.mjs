import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { World } from '../src/world.js';
import { Inventory } from '../src/inventory.js';
import { MobSystem } from '../src/mobs.js';
import { encodeSave } from '../src/save.js';
import { MOBS } from '../src/mob-catalog.js';

const url = process.env.BLOCKBOUND_URL || 'http://127.0.0.1:5173/';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
let page;
function makeSave(type = 'cow', mode = 'survival', items = [['diamond_sword', 1]]) {
  const world = new World('cedar-valley').generate(), inventory = new Inventory(), mobs = new MobSystem(world, { mobs: [] });
  for (const [id, count] of items) inventory.add(id, count);
  const result = mobs.spawn(type, { x: 48.5, y: 23, z: 49.2 }); assert.ok(result.ok);
  result.mob.yaw = Math.PI; result.mob.sitting = true;
  return encodeSave({ id: 'wildlife-test', world, inventory, mobs, mode, player: { x: 48.5, y: 23, z: 52.5, yaw: 0, pitch: -.23 }, selected: 0, health: 20, food: 20, xp: 0, elapsed: 0, progress: {}, equipment: {}, effects: {} });
}
async function installSave(save) {
  if (!page.url().startsWith(url)) await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(save => { localStorage.clear(); localStorage.setItem('blockbound.world.v1.wildlife-test', save); localStorage.setItem('blockbound.last-world', 'wildlife-test'); }, save);
  // Avoid pagehide from the previous world overwriting the test fixture.
  await page.goto('about:blank');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(save => { localStorage.clear(); localStorage.setItem('blockbound.world.v1.wildlife-test', save); localStorage.setItem('blockbound.last-world', 'wildlife-test'); }, save);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#continue-btn').click(); await page.locator('#loading').waitFor({ state: 'hidden' });
}
async function saved() {
  await page.locator('#pause-btn').click();
  return page.evaluate(() => JSON.parse(localStorage.getItem('blockbound.world.v1.wildlife-test')));
}
async function pixels() {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.querySelector('#game-canvas'), gl = canvas.getContext('webgl2');
    const sample = new Uint8Array(4), colors = new Set(); let sum = 0;
    for (let x = 1; x < 18; x++) for (let y = 1; y < 14; y++) { gl.readPixels(Math.floor(canvas.width * x / 18), Math.floor(canvas.height * y / 14), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, sample); colors.add(sample.slice(0, 3).join(',')); sum += sample[0] + sample[1] + sample[2]; }
    resolve({ colors: colors.size, sum });
  })));
}
async function fitCheck(selector) {
  const failures = await page.locator(selector).evaluateAll(elements => elements.filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1 || el.scrollWidth > el.clientWidth + 2); }).map(el => el.id || el.className));
  assert.deepEqual(failures, [], `Overflow: ${failures}`);
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new DOMException('Fallback test', 'NotAllowedError')); });
  page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await installSave(makeSave());
  await page.locator('#target-label').filter({ hasText: 'Cow' }).waitFor();
  const canvasPixels = await pixels(); assert.ok(canvasPixels.colors > 30 && canvasPixels.sum > 1000, JSON.stringify(canvasPixels));
  await page.screenshot({ path: 'artifacts/wildlife-combat.png', timeout: 60000 });
  await page.mouse.move(720, 480); await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('#mob-count').textContent === '0 mobs'); await page.mouse.up();
  await page.keyboard.down('w'); await page.waitForFunction(() => [...document.querySelectorAll('#hotbar button')].some(b => b.getAttribute('aria-label').includes('Raw beef'))); await page.keyboard.up('w');
  const killed = await saved(); assert.ok(killed.inventory.some(i => i?.id === 'raw_beef')); assert.equal(killed.entities.mobs.length, 0);
  console.log('Visible mob targeting, weapon damage, death, loot pickup and persistence passed', canvasPixels);

  await installSave(makeSave('villager', 'survival', [['emerald', 10]]));
  await page.locator('#target-label').filter({ hasText: 'Villager' }).waitFor();
  await page.mouse.click(720, 480, { button: 'right' }); await page.locator('#trade-modal').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '4 Emerald for 1 Saddle', exact: true }).click();
  assert.equal(await page.locator('#trade-balance').innerText(), '6 emeralds');
  await page.screenshot({ path: 'artifacts/wildlife-trading.png', timeout: 60000 });
  await page.locator('#close-trade').click(); const traded = await saved(); assert.ok(traded.inventory.some(i => i?.id === 'saddle'));
  console.log('Trading UI and inventory exchange passed');

  await installSave(makeSave('horse', 'creative', [['saddle', 1]]));
  await page.locator('#target-label').filter({ hasText: 'Horse' }).waitFor();
  await page.mouse.click(720, 480, { button: 'right' });
  await page.locator('#toast').filter({ hasText: 'Saddle equipped' }).waitFor();
  await page.mouse.click(720, 480, { button: 'right' });
  await page.locator('#toast').filter({ hasText: 'Riding Horse' }).waitFor();
  await page.keyboard.down('w'); await page.waitForFunction(() => Number(document.querySelector('#coords-label').textContent.match(/Z (\d+)/)[1]) < 48); await page.keyboard.up('w');
  await page.mouse.click(720, 480, { button: 'right' }); await page.locator('#toast').filter({ hasText: 'Dismounted' }).waitFor();
  const ridden = await saved(); assert.ok(ridden.entities.mobs[0].saddled); assert.ok(ridden.entities.mobs[0].z < 48);
  console.log('Saddling, riding movement, dismounting and mount persistence passed');

  await installSave(makeSave('sheep', 'creative', [['diamond_sword', 1]]));
  await page.keyboard.press('e');
  await page.getByRole('tab', { name: 'Mobs', exact: true }).click();
  const mobCount = await page.evaluate(async () => (await import('/src/mob-catalog.js')).MOB_LIST.length);
  assert.equal(await page.locator('#palette-count').innerText(), `${mobCount} items`); assert.equal(await page.locator('#palette-grid button').count(), 45);
  await page.locator('#palette-next').click(); assert.equal(await page.locator('#palette-grid button').count(), mobCount - 45);
  await page.locator('#item-search').fill('Zombified Piglin'); assert.equal(await page.locator('#palette-grid button').count(), 1);
  await page.locator('#item-search').fill('creeper');
  await page.getByRole('button', { name: 'Add Creeper spawn egg', exact: true }).click({ modifiers: ['Shift'] });
  await page.screenshot({ path: 'artifacts/wildlife-catalog.png', timeout: 60000 });
  await fitCheck('.inventory-window, .inventory-header, .inventory-column, .craft-column, #palette-grid, .recipe-heading, #craft-button');
  await page.locator('#close-inventory').click();
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(400); await page.keyboard.up('ArrowDown');
  await page.mouse.click(720, 480, { button: 'right' });
  await page.locator('#toast').filter({ hasText: 'Creeper spawned' }).waitFor();
  const creativeSave = await saved(); assert.ok(creativeSave.entities.mobs.some(m => m.type === 'creeper')); assert.ok(creativeSave.inventory.some(i => i?.id === 'creeper_spawn_egg'));
  console.log(`All ${mobCount} spawn eggs, search, pagination and actual Creative spawning passed`);

  // Separate screenshots inspect every model family without adding a debug API to the game.
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { MobRenderer, mobParts } = await import('/src/mob-models.js'); const { MOB_LIST } = await import('/src/mob-catalog.js');
    const canvas = document.createElement('canvas'); canvas.id = 'model-gallery'; canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:1000'; document.body.append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true }); renderer.setSize(innerWidth, innerHeight);
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#aabfc7'); scene.add(new THREE.HemisphereLight('#ffffff', '#67776a', 2.6)); const sun = new THREE.DirectionalLight('#fff4e3', 2); sun.position.set(-6, 20, 12); scene.add(sun);
    const halfHeight = 13 * innerHeight / innerWidth;
    const camera = new THREE.OrthographicCamera(-13, 13, halfHeight, -halfHeight, .1, 100); camera.position.set(10, 25, 42); camera.lookAt(10, 0, 8);
    const models = new MobRenderer(scene), plane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshLambertMaterial({ color: '#a6b49a' })); plane.rotation.x = -Math.PI / 2; plane.position.y = -.04; scene.add(plane);
    const labels = document.createElement('div'); labels.style.cssText = 'position:fixed;inset:0;z-index:1001;pointer-events:none'; document.body.append(labels);
    window.galleryFrame = (start, t) => {
      const defs = MOB_LIST.slice(start, start + 20), mobs = defs.map((d, i) => {
        const parts = mobParts(d.id), extent = Math.max(...parts.map(p => Math.max(Math.abs(p.x) + p.w / 2, Math.abs(p.z) + p.l / 2) * 2), d.height);
        return { uid: i + 1, type: d.id, x: i % 5 * 4.5 + 1, y: d.movement === 'fly' ? .4 : 0, z: Math.floor(i / 5) * 4.8, yaw: Math.PI + .35, scale: 2.4 / extent, activity: 'wander' };
      });
      models.render({ mobs, projectiles: [], drops: [], crops: [] }, { x: 10, z: 8 }, t); renderer.render(scene, camera);
      labels.innerHTML = mobs.map((m, i) => { const p = new THREE.Vector3(m.x, -.12, m.z + 1.15).project(camera); return `<span style="position:absolute;left:${(p.x + 1) * innerWidth / 2}px;top:${(1 - p.y) * innerHeight / 2}px;transform:translateX(-50%);font:15px monospace;color:#283b31;text-shadow:1px 1px #e6eee0">${defs[i].name}</span>`; }).join('');
      const gl = renderer.getContext(), data = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4); gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, data); return { boxes: models.mesh.count, checksum: data.reduce((a, b, i) => (a + b * (i % 71)) % 1000000007, 0), calls: renderer.info.render.calls };
    };
  });
  for (let batch = 0; batch < 4; batch++) {
    const result = await page.evaluate(batch => window.galleryFrame(batch * 20, 1), batch);
    assert.ok(result.boxes > 200); assert.ok(result.calls <= 3, 'Models should use a shared instanced draw');
    await page.screenshot({ path: `artifacts/mob-gallery-${batch + 1}.png`, timeout: 60000 });
    console.log(`Model batch ${batch + 1}:`, result);
  }
  const one = await page.evaluate(() => window.galleryFrame(0, 1)); const two = await page.evaluate(() => window.galleryFrame(0, 2));
  assert.notEqual(one.checksum, two.checksum, 'Animated model pixels must change');
  await context.close();

  const phoneContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page = await phoneContext.newPage(); page.on('pageerror', e => errors.push(e.message));
  await installSave(makeSave('cow', 'creative'));
  const mobilePixels = await pixels(); assert.ok(mobilePixels.colors > 30);
  await page.locator('#touch-inventory').click(); await page.getByRole('tab', { name: 'Mobs', exact: true }).click(); await page.locator('#item-search').fill('dragon');
  await page.getByRole('button', { name: 'Add Ender Dragon spawn egg', exact: true }).click();
  await page.screenshot({ path: 'artifacts/wildlife-mobile-inventory.png', timeout: 60000 });
  await fitCheck('.inventory-window, .inventory-header, .inventory-column, .craft-column, #palette-grid, #craft-button');
  await page.locator('#close-inventory').click(); await page.screenshot({ path: 'artifacts/wildlife-mobile-world.png', timeout: 60000 });
  await fitCheck('#hotbar, .hud-bottom, .game-topbar, .selected-label');
  await page.setViewportSize({ width: 844, height: 390 }); await page.screenshot({ path: 'artifacts/wildlife-mobile-landscape.png', timeout: 60000 });
  await fitCheck('#hotbar, .hud-bottom, .game-topbar');
  assert.equal(await page.evaluate(() => {
    const a = document.querySelector('#target-label').getBoundingClientRect(), b = document.querySelector('#selected-label').getBoundingClientRect();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }), false, 'Target name and held-item label must not overlap');
  console.log('Mobile inventory, touch controls, portrait/landscape layout and canvas pixels passed', mobilePixels);
  assert.deepEqual(errors, []); console.log('WILDLIFE BROWSER TEST PASSED');
} catch (error) {
  console.log('Browser errors:', errors); if (page && !page.isClosed()) await page.screenshot({ path: 'artifacts/wildlife-failure.png', timeout: 60000 }).catch(() => {}); throw error;
} finally { await browser.close(); }
