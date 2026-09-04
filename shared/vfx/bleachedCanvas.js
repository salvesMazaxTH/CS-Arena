// Bleached (Seymour — Bleaching Ray): while the anti-heal holds, a slow rayed
// sigil turns over the struck champion's portrait, the frame burns bright at the
// edge, and the portrait itself is wrung of colour (the `is-bleached` class
// this module owns). Sigil + aura baked once; per frame it is one drawImage, one
// strokeRect and a few dots — no gradients or shadowBlur at runtime, canvas
// resized only on the resize event.

const WHITE = "255, 253, 244";
const AMBER = "236, 198, 132";

let sigilSprite = null;

function makeSigilSprite() {
  const s = document.createElement("canvas");
  s.width = s.height = 128;
  const ctx = s.getContext("2d");
  const c = 64;

  const aura = ctx.createRadialGradient(c, c, 0, c, c, 64);
  aura.addColorStop(0, `rgba(${AMBER}, 0.5)`);
  aura.addColorStop(0.55, `rgba(${AMBER}, 0.16)`);
  aura.addColorStop(1, `rgba(${AMBER}, 0)`);
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = i % 2 ? 58 : 44;
    const half = i % 2 ? 0.05 : 0.035;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a - half) * 28, c + Math.sin(a - half) * 28);
    ctx.lineTo(c + Math.cos(a) * len, c + Math.sin(a) * len);
    ctx.lineTo(c + Math.cos(a + half) * 28, c + Math.sin(a + half) * 28);
    ctx.closePath();
    ctx.fillStyle = `rgba(${WHITE}, 0.85)`;
    ctx.fill();
  }

  const core = ctx.createRadialGradient(c, c, 0, c, c, 27);
  core.addColorStop(0, `rgba(${WHITE}, 0.95)`);
  core.addColorStop(0.6, `rgba(${AMBER}, 0.85)`);
  core.addColorStop(1, `rgba(${AMBER}, 0.1)`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(c, c, 27, 0, Math.PI * 2);
  ctx.fill();

  return s;
}

export function startBleached(canvas) {
  const ctx = canvas.getContext("2d");
  const championEl = canvas.closest(".champion");
  championEl?.classList.add("is-bleached");

  if (!sigilSprite) sigilSprite = makeSigilSprite();

  let running = true;
  let t = 0;
  let last = performance.now();

  function resize() {
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  resize();
  window.addEventListener("resize", resize);

  const motes = Array.from({ length: 5 }, () => ({
    x: Math.random(),
    y: Math.random(),
    speed: 0.06 + Math.random() * 0.07,
    r: 1 + Math.random() * 1.6,
  }));

  function render(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;
    resize();

    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) {
      requestAnimationFrame(render);
      return;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    const pulse = 0.5 + 0.5 * Math.sin(t * 3.0);

    // Sigil + aura: one sprite, centred, slowly turning as the hour moves.
    const size = Math.min(w, h) * (0.92 + 0.05 * pulse);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(t * 0.16);
    ctx.globalAlpha = 0.4 + 0.28 * pulse;
    ctx.drawImage(sigilSprite, -size / 2, -size / 2, size, size);
    ctx.restore();

    // The frame burns at the edge.
    const inset = Math.min(w, h) * 0.11;
    ctx.globalAlpha = 0.22 + 0.32 * pulse;
    ctx.strokeStyle = `rgba(${WHITE}, 0.9)`;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

    // Dust rising through the light.
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = `rgba(${WHITE}, 0.85)`;
    for (const m of motes) {
      m.y -= m.speed * dt;
      if (m.y < -0.05) {
        m.y = 1.05;
        m.x = Math.random();
      }
      ctx.beginPath();
      ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
      championEl?.classList.remove("is-bleached");
    },
  };
}
