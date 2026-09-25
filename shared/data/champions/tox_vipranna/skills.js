import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import basicStrike from "../generic/basicStrike.js";

const TOXIC_COATING_CLAIM_HEAL_KEY = "toxic_coating_claim_heal";

const toxViprannaSkills = [
  // ========================
  // Basic Attack
  // ========================
  basicStrike,

  // ========================
  // Special Skills
  // ========================

  // ========================
  // H1 — Venomous Tongue
  // ========================
  {
    key: "venomous_tongue",
    name: "Venomous Tongue",

    bf: 30,
    contact: true,
    damageMode: "standard",
    priority: 0,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Tox Vipranna lashes out with her venomous tongue, dealing light damage to the chosen enemy and inflicting <b>Poisoned</b>.

        • <b>4</b> stacks if the target is not yet <b>Poisoned</b>
        • <b>2</b> stacks if the target is already <b>Poisoned</b>`,
        pt: `Tox Vipranna ataca com sua língua venenosa, causando dano leve ao inimigo escolhido e infligindo <b>Envenenado</b>.

        • <b>4</b> acúmulos se o alvo ainda não estiver <b>Envenenado</b>
        • <b>2</b> acúmulos se o alvo já estiver <b>Envenenado</b>`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      const damageResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const damageArray = Array.isArray(damageResult)
        ? damageResult
        : [damageResult];

      results.push(...damageArray);

      const mainDamage = damageArray[0];

      // Poison seeps in through the pores; it does not need the strike to wound.
      if (effectConnected(mainDamage, "poisoned")) {
        const alreadyPoisoned = enemy.hasStatusEffect("poisoned");
        const stacks = alreadyPoisoned ? 2 : 4;

        enemy.applyStatusEffect(
          "poisoned",
          undefined,
          context,
          {},
          stacks,
        );
      }

      return results;
    },
  },

  // ========================
  // H2 — Toxic Coating
  // ========================
  {
    key: "toxic_coating",
    name: "Toxic Coating",

    contact: false,
    priority: 3,

    auraDuration: 2,
    poisonedStacks: 2,
    defenseBuff: 35,
    claimHeal: 25,

    targetSpec: ["self"],

    description() {
      return {
        en: `Tox Vipranna cloaks herself in a toxic coating for <b>${this.auraDuration}</b> turn(s), gaining <b>+${this.defenseBuff}</b> <b>Defense</b>.

        Enemies that land contact attacks against her are afflicted with <b>${this.poisonedStacks}</b> stacks of <b>Poisoned</b>.

        If she uses <b>CLAIM</b> while the coating still holds, she draws it back in and restores <b>${this.claimHeal}</b> <b>HP</b>.`,
        pt: `Tox Vipranna se envolve em uma camada tóxica por <b>${this.auraDuration}</b> turno(s), ganhando <b>+${this.defenseBuff}</b> de <b>Defesa</b>.

        Inimigos que a atingem com ataques de contato ficam com <b>${this.poisonedStacks}</b> acúmulos de <b>Envenenado</b>.

        Se ela usar <b>CLAIM</b> enquanto a camada ainda estiver ativa, ela a reabsorve e restaura <b>${this.claimHeal}</b> de <b>HP</b>.`,
      };
    },

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.auraDuration,
        context,
        statModifierSrc: user,
      });

      const activatedTurn = context.currentTurn;

      user.runtime.hookEffects ??= [];

      // --- Enemies that attack by contact are afflicted with Poisoned ---
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== "toxic_coating_retaliation",
      );

      user.addHookEffect({
        type: "buff",
        key: "toxic_coating_retaliation",
        expiresAtTurn: activatedTurn + this.auraDuration,
        poisonedStacks: this.poisonedStacks,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        onBeforeDmgTaking({ owner, attacker, contact, context }) {
          if (!contact) return;
          if (!attacker) return;

          attacker.applyStatusEffect(
            "poisoned",
            undefined,
            context,
            {},
            this.poisonedStacks,
          );

          return {
            log: `<b>[${this.name}]</b> ${formatChampionName(
              attacker,
            )} is afflicted with ${this.poisonedStacks} stacks of <b>Poisoned</b> after attacking ${formatChampionName(
              owner,
            )}.`,
          };
        },
      }, context);

      // Armed until the next CLAIM, then spent.
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (e) => e.key !== TOXIC_COATING_CLAIM_HEAL_KEY,
      );

      const claimHeal = this.claimHeal;

      user.addHookEffect({
        type: "buff",
        key: TOXIC_COATING_CLAIM_HEAL_KEY,
        group: "skill",
        expiresAtTurn: activatedTurn + this.auraDuration,

        hookScope: {
          onActionResolved: "actionSource",
        },

        onActionResolved({ owner, skill, context }) {
          if (skill?.key !== CLAIM_ACTION_KEY) return;

          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (e) => e.key !== TOXIC_COATING_CLAIM_HEAL_KEY,
          );

          const healed = new HealEvent({
            target: owner,
            amount: claimHeal,
            context,
          }).execute();

          if (healed <= 0) return;

          return {
            log: `<b>[Toxic Coating]</b> ${formatChampionName(owner)} draws the coating back in through the CLAIM, restoring ${healed} HP.`,
          };
        },
      }, context);

      context.registerDialog({
        message: `${formatChampionName(
          user,
        )} activates <b>Toxic Coating</b>!`,
        sourceId: user.id,
      });

      return {
        log: `${formatChampionName(
          user,
        )} activates <b>Toxic Coating</b>!`,
      };
    },
  },

  // ========================
  // Ultimate — Venomous Queen's Decree
  // ========================
  {
    key: "venomous_queen_decree",
    name: "Venomous Queen's Decree",

    contact: false,
    damageMode: "absolute",
    isUltimate: true,
    momentumCost: 55,

    damageRatioPerStack: 0.125,

    priority: 1,

    targetSpec: ["enemy"],

    description() {
      return {
        en: `Tox Vipranna forces the venom inside the chosen enemy to surge, doubling their <b>Poisoned</b> stacks before consuming them entirely.

        Deals <b>Absolute Damage</b> equal to <b>consumed stacks × ${this.damageRatioPerStack * 100}%</b> of the target's lost <b>HP</b>.`,
        pt: `Tox Vipranna força o veneno dentro do inimigo escolhido a se intensificar, dobrando os acúmulos de <b>Envenenado</b> antes de consumi-los por completo.

        Causa <b>Dano Absoluto</b> igual a <b>acúmulos consumidos × ${this.damageRatioPerStack * 100}%</b> do <b>HP</b> perdido do alvo.`,
      };
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      if (!enemy?.hasStatusEffect("poisoned")) {
        const failMessage = "But it failed.";

        context.registerDialog({
          message: failMessage,
          sourceId: user.id,
          targetId: enemy?.id ?? user.id,
        });

        return {
          log: failMessage,
        };
      }

      const poisonInstance = enemy.getStatusEffect("poisoned");
      const currentStacks = Number(poisonInstance.stacks) || 0;
      const consumedStacks = Math.max(1, currentStacks * 2);

      enemy.removeStatusEffect("poisoned");

      const lostHP = Math.max(0, enemy.maxHP - enemy.HP);
      const baseDamage = consumedStacks * this.damageRatioPerStack * lostHP;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
        mode: DamageEvent.Modes.ABSOLUTE,
      }).execute();

      return result;
    },
  },
];

export default toxViprannaSkills;