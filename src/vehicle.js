// Arcade drive model: velocity is split into forward/lateral components each
// step; lateral speed decays as exp(-grip·dt). The handbrake simply lowers
// grip — that one parameter is the entire drift system.
import * as THREE from 'three';
import { T } from './city.js';
import { model as modelAsset } from './assets.js';

export const CAR_SPECS = {
  sedan:  { w: 1.9, l: 4.5, maxF: 26, maxR: 9,  accel: 9,  grip: 6.2, steer: 2.1, hp: 100,
            colors: [0xb0413e, 0x3e6bb0, 0x8e9aa6, 0x496b52, 0x8a7d5c, 0x2f3438] },
  hatch:  { w: 1.8, l: 3.8, maxF: 23, maxR: 9,  accel: 10, grip: 6.8, steer: 2.4, hp: 85,
            colors: [0xc7683a, 0x5c8bd6, 0xb8b0a0, 0x7d5a96, 0xc9c94f] },
  sports: { w: 1.9, l: 4.3, maxF: 37, maxR: 10, accel: 15, grip: 7.4, steer: 2.5, hp: 90,
            colors: [0xd6382e, 0xf2c230, 0x20242a, 0xe8e6e0, 0x2e8a5c] },
  pickup: { w: 2.1, l: 5.1, maxF: 24, maxR: 8,  accel: 8,  grip: 5.6, steer: 1.8, hp: 130,
            colors: [0x6e4a2f, 0x3b4a58, 0x7a2e2a, 0x5d6e5a] },
  van:    { w: 2.1, l: 5.4, maxF: 22, maxR: 8,  accel: 7,  grip: 5.2, steer: 1.7, hp: 140,
            colors: [0xd8d5cc, 0x4a6e8a, 0x9a4a3a, 0x606a5a] },
  taxi:   { w: 1.9, l: 4.5, maxF: 27, maxR: 9,  accel: 10, grip: 6.4, steer: 2.2, hp: 100,
            colors: [0xe8b420] },
  police: { w: 1.95, l: 4.7, maxF: 32, maxR: 10, accel: 13, grip: 7.0, steer: 2.3, hp: 120,
            colors: [0x1c2733] },
};
export const CIVILIAN_TYPES = ['sedan', 'sedan', 'hatch', 'hatch', 'sports', 'pickup', 'van', 'taxi'];

// Curated street palette: charcoal, slate, ivory, deep red — matches the
// obsidian/ivory/fluorescent-red art direction. index 0 stays rare-bright.
export const CITY_PAINT = [0xd6382e, 0x2f3438, 0x494b50, 0xe8e4da, 0x5d1f24, 0x2e3d4a, 0x55584f, 0x33363c];

let carId = 0;

export class Vehicle {
  constructor(world, type, x, z, heading) {
    this.id = carId++;
    this.world = world;
    this.type = type;
    this.spec = CAR_SPECS[type];
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.vx = 0; this.vz = 0;
    this.hp = this.spec.hp;
    this.wrecked = false;
    this.driver = null;        // null | 'player' | ai-controller object
    this.controls = { throttle: 0, steer: 0, handbrake: false };
    this.isPolice = type === 'police';
    this.sirenPhase = 0;
    this.asleep = true;        // parked cars skip physics until disturbed
    this.smokeT = 0;
    this.radius = this.spec.l * 0.36;
    this.buildMesh();
  }

  buildMesh() {
    const { w, l } = this.spec;
    const color = this.color = this.spec.colors[(Math.random() * this.spec.colors.length) | 0];
    const g = new THREE.Group();

    const bodywork = modelAsset('car', this.type);
    if (bodywork) {
      // Per-instance paint from the city's curated palette — Kenney's toy
      // tones read as carnival colors against the obsidian night.
      this.paintMats = [];
      const paint = CITY_PAINT[(Math.random() * CITY_PAINT.length) | 0];
      const target = new THREE.Color(paint);
      const hsl = { h: 0, s: 0, l: 0 };
      bodywork.traverse(o => {
        if (!o.isMesh) return;
        const apply = m => {
          if (m.transparent && m.opacity < 0.6) return m;      // keep glass
          const c = m.clone();
          c.color.lerp(target, 0.88);
          c.color.getHSL(hsl);
          c.color.setHSL(hsl.h, hsl.s,
            THREE.MathUtils.clamp(hsl.l + (Math.random() - 0.5) * 0.05, 0.06, 0.92));
          this.paintMats.push(c);
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(apply) : apply(o.material);
      });
      g.add(bodywork);
      this.bodyMat = this.paintMats[0] || new THREE.MeshLambertMaterial({ color });
      this.cabinMat = this.bodyMat;
    } else {
      this.bodyMat = new THREE.MeshLambertMaterial({ color });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, 0.62, l), this.bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);

      this.cabinMat = new THREE.MeshLambertMaterial({ color: 0x1b2026 });
      const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.82, 0.5, l * (this.type === 'van' ? 0.72 : 0.45)), this.cabinMat);
      cabin.position.set(0, 1.05, -l * (this.type === 'pickup' ? 0.18 : 0.05));
      g.add(cabin);

      // wheels (the models carry their own; fallback keeps the spinning boxes)
      this.wheels = [];
      const wg = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10).rotateZ(Math.PI / 2);
      const wm = new THREE.MeshLambertMaterial({ color: 0x16181c });
      for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const wh = new THREE.Mesh(wg, wm);
        wh.position.set(sx * (w / 2 - 0.05), 0.34, sz * (l / 2 - 0.75));
        g.add(wh); this.wheels.push(wh);
      }
    }
    this.wheels ??= [];

    // lights: emissive quads seated on the actual bodywork; real spotlights
    // only for the player's car. The procedural fallback keeps box dims.
    const bounds = new THREE.Box3().setFromObject(g);
    const bw = Math.max(0.5, (bounds.max.x - bounds.min.x));
    const bl = Math.max(0.5, (bounds.max.z - bounds.min.z));
    const lightY = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.42;
    this.headMat = new THREE.MeshBasicMaterial({ color: 0x333322 });
    for (const sx of [-1, 1]) {
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.2), this.headMat);
      hl.position.set(sx * bw * 0.3, lightY, bounds.max.z + 0.02);
      g.add(hl);
    }
    this.tailMat = new THREE.MeshBasicMaterial({ color: 0x441111 });
    for (const sx of [-1, 1]) {
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), this.tailMat);
      tl.position.set(sx * bw * 0.3, lightY, bounds.min.z - 0.02);
      tl.rotation.y = Math.PI;
      g.add(tl);
    }

    if (this.type === 'taxi' && !bodywork) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xffe28a }));
      sign.position.set(0, 1.42, 0);
      g.add(sign);
    }
    if (this.isPolice) {
      this.barR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x550000 }));
      this.barB = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x000055 }));
      this.barR.position.set(-0.32, 1.4, -0.2);
      this.barB.position.set(0.32, 1.4, -0.2);
      g.add(this.barR, this.barB);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.2, l * 0.6),
        new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
      stripe.position.y = 0.55;
      g.add(stripe);
    }

    g.position.copy(this.pos);
    g.rotation.y = this.heading;
    this.mesh = g;
    this.world.scene.add(g);
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get fwd() { return [Math.sin(this.heading), Math.cos(this.heading)]; }

  setHeadlights(on) {
    this.headMat.color.setHex(on ? 0xfff6c8 : 0x333322);
    this.tailMat.color.setHex(on ? 0xff2a1a : 0x441111);
  }

  update(dt) {
    if (this.wrecked) { this.updateWrecked(dt); return; }
    if (this.asleep && !this.driver) return;
    this.asleep = false;

    const cfg = this.world.cfg, spec = this.spec;
    const { throttle, steer, handbrake } = this.controls;

    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const rx = -fz, rz = fx;
    let vF = this.vx * fx + this.vz * fz;
    let vL = this.vx * rx + this.vz * rz;

    // throttle / brake
    if (throttle > 0) {
      if (vF < 0) vF += cfg.CAR_BRAKE * dt;                 // braking out of reverse
      else vF += throttle * spec.accel * (1 - 0.55 * vF / spec.maxF) * dt;
    } else if (throttle < 0) {
      if (vF > 0.5) vF -= cfg.CAR_BRAKE * dt;               // brake
      else vF += throttle * spec.accel * 0.6 * dt;          // reverse
    }
    vF = Math.max(-spec.maxR, Math.min(spec.maxF, vF));

    // drag + off-road penalty
    let drag = cfg.CAR_DRAG;
    const tile = this.world.city.tileAt(this.pos.x, this.pos.z);
    if (tile === T.GRASS || tile === T.PARK) drag *= 3.2;
    vF -= vF * drag * dt;
    if (Math.abs(vF) < 0.05 && throttle === 0) vF = 0;

    // steering scales with speed, flips in reverse
    const sf = Math.max(-1, Math.min(1, vF / 9));
    this.heading += steer * spec.steer * sf * dt;

    // lateral grip — the whole drift model
    const grip = handbrake ? cfg.CAR_GRIP_HANDBRAKE : spec.grip;
    vL *= Math.exp(-grip * dt);
    if (handbrake && vF > 4) vF -= vF * 0.5 * dt;

    // recompose with (possibly) new heading
    const fx2 = Math.sin(this.heading), fz2 = Math.cos(this.heading);
    this.vx = fx2 * vF + (-fz2) * vL;
    this.vz = fz2 * vF + fx2 * vL;

    const nx = this.pos.x + this.vx * dt;
    const nz = this.pos.z + this.vz * dt;

    // wall collision: slide + impact damage
    const fixed = this.world.city.collideCircle(nx, nz, this.radius);
    if (fixed.x !== nx || fixed.z !== nz) {
      const pnx = fixed.x - nx, pnz = fixed.z - nz;
      const pl = Math.hypot(pnx, pnz) || 1;
      const nX = pnx / pl, nZ = pnz / pl;
      const into = -(this.vx * nX + this.vz * nZ);
      if (into > 3) {
        this.damage(into * 2.2, 'wall');
        this.world.effects.sparks(fixed.x - nX, 0.6, fixed.z - nZ, 6);
        this.world.audio.impact(Math.min(1, into / 20));
        if (this.driver === 'player') this.world.police.addHeat(into > 10 ? 3 : 1);
      }
      this.vx += nX * into * 1.35;
      this.vz += nZ * into * 1.35;
    }
    this.pos.x = fixed.x; this.pos.z = fixed.z;

    // drift audio/skid hooks
    this.drifting = Math.abs(vL) > 3.5 && Math.abs(vF) > 6;

    // visuals
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = vF * dt / 0.34;
    for (let i = 0; i < this.wheels.length; i++) {
      this.wheels[i].rotation.x += spin;
      if (i < 2) this.wheels[i].rotation.y = steer * 0.45; // front wheels are [0,1] (z+)
    }
    this.mesh.rotation.z = -vL * 0.008;                    // body roll in drifts
    if (this.isPolice && this.siren) {
      this.sirenPhase += dt * 8;
      const flip = Math.sin(this.sirenPhase) > 0;
      this.barR.material.color.setHex(flip ? 0xff2222 : 0x550000);
      this.barB.material.color.setHex(flip ? 0x000055 : 0x3355ff);
    }

    // damage smoke
    if (this.hp < 35) {
      this.smokeT -= dt;
      if (this.smokeT <= 0) {
        this.smokeT = 0.12;
        this.world.effects.smoke(this.pos.x, 1.1, this.pos.z);
      }
    }
  }

  updateWrecked(dt) {
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.2;
      this.world.effects.smoke(this.pos.x, 1.0, this.pos.z, 0x111111);
    }
    this.vx = this.vz = 0;
  }

  damage(amount, source) {
    if (this.wrecked) return;
    this.hp -= amount;
    this.world.missions?.onEvent('carDamaged', { car: this, amount, source });
    if (this.hp <= 0) this.wreck(source);
  }

  wreck(source) {
    if (this.wrecked) return;
    this.wrecked = true;
    this.asleep = false;
    this.bodyMat.color.setHex(0x1a1a1a);
    this.cabinMat.color.setHex(0x101010);
    for (const m of this.paintMats ?? []) m.color.setHex(0x1a1a1a);
    this.setHeadlights(false);
    this.world.effects.explosion(this.pos.x, 1, this.pos.z);
    this.world.audio.explosion();
    // blast damage to anyone right next to it
    const p = this.world.player;
    const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
    if (d < 6) p.damage((1 - d / 6) * 65, 'explosion');
    this.world.peds.blast(this.pos, 6, 80);
    if (source === 'player-weapon' || this.lastHitByPlayer) {
      this.world.police.addHeat(this.isPolice ? 22 : 10);
    }
    this.world.missions?.onEvent('vehicleWrecked', { car: this });
    if (this.driver && this.driver !== 'player') this.driver = null;
  }

  dispose() {
    this.world.scene.remove(this.mesh);
  }
}

// pairwise car-vs-car collision, plus car-vs-player when on foot
export function resolveVehicleCollisions(world, vehicles) {
  for (let i = 0; i < vehicles.length; i++) {
    const a = vehicles[i];
    if (a.asleep && !a.driver) { /* parked cars still block */ }
    for (let j = i + 1; j < vehicles.length; j++) {
      const b = vehicles[j];
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const rr = a.radius + b.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 >= rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
      const overlap = rr - d;
      a.pos.x -= nx * overlap / 2; a.pos.z -= nz * overlap / 2;
      b.pos.x += nx * overlap / 2; b.pos.z += nz * overlap / 2;
      const rvx = a.vx - b.vx, rvz = a.vz - b.vz;
      const closing = rvx * nx + rvz * nz;
      if (closing > 0) {
        const imp = closing * 0.6;
        a.vx -= nx * imp; a.vz -= nz * imp;
        b.vx += nx * imp; b.vz += nz * imp;
        if (closing > 5) {
          const aIsPlayer = a.driver === 'player', bIsPlayer = b.driver === 'player';
          let dmg = (closing - 4) * 2.0;
          if (!aIsPlayer && !bIsPlayer) dmg *= 0.35; // fender-benders shouldn't cascade
          if (aIsPlayer) b.lastHitByPlayer = true;
          if (bIsPlayer) a.lastHitByPlayer = true;
          a.damage(dmg, bIsPlayer ? 'player-car' : 'car');
          b.damage(dmg, aIsPlayer ? 'player-car' : 'car');
          world.effects.sparks((a.pos.x + b.pos.x) / 2, 0.7, (a.pos.z + b.pos.z) / 2, 8);
          world.audio.impact(Math.min(1, closing / 18));
          if ((aIsPlayer || bIsPlayer) && closing > 6) world.police.addHeat(2);
          b.asleep = false; a.asleep = false;
        }
      }
    }
  }
}
