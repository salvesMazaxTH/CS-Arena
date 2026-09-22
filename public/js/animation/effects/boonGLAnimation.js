// A mote leaves the source's portrait, arcs to the ally trailing a thin
// ribbon, and opens on arrival: rising petals for mending, a closing ring
// for a buff.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const BIRTH_DUR = 0.14;
const FLIGHT_DUR = 0.4;
const BLOOM_DUR = 0.55;

const MAX_TRAIL = 26;
const TRAIL_LIFE = 0.2;

export const BOON_PALETTES = {
  boon: { mote: 0xfff6dd, trail: 0xf2c561, bloom: 0xffd888, rise: false },
  mending: { mote: 0xeafff2, trail: 0x7fe8ae, bloom: 0x9df5c4, rise: true },
};

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.88)");
  g.addColorStop(0.52, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTex(c);
}

function makeRibbonTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.4, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 16);

  const v = ctx.createLinearGradient(0, 0, 0, 16);
  v.addColorStop(0, "rgba(0,0,0,1)");
  v.addColorStop(0.5, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 16);

  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 38, 64, 64, 63);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.92)");
  g.addColorStop(0.78, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let moteTex = null;
let ribbonTex = null;
let ringTex = null;

function bakeTextures() {
  if (!moteTex) moteTex = makeMoteTexture();
  if (!ribbonTex) ribbonTex = makeRibbonTexture();
  if (!ringTex) ringTex = makeRingTexture();
}

function billboard(w, h, tex, color) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0,
  });
  mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function ribbonMesh(color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 2 * 3), 3),
  );
  geo.setAttribute(
    "uv",
    new THREE.BufferAttribute(new Float32Array(MAX_TRAIL * 2 * 2), 2),
  );

  const idx = new Uint16Array((MAX_TRAIL - 1) * 6);
  for (let i = 0; i < MAX_TRAIL - 1; i++) {
    const a = i * 2;
    idx.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], i * 6);
  }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setDrawRange(0, 0);

  const mat = new THREE.MeshBasicMaterial({
    map: ribbonTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  mat.color.setHex(color);
  return new THREE.Mesh(geo, mat);
}

function particlePoints(count, size, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  geo.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({
    map: moteTex,
    size,
    sizeAttenuation: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class BoonGL {
  constructor(scene, from, to, scale, palette, onImpact) {
    this.scale = scale;
    this.palette = palette;
    this.onImpact = onImpact;
    this.age = 0;
    this.impacted = false;

    this.from = from.clone();
    this.to = to.clone();

    const span = new THREE.Vector3().subVectors(to, from);
    this.flightDur = span.length() < 0.35 ? 0 : FLIGHT_DUR;
    this.impactAt = BIRTH_DUR + this.flightDur;
    this.lifetime = this.impactAt + BLOOM_DUR;

    // The bow is randomised per instance so several motes leaving the same
    // portrait on one frame fan out instead of overlapping.
    const perp = new THREE.Vector3(-span.y, span.x, 0).normalize();
    if (perp.y < 0) perp.negate();
    const bow = span.length() * (0.2 + Math.random() * 0.16);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2 + perp.x * bow,
      (from.y + to.y) / 2 + perp.y * bow,
      0,
    );

    this.head = this.from.clone();
    this.trail = [];

    this.ribbon = ribbonMesh(palette.trail);
    scene.add(this.ribbon);

    this.mote = billboard(1.1 * scale, 1.1 * scale, moteTex, palette.mote);
    this.mote.position.set(from.x, from.y, 0.09);
    scene.add(this.mote);

    this.flash = billboard(2.6 * scale, 2.6 * scale, moteTex, palette.bloom);
    this.flash.position.set(to.x, to.y, 0.08);
    this.flash.visible = false;
    scene.add(this.flash);

    this.ring = billboard(3.4 * scale, 3.4 * scale, ringTex, palette.bloom);
    this.ring.position.set(to.x, to.y, 0.07);
    this.ring.visible = false;
    scene.add(this.ring);

    this.sparkMax = Math.max(8, Math.round(26 * getParticleScale()));
    this.sparks = particlePoints(this.sparkMax, 0.26 * scale, palette.bloom);
    scene.add(this.sparks);
    this.sparkP = [];
  }

  bezier(t) {
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * this.from.x + 2 * u * t * this.ctrl.x + t * t * this.to.x,
      u * u * this.from.y + 2 * u * t * this.ctrl.y + t * t * this.to.y,
      0,
    );
  }

  bloom() {
    for (let i = 0; i < this.sparkMax; i++) {
      if (this.palette.rise) {
        const a = Math.random() * Math.PI * 2;
        this.sparkP.push({
          x: this.to.x + Math.cos(a) * 0.5 * this.scale,
          y: this.to.y + Math.sin(a) * 0.4 * this.scale,
          vx: Math.cos(a) * (0.5 + Math.random() * 1.1),
          vy: 1.6 + Math.random() * 2.6,
          spin: 0,
          life: 0.38 + Math.random() * 0.34,
        });
      } else {
        this.sparkP.push({
          a: (i / this.sparkMax) * Math.PI * 2 + Math.random() * 0.4,
          r: (1.5 + Math.random() * 0.9) * this.scale,
          spin: 4.2 + Math.random() * 2.4,
          life: 0.3 + Math.random() * 0.26,
        });
      }
    }
  }

  writeRibbon() {
    const n = this.trail.length;
    if (n < 2) {
      this.ribbon.geometry.setDrawRange(0, 0);
      return;
    }

    const pos = this.ribbon.geometry.attributes.position.array;
    const uv = this.ribbon.geometry.attributes.uv.array;
    const half = 0.13 * this.scale;

    for (let i = 0; i < n; i++) {
      const p = this.trail[i];
      const ahead = this.trail[Math.min(i + 1, n - 1)];
      const back = this.trail[Math.max(i - 1, 0)];
      let dx = ahead.x - back.x;
      let dy = ahead.y - back.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;

      const u = i / (n - 1);
      const w = half * u;
      const o = i * 6;
      pos[o] = p.x - dy * w;
      pos[o + 1] = p.y + dx * w;
      pos[o + 2] = 0.06;
      pos[o + 3] = p.x + dy * w;
      pos[o + 4] = p.y - dx * w;
      pos[o + 5] = 0.06;

      const t = i * 4;
      uv[t] = u;
      uv[t + 1] = 0;
      uv[t + 2] = u;
      uv[t + 3] = 1;
    }

    this.ribbon.geometry.attributes.position.needsUpdate = true;
    this.ribbon.geometry.attributes.uv.needsUpdate = true;
    this.ribbon.geometry.setDrawRange(0, (n - 1) * 6);
  }

  writeSparks() {
    const arr = this.sparks.geometry.attributes.position.array;
    let w = 0;
    for (const p of this.sparkP) {
      if (w >= this.sparkMax) break;
      if (p.spin > 0) {
        arr[w * 3] = this.to.x + Math.cos(p.a) * p.r;
        arr[w * 3 + 1] = this.to.y + Math.sin(p.a) * p.r;
      } else {
        arr[w * 3] = p.x;
        arr[w * 3 + 1] = p.y;
      }
      arr[w * 3 + 2] = 0.1;
      w++;
    }
    this.sparks.geometry.setDrawRange(0, w);
    this.sparks.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;

    if (this.age < BIRTH_DUR) {
      const t = this.age / BIRTH_DUR;
      this.mote.material.opacity = t;
      this.mote.scale.setScalar(0.35 + t * 0.75);
      this.head.copy(this.from);
    } else if (!this.impacted) {
      const raw = this.flightDur
        ? Math.min((this.age - BIRTH_DUR) / this.flightDur, 1)
        : 1;
      const t = raw * raw * (3 - 2 * raw);
      this.head.copy(this.bezier(t));
      this.mote.material.opacity = 1;
      this.mote.scale.setScalar(1.1);

      if (raw >= 1) {
        this.impacted = true;
        this.flash.visible = true;
        if (!this.palette.rise) this.ring.visible = true;
        this.bloom();
        this.onImpact?.();
      }
    }

    this.mote.position.set(this.head.x, this.head.y, 0.09);

    if (!this.impacted) {
      this.trail.push({ x: this.head.x, y: this.head.y, age: 0 });
      if (this.trail.length > MAX_TRAIL) this.trail.shift();
    }

    // Past the impact the ribbon is drawn into the ally instead of fading out,
    // so the gift reads as delivered rather than dropped.
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      p.age += this.impacted ? dt * 3.4 : dt;
      if (p.age >= TRAIL_LIFE) {
        this.trail.splice(i, 1);
        continue;
      }
      if (this.impacted) {
        p.x += (this.to.x - p.x) * 11 * dt;
        p.y += (this.to.y - p.y) * 11 * dt;
      }
    }
    this.writeRibbon();

    if (this.impacted) {
      const e = Math.min((this.age - this.impactAt) / BLOOM_DUR, 1);

      this.mote.material.opacity = Math.max(0, 1 - e / 0.22);
      this.mote.scale.setScalar(1.1 + e * 1.4);

      this.flash.scale.setScalar(0.5 + e * 1.5);
      this.flash.material.opacity = Math.max(0, 1 - e / 0.3);

      if (this.ring.visible) {
        this.ring.scale.setScalar(1.35 - e * 0.55);
        this.ring.material.opacity = Math.min(1, e / 0.12) * (1 - e * e);
      }
    }

    for (let i = this.sparkP.length - 1; i >= 0; i--) {
      const p = this.sparkP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparkP.splice(i, 1);
        continue;
      }
      if (p.spin > 0) {
        p.a += p.spin * dt;
        p.r = Math.max(0.2, p.r - 2.6 * dt * this.scale);
      } else {
        p.vy -= 2.2 * dt;
        p.vx *= 0.94;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }
    this.writeSparks();
    this.sparks.material.opacity = Math.min(
      1,
      Math.max(0, (this.lifetime - this.age) / 0.2),
    );

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const parts = [this.ribbon, this.mote, this.flash, this.ring, this.sparks];
    for (const o of parts) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createBoonGL(palette = BOON_PALETTES.boon, scale = 1) {
  return async (opts) => {
    const { userEl, targetEl, onLand } = opts;
    if (!targetEl) {
      onLand?.();
      return;
    }

    const st = ensureStage();
    if (!st) {
      onLand?.();
      return;
    }
    bakeTextures();

    const tc = getElementCenter(targetEl);
    const to = screenToWorld(tc.x, tc.y, st.camera);
    const source = userEl && userEl !== targetEl ? userEl : null;
    const sc = source ? getElementCenter(source) : null;
    const from = sc ? screenToWorld(sc.x, sc.y, st.camera) : to.clone();

    let landed = false;
    const onImpact = () => {
      if (landed) return;
      landed = true;
      onLand?.();
    };

    const effect = new BoonGL(st.scene, from, to, scale, palette, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
    onImpact();
  };
}
