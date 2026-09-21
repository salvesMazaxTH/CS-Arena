import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const tharoxSkills = [
  // ========================
  // Total block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================

  {
    key: "primeval_taunt",
    name: "Primeval Taunt",
    tauntDuration: 1,
    damageReductionAmount: 12,
    damageReductionDuration: 2,
    contact: false,
    priority: 3,
    description() {
      return {
        en: `Tharox draws the attention of all enemies to himself for <b>${this.tauntDuration}</b> turn(s), daring them to strike against his immovable bulk. He gains <b>${this.damageReductionAmount}%</b> <b>Damage Reduction</b> (except <b>Absolute Damage</b>) for <b>${this.damageReductionDuration}</b> turn(s). Consecutive uses have an exponentially lower chance of success (resets on failure or using another skill.)`,
        pt: `Tharox atrai a atenção de todos os inimigos para si por <b>${this.tauntDuration}</b> turno(s), desafiando-os a golpear sua massa imóvel. Ele ganha <b>${this.damageReductionAmount}%</b> de <b>Redução de Dano</b> (exceto <b>Dano Absoluto</b>) por <b>${this.damageReductionDuration}</b> turno(s). Usos consecutivos têm uma chance de sucesso exponencialmente menor (reinicia ao falhar ou ao usar outra habilidade.)`,
      };
    },

    targetSpec: ["self"],
    resolve({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        type: "percent",
        context,
      });

      user.runtime.tauntStreak ??= 0;
      const chance = 1 / Math.pow(3, user.runtime.tauntStreak);
      const sucess = Math.random() < chance;
      if (!sucess) {
        user.runtime.tauntStreak = 0;

        context.registerDialog({
          message: `But it failed.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${formatChampionName(user)} used <b>Primeval Taunt</b>, but it failed. Taunt Streak reset.`,
        };
      }

      if (!context.currentTurn) {
        throw new Error("Context must include currentTurn for Primeval Taunt.");
      }

      user.runtime.lastTauntTurn = context.currentTurn;
      user.runtime.tauntStreak += 1;

      const tauntLogs = [];

      const enemyChampions = Array.from(
        context?.allChampions?.values?.() || [],
      ).filter((c) => c.team !== user.team && c.alive);

      enemyChampions.forEach((enemy) => {
        tauntLogs.push(enemy.applyTaunt(user.id, this.tauntDuration, context));
      });

      const userName = formatChampionName(user);
      // Filter out falsy (e.g., if taunt not applied)
      const logs = tauntLogs.filter(Boolean);
      logs.unshift({
        log: `${userName} executed <b>Primeval Taunt</b>. All enemies were taunted and ${userName} gained ${this.damageReductionAmount}% Damage Reduction.`,
      });
      return logs;
    },
  },

  {
    key: "carapace_impact",
    name: "Carapace Impact",
    maxDefScaling: 80,
    minDefScaling: 35,
    noRiskPenaltyPercent: 20,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return {
        en: `Tharox crashes into the chosen target with the overwhelming weight of his stone-like frame, dealing damage equal to <b>${this.maxDefScaling}%</b> of his <b>Defense</b> at full health. The more wounded he becomes, the less force he can bring to bear — his devastating strength waning down to <b>${this.minDefScaling}%</b> as his colossal body begins to falter. If he has taken no damage this turn or the previous one, his own caution costs him <b>${this.noRiskPenaltyPercent}%</b> of that damage.`,
        pt: `Tharox se lança contra o alvo escolhido com o peso avassalador de seu corpo de pedra, causando dano igual a <b>${this.maxDefScaling}%</b> de sua <b>Defesa</b> quando está com vida cheia. Quanto mais ferido fica, menos força consegue empregar — seu poder devastador cai até <b>${this.minDefScaling}%</b> conforme seu corpo colossal começa a falhar. Se não sofreu dano neste turno nem no anterior, sua própria cautela lhe custa <b>${this.noRiskPenaltyPercent}%</b> desse dano.`,
      };
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const hpRatio = Math.max(0, Math.min(1, user.HP / user.maxHP));
      const defenseConversion =
        (this.minDefScaling +
          (this.maxDefScaling - this.minDefScaling) * hpRatio) /
        100;

      let baseDamage = user.Defense * defenseConversion;

      const lastHitTurn = user.runtime.tharoxLastHitTurn;
      const wasAtRisk =
        lastHitTurn === context.currentTurn ||
        lastHitTurn === context.currentTurn - 1;

      if (!wasAtRisk) {
        baseDamage *= 1 - this.noRiskPenaltyPercent / 100;
      }

      const result = new DamageEvent({
        attacker: user,
        baseDamage,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      return result;
    },
  },

  {
    key: "apotheosis_of_the_monolith",
    name: "Apotheosis of the Monolith",

    effectDuration: 2,
    defBonusWhileShielded: 20,
    healingUponShieldBreakPercent: 25,

    damageMode: "standard",
    contact: false,
    momentumCost: 58,
    isUltimate: true,
    priority: 2,

    description() {
      return {
        en: `Tharox unleashes the Apotheosis of the Monolith, becoming an immovable force of living stone for <b>${this.effectDuration}</b> turn(s). His immense frame hardens further, granting him a <b>SupremeShield</b> and +<b>${this.defBonusWhileShielded}</b> <b>Defense</b> while the shield endures.

        The power of the Monolith restores his strength as it manifests, healing him based on his bonus <b>Defense</b>. When the <b>SupremeShield</b> is broken, that stored power surges back through his body, restoring <b>HP</b> equal to <b>${this.healingUponShieldBreakPercent}%</b> of his bonus <b>Defense</b>.`,
        pt: `Tharox libera a Apoteose do Monólito, tornando-se por <b>${this.effectDuration}</b> turno(s) uma força inamovível de pedra viva. Seu corpo imenso se enrijece ainda mais, concedendo-lhe um <b>Escudo Supremo</b> e +<b>${this.defBonusWhileShielded}</b> de <b>Defesa</b> enquanto o escudo perdurar.

        O poder do Monólito restaura suas forças assim que se manifesta, curando-o proporcionalmente à sua <b>Defesa</b> bônus. Quando o <b>Escudo Supremo</b> se rompe, esse poder acumulado retorna com força por seu corpo, restaurando <b>HP</b> igual a <b>${this.healingUponShieldBreakPercent}%</b> de sua <b>Defesa</b> bônus.`,
      };
    },

    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      const userName = formatChampionName(user);
      const expiresAtTurn = context.currentTurn + this.effectDuration;

      // `this` inside a hookEffect is the hook, not the skill.
      const defBonusWhileShielded = this.defBonusWhileShielded;
      const healingUponShieldBreakPercent = this.healingUponShieldBreakPercent;

      // Remove any previous SupremeShield of the Apotheosis.
      if (Array.isArray(user.runtime?.shields)) {
        user.runtime.shields = user.runtime.shields.filter(
          (shield) => shield?.sourceId !== "apotheosis-of-the-monolith",
        );
      }

      // Remove any previous hook of the Apotheosis.
      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (hook) => hook.key !== "apotheosis-of-the-monolith",
      );

      // Register the state of the Apotheosis.
      user.runtime.apotheosisOfTheMonolith = {
        active: true,
        expiresAtTurn,
        defenseBonus: this.defBonusWhileShielded,
      };

      // +20 Defense while the effect is active.
      user.modifyStat({
        statName: "Defense",
        amount: this.defBonusWhileShielded,
        duration: this.effectDuration,
        context,
        isPermanent: false,
      });

      // Heal proportional to the current bonus Defense.
      const proportionalHeal = Math.max(0, user.Defense - user.baseDefense);

      if (proportionalHeal > 0) {
        new HealEvent({
          target: user,
          amount: proportionalHeal,
          context,
          source: user,
        }).execute();
      }

      // SupremeShield.
      user.addShield(1, 0, context, "supreme", {
        sourceId: "apotheosis-of-the-monolith",
        expiresAtTurn,
      });

      // Hook of the Apotheosis.
      user.addHookEffect({
        type: "buff",
        key: "apotheosis-of-the-monolith",
        name: "Apotheosis of the Monolith",
        expiresAtTurn,

        // ============================================================
        // BEFORE DAMAGE
        // ============================================================
        // Hook intended for interactions that need to observe the bonus
        // Defense of the Apotheosis before the damage is applied.
        hookScope: {
          onBeforeDmgTaking: "defender",
          onAfterDmgTaking: "defender",
        },

        onBeforeDmgTaking({ defender, context }) {
          if (defender !== user) return;

          const supremeShield = defender.runtime?.shields?.some(
            (shield) =>
              shield?.type === "supreme" &&
              shield?.sourceId === "apotheosis-of-the-monolith",
          );

          if (!supremeShield) return;

          const defenseBonus = defBonusWhileShielded;

          return {
            // Explicitly makes the bonus available for effects that
            // need to consult the Defense granted by the Apotheosis.
            defenseBonus,
            log: null,
          };
        },

        // ============================================================
        // AFTER DAMAGE
        // ============================================================
        // If the damage has just destroyed the SupremeShield, the healing occurs
        // immediately after that damage.
        onAfterDmgTaking({ defender, damage, context }) {
          if (defender !== user) return;
          if (damage <= 0) return;

          const supremeShield = defender.runtime?.shields?.some(
            (shield) =>
              shield?.type === "supreme" &&
              shield?.sourceId === "apotheosis-of-the-monolith",
          );

          if (supremeShield) return;

          // The shield was broken by damage.
          const state = defender.runtime.apotheosisOfTheMonolith;
          if (!state?.active) return;

          state.brokenByDamage = true;
          state.active = false;

          const healingAmount =
            Math.max(0, defender.Defense - defender.baseDefense) *
            (healingUponShieldBreakPercent / 100);

          if (healingAmount > 0) {
            new HealEvent({
              target: defender,
              amount: healingAmount,
              context,
              source: defender,
            }).execute();
          }

          defender.runtime.hookEffects = defender.runtime.hookEffects.filter(
            (hook) => hook.key !== "apotheosis-of-the-monolith",
          );

          return {
            log:
              `<b>[Apotheosis of the Monolith]</b> ${formatChampionName(defender)} ` +
              `lost the SupremeShield and healed ${Math.floor(healingAmount)} HP.`,
          };
        },

        // ============================================================
        // NATURAL EXPIRATION
        // ============================================================
        onTurnStart({ owner, context }) {
          if (context.currentTurn < this.expiresAtTurn) return;

          const state = owner.runtime.apotheosisOfTheMonolith;

          // If it was not broken by damage, the healing occurs at the start of the turn, right after the natural expiration.
          if (!state?.brokenByDamage) {
            const healingAmount =
              defBonusWhileShielded * (healingUponShieldBreakPercent / 100);

            if (healingAmount > 0) {
              new HealEvent({
                target: owner,
                amount: healingAmount,
                context,
                source: owner,
              }).execute();
            }
          }

          if (state) {
            state.active = false;
          }

          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (hook) => hook.key !== "apotheosis-of-the-monolith",
          );
        },
      }, context);

      return {
        log:
          `${userName} executed <b>Apotheosis of the Monolith</b>, ` +
          `unleashing his war form. ` +
          `Received +${this.defBonusWhileShielded} Defense while the SupremeShield was active ` +
          `and healed ${Math.floor(proportionalHeal)} HP. ` +
          `(Defense: ${user.Defense}, HP: ${user.HP}/${user.maxHP})`,
      };
    },
  },
];

export default tharoxSkills;
