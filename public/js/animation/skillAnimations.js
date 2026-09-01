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

import { createEarthBoltGL } from "./earthBoltGLAnimation.js";
import { createFireBoltGL } from "./fireBoltGLAnimation.js";
import { createIceBoltGL } from "./iceBoltGLAnimation.js";
import { createMusketBallGL } from "./musketBallGLAnimation.js";
import { playFlamingArrow } from "./flamingArrowAnimation.js";
import { playLightningBolt } from "./lightningAnimation.js";
import { playMeleePunch } from "./meleePunchAnimation.js";
import { playMultislash } from "./multislashAnimation.js";
import { playSlash } from "./slashAnimation.js";
import { createWaterBoltGL } from "./waterBoltGLAnimation.js";

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
};

// Non-ultimate skills that still deserve the big blast, per element.
const BIG_FIREBALL_SKILLS = new Set(["magma_bomb"]);
const BIG_WATERBOLT_SKILLS = new Set();
const BIG_ICEBOLT_SKILLS = new Set();
const BIG_EARTHBOLT_SKILLS = new Set();

// `hit` is the individual DamageEvent's own element/contact, which override the
// skill's: one skill can throw hits of different elements, or a ranged sub-hit.
function resolveDefaultAnimationKey(skill, hit) {
  if (!skill || typeof skill !== "object") return null;

  // Authorial motif, from the hit when it names one. It wins over the element
  // fallback and applies to melee too, since a cut is usually contact-based.
  const motif = hit?.hitVfx ?? skill.hitVfx;
  if (motif) return `default_${motif}`;

  const contact = hit?.contact ?? skill.contact;
  const element = hit?.element ?? skill.element;

  if (contact !== false) return null;

  // No damage gate here: this only runs from the DamageEvent handler.
  const key = DEFAULT_ELEMENT_ANIMATIONS[element] || null;
  if (
    key === "default_fire" &&
    (skill.isUltimate === true || BIG_FIREBALL_SKILLS.has(skill.key))
  ) {
    return "default_fire_big";
  }
  if (
    key === "default_water" &&
    (skill.isUltimate === true || BIG_WATERBOLT_SKILLS.has(skill.key))
  ) {
    return "default_water_big";
  }
  if (
    key === "default_ice" &&
    (skill.isUltimate === true || BIG_ICEBOLT_SKILLS.has(skill.key))
  ) {
    return "default_ice_big";
  }
  if (
    key === "default_earth" &&
    (skill.isUltimate === true || BIG_EARTHBOLT_SKILLS.has(skill.key))
  ) {
    return "default_earth_big";
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

registerSkillAnimation("quick_hook", playMeleePunch);
registerSkillAnimation("blazing_fist_barrage", playMeleePunch);
registerSkillAnimation("default_lightning", playLightningBolt);
registerSkillAnimation("default_fire", createFireBoltGL(1));
registerSkillAnimation("default_fire_big", createFireBoltGL(1.368, true));
registerSkillAnimation("default_water", createWaterBoltGL(1));
registerSkillAnimation("default_water_big", createWaterBoltGL(1.4, true));
registerSkillAnimation("default_ice", createIceBoltGL(1));
registerSkillAnimation("default_ice_big", createIceBoltGL(1.4, true));
registerSkillAnimation("default_earth", createEarthBoltGL(1));
registerSkillAnimation("default_earth_big", createEarthBoltGL(1.4, true));
registerSkillAnimation("default_musket_ball", createMusketBallGL(1));
registerSkillAnimation("default_slash", playSlash);
registerSkillAnimation("default_multislash", playMultislash);
registerSkillAnimation("default_flaming_arrow", playFlamingArrow);
