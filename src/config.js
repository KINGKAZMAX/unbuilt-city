// All gameplay tuning lives here. One tile = TILE meters; the city is N×N tiles.
export const CONFIG = {
  SEED: 20260717,

  // --- world ---
  TILE: 8,
  N: 96,                    // 96×96 tiles → 768×768 m city
  DAY_LENGTH: 480,          // seconds for a full day/night cycle
  DAY_START: 0.35,          // 0=midnight, .25=dawn — start mid-morning

  // --- player on foot ---
  WALK_SPEED: 5.2,
  SPRINT_SPEED: 8.6,
  PLAYER_RADIUS: 0.45,
  PLAYER_HP: 100,
  ENTER_RANGE: 3.2,         // how far a car door can be grabbed from

  // --- camera ---
  CAM_DIST_FOOT: 7.5,
  CAM_DIST_CAR: 11,
  CAM_HEIGHT: 2.6,
  CAM_LERP: 8,              // exp smoothing rate

  // --- driving (forward/lateral split model) ---
  CAR_GRIP: 6.0,            // lateral decay rate; lower = more slide
  CAR_GRIP_HANDBRAKE: 1.4,
  CAR_DRAG: 0.55,
  CAR_BRAKE: 26,

  // --- traffic ---
  TRAFFIC_MAX: 22,
  TRAFFIC_SPAWN_R: [90, 150],   // spawn ring around player (m)
  TRAFFIC_DESPAWN_R: 210,
  PARKED_COUNT: 46,
  AI_SPEED: 11,                 // cruising speed of traffic (m/s)

  // --- pedestrians ---
  PED_MAX: 34,
  PED_SPAWN_R: [55, 110],
  PED_DESPAWN_R: 150,
  PED_HP: 40,

  // --- wanted system ---
  HEAT_STAR: 20,            // heat units per star (max 100 = 5★)
  HEAT_GAIN_CAP: 40,        // max heat gain per second
  HEAT_DECAY: [0, 2.2, 1.8, 1.5, 1.2, 1.0],  // per-star decay rate (no-LOS)
  HEAT_LOS_GRACE: 4,        // seconds without LOS before decay starts
  COP_FOOT_MAX: [0, 2, 3, 4, 4, 5],
  COP_CAR_MAX:  [0, 0, 1, 2, 3, 4],
  COP_HP: 70,
  BUST_TIME: 1.6,           // seconds a cop must hold you at gunpoint
  BUST_RANGE: 3.4,
  SURVIVAL_PAY: 100,        // $ per 30 s survived at 3★+
  DEATH_TAX: 0.30,          // fraction of cash lost on death
  BUST_TAX: 0.20,

  // --- weapons: [damage, interval s, range m, spread rad, auto] ---
  WEAPONS: {
    fist:   { name: 'Fists',  dmg: 12, interval: 0.42, range: 1.9,  spread: 0,     auto: false },
    pistol: { name: 'Pistol', dmg: 26, interval: 0.34, range: 60,   spread: 0.012, auto: false },
    smg:    { name: 'SMG',    dmg: 11, interval: 0.085, range: 45,  spread: 0.045, auto: true },
  },

  // --- missions ---
  MISSION_MARKERS: 7,        // markers kept alive on the map
  MISSION_MIN_DIST: 60,      // marker min distance from player when placed
  REWARD_BASE: 120,
};
