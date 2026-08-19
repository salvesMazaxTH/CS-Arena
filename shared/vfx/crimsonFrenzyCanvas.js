// Efeito "Crimson Frenzy" (Drex — Bloodthirst awakened)
// Ativado permanentemente assim que Drex atinge o estado stackado da passiva.
//
// Leitura visual: NÃO é uma cúpula/anel fechado (isso é o escudo de sangue).
// Aqui a fúria é feita de lâminas curvas de sangue orbitando o campeão,
// pulsando no ritmo de um batimento cardíaco, com brasas carmesim subindo
// e estocadas rápidas cortando o ar.

const CORE = "255, 58, 58";
const DEEP = "150, 6, 22";
const HOT = "255, 150, 120";

export function startCrimsonFrenzy(canvas, data = {}) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let t = 0; // segundos
  let last = performance.now();

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  // ───────── BATIMENTO CARDÍACO ─────────
  // Duas batidas ("tum-tum") por ciclo, depois silêncio. É o que dá a
  // sensação de sede de sangue em vez de um pulso senoidal genérico.
  const BEAT_PERIOD = 1.15;
  function heartbeat() {
    const p = (t % BEAT_PERIOD) / BEAT_PERIOD;
    const thump = (center, width) => {
      const d = (p - center) / width;
      return Math.exp(-d * d);
    };
    return thump(0.05, 0.055) + 0.62 * thump(0.19, 0.07);
  }

  // ───────── LÂMINAS ORBITAIS ─────────
  // Cada lâmina é um arco com espessura e alpha que afinam nas pontas,
  // desenhado em segmentos — dá o formato de foice/garra em vez de anel.
  const blades = [
    { radius: 0.46, span: 1.05, speed: 1.15, tilt: 0.0, width: 7, phase: 0 },
    { radius: 0.6, span: 0.8, speed: -0.78, tilt: 0.5, width: 5.5, phase: 2.1 },
    { radius: 0.72, span: 0.55, speed: 0.52, tilt: -0.4, width: 4, phase: 4.3 },
  ];

  function drawBlade(cx, cy, size, blade, intensity) {
    const r = size * blade.radius;
    const start = blade.phase + t * blade.speed;
    const SEG = 26;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(blade.tilt);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.shadowColor = `rgba(${CORE}, 0.9)`;

    for (let i = 0; i < SEG; i++) {
      const u0 = i / SEG;
      const u1 = (i + 1) / SEG;
      // taper: fino na cauda, encorpado no meio, agulha na ponta
      const taper = Math.pow(Math.sin(Math.PI * u0), 0.75) * Math.pow(u0, 0.35);
      const a0 = start + blade.span * (u0 - 0.5);
      const a1 = start + blade.span * (u1 - 0.5);
      // leve ondulação orgânica no raio
      const rr = r * (1 + Math.sin(u0 * 5 + t * 2.2 + blade.phase) * 0.035);

      ctx.beginPath();
      ctx.arc(0, 0, rr, a0, a1);
      ctx.lineWidth = blade.width * taper * (0.85 + intensity * 0.5);
      ctx.shadowBlur = 12 * taper;
      ctx.strokeStyle = `rgba(${u0 > 0.72 ? HOT : CORE}, ${
        (0.1 + 0.55 * taper) * (0.6 + intensity * 0.6)
      })`;
      ctx.stroke();
    }

    // gota de luz na ponta da lâmina
    const tip = start + blade.span * 0.5;
    const tx = Math.cos(tip) * r;
    const ty = Math.sin(tip) * r;
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, blade.width * 2.4);
    g.addColorStop(0, `rgba(255, 225, 215, ${0.5 + intensity * 0.45})`);
    g.addColorStop(0.4, `rgba(${CORE}, 0.5)`);
    g.addColorStop(1, `rgba(${DEEP}, 0)`);
    ctx.beginPath();
    ctx.arc(tx, ty, blade.width * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.restore();
  }

  // ───────── NÚCLEO ─────────
  // Brilho interno quente, achatado (elipse) para não virar "bolha de escudo".
  function drawCore(cx, cy, size, intensity) {
    const r = size * (0.34 + intensity * 0.09);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx, cy);
    ctx.scale(1, 1.18);
    const g = ctx.createRadialGradient(0, 0, r * 0.05, 0, 0, r);
    g.addColorStop(0, `rgba(255, 120, 110, ${0.18 + intensity * 0.22})`);
    g.addColorStop(0.45, `rgba(${CORE}, ${0.1 + intensity * 0.14})`);
    g.addColorStop(1, `rgba(${DEEP}, 0)`);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  // ───────── ESTOCADAS ─────────
  // Riscos rápidos que aparecem no pico do batimento e somem em ~0.25s.
  const slashes = [];
  function spawnSlash(cx, cy, size) {
    const ang = Math.random() * Math.PI * 2;
    const dist = size * (0.2 + Math.random() * 0.45);
    slashes.push({
      x: cx + Math.cos(ang) * dist,
      y: cy + Math.sin(ang) * dist,
      angle: ang + Math.PI / 2 + (Math.random() - 0.5) * 0.8,
      len: size * (0.18 + Math.random() * 0.22),
      life: 1,
    });
  }

  function drawSlashes(dt) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (let i = slashes.length - 1; i >= 0; i--) {
      const s = slashes[i];
      s.life -= dt * 4;
      if (s.life <= 0) {
        slashes.splice(i, 1);
        continue;
      }
      const grow = 1 - Math.pow(1 - s.life, 2);
      const half = (s.len * (0.4 + 0.6 * (1 - s.life))) / 2;
      const dx = Math.cos(s.angle) * half;
      const dy = Math.sin(s.angle) * half;
      ctx.beginPath();
      ctx.moveTo(s.x - dx, s.y - dy);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.lineWidth = 2.2 * grow;
      ctx.strokeStyle = `rgba(255, 200, 190, ${0.55 * s.life})`;
      ctx.shadowColor = `rgba(${CORE}, 0.9)`;
      ctx.shadowBlur = 10;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ───────── BRASAS ─────────
  // Poucas, pequenas e rápidas: sugerem calor, não chuva de gotas.
  class Ember {
    constructor(init) {
      this.reset(init);
    }
    reset(init = false) {
      this.x = Math.random() * canvas.width;
      this.y = init
        ? Math.random() * canvas.height
        : canvas.height * (0.75 + Math.random() * 0.35);
      this.r = 0.8 + Math.random() * 1.7;
      this.vx = (Math.random() - 0.5) * 12;
      this.vy = -(18 + Math.random() * 34);
      this.life = 0.6 + Math.random() * 0.8;
      this.age = 0;
      this.sway = Math.random() * Math.PI * 2;
    }
    update(dt, intensity) {
      this.age += dt;
      this.x += (this.vx + Math.sin(this.sway + t * 3) * 9) * dt;
      this.y += this.vy * (1 + intensity * 0.35) * dt;
      if (this.age > this.life || this.y < -6) this.reset();
    }
    draw() {
      const k = Math.max(0, 1 - this.age / this.life);
      ctx.globalAlpha = k * 0.85;
      const g = ctx.createRadialGradient(
        this.x,
        this.y,
        0,
        this.x,
        this.y,
        this.r * 3,
      );
      g.addColorStop(0, `rgba(${HOT}, 0.95)`);
      g.addColorStop(0.35, `rgba(${CORE}, 0.55)`);
      g.addColorStop(1, `rgba(${DEEP}, 0)`);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  const embers = Array.from({ length: 18 }, () => new Ember(true));

  let lastBeatSlot = -1;

  function render(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    t += dt;

    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const size = Math.min(canvas.width, canvas.height) * 0.62;
    const intensity = Math.min(1, heartbeat());

    drawCore(cx, cy, size, intensity);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const e of embers) {
      e.update(dt, intensity);
      e.draw();
    }
    ctx.restore();

    for (const b of blades) drawBlade(cx, cy, size, b, intensity);

    // dispara estocadas uma vez por batida principal
    const slot = Math.floor(t / BEAT_PERIOD);
    if (intensity > 0.75 && slot !== lastBeatSlot) {
      lastBeatSlot = slot;
      const n = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) spawnSlash(cx, cy, size);
    }
    drawSlashes(dt);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
    },
  };
}
