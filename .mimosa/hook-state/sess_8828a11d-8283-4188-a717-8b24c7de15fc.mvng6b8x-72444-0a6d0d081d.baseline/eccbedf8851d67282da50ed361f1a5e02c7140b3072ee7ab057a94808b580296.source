// Hitscan combat: no bullet entities — a ray, a sphere test against every
// living thing, a wall-distance clamp from the tile map, and a one-frame tracer.
import * as THREE from 'three';

const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

export class Weapons {
  constructor(world) {
    this.world = world;
    this.slots = ['fist', 'pistol', 'smg'];
    this.current = 0;
    this.cooldown = 0;
  }

  get weapon() { return this.world.cfg.WEAPONS[this.slots[this.current]]; }
  get key() { return this.slots[this.current]; }

  select(i) {
    if (i >= 0 && i < this.slots.length && i !== this.current) {
      this.current = i;
      this.world.hud.setWeapon(this.weapon.name);
      this.world.audio.click();
    }
  }
  cycle() { this.select((this.current + 1) % this.slots.length); }

  update(dt) {
    this.cooldown -= dt;
    const inp = this.world.input;
    const wantFire = this.weapon.auto ? inp.fireHeld : inp.firePressed;
    if (wantFire && this.cooldown <= 0 && !this.world.player.vehicle) {
      this.cooldown = this.weapon.interval;
      this.fire();
    }
  }

  fire() {
    const w = this.world, p = w.player, spec = this.weapon;
    const cam = w.camera;

    // aim along the camera ray, shots leave from the player's chest
    cam.getWorldDirection(_dir);
    if (spec.spread) {
      _dir.x += (Math.random() - 0.5) * spec.spread * 2;
      _dir.y += (Math.random() - 0.5) * spec.spread;
      _dir.z += (Math.random() - 0.5) * spec.spread * 2;
      _dir.normalize();
    }
    const ox = p.pos.x, oy = 1.35, oz = p.pos.z;

    if (this.key === 'fist') return this.punch();

    // how far until a wall stops the bullet (flattened 2D check)
    const flat = Math.hypot(_dir.x, _dir.z) || 1e-4;
    const wallD = w.city.rayWallDist(ox, oz, _dir.x / flat, _dir.z / flat, spec.range);

    // nearest target along the ray
    let hit = null, hitD = wallD;
    const testSphere = (cx, cy, cz, r, obj) => {
      _to.set(cx - ox, cy - oy, cz - oz);
      const t = _to.dot(_dir);
      if (t < 0 || t > hitD) return;
      const perp2 = _to.lengthSq() - t * t;
      if (perp2 < r * r) { hit = obj; hitD = t; }
    };
    for (const ped of w.peds.list) {
      if (ped.state === 'downed') continue;
      testSphere(ped.pos.x, 1.0, ped.pos.z, 0.55, ped);
    }
    for (const v of w.allVehicles()) {
      if (v.wrecked || v === p.vehicle) continue;
      testSphere(v.pos.x, 0.8, v.pos.z, v.radius * 0.9, v);
    }

    const ex = ox + _dir.x * hitD, ey = oy + _dir.y * hitD, ez = oz + _dir.z * hitD;
    w.effects.tracer(ox + _dir.x, oy, oz + _dir.z, ex, ey, ez);
    w.effects.muzzle(ox + _dir.x * 0.8, oy, oz + _dir.z * 0.8);
    w.audio.shot(this.key, 1);
    w.events.gunshot(p.pos);
    w.police.addHeat(2); // gunfire in the street never goes unnoticed
    p.recoil(spec === w.cfg.WEAPONS.smg ? 0.35 : 0.8);

    if (hit) {
      if (hit.damage && hit.pos && hit.kind !== undefined) {           // ped
        hit.damage(spec.dmg, 'player');
        w.effects.poof(hit.pos.x, 1.0, hit.pos.z);
        w.missions?.onEvent('shotPed', { ped: hit });
      } else if (hit.damage) {                                          // vehicle
        hit.lastHitByPlayer = true;
        hit.damage(spec.dmg * 0.7, 'player-weapon');
        w.effects.sparks(ex, ey, ez, 4);
        if (hit.driver && hit.driver !== 'player') hit.driver = null;   // driver bails… simplified
      }
    } else {
      w.effects.sparks(ex, ey, ez, 3); // wall dust
    }
  }

  punch() {
    const w = this.world, p = w.player, spec = this.weapon;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const rx = p.pos.x + fx * 1.2, rz = p.pos.z + fz * 1.2;
    w.audio.shot('fist', 1);
    for (const ped of w.peds.list) {
      if (ped.state === 'downed') continue;
      if (Math.hypot(ped.pos.x - rx, ped.pos.z - rz) < spec.range) {
        ped.damage(spec.dmg, 'player');
        w.effects.poof(ped.pos.x, 1.0, ped.pos.z);
        w.police.addHeat(3);
        w.missions?.onEvent('shotPed', { ped });
        return;
      }
    }
  }
}
