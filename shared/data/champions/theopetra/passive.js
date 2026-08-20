import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "eternalized_rock",
  name: "Eternalized Rock",
  maxStacks: 3,
  bonusPercent: 135, // bonus damage on the next ability
  piercingRatio: 0.35, // 35% of the damage becomes Piercing

  description() {
    return `Gains 1 stack whenever she takes damage (max ${this.maxStacks}). Upon reaching ${this.maxStacks} stacks, her next ability deals +${this.bonusPercent}% bonus damage and becomes Piercing (${this.piercingRatio * 100}% Piercing), then all stacks are consumed.
    
    Theópetra is immune to Control effects (softCC and hardCC).`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
    onStatusEffectIncoming: "target",
  },

  onAfterDmgTaking({ owner, context }) {
    owner.runtime = owner.runtime || {};
    owner.runtime.theopetraStacks = Math.min(
      (owner.runtime.theopetraStacks || 0) + 1,
      this.maxStacks,
    );

    if (owner.runtime.theopetraStacks === this.maxStacks) {
      context.registerDialog({
        message: `<b>[PASSIVE — ${this.name}]</b> ${formatChampionName(owner)} reached the maximum number of stacks (${this.maxStacks})! Her next ability will deal bonus damage.`,
        sourceId: owner.id,
        targetId: owner.id,
      });

      return {
        log: `<b>[PASSIVE — ${this.name}]</b> ${formatChampionName(owner)} reached the maximum number of stacks (${this.maxStacks})! Her next ability will deal bonus damage.`,
      };
    } else {
      return {
        log: `<b>[PASSIVE — ${this.name}]</b> ${formatChampionName(owner)} gained 1 stack (${owner.runtime.theopetraStacks}/${this.maxStacks}).`,
      };
    }
  },

  onBeforeDmgDealing({ attacker, owner, skill, damage, context }) {
    if (attacker !== owner) return;

    if (
      !owner.runtime?.theopetraStacks ||
      owner.runtime.theopetraStacks < this.maxStacks
    )
      return;

    owner.runtime.theopetraStacks = 0;

    const bonus = Math.floor(damage * (this.bonusPercent / 100));
    const finalBaseDamage = damage + bonus;

    return {
      damage: finalBaseDamage,
      piercingPercentage: this.piercingRatio * 100,
      mode: "piercing",
      baseDamage: finalBaseDamage,
      preMitigationDamage: finalBaseDamage,
      log: `[PASSIVE — Eternalized Rock] ${formatChampionName(owner)} consumes all stacks and gains +${this.bonusPercent}% bonus damage on this ability!`,
    };
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (!statusEffect?.subtypes) return;

    if (
      statusEffect.subtypes.includes("hardCC") ||
      statusEffect.subtypes.includes("softCC")
    ) {
      return {
        cancel: true,
        message: `${formatChampionName(target)} is immune to Control effects!`,
      };
    }
  },
};