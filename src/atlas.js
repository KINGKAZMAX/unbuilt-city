// Unbuilt City: three actions turn an inhabited city into a spatial score.
import { AtlasLandmarks } from './landmarks.js';
import { ATLAS_KEY, AtlasProgress, chooseAtlasTargets } from './atlas-state.js';
import { Ped } from './peds.js';
import { T } from './city.js';

function storedProgress() {
  try { return JSON.parse(globalThis.localStorage?.getItem(ATLAS_KEY) || '[]'); }
  catch { return []; }
}

// 驻留的小精灵 — Minions with no walk clip hold vigil beside each threshold;
// they witness every sampling without wandering off.
const MINION_KEYS = ['minionA', 'minionB', 'minionC', 'minionD'];

function sidewalkNear(city, x, z) {
  // spiral out from the target tile until a sidewalk shows up
  const tx = Math.floor(x / city.TILE), tz = Math.floor(z / city.TILE);
  for (let r = 1; r <= 3; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (city.tileAt((tx + dx) * city.TILE + city.TILE / 2, (tz + dz) * city.TILE + city.TILE / 2) === T.SIDEWALK) {
          return { x: (tx + dx + 0.5) * city.TILE, z: (tz + dz + 0.5) * city.TILE };
        }
      }
    }
  }
  return null;
}

function spawnMinionBystanders(world, targets) {
  if (!world.peds) return;
  targets.forEach((t, ti) => {
    for (let k = 0; k < 2; k++) {
      const spot = sidewalkNear(world.city, t.x + (k ? 5 : -5), t.z + (k ? -4 : 4));
      if (!spot) continue;
      const p = new Ped(world, spot.x, spot.z, 'civilian',
        { model: MINION_KEYS[(ti * 2 + k) % MINION_KEYS.length], stationary: true });
      p.heading = Math.atan2(t.x - spot.x, t.z - spot.z);   // face the装置
      p.state = 'idle';
      world.peds.list.push(p);
    }
  });
}

export class Atlas {
  constructor(world) {
    this.world = world;
    this.targets = chooseAtlasTargets(world.city);
    this.progress = new AtlasProgress(this.targets, storedProgress());
    this.landmarks = new AtlasLandmarks(world, this.targets);
    this.active = this.progress.current;
    this.completed = this.progress.completedIds.length;
    if (this.completed >= 2 && !world.daynight.isNight) world.daynight.time = 0.82;
    this.landmarks.update(0, this.progress.completedIds, this.progress.currentIndex);
    spawnMinionBystanders(world, this.targets);
  }

  sample() {
    const p = this.world.player;
    return { x: p.pos.x, z: p.pos.z, mode: p.vehicle ? 'drive' : 'foot',
      speed: p.vehicle ? Math.abs(p.vehicle.speed) : Math.hypot(p.velX || 0, p.velZ || 0),
      isNight: this.world.daynight.isNight };
  }

  update(dt) {
    const w = this.world;
    const sample = this.sample();
    const completedId = this.progress.update(dt, sample);
    this.active = this.progress.current;
    this.completed = this.progress.completedIds.length;
    if (completedId) {
      try { globalThis.localStorage?.setItem(ATLAS_KEY, JSON.stringify(this.progress.completedIds)); } catch { /* session progress remains usable */ }
      w.stats.missions = this.completed;
      w.audio.jingle();
      const messages = {
        body: ['身体已在场', '01 / 03 — 你的停留，让一块空间开始成立。'],
        threshold: ['阈限已穿越', '02 / 03 — 日光退场。下车，走向记忆圆环。'],
        memory: ['世界由你完成', '03 / 03 — 身体、行动与记忆，构成一座未建之城。'],
      };
      if (completedId === 'threshold') w.daynight.time = 0.82;
      w.hud.banner('passed', ...messages[completedId]);
      if (this.progress.complete) {
        w.hud.objective(null);
        w.onAtlasComplete?.(this.snapshot());
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('atlas-complete', { detail: this.snapshot() }));
      }
    }
    this.landmarks.update(dt, this.progress.completedIds, this.progress.currentIndex);
    if (this.progress.complete) {
      w.hud.hint('三个世界种子已采集 · 继续漫游，或重新开始');
      return;
    }
    const target = this.progress.current;
    const snapshot = this.progress.snapshot(sample);
    const instruction = target.kind === 'drive' ? '驾驶穿过阈门 · 速度至少 15 km/h'
      : target.kind === 'night' ? '下车步行，进入圆环 · 静止观测 3 秒' : '步行进入装置 · 松开方向键，停留 2 秒';
    const status = {
      'need-drive': '按 E 进入附近车辆，再穿越阈门',
      'need-speed': '加速至 15 km/h 以上，穿过阈门中央',
      'cross-gate': '从阈门一侧驶向另一侧',
      'need-foot': '停车后按 E 下车，以身体进入装置',
      'stand-still': '松开方向键，让身体停驻',
      'need-night': '夜幕降临后，记忆开始显影',
      'sampling': `采样 ${this.progress.hold.toFixed(1)} / ${target.holdSeconds} 秒`,
      'approach': instruction,
    }[this.progress.condition];
    w.hud.objective(`${this.progress.currentIndex + 1} / 3 · ${target.title}`,
      `${instruction} · ${snapshot.target.distance} m`, target.holdSeconds ? this.progress.hold / target.holdSeconds : null);
    w.hud.hint(status);
  }

  onEvent(name) {
    if (name === 'enterVehicle' || name === 'exitVehicle') this.progress.interrupt();
  }

  fail() { this.progress.interrupt(); }

  reset() {
    this.progress.reset();
    this.active = this.progress.current;
    this.completed = 0;
    this.world.stats.missions = 0;
    this.world.daynight.time = this.world.cfg.DAY_START;
    try { globalThis.localStorage?.removeItem(ATLAS_KEY); } catch { /* session reset is sufficient */ }
    this.landmarks.update(0, [], 0);
    this.world.hud.objective(null);
    this.world.hud.hint('步行进入第一个装置 · 停留 2 秒');
  }

  blips() {
    return this.targets.map((target, i) => ({ x: target.x, z: target.z,
      color: this.progress.completedIds.includes(target.id) ? '#e8e4da' : i === this.progress.currentIndex ? '#ff304a' : '#70737c',
      size: i === this.progress.currentIndex ? 6 : 4, ring: i === this.progress.currentIndex }));
  }

  snapshot() { return this.progress.snapshot(this.sample()); }
}
