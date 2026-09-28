export default {
  key: "many_made_one",
  name: "Many Made One",

  auraDmgReductionPerStoneward: 3,

  description(champion) {
    const fused = champion?.runtime?.fusedStonewards ?? 0;
    const total = this.auraDmgReductionPerStoneward * fused;

    const standing = {
      en: fused
        ? ` <b>${fused} Stonewards</b> stand inside it right now, so it is granting <b>${total}%</b> damage reduction in total.`
        : "",
      pt: fused
        ? ` <b>${fused} Stonewards</b> estão de pé dentro dele agora, então ele está concedendo <b>${total}%</b> de redução de dano no total.`
        : "",
    };

    return {
      en: `Every <b>Stoneward</b> fused into the <b>Colossus</b> still keeps its vow: every ally other than the one who raised it takes <b>${this.auraDmgReductionPerStoneward}%</b> less damage from every source for each <b>Stoneward</b> inside it (except <b>Absolute Damage</b>).${standing.en}`,
      pt: `Cada <b>Stoneward</b> fundido no <b>Colossus</b> ainda mantém seu voto: todo aliado que não seja quem o ergueu sofre <b>${this.auraDmgReductionPerStoneward}%</b> menos dano de qualquer fonte para cada <b>Stoneward</b> dentro dele (exceto <b>Dano Absoluto</b>).${standing.pt}`,
    };
  },

  onChampionAdded({ owner, champion, context }) {
    if (champion !== owner && champion.team === owner.team) {
      this.grantAura({ owner, context });
    }
  },

  onChampionReturned({ owner, champion, context }) {
    if (champion.team === owner.team) this.grantAura({ owner, context });
  },

  // Sustained by the Colossus, so the engine lifts it the moment it leaves the field.
  grantAura({ owner, context }) {
    const fused = owner.runtime.fusedStonewards ?? 0;
    if (!owner.alive || fused === 0) return;

    for (const ally of context?.allChampions?.values?.() ?? []) {
      if (
        !ally.alive ||
        ally.team !== owner.team ||
        ally.id === owner.id ||
        ally.id === owner.runtime.summonerId ||
        ally.damageReductionModifiers?.some((m) => m?.sustainedById === owner.id)
      ) {
        continue;
      }

      ally.applyDamageReduction({
        amount: this.auraDmgReductionPerStoneward * fused,
        type: "percent",
        source: this.key,
        sustainedById: owner.id,
        context,
      });
    }
  },
};
