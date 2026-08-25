// ============================================================
//  Slash Animation
//
//  Default cut motif, opted into with `hitVfx: "slash"`. A single
//  stroke: a hairline is traced across the target almost too fast
//  to see, holds, then tears open into a wide diagonal fissure.
//  Skills that are genuinely several strokes use "multislash".
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

// Trace fast, hold on the hairline, then tear it open and fade.
const TRACE_DURATION = 0.15;
const HOLD_DURATION = 0.09;
const OPEN_DURATION = 0.3;
const FADE_DURATION = 0.3;
const LIFETIME =
  TRACE_DURATION + HOLD_DURATION + OPEN_DURATION + FADE_DURATION;

export class SlashEffect {
  constructor(ctx, center, size, baseAngle, paletteKey) {
    this.ctx = ctx;
    this.center = center;
    this.age = 0;
    this.sparks = [];
    this.torn = false;
    this.colors = PALETTES[paletteKey];
    this.sprites = getSprites(paletteKey);

    // A steep diagonal, leaning away from whichever side the attacker is on
    // so the stroke still reads as coming from them.
    const lean = Math.cos(baseAngle) >= 0 ? 1 : -1;
    this.angle = lean * (Math.PI / 3.4);
    this.dirX = Math.cos(this.angle);
    this.dirY = Math.sin(this.angle);

    this.length = size * 2.3;
    this.maxWidth = size * 0.15;
    this.particleScale = getParticleScale();
  }

  spawnSparks() {
    // Thrown out of the fissure, perpendicular to it.
    const perpX = -this.dirY;
    const perpY = this.dirX;
    const count = Math.round(16 * this.particleScale);

    for (let i = 0; i < count; i++) {
      const along = (Math.random() - 0.5) * this.length * 0.7;
      const speed = 120 + Math.random() * 420;
      const side = Math.random() < 0.5 ? 1 : -1;
      this.sparks.push({
        x: this.center.x + this.dirX * along,
        y: this.center.y + this.dirY * along,
        vx: perpX * speed * side + (Math.random() - 0.5) * 120,
        vy: perpY * speed * side + (Math.random() - 0.5) * 120,
        life: 0.2 + Math.random() * 0.34,
        maxLife: 0.54,
        size: 5 + Math.random() * 12,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    ctx.globalCompositeOperation = "lighter";
    if (this.age < TRACE_DURATION) {
      this.drawTrace(this.age / TRACE_DURATION);
    } else {
      const since = this.age - TRACE_DURATION - HOLD_DURATION;
      if (since <= 0) {
        this.drawFissure(0, 1);
      } else {
        if (!this.torn) {
          this.torn = true;
          this.spawnSparks();
        }
        const open = Math.min(since / OPEN_DURATION, 1);
        const fade =
          since <= OPEN_DURATION
            ? 1
            : 1 - (since - OPEN_DURATION) / FADE_DURATION;
        // Ease-out so the tear snaps open and then settles.
        this.drawFissure(1 - Math.pow(1 - open, 3), Math.max(fade, 0));
      }
    }
    this.drawSparks(dt);
    ctx.globalCompositeOperation = "source-over";

    return this.age < LIFETIME;
  }

  // The hairline being drawn: a bright point runs the length of the cut and
  // leaves a one-pixel thread behind it.
  drawTrace(p) {
    const { ctx, center } = this;
    const half = this.length / 2;
    const from = {
      x: center.x - this.dirX * half,
      y: center.y - this.dirY * half,
    };
    const headAt = -half + p * this.length;
    const head = {
      x: center.x + this.dirX * headAt,
      y: center.y + this.dirY * headAt,
    };

    ctx.lineCap = "round";
    ctx.strokeStyle = this.colors.core;
    ctx.globalAlpha = 0.95;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();

    const flare = 26;
    ctx.globalAlpha = 1;
    ctx.drawImage(
      this.sprites[0],
      head.x - flare / 2,
      head.y - flare / 2,
      flare,
      flare,
    );
    ctx.globalAlpha = 1;
  }

  // The tear itself: a lens shape whose rims glow and whose middle stays
  // empty, so it reads as an opening rather than a painted stripe.
  drawFissure(open, fade) {
    const { ctx, center } = this;
    const { core, mid, deep } = this.colors;
    const half = this.length / 2;
    const perpX = -this.dirY;
    const perpY = this.dirX;
    const width = this.maxWidth * open;

    const tipA = {
      x: center.x - this.dirX * half,
      y: center.y - this.dirY * half,
    };
    const tipB = {
      x: center.x + this.dirX * half,
      y: center.y + this.dirY * half,
    };

    if (width > 0.5) {
      // Control points bulge the two arcs apart; 2x because a quadratic curve
      // only reaches half of its control offset.
      const bulge = width * 2;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.moveTo(tipA.x, tipA.y);
      ctx.quadraticCurveTo(
        center.x + perpX * bulge,
        center.y + perpY * bulge,
        tipB.x,
        tipB.y,
      );
      ctx.quadraticCurveTo(
        center.x - perpX * bulge,
        center.y - perpY * bulge,
        tipA.x,
        tipA.y,
      );

      const grad = ctx.createLinearGradient(
        center.x - perpX * width,
        center.y - perpY * width,
        center.x + perpX * width,
        center.y + perpY * width,
      );
      grad.addColorStop(0, core);
      grad.addColorStop(0.28, `${mid}66`);
      grad.addColorStop(0.5, `${deep}14`);
      grad.addColorStop(0.72, `${mid}66`);
      grad.addColorStop(1, core);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // The thread stays visible along the middle the whole time.
    ctx.lineCap = "round";
    ctx.strokeStyle = core;
    ctx.globalAlpha = fade * (1 - open * 0.55);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(tipA.x, tipA.y);
    ctx.lineTo(tipB.x, tipB.y);
    ctx.stroke();
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
      p.vx *= 0.93;
      p.vy = p.vy * 0.93 + 620 * dt;
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

// Padding around the target big enough to hold the fissure and its sparks
// at their farthest travel, scaled by the target's own size.
const PADDING_SCALE = 1;
const PADDING_FLOOR = 250;

export async function playSlash({ userEl, targetEl, skill, canvasBatch }) {
  if (!targetEl) return;

  // Authorial override first, then the element, then plain steel for the
  // physical cuts that carry no element at all.
  const requested = skill?.hitVfxPalette || skill?.element;
  const paletteKey = requested in PALETTES ? requested : "steel";

  const rect = targetEl.getBoundingClientRect();
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const size = Math.max(rect.width, rect.height);

  let baseAngle = 0;
  if (userEl) {
    const userCenter = getElementCenter(userEl);
    baseAngle = Math.atan2(center.y - userCenter.y, center.x - userCenter.x);
  }

  const buildEffect = (ctx) =>
    new SlashEffect(ctx, center, size, baseAngle, paletteKey);
  const padding = size * PADDING_SCALE + PADDING_FLOOR;

  targetEl.classList.add("slash-hit");
  setTimeout(() => targetEl.classList.remove("slash-hit"), 380);

  if (canvasBatch) {
    await canvasBatch.run([center], padding, buildEffect);
  } else {
    await runSoloEffect(computeEffectBox([center], padding), buildEffect);
  }
}
