// Musket ball hit: a Three.js round lead shot in the shared #webgl-container,
// same light recipe as the elemental bolts (persistent renderer, pixelRatio 1,
// no post-processing). Opted into by name through a skill's hitVfx, since a
// firearm is an authorial motif rather than an element.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const TRAVEL_DUR = 0.22;
const POST_DUR = 0.42;
const MUZZLE_DUR = 0.11;

const EMBER_TINT = 0xffa347;
const FLAME_TINT = 0xffd27a;
const SMOKE_TINT = 0x8d8479;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBallTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(50, 46, 4, 64, 64, 56);
  g.addColorStop(0, "rgba(216,210,202,1)");
  g.addColorStop(0.28, "rgba(140,134,128,1)");
  g.addColorStop(0.72, "rgba(66,62,60,1)");
  g.addColorStop(1, "rgba(34,30,30,1)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();

  // The shot leaves the barrel still glowing along its trailing edge.
  const rim = ctx.createRadialGradient(80, 84, 18, 74, 78, 54);
  rim.addColorStop(0, "rgba(255,150,60,0)");
  rim.addColorStop(0.72, "rgba(255,138,48,0.55)");
  rim.addColorStop(1, "rgba(255,96,24,0.9)");
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, 128, 128);
  ctx.globalCompositeOperation = "source-over";

  ctx.fillStyle = "rgba(255,252,246,0.85)";
  ctx.beginPath();
  ctx.ellipse(48, 44, 12, 8, -0.7, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.4, "rgba(255,255,255,0.3)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTex(c);
}

function makeMuzzleTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.translate(64, 64);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const len = 30 + Math.random() * 30;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - 0.14) * len * 0.4, Math.sin(a - 0.14) * len * 0.4);
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.lineTo(Math.cos(a + 0.14) * len * 0.4, Math.sin(a + 0.14) * len * 0.4);
    ctx.closePath();
    ctx.fillStyle = "rgba(255,238,200,0.85)";
    ctx.fill();
  }
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(255,226,160,0.7)");
  g.addColorStop(1, "rgba(255,180,80,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeSmokeTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  for (const [x, y, r, a] of [
    [26, 30, 20, 0.5],
    [40, 26, 16, 0.42],
    [34, 42, 18, 0.46],
  ]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.6, `rgba(255,255,255,${a * 0.35})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return canvasTex(c);
}

function makeEmberTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 9);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(255,190,90,0.9)");
  g.addColorStop(1, "rgba(255,120,30,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.62, "rgba(255,255,255,0)");
  g.addColorStop(0.8, "rgba(255,236,196,0.9)");
  g.addColorStop(0.92, "rgba(255,150,60,0.3)");
  g.addColorStop(1, "rgba(255,150,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let ballTex = null;
let glowTex = null;
let muzzleTex = null;
let smokeTex = null;
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

class MusketBallGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.lifetime = TRAVEL_DUR + POST_DUR + 0.2;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    // A shot flies nearly flat; the arc is only enough to sell the weight.
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.07, 0.9),
      0,
    );
    this.aim = new THREE.Vector3().subVectors(this.p2, this.p0).normalize();

    this.core = new THREE.Group();
    this.halo = billboard(
      1.84 * scale,
      1.84 * scale,
      0.5,
      glowTex,
      THREE.AdditiveBlending,
    );
    this.halo.material.color.setHex(EMBER_TINT);
    this.halo.position.z = -0.01;
    this.core.add(this.halo);

    this.ball = billboard(0.92 * scale, 0.92 * scale, 1, ballTex);
    this.core.add(this.ball);
    scene.add(this.core);

    this.muzzle = billboard(
      3.4 * scale,
      3.4 * scale,
      0,
      muzzleTex,
      THREE.AdditiveBlending,
    );
    this.muzzle.position.copy(this.p0);
    this.muzzle.rotation.z = Math.random() * Math.PI;
    scene.add(this.muzzle);

    const ps = getParticleScale();
    this.smokeN = Math.max(8, Math.round(30 * ps));
    this.smoke = particlePoints(
      this.smokeN,
      0.95 * scale,
      SMOKE_TINT,
      smokeTex,
      THREE.NormalBlending,
    );
    this.smokeP = [];
    scene.add(this.smoke);

    this.emberN = Math.max(8, Math.round(34 * ps));
    this.ember = particlePoints(
      this.emberN,
      0.36 * scale,
      FLAME_TINT,
      emberTex,
      THREE.AdditiveBlending,
    );
    this.emberP = [];
    scene.add(this.ember);

    this.flash = billboard(
      3.6 * scale,
      3.6 * scale,
      0,
      glowTex,
      THREE.AdditiveBlending,
    );
    this.flash.material.color.setHex(FLAME_TINT);
    this.flash.position.copy(this.to);
    this.flash.visible = false;
    scene.add(this.flash);

    // Powder blows back out of the barrel the instant the shot leaves it.
    for (let i = 0; i < Math.max(5, Math.round(12 * ps)); i++) {
      this.spawnSmoke(
        this.p0.x - this.aim.x * 0.4,
        this.p0.y - this.aim.y * 0.4,
        2.6,
        1,
      );
      this.spawnEmber(this.p0.x, this.p0.y, 5, 1.4);
    }
  }

  bezier(t) {
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * this.p0.x + 2 * u * t * this.ctrl.x + t * t * this.p2.x,
      u * u * this.p0.y + 2 * u * t * this.ctrl.y + t * t * this.p2.y,
      0,
    );
  }

  spawnSmoke(x, y, spread, up) {
    if (this.smokeP.length >= this.smokeN) return;
    const a = Math.random() * Math.PI * 2;
    this.smokeP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread * 0.6 + up,
      life: 0.45 + Math.random() * 0.45,
    });
  }

  spawnEmber(x, y, spread, up) {
    if (this.emberP.length >= this.emberN) return;
    const a = Math.random() * Math.PI * 2;
    this.emberP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread + up,
      life: 0.24 + Math.random() * 0.35,
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

    const mp = Math.min(this.age / MUZZLE_DUR, 1);
    this.muzzle.material.opacity = mp < 1 ? Math.sin(mp * Math.PI) * 0.95 : 0;
    this.muzzle.scale.setScalar(0.5 + mp * 1.1);

    const t = Math.min(this.age / TRAVEL_DUR, 1);

    if (t < 1) {
      const pos = this.bezier(t);
      this.core.position.copy(pos);
      this.halo.material.opacity = 0.4 + 0.18 * Math.sin(this.age * 40);
      this.halo.scale.setScalar(1 + 0.1 * Math.sin(this.age * 34));

      this.spawnSmoke(
        pos.x - this.aim.x * 0.3,
        pos.y - this.aim.y * 0.3,
        0.7,
        0.9,
      );
      if (Math.random() < 0.7) this.spawnEmber(pos.x, pos.y, 1.2, 0.2);
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.flash.visible = true;

      this.ring = billboard(2, 2, 0.9, ringTex, THREE.AdditiveBlending);
      this.ring.material.color.setHex(FLAME_TINT);
      this.ring.position.copy(this.to);
      this.scene.add(this.ring);

      for (let i = 0; i < this.emberN; i++) {
        this.spawnEmber(this.to.x, this.to.y, 3 + Math.random() * 8, 1.6);
      }
      for (let i = 0; i < Math.round(this.smokeN * 0.5); i++) {
        this.spawnSmoke(this.to.x, this.to.y, 2.4, 1.4);
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (this.age - TRAVEL_DUR) / POST_DUR;
      this.ball.material.opacity = Math.max(0, this.ball.material.opacity - dt * 12);
      this.halo.material.opacity = Math.max(0, this.halo.material.opacity - dt * 6);

      this.flash.material.opacity = Math.max(0, 0.95 * (1 - e * e));
      this.flash.scale.setScalar(0.6 + e * 1.7);

      if (this.ring) {
        const re = Math.min(e * 1.5, 1);
        this.ring.scale.setScalar((0.4 + re * 3.4) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
      }
    }

    this.integratePoints(this.smokeP, dt, 0.9, 1.1);
    this.integratePoints(this.emberP, dt, 0.9, -3.2);
    this.writePoints(this.smokeP, this.smoke);
    this.writePoints(this.emberP, this.ember);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.core, this.muzzle, this.smoke, this.ember, this.flash];
    if (this.ring) objs.push(this.ring);
    for (const o of objs) scene.remove(o);

    for (const m of [
      this.ball,
      this.halo,
      this.muzzle,
      this.smoke,
      this.ember,
      this.flash,
    ]) {
      m.geometry.dispose();
      m.material.dispose();
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

  if (!ballTex) ballTex = makeBallTexture();
  if (!glowTex) glowTex = makeGlowTexture();
  if (!muzzleTex) muzzleTex = makeMuzzleTexture();
  if (!smokeTex) smokeTex = makeSmokeTexture();
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

export function createMusketBallGL(scale) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    // No canvas fallback for the shot; skip it when WebGL is unavailable.
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
      targetEl.classList.add("shot-hit");
      setTimeout(() => targetEl.classList.remove("shot-hit"), 260);
    };

    const effect = new MusketBallGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
