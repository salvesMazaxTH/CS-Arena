import { formatChampionName } from "../../../ui/formatters.js";
import { TargetFilter } from "../../../engine/combat/targetFilter.js";

export default {
  key: "the_colossal_hush",
  name: "The Colossal Hush",

  powerThreshold: 400, // Attack + current HP
  stunDuration: 2,

  description() {
    return {
      en: `Alexa Neruvya's draconic shape rises over the arena, and at the start of the next turn its weight lands on everyone still standing. Any enemy whose <b>Attack</b> and current <b>HP</b> together do not reach <b>${this.powerThreshold}</b> is caught in a strange mix of dread and awe, and is left <b>Stunned</b> for <b>${this.stunDuration}</b> turn(s).`,
      pt: `A forma draconiana de Alexa Neruvya se ergue sobre a arena, e no início do turno seguinte o peso dela recai sobre todos que ainda estão de pé. Todo inimigo cujo <b>Ataque</b> e <b>HP</b> atual somados não alcançarem <b>${this.powerThreshold}</b> é tomado por uma estranha mistura de pavor e assombro, ficando <b>Atordoado</b> por <b>${this.stunDuration}</b> turno(s).`,
    };
  },

  // No hookScope here on purpose: onTurnStart is dispatched once per champion
  // with no other party in the payload, so it is self-scoped by construction.
  onTurnStart({ owner, context }) {
    // Runtime survives the revert, so the mark is keyed to this transformation.
    const sequence = owner.runtime.transformation?.sequence ?? 0;
    if (owner.runtime.colossalHushSequence === sequence) return;
    owner.runtime.colossalHushSequence = sequence;

    // Enemies still taking the field are spared, like any other targeting.
    const awedEnemies = TargetFilter.candidates(
      "enemy",
      owner,
      context.aliveChampions ?? [],
    ).filter((champ) => champ.Attack + champ.HP < this.powerThreshold);

    if (!awedEnemies.length) return;

    awedEnemies.forEach((enemy) => {
      enemy.applyStatusEffect("stunned", this.stunDuration, context, {
        sourceId: owner.id,
      });
      context.registerDialog({
        message: {
          en: `${formatChampionName(enemy)} freezes before the colossal dragon, caught between dread and awe!`,
          pt: `${formatChampionName(enemy)} congela diante do dragão colossal, entre o pavor e o assombro!`,
        },
        sourceId: owner.id,
        targetId: enemy.id,
      });
    });

    const count = awedEnemies.length;
    const single = count === 1;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${count} ${single ? "enemy is" : "enemies are"} Stunned for ${this.stunDuration} turn(s).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${count} ${single ? "inimigo fica Atordoado" : "inimigos ficam Atordoados"} por ${this.stunDuration} turno(s).`,
      },
    };
  },
};
