import { regularShieldTotal } from "../../../core/championCombat.js";
import { formatChampionName } from "../../../ui/formatters.js";
import basicShot from "../generic/basicShot.js";
import { KEPT_RUNTIME_FLAG, KEPT_DURATION } from "./passive.js";

const ysvaneSkills = [
  // ========================
  // Basic Shot (global)
  // ========================
  { ...basicShot, type: "magical", hitVfxPalette: "glacial" },

  // ========================
  // Special Abilities
  // ========================

  {
    key: "ward_of_the_keep",
    name: "Ward of the Keep",

    wardDuration: 2,
    shieldAmount: 30,
    shieldDecay: 15,
    shieldCap: 120,
    vaultDuration: 3,

    contact: false,
    priority: 2,
    element: "ice",

    description() {
      return `Ysvane sets the chosen ally inside the Keep, where nothing is permitted to spoil. For ${this.wardDuration} turn(s) they carry Affliction Ward — the first negative effect that would take hold never does — under a ${this.shieldAmount} Shield.

      Nothing left untouched in the Keep stays the size it was: for ${this.vaultDuration} turn(s) that Shield does not thin, and it doubles at the start of every turn the ally came through without being hit at all, up to ${this.shieldCap}. Once the Keep lets go, the Shield thins by ${this.shieldDecay} each turn like any other.`;
    },

    targetSpec: ["select:ally"],

    resolve({ user, targets, context = {} }) {
      const [ally = user] = targets;
      const key = "vault_of_the_keep";
      const { shieldCap, shieldDecay } = this;

      ally.runtime.hookEffects ??= [];
      ally.runtime.hookEffects = ally.runtime.hookEffects.filter(
        (e) => e.key !== key,
      );

      ally.applyStatusEffect("afflictionWard", this.wardDuration, context, {
        sourceId: user.id,
      });
      ally.addShield(this.shieldAmount, 0, context, "regular", {
        vaultShield: true,
      });
      ally.runtime[KEPT_RUNTIME_FLAG] = context.currentTurn + KEPT_DURATION;

      ally.addHookEffect(
        {
          type: "buff",
          key,
          group: "skill",
          ownerId: user.id,
          expiresAtTurn: context.currentTurn + this.vaultDuration,

          hookScope: {
            onAfterDmgTaking: "defender",
          },

          // Any hit at all opens the Keep, a burn tick included.
          hookPolicies: {
            onAfterDmgTaking: {
              allowOnDot: true,
              allowOnNestedDamage: true,
              allowOnAbsolute: true,
            },
          },

          // The Shield eating the blow does not save the turn: what matters is
          // that something reached them at all.
          onAfterDmgTaking({ owner, damage, context }) {
            if (!(damage > 0)) return;
            owner.runtime.vaultShieldSpoiledTurn = context.currentTurn;
          },

          onTurnStart({ owner, context }) {
            const shield = owner.runtime.shields.find((s) => s.vaultShield);
            if (!shield) return;

            if (context.currentTurn >= this.expiresAtTurn) {
              shield.decayPerTurn = shieldDecay;
              return;
            }

            if (owner.runtime.vaultShieldSpoiledTurn === context.currentTurn - 1)
              return;
            if (shield.amount >= shieldCap) return;

            shield.amount = Math.min(shield.amount * 2, shieldCap);

            return {
              log: `The Keep has not been opened: ${formatChampionName(owner)}'s Shield doubles to ${shield.amount}.`,
            };
          },
        },
        context,
      );

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
    supremePrice: 60,

    contact: false,
    isUltimate: true,
    momentumCost: 62,
    priority: 4,
    element: "ice",

    description() {
      return `Ysvane lets the Keep out all at once and a long winter settles over her whole side of the field. Every ally is stripped of every negative status effect, gains Affliction Ward for ${this.wardDuration} turn(s) and takes ${this.damageReductionPercent}% less damage for ${this.reductionDuration} turn(s).

      An ally who walks into the winter with their Keep still sealed — an Affliction Ward nobody has spent yet, under at least ${this.supremePrice} Shield — pays ${this.supremePrice} of that Shield and the cold closes over what is left as a Supreme Shield. Whatever Shield they had above the price stays standing underneath it.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const allies = context.aliveChampions.filter((c) => c.team === user.team);
      const crystallized = [];

      for (const ally of allies) {
        if (
          ally.hasStatusEffect("afflictionWard") &&
          regularShieldTotal(ally) >= this.supremePrice
        ) {
          ally.breakShields(this.supremePrice);
          ally.addShield(1, 0, context, "supreme");
          crystallized.push(ally);

          context.registerDialog({
            message: `The Keep closes over ${formatChampionName(ally)} and does not open again.`,
            sourceId: user.id,
            targetId: ally.id,
          });
        }

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

      const sealed = crystallized.length
        ? ` The Keep seals over ${crystallized.map(formatChampionName).join(", ")}: Supreme Shield.`
        : "";

      return {
        log: `${formatChampionName(user)} lets the Keep out over the whole team: every ally cleansed, Warded and wrapped in the long winter.${sealed}`,
      };
    },
  },
];

export default ysvaneSkills;
