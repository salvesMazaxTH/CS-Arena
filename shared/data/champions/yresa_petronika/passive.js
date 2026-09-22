import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "soilbound_oath",
  name: "Soilbound Oath",

  wardedStatusKeys: ["rooted", "snared"],
  dmgReductionPerSentinel: 5,
  pseudoPermanentDurationTurns: 2,
  dmgReductionSrc: "yresa_petronika_soilbound_oath",

  description() {
    return {
      en: `The ground answers to Yrêsa Petroníka, so it never holds her: <b>Rooted</b> and <b>Snared</b> never take hold on her. She stands outside Rootward's aura and draws from the soil instead, taking <b>${this.dmgReductionPerSentinel}%</b> less damage from every source for each <b>Rootward</b> standing on the field (except Absolute Damage).`,
      pt: `O solo responde a Yrêsa Petroníka, então ele nunca a prende: <b>Enraizado</b> e <b>Enredado</b> jamais pegam nela. Ela fica de fora da aura do <b>Rootward</b> e bebe da terra diretamente, sofrendo <b>${this.dmgReductionPerSentinel}%</b> menos dano de qualquer fonte para cada <b>Rootward</b> de pé no campo (exceto Dano Absoluto).`,
    };
  },

  hookScope: {
    onStatusEffectIncoming: "target",
  },

  onStatusEffectIncoming({ owner, statusEffect }) {
    if (!this.wardedStatusKeys.includes(statusEffect.key)) return;

    return {
      cancel: true,
      message: {
        en: `${formatChampionName(owner)} stands on soil that is hers: <b>${statusEffect.name}</b> never takes hold.`,
        pt: `${formatChampionName(owner)} pisa num solo que é dela: <b>${statusEffect.name}</b> não pega.`,
      },
    };
  },

  onTurnStart({ owner, context }) {
    this.refreshSoil({ owner, context });
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (!owner.runtime.sentinelIds?.includes(deadChampion.id)) return;

    this.refreshSoil({ owner, context });
  },

  livingColossus({ owner, context }) {
    const colossus = context?.allChampions?.get?.(owner.runtime.colossusId);
    if (colossus?.alive !== true) {
      owner.runtime.colossusId = null;
      return null;
    }

    return colossus;
  },

  livingSentinels({ owner, context }) {
    const ids = owner.runtime.sentinelIds ?? [];
    const living = ids.filter(
      (id) => context?.allChampions?.get?.(id)?.alive === true,
    );

    owner.runtime.sentinelIds = living;
    return living;
  },

  refreshSoil({ owner, context }) {
    const count = this.livingSentinels({ owner, context }).length;

    owner.damageReductionModifiers = (
      owner.damageReductionModifiers ?? []
    ).filter((modifier) => modifier?.source !== this.dmgReductionSrc);

    if (count === 0) return;

    owner.applyDamageReduction({
      amount: this.dmgReductionPerSentinel * count,
      duration: this.pseudoPermanentDurationTurns,
      type: "percent",
      source: this.dmgReductionSrc,
      context,
    });
  },
};
