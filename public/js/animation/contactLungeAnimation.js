// ============================================================
//  Contact Lunge Animation
//
//  Last-resort default for a contact hit whose skill registers no
//  animation and names no motif: the attacker's portrait winds up,
//  drives at the target until the two almost touch, and snaps back.
// ============================================================

import { computeEffectBox, runSoloEffect } from "./animationUtils.js";
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

// Steel, the same elementless physical tone slashAnimation uses: this default
// depicts the body blow itself, never the element behind it.
const COLORS = Object.freeze({
  core: "#ffffff",
  mid: "#d6f0ff",
  deep: "#78beff",
});

let sprites = null;

function getSprites() {
  if (!sprites) {
    sprites = [COLORS.core, COLORS.mid, COLORS.deep].map(makeGlowSprite);
  }
  return sprites;
}

const FLASH_DURATION = 0.13;
const RING_DURATION = 0.32;
const BURST_LIFETIME = 0.46;
const MAX_SHARDS = 18;

class ImpactBurst {
  constructor(ctx, center, size, angle) {
    this.ctx = ctx;
    this.center = center;
    this.size = size;
    this.age = 0;
    this.sprites = getSprites();
    this.shards = [];

    const count = Math.min(MAX_SHARDS, Math.round(16 * getParticleScale()));
    for (let i = 0; i < count; i++) {
      const spray = angle + (Math.random() - 0.5) * 2.2;
      const speed = 180 + Math.random() * 520;
      this.shards.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(spray) * speed,
        vy: Math.sin(spray) * speed,
        life: 0.18 + Math.random() * 0.26,
        maxLife: 0.44,
        size: 6 + Math.random() * 13,
        sprite: this.sprites[i % this.sprites.length],
      });
    }
  }

  step(dt) {
    this.age += dt;
    this.ctx.globalCompositeOperation = "lighter";
    this.drawFlash();
    this.drawRing();
    this.drawShards(dt);
    this.ctx.globalCompositeOperation = "source-over";
    return this.age < BURST_LIFETIME;
  }

  drawFlash() {
    const k = 1 - this.age / FLASH_DURATION;
    if (k <= 0) return;

    const { ctx } = this;
    const r = this.size * (0.3 + (1 - k) * 0.42);
    ctx.globalAlpha = k;
    ctx.drawImage(
      this.sprites[0],
      this.center.x - r,
      this.center.y - r,
      r * 2,
      r * 2,
    );
    ctx.globalAlpha = 1;
  }

  drawRing() {
    const t = this.age / RING_DURATION;
    if (t >= 1) return;

    const { ctx } = this;
    const eased = 1 - (1 - t) ** 3;
    const r = this.size * (0.1 + eased * 0.6);
    ctx.globalAlpha = (1 - t) ** 1.6;
    ctx.strokeStyle = COLORS.mid;
    ctx.lineWidth = Math.max(0.6, 5 * (1 - t));
    ctx.beginPath();
    ctx.arc(this.center.x, this.center.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawShards(dt) {
    const { ctx } = this;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const p = this.shards[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.shards.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 + 700 * dt;
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

const WINDUP_MS = 130;
const STRIKE_MS = 110;
const HOLD_MS = 45;
const RETURN_MS = 270;
const TOTAL_MS = WINDUP_MS + STRIKE_MS + HOLD_MS + RETURN_MS;

const NEAR_MISS_GAP = 10;
const MAX_WINDUP_PX = 26;
const BURST_PADDING = 150;

const lunging = new WeakSet();

// How far a rect's edge sits from its centre along the strike axis.
function edgeRadius(rect, angle) {
  return (
    Math.abs(Math.cos(angle)) * rect.width * 0.5 +
    Math.abs(Math.sin(angle)) * rect.height * 0.5
  );
}

export async function playContactLunge({ userEl, targetEl, canvasBatch }) {
  if (!userEl || !targetEl || userEl === targetEl) return;

  const userWrapper = userEl.querySelector(".portrait-wrapper");
  const targetWrapper = targetEl.querySelector(".portrait-wrapper");
  if (!userWrapper || !targetWrapper) return;

  const from = userWrapper.getBoundingClientRect();
  const to = targetWrapper.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return;

  const angle = Math.atan2(dy, dx);
  const dirX = dx / distance;
  const dirY = dy / distance;
  const reach = edgeRadius(from, angle);
  const travel = Math.max(
    0,
    distance - reach - edgeRadius(to, angle) - NEAR_MISS_GAP,
  );
  const contactPoint = {
    x: from.left + from.width / 2 + dirX * (travel + reach),
    y: from.top + from.height / 2 + dirY * (travel + reach),
  };
  const burstSize = Math.max(to.width, to.height);

  function playBurst() {
    const build = (ctx) =>
      new ImpactBurst(ctx, contactPoint, burstSize, angle);
    if (canvasBatch) {
      return canvasBatch.run([contactPoint], BURST_PADDING, build);
    }
    return runSoloEffect(
      computeEffectBox([contactPoint], BURST_PADDING),
      build,
    );
  }

  // An attacker already mid-lunge — an AoE's later targets — only gets struck.
  if (lunging.has(userEl)) {
    await playBurst();
    return;
  }
  lunging.add(userEl);

  const stage = document.createElement("div");
  stage.className = "champion";
  if (userEl.dataset.entityType) {
    stage.dataset.entityType = userEl.dataset.entityType;
  }
  stage.style.cssText = `position:fixed;left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px;margin:0;padding:0;pointer-events:none;transition:none;z-index:998;will-change:transform`;
  stage.appendChild(userWrapper.cloneNode(true));
  document.body.appendChild(stage);
  userWrapper.style.opacity = "0";

  const pull = Math.min(travel * 0.14, MAX_WINDUP_PX);
  const at = (ms) => ms / TOTAL_MS;
  const strike = `translate(${dirX * travel}px, ${dirY * travel}px)`;

  const animation = stage.animate(
    [
      {
        offset: 0,
        transform: "translate(0px, 0px) scale(1)",
        easing: "cubic-bezier(0.35, 0, 0.2, 1)",
      },
      {
        offset: at(WINDUP_MS),
        transform: `translate(${-dirX * pull}px, ${-dirY * pull}px) scale(0.94)`,
        easing: "cubic-bezier(0.8, 0, 0.9, 0.25)",
      },
      {
        offset: at(WINDUP_MS + STRIKE_MS),
        transform: `${strike} scale(1.1)`,
        easing: "linear",
      },
      {
        offset: at(WINDUP_MS + STRIKE_MS + HOLD_MS),
        transform: `${strike} scale(1.06)`,
        easing: "cubic-bezier(0.25, 0.9, 0.3, 1)",
      },
      { offset: 1, transform: "translate(0px, 0px) scale(1)" },
    ],
    { duration: TOTAL_MS },
  );

  animation.finished.then(() => {
    stage.remove();
    userWrapper.style.opacity = "";
    lunging.delete(userEl);
  });

  await new Promise((resolve) =>
    setTimeout(resolve, WINDUP_MS + STRIKE_MS),
  );
  // Left running so the target's own shake lands on the frame of contact.
  playBurst();
}
