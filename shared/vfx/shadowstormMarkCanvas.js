// "Shadowstorm" mark (Kyle Hayato's passive): a storm ring circling the target,
// spitting arcs at whoever climbed high enough to be worth robbing.
export function startShadowstormMark(canvas) {
  const ctx = canvas.getContext("2d");

  let running = true;
  let time = 0;

  function resize() {
    const box = canvas.parentElement;
    if (!box) return;
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
  }
  resize();
  window.addEventListener("resize", resize);

  // Arcs are rebuilt on a slow cadence instead of every frame: the flicker is
  // what sells the storm, and recomputing 60x a second buys nothing.
  const ARC_LIFETIME = 9;
  let arcs = [];
  let arcFrame = 0;

  function rebuildArcs(cx, cy, radius) {
    const count = 2 + Math.floor(Math.random() * 2);
    arcs = Array.from({ length: count }, () => {
      const start = Math.random() * Math.PI * 2;
      const sweep = 0.5 + Math.random() * 1.1;
      const segments = 5 + Math.floor(Math.random() * 3);
      const points = [];

      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const angle = start + sweep * t;
        const jitter = (Math.random() - 0.5) * radius * 0.16;
        const r = radius + jitter;
        points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
      }

      return { points, width: 1.1 + Math.random() * 1.3 };
    });
  }

  function drawArcs() {
    ctx.save();
    ctx.lineCap = "round";
    ctx.shadowColor = "#8f7bff";
    ctx.shadowBlur = 8;

    for (const arc of arcs) {
      ctx.beginPath();
      ctx.moveTo(arc.points[0][0], arc.points[0][1]);
      for (let i = 1; i < arc.points.length; i += 1) {
        ctx.lineTo(arc.points[i][0], arc.points[i][1]);
      }
      ctx.globalAlpha = 0.55 + 0.35 * Math.random();
      ctx.strokeStyle = "#d8ccff";
      ctx.lineWidth = arc.width;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawRing(cx, cy, radius) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 0.06);

    ctx.save();
    ctx.globalAlpha = 0.3;
    const grad = ctx.createRadialGradient(
      cx,
      cy,
      radius * 0.55,
      cx,
      cy,
      radius * 1.15,
    );
    grad.addColorStop(0, "rgba(30, 12, 60, 0)");
    grad.addColorStop(0.7, "rgba(80, 50, 170, 0.4)");
    grad.addColorStop(1, "rgba(18, 8, 40, 0)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.globalAlpha = 0.42 * pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#6f5bd0";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([radius * 0.22, radius * 0.16]);
    ctx.lineDashOffset = -time * 0.9;
    ctx.stroke();
    ctx.restore();
  }

  class Spark {
    constructor() {
      this.reset(true);
    }
    reset(init = false) {
      this.angle = Math.random() * Math.PI * 2;
      this.dist = init ? Math.random() : 0.55 + Math.random() * 0.45;
      this.speed = 0.004 + Math.random() * 0.006;
      this.size = 1 + Math.random() * 1.6;
      this.alpha = 0.35 + Math.random() * 0.4;
    }
    update() {
      this.dist -= this.speed;
      this.angle += 0.01;
      if (this.dist <= 0.12) this.reset();
    }
    draw(cx, cy, radius) {
      const x = cx + Math.cos(this.angle) * radius * this.dist;
      const y = cy + Math.sin(this.angle) * radius * this.dist;
      ctx.save();
      ctx.globalAlpha = this.alpha * (0.5 + 0.5 * Math.sin(time * 0.08));
      ctx.beginPath();
      ctx.arc(x, y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = "#c9b8ff";
      ctx.shadowColor = "#7a5cff";
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.restore();
    }
  }

  const sparks = Array.from({ length: 10 }, () => new Spark());

  function render() {
    if (!running) return;
    resize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(canvas.width, canvas.height) * 0.36;

    drawRing(cx, cy, radius);

    if (arcFrame <= 0) {
      rebuildArcs(cx, cy, radius);
      arcFrame = ARC_LIFETIME;
    }
    arcFrame -= 1;
    drawArcs();

    sparks.forEach((s) => {
      s.update();
      s.draw(cx, cy, radius);
    });

    time += 1;
    requestAnimationFrame(render);
  }

  render();

  return {
    stop() {
      running = false;
      window.removeEventListener("resize", resize);
    },
  };
}
