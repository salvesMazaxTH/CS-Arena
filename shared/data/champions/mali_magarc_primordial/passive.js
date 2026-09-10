import { formatChampionName } from "../../../ui/formatters.js";
import { unrefineMagical, drainUnrefined } from "../mali_magarc/passive.js";

export default {
  key: "nothing_refined_survives",
  name: "Nothing Refined Survives Him",

  boostedAbsorbPercent: 60,
  momentumCapPerTurn: 8,

  description() {
    return `While Mali Magarc holds his true shape, nothing keeps its refinement near him. The moment he unfolds, one positive status effect is unmade on every enemy, and for as long as the form lasts ${this.boostedAbsorbPercent}% of the magical damage aimed at him is stripped to raw arcane, returning up to ${this.momentumCapPerTurn} Momentum at the start of each turn.`;
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
  },

  onBeforeDmgTaking(payload) {
    return unrefineMagical(payload, this.boostedAbsorbPercent);
  },

  onTurnStart({ owner, context }) {
    const results = [];

    const gained = drainUnrefined(owner, { perTurnCap: this.momentumCapPerTurn });
    if (gained) {
      context?.registerDialog?.({
        message: `<b>[Passive — ${this.name}]</b> the unmade magic pours into ${formatChampionName(owner)} as ${gained} Momentum.`,
        sourceId: owner.id,
        targetId: owner.id,
      });
      results.push({
        log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} draws ${gained} Momentum out of the pooled essence.`,
      });
    }

    // Runtime survives the revert, so the entry pulse is keyed to this transformation.
    const sequence = owner.runtime.transformation?.sequence ?? 0;
    if (owner.runtime.maliUnfoldSequence !== sequence) {
      owner.runtime.maliUnfoldSequence = sequence;

      const enemies = context.aliveChampions.filter(
        (champ) => champ.team !== owner.team && champ.alive,
      );

      let stripped = 0;
      for (const enemy of enemies) {
        const [buff] = enemy.getStatusEffects({ type: "buff" });
        if (!buff) continue;

        enemy.removeStatusEffect(buff.key);
        stripped++;

        context.registerDialog?.({
          message: `The refinement peels off ${formatChampionName(enemy)} before the dragon.`,
          sourceId: owner.id,
          targetId: enemy.id,
        });
      }

      if (stripped) {
        results.push({
          log: `<b>[Passive — ${this.name}]</b> ${stripped} positive effect(s) are unmade as Mali Magarc unfolds.`,
        });
      }
    }

    return results.length ? results : undefined;
  },
};
