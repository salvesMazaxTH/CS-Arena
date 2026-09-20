// Boreal edge hit: a crescent of northern wind sharpens at the caster, sweeps
// across the target and leaves rime and drifting snow behind the cut.

import { getElementCenter } from "../core/animationUtils.js";
import { getParticleScale } from "../core/effectQuality.js";
import { ensureStage, startLoop, screenToWorld } from "../core/glStage.js";

const GATHER_DUR = 0.17;
const SWEEP_DUR = 0.15;
const AFTER_DUR = 0.55;

const EDGE_TINT = 0xcdeeff;
const RIME_TINT = 0xa6ddf6;
const SNOW_TINT = 0xf2fcff;

function canvasTex(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function crescentPath(ctx, cx, thickness) {
  const R = 150;
  const span = 0.8;
  const steps = 26;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps;
    const a = t * span;
    ctx.lineTo(cx + Math.cos(a) * R, 128 + Math.sin(a) * R);
  }
  for (let i = steps; i >= 0; i--) {
    const t = -1 + (2 * i) / steps;
    const a = t * span;
    const r = R - thickness * (1 - t * t);
    ctx.lineTo(cx + Math.cos(a) * r, 128 + Math.sin(a) * r);
  }
  ctx.closePath();
}

function makeCrescentTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");

  crescentPath(ctx, 74, 30);
  const g = ctx.createLinearGradient(190, 0, 228, 0);
  g.addColorStop(0, "rgba(140,206,240,0.15)");
  g.addColorStop(0.45, "rgba(206,240,255,0.8)");
  g.addColorStop(0.82, "rgba(255,255,255,0.98)");
  g.addColorStop(1, "rgba(220,246,255,0.35)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  for (let i = 0; i <= 26; i++) {
    const a = (-1 + (2 * i) / 26) * 0.8;
    ctx.lineTo(74 + Math.cos(a) * 150, 128 + Math.sin(a) * 150);
  }
  ctx.stroke();

  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  for (let k = 0; k < 5; k++) {
    const a = (-0.6 + k * 0.3) * 1;
    ctx.beginPath();
    ctx.moveTo(74 + Math.cos(a) * 148, 128 + Math.sin(a) * 148);
    ctx.lineTo(74 + Math.cos(a) * 124, 128 + Math.sin(a) * 124);
    ctx.stroke();
  }

  return canvasTex(c);
}

function makeStreakTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, "rgba(190,232,255,0)");
  g.addColorStop(0.6, "rgba(226,248,255,0.65)");
  g.addColorStop(1, "rgba(255,255,255,0.9)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(128, 8);
  ctx.quadraticCurveTo(64, 2, 0, 7);
  ctx.quadraticCurveTo(64, 14, 128, 8);
  ctx.closePath();
  ctx.fill();
  return canvasTex(c);
}

function makeShardTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(16, 1);
  ctx.lineTo(24, 14);
  ctx.lineTo(16, 31);
  ctx.lineTo(8, 14);
  ctx.closePath();
  const g = ctx.createLinearGradient(8, 0, 24, 32);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.5, "rgba(198,236,255,0.7)");
  g.addColorStop(1, "rgba(150,212,245,0.85)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();
  return canvasTex(c);
}

function makeMoteTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "rgba(255,255,255,0.98)");
  g.addColorStop(0.42, "rgba(224,246,255,0.6)");
  g.addColorStop(1, "rgba(190,230,252,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return canvasTex(c);
}

function makeFlashTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(206,240,255,0.5)");
  g.addColorStop(1, "rgba(160,216,248,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

function makeRingTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(206,240,255,0)");
  g.addColorStop(0.58, "rgba(206,240,255,0)");
  g.addColorStop(0.78, "rgba(240,253,255,0.95)");
  g.addColorStop(0.9, "rgba(150,214,244,0.3)");
  g.addColorStop(1, "rgba(150,214,244,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return canvasTex(c);
}

let crescentTex = null;
let streakTex = null;
let shardTex = null;
let moteTex = null;
let flashTex = null;
let ringTex = null;

function bakeTextures() {
  if (!crescentTex) crescentTex = makeCrescentTexture();
  if (!streakTex) streakTex = makeStreakTexture();
  if (!shardTex) shardTex = makeShardTexture();
  if (!moteTex) moteTex = makeMoteTexture();
  if (!flashTex) flashTex = makeFlashTexture();
  if (!ringTex) ringTex = makeRingTexture();
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
    depthWrite: false,
    blending: blending ?? THREE.AdditiveBlending,
    color,
  });
  return new THREE.Points(geo, mat);
}

class BorealEdgeGL {
  constructor(scene, from, to, scale, onImpact) {
    this.scene = scene;
    this.scale = scale;
    this.age = 0;
    this.impacted = false;
    this.onImpact = onImpact;
    this.from = from.clone();
    this.to = to.clone();

    this.impactAt = GATHER_DUR + SWEEP_DUR;
    this.lifetime = this.impactAt + AFTER_DUR;
    this.drift = 0;

    const aim = new THREE.Vector3().subVectors(to, from);
    this.dir = aim.clone().normalize();
    this.angle = Math.atan2(aim.y, aim.x);
    this.perp = new THREE.Vector3(-this.dir.y, this.dir.x, 0);
    this.past = to.clone().addScaledVector(this.dir, 1.4 * scale);

    this.edge = billboard(2.1 * scale, 2.9 * scale, 0, crescentTex, EDGE_TINT);
    this.edge.position.copy(from);
    this.edge.position.z = 0.05;
    this.edge.rotation.z = this.angle;
    scene.add(this.edge);

    this.cut = billboard(2.6 * scale, 3.6 * scale, 0, crescentTex, SNOW_TINT);
    this.cut.position.copy(to);
    this.cut.position.z = 0.09;
    this.cut.rotation.z = this.angle;
    this.cut.visible = false;
    scene.add(this.cut);

    this.flash = billboard(2.4 * scale, 2.4 * scale, 0, flashTex);
    this.flash.position.copy(to);
    this.flash.position.z = 0.08;
    this.flash.visible = false;
    scene.add(this.flash);

    const ps = getParticleScale();

    this.gusts = [];
    const gustCount = Math.max(3, Math.round(8 * ps));
    for (let i = 0; i < gustCount; i++) {
      const m = billboard(
        (1.5 + Math.random() * 1.3) * scale,
        0.17 * scale,
        0,
        streakTex,
        EDGE_TINT,
      );
      m.rotation.z = this.angle;
      m.position.z = 0.04;
      scene.add(m);
      this.gusts.push({
        mesh: m,
        lag: 0.1 + Math.random() * 0.85,
        off: (Math.random() - 0.5) * 2.1 * scale,
      });
    }

    this.shardMax = Math.max(6, Math.round(26 * ps));
    this.shards = particlePoints(
      this.shardMax,
      0.34 * scale,
      RIME_TINT,
      shardTex,
      THREE.NormalBlending,
    );
    this.shards.geometry.setDrawRange(0, 0);
    scene.add(this.shards);
    this.shardP = [];

    this.moteMax = Math.max(10, Math.round(44 * ps));
    this.motes = particlePoints(this.moteMax, 0.26 * scale, SNOW_TINT, moteTex);
    this.motes.geometry.setDrawRange(0, 0);
    scene.add(this.motes);
    this.moteP = [];

    for (let i = 0; i < Math.round(this.moteMax * 0.35); i++) {
      const a = Math.random() * Math.PI * 2;
      const d = (1.1 + Math.random() * 1.3) * scale;
      this.moteP.push({
        x: from.x + Math.cos(a) * d,
        y: from.y + Math.sin(a) * d,
        vx: 0,
        vy: 0,
        pull: 11 + Math.random() * 6,
        fall: 0,
        life: GATHER_DUR * (0.75 + Math.random() * 0.3),
      });
    }
  }

  spray(count) {
    for (let i = 0; i < count; i++) {
      if (this.shardP.length >= this.shardMax) this.shardP.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 7;
      this.shardP.push({
        x: this.to.x,
        y: this.to.y,
        vx: Math.cos(a) * sp + this.dir.x * 3,
        vy: Math.sin(a) * sp * 0.8 + 1.6,
        life: 0.3 + Math.random() * 0.4,
      });
    }
  }

  snow(count) {
    for (let i = 0; i < count; i++) {
      if (this.moteP.length >= this.moteMax) this.moteP.shift();
      this.moteP.push({
        x: this.to.x + (Math.random() - 0.5) * 2.4 * this.scale,
        y: this.to.y + (Math.random() - 0.2) * 2.2 * this.scale,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -0.3 - Math.random() * 0.9,
        pull: 0,
        fall: 0.6 + Math.random() * 0.8,
        life: 0.4 + Math.random() * 0.55,
      });
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

    let head = this.edge.position;

    if (this.age < GATHER_DUR) {
      const t = this.age / GATHER_DUR;
      this.edge.material.opacity = t * t;
      this.edge.scale.set(0.3 + t * 0.45, 0.45 + t * 0.55, 1);
      this.edge.position.set(
        this.from.x + this.dir.x * 0.3 * t * this.scale,
        this.from.y + this.dir.y * 0.3 * t * this.scale,
        0.05,
      );
    } else if (!this.impacted) {
      const t = Math.min((this.age - GATHER_DUR) / SWEEP_DUR, 1);
      const eased = t * t;
      this.edge.material.opacity = 1;
      this.edge.scale.set(0.75 + eased * 0.45, 1 + eased * 0.25, 1);
      this.edge.position.set(
        this.from.x + (this.to.x - this.from.x) * eased,
        this.from.y + (this.to.y - this.from.y) * eased,
        0.05,
      );

      if (t >= 1) {
        this.impacted = true;
        this.flash.visible = true;
        this.cut.visible = true;

        this.ring = billboard(2, 2, 0.9, ringTex, RIME_TINT);
        this.ring.position.set(this.to.x, this.to.y - 0.3 * this.scale, 0.07);
        this.ring.rotation.x = -1.15;
        this.scene.add(this.ring);

        this.spray(this.shardMax);
        this.snow(Math.round(this.moteMax * 0.5));
        this.onImpact?.();
      }
    }

    if (this.impacted) {
      const e = Math.min((this.age - this.impactAt) / AFTER_DUR, 1);

      this.edge.material.opacity = Math.max(0, 1 - e / 0.28);
      this.edge.position.set(
        this.to.x + (this.past.x - this.to.x) * Math.min(e * 2.2, 1),
        this.to.y + (this.past.y - this.to.y) * Math.min(e * 2.2, 1),
        0.05,
      );

      this.cut.material.opacity = Math.max(0, 1 - e / 0.3);
      this.cut.scale.set(1 + e * 1.6, 1 + e * 0.9, 1);
      this.cut.rotation.z = this.angle + e * 0.5;

      this.flash.scale.setScalar(0.6 + e * 2.1);
      this.flash.material.opacity = Math.max(0, 1 - e / 0.18);

      if (this.ring) {
        const re = Math.min(e * 1.3, 1);
        this.ring.scale.setScalar((0.6 + re * 4) * this.scale);
        this.ring.material.opacity = Math.max(0, 0.9 * (1 - re) * (1 - re));
      }

      this.drift -= dt;
      if (this.drift <= 0 && e < 0.6) {
        this.drift = 0.06;
        this.snow(Math.max(1, Math.round(2 * getParticleScale())));
      }

      head = this.edge.position;
    }

    for (const g of this.gusts) {
      const back = g.lag * 2.2 * this.scale;
      g.mesh.position.set(
        head.x - this.dir.x * back + this.perp.x * g.off,
        head.y - this.dir.y * back + this.perp.y * g.off,
        0.04,
      );
      const vis = this.age < GATHER_DUR ? this.age / GATHER_DUR : 1;
      const fade = this.impacted
        ? Math.max(0, 1 - (this.age - this.impactAt) / 0.22)
        : 1;
      g.mesh.material.opacity = vis * fade * (1 - g.lag * 0.55);
    }

    for (let i = this.shardP.length - 1; i >= 0; i--) {
      const p = this.shardP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.shardP.splice(i, 1);
        continue;
      }
      p.vx *= 0.9;
      p.vy = p.vy * 0.9 - 13 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.moteP.length - 1; i >= 0; i--) {
      const p = this.moteP[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.moteP.splice(i, 1);
        continue;
      }
      if (p.pull > 0) {
        p.vx += (this.from.x - p.x) * p.pull * dt;
        p.vy += (this.from.y - p.y) * p.pull * dt;
      } else {
        p.vx = p.vx * 0.94 + Math.sin(this.age * 5 + p.fall * 9) * 0.5 * dt;
        p.vy = p.vy * 0.94 - p.fall * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    this.write(this.shards, this.shardP);
    this.write(this.motes, this.moteP);

    const tail = Math.min(1, Math.max(0, (this.lifetime - this.age) / 0.25));
    this.shards.material.opacity = tail;
    this.motes.material.opacity = tail;

    return this.age < this.lifetime;
  }

  dispose(scene) {
    const objs = [this.edge, this.cut, this.flash, this.shards, this.motes];
    if (this.ring) objs.push(this.ring);
    for (const g of this.gusts) objs.push(g.mesh);
    for (const o of objs) {
      scene.remove(o);
      o.geometry.dispose();
      o.material.dispose();
    }
  }
}

export function createBorealEdgeGL(scale = 1) {
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

    let hit = false;
    const onImpact = () => {
      if (hit) return;
      hit = true;
      targetEl.classList.add("ice-hit");
      setTimeout(() => targetEl.classList.remove("ice-hit"), 320);
    };

    const effect = new BorealEdgeGL(st.scene, from, to, scale, onImpact);
    await new Promise((resolve) => {
      st.effects.push({ effect, resolve });
      startLoop();
    });
  };
}
