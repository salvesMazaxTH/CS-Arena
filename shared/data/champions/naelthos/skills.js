import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const naelthosSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
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
      return `Naelthos calls a calm swell over the chosen target, dealing Water magical damage. The same tide then washes back over his most wounded ally, restoring ${this.healAmount} HP and carrying away every negative status effect clinging to them.`;
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
        new HealEvent({
          target: ally,
          amount: healAmount,
          context,
          source: user,
        }).execute();
        const debuffStatusEffects = ally.getStatusEffects({ type: "debuff" });

        debuffStatusEffects.forEach((statusEffect) => {
          ally.removeStatusEffect(statusEffect.key);
        });

        const userName = formatChampionName(user);
        const allyName = formatChampionName(ally);
        const purificationLog = debuffStatusEffects.length
          ? ` and purifies ${allyName} of ${debuffStatusEffects.length} negative effect(s)`
          : "";

        allyLog = `${userName} restores ${healAmount} HP to ${allyName}${purificationLog}. ${allyName} is now at ${ally.HP}/${ally.maxHP} HP.`;
      } else {
        const userName = formatChampionName(user);
        allyLog = `${userName} reaches for an ally to mend, but finds none.`;
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
      return `Naelthos comes apart into pure water, untargetable and untouchable for ${this.effectDuration} turn(s).

      The form breaks the moment he takes an action of his own, and a Lightning skill will find him even so — it interrupts the form, though the water spreads the blow and the damage is halved.`;
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
      user.runtime.form = "aquatic_form"; // Drives the visual effect.

      const userName = formatChampionName(user);
      return [
        {
          log: `${userName} dissolves into Aquatic Form, untargetable until turn ${currentTurn + this.effectDuration} — unless he acts first.`,
        },
      ];
    },
  },

  {
    key: "overflow_of_the_primordial_sea",
    name: "Overflow of the Primordial Sea",
    hpFactor: 55,
    hpDecayPerUse: 0.8,
    effectDuration: 3,
    hpPerStack: 45,
    bonusPerStack: 20,
    maxBonus: 400,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    momentumCost: 58,
    momentumCostPerUse: 12,
    momentumCostMax: 100,

    element: "water",

    priority: 0,
    description() {
      return `Naelthos opens the depths of the Primordial Sea and lets them rise through him: his Max HP swells by up to ${this.hpFactor}% of his base HP, and the same surge floods his current HP. Each invocation swells him less than the last.

      For ${this.effectDuration} turn(s), the Rising Sea carries every blow he lands: his attacks gain +${this.bonusPerStack} bonus damage for every ${this.hpPerStack} current HP, up to ${this.maxBonus}.`;
    },
    targetSpec: ["self"],

    // Each use scales down: the more times the Sea has been invoked, the less it swells him.
    getMomentumCost(champion) {
      const uses = champion.runtime?.primordialSeaUses ?? 0;
      return Math.min(
        this.momentumCost + this.momentumCostPerUse * uses,
        this.momentumCostMax,
      );
    },

    resolve({ user, context = {} }) {
      const { currentTurn } = context;

      const uses = (user.runtime.primordialSeaUses ??= 0);
      const factor = (this.hpFactor / 100) * this.hpDecayPerUse ** uses;

      const amount = user.baseHP * factor;

      user.modifyHP(amount, {
        context,
        affectMax: true,
        isPermanent: true,
      });

      user.runtime.primordialSeaUses = uses + 1;

      // Applies the damage modifier for the effect's duration (current turn included).
      user.addDamageModifier({
        id: "rising_sea",
        expiresAtTurn: currentTurn + this.effectDuration,

        apply: ({ baseDamage, attacker }) => {
          const stacks = Math.floor(attacker.HP / this.hpPerStack);
          const bonus = Math.min(stacks * this.bonusPerStack, this.maxBonus);

          return baseDamage + bonus;
        },
      });

      const userName = formatChampionName(user);
      return [
        {
          log: `${userName} invokes the Primordial Sea! Max HP increased; the <b>Rising Sea</b> carries his attacks for ${this.effectDuration} turn(s).`,
        },
      ];
    },
  },
];

export default naelthosSkills;
