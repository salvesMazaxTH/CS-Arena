// Liquid steel lance hit: quicksilver beads pull together into a spike, the
// spike runs the target through, and it bursts into heavy quicksilver beads.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const GATHER_DUR = 0.2;
const FLIGHT_DUR = 0.16;
const AFTER_DUR = 0.6;

const CHROME_TINT = 0xe4ebf2;
const STEEL_TINT = 0x9aa7b4;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeLanceTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 48;
  const ctx = c.getContext("2d");

  ctx.beginPath();
  ctx.moveTo(252, 24);
  ctx.quadraticCurveTo(190, 8, 96, 12);
  ctx.quadraticCurveTo(38, 14, 4, 21);
  ctx.lineTo(4, 27);
  ctx.quadraticCurveTo(38, 34, 96, 36);
  ctx.quadraticCurveTo(190, 40, 252, 24);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, 10, 0, 38);
  g.addColorStop(0, "rgba(120,134,148,0.85)");
  g.addColorStop(0.32, "rgba(246,250,255,0.98)");
  g.addColorStop(0.5, "rgba(196,208,220,0.95)");
  g.addColorStop(0.74, "rgba(84,96,108,0.9)");
  g.addColorStop(1, "rgba(142,156,170,0.8)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(240, 23);
  ctx.quadraticCurveTo(150, 15, 30, 20);
  ctx.stroke();

  return canvasTex(c);
}

function makeBeadTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(12, 11, 1, 16, 16, 15);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(214,226,238,0.95)");
  g.addColorStop(0.72, "rgba(118,132,146,0.9)");
  g.addColorStop(0.95, "rgba(70,82,94,0.75)");
  g.addColorStop(1, "rgba(70,82,94,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeFlashTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.28, "rgba(220,232,244,0.5)");
  g.addColorStop(1, "rgba(160,178,196,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let lanceTex = null;
let beadTex = null;
let flashTex = null;

function bakeTextures() {
  if (!lanceTex) lanceTex = makeLanceTexture();
  if (!beadTex) beadTex = makeBeadTexture();
  if (!flashTex) flashTex = makeFlashTexture();
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

function particlePoints(count, size, color, tex) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  const mat = new THREE.PointsMaterial({
    map: tex,
    size,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class LiquidSteelLanceGL {
  constructor(scene, from, to, scale, onImpact) {
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

    this.lance = billboard(2.9 * scale, 0.54 * scale, 0, lanceTex, CHROME_TINT);
    this.lance.position.copy(from);
    this.lance.position.z = 0.05;
    this.lance.rotation.z = this.angle;
    scene.add(this.lance);

    this.flash = billboard(
      2.2 * scale,
      2.2 * scale,
      0,
      flashTex,
      CHROME_TINT,
      THREE.AdditiveBlending,
    );
    this.flash.position.copy(to);
    this.flash.position.z = 0.08;
    this.flash.visible = false;
    scene.add(this.flash);

    const ps = getParticleScale();
    this.beadMax = Math.max(16, Math.round(56 * ps));
    this.beads = particlePoints(this.beadMax, 0.28 * scale, STEEL_TINT, beadTex);
    this.beads.geometry.setDrawRange(0, 0);
    scene.add(this.beads);
    this.beadP = [];

    for (let i = 0; i < Math.round(this.beadMax * 0.55); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (1.4 + Math.random() * 1.4) * scale;
      this.beadP.push({
        x: from.x + Math.cos(a) * d,
        y: from.y + Math.sin(a) * d,
        vx: 0,
        vy: 0,
        pull: 9 + Math.random() * 7,
        life: GATHER_DUR * (0.7 + Math.random() * 0.3),
      });
    }
  }

  splash(count) {
    for (let i = 0; i < count; i++) {
      if (this.beadP.length >= this.beadMax) this.beadP.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 5;
      this.beadP.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(a) * sp + this.dir.x * 2,
        vy: Math.abs(Math.sin(a)) * sp,
        pull: 0,
        life: 0.28 + Math.random() * 0.45,
      });
    }
  }

  shed() {
    const n = Math.max(1, Math.round(3 * getParticleScale()));
    for (let i = 0; i < n; i++) {
      if (this.beadP.length >= this.beadMax) this.beadP.shift();
      this.beadP.push({
        x: this.to.x + (Math.random() - 0.5) * 1.1 * this.scale,
        y: this.to.y + (Math.random() - 0.5) * 1.3 * this.scale,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -0.4 - Math.random() * 1.2,
        pull: 0,
        life: 0.35 + Math.random() * 0.5,
      });
    }
  }

  write() {
    const arr = this.beads.geometry.attributes.position.array;
    for (let i = 0; i < this.beadP.length; i++) {
      arr[i * 3] = this.beadP[i].x;
      arr[i * 3 + 1] = this.beadP[i].y;
      arr[i * 3 + 2] = 0.06;
    }
    this.beads.geometry.setDrawRange(0, this.beadP.length);
    this.beads.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;

    if (this.age < GATHER_DUR) {
      const t = this.age / GATHER_DUR;
      this.lance.material.opacity = t * t;
      this.lance.scale.set(0.3 + t * 0.4, 0.5 + t * 0.5, 1);
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
        this.splash(Math.round(this.beadMax * 0.85));
        this.onImpact?.();
      }
    }

    if (this.impacted) {
      const e = Math.min((this.age - this.impactAt) / AFTER_DUR, 1);

      this.lance.material.opacity = Math.max(0, 1 - e / 0.25);
      this.lance.scale.set(1.3 - e * 0.9, Math.max(0.05, 1 - e * 1.6), 1);
      this.lance.position.set(
        this.to.x - this.dir.x * 0.5 * this.scale * e,
        this.to.y - this.dir.y * 0.5 * this.scale * e,
        0.05,
      );

      this.flash.scale.setScalar(0.6 + e * 2.2);
      this.flash.material.opacity = Math.max(0, 1 - e / 0.18);

      this.drip -= dt;
      if (this.drip <= 0 && e < 0.6) {
        this.drip = 0.045;
        this.shed();
      }
    }

    for (let i = this.beadP.length - 1; i >= 0; i--) {
      const p = this.beadP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.beadP.splice(i, 1);
        continue;
      }
      if (p.pull > 0) {
        p.vx += (this.from.x - p.x) * p.pull * dt;
        p.vy += (this.from.y - p.y) * p.pull * dt;
      } else {
        p.vx *= 0.9;
        p.vy = p.vy * 0.9 - 15 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.write();
    this.beads.material.opacity = Math.min(
      1,
      Math.max(0, (this.lifetime - this.age) / 0.25),
    );

    return this.age < this.lifetime;
  }

  dispose(scene) {
    for (const o of [this.lance, this.flash, this.beads]) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createLiquidSteelLanceGL(scale = 1) {
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
      targetEl.classList.add("steel-hit");
      setTimeout(() => targetEl.classList.remove("steel-hit"), 360);
    };

    const effect = new LiquidSteelLanceGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
