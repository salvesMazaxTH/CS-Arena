import { DamageEvent } from "../../engine/combat/DamageEvent.js";
import { StatusEffect } from "../../core/StatusEffect.js";
import { formatChampionName } from "../../ui/formatters.js";
import {
  ageStackBatches,
  leadingStackSource,
  stackSources,
} from "../../core/stackLifetime.js";
import { deriveContext } from "../../engine/combat/deriveContext.js";

const poisoned = {
  key: "poisoned",
  name: "Poisoned",
  namePt: "Envenenado",
  type: "debuff",
  subtypes: ["dot", "magical", "poison"],
  isStackable: true,
  durationFromStacks: true,
  stackLifetime: 2,
  maxStacks: 12,

  onTurnStart({ owner, context }) {
    const stacks = this.stacks;
    const dmgPerStack = Math.floor(owner.maxHP * 0.04);
    // The tick stays attackerless, so nothing reacts to it as "dealt damage";
    // only the turn history learns who poisoned the target.
    // Each applier is credited for the stacks it put on the target.
    const sources = stackSources(this);
    const lead = leadingStackSource(sources);
    const dotContext = deriveContext(context, {
      isDot: true,
      dotSourceId: lead?.sourceId ?? this.sourceId ?? null,
      dotSourceTeam: lead?.sourceTeam ?? this.sourceTeam ?? null,
      dotSources: sources,
    });

    const result = new DamageEvent({
      attacker: null,
      defender: owner,
      skill: { name: "Poison", key: "poisoned_tick" },
      context: dotContext,
      type: "magical",
      element: "poison",
      baseDamage: dmgPerStack * stacks,
      mode: DamageEvent.Modes.ABSOLUTE,
      allChampions: context.allChampions,
    }).execute();

    if (ageStackBatches(this) === 0) this.expiresAtTurn = context.currentTurn;

    const label = formatChampionName(owner);

    if (result?.immune) {
      return {
        log: `${label} is immune to Poison damage!`,
      };
    }

    const dotSummary = `${label} takes ${result?.totalDamage ?? dmgPerStack * stacks} Poison damage (<b>${stacks}x</b>).`;

    // The pipeline's own damage line is dropped in favour of the stack-aware
    // summary; every entry after it comes from reactive hooks and is kept.
    const reactiveHookLogs = Array.isArray(result?.log)
      ? result.log.slice(1).filter(Boolean)
      : [];

    return { log: [dotSummary, ...reactiveHookLogs] };
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