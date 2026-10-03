// ============================================================
//  Spine Animations
//
//  Two motifs built from the same drawn spine — a thin bone-coloured
//  needle with a darker tip:
//
//  - `hitVfx: "spine_volley"`: a fan of spines shot from the user,
//    staggered, landing in the target with a short spray of flecks.
//  - `hitVfx: "thorn_prick"`: spines jab inward around the target from
//    every side and snap back out — the bearer's thorns biting whoever
//    struck them. Kept short and light: it plays on every contact hit
//    against a thorned champion.
//  - `hitVfx: "briar_crush"`: a denser double ring of spines that closes
//    on the target and holds — being crushed against a thorned body.
//
//  Spines are drawn thin and fast so they read as solid needles
//  without lingering on screen.
// ============================================================

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";

// body: the spine's shaft; tip: its point and the flecks it throws.
const PALETTES = Object.freeze({
  crimson: { body: "#e6dcc4", edge: "#3a2a22", tip: "#a3121b" },
  steel: { body: "#dfe7ee", edge: "#2b3138", tip: "#5f7f9e" },
});
const DEFAULT_PALETTE = "crimson";

function resolvePalette(skill) {
  const key = skill?.hitVfxPalette;
  return PALETTES[key in PALETTES ? key : DEFAULT_PALETTE];
}

// Draws one spine with its point at (x, y), pointing along `angle`.
function drawSpine(ctx, x, y, angle, length, width, colors, alpha = 1) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const baseX = x - dirX * length;
  const baseY = y - dirY * length;
  const normX = -dirY * width;
  const normY = dirX * width;

  const grad = ctx.createLinearGradient(baseX, baseY, x, y);
  grad.addColorStop(0, colors.body);
  grad.addColorStop(0.65, colors.body);
  grad.addColorStop(1, colors.tip);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = grad;
  ctx.strokeStyle = colors.edge;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(baseX + normX, baseY + normY);
  ctx.lineTo(baseX - normX * 0.6, baseY - normY * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Small dark-red flecks thrown where a spine bites.
class FleckSpray {
  constructor(color) {
    this.color = color;
    this.flecks = [];
  }

  burst(x, y, angle, count) {
    for (let i = 0; i < count; i++) {
      const a = angle + Math.PI + (Math.random() - 0.5) * 1.6;
      const speed = 140 + Math.random() * 280;
      this.flecks.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.18 + Math.random() * 0.22,
        maxLife: 0.4,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  step(ctx, dt) {
    ctx.fillStyle = this.color;
    for (let i = this.flecks.length - 1; i >= 0; i--) {
      const p = this.flecks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.flecks.splice(i, 1);
        continue;
      }
      p.vx *= 0.92;
      p.vy = p.vy * 0.92 + 700 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  get alive() {
    return this.flecks.length > 0;
  }
}

// ------------------------------------------------------------
//  Spine volley
// ------------------------------------------------------------

const VOLLEY_COUNT = 5;
const VOLLEY_STAGGER = 0.045;
const VOLLEY_FLIGHT = 0.2;
const VOLLEY_LINGER = 0.22;

export class SpineVolleyEffect {
  constructor(ctx, from, to, size, colors) {
    this.ctx = ctx;
    this.colors = colors;
    this.age = 0;
    this.spray = new FleckSpray(colors.tip);
    this.fleckCount = Math.max(2, Math.round(6 * getParticleScale()));

    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    this.spines = Array.from({ length: VOLLEY_COUNT }, (_, i) => {
      // Each spine lands somewhere on the target's body, not one point.
      const land = {
        x: to.x + (Math.random() - 0.5) * size * 0.45,
        y: to.y + (Math.random() - 0.5) * size * 0.45,
      };
      // A slight arc sideways so the volley fans instead of stacking.
      const bow = (i - (VOLLEY_COUNT - 1) / 2) * size * 0.12;
      return {
        from,
        land,
        bow: { x: -Math.sin(angle) * bow, y: Math.cos(angle) * bow },
        delay: i * VOLLEY_STAGGER,
        length: size * (0.22 + Math.random() * 0.06),
        landed: false,
      };
    });

    this.lifetime =
      (VOLLEY_COUNT - 1) * VOLLEY_STAGGER + VOLLEY_FLIGHT + VOLLEY_LINGER;
  }

  pointAt(spine, p) {
    const arc = Math.sin(p * Math.PI);
    return {
      x: spine.from.x + (spine.land.x - spine.from.x) * p + spine.bow.x * arc,
      y: spine.from.y + (spine.land.y - spine.from.y) * p + spine.bow.y * arc,
    };
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    for (const spine of this.spines) {
      const t = this.age - spine.delay;
      if (t < 0) continue;

      if (t < VOLLEY_FLIGHT) {
        const p = t / VOLLEY_FLIGHT;
        const head = this.pointAt(spine, p);
        const prev = this.pointAt(spine, Math.max(0, p - 0.05));
        const angle = Math.atan2(head.y - prev.y, head.x - prev.x);
        drawSpine(ctx, head.x, head.y, angle, spine.length, 3, this.colors);
        spine.angle = angle;
        continue;
      }

      if (!spine.landed) {
        spine.landed = true;
        this.spray.burst(spine.land.x, spine.land.y, spine.angle, this.fleckCount);
      }

      // Stuck in the target, half buried, fading out.
      const fade = 1 - (t - VOLLEY_FLIGHT) / VOLLEY_LINGER;
      if (fade > 0) {
        drawSpine(
          ctx,
          spine.land.x,
          spine.land.y,
          spine.angle,
          spine.length * 0.6,
          3,
          this.colors,
          fade,
        );
      }
    }

    this.spray.step(ctx, dt);
    return this.age < this.lifetime || this.spray.alive;
  }
}

export async function playSpineVolley({ userEl, targetEl, skill, canvasBatch }) {
  if (!targetEl) return;

  const to = getElementCenter(targetEl);
  const from = userEl ? getElementCenter(userEl) : { x: to.x, y: to.y - 200 };
  const rect = targetEl.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const colors = resolvePalette(skill);

  const buildEffect = (ctx) => new SpineVolleyEffect(ctx, from, to, size, colors);
  const padding = size * 0.6 + 60;

  if (canvasBatch) {
    await canvasBatch.run([from, to], padding, buildEffect);
  } else {
    await runSoloEffect(computeEffectBox([from, to], padding), buildEffect);
  }
}

// ------------------------------------------------------------
//  Thorn prick
// ------------------------------------------------------------

// Light and short: plays on every contact hit against a thorned champion.
const PRICK = Object.freeze({
  count: 6,
  rings: 1,
  jabIn: 0.08,
  hold: 0.06,
  withdraw: 0.14,
  length: 0.18,
  width: 2.5,
  flecks: 3,
});

// The ultimate's embrace: a denser double ring that closes and stays shut
// a beat longer — the target pressed against every spine at once.
const CRUSH = Object.freeze({
  count: 10,
  rings: 2,
  jabIn: 0.12,
  hold: 0.22,
  withdraw: 0.18,
  length: 0.24,
  width: 3.5,
  flecks: 5,
});

// Spines close inward on the target from a ring around it and pull back out.
export class SpineRingEffect {
  constructor(ctx, center, size, colors, config) {
    this.ctx = ctx;
    this.center = center;
    this.colors = colors;
    this.config = config;
    this.age = 0;
    this.lifetime = config.jabIn + config.hold + config.withdraw;
    this.spray = new FleckSpray(colors.tip);
    this.sprayed = false;
    this.fleckCount = Math.max(1, Math.round(config.flecks * getParticleScale()));

    this.spines = [];
    for (let ring = 0; ring < config.rings; ring++) {
      // Each ring is offset so the spines of one fill the gaps of the other.
      const offset = Math.random() * Math.PI * 2 + (ring * Math.PI) / config.count;
      for (let i = 0; i < config.count; i++) {
        const angle = offset + (i / config.count) * Math.PI * 2;
        this.spines.push({
          // Points inward, from a ring around the target to just inside it.
          angle: angle + Math.PI,
          outer: size * (0.62 + ring * 0.12),
          inner: size * (0.3 + ring * 0.08 + Math.random() * 0.06),
          dir: { x: Math.cos(angle), y: Math.sin(angle) },
          length: size * config.length,
        });
      }
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx, center, config } = this;

    if (this.age < this.lifetime) {
      // Jab in fast, hold, withdraw.
      let reach;
      if (this.age < config.jabIn) reach = this.age / config.jabIn;
      else if (this.age < config.jabIn + config.hold) reach = 1;
      else reach = 1 - (this.age - config.jabIn - config.hold) / config.withdraw;
      const alpha = Math.min(1, reach * 1.5);

      for (const spine of this.spines) {
        const dist = spine.outer + (spine.inner - spine.outer) * reach;
        const x = center.x + spine.dir.x * dist;
        const y = center.y + spine.dir.y * dist;
        drawSpine(ctx, x, y, spine.angle, spine.length, config.width, this.colors, alpha);

        if (!this.sprayed && this.age >= config.jabIn) {
          this.spray.burst(x, y, spine.angle, this.fleckCount);
        }
      }
      if (this.age >= config.jabIn) this.sprayed = true;
    }

    this.spray.step(ctx, dt);
    return this.age < this.lifetime || this.spray.alive;
  }
}

function createSpineRing(config, paddingScale) {
  return async function playSpineRing({ targetEl, skill, canvasBatch }) {
    if (!targetEl) return;

    const center = getElementCenter(targetEl);
    const rect = targetEl.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const colors = resolvePalette(skill);

    const buildEffect = (ctx) => new SpineRingEffect(ctx, center, size, colors, config);
    const padding = size * paddingScale + 40;

    if (canvasBatch) {
      await canvasBatch.run([center], padding, buildEffect);
    } else {
      await runSoloEffect(computeEffectBox([center], padding), buildEffect);
    }
  };
}

export const playThornPrick = createSpineRing(PRICK, 0.8);
export const playBriarCrush = createSpineRing(CRUSH, 0.95);
