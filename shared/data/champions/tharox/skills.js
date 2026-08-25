import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const tharoxSkills = [
  // ========================
  // Total block (global)
  // ========================
  totalBlock,
  // ========================
  // Habilidades Especiais
  // ========================

  {
    key: "primeval_taunt",
    name: "Primeval Taunt",
    tauntDuration: 1,
    damageReductionAmount: 10,
    damageReductionDuration: 2,
    contact: false,
    priority: 3,
    description() {
      return `Tharox draws the attention of all enemies to himself for ${this.tauntDuration} turn(s), daring them to strike against his immovable bulk. He gains ${this.damageReductionAmount} Damage Reduction for ${this.damageReductionDuration} turn(s). Consecutive uses have an exponentially lower chance of success (resets on failure or using another skill.)`;
    },

    targetSpec: ["self"],
    resolve({ user, targets, context = {} }) {
      user.applyDamageReduction({
        amount: this.damageReductionAmount,
        duration: this.damageReductionDuration,
        context,
      });

      user.runtime.tauntStreak ??= 0;
      /* console.log(
        `[Skill - Primeval Taunt] ${user.name} used Primeval Taunt. Current Taunt Streak: ${user.runtime.tauntStreak}`,
      );
      */
      const chance = 1 / Math.pow(3, user.runtime.tauntStreak); // Chance diminui exponencialmente a cada uso
      const sucess = Math.random() < chance;
      /* console.log(
        `[Skill - Primeval Taunt] ${user.name} attempted Primeval Taunt. Chance: ${chance}, Success?: ${sucess}`,
      );
      */
      if (!sucess) {
        user.runtime.tauntStreak = 0; // Reset streak se a provocação for mal-sucedida

        context.registerDialog({
          message: `But it failed.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${formatChampionName(user)}  <b>Primeval Taunt</b>. But failed. Taunt Streak reset.`,
        };
      }

      user.runtime.lastTauntTurn = context.currentTurn;

      if (!context.currentTurn) {
        throw new Error("Context must include currentTurn for Primeval Taunt.");
      }

      // if it was successful, increment the tauntStreak for the next attempt
      user.runtime.tauntStreak += 1;
      /* console.log(
        `[Skill - Primeval Taunt] ${user.name} used Primeval Taunt. Current Taunt Streak: ${user.runtime.tauntStreak}`,
      );
      */
      // Get all active champions on the opposing team

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
        log: `${userName} executed <b>Primeval Taunt</b>. All enemies were taunted and ${userName} gained ${this.damageReductionAmount} Damage Reduction.`,
      });
      return logs;
    },
  },

  {
    key: "carapace_impact",
    name: "Carapace Impact",
    bf: 0,
    damageMode: "standard",
    contact: true,
    priority: 0,
    description() {
      return `Tharox crashes into the enemy with the overwhelming weight of his stone-like frame, dealing damage equal to ${this.defScaling}% of his Defense. The more wounded he becomes, the less force he can bring to bear — his devastating strength waning as his colossal body begins to falter.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const hpRatio = Math.max(0, Math.min(1, user.HP / user.maxHP));

      let defenseConversion;

      if (hpRatio > 0.75) {
        // 75%–100% HP: 95% → 80%
        defenseConversion =
          0.80 + 0.15 * ((hpRatio - 0.75) / 0.25);
      } else if (hpRatio > 0.50) {
        // 50%–75% HP: 80% → 65%
        defenseConversion =
          0.65 + 0.15 * ((hpRatio - 0.50) / 0.25);
      } else if (hpRatio > 0.25) {
        // 25%–50% HP: 65% → 50%
        defenseConversion =
          0.50 + 0.15 * ((hpRatio - 0.25) / 0.25);
      } else {
        // 0%–25% HP: 50% → 40%
        defenseConversion =
          0.40 + 0.10 * (hpRatio / 0.25);
      }

      const baseDamage = user.Defense * defenseConversion;

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
      return `Tharox unleashes the Apotheosis of the Monolith, becoming an immovable force of living stone for ${this.effectDuration} turn(s). His immense frame hardens further, granting him a SupremeShield and +${this.defBonusWhileShielded} Defense while the shield endures.

      The power of the Monolith restores his strength as it manifests, healing him based on his bonus Defense. When the SupremeShield is broken, that stored power surges back through his body, restoring HP equal to ${this.healingUponShieldBreakPercent}% of his bonus Defense.`;
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
        user.heal(proportionalHeal, context, user);
      }

      // SupremeShield.
      user.addShield(1, 0, context, "supreme", {
        sourceId: "apotheosis-of-the-monolith",
        expiresAtTurn,
      });

      // Hook of the Apotheosis.
      user.runtime.hookEffects.push({
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
            defender.heal(healingAmount, context, defender);
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
              owner.heal(healingAmount, context, owner);
            }
          }

          if (state) {
            state.active = false;
          }

          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (hook) => hook.key !== "apotheosis-of-the-monolith",
          );
        },
      });

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
