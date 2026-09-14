import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
// Exercise the supported drag/keyboard fallback as well as native capture below.
await context.addInitScript(() => {
  HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new DOMException('Testing uncaptured controls', 'NotAllowedError'));
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('response', r => { if (r.status() >= 400) console.log('HTTP error:', r.status(), r.url()); });
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'artifacts/home-desktop.png' });
  console.log('Home loaded', await page.title());
  await page.getByRole('button', { name: 'CREATE A WORLD' }).click();
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('#target-label').filter({ hasText: 'Oak log' }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: 'artifacts/game-desktop.png' });
  console.log('Spawn target:', await page.locator('#target-label').innerText());
  await page.keyboard.press('e');
  await page.getByRole('dialog', { name: 'Inventory and crafting' }).waitFor();
  await page.getByRole('button', { name: 'Craft 4 oak planks' }).click();
  assert.match(await page.locator('#recipe-ingredients').innerText(), /2\/1/);
  await page.getByRole('button', { name: 'Recipe: Crafting table', exact: true }).click();
  await page.getByRole('button', { name: 'Craft crafting table', exact: true }).click();
  await page.screenshot({ path: 'artifacts/inventory-desktop.png' });
  console.log('Crafted planks and table through the inventory UI');
  await page.getByRole('button', { name: 'Close inventory', exact: true }).click();
  await page.keyboard.press('Digit2');
  if (!(await page.evaluate(() => !!document.pointerLockElement))) await page.mouse.move(720, 480);
  console.log('Mining start:', await page.locator('#target-label').innerText(), await page.evaluate(() => !!document.pointerLockElement));
  await page.mouse.down();
  await page.locator('#save-status').filter({ hasText: 'Unsaved changes' }).waitFor({ timeout: 20000 });
  await page.mouse.up();

  // Look down at a free ground face and place the table made in the backpack.
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(() => /Grass block|Dirt/.test(document.querySelector('#target-label').textContent));
  await page.keyboard.up('ArrowDown');
  await page.keyboard.press('Digit5');
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await page.locator('#quest-title').filter({ hasText: 'The stone age' }).waitFor();
  await page.locator('#target-label').filter({ hasText: 'Crafting table' }).waitFor();
  await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' });
  await page.locator('#inventory-modal').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#table-status').innerText(), 'TABLE READY');
  await page.screenshot({ path: 'artifacts/workbench-desktop.png' });
  await page.keyboard.press('e');
  console.log('Face placement and right-click workbench interaction passed');

  const oldCoordinates = await page.locator('#coords-label').innerText();
  await page.keyboard.down('KeyD');
  await page.waitForFunction(previous => document.querySelector('#coords-label').textContent !== previous, oldCoordinates);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => Number(document.querySelector('#coords-label').textContent.match(/Y (\d+)/)[1]) > 23);
  await page.keyboard.up('Space');
  console.log('Walking and jumping passed');
  await page.keyboard.press('Escape');
  await page.locator('#pause-modal').waitFor({ state: 'visible' });
  await page.locator('#save-btn').click();
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('blockbound.world.v1.' + localStorage.getItem('blockbound.last-world'))));
  assert.ok(save.edits.some(([, id]) => id === 0), 'A mined block should be in the saved world');
  assert.ok(save.edits.some(([, id]) => id === 13), 'A placed crafting table should be in the saved world');
  assert.equal(save.progress.table, true);
  console.log('Mining and saving passed:', save.edits.length, 'edits');
  await page.getByRole('button', { name: 'Save & return home', exact: true }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Continue your adventure', exact: false }).click();
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Pause game', exact: true }).click();
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('blockbound.world.v1.' + localStorage.getItem('blockbound.last-world'))));
  assert.deepEqual(reloaded.edits, save.edits); assert.deepEqual(reloaded.inventory, save.inventory);
  console.log('Reload preserved inventory and edited terrain');
  await page.screenshot({ path: 'artifacts/pause-desktop.png' });

  await page.getByRole('button', { name: 'Save & return home', exact: true }).click();
  await page.locator('[data-mode="creative"]').click();
  await page.locator('#seed-input').fill('building-meadow');
  await page.getByRole('button', { name: 'CREATE A WORLD' }).click();
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.keyboard.press('e');
  assert.equal(await page.locator('#creative-palette').isVisible(), true);
  assert.ok(await page.locator('#palette-grid button').count() > 20);
  await page.getByRole('button', { name: 'Add Glass', exact: true }).click();
  await page.keyboard.press('e');
  await page.keyboard.press('f');
  await page.locator('#mode-label').filter({ hasText: 'FLYING' }).waitFor();
  await page.keyboard.down('Space');
  await page.waitForFunction(() => Number(document.querySelector('#coords-label').textContent.match(/Y (\d+)/)[1]) > 24);
  await page.keyboard.up('Space');
  await page.keyboard.press('Escape');
  await page.locator('#pause-modal').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Save & return home', exact: true }).click();
  assert.equal(await page.locator('#world-select option').count(), 2);
  console.log('Creative collection, flight, and multiple independent saves passed');

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const phone = await mobile.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await phone.screenshot({ path: 'artifacts/home-mobile.png' });
  await phone.getByRole('button', { name: 'CREATE A WORLD' }).click();
  await phone.locator('#loading').waitFor({ state: 'hidden' });
  await phone.getByRole('button', { name: 'Open inventory', exact: true }).click();
  await phone.getByRole('button', { name: 'Craft 4 oak planks' }).click();
  await phone.screenshot({ path: 'artifacts/inventory-mobile.png' });
  await phone.getByRole('button', { name: 'Close inventory', exact: true }).click();
  await phone.screenshot({ path: 'artifacts/game-mobile.png' });
  assert.equal(await phone.locator('#touch-controls').isVisible(), true);
  console.log('Mobile creation, touch controls, and crafting passed');

  const captured = await browser.newContext({ viewport: { width: 960, height: 640 } });
  const capturePage = await captured.newPage(); capturePage.on('pageerror', e => errors.push(e.message));
  await capturePage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await capturePage.getByRole('button', { name: 'CREATE A WORLD' }).click();
  await capturePage.locator('#loading').waitFor({ state: 'hidden' });
  await capturePage.mouse.move(480, 320); await capturePage.mouse.down();
  await capturePage.waitForFunction(() => !!document.pointerLockElement);
  await capturePage.waitForFunction(() => document.querySelector('#save-status').textContent === 'Unsaved changes');
  await capturePage.mouse.up();
  console.log('Native pointer capture and held-click mining passed');
  assert.deepEqual(errors, [], 'Browser should have no JavaScript or rendering errors');
  console.log('BROWSER SMOKE TEST PASSED');
} catch (error) {
  console.log('Failure state:', await page.evaluate(() => ({ target: document.querySelector('#target-label').textContent, progress: document.querySelector('#mine-progress i').style.width, paused: !document.querySelector('#pause-modal').classList.contains('hidden'), locked: !!document.pointerLockElement, save: document.querySelector('#save-status').textContent })));
  await page.screenshot({ path: 'artifacts/failure.png' });
  throw error;
} finally {
  console.log('Browser errors:', JSON.stringify(errors));
  await browser.close();
}
