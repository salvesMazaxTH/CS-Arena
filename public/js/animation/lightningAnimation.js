// ============================================================
//  Lightning Bolt Animation
//
//  Generic bolt used by every non-contact lightning skill.
//  Canvas 2D, a handful of frames of branching zigzags.
// ============================================================

import { getElementCenter } from "./animationUtils.js";

// Hues follow shared/ui/identityPalette.js, as the cut motifs do. The choice is
// authorial only: every skill drawing this bolt is already lightning, so the
// element cannot tell the two looks apart.
const PALETTES = Object.freeze({
  azure: { body: "#7df9ff", tip: "#00ffff", branch: "#b2f7ff" },
  lightning: { body: "#ffe14d", tip: "#ffa713", branch: "#fff3a6" },
});

export async function playLightningBolt({ userEl, targetEl, skill }) {
  if (!targetEl) return;

  const palette = PALETTES[skill?.hitVfxPalette] ?? PALETTES.azure;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999";

  document.body.appendChild(canvas);

  const start = userEl
    ? getElementCenter(userEl)
    : { x: getElementCenter(targetEl).x - 120, y: getElementCenter(targetEl).y - 200 };
  const end = getElementCenter(targetEl);

  // Builds the zigzag point list for one lightning segment
  function buildBoltPoints(from, to, segments, variance) {
    const pts = [from];
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      pts.push({
        x: from.x + (to.x - from.x) * t + (Math.random() - 0.5) * variance,
        y: from.y + (to.y - from.y) * t + (Math.random() - 0.5) * variance,
      });
    }
    pts.push(to);
    return pts;
  }

  // Strokes a lightning path from already generated points
  function strokeBolt(pts, width, color, alpha) {
    if (pts.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 30;
    ctx.shadowColor = color;

    const grad = ctx.createLinearGradient(
      pts[0].x,
      pts[0].y,
      pts[pts.length - 1].x,
      pts[pts.length - 1].y,
    );
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.15, color);
    grad.addColorStop(1, palette.tip);
    ctx.strokeStyle = grad;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  // Draws the main bolt plus its glow layer and branches
  function drawLightning() {
    const mainPts = buildBoltPoints(start, end, 18, 45);

    // Outer diffuse halo
    strokeBolt(mainPts, 28, palette.body, 0.15);
    // Main body
    strokeBolt(mainPts, 10, palette.body, 0.9);
    // White core
    strokeBolt(mainPts, 3, "#ffffff", 1.0);

    // Branches sprouting from random points of the main bolt
    const branchCount = 2 + Math.floor(Math.random() * 2);
    for (let b = 0; b < branchCount; b++) {
      const idx = 3 + Math.floor(Math.random() * (mainPts.length - 6));
      const origin = mainPts[idx];
      const branchEnd = {
        x: origin.x + (Math.random() - 0.5) * 90,
        y:
          origin.y + (Math.random() * 60 + 20) * (Math.random() < 0.5 ? 1 : -1),
      };
      const branchPts = buildBoltPoints(origin, branchEnd, 6, 15);
      strokeBolt(branchPts, 4, palette.branch, 0.55);
      strokeBolt(branchPts, 1.5, "#ffffff", 0.7);
    }
  }

  // 5 frames to give the bolt more presence
  for (let i = 0; i < 5; i++) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawLightning();
    await new Promise((r) => setTimeout(r, 40));
  }

  // Visual impact on the target
  targetEl.classList.add("lightning-hit");
  setTimeout(() => targetEl.classList.remove("lightning-hit"), 200);

  canvas.remove();
}
