import { collides, clamp } from './world.js';
import { waterCurrent, bubbleColumn } from './fluids.js';

export function moveBody(world, body, axis, distance, height = 1.8, radius = .29) {
  if (!distance) return true;
  const steps = Math.max(1, Math.ceil(Math.abs(distance) / .2)), delta = distance / steps;
  for (let step = 0; step < steps; step++) {
    const start = body[axis]; body[axis] += delta;
    if (!collides(world, body, height, radius)) continue;
    // Resolve contact instead of leaving a frame-sized gap above the ground.
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const fraction = (lo + hi) / 2; body[axis] = start + delta * fraction;
      if (collides(world, body, height, radius)) hi = fraction; else lo = fraction;
    }
    body[axis] = start + delta * lo - Math.sign(delta) * .001; return false;
  }
  return true;
}

export function stepPhysics(world, p, input, dt, options = {}) {
  dt = clamp(dt, 0, .05);
  const height = options.height || 1.8, radius = options.radius || .29;
  const water = world.inWater({ ...p, y: p.y + .4 }), submerged = world.inWater({ ...p, y: p.y + 1.62 });
  const bubble = water ? bubbleColumn(world, p.x, p.y + .4, p.z) : 0;
  const current = water ? waterCurrent(world, p.x, p.y + .4, p.z) : { x: 0, z: 0 };
  let forward = input.forward || 0, side = input.side || 0;
  const length = Math.hypot(forward, side); if (length > 1) { forward /= length; side /= length; }
  const gliding = options.gliding && !p.grounded && !water && !p.flying;
  const speed = gliding ? options.boost ? 22 : 11 : options.speed || (p.flying ? 9 : water ? 2.2 : input.sneak ? 1.3 : input.sprint ? 5.612 : 4.317);
  if (gliding) { forward = 1; side = 0; }
  const tx = (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * side) * speed + current.x * 1.1;
  const tz = (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * side) * speed + current.z * 1.1;
  const supported = !p.flying && collides(world, { ...p, y: p.y - .03 }, height, radius);
  p.grounded = supported && (p.vy || 0) <= 0;
  const response = 1 - Math.exp(-(water ? 4 : p.grounded || p.flying ? 16 : 3) * dt);
  p.vx = (p.vx || 0) + (tx - (p.vx || 0)) * response;
  p.vz = (p.vz || 0) + (tz - (p.vz || 0)) * response;
  let blocked = false;
  for (const [axis, delta] of [['x', p.vx * dt], ['z', p.vz * dt]]) {
    const start = { x: p.x, y: p.y, z: p.z };
    if (!moveBody(world, p, axis, delta, height, radius)) {
      blocked = true;
      if (p.grounded && !water) {
        const trial = { ...p, y: start.y + .6, [axis]: start[axis] + delta };
        if (!collides(world, trial, height, radius)) { Object.assign(p, { x: trial.x, y: trial.y, z: trial.z }); moveBody(world, p, 'y', -.6, height, radius); blocked = false; }
      }
    }
    if (input.sneak && p.grounded && !water && !collides(world, { ...p, y: p.y - .6 }, height, radius)) Object.assign(p, start);
  }
  let autoJump = false;
  if (blocked && options.autoJump && p.grounded && !water && !input.sneak && length) {
    const ahead = { ...p, x: p.x + tx / speed * .6, y: p.y + 1.25, z: p.z + tz / speed * .6 };
    autoJump = !collides(world, ahead, height, radius) && !collides(world, { ...p, y: p.y + 1.25 }, height, radius);
  }
  let fallDamage = 0;
  if (options.gliding && !p.grounded && !water && !p.flying) {
    p.vy = Math.max(-8, (p.vy || 0) - dt * 3 + Math.max(0, -p.pitch) * dt * 2);
    if (options.boost) p.vy = Math.sin(p.pitch) * speed;
    if (!moveBody(world, p, 'y', p.vy * dt, height, radius)) { p.vy = 0; p.grounded = true; }
    p.fallDistance = 0;
  } else if (p.flying || options.flyingMount) {
    p.vy = 0; p.fallDistance = 0;
    moveBody(world, p, 'y', (Number(!!input.jump) - Number(!!input.descend)) * 7 * dt, height, radius);
  } else {
    if ((input.jump || autoJump) && p.grounded && !water) { p.vy = 8 * (options.jumpBoost ? 1.25 : 1); p.grounded = false; }
    if (options.levitation) p.vy = 2;
    else if (water) {
      const desired = bubble ? bubble * (bubble > 0 ? 7 : 4) : input.jump ? 3.2 : input.descend ? -2.5 : -.45;
      p.vy = (p.vy || 0) + (desired - (p.vy || 0)) * (1 - Math.exp(-5 * dt)); p.fallDistance = 0;
      if (blocked && input.jump && !submerged) p.vy = 7;
    } else p.vy = Math.max(options.slowFalling ? -2 : -32, (p.vy || 0) - 26 * dt);
    const before = p.y, falling = p.vy < 0;
    p.grounded = false;
    const moved = moveBody(world, p, 'y', p.vy * dt, height, radius);
    if (falling && !water && !options.slowFalling) p.fallDistance = (p.fallDistance || 0) + Math.max(0, before - p.y);
    if (!moved) {
      p.grounded = falling;
      if (falling) { fallDamage = Math.max(0, Math.ceil((p.fallDistance || 0) - 3)); p.fallDistance = 0; }
      p.vy = 0;
    }
  }
  return { water, submerged, bubble, fallDamage, moving: length > .05, speed };
}

export function updateBreath(state, submerged, bubble, dt) {
  const capacity = (state.equipment?.helmet?.id === 'turtle_helmet' ? 25 : 15) + (state.equipment?.helmet?.enchantments?.respiration || 0) * 5;
  const mount = state.riding && state.mobs?.mobs.find(m => m.uid === state.riding);
  const breathing = !submerged || bubble !== 0 || state.mode === 'creative' || state.effects?.water_breathing || mount?.type === 'nautilus';
  state.oxygen = breathing ? Math.min(capacity, (state.oxygen ?? capacity) + dt * 5) : Math.max(0, (state.oxygen ?? capacity) - dt);
  state.drownTimer = !breathing && state.oxygen === 0 ? (state.drownTimer || 0) + dt : 0;
  if (state.drownTimer >= 1) { state.drownTimer -= 1; return 2; }
  return 0;
}
