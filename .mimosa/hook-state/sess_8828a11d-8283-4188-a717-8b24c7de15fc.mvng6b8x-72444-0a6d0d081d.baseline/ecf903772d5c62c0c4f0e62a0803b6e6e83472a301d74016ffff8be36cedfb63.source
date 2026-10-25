// Pooled visual effects: tracer lines, particle bursts, smoke. Everything is
// preallocated — nothing is created per frame at runtime.
import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_TRACERS = 24;

export class Effects {
  constructor(scene) {
    this.scene = scene;

    // ---- particles: one Points cloud, CPU-simulated ----
    this.pGeo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    this.pGeo.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    this.points = new THREE.Points(this.pGeo, new THREE.PointsMaterial({
      size: 0.55, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.parts = []; // {i, vx,vy,vz, life, maxLife, gravity}
    this.free = [];
    for (let i = MAX_PARTICLES - 1; i >= 0; i--) { this.free.push(i); this.pPos[i * 3 + 1] = -100; }

    // ---- tracers: pooled 2-point lines ----
    this.tracers = [];
    for (let i = 0; i < MAX_TRACERS; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const m = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 });
      const line = new THREE.Line(g, m);
      line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, life: 0 });
    }

    // one reusable flash light (muzzle / explosions)
    this.flash = new THREE.PointLight(0xffc060, 0, 18);
    scene.add(this.flash);
    this.flashT = 0;
  }

  spawn(x, y, z, vx, vy, vz, hex, life, gravity = -9) {
    if (!this.free.length) return;
    const i = this.free.pop();
    this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
    const c = new THREE.Color(hex);
    this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
    this.parts.push({ i, vx, vy, vz, life, maxLife: life, gravity });
  }

  sparks(x, y, z, n = 6) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
      this.spawn(x, y, z, Math.cos(a) * s, 2 + Math.random() * 4, Math.sin(a) * s,
        Math.random() < 0.5 ? 0xffd873 : 0xffa040, 0.4 + Math.random() * 0.3);
    }
  }

  smoke(x, y, z, hex = 0x777777) {
    this.spawn(x, y, z,
      (Math.random() - 0.5) * 0.6, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6,
      hex, 1.2 + Math.random() * 0.8, 1.5);
  }

  poof(x, y, z) { // cartoon dust — used when a ped goes down (no gore)
    for (let k = 0; k < 8; k++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn(x, y + 0.4, z, Math.cos(a) * 1.6, 1 + Math.random() * 2, Math.sin(a) * 1.6,
        0xd8d2c0, 0.5 + Math.random() * 0.3, -2);
    }
  }

  explosion(x, y, z) {
    for (let k = 0; k < 42; k++) {
      const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 9;
      this.spawn(x, y + 0.4, z, Math.cos(a) * s, 3 + Math.random() * 8, Math.sin(a) * s,
        [0xffdd55, 0xff8833, 0xff4422, 0x333333][k % 4], 0.6 + Math.random() * 0.7);
    }
    this.flash.position.set(x, y + 2, z);
    this.flash.color.setHex(0xff9040);
    this.flash.intensity = 60;
    this.flashT = 0.25;
  }

  muzzle(x, y, z) {
    this.flash.position.set(x, y, z);
    this.flash.color.setHex(0xffe0a0);
    this.flash.intensity = 14;
    this.flashT = 0.05;
  }

  tracer(x0, y0, z0, x1, y1, z1) {
    let t = this.tracers.find((t) => t.life <= 0) || this.tracers[0];
    const a = t.line.geometry.attributes.position;
    a.setXYZ(0, x0, y0, z0); a.setXYZ(1, x1, y1, z1);
    a.needsUpdate = true;
    t.life = 0.09;
    t.line.material.opacity = 0.9;
  }

  skid(x, z) { // small dark marks while drifting
    this.spawn(x, 0.05, z, 0, 0, 0, 0x1c1c1c, 2.2, 0);
  }

  update(dt) {
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const pt = this.parts[k];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.pPos[pt.i * 3 + 1] = -100;
        this.free.push(pt.i);
        this.parts[k] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      pt.vy += pt.gravity * dt;
      this.pPos[pt.i * 3] += pt.vx * dt;
      this.pPos[pt.i * 3 + 1] = Math.max(0.03, this.pPos[pt.i * 3 + 1] + pt.vy * dt);
      this.pPos[pt.i * 3 + 2] += pt.vz * dt;
    }
    this.pGeo.attributes.position.needsUpdate = true;
    this.pGeo.attributes.color.needsUpdate = true;

    for (const t of this.tracers) {
      if (t.life > 0) {
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
      }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.intensity = 0;
      else this.flash.intensity *= 0.8;
    }
  }
}
