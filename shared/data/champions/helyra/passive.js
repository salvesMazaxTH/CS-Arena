import { TargetFilter } from "../../../engine/combat/targetFilter.js";
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
    return {
      en: `Helyra has never in her life aimed at one thing. The charge riding her rounds refuses to stop at the body it entered, so every hit she lands jumps from the chosen target to each of the other enemies on the field for <b>${this.arcPercent}%</b> of the damage it actually dealt, as <b>Absolute Damage</b>.`,
      pt: `Helyra nunca mirou em uma coisa só na vida. A carga que corre em suas balas se recusa a parar no corpo em que entrou: cada golpe que ela acerta salta do alvo escolhido para cada um dos outros inimigos em campo, causando <b>${this.arcPercent}%</b> do dano que de fato infligiu, como <b>Dano Absoluto</b>.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, attacker, defender, actualDmg, skill, context }) {
    if (attacker !== owner || !(actualDmg > 0)) return;
    if (defender.team === owner.team) return;

    // A skill carrying conductorArcPercent grounds through Conductor enemies harder, spending it.
    const grounding = skill.conductorArcPercent;
    if (grounding) defender.removeStatusEffect("conductor");

    const others = TargetFilter.candidates(
      "enemy",
      owner,
      context.aliveChampions ?? [],
    ).filter((champion) => champion !== defender);
    if (!others.length) return;

    context.extraDamageQueue ??= [];

    for (const other of others) {
      const grounded = grounding && other.hasStatusEffect("conductor");
      if (grounded) other.removeStatusEffect("conductor");

      context.extraDamageQueue.push({
        baseDamage: (actualDmg * (grounded ? grounding : this.arcPercent)) / 100,
        attacker: owner,
        defender: other,
        skill: arcSkill,
        type: "physical",
        mode: "absolute",
      });
    }

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> The current leaves ${formatChampionName(defender)} and looks for the rest of the room.`,
        pt: `<b>[Passiva — ${this.name}]</b> A corrente deixa ${formatChampionName(defender)} e procura o resto do salão.`,
      },
    };
  },
};
