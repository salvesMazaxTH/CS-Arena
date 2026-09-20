// Roots hit: the soil breaks under the target and vines whip up out of it to
// coil around their legs. Anchored at the target's feet, so there is no flight.

import { getParticleScale } from "./effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "./glStage.js";

const BREAK_DUR = 0.12;
const RISE_DUR = 0.2;
const HOLD_DUR = 0.42;
const FADE_DUR = 0.32;

const VINE_TINT = 0x76c04a;
const DEEP_TINT = 0x3f7a2c;
const LEAF_TINT = 0xa8e86b;
const SOIL_TINT = 0x8a6238;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeVineTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext("2d");

  const body = ctx.createLinearGradient(0, 256, 0, 0);
  body.addColorStop(0, "rgba(58,104,38,0.95)");
  body.addColorStop(0.55, "rgba(112,182,68,0.95)");
  body.addColorStop(1, "rgba(180,236,126,0.15)");

  ctx.beginPath();
  ctx.moveTo(26, 256);
  ctx.bezierCurveTo(14, 190, 46, 140, 30, 84);
  ctx.bezierCurveTo(24, 54, 34, 30, 33, 6);
  ctx.lineTo(39, 6);
  ctx.bezierCurveTo(42, 32, 34, 56, 40, 86);
  ctx.bezierCurveTo(56, 142, 26, 192, 38, 256);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();

  ctx.strokeStyle = "rgba(196,244,146,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = "rgba(128,198,80,0.85)";
  for (const [lx, ly, r, rot] of [
    [22, 196, 13, -0.7],
    [44, 148, 11, 0.8],
    [24, 104, 9, -0.9],
    [42, 62, 8, 0.7],
  ]) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return canvasTex(c);
}

function makeLeafTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(214,250,168,0.95)");
  g.addColorStop(0.45, "rgba(140,210,90,0.7)");
  g.addColorStop(1, "rgba(96,160,56,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(16, 16, 15, 7, 0.5, 0, Math.PI * 2);
  ctx.fill();
  return canvasTex(c);
}

function makeSoilTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, "rgba(168,126,78,0.95)");
  g.addColorStop(1, "rgba(112,80,46,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  return canvasTex(c);
}

function makeGripTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.translate(64, 64);

  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate((i / 3) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 20, 0, 0.25, Math.PI - 0.25);
    ctx.strokeStyle = i === 0 ? "rgba(184,238,132,0.9)" : "rgba(104,170,62,0.7)";
    ctx.lineWidth = 7 - i * 1.6;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  return canvasTex(c);
}

function makeBreakTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.translate(64, 32);

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 56);
  g.addColorStop(0, "rgba(58,38,20,0.85)");
  g.addColorStop(0.7, "rgba(96,68,38,0.35)");
  g.addColorStop(1, "rgba(120,88,50,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(40,26,14,0.8)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 5);
    ctx.lineTo(Math.cos(a) * 54, Math.sin(a) * 25);
    ctx.stroke();
  }

  return canvasTex(c);
}

let vineTex = null;
let leafTex = null;
let soilTex = null;
let gripTex = null;
let breakTex = null;

function bakeTextures() {
  if (!vineTex) vineTex = makeVineTexture();
  if (!leafTex) leafTex = makeLeafTexture();
  if (!soilTex) soilTex = makeSoilTexture();
  if (!gripTex) gripTex = makeGripTexture();
  if (!breakTex) breakTex = makeBreakTexture();
}

function billboard(w, h, opacity, tex, color, blending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: blending ?? THREE.NormalBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function groundedVine(w, h, tex, color) {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0,
  });
  mat.color.setHex(color);
  return new THREE.Mesh(geo, mat);
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
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class RootsGL {
  constructor(scene, ground, bodyY, scale, onImpact) {
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.ground = ground.clone();

    this.impactAt = BREAK_DUR + RISE_DUR;
    this.lifetime = this.impactAt + HOLD_DUR + FADE_DUR;

    this.break = billboard(3.4 * scale, 1.6 * scale, 0, breakTex, 0xffffff);
    this.break.position.set(ground.x, ground.y, 0.02);
    scene.add(this.break);

    const ps = getParticleScale();
    const vineCount = Math.max(4, Math.round(7 * ps));
    this.vines = [];
    for (let i = 0; i < vineCount; i++) {
      const spread = (i / (vineCount - 1) - 0.5) * 2;
      const h = (2.3 + Math.random() * 1.1) * scale;
      const mesh = groundedVine(
        0.72 * scale,
        h,
        vineTex,
        i % 3 === 0 ? DEEP_TINT : VINE_TINT,
      );
      mesh.position.set(
        ground.x + spread * 1.15 * scale,
        ground.y - 0.15 * scale,
        0.04 + i * 0.001,
      );
      mesh.scale.x = Math.random() < 0.5 ? -1 : 1;
      mesh.scale.y = 0;
      scene.add(mesh);
      this.vines.push({
        mesh,
        lean: spread * 0.42 + (Math.random() - 0.5) * 0.14,
        delay: Math.random() * 0.07,
        phase: Math.random() * Math.PI * 2,
        baseX: mesh.scale.x,
      });
    }

    this.grip = billboard(2.6 * scale, 2.6 * scale, 0, gripTex, LEAF_TINT);
    this.grip.position.set(ground.x, bodyY, 0.07);
    this.grip.visible = false;
    scene.add(this.grip);

    this.debrisMax = Math.max(12, Math.round(44 * ps));
    this.soil = particlePoints(this.debrisMax, 0.22 * scale, SOIL_TINT, soilTex);
    this.soil.geometry.setDrawRange(0, 0);
    this.leaves = particlePoints(
      this.debrisMax,
      0.3 * scale,
      LEAF_TINT,
      leafTex,
    );
    this.leaves.geometry.setDrawRange(0, 0);
    scene.add(this.soil);
    scene.add(this.leaves);
    this.soilP = [];
    this.leafP = [];
  }

  spawn(list, x, y, spread, up, gravity) {
    if (list.length >= this.debrisMax) list.shift();
    const a = Math.random() * Math.PI * 2;
    list.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.abs(Math.sin(a)) * spread + up,
      g: gravity,
      life: 0.3 + Math.random() * 0.5,
    });
  }

  step(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list.splice(i, 1);
        continue;
      }
      p.vx *= 0.92;
      p.vy = p.vy * 0.94 - p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  write(points, list) {
    const arr = points.geometry.attributes.position.array;
    for (let i = 0; i < list.length; i++) {
      arr[i * 3] = list[i].x;
      arr[i * 3 + 1] = list[i].y;
      arr[i * 3 + 2] = 0.06;
    }
    points.geometry.setDrawRange(0, list.length);
    points.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;

    const breakT = Math.min(this.age / BREAK_DUR, 1);
    this.break.scale.setScalar(0.45 + breakT * 0.55);
    this.break.material.opacity =
      this.age < this.impactAt
        ? breakT
        : Math.max(0, 1 - (this.age - this.impactAt) / (HOLD_DUR + FADE_DUR));

    if (this.age < BREAK_DUR && Math.random() < 0.8) {
      this.spawn(this.soilP, this.ground.x, this.ground.y, 2.6, 2.2, 11);
    }

    const tail = Math.max(
      0,
      1 - Math.max(0, this.age - this.impactAt - HOLD_DUR) / FADE_DUR,
    );

    for (const v of this.vines) {
      const t = Math.min(
        Math.max((this.age - BREAK_DUR - v.delay) / RISE_DUR, 0),
        1,
      );
      const e = 1 - Math.pow(1 - t, 3);
      v.mesh.scale.y = e;
      v.mesh.scale.x = v.baseX * (0.85 + e * 0.15);
      v.mesh.rotation.z =
        v.lean * e + Math.sin(this.age * 4 + v.phase) * 0.05 * e;
      v.mesh.material.opacity = Math.min(1, t * 3) * tail;

      if (t > 0 && t < 1 && Math.random() < 0.25) {
        this.spawn(
          this.leafP,
          v.mesh.position.x,
          v.mesh.position.y + e * 2.2 * this.scale,
          1.1,
          0.4,
          4,
        );
      }
    }

    if (!this.impacted && this.age >= this.impactAt) {
      this.impacted = true;
      this.grip.visible = true;
      for (let i = 0; i < this.debrisMax; i++) {
        this.spawn(this.leafP, this.grip.position.x, this.grip.position.y, 3.4, 0.6, 5);
      }
      this.onImpact?.();
    }

    if (this.impacted) {
      const g = Math.min((this.age - this.impactAt) / (HOLD_DUR + FADE_DUR), 1);
      this.grip.scale.setScalar(1.5 - Math.min(g * 4, 1) * 0.65);
      this.grip.rotation.z += dt * 1.2;
      this.grip.material.opacity = (g < 0.2 ? 1 : tail) * 0.95;
    }

    this.step(this.soilP, dt);
    this.step(this.leafP, dt);
    this.write(this.soil, this.soilP);
    this.write(this.leaves, this.leafP);
    this.soil.material.opacity = tail;
    this.leaves.material.opacity = tail;

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.break, this.grip, this.soil, this.leaves];
    for (const v of this.vines) objs.push(v.mesh);
    for (const o of objs) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createRootsGL(scale = 1) {
  return async (opts) => {
    const { targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;
    bakeTextures();

    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const ground = screenToWorld(cx, rect.bottom - rect.height * 0.06, st.camera);
    const body = screenToWorld(cx, rect.bottom - rect.height * 0.3, st.camera);

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("root-hit");
      setTimeout(() => targetEl.classList.remove("root-hit"), 420);
    };

    const effect = new RootsGL(st.scene, ground, body.y, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
