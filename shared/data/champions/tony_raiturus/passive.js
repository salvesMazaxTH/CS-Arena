import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";

export const THUNDER_RUNTIME_FLAG = "raiturusThunder";

export const THUNDER_FLAT_BONUS = 20;

// Carries splitsIntoThunder: false so the passive never splits its own thunder.
const thunderSkill = {
  key: "thunder_arrives",
  name: "The Thunder Arrives",
  element: "lightning",
  contact: false,
  splitsIntoThunder: false,
};

export function detonateThunder(owner, context) {
  const results = [];

  for (const champion of context.aliveChampions) {
    const stored = champion.runtime?.[THUNDER_RUNTIME_FLAG];
    if (!stored) continue;

    delete champion.runtime[THUNDER_RUNTIME_FLAG];

    const result = new DamageEvent({
      baseDamage: stored,
      bonusDamage: THUNDER_FLAT_BONUS,
      attacker: owner,
      defender: champion,
      skill: thunderSkill,
      type: "magical",
      cannotBeEvaded: true,
      context,
      allChampions: context.allChampions,
    }).execute();

    context.registerDialog({
      message: `The sound finally reaches ${formatChampionName(champion)}.`,
      sourceId: owner.id,
      targetId: champion.id,
    });

    results.push(...(Array.isArray(result) ? result : [result]));
  }

  return results;
}

export default {
  key: "the_flash_arrives_first",
  name: "The Flash Arrives First",

  flashPercent: 55,
  thunderPercent: 65,

  description() {
    return `Tony Raiturus is a storm wearing a boy, and the boy is always a little ahead of the storm. Every blow he lands splits: only ${this.flashPercent}% of it arrives as the flash, right away, while ${this.thunderPercent}% of it hangs over the target as thunder still on its way. At the start of his next turn all of it lands at once, plus ${THUNDER_FLAT_BONUS} bonus damage, and it cannot be evaded — the strike already happened, the sound is only catching up. If he falls first, the thunder arrives anyway.`;
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
  },

  onBeforeDmgDealing({ attacker, owner, defender, damage, skill }) {
    if (attacker !== owner || defender === owner) return;
    if (skill?.splitsIntoThunder === false) return;

    const share = skill?.doublesThunder
      ? this.thunderPercent * 2
      : this.thunderPercent;

    defender.runtime ??= {};
    defender.runtime[THUNDER_RUNTIME_FLAG] =
      (defender.runtime[THUNDER_RUNTIME_FLAG] ?? 0) +
      (Number(damage) * share) / 100;

    return { damage: (Number(damage) * this.flashPercent) / 100 };
  },

  onTurnStart({ owner, context }) {
    return detonateThunder(owner, context);
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion !== owner) return;

    return detonateThunder(owner, context);
  },
};
