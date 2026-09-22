import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "blood_tide",
  name: "Blood Tide",

  meterThreshold: 56,
  meterGainTowardForm: 14,
  meterGainAwayFromForm: 10,

  offenseDeltas: {
    Attack: 45,
    Defense: -70,
    Speed: 10,
  },

  defensePortrait: "/assets/portraits/cassian.webp",
  offensePortrait: "/assets/portraits/cassian_offense.webp",

  description(champion) {
    const form =
      champion?.runtime?.cassianForm === "offense" ? "offense" : "defense";
    const meter = champion?.runtime?.cassianBloodMeter ?? 0;

    return {
      en: `Cassian is a hemomage: every hit he lands or takes fills his blood tide (currently <b>${meter}/${this.meterThreshold}</b>). Once it is full, his blood surges and flips his form, hardening into claws for a bout of <b>offense</b> or drawing back into a living, protective armor for <b>defense</b> — and the tide resets to turn him back once it fills again. He is currently in his <b>${form}</b> form.`,
      pt: `Cassian é um hemomago: cada golpe que dá ou recebe enche sua maré de sangue (atualmente <b>${meter}/${this.meterThreshold}</b>). Quando ela enche, seu sangue transborda e inverte sua forma, endurecendo em garras para um período de <b>ofensiva</b> ou recolhendo-se numa armadura viva e protetora de <b>defesa</b> — e a maré reseta para trazê-lo de volta quando enche de novo. Ele está atualmente em sua forma de <b>${form === "offense" ? "ofensiva" : "defesa"}</b>.`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onAfterDmgTaking: "defender",
  },

  onAfterDmgDealing({ attacker, actualDmg, owner, context }) {
    if (attacker !== owner) return;
    if (!(actualDmg > 0)) return;

    const headingToOffense = owner.runtime?.cassianForm !== "offense";
    const amount = headingToOffense
      ? this.meterGainTowardForm
      : this.meterGainAwayFromForm;

    return this._addMeter(owner, amount, context);
  },

  onAfterDmgTaking({ defender, actualDmg, owner, context }) {
    if (defender !== owner) return;
    if (!(actualDmg > 0)) return;

    const headingToDefense = owner.runtime?.cassianForm === "offense";
    const amount = headingToDefense
      ? this.meterGainTowardForm
      : this.meterGainAwayFromForm;

    return this._addMeter(owner, amount, context);
  },

  _addMeter(owner, amount, context) {
    owner.runtime ??= {};
    owner.runtime.cassianBloodMeter = (owner.runtime.cassianBloodMeter || 0) + amount;

    if (owner.runtime.cassianBloodMeter < this.meterThreshold) return;

    return this.flipForm(owner, context);
  },

  flipForm(owner, context) {
    owner.runtime ??= {};
    const enteringOffense = owner.runtime.cassianForm !== "offense";

    if (enteringOffense) {
      owner.runtime.cassianAppliedDeltas = {};
      for (const [statName, amount] of Object.entries(this.offenseDeltas)) {
        const { appliedAmount } = owner.modifyStat({
          statName,
          amount,
          isPermanent: true,
          ignoreMinimum: true,
          context,
          statModifierSrc: owner,
        });
        owner.runtime.cassianAppliedDeltas[statName] = appliedAmount;
      }
      owner.portrait = this.offensePortrait;
      owner.runtime.cassianForm = "offense";
    } else {
      const deltas = owner.runtime.cassianAppliedDeltas || {};
      for (const [statName, appliedAmount] of Object.entries(deltas)) {
        owner.modifyStat({
          statName,
          amount: -appliedAmount,
          isPermanent: true,
          ignoreMinimum: true,
          context,
          statModifierSrc: owner,
        });
      }
      owner.runtime.cassianAppliedDeltas = {};
      owner.portrait = this.defensePortrait;
      owner.runtime.cassianForm = "defense";
    }

    owner.runtime.cassianBloodMeter = 0;

    context?.registerDialog?.({
      message: enteringOffense
        ? {
            en: `${formatChampionName(owner)}'s blood surges outward, hardening into claws as he turns to offense!`,
            pt: `O sangue de ${formatChampionName(owner)} jorra para fora, endurecendo em garras enquanto ele vira para ofensiva!`,
          }
        : {
            en: `${formatChampionName(owner)} draws his blood back inward, reforming his living armor in defense!`,
            pt: `${formatChampionName(owner)} recolhe o sangue de volta, reformando sua armadura viva em defesa!`,
          },
      sourceId: owner.id,
      targetId: owner.id,
      duration: 1600,
    });

    return {
      log: {
        en: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} shifts into ${enteringOffense ? "offense" : "defense"}.`,
        pt: `[PASSIVA — ${this.name}] ${formatChampionName(owner)} muda para ${enteringOffense ? "ofensiva" : "defensiva"}.`,
      },
    };
  },
};
