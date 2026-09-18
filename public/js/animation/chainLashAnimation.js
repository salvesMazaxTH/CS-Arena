// ============================================================
//  Chain Lash Animation
//
//  Generic chain motif, opted into with `hitVfx: "chain_lash"`. A thin
//  dashed line snaps out and tightens into loops around the target.
//  No link is ever drawn: the chain reads from tension and glint.
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

const WINDUP_DURATION = 0.08;
const THROW_DURATION = 0.12;
const COIL_DURATION = 0.3;
const FADE_DURATION = 0.16;
const LIFETIME =
  WINDUP_DURATION + THROW_DURATION + COIL_DURATION + FADE_DURATION;

const CRACK_DURATION = 0.12;
const LOOP_COUNT = 3;
const LOOP_STAGGER = 0.05;
const LOOP_TIGHTEN = 0.18;

// Short dashes on the core pass only: the chain reads as articulated without
// any link being drawn.
const GLINT_DASH = [3, 9];
const GLINT_SPEED = 260;

const PADDING = 220;

export class ChainLashEffect {
  constructor(ctx, from, to, size, paletteKey) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.size = size;
    this.age = 0;
    this.cracked = false;
    this.sparks = [];

    this.colors = PALETTES[paletteKey];
    this.sprites = getSprites(paletteKey);
    this.particleScale = getParticleScale();

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const distance = Math.hypot(dx, dy) || 1;

    this.dirX = dx / distance;
    this.dirY = dy / distance;
    this.angle = Math.atan2(dy, dx);
    this.slackReach = Math.min(distance * 0.32, 150);
    this.bowSign = this.dirX >= 0 ? -1 : 1;

    this.loops = Array.from({ length: LOOP_COUNT }, (_, i) => ({
      offsetY: (i - (LOOP_COUNT - 1) / 2) * size * 0.2,
      tilt: (Math.random() - 0.5) * 0.36,
      delay: i * LOOP_STAGGER,
      radius: size * (0.46 - i * 0.04),
    }));
  }

  controlPoint(slack) {
    const reach = this.slackReach * slack * this.bowSign;

    return {
      x: (this.from.x + this.to.x) / 2 - this.dirY * reach,
      y: (this.from.y + this.to.y) / 2 + this.dirX * reach,
    };
  }

  drawLine(progress, slack, alpha) {
    if (progress <= 0.01) return null;

    const { ctx } = this;
    const control = this.controlPoint(slack);
    const steps = 14;
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * progress;
      const u = 1 - t;

      points.push({
        x: u * u * this.from.x + 2 * u * t * control.x + t * t * this.to.x,
        y: u * u * this.from.y + 2 * u * t * control.y + t * t * this.to.y,
      });
    }

    const head = points[points.length - 1];
    const { core, mid, deep } = this.colors;
    const gradient = ctx.createLinearGradient(
      this.from.x,
      this.from.y,
      head.x,
      head.y
    );

    gradient.addColorStop(0, `${deep}00`);
    gradient.addColorStop(0.55, `${mid}99`);
    gradient.addColorStop(1, core);

    ctx.strokeStyle = gradient;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const [width, layerAlpha, dashed] of [
      [6, 0.22, false],
      [2.2, 0.7, false],
      [1.1, 1, true],
    ]) {
      ctx.globalAlpha = layerAlpha * alpha;
      ctx.lineWidth = width;

      if (dashed) {
        ctx.setLineDash(GLINT_DASH);
        ctx.lineDashOffset = -this.age * GLINT_SPEED;
      }

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();

      if (dashed) ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;

    return head;
  }

  drawWindup(progress) {
    const { ctx } = this;
    const centerX = this.from.x - this.dirX * 18;
    const centerY = this.from.y - this.dirY * 18;
    const radius = 22;
    const start = this.angle + Math.PI * 0.35;
    const end = start + Math.PI * 1.3 * progress;

    ctx.globalAlpha = 0.25 + progress * 0.5;
    ctx.strokeStyle = this.colors.mid;
    ctx.lineCap = "round";
    ctx.lineWidth = 1.6;
    ctx.setLineDash(GLINT_DASH);
    ctx.lineDashOffset = -this.age * GLINT_SPEED;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, start, end);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    this.drawFlare(
      {
        x: centerX + Math.cos(end) * radius,
        y: centerY + Math.sin(end) * radius,
      },
      13,
      0.6
    );
  }

  drawLoops(elapsed, alpha) {
    const { ctx, to } = this;

    ctx.lineCap = "round";

    for (const loop of this.loops) {
      if (elapsed < loop.delay) continue;

      const progress = Math.min((elapsed - loop.delay) / LOOP_TIGHTEN, 1);
      const eased = 1 - (1 - progress) ** 3;
      const radiusX = loop.radius * (1.4 - 0.4 * eased);
      const radiusY = radiusX * 0.3;
      const y = to.y + loop.offsetY;

      ctx.globalAlpha = alpha * (0.3 + 0.35 * eased);
      ctx.strokeStyle = this.colors.deep;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.ellipse(to.x, y, radiusX, radiusY, loop.tilt, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = alpha * (0.45 + 0.55 * eased);
      ctx.strokeStyle = this.colors.core;
      ctx.lineWidth = 1.2;
      ctx.setLineDash(GLINT_DASH);
      ctx.lineDashOffset = -this.age * GLINT_SPEED;
      ctx.beginPath();
      ctx.ellipse(to.x, y, radiusX, radiusY, loop.tilt, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
  }

  drawFlare(at, size, alpha) {
    const { ctx } = this;

    for (const [sprite, scale, layerAlpha] of [
      [this.sprites[2], 1.9, 0.35],
      [this.sprites[0], 1, 0.95],
    ]) {
      const drawn = size * scale;

      ctx.globalAlpha = layerAlpha * alpha;
      ctx.drawImage(sprite, at.x - drawn / 2, at.y - drawn / 2, drawn, drawn);
    }

    ctx.globalAlpha = 1;
  }

  spawnSparks() {
    const count = Math.round(14 * this.particleScale);

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 2.1;
      const speed = 180 + Math.random() * 420;
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);

      this.sparks.push({
        x: this.to.x,
        y: this.to.y,
        vx: (-this.dirX * cos + this.dirY * sin) * speed,
        vy: (-this.dirX * sin - this.dirY * cos) * speed,
        life: 0.22 + Math.random() * 0.24,
        age: 0,
        size: 5 + Math.random() * 7,
        sprite: this.sprites[Math.random() < 0.55 ? 0 : 1],
      });
    }
  }

  drawSparks(dt) {
    const { ctx } = this;

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];

      spark.age += dt;
      if (spark.age >= spark.life) {
        this.sparks.splice(i, 1);
        continue;
      }

      spark.vx *= 1 - Math.min(dt * 4.5, 1);
      spark.vy = spark.vy * (1 - Math.min(dt * 4.5, 1)) + 620 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;

      const fade = 1 - spark.age / spark.life;
      const drawn = spark.size * fade;

      ctx.globalAlpha = fade;
      ctx.drawImage(
        spark.sprite,
        spark.x - drawn / 2,
        spark.y - drawn / 2,
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

    if (this.age < WINDUP_DURATION) {
      this.drawWindup(this.age / WINDUP_DURATION);
    } else {
      const thrown = this.age - WINDUP_DURATION;

      if (thrown < THROW_DURATION) {
        const progress = thrown / THROW_DURATION;
        const eased = 1 - (1 - progress) ** 2.2;
        const head = this.drawLine(eased, 1 - eased * 0.75, 1);

        if (head) this.drawFlare(head, 16 + 14 * progress, 1);
      } else {
        if (!this.cracked) {
          this.cracked = true;
          this.spawnSparks();
        }

        const settled = thrown - THROW_DURATION;
        const fade =
          settled <= COIL_DURATION
            ? 1
            : Math.max(0, 1 - (settled - COIL_DURATION) / FADE_DURATION);

        this.drawLine(1, 0.18, fade * 0.8);
        this.drawLoops(settled, fade);

        const crack = Math.max(0, 1 - settled / CRACK_DURATION);
        if (crack > 0) this.drawFlare(this.to, 30 + 26 * (1 - crack), crack);
      }
    }

    this.drawSparks(dt);

    ctx.globalCompositeOperation = "source-over";

    return this.age < LIFETIME;
  }
}

export async function playChainLash({
  userEl,
  targetEl,
  skill,
  hit,
  canvasBatch,
}) {
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
    new ChainLashEffect(ctx, start, target, size, paletteKey);

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
