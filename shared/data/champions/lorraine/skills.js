import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import basicStrike from "../generic/basicStrike.js";
import { DUEL_CRIT_DURATION, declareDuel, turnsInDuel } from "./passive.js";

const lorraineSkills = [
  basicStrike,

  {
    key: "terms_of_the_duel",
    name: "Terms of the Duel",

    bf: 60,
    critDuringDuel: 10,
    critDuration: DUEL_CRIT_DURATION,

    ignoresTaunt: true,
    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Lorraine names the chosen target out loud, and from that moment nobody else on the field is worth the edge of her blade. Deals physical damage and moves her Duel onto them: she Taunts herself onto the chosen target and can answer nobody else until she names another one, and she gains +${this.critDuringDuel} Critical for ${this.critDuration} turn(s).`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      declareDuel(user, enemy, context);
      user.modifyStat({
        statName: "Critical",
        amount: this.critDuringDuel,
        duration: this.critDuration,
        context,
        isPermanent: false,
      });

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
    key: "irrefutable_thrust",
    name: "Irrefutable Thrust",

    bf: 90,
    freshDuelBonus: 30,
    bonusLostPerTurn: 10,
    bleedStacks: 1,

    contact: true,
    damageMode: "standard",
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `A duel her family would call proper is decided in the first exchange, and Lorraine has never had the patience for the other kind. Deals physical damage, +${this.freshDuelBonus}% on the turn she names the chosen target and ${this.bonusLostPerTurn}% less for every turn her Duel with them has dragged on since, and leaves them Bleeding with ${this.bleedStacks} stack(s).`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const turns = turnsInDuel(user, enemy, context);
      const bonus =
        turns === null
          ? 0
          : Math.max(0, this.freshDuelBonus - turns * this.bonusLostPerTurn);

      const result = new DamageEvent({
        baseDamage: ((user.Attack * this.bf) / 100) * (1 + bonus / 100),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedStacks, context, {
          sourceId: user.id,
          sourceName: user.name,
        });
      }

      return results;
    },
  },

  {
    key: "the_killing_pass",
    name: "The Killing Pass",

    bf: 125,
    extraCritChance: 25,
    openedWoundBonus: 30,
    bleedStacks: 2,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    targetSpec: ["enemy"],

    description() {
      return `Lorraine steps inside the measure one last time and closes the argument the way her family has always closed one. Deals physical damage with an extra ${this.extraCritChance}% chance of being a critical hit, +${this.openedWoundBonus}% more if the chosen target is already Bleeding, and leaves them Bleeding with ${this.bleedStacks} stack(s).`;
    },

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      const alreadyOpened = enemy.hasStatusEffect("bleeding");
      const forcedCrit = Math.random() * 100 < this.extraCritChance;

      const result = new DamageEvent({
        baseDamage:
          ((user.Attack * this.bf) / 100) *
          (alreadyOpened ? 1 + this.openedWoundBonus / 100 : 1),
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        critOptions: forcedCrit ? { force: true } : undefined,
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (effectConnected(results[0], "bleeding")) {
        enemy.applyStatusEffect("bleeding", this.bleedStacks, context, {
          sourceId: user.id,
          sourceName: user.name,
        });
      }

      return results;
    },
  },
];

export default lorraineSkills;
