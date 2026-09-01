// ============================================================
//  Unmaking Animation
//
//  Played instead of the death collapse when something whose ending
//  is not a death leaves the field. A wavefront sweeps the card from
//  the hem upward, and every mote it releases is born on that line —
//  the figure is erased by the same edge that scatters it, so it
//  unravels upward rather than falling like a body.
// ============================================================

import {
  computeEffectBox,
  runSoloEffect,
} from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";

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
const PALETTES = Object.freeze({
  // Silas's mirage: moonlight on a wet street, cold and unmourned.
  hollow: { core: "#efe4ff", mid: "#9a63e8", deep: "#3d1a6b" },
  // Laisaelis's Echo: an answer given, pale and warm.
  answer: { core: "#ffffff", mid: "#fff2c9", deep: "#ffcf72" },
});

export const DEFAULT_UNMAKING_PALETTE = "hollow";

// Pre-rendered once per palette and reused from then on.
const spriteCache = new Map();

function getSprites(paletteKey) {
  let sprites = spriteCache.get(paletteKey);
  if (!sprites) {
    const { core, mid, deep } = PALETTES[paletteKey];
    sprites = [core, mid, deep].map(makeGlowSprite);
    spriteCache.set(paletteKey, sprites);
  }
  return sprites;
}

const SWEEP_DURATION = 0.62;
const LIFETIME = 1.05;
const MOTE_BUDGET = 46;
const PADDING = 26;

class UnmakingEffect {
  constructor(ctx, rect, paletteKey) {
    this.ctx = ctx;
    this.rect = rect;
    this.age = 0;
    this.motes = [];
    this.released = 0;
    this.colors = PALETTES[paletteKey];
    this.sprites = getSprites(paletteKey);
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

/** Plays the unravelling over `el` and resolves when the last mote is gone. */
export async function playUnmakingEffect(el, paletteKey) {
  const palette = PALETTES[paletteKey] ? paletteKey : DEFAULT_UNMAKING_PALETTE;
  const rect = el.getBoundingClientRect();

  const box = computeEffectBox(
    [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.bottom },
    ],
    PADDING,
  );

  await runSoloEffect(box, (ctx) => new UnmakingEffect(ctx, rect, palette));
}
