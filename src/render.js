import * as THREE from 'three';
import { B, BLOCKS, ITEMS, isSolid, isTransparent } from './catalog.js';
import { SIZE, HEIGHT, CHUNK, SEA, hash, clamp } from './world.js';

const FACES = [
  { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: .87 },
  { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: .76 },
  { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: .58 },
  { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: .94 },
  { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: .82 },
];

function colorVariation(hex, delta) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, delta);
  return `#${c.getHexString()}`;
}

export function makeAtlas() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  for (let id = 1; id < BLOCKS.length; id++) for (let side = 0; side < 3; side++) {
    const index = id * 3 + side, ox = index % 8 * 16, oy = Math.floor(index / 8) * 16;
    ctx.save(); ctx.translate(ox, oy);
    let base = BLOCKS[id].color;
    if ([B.COAL, B.IRON, B.GOLD, B.DIAMOND].includes(id)) base = '#85898a';
    if (id === B.GRASS && side > 0) base = '#916341';
    if (id === B.LOG && side !== 1) base = '#bf985e';
    for (let px = 0; px < 16; px++) for (let py = 0; py < 16; py++) {
      ctx.fillStyle = colorVariation(base, (hash(px, id + side, py, 333) - .5) * .11);
      ctx.fillRect(px, py, 1, 1);
    }
    if (id === B.GRASS && side === 1) {
      for (let x = 0; x < 16; x++) { ctx.fillStyle = colorVariation('#80a94d', (hash(x, 0, 0) - .5) * .08); ctx.fillRect(x, 0, 1, 3 + Math.floor(hash(x, 0, 0) * 3)); }
    }
    if (id === B.LOG) {
      ctx.strokeStyle = '#6d4b32'; ctx.lineWidth = 1;
      if (side === 1) {
        for (let x = 1; x < 16; x += 3) { ctx.fillStyle = x % 2 ? '#65482e' : '#a4774a'; ctx.fillRect(x, 0, 1, 16); ctx.fillRect(x + 1, (x * 3) % 13, 1, 4); }
      } else { for (let inset = 1.5; inset < 8; inset += 3) ctx.strokeRect(inset, inset, 16 - inset * 2, 16 - inset * 2); }
    }
    if ([B.COAL, B.IRON, B.GOLD, B.DIAMOND].includes(id)) {
      const gem = BLOCKS[id].color;
      for (const [x, y] of [[2, 3], [9, 2], [6, 7], [11, 11], [2, 12]]) {
        ctx.fillStyle = colorVariation(gem, -.09); ctx.fillRect(x, y, 3, 3);
        ctx.fillStyle = gem; ctx.fillRect(x, y, 2, 2);
        ctx.fillStyle = colorVariation(gem, .1); ctx.fillRect(x, y, 1, 1);
      }
    }
    if (id === B.LEAVES) {
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        const r = hash(x, id, y);
        if (r < .055) ctx.clearRect(x, y, 1, 1);
        else if (r < .22) { ctx.fillStyle = '#335d37'; ctx.fillRect(x, y, 2, 1); }
      }
    }
    if (id === B.PLANKS || id === B.TABLE || id === B.BRICK) {
      ctx.fillStyle = id === B.BRICK ? '#626b69' : '#815b38';
      for (let y = 3; y < 16; y += 4) { ctx.fillRect(0, y, 16, 1); ctx.fillRect(y % 8 ? 4 : 11, y - 3, 1, 3); }
      if (id === B.TABLE) {
        ctx.fillStyle = '#62452f'; ctx.fillRect(0, 0, 16, 2); ctx.fillRect(0, 0, 2, 16); ctx.fillRect(14, 0, 2, 16); ctx.fillRect(0, 14, 16, 2);
        if (side === 0) { ctx.fillRect(6, 2, 1, 12); ctx.fillRect(10, 2, 1, 12); ctx.fillRect(2, 6, 12, 1); ctx.fillRect(2, 10, 12, 1); }
        else { ctx.fillStyle = '#453c31'; ctx.fillRect(4, 5, 8, 3); ctx.fillRect(5, 8, 2, 5); ctx.fillRect(10, 8, 1, 4); }
      }
    }
    if (id === B.GLASS) {
      ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = 'rgba(195,235,233,.12)'; ctx.fillRect(0, 0, 16, 16);
      ctx.strokeStyle = '#bddee1'; ctx.strokeRect(.5, .5, 15, 15); ctx.fillStyle = '#e4f4ed'; ctx.fillRect(3, 3, 2, 1); ctx.fillRect(5, 4, 2, 1); ctx.fillRect(10, 11, 2, 1);
    }
    if (id === B.WATER) { ctx.fillStyle = 'rgba(215,242,235,.13)'; ctx.fillRect(1, 5, 6, 1); ctx.fillRect(8, 12, 6, 1); }
    if (id === B.TORCH) { ctx.fillStyle = '#654b32'; ctx.fillRect(0, 5, 16, 11); ctx.fillStyle = '#fff3a0'; ctx.fillRect(0, 0, 16, 5); }
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter; texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas };
}

export class VoxelRenderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#b7d6da');
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#b7d6da');
    this.scene.fog = new THREE.Fog('#b7d6da', 32, 90);
    this.camera = new THREE.PerspectiveCamera(74, 1, .04, 200);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.ambient = new THREE.HemisphereLight('#d7e9f0', '#706651', 2.05); this.scene.add(this.ambient);
    this.sunlight = new THREE.DirectionalLight('#fff0cf', 2.1); this.sunlight.position.set(-40, 70, 25); this.scene.add(this.sunlight);
    const atlas = makeAtlas(); this.atlas = atlas.canvas;
    this.material = new THREE.MeshLambertMaterial({ map: atlas.texture, vertexColors: true, alphaTest: .45 });
    this.waterMaterial = new THREE.MeshPhongMaterial({ map: atlas.texture, transparent: true, opacity: .66, vertexColors: true, depthWrite: false, shininess: 80, specular: '#cbe5d9' });
    this.glassMaterial = new THREE.MeshLambertMaterial({ map: atlas.texture, transparent: true, vertexColors: true, depthWrite: false });
    this.chunks = new Map(); this.particles = []; this.animals = []; this.clouds = new THREE.Group(); this.scene.add(this.clouds);
    this.particleGeometry = new THREE.BoxGeometry(.09, .09, .09);
    this.particleMaterials = BLOCKS.map(b => new THREE.MeshLambertMaterial({ color: b.color || '#ffffff' }));
    this.torchLights = Array.from({ length: 6 }, () => { const light = new THREE.PointLight('#ffbb65', 0, 11, 1.1); this.scene.add(light); return light; });
    const edgeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006));
    this.outline = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({ color: '#e9f9b6', transparent: true, opacity: .9 }));
    this.outline.visible = false; this.scene.add(this.outline);
    this.cracks = Array.from({ length: 6 }, (_, level) => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const ctx = c.getContext('2d'); ctx.strokeStyle = '#172624'; ctx.lineWidth = 1 + level * .2;
      for (let i = 0; i <= level + 2; i++) { ctx.beginPath(); ctx.moveTo(16, 16); for (let j = 1; j <= 4; j++) ctx.lineTo(16 + Math.cos(i * 2.31 + j * .18) * j * 5, 16 + Math.sin(i * 2.31 + j * .18) * j * 5); ctx.stroke(); }
      const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter;
      return new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    });
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.008, 1.008, 1.008), this.cracks[0]); this.crackMesh.visible = false; this.scene.add(this.crackMesh);
    this.hand = new THREE.Group(); this.hand.scale.setScalar(.57); this.camera.add(this.hand); this.heldId = null;
    this.sun = new THREE.Mesh(new THREE.BoxGeometry(5, 5, .5), new THREE.MeshBasicMaterial({ color: '#fff2c2', fog: false })); this.scene.add(this.sun);
    this.moon = new THREE.Mesh(new THREE.BoxGeometry(3, 3, .5), new THREE.MeshBasicMaterial({ color: '#cbe8ef', fog: false })); this.scene.add(this.moon);
    this.makeClouds();
    this.resize();
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  attach(world) {
    this.clearWorld(); this.world = world;
    for (let x = 0; x < SIZE / CHUNK; x++) for (let z = 0; z < SIZE / CHUNK; z++) this.rebuild(x, z);
    this.makeAnimals();
  }
  clearWorld() {
    for (const meshes of this.chunks.values()) for (const mesh of meshes) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    this.chunks.clear();
    for (const a of this.animals) { this.scene.remove(a.group); a.group.traverse(o => { o.geometry?.dispose(); if (o.material) o.material.dispose(); }); }
    this.animals = [];
    for (const p of this.particles) this.scene.remove(p.mesh);
    this.particles = [];
    this.outline.visible = this.crackMesh.visible = false;
  }
  rebuild(cx, cz) {
    const key = `${cx},${cz}`;
    for (const mesh of this.chunks.get(key) || []) { this.scene.remove(mesh); mesh.geometry.dispose(); }
    const buffers = Array.from({ length: 3 }, () => ({ positions: [], normals: [], uvs: [], colors: [] }));
    for (let x = cx * CHUNK; x < (cx + 1) * CHUNK; x++) for (let z = cz * CHUNK; z < (cz + 1) * CHUNK; z++) for (let y = 0; y < HEIGHT; y++) {
      const id = this.world.get(x, y, z); if (!id) continue;
      const buf = buffers[id === B.WATER ? 1 : id === B.GLASS ? 2 : 0];
      for (let f = 0; f < 6; f++) {
        const face = FACES[f], [nx, ny, nz] = face.n;
        const neighbor = this.world.get(x + nx, y + ny, z + nz);
        if (id !== B.TORCH && (!isTransparent(neighbor) || (neighbor === id && (id === B.WATER || id === B.GLASS || id === B.LEAVES)))) continue;
        const tile = id * 3 + (f === 2 ? 0 : f === 3 ? 2 : 1);
        const u0 = (tile % 8 + .001) / 8, u1 = (tile % 8 + .999) / 8;
        const v0 = 1 - (Math.floor(tile / 8) + .999) / 8, v1 = 1 - (Math.floor(tile / 8) + .001) / 8;
        const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        const depthShade = clamp(.56 + y / 28, .6, 1);
        for (const vi of [0, 1, 2, 0, 2, 3]) {
          const v = face.v[vi];
          let vx = v[0], vy = v[1], vz = v[2];
          if (id === B.WATER && vy === 1 && this.world.get(x, y + 1, z) !== B.WATER) vy = .86;
          if (id === B.TORCH) { vx = .44 + vx * .12; vy *= .72; vz = .44 + vz * .12; }
          buf.positions.push(x + vx, y + vy, z + vz); buf.normals.push(nx, ny, nz); buf.uvs.push(...uv[vi]);
          const shade = face.shade * depthShade;
          buf.colors.push(shade, shade, shade);
        }
      }
    }
    const meshes = [];
    buffers.forEach((buf, i) => {
      if (!buf.positions.length) return;
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3)); geom.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
      geom.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2)); geom.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3)); geom.computeBoundingSphere();
      const mesh = new THREE.Mesh(geom, [this.material, this.waterMaterial, this.glassMaterial][i]); this.scene.add(mesh); meshes.push(mesh);
    });
    this.chunks.set(key, meshes);
  }
  flush() {
    for (const key of this.world.dirty) { const [x, z] = key.split(',').map(Number); this.rebuild(x, z); }
    this.world.dirty.clear();
  }
  makeClouds() {
    const material = new THREE.MeshBasicMaterial({ color: '#f4f3e6', transparent: true, opacity: .78 });
    for (let i = 0; i < 18; i++) {
      const g = new THREE.Group();
      for (let j = 0; j < 4; j++) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(6 + hash(i, j, 1) * 8, 1.5, 4 + hash(i, j, 2) * 6), material); mesh.position.set(j * 4, j % 2 * .8, j % 3 * 2); g.add(mesh); }
      g.position.set(hash(i, 0, 4) * 190 - 40, 43 + hash(i, 0, 5) * 15, hash(i, 0, 6) * 190 - 40); this.clouds.add(g);
    }
  }
  box(w, h, d, color, x, y, z, parent) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color })); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  makeAnimals() {
    for (const [i, dx, dz] of [[0, -3, 5], [1, 5, 4], [2, -12, -10], [3, 14, 12], [4, -14, 13]]) {
      const x = SIZE / 2 + dx, z = SIZE / 2 + dz, y = this.world.surface(x, z);
      if (this.world.get(x, y - 1, z) !== B.GRASS) continue;
      const group = new THREE.Group();
      this.box(.75, .63, 1.05, '#f5edda', 0, .84, 0, group);
      this.box(.38, .4, .48, '#70655a', 0, 1.05, -.64, group);
      this.box(.43, .16, .45, '#f5edda', 0, 1.28, -.62, group);
      this.box(.08, .06, .03, '#242e29', -.13, 1.1, -.89, group); this.box(.08, .06, .03, '#242e29', .13, 1.1, -.89, group);
      const legs = []; for (const lx of [-.24, .24]) for (const lz of [-.33, .33]) legs.push(this.box(.15, .5, .16, '#7c7364', lx, .27, lz, group));
      group.position.set(x + .5, y, z + .5); this.scene.add(group); this.animals.push({ group, legs, baseX: x + .5, baseZ: z + .5, phase: i * 1.7 });
    }
  }
  setHeld(id) {
    if (id === this.heldId) return; this.heldId = id;
    for (const child of [...this.hand.children]) { this.hand.remove(child); child.traverse(o => { o.geometry?.dispose(); if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { if (m.map && m.map !== this.material.map) m.map.dispose(); m.dispose(); } }); }
    const def = ITEMS[id];
    const g = new THREE.Group(); this.hand.add(g);
    if (def?.tool) {
      this.box(.07, .55, .07, '#86613f', 0, -.12, 0, g);
      if (def.tool === 'pick') {
        this.box(.52, .085, .09, def.color, .03, .18, 0, g); this.box(.085, .14, .09, def.color, -.23, .11, 0, g); this.box(.085, .12, .09, def.color, .28, .12, 0, g);
      } else if (def.tool === 'axe') this.box(.22, .23, .08, def.color, -.07, .13, 0, g);
      else this.box(.19, .23, .06, def.color, 0, .22, 0, g);
      g.rotation.z = -.36;
    } else if (def?.block) {
      const mats = FACES.map((_, f) => {
        const tile = def.block * 3 + (f === 2 ? 0 : f === 3 ? 2 : 1);
        const texture = this.material.map.clone(); texture.repeat.set(1 / 8, 1 / 8); texture.offset.set(tile % 8 / 8, 1 - (Math.floor(tile / 8) + 1) / 8); texture.needsUpdate = true;
        return new THREE.MeshLambertMaterial({ map: texture });
      });
      g.add(new THREE.Mesh(new THREE.BoxGeometry(.27, .27, .27), mats)); g.rotation.set(.12, -.45, -.15);
    } else if (def?.food) { this.box(.18, .19, .16, '#ce6549', 0, 0, 0, g); this.box(.025, .07, .025, '#81623a', 0, .11, 0, g); }
    else { this.box(.16, .35, .17, '#d6a781', 0, 0, 0, g); this.box(.165, .15, .175, '#566d50', 0, -.17, 0, g); g.rotation.z = -.2; }
    this.hand.traverse(o => { if (o.material) for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.depthTest = false; m.depthWrite = false; } o.renderOrder = 5; });
  }
  debris(hit) {
    const geometry = this.particleGeometry;
    const material = this.particleMaterials[hit.id];
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(hit.x + .5, hit.y + .5, hit.z + .5);
      this.scene.add(mesh); this.particles.push({ mesh, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 2, vz: (Math.random() - .5) * 3, life: .7 + Math.random() * .3 });
    }
  }
  target(hit, progress) {
    this.outline.visible = !!hit; this.crackMesh.visible = !!hit && progress > 0;
    if (!hit) return;
    this.outline.position.set(hit.x + .5, hit.y + .5, hit.z + .5);
    this.crackMesh.position.copy(this.outline.position);
    this.crackMesh.material = this.cracks[clamp(Math.floor(progress * 6), 0, 5)];
  }
  update(dt, time, player, { swing = 0, moving = false, menu = false } = {}) {
    const daylight = clamp(Math.sin((time - 6) / 24 * Math.PI * 2) * 2.3, 0, 1);
    const sky = new THREE.Color('#1d2b44').lerp(new THREE.Color('#b8d6d9'), daylight);
    this.scene.background.copy(sky); this.scene.fog.color.copy(sky);
    const underground = !menu && this.world.heights[Math.floor(player.z) * SIZE + Math.floor(player.x)] > player.y + 2;
    this.ambient.intensity = (.55 + daylight * .95) * (underground ? .27 : 1); this.sunlight.intensity = (.14 + daylight * 1.15) * (underground ? .12 : 1);
    const angle = (time - 6) / 24 * Math.PI * 2;
    this.sun.position.set(player.x - Math.cos(angle) * 62, 15 + Math.sin(angle) * 62, player.z - 55); this.sun.lookAt(this.camera.position);
    this.sun.visible = daylight > .05; this.moon.position.set(player.x + Math.cos(angle) * 62, 15 - Math.sin(angle) * 62, player.z - 55); this.moon.lookAt(this.camera.position); this.moon.visible = daylight < .4;
    for (const c of this.clouds.children) { c.position.x += dt * .13; if (c.position.x > 140) c.position.x = -55; }
    const t = performance.now() / 1000;
    for (const a of this.animals) {
      const walk = Math.sin(t * .2 + a.phase) > .25;
      if (walk && !menu) {
        const yaw = Math.sin(t * .08 + a.phase) * 3;
        const nx = a.group.position.x - Math.sin(yaw) * dt * .32, nz = a.group.position.z - Math.cos(yaw) * dt * .32;
        const ny = this.world.surface(nx, nz);
        if (Math.abs(ny - a.group.position.y) <= 1 && isSolid(this.world.get(Math.floor(nx), ny - 1, Math.floor(nz))) && ny > SEA && this.world.get(Math.floor(nx), ny, Math.floor(nz)) !== B.WATER) { a.group.position.set(nx, ny, nz); a.group.rotation.y = yaw; }
      }
      a.legs.forEach((leg, i) => leg.rotation.x = walk ? Math.sin(t * 6 + (i % 2) * Math.PI) * .25 : 0);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]; p.life -= dt;
      if (p.life < 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); continue; }
      p.vy -= dt * 9; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.mesh.rotation.x += dt * 3;
      p.mesh.scale.setScalar(Math.min(1, p.life * 3));
    }
    this.hand.visible = !menu;
    const bob = moving ? Math.sin(t * 10) * .015 : Math.sin(t * 1.7) * .004;
    this.hand.position.set(Math.min(.34, this.camera.aspect * .23) - Math.sin(swing * Math.PI) * .14, -.28 + bob - Math.sin(swing * Math.PI) * .09, -.53);
    this.hand.rotation.set(-Math.sin(swing * Math.PI) * .6, Math.sin(swing * Math.PI) * .3, -.08);
    const nearby = [];
    for (const [index, id] of this.world.edits) if (id === B.TORCH) {
      const x = index % SIZE, z = Math.floor(index / SIZE) % SIZE, y = Math.floor(index / (SIZE * SIZE));
      const d = Math.hypot(x - player.x, y - player.y, z - player.z); if (d < 16) nearby.push({ x, y, z, d });
    }
    nearby.sort((a, b) => a.d - b.d);
    this.torchLights.forEach((light, i) => { const p = nearby[i]; light.intensity = p ? 7 + Math.sin(t * 7 + i) * .35 : 0; if (p) light.position.set(p.x + .5, p.y + .8, p.z + .5); });
    this.flush();
    this.renderer.render(this.scene, this.camera);
  }
}
