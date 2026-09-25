import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";

const STABILITY_BURST_KEY = "morakhan_adamantine_stability_burst";

export default {
  key: "first_sutra_adamantine_heart",
  name: "First Sutra: Adamantine Heart",

  flatReductionVSPhysical: 25,
  standingReductionPercent: 10,
  reductionPerStack: 10,
  burstDmgMultiplier: 2,
  minDamageAfterFlatReduction: 5,
  stabilityStacksCap: 4,
  dmgBuffAuraDuration: 2,
  significantHitRatio: 0.35,

  description(champion) {
    const stacks = champion.runtime?.stabilityStacks || 0;

    return {
      en: `Morakhan takes <b>${this.standingReductionPercent}%</b> less damage (except <b>Absolute Damage</b>) and reduces damage taken from physical attacks by an additional <b>${this.flatReductionVSPhysical}</b>.

      Whenever he takes physical damage, he gains 1 <b>Stability</b> stack (Max: <b>${this.stabilityStacksCap}</b>). A <b>CLAIM</b>, taken in stillness, grants 1 stack as well.

      When a hit would deal more than <b>${this.significantHitRatio * 100}%</b> of his Max HP, he consumes all Stability stacks to reduce that damage by an additional <b>${this.reductionPerStack}%</b> per stack, then doubles his damage dealt for the next <b>${this.dmgBuffAuraDuration}</b> turns.

      While already at maximum Stability, the next stack he would gain — whether from a physical hit or a <b>CLAIM</b> — is spent immediately instead: no damage is reduced, but the doubling still triggers.

      <b>Current Stacks: ${stacks}</b>`,
      pt: `Morakhan sofre <b>${this.standingReductionPercent}%</b> menos dano (exceto <b>dano Absoluto</b>) e reduz o dano de ataques físicos em mais <b>${this.flatReductionVSPhysical}</b> pontos fixos.

      Sempre que sofre dano físico, ganha 1 acúmulo de <b>Estabilidade</b> (Máximo: <b>${this.stabilityStacksCap}</b>). Um <b>CLAIM</b>, feito em quietude, também concede 1 acúmulo.

      Quando um golpe causaria mais de <b>${this.significantHitRatio * 100}%</b> de seu HP Máximo, ele consome todos os acúmulos de Estabilidade para reduzir esse dano em mais <b>${this.reductionPerStack}%</b> por acúmulo, e então dobra seu dano causado pelos próximos <b>${this.dmgBuffAuraDuration}</b> turnos.

      Já no máximo de Estabilidade, o próximo acúmulo que ganharia — seja por um golpe físico ou por um <b>CLAIM</b> — é gasto na hora: nenhum dano é reduzido, mas a duplicação ainda é ativada.

      <b>Acúmulos atuais: ${stacks}</b>`,
    };
  },

  hookScope: {
    onBeforeDmgTaking: "defender",
    onAfterDmgTaking: "defender",
    onActionResolved: "actionSource",
  },

  // Empties Stability and arms the damage-doubling aura. Returns the summary line.
  consumeStability(owner, context, consumedStacks) {
    const passiveName = this.name;
    const dmgMultiplier = this.burstDmgMultiplier;

    owner.runtime.stabilityStacks = 0;

    owner.runtime.hookEffects ??= [];
    owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
      (effect) => effect.key !== STABILITY_BURST_KEY,
    );

    owner.addHookEffect(
      {
        type: "buff",
        key: STABILITY_BURST_KEY,
        name: "Empowered Adamantine Stability",
        // +1 so the aura covers dmgBuffAuraDuration full playable turns.
        expiresAtTurn: context.currentTurn + this.dmgBuffAuraDuration + 1,

        hookScope: {
          onBeforeDmgDealing: "attacker",
        },

        hookPolicies: {
          onBeforeDmgDealing: {
            allowOnDot: true,
            allowOnNestedDamage: true,
          },
        },

        onBeforeDmgDealing({ damage, attacker, skill, hitId }) {
          const isOwnCounter =
            skill?.key === "fourth_sutra_mountain_stance" &&
            hitId === "reflection";

          return {
            damage: damage * dmgMultiplier,
            log: {
              en: `<b>[Passive — ${passiveName}]</b> ${formatChampionName(
                attacker,
              )} doubles the damage dealt${
                isOwnCounter ? " by the counterattack" : ""
              }!`,
              pt: `<b>[Passiva — ${passiveName}]</b> ${formatChampionName(
                attacker,
              )} dobra o dano causado${
                isOwnCounter ? " pelo contra-ataque" : ""
              }!`,
            },
          };
        },
      },
      context,
    );

    const msg = {
      en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
        owner,
      )} consumed <b>${consumedStacks}</b> Stability stack(s)!`,
      pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(
        owner,
      )} consumiu <b>${consumedStacks}</b> acúmulo(s) de Estabilidade!`,
    };

    context.registerDialog({
      message: msg,
      sourceId: owner.id,
      targetId: owner.id,
    });

    return msg;
  },

  onActionResolved({ owner, skill, context }) {
    if (skill?.key !== CLAIM_ACTION_KEY) return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) {
      return { log: this.consumeStability(owner, context, stacks) };
    }

    runtime.stabilityStacks = stacks + 1;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(owner)} recites a sutra through the <b>CLAIM</b> and gains 1 Stability stack (<b>${runtime.stabilityStacks}/${this.stabilityStacksCap}</b>).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(owner)} recita um sutra através do <b>CLAIM</b> e ganha 1 acúmulo de Estabilidade (<b>${runtime.stabilityStacks}/${this.stabilityStacksCap}</b>).`,
      },
    };
  },

  onBeforeDmgTaking({ damage, context, owner, type }) {
    const stacks = owner.runtime?.stabilityStacks || 0;

    let finalDamage = damage;

    if (type === "physical") {
      // The floor is a minimum for what gets through, never a raise on a hit
      // that was already smaller than it.
      finalDamage = Math.min(
        finalDamage,
        Math.max(
          this.minDamageAfterFlatReduction,
          finalDamage - this.flatReductionVSPhysical,
        ),
      );
    }

    finalDamage *= 1 - this.standingReductionPercent / 100;

    // Measured against the post-mitigation figure, not the raw incoming hit.
    const isSignificantHit =
      finalDamage > owner.maxHP * this.significantHitRatio;

    if (!stacks || !isSignificantHit) {
      return { damage: finalDamage };
    }

    finalDamage *= 1 - (this.reductionPerStack / 100) * stacks;

    return {
      damage: finalDamage,
      log: this.consumeStability(owner, context, stacks),
    };
  },

  onAfterDmgTaking({ actualDmg, owner, type, context }) {
    if (!(actualDmg > 0) || type !== "physical") return;

    const runtime = (owner.runtime ??= {});
    const stacks = runtime.stabilityStacks || 0;

    if (stacks >= this.stabilityStacksCap) {
      return { log: this.consumeStability(owner, context, stacks) };
    }

    runtime.stabilityStacks = stacks + 1;

    return {
      log: {
        en: `<b>[Passive — ${this.name}]</b> ${formatChampionName(
          owner,
        )} gains 1 Stability stack (<b>${runtime.stabilityStacks}/${this.stabilityStacksCap}</b>).`,
        pt: `<b>[Passiva — ${this.name}]</b> ${formatChampionName(
          owner,
        )} ganha 1 acúmulo de Estabilidade (<b>${runtime.stabilityStacks}/${this.stabilityStacksCap}</b>).`,
      },
    };
  },
};
