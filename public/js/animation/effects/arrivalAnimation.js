// ============================================================
//  Arrival Animation
//
//  The counterpart of the unmaking: played over a champion on the
//  frame it reaches the field. Every motif gathers its motes INTO
//  the figure instead of scattering them, so an entrance can never
//  be mistaken for an exit, and each one keeps its own shape,
//  movement and length.
// ============================================================

import { computeEffectBox, runSoloEffect } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";

const SPRITE_SIZE = 48;
const PADDING = 42;

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

// Each motif says how long it lasts, how many motes it can afford, where they
// come from and what line, if any, marks the moment the figure takes hold.
const MOTIFS = Object.freeze({
  // Anything the soil raises: it is pushed up out of the ground.
  earth_summon: {
    palette: { core: "#f3e2bd", mid: "#b5843f", deep: "#4e3a1f" },
    duration: 0.9,
    budget: 44,
    edge: "hem",
    spawn(rect) {
      const x = rect.left + Math.random() * rect.width;
      return {
        sx: x + (Math.random() - 0.5) * rect.width * 0.22,
        sy: rect.bottom + 8 + Math.random() * 34,
        tx: x,
        ty: rect.top + rect.height * (0.18 + Math.random() * 0.8),
        maxLife: 0.42 + Math.random() * 0.26,
        size: 9 + Math.random() * 11,
      };
    },
  },

  // Jeff coming back: quick and direct, a close breath of ash pulled together.
  death_revival: {
    palette: { core: "#fbfaf4", mid: "#d9cfae", deep: "#6b5f43" },
    duration: 0.52,
    budget: 30,
    edge: null,
    spawn(rect) {
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.max(rect.width, rect.height) * (0.5 + Math.random() * 0.3);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height * 0.45;
      return {
        sx: cx + Math.cos(angle) * reach,
        sy: cy + Math.sin(angle) * reach * 0.8,
        tx: cx + (Math.random() - 0.5) * rect.width * 0.35,
        ty: cy + (Math.random() - 0.5) * rect.height * 0.3,
        maxLife: 0.2 + Math.random() * 0.14,
        size: 6 + Math.random() * 8,
      };
    },
  },

  // Coming back out of the Nothingness: the figure is written back in from
  // the top down, the way it was erased from the hem up.
  nothingness_return: {
    palette: { core: "#f2eaff", mid: "#7a6fd0", deep: "#241a4a" },
    duration: 0.95,
    budget: 46,
    edge: "down",
    spawn(rect) {
      const tx = rect.left + Math.random() * rect.width;
      const ty = rect.top + Math.random() * rect.height;
      const angle = Math.random() * Math.PI * 2;
      const reach = 34 + Math.random() * 46;
      return {
        sx: tx + Math.cos(angle) * reach,
        sy: ty + Math.sin(angle) * reach,
        tx,
        ty,
        maxLife: 0.38 + Math.random() * 0.22,
        size: 7 + Math.random() * 10,
      };
    },
  },

  // Laisaelis's Echo: the answer arrives from above, warm and already spoken.
  echo_answer: {
    palette: { core: "#ffffff", mid: "#fff2c9", deep: "#ffcf72" },
    duration: 0.8,
    budget: 40,
    edge: null,
    spawn(rect) {
      const tx = rect.left + Math.random() * rect.width;
      return {
        sx: tx + (Math.random() - 0.5) * rect.width * 0.3,
        sy: rect.top - 10 - Math.random() * 40,
        tx,
        ty: rect.top + Math.random() * rect.height,
        maxLife: 0.36 + Math.random() * 0.24,
        size: 7 + Math.random() * 9,
      };
    },
  },

  // Silas's mirage: it peels off him sideways, the copy stepping out of the man.
  mirage_split: {
    palette: { core: "#efe4ff", mid: "#9a63e8", deep: "#3d1a6b" },
    duration: 0.72,
    budget: 38,
    edge: null,
    spawn(rect) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const ty = rect.top + Math.random() * rect.height;
      return {
        sx: rect.left + rect.width / 2 + side * (rect.width * 0.7 + Math.random() * 30),
        sy: ty + (Math.random() - 0.5) * 14,
        tx: rect.left + rect.width * (0.2 + Math.random() * 0.6),
        ty,
        maxLife: 0.3 + Math.random() * 0.2,
        size: 7 + Math.random() * 9,
      };
    },
  },
});

export const ARRIVAL_MOTIF_KEYS = Object.keys(MOTIFS);

/**
 * How the card itself should be revealed under the motes: along the same edge
 * they gather on, and slightly ahead of them so the figure is whole by the
 * time the last one lands.
 */
export function getArrivalReveal(motifKey) {
  const motif = MOTIFS[motifKey];
  if (!motif) return null;

  return {
    durationMs: Math.round(motif.duration * 850),
    edge: motif.edge ?? "fade",
  };
}

// Pre-rendered once per motif and reused from then on.
const spriteCache = new Map();

function getSprites(motifKey) {
  let sprites = spriteCache.get(motifKey);
  if (!sprites) {
    const { core, mid, deep } = MOTIFS[motifKey].palette;
    sprites = [core, mid, deep].map(makeGlowSprite);
    spriteCache.set(motifKey, sprites);
  }
  return sprites;
}

class ArrivalEffect {
  constructor(ctx, rect, motifKey) {
    this.ctx = ctx;
    this.rect = rect;
    this.motif = MOTIFS[motifKey];
    this.sprites = getSprites(motifKey);
    this.age = 0;
    this.motes = [];
    this.released = 0;
    this.budget = Math.round(this.motif.budget * getParticleScale());
  }

  release(count) {
    for (let i = 0; i < count; i++) {
      const mote = this.motif.spawn(this.rect);
      mote.x = mote.sx;
      mote.y = mote.sy;
      mote.life = 0;
      mote.sprite = this.sprites[i % this.sprites.length];
      this.motes.push(mote);
      this.released++;
    }
  }

  step(dt) {
    this.age += dt;

    const { ctx, motif } = this;
    // They are all on their way in well before the figure settles.
    const gather = Math.min(this.age / (motif.duration * 0.55), 1);

    if (this.released < this.budget) {
      const due = Math.ceil(gather * this.budget) - this.released;
      if (due > 0) this.release(Math.min(due, this.budget - this.released));
    }

    ctx.globalCompositeOperation = "lighter";

    if (motif.edge) this.drawEdge(gather);
    this.drawMotes(dt);

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    return this.age < motif.duration || this.motes.length > 0;
  }

  // The line the figure takes hold along: at the hem for what the soil pushes
  // up, sweeping downward for what is written back in.
  drawEdge(gather) {
    const { ctx, rect } = this;
    const edgeY =
      this.motif.edge === "hem"
        ? rect.bottom
        : rect.top + gather * rect.height;
    const spread = this.motif.edge === "hem" ? gather : 1;
    const inset = rect.width * (0.3 - 0.24 * spread);
    const alpha = 1 - gather * 0.65;

    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = this.motif.palette.core;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(rect.left + inset, edgeY);
    ctx.lineTo(rect.right - inset, edgeY);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = this.motif.palette.mid;
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

      // Slow to leave, fast to land: the motes are drawn in, not thrown.
      const travel = mote.life / mote.maxLife;
      const eased = travel * travel;
      mote.x = mote.sx + (mote.tx - mote.sx) * eased;
      mote.y = mote.sy + (mote.ty - mote.sy) * eased;

      const size = mote.size * (1 - travel * 0.5);

      ctx.globalAlpha = Math.min(1, travel / 0.2) * (1 - travel) ** 0.7;
      ctx.drawImage(mote.sprite, mote.x - size / 2, mote.y - size / 2, size, size);
    }
  }
}

/** Plays the entrance over `el` and resolves when the last mote has landed. */
export async function playArrivalEffect(el, motifKey) {
  if (!MOTIFS[motifKey]) return;

  const rect = el.getBoundingClientRect();
  const box = computeEffectBox(
    [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.bottom },
    ],
    PADDING,
  );

  await runSoloEffect(box, (ctx) => new ArrivalEffect(ctx, rect, motifKey));
}
