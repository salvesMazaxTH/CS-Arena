// Shared bloom stage for the fire_punch motifs (meleePunchAnimation): one
// persistent renderer + EffectComposer with an UnrealBloomPass, one scene and
// one rAF loop, so every punch of a wave lands in the same frame. The canvas
// is opaque black (bloom needs it) and relies on #webgl-container's
// mix-blend-mode: screen; two such canvases would hide each other, which is
// why there is only one, and it is hidden while nothing is live.

import { getElementCenter } from "./animationUtils.js";
import { takeEffectStep } from "./effectQuality.js";
import { screenToWorld } from "./glStage.js";

let stage = null;
let stagePromise = null;

async function buildStage() {
  const container = document.getElementById("webgl-container");
  if (!container || typeof THREE === "undefined") return null;

  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }] =
    await Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
    ]);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    return null;
  }
  if (!renderer || !renderer.getContext()) return null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.z = 15;
  camera.updateMatrixWorld();

  renderer.setClearColor(0x000000, 1);
  // Touch devices render the full-screen bloom at 1x: at their native 3x
  // it costs several times the fill-rate and drags every frame.
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  renderer.setPixelRatio(coarse ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.top = "0";
  renderer.domElement.style.left = "0";
  renderer.domElement.style.display = "none";
  container.appendChild(renderer.domElement);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    2.5,
    0.5,
    0.1,
  );
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloomPass);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, composer, bloomPass, scene, camera, effects: [], raf: 0 };
}

function startLoop() {
  if (stage.raf) return;
  stage.renderer.domElement.style.display = "";
  let last = performance.now();

  const frame = (now) => {
    const dt = takeEffectStep(now, last);
    last = now;

    for (let i = stage.effects.length - 1; i >= 0; i--) {
      const entry = stage.effects[i];
      if (!entry.effect.update(dt)) {
        entry.effect.dispose(stage.scene);
        stage.effects.splice(i, 1);
        entry.resolve();
      }
    }

    if (stage.effects.length === 0) {
      stage.raf = 0;
      stage.renderer.domElement.style.display = "none";
      return;
    }

    // The strongest live punch sets the glow for the frame.
    stage.bloomPass.strength = Math.max(
      ...stage.effects.map((entry) => entry.bloomStrength),
    );
    stage.composer.render();
    stage.raf = requestAnimationFrame(frame);
  };
  stage.raf = requestAnimationFrame(frame);
}

/**
 * Adds one effect to the shared bloom scene and resolves once its update()
 * returns false. `buildEffect({ scene, camera })` must return an object with
 * update(dt) and dispose(scene).
 */
export async function runBloomEffect(buildEffect, bloomStrength) {
  stagePromise ??= buildStage();
  stage = await stagePromise;
  if (!stage) return;

  const effect = buildEffect({ scene: stage.scene, camera: stage.camera });
  await new Promise((resolve) => {
    stage.effects.push({ effect, bloomStrength, resolve });
    startLoop();
  });
}

/** World positions of the fist's start and landing spot on the stage. */
export function punchEnds(camera, userEl, targetEl) {
  const targetCenter = getElementCenter(targetEl);
  const worldTarget = screenToWorld(targetCenter.x, targetCenter.y, camera);
  if (!userEl) {
    return [new THREE.Vector3(worldTarget.x - 5, worldTarget.y, 0), worldTarget];
  }
  const userCenter = getElementCenter(userEl);
  return [screenToWorld(userCenter.x, userCenter.y, camera), worldTarget];
}
