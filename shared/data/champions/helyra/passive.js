import { formatChampionName } from "../../../ui/formatters.js";

const arcSkill = {
  key: "crossfire_current_arc",
  name: "Crossfire Current",
  element: "lightning",
  contact: false,
};

export default {
  key: "crossfire_current",
  name: "Crossfire Current",

  arcPercent: 25,

  description() {
    return `Helyra has never in her life aimed at one thing. The charge riding her rounds refuses to stop at the body it entered, so every hit she lands jumps from the chosen target to each of the other enemies on the field for ${this.arcPercent}% of the damage it actually dealt, as <b>Absolute Damage</b>.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, attacker, defender, actualDmg, skill, context }) {
    if (attacker !== owner || !(actualDmg > 0)) return;
    if (!defender || defender.team === owner.team) return;
    if (skill?.key === arcSkill.key) return;

    const arcDamage = (Number(actualDmg) * this.arcPercent) / 100;

    const others = context.aliveChampions.filter(
      (champion) => champion.team !== owner.team && champion !== defender,
    );
    if (!others.length) return;

    context.extraDamageQueue ??= [];

    for (const other of others) {
      context.extraDamageQueue.push({
        baseDamage: arcDamage,
        attacker: owner,
        defender: other,
        skill: arcSkill,
        type: "physical",
        element: arcSkill.element,
        contact: false,
        mode: "absolute",
      });
    }

    return {
      log: `[PASSIVE — ${this.name}] the current leaves ${formatChampionName(defender)} and looks for the rest of the room.`,
    };
  },
};
