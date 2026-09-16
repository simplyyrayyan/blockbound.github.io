import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import assets from './data/mob-assets.json' with { type: 'json' };
import { MOBS } from './mob-catalog.js';
import { referencePose } from './reference-poses.js';

const faces = [
  { name: 'east', corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { name: 'west', corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { name: 'up', corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { name: 'down', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { name: 'south', corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { name: 'north', corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];
const radians = n => (Number(n) || 0) * Math.PI / 180;
// Bedrock uses clockwise X/Y rotations. Cubes without an explicit pivot rotate
// about their own center, not the bone origin (notably pigs and chickens).
const rotationFor = (rotation = [0, 0, 0]) => new THREE.Euler(-radians(rotation[0]), -radians(rotation[1]), radians(rotation[2]), 'ZYX');
export function buildReferenceGeometry(data) {
  const definitions = data.bones, bones = definitions.map(d => { const bone = new THREE.Bone(); bone.name = d.name; return bone; });
  const byName = new Map(definitions.map((b, i) => [b.name, i]));
  const root = new THREE.Group();
  for (let i = 0; i < bones.length; i++) {
    const definition = definitions[i], pivot = definition.pivot || [0, 0, 0], parent = byName.get(definition.parent), parentPivot = parent === undefined ? [0, 0, 0] : definitions[parent].pivot || [0, 0, 0];
    bones[i].position.fromArray(pivot.map((v, axis) => (v - parentPivot[axis]) / 16));
    bones[i].rotation.copy(rotationFor(definition.rotation));
    if (parent === undefined) root.add(bones[i]); else bones[parent].add(bones[i]);
  }
  root.updateMatrixWorld(true);
  const positions = [], uvs = [], indices = [], weights = [], point = new THREE.Vector3();
  for (let i = 0; i < definitions.length; i++) {
    const bone = definitions[i]; if (bone.neverRender) continue;
    const pivot = bone.pivot || [0, 0, 0], transform = bones[i].matrixWorld.clone().multiply(new THREE.Matrix4().makeTranslation(-pivot[0] / 16, -pivot[1] / 16, -pivot[2] / 16));
    if (bone.bind_pose_rotation) {
      transform.multiply(new THREE.Matrix4().makeTranslation(...pivot.map(v => v / 16)))
        .multiply(new THREE.Matrix4().makeRotationFromEuler(rotationFor(bone.bind_pose_rotation)))
        .multiply(new THREE.Matrix4().makeTranslation(...pivot.map(v => -v / 16)));
    }
    for (const cube of bone.cubes || []) {
      const origin = cube.origin || [0, 0, 0], size = cube.size || [0, 0, 0], inflate = cube.inflate || 0;
      const [w, h, d] = size, uv = cube.uv || [0, 0];
      const matrix = transform.clone();
      if (cube.rotation) {
        const cp = cube.pivot || origin.map((value, axis) => value + size[axis] / 2), rotation = new THREE.Matrix4().makeRotationFromEuler(rotationFor(cube.rotation));
        matrix.multiply(new THREE.Matrix4().makeTranslation(cp[0] / 16, cp[1] / 16, cp[2] / 16)).multiply(rotation).multiply(new THREE.Matrix4().makeTranslation(-cp[0] / 16, -cp[1] / 16, -cp[2] / 16));
      }
      const unwrap = Array.isArray(uv) ? [[uv[0] + d + w, uv[1] + d, d, h], [uv[0], uv[1] + d, d, h], [uv[0] + d, uv[1], w, d], [uv[0] + d + w, uv[1], w, d], [uv[0] + 2 * d + w, uv[1] + d, w, h], [uv[0] + d, uv[1] + d, w, h]] : null;
      for (let f = 0; f < 6; f++) {
        const face = faces[f], source = Array.isArray(uv) ? null : uv[face.name];
        if (!unwrap && !source) continue;
        const rect = unwrap ? unwrap[f] : [...source.uv, ...(source.uv_size || [w, h])];
        const [u, v, uw, vh] = rect, mirror = cube.mirror ?? bone.mirror;
        const coords = [[u, v + vh], [u + uw, v + vh], [u + uw, v], [u, v]];
        for (const vertex of [0, 1, 2, 0, 2, 3]) {
          const corner = face.corners[vertex];
          point.fromArray(corner.map((value, axis) => (origin[axis] - inflate + value * (Math.max(.001, size[axis]) + inflate * 2)) / 16)).applyMatrix4(matrix);
          positions.push(point.x, point.y, point.z);
          const coord = coords[mirror ? [1, 0, 3, 2][vertex] : vertex]; uvs.push(coord[0] / data.width, 1 - coord[1] / data.height);
          indices.push(i, 0, 0, 0); weights.push(1, 0, 0, 0);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, bones, root };
}

export class ReferenceMobRenderer {
  constructor(scene) { this.scene = scene; this.templates = new Map(); this.instances = new Map(); }
  async load() {
    const loader = new THREE.TextureLoader();
    await Promise.all(Object.entries(assets).map(async ([id, data]) => {
      try {
        const texture = await loader.loadAsync(new URL(`assets/mobs/${id}.png`, document.baseURI).href);
        texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = texture.minFilter = THREE.NearestFilter;
        const { geometry, bones, root } = buildReferenceGeometry(referencePose(id, data));
        const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: .1, side: THREE.DoubleSide });
        const mesh = new THREE.SkinnedMesh(geometry, material); mesh.add(root); mesh.bind(new THREE.Skeleton(bones)); mesh.frustumCulled = false;
        const bounds = geometry.boundingBox, height = Math.max(.1, bounds.max.y - bounds.min.y);
        mesh.userData.scale = MOBS[id].height / height; mesh.userData.offset = -bounds.min.y;
        this.templates.set(id, mesh);
      } catch (error) { console.warn(`Using voxel fallback for ${id}: ${error.message}`); }
    }));
  }
  has(id) { return this.templates.has(id); }
  render(system, player, time) {
    const present = new Set();
    for (const mob of system?.mobs || []) {
      if (!this.templates.has(mob.type) || mob.rolled || mob.absorbed) continue;
      const distance = Math.hypot(mob.x - player.x, mob.z - player.z); if (distance > (MOBS[mob.type].boss ? 80 : 48)) continue;
      present.add(mob.uid);
      let record = this.instances.get(mob.uid);
      if (record?.type !== mob.type) { if (record) this.remove(mob.uid); record = null; }
      if (!record) {
        const mesh = clone(this.templates.get(mob.type)); mesh.material = mesh.material.clone();
        const group = new THREE.Group(); group.add(mesh); this.scene.add(group);
        mesh.position.y = mesh.userData.offset;
        record = { mesh, group, type: mob.type, rests: mesh.skeleton.bones.map(b => ({ rotation: b.rotation.clone(), position: b.position.clone() })) }; this.instances.set(mob.uid, record);
      }
      const { mesh, group, rests } = record, def = MOBS[mob.type], moving = ['chase', 'wander', 'follow', 'flee'].includes(mob.activity);
      const bounce = def.hop && moving ? Math.abs(Math.sin(time * 4 + mob.uid)) * .12 : 0;
      const alpha = Math.min(1, (system.accumulator || 0) / .05);
      const x = mob.previousX === undefined ? mob.x : THREE.MathUtils.lerp(mob.previousX, mob.x, alpha);
      const y = mob.previousY === undefined ? mob.y : THREE.MathUtils.lerp(mob.previousY, mob.y, alpha);
      const z = mob.previousZ === undefined ? mob.z : THREE.MathUtils.lerp(mob.previousZ, mob.z, alpha);
      group.position.set(x, y + bounce, z); group.rotation.y = mob.yaw; group.scale.setScalar(mesh.userData.scale * mob.scale * (mob.fuse ? 1 + Math.sin(time * 24) * .045 : 1));
      mesh.material.color.set(mob.hurt > 0 || mob.burning ? '#ff8a82' : mob.type === 'sheep' && mob.dye ? ({ red: '#b84035', blue: '#4256a2', green: '#63813a', yellow: '#e5cc39', pink: '#eca4b8', black: '#292929', cyan: '#378787', purple: '#8e46aa' }[mob.dye] || '#ffffff') : '#ffffff'); mesh.material.transparent = mob.status?.type === 'invisibility'; mesh.material.opacity = mesh.material.transparent ? .12 : 1;
      for (let i = 0; i < mesh.skeleton.bones.length; i++) {
        const bone = mesh.skeleton.bones[i], name = bone.name.toLowerCase(), rest = rests[i]; bone.rotation.copy(rest.rotation); bone.position.copy(rest.position);
        const phase = /leg[03]$|front_left|back_right|hind_right/.test(name) ? 0 : /leg[12]$|front_right|back_left|hind_left/.test(name) ? Math.PI : /left/.test(name) ? 0 : Math.PI;
        if (/leg|arm/.test(name) && !/armor|chest/.test(name)) bone.rotation.x += mob.attack && /arm/.test(name) ? -1.3 : moving ? Math.sin(time * 7 + mob.uid + phase) * .55 : mob.sitting ? -.5 : 0;
        if (/wing/.test(name)) bone.rotation.z += Math.sin(time * (mob.type === 'bee' ? 28 : def.boss ? 2.5 : 7)) * .45 * (/left|1$/.test(name) ? 1 : -1);
        if (mob.type === 'blaze' && name.startsWith('upperbodyparts')) { const i = Number(name.replace('upperbodyparts', '')), ring = Math.floor(i / 4), angle = i % 4 * Math.PI / 2 + ring * .7 + time * (ring % 2 ? -1 : 1); bone.position.x = Math.cos(angle) * (7 - ring) / 16; bone.position.z = Math.sin(angle) * (7 - ring) / 16; }
        if (/tentacle|tail/.test(name)) bone.rotation.x += Math.sin(time * 3 + i) * .18;
        if (/head/.test(name) && !def.boss) bone.rotation.y += Math.sin(time * .8 + mob.uid) * .08;
        if (mob.type === 'zombie' && /arm/.test(name)) bone.rotation.x = -Math.PI / 2 + Math.sin(time * 2) * .05;
        const hidden = mob.sheared && /wool|fur/.test(name) || /saddle|bridle|reins|bit[lr]$/.test(name) && !mob.saddled || /bag[lr]$/.test(name) && !mob.storage;
        bone.scale.setScalar(hidden ? .001 : 1);
      }
    }
    for (const uid of this.instances.keys()) if (!present.has(uid)) this.remove(uid);
  }
  remove(uid) { const entry = this.instances.get(uid); if (!entry) return; this.scene.remove(entry.group); entry.mesh.skeleton.dispose(); entry.mesh.material.dispose(); this.instances.delete(uid); }
}
