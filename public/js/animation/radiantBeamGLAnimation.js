// Radiant beam: a generic warm-light ultimate hit for any light champion — a
// thick concentrated shaft held from caster to target, not a travelling bolt.
// Opted into by name through a skill's hitVfx ("radiant_beam"). Same light
// recipe as the elemental bolts (persistent renderer, pixelRatio 1, no
// post-processing). It is the heaviest effect in the radiant family — a held,
// screen-spanning additive beam — so it is meant for ultimates only: rare,
// single-target, a short 0.34s sustain, two quads, capped particles.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const CHARGE_DUR = 0.12;
const SUSTAIN_DUR = 0.34;
const FADE_DUR = 0.22;

const CORE = 0xfffef6; // white centre
const WARM = 0xf7d39a; // the warm shoulder of the shaft
const AGED = 0xf2d29a;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A horizontal bar: bright only across a narrow central band so most of the
// halo quad's area stays low-alpha, and soft at both ends.
function makeBeamTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d");

  const h = ctx.createLinearGradient(0, 0, 128, 0);
  h.addColorStop(0, "rgba(255,254,246,0)");
  h.addColorStop(0.12, "rgba(255,254,246,0.85)");
  h.addColorStop(0.85, "rgba(247,211,154,0.8)");
  h.addColorStop(1, "rgba(247,211,154,0)");
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 128, 64);

  const v = ctx.createLinearGradient(0, 0, 0, 64);
  v.addColorStop(0, "rgba(0,0,0,1)");
  v.addColorStop(0.34, "rgba(0,0,0,0)");
  v.addColorStop(0.66, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 128, 64);
  ctx.globalCompositeOperation = "source-over";
  return canvasTex(c);
}

function makeSunburstTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.translate(128, 128);

  const disk = ctx.createRadialGradient(0, 0, 0, 0, 0, 128);
  disk.addColorStop(0, "rgba(255,255,250,0.95)");
  disk.addColorStop(0.24, "rgba(255,249,230,0.5)");
  disk.addColorStop(0.55, "rgba(247,211,154,0.16)");
  disk.addColorStop(1, "rgba(247,211,154,0)");
  ctx.fillStyle = disk;
  ctx.beginPath();
  ctx.arc(0, 0, 128, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const len = i % 2 ? 124 : 82;
    const half = i % 2 ? 0.05 : 0.032;
    const ray = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
    ray.addColorStop(0, "rgba(255,255,250,0.9)");
    ray.addColorStop(0.55, "rgba(255,248,228,0.3)");
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

let beamTex = null;
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

class RadiantBeamGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.fired = false;
    this.impacted = false;
    this.onImpact = onImpact;
    this.lifetime = CHARGE_DUR + SUSTAIN_DUR + FADE_DUR + 0.1;

    this.from = from.clone();
    this.to = to.clone();
    this.aim = new THREE.Vector3().subVectors(this.to, this.from).normalize();
    this.angle = Math.atan2(this.aim.y, this.aim.x);
    this.dist = this.from.distanceTo(this.to);
    this.mid = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      0,
    );

    this.head = billboard(2.2 * scale, 2.2 * scale, 0, moteTex);
    this.head.material.color.setHex(CORE);
    this.head.position.copy(this.from);
    scene.add(this.head);

    this.core = billboard(1, 0.55 * scale, 0, beamTex);
    this.core.material.color.setHex(CORE);
    this.core.position.copy(this.mid);
    this.core.rotation.z = this.angle;
    this.core.scale.x = this.dist;
    this.core.visible = false;
    scene.add(this.core);

    this.glow = billboard(1, 1.9 * scale, 0, beamTex);
    this.glow.material.color.setHex(WARM);
    this.glow.position.copy(this.mid);
    this.glow.rotation.z = this.angle;
    this.glow.scale.x = this.dist * 1.02;
    this.glow.visible = false;
    scene.add(this.glow);

    this.muzzle = billboard(3 * scale, 3 * scale, 0, sunburstTex);
    this.muzzle.material.color.setHex(AGED);
    this.muzzle.position.copy(this.from);
    this.muzzle.visible = false;
    scene.add(this.muzzle);

    this.burst = billboard(2.4 * scale, 2.4 * scale, 0, sunburstTex);
    this.burst.material.color.setHex(CORE);
    this.burst.position.copy(this.to);
    this.burst.visible = false;
    scene.add(this.burst);

    this.bloom = billboard(3.4 * scale, 3.4 * scale, 0, moteTex);
    this.bloom.material.color.setHex(AGED);
    this.bloom.position.copy(this.to);
    this.bloom.visible = false;
    scene.add(this.bloom);

    const ps = getParticleScale();
    this.streamN = Math.max(5, Math.round(16 * ps));
    this.stream = motePoints(this.streamN, 0.34 * scale, WARM);
    this.streamP = [];
    scene.add(this.stream);

    this.sparkN = Math.max(6, Math.round(22 * ps));
    this.spark = motePoints(this.sparkN, 0.36 * scale, CORE);
    this.sparkP = [];
    scene.add(this.spark);
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

  integratePoints(points, dt, drag) {
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      p.life -= dt;
      if (p.life <= 0) {
        points.splice(i, 1);
        continue;
      }
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  update(dt) {
    this.age += dt;

    if (this.age < CHARGE_DUR) {
      const cp = Math.max(this.age, 0) / CHARGE_DUR;
      this.head.material.opacity = cp;
      this.head.scale.setScalar(0.3 + cp * 1.1);
      return true;
    }

    if (!this.fired) {
      this.fired = true;
      this.core.visible = true;
      this.glow.visible = true;
      this.muzzle.visible = true;
      this.head.scale.setScalar(1.4);
      this.head.material.opacity = 1;
    }

    const sustainAge = this.age - CHARGE_DUR;

    if (sustainAge < SUSTAIN_DUR) {
      const boil = 1 + 0.06 * Math.sin(sustainAge * 30);
      this.core.material.opacity = 0.95;
      this.glow.material.opacity = 0.5;
      this.glow.scale.y = boil;
      this.muzzle.material.opacity = Math.max(0, 0.9 * (1 - sustainAge / 0.12));
      this.muzzle.rotation.z += dt * 3;

      if (this.streamP.length < this.streamN && Math.random() < 0.9) {
        const j = (Math.random() - 0.5) * 0.9 * this.scale;
        this.streamP.push({
          x: this.from.x - this.aim.y * j,
          y: this.from.y + this.aim.x * j,
          vx: this.aim.x * (this.dist / SUSTAIN_DUR) * 0.5,
          vy: this.aim.y * (this.dist / SUSTAIN_DUR) * 0.5,
          life: 0.2 + Math.random() * 0.2,
        });
      }
    } else if (!this.impacted) {
      this.impacted = true;
      this.burst.visible = true;
      this.bloom.visible = true;
      this.burst.rotation.z = Math.random() * Math.PI;
      for (let i = 0; i < this.sparkN; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 2 + Math.random() * 6;
        this.sparkP.push({
          x: this.to.x,
          y: this.to.y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.3 + Math.random() * 0.4,
        });
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const e = (sustainAge - SUSTAIN_DUR) / FADE_DUR;
      const k = Math.max(0, 1 - e);
      this.core.material.opacity = 0.95 * k;
      this.glow.material.opacity = 0.5 * k;
      this.glow.scale.y = 1 - e * 0.5;
      this.head.material.opacity = k;

      const grow = Math.min(e * 1.8, 1);
      this.burst.scale.setScalar((0.5 + grow * 3.0) * this.scale);
      this.burst.material.opacity = Math.max(0, 0.95 * (1 - e * e) + 0.06 * k);
      this.burst.rotation.z += dt * 0.6;
      this.bloom.scale.setScalar((0.7 + grow * 1.5) * this.scale);
      this.bloom.material.opacity = Math.max(0, 0.7 * k * k);
    }

    this.integratePoints(this.streamP, dt, 0.96);
    this.integratePoints(this.sparkP, dt, 0.88);
    this.writePoints(this.streamP, this.stream);
    this.writePoints(this.sparkP, this.spark);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [
      this.head,
      this.core,
      this.glow,
      this.muzzle,
      this.burst,
      this.bloom,
      this.stream,
      this.spark,
    ];
    for (const o of objs) {
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

  if (!beamTex) beamTex = makeBeamTexture();
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

export function createRadiantBeamGL(scale) {
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
      : new THREE.Vector3(to.x - 8, to.y, 0);

    let flashed = false;
    const onImpact = () => {
      if (flashed) return;
      flashed = true;
      targetEl.classList.add("radiant-hit");
      setTimeout(() => targetEl.classList.remove("radiant-hit"), 360);
    };

    const effect = new RadiantBeamGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
