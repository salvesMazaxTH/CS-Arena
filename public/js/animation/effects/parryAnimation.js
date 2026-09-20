// A blade caught on a blade: the gleam runs up the parrying edge, holds, then
// throws sparks off the crossing point. 2D canvas over the defender only.

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";

const SPRITE_SIZE = 48;
const PALETTE = Object.freeze({
  core: "#ffffff",
  mid: "#dceaff",
  deep: "#7fa8d8",
});

// The catch is late on purpose: the incoming blow has to read as having
// arrived before the guard answers it.
const CATCH_DELAY = 0.16;
const GLEAM_DURATION = 0.22;
const HOLD_DURATION = 0.1;
const FADE_DURATION = 0.3;

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

let sprites = null;
function getSprites() {
  sprites ??= [PALETTE.core, PALETTE.mid, PALETTE.deep].map(makeGlowSprite);
  return sprites;
}

class ParryEffect {
  constructor(ctx, center, size, incomingAngle) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.sparks = [];
    this.sparked = false;
    this.particleScale = getParticleScale();
    this.sprites = getSprites();

    // The guard sits across the line the blow came in on.
    this.angle = incomingAngle + Math.PI / 2;
    this.length = size * 0.95;
    this.width = Math.max(2.5, size * 0.022);

    this.lifetime =
      CATCH_DELAY + GLEAM_DURATION + HOLD_DURATION + FADE_DURATION;
  }

  edgePoint(u) {
    return {
      x: this.center.x + Math.cos(this.angle) * u * this.length,
      y: this.center.y + Math.sin(this.angle) * u * this.length,
    };
  }

  spawnSparks() {
    const count = Math.round(14 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const dir = this.angle + Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 260 + Math.random() * 620;
      this.sparks.push({
        x: this.center.x + (Math.random() - 0.5) * this.size * 0.12,
        y: this.center.y + (Math.random() - 0.5) * this.size * 0.12,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0.16 + Math.random() * 0.3,
        maxLife: 0.46,
        size: 4 + Math.random() * 9,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;
    const t = this.age - CATCH_DELAY;

    ctx.globalCompositeOperation = "lighter";

    if (t >= 0) {
      if (t < GLEAM_DURATION) {
        this.drawGleam(t / GLEAM_DURATION);
      } else {
        if (!this.sparked) {
          this.sparked = true;
          this.spawnSparks();
          this.drawFlash(0);
        }
        const after = t - GLEAM_DURATION;
        if (after < HOLD_DURATION) this.drawEdge(1);
        else
          this.drawEdge(
            Math.max(0, 1 - (after - HOLD_DURATION) / FADE_DURATION),
          );
        this.drawFlash(Math.max(0, 1 - after / (HOLD_DURATION + FADE_DURATION)));
      }
      this.drawSparks(dt);
    }

    ctx.globalCompositeOperation = "source-over";
    return this.age < this.lifetime;
  }

  // The light runs along the edge before the whole blade is lit.
  drawGleam(p) {
    const { ctx } = this;
    const head = -1 + p * 2.3;
    const from = this.edgePoint(Math.max(-1, head - 0.55));
    const to = this.edgePoint(Math.min(1, head));

    const grad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
    grad.addColorStop(0, `${PALETTE.deep}00`);
    grad.addColorStop(0.7, `${PALETTE.mid}b0`);
    grad.addColorStop(1, PALETTE.core);

    ctx.lineCap = "round";
    ctx.strokeStyle = grad;
    for (const [mult, alpha] of [
      [3.2, 0.28],
      [1, 0.95],
    ]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = this.width * mult;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawEdge(fade) {
    if (fade <= 0.01) return;
    const { ctx } = this;
    const from = this.edgePoint(-1);
    const to = this.edgePoint(1);

    ctx.lineCap = "round";
    ctx.strokeStyle = PALETTE.core;
    for (const [mult, alpha] of [
      [3.4, 0.22],
      [1, 0.9],
    ]) {
      ctx.globalAlpha = alpha * fade;
      ctx.lineWidth = this.width * mult;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawFlash(fade) {
    if (fade <= 0.01) return;
    const { ctx } = this;
    const flare = this.size * (0.45 + (1 - fade) * 0.5);
    ctx.globalAlpha = Math.min(1, fade);
    ctx.drawImage(
      this.sprites[0],
      this.center.x - flare / 2,
      this.center.y - flare / 2,
      flare,
      flare,
    );
    ctx.globalAlpha = 1;
  }

  drawSparks(dt) {
    const { ctx } = this;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      s.vx *= 0.92;
      s.vy = s.vy * 0.92 + 900 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const k = s.life / s.maxLife;
      const size = s.size * (0.3 + k * 0.7);
      ctx.globalAlpha = k;
      ctx.drawImage(s.sprite, s.x - size / 2, s.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
}

const PADDING_SCALE = 1.1;
const PADDING_FLOOR = 220;

export async function playParry({ userEl, targetEl }) {
  if (!targetEl) return;

  const rect = targetEl.getBoundingClientRect();
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const size = Math.max(rect.width, rect.height);

  let incomingAngle = 0;
  if (userEl) {
    const u = getElementCenter(userEl);
    incomingAngle = Math.atan2(center.y - u.y, center.x - u.x);
  }

  const box = computeEffectBox([center], size * PADDING_SCALE + PADDING_FLOOR);
  await runSoloEffect(
    box,
    (ctx) => new ParryEffect(ctx, center, size, incomingAngle),
  );
}

// Part two of the exchange: the deflected blade is thrown straight back down
// the line it came from, landing on the champion who opened the attack.
const LUNGE_DELAY = 0.1;
const THRUST_DURATION = 0.14;
const IMPACT_DURATION = 0.34;

class RiposteEffect {
  constructor(ctx, from, to, size) {
    this.ctx = ctx;
    this.from = from;
    this.to = to;
    this.size = size;
    this.age = 0;
    this.sparks = [];
    this.landed = false;
    this.particleScale = getParticleScale();
    this.sprites = getSprites();
    this.width = Math.max(2.5, size * 0.02);
    this.lifetime = LUNGE_DELAY + THRUST_DURATION + IMPACT_DURATION;
  }

  spawnSparks() {
    const back = Math.atan2(this.from.y - this.to.y, this.from.x - this.to.x);
    const count = Math.round(16 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const dir = back + (Math.random() - 0.5) * 1.9;
      const speed = 300 + Math.random() * 640;
      this.sparks.push({
        x: this.to.x + (Math.random() - 0.5) * this.size * 0.14,
        y: this.to.y + (Math.random() - 0.5) * this.size * 0.14,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0.16 + Math.random() * 0.32,
        maxLife: 0.48,
        size: 4 + Math.random() * 9,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;
    const t = this.age - LUNGE_DELAY;

    ctx.globalCompositeOperation = "lighter";

    if (t >= 0) {
      if (t < THRUST_DURATION) {
        this.drawThrust(t / THRUST_DURATION);
      } else {
        if (!this.landed) {
          this.landed = true;
          this.spawnSparks();
        }
        const after = (t - THRUST_DURATION) / IMPACT_DURATION;
        this.drawThrust(1, Math.max(0, 1 - after * 1.8));
        this.drawImpact(Math.max(0, 1 - after));
      }
      this.drawSparks(dt);
    }

    ctx.globalCompositeOperation = "source-over";
    return this.age < this.lifetime;
  }

  drawThrust(p, fade = 1) {
    if (fade <= 0.01) return;
    const { ctx, from, to } = this;
    const head = {
      x: from.x + (to.x - from.x) * p,
      y: from.y + (to.y - from.y) * p,
    };
    const tailP = Math.max(0, p - 0.45);
    const tail = {
      x: from.x + (to.x - from.x) * tailP,
      y: from.y + (to.y - from.y) * tailP,
    };

    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, `${PALETTE.deep}00`);
    grad.addColorStop(0.6, `${PALETTE.mid}a0`);
    grad.addColorStop(1, PALETTE.core);

    ctx.lineCap = "round";
    ctx.strokeStyle = grad;
    for (const [mult, alpha] of [
      [3, 0.26],
      [1, 0.95],
    ]) {
      ctx.globalAlpha = alpha * fade;
      ctx.lineWidth = this.width * mult;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawImpact(fade) {
    if (fade <= 0.01) return;
    const { ctx } = this;
    const flare = this.size * (0.4 + (1 - fade) * 0.55);
    ctx.globalAlpha = Math.min(1, fade);
    ctx.drawImage(
      this.sprites[0],
      this.to.x - flare / 2,
      this.to.y - flare / 2,
      flare,
      flare,
    );
    ctx.globalAlpha = 1;
  }

  drawSparks(dt) {
    ParryEffect.prototype.drawSparks.call(this, dt);
  }
}

export async function playRiposte({ userEl, targetEl }) {
  if (!targetEl) return;

  const to = getElementCenter(targetEl);
  const size = (() => {
    const rect = targetEl.getBoundingClientRect();
    return Math.max(rect.width, rect.height);
  })();
  const from = userEl ? getElementCenter(userEl) : { x: to.x, y: to.y - size };

  targetEl.classList.add("slash-hit");
  setTimeout(() => targetEl.classList.remove("slash-hit"), 380);

  const box = computeEffectBox([from, to], size * PADDING_SCALE + PADDING_FLOOR);
  await runSoloEffect(box, (ctx) => new RiposteEffect(ctx, from, to, size));
}
