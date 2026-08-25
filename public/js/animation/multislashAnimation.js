// ============================================================
//  Multislash Animation
//
//  Combo variant of the cut motif, opted into with
//  `hitVfx: "multislash"`. Three staggered blades fan across the
//  target and each wound opens on its own beat. Reserved for cut
//  ultimates and skills that are explicitly several strokes.
// ============================================================

import {
  computeEffectBox,
  getElementCenter,
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

// Hues follow shared/ui/identityPalette.js so a cut reads as the same element
// as its badge, but the values are brighter: additive blending washes out the
// muted badge tones, and a blade needs a near-white core to look sharp.
// The element keys resolve automatically; the rest are authorial overrides
// picked with `hitVfxPalette`.
const PALETTES = Object.freeze({
  steel: { core: "#ffffff", mid: "#d6f0ff", deep: "#78beff" },
  fire: { core: "#fff6df", mid: "#ffb347", deep: "#ff4d12" },
  water: { core: "#f0feff", mid: "#7fd4ff", deep: "#2e92f6" },
  ice: { core: "#f4ffff", mid: "#b6f2ff", deep: "#56b2ce" },
  lightning: { core: "#fffce0", mid: "#ffe66b", deep: "#e0a915" },
  earth: { core: "#fff4e2", mid: "#d2a878", deep: "#8a5a2b" },
  violet: { core: "#fbf0ff", mid: "#c98bff", deep: "#7b2fd6" },
  crimson: { core: "#fff0f0", mid: "#ff6b6b", deep: "#b3121b" },
});

// Sprites are pre-rendered once per palette and reused from then on.
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

// Each blade sweeps fast, then its wound lingers and opens.
const SWEEP_DURATION = 0.14;
const WOUND_DURATION = 0.5;
const STAGGER = 0.07;
// The wound only splits apart once the blade has fully passed through.
const SPLIT_DELAY = 0.1;

export class MultislashEffect {
  constructor(ctx, center, size, baseAngle, paletteKey) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.sparks = [];
    this.colors = PALETTES[paletteKey];
    this.sprites = getSprites(paletteKey);

    // Three crossing blades fanned around the attack direction, so the cut
    // reads as a combo rather than a single stroke.
    this.blades = [-0.5, 0.6, 0.08].map((spread, i) => ({
      angle: baseAngle + Math.PI / 2 + spread,
      delay: i * STAGGER,
      length: size * (1.9 + Math.random() * 0.4),
      width: 7 - i * 1.5,
      sparked: false,
    }));

    this.lifetime =
      (this.blades.length - 1) * STAGGER + SWEEP_DURATION + WOUND_DURATION;
    this.particleScale = getParticleScale();
  }

  spawnSparks(blade) {
    const dirX = Math.cos(blade.angle);
    const dirY = Math.sin(blade.angle);
    const count = Math.round(14 * this.particleScale);

    for (let i = 0; i < count; i++) {
      // Scattered along the cut, thrown outwards along its own axis.
      const along = (Math.random() - 0.5) * blade.length * 0.8;
      const speed = 260 + Math.random() * 620;
      const sign = Math.random() < 0.5 ? 1 : -1;
      this.sparks.push({
        x: this.center.x + dirX * along,
        y: this.center.y + dirY * along,
        vx: dirX * speed * sign + (Math.random() - 0.5) * 160,
        vy: dirY * speed * sign + (Math.random() - 0.5) * 160,
        life: 0.16 + Math.random() * 0.3,
        maxLife: 0.46,
        size: 5 + Math.random() * 11,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    ctx.globalCompositeOperation = "lighter";
    for (const blade of this.blades) {
      const t = this.age - blade.delay;
      if (t < 0) continue;

      if (t < SWEEP_DURATION) {
        this.drawSweep(blade, t / SWEEP_DURATION);
      } else {
        if (!blade.sparked) {
          blade.sparked = true;
          this.spawnSparks(blade);
        }
        this.drawWound(blade, (t - SWEEP_DURATION) / WOUND_DURATION);
      }
    }
    this.drawSparks(dt);
    ctx.globalCompositeOperation = "source-over";

    return this.age < this.lifetime;
  }

  // The blade is a bright head dragging a tapered tail, travelling from one
  // side of the target to the other.
  drawSweep(blade, p) {
    const { ctx, center } = this;
    const dirX = Math.cos(blade.angle);
    const dirY = Math.sin(blade.angle);
    const half = blade.length / 2;
    const tailLen = blade.length * 0.55;

    const headAt = -half + p * (blade.length + tailLen);
    const tailAt = Math.max(headAt - tailLen, -half);
    if (headAt <= -half) return;

    const head = {
      x: center.x + dirX * Math.min(headAt, half),
      y: center.y + dirY * Math.min(headAt, half),
    };
    const tail = { x: center.x + dirX * tailAt, y: center.y + dirY * tailAt };

    const { core, mid, deep } = this.colors;
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, `${deep}00`);
    grad.addColorStop(0.6, `${mid}8c`);
    grad.addColorStop(1, core);

    ctx.lineCap = "round";
    ctx.strokeStyle = grad;

    // Wide halo first, then the razor core on top.
    for (const [width, alpha] of [
      [blade.width * 3.2, 0.35],
      [blade.width, 0.9],
      [blade.width * 0.32, 1],
    ]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(head.x, head.y);
      ctx.stroke();
    }

    const flare = blade.width * 6;
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

  // Residual cut: one line that holds, then separates into two drifting
  // edges — the beat that sells it as a wound instead of a light streak.
  drawWound(blade, e) {
    const { ctx, center } = this;
    const fade = Math.pow(1 - e, 1.6);
    if (fade <= 0.01) return;

    const dirX = Math.cos(blade.angle);
    const dirY = Math.sin(blade.angle);
    const half = blade.length / 2;
    const gap =
      e < SPLIT_DELAY ? 0 : (e - SPLIT_DELAY) * this.size * 0.16;

    ctx.strokeStyle = this.colors.core;
    ctx.lineCap = "round";
    for (const side of [1, -1]) {
      const offX = -dirY * gap * side;
      const offY = dirX * gap * side;
      ctx.globalAlpha = fade * 0.9;
      ctx.lineWidth = blade.width * 0.45 * fade;
      ctx.beginPath();
      ctx.moveTo(center.x - dirX * half + offX, center.y - dirY * half + offY);
      ctx.lineTo(center.x + dirX * half + offX, center.y + dirY * half + offY);
      ctx.stroke();
      if (gap === 0) break;
    }
    ctx.globalAlpha = 1;
  }

  drawSparks(dt) {
    const { ctx } = this;
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparks.splice(i, 1);
        continue;
      }
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 900 * dt;
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

// Padding around the target big enough to hold the widest blade sweep and
// its sparks at their farthest travel, scaled by the target's own size.
const PADDING_SCALE = 1.2;
const PADDING_FLOOR = 320;

export async function playMultislash({ userEl, targetEl, skill, canvasBatch }) {
  if (!targetEl) return;

  // Authorial override first, then the element, then plain steel for the
  // physical cuts that carry no element at all.
  const requested = skill?.hitVfxPalette || skill?.element;
  const paletteKey = requested in PALETTES ? requested : "steel";

  const rect = targetEl.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const size = Math.max(rect.width, rect.height);

  // Blades fan around the attack direction, so the swing comes from the user.
  let baseAngle = 0;
  if (userEl) {
    const userCenter = getElementCenter(userEl);
    baseAngle = Math.atan2(center.y - userCenter.y, center.x - userCenter.x);
  }

  const buildEffect = (ctx) =>
    new MultislashEffect(ctx, center, size, baseAngle, paletteKey);
  const padding = size * PADDING_SCALE + PADDING_FLOOR;

  targetEl.classList.add("slash-hit");
  setTimeout(() => targetEl.classList.remove("slash-hit"), 380);

  if (canvasBatch) {
    await canvasBatch.run([center], padding, buildEffect);
  } else {
    await runSoloEffect(computeEffectBox([center], padding), buildEffect);
  }
}
