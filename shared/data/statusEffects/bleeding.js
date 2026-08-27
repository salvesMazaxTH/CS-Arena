import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

// A Bleeding stack is worth this fraction of the victim's Max HP; Drex's
// Bloodletting replays real Bleeding damage and reads it from here.
export const BLEEDING_DAMAGE_PER_STACK_RATIO = 0.04;

const bleeding = {
  key: "bleeding",
  name: "Bleeding",
  type: "debuff",
  subtypes: ["dot", "physical"],
  isStackable: true,
  durationFromStacks: true,

  onTurnStart({ owner, context }) {
    const stacks = this.stacks;
    const dmgPerStack = Math.floor(
      owner.maxHP * BLEEDING_DAMAGE_PER_STACK_RATIO,
    );
    const dotContext = { ...context, isDot: true };

    const result = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Bleeding", key: "bleeding_tick" },
      context: dotContext,
      type: "physical",
      baseDamage: dmgPerStack * stacks,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    }).execute();

    const next = stacks - 1;
    this.stacks = next;
    this.stackCount = next;
    if (next === 0) this.expiresAtTurn = context.currentTurn;

    const label = formatChampionName(owner);

    if (result?.immune) {
      return {
        log: `${label} is immune to Bleeding damage!`,
      };
    }

    return {
      log: `${label} takes ${result?.totalDamage ?? dmgPerStack * stacks} Bleeding damage (<b>${stacks}x</b>).`,
    };
  },

  createInstance({ owner, duration, context, metadata }) {
    const stacks = duration;
    return new StatusEffect({
      key: this.key,
      duration: stacks,
      owner,
      context,
      metadata: { ...metadata, stacks, stackCount: stacks },
      hooks: {
        name: this.name,
        type: this.type,
        subtypes: this.subtypes,
        isStackable: this.isStackable,
        stacks,
        stackCount: stacks,
        onTurnStart: this.onTurnStart,
      },
    });
  },
};

export default bleeding;
