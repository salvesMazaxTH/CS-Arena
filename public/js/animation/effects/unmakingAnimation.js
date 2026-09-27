// ============================================================
//  Unmaking Animation
//
//  Played instead of the death collapse when something whose ending
//  is not a death leaves the field. Two shapes of exit:
//  - unravel: a wavefront sweeps the card from the hem upward and
//    every mote it releases is born on that line, so an illusion
//    comes apart upward rather than falling like a body.
//  - crumble: what the soil raised goes back to it. The card cracks,
//    gives way from the top down, and small chips fall and settle in
//    a low cloud of dust.
// ============================================================

import {
  computeEffectBox,
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

// The board is almost black, so a dark palette cannot be dark all the way
// through or it reads as nothing. Each palette keeps its character in the mid
// and deep tones and buys legibility with a near-white core, the same trade
// slashAnimation.js makes.
const MOTIFS = Object.freeze({
  // Silas's mirage: moonlight on a wet street, cold and unmourned.
  hollow: {
    shape: "unravel",
    palette: { core: "#efe4ff", mid: "#9a63e8", deep: "#3d1a6b" },
  },
  // Laisaelis's Echo: an answer given, pale and warm.
  answer: {
    shape: "unravel",
    palette: { core: "#ffffff", mid: "#fff2c9", deep: "#ffcf72" },
  },
  // Anything the soil raised: it cracks and falls back into the ground.
  crumble: {
    shape: "crumble",
    palette: { core: "#f3e2bd", mid: "#b5843f", deep: "#7a5c33" },
    dust: "#c9b08a",
    fissure: "#241a10",
  },
});

export const DEFAULT_UNMAKING_VFX = "hollow";

function resolveUnmakingVfx(vfxKey) {
  return MOTIFS[vfxKey] ? vfxKey : DEFAULT_UNMAKING_VFX;
}

/** Which CSS erase the card itself wears under the canvas layer. */
export function getUnmakingShape(vfxKey) {
  return MOTIFS[resolveUnmakingVfx(vfxKey)].shape;
}

// Pre-rendered once per palette and reused from then on.
const spriteCache = new Map();

function getSprites(vfxKey) {
  let sprites = spriteCache.get(vfxKey);
  if (!sprites) {
    const { core, mid, deep } = MOTIFS[vfxKey].palette;
    sprites = [core, mid, deep].map(makeGlowSprite);
    spriteCache.set(vfxKey, sprites);
  }
  return sprites;
}

// A soft puff with no hard core: dust is laid over the board, not added as light.
const dustSprites = new Map();

function getDustSprite(color) {
  let sprite = dustSprites.get(color);
  if (!sprite) {
    sprite = document.createElement("canvas");
    sprite.width = SPRITE_SIZE;
    sprite.height = SPRITE_SIZE;

    const ctx = sprite.getContext("2d");
    const r = SPRITE_SIZE / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    dustSprites.set(color, sprite);
  }
  return sprite;
}

const SWEEP_DURATION = 0.62;
const LIFETIME = 1.05;
const MOTE_BUDGET = 46;
const PADDING = 26;

class UnravelEffect {
  constructor(ctx, rect, vfxKey) {
    this.ctx = ctx;
    this.rect = rect;
    this.age = 0;
    this.motes = [];
    this.released = 0;
    this.colors = MOTIFS[vfxKey].palette;
    this.sprites = getSprites(vfxKey);
    this.budget = Math.round(MOTE_BUDGET * getParticleScale());
  }

  // Motes owe their position to the wavefront, so they can only appear on the
  // part of the figure that has already come apart.
  release(edgeY, count) {
    const { rect } = this;

    for (let i = 0; i < count; i++) {
      // Larger motes are the slow ones that lag behind and sell the unravelling.
      const heavy = Math.random() < 0.22;

      this.motes.push({
        x: rect.left + Math.random() * rect.width,
        y: edgeY + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * (heavy ? 14 : 38),
        vy: heavy ? -14 - Math.random() * 18 : -34 - Math.random() * 54,
        life: 0,
        maxLife: (heavy ? 0.62 : 0.42) + Math.random() * 0.16,
        size: (heavy ? 15 : 7) + Math.random() * 9,
        sprite: this.sprites[i % this.sprites.length],
      });
      this.released++;
    }
  }

  step(dt) {
    this.age += dt;

    const { ctx, rect } = this;
    const sweep = Math.min(this.age / SWEEP_DURATION, 1);
    const edgeY = rect.bottom - sweep * rect.height;

    if (this.released < this.budget) {
      const due = Math.ceil(sweep * this.budget) - this.released;
      if (due > 0) this.release(edgeY, Math.min(due, this.budget - this.released));
    }

    ctx.globalCompositeOperation = "lighter";

    if (sweep < 1) {
      this.drawEdge(edgeY, 1 - sweep * 0.35);
    }

    this.drawMotes(dt);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    return this.age < LIFETIME;
  }

  // The line the figure is coming apart along: bright, thin, no blur.
  drawEdge(edgeY, alpha) {
    const { ctx, rect } = this;
    const inset = rect.width * 0.06;

    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = this.colors.core;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rect.left + inset, edgeY);
    ctx.lineTo(rect.right - inset, edgeY);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = this.colors.mid;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  drawMotes(dt) {
    const { ctx } = this;

    for (let i = this.motes.length - 1; i >= 0; i--) {
      const mote = this.motes[i];
      mote.life += dt;

      if (mote.life >= mote.maxLife) {
        this.motes.splice(i, 1);
        continue;
      }

      // Buoyancy: they let go of the ground as they lose cohesion.
      mote.vy -= 26 * dt;
      mote.x += mote.vx * dt;
      mote.y += mote.vy * dt;

      const remaining = 1 - mote.life / mote.maxLife;
      const size = mote.size * (0.35 + remaining * 0.65);

      ctx.globalAlpha = remaining * remaining;
      ctx.drawImage(mote.sprite, mote.x - size / 2, mote.y - size / 2, size, size);
    }
  }
}

// Timed against the .champion.unmaking[data-unmaking="crumble"] keyframes.
const CRACK_DURATION = 0.16;
const COLLAPSE_DURATION = 0.56;
const CHIP_BUDGET = 34;
const DUST_BUDGET = 10;
const GRAVITY = 1100;

function traceFissure(rect) {
  let x = rect.left + rect.width * (0.22 + Math.random() * 0.56);
  let y = rect.top + rect.height * (0.08 + Math.random() * 0.22);
  const segments = 5 + Math.floor(Math.random() * 3);
  const step = (rect.height * (0.45 + Math.random() * 0.3)) / segments;
  const points = [{ x, y }];

  for (let i = 0; i < segments; i++) {
    x += (Math.random() - 0.5) * rect.width * 0.18;
    y += step * (0.6 + Math.random() * 0.6);
    points.push({ x, y });
  }
  return points;
}

class CrumbleEffect {
  constructor(ctx, rect, vfxKey) {
    this.ctx = ctx;
    this.rect = rect;
    this.age = 0;
    this.motif = MOTIFS[vfxKey];
    this.dustSprite = getDustSprite(this.motif.dust);
    this.fissures = [traceFissure(rect), traceFissure(rect), traceFissure(rect)];
    this.chips = [];
    this.dust = [];
    this.chipsReleased = 0;
    this.dustReleased = 0;
    this.chipBudget = Math.round(CHIP_BUDGET * getParticleScale());
    this.dustBudget = Math.max(4, Math.round(DUST_BUDGET * getParticleScale()));
    this.floor = rect.bottom + 4;
  }

  step(dt) {
    this.age += dt;

    const { rect } = this;
    const crack = Math.min(this.age / CRACK_DURATION, 1);
    const collapse = Math.min(
      Math.max((this.age - CRACK_DURATION) / COLLAPSE_DURATION, 0),
      1,
    );
    const edgeY = rect.top + collapse * rect.height;

    if (collapse > 0) {
      const dueChips = Math.ceil(collapse * this.chipBudget) - this.chipsReleased;
      for (let i = 0; i < dueChips; i++) this.releaseChip(edgeY);

      // Dust only rises once the first chips have had time to reach the ground.
      const settle = Math.max((collapse - 0.25) / 0.75, 0);
      const dueDust = Math.ceil(settle * this.dustBudget) - this.dustReleased;
      for (let i = 0; i < dueDust; i++) this.releaseDust();
    }

    if (collapse < 1) this.drawFissures(crack, edgeY, 1 - collapse);
    this.drawDust(dt);
    this.drawChips(dt);

    this.ctx.globalAlpha = 1;

    return (
      this.age < CRACK_DURATION + COLLAPSE_DURATION ||
      this.chips.length > 0 ||
      this.dust.length > 0
    );
  }

  releaseChip(edgeY) {
    const { rect, motif } = this;
    const { core, mid, deep } = motif.palette;
    const size = 2.5 + Math.random() * 3.5;
    const corners = Math.random() < 0.5 ? 3 : 4;
    const shape = [];

    for (let i = 0; i < corners; i++) {
      const angle = (i / corners) * Math.PI * 2 + Math.random() * 0.8;
      const reach = size * (0.6 + Math.random() * 0.5);
      shape.push({ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach });
    }

    this.chips.push({
      x: rect.left + Math.random() * rect.width,
      y: edgeY + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 110,
      vy: -30 + Math.random() * 70,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 14,
      life: 0,
      maxLife: 0.45 + Math.random() * 0.2,
      color: [core, mid, deep][this.chipsReleased % 3],
      shape,
    });
    this.chipsReleased++;
  }

  releaseDust() {
    const { rect } = this;
    const side = Math.random() < 0.5 ? -1 : 1;

    this.dust.push({
      x: rect.left + rect.width * (0.15 + Math.random() * 0.7),
      y: this.floor - 4 - Math.random() * 8,
      vx: side * (35 + Math.random() * 60),
      vy: -6 - Math.random() * 10,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.2,
      size: 16 + Math.random() * 10,
    });
    this.dustReleased++;
  }

  // Thin lines only: the fracture is implied, never drawn as blocks of stone.
  // Only what still stands below the collapsing edge keeps its cracks.
  drawFissures(crack, edgeY, alpha) {
    const { ctx, rect, motif } = this;

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.left - 4, edgeY, rect.width + 8, rect.bottom - edgeY + 4);
    ctx.clip();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const points of this.fissures) {
      const reach = crack * (points.length - 1);
      const whole = Math.floor(reach);

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i <= whole; i++) ctx.lineTo(points[i].x, points[i].y);
      if (whole < points.length - 1) {
        const from = points[whole];
        const to = points[whole + 1];
        const t = reach - whole;
        ctx.lineTo(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
      }

      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = motif.fissure;
      ctx.lineWidth = 2.6;
      ctx.stroke();

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = motif.palette.core;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  drawChips(dt) {
    const { ctx } = this;

    for (let i = this.chips.length - 1; i >= 0; i--) {
      const chip = this.chips[i];
      chip.life += dt;

      if (chip.life >= chip.maxLife) {
        this.chips.splice(i, 1);
        continue;
      }

      chip.vy += GRAVITY * dt;
      chip.x += chip.vx * dt;
      chip.y += chip.vy * dt;
      chip.angle += chip.spin * dt;

      // A dull, short bounce: stone lands, it does not spring.
      if (chip.y > this.floor && chip.vy > 0) {
        chip.y = this.floor;
        chip.vy *= -0.22;
        chip.vx *= 0.55;
        chip.spin *= 0.5;
      }

      const remaining = 1 - chip.life / chip.maxLife;
      const cos = Math.cos(chip.angle);
      const sin = Math.sin(chip.angle);

      ctx.globalAlpha = Math.min(1, remaining / 0.35);
      ctx.fillStyle = chip.color;
      ctx.beginPath();
      chip.shape.forEach((p, index) => {
        const x = chip.x + p.x * cos - p.y * sin;
        const y = chip.y + p.x * sin + p.y * cos;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
  }

  drawDust(dt) {
    const { ctx } = this;

    for (let i = this.dust.length - 1; i >= 0; i--) {
      const puff = this.dust[i];
      puff.life += dt;

      if (puff.life >= puff.maxLife) {
        this.dust.splice(i, 1);
        continue;
      }

      puff.vx *= 1 - 2.2 * dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;

      const travel = puff.life / puff.maxLife;
      const size = puff.size * (1 + travel * 1.6);

      ctx.globalAlpha = 0.32 * Math.min(1, travel / 0.15) * (1 - travel);
      ctx.drawImage(
        this.dustSprite,
        puff.x - size / 2,
        puff.y - size * 0.35,
        size,
        size * 0.7,
      );
    }
  }
}

const EFFECTS = Object.freeze({
  unravel: UnravelEffect,
  crumble: CrumbleEffect,
});

/** Plays the exit over `el` and resolves when the last particle is gone. */
export async function playUnmakingEffect(el, vfxKey) {
  const key = resolveUnmakingVfx(vfxKey);
  const Effect = EFFECTS[MOTIFS[key].shape];
  const rect = el.getBoundingClientRect();

  const box = computeEffectBox(
    [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.bottom },
    ],
    PADDING,
  );

  await runSoloEffect(box, (ctx) => new Effect(ctx, rect, key));
}
