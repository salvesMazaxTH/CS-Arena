// Ronan's ultimate (ignisars_temper): for one punch he stops being a man with
// dragon blood and is only the dragon, so the hit lands as a four-gash claw rake
// torn across the target's portrait in dragon-fire tones. 2D canvas over the
// target only, so it stays cheap on weak devices.

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";

const SPRITE_SIZE = 48;
const PALETTE = Object.freeze({
  core: "#fff1d6",
  mid: "#ff801f",
  deep: "#c11606",
});

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

// The whole paw rakes through fast; each claw is staggered a hair so the set
// tears rather than stamps, then every gash lingers and splits into a wound.
const SWEEP_DURATION = 0.13;
const WOUND_DURATION = 0.52;
const STAGGER = 0.028;
const SPLIT_DELAY = 0.12;

class DragonClawEffect {
  constructor(ctx, center, size, rakeAngle) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.sparks = [];
    this.particleScale = getParticleScale();
    this.sprites = getSprites();

    // Claws run across `axis`; the paw sweeps along `rake`, which is where the
    // four gashes are spaced out and slightly bowed into a fan.
    this.axis = rakeAngle + Math.PI / 2;
    this.rake = rakeAngle;
    const spacing = size * 0.135;
    const bow = size * 0.13;

    this.claws = [-1.5, -0.5, 0.5, 1.5].map((lane, i) => ({
      lane: lane * spacing,
      bow: bow * (0.7 + Math.random() * 0.3),
      delay: i * STAGGER,
      length: size * (1.55 + Math.random() * 0.35),
      // Outer claws read as the thumb and little finger: thicker, then thinner.
      width: Math.max(3, size * 0.03) * [1.15, 1, 0.9, 0.72][i],
      sparked: false,
    }));

    this.lifetime =
      (this.claws.length - 1) * STAGGER + SWEEP_DURATION + WOUND_DURATION;
  }

  // A point on the claw's bowed centreline, param u in [-0.5, 0.5].
  clawPoint(claw, u) {
    const along = u * claw.length;
    const curve = claw.bow * (1 - 4 * u * u); // 0 at the ends, full at the middle
    return {
      x:
        this.center.x +
        Math.cos(this.axis) * along +
        Math.cos(this.rake) * (claw.lane + curve),
      y:
        this.center.y +
        Math.sin(this.axis) * along +
        Math.sin(this.rake) * (claw.lane + curve),
    };
  }

  spawnSparks(claw) {
    const count = Math.round(9 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const at = this.clawPoint(claw, Math.random() - 0.5);
      const dir = this.axis + (Math.random() - 0.5) * 1.2;
      const speed = 220 + Math.random() * 560;
      const sign = Math.random() < 0.5 ? 1 : -1;
      this.sparks.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(dir) * speed * sign + (Math.random() - 0.5) * 140,
        vy: Math.sin(dir) * speed * sign + (Math.random() - 0.5) * 140,
        life: 0.18 + Math.random() * 0.32,
        maxLife: 0.5,
        size: 4 + Math.random() * 10,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    ctx.globalCompositeOperation = "lighter";
    for (const claw of this.claws) {
      const t = this.age - claw.delay;
      if (t < 0) continue;

      if (t < SWEEP_DURATION) {
        this.drawSweep(claw, t / SWEEP_DURATION);
      } else {
        if (!claw.sparked) {
          claw.sparked = true;
          this.spawnSparks(claw);
        }
        this.drawWound(claw, (t - SWEEP_DURATION) / WOUND_DURATION);
      }
    }
    this.drawSparks(dt);
    ctx.globalCompositeOperation = "source-over";

    return this.age < this.lifetime;
  }

  // The claw carves in as a bright tip dragging a tapered gash behind it.
  drawSweep(claw, p) {
    const { ctx } = this;
    const tail = 0.42;
    const headU = -0.5 + p * (1 + tail);
    const tailU = Math.max(headU - tail, -0.5);
    if (headU <= -0.5) return;

    const steps = 10;
    const from = tailU;
    const to = Math.min(headU, 0.5);

    const head = this.clawPoint(claw, to);
    const tailPt = this.clawPoint(claw, from);
    const grad = ctx.createLinearGradient(tailPt.x, tailPt.y, head.x, head.y);
    grad.addColorStop(0, `${PALETTE.deep}00`);
    grad.addColorStop(0.6, `${PALETTE.mid}9c`);
    grad.addColorStop(1, PALETTE.core);

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = grad;

    for (const [mult, alpha] of [
      [3.4, 0.32],
      [1, 0.9],
      [0.3, 1],
    ]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = claw.width * mult;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = from + ((to - from) * i) / steps;
        const pt = this.clawPoint(claw, u);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    }

    const flare = claw.width * 7;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(
      this.sprites[0],
      head.x - flare / 2,
      head.y - flare / 2,
      flare,
      flare,
    );
    ctx.globalAlpha = 1;
  }

  // Residual gash: holds a beat, then tears open into two drifting edges.
  drawWound(claw, e) {
    const { ctx } = this;
    const fade = Math.pow(1 - e, 1.6);
    if (fade <= 0.01) return;

    const gap = e < SPLIT_DELAY ? 0 : (e - SPLIT_DELAY) * this.size * 0.14;
    const nx = Math.cos(this.rake);
    const ny = Math.sin(this.rake);
    const steps = 10;

    ctx.strokeStyle = PALETTE.core;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const side of [1, -1]) {
      ctx.globalAlpha = fade * 0.9;
      ctx.lineWidth = claw.width * 0.5 * fade;
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = -0.5 + i / steps;
        const pt = this.clawPoint(claw, u);
        const x = pt.x + nx * gap * side;
        const y = pt.y + ny * gap * side;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      if (gap === 0) break;
    }
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
      s.vx *= 0.93;
      s.vy = s.vy * 0.93 + 820 * dt;
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
const PADDING_FLOOR = 300;

export async function playRonanDragonClaw({ userEl, targetEl }) {
  if (!targetEl) return;

  const rect = targetEl.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const size = Math.max(rect.width, rect.height);

  let rakeAngle = Math.PI * 0.16;
  if (userEl) {
    const u = getElementCenter(userEl);
    rakeAngle = Math.atan2(center.y - u.y, center.x - u.x) + Math.PI * 0.12;
  }

  targetEl.classList.add("slash-hit");
  setTimeout(() => targetEl.classList.remove("slash-hit"), 380);

  const box = computeEffectBox([center], size * PADDING_SCALE + PADDING_FLOOR);
  await runSoloEffect(box, (ctx) => new DragonClawEffect(ctx, center, size, rakeAngle));
}
