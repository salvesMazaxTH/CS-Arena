export default {
  key: "bedrock_vow",
  name: "Bedrock Vow",

  auraDmgReductionPercent: 2,
  inertDurationTurns: 99,

  description() {
    return {
      en: `<b>Stoneward</b> is born <b>Inert</b>: by nature, it does not move of its own accord. While it stands, the ground around it holds: every ally other than the one who raised it takes <b>${this.auraDmgReductionPercent}%</b> less damage from every source (except <b>Absolute Damage</b>).`,
      pt: `O <b>Stoneward</b> nasce <b>Inerte</b>: por natureza, ele não se move por conta própria. Enquanto estiver de pé, o chão ao redor dele aguenta: todo aliado que não seja quem o ergueu sofre <b>${this.auraDmgReductionPercent}%</b> menos dano de qualquer fonte (exceto <b>Dano Absoluto</b>).`,
    };
  },

  onChampionAdded({ owner, champion, context }) {
    if (champion === owner) {
      owner.applyStatusEffect("inert", this.inertDurationTurns, context);
      return;
    }

    if (champion.team === owner.team) this.grantAura({ owner, context });
  },

  onChampionReturned({ owner, champion, context }) {
    if (champion.team === owner.team) this.grantAura({ owner, context });
  },

  // Sustained by the Stoneward, so the engine lifts it the moment it leaves the field.
  grantAura({ owner, context }) {
    if (!owner.alive) return;

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
        amount: this.auraDmgReductionPercent,
        type: "percent",
        source: this.key,
        sustainedById: owner.id,
        context,
      });
    }
  },
};
