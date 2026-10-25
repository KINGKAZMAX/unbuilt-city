// Ambient traffic: AI cars follow the per-tile lane directions, pick a random
// legal exit at intersections, and brake for whatever is in front of them.
// Parked cars are real (enterable) Vehicles that sleep until disturbed.
import { Vehicle, CIVILIAN_TYPES } from './vehicle.js';
import { T, DIR, DIR_VEC } from './city.js';
import { pick, chance } from './rng.js';

const dirHeading = (d) => [Math.PI / 2, -Math.PI / 2, 0, Math.PI][d]; // E W S N → heading (fwd = sin,cos)

export class Traffic {
  constructor(world) {
    this.world = world;
    this.cars = [];      // moving AI cars
    this.parked = [];    // sleeping vehicles
    this.rng = world.rng;
    this.spawnParked();
  }

  get allVehicles() { return [...this.cars, ...this.parked]; }

  spawnParked() {
    const { city, cfg } = this.world;
    for (let i = 0; i < cfg.PARKED_COUNT; i++) {
      // park on lot tiles, or hug the outer edge of a road tile
      const useLot = this.world.city.lotTiles.length && chance(this.rng, 0.45);
      let x, z, heading;
      if (useLot) {
        const p = city.randomTile(this.rng, city.lotTiles);
        x = p.x; z = p.z; heading = pick(this.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      } else {
        const p = city.randomRoadPoint(this.rng);
        const lane = city.laneAt(p.x, p.z);
        if (lane < 0 || lane === DIR.ANY) { i--; continue; }
        const [dx, dz] = DIR_VEC[lane];
        // offset sideways to the curb (right side of the lane direction)
        x = p.x + (-dz) * 2.6; z = p.z + dx * 2.6;
        if (city.tileAt(x, z) !== T.ROAD) { x = p.x + dz * 2.6; z = p.z - dx * 2.6; }
        if (city.tileAt(x, z) !== T.ROAD) { i--; continue; }
        heading = dirHeading(lane);
      }
      const v = new Vehicle(this.world, pick(this.rng, CIVILIAN_TYPES), x, z, heading);
      v.asleep = true;
      this.parked.push(v);
    }
  }

  trySpawnMoving() {
    const { city, cfg, player } = this.world;
    if (this.cars.length >= cfg.TRAFFIC_MAX) return;
    const p = city.randomRoadPoint(this.rng, {
      from: player.pos, min: cfg.TRAFFIC_SPAWN_R[0], max: cfg.TRAFFIC_SPAWN_R[1],
    });
    const lane = city.laneAt(p.x, p.z);
    if (lane < 0 || lane === DIR.ANY) return;
    // don't spawn on top of another car
    for (const v of this.allVehicles)
      if (Math.hypot(v.pos.x - p.x, v.pos.z - p.z) < 8) return;
    const v = new Vehicle(this.world, pick(this.rng, CIVILIAN_TYPES), p.x, p.z, dirHeading(lane));
    v.asleep = false;
    v.driver = { kind: 'civilian', turn: -1 };
    this.cars.push(v);
  }

  update(dt) {
    const { city, cfg, player } = this.world;
    if ((this.spawnT = (this.spawnT || 0) - dt) <= 0) {
      this.spawnT = 0.4;
      this.trySpawnMoving();
    }

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const v = this.cars[i];
      if (v.wrecked) continue; // stays as scenery until despawn
      if (v.driver === 'player' || !v.driver) continue;
      this.drive(v, dt);
    }

    // despawn far cars (never the player's)
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const v = this.cars[i];
      if (v.driver === 'player') continue;
      const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z);
      if (d > cfg.TRAFFIC_DESPAWN_R && !v.keepAlive) {
        v.dispose();
        this.cars.splice(i, 1);
      }
    }
  }

  drive(v, dt) {
    const { city } = this.world;
    const ai = v.driver;
    const lane = city.laneAt(v.pos.x, v.pos.z);

    // desired direction: lane dir, or the committed turn inside an intersection
    let want = lane;
    if (lane === DIR.ANY) {
      if (ai.turn < 0) ai.turn = this.pickTurn(v);
      want = ai.turn;
    } else {
      ai.turn = -1;
      if (lane < 0) want = this.headingToDir(v.heading); // off-road: keep going
    }

    const targetH = dirHeading(want >= 0 && want < 4 ? want : this.headingToDir(v.heading));
    let dh = targetH - v.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;

    // forward probe: brake for cars, the player, and peds
    const [fx, fz] = v.fwd;
    const px = v.pos.x + fx * 7, pz = v.pos.z + fz * 7;
    let blocked = false;
    for (const o of this.world.allVehicles()) {
      if (o === v) continue;
      if (Math.hypot(o.pos.x - px, o.pos.z - pz) < 4.5) { blocked = true; break; }
    }
    if (!blocked) {
      const pl = this.world.player;
      if (!pl.vehicle && Math.hypot(pl.pos.x - px, pl.pos.z - pz) < 3.5) blocked = true;
    }
    if (!blocked && this.world.peds.anyNear(px, pz, 2.6)) blocked = true;

    const cruising = this.world.cfg.AI_SPEED * (Math.abs(dh) > 0.5 ? 0.45 : 1);
    v.controls.steer = Math.max(-1, Math.min(1, dh * 2.2));
    v.controls.throttle = blocked ? (v.speed > 1 ? -1 : 0)
      : (v.speed < cruising ? 0.8 : 0);
    v.controls.handbrake = false;
  }

  headingToDir(h) {
    // snap a heading back to the nearest cardinal direction code
    const fx = Math.sin(h), fz = Math.cos(h);
    if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? DIR.E : DIR.W;
    return fz > 0 ? DIR.S : DIR.N;
  }

  pickTurn(v) {
    // inside an intersection: continue straight if possible, else turn legally
    const { city } = this.world;
    const cur = this.headingToDir(v.heading);
    const options = [];
    for (const d of [DIR.E, DIR.W, DIR.S, DIR.N]) {
      // no U-turns
      if ((cur === DIR.E && d === DIR.W) || (cur === DIR.W && d === DIR.E) ||
          (cur === DIR.S && d === DIR.N) || (cur === DIR.N && d === DIR.S)) continue;
      const [dx, dz] = DIR_VEC[d];
      // probe past the 2×2 intersection: is there a road tile with this lane dir?
      const probe = city.laneAt(v.pos.x + dx * 18, v.pos.z + dz * 18);
      if (probe === d || probe === DIR.ANY) options.push(d);
    }
    if (!options.length) return cur;
    if (options.includes(cur) && chance(this.rng, 0.6)) return cur;
    return pick(this.rng, options);
  }

  // mission-owned car (boost target etc.): AI-driven, never distance-despawned
  spawnMissionCar(type, x, z) {
    const lane = this.world.city.laneAt(x, z);
    const heading = lane >= 0 && lane < 4 ? dirHeading(lane) : this.rng() * Math.PI * 2;
    const v = new Vehicle(this.world, type, x, z, heading);
    v.asleep = false;
    v.driver = { kind: 'civilian', turn: -1 };
    v.keepAlive = true;
    this.cars.push(v);
    return v;
  }

  // called when the player yanks a driver out
  carjack(v) {
    if (v.driver && v.driver !== 'player') {
      v.driver = null;
      this.world.peds.spawnFleeing(v.pos.x + 1.5, v.pos.z, this.world.player.pos);
      this.world.police.addHeat(8); // somebody always calls it in
      v.keepAlive = true;
    }
  }
}
