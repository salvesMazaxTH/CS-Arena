import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../basicShot.js";

const sereneSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },
  // ========================
  // Special Abilities
  // ========================

  {
    key: "harmonic_vow",
    name: "Harmonic Vow",
    shieldFull: 60,
    shieldReduced: 35,
    hpThreshold: 65,
    contact: false,

    priority: 2,
    description() {
      return `Serene sings a vow of harmony over the chosen ally, wrapping them in ${this.shieldFull} Shield. If her own HP is below ${this.hpThreshold}% of her Max HP, the vow falters and grants only ${this.shieldReduced}.`;
    },
    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally] = targets;

      let shieldAmount = this.shieldFull;

      if (user.HP < user.maxHP * (this.hpThreshold / 100)) {
        shieldAmount = this.shieldReduced;
      }

      ally.addShield(shieldAmount, 0, context);

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} grants ${shieldAmount} Shield to ${
          userName === allyName ? "herself" : allyName
        }.`,
      };
    },
  },

  {
    key: "sigil_of_quietude",
    name: "Sigil of the Quietude",
    hpDamagePercent: 15,
    stunDuration: 1,
    contact: false,
    damageMode: "piercing",
    piercingPercentage: 100,
    priority: 1, // buff: prio +1
    description() {
      return `Serene sets a sigil upon the chosen target and lets a sliver of the Quietude through it. Where that stillness touches, nothing moves and nothing mends: the target takes piercing damage (${this.piercingPercentage}% piercing) equal to ${this.hpDamagePercent}% of their Max HP and is left stunned for ${this.stunDuration} turn(s).

      No mind stays a stranger to that place for long. From the second consecutive use onward, the Stun only takes hold 50% of the time.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      user.runtime ??= {};
      const previousSkillKey = user.runtime.lastSereneSkillKey ?? null;
      user.runtime.sereneStreak ??= 0;

      console.debug(
        `[Serene:sigil_of_the_quietude] START turn=${context.currentTurn} execIdx=${context.executionIndex ?? "N/A"} user=${user.name} target=${enemy?.name} prevSkill=${previousSkillKey} prevStreak=${user.runtime.sereneStreak}`,
      );

      // Streak: counts consecutive uses of Serene's own skill.
      const isConsecutiveQuietudeUse = previousSkillKey === this.key;
      if (isConsecutiveQuietudeUse) {
        user.runtime.sereneStreak += 1;
      } else {
        user.runtime.sereneStreak = 1;
      }

      console.debug(
        `[Serene:sigil_of_the_quietude] STREAK turn=${context.currentTurn} consecutiveBySkill=${isConsecutiveQuietudeUse} streakNow=${user.runtime.sereneStreak}`,
      );

      const baseDamage = enemy.maxHP * (this.hpDamagePercent / 100);
      const result = new DamageEvent({
        baseDamage,
        piercingPercentage: this.piercingPercentage,
        mode: "piercing",
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Stun logic
      let stunSuccess = true;
      let stunRoll = null;
      if (user.runtime.sereneStreak > 1) {
        // 50% chance from the second consecutive use onward.
        stunRoll = Math.random();
        stunSuccess = stunRoll < 0.5;
      }

      console.debug(
        `[Serene:sigil_of_the_quietude] STUN_CHECK streak=${user.runtime.sereneStreak} roll=${stunRoll ?? "N/A"} success=${stunSuccess} evaded=${Boolean(result?.evaded)} immune=${Boolean(result?.immune)}`,
      );

      if (!result?.evaded && !result?.immune && stunSuccess) {
        const stunned = enemy.applyStatusEffect(
          "stunned",
          this.stunDuration,
          context,
        );
        console.debug(
          `[Serene:sigil_of_the_quietude] APPLY_STUN attempted=true applied=${Boolean(stunned)} target=${enemy?.name}`,
        );
        if (stunned && stunned.log && result?.log) {
          result.log += `\n${formatChampionName(enemy)} is drawn into the Quietude!`;
        } else if (stunned && stunned.log) {
          result.log = `${formatChampionName(enemy)} is drawn into the Quietude!`;
        }
      } else if (
        user.runtime.sereneStreak > 1 &&
        !result?.evaded &&
        !result?.immune
      ) {
        // The Stun roll failed.
        result.log =
          (result.log || "") +
          `\n${formatChampionName(enemy)} resists the Stun!`;
        console.debug(
          `[Serene:sigil_of_the_quietude] APPLY_STUN attempted=true applied=false reason=roll_failed target=${enemy?.name}`,
        );
      }

      console.debug(
        `[Serene:sigil_of_the_quietude] END turn=${context.currentTurn} streak=${user.runtime.sereneStreak} resultLogPresent=${Boolean(result?.log)}`,
      );

      return result;
    },
  },

  {
    key: "epiphany_of_the_threshold",
    name: "Epiphany of the Threshold",

    damageReduction: 30,
    reductionDuration: 2,
    surviveHP: 75,
    auraDuration: 2,
    immunityDuration: 1,

    contact: false,

    isUltimate: true,
    momentumCost: 66,

    priority: 4,

    description() {
      return `Serene crosses into the Quietude and stands at the Threshold of Existence, where the newly dead have not yet finished dying. What she carries back settles over her and her allies as ${this.damageReduction}% damage reduction for ${this.reductionDuration} turn(s).

      While that stillness lingers (${this.auraDuration} turn(s)), the first ally who would take lethal damage is held at the Threshold instead: they survive with ${this.surviveHP} HP and become Immune for ${this.immunityDuration} turn(s), spending the aura and dispelling it for the whole team.`;
    },

    targetSpec: ["self"],
    resolve({ user, context = {} }) {
      const ownerId = user.id;

      const allies = context.aliveChampions.filter((c) => c.team === user.team);

      const alreadyActive = allies.some((c) =>
        c.runtime.hookEffects?.some((e) => e.key === "epiphany_threshold"),
      );

      if (alreadyActive) {
        return {
          log: `${formatChampionName(user)} reaches for the Threshold, but it already stands open...`,
        };
      }

      allies.forEach((ally) => {
        ally.applyDamageReduction({
          amount: this.damageReduction,
          duration: this.reductionDuration,
          source: "epiphany",
          context,
        });

        ally.runtime.hookEffects ??= [];

        const surviveHP = this.surviveHP;

        const effect = {
          key: "epiphany_threshold",
          group: "epiphany",
          ownerId,
          expiresAtTurn: context.currentTurn + this.auraDuration,

          hookScope: {
            onBeforeDmgTaking: "defender",
          },

          onBeforeDmgTaking({ defender, owner, damage, context }) {
            if (!defender || defender.id !== owner.id || defender !== owner)
              return;

            // Not lethal: the Threshold stays shut.
            if (owner.HP - damage > 0) return;

            owner.runtime.preventFinishing = true;

            if (owner.hasStatusEffect("absoluteImmunity")) return;

            const lockedHP = surviveHP;

            const adjustedDamage = Math.max(owner.HP - lockedHP, 0);

            // Force the final HP value.
            owner.HP = Math.max(owner.HP - adjustedDamage, lockedHP);

            owner.applyStatusEffect("absoluteImmunity", 1, context, {
              source: "epiphany",
            });

            const allies = context.aliveChampions.filter(
              (c) => c.team === owner.team,
            );

            for (const champ of allies) {
              champ.runtime.hookEffects = champ.runtime.hookEffects.filter(
                (e) => e.key !== "epiphany_threshold",
              );
              delete champ.runtime.preventFinishing;
            }

            context.registerDialog({
              message: `${formatChampionName(owner)} is held at the Threshold, and death lets go!`,
              sourceId: owner.id,
              targetId: owner.id,
            });

            return {
              damage: adjustedDamage,
              log: `${formatChampionName(owner)} is drawn back from the Threshold, Immune and holding on with ${lockedHP} HP!`,
            };
          },
        };

        ally.runtime.hookEffects.push(effect);
      });

      return {
        log: `${formatChampionName(user)} crosses into the Quietude and reaches the Threshold of Existence. Her allies are wrapped in its stillness!`,
      };
    },
  },
];

export default sereneSkills;
