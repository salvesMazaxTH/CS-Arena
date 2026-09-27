import { formatChampionName } from "../../../ui/formatters.js";
import stonewardPassive from "../yresa_sentinel/passive.js";

export default {
  key: "soilbound_oath",
  name: "Soilbound Oath",

  wardedStatusKeys: ["rooted", "snared"],
  dmgReductionPerSentinel: 5,
  pseudoPermanentDurationTurns: 2,
  dmgReductionSrc: "yresa_petronika_soilbound_oath",

  description(champion) {
    const current = this.soilReduction(champion);

    return {
      en: `The ground answers to Yrêsa Petroníka, so it never holds her: <b>Rooted</b> and <b>Snared</b> never take hold on her. She stands outside Stoneward's aura and draws from the soil instead, taking <b>${this.dmgReductionPerSentinel}%</b> less damage from every source for each <b>Stoneward</b> on the field, those fused into the <b>Stoneward Colossus</b> included (except <b>Absolute Damage</b>). Right now the soil is taking <b>${current}%</b> of every hit off her.`,
      pt: `O solo responde a Yrêsa Petroníka, então ele nunca a prende: <b>Enraizado</b> e <b>Enredado</b> jamais pegam nela. Ela fica de fora da aura do <b>Stoneward</b> e bebe da terra diretamente, sofrendo <b>${this.dmgReductionPerSentinel}%</b> menos dano de qualquer fonte para cada <b>Stoneward</b> no campo, contando os fundidos no <b>Stoneward Colossus</b> (exceto <b>Dano Absoluto</b>). No momento o solo está tirando <b>${current}%</b> de cada golpe que vem nela.`,
    };
  },

  soilReduction(champion) {
    return (champion?.damageReductionModifiers ?? [])
      .filter((modifier) => modifier?.source === this.dmgReductionSrc)
      .reduce((total, modifier) => total + (modifier.amount ?? 0), 0);
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
    if (!owner.runtime.colossusIds?.includes(deadChampion.id)) return;

    this.refreshSoil({ owner, context });
  },

  livingColossi({ owner, context }) {
    const ids = owner.runtime.colossusIds ?? [];
    const living = ids.filter(
      (id) => context?.allChampions?.get?.(id)?.alive === true,
    );

    owner.runtime.colossusIds = living;
    return living;
  },

  livingSentinels({ owner, context }) {
    const ids = owner.runtime.sentinelIds ?? [];
    const living = ids.filter(
      (id) => context?.allChampions?.get?.(id)?.alive === true,
    );

    // A fallen Stoneward fires no death hook, so its aura is lifted here.
    for (const id of ids) {
      if (!living.includes(id)) {
        stonewardPassive.clearAura({ owner: { id }, context });
      }
    }

    owner.runtime.sentinelIds = living;
    return living;
  },

  refreshSoil({ owner, context }) {
    const fused = this.livingColossi({ owner, context }).reduce(
      (total, id) =>
        total + (context.allChampions.get(id).runtime.fusedStonewards ?? 0),
      0,
    );
    const count = this.livingSentinels({ owner, context }).length + fused;

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
