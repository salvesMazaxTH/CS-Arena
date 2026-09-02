// shared/data/statusEffects/effectsRegistry.js

import paralyzed from "./paralyzed.js";
import stunned from "./stunned.js";
import rooted from "./rooted.js";
import snared from "./snared.js";
import inert from "./inert.js";
import chilled from "./chilled.js";
import frozen from "./frozen.js";
import burning from "./burning.js";
import bleeding from "./bleeding.js";
import poisoned from "./poisoned.js";
import absoluteImmunity from "./absoluteImmunity.js";
import afflictionWard from "./afflictionWard.js";
import conductor from "./conductor.js";
import invisible from "./invisible.js";
import concealed from "./concealed.js";
import healBlock from "./healBlock.js";

export const StatusEffectsRegistry = {
  paralyzed,
  stunned,
  rooted,
  snared,
  inert,
  chilled,
  frozen,
  burning,
  bleeding,
  absoluteImmunity,
  afflictionWard,
  conductor,
  invisible,
  concealed,
  poisoned,
  healBlock,
};

export const EvolvedStatusByBase = Object.fromEntries(
  Object.values(StatusEffectsRegistry)
    .filter((definition) => definition.evolvesFrom)
    .map((definition) => [definition.evolvesFrom, definition.key]),
);
