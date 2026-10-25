// Rotating minimap: the city pre-renders once into an offscreen canvas
// (4 px per tile); each frame just blits it rotated around the player and
// stamps the blips on top.
import { T } from './city.js';

const TILE_PX = 4;
const COLORS = {
  [T.GRASS]: '#29262d', [T.ROAD]: '#23262b', [T.SIDEWALK]: '#6a6f75',
  [T.BUILDING]: '#494f58', [T.PARK]: '#373139', [T.LOT]: '#43474d',
};

export class Minimap {
  constructor(city, canvas) {
    this.city = city;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.base = document.createElement('canvas');
    this.base.width = this.base.height = city.N * TILE_PX;
    const b = this.base.getContext('2d');
    for (let z = 0; z < city.N; z++) for (let x = 0; x < city.N; x++) {
      b.fillStyle = COLORS[city.tiles[x + z * city.N]];
      b.fillRect(x * TILE_PX, z * TILE_PX, TILE_PX, TILE_PX);
    }
    this.scale = TILE_PX / city.TILE; // world meters → base px
  }

  // blips: [{x, z, color, size, ring}]
  draw(px, pz, heading, blips) {
    const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#14171c';
    ctx.fillRect(0, 0, W, H);

    // rotate the world around the player so "up" is where you're facing
    ctx.translate(W / 2, H / 2);
    ctx.rotate(heading + Math.PI); // heading 0 faces +z (down in map space) → flip
    const zoom = 1.35;
    ctx.scale(zoom, zoom);
    ctx.drawImage(this.base, -px * this.scale, -pz * this.scale);

    // blips
    for (const bl of blips) {
      const bx = (bl.x - px) * this.scale, bz = (bl.z - pz) * this.scale;
      ctx.fillStyle = bl.color;
      if (bl.ring) {
        ctx.strokeStyle = bl.color;
        ctx.lineWidth = 2 / zoom;
        ctx.beginPath();
        ctx.arc(bx, bz, (bl.size || 6) + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(bx, bz, bl.size || 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // player arrow, always centered pointing up
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 4); ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // border
    ctx.strokeStyle = 'rgba(255,255,255,.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
