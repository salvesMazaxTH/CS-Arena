import { formatChampionName } from "../../../ui/formatters.js";
import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import totalBlock from "../totalBlock.js";
import { getClaimPoints } from "../../../engine/combat/claim.js";

const vaelSkills = [
  // ========================
  // Total block (global)
  // ========================
  totalBlock,
  // ========================
  // Habilidades Especiais
  // ========================
  {
    key: "corte_instantaneo",
    name: "Corte Instantâneo",
    bf: 65,
    contact: true,
    damageMode: "standard",
    priority: 0,
    description() {
      return `Causa dano ao inimigo com chance de crítico.`;
    },
    targetSpec: ["enemy"],
    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const baseDamage = (user.Attack * this.bf) / 100;

      return new DamageEvent({
        baseDamage,
        attacker: user,
        defender: enemy,
        skill: this,
        type: "physical",
        context,
        allChampions: context?.allChampions,
      }).execute();
    },
  },
  {
    key: "investida_transpassante",
    name: "Investida Transpassante",
    bfPrimary: 55,
    bfSecondary: 60,
    contact: true,
    damageMode: "standard",
    priority: 0,
    description() {
      return `Causa dano ao inimigo (BF ${this.bfPrimary}, sem crítico) e ao inimigo à esquerda do alvo, caso exista (BF ${this.bfSecondary}, crítico garantido).`;
    },
    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [primary] = targets;

      const baseDamage = (user.Attack * this.bfPrimary) / 100;
      const results = [];

      const primaryResult = new DamageEvent({
        baseDamage,
        attacker: user,
        defender: primary,
        skill: this,
        type: "physical",
        context,
        critOptions: { disable: true }, // sem crítico
        allChampions: context?.allChampions,
      }).execute();
      const primaryResults = Array.isArray(primaryResult)
        ? primaryResult
        : [primaryResult];
      results.push(...primaryResults);

      console.log(
        `[INVESTIDA TRANSPASSANTE] primary.combatSlot: ${primary.combatSlot}, primary.team: ${primary.team}`,
      );

      const [secondaryTarget] = context.getAdjacentChampions(primary, {
        side: "left",
      });

      console.log(
        "[INVESTIDA TRANSPASSANTE] Alvo adjacente (left):",
        secondaryTarget?.name ?? "NENHUM",
      );

      if (!secondaryTarget) return results;

      const secondaryResult = new DamageEvent({
        baseDamage: (user.Attack * this.bfSecondary) / 100,
        attacker: user,
        defender: secondaryTarget,
        skill: this,
        type: "physical",
        context,
        critOptions: { force: true }, // crítico garantido
        allChampions: context?.allChampions,
      }).execute();
      const secondaryResults = Array.isArray(secondaryResult)
        ? secondaryResult
        : [secondaryResult];
      results.push(...secondaryResults);

      return results;
    },
  },

  {
    key: "veredito_do_fio_silencioso",
    name: "Veredito do Fio Silencioso",
    bf: 145,
    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,
    description() {
      return `Causa dano devastador ao alvo inimigo escolhido. Se esse ataque matar o alvo, você ganha  pontos equivalentes ao meu valor atual de Claim.`;
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

      const didKill = Array.isArray(result)
        ? result.some((entry) => entry?.killed)
        : result?.killed;

      if (didKill) {
        const claimPoints =
          context.preActionClaimPoints ??
          getClaimPoints(user, context.currentTurn) ??
          0;

        if (claimPoints > 0) {
          context.registerScore({
            amount: claimPoints,
            scoringSlot: user.team - 1,
            reason: "veredito_do_fio_silencioso",
            sourceId: user.id,
          });
        }
      }

      return result;
    },
  },
];

export default vaelSkills;
