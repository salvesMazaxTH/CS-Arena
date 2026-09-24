import { TargetFilter } from "../../../engine/combat/targetFilter.js";

export default {
  key: "bedrock_vow",
  name: "Bedrock Vow",

  auraDmgReductionPercent: 2,
  pseudoPermanentDurationTurns: 2,

  description() {
    return {
      en: `While Stoneward stands, the ground around it holds: every ally other than the one who raised it takes <b>${this.auraDmgReductionPercent}%</b> less damage from every source (except Absolute Damage).`,
      pt: `Enquanto o Stoneward estiver de pé, o chão ao redor dele aguenta: todo aliado que não seja quem o ergueu sofre <b>${this.auraDmgReductionPercent}%</b> menos dano de qualquer fonte (exceto Dano Absoluto).`,
    };
  },

  onTurnStart({ owner, context }) {
    this.refreshAura({ owner, context });
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (deadChampion !== owner) return;

    this.clearAura({ owner, context });
  },

  auraSource(owner) {
    return `yresa_sentinel_bedrock_vow_${owner.id}`;
  },

  refreshAura({ owner, context }) {
    this.clearAura({ owner, context });

    const champions = [...(context?.allChampions?.values?.() ?? [])];
    const allies = TargetFilter.candidates(
      { type: "ally" },
      owner,
      champions,
    ).filter(
      (ally) => ally.id !== owner.id && ally.id !== owner.runtime.summonerId,
    );

    for (const ally of allies) {
      ally.applyDamageReduction({
        amount: this.auraDmgReductionPercent,
        duration: this.pseudoPermanentDurationTurns,
        type: "percent",
        source: this.auraSource(owner),
        context,
      });
    }
  },

  clearAura({ owner, context }) {
    const source = this.auraSource(owner);

    for (const champion of context?.allChampions?.values?.() ?? []) {
      if (!champion.damageReductionModifiers?.length) continue;

      champion.damageReductionModifiers =
        champion.damageReductionModifiers.filter(
          (modifier) => modifier?.source !== source,
        );
    }
  },
};
