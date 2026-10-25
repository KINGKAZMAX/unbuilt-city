// Original spatial interventions for Unbuilt Atlas. These meshes deliberately
// do not enter the city's collision map: every installation has a clear centre.
import * as THREE from 'three';

const RED = 0xff304a;
const IVORY = 0xe9e4da;
const TAU = Math.PI * 2;

function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,.6)');
  gradient.addColorStop(.4, 'rgba(255,255,255,.16)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function plaque(parent, index, title) {
  const canvas = document.createElement('canvas');
  canvas.width = 640; canvas.height = 144;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111218'; ctx.fillRect(0, 0, 640, 144);
  ctx.fillStyle = '#ff304a'; ctx.fillRect(0, 0, 7, 144);
  ctx.font = '500 55px sans-serif'; ctx.fillText(`0${index + 1}`, 30, 93);
  ctx.fillStyle = '#e9e4da'; ctx.font = '500 27px sans-serif';
  ctx.fillText(title, 126, 65);
  ctx.fillStyle = '#98989f'; ctx.font = '17px monospace';
  ctx.fillText('UNBUILT ATLAS / FIELD NOTE', 126, 103);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, depthTest: true, depthWrite: false,
  }));
  label.scale.set(4.9, 1.1, 1);
  label.position.set(0, 12.1, 0);
  parent.add(label);
  return label;
}

export class AtlasLandmarks {
  constructor(world, targets) {
    this.world = world;
    this.time = 0;
    this.group = new THREE.Group();
    this.group.name = 'Unbuilt Atlas / original installations';
    world.scene.add(this.group);
    const glow = glowTexture();
    const concrete = new THREE.MeshStandardMaterial({
      color: IVORY, roughness: .83, metalness: .06,
    });
    const graphite = new THREE.MeshStandardMaterial({
      color: 0x22232c, roughness: .42, metalness: .45,
    });
    this.items = targets.map((target, index) => {
      const root = new THREE.Group();
      root.name = `Atlas / ${target.id}`;
      root.position.set(target.x, 0, target.z);
      this.group.add(root);
      const accent = new THREE.MeshBasicMaterial({ color: RED });
      const thin = new THREE.MeshBasicMaterial({
        color: RED, transparent: true, opacity: .8,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const radius = target.kind === 'drive' ? 4.8 : 3.2;
      const floor = mesh(root, new THREE.RingGeometry(radius, radius + .075, 80), thin,
        0, .075, 0);
      floor.rotation.x = -Math.PI / 2;
      const inner = mesh(root, new THREE.RingGeometry(radius * .83, radius * .83 + .025, 80),
        new THREE.MeshBasicMaterial({ color: IVORY, side: THREE.DoubleSide }), 0, .07, 0);
      inner.rotation.x = -Math.PI / 2;
      const pool = mesh(root, new THREE.PlaneGeometry(radius * 3.5, radius * 3.5),
        new THREE.MeshBasicMaterial({
          color: RED, map: glow, transparent: true, opacity: .48,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }), 0, .055, 0);
      pool.rotation.x = -Math.PI / 2;

      // Four small compass ticks leave the walking/driving axis unobstructed.
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const tick = mesh(root, new THREE.BoxGeometry(.065, .025, .65), accent,
          Math.sin(a) * (radius + .5), .08, Math.cos(a) * (radius + .5));
        tick.rotation.y = a;
      }

      const sculpture = new THREE.Group();
      root.add(sculpture);
      const moving = [];
      if (target.kind === 'drive') {
        // A sequence of three thresholds: eight metres of free passage.
        sculpture.rotation.y = target.axis === 'x' ? Math.PI / 2 : 0;
        for (let i = 0; i < 3; i++) {
          const depth = (i - 1) * 2.5;
          const h = 9 + i * .55;
          for (const side of [-1, 1]) {
            mesh(sculpture, new THREE.BoxGeometry(.42, h, .42), graphite,
              side * 4.42, h / 2, depth);
            mesh(sculpture, new THREE.BoxGeometry(.065, h, .08), accent,
              side * 4.17, h / 2, depth - .23);
          }
          mesh(sculpture, new THREE.BoxGeometry(9.25, .42, .42), concrete,
            0, h, depth);
          mesh(sculpture, new THREE.BoxGeometry(8.38, .065, .08), accent,
            0, h - .24, depth - .23);
        }
      } else if (target.kind === 'night') {
        // The complete armillary sits above head height, including its tilt.
        for (let i = 0; i < 3; i++) {
          const pivot = new THREE.Group();
          pivot.position.y = 6.8;
          sculpture.add(pivot);
          const ring = mesh(pivot, new THREE.TorusGeometry(3.25 - i * .35, i === 0 ? .11 : .055, 8, 80),
            i === 0 ? concrete : accent);
          ring.rotation.x = i * .85;
          ring.rotation.y = i * .68;
          moving.push({ object: pivot, baseY: 6.8, kind: 'orbit', phase: i });
        }
        const seed = mesh(sculpture, new THREE.OctahedronGeometry(.38, 0), accent, 0, 6.8, 0);
        moving.push({ object: seed, baseY: 6.8, kind: 'seed', phase: 0 });
        mesh(sculpture, new THREE.CylinderGeometry(.028, .028, 3.7, 6), accent, 0, 9.3, 0);
      } else {
        // A roof without walls; laminated planes make an inhabited void.
        for (let i = 0; i < 5; i++) {
          const plate = mesh(sculpture, new THREE.BoxGeometry(5.9 - i * .32, .22, 3.15), concrete,
            0, 4.5 + i * .67, 0);
          plate.rotation.y = -.18 + i * .15;
          plate.castShadow = true;
          moving.push({ object: plate, baseY: plate.position.y, kind: 'plate', phase: i });
        }
        for (const side of [-1, 1]) {
          mesh(sculpture, new THREE.BoxGeometry(.28, 3.65, .28), graphite, side * 2.75, 1.825, 0);
          mesh(sculpture, new THREE.BoxGeometry(.055, 3.65, .055), accent, side * 2.57, 1.825, -.17);
        }
        mesh(sculpture, new THREE.OctahedronGeometry(.2, 0), accent, 0, 3.65, 0);
      }

      const pulseMat = thin.clone();
      pulseMat.opacity = 0;
      const pulse = mesh(root, new THREE.RingGeometry(radius, radius + .08, 80), pulseMat,
        0, .095, 0);
      pulse.rotation.x = -Math.PI / 2;
      const light = new THREE.PointLight(RED, 8, 14, 2);
      light.position.set(0, 4, 0);
      root.add(light);
      const label = plaque(root, index,
        target.kind === 'foot' ? 'BODY / PRESENCE' : target.kind === 'drive' ? 'SPACE / THRESHOLD' : 'TIME / MEMORY');
      return { target, root, accent, thin, pool, pulse, light, label, moving,
        complete: false, completionMix: 0, activation: 0 };
    });
    this.update(0, [], 0);
  }

  update(dt, completedIds = [], currentIndex = 0) {
    this.time += dt;
    const completed = completedIds instanceof Set ? completedIds : new Set(completedIds);
    this.items.forEach((item, index) => {
      const done = completed.has(item.target.id);
      if (done && !item.complete) item.activation = 2.4;
      item.complete = done;
      item.completionMix += ((done ? 1 : 0) - item.completionMix) * (1 - Math.exp(-dt * 2.5));
      item.activation = Math.max(0, item.activation - dt);
      const active = index === currentIndex;
      const breath = .5 + Math.sin(this.time * 1.8 + index) * .5;
      item.accent.color.setHex(done ? IVORY : RED);
      item.thin.color.setHex(done ? IVORY : RED);
      item.thin.opacity = done ? .65 : active ? .7 + breath * .25 : .35;
      item.pool.material.opacity = done ? .14 : active ? .4 + breath * .1 : .17;
      item.light.color.setHex(done ? IVORY : RED);
      item.light.intensity = done ? 12 : active ? 16 + breath * 4 : 5;
      item.label.material.opacity = active || done ? 1 : .6;
      item.moving.forEach(part => {
        if (part.kind === 'orbit') {
          part.object.rotation.y = this.time * (.07 + part.phase * .025);
          part.object.rotation.z = Math.sin(this.time * .18 + part.phase) * .13;
        } else if (part.kind === 'plate') {
          part.object.position.y = part.baseY + Math.sin(this.time * .8 + part.phase * .6) * .1 + item.completionMix * .35;
        } else {
          part.object.rotation.y = this.time * .5;
          part.object.position.y = part.baseY + Math.sin(this.time) * .15;
        }
      });
      if (item.activation > 0) {
        const progress = 1 - item.activation / 2.4;
        item.pulse.scale.setScalar(1 + progress * 2.7);
        item.pulse.material.color.setHex(IVORY);
        item.pulse.material.opacity = (1 - progress) * .85;
      } else item.pulse.material.opacity = 0;
    });
  }
}
