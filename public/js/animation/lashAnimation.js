// ============================================================
//  Lash Animation
//
//  Generic whip motif, opted into with `hitVfx: "lash"`. A tapered line
//  loads back, a curvature wave runs down it to the tip, and the tip
//  cracks through the target and whips back. Nothing solid is drawn.
// ============================================================

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";

const SPRITE_SIZE = 48;

function makeGlowSprite(color) {
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;

  const ctx = canvas.getContext("2d");
  const half = SPRITE_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);

  gradient.addColorStop(0, color);
  gradient.addColorStop(0.4, `${color}66`);
  gradient.addColorStop(1, `${color}00`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  return canvas;
}

// Brighter than the identity palette: additive blending washes the muted
// badge tones out.
const PALETTES = Object.freeze({
  steel: { core: "#ffffff", mid: "#d6f0ff", deep: "#78beff" },
  fire: { core: "#fff6df", mid: "#ffb347", deep: "#ff4d12" },
  water: { core: "#f0feff", mid: "#7fd4ff", deep: "#2e92f6" },
  ice: { core: "#f4ffff", mid: "#b6f2ff", deep: "#56b2ce" },
  lightning: { core: "#fffce0", mid: "#ffe66b", deep: "#e0a915" },
  earth: { core: "#fff4e2", mid: "#d2a878", deep: "#8a5a2b" },
  violet: { core: "#fbf0ff", mid: "#c98bff", deep: "#7b2fd6" },
  crimson: { core: "#fff0f0", mid: "#ff6b6b", deep: "#b3121b" },
  azure: { core: "#f2ffff", mid: "#7df9ff", deep: "#12a7d6" },
});

const spriteCache = new Map();

function getSprites(paletteKey) {
  if (!spriteCache.has(paletteKey)) {
    const { core, mid, deep } = PALETTES[paletteKey];
    spriteCache.set(paletteKey, [
      makeGlowSprite(core),
      makeGlowSprite(mid),
      makeGlowSprite(deep),
    ]);
  }

  return spriteCache.get(paletteKey);
}

const LOAD_DURATION = 0.1;
const LASH_DURATION = 0.13;
const RECOIL_DURATION = 0.26;
const LIFETIME = LOAD_DURATION + LASH_DURATION + RECOIL_DURATION;

const CRACK_DURATION = 0.14;
const SEGMENTS = 18;
const GRAVITY = 700;
const PADDING = 220;

function lerpPoint(from, to, t) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export class LashEffect {
  constructor(ctx, from, to, size, paletteKey) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.age = 0;
    this.cracked = false;
    this.spray = [];

    this.colors = PALETTES[paletteKey];
    this.sprites = getSprites(paletteKey);
    this.particleScale = getParticleScale();

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;

    this.dirX = dx / distance;
    this.dirY = dy / distance;
    this.angle = Math.atan2(dy, dx);
    this.reach = Math.min(distance * 0.38, 170);
    this.ringReach = size * 0.58;

    // Forced upward on screen so the whip comes over the top from either side.
    const flip = this.dirX >= 0 ? 1 : -1;
    this.perpX = this.dirY * flip;
    this.perpY = -this.dirX * flip;

    this.overshoot = {
      x: to.x + this.dirX * size * 0.26,
      y: to.y + this.dirY * size * 0.26,
    };

    this.cocked = {
      x: from.x - this.dirX * this.reach * 0.7 + this.perpX * this.reach * 0.5,
      y: from.y - this.dirY * this.reach * 0.7 + this.perpY * this.reach * 0.5,
    };

    this.rest = {
      x: from.x - this.dirX * this.reach * 0.4 + this.perpX * this.reach * 0.2,
      y: from.y - this.dirY * this.reach * 0.4 + this.perpY * this.reach * 0.2,
    };
  }

  whipPoints(tip, amplitude, waveExponent) {
    const points = [];

    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const lateral = amplitude * Math.sin(Math.PI * s ** waveExponent);

      points.push({
        x: this.from.x + (tip.x - this.from.x) * s + this.perpX * lateral,
        y: this.from.y + (tip.y - this.from.y) * s + this.perpY * lateral,
      });
    }

    return points;
  }

  drawWhip(points, alpha) {
    const { ctx } = this;
    const tip = points[points.length - 1];
    const { core, mid, deep } = this.colors;
    const gradient = ctx.createLinearGradient(
      this.from.x,
      this.from.y,
      tip.x,
      tip.y
    );

    gradient.addColorStop(0, `${deep}00`);
    gradient.addColorStop(0.35, mid);
    gradient.addColorStop(1, core);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.globalAlpha = 0.16 * alpha;
    ctx.strokeStyle = deep;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    ctx.strokeStyle = gradient;

    for (const [gripWidth, tipWidth, layerAlpha] of [
      [3.8, 0.5, 0.75],
      [1.5, 0.2, 1],
    ]) {
      ctx.globalAlpha = layerAlpha * alpha;

      for (let i = 1; i < points.length; i++) {
        ctx.lineWidth =
          gripWidth + (tipWidth - gripWidth) * ((i - 0.5) / SEGMENTS);
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  drawCrack(progress) {
    const { ctx, to } = this;

    ctx.lineCap = "round";

    for (const [delay, scale] of [
      [0, 1],
      [0.3, 0.55],
    ]) {
      if (progress < delay) continue;

      const ringProgress = Math.min((progress - delay) / (1 - delay), 1);
      const eased = 1 - (1 - ringProgress) ** 2.4;
      const radius = 10 + this.ringReach * scale * eased;

      ctx.globalAlpha = (1 - ringProgress) * 0.7;
      ctx.strokeStyle = this.colors.mid;
      ctx.lineWidth = 2.6 * (1 - ringProgress) + 0.4;
      ctx.beginPath();
      ctx.ellipse(to.x, to.y, radius * 0.34, radius, this.angle, 0, Math.PI * 2);
      ctx.stroke();
    }

    const snap = Math.max(0, 1 - progress * 3);
    if (snap > 0) {
      ctx.globalAlpha = snap;
      ctx.strokeStyle = this.colors.core;
      ctx.lineWidth = 2.2 * snap;
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      ctx.lineTo(this.overshoot.x, this.overshoot.y);
      ctx.stroke();

      const flash = 34 * snap;
      ctx.globalAlpha = snap * 0.9;
      ctx.drawImage(
        this.sprites[0],
        to.x - flash / 2,
        to.y - flash / 2,
        flash,
        flash
      );
    }

    ctx.globalAlpha = 1;
  }

  spawnSpray() {
    const count = Math.round(16 * this.particleScale);

    for (let i = 0; i < count; i++) {
      const lateral = (Math.random() - 0.5) * 2;
      const forward = 0.35 + Math.random() * 0.8;
      const speed = 220 + Math.random() * 380;

      this.spray.push({
        x: this.to.x,
        y: this.to.y,
        vx: (this.dirX * forward + this.perpX * lateral) * speed,
        vy: (this.dirY * forward + this.perpY * lateral) * speed,
        life: 0.2 + Math.random() * 0.26,
        age: 0,
        size: 4 + Math.random() * 7,
        sprite: this.sprites[Math.random() < 0.6 ? 0 : 1],
      });
    }
  }

  drawSpray(dt) {
    const { ctx } = this;

    for (let i = this.spray.length - 1; i >= 0; i--) {
      const drop = this.spray[i];

      drop.age += dt;
      if (drop.age >= drop.life) {
        this.spray.splice(i, 1);
        continue;
      }

      const drag = 1 - Math.min(dt * 4, 1);

      drop.vx *= drag;
      drop.vy = drop.vy * drag + GRAVITY * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;

      const fade = 1 - drop.age / drop.life;
      const drawn = drop.size * fade;

      ctx.globalAlpha = fade;
      ctx.drawImage(
        drop.sprite,
        drop.x - drawn / 2,
        drop.y - drawn / 2,
        drawn,
        drawn
      );
    }

    ctx.globalAlpha = 1;
  }

  step(dt) {
    this.age += dt;

    const { ctx } = this;
    ctx.globalCompositeOperation = "lighter";

    if (this.age < LOAD_DURATION) {
      const progress = this.age / LOAD_DURATION;
      const eased = 1 - (1 - progress) ** 2;

      this.drawWhip(
        this.whipPoints(
          lerpPoint(this.from, this.cocked, eased),
          this.reach * 0.22 * eased,
          1.5
        ),
        0.3 + 0.5 * progress
      );
    } else if (this.age < LOAD_DURATION + LASH_DURATION) {
      const progress = (this.age - LOAD_DURATION) / LASH_DURATION;

      this.drawWhip(
        this.whipPoints(
          lerpPoint(this.cocked, this.overshoot, progress ** 2.2),
          this.reach * 0.45 * (1 - progress) ** 1.5,
          0.6 + 2.6 * progress
        ),
        1
      );
    } else {
      if (!this.cracked) {
        this.cracked = true;
        this.spawnSpray();
      }

      const elapsed = this.age - LOAD_DURATION - LASH_DURATION;
      const progress = Math.min(elapsed / RECOIL_DURATION, 1);
      const fade = (1 - progress) ** 1.4;

      this.drawWhip(
        this.whipPoints(
          lerpPoint(this.overshoot, this.rest, progress ** 0.7),
          this.reach * 0.3 * (1 - progress) * Math.sin(progress * Math.PI * 2.4),
          1.6
        ),
        fade * 0.9
      );

      if (elapsed < CRACK_DURATION) this.drawCrack(elapsed / CRACK_DURATION);
    }

    this.drawSpray(dt);

    ctx.globalCompositeOperation = "source-over";

    return this.age < LIFETIME;
  }
}

export async function playLash({ userEl, targetEl, skill, hit, canvasBatch }) {
  if (!targetEl) return;

  const requested =
    hit?.hitVfxPalette || skill?.hitVfxPalette || hit?.element || skill?.element;
  const paletteKey = requested in PALETTES ? requested : "steel";

  const rect = targetEl.getBoundingClientRect();
  const target = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const size = Math.max(rect.width, rect.height);
  const start = userEl
    ? getElementCenter(userEl)
    : { x: target.x - 280, y: target.y - 60 };

  const buildEffect = (ctx) =>
    new LashEffect(ctx, start, target, size, paletteKey);

  let flashed = false;
  const onFrame = (effect) => {
    if (!effect.cracked || flashed) return;

    flashed = true;
    targetEl.classList.add("slash-hit");
    setTimeout(() => targetEl.classList.remove("slash-hit"), 380);
  };

  if (canvasBatch) {
    await canvasBatch.run([start, target], PADDING, buildEffect, onFrame);
  } else {
    await runSoloEffect(
      computeEffectBox([start, target], PADDING),
      buildEffect,
      onFrame
    );
  }
}
