import { formatChampionName } from "../../../ui/formatters.js";
import {
  CC_IMMUNE_AT,
  DAMAGE_CAP_AT,
  DAMAGE_CAP_PERCENT,
  MAX_PLATES,
  PLATE_TEXT,
  platesDue,
  platesShed,
  shedPlates,
} from "./plates.js";

export default {
  key: "nothing_follows",
  name: "Nothing Follows",

  selfHealBlockDuration: 999,

  description(champion) {
    const shed = platesShed(champion);

    return `The foundry that made VØRN Ω went quiet a long time ago and every model before him is scrap, so there is nobody left who knows how to put him back together: he can never restore HP by any means. What he can do is come apart usefully. Crossing 75%, 50% and 25% of his Max HP throws off a governor plate for good, and he is worse to stand in front of for it. ${PLATE_TEXT}

    <b>Plates shed:</b> ${shed}/${MAX_PLATES}`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgTaking: "defender",
    onStatusEffectIncoming: "target",
  },

  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
    onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onChampionAdded({ champion, context }) {
    champion.applyStatusEffect("healBlock", this.selfHealBlockDuration, context, {
      source: this.key,
    });
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
