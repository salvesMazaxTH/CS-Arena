import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "hammer_of_justice",
  name: "The Hammer of Justice",

  judgmentPiercingPercent: 50,
  judgmentBonusDmgPercent: 20,
  dragonBonusDmgPercent: 20,

  description() {
    return `Valeria answers every unearned gain. The first hit she lands after an enemy scores with CLAIM comes down as Judgment: guaranteed ${this.judgmentPiercingPercent}% piercing damage, plus ${this.judgmentBonusDmgPercent}% bonus damage. Dragonkind she has already taken the measure of once, and against it she deals a further ${this.dragonBonusDmgPercent}% bonus damage. Her wings never let the ground decide where she stands, so Root and Snare effects never take hold.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onStatusEffectIncoming: "target",
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner?.alive || !actionSource) return;
    if (actionSource.team === owner.team) return;

    owner.runtime ??= {};
    owner.runtime.judgmentReady = true;

    context?.registerDialog?.({
      message: `${formatChampionName(owner)} weighs the scales — someone is about to pay for that.`,
      sourceId: owner.id,
      targetId: owner.id,
    });
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, baseDamage }) {
    if (attacker !== owner) return;

    let multiplier = 1;
    let piercing = false;

    if (owner.runtime?.judgmentReady) {
      owner.runtime.judgmentReady = false;
      multiplier += this.judgmentBonusDmgPercent / 100;
      piercing = true;
    }

    if (defender?.species?.some((s) => s === "dragon" || s === "primordial dragon")) {
      multiplier += this.dragonBonusDmgPercent / 100;
    }

    if (multiplier === 1) return;

    // Dragon bonus alone leaves the mitigation untouched, so scaling the already
    // mitigated hit is correct. Judgment changes the hit to Piercing, so it has
    // to work from the raw damage and let the pipeline re-mitigate once.
    if (!piercing) {
      return { damage: Number(damage) * multiplier };
    }

    const boosted = Number(baseDamage ?? damage ?? 0) * multiplier;

    return {
      baseDamage: boosted,
      preMitigationDamage: boosted,
      mode: "piercing",
      piercingPercentage: this.judgmentPiercingPercent,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (statusEffect.key !== "rooted" && statusEffect.key !== "snared") return;

    return {
      cancel: true,
      message: `${formatChampionName(target)} simply takes to the air — the ground has nothing left to hold.`,
    };
  },
};
