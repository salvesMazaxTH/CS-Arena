import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "glacial_omen",
  name: "Glacial Omen",
  chillDuration: 2,
  freezeDuration: 2,
  description() {
    return `The cold around Nythera answers for her. Whenever she is struck by a contact source (Absolute Damage excluded), the aggressor is left ❄️ Chilled for ${this.chillDuration} turn(s).

    If they are already Chilled, the frost closes in and they become Frozen for ${this.freezeDuration} turn(s) instead.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
  },

  onAfterDmgTaking({ attacker, owner, contact, damage, mode, context }) {
    if (damage <= 0 || attacker.team === owner.team) return;

    if (!contact || mode === DamageEvent.Modes.ABSOLUTE) return;

    // Do not stack with Stasis Chamber, which does the same thing, but better.
    if (
      owner.runtime?.hookEffects?.some(
        (effect) => effect.key === "stasis_chamber",
      )
    ) {
      console.log(
        `[PASSIVE — ${this.name}] ${formatChampionName(owner)} already has a hook effect applying "Frozen". Skipping the extra application.`,
      );
      return;
    }

    const alreadyFrozen = attacker.hasStatusEffect("frozen");
    const alreadyChilled = attacker.hasStatusEffect("chilled");

    if (alreadyFrozen) return;
    if (alreadyChilled) {
      attacker.applyStatusEffect("frozen", this.freezeDuration, context);
    } else {
      attacker.applyStatusEffect("chilled", this.chillDuration, context);
    }
  },
};
