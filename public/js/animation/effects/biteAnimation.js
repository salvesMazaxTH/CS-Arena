// A pair of jaws snapping shut on the target's portrait. The jaws are only
// implied: two thin bowed lines of light edged with fang ticks, closing fast,
// then the fangs leave punctures that weep a few droplets. 2D canvas over the
// target only, so it stays cheap on weak devices.

import {
  computeEffectBox,
  getElementCenter,
  runSoloEffect,
} from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";

const SPRITE_SIZE = 48;
export const BITE_PALETTES = Object.freeze({
  // Bared bone-white fangs: the default any champion's bite falls back to.
  feral: Object.freeze({ core: "#ffffff", mid: "#e8dccb", deep: "#8a2a1c" }),
  // Venom-green fangs whose punctures keep dripping acid.
  acid: Object.freeze({ core: "#f4ffd6", mid: "#9cff2e", deep: "#2f7d0c" }),
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

const spriteCache = new Map();
function getSprites(palette) {
  if (!spriteCache.has(palette)) {
    spriteCache.set(
      palette,
      [palette.core, palette.mid, palette.deep].map(makeGlowSprite),
    );
  }
  return spriteCache.get(palette);
}

// The jaws open wide for a beat, slam shut, clamp with a shudder, then let go
// while the punctures linger.
const OPEN_DURATION = 0.1;
const CLOSE_DURATION = 0.09;
const CLAMP_DURATION = 0.14;
const WOUND_DURATION = 0.5;
const FANGS_PER_JAW = 4;

class JawSnapEffect {
  constructor(ctx, center, size, angle, palette) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.drops = [];
    this.particleScale = getParticleScale();
    this.palette = palette;
    this.sprites = getSprites(palette);

    // Jaws run along `axis` and close along `bite`.
    this.axis = angle;
    this.bite = angle + Math.PI / 2;
    this.span = size * 0.62;
    this.openGap = size * 0.34;
    this.fangLength = size * 0.1;
    this.width = Math.max(2.5, size * 0.022);

    // Fang positions along each jaw, with a small jitter so the bite looks
    // organic; the lower jaw is offset half a step so the teeth interlock.
    this.fangs = [0, 0.5].map((shift) =>
      Array.from({ length: FANGS_PER_JAW }, (_, i) => {
        const u = (i + 0.5 + shift - 0.25) / FANGS_PER_JAW - 0.5;
        return {
          u: u + (Math.random() - 0.5) * 0.03,
          // Outer fangs are the canines: longer than the ones between them.
          length: this.fangLength * (Math.abs(u) > 0.3 ? 1.35 : 0.8),
        };
      }),
    );

    this.snapped = false;
    this.lifetime =
      OPEN_DURATION + CLOSE_DURATION + CLAMP_DURATION + WOUND_DURATION;
  }

  // A point on a jaw line: u in [-0.5, 0.5] along the jaw, side is -1 (upper)
  // or 1 (lower), gap is how far that jaw sits from the bite line.
  jawPoint(u, side, gap) {
    const along = u * this.span;
    // Jaws bow away from the bite at their hinges, like a mouth seen head-on.
    const bow = this.span * 0.16 * (4 * u * u);
    const off = side * (gap + bow);
    return {
      x:
        this.center.x +
        Math.cos(this.axis) * along +
        Math.cos(this.bite) * off,
      y:
        this.center.y +
        Math.sin(this.axis) * along +
        Math.sin(this.bite) * off,
    };
  }

  currentGap() {
    const t = this.age;
    if (t < OPEN_DURATION) {
      return this.openGap * (0.7 + 0.3 * (t / OPEN_DURATION));
    }
    const c = t - OPEN_DURATION;
    if (c < CLOSE_DURATION) {
      const p = c / CLOSE_DURATION;
      return this.openGap * (1 - p * p * p);
    }
    return 0;
  }

  spawnDrops() {
    const count = Math.round(10 * this.particleScale);
    for (let i = 0; i < count; i++) {
      const jaw = this.fangs[i % 2];
      const fang = jaw[Math.floor(Math.random() * jaw.length)];
      const at = this.jawPoint(fang.u, i % 2 === 0 ? -1 : 1, 0);
      const dir =
        this.bite + (i % 2 === 0 ? Math.PI : 0) + (Math.random() - 0.5) * 1.1;
      const speed = 120 + Math.random() * 340;
      this.drops.push({
        x: at.x,
        y: at.y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.6,
        size: 4 + Math.random() * 9,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    const { ctx } = this;
    const closeEnd = OPEN_DURATION + CLOSE_DURATION;
    const clampEnd = closeEnd + CLAMP_DURATION;

    ctx.globalCompositeOperation = "lighter";

    if (this.age < clampEnd) {
      let gap = this.currentGap();
      let shake = 0;
      if (this.age >= closeEnd) {
        if (!this.snapped) {
          this.snapped = true;
          this.spawnDrops();
        }
        const k = 1 - (this.age - closeEnd) / CLAMP_DURATION;
        shake = Math.sin(this.age * 90) * this.size * 0.012 * k;
        gap = this.size * 0.01;
      }
      const intensity = Math.min(1, this.age / OPEN_DURATION + 0.35);
      this.drawJaws(gap, shake, intensity);
      if (this.snapped) {
        this.drawSnapFlash((this.age - closeEnd) / CLAMP_DURATION);
      }
    } else {
      this.drawPunctures((this.age - clampEnd) / WOUND_DURATION);
    }

    this.drawDrops(dt);
    ctx.globalCompositeOperation = "source-over";

    return this.age < this.lifetime;
  }

  drawJaws(gap, shake, intensity) {
    const { ctx } = this;
    const steps = 14;
    const sx = Math.cos(this.axis) * shake;
    const sy = Math.sin(this.axis) * shake;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const side of [-1, 1]) {
      for (const [mult, alpha, color] of [
        [3.2, 0.28, this.palette.deep],
        [1, 0.85, this.palette.mid],
        [0.35, 1, this.palette.core],
      ]) {
        ctx.globalAlpha = alpha * intensity;
        ctx.strokeStyle = color;
        ctx.lineWidth = this.width * mult;

        // The gum line.
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const pt = this.jawPoint(-0.5 + i / steps, side, gap);
          if (i === 0) ctx.moveTo(pt.x + sx, pt.y + sy);
          else ctx.lineTo(pt.x + sx, pt.y + sy);
        }
        ctx.stroke();

        // Fangs point from each jaw toward the bite line.
        ctx.beginPath();
        for (const fang of this.fangs[side === -1 ? 0 : 1]) {
          const base = this.jawPoint(fang.u, side, gap);
          const tipX = base.x - Math.cos(this.bite) * side * fang.length;
          const tipY = base.y - Math.sin(this.bite) * side * fang.length;
          ctx.moveTo(base.x + sx, base.y + sy);
          ctx.lineTo(tipX + sx, tipY + sy);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawSnapFlash(p) {
    const { ctx } = this;
    const k = Math.max(0, 1 - p);
    const size = this.span * (0.9 + p * 0.5);
    ctx.globalAlpha = 0.6 * k;
    ctx.drawImage(
      this.sprites[1],
      this.center.x - size / 2,
      this.center.y - size / 2,
      size,
      size,
    );
    ctx.globalAlpha = 1;
  }

  // Where each fang sank in, a small glowing puncture fades out.
  drawPunctures(e) {
    const { ctx } = this;
    const fade = Math.pow(1 - e, 1.5);
    if (fade <= 0.01) return;

    for (const [index, side] of [
      [0, -1],
      [1, 1],
    ]) {
      for (const fang of this.fangs[index]) {
        const base = this.jawPoint(fang.u, side, 0);
        const size = this.width * 5 * (0.6 + fade * 0.4);
        ctx.globalAlpha = fade;
        ctx.drawImage(
          this.sprites[0],
          base.x - size / 2,
          base.y - size / 2,
          size,
          size,
        );
      }
    }
    ctx.globalAlpha = 1;
  }

  drawDrops(dt) {
    const { ctx } = this;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.drops.splice(i, 1);
        continue;
      }
      d.vx *= 0.92;
      d.vy = d.vy * 0.92 + 900 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;

      const k = d.life / d.maxLife;
      const size = d.size * (0.3 + k * 0.7);
      ctx.globalAlpha = k;
      ctx.drawImage(d.sprite, d.x - size / 2, d.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }
}

const PADDING_SCALE = 1.1;
const PADDING_FLOOR = 300;

export function createBite(palette = BITE_PALETTES.feral) {
  return async function playBite({ userEl, targetEl }) {
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    const size = Math.max(rect.width, rect.height);

    // Jaws lie across the approach, tilted slightly toward the attacker.
    let angle = 0;
    if (userEl) {
      const u = getElementCenter(userEl);
      angle = Math.atan2(center.y - u.y, center.x - u.x) * 0.25;
    }

    targetEl.classList.add("slash-hit");
    setTimeout(() => targetEl.classList.remove("slash-hit"), 380);

    const box = computeEffectBox([center], size * PADDING_SCALE + PADDING_FLOOR);
    await runSoloEffect(
      box,
      (ctx) => new JawSnapEffect(ctx, center, size, angle, palette),
    );
  };
}
