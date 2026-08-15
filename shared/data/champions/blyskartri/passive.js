import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";

export default {
  key: "unstoppable_progression",
  name: "Unstoppable Progression",
  stackCap: 8,
  speedPercentAsDamage: 0.85,

  description(champion) {
    return `Whenever Blyskartri or an ally gains Speed or Evasion, Blyskartri gains 1 stack of Impulse. Whenever Blyskartri evades an attack, he gains 1 additional stack. Max: ${this.stackCap}.

    Current Stacks: <b>${champion.runtime?.impulseStacks ?? 0}</b>

    At ${this.stackCap} stacks, consume all stacks to immediately deal 50% Hybrid Damage equal to ${this.speedPercentAsDamage * 100}% of the fastest ally's Speed to the enemy with the lowest HP.`;
  },

  hookScope: {
    onBuffingStat: undefined,
    onEvade: undefined,
  },

  onBuffingStat({ owner, statName, buffSrc, buffTarget, context }) {
    if (!buffSrc || buffSrc.team !== owner.team) return;
    if (!buffTarget || buffTarget.team !== owner.team) return;

    if (statName !== "Speed" && statName !== "Evasion") return;

    const stackResult = this._addStack({
      owner,
      context,
      reason: `${statName.toLowerCase()}_gain`,
    });

    if (stackResult?.log) return stackResult;

    return {
      log: `${formatChampionName(owner)} gained 1 Impulse stack. Current stacks: ${owner.runtime.impulseStacks}`,
    };
  },

  onEvade({ owner, defender, context }) {
    if (!defender || defender.team !== owner.team) return;

    const stackResult = this._addStack({
      owner,
      context,
      reason: "evade",
    });

    if (stackResult?.log) return stackResult;

    return {
      log: `${formatChampionName(owner)} gained 1 Impulse stack. Current stacks: ${owner.runtime.impulseStacks}`,
    };
  },

  _addStack({ owner, context, reason }) {
    owner.runtime ??= {};
    owner.runtime.impulseStacks ??= 0;

    if (owner.runtime.impulseStacks >= this.stackCap) return;

    owner.runtime.impulseStacks++;

    console.log("[BLYSKARTRI][PASSIVE] Impulse stack gained", {
      stacks: owner.runtime.impulseStacks,
      reason,
    });

    if (owner.runtime.impulseStacks < this.stackCap) return;

    const allies = context.aliveChampions.filter((c) => c.team === owner.team);

    if (!allies.length) return;

    const fastestAlly = allies.reduce((a, b) => (a.Speed > b.Speed ? a : b));

    console.log(
      "[BLYSKARTRI][PASSIVE] STACK CAP REACHED → dealing damage based on fastest ally:",
      {
        fastestAlly: formatChampionName(fastestAlly),
        allies: allies.map((a) => formatChampionName(a)),
      },
    );

    const damageAmount = Math.floor(
      fastestAlly.Speed * this.speedPercentAsDamage,
    );

    const enemies =
      context?.allChampions instanceof Map
        ? [...context.allChampions.values()].filter(
            (c) => c.team !== owner.team && c.HP > 0,
          )
        : [];

    const lowestHealthEnemy = enemies.reduce((a, b) => {
      if (a.HP < b.HP) return a;
      if (b.HP < a.HP) return b;

      // Tie → random
      return Math.random() < 0.5 ? a : b;
    }, enemies[0]);

    console.log("[BLYSKARTRI][PASSIVE] Lowest-HP enemy selected as target:", {
      lowestHealthEnemy: formatChampionName(lowestHealthEnemy),
      enemies: enemies.map((e) => formatChampionName(e)),
    });

    context.registerDialog({
      message: `${formatChampionName(owner)} unleashed a burst of speed, consuming all Impulse against ${formatChampionName(lowestHealthEnemy)}!`,
      sourceId: owner.id,
      targetId: owner.id,
    });

    const damageEvent = new DamageEvent({
      baseDamage: damageAmount,
      attacker: owner,
      defender: lowestHealthEnemy,
      mode: DamageEvent.Modes.PIERCING,
      piercingPercentage: 50, // Ignores 50% of the target's Defense
      skill: {
        key: "unstoppable_progression_explosion",
        contact: false,
      },
      type: "magical",
      context,
      allChampions: context?.allChampions,
    }).execute();

    owner.runtime.impulseStacks = 0;

    return {
      damageEvent,
      log: `${formatChampionName(owner)} unleashed a burst of speed, consuming all Impulse against ${formatChampionName(lowestHealthEnemy)}!`,
    };
  },
};
