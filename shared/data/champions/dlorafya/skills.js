import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

// Every Burning D'Lorafya inflicts ticks for this multiple of a normal Burn.
export const DLORAFYA_BURN_DAMAGE_MULTIPLIER = 2;

const burnMetadata = { damageMultiplier: DLORAFYA_BURN_DAMAGE_MULTIPLIER };

const dlorafyaSkills = [
  // =========================
  // Total Block (global)
  // =========================
  totalBlock,

  // =========================
  // Special Abilities
  // =========================

  {
    key: "emberbrand_verdict",
    name: "Emberbrand Verdict",

    bf: 65,
    burningBonusBf: 30,
    burnDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 0,

    element: "fire",

    description() {
      return `Brands an enemy with divine fire, dealing Fire magical damage and applying Burning for ${this.burnDuration} turn(s). If the target is <b>already Burning</b>, this attack instead strikes with ${this.bf + this.burningBonusBf} power and refreshes their Burning. As the god of fire, his Burning takes even when the strike deals no damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const wasBurning = enemy.hasStatusEffect("burning");

      const effectiveBf = wasBurning ? this.bf + this.burningBonusBf : this.bf;
      const baseDamage = (user.Attack * effectiveBf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (
        effectConnected(result, "burning", { ignoreDamageRequirement: true }) &&
        enemy.alive
      ) {
        // Burning does not stack, so a refresh needs the old instance gone.
        if (wasBurning) enemy.removeStatusEffect("burning");
        enemy.applyStatusEffect(
          "burning",
          this.burnDuration,
          context,
          burnMetadata,
        );
      }

      return result;
    },
  },

  {
    key: "rite_of_the_rising_pyre",
    name: "Rite of the Rising Pyre",

    bf: 45,
    attackBuff: 30,
    attackBuffPerBurning: 10,
    defenseBuff: 15,
    buffDuration: 3,
    burnDuration: 2,

    contact: false,
    damageMode: "standard",
    priority: 0,

    element: "fire",

    description() {
      return `D'Lorafya kindles his own pyre: he deals Fire magical damage to an enemy, applies Burning for ${this.burnDuration} turn(s), then gains <b>+${this.attackBuff} Attack</b> and <b>+${this.defenseBuff} Defense</b> for ${this.buffDuration} turn(s). He gains an additional <b>+${this.attackBuffPerBurning} Attack</b> for each enemy currently Burning. As the god of fire, his Burning takes even when the strike deals no damage.`;
    },

    targetSpec: ["enemy", "self"],

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

      if (
        effectConnected(result, "burning", { ignoreDamageRequirement: true }) &&
        enemy.alive
      ) {
        if (enemy.hasStatusEffect("burning")) {
          enemy.removeStatusEffect("burning");
        }
        enemy.applyStatusEffect(
          "burning",
          this.burnDuration,
          context,
          burnMetadata,
        );
      }

      const burningEnemies = (context.aliveChampions ?? [])
        .filter(
          (champ) =>
            champ.team !== user.team && champ.hasStatusEffect("burning"),
        ).length;

      const attackGain =
        this.attackBuff + burningEnemies * this.attackBuffPerBurning;

      user.modifyStat({
        statName: "Attack",
        amount: attackGain,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      user.modifyStat({
        statName: "Defense",
        amount: this.defenseBuff,
        duration: this.buffDuration,
        context,
        statModifierSrc: user,
      });

      const results = Array.isArray(result) ? [...result] : [result];

      results.push({
        log:
          `${formatChampionName(user)}'s pyre rises: +${attackGain} Attack ` +
          `and +${this.defenseBuff} Defense for ${this.buffDuration} turn(s).`,
      });

      return results;
    },
  },

  {
    key: "cataclysm_of_the_divine_pyre",
    name: "Cataclysm of the Divine Pyre",

    bf: 120,
    reductedDamagePercent: 20,
    burnDuration: 2,

    isUltimate: true,
    momentumCost: 65,

    cannotBeEvaded: true,

    contact: false,
    damageMode: "standard",
    priority: 0,

    element: "fire",

    description() {
      return `A hurricane of divine fire engulfs the arena, dealing Fire magical damage to <b>ALL</b> characters except D'Lorafya himself, who is untouched by it. His <b>allies with Fire Affinity</b> are recognized by the flame and take only ${this.reductedDamagePercent}% damage. Every enemy struck is left Burning for ${this.burnDuration} turn(s), which takes even when the strike deals no damage. This attack cannot be evaded.`;
    },

    targetSpec: ["all"],

    resolve({ user, targets, context = {} }) {
      const baseDamage = (user.Attack * this.bf) / 100;

      const targetList = Array.isArray(targets)
        ? targets
        : targets
          ? [targets]
          : [];

      const results = [];

      for (const target of targetList) {
        if (!target?.alive) continue;
        if (target === user) continue;

        const affinities = target.elementalAffinities || [];
        const isSparedAlly =
          target.team === user.team && affinities.includes("fire");

        const finalBaseDamage = isSparedAlly
          ? baseDamage * (this.reductedDamagePercent / 100)
          : baseDamage;

        const result = new DamageEvent({
          baseDamage: finalBaseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const mainResult = Array.isArray(result) ? result[0] : result;

        if (Array.isArray(result)) {
          results.push(...result);
        } else if (result) {
          results.push(result);
        }

        const isEnemy = target.team !== user.team;

        if (
          isEnemy &&
          target.alive &&
          effectConnected(mainResult, "burning", { ignoreDamageRequirement: true })
        ) {
          if (target.hasStatusEffect("burning")) {
            target.removeStatusEffect("burning");
          }
          target.applyStatusEffect(
            "burning",
            this.burnDuration,
            context,
            burnMetadata,
          );
        }
      }

      return results;
    },
  },
];

export default dlorafyaSkills;
