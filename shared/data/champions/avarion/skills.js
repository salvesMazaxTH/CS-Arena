import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { formatChampionName } from "../../../ui/formatters.js";
import { CLAIM_ACTION_KEY } from "../../../engine/combat/claim.js";
import totalBlock from "../generic/totalBlock.js";

const MISERS_TOLL_HOOK_KEY = "misers_toll_hook";

const avarionSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // S1 — Gilded Assay
  // ========================
  {
    key: "gilded_assay",
    name: "Gilded Assay",
    bf: 60,
    attackShred: 20,
    shredDuration: 2,
    contact: false,
    damageMode: "standard",
    priority: 0,
    element: "earth",

    description() {
      return {
        en: `Avarion sets the chosen target on the scales of his crystal staff, appraises them and finds them wanting.\n\nThe verdict is written down: the target's <b>Attack</b> is reduced by <b>${this.attackShred}</b> for <b>${this.shredDuration}</b> turns. Deals magical damage.`,
        pt: `Avarion coloca o alvo escolhido na balança de seu cajado de cristal, o avalia e o considera insuficiente.\n\nO veredito fica registrado: o <b>Ataque</b> do alvo é reduzido em <b>${this.attackShred}</b> por <b>${this.shredDuration}</b> turnos. Causa dano mágico.`,
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const hitSuccess = results.some((r) => r?.landed);

      if (!hitSuccess) return results;

      enemy.modifyStat({
        statName: "Attack",
        amount: -this.attackShred,
        duration: this.shredDuration,
        context,
        statModifierSrc: user,
      });

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(enemy)} was appraised and found wanting: -${this.attackShred} Attack!`,
          pt: `${formatChampionName(enemy)} foi avaliado e considerado insuficiente: -${this.attackShred} de Ataque!`,
        },
        sourceId: user.id,
        targetId: enemy.id,
      });

      return results;
    },
  },

  // ========================
  // S2 — Miser's Toll
  // ========================
  {
    key: "misers_toll",
    name: "Miser's Toll",
    attackBonusPercent: 15,
    attackBonusDuration: 2,
    tollPoints: 2,
    contact: false,
    priority: 0,
    element: "earth",

    description() {
      return {
        en: `Avarion draws the loose crystal of the field into his own hand, increasing his <b>Attack</b> by <b>${this.attackBonusPercent}%</b> for <b>${this.attackBonusDuration}</b> turns.\n\nHe then hangs his toll gate over the enemy ledger: the next time an enemy champion uses <b>CLAIM</b>, that champion scores <b>${this.tollPoints}</b> fewer points and Avarion's team collects those points instead.`,
        pt: `Avarion atrai o cristal solto do campo para sua própria mão, aumentando seu <b>Ataque</b> em <b>${this.attackBonusPercent}%</b> por <b>${this.attackBonusDuration}</b> turnos.\n\nEle então pendura seu pedágio sobre o registro inimigo: na próxima vez que um campeão inimigo usar <b>CLAIM</b>, aquele campeão marca <b>${this.tollPoints}</b> pontos a menos e o time de Avarion coleta esses pontos.`,
      };
    },

    targetSpec: ["self"],

    resolve({ user, context = {} }) {
      user.modifyStat({
        statName: "Attack",
        amount: this.attackBonusPercent,
        duration: this.attackBonusDuration,
        isPercent: true,
        context,
        statModifierSrc: user,
      });

      const tollPoints = this.tollPoints;

      if (
        !user.runtime?.hookEffects?.some((he) => he.key === MISERS_TOLL_HOOK_KEY)
      ) {
        user.addHookEffect({
          type: "buff",
          key: MISERS_TOLL_HOOK_KEY,
          group: "skill",
          // No hookScope: the toll watches the enemy's CLAIM, not Avarion's
          // own actions, so this hook must run on every resolved action rather
          // than only on the ones Avarion is the source of.

          onActionResolved({ owner, actionSource, skill, context }) {
            if (skill?.key !== CLAIM_ACTION_KEY) return;
            if (!owner?.alive) return;
            if (!actionSource || actionSource.team === owner.team) return;

            // The CLAIM has already scored by the time this hook runs, and the
            // resolver publishes the points it actually awarded. The context
            // is created per action, so that number is never shared between
            // two CLAIMs.
            const claimedPoints = Number(context.preActionClaimPoints);

            // A toll can never take back more than the CLAIM brought in.
            const collected = Math.min(tollPoints, claimedPoints);

            if (!(collected > 0)) return;

            owner.removeHookEffects((he) => he.key === MISERS_TOLL_HOOK_KEY);

            // The deduction on the claimer's side and the matching gain on
            // Avarion's side.
            return [
              {
                type: "score",
                amount: -collected,
                scoringSlot: actionSource.team - 1,
                sourceId: owner.id,
                log: {
                  en: `${formatChampionName(owner)} levied <b>Miser's Toll</b> on ${formatChampionName(actionSource)}'s CLAIM, diverting <b>${collected}</b> point(s) to his own ledger.`,
                  pt: `${formatChampionName(owner)} cobrou o <b>Pedágio do Avarento</b> sobre o CLAIM de ${formatChampionName(actionSource)}, desviando <b>${collected}</b> ponto(s) para o próprio livro-razão.`,
                },
              },
              {
                type: "score",
                amount: collected,
                scoringSlot: owner.team - 1,
                sourceId: owner.id,
              },
            ];
          },
        }, context);
      }

      return {
        log: {
          en: `${formatChampionName(user)} gathered the loose crystal of the field and hung <b>Miser's Toll</b> over the enemy ledger.`,
          pt: `${formatChampionName(user)} recolheu o cristal solto do campo e pendurou o <b>Pedágio do Avarento</b> sobre o livro-razão inimigo.`,
        },
      };
    },
  },

  // ========================
  // S3 (ULTIMATE) — Weight of the Ledger
  // ========================
  {
    key: "weight_of_the_ledger",
    name: "Weight of the Ledger",
    bf: 115,
    attackShred: 30,
    shredDuration: 3,
    contact: false,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    element: "earth",

    description() {
      return {
        en: `Avarion closes the ledger on the chosen target, and every debt he ever recorded against them comes down at once as crystallized stone.\n\nThe entry stays open against them: the target's <b>Attack</b> is reduced by <b>${this.attackShred}</b> for <b>${this.shredDuration}</b> turns. Deals magical damage.`,
        pt: `Avarion fecha o registro sobre o alvo escolhido, e cada dívida que já lançou contra ele desaba de uma vez como pedra cristalizada.\n\nA entrada permanece aberta contra ele: o <b>Ataque</b> do alvo é reduzido em <b>${this.attackShred}</b> por <b>${this.shredDuration}</b> turnos. Causa dano mágico.`,
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
        type: "magical",
        context,
        allChampions: context?.allChampions,
      }).execute();

      const results = Array.isArray(result) ? result : [result];
      const hitSuccess = results.some((r) => r?.landed);

      if (!hitSuccess) return results;

      enemy.modifyStat({
        statName: "Attack",
        amount: -this.attackShred,
        duration: this.shredDuration,
        context,
        statModifierSrc: user,
      });

      context.registerDialog?.({
        message: {
          en: `${formatChampionName(enemy)} was written down in the ledger: -${this.attackShred} Attack for ${this.shredDuration} turns!`,
          pt: `${formatChampionName(enemy)} foi anotado no livro-razão: -${this.attackShred} de Ataque por ${this.shredDuration} turnos!`,
        },
        sourceId: user.id,
        targetId: enemy.id,
      });

      return results;
    },
  },
];

export default avarionSkills;
