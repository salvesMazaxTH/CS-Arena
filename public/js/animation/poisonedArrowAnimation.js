// Poison-tipped crossbow bolt — Julian's motif, opted into with
// `hitVfx: "poisoned_arrow"`. Adapted from the plain arrow motif: one frozen
// venom palette, and beads of poison that shed off the shaft in flight.

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";

const SPRITE_SIZE = 48;
const HAZE_SIZE = 128;

// Sickly green with a pale acid core.
const VENOM = Object.freeze({ core: "#eaffce", mid: "#8fd94a", deep: "#356b1c" });

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

function makeHazeSprite() {
  const sprite = document.createElement("canvas");
  sprite.width = HAZE_SIZE;
  sprite.height = HAZE_SIZE;

  const ctx = sprite.getContext("2d");
  const r = HAZE_SIZE / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, `${VENOM.mid}66`);
  grad.addColorStop(1, `${VENOM.deep}00`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, HAZE_SIZE, HAZE_SIZE);

  return sprite;
}

let assetCache = null;

function getAssets() {
  if (!assetCache) {
    assetCache = {
      glows: [VENOM.core, VENOM.mid, VENOM.deep].map(makeGlowSprite),
      haze: makeHazeSprite(),
    };
  }
  return assetCache;
}

const DRAW_DURATION = 0.06;
const FLIGHT_DURATION = 0.26;
const IMPACT_DURATION = 0.44;
const LIFETIME = DRAW_DURATION + FLIGHT_DURATION + IMPACT_DURATION;

const HEAD_LEN = 11;
const HEAD_W = 5;
const SHAFT_LEN = 30;
const STREAK_SAMPLES = 9;
const DRIP_INTERVAL = 0.045;

export class PoisonedArrowEffect {
  constructor(ctx, from, to) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.age = 0;
    this.pos = { ...from };
    this.angle = 0;
    this.history = [];
    this.sparks = [];
    this.drips = [];
    this.dripClock = 0;
    this.impacted = false;
    this.colors = VENOM;

    const assets = getAssets();
    this.sprites = assets.glows;
    this.haze = assets.haze;
    this.particleScale = getParticleScale();

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Bow the path sideways so the bolt flies an arc, not a flat line.
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

  // Venom beads that fall away from the shaft mid-flight.
  spawnDrip() {
    const count = Math.max(1, Math.round(2 * this.particleScale));
    for (let i = 0; i < count; i++) {
      this.drips.push({
        x: this.pos.x + (Math.random() - 0.5) * 10,
        y: this.pos.y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 40,
        vy: 20 + Math.random() * 60,
        life: 0.32 + Math.random() * 0.4,
        maxLife: 0.72,
        size: 3 + Math.random() * 4,
        sprite: this.sprites[1 + (i % 2)],
      });
    }
  }

  spawnSparks() {
    const dirX = Math.cos(this.angle);
    const dirY = Math.sin(this.angle);
    const count = Math.round(16 * this.particleScale);

    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 2.6;
      const speed = 130 + Math.random() * 420;
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      this.sparks.push({
        x: this.to.x,
        y: this.to.y,
        vx: (dirX * cos - dirY * sin) * speed,
        vy: (dirX * sin + dirY * cos) * speed,
        life: 0.2 + Math.random() * 0.36,
        maxLife: 0.56,
        size: 5 + Math.random() * 12,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;
    const flightT = (this.age - DRAW_DURATION) / FLIGHT_DURATION;

    if (this.age < DRAW_DURATION) {
      this.drawReleaseGlint(this.age / DRAW_DURATION);
    } else if (flightT < 1) {
      // Ease-out over the final fifth so the bolt settles into the target.
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

      this.dripClock += dt;
      if (this.dripClock >= DRIP_INTERVAL) {
        this.dripClock = 0;
        this.spawnDrip();
      }

      ctx.globalCompositeOperation = "lighter";
      this.drawStreak();
      this.drawHeadFlare(1);
      ctx.globalCompositeOperation = "source-over";
      this.drawParticles(this.drips, dt, 0.94, 520);
      this.drawArrow(this.pos, this.angle, 1);
    } else {
      if (!this.impacted) {
        this.impacted = true;
        this.pos = { ...this.to };
        this.angle = this.sampleArc(1).angle;
        this.spawnSparks();
      }
      const e = (this.age - DRAW_DURATION - FLIGHT_DURATION) / IMPACT_DURATION;
      const fade = e < 0.55 ? 1 : Math.max(0, 1 - (e - 0.55) / 0.45);
      const quiver = Math.sin(e * 30) * 0.09 * Math.max(0, 1 - e * 1.6);

      ctx.globalCompositeOperation = "lighter";
      this.drawStreak(fade);
      this.drawToxicHaze(e);
      this.drawParticles(this.sparks, dt, 0.92, 560);
      this.drawParticles(this.drips, dt, 0.94, 620);
      this.drawImpactRing(e);
      this.drawHeadFlare(Math.max(0, 1 - e * 2.4));
      ctx.globalCompositeOperation = "source-over";
      if (fade > 0) this.drawArrow(this.pos, this.angle + quiver, fade);
    }

    return this.age < LIFETIME;
  }

  drawReleaseGlint(p) {
    const { ctx, from } = this;
    const size = 20 + p * 46;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = (1 - p) * 0.85;
    ctx.drawImage(
      this.sprites[0],
      from.x - size / 2,
      from.y - size / 2,
      size,
      size,
    );
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  drawStreak(alpha = 1) {
    const pts = this.history;
    if (pts.length < 3) return;
    const { ctx } = this;
    const n = pts.length;
    const maxHalf = 5;

    const top = [];
    const bottom = [];
    for (let i = 0; i < n; i++) {
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(n - 1, i + 1)];
      const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
      const nx = -(next.y - prev.y) / len;
      const ny = (next.x - prev.x) / len;
      const half = maxHalf * (i / (n - 1));
      top.push({ x: pts[i].x + nx * half, y: pts[i].y + ny * half });
      bottom.push({ x: pts[i].x - nx * half, y: pts[i].y - ny * half });
    }

    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(top[i].x, top[i].y);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(bottom[i].x, bottom[i].y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(
      pts[0].x,
      pts[0].y,
      pts[n - 1].x,
      pts[n - 1].y,
    );
    grad.addColorStop(0, `${this.colors.deep}00`);
    grad.addColorStop(0.65, `${this.colors.mid}80`);
    grad.addColorStop(1, this.colors.core);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawHeadFlare(alpha) {
    if (alpha <= 0) return;
    const { ctx, pos } = this;
    for (const [sprite, size, a] of [
      [this.sprites[2], 34, 0.4],
      [this.sprites[0], 16, 0.9],
    ]) {
      ctx.globalAlpha = a * alpha;
      ctx.drawImage(sprite, pos.x - size / 2, pos.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Local space: tip at the origin, shaft back along -x.
  drawArrow(pos, angle, alpha) {
    const { ctx } = this;
    const { core, mid } = this.colors;
    const nockX = -HEAD_LEN - SHAFT_LEN;

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(12,20,8,0.6)";
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(-HEAD_LEN, 0);
    ctx.lineTo(nockX, 0);
    ctx.stroke();

    ctx.strokeStyle = mid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-HEAD_LEN, 0);
    ctx.lineTo(nockX, 0);
    ctx.stroke();

    ctx.fillStyle = core;
    ctx.strokeStyle = "rgba(12,20,8,0.6)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-HEAD_LEN, -HEAD_W);
    ctx.lineTo(-HEAD_LEN, HEAD_W);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = mid;
    ctx.lineWidth = 2;
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

  // A soft cloud of green left where the bolt bites.
  drawToxicHaze(e) {
    if (e <= 0 || e >= 1) return;
    const { ctx, to } = this;
    const size = 20 + 120 * Math.sqrt(e);
    ctx.globalAlpha = (1 - e) * 0.5;
    ctx.drawImage(this.haze, to.x - size / 2, to.y - size / 2, size, size);
    ctx.globalAlpha = 1;
  }

  drawImpactRing(e) {
    if (e <= 0 || e >= 1) return;
    const { ctx, to } = this;
    const fade = 1 - e;
    const radius = 14 + 140 * Math.sqrt(e);
    ctx.globalAlpha = fade * fade;
    ctx.lineWidth = 8 * fade;
    ctx.strokeStyle = this.colors.deep;
    ctx.beginPath();
    ctx.arc(to.x, to.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

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
      const size = p.size * (0.3 + k * 0.7);
      ctx.globalAlpha = k;
      ctx.drawImage(p.sprite, p.x - size / 2, p.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
}

const PADDING = 220;

export async function playPoisonedArrow({ userEl, targetEl, canvasBatch }) {
  if (!targetEl) return;

  const targetCenter = getElementCenter(targetEl);
  const start = userEl
    ? getElementCenter(userEl)
    : { x: targetCenter.x - 260, y: targetCenter.y - 160 };

  const buildEffect = (ctx) => new PoisonedArrowEffect(ctx, start, targetCenter);

  let hitFlashed = false;
  const onFrame = (effect) => {
    if (effect.impacted && !hitFlashed) {
      hitFlashed = true;
      targetEl.classList.add("arrow-hit");
      setTimeout(() => targetEl.classList.remove("arrow-hit"), 300);
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
