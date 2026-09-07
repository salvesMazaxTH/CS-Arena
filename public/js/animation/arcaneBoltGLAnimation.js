// Arcane bolt: a Three.js orb conjured inside a spinning sigil in the shared
// #webgl-container, same light recipe as the elemental bolts (persistent
// renderer, pixelRatio 1, no post-processing). It is the magical Basic Shot's
// default, and any skill can borrow it by name with `hitVfx: "arcane_bolt"`.

import { getElementCenter } from "./animationUtils.js";
import { getParticleScale, recordEffectFrame } from "./effectQuality.js";

const CAST_DUR = 0.16;
const TRAVEL_DUR = 0.24;
const POST_DUR = 0.4;

// Picked with `hitVfxPalette`, or resolved from the skill's element. Violet is
// the default because the bolt carries no affinity of its own.
const PALETTES = Object.freeze({
  violet: { core: "#fdf3ff", mid: "#b066ff", deep: "#5a1eb4" },
  glacial: { core: "#f4faff", mid: "#7fa8ff", deep: "#25307e" },
  crimson: { core: "#fff2f2", mid: "#ff5f7a", deep: "#a8103a" },
  verdant: { core: "#f2fff4", mid: "#6ee89a", deep: "#127a48" },
  fire: { core: "#fff6df", mid: "#ffb347", deep: "#ff4d12" },
  water: { core: "#f0feff", mid: "#7fd4ff", deep: "#2e92f6" },
  ice: { core: "#f4ffff", mid: "#b6f2ff", deep: "#56b2ce" },
  lightning: { core: "#fffce0", mid: "#ffe66b", deep: "#e0a915" },
  earth: { core: "#fff4e2", mid: "#d2a878", deep: "#8a5a2b" },
});

const DEFAULT_PALETTE = "violet";

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The orb is the one texture baked per palette: a flat tint over a violet
// gradient turns muddy, and the core-to-deep falloff is what gives it depth.
function makeOrbTexture({ core, mid, deep }) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");

  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.16, `${core}fa`);
  g.addColorStop(0.38, `${mid}d9`);
  g.addColorStop(0.7, `${deep}52`);
  g.addColorStop(1, `${deep}00`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);

  // A thin bright shell, so the orb reads as contained rather than as a smudge.
  ctx.strokeStyle = `${core}bf`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(64, 64, 33, 0, Math.PI * 2);
  ctx.stroke();
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

function makeSigilTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.translate(64, 64);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";

  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 38, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const inner = i % 3 === 0 ? 44 : 54;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * 62, Math.sin(a) * 62);
    ctx.stroke();
  }
  return canvasTex(c);
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 14);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
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
  g.addColorStop(0.64, "rgba(255,255,255,0)");
  g.addColorStop(0.81, "rgba(255,255,255,0.9)");
  g.addColorStop(0.93, "rgba(255,255,255,0.28)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

// Every texture but the orb is baked white once and coloured by its material,
// so a new palette costs one more 128px canvas and nothing else.
let glowTex = null;
let sigilTex = null;
let moteTex = null;
let ringTex = null;

const orbTexCache = new Map();

function getOrbTex(paletteKey) {
  let tex = orbTexCache.get(paletteKey);
  if (!tex) {
    tex = makeOrbTexture(PALETTES[paletteKey]);
    orbTexCache.set(paletteKey, tex);
  }
  return tex;
}

function screenToWorld(x, y, camera) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const out = new THREE.Vector3();
  ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), out);
  return out;
}

function billboard(w, h, opacity, tex, tint) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  mat.color.set(tint);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function particlePoints(count, size, color, tex) {
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
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class ArcaneBoltGL {
  constructor(scene, from, to, scale, paletteKey, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.colors = PALETTES[paletteKey];
    this.orbTex = getOrbTex(paletteKey);
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.to = to.clone();
    this.lifetime = CAST_DUR + TRAVEL_DUR + POST_DUR;

    this.p0 = from.clone();
    this.p2 = to.clone();
    const dist = this.p0.distanceTo(this.p2);
    this.ctrl = new THREE.Vector3(
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 + Math.min(dist * 0.1, 1.2),
      0,
    );
    this.aim = new THREE.Vector3().subVectors(this.p2, this.p0).normalize();

    const { core, mid } = this.colors;

    this.core = new THREE.Group();
    this.core.position.copy(this.p0);
    this.halo = billboard(2.1 * scale, 2.1 * scale, 0.55, glowTex, mid);
    this.halo.position.z = -0.01;
    this.core.add(this.halo);
    this.orb = billboard(1.15 * scale, 1.15 * scale, 1, this.orbTex, "#ffffff");
    this.core.add(this.orb);
    this.core.scale.setScalar(0.01);
    scene.add(this.core);

    this.sigil = billboard(3.5 * scale, 3.5 * scale, 0, sigilTex, core);
    this.sigil.position.copy(this.p0);
    scene.add(this.sigil);

    this.flash = billboard(3.8 * scale, 3.8 * scale, 0, glowTex, core);
    this.flash.position.copy(this.to);
    this.flash.visible = false;
    scene.add(this.flash);

    this.moteN = Math.max(10, Math.round(46 * getParticleScale()));
    this.mote = particlePoints(this.moteN, 0.34 * scale, mid, moteTex);
    this.moteP = [];
    scene.add(this.mote);
  }

  bezier(t) {
    const u = 1 - t;
    return new THREE.Vector3(
      u * u * this.p0.x + 2 * u * t * this.ctrl.x + t * t * this.p2.x,
      u * u * this.p0.y + 2 * u * t * this.ctrl.y + t * t * this.p2.y,
      0,
    );
  }

  spawnMote(x, y, spread, life) {
    if (this.moteP.length >= this.moteN) return;
    const a = Math.random() * Math.PI * 2;
    this.moteP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread,
      life: life * (0.6 + Math.random() * 0.6),
    });
  }

  writeMotes() {
    const arr = this.mote.geometry.attributes.position.array;
    for (let i = 0; i < this.moteP.length; i++) {
      arr[i * 3] = this.moteP[i].x;
      arr[i * 3 + 1] = this.moteP[i].y;
      arr[i * 3 + 2] = 0;
    }
    this.mote.geometry.setDrawRange(0, this.moteP.length);
    this.mote.geometry.attributes.position.needsUpdate = true;
  }

  integrateMotes(dt) {
    for (let i = this.moteP.length - 1; i >= 0; i--) {
      const p = this.moteP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.moteP.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 + 1.4 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  // The orb is drawn into being inside the sigil, then thrown.
  updateCast(t) {
    this.sigil.material.opacity = Math.sin(t * Math.PI) * 0.95;
    this.sigil.scale.setScalar(1.5 - t * 0.6);
    this.sigil.rotation.z += 0.09;
    this.core.scale.setScalar(t * t);
    if (Math.random() < 0.8) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.6 * this.scale;
      this.spawnMote(
        this.p0.x + Math.cos(a) * r,
        this.p0.y + Math.sin(a) * r,
        -1.9,
        0.3,
      );
    }
  }

  updateTravel(t) {
    const pos = this.bezier(t);
    this.core.position.copy(pos);
    this.core.scale.setScalar(1);
    this.halo.material.opacity = 0.45 + 0.2 * Math.sin(this.age * 38);
    this.halo.scale.setScalar(1 + 0.12 * Math.sin(this.age * 30));
    this.orb.rotation.z += 0.14;
    this.spawnMote(
      pos.x - this.aim.x * 0.35,
      pos.y - this.aim.y * 0.35,
      0.9,
      0.34,
    );
  }

  impact() {
    this.impacted = true;
    this.core.position.copy(this.to);
    this.sigil.material.opacity = 0;
    this.flash.visible = true;

    this.ring = billboard(2, 2, 0.9, ringTex, this.colors.mid);
    this.ring.position.copy(this.to);
    this.scene.add(this.ring);

    for (let i = 0; i < this.moteN; i++) {
      this.spawnMote(this.to.x, this.to.y, 3 + Math.random() * 9, 0.42);
    }
    this.onImpact?.();
  }

  updatePost(e) {
    // The orb pinches shut an instant before the burst opens up.
    const collapse = Math.max(0, 1 - e * 7);
    this.core.scale.setScalar(collapse);
    this.halo.material.opacity = 0.55 * collapse;

    this.flash.material.opacity = Math.max(0, 0.95 * (1 - e * e));
    this.flash.scale.setScalar(0.5 + e * 1.9);

    const re = Math.min(e * 1.45, 1);
    this.ring.scale.setScalar((0.4 + re * 3.6) * this.scale);
    this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
  }

  update(dt) {
    this.age += dt;

    if (this.age < CAST_DUR) {
      this.updateCast(this.age / CAST_DUR);
    } else {
      const t = Math.min((this.age - CAST_DUR) / TRAVEL_DUR, 1);
      if (t < 1) {
        this.updateTravel(t);
      } else {
        if (!this.impacted) this.impact();
        this.updatePost((this.age - CAST_DUR - TRAVEL_DUR) / POST_DUR);
      }
    }

    this.integrateMotes(dt);
    this.writeMotes();
    return this.age < this.lifetime;
  }

  dispose(scene) {
    const meshes = [this.orb, this.halo, this.sigil, this.flash, this.mote];
    if (this.ring) meshes.push(this.ring);

    scene.remove(this.core);
    for (const m of meshes) {
      scene.remove(m);
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

  if (!glowTex) glowTex = makeGlowTexture();
  if (!sigilTex) sigilTex = makeSigilTexture();
  if (!moteTex) moteTex = makeMoteTexture();
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

export function createArcaneBoltGL(scale) {
  return async (opts) => {
    const { userEl, targetEl, skill } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;

    const requested = skill?.hitVfxPalette || skill?.element;
    const paletteKey = requested in PALETTES ? requested : DEFAULT_PALETTE;

    const tc = getElementCenter(targetEl);
    const to = screenToWorld(tc.x, tc.y, st.camera);
    const uc = userEl ? getElementCenter(userEl) : null;
    const from = uc
      ? screenToWorld(uc.x, uc.y, st.camera)
      : new THREE.Vector3(to.x - 6, to.y + 1, 0);

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("shot-hit");
      setTimeout(() => targetEl.classList.remove("shot-hit"), 260);
    };

    const effect = new ArcaneBoltGL(
      st.scene,
      from,
      to,
      scale,
      paletteKey,
      onImpact,
    );
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
