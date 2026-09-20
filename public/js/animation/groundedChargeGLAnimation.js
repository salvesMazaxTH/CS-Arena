// Grounded charge hit: a conductor is driven into the target and the charge
// runs down it into the soil, arcing between the wound and their feet.

import { playContactLunge } from "./contactLungeAnimation.js";
import { getParticleScale } from "./effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "./glStage.js";

const PIN_DUR = 0.09;
const ARC_DUR = 0.34;
const FADE_DUR = 0.26;

const CORE_TINT = 0xfff3a6;
const BOLT_TINT = 0xffe14d;
const HOT_TINT = 0xffa713;

const ARC_VARIANTS = 3;
const FLICKER = 0.035;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePinTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext("2d");

  const glow = ctx.createLinearGradient(0, 0, 32, 0);
  glow.addColorStop(0, "rgba(255,167,19,0)");
  glow.addColorStop(0.5, "rgba(255,225,77,0.55)");
  glow.addColorStop(1, "rgba(255,167,19,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 256);

  ctx.beginPath();
  ctx.moveTo(16, 254);
  ctx.lineTo(20, 40);
  ctx.quadraticCurveTo(19, 8, 16, 2);
  ctx.quadraticCurveTo(13, 8, 12, 40);
  ctx.closePath();
  const body = ctx.createLinearGradient(10, 0, 22, 0);
  body.addColorStop(0, "rgba(176,188,200,0.95)");
  body.addColorStop(0.42, "rgba(255,255,255,1)");
  body.addColorStop(1, "rgba(120,132,144,0.9)");
  ctx.fillStyle = body;
  ctx.fill();

  return canvasTex(c);
}

function makeArcTexture() {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 256;
  const ctx = c.getContext("2d");

  const pts = [];
  const steps = 11;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const spread = Math.sin(t * Math.PI) * 30;
    pts.push([48 + (Math.random() - 0.5) * spread, 4 + t * 248]);
  }

  const stroke = (width, color, alpha) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  stroke(11, "rgba(255,167,19,0.45)", 1);
  stroke(5, "#ffe14d", 1);
  stroke(2, "#ffffff", 1);

  for (let i = 2; i < pts.length - 2; i += 3) {
    const [x, y] = pts[i];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 42, y + 14 + Math.random() * 16);
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "#fff3a6";
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  return canvasTex(c);
}

function makeGroundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.translate(64, 64);
  ctx.scale(1, 0.34);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 62);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.22, "rgba(255,225,77,0.6)");
  g.addColorStop(0.7, "rgba(255,167,19,0.22)");
  g.addColorStop(1, "rgba(255,167,19,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,243,166,0.85)";
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
    ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58);
    ctx.stroke();
  }

  return canvasTex(c);
}

function makeSparkTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,225,77,0.85)");
  g.addColorStop(1, "rgba(255,167,19,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

let pinTex = null;
let arcTexes = null;
let groundTex = null;
let sparkTex = null;

function bakeTextures() {
  if (!pinTex) pinTex = makePinTexture();
  if (!arcTexes) {
    arcTexes = [];
    for (let i = 0; i < ARC_VARIANTS; i++) arcTexes.push(makeArcTexture());
  }
  if (!groundTex) groundTex = makeGroundTexture();
  if (!sparkTex) sparkTex = makeSparkTexture();
}

function billboard(w, h, opacity, tex, color) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

class GroundedChargeGL {
  constructor(scene, chest, ground, scale) {
    this.scale = scale;
    this.age = 0;
    this.chest = chest.clone();
    this.ground = ground.clone();
    this.lifetime = PIN_DUR + ARC_DUR + FADE_DUR;
    this.flicker = 0;

    const drop = Math.max(0.9, chest.y - ground.y);

    this.pin = billboard(0.34 * scale, 1.25 * scale, 0, pinTex, CORE_TINT);
    this.pin.position.set(chest.x, chest.y, 0.06);
    this.pin.rotation.z = 0.42;
    scene.add(this.pin);

    this.arcs = [];
    for (let i = 0; i < ARC_VARIANTS; i++) {
      const arc = billboard(1.5 * scale, drop, 0, arcTexes[i], BOLT_TINT);
      arc.position.set(
        chest.x + (i - 1) * 0.22 * scale,
        (chest.y + ground.y) / 2,
        0.07,
      );
      arc.scale.x = i % 2 === 0 ? 1 : -1;
      arc.visible = false;
      scene.add(arc);
      this.arcs.push(arc);
    }

    this.flash = billboard(3.4 * scale, 3.4 * scale, 0, groundTex, BOLT_TINT);
    this.flash.position.set(ground.x, ground.y + 0.05 * scale, 0.05);
    scene.add(this.flash);

    const ps = getParticleScale();
    this.max = Math.max(14, Math.round(48 * ps));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.max * 3), 3),
    );
    this.sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: sparkTex,
        size: 0.2 * scale,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: HOT_TINT,
      }),
    );
    geo.setDrawRange(0, 0);
    scene.add(this.sparks);
    this.sparkP = [];
    this.emit = 0;
  }

  spark(count, at, spread) {
    for (let i = 0; i < count; i++) {
      if (this.sparkP.length >= this.max) this.sparkP.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 1.8 + Math.random() * 4.5;
      this.sparkP.push({
        x: at.x + (Math.random() - 0.5) * spread * this.scale,
        y: at.y + (Math.random() - 0.5) * spread * this.scale,
        vx: Math.cos(a) * sp,
        vy: Math.abs(Math.sin(a)) * sp,
        life: 0.16 + Math.random() * 0.3,
      });
    }
  }

  write() {
    const arr = this.sparks.geometry.attributes.position.array;
    for (let i = 0; i < this.sparkP.length; i++) {
      arr[i * 3] = this.sparkP[i].x;
      arr[i * 3 + 1] = this.sparkP[i].y;
      arr[i * 3 + 2] = 0.08;
    }
    this.sparks.geometry.setDrawRange(0, this.sparkP.length);
    this.sparks.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;
    const ps = getParticleScale();

    if (this.age < PIN_DUR) {
      const t = this.age / PIN_DUR;
      this.pin.material.opacity = t;
      this.pin.scale.set(1, 0.35 + t * 0.65, 1);
    } else {
      const e = Math.min((this.age - PIN_DUR) / (ARC_DUR + FADE_DUR), 1);

      this.pin.material.opacity = Math.max(0, 1 - e / 0.8);
      this.pin.scale.set(1, 1, 1);

      this.flicker -= dt;
      if (this.flicker <= 0) {
        this.flicker = FLICKER;
        for (const arc of this.arcs) arc.visible = Math.random() < 0.62;
      }
      const arcFade = this.age - PIN_DUR < ARC_DUR ? 1 : Math.max(0, 1 - e);
      for (const arc of this.arcs) {
        arc.material.opacity = arcFade * (0.65 + Math.random() * 0.35);
      }

      const f = Math.min((this.age - PIN_DUR) / 0.18, 1);
      this.flash.scale.setScalar(0.35 + f * 0.85);
      this.flash.material.opacity = Math.max(0, 1 - e * e * 1.15);

      this.emit -= dt;
      if (this.emit <= 0 && this.age - PIN_DUR < ARC_DUR) {
        this.emit = 0.04;
        this.spark(Math.max(1, Math.round(4 * ps)), this.ground, 1.1);
        this.spark(Math.max(1, Math.round(2 * ps)), this.chest, 0.8);
      }
    }

    for (let i = this.sparkP.length - 1; i >= 0; i--) {
      const p = this.sparkP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.sparkP.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 - 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.write();
    this.sparks.material.opacity = Math.min(
      1,
      Math.max(0, (this.lifetime - this.age) / 0.2),
    );

    return this.age < this.lifetime;
  }

  dispose(scene) {
    for (const o of [this.pin, this.flash, this.sparks, ...this.arcs]) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createGroundedChargeGL(scale = 1) {
  return async (opts) => {
    const { targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;
    bakeTextures();

    // The conductor has to be driven in before anything can run down it.
    if (opts.skill?.contact === true) await playContactLunge(opts);

    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const chest = screenToWorld(cx, rect.top + rect.height * 0.42, st.camera);
    const ground = screenToWorld(
      cx,
      rect.bottom - rect.height * 0.04,
      st.camera,
    );

    targetEl.classList.add("lightning-hit");
    setTimeout(() => targetEl.classList.remove("lightning-hit"), 400);

    const effect = new GroundedChargeGL(st.scene, chest, ground, scale);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
