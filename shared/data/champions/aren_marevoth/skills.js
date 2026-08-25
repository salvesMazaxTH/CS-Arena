import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";
import { applyTide, consumeTide, getTideStacks } from "./tide.js";
import { getClaimPoints } from "../../../engine/combat/claim.js";

const arenMarevothSkills = [
  // ========================
  // Total block (global)
  // ========================
  totalBlock,

  // ========================
  // S1 — Abyssal Tidal Mark
  // ========================
  {
    key: "abyssal_tidal_mark",
    name: "Abyssal Tidal Mark",
    bf: 70,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "water",

    description() {
      return `When this ability hits a target, it applies Tide to them. When it hits a target with 2 or more Tide, consume all Tide on that target to deal 10 absolute damage and remove 2 buffs from them.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const currentTideStacks = getTideStacks(enemy);

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
      const hitSuccess = results.some((r) => !r?.evaded && !r?.immune);

      if (hitSuccess) {
        if (currentTideStacks >= 2) {
          consumeTide(enemy);

          const bonusResult = new DamageEvent({
            baseDamage: 10,
            attacker: user,
            defender: enemy,
            skill: this,
            type: "magical",
            mode: DamageEvent.Modes.ABSOLUTE,
            context,
            allChampions: context?.allChampions,
          }).execute();

          const bonusResults = Array.isArray(bonusResult)
            ? bonusResult
            : [bonusResult];
          results.push(...bonusResults);

          const buffs = enemy.getStatusEffects({ type: "buff" });
          const buffsToRemove = buffs.slice(0, 2);
          for (const buff of buffsToRemove) {
            enemy.removeStatusEffect(buff.key);
          }

          context.registerDialog?.({
            message: `${formatChampionName(user)} consumed all <b>Tide</b> on ${formatChampionName(enemy)}, dealing 10 absolute damage and removing ${buffsToRemove.length} buff(s)!`,
            sourceId: user.id,
            targetId: enemy.id,
          });
        } else {
          applyTide(enemy);
        }
      }

      return results;
    },
  },

  // ========================
  // S2 — Blessing of the Ocean Depths
  // ========================
  {
    key: "blessing_of_the_ocean_depths",
    name: "Blessing of the Ocean Depths",
    contact: false,
    priority: 0,
    element: "water",

    description() {
      return `Gain Spellshield. The next time this champion uses Claim, restore 10% of his Max HP and gain 1 additional point.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.addShield(1, 0, context, "spell");

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      if (
        !user.runtime.hookEffects.some(
          (he) => he.key === "blessing_of_the_ocean_depths_hook",
        )
      ) {
        user.runtime.hookEffects.push({
          key: "blessing_of_the_ocean_depths_hook",
          group: "skill",
          hookScope: {
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, actionSource, skill, context }) {
            if (actionSource !== owner) return;
            if (skill?.key !== "claim") return;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== "blessing_of_the_ocean_depths_hook",
            );

            const healAmount = owner.maxHP * 0.1;
            owner.heal(healAmount, context, owner);

            return {
              log: `${formatChampionName(owner)} restored ${Math.floor(healAmount)} HP and gained 1 additional Claim point from Blessing of the Ocean Depths.`,
              type: "score",
              amount: 1,
              scoringSlot: owner.team - 1,
            };
          },
        });
      }

      return {
        log: `${formatChampionName(user)} activated <b>Blessing of the Ocean Depths</b>, gaining a Spellshield!`,
      };
    },
  },

  // ========================
  // S3 (ULTIMATE) — Abyssal Depths
  // ========================
  {
    key: "abyssal_depths",
    name: "Abyssal Depths",
    bf: 100,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "water",

    description() {
      return `When this ability hits a target with 2 or more Tide, consume all Tide on that target to deal 30 absolute damage and remove 4 buffs from them.\n\nThe next time this champion uses Claim while possessing 5 or more Value Points, increase his Max HP by 12% permanently. Max: +36%.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const currentTideStacks = getTideStacks(enemy);

      const result = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const hitSuccess = results.some((r) => !r?.evaded && !r?.immune);

      if (hitSuccess && currentTideStacks >= 2) {
        consumeTide(enemy);

        const bonusResult = new DamageEvent({
          baseDamage: 30,
          attacker: user,
          defender: enemy,
          skill: this,
          type: "physical",
          mode: DamageEvent.Modes.ABSOLUTE,
          context,
          allChampions: context?.allChampions,
        }).execute();

        const bonusResults = Array.isArray(bonusResult)
          ? bonusResult
          : [bonusResult];
        results.push(...bonusResults);

        const buffs = enemy.getStatusEffects({ type: "buff" });
        const buffsToRemove = buffs.slice(0, 4);
        for (const buff of buffsToRemove) {
          enemy.removeStatusEffect(buff.key);
        }

        context.registerDialog?.({
          message: `${formatChampionName(user)} consumed all <b>Tide</b> on ${formatChampionName(enemy)}, dealing 30 absolute damage and removing ${buffsToRemove.length} buff(s)!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      if (
        !user.runtime.hookEffects.some((he) => he.key === "abyssal_depths_hook")
      ) {
        user.runtime.hookEffects.push({
          key: "abyssal_depths_hook",
          group: "skill",
          hookScope: {
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, actionSource, skill, context }) {
            if (actionSource !== owner) return;
            if (skill?.key !== "claim") return;

            const claimPoints =
              context?.preActionClaimPoints ??
              getClaimPoints(owner, context?.currentTurn);

            if (claimPoints >= 4) {
              owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
                (he) => he.key !== "abyssal_depths_hook",
              );

              owner.runtime.abyssalDepthsHpStacks =
                owner.runtime.abyssalDepthsHpStacks || 0;

              if (owner.runtime.abyssalDepthsHpStacks < 3) {
                owner.runtime.abyssalDepthsHpStacks += 1;
                const hpBonus = Math.round(owner.baseHP * 0.12);
                owner.maxHP += hpBonus;
                owner.HP += hpBonus;

                return {
                  log: `${formatChampionName(owner)} triggered Abyssal Depths (5+ Value Points), permanently increasing Max HP by 12% (+${hpBonus} HP)! (${owner.runtime.abyssalDepthsHpStacks}/3)`,
                };
              }
            }
          },
        });
      }

      return results;
    },
  },
];

export default arenMarevothSkills;
