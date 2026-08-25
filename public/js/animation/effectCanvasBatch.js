import { computeEffectBox, MAX_EFFECT_DPR } from "./animationUtils.js";
import { recordEffectFrame } from "./effectQuality.js";

function unionBox(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

// ============================================================
//  Effect Canvas Batch
//
//  Lets several skill-hit VFX landing in the same wave (an AoE skill's
//  simultaneous targets) share one canvas and one requestAnimationFrame
//  loop instead of each mounting its own full-viewport canvas.
// ============================================================
export class EffectCanvasBatch {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.box = null;
    this.effects = [];
    this.looping = false;
    this.last = 0;
  }

  // Registers one effect built against the batch's shared context and
  // returns a promise that resolves once its step() returns false.
  run(points, padding, buildEffect, onFrame) {
    this.grow(computeEffectBox(points, padding));
    const effect = buildEffect(this.ctx);

    return new Promise((resolve) => {
      this.effects.push({ effect, onFrame, resolve });
      this.startLoop();
    });
  }

  // Resizes the shared canvas to also cover `requested`, reusing the same
  // canvas/context so effects already registered keep drawing correctly.
  grow(requested) {
    this.box = this.box ? unionBox(this.box, requested) : requested;

    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.style.cssText =
        "position:fixed;pointer-events:none;z-index:999";
      document.body.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
    }

    const { x, y, width, height } = this.box;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_EFFECT_DPR);
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.left = `${x}px`;
    this.canvas.style.top = `${y}px`;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr);
  }

  startLoop() {
    if (this.looping) return;
    this.looping = true;
    this.last = performance.now();
    requestAnimationFrame((now) => this.frame(now));
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 1 / 30);
    this.last = now;

    const { x, y, width, height } = this.box;
    this.ctx.clearRect(x, y, width, height);
    recordEffectFrame(dt);

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const entry = this.effects[i];
      const alive = entry.effect.step(dt);
      entry.onFrame?.(entry.effect);
      if (!alive) {
        this.effects.splice(i, 1);
        entry.resolve();
      }
    }

    if (this.effects.length === 0) {
      this.canvas.remove();
      this.looping = false;
      return;
    }
    requestAnimationFrame((now2) => this.frame(now2));
  }
}
