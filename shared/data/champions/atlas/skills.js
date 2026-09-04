import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../generic/totalBlock.js";

const atlasSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "gravitic_reckoning",
    name: "Gravitic Reckoning",

    defenseScaling: 85,
    shredAmount: 100,
    adjacentDefenseScaling: 40,
    adjacentShredAmount: 45,

    contact: true,
    damageMode: "standard",
    priority: 1,

    description() {
      return `Atlas brings his mace down with the full weight of a falling sky behind it, and the ground gives way well past where it lands. Deals physical damage equal to ${this.defenseScaling}% of his Defense to the chosen enemy and breaks ${this.shredAmount} Shield off them; whoever stands beside them takes ${this.adjacentDefenseScaling}% of his Defense as the ground buckles under them too, breaking ${this.adjacentShredAmount} Shield.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const results = [];

      const mainDamage = (user.Defense * this.defenseScaling) / 100;
      const mainResult = new DamageEvent({
        baseDamage: mainDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const mainArr = Array.isArray(mainResult) ? mainResult : [mainResult];
      results.push(...mainArr);

      if (mainArr[0]?.landed) {
        const broken = enemy.breakShields(this.shredAmount);
        if (broken > 0) {
          results.push({
            log: `${formatChampionName(enemy)} loses ${broken} Shield to the blow.`,
          });
        }
      }

      const adjacentEnemies = context.getAdjacentChampions(enemy);
      const sideDamage = (user.Defense * this.adjacentDefenseScaling) / 100;

      for (const adjacent of adjacentEnemies) {
        const sideResult = new DamageEvent({
          baseDamage: sideDamage,
          attacker: user,
          defender: adjacent,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const sideArr = Array.isArray(sideResult) ? sideResult : [sideResult];
        results.push(...sideArr);

        if (sideArr[0]?.landed) {
          const broken = adjacent.breakShields(this.adjacentShredAmount);
          if (broken > 0) {
            results.push({
              log: `${formatChampionName(adjacent)} loses ${broken} Shield to the tremor.`,
            });
          }
        }
      }

      return results;
    },
  },

  {
    key: "crushing_grip",
    name: "Crushing Grip",

    snaredDuration: 2,

    contact: false,
    priority: 3,

    description() {
      return `Atlas closes his fist and the ground itself answers, gravity thickening around the chosen enemy until every step costs more than it's worth. Snared for ${this.snaredDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      enemy.applyStatusEffect("snared", this.snaredDuration, context, {
        sourceId: user.id,
      });

      return {
        log: `${formatChampionName(user)} uses <b>Crushing Grip</b> — ${formatChampionName(enemy)} is Snared by the sheer weight of it.`,
      };
    },
  },

  {
    key: "collapsing_firmament",
    name: "Collapsing Firmament",

    defenseScaling: 100,
    shredAmount: 130,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 58,
    priority: 0,

    description() {
      return `Atlas stops holding anything back, and the sky he carries comes down on the whole enemy line at once. Deals physical damage to every enemy equal to ${this.defenseScaling}% of his Defense, breaking ${this.shredAmount} Shield off each of them as it lands.`;
    },

    targetSpec: ["all:enemy"],

    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter((c) => c.team !== user.team && c.alive);
      const baseDamage = (user.Defense * this.defenseScaling) / 100;
      const results = [];

      for (const enemy of enemies) {
        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        if (arr[0]?.landed) {
          const broken = enemy.breakShields(this.shredAmount);
          if (broken > 0) {
            results.push({
              log: `${formatChampionName(enemy)} loses ${broken} Shield to the collapse.`,
            });
          }
        }
      }

      return results;
    },
  },
];

export default atlasSkills;
