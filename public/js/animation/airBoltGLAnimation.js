// Default air hit: a Three.js wind blade in the shared #webgl-container, same
// light recipe as the fire, water, ice and earth bolts.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "./glStage.js";

const TRAVEL_DUR = 0.26;
const POST_DUR = 0.44;
const CHARGE_DUR = 0.16;

const BLADE_TINT = 0xf6f4ec;
const BIG_BLADE_TINT = 0xfffdf4;
const GUST_TINT = 0xe6e2d4;
const DUST_TINT = 0xd8cfb8;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCrescentTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.lineCap = "round";

  const g = ctx.createLinearGradient(18, 0, 118, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.4, "rgba(255,255,255,0.9)");
  g.addColorStop(0.75, "rgba(246,244,236,0.55)");
  g.addColorStop(1, "rgba(230,226,212,0)");

  ctx.strokeStyle = g;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(64, 64, 47, -1.25, 1.25);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(64, 64, 36, -0.95, 0.95);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(64, 64, 57, -0.62, 0.62);
  ctx.stroke();
  return canvasTex(c);
}

function makeStreakTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.5, "rgba(255,255,255,0.62)");
  g.addColorStop(0.68, "rgba(240,238,228,0.34)");
  g.addColorStop(1, "rgba(240,238,228,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(64, 16, 62, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeDustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,253,246,0.8)");
  g.addColorStop(0.5, "rgba(216,207,184,0.3)");
  g.addColorStop(1, "rgba(216,207,184,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeSwirlTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.lineCap = "round";
  for (let arm = 0; arm < 5; arm++) {
    const a0 = (arm / 5) * Math.PI * 2;
    ctx.strokeStyle = "rgba(255,255,255," + (0.55 - arm * 0.06).toFixed(2) + ")";
    ctx.lineWidth = 3.4 - arm * 0.3;
    ctx.beginPath();
    for (let s = 0; s <= 26; s++) {
      const p = s / 26;
      const r = 9 + p * 53;
      const a = a0 + p * 2.4;
      const x = 64 + Math.cos(a) * r;
      const y = 64 + Math.sin(a) * r;
      if (s === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvasTex(c);
}

let crescentTex = null;
let streakTex = null;
let dustTex = null;
let swirlTex = null;

function bakeTextures() {
  if (!crescentTex) crescentTex = makeCrescentTexture();
  if (!streakTex) streakTex = makeStreakTexture();
  if (!dustTex) dustTex = makeDustTexture();
  if (!swirlTex) swirlTex = makeSwirlTexture();
}

function billboard(w, h, opacity, tex, blending = THREE.AdditiveBlending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending,
    depthWrite: false,
    opacity,
  });
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
    blending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class AirBoltGL {
  constructor(scene, from, to, scale, big, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.big = big;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.chargeDur = big ? CHARGE_DUR : 0;
    this.lifetime = this.chargeDur + TRAVEL_DUR + POST_DUR + 0.12;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.1, 1.8),
      0,
    );

    const dir = new THREE.Vector3().subVectors(this.p2, this.p0).normalize();
    this.perp = new THREE.Vector3(-dir.y, dir.x, 0);
    this.weave = Math.min(dist * 0.09, 1.4) * (Math.random() < 0.5 ? 1 : -1);
    this.heading = Math.atan2(dir.y, dir.x);

    const tint = big ? BIG_BLADE_TINT : BLADE_TINT;

    this.core = new THREE.Group();
    this.blades = [
      billboard(3.2 * scale, 3.2 * scale, 0.9, crescentTex),
      billboard(2.2 * scale, 2.2 * scale, 0.5, crescentTex),
    ];
    this.blades[1].position.z = -0.004;
    this.blades[1].rotation.z = Math.PI;
    for (const b of this.blades) {
      b.material.color.setHex(tint);
      this.core.add(b);
    }
    this.core.rotation.z = this.heading;
    scene.add(this.core);

    this.swirl = billboard(2.8 * scale, 2.8 * scale, 0.3, swirlTex);
    this.swirl.material.color.setHex(GUST_TINT);
    scene.add(this.swirl);

    if (big) {
      this.charge = billboard(2.4 * scale, 2.4 * scale, 0, swirlTex);
      this.charge.material.color.setHex(GUST_TINT);
      this.charge.position.copy(this.p0);
      scene.add(this.charge);
    }

    const ps = getParticleScale();
    this.trailN = Math.max(6, Math.round(22 * ps));
    this.trail = particlePoints(
      this.trailN,
      0.9 * scale,
      GUST_TINT,
      streakTex,
      THREE.AdditiveBlending,
    );
    this.trailP = [];
    scene.add(this.trail);

    this.dustN = Math.max(8, Math.round((big ? 34 : 22) * ps));
    this.dust = particlePoints(
      this.dustN,
      0.24 * scale,
      DUST_TINT,
      dustTex,
      THREE.NormalBlending,
    );
    this.dustP = [];
    scene.add(this.dust);

    this.burstN = Math.round((big ? 46 : 32) * ps);
    this.burst = particlePoints(
      this.burstN,
      0.62 * scale,
      GUST_TINT,
      streakTex,
      THREE.AdditiveBlending,
    );
    this.burstP = [];
    scene.add(this.burst);

    this.gust = billboard(4.6 * scale, 4.6 * scale, 0, swirlTex);
    this.gust.material.color.setHex(BLADE_TINT);
    this.gust.position.copy(this.to);
    this.gust.visible = false;
    scene.add(this.gust);

    this.slashes = [];
  }

  bezier(t) {
    const u = 1 - t;
    const base = new THREE.Vector3(
      u * u * this.p0.x + 2 * u * t * this.ctrl.x + t * t * this.p2.x,
      u * u * this.p0.y + 2 * u * t * this.ctrl.y + t * t * this.p2.y,
      0,
    );
    const off = Math.sin(t * Math.PI * 2) * this.weave * (1 - t);
    return base.addScaledVector(this.perp, off);
  }

  spawnDust(x, y, spread, life) {
    if (this.dustP.length >= this.dustN) return;
    const a = Math.random() * Math.PI * 2;
    const sp = spread * (0.4 + Math.random() * 0.8);
    this.dustP.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: life * (0.6 + Math.random() * 0.8),
    });
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

    if (this.charge && this.age < this.chargeDur) {
      const cp = this.age / this.chargeDur;
      this.core.position.copy(this.p0);
      this.core.scale.setScalar(0.2 + cp * 0.8);
      this.swirl.position.copy(this.p0);
      this.swirl.rotation.z += dt * 10;
      this.swirl.material.opacity = cp * 0.34;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.7;
      this.charge.rotation.z -= dt * 7;
      this.charge.scale.setScalar(1.9 - cp * 1.3);
      // The gather pulls air inward, so these fly at the muzzle rather than away from it.
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 * this.scale;
      this.dustP.push({
        x: this.p0.x + Math.cos(a) * r,
        y: this.p0.y + Math.sin(a) * r,
        vx: -Math.cos(a) * 8,
        vy: -Math.sin(a) * 8,
        life: 0.18 + Math.random() * 0.12,
      });
      this.integratePoints(this.dustP, dt, 0.97, 0);
      this.writePoints(this.dustP, this.dust);
      return true;
    }
    if (this.charge) this.charge.visible = false;

    const flightAge = this.age - this.chargeDur;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);

    if (t < 1) {
      const pos = this.bezier(t);
      this.core.position.copy(pos);
      this.core.scale.setScalar(1);
      this.blades[0].rotation.z -= dt * 17;
      this.blades[1].rotation.z += dt * 12;
      this.swirl.position.copy(pos);
      this.swirl.rotation.z += dt * 14;
      this.swirl.material.opacity = 0.28;

      if (this.trailP.length < this.trailN) {
        this.trailP.push({
          x: pos.x - Math.cos(this.heading) * 0.4,
          y: pos.y - Math.sin(this.heading) * 0.4,
          vx: -Math.cos(this.heading) * (2.5 + Math.random() * 2.5),
          vy: -Math.sin(this.heading) * (2.5 + Math.random() * 2.5),
          life: 0.18 + Math.random() * 0.2,
        });
      }
      if (Math.random() < 0.5) this.spawnDust(pos.x, pos.y, 1.8, 0.4);
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.swirl.position.copy(this.to);
      this.gust.visible = true;

      const cuts = this.big ? 3 : 2;
      for (let i = 0; i < cuts; i++) {
        const slash = billboard(
          3.4 * this.scale,
          3.4 * this.scale,
          0.85,
          crescentTex,
        );
        slash.material.color.setHex(i === 0 ? BIG_BLADE_TINT : BLADE_TINT);
        slash.position.copy(this.to);
        slash.rotation.z = this.heading + (i - (cuts - 1) / 2) * 1.05;
        this.scene.add(slash);
        this.slashes.push({
          mesh: slash,
          delay: i * 0.05,
          spin: i % 2 ? -6 : 6,
        });
      }

      const spread = this.big ? 14 : 10;
      for (let i = 0; i < this.burstN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 4 + Math.random() * spread;
        this.burstP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.22 + Math.random() * 0.32,
        });
      }
      for (let i = 0; i < (this.big ? 16 : 10); i++) {
        this.spawnDust(this.to.x, this.to.y, 6, 0.6);
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      for (const b of this.blades) {
        b.material.opacity = Math.max(0, b.material.opacity - dt * 8);
      }
      this.core.scale.setScalar(1 + e * 1.3);
      this.core.rotation.z = this.heading;

      this.swirl.rotation.z += dt * 19;
      this.swirl.scale.setScalar(1 + e * 2.4);
      this.swirl.material.opacity = Math.max(0, 0.28 * (1 - e));

      this.gust.material.opacity = Math.max(0, 0.42 * (1 - e * e));
      this.gust.rotation.z -= dt * 6;
      this.gust.scale.setScalar(0.45 + e * 1.8);

      for (const s of this.slashes) {
        const se = (e * POST_DUR - s.delay) / 0.26;
        if (se < 0) {
          s.mesh.material.opacity = 0;
          continue;
        }
        const k = Math.min(se, 1);
        s.mesh.scale.set(0.4 + k * 2.6, 0.9 + k * 0.5, 1);
        s.mesh.rotation.z += dt * s.spin;
        s.mesh.material.opacity = Math.max(0, 0.85 * (1 - k) * (1 - k));
      }
    }

    this.integratePoints(this.trailP, dt, 0.87, 0.5);
    this.integratePoints(this.burstP, dt, 0.84, 0.3);
    this.integratePoints(this.dustP, dt, 0.94, 1.4);
    this.writePoints(this.trailP, this.trail);
    this.writePoints(this.burstP, this.burst);
    this.writePoints(this.dustP, this.dust);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const meshes = [this.swirl, this.gust, ...this.blades];
    const points = [this.trail, this.dust, this.burst];
    if (this.charge) meshes.push(this.charge);
    for (const s of this.slashes) meshes.push(s.mesh);

    scene.remove(this.core);
    for (const o of [this.swirl, this.gust, ...points]) scene.remove(o);
    if (this.charge) scene.remove(this.charge);
    for (const s of this.slashes) scene.remove(s.mesh);

    for (const m of [...meshes, ...points]) {
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

export function createAirBoltGL(scale, big = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    // No canvas fallback for air; skip the projectile when WebGL is unavailable.
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
      targetEl.classList.add("air-hit");
      setTimeout(() => targetEl.classList.remove("air-hit"), 320);
    };

    const effect = new AirBoltGL(st.scene, from, to, scale, big, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
