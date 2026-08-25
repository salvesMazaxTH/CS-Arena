// shared/data/statusEffects/effectsRegistry.js

import paralyzed from "./paralyzed.js";
import stunned from "./stunned.js";
import rooted from "./rooted.js";
import inert from "./inert.js";
import chilled from "./chilled.js";
import frozen from "./frozen.js";
import burning from "./burning.js";
import bleeding from "./bleeding.js";
import poisoned from "./poisoned.js";
import absoluteImmunity from "./absoluteImmunity.js";
import conductor from "./conductor.js";
import invisible from "./invisible.js";

export const StatusEffectsRegistry = {
  paralyzed,
  stunned,
  rooted,
  inert,
  chilled,
  frozen,
  burning,
  bleeding,
  absoluteImmunity,
  conductor,
  invisible,
  poisoned,
};

export const EvolvedStatusByBase = Object.fromEntries(
  Object.values(StatusEffectsRegistry)
    .filter((definition) => definition.evolvesFrom)
    .map((definition) => [definition.evolvesFrom, definition.key]),
);
