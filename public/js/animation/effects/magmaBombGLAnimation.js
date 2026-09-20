// Magma bomb hit: the fire bolt's arc and blast, but the thing in flight is a
// chunk of obsidian cracked open over lava instead of an open flame.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const TRAVEL_DUR = 0.3;
const POST_DUR = 0.46;
const CHARGE_DUR = 0.15;

const HALO_TINT = 0xff6a22;
const PLUME_TINT = 0x8a3a18;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRockTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  ctx.beginPath();
  const pts = 13;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = 52 + Math.sin(i * 2.7) * 7 + Math.cos(i * 1.3) * 5;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  const body = ctx.createRadialGradient(44, 42, 4, 64, 64, 62);
  body.addColorStop(0, "rgba(86,74,78,1)");
  body.addColorStop(0.42, "rgba(46,38,42,1)");
  body.addColorStop(0.8, "rgba(22,17,20,1)");
  body.addColorStop(1, "rgba(12,9,11,0.9)");
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();

  const glow = ctx.createRadialGradient(72, 80, 2, 72, 80, 54);
  glow.addColorStop(0, "rgba(255,196,96,0.85)");
  glow.addColorStop(0.35, "rgba(255,96,20,0.4)");
  glow.addColorStop(1, "rgba(255,70,10,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 128, 128);

  const cracks = [
    [22, 58, 54, 66, 78, 52, 108, 62],
    [50, 18, 58, 52, 46, 78, 56, 112],
    [78, 30, 70, 58, 92, 74, 86, 106],
    [14, 88, 44, 84, 66, 96],
  ];
  for (const path of cracks) {
    ctx.beginPath();
    ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
    ctx.lineCap = "round";

    ctx.strokeStyle = "rgba(255,110,24,0.55)";
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,172,62,0.85)";
    ctx.lineWidth = 3.4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,240,196,0.95)";
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }

  for (let i = 0; i < 9; i++) {
    const x = 20 + Math.random() * 88;
    const y = 20 + Math.random() * 88;
    const r = 3 + Math.random() * 7;
    const p = ctx.createRadialGradient(x, y, 0, x, y, r);
    p.addColorStop(0, "rgba(10,7,9,0.85)");
    p.addColorStop(1, "rgba(10,7,9,0)");
    ctx.fillStyle = p;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  ctx.restore();
  return canvasTex(c);
}

function makeHaloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 18, 64, 64, 64);
  g.addColorStop(0, "rgba(255,180,96,0.5)");
  g.addColorStop(0.4, "rgba(255,104,26,0.34)");
  g.addColorStop(1, "rgba(150,34,6,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeSmokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, "rgba(72,62,62,0.6)");
  g.addColorStop(0.5, "rgba(48,40,42,0.34)");
  g.addColorStop(1, "rgba(30,24,26,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeFlameTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,244,1)");
  g.addColorStop(0.25, "rgba(255,206,118,0.95)");
  g.addColorStop(0.55, "rgba(255,96,22,0.55)");
  g.addColorStop(1, "rgba(120,20,4,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeEmberTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,240,210,1)");
  g.addColorStop(0.5, "rgba(255,142,52,0.7)");
  g.addColorStop(1, "rgba(255,142,52,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,190,130,0)");
  g.addColorStop(0.62, "rgba(255,190,130,0)");
  g.addColorStop(0.79, "rgba(255,226,180,0.95)");
  g.addColorStop(0.9, "rgba(255,122,44,0.34)");
  g.addColorStop(1, "rgba(255,122,44,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let rockTex = null;
let haloTex = null;
let smokeTex = null;
let flameTex = null;
let emberTex = null;
let ringTex = null;

function bakeTextures() {
  if (!rockTex) rockTex = makeRockTexture();
  if (!haloTex) haloTex = makeHaloTexture();
  if (!smokeTex) smokeTex = makeSmokeTexture();
  if (!flameTex) flameTex = makeFlameTexture();
  if (!emberTex) emberTex = makeEmberTexture();
  if (!ringTex) ringTex = makeRingTexture();
}

function billboard(w, h, opacity, tex, color, blending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex || flameTex,
    transparent: true,
    blending: blending ?? THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function emberPoints(count, size, color, tex, blending) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  const mat = new THREE.PointsMaterial({
    map: tex || emberTex,
    size,
    sizeAttenuation: true,
    transparent: true,
    blending: blending ?? THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class MagmaBombGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.chargeDur = CHARGE_DUR;
    this.lifetime = this.chargeDur + TRAVEL_DUR + POST_DUR + 0.2;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.3, 4.2),
      0,
    );

    this.core = new THREE.Group();
    this.halo = billboard(2.6 * scale, 2.6 * scale, 0.85, haloTex, HALO_TINT);
    this.rock = billboard(
      1.5 * scale,
      1.5 * scale,
      1,
      rockTex,
      undefined,
      THREE.NormalBlending,
    );
    this.rock.position.z = 0.02;
    this.core.add(this.halo);
    this.core.add(this.rock);
    scene.add(this.core);

    this.plume = billboard(3.4 * scale, 1.6 * scale, 0.55, smokeTex, PLUME_TINT, THREE.NormalBlending);
    scene.add(this.plume);

    this.charge = billboard(1.4 * scale, 1.4 * scale, 0, haloTex, HALO_TINT);
    this.charge.position.copy(this.p0);
    scene.add(this.charge);

    const ps = getParticleScale();
    this.trailN = Math.max(6, Math.round(34 * ps));
    this.trail = emberPoints(this.trailN, 0.32 * scale, 0xffae4a);
    this.trailP = [];
    scene.add(this.trail);

    this.sootN = Math.max(4, Math.round(18 * ps));
    this.soot = emberPoints(
      this.sootN,
      0.6 * scale,
      0x4a3f42,
      smokeTex,
      THREE.NormalBlending,
    );
    this.sootP = [];
    scene.add(this.soot);

    this.burstN = Math.round(46 * ps);
    this.burst = emberPoints(this.burstN, 0.42 * scale, 0xffc878);
    this.burstP = [];
    scene.add(this.burst);

    this.shardN = Math.max(6, Math.round(22 * ps));
    this.shard = emberPoints(
      this.shardN,
      0.34 * scale,
      0x2a2124,
      smokeTex,
      THREE.NormalBlending,
    );
    this.shardP = [];
    scene.add(this.shard);

    this.flash = billboard(5.2 * scale, 5.2 * scale, 0, flameTex);
    this.flash.position.copy(this.to);
    this.flash.visible = false;
    scene.add(this.flash);
  }

  bezier(t) {
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * this.p0.x + 2 * u * t * this.ctrl.x + t * t * this.p2.x,
      u * u * this.p0.y + 2 * u * t * this.ctrl.y + t * t * this.p2.y,
      0,
    );
  }

  bezierAngle(t) {
    const u = 1 - t;
    const dx =
      2 * u * (this.ctrl.x - this.p0.x) + 2 * t * (this.p2.x - this.ctrl.x);
    const dy =
      2 * u * (this.ctrl.y - this.p0.y) + 2 * t * (this.p2.y - this.ctrl.y);
    return Math.atan2(dy, dx);
  }

  writePoints(points, obj) {
    const arr = obj.geometry.attributes.position.array;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      arr[i * 3] = points[i].x;
      arr[i * 3 + 1] = points[i].y;
      arr[i * 3 + 2] = 0;
    }
    obj.geometry.setDrawRange(0, n);
    obj.geometry.attributes.position.needsUpdate = true;
  }

  integratePoints(points, dt, drag, gy) {
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      p.life -= dt;
      if (p.life <= 0) {
        points.splice(i, 1);
        continue;
      }
      p.vx *= drag;
      p.vy = p.vy * drag + gy * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  update(dt) {
    this.age += dt;

    if (this.age < this.chargeDur) {
      const cp = this.age / this.chargeDur;
      this.core.position.copy(this.p0);
      this.core.scale.setScalar(0.18 + cp * 0.6);
      this.rock.rotation.z -= dt * 3.4;
      this.halo.material.opacity = 0.4 + cp * 0.5;
      this.plume.visible = false;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.9;
      this.charge.scale.setScalar(0.4 + cp * 1.6);
      this.charge.rotation.z += dt * 5;
      return true;
    }
    this.charge.visible = false;

    const flightAge = this.age - this.chargeDur;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);
    const eased = t < 0.82 ? t : 0.82 + (1 - (1 - (t - 0.82) / 0.18) ** 2) * 0.18;
    const pulse = 1 + 0.1 * Math.sin(flightAge * 30);

    if (t < 1) {
      this.core.scale.setScalar(1);
      this.plume.visible = true;
      const pos = this.bezier(eased);
      const ang = this.bezierAngle(eased);
      this.core.position.copy(pos);
      this.plume.position.set(
        pos.x - Math.cos(ang) * 1.7 * this.scale,
        pos.y - Math.sin(ang) * 1.7 * this.scale,
        0,
      );
      this.plume.rotation.z = ang;
      this.rock.rotation.z -= dt * 7.5;
      this.halo.scale.setScalar(pulse);

      if (this.trailP.length < this.trailN) {
        this.trailP.push({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 1.6,
          vy: 0.5 + Math.random() * 1.3,
          life: 0.3 + Math.random() * 0.35,
        });
      }
      if (this.sootP.length < this.sootN) {
        this.sootP.push({
          x: pos.x - Math.cos(ang) * this.scale,
          y: pos.y - Math.sin(ang) * this.scale,
          vx: (Math.random() - 0.5) * 1.1,
          vy: 0.3 + Math.random() * 0.9,
          life: 0.4 + Math.random() * 0.4,
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.flash.visible = true;

      this.ring = billboard(2, 2, 0.9, ringTex);
      this.ring.position.copy(this.to);
      this.scene.add(this.ring);

      for (let i = 0; i < this.burstN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 7.5;
        this.burstP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp + 0.8,
          life: 0.28 + Math.random() * 0.36,
        });
      }
      for (let i = 0; i < this.shardN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * 8;
        this.shardP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.abs(Math.sin(a)) * sp * 0.8 + 2,
          life: 0.4 + Math.random() * 0.4,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      this.rock.material.opacity = Math.max(0, this.rock.material.opacity - dt * 9);
      this.rock.scale.setScalar(Math.max(0.05, 1 - e * 2.2));
      this.halo.material.opacity = Math.max(0, this.halo.material.opacity - dt * 5);
      this.plume.material.opacity = Math.max(
        0,
        this.plume.material.opacity - dt * 2,
      );
      this.flash.material.opacity = Math.max(0, 0.95 * (1 - e * e));
      this.flash.scale.setScalar(1 + e * 1.8);
      this.flash.rotation.z += dt * 2;
      if (this.ring) {
        const re = Math.min(e * 1.4, 1);
        this.ring.scale.setScalar((0.5 + re * 4.8) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
        this.ring.rotation.z += dt * 1.4;
      }
    }

    this.integratePoints(this.trailP, dt, 0.9, 2.4);
    this.integratePoints(this.sootP, dt, 0.93, 1.6);
    this.integratePoints(this.burstP, dt, 0.88, -3.4);
    this.integratePoints(this.shardP, dt, 0.94, -14);
    this.writePoints(this.trailP, this.trail);
    this.writePoints(this.sootP, this.soot);
    this.writePoints(this.burstP, this.burst);
    this.writePoints(this.shardP, this.shard);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [
      this.core,
      this.plume,
      this.charge,
      this.trail,
      this.soot,
      this.burst,
      this.shard,
      this.flash,
    ];
    if (this.ring) objs.push(this.ring);
    for (const o of objs) scene.remove(o);

    for (const m of [
      this.halo,
      this.rock,
      this.plume,
      this.charge,
      this.trail,
      this.soot,
      this.burst,
      this.shard,
      this.flash,
      this.ring,
    ]) {
      if (!m) continue;
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

export function createMagmaBombGL(scale = 1) {
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

    let flashed = false;
    const onImpact = () => {
      if (flashed) return;
      flashed = true;
      targetEl.classList.add("fire-hit");
      setTimeout(() => targetEl.classList.remove("fire-hit"), 320);
    };

    const effect = new MagmaBombGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
