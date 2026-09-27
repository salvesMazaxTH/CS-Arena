export default {
  key: "bedrock_vow",
  name: "Bedrock Vow",

  auraDmgReductionPercent: 2,
  inertDurationTurns: 99,
  pseudoPermanentDurationTurns: 2,

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

    if (champion.team === owner.team) this.refreshAura({ owner, context });
  },

  onTurnStart({ owner, context }) {
    this.refreshAura({ owner, context });
  },

  // Leaving for the Nothingness takes the aura along; the return brings it back.
  onChampionVanished({ owner, champion, context }) {
    if (champion === owner) this.clearAura({ owner, context });
  },

  onChampionReturned({ owner, champion, context }) {
    if (champion.team === owner.team) this.refreshAura({ owner, context });
  },

  auraSource(owner) {
    return `yresa_sentinel_bedrock_vow_${owner.id}`;
  },

  refreshAura({ owner, context }) {
    this.clearAura({ owner, context });

    // Like an emblem, the aura reaches allies still taking the field.
    const allies = [...(context?.allChampions?.values?.() ?? [])].filter(
      (ally) =>
        ally.alive &&
        ally.team === owner.team &&
        ally.id !== owner.id &&
        ally.id !== owner.runtime.summonerId,
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
