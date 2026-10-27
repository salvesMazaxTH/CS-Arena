import { formatChampionName } from "../../ui/formatters.js";
import { StatusEffect } from "../../core/StatusEffect.js";

const paralyzed = {
  key: "paralyzed",
  name: "Paralyzed",
  namePt: "Paralisado",
  type: "debuff",
  subtypes: ["softCC", "statMod", "lightning"],
  requiresDamage: true,

  hookScope: {
    onValidateAction: "actionSource",
  },

  onStatusEffectAdded({ owner, duration, context }) {
    owner.modifyStat({
      statName: "Speed",
      amount: -100,
      duration,
      context,
      isPercent: true,
      ignoreMinimum: true,
    });

    return {
      message: {
        en: `${formatChampionName(owner)} was Paralyzed! Speed reduced, but may still be unable to act!`,
        pt: `${formatChampionName(owner)} foi Paralisado! Velocidade reduzida, e ainda pode ficar sem agir!`,
      },
    };
  },

  onValidateAction({ actionSource }) {
    const chanceOfActing = 0.6;
    const roll = Math.random();

    console.log(
      `[PARALYZED] Rolling for ${formatChampionName(actionSource)}'s action (Paralyzed): ${roll.toFixed(2)} vs ${chanceOfActing}. Able to act? ${roll < chanceOfActing ? "Yes" : "No"}`,
    );

    if (roll >= chanceOfActing) {
      return {
        deny: true,
        message: {
          en: `${formatChampionName(actionSource)} is Paralyzed and cannot act!`,
          pt: `${formatChampionName(actionSource)} está Paralisado e não pode agir!`,
        },
      };
    }
  },

  createInstance({ owner, duration, context, metadata }) {
    return new StatusEffect({
      key: this.key,
      duration,
      owner,
      context,
      metadata,
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
        hookScope: this.hookScope,
        onStatusEffectAdded: this.onStatusEffectAdded,
        onValidateAction: this.onValidateAction,
      },
    });
  },
};

export default paralyzed;