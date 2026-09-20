// Water shuriken hit: a four-bladed disc of water spun up at the caster, thrown
// flat and fast, and torn apart on contact into the coil that snares.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const SPIN_DUR = 0.16;
const FLIGHT_DUR = 0.24;
const AFTER_DUR = 0.62;

const BLADE_TINT = 0x9fe2f5;
const RIM_TINT = 0xeafcff;
const COIL_TINT = 0x5fb6dc;

const SPIN_RATE = 26;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function bladePath(ctx, reach) {
  ctx.beginPath();
  ctx.moveTo(reach * 0.16, -reach * 0.13);
  ctx.quadraticCurveTo(reach * 0.72, -reach * 0.3, reach, -reach * 0.04);
  ctx.quadraticCurveTo(reach * 0.66, reach * 0.12, reach * 0.2, reach * 0.16);
  ctx.closePath();
}

function makeShurikenTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.translate(64, 64);

  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i / 4) * Math.PI * 2);

    const g = ctx.createLinearGradient(0, 0, 58, 0);
    g.addColorStop(0, "rgba(180,232,250,0.35)");
    g.addColorStop(0.55, "rgba(214,244,255,0.68)");
    g.addColorStop(1, "rgba(255,255,255,0.95)");
    ctx.fillStyle = g;
    bladePath(ctx, 58);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  const hub = ctx.createRadialGradient(0, 0, 0, 0, 0, 16);
  hub.addColorStop(0, "rgba(160,222,244,0)");
  hub.addColorStop(0.62, "rgba(200,238,252,0.25)");
  hub.addColorStop(0.86, "rgba(255,255,255,0.8)");
  hub.addColorStop(1, "rgba(200,238,252,0)");
  ctx.fillStyle = hub;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();

  return canvasTex(c);
}

function makeShardTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  ctx.translate(6, 32);
  const g = ctx.createLinearGradient(0, 0, 52, 0);
  g.addColorStop(0, "rgba(190,236,252,0.2)");
  g.addColorStop(0.6, "rgba(224,247,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = g;
  bladePath(ctx, 52);
  ctx.fill();
  return canvasTex(c);
}

function makeDropTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,0.98)");
  g.addColorStop(0.4, "rgba(206,240,255,0.7)");
  g.addColorStop(1, "rgba(160,214,244,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeCoilTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.72, "rgba(255,255,255,0)");
  g.addColorStop(0.86, "rgba(234,252,255,0.95)");
  g.addColorStop(0.95, "rgba(120,196,232,0.35)");
  g.addColorStop(1, "rgba(120,196,232,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeStreakTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(190,236,252,0)");
  g.addColorStop(0.7, "rgba(224,247,255,0.45)");
  g.addColorStop(1, "rgba(255,255,255,0.9)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 5, 128, 6);
  return canvasTex(c);
}

let shurikenTex = null;
let shardTex = null;
let dropTex = null;
let coilTex = null;
let streakTex = null;

function bakeTextures() {
  if (!shurikenTex) shurikenTex = makeShurikenTexture();
  if (!shardTex) shardTex = makeShardTexture();
  if (!dropTex) dropTex = makeDropTexture();
  if (!coilTex) coilTex = makeCoilTexture();
  if (!streakTex) streakTex = makeStreakTexture();
}

function billboard(w, h, opacity, tex, color) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity,
  });
  if (color !== undefined) mat.color.setHex(color);
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

class WaterShurikenGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scale = scale;
    this.age = 0;
    this.spin = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.from = from.clone();
    this.to = to.clone();

    this.impactAt = SPIN_DUR + FLIGHT_DUR;
    this.lifetime = this.impactAt + AFTER_DUR;

    const aim = new THREE.Vector3().subVectors(to, from);
    this.dir = aim.clone().normalize();
    this.arc = Math.min(aim.length() * 0.12, 1.6);

    this.blade = billboard(1.05 * scale, 1.05 * scale, 0, shurikenTex, BLADE_TINT);
    this.blade.position.copy(from);
    this.blade.position.z = 0.04;
    scene.add(this.blade);

    this.streak = billboard(1.9 * scale, 0.2 * scale, 0, streakTex, RIM_TINT);
    this.streak.rotation.z = Math.atan2(aim.y, aim.x);
    this.streak.visible = false;
    scene.add(this.streak);

    this.coil = billboard(2.2 * scale, 2.2 * scale, 0, coilTex, COIL_TINT);
    this.coil.position.copy(to);
    this.coil.visible = false;
    scene.add(this.coil);

    const ps = getParticleScale();
    this.dropMax = Math.max(14, Math.round(52 * ps));
    this.drops = particlePoints(this.dropMax, 0.26 * scale, RIM_TINT, dropTex);
    this.drops.geometry.setDrawRange(0, 0);
    this.dropP = [];
    scene.add(this.drops);

    this.shards = [];
    for (let i = 0; i < 4; i++) {
      const mesh = billboard(0.62 * scale, 0.34 * scale, 0, shardTex, BLADE_TINT);
      mesh.position.copy(to);
      mesh.visible = false;
      scene.add(mesh);
      this.shards.push({
        mesh,
        angle: (i / 4) * Math.PI * 2 + Math.random() * 0.4,
        speed: 5 + Math.random() * 3,
        spin: (Math.random() - 0.5) * 22,
      });
    }
  }

  spawnDrop(x, y, spread, up) {
    if (this.dropP.length >= this.dropMax) this.dropP.shift();
    const a = Math.random() * Math.PI * 2;
    this.dropP.push({
      x,
      y,
      vx: Math.cos(a) * spread,
      vy: Math.sin(a) * spread + up,
      life: 0.22 + Math.random() * 0.4,
    });
  }

  writeDrops() {
    const arr = this.drops.geometry.attributes.position.array;
    for (let i = 0; i < this.dropP.length; i++) {
      arr[i * 3] = this.dropP[i].x;
      arr[i * 3 + 1] = this.dropP[i].y;
      arr[i * 3 + 2] = 0;
    }
    this.drops.geometry.setDrawRange(0, this.dropP.length);
    this.drops.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    this.age += dt;
    this.spin += dt * SPIN_RATE;
    this.blade.rotation.z = this.spin;

    if (this.age < SPIN_DUR) {
      const t = this.age / SPIN_DUR;
      this.blade.material.opacity = t;
      this.blade.scale.setScalar(1.7 - t * 0.7);
      if (Math.random() < 0.6) this.spawnDrop(this.from.x, this.from.y, 1.6, 0.4);
    } else if (!this.impacted) {
      const t = Math.min((this.age - SPIN_DUR) / FLIGHT_DUR, 1);
      const eased = t * t * (3 - 2 * t);
      const x = this.from.x + (this.to.x - this.from.x) * eased;
      const y =
        this.from.y +
        (this.to.y - this.from.y) * eased +
        Math.sin(eased * Math.PI) * this.arc;

      this.blade.position.set(x, y, 0.04);
      this.blade.material.opacity = 1;
      this.blade.scale.setScalar(1);

      this.streak.visible = true;
      this.streak.material.opacity = 0.75;
      this.streak.position.set(
        x - this.dir.x * 0.9 * this.scale,
        y - this.dir.y * 0.9 * this.scale,
        0.03,
      );

      this.spawnDrop(x, y, 0.9, 0);

      if (t >= 1) {
        this.impacted = true;
        this.blade.visible = false;
        this.streak.visible = false;
        this.coil.visible = true;
        for (const s of this.shards) s.mesh.visible = true;
        for (let i = 0; i < this.dropMax; i++) {
          this.spawnDrop(this.to.x, this.to.y, 5.5, 1.2);
        }
        this.onImpact?.();
      }
    }

    if (this.impacted) {
      const e = Math.min((this.age - this.impactAt) / AFTER_DUR, 1);

      this.coil.scale.setScalar(1.55 - e * 1.1);
      this.coil.rotation.z += dt * 7;
      this.coil.material.opacity =
        e < 0.12 ? 1 : Math.max(0, 1 - (e - 0.12) / 0.88);

      for (const s of this.shards) {
        const d = s.speed * e * (1 - e * 0.55);
        s.mesh.position.set(
          this.to.x + Math.cos(s.angle) * d,
          this.to.y + Math.sin(s.angle) * d - e * e * 2.4,
          0.05,
        );
        s.mesh.rotation.z = s.angle + s.spin * e;
        s.mesh.material.opacity = Math.max(0, 1 - e / 0.45);
      }
    }

    for (let i = this.dropP.length - 1; i >= 0; i--) {
      const p = this.dropP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.dropP.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 - 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.writeDrops();

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.blade, this.streak, this.coil, this.drops];
    for (const s of this.shards) objs.push(s.mesh);
    for (const o of objs) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createWaterShurikenGL(scale = 1) {
  return async (opts) => {
    const { userEl, targetEl } = opts;
    if (!targetEl) return;

    const st = ensureStage();
    if (!st) {
      const { createWaterBoltAnimation } = await import("./waterAnimation.js");
      await createWaterBoltAnimation(scale)(opts);
      return;
    }
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

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("water-hit");
      setTimeout(() => targetEl.classList.remove("water-hit"), 320);
    };

    const effect = new WaterShurikenGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
