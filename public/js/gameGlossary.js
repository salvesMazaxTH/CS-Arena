export const GAME_GLOSSARY = {
  absolute: {
    title: "Absolute Damage",
    description:
      "Ignores Defense, shields, and reductions. Cannot crit or be modified.",
  },
  stunned: {
    title: "Stunned",
    description: "The champion is temporarily unable to act.",
  },
  conductor: {
    title: "Conductor",
    description: "Amplifies lightning abilities.",
  },
  frozen: {
    title: "Frozen",
    description:
      "The champion is temporarily unable to act. Speed and Attack are set to zero.",
  },
  rooted: {
    title: "Rooted",
    description:
      "The champion is rooted in place, unable to act with abilities that require contact.",
  },
  poisoned: {
    title: "Poisoned",
    description:
      "At the start of the turn, deals magic damage over time equal to 4% of maximum HP per stack and removes 1 stack. When the last stack is consumed, the effect expires. New applications only add stacks to the same active status. Damage over time never triggers reactive effects.",
  },
  healBlock: {
    title: "Heal Block",
    description:
      "The champion cannot recover HP by any means, lifesteal included.",
  },
  spell_shield: {
    title: "Spell Shield",
    description:
      "The champion receives a shield that absorbs the next magic damage.",
  },
  chilled: {
    title: "Chilled",
    description: "The champion's speed and attack are reduced.",
  },
  absolute_immunity: {
    title: "Absolute Immunity",
    description:
      "The champion is immune to all types of negative effects (including damage).",
  },
  inert: {
    title: "Inert",
    description: "The champion is unable to act (usually self-provoked).",
  },
  invisible: {
    title: "Invisible",
    description:
      "The champion cannot be directly targeted by enemies, only affected indirectly and by area effects.",
  },
  obliterate: {
    title: "Obliterate",
    aliases: [
      "obliterado",
      "obliterados",
      "obliterada",
      "obliteradas",
      "obliteração",
    ],
    description:
      "The champion is instantly defeated upon dropping below a certain amount of HP and/or meeting some other condition.",
  },
  paralyzed: {
    title: "Paralyzed",
    description:
      "The champion's SPD is set to zero and has a 40% chance of not acting.",
  },
  piercing: {
    title: "Piercing",
    description:
      "Ignores a percentage of Defense, but can still crit and be affected by bonuses or reductions.",
  },
  burning: {
    title: "Burning",
    description:
      "At the start of the turn, deals magic damage over time equal to 15 plus 4% of maximum HP. Damage over time never triggers reactive effects.",
  },
  bleeding: {
    title: "Bleeding",
    description:
      "At the start of the turn, deals physical damage over time equal to 4% of maximum HP per stack and removes 1 stack. When the last stack is consumed, the effect expires. New applications only add stacks to the same active status. Damage over time never triggers reactive effects.",
  },
};
