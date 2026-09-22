import { DamageEvent } from "../../../engine/combat/DamageEvent.js";
import { getClaimPoints } from "../../../engine/combat/claim.js";
import totalBlock from "../generic/totalBlock.js";

const clayGodslayerSkills = [
  // ========================
  // Total Block (global)
  // ========================
  totalBlock,

  // ========================
  // Special Abilities
  // ========================

  {
    key: "nothing_left_to_lose",
    name: "Nothing Left to Lose",

    bf: 60,
    missingHpScalingPercent: 85,

    contact: true,
    damageMode: "standard",
    priority: 0,

    description() {
      return {
        en: `Clay never came back from the brink — he just learned to fight from there. Deals <b>physical damage</b>, adding up to an extra <b>${this.missingHpScalingPercent}%</b> of his <b>Attack</b> scaled by how much <b>HP</b> he has already lost.`,
        pt: `Clay nunca voltou da beira do abismo — ele só aprendeu a lutar dali. Causa <b>dano físico</b>, somando até mais <b>${this.missingHpScalingPercent}%</b> de seu <b>Ataque</b> escalado pela quantidade de <b>HP</b> que já perdeu.`,
      };
    },

    targetSpec: ["enemy"],

    resolve({ user, targets, context = {} }) {
      const [enemy] = targets;
      const missingHpRatio = 1 - user.HP / user.maxHP;
      const baseDamage =
        (user.Attack * this.bf) / 100 +
        (user.Attack * this.missingHpScalingPercent * missingHpRatio) / 100;

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
    key: "reckoning",
    name: "Reckoning",

    bf: 145,

    contact: true,
    damageMode: "standard",
    isUltimate: true,
    momentumCost: 55,
    priority: 0,

    description() {
      return {
        en: `Clay puts everything he has left into one last swing at the throne. Deals massive <b>physical damage</b> to the chosen target; if it kills them, he scores points equal to his current <b>CLAIM</b> value.`,
        pt: `Clay coloca tudo o que lhe resta num último golpe contra o trono. Causa dano <b>físico</b> massivo ao alvo escolhido; se o golpe o matar, ele marca pontos iguais ao seu valor atual de <b>CLAIM</b>.`,
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

      // `result` also carries reflect/thorns entries; only the hit on the chosen target counts.
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
            reason: this.key,
            sourceId: user.id,
          });
        }
      }

      return result;
    },
  },
];

export default clayGodslayerSkills;
