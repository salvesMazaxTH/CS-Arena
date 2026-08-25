import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";

const raliaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================

  {
    key: "iron_oath",
    name: "Iron Oath",
    bf: 60,
    damageMode: "standard",
    selfDamage: 10,
    defLoss: 30,
    atkBuff: 35,
    buffDuration: 2,
    contact: false,

    priority: 0,
    description() {
      return `Rália swears an oath in iron and blood, giving up ${this.defLoss} Defense and ${this.selfDamage} HP to gain +${this.atkBuff} Attack for ${this.buffDuration} turn(s). She then falls upon the chosen target, dealing physical damage.`;
    },
    targetSpec: ["self", "enemy"],
    resolve({ user, targets, context = {} }) {
      const userName = formatChampionName(user);

      // The oath is sworn in life rather than damage: it ignores shields and
      // never brings Rália below 1 HP. With nothing left to give, there is
      // no oath to swear and the skill fails.
      const hpCost = Math.min(this.selfDamage, user.HP - 1);

      if (hpCost <= 0) {
        context.registerDialog({
          message: `But it failed.`,
          sourceId: user.id,
          targetId: user.id,
        });

        return {
          log: `${userName} had no blood left to swear on. <b>Iron Oath</b> failed.`,
        };
      }

      user.modifyStat({
        statName: "Defense",
        amount: -this.defLoss,
        duration: this.buffDuration,
        context,
      });

      // The cost never goes through a DamageEvent, so it registers its own
      // visual event and dialog, or the HP loss lands on the client
      // unannounced — leaving the bar full while lifesteal heals on top of it.
      user.modifyHP(-hpCost, { context });

      context.registerDamage({
        target: user,
        amount: hpCost,
        rawAmount: hpCost,
        sourceId: user.id,
      });

      context.registerDialog({
        message: `${userName} swears the <b>Iron Oath</b> in her own blood!`,
        sourceId: user.id,
        targetId: user.id,
        duration: 1000,
      });

      user.modifyStat({
        statName: "Attack",
        amount: this.atkBuff,
        duration: this.buffDuration,
        context,
      });

      // Immediate follow-up attack.
      const enemy = targets.find((t) => t.id !== user.id);

      const selfLog = `${userName} swears the Iron Oath, giving up ${hpCost} HP and ${this.defLoss} Defense for +${this.atkBuff} Attack over ${this.buffDuration} turn(s).`;

      if (!enemy) {
        return { log: selfLog };
      }

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      results[0].log = selfLog + " " + results[0].log;

      return results;
    },
  },

  {
    key: "verdict_of_the_field",
    name: "Verdict of the Field",
    bf: 90,
    damageMode: "standard",
    hitVfx: "slash",
    healPercent: 60,
    minHeal: 25,
    contact: true,

    priority: 0,
    description() {
      return `Rália passes judgement with her blade, dealing physical damage to the chosen target and taking the sentence back as her own strength: she restores HP equal to ${this.healPercent}% of the effective damage dealt, never less than ${this.minHeal}.`;
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
      // `result` is an array whenever the hit drew a counter-attack or a
      // reflect; the strike on the chosen target is always the first entry.
      const results = Array.isArray(result) ? result : [result];
      const mainResult = results[0];

      const effectiveDamage = mainResult.totalDamage || 0;
      const healingAmount = Math.max(
        this.minHeal,
        Math.floor(effectiveDamage * (this.healPercent / 100)),
      );

      // Log what she actually recovered, which is less than she asked for when
      // the heal runs into her HP ceiling.
      const healed = user.heal(healingAmount, context);

      if (healed > 0) {
        // Extend the engine's log instead of replacing it.
        mainResult.log += `\n${formatChampionName(user)} restores ${healed} HP.`;
      }

      return results;
    },
  },

  {
    key: "decree_of_the_bastion",
    name: "Decree of the Bastion",
    bf: 50,
    damageMode: "piercing",
    hitVfx: "multislash",
    piercingPercentage: 75,

    atkDebuff: 20,
    debuffDuration: 2,
    bleedStacks: 2,

    contact: false,
    isUltimate: true,
    momentumCost: 55,

    priority: 0,
    description() {
      return `Rália drives her blade into the ground and lays down her law over the battlefield. For ${this.debuffDuration} turn(s), every active enemy suffers −${this.atkDebuff} Attack.

      She then sweeps the field, dealing piercing physical damage (${this.piercingPercentage}% piercing) to all living enemies and leaving ${this.bleedStacks} stacks of Bleeding in the wake of her edge.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets;

      // The Attack debuff lands before the damage.
      for (const enemy of enemies) {
        enemy.modifyStat({
          statName: "Attack",
          amount: -this.atkDebuff,
          duration: this.debuffDuration,
          context,
        });
      }

      const baseDamage = (user.Attack * this.bf) / 100;
      const results = [];

      for (const enemy of enemies) {
        const rawResult = new DamageEvent({
          baseDamage,
          mode: this.damageMode,
          piercingPercentage: this.piercingPercentage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const resultsArray = Array.isArray(rawResult) ? rawResult : [rawResult];
        const mainDamage = resultsArray[0];

        results.push(...resultsArray);

        const hitLanded =
          mainDamage &&
          mainDamage.evaded !== true &&
          mainDamage.immune !== true &&
          (mainDamage.totalDamage ?? 0) > 0;

        if (hitLanded) {
          enemy.applyStatusEffect(
            "bleeding",
            undefined,
            context,
            {},
            this.bleedStacks,
          );
        }
      }

      return results;
    },
  },
];

export default raliaSkills;
