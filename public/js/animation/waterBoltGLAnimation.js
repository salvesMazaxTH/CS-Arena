// Default water hit: a Three.js water bolt in the shared #webgl-container, same
// light recipe as the fire bolt (persistent renderer, pixelRatio 1, no
// post-processing). Falls back to waterAnimation.js when WebGL is unavailable.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale } from "./effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "./glStage.js";

const TRAVEL_DUR = 0.32;
const POST_DUR = 0.5;
const CHARGE_DUR = 0.13;

const BODY_TINT = 0x8fd8ee;
const BIG_BODY_TINT = 0x6fc4e4;
const SPRAY_TINT = 0xbfecff;
const FOAM_TINT = 0xeafcff;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBeadTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.55, "rgba(255,255,255,0.20)");
  g.addColorStop(0.74, "rgba(255,255,255,0.42)");
  g.addColorStop(0.84, "rgba(255,255,255,0.92)");
  g.addColorStop(0.93, "rgba(255,255,255,0.30)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeSprayTexture() {
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

function makeFoamTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, "rgba(255,255,255,0.70)");
  g.addColorStop(0.6, "rgba(235,250,255,0.28)");
  g.addColorStop(1, "rgba(220,244,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rr = 24 + Math.random() * 16;
    const x = 48 + Math.cos(a) * rr;
    const y = 48 + Math.sin(a) * rr;
    const r = 8 + Math.random() * 12;
    const b = ctx.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, "rgba(255,255,255,0.55)");
    b.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = b;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
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

function makeSpecTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

let beadTex = null;
let sprayTex = null;
let foamTex = null;
let ringTex = null;
let specTex = null;

function bakeTextures() {
  if (!beadTex) beadTex = makeBeadTexture();
  if (!sprayTex) sprayTex = makeSprayTexture();
  if (!foamTex) foamTex = makeFoamTexture();
  if (!ringTex) ringTex = makeRingTexture();
  if (!specTex) specTex = makeSpecTexture();
}

function billboard(w, h, opacity, tex, blending = THREE.NormalBlending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending,
    depthWrite: false,
    opacity,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function dropletPoints(count, size, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  const mat = new THREE.PointsMaterial({
    map: sprayTex,
    size,
    sizeAttenuation: true,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class WaterBoltGL {
  constructor(scene, from, to, scale, big, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.big = big;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.chargeDur = big ? CHARGE_DUR : 0;
    this.lifetime = this.chargeDur + TRAVEL_DUR + POST_DUR + 0.15;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.2, 3),
      0,
    );

    const tint = big ? BIG_BODY_TINT : BODY_TINT;

    this.core = new THREE.Group();
    this.body = [
      billboard(2.4 * scale, 2.4 * scale, 0.55, beadTex),
      billboard(1.5 * scale, 1.5 * scale, 0.8, beadTex),
    ];
    this.body[1].position.z = 0.004;
    for (const b of this.body) {
      b.material.color.setHex(tint);
      this.core.add(b);
    }
    this.spec = billboard(
      0.7 * scale,
      0.7 * scale,
      0.9,
      specTex,
      THREE.AdditiveBlending,
    );
    this.spec.position.set(-0.45 * scale, 0.4 * scale, 0.008);
    this.core.add(this.spec);
    scene.add(this.core);

    if (big) {
      this.charge = billboard(1.1 * scale, 1.1 * scale, 0, beadTex);
      this.charge.material.color.setHex(tint);
      this.charge.position.copy(this.p0);
      scene.add(this.charge);
    }

    const ps = getParticleScale();
    this.trailN = Math.max(6, Math.round(30 * ps));
    this.trail = dropletPoints(this.trailN, 0.3 * scale, SPRAY_TINT);
    this.trailP = [];
    scene.add(this.trail);

    this.burstN = Math.round((big ? 58 : 42) * ps);
    this.burst = dropletPoints(this.burstN, 0.34 * scale, SPRAY_TINT);
    this.burstP = [];
    scene.add(this.burst);

    this.foam = billboard(3 * scale, 3 * scale, 0, foamTex);
    this.foam.material.color.setHex(FOAM_TINT);
    this.foam.position.copy(this.to);
    this.foam.visible = false;
    scene.add(this.foam);
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

    if (this.charge && this.age < this.chargeDur) {
      const cp = Math.max(this.age, 0) / this.chargeDur;
      this.core.position.copy(this.p0);
      this.core.scale.setScalar(0.2 + cp * 0.55);
      this.core.rotation.z += dt * 1.5;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.8;
      this.charge.scale.setScalar(0.5 + cp * 1.3);
      return true;
    }
    if (this.charge) this.charge.visible = false;

    const flightAge = this.age - this.chargeDur;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);
    const wobble = 1 + 0.09 * Math.sin(flightAge * 40);

    if (t < 1) {
      const pos = this.bezier(t);
      const ang = this.bezierAngle(t);
      this.core.position.copy(pos);
      this.core.rotation.z = ang;
      // teardrop: stretch along travel, squash across, with a surface wobble
      this.core.scale.set(1.32 * wobble, 0.82 / wobble, 1);
      this.spec.rotation.z = -ang;

      if (this.trailP.length < this.trailN) {
        this.trailP.push({
          x: pos.x + (Math.random() - 0.5) * 0.3,
          y: pos.y + (Math.random() - 0.5) * 0.3,
          vx: (Math.random() - 0.5) * 1.4,
          vy: -0.4 - Math.random() * 1.2,
          life: 0.28 + Math.random() * 0.3,
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.core.rotation.z = 0;

      this.foam.visible = true;
      this.ring = billboard(2, 2, 0.9, ringTex);
      this.ring.material.color.setHex(SPRAY_TINT);
      this.ring.position.set(this.to.x, this.to.y - 0.3 * this.scale, 0);
      // laid back toward the ground so it foreshortens like a puddle ripple
      this.ring.rotation.x = -1.15;
      this.scene.add(this.ring);
      if (this.big) {
        this.ring2 = billboard(2, 2, 0.7, ringTex);
        this.ring2.material.color.setHex(FOAM_TINT);
        this.ring2.position.copy(this.ring.position);
        this.ring2.rotation.x = -1.15;
        this.scene.add(this.ring2);
      }

      const up = this.big ? 1 : 0.8;
      const spread = this.big ? 9 : 6.5;
      for (let i = 0; i < this.burstN; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.35;
        const sp = 3 + Math.random() * spread;
        this.burstP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.abs(Math.sin(a)) * sp * up + 1.5,
          life: 0.3 + Math.random() * 0.4,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      for (const b of this.body) {
        b.material.opacity = Math.max(0, b.material.opacity - dt * 7);
      }
      this.spec.material.opacity = Math.max(0, this.spec.material.opacity - dt * 10);
      // collapse the bead into a flat sheet on contact
      this.core.scale.set(2.2 + e * 3, Math.max(0.05, 0.5 - e), 1);

      this.foam.material.opacity = Math.max(0, 0.75 * (1 - e * 1.4));
      this.foam.scale.setScalar(1 + e * 2.4);

      if (this.ring) {
        const re = Math.min(e * 1.4, 1);
        this.ring.scale.setScalar((0.6 + re * 4.6) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
      }
      if (this.ring2) {
        const re = Math.min(e * 0.95, 1);
        this.ring2.scale.setScalar((0.5 + re * 6) * this.scale);
        this.ring2.material.opacity = Math.max(0, 0.6 * (1 - re) * (1 - re));
      }
    }

    this.integratePoints(this.trailP, dt, 0.92, -5.5);
    this.integratePoints(this.burstP, dt, 0.9, -13);
    this.writePoints(this.trailP, this.trail);
    this.writePoints(this.burstP, this.burst);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.core, this.trail, this.burst, this.foam];
    if (this.charge) objs.push(this.charge);
    if (this.ring) objs.push(this.ring);
    if (this.ring2) objs.push(this.ring2);
    for (const o of objs) scene.remove(o);

    for (const b of this.body) {
      b.geometry.dispose();
      b.material.dispose();
    }
    this.spec.geometry.dispose();
    this.spec.material.dispose();
    for (const m of [this.trail, this.burst, this.foam]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    if (this.charge) {
      this.charge.geometry.dispose();
      this.charge.material.dispose();
    }
    if (this.ring) {
      this.ring.geometry.dispose();
      this.ring.material.dispose();
    }
    if (this.ring2) {
      this.ring2.geometry.dispose();
      this.ring2.material.dispose();
    }
  }
}

export function createWaterBoltGL(scale, big = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) {
      const { createWaterBoltAnimation } = await import("./waterAnimation.js");
      await createWaterBoltAnimation(scale)(opts);
      return;
    }
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

    const effect = new WaterBoltGL(st.scene, from, to, scale, big, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
