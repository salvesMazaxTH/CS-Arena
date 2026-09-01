// Default earth hit: a Three.js hurled rock in the shared #webgl-container, same
// light recipe as the fire, water and ice bolts (persistent renderer, pixelRatio
// 1, no post-processing). Reads as earth by staying entirely opaque — a tumbling
// faceted boulder, a dust wake and a debris burst, with no additive glow.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const TRAVEL_DUR = 0.34;
const POST_DUR = 0.5;
const CHARGE_DUR = 0.15;

const ROCK_TINT = 0x9c8974;
const BIG_ROCK_TINT = 0x7d6b58;
const DUST_TINT = 0xcbb89c;
const DEBRIS_TINT = 0x8a7660;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRockTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const pts = [
    [62, 8],
    [98, 26],
    [118, 62],
    [104, 100],
    [70, 120],
    [30, 108],
    [12, 72],
    [22, 32],
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(20, 10, 108, 118);
  g.addColorStop(0, "rgba(255,248,238,1)");
  g.addColorStop(0.55, "rgba(196,182,164,1)");
  g.addColorStop(1, "rgba(112,100,86,1)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(74,64,52,1)";
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(88,76,62,0.85)";
  ctx.beginPath();
  ctx.moveTo(40, 30);
  ctx.lineTo(68, 62);
  ctx.lineTo(56, 104);
  ctx.moveTo(68, 62);
  ctx.lineTo(112, 58);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,250,240,0.75)";
  ctx.beginPath();
  ctx.ellipse(48, 34, 13, 8, -0.6, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeDustTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,246,232,0.72)");
  g.addColorStop(0.5, "rgba(255,246,232,0.3)");
  g.addColorStop(1, "rgba(255,246,232,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTex(c);
}

function makeDebrisTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const ctx = c.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(11, 2);
  ctx.lineTo(22, 10);
  ctx.lineTo(17, 21);
  ctx.lineTo(4, 17);
  ctx.closePath();
  ctx.fillStyle = "rgba(236,226,210,1)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(92,80,66,1)";
  ctx.stroke();
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,246,232,0)");
  g.addColorStop(0.58, "rgba(255,246,232,0)");
  g.addColorStop(0.78, "rgba(255,246,232,0.85)");
  g.addColorStop(0.9, "rgba(203,184,156,0.28)");
  g.addColorStop(1, "rgba(203,184,156,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeCrackTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  ctx.lineCap = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(70,60,48,0.9)";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
    let x = 48;
    let y = 48;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let step = 0; step < 3; step++) {
      const len = 10 + Math.random() * 8;
      const jitter = (Math.random() - 0.5) * 0.7;
      x += Math.cos(a + jitter) * len;
      y += Math.sin(a + jitter) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return canvasTex(c);
}

let rockTex = null;
let dustTex = null;
let debrisTex = null;
let ringTex = null;
let crackTex = null;

function screenToWorld(x, y, camera) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const out = new THREE.Vector3();
  ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), out);
  return out;
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

class EarthBoltGL {
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
    // A hurled rock arcs higher than a bolt does.
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.34, 5),
      0,
    );

    const tint = big ? BIG_ROCK_TINT : ROCK_TINT;

    this.core = new THREE.Group();
    this.rocks = [
      billboard(2.5 * scale, 2.5 * scale, 1, rockTex),
      billboard(1.15 * scale, 1.15 * scale, 0.95, rockTex),
    ];
    this.rocks[1].position.set(0.95 * scale, -0.75 * scale, -0.004);
    this.rocks[1].rotation.z = 1.1;
    for (const r of this.rocks) {
      r.material.color.setHex(tint);
      this.core.add(r);
    }
    scene.add(this.core);

    if (big) {
      this.charge = billboard(1.6 * scale, 1.6 * scale, 0, dustTex);
      this.charge.material.color.setHex(DUST_TINT);
      this.charge.position.copy(this.p0);
      scene.add(this.charge);
    }

    const ps = getParticleScale();
    this.trailN = Math.max(6, Math.round(22 * ps));
    this.trail = particlePoints(
      this.trailN,
      0.85 * scale,
      DUST_TINT,
      dustTex,
      THREE.NormalBlending,
    );
    this.trailP = [];
    scene.add(this.trail);

    this.pebbleN = Math.max(6, Math.round((big ? 26 : 16) * ps));
    this.pebble = particlePoints(
      this.pebbleN,
      0.24 * scale,
      DEBRIS_TINT,
      debrisTex,
      THREE.NormalBlending,
    );
    this.pebbleP = [];
    scene.add(this.pebble);

    this.burstN = Math.round((big ? 48 : 36) * ps);
    this.burst = particlePoints(
      this.burstN,
      0.34 * scale,
      DEBRIS_TINT,
      debrisTex,
      THREE.NormalBlending,
    );
    this.burstP = [];
    scene.add(this.burst);

    this.cloud = billboard(4.8 * scale, 4.8 * scale, 0, dustTex);
    this.cloud.material.color.setHex(DUST_TINT);
    this.cloud.position.copy(this.to);
    this.cloud.visible = false;
    scene.add(this.cloud);
  }

  bezier(t) {
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * this.p0.x + 2 * u * t * this.ctrl.x + t * t * this.p2.x,
      u * u * this.p0.y + 2 * u * t * this.ctrl.y + t * t * this.p2.y,
      0,
    );
  }

  spawnPebble(x, y, spread, up) {
    if (this.pebbleP.length >= this.pebbleN) return;
    const a = Math.random() * Math.PI * 2;
    this.pebbleP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread + up,
      life: 0.3 + Math.random() * 0.4,
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
      const cp = Math.max(this.age, 0) / this.chargeDur;
      this.core.position.copy(this.p0);
      this.core.scale.setScalar(0.25 + cp * 0.6);
      this.core.rotation.z -= dt * 2.4;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.7;
      this.charge.scale.setScalar(0.6 + cp * 1.5);
      this.spawnPebble(this.p0.x, this.p0.y - 0.6, 1.4, 2.2);
      this.integratePoints(this.pebbleP, dt, 0.9, -5);
      this.writePoints(this.pebbleP, this.pebble);
      return true;
    }
    if (this.charge) this.charge.visible = false;

    const flightAge = this.age - this.chargeDur;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);

    if (t < 1) {
      const pos = this.bezier(t);
      this.core.position.copy(pos);
      this.core.rotation.z -= dt * 5.5;
      this.rocks[1].rotation.z += dt * 3.4;

      if (this.trailP.length < this.trailN) {
        this.trailP.push({
          x: pos.x + (Math.random() - 0.5) * 0.5,
          y: pos.y + (Math.random() - 0.5) * 0.5,
          vx: (Math.random() - 0.5) * 1.4,
          vy: 0.4 + Math.random() * 0.8,
          life: 0.32 + Math.random() * 0.3,
        });
      }
      if (Math.random() < 0.5) this.spawnPebble(pos.x, pos.y, 1.1, -0.6);
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.cloud.visible = true;

      this.ring = billboard(2, 2, 0.85, ringTex);
      this.ring.material.color.setHex(DUST_TINT);
      this.ring.position.set(this.to.x, this.to.y - 0.3 * this.scale, 0);
      // laid back toward the ground so it foreshortens like a shockwave
      this.ring.rotation.x = -1.15;
      this.scene.add(this.ring);
      if (this.big) {
        this.crack = billboard(
          3.6 * this.scale,
          3.6 * this.scale,
          0.75,
          crackTex,
        );
        this.crack.material.color.setHex(DEBRIS_TINT);
        this.crack.position.copy(this.ring.position);
        this.crack.rotation.x = -1.15;
        this.scene.add(this.crack);
      }

      const spread = this.big ? 9.5 : 7;
      for (let i = 0; i < this.burstN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2.5 + Math.random() * spread;
        this.burstP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.8 + 2.4,
          life: 0.34 + Math.random() * 0.42,
        });
      }
      for (let i = 0; i < (this.big ? 16 : 10); i++) {
        this.trailP.push({
          x: this.to.x + (Math.random() - 0.5) * 1.2,
          y: this.to.y + (Math.random() - 0.5) * 1.2,
          vx: (Math.random() - 0.5) * 6,
          vy: 0.8 + Math.random() * 2.4,
          life: 0.4 + Math.random() * 0.4,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      for (const r of this.rocks) {
        r.material.opacity = Math.max(0, r.material.opacity - dt * 9);
      }
      this.core.scale.setScalar(Math.max(0.2, 1 - e * 0.7));

      this.cloud.material.opacity = Math.max(0, 0.75 * (1 - e * e));
      this.cloud.scale.setScalar(0.6 + e * 1.5);

      if (this.ring) {
        const re = Math.min(e * 1.3, 1);
        this.ring.scale.setScalar((0.6 + re * 5) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.85 * (1 - re) * (1 - re));
      }
      if (this.crack) {
        this.crack.material.opacity = Math.max(0, 0.75 * (1 - e * 1.2));
        this.crack.scale.setScalar(0.7 + e * 0.5);
      }
    }

    this.integratePoints(this.trailP, dt, 0.9, 1.4);
    this.integratePoints(this.burstP, dt, 0.9, -11);
    this.integratePoints(this.pebbleP, dt, 0.92, -7);
    this.writePoints(this.trailP, this.trail);
    this.writePoints(this.burstP, this.burst);
    this.writePoints(this.pebbleP, this.pebble);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.core, this.trail, this.pebble, this.burst, this.cloud];
    if (this.charge) objs.push(this.charge);
    if (this.ring) objs.push(this.ring);
    if (this.crack) objs.push(this.crack);
    for (const o of objs) scene.remove(o);

    for (const r of this.rocks) {
      r.geometry.dispose();
      r.material.dispose();
    }
    for (const m of [this.trail, this.pebble, this.burst, this.cloud]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    for (const extra of [this.charge, this.ring, this.crack]) {
      if (!extra) continue;
      extra.geometry.dispose();
      extra.material.dispose();
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

  if (!rockTex) rockTex = makeRockTexture();
  if (!dustTex) dustTex = makeDustTexture();
  if (!debrisTex) debrisTex = makeDebrisTexture();
  if (!ringTex) ringTex = makeRingTexture();
  if (!crackTex) crackTex = makeCrackTexture();

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
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.left = "0";
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

export function createEarthBoltGL(scale, big = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    // No canvas fallback for earth; skip the projectile when WebGL is unavailable.
    if (!st) return;

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
      targetEl.classList.add("earth-hit");
      setTimeout(() => targetEl.classList.remove("earth-hit"), 320);
    };

    const effect = new EarthBoltGL(st.scene, from, to, scale, big, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
