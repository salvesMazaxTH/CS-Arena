// Concealed: the champion is swallowed by shadow. Dark violet-black and heavy — the opposite of
// Invisible's cold glass. Banks of smoke roll across the face, the rim is lost in a dark vignette
// and a dark ring pulses around the portrait; `.is-concealed` in combat-fx.css dims the art
// underneath. The body is still there, you just cannot make it out.

import { runStatusCanvas, clipToOval, makeSmokeSprite } from "./statusCanvasKit.js";

const TAU = Math.PI * 2;

export function startConcealedCanvas(canvas) {
  const darkSmoke = [
    makeSmokeSprite(128, [14, 10, 26], 8, 1),
    makeSmokeSprite(128, [18, 12, 32], 8, 2),
    makeSmokeSprite(128, [10, 8, 20], 9, 3),
  ];
  const violetSmoke = makeSmokeSprite(128, [118, 82, 190], 6, 4);

  const banks = Array.from({ length: 11 }, (_, i) => ({
    sprite: darkSmoke[i % darkSmoke.length],
    x: Math.random(),
    y: 0.08 + (i / 11) * 0.9,
    speed: (0.06 + Math.random() * 0.08) * (i % 2 ? 1 : -1),
    bob: Math.random() * TAU,
    size: 0.78 + Math.random() * 0.5,
    alpha: 0.5 + Math.random() * 0.2,
  }));

  const wisps = Array.from({ length: 5 }, () => ({
    x: Math.random(),
    y: 0.2 + Math.random() * 0.7,
    speed: 0.05 + Math.random() * 0.06,
    bob: Math.random() * TAU,
    size: 0.5 + Math.random() * 0.3,
  }));

  let vignette = null;
  let vignetteKey = "";

  // Dark from the rim inward, baked once per size and breathed with globalAlpha.
  function getVignette(g) {
    const key = `${g.w}x${g.h}`;
    if (vignette && vignetteKey === key) return vignette;

    vignette = document.createElement("canvas");
    vignette.width = g.w;
    vignette.height = g.h;
    const vctx = vignette.getContext("2d");
    vctx.translate(g.cx, g.cy);
    vctx.scale(1, g.ry / g.rx);
    const grad = vctx.createRadialGradient(0, 0, g.rx * 0.18, 0, 0, g.rx);
    grad.addColorStop(0, "rgba(8, 6, 16, 0.12)");
    grad.addColorStop(0.55, "rgba(10, 7, 20, 0.5)");
    grad.addColorStop(1, "rgba(4, 3, 10, 0.96)");
    vctx.fillStyle = grad;
    vctx.fillRect(-g.w * 2, -g.w * 2, g.w * 4, g.w * 4);
    vignetteKey = key;
    return vignette;
  }

  function draw(ctx, g, t, dt) {
    const { cx, cy, rx, ry, u, w, h } = g;
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.5);

    ctx.save();
    clipToOval(ctx, g);

    ctx.globalAlpha = 0.82 + breathe * 0.18;
    ctx.drawImage(getVignette(g), 0, 0);

    // rolling banks of dark smoke, alternating direction so the face is never clear
    for (const b of banks) {
      b.x += b.speed * dt;
      if (b.x > 1.25) b.x = -0.25;
      if (b.x < -0.25) b.x = 1.25;

      const size = u * b.size * 1.35;
      const px = b.x * w;
      const py = b.y * h + Math.sin(t * 0.9 + b.bob) * u * 0.05;
      ctx.globalAlpha = b.alpha;
      ctx.drawImage(b.sprite, px - size / 2, py - size / 2, size, size);
    }

    // violet edge-light on the smoke so it has volume instead of reading as a flat smear
    ctx.globalCompositeOperation = "lighter";
    for (const s of wisps) {
      s.x += s.speed * dt;
      if (s.x > 1.2) s.x = -0.2;
      const size = u * s.size * 1.2;
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(t * 1.2 + s.bob);
      ctx.drawImage(violetSmoke, s.x * w - size / 2, s.y * h - size / 2 + Math.sin(t * 0.7 + s.bob) * u * 0.04, size, size);
    }
    ctx.restore();

    // a dark ring that swells and recedes around the portrait
    ctx.save();
    ctx.lineWidth = Math.max(6, u * 0.075);
    ctx.strokeStyle = `rgba(6, 4, 14, ${0.7 + breathe * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * (0.965 - breathe * 0.012), ry * (0.965 - breathe * 0.012), 0, 0, TAU);
    ctx.stroke();

    ctx.lineWidth = Math.max(2.5, u * 0.02);
    ctx.strokeStyle = `rgba(146, 104, 224, ${0.28 + breathe * 0.22})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.9, ry * 0.9, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  return runStatusCanvas(canvas, draw);
}
