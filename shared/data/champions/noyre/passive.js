import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";

function _processEntropy(owner, context, resolver, stacksCap, drainPunishPercent) {
  let procs = 0;
  const results = [];

  while ((owner.runtime.entropyStacks || 0) >= stacksCap) {
    owner.runtime.entropyStacks -= stacksCap;
    procs++;

    const enemies = context.aliveChampions.filter((c) => c.team !== owner.team);

    for (const enemy of enemies) {
      if (!enemy.alive) continue;

      // Check whether they could afford their ultimate BEFORE draining.
      const canUseMomentumSkill =
        enemy.skills?.some((s) => s.isUltimate) &&
        enemy.momentum >=
          enemy.getSkillCost?.(enemy.skills.find((s) => s.isUltimate));

      const resourceChange = resolver.applyResourceChange({
        target: enemy,
        amount: -1,
        context,
        sourceId: owner.id,
        emitHooks: false,
        visualPhase: "entropy_drain",
        debugLabel: "noyre_entropy_drain",
      });

      const drained = Math.abs(resourceChange?.applied || 0);

      if (drained > 0 && context?.registerDialog) {
        context.registerDialog({
          message: `<b>[Passive — Entropy]</b> ${formatChampionName(owner)} drained the Momentum of ${formatChampionName(enemy)}!`,
          sourceId: owner.id,
          targetId: enemy.id,
        });
      }

      if (canUseMomentumSkill) {
        const dmg = Math.floor(enemy.maxHP * (drainPunishPercent / 100));

        const damageResult = new DamageEvent({
          baseDamage: dmg,
          attacker: owner,
          defender: enemy,
          skill: {
            key: "entropy_punishment",
            name: "Entropy (Passive)",
            contact: false,
          },
          context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
          allChampions: context.allChampions,
          mode: "piercing",
          piercingPercentage: 75,
          type: "magical",
        }).execute();

        if (Array.isArray(damageResult)) {
          results.push(...damageResult);
        } else if (damageResult) {
          results.push(damageResult);
        }
      }
    }
  }

  return { procs, results };
}

function _accumulateEntropy(owner) {
  owner.runtime.entropyStacks ??= 0;
  owner.runtime.entropyStacks += 1;
}

function onResourceChanged({ owner, target, amount, context, resolver }) {
  if (owner.team === target.team) return;
  if (amount <= 0) return;

  _accumulateEntropy(owner);

  const { procs, results } = _processEntropy(
    owner,
    context,
    resolver,
    this.stacksCap,
    this.drainPunishPercent,
  );

  if (procs > 0) {
    return [
      {
        log: `<b>[PASSIVE — Entropy]</b> ${formatChampionName(owner)} unleashed Entropy ${procs}x.`,
      },
      ...results,
    ];
  }
}

export default {
  key: "entropy",
  name: "Entropy",
  stacksCap: 7,
  drainPunishPercent: 15,

  description(champion) {
    const stacks = champion.runtime.entropyStacks || 0;

    return `Nothing gathered near Noyre stays gathered. Whenever an enemy gains or spends Momentum, he accumulates 1 Entropy.

    <b>Current stacks: ${stacks}</b>

    Every ${this.stacksCap} stacks, the accumulation comes undone: 1 unit of Momentum is stripped from every enemy, and those who held enough to unleash their ultimate are punished for it, taking ${this.drainPunishPercent}% of their Max HP as piercing damage.`;
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain: onResourceChanged,
  onResourceSpend: onResourceChanged,
};
