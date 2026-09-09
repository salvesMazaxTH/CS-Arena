import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import basicStrike from "../generic/basicStrike.js";

const sebastianIgnisSkills = [
  // ========================
  // Basic Strike (global)
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "least_resistance",
    name: "Least Resistance",

    bf: 60,
    apathyBonusFlat: 15,
    burnDuration: 2,

    contact: true,
    damageMode: "standard",
    element: "fire",
    priority: 1,

    description() {
      return `Sebastian barely raises the blade, a flick of flame that costs him nothing he wasn't already carrying. Deals physical damage, plus ${this.apathyBonusFlat} bonus damage per Apathy stack spent, and always sets the chosen enemy Burning for ${this.burnDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      user.runtime ??= {};
      const stacks = user.runtime.apathyStacks || 0;
      user.runtime.apathyStacks = 0;

      const result = new DamageEvent({
        baseDamage: (user.Attack * this.bf) / 100,
        bonusDamage: this.apathyBonusFlat * stacks,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "burning")) {
        enemy.applyStatusEffect("burning", this.burnDuration, context, {
          sourceId: user.id,
        });
      }

      if (stacks > 0) {
        context.registerDialog({
          message: `${formatChampionName(user)} finally moves, and everything he saved goes into the swing.`,
          sourceId: user.id,
          targetId: user.id,
        });

        arr.push({
          log: `${formatChampionName(user)} finally moves — ${stacks} Apathy stack(s) spent.`,
        });
      }

      return arr;
    },
  },

  {
    key: "a_song_he_already_knows",
    name: "A Song He Already Knows",

    damageReductionPercent: 12,
    perStackPercent: 1,
    duration: 3,

    contact: false,
    priority: 3,

    description() {
      return `Sebastian plays a few bars on the harp, the same ones he always plays, and doesn't bother learning a new one for the occasion — it works anyway. Every ally takes ${this.damageReductionPercent}% less damage for ${this.duration} turn(s), plus ${this.perStackPercent}% for every Apathy stack spent.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.runtime ??= {};
      const stacks = user.runtime.apathyStacks || 0;
      user.runtime.apathyStacks = 0;

      const reduction =
        this.damageReductionPercent + this.perStackPercent * stacks;

      const allies = (context.aliveChampions ?? []).filter(
        (c) => c.team === user.team,
      );

      for (const ally of allies) {
        ally.applyDamageReduction({
          amount: reduction,
          duration: this.duration,
          type: "percent",
          source: this.key,
          context,
        });
      }

      if (stacks > 0) {
        context.registerDialog({
          message: `${formatChampionName(user)} lets the whole bank go into the harp.`,
          sourceId: user.id,
          targetId: user.id,
        });
      }

      return {
        log: `${formatChampionName(user)} plays <b>A Song He Already Knows</b> — the whole team takes ${reduction}% less damage for a while.`,
      };
    },
  },

  {
    key: "the_one_thing_he_does_well",
    name: "The One Thing He Does Well",

    bf: 80,
    apathyBonusPercent: 12,
    burnDuration: 2,

    contact: true,
    damageMode: "standard",
    element: "fire",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Every stack of neglect Sebastian's been banking comes due at once, and for a moment he commits completely — the ground around the chosen enemy goes up with them. Deals physical damage, plus ${this.apathyBonusPercent}% more per Apathy stack spent, to them and whoever stands beside them, always setting each one Burning for ${this.burnDuration} turn(s).`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [primary] = targets;

      user.runtime ??= {};
      const stacks = user.runtime.apathyStacks || 0;
      user.runtime.apathyStacks = 0;

      const multiplier = 1 + (this.apathyBonusPercent * stacks) / 100;
      const results = [];
      const hitTargets = [primary, ...context.getAdjacentChampions(primary)];

      for (const target of hitTargets) {
        const baseDamage = (user.Attack * this.bf * multiplier) / 100;

        const result = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: target,
          skill: this,
          type: "physical",
          context,
          allChampions: context?.allChampions,
        }).execute();

        const arr = Array.isArray(result) ? result : [result];
        results.push(...arr);

        if (effectConnected(arr[0], "burning")) {
          target.applyStatusEffect("burning", this.burnDuration, context, {
            sourceId: user.id,
          });
        }
      }

      if (stacks > 0) {
        context.registerDialog({
          message: `${formatChampionName(user)} finally commits — everything he banked comes due at once.`,
          sourceId: user.id,
          targetId: user.id,
        });

        results.push({
          log: `${formatChampionName(user)} finally commits — ${stacks} Apathy stack(s) spent.`,
        });
      }

      return results;
    },
  },
];

export default sebastianIgnisSkills;
