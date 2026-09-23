import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "glacial_omen",
  name: "Glacial Omen",
  chillDuration: 2,
  freezeDuration: 2,
  description() {
    return {
      en: `The cold around Nythera answers for her. Whenever she is struck by a <b>contact</b> source (<b>Absolute Damage</b> excluded), the aggressor is left ❄️ <b>Chilled</b> for <b>${this.chillDuration}</b> turn(s).

      If they are already <b>Chilled</b>, the frost closes in and they become <b>Frozen</b> for <b>${this.freezeDuration}</b> turn(s) instead.`,
      pt: `O frio ao redor de Nythera responde por ela. Sempre que é atingida por uma fonte de <b>contato</b> (<b>dano Absoluto</b> excluído), o agressor fica ❄️ <b>Gelado</b> por <b>${this.chillDuration}</b> turno(s).

      Se já estiver <b>Gelado</b>, o gelo se fecha sobre ele e passa a ficar <b>Congelado</b> por <b>${this.freezeDuration}</b> turno(s) em vez disso.`,
    };
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
