import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";
import { fixateOn } from "./passive.js";

const ronanSkills = [
  basicStrike,

  {
    key: "knuckle_flare",
    name: "Knuckle Flare",

    bf: 90,

    contact: true,
    damageMode: "standard",
    element: "fire",
    priority: 0,

    description() {
      return `Ronan throws a plain right hand and the air around it catches, because it always does. Deals Fire physical damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      return new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  {
    key: "say_that_again",
    name: "Say That Again",

    bf: 60,
    tauntDuration: 2,

    contact: true,
    damageMode: "standard",
    element: "fire",
    priority: 0,

    description() {
      return `Ronan picks the fight he wants instead of the one he was handed, and makes very sure the other one wants it too. Deals Fire physical damage and locks the two of them onto each other for ${this.tauntDuration} turn(s): any grudge he was already carrying is dropped, he Taunts himself onto this target instead, and they are left Taunted onto him.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      fixateOn(user, enemy, this.tauntDuration, context);

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? [...result] : [result];
      results.push(enemy.applyTaunt(user.id, this.tauntDuration, context));

      return results.filter(Boolean);
    },
  },

  {
    key: "ignisars_temper",
    name: "Ignisar's Temper",

    bf: 110,
    ragePercentAsBonus: 100,

    contact: true,
    damageMode: "standard",
    element: "fire",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `For as long as it takes to land one punch, Ronan stops being a man with dragon blood and is only the dragon. Deals Fire physical damage, plus bonus damage equal to ${this.ragePercentAsBonus}% of the Attack his temper has built up so far.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const rage = user.runtime.ronanRage ?? 0;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: (rage * this.ragePercentAsBonus) / 100,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      context.registerDialog({
        message: `${formatChampionName(user)} stops holding any of it back.`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return result;
    },
  },
];

export default ronanSkills;
