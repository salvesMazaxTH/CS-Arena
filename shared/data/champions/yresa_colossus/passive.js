import { TargetFilter } from "../../../engine/combat/targetFilter.js";

export default {
  key: "many_made_one",
  name: "Many Made One",

  auraDmgReductionPerRootward: 3,
  pseudoPermanentDurationTurns: 2,

  description(champion) {
    const fused = champion?.runtime?.fusedRootwards ?? 0;
    const total = this.auraDmgReductionPerRootward * fused;

    const standing = {
      en: fused
        ? ` <b>${fused}</b> Rootwards stand inside it right now, so it is granting <b>${total}%</b> damage reduction in total.`
        : "",
      pt: fused
        ? ` <b>${fused}</b> Rootwards estão de pé dentro dele agora, então ele está concedendo <b>${total}%</b> de redução de dano no total.`
        : "",
    };

    return {
      en: `Every Rootward fused into the Colossus still keeps its vow: every ally other than the one who raised it takes <b>${this.auraDmgReductionPerRootward}%</b> less damage from every source for each <b>Rootward</b> inside it (except Absolute Damage).${standing.en}`,
      pt: `Cada Rootward fundido no Colossus ainda mantém seu voto: todo aliado que não seja quem o ergueu sofre <b>${this.auraDmgReductionPerRootward}%</b> menos dano de qualquer fonte para cada <b>Rootward</b> dentro dele (exceto Dano Absoluto).${standing.pt}`,
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
    return `yresa_colossus_many_made_one_${owner.id}`;
  },

  refreshAura({ owner, context }) {
    this.clearAura({ owner, context });

    const fused = owner.runtime.fusedRootwards ?? 0;
    if (fused === 0) return;

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
        amount: this.auraDmgReductionPerRootward * fused,
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
