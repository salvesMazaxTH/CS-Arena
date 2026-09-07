import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import basicStrike from "../generic/basicStrike.js";

const kyleHayatoSkills = [
  // ========================
  // Basic Strike (global)
  // ========================
  basicStrike,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "current_thief",
    name: "Current Thief",

    bf: 60,
    paralyzedDuration: 1,
    momentumStealAmount: 8,

    contact: true,
    damageMode: "standard",
    element: "lightning",
    critOptions: { disable: true },
    priority: 1,

    description() {
      return `Kyle closes the distance in a single crack of current and takes what he needs on the way past. Deals physical damage equal to ${this.bf}% of his Attack, is never a critical hit, Paralyzes the chosen enemy for ${this.paralyzedDuration} turn(s), and steals up to ${this.momentumStealAmount} Momentum from them.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {}, resolver }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      if (effectConnected(arr[0], "paralyzed")) {
        enemy.applyStatusEffect("paralyzed", this.paralyzedDuration, context, {
          sourceId: user.id,
        });

        const { applied } = resolver.applyResourceChange({
          target: enemy,
          amount: -this.momentumStealAmount,
          context,
          sourceId: user.id,
          clampToAvailable: true,
        });

        const stolen = Math.abs(applied);
        if (stolen > 0) {
          resolver.applyResourceChange({
            target: user,
            amount: stolen,
            context,
            sourceId: user.id,
          });

          arr.push({
            log: `${formatChampionName(user)} steals ${stolen} Momentum on the way past.`,
          });
        }
      }

      return arr;
    },
  },

  {
    key: "between_flashes",
    name: "Between Flashes",

    bf: 75,
    bonusFlat: 25,
    invisibleDuration: 2,

    contact: true,
    damageMode: "standard",
    element: "lightning",
    critOptions: { disable: true },
    priority: 2,

    description() {
      return `Kyle steps out of the space between one flash of lightning and the next, lands the hit before the thunder even catches up, and is already gone. Deals physical damage equal to ${this.bf}% of his Attack plus ${this.bonusFlat} flat, is never a critical hit, and leaves him Invisible for up to ${this.invisibleDuration} turns, ending early the moment he acts again.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100 + this.bonusFlat;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];

      user.removeStatusEffect("invisible");
      user.applyStatusEffect("invisible", this.invisibleDuration, context, {
        source: this.key,
      });

      arr.push({
        log: `${formatChampionName(user)} slips back into the storm.`,
      });

      return arr;
    },
  },

  {
    key: "usurpers_bolt",
    name: "Usurper's Bolt",

    bf: 95,
    momentumStealAmount: 18,
    claimDivertPercent: 50,
    markWindow: 2,

    contact: false,
    damageMode: "standard",
    element: "lightning",
    critOptions: { disable: true },
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return `Kyle points at whoever has climbed the highest this match and brings the whole storm down on them at once — the throne looks the same from the top no matter who is standing on it. Deals magical damage to the enemy with the most Momentum, is never a critical hit, and steals up to ${this.momentumStealAmount} Momentum from them; if they used CLAIM within the last ${this.markWindow} turn(s), ${this.claimDivertPercent}% of what they scored is usurped for Kyle's team as well.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {}, resolver }) {
      const enemies = (context.aliveChampions ?? []).filter(
        (c) => c.team !== user.team,
      );

      if (!enemies.length) {
        return {
          log: `${formatChampionName(user)} finds no throne worth taking.`,
        };
      }

      const enemy = enemies.sort((a, b) => b.momentum - a.momentum)[0];
      const baseDamage = (user.Attack * this.bf) / 100;

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const arr = Array.isArray(result) ? result : [result];
      if (!arr[0]?.landed) return arr;

      const { applied } = resolver.applyResourceChange({
        target: enemy,
        amount: -this.momentumStealAmount,
        context,
        sourceId: user.id,
        clampToAvailable: true,
      });

      const stolen = Math.abs(applied);
      if (stolen > 0) {
        resolver.applyResourceChange({
          target: user,
          amount: stolen,
          context,
          sourceId: user.id,
        });

        arr.push({
          log: `${formatChampionName(user)} steals ${stolen} Momentum from ${formatChampionName(enemy)}.`,
        });
      }

      const markUntil = enemy.runtime.shadowstormMarkUntilTurn;
      const markPoints = enemy.runtime.shadowstormMarkPoints || 0;

      if (markUntil !== undefined && markUntil > context.currentTurn) {
        // The bolt spends the mark whether or not there is score left to take.
        delete enemy.runtime.shadowstormMarkUntilTurn;
        delete enemy.runtime.shadowstormMarkPoints;

        const diverted = Math.min(
          Math.round(markPoints * (this.claimDivertPercent / 100)),
          context.getScore(enemy.team - 1),
        );

        if (diverted > 0) {
          context.registerScore({
            amount: diverted,
            scoringSlot: user.team - 1,
            reason: this.key,
            sourceId: user.id,
          });
          context.registerScore({
            amount: -diverted,
            scoringSlot: enemy.team - 1,
            reason: this.key,
            sourceId: user.id,
          });

          context.registerDialog({
            message: `${formatChampionName(user)} comes down on ${formatChampionName(enemy)} and leaves with what they climbed for.`,
            sourceId: user.id,
            targetId: enemy.id,
          });

          arr.push({
            log: `${formatChampionName(user)} usurps ${diverted} point(s) ${formatChampionName(enemy)} had just claimed.`,
          });
        }
      }

      return arr;
    },
  },
];

export default kyleHayatoSkills;
