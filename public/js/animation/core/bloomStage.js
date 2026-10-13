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

  const onResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener("resize", onResize);

  const built = {
    renderer, composer, bloomPass, scene, camera, onResize,
    effects: [], raf: 0, lost: false,
  };
  renderer.domElement.addEventListener("webglcontextlost", () => {
    built.lost = true;
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    built.lost = false;
  });
  return built;
}

// Same rule as glStage: an idle stage whose context was lost and never came
// back is dropped so the next punch builds a fresh one.
function discardStage() {
  window.removeEventListener("resize", stage.onResize);
  try {
    stage.composer.dispose();
    stage.renderer.dispose();
  } catch {
    // A lost context can refuse cleanup calls; the canvas goes either way.
  }
  stage.renderer.domElement.remove();
  stage = null;
  stagePromise = null;
}

// The loop holds its own stage, so a later rebuild never strands its effects.
function startLoop(own) {
  if (own.raf) return;
  own.renderer.domElement.style.display = "";
  let last = performance.now();

  const frame = (now) => {
    const dt = takeEffectStep(now, last);
    last = now;

    for (let i = own.effects.length - 1; i >= 0; i--) {
      const entry = own.effects[i];
      if (!entry.effect.update(dt)) {
        entry.effect.dispose(own.scene);
        own.effects.splice(i, 1);
        entry.resolve();
      }
    }

    if (own.effects.length === 0) {
      own.raf = 0;
      own.renderer.domElement.style.display = "none";
      return;
    }

    // The strongest live punch sets the glow for the frame.
    own.bloomPass.strength = Math.max(
      ...own.effects.map((entry) => entry.bloomStrength),
    );
    // The composer's render-target setup is not guarded against a lost
    // context the way renderer.render() is; the effects still advance.
    if (!own.lost) own.composer.render();
    own.raf = requestAnimationFrame(frame);
  };
  own.raf = requestAnimationFrame(frame);
}

/**
 * Adds one effect to the shared bloom scene and resolves once its update()
 * returns false. `buildEffect({ scene, camera })` must return an object with
 * update(dt) and dispose(scene).
 */
export async function runBloomEffect(buildEffect, bloomStrength) {
  if (stage?.lost && stage.effects.length === 0) discardStage();
  stagePromise ??= buildStage();
  const own = await stagePromise;
  if (!own) return;
  stage = own;

  const effect = buildEffect({ scene: own.scene, camera: own.camera });
  await new Promise((resolve) => {
    own.effects.push({ effect, bloomStrength, resolve });
    startLoop(own);
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
