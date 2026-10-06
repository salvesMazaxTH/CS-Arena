// Fiery punch, the shared fire_punch motif family: a swipe flies to the target,
// leaves a fist print and smoke. Three.js + bloom in the shared #webgl-container.
// An ultimate throws a bigger hit. The motif picks the PUNCH_WEIGHTS entry
// (fire_punch, quick_fire_punch, heavy_fire_punch); colours come from
// PUNCH_PALETTES, picked per hit with `hitVfxPalette` (default: fire).

import { punchEnds, runBloomEffect } from "../core/bloomStage.js";

// RGB triples fed straight to the shaders; values above 1 drive the bloom.
export const PUNCH_PALETTES = Object.freeze({
  // A fist wrapped in flame: orange swipe, white-hot print, embers turning to smoke.
  fire: Object.freeze({
    swipe: [5.0, 2.0, 0.0],
    core: [3.0, 2.4, 0.6],
    edge: [1.5, 0.15, 0.0],
    hot: [1.0, 0.3, 0.0],
  }),
  // A bare steel-white blow with only a thin ember rim and a few orange sparks.
  steel: Object.freeze({
    swipe: [2.6, 2.8, 3.2],
    core: [2.2, 2.3, 2.5],
    edge: [1.2, 0.4, 0.05],
    hot: [0.9, 0.35, 0.05],
  }),
  // Deeper dragon-ember tones: a darker red swipe and a redder print.
  ember: Object.freeze({
    swipe: [4.6, 1.0, 0.18],
    core: [3.0, 1.8, 0.54],
    edge: [1.05, 0.075, 0.0],
    hot: [0.9, 0.16, 0.02],
  }),
});

// Fast, light jabs share one shape; a heavy blow lands late with a short, broad
// swipe that barely stretches and a larger print.
const LIGHT_SHAPE = Object.freeze({
  swipeSize: [5, 1.55],
  swipeStretch: 2.0,
  swipeWiden: 2.0,
  swipeFlow: 20.0,
  printSize: 3.1,
  particles: 20,
  particleSpeed: [1, 2],
  particleSize: [9, 12],
});

// `travel` (seconds) is the swipe reaching the target, `fade` the print and
// smoke clearing after it; the rest is the swipe and impact shape. Sizes and
// speeds are [min, random range].
export const PUNCH_WEIGHTS = Object.freeze({
  standard: Object.freeze({ ...LIGHT_SHAPE, travel: 0.16, fade: 0.6 }),
  quick: Object.freeze({ ...LIGHT_SHAPE, travel: 0.07, fade: 0.3 }),
  heavy: Object.freeze({
    travel: 0.28,
    fade: 0.66,
    swipeSize: [3.4, 2.05],
    swipeStretch: 0.85,
    swipeWiden: 0.8,
    swipeFlow: 11.0,
    printSize: 3.5,
    particles: 18,
    particleSpeed: [0.8, 1.5],
    particleSize: [11, 13],
  }),
});

function resolvePalette(key) {
  return PUNCH_PALETTES[key] ?? PUNCH_PALETTES.fire;
}

const vec3Uniform = (rgb) => ({ value: new THREE.Vector3(...rgb) });

const snoiseGLSL = `
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                             + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
                             dot(x12.zw,x12.zw)), 0.0);
    m = m*m; m = m*m;
    vec3 x_ = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

const basicVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const swipeFragmentShader = `
  ${snoiseGLSL}
  varying vec2 vUv;
  uniform float uProgress;
  uniform float uFlow;
  uniform float uWiden;
  uniform vec3 uSwipeColor;

  void main() {
    float noise = snoise(vec2(vUv.x * 10.0, vUv.y * 3.0 - uProgress * uFlow));
    float mask = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.3, vUv.x);
    float width = smoothstep(0.5, 0.0, abs(vUv.y - 0.5) * (1.0 + uProgress * uWiden));

    float fire = mask * width * (noise * 0.5 + 0.5);
    float alpha = fire * (1.0 - uProgress);

    vec3 color = uSwipeColor;
    gl_FragColor = vec4(color, alpha);
  }
`;

const fistPrintFragmentShader = `
  ${snoiseGLSL}
  varying vec2 vUv;
  uniform float uAge;
  uniform sampler2D uTexture;
  uniform vec3 uCoreColor;
  uniform vec3 uEdgeColor;

  void main() {
    vec2 uv = vUv;

    float burnNoise = snoise(uv * 15.0 - uAge) * 0.02;
    uv += burnNoise;

    vec4 texColor = texture2D(uTexture, uv);
    float shape = texColor.a;
    float heatFade = max(0.0, 1.0 - (uAge / 0.95));
    float glow = shape * 0.5;

    vec3 finalColor = mix(uEdgeColor, uCoreColor, shape);

    float alpha = (shape + glow) * heatFade;
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

const smokeVertexShader = `
  uniform float uTime;
  attribute float aSize;
  attribute vec3 aVelocity;

  void main() {
    vec3 pos = position + aVelocity * uTime;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.0 - uTime / 1.1) * (50.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const smokeFragmentShader = `
  uniform float uTime;
  uniform vec3 uHotColor;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.2, dist);
    vec3 smokeColor = vec3(0.05);

    float mixFactor = smoothstep(0.0, 0.25, uTime);
    vec3 finalColor = mix(uHotColor, smokeColor, mixFactor);

    float globalAlpha = alpha * (1.0 - (uTime / 0.95));
    gl_FragColor = vec4(finalColor, globalAlpha * 0.8);
  }
`;

const textureLoader = new THREE.TextureLoader();
const punchTexture = textureLoader.load("/assets/punch_silouete.png");

class MeleePunchEffect {
  constructor(scene, userPos, targetPos, big, palette, weight, fit = 1) {
    this.scene = scene;
    this.age = 0;
    this.big = big;

    this.userPos = userPos.clone();
    this.targetPos = targetPos.clone();
    const dx = targetPos.x - userPos.x;
    const dy = targetPos.y - userPos.y;
    this.direction = new THREE.Vector3(dx, dy, 0).normalize();
    const angle = Math.atan2(dy, dx);

    const sizeScale = (big ? 1.5 : 1) * fit;
    this.weight = weight;
    this.travelDur = weight.travel;
    this.postDur = weight.fade;
    this.lifetime = this.travelDur + this.postDur;
    this.fadeScale = 0.95 / this.postDur;

    // --- Phase 1: Swipe trail (travels from user → target) ---
    const [swipeW, swipeH] = weight.swipeSize;
    const swipeGeo = new THREE.PlaneGeometry(swipeW * sizeScale, swipeH * sizeScale);
    this.swipeMat = new THREE.ShaderMaterial({
      vertexShader: basicVertexShader,
      fragmentShader: swipeFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uProgress: { value: 0 },
        uFlow: { value: weight.swipeFlow },
        uWiden: { value: weight.swipeWiden },
        uSwipeColor: vec3Uniform(palette.swipe),
      },
    });
    this.swipe = new THREE.Mesh(swipeGeo, this.swipeMat);
    this.swipe.rotation.z = angle;
    // Starts at user position
    this.swipe.position.set(userPos.x, userPos.y, 0);
    scene.add(this.swipe);

    // --- Phase 2: Fist print (impact mark at target) ---
    const printSize = weight.printSize * sizeScale;
    const printGeo = new THREE.PlaneGeometry(printSize, printSize);
    this.printMat = new THREE.ShaderMaterial({
      vertexShader: basicVertexShader,
      fragmentShader: fistPrintFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uAge: { value: 0 },
        uTexture: { value: punchTexture },
        uCoreColor: vec3Uniform(palette.core),
        uEdgeColor: vec3Uniform(palette.edge),
      },
    });
    this.fistPrint = new THREE.Mesh(printGeo, this.printMat);
    // Keep the punch silhouette upright as authored in the PNG.
    this.fistPrint.rotation.z = 0;
    this.fistPrint.position.set(targetPos.x, targetPos.y, 0);
    this.fistPrint.visible = false;
    scene.add(this.fistPrint);

    // --- Phase 3: Smoke particles (at target) ---
    const particleCount = big ? weight.particles * 2 - 2 : weight.particles;
    const [speedMin, speedRange] = weight.particleSpeed;
    const [sizeMin, sizeRange] = weight.particleSize;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(particleCount * 3);
    const pVel = new Float32Array(particleCount * 3);
    const pSize = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // All particles originate at target position
      pPos[i * 3] = targetPos.x;
      pPos[i * 3 + 1] = targetPos.y;
      pPos[i * 3 + 2] = 0;

      // Smoke pushed in direction of punch + radial expansion
      const theta = Math.random() * Math.PI * 2;
      const speed =
        (Math.random() * speedRange + speedMin) * (big ? 1.8 : 1) * fit;
      pVel[i * 3] = (Math.cos(theta) * 0.5 + this.direction.x) * speed;
      pVel[i * 3 + 1] = (Math.sin(theta) * 0.5 + this.direction.y) * speed;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * speed;

      pSize[i] = (Math.random() * sizeRange + sizeMin) * sizeScale;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aVelocity", new THREE.BufferAttribute(pVel, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));

    this.smokeMat = new THREE.ShaderMaterial({
      vertexShader: smokeVertexShader,
      fragmentShader: smokeFragmentShader,
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uHotColor: vec3Uniform(palette.hot),
      },
    });
    this.particles = new THREE.Points(pGeo, this.smokeMat);
    this.particles.visible = false;
    scene.add(this.particles);
  }

  update(dt) {
    this.age += dt;

    if (this.age <= this.travelDur) {
      const t = this.age / this.travelDur;
      this.swipeMat.uniforms.uProgress.value = t;
      this.swipe.position.x =
        this.userPos.x + (this.targetPos.x - this.userPos.x) * t;
      this.swipe.position.y =
        this.userPos.y + (this.targetPos.y - this.userPos.y) * t;
      this.swipe.scale.x = 1.0 + t * this.weight.swipeStretch;
    } else {
      this.swipe.visible = false;

      // Shader fades run on a ~0.95s clock; rescale so they finish in postDur.
      const shaderAge = (this.age - this.travelDur) * this.fadeScale;
      this.fistPrint.visible = true;
      this.printMat.uniforms.uAge.value = shaderAge;
      this.particles.visible = true;
      this.smokeMat.uniforms.uTime.value = shaderAge;
    }

    return this.age < this.lifetime;
  }

  dispose(scene) {
    scene.remove(this.swipe);
    scene.remove(this.fistPrint);
    scene.remove(this.particles);
    this.swipeMat.dispose();
    this.printMat.dispose();
    this.smokeMat.dispose();
    this.swipe.geometry.dispose();
    this.fistPrint.geometry.dispose();
    this.particles.geometry.dispose();
  }
}

// Portrait height, in world units, the punch sizes were tuned against. The
// stage always shows the same world height, so on a phone, where a portrait
// covers far fewer of those units, the punch shrinks to match it.
const PUNCH_REFERENCE_PORTRAIT = 1.8;

function punchFit(camera, targetEl) {
  const worldHeight =
    2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const portrait =
    (targetEl.getBoundingClientRect().height / window.innerHeight) *
    worldHeight;
  return Math.min(1, Math.max(0.35, portrait / PUNCH_REFERENCE_PORTRAIT));
}

/** A punch player of the given PUNCH_WEIGHTS entry. */
export function createMeleePunch(weight = PUNCH_WEIGHTS.standard) {
  return (opts) => playMeleePunch({ ...opts, weight });
}

export async function playMeleePunch({
  targetEl,
  userEl,
  skill,
  hit,
  weight = PUNCH_WEIGHTS.standard,
}) {
  if (!targetEl) return;

  const big = skill?.isUltimate === true;
  const palette = resolvePalette(hit?.hitVfxPalette ?? skill?.hitVfxPalette);

  // Every punch of a wave joins the same bloom scene, so each target gets
  // its own print.
  await runBloomEffect(({ scene, camera }) => {
    const [worldUser, worldTarget] = punchEnds(camera, userEl, targetEl);
    return new MeleePunchEffect(
      scene,
      worldUser,
      worldTarget,
      big,
      palette,
      weight,
      punchFit(camera, targetEl),
    );
  }, big ? 3.2 : 2.5);
}
