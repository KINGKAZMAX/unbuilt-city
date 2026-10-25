import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AtlasProgress, chooseAtlasTargets } from '../src/atlas-state.js';
import { CONFIG } from '../src/config.js';
import { generateCity, T } from '../src/city.js';

const targets = [
  { id: 'body', kind: 'foot', x: 0, z: 0, radius: 5, holdSeconds: 2 },
  { id: 'threshold', kind: 'drive', x: 50, z: 0, radius: 4, axis: 'x', minSpeed: 4 },
  { id: 'memory', kind: 'night', x: 100, z: 0, radius: 6, holdSeconds: 3 },
];
const sample = (x = 0, extra = {}) => ({ x, z: 0, speed: 0, mode: 'foot', isNight: false, ...extra });
const dwell = (state, seconds, input) => { for (let i = 0; i < Math.round(seconds * 60); i++) state.update(1 / 60, input); };

test('body requires proximity, foot mode, and a continuous two-second pause', () => {
  const state = new AtlasProgress(targets);
  dwell(state, 3, sample(9));
  dwell(state, 3, sample(0, { mode: 'drive' }));
  dwell(state, 3, sample(0, { speed: 1 }));
  assert.equal(state.currentIndex, 0);
  dwell(state, 1.5, sample());
  state.update(1 / 60, sample(8));
  dwell(state, 1.5, sample());
  assert.equal(state.currentIndex, 0, 'leaving the zone resets sampling');
  dwell(state, 0.6, sample());
  assert.deepEqual(state.completedIds, ['body']);
});

test('a stopped car, a walker, a teleport, and a missed aperture cannot activate the threshold', () => {
  const attempt = (before, after) => {
    const state = new AtlasProgress(targets, ['body']);
    state.update(1 / 60, before); state.update(1 / 60, after);
    return state.currentIndex;
  };
  assert.equal(attempt(sample(49.9), sample(50.1)), 1);
  assert.equal(attempt(sample(50, { mode: 'drive' }), sample(50, { mode: 'drive' })), 1);
  assert.equal(attempt(sample(0, { mode: 'drive', speed: 10 }), sample(100, { mode: 'drive', speed: 10 })), 1);
  assert.equal(attempt(sample(49.9, { mode: 'drive', speed: 10, z: 6 }), sample(50.1, { mode: 'drive', speed: 10, z: 6 })), 1);
  assert.equal(attempt(sample(49.9, { mode: 'drive', speed: 10 }), sample(50.1, { mode: 'drive', speed: 10 })), 2);
});

test('night observation needs night, foot mode, stillness and three continuous seconds', () => {
  const state = new AtlasProgress(targets, ['body', 'threshold']);
  dwell(state, 4, sample(100));
  dwell(state, 4, sample(100, { isNight: true, mode: 'drive' }));
  assert.equal(state.currentIndex, 2);
  dwell(state, 2, sample(100, { isNight: true }));
  state.update(1 / 60, sample(100, { isNight: true, speed: 3 }));
  dwell(state, 2.9, sample(100, { isNight: true }));
  assert.equal(state.complete, false);
  dwell(state, 0.2, sample(100, { isNight: true }));
  assert.equal(state.complete, true);
  assert.equal(state.current, null);
});

test('sequence is enforced, persistence only restores a prefix and reset permits replay', () => {
  const state = new AtlasProgress(targets, ['threshold', 'memory']);
  assert.equal(state.currentIndex, 0);
  dwell(state, 4, sample(100, { isNight: true }));
  assert.equal(state.currentIndex, 0);
  const restored = new AtlasProgress(targets, ['body', 'threshold', 'memory']);
  assert.equal(restored.complete, true);
  restored.reset();
  assert.deepEqual(restored.completedIds, []);
  assert.equal(restored.hold, 0);
  dwell(restored, 2, sample());
  assert.equal(restored.currentIndex, 1);
});

test('targets are deterministic, distinct and sit on the correct accessible tile types', () => {
  const city = generateCity(CONFIG);
  const a = chooseAtlasTargets(city), b = chooseAtlasTargets(city);
  assert.deepEqual(a, b);
  assert.deepEqual(a.map(t => city.tileAt(t.x, t.z)), [T.SIDEWALK, T.ROAD, T.SIDEWALK]);
  assert.equal(new Set(a.map(t => `${t.x},${t.z}`)).size, 3);
  const routeLength = [city.spawn, ...a].slice(1).reduce((sum, p, i) => {
    const previous = [city.spawn, ...a][i];
    return sum + Math.abs(p.x - previous.x) + Math.abs(p.z - previous.z);
  }, 0);
  assert.ok(routeLength >= 150 && routeLength <= 250, `route length ${routeLength}`);
  assert.ok(city.hasLOS(city.spawn.x, city.spawn.z, a[0].x, a[0].z));
});
