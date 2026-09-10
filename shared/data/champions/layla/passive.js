import { formatChampionName } from "../../../ui/formatters.js";

export const STATIC_STACKS_KEY = "laylaStatic";

const EXPOSED_EFFECTS = ["stunned", "paralyzed", "snared"];

export default {
  key: "buried_static",
  name: "Buried Static",

  maxStacks: 3,
  bonusPerStack: 12,
  readCritBonus: 60,

  description() {
    return `Layla learned to survive by watching every door. Layla's fear never stops watching: every time an enemy damages her she banks 1 <b>Static</b>, up to ${this.maxStacks}, and her next damaging ability spends all of it for +${this.bonusPerStack}% damage per Static.

    She never strikes lucky, only certain. Her observations are precise: any damaging hit she lands on an enemy who is Stunned, Paralyzed, or Snared is a guaranteed critical hit, landing at ${(1 + this.readCritBonus / 100).toFixed(2)}x.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgTaking({ owner, actualDmg }) {
    if (!(actualDmg > 0) || !owner.alive) return;

    const current = owner.runtime[STATIC_STACKS_KEY] ?? 0;
    if (current >= this.maxStacks) return;

    owner.runtime[STATIC_STACKS_KEY] = current + 1;
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, crit, skill, context }) {
    if (attacker !== owner || !damage || skill?.damageMode === undefined) return;

    const stacks = owner.runtime[STATIC_STACKS_KEY] ?? 0;
    if (stacks > 0) owner.runtime[STATIC_STACKS_KEY] = 0;

    const exposed = EXPOSED_EFFECTS.some((key) =>
      defender?.hasStatusEffect?.(key),
    );

    const result = {};
    if (stacks > 0) {
      result.damage = Number(damage) * (1 + (stacks * this.bonusPerStack) / 100);
    }
    if (exposed && !crit?.didCrit) {
      result.crit = {
        ...(crit ?? {}),
        didCrit: true,
        forced: true,
        disabled: false,
        bonus: this.readCritBonus,
      };
      context?.registerDialog?.({
        message: `${formatChampionName(owner)} already has the opening in ${formatChampionName(defender)} measured.`,
        sourceId: owner.id,
        targetId: defender.id,
      });
    }

    return Object.keys(result).length ? result : undefined;
  },
};
