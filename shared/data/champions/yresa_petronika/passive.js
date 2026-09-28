import { Nothingness } from "../../../engine/combat/nothingness.js";
import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "soilbound_oath",
  name: "Soilbound Oath",

  wardedStatusKeys: ["rooted", "snared"],
  dmgReductionPerSentinel: 5,
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

  // Catches the revert: the transform dropped the soil and nothing else re-grants it.
  onTurnStart({ owner, context }) {
    this.grantSoil({ owner, context });
  },

  // A stone away in the Nothingness took its soil along; the return brings it back.
  onChampionReturned({ owner, champion, context }) {
    if (champion === owner || this._isOwnStone(owner, champion)) {
      this.grantSoil({ owner, context });
    }
  },

  _isOwnStone(owner, champion) {
    return [
      ...(owner.runtime.sentinelIds ?? []),
      ...(owner.runtime.colossusIds ?? []),
    ].includes(champion.id);
  },

  livingColossi({ owner, context }) {
    return this._standing({ owner, context, idsKey: "colossusIds" });
  },

  livingSentinels({ owner, context }) {
    return this._standing({ owner, context, idsKey: "sentinelIds" });
  },

  // A stone off the field is dropped, but one away in the Nothingness stays hers.
  _standing({ owner, context, idsKey }) {
    const ids = owner.runtime[idsKey] ?? [];
    const standing = ids.filter(
      (id) => context?.allChampions?.get?.(id)?.alive === true,
    );
    const vanishedIds = (context?.matchChampions ?? [])
      .filter((champion) => Nothingness.isVanished(champion))
      .map((champion) => champion.id);

    owner.runtime[idsKey] = ids.filter(
      (id) => standing.includes(id) || vanishedIds.includes(id),
    );
    return standing;
  },

  // One record per stone, sustained by it, so each fall or vanish takes only its share.
  grantSoil({ owner, context }) {
    const stoneIds = [
      ...this.livingSentinels({ owner, context }),
      ...this.livingColossi({ owner, context }),
    ];

    for (const id of stoneIds) {
      const held = owner.damageReductionModifiers?.some(
        (m) => m?.source === this.dmgReductionSrc && m.sustainedById === id,
      );
      if (held) continue;

      const stone = context.allChampions.get(id);
      owner.applyDamageReduction({
        amount: this.dmgReductionPerSentinel * (stone.runtime.fusedStonewards ?? 1),
        type: "percent",
        source: this.dmgReductionSrc,
        sustainedById: id,
        context,
      });
    }
  },

  clearSoil({ owner }) {
    owner.damageReductionModifiers = (
      owner.damageReductionModifiers ?? []
    ).filter((modifier) => modifier?.source !== this.dmgReductionSrc);
  },
};
