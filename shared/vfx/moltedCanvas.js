// "Molted" effect (Zophiróx — Molting Cycle, after the shed).
// Permanent once he has molted.
//
// Visual read: fresh scales, not a fury aura. A glint sweeps diagonally across
// a diamond scale lattice as if the new skin catches light for the first time,
// flakes of the old skin keep peeling off and tumbling away, acid beads slide
// down and hiss where they fall, and a low venom mist hugs the ground.

const ACID = "156, 255, 46";
const DEEP = "30, 92, 18";
const PALE = "236, 255, 190";
const SCALE_GOLD = "226, 214, 92";

export function startMolted(canvas, data = {}) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let t = 0; // seconds
  let last = performance.now();

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // ───────── SCALE GLINT ─────────
  // A diamond lattice drawn only inside a narrow diagonal band that sweeps
  // across, so most of the time the portrait is untouched and the scales
  // read as a shimmer rather than a grid laid over the art.
  const GLINT_PERIOD = 3.4;
  const GLINT_WIDTH = 0.16;

  function drawScaleGlint() {
    const w = canvas.width;
    const h = canvas.height;
    const cell = Math.max(10, Math.min(w, h) * 0.085);

    // Band position along the diagonal, from off-canvas to off-canvas.
    const p = (t % GLINT_PERIOD) / GLINT_PERIOD;
    const sweep = -0.3 + p * 1.6;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1;

    for (let row = -1; row * cell * 0.5 < h + cell; row++) {
      const offset = row % 2 === 0 ? 0 : cell / 2;
      const y = row * cell * 0.5;

      for (let x = -cell + offset; x < w + cell; x += cell) {
        const diag = (x / w + y / h) / 2;
        const d = Math.abs(diag - sweep) / GLINT_WIDTH;
        if (d >= 1) continue;

        const k = Math.pow(1 - d, 2);
        const hw = cell / 2;
        const hh = cell * 0.32;

        ctx.beginPath();
        ctx.moveTo(x, y - hh);
        ctx.lineTo(x + hw, y);
        ctx.lineTo(x, y + hh);
        ctx.lineTo(x - hw, y);
        ctx.closePath();
        ctx.strokeStyle = `rgba(${d < 0.35 ? SCALE_GOLD : ACID}, ${0.32 * k})`;
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ───────── SHED FLAKES ─────────
  // Small, thin shards of old skin: they peel off near the silhouette's edge,
  // drift outward, tumble and fall, fading before they grow noticeable.
  class Flake {
    constructor(init) {
      this.reset(init);
    }
    reset(init = false) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.x = canvas.width * (0.5 + side * (0.12 + Math.random() * 0.22));
      this.y = canvas.height * (0.15 + Math.random() * 0.6);
      this.vx = side * (6 + Math.random() * 16);
      this.vy = -(4 + Math.random() * 8);
      this.w = 2.5 + Math.random() * 3.5;
      this.h = 1 + Math.random() * 1.6;
      this.rot = Math.random() * Math.PI * 2;
      this.spin = (Math.random() - 0.5) * 7;
      this.life = 1.4 + Math.random() * 1.2;
      this.age = init ? Math.random() * this.life : 0;
    }
    update(dt) {
      this.age += dt;
      this.vy += 26 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.rot += this.spin * dt;
      if (this.age > this.life || this.y > canvas.height + 6) this.reset();
    }
    draw() {
      const k = Math.max(0, 1 - this.age / this.life);
      // Tumbling: the flake's visible width flickers as it turns edge-on.
      const face = Math.abs(Math.cos(this.rot * 1.3));

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rot);
      ctx.scale(1, 0.25 + face * 0.75);
      ctx.beginPath();
      ctx.moveTo(-this.w, 0);
      ctx.lineTo(0, -this.h);
      ctx.lineTo(this.w, 0);
      ctx.lineTo(0, this.h);
      ctx.closePath();
      ctx.fillStyle = `rgba(${DEEP}, ${0.75 * k})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${face > 0.8 ? SCALE_GOLD : ACID}, ${0.7 * k})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ───────── ACID DRIPS ─────────
  // A bead gathers, slides down leaving a short thin trail, and bursts into a
  // few hissing specks at the bottom edge.
  class Drip {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = canvas.width * (0.2 + Math.random() * 0.6);
      this.y = canvas.height * (0.3 + Math.random() * 0.35);
      this.gather = 0.4 + Math.random() * 0.9;
      this.vy = 0;
      this.r = 1.3 + Math.random() * 1.1;
      this.age = 0;
    }
    update(dt) {
      this.age += dt;
      if (this.age < this.gather) return;

      this.vy += 240 * dt;
      this.y += this.vy * dt;

      const floor = canvas.height * 0.94;
      if (this.y >= floor) {
        spawnHiss(this.x, floor);
        this.reset();
      }
    }
    draw() {
      const grow = Math.min(1, this.age / this.gather);
      const r = this.r * (0.4 + 0.6 * grow);
      const trail = Math.min(this.vy * 0.06, 14);

      if (trail > 0.5) {
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - trail);
        ctx.lineTo(this.x, this.y);
        ctx.lineWidth = r * 0.9;
        ctx.lineCap = "round";
        ctx.strokeStyle = `rgba(${ACID}, 0.35)`;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${PALE}, 0.85)`;
      ctx.shadowColor = `rgba(${ACID}, 0.9)`;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  const specks = [];
  function spawnHiss(x, y) {
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
      const speed = 18 + Math.random() * 30;
      specks.push({
        x,
        y,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 0.35 + Math.random() * 0.25,
        age: 0,
      });
    }
  }

  function drawSpecks(dt) {
    for (let i = specks.length - 1; i >= 0; i--) {
      const s = specks[i];
      s.age += dt;
      if (s.age >= s.life) {
        specks.splice(i, 1);
        continue;
      }
      s.vy += 90 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const k = 1 - s.age / s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 0.9 + k, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${ACID}, ${0.8 * k})`;
      ctx.fill();
    }
  }

  // ───────── VENOM MIST ─────────
  // A few flattened soft blobs drifting along the bottom edge.
  const mist = Array.from({ length: 5 }, (_, i) => ({
    phase: i * 1.7,
    speed: 0.12 + Math.random() * 0.1,
    scale: 0.28 + Math.random() * 0.14,
  }));

  function drawMist() {
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    for (const m of mist) {
      const x = (((m.phase + t * m.speed) % 1.4) - 0.2) * w;
      const y = h * (0.9 + Math.sin(t * 0.8 + m.phase) * 0.025);
      const r = w * m.scale;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.32);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${ACID}, 0.13)`);
      g.addColorStop(0.6, `rgba(${DEEP}, 0.08)`);
      g.addColorStop(1, `rgba(${DEEP}, 0)`);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  const flakes = Array.from({ length: 12 }, () => new Flake(true));
  const drips = Array.from({ length: 3 }, () => new Drip());

  function render(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;

    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawMist();
    drawScaleGlint();

    for (const f of flakes) {
      f.update(dt);
      f.draw();
    }

    for (const d of drips) {
      d.update(dt);
      d.draw();
    }
    drawSpecks(dt);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
    },
  };
}
