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
        en: `Avarik closes one stone-scaled fist around the chosen target and weighs them against the whole mountain he carries, dealing <b>${this.maxHPPercent}%</b> of his <b>Max HP</b> as <b>Absolute Damage</b>. Deals physical damage.`,
        pt: `Avarik fecha um punho de escamas de pedra ao redor do alvo escolhido e o pesa contra a montanha inteira que carrega, causando <b>${this.maxHPPercent}%</b> de seu <b>HP Máximo</b> como <b>Dano Absoluto</b>. Causa dano físico.`,
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
        en: `Avarik tears a slab of bedrock loose and swallows it whole, restoring <b>${this.healPercent}%</b> of his <b>Max HP</b>.\n\nHis appetite carries over to the ledger: the next time Avarik uses <b>CLAIM</b>, he seizes <b>${this.bonusClaimPoints}</b> additional points. The toll <b>does not stack</b>.`,
        pt: `Avarik arranca uma laje de rocha e a engole inteira, restaurando <b>${this.healPercent}%</b> de seu <b>HP Máximo</b>.\n\nSeu apetite se estende ao registro: na próxima vez que Avarik usar <b>CLAIM</b>, ele arrebata <b>${this.bonusClaimPoints}</b> pontos adicionais. O pedágio <b>não acumula</b>.`,
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

      const bonusClaimPoints = this.bonusClaimPoints;
      const alreadySet = user.runtime?.hookEffects?.some(
        (he) => he.key === GLUTTONS_TOLL_HOOK_KEY,
      );

      if (alreadySet) {
        context.registerDialog?.({
          message: {
            en: `${formatChampionName(user)}'s <b>Glutton's Toll</b> is already set — it does not stack.`,
            pt: `O <b>Glutton's Toll</b> de ${formatChampionName(user)} já está armado — ele não acumula.`,
          },
          sourceId: user.id,
        });
      } else {
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

            owner.removeHookEffects((he) => he.key === GLUTTONS_TOLL_HOOK_KEY);

            return {
              type: "score",
              amount: bonusClaimPoints,
              scoringSlot: owner.team - 1,
              log: {
                en: `${formatChampionName(owner)} collected <b>Glutton's Toll</b> from his own CLAIM, seizing <b>${bonusClaimPoints}</b> additional point(s).`,
                pt: `${formatChampionName(owner)} cobrou o <b>Glutton's Toll</b> do próprio CLAIM, arrebatando <b>${bonusClaimPoints}</b> ponto(s) adicional(is).`,
              },
            };
          },
        }, context);
      }

      return {
        log: {
          en: `${formatChampionName(user)} swallowed a slab of bedrock, restoring <b>${restored}</b> HP${alreadySet ? "" : " and setting <b>Glutton's Toll</b> on his next CLAIM"}.`,
          pt: `${formatChampionName(user)} engoliu uma laje de rocha, restaurando <b>${restored}</b> de HP${alreadySet ? "" : " e armando o <b>Glutton's Toll</b> no próximo CLAIM"}.`,
        },
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
        en: `Avarik hurls everything he has hoarded — the plates of his own body and the mountain buried under them — at the chosen target.\n\nThe hoard lands with him: the target also takes bonus <b>Absolute Damage</b> equal to <b>${this.currentHPPercent}%</b> of Avarik's current <b>HP</b>. Deals physical damage.`,
        pt: `Avarik arremessa tudo o que acumulou — as placas do próprio corpo e a montanha soterrada sob elas — contra o alvo escolhido.\n\nO acúmulo cai junto com ele: o alvo também sofre <b>Dano Absoluto</b> bônus igual a <b>${this.currentHPPercent}%</b> do <b>HP</b> atual de Avarik. Causa dano físico.`,
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
        message: {
          en: `The whole hoard lands on ${formatChampionName(enemy)}, dealing <b>${hoardDamage}</b> Absolute Damage!`,
          pt: `Todo o acúmulo desaba sobre ${formatChampionName(enemy)}, causando <b>${hoardDamage}</b> de Dano Absoluto!`,
        },
        sourceId: user.id,
        targetId: enemy.id,
      });

      return results;
    },
  },
];

export default avarikSkills;
