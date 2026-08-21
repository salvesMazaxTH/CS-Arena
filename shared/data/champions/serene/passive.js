import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "grace_of_the_quietude",
  name: "Grace of the Quietude",
  healPercent: 15,
  description() {
    return `When nothing reaches Serene, the Quietude reaches her. Whenever she ends a turn without having her HP reduced, she slips for a moment into that far, still place, and returns at the start of the next turn restored by ${this.healPercent}% of her Max HP.`;
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  // Marks the turn in which damage was taken.
  onAfterDmgTaking({ owner, context }) {
    owner.runtime = owner.runtime || {};
    owner.runtime.sereneDamagedTurn = context.currentTurn;
  },

  onActionResolved({ owner, actionSource, skill, context }) {
    if (!actionSource || actionSource.id !== owner.id) return;

    owner.runtime ??= {};
    const previousSkillKey = owner.runtime.lastSereneSkillKey ?? null;
    owner.runtime.lastSereneSkillKey = skill?.key ?? null;

    console.debug(
      `[Serene:passive:onActionResolved] user=${owner.name} skill=${skill?.key ?? "N/A"} prevSkill=${previousSkillKey} nextSkill=${owner.runtime.lastSereneSkillKey} turn=${context?.currentTurn ?? "N/A"}`,
    );
  },

  // Runs at the start of the turn.
  onTurnStart({ owner, context }) {
    const lastDamaged = owner.runtime.sereneDamagedTurn;

    // Did she take damage during the previous turn?
    if (lastDamaged === context.currentTurn - 1) return;

    const heal = owner.maxHP * (this.healPercent / 100);
    if (heal <= 0 || owner.HP >= owner.maxHP) return;

    const before = owner.HP;
    owner.heal(heal, context);

    return {
      log: `[PASSIVE — ${this.name}] ${formatChampionName(owner)} restores ${heal} HP (${before} → ${owner.HP}).`,
    };
  },
};
