import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
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

      const hitSuccess = results.some(
        (r) => r?.landed && (r?.totalDamage ?? 0) > 0,
      );

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
      return `Tyren transmutes his body into Living Steel for ${this.duration} turn.

        His Attack and Defense are inverted, then he gains +${this.attackBonus} Attack and +${this.defenseBonus} Defense. His Speed is reduced by ${Math.round((1 - this.speedMultiplier) * 100)}%.

        Living Steel Aegis cannot be used again while its effect is active.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.runtime ??= {};

      // Prevent recasting while the current transformation is active.
      if (user.runtime.livingSteelAegisActive) {
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

      // Store the exact pre-transformation values so the effect
      // can be completely reverted when it expires.
      user.runtime.livingSteelAegisActive = true;
      user.runtime.livingSteelAegisOriginalStats = {
        Attack: originalAttack,
        Defense: originalDefense,
        Speed: originalSpeed,
      };

      user.Attack = transformedAttack;
      user.Defense = transformedDefense;
      user.Speed = transformedSpeed;

      user.runtime.hookEffects ??= [];

      // Prevent duplicate hooks.
      user.runtime.hookEffects = user.runtime.hookEffects.filter(
        (effect) => effect.key !== "living_steel_aegis_expiration",
      );

      user.addHookEffect({
        type: "buff",
        subtypes: ["statMod"],
        key: "living_steel_aegis_expiration",
        name: "Living Steel Aegis",

        expiresAtTurn: context.currentTurn + this.duration,

        // No hookScope needed here: this event is already dispatched once per
        // champion by emitCombatEvent, and this hookEffect only ever lives on
        // its own owner's runtime.hookEffects — so it's inherently self-scoped.
        // A hookScope of "owner" would never match: the payload for
        // onTurnStart/onTurnEnd is just { context }, with no "owner" key to
        // compare against.
        //
        // Must be onTurnStart, not onTurnEnd: each turn, the server runs
        // onTurnStart hooks and *then* champion.purgeExpiredHookEffects(),
        // which silently drops any hookEffect once expiresAtTurn <= currentTurn
        // — without ever calling its handler. onTurnEnd only fires later, at
        // the end of that same turn, by which point the purge has already
        // deleted this effect, so the revert would never run. Checking on
        // onTurnStart (same pattern as Kai's living_ember_stance) lets the
        // revert execute before the purge can remove it.
        onTurnStart({ owner, context }) {
          if (context.currentTurn < this.expiresAtTurn) return;

          const originalStats = owner.runtime?.livingSteelAegisOriginalStats;

          if (originalStats) {
            owner.Attack = originalStats.Attack;
            owner.Defense = originalStats.Defense;
            owner.Speed = originalStats.Speed;
          }

          if (owner.runtime) {
            owner.runtime.livingSteelAegisActive = false;
            delete owner.runtime.livingSteelAegisOriginalStats;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (effect) => effect.key !== "living_steel_aegis_expiration",
            );
          }

          return {
            log: `<b>[${this.name}]</b> ${formatChampionName(
              owner,
            )}'s Living Steel transformation expires.`,
          };
        },
      }, context);

      return {
        log:
          `<b>[${this.name}]</b> ${formatChampionName(user)} ` +
          `transmutes his body into Living Steel: ` +
          `Attack ${originalAttack} → ${transformedAttack}, ` +
          `Defense ${originalDefense} → ${transformedDefense}, ` +
          `Speed ${originalSpeed} → ${transformedSpeed}.`,
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

      if (!enemy.alive) return results;

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
