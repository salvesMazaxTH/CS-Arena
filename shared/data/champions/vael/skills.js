import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { getClaimPoints } from "../../../engine/combat/claim.js";
import totalBlock from "../generic/totalBlock.js";

const vaelSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================
  {
    key: "instantaneous_slash",
    name: "Instantaneous Slash",
    bf: 65,
    contact: true,
    damageMode: "standard",
    hitVfx: "slash",
    priority: 0,

    description() {
      return {
        en: `Vael flashes forward in a swift slash, dealing damage to the enemy with a chance to land a critical hit.`,
        pt: `Vael avança num lampejo veloz, causando dano ao inimigo com chance de desferir um acerto crítico.`,
      };
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
    key: "piercing_lunge",
    name: "Piercing Lunge",
    bfPrimary: 55,
    bfSecondary: 60,
    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Vael lunges through the chosen target with a swift strike, dealing <b>${this.bfPrimary}%</b> damage without critical hits. The enemy to the target's left is struck as well, if one exists, taking <b>${this.bfSecondary}%</b> damage as a guaranteed critical hit.`,
        pt: `Vael investe através do alvo escolhido com um golpe veloz, causando <b>${this.bfPrimary}%</b> de dano sem chance de crítico. O inimigo à esquerda do alvo também é atingido, se houver um, recebendo <b>${this.bfSecondary}%</b> de dano como um acerto crítico garantido.`,
      };
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
        critOptions: { disable: true },
        allChampions: context?.allChampions,
      }).execute();

      const primaryResults = Array.isArray(primaryResult)
        ? primaryResult
        : [primaryResult];
      results.push(...primaryResults);

      const [secondaryTarget] = context.getAdjacentChampions(primary, {
        side: "left",
      });

      if (!secondaryTarget) return results;

      const secondaryResult = new DamageEvent({
        baseDamage: (user.Attack * this.bfSecondary) / 100,
        attacker: user,
        defender: secondaryTarget,
        skill: this,
        type: "physical",
        context,
        critOptions: { force: true },
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
    key: "verdict_of_the_silent_edge",
    name: "Verdict of the Silent Edge",
    bf: 145,
    contact: true,
    damageMode: "standard",
    hitVfx: "multislash",

    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Vael delivers a devastating strike with his silent blade, dealing massive damage to the chosen target. If this attack kills the target, Vael scores points equal to his current <b>CLAIM</b> value.`,
        pt: `Vael desfere um golpe devastador com sua lâmina silenciosa, causando dano massivo ao alvo escolhido. Se esse ataque matar o alvo, Vael marca pontos iguais ao seu valor de <b>CLAIM</b> atual.`,
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

      // Only the strike on the chosen target counts: `result` also carries
      // reflect/thorns entries, which are aimed back at Vael.
      const results = Array.isArray(result) ? result : [result];
      const didKill = results.some(
        (entry) => entry?.targetId === enemy.id && entry?.killed,
      );

      if (didKill) {
        const claimPoints =
          context.preActionClaimPoints ??
          getClaimPoints(user, context.currentTurn) ??
          0;

        if (claimPoints > 0) {
          context.registerScore({
            amount: claimPoints,
            scoringSlot: user.team - 1,
            reason: "verdict_of_the_silent_edge",
            sourceId: user.id,
          });
        }
      }

      return result;
    },
  },
];

export default vaelSkills;