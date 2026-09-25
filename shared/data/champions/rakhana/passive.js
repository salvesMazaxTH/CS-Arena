import { formatChampionName } from "../../../ui/formatters.js";

export default {
  key: "silver_flow",
  name: "Silver Flow",

  maxStacks: 3,
  absoluteBonusPercent: 25,

  description(champion) {
    const stacks = champion.runtime?.silverFlowStacks || 0;

    return {
      en: `Whenever Rakhana deals damage to an enemy, she gains 1 <b>Flow</b> stack (Max: <b>${this.maxStacks}</b>).

      At <b>${this.maxStacks}</b> stacks, her next attack consumes all Flow: it lands as <b>Absolute Damage</b> for <b>${this.absoluteBonusPercent}%</b> more than the hit would otherwise deal through the target's defenses.

      <b>Current Flow: ${stacks}/${this.maxStacks}</b>`,
      pt: `Sempre que Rakhana causa dano a um inimigo, ela ganha 1 acúmulo de <b>Fluxo</b> (máx.: <b>${this.maxStacks}</b>).

      Com <b>${this.maxStacks}</b> acúmulos, seu próximo ataque consome todo o Fluxo: ele acerta como <b>dano Absoluto</b>, <b>${this.absoluteBonusPercent}%</b> maior do que o golpe causaria atravessando as defesas do alvo.

      <b>Fluxo atual: ${stacks}/${this.maxStacks}</b>`,
    };
  },

  hookScope: {
    onAfterDmgDealing: "attacker",
    onBeforeDmgDealing: "attacker",
  },

  onAfterDmgDealing({ owner, defender, damage }) {
    if (damage <= 0 || defender.team === owner.team) return;

    owner.runtime ??= {};

    const stacks = owner.runtime.silverFlowStacks || 0;

    if (stacks >= this.maxStacks) return;

    owner.runtime.silverFlowStacks = stacks + 1;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
          owner,
        )} gains 1 Flow (<b>${owner.runtime.silverFlowStacks}/${this.maxStacks}</b>).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(
          owner,
        )} ganha 1 Fluxo (<b>${owner.runtime.silverFlowStacks}/${this.maxStacks}</b>).`,
      },
    };
  },

  onBeforeDmgDealing({ owner, damage, bonusDamage }) {
    const stacks = owner.runtime?.silverFlowStacks || 0;

    if (stacks < this.maxStacks) return;

    owner.runtime.silverFlowStacks = 0;

    // `damage` is already past the target's defenses and includes any bonusDamage
    // rider, which is unreducible on its own and is re-added in composeDamage.
    // Amplify only the mitigated part, then pin preMitigationDamage so the
    // recompose keeps exactly this figure.
    const rider = bonusDamage || 0;
    const amplified = (damage - rider) * (1 + this.absoluteBonusPercent / 100);

    return {
      mode: "absolute",
      baseDamage: amplified,
      preMitigationDamage: amplified,
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
          owner,
        )} releases her accumulated Flow — the blow lands whole, <b>${this.absoluteBonusPercent}%</b> past what the target's defenses would have spared.`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(
          owner,
        )} libera todo o Fluxo acumulado — o golpe acerta por inteiro, <b>${this.absoluteBonusPercent}%</b> além do que as defesas do alvo teriam poupado.`,
      },
    };
  },
};