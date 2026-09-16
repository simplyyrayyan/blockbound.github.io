// Rest poses that Bedrock normally supplies through animation controllers.
// Geometry alone leaves rods coincident, spiders flat, and dragon limbs apart.
export function referencePose(id, source) {
  const data = structuredClone(source), bones = data.bones;
  const shift = (bone, offset) => {
    if (bone.pivot) bone.pivot = bone.pivot.map((v, i) => v + offset[i]);
    for (const cube of bone.cubes || []) { cube.origin = cube.origin.map((v, i) => v + offset[i]); if (cube.pivot) cube.pivot = cube.pivot.map((v, i) => v + offset[i]); }
  };
  if (id === 'blaze') for (const bone of bones) {
    const index = Number(bone.name.replace('upperBodyParts', '')); if (!Number.isInteger(index)) continue;
    const ring = Math.floor(index / 4), angle = index % 4 * Math.PI / 2 + ring * .7, radius = 7 - ring;
    shift(bone, [Math.cos(angle) * radius, -ring * 7, Math.sin(angle) * radius]);
  }
  if (id === 'spider' || id === 'cave_spider') for (const bone of bones) {
    if (!/^leg[0-7]$/.test(bone.name)) continue;
    const i = Number(bone.name.slice(3)), side = i % 2 ? -1 : 1;
    bone.rotation = [0, (Math.floor(i / 2) - 1.5) * 24 * side, side * 28];
  }
  if (id === 'horse' || id === 'skeleton_horse' || id === 'zombie_horse') for (const bone of bones) if (/MuleEar|Bag/.test(bone.name)) bone.neverRender = true;
  if (id === 'donkey' || id === 'mule') for (const bone of bones) if (/^Ear[LR]$/.test(bone.name)) bone.neverRender = true;
  if (id === 'sheep') for (const bone of bones) if (/^leg/.test(bone.name)) for (const cube of bone.cubes || []) {
    // The wool mesh only covers the upper legs; add the exposed lower legs.
    bone.cubes.push({ origin: [cube.origin[0], 0, cube.origin[2]], size: [4, 6, 4], uv: [0, 16] }); break;
  }
  if (id === 'ender_dragon') {
    const wing = bones.find(b => b.name === 'wing'), opposite = bones.find(b => b.name === 'wing1');
    opposite.cubes = structuredClone(wing.cubes).map(c => ({ ...c, origin: [-c.origin[0] - c.size[0], c.origin[1], c.origin[2]], mirror: !c.mirror }));
    const tip = bones.find(b => b.name === 'wingtip'); shift(tip, [-12, -5, 2]); tip.parent = 'wing'; tip.pivot = [-68, 19, 2];
    const right = bones.find(b => b.name === 'wingtip1'); right.cubes = structuredClone(tip.cubes).map(c => ({ ...c, origin: [-c.origin[0] - c.size[0], c.origin[1], c.origin[2]], mirror: !c.mirror })); right.parent = 'wing1'; right.pivot = [68, 19, 2];
    for (const [name, x, y, z, parent] of [['rearlegtip', -16, -16, 42, 'rearleg'], ['rearlegtip1', 16, -16, 42, 'rearleg1'], ['frontlegtip', -12, -18, 2, 'frontleg'], ['frontlegtip1', 12, -18, 2, 'frontleg1'], ['rearfoot', -16, -45, 42, 'rearlegtip'], ['rearfoot1', 16, -45, 42, 'rearlegtip1'], ['frontfoot', -12, -38, 2, 'frontlegtip'], ['frontfoot1', 12, -38, 2, 'frontlegtip1']]) {
      const bone = bones.find(b => b.name === name); shift(bone, [x, y, z]); bone.parent = parent;
    }
    // Tuck limbs under the body in flight; keep all child joints connected.
    for (const bone of bones) {
      if (/^(front|rear)leg1?$/.test(bone.name)) bone.rotation = [65, 0, 0];
      if (bone.name === 'head' || bone.name === 'neck') shift(bone, [0, -10, -13]);
    }
    const tail = bones.find(b => b.name === 'neck');
    for (let i = 0; i < 7; i++) { const bone = structuredClone(tail); bone.name = 'tail' + i; shift(bone, [0, -2 - i * .3, 60 + i * 8]); bones.push(bone); }
  }
  return data;
}
