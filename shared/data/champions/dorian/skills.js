import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const dorianSkills = [
  totalBlock,

  {
    key: "sawtooth_embrace",
    name: "Sawtooth Embrace",
    bf: 15,
    maxHPPercent: 12,
    concealedBf: 25,
    concealedMaxHPPercent: 20,
    contact: true,
    damageMode: "absolute",
    hitVfx: "slash",
    priority: 0,

    description() {
      return `Dorian folds both hollow wheels around the chosen target and draws them shut — a cut only his own hands make without losing themselves to the edge. Deals Absolute Damage equal to ${this.bf}% of his Attack plus ${this.maxHPPercent}% of the target's Max HP. Struck from concealment the wheels close harder — ${this.concealedBf}% of Attack plus ${this.concealedMaxHPPercent}% of Max HP — and stepping out of cover ends it.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const fromConcealment = user.hasStatusEffect("concealed");
      const bf = fromConcealment ? this.concealedBf : this.bf;
      const maxHPPercent = fromConcealment
        ? this.concealedMaxHPPercent
        : this.maxHPPercent;
      const baseDamage =
        (user.Attack * bf) / 100 + (enemy.maxHP * maxHPPercent) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: DamageEvent.Modes.ABSOLUTE,
        context,
        allChampions: context?.allChampions,
      }).execute();

      if (fromConcealment) {
        user.removeStatusEffect("concealed");
        context.registerDialog?.({
          message: `${formatChampionName(user)} strikes from concealment!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      return Array.isArray(result) ? result : [result];
    },
  },

  {
    key: "fourfold_severance",
    name: "Fourfold Severance",
    bf: 65,
    healBlockDuration: 2,
    concealDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,

    description() {
      return `Dorian sends both wheels wide on their wires, four hissing passes that open the chosen target before the wires reel him back out of sight. Deals ranged physical damage, afflicts the target with Heal Block for ${this.healBlockDuration} turns, and leaves Dorian Concealed until he next acts.`;
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

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((r) => r?.targetId === enemy.id);

      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      user.removeStatusEffect("concealed");
      user.applyStatusEffect("concealed", this.concealDuration, context, {
        source: this.key,
      });

      return results;
    },
  },

  {
    key: "wheel_of_reckoning",
    name: "Wheel of Reckoning",
    bf: 120,
    enchanterMaxHPPercent: 10,
    healBlockDuration: 2,
    killBankCap: 3,
    contact: false,
    damageMode: "standard",
    hitVfx: "multislash",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `The wires snap taut and every wheel comes round at once, the whole account brought down on the chosen target. Deals heavy ranged physical damage and leaves the target with Heal Block for ${this.healBlockDuration} turns. Against an enchanter it also bites for bonus Absolute Damage equal to ${this.enchanterMaxHPPercent}% of their Max HP. If the strike kills, Dorian's team scores points equal to his current Grudge, up to ${this.killBankCap}, and the ledger empties.`;
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

      const results = Array.isArray(result) ? result : [result];
      const mainHit = results.find((r) => r?.targetId === enemy.id);
      const landed = !!mainHit?.landed;

      if (effectConnected(mainHit, "healBlock")) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      if (landed && enemy.alive && enemy.classKey === "enchanter") {
        const bonus = Math.floor(
          (enemy.maxHP * this.enchanterMaxHPPercent) / 100,
        );

        if (bonus > 0) {
          const bonusResult = new DamageEvent({
            baseDamage: bonus,
            attacker: user,
            defender: enemy,
            skill: this,
            type: "physical",
            mode: DamageEvent.Modes.ABSOLUTE,
            context,
            allChampions: context?.allChampions,
          }).execute();

          results.push(
            ...(Array.isArray(bonusResult) ? bonusResult : [bonusResult]),
          );
        }

        context.registerDialog?.({
          message: `${formatChampionName(enemy)} is an enchanter — the wheels bite deeper.`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      const killed = results.some((r) => r?.targetId === enemy.id && r?.killed);

      if (killed) {
        const banked = Math.min(user.runtime.dorianGrudge ?? 0, this.killBankCap);

        if (banked > 0) {
          context.registerScore?.({
            amount: banked,
            scoringSlot: user.team - 1,
            reason: this.key,
            sourceId: user.id,
          });
          user.runtime.dorianGrudge = 0;

          context.registerDialog?.({
            message: `${formatChampionName(user)} closes the account in blood — ${banked} point(s) to his team.`,
            sourceId: user.id,
          });
        }
      }

      return results;
    },
  },
];

export default dorianSkills;
