// ============================================================
//  Water Bolt Animation
//
//  Generic projectile used by every non-contact water skill.
//  Same Canvas 2D budget as the fireball: pre-rendered glow sprites
//  blitted with additive compositing, no shadowBlur or per-particle
//  gradients. The impact throws droplets that keep splitting for a
//  few frames after the hit.
// ============================================================

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";

const SPRITE_SIZE = 64;

function makeGlowSprite(color) {
  const sprite = document.createElement("canvas");
  sprite.width = SPRITE_SIZE;
  sprite.height = SPRITE_SIZE;

  const ctx = sprite.getContext("2d");
  const r = SPRITE_SIZE / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, color);
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  return sprite;
}

// Foam crest → shallow water → deep water, in the order the spray settles.
const SPRITES = [
  makeGlowSprite("rgba(236,253,255,1)"),
  makeGlowSprite("rgba(146,226,255,1)"),
  makeGlowSprite("rgba(46,146,246,1)"),
  makeGlowSprite("rgba(18,74,168,1)"),
];

const TRAVEL_DURATION = 0.34;
const IMPACT_DURATION = 0.5;
const MAX_TRAIL = 110;
// Second burst of droplets, thrown a few frames after the splash itself.
const SPLIT_DELAY = 0.08;
const GRAVITY = 1500;

export class WaterBoltEffect {
  constructor(ctx, from, to) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.age = 0;
    this.trail = [];
    this.droplets = [];
    this.impacted = false;
    this.split = false;
    this.particleScale = getParticleScale();

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    this.angle = Math.atan2(dy, dx);

    // Control point of the travel arc: pushed sideways so the shot bends
    // instead of sliding along a flat line.
    const bow = Math.min(dist * 0.22, 140) * (from.y > to.y ? 1 : -1);
    this.ctrl = {
      x: (from.x + to.x) / 2 - (dy / dist) * bow,
      y: (from.y + to.y) / 2 + (dx / dist) * bow,
    };
    this.pos = { ...from };
  }

  // `power` shrinks the secondary burst so it reads as spray breaking off the
  // main splash rather than a second impact.
  spawnDroplets(power) {
    const count = Math.round(34 * power * this.particleScale);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = (140 + Math.random() * 480) * power;
      this.droplets.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(theta) * speed + Math.cos(this.angle) * 80,
        vy: Math.sin(theta) * speed + Math.sin(this.angle) * 80 - 160,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.65,
        size: (9 + Math.random() * 20) * power,
        sprite: SPRITES[i % 3],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    if (this.age < TRAVEL_DURATION) {
      const t = this.age / TRAVEL_DURATION;
      const u = 1 - t;
      this.pos.x =
        u * u * this.from.x + 2 * u * t * this.ctrl.x + t * t * this.to.x;
      this.pos.y =
        u * u * this.from.y + 2 * u * t * this.ctrl.y + t * t * this.to.y;

      const maxTrail = MAX_TRAIL * this.particleScale;
      const spawns = Math.min(
        Math.ceil(dt * 140 * this.particleScale),
        maxTrail - this.trail.length,
      );
      for (let i = 0; i < spawns; i++) {
        this.trail.push({
          x: this.pos.x + (Math.random() - 0.5) * 16,
          y: this.pos.y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 80,
          vy: (Math.random() - 0.5) * 80 + 40,
          life: 0.16 + Math.random() * 0.26,
          maxLife: 0.42,
          size: 14 + Math.random() * 24,
          sprite: SPRITES[1 + (i % 3)],
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.spawnDroplets(1);
    } else if (!this.split && this.age >= TRAVEL_DURATION + SPLIT_DELAY) {
      this.split = true;
      this.spawnDroplets(0.55);
    }

    ctx.globalCompositeOperation = "lighter";
    this.drawTrail(dt);
    if (!this.impacted) this.drawCore();
    else this.drawSplashRing();
    this.drawDroplets(dt);
    ctx.globalCompositeOperation = "source-over";

    return this.age < TRAVEL_DURATION + IMPACT_DURATION;
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
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const k = p.life / p.maxLife;
      const size = p.size * (0.3 + k * 0.7);
      ctx.globalAlpha = k * 0.6;
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Droplets fall under gravity and are stretched along their own velocity,
  // which is what sells them as water instead of sparks.
  drawDroplets(dt) {
    const { ctx } = this;
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const p = this.droplets[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.droplets.splice(i, 1);
        continue;
      }
      p.vx *= 0.98;
      p.vy = p.vy * 0.98 + GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const k = p.life / p.maxLife;
      const size = p.size * (0.4 + k * 0.6);
      const speed = Math.hypot(p.vx, p.vy);
      const stretch = 1 + Math.min(speed / 520, 1.6);

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.scale(stretch, 1 / stretch);
      ctx.globalAlpha = k * 0.9;
      ctx.drawImage(p.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawCore() {
    const { ctx, pos } = this;
    // Slight stretch along the flight direction sells the speed.
    const pulse = 1 + Math.sin(this.age * 38) * 0.06;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(this.angle);
    ctx.scale(1.3, 0.88);
    for (const [sprite, radius, alpha] of [
      [SPRITES[3], 76, 0.5],
      [SPRITES[2], 48, 0.8],
      [SPRITES[1], 26, 0.95],
      [SPRITES[0], 12, 1],
    ]) {
      const size = radius * pulse;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawSplashRing() {
    const { ctx, to } = this;
    const e = (this.age - TRAVEL_DURATION) / IMPACT_DURATION;
    const fade = 1 - e;

    const flash = 300 * (1 - e * e);
    ctx.globalAlpha = fade * 0.7;
    ctx.drawImage(SPRITES[2], to.x - flash / 2, to.y - flash / 2, flash, flash);

    // Two rings at different speeds read as the crown of a water splash.
    for (const [speed, width, color] of [
      [1, 12, "#bdefff"],
      [0.62, 6, "#5fc8ff"],
    ]) {
      const ring = 18 + 280 * Math.sqrt(e) * speed;
      ctx.globalAlpha = fade * fade;
      ctx.lineWidth = width * fade;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(to.x, to.y, ring, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Padding around the travel line big enough to hold the splash ring and
// droplets at their farthest reach.
const PADDING = 480;

export async function playWaterBolt({ userEl, targetEl, canvasBatch }) {
  if (!targetEl) return;

  const targetCenter = getElementCenter(targetEl);
  const start = userEl
    ? getElementCenter(userEl)
    : { x: targetCenter.x - 260, y: targetCenter.y - 160 };

  const buildEffect = (ctx) => new WaterBoltEffect(ctx, start, targetCenter);

  let hitFlashed = false;
  const onFrame = (effect) => {
    if (effect.impacted && !hitFlashed) {
      hitFlashed = true;
      targetEl.classList.add("water-hit");
      setTimeout(() => targetEl.classList.remove("water-hit"), 320);
    }
  };

  if (canvasBatch) {
    await canvasBatch.run([start, targetCenter], PADDING, buildEffect, onFrame);
  } else {
    await runSoloEffect(
      computeEffectBox([start, targetCenter], PADDING),
      buildEffect,
      onFrame,
    );
  }
}
