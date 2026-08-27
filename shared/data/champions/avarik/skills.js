import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import totalBlock from "../totalBlock.js";
import { HealEvent } from "../../../engine/combat/HealEvent.js";

const GLUTTONS_TOLL_HOOK_KEY = "gluttons_toll_hook";

const avarikSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // S1 — Bedrock Assay
  // ========================
  {
    key: "bedrock_assay",
    name: "Bedrock Assay",
    maxHPPercent: 14,
    contact: true,
    damageMode: "absolute",
    priority: 0,
    element: "earth",

    description() {
      return `Avarik closes one stone-scaled fist around the chosen target and weighs them against the whole mountain he carries, dealing ${this.maxHPPercent}% of his Max HP as Absolute Damage.`;
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.maxHP * this.maxHPPercent) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: DamageEvent.Modes.ABSOLUTE,
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },

  // ========================
  // S2 — Glutton's Toll
  // ========================
  {
    key: "gluttons_toll",
    name: "Glutton's Toll",
    healPercent: 12,
    bonusClaimPoints: 3,
    contact: false,
    priority: 0,
    element: "earth",

    description() {
      return `Avarik tears a slab of bedrock loose and swallows it whole, restoring ${this.healPercent}% of his Max HP.

      His appetite then carries over to the ledger: the next time this champion uses Claim, he seizes ${this.bonusClaimPoints} additional points.`;
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const healAmount = (user.maxHP * this.healPercent) / 100;

      new HealEvent({ target: user, amount: healAmount, context }).execute();

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      const bonusClaimPoints = this.bonusClaimPoints;

      if (
        !user.runtime.hookEffects.some(
          (he) => he.key === GLUTTONS_TOLL_HOOK_KEY,
        )
      ) {
        user.runtime.hookEffects.push({
          key: GLUTTONS_TOLL_HOOK_KEY,
          group: "skill",
          hookScope: {
            // Avarik only collects this toll from his own Claim.
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, actionSource, skill }) {
            if (actionSource !== owner) return;
            if (skill?.key !== CLAIM_ACTION_KEY) return;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== GLUTTONS_TOLL_HOOK_KEY,
            );

            return {
              type: "score",
              amount: bonusClaimPoints,
              scoringSlot: owner.team - 1,
              log: `${formatChampionName(owner)} collected <b>Glutton's Toll</b> from his own Claim, seizing ${bonusClaimPoints} additional point(s).`,
            };
          },
        });
      }

      return {
        log: `${formatChampionName(user)} swallowed a slab of bedrock, restoring ${Math.floor(healAmount)} HP and setting <b>Glutton's Toll</b> on his next Claim.`,
      };
    },
  },

  // ========================
  // S3 (ULTIMATE) — Weight of the Hoard
  // ========================
  {
    key: "weight_of_the_hoard",
    name: "Weight of the Hoard",
    bf: 105,
    currentHPPercent: 12,
    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "earth",

    description() {
      return `Avarik hurls everything he has hoarded — the plates of his own body and the mountain buried under them — at the chosen target, dealing heavy Earth physical damage.

      The hoard lands with him: the target also takes bonus Absolute Damage equal to ${this.currentHPPercent}% of Avarik's current HP.`;
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
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const hitSuccess = results.some((r) => !r?.evaded && !r?.immune);

      if (!hitSuccess) return results;

      // The hoard is weighed at the moment it lands, so the bonus reads
      // Avarik's HP after the strike has already resolved.
      const hoardDamage = Math.floor(
        (user.HP * this.currentHPPercent) / 100,
      );

      if (hoardDamage <= 0) return results;

      const hoardResult = new DamageEvent({
        baseDamage: hoardDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        mode: DamageEvent.Modes.ABSOLUTE,
        context,
        allChampions: context?.allChampions,
      }).execute();

      results.push(
        ...(Array.isArray(hoardResult) ? hoardResult : [hoardResult]),
      );

      context.registerDialog?.({
        message: `The whole hoard lands on ${formatChampionName(enemy)}, dealing ${hoardDamage} Absolute Damage!`,
        sourceId: user.id,
        targetId: enemy.id,
      });

      return results;
    },
  },
];

export default avarikSkills;
