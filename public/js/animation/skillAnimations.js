// ============================================================
//  Skill Animation System
//
//  Pure registry: it maps skill keys to animation factories and
//  resolves the generic per-element fallbacks. Every animation
//  itself lives in its own module under this folder.
//
//  To add a new animation: write its module, export a play
//  function, then register it at the bottom of this file.
// ============================================================

import { createAirBoltGL } from "./effects/airBoltGLAnimation.js";
import { createArcaneBoltGL } from "./effects/arcaneBoltGLAnimation.js";
import { createChargedRoundGL } from "./effects/chargedRoundGLAnimation.js";
import { createCryoRoundGL } from "./effects/cryoRoundGLAnimation.js";
import { createEarthBoltGL } from "./effects/earthBoltGLAnimation.js";
import { createFireBoltGL } from "./effects/fireBoltGLAnimation.js";
import { createIceBoltGL } from "./effects/iceBoltGLAnimation.js";
import { createMusketBallGL } from "./effects/musketBallGLAnimation.js";
import { createRadiantBeamGL } from "./effects/radiantBeamGLAnimation.js";
import { createRadiantBoltGL } from "./effects/radiantBoltGLAnimation.js";
import { playFlamingArrow } from "./effects/flamingArrowAnimation.js";
import { playPoisonedArrow } from "./effects/poisonedArrowAnimation.js";
import { createLightningBolt } from "./effects/lightningAnimation.js";
import { playChainLash } from "./effects/chainLashAnimation.js";
import { playRibbonLash } from "./effects/ribbonLashAnimation.js";
import { playVineLash } from "./effects/vineLashAnimation.js";
import { playEmberFlick } from "./effects/emberFlickAnimation.js";
import { playLash } from "./effects/lashAnimation.js";
import { playMeleePunch } from "./effects/meleePunchAnimation.js";
import { playRonanPunch } from "./effects/ronanPunchAnimation.js";
import { CLAW_PALETTES, createClaw } from "./effects/clawAnimation.js";
import { playMultislash } from "./effects/multislashAnimation.js";
import { playParry, playRiposte } from "./effects/parryAnimation.js";
import { playSlash } from "./effects/slashAnimation.js";
import { createWaterBoltGL } from "./effects/waterBoltGLAnimation.js";
import { createBorealEdgeGL } from "./effects/borealEdgeGLAnimation.js";
import { BOON_PALETTES, createBoonGL } from "./effects/boonGLAnimation.js";
import { playCrushingGrip } from "./effects/crushingGripAnimation.js";
import { createGroundedChargeGL } from "./effects/groundedChargeGLAnimation.js";
import { createEarthSlamGL } from "./effects/earthSlamGLAnimation.js";
import { createLiquidSteelLanceGL } from "./effects/liquidSteelLanceGLAnimation.js";
import { createMagmaBombGL } from "./effects/magmaBombGLAnimation.js";
import { createRootsGL } from "./effects/rootsGLAnimation.js";
import { createWaterShurikenGL } from "./effects/waterShurikenGLAnimation.js";
import { createTidalLanceGL } from "./effects/tidalLanceGLAnimation.js";
import { createUndertowGL } from "./effects/undertowGLAnimation.js";
import { playContactLunge } from "./effects/contactLungeAnimation.js";

const skillAnimationRegistry = new Map();

/**
 * Register a skill animation factory.
 * @param {string} skillKey
 * @param {Function} factory - async ({ targetEl, userEl }) => void
 */
export function registerSkillAnimation(skillKey, factory) {
  skillAnimationRegistry.set(skillKey, factory);
}

// Generic fallbacks played by any ranged damaging skill of that element.
const DEFAULT_ELEMENT_ANIMATIONS = {
  lightning: "default_lightning",
  fire: "default_fire",
  water: "default_water",
  ice: "default_ice",
  earth: "default_earth",
  air: "default_air",
};

// Non-ultimate skills that still deserve the big blast, per element.
const BIG_FIREBALL_SKILLS = new Set();
const BIG_WATERBOLT_SKILLS = new Set();
const BIG_ICEBOLT_SKILLS = new Set();
const BIG_LIGHTNING_SKILLS = new Set();
const BIG_EARTHBOLT_SKILLS = new Set();
const BIG_AIRBOLT_SKILLS = new Set();

// `hit` is the individual DamageEvent's own element/contact, which override the
// skill's: one skill can throw hits of different elements, or a ranged sub-hit.
function resolveDefaultAnimationKey(skill, hit) {
  // A passive's hit carries its own visual data, yet the passive is never a
  // member of champion.skills, so `skill` is legitimately absent here.
  const motif = hit?.hitVfx ?? skill?.hitVfx;
  if (motif) return `default_${motif}`;

  // Authorial motifs and contact win over the element fallback below.
  if ((hit?.contact ?? skill?.contact) === true) return "default_contact";

  // Basic Shot is one shared skill whose `type` each champion overrides, so the
  // magical version is told apart here rather than by a motif on every kit.
  if (skill?.key === "basic_shot" && skill.type === "magical") {
    return "default_arcane_bolt";
  }

  const element = hit?.element ?? skill?.element;

  // No damage gate here: this only runs from the DamageEvent handler.
  const key = DEFAULT_ELEMENT_ANIMATIONS[element] || null;
  if (
    key === "default_fire" &&
    (skill?.isUltimate === true || BIG_FIREBALL_SKILLS.has(skill?.key))
  ) {
    return "default_fire_big";
  }
  if (
    key === "default_water" &&
    (skill?.isUltimate === true || BIG_WATERBOLT_SKILLS.has(skill?.key))
  ) {
    return "default_water_big";
  }
  if (
    key === "default_ice" &&
    (skill?.isUltimate === true || BIG_ICEBOLT_SKILLS.has(skill?.key))
  ) {
    return "default_ice_big";
  }
  if (
    key === "default_earth" &&
    (skill?.isUltimate === true || BIG_EARTHBOLT_SKILLS.has(skill?.key))
  ) {
    return "default_earth_big";
  }
  if (
    key === "default_air" &&
    (skill?.isUltimate === true || BIG_AIRBOLT_SKILLS.has(skill?.key))
  ) {
    return "default_air_big";
  }
  if (
    key === "default_lightning" &&
    (skill?.isUltimate === true || BIG_LIGHTNING_SKILLS.has(skill?.key))
  ) {
    return "default_lightning_big";
  }
  return key;
}

/**
 * Play a skill animation if one is registered.
 * Returns immediately if no animation exists for the given skill.
 * @param {string} skillKey
 * @param {{ targetEl?: Element, userEl?: Element, skill?: object }} opts
 * @returns {Promise<void>}
 */
export async function animateSkill(skillKey, opts = {}) {
  let factory = skillAnimationRegistry.get(skillKey);

  if (!factory) {
    const defaultKey = resolveDefaultAnimationKey(opts.skill, opts.hit);
    if (defaultKey) factory = skillAnimationRegistry.get(defaultKey);
  }

  if (!factory) return;
  await factory(opts);
}

registerSkillAnimation("default_contact", playContactLunge);
registerSkillAnimation("default_arcane_bolt", createArcaneBoltGL(1));
registerSkillAnimation("default_arcane_bolt_big", createArcaneBoltGL(1.4));
registerSkillAnimation("quick_hook", playMeleePunch);
registerSkillAnimation("blazing_fist_barrage", playMeleePunch);
registerSkillAnimation("solar_fist", playMeleePunch);
registerSkillAnimation("knuckle_flare", playRonanPunch);
registerSkillAnimation("say_that_again", playRonanPunch);
registerSkillAnimation("ignisars_temper", createClaw(CLAW_PALETTES.dragon));
registerSkillAnimation("default_lightning", createLightningBolt());
registerSkillAnimation("default_lightning_big", createLightningBolt(true));
registerSkillAnimation("default_fire", createFireBoltGL(1));
registerSkillAnimation("default_fire_big", createFireBoltGL(1.368, true));
registerSkillAnimation("default_water", createWaterBoltGL(1));
registerSkillAnimation("default_water_big", createWaterBoltGL(1.4, true));
registerSkillAnimation("default_water_shuriken", createWaterShurikenGL(1));
registerSkillAnimation("default_roots", createRootsGL(1));
registerSkillAnimation("default_liquid_steel_lance", createLiquidSteelLanceGL(1));
registerSkillAnimation("default_grounded_charge", createGroundedChargeGL(1));
registerSkillAnimation("default_tidal_lance", createTidalLanceGL(1));
registerSkillAnimation("default_undertow", createUndertowGL(1.25));
registerSkillAnimation("default_magma_bomb", createMagmaBombGL(1.15));
registerSkillAnimation("default_boreal_edge", createBorealEdgeGL(1));
registerSkillAnimation("default_boon", createBoonGL(BOON_PALETTES.boon));
registerSkillAnimation("default_mending", createBoonGL(BOON_PALETTES.mending));
registerSkillAnimation("default_ice", createIceBoltGL(1));
registerSkillAnimation("default_ice_big", createIceBoltGL(1.4, true));
registerSkillAnimation("default_earth", createEarthBoltGL(1));
registerSkillAnimation("default_earth_big", createEarthBoltGL(1.4, true));
registerSkillAnimation("default_earth_slam", createEarthSlamGL(1));
registerSkillAnimation("default_earth_slam_big", createEarthSlamGL(1.35, true));
registerSkillAnimation("default_air", createAirBoltGL(1));
registerSkillAnimation("default_air_big", createAirBoltGL(1.4, true));
registerSkillAnimation("default_musket_ball", createMusketBallGL(1));
registerSkillAnimation("default_charged_round", createChargedRoundGL(1));
registerSkillAnimation("default_charged_round_big", createChargedRoundGL(1.4));
registerSkillAnimation("default_cryo_round", createCryoRoundGL(1));
registerSkillAnimation("default_cryo_round_big", createCryoRoundGL(1.45, true));
registerSkillAnimation("default_radiant_bolt", createRadiantBoltGL(1));
registerSkillAnimation("default_radiant_beam", createRadiantBeamGL(1));
registerSkillAnimation("default_slash", playSlash);
registerSkillAnimation("default_multislash", playMultislash);
registerSkillAnimation("default_claw", createClaw());
registerSkillAnimation("default_parry", playParry);
registerSkillAnimation("default_riposte", playRiposte);
registerSkillAnimation("default_lash", playLash);
registerSkillAnimation("default_chain_lash", playChainLash);
registerSkillAnimation("default_ribbon_lash", playRibbonLash);
registerSkillAnimation("default_vine_lash", playVineLash);
registerSkillAnimation("default_ember_flick", playEmberFlick);
registerSkillAnimation("default_flaming_arrow", playFlamingArrow);
registerSkillAnimation("default_poisoned_arrow", playPoisonedArrow);
registerSkillAnimation("crushing_grip", playCrushingGrip);
