// Shared plumbing for the always-on status canvases (invisible, concealed): the canvas is fitted
// exactly to the portrait wrapper, resized when the wrapper changes, driven by one rAF loop with a
// clamped dt, and stopped cleanly. Glows and smoke are baked once into sprites and blitted.

export function runStatusCanvas(canvas, draw) {
  const ctx = canvas.getContext("2d");
  const box = canvas.parentElement;
  let running = true;
  let rafId = 0;
  let lastTs = performance.now();
  let time = 0;
  let lastW = 0;
  let lastH = 0;

  const geometry = { w: 0, h: 0, cx: 0, cy: 0, rx: 0, ry: 0, u: 0 };

  function syncSize() {
    const w = box?.clientWidth || 0;
    const h = box?.clientHeight || 0;
    if (!w || !h) return false;

    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      lastW = w;
      lastH = h;
    }

    // The portrait is an oval (4:5): effects clip to it instead of a circle.
    geometry.w = w;
    geometry.h = h;
    geometry.cx = w / 2;
    geometry.cy = h / 2;
    geometry.rx = w * 0.49;
    geometry.ry = h * 0.49;
    geometry.u = Math.min(w, h);
    return true;
  }

  function frame(ts) {
    if (!running) return;

    const dt = Math.min(0.05, Math.max(0, (ts - lastTs) / 1000));
    lastTs = ts;
    time += dt;

    if (syncSize()) {
      ctx.clearRect(0, 0, geometry.w, geometry.h);
      draw(ctx, geometry, time, dt, lastW, lastH);
    }

    rafId = requestAnimationFrame(frame);
  }

  window.addEventListener("resize", syncSize);
  rafId = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncSize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

export function clipToOval(ctx, g, grow = 1) {
  ctx.beginPath();
  ctx.ellipse(g.cx, g.cy, g.rx * grow, g.ry * grow, 0, 0, Math.PI * 2);
  ctx.clip();
}

// A soft round glow baked once: bright core fading to nothing.
export function makeGlowSprite(size, [r, g, b], coreAlpha = 1) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = size;
  const sctx = sprite.getContext("2d");
  const half = size / 2;
  const grad = sctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${r},${g},${b},${coreAlpha})`);
  grad.addColorStop(0.35, `rgba(${r},${g},${b},${coreAlpha * 0.45})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, size, size);
  return sprite;
}

// A cloud baked once from overlapping soft lobes, so drifting puffs read as smoke, not as discs.
export function makeSmokeSprite(size, [r, g, b], lobes = 7, seed = 1) {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = size;
  const sctx = sprite.getContext("2d");
  const half = size / 2;
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 0; i < lobes; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * half * 0.42;
    const x = half + Math.cos(a) * d;
    const y = half + Math.sin(a) * d * 0.8;
    const rad = half * (0.34 + rnd() * 0.3);
    const grad = sctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(0.6, `rgba(${r},${g},${b},0.22)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
  }

  return sprite;
}
