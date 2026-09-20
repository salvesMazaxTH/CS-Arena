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

import { createAirBoltGL } from "./airBoltGLAnimation.js";
import { createArcaneBoltGL } from "./arcaneBoltGLAnimation.js";
import { createChargedRoundGL } from "./chargedRoundGLAnimation.js";
import { createCryoRoundGL } from "./cryoRoundGLAnimation.js";
import { createEarthBoltGL } from "./earthBoltGLAnimation.js";
import { createFireBoltGL } from "./fireBoltGLAnimation.js";
import { createIceBoltGL } from "./iceBoltGLAnimation.js";
import { createMusketBallGL } from "./musketBallGLAnimation.js";
import { createRadiantBeamGL } from "./radiantBeamGLAnimation.js";
import { createRadiantBoltGL } from "./radiantBoltGLAnimation.js";
import { playFlamingArrow } from "./flamingArrowAnimation.js";
import { playPoisonedArrow } from "./poisonedArrowAnimation.js";
import { createLightningBolt } from "./lightningAnimation.js";
import { playChainLash } from "./chainLashAnimation.js";
import { playLash } from "./lashAnimation.js";
import { playMeleePunch } from "./meleePunchAnimation.js";
import { playRonanPunch } from "./ronanPunchAnimation.js";
import { CLAW_PALETTES, createClaw } from "./clawAnimation.js";
import { playMultislash } from "./multislashAnimation.js";
import { playParry, playRiposte } from "./parryAnimation.js";
import { playSlash } from "./slashAnimation.js";
import { createWaterBoltGL } from "./waterBoltGLAnimation.js";
import { createLiquidSteelLanceGL } from "./liquidSteelLanceGLAnimation.js";
import { createRootsGL } from "./rootsGLAnimation.js";
import { createWaterShurikenGL } from "./waterShurikenGLAnimation.js";
import { playContactLunge } from "./contactLungeAnimation.js";

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
const BIG_FIREBALL_SKILLS = new Set(["magma_bomb"]);
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
registerSkillAnimation("default_ice", createIceBoltGL(1));
registerSkillAnimation("default_ice_big", createIceBoltGL(1.4, true));
registerSkillAnimation("default_earth", createEarthBoltGL(1));
registerSkillAnimation("default_earth_big", createEarthBoltGL(1.4, true));
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
registerSkillAnimation("default_flaming_arrow", playFlamingArrow);
registerSkillAnimation("default_poisoned_arrow", playPoisonedArrow);
