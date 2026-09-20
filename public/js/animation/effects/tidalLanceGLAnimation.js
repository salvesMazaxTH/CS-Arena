// Tidal lance hit: water pulls together into a thin jet, the jet spears the
// target, and it bursts into the same spray/foam/ripple language as the
// water bolt.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const GATHER_DUR = 0.18;
const FLIGHT_DUR = 0.14;
const AFTER_DUR = 0.55;

const BODY_TINT = 0x8fd8ee;
const SPRAY_TINT = 0xbfecff;
const FOAM_TINT = 0xeafcff;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLanceTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 40;
  const ctx = c.getContext("2d");

  ctx.beginPath();
  ctx.moveTo(252, 20);
  ctx.quadraticCurveTo(180, 6, 90, 10);
  ctx.quadraticCurveTo(34, 12, 4, 18);
  ctx.lineTo(4, 22);
  ctx.quadraticCurveTo(34, 28, 90, 30);
  ctx.quadraticCurveTo(180, 34, 252, 20);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, 8, 0, 32);
  g.addColorStop(0, "rgba(180,232,255,0.55)");
  g.addColorStop(0.32, "rgba(255,255,255,0.95)");
  g.addColorStop(0.5, "rgba(210,244,255,0.9)");
  g.addColorStop(0.74, "rgba(120,200,235,0.7)");
  g.addColorStop(1, "rgba(160,220,250,0.5)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(240, 19);
  ctx.quadraticCurveTo(140, 12, 28, 16);
  ctx.stroke();

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
  g.addColorStop(0.28, "rgba(214,242,255,0.55)");
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
  g.addColorStop(0.55, "rgba(210,244,255,0)");
  g.addColorStop(0.76, "rgba(238,252,255,0.95)");
  g.addColorStop(0.88, "rgba(150,220,245,0.32)");
  g.addColorStop(1, "rgba(150,220,245,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let lanceTex = null;
let dropletTex = null;
let flashTex = null;
let ringTex = null;

function bakeTextures() {
  if (!lanceTex) lanceTex = makeLanceTexture();
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

class TidalLanceGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.from = from.clone();
    this.to = to.clone();

    this.impactAt = GATHER_DUR + FLIGHT_DUR;
    this.drip = 0;
    this.lifetime = this.impactAt + AFTER_DUR;

    const aim = new THREE.Vector3().subVectors(to, from);
    this.dir = aim.clone().normalize();
    this.angle = Math.atan2(aim.y, aim.x);

    this.lance = billboard(
      2.6 * scale,
      0.46 * scale,
      0,
      lanceTex,
      BODY_TINT,
      THREE.AdditiveBlending,
    );
    this.lance.position.copy(from);
    this.lance.position.z = 0.05;
    this.lance.rotation.z = this.angle;
    scene.add(this.lance);

    this.flash = billboard(
      2.2 * scale,
      2.2 * scale,
      0,
      flashTex,
      undefined,
      THREE.AdditiveBlending,
    );
    this.flash.position.copy(to);
    this.flash.position.z = 0.08;
    this.flash.visible = false;
    scene.add(this.flash);

    const ps = getParticleScale();
    this.dropMax = Math.max(14, Math.round(48 * ps));
    this.drops = dropletPoints(this.dropMax, 0.3 * scale, SPRAY_TINT);
    this.drops.geometry.setDrawRange(0, 0);
    scene.add(this.drops);
    this.dropP = [];

    for (let i = 0; i < Math.round(this.dropMax * 0.4); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (1.2 + Math.random() * 1.2) * scale;
      this.dropP.push({
        x: from.x + Math.cos(a) * d,
        y: from.y + Math.sin(a) * d,
        vx: 0,
        vy: 0,
        pull: 10 + Math.random() * 6,
        life: GATHER_DUR * (0.7 + Math.random() * 0.3),
      });
    }
  }

  splash(count) {
    const up = 0.85;
    const spread = 6.5;
    for (let i = 0; i < count; i++) {
      if (this.dropP.length >= this.dropMax) this.dropP.shift();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
      const sp = 2.5 + Math.random() * spread;
      this.dropP.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(a) * sp + this.dir.x * 1.5,
        vy: Math.abs(Math.sin(a)) * sp * up + 1.2,
        pull: 0,
        life: 0.28 + Math.random() * 0.4,
      });
    }
  }

  shed() {
    const n = Math.max(1, Math.round(3 * getParticleScale()));
    for (let i = 0; i < n; i++) {
      if (this.dropP.length >= this.dropMax) this.dropP.shift();
      this.dropP.push({
        x: this.to.x + (Math.random() - 0.5) * 1 * this.scale,
        y: this.to.y + (Math.random() - 0.5) * 1.1 * this.scale,
        vx: (Math.random() - 0.5) * 1.1,
        vy: -0.4 - Math.random() * 1,
        pull: 0,
        life: 0.32 + Math.random() * 0.45,
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

    if (this.age < GATHER_DUR) {
      const t = this.age / GATHER_DUR;
      this.lance.material.opacity = t * t;
      this.lance.scale.set(0.35 + t * 0.4, 0.5 + t * 0.5, 1);
      this.lance.position.set(this.from.x, this.from.y, 0.05);
    } else if (!this.impacted) {
      const t = Math.min((this.age - GATHER_DUR) / FLIGHT_DUR, 1);
      const eased = t * t;
      this.lance.material.opacity = 1;
      this.lance.scale.set(0.7 + eased * 0.6, 1, 1);
      this.lance.position.set(
        this.from.x + (this.to.x - this.from.x) * eased,
        this.from.y + (this.to.y - this.from.y) * eased,
        0.05,
      );

      if (t >= 1) {
        this.impacted = true;
        this.flash.visible = true;

        this.ring = billboard(2, 2, 0.9, ringTex, SPRAY_TINT);
        this.ring.position.set(this.to.x, this.to.y - 0.3 * this.scale, 0.07);
        this.ring.rotation.x = -1.15;
        this.scene.add(this.ring);

        this.splash(Math.round(this.dropMax * 0.75));
        this.onImpact?.();
      }
    }

    if (this.impacted) {
      const e = Math.min((this.age - this.impactAt) / AFTER_DUR, 1);

      this.lance.material.opacity = Math.max(0, 1 - e / 0.22);
      this.lance.scale.set(1.2 - e * 0.85, Math.max(0.05, 1 - e * 1.6), 1);
      this.lance.position.set(
        this.to.x - this.dir.x * 0.45 * this.scale * e,
        this.to.y - this.dir.y * 0.45 * this.scale * e,
        0.05,
      );

      this.flash.scale.setScalar(0.6 + e * 2);
      this.flash.material.opacity = Math.max(0, 1 - e / 0.16);

      if (this.ring) {
        const re = Math.min(e * 1.4, 1);
        this.ring.scale.setScalar((0.6 + re * 4.2) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
      }

      this.drip -= dt;
      if (this.drip <= 0 && e < 0.55) {
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
      if (p.pull > 0) {
        p.vx += (this.from.x - p.x) * p.pull * dt;
        p.vy += (this.from.y - p.y) * p.pull * dt;
      } else {
        p.vx *= 0.92;
        p.vy = p.vy * 0.92 - 12 * dt;
      }
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
    const objs = [this.lance, this.flash, this.drops];
    if (this.ring) objs.push(this.ring);
    for (const o of objs) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createTidalLanceGL(scale = 1) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;
    bakeTextures();

    const tc = getElementCenter(targetEl);
    const to = screenToWorld(tc.x, tc.y, st.camera);
    const from = userEl
      ? screenToWorld(
          getElementCenter(userEl).x,
          getElementCenter(userEl).y,
          st.camera,
        )
      : new THREE.Vector3(to.x - 6, to.y + 1, 0);

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("water-hit");
      setTimeout(() => targetEl.classList.remove("water-hit"), 320);
    };

    const effect = new TidalLanceGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
