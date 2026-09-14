import { BLOCKS } from './catalog.js';

const cube = [[0, 0, 0, 1, 1, 1]];
const rotate = (box, facing) => {
  let [x, y, z, X, Y, Z] = box;
  for (let i = 0; i < facing % 4; i++) [x, z, X, Z] = [1 - Z, x, 1 - z, X];
  return [x, y, z, X, Y, Z];
};
export function blockBoxes(id, state = {}, collision = false) {
  const def = BLOCKS[id]; if (!def || collision && def.solid === false) return [];
  let boxes;
  switch (def.shape) {
    case 'slab': boxes = state.double ? cube : [[0, state.top ? .5 : 0, 0, 1, state.top ? 1 : .5, 1]]; break;
    case 'stairs': boxes = [[0, 0, 0, 1, .5, 1], [0, .5, .5, 1, 1, 1]]; if (state.top) boxes = boxes.map(([x, y, z, X, Y, Z]) => [x, 1 - Y, z, X, 1 - y, Z]); break;
    case 'piston_head': boxes = [[0, 0, 0, 1, 1, .25], [.375, .375, .25, .625, .625, 1]]; break;
    case 'fence': boxes = [[.375, 0, .375, .625, 1, .625], [0, .38, .43, 1, .53, .57], [0, .76, .43, 1, .91, .57]]; break;
    case 'wall': boxes = [[.25, 0, .25, .75, 1, .75], [0, 0, .32, 1, .82, .68]]; break;
    case 'gate': boxes = state.open ? [[0, 0, 0, .125, 1, 1], [.875, 0, 0, 1, 1, 1]] : [[0, 0, .375, .125, 1, .625], [.875, 0, .375, 1, 1, .625], [.125, .35, .43, .875, .9, .57]]; break;
    case 'door': boxes = state.open ? [[0, 0, 0, .1875, 1, 1]] : [[0, 0, 0, 1, 1, .1875]]; break;
    case 'trapdoor': boxes = state.open ? [[0, 0, 0, 1, 1, .1875]] : [[0, state.top ? .8125 : 0, 0, 1, state.top ? 1 : .1875, 1]]; break;
    case 'plate': case 'wire': boxes = [[.05, 0, .05, .95, def.shape === 'wire' ? .015 : state.power > 0 ? .035 : .0625, .95]]; break;
    case 'button': boxes = [[.32, 0, .38, .68, state.power > 0 ? .06 : .125, .62]]; break;
    case 'lever': boxes = [[.3, 0, .3, .7, .15, .7], [.43, .15, state.on ? .25 : .45, .57, .6, state.on ? .4 : .6]]; break;
    case 'pane': boxes = [[.4375, 0, 0, .5625, 1, 1], [0, 0, .4375, 1, 1, .5625]]; break;
    case 'rod': boxes = [[.4375, 0, .4375, .5625, .75, .5625]]; break;
    case 'lantern': boxes = [[.3125, 0, .3125, .6875, .5, .6875], [.43, .5, .43, .57, .7, .57]]; break;
    case 'plant': boxes = collision ? [] : [[.1, 0, .49, .9, .85, .51], [.49, 0, .1, .51, .85, .9]]; break;
    case 'ladder': boxes = collision ? [] : [[0, 0, .92, 1, 1, .96]]; break;
    case 'spike': boxes = [[.25, 0, .25, .75, .3, .75], [.35, .3, .35, .65, .6, .65], [.44, .6, .44, .56, .95, .56]]; break;
    case 'sign': boxes = [[.45, 0, .45, .55, .55, .55], [0, .5, .45, 1, 1, .55]]; break;
    case 'hanging_sign': boxes = [[.1, .13, .43, .9, .68, .57], [.2, .68, .46, .26, 1, .54], [.74, .68, .46, .8, 1, .54]]; break;
    case 'banner': boxes = [[.45, 0, .45, .55, 1, .55], [.15, .25, .41, .85, 1.65, .44]]; break;
    case 'chest': boxes = [[.0625, 0, .0625, .9375, state.open ? .65 : .875, .9375], [.43, .4, .01, .57, .65, .09]]; break;
    case 'hopper': boxes = [[0, .625, 0, 1, 1, 1], [.25, .25, .25, .75, .625, .75], [.375, 0, .375, .625, .25, .625]]; break;
    case 'cauldron': boxes = [[0, 0, 0, 1, .2, 1], [0, .2, 0, .15, 1, 1], [.85, .2, 0, 1, 1, 1], [.15, .2, 0, .85, 1, .15], [.15, .2, .85, .85, 1, 1]]; break;
    case 'brewing_stand': boxes = [[.15, 0, .15, .85, .125, .85], [.4375, .125, .4375, .5625, .95, .5625], [.12, .2, .43, .88, .3, .57]]; break;
    case 'anvil': boxes = [[.125, 0, .125, .875, .25, .875], [.3, .25, .25, .7, .7, .75], [0, .7, .18, 1, 1, .82]]; break;
    case 'enchanting_table': boxes = [[0, 0, 0, 1, .75, 1], [.2, .85, .22, .8, .91, .78]]; break;
    case 'bed': boxes = [[0, .18, 0, 1, .55, 1], [0, 0, 0, .15, .18, .15], [.85, 0, .85, 1, .18, 1]]; break;
    case 'scaffolding': boxes = [[0, .875, 0, 1, 1, 1], [0, 0, 0, .125, .875, .125], [.875, 0, 0, 1, .875, .125], [0, 0, .875, .125, .875, 1], [.875, 0, .875, 1, .875, 1]]; break;
    default: boxes = cube;
  }
  return state.facing ? boxes.map(b => rotate(b, state.facing)) : boxes;
}

export function intersectBox(origin, direction, box, offset, max = Infinity) {
  let near = -Infinity, far = Infinity, normal = { x: 0, y: 0, z: 0 };
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const a = axes[i], lo = box[i] + offset[a], hi = box[i + 3] + offset[a], v = direction[a];
    if (Math.abs(v) < 1e-10) { if (origin[a] < lo || origin[a] > hi) return null; continue; }
    const t1 = (lo - origin[a]) / v, t2 = (hi - origin[a]) / v, entry = Math.min(t1, t2);
    if (entry > near) { near = entry; normal = { x: 0, y: 0, z: 0, [a]: v > 0 ? -1 : 1 }; }
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return null;
  }
  return far >= 0 && near <= max ? { distance: Math.max(0, near), normal } : null;
}
