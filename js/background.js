/**
 * Animated topographic map: a slowly drifting noise field turned into contour
 * lines with marching squares. Every fourth line is an "index" contour, drawn
 * brighter, the way real topo maps do it.
 */

const LEVELS = 12;
const LEVEL_MIN = 0.12;
const LEVEL_MAX = 0.88;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 1.5;

// Segment table for marching squares. Edges: 0 top, 1 right, 2 bottom, 3 left.
// Case index bits: top-left 8, top-right 4, bottom-right 2, bottom-left 1.
const SEGMENTS = [
  [], [[3, 2]], [[2, 1]], [[3, 1]],
  [[0, 1]], [[3, 0], [2, 1]], [[0, 2]], [[3, 0]],
  [[3, 0]], [[0, 2]], [[0, 1], [3, 2]], [[0, 1]],
  [[3, 1]], [[2, 1]], [[3, 2]], [],
];

function makePermutation(seed) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  return p;
}

const PERM = makePermutation(27);

function hash(ix, iy) {
  return PERM[(PERM[ix & 255] + iy) & 255] / 255;
}

// 2D value noise with smoothstep interpolation, range 0..1.
function noise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy);
  const b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1);
  const d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export class Background {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.motion = true;
    this.active = true;
    this.time = 0;
    this.lastFrame = 0;
    this.rafId = 0;

    this.onResize = this.onResize.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener("resize", this.onResize);
    this.onResize();
  }

  /** Motion off draws a single still frame. */
  setMotion(enabled) {
    this.motion = enabled;
    this.update();
  }

  /** Paused while a panel covers the screen, to save battery. */
  setActive(active) {
    this.active = active;
    this.update();
  }

  update() {
    cancelAnimationFrame(this.rafId);
    this.draw();
    if (this.motion && this.active) {
      this.lastFrame = performance.now();
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  tick(now) {
    const elapsed = now - this.lastFrame;
    if (elapsed >= FRAME_MS) {
      this.time += Math.min(elapsed, 100) / 1000;
      this.lastFrame = now;
      this.draw();
    }
    this.rafId = requestAnimationFrame(this.tick);
  }

  onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.width = w;
      this.height = h;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Coarser grid on small screens keeps phones cool.
      this.cell = w < 700 ? 22 : 16;
      this.cols = Math.ceil(w / this.cell) + 1;
      this.rows = Math.ceil(h / this.cell) + 1;
      this.field = new Float32Array((this.cols + 1) * (this.rows + 1));
      this.draw();
    }, 60);
  }

  sampleField() {
    const t = this.time;
    const scale = 0.055;
    const stride = this.cols + 1;
    for (let y = 0; y <= this.rows; y++) {
      for (let x = 0; x <= this.cols; x++) {
        const nx = x * scale;
        const ny = y * scale;
        const base = noise(nx + t * 0.035, ny + t * 0.012);
        const detail = noise(nx * 2.3 - t * 0.05, ny * 2.3 + 17.3);
        this.field[y * stride + x] = base * 0.72 + detail * 0.28;
      }
    }
  }

  draw() {
    if (!this.field) return;
    const { ctx, cols, rows, cell, field } = this;
    const stride = cols + 1;

    this.sampleField();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineJoin = "round";

    for (let level = 0; level < LEVELS; level++) {
      const threshold = LEVEL_MIN + ((LEVEL_MAX - LEVEL_MIN) * level) / (LEVELS - 1);
      const isIndex = level % 4 === 2;

      ctx.beginPath();
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const tl = field[y * stride + x];
          const tr = field[y * stride + x + 1];
          const br = field[(y + 1) * stride + x + 1];
          const bl = field[(y + 1) * stride + x];

          const index =
            (tl > threshold ? 8 : 0) |
            (tr > threshold ? 4 : 0) |
            (br > threshold ? 2 : 0) |
            (bl > threshold ? 1 : 0);
          const segments = SEGMENTS[index];
          if (segments.length === 0) continue;

          const x0 = x * cell;
          const y0 = y * cell;
          const edgePoint = (edge) => {
            switch (edge) {
              case 0: return [x0 + cell * ((threshold - tl) / (tr - tl)), y0];
              case 1: return [x0 + cell, y0 + cell * ((threshold - tr) / (br - tr))];
              case 2: return [x0 + cell * ((threshold - bl) / (br - bl)), y0 + cell];
              default: return [x0, y0 + cell * ((threshold - tl) / (bl - tl))];
            }
          };

          for (const [e1, e2] of segments) {
            const [ax, ay] = edgePoint(e1);
            const [bx, by] = edgePoint(e2);
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
          }
        }
      }
      ctx.strokeStyle = isIndex ? "rgba(110, 138, 255, 0.42)" : "rgba(79, 109, 245, 0.17)";
      ctx.lineWidth = isIndex ? 1.4 : 1;
      ctx.stroke();
    }
  }
}
