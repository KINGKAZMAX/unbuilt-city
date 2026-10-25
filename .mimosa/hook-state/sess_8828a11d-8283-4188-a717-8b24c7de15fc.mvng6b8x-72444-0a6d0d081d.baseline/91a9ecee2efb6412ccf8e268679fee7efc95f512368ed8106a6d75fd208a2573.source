// Original spatial score for Unbuilt City. No rendering or browser dependencies.
import { T, DIR } from './city.js';

export const ATLAS_KEY = 'unbuilt-city:spatial-atlas:v1';
export const ATLAS_IDS = ['body', 'threshold', 'memory'];
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function routeDistances(city, point) {
  const { N, TILE } = city;
  const out = new Float64Array(N * N).fill(Infinity);
  const first = Math.floor(point.x / TILE) + Math.floor(point.z / TILE) * N;
  const queue = [first];
  out[first] = 0;
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i], x = at % N, z = Math.floor(at / N);
    for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
      const nx = x + dx, nz = z + dz, ni = nx + nz * N;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N || city.tiles[ni] === T.BUILDING) continue;
      if (out[ni] !== Infinity) continue;
      out[ni] = out[at] + TILE;
      queue.push(ni);
    }
  }
  return out;
}

export function chooseAtlasTargets(city) {
  const point = ([tx, tz]) => ({ x: (tx + 0.5) * city.TILE, z: (tz + 0.5) * city.TILE, tx, tz });
  const roads = city.roadTiles.map(point), walks = city.sidewalkTiles.map(point);
  const route = (distances, p) => distances[p.tx + p.tz * city.N];
  const pick = (candidates, score) => candidates.reduce((best, p) => {
    const value = score(p);
    return value < best.value ? { point: p, value } : best;
  }, { point: null, value: Infinity }).point;
  const fromSpawn = routeDistances(city, city.spawn);
  const body = pick(walks, p => {
    const d = route(fromSpawn, p);
    if (d < 24 || d > 48 || !city.hasLOS(city.spawn.x, city.spawn.z, p.x, p.z)) return Infinity;
    return Math.abs(d - 32) + Math.abs(p.x - city.spawn.x) * 0.001;
  }) || pick(walks, p => Math.abs(route(fromSpawn, p) - 32));
  const fromBody = routeDistances(city, body);
  const threshold = pick(roads, p => {
    const d = route(fromBody, p), lane = city.laneAt(p.x, p.z);
    if (d < 72 || d > 112 || lane === DIR.ANY || lane < 0) return Infinity;
    const axis = lane === DIR.E || lane === DIR.W ? 'x' : 'z';
    if ([-16, -8, 8, 16].some(offset => city.tileAt(p.x + (axis === 'x' ? offset : 0), p.z + (axis === 'z' ? offset : 0)) !== T.ROAD)) return Infinity;
    return Math.abs(d - 96) + distance(city.spawn, p) * 0.002;
  }) || pick(roads, p => Math.abs(route(fromBody, p) - 96));
  const fromThreshold = routeDistances(city, threshold);
  const memory = pick(walks, p => {
    const d = route(fromThreshold, p);
    if (d < 64 || d > 96 || distance(body, p) < 40 || distance(threshold, p) < 40) return Infinity;
    return Math.abs(d - 80) + Math.abs(p.z - threshold.z) * 0.001;
  }) || pick(walks.filter(p => distance(body, p) > 40), p => Math.abs(route(fromThreshold, p) - 80));
  const lane = city.laneAt(threshold.x, threshold.z);
  return [
    { id: 'body', kind: 'foot', ...body, title: '身体 / BODY', radius: 5, holdSeconds: 2 },
    { id: 'threshold', kind: 'drive', ...threshold, title: '尺度 / SCALE', radius: 4, axis: lane === DIR.E || lane === DIR.W ? 'x' : 'z', minSpeed: 4.2 },
    { id: 'memory', kind: 'night', ...memory, title: '时间 / TIME', radius: 6, holdSeconds: 3 },
  ];
}

export class AtlasProgress {
  constructor(targets, completed = []) {
    this.targets = targets;
    this.completedIds = [];
    for (const id of ATLAS_IDS) {
      if (!Array.isArray(completed) || !completed.includes(id)) break;
      this.completedIds.push(id);
    }
    this.currentIndex = this.completedIds.length;
    this.hold = 0;
    this.previous = null;
    this.condition = 'approach';
  }

  get current() { return this.targets[this.currentIndex] || null; }
  get complete() { return this.currentIndex === this.targets.length; }

  interrupt() { this.hold = 0; this.previous = null; }
  reset() {
    this.completedIds = [];
    this.currentIndex = 0;
    this.condition = 'approach';
    this.interrupt();
  }

  update(dt, sample) {
    const target = this.current;
    if (!target || !Number.isFinite(dt) || dt <= 0) return null;
    const near = distance(sample, target) <= target.radius;
    const previous = this.previous;
    const actualSpeed = previous ? distance(sample, previous) / dt : 0;
    this.previous = { ...sample };
    let done = false;
    if (target.kind === 'drive') {
      this.hold = 0;
      this.condition = sample.mode !== 'drive' ? 'need-drive' : sample.speed < target.minSpeed ? 'need-speed' : 'cross-gate';
      if (previous?.mode === 'drive' && sample.mode === 'drive' && sample.speed >= target.minSpeed) {
        const axis = target.axis, across = axis === 'x' ? 'z' : 'x';
        const a = previous[axis] - target[axis], b = sample[axis] - target[axis];
        const travel = distance(sample, previous);
        if (Math.abs(a) > 0.001 && a * b <= 0 && travel > 0.001 && travel <= sample.speed * dt * 2 + 1) {
          const fraction = a / (a - b);
          const lateral = previous[across] + (sample[across] - previous[across]) * fraction;
          done = Math.abs(lateral - target[across]) <= target.radius;
        }
      }
    } else {
      this.condition = !near ? 'approach' : sample.mode !== 'foot' ? 'need-foot'
        : Math.max(sample.speed, actualSpeed) > 0.45 ? 'stand-still'
          : target.kind === 'night' && !sample.isNight ? 'need-night' : 'sampling';
      this.hold = this.condition === 'sampling' ? this.hold + Math.min(dt, 0.25) : 0;
      done = this.hold + 1e-8 >= target.holdSeconds;
    }
    if (!done) return null;
    this.completedIds.push(target.id);
    this.currentIndex++;
    this.interrupt();
    this.condition = this.complete ? 'complete' : 'approach';
    return target.id;
  }

  snapshot(sample) {
    const target = this.current;
    return {
      completedIds: [...this.completedIds], currentIndex: this.currentIndex, complete: this.complete,
      distance: target && sample ? Math.round(distance(target, sample)) : null,
      charge: target?.holdSeconds ? Math.min(1, this.hold / target.holdSeconds) : 0,
      holdSeconds: Number(this.hold.toFixed(2)), requiredSeconds: target?.holdSeconds || 0,
      condition: this.condition,
      target: target ? { ...target, distance: sample ? Math.round(distance(target, sample)) : null } : null,
      targets: this.targets.map(t => ({ id: t.id, kind: t.kind, x: t.x, z: t.z, axis: t.axis || null, title: t.title })),
    };
  }
}
