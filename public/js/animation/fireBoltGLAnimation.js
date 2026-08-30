// Default fire hit: a light Three.js fire bolt in the shared #webgl-container —
// persistent renderer, pixelRatio 1, no post-processing, additive billboards on
// a baked flame texture plus a Points trail. Falls back to fireballAnimation.js.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const TRAVEL_DUR = 0.3;
const POST_DUR = 0.42;
const CHARGE_DUR = 0.13;

const BIG_LEAF = [0xff7a2e, 0xffcf72, 0xcfe0ff];
const BIG_PLUME = 0xff5a26;

function makeFlameTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,244,1)");
  g.addColorStop(0.25, "rgba(255,214,130,0.95)");
  g.addColorStop(0.55, "rgba(255,110,30,0.55)");
  g.addColorStop(1, "rgba(120,20,4,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 5; i++) {
    const x = 32 + Math.random() * 64;
    const y = 32 + Math.random() * 64;
    const r = 14 + Math.random() * 26;
    const b = ctx.createRadialGradient(x, y, 0, x, y, r);
    b.addColorStop(0, "rgba(255,180,90,0.5)");
    b.addColorStop(1, "rgba(255,180,90,0)");
    ctx.fillStyle = b;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEmberTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,240,210,1)");
  g.addColorStop(0.5, "rgba(255,150,60,0.7)");
  g.addColorStop(1, "rgba(255,150,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,205,150,0)");
  g.addColorStop(0.62, "rgba(255,205,150,0)");
  g.addColorStop(0.79, "rgba(255,234,196,0.95)");
  g.addColorStop(0.9, "rgba(255,140,60,0.32)");
  g.addColorStop(1, "rgba(255,140,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

let flameTex = null;
let emberTex = null;
let ringTex = null;

function screenToWorld(x, y, camera) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const out = new THREE.Vector3();
  ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), out);
  return out;
}

function billboard(w, h, opacity, tex) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex || flameTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function emberPoints(count, size, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  const mat = new THREE.PointsMaterial({
    map: emberTex,
    size,
    sizeAttenuation: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class FireBoltGL {
  constructor(scene, from, to, scale, big, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.big = big;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.chargeDur = big ? CHARGE_DUR : 0;
    this.lifetime = this.chargeDur + TRAVEL_DUR + POST_DUR + 0.2;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.22, 3.2),
      0,
    );

    this.core = new THREE.Group();
    this.leaves = [
      billboard(2.0 * scale, 2.6 * scale, 0.9),
      billboard(1.5 * scale, 1.9 * scale, 0.95),
      billboard(1.0 * scale, 1.3 * scale, 1),
    ];
    for (const l of this.leaves) this.core.add(l);
    scene.add(this.core);

    this.plume = billboard(3.6 * scale, 1.5 * scale, 0.5);
    scene.add(this.plume);

    if (big) {
      this.leaves.forEach((l, i) => l.material.color.setHex(BIG_LEAF[i]));
      this.plume.material.color.setHex(BIG_PLUME);
      this.charge = billboard(1.3 * scale, 1.3 * scale, 0);
      this.charge.position.copy(this.p0);
      scene.add(this.charge);
    }

    const ps = getParticleScale();
    this.trailN = Math.max(6, Math.round(34 * ps));
    this.trail = emberPoints(this.trailN, 0.34 * scale, big ? 0xffc255 : 0xff8a3a);
    this.trailP = [];
    scene.add(this.trail);

    this.burstN = Math.round(40 * ps);
    this.burst = emberPoints(this.burstN, 0.4 * scale, big ? 0xffd68a : 0xffb060);
    this.burstP = [];
    scene.add(this.burst);

    this.flash = billboard(5 * scale, 5 * scale, 0);
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

    if (this.charge && this.age < this.chargeDur) {
      const cp = Math.max(this.age, 0) / this.chargeDur;
      this.core.position.copy(this.p0);
      this.core.scale.setScalar(0.14 + cp * 0.6);
      for (const l of this.leaves) l.rotation.z += dt * 2.2;
      this.plume.visible = false;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.9;
      this.charge.scale.setScalar(0.4 + cp * 1.5);
      this.charge.rotation.z += dt * 5;
      return true;
    }
    if (this.charge) this.charge.visible = false;

    const flightAge = this.age - this.chargeDur;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);
    const eased = t < 0.82 ? t : 0.82 + (1 - (1 - (t - 0.82) / 0.18) ** 2) * 0.18;
    const pulse = 1 + 0.12 * Math.sin(flightAge * 34);

    if (t < 1) {
      this.core.scale.setScalar(1);
      this.plume.visible = true;
      const pos = this.bezier(eased);
      const ang = this.bezierAngle(eased);
      this.core.position.copy(pos);
      this.plume.position.set(
        pos.x - Math.cos(ang) * 1.6 * this.scale,
        pos.y - Math.sin(ang) * 1.6 * this.scale,
        0,
      );
      this.plume.rotation.z = ang;
      this.leaves.forEach((l, i) => {
        l.rotation.z += dt * (1.6 + i * 1.4) * (i % 2 ? 1 : -1);
        l.scale.setScalar(pulse);
      });

      if (this.trailP.length < this.trailN) {
        this.trailP.push({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 1.6,
          vy: 0.6 + Math.random() * 1.4,
          life: 0.3 + Math.random() * 0.35,
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.flash.visible = true;
      if (this.big) {
        this.ring = billboard(2, 2, 0.85, ringTex);
        this.ring.position.copy(this.to);
        this.scene.add(this.ring);
      }
      for (let i = 0; i < this.burstN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 7;
        this.burstP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp + 0.8,
          life: 0.28 + Math.random() * 0.34,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      for (const l of this.leaves) l.material.opacity *= 1 - dt * 6;
      this.plume.material.opacity = Math.max(0, this.plume.material.opacity - dt * 3);
      this.flash.material.opacity = Math.max(0, 0.9 * (1 - e * e));
      this.flash.scale.setScalar(1 + e * 1.6);
      this.flash.rotation.z += dt * 2;
      if (this.ring) {
        const re = Math.min(e * 1.5, 1);
        this.ring.scale.setScalar((0.5 + re * 4.4) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.85 * (1 - re) * (1 - re));
        this.ring.rotation.z += dt * 1.4;
      }
    }

    this.integratePoints(this.trailP, dt, 0.9, 2.4);
    this.integratePoints(this.burstP, dt, 0.88, -3.4);
    this.writePoints(this.trailP, this.trail);
    this.writePoints(this.burstP, this.burst);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.core, this.plume, this.trail, this.burst, this.flash];
    if (this.charge) objs.push(this.charge);
    if (this.ring) objs.push(this.ring);
    for (const o of objs) scene.remove(o);

    for (const l of this.leaves) {
      l.geometry.dispose();
      l.material.dispose();
    }
    for (const m of [this.plume, this.flash, this.trail, this.burst]) {
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
  }
}

let stage = null;

function ensureStage() {
  if (stage) return stage;
  const container = document.getElementById("webgl-container");
  if (!container || typeof THREE === "undefined") return null;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  } catch {
    return null;
  }
  if (!renderer || !renderer.getContext()) return null;

  if (!flameTex) flameTex = makeFlameTexture();
  if (!emberTex) emberTex = makeEmberTexture();
  if (!ringTex) ringTex = makeRingTexture();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 15;
  camera.updateMatrixWorld();

  renderer.setPixelRatio(1);
  renderer.setClearAlpha(0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  stage = { renderer, scene, camera, effects: [], raf: 0, last: 0 };

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);
  stage.onResize = onResize;

  return stage;
}

function startLoop() {
  if (stage.raf) return;
  stage.last = performance.now();
  const frame = (now) => {
    const dt = Math.min(Math.max((now - stage.last) / 1000, 0), 1 / 30);
    stage.last = now;
    recordEffectFrame(dt);

    for (let i = stage.effects.length - 1; i >= 0; i--) {
      const en = stage.effects[i];
      if (!en.effect.update(dt)) {
        en.effect.dispose(stage.scene);
        stage.effects.splice(i, 1);
        en.resolve();
      }
    }
    stage.renderer.render(stage.scene, stage.camera);

    if (stage.effects.length === 0) {
      stage.raf = 0;
      return;
    }
    stage.raf = requestAnimationFrame(frame);
  };
  stage.raf = requestAnimationFrame(frame);
}

export function createFireBoltGL(scale, big = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) {
      const { createFireballAnimation } = await import("./fireballAnimation.js");
      await createFireballAnimation(scale)(opts);
      return;
    }

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

    const effect = new FireBoltGL(st.scene, from, to, scale, big, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
