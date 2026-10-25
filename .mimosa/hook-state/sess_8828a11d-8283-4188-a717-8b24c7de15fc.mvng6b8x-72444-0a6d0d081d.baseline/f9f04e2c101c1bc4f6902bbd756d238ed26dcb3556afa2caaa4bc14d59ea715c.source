// Pedestrians: little low-poly citizens who wander the sidewalks and flee from
// trouble. Hostile variants (gang members, bounty targets, foot cops) reuse the
// same body with a gun and a shoot-AI. Tone rule: civilians only ever flee;
// downed characters tumble and fade in a dust poof — no gore.
import * as THREE from 'three';
import { pick, chance, range } from './rng.js';
import { randomChar, clips as modelClips, model as modelAsset } from './assets.js';

const SKIN = [0xd9a98c, 0xc48a66, 0x8a5a3a, 0xefc9a8, 0x6e4428];
const SHIRT = [0x3e6bb0, 0xb0413e, 0x4a7a4a, 0x8a7d5c, 0x7d5a96, 0xd8d5cc, 0x2f3438, 0xc7683a];
const PANTS = [0x2b3540, 0x4a4238, 0x33383e, 0x5a4a6a, 0x704a3a];

let pedId = 0;

export class Ped {
  constructor(world, x, z, kind = 'civilian', opts = {}) {
    this.id = pedId++;
    this.world = world;
    this.kind = kind;            // civilian | gang | cop | vip
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = Math.random() * Math.PI * 2;
    this.state = 'walk';         // walk | idle | flee | hostile | downed
    this.hp = kind === 'cop' ? world.cfg.COP_HP : world.cfg.PED_HP;
    this.speed = 0;
    this.target = null;
    this.stateT = 0;
    this.shootT = range(Math.random, 0.4, 1.4);
    this.downT = 0;
    this.walkPhase = Math.random() * 10;
    this.forceModel = opts.model || null;   // e.g. 驻留的小精灵
    this.stationary = !!opts.stationary;    // bystanders never wander
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();

    const [charKey, bodywork] = this.forceModel
      ? [this.forceModel, modelAsset('char', this.forceModel)]
      : randomChar();
    if (bodywork) {
      // Rigged citizen: walk/sprint/idle, attack pose for the armed,
      // death/dead for the downed (Gobkit + Kenney clip naming).
      this.charKey = charKey;
      g.add(bodywork);
      const one = re => (modelClips('char', charKey).find(c => re.test(c.name)) || null);
      const clips = {
        walk: one(/^walk$/i),
        sprint: one(/^run$|^sprint$/i),
        idle: one(/^idle$/i),
        hostile: one(/^attack$|^holding-right-shoot$|^holding-right$/i),
        die: one(/^death$|^dead$|^die$/i),
      };
      if (clips.walk || clips.idle) {
        const mixer = new THREE.AnimationMixer(bodywork);
        this.anim = { mixer, clips, current: null };
        this.playClip(clips.walk || clips.idle);
      }
    } else {
      const rng = Math.random;
      const skin = pick(rng, SKIN);
      const shirt = this.kind === 'cop' ? 0x24344d
        : this.kind === 'gang' ? pick(rng, [0x5a2222, 0x3a2a1a, 0x222222])
        : this.kind === 'vip' ? 0x555c66
        : pick(rng, SHIRT);
      const pants = this.kind === 'cop' ? 0x1c2733 : pick(rng, PANTS);

      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.28),
        new THREE.MeshLambertMaterial({ color: shirt }));
      torso.position.y = 1.06;
      torso.castShadow = true;

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 7),
        new THREE.MeshLambertMaterial({ color: skin }));
      head.position.y = 1.56;

      this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.76, 0.18),
        new THREE.MeshLambertMaterial({ color: pants }));
      this.legL.position.set(-0.12, 0.38, 0);
      this.legR = this.legL.clone();
      this.legR.position.x = 0.12;

      this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.14),
        new THREE.MeshLambertMaterial({ color: shirt }));
      this.armL.position.set(-0.30, 1.08, 0);
      this.armR = this.armL.clone();
      this.armR.position.x = 0.30;

      g.add(torso, head, this.legL, this.legR, this.armL, this.armR);

      if (this.kind === 'cop') {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.1, 8),
          new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
        cap.position.y = 1.7;
        g.add(cap);
      }
    }
    if (this.armed) this.addGun(g);
    g.position.copy(this.pos);
    this.mesh = g;
    this.world.scene.add(g);
  }

  playClip(clip, { once = false } = {}) {
    if (!clip || clip === this.anim?.current) return;
    this.anim.current = clip;
    this.anim.mixer.stopAllAction();
    const action = this.anim.mixer.clipAction(clip);
    if (once) { action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; }
    action.play();
  }

  get armed() { return this.kind === 'cop' || this.kind === 'gang'; }

  addGun(g) {
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x16181c }));
    gun.position.set(0.30, 1.3, 0.22);
    g.add(gun);
  }

  update(dt) {
    const w = this.world;
    this.stateT -= dt;

    if (this.state === 'downed') {
      this.downT -= dt;
      if (this.anim?.clips.die) {
        // the clip carries the collapse; no flat-rotate fallback needed
        this.playClip(this.anim.clips.die, { once: true });
        this.anim.mixer.update(dt);
      } else {
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 0.25;
      }
      if (this.downT <= 0) this.remove = true;
      return;
    }

    if (!this.stationary && this.state === 'idle' && this.stateT <= 0) this.setWalk();

    if (this.state === 'walk') {
      this.speed = 1.4;
      if (!this.target || this.stateT <= 0) this.newWanderTarget();
    } else if (this.state === 'flee') {
      this.speed = 4.6;
      if (this.stateT <= 0) this.setWalk();
    } else if (this.state === 'hostile') {
      this.updateHostile(dt);
    }

    // steer toward target
    if (this.target && this.speed > 0) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1 && this.state === 'walk') {
        this.state = chance(Math.random, 0.3) ? 'idle' : 'walk';
        this.stateT = this.state === 'idle' ? range(Math.random, 1, 4) : 0;
        this.target = null;
      } else if (d > 0.01) {
        const wantH = Math.atan2(dx, dz);
        let dh = wantH - this.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.heading += Math.max(-6 * dt, Math.min(6 * dt, dh));
      }
    }

    if (this.speed > 0) {
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
      const fixed = w.city.collideCircle(nx, nz, 0.35);
      this.pos.x = fixed.x; this.pos.z = fixed.z;
    }

    // walk-cycle: state-driven model clips, or the fallback limb swing
    if (this.anim) {
      this.anim.mixer.update(dt);
      const c = this.anim.clips;
      const clip = this.state === 'hostile' ? (c.hostile || c.idle)
        : this.state === 'flee' ? (c.sprint || c.walk || c.idle)
        : this.speed > 0.2 ? (c.walk || c.idle) : (c.idle || c.walk);
      this.playClip(clip);
    } else if (this.legL) {
      this.walkPhase += dt * this.speed * 2.4;
      const s = Math.sin(this.walkPhase) * Math.min(1, this.speed / 3) * 0.6;
      this.legL.rotation.x = s; this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.8; this.armR.rotation.x = s * 0.8;
    }

    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
  }

  updateHostile(dt) {
    const w = this.world;
    const t = this.hostileTarget === 'player' ? w.player.pos : this.hostileTarget?.pos;
    if (!t) { this.setWalk(); return; }
    const dx = t.x - this.pos.x, dz = t.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    const los = w.city.hasLOS(this.pos.x, this.pos.z, t.x, t.z);

    // keep a shooting distance; close in when far or no line of sight
    if (d > 14 || !los) { this.target = { x: t.x, z: t.z }; this.speed = 4.2; }
    else if (d < 6) {
      this.target = { x: this.pos.x - dx / d * 6, z: this.pos.z - dz / d * 6 };
      this.speed = 2.4;
    } else {
      this.speed = 0;
      this.heading = Math.atan2(dx, dz);
    }

    this.shootT -= dt;
    if (this.shootT <= 0 && los && d < 26) {
      this.shootT = range(Math.random, 0.7, 1.5);
      this.shoot(t, d);
    }
  }

  shoot(t, d) {
    const w = this.world;
    const mx = this.pos.x + Math.sin(this.heading) * 0.5;
    const mz = this.pos.z + Math.cos(this.heading) * 0.5;
    w.effects.tracer(mx, 1.3, mz, t.x, 1.1, t.z);
    w.effects.muzzle(mx, 1.3, mz);
    w.audio.shot('pistol', Math.min(1, 18 / (d + 4)));
    w.events.gunshot(this.pos);
    // accuracy falls with range and with target speed
    const tv = this.hostileTarget === 'player'
      ? Math.hypot(w.player.velX || 0, w.player.velZ || 0) : 0;
    const hitP = Math.max(0.08, 0.75 - d * 0.02 - tv * 0.04);
    if (Math.random() < hitP) {
      if (this.hostileTarget === 'player') w.player.damage(this.kind === 'cop' ? 7 : 9, this.kind);
      else this.hostileTarget?.damage?.(10, this);
    }
  }

  damage(amount, source) {
    if (this.state === 'downed') return;
    this.hp -= amount;
    const w = this.world;
    if (this.armed && (source === 'player' || source === 'player-car')) {
      this.hostileTarget = 'player';
      this.state = 'hostile';
    } else if (!this.armed) {
      this.flee(w.player.pos);
    }
    if (this.hp <= 0) this.down(source);
  }

  down(source) {
    this.state = 'downed';
    this.downT = 6;
    this.speed = 0;
    this.world.effects.poof(this.pos.x, 0.3, this.pos.z);
    if (source === 'player' || source === 'player-car') {
      this.world.police.addHeat(this.kind === 'cop' ? 22 : 13);
      this.world.missions?.onEvent('pedDowned', { ped: this, source });
    }
    this.world.events.gunshot(this.pos); // nearby peds scatter
  }

  flee(fromPos) {
    if (this.state === 'downed' || this.armed) return;
    this.state = 'flee';
    this.stateT = range(Math.random, 4, 7);
    const dx = this.pos.x - fromPos.x, dz = this.pos.z - fromPos.z;
    const d = Math.hypot(dx, dz) || 1;
    this.target = { x: this.pos.x + dx / d * 40, z: this.pos.z + dz / d * 40 };
  }

  setWalk() { this.state = 'walk'; this.target = null; this.stateT = 0; }

  newWanderTarget() {
    const w = this.world;
    const p = w.city.randomSidewalkPoint(Math.random, { from: this.pos, min: 8, max: 40 });
    this.target = p;
    this.stateT = 20;
  }

  dispose() { this.world.scene.remove(this.mesh); }
}

export class Peds {
  constructor(world) {
    this.world = world;
    this.list = [];
  }

  update(dt) {
    const { cfg, player } = this.world;
    // keep the streets populated around the player
    if ((this.spawnT = (this.spawnT || 0) - dt) <= 0) {
      this.spawnT = 0.3;
      const civilians = this.list.filter((p) => p.kind === 'civilian').length;
      if (civilians < cfg.PED_MAX) {
        const p = this.world.city.randomSidewalkPoint(Math.random,
          { from: player.pos, min: cfg.PED_SPAWN_R[0], max: cfg.PED_SPAWN_R[1] });
        this.list.push(new Ped(this.world, p.x, p.z));
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.update(dt);
      const d = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z);
      if (p.remove || (!p.stationary && d > cfg.PED_DESPAWN_R && p.kind === 'civilian')) {
        p.dispose();
        this.list.splice(i, 1);
      }
    }

    // cars hitting peds: check the player's car and traffic
    for (const v of this.world.allVehicles()) {
      if (v.speed < 4 || v.wrecked) continue;
      for (const p of this.list) {
        if (p.state === 'downed') continue;
        const d = Math.hypot(p.pos.x - v.pos.x, p.pos.z - v.pos.z);
        if (d < v.radius + 0.4) {
          p.hp -= v.speed * 6;
          const dx = p.pos.x - v.pos.x, dz = p.pos.z - v.pos.z;
          const dd = Math.hypot(dx, dz) || 1;
          p.pos.x += dx / dd * 1.6; p.pos.z += dz / dd * 1.6;
          this.world.audio.impact(0.5);
          if (p.hp <= 0) p.down(v.driver === 'player' ? 'player-car' : 'car');
          else p.flee(v.pos);
        }
      }
    }
  }

  anyNear(x, z, r) {
    for (const p of this.list)
      if (p.state !== 'downed' && Math.hypot(p.pos.x - x, p.pos.z - z) < r) return true;
    return false;
  }

  blast(pos, radius, dmg) {
    for (const p of this.list) {
      const d = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z);
      if (d < radius) p.damage((1 - d / radius) * dmg, 'explosion');
      else if (d < radius * 4) p.flee(pos);
    }
  }

  panic(pos, radius = 26) {
    for (const p of this.list) {
      if (Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < radius) p.flee(pos);
    }
  }

  spawnFleeing(x, z, fromPos) {
    const p = new Ped(this.world, x, z);
    p.flee(fromPos);
    this.list.push(p);
    return p;
  }

  spawnHostile(x, z, kind, target = 'player') {
    const p = new Ped(this.world, x, z, kind);
    p.state = 'hostile';
    p.hostileTarget = target;
    this.list.push(p);
    return p;
  }

  spawnVIP(x, z) { // unarmed mission NPC (bounty target, witness, passenger)
    const p = new Ped(this.world, x, z, 'vip');
    this.list.push(p);
    return p;
  }
}
