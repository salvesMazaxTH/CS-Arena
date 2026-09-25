import { formatChampionName } from "../../../ui/formatters.js";
import {
  CC_IMMUNE_AT,
  DAMAGE_CAP_AT,
  DAMAGE_CAP_PERCENT,
  MAX_PLATES,
  PLATE_TEXT_EN,
  PLATE_TEXT_PT,
  platesDue,
  platesShed,
  shedPlates,
} from "./plates.js";

export default {
  key: "nothing_follows",
  name: "Nothing Follows",

  description(champion) {
    const shed = platesShed(champion);

    return {
      en: `The foundry that made VØRN Ω went quiet a long time ago and every model before him is scrap, so there is nobody left who knows how to put him back together: he can never restore <b>HP</b> by any means, and his <b>Speed</b> cannot be reduced — whatever drives him turns at one fixed rate. What he can do is come apart usefully. Crossing <b>75%</b>, <b>50%</b> and <b>25%</b> of his Max HP throws off a governor plate for good, and he is worse to stand in front of for it. ${PLATE_TEXT_EN}

      <b>Plates shed:</b> ${shed}/${MAX_PLATES}`,
      pt: `A fábrica que fez o VØRN Ω calou-se há muito tempo e todo modelo anterior a ele virou sucata, então não sobrou ninguém que saiba montá-lo de volta: ele nunca pode restaurar <b>HP</b> por nenhum meio, e sua <b>Velocidade</b> não pode ser reduzida — o que quer que o mova gira num ritmo fixo. O que ele pode fazer é se despedaçar com proveito. Cruzar <b>75%</b>, <b>50%</b> e <b>25%</b> do seu HP Máximo arranca uma placa reguladora de vez, e ele fica pior de enfrentar por isso. ${PLATE_TEXT_PT}

      <b>Placas perdidas:</b> ${shed}/${MAX_PLATES}`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgTaking: "defender",
    onStatusEffectIncoming: "target",
    onStatModifierIncoming: "target",
    onBeforeHealing: "healTarget",
  },

  onStatModifierIncoming({ owner, statName, amount }) {
    if (statName !== "Speed" || amount >= 0) return;

    return {
      cancel: true,
      message: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} runs at the rate he was built to — his Speed holds.`,
    };
  },

  onBeforeHealing({ owner, amount, context }) {
    if (amount <= 0) return;

    context?.registerDialog?.({
      message: `<b>[Passive — ${this.name}]</b> there is no one left who knows how to mend ${formatChampionName(owner)} — nothing closes.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return { amount: 0 };
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onStatusEffectIncoming({ target, owner, statusEffect }) {
    if (target !== owner) return;
    if (platesShed(owner) < CC_IMMUNE_AT) return;
    if (!statusEffect?.subtypes?.includes("hardCC")) return;

    return {
      cancel: true,
      message: `${formatChampionName(target)} has nothing left for a Control effect to hold.`,
    };
  },

  onBeforeDmgTaking({ owner, defender }) {
    if (defender !== owner) return;
    if (platesShed(owner) < DAMAGE_CAP_AT) return;

    return { damageCap: (owner.maxHP * DAMAGE_CAP_PERCENT) / 100 };
  },

  onAfterDmgTaking({ owner, defender, actualDmg, context }) {
    if (defender !== owner) return;
    if (!(actualDmg > 0) || !owner.alive) return;

    const shedding = platesDue(owner) - platesShed(owner);
    if (shedding <= 0) return;

    const shed = shedPlates(owner, shedding, context);
    if (shed <= 0) return;

    context.registerDialog?.({
      message: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} throws off ${shed === 1 ? "a governor plate" : `${shed} governor plates`} — ${platesShed(owner)}/${MAX_PLATES} gone, and none of them are coming back.`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} sheds ${shed} plate(s) and answers to that much less.`,
    };
  },
};
