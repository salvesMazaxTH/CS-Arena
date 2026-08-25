import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "the_lightning_strikes_twice",
  name: "The Lightning Strikes Twice",
  initialChance: 1,
  chanceIncreasePerTurn: 5,

  description(champion) {
    return `Elias Cross's damaging abilities have a <b>${champion.runtime.passiveChance ?? this.initialChance}%</b> chance to repeat. Each turn, he gains <b>+${this.chanceIncreasePerTurn}%</b> chance.`;
  },

  hookScope: {
    onActionResolved: "actionSource",
  },

  onActionResolved({ owner, skill, action, context }) {
    if (context?.isPassiveRepeat) return;

    const events = context?.visual?.damageEvents ?? [];

    const didDealMainDamage = events.some(
      (e) =>
        (e.damageDepth ?? 0) === 0 &&
        e.sourceId === owner.id &&
        e.amount > 0,
    );

    if (!didDealMainDamage) return;

    owner.runtime.passiveChance ??= this.initialChance;

    const chance = owner.runtime.passiveChance / 100;
    const roll = Math.random();

    if (roll >= chance) return;

    context.registerDialog({
      message: `<b>[Passive – "${this.name}"]</b>`,
      sourceId: owner.id,
    });

    context.repeatActionRequest = {
      userId: owner.id,
      skillKey: skill?.key,
      targetIds: action?.targetIds ?? {},
      priority: skill?.priority ?? 0,
      speed: owner.Speed ?? 0,
    };
  },

  onTurnStart({ owner, context }) {
    owner.runtime.passiveChance ??= this.initialChance;

    const turn = context?.currentTurn ?? 0;
    const buffs = owner.runtime.passiveTempBuffs ?? [];

    let expired = 0;

    const activeBuffs = buffs.filter((b) => {
      const amount = b?.amount ?? 0;
      const expires = b?.expiresAtTurn;

      if (Number.isFinite(expires) && expires <= turn) {
        expired += amount;
        return false;
      }

      return true;
    });

    owner.runtime.passiveTempBuffs = activeBuffs;

    const next =
      owner.runtime.passiveChance -
      expired +
      this.chanceIncreasePerTurn;

    owner.runtime.passiveChance = Math.max(
      0,
      Math.min(100, next),
    );
  },
};