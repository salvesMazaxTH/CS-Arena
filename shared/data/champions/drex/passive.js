import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "bloodthirst",
  name: "Bloodthirst",

  lsPerProc: 2,
  awakenThreshold: 43,
  lsTierSize: 6,
  dmgAmpPerTier: 4,
  piercingRatioPerTier: 2,
  dmgReductPerTier: 2,
  lsHealAmpPerTier: 5,

  permDmgModId: "drex_bloodthirst_scaling",
  dmgReductionSrc: "drex_bloodthirst_scaling",
  pseudoPermanentDurationTurns: 9999,

  description(champion) {
    const lifesteal = Number(champion?.LifeSteal || 0);
    const tiers = Math.max(0, Math.floor(lifesteal / this.lsTierSize));
    const awakened = champion?.runtime?.drexBloodAscension === true;
    const activeTiers = awakened ? tiers : 0;
    const damageAmp = activeTiers * this.dmgAmpPerTier;
    const piercing = Math.min(
      100,
      activeTiers * this.piercingRatioPerTier,
    );
    const damageReduction = activeTiers * this.dmgReductPerTier;
    const healingAmp = activeTiers * this.lsHealAmpPerTier;

    return {
      en: `Drex gains <b>+${this.lsPerProc}%</b> permanent <b>LifeSteal</b> whenever an ally applies <b>Bleeding</b> or whenever an enemy takes <b>Bleeding</b> damage.

      The first time Drex reaches <b>${this.awakenThreshold}%</b> LifeSteal, he enters permanent <b>Crimson Frenzy</b>.

      For every <b>${this.lsTierSize}%</b> LifeSteal, Drex gains <b>+${this.dmgAmpPerTier}%</b> bonus damage, converts <b>Standard Damage</b> into <b>Piercing Damage</b> with <b>${this.piercingRatioPerTier}%</b> Defense piercing, gains <b>${this.dmgReductPerTier}%</b> <b>Damage Reduction</b>, and restores <b>${this.lsHealAmpPerTier}%</b> more HP from LifeSteal.

      Current Bloodthirst: <b>${lifesteal}% LifeSteal</b> (${activeTiers} tier${activeTiers === 1 ? "" : "s"}).
      Current Crimson Frenzy bonuses: <b>+${damageAmp}% damage</b>, <b>${damageReduction}% Damage Reduction</b>, <b>+${healingAmp}% LifeSteal healing</b>, and <b>${piercing}% Defense piercing</b>.`,
      pt: `Drex ganha <b>+${this.lsPerProc}%</b> de <b>Roubo de Vida</b> permanente sempre que um aliado aplica <b>Sangramento</b> ou sempre que um inimigo sofre dano de <b>Sangramento</b>.

      Na primeira vez que Drex atinge <b>${this.awakenThreshold}%</b> de Roubo de Vida, ele entra em <b>Frenesi Carmesim</b> permanente.

      A cada <b>${this.lsTierSize}%</b> de Roubo de Vida, Drex ganha <b>+${this.dmgAmpPerTier}%</b> de dano bônus, converte <b>Dano Padrão</b> em <b>Dano Perfurante</b> com <b>${this.piercingRatioPerTier}%</b> de perfuração de Defesa, ganha <b>${this.dmgReductPerTier}%</b> de <b>Redução de Dano</b>, e restaura <b>${this.lsHealAmpPerTier}%</b> a mais de HP com o Roubo de Vida.

      Sede de Sangue atual: <b>${lifesteal}% de Roubo de Vida</b> (${activeTiers} ${activeTiers === 1 ? "nível" : "níveis"}).
      Bônus atuais de Frenesi Carmesim: <b>+${damageAmp}% de dano</b>, <b>${damageReduction}% de Redução de Dano</b>, <b>+${healingAmp}% de cura por Roubo de Vida</b>, e <b>${piercing}% de perfuração de Defesa</b>.`,
    };
  },

  hookScope: {
    onBeforeDmgDealing: "attacker",
    onBuffingStat: "buffTarget",
    onBeforeHealing: undefined,
  },

  hookPolicies: {
    onAfterDmgTaking: {
      allowOnDot: true,
      allowOnNestedDamage: true,
    },
  },

  onStatusEffectApplied({ source, statusEffectKey, owner, context }) {
    if (statusEffectKey !== "bleeding") return;
    if (!source || source.team !== owner.team) return;

    const result = owner.modifyStat({
      statName: "LifeSteal",
      amount: this.lsPerProc,
      context,
      isPermanent: true,
      ignoreMinimum: true,
      statModifierSrc: source,
    });

    if (!result?.appliedAmount) return;

    const logs = [
      {
        en: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} feeds on ${formatChampionName(source)}'s Bleeding (+${result.appliedAmount}% permanent LifeSteal).`,
        pt: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} se alimenta do Sangramento de ${formatChampionName(source)} (+${result.appliedAmount}% de Roubo de Vida permanente).`,
      },
    ];

    const awakenResult = this._tryAwaken({ owner, context });
    if (awakenResult?.log) logs.push(awakenResult.log);

    return {
      log: logs,
    };
  },

  onAfterDmgTaking({ defender, skill, owner, context }) {
    if (!context?.isDot) return;
    if (skill?.key !== "bleeding_tick") return;
    if (!defender || defender.team === owner.team) return;

    const result = owner.modifyStat({
      statName: "LifeSteal",
      amount: this.lsPerProc,
      context,
      isPermanent: true,
      ignoreMinimum: true,
      statModifierSrc: owner,
    });

    if (!result?.appliedAmount) return;

    const logs = [
      {
        en: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} feeds on ${formatChampionName(defender)}'s Bleeding (+${result.appliedAmount}% permanent LifeSteal).`,
        pt: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} se alimenta do Sangramento de ${formatChampionName(defender)} (+${result.appliedAmount}% de Roubo de Vida permanente).`,
      },
    ];

    const awakenResult = this._tryAwaken({ owner, context });
    if (awakenResult?.log) logs.push(awakenResult.log);

    return {
      log: logs,
    };
  },

  onBuffingStat({ owner, statName, buffTarget, context }) {
    if (statName !== "LifeSteal") return;

    const awakenResult = this._tryAwaken({ owner, context });

    if (!owner?.runtime?.drexBloodAscension) return awakenResult;

    const refreshResult = this._refreshDamageReduction({ owner, context });

    const logs = [];
    if (awakenResult?.log) logs.push(awakenResult.log);
    if (refreshResult?.log) logs.push(refreshResult.log);

    if (!logs.length) return;

    return {
      log: logs,
    };
  },

  onBeforeDmgDealing({ attacker, owner, mode }) {
    if (attacker !== owner) return;
    if (!owner?.runtime?.drexBloodAscension) return;
    if (mode && mode !== "standard") return;

    const tiers = Math.max(
      0,
      Math.floor(Number(owner?.LifeSteal || 0) / this.lsTierSize),
    );

    if (tiers <= 0) return;

    return {
      mode: "piercing",
      piercingPercentage: Math.min(
        100,
        tiers * this.piercingRatioPerTier,
      ),
    };
  },

  onBeforeHealing({ owner, healTarget, amount, isLifesteal }) {
    if (healTarget !== owner) return;
    if (!isLifesteal) return;
    if (!owner?.runtime?.drexBloodAscension) return;

    const tiers = Math.max(
      0,
      Math.floor(Number(owner?.LifeSteal || 0) / this.lsTierSize),
    );

    if (tiers <= 0) return;

    return {
      amount:
        amount *
        (1 + tiers * (this.lsHealAmpPerTier / 100)),
    };
  },

  _ensureDamageModifier(owner) {
    const alreadyHasModifier = owner
      .getDamageModifiers()
      .some((modifier) => modifier.id === this.permDmgModId);

    if (alreadyHasModifier) return;

    owner.addDamageModifier({
      id: this.permDmgModId,
      name: "Bloodthirst (Scaling)",
      permanent: true,

      apply: ({ baseDamage, attacker }) => {
        const tiers = Math.max(
          0,
          Math.floor(
            Number(attacker?.LifeSteal || 0) / this.lsTierSize,
          ),
        );

        if (tiers <= 0) return baseDamage;

        const bonusPercent = tiers * this.dmgAmpPerTier;

        return baseDamage * (1 + bonusPercent / 100);
      },
    });
  },

  _refreshDamageReduction({ owner, context }) {
    if (!owner || !context) return;

    owner.damageReductionModifiers =
      owner.damageReductionModifiers.filter(
        (modifier) => modifier?.source !== this.dmgReductionSrc,
      );

    const tiers = Math.max(
      0,
      Math.floor(Number(owner?.LifeSteal || 0) / this.lsTierSize),
    );

    const amount = tiers * this.dmgReductPerTier;

    if (amount <= 0) return;

    owner.applyDamageReduction({
      amount,
      duration: this.pseudoPermanentDurationTurns,
      type: "percent",
      source: this.dmgReductionSrc,
      context,
    });

    return {
      log: {
        en: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} recalibrates his defenses (${amount}% Damage Reduction).`,
        pt: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} recalibra suas defesas (${amount}% de Redução de Dano).`,
      },
    };
  },

  _tryAwaken({ owner, context }) {
    if (!owner) return;

    owner.runtime ??= {};

    if (owner.runtime.drexBloodAscension) return;
    if (Number(owner.LifeSteal || 0) < this.awakenThreshold) return;

    owner.runtime.drexBloodAscension = true;

    // Change portrait to Crimson Frenzy form
    owner.portrait = "/assets/portraits/drex_crimson_frenzy.webp";

    this._ensureDamageModifier(owner);
    this._refreshDamageReduction({ owner, context });

    context?.registerDialog?.({
      message: {
        en: `${formatChampionName(owner)} surpasses ${this.awakenThreshold}% LifeSteal and enters permanent <b>Crimson Frenzy</b>!`,
        pt: `${formatChampionName(owner)} ultrapassa ${this.awakenThreshold}% de Roubo de Vida e entra em <b>Frenesi Carmesim</b> permanente!`,
      },
      sourceId: owner.id,
      targetId: owner.id,
      duration: 1600,
    });

    return {
      log: {
        en: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} surpasses ${this.awakenThreshold}% LifeSteal and enters permanent Crimson Frenzy!`,
        pt: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} ultrapassa ${this.awakenThreshold}% de Roubo de Vida e entra em Frenesi Carmesim permanente!`,
      },
    };
  },
};
