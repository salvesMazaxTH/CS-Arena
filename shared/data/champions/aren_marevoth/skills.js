import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../totalBlock.js";
import { applyTide, consumeTide, getTideStacks } from "./tide.js";
import { getClaimPoints } from "../../../engine/combat/claim.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

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

    tideThreshold: 2,
    tideBonusDamage: 10,
    buffsRemoved: 2,

    description() {
      return `When this ability hits a target, it applies Tide to them. When it hits a target with ${this.tideThreshold} or more Tide, consume all Tide on that target to deal ${this.tideBonusDamage} absolute damage and remove ${this.buffsRemoved} buffs from them.`;
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
        if (currentTideStacks >= this.tideThreshold) {
          consumeTide(enemy);

          const bonusResult = new DamageEvent({
            baseDamage: this.tideBonusDamage,
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
          const buffsToRemove = buffs.slice(0, this.buffsRemoved);
          for (const buff of buffsToRemove) {
            enemy.removeStatusEffect(buff.key);
          }

          context.registerDialog?.({
            message: `${formatChampionName(user)} consumed all <b>Tide</b> on ${formatChampionName(enemy)}, dealing ${this.tideBonusDamage} absolute damage and removing ${buffsToRemove.length} buff(s)!`,
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

    healPercent: 10,
    bonusClaimPoints: 1,

    description() {
      return `Gain Spellshield. The next time this champion uses Claim, restore ${this.healPercent}% of his Max HP and gain ${this.bonusClaimPoints} additional point.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const healPercent = this.healPercent;
      const bonusClaimPoints = this.bonusClaimPoints;

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

            const restored = new HealEvent({
              target: owner,
              amount: owner.maxHP * (healPercent / 100),
              context,
              source: owner,
            }).execute();

            return {
              log: `${formatChampionName(owner)} restored ${restored} HP and gained ${bonusClaimPoints} additional Claim point from Blessing of the Ocean Depths.`,
              type: "score",
              amount: bonusClaimPoints,
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
    tideThreshold: 2,
    tideBonusDamage: 30,
    buffsRemoved: 4,
    claimPointsRequired: 5,
    maxHPBonusPercent: 12,
    maxHPBonusStacks: 3,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "water",

    description() {
      return `When this ability hits a target with ${this.tideThreshold} or more Tide, consume all Tide on that target to deal ${this.tideBonusDamage} absolute damage and remove ${this.buffsRemoved} buffs from them.\n\nThe next time this champion uses Claim while possessing ${this.claimPointsRequired} or more Value Points, increase his Max HP by ${this.maxHPBonusPercent}% permanently. Max: +${this.maxHPBonusPercent * this.maxHPBonusStacks}%.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const currentTideStacks = getTideStacks(enemy);
      const claimPointsRequired = this.claimPointsRequired;
      const maxHPBonusPercent = this.maxHPBonusPercent;
      const maxHPBonusStacks = this.maxHPBonusStacks;

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

      if (hitSuccess && currentTideStacks >= this.tideThreshold) {
        consumeTide(enemy);

        const bonusResult = new DamageEvent({
          baseDamage: this.tideBonusDamage,
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
        const buffsToRemove = buffs.slice(0, this.buffsRemoved);
        for (const buff of buffsToRemove) {
          enemy.removeStatusEffect(buff.key);
        }

        context.registerDialog?.({
          message: `${formatChampionName(user)} consumed all <b>Tide</b> on ${formatChampionName(enemy)}, dealing ${this.tideBonusDamage} absolute damage and removing ${buffsToRemove.length} buff(s)!`,
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

            if (claimPoints < claimPointsRequired) return;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== "abyssal_depths_hook",
            );

            owner.runtime.abyssalDepthsHpStacks ??= 0;

            if (owner.runtime.abyssalDepthsHpStacks >= maxHPBonusStacks) return;

            owner.runtime.abyssalDepthsHpStacks += 1;

            const hpBonus = Math.round(owner.baseHP * (maxHPBonusPercent / 100));

            owner.modifyHP(hpBonus, {
              context,
              affectMax: true,
              isPermanent: true,
            });

            return {
              log: `${formatChampionName(owner)} triggered Abyssal Depths (${claimPointsRequired}+ Value Points), permanently increasing Max HP by ${maxHPBonusPercent}% (+${hpBonus} HP)! (${owner.runtime.abyssalDepthsHpStacks}/${maxHPBonusStacks})`,
            };
          },
        });
      }

      return results;
    },
  },
];

export default arenMarevothSkills;
