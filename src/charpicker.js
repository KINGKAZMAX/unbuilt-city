// Character picker: pick the body you walk the city in. Real model thumbnails
// for the card strip, plus a live full-body preview you can drag to rotate
// and wheel/pinch to zoom. The same cards appear in the pause menu so you can
// swap vessels mid-journey.
import * as THREE from 'three';
import { charKeys, model, clips, modelsReady, charHeight } from './assets.js';
import { getSelectedChar, setSelectedChar } from './charsel.js';

const NAMES = {
  skid: '小学生', grandma: '奶奶', lady: '白领', courier: '外卖员',
  cashier: '收银员', guard: '保安', ceo: '总裁',
  corgi: '柯基', duck: '鸭子', fox: '狐狸', squirrel: '松鼠',
  koala: '考拉', chick: '小鸡',
  minionA: '小精灵·壹', minionB: '小精灵·贰', minionC: '小精灵·叁', minionD: '小精灵·肆',
};
const ORDER = ['skid', 'courier', 'lady', 'grandma', 'cashier', 'guard', 'ceo',
  'corgi', 'duck', 'fox', 'squirrel', 'koala', 'chick',
  'minionA', 'minionB', 'minionC', 'minionD'];

let preview = null;   // { renderer, scene, camera, root, mixer, h, az, pit, dist, raf, pointers }
let shots = {};       // char key -> dataURL for the card strip

// Skinned figures follow their bones, not Box3's bind-pose bounds — center
// XZ on the posed skeleton; Y/height comes from the catalog so idle root-bob
// can't wreck the framing.
function posedBox(root, mixer) {
  mixer?.update(0.35);
  const box = new THREE.Box3();
  box.makeEmpty();
  const v = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse(o => { if (o.isBone) box.expandByPoint(o.getWorldPosition(v)); });
  if (box.isEmpty()) box.setFromObject(root);
  return box;
}

// Pixel-truth framing: render, read the alpha channel, measure the actual
// content, and iterate the camera distance until the figure fills ~80% of
// the frame. Immune to every lying bounding box a skinned GLB can produce.
function pixelFit(renderer, scene, camera, root, guessDist) {
  const gl = renderer.getContext();
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const px = new Uint8Array(W * H * 4);
  const read = () => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let minY = H, maxY = -1, minX = W, maxX = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (px[(y * W + x) * 4 + 3] > 10) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }
    return { minY, maxY, minX, maxX };
  };
  let dist = guessDist;
  let content = null;
  const h = charHeight(root.userData.charKey || 'skid');
  for (let i = 0; i < 3; i++) {
    camera.position.set(h * 0.3, h * 0.6, dist);
    camera.lookAt(0, h * 0.5, 0);
    renderer.render(scene, camera);
    content = read();
    const span = content.maxY - content.minY;
    if (span < 4) break;
    dist *= (span / H) / 0.8;
  }
  // horizontal centering: shift the ROOT so the figure sits mid-frame
  const viewW = 2 * dist * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;
  const cx = ((content.minX + content.maxX) / 2 - W / 2) / W;
  root.position.x -= cx * viewW;
  return dist;
}

// ---- card-strip thumbnails (rendered once, offscreen) ----
function renderThumbnails() {
  const W = 128, H = 160;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf2ede4, 0x23262c, 1.5));
  const dir = new THREE.DirectionalLight(0xfff4e6, 1.6);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.05, 60);
  const out = {};
  for (const key of ORDER) {
    const root = model('char', key);
    if (!root) continue;
    root.userData.charKey = key;
    scene.add(root);
    let mixer = null;
    const one = clips('char', key).find(c => /^idle$/i.test(c.name));
    if (one) {
      mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(one).play();
    }
    const bc = posedBox(root, mixer).getCenter(new THREE.Vector3());
    root.position.x -= bc.x;
    root.position.z -= bc.z;
    pixelFit(renderer, scene, camera, root, charHeight(key) * 2.75);
    renderer.render(scene, camera);
    out[key] = canvas.toDataURL('image/png');
    scene.remove(root);
  }
  renderer.dispose();
  return out;
}

// ---- live preview: full body, draggable spin, wheel/pinch zoom ----
function applyPreviewCamera() {
  const { camera, h, az, pit, dist } = preview;
  const cy = h * 0.52;                                   // look at mid-body
  camera.position.set(
    Math.sin(az) * Math.cos(pit) * dist,
    cy + Math.sin(pit) * dist,
    Math.cos(az) * Math.cos(pit) * dist,
  );
  camera.lookAt(0, cy, 0);
}

function setPreviewChar(key) {
  if (!preview) return;
  if (preview.root) preview.scene.remove(preview.root);
  const root = model('char', key);
  if (!root) { preview.root = null; return; }
  preview.scene.add(root);
  preview.mixer?.stopAllAction();
  const idle = clips('char', key).find(c => /^idle$/i.test(c.name));
  preview.mixer = idle ? new THREE.AnimationMixer(root) : null;
  preview.mixer?.clipAction(idle).play();
  const bc = posedBox(root, preview.mixer).getCenter(new THREE.Vector3());
  root.position.x -= bc.x;
  root.position.z -= bc.z;
  preview.root = root;
  root.userData.charKey = key;
  // pixel-fit the live camera, then adopt its exact view as the orbit start
  const fitted = pixelFit(preview.renderer, preview.scene, preview.camera, root, charHeight(key) * 2.75);
  const cp = preview.camera.position;
  preview.h = charHeight(key);
  preview.az = Math.atan2(cp.x, cp.z);
  preview.pit = Math.asin(THREE.MathUtils.clamp((cp.y - preview.h * 0.5) / cp.length(), -1, 1));
  preview.dist = cp.length();
  void fitted;
  applyPreviewCamera();
}

function bindPreviewInput(canvas) {
  const pointers = new Map();
  let pinchD = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchD = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    if (pointers.size === 1) {
      preview.az -= (e.clientX - prev.x) * 0.012;
      preview.pit = THREE.MathUtils.clamp(preview.pit + (e.clientY - prev.y) * 0.008, -0.25, 0.9);
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD > 0) preview.dist = THREE.MathUtils.clamp(preview.dist * pinchD / d, preview.h * 1.15, preview.h * 6);
      pinchD = d;
    }
    applyPreviewCamera();
  });
  const release = e => { pointers.delete(e.pointerId); pinchD = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    preview.dist = THREE.MathUtils.clamp(preview.dist * (1 + e.deltaY * 0.0012), preview.h * 1.15, preview.h * 6);
    applyPreviewCamera();
  }, { passive: false });
}

function ensurePreviewLoop() {
  if (!preview || preview.raf) return;
  const tick = t => {
    preview.raf = requestAnimationFrame(tick);
    const el = preview.renderer.domElement;
    if (!el.isConnected || el.offsetParent === null) return;   // title hidden
    preview.mixer?.update(1 / 60);
    preview.renderer.render(preview.scene, preview.camera);
  };
  preview.raf = requestAnimationFrame(tick);
}

// ---- card strip ----
function markSelected(container) {
  const sel = getSelectedChar() || 'skid';
  container.querySelectorAll('.char-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.char === sel));
}

function buildCards(container, onPick) {
  container.replaceChildren();
  for (const key of ORDER) {
    if (!model('char', key)) continue;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'char-card';
    card.dataset.char = key;
    card.setAttribute('role', 'option');
    card.innerHTML = `<img alt="${NAMES[key] || key}" src="${shots[key] || ''}" draggable="false"><span>${NAMES[key] || key}</span>`;
    card.addEventListener('click', () => {
      setSelectedChar(key);
      setPreviewChar(key);
      document.querySelectorAll('#char-list, #pause-chars').forEach(markSelected);
      onPick?.(key);
    });
    container.appendChild(card);
  }
  markSelected(container);
}

export function initCharPicker({ onPick } = {}) {
  if (!modelsReady()) return;
  const listEl = document.querySelector('#char-list');
  const canvasEl = document.querySelector('#char-preview');
  if (!listEl || !canvasEl) return;
  const sel = getSelectedChar() || 'skid';
  if (!getSelectedChar()) setSelectedChar(sel);

  shots = renderThumbnails();

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf2ede4, 0x23262c, 1.5));
  const dir = new THREE.DirectionalLight(0xfff4e6, 1.7);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  preview = {
    renderer, scene, camera: new THREE.PerspectiveCamera(34, canvasEl.width / canvasEl.height, 0.05, 60),
    root: null, mixer: null, h: 1.6, az: 0.45, pit: 0.1, dist: 4, raf: 0, pointers: new Map(),
  };
  bindPreviewInput(canvasEl);
  setPreviewChar(sel);
  ensurePreviewLoop();
  window.__charPreview = preview;   // debug handle

  buildCards(listEl, onPick);
  const pauseEl = document.querySelector('#pause-chars');
  if (pauseEl) buildCards(pauseEl, onPick);
}
