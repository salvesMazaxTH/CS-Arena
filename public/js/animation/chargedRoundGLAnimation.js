// Charged round hit: a Three.js tracer whose electricity rides the bullet
// rather than replacing it, in the shared #webgl-container, same light recipe
// as the elemental bolts (persistent renderer, pixelRatio 1, no
// post-processing). Opted into by name through a skill's hitVfx, since an
// element-infused firearm is an authorial motif rather than an element.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const TRAVEL_DUR = 0.16;
const POST_DUR = 0.4;
const MUZZLE_DUR = 0.1;

const ARC_TINT = 0x7fd4ff;
const CORE_TINT = 0xeaf8ff;
const IONIZED_TINT = 0x4f7cff;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  ctx.translate(64, 64);
  ctx.beginPath();
  ctx.moveTo(54, 0);
  ctx.quadraticCurveTo(30, 22, -34, 20);
  ctx.lineTo(-48, 12);
  ctx.lineTo(-48, -12);
  ctx.lineTo(-34, -20);
  ctx.quadraticCurveTo(30, -22, 54, 0);
  ctx.closePath();

  const g = ctx.createLinearGradient(0, -20, 0, 20);
  g.addColorStop(0, "rgba(236,242,250,1)");
  g.addColorStop(0.34, "rgba(176,190,208,1)");
  g.addColorStop(0.72, "rgba(92,104,124,1)");
  g.addColorStop(1, "rgba(44,52,70,1)");
  ctx.fillStyle = g;
  ctx.fill();

  // The charge clings to the jacket instead of trailing behind the round.
  ctx.globalCompositeOperation = "source-atop";
  const rim = ctx.createLinearGradient(-48, 0, 54, 0);
  rim.addColorStop(0, "rgba(120,214,255,0.95)");
  rim.addColorStop(0.45, "rgba(150,226,255,0.35)");
  rim.addColorStop(1, "rgba(255,255,255,0.9)");
  ctx.fillStyle = rim;
  ctx.fillRect(-64, -64, 128, 128);
  ctx.globalCompositeOperation = "source-over";

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

function makeArcTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.lineCap = "round";

  for (const [width, alpha] of [
    [7, 0.22],
    [3, 0.55],
    [1.3, 1],
  ]) {
    ctx.strokeStyle = `rgba(214,242,255,${alpha})`;
    ctx.lineWidth = width;
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      ctx.moveTo(4, 32);
      for (let x = 4; x < 124; x += 14) {
        ctx.lineTo(x + 14, 32 + (Math.random() - 0.5) * 26);
      }
      ctx.stroke();
    }
  }
  return canvasTex(c);
}

function makeMuzzleTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.translate(64, 64);

  ctx.lineCap = "round";
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const len = 26 + Math.random() * 32;
    ctx.strokeStyle = "rgba(198,238,255,0.9)";
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(
      Math.cos(a - 0.2) * len * 0.55,
      Math.sin(a - 0.2) * len * 0.55,
    );
    ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    ctx.stroke();
  }

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.42, "rgba(186,232,255,0.72)");
  g.addColorStop(1, "rgba(90,150,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeSparkTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 9);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.38, "rgba(170,228,255,0.9)");
  g.addColorStop(1, "rgba(70,140,255,0)");
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
  g.addColorStop(0.8, "rgba(226,246,255,0.92)");
  g.addColorStop(0.92, "rgba(96,168,255,0.32)");
  g.addColorStop(1, "rgba(96,168,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let roundTex = null;
let glowTex = null;
let arcTex = null;
let muzzleTex = null;
let sparkTex = null;
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

class ChargedRoundGL {
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
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.04, 0.5),
      0,
    );
    this.aim = new THREE.Vector3().subVectors(this.p2, this.p0).normalize();
    this.angle = Math.atan2(this.aim.y, this.aim.x);

    this.core = new THREE.Group();
    this.core.rotation.z = this.angle;

    this.halo = billboard(
      1.7 * scale,
      1.7 * scale,
      0.55,
      glowTex,
      THREE.AdditiveBlending,
    );
    this.halo.material.color.setHex(ARC_TINT);
    this.halo.position.z = -0.02;
    this.core.add(this.halo);

    this.arc = billboard(
      3.2 * scale,
      1.6 * scale,
      0.85,
      arcTex,
      THREE.AdditiveBlending,
    );
    this.arc.material.color.setHex(CORE_TINT);
    this.arc.position.z = -0.01;
    this.core.add(this.arc);

    this.round = billboard(1.15 * scale, 0.55 * scale, 1, roundTex);
    this.core.add(this.round);
    scene.add(this.core);

    this.muzzle = billboard(
      3.2 * scale,
      3.2 * scale,
      0,
      muzzleTex,
      THREE.AdditiveBlending,
    );
    this.muzzle.position.copy(this.p0);
    this.muzzle.rotation.z = Math.random() * Math.PI;
    scene.add(this.muzzle);

    const ps = getParticleScale();

    this.ionN = Math.max(8, Math.round(30 * ps));
    this.ion = particlePoints(
      this.ionN,
      0.62 * scale,
      IONIZED_TINT,
      sparkTex,
      THREE.AdditiveBlending,
    );
    this.ionP = [];
    scene.add(this.ion);

    this.sparkN = Math.max(8, Math.round(34 * ps));
    this.spark = particlePoints(
      this.sparkN,
      0.34 * scale,
      ARC_TINT,
      sparkTex,
      THREE.AdditiveBlending,
    );
    this.sparkP = [];
    scene.add(this.spark);

    this.flash = billboard(
      3.4 * scale,
      3.4 * scale,
      0,
      glowTex,
      THREE.AdditiveBlending,
    );
    this.flash.material.color.setHex(CORE_TINT);
    this.flash.position.copy(this.to);
    this.flash.visible = false;
    scene.add(this.flash);

    for (let i = 0; i < Math.max(5, Math.round(12 * ps)); i++) {
      this.spawnIon(
        this.p0.x - this.aim.x * 0.35,
        this.p0.y - this.aim.y * 0.35,
        2.2,
        0.8,
      );
      this.spawnSpark(this.p0.x, this.p0.y, 5.5, 1.2);
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

  spawnIon(x, y, spread, up) {
    if (this.ionP.length >= this.ionN) return;
    const a = Math.random() * Math.PI * 2;
    this.ionP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread * 0.6 + up,
      life: 0.3 + Math.random() * 0.34,
    });
  }

  spawnSpark(x, y, spread, up) {
    if (this.sparkP.length >= this.sparkN) return;
    const a = Math.random() * Math.PI * 2;
    this.sparkP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread + up,
      life: 0.18 + Math.random() * 0.3,
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
    this.muzzle.scale.setScalar(0.5 + mp * 1.15);

    const t = Math.min(this.age / TRAVEL_DUR, 1);

    if (t < 1) {
      const pos = this.bezier(t);
      this.core.position.copy(pos);

      this.halo.material.opacity = 0.45 + 0.2 * Math.sin(this.age * 46);
      this.arc.material.opacity = 0.55 + 0.45 * Math.random();
      this.arc.scale.set(1, 0.7 + Math.random() * 0.7, 1);

      this.spawnIon(
        pos.x - this.aim.x * 0.28,
        pos.y - this.aim.y * 0.28,
        0.6,
        0.5,
      );
      if (Math.random() < 0.85) this.spawnSpark(pos.x, pos.y, 1.6, 0.2);
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.flash.visible = true;
      this.arc.visible = false;

      this.ring = billboard(2, 2, 0.9, ringTex, THREE.AdditiveBlending);
      this.ring.material.color.setHex(ARC_TINT);
      this.ring.position.copy(this.to);
      this.scene.add(this.ring);

      for (let i = 0; i < this.sparkN; i++) {
        this.spawnSpark(this.to.x, this.to.y, 4 + Math.random() * 9, 1.4);
      }
      for (let i = 0; i < Math.round(this.ionN * 0.5); i++) {
        this.spawnIon(this.to.x, this.to.y, 2.2, 1.2);
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (this.age - TRAVEL_DUR) / POST_DUR;
      this.round.material.opacity = Math.max(
        0,
        this.round.material.opacity - dt * 14,
      );
      this.halo.material.opacity = Math.max(
        0,
        this.halo.material.opacity - dt * 6,
      );

      this.flash.material.opacity = Math.max(0, 0.95 * (1 - e * e));
      this.flash.scale.setScalar(0.55 + e * 1.8);

      if (this.ring) {
        const re = Math.min(e * 1.5, 1);
        this.ring.scale.setScalar((0.4 + re * 3.2) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
      }
    }

    this.integratePoints(this.ionP, dt, 0.88, 0.9);
    this.integratePoints(this.sparkP, dt, 0.88, -2.6);
    this.writePoints(this.ionP, this.ion);
    this.writePoints(this.sparkP, this.spark);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.core, this.muzzle, this.ion, this.spark, this.flash];
    if (this.ring) objs.push(this.ring);
    for (const o of objs) scene.remove(o);

    for (const m of [
      this.round,
      this.halo,
      this.arc,
      this.muzzle,
      this.ion,
      this.spark,
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

  if (!roundTex) roundTex = makeRoundTexture();
  if (!glowTex) glowTex = makeGlowTexture();
  if (!arcTex) arcTex = makeArcTexture();
  if (!muzzleTex) muzzleTex = makeMuzzleTexture();
  if (!sparkTex) sparkTex = makeSparkTexture();
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

export function createChargedRoundGL(scale) {
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

    const effect = new ChargedRoundGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
