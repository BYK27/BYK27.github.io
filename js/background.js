/**
 * Animated backdrop: a wireframe terrain flying past under the camera, with
 * drifting particles and a slight parallax tilt that follows the pointer.
 *
 * Everything is projected by hand (sx = cx + x / z * focal) instead of with a
 * 3D library, so the whole backdrop is a single canvas and no dependencies.
 */

const COLS = 44;
const ROWS = 32;
const Z_NEAR = 1.1;
const Z_STEP = 0.4;
const SPEED = 0.6;
const RIDGE_HEIGHT = 2.35;
const PARTICLES = 46;
const FRAME_MS = 1000 / 30;
const MAX_DPR = 1.5;

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

    // Pointer parallax, eased towards the target so it never snaps.
    this.tilt = { x: 0, y: 0 };
    this.tiltTarget = { x: 0, y: 0 };

    this.particles = Array.from({ length: PARTICLES }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.35 + Math.random() * 0.65,
      drift: 0.004 + Math.random() * 0.012,
      phase: Math.random() * Math.PI * 2,
    }));

    this.onResize = this.onResize.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.tick = this.tick.bind(this);

    window.addEventListener("resize", this.onResize);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    this.onResize();
  }

  setMotion(enabled) {
    this.motion = enabled;
    this.update();
  }

  /** Paused while a page covers the screen, to save battery. */
  setActive(active) {
    this.active = active;
    this.update();
  }

  onPointer(event) {
    this.tiltTarget.x = (event.clientX / window.innerWidth - 0.5) * 2;
    this.tiltTarget.y = (event.clientY / window.innerHeight - 0.5) * 2;
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
      const dt = Math.min(elapsed, 100) / 1000;
      this.time += dt;
      this.tilt.x += (this.tiltTarget.x - this.tilt.x) * 0.05;
      this.tilt.y += (this.tiltTarget.y - this.tilt.y) * 0.05;
      for (const p of this.particles) {
        p.y -= p.drift * dt;
        if (p.y < -0.05) {
          p.y = 1.05;
          p.x = Math.random();
        }
      }
      this.lastFrame = now;
      this.draw();
    }
    this.rafId = requestAnimationFrame(this.tick);
  }

  onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.draw();
    }, 60);
  }

  /** Terrain height at a world position, ridged so peaks read as mountains. */
  heightAt(x, z) {
    const base = noise(x * 0.3 + 11, z * 0.34);
    const detail = noise(x * 0.82 - 3, z * 0.95 + 7);
    const ridged = Math.abs(base - 0.5) * 2;
    return (ridged * 0.82 + detail * 0.18) * RIDGE_HEIGHT;
  }

  draw() {
    const { ctx, width: w, height: h } = this;
    if (!w) return;

    ctx.clearRect(0, 0, w, h);

    const focal = w * 0.62;
    const horizon = h * 0.43 + this.tilt.y * h * 0.03;
    const cx = w * 0.5 + this.tilt.x * w * 0.045;
    const camY = 2.8;
    const scroll = this.time * SPEED;

    // Grid vertices, far row first so nearer rows paint over them.
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const z = Z_NEAR + (ROWS - 1 - r) * Z_STEP;
      const row = [];
      for (let c = 0; c < COLS; c++) {
        const x = (c / (COLS - 1) - 0.5) * 26;
        const y = this.heightAt(x, z + scroll);
        row.push({
          sx: cx + (x / z) * focal,
          sy: horizon + ((camY - y) / z) * focal * 0.22,
          z,
        });
      }
      grid.push(row);
    }

    // Depth cue: nearer rows are brighter and thicker.
    const alphaFor = (z) => {
      const t = 1 - (z - Z_NEAR) / (ROWS * Z_STEP);
      return Math.max(0, Math.min(1, t)) ** 1.6;
    };

    for (let r = 0; r < ROWS; r++) {
      const row = grid[r];
      const a = alphaFor(row[0].z);
      if (a < 0.02) continue;

      ctx.beginPath();
      ctx.moveTo(row[0].sx, row[0].sy);
      for (let c = 1; c < COLS; c++) ctx.lineTo(row[c].sx, row[c].sy);
      ctx.strokeStyle = `rgba(128, 156, 255, ${0.1 + a * 0.8})`;
      ctx.lineWidth = 0.8 + a * 1.3;
      ctx.stroke();
    }

    // Sparse lengthwise lines, enough to read as a mesh without becoming noise.
    for (let c = 0; c < COLS; c += 3) {
      ctx.beginPath();
      for (let r = 0; r < ROWS; r++) {
        const p = grid[r][c];
        if (r === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.strokeStyle = "rgba(99, 130, 255, 0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // A dot on the highest vertex of each near row, so peaks catch the light.
    for (let r = ROWS - 16; r < ROWS; r++) {
      const row = grid[r];
      let top = row[0];
      for (const p of row) if (p.sy < top.sy) top = p;
      const a = alphaFor(top.z);
      ctx.beginPath();
      ctx.arc(top.sx, top.sy, 1.6 + a * 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 200, 255, ${a * 0.5})`;
      ctx.fill();
    }

    // Horizon glow, drawn before the particles so they sit on top.
    const glow = ctx.createLinearGradient(0, horizon - h * 0.16, 0, horizon + h * 0.06);
    glow.addColorStop(0, "rgba(53, 82, 214, 0)");
    glow.addColorStop(0.72, "rgba(63, 96, 235, 0.18)");
    glow.addColorStop(1, "rgba(10, 13, 22, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - h * 0.16, w, h * 0.22);

    for (const p of this.particles) {
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.time * 1.4 + p.phase));
      const px = (p.x + this.tilt.x * 0.02 * p.z) * w;
      const py = p.y * h;
      ctx.beginPath();
      ctx.arc(px, py, p.z * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150, 175, 255, ${0.1 + twinkle * 0.28 * p.z})`;
      ctx.fill();
    }
  }
}
