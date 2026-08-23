// ============================================================
//  Slash Animation
//
//  Authorial motif for skills that read as a cut, opted into with
//  `hitVfx: "slash"` on the skill. Unlike the element projectiles,
//  the effect happens ON the target: blades sweep through it, the
//  wound holds for a beat, then opens apart.
// ============================================================

import { getElementCenter } from "./animationUtils.js";

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

const SPARK_SPRITES = [
  makeGlowSprite("rgba(255,255,255,1)"),
  makeGlowSprite("rgba(214,240,255,1)"),
  makeGlowSprite("rgba(150,200,255,1)"),
];

// Each blade sweeps fast, then its wound lingers and opens.
const SWEEP_DURATION = 0.14;
const WOUND_DURATION = 0.5;
const STAGGER = 0.07;
// The wound only splits apart once the blade has fully passed through.
const SPLIT_DELAY = 0.1;

export class SlashEffect {
  constructor(ctx, center, size, baseAngle) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.sparks = [];

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
  }

  spawnSparks(blade) {
    const dirX = Math.cos(blade.angle);
    const dirY = Math.sin(blade.angle);

    for (let i = 0; i < 14; i++) {
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
        sprite: SPARK_SPRITES[i % SPARK_SPRITES.length],
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

    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, "rgba(120,190,255,0)");
    grad.addColorStop(0.6, "rgba(190,225,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,1)");

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
      SPARK_SPRITES[0],
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

    ctx.strokeStyle = "#ffffff";
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

export async function playSlash({ userEl, targetEl }) {
  if (!targetEl) return;

  const canvas = document.createElement("canvas");
  // Capped ratio: the effect is all soft glows, so extra pixels buy nothing.
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const rect = targetEl.getBoundingClientRect();
  const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

  // Blades fan around the attack direction, so the swing comes from the user.
  let baseAngle = 0;
  if (userEl) {
    const userCenter = getElementCenter(userEl);
    baseAngle = Math.atan2(center.y - userCenter.y, center.x - userCenter.x);
  }

  const effect = new SlashEffect(
    ctx,
    center,
    Math.max(rect.width, rect.height),
    baseAngle,
  );
  let last = performance.now();

  targetEl.classList.add("slash-hit");
  setTimeout(() => targetEl.classList.remove("slash-hit"), 380);

  await new Promise((resolve) => {
    function frame(now) {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      if (!effect.step(dt)) {
        canvas.remove();
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  });
}
