import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "the_colossal_hush",
  name: "The Colossal Hush",

  powerThreshold: 380, // Attack + current HP
  stunDuration: 2,

  description() {
    return `The moment Alexa Neruvya's draconic shape rises over the arena, the weight of it lands on everyone still standing. Any enemy whose Attack and current HP together do not reach ${this.powerThreshold} is caught in a strange mix of dread and awe, and is left Stunned for ${this.stunDuration} turn(s).`;
  },

  // No hookScope here on purpose: onTurnStart is dispatched once per champion
  // with no other party in the payload, so it is self-scoped by construction.
  onTurnStart({ owner, context }) {
    // Runtime survives the revert, so the mark is keyed to this transformation.
    const sequence = owner.runtime.transformation?.sequence ?? 0;
    if (owner.runtime.colossalHushSequence === sequence) return;
    owner.runtime.colossalHushSequence = sequence;

    const awedEnemies = context.aliveChampions.filter(
      (champ) =>
        champ.team !== owner.team &&
        champ.alive &&
        champ.Attack + champ.HP < this.powerThreshold,
    );

    if (!awedEnemies.length) return;

    awedEnemies.forEach((enemy) => {
      enemy.applyStatusEffect("stunned", this.stunDuration, context);
      context.registerDialog({
        message: `${formatChampionName(enemy)} freezes before the colossal dragon, caught between dread and awe!`,
        sourceId: owner.id,
        targetId: enemy.id,
      });
    });

    return {
      log: `[PASSIVE — ${this.name}] ${awedEnemies.length} enemy/enemies are Stunned for ${this.stunDuration} turn(s).`,
    };
  },
};
