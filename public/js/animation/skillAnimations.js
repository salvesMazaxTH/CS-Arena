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

import { createFireBoltGL } from "./fireBoltGLAnimation.js";
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
};

// Non-ultimate skills that still deserve the big blast, per element.
const BIG_FIREBALL_SKILLS = new Set(["magma_bomb"]);
const BIG_WATERBOLT_SKILLS = new Set();

function resolveDefaultAnimationKey(skill) {
  if (!skill || typeof skill !== "object") return null;

  // Authorial motif declared on the skill itself. It wins over the element
  // fallback and applies to melee too, since a cut is usually contact-based.
  if (skill.hitVfx) return `default_${skill.hitVfx}`;

  if (skill.contact !== false) return null;

  // Restrict to damaging skills only.
  // In this codebase, offensive skills consistently define damageMode.
  if (typeof skill.damageMode !== "string" || !skill.damageMode) return null;

  const key = DEFAULT_ELEMENT_ANIMATIONS[skill.element] || null;
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
    const defaultKey = resolveDefaultAnimationKey(opts.skill);
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
registerSkillAnimation("default_slash", playSlash);
registerSkillAnimation("default_multislash", playMultislash);
registerSkillAnimation("default_flaming_arrow", playFlamingArrow);
