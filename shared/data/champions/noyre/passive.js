import { SkillHits } from "../../../engine/combat/SkillHits.js";
import { formatChampionName } from "../../../ui/formatters.js";

function _processEntropy(owner, context, resolver, passive) {
  const { stacksCap, drainPunishPercent } = passive;
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
          message: {
            en: `<b>[Passive — Entropy]</b> ${formatChampionName(owner)} drained the <b>Momentum</b> of ${formatChampionName(enemy)}!`,
            pt: `<b>[Passivo — Entropia]</b> ${formatChampionName(owner)} drenou o <b>Momentum</b> de ${formatChampionName(enemy)}!`,
          },
          sourceId: owner.id,
          targetId: enemy.id,
        });
      }

      if (canUseMomentumSkill) {
        const dmg = Math.floor(enemy.maxHP * (drainPunishPercent / 100));

        const damageResult = SkillHits.run(passive, "punishment", {
          user: owner,
          target: enemy,
          baseDamage: dmg,
          context: { ...context, damageDepth: (context.damageDepth || 0) + 1 },
        });

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

  const { procs, results } = _processEntropy(owner, context, resolver, this);

  if (procs > 0) {
    return [
      {
        log: {
          en: `<b>[Passive — Entropy]</b> ${formatChampionName(owner)} unleashed <b>Entropy</b> <b>${procs}x</b>.`,
          pt: `<b>[Passivo — Entropia]</b> ${formatChampionName(owner)} desencadeou <b>Entropia</b> <b>${procs}x</b>.`,
        },
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

  hits: [
    {
      id: "punishment",
      label: "Entropy (Passive)",
      type: "magical",
      contact: false,
      damageMode: "piercing",
      piercingPercentage: 75,
    },
  ],

  description(champion) {
    const stacks = champion.runtime.entropyStacks || 0;

    return {
      en: `Nothing gathered near Noyre stays gathered. Whenever an enemy gains or spends <b>Momentum</b>, he accumulates <b>1</b> <b>Entropy</b>.

      <b>Current stacks: ${stacks}</b>

      Every <b>${this.stacksCap}</b> stacks, the accumulation comes undone: <b>1</b> unit of <b>Momentum</b> is stripped from every enemy, and those who held enough to unleash their ultimate are punished for it, taking <b>${this.drainPunishPercent}%</b> of their Max HP as <b>piercing damage</b>.`,
      pt: `Nada que se acumula perto de Noyre permanece acumulado. Sempre que um inimigo ganha ou gasta <b>Momentum</b>, ele acumula <b>1</b> de <b>Entropia</b>.

      <b>Entropia atual: ${stacks}</b>

      A cada <b>${this.stacksCap}</b> de <b>Entropia</b>, tudo se desfaz: <b>1</b> unidade de <b>Momentum</b> é removida de cada inimigo, e quem tinha o suficiente para desencadear seu ultimate é punido por isso, sofrendo <b>${this.drainPunishPercent}%</b> do seu HP Máximo como <b>dano perfurante</b>.`,
    };
  },

  hookScope: {
    onResourceGain: undefined,
    onResourceSpend: undefined,
  },

  onResourceGain: onResourceChanged,
  onResourceSpend: onResourceChanged,
};
