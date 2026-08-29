const SPRITE_SIZE = 64;
const SPRITE_HALF = SPRITE_SIZE / 2;
const DROPLET_COUNT = 14;
const TRAIL_GHOSTS = 2;
const BOX_PADDING = 90;
const MAX_DPR = 1.5;
const RING_LIFE = 420;

let sprites = null;

// Both sprites are painted once and reused as textures, so no gradient is
// ever built inside the animation loop.
function getSprites() {
  if (sprites) return sprites;

  const droplet = document.createElement("canvas");
  droplet.width = droplet.height = SPRITE_SIZE;
  const d = droplet.getContext("2d");

  const halo = d.createRadialGradient(
    SPRITE_HALF,
    SPRITE_HALF,
    3,
    SPRITE_HALF,
    SPRITE_HALF,
    SPRITE_HALF,
  );
  halo.addColorStop(0, "rgba(255, 58, 92, 0.4)");
  halo.addColorStop(0.45, "rgba(206, 18, 50, 0.15)");
  halo.addColorStop(1, "rgba(140, 0, 28, 0)");
  d.fillStyle = halo;
  d.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  const body = d.createRadialGradient(25, 23, 1, SPRITE_HALF, SPRITE_HALF, 21);
  body.addColorStop(0, "rgba(255, 238, 240, 0.95)");
  body.addColorStop(0.16, "rgba(255, 136, 150, 0.97)");
  body.addColorStop(0.44, "rgba(216, 24, 58, 0.97)");
  body.addColorStop(0.82, "rgba(118, 6, 26, 0.92)");
  body.addColorStop(1, "rgba(84, 0, 18, 0)");
  d.fillStyle = body;
  d.beginPath();
  d.arc(SPRITE_HALF, SPRITE_HALF, 21, 0, Math.PI * 2);
  d.fill();

  const vital = document.createElement("canvas");
  vital.width = vital.height = SPRITE_SIZE;
  const v = vital.getContext("2d");
  const bloom = v.createRadialGradient(
    SPRITE_HALF,
    SPRITE_HALF,
    0,
    SPRITE_HALF,
    SPRITE_HALF,
    SPRITE_HALF,
  );
  bloom.addColorStop(0, "rgba(214, 255, 232, 0.85)");
  bloom.addColorStop(0.3, "rgba(104, 255, 164, 0.45)");
  bloom.addColorStop(0.7, "rgba(40, 200, 120, 0.14)");
  bloom.addColorStop(1, "rgba(20, 140, 90, 0)");
  v.fillStyle = bloom;
  v.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  sprites = { droplet, vital };
  return sprites;
}

function getElementCenter(el) {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function quadraticPoint(p0, p1, p2, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
    y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y,
  };
}

// Fill-rate is what stalls weak GPUs, so the canvas only covers the arc's
// convex hull instead of the whole viewport.
function computeBox(points, padding) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.max(0, Math.min(...xs) - padding);
  const y = Math.max(0, Math.min(...ys) - padding);
  const right = Math.min(window.innerWidth, Math.max(...xs) + padding);
  const bottom = Math.min(window.innerHeight, Math.max(...ys) + padding);
  return {
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function drawSprite(ctx, sprite, x, y, radius, alpha, angle, stretch) {
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(
    sprite,
    -radius * stretch,
    -radius,
    radius * 2 * stretch,
    radius * 2,
  );
  ctx.restore();
}

export function playLifestealTransferVFX({ fromEl, toEl, duration = 780 } = {}) {
  if (!fromEl || !toEl) return Promise.resolve();

  const { droplet, vital } = getSprites();
  const from = getElementCenter(fromEl);
  const to = getElementCenter(toEl);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const arch = Math.min(120, Math.max(38, dist * 0.2));
  const ctrl = {
    x: (from.x + to.x) / 2 + nx * arch,
    y: (from.y + to.y) / 2 + ny * arch,
  };

  const box = computeBox([from, ctrl, to], BOX_PADDING);
  const canvas = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  canvas.className = "vfx-lifesteal-transfer";
  canvas.width = box.width * dpr;
  canvas.height = box.height * dpr;
  canvas.style.cssText = `position:fixed;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;pointer-events:none;z-index:1300`;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, -box.x * dpr, -box.y * dpr);

  const droplets = Array.from({ length: DROPLET_COUNT }, (_, i) => ({
    delay: (i / DROPLET_COUNT) * 0.34 + Math.random() * 0.04,
    travel: 0.4 + Math.random() * 0.14,
    size: 3.6 + Math.random() * 3,
    lateral: (Math.random() * 2 - 1) * 26,
    wobble: Math.random() * Math.PI * 2,
    absorbed: false,
  }));

  const rings = [];
  const startAt = performance.now();
  let rafId = null;

  return new Promise((resolve) => {
    function cleanup() {
      cancelAnimationFrame(rafId);
      canvas.remove();
      resolve();
    }

    function drawDroplet(d, local, alpha, radius) {
      const p = local * (0.58 + 0.42 * local);
      const point = quadraticPoint(from, ctrl, to, p);
      const spread = Math.sin(local * Math.PI);
      const off = (d.lateral + Math.sin(local * 7 + d.wobble) * 5) * spread;
      const tx = 2 * (1 - p) * (ctrl.x - from.x) + 2 * p * (to.x - ctrl.x);
      const ty = 2 * (1 - p) * (ctrl.y - from.y) + 2 * p * (to.y - ctrl.y);

      drawSprite(
        ctx,
        droplet,
        point.x + nx * off,
        point.y + ny * off,
        radius,
        alpha,
        Math.atan2(ty, tx),
        1.28,
      );
    }

    function frame(now) {
      const elapsed = now - startAt;
      const t = Math.min(1, elapsed / duration);

      ctx.clearRect(box.x, box.y, box.width, box.height);
      ctx.globalCompositeOperation = "source-over";

      const wound = Math.max(0, 1 - t / 0.32);
      if (wound > 0) {
        const radius = 15 + wound * 12;
        drawSprite(ctx, droplet, from.x, from.y, radius, wound * 0.6, 0, 1);
      }

      let absorbedCount = 0;

      for (const d of droplets) {
        const local = (elapsed / duration - d.delay) / d.travel;
        if (local <= 0) continue;

        if (local >= 1) {
          absorbedCount++;
          if (!d.absorbed) {
            d.absorbed = true;
            rings.push(now);
          }
          continue;
        }

        const fade = Math.min(1, local * 8) * Math.min(1, (1 - local) / 0.14);
        const grow = 0.55 + Math.min(1, local * 5) * 0.45;

        for (let k = TRAIL_GHOSTS; k >= 1; k--) {
          const ghost = local - k * 0.045;
          if (ghost > 0) {
            drawDroplet(d, ghost, fade * (0.3 / k), d.size * grow * (0.75 / k));
          }
        }
        drawDroplet(d, local, fade, d.size * grow);
      }

      ctx.globalCompositeOperation = "lighter";

      const intake = absorbedCount / DROPLET_COUNT;
      if (intake > 0) {
        drawSprite(
          ctx,
          vital,
          to.x,
          to.y,
          20 + intake * 26,
          (0.12 + intake * 0.4) * (t > 0.9 ? (1 - t) * 10 : 1),
          0,
          1,
        );
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const age = (now - rings[i]) / RING_LIFE;
        if (age >= 1) {
          rings.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = (1 - age) * 0.5;
        ctx.strokeStyle = "rgba(126, 255, 178, 1)";
        ctx.lineWidth = 0.6 + (1 - age) * 2;
        ctx.beginPath();
        ctx.arc(to.x, to.y, 6 + age * 38, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;

      if (t >= 1) {
        cleanup();
        return;
      }

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
  });
}
