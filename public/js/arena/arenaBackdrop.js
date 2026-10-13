import { pickArenaScene } from "./scenes.js";
import { getParticleScale } from "../animation/core/effectQuality.js";

// Procedural arena backdrop: one full-screen shader drawn on its OWN renderer,
// separate from glStage's. Skill VFX must draw above the champion cards and the
// scenery below them, and one canvas can't sit on both sides of the DOM.
// Follows glStage.ensureStage() conventions (guarded context, capped pixel
// ratio, resize handler, dispose). If WebGL is missing the container's CSS
// gradient is all the player sees.

const RENDER = {
  // The scenery is soft and blurry by design; a fraction of the window is plenty.
  resolutionScale: 0.6,
  reducedResolutionScale: 0.4,
  maxPixelRatio: 1,
  frameIntervalMs: 1000 / 30,
  moodDecayPerSecond: 1.6,
};

const VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// No precision line: ShaderMaterial prepends highp when the GPU supports it.
// mediump is fp16 on phones, and the time-driven hash below overflows it
// within two minutes (NaN renders black).
const FRAGMENT_SHADER = `
  varying vec2 vUv;

  uniform float uTime;
  uniform vec2 uAspect;
  uniform float uEmberScale;
  uniform float uPulse;
  uniform float uDark;
  uniform float uSide;

  uniform vec3 uDeep;
  uniform vec3 uMid;
  uniform vec3 uAccent;
  uniform vec3 uGlow;
  uniform vec3 uEmber;

  uniform float uFogDensity;
  uniform float uFogDrift;
  uniform float uShaftStrength;
  uniform float uShaftCount;
  uniform float uRuneRadius;
  uniform float uRuneRotation;
  uniform float uRuneGlow;
  uniform float uEmberDensity;
  uniform float uEmberRise;
  uniform float uVignette;

  // Cell ids grow with time; wrapping them keeps p * 456.21 small enough
  // for fract() to stay accurate. The wrap is a period, so it is seamless.
  float hash(vec2 p) {
    p = mod(p, 289.0);
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + 11.7;
      a *= 0.5;
    }
    return v;
  }

  // Rising embers on a hashed grid: one potential spark per cell.
  float embers(vec2 uv, float time) {
    float total = 0.0;
    for (int layer = 0; layer < 2; layer++) {
      float fl = float(layer);
      float cells = 14.0 + fl * 10.0;
      vec2 p = uv * vec2(cells * uAspect.x, cells);
      p.y -= time * (uEmberRise * cells + fl * 0.35);
      vec2 id = floor(p);
      vec2 f = fract(p) - 0.5;
      float rnd = hash(id + fl * 17.0);
      vec2 offset = vec2(rnd - 0.5, fract(rnd * 7.0) - 0.5) * 0.6;
      offset.x += sin(time * (0.6 + rnd) + rnd * 20.0) * 0.18;
      float d = length(f - offset);
      float size = 0.035 + fract(rnd * 13.0) * 0.03;
      float flicker = 0.55 + 0.45 * sin(time * (2.0 + rnd * 4.0) + rnd * 40.0);
      float on = step(1.0 - uEmberDensity * uEmberScale * 0.32, fract(rnd * 91.7));
      total += on * flicker * smoothstep(size, 0.0, d);
    }
    return total;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * uAspect;

    // Base: deep edges, lighter centre.
    float centre = 1.0 - smoothstep(0.0, 1.05, length(p));
    vec3 col = mix(uDeep, uMid, centre);

    // Soft light shafts falling from the top.
    float shaft = 0.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      if (fi >= uShaftCount) break;
      float x = (fi + 0.5) / uShaftCount - 0.5 + sin(uTime * 0.07 + fi * 2.1) * 0.05;
      float lean = (uv.y - 1.0) * 0.25 * (fi - 1.0);
      float beam = smoothstep(0.16, 0.0, abs(p.x / uAspect.x - x - lean));
      shaft += beam * (0.55 + 0.45 * sin(uTime * 0.3 + fi * 1.7));
    }
    shaft *= smoothstep(0.1, 1.0, uv.y);
    col += uGlow * shaft * uShaftStrength * 0.5;

    // Floor rune circle: a squashed ring system hinting at an arena floor.
    vec2 fp = vec2(p.x, (p.y + 0.02) * 1.7);
    float r = length(fp);
    float ang = atan(fp.y, fp.x) + uTime * uRuneRotation;
    float ring = smoothstep(0.012, 0.0, abs(r - uRuneRadius))
               + 0.6 * smoothstep(0.008, 0.0, abs(r - uRuneRadius * 0.72))
               + 0.35 * smoothstep(0.006, 0.0, abs(r - uRuneRadius * 1.12));
    float ticks = smoothstep(0.55, 0.9, sin(ang * 24.0)) * smoothstep(0.02, 0.0, abs(r - uRuneRadius * 0.86));
    float glyphs = smoothstep(0.7, 0.95, sin(ang * 6.0 + r * 18.0)) * smoothstep(0.05, 0.0, abs(r - uRuneRadius * 0.58)) * 0.7;
    float rune = (ring + ticks + glyphs) * (0.7 + 0.3 * sin(uTime * 0.8));
    col += uAccent * rune * uRuneGlow * 1.1;
    col += uAccent * smoothstep(uRuneRadius * 1.25, 0.0, r) * 0.12;

    // Drifting fog.
    float fog = fbm(vec2(p.x * 1.6 + uTime * uFogDrift, p.y * 2.4 - uTime * uFogDrift * 0.6));
    fog = smoothstep(0.35, 0.85, fog);
    col = mix(col, uMid * 2.2 + uAccent * 0.12, fog * uFogDensity * 0.6);

    // Embers.
    col += uEmber * embers(uv, uTime) * 1.4;

    // Mood: ultimate pulse flashes warm from the active side, dark dims it.
    float sideMask = mix(smoothstep(1.0, 0.0, uv.y), smoothstep(0.0, 1.0, uv.y), step(0.0, uSide));
    col += uGlow * uPulse * (0.18 + 0.32 * sideMask * abs(uSide));
    col *= 1.0 - uDark * 0.55;

    // Vignette.
    float vig = smoothstep(0.35, 1.15, length(p));
    col *= 1.0 - vig * uVignette;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const color = (rgb) => new THREE.Color(rgb[0], rgb[1], rgb[2]);

export function createArenaBackdrop(container) {
  let state = null;
  let failed = false;
  let liveWanted = false;
  let sceneDef = null;
  let mood = { pulse: 0, dark: 0, side: 0 };

  function ensure() {
    if (state) return state;
    if (failed || !container || typeof THREE === "undefined") return null;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    } catch {
      failed = true;
      return null;
    }
    if (!renderer || !renderer.getContext()) {
      failed = true;
      return null;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = {
      uTime: { value: 0 },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uEmberScale: { value: 1 },
      uPulse: { value: 0 },
      uDark: { value: 0 },
      uSide: { value: 0 },
      uDeep: { value: new THREE.Color() },
      uMid: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uEmber: { value: new THREE.Color() },
      uFogDensity: { value: 0 },
      uFogDrift: { value: 0 },
      uShaftStrength: { value: 0 },
      uShaftCount: { value: 0 },
      uRuneRadius: { value: 0 },
      uRuneRotation: { value: 0 },
      uRuneGlow: { value: 0 },
      uEmberDensity: { value: 0 },
      uEmberRise: { value: 0 },
      uVignette: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
    });
    const geometry = new THREE.PlaneGeometry(2, 2);
    scene.add(new THREE.Mesh(geometry, material));

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
    const canvas = renderer.domElement;
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
    container.appendChild(canvas);

    state = { renderer, scene, camera, uniforms, material, geometry, canvas, raf: 0, last: 0, clock: 0, lastDraw: 0, lost: false };
    state.onResize = () => resize();
    window.addEventListener("resize", state.onResize);
    // Phones evict WebGL contexts when several are alive (glStage, bloom, death
    // claim). Without this the canvas stays opaque black over the CSS gradient.
    state.onContextLost = (event) => {
      event.preventDefault(); // lets the browser hand the context back later
      state.lost = true;
      container.classList.remove("arena-backdrop--live");
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    };
    state.onContextRestored = () => {
      state.lost = false;
      if (!liveWanted) return;
      container.classList.add("arena-backdrop--live");
      resume();
    };
    canvas.addEventListener("webglcontextlost", state.onContextLost);
    canvas.addEventListener("webglcontextrestored", state.onContextRestored);
    resize();
    return state;
  }

  function resize() {
    if (!state) return;
    const scale = getParticleScale() < 1 ? RENDER.reducedResolutionScale : RENDER.resolutionScale;
    const w = Math.max(2, Math.round(window.innerWidth * scale));
    const h = Math.max(2, Math.round(window.innerHeight * scale));
    // false: keep the CSS size (100%) and only change the drawing buffer.
    state.renderer.setSize(w, h, false);
    state.uniforms.uAspect.value.set(window.innerWidth / window.innerHeight, 1);
  }

  function applyScene(def) {
    if (!state || !def) return;
    const u = state.uniforms;
    const { palette, uniforms: knobs } = def;
    u.uDeep.value.copy(color(palette.deep));
    u.uMid.value.copy(color(palette.mid));
    u.uAccent.value.copy(color(palette.accent));
    u.uGlow.value.copy(color(palette.glow));
    u.uEmber.value.copy(color(palette.ember));
    u.uFogDensity.value = knobs.fogDensity;
    u.uFogDrift.value = knobs.fogDrift;
    u.uShaftStrength.value = knobs.shaftStrength;
    u.uShaftCount.value = knobs.shaftCount;
    u.uRuneRadius.value = knobs.runeRadius;
    u.uRuneRotation.value = knobs.runeRotation;
    u.uRuneGlow.value = knobs.runeGlow;
    u.uEmberDensity.value = knobs.emberDensity;
    u.uEmberRise.value = knobs.emberRise;
    u.uVignette.value = knobs.vignette;
  }

  function frame(now) {
    if (!state) return;
    state.raf = requestAnimationFrame(frame);
    if (now - state.lastDraw < RENDER.frameIntervalMs) return;
    const dt = Math.min((now - (state.last || now)) / 1000, 0.1);
    state.last = now;
    state.lastDraw = now;
    state.clock += dt;

    const decay = RENDER.moodDecayPerSecond * dt;
    mood.pulse = Math.max(0, mood.pulse - decay);
    mood.dark = Math.max(0, mood.dark - decay * 0.5);

    const u = state.uniforms;
    u.uTime.value = state.clock;
    u.uEmberScale.value = getParticleScale();
    u.uPulse.value = mood.pulse;
    u.uDark.value = mood.dark;
    u.uSide.value = mood.side;
    state.renderer.render(state.scene, state.camera);
  }

  function loopWanted() {
    return !document.hidden && !state?.lost;
  }

  function resume() {
    if (!state || state.raf || !loopWanted()) return;
    state.last = 0;
    state.raf = requestAnimationFrame(frame);
  }

  function onVisibility() {
    if (!state) return;
    if (loopWanted()) {
      resume();
    } else if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
    }
  }

  return {
    /** Starts (or resumes) drawing. `seed` picks the scene deterministically. */
    start(seed) {
      const s = ensure();
      if (!s) return false;
      sceneDef = pickArenaScene(seed);
      applyScene(sceneDef);
      liveWanted = true;
      if (!s.lost) container.classList.add("arena-backdrop--live");
      resize();
      document.removeEventListener("visibilitychange", onVisibility);
      document.addEventListener("visibilitychange", onVisibility);
      resume();
      return true;
    },

    /** Stops drawing; the context stays alive for the next match. */
    stop() {
      liveWanted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      container.classList.remove("arena-backdrop--live");
      if (!state) return;
      if (state.raf) cancelAnimationFrame(state.raf);
      state.raf = 0;
    },

    /** Brief scenery reaction. `side` is -1 (top row) .. +1 (bottom row). */
    react({ pulse = 0, dark = 0, side = 0 } = {}) {
      mood = {
        pulse: Math.max(mood.pulse, pulse),
        dark: Math.max(mood.dark, dark),
        side: side || mood.side,
      };
    },

    get sceneId() {
      return sceneDef?.id ?? null;
    },

    dispose() {
      this.stop();
      if (!state) return;
      window.removeEventListener("resize", state.onResize);
      state.canvas.removeEventListener("webglcontextlost", state.onContextLost);
      state.canvas.removeEventListener("webglcontextrestored", state.onContextRestored);
      state.geometry.dispose();
      state.material.dispose();
      state.renderer.dispose();
      state.canvas.remove();
      state = null;
    },
  };
}
