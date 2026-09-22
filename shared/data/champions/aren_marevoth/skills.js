import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import totalBlock from "../generic/totalBlock.js";
import { applyTide, consumeTide, getTideStacks } from "./tide.js";
import {
  CLAIM_ACTION_KEY,
  getClaimPoints,
} from "../../../engine/combat/claim.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

// Strip up to `max` positive effects — positive status effects first, then
// standalone stat buffs — and return how many fell.
function stripPositiveEffects(target, max) {
  const statuses = target.getStatusEffects({ type: "buff" }).slice(0, max);
  for (const status of statuses) target.removeStatusEffect(status.key);

  let mods = [];
  if (statuses.length < max) {
    mods = target.statModifiers
      .filter((mod) => mod.amount > 0 && !mod.statusKey)
      .slice(0, max - statuses.length);
    target.removeStatModifiers(mods);
  }

  return statuses.length + mods.length;
}

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
    tideBonusDamage: 15,
    positiveEffectsStripped: 2,

    description() {
      return {
        en: `Deals magical damage to the chosen target and applies <b>Tide</b> to them. When it hits a target with <b>${this.tideThreshold}</b> or more <b>Tide</b>, consume all <b>Tide</b> on that target to deal <b>${this.tideBonusDamage}</b> bonus damage and strip up to <b>${this.positiveEffectsStripped}</b> positive status effects or stat buffs from them.`,
        pt: `Causa dano mágico ao alvo escolhido e aplica <b>Maré</b> nele. Quando acerta um alvo com <b>${this.tideThreshold}</b> ou mais de <b>Maré</b>, consome toda a <b>Maré</b> daquele alvo para causar <b>${this.tideBonusDamage}</b> de dano bônus e remover até <b>${this.positiveEffectsStripped}</b> efeitos de status positivos ou bônus de atributo dele.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const willConsumeTide = getTideStacks(enemy) >= this.tideThreshold;

      const result = new DamageEvent({
        baseDamage,
        bonusDamage: willConsumeTide ? this.tideBonusDamage : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];

      // Reflects and counter-attacks ride along in `results` aimed back at him.
      const mainResult = results.find((entry) => entry.targetId === enemy.id);

      if (mainResult.landed) {
        if (willConsumeTide) {
          consumeTide(enemy);

          const stripped = stripPositiveEffects(enemy, this.positiveEffectsStripped);

          context.registerDialog?.({
            message: `${formatChampionName(user)} consumed all <b>Tide</b> on ${formatChampionName(enemy)}, dealing ${this.tideBonusDamage} bonus damage and stripping ${stripped} positive effect(s)!`,
            sourceId: user.id,
            targetId: enemy.id,
          });
        } else {
          applyTide(enemy, context);
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
      return {
        en: `Gain <b>Spellshield</b>. The next time this champion uses <b>CLAIM</b>, restore <b>${this.healPercent}%</b> of his <b>Max HP</b> and gain <b>${this.bonusClaimPoints}</b> additional point.`,
        pt: `Ganha <b>Escudo Mágico</b>. Na próxima vez que este campeão usar <b>CLAIM</b>, restaura <b>${this.healPercent}%</b> de seu <b>HP Máximo</b> e ganha <b>${this.bonusClaimPoints}</b> ponto adicional.`,
      };
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
        user.addHookEffect({
          type: "buff",
          key: "blessing_of_the_ocean_depths_hook",
          group: "skill",
          hookScope: {
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, actionSource, skill, context }) {
            if (actionSource !== owner) return;
            if (skill?.key !== CLAIM_ACTION_KEY) return;

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
              log: `${formatChampionName(owner)} restored ${restored} HP and gained ${bonusClaimPoints} additional CLAIM point from Blessing of the Ocean Depths.`,
              type: "score",
              amount: bonusClaimPoints,
              scoringSlot: owner.team - 1,
            };
          },
        }, context);
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
    positiveEffectsStripped: 3,
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
      return {
        en: `Deals physical damage to the chosen target. When this ability hits a target with <b>${this.tideThreshold}</b> or more <b>Tide</b>, consume all <b>Tide</b> on that target to deal <b>${this.tideBonusDamage}</b> bonus damage and strip up to <b>${this.positiveEffectsStripped}</b> positive status effects or stat buffs from them.\n\nThe next time this champion uses <b>CLAIM</b> while possessing <b>${this.claimPointsRequired}</b> or more Value Points, increase his <b>Max HP</b> by <b>${this.maxHPBonusPercent}%</b> permanently. Max: <b>+${this.maxHPBonusPercent * this.maxHPBonusStacks}%</b>.`,
        pt: `Causa dano físico ao alvo escolhido. Quando esta habilidade acerta um alvo com <b>${this.tideThreshold}</b> ou mais de <b>Maré</b>, consome toda a <b>Maré</b> daquele alvo para causar <b>${this.tideBonusDamage}</b> de dano bônus e remover até <b>${this.positiveEffectsStripped}</b> efeitos de status positivos ou bônus de atributo dele.\n\nNa próxima vez que este campeão usar <b>CLAIM</b> possuindo <b>${this.claimPointsRequired}</b> ou mais Pontos de Valor, aumenta seu <b>HP Máximo</b> em <b>${this.maxHPBonusPercent}%</b> permanentemente. Máximo: <b>+${this.maxHPBonusPercent * this.maxHPBonusStacks}%</b>.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      const willConsumeTide = getTideStacks(enemy) >= this.tideThreshold;
      const claimPointsRequired = this.claimPointsRequired;
      const maxHPBonusPercent = this.maxHPBonusPercent;
      const maxHPBonusStacks = this.maxHPBonusStacks;

      const result = new DamageEvent({
        baseDamage,
        bonusDamage: willConsumeTide ? this.tideBonusDamage : 0,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const mainResult = results.find((entry) => entry.targetId === enemy.id);

      if (mainResult.landed && willConsumeTide) {
        consumeTide(enemy);

        const stripped = stripPositiveEffects(enemy, this.positiveEffectsStripped);

        context.registerDialog?.({
          message: `${formatChampionName(user)} consumed all <b>Tide</b> on ${formatChampionName(enemy)}, dealing ${this.tideBonusDamage} bonus damage and stripping ${stripped} positive effect(s)!`,
          sourceId: user.id,
          targetId: enemy.id,
        });
      }

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      if (
        !user.runtime.hookEffects.some((he) => he.key === "abyssal_depths_hook")
      ) {
        user.addHookEffect({
          type: "buff",
          key: "abyssal_depths_hook",
          group: "skill",
          hookScope: {
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, actionSource, skill, context }) {
            if (actionSource !== owner) return;
            if (skill?.key !== CLAIM_ACTION_KEY) return;

            const claimPoints =
              context?.preActionClaimPoints ??
              getClaimPoints(owner, context?.currentTurn);

            if (claimPoints < claimPointsRequired) return;

            owner.runtime.abyssalDepthsHpStacks ??= 0;

            if (owner.runtime.abyssalDepthsHpStacks >= maxHPBonusStacks) return;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== "abyssal_depths_hook",
            );

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
        }, context);
      }

      return results;
    },
  },
];

export default arenMarevothSkills;
