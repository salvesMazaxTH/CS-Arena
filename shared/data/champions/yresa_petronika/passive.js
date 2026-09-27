import { Nothingness } from "../../../engine/combat/nothingness.js";
import { formatChampionName } from "../../../ui/formatters.js";
import colossusPassive from "../yresa_colossus/passive.js";
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
      en: `The ground answers to Yrêsa Petroníka, so it never holds her: <b>Rooted</b> and <b>Snared</b> never take hold on her. She stands outside <b>Stoneward</b>'s aura and draws from the soil instead, taking <b>${this.dmgReductionPerSentinel}%</b> less damage from every source for each <b>Stoneward</b> on the field, those fused into the <b>Stoneward Colossus</b> included (except <b>Absolute Damage</b>). Right now the soil is taking <b>${current}%</b> of every hit off her.`,
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

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
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

  // A Stoneward is born leavesNoDeath, so its fall is caught on the blow itself.
  onAfterDmgTaking({ defender, owner, context }) {
    if (defender.alive || !owner.runtime.sentinelIds?.includes(defender.id)) {
      return;
    }

    this.refreshSoil({ owner, context });
  },

  onChampionDeath({ owner, deadChampion, context }) {
    if (!owner.runtime.colossusIds?.includes(deadChampion.id)) return;

    this.refreshSoil({ owner, context });
  },

  // A Stoneward away in the Nothingness stops counting until it comes back.
  onChampionVanished({ owner, champion, context }) {
    if (this._isOwnStone(owner, champion)) this.refreshSoil({ owner, context });
  },

  onChampionReturned({ owner, champion, context }) {
    if (champion === owner || this._isOwnStone(owner, champion)) {
      this.refreshSoil({ owner, context });
    }
  },

  _isOwnStone(owner, champion) {
    return [
      ...(owner.runtime.sentinelIds ?? []),
      ...(owner.runtime.colossusIds ?? []),
    ].includes(champion.id);
  },

  livingColossi({ owner, context }) {
    return this._standing({
      owner,
      context,
      idsKey: "colossusIds",
      auraPassive: colossusPassive,
    });
  },

  livingSentinels({ owner, context }) {
    return this._standing({
      owner,
      context,
      idsKey: "sentinelIds",
      auraPassive: stonewardPassive,
    });
  },

  // Off the field means no aura, but one away in the Nothingness stays hers.
  _standing({ owner, context, idsKey, auraPassive }) {
    const ids = owner.runtime[idsKey] ?? [];
    const standing = ids.filter(
      (id) => context?.allChampions?.get?.(id)?.alive === true,
    );
    const vanishedIds = (context?.matchChampions ?? [])
      .filter((champion) => Nothingness.isVanished(champion))
      .map((champion) => champion.id);

    for (const id of ids) {
      if (!standing.includes(id)) {
        auraPassive.clearAura({ owner: { id }, context });
      }
    }

    owner.runtime[idsKey] = ids.filter(
      (id) => standing.includes(id) || vanishedIds.includes(id),
    );
    return standing;
  },

  refreshSoil({ owner, context }) {
    const fused = this.livingColossi({ owner, context }).reduce(
      (total, id) =>
        total + (context.allChampions.get(id).runtime.fusedStonewards ?? 0),
      0,
    );
    const count = this.livingSentinels({ owner, context }).length + fused;

    this.clearSoil({ owner });
    if (count === 0) return;

    owner.applyDamageReduction({
      amount: this.dmgReductionPerSentinel * count,
      duration: this.pseudoPermanentDurationTurns,
      type: "percent",
      source: this.dmgReductionSrc,
      context,
    });
  },

  clearSoil({ owner }) {
    owner.damageReductionModifiers = (
      owner.damageReductionModifiers ?? []
    ).filter((modifier) => modifier?.source !== this.dmgReductionSrc);
  },
};
