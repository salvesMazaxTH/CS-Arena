// Fiery punch: Kai's quick_hook and blazing_fist_barrage (thrown at the air, so
// its swipe flies the whole way), plus the shared fire_punch motif. Three.js +
// bloom in the shared #webgl-container. The ultimate throws a bigger hit; speed
// is its own choice, from PUNCH_TIMINGS. Colours come from PUNCH_PALETTES, picked
// per hit with `hitVfxPalette` (default: fire); a palette only swaps uniforms.

import { getElementCenter } from "../core/animationUtils.js";

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
});

// Seconds: `travel` is the swipe reaching the target, `fade` the print and smoke
// clearing after it.
export const PUNCH_TIMINGS = Object.freeze({
  standard: Object.freeze({ travel: 0.16, fade: 0.6 }),
  quick: Object.freeze({ travel: 0.07, fade: 0.3 }),
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
  uniform vec3 uSwipeColor;

  void main() {
    float noise = snoise(vec2(vUv.x * 10.0, vUv.y * 3.0 - uProgress * 20.0));
    float mask = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.3, vUv.x);
    float width = smoothstep(0.5, 0.0, abs(vUv.y - 0.5) * (1.0 + uProgress * 2.0));

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

function screenToWorld(screenX, screenY, camera) {
  const ndcX = (screenX / window.innerWidth) * 2 - 1;
  const ndcY = -(screenY / window.innerHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

  const worldPos = new THREE.Vector3();
  raycaster.ray.intersectPlane(
    new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
    worldPos,
  );
  return worldPos;
}

class MeleePunchEffect {
  constructor(scene, userPos, targetPos, big, palette, timing) {
    this.scene = scene;
    this.age = 0;
    this.big = big;

    this.userPos = userPos.clone();
    this.targetPos = targetPos.clone();
    const dx = targetPos.x - userPos.x;
    const dy = targetPos.y - userPos.y;
    this.direction = new THREE.Vector3(dx, dy, 0).normalize();
    const angle = Math.atan2(dy, dx);

    const sizeScale = big ? 1.5 : 1;
    this.travelDur = timing.travel;
    this.postDur = timing.fade;
    this.lifetime = this.travelDur + this.postDur;
    this.fadeScale = 0.95 / this.postDur;

    // --- Phase 1: Swipe trail (travels from user → target) ---
    const swipeGeo = new THREE.PlaneGeometry(5 * sizeScale, 1.55 * sizeScale);
    this.swipeMat = new THREE.ShaderMaterial({
      vertexShader: basicVertexShader,
      fragmentShader: swipeFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uProgress: { value: 0 },
        uSwipeColor: vec3Uniform(palette.swipe),
      },
    });
    this.swipe = new THREE.Mesh(swipeGeo, this.swipeMat);
    this.swipe.rotation.z = angle;
    // Starts at user position
    this.swipe.position.set(userPos.x, userPos.y, 0);
    scene.add(this.swipe);

    // --- Phase 2: Fist print (impact mark at target) ---
    const printGeo = new THREE.PlaneGeometry(3.1 * sizeScale, 3.1 * sizeScale);
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
    const particleCount = big ? 38 : 20;
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
      const speed = (Math.random() * 2 + 1) * (big ? 1.8 : 1);
      pVel[i * 3] = (Math.cos(theta) * 0.5 + this.direction.x) * speed;
      pVel[i * 3 + 1] = (Math.sin(theta) * 0.5 + this.direction.y) * speed;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * speed;

      pSize[i] = (Math.random() * 12 + 9) * sizeScale;
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
      this.swipe.scale.x = 1.0 + t * 2.0;
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

/** A punch player at the given PUNCH_TIMINGS speed. */
export function createMeleePunch(timing = PUNCH_TIMINGS.standard) {
  return (opts) => playMeleePunch({ ...opts, timing });
}

export async function playMeleePunch({
  targetEl,
  userEl,
  skill,
  hit,
  timing = PUNCH_TIMINGS.standard,
}) {
  const container = document.getElementById("webgl-container");
  if (!container || !targetEl) return;

  const big = skill?.isUltimate === true;
  const palette = resolvePalette(hit?.hitVfxPalette ?? skill?.hitVfxPalette);

  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] =
    await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
    ]);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  camera.position.z = 15;
  camera.updateMatrixWorld();

  const targetCenter = getElementCenter(targetEl);
  const worldTarget = screenToWorld(targetCenter.x, targetCenter.y, camera);

  let worldUser;
  if (userEl) {
    const userCenter = getElementCenter(userEl);
    worldUser = screenToWorld(userCenter.x, userCenter.y, camera);
  } else {
    worldUser = new THREE.Vector3(worldTarget.x - 5, worldTarget.y, 0);
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.left = "0";
  container.appendChild(renderer.domElement);

  const renderScene = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    big ? 3.2 : 2.5,
    0.5,
    0.1,
  );

  const composer = new EffectComposer(renderer);
  composer.addPass(renderScene);
  composer.addPass(bloomPass);

  const effect = new MeleePunchEffect(
    scene,
    worldUser,
    worldTarget,
    big,
    palette,
    timing,
  );

  const clock = new THREE.Clock();

  await new Promise((resolve) => {
    function animate() {
      const dt = clock.getDelta();

      if (!effect.update(dt)) {
        effect.dispose(scene);
        composer.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        resolve();
        return;
      }

      composer.render();
      requestAnimationFrame(animate);
    }

    animate();
  });
}
