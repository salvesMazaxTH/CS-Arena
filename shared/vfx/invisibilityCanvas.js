// Invisible: the champion is turning to glass. Cold cyan-white, translucent, hologram-like —
// a marching dashed contour, hologram scan lines, a cloak glint sweeping across the body and
// motes of the figure dissolving upward. The portrait art itself is faded by `.is-invisible`
// in combat-fx.css, so the body reads see-through, not just decorated.

import { runStatusCanvas, clipToOval, makeGlowSprite } from "./statusCanvasKit.js";

const MOTE_COUNT = 20;
const TAU = Math.PI * 2;

export function startInvisibilityCanvas(canvas) {
  const mote = makeGlowSprite(48, [214, 246, 255]);
  const motes = Array.from({ length: MOTE_COUNT }, () => ({
    x: Math.random(),
    y: Math.random(),
    rise: 0.08 + Math.random() * 0.14,
    sway: Math.random() * TAU,
    size: 0.05 + Math.random() * 0.07,
  }));

  let scanPattern = null;
  let scanPatternFor = 0;

  // Thin horizontal lines, baked once per size: the "projection" texture.
  function getScanPattern(ctx, u) {
    const step = Math.max(4, Math.round(u * 0.045));
    if (scanPattern && scanPatternFor === step) return { pattern: scanPattern, step };

    const tile = document.createElement("canvas");
    tile.width = 4;
    tile.height = step;
    const tctx = tile.getContext("2d");
    tctx.fillStyle = "rgba(196, 240, 255, 0.34)";
    tctx.fillRect(0, 0, 4, Math.max(1.5, step * 0.22));
    scanPattern = ctx.createPattern(tile, "repeat");
    scanPatternFor = step;
    return { pattern: scanPattern, step };
  }

  function draw(ctx, g, t, dt) {
    const { cx, cy, rx, ry, u, w, h } = g;
    const breathe = 0.5 + 0.5 * Math.sin(t * 2.1);

    ctx.save();
    clipToOval(ctx, g);

    // glass body tint, brighter at the rim: the figure is a lens, not a solid
    const tint = ctx.createRadialGradient(cx, cy, u * 0.1, cx, cy, Math.max(rx, ry));
    tint.addColorStop(0, `rgba(150, 220, 255, ${0.1 + breathe * 0.05})`);
    tint.addColorStop(0.7, `rgba(150, 224, 255, ${0.12 + breathe * 0.05})`);
    tint.addColorStop(1, "rgba(190, 240, 255, 0.3)");
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);

    // hologram scan lines crawling down the body
    const { pattern, step } = getScanPattern(ctx, u);
    ctx.save();
    ctx.translate(0, (t * step * 2.2) % step);
    ctx.fillStyle = pattern;
    ctx.globalAlpha = 0.55 + breathe * 0.25;
    ctx.fillRect(0, -step, w, h + step * 2);
    ctx.restore();

    // cloak glint: a bright diagonal band that slides across every few seconds
    const cycle = (t % 2.6) / 2.6;
    const bandX = -u * 0.5 + cycle * (w + u);
    const band = ctx.createLinearGradient(bandX - u * 0.28, 0, bandX + u * 0.28, 0);
    band.addColorStop(0, "rgba(220, 250, 255, 0)");
    band.addColorStop(0.5, "rgba(236, 252, 255, 0.42)");
    band.addColorStop(1, "rgba(220, 250, 255, 0)");
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.38);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = band;
    ctx.fillRect(bandX - u * 0.28, -h, u * 0.56, h * 3);
    ctx.restore();

    // motes: pieces of the figure lifting off and dissolving
    ctx.globalCompositeOperation = "lighter";
    for (const m of motes) {
      m.y -= m.rise * dt;
      if (m.y < -0.05) {
        m.y = 1.02;
        m.x = Math.random();
      }
      const fade = Math.min(1, m.y * 3.2, (1.05 - m.y) * 5);
      const px = cx + (m.x - 0.5) * rx * 1.7 + Math.sin(t * 1.6 + m.sway) * u * 0.03;
      const py = cy + (m.y - 0.5) * ry * 2;
      const size = u * m.size * 2.6;
      ctx.globalAlpha = Math.max(0, fade) * 0.95;
      ctx.drawImage(mote, px - size / 2, py - size / 2, size, size);
    }
    ctx.restore();

    // contour: a marching dashed ring with a soft halo; flickers like a failing cloak
    const flicker = Math.sin(t * 23) > 0.93 ? 0.35 : 1;
    const dash = u * 0.11;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = flicker;

    ctx.lineWidth = Math.max(5, u * 0.06);
    ctx.strokeStyle = "rgba(120, 214, 255, 0.28)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.97, ry * 0.97, 0, 0, TAU);
    ctx.stroke();

    ctx.setLineDash([dash, dash * 0.7]);
    ctx.lineDashOffset = -t * u * 0.35;
    ctx.lineWidth = Math.max(3, u * 0.028);
    ctx.strokeStyle = "rgba(226, 250, 255, 0.95)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.97, ry * 0.97, 0, 0, TAU);
    ctx.stroke();

    ctx.setLineDash([dash * 0.4, dash * 1.3]);
    ctx.lineDashOffset = t * u * 0.5;
    ctx.lineWidth = Math.max(2, u * 0.016);
    ctx.strokeStyle = "rgba(170, 228, 255, 0.8)";
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.82, ry * 0.82, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  return runStatusCanvas(canvas, draw);
}
