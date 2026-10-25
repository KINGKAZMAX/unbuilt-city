// Day/night cycle: one sun (directional + shadows), one hemisphere fill,
// fog + sky color lerped through keyframes. No per-lamp point lights.
import * as THREE from 'three';

const KEYS = [ // t, sky, fog, sun color, sun intensity, hemi intensity
  { t: 0.00, sky: 0x171b28, fog: 0x252735, sun: 0xa3a6bc, si: 0.26, hi: 0.82 }, // legible moonlight
  { t: 0.22, sky: 0x262632, fog: 0x36333d, sun: 0xb4aebc, si: 0.30, hi: 0.84 },
  { t: 0.28, sky: 0xa8958d, fog: 0xb1a19a, sun: 0xffd6c2, si: 0.65, hi: 0.88 }, // rose-grey dawn
  { t: 0.38, sky: 0xb7bac0, fog: 0xc3c0bc, sun: 0xffeee0, si: 1.05, hi: 0.95 },
  { t: 0.55, sky: 0xc4c5c7, fog: 0xd0cbc3, sun: 0xfff8ee, si: 1.10, hi: 1.00 },
  { t: 0.72, sky: 0xaa8e87, fog: 0xac9691, sun: 0xffc7b4, si: 0.80, hi: 0.92 },
  { t: 0.78, sky: 0x504754, fog: 0x62545e, sun: 0xd8adbc, si: 0.42, hi: 0.88 },
  { t: 0.85, sky: 0x202331, fog: 0x2a2b38, sun: 0xa6abc2, si: 0.28, hi: 0.84 },
  { t: 1.00, sky: 0x171b28, fog: 0x252735, sun: 0xa3a6bc, si: 0.26, hi: 0.82 },
];

export class DayNight {
  constructor(scene, cfg) {
    this.cfg = cfg;
    this.time = cfg.DAY_START; // 0..1
    this.scene = scene;

    scene.fog = new THREE.Fog(0xc3c0bc, 100, 440);

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.far = 400;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xd0ced5, 0x68616a, 0.95);
    scene.add(this.hemi);

    this._sky = new THREE.Color();
    this._fog = new THREE.Color();
    this._sunc = new THREE.Color();
  }

  get nightFactor() {
    // 1 deep night … 0 full day, smooth ramps at dawn/dusk
    const t = this.time;
    if (t > 0.30 && t < 0.72) return 0;
    if (t >= 0.72 && t < 0.82) return (t - 0.72) / 0.10;
    if (t >= 0.20 && t <= 0.30) return 1 - (t - 0.20) / 0.10;
    return 1;
  }
  get isNight() { return this.nightFactor > 0.5; }

  clockText() {
    const h = Math.floor(this.time * 24), m = Math.floor((this.time * 24 - h) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  update(dt, focus) {
    this.time = (this.time + dt / this.cfg.DAY_LENGTH) % 1;
    const t = this.time;
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++)
      if (t >= KEYS[i].t && t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    const f = (t - a.t) / Math.max(1e-6, b.t - a.t);

    this._sky.setHex(a.sky).lerp(this._fog.setHex(b.sky), f);
    if (!this.scene.background) this.scene.background = new THREE.Color();
    this.scene.background.copy(this._sky);
    this.scene.fog.color.setHex(a.fog).lerp(this._fog.setHex(b.fog), f);
    this.scene.fog.near = 100 - this.nightFactor * 20;
    this.scene.fog.far = 440 - this.nightFactor * 110;

    this.sun.color.setHex(a.sun).lerp(this._sunc.setHex(b.sun), f);
    this.sun.intensity = a.si + (b.si - a.si) * f;
    this.hemi.intensity = a.hi + (b.hi - a.hi) * f;

    // sun orbits; shadow camera follows the player so the map stays sharp
    const ang = (t - 0.25) * Math.PI * 2; // sunrise east at t=.25
    const el = Math.max(0.12, Math.sin(ang));
    this.sun.position.set(
      focus.x + Math.cos(ang) * 120,
      el * 150 + 20,
      focus.z + Math.sin(ang * 0.7) * 60,
    );
    this.sun.target.position.set(focus.x, 0, focus.z);
  }
}
