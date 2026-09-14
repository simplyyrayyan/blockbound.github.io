import * as THREE from 'three';
import { MOBS } from './mob-catalog.js';
import { ITEMS } from './catalog.js';

const skinCache = new Map();
export function mobParts(type, sheared = false) {
  const key = `${type}:${sheared}`;
  if (skinCache.has(key)) return skinCache.get(key);
  const d = MOBS[type], parts = [], c = d.color, a = d.accent;
  const box = (x, y, z, w, h, l, color = c, motion = '', phase = 0, angle = 0) => parts.push({ x, y, z, w, h, l, color, motion, phase, angle });
  const eye = (x, y, z, size = .07, color = '#25292b') => { box(x, y, z, size * 1.8, size * 1.2, .025, '#ecece2'); box(x, y, z - .018, size, size, .025, color); };
  const eyes = (x, y, z, size, color) => { eye(-x, y, z, size, color); eye(x, y, z, size, color); };
  const feet = (width, depth, height, color = a, thickness = .16) => {
    for (const x of [-width, width]) for (const z of [-depth, depth]) { box(x, height / 2, z, thickness, height, thickness, color, 'leg', (x * z > 0 ? 0 : Math.PI)); box(x, .055, z - .025, thickness + .035, .11, thickness + .045, '#4a4540', 'leg', x * z > 0 ? 0 : Math.PI); }
  };
  const ears = (x, y, z, h = .22, color = c) => { for (const side of [-1, 1]) { box(x * side, y, z, .16, h, .12, color); box(x * side, y, z - .068, .07, h * .65, .02, '#c59591'); } };
  const humanoid = (head = c, robe = a, slim = false) => {
    box(0, 1.06, 0, slim ? .3 : .55, .62, .3, robe);
    box(0, 1.65, -.015, .48, .48, .45, head);
    box(0, 1.34, 0, .18, .13, .18, head);
    for (const side of [-1, 1]) { box(side * .15, .4, 0, slim ? .12 : .21, .8, .23, slim ? head : '#485469', 'leg', side < 0 ? 0 : Math.PI); box(side * .39, 1.02, -.06, slim ? .1 : .2, .7, .21, head, 'arm', side < 0 ? 0 : Math.PI); }
    eyes(.12, 1.69, -.253, .065, d.stare ? a : '#31342e');
    box(0, 1.5, -.25, .22, .045, .03, '#575548');
  };
  const quadruped = () => {
    box(0, .82, .1, .75, .62, 1.12); box(0, 1, -.63, .48, .45, .45);
    box(0, .88, -.88, .35, .21, .15, a); eyes(.16, 1.06, -.867, .055); feet(.25, .39, .56, a); ears(.27, 1.2, -.6, .17);
    box(0, .85, .77, .09, .35, .08, c, 'tail');
  };
  switch (d.model) {
    case 'cow': case 'sheep': case 'pig': case 'goat': case 'hoglin': case 'ravager': case 'sniffer': {
      quadruped();
      if (d.model === 'cow') {
        for (const side of [-1, 1]) { box(side * .379, .93, -.12, .025, .3, .33, '#e0dacf'); box(side * .38, .7, .39, .025, .24, .26, '#e0dacf'); box(side * .21, 1.33, -.65, .075, .2, .08, '#dfdbc2'); }
        box(0, .54, .24, .35, .14, .3, '#d7a4a0');
        if (type === 'mooshroom') for (const z of [-.15, .4]) { box(.1, 1.25, z, .09, .24, .08, '#ddc9b5'); box(.1, 1.37, z, .32, .1, .28, '#d84741'); box(.02, 1.43, z - .06, .08, .025, .08, '#e9e4d3'); }
      }
      if (d.model === 'sheep') { box(0, .92, .06, .85, .74, 1.18, sheared ? '#aeaaa2' : '#e9e6da'); box(0, 1.24, -.62, .49, .17, .48, sheared ? '#aeaaa2' : '#e9e6da'); }
      if (d.model === 'pig') { box(0, .97, -.98, .3, .22, .1, '#dd9494'); for (const side of [-1, 1]) box(side * .07, .98, -1.04, .035, .07, .02, '#885557'); box(.05, .89, .77, .15, .08, .09, '#d59292'); }
      if (d.model === 'goat') { for (const side of [-1, 1]) box(side * .15, 1.43, -.54, .075, .47, .075, '#8a8070', '', 0, side * .15); box(0, .74, -.89, .17, .26, .12, '#d4cec0'); }
      if (d.model === 'hoglin' || d.model === 'ravager') {
        box(0, 1.06, -.62, .76, .6, .63, c); eyes(.25, 1.18, -.96, .07);
        for (const side of [-1, 1]) { box(side * .37, .98, -.91, .12, .5, .12, '#d8d5ba'); box(side * .25, 1.54, -.48, .15, .35, .12, '#595a51'); }
        for (let z = -.25; z < .7; z += .19) box(0, 1.22, z, .1, .18, .16, '#5b4a40');
      }
      if (d.model === 'sniffer') { box(0, 1.19, .2, .9, .35, 1.16, '#688349'); box(0, 1.01, -.87, .7, .23, .5, '#b59b58'); for (const side of [-1, 1]) box(side * .19, 1.06, -1.13, .1, .06, .03, '#544c32'); }
      break;
    }
    case 'horse': case 'llama': case 'camel': {
      box(0, .98, .12, .68, .64, 1.3); feet(.22, .46, .72, d.skeletal ? c : a, d.skeletal ? .11 : .17);
      box(0, 1.4, -.55, .34, .9, .36); box(0, 1.79, -.79, .36, .37, .7); eyes(.19, 1.84, -1.08, .055);
      ears(.15, 2.08, -.64, d.longEars || d.model === 'llama' ? .46 : .25);
      box(0, 1.58, -.32, .13, .85, .1, '#4e4540'); box(0, .81, .87, .14, .65, .13, '#4e4540', 'tail');
      if (d.model === 'camel') { box(0, 1.42, .2, .49, .4, .55); box(0, 1.96, -.89, .35, .18, .51); }
      if (type === 'trader_llama') { box(0, 1.31, .16, .71, .06, .65, '#447ca7'); for (const side of [-1, 1]) box(side * .365, 1.12, .16, .04, .4, .65, '#c8a454'); }
      if (d.skeletal) for (let z = -.35; z < .7; z += .22) box(0, 1.04, z, .72, .4, .09, '#e1e2d3');
      break;
    }
    case 'cat': case 'fox': case 'wolf': {
      box(0, .52, .05, .4, .32, .84); box(0, .69, -.48, .39, .38, .36); eyes(.105, .74, -.672, .045, type === 'cat' ? '#86af65' : '#2b3030');
      box(0, .61, -.73, .2, .14, .18, '#d4c6b2'); box(0, .65, -.83, .1, .06, .025, '#38383a');
      ears(.16, .95, -.43, .22); feet(.13, .28, .4, a, .11); box(0, .57, .66, .15, .14, .62, c, 'tail'); box(0, .57, .98, .16, .14, .18, '#ddd9c9', 'tail');
      if (d.spots) for (const s of [-1, 1]) for (let z = -.25; z < .44; z += .19) box(s * .207, .56, z, .018, .09, .09, '#685442');
      if (d.model === 'wolf') box(0, .57, -.18, .48, .39, .27, '#d4d4c8');
      break;
    }
    case 'bear': {
      box(0, .83, .14, 1.1, .9, 1.45); box(0, 1.01, -.83, .73, .57, .51); box(0, .91, -1.14, .42, .24, .2, '#c7c7b9'); eyes(.22, 1.13, -1.1, .075); ears(.27, 1.38, -.83, .2, type === 'panda' ? a : c); feet(.35, .5, .52, type === 'panda' ? a : c, .3);
      if (type === 'panda') { for (const side of [-1, 1]) box(side * .22, 1.13, -1.091, .2, .23, .05, a); eyes(.22, 1.13, -1.124, .055); box(0, .95, -.27, 1.12, .84, .33, a); }
      break;
    }
    case 'rabbit': {
      box(0, .33, .12, .35, .39, .5); box(0, .56, -.19, .3, .3, .29); ears(.1, .9, -.16, .48); eyes(.1, .61, -.35, .045); feet(.12, .13, .17, a, .12); box(0, .4, .43, .2, .2, .18, '#dfd9c9'); break;
    }
    case 'armadillo': case 'turtle': {
      box(0, .34, .08, .7, .42, .83, c); box(0, .3, -.52, .31, .23, .36, a); eyes(.11, .34, -.71, .045);
      for (let z = -.23; z <= .4; z += .2) box(0, .48, z, .73, .15, .09, d.model === 'turtle' ? '#426647' : '#826554');
      feet(.28, .29, .2, c, d.model === 'turtle' ? .26 : .12); box(0, .24, .6, .1, .1, .35, a, 'tail'); break;
    }
    case 'frog': {
      box(0, .26, 0, .61, .4, .57); box(0, .13, -.15, .5, .12, .4, '#d3c4a4');
      for (const s of [-1, 1]) { box(s * .23, .51, -.17, .2, .18, .2); eye(s * .23, .52, -.28, .06); box(s * .37, .1, .08, .24, .17, .5, c, 'leg', s < 0 ? 0 : Math.PI); } break;
    }
    case 'chicken': case 'parrot': {
      box(0, .43, 0, .4, .4, .47); box(0, .79, -.19, .29, .37, .28); eyes(.1, .88, -.34, .04); box(0, .77, -.41, .15, .12, .15, '#d6b14e');
      for (const s of [-1, 1]) { box(s * .25, .47, .01, .09, .28, .42, d.model === 'parrot' ? a : '#d5d5c7', 'wing', s); box(s * .11, .11, 0, .045, .2, .04, '#b8a05d', 'leg', s < 0 ? 0 : Math.PI); box(s * .11, .025, -.08, .1, .035, .19, '#b8a05d'); }
      if (d.model === 'chicken') box(0, .64, -.36, .13, .16, .07, '#bf5048'); else { box(0, 1.03, -.14, .08, .18, .13); box(0, .38, .39, .14, .1, .53, a, 'tail'); } break;
    }
    case 'fish': case 'tadpole': case 'dolphin': case 'axolotl': {
      const dolphin = d.model === 'dolphin';
      box(0, .23, 0, dolphin ? .5 : .23, dolphin ? .4 : .24, dolphin ? 1.2 : .65); eyes(dolphin ? .22 : .115, .3, dolphin ? -.61 : -.34, .035);
      for (const s of [-1, 1]) box(s * (dolphin ? .37 : .22), .16, .07, dolphin ? .32 : .2, .05, .2, a, 'wing', s);
      box(0, .28, dolphin ? .78 : .44, dolphin ? .52 : .09, dolphin ? .07 : .32, .25, a, 'tail');
      if (dolphin) { box(0, .18, -.73, .24, .15, .4); box(0, .5, .13, .075, .32, .27); }
      if (type === 'tropical_fish') { box(0, .23, .03, .245, .25, .12, '#eee9dc'); box(0, .23, -.2, .245, .25, .1, '#eee9dc'); }
      if (d.model === 'axolotl') { box(0, .26, -.32, .5, .25, .3); eyes(.17, .3, -.48, .04); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) box(s * .34, .22 + i * .12, -.29, .22, .06, .06, '#d36f9e'); feet(.22, .2, .12, c, .1); }
      break;
    }
    case 'squid': case 'ghast': {
      const large = d.model === 'ghast';
      box(0, .88, 0, large ? 1.9 : .65, large ? 1.5 : .75, large ? 1.9 : .65); eyes(large ? .43 : .2, large ? 1.11 : .99, large ? -.96 : -.34, large ? .17 : .065);
      box(0, .69, large ? -.96 : -.34, large ? .25 : .12, .13, .025, '#6e6167');
      for (let i = 0; i < (large ? 9 : 8); i++) { const angle = i / 8 * Math.PI * 2; box(Math.cos(angle) * (large ? .65 : .3), .13, Math.sin(angle) * (large ? .65 : .3), large ? .19 : .09, large ? 1.1 : .68, large ? .19 : .09, c, 'tentacle', angle); }
      break;
    }
    case 'guardian': {
      box(0, .48, 0, .8, .8, .8); eye(0, .5, -.412, .17, '#9d5945');
      for (const s of [-1, 1]) for (const y of [.16, .68]) box(s * .53, y, 0, .37, .08, .1, '#cb9c70');
      box(0, 1, 0, .1, .32, .1, '#cb9c70'); box(0, .43, .69, .23, .18, .7, a, 'tail'); box(0, .43, 1.06, .08, .42, .3, a, 'tail'); break;
    }
    case 'spider': case 'mite': {
      const mite = d.model === 'mite';
      box(0, .29, .24, mite ? .28 : .57, .39, .62); box(0, .33, -.26, mite ? .28 : .41, .27, .33); eyes(mite ? .08 : .14, .39, -.445, .055, '#cd5b57');
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { box(s * (mite ? .21 : .49), .25, -.27 + i * .2, mite ? .24 : .57, .065, .065, a, 'leg', i + (s > 0 ? Math.PI : 0), s * .3); }
      break;
    }
    case 'creeper': {
      box(0, .92, 0, .47, .85, .35); box(0, 1.52, -.01, .59, .59, .56); feet(.23, .19, .35, '#5c8d43', .22);
      for (const s of [-1, 1]) box(s * .16, 1.62, -.297, .13, .13, .025, '#293e2a');
      box(0, 1.44, -.3, .12, .22, .025, '#293e2a'); box(0, 1.39, -.3, .35, .13, .025, '#293e2a');
      for (const s of [-1, 1]) box(s * .13, 1.28, -.3, .09, .16, .025, '#293e2a');
      for (let i = 0; i < 5; i++) box((i % 2 ? -1 : 1) * .241, .63 + i * .13, .02, .025, .12, .23, i % 2 ? '#add68a' : '#456b36');
      break;
    }
    case 'humanoid': case 'skeleton': case 'villager': case 'illager': case 'witch': case 'piglin': {
      const slim = d.model === 'skeleton';
      humanoid(['villager', 'witch'].includes(d.model) && !type.startsWith('zombie') ? '#b79378' : d.model === 'illager' ? '#929992' : c, slim ? c : d.model === 'humanoid' ? '#519791' : c, slim);
      if (slim) for (let y = .85; y < 1.3; y += .13) box(0, y, -.17, .4, .055, .06, '#d1d1c2');
      if (['villager', 'illager', 'witch'].includes(d.model)) { box(0, 1.57, -.32, .12, .23, .19, '#a98d76'); box(0, 1.77, -.255, .37, .055, .025, '#514e42'); box(0, .69, 0, .55, .36, .33); box(0, 1.03, -.25, .62, .17, .2, '#a58c71'); }
      if (d.model === 'witch') { box(0, 1.92, 0, .85, .09, .73, '#4c4059'); box(0, 2.08, 0, .44, .3, .4, '#4c4059'); box(.06, 2.31, 0, .26, .2, .25, '#4c4059'); box(0, 1.99, -.214, .13, .12, .04, '#83a562'); }
      if (d.model === 'piglin') { box(0, 1.61, -.33, .3, .21, .19, '#cc9e91'); ears(.33, 1.82, -.02, .25); for (const s of [-1, 1]) box(s * .18, 1.51, -.35, .055, .18, .07, '#dfd9c5'); box(0, 1.02, -.16, .55, .19, .04, '#655647'); }
      if (type === 'bogged') for (const s of [-1, 1]) { box(s * .16, 1.91, .03, .2, .13, .2, '#829564'); box(s * .16, 2.02, .03, .24, .05, .22, '#a39076'); }
      if (type === 'stray') box(0, 1.43, .16, .54, .9, .08, '#81969d');
      break;
    }
    case 'enderman': case 'creaking': case 'warden': case 'golem': {
      const tall = d.model === 'enderman', warden = d.model === 'warden';
      const w = tall ? .36 : .86;
      box(0, 1.53, 0, w, .94, tall ? .26 : .51); box(0, 2.32, -.015, tall ? .46 : .69, .55, .51); eyes(tall ? .14 : .2, 2.37, -.281, .075, d.model === 'golem' ? '#ab5347' : a);
      for (const s of [-1, 1]) { box(s * w / 3, .56, 0, tall ? .11 : .28, 1.12, .28, c, 'leg', s < 0 ? 0 : Math.PI); box(s * (w / 2 + .18), 1.45, 0, tall ? .1 : .28, tall ? 1.5 : 1.3, .27, c, 'arm', s < 0 ? 0 : Math.PI); }
      if (warden) {
        box(0, 1.58, -.27, .52, .54, .06, '#172e31');
        for (let y = 1.4; y < 1.86; y += .13) box(0, y, -.31, .45, .06, .04, a);
        for (const s of [-1, 1]) { box(s * .51, 2.39, 0, .36, .1, .12, a); box(s * .66, 2.56, 0, .09, .42, .12, a); }
      }
      if (d.model === 'golem') { box(0, 2.16, -.36, .16, .3, .19, '#acac9a'); for (let i = 0; i < 5; i++) box(-.2, 1.2 + i * .16, -.27, .12, .19, .03, '#708950'); }
      if (d.model === 'creaking') { box(-.21, 2.72, 0, .12, .45, .14); box(.4, 2.39, .02, .23, .12, .13); box(.12, 1.9, -.29, .11, .1, .04, '#ed973e'); }
      break;
    }
    case 'fairy': case 'bat': case 'bee': case 'phantom': case 'dragon': {
      const dragon = d.model === 'dragon', phantom = d.model === 'phantom', bee = d.model === 'bee', bat = d.model === 'bat';
      const scale = dragon ? 3 : phantom ? 1.5 : 1;
      box(0, .5, 0, (bee ? .57 : .28) * scale, .38 * scale, .55 * scale); box(0, .66, -.32 * scale, .32 * scale, .32 * scale, .32 * scale); eyes(.1 * scale, .71, -.49 * scale, .05 * scale, dragon ? '#c094e5' : '#273338');
      for (const s of [-1, 1]) {
        box(s * .46 * scale, .7, .03, .62 * scale, .035, .4 * scale, bee ? '#dceae1' : d.model === 'fairy' ? '#b1e4e4' : c, 'wing', s);
        if (!bee) box(s * .88 * scale, .67, .12, .4 * scale, .035, .55 * scale, bat || dragon ? '#696370' : a, 'wing', s);
      }
      if (bee) { for (const z of [-.09, .14]) box(0, .5, z, .59, .4, .095, '#574b39'); for (const s of [-1, 1]) box(s * .18, .87, -.26, .035, .2, .035, '#4e4436'); }
      else if (bat) ears(.12, .94, -.3, .24);
      else if (d.model === 'fairy') { feet(.1, .03, .28, c, .08); box(0, .42, -.38, .22, .22, .22, '#86ced9'); }
      else {
        for (let i = 0; i < (dragon ? 5 : 3); i++) box(0, .46, .43 * scale + i * .34, (.22 - i * .028) * scale, .13 * scale, .45, a, 'tail');
        if (dragon) { box(0, .6, -1.43, .58, .25, .7); for (const s of [-1, 1]) { box(s * .29, 1.17, -.88, .1, .38, .11, '#b7adb9'); box(s * .4, .05, .3, .24, .7, .25, c, 'leg', s); } }
      }
      break;
    }
    case 'slime': case 'shulker': {
      box(0, .5, 0, .95, .95, .95); eyes(.23, .57, -.487, .12, type === 'magma_cube' ? '#ffcb66' : '#385442'); box(0, .3, -.487, .2, .08, .03, a);
      if (type === 'magma_cube') for (const y of [.2, .45, .7]) box(0, y, -.489, .91, .055, .03, '#eaa346');
      if (d.model === 'shulker') { box(0, .6, 0, 1.04, .17, 1.04, '#c39ec6'); box(0, .35, -.51, .31, .21, .07, '#d5caa0'); } break;
    }
    case 'blaze': case 'breeze': {
      box(0, 1.34, 0, .45, .45, .45); eyes(.12, 1.38, -.24, .06, d.model === 'blaze' ? '#4d3d28' : '#eef5de');
      for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 3, r = .35 + i / 30; box(Math.cos(a) * r, .2 + i * .11, Math.sin(a) * r, .12, d.model === 'blaze' ? .4 : .1, .12, i % 2 ? c : d.accent, 'orbit', a); }
      if (d.model === 'breeze') for (let i = 0; i < 4; i++) box(0, .2 + i * .22, 0, .22 + i * .17, .11, .22 + i * .17, '#9eafb4', 'orbit', i);
      break;
    }
    case 'strider': {
      box(0, 1.11, 0, .9, .78, .72); eyes(.23, 1.22, -.375, .1); box(0, .92, -.38, .37, .06, .03, '#6e3f47');
      for (const s of [-1, 1]) { box(s * .24, .36, 0, .16, .72, .17, '#784f52', 'leg', s); for (let i = 0; i < 3; i++) box(s * .56, .85 + i * .2, 0, .33, .04, .035, '#ddd3be'); } break;
    }
    case 'snowman': {
      box(0, .42, 0, .73, .82, .65); box(0, 1.03, 0, .55, .48, .49); box(0, 1.53, 0, .54, .52, .52, sheared ? c : '#c2934e'); eyes(.13, 1.61, -.276, .07); box(0, 1.4, -.277, .23, .08, .03, '#634d37');
      for (let i = 0; i < 3; i++) box(0, .48 + i * .23, -.34, .08, .08, .035, '#56605e');
      for (const s of [-1, 1]) box(s * .56, 1.07, 0, .61, .06, .06, '#927755', 'arm', s); break;
    }
    case 'wither': {
      box(0, 1.32, 0, .33, 1.29, .3); box(0, 1.8, 0, 1.8, .18, .19);
      for (const x of [-.72, 0, .72]) { const y = x ? 1.93 : 2.32; box(x, y, 0, .48, .48, .44); eye(x - .12, y + .06, -.235, .07, '#c4c4bb'); eye(x + .12, y + .06, -.235, .07, '#c4c4bb'); box(x, y - .12, -.24, .29, .07, .025, '#bbbfb7'); }
      for (let i = 0; i < 3; i++) box(0, 1.05 + i * .2, -.1, .86 - i * .12, .08, .23, '#777b7b'); break;
    }
    default: throw new Error(`Missing model family: ${d.model}`);
  }
  if (d.weapon) {
    const weapon = ITEMS[d.weapon], color = weapon?.color || '#b6bdb9';
    if (d.weapon === 'bow' || d.weapon === 'crossbow') { box(-.49, 1.09, -.33, .07, .77, .07, '#9b7d54', 'arm'); box(-.49, 1.09, -.46, .025, .7, .025, '#d7d5bf', 'arm'); for (const y of [.71, 1.46]) box(-.49, y, -.39, .07, .08, .2, '#9b7d54', 'arm'); }
    else { box(-.48, 1.09, -.36, .07, .45, .07, '#9b7d54', 'arm'); box(-.48, 1.62, -.36, .13, .67, .06, color, 'arm'); box(-.48, 1.29, -.36, .35, .075, .09, color, 'arm'); if (d.weapon.includes('axe')) box(-.6, 1.79, -.36, .34, .28, .07, color, 'arm'); if (d.weapon === 'trident') for (const s of [-1, 1]) box(-.48 + s * .18, 1.83, -.36, .055, .34, .055, color, 'arm'); }
  }
  const height = Math.max(...parts.map(p => p.y + p.h / 2));
  const scale = d.height / Math.max(height, .1);
  for (const part of parts) { for (const key of ['x', 'y', 'z', 'w', 'h', 'l']) part[key] *= scale; }
  skinCache.set(key, parts); return parts;
}

export class MobRenderer {
  constructor(scene) {
    this.scene = scene;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = 215 + (x * 31 + y * 17 + x * y * 11) % 40; ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x, y, 1, 1); }
    const texture = new THREE.CanvasTexture(canvas); texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: texture }), 8192);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0; scene.add(this.mesh);
    this.glow = new THREE.InstancedMesh(this.mesh.geometry, new THREE.MeshBasicMaterial({ map: texture }), 2048);
    this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.glow.frustumCulled = false; this.glow.count = 0; scene.add(this.glow);
    this.object = new THREE.Object3D(); this.matrix = new THREE.Matrix4(); this.parent = new THREE.Matrix4(); this.rotation = new THREE.Quaternion(); this.position = new THREE.Vector3(); this.scale = new THREE.Vector3(); this.color = new THREE.Color(); this.colors = new Map();
  }
  render(system, player, time) {
    if (!system) { this.mesh.count = this.glow.count = 0; return; }
    let index = 0, glowIndex = 0;
    const add = (x, y, z, w, h, l, color, rotation = 0, axis = 'x', glowing = false) => {
      const mesh = glowing ? this.glow : this.mesh, current = glowing ? glowIndex : index;
      if (current >= (glowing ? 2048 : 8192)) return;
      this.object.position.set(x, y, z); this.object.scale.set(w, h, l); this.object.rotation.set(axis === 'x' ? rotation : 0, axis === 'y' ? rotation : 0, axis === 'z' ? rotation : 0); this.object.updateMatrix();
      this.matrix.multiplyMatrices(this.parent, this.object.matrix); mesh.setMatrixAt(current, this.matrix);
      if (!this.colors.has(color)) this.colors.set(color, new THREE.Color(color));
      mesh.setColorAt(current, this.colors.get(color));
      if (glowing) glowIndex++; else index++;
    };
    for (const m of system.mobs) {
      if (Math.hypot(m.x - player.x, m.z - player.z) > (MOBS[m.type].boss ? 80 : 48)) continue;
      const d = MOBS[m.type], moving = ['chase', 'wander', 'follow', 'flee'].includes(m.activity), t = time + m.uid;
      const bounce = d.hop && moving ? Math.abs(Math.sin(t * 4)) * .25 : d.movement === 'fly' ? Math.sin(t * 3) * .04 : 0;
      const pulse = m.fuse ? 1 + Math.sin(time * 25) * .05 : 1;
      this.position.set(m.x, m.y + bounce, m.z); this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, m.yaw); this.scale.setScalar(m.scale * pulse); this.parent.compose(this.position, this.rotation, this.scale);
      if (m.rolled) add(0, .3, 0, .7, .55, .7, d.color);
      else for (const part of mobParts(m.type, m.sheared)) {
        let { x, y, z, w, h, l, color, motion, phase, angle } = part;
        let rotation = angle;
        if (motion === 'leg' || motion === 'arm') rotation += m.attack && motion === 'arm' ? -1.2 : moving ? Math.sin(t * 7 + phase) * .38 : 0;
        if (motion === 'wing') { rotation = Math.sin(t * (d.model === 'bee' ? 28 : 10)) * .6 * phase; y += Math.sin(t * 10) * .06; }
        if (motion === 'tail' || motion === 'tentacle') rotation += Math.sin(t * 3 + phase) * .2;
        if (motion === 'orbit') { const r = Math.hypot(x, z); x = Math.cos(t * 2 + phase) * r; z = Math.sin(t * 2 + phase) * r; }
        if (m.hurt > 0 || m.burning) color = '#cf7767';
        add(x, y, z, w, h, l, color, rotation, motion === 'wing' ? 'z' : motion === 'tail' ? 'y' : 'x', d.glow || d.model === 'blaze' || ['enderman', 'warden', 'creaking'].includes(m.type) && color === d.accent);
      }
      if (m.saddled) add(0, d.height * .67, .15, d.width * .84, .12, .55, '#a7774f');
      if (m.tamed && ['wolf', 'cat'].includes(m.type)) add(0, d.height * .57, -.2, d.width * .8, .1, .14, m.petArmor ? '#c29685' : '#ba5454');
      if (m.love > 0) { add(-.08, d.height + .25 + Math.sin(t * 2) * .06, 0, .12, .14, .08, '#dd6b79'); add(.06, d.height + .25, 0, .12, .14, .08, '#dd6b79'); add(0, d.height + .15, 0, .12, .13, .08, '#dd6b79'); }
    }
    this.parent.identity();
    for (const loot of system.drops) { if (Math.hypot(loot.x - player.x, loot.z - player.z) > 35) continue; add(loot.x, loot.y + .2 + Math.sin(time * 2 + loot.uid) * .07, loot.z, .2, .2, .2, ITEMS[loot.id].color, time); }
    for (const shot of system.projectiles) add(shot.x, shot.y, shot.z, shot.type === 'tnt' ? .8 : .13, shot.type === 'tnt' ? .8 : .13, shot.type === 'tnt' ? .8 : .35, shot.type === 'tnt' ? Math.sin(time * 15) > 0 ? '#e9e3d4' : '#ce6155' : shot.color);
    for (const crop of system.crops) {
      const h = .15 + Math.min(1, crop.age / 30) * .65;
      add(crop.x, crop.y + h / 2, crop.z, .07, h, .07, '#6e9849');
      for (const s of [-1, 1]) add(crop.x + s * .12, crop.y + h * .7, crop.z, .2, .09, .11, crop.age >= 30 ? '#d1bc70' : '#82aa53');
    }
    this.mesh.count = index; this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.glow.count = glowIndex; this.glow.instanceMatrix.needsUpdate = true;
    if (this.glow.instanceColor) this.glow.instanceColor.needsUpdate = true;
  }
}
