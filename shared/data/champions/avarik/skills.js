import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import totalBlock from "../generic/totalBlock.js";
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
      return {
        en: `Avarik closes one stone-scaled fist around the chosen target and weighs them against the whole mountain he carries, dealing <b>${this.maxHPPercent}%</b> of his <b>Max HP</b> as <b>Absolute Damage</b>.`,
        pt: `Avarik fecha um punho de escamas de pedra ao redor do alvo escolhido e o pesa contra a montanha inteira que carrega, causando <b>${this.maxHPPercent}%</b> de seu <b>HP Máximo</b> como <b>Dano Absoluto</b>.`,
      };
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
      return {
        en: `Avarik tears a slab of bedrock loose and swallows it whole, restoring <b>${this.healPercent}%</b> of his <b>Max HP</b>.

      His appetite then carries over to the ledger: the next time this champion uses <b>CLAIM</b>, he seizes <b>${this.bonusClaimPoints}</b> additional points.`,
        pt: `Avarik arranca uma laje de rocha e a engole inteira, restaurando <b>${this.healPercent}%</b> de seu <b>HP Máximo</b>.

      Seu apetite então se estende ao registro: na próxima vez que este campeão usar <b>CLAIM</b>, ele arrebata <b>${this.bonusClaimPoints}</b> pontos adicionais.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      const healAmount = (user.maxHP * this.healPercent) / 100;

      const restored = new HealEvent({
        target: user,
        amount: healAmount,
        context,
      }).execute();

      user.runtime ??= {};
      user.runtime.hookEffects ??= [];

      const bonusClaimPoints = this.bonusClaimPoints;

      if (
        !user.runtime.hookEffects.some(
          (he) => he.key === GLUTTONS_TOLL_HOOK_KEY,
        )
      ) {
        user.addHookEffect({
          type: "buff",
          key: GLUTTONS_TOLL_HOOK_KEY,
          group: "skill",
          hookScope: {
            // Avarik only collects this toll from his own CLAIM.
            onActionResolved: "actionSource",
          },

          onActionResolved({ owner, skill }) {
            if (skill?.key !== CLAIM_ACTION_KEY) return;

            owner.runtime.hookEffects = owner.runtime.hookEffects.filter(
              (he) => he.key !== GLUTTONS_TOLL_HOOK_KEY,
            );

            return {
              type: "score",
              amount: bonusClaimPoints,
              scoringSlot: owner.team - 1,
              log: `${formatChampionName(owner)} collected <b>Glutton's Toll</b> from his own CLAIM, seizing ${bonusClaimPoints} additional point(s).`,
            };
          },
        }, context);
      }

      return {
        log: `${formatChampionName(user)} swallowed a slab of bedrock, restoring ${restored} HP and setting <b>Glutton's Toll</b> on his next CLAIM.`,
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
      return {
        en: `Avarik hurls everything he has hoarded — the plates of his own body and the mountain buried under them — at the chosen target, dealing heavy <b>Earth</b> physical damage.

      The hoard lands with him: the target also takes bonus <b>Absolute Damage</b> equal to <b>${this.currentHPPercent}%</b> of Avarik's current <b>HP</b>.`,
        pt: `Avarik arremessa tudo o que acumulou — as placas do próprio corpo e a montanha soterrada sob elas — contra o alvo escolhido, causando pesado dano físico de <b>Terra</b>.

      O acúmulo cai junto com ele: o alvo também sofre <b>Dano Absoluto</b> bônus igual a <b>${this.currentHPPercent}%</b> do <b>HP</b> atual de Avarik.`,
      };
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
      const hitSuccess = results.some((r) => r?.landed);

      if (!hitSuccess || !enemy.alive) return results;

      // Weighed after the strike resolves, so the bonus reads Avarik's HP now.
      const hoardDamage = Math.floor((user.HP * this.currentHPPercent) / 100);

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
