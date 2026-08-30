import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const tyrenSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Passive
  // =========================
  // Living Metallurgy
  // =========================

  // =========================
  // Special Abilities
  // =========================

  {
    key: "mercurial_lance",
    name: "Mercurial Lance",

    bf: 75,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "steel",

    snareDuration: 2,

    description() {
      return `Tyren shapes his liquid steel into a piercing lance, dealing Steel magical damage. The metal then ensnares the target for ${this.snareDuration} turn.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      // The metal hardens and pins the target down even on a hit that did not
      // break skin.
      const hitSuccess = results.some((r) => effectConnected(r, "snared"));

      if (hitSuccess && enemy.alive) {
        enemy.applyStatusEffect("snared", this.snareDuration, context);
      }

      return results;
    },
  },

  {
    key: "living_steel_aegis",
    name: "Living Steel Aegis",

    contact: false,
    priority: 2,

    duration: 2,
    attackBonus: 60,
    defenseBonus: 20,
    speedMultiplier: 0.5,

    description() {
      return `Tyren transmutes his body into Living Steel for ${this.duration} turns.

        His Attack and Defense are inverted, then he gains +${this.attackBonus} Attack and +${this.defenseBonus} Defense. His Speed is reduced by ${Math.round((1 - this.speedMultiplier) * 100)}%.

        Living Steel Aegis cannot be used again while its effect is active.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.runtime ??= {};

      if (
        user.runtime.livingSteelAegisExpiresAtTurn != null &&
        context.currentTurn < user.runtime.livingSteelAegisExpiresAtTurn
      ) {
        return {
          log: `${formatChampionName(
            user,
          )} cannot use <b>Living Steel Aegis</b> while already under its effect.`,
        };
      }

      const originalAttack = user.Attack;
      const originalDefense = user.Defense;
      const originalSpeed = user.Speed;

      const transformedAttack = originalDefense + this.attackBonus;
      const transformedDefense = originalAttack + this.defenseBonus;
      const transformedSpeed = Math.floor(originalSpeed * this.speedMultiplier);

      user.runtime.livingSteelAegisExpiresAtTurn =
        context.currentTurn + this.duration;

      const statOpts = {
        duration: this.duration,
        context,
        statModifierSrc: user,
      };

      // Timed stat modifiers so the transformation rides the stat system and
      // reverts itself on expiry instead of being restored by hand.
      user.applyStatModifier({
        statName: "Attack",
        amount: transformedAttack - originalAttack,
        ...statOpts,
      });
      user.applyStatModifier({
        statName: "Defense",
        amount: transformedDefense - originalDefense,
        ...statOpts,
      });
      user.applyStatModifier({
        statName: "Speed",
        amount: transformedSpeed - originalSpeed,
        ...statOpts,
      });

      return {
        log:
          `<b>[${this.name}]</b> ${formatChampionName(user)} ` +
          `transmutes his body into Living Steel: ` +
          `Attack ${originalAttack} → ${user.Attack}, ` +
          `Defense ${originalDefense} → ${user.Defense}, ` +
          `Speed ${originalSpeed} → ${user.Speed}.`,
      };
    },
  },

  {
    key: "grand_metallic_transmutation",
    name: "Grand Metallic Transmutation",

    bf: 110,
    contact: false,
    damageMode: "standard",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    stunDuration: 1,
    empoweredPercent: 35,

    description() {
      return `Tyren unleashes a massive wave of living steel, dealing powerful Steel magical damage.

      If the target is under Crowd Control, the metal violently crystallizes around them, dealing an additional ${this.empoweredPercent}% of this ability's base damage as Absolute Damage and extending their current Crowd Control by ${this.stunDuration} turn.

      Otherwise, the target becomes Stunned for ${this.stunDuration} turn.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      const mainHit = results.find((r) => r?.targetId === enemy.id);

      if (!effectConnected(mainHit, "stunned") || !enemy.alive) return results;

      // Any active Crowd Control counts:
      // softCC or hardCC.
      const controlEffects = enemy.getStatusEffects({
        subtype: ["softCC", "hardCC"],
      });

      if (controlEffects.length > 0) {
        const activeControl = controlEffects[0];

        const bonusDamage = baseDamage * (this.empoweredPercent / 100);

        const bonusResult = new DamageEvent({
          baseDamage: bonusDamage,
          mode: DamageEvent.Modes.ABSOLUTE,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        results.push(
          ...(Array.isArray(bonusResult) ? bonusResult : [bonusResult]),
        );

        // Preserve the existing Crowd Control and extend
        // its expiration instead of replacing it with Stun.
        activeControl.expiresAtTurn += this.stunDuration;
      } else {
        // No Crowd Control: apply the default Stun.
        enemy.applyStatusEffect("stunned", this.stunDuration, context);
      }

      return results;
    },
  },
];

export default tyrenSkills;
