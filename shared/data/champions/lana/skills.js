import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { effectConnected } from "../../../engine/combat/effectApplication.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";

const lanaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,
  // ========================
  // Special Abilities
  // ========================
  {
    key: "dont_you_dare",
    name: "Don't You Dare!",

    priority: 3,

    description() {
      return `Lana shouts the chosen target down, and their next action simply refuses to happen. Fails if Don't You Dare! was already used on the previous turn.`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;

      // Default keeps the skill usable on the very first turn.
      const lastUsed = user.runtime.lastUsedDontYouDare ?? -Infinity;

      if (context.currentTurn - lastUsed <= 1) {
        const failure = `${formatChampionName(user)} tries to shout again, but <b>Don't You Dare!</b> was already used last turn!`;

        context.registerDialog({
          message: failure,
          sourceId: user.id,
          targetId: enemy.id,
        });

        return { log: failure };
      }

      user.runtime.lastUsedDontYouDare = context.currentTurn;

      // Initialize hookEffects if missing.
      enemy.runtime.hookEffects ??= [];

      const hookKey = `dont_you_dare_${user.id}`;

      // Register the hook that blocks the next action.
      enemy.addHookEffect({
        type: "debuff",
        key: hookKey,
        group: "skill_effect",

        hookScope: {
          onValidateAction: "actionSource",
        },

        onValidateAction({ actionSource }) {
          // Remove the hook once the action has been blocked.
          actionSource.runtime.hookEffects =
            actionSource.runtime.hookEffects.filter((h) => h.key !== hookKey);

          return {
            deny: true,
            message: `${formatChampionName(actionSource)} freezes up! Their action is blocked!`,
          };
        },
      }, context);

      return {
        log: `${formatChampionName(enemy)} will not be able to act next!`,
      };
    },
  },

  {
    key: "kinetic_hurl",
    name: "Kinetic Hurl",

    bf: 95,
    damageMode: "standard",
    contact: false,

    snareDuration: 1,

    description() {
      return `Lana closes her fist and the chosen target is torn off the ground and thrown, taking magical damage and left Snared for ${this.snareDuration} turn(s) as her grip keeps them off their feet.`;
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      if (results.some((r) => effectConnected(r, "snared")) && enemy.alive) {
        enemy.applyStatusEffect("snared", this.snareDuration, context);
      }

      return results;
    },
  },

  {
    key: "psychic_surge",
    name: "Psychic Surge",

    bf: 110,
    damageMode: "standard",
    contact: false,
    isUltimate: true,
    momentumCost: 55,

    griefBonusPercent: 15,

    priority: 0,
    description() {
      return `Everything Lana has been holding in comes out at once, striking all enemies with massive magical damage.

      The damage grows with the HP she has already lost, and if Tutu has fallen, grief drives it ${this.griefBonusPercent}% higher.`;
    },
    targetSpec: ["all:enemy"],
    resolve({ user, targets, context = {} }) {
      const enemies = targets.filter(
        (champion) => champion.team !== user.team && champion.alive,
      );

      const percentLost = (user.maxHP - user.HP) / user.maxHP;
      let baseDamage =
        ((user.Attack * this.bf) / 100) * (1 + percentLost * 0.6);

      // Tutu has already fallen (the swap happened and Lana is back on the field).
      if (user.runtime?.lana?.triggered) {
        baseDamage *= 1 + this.griefBonusPercent / 100;
      }

      const results = [];

      for (const enemy of enemies) {
        const damageResult = new DamageEvent({
          baseDamage,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "magical",
          context,
          allChampions: context?.allChampions,
        }).execute();
        const damageResults = Array.isArray(damageResult)
          ? damageResult
          : [damageResult];
        results.push(...damageResults);
      }

      return results;
    },
  },
];

export default lanaSkills;
