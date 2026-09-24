// ============================================================
//  Ember Flick Animation
//
//  A deliberately poor fire motif, opted into with
//  `hitVfx: "ember_flick"`. One ember is flicked off the blade and
//  cannot be bothered to fly straight: it sags across the gap,
//  shedding sparks it never had the energy to hold, and gutters out
//  on the target as a small flame rather than an impact. Everything
//  here is sized and timed to read as the least possible effort.
// ============================================================

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";

const SPRITE_SIZE = 48;

function makeGlowSprite(color) {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;

  const ctx = sprite.getContext("2d");
  const r = SPRITE_SIZE / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(0.4, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  return sprite;
}

// Dimmer than the other fire motifs on purpose: this one is an ember, not a
// bolt, so the core never reaches white.
const COLORS = Object.freeze({
  core: "#ffe9b0",
  mid: "#ff9c3d",
  deep: "#c93a08",
});

let sprites = null;

function getSprites() {
  sprites ??= [COLORS.core, COLORS.mid, COLORS.deep].map(makeGlowSprite);
  return sprites;
}

// Slow on the way over, then a short guttering instead of a burst.
const TRAVEL_DURATION = 0.52;
const GUTTER_DURATION = 0.46;
const LIFETIME = TRAVEL_DURATION + GUTTER_DURATION;

// How far the ember's path sags below the straight line, as a fraction of the
// distance it has to cross. A committed projectile would not sag at all.
const SAG_RATIO = 0.22;

const PADDING = 180;

export class EmberFlickEffect {
  constructor(ctx, from, to) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.age = 0;
    this.trail = [];
    this.flames = [];
    this.guttering = false;
    this.sprites = getSprites();
    this.particleScale = getParticleScale();

    const distance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    this.sag = distance * SAG_RATIO;
  }

  // Quadratic sag: the control point sits below the midpoint, so the ember
  // rises barely at all and falls into the target.
  pointAt(t) {
    const ctrlX = (this.from.x + this.to.x) / 2;
    const ctrlY = (this.from.y + this.to.y) / 2 + this.sag;
    const inv = 1 - t;
    return {
      x: inv * inv * this.from.x + 2 * inv * t * ctrlX + t * t * this.to.x,
      y: inv * inv * this.from.y + 2 * inv * t * ctrlY + t * t * this.to.y,
    };
  }

  shedSpark(at) {
    if (Math.random() > 0.55 * this.particleScale) return;

    this.trail.push({
      x: at.x,
      y: at.y,
      vx: (Math.random() - 0.5) * 70,
      vy: 40 + Math.random() * 90,
      life: 0.18 + Math.random() * 0.3,
      maxLife: 0.48,
      size: 4 + Math.random() * 6,
      sprite: this.sprites[1 + (Math.random() < 0.5 ? 0 : 1)],
    });
  }

  spawnFlames() {
    const count = Math.max(2, Math.round(5 * this.particleScale));

    for (let i = 0; i < count; i++) {
      this.flames.push({
        x: this.to.x + (Math.random() - 0.5) * 34,
        y: this.to.y + (Math.random() - 0.5) * 22,
        rise: 30 + Math.random() * 45,
        delay: Math.random() * 0.14,
        life: 0.22 + Math.random() * 0.22,
        maxLife: 0.44,
        size: 12 + Math.random() * 16,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    ctx.globalCompositeOperation = "lighter";

    if (this.age < TRAVEL_DURATION) {
      // Ease-out: the flick has all its speed at the wrist and none after.
      const t = 1 - Math.pow(1 - this.age / TRAVEL_DURATION, 2);
      const at = this.pointAt(t);
      this.shedSpark(at);

      const flicker = 0.7 + Math.random() * 0.3;
      const size = 16 * flicker;
      ctx.globalAlpha = flicker;
      ctx.drawImage(
        this.sprites[0],
        at.x - size / 2,
        at.y - size / 2,
        size,
        size,
      );
      ctx.globalAlpha = 1;
    } else if (!this.guttering) {
      this.guttering = true;
      this.spawnFlames();
    }

    this.drawTrail(dt);
    this.drawFlames(dt);
    ctx.globalCompositeOperation = "source-over";

    return this.age < LIFETIME;
  }

  drawTrail(dt) {
    const { ctx } = this;

    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.trail.splice(i, 1);
        continue;
      }
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const k = p.life / p.maxLife;
      const size = p.size * (0.3 + k * 0.7);
      ctx.globalAlpha = k * 0.8;
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }

    ctx.globalAlpha = 1;
  }

  drawFlames(dt) {
    const { ctx } = this;

    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i];
      if (f.delay > 0) {
        f.delay -= dt;
        continue;
      }

      f.life -= dt;
      if (f.life <= 0) {
        this.flames.splice(i, 1);
        continue;
      }

      const k = f.life / f.maxLife;
      const climbed = (1 - k) * f.rise;
      // Wide at the base, pinched at the top, like something burning out.
      const size = f.size * (0.4 + k * 0.6);
      ctx.globalAlpha = k * 0.9;
      ctx.drawImage(
        f.sprite,
        f.x - size / 2,
        f.y - climbed - size / 2,
        size,
        size * 1.4,
      );
    }

    ctx.globalAlpha = 1;
  }
}

export async function playEmberFlick({
  userEl,
  targetEl,
  canvasBatch,
}) {
  if (!targetEl) return;

  const to = getElementCenter(targetEl);
  const from = userEl ? getElementCenter(userEl) : { x: to.x, y: to.y - 200 };

  const buildEffect = (ctx) => new EmberFlickEffect(ctx, from, to);

  if (canvasBatch) {
    await canvasBatch.run([from, to], PADDING, buildEffect);
  } else {
    await runSoloEffect(computeEffectBox([from, to], PADDING), buildEffect);
  }
}
