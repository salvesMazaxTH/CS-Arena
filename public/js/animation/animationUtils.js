// Geometry and canvas plumbing shared by every skill animation.

export function getElementCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

// Capped ratio: every VFX in this folder is soft glows, so pixels beyond
// this buy nothing.
export const MAX_EFFECT_DPR = 1.5;

// Bounding box (viewport coordinates, clamped to the screen) around the
// points an effect draws near, expanded by `padding`. Sizing a canvas to
// this instead of the full viewport is what keeps these effects cheap on
// weak GPUs, since fill-rate scales with canvas area.
export function computeEffectBox(points, padding) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.max(0, Math.min(...xs) - padding);
  const y = Math.max(0, Math.min(...ys) - padding);
  const right = Math.min(window.innerWidth, Math.max(...xs) + padding);
  const bottom = Math.min(window.innerHeight, Math.max(...ys) + padding);
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

// Mounts a canvas covering `box` and returns a context already transformed
// so draw calls can keep using ordinary viewport coordinates.
export function mountEffectCanvas(box) {
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_EFFECT_DPR);
  canvas.width = box.width * dpr;
  canvas.height = box.height * dpr;
  canvas.style.cssText = `position:fixed;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;pointer-events:none;z-index:999`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);
  return { canvas, ctx };
}

// Drives one effect through its own canvas and requestAnimationFrame loop
// until step() returns false, then tears the canvas down. `onFrame`, if
// given, is called with the effect after every step (e.g. to watch for an
// impact flag). Used whenever the effect isn't part of a shared
// EffectCanvasBatch.
export async function runSoloEffect(box, buildEffect, onFrame) {
  const { canvas, ctx } = mountEffectCanvas(box);
  const effect = buildEffect(ctx);
  let last = performance.now();

  await new Promise((resolve) => {
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      ctx.clearRect(box.x, box.y, box.width, box.height);
      const alive = effect.step(dt);
      onFrame?.(effect);
      if (!alive) {
        canvas.remove();
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}
