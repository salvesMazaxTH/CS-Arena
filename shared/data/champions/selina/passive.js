import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

export default {
  key: "mercys_reach",
  name: "Mercy's Reach",

  lowHpThreshold: 50,
  healAmplifyPercent: 40,
  claimHealPercent: 25,

  description() {
    return `Selina was raised in gilded halls, but her light bends first toward whoever is closest to breaking. Whenever she restores HP to an ally at or below ${this.lowHpThreshold}% HP, the mending is worth ${this.healAmplifyPercent}% more. Whenever an ally uses CLAIM, herself included, her light answers on its own — restoring HP equal to ${this.claimHealPercent}% of her Attack.`;
  },

  hookScope: {
    onBeforeHealing: "healSrc",
  },

  onBeforeHealing({ healTarget, amount }) {
    if (!(amount > 0) || !healTarget) return;
    if (healTarget.HP / healTarget.maxHP > this.lowHpThreshold / 100) return;

    return { amount: Math.floor(amount * (1 + this.healAmplifyPercent / 100)) };
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;
    if (!owner.alive || !actionSource || actionSource.team !== owner.team) return;

    const healAmount = (owner.Attack * this.claimHealPercent) / 100;
    const healed = new HealEvent({
      target: actionSource,
      amount: healAmount,
      context,
      source: owner,
      allChampions: context?.allChampions,
    }).execute();

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(actionSource)}'s Claim draws Selina's light — ${healed} HP restored.`,
    };
  },
};
