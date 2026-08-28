import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { findTwin } from "../pairs/twinBond.js";

const SISTER_KEYS = ["laisaelis", "laiserisa"];

const laiserisaSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Erase
  // ========================
  {
    key: "erase",
    name: "Erase",

    momentumGain: 20,

    contact: false,
    priority: 2,

    description() {
      return `Laiserisa turns to something her sister only answered into being and withdraws the answer. An Echo of Manifest is erased where it stands, and what it was becomes hers: a shield equal to the Echo's current HP, and ${this.momentumGain} Momentum. Only an Echo can be erased.`;
    },

    targetSpec: [
      {
        type: "select:any",
        entityType: "minion",
        requiresRuntimeFlag: "manifestEcho",
      },
    ],

    resolve({ user, targets, context, resolver }) {
      const [echo] = targets;
      const shieldAmount = echo.HP;

      echo.HP = 0;
      echo.alive = false;

      user.addShield(shieldAmount, 0, context);
      resolver.applyResourceChange({
        target: user,
        amount: this.momentumGain,
        context,
        sourceId: user.id,
      });

      context.registerDialog({
        message: `<b>${this.name}</b> — ${formatChampionName(echo)} is withdrawn, and what it was settles over ${formatChampionName(user)}.`,
        sourceId: user.id,
        targetId: echo.id,
      });

      return {
        log: `${formatChampionName(user)} erases ${formatChampionName(echo)}, taking ${shieldAmount} shield and ${this.momentumGain} Momentum from it.`,
      };
    },
  },

  // ========================
  // Return to Nothing
  // ========================
  {
    key: "return_to_nothing",
    name: "Return to Nothing",

    vanishTurns: 1,

    contact: false,
    priority: 3,

    description() {
      return `Laiserisa lets the chosen target stop being for a while: they leave the field for the Nothingness and step back out ${this.vanishTurns} turn(s) later, unreachable on arrival. Should Laiserisa herself be gone by then, the Nothingness lets go at once and returns them early. Neither sister can be sent.`;
    },

    targetSpec: [{ type: "select:any", excludesKeys: SISTER_KEYS }],

    resolve({ user, targets, context }) {
      const [target] = targets;

      context.requestChampionMutation({
        mode: "vanish",
        targetId: target.id,
        turns: this.vanishTurns,
        ruptureSourceId: user.id,
      });

      const message = `<b>${this.name}</b> — ${formatChampionName(user)} lets ${formatChampionName(target)} stop being, for a while.`;

      context.registerDialog({
        message,
        sourceId: user.id,
        targetId: target.id,
      });

      return { log: message };
    },
  },

  // ========================
  // Ultimate
  // ========================
  {
    key: "then_let_me_take_you_with_me",
    name: "Then Let Me Take You With Me",

    auraDuration: 2,
    vanishTurns: 2,
    returnHPPercent: 25,

    contact: false,
    isUltimate: true,
    momentumCost: 60,
    priority: 4,

    description() {
      return `Laiserisa accepts what her sister spent the whole match refusing, and binds their two endings into one. For ${this.auraDuration} turn(s), the next lethal effect that would take either sister instead empties her to a sliver, and at the start of the next turn both slip into the Nothingness together — returning ${this.vanishTurns} turns later with ${this.returnHPPercent}% of their base Max HP each, and only once the field has room for both. Struck down in that sliver of a turn, they go for good. It cannot be bound while her sister is absent from the field.`;
    },

    targetSpec: ["self"],

    resolve({ user, context }) {
      const twin = findTwin(user, context);

      if (!twin) {
        return {
          log: `${formatChampionName(user)} reaches for her sister and finds no one to take with her.`,
        };
      }

      const skillName = this.name;
      const vanishTurns = this.vanishTurns;
      const hpRatio = this.returnHPPercent / 100;
      const groupId = `twin_departure_${user.id}`;

      const aura = {
        type: "buff",
        key: "twin_departure",
        group: "skill",
        ownerId: user.id,
        expiresAtTurn: context.currentTurn + this.auraDuration,

        hookScope: {
          onBeforeDmgTaking: "defender",
        },

        hookPolicies: {
          onBeforeDmgTaking: { allowOnDot: true, allowOnNestedDamage: true },
        },

        onBeforeDmgTaking({ defender, owner, damage, context }) {
          if (defender !== owner) return;
          if (owner.HP - damage > 0) return;

          owner.runtime.preventFinishingUntilTurn = context.currentTurn + 1;

          for (const sister of [user, twin]) {
            sister.runtime.hookEffects = sister.runtime.hookEffects.filter(
              (effect) => effect.key !== "twin_departure",
            );

            context.schedule({
              type: "championMutation",
              turnToHappen: context.currentTurn + 1,
              payload: {
                targetId: sister.id,
                mode: "vanish",
                turns: vanishTurns,
                returnState: { hpRatio, groupId },
              },
            });
          }

          context.registerDialog({
            message: `<b>${skillName}</b> — ${formatChampionName(owner)} is taken, and does not go alone.`,
            sourceId: owner.id,
            targetId: owner.id,
          });

          return {
            damage: Math.max(owner.HP - 1, 0),
            log: `${formatChampionName(user)} and ${formatChampionName(twin)} are bound for the Nothingness together.`,
          };
        },
      };

      for (const sister of [user, twin]) {
        sister.runtime.hookEffects ??= [];
        sister.runtime.hookEffects = sister.runtime.hookEffects.filter(
          (effect) => effect.key !== "twin_departure",
        );
        sister.addHookEffect({ ...aura }, context);
      }

      return {
        log: `${formatChampionName(user)} binds her ending to ${formatChampionName(twin)}'s: neither will be left behind.`,
      };
    },
  },
];

export default laiserisaSkills;
