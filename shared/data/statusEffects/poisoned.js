import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";

const poisoned = {
  key: "poisoned",
  name: "Poisoned",
  type: "debuff",
  subtypes: ["dot", "magical"],
  isStackable: true,
  durationFromStacks: true,

  onTurnStart({ owner, context }) {
    const stacks = this.stacks;
    const dmgPerStack = Math.floor(owner.maxHP * 0.04);
    const dotContext = { ...context, isDot: true };

    const result = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Poison", key: "poisoned_tick" },
      context: dotContext,
      type: "magical",
      baseDamage: dmgPerStack * stacks,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    }).execute();

    const next = stacks - 1;
    this.stacks = next;
    this.stackCount = next;

    if (next === 0) {
      this.expiresAtTurn = context.currentTurn;
    }

    const label = formatChampionName(owner);

    if (result?.immune) {
      return {
        log: `${label} is immune to Poison damage!`,
      };
    }

    const dotSummary = `${label} takes ${result?.totalDamage ?? dmgPerStack * stacks} Poison damage (<b>${stacks}x</b>).`;

    // resultBuilder always prepends two lines for isDot events:
    //   line 1 — "X takes N Poison damage"
    //   line 2 — "X's final HP: Y/Z"
    // Everything after those two lines are logs from reactive hooks.
    // We keep our custom stack-aware summary and append only those reactive logs.

    const resultLines =
      typeof result?.log === "string" ? result.log.split("\n") : [];

    const reactiveHookLogs = resultLines.slice(2).filter(Boolean).join("\n");

    return {
      log: reactiveHookLogs
        ? `${dotSummary}\n${reactiveHookLogs}`
        : dotSummary,
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

export default poisoned;