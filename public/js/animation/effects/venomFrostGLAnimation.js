// Venom frost hit: the magma bomb's arc and blast, but the thing in flight is
// a jagged shard of winter ice veined with venom, shedding frost motes and
// dripping poison, and it bursts into ice splinters and a venom splash.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const TRAVEL_DUR = 0.32;
const POST_DUR = 0.5;
const CHARGE_DUR = 0.16;

const HALO_TINT = 0x8fd8ff;
const VENOM_TINT = 0x9a3fd0;
const MIST_TINT = 0x5a2a78;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeShardTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  // A long crystal pointing right (+x), so it can be rotated to the flight angle.
  const outline = [
    [122, 64],
    [86, 44],
    [62, 30],
    [40, 42],
    [8, 56],
    [24, 66],
    [6, 78],
    [42, 88],
    [64, 98],
    [88, 84],
  ];
  ctx.beginPath();
  outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();

  const body = ctx.createLinearGradient(8, 30, 122, 98);
  body.addColorStop(0, "rgba(120,170,215,0.92)");
  body.addColorStop(0.45, "rgba(196,232,255,0.98)");
  body.addColorStop(1, "rgba(236,250,255,1)");
  ctx.fillStyle = body;
  ctx.fill();

  ctx.save();
  ctx.clip();

  // Facets: darker lower faces, one bright upper ridge.
  ctx.fillStyle = "rgba(70,110,160,0.35)";
  ctx.beginPath();
  ctx.moveTo(122, 64);
  ctx.lineTo(88, 84);
  ctx.lineTo(64, 98);
  ctx.lineTo(42, 88);
  ctx.lineTo(60, 66);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(122, 64);
  ctx.lineTo(60, 62);
  ctx.lineTo(24, 66);
  ctx.stroke();

  // Venom veins running through the ice.
  const veins = [
    [16, 70, 40, 64, 62, 72, 92, 68],
    [36, 50, 54, 58, 70, 52],
    [48, 84, 66, 80, 80, 88],
  ];
  for (const path of veins) {
    ctx.beginPath();
    ctx.moveTo(path[0], path[1]);
    for (let i = 2; i < path.length; i += 2) ctx.lineTo(path[i], path[i + 1]);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(110,30,160,0.5)";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = "rgba(170,70,230,0.85)";
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.strokeStyle = "rgba(226,170,255,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = "rgba(230,248,255,0.9)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  outline.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();

  return canvasTex(c);
}

function makeHaloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 16, 64, 64, 64);
  g.addColorStop(0, "rgba(200,236,255,0.5)");
  g.addColorStop(0.45, "rgba(120,190,255,0.3)");
  g.addColorStop(0.75, "rgba(140,60,200,0.14)");
  g.addColorStop(1, "rgba(90,30,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeMistTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
  g.addColorStop(0, "rgba(150,90,190,0.55)");
  g.addColorStop(0.5, "rgba(100,50,140,0.3)");
  g.addColorStop(1, "rgba(60,24,90,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeFlashTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(210,240,255,0.95)");
  g.addColorStop(0.55, "rgba(120,180,255,0.5)");
  g.addColorStop(0.8, "rgba(130,50,190,0.18)");
  g.addColorStop(1, "rgba(60,20,110,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(190,230,255,0.7)");
  g.addColorStop(1, "rgba(190,230,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeDropTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(14, 13, 0, 16, 16, 15);
  g.addColorStop(0, "rgba(240,200,255,1)");
  g.addColorStop(0.35, "rgba(170,70,230,0.95)");
  g.addColorStop(0.8, "rgba(90,20,140,0.6)");
  g.addColorStop(1, "rgba(90,20,140,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(200,236,255,0)");
  g.addColorStop(0.62, "rgba(200,236,255,0)");
  g.addColorStop(0.78, "rgba(236,250,255,0.95)");
  g.addColorStop(0.88, "rgba(160,80,220,0.4)");
  g.addColorStop(1, "rgba(160,80,220,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let shardTex = null;
let haloTex = null;
let mistTex = null;
let flashTex = null;
let moteTex = null;
let dropTex = null;
let ringTex = null;

function bakeTextures() {
  if (!shardTex) shardTex = makeShardTexture();
  if (!haloTex) haloTex = makeHaloTexture();
  if (!mistTex) mistTex = makeMistTexture();
  if (!flashTex) flashTex = makeFlashTexture();
  if (!moteTex) moteTex = makeMoteTexture();
  if (!dropTex) dropTex = makeDropTexture();
  if (!ringTex) ringTex = makeRingTexture();
}

function billboard(w, h, opacity, tex, color, blending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: blending ?? THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function particlePoints(count, size, color, tex, blending) {
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
    blending: blending ?? THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class VenomFrostGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.lifetime = CHARGE_DUR + TRAVEL_DUR + POST_DUR + 0.2;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.22, 3.2),
      0,
    );

    this.core = new THREE.Group();
    this.halo = billboard(2.6 * scale, 2.6 * scale, 0.8, haloTex, HALO_TINT);
    this.shard = billboard(
      2 * scale,
      2 * scale,
      1,
      shardTex,
      undefined,
      THREE.NormalBlending,
    );
    this.shard.position.z = 0.02;
    this.core.add(this.halo);
    this.core.add(this.shard);
    scene.add(this.core);

    this.wake = billboard(
      3.2 * scale,
      1.4 * scale,
      0.5,
      mistTex,
      MIST_TINT,
      THREE.NormalBlending,
    );
    scene.add(this.wake);

    this.charge = billboard(1.5 * scale, 1.5 * scale, 0, haloTex, VENOM_TINT);
    this.charge.position.copy(this.p0);
    scene.add(this.charge);

    const ps = getParticleScale();
    this.moteN = Math.max(6, Math.round(30 * ps));
    this.motes = particlePoints(this.moteN, 0.26 * scale, 0xd8f2ff, moteTex);
    this.moteP = [];
    scene.add(this.motes);

    this.dripN = Math.max(4, Math.round(16 * ps));
    this.drips = particlePoints(
      this.dripN,
      0.3 * scale,
      0xffffff,
      dropTex,
      THREE.NormalBlending,
    );
    this.dripP = [];
    scene.add(this.drips);

    this.splinterN = Math.max(6, Math.round(26 * ps));
    this.splinters = particlePoints(
      this.splinterN,
      0.36 * scale,
      0xe6f6ff,
      moteTex,
    );
    this.splinterP = [];
    scene.add(this.splinters);

    this.splashN = Math.max(6, Math.round(24 * ps));
    this.splash = particlePoints(
      this.splashN,
      0.4 * scale,
      0xffffff,
      dropTex,
      THREE.NormalBlending,
    );
    this.splashP = [];
    scene.add(this.splash);

    this.mistN = Math.max(3, Math.round(10 * ps));
    this.mist = particlePoints(
      this.mistN,
      1.1 * scale,
      MIST_TINT,
      mistTex,
      THREE.NormalBlending,
    );
    this.mistP = [];
    scene.add(this.mist);

    this.flash = billboard(5 * scale, 5 * scale, 0, flashTex);
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

    if (this.age < CHARGE_DUR) {
      const cp = this.age / CHARGE_DUR;
      this.core.position.copy(this.p0);
      this.core.scale.setScalar(0.2 + cp * 0.6);
      this.halo.material.opacity = 0.4 + cp * 0.4;
      this.wake.visible = false;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.85;
      this.charge.scale.setScalar(0.4 + cp * 1.6);
      this.charge.rotation.z -= dt * 4;
      return true;
    }
    this.charge.visible = false;

    const flightAge = this.age - CHARGE_DUR;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);
    const eased = t < 0.82 ? t : 0.82 + (1 - (1 - (t - 0.82) / 0.18) ** 2) * 0.18;

    if (t < 1) {
      this.core.scale.setScalar(1);
      this.wake.visible = true;
      const pos = this.bezier(eased);
      const ang = this.bezierAngle(eased);
      this.core.position.copy(pos);
      // The shard points along its path instead of tumbling like the rock.
      this.shard.rotation.z = ang;
      this.halo.scale.setScalar(1 + 0.08 * Math.sin(flightAge * 26));
      this.wake.position.set(
        pos.x - Math.cos(ang) * 1.6 * this.scale,
        pos.y - Math.sin(ang) * 1.6 * this.scale,
        0,
      );
      this.wake.rotation.z = ang;

      if (this.moteP.length < this.moteN) {
        this.moteP.push({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 1.4,
          vy: (Math.random() - 0.5) * 1.4,
          life: 0.25 + Math.random() * 0.3,
        });
      }
      if (this.dripP.length < this.dripN && Math.random() < 0.6) {
        this.dripP.push({
          x: pos.x - Math.cos(ang) * 0.4 * this.scale,
          y: pos.y - Math.sin(ang) * 0.4 * this.scale,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -0.4 - Math.random() * 0.6,
          life: 0.35 + Math.random() * 0.3,
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.flash.visible = true;

      this.ring = billboard(2, 2, 0.9, ringTex);
      this.ring.position.copy(this.to);
      this.scene.add(this.ring);

      for (let i = 0; i < this.splinterN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 3 + Math.random() * 8;
        this.splinterP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.22 + Math.random() * 0.3,
        });
      }
      for (let i = 0; i < this.splashN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2.5 + Math.random() * 5.5;
        this.splashP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.abs(Math.sin(a)) * sp * 0.7 + 2.4,
          life: 0.42 + Math.random() * 0.36,
        });
      }
      for (let i = 0; i < this.mistN; i++) {
        this.mistP.push({
          x: this.to.x + (Math.random() - 0.5) * 1.2 * this.scale,
          y: this.to.y + (Math.random() - 0.5) * 0.8 * this.scale,
          vx: (Math.random() - 0.5) * 1.2,
          vy: 0.2 + Math.random() * 0.5,
          life: 0.4 + Math.random() * 0.3,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      this.shard.material.opacity = Math.max(0, this.shard.material.opacity - dt * 10);
      this.shard.scale.setScalar(Math.max(0.05, 1 - e * 2.4));
      this.halo.material.opacity = Math.max(0, this.halo.material.opacity - dt * 5);
      this.wake.material.opacity = Math.max(0, this.wake.material.opacity - dt * 2);
      this.flash.material.opacity = Math.max(0, 0.9 * (1 - e * e));
      this.flash.scale.setScalar(1 + e * 1.6);
      if (this.ring) {
        const re = Math.min(e * 1.4, 1);
        this.ring.scale.setScalar((0.5 + re * 4.6) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
        this.ring.rotation.z -= dt * 1.2;
      }
    }

    this.integratePoints(this.moteP, dt, 0.9, 0.4);
    this.integratePoints(this.dripP, dt, 0.96, -9);
    this.integratePoints(this.splinterP, dt, 0.86, -2);
    this.integratePoints(this.splashP, dt, 0.94, -13);
    this.integratePoints(this.mistP, dt, 0.95, 0.6);
    this.writePoints(this.moteP, this.motes);
    this.writePoints(this.dripP, this.drips);
    this.writePoints(this.splinterP, this.splinters);
    this.writePoints(this.splashP, this.splash);
    this.writePoints(this.mistP, this.mist);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [
      this.core,
      this.wake,
      this.charge,
      this.motes,
      this.drips,
      this.splinters,
      this.splash,
      this.mist,
      this.flash,
    ];
    if (this.ring) objs.push(this.ring);
    for (const o of objs) scene.remove(o);

    for (const m of [
      this.halo,
      this.shard,
      this.wake,
      this.charge,
      this.motes,
      this.drips,
      this.splinters,
      this.splash,
      this.mist,
      this.flash,
      this.ring,
    ]) {
      if (!m) continue;
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

export function createVenomFrostGL(scale = 1) {
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
      targetEl.classList.add("ice-hit");
      setTimeout(() => targetEl.classList.remove("ice-hit"), 320);
    };

    const effect = new VenomFrostGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
