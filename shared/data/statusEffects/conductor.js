import { StatusEffect } from "../../core/StatusEffect.js";
import { ElementalInteractions } from "../../engine/combat/ElementalInteractions.js";
import { hasElement } from "../../engine/combat/elements.js";

const conductor = {
  key: "conductor",
  name: "Conductor",
  namePt: "Condutor",
  type: "debuff",
  subtypes: ["damageMod", "lightning"],

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
  },

  onBeforeDmgTaking({ defender, damage, context, skill }) {
    if (!hasElement(skill.element, "lightning")) return;

    damage = Math.round(damage * 1.2);

    return { damage };
  },

  onAfterDmgTaking({ defender, damage, element, context }) {
    if (damage <= 0 || !hasElement(element, "water")) return;

    return ElementalInteractions.onConductorSoaked({ target: defender, context });
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
        onBeforeDmgTaking: this.onBeforeDmgTaking,
        onAfterDmgTaking: this.onAfterDmgTaking,
      },
    });
  },
};

export default conductor;