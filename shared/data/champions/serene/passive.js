import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

export default {
  key: "grace_of_the_quietude",
  name: "Grace of the Quietude",
  healPercent: 15,
  description() {
    return {
      en: `When nothing reaches Serene, the Quietude reaches her. Whenever she ends a turn without having her <b>HP</b> reduced, she slips for a moment into that far, still place, and returns at the start of the next turn restored by <b>${this.healPercent}%</b> of her Max HP.`,
      pt: `Quando nada alcança Serene, é a Quietude que a alcança. Sempre que ela termina um turno sem ter seu <b>HP</b> reduzido, ela escorrega por um instante para aquele lugar distante e imóvel, e retorna no início do turno seguinte restaurada em <b>${this.healPercent}%</b> do seu HP máximo.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  // The Quietude only withholds itself for HP she actually lost, however it left her.
  hookPolicies: {
    onAfterDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
  },

  onAfterDmgTaking({ owner, actualDmg, context }) {
    if (!(actualDmg > 0)) return;

    owner.runtime.sereneDamagedTurn = context.currentTurn;
  },

  onActionResolved({ owner, actionSource, skill }) {
    if (actionSource !== owner) return;

    owner.runtime ??= {};
    owner.runtime.lastSereneSkillKey = skill?.key ?? null;
  },

  // Runs at the start of the turn.
  onTurnStart({ owner, context }) {
    const lastDamaged = owner.runtime.sereneDamagedTurn;

    // Did she take damage during the previous turn?
    if (lastDamaged === context.currentTurn - 1) return;

    const heal = owner.maxHP * (this.healPercent / 100);
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    const before = owner.HP;
    const applied = new HealEvent({
      target: owner,
      amount: heal,
      context,
    }).execute();

    return {
      log: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} restores ${applied} HP (${before} → ${owner.HP}).`,
    };
  },
};
