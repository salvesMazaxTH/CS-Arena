import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "eternalized_rock",
  name: "Eternalized Rock",
  maxStacks: 3,
  bonusPercent: 85, // bonus damage on the next ability
  piercingRatio: 0.4, // 40% of the damage becomes Piercing

  description() {
    return {
      en: `Every blow that lands on Theópetra only packs the old stone tighter: she gains <b>1</b> stack whenever she is struck, up to <b>${this.maxStacks}</b>. Once she reaches <b>${this.maxStacks}</b> stacks, her next ability deals <b>+${this.bonusPercent}%</b> bonus damage, with <b>${this.piercingRatio * 100}%</b> of it ignoring the target's Defense, then every stack is spent. Nothing moves her against her will — she is immune to crowd control.`,
      pt: `Cada golpe que acerta Theópetra só compacta ainda mais a pedra antiga: ela ganha <b>1</b> acúmulo sempre que é atingida, até o limite de <b>${this.maxStacks}</b>. Ao alcançar <b>${this.maxStacks}</b> acúmulos, sua próxima habilidade causa <b>+${this.bonusPercent}%</b> de dano bônus, com <b>${this.piercingRatio * 100}%</b> disso ignorando a Defesa do alvo, e todos os acúmulos são gastos em seguida. Nada a move contra a própria vontade — ela é imune a controle de grupo.`,
    };
  },

  hookScope: {
    onAfterDmgTaking: "defender",
    onBeforeDmgDealing: "attacker",
    onActionResolved: "actionSource",
    onStatusEffectIncoming: "target",
  },

  onAfterDmgTaking({ owner, actualDmg, context }) {
    if (!(actualDmg > 0)) return;

    owner.runtime = owner.runtime || {};

    const previous = owner.runtime.theopetraStacks || 0;
    if (previous >= this.maxStacks) return;

    owner.runtime.theopetraStacks = previous + 1;

    if (owner.runtime.theopetraStacks === this.maxStacks) {
      const message = `<b>[PASSIVE — ${this.name}]</b> ${formatChampionName(owner)} reached the maximum number of stacks (${this.maxStacks})! Her next ability will deal bonus damage.`;
      context.registerDialog({
        message,
        sourceId: owner.id,
        targetId: owner.id,
      });
      return { log: message };
    }

    return {
      log: `<b>[PASSIVE — ${this.name}]</b> ${formatChampionName(owner)} gained 1 stack (${owner.runtime.theopetraStacks}/${this.maxStacks}).`,
    };
  },

  onBeforeDmgDealing({ attacker, owner, skill, damage, baseDamage, context }) {
    if (attacker !== owner) return;

    if (
      !owner.runtime?.theopetraStacks ||
      owner.runtime.theopetraStacks < this.maxStacks
    )
      return;

    // Stay charged until the whole action resolves so every hit of a
    // multi-target ability is empowered; onActionResolved clears it.
    owner.runtime.theopetraEmpowerSpent = true;

    const raw = Number(baseDamage ?? damage ?? 0);
    const finalBaseDamage = raw * (1 + this.bonusPercent / 100);

    return {
      baseDamage: finalBaseDamage,
      preMitigationDamage: finalBaseDamage,
      piercingPercentage: this.piercingRatio * 100,
      mode: "piercing",
      log: `[PASSIVE — Eternalized Rock] ${formatChampionName(owner)} consumes all stacks and gains +${this.bonusPercent}% bonus damage on this ability!`,
    };
  },

  onActionResolved({ owner }) {
    if (!owner.runtime?.theopetraEmpowerSpent) return;

    owner.runtime.theopetraStacks = 0;
    owner.runtime.theopetraEmpowerSpent = false;
  },

  onStatusEffectIncoming({ target, statusEffect }) {
    if (!statusEffect?.subtypes) return;

    if (
      statusEffect.subtypes.includes("hardCC") ||
      statusEffect.subtypes.includes("softCC")
    ) {
      return {
        cancel: true,
        message: `${formatChampionName(target)} is immune to Control effects!`,
      };
    }
  },
};