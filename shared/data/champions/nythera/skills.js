import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicStrike from "../generic/basicStrike.js";

const nytheraSkills = [
  basicStrike,
  {
    key: "boreal_edge",
    name: "Boreal Edge",
    bf: 75,

    chillDuration: 2,
    freezeDuration: 1,
    bonusIfCold: 50,

    contact: false,
    priority: 0,

    element: "ice",
    description() {
      return `Nythera draws an edge of northern wind across the chosen target, dealing Ice magical damage and leaving them Chilled for ${this.chillDuration} turn(s).

      If the cold already holds them, the edge bites for +${this.bonusIfCold}% bonus damage, and a Chilled target is seized outright: Frozen for ${this.freezeDuration} turn(s).`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [target] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const wasFrozen = target.hasStatusEffect("frozen");
      const wasChilled = target.hasStatusEffect("chilled");
      const wasCold = wasChilled || wasFrozen;

      const result = new DamageEvent({
        baseDamage: wasCold
          ? baseDamage * (1 + this.bonusIfCold / 100)
          : baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Status effects only land if the damage connected (not evaded, not immune).
      if (!result?.evaded && !result?.immune && !wasFrozen) {
        if (wasChilled) {
          target.applyStatusEffect("frozen", this.freezeDuration, context);
        } else {
          target.applyStatusEffect("chilled", this.chillDuration, context);
        }
      }

      return result;
    },
  },

  {
    key: "stasis_chamber",
    name: "Stasis Chamber",
    effectDuration: 2,
    contact: false,

    freezeDuration: 2,
    dmgReduct: 35,

    priority: 3,
    element: "ice",
    description() {
      return `Nythera seals herself inside a chamber of standing ice for ${this.effectDuration} turn(s), gaining ${this.dmgReduct}% damage reduction.

      Anyone who deals damage to her while the chamber holds is caught by the stillness and becomes Frozen for ${this.freezeDuration} turn(s).`;
    },
    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.applyDamageReduction({
        amount: this.dmgReduct,
        duration: this.effectDuration,
        source: "Stasis Chamber",
        type: "percent",
        context,
      });

      const freezeDuration = this.freezeDuration;

      user.runtime.hookEffects ??= [];

      const effect = {
        key: "stasis_chamber",
        expiresAtTurn: context?.currentTurn + this.effectDuration,

        hookScope: {
          onAfterDmgTaking: "defender",
        },

        onAfterDmgTaking({ attacker, damage, context }) {
          if (damage <= 0 || attacker.team === user.team) return;

          attacker.applyStatusEffect("frozen", freezeDuration, context);

          return {
            log: `${formatChampionName(attacker)} is caught by the stillness of the <b>Stasis Chamber</b>!`,
          };
        },
      };

      user.runtime.hookEffects.push(effect);

      const sealed = `${formatChampionName(user)} seals herself inside a chamber of standing ice.`;

      context.registerDialog({
        message: sealed,
        sourceId: user.id,
        targetId: user.id,
      });

      return { log: sealed };
    },
  },

  {
    key: "throne_of_the_white_night",
    name: "Throne of the White Night",
    bf: 70,

    chillDuration: 2,
    freezeDuration: 1,
    bfIfCold: 110,
    bonusIfFrozen: 50,

    contact: false,
    priority: 1,

    isUltimate: true,
    momentumCost: 55,

    element: "ice",
    description() {
      return `Nythera takes her throne and the white night falls over the chosen target, dealing Ice magical damage and leaving them Chilled for ${this.chillDuration} turn(s).

      Against a target already touched by the cold, the throne answers in full: base force rises to ${this.bfIfCold} and the target is Frozen for ${this.freezeDuration} turn(s). If they were already Frozen, the ice also splits them for ${this.bonusIfFrozen} bonus damage.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [target] = targets;

      const isFrozen = target.hasStatusEffect("frozen");
      const isChilled = target.hasStatusEffect("chilled");

      let baseDamage;

      // Base force.
      if (isChilled || isFrozen) {
        baseDamage = (user.Attack * this.bfIfCold) / 100;
      } else {
        baseDamage = (user.Attack * this.bf) / 100;
      }

      // Extra bonus if the target is already Frozen.
      if (isFrozen) {
        baseDamage += this.bonusIfFrozen;
      }

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: target,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      // Status effects only land if the damage connected (not evaded, not immune).
      if (!result?.evaded && !result?.immune) {
        if (isChilled) {
          target.applyStatusEffect("frozen", this.freezeDuration, context);
        } else if (!isFrozen) {
          target.applyStatusEffect("chilled", this.chillDuration, context);
        }
      }

      return result;
    },
  },
];

export default nytheraSkills;
