// Default ice hit: a Three.js ice bolt in the shared #webgl-container, same light
// recipe as the fire and water bolts (persistent renderer, pixelRatio 1, no
// post-processing). Reads as ice by pairing a solid faceted crystal (normal
// blending) with a magical energy halo and sparkle motes (additive).

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const TRAVEL_DUR = 0.3;
const POST_DUR = 0.46;
const CHARGE_DUR = 0.13;

const CORE_TINT = 0xa8e8ff;
const BIG_CORE_TINT = 0x82d2ff;
const ENERGY_TINT = 0x9fdcff;
const FROST_TINT = 0xe8faff;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeShardTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const pts = [
    [64, 6],
    [104, 44],
    [94, 96],
    [64, 122],
    [34, 96],
    [24, 44],
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, "rgba(255,255,255,0.34)");
  g.addColorStop(0.5, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0.28)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke();

  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  for (const [x, y] of [pts[1], pts[2], pts[4], pts[5]]) {
    ctx.beginPath();
    ctx.moveTo(64, 22);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(64, 118);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(52, 30);
  ctx.lineTo(44, 74);
  ctx.stroke();
  return canvasTex(c);
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.45, "rgba(255,255,255,0.32)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTex(c);
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 7);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(16, 1);
  ctx.lineTo(16, 31);
  ctx.moveTo(1, 16);
  ctx.lineTo(31, 16);
  ctx.stroke();
  return canvasTex(c);
}

function makeFragTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 24;
  const ctx = c.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(12, 2);
  ctx.lineTo(21, 16);
  ctx.lineTo(6, 22);
  ctx.closePath();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.stroke();
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.56, "rgba(255,255,255,0)");
  g.addColorStop(0.77, "rgba(255,255,255,0.95)");
  g.addColorStop(0.88, "rgba(158,220,255,0.3)");
  g.addColorStop(1, "rgba(158,220,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeFrostPatchTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(48, 48, 0, 48, 48, 48);
  g.addColorStop(0, "rgba(255,255,255,0.6)");
  g.addColorStop(0.65, "rgba(232,250,255,0.22)");
  g.addColorStop(1, "rgba(232,250,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(48, 48);
    ctx.lineTo(48 + Math.cos(a) * 42, 48 + Math.sin(a) * 42);
    ctx.stroke();
  }
  return canvasTex(c);
}

let shardTex = null;
let glowTex = null;
let moteTex = null;
let fragTex = null;
let ringTex = null;
let patchTex = null;

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

class IceBoltGL {
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

    const tint = big ? BIG_CORE_TINT : CORE_TINT;

    this.core = new THREE.Group();
    this.glow = billboard(3.2 * scale, 3.2 * scale, 0.55, glowTex, THREE.AdditiveBlending);
    this.glow.material.color.setHex(ENERGY_TINT);
    this.glow.position.z = -0.01;
    this.core.add(this.glow);

    this.shards = [
      billboard(2.2 * scale, 2.6 * scale, 0.92, shardTex),
      billboard(1.5 * scale, 1.8 * scale, 0.8, shardTex),
    ];
    this.shards[1].position.z = 0.004;
    this.shards[1].rotation.z = 0.6;
    for (const s of this.shards) {
      s.material.color.setHex(tint);
      this.core.add(s);
    }

    this.spec = billboard(0.55 * scale, 0.55 * scale, 0.9, moteTex, THREE.AdditiveBlending);
    this.spec.position.set(-0.4 * scale, 0.45 * scale, 0.008);
    this.core.add(this.spec);
    scene.add(this.core);

    if (big) {
      this.charge = billboard(1.2 * scale, 1.2 * scale, 0, glowTex, THREE.AdditiveBlending);
      this.charge.material.color.setHex(ENERGY_TINT);
      this.charge.position.copy(this.p0);
      scene.add(this.charge);
    }

    const ps = getParticleScale();
    this.trailN = Math.max(6, Math.round(24 * ps));
    this.trail = particlePoints(this.trailN, 0.26 * scale, FROST_TINT, fragTex, THREE.NormalBlending);
    this.trailP = [];
    scene.add(this.trail);

    this.moteN = Math.max(6, Math.round((big ? 28 : 18) * ps));
    this.mote = particlePoints(this.moteN, 0.34 * scale, ENERGY_TINT, moteTex, THREE.AdditiveBlending);
    this.moteP = [];
    scene.add(this.mote);

    this.burstN = Math.round((big ? 46 : 34) * ps);
    this.burst = particlePoints(this.burstN, 0.3 * scale, FROST_TINT, fragTex, THREE.NormalBlending);
    this.burstP = [];
    scene.add(this.burst);

    this.flash = billboard(4.5 * scale, 4.5 * scale, 0, glowTex, THREE.AdditiveBlending);
    this.flash.material.color.setHex(FROST_TINT);
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

  spawnMote(x, y, spread, up) {
    if (this.moteP.length >= this.moteN) return;
    const a = Math.random() * Math.PI * 2;
    this.moteP.push({
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
      this.core.scale.setScalar(0.2 + cp * 0.55);
      this.core.rotation.z += dt * 2;
      this.charge.material.opacity = Math.sin(cp * Math.PI) * 0.85;
      this.charge.scale.setScalar(0.5 + cp * 1.4);
      this.charge.rotation.z += dt * 4;
      this.spawnMote(this.p0.x, this.p0.y, 1.6, 0);
      this.integratePoints(this.moteP, dt, 0.9, 1);
      this.writePoints(this.moteP, this.mote);
      return true;
    }
    if (this.charge) this.charge.visible = false;

    const flightAge = this.age - this.chargeDur;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);
    const shimmer = 1 + 0.12 * Math.sin(flightAge * 30);

    if (t < 1) {
      const pos = this.bezier(t);
      this.core.position.copy(pos);
      this.core.rotation.z += dt * 1.4;
      this.shards[0].rotation.z += dt * 2.2;
      this.shards[1].rotation.z -= dt * 3.1;
      this.glow.scale.setScalar(shimmer);
      this.glow.material.opacity = 0.45 + 0.2 * Math.sin(flightAge * 22);

      if (this.trailP.length < this.trailN) {
        this.trailP.push({
          x: pos.x + (Math.random() - 0.5) * 0.4,
          y: pos.y + (Math.random() - 0.5) * 0.4,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -0.3 - Math.random() * 0.9,
          life: 0.3 + Math.random() * 0.3,
        });
      }
      if (Math.random() < 0.6) this.spawnMote(pos.x, pos.y, 1.3, 0.4);
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.flash.visible = true;

      this.ring = billboard(2, 2, 0.9, ringTex);
      this.ring.material.color.setHex(FROST_TINT);
      this.ring.position.set(this.to.x, this.to.y - 0.3 * this.scale, 0);
      // laid back toward the ground so it foreshortens like a frost bloom
      this.ring.rotation.x = -1.15;
      this.scene.add(this.ring);
      if (this.big) {
        this.ring2 = billboard(2, 2, 0.7, ringTex);
        this.ring2.material.color.setHex(ENERGY_TINT);
        this.ring2.position.copy(this.ring.position);
        this.ring2.rotation.x = -1.15;
        this.scene.add(this.ring2);

        this.patch = billboard(3.4 * this.scale, 3.4 * this.scale, 0.6, patchTex);
        this.patch.material.color.setHex(FROST_TINT);
        this.patch.position.copy(this.ring.position);
        this.patch.rotation.x = -1.15;
        this.scene.add(this.patch);
      }

      const spread = this.big ? 9 : 6.5;
      for (let i = 0; i < this.burstN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2.5 + Math.random() * spread;
        this.burstP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * 0.7 + 1.2,
          life: 0.32 + Math.random() * 0.4,
        });
      }
      for (let i = 0; i < (this.big ? 18 : 12); i++) {
        this.spawnMote(this.to.x, this.to.y, 4 + Math.random() * 4, 1);
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      for (const s of this.shards) {
        s.material.opacity = Math.max(0, s.material.opacity - dt * 8);
      }
      this.spec.material.opacity = Math.max(0, this.spec.material.opacity - dt * 10);
      this.glow.material.opacity = Math.max(0, this.glow.material.opacity - dt * 4);
      this.core.scale.setScalar(1 + e * 0.6);

      this.flash.material.opacity = Math.max(0, 0.9 * (1 - e * e));
      this.flash.scale.setScalar(1 + e * 1.8);
      this.flash.rotation.z += dt * 2.5;

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
      if (this.patch) {
        this.patch.material.opacity = Math.max(0, 0.6 * (1 - e * 1.3));
        this.patch.scale.setScalar((1 + e * 0.5) * 1);
      }
    }

    this.integratePoints(this.trailP, dt, 0.9, -4);
    this.integratePoints(this.burstP, dt, 0.88, -9);
    this.integratePoints(this.moteP, dt, 0.92, 1.2);
    this.writePoints(this.trailP, this.trail);
    this.writePoints(this.burstP, this.burst);
    this.writePoints(this.moteP, this.mote);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.core, this.trail, this.mote, this.burst, this.flash];
    if (this.charge) objs.push(this.charge);
    if (this.ring) objs.push(this.ring);
    if (this.ring2) objs.push(this.ring2);
    if (this.patch) objs.push(this.patch);
    for (const o of objs) scene.remove(o);

    for (const s of this.shards) {
      s.geometry.dispose();
      s.material.dispose();
    }
    this.glow.geometry.dispose();
    this.glow.material.dispose();
    this.spec.geometry.dispose();
    this.spec.material.dispose();
    for (const m of [this.trail, this.mote, this.burst, this.flash]) {
      m.geometry.dispose();
      m.material.dispose();
    }
    for (const extra of [this.charge, this.ring, this.ring2, this.patch]) {
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

  if (!shardTex) shardTex = makeShardTexture();
  if (!glowTex) glowTex = makeGlowTexture();
  if (!moteTex) moteTex = makeMoteTexture();
  if (!fragTex) fragTex = makeFragTexture();
  if (!ringTex) ringTex = makeRingTexture();
  if (!patchTex) patchTex = makeFrostPatchTexture();

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

export function createIceBoltGL(scale, big = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    // No canvas fallback for ice; skip the projectile when WebGL is unavailable.
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
      targetEl.classList.add("ice-hit");
      setTimeout(() => targetEl.classList.remove("ice-hit"), 320);
    };

    const effect = new IceBoltGL(st.scene, from, to, scale, big, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
