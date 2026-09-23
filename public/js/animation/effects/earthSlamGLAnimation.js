// Earth slam: the ground under the target buckles, throwing a dust ring, a
// plume and a spray of small stone shards.

import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const RING_DUR = 0.46;
const PLUME_DUR = 0.62;
const FADE_DUR = 0.24;

const DUST_TINT = 0xc9a26a;
const STONE_TINT = 0x8a6a43;
const DEEP_TINT = 0x5a4530;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(128, 128, 62, 128, 128, 126);
  g.addColorStop(0, "rgba(90,69,48,0)");
  g.addColorStop(0.55, "rgba(201,162,106,0.75)");
  g.addColorStop(0.82, "rgba(138,106,67,0.55)");
  g.addColorStop(1, "rgba(138,106,67,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);

  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 60 + Math.random() * 68;
    ctx.beginPath();
    ctx.arc(
      128 + Math.cos(a) * r,
      128 + Math.sin(a) * r,
      6 + Math.random() * 14,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  return canvasTex(c);
}

function makeFractureTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");

  ctx.strokeStyle = "rgba(38,28,18,0.9)";
  ctx.lineCap = "round";

  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3;
    let x = 128;
    let y = 128;
    let dir = a;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      dir += (Math.random() - 0.5) * 0.7;
      x += Math.cos(dir) * 24;
      y += Math.sin(dir) * 24;
      ctx.lineTo(x, y);
    }
    ctx.lineWidth = 5 - i * 0.2;
    ctx.stroke();
  }

  return canvasTex(c);
}

function makeDustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(201,162,106,0.85)");
  g.addColorStop(0.45, "rgba(138,106,67,0.45)");
  g.addColorStop(1, "rgba(90,69,48,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTex(c);
}

function makeShardTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");

  ctx.beginPath();
  ctx.moveTo(32, 2);
  ctx.lineTo(54, 34);
  ctx.lineTo(36, 62);
  ctx.lineTo(12, 44);
  ctx.closePath();
  const g = ctx.createLinearGradient(12, 2, 54, 62);
  g.addColorStop(0, "rgba(214,182,132,1)");
  g.addColorStop(0.5, "rgba(138,106,67,1)");
  g.addColorStop(1, "rgba(58,44,30,1)");
  ctx.fillStyle = g;
  ctx.fill();

  return canvasTex(c);
}

let ringTex = null;
let fractureTex = null;
let dustTex = null;
let shardTex = null;

function bakeTextures() {
  if (!ringTex) ringTex = makeRingTexture();
  if (!fractureTex) fractureTex = makeFractureTexture();
  if (!dustTex) dustTex = makeDustTexture();
  if (!shardTex) shardTex = makeShardTexture();
}

function billboard(w, h, opacity, tex, color) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

class EarthSlamGL {
  constructor(scene, ground, scale, big) {
    this.scale = scale;
    this.big = big;
    this.age = 0;
    this.lifetime = PLUME_DUR + FADE_DUR;
    this.ground = ground.clone();

    this.fracture = billboard(
      4.2 * scale,
      1.5 * scale,
      0,
      fractureTex,
      DEEP_TINT,
    );
    this.fracture.position.set(ground.x, ground.y, 0.03);
    scene.add(this.fracture);

    this.rings = [];
    const ringCount = big ? 2 : 1;
    for (let i = 0; i < ringCount; i++) {
      const ring = billboard(4.6 * scale, 1.7 * scale, 0, ringTex, DUST_TINT);
      ring.position.set(ground.x, ground.y + 0.06 * scale, 0.05 + i * 0.01);
      scene.add(ring);
      this.rings.push({ mesh: ring, delay: i * 0.14 });
    }

    this.plume = billboard(2.6 * scale, 2.9 * scale, 0, dustTex, DUST_TINT);
    this.plume.position.set(ground.x, ground.y + 0.9 * scale, 0.04);
    scene.add(this.plume);

    const ps = getParticleScale();

    this.shards = [];
    const shardCount = Math.max(4, Math.round((big ? 18 : 11) * ps));
    for (let i = 0; i < shardCount; i++) {
      const size = (0.16 + Math.random() * 0.17) * scale;
      const mesh = billboard(size, size * 1.35, 1, shardTex, STONE_TINT);
      mesh.position.set(ground.x, ground.y + 0.1 * scale, 0.09);
      scene.add(mesh);

      const a = Math.PI * (0.15 + Math.random() * 0.7);
      const sp = (5.5 + Math.random() * 6.5) * (big ? 1.25 : 1);
      this.shards.push({
        mesh,
        vx: Math.cos(a) * sp * (Math.random() < 0.5 ? 1 : -1),
        vy: Math.sin(a) * sp,
        spin: (Math.random() - 0.5) * 16,
      });
    }

    this.dustMax = Math.max(12, Math.round((big ? 60 : 36) * ps));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(this.dustMax * 3), 3),
    );
    geo.setDrawRange(0, 0);
    this.dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        map: dustTex,
        size: 0.55 * scale,
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false,
        color: DUST_TINT,
        opacity: 0.8,
      }),
    );
    scene.add(this.dust);
    this.dustP = [];
    this.emit = 0;
  }

  puff(count) {
    for (let i = 0; i < count; i++) {
      if (this.dustP.length >= this.dustMax) this.dustP.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 1.2 + Math.random() * 3.4;
      this.dustP.push({
        x: this.ground.x + (Math.random() - 0.5) * 1.4 * this.scale,
        y: this.ground.y + Math.random() * 0.3 * this.scale,
        vx: Math.cos(a) * sp,
        vy: Math.abs(Math.sin(a)) * sp * 0.8,
        life: 0.3 + Math.random() * 0.4,
      });
    }
  }

  writeDust() {
    const arr = this.dust.geometry.attributes.position.array;
    for (let i = 0; i < this.dustP.length; i++) {
      arr[i * 3] = this.dustP[i].x;
      arr[i * 3 + 1] = this.dustP[i].y;
      arr[i * 3 + 2] = 0.06;
    }
    this.dust.geometry.setDrawRange(0, this.dustP.length);
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;
    const ps = getParticleScale();
    const out = Math.max(0, 1 - Math.max(0, this.age - PLUME_DUR) / FADE_DUR);

    this.fracture.material.opacity = Math.min(this.age / 0.07, 1) * 0.85 * out;
    this.fracture.scale.setScalar(0.7 + Math.min(this.age / 0.2, 1) * 0.5);

    for (const { mesh, delay } of this.rings) {
      const t = (this.age - delay) / RING_DUR;
      if (t < 0) continue;
      const e = Math.min(t, 1);
      mesh.scale.setScalar(0.25 + e * (this.big ? 2.3 : 1.7));
      mesh.material.opacity = Math.max(0, 1 - e * e) * out;
    }

    const pt = Math.min(this.age / PLUME_DUR, 1);
    this.plume.scale.set(0.5 + pt * 1.5, 0.35 + pt * 1.9, 1);
    this.plume.position.y = this.ground.y + (0.6 + pt * 1.5) * this.scale;
    this.plume.material.opacity = Math.sin(pt * Math.PI) * 0.75 * out;

    for (const s of this.shards) {
      s.vy -= 16 * dt;
      s.vx *= 0.99;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.rotation.z += s.spin * dt;
      s.mesh.material.opacity = out * Math.max(0, 1 - this.age / PLUME_DUR);
    }

    this.emit -= dt;
    if (this.emit <= 0 && this.age < RING_DUR) {
      this.emit = 0.045;
      this.puff(Math.max(1, Math.round((this.big ? 6 : 4) * ps)));
    }

    for (let i = this.dustP.length - 1; i >= 0; i--) {
      const p = this.dustP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.dustP.splice(i, 1);
        continue;
      }
      p.vx *= 0.93;
      p.vy = p.vy * 0.93 - 1.4 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.writeDust();
    this.dust.material.opacity = 0.8 * out;

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const meshes = [
      this.fracture,
      this.plume,
      this.dust,
      ...this.rings.map((r) => r.mesh),
      ...this.shards.map((s) => s.mesh),
    ];

    for (const o of meshes) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createEarthSlamGL(scale = 1, big = false) {
  return async (opts) => {
    const { targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;
    bakeTextures();

    const rect = targetEl.getBoundingClientRect();
    const ground = screenToWorld(
      rect.left + rect.width / 2,
      rect.bottom - rect.height * 0.04,
      st.camera,
    );

    const effect = new EarthSlamGL(st.scene, ground, scale, big);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
