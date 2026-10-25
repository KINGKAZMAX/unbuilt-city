// Deterministic RNG (mulberry32). Same seed → same city, same missions.
export function makeRNG(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick  = (rng, arr) => arr[(rng() * arr.length) | 0];
export const range = (rng, a, b) => a + rng() * (b - a);
export const irange = (rng, a, b) => a + ((rng() * (b - a + 1)) | 0); // inclusive
export const chance = (rng, p) => rng() < p;
