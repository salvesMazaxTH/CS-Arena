// Cryogenic round hit. The order is the whole motif: the target frosts over
// before anything is fired, the round is a single white frame with no trail,
// and the impact lands late, after the line is already gone.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const FROST_TINT = 0xbfe6ff;
const CORE_TINT = 0xffffff;
const DEEP_TINT = 0x6fa8d8;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Dendritic growth: each branch forks off the one before it, which is what
// reads as frost instead of as a starburst.
function makeFrostTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.translate(128, 128);
  ctx.lineCap = "round";

  const branch = (x, y, angle, len, width, depth) => {
    if (depth <= 0 || len < 3) return;
    const ex = x + Math.cos(angle) * len;
    const ey = y + Math.sin(angle) * len;

    ctx.strokeStyle = "rgba(226,244,255," + (0.22 + depth * 0.16) + ")";
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    branch(ex, ey, angle + 0.55, len * 0.62, width * 0.7, depth - 1);
    branch(ex, ey, angle - 0.55, len * 0.62, width * 0.7, depth - 1);
    branch(ex, ey, angle + (Math.random() - 0.5) * 0.3, len * 0.82, width * 0.8, depth - 1);
  };

  for (let i = 0; i < 9; i++) {
    branch(0, 0, (i / 9) * Math.PI * 2, 30 + Math.random() * 14, 3.4, 4);
  }

  ctx.globalCompositeOperation = "destination-over";
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
  g.addColorStop(0, "rgba(214,240,255,0.5)");
  g.addColorStop(0.45, "rgba(170,214,250,0.16)");
  g.addColorStop(1, "rgba(120,180,230,0)");
  ctx.fillStyle = g;
  ctx.fillRect(-128, -128, 256, 256);

  return canvasTex(c);
}

function makeFlowerTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.translate(128, 128);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.12;
    const len = 70 + Math.random() * 42;
    const half = 7 + Math.random() * 6;

    ctx.save();
    ctx.rotate(a);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.5, "rgba(198,232,255,0.6)");
    g.addColorStop(1, "rgba(140,196,240,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len * 0.42, -half);
    ctx.lineTo(len, 0);
    ctx.lineTo(len * 0.42, half);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.55, "rgba(214,240,255,0.5)");
  core.addColorStop(1, "rgba(160,206,244,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fill();

  return canvasTex(c);
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.4, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTex(c);
}

function makeShardTexture() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  ctx.translate(16, 16);
  const g = ctx.createLinearGradient(0, -14, 0, 14);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.5, "rgba(200,232,255,0.8)");
  g.addColorStop(1, "rgba(140,196,240,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 14);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.68, "rgba(255,255,255,0)");
  g.addColorStop(0.84, "rgba(236,250,255,0.95)");
  g.addColorStop(0.94, "rgba(130,192,240,0.3)");
  g.addColorStop(1, "rgba(130,192,240,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let frostTex = null;
let flowerTex = null;
let glowTex = null;
let shardTex = null;
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

function billboard(w, h, opacity, tex, blending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: blending ?? THREE.NormalBlending,
    depthWrite: false,
    opacity,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function particlePoints(count, size, color, tex) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = new THREE.PointsMaterial({
    map: tex,
    size,
    sizeAttenuation: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class CryoRoundGL {
  constructor(scene, from, to, scale, grand, onMark, onImpact) {
    this.scale = scale;
    this.grand = grand;
    this.age = 0;
    this.marked = false;
    this.impacted = false;
    this.onMark = onMark;
    this.onImpact = onImpact;
    this.to = to.clone();

    this.markDur = grand ? 0.62 : 0.22;
    this.lineDur = 1 / 60;
    this.crackDelay = grand ? 0.18 : 0.08;
    this.woundDur = grand ? 0.85 : 0.5;

    this.crackAt = this.markDur + this.lineDur + this.crackDelay;
    this.lifetime = this.crackAt + this.woundDur + 0.3;

    const aim = new THREE.Vector3().subVectors(to, from);
    const len = aim.length();

    this.mark = billboard(3.1 * scale, 3.1 * scale, 0, frostTex, THREE.AdditiveBlending);
    this.mark.material.color.setHex(FROST_TINT);
    this.mark.position.copy(to);
    this.mark.scale.setScalar(0.08);
    scene.add(this.mark);

    this.line = billboard(len, 0.07 * scale, 0, glowTex, THREE.AdditiveBlending);
    this.line.material.color.setHex(CORE_TINT);
    this.line.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, 0.02);
    this.line.rotation.z = Math.atan2(aim.y, aim.x);
    this.line.visible = false;
    scene.add(this.line);

    this.flower = billboard(3.6 * scale, 3.6 * scale, 0, flowerTex, THREE.AdditiveBlending);
    this.flower.position.copy(to);
    this.flower.position.z = 0.01;
    this.flower.rotation.z = Math.random() * Math.PI;
    this.flower.visible = false;
    scene.add(this.flower);

    this.ring = billboard(2, 2, 0, ringTex, THREE.AdditiveBlending);
    this.ring.material.color.setHex(DEEP_TINT);
    this.ring.position.copy(to);
    this.ring.visible = false;
    scene.add(this.ring);

    const ps = getParticleScale();
    this.shardMax = Math.max(8, Math.round((grand ? 40 : 22) * ps));
    this.shards = particlePoints(this.shardMax, 0.5 * scale, FROST_TINT, shardTex);
    this.shards.geometry.setDrawRange(0, 0);
    this.shardP = [];
    scene.add(this.shards);
  }

  burst(spread) {
    for (let i = 0; i < this.shardMax; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spread * (0.35 + Math.random() * 0.65);
      this.shardP.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.55,
      });
    }
  }

  writeShards() {
    const arr = this.shards.geometry.attributes.position.array;
    for (let i = 0; i < this.shardP.length; i++) {
      arr[i * 3] = this.shardP[i].x;
      arr[i * 3 + 1] = this.shardP[i].y;
      arr[i * 3 + 2] = 0;
    }
    this.shards.geometry.setDrawRange(0, this.shardP.length);
    this.shards.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;

    const m = Math.min(this.age / this.markDur, 1);
    const eased = 1 - Math.pow(1 - m, 3);
    this.mark.scale.setScalar(0.08 + eased * 0.95);
    this.mark.material.opacity = eased * 0.85;
    this.mark.rotation.z += dt * 0.25;

    if (!this.marked && m > 0.1) {
      this.marked = true;
      this.onMark?.();
    }

    const lineAge = this.age - this.markDur;
    if (lineAge >= 0 && lineAge <= this.lineDur) {
      this.line.visible = true;
      this.line.material.opacity = 1;
    } else if (this.line.visible) {
      this.line.visible = false;
    }

    if (!this.impacted && this.age >= this.crackAt) {
      this.impacted = true;
      this.flower.visible = true;
      this.ring.visible = true;
      this.burst(this.grand ? 6 : 4);
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = Math.min((this.age - this.crackAt) / this.woundDur, 1);
      const open = 1 - Math.pow(1 - e, 4);

      this.flower.scale.setScalar(0.25 + open * 1.15);
      this.flower.material.opacity = e < 0.18 ? 1 : Math.max(0, 1 - (e - 0.18) / 0.82);

      this.ring.scale.setScalar((0.3 + open * 3.4) * this.scale);
      this.ring.material.opacity = Math.max(0, 0.95 * (1 - e) * (1 - e));

      this.mark.material.opacity = Math.max(0, 0.85 - e * 0.6);
    }

    for (let i = this.shardP.length - 1; i >= 0; i--) {
      const p = this.shardP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.shardP.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 - 1.1 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.writeShards();

    return this.age < this.lifetime;
  }

  dispose(scene) {
    for (const o of [this.mark, this.line, this.flower, this.ring, this.shards]) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
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

  if (!frostTex) frostTex = makeFrostTexture();
  if (!flowerTex) flowerTex = makeFlowerTexture();
  if (!glowTex) glowTex = makeGlowTexture();
  if (!shardTex) shardTex = makeShardTexture();
  if (!ringTex) ringTex = makeRingTexture();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
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

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

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
      const entry = stage.effects[i];
      if (!entry.effect.update(dt)) {
        entry.effect.dispose(stage.scene);
        stage.effects.splice(i, 1);
        entry.resolve();
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

export function createCryoRoundGL(scale, grand = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;

    const tc = getElementCenter(targetEl);
    const to = screenToWorld(tc.x, tc.y, st.camera);

    let from;
    if (userEl) {
      const uc = getElementCenter(userEl);
      from = screenToWorld(uc.x, uc.y, st.camera);
    } else {
      from = new THREE.Vector3(to.x - 6, to.y + 1, 0);
    }

    const onMark = () => {
      targetEl.classList.add("cryo-marked");
      setTimeout(() => targetEl.classList.remove("cryo-marked"), grand ? 900 : 500);
    };

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("cryo-hit");
      setTimeout(() => targetEl.classList.remove("cryo-hit"), grand ? 1600 : 900);
    };

    const effect = new CryoRoundGL(st.scene, from, to, scale, grand, onMark, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
