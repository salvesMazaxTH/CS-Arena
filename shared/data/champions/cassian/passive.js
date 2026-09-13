import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "blood_tide",
  name: "Blood Tide",

  meterThreshold: 60,
  meterPerHitDealt: 10,
  meterPerHitTaken: 14,

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

    return `Cassian is a hemomage: every hit he lands or takes fills his blood tide (currently ${meter}/${this.meterThreshold}). Once it is full, his blood surges and flips his form, hardening into claws for a bout of offense or drawing back into a living, protective armor for defense — and the tide resets to turn him back once it fills again. He is currently in his ${form} form.`;
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onAfterDmgTaking: "defender",
  },

  onAfterDmgDealing({ attacker, actualDmg, owner, context }) {
    if (attacker !== owner) return;
    if (!(actualDmg > 0)) return;

    return this._addMeter(owner, this.meterPerHitDealt, context);
  },

  onAfterDmgTaking({ defender, actualDmg, owner, context }) {
    if (defender !== owner) return;
    if (!(actualDmg > 0)) return;

    return this._addMeter(owner, this.meterPerHitTaken, context);
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
        ? `${formatChampionName(owner)}'s blood surges outward, hardening into claws as he turns to offense!`
        : `${formatChampionName(owner)} draws his blood back inward, reforming his living armor in defense!`,
      sourceId: owner.id,
      targetId: owner.id,
      duration: 1600,
    });

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} shifts into ${enteringOffense ? "offense" : "defense"}.`,
    };
  },
};
