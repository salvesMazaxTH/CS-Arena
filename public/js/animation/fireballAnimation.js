// ============================================================
//  Fireball Animation
//
//  Generic projectile used by every non-contact fire skill.
//  Canvas 2D only: all glows are pre-rendered sprites blitted with
//  additive compositing, which keeps the cost far below per-particle
//  gradients or shadowBlur.
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

// Core → ember → soot, in the order the flame cools down.
const SPRITES = [
  makeGlowSprite("rgba(255,248,224,1)"),
  makeGlowSprite("rgba(255,196,64,1)"),
  makeGlowSprite("rgba(255,92,16,1)"),
  makeGlowSprite("rgba(150,26,4,1)"),
];

const TRAVEL_DURATION = 0.34;
const IMPACT_DURATION = 0.46;
const MAX_TRAIL = 110;

export class FireballEffect {
  // `scale` multiplies every visual radius; particle counts stay fixed so the
  // bigger variant costs the same to render.
  constructor(ctx, from, to, scale = 1) {
    this.ctx = ctx;
    this.scale = scale;
    this.from = from;
    this.to = to;
    this.age = 0;
    this.trail = [];
    this.embers = [];
    this.impacted = false;
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

  spawnEmbers() {
    const count = Math.round(38 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 520;
      this.embers.push({
        x: this.to.x,
        y: this.to.y,
        vx: (Math.cos(theta) * speed + Math.cos(this.angle) * 90) * this.scale,
        vy: (Math.sin(theta) * speed + Math.sin(this.angle) * 90) * this.scale,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.6,
        size: (10 + Math.random() * 26) * this.scale,
        sprite: SPRITES[1 + (i % 3)],
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
          x: this.pos.x + (Math.random() - 0.5) * 18 * this.scale,
          y: this.pos.y + (Math.random() - 0.5) * 18 * this.scale,
          vx: (Math.random() - 0.5) * 90 * this.scale,
          vy: ((Math.random() - 0.5) * 90 - 60) * this.scale,
          life: 0.18 + Math.random() * 0.28,
          maxLife: 0.46,
          size: (16 + Math.random() * 26) * this.scale,
          sprite: SPRITES[1 + (i % 3)],
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.spawnEmbers();
    }

    ctx.globalCompositeOperation = "lighter";
    this.drawParticles(this.trail, dt, 0.92, 0);
    this.drawParticles(this.embers, dt, 0.965, 900);
    if (!this.impacted) this.drawCore();
    else this.drawShockwave();
    ctx.globalCompositeOperation = "source-over";

    return this.age < TRAVEL_DURATION + IMPACT_DURATION;
  }

  // Shared particle integrator: drag slows them down, gravity only pulls
  // the impact embers.
  drawParticles(list, dt, drag, gravity) {
    const { ctx } = this;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.vx *= drag;
      p.vy = p.vy * drag + gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const k = p.life / p.maxLife;
      const size = p.size * (0.35 + k * 0.65);
      ctx.globalAlpha = k * 0.75;
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  drawCore() {
    const { ctx, pos } = this;
    // Slight stretch along the flight direction sells the speed.
    const pulse = 1 + Math.sin(this.age * 42) * 0.07;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(this.angle);
    ctx.scale(1.35, 0.85);
    for (const [sprite, radius, alpha] of [
      [SPRITES[2], 78, 0.55],
      [SPRITES[1], 46, 0.85],
      [SPRITES[0], 22, 1],
    ]) {
      const size = radius * pulse * this.scale;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawShockwave() {
    const { ctx, to } = this;
    const e = (this.age - TRAVEL_DURATION) / IMPACT_DURATION;
    const fade = 1 - e;

    const flash = 340 * (1 - e * e) * this.scale;
    ctx.globalAlpha = fade * 0.8;
    ctx.drawImage(SPRITES[2], to.x - flash / 2, to.y - flash / 2, flash, flash);

    const ring = (20 + 300 * Math.sqrt(e)) * this.scale;
    ctx.globalAlpha = fade * fade;
    ctx.lineWidth = 14 * fade * this.scale;
    ctx.strokeStyle = "#ffb347";
    ctx.beginPath();
    ctx.arc(to.x, to.y, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Padding around the travel line big enough to hold the impact shockwave and
// embers at their farthest reach; both grow with `scale` so the big variant
// still fits.
const PADDING = 360;

// `scale` is baked in at registration time: 1 for regular fire skills,
// 1.85 for ultimates and the BIG_FIREBALL_SKILLS exceptions.
export function createFireballAnimation(scale) {
  const padding = PADDING * scale;

  return async ({ userEl, targetEl, canvasBatch }) => {
    if (!targetEl) return;

    const targetCenter = getElementCenter(targetEl);
    const start = userEl
      ? getElementCenter(userEl)
      : { x: targetCenter.x - 260, y: targetCenter.y - 160 };

    const buildEffect = (ctx) =>
      new FireballEffect(ctx, start, targetCenter, scale);

    let hitFlashed = false;
    const onFrame = (effect) => {
      if (effect.impacted && !hitFlashed) {
        hitFlashed = true;
        targetEl.classList.add("fire-hit");
        setTimeout(() => targetEl.classList.remove("fire-hit"), 320);
      }
    };

    if (canvasBatch) {
      await canvasBatch.run([start, targetCenter], padding, buildEffect, onFrame);
    } else {
      await runSoloEffect(
        computeEffectBox([start, targetCenter], padding),
        buildEffect,
        onFrame,
      );
    }
  };
}
