// Venom frost hit: a wave of magical cold rolls from the caster to the target,
// carrying small ice crystals and globs of viscous purple toxin. On arrival the
// cold blooms over the target and the toxin splatters, clings and oozes down.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";
import { makeShardTexture } from "./venomShardGLAnimation.js";

const TRAVEL_DUR = 0.42;
const POST_DUR = 0.62;
const SWELL_DUR = 0.14;

const COLD_TINT = 0xbfe8ff;
const HAZE_TINT = 0x6a3f8c;
const GOO_COUNT = 7;
const SPLAT_COUNT = 9;
const SHARD_COUNT = 5;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The wave front: a tall soft crescent, brightest on its leading edge (+x).
function makeFrontTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext("2d");

  for (let i = 0; i < 3; i++) {
    const inset = i * 14;
    const g = ctx.createRadialGradient(4 - inset, 128, 40, 4 - inset, 128, 126);
    g.addColorStop(0, "rgba(160,215,255,0)");
    g.addColorStop(0.72, "rgba(160,215,255,0)");
    g.addColorStop(0.88, `rgba(205,238,255,${0.22 + i * 0.12})`);
    g.addColorStop(0.95, `rgba(245,252,255,${0.35 + i * 0.2})`);
    g.addColorStop(1, "rgba(245,252,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 256);
  }

  // Fade the tips so the crescent has no hard top and bottom.
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.22, "rgba(0,0,0,1)");
  fade.addColorStop(0.78, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 128, 256);
  return canvasTex(c);
}

// Cold haze behind the front, frosty at the head and soured purple at the tail.
function makeHazeTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  const h = ctx.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, "rgba(90,40,120,0)");
  h.addColorStop(0.35, "rgba(110,60,150,0.4)");
  h.addColorStop(0.75, "rgba(150,200,240,0.45)");
  h.addColorStop(1, "rgba(200,236,255,0)");
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 256, 128);
  ctx.globalCompositeOperation = "destination-in";
  const v = ctx.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(0.5, "rgba(0,0,0,1)");
  v.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 256, 128);
  return canvasTex(c);
}

function makeCrystalTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, "rgba(220,244,255,0.6)");
  glow.addColorStop(1, "rgba(220,244,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);
  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(21, 16);
  ctx.lineTo(16, 29);
  ctx.lineTo(11, 16);
  ctx.closePath();
  ctx.fillStyle = "rgba(236,250,255,1)";
  ctx.fill();
  ctx.strokeStyle = "rgba(140,200,255,0.9)";
  ctx.lineWidth = 1;
  ctx.stroke();
  return canvasTex(c);
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.5, "rgba(190,230,255,0.6)");
  g.addColorStop(1, "rgba(190,230,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

// A glossy glob of toxin: dark rim, saturated body, a wet highlight.
function makeGooTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.beginPath();
  const pts = 11;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = 25 + Math.sin(i * 2.3) * 3 + Math.cos(i * 3.1) * 2;
    const x = 32 + Math.cos(a) * r;
    const y = 32 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const body = ctx.createRadialGradient(26, 24, 2, 32, 32, 28);
  body.addColorStop(0, "rgba(214,120,255,1)");
  body.addColorStop(0.45, "rgba(140,40,200,1)");
  body.addColorStop(0.85, "rgba(70,12,110,1)");
  body.addColorStop(1, "rgba(40,6,70,0.9)");
  ctx.fillStyle = body;
  ctx.fill();
  const hi = ctx.createRadialGradient(23, 20, 0, 23, 20, 9);
  hi.addColorStop(0, "rgba(255,240,255,0.95)");
  hi.addColorStop(1, "rgba(255,240,255,0)");
  ctx.fillStyle = hi;
  ctx.fillRect(10, 8, 26, 26);
  return canvasTex(c);
}

function makeBloomTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(200,236,255,0.7)");
  g.addColorStop(0.65, "rgba(120,170,230,0.25)");
  g.addColorStop(1, "rgba(120,170,230,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let frontTex = null;
let hazeTex = null;
let crystalTex = null;
let moteTex = null;
let gooTex = null;
let bloomTex = null;
let shardTex = null;

function bakeTextures() {
  if (!frontTex) frontTex = makeFrontTexture();
  if (!hazeTex) hazeTex = makeHazeTexture();
  if (!crystalTex) crystalTex = makeCrystalTexture();
  if (!moteTex) moteTex = makeMoteTexture();
  if (!gooTex) gooTex = makeGooTexture();
  if (!bloomTex) bloomTex = makeBloomTexture();
  if (!shardTex) shardTex = makeShardTexture();
}

function billboard(w, h, opacity, tex, color, blending) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: blending ?? THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
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
    blending: blending ?? THREE.AdditiveBlending,
    depthWrite: false,
    color,
  });
  return new THREE.Points(geo, mat);
}

class VenomFrostGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.from = from.clone();
    this.to = to.clone();
    this.lifetime = SWELL_DUR + TRAVEL_DUR + POST_DUR + 0.2;

    this.dir = new THREE.Vector3().subVectors(to, from);
    this.dist = Math.max(0.001, this.dir.length());
    this.dir.divideScalar(this.dist);
    this.normal = new THREE.Vector3(-this.dir.y, this.dir.x, 0);
    this.angle = Math.atan2(this.dir.y, this.dir.x);
    this.halfSpan = 1.5 * scale;

    this.front = billboard(1.6 * scale, 3.4 * scale, 0, frontTex, COLD_TINT);
    this.front.rotation.z = this.angle;
    scene.add(this.front);

    this.haze = billboard(
      4.2 * scale,
      2.6 * scale,
      0,
      hazeTex,
      undefined,
      THREE.NormalBlending,
    );
    this.haze.rotation.z = this.angle;
    scene.add(this.haze);

    const ps = getParticleScale();
    this.crystalN = Math.max(6, Math.round(26 * ps));
    this.crystals = particlePoints(this.crystalN, 0.34 * scale, 0xffffff, crystalTex);
    this.crystalP = [];
    scene.add(this.crystals);

    this.moteN = Math.max(8, Math.round(40 * ps));
    this.motes = particlePoints(this.moteN, 0.22 * scale, 0xd8f2ff, moteTex);
    this.moteP = [];
    scene.add(this.motes);

    // Globs are a handful of meshes so each one can stretch as it moves.
    this.goo = [];
    for (let i = 0; i < GOO_COUNT; i++) {
      const m = billboard(
        0.42 * scale,
        0.42 * scale,
        0,
        gooTex,
        undefined,
        THREE.NormalBlending,
      );
      m.userData.offset = (i / (GOO_COUNT - 1) - 0.5) * 2;
      m.userData.lag = 0.08 + Math.random() * 0.18;
      m.userData.size = 0.7 + Math.random() * 0.6;
      scene.add(m);
      this.goo.push(m);
    }
    this.splats = [];

    // Solid ice shards ride inside the wave so it reads as ice, not only cold.
    this.shards = [];
    for (let i = 0; i < SHARD_COUNT; i++) {
      const m = billboard(
        0.9 * scale,
        0.9 * scale,
        0,
        shardTex,
        undefined,
        THREE.NormalBlending,
      );
      m.position.z = 0.02;
      m.userData.offset = (i / (SHARD_COUNT - 1) - 0.5) * 1.6;
      m.userData.lead = (Math.random() - 0.5) * 0.06;
      m.userData.size = 0.65 + Math.random() * 0.5;
      m.userData.tilt = (Math.random() - 0.5) * 0.5;
      m.userData.spin = (Math.random() - 0.5) * 3;
      scene.add(m);
      this.shards.push(m);
    }

    this.bloom = billboard(4.2 * scale, 4.2 * scale, 0, bloomTex);
    this.bloom.position.copy(this.to);
    this.bloom.visible = false;
    scene.add(this.bloom);
  }

  frontPos(t) {
    return new THREE.Vector3().copy(this.from).addScaledVector(this.dir, this.dist * t);
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

  spawnAlongFront(points, max, pos, speed, life) {
    if (points.length >= max) return;
    const off = (Math.random() * 2 - 1) * this.halfSpan;
    points.push({
      x: pos.x + this.normal.x * off,
      y: pos.y + this.normal.y * off,
      vx: this.dir.x * speed + (Math.random() - 0.5) * 1.2,
      vy: this.dir.y * speed + (Math.random() - 0.5) * 1.2,
      life,
    });
  }

  impact() {
    this.impacted = true;
    this.bloom.visible = true;

    for (const m of this.goo) m.visible = false;
    for (const m of this.shards) m.visible = false;
    for (let i = 0; i < SPLAT_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.8) * this.scale;
      const m = billboard(
        0.36 * this.scale,
        0.36 * this.scale,
        1,
        gooTex,
        undefined,
        THREE.NormalBlending,
      );
      m.position.set(
        this.to.x + Math.cos(a) * r,
        this.to.y + Math.sin(a) * r * 0.8,
        0.03,
      );
      m.userData = {
        size: 0.6 + Math.random() * 0.8,
        vy: -(0.25 + Math.random() * 0.45),
        delay: Math.random() * 0.12,
      };
      this.scene.add(m);
      this.splats.push(m);
    }

    for (let i = 0; i < this.crystalN; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      this.crystalP.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.25 + Math.random() * 0.3,
      });
    }
    this.onImpact?.();
  }

  update(dt) {
    this.age += dt;

    if (this.age < SWELL_DUR) {
      // The cold gathers in front of the caster before it rolls out.
      const sp = this.age / SWELL_DUR;
      this.front.position.copy(this.from);
      this.front.scale.set(0.5 + sp * 0.5, 0.3 + sp * 0.7, 1);
      this.front.material.opacity = sp * 0.9;
      this.spawnAlongFront(this.moteP, this.moteN, this.from, 0.4, 0.3);
      this.integratePoints(this.moteP, dt, 0.9, 0);
      this.writePoints(this.moteP, this.motes);
      return true;
    }

    const flightAge = this.age - SWELL_DUR;
    const t = Math.min(flightAge / TRAVEL_DUR, 1);
    const eased = 1 - (1 - t) ** 1.6;

    if (t < 1) {
      const pos = this.frontPos(eased);
      const swell = 1 + 0.06 * Math.sin(flightAge * 22);
      this.front.position.copy(pos);
      this.front.scale.set(1, swell, 1);
      this.front.material.opacity = 0.9;
      this.haze.position.copy(pos).addScaledVector(this.dir, -1.9 * this.scale);
      this.haze.material.opacity = Math.min(0.85, t * 3);

      const speed = this.dist / TRAVEL_DUR;
      this.spawnAlongFront(this.moteP, this.moteN, pos, speed * 0.25, 0.3);
      this.spawnAlongFront(this.moteP, this.moteN, pos, speed * 0.1, 0.4);
      if (Math.random() < 0.7) {
        this.spawnAlongFront(this.crystalP, this.crystalN, pos, speed * 0.55, 0.35);
      }

      for (const m of this.shards) {
        const d = m.userData;
        const sp = this.frontPos(Math.min(1, eased + d.lead)).addScaledVector(
          this.normal,
          d.offset * this.halfSpan * 0.6,
        );
        m.position.set(sp.x, sp.y, 0.02);
        m.rotation.z = this.angle + d.tilt + Math.sin(flightAge * d.spin) * 0.2;
        m.scale.setScalar(d.size);
        m.material.opacity = Math.min(1, t * 8);
      }

      // Globs ride just behind the front, sagging and stretched by the push.
      for (const m of this.goo) {
        const gt = Math.max(0, eased - m.userData.lag);
        const gp = this.frontPos(gt).addScaledVector(
          this.normal,
          m.userData.offset * this.halfSpan * 0.75,
        );
        gp.y -= Math.sin(gt * Math.PI) * 0.25 * this.scale;
        m.position.copy(gp);
        m.rotation.z = this.angle;
        const s = m.userData.size;
        m.scale.set(s * 1.5, s * 0.8, 1);
        m.material.opacity = Math.min(1, gt * 6);
      }
    } else if (!this.impacted) {
      this.impact();
    }

    if (this.impacted) {
      const e = (flightAge - TRAVEL_DUR) / POST_DUR;
      this.front.position.copy(this.to);
      this.front.scale.set(1 + e * 1.2, 1 + e * 0.4, 1);
      this.front.material.opacity = Math.max(0, 0.9 * (1 - e * 2));
      this.haze.position.copy(this.to);
      this.haze.material.opacity = Math.max(0, 0.85 * (1 - e * 1.3));
      this.bloom.material.opacity = Math.max(0, 0.85 * (1 - e) * (1 - e));
      this.bloom.scale.setScalar(0.6 + e * 0.9);

      // Splatter: squashes on contact, then clings and oozes down slowly.
      const age = flightAge - TRAVEL_DUR;
      for (const m of this.splats) {
        const d = m.userData;
        const local = Math.max(0, age - d.delay);
        const squash = Math.min(1, local / 0.08);
        const drip = Math.min(1, local / POST_DUR);
        m.scale.set(d.size * (1.4 - squash * 0.4), d.size * (0.6 + drip * 0.7), 1);
        m.position.y += d.vy * dt * squash;
        m.material.opacity = Math.max(0, 1 - Math.max(0, e - 0.55) / 0.45);
      }
    }

    this.integratePoints(this.moteP, dt, 0.9, -0.3);
    this.integratePoints(this.crystalP, dt, 0.9, -3);
    this.writePoints(this.moteP, this.motes);
    this.writePoints(this.crystalP, this.crystals);

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const meshes = [
      this.front,
      this.haze,
      this.crystals,
      this.motes,
      this.bloom,
      ...this.goo,
      ...this.splats,
      ...this.shards,
    ];
    for (const m of meshes) {
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

export function createVenomFrostGL(scale = 1) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) return;
    bakeTextures();

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
      targetEl.classList.add("ice-hit");
      setTimeout(() => targetEl.classList.remove("ice-hit"), 320);
    };

    const effect = new VenomFrostGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
