const SHIELD_PALETTES = {
  regular: {
    grid: "rgba(80, 210, 255, 0.25)",
    glowInner: "rgba(120,200,255,0.15)",
    glowOuter: "rgba(0,120,255,0.6)",
    ring: "rgba(80, 220, 255, 0.9)",
    arc: "rgba(80, 220, 255, 0.9)",
  },
  spell: {
    grid: "rgba(170, 110, 255, 0.26)",
    glowInner: "rgba(118, 54, 168, 0.2)",
    glowOuter: "rgba(56, 10, 92, 0.72)",
    ring: "rgba(184, 108, 255, 0.92)",
    arc: "rgba(133, 54, 214, 0.95)",
  },
  blood: {
    grid: "rgba(255, 40, 40, 0.22)",
    glowInner: "rgba(255, 20, 20, 0.14)",
    glowOuter: "rgba(110, 0, 0, 0.72)",
    ring: "rgba(255, 60, 60, 0.92)",
    arc: "rgba(180, 20, 20, 0.96)",
  },
  fire: {
    grid: "rgba(255, 150, 40, 0.24)",
    glowInner: "rgba(255, 120, 30, 0.16)",
    glowOuter: "rgba(120, 30, 0, 0.7)",
    ring: "rgba(255, 170, 60, 0.94)",
    arc: "rgba(255, 90, 20, 0.96)",
  },
  venom: {
    grid: "rgba(150, 255, 60, 0.24)",
    glowInner: "rgba(140, 240, 50, 0.15)",
    glowOuter: "rgba(24, 90, 10, 0.72)",
    ring: "rgba(170, 255, 80, 0.93)",
    arc: "rgba(90, 200, 20, 0.96)",
  },
  supreme: {
    grid: "rgba(255, 220, 100, 0.26)",
    glowInner: "rgba(255, 215, 80, 0.16)",
    glowOuter: "rgba(180, 105, 0, 0.68)",
    ring: "rgba(255, 220, 90, 0.95)",
    arc: "rgba(255, 190, 40, 0.98)",
  },
};

// The shield is a glass bubble that hugs the oval portrait. Every static layer
// (inner spill, lattice, specular crescent) is baked once into an offscreen
// sprite; the frame loop only blits sprites and strokes a few arcs, so the
// cost stays flat no matter how many shields are alive.
const SHIELD_STYLE = {
  maxPixelRatio: 1.5, // the canvas is tiny, but the stage can be scaled up
  // The rim sits on the wrapper's own white frame so the frame reads as energised.
  rimInset: 1.5,
  rimWidth: 3.5,
  innerRimInset: 7,
  innerRimWidth: 1.2,
  innerRimAlpha: 0.4,
  // Radial spill, in units of the ellipse radius (0 = centre, 1 = rim).
  spillClearUntil: 0.5,
  spillMidStop: 0.8,
  spillMidAlpha: 0.55, // fraction of the palette's outer alpha at spillMidStop
  fresnelStop: 0.93,
  fresnelAlpha: 0.38,
  // Lattice
  hexSize: 11,
  latticeFadeStart: 0.45,
  latticeBaseAlpha: 0.55,
  latticeSweepAlpha: 0.7,
  // Specular crescent (upper-left glass reflection)
  glintAlpha: 0.5,
  // Light sweep that flares the lattice
  sweepPeriod: 3.4,
  sweepDuration: 1.0,
  sweepSlant: 0.35,
  sweepWidth: 0.34,
  sweepGlowAlpha: 0.22,
  // Energy runner travelling along the rim
  runnerSpeed: 1.5, // radians per second
  runnerLength: 1.1,
  runnerSteps: 9,
  runnerWidth: 3,
  // Breathing, entrance and the one-off ripple
  breathSpeed: 2,
  breathDepth: 0.12,
  appearDuration: 0.4,
  appearScaleFrom: 0.94,
  rippleDuration: 0.6,
  rippleStartScale: 0.72,
  rippleAlpha: 0.8,
  maxFrameDelta: 1 / 30,
  // The canvas bleeds this far past the portrait wrapper (see .vfx-canvas).
  fallbackBleed: 40,
  // Smallest half-axis the layers can be drawn at (inner rim + glint echo fit).
  minRadius: 16,
};

const RGBA_PATTERN =
  /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/;

function parseColor(color) {
  const match = RGBA_PATTERN.exec(color);
  if (!match) return { r: 255, g: 255, b: 255, a: 1 };
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: match[4] === undefined ? 1 : Number(match[4]),
  };
}

function rgba({ r, g, b }, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeLayer(width, height) {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  return layer;
}

export function startShield(canvas, data = {}) {
  const ctx = canvas.getContext("2d");
  const palette = SHIELD_PALETTES[data.variant] || SHIELD_PALETTES.regular;
  const style = SHIELD_STYLE;
  const colors = {
    grid: parseColor(palette.grid),
    inner: parseColor(palette.glowInner),
    outer: parseColor(palette.glowOuter),
    ring: parseColor(palette.ring),
    arc: parseColor(palette.arc),
  };

  let running = true;
  let rafId = 0;
  let elapsed = 0;
  let lastStamp = 0;

  // Geometry in CSS pixels; the contexts are pre-scaled by `pixelRatio`.
  let width = 0;
  let height = 0;
  let cx = 0;
  let cy = 0;
  let rx = 0;
  let ry = 0;
  let pixelRatio = 1;
  let spriteSpill = null;
  let spriteLattice = null;
  let spriteGlint = null;

  // Runs `draw` in a unit space where the shield ellipse is the unit circle.
  function inEllipse(target, draw) {
    target.save();
    target.translate(cx, cy);
    target.scale(rx, ry);
    draw(target);
    target.restore();
  }

  function ellipsePath(target, inset) {
    target.beginPath();
    target.ellipse(cx, cy, rx - inset, ry - inset, 0, 0, Math.PI * 2);
  }

  function newSprite() {
    const layer = makeLayer(canvas.width, canvas.height);
    const g = layer.getContext("2d");
    g.scale(pixelRatio, pixelRatio);
    return { layer, g };
  }

  function bakeSpill() {
    const { layer, g } = newSprite();
    inEllipse(g, (t) => {
      const grad = t.createRadialGradient(0, 0, 0, 0, 0, 1);
      grad.addColorStop(0, rgba(colors.inner, 0));
      grad.addColorStop(
        style.spillClearUntil,
        rgba(colors.inner, colors.inner.a * 0.5),
      );
      grad.addColorStop(
        style.spillMidStop,
        rgba(colors.outer, colors.outer.a * style.spillMidAlpha),
      );
      grad.addColorStop(style.fresnelStop, rgba(colors.outer, colors.outer.a));
      grad.addColorStop(1, rgba(colors.ring, style.fresnelAlpha));
      t.fillStyle = grad;
      t.beginPath();
      t.arc(0, 0, 1, 0, Math.PI * 2);
      t.fill();
    });
    return layer;
  }

  function bakeLattice() {
    const { layer, g } = newSprite();
    g.save();
    ellipsePath(g, style.rimInset);
    g.clip();
    g.strokeStyle = rgba(colors.grid, Math.min(1, colors.grid.a * 2.2));
    g.lineWidth = 1;
    const size = style.hexSize;
    const stepX = size * 1.5;
    const stepY = Math.sqrt(3) * size;
    const cols = Math.ceil(rx / stepX);
    const rows = Math.ceil(ry / stepY);
    for (let col = -cols; col <= cols; col++) {
      const x = cx + col * stepX;
      const yOffset = Math.abs(col) % 2 === 1 ? stepY / 2 : 0;
      for (let row = -rows; row <= rows; row++) {
        const y = cy + row * stepY + yOffset;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const angle = (Math.PI / 3) * k;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          if (k === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.stroke();
      }
    }
    g.restore();
    // Keep the lattice on the rim only: the middle stays clear for the art.
    g.globalCompositeOperation = "destination-in";
    inEllipse(g, (t) => {
      const mask = t.createRadialGradient(0, 0, 0, 0, 0, 1);
      mask.addColorStop(style.latticeFadeStart, "rgba(0, 0, 0, 0)");
      mask.addColorStop(0.97, "rgba(0, 0, 0, 1)");
      t.fillStyle = mask;
      t.beginPath();
      t.arc(0, 0, 1, 0, Math.PI * 2);
      t.fill();
    });
    return layer;
  }

  function bakeGlint() {
    const { layer, g } = newSprite();
    // A thin crescent hugging the upper-left rim, like light on curved glass.
    g.lineCap = "round";
    g.strokeStyle = `rgba(255, 255, 255, ${style.glintAlpha})`;
    g.lineWidth = 2.2;
    g.beginPath();
    g.ellipse(
      cx,
      cy,
      rx - style.innerRimInset,
      ry - style.innerRimInset,
      0,
      Math.PI * 1.08,
      Math.PI * 1.42,
    );
    g.stroke();
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(
      cx,
      cy,
      rx - style.innerRimInset - 5,
      ry - style.innerRimInset - 5,
      0,
      Math.PI * 1.14,
      Math.PI * 1.3,
    );
    g.stroke();
    return layer;
  }

  function resize() {
    const cssWidth = canvas.offsetWidth;
    const cssHeight = canvas.offsetHeight;
    if (!cssWidth || !cssHeight) return;
    // The canvas bleeds past the portrait wrapper; the shield is the wrapper's oval.
    // While the layout settles the wrapper can measure 0 and leave only the bleed:
    // a negative ellipse radius throws, so wait for a real size instead.
    const host = canvas.parentElement;
    const nextRx = (host?.offsetWidth || cssWidth - style.fallbackBleed) / 2;
    const nextRy = (host?.offsetHeight || cssHeight - style.fallbackBleed) / 2;
    if (nextRx < style.minRadius || nextRy < style.minRadius) return;
    const rect = canvas.getBoundingClientRect();
    const stageScale = rect.width ? rect.width / cssWidth : 1;
    pixelRatio = Math.min(
      style.maxPixelRatio,
      Math.max(1, stageScale * (window.devicePixelRatio || 1)),
    );
    canvas.width = Math.round(cssWidth * pixelRatio);
    canvas.height = Math.round(cssHeight * pixelRatio);
    width = cssWidth;
    height = cssHeight;
    cx = width / 2;
    cy = height / 2;
    rx = nextRx;
    ry = nextRy;
    spriteSpill = bakeSpill();
    spriteLattice = bakeLattice();
    spriteGlint = bakeGlint();
  }

  // startShield runs inside the state sync: a decorative layer must never throw
  // there, or the cards stop rendering. render() retries the bake each frame.
  function safeResize() {
    try {
      resize();
    } catch (err) {
      spriteSpill = null;
      console.warn("[shield] bake failed, will retry:", err);
    }
  }

  safeResize();
  window.addEventListener("resize", safeResize);

  function drawSweep(phase) {
    // Parallelogram band travelling left to right across the bubble.
    const slant = ry * style.sweepSlant;
    const bandWidth = rx * 2 * style.sweepWidth;
    const span = rx * 2 + slant * 2 + bandWidth;
    const lead = cx - rx - slant - bandWidth + phase * span;
    ctx.save();
    ellipsePath(ctx, style.rimInset);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createLinearGradient(lead, 0, lead + bandWidth, 0);
    grad.addColorStop(0, rgba(colors.ring, 0));
    grad.addColorStop(0.5, rgba(colors.ring, style.sweepGlowAlpha));
    grad.addColorStop(1, rgba(colors.ring, 0));
    ctx.beginPath();
    ctx.moveTo(lead + slant, cy - ry);
    ctx.lineTo(lead + slant + bandWidth, cy - ry);
    ctx.lineTo(lead - slant + bandWidth, cy + ry);
    ctx.lineTo(lead - slant, cy + ry);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // The lattice flares inside the same band.
    ctx.clip();
    ctx.globalAlpha = style.latticeSweepAlpha;
    ctx.drawImage(spriteLattice, 0, 0, width, height);
    ctx.restore();
  }

  function drawRunner() {
    const head = elapsed * style.runnerSpeed;
    const steps = style.runnerSteps;
    const slice = style.runnerLength / steps;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = 0; i < steps; i++) {
      const fade = (i + 1) / steps;
      ctx.strokeStyle = rgba(colors.arc, fade * fade * colors.arc.a);
      ctx.lineWidth = style.runnerWidth * (0.4 + 0.6 * fade);
      const from = head - style.runnerLength + i * slice;
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy,
        rx - style.rimInset,
        ry - style.rimInset,
        0,
        from,
        from + slice + 0.02,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRipple() {
    const k = elapsed / style.rippleDuration;
    const grow =
      style.rippleStartScale + (1 - style.rippleStartScale) * (1 - (1 - k) ** 2);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = rgba(colors.ring, (1 - k) * style.rippleAlpha);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      (rx - style.rimInset) * grow,
      (ry - style.rimInset) * grow,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.restore();
  }

  function render(stamp) {
    if (!running) return;
    // The canvas can be measured at 0x0 while the layout settles (hidden view,
    // phone rotation); keep retrying until the sprites can be baked.
    if (!spriteSpill) safeResize();
    if (!spriteSpill) {
      lastStamp = stamp;
      rafId = requestAnimationFrame(render);
      return;
    }
    const dt = lastStamp
      ? Math.min(style.maxFrameDelta, (stamp - lastStamp) / 1000)
      : 0;
    lastStamp = stamp;
    elapsed += dt;

    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const breath =
      1 -
      style.breathDepth +
      Math.sin(elapsed * style.breathSpeed) * style.breathDepth;
    const appear = Math.min(1, elapsed / style.appearDuration);
    const eased = 1 - (1 - appear) ** 3;
    const scale = style.appearScaleFrom + (1 - style.appearScaleFrom) * eased;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);

    // Inner spill ("sobra interna") and the rim-only lattice
    ctx.globalAlpha = eased * breath;
    ctx.drawImage(spriteSpill, 0, 0, width, height);
    ctx.globalAlpha = eased * style.latticeBaseAlpha;
    ctx.drawImage(spriteLattice, 0, 0, width, height);
    ctx.globalAlpha = eased;

    const sweepClock = elapsed % style.sweepPeriod;
    if (sweepClock < style.sweepDuration) {
      drawSweep(sweepClock / style.sweepDuration);
    }

    // Hard rim over the wrapper's frame, plus a faint echo just inside it
    ctx.strokeStyle = rgba(colors.ring, colors.ring.a * (0.82 + 0.18 * breath));
    ctx.lineWidth = style.rimWidth;
    ellipsePath(ctx, style.rimInset);
    ctx.stroke();
    ctx.strokeStyle = rgba(colors.ring, style.innerRimAlpha);
    ctx.lineWidth = style.innerRimWidth;
    ellipsePath(ctx, style.innerRimInset);
    ctx.stroke();

    ctx.drawImage(spriteGlint, 0, 0, width, height);
    drawRunner();
    ctx.restore();

    if (elapsed < style.rippleDuration) drawRipple();

    rafId = requestAnimationFrame(render);
  }

  rafId = requestAnimationFrame(render);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", safeResize);
    },
  };
}
