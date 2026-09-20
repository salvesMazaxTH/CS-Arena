// The sea Neraqa pulled away comes straight down: a column falls onto the
// target, then spreads as a heavy sheet of spray and foam.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const LOOM_DUR = 0.26;
const FALL_DUR = 0.15;
const AFTER_DUR = 0.7;

const BODY_TINT = 0x6fc4e4;
const SPRAY_TINT = 0xbfecff;
const FOAM_TINT = 0xeafcff;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeColumnTexture() {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 256;
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 96, 0);
  g.addColorStop(0, "rgba(120,200,235,0)");
  g.addColorStop(0.2, "rgba(150,220,245,0.6)");
  g.addColorStop(0.45, "rgba(235,252,255,0.95)");
  g.addColorStop(0.62, "rgba(190,236,255,0.85)");
  g.addColorStop(0.82, "rgba(130,205,238,0.55)");
  g.addColorStop(1, "rgba(120,200,235,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 256);

  const fade = ctx.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.18, "rgba(0,0,0,0)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 96, 256);
  ctx.globalCompositeOperation = "source-over";

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const x = 24 + i * 14;
    ctx.beginPath();
    ctx.moveTo(x, 40 + i * 12);
    ctx.quadraticCurveTo(x + 8, 150, x - 4, 250);
    ctx.stroke();
  }

  return canvasTex(c);
}

function makeDropletTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,0.98)");
  g.addColorStop(0.4, "rgba(214,242,255,0.72)");
  g.addColorStop(1, "rgba(180,226,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeFlashTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(214,242,255,0.5)");
  g.addColorStop(1, "rgba(160,220,250,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(210,244,255,0)");
  g.addColorStop(0.5, "rgba(210,244,255,0)");
  g.addColorStop(0.72, "rgba(238,252,255,0.95)");
  g.addColorStop(0.86, "rgba(150,220,245,0.35)");
  g.addColorStop(1, "rgba(150,220,245,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let columnTex = null;
let dropletTex = null;
let flashTex = null;
let ringTex = null;

function bakeTextures() {
  if (!columnTex) columnTex = makeColumnTexture();
  if (!dropletTex) dropletTex = makeDropletTexture();
  if (!flashTex) flashTex = makeFlashTexture();
  if (!ringTex) ringTex = makeRingTexture();
}

function billboard(w, h, opacity, tex, color, blending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: blending ?? THREE.NormalBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function dropletPoints(count, size, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  const mat = new THREE.PointsMaterial({
    map: dropletTex,
    size,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class UndertowGL {
  constructor(scene, at, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.at = at.clone();

    this.impactAt = LOOM_DUR + FALL_DUR;
    this.drip = 0;
    this.lifetime = this.impactAt + AFTER_DUR;

    this.dropHeight = 7 * scale;

    this.column = billboard(
      1.9 * scale,
      this.dropHeight,
      0,
      columnTex,
      BODY_TINT,
      THREE.AdditiveBlending,
    );
    this.column.position.set(at.x, at.y + this.dropHeight, 0.05);
    scene.add(this.column);

    this.shadow = billboard(2, 2, 0, ringTex, BODY_TINT);
    this.shadow.position.set(at.x, at.y - 0.3 * scale, 0.02);
    this.shadow.rotation.x = -1.15;
    this.shadow.scale.setScalar(2.4 * scale);
    scene.add(this.shadow);

    this.flash = billboard(
      2.6 * scale,
      2.6 * scale,
      0,
      flashTex,
      undefined,
      THREE.AdditiveBlending,
    );
    this.flash.position.set(at.x, at.y, 0.08);
    this.flash.visible = false;
    scene.add(this.flash);

    const ps = getParticleScale();
    this.dropMax = Math.max(18, Math.round(64 * ps));
    this.drops = dropletPoints(this.dropMax, 0.32 * scale, SPRAY_TINT);
    this.drops.geometry.setDrawRange(0, 0);
    scene.add(this.drops);
    this.dropP = [];

    for (let i = 0; i < Math.round(this.dropMax * 0.3); i++) {
      this.dropP.push({
        x: at.x + (Math.random() - 0.5) * 3 * scale,
        y: at.y + (2 + Math.random() * 4) * scale,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1 - Math.random() * 2,
        life: LOOM_DUR * (0.6 + Math.random() * 0.5),
      });
    }
  }

  splash(count) {
    for (let i = 0; i < count; i++) {
      if (this.dropP.length >= this.dropMax) this.dropP.shift();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const sp = 3 + Math.random() * 8;
      this.dropP.push({
        x: this.at.x + (Math.random() - 0.5) * 0.8 * this.scale,
        y: this.at.y - 0.2 * this.scale,
        vx: Math.cos(a) * sp,
        vy: Math.abs(Math.sin(a)) * sp * 0.9 + 1.4,
        life: 0.3 + Math.random() * 0.45,
      });
    }
  }

  shed() {
    const n = Math.max(1, Math.round(4 * getParticleScale()));
    for (let i = 0; i < n; i++) {
      if (this.dropP.length >= this.dropMax) this.dropP.shift();
      this.dropP.push({
        x: this.at.x + (Math.random() - 0.5) * 2.2 * this.scale,
        y: this.at.y + (Math.random() - 0.5) * 1.2 * this.scale,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.5 - Math.random() * 1.2,
        life: 0.35 + Math.random() * 0.5,
      });
    }
  }

  write() {
    const arr = this.drops.geometry.attributes.position.array;
    for (let i = 0; i < this.dropP.length; i++) {
      arr[i * 3] = this.dropP[i].x;
      arr[i * 3 + 1] = this.dropP[i].y;
      arr[i * 3 + 2] = 0.06;
    }
    this.drops.geometry.setDrawRange(0, this.dropP.length);
    this.drops.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;

    if (this.age < LOOM_DUR) {
      const t = this.age / LOOM_DUR;
      this.shadow.material.opacity = t * 0.55;
      this.shadow.scale.setScalar((2.4 - t * 0.9) * this.scale);
      this.column.material.opacity = t * 0.35;
      this.column.position.y = this.at.y + this.dropHeight * (1.4 - t * 0.3);
    } else if (!this.impacted) {
      const t = Math.min((this.age - LOOM_DUR) / FALL_DUR, 1);
      const eased = t * t;
      this.column.material.opacity = 1;
      this.column.position.y = this.at.y + this.dropHeight * (1.1 - eased * 0.6);
      this.shadow.material.opacity = 0.55 + t * 0.25;

      if (t >= 1) {
        this.impacted = true;
        this.flash.visible = true;

        this.ring = billboard(2, 2, 0.95, ringTex, FOAM_TINT);
        this.ring.position.set(this.at.x, this.at.y - 0.3 * this.scale, 0.07);
        this.ring.rotation.x = -1.15;
        this.scene.add(this.ring);

        this.splash(Math.round(this.dropMax * 0.9));
        this.onImpact?.();
      }
    }

    if (this.impacted) {
      const e = Math.min((this.age - this.impactAt) / AFTER_DUR, 1);

      this.column.material.opacity = Math.max(0, 1 - e / 0.3);
      this.column.scale.set(1 + e * 0.9, Math.max(0.05, 1 - e * 1.4), 1);
      this.column.position.y =
        this.at.y + this.dropHeight * 0.5 * Math.max(0, 1 - e * 1.4);

      this.shadow.material.opacity = Math.max(0, 0.8 * (1 - e * 1.6));

      this.flash.scale.setScalar(0.7 + e * 2.4);
      this.flash.material.opacity = Math.max(0, 1 - e / 0.18);

      if (this.ring) {
        const re = Math.min(e * 1.2, 1);
        this.ring.scale.setScalar((0.7 + re * 5.4) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.95 * (1 - re) * (1 - re));
      }

      this.drip -= dt;
      if (this.drip <= 0 && e < 0.6) {
        this.drip = 0.05;
        this.shed();
      }
    }

    for (let i = this.dropP.length - 1; i >= 0; i--) {
      const p = this.dropP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.dropP.splice(i, 1);
        continue;
      }
      p.vx *= 0.93;
      p.vy = p.vy * 0.93 - 13 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.write();
    this.drops.material.opacity = Math.min(
      1,
      Math.max(0, (this.lifetime - this.age) / 0.25),
    );

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.column, this.shadow, this.flash, this.drops];
    if (this.ring) objs.push(this.ring);
    for (const o of objs) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createUndertowGL(scale = 1) {
  return async (opts) => {
    const { targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;
    bakeTextures();

    const tc = getElementCenter(targetEl);
    const at = screenToWorld(tc.x, tc.y, st.camera);

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("water-hit");
      setTimeout(() => targetEl.classList.remove("water-hit"), 320);
    };

    const effect = new UndertowGL(st.scene, at, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
