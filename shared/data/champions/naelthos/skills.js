import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const naelthosSkills = [
  // ========================
  // Total block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Skills
  // ========================
  {
    key: "touch_of_the_serene_tide",
    name: "Touch of the Serene Tide",
    bf: 75,
    healAmount: 30,
    damageMode: "standard",
    contact: false,

    priority: 0,
    element: "water",
    description() {
      return `Naelthos deals damage to the enemy. Then, heals the most injured ally for ${this.healAmount} HP and purifies them of all negative status effects.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;
      const healAmount = this.healAmount;

      const results = [];

      // 🗡️ Damage to enemy (if still alive)
      if (enemy) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
        const damageResults = Array.isArray(damageResult)
          ? damageResult
          : [damageResult];
        results.push(...damageResults);
      }
      let allyLog = "";
      let statLog = "";

      const moreInjuredAlly = context.aliveChampions
        .filter((champ) => champ.team === user.team)
        .sort((a, b) => a.HP / a.maxHP - b.HP / b.maxHP)[0];
      const ally = moreInjuredAlly || null;

      // 💧 Heal ally (if available)
      if (ally) {
        ally.heal(healAmount, context, user);
        const debuffStatusEffects = ally.getStatusEffects({ type: "debuff" });

        debuffStatusEffects.forEach((statusEffect) => {
          ally.removeStatusEffect(statusEffect.key);
        });

        const userName = formatChampionName(user);
        const allyName = formatChampionName(ally);
        const purificationLog = debuffStatusEffects.length
          ? ` and purifies ${allyName} of ${debuffStatusEffects.length} negative effect(s)`
          : "";

        allyLog = `${userName} heals ${allyName} for ${healAmount} HP${purificationLog}. Final HP of ${allyName}: ${ally.HP}/${ally.maxHP}`;

      } else {
        const userName = formatChampionName(user);
        allyLog = `${userName} attempted to heal an ally, but none are available.`;
      }

      results.push({
        log: `${allyLog} ${statLog}`,
      });

      return results;
    },
  },

  {
    key: "aquatic_form",
    name: "Aquatic Form",
    effectDuration: 2,
    contact: false,

    priority: 2,
    element: "water",
    description() {
      return `Transforms into pure water, becoming untargetable for ${this.effectDuration} turns. Can be interrupted if the user takes an action, or if targeted by a lightning skill (in which case, damage is halved).`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const { currentTurn } = context;

      user.runtime.hookEffects ??= [];

      const hookEffect = {
        key: "aquatic_form_hook",
        group: "skill",
        form: "aquatic_form",
        expiresAtTurn: currentTurn + this.effectDuration,
        hookScope: {
          onDamageIncoming: "defender",
          onStatusEffectIncoming: "target",
          onActionResolved: "actionSource",
        },
        onTurnStart({ owner, context }) {
          if (context.currentTurn < this.expiresAtTurn) return;
          owner.runtime.form = null;
        },
        onActionResolved({ actionSource, owner, skill }) {
          if (actionSource !== owner) return;
          if (skill?.key === "aquatic_form") return;
          owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
            (e) => e.key !== "aquatic_form_hook",
          );
          owner.runtime.form = null;
        },
        onDamageIncoming({ defender, damage, skill }) {
          if (skill?.element === "lightning") {
            defender.runtime.hookEffects = defender.runtime.hookEffects.filter(
              (e) => e.key !== "aquatic_form_hook",
            );
            defender.runtime.form = null;
            return {
              cancel: false,
              immune: false,
              modifiedDamage: damage / 2,
            };
          }
          return {
            cancel: true,
            immune: true,
            message: `${formatChampionName(defender)} is in Aquatic Form! It is untargetable and immune to damage!`,
          };
        },
        onStatusEffectIncoming({ target, statusEffect }) {
          if (statusEffect.type !== "debuff") return;
          return {
            cancel: true,
            immune: true,
            message: `${formatChampionName(target)} is in Aquatic Form! It is untargetable and immune to negative effects!`,
          };
        },
      };

      user.runtime.hookEffects.push(hookEffect);
      user.runtime.form = "aquatic_form"; // Para animação visual

      // Apply inert como status effect (interrompível por ação)
      /*       user.applyStatusEffect("inert", this.effectDuration, context, {
        canBeInterruptedByAction: true,
      });
 */
      const userName = formatChampionName(user);
      return [
        {
          log: `${userName} uses Aquatic Form! It is untargetable until turn ${currentTurn + this.effectDuration}. (Can be interrupted by the user's action).`,
        },
      ];
    },
  },

  {
    key: "overflow_of_the_primordial_sea",
    name: "Overflow of the Primordial Sea",
    hpFactor: 55,
    healAmount: 50,
    effectDuration: 3,
    hpPerStack: 30,
    bonusPerStack: 20,
    maxBonus: 500,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    momentumCost: 55,

    element: "water",

    priority: 0,
    description() {
      return `Increases max HP by ${this.hpFactor}% of base HP, restores ${this.healAmount} HP, and activates the Rising Sea effect: attacks gain a damage bonus (+${this.bonusPerStack} for every ${this.hpPerStack} current HP, up to ${this.maxBonus}) for ${this.effectDuration} turns.`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const { currentTurn } = context;
      // console.log("ULT EXECUTADA:", user.name, "TURNO:", currentTurn);

      const factor = this.hpFactor / 100;

      const amount = user.baseHP * factor;

      user.modifyHP(amount, {
        context,
        affectMax: true,
        isPermanent: true,
      });

      // 🔮 Applies damage modifier for 3 turns (including current)
      user.addDamageModifier({
        id: "rising_sea",
        expiresAtTurn: currentTurn + this.effectDuration,

        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.floor(attacker.HP / this.hpPerStack);
          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          const total = baseDamage + bonus;
          return total;
        },
      });

      const userName = formatChampionName(user);
      return [
        {
          log: `${userName} invokes the Primordial Sea! Maximum HP increased; "Rising Sea" effect active this and the next 2 turns.`,
        },
      ];
    },
  },
];

export default naelthosSkills;
