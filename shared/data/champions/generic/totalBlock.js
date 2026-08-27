// Centralized Total Block (global)
import { formatChampionName } from "../../../ui/formatters.js";

const totalBlock = {
  key: "total_block",
  name: "Total Block",
  priority: 5,
  effectDuration: 1,
  description() {
    return `\n The champion braces completely: the next instance of damage taken is fully negated, along with every negative status effect this turn.`;
  },
  targetSpec: ["self"],
  resolve({ user, context = {} }) {
    user.runtime.hookEffects ??= [];
    user.runtime.totalBlockStreak ??= 0;

    // Checked on use, not at turn end: by then the effect is already gone.
    if (user.runtime.lastTotalBlockTurn !== context.currentTurn - 1) {
      user.runtime.totalBlockStreak = 0;
    }

    // Geometric progression, base 2: 100%, 50%, 25%, 12.5%, ...
    console.log(
      `[totalBlock debug] ${formatChampionName(user)} has a current streak of ${user.runtime.totalBlockStreak}.`,
    );
    const streak = user.runtime.totalBlockStreak;
    const chance = 1 / Math.pow(2, streak);
    const roll = Math.random();
    console.log(
      `[totalBlock debug] streak: ${streak}, chance: ${(chance * 100).toFixed(1)}%, roll: ${roll}`,
    );
    const success = roll < chance;

    if (!success) {
      user.runtime.totalBlockStreak = 0;

      const failMessage = `${formatChampionName(user)} tries to use <b>Total Block</b>, but fails.`;

      context.registerDialog?.({
        message: failMessage,
        sourceId: user.id,
        targetId: user.id,
      });

      return {
        log: failMessage,
      };
    }

    user.runtime.totalBlockStreak += 1;

    const effect = {
      key: "total_block_effect",
      group: "skill",

      expiresAtTurn: context?.currentTurn + this.effectDuration,

      hookScope: {
        onDamageIncoming: "defender",
        onStatusEffectIncoming: "target",
      },

      onDamageIncoming({ defender }) {
        // Remove the effect once the first instance of damage is negated.
        user.runtime.hookEffects = user.runtime.hookEffects.filter(
          (e) => e.key !== "total_block_effect",
        );
        return {
          cancel: true,
          immune: true,
          message: `${formatChampionName(defender)} blocks the attack with <b>Total Block</b>!`,
        };
      },

      onStatusEffectIncoming({ target, statusEffect }) {
        if (statusEffect.type !== "debuff") return;
        return {
          cancel: true,
          message: `${formatChampionName(target)} blocks a negative effect with <b>Total Block</b>!`,
        };
      },
    };

    user.runtime.hookEffects.push(effect);
    user.runtime.lastTotalBlockTurn = context.currentTurn;

    const successMessage = `${formatChampionName(user)} uses <b>Total Block</b> and is protected against the next attack!`;

    context.registerDialog?.({
      message: successMessage,
      sourceId: user.id,
      targetId: user.id,
    });

    return {
      log: successMessage,
    };
  },
};

export default totalBlock;
