// Radiant hit: Seymour's shaft of hard white light in the shared
// #webgl-container, same light recipe as the elemental bolts (persistent
// renderer, pixelRatio 1, no post-processing). Opted into by name through a
// skill's hitVfx, since his light is an authorial motif, not an element. It
// reads as bleach, not fire: a hard thin blade on a near-flat path, a spoked
// overexposure on impact, and a palette that runs white to aged paper to a
// cold wrung-out blue rather than anything warm.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const FOCUS_DUR = 0.08;
const TRAVEL_DUR = 0.24;
const POST_DUR = 0.4;

const CORE = 0xfffef6; // paper white
const EDGE = 0xf2d29a; // the amber age leaves on old paper
const COLD = 0x9fb0c4; // the wrung-out blue bleaching pulls toward

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A horizontal bar with soft ends: the blade's body, stretched along travel.
function makeBladeTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(255,254,246,0)");
  g.addColorStop(0.4, "rgba(255,254,246,0.9)");
  g.addColorStop(0.72, "rgba(242,210,154,0.85)");
  g.addColorStop(1, "rgba(242,210,154,0)");
  ctx.fillStyle = g;
  const v = ctx.createLinearGradient(0, 0, 0, 64);
  ctx.fillRect(0, 0, 128, 64);
  v.addColorStop(0, "rgba(0,0,0,0.85)");
  v.addColorStop(0.5, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 64);
  ctx.globalCompositeOperation = "source-over";
  return canvasTex(c);
}

// Hard radial spokes plus a bright disk: the overexposure at impact.
function makeSunburstTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.translate(128, 128);

  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, 128);
  disk.addColorStop(0, "rgba(255,255,250,0.95)");
  disk.addColorStop(0.22, "rgba(255,250,232,0.55)");
  disk.addColorStop(0.5, "rgba(242,210,154,0.18)");
  disk.addColorStop(1, "rgba(242,210,154,0)");
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(0, 0, 128, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = i % 2 ? 122 : 78;
    const half = i % 2 ? 0.045 : 0.03;
    const ray = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    ray.addColorStop(0, "rgba(255,255,250,0.9)");
    ray.addColorStop(0.55, "rgba(255,248,228,0.32)");
    ray.addColorStop(1, "rgba(255,248,228,0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - half) * len, Math.sin(a - half) * len);
    ctx.lineTo(Math.cos(a + half) * len, Math.sin(a + half) * len);
    ctx.closePath();
    ctx.fill();
  }
  return canvasTex(c);
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,250,1)");
  g.addColorStop(0.45, "rgba(248,224,176,0.7)");
  g.addColorStop(1, "rgba(248,224,176,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

let bladeTex = null;
let sunburstTex = null;
let moteTex = null;

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
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function motePoints(count, size, color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(count * 3), 3),
  );
  const mat = new THREE.PointsMaterial({
    map: moteTex,
    size,
    sizeAttenuation: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class RadiantBoltGL {
  constructor(scene, from, to, scale, big, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.big = big;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.lifetime = FOCUS_DUR + TRAVEL_DUR + POST_DUR + 0.15;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    // Light does not lob; the arc is only enough to lift it off a flat line.
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.03, 0.8),
      0,
    );
    this.aim = new THREE.Vector3().subVectors(this.p2, this.p0).normalize();
    this.angle = Math.atan2(this.aim.y, this.aim.x);

    this.core = new THREE.Group();
    this.blade = billboard(3.4 * scale, 0.5 * scale, 0, bladeTex);
    this.blade.rotation.z = this.angle;
    this.head = billboard(1.5 * scale, 1.5 * scale, 0, moteTex);
    this.head.material.color.setHex(CORE);
    this.core.add(this.blade);
    this.core.add(this.head);
    this.core.position.copy(this.p0);
    scene.add(this.core);

    // A cold wake, stretched from the muzzle to the head: the bleached air the
    // blade leaves behind. One quad, not a per-particle trail.
    this.wake = billboard(1, 0.22 * scale, 0, bladeTex);
    this.wake.material.color.setHex(COLD);
    this.wake.rotation.z = this.angle;
    scene.add(this.wake);

    const ps = getParticleScale();
    this.dustN = Math.max(4, Math.round((big ? 18 : 12) * ps));
    this.dust = motePoints(this.dustN, 0.26 * scale, EDGE);
    this.dustP = [];
    scene.add(this.dust);

    this.moteN = Math.max(6, Math.round((big ? 30 : 20) * ps));
    this.motes = motePoints(this.moteN, 0.32 * scale, CORE);
    this.moteP = [];
    scene.add(this.motes);

    this.burst = billboard(2 * scale, 2 * scale, 0, sunburstTex);
    this.burst.material.color.setHex(CORE);
    this.burst.position.copy(this.to);
    this.burst.visible = false;
    scene.add(this.burst);

    this.bloom = billboard(3.2 * scale, 3.2 * scale, 0, moteTex);
    this.bloom.material.color.setHex(EDGE);
    this.bloom.position.copy(this.to);
    this.bloom.visible = false;
    scene.add(this.bloom);
  }

  bezier(t) {
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * this.p0.x + 2 * u * t * this.ctrl.x + t * t * this.p2.x,
      u * u * this.p0.y + 2 * u * t * this.ctrl.y + t * t * this.p2.y,
      0,
    );
  }

  stretchWake(headPos) {
    const midX = (this.p0.x + headPos.x) / 2;
    const midY = (this.p0.y + headPos.y) / 2;
    const len = Math.hypot(headPos.x - this.p0.x, headPos.y - this.p0.y);
    this.wake.position.set(midX, midY, 0);
    this.wake.scale.x = Math.max(len, 0.001);
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

    // Focus: the blade gathers to a point at the muzzle before it is loosed.
    if (this.age < FOCUS_DUR) {
      const fp = Math.max(this.age, 0) / FOCUS_DUR;
      this.core.position.copy(this.p0);
      this.head.material.opacity = fp;
      this.head.scale.setScalar(1.8 - fp * 1.0);
      this.blade.material.opacity = fp * 0.5;
      return true;
    }

    const t = Math.min((this.age - FOCUS_DUR) / TRAVEL_DUR, 1);

    if (t < 1) {
      const pos = this.bezier(t);
      this.core.position.copy(pos);
      this.head.material.opacity = 1;
      this.head.scale.setScalar(1 + 0.14 * Math.sin(this.age * 40));
      this.blade.material.opacity = 0.95;
      this.blade.scale.x = 1 + t * 0.5;

      this.stretchWake(pos);
      this.wake.material.opacity = 0.35;

      if (this.dustP.length < this.dustN && Math.random() < 0.8) {
        this.dustP.push({
          x: pos.x - this.aim.x * 0.5,
          y: pos.y - this.aim.y * 0.5,
          vx: (Math.random() - 0.5) * 1.1,
          vy: (Math.random() - 0.5) * 1.1,
          life: 0.3 + Math.random() * 0.4,
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.core.position.copy(this.to);
      this.burst.visible = true;
      this.bloom.visible = true;
      this.burst.rotation.z = Math.random() * Math.PI;

      for (let i = 0; i < this.moteN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * 4.5;
        this.moteP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.35 + Math.random() * 0.45,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (this.age - FOCUS_DUR - TRAVEL_DUR) / POST_DUR;
      this.blade.material.opacity = Math.max(0, this.blade.material.opacity - dt * 7);
      this.head.material.opacity = Math.max(0, this.head.material.opacity - dt * 9);
      this.wake.material.opacity = Math.max(0, this.wake.material.opacity - dt * 4);

      // Overexpose fast, then leave a faint after-image.
      const grow = Math.min(e * 1.8, 1);
      this.burst.scale.setScalar((0.4 + grow * 3.6) * this.scale);
      this.burst.material.opacity = Math.max(0, 0.95 * (1 - e * e) + 0.06 * (1 - e));
      this.burst.rotation.z += dt * 0.6;
      this.bloom.scale.setScalar((0.6 + grow * 1.4) * this.scale);
      this.bloom.material.opacity = Math.max(0, 0.7 * (1 - e) * (1 - e));
    }

    this.integratePoints(this.dustP, dt, 0.9, -0.4);
    this.integratePoints(this.moteP, dt, 0.86, -0.6);
    this.writePoints(this.dustP, this.dust);
    this.writePoints(this.moteP, this.motes);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [
      this.core,
      this.wake,
      this.dust,
      this.motes,
      this.burst,
      this.bloom,
    ];
    for (const o of objs) scene.remove(o);
    for (const m of [
      this.blade,
      this.head,
      this.wake,
      this.dust,
      this.motes,
      this.burst,
      this.bloom,
    ]) {
      m.geometry.dispose();
      m.material.dispose();
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

  if (!bladeTex) bladeTex = makeBladeTexture();
  if (!sunburstTex) sunburstTex = makeSunburstTexture();
  if (!moteTex) moteTex = makeMoteTexture();

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

export function createRadiantBoltGL(scale, big = false) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    // No canvas fallback for the beam; skip it when WebGL is unavailable.
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

    let flashed = false;
    const onImpact = () => {
      if (flashed) return;
      flashed = true;
      targetEl.classList.add("radiant-hit");
      setTimeout(() => targetEl.classList.remove("radiant-hit"), 340);
    };

    const effect = new RadiantBoltGL(st.scene, from, to, scale, big, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
