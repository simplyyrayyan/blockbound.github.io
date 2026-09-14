import { ITEMS } from './catalog.js';

const cache = new Map();
const uriCache = new Map();
let blockAtlas = null, atlasTiles = 16;
export function setItemAtlas(canvas, tiles) { blockAtlas = canvas; atlasTiles = tiles; cache.clear(); uriCache.clear(); }
const shade = (hex, n) => '#' + hex.slice(1).match(/../g).map(v => Math.max(0, Math.min(255, parseInt(v, 16) + n)).toString(16).padStart(2, '0')).join('');
export function itemImage(id) {
  if (cache.has(id)) return cache.get(id);
  const d = ITEMS[id], canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
  if (!d) return canvas;
  const ctx = canvas.getContext('2d'), c = d.color, dark = shade(c, -55), light = shade(c, 38);
  const rect = (x, y, w, h, fill = c) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  const poly = (points, fill) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
  const shape = d.shape || (d.tool ? d.tool : d.block ? 'block' : 'material');
  if (shape === 'block') {
    if (blockAtlas) {
      ctx.imageSmoothingEnabled = false;
      for (const [side, transform, tint] of [[0, [.875, .4375, -.875, .4375, 16, 2], 0], [1, [.875, .5, 0, .875, 2, 9], .1], [1, [.875, -.5, 0, .875, 16, 17], .3]]) {
        const tile = d.block * 3 + side; ctx.save(); ctx.transform(...transform); ctx.drawImage(blockAtlas, tile % atlasTiles * 16, Math.floor(tile / atlasTiles) * 16, 16, 16, 0, 0, 16, 16); ctx.fillStyle = `rgba(0,0,0,${tint})`; ctx.fillRect(0, 0, 16, 16); ctx.restore();
      }
    } else { poly([[16, 2], [30, 9], [16, 17], [2, 9]], light); poly([[2, 9], [16, 17], [16, 31], [2, 23]], c); poly([[16, 17], [30, 9], [30, 23], [16, 31]], dark); }
  } else if (['sword', 'pick', 'axe', 'shovel', 'trident', 'mace', 'stick', 'rod', 'brush', 'arrow'].includes(shape)) {
    for (let i = 0; i < 15; i++) { rect(5 + i, 25 - i, 3, 3, '#735239'); rect(5 + i, 25 - i, 1, 1, '#b29468'); }
    if (shape === 'sword' || shape === 'trident') { for (let i = 0; i < 13; i++) rect(12 + i, 15 - i, 4, 4, i % 3 ? c : light); rect(10, 14, 12, 3, dark); if (shape === 'trident') { rect(16, 3, 3, 9, c); rect(23, 8, 7, 3, c); } }
    else if (shape === 'pick') { rect(6, 4, 16, 4, dark); rect(10, 3, 12, 3, c); rect(20, 6, 5, 4, c); rect(24, 9, 4, 8, c); }
    else if (shape === 'axe' || shape === 'mace') { rect(10, 4, 14, 10, c); rect(10, 4, 14, 2, light); rect(10, 13, 10, 3, dark); }
    else if (shape === 'shovel' || shape === 'brush') { rect(19, 3, 9, 10, c); rect(17, 6, 10, 9, c); rect(19, 3, 9, 2, light); }
    else if (shape === 'arrow') poly([[23, 2], [29, 2], [29, 8], [25, 8], [23, 6]], '#c7d0c9');
  } else if (shape === 'egg' || shape === 'orb' || shape === 'gem' || shape === 'food' || shape === 'apple') {
    poly(shape === 'egg' ? [[12, 3], [20, 3], [25, 11], [28, 20], [24, 27], [9, 27], [4, 20], [7, 11]] : [[10, 5], [23, 5], [28, 12], [27, 23], [20, 29], [9, 25], [4, 17]], dark);
    poly([[11, 5], [21, 5], [25, 12], [24, 23], [15, 25], [7, 20], [7, 12]], c); rect(9, 9, 4, 6, light);
    if (d.spawn) for (const [x, y, w] of [[17, 9, 4], [11, 17, 5], [20, 21, 3]]) rect(x, y, w, w, d.accent);
    if (shape === 'food') { rect(16, 9, 6, 3, light); rect(10, 20, 12, 2, dark); }
    if (id.includes('apple')) { rect(16, 1, 3, 6, '#836746'); rect(19, 2, 5, 3, '#81a44e'); }
  } else if (shape === 'bottle' || shape === 'bucket' || shape === 'bowl') {
    if (shape === 'bottle') { rect(12, 2, 8, 3, '#b29574'); rect(13, 5, 6, 7, '#a9c3c3'); rect(8, 12, 17, 14, '#bfdbd5'); rect(10, 16, 13, 9, c); rect(10, 13, 3, 6, '#e2eee6'); }
    else { poly([[5, 10], [27, 10], [24, 27], [9, 27]], '#6c7780'); poly([[8, 12], [24, 12], [22, 25], [10, 25]], c); rect(8, 9, 16, 3, light); rect(10, 13, 2, 8, '#dce3dc'); }
  } else if (['helmet', 'chestplate', 'leggings', 'boots', 'shield', 'totem'].includes(shape)) {
    if (shape === 'helmet') { rect(5, 7, 23, 17, dark); rect(7, 7, 19, 9, c); rect(7, 14, 4, 12, c); rect(22, 14, 4, 12, c); }
    if (shape === 'chestplate') { rect(3, 7, 27, 9, c); rect(8, 12, 18, 17, c); rect(12, 5, 8, 6, '#394340'); }
    if (shape === 'leggings') { rect(7, 4, 19, 10, c); rect(7, 13, 7, 16, c); rect(19, 13, 7, 16, c); }
    if (shape === 'boots') { rect(5, 11, 8, 17, c); rect(19, 11, 8, 17, c); rect(2, 23, 11, 6, c); rect(19, 23, 11, 6, c); }
    if (shape === 'shield') { poly([[5, 4], [27, 4], [27, 23], [16, 30], [5, 23]], '#a5adac'); poly([[8, 7], [24, 7], [24, 21], [16, 27], [8, 21]], c); rect(15, 7, 2, 19, dark); }
    if (shape === 'totem') { rect(11, 3, 10, 9, c); rect(5, 13, 22, 6, c); rect(12, 17, 8, 12, c); rect(12, 7, 2, 3, '#6b9a67'); rect(18, 7, 2, 3, '#6b9a67'); }
    rect(8, 7, 3, 7, light);
  } else if (shape === 'bow' || shape === 'crossbow') {
    poly([[9, 2], [18, 7], [23, 16], [18, 25], [9, 30], [12, 23], [17, 16], [12, 8]], c); rect(9, 3, 1, 27, '#dedbc1'); if (shape === 'crossbow') { rect(3, 14, 26, 4, '#84704f'); rect(14, 17, 5, 12, '#655340'); }
  } else if (shape === 'fish') {
    poly([[5, 10], [20, 10], [26, 5], [26, 25], [20, 20], [5, 20], [2, 15]], c); rect(6, 12, 3, 3, '#2b393b'); rect(10, 9, 8, 3, light); rect(10, 19, 8, 3, dark);
  } else if (['plant', 'flower', 'seeds', 'mushroom'].includes(shape)) {
    rect(14, 10, 3, 20, '#779451'); rect(7, 19, 8, 3, '#8dad63'); rect(17, 14, 8, 3, '#8dad63');
    if (shape === 'flower') { rect(9, 3, 12, 12, c); rect(13, 7, 4, 4, '#dfc77a'); }
    else if (shape === 'mushroom') { rect(4, 9, 23, 8, c); rect(9, 4, 13, 8, c); rect(8, 11, 4, 3, '#e5dfd0'); rect(18, 7, 3, 3, '#e5dfd0'); }
    else for (let i = 0; i < 4; i++) rect(9 + i % 2 * 7, 6 + i * 4, 6, 4, c);
  } else if (shape === 'ingot' || shape === 'book') {
    poly([[5, 10], [24, 6], [29, 19], [25, 25], [5, 25]], dark); rect(5, 14, 20, 9, c); poly([[5, 14], [10, 7], [24, 7], [25, 14]], light);
  } else {
    poly([[10, 5], [22, 5], [26, 11], [23, 17], [27, 24], [18, 28], [6, 25], [4, 17]], dark); rect(9, 7, 12, 16, c); rect(11, 7, 5, 4, light); rect(6, 14, 18, 6, c);
  }
  cache.set(id, canvas); return canvas;
}
export function itemIcon(id) {
  if (!ITEMS[id]) return '';
  if (!uriCache.has(id)) uriCache.set(id, itemImage(id).toDataURL());
  return `<img class="item-icon" src="${uriCache.get(id)}" alt="" draggable="false">`;
}
