// A ring of dark gravity closes in on the target and snaps shut, pinning
// them where they stand. Canvas over the defender only, no lunge.

import { computeEffectBox, runSoloEffect } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";

const SPRITE_SIZE = 48;
const PALETTE = Object.freeze({
  core: "#3a3a42",
  mid: "#6a6478",
  glow: "#b9a8ff",
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
  sprites ??= [PALETTE.glow, PALETTE.mid, PALETTE.core].map(makeGlowSprite);
  return sprites;
}

const CLOSE_DURATION = 0.32;
const SNAP_DURATION = 0.16;
const FADE_DURATION = 0.3;
const RING_COUNT = 3;

class CrushingGripEffect {
  constructor(ctx, center, size) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.snapped = false;
    this.debris = [];
    this.particleScale = getParticleScale();
    this.sprites = getSprites();
    this.lifetime = CLOSE_DURATION + SNAP_DURATION + FADE_DURATION;
  }

  spawnDebris() {
    const count = Math.round(12 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const dir = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      this.debris.push({
        x: this.center.x,
        y: this.center.y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0.2 + Math.random() * 0.24,
        maxLife: 0.44,
        size: 3 + Math.random() * 6,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;

    ctx.globalCompositeOperation = "lighter";

    if (this.age < CLOSE_DURATION) {
      this.drawClosingRings(this.age / CLOSE_DURATION);
    } else if (this.age < CLOSE_DURATION + SNAP_DURATION) {
      if (!this.snapped) {
        this.snapped = true;
        this.spawnDebris();
      }
      this.drawSnapFlash(
        1 - (this.age - CLOSE_DURATION) / SNAP_DURATION,
      );
    } else {
      const fade = Math.max(
        0,
        1 - (this.age - CLOSE_DURATION - SNAP_DURATION) / FADE_DURATION,
      );
      this.drawSnapFlash(fade * 0.3);
    }

    this.drawDebris(dt);
    ctx.globalCompositeOperation = "source-over";
    return this.age < this.lifetime;
  }

  drawClosingRings(p) {
    const { ctx } = this;
    for (let i = 0; i < RING_COUNT; i++) {
      const offset = i / RING_COUNT;
      const k = Math.min(1, Math.max(0, p - offset * 0.25) / (1 - offset * 0.25));
      const r = this.size * (0.85 - k * 0.55);
      ctx.globalAlpha = 0.25 + k * 0.55;
      ctx.strokeStyle = i === 0 ? PALETTE.glow : PALETTE.mid;
      ctx.lineWidth = Math.max(1.5, this.size * 0.018);
      ctx.beginPath();
      ctx.arc(this.center.x, this.center.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawSnapFlash(k) {
    if (k <= 0.01) return;
    const { ctx } = this;
    const r = this.size * (0.18 + (1 - k) * 0.1);
    ctx.globalAlpha = Math.min(1, k);
    ctx.drawImage(
      this.sprites[0],
      this.center.x - r,
      this.center.y - r,
      r * 2,
      r * 2,
    );
    ctx.globalAlpha = 1;
  }

  drawDebris(dt) {
    const { ctx } = this;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.debris.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy *= 0.9;
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

const PADDING_SCALE = 0.7;
const PADDING_FLOOR = 90;

export async function playCrushingGrip({ targetEl }) {
  if (!targetEl) return;

  const rect = targetEl.getBoundingClientRect();
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const size = Math.max(rect.width, rect.height);

  const box = computeEffectBox([center], size * PADDING_SCALE + PADDING_FLOOR);
  await runSoloEffect(box, (ctx) => new CrushingGripEffect(ctx, center, size));
}
