import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { isFeiticeiro } from "./feiticeiro.js";
import totalBlock from "../generic/totalBlock.js";

const CONCEAL_DURATION = 2;

const dorianSkills = [
  totalBlock,

  {
    key: "sawtooth_embrace",
    name: "Sawtooth Embrace",
    bf: 50,
    concealedBonus: 40,
    contact: true,
    damageMode: "absolute",
    priority: 0,

    description() {
      return `Dorian folds both hollow wheels around the chosen target and draws them shut — a cut only his own hands make without losing themselves to the edge. Deals ${this.bf}% of his Attack as Absolute Damage. Struck from concealment the cut runs ${this.concealedBonus}% deeper, and stepping out of cover ends it.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      let baseDamage = (user.Attack * this.bf) / 100;

      const fromConcealment = user.hasStatusEffect("concealed");
      if (fromConcealment) baseDamage *= 1 + this.concealedBonus / 100;

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

      return result;
    },
  },

  {
    key: "fourfold_severance",
    name: "Fourfold Severance",
    bf: 65,
    healBlockDuration: 2,
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
      const landed = results.some(
        (r) => r?.targetId === enemy.id && !r?.evaded && !r?.immune,
      );

      if (landed) {
        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });
      }

      user.removeStatusEffect("concealed");
      user.applyStatusEffect("concealed", CONCEAL_DURATION, context, {
        source: this.key,
      });

      return results;
    },
  },

  {
    key: "wheel_of_reckoning",
    name: "Wheel of Reckoning",
    bf: 120,
    feiticeiroMaxHPPercent: 10,
    healBlockDuration: 2,
    killBankCap: 3,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `The wires snap taut and every wheel comes round at once, the whole account brought down on the chosen target. Deals heavy ranged physical damage. Against a feiticeiro it also bites for bonus Absolute Damage equal to ${this.feiticeiroMaxHPPercent}% of their Max HP and leaves them with Heal Block for ${this.healBlockDuration} turns. If the strike kills, Dorian's team scores points equal to his current Grudge, up to ${this.killBankCap}, and the ledger empties.`;
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
      const landed = results.some(
        (r) => r?.targetId === enemy.id && !r?.evaded && !r?.immune,
      );

      if (landed && isFeiticeiro(enemy)) {
        const bonus = Math.floor(
          (enemy.maxHP * this.feiticeiroMaxHPPercent) / 100,
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

        enemy.applyStatusEffect("healBlock", this.healBlockDuration, context, {
          source: this.key,
        });

        context.registerDialog?.({
          message: `${formatChampionName(enemy)} is a feiticeiro — the wheels bite deeper and the wounds will not close.`,
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
