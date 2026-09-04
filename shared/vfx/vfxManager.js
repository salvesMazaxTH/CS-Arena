/**
 * PADRÃO DE TRIGGERS DE VFX
 *
 * Existem dois grupos de triggers para efeitos visuais (VFX):
 *
 * 1. StatusEffectVFX: lista de status effects genéricos que ativam VFX automaticamente.
 *    Basta adicionar o nome do status effect na lista para ativar o VFX correspondente.
 *    Exemplo: "frozen".
 *
 * 2. ExclusiveVFXTriggers: triggers exclusivos para efeitos que NÃO são status effects genéricos,
 *    mas sim estados runtime, marcas especiais ou efeitos únicos de personagem/habilidade.
 *    Exemplo: shield, fireStanceIdle, waterBubble, etc.
 *
 * Para adicionar um novo VFX de status effect:
 *   - Adicione o nome do status effect em StatusEffectVFX.
 *   - Implemente a função playVFX correspondente.
 *
 * Para adicionar um novo VFX exclusivo:
 *   - Adicione um trigger em ExclusiveVFXTriggers seguindo o critério acima.
 *
 * syncChampionVFX cuida de ativar/desativar ambos os grupos automaticamente.
 */
import { startShield } from "./shieldCanvas.js";
import { startFireStance } from "./fireStanceCanvas.js";
import { startFrozenCanvas } from "./frozenCanvas.js";
import { startWaterBubble } from "./waterBubbleCanvas.js";
import { startDeathsEmbraceMark } from "./deathsEmbraceMarkCanvas.js";
import { startDeathsInevitability } from "./deathsInevitabilityCanvas.js";
import { startInvisibilityCanvas } from "./invisibilityCanvas.js";
import { startConcealedCanvas } from "./concealedCanvas.js";
import { startCrimsonFrenzy } from "./crimsonFrenzyCanvas.js";
import { startSunbleached } from "./sunbleachedCanvas.js";

// no futuro:
// import { startBurn } from "./burnCanvas.js";
// import { startFreeze } from "./freezeCanvas.js";

// Triggers automáticos para status effects genéricos (nome do status effect === nome do VFX)
const StatusEffectVFX = [
  "frozen",
  "invisible",
  "concealed",
  // Adicione outros status effects que tenham VFX próprios aqui
];

// Status effects that also phase the portrait via a body class.
const PORTRAIT_PHASE_VFX = new Set(["invisible", "concealed"]);

// Triggers exclusivos/habilidades:
// Use esta estrutura para efeitos visuais que NÃO são status effects genéricos,
// mas sim estados runtime, marcas especiais, ou efeitos únicos de personagem/habilidade.
// Critério: se não for status effect padronizado, coloque aqui.
const ExclusiveVFXTriggers = {
  shield: (champion) =>
    Array.isArray(champion.runtime?.shields) &&
    champion.runtime.shields.length > 0,

  fireStanceIdle: (champion) => champion.runtime?.fireStance === "emberStance",

  fireStanceActive: (champion) => champion.runtime?.fireStance === "livingEmber",

  waterBubble: (champion) => champion.runtime?.form === "aquatic_form",

  deathsEmbraceMark: (champion) => champion.runtime?.markedByDeathsEmbrace,

  deathsInevitabilityMark: (champion) =>
    champion.runtime?.markedByDeathsInevitability,

  crimsonFrenzy: (champion) => champion.runtime?.drexBloodAscension,

  sunbleached: (champion) =>
    (champion.runtime?.hookEffectData ?? []).some(
      (e) => e.key === "sunbleached",
    ),
  // Adicione outros triggers exclusivos seguindo o critério acima
};

const activeEffects = new WeakMap();

function getShieldVFXData(champion) {
  const shields = Array.isArray(champion.runtime?.shields)
    ? champion.runtime.shields
    : [];

  if (!shields.length) {
    return {
      variant: "regular",
      stateKey: false,
    };
  }

  // Shield com visual explícito tem prioridade.
  const customShield = [...shields]
    .reverse()
    .find((shield) => shield?.visualVariant);

  let variant;

  if (customShield?.visualVariant) {
    variant = customShield.visualVariant;
  } else if (shields.some((shield) => shield?.type === "supreme")) {
    variant = "supreme";
  } else if (shields.some((shield) => shield?.type === "spell")) {
    variant = "spell";
  } else {
    variant = "regular";
  }

  return {
    variant,
    // força recriação do VFX quando a variant mudar
    stateKey: `shield:${variant}`,
  };
}

export function syncChampionVFX(champion) {
  if (!champion?.el) return;
  if (!champion.el.isConnected) return;

  champion._vfxState ??= {};
  champion._vfxCanvases ??= {};

  // 1. Automatizar triggers de status effects
  for (const type of StatusEffectVFX) {
    const shouldExist = champion.statusEffects?.has(type);
    const exists = champion._vfxState[type];

    if (PORTRAIT_PHASE_VFX.has(type)) {
      champion.el.classList.toggle(`is-${type}`, !!shouldExist);
    }

    if (shouldExist && !exists) {
      const canvas = createVFXCanvas(type, champion);
      champion._vfxCanvases[type] = canvas;
      playVFX(type, canvas);
    }

    if (!shouldExist && exists) {
      removeVFXCanvas(champion, type);
    }

    champion._vfxState[type] = shouldExist;
  }

  // 2. Triggers exclusivos/habilidades
  for (const [type, trigger] of Object.entries(ExclusiveVFXTriggers)) {
    const shouldExist = trigger(champion);
    const vfxData = type === "shield" ? getShieldVFXData(champion) : null;
    const nextState = type === "shield" ? vfxData.stateKey : shouldExist;
    const exists = champion._vfxState[type] === nextState;
    const hadCanvas = !!champion._vfxCanvases?.[type];

    if (shouldExist && !exists) {
      if (hadCanvas) {
        removeVFXCanvas(champion, type);
      }

      const canvas = createVFXCanvas(type, champion);
      champion._vfxCanvases[type] = canvas;
      playVFX(type, canvas, vfxData || {});
    }

    if (!shouldExist && hadCanvas) {
      removeVFXCanvas(champion, type);
    }

    champion._vfxState[type] = nextState;
  }
}

// The counterpart to syncChampionVFX, for a champion leaving the field: its
// canvases go with the DOM, but their render loops only stop when told to.
export function stopChampionVFX(champion) {
  for (const type of Object.keys(champion?._vfxCanvases ?? {})) {
    removeVFXCanvas(champion, type);
  }

  champion._vfxState = {};
}

export function createVFXCanvas(type, champion) {
  const container = champion.el.querySelector(".portrait-wrapper");
  if (!container) return null;

  const canvas = document.createElement("canvas");

  // 🔒 GARANTIA ABSOLUTA DE CLASSES
  canvas.classList.add(
    "vfx-canvas", // ← obrigatória
    "vfx-layer", // ← camada base
    `vfx-${type}`, // ← específica
  );

  canvas.style.zIndex = "10";

  container.appendChild(canvas);

  if (type === "waterBubble") {
    const imgEl = container.querySelector(".portrait img");
    if (imgEl) imgEl.style.visibility = "hidden";
  }

  return canvas;
}

export function playVFX(type, canvas, data = {}) {
  if (!canvas) return;

  stopVFX(canvas);

  let controller;

  switch (type) {
    case "shield":
      controller = startShield(canvas, data);
      break;

    case "frozen":
      controller = startFrozenCanvas(canvas, data);
      break;

    case "invisible":
      controller = startInvisibilityCanvas(canvas, data);
      break;

    case "concealed":
      controller = startConcealedCanvas(canvas, data);
      break;

    // case "burn":
    //   controller = startBurn(canvas, data);
    //   break;

    case "fireStanceIdle":
    case "fireStanceActive":
      console.log("Starting fire stance VFX with type:", type);
      controller = startFireStance(canvas, { mode: type });
      break;

    case "waterBubble":
      controller = startWaterBubble(canvas, data);
      break;

    case "deathsEmbraceMark":
      controller = startDeathsEmbraceMark(canvas, data);
      break;

    case "deathsInevitabilityMark":
      controller = startDeathsInevitability(canvas, data);
      break;

    case "crimsonFrenzy":
      controller = startCrimsonFrenzy(canvas, data);
      break;

    case "sunbleached":
      controller = startSunbleached(canvas, data);
      break;

    default:
      return;
  }

  activeEffects.set(canvas, controller);
}

function removeVFXCanvas(champion, key) {
  const canvas = champion._vfxCanvases?.[key];
  if (!canvas) return;

  if (key === "waterBubble") {
    const imgEl = champion.el?.querySelector(".portrait img");
    if (imgEl) imgEl.style.visibility = "";
  }

  if (PORTRAIT_PHASE_VFX.has(key)) {
    champion.el?.classList.remove(`is-${key}`);
  }

  stopVFX(canvas);
  canvas.remove();

  delete champion._vfxCanvases[key];
}

export function stopVFX(canvas) {
  const controller = activeEffects.get(canvas);
  if (controller && controller.stop) {
    controller.stop();
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  activeEffects.delete(canvas);
}
