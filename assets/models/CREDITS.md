# Model Credits / 模型来源与许可

All 3D models in this folder are **CC0 1.0 (Public Domain)** by [Kenney](https://kenney.nl),
slightly trimmed for size. No attribution required; credited as good practice.

- `cars/*.glb` — [Kenney Car Kit](https://kenney.nl/assets/car-kit) (CC0)
- `chars/*.glb` — [Kenney Blocky Characters](https://kenney.nl/assets/blocky-characters) (CC0, includes 27-clip animation library: walk/sprint/idle/holding-shoot/die…)
- `nature/*.glb` — [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) (CC0)
- `street/*.glb` — [Kenney City Kit — Roads](https://kenney.nl/assets/city-kit-roads) (CC0; curved street lamps)

Integration: `src/assets.js` loads these at boot (three.js GLTFLoader, r160 via
the pinned `three/addons` import map) and clones them per vehicle/pedestrian;
trees are baked into instanced meshes. If a file fails to load, the original
procedural meshes remain as fallback.
