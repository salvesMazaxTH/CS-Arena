import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { KEPT_RUNTIME_FLAG, KEPT_DURATION } from "./passive.js";

const ysvaneSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical" },

  // ========================
  // Special Abilities
  // ========================

  {
    key: "ward_of_the_keep",
    name: "Ward of the Keep",

    wardDuration: 2,
    shieldAmount: 30,
    shieldDecay: 15,

    contact: false,
    priority: 2,
    element: "ice",

    description() {
      return `Ysvane sets the chosen ally inside the Keep, where nothing is permitted to spoil. For ${this.wardDuration} turn(s) they carry Affliction Ward — the first negative effect that would take hold never does — under a ${this.shieldAmount} Shield that thins by ${this.shieldDecay} each turn.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;

      ally.applyStatusEffect("afflictionWard", this.wardDuration, context, {
        sourceId: user.id,
      });
      ally.addShield(this.shieldAmount, this.shieldDecay, context);
      ally.runtime[KEPT_RUNTIME_FLAG] = context.currentTurn + KEPT_DURATION;

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} sets ${
          userName === allyName ? "herself" : allyName
        } inside the Keep: Affliction Ward and a ${this.shieldAmount} Shield.`,
      };
    },
  },

  {
    key: "hold_fast",
    name: "Hold Fast",

    effectDuration: 2,
    damageReductionPercent: 30,

    contact: false,
    priority: 2,
    element: "ice",

    lockedOutStatusKeys: ["stunned", "frozen"],

    description() {
      return `Ysvane closes the cold around the chosen ally until they are held at exactly the shape they were. For ${this.effectDuration} turn(s) they take ${this.damageReductionPercent}% less damage and cannot be Stunned or Frozen — nothing gets a grip on what the Keep is holding.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;
      const key = "hold_fast_stasis";
      const lockedOutStatusKeys = this.lockedOutStatusKeys;

      ally.runtime.hookEffects ??= [];
      ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
        (e) => e.key !== key,
      );

      ally.applyDamageReduction({
        amount: this.damageReductionPercent,
        duration: this.effectDuration,
        type: "percent",
        source: this.key,
        context,
      });

      ally.addHookEffect(
        {
          type: "buff",
          key,
          group: "skill",
          ownerId: user.id,
          expiresAtTurn: context.currentTurn + this.effectDuration,

          hookScope: {
            onStatusEffectIncoming: "target",
          },

          onStatusEffectIncoming({ target, owner, statusEffect }) {
            if (target !== owner) return;
            if (!lockedOutStatusKeys.includes(statusEffect?.key)) return;
            return {
              cancel: true,
              message: `${formatChampionName(owner)} is Held Fast: ${statusEffect.name} finds no grip.`,
            };
          },
        },
        context,
      );

      const userName = formatChampionName(user);
      const allyName = formatChampionName(ally);

      return {
        log: `${userName} holds ${
          userName === allyName ? "herself" : allyName
        } fast: ${this.damageReductionPercent}% less damage and no hold takes.`,
      };
    },
  },

  {
    key: "the_long_winter",
    name: "The Long Winter",

    wardDuration: 2,
    damageReductionPercent: 20,
    reductionDuration: 2,

    contact: false,
    isUltimate: true,
    momentumCost: 62,
    priority: 4,
    element: "ice",

    description() {
      return `Ysvane lets the Keep out all at once and a long winter settles over her whole side of the field. Every ally is stripped of every negative status effect, gains Affliction Ward for ${this.wardDuration} turn(s) and takes ${this.damageReductionPercent}% less damage for ${this.reductionDuration} turn(s).`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);

      for (const ally of allies) {
        ally
          .getStatusEffects({ type: "debuff" })
          .forEach((se) => ally.removeStatusEffect(se.key));

        ally.applyStatusEffect("afflictionWard", this.wardDuration, context, {
          sourceId: user.id,
        });
        ally.applyDamageReduction({
          amount: this.damageReductionPercent,
          duration: this.reductionDuration,
          type: "percent",
          source: this.key,
          context,
        });
        ally.runtime[KEPT_RUNTIME_FLAG] = context.currentTurn + KEPT_DURATION;
      }

      return {
        log: `${formatChampionName(user)} lets the Keep out over the whole team: every ally cleansed, Warded and wrapped in the long winter.`,
      };
    },
  },
];

export default ysvaneSkills;
