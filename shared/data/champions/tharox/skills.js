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
      return `Taunts all enemies for ${this.tauntDuration} turn(s) and gains ${this.damageReductionAmount} Damage Reduction for ${this.damageReductionDuration} turn(s). Consecutive uses have an exponentially lower chance of success (resets on failure or using another skill.)`;
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

      // se foi bem-sucedida, incrementa a tauntStreak para a próxima tentativa
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
    bf: 75,
    damageMode: "standard",
    defScaling: 15,
    contact: true,
    priority: 0,
    description() {
      return `Deals damage to the chosen target plus ${this.defScaling}% of Defense.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage =
        (user.Attack * this.bf) / 100 + user.Defense * (this.defScaling / 100);
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
    defDamagePercent: 38,
    healingUponShieldBreakPercent: 25,

    damageMode: "standard",
    contact: false,
    momentumCost: 55,
    isUltimate: true,
    priority: 2,

    description() {
      return `Unleashes the Apotheosis of the Monolith, restoring HP based on his bonus Defense and assuming his immovable form for ${this.effectDuration} turn(s). Gains SupremeShield for the duration of the effect.
      
      While the shield is active, Tharox gains +${this.defBonusWhileShielded} Defense. Upon losing the shield, he restores HP equal to ${this.healingUponShieldBreakPercent}% of his bonus Defense. Additionally, his attacks deal extra damage based on his bonus Defense, scaling increasingly and becoming devastating at high levels.`;
    },

    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      const userName = formatChampionName(user);
      const expiresAtTurn = context.currentTurn + this.effectDuration;

      // Remove eventual efeito anterior da Apoteose.
      user.damageModifiers = user
        .getDamageModifiers()
        .filter((mod) => mod.id !== "apotheosis-of-the-monolith");

      // Remove eventual SupremeShield anterior da Apoteose.
      if (Array.isArray(user.runtime?.shields)) {
        user.runtime.shields = user.runtime.shields.filter(
          (shield) => shield?.sourceId !== "apotheosis-of-the-monolith",
        );
      }

      // Remove eventual hook anterior da Apoteose.
      user.runtime.hookEffects ??= [];
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (hook) => hook.key !== "apotheosis-of-the-monolith",
      );

      // Registra o estado da Apoteose.
      user.runtime.apotheosisOfTheMonolith = {
        active: true,
        expiresAtTurn,
        defenseBonus: this.defBonusWhileShielded,
      };

      // +20 Defesa enquanto o efeito estiver ativo.
      user.modifyStat({
        statName: "Defense",
        amount: this.defBonusWhileShielded,
        duration: this.effectDuration,
        context,
        isPermanent: false,
      });

      // Cura proporcional à Defesa bônus atual.
      const proportionalHeal = Math.max(0, user.Defense - user.baseDefense);

      if (proportionalHeal > 0) {
        user.heal(proportionalHeal, context, user);
      }

      // SupremeShield.
      user.addShield(1, 0, context, "supreme", {
        sourceId: "apotheosis-of-the-monolith",
        expiresAtTurn,
      });

      // Hook da Apoteose.
      user.runtime.hookEffects.push({
        key: "apotheosis-of-the-monolith",
        name: "Apotheosis of the Monolith",
        expiresAtTurn,

        // ============================================================
        // ANTES DO DANO
        // ============================================================
        // Hook destinado às interações que precisam observar a Defesa
        // bônus da Apoteose antes que o dano seja aplicado.
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

          const defenseBonus = this.defBonusWhileShielded;

          return {
            // Disponibiliza explicitamente o bônus para efeitos que
            // precisem consultar a Defesa concedida pela Apoteose.
            defenseBonus,
            log: null,
          };
        },

        // ============================================================
        // DEPOIS DO DANO
        // ============================================================
        // Se o dano acabou de destruir o SupremeShield, a cura ocorre
        // imediatamente após esse dano.
        onAfterDmgTaking({ defender, damage, context }) {
          if (defender !== user) return;
          if (damage <= 0) return;

          const supremeShield = defender.runtime?.shields?.some(
            (shield) =>
              shield?.type === "supreme" &&
              shield?.sourceId === "apotheosis-of-the-monolith",
          );

          if (supremeShield) return;

          // O shield foi quebrado por dano.
          const state = defender.runtime.apotheosisOfTheMonolith;
          if (!state?.active) return;

          state.brokenByDamage = true;
          state.active = false;

          const healingAmount =
            Math.max(0, defender.Defense - defender.baseDefense) *
            (this.healingUponShieldBreakPercent / 100);

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
        // EXPIRAÇÃO NATURAL
        // ============================================================
        onTurnStart({ owner, context }) {
          if (context.currentTurn < this.expiresAtTurn) return;

          const state = owner.runtime.apotheosisOfTheMonolith;

          // Se não foi quebrado por dano, a cura ocorre no início do turno, logo depois da expiração natural.
          if (!state?.brokenByDamage) {
            const healingAmount = this.defBonusWhileShielded * 0.25;

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

      // =================================
      // BÔNUS DE DANO
      //=================================
      user.addDamageModifier({
        id: "apotheosis-of-the-monolith",
        name: "Apotheosis of the Monolith Bonus Damage",
        expiresAtTurn,

        apply: ({ baseDamage, attacker }) => {
          const baseDef = attacker.baseDefense;
          const bonusDef = Math.max(0, attacker.Defense - baseDef);

          const linear = bonusDef * 0.7;

          const scaling =
            (Math.pow(bonusDef, 1.4) * this.defDamagePercent) / 100;

          return baseDamage + linear + scaling;
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
