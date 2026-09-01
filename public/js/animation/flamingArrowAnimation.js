// Fire upgrade of the plain arrow, opted into with `hitVfx: "flaming_arrow"`.
// Same Canvas 2D budget as fireballAnimation.js: every glow is a pre-rendered
// sprite blitted additively, spawn counts scale with getParticleScale() and
// every pool is capped.

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

// White-hot core, ember, flame, soot.
const SPRITES = [
  makeGlowSprite("rgba(255,249,228,1)"),
  makeGlowSprite("rgba(255,201,92,1)"),
  makeGlowSprite("rgba(255,102,22,1)"),
  makeGlowSprite("rgba(147,32,8,1)"),
];

const DRAW_DURATION = 0.06;
const FLIGHT_DURATION = 0.26;
const IMPACT_DURATION = 0.5;
const LIFETIME = DRAW_DURATION + FLIGHT_DURATION + IMPACT_DURATION;

const HEAD_LEN = 13;
const HEAD_W = 5.5;
const SHAFT_LEN = 30;
const STREAK_SAMPLES = 9;

const MAX_TRAIL = 44;
const MAX_EMBERS = 30;

export class FlamingArrowEffect {
  constructor(ctx, from, to) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.age = 0;
    this.pos = { ...from };
    this.angle = 0;
    this.history = [];
    this.trail = [];
    this.embers = [];
    this.burst = [];
    this.impacted = false;
    this.particleScale = getParticleScale();

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Bow the path sideways so the arrow flies an arc, not a flat line.
    const bow = Math.min(dist * 0.2, 120) * (from.y > to.y ? 1 : -1);
    this.ctrl = {
      x: (from.x + to.x) / 2 - (dy / dist) * bow,
      y: (from.y + to.y) / 2 + (dx / dist) * bow,
    };
  }

  sampleArc(t) {
    const u = 1 - t;
    const { from, ctrl, to } = this;
    const x = u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x;
    const y = u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y;
    const dxdt = 2 * u * (ctrl.x - from.x) + 2 * t * (to.x - ctrl.x);
    const dydt = 2 * u * (ctrl.y - from.y) + 2 * t * (to.y - ctrl.y);
    return { x, y, angle: Math.atan2(dydt, dxdt) };
  }

  flicker() {
    return 0.76 + 0.26 * Math.sin(this.age * 47) + 0.13 * (Math.random() - 0.5);
  }

  spawnTrail(dt) {
    const room = MAX_TRAIL - this.trail.length;
    const count = Math.min(Math.ceil(dt * 270 * this.particleScale), room);
    for (let i = 0; i < count; i++) {
      this.trail.push({
        x: this.pos.x + (Math.random() - 0.5) * 14,
        y: this.pos.y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 80 - Math.cos(this.angle) * 50,
        vy: (Math.random() - 0.5) * 80 - Math.sin(this.angle) * 50 - 55,
        life: 0.24 + Math.random() * 0.32,
        maxLife: 0.56,
        size: 24 + Math.random() * 34,
        sprite: SPRITES[1 + (i % 3)],
      });
    }
  }

  spawnEmbers(dt) {
    const room = MAX_EMBERS - this.embers.length;
    const count = Math.min(Math.ceil(dt * 130 * this.particleScale), room);
    for (let i = 0; i < count; i++) {
      this.embers.push({
        x: this.pos.x,
        y: this.pos.y,
        vx: (Math.random() - 0.5) * 160,
        vy: -75 - Math.random() * 180,
        life: 0.28 + Math.random() * 0.38,
        maxLife: 0.66,
        size: 6 + Math.random() * 10,
        sprite: SPRITES[i % 2],
      });
    }
  }

  spawnBurst() {
    const count = Math.round(28 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 500;
      this.burst.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(theta) * speed + Math.cos(this.angle) * 90,
        vy: Math.sin(theta) * speed + Math.sin(this.angle) * 90,
        life: 0.26 + Math.random() * 0.36,
        maxLife: 0.62,
        size: 16 + Math.random() * 34,
        sprite: SPRITES[1 + (i % 3)],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;
    const flightT = (this.age - DRAW_DURATION) / FLIGHT_DURATION;

    if (this.age < DRAW_DURATION) {
      const p = this.age / DRAW_DURATION;
      const sz = 26 + p * 70;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.drawImage(SPRITES[1], this.from.x - sz / 2, this.from.y - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      return true;
    }

    if (flightT < 1) {
      const eased =
        flightT < 0.8
          ? flightT
          : 0.8 + (1 - (1 - (flightT - 0.8) / 0.2) ** 2) * 0.2;
      const s = this.sampleArc(eased);
      this.pos.x = s.x;
      this.pos.y = s.y;
      this.angle = s.angle;

      this.history.push({ x: s.x, y: s.y });
      if (this.history.length > STREAK_SAMPLES) this.history.shift();
      this.spawnTrail(dt);
      this.spawnEmbers(dt);

      this.drawArrow(this.pos, this.angle, 1);
      ctx.globalCompositeOperation = "lighter";
      this.drawRibbon(1);
      this.integrate(this.trail, dt, 0.9, -130, 0.62);
      this.integrate(this.embers, dt, 0.92, 250, 1);
      this.drawFire(this.pos, this.angle, 1);
      ctx.globalCompositeOperation = "source-over";
      return true;
    }

    if (!this.impacted) {
      this.impacted = true;
      this.pos = { ...this.to };
      this.angle = this.sampleArc(1).angle;
      this.spawnBurst();
    }

    const e = (this.age - DRAW_DURATION - FLIGHT_DURATION) / IMPACT_DURATION;
    const fade = e < 0.5 ? 1 : Math.max(0, 1 - (e - 0.5) / 0.5);
    const quiver = Math.sin(e * 30) * 0.08 * Math.max(0, 1 - e * 1.7);

    if (fade > 0) this.drawArrow(this.pos, this.angle + quiver, fade);
    ctx.globalCompositeOperation = "lighter";
    this.drawRibbon(fade);
    this.integrate(this.trail, dt, 0.9, -130, 0.62);
    this.integrate(this.embers, dt, 0.92, 250, 1);
    this.integrate(this.burst, dt, 0.9, 520, 0.7);
    this.drawFireRing(e);
    this.drawFire(this.to, this.angle, Math.max(0, 1 - e * 1.7));
    ctx.globalCompositeOperation = "source-over";

    return this.age < LIFETIME;
  }

  drawRibbon(alpha) {
    const pts = this.history;
    if (pts.length < 3) return;
    const { ctx } = this;
    const n = pts.length;

    for (const [maxHalf, a] of [
      [12, 0.34],
      [5.5, 0.92],
    ]) {
      ctx.beginPath();
      for (let pass = 0; pass < 2; pass++) {
        for (let k = 0; k < n; k++) {
          const i = pass === 0 ? k : n - 1 - k;
          const prev = pts[Math.max(0, i - 1)];
          const next = pts[Math.min(n - 1, i + 1)];
          const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
          const side = pass === 0 ? 1 : -1;
          const px = pts[i].x + (-(next.y - prev.y) / len) * side * maxHalf * (i / (n - 1));
          const py = pts[i].y + ((next.x - prev.x) / len) * side * maxHalf * (i / (n - 1));
          if (pass === 0 && k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(
        pts[0].x,
        pts[0].y,
        pts[n - 1].x,
        pts[n - 1].y,
      );
      grad.addColorStop(0, "rgba(255,58,10,0)");
      grad.addColorStop(0.5, "rgba(255,140,40,0.62)");
      grad.addColorStop(1, "rgba(255,244,214,1)");
      ctx.globalAlpha = alpha * a;
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Additive fire wrapping the shaft plus the roaring plume off the head.
  drawFire(pos, angle, alpha) {
    if (alpha <= 0) return;
    const { ctx } = this;
    const f = this.flicker();
    const nockX = -HEAD_LEN - SHAFT_LEN;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.drawImage(SPRITES[2], nockX - 12, -22 * f, SHAFT_LEN + HEAD_LEN + 24, 44 * f);
    ctx.drawImage(SPRITES[1], nockX - 2, -12 * f, SHAFT_LEN + 8, 24 * f);
    ctx.restore();

    const bx = pos.x - Math.cos(angle) * 6;
    const by = pos.y - Math.sin(angle) * 6 - 6;
    for (const [sprite, size, a] of [
      [SPRITES[3], 74, 0.34],
      [SPRITES[2], 50, 0.6],
      [SPRITES[1], 28, 0.9],
      [SPRITES[0], 13, 1],
    ]) {
      const s = size * f;
      ctx.globalAlpha = a * alpha;
      ctx.drawImage(sprite, bx - s / 2, by - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // Local space: tip at the origin, shaft back along -x.
  drawArrow(pos, angle, alpha) {
    const { ctx } = this;
    const nockX = -HEAD_LEN - SHAFT_LEN;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(30,12,6,0.5)";
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    ctx.moveTo(-HEAD_LEN, 0);
    ctx.lineTo(nockX, 0);
    ctx.stroke();

    ctx.strokeStyle = "#ffe0ad";
    ctx.lineWidth = 2.1;
    ctx.beginPath();
    ctx.moveTo(-HEAD_LEN, 0);
    ctx.lineTo(nockX, 0);
    ctx.stroke();

    ctx.fillStyle = "#fff6e2";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-HEAD_LEN, -HEAD_W);
    ctx.lineTo(-HEAD_LEN, HEAD_W);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ff9a2e";
    ctx.lineWidth = 1.8;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(nockX, 0);
      ctx.lineTo(nockX + 9, side * 6);
      ctx.moveTo(nockX + 4, 0);
      ctx.lineTo(nockX + 13, side * 6);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  drawFireRing(e) {
    if (e <= 0 || e >= 1) return;
    const { ctx, to } = this;
    const fade = 1 - e;
    for (const [mul, width, color] of [
      [1, 12, "#ffd693"],
      [0.6, 5, "#ff5a14"],
    ]) {
      const radius = (16 + 210 * Math.sqrt(e)) * mul;
      ctx.globalAlpha = fade * fade;
      ctx.lineWidth = width * fade;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  integrate(list, dt, drag, gravity, shrink) {
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
      const size = p.size * (1 - shrink + k * shrink);
      ctx.globalAlpha = k * 0.9;
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
}

const PADDING = 300;

export async function playFlamingArrow({ userEl, targetEl, canvasBatch }) {
  if (!targetEl) return;

  const targetCenter = getElementCenter(targetEl);
  const start = userEl
    ? getElementCenter(userEl)
    : { x: targetCenter.x - 260, y: targetCenter.y - 160 };

  const buildEffect = (ctx) => new FlamingArrowEffect(ctx, start, targetCenter);

  let hitFlashed = false;
  const onFrame = (effect) => {
    if (effect.impacted && !hitFlashed) {
      hitFlashed = true;
      targetEl.classList.add("fire-hit");
      setTimeout(() => targetEl.classList.remove("fire-hit"), 320);
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
