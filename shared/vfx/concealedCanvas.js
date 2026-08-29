export function startConcealedCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  let running = true;
  let time = 0;

  const box = canvas.parentElement;
  let lastW = 0;
  let lastH = 0;

  function syncSize() {
    const w = box?.clientWidth || 0;
    const h = box?.clientHeight || 0;
    if (!w || !h) return;

    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      lastW = w;
      lastH = h;
    }
  }

  syncSize();
  window.addEventListener("resize", syncSize);

  const W = () => canvas.width;
  const H = () => canvas.height;

  // Slow, heavy haze that drifts upward and sways — smoke the champion sinks into.
  class ShadeWisp {
    constructor() {
      this.reset(true);
    }

    reset(initial) {
      this.x = Math.random();
      this.y = initial ? Math.random() : 1 + Math.random() * 0.3;
      this.drift = 0.00028 + Math.random() * 0.0006;
      this.sway = 0.4 + Math.random() * 0.9;
      this.swaySpeed = 0.0006 + Math.random() * 0.0016;
      this.phase = Math.random() * Math.PI * 2;
      this.size = 0.28 + Math.random() * 0.3;
      this.alpha = 0.1 + Math.random() * 0.16;
    }

    update() {
      this.y -= this.drift;
      this.phase += this.swaySpeed;
      if (this.y < -0.35) this.reset(false);
    }

    draw(radius, cx, cy) {
      const px = cx + (this.x - 0.5) * radius * 2 + Math.sin(this.phase) * this.sway * radius * 0.16;
      const py = cy + (this.y - 0.5) * radius * 2;
      const r = radius * this.size;

      const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, `rgba(44, 48, 60, ${this.alpha})`);
      grad.addColorStop(1, "rgba(30, 32, 42, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const wisps = Array.from({ length: 11 }, () => new ShadeWisp());

  // Dark from the rim inward: the silhouette stays legible, the edges are lost.
  function drawShroud(cx, cy, radius) {
    const pulse = 0.9 + Math.sin(time * 0.0013) * 0.1;

    const shroud = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.35,
      cx,
      cy,
      radius * 1.02,
    );
    shroud.addColorStop(0, "rgba(16, 18, 24, 0)");
    shroud.addColorStop(0.62, `rgba(18, 20, 27, ${0.22 * pulse})`);
    shroud.addColorStop(1, `rgba(12, 13, 18, ${0.6 * pulse})`);

    ctx.fillStyle = shroud;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Shadow welling up from below, breathing in and out.
  function drawUndertow(cx, cy, radius) {
    const rise = radius * (0.5 + Math.sin(time * 0.0011) * 0.12);
    const top = cy + radius - rise;

    const grad = ctx.createLinearGradient(cx, cy + radius, cx, top);
    grad.addColorStop(0, "rgba(10, 11, 16, 0.5)");
    grad.addColorStop(1, "rgba(10, 11, 16, 0)");

    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, top, radius * 2, rise);
  }

  function render() {
    if (!running) return;

    syncSize();
    ctx.clearRect(0, 0, W(), H());

    const cx = W() / 2;
    const cy = H() / 2;
    const radius = Math.max(10, Math.min(W(), H()) * 0.49);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    drawUndertow(cx, cy, radius);

    for (const wisp of wisps) {
      wisp.update();
      wisp.draw(radius, cx, cy);
    }

    drawShroud(cx, cy, radius);

    ctx.restore();

    time += 16;
    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", syncSize);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
